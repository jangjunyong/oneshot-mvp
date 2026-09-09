// 기획서 추출 테스트.
//
// 여기서 지키는 것은 추출 정확도가 아니다 — 그건 모델이 하는 일이고 테스트로
// 못 잡는다. 지키는 것은 **모델이 없어도 앱이 산다**는 약속과, 추출 결과가
// 그대로 match 에 먹힌다는 계약이다.
//
// 이 파일은 모델을 부르지 않는다. 부르면 테스트가 돈을 쓰고 네트워크에 묶인다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractPlan, extractFailureMessage, hasModelKey, sanitizeFacts, shortSido } from "@/lib/extract";
import { checkUrlFromExtraction } from "@/lib/checkquery";
import { populationOf } from "@/lib/festivals";
import { findSimilar } from "@/lib/match";
import { ACCESSIBILITY_LABEL, MAX_PLAN_TEXT, THEME_NAME } from "@/lib/types";

// 키가 꽂힌 채로 테스트를 돌리면 진짜로 호출된다. 그건 사고다.
assert.equal(
  hasModelKey(),
  false,
  "테스트는 OPENROUTER_API_KEY 없이 돌려야 한다",
);

const 기획서 = `제1회 김천김밥축제 추진계획
○ 개최기간: 2024년 10월 중 3일간
○ 개최장소: 경상북도 김천시 일원`;

test("키가 없으면 모델을 부르지 않고 샘플 초안으로 떨어진다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.equal(초안.source, "sample");
});

test("샘플이라는 사실을 숨기지 않는다 — 근거에 표시가 남는다", async () => {
  const 초안 = await extractPlan(기획서);
  // 화면이 "실제 문서에서 뽑은 값이 아니다"라고 말할 수 있어야 한다.
  // 표시가 없으면 지어낸 값이 근거인 척한다.
  assert.match(초안.evidence.sido ?? "", /샘플/);
});

test("값을 채운 항목에는 반드시 근거가 붙는다", async () => {
  const 초안 = await extractPlan(기획서);
  for (const key of ["sido", "sigungu", "month", "themeCode", "accessibility"] as const) {
    if (초안[key] !== null) {
      assert.ok(
        초안.evidence[key],
        `${key} 는 값이 있는데 근거가 없다 — 실무자는 못 믿는다`,
      );
    }
  }
});

test("뽑힌 값이 THEME_NAME · ACCESSIBILITY_LABEL 안에 있다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.ok(초안.themeCode !== null && THEME_NAME[초안.themeCode]);
  assert.ok(
    초안.accessibility !== null && ACCESSIBILITY_LABEL[초안.accessibility],
  );
});

test("인구는 모델이 아니라 619건 데이터에서 온다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.equal(
    초안.populationManMyeong,
    populationOf(초안.sido!, 초안.sigungu!),
    "인구는 데이터 조회값과 같아야 한다 — 모델이 지어내면 안 된다",
  );
});

test("모델이 법정 시도명을 주면 619건 표기로 옮긴다", () => {
  // 실측(2026-08-31): gemini-2.5-flash-lite 가 김천 기획서에서 시도를
  // **"경상북도"** 로 돌려줬다. 619건은 "경북"을 쓴다. 안 옮기면 coordsOf 가
  // null 이 되어 **지역 축이 통째로 빠진 채** 조용히 진단이 나간다.
  //
  // 무료 모델이 계속 429 라 이 길을 아무도 안 지나가서 여태 안 드러났다.
  assert.equal(shortSido("경상북도"), "경북");
  assert.equal(shortSido("강원특별자치도"), "강원");
  assert.equal(shortSido("전북특별자치도"), "전북");
  assert.equal(shortSido("서울특별시"), "서울");
  // 이미 축약형이면 그대로 둔다
  assert.equal(shortSido("경북"), "경북");
  assert.equal(shortSido("서울"), "서울");
  // 모르는 것은 지어내지 않고 그대로 넘긴다 — 사람이 확인 화면에서 고친다
  assert.equal(shortSido("없는도"), "없는도");
  assert.equal(shortSido(null), null);
});

