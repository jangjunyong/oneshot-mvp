// 시뮬 워커 — 격자·거리장 계산과 스텝을 메인 스레드 밖에서 돈다 (계획 10 R2).
//
// 전에는 메인에서 돌려서 격자 만들기 4초·질문 한 건 1분 동안 화면이 굳었다.
// 엔진(lib/sim/sim.js)은 한 줄도 바꾸지 않는다 — 같은 시드 같은 결과(결정론)가 워커에서도 그대로다.

import { Simulation } from "@/lib/sim/sim.js";
import { makeProjection, venueFromGeoJSON, type Venue } from "@/lib/sim/geo.js";
import type { FC, FocusMetric, Frame, FromWorker, GridMeta, StressRowRaw, ToWorker } from "./sim-protocol";

const ctx = self as unknown as { postMessage(m: FromWorker, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<ToWorker>) => void) | null };
const post = (m: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);

let sim: Simulation | null = null;
let running = false;
let speed = 20;
let acc = 0;
let last = performance.now();
let tick = 0;

function build(fc: FC, origin: [number, number]): Venue {
  return venueFromGeoJSON(fc, makeProjection(origin[0], origin[1]));
}

function metaOf(s: Simulation): GridMeta {
  let walk = 0;
  for (let i = 0; i < s.grid.walk.length; i++) walk += s.grid.walk[i];
  return { w: s.grid.w, h: s.grid.h, cell: s.cell, minX: s.grid.minX, minY: s.grid.minY, walkM2: walk * s.cell * s.cell, dW: s.dW, dH: s.dH, dCell: s.dCell, k: s.k };
}

const STATE: Record<string, number> = { walk: 0, queue: 1, serve: 2, dwell: 2 };

function frameOf(s: Simulation, withDensity: boolean): { frame: Frame; transfer: Transferable[] } {
  const n = s.agents.length;
  const xy = new Float32Array(n * 2), st = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const a = s.agents[i]; xy[2 * i] = a.x; xy[2 * i + 1] = a.y; st[i] = STATE[a.state] ?? 3; }
  const frame: Frame = { time: s.time, n, xy, st };
  const transfer: Transferable[] = [xy.buffer, st.buffer];
  if (withDensity) {
    frame.density = s.density.slice(); frame.peakDensity = s.peakDensity.slice();
    transfer.push(frame.density.buffer, frame.peakDensity.buffer);
  }
  return { frame, transfer };
}

// 스텝은 타이머로 — 메인의 rAF 와 무관하게 돈다 (탭이 뒤로 가도)
setInterval(() => {
  const now = performance.now();
  const el = Math.min(2, (now - last) / 1000);
  last = now;
  if (!sim || !running) return;
  acc = Math.min(acc + el * speed, 120);
  let n = 0;
  while (acc >= sim.dt && n < 1200) { sim.step(); acc -= sim.dt; n++; }
  tick++;
  const { frame, transfer } = frameOf(sim, tick % 5 === 0);
  post({ type: "frame", frame }, transfer);
  if (tick % 10 === 0) post({ type: "summary", summary: sim.summary() });
  const hours = sim.scenario.inflowPerHour.length;
  if (sim.time > hours * 3600 && sim.agents.length === 0) { running = false; post({ type: "stopped" }); }
}, 50);

function focusMetrics(s: Simulation, v: Venue, ids: string[], waitingMax: Record<string, number>): FocusMetric[] {
  const su = s.summary();
  return v.attractions.filter((a) => ids.includes(a.id)).map((a) => {
    let cells = 0, secMax = 0, peak = 0;
    for (let i = 0; i < s.secAboveD.length; i++) {
      const cx = i % s.dW, cy = Math.floor(i / s.dW);
      const x = s.grid.minX + (cx + 0.5) * s.dCell, y = s.grid.minY + (cy + 0.5) * s.dCell;
      if (Math.hypot(x - a.front[0], y - a.front[1]) > 10) continue;
      peak = Math.max(peak, s.peakDensity[i]);
      if (s.secAboveD[i] > 0) { cells++; secMax = Math.max(secMax, s.secAboveD[i]); }
    }
    const q = su.queues.find((x) => x.id === a.id);
    return { id: a.id, waitingMax: waitingMax[a.id] ?? 0, maxWaitMin: (q?.maxWait ?? 0) / 60, balked: q?.balked ?? 0, corridorCells: cells, corridorSecMax: secMax, corridorPeak: peak };
  });
}

const fmtT = (sec: number) => { const m = Math.floor(sec / 60); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "build": {
        running = false;
        const v = build(m.fc, m.origin);
        if (v.gates.length === 0) { sim = null; post({ type: "error", message: "출입구(kind: gate)가 없어 시뮬을 못 돌립니다" }); return; }
        sim = new Simulation(v, m.scenario);
        acc = 0;
        post({ type: "built", meta: metaOf(sim), summary: sim.summary() });
        const { frame, transfer } = frameOf(sim, true);
        post({ type: "frame", frame }, transfer);
        return;
      }
      case "run": running = true; last = performance.now(); return;
      case "pause": running = false; return;
      case "speed": speed = m.v; return;
      case "scale": if (sim) sim.scenario.inflowScale = m.v; return;
      case "headless": {
        running = false;
        const v = build(m.fc, m.origin);
        const s = new Simulation(v, m.scenario);
        const steps = (m.minutes * 60) / s.dt;
        const waitingMax: Record<string, number> = {};
        for (let i = 0; i < steps; i++) {
          s.step();
          if (i % 2000 === 0) {
            for (const q of s.summary().queues) if (m.focusIds.includes(q.id)) waitingMax[q.id] = Math.max(waitingMax[q.id] ?? 0, q.waiting);
            post({ type: "progress", scope: "headless", text: `가정대로 재생 중… ${fmtT(s.time)} / ${fmtT(m.minutes * 60)}` });
          }
        }
        for (const q of s.summary().queues) if (m.focusIds.includes(q.id)) waitingMax[q.id] = Math.max(waitingMax[q.id] ?? 0, q.waiting);
        post({ type: "headlessDone", result: { summary: s.summary(), focus: focusMetrics(s, v, m.focusIds, waitingMax), minutes: m.minutes } });
        return;
      }
      case "stress": {
        running = false;
        const v = build(m.fc, m.origin);
        const rows: StressRowRaw[] = [];
        for (let k = 0.5; k <= 4.01; k += 0.5) {
          const s = new Simulation(v, { ...m.scenario, inflowScale: k, personsPerAgent: 1 });
          const steps = m.horizonSec / s.dt;
          for (let i = 0; i < steps; i++) {
            s.step();
            if (i % 2000 === 0) post({ type: "progress", scope: "stress", text: `배수 ${k.toFixed(1)}× 재생 중… ${fmtT(s.time)}` });
          }
          const su = s.summary();
          const worst = su.hotspots[0];
          rows.push({ k, peak: su.peak.density, at: su.limit.at ?? (worst ? { x: worst.x, y: worst.y } : null), sec: worst ? worst.secAboveD : 0, sec5: su.limit.secAbove5 });
          if (su.limit.secAbove5 >= 60) break;
        }
        post({ type: "stressDone", rows });
        return;
      }
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

export {};
