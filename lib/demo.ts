// 시연용 예시 한 벌 — 이력이 비었을 때 화면이 무엇을 하는 물건인지 보여준다.
//
// 왜 코드에 박아 두나. 서버를 새로 띄우면 진단 이력이 0건이라 결과 화면이
// 통째로 비고, 진단서의 근거 3(도면 쏠림)은 도면을 따로 저장해야만 채워진다.
// 그래서 시연·캡처 때마다 사람이 손으로 진단 한 건과 도면 한 건을 만들어야
// 했다. 그 손작업을 여기서 없앤다.
//
// **지어낸 데이터가 아니다.** 조건은 619건에 실제로 있는 고령 대가야축제의
// 등록값 그대로이고(경북 고령군·3월·테마 3·인구 3만·접근성 2등급), 도면은
// lib/preset.ts 의 예시 배치를 그 지역 좌표와 줌 18 축척으로 깐 것이다.
// 그래도 담당자가 자기 진단으로 오해하면 안 되므로 화면에 "시연용 예시"라고
// 적는다 (불문율 4번 — 출처 없는 것을 화면에 올리지 않는다).
//
// 이 사례를 고른 이유는 심각 등급·감당 범위·도면 쏠림 셋이 한 화면에서 다
// 뜨는 조합이기 때문이다. 그 셋이 계속 뜨는지는 demo.test.ts 가 매번 잰다.

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

/** 조건의 출처가 되는 619건의 축제(고령 대가야축제). 테스트가 대조한다 */
export const DEMO_FESTIVAL_ID = "2667017";

/**
 * 시각을 고정해 둔다. 지금 시각을 찍으면 새로고침마다 값이 바뀌어
 * 같은 화면을 두 번 캡처할 수 없고, 예시가 방금 낸 진단처럼 보인다.
 */
const DEMO_SAVED_AT = "2026-08-30T06:00:00.000Z";

export const DEMO_ENTRY: Entry = {
  id: DEMO_ENTRY_ID,
  sido: "경북",
  sigungu: "고령군",
  month: "3",
  theme: "3",
  population: "3",
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
