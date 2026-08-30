// 예시 배치 테스트.
//
// 사용자 지적(2026-08-30): "사용자가 도면 세팅하기 어려워하는 것 같은데
// 기본 도면이라도 주든지." 빈 캔버스에 축척과 부지 경계부터 세우라는 건
// 담당자에게 너무 먼 첫 걸음이었다.
//
// 여기서 지키는 것은 **예시도 실측이어야 한다**는 것이다. 대충 그린 그림을
// 깔아 두면 담당자가 그 위에서 재고, 그 순간 거짓 치수가 근거인 척한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { presetLayout, PRESET_SITE_M } from "@/lib/preset";
import { KIND_SIZE_M, polygonAreaM2, outsideSite, siteOf, validateVenue } from "@/lib/venue";
import { emptyVenue } from "@/lib/venue";

/** 줌 18·위도 36 근처 — 실제로 지도를 깔았을 때의 축척 */
const M_PER_PX = 0.4848;
const CANVAS = { width: 900, height: 620 };

const 만든다 = () => {
  const v = { ...emptyVenue(CANVAS.width, CANVAS.height), mPerPx: M_PER_PX };
  return { ...v, items: presetLayout(v, M_PER_PX) };
};

test("예시 배치는 그대로 저장해도 통과한다", () => {
  assert.deepEqual(validateVenue(만든다()), []);
});

test("부지가 하나 있고 면적이 선언한 크기와 맞는다", () => {
  const v = 만든다();
  const site = siteOf(v);
  assert.ok(site, "부지 경계가 없다 — 예시의 출발점이 부지다");

  const 면적 = polygonAreaM2(site!.points!, M_PER_PX)!;
  const 예상 = PRESET_SITE_M.w * PRESET_SITE_M.h;
  assert.ok(
    Math.abs(면적 - 예상) / 예상 < 0.02,
    `면적 ${Math.round(면적)}㎡ 가 선언한 ${예상}㎡ 와 다르다`,
  );
});

test("모든 배치가 부지 안에 있다 — 예시가 경고를 달고 나오면 안 된다", () => {
  assert.deepEqual(outsideSite(만든다()), []);
});

test("크기가 실측이다 — 부스는 3m, 무대는 12m", () => {
  const v = 만든다();
  const 부스 = v.items.find((it) => it.kind === "booth")!;
  const 무대 = v.items.find((it) => it.kind === "stage")!;

  assert.ok(
    Math.abs(부스.w * M_PER_PX - KIND_SIZE_M.booth[0]) < 0.01,
    `부스가 ${(부스.w * M_PER_PX).toFixed(2)}m 다`,
  );
  assert.ok(
    Math.abs(무대.w * M_PER_PX - KIND_SIZE_M.stage[0]) < 0.01,
    `무대가 ${(무대.w * M_PER_PX).toFixed(2)}m 다`,
  );
});

test("쏠림 스캔이 말을 할 만큼은 놓는다", () => {
  const v = 만든다();
  const 종류 = (k: string) => v.items.filter((it) => it.kind === k).length;
  assert.ok(종류("booth") >= 6, `부스 ${종류("booth")}개 — 스캔이 볼 게 없다`);
  assert.ok(종류("path") >= 1, "통로가 없으면 대기열 침범을 못 잰다");
  assert.ok(종류("gate") >= 1);
  assert.ok(종류("toilet") >= 1);
  assert.ok(종류("stage") >= 1);
});

test("부스마다 인력·선호도가 채워져 있다 — 비면 스캔이 0.5명으로 때운다", () => {
  for (const b of 만든다().items.filter((it) => it.kind === "booth")) {
    assert.ok((b.staff ?? 0) > 0, `${b.name} 인력이 비었다`);
    assert.ok((b.popularity ?? 0) >= 1 && (b.popularity ?? 0) <= 5);
  }
});

test("이름이 겹치지 않는다 — 스캔 결과가 어느 부스인지 가려야 한다", () => {
  const 이름들 = 만든다().items.map((it) => it.name);
  assert.equal(new Set(이름들).size, 이름들.length);
});

test("축척이 없으면 만들지 않는다 — 미터를 모르면 예시도 거짓말이다", () => {
  const v = emptyVenue(CANVAS.width, CANVAS.height);
  assert.deepEqual(presetLayout(v, null), []);
  assert.deepEqual(presetLayout(v, 0), []);
});

test("순수 — 같은 입력에 같은 결과(id 까지)", () => {
  const v = { ...emptyVenue(CANVAS.width, CANVAS.height), mPerPx: M_PER_PX };
  assert.deepEqual(presetLayout(v, M_PER_PX), presetLayout(v, M_PER_PX));
});
