// 밀도 측정 — 걸을 수 있는 면적이 작은 가장자리 칸이 밀도를 부풀리지 않는다 (2026-09-14 "9.00명/㎡" 원인)
//
// 실측(시뮬_데모/_diag_density.mjs, 군포·기본 유입·점=1명): 94분에 처음 7.22 초과 — 2m 칸 하나의 걸을 수 있는 면적이 1㎡(1m 셀 1개)뿐인
// 산책로 가장자리에서, 서로 0.46m 넘게 떨어진 걷는 사람 8명을 1㎡ 로 나눠 8.00. 사람이 겹친 게 아니라 분모가 작았다.
import { test } from "node:test";
import assert from "node:assert/strict";

import { binDensity } from "@/lib/sim/sim.js";

const PHYS_MAX = 1 / (2 * Math.sqrt(3) * 0.2 * 0.2); // 7.22 — 반지름 0.2m 원판 최밀 충전

function run(counts: number[], areas: number[], dW: number, dH: number) {
  const out = new Float32Array(counts.length);
  binDensity(Float32Array.from(counts), Float32Array.from(areas), dW, dH, 4, 1, out);
  return out;
}

test("가장자리 조각 칸(걸을 수 있는 1㎡)에 8명이 몰려도 이웃 칸 면적과 함께 재어 물리 상한을 넘지 않는다", () => {
  // 3×3, 가운데가 조각 칸. 이웃 8칸은 전부 걸을 수 있는 4㎡ 이고 비어 있다
  const counts = [0, 0, 0, 0, 8, 0, 0, 0, 0];
  const areas = [4, 4, 4, 4, 1, 4, 4, 4, 4];
  const d = run(counts, areas, 3, 3);
  assert.ok(d[4] <= PHYS_MAX, `조각 칸 밀도 ${d[4]}`);
  assert.ok(Math.abs(d[4] - 8 / 33) < 1e-6, `이웃 합산 8÷33㎡ 여야 한다: ${d[4]}`);
});

test("온전한 칸(4㎡)은 자기 면적으로만 잰다 — 도로 안 밀도는 그대로", () => {
  const counts = [0, 0, 0, 0, 20, 0, 0, 0, 0];
  const areas = [4, 4, 4, 4, 4, 4, 4, 4, 4];
  const d = run(counts, areas, 3, 3);
  assert.equal(d[4], 5);
  assert.equal(d[0], 0);
});

test("절반 이상(2㎡) 걸을 수 있는 칸도 자기 면적으로 잰다 — 도로 가장자리를 4㎡ 로 희석하지 않던 원래 규칙 유지", () => {
  const d = run([6, 0, 0, 0], [2, 4, 4, 4], 2, 2);
  assert.equal(d[0], 3);
});

test("지도 모서리 조각 칸도 깨지지 않고, 면적 0 칸도 이웃과 합쳐 사람이 사라지지 않으며, 주변에 아무도 없으면 0 이다", () => {
  const d = run([3, 0, 0, 0], [1, 1, 0, 0], 2, 2);
  for (const v of d) assert.ok(Number.isFinite(v) && v <= PHYS_MAX, String(v));
  assert.equal(d[0], 1.5, "3명 ÷ 이웃 합 2㎡");
  assert.equal(d[2], 1.5, "면적 0 칸도 이웃의 사람을 잰다");
  assert.equal(run([0, 0, 0, 0], [1, 0, 0, 0], 2, 2)[0], 0);
  assert.deepEqual(Array.from(d), Array.from(run([3, 0, 0, 0], [1, 1, 0, 0], 2, 2)), "결정론");
});
