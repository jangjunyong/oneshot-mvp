// 감당 범위 — "왜 물량을 3배로 잡았습니까"에 댈 마지막 한 칸.
//
// PRD 는 이 제품이 팔리는 경로를 하나로 적어 뒀다: 그 질문에 댈 근거.
// 그런데 우리는 배수(2.58배)까지 가고 멈춰 있었다. 담당자가 정하는 것은
// 배수가 아니라 물량이다.
//
// ── 여기서 물량 **개수**를 내지 않는 이유 (2026-08-30, docs/DECISIONS.md) ──
//
// `작년 물량 × 실측 배수` 를 만들려다 619건으로 재 보고 버렸다.
// actualVisitSurge 의 분모는 **평상시 그 시군구**지 작년 그 축제가 아니다.
// 작년 화장실 10개는 이미 배수 상황을 겪은 물량이라, 거기에 2.58 을 곱하면
// "작년에 2.27배를 10개로 치렀다"는 우리 근거 1과 같은 화면에서 충돌한다.
// 올바른 비는 2.58/2.27 = 1.14 다. 곱셈판은 2.2배 과잉이었다 —
// 예산 낭비를 막겠다는 제품이 예산 낭비를 만드는 셈이다.
//
// 그리고 개수를 내는 순간 evals/cases.md 09행("화면의 숫자가 전부 입력값·
// 지역 인구·실측 배수·연도 중 하나인가")을 깬다. "26개"는 네 범주 어디에도
// 없고, 26 = 10 × 2.58 은 "올해 방문자 = 작년의 2.58배"라는 예측과
// 산술적으로 같다. 중간 숫자를 감추는 건 예측을 없앤 게 아니라 감사 못 하게
// 만든 것이다.
//
// 그래서 여기서 나가는 것은 **배수와 배수의 비율뿐**이다. 개수 환산은
// 담당자가 자기 작년 대장을 보고 한다. 그게 "3배가 아니라 1.45배 상단까지
// 봤습니다"라는 더 강한 답이 된다.

import type { AlertGrade } from "@/lib/grade";
import type { MatchedFestival, PlanInput } from "@/lib/types";
import { monthOf } from "@/lib/festivals";

/**
 * 비율의 바닥. 쌍둥이가 작년보다 낮았던 경우(619건 중 49%)에도
 * **감축을 권고하지 않는다.** 재난은 평균으로 오지 않고, "작년보다 줄이세요"는
 * 우리가 실측으로 뒷받침할 수 있는 말이 아니다. 정한 값이라 화면에 밝힌다.
 */
export const RATIO_FLOOR = 1;

export interface CapacityBand {
  /** 작년 이 축제의 실측 배수. 619건에서 못 찾으면 null */
  baseSurge: number | null;
  /** 닮은 축제들의 배수 범위 — 기준이 없어도 이건 항상 있다 */
  twinLo: number;
  twinHi: number;
  /** 작년이 감당한 수준의 몇 배 구간인가. baseSurge 가 없으면 null */
  lo: number | null;
  hi: number | null;
  /** 하한이 RATIO_FLOOR 에 걸렸는가 — 걸린 사실도 화면에 나가야 한다 */
  floored: boolean;
}

/**
 * 감당 범위. 등급이 `심각`·`주의` 일 때만 낸다.
 *
 * `근거없음` 에서 내지 않는 이유 — 619건의 76%가 배수 1.5 미만이다.
 * "위험 근거를 찾지 못했습니다"라고 말한 화면이 같은 페이지에서 증액을
 * 지시하면 불문율 2번("안전하다고 말하지 않는다"의 뒷면)을 어긴다.
 */
export function capacityBand(
  g: AlertGrade,
  twinSurges: readonly number[],
  /** 작년 이 축제의 실측 배수 (619건에 있을 때만) */
  baseSurge: number | null,
): CapacityBand | null {
  if (g.level !== "심각" && g.level !== "주의") return null;
  if (twinSurges.length === 0) return null;

  const twinLo = Math.min(...twinSurges);
  const twinHi = Math.max(...twinSurges);

  if (baseSurge === null || !(baseSurge > 0)) {
    return { baseSurge: null, twinLo, twinHi, lo: null, hi: null, floored: false };
  }

  const rawLo = twinLo / baseSurge;
  const rawHi = twinHi / baseSurge;
  return {
    baseSurge,
    twinLo,
    twinHi,
    lo: Math.max(RATIO_FLOOR, rawLo),
    hi: Math.max(RATIO_FLOOR, rawHi),
    // `<` 가 아니라 `<=` 인 이유 — `localBaseline` 이 **matched 안에서** 고르므로
    // baseSurge 는 언제나 twinSurges 의 한 원소다. 즉 twinLo <= baseSurge 이고
    // rawLo <= 1 이라 **하한은 늘 1.00 이다**(619건 중 기준이 있는 136건 전수
    // 확인). 기준이 쌍둥이 중 최솟값이면 rawLo 가 정확히 1 이라 예전 `<` 로는
    // floored 가 거짓이 됐고, 화면이 1.00 을 잰 값처럼 내놓으면서 해명 문장은
    // 안 띄웠다(136건 중 40건). 하한은 측정이 아니라 항등식이므로 언제나 밝힌다.
    floored: rawLo <= RATIO_FLOOR,
  };
}

/** 화면·진단서가 같은 반올림을 쓰게 한다 */
export const ratioText = (n: number) => `${n.toFixed(2)}배`;

/**
 * 비교 기준이 될 "같은 자리의 실측" — 닮은 축제 중 **같은 시군구, 같은 달**.
 *
 * 진단 입력에는 축제명이 없다. 그래서 이것이 *작년의 그 축제 자신*이라고
 * 단정하지 않는다 — 같은 시군구·같은 달의 다른 축제일 수도 있다. 그래서
 * 축제 이름을 함께 돌려주고, 화면이 그 이름을 그대로 밝힌다. 담당자가
 * 자기 축제인지 보고 판단한다 (불문율 3번 — 왜 그렇게 봤는지를 같이 낸다).
 *
 * 여럿이면 가장 닮은 것(matched 는 이미 거리순)을 쓴다. 없으면 null.
 */
export function localBaseline(
  input: Pick<PlanInput, "sido" | "sigungu" | "month">,
  matched: readonly MatchedFestival[],
): { id: string; name: string; year: string; surge: number } | null {
  const hit = matched.find(
    (m) =>
      m.festival.sido === input.sido &&
      m.festival.sigungu === input.sigungu &&
      monthOf(m.festival) === input.month,
  );
  return hit
    ? {
        // 기준은 언제나 닮은 축제 셋 중 하나다. 화면이 "닮은 축제 ①이기도
        // 합니다"라고 짚으려면 어느 것인지 알아야 하고, 이름으로 맞추면 같은
        // 이름의 다른 축제에 붙는다.
        id: hit.festival.id,
        name: hit.festival.name,
        year: hit.year,
        surge: hit.festival.actualVisitSurge,
      }
    : null;
}
