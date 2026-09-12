import { test } from "node:test";
import assert from "node:assert/strict";

import { checkQueryString, checkUrlFromExtraction, DEMOS, GUNPO_2027, HWACHEON_2027, parseCheckQuery } from "@/lib/checkquery";
import { manifest } from "@/lib/kto/daily";

test("빈 URL 이면 군포 2027 견본", () => {
  const p = parseCheckQuery({});
  assert.equal(p.isDemo, true);
  assert.deepEqual(p.query, GUNPO_2027);
  assert.equal(checkQueryString(p.query, true), "");
});

test("담당자 입력 — 날짜는 YYYY-MM-DD 로 받아 YYYYMMDD 로, 이력은 채운 칸만", () => {
  const p = parseCheckQuery({
    name: "X",
    sido: "경기",
    sigungu: "군포시",
    n: "217,502",
    basis: "peakDay",
    counting: "personDays",
    start: "2027-04-17",
    end: "2027-04-25",
    h1s: "2025-04-19",
    h1e: "2025-04-27",
    h3s: "2024-04-20",
    h3e: "2024-04-28",
  });
  assert.equal(p.isDemo, false);
  assert.deepEqual(p.errors, []);
  assert.equal(p.query.n, 217502);
  assert.equal(p.query.start, "20270417");
  assert.deepEqual(
    p.query.history.map((h) => h.year),
    ["2025", "2024"],
  );
});

test("왕복 — 쿼리 문자열로 옮겨 다시 읽으면 같다", () => {
  const qs = checkQueryString(GUNPO_2027, false);
  const params = Object.fromEntries(new URLSearchParams(qs.slice(1)).entries());
  const p = parseCheckQuery(params);
  // 이력의 출처(source)는 픽스처 전용이라 URL 에 실리지 않는다 — 그것만 빼고 같아야 한다
  assert.deepEqual(p.query, { ...GUNPO_2027, history: GUNPO_2027.history.map(({ year, start, end }) => ({ year, start, end })) });
});

test("단위를 안 고르면 null 로 남긴다 — 판정 엔진이 '단위 미상'을 낸다", () => {
  const p = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000" });
  assert.equal(p.query.basis, null);
  assert.equal(p.query.counting, null);
  assert.deepEqual(p.errors, []);
});

test("고칠 것은 errors 로 — 잘못된 날짜·뒤집힌 기간·반쪽 이력·빈 시군구", () => {
  const p = parseCheckQuery({ sigungu: "군포시", n: "-3", start: "2027-13-01", h1s: "2025-04-19", h2s: "2025-04-27", h2e: "2025-04-19" });
  assert.ok(p.errors.some((e) => e.includes("예상 방문객")));
  assert.ok(p.errors.some((e) => e.includes("start")));
  assert.ok(p.errors.some((e) => e.includes("이력 1")));
  assert.ok(p.errors.some((e) => e.includes("이력 2")));
  assert.ok(p.errors.some((e) => e.includes("시도와 시군구")));
});

test("예산(만 원)은 budget 으로 받고 왕복하며, 견본에는 가정값이 들어 있다 (M3)", () => {
  const p = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000", budget: "12,500" });
  assert.equal(p.query.budgetManWon, 12500);
  assert.deepEqual(p.errors, []);
  const qs = checkQueryString(p.query, false);
  assert.match(qs, /budget=12500/);
  const none = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000" });
  assert.equal(none.query.budgetManWon, null);
  assert.ok(!checkQueryString(none.query, false).includes("budget="));
  const bad = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000", budget: "-3" });
  assert.ok(bad.errors.some((e) => e.includes("예산")));
  assert.ok(GUNPO_2027.budgetManWon !== null && GUNPO_2027.budgetManWon > 0, "견본 예산이 없으면 판정 항목이 셋이 못 된다");
});

test("M7-1 견본은 둘, 서로 다른 시도, demo 파라미터로 고르고 링크가 왕복한다", () => {
  assert.equal(Object.keys(DEMOS).length, 2);
  assert.notEqual(GUNPO_2027.sido, HWACHEON_2027.sido);
  const h = parseCheckQuery({ demo: "hwacheon" });
  assert.equal(h.isDemo, true);
  assert.equal(h.demo, "hwacheon");
  assert.deepEqual(h.query, HWACHEON_2027);
  assert.equal(checkQueryString(h.query, true), "?demo=hwacheon");
  const g = parseCheckQuery({});
  assert.equal(g.demo, "gunpo");
  assert.equal(checkQueryString(g.query, true), "");
  const x = parseCheckQuery({ demo: "없는것" });
  assert.equal(x.demo, "gunpo", "모르는 견본 이름은 기본 견본으로");
});

