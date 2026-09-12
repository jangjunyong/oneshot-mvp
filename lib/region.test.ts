// 행안부 주민등록 인구 표(data/region/population.json) — 2026-09-12 M5a-1.
// 인구의 출처를 619건 축제 목록(178/272 커버)에서 행안부 전국 표로 옮겼다. 표는 scripts/region-build.mjs 가
// 원본 CSV(data/region/raw/mois_202608.csv, data.go.kr 15097972)에서 만든다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { populationOfCode, populationSource, REGION_META } from "@/lib/region";
import { sigunguList } from "@/lib/kto/daily";

test("KT 시군구 272곳 중 269곳이 행안부 표와 맞고, 못 맞춘 3곳은 2026-07 개편으로 사라진 옛 인천 3구다", () => {
  assert.equal(REGION_META.matched, 269);
  assert.deepEqual(
    REGION_META.unmatched.map((u) => `${u.sido} ${u.name}`),
    ["인천 중구", "인천 동구", "인천 서구"],
  );
  assert.equal(REGION_META.matched + REGION_META.unmatched.length, sigunguList().length);
  for (const u of REGION_META.unmatched) assert.equal(populationOfCode(u.code), null, `${u.name} 은 null 이어야 한다 — 이웃을 짐작하지 않는다`);
});

// 원본 CSV 행정동 합계를 손으로 검산한 값(2026-08). 표를 다시 만들어도 이 값이 나와야 한다
test("스팟 검산 — 군포·보령·화천·정선·목포(12xxx 별칭)·세종·수원(4111* 합산)", () => {
  assert.equal(populationOfCode("41410"), 24.9, "군포시");
  assert.equal(populationOfCode("44180"), 9.1, "보령시");
  assert.equal(populationOfCode("51790"), 2.3, "화천군");
  assert.equal(populationOfCode("51770"), 3.5, "정선군");
  assert.equal(populationOfCode("46110"), 19.9, "목포시 — 행안부 새 코드 12110 을 별칭으로");
  assert.equal(populationOfCode("29110"), 10.5, "광주 동구 — 12210 별칭");
  assert.equal(populationOfCode("36110"), 39.1, "세종");
  assert.equal(populationOfCode("41110"), 118.6, "수원시 — 4111* 합산");
  assert.equal(populationOfCode("41111"), 27.0, "수원시 장안구");
  assert.equal(populationOfCode("99999"), null);
});

test("출처 한 줄에 기관·기준월·적재일이 있고, 원본 CSV 가 저장소에 있다", () => {
  const s = populationSource();
  assert.match(s, /행정안전부 주민등록인구 2026-08 기준/);
  assert.match(s, /적재 20\d\d-\d\d-\d\d/);
  assert.ok(readFileSync("data/region/raw/mois_202608.csv").length > 1_000_000, "원본 CSV 가 없거나 비었다");
});

test("견본 고정 인구(군포 24.9·화천 2.3)는 행안부 표와 0.1만 안에서 같다 — 두 출처가 갈리면 화면이 거짓말한다", async () => {
  const { DEMOS } = await import("@/lib/checkquery");
  assert.ok(Math.abs(DEMOS.gunpo.query.populationManMyeong! - populationOfCode("41410")!) <= 0.1);
  assert.ok(Math.abs(DEMOS.hwacheon.query.populationManMyeong! - populationOfCode("51790")!) <= 0.1);
});
