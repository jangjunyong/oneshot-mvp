// 축제 신호 등급(lib/signal.ts)의 분별력을 다시 잰다 — 문턱을 바꾸면 이 스크립트를 돌려 숫자를 갱신한다 (2026-09-14 S1 #8 A안).
//
// 진짜 = 데이터랩 축제 619건의 개최 기간.
// 가짜 = 같은 기간을 −26·−13·+13·+26주 옮긴 것(요일 유지). 같은 시군구의 다른 619건 축제와 ±7일 안에 겹치면 뺀다.
//   한계: 옮긴 기간에도 명절·성수기·목록에 없는 행사가 섞인다 — 가짜의 "뚜렷함" 일부는 진짜 다른 행사다. 분별력은 하한으로 읽는다.
// 출력: zPeak·rank AUC(Mann–Whitney), 등급 분포(진짜 vs 가짜), 인구 구간별 AUC.
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/signal-eval.mjs

import { readFileSync } from "node:fs";
import { loadDaily } from "@/lib/kto/daily";
import { festivalSignal, SIGNAL_THRESHOLDS } from "@/lib/signal";
import { holidayBlock, holidayNames } from "@/lib/calendar";

// 명절·공휴일 보정 변형 셋을 같이 잰다 (2026-09-14): 없음 / 설·추석 연휴 덩어리를 평소에서 뺌 / 모든 공휴일 연휴 덩어리를 뺌
const VARIANTS = { "보정 없음": undefined, "설·추석 제외": holidayBlock("lunar"), "공휴일 전체 제외": holidayBlock("all") };
const VARIANT = process.argv.find((a) => a.startsWith("--variant="))?.slice(10) ?? null;

const festRaw = JSON.parse(readFileSync("data/festivals.json", "utf8"));
const fest = Array.isArray(festRaw) ? festRaw : (festRaw.festivals ?? Object.values(festRaw).find(Array.isArray));
const surgeRaw = JSON.parse(readFileSync("data/festivals.surge.json", "utf8")).festivals;
const byId = Array.isArray(surgeRaw) ? Object.fromEntries(surgeRaw.map((s) => [s.id, s])) : surgeRaw;

const DAY = 86400000;
const t = (y) => Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8));
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
const clean = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 8);
const rowsCache = new Map();
const rowsOf = (code) => (rowsCache.has(code) ? rowsCache.get(code) : rowsCache.set(code, loadDaily(code)).get(code));

const items = [];
const periodsByCode = new Map();
for (const f of fest) {
  const s = byId[f.id];
  if (!s?.ok || !s.code) continue;
  const a = clean(f.eventStartDate), b = clean(f.eventEndDate);
  if (a.length !== 8 || b.length !== 8) continue;
  items.push({ code: s.code, a, b, pop: f.populationManMyeong });
  (periodsByCode.get(s.code) ?? periodsByCode.set(s.code, []).get(s.code)).push([t(a), t(b)]);
}
const overlaps = (code, a, b) => (periodsByCode.get(code) ?? []).some(([x, y]) => a <= y + 7 * DAY && b >= x - 7 * DAY);

function collect(exclude) {
  const real = [], fake = [];
  const opts = { exclude, namesOf: holidayNames };
  for (const it of items) {
    const r = festivalSignal(rowsOf(it.code), it.a, it.b, opts);
    if (r) real.push({ ...r, pop: it.pop });
    for (const weeks of [-26, -13, 13, 26]) {
      const fa = t(it.a) + weeks * 7 * DAY, fb = t(it.b) + weeks * 7 * DAY;
      if (overlaps(it.code, fa, fb)) continue;
      const z = festivalSignal(rowsOf(it.code), ymd(fa), ymd(fb), opts);
      if (z) fake.push({ ...z, pop: it.pop });
    }
  }
  return { real, fake };
}

function auc(R, F) {
  const all = [...R.map((v) => [v, 1]), ...F.map((v) => [v, 0])].sort((x, y) => x[0] - y[0]);
  let rs = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j < all.length && all[j][0] === all[i][0]) j++;
    const avg = (i + j + 1) / 2;
    for (let q = i; q < j; q++) if (all[q][1]) rs += avg;
    i = j;
  }
  return (rs - (R.length * (R.length + 1)) / 2) / (R.length * F.length);
}
const pct = (xs, fn) => `${((100 * xs.filter(fn).length) / xs.length).toFixed(1)}%`;

console.log(`문턱 ${JSON.stringify(SIGNAL_THRESHOLDS)}`);
for (const [name, exclude] of Object.entries(VARIANTS)) {
  if (VARIANT && VARIANT !== name) continue;
  const { real, fake } = collect(exclude);
  const withHol = (xs) => xs.filter((o) => o.holidays.length > 0);
  const noHol = (xs) => xs.filter((o) => o.holidays.length === 0);
  console.log(`\n[${name}] 진짜 ${real.length} · 가짜 ${fake.length} (명절·공휴일과 겹침: 진짜 ${withHol(real).length} · 가짜 ${withHol(fake).length})`);
  console.log(`  AUC zPeak ${auc(real.map((o) => o.zPeak), fake.map((o) => o.zPeak)).toFixed(3)} · rank ${auc(real.map((o) => o.rank), fake.map((o) => o.rank)).toFixed(3)} | 공휴일 안 겹친 것만 rank ${auc(noHol(real).map((o) => o.rank), noHol(fake).map((o) => o.rank)).toFixed(3)}`);
  for (const tier of ["뚜렷함", "약함", "구분 안 됨"]) {
    console.log(`  ${tier.padEnd(6)} 진짜 ${pct(real, (o) => o.tier === tier).padStart(6)} · 가짜 ${pct(fake, (o) => o.tier === tier).padStart(6)}`);
  }
  console.log("  인구 구간별 AUC (rank)");
  for (const [label, fn] of [["<10만", (p) => p < 10], ["10~30만", (p) => p >= 10 && p < 30], ["30~60만", (p) => p >= 30 && p < 60], ["≥60만", (p) => p >= 60]]) {
    const R = real.filter((o) => Number.isFinite(o.pop) && fn(o.pop)), F = fake.filter((o) => Number.isFinite(o.pop) && fn(o.pop));
    if (R.length < 20 || F.length < 20) continue;
    console.log(`    ${label.padEnd(8)} 진짜 ${R.length} · AUC ${auc(R.map((o) => o.rank), F.map((o) => o.rank)).toFixed(3)} · 진짜 구분 안 됨 ${pct(R, (o) => o.tier === "구분 안 됨")}`);
  }
}