test("M7-2 견본 이력은 연도마다 출처가 있고 날짜가 KT 자료 범위 안이다", () => {
  const m = manifest();
  for (const d of Object.values(DEMOS)) {
    assert.ok(d.banner.length > 40 && d.why.length > 10, d.key);
    assert.ok(d.claimSource.length > 10, `${d.key} 예상 방문객 출처`);
    assert.ok(d.query.history.length >= 2, `${d.key} 이력 2년 이상`);
    for (const h of d.query.history) {
      assert.ok(h.source && h.source.length > 5, `${d.key} ${h.year} 출처 없음`);
      assert.ok(h.start <= h.end, `${d.key} ${h.year} 기간`);
      assert.ok(m.from !== null && m.to !== null && h.start >= m.from && h.end <= m.to, `${d.key} ${h.year} 자료 밖: ${h.start}~${h.end}`);
    }
  }
});

test("M7-3 하나는 문체부 지정축제(글로벌축제)다", () => {
  assert.ok(Object.values(DEMOS).some((d) => d.designated), "지정축제 견본이 없다");
});

// 2026-09-11 — 619건은 KT 시군구 299곳 중 178곳만 덮는다. 나머지는 담당자가 인구를 적어야 또래가 선다
test("지역 인구(pop, 만 명)는 URL 로 받고 되돌려 준다. 0 이하는 오류", () => {
  const p = parseCheckQuery({ sido: "전남", sigungu: "함평군", n: "300000", basis: "period", counting: "personDays", pop: "3.0" });
  assert.deepEqual(p.errors, []);
  assert.equal(p.query.populationManMyeong, 3);
  assert.match(checkQueryString(p.query, false), /pop=3/);
  const bad = parseCheckQuery({ sido: "전남", sigungu: "함평군", pop: "0" });
  assert.ok(bad.errors.some((e) => e.includes("지역 인구")));
  assert.equal(parseCheckQuery({ sido: "전남", sigungu: "함평군" }).query.populationManMyeong, null);
});

// 2026-09-11 회귀 — 619건에 군포시·화천군 축제가 없어, 인구 폴백을 지우자 견본 2건의 또래 구간이 사라졌다.
// 견본 인구는 619건이 아니라 출처가 붙은 고정값이어야 한다
test("N0 견본 2건은 지역 인구와 그 출처를 함께 갖는다 (619건에 없는 시군구)", async () => {
  const { populationOf } = await import("@/lib/festivals");
  for (const d of Object.values(DEMOS)) {
    assert.equal(populationOf(d.query.sido, d.query.sigungu), null, `${d.key} 가 619건에 생겼다면 고정값을 지워라`);
    assert.ok(d.query.populationManMyeong !== null && d.query.populationManMyeong > 0, `${d.key} 인구 없음`);
    assert.match(d.populationSource, /기준/, `${d.key} 인구 출처에 기준 시점이 없다`);
    assert.doesNotMatch(d.populationSource, /\d명/, `${d.key} 출처 문장에 명 수가 있다 — 명 수는 <Num> 셀로만 나간다`);
    assert.match(d.populationSource, /조회 20\d\d-\d\d-\d\d/, `${d.key} 인구 출처에 조회일이 없다`);
  }
  assert.equal(DEMOS.gunpo.query.populationManMyeong, 24.9);
  assert.equal(DEMOS.hwacheon.query.populationManMyeong, 2.3);
});


// 2026-09-12 M3a-1 — 기획서 다리가 `?sido=&sigungu=&budget=9000` 처럼 값이 비어 와도 견본(군포)으로 떨어지면 안 된다.
// 견본은 판정 키가 하나도 없을 때만이고, `draft`·`demo` 같은 주석 키는 판정에 안 보인다
test("판정 키가 값 없이 있어도 담당자 입력이고, 주석 키(draft)만으로는 견본이다", () => {
  const bridge = parseCheckQuery({ sido: "", sigungu: "", budget: "9000" });
  assert.equal(bridge.isDemo, false);
  assert.ok(bridge.errors.some((e) => e.includes("시도와 시군구")));
  assert.equal(bridge.query.budgetManWon, 9000);
  const onlyDraft = parseCheckQuery({ draft: "17" });
  assert.equal(onlyDraft.isDemo, true, "draft 는 판정 키가 아니다");
  const unknown = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000", zzz: "1", draft: "3", t: "abc" });
  const known = parseCheckQuery({ sido: "경기", sigungu: "군포시", n: "1000" });
  assert.deepEqual(unknown.query, known.query, "모르는 키가 판정을 바꿨다");
});

// 2026-09-12 E — 추출 결과의 테마·접근성은 주석 키로 /check 에 실린다 (판정 키 아님)
test("checkUrlFromExtraction 은 theme·acc 를 주석 키로 싣고, 없으면 싣지 않는다", () => {
  const base = { sido: "경기", sigungu: "군포시", month: 4, populationManMyeong: null, evidence: {}, missing: [], source: "llm" as const, facts: undefined };
  const with_ = checkUrlFromExtraction({ ...base, themeCode: 2, accessibility: 4 });
  assert.match(with_, /[?&]theme=2/);
  assert.match(with_, /[?&]acc=4/);
  const without = checkUrlFromExtraction({ ...base, themeCode: null, accessibility: null });
  assert.doesNotMatch(without, /theme=|acc=/);
});
