// 같은 시기 경쟁 테스트.
//
// 네트워크는 여기 없다 — TourAPI 응답을 이미 받았다고 치고, 거르고 잇는
// 규칙만 잰다. 그래야 API 가 죽어도 이 판정은 회귀로 지켜진다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  competitionHeadline,
  competitorsNear,
  dayLabel,
  monthWindow,
  NEARBY_RADIUS_KM,
  type PeriodFestival,
} from "@/lib/overlap";
import { FESTIVALS } from "@/lib/festivals";

const 후보 = (
  over: Partial<PeriodFestival> & Pick<PeriodFestival, "contentId" | "lat" | "lng">,
): PeriodFestival => ({
  title: "어떤 축제",
  addr1: "어딘가",
  startDate: "20261003",
  endDate: "20261005",
  ...over,
});

test("조회 창 — 가장 최근에 지난 그 달을 본다 (미래는 등록이 없다)", () => {
  const 오늘 = new Date(2026, 7, 29); // 2026-08-29

  // 이번 달까지는 올해가 이미 왔다
  assert.deepEqual(monthWindow(8, 오늘), {
    start: "20260801",
    end: "20260831",
    year: 2026,
  });
  assert.deepEqual(monthWindow(5, 오늘), {
    start: "20260501",
    end: "20260531",
    year: 2026,
  });

  // 아직 안 온 10월은 작년 10월이 가장 최근이다.
  // 내년(2027)을 보면 TourAPI 등록이 없어 늘 0건이 된다 — 실측으로 확인한 결함
  assert.deepEqual(monthWindow(10, 오늘), {
    start: "20251001",
    end: "20251031",
    year: 2025,
  });

  // 말일은 달마다 다르다 — 2월은 평년 28일, 윤년 29일
  assert.equal(monthWindow(2, new Date(2026, 5, 1))?.end, "20260228");
  assert.equal(monthWindow(2, new Date(2028, 5, 1))?.end, "20280229");
});

test("달이 아닌 값이면 창을 지어내지 않는다", () => {
  const 오늘 = new Date(2026, 7, 29);

  // Number("") 은 0 이고 new Date(연, 0, 0) 은 조용히 전년 12월 말일이 된다.
  // 그러면 엉뚱한 달의 경쟁 축제가 근거인 척 뜬다 — 못 잰 것이 "안심" 쪽으로
  // 기우는 이 코드베이스의 단골 실수다.
  assert.equal(monthWindow(0, 오늘), null);
  assert.equal(monthWindow(13, 오늘), null);
  assert.equal(monthWindow(-1, 오늘), null);
  assert.equal(monthWindow(Number(""), 오늘), null);
  assert.equal(monthWindow(Number("아무거나"), 오늘), null);
  assert.equal(monthWindow(Infinity, 오늘), null);

  // 경계는 살아 있어야 한다
  assert.ok(monthWindow(1, 오늘));
  assert.ok(monthWindow(12, 오늘));
});

test("반경 밖은 뺀다 — 같은 달이어도 멀면 수요를 나누지 않는다", () => {
  const 서울시청 = { lat: 37.5663, lng: 126.9779 };
  const list = competitorsNear(서울시청, [
    후보({ contentId: "가까움", lat: 37.6, lng: 127.0, title: "가까운 축제" }),
    후보({ contentId: "먼곳", lat: 35.1796, lng: 129.0756, title: "부산 축제" }),
  ]);

  assert.equal(list.length, 1, "부산은 반경 50km 밖이라 빠져야 한다");
  assert.equal(list[0].title, "가까운 축제");
  assert.ok(list[0].distanceKm < NEARBY_RADIUS_KM);
});

test("가까운 순으로 준다", () => {
  const origin = { lat: 37.5, lng: 127.0 };
  const list = competitorsNear(origin, [
    후보({ contentId: "b", lat: 37.7, lng: 127.0, title: "먼 쪽" }),
    후보({ contentId: "a", lat: 37.52, lng: 127.0, title: "가까운 쪽" }),
  ]);
  assert.deepEqual(
    list.map((c) => c.title),
    ["가까운 쪽", "먼 쪽"],
  );
});

test("실측이 있는 축제는 배수를 잇고, 없으면 null — 지어내지 않는다", () => {
  // TourAPI contentid 가 619건의 id 와 같은 체계라 조인이 된다
  const 아는축제 = FESTIVALS[0];
  const origin = { lat: 아는축제.lat, lng: 아는축제.lng };

  const list = competitorsNear(origin, [
    후보({ contentId: 아는축제.id, lat: 아는축제.lat, lng: 아는축제.lng, title: 아는축제.name }),
    후보({ contentId: "없는id_99999", lat: 아는축제.lat, lng: 아는축제.lng, title: "모르는 축제" }),
  ]);

  const 아는것 = list.find((c) => c.contentId === 아는축제.id);
  const 모르는것 = list.find((c) => c.contentId === "없는id_99999");
  assert.equal(아는것?.surge, 아는축제.actualVisitSurge);
  assert.equal(모르는것?.surge, null, "실측이 없으면 null 이어야 한다");
});

test("지역 좌표를 모르면 빈 배열 — 없는 것과 못 잰 것은 다르다", () => {
  const list = competitorsNear(null, [후보({ contentId: "a", lat: 37.5, lng: 127 })]);
  assert.deepEqual(list, [], "좌표가 없으면 거리를 잴 수 없다");
});

test("한 문장 — 등급을 매기지 않고 아는 것까지만 말한다", () => {
  const 없음 = competitionHeadline(2025, 10, []);
  assert.match(없음, /2025년 10월/, "언제를 조회한 것인지 밝혀야 한다");
  assert.match(없음, /50km/);
  assert.match(없음, /없습니다/);

  const 실측없음 = competitionHeadline(2025, 10, [
    { ...후보({ contentId: "a", lat: 0, lng: 0 }), distanceKm: 3, surge: null },
  ]);
  assert.match(실측없음, /1곳/);
  assert.doesNotMatch(실측없음, /배/, "실측이 없으면 배수를 말하면 안 된다");

  const 실측있음 = competitionHeadline(2025, 10, [
    { ...후보({ contentId: "a", lat: 0, lng: 0 }), distanceKm: 3, surge: null },
    { ...후보({ contentId: "b", lat: 0, lng: 0 }), distanceKm: 9, surge: 2.38 },
  ]);
  assert.match(실측있음, /2곳/);
  assert.match(실측있음, /2\.38배/);

  // 지난 실적 조회다. 미래형으로 말하면 예측이 된다 — 이 제품이 하지 않는 것
  assert.doesNotMatch(실측있음, /열립니다|올 것|예상/);

  // 어떤 경우에도 "위험"이라고 판정하지 않는다 — 그건 담당자가 정한다
  for (const s of [없음, 실측없음, 실측있음]) {
    assert.doesNotMatch(s, /위험|안전|심각/);
  }
});

test("날짜 표기 — 형식이 어긋나면 원문을 그대로 둔다", () => {
  assert.equal(dayLabel("20261003"), "10월 3일");
  assert.equal(dayLabel(""), "");
  assert.equal(dayLabel("미정"), "미정");
});
