// 시연용 예시 한 벌 테스트.
//
// 여기서 지키는 것은 두 가지다.
//   1) 예시가 **지어낸 값이 아니라는 것** — 조건은 619건에 있는 등록값 그대로다
//   2) 예시가 **시연이 보여 주려던 것을 실제로 보여 준다는 것** — 심각 등급,
//      감당 범위, 도면 쏠림 셋이 다 뜨는 조합이라서 고른 사례다
//
// 둘 중 하나가 깨지면 시연 자리에서야 안다. 그래서 테스트가 매번 다시 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEMO_ENTRY,
  DEMO_ENTRY_ID,
  DEMO_REGION_FESTIVAL_ID,
  DEMO_VENUE_ID,
  demoVenue,
} from "@/lib/demo";
import { FESTIVALS } from "@/lib/festivals";
import { coordsOf, findSimilar } from "@/lib/match";
import { grade } from "@/lib/grade";
import { capacityBand, localBaseline } from "@/lib/capacity";
import { scanVenue } from "@/lib/scan";
import { polygonAreaM2, siteOf, validateVenue } from "@/lib/venue";
import { planInputOf } from "@/lib/types";

const 입력 = planInputOf(DEMO_ENTRY);

test("시연 조건의 지역값은 619건에서 온다 — 지어낸 값이 아니다", () => {
  const f = FESTIVALS.find((x) => x.id === DEMO_REGION_FESTIVAL_ID);
  assert.ok(
    f,
    `619건에 ${DEMO_REGION_FESTIVAL_ID} 가 없다 — 시연 사례가 근거를 잃었다`,
  );

  // 지역·인구·접근성은 그 지역의 실측이다
  assert.equal(입력.sido, f!.sido);
  assert.equal(입력.sigungu, f!.sigungu);
  assert.equal(입력.populationManMyeong, f!.populationManMyeong);
  assert.equal(입력.accessibility, f!.accessibility);
  // 시기가 같아야 감당 범위의 기준이 잡힌다
  assert.equal(입력.month, Number(f!.eventStartDate.slice(4, 6)));
  // 테마는 기획안이 고르는 값이다. **달라야** 자기 자신을 안 집는다
  assert.notEqual(입력.themeCode, f!.themeCode, "조건이 그 축제와 똑같아졌다");
});

test("시연 id 는 숫자가 아니다 — 실제 이력 id 와 겹치지 않는다", () => {
  // 진짜 이력 id 는 BIGSERIAL 이라 언제나 숫자다. 겹치면 담당자의 진단이
  // 시연용 예시로 둔갑하거나 그 반대가 된다.
  assert.doesNotMatch(DEMO_ENTRY_ID, /^\d+$/);
  assert.doesNotMatch(DEMO_VENUE_ID, /^\d+$/);
  assert.notEqual(DEMO_ENTRY_ID, DEMO_VENUE_ID);
});

test("시연 진단은 심각 등급과 감당 범위를 낸다", () => {
  const r = findSimilar(입력);
  assert.equal(r.invalid, undefined, "시연 조건이 입력 검증에 걸린다");

  const g = grade(r);
  assert.equal(g.level, "심각", "시연에서 보여 주려던 경보 등급이 아니다");

  // 감당 범위는 같은 시군구·같은 달의 실측을 못 찾으면 기준 없이 나온다.
  // 시연에서는 기준까지 있는 화면을 보여 주려던 것이었다. 기준은 같은 군
  // 같은 달의 **다른** 축제여야 한다 — 그게 lib/capacity.ts 가 말하는
  // "같은 자리의 실측"의 원래 뜻이다.
  //
  // **주의** — 아래 단언들은 계약이 아니라 알림이다. 619건이 갱신되거나
  // 가중치가 바뀌어 깨지면, 고칠 것은 이 테스트가 아니라 **시연 사례**다.
  const 기준 = localBaseline(
    { sido: 입력.sido, sigungu: 입력.sigungu, month: 입력.month },
    r.matched,
  );
  assert.ok(기준, "같은 시군구·같은 달 기준을 못 찾았다");

  const 범위 = capacityBand(
    g,
    r.matched.map((m) => m.festival.actualVisitSurge),
    기준!.surge,
  );
  assert.ok(범위, "감당 범위가 안 뜬다");
  assert.ok(범위!.baseSurge !== null, "기준 없이 나왔다");
  assert.equal(
    기준!.id,
    DEMO_REGION_FESTIVAL_ID,
    "기준이 같은 군·같은 달의 그 축제가 아니다",
  );
  // 상한이 1 에 붙으면 화면이 "최대 1.00배까지"라고 말해 아무 뜻이 없다
  assert.ok(범위!.hi! > 1.5, `상한 ${범위!.hi} 로는 시연이 아무 말도 못 한다`);
});

test("시연이 자기 자신을 쌍둥이로 집지 않는다", () => {
  // 이 파일에서 제일 중요한 단언이다.
  //
  // 앞선 시연 사례는 619건에 있는 축제의 등록값 그대로여서 `findSimilar` 가
  // 그 축제 자신을 거리 0.00 으로 집었다. 같은 화면의 자기검증 블록은
  // "맞힐 때 그 축제 자신은 뺐습니다"라고 적혀 있는데 바로 위에서는 안 뺀
  // 셈이었다 — `lib/eval.ts` 머리말이 금지한 바로 그것이다.
  const r = findSimilar(입력);
  for (const m of r.matched) {
    assert.ok(
      m.distance > 0.01,
      `${m.festival.name} 이 거리 ${m.distance.toFixed(4)} 로 사실상 자기 자신이다`,
    );
  }
});

test("시연 도면은 그대로 저장해도 통과하고 축척과 부지가 있다", () => {
  const v = demoVenue();
  assert.deepEqual(validateVenue(v), []);

  assert.ok(v.mPerPx !== null && v.mPerPx > 0, "축척이 없다");
  const site = siteOf(v);
  assert.ok(site?.points, "부지 경계가 없다");
  assert.ok(polygonAreaM2(site!.points!, v.mPerPx)! > 0, "부지 면적이 0 이다");
});

test("시연 도면의 좌표는 그 지역 좌표에서 온다", () => {
  const c = coordsOf(DEMO_ENTRY.sido, DEMO_ENTRY.sigungu);
  assert.ok(c, "그 지역 좌표를 못 찾았다");

  const v = demoVenue();
  assert.ok(v.map, "배경 지도가 없다 — 축척의 출처가 사라진다");
  assert.equal(v.map!.lat, c!.lat);
  assert.equal(v.map!.lng, c!.lng);
});

test("시연 도면을 스캔하면 진단서 근거 3이 채워진다", () => {
  const g = grade(findSimilar(입력));
  const scan = scanVenue(demoVenue(), g.medianSurge);

  assert.equal(scan.blocked, undefined, `스캔이 막혔다: ${scan.blocked}`);
  assert.ok(scan.top.length > 0, "쏠림이 하나도 안 잡힌다 — 보여 줄 게 없다");
  assert.ok(scan.siteAreaM2! > 0, "부지 면적이 안 나온다");
});

test("같은 입력에 같은 도면 — 시연 때마다 다른 그림이 나오지 않는다", () => {
  assert.deepEqual(demoVenue(), demoVenue());
});
