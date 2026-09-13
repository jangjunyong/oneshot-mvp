// 공휴일 달력 — 축제 신호(lib/signal.ts)가 "평소"에서 명절·공휴일을 빼고, 축제가 명절과 겹치는지 표시하는 데 쓴다.
// 자료: data/calendar/holidays.json (scripts/holidays-build.mjs, 우주항공청 월력요항). 순수 함수 + 정적 JSON.

import cal from "@/data/calendar/holidays.json";

const DATES = (cal as { dates: Record<string, string[]> }).dates;
const DAY = 86400000;
const toTime = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
const toYmd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const isWeekend = (ymd: string) => [0, 6].includes(new Date(toTime(ymd)).getUTCDay());

export const HOLIDAY_SOURCE = (cal as { source: string }).source;
export const HOLIDAY_YEARS = (cal as { years: number[] }).years;

/** 그날의 공휴일 이름들. 평일·주말이면 [] */
export function holidayNames(ymd: string): string[] {
  return DATES[ymd] ?? [];
}

export const isLunarHoliday = (names: readonly string[]) => names.some((n) => /설날|추석/.test(n));

export type HolidayKind = "lunar" | "all";

/** 설·추석(전날·다음 날·대체공휴일 포함)만 남긴 이름 */
export function lunarHolidayNames(ymd: string): string[] {
  return holidayNames(ymd).filter((n) => /설날|추석/.test(n));
}

/**
 * 연휴 덩어리 — 공휴일(kind=lunar 면 설·추석과 그 대체공휴일만)과, 거기 잇닿은 토·일까지.
 * 추석이 목~토면 일요일까지 한 덩어리로 사람이 움직이므로 주말도 같이 뺀다. 주말끼리만 이어진 날은 넣지 않는다
 */
export function holidayBlock(kind: HolidayKind): ReadonlySet<string> {
  const seed = Object.entries(DATES)
    .filter(([, names]) => kind === "all" || isLunarHoliday(names))
    .map(([d]) => d);
  const out = new Set<string>(seed);
  for (const d of seed) {
    for (const dir of [-1, 1]) {
      let t = toTime(d) + dir * DAY;
      // 공휴일·주말이 이어지는 동안 넓힌다
      while (true) {
        const y = toYmd(t);
        const names = DATES[y];
        const holiday = names && (kind === "all" || isLunarHoliday(names));
        if (!holiday && !isWeekend(y)) break;
        out.add(y);
        t += dir * DAY;
      }
    }
  }
  return out;
}

/**
 * 화면이 축제 신호에 넘기는 달력 — 설·추석 연휴 덩어리를 평소에서 빼고, 겹침도 설·추석만 적는다 (2026-09-14 실측으로 골랐다).
 * 619건 진짜 vs 옮긴 가짜 1,818건: 보정 없음 zPeak AUC 0.605 · 설·추석 제외 0.624 · 공휴일 전체 제외 0.620.
 * 공휴일 전체를 빼면 가짜도 "뚜렷함"이 17.8% 로 부풀고(설·추석만 13.7%), 5월 축제마다 어린이날 겹침이 붙어 표시가 흐려진다
 */
export const SIGNAL_CALENDAR = { exclude: holidayBlock("lunar"), namesOf: lunarHolidayNames } as const;
