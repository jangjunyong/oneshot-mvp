// 경보 등급 판정 테스트.
//
// 여기서 지키는 것은 계산이 아니라 약속이다 — PRD 암묵지 1(숫자를 예언하지
// 않는다)과 3("안전합니다"를 말하지 않는다). 등급 컷이 흔들리는 것보다
// 이 두 줄이 깨지는 게 더 나쁘다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { grade, levelLabel } from "@/lib/grade";
import type { Festival, MatchResult, MatchedFestival } from "@/lib/types";

/** 배수만 다른 가짜 축제. 등급은 actualVisitSurge 만 보므로 나머지는 고정값 */
function 닮은축제(surge: number, i: number): MatchedFestival {
  const festival: Festival = {
    id: `test-${i}`,
    name: `테스트축제${i}`,
    sido: "충남",
    sigungu: "예산군",
    eventStartDate: "20251010",
    eventEndDate: "20251012",
    themeCode: 1,
    accessibility: 2,
    populationManMyeong: 7.9,
    actualVisitSurge: surge,
    lat: 36.68,
    lng: 126.84,
  };
  return { festival, distance: 0.1 + i * 0.01, axes: [], year: "2025" };
}

function 결과(surges: number[]): MatchResult {
  return {
    matched: surges.map(닮은축제),
    searchedScope: "전국 619개 축제",
  };
}

test("중앙 배수 2.0 이상이면 심각", () => {
  const g = grade(결과([3.28, 2.8, 2.4]));
  assert.equal(g.level, "심각");
  assert.equal(g.medianSurge, 2.8);
});

test("중앙 배수 1.5~2.0 이면 주의", () => {
  const g = grade(결과([1.63, 1.63, 1.53]));
  assert.equal(g.level, "주의");
  assert.equal(g.medianSurge, 1.63);
});

test("중앙 배수 1.5 미만이면 근거없음", () => {
  const g = grade(결과([1.2, 1.3, 1.1]));
  assert.equal(g.level, "근거없음");
});

test("닮은 축제가 없으면 비교불가 — 찾아본 범위를 함께 낸다", () => {
  const g = grade(결과([]));
  assert.equal(g.level, "비교불가");
  assert.equal(g.medianSurge, null);
  assert.match(g.headline, /찾아본 범위/);
});

test("짝수 개일 때 위쪽 값을 잡는다 — 경보는 보수적으로", () => {
  // 평균이면 2.0, 위쪽 값이면 2.1. 컷이 2.0 이라 판정이 갈린다
  const g = grade(결과([1.9, 2.1]));
  assert.equal(g.medianSurge, 2.1);
  assert.equal(g.level, "심각");
  assert.match(g.headline, /2곳/);
});

test("등급 문구는 한 곳에서만 나온다 — 화면과 진단서가 같은 말을 한다", () => {
  // 진단 화면과 진단서가 이 문구를 각자 삼항으로 쓰고 있었다.
  // 같은 진단을 다르게 말하는 사고를 이미 중앙값에서 한 번 냈다.
  assert.equal(levelLabel("심각"), "⚠ 경보: 심각");
  assert.equal(levelLabel("주의"), "⚠ 경보: 주의");
  assert.equal(levelLabel("근거없음"), "위험 근거 못 찾음");
  assert.equal(levelLabel("비교불가"), "비교 대상 없음");
});

test("칩용 짧은 문구는 일부러 다르다 — 좁은 칸이라 끊는다", () => {
  assert.equal(levelLabel("심각", true), "경보 심각");
  assert.equal(levelLabel("근거없음", true), "근거 못 찾음");
  // 이것만 길이가 같아 둘이 같다
  assert.equal(levelLabel("비교불가", true), levelLabel("비교불가"));
});

test('등급 문구에도 "안전" 이 없다 (암묵지 3)', () => {
  const 모든문구 = (["심각", "주의", "근거없음", "비교불가"] as const)
    .flatMap((l) => [levelLabel(l), levelLabel(l, true)])
    .join(" ");
  assert.ok(!모든문구.includes("안전"), `"안전" 이 나왔다: ${모든문구}`);
});

test('어떤 등급에서도 "안전" 이라고 말하지 않는다 (암묵지 3)', () => {
  const 모든문구 = [[], [1.1, 1.2, 1.3], [1.6, 1.7, 1.5], [2.4, 2.8, 3.3]]
    .map((s) => grade(결과(s)).headline)
    .join(" ");

  assert.ok(!모든문구.includes("안전"), `"안전" 이 나왔다: ${모든문구}`);
});

test("방문객 수를 만들어내지 않는다 — 숫자는 배수뿐 (암묵지 1)", () => {
  const 모든문구 = [[1.1, 1.2, 1.3], [1.6, 1.7, 1.5], [2.4, 2.8, 3.3]]
    .map((s) => grade(결과(s)).headline)
    .join(" ");

  // "12만 명", "3000명" 같은 인원 표기가 있으면 실패
  assert.ok(
    !/\d[\d,.]*\s*명/.test(모든문구),
    `인원 표기가 나왔다: ${모든문구}`,
  );
  // 배수는 나와야 한다
  assert.match(모든문구, /\d\.\d배/);
});
