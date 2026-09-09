// 도면(GeoJSON) 편집의 순수 함수들 — 화면(app/venue/sim-map.tsx)이 부른다.
//
// 좌표는 위경도지만 옮기기·돌리기·맞히기는 m 평면에서 한다(lib/sim/geo.js 와 같은
// 등장방형 투영). 모든 함수는 새 FeatureCollection 을 돌려주고 입력을 바꾸지 않는다 —
// 되돌리기(undo)가 그 위에서 선다.

import { makeProjection, type Projection } from "@/lib/sim/geo.js";

export type FC = GeoJSON.FeatureCollection & {
  origin?: [number, number];
  zoom?: number;
  name?: string;
  source?: string;
};
export type Feature = GeoJSON.Feature;

/** 편집할 수 있는 종류 — 통로·부지·식재지는 도면의 뼈대라 따로 다룬다 */
export const MOVABLE = new Set(["booth", "gate", "toilet", "stage", "view"]);

export function projectionOf(fc: FC): Projection {
  const o = fc.origin ?? [126.93, 37.36];
  return makeProjection(o[0], o[1]);
}

function ringM(f: Feature, proj: Projection): [number, number][] | null {
  if (f.geometry.type !== "Polygon") return null;
  return f.geometry.coordinates[0].map((c) => proj.toM(c) as [number, number]);
}

function pointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/** 점(m)에 놓인 옮길 수 있는 feature — 나중에 그린 것(배열 뒤)이 위에 있으므로 뒤에서부터 */
export function hitTest(fc: FC, proj: Projection, p: [number, number]): Feature | null {
  for (let i = fc.features.length - 1; i >= 0; i--) {
    const f = fc.features[i];
    if (!MOVABLE.has(String(f.properties?.kind))) continue;
    const ring = ringM(f, proj);
    if (ring && pointInRing(p, ring)) return f;
  }
  return null;
}

