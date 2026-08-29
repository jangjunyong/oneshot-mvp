// 해안선 데이터 검사.
//
// 이 선은 화면에서 유일하게 "우리가 잰 것이 아닌" 선이다. 그래서 출처가
// 데이터 안에 있어야 하고, 지도 범위 안에 들어와야 하고, 사용자가 이름을
// 부른 섬들이 실제로 들어 있어야 한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { COAST_RINGS, COAST_SOURCE } from "@/lib/coastline";
import { hasPlace, MAP_H, MAP_W, project } from "@/lib/mapproj";

test("해안선 — 출처가 데이터에 박혀 있다", () => {
  assert.match(COAST_SOURCE, /Natural Earth/);
  assert.match(COAST_SOURCE, /public domain/);
});

test("해안선 — 링이 닫힌 다각형이고 점이 지도 안에 들어온다", () => {
  assert.ok(COAST_RINGS.length > 20, `링이 너무 적다: ${COAST_RINGS.length}`);

  for (const ring of COAST_RINGS) {
    assert.ok(ring.length >= 3, "점 3개 미만은 다각형이 아니다");
    for (const c of ring) {
      const p = project(c[1], c[0]);
      assert.ok(p.x >= 0 && p.x <= MAP_W, `x 가 지도 밖: ${p.x}`);
      assert.ok(p.y >= 0 && p.y <= MAP_H, `y 가 지도 밖: ${p.y}`);
    }
  }
});

test("해안선 — 국토가 잘리지 않는다 (clamp 로 눌린 점이 없다)", () => {
  // project 는 범위 밖을 지도 가장자리로 눌러 넣는다. 해안선이 눌리면
  // 섬 하나가 테두리에 납작하게 붙어 없는 해안이 생긴다.
  for (const ring of COAST_RINGS) {
    for (const c of ring) {
      assert.ok(
        hasPlace(c[1], c[0]),
        `지도 범위 밖 해안선 점: ${c[0]}, ${c[1]} — 지도 범위를 넓혀야 한다`,
      );
    }
  }
});

test("해안선 — 제주도·울릉도·독도·백령도가 들어 있다", () => {
  const 있나 = (w: number, e: number, s: number, n: number) =>
    COAST_RINGS.some((r) =>
      r.every((c) => c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n),
    );

  assert.ok(있나(126.0, 127.1, 33.0, 33.7), "제주도가 없다");
  assert.ok(있나(130.7, 131.1, 37.3, 37.7), "울릉도가 없다");
  assert.ok(있나(131.5, 132.0, 37.1, 37.4), "독도가 없다");
  assert.ok(있나(124.5, 125.0, 37.8, 38.1), "백령도가 없다");
});

test("해안선 — 화면에 실어 나를 만한 크기다", () => {
  // 서버 렌더 HTML 과 RSC 페이로드에 두 번 실린다. 점이 늘면 매 요청이 무거워진다.
  const 점 = COAST_RINGS.reduce((s, r) => s + r.length, 0);
  assert.ok(점 <= 1500, `점이 너무 많다: ${점} — 더 단순화해야 한다`);
});
