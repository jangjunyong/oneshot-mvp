// 닮은 축제 찾기 테스트 — 정상 입력만 다룬다.
//
// 정답 라벨(01)은 추측이 아니라 619건 실측 데이터를 실제로 돌려서 나온 값이다.
// 가중치나 임계값을 바꾸면 여기가 먼저 깨져야 한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { coordsOf, findSimilar } from "@/lib/match";
import { hasPlace } from "@/lib/mapproj";
import { FESTIVALS, monthOf } from "@/lib/festivals";
import { DISTANCE_THRESHOLD, type AxisKey, type PlanInput } from "@/lib/types";

/** 김천김밥축제 1회 조건 — PRD 성공 판정에 쓰는 그 입력 */
const 김천: PlanInput = {
  sido: "경북",
  sigungu: "김천시",
  month: 10,
  themeCode: 1,
  populationManMyeong: 14,
  accessibility: 2,
};

test("김천 조건에서 닮은 축제 3개가 나온다", () => {
  const r = findSimilar(김천);
  assert.equal(r.matched.length, 3);

  const 이름 = r.matched.map((m) => m.festival.name);
  assert.deepEqual(이름.toSorted(), [
    "예산사과축제",
    "예산장터 삼국축제",
    "홍천 사과축제",
  ]);
});

test("같은 입력을 두 번 넣으면 같은 결과가 나온다", () => {
  const a = findSimilar(김천).matched.map((m) => m.festival.id);
  const b = findSimilar(김천).matched.map((m) => m.festival.id);
  assert.deepEqual(a, b);
});

test("거리 오름차순으로 정렬된다 — 가장 닮은 것이 먼저", () => {
  const 거리 = findSimilar(김천).matched.map((m) => m.distance);
  assert.deepEqual(거리, [...거리].sort((x, y) => x - y));
});

test("왜 닮았는지를 축별로 낸다 (암묵지 2)", () => {
  for (const m of findSimilar(김천).matched) {
    const 축: AxisKey[] = m.axes.map((a) => a.axis);
    const 필요 = ["accessibility", "population", "month", "theme"] as const;
    for (const 필요한축 of 필요) {
      assert.ok(축.includes(필요한축), `${m.festival.name} 에 ${필요한축} 축이 없다`);
    }
    // 화면에 그대로 나가는 문장이라 비어 있으면 안 된다
    for (const a of m.axes) {
      assert.ok(a.label.length > 0, "축 이름이 비었다");
      assert.ok(a.detail.length > 0, `${a.label} 의 설명이 비었다`);
    }
  }
});

test("정상 입력에서 거리가 NaN 이 되지 않는다", () => {
  const r = findSimilar(김천);
  for (const m of r.matched) {
    assert.ok(Number.isFinite(m.distance), `${m.festival.name} 거리가 ${m.distance}`);
    for (const a of m.axes) {
      assert.ok(Number.isFinite(a.distance), `${a.label} 축 거리가 ${a.distance}`);
    }
  }
});

test("limit 을 주면 그 개수만 나온다", () => {
  assert.equal(findSimilar(김천, 1).matched.length, 1);
  assert.equal(findSimilar(김천, 5).matched.length <= 5, true);
});

test("찾아본 범위를 항상 함께 낸다 — 못 찾았을 때 화면에 쓴다", () => {
  const r = findSimilar(김천);
  assert.match(r.searchedScope, /619/);
});

test("전례 없는 조건에는 3개를 지어내지 않고 '없음'을 낸다 (암묵지 3)", () => {
  // PLAN 완료 조건의 그 케이스 — 7월 · 청년 테마 · 인구 0.5만 · 접근성 최악.
  // 619건 어디에도 이런 조합이 없다. 억지로 가장 가까운 걸 내놓으면 안 된다.
  const r = findSimilar({
    sido: "강원",
    sigungu: "양구군",
    month: 7,
    themeCode: 7,
    populationManMyeong: 0.5,
    accessibility: 1,
  });
  assert.equal(r.invalid, undefined, "입력 오류가 아니라 전례 없음이어야 한다");
  assert.equal(r.matched.length, 0, "전례 없는 조건인데 닮은 축제를 내놓았다");
});

