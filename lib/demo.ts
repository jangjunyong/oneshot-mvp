// 시연용 예시 한 벌 — 이력이 비었을 때 화면이 무엇을 하는 물건인지 보여준다.
//
// 왜 코드에 박아 두나. 서버를 새로 띄우면 진단 이력이 0건이라 결과 화면이
// 통째로 비고, 진단서의 근거 3(도면 쏠림)은 도면을 따로 저장해야만 채워진다.
// 그래서 시연·캡처 때마다 사람이 손으로 진단 한 건과 도면 한 건을 만들어야
// 했다. 그 손작업을 여기서 없앤다.
//
// **지어낸 데이터가 아니다.** 강원 횡성군에서 6월에 음악·공연 축제를 새로
// 연다고 가정한 기획안이다. 지역·인구(4.6만)·접근성은 619건에 등록된 횡성군
// 값이고(횡성호수길축제 기록), 테마와 시기는 기획안이 고르는 값이다. 도면은
// lib/preset.ts 의 예시 배치를 그 지역 좌표와 줌 18 축척으로 깐 것이다.
// 그래도 담당자가 자기 진단으로 오해하면 안 되므로 화면에 "시연용 예시"라고
// 적는다 (불문율 4번 — 출처 없는 것을 화면에 올리지 않는다).
//
// ── 앞선 사례를 왜 버렸나 (2026-08-31, 적대적 검증) ──
//
// 처음에는 고령 대가야축제의 **등록값을 그대로** 조건으로 썼다. 그래서
// `findSimilar` 가 그 축제 자신을 쌍둥이 1번으로 집었고(닮음 거리 0.00),
// 감당 범위의 기준도 자기 자신이었다. 같은 화면의 자기검증 블록은
// "맞힐 때 그 축제 자신은 뺐습니다"라고 적혀 있는데, 바로 위에서는 안 뺐다.
// `lib/eval.ts` 가 스스로 금지한 것을 시연 화면이 하고 있었던 셈이다.
//
// 지금 사례는 조건이 619건 어느 축제와도 같지 않다(가장 가까운 쌍둥이도
// 거리 0.15). 그러면서 같은 군·같은 달의 **다른** 축제(횡성호수길축제)가
// 감당 범위의 기준이 된다 — `lib/capacity.ts` 가 말하는 "같은 자리의 실측"
// 이 원래 뜻하던 바로 그것이다.
//
// 이 사례를 고른 이유는 심각 등급·감당 범위·도면 쏠림 셋이 한 화면에서 다
// 뜨면서, 감당 범위 상한이 2.75배로 제품의 존재 이유("왜 물량을 3배로
// 잡았습니까")를 그대로 보여 주기 때문이다. 619건 전수로 조건을 훑어 골랐고,
// 그 셋이 계속 뜨는지는 demo.test.ts 가 매번 다시 잰다.

import type { Entry } from "@/lib/store";
import { coordsOf } from "@/lib/match";
import { presetLayout } from "@/lib/preset";
import { metersPerPixel } from "@/lib/tilemap";
import { emptyVenue, type Venue } from "@/lib/venue";

/**
 * 시연용 진단의 id. 숫자가 아니어야 한다 — 진짜 이력 id 는 BIGSERIAL 이라
 * 언제나 숫자다. 겹치면 담당자의 진단이 시연용으로 둔갑한다.
 */
export const DEMO_ENTRY_ID = "demo";

/** 시연용 도면의 id. 같은 이유로 숫자가 아니다 */
export const DEMO_VENUE_ID = "demo-venue";

/** 화면 어디에서나 같은 말로 표시한다 */
export const DEMO_LABEL = "시연용 예시";

/**
 * 지역값(인구·접근성)의 출처가 되는 619건의 기록(횡성호수길축제).
 * 조건 전체가 이 축제인 것은 **아니다** — 테마와 시기는 기획안이 고른다.
 * 이 축제는 감당 범위의 기준으로도 쓰인다. 테스트가 둘 다 대조한다.
 */
export const DEMO_REGION_FESTIVAL_ID = "3489648";

/**
 * 시각을 고정해 둔다. 지금 시각을 찍으면 새로고침마다 값이 바뀌어
 * 같은 화면을 두 번 캡처할 수 없고, 예시가 방금 낸 진단처럼 보인다.
 */
const DEMO_SAVED_AT = "2026-08-30T06:00:00.000Z";

export const DEMO_ENTRY: Entry = {
  id: DEMO_ENTRY_ID,
  sido: "강원",
  sigungu: "횡성군",
  month: "6",
  // 음악·공연. 횡성군 6월 기록(테마 3 지역 종합)과 다른 값이라 자기 자신을
  // 쌍둥이로 집지 않는다
  theme: "4",
  population: "4.6",
  accessibility: "2",
  savedAt: DEMO_SAVED_AT,
};

/** 도면 화면이 여는 캔버스와 같은 크기 (app/venue/page.tsx) */
const DEMO_CANVAS = { width: 900, height: 620 } as const;

/**
 * 줌 18 — 편집기가 "부지 지도 깔기"에서 쓰는 값이고 브이월드 백지도의
 * 상한이다. 여기서 다른 값을 쓰면 시연 도면만 다른 축척을 갖게 된다.
 */
const DEMO_ZOOM = 18;

/**
 * 시연용 도면. 순수 함수 — 같은 입력에 같은 결과라 캡처가 재현된다.
 *
 * 좌표를 못 찾으면 축척 없는 빈 도면을 돌려준다. 좌표를 지어내면 그 위의
 * 미터가 전부 거짓이 된다.
 */
export function demoVenue(): Venue {
  const base = emptyVenue(DEMO_CANVAS.width, DEMO_CANVAS.height);
  const c = coordsOf(DEMO_ENTRY.sido, DEMO_ENTRY.sigungu);
  if (c === null) return base;

  const mPerPx = metersPerPixel(c.lat, DEMO_ZOOM);
  const 바탕: Venue = {
    ...base,
    mPerPx,
    map: { lat: c.lat, lng: c.lng, zoom: DEMO_ZOOM, style: "plan", view: 1 },
  };
  return { ...바탕, items: presetLayout(바탕, mPerPx) };
}
