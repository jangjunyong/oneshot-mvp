// KT 시군구 299곳의 대표점(위경도) 표 — 국토교통부 브이월드 검색 API(type=district, category=L2).
//
// 왜 — 좌표의 유일한 출처가 619건 축제 목록이라 178곳만 덮였고, 없는 곳(군포·화천 등 121곳)은
// `coordsOf` 가 같은 시도의 아무 축제 좌표(군포 → 양평)를 몰래 돌려줬다(2026-09-12 architect 실측).
// 그 좌표 위에서 반경 50km 경쟁 축제를 찾고 지도에 파란 핀을 찍었다. 이 표가 그 자리를 채운다.
//
// 대조 키 — 브이월드 district 검색의 item.id 가 행안부 시군구 코드(= KT signguCode)와 같다
// (실측: 군포시 41410 · 화천군 51790 · 수원시 장안구 41111 · 함평군 12820). 이름이 아니라 코드로 맞춘다.
//
// 실행: node scripts/region-centroid.mjs  → data/region/centroid.json  (VWORLD_KEY 는 .env.local 에서 읽는다)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "data/region/centroid.json";
const SIGUNGU = "data/kto/sigungu.json";

function envKey() {
  if (process.env.VWORLD_KEY) return process.env.VWORLD_KEY;
  if (!existsSync(".env.local")) throw new Error("VWORLD_KEY 가 없다 (.env.local)");
  const m = readFileSync(".env.local", "utf8").match(/^VWORLD_KEY=(.+)$/m);
  if (!m) throw new Error("VWORLD_KEY 가 없다 (.env.local)");
  return m[1].trim().replace(/^"|"$/g, "");
}

const KEY = envKey();
const list = JSON.parse(readFileSync(SIGUNGU, "utf8"));

async function search(query) {
  const u = new URL("https://api.vworld.kr/req/search");
  u.searchParams.set("service", "search");
  u.searchParams.set("request", "search");
  u.searchParams.set("version", "2.0");
  u.searchParams.set("crs", "EPSG:4326");
  u.searchParams.set("size", "10");
  u.searchParams.set("page", "1");
  u.searchParams.set("type", "district");
  u.searchParams.set("category", "L2");
  u.searchParams.set("format", "json");
  u.searchParams.set("errorformat", "json");
  u.searchParams.set("key", KEY);
  u.searchParams.set("query", query);
  const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const res = j?.response;
  if (res?.status !== "OK") return [];
  return (res.result?.items ?? []).map((i) => ({ id: String(i.id), title: i.title, lng: Number(i.point?.x), lat: Number(i.point?.y) }));
}

const rows = [];
const unmatched = [];
for (const s of list) {
  // 이름만으로 찾고 코드로 대조한다. 못 맞으면 시도를 붙여 한 번 더
  let hit = (await search(s.name)).find((i) => i.id === s.code);
  if (!hit) hit = (await search(`${s.sido} ${s.name}`)).find((i) => i.id === s.code);
  if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
    rows.push({ code: s.code, sido: s.sido, name: s.name, lat: Math.round(hit.lat * 1e5) / 1e5, lng: Math.round(hit.lng * 1e5) / 1e5 });
  } else {
    unmatched.push({ code: s.code, sido: s.sido, name: s.name });
  }
  process.stdout.write(hit ? "." : "x");
}
process.stdout.write("\n");

// 뒷정리 둘 —
// (1) 일반구가 있는 시(수원 41110 등)는 브이월드 L2 가 구(41111…)만 준다. 자식 구 대표점의 평균을 시의 대표점으로.
// (2) 전남·광주의 옛 코드(46xxx·29xxx)는 2026-07 개편으로 브이월드에 없다. 같은 이름의 새 코드(12xxx) 대표점을 그대로 붙인다
//     (KT 목록은 옛 코드가 정식 행이고 12xxx 가 별칭이다 — lib/kto/daily.ts buildAlias).
const byCode = new Map(rows.map((r) => [r.code, r]));
const still = [];
for (const u of unmatched) {
  const kids = rows.filter((r) => r.code !== u.code && r.code.slice(0, 4) === u.code.slice(0, 4) && r.sido === u.sido);
  const twin = rows.find((r) => r.name === u.name && r.sido === "" && r.code.startsWith("12"));
  if (kids.length > 0) {
    const lat = kids.reduce((s, r) => s + r.lat, 0) / kids.length;
    const lng = kids.reduce((s, r) => s + r.lng, 0) / kids.length;
    rows.push({ code: u.code, sido: u.sido, name: u.name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, derived: `자치구 ${kids.length}곳 평균` });
  } else if (twin) {
    rows.push({ code: u.code, sido: u.sido, name: u.name, lat: twin.lat, lng: twin.lng, derived: `2026-07 새 코드 ${twin.code} 와 같은 곳` });
  } else {
    still.push(u);
  }
}
byCode.clear();
unmatched.length = 0;
unmatched.push(...still);

const out = {
  source: "국토교통부 브이월드 검색 API (type=district, category=L2) 시군구 대표점 · 대조 키 = 행안부 시군구 코드",
  builtAt: new Date().toISOString().slice(0, 10),
  total: list.length,
  matched: rows.length,
  unmatched,
  rows,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`matched ${rows.length}/${list.length}`, unmatched.length ? `unmatched: ${unmatched.map((u) => `${u.sido} ${u.name}(${u.code})`).join(", ")}` : "");
