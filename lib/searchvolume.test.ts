// 검색량 순수 변환 테스트.
//
// 키가 없어 네트워크는 못 태우지만, **응답이 오면 무엇을 계산할지**는 지금
// 정해 둘 수 있다. 여기서 지키는 것은 두 가지다.
//   ① 네이버 ratio 는 상대값이다 — 절대 검색량인 척하지 않는다
//   ② 사용자가 물은 "고령층은 검색에 안 잡히나"를 추측이 아니라 수치로 낸다

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGE_LABEL,
  authHeaders,
  buildTrendBody,
  elderlyShare,
  ENDPOINT,
  leadRatio,
  type TrendPoint,
} from "@/lib/searchvolume";

const 점 = (period: string, ratio: number): TrendPoint => ({ period, ratio });

test("문을 틀리지 않는다 — 개발자센터 데이터랩", () => {
  // 두 문이 있고 둘 다 살아 있다. 키 없이 두드리면 양쪽 다 401 이라
  // **응답으로는 못 가른다.** 가르는 것은 열쇠를 받을 수 있는 쪽이고,
  // 네이버 클라우드 플랫폼의 Search Trend 는 2026-07-23 종료돼 신청이
  // 불가능하다(콘솔에서 직접 확인). 그래서 개발자센터로 못 박는다.
  assert.match(ENDPOINT, /^https:\/\/openapi\.naver\.com\/v1\/datalab\//);
  assert.doesNotMatch(ENDPOINT, /ntruss\.com/, "종료된 NCP 문이다");

  const 원래 = {
    id: process.env.NAVER_CLIENT_ID,
    secret: process.env.NAVER_CLIENT_SECRET,
  };
  try {
    process.env.NAVER_CLIENT_ID = "아이디";
    process.env.NAVER_CLIENT_SECRET = "시크릿";
    const h = authHeaders();
    assert.equal(h["X-Naver-Client-Id"], "아이디");
    assert.equal(h["X-Naver-Client-Secret"], "시크릿");
    assert.equal(h["X-NCP-APIGW-API-KEY-ID"], undefined, "NCP 헤더가 섞였다");
  } finally {
    process.env.NAVER_CLIENT_ID = 원래.id;
    process.env.NAVER_CLIENT_SECRET = 원래.secret;
  }
});

test("요청 본문 — 일 단위이고 연령 필터를 그대로 싣는다", () => {
  const b = buildTrendBody("김천김밥축제", "2025-10-01", "2025-10-31", ["11"]);
  assert.equal(b.timeUnit, "date", "일 단위여야 개최 전후를 본다");
  assert.equal(b.startDate, "2025-10-01");
  assert.equal(b.endDate, "2025-10-31");
  assert.deepEqual(b.ages, ["11"]);
  assert.equal(b.keywordGroups.length, 1);
  assert.deepEqual(b.keywordGroups[0].keywords, ["김천김밥축제"]);
});

test("개최 전 배수 — 평소 구간 대비 개최 직전 구간의 비", () => {
  // 평소(10-01~10-10) 평균 10 · 직전 7일(10-18~10-24) 평균 40 → 4배
  const rows: TrendPoint[] = [];
  for (let d = 1; d <= 10; d++) rows.push(점(`2025-10-${String(d).padStart(2, "0")}`, 10));
  for (let d = 11; d <= 17; d++) rows.push(점(`2025-10-${d}`, 10));
  for (let d = 18; d <= 24; d++) rows.push(점(`2025-10-${d}`, 40));

  const r = leadRatio(rows, "20251025", 7)!;
  assert.ok(Math.abs(r.ratio - 4) < 1e-9, `배수 ${r.ratio}`);
  assert.equal(r.leadDays, 7);
  assert.ok(r.baseline > 0);
});

test("표본이 모자라면 지어내지 않고 null", () => {
  assert.equal(leadRatio([], "20251025", 7), null);
  // 평소 구간이 아예 없으면(개최일 직전 데이터뿐) 비교 기준이 없다
  assert.equal(leadRatio([점("2025-10-24", 40)], "20251025", 7), null);
});

test("평소가 0 이면 배수를 못 낸다 — 무한대를 화면에 올리지 않는다", () => {
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => 점(`2025-10-${String(i + 1).padStart(2, "0")}`, 0)),
    ...Array.from({ length: 7 }, (_, i) => 점(`2025-10-${18 + i}`, 40)),
  ];
  assert.equal(leadRatio(rows, "20251025", 7), null);
});

test("고령층 비중 — 사용자가 물은 것을 추측이 아니라 수치로 낸다", () => {
  // 60세 이상(코드 11)이 전체 합에서 차지하는 몫
  const 합 = elderlyShare({ "1": 10, "9": 30, "10": 40, "11": 20 })!;
  assert.ok(Math.abs(합 - 0.2) < 1e-9, `비중 ${합}`);

  // 자료가 없으면 0 이 아니라 null — 안 잡힌 것과 0인 것은 다르다
  assert.equal(elderlyShare({}), null);
});

test("연령 코드표가 화면에 그대로 나갈 한국어를 가진다", () => {
  assert.equal(AGE_LABEL["11"], "60세 이상");
  assert.ok(Object.keys(AGE_LABEL).length >= 11);
});
