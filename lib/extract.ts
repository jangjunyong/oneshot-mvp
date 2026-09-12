// 기획서 텍스트 → 5축 초안 + 팩트체크 항목(예상 방문객·단위·기간·주차·부스·예산).
//
// 지자체마다 기획서 양식이 다르다. 법정 서식([별지 제20호의3] 지역축제
// 안전관리계획서)이 통일한 것은 표지 한 장뿐이고, 실제 계획은 "첨부서류"로
// 빠져 있다 (docs/참고사이트.md). 그래서 자유 텍스트를 읽어야 한다.
//
// 이 파일이 하는 일은 **옮겨 적기**지 판단이 아니다.
// 닮은 축제 찾기(match.ts)와 등급(grade.ts)에는 모델이 끼지 않는다.
// 여기서 나온 값은 확정이 아니라 사람이 고칠 초안이다.
//
// OpenRouter 를 쓰는 이유는 키마다 지출 상한을 걸 수 있어서다. 배포본은
// 로그인이 없어 주소를 아는 사람은 누구나 누를 수 있다. SDK 는 안 쓴다 —
// POST 한 번이라 의존성을 늘릴 이유가 없다.

import {
  ACCESSIBILITY_LABEL,
  MAX_PLAN_TEXT,
  THEME_NAME,
  type ExtractedKey,
  type Extraction,
  type FactKey,
  type PlanFacts,
} from "@/lib/types";
import { populationOf } from "@/lib/festivals";
import { shortSido } from "@/lib/tourapi";
import { resolveRegion } from "@/lib/kto/daily";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * 기본 모델.
 *
 * 무료 `z-ai/glm-5.2:free` 를 쓰다가 2026-08-31 유료로 바꿨다. 무료 모델이
 * 계속 429 를 뱉었고, 1차 심사는 **심사위원이 직접 이 버튼을 누르는**
 * 기능심사다. 첫 관문이 실패하면 "구동 안정성"이 그 자리에서 깎인다.
 *
 * 후보를 실제로 돌려서 골랐다(같은 김천 기획서, 2026-08-31 실측).
 *
 *   google/gemini-2.5-flash-lite   1.0초  5축 정확      약 1.1원/건  <- 채택
 *   upstage/solar-pro4            15.0초  5축 정확      약 0.3원/건
 *   openai/gpt-oss-120b           16.2초  대부분 못 뽑음
 *   openai/gpt-5-nano                 —   우리 스키마를 거절(400)
 *
 * 값보다 **1초**가 컸다. 심사위원이 기다리지 않는다.
 * 비용 상한은 셋으로 잠근다 — 입력 길이(MAX_PLAN_TEXT) · 응답 길이
 * (MAX_OUTPUT_TOKENS) · 하루 호출 수(DAILY_EXTRACT_LIMIT).
 * 그 위에 오픈라우터 대시보드의 **키별 지출 상한**을 걸어 둘 것(코드 밖).
 */
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

/**
 * 응답 길이 상한. 우리가 받는 것은 5축 + 근거 문장 몇 줄짜리 JSON 하나다.
 * 없으면 모델이 길게 뱉는 만큼 그대로 돈이 된다. 스키마가 이미 모양을
 * 잡지만, 값이 아니라 **한도**로도 잠가 둔다.
 */
const MAX_OUTPUT_TOKENS = 1100;

const KOREAN_NAME: Record<ExtractedKey, string> = {
  sido: "시도",
  sigungu: "시군구",
  month: "개최 월",
  themeCode: "테마",
  accessibility: "접근성",
};

const themeChoices = Object.entries(THEME_NAME)
  .map(([code, name]) => `${code}=${name}`)
  .join(" · ");

const accessChoices = Object.entries(ACCESSIBILITY_LABEL)
  .map(([code, name]) => `${code}=${name}`)
  .join(" · ");

/**
 * 지역 규칙. 2026-09-11 실호출에서 본문에 "강원도 정선군 탄탄대로 사업(정선군)"·"고한읍"이 있는
 * 기획서의 시도·시군구가 비어 나왔다 — 프롬프트에 지역을 어디서 어떻게 찾으라는 말이 없었다.
 * 테스트가 이 문자열이 프롬프트에 들어 있는지 잰다.
 */
