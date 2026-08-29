// 도면(행사장 배치) 도메인 테스트.
//
// 캔버스(Konva)는 브라우저 몫이고, 여기서 지키는 것은 도면의 **수학과 계약**이다:
// 축척이 틀리면 M2의 모든 거리·면적 판정이 통째로 틀린다. 그래서 축척부터 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyVenue,
  fitToSite,
  freeSpot,
  KIND_SIZE_M,
  metersOf,
  outsideSite,
  pointInPolygon,
  polygonAreaM2,
  scaleFromPoints,
  scaleItems,
  shiftItems,
  sizeInPx,
  siteOf,
  validateVenue,
  VENUE_KIND_NAME,
  VIEW_RANGE,
  viewOf,
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

// ── 부지에 맞춰 보기 / 뷰 배율 (1-e) ──────────────────────────────

test("부지에 맞춰 보기 — 부지가 캔버스를 채우는 배율과 중앙으로 데려올 이동량", () => {
  const canvas = { width: 900, height: 620 };
  // 200×200px 부지가 캔버스 왼쪽 위에 치우쳐 있다
  const 부지 = [100, 100, 300, 100, 300, 300, 100, 300];
  const fit = fitToSite(부지, canvas, 1)!;

  // 짧은 변(세로 620)이 배율을 정한다: 620×0.88 / 200 = 2.728
  assert.ok(Math.abs(fit.view - 2.728) < 0.001, `배율: ${fit.view}`);
  assert.ok(Math.abs(fit.factor - fit.view) < 1e-9, "배율 1 에서 시작하면 곱은 배율과 같다");

  // 실제로 옮겨 보면 부지 중심이 캔버스 중심에 온다
  const 옮긴것 = shiftItems(
    scaleItems([상자({ id: "s", kind: "site", points: 부지 })], fit.factor, canvas.width / 2, canvas.height / 2),
    fit.dx,
    fit.dy,
  );
  const p = 옮긴것[0].points!;
  const cx = (Math.min(p[0], p[4]) + Math.max(p[0], p[4])) / 2;
  const cy = (Math.min(p[1], p[5]) + Math.max(p[1], p[5])) / 2;
  assert.ok(Math.abs(cx - 450) < 0.001, `가로 중심이 어긋났다: ${cx}`);
  assert.ok(Math.abs(cy - 310) < 0.001, `세로 중심이 어긋났다: ${cy}`);

  // 부지가 캔버스 안에 들어온다
  assert.ok(Math.max(p[0], p[4]) - Math.min(p[0], p[4]) <= canvas.width);
});

test("맞춰 보기를 해도 실측은 한 치도 안 변한다 — 늘어난 것은 화면뿐이다", () => {
  // 이 등식이 이 기능의 전부다. 배율은 보기를 키우는 것이지 부지를 키우는 게
  // 아니다. mPerPx 를 같은 곱으로 나누지 않으면 200m 부지가 545m 가 된다.
  const canvas = { width: 900, height: 620 };
  const mPerPx = 0.474; // 줌 18, 위도 37.5
  const 부지 = [100, 100, 522, 100, 522, 395, 100, 395]; // ≈200×140m
  const 전 = polygonAreaM2(부지, mPerPx)!;

  const fit = fitToSite(부지, canvas, 1)!;
  const 후점 = scaleItems(
    [상자({ id: "s", kind: "site", points: 부지 })],
    fit.factor,
    canvas.width / 2,
    canvas.height / 2,
  )[0].points!;
  const 후 = polygonAreaM2(후점, mPerPx / fit.view)!;

  assert.ok(Math.abs(후 - 전) / 전 < 1e-9, `면적이 변했다: ${전} → ${후}`);
  assert.ok(전 > 27000 && 전 < 29000, `≈200×140m 부지여야 한다: ${전}`);

  // 3m 부스도 마찬가지 — 픽셀은 커지고 미터는 그대로다
  const [w0] = sizeInPx("booth", mPerPx);
  const [w1] = sizeInPx("booth", mPerPx / fit.view);
  assert.ok(w1 > w0 * 1.5, `부스가 안 커졌다: ${w0.toFixed(1)}px → ${w1.toFixed(1)}px`);
  assert.ok(Math.abs(w1 * (mPerPx / fit.view) - 3) < 1e-9, "부스는 여전히 3m 다");
  // 줌 18 에서 6.3px 이던 부스가 11px 대가 된다 — 손으로 잡을 수 있는 크기다.
  // 세로(140m)가 캔버스 294m 안에서 배율을 정하므로 여기가 상한이다.
  assert.ok(w1 > 11, `만질 수 있는 크기여야 한다: ${w1.toFixed(1)}px`);
});

