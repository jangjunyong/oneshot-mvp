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

/**
 * 줌 범위는 **타일 제공자가 정한다**. 없는 줌을 열어 주면 화면이 빈 캔버스가
 * 되고, 담당자는 자기가 뭘 잘못 눌렀는지 모른다.
 *
 * 2026-08-29 실측(서울시청 타일 요청):
 *   브이월드 백지도  z6~18   (z5 이하·z19 이상은 XML 오류를 돌려준다)
 *   OSM             z5~19   (z20 은 400)
 *   Esri 위성        z5~19   (z20 이상은 빈 타일)
 *
 * 이전 상수(15~19)는 두 군데가 틀렸다 — 기본 배경인 브이월드에서 z19 는
 * 아예 안 나오는데 열려 있었고, 아래는 15에서 막혀 동네 밖으로 못 나갔다.
 */
export const ZOOM_LIMITS = {
  vworld: { min: 6, max: 18 },
  osm: { min: 5, max: 19 },
  satellite: { min: 5, max: 19 },
} as const;

/** 지금 배경으로 열 수 있는 줌 범위 */
export function zoomRange(
  style: TileStyle,
  hasVworldKey: boolean,
): { min: number; max: number } {
  if (style === "satellite") return ZOOM_LIMITS.satellite;
  return hasVworldKey ? ZOOM_LIMITS.vworld : ZOOM_LIMITS.osm;
}

/** 배경을 바꿨을 때 지금 줌이 그 배경에 없으면 가장 가까운 줌으로 데려온다 */
export function clampZoom(
  zoom: number,
  style: TileStyle,
  hasVworldKey: boolean,
): number {
  const { min, max } = zoomRange(style, hasVworldKey);
  return Math.min(max, Math.max(min, zoom));
}

/**
 * 배경 스타일 — plan(기본)은 건축 도면처럼 조용한 회백색 지도다.
 * 위성사진 위에서는 아무도 설계하지 않는다 (2026-08-29 검토 피드백).
 * satellite 는 지형 확인용 토글로 남긴다.
 */
export type TileStyle = "plan" | "satellite";

export function tileAttribution(style: TileStyle, vworldKey: string | null): string {
  if (style === "satellite") return "위성사진: Esri World Imagery";
  return vworldKey ? "지도: 국토교통부 브이월드" : "지도: © OpenStreetMap contributors";
}

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

/**
 * 타일 주소 조립 — 위성(Esri)·브이월드는 z/y/x, OSM 은 z/x/y 순서다.
 *
 * 도면 스타일의 본선은 국토부 브이월드 백지도(흑백 건축도면 룩, 국내 건물
 * 윤곽 최상) — 단 키가 필요하다(NEXT_PUBLIC_VWORLD_KEY, 도메인 제한 키라
 * 브라우저 노출이 설계상 정상). 키가 없으면 OSM 으로 폴백해 화면은 산다.
 * CARTO light_all 은 2026 현재 키 없이 쓰면 워터마크가 박혀 뺐다.
 */
export function tileUrl(
  tx: number,
  ty: number,
  zoom: number,
  style: TileStyle = "plan",
  vworldKey: string | null = null,
): string {
  if (style === "satellite") {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
  }
  if (vworldKey) {
    return `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/white/${zoom}/${ty}/${tx}.png`;
  }
  return `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
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
  style: TileStyle = "plan",
  vworldKey: string | null = null,
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
        url: tileUrl(tx, ty, zoom, style, vworldKey),
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
