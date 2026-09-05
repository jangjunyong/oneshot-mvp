// 축제 방문객 산출식 — 시군구 전체 유동인구(KT 일별)에서 축제 몫을 뽑는다.
//
// 이 파일이 제품의 단일 정의다. 619건 재계산(scripts/recompute619.mjs)과
// 화면(/evidence, /check)이 같은 함수를 쓴다. 정의가 두 개가 되면 쌍둥이와
// 자기 이력이 다른 자로 재게 되므로, 배수를 계산하는 코드는 여기 말고 두지 않는다.
//
// 정의 (기획/09 §2):
//   B_all        = 축제 전후 각 4주(축제일 제외) 외지인의 중앙값        — 배수의 분모. 619건과 같은 정의
//   B_dow(d)     = 같은 요일만 모은 전후 4주 외지인의 중앙값          — 순증의 분모. 요일 효과 제거
//   ΔV(d)        = V_out(d) − B_dow(d)                                 — 그날 축제가 끌어온 외지인
//   ΔL(d)        = V_loc(d) − B_dow_loc(d)                             — 현지인 순증(보통 ≈0)
//   방문(일)     = ΔV(d) + max(0, ΔL(d))
//   방문(기간)   = Σ 방문(일)                                          — 연인원. 음수 날은 0 으로 두지 않고 그대로 더한다
//   배수(평균)   = mean(V_out, 축제일) / B_all
//   배수(최대일) = max(V_out, 축제일) / B_all
//
// 배수와 순증의 분모가 다른 이유: 배수는 쌍둥이 619건과 비교해야 하므로 그쪽 정의(전 요일 중앙값)를
// 따르고, 순증은 "토요일이라 원래 많다"를 걷어내야 하므로 요일별 중앙값을 쓴다.
// 군포 2025 로 두 값을 다 검산했다 (surge.test.ts).

export interface DailyRow {
  /** YYYYMMDD */
  ymd: string;
  /** 현지인 체류 */
  loc: number;
  /** 외지인 체류 — 배수·순증의 대상 */
  out: number;
  /** 외국인 체류 — 참고용 */
  frn: number;
}

export interface SurgeInput {
  rows: readonly DailyRow[];
  /** 축제 첫날 YYYYMMDD */
  start: string;
  /** 축제 마지막날 YYYYMMDD (포함) */
  end: string;
  /** 전후 창 주 수. 기본 4 */
  weeks?: number;
}

export interface SurgeDay {
  ymd: string;
  /** 0 일요일 … 6 토요일 */
  dow: number;
  out: number;
  loc: number;
  baseDow: number | null;
  baseDowLoc: number | null;
  deltaOut: number | null;
  deltaLoc: number | null;
  /** V_out / B_all */
  mult: number;
}

export interface SurgeOk {
  ok: true;
  start: string;
  end: string;
  weeks: number;
  days: SurgeDay[];
  /** 전후 창 외지인 중앙값(전 요일) */
  baseline: number;
  /** 전후 창 주말(토·일) 외지인 중앙값 */
  baselineWeekend: number | null;
  meanOut: number;
  peakOut: number;
  peakYmd: string;
  multMean: number;
  multPeak: number;
  /** peakOut / baselineWeekend — "평소 주말 대비" */
  peakOverWeekend: number | null;
  /** max ΔV(d) */
  deltaPeak: number | null;
  deltaPeakYmd: string | null;
  /** Σ(ΔV + max(0,ΔL)) — 축제가 끌어온 연인원 */
  visitors: number | null;
  coverage: {
    festivalDays: number;
    festivalDaysPresent: number;
    windowDays: number;
    windowDaysPresent: number;
  };
}

export type SurgeFail = {
  ok: false;
  reason: "no-festival-days" | "insufficient-window" | "bad-range";
  coverage: SurgeOk["coverage"];
};

export type SurgeResult = SurgeOk | SurgeFail;

const DAY = 86400000;