export const REGION_RULE = `- sido·sigungu 는 축제가 열리는 행정구역이다. "개최장소"·"장소"·"주소" 뿐 아니라 사업명·괄호·머리말·기관명·
  연계 사업 문장 어디에 있든 시·도와 시·군·구가 보이면 옮긴다(예: "강원도 정선군 ○○사업" → 강원, 정선군).
  읍·면·동·리만 적혀 있으면 그것이 속한 시·군·구를 sigungu 에 적고(예: 고한읍 → 정선군, 대천해수욕장 → 보령시),
  evidence 에는 읍·면·동이 적힌 원문 문장을 그대로 옮긴다. sigungu 는 "정선군"·"보령시"처럼 시·군·구 접미사까지 적는다.
  시·군·구를 정할 근거 문장이 문서에 전혀 없을 때만 null.`;

const SYSTEM = `너는 한국 지자체의 축제 기획서에서 정해진 항목만 옮겨 적는다.

규칙:
- 문서에 근거가 없는 항목은 반드시 null 로 둔다. 추측하지 않는다.
- 값을 채운 항목은 evidence 에 **원문 문장을 그대로** 옮긴다. 요약하거나 고쳐 쓰지 않는다.
- 예상 방문객은 문서에 적힌 숫자를 **그대로 옮긴다**. 계산하거나 추정하지 않는다. 숫자가 없으면 null.
  visitorBasis 는 그 숫자가 기간 전체 합계면 "period", 하루 최다면 "peakDay". 문서가 말하지 않으면 null.
  visitorCounting 은 연인원(누적)이면 "personDays", 실인원(고유 방문자)이면 "unique". 문서가 말하지 않으면 null.
- startDate·endDate 는 **축제가 열리는 날**(관람객이 오는 첫날·마지막날) YYYY-MM-DD. 사업기간·용역기간·준비기간·계약기간은 아니다.
  연도·월·일이 문서에 다 있어야 한다. 일(日)이 없으면 null (월만 있으면 null).
- parkingSpaces 는 주차 면수, boothCount 는 부스·판매대 수, budgetManWon 은 총예산(만 원). 문서가 천원 단위면 10 으로 나누고
  백만원이면 100 을 곱해 만 원으로 환산한다. evidence 에는 단위가 적힌 원문을 그대로 옮긴다.
- pastEditions 는 **지난 회차(전년도 이전) 개최 실적**의 연도별 개최 시작일·마지막날 YYYY-MM-DD. "지난 회차"·"개최 실적"·"전년도" 표나 문장에서만
  옮긴다. 이번 회차 계획 기간은 넣지 않는다. 연·월·일이 다 적힌 회차만, 최근 3개까지, 오래된 해부터. 없으면 빈 배열.
${REGION_RULE}

themeCode 는 다음 중 하나: ${themeChoices}
accessibility 는 교통 접근성이다. 다음 중 하나: ${accessChoices}
  판단 기준 — 고속철도역·고속도로IC·지하철역까지의 거리, 대중교통 편수,
  주차 규모가 문서에 적혀 있으면 그것을 근거로 고른다. 아무 언급이 없으면 null.`;

/** 테스트가 규칙이 실제 프롬프트에 들어 있는지 재는 용도. 호출 경로는 SYSTEM 을 쓴다 */
export const EXTRACT_SYSTEM = SYSTEM;