test("임계값은 실측이 보증하는 범위에 붙어 있다", () => {
  // 619건을 하나씩 빼고 재면(leave-one-out) 진짜 축제의 3번째 이웃 거리는
  // 어떤 경우에도 이 최댓값 안에 든다. 임계값이 이보다 크게 느슨하면
  // 실측이 보증하지 않는 어중간한 입력에도 "닮았다"고 말하게 된다.
  let 최대 = 0;
  for (const f of FESTIVALS) {
    const r = findSimilar(
      {
        sido: f.sido,
        sigungu: f.sigungu,
        month: monthOf(f),
        themeCode: f.themeCode,
        populationManMyeong: f.populationManMyeong,
        accessibility: f.accessibility,
      },
      4, // 자기 자신(거리 0) 포함 4개
    );
    const 이웃 = r.matched.filter((m) => m.festival.id !== f.id).slice(0, 3);
    assert.equal(이웃.length, 3, `${f.name} 이 임계값에 잘려 3개를 못 채웠다`);
    최대 = Math.max(최대, 이웃[2].distance);
  }
  assert.ok(
    최대 <= DISTANCE_THRESHOLD,
    `실측 최대 ${최대.toFixed(4)} 가 임계값을 넘는다 — 진짜 축제가 잘린다`,
  );
  assert.ok(
    DISTANCE_THRESHOLD <= 최대 + 0.01,
    `임계값 ${DISTANCE_THRESHOLD} 가 실측 최대 ${최대.toFixed(4)} 보다 크게 느슨하다`,
  );
});

// ─────────────────────────────────────────────────────────────
// 좌표 위생 — 재는 자와 그리는 자가 같아야 한다
// ─────────────────────────────────────────────────────────────

test("coordsOf 는 쓸 수 없는 좌표를 원점으로 돌려주지 않는다", () => {
  // 619건 중 4건은 좌표가 비었거나 (19.69, 117.99) 기본값이 박혀 있다.
  // 지도는 hasPlace 로 막고 있었는데 재는 쪽은 안 막아서, 서울 동작구로
  // 진단하면 null 이 0 으로 읽혀 기니만 앞바다가 원점이 되고 화면에
  // "직선거리 13317km" 가 근거인 척 떴다.
  const 시군구 = [...new Set(FESTIVALS.map((f) => `${f.sido}|${f.sigungu}`))];

  for (const p of 시군구) {
    const [sido, sigungu] = p.split("|");
    const c = coordsOf(sido, sigungu);
    if (c === null) continue; // 좌표를 못 찾으면 null 이 정답이다
    assert.ok(
      hasPlace(c.lat, c.lng),
      `${sido} ${sigungu} 의 원점이 한국 밖이다 (${c.lat}, ${c.lng})`,
    );
  }
});

test("지역 축 거리는 한반도 안의 값이다 — 지구 반대편이 근거로 나가지 않는다", () => {
  // 원점이든 상대든 한쪽이라도 좌표가 쓰레기면 수천 km 가 나온다.
  // 남한은 대각선이 500km 안쪽이다.
  const 한반도최대 = 600;
  let 최대 = 0;
  let 최대설명 = "";

  for (const f of FESTIVALS) {
    const r = findSimilar({
      sido: f.sido,
      sigungu: f.sigungu,
      month: monthOf(f),
      themeCode: f.themeCode,
      populationManMyeong: f.populationManMyeong,
      accessibility: f.accessibility,
    });
    for (const m of r.matched) {
      const 지역 = m.axes.find((a) => a.axis === "region");
      if (!지역) continue; // 좌표가 없으면 축 자체가 빠진다 — 그게 정답이다
      const km = Number((지역.detail.match(/([\d.]+)km/) ?? [])[1] ?? 0);
      if (km > 최대) {
        최대 = km;
        최대설명 = `${f.sido} ${f.sigungu} → ${m.festival.sido} ${m.festival.sigungu}`;
      }
    }
  }

  assert.ok(
    최대 <= 한반도최대,
    `직선거리 ${최대}km 가 화면에 나간다 (${최대설명}) — 좌표가 쓰레기다`,
  );
});

test("서울 동작구·경기 양주시 회귀 — 좌표 기본값이 박힌 시군구", () => {
  // 이 둘이 정확히 13317km · 2268km 를 냈다. 지목해서 잠근다.
  for (const [sido, sigungu] of [
    ["서울", "동작구"],
    ["경기", "양주시"],
  ] as const) {
    const c = coordsOf(sido, sigungu);
    assert.ok(c, `${sido} ${sigungu} 의 좌표를 못 찾는다`);
    assert.ok(
      hasPlace(c!.lat, c!.lng),
      `${sido} ${sigungu} 가 다시 한국 밖을 가리킨다`,
    );
  }
});
