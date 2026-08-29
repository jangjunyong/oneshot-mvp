// 도면(행사장 배치) 도메인 테스트.
//
// 캔버스(Konva)는 브라우저 몫이고, 여기서 지키는 것은 도면의 **수학과 계약**이다:
// 축척이 틀리면 M2의 모든 거리·면적 판정이 통째로 틀린다. 그래서 축척부터 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyVenue,
  metersOf,
  scaleFromPoints,
  validateVenue,
  VENUE_KIND_NAME,
  type Venue,
  type VenueItem,
} from "@/lib/venue";

test("축척 — 도면 위 두 점과 실제 거리에서 m/px 를 얻는다", () => {
  // 100px 떨어진 두 점이 실제 20m 라면 1px = 0.2m
  assert.equal(scaleFromPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 20), 0.2);
  // 3-4-5 삼각형: 대각선 50px 가 실제 10m
  assert.equal(scaleFromPoints({ x: 0, y: 0 }, { x: 30, y: 40 }, 10), 0.2);
});

test("축척 — 같은 점이거나 거리가 0 이하면 지어내지 않고 null", () => {
  assert.equal(scaleFromPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 10), null);
  assert.equal(scaleFromPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), null);
  assert.equal(scaleFromPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, -3), null);
});

test("실측 치수 — 축척이 있으면 부스의 실제 크기를 미터로 말한다", () => {
  const 부스: VenueItem = {
    id: "b1", kind: "booth", x: 0, y: 0, w: 30, h: 20, rotation: 0,
    name: "김밥 부스", staff: 2, popularity: 4,
  };
  assert.deepEqual(metersOf(부스, 0.2), { wM: 6, hM: 4 });
  // 축척이 없으면 null — 픽셀을 미터인 척 하지 않는다
  assert.equal(metersOf(부스, null), null);
});

const 정상도면 = (): Venue => ({
  width: 800,
  height: 600,
  mPerPx: 0.2,
  items: [
    { id: "b1", kind: "booth", x: 100, y: 100, w: 30, h: 20, rotation: 0, name: "김밥 부스", staff: 2, popularity: 4 },
    { id: "g1", kind: "gate", x: 0, y: 280, w: 20, h: 40, rotation: 0, name: "정문" },
    { id: "p1", kind: "path", x: 0, y: 0, w: 0, h: 0, rotation: 0, name: "주 통로", points: [20, 300, 400, 300, 400, 100] },
  ],
});

test("정상 도면은 문제 없이 통과한다", () => {
  assert.deepEqual(validateVenue(정상도면()), []);
});

test("검증 — 잘못된 도면은 무엇이 문제인지 한국어로 말한다", () => {
  const v = 정상도면();
  v.items.push({ id: "x", kind: "ufo" as never, x: 0, y: 0, w: 10, h: 10, rotation: 0, name: "?" });
  (v.items[0] as VenueItem).popularity = 9; // 1~5 밖
  v.items[2].points = [1, 2]; // 통로는 점 2개(좌표 4개) 이상
  const problems = validateVenue(v);
  assert.equal(problems.length, 3, problems.join(" / "));
  for (const p of problems) {
    assert.ok(!/[a-zA-Z]/.test(p), `한국어가 아니다: ${p}`);
  }
});

test("검증 — 축척 없는 도면도 저장은 되지만 그 사실을 말한다", () => {
  // 축척은 M2 판정의 전제일 뿐 그리기의 전제가 아니다. 막지 않고 알린다.
  const v = 정상도면();
  v.mPerPx = null;
  const problems = validateVenue(v);
  assert.equal(problems.length, 0, "축척 없음은 오류가 아니다");
});

test("빈 도면 — 캔버스 크기만 있고 아이템 0개로 시작한다", () => {
  const v = emptyVenue(800, 600);
  assert.equal(v.items.length, 0);
  assert.equal(v.mPerPx, null);
  assert.deepEqual([v.width, v.height], [800, 600]);
});

test("종류 이름표가 화면에 그대로 나간다 — 전부 한국어", () => {
  for (const name of Object.values(VENUE_KIND_NAME)) {
    assert.ok(!/[a-zA-Z]/.test(name), `코드명이 샜다: ${name}`);
  }
});
