// 행사장 군중 시뮬레이션 엔진 — 순수 JS(ES module), 브라우저 전용, LLM 0회.
//
// 모델: Collision-Free Speed Model (Tordeux·Chraibi·Seyfried 2015) — 속도가
// 앞사람과의 간격으로 정해지는 1차 모델이라 사회력 모델처럼 진동하지 않고,
// dt 0.1s 로도 안정적이다. 방향은 목적지별 흐름장(flow field, 격자 다익스트라)
// 에서 읽고, 이웃·벽 반발을 더해 정한다.
//
// 좌표는 **미터**(행사장 중심 기준 동-북 평면). 위경도 변환은 geo.js 가 한다.
// 이 파일은 절대 방문객 수를 "예측"하지 않는다 — 넣어 준 유입 시나리오를
// 재생하고, 그 결과 밀도(명/㎡)와 대기열을 잰다. 시나리오는 사용자가 정한다.

// ── 밀도 등급 (명/㎡) ─────────────────────────────────────────────
// 1차 기준: 행정안전부 「다중운집인파사고 안전관리 가이드라인」(2024.9) p.1 실외
//   여유 2 · 주의 3~4 · 위험 5 (1인 0.46㎡, NFPA 101). 이태원 수사 결과 7명/㎡에서 유체화.
// 보조: Fruin 보행 LOS — A<0.31 B<0.43 C<0.72 D<1.08 E<2.17 F≥2.17
export const LOS = [
  { grade: "여유", max: 1.0, color: "rgba(0,0,0,0)" },
  { grade: "보통", max: 2.0, color: "rgba(120,170,90,0.35)" },
  { grade: "혼잡", max: 3.0, color: "rgba(220,200,60,0.5)" },
  { grade: "주의", max: 4.0, color: "rgba(240,150,40,0.6)" },
  { grade: "경계", max: 5.0, color: "rgba(225,80,40,0.7)" },
  { grade: "위험", max: Infinity, color: "rgba(140,20,30,0.85)" },
];
/** 병목 판정 임계 — 이 밀도가 60초 넘게 유지되면 병목으로 센다 (행안부 "주의" 하한) */
export const WATCH_DENSITY = 3.0;
/** 한계 판정 임계 — 이 밀도가 60초 넘게 유지되면 그 배수를 상한으로 본다 (행안부 "위험") */
export const LIMIT_DENSITY = 5.0;
export function losOf(density) {
  for (const l of LOS) if (density < l.max) return l;
  return LOS[LOS.length - 1];
}

// ── 격자 ───────────────────────────────────────────────────────────
export class Grid {
  constructor(minX, minY, maxX, maxY, cell) {
    this.cell = cell;
    this.minX = minX; this.minY = minY;
    this.w = Math.ceil((maxX - minX) / cell) + 1;
    this.h = Math.ceil((maxY - minY) / cell) + 1;
    this.walk = new Uint8Array(this.w * this.h); // 1 = 걸을 수 있음
  }
  idx(cx, cy) { return cy * this.w + cx; }
  toCell(x, y) {
    return [Math.floor((x - this.minX) / this.cell), Math.floor((y - this.minY) / this.cell)];
  }
  toWorld(cx, cy) {
    return [this.minX + (cx + 0.5) * this.cell, this.minY + (cy + 0.5) * this.cell];
  }
  inside(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h; }
  walkableAt(x, y) {
    const [cx, cy] = this.toCell(x, y);
    return this.inside(cx, cy) && this.walk[this.idx(cx, cy)] === 1;
  }
}

export function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 걸을 수 있음 = (부지 안 ∧ 식재지 밖) ∨ 통로 위, 그리고 **항상** 단단한 장애물(부스·무대·건물) 밖.
 *  식재지(soft)만 통로에 진다 — 철쭉밭 사이 산책로가 그것이다. 부스 몸체는 통로 위에 있어도 못 지나간다
 *  (레드팀 2026-09-05: 통로가 장애물을 이기게 두면 도로 위 부스 78개가 유령이 된다). */
