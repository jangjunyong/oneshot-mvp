// 같은 규모 지역 대비 — 배수의 인구 편향을 숨기지 않고 맥락으로 푼다.
//
// ── 문제 (2026-08-30 측정) ──
//
// actualVisitSurge 의 분모는 "평상시 그 시군구 외지인"이다. 인구가 적으면
// 분모가 작아 배수가 커진다. 619건을 인구 구간으로 갈라 보면 등급이 사실상
// 인구 프록시다.
//
//   인구  ~3만   19건  배수중앙 1.84  심각 37% · 주의 42% · 근거없음 21%
//   인구 3~6만   83건  배수중앙 1.57  심각 24% · 주의 34% · 근거없음 42%
//   인구 6~12만  95건  배수중앙 1.38  심각  9% · 주의 29% · 근거없음 61%
//   인구 12~30만 168건 배수중앙 1.27  심각  2% · 주의 14% · 근거없음 85%
//   인구 30~100만 233건 배수중앙 1.23 심각  1% · 주의  7% · 근거없음 92%
//   인구 100만+   21건 배수중앙 1.27  심각  0% · 주의  5% · 근거없음 95%
//   log(인구) vs 배수  r = -0.486
//
// 그래서 소도시 담당자는 "우린 늘 심각"이라 경보를 무시하게 되고, 대도시에서는
// 제품이 아무 말도 못 한다(95%가 근거없음).
//
// ── 하지 않은 것 ──
//
// **배수를 보정하지 않는다.** "평상시의 2.7배"는 물리적 사실이고, 그걸 인구로
// 나눠 만든 새 지표는 실측이 아니라 우리가 지어낸 숫자다(불문율 1·4번).
// 등급 컷(GRADE_CUT)도 지역마다 바꾸지 않는다 — 같은 2.0 배가 어디서든
// 같은 뜻이어야 담당자끼리 말이 통한다.
//
// 대신 **맥락을 더한다**: "같은 규모 지역 축제 233곳 중 상위 7%".
// 이건 619건에서 세면 나오는 사실이지 새로 만든 숫자가 아니다.

import { FESTIVALS } from "@/lib/festivals";

export interface PopulationBucket {
  /** 만 명 단위, [min, max) */
  min: number;
  max: number;
  /** 화면에 그대로 나가는 이름 */
  label: string;
}

/**
 * 인구 구간. **정한 값이다** — NEARBY_RADIUS_KM 처럼 화면에 기준을 그대로
 * 적어 담당자가 알고 판단하게 한다. 시군 단위 인구 분포를 대략 반씩 가르되
 * 각 구간에 619건이 최소 수십 건은 들어가도록 잡았다.
 */
export const POPULATION_BUCKETS: PopulationBucket[] = [
  { min: 0, max: 3, label: "~3만" },
  { min: 3, max: 6, label: "3~6만" },
  { min: 6, max: 12, label: "6~12만" },
  { min: 12, max: 30, label: "12~30만" },
  { min: 30, max: 100, label: "30~100만" },
  { min: 100, max: Infinity, label: "100만+" },
];

export interface PeerContext {
  /** 구간 이름. 화면에 그대로 */
  label: string;
  /** 그 구간에 든 619건의 수. **항상 같이 낸다** — n 이 19 면 "상위 5%"는
   *  1등이라는 뜻이고, 그걸 모르면 과대해석한다 */
  n: number;
  /** 이 배수가 또래 중 상위 몇 %인가 (0~100, 작을수록 드물다) */
  topPercent: number;
  /** 또래의 배수 중앙값 — "우리가 또래보다 높나 낮나"의 기준선 */
  median: number;
}

const 구간찾기 = (pop: number) =>
  POPULATION_BUCKETS.find((b) => pop >= b.min && pop < b.max) ?? null;

/**
 * 같은 인구 구간 축제들 사이에서 이 배수가 어디쯤인가.
 *
 * 배수를 바꾸지 않는다. 세기만 한다.
 */
export function peerContext(
  populationManMyeong: number,
  surge: number,
): PeerContext | null {
  if (!Number.isFinite(populationManMyeong) || populationManMyeong < 0) return null;
  if (!Number.isFinite(surge)) return null;

  const bucket = 구간찾기(populationManMyeong);
  if (bucket === null) return null;

  const 또래 = FESTIVALS.filter(
    (f) => f.populationManMyeong >= bucket.min && f.populationManMyeong < bucket.max,
  ).map((f) => f.actualVisitSurge);
  if (또래.length === 0) return null;

  // 이 배수 이상인 또래의 몫 = 상위 %
  const 이상 = 또래.filter((s) => s >= surge).length;
  const sorted = [...또래].sort((a, b) => a - b);

  return {
    label: bucket.label,
    n: 또래.length,
    topPercent: Math.round((이상 / 또래.length) * 100),
    median: sorted[Math.floor(sorted.length / 2)],
  };
}
