// 정적 전수 스캔 (M2) — 도면 위 쏠림 판정. 순수 함수, LLM 0회.
//
// 절대 방문객 수는 여기 없다. 있는 것은 **상대 부하 지수**뿐이다:
//   부하 = 쌍둥이 실측 배수 × (부스의 수요 몫 ÷ 부스의 공급 몫)
//   수요 몫 = 선호도 / 전체 선호도 합 · 공급 몫 = 인력 / 전체 인력 합
// 부하 1.0 = 이 부스의 처리 능력과 수요가 맞음. 2.0 = 처리 능력의 두 배가 몰림.
//
// 대기열 시각화 가정(화면에도 명시): 부하 1.0 초과분 1 당 부스 깊이만큼
// 대기열이 앞으로 자란다 (최대 4배). 이 가정 위에서만 "통로 침범"을 잰다.

import { outsideSite, polygonAreaM2, siteOf } from "@/lib/venue";
import type { Venue, VenueItem } from "@/lib/venue";

export interface BoothLoad {
  id: string;
  name: string;
  /** 상대 부하 지수. 1.0 = 수요와 처리 능력이 맞음 */
  load: number;
}

/** 부스 앞으로 자란 대기열 사각형 — 부스 좌표계(회전 포함)로 정의된다 */
export interface QueueRect {
  boothId: string;
  /** 부스 원점(좌상단)과 회전 — Konva 와 같은 규약 */
  bx: number;
  by: number;
  w: number;
  /** 부스 깊이 — 대기열은 local y = h0 부터 시작한다 */
  h0: number;
  /** 대기열 깊이(px) */
  depth: number;
  rotation: number;
}

export interface Invasion {
  boothId: string;
  boothName: string;
  pathId: string;
  pathName: string;
}

export interface ScanResult {
  loads: BoothLoad[];
  /** 부하 내림차순 위험 상위 (부하 > 1 만, 최대 3) */
  top: string[];
  queues: QueueRect[];
  invasions: Invasion[];
  /** 부지 경계 밖으로 나갔거나 걸친 배치. 부지를 안 그렸으면 빈 배열 */
  outside: string[];
  /** 부지 면적(㎡). 경계나 축척이 없으면 null */
  siteAreaM2: number | null;
  /** 스캔 자체가 불가능한 이유 — 지어내는 대신 이걸 화면에 낸다 */
  blocked?: string;
}

const 최대대기배수 = 4;

/** 부하 1 초과분만큼 부스 앞(local +y)으로 자라는 대기열. 없으면 null */
export function queueRect(item: VenueItem, load: number): QueueRect | null {
  if (!(load > 1)) return null;
  const depth = Math.min(load - 1, 최대대기배수) * item.h;
  return {
    boothId: item.id,
    bx: item.x,
    by: item.y,
    w: item.w,
    h0: item.h,
    depth,
    rotation: item.rotation,
  };
}

/** 점이 (여유 margin 을 두고) 대기열 안에 있는가 — 회전을 되돌려 잰다 */
export function pointInQueue(
  q: QueueRect,
  p: { x: number; y: number },
  margin = 0,
): boolean {
  const rad = (q.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = p.x - q.bx;
  const dy = p.y - q.by;
  const lx = c * dx + s * dy;
  const ly = -s * dx + c * dy;
  return (
    lx >= -margin &&
    lx <= q.w + margin &&
    ly >= q.h0 - margin &&
    ly <= q.h0 + q.depth + margin
  );
}

/** 통로 꺾은선을 일정 간격으로 점찍는다 — 침범 판정용 표본 */
function samplePath(points: number[], step = 4): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k <= n; k++) {
      out.push({ x: x1 + ((x2 - x1) * k) / n, y: y1 + ((y2 - y1) * k) / n });
    }
  }
  return out;
}

/** 전 부스·전 통로 일괄 스캔. 부스가 몇 개든 밀리초다 — 전수는 수식이 맡는다 */
export function scanVenue(venue: Venue, surge: number | null): ScanResult {
  // 부지 판정은 배수가 없어도 된다 — 경계를 벗어난 배치는 수요와 무관하게
  // 잘못이다. 그래서 blocked 로 돌려보내는 길에도 이 둘은 실려 나간다.
  const site = siteOf(venue);
  const outside = outsideSite(venue);
  const siteAreaM2 = site?.points
    ? polygonAreaM2(site.points, venue.mPerPx)
    : null;
  const empty: ScanResult = {
    loads: [],
    top: [],
    queues: [],
    invasions: [],
    outside,
    siteAreaM2,
  };

  if (surge === null || !(surge > 0)) {
    return {
      ...empty,
      blocked:
        "쌍둥이 축제의 실측 배수가 없습니다(비교 대상 없음) — 근거 없이 부하를 지어내지 않습니다",
    };
  }
  if (venue.mPerPx === null) {
    return {
      ...empty,
      blocked: "축척이 없어 거리 판정을 못 합니다 — 부지 지도를 깔거나 축척을 재 주세요",
    };
  }

  const booths = venue.items.filter((it) => it.kind === "booth");
  if (booths.length === 0) return empty;

  // 인력 0 인 부스가 공급 몫을 0 으로 만들면 부하가 무한대가 된다.
  // "인력 미정"을 0.5명으로 치는 것은 가정이고, 화면 지시문이 이를 밝힌다.
  const popOf = (b: VenueItem) => b.popularity ?? 3;
  const staffOf = (b: VenueItem) => Math.max(b.staff ?? 0, 0.5);
  const 총선호 = booths.reduce((a, b) => a + popOf(b), 0);
  const 총인력 = booths.reduce((a, b) => a + staffOf(b), 0);

  const loads: BoothLoad[] = booths
    .map((b) => ({
      id: b.id,
      name: b.name,
      load: surge * (popOf(b) / 총선호) / (staffOf(b) / 총인력),
    }))
    .sort((a, b) => b.load - a.load || a.id.localeCompare(b.id));

  const top = loads.filter((l) => l.load > 1).slice(0, 3).map((l) => l.id);

  const queues = booths
    .map((b) => queueRect(b, loads.find((l) => l.id === b.id)!.load))
    .filter((q): q is QueueRect => q !== null);

  const invasions: Invasion[] = [];
  const paths = venue.items.filter((it) => it.kind === "path");
  for (const q of queues) {
    const booth = booths.find((b) => b.id === q.boothId)!;
    for (const path of paths) {
      const pts = samplePath(path.points ?? []);
      if (pts.some((p) => pointInQueue(q, p, path.w / 2))) {
        invasions.push({
          boothId: booth.id,
          boothName: booth.name,
          pathId: path.id,
          pathName: path.name,
        });
      }
    }
  }

  return { loads, top, queues, invasions, outside, siteAreaM2 };
}