export function centroidM(f: Feature, proj: Projection): [number, number] {
  const ring = ringM(f, proj);
  if (!ring) return [0, 0];
  const n = ring.length - 1 || 1; // 닫힌 링의 마지막 점은 첫 점과 같다
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

function mapFeature(fc: FC, id: string, fn: (f: Feature) => Feature): FC {
  return { ...fc, features: fc.features.map((f) => (f.properties?.id === id ? fn(f) : f)) };
}

function withRing(f: Feature, proj: Projection, ring: [number, number][], extra: Record<string, unknown> = {}): Feature {
  return {
    ...f,
    properties: { ...(f.properties ?? {}), ...extra },
    geometry: { type: "Polygon", coordinates: [ring.map((m) => proj.toLngLat(m))] },
  };
}

/** dx, dy (m) 만큼 옮긴다 */
export function translate(fc: FC, proj: Projection, id: string, dx: number, dy: number): FC {
  return mapFeature(fc, id, (f) => {
    const ring = ringM(f, proj);
    if (!ring) return f;
    return withRing(f, proj, ring.map(([x, y]) => [x + dx, y + dy]));
  });
}

/** 중심을 축으로 deg 만큼 돌린다. 줄 방향(queueDir)도 같이 돈다 */
export function rotate(fc: FC, proj: Projection, id: string, deg: number): FC {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return mapFeature(fc, id, (f) => {
    const ring = ringM(f, proj);
    if (!ring) return f;
    const [cx, cy] = centroidM(f, proj);
    const rot = ([x, y]: [number, number]): [number, number] => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
    const qd = f.properties?.queueDir;
    const extra: Record<string, unknown> = {};
    if (Array.isArray(qd) && qd.length === 2) {
      const [qx, qy] = qd as [number, number];
      extra.queueDir = [Math.round((qx * c - qy * s) * 1e4) / 1e4, Math.round((qx * s + qy * c) * 1e4) / 1e4];
    }
    return withRing(f, proj, ring.map(rot), extra);
  });
}

export function remove(fc: FC, id: string): FC {
  return { ...fc, features: fc.features.filter((f) => f.properties?.id !== id) };
}

export function setProps(fc: FC, id: string, props: Record<string, unknown>): FC {
  return mapFeature(fc, id, (f) => ({ ...f, properties: { ...(f.properties ?? {}), ...props } }));
}

/** 비어 있는 다음 부스 id — b1, b2, … 중 가장 큰 번호 + 1 */
export function nextId(fc: FC, prefix: string): string {
  let max = 0;
  for (const f of fc.features) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(String(f.properties?.id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

export interface NewBooth {
  name: string;
  cat: string;
  w?: number;
  h?: number;
  servers?: number;
  serviceSec?: number;
  popularity?: number;
  /** 도(deg). 0 이면 동서로 긴 변 */
  rotation?: number;
}

/** 점(m)을 중심으로 3×3 부스를 놓는다. 줄은 남쪽(-y)으로 선다 — 놓은 뒤 돌리면 같이 돈다 */
export function addBooth(fc: FC, proj: Projection, at: [number, number], b: NewBooth): FC {
  const w = b.w ?? 3, h = b.h ?? 3, id = nextId(fc, "b");
  const a = ((b.rotation ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const corners: [number, number][] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const ring = corners.map(([x, y]): [number, number] => [at[0] + x * c - y * s, at[1] + x * s + y * c]);
  ring.push(ring[0]);
  const f: Feature = {
    type: "Feature",
    properties: {
      kind: "booth", id, name: b.name, cat: b.cat,
      popularity: b.popularity ?? 2, servers: b.servers ?? 2, serviceSec: b.serviceSec ?? 60,
      queueDir: [Math.round(s * 1e4) / 1e4, Math.round(-c * 1e4) / 1e4],
      source: "담당자 배치 (편집기)",
    },
    geometry: { type: "Polygon", coordinates: [ring.map((m) => proj.toLngLat(m))] },
  };
  return { ...fc, features: [...fc.features, f] };
}

/** 꺾은선(m) 통로. 두 점 미만이면 그대로 */
export function addCorridor(fc: FC, proj: Projection, pts: [number, number][], width: number, name = ""): FC {
  if (pts.length < 2) return fc;
  const f: Feature = {
    type: "Feature",
    properties: { kind: "corridor", id: nextId(fc, "c"), width, name, source: "담당자 그림 (편집기)" },
    geometry: { type: "LineString", coordinates: pts.map((m) => proj.toLngLat(m)) },
  };
  return { ...fc, features: [...fc.features, f] };
}

/** 점(m)에서 가장 가까운 통로 — 선분까지의 거리가 폭/2 + 여유 안이면 */
export function hitCorridor(fc: FC, proj: Projection, p: [number, number], slack = 1): Feature | null {
  let best: { f: Feature; d: number } | null = null;
  for (const f of fc.features) {
    if (f.properties?.kind !== "corridor" || f.geometry.type !== "LineString") continue;
    const pts = f.geometry.coordinates.map((c) => proj.toM(c));
    const w = Number(f.properties?.width ?? 4);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-9;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L2));
      const d = Math.hypot(p[0] - ax - vx * t, p[1] - ay - vy * t);
      if (d <= w / 2 + slack && (!best || d < best.d)) best = { f, d };
    }
  }
  return best?.f ?? null;
}

export const distM = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 사각형 부스의 방향(도) — 첫 변의 각도. 같은 줄의 부스는 같은 값이다 */
export function orientationOf(f: Feature, proj: Projection): number {
  const ring = ringM(f, proj);
  if (!ring || ring.length < 2) return 0;
  const [a, b] = ring;
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

/** 점(m)에서 가장 가까운 부스(자기 자신 제외). maxDist 안에 없으면 null */
export function nearestBooth(fc: FC, proj: Projection, p: [number, number], maxDist = 8, exceptId: string | null = null): Feature | null {
  let best: { f: Feature; d: number } | null = null;
  for (const f of fc.features) {
    if (f.properties?.kind !== "booth" || f.properties?.id === exceptId) continue;
    const d = distM(centroidM(f, proj), p);
    if (d <= maxDist && (!best || d < best.d)) best = { f, d };
  }
  return best?.f ?? null;
}

/**
 * 이웃 줄에 맞춘 자리와 각도. 15° 눌러서는 도로 각도(8.6°)에 못 맞춘다는 지적(2026-09-09)에서 나왔다.
 * 이웃 부스의 축(첫 변) 위로 점을 내려 3.5m 피치(부스 3m + 틈 0.5m)로 반올림한다.
 * 옆으로 2.5m 넘게 떨어져 누른 점은 새 줄로 보고 각도만 맞춘다.
 */
/** 점(m)에서 가장 가까운 통로 선분 — 각도(도)·선분 위 발·옆 거리(부호)·폭 */
export function nearestCorridorSegment(fc: FC, proj: Projection, p: [number, number], maxDist = 15): { angle: number; foot: [number, number]; lateral: number; width: number } | null {
  let best: { d: number; angle: number; foot: [number, number]; lateral: number; width: number } | null = null;
  for (const f of fc.features) {
    if (f.properties?.kind !== "corridor" || f.geometry.type !== "LineString") continue;
    const pts = f.geometry.coordinates.map((c) => proj.toM(c));
    const w = Number(f.properties?.width ?? 4);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy) || 1e-9;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / (L * L)));
      const foot: [number, number] = [ax + vx * t, ay + vy * t];
      const d = distM(p, foot);
      if (d <= maxDist && (!best || d < best.d)) {
        const ux = vx / L, uy = vy / L;
        best = { d, angle: (Math.atan2(vy, vx) * 180) / Math.PI, foot, lateral: -(p[0] - foot[0]) * uy + (p[1] - foot[1]) * ux, width: w };
      }
    }
  }
  return best;
}

