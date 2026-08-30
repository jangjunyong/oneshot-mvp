// 한국관광공사 TourAPI 실시간 연동.
//
// 619건 근거 데이터를 만들 때 쓴 것과 같은 API 다(meta.source). 그때는
// 배치 수집이었고, 여기서는 담당자가 축제 이름으로 검색해 등록 정보를
// 확인 화면 초안으로 가져온다. actualVisitSurge 같은 실측치는 실시간으로
// 구할 수 없으므로 진단 근거는 여전히 정적 619건이다 — 이 파일은 입력을
// 돕는 것이지 근거를 늘리는 것이 아니다.
//
// TourAPI 가 주는 것은 이름·주소·개최일까지다. 테마와 접근성은 등록
// 정보에 없다 — 채우면 지어낸 것이므로 비워서 사람에게 넘긴다.

import type { Extraction } from "@/lib/types";
import type { PeriodFestival } from "@/lib/overlap";
import { FESTIVALS, populationOf } from "@/lib/festivals";

const BASE = "https://apis.data.go.kr/B551011/KorService2";

/** 검색 결과 한 건. 화면 목록과 선택 액션이 쓰는 최소한만 담는다 */
export interface TourFestival {
  contentId: string;
  title: string;
  addr1: string;
}

export function hasTourKey(): boolean {
  return Boolean(process.env.TOUR_API_KEY);
}

/**
 * 법정 시도명 → 619건 데이터의 축약 표기.
 * 2023년 특별자치도 개편 전후 표기를 모두 받는다.
 *
 * **여기가 이 표의 유일한 자리다.** TourAPI 주소 파싱과 기획서 추출(LLM)이
 * 둘 다 이 표를 쓴다. 복제하면 언젠가 갈리고, 갈리면 한쪽 경로에서만
 * `coordsOf` 가 null 이 되어 **지역 축이 조용히 빠진 진단**이 나간다.
 */
const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주도: "제주",
  제주특별자치도: "제주",
};

/**
 * 시도 한 값을 619건 표기로 옮긴다. 이미 축약형이거나 모르는 이름이면
 * **그대로 돌려준다** — 지어내지 않는다. 사람이 확인 화면에서 고친다.
 */
export function shortSido(name: string | null): string | null {
  if (name === null) return null;
  return SIDO_SHORT[name.trim()] ?? name;
}

/**
 * TourAPI 주소(addr1)를 데이터의 시도·시군구 표기로 옮긴다.
 * 못 옮긴 것은 지어내지 않고 null — 확인 화면에서 사람이 채운다.
 */
export function parseRegion(addr1: string): {
  sido: string | null;
  sigungu: string | null;
} {
  const tokens = addr1.trim().split(/\s+/).filter(Boolean);
  const sido = tokens[0] ? (SIDO_SHORT[tokens[0]] ?? null) : null;

  // 세종은 기초자치단체가 없다. 데이터는 sigungu 에 "세종특별자치시"를 쓴다.
  if (sido === "세종") return { sido, sigungu: "세종특별자치시" };

  const second = tokens[1];
  const sigungu = second && /[시군구]$/.test(second) ? second : null;
  if (sido !== null) return { sido, sigungu };

  // 2026년 행정구역 통합으로 "전남광주통합특별시" 같은 새 시도명이 온다.
  // 619건 데이터는 옛 표기다 — 시군구가 데이터에 딱 한 시도로만 있으면
  // 그 시도를 쓴다. 여러 시도에 있으면(중구 등) 찍지 않고 비운다.
  if (sigungu !== null) {
    const sidos = new Set(
      FESTIVALS.filter((f) => f.sigungu === sigungu).map((f) => f.sido),
    );
    if (sidos.size === 1) return { sido: [...sidos][0], sigungu };
  }
  return { sido: null, sigungu };
}

/** 개최 시작일(YYYYMMDD)에서 월. 형식이 어긋나면 null */
export function monthFrom(yyyymmdd: string): number | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const month = Number(yyyymmdd.slice(4, 6));
  return month >= 1 && month <= 12 ? month : null;
}

