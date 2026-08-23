// 기획서 추출 테스트.
//
// 여기서 지키는 것은 추출 정확도가 아니다 — 그건 모델이 하는 일이고 테스트로
// 못 잡는다. 지키는 것은 **모델이 없어도 앱이 산다**는 약속과, 추출 결과가
// 그대로 match 에 먹힌다는 계약이다.
//
// 이 파일은 모델을 부르지 않는다. 부르면 테스트가 돈을 쓰고 네트워크에 묶인다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractPlan, hasModelKey } from "@/lib/extract";
import { populationOf } from "@/lib/festivals";
import { findSimilar } from "@/lib/match";
import { ACCESSIBILITY_LABEL, MAX_PLAN_TEXT, THEME_NAME } from "@/lib/types";

// 키가 꽂힌 채로 테스트를 돌리면 진짜로 호출된다. 그건 사고다.
assert.equal(
  hasModelKey(),
  false,
  "테스트는 OPENROUTER_API_KEY 없이 돌려야 한다",
);

const 기획서 = `제1회 김천김밥축제 추진계획
○ 개최기간: 2024년 10월 중 3일간
○ 개최장소: 경상북도 김천시 일원`;

test("키가 없으면 모델을 부르지 않고 샘플 초안으로 떨어진다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.equal(초안.source, "sample");
});

test("샘플이라는 사실을 숨기지 않는다 — 근거에 표시가 남는다", async () => {
  const 초안 = await extractPlan(기획서);
  // 화면이 "실제 문서에서 뽑은 값이 아니다"라고 말할 수 있어야 한다.
  // 표시가 없으면 지어낸 값이 근거인 척한다.
  assert.match(초안.evidence.sido ?? "", /샘플/);
});

test("값을 채운 항목에는 반드시 근거가 붙는다", async () => {
  const 초안 = await extractPlan(기획서);
  for (const key of ["sido", "sigungu", "month", "themeCode", "accessibility"] as const) {
    if (초안[key] !== null) {
      assert.ok(
        초안.evidence[key],
        `${key} 는 값이 있는데 근거가 없다 — 실무자는 못 믿는다`,
      );
    }
  }
});

test("뽑힌 값이 THEME_NAME · ACCESSIBILITY_LABEL 안에 있다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.ok(초안.themeCode !== null && THEME_NAME[초안.themeCode]);
  assert.ok(
    초안.accessibility !== null && ACCESSIBILITY_LABEL[초안.accessibility],
  );
});

test("인구는 모델이 아니라 619건 데이터에서 온다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.equal(
    초안.populationManMyeong,
    populationOf(초안.sido!, 초안.sigungu!),
    "인구는 데이터 조회값과 같아야 한다 — 모델이 지어내면 안 된다",
  );
});

test("모르는 지역은 인구를 지어내지 않고 null 을 돌려준다", () => {
  assert.equal(populationOf("없는시도", "없는시군구"), null);
});

test("못 찾은 항목은 무엇이 없는지 한국어로 말한다", async () => {
  const 초안 = await extractPlan(기획서);
  // 샘플은 5축이 다 차 있다. missing 은 배열이어야 하고, 들어 있다면
  // 화면에 그대로 뿌릴 수 있는 한국어여야 한다 (코드명이 아니라).
  assert.ok(Array.isArray(초안.missing));
  for (const name of 초안.missing) {
    assert.ok(!/[a-zA-Z]/.test(name), `missing 에 코드명이 샜다: ${name}`);
  }
});

test("추출 결과를 그대로 findSimilar 에 넣으면 닮은 축제가 나온다", async () => {
  const 초안 = await extractPlan(기획서);

  // 이 계약이 깨지면 화면에서 값을 손으로 옮겨야 한다는 뜻이다.
  const result = findSimilar({
    sido: 초안.sido!,
    sigungu: 초안.sigungu!,
    month: 초안.month!,
    themeCode: 초안.themeCode!,
    populationManMyeong: 초안.populationManMyeong!,
    accessibility: 초안.accessibility!,
  });

  assert.equal(result.invalid, undefined, "추출 결과가 입력 검증을 통과해야 한다");
  assert.ok(result.matched.length > 0, "김천 조건이면 닮은 축제가 나와야 한다");
});

test("입력 길이 상한이 실제로 걸려 있다", () => {
  // 1건당 비용의 상한이 이 숫자다. 커지면 상한이 무너진다.
  assert.ok(MAX_PLAN_TEXT > 0 && MAX_PLAN_TEXT <= 20000);
});
