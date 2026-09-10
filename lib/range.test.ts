import { test } from "node:test";
import assert from "node:assert/strict";

import { bandText, nextYearRange, outwardBand } from "@/lib/range";
import { historyOf } from "@/lib/history";
import { type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as unknown as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);
const periods = [
  { year: "2024", start: "20240420", end: "20240428" },
  { year: "2025", start: "20250419", end: "20250427" },
  { year: "2026", start: "20260418", end: "20260426" },
];

test("바깥 반올림 — 1.2 는 1.2 로 남고 1.203 은 1.3 까지 넓어진다", () => {
  assert.deepEqual(outwardBand([1.2, 1.16]), { lo: 1.1, hi: 1.2 });
  assert.deepEqual(outwardBand([1.203, 1.162]), { lo: 1.1, hi: 1.3 });
  assert.deepEqual(outwardBand([1.467, 1.515, 1.519]), { lo: 1.4, hi: 1.6 });
  assert.equal(outwardBand([]), null);
  assert.equal(bandText({ lo: 1.4, hi: 1.6 }), "1.4~1.6배");
  assert.equal(bandText(null), "—");
});

test("군포 3개년 → 평균 1.1~1.3배 · 최대일 1.4~1.6배 · 연도 셋 (완료조건 1)", () => {
  const h = historyOf(rows, periods, "x").years;
  const r = nextYearRange(h, null);
  assert.deepEqual(r.mean, { lo: 1.1, hi: 1.3 });
  assert.deepEqual(r.peak, { lo: 1.4, hi: 1.6 });
  assert.deepEqual(r.years, ["2024", "2025", "2026"]);
  // 신뢰도 라벨은 없다 — 안 잰 적중률에 이름을 붙이지 않는다 (M1)
  assert.ok(!("confidence" in r));
  assert.equal(r.peerMean, null);
});

test("1년이면 그 해 값 하나짜리 구간, 0년이면 또래만", () => {
  const h = historyOf(rows, periods.slice(1, 2), "x").years;
  const peer = { n: 80, label: "인구 20~50만", meanMedian: 1.05, meanP95: 1.8, peakMedian: 1.3, peakP95: 2.5 };
  const one = nextYearRange(h, peer);
  assert.deepEqual(one.years, ["2025"]);
  assert.ok(one.mean && one.mean.lo <= one.mean.hi);
  const only = nextYearRange([], peer);
  assert.equal(only.mean, null);
  assert.deepEqual(only.years, []);
  assert.deepEqual(only.peerMean, { lo: 1.0, hi: 1.8 });
  assert.equal(nextYearRange([], null).peerMean, null);
});
