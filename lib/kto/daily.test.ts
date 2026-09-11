// 시군구 이름 → KT 코드. 사람이 치는 표기를 받아야 한다.
//
// 2026-09-11 실사용: 심사위원이 "충청남도 · 보령"을 치면 "코드를 찾지 못했다"로 판정이 아예
// 안 나왔다. "충남 · 보령시"만 됐다. 변환표는 있었는데 안 불렀고 접미사 보정은 없었다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveRegion, sigunguCode, sigunguNamesOf } from "@/lib/kto/daily";

test("정식 시도 이름과 짧은 이름이 같은 코드로 간다", () => {
  assert.equal(sigunguCode("충남", "보령시"), "44180");
  assert.equal(sigunguCode("충청남도", "보령시"), "44180");
  assert.equal(sigunguCode("강원도", "정선군"), "51770");
  assert.equal(sigunguCode("강원특별자치도", "정선군"), "51770");
  assert.equal(sigunguCode("경기", "군포시"), "41410");
});

test("접미사(시·군·구)가 빠져도 하나만 맞으면 그것으로 본다", () => {
  assert.equal(sigunguCode("충남", "보령"), "44180");
  assert.equal(sigunguCode("강원", "정선"), "51770");
  assert.equal(sigunguCode("경기", "군포"), "41410");
});

test("resolveRegion 은 KT 표기(짧은 시도·접미사 있는 시군구)를 돌려준다", () => {
  const r = resolveRegion("충청남도", "보령");
  assert.ok(r);
  assert.equal(r.sido, "충남");
  assert.equal(r.name, "보령시");
  assert.equal(r.code, "44180");
});

test("띄어쓰기 차이(청주시 상당구 / 청주시상당구)는 같은 곳", () => {
  const a = sigunguCode("충북", "청주시 상당구");
  const b = sigunguCode("충북", "청주시상당구");
  assert.ok(a);
  assert.equal(a, b);
  assert.notEqual(a, sigunguCode("충북", "청주시"), "구까지 적으면 시 전체로 보내지 않는다");
});

test("못 찾으면 null — 이웃을 짐작해 주지 않는다", () => {
  assert.equal(sigunguCode("강원", "고한읍"), null, "읍은 KT 시군구가 아니다");
  assert.equal(sigunguCode("충남", "없는곳"), null);
  assert.equal(sigunguCode("없는도", "보령시"), null);
  assert.equal(resolveRegion("강원", "고한읍"), null);
});

test("같은 시도의 후보 목록을 낸다 (못 찾았을 때 화면에 보여 줄 것)", () => {
  const names = sigunguNamesOf("충청남도");
  assert.ok(names.includes("보령시"));
  assert.ok(names.length >= 15);
  assert.deepEqual(sigunguNamesOf("없는도"), []);
});
