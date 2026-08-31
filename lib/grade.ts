// 경보 등급. 닮은 축제들이 실제로 겪은 배수의 중앙값으로만 매긴다.
//
// "안전" 이라는 판정이 없는 것이 이 파일의 요점이다.
// 근거를 못 찾은 것과 안전한 것은 다르다 (암묵지 3번).
//
// 방문객 수를 만들어내지 않는다. 화면에 나가는 숫자는 배수뿐이다.

import { GRADE_CUT, type MatchResult } from "@/lib/types";

export type GradeLevel = "심각" | "주의" | "근거없음" | "비교불가";

export interface AlertGrade {
  level: GradeLevel;
  /** 화면 맨 위 한 문장 */
  headline: string;
  /** 닮은 축제들의 배수 중앙값. 비교불가면 null */
  medianSurge: number | null;
}

/** 짝수 개일 때 두 값의 평균이 아니라 위쪽 값을 쓴다 — 경보는 보수적으로 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const oneDecimal = (n: number) => n.toFixed(1);

/**
 * 등급을 화면에 적는 짧은 문구.
 *
 * 진단 화면과 진단서가 같은 문장을 각자 삼항으로 쓰고 있었다. 화면과 종이가
 * 같은 진단을 다르게 말하는 사고를 이미 한 번 냈으므로(중앙값, 2026-08-31)
 * 문구도 한 곳에서만 만든다.
 *
 * `short` 는 이력 목록의 칩용이다. **일부러 다른 문구다** — 좁은 칸이라
 * 짧게 끊는다. 같은 함수에 둔 것은 세 자리가 함께 움직이게 하려는 것이고,
 * 하나로 합치라는 뜻이 아니다.
 */
export function levelLabel(level: GradeLevel, short = false): string {
  if (level === "심각" || level === "주의") {
    return short ? `경보 ${level}` : `⚠ 경보: ${level}`;
  }
  if (level === "근거없음") return short ? "근거 못 찾음" : "위험 근거 못 찾음";
  return "비교 대상 없음";
}

export function grade(result: MatchResult): AlertGrade {
  const surges = result.matched.map((m) => m.festival.actualVisitSurge);

  if (surges.length === 0) {
    return {
      level: "비교불가",
      headline: `비교할 만한 과거 축제가 없습니다 — 찾아본 범위: ${result.searchedScope}`,
      medianSurge: null,
    };
  }

  const mid = median(surges);
  const lo = oneDecimal(Math.min(...surges));
  const hi = oneDecimal(Math.max(...surges));
  const 곳 = `${surges.length}곳`;

  if (mid < GRADE_CUT.caution) {
    return {
      level: "근거없음",
      headline: `위험 근거를 찾지 못했습니다 — 닮은 축제 ${곳}은 평소의 ${lo}~${hi}배였습니다`,
      medianSurge: mid,
    };
  }

  return {
    level: mid >= GRADE_CUT.severe ? "심각" : "주의",
    headline: `닮은 축제 ${곳}이 평소의 ${lo}~${hi}배가 왔습니다`,
    medianSurge: mid,
  };
}