test("모르는 지역은 인구를 지어내지 않고 null 을 돌려준다", () => {
  assert.equal(populationOf("없는시도", "없는시군구"), null);
});

test("못 찾은 항목은 무엇이 없는지 한국어로 말한다", async () => {
  const 초안 = await extractPlan(기획서);
  // 샘플은 5축이 다 차 있다. missing 은 배열이어야 하고, 들어 있다면
  // 화면에 그대로 뿌릴 수 있는 한국어여야 한다 (코드명이 아니라).
  assert.ok(Array.isArray(초안.missing));
  for (const name of 초안.missing) {
    assert.ok(!/[a-zA-Z]/.test(name), `missing 에 코드명이 샜다: ${name}`);
  }
});

test("추출 결과를 그대로 findSimilar 에 넣으면 닮은 축제가 나온다", async () => {
  const 초안 = await extractPlan(기획서);

  // 이 계약이 깨지면 화면에서 값을 손으로 옮겨야 한다는 뜻이다.
  const result = findSimilar({
    sido: 초안.sido!,
    sigungu: 초안.sigungu!,
    month: 초안.month!,
    themeCode: 초안.themeCode!,
    populationManMyeong: 초안.populationManMyeong!,
    accessibility: 초안.accessibility!,
  });

  assert.equal(result.invalid, undefined, "추출 결과가 입력 검증을 통과해야 한다");
  assert.ok(result.matched.length > 0, "김천 조건이면 닮은 축제가 나와야 한다");
});

test("입력 길이 상한이 실제로 걸려 있다", () => {
  // 1건당 비용의 상한이 이 숫자다. 커지면 상한이 무너진다.
  assert.ok(MAX_PLAN_TEXT > 0 && MAX_PLAN_TEXT <= 20000);
});

// ── 추출 실패 문구 ────────────────────────────────────────
//
// 2026-08-30 실제로 터진 것: 무료 모델이 429 를 뱉었는데 그 본문이
// 담당 공무원 화면과 주소창에 그대로 실렸다.
//
//   추출 요청이 거절됐습니다 (429) {"error":{"message":"Provider returned
//   error","code":429,"metadata":{"raw":"z-ai/glm-5.2:free is temporarily
//   rate-limited upstream. Please retry shortly, or add your own key...
//
// 공급자 사정을 사용자가 읽을 이유가 없다. 여기서 지키는 것은
// **화면에 나가는 문장에 원문·JSON·영어가 섞이지 않는 것**이다.

