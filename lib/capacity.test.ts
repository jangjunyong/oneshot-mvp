// 감당 범위 테스트.
//
// 여기서 지키는 것은 **숫자를 안 만드는 것**이다. evals/cases.md 09행이
// "화면의 숫자가 전부 입력값·지역 인구·실측 배수·연도 중 하나인가"를 묻고,
// 이 모듈이 그 경계를 넘기 제일 쉬운 자리다 — 물량 개수를 내고 싶어지기
// 때문이다. 개수를 내는 순간 "올해 방문자 = 작년의 N배"라는 예측과 산술적으로
// 같아진다. 그래서 이 파일의 테스트 절반은 "안 낸다"를 지킨다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { capacityBand, localBaseline, RATIO_FLOOR } from "@/lib/capacity";
import type { AlertGrade } from "@/lib/grade";
import type { MatchedFestival } from "@/lib/types";

const 등급 = (level: AlertGrade["level"], mid: number | null): AlertGrade => ({
  level,
  headline: "",
  medianSurge: mid,
});

test("작년 실측이 있으면 그 대비 몇 배 구간인지 낸다", () => {
  // 고령 대가야축제: 작년 2.27배 · 쌍둥이 1.76~3.28배
  const b = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], 2.27)!;

  assert.equal(b.baseSurge, 2.27);
  assert.ok(Math.abs(b.hi! - 3.28 / 2.27) < 1e-9, `hi ${b.hi}`);
  assert.ok(b.hi! > 1.44 && b.hi! < 1.46, "상단은 작년의 1.45배");

  // 원래 하한은 1.76/2.27 = 0.78 이지만 바닥에 걸려 1 이 된다.
  // "작년보다 줄이세요"는 우리가 할 수 있는 말이 아니다.
  assert.equal(b.lo, RATIO_FLOOR, `lo ${b.lo}`);
  assert.equal(b.floored, true);

  // 잘린 원값은 twinLo/baseSurge 로 되짚을 수 있어야 한다 — 감사 가능하게
  assert.equal(b.twinLo, 1.76);
  assert.ok(Math.abs(b.twinLo / b.baseSurge! - 0.775) < 0.001);
});

test("작년 실측이 없으면 쌍둥이 배수 범위만 낸다 — 첫 회 축제에서도 뜬다", () => {
  // 김천김밥축제 1회처럼 작년이 없는 경우. 지어내지 않고 baseSurge 를 비운다
  const b = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], null)!;
  assert.equal(b.baseSurge, null);
  assert.equal(b.lo, null, "기준이 없으면 비율도 없다");
  assert.equal(b.hi, null);
  assert.equal(b.twinLo, 1.76, "쌍둥이 범위는 그대로 남는다");
  assert.equal(b.twinHi, 3.28);
});

test("근거를 못 찾았으면 아무것도 내지 않는다", () => {
  // 619건의 76%가 배수 1.5 미만이다. "위험 근거를 찾지 못했습니다"라고
  // 말한 화면이 같은 페이지에서 증액을 지시하면 불문율 2번 위반이다.
  assert.equal(capacityBand(등급("근거없음", 1.2), [1.1, 1.2, 1.3], 1.15), null);
  assert.equal(capacityBand(등급("비교불가", null), [], 2.0), null);
});

test("주의 등급에서는 낸다 — 심각만 다루면 대비할 시점을 놓친다", () => {
  assert.ok(capacityBand(등급("주의", 1.7), [1.5, 1.7, 1.9], 1.6) !== null);
});

test("비율에 바닥을 둔다 — 안전 물량 감축을 권고하지 않는다", () => {
  // 쌍둥이가 작년보다 낮았던 경우(619건 중 49%). 0.5배로 줄이라는 말은
  // 우리가 할 수 있는 말이 아니다 — 재난은 평균으로 오지 않는다.
  const b = capacityBand(등급("심각", 2.0), [1.0, 2.0, 2.4], 3.0)!;
  assert.equal(b.lo, RATIO_FLOOR, `하한이 ${b.lo} 다 — 감축 권고가 나간다`);
  assert.ok(b.hi! >= RATIO_FLOOR);
  assert.equal(b.floored, true, "바닥에 걸렸다는 사실이 화면에 나가야 한다");
});

test("점추정을 내지 않는다 — 화면은 언제나 구간이다", () => {
  const b = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], 2.27)!;
  // grade.ts 가 lo~hi 로 말하는데 여기만 한 점이면 제품 안에서 말이 갈린다
  assert.ok(b.lo !== b.hi, "구간이 아니라 한 점이다");
  assert.ok(!("point" in b), "점추정 필드가 있으면 화면이 그걸 쓴다");
});

test("물량 개수를 만들지 않는다 — eval 09 의 경계", () => {
  const b = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], 2.27)!;
  // 반환값의 모든 수는 배수이거나 배수의 비율이어야 한다.
  // 개수(정수 물량)가 섞이면 그 순간 다섯 번째 범주의 숫자가 된다.
  for (const [k, v] of Object.entries(b)) {
    if (typeof v !== "number") continue;
    assert.ok(v < 100, `${k}=${v} — 배수가 아니라 개수처럼 보인다`);
  }
});

test("비교 기준은 같은 시군구·같은 달의 쌍둥이다 — 이름을 밝힌다", () => {
  const 쌍둥이 = (
    name: string,
    sido: string,
    sigungu: string,
    start: string,
    surge: number,
  ): MatchedFestival => ({
    festival: {
      id: name, name, sido, sigungu,
      eventStartDate: start, eventEndDate: start,
      themeCode: 3, accessibility: 2, populationManMyeong: 3,
      actualVisitSurge: surge, lat: 35, lng: 128,
    },
    distance: 0.1,
    axes: [],
    year: start.slice(0, 4),
  });

  const 목록 = [
    쌍둥이("고령 대가야축제", "경북", "고령군", "20260327", 2.27),
    쌍둥이("불로초 원정대", "경남", "산청군", "20260501", 3.28),
  ];
  const 기준 = localBaseline({ sido: "경북", sigungu: "고령군", month: 3 }, 목록)!;
  assert.equal(기준.name, "고령 대가야축제", "이름을 안 밝히면 담당자가 못 믿는다");
  assert.equal(기준.surge, 2.27);
  assert.equal(기준.year, "2026");

  // 기준은 닮은 축제 밖에서 오지 않는다. 화면이 "닮은 축제 ①이기도 합니다"
  // 라고 짚으려면 넷 중 어느 것인지 id 로 알아야 한다 — 이름으로 맞추면
  // 같은 이름의 다른 축제에 붙는다
  assert.equal(기준.id, "고령 대가야축제");
  assert.ok(
    목록.some((m) => m.festival.id === 기준.id),
    "기준이 닮은 축제 목록 밖에서 왔다",
  );

  // 달이 다르면 같은 자리가 아니다 — 3월 기획안에 10월 축제를 기준 삼지 않는다
  assert.equal(localBaseline({ sido: "경북", sigungu: "고령군", month: 10 }, 목록), null);
  // 지역이 다르면 당연히 아니다
  assert.equal(localBaseline({ sido: "경남", sigungu: "산청군", month: 3 }, 목록), null);
});

test("순수 — 같은 입력에 같은 결과", () => {
  const a = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], 2.27);
  const b = capacityBand(등급("심각", 2.58), [1.76, 2.58, 3.28], 2.27);
  assert.deepEqual(a, b);
});
