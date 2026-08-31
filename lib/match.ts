import {
  DISTANCE_THRESHOLD,
  THEME_NAME,
  type AxisSimilarity,
  type Festival,
  type MatchResult,
  type MatchedFestival,
  type PlanInput,
} from "@/lib/types";
import { FESTIVALS, SEARCHED_SCOPE, monthOf, yearOf } from "@/lib/festivals";
// 지도가 "찍어도 되는 좌표인가"를 판정하는 술어를 그대로 가져다 쓴다.
// 재는 자와 그리는 자가 갈리면 화면의 거리와 지도의 핀이 서로를 반박한다.
// (mapproj 는 아무것도 import 하지 않으므로 순환은 생기지 않는다)
import { hasPlace } from "@/lib/mapproj";

export type AxisWeight = Record<AxisSimilarity["axis"], number>;

/**
 * 축별 가중치. 합이 1 이어야 한다 — 임계값(DISTANCE_THRESHOLD)의 의미가
 * 가중 평균의 스케일에 묶여 있기 때문이다.
 *
 * 처음엔 619건 전수로 각 특징과 actualVisitSurge 의 **상관**을 재서 정했다
 * (접근성 -0.51 · log(인구) -0.49 가 가장 셌고, 축제 기간은 -0.17 로 노이즈라 뺐다).
 *
 * 2026-08-30 재보정 — 테마 0.10 → **0.15**. 상관이 아니라 **적중률**로 다시 골랐다.
 * 상관은 "그 축이 배수의 크기를 설명하는가"를 재는데, 정작 우리가 원하는 건
 * "그 축이 닮은 축제를 잘 고르는가"다. 둘은 다르다. 그래서 leave-one-out 을
 * 가중치별로 돌려 직접 비교했다(evals — 사용자 지적: "테마가 달라도 통과하는 건 문제").
 *
 *   테마 0.10 (옛)  정밀도 56.8% · 재현율 54.1% · 리프트 2.41 · 중앙오차 0.130
 *   테마 0.15 (지금) 정밀도 60.2% · 재현율 54.8% · 리프트 2.55 · 중앙오차 0.120  ← 전 지표 우세
 *   테마 0.30 (필수) 정밀도 58.0% · 재현율 52.1% · 리프트 2.46
 *
 * **테마를 필수로 만들면 오히려 나빠진다.** 임계값 0.27 보다 큰 가중치를 주면
 * 테마 하나가 다르다는 이유로 탈락시키게 되고, 그러면 진짜 닮은 축제까지
 * 버린다(재현율 54.8% → 52.1%). 적당히 올리는 게 맞다.
 */
