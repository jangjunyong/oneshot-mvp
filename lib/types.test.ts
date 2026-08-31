// 저장된 진단(문자열) → 진단기 입력(숫자) 변환 테스트.
//
// 이 변환은 원래 화면 여섯 곳에 손으로 복제돼 있었다. 필드 이름이 다르고
// (`theme` → `themeCode`) 옮긴 뒤에는 셋 다 number 라, 잘못 이어도 타입
// 검사가 통과한다. 실제로 그 복제 중 하나가 자기 식으로 계산을 하다가
// 같은 진단에 다른 배수를 내보냈다(2026-08-31).
//
// 그래서 여기서 지키는 것은 계산이 아니라 **배선**이다 — 어느 문자열이
// 어느 숫자 자리로 가는가.

import { test } from "node:test";
import assert from "node:assert/strict";

import { planInputOf, type Entry } from "@/lib/types";

const 저장된진단: Entry = {
  id: "42",
  sido: "충남",
  sigungu: "예산군",
  month: "10",
  theme: "1",
  population: "7.9",
  accessibility: "2",
  savedAt: "2026-08-31T12:00:00.000Z",
};

test("여섯 자리가 각자 제 자리로 간다 — 이름이 바뀌는 곳이 함정이다", () => {
  const p = planInputOf(저장된진단);

  assert.equal(p.sido, "충남");
  assert.equal(p.sigungu, "예산군");
  assert.equal(p.month, 10);
  // `theme` 이 `themeCode` 로 이름을 바꾼다. 여기가 가장 잘 어긋나는 자리다
  assert.equal(p.themeCode, 1);
  assert.equal(p.populationManMyeong, 7.9);
  assert.equal(p.accessibility, 2);
});

test("숫자 자리는 문자열이 아니라 숫자로 나온다", () => {
  const p = planInputOf(저장된진단);

  for (const [키, 값] of [
    ["month", p.month],
    ["themeCode", p.themeCode],
    ["populationManMyeong", p.populationManMyeong],
    ["accessibility", p.accessibility],
  ] as const) {
    assert.equal(typeof 값, "number", `${키} 가 숫자가 아니다`);
  }
});

test("축이 섞이지 않는다 — 값을 서로 다르게 주고 자리를 확인한다", () => {
  // 전부 다른 값이라 한 자리라도 바꿔 이으면 반드시 걸린다
  const p = planInputOf({
    ...저장된진단,
    month: "3",
    theme: "8",
    population: "51.4",
    accessibility: "5",
  });

  assert.deepEqual(
    [p.month, p.themeCode, p.populationManMyeong, p.accessibility],
    [3, 8, 51.4, 5],
  );
});

test("소수점 인구를 반올림하지 않는다 — 만 명 단위라 0.1 이 천 명이다", () => {
  const p = planInputOf({ ...저장된진단, population: "12.3" });
  assert.equal(p.populationManMyeong, 12.3);
});
