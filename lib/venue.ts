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
  site: "부지 경계",
} as const;

export type VenueKind = keyof typeof VENUE_KIND_NAME;

/** 사각형으로 놓는 종류 — 통로·부지는 꺾은선이라 여기 없다 */
export type BoxKind = Exclude<VenueKind, "path" | "site">;

/**
 * 종류별 **실제 규격(m)**. 도면의 진실은 미터고, 픽셀은 축척에서 나온다.
 *
 * 이 표가 없을 때는 크기가 픽셀로 고정돼 있었다. 그래서 줌 16(1px≈1.96m)에서
 * 부스를 놓으면 **117m × 78m 짜리 부스**가 생겼다 — 축구장만 한 부스를
 * 놓고도 아무도 몰랐다. 픽셀은 화면 사정이고 부스는 3m 다.
 *
 * 근거:
 *   부스   국제 표준 전시 부스 한 칸(3×3m)
 *   무대   이동식 트러스 무대 12×8m
 *   주차장 2.5×5m 24면 + 차로 6m ≈ 30×20m
 *   화장실 이동식 화장실 4연동 5×2.5m
 *   출입구 차량이 들어갈 수 있는 폭 4m × 게이트 두께 2m
 */
export const KIND_SIZE_M: Record<BoxKind, [number, number]> = {
  booth: [3, 3],
  stage: [12, 8],
  parking: [30, 20],
  toilet: [5, 2.5],
  gate: [4, 2],
};

/** 축척이 없을 때(사진 밑그림 모드) 쓰는 픽셀 크기 — 미터를 모르니 그림 크기다 */
const KIND_SIZE_PX: Record<BoxKind, [number, number]> = {
  booth: [60, 40],
  stage: [130, 80],
  parking: [150, 100],
  toilet: [46, 46],
  gate: [34, 56],
};

/**
 * 이 축척에서 그 종류를 놓을 픽셀 크기.
 *
 * 축척이 있으면 실측(m)을 픽셀로 옮기고, 없으면 그림 크기를 쓴다 —
 * 축척도 없이 "3m" 라고 말하면 그건 지어낸 치수다.
 */
export function sizeInPx(kind: BoxKind, mPerPx: number | null): [number, number] {
  if (mPerPx === null || !(mPerPx > 0)) return KIND_SIZE_PX[kind];
  const [wM, hM] = KIND_SIZE_M[kind];
  return [wM / mPerPx, hM / mPerPx];
}

/**
 * 이미 놓인 것들과 겹치지 않는 첫 자리.
 *
 * 예전에는 `80 + (n%6)*30` 이라 **여섯 개마다 정확히 같은 자리**에 쌓였다.
 * 격자를 훑어 빈 곳을 찾고, 캔버스가 꽉 차면 어쩔 수 없이 좌상단에 둔다
 * (놓지 못하는 것보다 겹치더라도 놓고 사람이 옮기는 편이 낫다).
 */
export function freeSpot(
  items: readonly VenueItem[],
  w: number,
  h: number,
  canvas: { width: number; height: number },
  step = 20,
): { x: number; y: number } {
  const 여백 = 8;
  const 상자 = items.filter((it) => it.kind !== "path" && it.kind !== "site");
  const 겹침 = (x: number, y: number) =>
    상자.some(
      (it) =>
        x < it.x + it.w + 여백 &&
        x + w + 여백 > it.x &&
        y < it.y + it.h + 여백 &&
        y + h + 여백 > it.y,
    );

  for (let y = 40; y + h <= canvas.height - 20; y += step) {
    for (let x = 40; x + w <= canvas.width - 20; x += step) {
      if (!겹침(x, y)) return { x, y };
    }
  }
  return { x: 40, y: 40 };
}

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
  /** 배경 지도 — 캔버스 중앙의 위경도와 줌. 타일은 열 때마다 다시 그린다.
   *  style: plan(도면 느낌, 기본) | satellite(지형 확인용)
   *  view: 뷰 배율(오버줌). 없으면 1 — 옛 도면도 그대로 열린다 */
  map?: {
    lat: number;
    lng: number;
    zoom: number;
    style?: "plan" | "satellite";
    view?: number;
  };
  items: VenueItem[];
}

