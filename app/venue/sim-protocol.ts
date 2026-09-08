// 메인 스레드 ↔ 시뮬 워커 메시지. 워커는 lib/sim/sim.js 를 돌리고, 화면은 스냅숏만 그린다.
//
// 좌표·밀도는 TypedArray 로 옮긴다(transfer). 이름 붙이기(가장 가까운 부스)는 메인이 한다 —
// 메인도 같은 도면(venueFromGeoJSON)을 갖고 있어서다.

import type { Scenario, Summary } from "@/lib/sim/sim.js";

export type FC = GeoJSON.FeatureCollection & { origin?: [number, number]; zoom?: number; name?: string; source?: string };

export type ToWorker =
  | { type: "build"; fc: FC; origin: [number, number]; scenario: Scenario }
  | { type: "run" }
  | { type: "pause" }
  | { type: "speed"; v: number }
  | { type: "scale"; v: number }
  | { type: "headless"; fc: FC; origin: [number, number]; scenario: Scenario; minutes: number; focusIds: string[] }
  | { type: "stress"; fc: FC; origin: [number, number]; scenario: Scenario; horizonSec: number };

export interface GridMeta {
  w: number; h: number; cell: number; minX: number; minY: number; walkM2: number;
  dW: number; dH: number; dCell: number; k: number;
}

/** 한 프레임 — 점 위치와 상태(0 걷기 · 1 줄 · 2 서비스/관람 · 3 그 밖) */
export interface Frame {
  time: number;
  n: number;
  xy: Float32Array;
  st: Uint8Array;
  /** 5프레임마다 한 번 온다 — 없으면 이전 것을 그대로 쓴다 */
  density?: Float32Array;
  peakDensity?: Float32Array;
}

export interface FocusMetric {
  id: string;
  waitingMax: number;
  maxWaitMin: number;
  balked: number;
  corridorCells: number;
  corridorSecMax: number;
  corridorPeak: number;
}
export interface HeadlessResult {
  summary: Summary;
  focus: FocusMetric[];
  minutes: number;
}
export interface StressRowRaw {
  k: number;
  peak: number;
  at: { x: number; y: number } | null;
  sec: number;
  sec5: number;
}

export type FromWorker =
  | { type: "built"; meta: GridMeta; summary: Summary }
  | { type: "frame"; frame: Frame }
  | { type: "summary"; summary: Summary }
  | { type: "stopped" }
  | { type: "progress"; scope: "headless" | "stress"; text: string }
  | { type: "headlessDone"; result: HeadlessResult }
  | { type: "stressDone"; rows: StressRowRaw[] }
  | { type: "error"; message: string };
