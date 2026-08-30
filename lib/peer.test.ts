// 같은 규모 지역 대비 — 인구 편향 보정 테스트.
//
// 619건을 인구 구간으로 갈라 보면 등급이 사실상 인구 프록시다:
//   인구 ~3만    심각 37% · 주의 42% · 근거없음 21%
//   인구 100만+  심각  0% · 주의  5% · 근거없음 95%
//
// 배수의 분모가 "평상시 그 지역 외지인"이라 인구가 적을수록 커진다(r = -0.486).
// 그래서 소도시 담당자는 "우린 늘 심각"이라 경보를 무시하게 되고, 대도시에서는
// 제품이 아무 말도 못 한다. 여기서 지키는 것은 **배수를 조작하지 않으면서
// 맥락을 주는 것**이다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { peerContext, POPULATION_BUCKETS } from "@/lib/peer";
import { FESTIVALS } from "@/lib/festivals";

test("구간은 인구를 빠짐없이 덮고 겹치지 않는다", () => {
  assert.equal(POPULATION_BUCKETS[0].min, 0);
  assert.equal(POPULATION_BUCKETS[POPULATION_BUCKETS.length - 1].max, Infinity);
  for (let i = 1; i < POPULATION_BUCKETS.length; i++) {
    assert.equal(
      POPULATION_BUCKETS[i].min,
      POPULATION_BUCKETS[i - 1].max,
      "구간 사이에 틈이나 겹침이 있다",
    );
  }
  // 619건 전부가 어느 구간엔가 든다
  for (const f of FESTIVALS) {
    assert.ok(
      peerContext(f.populationManMyeong, f.actualVisitSurge) !== null,
      `${f.name}(인구 ${f.populationManMyeong}만)이 어느 구간에도 안 든다`,
    );
  }
});

test("대도시의 낮은 배수도 또래 안에서는 높을 수 있다 — 여기가 이 기능의 전부", () => {
  // 인구 50만 지역에서 배수 1.5 는 전국 기준 "주의" 언저리지만,
  // 같은 규모 또래 중에서는 드문 일이다. 그 사실이 나와야 한다.
  const 대도시 = peerContext(50, 1.5)!;
  assert.equal(대도시.label, "30~100만");
  assert.ok(
    대도시.topPercent < 15,
    `인구 50만에서 1.5배가 또래 상위 ${대도시.topPercent}% 다 — 더 희귀해야 한다`,
  );

  // 같은 1.5 배라도 소도시에서는 흔하다
  const 소도시 = peerContext(2, 1.5)!;
  assert.ok(
    소도시.topPercent > 대도시.topPercent,
    `소도시 상위 ${소도시.topPercent}% 가 대도시 ${대도시.topPercent}% 보다 희귀하게 나왔다`,
  );
});

test("소도시의 높은 배수는 또래 안에서 평범할 수 있다", () => {
  // 인구 2만 지역의 1.84 배는 전국 기준 "주의"지만 또래 중앙값이다
  const c = peerContext(2, 1.84)!;
  assert.ok(
    c.topPercent > 30 && c.topPercent < 70,
    `또래 중간이어야 하는데 상위 ${c.topPercent}% 다`,
  );
});

test("표본 수를 항상 같이 낸다 — n=19 에서 상위 5%는 1등이라는 뜻이다", () => {
  const c = peerContext(2, 3.0)!;
  assert.ok(c.n > 0);
  // 구간의 실제 건수와 맞아야 한다
  const 실제 = FESTIVALS.filter(
    (f) => f.populationManMyeong >= 0 && f.populationManMyeong < 3,
  ).length;
  assert.equal(c.n, 실제);
  assert.ok(c.median > 0, "또래 중앙값도 같이 낸다");
});

test("상위 %는 0~100 안이고, 배수가 클수록 작아진다", () => {
  const 낮음 = peerContext(50, 1.0)!;
  const 높음 = peerContext(50, 3.0)!;
  assert.ok(높음.topPercent < 낮음.topPercent);
  for (const c of [낮음, 높음]) {
    assert.ok(c.topPercent >= 0 && c.topPercent <= 100, `상위 ${c.topPercent}%`);
  }
});

test("잴 수 없는 입력은 지어내지 않고 null", () => {
  assert.equal(peerContext(Number.NaN, 2), null);
  assert.equal(peerContext(-1, 2), null);
  assert.equal(peerContext(30, Number.NaN), null);
});

test("순수 — 같은 입력에 같은 결과", () => {
  assert.deepEqual(peerContext(50, 1.5), peerContext(50, 1.5));
});