/**
 * 뷰 배율의 한계.
 *
 * 상한 6 은 타일 오버줌의 한계다 — z18 타일을 6 배로 늘리면 1px 짜리 선이
 * 6px 뭉치가 되어 건물 윤곽이 뭉갠다. 하한 1 은 "축소는 지도 줌의 몫"이라서다:
 * 배율로 줄이면 타일이 덜 그려지는 게 아니라 같은 타일을 축소해 그리는 셈이라
 * 손해만 본다(줌을 내리면 제공자가 더 넓은 그림을 준다).
 */
export const VIEW_RANGE = { min: 1, max: 6 } as const;

/** 이 도면의 뷰 배율. 없거나 이상하면 1 — 0 이면 축척이 무한대가 된다 */
export function viewOf(v: Venue): number {
  const view = v.map?.view;
  return typeof view === "number" && view > 0 ? view : 1;
}

/** 도형 전체를 픽셀만큼 옮긴다 — 지도를 끌면 도형이 땅에 붙어 따라온다 */
export function shiftItems(
  items: readonly VenueItem[],
  dx: number,
  dy: number,
): VenueItem[] {
  return items.map((it) =>
    it.points
      ? { ...it, points: it.points.map((n, i) => n + (i % 2 === 0 ? dx : dy)) }
      : { ...it, x: it.x + dx, y: it.y + dy },
  );
}

/**
 * (cx,cy) 를 붙박아 두고 도형을 배율만큼 키운다 — 줌해도 땅에 붙어 있다.
 *
 * 꺾은선(통로·부지)은 점과 함께 **폭**도 키워야 한다. 폭이 그대로면 통로
 * 실측 폭이 배율만큼 좁아진 것으로 계산돼 대기열 침범 판정이 거짓말을 한다.
 */
export function scaleItems(
  items: readonly VenueItem[],
  f: number,
  cx: number,
  cy: number,
): VenueItem[] {
  return items.map((it) =>
    it.points
      ? {
          ...it,
          w: Math.max(2, it.w * f),
          points: it.points.map((n, i) =>
            i % 2 === 0 ? cx + (n - cx) * f : cy + (n - cy) * f,
          ),
        }
      : {
          ...it,
          x: cx + (it.x - cx) * f,
          y: cy + (it.y - cy) * f,
          w: it.w * f,
          h: it.h * f,
        },
  );
}

/**
 * 부지에 맞춰 보기 — 그 부지가 캔버스를 채우는 **절대 뷰 배율**과, 부지를
 * 캔버스 한가운데로 데려올 이동량(px).
 *
 * 지도 줌으로는 못 푸는 문제를 푼다: 브이월드 백지도가 z18 에서 멈춰
 * 3m 부스가 6px 로 남는다. 200m 부지에 맞추면 배율 1.8 배가 되어 11px 대,
 * 손으로 잡을 수 있는 크기가 된다.
 *
 * 쓰는 쪽은 `scaleItems(items, factor, 캔버스중심)` 한 뒤 `shiftItems(dx, dy)`
 * 하면 된다 — 이 순서를 지켜야 부지 중심이 캔버스 중심에 온다.
 * 넓이가 없는 부지는 맞출 대상이 아니므로 null (지어내지 않는다).
 */
