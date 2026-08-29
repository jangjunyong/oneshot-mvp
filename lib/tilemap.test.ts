// 위성지도 밑그림 수학 테스트.
//
// 여기서 지키는 것은 웹 메르카토르 타일 수학이다 — 이게 틀리면 지도가
// 엉뚱한 곳을 보여주고, 자동 축척(m/px)이 틀리면 M2 의 모든 거리 판정이
// 통째로 틀린다. 자동 축척은 수동 축척 재기를 대체하는 만큼 더 엄하게 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampZoom,
  metersPerPixel,
  panCenter,
  tileUrl,
  latLngToWorldPx,
  TILE_SIZE,
  visibleTiles,
  zoomRange,
} from "@/lib/tilemap";

test("자동 축척 — 줌과 위도에서 m/px 를 얻는다", () => {
  // 웹 메르카토르 공식: 156543.03392 × cos(위도) / 2^줌
  // 위도 36°(한국 중부), 줌 17 → 약 0.966 m/px
  const v = metersPerPixel(36, 17);
  assert.ok(Math.abs(v - 0.9662) < 0.001, `36°/z17 은 ≈0.966 이어야 한다: ${v}`);
  // 적도에서 줌 0 은 정의 그대로
  assert.ok(Math.abs(metersPerPixel(0, 0) - 156543.03392) < 0.01);
  // 줌이 1 오르면 절반
  assert.ok(Math.abs(metersPerPixel(36, 18) - v / 2) < 0.0001);
});

test("타일 좌표 — 세계 픽셀 변환이 기준점에서 맞는다", () => {
  // 경도 0 · 위도 0 은 세계 지도의 정중앙
  const p = latLngToWorldPx(0, 0, 2); // 줌 2 → 세계 폭 1024px
  assert.deepEqual(p, { x: 512, y: 512 });
  // 동쪽(+경도)으로 가면 x 가 커진다
  assert.ok(latLngToWorldPx(0, 90, 2).x > 512);
  // 북쪽(+위도)으로 가면 y 가 작아진다 (화면 좌표)
  assert.ok(latLngToWorldPx(45, 0, 2).y < 512);
});

test("보이는 타일 — 캔버스를 덮는 타일과 배치 오프셋을 낸다", () => {
  // 김천 근처, 줌 16, 900×620 캔버스
  const tiles = visibleTiles(36.14, 128.11, 16, 900, 620);
  assert.ok(tiles.length >= 12, `900×620 이면 최소 4×3 타일: ${tiles.length}`);
  // 모든 타일은 캔버스와 겹친다 (완전히 밖의 타일을 내려받지 않는다)
  for (const t of tiles) {
    assert.ok(t.px > -256 && t.px < 900, `타일이 캔버스 밖이다: px=${t.px}`);
    assert.ok(t.py > -256 && t.py < 620, `타일이 캔버스 밖이다: py=${t.py}`);
  }
  // 캔버스 중앙을 덮는 타일이 반드시 있다
  assert.ok(
    tiles.some((t) => t.px <= 450 && 450 < t.px + 256 && t.py <= 310 && 310 < t.py + 256),
    "중앙을 덮는 타일이 없다",
  );
});

test("지도 끌기 — 화면을 dx 만큼 끌면 중심이 세계 픽셀로 정확히 -dx 이동한다", () => {
  // 이 등식이 깨지면 "놓은 것이 땅에 붙어 따라온다"는 접착이 어긋난다:
  // 에디터는 도형을 +dx 옮기고 지도 중심을 panCenter 로 옮겨 상쇄시킨다.
  const before = latLngToWorldPx(36.14, 128.11, 16);
  const moved = panCenter(36.14, 128.11, 16, 137, -52);
  const after = latLngToWorldPx(moved.lat, moved.lng, 16);
  assert.ok(Math.abs(after.x - (before.x - 137)) < 0.01, `x 어긋남: ${after.x - before.x}`);
  assert.ok(Math.abs(after.y - (before.y + 52)) < 0.01, `y 어긋남: ${after.y - before.y}`);
});

test("타일 주소 — 브이월드 키가 있으면 백지도, 없으면 OSM 폴백", () => {
  const sat = tileUrl(55906, 25459, 16, "satellite");
  assert.match(sat, /World_Imagery/, "위성(Imagery) 타일이어야 한다");
  assert.match(sat, /\/16\/25459\/55906$/, "Esri 는 z/y/x 순서다");

  // 도면 스타일 본선 — 국토부 브이월드 백지도 (흑백 건축도면 룩, 사용자 승인)
  const vw = tileUrl(55906, 25459, 16, "plan", "TESTKEY123");
  assert.match(vw, /api\.vworld\.kr/, "키가 있으면 브이월드여야 한다");
  assert.match(vw, /TESTKEY123\/white\/16\/25459\/55906\.png$/, "백지도 z/y/x 순서다");

  // 키가 없을 때의 폴백 — OSM (z/x/y)
  const osm = tileUrl(55906, 25459, 16, "plan");
  assert.match(osm, /openstreetmap/, "키가 없으면 OSM 폴백이어야 한다");
  assert.match(osm, /\/16\/55906\/25459\.png$/, "OSM 은 z/x/y 순서다");
});

