// 지도 투영 테스트.
//
// 이 모듈은 **데이터를 모른다**. 619건(festivals.json 199KB)을 import 하는
// 순간 이 파일을 쓰는 모든 곳이 그 무게를 지게 되므로, 순수 좌표 계산만 둔다.
// 그 경계를 테스트가 지킨다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  hasPlace,
  layoutPins,
  MAP_H,
  MAP_W,
  PIN_HEAD_R,
  project,
  pinGroups,
} from "@/lib/mapproj";

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

test("좌표 없는 축제는 지도에 못 올린다 — 바다 한가운데 점을 만들지 않는다", () => {
  // 619건 중 4건이 이렇다: 빈 값이거나 (19.69, 117.99) 같은 기본값.
  // project 는 clamp 하므로 그대로 찍으면 지도 모서리에 없는 축제가 생긴다.
  assert.equal(hasPlace(0, 0), false);
  assert.equal(hasPlace(19.69442748, 117.9925662504), false);
  assert.equal(hasPlace(Number.NaN, 127), false);
  assert.equal(hasPlace(35.1796, 129.0756), true, "부산은 찍을 수 있어야 한다");
  assert.equal(hasPlace(33.4996, 126.5312), true, "제주는 찍을 수 있어야 한다");
});

test("핀 세우기 — 머리가 겹치면 기둥을 늘려 비켜 세운다 (번호가 안 사라진다)", () => {
  // 남해군·하동군. 20km 남짓이라 좌표는 다른데 머리는 포개진다.
  const 핀들 = layoutPins([
    { id: "남해", lat: 34.8375, lng: 127.8925 },
    { id: "하동", lat: 35.0674, lng: 127.7514 },
  ]);
  assert.equal(핀들.length, 2, "다른 자리는 합치지 않는다");

  const 머리 = 핀들.map((p) => ({ x: p.x, y: p.y - p.stem }));
  const 거리 = Math.hypot(머리[0].x - 머리[1].x, 머리[0].y - 머리[1].y);
  assert.ok(
    거리 >= PIN_HEAD_R * 2,
    `머리가 겹친다 (${거리.toFixed(1)}px) — 번호 하나가 가려진다`,
  );

  // 발은 실측 그대로다. 비켜 세우느라 위치를 옮기면 지도가 거짓말한다
  const 발 = layoutPins([{ id: "남해", lat: 34.8375, lng: 127.8925 }])[0];
  assert.equal(핀들.find((p) => p.ids[0] === "남해")?.x, 발.x);
});

test("핀 세우기 — 순번은 밖에서 준 것을 그대로 쓴다", () => {
  // 좌표 없는 2번을 걸러내도 목록의 3번은 지도에서도 3번이어야 한다
  const 핀들 = layoutPins([
    { id: "a", lat: 36, lng: 128, num: 1 },
    { id: "c", lat: 37.5, lng: 127, num: 3 },
  ]);
  assert.deepEqual(
    핀들.map((p) => p.nums).flat().sort(),
    [1, 3],
  );
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
