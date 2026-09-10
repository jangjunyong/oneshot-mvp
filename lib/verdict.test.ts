// 판정 엔진 회귀 — 기획/08 §4 완료조건 13 (양성·음성) 을 군포 실측 픽스처로 잰다.
//
// 기대값은 손으로 셈한 것이다. 계획서(08 §4 #13)는 2025 를 "작년"으로 놓고 0.92·7.6·1.97 을 적었지만
// 2026 자료가 들어와 2027 기획안의 작년은 2026 이다 — 분모가 2026 값(최대 전체 체류 262,457 ·
// 순증 28,215 · 베이스라인 73,154)으로 바뀌어도 라벨은 그대로다. 그것이 이 회귀가 지키는 것이다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { adviseVisitors, checkVisitors, checkSchedule, explainVisitors, type VisitorVerdict } from "@/lib/verdict";
import { historyOf } from "@/lib/history";
import { type DailyRow } from "@/lib/surge";
import fx from "@/data/kto/fixtures/41410.json";

const rows: DailyRow[] = (fx as unknown as { rows: [string, number, number, number][] }).rows.map(
  ([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }),
);

const GUNPO_PERIODS = [
  { year: "2024", start: "20240420", end: "20240428" },
  { year: "2025", start: "20250419", end: "20250427" },
  { year: "2026", start: "20260418", end: "20260426" },
];
const history = historyOf(rows, GUNPO_PERIODS, "2026-09-09").years;

const near = (a: number | null, b: number, tol: number, msg: string) =>
  assert.ok(a !== null && Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const stage = (v: VisitorVerdict, id: string) => v.stages.find((s) => s.id === id)!;

test("양성: 군포 2025 발표 217,502 (일 최다·연인원) → 성립 불가", () => {
  const { verdict, evidence } = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  assert.equal(verdict.label, "성립 불가");
  near(stage(verdict, "cap").ratio, 0.829, 0.005, "상한비");
  assert.equal(stage(verdict, "cap").result, "성립 불가");
  near(stage(verdict, "increment").ratio, 7.71, 0.05, "증분비");
  assert.equal(stage(verdict, "increment").result, "주의 신호");
  near(verdict.requiredMult, 2.97, 0.01, "요구 배수");
  near(verdict.historyMult, 1.519, 0.001, "이력 최대일 배수 최댓값");
  near(verdict.r, 1.96, 0.01, "r");
  assert.equal(stage(verdict, "multiple").result, "과대");
  assert.equal(verdict.confidence, "high");
  assert.deepEqual(verdict.historyYears, ["2024", "2025", "2026"]);
  // 연인원 ÷ KT 실인원인데 보정이 없다는 사실을 단서로 적는다 (2026-09-10 critic). M6 이 회전율로 바꾼다
  assert.ok(verdict.caveats.some((c) => c.includes("연인원") && c.includes("보정")), verdict.caveats.join(" | "));
  // 근거 셀은 전부 출처 4필드를 갖는다
  for (const m of evidence.filter((m) => m.origin === "measured")) {
    assert.ok(m.api && m.period && m.date, `${m.key} 출처 누락`);
  }
});

test("음성: 작년 실측 110,184 그대로 → 통과 (결정론)", () => {
  const a = checkVisitors({ n: 110184, basis: "peakDay", counting: "unique" }, history);
  const b = checkVisitors({ n: 110184, basis: "peakDay", counting: "unique" }, history);
  assert.deepEqual(a, b);
  assert.equal(a.verdict.label, "통과");
  near(stage(a.verdict, "cap").ratio, 0.42, 0.01, "상한비");
  near(stage(a.verdict, "increment").ratio, 3.9, 0.02, "증분비");
  assert.equal(stage(a.verdict, "increment").result, "신호 없음");
  near(a.verdict.r, 0.99, 0.01, "r");
  assert.ok(!a.verdict.caveats.some((c) => c.includes("연인원") && c.includes("보정")), "실인원 입력에 연인원 단서가 붙었다");
});

test("기간 총계 62만 (2026 발표) → 분모가 기간 전체 체류·베이스라인×일수로 바뀐다", () => {
  const { verdict } = checkVisitors({ n: 620000, basis: "period", counting: "personDays" }, history);
  // 2,147,879 의 29% → 상한 통과. 베이스라인 73,153×9 = 658,381 → 요구 배수 0.94 vs 이력 평균 최대 1.206 → r 0.78 통과
  assert.equal(stage(verdict, "cap").result, "통과");
  near(verdict.requiredMult, 0.94, 0.01, "요구 배수(기간)");
  near(verdict.r, 0.78, 0.01, "r");
  // 순증: 62만 ÷ 축제 연인원 산출 130,350 = 4.76 ≥ 3.0 → 주의 신호 → 최종은 통과에서 주의로 한 단계
  assert.equal(stage(verdict, "increment").result, "주의 신호");
  assert.equal(verdict.label, "주의");
});

test("단위를 안 고르면 판정하지 않는다", () => {
  const { verdict } = checkVisitors({ n: 217502, basis: null, counting: "personDays" }, history);
  assert.equal(verdict.label, "단위 미상");
  assert.equal(verdict.stages.length, 0);
});

test("이력이 없으면 1·2단계 계산 불가, 또래만 있으면 신뢰도 low", () => {
  const none = checkVisitors({ n: 1000, basis: "peakDay", counting: "unique" }, []);
  assert.equal(none.verdict.label, "근거 없음");
  const peer = checkVisitors({ n: 1000, basis: "peakDay", counting: "unique" }, [], {
    n: 80,
    peakP95: 2.5,
    meanP95: 1.8,
    peakMedian: 1.3,
    meanMedian: 1.05,
    label: "인구 20~50만",
  });
  assert.equal(peer.verdict.confidence, "low");
  assert.equal(stage(peer.verdict, "cap").result, "계산 불가");
});

test("과소: 이력의 절반이면 과소", () => {
  const { verdict } = checkVisitors({ n: 50000, basis: "peakDay", counting: "unique" }, history);
  assert.equal(verdict.label, "과소");
});

test("Verdict 에 명·원 스칼라가 없다 — 숫자 필드는 비·배수뿐", () => {
  const { verdict } = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  const numericKeys = Object.entries(verdict)
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => k);
  assert.deepEqual(numericKeys.sort(), ["historyMult", "r", "requiredMult"]);
  const text = JSON.stringify(verdict);
  assert.ok(!text.includes("217502"), "입력 명 수가 verdict 에 섞였다");
});

