// /check · /evidence 의 입력은 URL 이다 — 저장 없이 같은 링크면 같은 판정(결정론)이고,
// 자바스크립트 없는 e2e 가 그대로 검증한다. 여기서 URL 을 읽고 되돌려 쓴다. 순수 함수.
//
// 아무 입력도 없으면 군포 2027 견본이 선다 — 심사위원의 시크릿 창에서도 첫 화면이 비지 않게.

import type { Basis, Counting } from "@/lib/verdict";
import type { Extraction } from "@/lib/types";
import { isYmd, ymdCompact, type Period } from "@/lib/history";

export interface CheckQuery {
  name: string;
  sido: string;
  sigungu: string;
  /** 예상 방문객. 비었으면 null */
  n: number | null;
  basis: Basis | null;
  counting: Counting | null;
  /** 기획안 총예산(만 원). 비었으면 null. lib/extract.ts 의 budgetManWon 과 같은 단위 */
  budgetManWon: number | null;
  /**
   * 지역 인구(만 명, 행안부 주민등록). 담당자 입력. 비었으면 null 이고 화면은 619건에서 찾는다.
   * 619건은 KT 시군구 299곳 중 178곳만 덮는다(2026-09-11 집계) — 나머지 121곳은 이 칸이 없으면 또래 구간이 안 선다
   */
  populationManMyeong: number | null;
  /** 기획 기간 YYYYMMDD. 비었으면 "" */
  start: string;
  end: string;
  /** 이력 기간 — 담당자가 아는 지난 회차 날짜. 최대 3 */
  history: Period[];
}

export const HISTORY_SLOTS = 3;

/** 견본 예산의 출처 표기 — 공개된 예산 수치를 못 찾아(군포시·문화재단·뉴스 2026-09-10 검색) 가정값이다 */
export const DEMO_BUDGET_SOURCE = "기획안(견본 가정값 · 출처 없음)";

/**
 * 견본 1 — 군포철쭉축제 2027 기획안. 예상 방문객은 군포시가 공개한 2026 목표 60만(경인일보 2026-04-17,
 * https://www.kyeongin.com/article/1762035 — 기사가 단위를 적지 않아 기간 총계·연인원으로 읽었다). 예산 10억은 가정값.
 * 2025 발표 최다일 217,502 는 유닛 회귀(lib/verdict.test.ts)에 남아 있다 — 엔진이 "상한 초과"를 낼 수 있다는 증거다.
 */
export const GUNPO_2027: CheckQuery = {
  name: "군포철쭉축제",
  sido: "경기",
  sigungu: "군포시",
  n: 600000,
  basis: "period",
  counting: "personDays",
  budgetManWon: 100000,
  // 619건에 군포시 축제가 없어 인구를 못 찾는다 — 2026-09-11 까지는 같은 시도 폴백(양평군 12.7만)이 몰래 받쳤다. 출처는 DEMOS.populationSource
  populationManMyeong: 24.9,
  start: "20270417",
  end: "20270425",
  history: [
    { year: "2024", start: "20240420", end: "20240428", source: "군포문화재단 축제 안내(gunpocf.or.kr) · 조회 2026-09-05" },
    { year: "2025", start: "20250419", end: "20250427", source: "군포철쭉축제 공식(gunpofestival.org) 2025 일정 · 조회 2026-09-05" },
    { year: "2026", start: "20260418", end: "20260426", source: "경인일보 2026-04-17 · 조회 2026-09-10" },
  ],
};

/**
 * 견본 2 — 화천산천어축제 2027 기획안. 문체부 2026~2027 문화관광축제 글로벌축제. 예상 방문객은 2025 발표 실적 186만
 * (경향신문 2025-02-02, https://www.khan.co.kr/article/202502021945001)을 기간 총계·연인원으로 그대로 옮긴 값 —
 * 담당자가 작년 발표치를 복사하는 흔한 기획안을 흉내 낸 것. 예산은 공개 수치를 못 찾아 비웠다(2026-09-10 검색).
 */
export const HWACHEON_2027: CheckQuery = {
  name: "화천산천어축제",
  sido: "강원",
  sigungu: "화천군",
  n: 1860000,
  basis: "period",
  counting: "personDays",
  budgetManWon: null,
  // 619건에 화천군 축제가 없다. 출처는 DEMOS.populationSource
  populationManMyeong: 2.3,
  start: "20270109",
  end: "20270131",
  history: [
    { year: "2024", start: "20240106", end: "20240128", source: "화천군 공지(ihc.go.kr) 2024 축제 기간 · 조회 2026-09-10" },
    { year: "2025", start: "20250111", end: "20250202", source: "경향신문 2025-02-02 폐막 기사 · 조회 2026-09-10" },
    { year: "2026", start: "20260110", end: "20260201", source: "아주경제 2026-02-02 폐막 기사 · 조회 2026-09-10" },
  ],
};

export type DemoKey = "gunpo" | "hwacheon";

