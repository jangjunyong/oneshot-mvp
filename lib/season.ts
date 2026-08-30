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
  /** 12달 중 **실제로 잰** 달 수(쌍둥이가 하나라도 나온 달). 0~12 */
  measured: number;
  /** 잰 달들의 중앙 배수 최고 − 최저 */
  spread: number | null;
  /**
   * spread 가 FLAT_SPREAD 미만 — "달을 바꿔도 그게 그거".
   *
   * **12달을 다 재야만 참이 될 수 있다.** 예전에는 잰 달끼리만 폭을 재서,
   * 1달만 잰 조건에서 spread=0 이 되어 flat 이 참이 됐다. 화면은 그걸 받아
   * "달을 바꿔도 폭이 0.00배 안에 머뭅니다 — 시기는 갈리지 않습니다"라고
   * 적었다. 11달은 평평한 게 아니라 **재지 못한** 것이다.
   */
  flat: boolean;
  /**
   * 요청월과 쌍둥이 실제 개최월이 같았던 칸의 비율. 화면에 그대로 낸다.
   * 잰 칸이 없으면 null — 0 으로 두면 "0% 일치"라는 잰 값처럼 읽힌다.
   */
  monthMatchRate: number | null;
  /** 표본 수(3·5·7)를 바꿔도 달별 등급이 그대로인가 */
  robust: boolean;
  /** 배수 중앙값이 가장 낮았던 달(동률 포함). 잰 달이 없으면 빈 배열 */
  quietest: number[];
  /** 가장 높았던 달(동률 포함). 잰 달이 없으면 빈 배열 */
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
      measured: 0,
      spread: null,
      flat: false,
      monthMatchRate: null,
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
  //
  // 잰 달이 하나도 없으면 "단단하다"가 아니라 **잴 것이 없었다**이다. 안 잰
  // 달은 어느 limit 에서나 "비교불가"라 저절로 일치하므로, 게이트가 없으면
  // 결측이 많을수록 robust 가 참이 된다 — 안심하는 쪽으로 기운다.
  const robust =
    meds.length > 0 &&
    ROBUST_LIMITS.slice(1).every((lim) =>
      months.every((m) => outlookFor(input, m.month, lim).level === m.level),
    );

  // 잰 달이 하나도 없으면 최저도 최고도 없다.
  //
  // 예전에는 여기서 최저·최고를 null 로 두고 medianSurge 와 비교했다.
  // null === null 이 참이라 **12달이 모두 최저이자 최고**로 뽑혔고, 화면은
  // 그걸 받아 "가장 낮았던 달은 1·2·…·12월, 가장 높았던 달은 1·2·…·12월
  // 입니다 (폭 배)" 라고 적었다. 폭은 숫자 없이 단위만 남았다.
  // 못 잰 것은 빈 목록으로 낸다 — 화면이 아무 말도 안 할 수 있게.
  const 최저 = meds.length ? Math.min(...meds) : null;
  const 최고 = meds.length ? Math.max(...meds) : null;
  const 고른달 = (기준: number | null) =>
    기준 === null
      ? []
      : months.filter((m) => m.medianSurge === 기준).map((m) => m.month);

  return {
    planMonth: input.month,
    months,
    measured: meds.length,
    spread,
    // 12달을 다 재야만 "달을 바꿔도 그게 그거"라고 말할 수 있다
    flat: spread !== null && spread < FLAT_SPREAD && meds.length === months.length,
    monthMatchRate: 칸 === 0 ? null : 일치 / 칸,
    robust,
    quietest: 고른달(최저),
    busiest: 고른달(최고),
  };
}