test("보이는 타일 — 스타일과 키가 타일 주소까지 흘러간다", () => {
  const tiles = visibleTiles(36.14, 128.11, 16, 300, 300, "plan", "TESTKEY123");
  assert.ok(tiles.length > 0);
  for (const t of tiles) assert.match(t.url, /vworld/);
});

test("줌 범위 — 배경이 실제로 주는 만큼만 연다", () => {
  // 2026-08-29 실측: 브이월드 백지도는 z19 를 안 준다(XML 오류). 열어 두면
  // 담당자는 확대를 눌렀는데 빈 캔버스를 본다.
  const vw = zoomRange("plan", true);
  assert.equal(vw.max, 18, "브이월드는 z18 까지다");
  assert.equal(vw.min, 6);

  // 키가 없으면 OSM 폴백이라 범위가 다르다
  const osm = zoomRange("plan", false);
  assert.equal(osm.max, 19);
  assert.equal(osm.min, 5);

  // 위성(Esri)은 z20 부터 빈 타일이 온다
  assert.deepEqual(zoomRange("satellite", true), { min: 5, max: 19 });

  // 예전 하한(15)보다 훨씬 아래까지 내려간다 — 부지를 못 찾겠다는 지적
  assert.ok(vw.min < 15 && osm.min < 15, "축소 제한이 그대로다");
});

test("타일 오버줌 — 뷰 배율만큼 타일을 늘려 그리고, 덮는 땅은 그만큼 좁아진다", () => {
  // 브이월드가 z19 를 안 주니 부지를 당겨 보려면 z18 타일을 늘리는 수밖에 없다
  const 배율 = 2.5;
  const tiles = visibleTiles(36.14, 128.11, 18, 900, 620, "plan", null, 배율);

  for (const t of tiles) {
    assert.equal(t.size, TILE_SIZE * 배율, "타일을 배율만큼 늘려 그려야 한다");
    assert.ok(t.px > -t.size && t.px < 900, `타일이 캔버스 밖이다: px=${t.px}`);
    assert.ok(t.py > -t.size && t.py < 620, `타일이 캔버스 밖이다: py=${t.py}`);
  }
  // 중앙은 여전히 덮인다 — 배율을 올렸는데 빈 캔버스가 나오면 안 된다
  assert.ok(
    tiles.some((t) => t.px <= 450 && 450 < t.px + t.size && t.py <= 310 && 310 < t.py + t.size),
    "중앙을 덮는 타일이 없다",
  );
  // 같은 캔버스가 더 좁은 땅을 보므로 타일 수가 준다
  assert.ok(
    tiles.length < visibleTiles(36.14, 128.11, 18, 900, 620).length,
    "배율을 올렸는데 타일 수가 안 줄었다 — 덮는 땅이 안 좁아진 것이다",
  );
  // 배율 1 은 예전 그대로여야 한다 (저장된 옛 도면)
  assert.deepEqual(
    visibleTiles(36.14, 128.11, 18, 900, 620, "plan", null, 1),
    visibleTiles(36.14, 128.11, 18, 900, 620),
  );
});

test("지도 끌기 — 뷰 배율이 있으면 화면 픽셀이 그만큼 적은 땅이다", () => {
  // 2.5 배로 당겨 본 화면에서 100px 끌면 땅은 40px 만 움직여야 한다
  const before = latLngToWorldPx(36.14, 128.11, 18);
  const moved = panCenter(36.14, 128.11, 18, 100, 0, 2.5);
  const after = latLngToWorldPx(moved.lat, moved.lng, 18);
  assert.ok(Math.abs(after.x - (before.x - 40)) < 0.01, `x 어긋남: ${after.x - before.x}`);
});

test("줌 데려오기 — 배경을 바꿔도 없는 줌에 남지 않는다", () => {
  // 위성 z19 에서 도면(브이월드)으로 바꾸면 z18 로 내려와야 한다
  assert.equal(clampZoom(19, "plan", true), 18);
  // 도면 z6 에서 위성으로 바꾸면 z6 그대로 (위성은 5까지 준다)
  assert.equal(clampZoom(6, "satellite", true), 6);
  // 범위 안이면 건드리지 않는다
  assert.equal(clampZoom(16, "plan", true), 16);
});