test("추출이 실패해도 공급자 원문을 화면에 흘리지 않는다", () => {
  const 원문 =
    '{"error":{"message":"Provider returned error","code":429,"metadata":' +
    '{"raw":"z-ai/glm-5.2:free is temporarily rate-limited upstream."}}}';
  const msg = extractFailureMessage(429, 원문);

  assert.doesNotMatch(msg, /[{}"]/, `JSON 부호가 남았다: ${msg}`);
  assert.doesNotMatch(msg, /[A-Za-z]{6,}/, `영어 원문이 남았다: ${msg}`);
  assert.ok(msg.length < 90, `문장이 너무 길다(${msg.length}자): ${msg}`);
  assert.match(msg, /[가-힣]/, "한국어 문장이어야 한다");
});

test("상태 코드마다 담당자가 할 수 있는 일을 알려준다", () => {
  // 붐빔 — 다시 눌러 볼 수 있다
  assert.match(extractFailureMessage(429, ""), /잠시|다시/);
  // 키 문제 — 담당자가 할 수 있는 게 없다. 직접 입력으로 보낸다
  assert.match(extractFailureMessage(401, ""), /직접/);
  // 서버 문제 — 잠시 후
  assert.match(extractFailureMessage(503, ""), /잠시|다시/);

  // 어떤 코드가 와도 문장이 나오고, 원문이 안 섞인다
  for (const code of [400, 402, 403, 404, 408, 429, 500, 502, 503, 504, 999]) {
    const m = extractFailureMessage(code, '{"raw":"something went wrong"}');
    assert.ok(m.length > 0 && m.length < 90, `${code}: ${m}`);
    assert.doesNotMatch(m, /[{}"]/, `${code} 에 원문이 남았다: ${m}`);
  }
});

test("실패 문구는 항상 다음 행동으로 이어진다", () => {
  // 막다른 문장을 내면 담당자는 화면을 닫는다. 어디로 갈지 늘 적는다.
  for (const code of [401, 402, 429, 500, 503]) {
    const m = extractFailureMessage(code, "");
    assert.match(m, /직접|다시|잠시/, `${code} 가 다음 행동을 안 알려준다: ${m}`);
  }
});

// ── 팩트체크 항목 (기획/08 §4 #14) ────────────────────────
//
// 예상 방문객·기간·주차·부스·예산은 문서에서 **옮겨 적은 값**이다. 원문 근거가 없는 값은
// 지어낸 것이므로 null 로 되돌려야 하고, 그러면 /check 는 그 항목을 판정하지 않는다.

test("샘플 초안에도 팩트체크 항목이 있고, 값이 있는 항목엔 근거가 붙는다", async () => {
  const 초안 = await extractPlan(기획서);
  assert.ok(초안.facts, "facts 가 없다");
  const f = 초안.facts!;
  assert.equal(f.expectedVisitors, 100000);
  assert.equal(f.visitorBasis, "period");
  assert.equal(f.visitorCounting, null, "샘플은 연인원/실인원을 말하지 않는다 — 판정은 단위 미상이어야 한다");
  for (const k of ["expectedVisitors", "startDate", "endDate", "parkingSpaces", "boothCount", "budgetManWon"] as const) {
    if (f[k] !== null) assert.ok(f.evidence[k], `${k} 값은 있는데 근거가 없다`);
  }
  // 5축 근거에는 팩트 키가 섞이지 않는다 (/ 화면은 facts 를 모른다)
  assert.ok(!("expectedVisitors" in 초안.evidence));
});

test("원문 근거가 없는 값은 null 로 되돌린다 — 모델이 스키마 때문에 채운 숫자는 지어낸 것이다", () => {
  const f = sanitizeFacts({
    sido: null, sigungu: null, month: null, themeCode: null, accessibility: null,
    expectedVisitors: 50000,
    visitorBasis: "peakDay",
    visitorCounting: "unique",
    startDate: "2027-05-01",
    endDate: "2027/05/03",
    parkingSpaces: 0,
    boothCount: 80,
    budgetManWon: 12000,
    evidence: { startDate: "5월 1일 개막", boothCount: "판매 부스 80개", budgetManWon: "" },
  });
  assert.equal(f.expectedVisitors, null, "근거 없는 예상 방문객");
  assert.equal(f.visitorBasis, null, "값이 없으면 단위도 비운다");
  assert.equal(f.visitorCounting, null);
  assert.equal(f.startDate, "2027-05-01");
  assert.equal(f.endDate, null, "YYYY-MM-DD 가 아니면 버린다");
  assert.equal(f.parkingSpaces, null, "0 은 값이 아니다");
  assert.equal(f.boothCount, 80);
  assert.equal(f.budgetManWon, null, "빈 근거는 근거가 아니다");
  assert.deepEqual(Object.keys(f.evidence).sort(), ["boothCount", "startDate"]);
});

test("초안 → /check 링크: 뽑힌 값만 옮기고 이력은 비워 둔다", async () => {
  const 초안 = await extractPlan(기획서);
  const url = checkUrlFromExtraction(초안, "김천김밥축제");
  assert.ok(url);
  const p = new URLSearchParams(url!.split("?")[1]);
  assert.equal(p.get("sido"), "경북");
  assert.equal(p.get("sigungu"), "김천시");
  assert.equal(p.get("n"), "100000");
  assert.equal(p.get("basis"), "period");
  assert.equal(p.get("counting"), null);
  assert.equal(p.get("start"), "2024-10-25");
  assert.equal(p.get("h1s"), null);
  // 시군구가 없으면 링크도 없다
  assert.equal(checkUrlFromExtraction({ ...초안, sigungu: null }), null);
  // 옛 초안(facts 없음)도 링크는 선다 — 시군구만 넘긴다
  const { facts: _f, ...옛 } = 초안;
  void _f;
  assert.match(checkUrlFromExtraction(옛)!, /^\/check\?sido=/);
});
