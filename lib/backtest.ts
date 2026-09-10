// −52주 근사 백테스트 — "내년 배수 구간"이 다음 해 실측을 덮는 비율을 근사로 잰다 (verdict 2026-09-09 §4 M5).
//
// 왜 근사인가. 619건은 축제당 1행이고 TourAPI 는 과거 연도를 거의 남기지 않아 같은 축제의 다년 표본이
// 0건이다(군포 3개년만 예외). 그래서 각 축제의 올해 기간을 −364·−728일 옮긴 창을 "근사 전 회차"로 삼는다.
// 364 = 52주라 요일이 맞는다. 주말 고정 축제는 이 창이 곧 작년 기간이고, 날짜 고정 축제는 하루 이틀 어긋난다.
//
// 필터. 옮긴 창의 최대일 배수가 ≥1.3 일 때만 "그 해에도 축제가 있었다"고 본다(채택). 채택 0이면 표본에서 뺀다.
// 이 필터는 KT 유동인구에서 신호가 잡힐 만큼 크고 날짜가 정렬된 축제만 남겨 표본을 그쪽으로 쏠리게 한다.
// 그런 축제는 해마다 규모가 안정적이라 적중률을 올린다(상향). 반대로 −52주 근사 자체는 실제 기간과 어긋날 수
// 있어 적중률을 낮춘다(하향). 두 편향은 방향이 반대이고 어느 쪽이 큰지는 재지 않았다 — 화면·문서에 그대로 적는다.
//
// 구간 규칙은 제품과 같다. n=2(두 창 채택)는 lib/range.ts 의 바깥 반올림 구간, n=1(−364만 채택)은
// lib/verdict.ts 3단계처럼 또래 상위 5% 를 위쪽 끝으로 둔다(자기 자신은 또래에서 뺀다).
// 30건 미만이면 백분율을 만들지 않는다 (verdict §1.4 프리모템 2).
//
// 여기서 나가는 것은 배수와 건수뿐이다. 명 수는 없다.
// HANDOFF 의 "이력 기간은 담당자 입력, 자동 탐지 없음"은 제품 입력 규칙이고 이 방법 검증에는 적용하지 않는다.

import { FESTIVALS } from "@/lib/festivals";
import { loadDaily, sigunguCode } from "@/lib/kto/daily";
import { computeSurge } from "@/lib/surge";
import { outwardBand, type Band } from "@/lib/range";
import { peerBandFor } from "@/lib/peerband";
import { GUNPO_2027 } from "@/lib/checkquery";

export const SHIFT_DAYS = [364, 728] as const;
/** 옮긴 창의 최대일 배수가 이 값 이상이어야 "근사 전 회차"로 채택한다 */
export const PRIOR_PEAK_MIN = 1.3;
/** 이보다 작은 표본에는 백분율을 내지 않는다 */
export const MIN_SAMPLE_FOR_PERCENT = 30;

export interface CoverGroup {
  n: number;
  hitsPeak: number;
  hitsMean: number;
  /** n < MIN_SAMPLE_FOR_PERCENT 면 null */
  coverPeak: number | null;
  coverMean: number | null;
}

export interface GroupStats {
  n: number;
  /** 시군구 인구(만 명) 평균 */
  meanPop: number | null;
  /** 올해 최대일 배수 평균 */
  meanPeak: number | null;
  meanMean: number | null;
}

export interface BacktestRow {
  id: string;
  name: string;
  pop: number;
  thisPeak: number;
  thisMean: number;
  prior364: number | null;
  prior728: number | null;
  kind: "n2" | "n1" | "only728" | "noWindow" | "noSurge";
  bandPeak: Band | null;
  hitPeak: boolean | null;
  hitMean: boolean | null;
}

export interface GunpoRow {
  actualYears: string[];
  actualPeak: number[];
  actualMean: number[];
  /** 2026 기간을 −364·−728 옮긴 창의 최대일 배수 */
  approxPeak: (number | null)[];
  /** 2024·2025 실측 구간이 2026 을 덮는가 */
  actualCoverPeak: boolean;
  actualCoverMean: boolean;
  /** 근사 구간(−364·−728)이 2026 을 덮는가 */
  approxCoverPeak: boolean | null;
  /** −364 근사 최대일 배수 − 2025 실측 최대일 배수 (n=1) */
  approxMinusActualPeak: number;
}

export interface BacktestReport {
  total: number;
  n1: CoverGroup;
  n2: CoverGroup;
  excluded: { noSurge: number; noWindow: number; only728: number };
  groups: { passed: GroupStats; failed: GroupStats };
  gunpo: GunpoRow;
  rows: BacktestRow[];
  dataFrom: string;
  dataTo: string;
}

