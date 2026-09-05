// 공사 DataLabService/locgoRegnVisitrDDList — 전국 시군구 일별 방문자(KT) 프리페치.
//
// 하루 1호출로 전국(약 790행 = 시군구 × 현지인/외지인/외국인)이 온다.
// 개발계정 한도 1,000회/일 → 2019-05 ~ 오늘(약 2,700일)은 3일 배치.
//
// 원본은 data/kto/raw/YYYY/vYYYYMMDD.json.gz 로 한 날짜 한 파일(≈6KB).
// 화면·재계산이 읽는 시군구별 파일은 scripts/kto-build.mjs 가 만든다.
//
// 사용:  node scripts/kto-prefetch.mjs            # 없는 날짜를 우선순위대로 채우고 끝
//        node scripts/kto-prefetch.mjs --loop     # 한도에 걸리면 다음날 00:10(KST)까지 자고 계속
//        node scripts/kto-prefetch.mjs --from 20250101 --to 20250131
//        node scripts/kto-prefetch.mjs --import <dir>   # 예전 스크립트가 받은 v_YYYYMMDD.json 을 흡수
//
// 키는 .env.local 의 TOUR_API_KEY (같은 키로 KorService2 도 쓴다).

import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "kto", "raw");
const LOG = path.join(ROOT, "data", "kto", "prefetch.log");

// ---- env ---------------------------------------------------------------
function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv();
const KEY = process.env.TOUR_API_KEY;
if (!KEY) {
  console.error("TOUR_API_KEY 가 없다 (.env.local)");
  process.exit(2);
}

// ---- args --------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---- date helpers (KST) -------------------------------------------------
const KST = 9 * 60 * 60 * 1000;
const ymd = (d) => new Date(d.getTime() + KST).toISOString().slice(0, 10).replace(/-/g, "");
const parse = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const todayKst = () => parse(ymd(new Date()));

function rawPath(day) {
  return path.join(RAW, day.slice(0, 4), `v${day}.json.gz`);
}
function has(day) {
  return existsSync(rawPath(day));
}

// ---- 우선순위: 올해 → 2025 → 2024 → 2023 → 2022 → 2019 → 2021 → 2020 -------
// (코로나 두 해는 축제가 거의 없어 배수 재계산 가치가 낮다 — 맨 뒤)
function plan() {
  const from = opt("--from");
  const to = opt("--to");
  const out = [];
  const push = (a, b) => {
    for (let d = parse(a); d <= parse(b); d = addDays(d, 1)) {
      const s = ymd(d);
      if (!has(s)) out.push(s);
    }
  };
  if (from && to) {
    push(from, to);
    return out;
  }
  const t = todayKst();
  // 공사 데이터는 한 달 넘게 지연된다(2026-09-05 실측: 08-01 있음, 08-10 없음).
  // 확실한 구간만 계획에 넣고, 그 뒤는 main() 이 앞으로 더듬어 채운다.
  const latest = ymd(addDays(t, -40));
  const y = latest.slice(0, 4);
  push(`${y}0101`, latest);
  for (const yr of ["2025", "2024", "2023", "2022", "2019", "2021", "2020"]) {
    if (yr === y) continue;
    push(yr === "2019" ? "20190501" : `${yr}0101`, `${yr}1231`);
  }
  return out;
}

// ---- fetch ----------------------------------------------------------------
class QuotaError extends Error {}

