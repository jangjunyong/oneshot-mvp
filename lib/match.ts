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

// 가중치는 619건 전수로 각 특징과 actualVisitSurge 의 상관을 재서 정했다.
// 접근성 -0.51 · log(인구) -0.49 가 가장 셌고, 축제 기간은 -0.17 로 노이즈라 뺐다.
const WEIGHT: Record<AxisSimilarity["axis"], number> = {
  accessibility: 0.3,
  population: 0.3,
  region: 0.2,
  month: 0.1,
  theme: 0.1,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 지구 위 두 점 사이 km */
function haversineKm(
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
 */
export function coordsOf(
  sido: string,
  sigungu: string,
): { lat: number; lng: number } | null {
  const hit =
    FESTIVALS.find((f) => f.sido === sido && f.sigungu === sigungu) ??
    FESTIVALS.find((f) => f.sido === sido);
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

  if (origin) {
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
function weightedDistance(axes: AxisSimilarity[]): number {
  let sum = 0;
  let total = 0;
  for (const a of axes) {
    sum += a.distance * WEIGHT[a.axis];
    total += WEIGHT[a.axis];
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
export function findSimilar(input: PlanInput, limit = 3): MatchResult {
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
      distance: weightedDistance(axes),
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
