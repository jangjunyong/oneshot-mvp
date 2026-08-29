// 정적 전수 스캔(M2) 테스트.
//
// 여기서 지키는 계약은 제품의 존재 이유와 같다:
//   1. 절대 인원을 지어내지 않는다 — 나오는 숫자는 전부 "상대 부하 지수"다
//      (쌍둥이 실측 배수 × 수요 몫 ÷ 공급 몫).
//   2. 전수는 수식이 맡는다 — 부스가 몇 개든 밀리초에 다 재고, 위험 상위만
//      추려서 사람에게 보인다. 무거운 재생(M3)은 사람이 고른 것만 한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { queueRect, pointInQueue, scanVenue } from "@/lib/scan";
import type { Venue, VenueItem } from "@/lib/venue";

const 부스 = (
  id: string,
  popularity: number,
  staff: number,
  x = 0,
  y = 0,
  rotation = 0,
): VenueItem => ({
  id,
  kind: "booth",
  x,
  y,
  w: 60,
  h: 40,
  rotation,
  name: id,
  staff,
  popularity,
});

const 도면 = (items: VenueItem[]): Venue => ({
  width: 900,
  height: 620,
  mPerPx: 0.5,
  items,
});

test("부하 지수 — 선호도가 수요 몫, 인력이 공급 몫이 된다", () => {
  // 선호도 4:1, 인력 1:1 → 수요 몫 0.8/0.2, 공급 몫 0.5/0.5
  // 배수 2.0 이면 인기 부스 부하 = 2.0 × 0.8/0.5 = 3.2, 한산 부스 = 0.8
  const r = scanVenue(도면([부스("인기", 4, 1), 부스("한산", 1, 1)]), 2.0);
  const 인기 = r.loads.find((l) => l.id === "인기")!;
  const 한산 = r.loads.find((l) => l.id === "한산")!;
  assert.ok(Math.abs(인기.load - 3.2) < 1e-9, `인기 부하: ${인기.load}`);
  assert.ok(Math.abs(한산.load - 0.8) < 1e-9, `한산 부하: ${한산.load}`);
});

test("인력을 늘리면 그 부스의 부하가 내려간다 — 보완 지시가 성립하는 이유", () => {
  const 전 = scanVenue(도면([부스("a", 4, 1), 부스("b", 1, 1)]), 2.0);
  const 후 = scanVenue(도면([부스("a", 4, 3), 부스("b", 1, 1)]), 2.0);
  assert.ok(
    후.loads.find((l) => l.id === "a")!.load < 전.loads.find((l) => l.id === "a")!.load,
  );
});

test("위험 상위는 부하 내림차순 최대 3곳, 부하 1 이하는 위험이 아니다", () => {
  const r = scanVenue(
    도면([부스("a", 5, 1), 부스("b", 4, 1), 부스("c", 3, 1), 부스("d", 2, 1), 부스("e", 1, 9)]),
    2.0,
  );
  assert.ok(r.top.length <= 3);
  assert.equal(r.top[0], "a", "가장 부하 큰 부스가 첫 번째여야 한다");
  assert.ok(!r.top.includes("e"), "부하 낮은 부스가 위험 상위에 끼었다");
  // 내림차순 확인
  const loads = r.top.map((id) => r.loads.find((l) => l.id === id)!.load);
  for (let i = 1; i < loads.length; i++) assert.ok(loads[i] <= loads[i - 1]);
});

test("대기열 기하 — 부하 1 이하는 대기열이 없고, 초과분만큼 앞으로 자란다", () => {
  const it = 부스("a", 3, 1, 100, 100);
  assert.equal(queueRect(it, 1.0), null, "부하 1.0 은 대기열이 없어야 한다");
  const q = queueRect(it, 2.0)!; // 초과 1.0 → 깊이 = 부스 깊이 × 1.0
  assert.equal(q.depth, 40);
  // 회전 0 이면 대기열은 부스 바로 아래(앞면)에서 시작한다
  assert.ok(pointInQueue(q, { x: 130, y: 141 }), "부스 앞 1px 지점이 대기열 안이어야 한다");
  assert.ok(!pointInQueue(q, { x: 130, y: 90 }), "부스 뒤는 대기열이 아니다");
});

test("대기열 기하 — 회전한 부스의 대기열도 같이 돈다", () => {
  // 90° 회전: 부스의 '앞'(local +h 방향)이 왼쪽(-x)을 향한다
  const it = 부스("a", 3, 1, 300, 300, 90);
  const q = queueRect(it, 2.0)!;
  // 회전 중심은 좌상단 (300,300). local (w/2, h+10) ≈ 앞 10px 지점을
  // 90° 돌리면 대략 (300 - h - 10, 300 + w/2) 부근이다
  assert.ok(pointInQueue(q, { x: 300 - 50, y: 300 + 30 }), "회전한 대기열 위치가 틀렸다");
  assert.ok(!pointInQueue(q, { x: 330, y: 341 }), "안 돌린 위치에 대기열이 남아 있다");
});

test("통로 침범 — 대기열이 통로 위를 덮으면 그 쌍을 지목한다", () => {
  const items: VenueItem[] = [
    부스("혼잡", 4, 1, 100, 100), // 부하 > 1 → 아래로 대기열
    부스("여유", 1, 4, 700, 100),
    { id: "p1", kind: "path", x: 0, y: 0, w: 16, rotation: 0, h: 0, name: "주 통로", points: [0, 160, 900, 160] },
    { id: "p2", kind: "path", x: 0, y: 0, w: 16, rotation: 0, h: 0, name: "먼 통로", points: [0, 600, 900, 600] },
  ];
  const r = scanVenue(도면(items), 2.0);
  assert.ok(
    r.invasions.some((v) => v.boothId === "혼잡" && v.pathId === "p1"),
    "부스 바로 아래 통로 침범을 놓쳤다",
  );
  assert.ok(!r.invasions.some((v) => v.pathId === "p2"), "멀리 있는 통로를 침범이라 했다");
  assert.ok(!r.invasions.some((v) => v.boothId === "여유"), "부하 낮은 부스가 침범을 만들었다");
});

test("축척이 없으면 스캔하지 않고 그 사실을 말한다", () => {
  const v = 도면([부스("a", 3, 1)]);
  v.mPerPx = null;
  const r = scanVenue(v, 2.0);
  assert.equal(r.loads.length, 0);
  assert.match(r.blocked ?? "", /축척/, "왜 못 재는지 한국어로 말해야 한다");
});

test("배수가 없으면(비교 대상 없음) 스캔하지 않고 그 사실을 말한다", () => {
  const r = scanVenue(도면([부스("a", 3, 1)]), null);
  assert.equal(r.loads.length, 0);
  assert.match(r.blocked ?? "", /배수|비교/, "근거 없이 지어내면 안 된다");
});