async function fetchDay(day) {
  const u = new URL("https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList");
  u.search =
    `serviceKey=${KEY}&numOfRows=1000&pageNo=1&MobileOS=ETC&MobileApp=factcheck&_type=json` +
    `&startYmd=${day}&endYmd=${day}`;
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      // 한도 초과는 XML 로 온다 (resultCode 22).
      if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR|<resultCode>22</.test(text)) {
        throw new QuotaError(day);
      }
      const j = JSON.parse(text);
      const h = j?.response?.header;
      if (h?.resultCode === "22") throw new QuotaError(day);
      if (h?.resultCode !== "0000") throw new Error(`${day} ${h?.resultCode} ${h?.resultMsg}`);
      return j.response.body;
    } catch (e) {
      if (e instanceof QuotaError) throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

// 원본 792행을 [code, name, loc, out, foreign] 로 접는다.
export function compact(body, day) {
  const items = body?.items?.item ?? [];
  const by = new Map();
  for (const it of items) {
    if (it.baseYmd !== day) continue;
    const c = it.signguCode;
    if (!by.has(c)) by.set(c, { code: c, name: it.signguNm, n: [null, null, null] });
    const k = Number(it.touDivCd) - 1; // 1 현지인 2 외지인 3 외국인
    if (k >= 0 && k < 3) by.get(c).n[k] = Math.round(Number(it.touNum) * 10) / 10;
  }
  const rows = [...by.values()]
    .sort((a, b) => (a.code < b.code ? -1 : 1))
    .map((r) => [r.code, r.name, ...r.n]);
  return { d: day, total: Number(body?.totalCount ?? 0), rows };
}

async function save(day, obj) {
  const p = rawPath(day);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, gzipSync(Buffer.from(JSON.stringify(obj))));
}

async function log(line) {
  await fs.mkdir(path.dirname(LOG), { recursive: true });
  await fs.appendFile(LOG, `${new Date().toISOString()} ${line}\n`);
}

// ---- import (예전 v_YYYYMMDD.json) -----------------------------------------
async function importDir(dir) {
  let n = 0;
  for (const f of await fs.readdir(dir)) {
    const m = /^v_(\d{8})\.json$/.exec(f);
    if (!m || has(m[1])) continue;
    const j = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    const body = j?.response?.body;
    if (!body?.items) continue;
    await save(m[1], compact(body, m[1]));
    n++;
  }
  console.log(`imported ${n}`);
}

// ---- main -------------------------------------------------------------------
async function sleepUntilNextKstMorning() {
  const now = new Date();
  const t = new Date(todayKst().getTime() + 86400000 + 10 * 60 * 1000 - KST); // 다음날 00:10 KST
  const ms = Math.max(60_000, t.getTime() - now.getTime());
  console.log(`quota exceeded — sleeping ${Math.round(ms / 60000)} min until ${t.toISOString()}`);
  await log(`quota exceeded; sleep ${Math.round(ms / 60000)}m`);
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const imp = opt("--import");
  if (imp) return importDir(imp);
  const loop = flag("--loop");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const days = plan();
    console.log(`todo ${days.length} days`);
    if (days.length === 0) {
      if (!loop) return;
      await sleepUntilNextKstMorning();
      continue;
    }
    let n = 0;
    let quota = false;
    for (const day of days) {
      try {
        const body = await fetchDay(day);
        const c = compact(body, day);
        if (c.rows.length === 0) {
          // 아직 집계 안 된 날짜(최근) — 파일을 만들지 않고 넘어간다.
          await log(`${day} empty`);
          continue;
        }
        await save(day, c);
        n++;
        if (n % 25 === 0) console.log(`${day} ok (${n}/${days.length})`);
      } catch (e) {
        if (e instanceof QuotaError) {
          quota = true;
          break;
        }
        await log(`${day} fail ${e?.message ?? e}`);
        console.error(`${day} fail ${e?.message ?? e}`);
      }
      await new Promise((r) => setTimeout(r, 120)); // 예의상
    }
    // 확실한 구간을 다 채웠으면 최신 날짜 뒤를 앞으로 더듬는다 (빈 날 3연속이면 멈춤).
    if (!quota) {
      try {
        let d = addDays(todayKst(), -40);
        while (has(ymd(d))) d = addDays(d, 1);
        let empty = 0;
        for (let i = 0; i < 45 && empty < 3; i++, d = addDays(d, 1)) {
          if (d > addDays(todayKst(), -1)) break;
          const body = await fetchDay(ymd(d));
          const c = compact(body, ymd(d));
          if (c.rows.length === 0) {
            empty++;
            continue;
          }
          empty = 0;
          await save(ymd(d), c);
          n++;
        }
      } catch (e) {
        if (e instanceof QuotaError) quota = true;
        else await log(`tail fail ${e?.message ?? e}`);
      }
    }
    await log(`fetched ${n}`);
    console.log(`fetched ${n}`);
    if (!loop) return;
    if (quota) await sleepUntilNextKstMorning();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