/**
 * 검색 결과 한 건 → 확인 화면 초안.
 *
 * extract.ts 의 assemble 과 같은 계약이다 — 값을 채운 항목에는 근거를
 * 붙이고, 못 채운 항목은 한국어 이름으로 missing 에 올린다.
 */
export function toExtraction(item: {
  title: string;
  addr1: string;
  eventstartdate: string;
}): Extraction {
  const { sido, sigungu } = parseRegion(item.addr1);
  const month = monthFrom(item.eventstartdate);

  const evidence: Extraction["evidence"] = {};
  if (sido !== null) evidence.sido = `TourAPI 등록 주소: ${item.addr1}`;
  if (sigungu !== null) evidence.sigungu = `TourAPI 등록 주소: ${item.addr1}`;
  if (month !== null)
    evidence.month = `TourAPI 등록 개최 시작일: ${item.eventstartdate}`;

  const missing: string[] = [];
  if (sido === null) missing.push("시도");
  if (sigungu === null) missing.push("시군구");
  if (month === null) missing.push("개최 월");
  // 등록 정보에는 없는 항목 — 항상 사람이 고른다
  missing.push("테마", "접근성");

  const population = sido && sigungu ? populationOf(sido, sigungu) : null;
  if (population === null) missing.push("지역 인구");

  return {
    sido,
    sigungu,
    month,
    themeCode: null,
    accessibility: null,
    populationManMyeong: population,
    evidence,
    missing,
    source: "tourapi",
  };
}

/**
 * 닮은 축제 한 곳의 등록 정보. 우리 619건에는 없는 것들이다 —
 * 배수·좌표는 우리가 재고, 이건 공사가 등록해 둔 사실이다.
 * 못 받은 항목은 null 이고, 화면은 있는 것만 적는다.
 */
export interface FestivalDetail {
  /** YYYYMMDD */
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  sponsor: string | null;
  /** "무료" 같은 이용요금 표기 */
  fee: string | null;
  homepage: string | null;
}

/**
 * homepage 필드는 순수 URL 로 올 때도 있고 `<a href="...">…</a>` 로 올 때도
 * 있다. 앵커째 화면에 뿌리면 태그가 글자로 보인다 — 주소만 꺼낸다.
 * 주소를 못 찾으면 지어내지 않고 null.
 */
