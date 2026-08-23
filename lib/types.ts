// F1(화면)·F2(매칭)·F3(등급)가 공유하는 계약.
// 세 feature 가 브랜치로 갈라져도 이 파일만 맞으면 병합이 붙는다.

/**
 * 기획안에서 뽑아낸 항목.
 * 지금은 사람이 폼으로 채우고, Day 8 에 LLM 이 같은 모양을 채운다.
 */
export interface PlanInput {
  sido: string;
  sigungu: string;
  /** 개최 월 1~12 */
  month: number;
  /** TourAPI 분류 코드 1~8. 원본 코드표는 아직 확보 못 했다 */
  themeCode: number;
  /** 지역 인구(만 명). 지역을 고르면 데이터에서 자동 조회한다 */
  populationManMyeong: number;
  /** 접근성 1(나쁨)~5(좋음). 지역을 고르면 자동 조회한다 */
  accessibility: number;
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

export type AxisKey = "accessibility" | "population" | "region" | "month" | "theme";

/**
 * 왜 닮았는지를 축별로 낸다.
 * 암묵지 2번 — 유사도 점수만 던지면 실무자는 못 믿는다.
 */
export interface AxisSimilarity {
  axis: AxisKey;
  /** 화면에 그대로 쓰는 한국어 이름 */
  label: string;
  /** 0(같음) ~ 1(전혀 다름) */
  distance: number;
  /** "둘 다 접근성 2등급" 처럼 무엇이 닮았는지 */
  detail: string;
}

export interface MatchedFestival {
  festival: Festival;
  /** 다섯 축의 가중합. 낮을수록 닮았다 */
  distance: number;
  axes: AxisSimilarity[];
  /** eventStartDate 앞 4자리. 출처와 함께 화면에 반드시 붙는다 */
  year: string;
}

/** F2 의 산출물. 등급은 F3 가 이걸 받아서 매긴다 */
export interface MatchResult {
  input: PlanInput;
  /** 임계값 안에 든 것만. 0~3건 */
  matched: MatchedFestival[];
  /** 못 찾았을 때 "찾아본 범위"로 화면에 내보낸다 */
  searchedScope: string;
}

/**
 * "안전"이 없다는 게 이 타입의 요점이다.
 * 근거를 못 찾은 것과 안전한 것은 다르다 (암묵지 3번).
 */
export type GradeLevel = "심각" | "주의" | "근거없음" | "비교불가";

export interface AlertGrade {
  level: GradeLevel;
  /** 화면 맨 위 한 문장 */
  headline: string;
  /** 닮은 축제들의 배수 중앙값. 비교불가면 null */
  medianSurge: number | null;
}

/** 출처 없는 숫자는 화면에 올리지 않는다 */
export const DATA_SOURCE =
  "한국관광공사 TourAPI · 한국관광 데이터랩 · 행정안전부 주민등록인구";

/** 등급 컷라인. PRD "경보 등급" 절과 같은 값이어야 한다 */
export const GRADE_CUT = { severe: 2.0, caution: 1.5 } as const;

/** 이 거리를 넘으면 닮았다고 하지 않는다. 억지로 가장 가까운 걸 내놓지 않는다 */
export const DISTANCE_THRESHOLD = 0.35;
