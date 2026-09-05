// 공사 KT 일별 방문자(시군구) 읽기 — scripts/kto-build.mjs 가 만든 정적 파일.
//
// DB 가 아니라 파일인 이유(기획/08 §7 ADR): 국가 단위 사실이라 세션과 무관하고,
// 버전이 코드와 같이 움직이며, 테스트가 DB 없이 돈다. 로컬에서 Neon 비밀을
// 못 받는 문제(vercel env pull 은 Secret 을 안 준다)도 이걸로 사라졌다.
//
// 서버 전용. 클라이언트 컴포넌트에서 import 하면 fs 가 없어 빌드가 깨진다.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import type { DailyRow } from "@/lib/surge";

const KTO = path.join(process.cwd(), "data", "kto");

export interface SigunguInfo {
  code: string;
  name: string;
  sido: string;
  days: number;
}

export interface Manifest {
  source: string;
  builtAt: string;
  from: string | null;
  to: string | null;
  days: number;
  missing: string[];
  sigungu: number;
}

let sigunguCache: SigunguInfo[] | null = null;
let manifestCache: Manifest | null = null;
const dailyCache = new Map<string, DailyRow[]>();

export function manifest(): Manifest {
  if (manifestCache) return manifestCache;
  const p = path.join(KTO, "manifest.json");
  manifestCache = existsSync(p)
    ? (JSON.parse(readFileSync(p, "utf8")) as Manifest)
    : { source: "", builtAt: "", from: null, to: null, days: 0, missing: [], sigungu: 0 };
  return manifestCache;
}

export function sigunguList(): SigunguInfo[] {
  if (sigunguCache) return sigunguCache;
  const p = path.join(KTO, "sigungu.json");
  sigunguCache = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SigunguInfo[]) : [];
  return sigunguCache;
}

/** 시군구 코드의 전체 일별 시계열. 없으면 빈 배열 */
export function loadDaily(code: string): DailyRow[] {
  const hit = dailyCache.get(code);
  if (hit) return hit;
  const p = path.join(KTO, "visitors", `${code}.json.gz`);
  if (!existsSync(p)) return [];
  const doc = JSON.parse(gunzipSync(readFileSync(p)).toString("utf8")) as {
    rows: [string, number, number, number][];
  };
  const rows = doc.rows.map(([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }));
  dailyCache.set(code, rows);
  return rows;
}

/**
 * 시도 짧은 이름 + 시군구 이름 → KT 코드. 619건(festivals.json)과 기획안 입력이 쓴다.
 *
 * KT 는 "수원시" 와 "수원시 장안구" 를 둘 다 준다. 자치구까지 적힌 입력은 그 구로,
 * 시만 적힌 입력은 시 전체로 보낸다. 못 찾으면 null — 짐작해서 이웃을 주지 않는다.
 */
export function sigunguCode(sido: string, sigungu: string): string | null {
  const list = sigunguList();
  const s = sigungu.replace(/\s+/g, " ").trim();
  const inSido = list.filter((x) => x.sido === sido);
  const exact = inSido.find((x) => x.name === s);
  if (exact) return exact.code;
  // "청주시 상당구" 로 들어온 것을 KT 가 "청주시상당구" 로 갖고 있는 경우와 그 반대
  const squash = (t: string) => t.replace(/\s+/g, "");
  const sq = inSido.find((x) => squash(x.name) === squash(s));
  if (sq) return sq.code;
  // 세종 처럼 시군구가 곧 시도인 경우
  if (inSido.length === 1) return inSido[0].code;
  return null;
}
