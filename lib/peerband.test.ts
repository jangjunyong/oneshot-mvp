import { test } from "node:test";
import assert from "node:assert/strict";

import { peerBandFor, peerSurgePairs, topPercentile } from "@/lib/peerband";

test("상위 5% 경계 — 오름차순 배열의 위에서 5% 지점", () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(topPercentile(xs, 5), 95);
  assert.equal(topPercentile([1, 2, 3], 5), 3);
  assert.equal(topPercentile([], 5), null);
});

test("군포(인구 26만) 또래 — 12~30만 구간, 재계산이 선 것만, 중앙값 ≤ 상위 5%", () => {
  const b = peerBandFor(26);
  assert.ok(b);
  assert.equal(b.label, "인구 12~30만 지역 축제");
  assert.ok(b.n >= 50, `또래 수 ${b.n}`);
  assert.ok(b.meanMedian <= b.meanP95);
  assert.ok(b.peakMedian <= b.peakP95);
  assert.ok(b.meanMedian > 0.5 && b.meanMedian < 3);
  assert.equal(peerSurgePairs(26).length, b.n);
});

test("구간 밖·음수는 null", () => {
  assert.equal(peerBandFor(-1), null);
  assert.equal(peerBandFor(Number.NaN), null);
});
