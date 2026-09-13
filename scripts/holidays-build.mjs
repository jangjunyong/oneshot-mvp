// 공휴일 달력 — data/calendar/holidays.json (2026-09-14, 축제 신호의 명절·공휴일 보정용).
//
// 출처: hyunbinseo/holidays-kr — 우주항공청(구 한국천문연구원) 월력요항을 옮긴 연도별 JSON. 커밋을 고정해 받는다(재현성).
// 교차 확인(2026-09-14): 2018~2027 설날·추석 날짜를 Nager.Date(date.nager.at) 와 대조 — Nager 에만 있는 날 0건,
//   이쪽에만 있는 7건은 전부 일요일에 걸린 설·추석 당일/전날(Nager 는 대체공휴일 방식으로 일요일을 빼고 적는다).
// 공공데이터포털 특일정보 API(SpcdeInfoService)는 이 서비스 키로 403(활용신청 안 됨)이라 쓰지 않았다.
// 실행: node scripts/holidays-build.mjs

import { mkdirSync, writeFileSync } from "node:fs";

const COMMIT = "aab9d62e8c24d4da7b1ec06d9f80f459cb440f0f";
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

const dates = {};
for (const y of YEARS) {
  const url = `https://raw.githubusercontent.com/hyunbinseo/holidays-kr/${COMMIT}/public/${y}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${y}: HTTP ${res.status}`);
  const j = await res.json();
  for (const [day, names] of Object.entries(j)) dates[day.replace(/-/g, "")] = names;
}

const out = {
  source: "우주항공청 월력요항 (hyunbinseo/holidays-kr 연도별 JSON)",
  sourceUrl: `https://github.com/hyunbinseo/holidays-kr/tree/${COMMIT}/public`,
  sourceCommit: COMMIT,
  crossCheck: "2018~2027 설날·추석을 Nager.Date 와 대조, 불일치는 일요일 표기 방식 차이뿐 (2026-09-14)",
  builtAt: new Date().toISOString().slice(0, 10),
  years: YEARS,
  dates: Object.fromEntries(Object.entries(dates).sort(([a], [b]) => (a < b ? -1 : 1))),
};
mkdirSync("data/calendar", { recursive: true });
writeFileSync("data/calendar/holidays.json", JSON.stringify(out, null, 1) + "\n");
console.log("wrote data/calendar/holidays.json", Object.keys(dates).length, "days", YEARS[0], "~", YEARS[YEARS.length - 1]);