const DAY = 86400000;
function shiftYmd(ymd: string, days: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) - days * DAY;
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}

const within = (b: Band | null, v: number) => (b === null ? null : b.lo <= v && v <= b.hi);
const ratio = (hits: number, n: number) => (n >= MIN_SAMPLE_FOR_PERCENT ? hits / n : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function group(rows: BacktestRow[]): CoverGroup {
  const n = rows.length;
  const hitsPeak = rows.filter((r) => r.hitPeak === true).length;
  const hitsMean = rows.filter((r) => r.hitMean === true).length;
  return { n, hitsPeak, hitsMean, coverPeak: ratio(hitsPeak, n), coverMean: ratio(hitsMean, n) };
}

function stats(rows: BacktestRow[]): GroupStats {
  return {
    n: rows.length,
    meanPop: avg(rows.map((r) => r.pop)),
    meanPeak: avg(rows.map((r) => r.thisPeak)),
    meanMean: avg(rows.map((r) => r.thisMean)),
  };
}

export function backtestRange(): BacktestReport {
  const rows: BacktestRow[] = [];
  let dataFrom = "99999999";
  let dataTo = "00000000";

  for (const f of FESTIVALS) {
    const code = sigunguCode(f.sido, f.sigungu);
    const daily = code ? loadDaily(code) : [];
    if (daily.length) {
      if (daily[0].ymd < dataFrom) dataFrom = daily[0].ymd;
      if (daily[daily.length - 1].ymd > dataTo) dataTo = daily[daily.length - 1].ymd;
    }
    const base = { id: f.id, name: f.name, pop: f.populationManMyeong };
    const cur = computeSurge({ rows: daily, start: f.eventStartDate, end: f.eventEndDate });
    if (!cur.ok) {
      rows.push({ ...base, thisPeak: NaN, thisMean: NaN, prior364: null, prior728: null, kind: "noSurge", bandPeak: null, hitPeak: null, hitMean: null });
      continue;
    }
    const prior = SHIFT_DAYS.map((d) => {
      const r = computeSurge({ rows: daily, start: shiftYmd(f.eventStartDate, d), end: shiftYmd(f.eventEndDate, d) });
      return r.ok ? { peak: r.multPeak, mean: r.multMean } : null;
    });
    const ok364 = prior[0] !== null && prior[0].peak >= PRIOR_PEAK_MIN;
    const ok728 = prior[1] !== null && prior[1].peak >= PRIOR_PEAK_MIN;
    const row: BacktestRow = {
      ...base,
      thisPeak: cur.multPeak,
      thisMean: cur.multMean,
      prior364: prior[0]?.peak ?? null,
      prior728: prior[1]?.peak ?? null,
      kind: "noWindow",
      bandPeak: null,
      hitPeak: null,
      hitMean: null,
    };
    if (ok364 && ok728) {
      row.kind = "n2";
      row.bandPeak = outwardBand([prior[0]!.peak, prior[1]!.peak]);
      const bandMean = outwardBand([prior[0]!.mean, prior[1]!.mean]);
      row.hitPeak = within(row.bandPeak, cur.multPeak);
      row.hitMean = within(bandMean, cur.multMean);
    } else if (ok364) {
      row.kind = "n1";
      const peer = peerBandFor(f.populationManMyeong, f.id);
      const hiPeak = Math.max(prior[0]!.peak, peer?.peakP95 ?? prior[0]!.peak);
      const hiMean = Math.max(prior[0]!.mean, peer?.meanP95 ?? prior[0]!.mean);
      row.bandPeak = outwardBand([prior[0]!.peak, hiPeak]);
      row.hitPeak = within(row.bandPeak, cur.multPeak);
      row.hitMean = within(outwardBand([prior[0]!.mean, hiMean]), cur.multMean);
    } else if (ok728) {
      row.kind = "only728";
    }
    rows.push(row);
  }

  const n2 = rows.filter((r) => r.kind === "n2");
  const n1 = rows.filter((r) => r.kind === "n1");
  const passed = [...n1, ...n2];
  const failed = rows.filter((r) => r.kind === "noWindow" || r.kind === "only728");

  return {
    total: rows.length,
    n1: group(n1),
    n2: group(n2),
    excluded: {
      noSurge: rows.filter((r) => r.kind === "noSurge").length,
      noWindow: rows.filter((r) => r.kind === "noWindow").length,
      only728: rows.filter((r) => r.kind === "only728").length,
    },
    groups: { passed: stats(passed), failed: stats(failed) },
    gunpo: gunpoRow(),
    rows,
    dataFrom,
    dataTo,
  };
}

/** 군포 3개년 — 실제 다년 표본 유일 사례. 근사와 실측을 맞대 보되 n=1 이라 일반화하지 않는다 */
function gunpoRow(): GunpoRow {
  const daily = loadDaily("41410");
  const hist = [...GUNPO_2027.history].sort((a, b) => (a.year < b.year ? -1 : 1));
  const actual = hist.map((h) => computeSurge({ rows: daily, start: h.start, end: h.end }));
  const peaks = actual.map((r) => (r.ok ? r.multPeak : NaN));
  const means = actual.map((r) => (r.ok ? r.multMean : NaN));
  const latest = hist[hist.length - 1];
  const approx = SHIFT_DAYS.map((d) => {
    const r = computeSurge({ rows: daily, start: shiftYmd(latest.start, d), end: shiftYmd(latest.end, d) });
    return r.ok ? r.multPeak : null;
  });
  const priorPeaks = peaks.slice(0, -1);
  const priorMeans = means.slice(0, -1);
  const thisPeak = peaks[peaks.length - 1];
  const thisMean = means[means.length - 1];
  const approxBand = approx[0] !== null && approx[1] !== null ? outwardBand([approx[0], approx[1]]) : null;
  return {
    actualYears: hist.map((h) => h.year),
    actualPeak: peaks,
    actualMean: means,
    approxPeak: approx,
    actualCoverPeak: within(outwardBand(priorPeaks), thisPeak) === true,
    actualCoverMean: within(outwardBand(priorMeans), thisMean) === true,
    approxCoverPeak: within(approxBand, thisPeak),
    approxMinusActualPeak: (approx[0] ?? NaN) - peaks[peaks.length - 2],
  };
}

/** 화면·문서에 나가는 게시값. 데이터가 바뀌면 lib/backtest.test.ts 가 먼저 깨진다 */
export const RANGE_BACKTEST_PUBLISHED = {
  // 2026-09-10 · 자료 2019-05-01~2026-08-09 · scripts/range-backtest.mjs
  total: 619,
  n1: { n: 56, hitsPeak: 31, hitsMean: 34, coverPeak: 31 / 56 as number | null, coverMean: 34 / 56 as number | null },
  n2: { n: 325, hitsPeak: 167, hitsMean: 190, coverPeak: 167 / 325 as number | null, coverMean: 190 / 325 as number | null },
  excluded: { noSurge: 0, noWindow: 182, only728: 56 },
  groups: {
    passed: { n: 381, meanPop: 26.593963254593174 as number | null, meanPeak: 1.7948030301936566 as number | null, meanMean: 1.4128751993560216 as number | null },
    failed: { n: 238, meanPop: 34.16386554621851 as number | null, meanPeak: 1.253116053318325 as number | null, meanMean: 1.1431753414602588 as number | null },
  },
};

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

function countText(g: { n: number; hitsPeak: number; coverPeak: number | null }): string {
  return g.coverPeak === null ? `${g.n}건 중 ${g.hitsPeak}건(30건 미만이라 백분율을 내지 않는다)` : `${g.n}건 중 ${g.hitsPeak}건(${pct1(g.coverPeak)})`;
}

/**
 * 세 요소(근사 · 표본 N건 · 편향 양방향)를 전부 담은 한 문단. 적중률은 표본으로 한정해 말한다.
 * 화면과 문서가 같은 함수를 부른다 — 어긋날 수 없다.
 */
export function backtestSentence(p: typeof RANGE_BACKTEST_PUBLISHED): string {
  const sample = p.n1.n + p.n2.n;
  return (
    `−52주 근사 백테스트(${p.total}건 각 기간을 −364·−728일 옮긴 창을 전 회차로 삼음, 최대일 배수 ≥${PRIOR_PEAK_MIN.toFixed(1)}인 창만 채택): ` +
    `표본 ${sample}건. −52주 근사로 탐지되는 대형 축제 표본에서의 최대일 구간 적중은 ` +
    `두 해 채택(n=2) ${countText(p.n2)}, 한 해 + 또래 상위 5%(n=1) ${countText(p.n1)}. ` +
    `편향이 양방향이다. 필터가 만드는 상향 편향과 −52주 근사가 만드는 하향 편향은 서로 반대 방향이며, 어느 쪽이 큰지는 재지 않았다. ` +
    `같은 축제의 실제 다년 표본은 군포 한 건뿐이라 이 값을 일반 적중률로 읽지 않는다.`
  );
}
