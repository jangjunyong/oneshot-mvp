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
import { shortSido } from "@/lib/tourapi";

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
 * 시도 + 시군구 이름 → KT 시군구 한 건. 619건(festivals.json)과 기획안 입력이 쓴다.
 *
 * 사람이 치는 표기를 받는다 — "충청남도"도 "충남"도, "보령"도 "보령시"도 같은 곳이다
 * (2026-09-11 실사용: 심사위원이 "충청남도·보령"을 치면 판정이 아예 안 나왔다. 변환표는
 * `lib/tourapi.ts` 에 이미 있었는데 이 경로에서 안 불렀다).
 * KT 는 "수원시" 와 "수원시 장안구" 를 둘 다 준다. 자치구까지 적힌 입력은 그 구로,
 * 시만 적힌 입력은 시 전체로 보낸다. 못 찾으면 null — 짐작해서 이웃을 주지 않는다.
 */
export function resolveRegion(sido: string, sigungu: string): SigunguInfo | null {
  const list = sigunguList();
  const sd = (shortSido(sido) ?? sido).trim();
  const s = sigungu.replace(/\s+/g, " ").trim();
  const inSido = list.filter((x) => x.sido === sd);
  if (inSido.length === 0) return null;
  const squash = (t: string) => t.replace(/\s+/g, "");
  const find = (t: string) => inSido.find((x) => x.name === t) ?? inSido.find((x) => squash(x.name) === squash(t));
  const exact = find(s);
  if (exact) return exact;
  // "보령" → "보령시", "정선" → "정선군". 접미사가 하나만 맞아야 한다 — 둘 이상이면 짐작이다
  if (s.length > 0 && !/[시군구]$/.test(s)) {
    const hits = ["시", "군", "구"].map((suf) => find(s + suf)).filter((x): x is SigunguInfo => !!x);
    if (hits.length === 1) return hits[0];
  }
  // 세종 처럼 시군구가 곧 시도인 경우
  if (inSido.length === 1) return inSido[0];
  return null;
}

export function sigunguCode(sido: string, sigungu: string): string | null {
  return resolveRegion(sido, sigungu)?.code ?? null;
}

/** 같은 시도의 KT 시군구 이름 전부 — 못 찾았을 때 담당자에게 보여 줄 후보 */
export function sigunguNamesOf(sido: string): string[] {
  const sd = (shortSido(sido) ?? sido).trim();
  return sigunguList()
    .filter((x) => x.sido === sd)
    .map((x) => x.name);
}
