// 619건 데이터 자체를 검사한다.
//
// 이 파일이 없어서 생긴 일이 있다 — 4건에 좌표가 비었거나 (19.69, 117.99)
// 기본값이 박혀 있었는데 **아무도 세지 않았다.** 지도는 그걸 걸러 그리고
// 있었지만 진단은 그대로 재서 "직선거리 13317km" 를 화면에 냈다.
//
// `data/festivals.json` 은 손으로 모은 194KB 이고 제품 전체가 여기에 기댄다.
// 다시 만들다가 필드가 빠지거나 건수가 줄어도, 지금은 에러가 아니라
// **이상한 진단**으로 나타난다. 그래서 데이터를 코드처럼 검사한다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { FESTIVALS, META, monthOf } from "@/lib/festivals";
import { hasPlace } from "@/lib/mapproj";

/** 지금 알고 있는 불량 좌표 건수. 늘면 실패한다 */
const 좌표불량_알려진수 = 4;

test("건수는 619 이고 meta 가 같은 수를 말한다", () => {
  assert.equal(FESTIVALS.length, 619);
  assert.equal(
    META.count,
    FESTIVALS.length,
    "meta.count 와 실제 건수가 어긋난다 — 데이터를 다시 만들다 잘렸다",
  );
  assert.ok(META.source && META.collectedAt, "출처·수집일이 비었다");
});

test("id 는 유일하다 — 겹치면 쌍둥이가 자기 자신을 집는다", () => {
  const ids = new Set(FESTIVALS.map((f) => f.id));
  assert.equal(ids.size, FESTIVALS.length);
});

test("판정에 쓰는 필드는 하나도 비어 있지 않다", () => {
  const 필수 = [
    "id",
    "name",
    "sido",
    "sigungu",
    "eventStartDate",
    "eventEndDate",
    "themeCode",
    "accessibility",
    "populationManMyeong",
    "actualVisitSurge",
  ] as const;

  for (const f of FESTIVALS) {
    for (const k of 필수) {
      assert.ok(
        f[k] !== undefined && f[k] !== null && f[k] !== "",
        `${f.id} ${f.name} 의 ${k} 가 비었다`,
      );
    }
  }
});

test("축의 값은 화면이 이름을 아는 범위 안에 있다", () => {
  for (const f of FESTIVALS) {
    assert.ok(
      Number.isInteger(f.themeCode) && f.themeCode >= 1 && f.themeCode <= 8,
      `${f.id} 테마 코드 ${f.themeCode} 는 THEME_NAME 밖이다`,
    );
    assert.ok(
      Number.isInteger(f.accessibility) && f.accessibility >= 1 && f.accessibility <= 5,
      `${f.id} 접근성 ${f.accessibility} 는 ACCESSIBILITY_LABEL 밖이다`,
    );
    assert.ok(
      Number.isFinite(f.populationManMyeong) && f.populationManMyeong > 0,
      `${f.id} 인구 ${f.populationManMyeong}`,
    );
  }
});

test("배수는 유한한 양수다 — 등급이 여기서만 나온다", () => {
  for (const f of FESTIVALS) {
    assert.ok(
      Number.isFinite(f.actualVisitSurge) && f.actualVisitSurge > 0,
      `${f.id} ${f.name} 의 배수가 ${f.actualVisitSurge}`,
    );
  }
});

test("개최일은 8자리이고 끝이 시작보다 앞서지 않는다", () => {
  for (const f of FESTIVALS) {
    assert.match(String(f.eventStartDate), /^\d{8}$/, `${f.id} 시작일`);
    assert.match(String(f.eventEndDate), /^\d{8}$/, `${f.id} 종료일`);
    assert.ok(
      String(f.eventEndDate) >= String(f.eventStartDate),
      `${f.id} ${f.name} 의 종료일이 시작일보다 앞선다`,
    );
    const m = monthOf(f);
    assert.ok(m >= 1 && m <= 12, `${f.id} 개최월 ${m}`);
  }
});

test("좌표 불량은 알려진 4건뿐이다 — 늘어나면 재는 쪽이 먼저 안다", () => {
  const 불량 = FESTIVALS.filter((f) => !hasPlace(f.lat, f.lng));

  assert.ok(
    불량.length <= 좌표불량_알려진수,
    `좌표 불량이 ${불량.length}건으로 늘었다 (알려진 ${좌표불량_알려진수}건):\n` +
      불량.map((f) => `  ${f.id} ${f.sido} ${f.sigungu} (${f.lat}, ${f.lng})`).join("\n"),
  );

  // 줄었으면 그것도 알아야 한다 — 위 상수를 내리고 근거를 적을 자리다
  if (불량.length < 좌표불량_알려진수) {
    assert.fail(
      `좌표 불량이 ${불량.length}건으로 줄었다. 좋은 일이지만 ` +
        `festivals.test.ts 의 좌표불량_알려진수 를 ${불량.length} 로 내리고 왜 줄었는지 적을 것`,
    );
  }
});
