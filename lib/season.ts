// 시기 민감도 — "달을 바꾸면 어떤 쌍둥이가 뽑히나".
//
// ── 이 표가 재는 것이 무엇인지부터 (2026-08-30, docs/DECISIONS.md) ──
//
// 처음엔 "N월에 열면 N배"라는 표를 만들려 했다. 거짓말이라 이름을 바꿨다.
// 요청한 달에 **실제로 열린** 쌍둥이는 36칸 중 7칸(19%)뿐이다:
//
//   "9월 요청" -> 쌍둥이 실제 개최월 [10, 10, 8]   <- 9월 축제가 하나도 없다
//   "1월 요청" -> 쌍둥이 실제 개최월 [10,  3, 4]
//
// match.ts 의 month 가중치가 0.1 이라, 달을 12번 돌려도 같은 지역 축제
// 네댓 개가 순위만 바꿔 재배열될 뿐이다. 그러니 이 표는 **시기의 효과**가
// 아니라 **매칭이 시기에 얼마나 흔들리는가**를 잰다. 정직하게 그렇게 이름
// 붙이면 유효하고, 각 행에 쌍둥이 실제 개최월을 찍으면 표가 스스로 한계를
// 말한다.
//
// 새 유사도 로직을 만들지 않는다 — findSimilar·grade 를 그대로 부른다.
// 표의 숫자와 진단 화면의 숫자가 갈리면 둘 다 못 믿는다.

import { findSimilar } from "@/lib/match";
import { grade, type GradeLevel } from "@/lib/grade";
import { monthOf } from "@/lib/festivals";
import type { PlanInput } from "@/lib/types";

/**
 * 배수 폭이 이보다 좁으면 "달을 바꿔도 그게 그거"라고 본다.
 *
 * 등급이 갈리는지로 판정하면 GRADE_CUT(2.0/1.5)이 숨은 임계값이 된다.
 * 619건 전수로 재 보니 그 방식은 spread 0.46 을 "평평", 0.07 을 "갈림"이라
 * 불렀다 — 폭이 6.5배 큰 쪽이 평평이었다. 컷을 안 끌어들이면 컷의 벼랑도 없다.
 * 정한 값이라 화면에 그대로 적는다.
 */
export const FLAT_SPREAD = 0.3;

/** 표본을 이만큼 바꿔 봐도 등급이 그대로면 단단한 신호로 본다 */
const ROBUST_LIMITS = [3, 5, 7] as const;

export interface MonthOutlook {
  /** 1~12 */
  month: number;
  /** 이 달로 물었을 때 나온 쌍둥이 수 (0~3) */
  matched: number;
  medianSurge: number | null;
  loSurge: number | null;
  hiSurge: number | null;
  level: GradeLevel;
  twinNames: string[];
  /** 그 쌍둥이들이 **실제로** 열린 달. 요청월과 다른 게 정상이고, 그래서 낸다 */
  twinMonths: number[];
}

export interface SeasonScan {
  /** 기획안이 적어 낸 달 */
  planMonth: number;
  /** 항상 12개. 입력이 틀리면 빈 배열 */
  months: MonthOutlook[];
  /** 12달 중앙 배수의 최고 − 최저 */
  spread: number | null;
  /** spread 가 FLAT_SPREAD 미만 — "달을 바꿔도 그게 그거" */
  flat: boolean;
  /** 요청월과 쌍둥이 실제 개최월이 같았던 칸의 비율. 화면에 그대로 낸다 */
  monthMatchRate: number;
  /** 표본 수(3·5·7)를 바꿔도 달별 등급이 그대로인가 */
  robust: boolean;
  /** 배수 중앙값이 가장 낮았던 달(동률 포함) */
  quietest: number[];
  busiest: number[];
  invalid?: string[];
}

function outlookFor(input: PlanInput, month: number, limit: number): MonthOutlook {
  const r = findSimilar({ ...input, month }, limit);
  const g = grade(r);
  const surges = r.matched.map((m) => m.festival.actualVisitSurge);
  return {
    month,
    matched: r.matched.length,
    medianSurge: g.medianSurge,
    loSurge: surges.length ? Math.min(...surges) : null,
    hiSurge: surges.length ? Math.max(...surges) : null,
    level: g.level,
    twinNames: r.matched.map((m) => m.festival.name),
    twinMonths: r.matched.map((m) => monthOf(m.festival)),
  };
}

/**
 * 12달을 전부 재고, 이 표가 얼마나 믿을 만한지까지 같이 낸다.
 *
 * 순수 함수, 네트워크 0. findSimilar 12회라 5ms 남짓이지만 **고른 진단 한 건에
 * 대해서만** 부를 것 — 이력 50건 루프에 넣으면 요청마다 0.27초가 붙는다.
 */
export function scanSeason(input: PlanInput): SeasonScan {
  const 기본 = findSimilar(input);
  if (기본.invalid) {
    return {
      planMonth: input.month,
      months: [],
      spread: null,
      flat: false,
      monthMatchRate: 0,
      robust: false,
      quietest: [],
      busiest: [],
      invalid: 기본.invalid,
    };
  }

  const months = Array.from({ length: 12 }, (_, i) =>
    outlookFor(input, i + 1, ROBUST_LIMITS[0]),
  );

  const meds = months
    .map((m) => m.medianSurge)
    .filter((v): v is number => v !== null);
  const spread = meds.length ? Math.max(...meds) - Math.min(...meds) : null;

  const 칸 = months.reduce((a, m) => a + m.twinMonths.length, 0);
  const 일치 = months.reduce(
    (a, m) => a + m.twinMonths.filter((tm) => tm === m.month).length,
    0,
  );

  // 표본 수를 바꿔도 달별 등급이 그대로인가. 3개짜리 중앙값은 한 건 교체로
  // 컷을 넘기 때문에, 흔들리는 신호를 단단한 척 내보내지 않으려고 잰다.
  const robust = ROBUST_LIMITS.slice(1).every((lim) =>
    months.every((m) => outlookFor(input, m.month, lim).level === m.level),
  );

  const 최저 = meds.length ? Math.min(...meds) : null;
  const 최고 = meds.length ? Math.max(...meds) : null;

  return {
    planMonth: input.month,
    months,
    spread,
    flat: spread !== null && spread < FLAT_SPREAD,
    monthMatchRate: 칸 === 0 ? 0 : 일치 / 칸,
    robust,
    quietest: months.filter((m) => m.medianSurge === 최저).map((m) => m.month),
    busiest: months.filter((m) => m.medianSurge === 최고).map((m) => m.month),
  };
}