export interface Demo {
  key: DemoKey;
  query: CheckQuery;
  /** 화면 배너. 예상 방문객의 출처와 단위 판단, 이력 연도, 예산 처리를 한 문단에 */
  banner: string;
  /** 예상 방문객 숫자의 출처 한 줄 */
  claimSource: string;
  /** 왜 이 축제인가 (심사위원의 "왜 군포입니까"에 대한 답) */
  why: string;
  /** 문체부 문화관광축제(글로벌·예비·지정) 여부 */
  designated: boolean;
  /** query.populationManMyeong 의 출처 한 줄 (기관·기준월·조회일). 견본 인구는 619건이 아니라 여기서 온다 */
  populationSource: string;
  /** 닮은 축제(보조 근거) 5축 중 문서에서만 오는 둘 — 견본은 여기 박는다. 판정에는 안 쓴다 (2026-09-12 M3a-2) */
  themeCode: number;
  accessibility: number;
}

export const DEMOS: Record<DemoKey, Demo> = {
  gunpo: {
    key: "gunpo",
    query: GUNPO_2027,
    banner: "군포철쭉축제 2027 기획안. 예상 방문객 60만은 경인일보 2026-04-17 의 시 목표치, 예산 10억은 가정값.",
    claimSource: "경인일보 2026-04-17 「'목표 60만' 군포철쭉축제」(기사가 단위를 적지 않아 기간 총계·연인원으로 읽음)",
    why: "공사 KT 실측이 세 해(2024·2025·2026) 모두 있고, 발표 최다일 217,502(2025)가 시 전체 체류의 83%라는 정의 불일치를 처음 드러낸 사례",
    designated: false,
    populationSource: "군포시청 주민등록인구 24.9만(2026-07 기준, gunpo.go.kr) · 조회 2026-09-11",
    // 철쭉(자연·꽃) · 수리산역 도보권(접근성 좋음) — 견본 가정값
    themeCode: 2,
    accessibility: 4,
  },
  hwacheon: {
    key: "hwacheon",
    query: HWACHEON_2027,
    banner: "화천산천어축제 2027 기획안(문체부 글로벌축제). 예상 방문객 186만은 경향신문 2025-02-02 의 발표 실적을 그대로 옮긴 값.",
    claimSource: "경향신문 2025-02-02 「23일간 186만명 다녀갔다」(재단 집계 발표치, 단위 미기재 → 기간 총계·연인원으로 읽음)",
    why: "문체부 글로벌축제(지정축제)이고, 인구 2.3만 군에 23일간 186만이 온다는 발표치가 KT 실인원 상한과 어떻게 맞서는지 보여 주는 사례",
    designated: true,
    populationSource: "화천군청 년도별 주민등록인구 2.3만(2024년 기준, ihc.go.kr) · 조회 2026-09-11",
    // 겨울 얼음낚시(빛·계절) · 철도 없음, 셔틀 의존(접근성 나쁨) — 견본 가정값
    themeCode: 8,
    accessibility: 2,
  },
};

/**
 * 닮은 축제 블록이 읽는 주석 키 — 판정 결정론 경계(CHECK_KEYS) 밖이다.
 * `theme`·`acc` 는 619건 5축 중 문서에서만 오는 둘, `pin` 은 지도에서 고른 핀.
 * CHECK_KEYS 에 넣지 않는 이유: 넣으면 `/check?theme=2` 가 견본이 아니라 빈 입력이 되어 2026-09-11 회귀를 되풀이한다.
 */
export interface TwinParams {
  theme: number | null;
  acc: number | null;
  pin: string | null;
}

export function parseTwinParams(params: Params): TwinParams {
  const int = (k: string, lo: number, hi: number) => {
    const v = Number(str(params, k));
    return Number.isInteger(v) && v >= lo && v <= hi ? v : null;
  };
  return { theme: int("theme", 1, 8), acc: int("acc", 1, 5), pin: str(params, "pin") || null };
}

/**
 * 쿼리 문자열에 주석 키를 덧붙인다. `checkQueryString` 이 낸 "?…" 또는 "" 또는 "?demo=…" 를 그대로 받는다.
 * GET 폼은 쿼리를 통째로 갈아 끼우므로 링크는 이 함수로만 만든다 (견본 폴백 회귀 방지).
 */
