// −52주 근사 백테스트 (verdict 2026-09-09 §4 M5).
//
// 같은 축제의 다년 표본이 0건이라(619건은 축제당 1행) "전 회차 구간이 올해를 덮는가"를 직접 잴 수 없다.
// 대신 각 축제의 기간을 −364·−728일 옮긴 창을 "근사 전 회차"로 삼는다. 근사다. 표본은 필터를 통과한
// 큰 축제로 쏠린다. 이 파일이 지키는 것은 lib/eval.test.ts 와 같다 — 화면·문서에 적힌 숫자가 데이터에서
// 다시 나오는가. 어긋나면 npm test 가 깨진다 (M5-6).
import { test } from "node:test";
import assert from "node:assert/strict";

import { backtestRange, backtestSentence, RANGE_BACKTEST_PUBLISHED, MIN_SAMPLE_FOR_PERCENT } from "@/lib/backtest";

const r = backtestRange();

test("게시 상수는 데이터에서 다시 나온다 — 표본 수·덮은 비율", () => {
  const p = RANGE_BACKTEST_PUBLISHED;
  assert.equal(r.total, 619);
  assert.equal(p.total, r.total);
  assert.equal(p.n1.n, r.n1.n, "n=1 표본 수");
  assert.equal(p.n2.n, r.n2.n, "n=2 표본 수");
  assert.equal(p.excluded.noWindow, r.excluded.noWindow);
  assert.equal(p.excluded.only728, r.excluded.only728);
  const 같은가 = (a: number | null, b: number | null, 이름: string) =>
    assert.ok((a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9), `${이름}: 게시 ${b} vs 실측 ${a}`);
  같은가(r.n1.coverPeak, p.n1.coverPeak, "n=1 최대일 덮음");
  같은가(r.n1.coverMean, p.n1.coverMean, "n=1 평균 덮음");
  같은가(r.n2.coverPeak, p.n2.coverPeak, "n=2 최대일 덮음");
  같은가(r.n2.coverMean, p.n2.coverMean, "n=2 평균 덮음");
  같은가(r.groups.passed.meanPop, p.groups.passed.meanPop, "통과군 인구");
  같은가(r.groups.failed.meanPop, p.groups.failed.meanPop, "탈락군 인구");
  같은가(r.groups.passed.meanPeak, p.groups.passed.meanPeak, "통과군 배수");
  같은가(r.groups.failed.meanPeak, p.groups.failed.meanPeak, "탈락군 배수");
});

test("표본은 619건 전부가 아니다 — 필터가 걸러낸 수가 0이 아니고 합이 맞는다", () => {
  assert.ok(r.excluded.noWindow > 0, "필터 탈락이 0건이면 필터가 안 돈 것이다");
  assert.equal(r.n1.n + r.n2.n + r.excluded.noWindow + r.excluded.only728 + r.excluded.noSurge, r.total);
});

test("모수 없는 백분율은 만들지 않는다 — 30건 미만이면 비율이 null", () => {
  if (r.n2.n < MIN_SAMPLE_FOR_PERCENT) assert.equal(r.n2.coverPeak, null);
  else assert.ok(r.n2.coverPeak !== null && r.n2.coverPeak >= 0 && r.n2.coverPeak <= 1);
  if (r.n1.n < MIN_SAMPLE_FOR_PERCENT) assert.equal(r.n1.coverPeak, null);
  else assert.ok(r.n1.coverPeak !== null && r.n1.coverPeak >= 0 && r.n1.coverPeak <= 1);
});

test("군포 3개년(실제 다년)은 근사 표본과 섞지 않은 별도 행이고, 근사 vs 실측의 차이가 있다", () => {
  const g = r.gunpo;
  assert.equal(g.actualYears.length, 3);
  // 군포는 4월 셋째~넷째 주말에 고정이라 −364일이 곧 작년 실제 기간이다. 차이 0 이 그 사실을 말한다
  assert.ok(Number.isFinite(g.approxMinusActualPeak));
  assert.ok(g.actualCoverPeak === true || g.actualCoverPeak === false);
});

test("화면 문장은 세 요소를 전부 담고 적중률을 표본으로 한정한다 (M5-3 · M5-3b)", () => {
  const s = backtestSentence(RANGE_BACKTEST_PUBLISHED);
  assert.ok(s.includes("−52주 근사"), s);
  assert.match(s, /표본 \d+건/, s);
  assert.ok(s.includes("편향이 양방향이다"), s);
  assert.ok(s.includes("필터가 만드는 상향 편향과 −52주 근사가 만드는 하향 편향은 서로 반대 방향이며, 어느 쪽이 큰지는 재지 않았다"), s);
  assert.ok(s.includes("−52주 근사로 탐지되는 대형 축제 표본에서의"), s);
  // 한정어 없는 "적중률 N%" 는 없다
  assert.ok(!/(^|[^의])적중률 \d/.test(s), s);
});
