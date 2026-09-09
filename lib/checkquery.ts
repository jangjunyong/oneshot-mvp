// /check · /evidence 의 입력은 URL 이다 — 저장 없이 같은 링크면 같은 판정(결정론)이고,
// 자바스크립트 없는 e2e 가 그대로 검증한다. 여기서 URL 을 읽고 되돌려 쓴다. 순수 함수.
//
// 아무 입력도 없으면 군포 2027 견본이 선다 — 심사위원의 시크릿 창에서도 첫 화면이 비지 않게.

import type { Basis, Counting } from "@/lib/verdict";
import { isYmd, ymdCompact, type Period } from "@/lib/history";

export interface CheckQuery {
  name: string;
  sido: string;
  sigungu: string;
  /** 예상 방문객. 비었으면 null */
  n: number | null;
  basis: Basis | null;
  counting: Counting | null;
  /** 기획 기간 YYYYMMDD. 비었으면 "" */
  start: string;
  end: string;
  /** 이력 기간 — 담당자가 아는 지난 회차 날짜. 최대 3 */
  history: Period[];
}

export const HISTORY_SLOTS = 3;

/** 견본 — 군포철쭉축제 2027 기획안. 예상 방문객은 2025 발표 최다일 217,502(일 최다·연인원) */
export const GUNPO_2027: CheckQuery = {
  name: "군포철쭉축제",
  sido: "경기",
  sigungu: "군포시",
  n: 217502,
  basis: "peakDay",
  counting: "personDays",
  start: "20270417",
  end: "20270425",
  history: [
    { year: "2024", start: "20240420", end: "20240428" },
    { year: "2025", start: "20250419", end: "20250427" },
    { year: "2026", start: "20260418", end: "20260426" },
  ],
};

type Params = Record<string, string | string[] | undefined>;
const str = (p: Params, k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");

export interface ParsedCheck {
  query: CheckQuery;
  isDemo: boolean;
  /** 담당자가 고쳐야 하는 것. 비어 있으면 판정으로 간다 */
  errors: string[];
}

export function parseCheckQuery(params: Params): ParsedCheck {
  const touched = ["sigungu", "n", "start", "name", "sido"].some((k) => str(params, k) !== "");
  if (!touched) return { query: GUNPO_2027, isDemo: true, errors: [] };

  const errors: string[] = [];
  const nRaw = str(params, "n").replace(/,/g, "");
  const n = nRaw === "" ? null : Number(nRaw);
  if (n !== null && !(n > 0 && Number.isFinite(n))) errors.push("예상 방문객은 0보다 큰 숫자여야 합니다");

  const basisRaw = str(params, "basis");
  const basis: Basis | null = basisRaw === "period" || basisRaw === "peakDay" ? basisRaw : null;
  const countingRaw = str(params, "counting");
  const counting: Counting | null = countingRaw === "personDays" || countingRaw === "unique" ? countingRaw : null;

  const date = (k: string) => {
    const v = str(params, k);
    if (v === "") return "";
    if (!isYmd(v)) {
      errors.push(`${k} 날짜 형식이 아닙니다 (YYYY-MM-DD)`);
      return "";
    }
    return ymdCompact(v);
  };
  const start = date("start");
  const end = date("end");
  if (start && end && end < start) errors.push("기획 기간의 끝이 시작보다 앞섭니다");

  const history: Period[] = [];
  for (let i = 1; i <= HISTORY_SLOTS; i++) {
    const s = date(`h${i}s`);
    const e = date(`h${i}e`);
    if (!s && !e) continue;
    if (!s || !e) {
      errors.push(`이력 ${i}: 시작과 끝을 둘 다 적어 주세요`);
      continue;
    }
    if (e < s) {
      errors.push(`이력 ${i}: 끝이 시작보다 앞섭니다`);
      continue;
    }
    history.push({ year: s.slice(0, 4), start: s, end: e });
  }

  const sido = str(params, "sido");
  const sigungu = str(params, "sigungu");
  if (!sido || !sigungu) errors.push("시도와 시군구를 적어 주세요");

  return {
    query: { name: str(params, "name"), sido, sigungu, n, basis, counting, start, end, history },
    isDemo: false,
    errors,
  };
}

/** 같은 입력을 다른 화면(/evidence ↔ /check)으로 옮기는 쿼리 문자열 */
export function checkQueryString(q: CheckQuery, isDemo: boolean): string {
  if (isDemo) return "";
  const dash = (s: string) => (s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);
  const p = new URLSearchParams();
  if (q.name) p.set("name", q.name);
  p.set("sido", q.sido);
  p.set("sigungu", q.sigungu);
  if (q.n !== null) p.set("n", String(q.n));
  if (q.basis) p.set("basis", q.basis);
  if (q.counting) p.set("counting", q.counting);
  if (q.start) p.set("start", dash(q.start));
  if (q.end) p.set("end", dash(q.end));
  q.history.forEach((h, i) => {
    p.set(`h${i + 1}s`, dash(h.start));
    p.set(`h${i + 1}e`, dash(h.end));
  });
  return "?" + p.toString();
}
