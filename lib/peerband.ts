// 또래 구간 — 같은 인구 구간 619건의 배수 분포에서 중앙값과 상위 5% 를 꺼낸다.
//
// 값은 data/festivals.surge.json — 619건을 lib/surge.ts 한 정의로 재계산한 것이라 자기 이력과
// 같은 자다. 옛 actualVisitSurge(수집 당시 정의)는 여기서 쓰지 않는다.
// 이력이 없거나 1년뿐인 축제의 3단계 비교 대상이고, 내년 구간 카드의 둘째 줄이다.

import surgeBundle from "@/data/festivals.surge.json";
import { FESTIVALS } from "@/lib/festivals";
import { POPULATION_BUCKETS } from "@/lib/peer";
import type { PeerBand } from "@/lib/verdict";

interface FestivalSurgeRow {
  ok: boolean;
  surgeMean?: number;
  surgePeak?: number;
}
const SURGES = (surgeBundle as unknown as { festivals: Record<string, FestivalSurgeRow> }).festivals;

export const SURGE_META = (surgeBundle as unknown as { meta: { dataFrom: string; dataTo: string; computedAt: string; ok: number; total: number } }).meta;

/** 오름차순 배열의 상위 p% 경계 (p=5 → 위에서 5% 지점) */
export function topPercentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * (1 - p / 100)) - 1));
  return sorted[idx];
}

function medianOf(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/** 재계산이 선 또래의 (평균, 최대일) 배수 쌍 */
export function peerSurgePairs(populationManMyeong: number): { mean: number; peak: number }[] {
  if (!Number.isFinite(populationManMyeong) || populationManMyeong < 0) return [];
  const b = POPULATION_BUCKETS.find((x) => populationManMyeong >= x.min && populationManMyeong < x.max);
  if (!b) return [];
  const out: { mean: number; peak: number }[] = [];
  for (const f of FESTIVALS) {
    if (f.populationManMyeong < b.min || f.populationManMyeong >= b.max) continue;
    const s = SURGES[f.id];
    if (!s?.ok || s.surgeMean === undefined || s.surgePeak === undefined) continue;
    out.push({ mean: s.surgeMean, peak: s.surgePeak });
  }
  return out;
}

export function peerBandFor(populationManMyeong: number): PeerBand | null {
  const pairs = peerSurgePairs(populationManMyeong);
  if (pairs.length === 0) return null;
  const b = POPULATION_BUCKETS.find((x) => populationManMyeong >= x.min && populationManMyeong < x.max)!;
  const means = pairs.map((p) => p.mean).sort((a, c) => a - c);
  const peaks = pairs.map((p) => p.peak).sort((a, c) => a - c);
  return {
    n: pairs.length,
    label: `인구 ${b.label} 지역 축제`,
    meanMedian: medianOf(means)!,
    meanP95: topPercentile(means, 5)!,
    peakMedian: medianOf(peaks)!,
    peakP95: topPercentile(peaks, 5)!,
  };
}