export function fitToSite(
  points: readonly number[],
  canvas: { width: number; height: number },
  view: number,
  /** 부지 둘레에 남길 여백 — 경계에 딱 붙으면 어디까지가 부지인지 안 보인다 */
  padding = 0.88,
): { view: number; factor: number; dx: number; dy: number } | null {
  if (points.length < 6 || points.length % 2 !== 0) return null;
  if (!(view > 0)) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;

  const 필요배 = Math.min((canvas.width * padding) / w, (canvas.height * padding) / h);
  const 새배율 = Math.min(VIEW_RANGE.max, Math.max(VIEW_RANGE.min, view * 필요배));
  const factor = 새배율 / view;

  // 캔버스 중심을 붙박아 키운 뒤(scaleItems) 부지 중심이 가 있을 자리에서
  // 캔버스 중심까지의 거리가 그대로 이동량이다
  const ax = (minX + maxX) / 2;
  const ay = (minY + maxY) / 2;
  return {
    view: 새배율,
    factor,
    dx: (canvas.width / 2 - ax) * factor,
    dy: (canvas.height / 2 - ay) * factor,
  };
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

/** 도면의 부지 경계(있으면 하나) */
export function siteOf(v: Venue): VenueItem | null {
  return v.items.find((it) => it.kind === "site") ?? null;
}

/**
 * 다각형 면적(㎡). 신발끈 공식 × 축척².
 *
 * 부지가 모든 숫자의 기준이 된다 — 면적을 알아야 "이 부지에 부스 몇 개"가
 * 말이 된다. 축척이 없으면 픽셀 면적을 ㎡ 인 척하지 않고 null.
 */
export function polygonAreaM2(
  points: readonly number[],
  mPerPx: number | null,
): number | null {
  if (mPerPx === null || !(mPerPx > 0)) return null;
  if (points.length < 6 || points.length % 2 !== 0) return null;
  let 두배면적 = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    두배면적 += points[i] * points[j + 1] - points[j] * points[i + 1];
  }
  return (Math.abs(두배면적) / 2) * mPerPx * mPerPx;
}

/** 점이 다각형 안인가 — 반직선 교차(ray casting) */
export function pointInPolygon(
  points: readonly number[],
  p: { x: number; y: number },
): boolean {
  let 안 = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    if (
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    ) {
      안 = !안;
    }
  }
  return 안;
}

/**
 * 부지 밖으로 나간 배치의 id.
 *
 * 네 모서리가 모두 부지 안이어야 안에 있는 것으로 본다 — 걸쳐 있으면
 * 나간 것이다. 부지가 없으면 판정하지 않는다(빈 배열): 경계를 안 그린 것과
 * 밖으로 나간 것은 다르다.
 */
export function outsideSite(v: Venue): string[] {
  const site = siteOf(v);
  const poly = site?.points;
  if (!poly || poly.length < 6) return [];

  return v.items
    .filter((it) => it.kind !== "site")
    .filter((it) => {
      const 점들 =
        it.kind === "path"
          ? (it.points ?? []).reduce<{ x: number; y: number }[]>(
              (acc, n, i, arr) =>
                i % 2 === 0 ? [...acc, { x: n, y: arr[i + 1] }] : acc,
              [],
            )
          : [
              { x: it.x, y: it.y },
              { x: it.x + it.w, y: it.y },
              { x: it.x, y: it.y + it.h },
              { x: it.x + it.w, y: it.y + it.h },
            ];
      return 점들.length > 0 && !점들.every((p) => pointInPolygon(poly, p));
    })
    .map((it) => it.id);
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
    if (it.kind === "site") {
      if (!it.points || it.points.length < 6 || it.points.length % 2 !== 0) {
        problems.push("부지 경계는 세 점 이상이어야 합니다");
      }
    }
  }

  // 부지가 둘이면 어느 것이 기준인지 알 수 없다 — 면적도 밖 판정도 갈린다
  if (v.items.filter((it) => it.kind === "site").length > 1) {
    problems.push("부지 경계는 하나만 그릴 수 있습니다");
  }

  if (v.mPerPx !== null && !(v.mPerPx > 0)) {
    problems.push("축척이 이상합니다 — 두 점을 다시 찍어 주세요");
  }

  return problems;
}
