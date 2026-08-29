// 대한민국 지도 투영 — 순수 좌표 계산만.
//
// **데이터를 import 하지 않는다.** 619건(festivals.json 199KB)은 JSON 단일
// 모듈이라 필드 단위 트리셰이킹이 안 된다. 이 파일이 데이터를 끌어오면
// 이걸 쓰는 모든 곳이 그 무게를 지므로, 경계를 테스트로 못 박아 뒀다
// (mapproj.test.ts "경계" 케이스).

/**
 * 실측 좌표가 있는 615건의 실제 범위에 여백을 조금 준 것.
 * 제주(33.24)~최북단(38.50), 서해안(126.23)~동해안(129.46).
 *
 * 예전 범위(경도 124.5~131.2)는 데이터가 한 점도 없는 바다를 좌우로
 * 절반씩 끼고 있어서, 지도를 키워도 나라는 그대로 작았다.
 */
const LAT_MAX = 38.65;
const LAT_MIN = 33.1;
const LNG_MIN = 126.1;
const LNG_MAX = 129.6;

/**
 * 지도 캔버스 크기. 위도 5.55° × 경도 3.5°이고 경도 1°는 위도 36°에서
 * cos 보정(≈0.81)만큼 짧다 → 가로:세로 = 3.5×0.81 : 5.55 ≈ 0.51.
 * 남한은 실제로 홀쭉하다. 정사각형에 맞추면 나라가 뚱뚱해진다.
 */
export const MAP_H = 470;
export const MAP_W = 240;

/** 핀 머리 반지름과 기본 기둥 높이. 겹침 판정이 이 값으로 돈다 */
export const PIN_HEAD_R = 9;
const PIN_STEM = 26;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * 이 좌표를 지도에 찍어도 되는가.
 *
 * 619건 중 4건은 좌표가 비었거나 (19.69, 117.99) 같은 기본값이 박혀 있다.
 * 그대로 project 하면 clamp 되어 **바다 한가운데 점**이 생기는데, 그건
 * 실측이 아니라 우리가 만들어낸 위치다 — 화면에 올리지 않는다.
 */
export function hasPlace(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= LAT_MIN &&
    lat <= LAT_MAX &&
    lng >= LNG_MIN &&
    lng <= LNG_MAX
  );
}

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
  /** 화면에 적을 순번. 안 주면 입력 순서(1부터). 좌표 없는 건을 걸러낸 뒤에도
   *  목록의 번호와 핀의 번호가 같아야 하므로 밖에서 넣을 수 있게 뒀다 */
  num?: number;
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
    g.nums.push(it.num ?? i + 1);
    g.ids.push(it.id);
    byPos.set(key, g);
  });
  return [...byPos.values()];
}

export interface PlacedPin extends PinGroup {
  /** 이 핀의 기둥 높이. 머리는 (x, y - stem) 에 온다 */
  stem: number;
}

/**
 * 핀 세우기. 자리는 같지 않은데 **머리가 겹치는** 이웃(남해군·하동군처럼
 * 20km 남짓 떨어진 두 곳)은 기둥을 늘려 위로 비켜 세운다.
 *
 * 겹친 채로 두면 나중에 그린 핀이 앞 핀을 덮어 번호 하나가 화면에서
 * 사라진다 — 닮은 곳이 3곳인데 2곳만 보이면 그건 다른 진단이다.
 * 발(x, y)은 실측 그대로다. 늘어나는 건 기둥뿐이라 위치는 거짓말하지 않는다.
 */
export function layoutPins(items: readonly PinInput[]): PlacedPin[] {
  const 최소간격 = PIN_HEAD_R * 2 + 4;
  const 놓인머리: { x: number; y: number }[] = [];

  // 북쪽부터 세운다 — 순서가 정해져 있어야 같은 입력이 같은 그림이 된다
  return pinGroups(items)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((g) => {
      let stem = PIN_STEM;
      for (let 시도 = 0; 시도 < 6; 시도 += 1) {
        const 머리 = { x: g.x, y: g.y - stem };
        const 겹침 = 놓인머리.some(
          (h) => Math.hypot(h.x - 머리.x, h.y - 머리.y) < 최소간격,
        );
        if (!겹침) break;
        stem += 최소간격;
      }
      놓인머리.push({ x: g.x, y: g.y - stem });
      return { ...g, stem };
    });
}
