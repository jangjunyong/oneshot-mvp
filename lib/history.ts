// 자기 이력 — 한 축제의 지난 회차들을 lib/surge.ts 한 정의로 재서 판정 엔진(lib/verdict.ts)의
// HistoryYear 로 만든다. 순수 함수. 파일·API 를 모른다.
//
// 이력의 "기간"은 담당자 입력이다 — KT 자료는 시군구 유동인구라 축제가 언제였는지를 모른다.
// 잘못된 기간을 넣으면 그 해는 빠지고 이유가 남는다. 짐작해서 채우지 않는다.

import { computeSurge, type DailyRow } from "@/lib/surge";
import type { HistoryYear } from "@/lib/verdict";

export interface Period {
  /** 표시용 연도. 보통 start 의 앞 4자리 */
  year: string;
  /** YYYYMMDD */
  start: string;
  end: string;
  /** 견본 픽스처가 이 기간을 어디서 가져왔는지 (기사·공지·조회일). 담당자 입력엔 없다 */
  source?: string;
}

export interface HistorySkip {
  period: Period;
  reason: "bad-range" | "no-festival-days" | "insufficient-window";
}

export interface History {
  years: HistoryYear[];
  skipped: HistorySkip[];
}

/** 화면에 내는 건너뜀 사유 — 영문 enum 을 그대로 노출하지 않는다 (2026-09-11 실사용 지적) */
export const SKIP_REASON: Record<HistorySkip["reason"], string> = {
  "bad-range": "날짜 순서가 맞지 않음",
  "no-festival-days": "그 기간의 일별 자료가 없음",
  "insufficient-window": "앞뒤 4주 자료가 절반도 없음",
};

/** 한 해. 산출이 안 서면 null */
export function historyYear(rows: readonly DailyRow[], period: Period, fetchedAt: string): HistoryYear | null {
  const r = computeSurge({ rows, start: period.start, end: period.end });
  if (!r.ok) return null;
  let maxDay = r.days[0];
  for (const d of r.days) if (d.total > maxDay.total) maxDay = d;
  return {
    year: period.year,
    start: period.start,
    end: period.end,
    baseline: r.baseline,
    baselineWeekend: r.baselineWeekend,
    multMean: r.multMean,
    multPeak: r.multPeak,
    peakOut: r.peakOut,
    peakYmd: r.peakYmd,
    maxDayTotal: maxDay.total,
    maxDayTotalYmd: maxDay.ymd,
    festivalDays: r.coverage.festivalDays,
    periodOutSum: r.periodOutSum,
    periodTotal: r.periodTotal,
    visitors: r.visitors,
    fetchedAt,
  };
}

/** 여러 해. 연도 오름차순으로 돌려준다 */
export function historyOf(rows: readonly DailyRow[], periods: readonly Period[], fetchedAt: string): History {
  const years: HistoryYear[] = [];
  const skipped: HistorySkip[] = [];
  for (const p of periods) {
    const y = historyYear(rows, p, fetchedAt);
    if (y) years.push(y);
    else {
      const r = computeSurge({ rows, start: p.start, end: p.end });
      skipped.push({ period: p, reason: r.ok ? "bad-range" : r.reason });
    }
  }
  years.sort((a, b) => (a.year < b.year ? -1 : 1));
  return { years, skipped };
}

/** "2025-04-19" → "20250419" — 폼 값과 KT 날짜 사이 */
export function ymdCompact(s: string): string {
  return s.replace(/-/g, "").trim();
}
export function ymdDashed(s: string): string {
  const c = ymdCompact(s);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}` : s;
}
export function isYmd(s: string): boolean {
  const c = ymdCompact(s);
  if (!/^\d{8}$/.test(c)) return false;
  const t = Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8));
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "") === c;
}
