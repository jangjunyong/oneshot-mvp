// 시뮬 요약 카드 — /venue 의 워커 Summary 를 도면과 함께 저장할 수 있는 작은 요약으로 줄인다.
//
// 진단서(/report 근거 3)는 이 카드만 읽는다. 시뮬 자체는 브라우저 워커에서만 돌고 서버는 못 돌리므로,
// 저장 시점의 요약과 그때의 가정(유입·배수·점당 인원)을 같이 남겨야 종이가 "무슨 가정에서 나온 숫자"인지 말한다.
// 값은 밀도(명/㎡)·초·배수뿐이다. 방문객 수(명)는 없다.

import type { Summary } from "@/lib/sim/sim.js";

export interface SimCard {
  /** 저장 시각 ISO */
  at: string;
  /** 시뮬 경과(초) */
  simSec: number;
  /** 가정 — 시간대별 유입(명/h 문자열 그대로) × 배수, 점 하나가 몇 명 */
  inflowPerHour: string;
  scale: number;
  k: number;
  /** 최대 밀도와 그 자리(가장 가까운 부스·출입구 이름) */
  peak: { density: number; where: string };
  /** 3명/㎡ 이상이 지속된 자리 상위 3 */
  hotspots: { where: string; peak: number; sec: number }[];
  /** 5명/㎡(행안부 "위험") 이 이어진 최장 초와 자리 */
  secAbove5: number;
  limitWhere: string | null;
}

export const SIM_CARD_TOP = 3;

export function simCardFrom(
  sum: Summary,
  nameOf: (x: number, y: number) => string,
  opts: { inflowPerHour: string; scale: number; k: number; at?: string },
): SimCard | null {
  if (!(sum.time > 0)) return null;
  return {
    at: opts.at ?? new Date().toISOString(),
    simSec: sum.time,
    inflowPerHour: opts.inflowPerHour,
    scale: opts.scale,
    k: opts.k,
    peak: { density: sum.peak.density, where: nameOf(sum.peak.x, sum.peak.y) },
    hotspots: [...sum.hotspots]
      .sort((a, b) => b.secAboveD - a.secAboveD || b.peak - a.peak)
      .slice(0, SIM_CARD_TOP)
      .map((h) => ({ where: nameOf(h.x, h.y), peak: h.peak, sec: h.secAboveD })),
    secAbove5: sum.limit.secAbove5,
    limitWhere: sum.limit.at ? nameOf(sum.limit.at.x, sum.limit.at.y) : null,
  };
}

/** 반지름 0.2m 최밀 충전의 물리 상한. 점 하나가 1명일 때 이 위는 배치가 아니라 코드 버그다 */
export const DENSITY_CAP = 7.22;

/**
 * 정적 카드·자동 실행·불변식 테스트가 같이 보는 한 설정 (2026-09-12 M7a).
 * 세 곳이 다른 값을 보면 "카드 숫자와 화면 숫자가 다르다"가 된다. 카드에 이 값을 그대로 인쇄한다.
 * 유입 배열은 출처 없는 가정이다(시간대별 명/시). 점 하나 = 1명만 쓴다(k>1 은 밀도가 부푼다).
 */
export const SIM_CARD_SETTINGS = {
  seed: 1,
  personsPerAgent: 1,
  inflowPerHour: [3000, 6000] as number[],
  visitsPerPerson: 3,
  dwellSecMean: 300,
  minutes: 15,
} as const;

/**
 * 진단서 한 줄. 점 하나가 k>1 명이면 줄·서비스 자리 기하가 k 를 안 따라가 밀도가 부풀 수 있어(HANDOFF),
 * 상한을 넘은 값은 배치 판단에 쓰지 않고 k=1 로 다시 돌리라고 적는다.
 */
export function simCardHeadline(c: SimCard): string {
  const min = Math.round(c.simSec / 60);
  if (c.peak.density > DENSITY_CAP && c.k > 1)
    return `시뮬 ${min}분 결과의 최대 밀도 ${c.peak.density.toFixed(2)}명/㎡ 는 물리 상한(${DENSITY_CAP}명/㎡)을 넘습니다. 점 하나를 ${c.k}명으로 두면 밀도가 부풀 수 있으니 점 하나 1명으로 다시 돌려 저장해 주세요. 아래 지속 자리는 참고만 합니다.`;
  if (c.peak.density > DENSITY_CAP) return `시뮬 ${min}분 결과가 물리 상한(${DENSITY_CAP}명/㎡)을 넘어 신뢰할 수 없습니다. 다시 돌려 저장해 주세요.`;
  if (c.secAbove5 >= 60) return `시뮬 ${min}분 동안 5명/㎡(행안부 위험)가 ${Math.round(c.secAbove5)}초 이어진 자리가 있습니다: ${c.limitWhere ?? "위치 미상"}. 이 가정에서는 배치를 바꿔야 합니다.`;
  if (c.hotspots.length > 0) return `시뮬 ${min}분 동안 3명/㎡(행안부 주의) 이상이 지속된 자리가 ${c.hotspots.length}곳 있습니다. 최대 ${c.peak.density.toFixed(2)}명/㎡(${c.peak.where}).`;
  return `시뮬 ${min}분 동안 3명/㎡ 이상이 지속된 자리가 없었습니다. 최대 ${c.peak.density.toFixed(2)}명/㎡(${c.peak.where}). 가정 안에서의 결과이고 안전하다는 뜻이 아닙니다.`;
}
