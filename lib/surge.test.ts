// 산출식 테스트 — 군포철쭉축제 실측(조사/군포_KT실측_2026-09-06)을 재현해야 한다.
//
// 기대값은 추측이 아니라 공사 API 원본(data/kto/fixtures/41410.json, KT 일별)을
// 손 계산한 값이다. 정의를 바꾸면 여기가 먼저 깨져야 한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeSurge, median, type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);

const near = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("군포 2025 (4.19~27): 평균 1.16 · 최대일 1.52 · 베이스라인 72,716", () => {
  const r = computeSurge({ rows, start: "20250419", end: "20250427" });
  assert.ok(r.ok);
  assert.equal(r.baseline, 72716);
  assert.equal(r.peakOut, 110183.5);
  assert.equal(r.peakYmd, "20250426");
  near(r.multMean, 1.162, 0.001, "multMean");
  near(r.multPeak, 1.515, 0.001, "multPeak");
  near(r.peakOverWeekend!, 1.348, 0.001, "peakOverWeekend");
  // 같은 요일(토) 기준 순증. 주말 중앙값 기준(+28,452)보다 엄격하다.
  near(r.deltaPeak!, 23744, 1, "deltaPeak");
  assert.equal(r.deltaPeakYmd, "20250426");
  near(r.visitors!, 110152, 5, "visitors");
  assert.deepEqual(r.coverage, {
    festivalDays: 9,
    festivalDaysPresent: 9,
    windowDays: 56,
    windowDaysPresent: 56,
  });
});

test("군포 2024 (4.20~28): 평균 1.20 · 최대일 1.47", () => {
  const r = computeSurge({ rows, start: "20240420", end: "20240428" });
  assert.ok(r.ok);
  near(r.multMean, 1.203, 0.001, "multMean");
  near(r.multPeak, 1.467, 0.001, "multPeak");
  assert.equal(r.peakYmd, "20240427");
});

test("결정론 — 같은 입력이면 같은 출력, 입력 순서와 무관", () => {
  const a = computeSurge({ rows, start: "20250419", end: "20250427" });
  const shuffled = [...rows].reverse();
  const b = computeSurge({ rows: shuffled, start: "20250419", end: "20250427" });
  assert.deepEqual(a, b);
});

test("평탄한 시계열이면 배수 1.0, 순증 0", () => {
  const flat: DailyRow[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, "");
    flat.push({ ymd: d, loc: 1000, out: 100, frn: 1 });
  }
  const r = computeSurge({ rows: flat, start: "20250201", end: "20250203" });
  assert.ok(r.ok);
  assert.equal(r.multMean, 1);
  assert.equal(r.multPeak, 1);
  assert.equal(r.deltaPeak, 0);
  assert.equal(r.visitors, 0);
});

test("요일 효과는 순증에서 걷히고 배수에는 남는다", () => {
  // 주말 200, 평일 100 인 평소. 축제(토·일)에 주말과 같은 200 이 오면 순증은 0 이어야 한다.
  const rows2: DailyRow[] = [];
  for (let i = 0; i < 120; i++) {
    const t = Date.UTC(2025, 0, 1 + i);
    const dow = new Date(t).getUTCDay();
    const d = new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
    rows2.push({ ymd: d, loc: 1000, out: dow === 0 || dow === 6 ? 200 : 100, frn: 0 });
  }
  const r = computeSurge({ rows: rows2, start: "20250301", end: "20250302" }); // 토·일
  assert.ok(r.ok);
  assert.equal(r.deltaPeak, 0);
  assert.equal(r.visitors, 0);
  assert.ok(r.multPeak > 1, "전 요일 중앙값(100) 대비 배수는 2.0");
  assert.equal(r.multPeak, 2);
});

test("자료가 없으면 ok:false 와 이유", () => {
  const r = computeSurge({ rows, start: "20190101", end: "20190103" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no-festival-days");
  const bad = computeSurge({ rows, start: "20250427", end: "20250419" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "bad-range");
});

test("전후 창이 반도 안 차면 insufficient-window", () => {
  const sparse = rows.filter((r) => r.ymd >= "20250415" && r.ymd <= "20250430");
  const r = computeSurge({ rows: sparse, start: "20250419", end: "20250427" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "insufficient-window");
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
