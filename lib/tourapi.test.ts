// TourAPI 연동 테스트.
//
// 여기서 지키는 것은 관광공사 서버가 아니라 **변환의 정직함**이다 —
// 주소를 619건 데이터의 시도 표기로 옮기고, 못 옮긴 것은 지어내지 않고
// 비워서 사람에게 넘긴다는 계약. 이 파일은 네트워크를 부르지 않는다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { hasTourKey, monthFrom, parseRegion, toExtraction } from "@/lib/tourapi";
import { populationOf } from "@/lib/festivals";

// 키가 꽂힌 채로 테스트를 돌리면 진짜로 호출될 길이 열린다. 그건 사고다.
assert.equal(hasTourKey(), false, "테스트는 TOUR_API_KEY 없이 돌려야 한다");

test("도로명 주소의 긴 시도명을 데이터의 축약 표기로 옮긴다", () => {
  assert.deepEqual(parseRegion("경상북도 김천시 신음동 산1-1"), {
    sido: "경북",
    sigungu: "김천시",
  });
  assert.deepEqual(parseRegion("서울특별시 송파구 올림픽로 240"), {
    sido: "서울",
    sigungu: "송파구",
  });
  // 특별자치도 개편 이후 표기도 받는다
  assert.deepEqual(parseRegion("강원특별자치도 춘천시 중앙로 1"), {
    sido: "강원",
    sigungu: "춘천시",
  });
  assert.deepEqual(parseRegion("전북특별자치도 김제시 부량면"), {
    sido: "전북",
    sigungu: "김제시",
  });
});

test("세종은 시군구가 없다 — 데이터가 쓰는 이름 그대로 채운다", () => {
  // 619건 데이터에서 세종의 sigungu 는 "세종특별자치시"다. 다른 이름을
  // 만들면 populationOf 도 findSimilar 의 지역 축도 전부 빗나간다.
  assert.deepEqual(parseRegion("세종특별자치시 조치원읍 문화로 1"), {
    sido: "세종",
    sigungu: "세종특별자치시",
  });
});

test("모르는 시도명이라도 시군구가 데이터에 유일하면 시도를 찾아낸다", () => {
  // 2026년 행정구역 통합으로 TourAPI 주소에 "전남광주통합특별시" 같은
  // 새 이름이 온다(라이브 응답에서 실측). 619건 데이터는 옛 표기이므로,
  // 시군구가 데이터에 딱 한 시도로만 있으면 그 시도를 쓴다.
  assert.deepEqual(parseRegion("전남광주통합특별시 담양군 죽녹원로 119"), {
    sido: "전남",
    sigungu: "담양군",
  });
});

test("시군구가 여러 시도에 있으면 시도를 지어내지 않는다", () => {
  // 중구는 서울·부산·대구·인천·대전·울산에 다 있다. 찍으면 틀린다.
  assert.deepEqual(parseRegion("모르는통합시 중구 어딘가길 1"), {
    sido: null,
    sigungu: "중구",
  });
});

test("모르는 주소는 지어내지 않고 null 을 돌려준다", () => {
  assert.deepEqual(parseRegion(""), { sido: null, sigungu: null });
  assert.deepEqual(parseRegion("어딘가 이상한 주소"), {
    sido: null,
    sigungu: null,
  });
  // 시도만 있고 시군구 토큰이 없는 경우
  assert.deepEqual(parseRegion("경상북도"), { sido: "경북", sigungu: null });
});

test("개최 시작일(YYYYMMDD)에서 월을 읽고, 못 읽으면 null", () => {
  assert.equal(monthFrom("20241012"), 10);
  assert.equal(monthFrom("20260301"), 3);
  assert.equal(monthFrom(""), null);
  assert.equal(monthFrom("다음달"), null);
  assert.equal(monthFrom("20240015"), null); // 0월은 월이 아니다
});

test("검색 결과 한 건이 확인 화면 초안으로 옮겨진다 — 출처는 tourapi", () => {
  const 초안 = toExtraction({
    title: "김천김밥축제",
    addr1: "경상북도 김천시 남산공원길 진입로",
    eventstartdate: "20251024",
  });

  assert.equal(초안.source, "tourapi");
  assert.equal(초안.sido, "경북");
  assert.equal(초안.sigungu, "김천시");
  assert.equal(초안.month, 10);

  // 인구는 지어내지 않는다 — 619건 데이터 조회값과 같아야 한다
  assert.equal(초안.populationManMyeong, populationOf("경북", "김천시"));

  // 값을 채운 항목에는 근거가 붙고, 근거는 TourAPI 에서 왔다고 말한다
  for (const key of ["sido", "sigungu", "month"] as const) {
    assert.match(초안.evidence[key] ?? "", /TourAPI/);
  }
});

test("TourAPI 가 모르는 것(테마·접근성)은 비워서 사람에게 넘긴다", () => {
  const 초안 = toExtraction({
    title: "김천김밥축제",
    addr1: "경상북도 김천시 남산공원길",
    eventstartdate: "20251024",
  });

  // 등록 정보에는 테마 분류도 교통 접근성도 없다. 채우면 지어낸 것이다.
  assert.equal(초안.themeCode, null);
  assert.equal(초안.accessibility, null);
  assert.ok(초안.missing.includes("테마"));
  assert.ok(초안.missing.includes("접근성"));

  // missing 은 화면에 그대로 나간다 — 코드명이 아니라 한국어여야 한다
  for (const name of 초안.missing) {
    assert.ok(!/[a-zA-Z]/.test(name), `missing 에 코드명이 샜다: ${name}`);
  }
});

test("주소를 못 읽으면 지역도 인구도 비고, 무엇이 없는지 말한다", () => {
  const 초안 = toExtraction({
    title: "이름만 있는 축제",
    addr1: "",
    eventstartdate: "",
  });

  assert.equal(초안.sido, null);
  assert.equal(초안.populationManMyeong, null);
  assert.ok(초안.missing.includes("시도"));
  assert.ok(초안.missing.includes("지역 인구"));
  // 못 찾은 항목에 근거가 붙어 있으면 그게 지어낸 것이다
  assert.equal(초안.evidence.sido, undefined);
});
