// 축제 신호 — 담당자가 적은 지난 회차 기간에 "평소와 구분되는 증가"가 실제로 있었는가를 보여 준다 (2026-09-14 S1 #8 A안).
// 순수 함수. 판정(lib/verdict.ts)에는 쓰지 않는다 — 이력에서 빼지도 않는다. 날짜를 확인하라는 표시만 한다.
//
// 왜 표시만 하나 (2026-09-14 실측, 619건 축제 기간 vs 같은 기간을 ±13·26주 옮긴 가짜 1,818건):
//   어떤 단일 지표도 진짜·가짜를 확실히 가르지 못한다(AUC 0.58~0.67). 시군구 전체 체류라 작은 축제는 묻히고,
//   옮긴 기간에도 명절·성수기·목록에 없는 행사가 섞인다. 그래서 "없음"을 "날짜 오류"로 단정하지 않는다.
//
// 지표 셋:
//   zPeak  = (축제 기간 최대일 외지인 − 전후 4주 중앙값) ÷ (1.4826 × 전후 4주 MAD)   — 로버스트 z(중앙값·MAD)
//   rank   = 축제 시작 −182일 ~ 끝 +182일 안에서 최대일 외지인의 백분위(1.0 = 그 1년 중 가장 붐빈 날)
//   yoyPeak = 최대일 외지인 ÷ 전년 같은 달(시작 달) 외지인 중앙값   — 참고 수치(사용자 요청). 등급에는 안 쓴다(분별력 AUC 0.56)
//
// 근거 (조사 _work/research/festival-signal-mobile-baseline.synthesis.md · 실측 scripts/signal-eval.mjs):
//   비교 창 = 축제 전후 4주 — 한국관광데이터랩의 "축제기간 vs 비축제기간(전후 4주)" 정의와 같다(C1). 데이터랩도 판정식·문턱은 공개하지 않는다(C2)
//   중앙값·MAD 로 평소를 잰다 — 이상치가 기준을 오염시키지 않게 하는 학술 관행(MEDIFF, C11)
//   뚜렷함 z 3.0 = 관리도 μ+3σ(파리 이동통신 이벤트 탐지, C12). 이 분야 공개 문턱은 이것과 μ+2.32σ 뿐이고, 시군구·일 단위로 오탐률을 잰 사례는 없다
//   구분 안 됨 = 진짜 축제에 경고가 뜨는 비율을 5% 아래로 묶는 값 — 목표 초과율을 먼저 정하고 문턱을 고르는 방식(C11 이상치 2% 가정, C12 목표 1%)
//
// 등급 문턱 (값은 SIGNAL_THRESHOLDS, 619건 진짜 vs ±13·26주 옮긴 가짜 1,818건):
//   뚜렷함: rank ≥ 0.95 이고 zPeak ≥ 3.0 → 진짜 축제 26.2% · 가짜 11.7%
//   구분 안 됨: rank < 0.60 이고 zPeak < 1.0 → 진짜 축제 4.2% · 가짜 9.1%
//   그 사이: 약함

import { median, type DailyRow } from "@/lib/surge";

export const SIGNAL_THRESHOLDS = {
  clear: { rank: 0.95, z: 3.0 },
  flat: { rank: 0.6, z: 1.0 },
} as const;

export type SignalTier = "뚜렷함" | "약함" | "구분 안 됨";

export interface FestivalSignal {
  zPeak: number;
  rank: number;
  /** 전년 같은 달 자료가 20일 미만이면 null */
  yoyPeak: number | null;
  tier: SignalTier;
}

const DAY = 86400000;
const toTime = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
const toYmd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

function mad(xs: readonly number[]): number {
  const md = median(xs)!;
  return median(xs.map((x) => Math.abs(x - md)))!;
}

/** 표 한 칸에 들어가는 설명 — "z 4.50 · 1년 중 가장 붐빈 날 · 전년 같은 달 1.42배" */
export function signalNote(s: FestivalSignal): string {
  const top = (1 - s.rank) * 100;
  const rank = top < 0.5 ? "1년 중 가장 붐빈 날" : `1년 중 상위 ${top.toFixed(0)}%`;
  return `z ${s.zPeak.toFixed(2)} · ${rank}${s.yoyPeak !== null ? ` · 전년 같은 달 ${s.yoyPeak.toFixed(2)}배` : ""}`;
}

/** 전후 4주 창이 양쪽 다 차야 한다(lib/surge.ts 와 같은 조건). 모자라면 null */
export function festivalSignal(rows: readonly DailyRow[], start: string, end: string): FestivalSignal | null {
  const t0 = toTime(start), t1 = toTime(end);
  if (!(t1 >= t0)) return null;
  const by = new Map(rows.map((r) => [r.ymd, r]));
  const before: number[] = [], after: number[] = [];
  for (let k = 1; k <= 28; k++) {
    const a = by.get(toYmd(t0 - k * DAY));
    const b = by.get(toYmd(t1 + k * DAY));
    if (a) before.push(a.out);
    if (b) after.push(b.out);
  }
  if (before.length < 14 || after.length < 14) return null;
  const festOut: number[] = [];
  for (let t = t0; t <= t1; t += DAY) {
    const r = by.get(toYmd(t));
    if (r) festOut.push(r.out);
  }
  if (festOut.length === 0) return null;

  const win = [...before, ...after];
  const peak = Math.max(...festOut);
  // MAD 가 0 이면(창이 한 값뿐) z 가 무한대가 된다 — 1 로 두어 차이 자체를 본다
  const scale = 1.4826 * mad(win) || 1;
  const zPeak = (peak - median(win)!) / scale;

  const year: number[] = [];
  for (let t = t0 - 182 * DAY; t <= t1 + 182 * DAY; t += DAY) {
    const r = by.get(toYmd(t));
    if (r) year.push(r.out);
  }
  const rank = year.filter((v) => v <= peak).length / year.length;

  const prevY = String(+start.slice(0, 4) - 1), mm = start.slice(4, 6);
  const prev: number[] = [];
  for (let d = 1; d <= 31; d++) {
    const r = by.get(`${prevY}${mm}${String(d).padStart(2, "0")}`);
    if (r) prev.push(r.out);
  }
  const yoyPeak = prev.length >= 20 ? peak / median(prev)! : null;

  const { clear, flat } = SIGNAL_THRESHOLDS;
  const tier: SignalTier = rank >= clear.rank && zPeak >= clear.z ? "뚜렷함" : rank < flat.rank && zPeak < flat.z ? "구분 안 됨" : "약함";
  return { zPeak, rank, yoyPeak, tier };
}