export function homepageUrl(raw: string): string | null {
  if (raw.trim() === "") return null;
  const href = raw.match(/href=["']([^"']+)["']/i)?.[1];
  const url = (href ?? raw).trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

// ── 여기부터는 네트워크. 테스트는 여기를 부르지 않는다 ──────────────
//
// serviceKey 는 발급 시점에 이미 URL 인코딩된 문자열이다. URLSearchParams
// 에 넣으면 이중 인코딩되어 인증이 깨진다 — 그대로 이어 붙인다.

function url(path: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${BASE}/${path}?serviceKey=${process.env.TOUR_API_KEY}&MobileOS=ETC&MobileApp=oneshot-mvp&_type=json&${qs}`;
}

async function call(path: string, params: Record<string, string>) {
  const res = await fetch(url(path, params), {
    // 관공서 API 는 가끔 오래 잡는다. 검색 한 번에 화면이 묶이면 안 된다.
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`TourAPI 요청이 거절됐습니다 (${res.status})`);
  }
  const body = (await res.json()) as {
    response?: { body?: { items?: { item?: unknown[] } | "" } };
  };
  const items = body.response?.body?.items;
  // 결과가 없으면 items 가 빈 문자열로 온다. 형식이 다른 건 오류다.
  if (items === "" || items === undefined) return [];
  if (!Array.isArray(items.item)) return [];
  return items.item;
}

/** 축제 이름으로 검색한다. contentTypeId=15 가 축제·공연·행사다 */
export async function searchFestivals(keyword: string): Promise<TourFestival[]> {
  const items = (await call("searchKeyword2", {
    keyword,
    contentTypeId: "15",
    arrange: "A",
    numOfRows: "8",
    pageNo: "1",
  })) as { contentid?: string; title?: string; addr1?: string }[];

  return items
    .filter((it) => it.contentid && it.title)
    .map((it) => ({
      contentId: String(it.contentid),
      title: String(it.title),
      addr1: String(it.addr1 ?? ""),
    }));
}

/**
 * 그 기간에 열리는 축제 전국 목록.
 *
 * 이건 619건이 못 하는 유일한 질문에 답한다 — "올해 그 달에 누가 여는가".
 * 지역 필터(areaCode)는 쓰지 않는다: 2026-08-29 실측에서 areaCode 를 주면
 * 0건이 왔고, 어차피 응답에 좌표가 다 있어 반경으로 거르는 편이 정확하다
 * (2026-10 조회 140건 전부 mapx·mapy 보유).
 *
 * 한 달치가 150건 안쪽이라 한 번에 받는다. 페이지를 넘길 일이 생기면
 * totalCount 를 보고 늘린다.
 */
export async function searchFestivalsInPeriod(
  start: string,
  end: string,
): Promise<PeriodFestival[]> {
  const items = (await call("searchFestival2", {
    eventStartDate: start,
    eventEndDate: end,
    numOfRows: "200",
    pageNo: "1",
    arrange: "A",
  })) as {
    contentid?: string;
    title?: string;
    addr1?: string;
    eventstartdate?: string;
    eventenddate?: string;
    mapx?: string;
    mapy?: string;
  }[];

  return items
    .map((it) => ({
      contentId: String(it.contentid ?? ""),
      title: String(it.title ?? ""),
      addr1: String(it.addr1 ?? ""),
      startDate: String(it.eventstartdate ?? ""),
      endDate: String(it.eventenddate ?? ""),
      // mapx 가 경도, mapy 가 위도다 (TourAPI 표기)
      lng: Number(it.mapx),
      lat: Number(it.mapy),
    }))
    // 좌표가 없으면 거리를 잴 수 없다. 지도의 그 4건처럼 지어내지 않는다
    .filter(
      (f) =>
        f.contentId !== "" &&
        f.title !== "" &&
        Number.isFinite(f.lat) &&
        Number.isFinite(f.lng) &&
        f.lat !== 0 &&
        f.lng !== 0,
    );
}

/**
 * 닮은 축제 한 곳의 등록 정보.
 *
 * 우리 619건은 배수·좌표·분류까지다. "그래서 그 축제가 뭐였는데"는 답하지
 * 못한다 — 담당자가 벤치마킹하려면 언제 어디서 누가 열었는지를 봐야 한다.
 * 그건 공사 등록 정보에만 있다.
 *
 * 두 엔드포인트를 병렬로 부르고 **한쪽이 죽어도 나머지는 쓴다**. 둘 다
 * 죽으면 null 이고, 화면은 정적 값(이름·연도·배수)만으로 그대로 선다.
 */
export async function festivalDetail(
  contentId: string,
): Promise<FestivalDetail | null> {
  const [intro, common] = await Promise.allSettled([
    call("detailIntro2", { contentId, contentTypeId: "15" }) as Promise<
      {
        eventstartdate?: string;
        eventenddate?: string;
        eventplace?: string;
        sponsor1?: string;
        usetimefestival?: string;
      }[]
    >,
    call("detailCommon2", { contentId }) as Promise<{ homepage?: string }[]>,
  ]);

  const i = intro.status === "fulfilled" ? intro.value[0] : undefined;
  const c = common.status === "fulfilled" ? common.value[0] : undefined;
  if (i === undefined && c === undefined) return null;

  // 빈 문자열은 "없음"이다. 화면에 빈 칸을 만들지 않는다
  const 값 = (v: string | undefined) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  return {
    startDate: 값(i?.eventstartdate),
    endDate: 값(i?.eventenddate),
    place: 값(i?.eventplace),
    sponsor: 값(i?.sponsor1),
    fee: 값(i?.usetimefestival),
    homepage: c?.homepage ? homepageUrl(String(c.homepage)) : null,
  };
}

/** 선택한 축제의 개최 시작일(YYYYMMDD). 없으면 빈 문자열 */
export async function festivalStartDate(contentId: string): Promise<string> {
  const items = (await call("detailIntro2", {
    contentId,
    contentTypeId: "15",
  })) as { eventstartdate?: string }[];
  return String(items[0]?.eventstartdate ?? "");
}