export const WEIGHT: AxisWeight = {
  accessibility: 0.28,
  population: 0.28,
  region: 0.19,
  month: 0.1,
  theme: 0.15,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 지구 위 두 점 사이 km. 같은 시기 경쟁(overlap.ts)도 이 자를 쓴다 —
 *  진단이 재는 거리와 화면이 말하는 거리가 다르면 안 된다 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 12월과 1월은 한 달 차이다 */
function monthDistance(m1: number, m2: number): number {
  const d = Math.abs(m1 - m2);
  return Math.min(d, 12 - d) / 6;
}

/**
 * 입력 지역의 좌표. 같은 시군구를 먼저 찾고 없으면 같은 시도의 첫 건을 쓴다.
 * 둘 다 없으면 null 을 돌려주고 지역 축을 아예 빼고 잰다. 좌표를 지어내지 않는다.
 * (지도(app/twin-map.tsx)도 같은 좌표를 쓴다 — 재는 자와 그리는 자가 같아야 한다)
 *
 * **쓸 수 있는 좌표만 고른다.** 619건 중 4건은 좌표가 비었거나
 * (19.69, 117.99) 같은 기본값이 박혀 있다(`mapproj.ts` 머리말). 지도는 그걸
 * `hasPlace` 로 막고 있었는데 여기서는 안 막아서, `서울 동작구` 로 진단하면
 * `null` 이 0 으로 읽혀 기니만 앞바다가 원점이 되고 화면에 **"직선거리
 * 13317km"** 가 근거인 척 떴다(`경기 양주시` 는 2268km). 위 주석이 약속한
 * "재는 자와 그리는 자가 같아야 한다"를 술어를 공유해서 지킨다.
 */
export function coordsOf(
  sido: string,
  sigungu: string,
): { lat: number; lng: number } | null {
  const 쓸만한 = (f: Festival) => hasPlace(f.lat, f.lng);
  const hit =
    FESTIVALS.find((f) => f.sido === sido && f.sigungu === sigungu && 쓸만한(f)) ??
    FESTIVALS.find((f) => f.sido === sido && 쓸만한(f));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

const themeLabel = (code: number) => THEME_NAME[code] ?? `코드 ${code}`;

function axesFor(
  input: PlanInput,
  f: Festival,
  origin: { lat: number; lng: number } | null,
): AxisSimilarity[] {
  const axes: AxisSimilarity[] = [];

  axes.push({
    axis: "accessibility",
    label: "접근성",
    distance: clamp01(Math.abs(input.accessibility - f.accessibility) / 4),
    detail:
      input.accessibility === f.accessibility
        ? `둘 다 ${f.accessibility}등급`
        : `${input.accessibility}등급 vs ${f.accessibility}등급`,
  });

  // 0 이하가 들어오면 log 가 발산하므로 바닥을 둔다
  const p1 = Math.max(input.populationManMyeong, 0.1);
  const p2 = Math.max(f.populationManMyeong, 0.1);
  axes.push({
    axis: "population",
    label: "지역 인구",
    distance: clamp01(Math.abs(Math.log(p1) - Math.log(p2)) / Math.log(10)),
    detail: `${input.populationManMyeong.toFixed(1)}만 명 vs ${f.populationManMyeong.toFixed(1)}만 명`,
  });

  // 상대 쪽 좌표도 쓸 만해야 잰다. 기본값이 박힌 4건을 그냥 재면 2000km 대
  // 거리가 나와 지역 축이 "가장 먼 곳"으로 굳는다 — 재지 못한 것을 잰 척하는
  // 것이라, 원점이 없을 때와 똑같이 **축을 빼고** 나머지로 잰다.
  if (origin && hasPlace(f.lat, f.lng)) {
    const km = haversineKm(origin.lat, origin.lng, f.lat, f.lng);
    axes.push({
      axis: "region",
      label: "지역",
      distance: clamp01(km / 300),
      detail: `직선거리 ${Math.round(km)}km`,
    });
  }

  const fMonth = monthOf(f);
  axes.push({
    axis: "month",
    label: "개최 시기",
    distance: monthDistance(input.month, fMonth),
    detail:
      input.month === fMonth
        ? `${fMonth}월 — 같은 달`
        : `${input.month}월 vs ${fMonth}월`,
  });

  const sameTheme = input.themeCode === f.themeCode;
  axes.push({
    axis: "theme",
    label: "테마",
    distance: sameTheme ? 0 : 1,
    detail: sameTheme
      ? `${themeLabel(f.themeCode)} — 같은 분류`
      : `${themeLabel(input.themeCode)} vs ${themeLabel(f.themeCode)}`,
  });

  return axes;
}

/** 잰 축들만으로 가중 평균 — 지역을 못 재면 나머지 축의 비중이 커진다 */
function weightedDistance(axes: AxisSimilarity[], weights: AxisWeight): number {
  let sum = 0;
  let total = 0;
  for (const a of axes) {
    sum += a.distance * weights[a.axis];
    total += weights[a.axis];
  }
  return total === 0 ? 1 : sum / total;
}

/**
 * 입력이 잴 수 있는 값인지 본다.
 *
 * 검증 없이 NaN 이 들어오면 clamp01(NaN) 이 NaN 이 되고, NaN <= 임계값 이
 * false 라 619건이 전부 조용히 탈락한다. 그러면 화면에는 "비교할 만한 과거
 * 축제가 없습니다" 가 뜬다 — 입력이 틀렸을 뿐인데 전례가 없다고 답하는 셈이다.
 * 0월처럼 범위를 벗어난 값은 더 나쁘다. 탈락하지 않고 엉뚱한 답을 내놓는다.
 */
export function validatePlanInput(input: PlanInput): string[] {
  const problems: string[] = [];

  if (!input.sido?.trim()) problems.push("시도를 입력해 주세요");
  if (!input.sigungu?.trim()) problems.push("시군구를 입력해 주세요");

  if (!Number.isFinite(input.month) || input.month < 1 || input.month > 12) {
    problems.push("개최 월은 1~12 사이의 숫자여야 합니다");
  }
  if (
    !Number.isFinite(input.themeCode) ||
    input.themeCode < 1 ||
    input.themeCode > 8
  ) {
    problems.push("테마 코드는 1~8 사이의 숫자여야 합니다");
  }
  if (
    !Number.isFinite(input.populationManMyeong) ||
    input.populationManMyeong <= 0
  ) {
    problems.push("지역 인구는 0보다 큰 숫자여야 합니다");
  }
  if (
    !Number.isFinite(input.accessibility) ||
    input.accessibility < 1 ||
    input.accessibility > 5
  ) {
    problems.push("접근성은 1~5 사이의 숫자여야 합니다");
  }

  return problems;
}

/**
 * 닮은 과거 축제를 찾는다. 순수 함수 — 같은 입력에 항상 같은 결과.
 * 임계값을 넘으면 뺀다. 3개를 채우려고 억지로 넣지 않는다.
 */
export function findSimilar(
  input: PlanInput,
  limit = 3,
  /** 가중치 교체 — 화면은 절대 안 쓴다. evals 가 "이 가중치가 더 맞나"를
   *  재려고만 쓴다. 기본값이 곧 제품이 쓰는 값이다 */
  weights: AxisWeight = WEIGHT,
): MatchResult {
  const invalid = validatePlanInput(input);
  if (invalid.length > 0) {
    return { matched: [], searchedScope: SEARCHED_SCOPE, invalid };
  }

  const origin = coordsOf(input.sido, input.sigungu);

  const matched: MatchedFestival[] = FESTIVALS.map((festival) => {
    const axes = axesFor(input, festival, origin);
    return {
      festival,
      axes,
      distance: weightedDistance(axes, weights),
      year: yearOf(festival),
    };
  })
    .filter((m) => m.distance <= DISTANCE_THRESHOLD)
    // 거리 동률이면 id 로 갈라 순서를 고정한다 — 같은 입력에 같은 결과
    .sort((a, b) =>
      a.distance !== b.distance
        ? a.distance - b.distance
        : a.festival.id.localeCompare(b.festival.id),
    )
    .slice(0, limit);

  return { matched, searchedScope: SEARCHED_SCOPE };
}
