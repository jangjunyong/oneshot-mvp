// 축제 신호 등급 — 군포 실측 픽스처로 잰다 (2026-09-14 S1 #8 A안)
import { test } from "node:test";
import assert from "node:assert/strict";

import { festivalSignal, signalNote, SIGNAL_THRESHOLDS } from "@/lib/signal";

test("signalNote — 최고일이면 '가장 붐빈 날', 아니면 '상위 N%', 전년 자료가 없으면 그 조각을 빼고, 명절과 겹치면 적고, 명 수는 없다", () => {
  assert.equal(signalNote({ zPeak: 4.5, rank: 1, yoyPeak: 1.42, tier: "뚜렷함", holidays: [] }), "z 4.50 · 1년 중 가장 붐빈 날 · 전년 같은 달 1.42배");
  assert.equal(signalNote({ zPeak: 0.26, rank: 0.57, yoyPeak: null, tier: "구분 안 됨", holidays: [] }), "z 0.26 · 1년 중 상위 43%");
  assert.equal(signalNote({ zPeak: 5, rank: 1, yoyPeak: null, tier: "뚜렷함", holidays: ["추석"] }), "z 5.00 · 1년 중 가장 붐빈 날 · 추석과 겹침");
  assert.doesNotMatch(signalNote({ zPeak: 2, rank: 0.9, yoyPeak: 1.1, tier: "약함", holidays: [] }), /명/);
});
import { type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as unknown as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);

test("군포철쭉축제 2024·2025·2026 은 뚜렷함 — 1년 중 가장 붐빈 날, 로버스트 z 3.0(μ+3σ) 이상", () => {
  for (const [s, e] of [["20240420", "20240428"], ["20250419", "20250427"], ["20260418", "20260426"]]) {
    const sig = festivalSignal(rows, s, e);
    assert.ok(sig, s);
    assert.equal(sig.tier, "뚜렷함", `${s}: z ${sig.zPeak.toFixed(2)} rank ${sig.rank.toFixed(2)}`);
    assert.ok(sig.yoyPeak !== null && sig.yoyPeak > 1.3, `${s}: 전년 같은 달 대비 ${sig.yoyPeak}`);
  }
});

test("축제가 없던 군포 2025-11-03~07 · 12-01~05 는 구분 안 됨", () => {
  for (const [s, e] of [["20251103", "20251107"], ["20251201", "20251205"]]) {
    const sig = festivalSignal(rows, s, e);
    assert.ok(sig, s);
    assert.equal(sig.tier, "구분 안 됨", `${s}: z ${sig.zPeak.toFixed(2)} rank ${sig.rank.toFixed(2)}`);
  }
});

test("명절 달력 — 군포 4월 회차는 보정해도 뚜렷함 그대로, 추석과 겹친 기간은 holidays 에 추석이 남고 평소에서 연휴가 빠진다", async () => {
  const { SIGNAL_CALENDAR } = await import("@/lib/calendar");
  for (const [s, e] of [["20240420", "20240428"], ["20250419", "20250427"], ["20260418", "20260426"]]) {
    const sig = festivalSignal(rows, s, e, SIGNAL_CALENDAR);
    assert.ok(sig);
    assert.equal(sig.tier, "뚜렷함", s);
    assert.deepEqual(sig.holidays, [], `${s}: 4월에 설·추석 겹침이 붙었다`);
  }
  const chuseok = festivalSignal(rows, "20251004", "20251009", SIGNAL_CALENDAR);
  assert.ok(chuseok);
  assert.deepEqual(chuseok.holidays, ["추석"]);
  // 추석 직후 기간: 보정하면 전 4주 창에서 연휴가 빠져 평소 중앙값이 달라진다(같지 않으면 창에 명절이 섞여 있었다는 뜻)
  const after = festivalSignal(rows, "20251013", "20251017");
  const afterCal = festivalSignal(rows, "20251013", "20251017", SIGNAL_CALENDAR);
  assert.ok(after && afterCal);
  assert.notEqual(after.zPeak, afterCal.zPeak, "추석 연휴가 평소 창에서 빠지지 않았다");
});

test("결정론 · 창이 한쪽만 차면 null · 문턱은 한 곳에서만", () => {
  assert.deepEqual(festivalSignal(rows, "20250419", "20250427"), festivalSignal([...rows].reverse(), "20250419", "20250427"));
  assert.equal(festivalSignal(rows.filter((r) => r.ymd <= "20250430"), "20250419", "20250427"), null);
  assert.equal(festivalSignal(rows, "20250427", "20250419"), null);
  assert.ok(SIGNAL_THRESHOLDS.clear.rank > SIGNAL_THRESHOLDS.flat.rank && SIGNAL_THRESHOLDS.clear.z > SIGNAL_THRESHOLDS.flat.z);
});
