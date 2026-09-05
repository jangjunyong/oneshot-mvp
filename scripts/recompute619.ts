// 619건(data/festivals.json)의 배수를 lib/surge.ts 한 정의로 다시 계산한다.
//
// 결과는 data/festivals.surge.json 에 id 별로 쓴다. 원본 actualVisitSurge 는 건드리지 않는다 —
// 수집 당시 정의(베이스라인이 무엇이었는지)가 코드에 남아 있지 않아 대조용으로 남긴다.
// 자료 범위 밖(2026-08 이후, 2024-03 이전) 축제는 ok:false 로 남고 화면은 그 사실을 그대로 보인다.
//
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/recompute619.ts
// 프리페치가 진행될수록 ok 건수가 늘어난다 — 배치 뒤 다시 돌린다.

import { writeFileSync } from "node:fs";
import path from "node:path";

import { FESTIVALS } from "@/lib/festivals";
import { computeSurge } from "@/lib/surge";
import { loadDaily, manifest, sigunguCode } from "@/lib/kto/daily";

export interface FestivalSurge {
  id: string;
  code: string | null;
  ok: boolean;
  reason?: string;
  /** 배수(평균) = 축제일 외지인 평균 / 전후 4주 중앙값 */
  surgeMean?: number;
  surgePeak?: number;
  peakYmd?: string;
  baseline?: number;
  /** Σ(ΔV + max(0,ΔL)) 연인원 */
  visitors?: number | null;
  deltaPeak?: number | null;
  coverage: { festivalDays: number; festivalDaysPresent: number; windowDays: number; windowDaysPresent: number };
  /** 원본 수집값 — 대조용 */
  legacySurge: number;
}

const out: Record<string, FestivalSurge> = {};
let ok = 0;
const reasons: Record<string, number> = {};
const diffs: number[] = [];
for (const f of FESTIVALS) {
  const code = sigunguCode(f.sido, f.sigungu);
  if (!code) {
    out[f.id] = { id: f.id, code: null, ok: false, reason: "no-code", coverage: { festivalDays: 0, festivalDaysPresent: 0, windowDays: 0, windowDaysPresent: 0 }, legacySurge: f.actualVisitSurge };
    reasons["no-code"] = (reasons["no-code"] ?? 0) + 1;
    continue;
  }
  const r = computeSurge({ rows: loadDaily(code), start: f.eventStartDate, end: f.eventEndDate });
  if (!r.ok) {
    out[f.id] = { id: f.id, code, ok: false, reason: r.reason, coverage: r.coverage, legacySurge: f.actualVisitSurge };
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    continue;
  }
  ok++;
  diffs.push(r.multMean - f.actualVisitSurge);
  out[f.id] = {
    id: f.id,
    code,
    ok: true,
    surgeMean: Math.round(r.multMean * 1000) / 1000,
    surgePeak: Math.round(r.multPeak * 1000) / 1000,
    peakYmd: r.peakYmd,
    baseline: r.baseline,
    visitors: r.visitors === null ? null : Math.round(r.visitors),
    deltaPeak: r.deltaPeak === null ? null : Math.round(r.deltaPeak),
    coverage: r.coverage,
    legacySurge: f.actualVisitSurge,
  };
}

const m = manifest();
const doc = {
  meta: {
    definition: "surgeMean = mean(외지인, 축제일) / median(외지인, 전후 4주 축제일 제외); lib/surge.ts",
    dataFrom: m.from,
    dataTo: m.to,
    dataDays: m.days,
    computedAt: new Date().toISOString(),
    ok,
    total: FESTIVALS.length,
    reasons,
  },
  festivals: out,
};
writeFileSync(path.join(process.cwd(), "data", "festivals.surge.json"), JSON.stringify(doc));
const mean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
const abs = diffs.length ? diffs.reduce((a, b) => a + Math.abs(b), 0) / diffs.length : 0;
console.log(`ok ${ok}/${FESTIVALS.length}`, reasons, `Δ(new−legacy) mean ${mean.toFixed(3)} abs ${abs.toFixed(3)}`);