export function rasterize(grid, sites, obstacles, corridors = [], soft = []) {
  const siteList = Array.isArray(sites) ? sites.filter(Boolean) : sites ? [sites] : [];
  const inAny = (polys, x, y) => { for (const o of polys) if (pointInPoly(o, x, y)) return true; return false; };
  for (let cy = 0; cy < grid.h; cy++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const [x, y] = grid.toWorld(cx, cy);
      let ok = siteList.length === 0 ? true : siteList.some((p) => pointInPoly(p, x, y));
      if (ok && inAny(soft, x, y)) ok = false;
      if (!ok) {
        for (const c of corridors) {
          for (let i = 0; i + 1 < c.points.length; i++) {
            const [ax, ay] = c.points[i], [bx, by] = c.points[i + 1];
            if (distToSegment(x, y, ax, ay, bx, by) <= c.width / 2) { ok = true; break; }
          }
          if (ok) break;
        }
      }
      if (ok && inAny(obstacles, x, y)) ok = false;
      grid.walk[grid.idx(cx, cy)] = ok ? 1 : 0;
    }
  }
}

/** 목적지 다각형까지의 격자 거리장(다익스트라, 8방향). Float32, 못 가면 Infinity */
export function flowField(grid, targetPoly) {
  const dist = new Float64Array(grid.w * grid.h).fill(Infinity); // Float32 면 반올림 탓에 팝한 값이 저장값보다 커져 셀이 확장되지 않는다
  // 이진 힙 대신 버킷 큐 — 셀 비용이 1·√2 두 가지라 충분히 빠르다
  const open = [];
  // 목적지 다각형의 bbox 안 셀만 훑는다 — 격자 전체를 훑으면 목적지 100개 × 70만 셀이 된다
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y] of targetPoly) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const [cx0, cy0] = grid.toCell(bx0, by0), [cx1, cy1] = grid.toCell(bx1, by1);
  for (let cy = Math.max(0, cy0); cy <= Math.min(grid.h - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(grid.w - 1, cx1); cx++) {
    const [x, y] = grid.toWorld(cx, cy);
    if (pointInPoly(targetPoly, x, y)) { dist[grid.idx(cx, cy)] = 0; open.push(cx, cy); }
  }
  if (open.length === 0) {
    // 목적지 다각형이 격자보다 작으면 중심 셀 하나라도 잡는다
    let sx = 0, sy = 0; for (const [x, y] of targetPoly) { sx += x; sy += y; }
    const [cx, cy] = grid.toCell(sx / targetPoly.length, sy / targetPoly.length);
    if (grid.inside(cx, cy)) { dist[grid.idx(cx, cy)] = 0; open.push(cx, cy); }
  }
  const N = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
  // 단순 우선순위 큐(배열 기반 이진 힙)
  const heap = []; const push = (d, cx, cy) => { heap.push([d, cx, cy]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let i = 0; i < open.length; i += 2) push(0, open[i], open[i + 1]);
  while (heap.length) {
    const [d, cx, cy] = pop();
    if (d > dist[grid.idx(cx, cy)]) continue;
    for (const [dx, dy, c] of N) {
      const nx = cx + dx, ny = cy + dy;
      if (!grid.inside(nx, ny) || grid.walk[grid.idx(nx, ny)] !== 1) continue;
      // 대각선은 모서리 끼기 방지 — 양옆이 막혀 있으면 못 간다
      if (dx && dy && (grid.walk[grid.idx(cx + dx, cy)] !== 1 || grid.walk[grid.idx(cx, cy + dy)] !== 1)) continue;
      const nd = d + c;
      if (nd < dist[grid.idx(nx, ny)]) { dist[grid.idx(nx, ny)] = nd; push(nd, nx, ny); }
    }
  }
  return Float32Array.from(dist); // 저장은 Float32 — 비교는 Float64 에서 끝났으니 반올림이 확장을 막지 않는다
}

/** 거리장의 내리막 방향(단위벡터). 8이웃 중 가장 낮은 셀로 */
function descend(grid, field, x, y) {
  const [cx, cy] = grid.toCell(x, y);
  let best = Infinity, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (!grid.inside(nx, ny)) continue;
    const v = field[grid.idx(nx, ny)];
    if (v < best) { best = v; bx = dx; by = dy; }
  }
  if (best === Infinity) return [0, 0];
  const [tx, ty] = grid.toWorld(cx + bx, cy + by);
  const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// ── 공간 해시 ──────────────────────────────────────────────────────
class SpatialHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(x, y) { return (Math.floor(x / this.cell) * 73856093) ^ (Math.floor(y / this.cell) * 19349663); }
  clear() { this.map.clear(); }
  insert(a) { const k = this.key(a.x, a.y); let b = this.map.get(k); if (!b) { b = []; this.map.set(k, b); } b.push(a); }
  near(x, y, out) {
    out.length = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const b = this.map.get(this.key(x + dx * this.cell, y + dy * this.cell));
      if (b) for (const a of b) out.push(a);
    }
    return out;
  }
}

