// 부스 응대 교대에서 두 사람이 한 점에 겹치지 않는다 (2026-09-14 "94.91분 7.33명/㎡ · 최소 간격 0.000m" 두 번째 원인)
//
// 실측(시뮬_데모/_diag_overlap.mjs, 군포·기본 유입·점=1명): 0.05m 안 쌍 첫 6건이 전부 같은 모양 — 응대가 끝난 사람이
// walk 로 바뀐 그 스텝에 줄 맨 앞 사람이 serve 로 올라와 방금 떠난 사람의 자리(좌표 소수 셋째 자리까지 같음)에 놓였다.
import { test } from "node:test";
import assert from "node:assert/strict";

import { Simulation } from "@/lib/sim/sim.js";

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function venue() {
  const booth = rect(30, 14, 33, 17);
  return {
    sites: [rect(0, 0, 40, 20)],
    obstacles: [booth],
    soft: [],
    corridors: [],
    gates: [{ id: "g", name: "출입구", poly: rect(0, 8, 2, 12), share: 1 }],
    attractions: [{ id: "b", name: "부스", kind: "booth", poly: booth, front: [31.5, 13] as [number, number], queueDir: [0, -1] as [number, number], popularity: 1, servers: 2, serviceSec: 8 }],
  };
}

test("응대가 끝난 사람과 새로 응대받는 사람이 같은 스텝에 한 점(0.05m 안)에 서지 않는다", () => {
  const sim = new Simulation(venue(), { inflowPerHour: [1800], inflowScale: 1, personsPerAgent: 1, visitsPerPerson: 1, dwellSecMean: 60, seed: 3 });
  let worst = Infinity, at = -1, handovers = 0;
  for (let s = 0; s < 3000; s++) {
    const before = new Set(sim.agents.filter((a) => a.state === "serve"));
    sim.step();
    for (const a of sim.agents) if (before.has(a) && a.state !== "serve") handovers++;
    const ag = sim.agents;
    for (let i = 0; i < ag.length; i++) for (let j = i + 1; j < ag.length; j++) {
      const d = Math.hypot(ag[i].x - ag[j].x, ag[i].y - ag[j].y);
      if (d < worst) { worst = d; at = s; }
    }
  }
  assert.ok(handovers > 5, `교대가 일어나야 시험이 된다: ${handovers}`);
  assert.ok(worst >= 0.05, `최소 간격 ${worst.toFixed(4)}m (step ${at})`);
});

// 실측(_diag_overlap.mjs, 교대 수정 뒤 85.70분): 관람석에 도착한 사람을 구역 안 무작위 점에 세웠더니 이미 서 있던 사람과 3.6cm.
// 체류 중엔 움직이지 않으니 그 겹침이 관람 시간 내내 남는다.
test("관람 구역에 도착한 사람을 이미 서 있는 사람 위(0.05m 안)에 세우지 않는다", () => {
  const view = rect(20, 5, 30, 15);
  const sim = new Simulation({
    sites: [rect(0, 0, 40, 20)], obstacles: [], soft: [], corridors: [],
    gates: [{ id: "g", name: "출입구", poly: rect(0, 8, 2, 12), share: 1 }],
    attractions: [{ id: "v", name: "관람석", kind: "view", poly: view, front: [25, 10] as [number, number], popularity: 1 }],
  }, { inflowPerHour: [3600], inflowScale: 1, personsPerAgent: 1, visitsPerPerson: 1, dwellSecMean: 200, seed: 5 });
  let worst = Infinity, at = -1, maxDwell = 0;
  for (let s = 0; s < 4000; s++) {
    sim.step();
    const dw = sim.agents.filter((a) => a.state === "dwell");
    maxDwell = Math.max(maxDwell, dw.length);
    for (let i = 0; i < dw.length; i++) for (let j = i + 1; j < dw.length; j++) {
      const d = Math.hypot(dw[i].x - dw[j].x, dw[i].y - dw[j].y);
      if (d < worst) { worst = d; at = s; }
    }
  }
  assert.ok(maxDwell > 100, `관람객이 충분히 쌓여야 시험이 된다: ${maxDwell}`);
  assert.ok(worst >= 0.05, `관람객 최소 간격 ${worst.toFixed(4)}m (step ${at})`);
});

// 실측(_diag_density.mjs, 교대 수정 뒤 101.80분 7.50명/㎡): 부스 옆 1m×2m 띠 칸에 15명, 겹침은 없고(최소 0.21m) 5명의 중심이
// 부스 벽선(x=1.000) 위였다 — 몸 반쪽이 부스 안. 이동 허용이 중심점의 walkable 만 보고, 벽 반발은 셀 중심 거리라 1m 격자에선
// 벽에 붙은 셀도 0.5m 로 계산돼 힘이 거의 0 이었다. 몸 중심은 벽에서 반지름(0.2m) 이상 떨어져 있어야 한다.
function wallClearance(sim: Simulation, x: number, y: number) {
  const g = sim.grid;
  const cx = Math.floor((x - g.minX) / g.cell), cy = Math.floor((y - g.minY) / g.cell);
  let best = Infinity;
  for (let yy = cy - 2; yy <= cy + 2; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) {
    const inside = xx >= 0 && yy >= 0 && xx < g.w && yy < g.h;
    if (inside && g.walk[yy * g.w + xx] === 1) continue;
    const x0 = g.minX + xx * g.cell, y0 = g.minY + yy * g.cell;
    const dx = Math.max(x0 - x, 0, x - (x0 + g.cell)), dy = Math.max(y0 - y, 0, y - (y0 + g.cell));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

test("몰려서 좁은 틈(폭 1m)을 지나도 걷는 사람의 몸 중심이 벽에서 몸 반지름(0.2m) 안으로 들어가지 않는다 — 1m 격자", () => {
  const sim = new Simulation({
    sites: [rect(0, 0, 30, 6)], soft: [], corridors: [],
    obstacles: [rect(14, 0, 16, 2), rect(14, 3, 16, 6)],
    gates: [{ id: "g", name: "출입구", poly: rect(1, 1, 3, 5), share: 1 }],
    attractions: [{ id: "v", name: "관람석", kind: "view", poly: rect(22, 1, 29, 5), front: [25, 3] as [number, number], popularity: 1 }],
  }, { inflowPerHour: [7200], inflowScale: 1, personsPerAgent: 1, visitsPerPerson: 1, dwellSecMean: 600, seed: 7 }, { cell: 1 });
  let worst = Infinity, at = -1, passed = 0;
  for (let s = 0; s < 3000; s++) {
    sim.step();
    for (const a of sim.agents) {
      if (a.state !== "walk") continue;
      if (a.x > 16) passed++;
      const c = wallClearance(sim, a.x, a.y);
      if (c < worst) { worst = c; at = s; }
    }
  }
  assert.ok(passed > 0, "틈을 지난 사람이 있어야 시험이 된다");
  assert.ok(worst >= 0.19, `벽까지 최소 ${worst.toFixed(3)}m (step ${at})`);
});
