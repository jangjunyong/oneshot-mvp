// 닮은 축제 찾기 테스트 — 정상 입력만 다룬다.
//
// 정답 라벨(01)은 추측이 아니라 619건 실측 데이터를 실제로 돌려서 나온 값이다.
// 가중치나 임계값을 바꾸면 여기가 먼저 깨져야 한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { findSimilar } from "@/lib/match";
import type { AxisKey, PlanInput } from "@/lib/types";

/** 김천김밥축제 1회 조건 — PRD 성공 판정에 쓰는 그 입력 */
const 김천: PlanInput = {
  sido: "경북",
  sigungu: "김천시",
  month: 10,
  themeCode: 1,
  populationManMyeong: 14,
  accessibility: 2,
};

test("김천 조건에서 닮은 축제 3개가 나온다", () => {
  const r = findSimilar(김천);
  assert.equal(r.matched.length, 3);

  const 이름 = r.matched.map((m) => m.festival.name);
  assert.deepEqual(이름.toSorted(), [
    "예산사과축제",
    "예산장터 삼국축제",
    "홍천 사과축제",
  ]);
});

test("같은 입력을 두 번 넣으면 같은 결과가 나온다", () => {
  const a = findSimilar(김천).matched.map((m) => m.festival.id);
  const b = findSimilar(김천).matched.map((m) => m.festival.id);
  assert.deepEqual(a, b);
});

test("거리 오름차순으로 정렬된다 — 가장 닮은 것이 먼저", () => {
  const 거리 = findSimilar(김천).matched.map((m) => m.distance);
  assert.deepEqual(거리, [...거리].sort((x, y) => x - y));
});

test("왜 닮았는지를 축별로 낸다 (암묵지 2)", () => {
  for (const m of findSimilar(김천).matched) {
    const 축: AxisKey[] = m.axes.map((a) => a.axis);
    const 필요 = ["accessibility", "population", "month", "theme"] as const;
    for (const 필요한축 of 필요) {
      assert.ok(축.includes(필요한축), `${m.festival.name} 에 ${필요한축} 축이 없다`);
    }
    // 화면에 그대로 나가는 문장이라 비어 있으면 안 된다
    for (const a of m.axes) {
      assert.ok(a.label.length > 0, "축 이름이 비었다");
      assert.ok(a.detail.length > 0, `${a.label} 의 설명이 비었다`);
    }
  }
});

test("정상 입력에서 거리가 NaN 이 되지 않는다", () => {
  const r = findSimilar(김천);
  for (const m of r.matched) {
    assert.ok(Number.isFinite(m.distance), `${m.festival.name} 거리가 ${m.distance}`);
    for (const a of m.axes) {
      assert.ok(Number.isFinite(a.distance), `${a.label} 축 거리가 ${a.distance}`);
    }
  }
});

test("limit 을 주면 그 개수만 나온다", () => {
  assert.equal(findSimilar(김천, 1).matched.length, 1);
  assert.equal(findSimilar(김천, 5).matched.length <= 5, true);
});

test("찾아본 범위를 항상 함께 낸다 — 못 찾았을 때 화면에 쓴다", () => {
  const r = findSimilar(김천);
  assert.match(r.searchedScope, /619/);
});