// ── 시뮬레이션 ────────────────────────────────────────────────────
/**
 * venue = {
 *   site: [[x,y]...],                      // 부지 경계(m). 없으면 격자 전체
 *   obstacles: [[[x,y]...], ...],          // 못 지나가는 것(건물·무대 몸체·부스 몸체)
 *   corridors: [{points:[[x,y]...], width}], // 부지 밖이어도 걸을 수 있는 길
 *   gates: [{id, name, poly, share}],       // 출입구 + 유입 비율(합 1)
 *   attractions: [{id, name, poly, front, popularity, servers, serviceSec, kind}],
 *     // front: 대기 지점 [x,y] (부스 앞). servers: 동시 응대 수. serviceSec: 1인 처리 시간
 * }
 * scenario = {
 *   inflowPerHour: [h0,h1,...] (개장 시각부터 시간대별 시간당 유입),
 *   visitsPerPerson: 평균 방문 부스 수, dwellSecMean: 관람(비대기) 체류,
 *   seed
 * }
 */
export class Simulation {
  constructor(venue, scenario, opts = {}) {
    this.venue = venue;
    this.scenario = scenario;
    this.cell = opts.cell ?? 0.5; // 큰 부지는 생성자에서 자동으로 키운다(아래)
    this.dt = opts.dt ?? 0.1;
    this.time = 0;
    this.agents = [];
    this.nextId = 1;
    this.rng = mulberry32(scenario.seed ?? 1);
    // 격자
    const sites = venue.sites ?? (venue.site ? [venue.site] : []);
    const pts = [...sites.flat(), ...venue.obstacles.flat(), ...venue.gates.flatMap(g => g.poly), ...venue.attractions.flatMap(a => a.poly), ...(venue.corridors ?? []).flatMap(c => c.points)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const pad = 4;
    // 격자가 30만 셀을 넘으면 셀을 키운다 — 거리장 100개를 몇 초 안에 만들어야 한다
    const area = (maxX - minX + 2 * pad) * (maxY - minY + 2 * pad);
    if (!opts.cell) { while (area / (this.cell * this.cell) > 300000 && this.cell < 1.5) this.cell += 0.25; }
    this.grid = new Grid(minX - pad, minY - pad, maxX + pad, maxY + pad, this.cell);
    rasterize(this.grid, sites, venue.obstacles, venue.corridors ?? [], venue.soft ?? []);
    // 한 점이 대표하는 사람 수 — 큰 시나리오는 점 하나가 k명이다(밀도는 k배로 센다). 화면이 밝힌다
    this.k = Math.max(1, scenario.personsPerAgent ?? 1);
    // 흐름장 — 목적지마다 하나. 부스는 몸체가 장애물이므로 앞 지점(front) 주변 작은 사각형을 목표로
    this.fields = new Map();
    for (const g of venue.gates) this.fields.set(g.id, flowField(this.grid, g.poly));
    for (const a of venue.attractions) this.fields.set(a.id, flowField(this.grid, a.kind === "view" || !a.front ? a.poly : squareAround(a.front, 1.2)));
    // 벽 거리장 — 벽 반발용 (장애물/부지 밖까지의 거리, 셀 단위 BFS 근사)
    this.wallDist = wallDistance(this.grid);
    // 대기열 상태
    this.queues = new Map(venue.attractions.map(a => [a.id, { waiting: [], serving: [], servedTotal: 0, maxWait: 0, sumWait: 0, balked: 0 }]));
    this.hash = new SpatialHash(2.0);
    // 밀도 격자(2m) — 시간 통계
    this.dCell = 2.0;
    this.dW = Math.ceil((this.grid.w * this.cell) / this.dCell);
    this.dH = Math.ceil((this.grid.h * this.cell) / this.dCell);
    this.density = new Float32Array(this.dW * this.dH);
    this.peakDensity = new Float32Array(this.dW * this.dH);
    this.secAboveD = new Float32Array(this.dW * this.dH);
    this.secAbove5 = new Float32Array(this.dW * this.dH);
    // 밀도 셀마다 걸을 수 있는 면적(㎡) — 도로 가장자리에 걸친 셀을 4㎡ 로 나누면 절반으로 희석된다
    this.dArea = new Float32Array(this.dW * this.dH);
    for (let cy = 0; cy < this.grid.h; cy++) for (let cx = 0; cx < this.grid.w; cx++) {
      if (this.grid.walk[this.grid.idx(cx, cy)] !== 1) continue;
      const [x, y] = this.grid.toWorld(cx, cy);
      const dx = Math.floor((x - this.grid.minX) / this.dCell), dy = Math.floor((y - this.grid.minY) / this.dCell);
      if (dx >= 0 && dy >= 0 && dx < this.dW && dy < this.dH) this.dArea[dy * this.dW + dx] += this.cell * this.cell;
    }
    this.stats = { entered: 0, exited: 0, gateCount: {}, peak: { density: 0, x: 0, y: 0, t: 0 }, timeInSystemSum: 0 };
    this._spawnCarry = 0;
    this._neighbors = [];
  }

  /** 지금 시각의 시간당 유입 */
  inflowNow() {
    const h = Math.floor(this.time / 3600);
    const arr = this.scenario.inflowPerHour;
    return arr[Math.min(h, arr.length - 1)] ?? 0;
  }

  spawn() {
    const per = this.inflowNow() * (this.dt / 3600) * (this.scenario.inflowScale ?? 1) / this.k;
    this._spawnCarry += per;
    while (this._spawnCarry >= 1) {
      this._spawnCarry -= 1;
      const g = pickWeighted(this.venue.gates, x => x.share, this.rng);
      const [x, y] = randomPointIn(g.poly, this.rng, this.grid);
      const nVisits = Math.max(1, Math.round(gauss(this.rng, this.scenario.visitsPerPerson ?? 3, 1)));
      const plan = [];
      const pool = [...this.venue.attractions];
      for (let i = 0; i < nVisits && pool.length; i++) {
        const a = pickWeighted(pool, x => x.popularity ?? 1, this.rng);
        plan.push(a.id); pool.splice(pool.indexOf(a), 1);
      }
      const exitGate = pickWeighted(this.venue.gates, x => x.share, this.rng);
      this.agents.push({
        id: this.nextId++, x, y, vx: 0, vy: 0,
        v0: Math.max(0.6, gauss(this.rng, 1.2, 0.2)), // JuPedSim 기본 1.2, 개인차 σ0.2
        r: 0.2,
        plan, target: plan[0] ?? exitGate.id, exitGate: exitGate.id,
        state: "walk", stateUntil: 0, enteredAt: this.time, queuedAt: 0, gate: g.id,
      });
      this.stats.entered += this.k;
      this.stats.gateCount[g.id] = (this.stats.gateCount[g.id] ?? 0) + this.k;
    }
  }

  step() {
    this.spawn();
    const dt = this.dt;
    const hash = this.hash; hash.clear();
    for (const a of this.agents) hash.insert(a);
    // CFSM 매개변수
    // JuPedSim CFSM 기본값 (Tordeux·Chraibi·Seyfried 2016): a=8, D=0.1, a_w=5, D_w=0.02, T=1, ℓ=0.4
    const T = 1.0;
    // 점 하나가 k명이면 k배 면적을 차지해야 밀도가 맞다 — 접촉 거리를 √k 배로 늘린다
    const lMin = 0.4 * Math.sqrt(this.k);
    const kNeigh = 8.0, dNeigh = 0.1;
    const kWall = 5.0, dWall = 0.05; // D_w 0.02 는 0.5m 격자에선 너무 급해 0.05
    const nb = this._neighbors;
    const attractionsById = this._attrMap ??= new Map(this.venue.attractions.map(a => [a.id, a]));

    for (const a of this.agents) {
      if (a.state === "dwell" || a.state === "serve") {
        if (this.time >= a.stateUntil) this.advance(a, attractionsById);
        a.vx = a.vy = 0; continue;
      }
      if (a.state === "queue") {
        // 줄 선 사람은 제자리. 서비스 시작은 attraction 쪽에서 돌린다
        a.vx = a.vy = 0; continue;
      }
      const field = this.fields.get(a.target);
      if (!field) { a.state = "exit"; continue; }
      const [cx, cy] = this.grid.toCell(a.x, a.y);
      const here = this.grid.inside(cx, cy) ? field[this.grid.idx(cx, cy)] : Infinity;
      // 도착 판정 — 목적지 셀(거리 0~1)에 들어오면. 부스는 줄 블록이 앞을 차지하므로 줄 길이만큼 반경을 넓힌다
      // (안 그러면 그 부스로 오는 사람들이 줄 뒤에서 "거의 도착" 상태로 뭉쳐 교착한다 — 2026-09-05 실측)
      if (here <= 1.5) { this.arrive(a, attractionsById); continue; }
      const tgt = attractionsById.get(a.target);
      if (tgt && tgt.front && tgt.kind !== "view" && tgt.kind !== "stage") {
        const q = this.queues.get(tgt.id);
        const perRow = Math.max(1, Math.floor((tgt.frontage ?? 3) / (0.5 * this.k)));
        const reach = 2.0 + 0.8 * Math.ceil(q.waiting.length / perRow) + 0.5 * (tgt.frontage ?? 3);
        if (Math.hypot(a.x - tgt.front[0], a.y - tgt.front[1]) <= reach) { this.arrive(a, attractionsById); continue; }
      }
      let [ex, ey] = descend(this.grid, field, a.x, a.y);
      if (here === Infinity) { // 못 가는 자리에 갇힘 — 가장 가까운 걸을 수 있는 셀로 밀어낸다
        const p = nearestWalkable(this.grid, a.x, a.y); if (p) { a.x = p[0]; a.y = p[1]; } continue;
      }
      // 이웃 반발 → 최종 방향 → 그 방향 기준 헤드웨이 → 속도 (JuPedSim 순서)
      hash.near(a.x, a.y, nb);
      let rx = 0, ry = 0;
      for (const b of nb) {
        if (b === a) continue;
        const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1e-6;
        if (d > 2.5) continue;
        const w = kNeigh * Math.exp(-(d - lMin) / dNeigh);
        rx += (dx / d) * w; ry += (dy / d) * w;
      }
      // 벽 반발
      const wd = Math.max(0, this.wallDist[this.grid.idx(cx, cy)] * this.cell - this.cell / 2);
      if (wd < 2 * lMin) {
        const [gx, gy] = wallGradient(this.grid, this.wallDist, cx, cy);
        const w = kWall * Math.exp(-(wd - 0.25) / dWall);
        rx += gx * w; ry += gy * w;
      }
      let dxn = ex + rx, dyn = ey + ry; const ln = Math.hypot(dxn, dyn) || 1; dxn /= ln; dyn /= ln;
      // 헤드웨이: 최종 방향 앞 반평면 ∧ 횡편차 ≤ ℓ 인 이웃 중 최근접
      let sMin = Infinity;
      for (const b of nb) {
        if (b === a) continue;
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-6;
        if (d > 2.5) continue;
        const fwd = dx * dxn + dy * dyn, lat = Math.abs(dx * dyn - dy * dxn);
        if (fwd > 0 && lat <= lMin) sMin = Math.min(sMin, d);
      }
      const v = Math.min(a.v0, Math.max(0, (sMin - lMin) / T));
      a.vx = dxn * v; a.vy = dyn * v;
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
      // 겹침 처리 (E2, 2026-09-08). 전에는 "새 자리가 이웃과 0.8ℓ 안이면 안 움직인다"였다.
      // 그러면 이미 겹친 두 사람은 어느 쪽으로도 못 움직여 영구히 굳고, 같은 자리로 오는
      // 사람이 계속 쌓인다 — 한 좌표에 15명이 정확히 겹쳤다(_diag.mjs 실측, 49.5명/㎡ 의 원인).
      // 지금은 둘로 나눈다. ① 가까워지는 이동만 막는다(멀어지는 이동은 언제나 된다)
      // ② 이미 minD 안에 든 이웃에게서 밀려난다(접촉 반발). 좌표가 완전히 같으면 시드 난수로 방향을 정한다.
      // 최소 간격 = ℓ(0.4m·√k) — 몸 지름. 0.8ℓ 이면 11명/㎡ 까지 들어가 물리 상한 7.22 를 넘긴다(overlap_test 9.0 실측)
      const minD = lMin;
      let blocked = false;
      for (const b of nb) {
        if (b === a) continue;
        const dNew = Math.hypot(nx - b.x, ny - b.y);
        if (dNew < minD && dNew < Math.hypot(a.x - b.x, a.y - b.y)) { blocked = true; break; }
      }
      let px = 0, py = 0;
      for (const b of nb) {
        if (b === a) continue;
        let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 1e-6) { const th = this.rng() * Math.PI * 2; dx = Math.cos(th); dy = Math.sin(th); d = 1; }
        const push = (minD - Math.min(d, minD)) * 0.5;
        px += (dx / d) * push; py += (dy / d) * push;
      }
      const pl = Math.hypot(px, py), pMax = 0.5 * minD;
      if (pl > pMax) { px *= pMax / pl; py *= pMax / pl; }
      if (blocked) { a.vx = a.vy = 0; }
      const tx = (blocked ? a.x : nx) + px, ty = (blocked ? a.y : ny) + py;
      if (this.grid.walkableAt(tx, ty)) { a.x = tx; a.y = ty; }
      else if (this.grid.walkableAt(tx, a.y)) { a.x = tx; }
      else if (this.grid.walkableAt(a.x, ty)) { a.y = ty; }
    }
    // 부스 서비스
    for (const at of this.venue.attractions) {
      const q = this.queues.get(at.id);
      q.serving = q.serving.filter(ag => ag.state === "serve" && this.time < ag.stateUntil);
      const servers = at.servers ?? 1;
      while (q.serving.length < servers && q.waiting.length) {
        const ag = q.waiting.shift();
        const wait = this.time - ag.queuedAt; q.maxWait = Math.max(q.maxWait, wait); q.sumWait += wait; q.servedTotal++;
        ag.state = "serve"; ag.stateUntil = this.time + Math.max(5, gauss(this.rng, at.serviceSec ?? 60, (at.serviceSec ?? 60) * 0.3));
        q.serving.push(ag);
      }
      // 줄 배치: 부스 정면을 따라(옆으로) 0.5m×k 간격으로 서고, 정면 폭(3m)을 채우면 도로 쪽으로 0.8m 물러나 다음 줄.
      // 한 줄로 도로를 가로지르게 세우면 그 줄이 도로를 막아 병목을 "만든다"(레드팀 2026-09-05). 실제 운영도 부스 앞 블록이다.
      if (at.front) {
        const back = at.queueDir ?? [0, 1];
        const side = [-back[1], back[0]];
        const step = 0.5 * this.k, rowGap = 0.8, frontage = at.frontage ?? 3;
        const perRow = Math.max(1, Math.floor(frontage / step));
        // 서비스 중인 사람은 정면 폭을 나눠 선다 — 전에는 전부 front 한 점에 겹쳤고, 줄 첫 줄도 그 점에서
        // 시작해 serve+queue 완전 겹침 쌍이 남았다(overlap_test 실측 158쌍, 2026-09-08)
        const place = (ag, nx, ny) => {
          if (this.grid.walkableAt(nx, ny)) { ag.x = nx; ag.y = ny; }
          else { const p = nearestWalkable(this.grid, nx, ny); if (p) { ag.x = p[0]; ag.y = p[1]; } }
        };
        const nS = q.serving.length, gapS = Math.min(1.0, frontage / Math.max(1, nS));
        q.serving.forEach((ag, i) => {
          const lateral = (i - (nS - 1) / 2) * gapS;
          place(ag, at.front[0] + side[0] * lateral, at.front[1] + side[1] * lateral);
        });
        q.waiting.forEach((ag, i) => {
          const row = Math.floor(i / perRow), col = i % perRow;
          const lateral = (col - (perRow - 1) / 2) * step * (row % 2 === 0 ? 1 : -1);
          const along = (row + 1) * rowGap;   // 첫 줄은 서비스 줄 뒤 0.8m 부터
          place(ag, at.front[0] + back[0] * along + side[0] * lateral, at.front[1] + back[1] * along + side[1] * lateral);
        });
      }
    }
    // 퇴장
    const before = this.agents.length;
    this.agents = this.agents.filter(a => a.state !== "gone");
    this.time += dt;
    this.updateDensity();
    return before - this.agents.length;
  }

