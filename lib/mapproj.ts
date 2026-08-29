// 대한민국 지도 투영 — 순수 좌표 계산만.
//
// **데이터를 import 하지 않는다.** 619건(festivals.json 199KB)은 JSON 단일
// 모듈이라 필드 단위 트리셰이킹이 안 된다. 이 파일이 데이터를 끌어오면
// 이걸 쓰는 모든 곳이 그 무게를 지므로, 경계를 테스트로 못 박아 뒀다
// (mapproj.test.ts "경계" 케이스).

/** 지도 캔버스 크기. 위도 5.8° × 경도 6.7°, 위도 36°의 cos 보정(≈0.81) 반영 */
export const MAP_W = 356;
export const MAP_H = 380;

const LAT_MAX = 38.8;
const LAT_MIN = 33.0;
const LNG_MIN = 124.5;
const LNG_MAX = 131.2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 위경도 → 지도 캔버스 좌표. 범위 밖 값도 지도 안으로 잘라 넣는다 */
export function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return {
    x: Math.round(clamp(x, 0, MAP_W) * 10) / 10,
    y: Math.round(clamp(y, 0, MAP_H) * 10) / 10,
  };
}

export interface PinInput {
  id: string;
  lat: number;
  lng: number;
}

export interface PinGroup {
  /** 겹친 축제들의 순번(1부터) */
  nums: number[];
  ids: string[];
  x: number;
  y: number;
}

/**
 * 핀 배치. 같은 좌표에 놓이는 축제(같은 시군구의 두 축제 등)는 한 핀으로
 * 묶는다 — 안 묶으면 마커가 정확히 포개져 번호 하나가 사라진다.
 *
 * 개수는 입력이 정한다. findSimilar 는 0~3 건을 돌려주므로 3 을 가정하지 않는다.
 */
export function pinGroups(items: readonly PinInput[]): PinGroup[] {
  const byPos = new Map<string, PinGroup>();
  items.forEach((it, i) => {
    const p = project(it.lat, it.lng);
    const key = `${p.x},${p.y}`;
    const g = byPos.get(key) ?? { nums: [], ids: [], x: p.x, y: p.y };
    g.nums.push(i + 1);
    g.ids.push(it.id);
    byPos.set(key, g);
  });
  return [...byPos.values()];
}
