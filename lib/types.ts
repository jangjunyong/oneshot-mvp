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
}

/** 이 거리를 넘으면 닮았다고 하지 않는다. 억지로 가장 가까운 걸 내놓지 않는다 */
export const DISTANCE_THRESHOLD = 0.35;

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
