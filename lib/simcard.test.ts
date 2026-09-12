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

// ── 2026-09-12 M7a — 정적 카드(data/sim/gunpo_base.json)와 설정 상수 ─────────────────────────
import { existsSync, readFileSync } from "node:fs";
import { DENSITY_CAP, SIM_CARD_SETTINGS } from "@/lib/simcard";

const base = JSON.parse(readFileSync("data/sim/gunpo_base.json", "utf8"));

test("정적 카드는 SIM_CARD_SETTINGS 그대로 돌린 것이고 점 하나 = 1명이다", () => {
  assert.deepEqual(base.settings, SIM_CARD_SETTINGS, "카드의 설정이 상수와 다르다 — scripts/sim-precompute.mjs 를 다시 돌려라");
  assert.equal(base.card.k, 1);
  assert.equal(base.card.simSec, SIM_CARD_SETTINGS.minutes * 60);
});

test("정적 카드의 최대 밀도는 물리 상한(7.22명/㎡) 아래다 — 넘으면 배치가 아니라 코드 버그", () => {
  assert.ok(base.card.peak.density <= DENSITY_CAP, `peak ${base.card.peak.density}`);
  for (const h of base.card.hotspots) assert.ok(h.peak <= DENSITY_CAP, `hotspot ${h.where} ${h.peak}`);
  assert.ok(typeof base.card.peak.where === "string" && base.card.peak.where.length > 0);
});

test("서비스의 엔진(lib/sim/sim.js)은 검증 하네스(시뮬_데모/sim.js)와 바이트 동일하다 — 갈리면 Weidmann 검증이 무의미", () => {
  const demo = "../시뮬_데모/sim.js";
  if (!existsSync(demo)) return; // 볼트 밖에서 돌릴 때는 건너뛴다
  assert.equal(readFileSync("lib/sim/sim.js", "utf8"), readFileSync(demo, "utf8"), "두 sim.js 가 다르다");
});