export interface Snap { at: [number, number]; rotation: number; neighbor: Feature | null; via: "booth" | "corridor" | null }

export function snapToRow(fc: FC, proj: Projection, p: [number, number], pitch = 3.5, exceptId: string | null = null): Snap {
  const nb = nearestBooth(fc, proj, p, 8, exceptId);
  if (!nb) {
    // 첫 부스 — 이웃이 없으면 통로 방향에 맞춘다. 통로 띠 안이나 가장자리 3m 안을 눌렀으면 연석 바깥 0.3m 로 붙인다
    const cs = nearestCorridorSegment(fc, proj, p, 15);
    if (!cs) return { at: p, rotation: 0, neighbor: null, via: null };
    const a = (cs.angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
    const edge = cs.width / 2 + 1.5 + 0.3;
    if (Math.abs(cs.lateral) <= cs.width / 2 + 3) {
      const sgn = cs.lateral >= 0 ? 1 : -1;
      return { at: [cs.foot[0] - uy * sgn * edge, cs.foot[1] + ux * sgn * edge], rotation: cs.angle, neighbor: null, via: "corridor" };
    }
    return { at: p, rotation: cs.angle, neighbor: null, via: "corridor" };
  }
  const rot = orientationOf(nb, proj);
  const a = (rot * Math.PI) / 180, ax = Math.cos(a), ay = Math.sin(a);
  const c = centroidM(nb, proj);
  const dx = p[0] - c[0], dy = p[1] - c[1];
  const along = dx * ax + dy * ay, lateral = -dx * ay + dy * ax;
  const t = Math.round(along / pitch) * pitch;
  if (Math.abs(lateral) > 2.5) return { at: p, rotation: rot, neighbor: nb, via: "booth" };
  return { at: [c[0] + ax * t, c[1] + ay * t], rotation: rot, neighbor: nb, via: "booth" };
}

/** 절대 각도(도)로 돌린다 */
export function rotateTo(fc: FC, proj: Projection, id: string, deg: number): FC {
  const f = fc.features.find((x) => x.properties?.id === id);
  if (!f) return fc;
  return rotate(fc, proj, id, deg - orientationOf(f, proj));
}

/** 가장 가까운 다른 부스와 평행하게 */
export function alignToNeighbor(fc: FC, proj: Projection, id: string): FC {
  const f = fc.features.find((x) => x.properties?.id === id);
  if (!f) return fc;
  const nb = nearestBooth(fc, proj, centroidM(f, proj), 20, id);
  return nb ? rotateTo(fc, proj, id, orientationOf(nb, proj)) : fc;
}