// strict:true 라서 nullable 은 type 배열로 적어야 한다. 빼면 모델이 항목을
// 지어내서라도 채운다 — 그게 제일 나쁜 결과다.
const SCHEMA = {
  type: "object",
  properties: {
    festivalName: { type: ["string", "null"], description: "축제 이름(회차 표기 빼고). 예: 군포철쭉축제. 문서에 없으면 null" },
    sido: { type: ["string", "null"], description: "축제가 열리는 광역시도. 예: 경북, 전남, 강원" },
    sigungu: {
      type: ["string", "null"],
      description: "축제가 열리는 시·군·구, 접미사까지. 예: 김천시, 담양군, 정선군. 읍·면·동만 있으면 그 상위 시·군",
    },
    month: { type: ["integer", "null"], description: "개최 월 1~12" },
    themeCode: { type: ["integer", "null"], description: "테마 코드 1~8" },
    accessibility: {
      type: ["integer", "null"],
      description: "교통 접근성 1~5",
    },
    expectedVisitors: { type: ["integer", "null"], description: "기획안에 적힌 예상 방문객 수(명). 인용만" },
    visitorBasis: { type: ["string", "null"], enum: ["period", "peakDay", null], description: "기간 총계면 period, 일 최다면 peakDay" },
    visitorCounting: { type: ["string", "null"], enum: ["personDays", "unique", null], description: "연인원이면 personDays, 실인원이면 unique" },
    startDate: { type: ["string", "null"], description: "개최 첫날 YYYY-MM-DD" },
    endDate: { type: ["string", "null"], description: "개최 마지막날 YYYY-MM-DD" },
    parkingSpaces: { type: ["integer", "null"], description: "주차 면수" },
    boothCount: { type: ["integer", "null"], description: "부스 수" },
    budgetManWon: { type: ["integer", "null"], description: "총예산(만 원)" },
    pastEditions: {
      type: "array",
      description: "지난 회차 개최 기간(이번 계획 아님). 연·월·일이 다 있는 회차만, 최근 3개, 오래된 해부터",
      items: {
        type: "object",
        properties: {
          year: { type: "string", description: "개최 연도 YYYY" },
          startDate: { type: "string", description: "그 회차 첫날 YYYY-MM-DD" },
          endDate: { type: "string", description: "그 회차 마지막날 YYYY-MM-DD" },
          evidence: { type: "string", description: "원문 문장 그대로" },
        },
        required: ["year", "startDate", "endDate", "evidence"],
        additionalProperties: false,
      },
    },
    evidence: {
      type: "object",
      description: "값을 채운 항목만. 원문 문장을 그대로 옮긴다",
      properties: {
        sido: { type: "string" },
        sigungu: { type: "string" },
        month: { type: "string" },
        themeCode: { type: "string" },
        accessibility: { type: "string" },
        expectedVisitors: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        parkingSpaces: { type: "string" },
        boothCount: { type: "string" },
        budgetManWon: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  required: [
    "festivalName",
    "sido",
    "sigungu",
    "month",
    "themeCode",
    "accessibility",
    "expectedVisitors",
    "visitorBasis",
    "visitorCounting",
    "startDate",
    "endDate",
    "parkingSpaces",
    "boothCount",
    "budgetManWon",
    "pastEditions",
    "evidence",
  ],
  additionalProperties: false,
} as const;

/** 모델이 돌려준 것. populationManMyeong·missing·source 는 여기서 붙인다 */
interface ModelOutput {
  festivalName?: string | null;
  sido: string | null;
  sigungu: string | null;
  month: number | null;
  themeCode: number | null;
  accessibility: number | null;
  expectedVisitors?: number | null;
  visitorBasis?: string | null;
  visitorCounting?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  parkingSpaces?: number | null;
  boothCount?: number | null;
  budgetManWon?: number | null;
  pastEditions?: { year: string; startDate: string; endDate: string; evidence: string }[];
  evidence: Partial<Record<ExtractedKey | FactKey, string>>;
}

/** 김천시 주민등록인구 133,791명 (행안부 jumin.mois.go.kr, 2025-12 기준) → 만 명 */
export const SAMPLE_POPULATION_MANMYEONG = 13.4;

/**
 * 키가 없을 때 쓰는 고정 초안. 김천김밥축제 1회 조건이다 (PRD 성공 판정).
 *
 * 화면을 만드는 동안 모델을 부르지 않기 위한 것이고, 동시에 실패 경로이기도
 * 하다 — 배포본에서 한도가 걸리거나 API 가 죽어도 화면은 살아 있어야 한다
 * (docs/FLOW.md "도구가 죽으면 축소 응답").
 */
const SAMPLE: ModelOutput = {
  sido: "경북",
  sigungu: "김천시",
  month: 10,
  themeCode: 1,
  accessibility: 2,
  expectedVisitors: 100000,
  visitorBasis: "period",
  visitorCounting: null,
  startDate: "2024-10-25",
  endDate: "2024-10-27",
  parkingSpaces: 400,
  boothCount: null,
  budgetManWon: null,
  evidence: {
    sido: "[샘플] 경상북도 김천시 일원에서 개최한다.",
    sigungu: "[샘플] 경상북도 김천시 일원에서 개최한다.",
    month: "[샘플] 개최 기간: 10월 중 3일간",
    themeCode: "[샘플] 지역 특산물인 김밥을 주제로 한 음식 축제",
    accessibility: "[샘플] KTX 김천구미역에서 차량 20분, 전용 주차장 400면",
    expectedVisitors: "[샘플] 예상 방문객: 3일간 10만 명",
    startDate: "[샘플] 개최 기간: 2024. 10. 25.(금) ~ 10. 27.(일)",
    endDate: "[샘플] 개최 기간: 2024. 10. 25.(금) ~ 10. 27.(일)",
    parkingSpaces: "[샘플] KTX 김천구미역에서 차량 20분, 전용 주차장 400면",
  },
};

const FACT_KEYS: FactKey[] = ["expectedVisitors", "startDate", "endDate", "parkingSpaces", "boothCount", "budgetManWon"];

/**
 * 원문에 일(日)이 있는가. 모델은 "사업기간 ~ 2022 11" 같은 월 단위 문장에서 01·30 일을 지어낸다(2026-09-09 고한 기획서 실측).
 * 근거 문장에 일이 없으면 날짜는 없는 것이다.
 */
export function evidenceHasDay(e: string | undefined): boolean {
  if (!e) return false;
  return /\d{1,2}\s*일|\d{4}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}|\b\d{1,2}\.\s*\d{1,2}\b|\d{1,2}\/\d{1,2}/.test(e);
}

/**
 * 근거 문장의 "숫자 + 단위"로 예산을 만 원으로 다시 센다. 모델의 환산은 믿지 않는다 —
 * 같은 실측에서 "90,000 천원"을 90,000만 원으로 옮겼다(9,000만 원이 맞다). 규칙이 모델을 이긴다.
 * 단위를 못 읽으면 null 을 돌려 모델 값을 그대로 쓴다.
 */
export function budgetManWonFromEvidence(e: string | undefined): number | null {
  if (!e) return null;
  const UNIT = /(천\s*원|천원|만\s*원|만원|백만\s*원|백만원|억\s*원|억원|억)/;
  const NUM = /\d[\d,]*(?:\.\d+)?/g;
  // "90,000천원"처럼 숫자 뒤에 단위가 붙은 것이 보통. PDF 글자 추출은 순서를 흩뜨려
  // "천원 일금구천만원정: 90,000" 이 되기도 하므로(고한 실측) 단위만 있고 붙은 숫자가 없으면 문장의 가장 큰 숫자를 쓴다
  const adj = new RegExp(`(\d[\d,]*(?:\.\d+)?)\s*${UNIT.source}`).exec(e);
  const um = UNIT.exec(e);
  if (!um) return null;
  const nums = (e.match(NUM) ?? []).map((x) => Number(x.replace(/,/g, ""))).filter((x) => Number.isFinite(x) && x > 0);
  const n = adj ? Number(adj[1].replace(/,/g, "")) : nums.length ? Math.max(...nums) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (adj ? adj[2] : um[1]).replace(/\s+/g, "");
  const per = u.startsWith("천") ? 0.1 : u.startsWith("백만") ? 100 : u.startsWith("억") ? 10000 : 1;
  return Math.round(n * per);
}
const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * 팩트체크 항목 정리 — **원문 근거가 없는 값은 null 로 되돌린다** (기획/08 §4 #14).
 * 모델이 스키마 때문에 숫자를 채웠는데 evidence 가 비면 그 숫자는 지어낸 것이다.
 * 단위(basis·counting)는 값이 있을 때만 의미가 있고, 값이 없으면 같이 비운다.
 */
export function sanitizeFacts(out: ModelOutput): PlanFacts {
  const ev: PlanFacts["evidence"] = {};
  for (const k of FACT_KEYS) {
    const e = out.evidence?.[k];
    if (typeof e === "string" && e.trim()) ev[k] = e;
  }
  const keep = <T>(k: FactKey, v: T | null | undefined, ok: (x: unknown) => x is T): T | null =>
    v !== null && v !== undefined && ok(v) && ev[k] ? v : null;
  const expectedVisitors = keep("expectedVisitors", out.expectedVisitors, isCount);
  const basis = out.visitorBasis === "period" || out.visitorBasis === "peakDay" ? out.visitorBasis : null;
  const counting = out.visitorCounting === "personDays" || out.visitorCounting === "unique" ? out.visitorCounting : null;
  return {
    expectedVisitors,
    visitorBasis: expectedVisitors === null ? null : basis,
    visitorCounting: expectedVisitors === null ? null : counting,
    startDate: evidenceHasDay(ev.startDate) ? keep("startDate", out.startDate, isYmd) : null,
    endDate: evidenceHasDay(ev.endDate) ? keep("endDate", out.endDate, isYmd) : null,
    parkingSpaces: keep("parkingSpaces", out.parkingSpaces, isCount),
    boothCount: keep("boothCount", out.boothCount, isCount),
    budgetManWon: budgetManWonFromEvidence(ev.budgetManWon) ?? keep("budgetManWon", out.budgetManWon, isCount),
    pastEditions: pastEditionsOf(out),
    festivalName: typeof out.festivalName === "string" && out.festivalName.trim() ? out.festivalName.trim().slice(0, 40) : null,
    evidence: ev,
  };
}

/**
 * 지난 회차 개최 기간 — 연·월·일이 다 있고(evidenceHasDay), 끝이 시작보다 뒤이고, 연도가 startDate 와 맞는 것만.
 * 이번 계획 기간(startDate)과 같은 해는 뺀다 — 모델이 계획 기간을 실적으로 옮겨 적는 실수를 막는다. 최근 3개, 오래된 해부터
 */
function pastEditionsOf(out: ModelOutput): PlanFacts["pastEditions"] {
  const planYear = out.startDate && isYmd(out.startDate) ? out.startDate.slice(0, 4) : null;
  const seen = new Set<string>();
  const rows = (out.pastEditions ?? [])
    .filter((p) => p && isYmd(p.startDate) && isYmd(p.endDate) && p.endDate >= p.startDate && evidenceHasDay(p.evidence))
    .map((p) => ({ year: p.startDate.slice(0, 4), start: p.startDate, end: p.endDate, evidence: p.evidence.trim() }))
    .filter((p) => p.year !== planYear && !seen.has(p.year) && seen.add(p.year))
    .sort((a, b) => a.year.localeCompare(b.year));
  return rows.slice(-3);
}

/** 시도 표기 정규화. 정의는 lib/tourapi.ts 에 하나뿐이고 여기서 다시 내보낸다 */
export { shortSido };

/** 키가 있으면 진짜로 부르고, 없으면 샘플로 떨어진다 */
export function hasModelKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modelName(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

function assemble(out: ModelOutput, source: Extraction["source"]): Extraction {
  // 시도를 619건 표기로 먼저 옮긴다.
  //
  // 스키마에 "예: 경북, 전남" 이라고 적어 뒀는데도 모델은 법정 이름을 준다
  // (2026-08-31 실측: gemini-2.5-flash-lite 가 "경상북도"). 안 옮기면
  // populationOf 도 coordsOf 도 못 찾아서 **지역 축이 통째로 빠진 채**
  // 조용히 진단이 나간다. 무료 모델이 계속 429 라 이 길을 아무도 안 지나가
  // 여태 안 드러났다.
  const normalized: ModelOutput = { ...out, sido: shortSido(out.sido) };
  // 시군구도 KT 표기로 맞춘다 — 모델이 "군포"로 주면 "군포시"로. 자치구("수원시 장안구")는 619건 표기가 시 단위라
  // 그대로 두지 않고 시(수원시)로 내린다: populationOf·coordsOf 가 그 이름을 쓴다 (2026-09-12 E)
  if (normalized.sido && normalized.sigungu) {
    const r = resolveRegion(normalized.sido, normalized.sigungu);
    if (r) normalized.sigungu = r.name.includes(" ") ? r.name.split(" ")[0] : r.name;
  }

  const missing = (Object.keys(KOREAN_NAME) as ExtractedKey[])
    .filter((k) => normalized[k] === null || normalized[k] === undefined)
    .map((k) => KOREAN_NAME[k]);

  // 인구는 지역이 정해져야 찾을 수 있다. 지역이 비면 인구도 빈다.
  const population =
    normalized.sido && normalized.sigungu
      ? populationOf(normalized.sido, normalized.sigungu)
      : null;
  // 샘플(김천시)은 619건에 축제가 없어 인구가 안 나온다. 2026-09-11 까지는 populationOf 가 경북의
  // 다른 시 인구를 몰래 돌려줘 이 경로가 "되는 것처럼" 보였다. 샘플만 고정값을 쓴다 — 출처는 아래 상수
  const populationOrSample = population ?? (source === "sample" ? SAMPLE_POPULATION_MANMYEONG : null);
  if (populationOrSample === null) missing.push("지역 인구");

  // 5축과 팩트체크 항목을 갈라 담는다 — 5축 화면(/)은 facts 를 모르고, /check 는 5축을 안 쓴다
  const facts = sanitizeFacts(normalized);
  const evidence: Extraction["evidence"] = {};
  for (const k of Object.keys(KOREAN_NAME) as ExtractedKey[]) {
    const e = normalized.evidence[k];
    if (e) evidence[k] = e;
  }
  return {
    sido: normalized.sido,
    sigungu: normalized.sigungu,
    month: normalized.month,
    themeCode: normalized.themeCode,
    accessibility: normalized.accessibility,
    evidence,
    facts,
    populationManMyeong: populationOrSample,
    missing,
    source,
  };
}

/**
 * 기획서 텍스트에서 초안을 뽑는다.
 *
 * 호출 전에 반드시 하루 한도를 확인할 것 — 이 함수는 한도를 모른다.
 * 입력은 MAX_PLAN_TEXT 에서 자른다. 1건당 비용 상한을 고정하기 위해서다.
 */
/**
 * 추출이 실패했을 때 **화면에 나갈 한 문장**.
 *
 * 2026-08-30 실제로 터진 것: 무료 모델이 429 를 뱉었는데 그 본문이 담당자
 * 화면과 주소창에 통째로 실렸다 —
 *   `추출 요청이 거절됐습니다 (429) {"error":{"message":"Provider returned
 *    error","code":429,"metadata":{"raw":"z-ai/glm-5.2:free is temporarily
 *    rate-limited upstream. Please retry shortly, or add your own key...`
 *
 * 공급자 사정은 우리가 고칠 몫이지 사용자가 읽을 몫이 아니다. 원문은
 * 서버 로그로 보내고, 여기서는 **무엇을 할 수 있는지**만 말한다.
 * 어느 갈래로 가든 다음 행동(다시 누르기 / 직접 넣기)으로 이어야 한다 —
 * 막다른 문장을 내면 담당자는 화면을 닫는다.
 *
 * `detail` 은 받되 쓰지 않는다. 인자로 남겨 둔 이유는 나중에 사유별로
 * 갈래를 더 나눌 때 여기가 그 자리이기 때문이다.
 */
export function extractFailureMessage(status: number, detail = ""): string {
  void detail;
  if (status === 429) {
    return "지금 자동 추출이 붐빕니다. 잠시 후 다시 누르거나 항목을 직접 넣어 주세요";
  }
  if (status === 401 || status === 403) {
    return "자동 추출을 쓸 수 없는 상태입니다. 항목을 직접 넣어 주세요";
  }
  if (status === 402) {
    return "자동 추출 한도를 다 썼습니다. 항목을 직접 넣어 주세요";
  }
  if (status === 408 || status === 504) {
    return "자동 추출이 시간 안에 끝나지 않았습니다. 다시 누르거나 직접 넣어 주세요";
  }
  if (status >= 500) {
    return "자동 추출이 일시적으로 멈췄습니다. 잠시 후 다시 눌러 주세요";
  }
  return "자동 추출에 실패했습니다. 항목을 직접 넣어 주세요";
}

export async function extractPlan(planText: string): Promise<Extraction> {
  if (!hasModelKey()) return assemble(SAMPLE, "sample");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // 오픈라우터 대시보드에서 어느 앱이 쓴 건지 구분하기 위한 것
      "X-Title": "oneshot-mvp",
    },
    body: JSON.stringify({
      model: modelName(),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: planText.slice(0, MAX_PLAN_TEXT) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "festival_plan", strict: true, schema: SCHEMA },
      },
      max_tokens: MAX_OUTPUT_TOKENS,
      // 항목을 옮겨 적는 일이라 창의성이 필요 없다. 낮을수록 같은 기획서에
      // 같은 답이 나오고, 그래야 시연을 두 번 돌려도 화면이 안 바뀐다
      temperature: 0,
    }),
  });

  if (!res.ok) {
    // 사유는 서버 로그에만 남긴다. 화면에는 다듬은 한국어만 내보낸다 —
    // 담당 공무원이 공급자 사정을 읽을 이유가 없다 (extractFailureMessage).
    const detail = await res.text().catch(() => "");
    console.error("[extract] 추출 실패", res.status, detail.slice(0, 300));
    throw new Error(extractFailureMessage(res.status, detail));
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("모델이 값을 돌려주지 않았습니다");

  // 스키마를 걸었어도 파싱은 감싼다. 여기서 터지면 화면이 통째로 죽는다.
  let out: ModelOutput;
  try {
    out = JSON.parse(content) as ModelOutput;
  } catch {
    throw new Error("모델 응답을 읽지 못했습니다");
  }

  return assemble(out, "llm");
}
