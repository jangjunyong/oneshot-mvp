// 지역 사실 층 — KT 시군구 → 대표점(위경도). scripts/region-centroid.mjs 가 만든 data/region/centroid.json 을 읽는다.
//
// 619건 축제 목록에 없는 시군구(121곳)의 원점이 여기서 온다. 없으면 null — 이웃을 짐작하지 않는다.
// 순수 함수. 이름 대조는 KT 표기("경기"·"군포시")이고 공백을 접어 한 번 더 본다.

import raw from "@/data/region/centroid.json";

export interface Centroid {
  code: string;
  sido: string;
  name: string;
  lat: number;
  lng: number;
}

interface CentroidTable {
  source: string;
  builtAt: string;
  total: number;
  matched: number;
  unmatched: { code: string; sido: string; name: string }[];
  rows: Centroid[];
}

const TABLE = raw as CentroidTable;
const squash = (s: string) => s.replace(/\s+/g, "");
const BY_NAME = new Map(TABLE.rows.map((r) => [`${r.sido}|${squash(r.name)}`, r]));
const BY_CODE = new Map(TABLE.rows.map((r) => [r.code, r]));

export function centroidOf(sido: string, sigungu: string): { lat: number; lng: number } | null {
  const r = BY_NAME.get(`${sido}|${squash(sigungu)}`);
  return r ? { lat: r.lat, lng: r.lng } : null;
}

export function centroidOfCode(code: string): { lat: number; lng: number } | null {
  const r = BY_CODE.get(code);
  return r ? { lat: r.lat, lng: r.lng } : null;
}

export const CENTROID_META = { source: TABLE.source, builtAt: TABLE.builtAt, total: TABLE.total, matched: TABLE.matched, unmatched: TABLE.unmatched };
