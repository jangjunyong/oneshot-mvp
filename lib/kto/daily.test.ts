// 시군구 이름 → KT 코드. 사람이 치는 표기를 받아야 한다.
//
// 2026-09-11 실사용: 심사위원이 "충청남도 · 보령"을 치면 "코드를 찾지 못했다"로 판정이 아예
// 안 나왔다. "충남 · 보령시"만 됐다. 변환표는 있었는데 안 불렀고 접미사 보정은 없었다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveRegion, sigunguCode, sigunguNamesOf } from "@/lib/kto/daily";

test("정식 시도 이름과 짧은 이름이 같은 코드로 간다", () => {
  assert.equal(sigunguCode("충남", "보령시"), "44180");
  assert.equal(sigunguCode("충청남도", "보령시"), "44180");
  assert.equal(sigunguCode("강원도", "정선군"), "51770");
  assert.equal(sigunguCode("강원특별자치도", "정선군"), "51770");
  assert.equal(sigunguCode("경기", "군포시"), "41410");
});

test("접미사(시·군·구)가 빠져도 하나만 맞으면 그것으로 본다", () => {
  assert.equal(sigunguCode("충남", "보령"), "44180");
  assert.equal(sigunguCode("강원", "정선"), "51770");
  assert.equal(sigunguCode("경기", "군포"), "41410");
});

test("resolveRegion 은 KT 표기(짧은 시도·접미사 있는 시군구)를 돌려준다", () => {
  const r = resolveRegion("충청남도", "보령");
  assert.ok(r);
  assert.equal(r.sido, "충남");
  assert.equal(r.name, "보령시");
  assert.equal(r.code, "44180");
});

test("띄어쓰기 차이(청주시 상당구 / 청주시상당구)는 같은 곳", () => {
  const a = sigunguCode("충북", "청주시 상당구");
  const b = sigunguCode("충북", "청주시상당구");
  assert.ok(a);
  assert.equal(a, b);
  assert.notEqual(a, sigunguCode("충북", "청주시"), "구까지 적으면 시 전체로 보내지 않는다");
});

test("못 찾으면 null — 이웃을 짐작해 주지 않는다", () => {
  assert.equal(sigunguCode("강원", "고한읍"), null, "읍은 KT 시군구가 아니다");
  assert.equal(sigunguCode("충남", "없는곳"), null);
  assert.equal(sigunguCode("없는도", "보령시"), null);
  assert.equal(resolveRegion("강원", "고한읍"), null);
});

test("같은 시도의 후보 목록을 낸다 (못 찾았을 때 화면에 보여 줄 것)", () => {
  const names = sigunguNamesOf("충청남도");
  assert.ok(names.includes("보령시"));
  assert.ok(names.length >= 15);
  assert.deepEqual(sigunguNamesOf("없는도"), []);
});

// 2026-09-12 — sigungu.json 의 sido 빈 12xxx 27행(전남 22·광주 5, 2026-07-01 부터 새 코드)을 같은 이름의 정식 행에 병합한다.
// 병합 전에는 목포·함평 자료가 2026-06-30 에서 끝난 것처럼 읽혔고 7~8월 40일은 아무 입력으로도 못 닿았다.
test("Nz sido 빈 행은 목록에 없고, 전남·광주는 병합돼 자료 끝까지 이어진다", async () => {
  const { sigunguList, loadDaily, dailyRange, codeAliases, coverageStats, manifest } = await import("@/lib/kto/daily");
  const list = sigunguList();
  assert.equal(list.filter((x) => x.sido === "").length, 0, "sido 빈 행이 목록에 남았다");
  assert.equal(list.length, 272);
  assert.deepEqual(codeAliases("46110"), ["12110"], "목포시 병합 코드");
  assert.deepEqual(codeAliases("29110"), ["12210"], "광주 동구 병합 코드");
  assert.deepEqual(codeAliases("41410"), [], "군포시는 병합 없음");
  const mokpo = dailyRange("46110");
  assert.ok(mokpo);
  assert.equal(mokpo.to, manifest().to, "목포 자료가 적재 끝까지 이어져야 한다");
  assert.equal(mokpo.days, manifest().days, "목포 일수 = 전수");
  const rows = loadDaily("46860");
  assert.equal(new Set(rows.map((r) => r.ymd)).size, rows.length, "함평 병합 뒤 날짜 중복 0");
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].ymd < rows[i].ymd, "날짜 오름차순");
  const cov = coverageStats();
  assert.equal(cov.sigungu, 272);
  assert.equal(cov.fullCount, 258, "2,658일 전수 시군구 수");
  assert.equal(cov.rows, 697403, "적재 행 합계는 병합 전과 같다");
  assert.equal(cov.minDays, 40);
});

test("Nz 부천 원미구처럼 늦게 시작한 시군구는 자기 범위를 낸다 (전역 매니페스트가 아니다)", async () => {
  const { dailyRange, manifest, sigunguList } = await import("@/lib/kto/daily");
  const late = sigunguList().find((x) => x.days === 952);
  assert.ok(late, "952일짜리 시군구가 있어야 한다");
  const r = dailyRange(late.code);
  assert.ok(r && r.from > manifest().from!, `${late.name} 시작일이 전역 시작일보다 늦어야 한다`);
});

// 2026-09-12 E — 시군구 칸에 시도가 섞여 와도 풀고, 자치구 이름은 깨지 않는다
test("resolveRegion 은 '경기도 군포시'처럼 시도가 섞인 시군구도 풀고, '수원시 장안구'는 그대로 자치구다", () => {
  assert.equal(resolveRegion("경기", "경기도 군포시")?.code, "41410");
  assert.equal(resolveRegion("경기도", "경기 군포")?.code, "41410");
  assert.equal(resolveRegion("경기", "수원시 장안구")?.code, "41111");
  assert.equal(resolveRegion("경기", "군포")?.code, "41410");
});
