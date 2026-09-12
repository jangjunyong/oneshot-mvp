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

/**
 * KT 원자료의 sigungu.json 299행 중 27행은 `sido` 가 비어 있고 코드가 `12xxx` 다 — 2026-07-01 부터 공사가
 * 전남 22곳·광주 5곳을 새 코드로 내려보낸 것이고, 같은 이름의 `46xxx`/`29xxx` 행은 2026-06-30 에서 끝난다
 * (2026-09-12 실측: 46110 목포 2019-05-01~2026-06-30 2,618일, 12110 목포 2026-07-01~08-09 40일).
 * 이대로 두면 그 27곳은 "자료가 6월 말에 끝난" 것처럼 읽히고 7~8월 40일치는 아무 입력으로도 못 닿는다.
 * 여기서 같은 이름끼리 이어 붙여 한 시군구로 만든다 — 목록은 272행, 일별 자료는 두 파일을 합친다.
 */
let aliasCache: Map<string, string[]> | null = null;

function loadSigunguRaw(): SigunguInfo[] {
  const p = path.join(KTO, "sigungu.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SigunguInfo[]) : [];
}

function buildAlias(raw: SigunguInfo[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const orphans = raw.filter((x) => x.sido === "");
  for (const o of orphans) {
    // 12210~12330 은 광주 5구, 나머지 12xxx 는 전남. 이름이 같은 정식 행에 붙인다
    const sido = o.code >= "12210" && o.code <= "12330" ? "광주" : "전남";
    const host = raw.find((x) => x.sido === sido && x.name === o.name);
    if (host) m.set(host.code, [...(m.get(host.code) ?? []), o.code]);
  }
  return m;
}

/** 시군구 목록 — `sido` 가 빈 12xxx 행은 빼고(정식 행에 병합됨) 병합된 일수로 */
export function sigunguList(): SigunguInfo[] {
  if (sigunguCache) return sigunguCache;
  const raw = loadSigunguRaw();
  aliasCache = buildAlias(raw);
  const byCode = new Map(raw.map((x) => [x.code, x]));
  sigunguCache = raw
    .filter((x) => x.sido !== "")
    .map((x) => ({
      ...x,
      days: x.days + (aliasCache!.get(x.code) ?? []).reduce((s, c) => s + (byCode.get(c)?.days ?? 0), 0),
    }));
  return sigunguCache;
}

/** 이 코드에 이어 붙는 원자료 코드들(12xxx). 없으면 빈 배열 */
export function codeAliases(code: string): string[] {
  if (!aliasCache) sigunguList();
  return aliasCache!.get(code) ?? [];
}

function readDailyFile(code: string): DailyRow[] {
  const p = path.join(KTO, "visitors", `${code}.json.gz`);
  if (!existsSync(p)) return [];
  const doc = JSON.parse(gunzipSync(readFileSync(p)).toString("utf8")) as {
    rows: [string, number, number, number][];
  };
  return doc.rows.map(([ymd, loc, out, frn]) => ({ ymd, loc, out, frn }));
}

/** 시군구 코드의 전체 일별 시계열(병합 코드 포함, 날짜 오름차순). 없으면 빈 배열 */
export function loadDaily(code: string): DailyRow[] {
  const hit = dailyCache.get(code);
  if (hit) return hit;
  const seen = new Set<string>();
  const rows: DailyRow[] = [];
  for (const c of [code, ...codeAliases(code)]) {
    for (const r of readDailyFile(c)) {
      if (seen.has(r.ymd)) continue;
      seen.add(r.ymd);
      rows.push(r);
    }
  }
  rows.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  dailyCache.set(code, rows);
  return rows;
}

/** 이 시군구 자료의 실제 범위 — 전역 매니페스트가 아니라 그 지역 행에서. 화면의 "적재 범위"는 이것을 써야 한다 */
export function dailyRange(code: string): { from: string; to: string; days: number } | null {
  const rows = loadDaily(code);
  if (rows.length === 0) return null;
  return { from: rows[0].ymd, to: rows[rows.length - 1].ymd, days: rows.length };
}

/** 적재 규모의 정직한 요약 — 문서·화면의 "규모" 문장은 여기서 만든다 */
export function coverageStats(): { sigungu: number; fullDays: number; fullCount: number; rows: number; minDays: number } {
  const list = sigunguList();
  const fullDays = manifest().days;
  return {
    sigungu: list.length,
    fullDays,
    fullCount: list.filter((x) => x.days >= fullDays).length,
    rows: list.reduce((s, x) => s + x.days, 0),
    minDays: list.reduce((m, x) => Math.min(m, x.days), Infinity),
  };
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
