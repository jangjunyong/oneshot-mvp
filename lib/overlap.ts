// 같은 시기 경쟁 — 내 기획안과 같은 달, 가까운 곳에서 열리는 축제.
//
// 619건은 "과거에 어떻게 됐나"만 답한다. 담당자가 실제로 정하는 것은
// **언제 열 것인가**인데, "올해 그 달에 누가 여는가"는 정적 데이터로
// 절대 알 수 없다. 한국관광공사 OpenAPI 만 답을 가지고 있다.
//
// 여기서는 그 응답을 거리로 거르고, 우리 실측(619건)과 id 로 이어 붙인다.
// **TourAPI contentid = 619건의 id** (2026-08-29 확인: 2026-10 축제 140건 중
// 26건이 우리 데이터에 있었다). 그래서 겹치는 축제 중 일부는 "평소 2.38배를
// 부르는 축제"라고 근거까지 붙일 수 있고, 나머지는 이름과 기간만 말한다 —
// 실측이 없는 것에 숫자를 지어 붙이지 않는다.

import { FESTIVALS } from "@/lib/festivals";
import { haversineKm } from "@/lib/match";

/**
 * 이 거리 안에서 같은 달에 열리면 수요가 갈린다고 본다.
 *
 * 근거가 있는 값이 아니라 정한 값이다. 그래서 화면에 "반경 50km"를 그대로
 * 적는다 — 담당자가 기준을 알고 판단하게 한다.
 */
export const NEARBY_RADIUS_KM = 50;

/** TourAPI 가 주는 축제 한 건 중 이 판정에 필요한 것만 */
export interface PeriodFestival {
  contentId: string;
  title: string;
  addr1: string;
  /** YYYYMMDD */
  startDate: string;
  endDate: string;
  lat: number;
  lng: number;
}

export interface Competitor extends PeriodFestival {
  /** 이 기획안의 지역에서 몇 km */
  distanceKm: number;
  /** 619건에 실측이 있으면 평소 대비 방문 배수. 없으면 null */
  surge: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 그 달의 조회 창(YYYYMMDD) — **가장 최근에 지난(또는 진행 중인) 그 달**.
 *
 * 처음엔 "다음에 오는 그 달"을 봤다. 틀렸다. TourAPI 에 미래 축제는 거의
 * 등록돼 있지 않아서(2027-05 조회 0건) 어느 기획안에나 "없습니다"만 나왔다.
 *
 * 축제는 대체로 매년 같은 시기에 반복된다. 그래서 "내가 열 5월에 누가
 * 여는가"의 가장 정직한 근사는 **지난 5월에 누가 열었는가**다. 이건 예측이
 * 아니라 조회다 — 화면도 연도를 밝혀 "2026년 5월에는" 이라고 적는다.
 */
export function monthWindow(
  month: number,
  today: Date,
): { start: string; end: string; year: number } {
  // 이번 달까지는 올해가 이미 왔다. 아직 안 온 달은 작년이 최근이다
  const year =
    month <= today.getMonth() + 1 ? today.getFullYear() : today.getFullYear() - 1;
  // Date 의 0일은 전달 말일이다 — 달마다 다른 말일을 직접 세지 않는다
  const last = new Date(year, month, 0).getDate();
  return {
    start: `${year}${pad(month)}01`,
    end: `${year}${pad(month)}${pad(last)}`,
    year,
  };
}

/** YYYYMMDD → "10월 3일" (화면용). 형식이 어긋나면 원문 그대로 */
export function dayLabel(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${Number(yyyymmdd.slice(4, 6))}월 ${Number(yyyymmdd.slice(6, 8))}일`;
}

/**
 * 반경 안에서 같은 달에 열리는 축제를 가까운 순으로.
 *
 * 지역 좌표를 모르면(coordsOf 가 null) 거리를 잴 수 없다. 그때는 "없음"이
 * 아니라 빈 배열이고, 화면이 "잴 수 없다"고 말해야 한다 — 없는 것과
 * 못 잰 것은 다르다.
 */
export function competitorsNear(
  origin: { lat: number; lng: number } | null,
  candidates: readonly PeriodFestival[],
  radiusKm: number = NEARBY_RADIUS_KM,
): Competitor[] {
  if (origin === null) return [];

  const surgeById = new Map(
    FESTIVALS.map((f) => [f.id, f.actualVisitSurge] as const),
  );

  return candidates
    .map((c) => ({
      ...c,
      distanceKm: haversineKm(origin.lat, origin.lng, c.lat, c.lng),
      surge: surgeById.get(c.contentId) ?? null,
    }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * 화면 맨 앞에 낼 한 문장.
 *
 * 등급을 매기지 않는다. 몇 곳이 겹치는지와, 그중 실측이 있는 것이 몇 배를
 * 불렀는지까지가 우리가 아는 전부다. "그래서 위험하다"는 담당자가 정한다.
 */
export function competitionHeadline(
  year: number,
  month: number,
  list: readonly Competitor[],
  radiusKm: number = NEARBY_RADIUS_KM,
): string {
  const 때 = `${year}년 ${month}월`;
  if (list.length === 0) {
    return `${때}에는 반경 ${radiusKm}km 안에서 열린 축제가 없습니다`;
  }
  const 실측 = list.filter((c) => c.surge !== null);
  if (실측.length === 0) {
    return `${때}에는 반경 ${radiusKm}km 안에서 축제 ${list.length}곳이 함께 열렸습니다`;
  }
  const 최대 = Math.max(...실측.map((c) => c.surge as number));
  return `${때}에는 반경 ${radiusKm}km 안에서 축제 ${list.length}곳이 함께 열렸고, 그중 하나는 평소의 ${최대.toFixed(2)}배를 불렀습니다`;
}
