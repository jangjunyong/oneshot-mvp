// 자기검증 테스트.
//
// 화면에 "이 방식은 무작위의 2.41배로 집어냅니다"라고 적는 순간, 그 숫자는
// 출처가 있어야 한다(불문율 4번). 여기서 지키는 것은 **화면의 숫자가 데이터에서
// 다시 나오는가** 다. 데이터나 임계값이 바뀌면 이 테스트가 먼저 깨지고, 그래서
// 화면의 숫자가 조용히 낡는 일이 없다. match.test.ts 가 임계값 0.27 을 데이터로
// 다시 재는 것과 같은 방식이다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { leaveOneOut, LOO_PUBLISHED, WITHIN_BAND } from "@/lib/eval";
import { WEIGHT } from "@/lib/match";
import { FESTIVALS } from "@/lib/festivals";
import { DISTANCE_THRESHOLD, GRADE_CUT } from "@/lib/types";

test("화면에 나가는 검증 숫자는 619건에서 다시 나온다", () => {
  const r = leaveOneOut();

  // 표본 수는 데이터 건수 그대로
  assert.equal(r.n, FESTIVALS.length);
  assert.equal(LOO_PUBLISHED.n, r.n, "게시값의 표본 수가 데이터와 다르다");

  const 같은가 = (a: number, b: number, 이름: string) =>
    assert.ok(
      Math.abs(a - b) < 0.001,
      `${이름}: 게시값 ${b} vs 실측 ${a} — 화면 숫자가 낡았다`,
    );

  같은가(r.precision, LOO_PUBLISHED.precision, "정밀도");
  같은가(r.recall, LOO_PUBLISHED.recall, "재현율");
  같은가(r.lift, LOO_PUBLISHED.lift, "리프트");
  같은가(r.baseRate, LOO_PUBLISHED.baseRate, "기저율");
  같은가(r.medianAbsErr, LOO_PUBLISHED.medianAbsErr, "절대오차 중앙값");
  같은가(r.withinRatio, LOO_PUBLISHED.withinRatio, "밴드 안 비율");
});

test("리프트는 기저율 대비 정밀도다 — 무작위보다 나은지가 이 지표의 전부", () => {
  const r = leaveOneOut();

  // 기저율은 619건 중 실제 위험군(배수 1.5 이상)의 비율
  const 위험군 = FESTIVALS.filter(
    (f) => f.actualVisitSurge >= GRADE_CUT.caution,
  ).length;
  assert.ok(
    Math.abs(r.baseRate - 위험군 / FESTIVALS.length) < 1e-9,
    "기저율이 데이터와 다르다",
  );

  assert.ok(Math.abs(r.lift - r.precision / r.baseRate) < 1e-9);

  // 무작위보다 나아야 이 제품이 존재할 이유가 있다
  assert.ok(r.lift > 1.5, `리프트가 ${r.lift.toFixed(2)}배다 — 무작위와 다를 바 없다`);
});

test("한계도 같이 낸다 — 재현율이 100%인 척하지 않는다", () => {
  const r = leaveOneOut();
  // 절반 가까이 놓친다는 사실이 숫자에 그대로 남아 있어야 한다.
  // 이게 1 에 가까워지면 화면 문구("절반 가까이는 놓칩니다")를 고쳐야 한다.
  assert.ok(r.recall > 0.3 && r.recall < 0.8, `재현율 ${r.recall}`);
  assert.ok(r.precision > 0 && r.precision < 1);
});

test("절대오차는 배수 단위이고, 밴드 비율은 그 밴드 안에 든 몫이다", () => {
  const r = leaveOneOut();
  assert.ok(r.medianAbsErr >= 0 && r.medianAbsErr < 1, `중앙 절대오차 ${r.medianAbsErr}`);
  assert.ok(r.withinRatio > 0 && r.withinRatio <= 1);
  assert.ok(WITHIN_BAND > 0, "밴드 폭이 화면에 그대로 나가므로 상수여야 한다");
});

test("테마 가중치 0.15 는 데이터가 고른 값이다 — 되돌리면 나빠진다", () => {
  // 사용자 지적("테마가 달라도 통과하는 건 문제")에서 시작해 감으로 올리지 않고
  // leave-one-out 으로 골랐다. 이 테스트가 그 근거를 코드에 남긴다.
  const 지금 = leaveOneOut();

  // 옛 가중치(테마 0.10)
  const 옛 = leaveOneOut({
    accessibility: 0.3, population: 0.3, region: 0.2, month: 0.1, theme: 0.1,
  });
  assert.ok(
    지금.lift > 옛.lift,
    `테마 0.15 리프트 ${지금.lift.toFixed(2)} 가 0.10 의 ${옛.lift.toFixed(2)} 보다 낫지 않다`,
  );
  assert.ok(지금.precision > 옛.precision, "정밀도가 안 나아졌다");

  // 테마를 임계값보다 크게 주면 "테마 다름"만으로 탈락한다 = 사실상 필수화.
  // 그러면 진짜 닮은 축제까지 버려 재현율이 떨어진다 — 그래서 안 한다.
  const 필수 = leaveOneOut({
    accessibility: 0.25, population: 0.25, region: 0.15, month: 0.05, theme: 0.3,
  });
  assert.ok(
    지금.recall > 필수.recall,
    `테마 필수화가 재현율에서 더 낫다(${필수.recall.toFixed(3)}) — 설계를 다시 볼 것`,
  );
  assert.ok(지금.lift > 필수.lift, "테마 필수화가 리프트에서 더 낫다 — 설계를 다시 볼 것");
});

test("가중치 합은 1 이다 — 임계값의 의미가 여기 묶여 있다", () => {
  const 합 = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(합 - 1) < 1e-9, `가중치 합 ${합}`);
  // 테마 단독으로는 탈락시키지 못해야 한다. 넘으면 그건 필수 조건이지 가중치가 아니다
  assert.ok(
    WEIGHT.theme < DISTANCE_THRESHOLD,
    `테마 가중치 ${WEIGHT.theme} 가 임계값 ${DISTANCE_THRESHOLD} 를 넘어 사실상 필수 조건이 됐다`,
  );
});

test("순수 — 같은 데이터에 항상 같은 결과", () => {
  assert.deepEqual(leaveOneOut(), leaveOneOut());
});
