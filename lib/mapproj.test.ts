// 지도 투영 테스트.
//
// 이 모듈은 **데이터를 모른다**. 619건(festivals.json 199KB)을 import 하는
// 순간 이 파일을 쓰는 모든 곳이 그 무게를 지게 되므로, 순수 좌표 계산만 둔다.
// 그 경계를 테스트가 지킨다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MAP_H, MAP_W, project, pinGroups } from "@/lib/mapproj";

test("투영 — 남서쪽일수록 x 작고 y 크다 (화면 좌표)", () => {
  const 서울 = project(37.5665, 126.978);
  const 부산 = project(35.1796, 129.0756);
  assert.ok(부산.x > 서울.x, "부산이 서울보다 동쪽이므로 x 가 커야 한다");
  assert.ok(부산.y > 서울.y, "부산이 서울보다 남쪽이므로 y 가 커야 한다(화면 좌표)");
});

test("투영 — 결과가 항상 지도 안에 있다 (극단값도 잘려서 들어온다)", () => {
  for (const [lat, lng] of [
    [33.1, 126.3], // 제주 남단
    [38.5, 128.3], // 최북단
    [20, 100], // 범위 밖
    [50, 145], // 범위 밖
  ] as const) {
    const p = project(lat, lng);
    assert.ok(p.x >= 0 && p.x <= MAP_W, `x 가 지도 밖: ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= MAP_H, `y 가 지도 밖: ${p.y}`);
  }
});

test("투영 — 같은 입력은 항상 같은 출력 (결정론)", () => {
  assert.deepEqual(project(36.1, 128.1), project(36.1, 128.1));
});

test("핀 묶기 — 같은 자리에 겹치면 한 핀으로 합쳐 번호를 나열한다", () => {
  // 예산군에서 두 축제가 잡히는 실제 상황: 좌표가 같아 마커가 포개진다
  const groups = pinGroups([
    { id: "a", lat: 36.68, lng: 126.85 },
    { id: "b", lat: 36.68, lng: 126.85 },
    { id: "c", lat: 37.69, lng: 127.88 },
  ]);
  assert.equal(groups.length, 2, "겹친 둘은 한 핀이어야 한다");
  assert.deepEqual(groups[0].nums, [1, 2]);
  assert.deepEqual(groups[0].ids, ["a", "b"]);
  assert.deepEqual(groups[1].nums, [3]);
});

test("핀 묶기 — 빈 입력은 빈 배열 (핀 개수를 지어내지 않는다)", () => {
  // findSimilar 는 0~3 건을 돌려준다. 3 을 상수로 가정하면 안 된다.
  assert.deepEqual(pinGroups([]), []);
  assert.equal(pinGroups([{ id: "a", lat: 36, lng: 128 }]).length, 1);
});

test("경계 — mapproj 는 축제 데이터나 매칭 로직을 import 하지 않는다", () => {
  // 이 어서션이 깨지면 클라이언트 번들에 199KB 가 딸려 들어갈 길이 열린 것이다.
  // 주석에 이름이 나오는 건 괜찮다 — 실제로 끌어오는 import 만 본다.
  const src = readFileSync(new URL("./mapproj.ts", import.meta.url), "utf8");
  const imports = src
    .split("\n")
    .filter((l) => /^\s*(import|export)\s.*\sfrom\s/.test(l) || /\brequire\(/.test(l));
  for (const line of imports) {
    assert.doesNotMatch(line, /festivals|match|\.json/, `데이터를 끌어온다: ${line}`);
  }
});
