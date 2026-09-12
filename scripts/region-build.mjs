// 행안부 주민등록 인구(행정동별 CSV, data.go.kr 15097972) → KT 시군구 코드별 인구표.
//
// 왜 — 인구의 유일한 출처가 619건 축제 목록이라 KT 시군구 272곳 중 178곳만 덮였다(2026-09-11 실측).
// 목포·함평·부산 동구 같은 곳은 또래 구간이 아예 안 섰다. 행안부 표는 전국을 덮고 출처·기준월이 있다.
//
// 조인 키 — 행안부 행정기관코드 10자리의 앞 5자리 = KT signguCode(행안부 시군구 코드 체계가 같다).
//   41410 군포시 · 44180 보령시 · 46110 목포시 · 29110 광주 동구 · 36110 세종 · 50110 제주시
//   일반구가 있는 시(수원 41110 등)는 행정동이 구 코드(41111·41113…) 아래 있으므로 앞 4자리로 합산한다.
//
// 실행: node scripts/region-build.mjs  → data/region/population.json (+ unmatched 명단은 같은 파일 meta 에)
// 원본 CSV(cp949)는 data/region/raw/ 에 커밋해 둔다 — 재현 가능해야 출처다.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RAW_DIR = "data/region/raw";
const OUT = "data/region/population.json";

const csvName = readdirSync(RAW_DIR).filter((f) => f.startsWith("mois_") && f.endsWith(".csv")).sort().at(-1);
if (!csvName) throw new Error(`${RAW_DIR} 에 mois_YYYYMM.csv 가 없다`);
const text = new TextDecoder("euc-kr").decode(readFileSync(path.join(RAW_DIR, csvName)));
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
const header = lines[0].split(",");
const iCode = header.indexOf("행정기관코드");
const iYm = header.indexOf("기준연월");
const iSido = header.indexOf("시도명");
const iSgg = header.indexOf("시군구명");
const iTotal = header.indexOf("계");
for (const [k, v] of Object.entries({ iCode, iYm, iSido, iSgg, iTotal })) if (v < 0) throw new Error(`CSV 헤더에 ${k} 가 없다`);

/** 행정동 행 → 5자리·4자리 접두 합계 */
const by5 = new Map(); // code5 → { sido, name, total, ym }
const by4 = new Map(); // code4 → total
let ym = "";
for (const line of lines.slice(1)) {
  const c = line.split(",");
  const code = c[iCode];
  if (!/^\d{10}$/.test(code)) continue;
  const total = Number(c[iTotal].replace(/[^0-9]/g, ""));
  ym = ym || c[iYm];
  const k5 = code.slice(0, 5);
  const cur = by5.get(k5) ?? { sido: c[iSido], name: c[iSgg], total: 0 };
  cur.total += total;
  by5.set(k5, cur);
  const k4 = code.slice(0, 4);
  by4.set(k4, (by4.get(k4) ?? 0) + total);
}

const ktAll = JSON.parse(readFileSync("data/kto/sigungu.json", "utf8"));
const kt = ktAll.filter((x) => x.sido !== "");
// 2026-07 행정구역 개편으로 전남·광주는 행안부 코드가 12xxx 로 바뀌었다(KT 도 같은 달부터 12xxx 로 준다).
// KT 의 sido 빈 12xxx 행이 곧 그 대응표다 — 이름이 같은 46xxx/29xxx 에 붙인다 (lib/kto/daily.ts 와 같은 규칙)
const alias = new Map();
for (const o of ktAll.filter((x) => x.sido === "")) {
  const sido = o.code >= "12210" && o.code <= "12330" ? "광주" : "전남";
  const host = kt.find((x) => x.sido === sido && x.name === o.name);
  if (host) alias.set(host.code, o.code);
}
const rows = [];
const unmatched = [];
for (const s of kt) {
  const hit = by5.get(s.code) ?? (alias.has(s.code) ? by5.get(alias.get(s.code)) : undefined);
  if (hit) {
    rows.push({ code: s.code, sido: s.sido, name: s.name, population: hit.total, moisName: `${hit.sido} ${hit.name}${alias.has(s.code) && !by5.has(s.code) ? ` (행안부 코드 ${alias.get(s.code)})` : ""}`.trim() });
    continue;
  }
  // 시 합계(일반구가 있는 시): 앞 4자리 합산. 자기 코드가 x0 으로 끝날 때만
  if (s.code.endsWith("0") && by4.has(s.code.slice(0, 4))) {
    rows.push({ code: s.code, sido: s.sido, name: s.name, population: by4.get(s.code.slice(0, 4)), moisName: `(${s.code.slice(0, 4)}* 합산)` });
    continue;
  }
  unmatched.push({ code: s.code, sido: s.sido, name: s.name });
}

const out = {
  source: "행정안전부 주민등록 인구통계 — 지역별(행정동) 성별 연령별 주민등록 인구수 (data.go.kr 15097972)",
  file: csvName,
  baseMonth: ym,
  builtAt: new Date().toISOString().slice(0, 10),
  joinKey: "행정기관코드 앞 5자리 = KT signguCode. 일반구가 있는 시는 앞 4자리 합산",
  matched: rows.length,
  unmatched,
  rows: rows.sort((a, b) => (a.code < b.code ? -1 : 1)),
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${csvName} (${ym}) → ${OUT}: 매칭 ${rows.length}/${kt.length}, 미매칭 ${unmatched.length}`);
if (unmatched.length) console.log(unmatched.map((u) => `${u.code} ${u.sido} ${u.name}`).join("\n"));
