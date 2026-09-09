import { test } from "node:test";
import assert from "node:assert/strict";

import { simCardFrom, simCardHeadline } from "@/lib/simcard";
import type { Summary } from "@/lib/sim/sim.js";

const sum: Summary = {
  time: 1800, inside: 100, entered: 900, exited: 800,
  peak: { density: 4.1, x: 10, y: 20, t: 900 },
  hotspots: [
    { x: 1, y: 1, peak: 3.2, secAboveD: 40 },
    { x: 10, y: 20, peak: 4.1, secAboveD: 120 },
    { x: 5, y: 5, peak: 3.5, secAboveD: 80 },
    { x: 7, y: 7, peak: 3.1, secAboveD: 10 },
  ] as Summary["hotspots"],
  queues: [], gateCount: {},
  limit: { secAbove5: 0, at: null },
};
const nameOf = (x: number, y: number) => `B${x}-${y}`;

test("요약 카드 — 지속 시간 순 상위 3, 이름 붙임, 가정 동반, 명 수 없음", () => {
  const c = simCardFrom(sum, nameOf, { inflowPerHour: "3000,6000", scale: 1.5, k: 3, at: "2026-09-09T00:00:00Z" })!;
  assert.equal(c.peak.where, "B10-20");
  assert.deepEqual(c.hotspots.map((h) => h.where), ["B10-20", "B5-5", "B1-1"]);
  assert.equal(c.scale, 1.5);
  assert.equal(c.limitWhere, null);
  assert.ok(!/명(?!\/)/.test(JSON.stringify(c)), "명 수가 들어 있다");
  assert.equal(simCardFrom({ ...sum, time: 0 }, nameOf, { inflowPerHour: "", scale: 1, k: 1 }), null);
});

test("한 줄 — 위험 지속 / 주의 지속 / 없음 / 상한 초과", () => {
  const base = simCardFrom(sum, nameOf, { inflowPerHour: "", scale: 1, k: 1 })!;
  assert.match(simCardHeadline(base), /3곳 있습니다/);
  assert.match(simCardHeadline({ ...base, secAbove5: 90, limitWhere: "B1-1" }), /90초 이어진 자리가 있습니다: B1-1/);
  assert.match(simCardHeadline({ ...base, hotspots: [] }), /없었습니다.*안전하다는 뜻이 아닙니다/);
  assert.match(simCardHeadline({ ...base, peak: { density: 9, where: "x" } }), /신뢰할 수 없습니다/);
  assert.match(simCardHeadline({ ...base, k: 3, peak: { density: 9, where: "x" } }), /점 하나를 3명으로 두면 밀도가 부풀 수 있으니/);
  for (const t of [simCardHeadline(base), simCardHeadline({ ...base, hotspots: [] })]) assert.doesNotMatch(t, /\d[\d,]*\s*명(?!\/)/);
});