export function appendQuery(qs: string, extra: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
  for (const [k, v] of Object.entries(extra)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
}

const DEMO_BY_NAME: Record<string, DemoKey> = { [GUNPO_2027.name]: "gunpo", [HWACHEON_2027.name]: "hwacheon" };

type Params = Record<string, string | string[] | undefined>;

/** 판정이 읽는 키 전부. `draft`·`demo` 같은 주석 키는 여기 없다 — 판정 결정론의 경계 */
export const CHECK_KEYS = ["name", "sido", "sigungu", "n", "basis", "counting", "budget", "pop", "start", "end", "h1s", "h1e", "h2s", "h2e", "h3s", "h3e"] as const;
const str = (p: Params, k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");

export interface ParsedCheck {
  query: CheckQuery;
  isDemo: boolean;
  /** 견본이면 어느 것인지. 담당자 입력이면 null */
  demo: DemoKey | null;
  /** 담당자가 고쳐야 하는 것. 비어 있으면 판정으로 간다 */
  errors: string[];
}

export function parseCheckQuery(params: Params): ParsedCheck {
  // 견본은 판정 파라미터가 하나도 없을 때만. 값이 비어 있어도 키가 있으면 담당자 입력이다 —
  // 2026-09-11 실사용: 기획서 다리가 `?sido=&sigungu=&budget=9000` 으로 왔는데 값이 비었다고 견본(군포)으로 떨어졌다
  const touched = CHECK_KEYS.some((k) => k in params);
  if (!touched) {
    const key: DemoKey = str(params, "demo") === "hwacheon" ? "hwacheon" : "gunpo";
    return { query: DEMOS[key].query, isDemo: true, demo: key, errors: [] };
  }

  const errors: string[] = [];
  const nRaw = str(params, "n").replace(/,/g, "");
  const n = nRaw === "" ? null : Number(nRaw);
  if (n !== null && !(n > 0 && Number.isFinite(n))) errors.push("예상 방문객은 0보다 큰 숫자여야 합니다");
  const budgetRaw = str(params, "budget").replace(/,/g, "");
  const budgetManWon = budgetRaw === "" ? null : Number(budgetRaw);
  if (budgetManWon !== null && !(budgetManWon > 0 && Number.isFinite(budgetManWon))) errors.push("예산은 0보다 큰 숫자(만 원)여야 합니다");
  const popRaw = str(params, "pop").replace(/,/g, "");
  const populationManMyeong = popRaw === "" ? null : Number(popRaw);
  if (populationManMyeong !== null && !(populationManMyeong > 0 && Number.isFinite(populationManMyeong)))
    errors.push("지역 인구는 0보다 큰 숫자(만 명)여야 합니다");

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
    query: { name: str(params, "name"), sido, sigungu, n, basis, counting, budgetManWon, populationManMyeong, start, end, history },
    isDemo: false,
    demo: null,
    errors,
  };
}

/** 같은 입력을 다른 화면(/evidence ↔ /check)으로 옮기는 쿼리 문자열 */
export function checkQueryString(q: CheckQuery, isDemo: boolean): string {
  if (isDemo) return DEMO_BY_NAME[q.name] === "hwacheon" ? "?demo=hwacheon" : "";
  const dash = (s: string) => (s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);
  const p = new URLSearchParams();
  if (q.name) p.set("name", q.name);
  p.set("sido", q.sido);
  p.set("sigungu", q.sigungu);
  if (q.n !== null) p.set("n", String(q.n));
  if (q.basis) p.set("basis", q.basis);
  if (q.counting) p.set("counting", q.counting);
  if (q.budgetManWon !== null) p.set("budget", String(q.budgetManWon));
  if (q.populationManMyeong !== null) p.set("pop", String(q.populationManMyeong));
  if (q.start) p.set("start", dash(q.start));
  if (q.end) p.set("end", dash(q.end));
  q.history.forEach((h, i) => {
    p.set(`h${i + 1}s`, dash(h.start));
    p.set(`h${i + 1}e`, dash(h.end));
  });
  return "?" + p.toString();
}

/**
 * 기획서 초안(lib/extract.ts) → /check 링크. 뽑힌 값만 옮기고, 이력 기간은 담당자가 /check 에서 적는다.
 * 시군구를 못 뽑았어도 링크는 선다 — /check 폼이 그 칸만 비운 채 열리고 "시도와 시군구를 적어 주세요"라고 말한다
 * (실측 2026-09-09: 고한읍 기획서는 군·도가 문서에 없어 시군구가 비었다. 그때 다리가 통째로 사라지면 뽑은 예산·기간도 못 본다).
 */
export function checkUrlFromExtraction(e: Extraction, name = ""): string {
  const f = e.facts;
  const q: CheckQuery = {
    name,
    sido: e.sido ?? "",
    sigungu: e.sigungu ?? "",
    n: f?.expectedVisitors ?? null,
    basis: f?.visitorBasis ?? null,
    counting: f?.visitorCounting ?? null,
    budgetManWon: f?.budgetManWon ?? null,
    populationManMyeong: e.populationManMyeong ?? null,
    start: f?.startDate ? ymdCompact(f.startDate) : "",
    end: f?.endDate ? ymdCompact(f.endDate) : "",
    history: [],
  };
  // 테마·접근성은 판정에 안 쓰지만 닮은 축제 블록이 읽는다 — 주석 키로 실어 보낸다 (2026-09-12 E)
  return "/check" + appendQuery(checkQueryString(q, false), { theme: e.themeCode, acc: e.accessibility });
}