function toTime(ymd: string): number {
  return Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
}
function toYmd(t: number): string {
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}
function dowOf(ymd: string): number {
  return new Date(toTime(ymd)).getUTCDay();
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 순수 함수. 같은 입력이면 같은 출력 — 난수·시각·외부 호출이 없다.
 * rows 는 정렬돼 있지 않아도 되고, 창 밖 날짜가 섞여 있어도 된다.
 */
export function computeSurge(input: SurgeInput): SurgeResult {
  const weeks = input.weeks ?? 4;
  const t0 = toTime(input.start);
  const t1 = toTime(input.end);
  const festivalDays = Math.round((t1 - t0) / DAY) + 1;
  const empty = { festivalDays: Math.max(0, festivalDays), festivalDaysPresent: 0, windowDays: 0, windowDaysPresent: 0 };
  if (!(t1 >= t0) || Number.isNaN(t0) || Number.isNaN(t1)) {
    return { ok: false, reason: "bad-range", coverage: empty };
  }

  const byYmd = new Map<string, DailyRow>();
  for (const r of input.rows) byYmd.set(r.ymd, r);

  // 창: 축제 전 weeks 주 + 축제 후 weeks 주 (축제일 제외)
  const win: DailyRow[] = [];
  const windowDays = weeks * 7 * 2;
  for (let k = 1; k <= weeks * 7; k++) {
    const a = byYmd.get(toYmd(t0 - k * DAY));
    const b = byYmd.get(toYmd(t1 + k * DAY));
    if (a) win.push(a);
    if (b) win.push(b);
  }
  const fest: DailyRow[] = [];
  for (let t = t0; t <= t1; t += DAY) {
    const r = byYmd.get(toYmd(t));
    if (r) fest.push(r);
  }
  const coverage = {
    festivalDays,
    festivalDaysPresent: fest.length,
    windowDays,
    windowDaysPresent: win.length,
  };
  if (fest.length === 0) return { ok: false, reason: "no-festival-days", coverage };
  // 창이 반도 안 차면 중앙값이 "평소"를 대표하지 못한다.
  if (win.length < Math.ceil(windowDays / 2)) return { ok: false, reason: "insufficient-window", coverage };

  const baseline = median(win.map((r) => r.out))!;
  const baselineWeekend = median(win.filter((r) => [0, 6].includes(dowOf(r.ymd))).map((r) => r.out));

  const byDowOut = new Map<number, number[]>();
  const byDowLoc = new Map<number, number[]>();
  for (const r of win) {
    const d = dowOf(r.ymd);
    (byDowOut.get(d) ?? byDowOut.set(d, []).get(d)!).push(r.out);
    (byDowLoc.get(d) ?? byDowLoc.set(d, []).get(d)!).push(r.loc);
  }

  const days: SurgeDay[] = fest.map((r) => {
    const dow = dowOf(r.ymd);
    const bo = byDowOut.get(dow) ?? [];
    const bl = byDowLoc.get(dow) ?? [];
    // 같은 요일이 둘은 있어야 중앙값이 한 점에 끌려가지 않는다.
    const baseDow = bo.length >= 2 ? median(bo) : null;
    const baseDowLoc = bl.length >= 2 ? median(bl) : null;
    return {
      ymd: r.ymd,
      dow,
      out: r.out,
      loc: r.loc,
      baseDow,
      baseDowLoc,
      deltaOut: baseDow === null ? null : r.out - baseDow,
      deltaLoc: baseDowLoc === null ? null : r.loc - baseDowLoc,
      mult: r.out / baseline,
    };
  });

  const meanOut = fest.reduce((s, r) => s + r.out, 0) / fest.length;
  let peak = fest[0];
  for (const r of fest) if (r.out > peak.out) peak = r;

  let deltaPeak: number | null = null;
  let deltaPeakYmd: string | null = null;
  let visitors: number | null = null;
  const withDelta = days.filter((d) => d.deltaOut !== null);
  if (withDelta.length === days.length) {
    visitors = 0;
    for (const d of days) {
      visitors += d.deltaOut! + Math.max(0, d.deltaLoc ?? 0);
      if (deltaPeak === null || d.deltaOut! > deltaPeak) {
        deltaPeak = d.deltaOut!;
        deltaPeakYmd = d.ymd;
      }
    }
  }

  return {
    ok: true,
    start: input.start,
    end: input.end,
    weeks,
    days,
    baseline,
    baselineWeekend,
    meanOut,
    peakOut: peak.out,
    peakYmd: peak.ymd,
    multMean: meanOut / baseline,
    multPeak: peak.out / baseline,
    peakOverWeekend: baselineWeekend === null ? null : peak.out / baselineWeekend,
    deltaPeak,
    deltaPeakYmd,
    visitors,
    coverage,
  };
}
