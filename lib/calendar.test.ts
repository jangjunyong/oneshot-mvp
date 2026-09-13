// 공휴일 달력 — 우주항공청 월력요항(data/calendar/holidays.json)과 연휴 덩어리 규칙 (2026-09-14)
import { test } from "node:test";
import assert from "node:assert/strict";

import { holidayBlock, holidayNames, HOLIDAY_YEARS, lunarHolidayNames, SIGNAL_CALENDAR } from "@/lib/calendar";

test("자료는 2018~2027 을 덮고, 2025 추석은 10-05 전날·10-06 추석·10-07 다음 날·10-08 대체공휴일", () => {
  assert.deepEqual([HOLIDAY_YEARS[0], HOLIDAY_YEARS[HOLIDAY_YEARS.length - 1]], [2018, 2027]);
  assert.deepEqual(holidayNames("20251006"), ["추석"]);
  assert.deepEqual(holidayNames("20251008"), ["대체공휴일(추석)"]);
  assert.deepEqual(holidayNames("20251010"), []);
  assert.deepEqual(lunarHolidayNames("20251003"), [], "개천절은 설·추석이 아니다");
});

test("설·추석 연휴 덩어리 — 잇닿은 토요일은 넣고, 설·추석이 아닌 개천절·한글날에서는 멈춘다", () => {
  const lunar = holidayBlock("lunar");
  for (const d of ["20251004", "20251005", "20251006", "20251007", "20251008"]) assert.ok(lunar.has(d), d);
  for (const d of ["20251003", "20251009", "20251011"]) assert.ok(!lunar.has(d), d);
  // 공휴일 전체면 개천절(금)·한글날(목)까지 한 덩어리
  const all = holidayBlock("all");
  for (const d of ["20251003", "20251004", "20251009"]) assert.ok(all.has(d), d);
  assert.ok(!all.has("20251010"), "한글날 다음 평일 금요일은 연휴가 아니다");
  // 화면 설정은 설·추석 덩어리
  assert.equal(SIGNAL_CALENDAR.exclude.size, lunar.size);
});

test("2020 설날(1-24 금 ~ 1-27 월 대체) 덩어리는 주말 1-25·1-26 을 포함한다", () => {
  const lunar = holidayBlock("lunar");
  for (const d of ["20200124", "20200125", "20200126", "20200127"]) assert.ok(lunar.has(d), d);
  assert.ok(!lunar.has("20200123") && !lunar.has("20200128"));
});
