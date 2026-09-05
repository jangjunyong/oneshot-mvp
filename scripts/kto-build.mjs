// data/kto/raw/**/vYYYYMMDD.json.gz (하루 한 파일, 전국) →
//   data/kto/visitors/<시군구코드>.json.gz   시군구 한 파일, 날짜순 [ymd, 현지인, 외지인, 외국인]
//   data/kto/sigungu.json                    코드 → 이름·시도
//   data/kto/manifest.json                   적재 범위·빠진 날짜 (화면에 "자료 범위"로 올린다)
//   data/kto/fixtures/<code>.json            --fixture 41410 … 유닛 테스트용 평문
//
// 화면이 시군구 단위로만 읽기 때문에 시군구별로 쪼갠다. DB 가 아니라 파일인 이유는
// 기획/08 §7 ADR — 국가 단위 사실은 버전 관리되는 정적 자산이 낫고, 테스트가 DB 없이 돈다.
//
// 사용: node scripts/kto-build.mjs [--fixture 41410 --fixture 43113]

import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KTO = path.join(ROOT, "data", "kto");
const RAW = path.join(KTO, "raw");

const SIDO = {
  11: "서울", 26: "부산", 27: "대구", 28: "인천", 29: "광주", 30: "대전", 31: "울산",
  36: "세종", 41: "경기", 43: "충북", 44: "충남", 46: "전남", 47: "경북", 48: "경남",
  50: "제주", 51: "강원", 52: "전북",
};

const args = process.argv.slice(2);
const fixtures = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--fixture") fixtures.push(args[++i]);

async function* rawFiles() {
  let years = [];
  try {
    years = (await fs.readdir(RAW)).filter((y) => /^\d{4}$/.test(y)).sort();
  } catch {
    return;
  }
  for (const y of years) {
    const files = (await fs.readdir(path.join(RAW, y))).filter((f) => /^v\d{8}\.json\.gz$/.test(f)).sort();
    for (const f of files) yield path.join(RAW, y, f);
  }
}

const perCode = new Map(); // code -> { name, rows: [] }
const days = [];
for await (const p of rawFiles()) {
  const j = JSON.parse(gunzipSync(await fs.readFile(p)).toString("utf8"));
  days.push(j.d);
  for (const [code, name, loc, out, frn] of j.rows) {
    let e = perCode.get(code);
    if (!e) perCode.set(code, (e = { name, rows: [] }));
    e.name = name; // 최신 이름 우선(개편 반영)
    e.rows.push([j.d, loc, out, frn]);
  }
}
days.sort();

// 빠진 날짜 목록 — 화면의 "자료 범위" 문구가 정직하려면 있어야 한다.
function missingDays(sorted) {
  if (sorted.length === 0) return [];
  const parse = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const fmt = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
  const have = new Set(sorted);
  const out = [];
  for (let t = parse(sorted[0]); t <= parse(sorted[sorted.length - 1]); t += 86400000) {
    const s = fmt(t);
    if (!have.has(s)) out.push(s);
  }
  return out;
}

await fs.rm(path.join(KTO, "visitors"), { recursive: true, force: true });
await fs.mkdir(path.join(KTO, "visitors"), { recursive: true });
const sigungu = [];
for (const [code, e] of [...perCode.entries()].sort()) {
  e.rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const sido = SIDO[Number(code.slice(0, 2))] ?? "";
  sigungu.push({ code, name: e.name, sido, days: e.rows.length });
  const doc = { code, name: e.name, sido, rows: e.rows };
  await fs.writeFile(path.join(KTO, "visitors", `${code}.json.gz`), gzipSync(Buffer.from(JSON.stringify(doc))));
  if (fixtures.includes(code)) {
    await fs.mkdir(path.join(KTO, "fixtures"), { recursive: true });
    await fs.writeFile(path.join(KTO, "fixtures", `${code}.json`), JSON.stringify(doc));
  }
}
await fs.writeFile(path.join(KTO, "sigungu.json"), JSON.stringify(sigungu, null, 0));
const missing = missingDays(days);
await fs.writeFile(
  path.join(KTO, "manifest.json"),
  JSON.stringify(
    {
      source: "한국관광공사 TourAPI DataLabService/locgoRegnVisitrDDList (KT 이동통신 기반 시군구 일별 방문자)",
      builtAt: new Date().toISOString(),
      from: days[0] ?? null,
      to: days[days.length - 1] ?? null,
      days: days.length,
      missing,
      sigungu: sigungu.length,
    },
    null,
    2,
  ),
);
console.log(`days ${days.length} (${days[0]}..${days[days.length - 1]}), missing ${missing.length}, sigungu ${sigungu.length}`);