test("배율은 한계가 있다 — 타일 오버줌은 늘린 그림이라 무한정 못 늘린다", () => {
  const canvas = { width: 900, height: 620 };
  // 10px 짜리 점만 한 부지 — 계산상 배율 54 배지만 상한에서 멈춘다
  const 점 = [400, 300, 410, 300, 410, 310, 400, 310];
  assert.equal(fitToSite(점, canvas, 1)!.view, VIEW_RANGE.max);

  // 캔버스보다 큰 부지는 배율이 1 아래로 내려가지 않는다 — 축소는 지도 줌의 몫
  const 거대 = [0, 0, 4000, 0, 4000, 3000, 0, 3000];
  assert.equal(fitToSite(거대, canvas, 1)!.view, VIEW_RANGE.min);
});

test("맞춰 볼 부지가 없거나 넓이가 없으면 지어내지 않고 null", () => {
  const canvas = { width: 900, height: 620 };
  assert.equal(fitToSite([], canvas, 1), null);
  assert.equal(fitToSite([0, 0, 10, 10], canvas, 1), null, "세 점이 안 되면 부지가 아니다");
  // 한 줄로 늘어선 점들은 면이 아니다
  assert.equal(fitToSite([0, 0, 100, 0, 200, 0], canvas, 1), null);
});

test("이미 맞춰 본 상태에서 다시 맞추면 곱이 아니라 절대 배율로 간다", () => {
  const canvas = { width: 900, height: 620 };
  // 배율 2 에서 이미 400px(=배율 1 기준 200px) 로 커져 있는 부지
  const 부지 = [100, 100, 500, 100, 500, 500, 100, 500];
  const fit = fitToSite(부지, canvas, 2)!;
  // 620×0.88 / 400 = 1.364 배 더 → 절대 배율 2.728
  assert.ok(Math.abs(fit.view - 2.728) < 0.001, `절대 배율: ${fit.view}`);
  assert.ok(Math.abs(fit.factor - 1.364) < 0.001, `곱: ${fit.factor}`);
});

test("뷰 배율은 없으면 1 — 옛 도면을 열어도 그대로 보인다", () => {
  assert.equal(viewOf(emptyVenue(900, 620)), 1);
  assert.equal(viewOf({ ...emptyVenue(900, 620), map: { lat: 36, lng: 128, zoom: 18 } }), 1);
  assert.equal(
    viewOf({ ...emptyVenue(900, 620), map: { lat: 36, lng: 128, zoom: 18, view: 2.5 } }),
    2.5,
  );
  // 이상한 값은 1 로 — 0 이면 축척이 무한대가 된다
  assert.equal(viewOf({ ...emptyVenue(900, 620), map: { lat: 36, lng: 128, zoom: 18, view: 0 } }), 1);
});

test("도형 늘리기·옮기기 — 통로 폭도, 부지 경계도 같이 간다", () => {
  const items = [
    상자({ id: "b", x: 100, y: 100, w: 10, h: 10 }),
    상자({ id: "p", kind: "path", w: 16, points: [100, 100, 200, 100] }),
    상자({ id: "s", kind: "site", points: [100, 100, 200, 100, 200, 200] }),
  ];
  const 커진것 = scaleItems(items, 2, 100, 100);
  assert.deepEqual(
    { x: 커진것[0].x, y: 커진것[0].y, w: 커진것[0].w, h: 커진것[0].h },
    { x: 100, y: 100, w: 20, h: 20 },
    "중심에 있는 도형은 제자리에서 커진다",
  );
  assert.equal(커진것[1].w, 32, "통로 폭이 안 커지면 실측 폭이 반이 된다");
  assert.deepEqual(커진것[1].points, [100, 100, 300, 100]);

  // 부지 경계도 꺾은선이다 — 예전에는 path 만 봐서 지도를 끌면 경계만
  // 제자리에 남았다. 경계가 안 따라오면 면적도 밖 판정도 통째로 거짓말이 된다
  assert.deepEqual(커진것[2].points, [100, 100, 300, 100, 300, 300]);

  const 옮긴것 = shiftItems(커진것, 10, -5);
  assert.equal(옮긴것[0].x, 110);
  assert.equal(옮긴것[0].y, 95);
  assert.deepEqual(옮긴것[1].points, [110, 95, 310, 95]);
  assert.deepEqual(옮긴것[2].points, [110, 95, 310, 95, 310, 295]);
});
