// 위성지도 밑그림 수학 테스트.
//
// 여기서 지키는 것은 웹 메르카토르 타일 수학이다 — 이게 틀리면 지도가
// 엉뚱한 곳을 보여주고, 자동 축척(m/px)이 틀리면 M2 의 모든 거리 판정이
// 통째로 틀린다. 자동 축척은 수동 축척 재기를 대체하는 만큼 더 엄하게 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  metersPerPixel,
  panCenter,
  tileUrl,
  latLngToWorldPx,
  visibleTiles,
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
