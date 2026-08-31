// 기능 1~3 이 공유하는 계약. 이름과 모양을 바꾸면 화면과 등급 쪽이 같이 깨진다.

/** 기획안에서 뽑아낸 항목. 지금은 사람이 폼으로 채운다 */
export interface PlanInput {
  sido: string;
  sigungu: string;
  /** 개최 월 1~12 */
  month: number;
  /** TourAPI 분류 코드 1~8 */
  themeCode: number;
  /** 지역 인구(만 명) */
  populationManMyeong: number;
  /** 접근성 1(나쁨)~5(좋음) */
  accessibility: number;
}

/**
 * 저장된 진단 한 건. **전 필드가 문자열이다** — DB 컬럼이 전부 TEXT 라서.
 *
 * `store.ts` 가 아니라 여기 사는 이유가 둘이다.
 * 1. `store → demo → store` 순환을 구조적으로 불가능하게 만든다.
 *    (`demo.ts` 가 이 타입을 저장 계층에서 가져오면 그 순간 고리가 닫힌다)
 * 2. 아래 `planInputOf` 가 이 타입과 `PlanInput` 을 잇는 유일한 다리인데,
 *    다리는 두 강둑이 같이 보이는 자리에 놓아야 한다.
 */
export interface Entry {
  id: string;
  sido: string;
  sigungu: string;
  month: string;
  theme: string;
  population: string;
  accessibility: string;
  savedAt: string;
}

/**
 * 저장된 진단(문자열) → 진단기 입력(숫자).
 *
 * **이 변환은 여기 한 곳에만 있어야 한다.** 예전에는 화면마다 손으로 다시
 * 썼고, 그러다 `venue` 화면이 중앙값을 자기 식으로 세면서 같은 진단에
 * 다른 배수가 나갔다(2026-08-31). 필드 이름이 다르고(`theme` → `themeCode`)
 * 타입이 둘 다 number 라, 잘못 이어도 타입 검사가 잡아주지 못한다.
 *
 * 값 검증은 하지 않는다 — 쓰기 경로(`app/page.tsx`)가 `validatePlanInput` 으로
 * 이미 막고, 읽기 경로는 이미 저장된 것을 그대로 옮기기만 한다.
 */
export function planInputOf(e: Entry): PlanInput {
  return {
    sido: e.sido,
    sigungu: e.sigungu,
    month: Number(e.month),
    themeCode: Number(e.theme),
    populationManMyeong: Number(e.population),
    accessibility: Number(e.accessibility),
  };
}

/** data/festivals.json 의 한 건 */
export interface Festival {
  id: string;
  name: string;
  sido: string;
  sigungu: string;
  /** YYYYMMDD */
  eventStartDate: string;
  eventEndDate: string;
  themeCode: number;
  accessibility: number;
  populationManMyeong: number;
  /** 축제 기간 시군구 외지인 방문자 / 평소 베이스라인. 619건 전부 실측값 */
  actualVisitSurge: number;
  lat: number;
  lng: number;
}

export type AxisKey =
  | "accessibility"
  | "population"
  | "region"
  | "month"
  | "theme";

/** 왜 닮았는지를 축별로 낸다. 유사도 점수만 던지면 실무자는 못 믿는다 */
export interface AxisSimilarity {
  axis: AxisKey;
  /** 화면에 그대로 쓰는 한국어 이름 */
  label: string;
  /** 0(같음) ~ 1(전혀 다름) */
  distance: number;
  /** "둘 다 2등급" 처럼 무엇이 닮았는지 */
  detail: string;
}

export interface MatchedFestival {
  festival: Festival;
  /** 잰 축들의 가중 평균. 낮을수록 닮았다 */
  distance: number;
  axes: AxisSimilarity[];
  /** eventStartDate 앞 4자리 */
  year: string;
}

export interface MatchResult {
  /** 임계값 안에 든 것만. 0~3건 */
  matched: MatchedFestival[];
  /** 못 찾았을 때 "찾아본 범위"로 화면에 내보낸다 */
  searchedScope: string;
  /**
   * 입력이 잘못돼서 아예 재지 못한 이유. 있으면 matched 는 항상 비어 있다.
   *
   * 이게 없으면 "입력이 깨진 것"과 "닮은 축제가 없는 것"이 화면에서
   * 같은 문장으로 나온다. 담당자는 "우리 축제는 전례가 없구나"로 읽는다.
   * 근거를 못 찾은 것과 입력이 틀린 것은 다르다 (암묵지 3번).
   */
  invalid?: string[];
}

