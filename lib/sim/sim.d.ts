// sim.js 의 타입 표면 — 화면이 쓰는 만큼만 적는다. 엔진 본문은 시뮬_데모/sim.js 와 같은 파일이다.

export interface LosGrade { grade: string; max: number; color: string }
export const LOS: readonly LosGrade[];
export function losOf(density: number): LosGrade;

export interface Grid {
  w: number; h: number; cell: number; minX: number; minY: number;
  walk: Uint8Array;
  toWorld(cx: number, cy: number): [number, number];
}

export interface Agent { x: number; y: number; state: "walk" | "queue" | "serve" | "dwell" | string }

export interface Hotspot { x: number; y: number; peak: number; secAboveD: number; secAbove5: number }
export interface QueueSummary { id: string; name: string; waiting: number; maxWait: number; served: number; balked: number }
export interface Summary {
  time: number; inside: number; entered: number; exited: number;
  peak: { density: number; x: number; y: number; t: number };
  hotspots: Hotspot[]; queues: QueueSummary[]; gateCount: Record<string, number>;
  limit: { secAbove5: number; at: { x: number; y: number } | null };
}

export interface Scenario {
  inflowPerHour: number[]; inflowScale?: number; personsPerAgent?: number;
  visitsPerPerson?: number; dwellSecMean?: number; seed?: number;
}

export class Simulation {
  constructor(venue: import("./geo.js").Venue, scenario: Scenario, opts?: { cell?: number; dt?: number });
  grid: Grid; cell: number; dt: number; time: number; k: number;
  agents: Agent[]; scenario: Scenario;
  dW: number; dH: number; dCell: number;
  density: Float32Array; peakDensity: Float32Array; secAboveD: Float32Array; secAbove5: Float32Array;
  step(): void;
  summary(): Summary;
}