test("설명 문장은 숫자를 슬롯으로 남긴다", () => {
  const { verdict } = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history);
  const seg = explainVisitors(verdict);
  const text = seg.map((s) => ("t" in s ? s.t : "")).join("");
  assert.ok(!/\d[\d,]*\s*명/.test(text), "문장 조각에 명 수가 들어 있다");
  assert.ok(seg.some((s) => "num" in s && s.num === "claim"));
  assert.ok(text.includes("성립 불가"));
});

test("일정: 군포 2027 (4.17 토~4.25 일) 은 통과, 평일만이면 과대", () => {
  const ok = checkSchedule({ start: "20270417", end: "20270425" }, history);
  assert.equal(ok.label, "통과");
  assert.deepEqual(ok.historyPeakWeekdays, [6, 6, 6]);
  const weekdayOnly = checkSchedule({ start: "20270419", end: "20270423" }, history);
  assert.equal(weekdayOnly.label, "과대");
  const none = checkSchedule({ start: "20270419", end: "20270423" }, []);
  assert.equal(none.label, "근거 없음");
});

test("보완 문장 — 라벨마다 있고, 명 수가 없고, 안전하다는 말이 없다", () => {
  const cases = [
    checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, history),
    checkVisitors({ n: 110184, basis: "peakDay", counting: "unique" }, history),
    checkVisitors({ n: 620000, basis: "period", counting: "personDays" }, history),
    checkVisitors({ n: 50000, basis: "peakDay", counting: "unique" }, history),
    checkVisitors({ n: 1000, basis: null, counting: null }, history),
    checkVisitors({ n: 1000, basis: "peakDay", counting: "unique" }, []),
  ];
  const labels = new Set(cases.map((c) => c.verdict.label));
  assert.ok(labels.size >= 5, [...labels].join());
  for (const c of cases) {
    const seg = adviseVisitors(c.verdict);
    const text = seg.map((s) => ("t" in s ? s.t : "")).join("");
    assert.ok(text.length > 30, c.verdict.label);
    assert.ok(!/\d[\d,]*\s*명/.test(text), `${c.verdict.label}: 명 수`);
    assert.ok(!/안전합니다|안전하다\./.test(text), `${c.verdict.label}: 안전 단언`);
  }
});
