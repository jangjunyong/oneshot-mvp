// 도면(행사장 배치) 도메인 테스트.
//
// 캔버스(Konva)는 브라우저 몫이고, 여기서 지키는 것은 도면의 **수학과 계약**이다:
// 축척이 틀리면 M2의 모든 거리·면적 판정이 통째로 틀린다. 그래서 축척부터 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyVenue,
  freeSpot,
  KIND_SIZE_M,
  metersOf,
  outsideSite,
  pointInPolygon,
  polygonAreaM2,
  scaleFromPoints,
  sizeInPx,
  siteOf,
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

// ── 실측 치수 (1-a) ───────────────────────────────────────────────

const 상자 = (over: Partial<VenueItem> & Pick<VenueItem, "id">): VenueItem => ({
  kind: "booth",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  rotation: 0,
  name: "부스",
  ...over,
});

test("크기는 미터가 진실이다 — 축척이 있으면 실측이 픽셀로 옮겨진다", () => {
  // 줌 18 근처: 1px = 0.5m. 3m 부스는 6px 여야 한다
  const [w, h] = sizeInPx("booth", 0.5);
  assert.equal(w, 6);
  assert.equal(h, 6);

  // 축척이 절반이면(더 확대) 같은 부스가 두 배 픽셀이 된다 — 실측은 그대로
  const [w2] = sizeInPx("booth", 0.25);
  assert.equal(w2, 12);

  // 무대 12×8m
  assert.deepEqual(sizeInPx("stage", 0.5), [24, 16]);
});

test("축척이 없으면 픽셀 그림 크기를 쓴다 — 모르는 치수를 지어내지 않는다", () => {
  const [w, h] = sizeInPx("booth", null);
  assert.ok(w > 20 && h > 20, "밑그림 모드에서는 그릴 수 있는 크기여야 한다");
  // 0 이나 음수 축척도 축척 없음으로 본다
  assert.deepEqual(sizeInPx("booth", 0), sizeInPx("booth", null));
});

test("옛 픽셀 고정 크기가 만들던 참사가 재발하지 않는다", () => {
  // 줌 16 은 1px ≈ 1.96m. 옛 기본값(60px)이면 부스가 117m 였다
  const mPerPx = 1.957;
  const [w] = sizeInPx("booth", mPerPx);
  const 실측폭 = w * mPerPx;
  assert.ok(실측폭 < 4, `부스가 ${실측폭.toFixed(0)}m 다 — 3m 여야 한다`);
  assert.equal(KIND_SIZE_M.booth[0], 3);
});

// ── 겹치지 않게 놓기 (1-b) ────────────────────────────────────────

test("새로 놓는 것은 이미 놓인 것과 겹치지 않는다", () => {
  const canvas = { width: 900, height: 620 };
  const 놓인것 = [상자({ id: "a", x: 40, y: 40, w: 100, h: 100 })];
  const spot = freeSpot(놓인것, 60, 40, canvas);

  const 겹치나 =
    spot.x < 140 && spot.x + 60 > 40 && spot.y < 140 && spot.y + 40 > 40;
  assert.equal(겹치나, false, `겹치는 자리를 골랐다: ${JSON.stringify(spot)}`);
});

test("여섯 개를 이어 놓아도 여섯 개가 다 따로 선다", () => {
  const canvas = { width: 900, height: 620 };
  const items: VenueItem[] = [];
  for (let i = 0; i < 6; i += 1) {
    const { x, y } = freeSpot(items, 30, 30, canvas);
    items.push(상자({ id: `b${i}`, x, y, w: 30, h: 30 }));
  }
  const 자리 = new Set(items.map((it) => `${it.x},${it.y}`));
  assert.equal(자리.size, 6, "같은 자리에 쌓였다 — 옛 n%6 버그 재발");
});

// ── 부지 경계 (1-c) ───────────────────────────────────────────────

test("부지 면적 — 신발끈 공식에 축척을 곱한다", () => {
  // 100×50px 직사각형, 1px=0.5m → 50m × 25m = 1250㎡
  const 사각 = [0, 0, 100, 0, 100, 50, 0, 50];
  assert.equal(polygonAreaM2(사각, 0.5), 1250);

  // 점 순서가 반대라도 면적은 양수다
  assert.equal(polygonAreaM2([0, 0, 0, 50, 100, 50, 100, 0], 0.5), 1250);

  // 축척이 없으면 픽셀 면적을 ㎡ 인 척하지 않는다
  assert.equal(polygonAreaM2(사각, null), null);
  // 세 점이 안 되면 다각형이 아니다
  assert.equal(polygonAreaM2([0, 0, 10, 10], 0.5), null);
});

test("점이 부지 안인지 — 경계 밖은 밖이다", () => {
  const 사각 = [0, 0, 100, 0, 100, 100, 0, 100];
  assert.equal(pointInPolygon(사각, { x: 50, y: 50 }), true);
  assert.equal(pointInPolygon(사각, { x: 150, y: 50 }), false);
  assert.equal(pointInPolygon(사각, { x: -1, y: 50 }), false);
});

test("부지 밖으로 나간 배치를 잡는다 — 걸친 것도 나간 것이다", () => {
  const v: Venue = {
    ...emptyVenue(900, 620),
    mPerPx: 0.5,
    items: [
      상자({
        id: "site",
        kind: "site",
        name: "부지 경계",
        points: [0, 0, 200, 0, 200, 200, 0, 200],
      }),
      상자({ id: "안", x: 50, y: 50, w: 20, h: 20 }),
      상자({ id: "걸침", x: 190, y: 50, w: 40, h: 20 }),
      상자({ id: "밖", x: 400, y: 400, w: 20, h: 20 }),
    ],
  };

  const 밖 = outsideSite(v);
  assert.deepEqual(밖.sort(), ["걸침", "밖"]);
  assert.equal(siteOf(v)?.id, "site");
});

test("부지를 안 그렸으면 판정하지 않는다 — 안 그린 것과 나간 것은 다르다", () => {
  const v: Venue = {
    ...emptyVenue(900, 620),
    mPerPx: 0.5,
    items: [상자({ id: "a", x: 5000, y: 5000, w: 20, h: 20 })],
  };
  assert.deepEqual(outsideSite(v), []);
  assert.equal(siteOf(v), null);
});

test("부지 경계는 하나뿐이고 세 점 이상이어야 한다", () => {
  const 둘 = validateVenue({
    ...emptyVenue(900, 620),
    items: [
      상자({ id: "s1", kind: "site", name: "부지 경계", points: [0, 0, 10, 0, 10, 10] }),
      상자({ id: "s2", kind: "site", name: "부지 경계", points: [0, 0, 10, 0, 10, 10] }),
    ],
  });
  assert.ok(둘.some((p) => p.includes("하나만")), 둘.join(" / "));

  const 두점 = validateVenue({
    ...emptyVenue(900, 620),
    items: [상자({ id: "s", kind: "site", name: "부지 경계", points: [0, 0, 10, 10] })],
  });
  assert.ok(두점.some((p) => p.includes("세 점")), 두점.join(" / "));
});

test("부지 경계도 화면에 그대로 나갈 한국어 이름을 가진다", () => {
  assert.equal(VENUE_KIND_NAME.site, "부지 경계");
});
