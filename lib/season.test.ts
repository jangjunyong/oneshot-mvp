// 시기 민감도 테스트.
//
// 이 표는 **거짓말하기 제일 쉬운 화면**이다. 달만 바꿔 findSimilar 를 12번
// 돌리면 "3월엔 2.58배, 9월엔 1.42배" 같은 표가 나오는데, 그 "9월" 행의
// 쌍둥이가 실제로는 10월·10월·8월 축제다. month 가중치가 0.1(match.ts)이라
// 달을 바꿔도 같은 지역 축제 몇 개가 재배열될 뿐이기 때문이다.
//
// 그래서 여기서 지키는 것은 정확도가 아니라 **정직함**이다:
//   ① 요청월과 쌍둥이 실제 개최월의 일치율을 재서 화면에 낼 수 있는가
//   ② 평평한 조건을 평평하다고 말하는가
//   ③ 표본 3개짜리 중앙값이라 limit 에 흔들린다는 사실을 아는가

import { test } from "node:test";
import assert from "node:assert/strict";

import { scanSeason } from "@/lib/season";
import { findSimilar } from "@/lib/match";
import { grade } from "@/lib/grade";
import type { PlanInput } from "@/lib/types";

/** 신호가 있는 조건 — 지방 소도시 */
const 고령: PlanInput = {
  sido: "경북", sigungu: "고령군", month: 3,
  themeCode: 3, populationManMyeong: 3, accessibility: 2,
};
/** 평평한 조건 — 수도권. 축제가 많아 어느 달이든 닮은 게 비슷하다 */
const 마포: PlanInput = {
  sido: "서울", sigungu: "마포구", month: 10,
  themeCode: 2, populationManMyeong: 36, accessibility: 5,
};

test("12달을 오름차순으로 전부 잰다", () => {
  const s = scanSeason(고령);
  assert.equal(s.months.length, 12);
  assert.deepEqual(s.months.map((m) => m.month), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(s.planMonth, 3);
});

test("기획안의 달 행은 진단 화면과 정확히 같다 — 두 숫자가 갈리면 안 된다", () => {
  const s = scanSeason(고령);
  const 그달 = s.months.find((m) => m.month === 고령.month)!;

  const r = findSimilar(고령);
  const g = grade(r);
  assert.equal(그달.medianSurge, g.medianSurge);
  assert.equal(그달.level, g.level);
  assert.equal(그달.matched, r.matched.length);
  assert.deepEqual(
    그달.twinNames,
    r.matched.map((m) => m.festival.name),
  );
});

test("쌍둥이의 실제 개최월을 같이 낸다 — 이게 없으면 표가 거짓말한다", () => {
  const s = scanSeason(고령);
  for (const m of s.months) {
    assert.equal(
      m.twinMonths.length,
      m.matched,
      `${m.month}월 행에 쌍둥이 개최월이 빠졌다`,
    );
    for (const tm of m.twinMonths) assert.ok(tm >= 1 && tm <= 12);
  }

  // 요청월과 실제 개최월이 대부분 다르다는 사실을 수치로 들고 있어야 한다.
  // 2026-08-30 실측: 고령·마포 모두 19%. 이 값이 화면에 나간다.
  assert.ok(
    s.monthMatchRate < 0.5,
    `일치율 ${s.monthMatchRate} — 높아졌다면 화면 문구를 다시 봐야 한다`,
  );

  // "9월 요청" 행에 9월 축제가 없다는 것이 이 기능의 한계 그 자체다
  const 구월 = s.months.find((m) => m.month === 9)!;
  assert.ok(구월.twinMonths.length > 0);
});

test("평평한 조건을 평평하다고 말한다 — spread 기준이지 등급 기준이 아니다", () => {
  // 등급으로 판정하면 GRADE_CUT(2.0/1.5)이 숨은 임계값이 된다. 전수로 재 보니
  // flat=true 최대 spread 0.46, flat=false 최소 0.07 — 폭이 6.5배 큰 쪽이
  // "평평"으로 나왔다. 그래서 spread 로 판정한다.
  const 마 = scanSeason(마포);
  assert.ok(마.spread !== null && 마.spread < 0.3, `마포 spread ${마.spread}`);
  assert.equal(마.flat, true, "수도권 조건은 평평해야 한다");

  const 고 = scanSeason(고령);
  assert.ok(고.spread !== null && 고.spread > 0.5, `고령 spread ${고.spread}`);
  assert.equal(고.flat, false, "지방 조건은 갈려야 한다");
});

test("limit 에 흔들리는지 스스로 안다 — 3개짜리 중앙값의 취약성", () => {
  // limit 을 3→5 로 바꾸면 고령 9월이 근거없음→주의로 뒤집힌다(실측).
  // 표본 하나 교체로 등급이 넘어가는 신호를 단단한 척 내보내면 안 된다.
  const s = scanSeason(고령);
  assert.equal(typeof s.robust, "boolean");
  // robust 가 false 라면 화면이 그 사실을 말해야 한다 — 여기서는 존재만 지킨다
});

test("쌍둥이가 없는 달은 지어내지 않는다", () => {
  const 벽지: PlanInput = {
    sido: "강원", sigungu: "양구군", month: 7,
    themeCode: 7, populationManMyeong: 0.5, accessibility: 1,
  };
  const s = scanSeason(벽지);
  for (const m of s.months) {
    if (m.matched === 0) {
      assert.equal(m.medianSurge, null);
      assert.equal(m.loSurge, null);
      assert.equal(m.hiSurge, null);
      assert.equal(m.level, "비교불가");
      assert.deepEqual(m.twinNames, []);
    }
  }
});

test("어느 달에도 쌍둥이가 없으면 최저·최고 달을 고르지 않는다", () => {
  // 예전에는 12달의 medianSurge 가 전부 null 일 때 null === null 이 참이라
  // **12달이 모두 최저이자 최고**로 뽑혔다. 화면은 그걸 받아
  // "가장 낮았던 달은 1·2·…·12월, 가장 높았던 달은 1·2·…·12월입니다 (폭 배)"
  // 라고 적었다. 잰 것이 없는데 잰 척하는 문장이다.
  const 벽지: PlanInput = {
    sido: "강원", sigungu: "양구군", month: 7,
    themeCode: 7, populationManMyeong: 0.5, accessibility: 1,
  };
  const s = scanSeason(벽지);

  assert.ok(
    s.months.every((m) => m.matched === 0),
    "이 조건은 쌍둥이가 한 곳도 없어야 뜻이 있다",
  );
  assert.equal(s.spread, null, "잴 것이 없는데 폭이 나왔다");
  assert.deepEqual(s.quietest, [], "잰 것이 없는데 최저 달을 골랐다");
  assert.deepEqual(s.busiest, [], "잰 것이 없는데 최고 달을 골랐다");
  assert.equal(s.flat, false, "평평하다고 말할 근거도 없다");
});

test("입력이 틀리면 재지 않고 이유를 그대로 싣는다", () => {
  const s = scanSeason({ ...고령, month: 0, populationManMyeong: -1 });
  assert.ok(s.invalid && s.invalid.length > 0);
  assert.deepEqual(s.months, [], "못 잰 것을 잰 척하지 않는다");
  assert.equal(s.spread, null);
});

test("순수 — 같은 입력에 같은 결과", () => {
  assert.deepEqual(scanSeason(고령), scanSeason(고령));
});
