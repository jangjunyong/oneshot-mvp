// 자기검증 — "이 방식은 얼마나 맞는가".
//
// 담당자가 이 화면을 결재에 들고 갈 때 반드시 받는 질문이 하나 있다.
// **"그게 맞는 건 어떻게 압니까."** 지금까지 우리는 근거(닮은 이유·출처)는
// 냈지만 **적중률**은 한 번도 안 냈다. evals/cases.md 안에만 적혀 있었고
// 화면에는 없었다.
//
// 여기서 재는 것은 leave-one-out 이다. 619건 각각을 "그 축제 자신의 기획안"인
// 척 넣고, **자기 자신을 뺀** 닮은 축제들로 등급을 매겨 실제와 대조한다.
// 자기 자신을 빼지 않으면 정답을 보고 답을 쓰는 셈이라 숫자가 거짓이 된다.
//
// 방문객 수 예측이 아니다. 재는 것은 "평소 대비 배수"라는 같은 축 위의
// 맞음/틀림뿐이다 (불문율 1번).

import { findSimilar, WEIGHT, type AxisWeight } from "@/lib/match";
import { FESTIVALS } from "@/lib/festivals";
import { GRADE_CUT, type Festival } from "@/lib/types";

/**
 * 이 폭 안에 들면 "맞혔다"고 본다. 정한 값이라 화면에 그대로 적는다 —
 * NEARBY_RADIUS_KM 과 같은 이유다. 담당자가 기준을 알고 판단하게 한다.
 */
export const WITHIN_BAND = 0.3;

/** 비교에 쓰는 쌍둥이 수. 진단 화면과 같아야 숫자가 갈리지 않는다 */
const TWIN_LIMIT = 3;

export interface LooReport {
  /** 표본 수 = 619 */
  n: number;
  /** 실제 위험군(배수 1.5 이상)의 비율. 무작위로 찍었을 때의 정밀도다 */
  baseRate: number;
  /** 위험이라고 한 것 중 실제 위험이던 비율 */
  precision: number;
  /** 실제 위험 중 우리가 잡아낸 비율 */
  recall: number;
  /** 정밀도 ÷ 기저율. 무작위보다 몇 배 나은가 */
  lift: number;
  /** |예측 배수 − 실제 배수| 의 중앙값 */
  medianAbsErr: number;
  /** 절대오차가 WITHIN_BAND 안에 든 비율 */
  withinRatio: number;
  /** 쌍둥이를 못 찾아 판정 자체를 못 한 건수 */
  unjudged: number;
}

const 위험한가 = (surge: number) => surge >= GRADE_CUT.caution;

/** 짝수 개면 위쪽 값 — grade.ts 의 median 과 같은 규약이어야 한다 */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** 그 축제 자신을 뺀 쌍둥이들의 배수 중앙값. 못 찾으면 null */
function predictSurge(f: Festival, weights: AxisWeight): number | null {
  // 자기 자신이 1위로 뽑히므로 한 칸 더 받아 와서 제외한다
  const r = findSimilar(
    {
      sido: f.sido,
      sigungu: f.sigungu,
      month: Number(f.eventStartDate.slice(4, 6)),
      themeCode: f.themeCode,
      populationManMyeong: f.populationManMyeong,
      accessibility: f.accessibility,
    },
    TWIN_LIMIT + 3,
    weights,
  );
  const 남 = r.matched
    .filter((m) => m.festival.id !== f.id)
    .slice(0, TWIN_LIMIT);
  if (남.length === 0) return null;
  return median(남.map((m) => m.festival.actualVisitSurge));
}

/**
 * 619건 leave-one-out. 순수 함수 — 데이터만 읽는다.
 *
 * 런타임에 부르지 않는다(619 × findSimilar 는 화면에 얹을 비용이 아니다).
 * 화면은 LOO_PUBLISHED 상수를 쓰고, 테스트가 이 함수로 그 상수를 다시 잰다.
 */
export function leaveOneOut(weights: AxisWeight = WEIGHT): LooReport {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let unjudged = 0;
  const errs: number[] = [];

  for (const f of FESTIVALS) {
    const 실제위험 = 위험한가(f.actualVisitSurge);
    const 예측 = predictSurge(f, weights);

    if (예측 === null) {
      unjudged += 1;
      // 못 잡은 것은 못 잡은 것이다 — 판정 불가를 정답 처리하지 않는다
      if (실제위험) fn += 1;
      continue;
    }

    errs.push(Math.abs(예측 - f.actualVisitSurge));

    const 예측위험 = 위험한가(예측);
    if (예측위험 && 실제위험) tp += 1;
    else if (예측위험 && !실제위험) fp += 1;
    else if (!예측위험 && 실제위험) fn += 1;
  }

  const n = FESTIVALS.length;
  const baseRate = FESTIVALS.filter((f) => 위험한가(f.actualVisitSurge)).length / n;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

  return {
    n,
    baseRate,
    precision,
    recall,
    lift: baseRate === 0 ? 0 : precision / baseRate,
    medianAbsErr: errs.length === 0 ? 0 : median(errs),
    withinRatio:
      errs.length === 0 ? 0 : errs.filter((e) => e <= WITHIN_BAND).length / errs.length,
    unjudged,
  };
}

/**
 * 화면·진단서에 나가는 값. **`leaveOneOut()` 을 돌려 나온 그대로**이고,
 * eval.test.ts 가 매번 다시 재서 어긋나면 실패한다.
 *
 * 2026-08-30 측정. 임계값 0.27(DISTANCE_THRESHOLD) · 테마 가중치 0.15 재보정 후.
 * (재보정 전에는 정밀도 56.8% · 재현율 54.1% · 리프트 2.41 · 중앙오차 0.130 이었다)
 */
export const LOO_PUBLISHED: LooReport = {
  n: 619,
  baseRate: 0.2358642972536349,
  precision: 0.6015037593984962,
  recall: 0.547945205479452,
  lift: 2.550211144299104,
  medianAbsErr: 0.1200000000000001,
  withinRatio: 0.7883683360258481,
  unjudged: 0,
};

/** 백분율 한 자리 — 화면과 진단서가 같은 반올림을 쓰게 한다 */
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
