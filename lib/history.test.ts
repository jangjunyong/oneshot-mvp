import { test } from "node:test";
import assert from "node:assert/strict";

import { historyOf, isYmd, ymdCompact, ymdDashed } from "@/lib/history";
import { type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as unknown as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);

test("군포 3개년 — surge.ts 값이 그대로 HistoryYear 로 옮겨진다, 연도 오름차순", () => {
  const h = historyOf(
    rows,
    [
      { year: "2026", start: "20260418", end: "20260426" },
      { year: "2024", start: "20240420", end: "20240428" },
      { year: "2025", start: "20250419", end: "20250427" },
    ],
    "2026-09-09",
  );
  assert.equal(h.skipped.length, 0);
  assert.deepEqual(
    h.years.map((y) => y.year),
    ["2024", "2025", "2026"],
  );
  const y25 = h.years[1];
  assert.equal(y25.baseline, 72716);
  assert.equal(y25.peakOut, 110183.5);
  assert.equal(y25.maxDayTotalYmd, "20250426");
  assert.ok(Math.abs(y25.maxDayTotal - 251136.1) < 0.5);
  assert.equal(y25.festivalDays, 9);
  assert.ok(Math.abs(y25.periodTotal - 2066416.1) < 0.5);
  assert.equal(y25.fetchedAt, "2026-09-09");
});

test("자료 밖 기간은 이유와 함께 빠진다 — 짐작해서 채우지 않는다", () => {
  const h = historyOf(
    rows,
    [
      { year: "2018", start: "20180421", end: "20180429" },
      { year: "2025", start: "20250427", end: "20250419" },
    ],
    "x",
  );
  assert.equal(h.years.length, 0);
  assert.deepEqual(
    h.skipped.map((s) => s.reason),
    ["no-festival-days", "bad-range"],
  );
});

test("날짜 형식", () => {
  assert.equal(ymdCompact("2025-04-19"), "20250419");
  assert.equal(ymdDashed("20250419"), "2025-04-19");
  assert.ok(isYmd("2025-04-19"));
  assert.ok(!isYmd("2025-02-30"));
  assert.ok(!isYmd("abc"));
});
