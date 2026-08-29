// 위성지도 밑그림 — 웹 메르카토르 타일 수학.
//
// 행사장 배치는 실제 지형 위에서 해야 한다. 강·다리·도로가 안 보이는 빈
// 캔버스는 도면이 아니다 (2026-08-29 사용자 검토 피드백). 위성 타일을
// 캔버스 뒤에 깔고, 축척은 사람이 재는 대신 줌 레벨에서 계산한다 —
// 사진 밑그림일 때만 수동 축척이 남는다.
//
// 타일은 Esri World Imagery(키 불필요·CORS 허용)로 시작한다. 국내 화질이
// 더 필요하면 브이월드(WMTS·키 필요)로 갈아끼울 수 있게 주소 조립을 한
// 함수에 모아 둔다.

export const TILE_SIZE = 256;

/** 편집에 쓸 만한 줌 범위 — 15(동네)~19(부스 단위) */
export const MIN_ZOOM = 15;
export const MAX_ZOOM = 19;

export const TILE_ATTRIBUTION = "위성사진: Esri World Imagery";

/** 웹 메르카토르 해상도(m/px). 이 값이 도면의 자동 축척이 된다 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** 위경도 → 해당 줌의 세계 픽셀 좌표 (좌상단 원점) */
export function latLngToWorldPx(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const world = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * world;
  const rad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world;
  return { x, y };
}

export interface Tile {
  /** 타일 인덱스 */
  tx: number;
  ty: number;
  zoom: number;
  /** 캔버스 위 배치 위치(px) */
  px: number;
  py: number;
  url: string;
}

/** Esri 는 z/y/x 순서다 */
export function tileUrl(tx: number, ty: number, zoom: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
}

/**
 * 중심 위경도를 캔버스 정중앙에 두었을 때, 캔버스를 덮는 타일 목록.
 * 완전히 밖에 있는 타일은 내려받지 않는다.
 */
export function visibleTiles(
  lat: number,
  lng: number,
  zoom: number,
  width: number,
  height: number,
): Tile[] {
  const center = latLngToWorldPx(lat, lng, zoom);
  const originX = center.x - width / 2; // 캔버스 (0,0) 의 세계 픽셀
  const originY = center.y - height / 2;

  const first = { tx: Math.floor(originX / TILE_SIZE), ty: Math.floor(originY / TILE_SIZE) };
  const last = {
    tx: Math.floor((originX + width) / TILE_SIZE),
    ty: Math.floor((originY + height) / TILE_SIZE),
  };

  const max = 2 ** zoom - 1;
  const tiles: Tile[] = [];
  for (let tx = first.tx; tx <= last.tx; tx++) {
    for (let ty = first.ty; ty <= last.ty; ty++) {
      if (tx < 0 || ty < 0 || tx > max || ty > max) continue;
      tiles.push({
        tx,
        ty,
        zoom,
        px: tx * TILE_SIZE - originX,
        py: ty * TILE_SIZE - originY,
        url: tileUrl(tx, ty, zoom),
      });
    }
  }
  return tiles;
}

/** 지도 화면을 드래그로 옮길 때 — 픽셀 이동량만큼 중심 위경도를 되돌린다 */
export function panCenter(
  lat: number,
  lng: number,
  zoom: number,
  dxPx: number,
  dyPx: number,
): { lat: number; lng: number } {
  const world = TILE_SIZE * 2 ** zoom;
  const p = latLngToWorldPx(lat, lng, zoom);
  const x = Math.min(world, Math.max(0, p.x - dxPx));
  const y = Math.min(world, Math.max(0, p.y - dyPx));
  const newLng = (x / world) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / world;
  const newLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat: newLat, lng: newLng };
}
