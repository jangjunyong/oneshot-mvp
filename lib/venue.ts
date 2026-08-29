// 행사장 도면 도메인 — 캔버스(Konva)와 판정 엔진(M2) 이 공유하는 계약.
//
// 좌표는 캔버스 픽셀이고, 실제 세계와의 연결은 축척(mPerPx) 하나뿐이다.
// 축척이 틀리면 통로 폭도 대기 면적도 전부 틀리므로, 축척은 사람이 도면 위
// 두 점을 찍고 실거리를 넣어 정한다 — 여기서도 지어내지 않는다.

/** 화면 팔레트와 도면 아이템이 쓰는 종류. 이름은 화면에 그대로 나간다 */
export const VENUE_KIND_NAME = {
  booth: "부스",
  stage: "무대",
  parking: "주차장",
  toilet: "화장실",
  gate: "출입구",
  path: "통로",
} as const;

export type VenueKind = keyof typeof VENUE_KIND_NAME;

export interface VenueItem {
  id: string;
  kind: VenueKind;
  /** 픽셀 좌표 (회전 중심은 좌상단 — Konva 기본) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 도(deg) */
  rotation: number;
  name: string;
  /** 부스 전용 — 배치 인력 수 */
  staff?: number;
  /** 부스 전용 — 예상 선호도 1(한산)~5(인기) */
  popularity?: number;
  /** 통로 전용 — 꺾은선 [x1,y1,x2,y2,...] */
  points?: number[];
}

export interface Venue {
  /** 캔버스 크기(px) */
  width: number;
  height: number;
  /** 축척 — 1px 가 몇 m 인가. 위성지도가 깔리면 줌에서 자동 계산된다 */
  mPerPx: number | null;
  /** 밑그림(배치도 사진) dataURL. 없어도 된다 */
  underlay?: string;
  /** 위성지도 밑그림 — 캔버스 중앙의 위경도와 줌. 타일은 열 때마다 다시 그린다 */
  map?: { lat: number; lng: number; zoom: number };
  items: VenueItem[];
}

export function emptyVenue(width: number, height: number): Venue {
  return { width, height, mPerPx: null, items: [] };
}

/** 도면 위 두 점과 실제 거리(m)에서 축척을 얻는다. 잴 수 없으면 null */
export function scaleFromPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  meters: number,
): number | null {
  const px = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (px === 0 || !(meters > 0)) return null;
  return meters / px;
}

/** 아이템의 실측 치수(m). 축척이 없으면 픽셀을 미터인 척 하지 않고 null */
export function metersOf(
  item: VenueItem,
  mPerPx: number | null,
): { wM: number; hM: number } | null {
  if (mPerPx === null || !(mPerPx > 0)) return null;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { wM: round(item.w * mPerPx), hM: round(item.h * mPerPx) };
}

/**
 * 저장 전에 도면을 검사한다. 문제는 화면에 그대로 나갈 한국어 문장으로.
 * 축척 없음은 오류가 아니다 — 그리기의 전제가 아니라 판정(M2)의 전제라서,
 * 막지 않고 화면이 따로 알린다.
 */
export function validateVenue(v: Venue): string[] {
  const problems: string[] = [];

  for (const it of v.items) {
    if (!(it.kind in VENUE_KIND_NAME)) {
      problems.push(`"${it.name}" 의 종류를 알 수 없습니다`);
      continue;
    }
    if (it.kind === "booth") {
      if (
        it.popularity !== undefined &&
        (!Number.isFinite(it.popularity) || it.popularity < 1 || it.popularity > 5)
      ) {
        problems.push(`부스 "${it.name}" 의 선호도는 1~5 사이여야 합니다`);
      }
      if (it.staff !== undefined && (!Number.isFinite(it.staff) || it.staff < 0)) {
        problems.push(`부스 "${it.name}" 의 인력 수가 이상합니다`);
      }
    }
    if (it.kind === "path") {
      if (!it.points || it.points.length < 4 || it.points.length % 2 !== 0) {
        problems.push(`통로 "${it.name}" 는 두 점 이상 이어야 합니다`);
      }
    }
  }

  if (v.mPerPx !== null && !(v.mPerPx > 0)) {
    problems.push("축척이 이상합니다 — 두 점을 다시 찍어 주세요");
  }

  return problems;
}
