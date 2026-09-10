// 내년 배수 구간 — 예측이 아니라 이력의 연장이다 (기획/08 §2.1).
//
// 이력 N년: 연도별 배수의 min~max 를 0.1 단위로 바깥 반올림. "평균 1.1~1.3배 · 최대일 1.4~1.6배".
// 이력 0년: 또래 구간만.
//
// 신뢰도 라벨은 없다(2026-09-10, 적대적 검증 M1). 이 구간이 다음 해를 덮는 비율은 한 번도 잰 적이 없고,
// 재지 않은 것에 "신뢰도 높음"을 붙이는 것은 출처 없는 숫자다. 화면은 "이력 범위(N년). 적중률은 아직
// 재지 못했다"라고만 말한다. 적중률은 scripts/range-backtest(M5)가 재서 상수로 박을 때까지 비운다.
//
// 여기서 나가는 것은 배수뿐이다. 명 수는 없다 — 그래서 불문율 1(방문객 수 예측 금지)과 부딪히지 않는다.

import type { HistoryYear, PeerBand } from "@/lib/verdict";

export interface Band {
  lo: number;
  hi: number;
}

export interface NextYearRange {
  /** 자기 이력 — 연도별 평균 배수의 구간 */
  mean: Band | null;
  /** 자기 이력 — 연도별 최대일 배수의 구간 */
  peak: Band | null;
  years: string[];
  /** 또래(같은 인구 구간 619건) 의 구간 — 중앙값~상위 5% */
  peerMean: Band | null;
  peerPeak: Band | null;
  peerLabel: string | null;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** 0.1 단위 바깥 반올림 — 구간은 값을 감싸야지 잘라내면 안 된다 */
export function outwardBand(values: readonly number[]): Band | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  const lo = Math.floor(round6(Math.min(...xs) * 10)) / 10;
  const hi = Math.ceil(round6(Math.max(...xs) * 10)) / 10;
  return { lo, hi };
}

export function nextYearRange(history: readonly HistoryYear[], peer: PeerBand | null): NextYearRange {
  const years = [...history].map((h) => h.year).sort();
  const own = history.length >= 1;
  return {
    mean: own ? outwardBand(history.map((h) => h.multMean)) : null,
    peak: own ? outwardBand(history.map((h) => h.multPeak)) : null,
    years,
    peerMean: peer ? outwardBand([peer.meanMedian, peer.meanP95]) : null,
    peerPeak: peer ? outwardBand([peer.peakMedian, peer.peakP95]) : null,
    peerLabel: peer?.label ?? null,
  };
}

export const bandText = (b: Band | null) =>
  b === null ? "—" : b.lo === b.hi ? `${b.lo.toFixed(1)}배` : `${b.lo.toFixed(1)}~${b.hi.toFixed(1)}배`;
