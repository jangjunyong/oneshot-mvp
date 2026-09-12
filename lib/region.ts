// 지역 사실 층 — KT 시군구 코드 → 행안부 주민등록 인구(만 명).
//
// 2026-09-11 까지 인구의 출처는 619건 축제 목록(lib/festivals.ts)뿐이라 KT 272곳 중 178곳만 덮였고,
// 없는 곳엔 같은 시도의 아무 축제 인구가 몰래 붙었다(그날 삭제). 이 파일은 그 자리를 행안부 표로 채운다.
// 우선순위는 화면이 정한다: 담당자가 적은 값(pop) → 이 표 → null. 619건 인구는 또래 배수 분포에만 쓴다.
//
// 순수 함수. data/region/population.json 은 scripts/region-build.mjs 가 만든다(원본 CSV 커밋).

import raw from "@/data/region/population.json";

export interface RegionPopulation {
  code: string;
  sido: string;
  name: string;
  /** 명 */
  population: number;
  moisName: string;
}

interface RegionTable {
  source: string;
  file: string;
  baseMonth: string;
  builtAt: string;
  joinKey: string;
  matched: number;
  unmatched: { code: string; sido: string; name: string }[];
  rows: RegionPopulation[];
}

const TABLE = raw as RegionTable;
const BY_CODE = new Map(TABLE.rows.map((r) => [r.code, r]));

/** 행안부 주민등록 인구(만 명, 소수 첫째 자리). 표에 없으면 null — 이웃을 짐작하지 않는다 */
export function populationOfCode(code: string): number | null {
  const r = BY_CODE.get(code);
  return r ? Math.round(r.population / 1000) / 10 : null;
}

/** 출처 한 줄 — 화면·보고서의 인구 셀 옆에 붙는다 */
export function populationSource(): string {
  // CSV 의 기준연월은 "2026-08-31" 같은 날짜 문자열이다 — 연·월만 남긴다
  const ym = TABLE.baseMonth.replace(/-/g, "").slice(0, 6);
  return `행정안전부 주민등록인구 ${ym.slice(0, 4)}-${ym.slice(4, 6)} 기준 (data.go.kr 15097972) · 적재 ${TABLE.builtAt}`;
}

export const REGION_META = {
  source: TABLE.source,
  baseMonth: TABLE.baseMonth,
  builtAt: TABLE.builtAt,
  matched: TABLE.matched,
  unmatched: TABLE.unmatched,
};