  arrive(a, attractionsById) {
    if (a.target === a.exitGate && a.plan.length === 0) {
      a.state = "gone"; this.stats.exited += this.k; this.stats.timeInSystemSum += (this.time - a.enteredAt) * this.k; return;
    }
    const at = attractionsById.get(a.target);
    if (!at) { a.state = "gone"; return; }
    if (at.kind === "stage" || at.kind === "view") { // 무대·관람은 줄 없이 머문다 — 관람 구역(다각형) 안에 고르게 흩어져 선다
      a.state = "dwell"; a.stateUntil = this.time + Math.max(30, gauss(this.rng, this.scenario.dwellSecMean ?? 300, 120));
      const area = at.kind === "view" ? at.poly : squareAround(at.front, 6);
      const p = randomPointIn(area, this.rng, this.grid);
      // 예전엔 도착점 주변에 뭉쳐 세워 540㎡ 관람석이 7명/㎡ 로 나왔다 — 그건 관람석이 아니라 모델의 버그였다
      a.x = p[0]; a.y = p[1];
      return;
    }
    const q = this.queues.get(at.id);
    // 줄 정원: 부스 정면 폭 × 앞 6m 블록에 설 수 있는 수. 넘치면 줄을 포기하고 다음 목적지로(현실의 "줄 보고 돌아섬").
    // 정원 없이 두면 줄이 도로를 넘어 식재지 가장자리 한 칸에 쌓여 20명/㎡ 같은 인공 수치가 난다 (레드팀 2026-09-05)
    const step = 0.5 * this.k, perRow = Math.max(1, Math.floor((at.frontage ?? 3) / step));
    const maxRows = Math.floor((at.maxQueueDepthM ?? 6) / 0.8);
    if (q.waiting.length >= perRow * maxRows) { q.balked++; this.advance(a); return; }
    a.state = "queue"; a.queuedAt = this.time; q.waiting.push(a);
  }

