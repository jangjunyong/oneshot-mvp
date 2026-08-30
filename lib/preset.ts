// 예시 배치 — 빈 캔버스 대신 만져 볼 것을 준다.
//
// 사용자 지적(2026-08-30): "사용자가 도면 세팅하기 어려워하는 것 같은데
// 기본 도면이라도 주든지."
//
// 맞는 지적이었다. 지금까지 첫 화면은 **빈 캔버스**였고, 담당자는 축척을
// 재고 부지 경계를 찍고 부스를 하나씩 놓아야 쏠림 스캔을 한 번 볼 수 있었다.
// 그 사이에 아무 피드백이 없다. 그래서 지도를 깔면 예시가 같이 깔린다 —
// 담당자는 지우거나 옮기면서 시작한다.
//
// **예시도 실측이다.** 대충 그린 그림을 깔면 담당자가 그 위에서 재고, 그
// 순간 거짓 치수가 근거인 척한다(불문율 4번). 그래서 크기는 전부
// KIND_SIZE_M 에서 나오고, 부지 면적도 선언한 값과 맞는지 테스트가 지킨다.
//
// 부스 인력·선호도를 일부러 고르지 않게 뒀다. 다 같으면 쏠림 스캔이 아무
// 말도 안 하고, 그러면 담당자는 이 기능이 뭘 하는지 못 본다.

import { KIND_SIZE_M, VENUE_KIND_NAME, type Venue, type VenueItem } from "@/lib/venue";

/**
 * 예시 부지 크기(m). 200×140m 는 시군 단위 축제장의 흔한 규모다
 * (대가야박물관 앞 개활지 실측이 271×167m 였다). 정한 값이라 화면에 밝힌다.
 */
export const PRESET_SITE_M = { w: 200, h: 140 } as const;

/** 통로 폭(m) — 해운대 모래축제 과업내용서의 관람데크 최소 2m 보다 넉넉히 */
const PATH_W_M = 8;

/**
 * 캔버스 한가운데에 실측 예시 배치를 만든다.
 *
 * 축척이 없으면 빈 배열 — 미터를 모르면 예시도 거짓말이다.
 * id 는 고정 문자열이라 같은 입력에 같은 결과가 나온다(순수).
 */
export function presetLayout(
  canvas: Pick<Venue, "width" | "height">,
  mPerPx: number | null,
): VenueItem[] {
  if (mPerPx === null || !(mPerPx > 0)) return [];

  const px = (m: number) => m / mPerPx;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const 부지w = px(PRESET_SITE_M.w);
  const 부지h = px(PRESET_SITE_M.h);
  const L = cx - 부지w / 2;
  const T = cy - 부지h / 2;
  const R = L + 부지w;
  const B = T + 부지h;

  const 상자 = (
    id: string,
    kind: keyof typeof KIND_SIZE_M,
    name: string,
    xM: number,
    yM: number,
    extra: Partial<VenueItem> = {},
  ): VenueItem => {
    const [wM, hM] = KIND_SIZE_M[kind];
    return {
      id,
      kind,
      x: L + px(xM),
      y: T + px(yM),
      w: px(wM),
      h: px(hM),
      rotation: 0,
      name,
      ...extra,
    };
  };

  // 부스 8개를 통로 양옆 두 줄로. 인력·선호도를 일부러 고르지 않게 둔다 —
  // 다 같으면 쏠림 스캔이 아무 말도 안 한다.
  const 부스설정: [number, number][] = [
    [2, 3], [2, 3], [1, 5], [2, 4],   // 위 줄 — 세 번째가 인력 1·선호 5 (쏠림 후보)
    [2, 3], [2, 5], [2, 3], [2, 3],   // 아래 줄 — 두 번째가 선호 5
  ];
  const 부스 = 부스설정.map(([staff, popularity], i) => {
    const 줄 = i < 4 ? 0 : 1;
    const 칸 = i % 4;
    return 상자(
      `preset-booth-${i}`,
      "booth",
      `${VENUE_KIND_NAME.booth} ${i + 1}`,
      60 + 칸 * 20,
      줄 === 0 ? 45 : 78,
      { staff, popularity },
    );
  });

  return [
    {
      id: "preset-site",
      kind: "site",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      rotation: 0,
      name: VENUE_KIND_NAME.site,
      points: [L, T, R, T, R, B, L, B],
    },
    상자("preset-stage", "stage", `${VENUE_KIND_NAME.stage} (주무대)`, 90, 12),
    ...부스,
    상자("preset-toilet-1", "toilet", `${VENUE_KIND_NAME.toilet} 1`, 20, 30),
    상자("preset-toilet-2", "toilet", `${VENUE_KIND_NAME.toilet} 2`, 170, 30),
    상자("preset-gate-1", "gate", `${VENUE_KIND_NAME.gate} (정문)`, 8, 66),
    상자("preset-gate-2", "gate", `${VENUE_KIND_NAME.gate} (후문)`, 186, 66),
    상자("preset-parking", "parking", VENUE_KIND_NAME.parking, 20, 105),
    {
      // 부스 두 줄 사이를 지나는 주 동선. 여기가 대기열에 덮이는지를 잰다
      id: "preset-path",
      kind: "path",
      x: 0,
      y: 0,
      w: px(PATH_W_M),
      h: 0,
      rotation: 0,
      name: `${VENUE_KIND_NAME.path} (주 동선)`,
      points: [L + px(15), T + px(68), R - px(15), T + px(68)],
    },
  ];
}