/**
 * 이 거리를 넘으면 닮았다고 하지 않는다. 억지로 가장 가까운 걸 내놓지 않는다.
 *
 * 0.27 의 근거 — 619건 leave-one-out 실측에서 진짜 축제의 3번째 이웃 거리는
 * 최대 0.2674 (p99 0.203). 그 밖은 실측이 보증하지 않는 범위다.
 * match.test.ts 가 이 근거를 데이터로 다시 재서 지킨다.
 */
export const DISTANCE_THRESHOLD = 0.27;

/** 등급 컷라인. 닮은 3곳의 방문 배수 중앙값 기준 */
export const GRADE_CUT = { severe: 2.0, caution: 1.5 } as const;

/** 출처 없는 숫자는 화면에 올리지 않는다 */
export const DATA_SOURCE =
  "한국관광공사 TourAPI · 한국관광 데이터랩 · 행정안전부 주민등록인구";

/** 원본 분류표를 아직 못 구해 표본에서 읽어낸 임시 이름이다 */
export const THEME_NAME: Record<number, string> = {
  1: "음식·미식",
  2: "자연·꽃",
  3: "지역 종합",
  4: "음악·공연",
  5: "전통·문화유산",
  6: "어린이·가족",
  7: "청년·청소년",
  8: "빛·계절",
};

/**
 * 접근성은 담당자가 "3등급"으로 못 고른다. 데이터(619건)는 1~5 숫자를 그대로
 * 쓰되 화면과 모델은 라벨로만 다룬다. 숫자는 안쪽에만 남는다.
 */
export const ACCESSIBILITY_LABEL: Record<number, string> = {
  1: "매우 나쁨",
  2: "나쁨",
  3: "보통",
  4: "좋음",
  5: "매우 좋음",
};

/**
 * 기획서 한 건의 최대 길이. 1건당 모델 비용의 상한이 여기서 고정된다.
 * 서버 액션 본문 제한(1MB)보다 훨씬 먼저 걸리게 두는 것이 요점이다.
 */
export const MAX_PLAN_TEXT = 8000;

/**
 * 하루 추출 호출 상한.
 *
 * 무료 모델은 크레딧을 안 넣으면 하루 50건에서 막힌다. 그 벽에 부딪히면
 * 오픈라우터가 거절하고 사용자는 이유를 모른다. 45 에서 우리가 먼저 끊어
 * "오늘 한도 소진"이라고 말한다 — 남은 5건은 확인용 여유다.
 *
 * 상한 자체가 더 중요한 이유는 따로 있다. 배포본은 로그인이 없어 주소를
 * 아는 사람은 누구나 누를 수 있다. 유료 모델로 바꿔 끼우는 순간
 * 이 숫자가 하루 손실 금액의 상한이 된다.
 */
export const DAILY_EXTRACT_LIMIT = 45;

/** 추출값이 어디서 왔는지. 화면에 그대로 표시해 사람이 구분하게 한다 */
export type ExtractSource = "llm" | "sample" | "tourapi";

/** 모델이 값을 채우는 항목. 인구는 여기 없다 — 문서가 아니라 데이터에서 온다 */
export type ExtractedKey =
  | "sido"
  | "sigungu"
  | "month"
  | "themeCode"
  | "accessibility";

/**
 * 기획서에서 뽑아낸 초안. 확정값이 아니라 사람이 고칠 초안이다.
 *
 * 값만 받으면 잘못 뽑힌 것이 근거인 척한다. 항목마다 원문 근거를 같이 받아
 * 화면에 붙인다 — 암묵지 2번("왜 닮았는지를 항상 같이 낸다")과 같은 이유다.
 */
export interface Extraction {
  sido: string | null;
  sigungu: string | null;
  /** 개최 월 1~12 */
  month: number | null;
  /** THEME_NAME 의 키 1~8 */
  themeCode: number | null;
  /** ACCESSIBILITY_LABEL 의 키 1~5 */
  accessibility: number | null;
  /** 지역 인구(만 명). 모델이 아니라 festivals.json 에서 채운다 */
  populationManMyeong: number | null;
  /** 항목별 근거 — 원문에서 그대로 옮긴 문장. 못 찾은 항목은 키가 없다 */
  evidence: Partial<Record<ExtractedKey, string>>;
  /** 문서에서 못 찾은 항목의 한국어 이름. 화면에서 무엇이 없는지 짚는다 */
  missing: string[];
  source: ExtractSource;
}