  advance(a) {
    a.plan.shift();
    a.target = a.plan[0] ?? a.exitGate;
    a.state = "walk";
  }

  updateDensity() {
    this.density.fill(0);
    for (const a of this.agents) {
      const cx = Math.floor((a.x - this.grid.minX) / this.dCell), cy = Math.floor((a.y - this.grid.minY) / this.dCell);
      if (cx >= 0 && cy >= 0 && cx < this.dW && cy < this.dH) this.density[cy * this.dW + cx] += this.k;
    }
    for (let i = 0; i < this.density.length; i++) {
      const area = Math.max(this.dArea[i], this.cell * this.cell);
      const d = this.density[i] / area; this.density[i] = d;
      if (d > this.peakDensity[i]) this.peakDensity[i] = d;
      if (d >= WATCH_DENSITY) this.secAboveD[i] += this.dt;
      if (d >= LIMIT_DENSITY) this.secAbove5[i] += this.dt;
      if (d > this.stats.peak.density) {
        const cx = i % this.dW, cy = Math.floor(i / this.dW);
        this.stats.peak = { density: d, x: this.grid.minX + (cx + 0.5) * this.dCell, y: this.grid.minY + (cy + 0.5) * this.dCell, t: this.time };
      }
    }
  }

  /** 지금 상태 요약 — 화면과 리포트가 그대로 쓴다 */
  summary() {
    const worst = [];
    for (let i = 0; i < this.peakDensity.length; i++) if (this.secAboveD[i] > 0) {
      const cx = i % this.dW, cy = Math.floor(i / this.dW);
      worst.push({ x: this.grid.minX + (cx + 0.5) * this.dCell, y: this.grid.minY + (cy + 0.5) * this.dCell, peak: this.peakDensity[i], secAboveD: this.secAboveD[i], secAbove5: this.secAbove5[i] });
    }
    worst.sort((p, q) => q.secAboveD - p.secAboveD);
    const queues = this.venue.attractions.map(at => {
      const q = this.queues.get(at.id);
      return { id: at.id, name: at.name, waiting: q.waiting.length * this.k, maxWait: q.maxWait, meanWait: q.servedTotal ? q.sumWait / q.servedTotal : 0, served: q.servedTotal * this.k, balked: q.balked * this.k };
    }).sort((p, q) => q.waiting - p.waiting);
    let limitSec = 0, limitAt = null;
    for (let i = 0; i < this.secAbove5.length; i++) if (this.secAbove5[i] > limitSec) { limitSec = this.secAbove5[i]; const cx = i % this.dW, cy = Math.floor(i / this.dW); limitAt = { x: this.grid.minX + (cx + 0.5) * this.dCell, y: this.grid.minY + (cy + 0.5) * this.dCell }; }
    return {
      /** 5명/㎡ 이상이 가장 오래 유지된 셀과 그 초 — 한계 판정은 이것만 본다 */
      limit: { secAbove5: limitSec, at: limitAt },
      time: this.time, inside: this.agents.length * this.k, agents: this.agents.length, entered: this.stats.entered, exited: this.stats.exited,
      peak: this.stats.peak, hotspots: worst.slice(0, 5), queues,
      meanTimeInSystem: this.stats.exited ? this.stats.timeInSystemSum / this.stats.exited : 0,
      gateCount: this.stats.gateCount,
    };
  }
}

