// 1인당 예산 대조 (verdict 2026-09-09 §4 M3) — 새 자료 0, 새 라벨 0.
//
// 기획안 예산을 담당자의 예상 방문객으로 나눈 값과, 같은 단위의 작년 실측 순증으로 나눈 값을
// 나란히 낸다. 1인당 예산의 오차는 예상 방문객의 오차 그대로이므로 라벨은 방문객 판정을 물려받는다.
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkBudget, formatWon } from "@/lib/budget";
import { checkVisitors, KT_API, type Label } from "@/lib/verdict";
import { historyOf } from "@/lib/history";
import { type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as unknown as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);
const history = historyOf(
  rows,
  [
    { year: "2024", start: "20240420", end: "20240428" },
    { year: "2025", start: "20250419", end: "20250427" },
    { year: "2026", start: "20260418", end: "20260426" },
  ],
  "2026-09-09",
).years;

test("군포 양성: 10억 ÷ 217,502 와 10억 ÷ 2026 최대일 순증 28,215 가 나란히, 라벨은 방문객 판정 그대로", () => {
  const v = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  const b = checkBudget(100000, v);
  assert.ok(b);
  assert.equal(b.verdict.item, "budget");
  assert.equal(b.verdict.label, v.verdict.label);
  const by = new Map(b.evidence.map((m) => [m.key, m]));
  const budget = by.get("budget")!;
  assert.equal(budget.unit, "원");
  assert.equal(budget.origin, "input");
  assert.equal(budget.value, 1_000_000_000);
  const perClaim = by.get("perClaim")!;
  assert.equal(perClaim.origin, "input");
  assert.equal(perClaim.unit, "원");
  assert.ok(Math.abs(perClaim.value - 1_000_000_000 / 217502) < 0.01);
  const perMeasured = by.get("perMeasured")!;
  // 분자는 담당자(또는 견본 가정) 예산이고 분모만 공사 실측이다. "measured" 로 찍으면 출처 세탁이다
  assert.equal(perMeasured.origin, "derived");
  assert.ok(perMeasured.api.includes(KT_API) && perMeasured.api.includes("÷"), perMeasured.api);
  assert.ok(perMeasured.period && perMeasured.date, "출처 4속성");
  assert.ok(Math.abs(perMeasured.value - 1_000_000_000 / 28215) < 2, String(perMeasured.value));
  assert.equal(b.verdict.slots.perMeasured, "perMeasured");
  // 실측 분모는 방문객 판정 2단계의 분모(같은 단위)와 같은 셀이다
  assert.equal(b.verdict.denominatorKey, "peakIncrement");
});

test("기간 총계 단위면 분모는 축제 기간 순증 연인원", () => {
  const v = checkVisitors({ n: 620000, basis: "period", counting: "personDays" }, history);
  const b = checkBudget(100000, v)!;
  assert.equal(b.verdict.denominatorKey, "periodVisitors");
  assert.ok(b.evidence.some((m) => m.key === "perMeasured"));
});

test("예산이 없으면 null — 카드가 안 뜬다", () => {
  const v = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  assert.equal(checkBudget(null, v), null);
  assert.equal(checkBudget(0, v), null);
});

test("단위 미상·이력 없음이면 라벨을 물려받고 실측 셀은 없다", () => {
  const 미상 = checkBudget(100000, checkVisitors({ n: 217502, basis: null, counting: null }, history))!;
  assert.equal(미상.verdict.label, "단위 미상");
  assert.ok(!미상.evidence.some((m) => m.key === "perMeasured"));
  assert.ok(미상.evidence.some((m) => m.key === "perClaim"));
  const 첫회 = checkBudget(100000, checkVisitors({ n: 30000, basis: "peakDay", counting: "unique" }, []))!;
  assert.equal(첫회.verdict.label, "근거 없음");
  assert.ok(!첫회.evidence.some((m) => m.key === "perMeasured"));
});

test("예산 문구는 '분모가 같다'고 말하지 않는다 — 라벨은 같은 입력 N 에서 나온다", () => {
  const v = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  const b = checkBudget(100000, v)!;
  assert.ok(!b.verdict.note.includes("분모가 같"), b.verdict.note);
  assert.ok(b.verdict.note.includes("2단계"), b.verdict.note);
});

test("예산 판정에는 명·원 스칼라가 없다 — 비·라벨·키뿐", () => {
  const v = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  const b = checkBudget(100000, v)!;
  const text = JSON.stringify(b.verdict);
  assert.ok(!text.includes("217502") && !text.includes("1000000000") && !text.includes("100000"), text);
  assert.equal(typeof b.verdict.ratio, "number");
});

test("원 표기: 억·만 원·원", () => {
  assert.equal(formatWon(1_000_000_000), "10억 원");
  assert.equal(formatWon(1_250_000_000), "12.5억 원");
  assert.equal(formatWon(35_000_000), "3,500만 원");
  assert.equal(formatWon(4598.3), "4,598원");
  assert.equal(formatWon(35442), "35,442원");
});

test("R7 기준선: Label 유니온은 7종이고 M3 는 원소를 더하지 않는다", () => {
  const all: Record<Label, 1> = { 통과: 1, 주의: 1, 과대: 1, 과소: 1, "상한 초과": 1, "근거 없음": 1, "단위 미상": 1 };
  assert.equal(Object.keys(all).length, 7);
});
