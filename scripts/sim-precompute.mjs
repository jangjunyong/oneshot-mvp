// 시뮬 정적 카드 — 군포 실도면에서 고정 설정으로 15분을 미리 돌려 요약 카드를 만든다 (2026-09-12 M7a, 사용자 지시 7).
//
// 왜 서버에서 미리 도나 — 담당자가 시뮬을 안 물어봐도 판정 결과에 "어디가 막히는가"가 먼저 보여야 한다.
// 브라우저 워커를 판정 화면에 넣으면 자바스크립트 0 계약이 깨지고, 질문 경로(점당 5명)는 10~12명/㎡ 같은
// 물리 밖 숫자를 낸 적이 있다(2026-09-11). 여기서는 점 하나 = 1명, 시드 고정, 같은 엔진(lib/sim/sim.js)으로만 돈다.
//
// 설정은 lib/simcard.ts 의 SIM_CARD_SETTINGS 하나에서 온다 — 카드·자동 실행·불변식 테스트가 같은 값을 본다.
// 최대 밀도가 물리 상한(DENSITY_CAP 7.22)을 넘으면 exit 1: 그 카드는 배치 판단이 아니라 코드 버그다.
//
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/sim-precompute.mjs
//   → data/sim/gunpo_base.json

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Simulation } from "../lib/sim/sim.js";
import { makeProjection, venueFromGeoJSON, centroid } from "../lib/sim/geo.js";
import { simCardFrom, DENSITY_CAP, SIM_CARD_SETTINGS } from "../lib/simcard.ts";

const fc = JSON.parse(readFileSync("public/venue/gunpo.geojson", "utf-8"));
const proj = makeProjection(fc.origin[0], fc.origin[1]);
const venue = venueFromGeoJSON(fc, proj);

const nearestName = (x, y) => {
  let best = null, bd = Infinity;
  for (const a of venue.attractions) { const d = Math.hypot(a.front[0] - x, a.front[1] - y); if (d < bd) { bd = d; best = a.name; } }
  for (const g of venue.gates) { const c = centroid(g.poly); const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = g.name; } }
  return best ? `${best} 근처 ${bd.toFixed(0)}m` : `(${x.toFixed(0)}, ${y.toFixed(0)})`;
};

const S = SIM_CARD_SETTINGS;
const t0 = Date.now();
const sim = new Simulation(venue, {
  inflowPerHour: S.inflowPerHour,
  visitsPerPerson: S.visitsPerPerson,
  dwellSecMean: S.dwellSecMean,
  seed: S.seed,
  personsPerAgent: S.personsPerAgent,
});
const steps = Math.round((S.minutes * 60) / sim.dt);
for (let i = 0; i < steps; i++) sim.step();
const sum = sim.summary();
const card = simCardFrom(sum, nearestName, { inflowPerHour: S.inflowPerHour.join(","), scale: 1, k: S.personsPerAgent, at: new Date().toISOString() });
if (!card) throw new Error("summary 가 비었다");
// 부동소수 꼬리(900.0000000001)를 카드에 남기지 않는다
card.simSec = Math.round(card.simSec);
card.peak.density = Math.round(card.peak.density * 100) / 100;
card.hotspots = card.hotspots.map((h) => ({ ...h, peak: Math.round(h.peak * 100) / 100, sec: Math.round(h.sec * 10) / 10 }));
card.secAbove5 = Math.round(card.secAbove5 * 10) / 10;

const out = {
  venue: "군포철쭉축제 2026 실도면 (public/venue/gunpo.geojson)",
  engine: "lib/sim/sim.js (CFSM, T=0.7, 시드 고정)",
  settings: S,
  builtAt: new Date().toISOString().slice(0, 10),
  elapsedMs: Date.now() - t0,
  card,
};
mkdirSync("data/sim", { recursive: true });
writeFileSync("data/sim/gunpo_base.json", JSON.stringify(out, null, 1) + "\n");
console.log(`peak ${card.peak.density.toFixed(2)}명/㎡ @ ${card.peak.where} · 3명/㎡↑ 지속 ${card.hotspots.length}곳 · 5명/㎡↑ ${card.secAbove5}s · ${out.elapsedMs}ms`);
if (card.peak.density > DENSITY_CAP) {
  console.error(`최대 밀도 ${card.peak.density.toFixed(2)} > 물리 상한 ${DENSITY_CAP} — 카드를 쓰지 않는다`);
  process.exit(1);
}