// ── 보조 ───────────────────────────────────────────────────────────
function squareAround([x, y], half) { return [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]]; }

function wallDistance(grid) {
  // 걸을 수 없는 셀로부터의 거리(셀 단위) — 다중 소스 BFS
  const d = new Float32Array(grid.w * grid.h).fill(Infinity);
  const q = [];
  for (let cy = 0; cy < grid.h; cy++) for (let cx = 0; cx < grid.w; cx++) {
    const i = grid.idx(cx, cy);
    if (grid.walk[i] === 0 || cx === 0 || cy === 0 || cx === grid.w - 1 || cy === grid.h - 1) { d[i] = 0; q.push(cx, cy); }
  }
  let head = 0;
  while (head < q.length) {
    const cx = q[head++], cy = q[head++]; const v = d[grid.idx(cx, cy)];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy; if (!grid.inside(nx, ny)) continue;
      const j = grid.idx(nx, ny); if (d[j] > v + 1) { d[j] = v + 1; q.push(nx, ny); }
    }
  }
  return d;
}
function wallGradient(grid, wd, cx, cy) {
  const g = (x, y) => grid.inside(x, y) ? wd[grid.idx(x, y)] : 0;
  const gx = g(cx + 1, cy) - g(cx - 1, cy), gy = g(cx, cy + 1) - g(cx, cy - 1);
  const l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l];
}
function nearestWalkable(grid, x, y) {
  const [cx, cy] = grid.toCell(x, y);
  for (let r = 1; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = cx + dx, ny = cy + dy; if (grid.inside(nx, ny) && grid.walk[grid.idx(nx, ny)] === 1) return grid.toWorld(nx, ny);
  }
  return null;
}
function randomPointIn(poly, rng, grid) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  for (let i = 0; i < 50; i++) {
    const x = minX + rng() * (maxX - minX), y = minY + rng() * (maxY - minY);
    if (pointInPoly(poly, x, y) && grid.walkableAt(x, y)) return [x, y];
  }
  const p = nearestWalkable(grid, (minX + maxX) / 2, (minY + maxY) / 2);
  return p ?? [(minX + maxX) / 2, (minY + maxY) / 2];
}
function pickWeighted(arr, wf, rng) {
  let s = 0; for (const a of arr) s += wf(a);
  let r = rng() * s; for (const a of arr) { r -= wf(a); if (r <= 0) return a; }
  return arr[arr.length - 1];
}
function gauss(rng, mean, sd) { const u = 1 - rng(), v = rng(); return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
