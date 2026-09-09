"use client";

// 행사장 시뮬레이션 — 시뮬_데모/index.html 을 React 로 옮긴 것.
// 엔진(lib/sim/sim.js)·도면 변환(lib/sim/geo.js)은 데모와 같은 파일이다.
// 시뮬 스텝은 타이머로, 그리기는 rAF 로 돈다 — 탭이 뒤로 가도 시뮬은 계속 가야
// 스트레스 테스트가 끝난다. 프레임마다 React 상태를 건드리지 않는다(ref 로 돈다).

import { useEffect, useRef, useState } from "react";
import {
  Map as MLMap,
  NavigationControl,
  ScaleControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./sim.css";
import { LOS, losOf, type Scenario, type Summary } from "@/lib/sim/sim.js";
import type { Frame, FromWorker, GridMeta, ToWorker } from "./sim-protocol";
import { askScenario } from "@/app/venue/ask-action";
import type { AskScenario, VenueIndex } from "@/lib/simask";
import {
  addBooth, addCorridor, alignToNeighbor, centroidM, distM, extendRow, hitCorridor, hitTest, orientationOf, projectionOf,
  remove as removeFeature, rotate as rotateFeature, rotateTo, setProps, snapToRow, translate as translateFeature,
} from "@/lib/geoedit";
import type { Venue } from "@/lib/venue";
import {
  makeProjection,
  venueFromGeoJSON,
  type Projection,
  type Venue as SimVenue,
} from "@/lib/sim/geo.js";

type FC = GeoJSON.FeatureCollection & {
  origin?: [number, number];
  zoom?: number;
  name?: string;
  source?: string;
};
type EditMode = "view" | "select" | "booth" | "corridor" | "measure";
const MODE_LABEL: Record<EditMode, string> = {
  view: "보기", select: "선택·옮기기", booth: "부스 놓기", corridor: "통로 그리기", measure: "재기",
};
const BOOTH_CATS = ["체험", "판매", "먹거리", "푸드트럭", "홍보", "전시", "편의"];
type BaseKind = "plan" | "sat" | "base" | "osm";
type WhatIf = Record<string, boolean>;
interface StressRow {
  k: number;
  peak: number;
  where: string;
  sec: number;
  sec5: number;
}

const VENUE_FILE = "/venue/gunpo.geojson";

function rasterStyle(kind: BaseKind, key: string | null): StyleSpecification {
  // 도면 모드 — 타일 없이 흰 바탕. 사람 눈에는 건축 도면처럼 검정 선만 보인다
  if (kind === "plan") {
    return { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#FFFFFF" } }] };
  }
  const src =
    kind === "osm" || !key
      ? {
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          attribution: "© OpenStreetMap contributors",
          maxzoom: 19,
        }
      : kind === "sat"
        ? {
            tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/{z}/{y}/{x}.jpeg`],
            attribution: "국토교통부 브이월드",
            maxzoom: 19,
          }
        : {
            tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`],
            attribution: "국토교통부 브이월드",
            maxzoom: 19,
          };
  return {
    version: 8,
    sources: { base: { type: "raster", tileSize: 256, ...src } },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

type GateShare = Record<string, number>;
/** 질문이 가리킨 부스 — 인기를 boost 배로 본다 */
interface Focus { ids: string[]; boost: number }
const NO_FOCUS: Focus = { ids: [], boost: 1 };

interface FocusAnswer {
  name: string;
  waitingMax: number;
  maxWaitMin: number;
  balked: number;
  /** 부스 앞 10m 안 2m 칸 중 3명/㎡ 이상을 겪은 칸 수와 그 최장 초·최대 밀도 */
  corridorCells: number;
  corridorSecMax: number;
  corridorPeak: number;
}
interface Answer {
  sc: AskScenario;
  minutes: number;
  hotspots: { where: string; peak: number; sec: number }[];
  focus: FocusAnswer[];
  limitSec: number;
  limitWhere: string | null;
  peak: number;
}

function venueIndexOf(fc: FC): VenueIndex {
  const booths: VenueIndex["booths"] = [];
  const gates: VenueIndex["gates"] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    if (typeof p.id !== "string") continue;
    if (p.kind === "booth") booths.push({ id: p.id, name: String(p.name ?? p.id), cat: typeof p.cat === "string" ? p.cat : null });
    if (p.kind === "gate") gates.push({ id: p.id, name: String(p.name ?? p.id) });
  }
  return { booths, gates };
}

/** what-if 가 적용된 도면 — 출입구 닫기, 부스 창구 2배, 출입구별 유입 몫, 질문의 몰림 */
function effectiveFC(fc: FC, whatif: WhatIf, gateShare: GateShare, focus: Focus = NO_FOCUS): FC {
  return {
    ...fc,
    features: fc.features
      .filter((f) => !whatif["close:" + String(f.properties?.id)])
      .map((f) => {
        const p = { ...(f.properties ?? {}) } as Record<string, unknown>;
        if (p.kind === "gate" && typeof p.id === "string" && gateShare[p.id] !== undefined) p.share = gateShare[p.id];
        if (p.kind === "booth" && typeof p.id === "string" && focus.ids.includes(p.id)) {
          p.popularity = (typeof p.popularity === "number" ? p.popularity : 1) * focus.boost;
        }
        const cat = typeof p.cat === "string" ? p.cat : null;
        if (whatif["servers2:" + String(p.id)] || (cat && whatif["servers2cat:" + cat])) {
          p.servers = (typeof p.servers === "number" ? p.servers : 1) * 2;
        }
        return { ...f, properties: p };
      }),
  };
}

/**
 * 도면은 MapLibre 레이어가 아니라 캔버스에 직접 그린다.
 * GeoJSON 소스는 워커에서 파싱되는데 Next(Turbopack) 아래서 워커가 응답하지 않아
 * loaded 가 영영 false 였다(2026-09-08 실측, 오류 이벤트 0건). 캔버스로 그리면
 * 배경을 갈아도 도면이 안 사라지고, 편집기의 클릭 판정도 같은 좌표계에서 한다.
 */
let hatchCache: CanvasPattern | null = null;
/** 식재지 해치 — 건축 도면의 조경 표기. 한 번 만들어 재사용한다 */
function hatch(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  if (hatchCache) return hatchCache;
  const c = document.createElement("canvas");
  const n = 8 * devicePixelRatio;
  c.width = n; c.height = n;
  const g = c.getContext("2d");
  if (!g) return "rgba(0,0,0,0.06)";
  g.strokeStyle = "rgba(23,23,23,0.28)"; g.lineWidth = 1 * devicePixelRatio;
  g.beginPath(); g.moveTo(0, n); g.lineTo(n, 0); g.stroke();
  hatchCache = ctx.createPattern(c, "repeat");
  return hatchCache ?? "rgba(0,0,0,0.06)";
}

function drawVenue(
  ctx: CanvasRenderingContext2D,
  venue: SimVenue,
  toScreen: (x: number, y: number) => [number, number],
  pxPerM: number,
  plan: boolean,
) {
  const dpr = devicePixelRatio;
  const ink = "#171717";
  const path = (poly: [number, number][]) => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => {
      const [sx, sy] = toScreen(x, y);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
  };
  const polyline = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const [sx, sy] = toScreen(x, y); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); });
  };
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // 식재지(걷지 못하는 곳) — 도면은 해치, 위성 위에서는 옅은 녹색
  ctx.fillStyle = plan ? hatch(ctx) : "rgba(70,110,60,0.22)";
  for (const p of venue.soft) { path(p); ctx.fill(); }
  // 부지 경계 — 일점쇄선
  ctx.setLineDash([8 * dpr, 3 * dpr, 2 * dpr, 3 * dpr]);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.2 * dpr;
  for (const p of venue.sites) { path(p); ctx.stroke(); }
  ctx.setLineDash([]);
  // 통로 — 시뮬이 실제로 걷는 폭 그대로, 양쪽 가장자리 선. 세 단계로 그려야 교차점에서 선이 이어진다:
  // ① 전부 검정 굵은 선 ② 안쪽을 지워 가장자리만 남긴다(destination-out) ③ 안쪽을 채운다(도면은 흰색, 위성은 반투명)
  // 위성 위에서 가장자리 선이 있어야 연석과 맞는지 눈으로 잰다 — 띠만 있으면 경계가 안 보인다.
  const inner = (w: number) => Math.max(0.5, w - 1.6 * dpr);
  ctx.strokeStyle = ink;
  for (const c of venue.corridors) { ctx.lineWidth = Math.max(1, c.width * pxPerM); polyline(c.points); ctx.stroke(); }
  ctx.globalCompositeOperation = "destination-out";
  for (const c of venue.corridors) { ctx.lineWidth = inner(Math.max(1, c.width * pxPerM)); polyline(c.points); ctx.stroke(); }
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = plan ? "#FFFFFF" : "rgba(255,255,255,0.22)";
  for (const c of venue.corridors) { ctx.lineWidth = inner(Math.max(1, c.width * pxPerM)); polyline(c.points); ctx.stroke(); }
  // 장애물(건물·물)
  ctx.fillStyle = plan ? "rgba(23,23,23,0.10)" : "rgba(60,60,60,0.35)";
  for (const p of venue.obstacles) { path(p); ctx.fill(); }
  // 부스·무대·화장실·관람 — 흰 면에 검정 외곽선
  ctx.lineWidth = Math.max(0.8, 0.25 * pxPerM);
  for (const a of venue.attractions) {
    path(a.poly);
    if (a.kind === "stage" || a.kind === "view") { ctx.fillStyle = plan ? "rgba(23,23,23,0.18)" : "rgba(23,23,23,0.28)"; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke(); }
    else { ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke(); }
  }
  // 출입구
  ctx.fillStyle = plan ? "rgba(198,42,32,0.35)" : "rgba(198,42,32,0.65)";
  ctx.strokeStyle = "#C62A20"; ctx.lineWidth = 1 * dpr;
  for (const g of venue.gates) { path(g.poly); ctx.fill(); ctx.stroke(); }
}

/** 편집 상태 그리기 — 고른 것의 외곽선, 끌고 있는 자리, 그리는 중인 통로·재기 선 */
function drawEdit(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => [number, number],
  pxPerM: number,
  st: {
    fc: FC | null; proj: Projection | null; selectedId: string | null;
    drag: { id: string; start: [number, number]; last: [number, number] } | null;
    draft: [number, number][]; hover: [number, number] | null; mode: EditMode; snap: boolean;
    rot: { id: string; center: [number, number]; deltaDeg: number } | null;
    ext: { id: string; center: [number, number]; axis: [number, number]; count: number; dir: 1 | -1 } | null;
  },
): { rot: { x: number; y: number } | null; ext: { x: number; y: number } | null } {
  const dpr = devicePixelRatio;
  let handle: { x: number; y: number } | null = null;
  let extHandle: { x: number; y: number } | null = null;
  if (st.fc && st.proj && st.selectedId) {
    const f = st.fc.features.find((x) => x.properties?.id === st.selectedId);
    if (f) {
      const dx = st.drag && st.drag.id === st.selectedId ? st.drag.last[0] - st.drag.start[0] : 0;
      const dy = st.drag && st.drag.id === st.selectedId ? st.drag.last[1] - st.drag.start[1] : 0;
      // 회전 미리보기 — 손잡이를 끄는 동안은 중심 기준으로 돌린 윤곽을 보인다
      const rot = st.rot && st.rot.id === st.selectedId ? st.rot : null;
      const ra = rot ? (rot.deltaDeg * Math.PI) / 180 : 0, rc = Math.cos(ra), rs = Math.sin(ra);
      const spin = ([x, y]: [number, number]): [number, number] => rot
        ? [rot.center[0] + (x - rot.center[0]) * rc - (y - rot.center[1]) * rs, rot.center[1] + (x - rot.center[0]) * rs + (y - rot.center[1]) * rc]
        : [x, y];
      const ptsM = (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.type === "LineString" ? f.geometry.coordinates : [])
        .map((c) => spin(st.proj!.toM(c) as [number, number]));
      const pts = ptsM.map(([x, y]) => toScreen(x + dx, y + dy));
      ctx.beginPath();
      pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      if (f.geometry.type === "Polygon") ctx.closePath();
      ctx.strokeStyle = "#C62A20"; ctx.lineWidth = 2.5 * dpr; ctx.setLineDash([]); ctx.stroke();
      if (f.geometry.type === "Polygon") { ctx.fillStyle = "rgba(198,42,32,0.12)"; ctx.fill(); }
      // 회전 손잡이 — 셋째 변(뒤쪽)의 가운데에서 바깥으로 22px. 사각형이 아니어도 중심 기준으로 선다
      if (f.geometry.type === "Polygon" && st.mode === "select" && pts.length >= 4) {
        const cxs = pts.slice(0, -1).reduce((a, q) => a + q[0], 0) / (pts.length - 1), cys = pts.slice(0, -1).reduce((a, q) => a + q[1], 0) / (pts.length - 1);
        const mx = (pts[2][0] + pts[3][0]) / 2, my = (pts[2][1] + pts[3][1]) / 2;
        const vx = mx - cxs, vy = my - cys, vl = Math.hypot(vx, vy) || 1;
        const hx = mx + (vx / vl) * 22 * dpr, hy = my + (vy / vl) * 22 * dpr;
        ctx.strokeStyle = "#C62A20"; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(hx, hy, 7 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // 회전 아이콘 느낌의 작은 호
        ctx.beginPath(); ctx.arc(hx, hy, 3.5 * dpr, -Math.PI * 0.9, Math.PI * 0.6); ctx.stroke();
        handle = { x: hx, y: hy };
        // 늘리기 손잡이 — 둘째 변(축 방향 끝)의 가운데 바깥 22px, 네모
        {
          const ex2 = (pts[1][0] + pts[2][0]) / 2, ey2 = (pts[1][1] + pts[2][1]) / 2;
          const wx = ex2 - cxs, wy = ey2 - cys, wl = Math.hypot(wx, wy) || 1;
          const gx = ex2 + (wx / wl) * 22 * dpr, gy = ey2 + (wy / wl) * 22 * dpr;
          ctx.strokeStyle = "#C62A20"; ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath(); ctx.moveTo(ex2, ey2); ctx.lineTo(gx, gy); ctx.stroke();
          ctx.fillStyle = "#FFFFFF"; ctx.fillRect(gx - 6 * dpr, gy - 6 * dpr, 12 * dpr, 12 * dpr); ctx.strokeRect(gx - 6 * dpr, gy - 6 * dpr, 12 * dpr, 12 * dpr);
          ctx.beginPath(); ctx.moveTo(gx - 3 * dpr, gy); ctx.lineTo(gx + 3 * dpr, gy); ctx.moveTo(gx, gy - 3 * dpr); ctx.lineTo(gx, gy + 3 * dpr); ctx.stroke();
          extHandle = { x: gx, y: gy };
        }
        // 늘리기 미리보기 — 복제될 자리에 점선 사각형
        const ex = st.ext && st.ext.id === st.selectedId ? st.ext : null;
        if (ex && ex.count > 0) {
          ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.strokeStyle = "#171717"; ctx.lineWidth = 1.5 * dpr;
          for (let k = 1; k <= ex.count; k++) {
            const off: [number, number] = [ex.axis[0] * ex.dir * 3.5 * k, ex.axis[1] * ex.dir * 3.5 * k];
            const g = ptsM.map(([x, y]) => toScreen(x + off[0] + dx, y + off[1] + dy));
            ctx.beginPath(); g.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); ctx.stroke();
          }
          ctx.setLineDash([]);
          const t = `+${ex.count}`;
          ctx.font = `700 ${12 * dpr}px var(--font-mono, monospace)`; ctx.textAlign = "left";
          ctx.lineWidth = 4 * dpr; ctx.strokeStyle = "#FFFFFF"; ctx.strokeText(t, extHandle.x + 10 * dpr, extHandle.y - 8 * dpr);
          ctx.fillStyle = "#171717"; ctx.fillText(t, extHandle.x + 10 * dpr, extHandle.y - 8 * dpr);
        }
        if (rot) {
          const t = `${Math.round(rot.deltaDeg * 10) / 10 >= 0 ? "+" : ""}${(Math.round(rot.deltaDeg * 10) / 10).toFixed(1)}°`;
          ctx.font = `${12 * dpr}px var(--font-mono, monospace)`; ctx.textAlign = "left";
          ctx.lineWidth = 4 * dpr; ctx.strokeStyle = "#FFFFFF"; ctx.strokeText(t, hx + 10 * dpr, hy - 8 * dpr);
          ctx.fillStyle = "#C62A20"; ctx.fillText(t, hx + 10 * dpr, hy - 8 * dpr);
        }
      }
    }
  }
  const draft = st.draft;
  if ((st.mode === "corridor" || st.mode === "measure") && (draft.length > 0 || st.hover)) {
    const pts = [...draft, ...(st.hover && (st.mode === "corridor" || draft.length === 1) ? [st.hover] : [])];
    if (pts.length >= 2) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const [sx, sy] = toScreen(x, y); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); });
      ctx.strokeStyle = "#C62A20"; ctx.lineWidth = 2 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      if (st.mode === "measure") {
        const a = pts[0], b = pts[pts.length - 1];
        const [mx, my] = toScreen((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const t = `${distM(a, b).toFixed(1)} m`;
        ctx.font = `${12 * dpr}px var(--font-mono, monospace)`; ctx.textAlign = "center";
        ctx.lineWidth = 4 * dpr; ctx.strokeStyle = "#FFFFFF"; ctx.strokeText(t, mx, my - 6 * dpr);
        ctx.fillStyle = "#C62A20"; ctx.fillText(t, mx, my - 6 * dpr);
      }
    }
    for (const [x, y] of draft) { const [sx, sy] = toScreen(x, y); ctx.fillStyle = "#C62A20"; ctx.beginPath(); ctx.arc(sx, sy, 3 * dpr, 0, Math.PI * 2); ctx.fill(); }
  }
  if (st.mode === "booth" && st.hover) {
    // 놓일 자리 미리 보기 — 3×3. 이웃 줄에 붙으면 그 각도·자리로 보인다
    const sn = st.snap && st.fc && st.proj ? snapToRow(st.fc, st.proj, st.hover) : { at: st.hover, rotation: 0, neighbor: null, via: null };
    const a = (sn.rotation * Math.PI) / 180, c = Math.cos(a), sgn = Math.sin(a);
    const pts: [number, number][] = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]].map(([x, y]) => toScreen(sn.at[0] + x * c - y * sgn, sn.at[1] + x * sgn + y * c));
    ctx.strokeStyle = sn.via ? "#171717" : "#C62A20"; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.beginPath(); pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    void pxPerM;
  }
  return { rot: handle, ext: extHandle };
}

const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function centroid(poly: [number, number][]): [number, number] {
  return poly.reduce<[number, number]>(
    (p, q) => [p[0] + q[0] / poly.length, p[1] + q[1] / poly.length],
    [0, 0],
  );
}

function nearestName(venue: SimVenue, x: number, y: number) {
  let best: string | null = null;
  let bd = Infinity;
  for (const a of venue.attractions) {
    const d = Math.hypot(a.front[0] - x, a.front[1] - y);
    if (d < bd) { bd = d; best = a.name; }
  }
  for (const g of venue.gates) {
    const c = centroid(g.poly);
    const d = Math.hypot(c[0] - x, c[1] - y);
    if (d < bd) { bd = d; best = g.name; }
  }
  return best ? `${best} 근처 ${bd.toFixed(0)}m` : `(${x.toFixed(0)}, ${y.toFixed(0)})`;
}

export default function SimMap({
  vworldKey,
  scenario,
  initialCenter,
  initialGeo,
  entryId,
  saveAction,
}: {
  vworldKey: string | null;
  scenario: { surge: number | null; label: string } | null;
  initialCenter: { lat: number; lng: number } | null;
  /** 저장된 도면. 없으면 군포 기본 도면 파일을 읽는다 */
  initialGeo: FC | null;
  entryId: string | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const projRef = useRef<Projection | null>(null);
  const venueRef = useRef<SimVenue | null>(null);
  // 시뮬은 워커에서 돈다 — 메인은 마지막 프레임(스냅숏)만 그린다
  const workerRef = useRef<Worker | null>(null);
  const metaRef = useRef<GridMeta | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const densRef = useRef<{ density: Float32Array; peak: Float32Array } | null>(null);
  const scenarioRef = useRef<Scenario | null>(null);
  /** 헤드리스 작업의 완료 콜백 — 질문·스트레스는 한 번에 하나만 */
  const pendingRef = useRef<{ headless?: (r: FromWorker) => void; stress?: (r: FromWorker) => void }>({});
  const send = (m: ToWorker) => workerRef.current?.postMessage(m);
  const runningRef = useRef(false);
  const speedRef = useRef(20);
  const showRef = useRef({ agents: true, heat: true, peak: false });
  const planRef = useRef(true);
  // 편집 — 프레임마다 상태를 읽지 않으려고 ref 로도 든다
  const fcRef = useRef<FC | null>(null);
  const modeRef = useRef<EditMode>("view");
  const selectedRef = useRef<string | null>(null);
  const draftRef = useRef<[number, number][]>([]);
  const dragRef = useRef<{ id: string; start: [number, number]; last: [number, number]; moved: boolean } | null>(null);
  /** 회전 손잡이 끌기 — 중심에서 마우스까지의 각도 변화만큼 돌린다. Shift 면 15° 단위 */
  const rotRef = useRef<{ id: string; center: [number, number]; startDeg: number; deltaDeg: number; shift: boolean } | null>(null);
  /** 손잡이의 화면 위치 — 그리기가 매 프레임 갱신하고, mousedown 이 맞힌다. rot=돌리기, ext=쫙 늘리기 */
  const handleRef = useRef<{ rot: { x: number; y: number } | null; ext: { x: number; y: number } | null }>({ rot: null, ext: null });
  /** 늘리기 끌기 — 축 방향 거리로 개수를 정한다 */
  const extRef = useRef<{ id: string; center: [number, number]; axis: [number, number]; count: number; dir: 1 | -1 } | null>(null);
  const hoverRef = useRef<[number, number] | null>(null);
  /** 편집으로 바뀐 도면은 시뮬을 늦게(1.5초 뒤) 다시 만든다 — 끌 때마다 4초 멈추면 못 쓴다 */
  const editedRef = useRef(false);
  /** 편집 모드에서 바뀐 도면은 시뮬을 안 만든다(편집마다 4초 멈춤). 보기로 돌아오면 이 값이 올라가 만든다 */
  const [rebuildTick, setRebuildTick] = useState(0);
  const staleRef = useRef(false);
  const geoFormRef = useRef<HTMLFormElement>(null);
  const scaleRef = useRef(scenario?.surge ?? 1.0);
  // 서버가 한 번 넘기는 값 — 지도는 한 번만 만들고, 바뀔 일이 없다
  const initRef = useRef({ vworldKey, initialCenter, initialGeo });

  const [fc, setFc] = useState<FC | null>(null);
  const [base, setBase] = useState<BaseKind>("plan");
  const [whatif, setWhatif] = useState<WhatIf>({});
  const [gateShare, setGateShare] = useState<GateShare>({});
  const [focus, setFocus] = useState<Focus>(NO_FOCUS);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [inflow, setInflow] = useState("3000,6000,9000,9000,8000");
  const [scale, setScale] = useState(scenario?.surge ?? 1.0);
  const [visits, setVisits] = useState(3);
  const [dwell, setDwell] = useState(300);
  const [seed, setSeed] = useState(1);
  const [ppa, setPpa] = useState(3);
  const [speed, setSpeed] = useState(20);
  const [show, setShow] = useState({ agents: true, heat: true, peak: false });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("도면 읽는 중…");
  const [sum, setSum] = useState<Summary | null>(null);
  const [stress, setStress] = useState<{ rows: StressRow[]; limit: StressRow | null } | null>(null);
  const [stressMsg, setStressMsg] = useState<string | null>(null);
  const [venue, setVenue] = useState<SimVenue | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<EditMode>("view");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<FC[]>([]);
  const [dirty, setDirty] = useState(false);
  const [measure, setMeasure] = useState<number | null>(null);
  const [draftN, setDraftN] = useState(0);
  const [corridorW, setCorridorW] = useState(4);
  const [newBooth, setNewBooth] = useState({ name: "", cat: "판매", servers: 2, serviceSec: 60 });
  /** 놓고 끌 때 이웃 부스의 각도·3.5m 피치에 붙인다. 15° 로는 도로 각도(8.6°)에 못 맞춘다는 지적(2026-09-09) */
  const [snapRow, setSnapRow] = useState(true);
  const snapRef = useRef(true);
  useEffect(() => { snapRef.current = snapRow; }, [snapRow]);

  // ── 지도 생성 (한 번) ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const { vworldKey: key, initialCenter: c0 } = initRef.current;
    const map = new MLMap({
      container: mapEl.current,
      style: rasterStyle("plan", key),
      center: c0 ? [c0.lng, c0.lat] : [126.93, 37.36],
      zoom: 16,
      maxZoom: 21,
      attributionControl: {},
    });
    map.addControl(new NavigationControl(), "top-left");
    map.addControl(new ScaleControl({ maxWidth: 120, unit: "metric" }));
    mapRef.current = map;
    // 워커 — 격자·거리장·스텝이 전부 여기서 돈다. 메인은 프레임을 받아 그리기만
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      switch (m.type) {
        case "built":
          metaRef.current = m.meta;
          setStatus(`격자 ${m.meta.w}×${m.meta.h} (${m.meta.cell}m) · 걸을 수 있는 면적 ${m.meta.walkM2.toFixed(0)}㎡ · 워커`);
          setSum(m.summary);
          setReady(true);
          break;
        case "frame":
          frameRef.current = m.frame;
          if (m.frame.density && m.frame.peakDensity) densRef.current = { density: m.frame.density, peak: m.frame.peakDensity };
          break;
        case "summary": setSum(m.summary); break;
        case "stopped": runningRef.current = false; setRunning(false); break;
        case "progress":
          if (m.scope === "headless") setAsking(m.text); else setStressMsg(m.text);
          break;
        case "headlessDone": pendingRef.current.headless?.(m); pendingRef.current.headless = undefined; break;
        case "stressDone": pendingRef.current.stress?.(m); pendingRef.current.stress = undefined; break;
        case "error": setStatus(m.message); setAsking(null); setStressMsg(null); break;
      }
    };
    worker.onerror = (ev) => setStatus("시뮬 워커를 못 띄웠습니다: " + (ev.message || "알 수 없는 오류"));
    // 개발 중에만 — 크롬 콘솔에서 레이어·소스 상태를 읽으려고 노출한다
    if (process.env.NODE_ENV !== "production") {
      (window as Window & { __simMap?: MLMap }).__simMap = map;
    }

    const fit = () => {
      const c = canvasEl.current, el = mapEl.current;
      if (!c || !el) return;
      const r = el.getBoundingClientRect();
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
    };
    const ro = new ResizeObserver(() => { fit(); map.resize(); });
    ro.observe(mapEl.current);
    fit();

    const geo0 = initRef.current.initialGeo;
    const loadFc = geo0 ? Promise.resolve(geo0) : fetch(VENUE_FILE).then((r) => r.json() as Promise<FC>);
    loadFc
      .then((data: FC) => {
        setFc(data);
        // 도면의 몫을 초기값으로. 담당자 말(2026-09-08)로 수리산역 쪽이 대부분이라
        // 그 출입구가 있으면 0.6 로 올리고 나머지를 비례로 줄인다 — 가정이고 화면에서 고친다
        const gs: GateShare = {};
        const gts = data.features.filter((f) => f.properties?.kind === "gate");
        for (const g of gts) gs[String(g.properties?.id)] = Number(g.properties?.share ?? 0);
        const main = gts.find((g) => String(g.properties?.name ?? "").includes("수리산역"));
        if (main) {
          const mid = String(main.properties?.id);
          const rest = Object.keys(gs).filter((k) => k !== mid);
          const restSum = rest.reduce((a, k) => a + gs[k], 0) || 1;
          for (const k of rest) gs[k] = Math.round((gs[k] / restSum) * 0.4 * 100) / 100;
          gs[mid] = 0.6;
        }
        setGateShare(gs);
      })
      .catch(() => setStatus("도면 파일을 못 읽었습니다 (" + VENUE_FILE + ")"));

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; worker.terminate(); workerRef.current = null; };
  }, []);

  // ── 배경 바꾸기 — 이벤트에서 처리한다. 스타일을 갈면 레이어가 날아가므로 다시 얹는다
  const changeBase = (kind: BaseKind) => {
    setBase(kind);
    planRef.current = kind === "plan";
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(rasterStyle(kind, initRef.current.vworldKey));
  };

  // ── 도면·what-if 반영 + 시뮬 새로 만들기 ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fc) return;
    const eff = effectiveFC(fc, whatif, gateShare, focus);
    const origin = fc.origin ?? [126.93, 37.36];
    if (!projRef.current) {
      projRef.current = makeProjection(origin[0], origin[1]);
      map.jumpTo({ center: origin, zoom: fc.zoom ?? 17 });
      map.resize();
    }
    fcRef.current = fc;
    runningRef.current = false;
    setRunning(false);
    setStatus("격자·거리장 만드는 중… (목적지 120여 개, 몇 초 — 워커에서)");
    send({ type: "pause" });
    frameRef.current = null;
    densRef.current = null;
    setReady(false);
    // 도면(m)은 바로 — 그리기가 기다리면 안 된다. 격자·거리장은 몇 초라 한 틱(편집 뒤엔 1.5초) 미룬다
    {
      const proj0 = projRef.current;
      if (proj0) { const v0 = venueFromGeoJSON(eff, proj0); venueRef.current = v0; setVenue(v0); }
    }
    if (editedRef.current && modeRef.current !== "view") {
      // 편집 중 — 도면만 바꾸고 시뮬은 나중에. 화면엔 그 사실을 적는다
      editedRef.current = false;
      staleRef.current = true;
      setStatus("편집 중 — 보기 모드로 돌아가면 격자·거리장을 다시 만든다");
      return;
    }
    const delay = editedRef.current ? 800 : 30;
    editedRef.current = false;
    staleRef.current = false;
    const t = setTimeout(() => {
      const sc: Scenario = {
        inflowPerHour: inflow.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
        inflowScale: scaleRef.current, personsPerAgent: ppa, visitsPerPerson: visits, dwellSecMean: dwell, seed,
      };
      scenarioRef.current = sc;
      send({ type: "build", fc: eff, origin, scenario: sc });
    }, delay);
    return () => clearTimeout(t);
  }, [fc, whatif, gateShare, focus, inflow, visits, dwell, seed, ppa, rebuildTick]);

  // 배수는 시뮬을 다시 만들지 않는다 — 돌던 시뮬의 유입만 바꾼다
  useEffect(() => {
    scaleRef.current = scale;
    send({ type: "scale", v: scale });
  }, [scale]);
  useEffect(() => { speedRef.current = speed; send({ type: "speed", v: speed }); }, [speed]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  const changeMode = (k: EditMode) => {
    modeRef.current = k; draftRef.current = [];
    setMode(k); setDraftN(0); setMeasure(null);
    if (k === "view" && staleRef.current) setRebuildTick((n) => n + 1);
  };

  // ── 편집 ──────────────────────────────────────────────────────────
  const commit = (next: FC) => {
    const cur = fcRef.current;
    if (cur) setHistory((h) => [...h.slice(-19), cur]);
    editedRef.current = true;
    setDirty(true);
    setFc(next);
  };
  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      editedRef.current = true;
      setDirty(true);
      setFc(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };
  /** 마우스 → m 평면 */
  const toM = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const map = mapRef.current, el = mapEl.current, proj = projRef.current;
    if (!map || !el || !proj) return null;
    const r = el.getBoundingClientRect();
    const ll = map.unproject([e.clientX - r.left, e.clientY - r.top]);
    return proj.toM([ll.lng, ll.lat]) as [number, number];
  };
  const overHandle = (e: React.MouseEvent, which: "rot" | "ext" = "rot") => {
    const h = handleRef.current[which], el = mapEl.current;
    if (!h || !el) return false;
    const r = el.getBoundingClientRect();
    return Math.hypot((e.clientX - r.left) * devicePixelRatio - h.x, (e.clientY - r.top) * devicePixelRatio - h.y) <= 12 * devicePixelRatio;
  };
  const degTo = (c: [number, number], m: [number, number]) => (Math.atan2(m[1] - c[1], m[0] - c[0]) * 180) / Math.PI;
  const onMouseDown = (e: React.MouseEvent) => {
    if (modeRef.current !== "select" || e.button !== 0) return;
    const m = toM(e), fc0 = fcRef.current, proj = projRef.current;
    if (!m || !fc0 || !proj) return;
    // 회전 손잡이를 잡았나 — 고른 것이 있을 때만
    const selId = selectedRef.current;
    if (selId && (overHandle(e, "rot") || overHandle(e, "ext"))) {
      const f = fc0.features.find((x) => x.properties?.id === selId);
      if (f && f.geometry.type === "Polygon") {
        const c = centroidM(f, proj);
        if (overHandle(e, "ext")) {
          const a = (orientationOf(f, proj) * Math.PI) / 180;
          extRef.current = { id: selId, center: c, axis: [Math.cos(a), Math.sin(a)], count: 0, dir: 1 };
        } else {
          rotRef.current = { id: selId, center: c, startDeg: degTo(c, m), deltaDeg: 0, shift: e.shiftKey };
        }
        mapRef.current?.dragPan.disable();
        e.preventDefault();
        return;
      }
    }
    const hit = hitTest(fc0, proj, m);
    if (hit && typeof hit.properties?.id === "string") {
      setSelectedId(hit.properties.id);
      dragRef.current = { id: hit.properties.id, start: m, last: m, moved: false };
      mapRef.current?.dragPan.disable();
      e.preventDefault();
    } else {
      const c = hitCorridor(fc0, proj, m, 0.5);
      setSelectedId(c && typeof c.properties?.id === "string" ? c.properties.id : null);
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const m = toM(e);
    hoverRef.current = m;
    const rt = rotRef.current;
    if (rt && m) {
      let delta = degTo(rt.center, m) - rt.startDeg;
      rt.shift = e.shiftKey;
      if (rt.shift) delta = Math.round(delta / 15) * 15;
      rt.deltaDeg = delta;
      return;
    }
    const ex = extRef.current;
    if (ex && m) {
      // 축 방향 거리 → 개수. 첫 복제는 반 칸(1.75m)만 넘어도 선다
      const t = (m[0] - ex.center[0]) * ex.axis[0] + (m[1] - ex.center[1]) * ex.axis[1];
      ex.dir = t >= 0 ? 1 : -1;
      ex.count = Math.max(0, Math.round(Math.abs(t) / 3.5));
      return;
    }
    const d = dragRef.current;
    if (d && m) { d.last = m; if (distM(d.start, m) > 0.2) d.moved = true; }
    if (mapEl.current && modeRef.current === "select") mapEl.current.style.cursor = selectedRef.current && (overHandle(e, "rot") || overHandle(e, "ext")) ? "grab" : "";
  };
  const onMouseUp = () => {
    const rt = rotRef.current;
    if (rt) {
      rotRef.current = null;
      mapRef.current?.dragPan.enable();
      if (Math.abs(rt.deltaDeg) > 0.05 && fcRef.current && projRef.current) commit(rotateFeature(fcRef.current, projRef.current, rt.id, rt.deltaDeg));
      return;
    }
    const ex = extRef.current;
    if (ex) {
      extRef.current = null;
      mapRef.current?.dragPan.enable();
      if (ex.count > 0 && fcRef.current && projRef.current) commit(extendRow(fcRef.current, projRef.current, ex.id, ex.count, ex.dir));
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    mapRef.current?.dragPan.enable();
    if (d && d.moved && fcRef.current && projRef.current) {
      const fc0 = fcRef.current, proj = projRef.current;
      let next = translateFeature(fc0, proj, d.id, d.last[0] - d.start[0], d.last[1] - d.start[1]);
      const f = next.features.find((x) => x.properties?.id === d.id);
      if (snapRef.current && f && f.properties?.kind === "booth") {
        const c = centroidM(f, proj);
        const sn = snapToRow(next, proj, c, 3.5, d.id);
        if (sn.via) {
          next = translateFeature(next, proj, d.id, sn.at[0] - c[0], sn.at[1] - c[1]);
          next = rotateTo(next, proj, d.id, sn.rotation);
        }
      }
      commit(next);
    }
  };
  const onClick = (e: React.MouseEvent) => {
    const m = toM(e), fc0 = fcRef.current, proj = projRef.current;
    if (!m || !fc0 || !proj) return;
    const md = modeRef.current;
    if (md === "booth") {
      const n = fc0.features.filter((f) => f.properties?.kind === "booth").length + 1;
      const sn = snapRef.current ? snapToRow(fc0, proj, m) : { at: m, rotation: 0, neighbor: null, via: null };
      commit(addBooth(fc0, proj, sn.at, { name: newBooth.name.trim() || `${newBooth.cat} ${n}`, cat: newBooth.cat, servers: newBooth.servers, serviceSec: newBooth.serviceSec, rotation: sn.rotation }));
    } else if (md === "corridor") {
      draftRef.current = [...draftRef.current, m];
      setDraftN(draftRef.current.length);
    } else if (md === "measure") {
      const pts = draftRef.current.length >= 2 ? [m] : [...draftRef.current, m];
      draftRef.current = pts;
      setDraftN(pts.length);
      setMeasure(pts.length === 2 ? distM(pts[0], pts[1]) : null);
    }
  };
  const finishCorridor = () => {
    const fc0 = fcRef.current, proj = projRef.current;
    if (fc0 && proj && draftRef.current.length >= 2) commit(addCorridor(fc0, proj, draftRef.current, corridorW));
    draftRef.current = [];
    setDraftN(0);
  };
  const onDblClick = (e: React.MouseEvent) => {
    if (modeRef.current === "corridor") { e.preventDefault(); finishCorridor(); }
  };
  const deleteSel = () => {
    if (selectedRef.current && fcRef.current) { commit(removeFeature(fcRef.current, selectedRef.current)); setSelectedId(null); }
  };
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "Escape") { draftRef.current = []; setDraftN(0); setMeasure(null); setSelectedId(null); }
    else if (e.key === "Enter" && modeRef.current === "corridor") finishCorridor();
    else if (e.key === "Delete" || e.key === "Backspace") deleteSel();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  };
  // 핸들러는 렌더마다 새로 만들어지므로 최신 것을 ref 에 두고, 창 리스너는 한 번만 단다
  const keyRef = useRef(onKey);
  useEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const rotateSel = (deg: number) => { if (selectedId && fcRef.current && projRef.current) commit(rotateFeature(fcRef.current, projRef.current, selectedId, deg)); };
  const rotateSelTo = (deg: number) => { if (selectedId && fcRef.current && projRef.current && Number.isFinite(deg)) commit(rotateTo(fcRef.current, projRef.current, selectedId, deg)); };
  const alignSel = () => { if (selectedId && fcRef.current && projRef.current) commit(alignToNeighbor(fcRef.current, projRef.current, selectedId)); };
  const setSelProp = (k: string, v: unknown) => { if (selectedId && fcRef.current) commit(setProps(fcRef.current, selectedId, { [k]: v })); };
  const saveGeo = () => {
    const form = geoFormRef.current, fc0 = fcRef.current;
    if (!form || !fc0) return;
    const v: Venue = { width: 900, height: 620, mPerPx: null, items: [], geo: fc0 };
    (form.elements.namedItem("venue") as HTMLInputElement).value = JSON.stringify(v);
    form.requestSubmit();
  };
  useEffect(() => { showRef.current = show; }, [show]);

  // ── 루프: 스텝은 타이머, 그리기는 rAF ────────────────────────────
  useEffect(() => {
    let frame = 0, raf = 0;
    const draw = () => {
      const c = canvasEl.current, map = mapRef.current, proj = projRef.current, venue = venueRef.current;
      const meta = metaRef.current, fr = frameRef.current, dens = densRef.current;
      raf = requestAnimationFrame(draw);
      if (!c || !map) return;
      // 배경을 갈거나 첫 로드 뒤 타일이 와도 MapLibre 가 다시 안 그리는 일이 있다(2026-09-08 실측 —
      // triggerRepaint 를 부르면 바로 뜬다). 다 뜰 때까지 반 초에 한 번 찔러 준다.
      if (!map.loaded() && frame % 30 === 0) map.triggerRepaint();
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      if (!proj) return;
      const toScreen = (x: number, y: number): [number, number] => {
        const p = map.project(proj.toLngLat([x, y]));
        return [p.x * devicePixelRatio, p.y * devicePixelRatio];
      };
      const sh = showRef.current;
      const o = toScreen(0, 0), u = toScreen(1, 0);
      const pxPerM = Math.hypot(u[0] - o[0], u[1] - o[1]);
      if (venue) drawVenue(ctx, venue, toScreen, pxPerM, planRef.current);
      handleRef.current = drawEdit(ctx, toScreen, pxPerM, {
        fc: fcRef.current, proj, selectedId: selectedRef.current, drag: dragRef.current,
        draft: draftRef.current, hover: hoverRef.current, mode: modeRef.current, snap: snapRef.current,
        rot: rotRef.current, ext: extRef.current,
      });
      if ((sh.heat || sh.peak) && meta && dens) {
        const src = sh.peak ? dens.peak : dens.density;
        for (let i = 0; i < src.length; i++) {
          const d = src[i];
          if (d < 1.0) continue;
          const cx = i % meta.dW, cy = Math.floor(i / meta.dW);
          const x0 = meta.minX + cx * meta.dCell, y0 = meta.minY + cy * meta.dCell;
          const a = toScreen(x0, y0), b = toScreen(x0 + meta.dCell, y0 + meta.dCell);
          ctx.fillStyle = losOf(d).color;
          ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        }
      }
      const z = map.getZoom();
      if (z >= 17.2 && venue) {
        ctx.font = `${11 * devicePixelRatio}px var(--font-body, system-ui), sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3 * devicePixelRatio;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.fillStyle = "#171717";
        const label = (x: number, y: number, t: string) => {
          const [sx, sy] = toScreen(x, y);
          ctx.strokeText(t, sx, sy);
          ctx.fillText(t, sx, sy);
        };
        for (const a of venue.attractions) {
          if (a.kind === "booth" && z < 18.6) continue;
          const cc = centroid(a.poly);
          label(cc[0], cc[1], a.name);
        }
        for (const gt of venue.gates) {
          const cc = centroid(gt.poly);
          label(cc[0], cc[1], gt.name);
        }
      }
      if (sh.agents && fr) {
        const r = Math.max(1.2, (z - 15) * 1.1) * devicePixelRatio;
        const colors = ["#171717", "#C62A20", "#3a5a8a", "#171717"];
        for (let i = 0; i < fr.n; i++) {
          const [sx, sy] = toScreen(fr.xy[2 * i], fr.xy[2 * i + 1]);
          ctx.fillStyle = colors[fr.st[i]] ?? "#171717";
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame++;
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); };
  }, []);

  // ── 스트레스 테스트 (첫 1.5시간, 점=1명) ─────────────────────────
  const runStress = () => {
    const venue = venueRef.current, base = scenarioRef.current, fc0 = fcRef.current;
    if (!venue || !base || !fc0 || pendingRef.current.stress) return;
    runningRef.current = false;
    setRunning(false);
    setStress(null);
    setStressMsg("배수 0.5× 준비 중…");
    const horizon = Math.min(base.inflowPerHour.length, 1) * 3600 + 1800;
    const origin = fc0.origin ?? [126.93, 37.36];
    pendingRef.current.stress = (m) => {
      if (m.type !== "stressDone") return;
      const rows: StressRow[] = m.rows.map((r) => ({ k: r.k, peak: r.peak, sec: r.sec, sec5: r.sec5, where: r.at ? nearestName(venue, r.at.x, r.at.y) : "-" }));
      setStressMsg(null);
      setStress({ rows, limit: rows.find((o) => o.sec5 >= 60) ?? null });
    };
    send({ type: "stress", fc: effectiveFC(fc0, whatif, gateShare, focus), origin, scenario: base, horizonSec: horizon });
  };

  // ── 질문 → 시나리오 → 90분 헤드리스 재생 → 시뮬 숫자로만 답 ─────────
  const runQuestion = async () => {
    const fc0 = fc, proj = projRef.current, base = scenarioRef.current;
    if (!fc0 || !proj || !base || !question.trim() || pendingRef.current.headless) return;
    runningRef.current = false;
    setRunning(false);
    setAnswer(null);
    setAsking("질문을 시나리오로 옮기는 중…");
    const sc = await askScenario(question, venueIndexOf(fc0));
    const wi: WhatIf = { ...whatif };
    for (const g of sc.closeGates) wi["close:" + g] = true;
    for (const c of sc.doubleServersCats) wi["servers2cat:" + c] = true;
    const fo: Focus = { ids: sc.focusBooths, boost: sc.boost };
    const effQ = effectiveFC(fc0, wi, gateShare, fo);
    const v = venueFromGeoJSON(effQ, proj);
    setAsking("격자·거리장 만드는 중… (워커)");
    // 점=5명·60분 — 점=3명·90분은 2분 30초가 걸렸다(2026-09-08 실측). 답은 위치와 지속이지 소수점이 아니다
    const minutes = 60;
    const origin = fc0.origin ?? [126.93, 37.36];
    const done = await new Promise<FromWorker>((resolve) => {
      pendingRef.current.headless = resolve;
      send({
        type: "headless", fc: effQ, origin, minutes, focusIds: fo.ids,
        scenario: { ...base, inflowScale: sc.inflowScale ?? scaleRef.current, personsPerAgent: Math.max(5, base.personsPerAgent ?? 1) },
      });
    });
    if (done.type !== "headlessDone") { setAsking(null); return; }
    const su = done.result.summary;
    const focusAns: FocusAnswer[] = done.result.focus.map((f) => ({
      name: v.attractions.find((a) => a.id === f.id)?.name ?? f.id,
      waitingMax: f.waitingMax, maxWaitMin: f.maxWaitMin, balked: f.balked,
      corridorCells: f.corridorCells, corridorSecMax: f.corridorSecMax, corridorPeak: f.corridorPeak,
    }));
    setAnswer({
      sc, minutes,
      hotspots: su.hotspots.map((h) => ({ where: nearestName(v, h.x, h.y), peak: h.peak, sec: h.secAboveD })),
      focus: focusAns,
      limitSec: su.limit.secAbove5,
      limitWhere: su.limit.at ? nearestName(v, su.limit.at.x, su.limit.at.y) : null,
      peak: su.peak.density,
    });
    setAsking(null);
    // 화면의 시뮬도 같은 가정으로 맞춘다 — 담당자가 재생을 눌러 눈으로 본다
    setWhatif(wi);
    setFocus(fo);
    if (sc.inflowScale !== null) setScale(sc.inflowScale);
  };

  // 렌더에서 ref 를 읽지 않는다 — 각도 표시는 도면(fc)에서 투영을 다시 만든다(싸다)
  const projView = fc ? projectionOf(fc) : null;
  const gates = fc?.features.filter((f) => f.properties?.kind === "gate") ?? [];
  const cats = Array.from(new Set(
    fc?.features.filter((f) => f.properties?.kind === "booth" && typeof f.properties?.cat === "string").map((f) => String(f.properties?.cat)) ?? [],
  ));
  // 1초 미만 지속은 반올림하면 "0초 지속"이 돼 말이 안 된다 — 표와 판정 문장 모두 1초 이상만
  const hotspots = (sum?.hotspots ?? []).filter((h) => h.secAboveD >= 1);
  const worst = hotspots[0] ?? null;
  const tot = sum ? Object.values(sum.gateCount).reduce((a, b) => a + b, 0) || 1 : 1;
  const boothN = fc?.features.filter((f) => f.properties?.kind === "booth").length ?? 0;

  return (
    <div className="sim-layout">
      <aside className="sim-panel">
        <h3>편집</h3>
        <div className="sim-modes">
          {(Object.keys(MODE_LABEL) as EditMode[]).map((k) => (
            <button key={k} type="button" className={"sim-mode" + (mode === k ? " is-on" : "")} onClick={() => changeMode(k)}>{MODE_LABEL[k]}</button>
          ))}
        </div>
        {(mode === "select" || mode === "booth") && (
          <label className="sim-check"><input type="checkbox" checked={snapRow} onChange={(e) => setSnapRow(e.target.checked)} /><span>이웃 줄·통로에 맞추기 (각도·3.5m 간격, 첫 부스는 도로 연석에)</span></label>
        )}
        {mode === "select" && <p className="sim-small">부스·출입구·무대를 눌러 고르고 끌어 옮긴다. 고른 것의 <strong>둥근 손잡이</strong>를 끌면 자유롭게 돌고(Shift 면 15° 단위), <strong>네모 손잡이</strong>를 끌면 그 방향으로 3.5m 마다 같은 부스가 이어진다. 통로는 눌러 고른 뒤 폭을 바꾼다. Delete 로 지운다.</p>}
        {mode === "booth" && (
          <>
            <p className="sim-small">지도를 누르면 그 자리에 3×3m 부스가 선다(국내 조립부스 규격). 이웃 부스가 있으면 그 줄에, 없으면 가장 가까운 도로·산책로 방향으로 연석 바깥에 붙는다. 놓은 뒤 선택 모드에서 돌리고 옮긴다.</p>
            <label className="sim-row"><span>이름 (비우면 분류+번호)</span><input value={newBooth.name} onChange={(e) => setNewBooth({ ...newBooth, name: e.target.value })} /></label>
            <label className="sim-row"><span>분류</span>
              <select value={newBooth.cat} onChange={(e) => setNewBooth({ ...newBooth, cat: e.target.value })}>{BOOTH_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <div className="sim-two">
              <label className="sim-row"><span>창구</span><input type="number" min={1} max={8} value={newBooth.servers} onChange={(e) => setNewBooth({ ...newBooth, servers: Number(e.target.value) })} /></label>
              <label className="sim-row"><span>처리(초)</span><input type="number" min={5} step={5} value={newBooth.serviceSec} onChange={(e) => setNewBooth({ ...newBooth, serviceSec: Number(e.target.value) })} /></label>
            </div>
          </>
        )}
        {mode === "corridor" && (
          <>
            <p className="sim-small">지도를 눌러 꺾은선을 찍고, 두 번 누르거나 Enter 로 끝낸다. Esc 는 취소. 찍은 점 {draftN}개.</p>
            <label className="sim-row"><span>폭(m)</span><input type="number" min={1} max={30} step={0.5} value={corridorW} onChange={(e) => setCorridorW(Number(e.target.value))} /></label>
            {draftN >= 2 && <button type="button" className="btn" onClick={finishCorridor}>통로 확정</button>}
          </>
        )}
        {mode === "measure" && <p className="sim-small">두 점을 누르면 거리를 잰다. 위성 배경에서 연석·도로 폭을 잴 때. {measure !== null && <b className="num">{measure.toFixed(1)} m</b>}</p>}
        {selectedId && (() => {
          const f = fc?.features.find((x) => x.properties?.id === selectedId);
          if (!f) return null;
          const p = f.properties ?? {};
          const isCorr = p.kind === "corridor";
          return (
            <div className="sim-inspector">
              <p className="sim-small"><strong>{String(p.name || p.id)}</strong> <span className="sim-tag">{String(p.kind)}</span></p>
              <label className="sim-row"><span>이름</span><input value={String(p.name ?? "")} onChange={(e) => setSelProp("name", e.target.value)} /></label>
              {isCorr ? (
                <label className="sim-row"><span>폭(m)</span><input type="number" min={1} max={30} step={0.5} value={Number(p.width ?? 4)} onChange={(e) => setSelProp("width", Number(e.target.value))} /></label>
              ) : (
                <>
                  {p.kind === "booth" && (
                    <div className="sim-two">
                      <label className="sim-row"><span>창구</span><input type="number" min={1} max={8} value={Number(p.servers ?? 1)} onChange={(e) => setSelProp("servers", Number(e.target.value))} /></label>
                      <label className="sim-row"><span>처리(초)</span><input type="number" min={5} step={5} value={Number(p.serviceSec ?? 60)} onChange={(e) => setSelProp("serviceSec", Number(e.target.value))} /></label>
                      <label className="sim-row"><span>인기 1~5</span><input type="number" min={1} max={5} value={Number(p.popularity ?? 1)} onChange={(e) => setSelProp("popularity", Number(e.target.value))} /></label>
                    </div>
                  )}
                  {p.kind === "gate" && (
                    <label className="sim-row"><span>유입 몫</span><input type="number" min={0} max={1} step={0.05} value={gateShare[selectedId] ?? Number(p.share ?? 0)} onChange={(e) => setGateShare({ ...gateShare, [selectedId]: Number(e.target.value) })} /></label>
                  )}
                  <label className="sim-row"><span>각도(°) — 첫 변 기준</span>
                    <input type="number" step={0.5} value={projView ? Math.round(orientationOf(f, projView) * 10) / 10 : 0} onChange={(e) => rotateSelTo(Number(e.target.value))} />
                  </label>
                  <div className="sim-four">
                    <button type="button" className="btn" onClick={() => rotateSel(-15)}>↺15</button>
                    <button type="button" className="btn" onClick={() => rotateSel(-1)}>↺1</button>
                    <button type="button" className="btn" onClick={() => rotateSel(1)}>↻1</button>
                    <button type="button" className="btn" onClick={() => rotateSel(15)}>↻15</button>
                  </div>
                  <button type="button" className="btn" onClick={alignSel}>이웃 부스와 평행하게</button>
                </>
              )}
              <button type="button" className="btn sim-danger" onClick={deleteSel}>지우기</button>
            </div>
          );
        })()}
        <div className="sim-two">
          <button type="button" className="btn" disabled={history.length === 0} onClick={undo}>되돌리기 ({history.length})</button>
          <button type="button" className="btn sim-primary" disabled={!dirty} onClick={saveGeo}>도면 저장</button>
        </div>
        {dirty && <p className="sim-small">저장 안 된 변경이 있다. 저장하면 이 주소로 다시 열 수 있다.</p>}

        <h3>도면</h3>
        <label className="sim-row"><span>배경</span>
          <select value={base} onChange={(e) => changeBase(e.target.value as BaseKind)}>
            <option value="plan">도면 (흰 바탕)</option>
            {vworldKey && <option value="sat">브이월드 위성</option>}
            {vworldKey && <option value="base">브이월드 일반</option>}
            <option value="osm">OpenStreetMap</option>
          </select>
        </label>
        <p className="sim-small">
          {fc ? `${fc.name ?? "도면"} · 부스 ${boothN} · 출입구 ${gates.length}` : "도면 읽는 중…"}
          {fc?.source && <><br />출처: {fc.source}</>}
        </p>

        <h3>유입 시나리오</h3>
        <p className="sim-small">
          시간대별 시간당 입장 인원. 배수 기본값은 진단의 쌍둥이 실측 배수다.
          {scenario?.label && <> ({scenario.label})</>} <strong>이 숫자는 예측이 아니라 시나리오다.</strong>
        </p>
        <label className="sim-row"><span>시간대별 유입(명/시)</span>
          <input value={inflow} onChange={(e) => setInflow(e.target.value)} />
        </label>
        <label className="sim-row"><span>배수(×) <b className="num">{scale.toFixed(2)}</b></span>
          <input type="range" min={0.2} max={4} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
        </label>
        <div className="sim-row"><span>출입구별 유입 몫 (합 1.0 기준, 가정)</span>
          {gates.map((g) => {
            const id = String(g.properties?.id);
            return (
              <label key={id} className="sim-inline sim-gate">
                <span>{String(g.properties?.name)}</span>
                <input type="number" min={0} max={1} step={0.05} value={gateShare[id] ?? 0}
                  onChange={(e) => setGateShare({ ...gateShare, [id]: Number(e.target.value) })} />
              </label>
            );
          })}
        </div>
        <p className="sim-small">담당자 말로는 대부분 수리산역에서 내려 들어온다 — 그 출입구를 0.6 으로 두었다. 실측이 아니라 가정이다.</p>
        <label className="sim-row"><span>1인 방문 부스 수</span>
          <input type="number" value={visits} min={1} max={10} onChange={(e) => setVisits(Number(e.target.value))} />
        </label>
        <label className="sim-row"><span>관람 체류(초)</span>
          <input type="number" value={dwell} min={30} step={30} onChange={(e) => setDwell(Number(e.target.value))} />
        </label>
        <label className="sim-row"><span>난수 시드</span>
          <input type="number" value={seed} min={1} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
        <label className="sim-row"><span>점 하나 = 사람</span>
          <input type="number" value={ppa} min={1} max={10} onChange={(e) => setPpa(Number(e.target.value))} />
        </label>
        <p className="sim-small">큰 시나리오는 점 하나가 여러 명이다. 밀도는 그만큼 곱해 센다. 1이 가장 정확하고, 브라우저가 버거우면 올린다.</p>

        <h3>가정 바꿔 보기</h3>
        {gates.map((g) => {
          const k = "close:" + String(g.properties?.id);
          return (
            <label key={k} className="sim-check">
              <input type="checkbox" checked={!!whatif[k]} onChange={(e) => setWhatif({ ...whatif, [k]: e.target.checked })} />
              <span>{String(g.properties?.name)} 닫기</span>
            </label>
          );
        })}
        {cats.map((c) => {
          const k = "servers2cat:" + c;
          return (
            <label key={k} className="sim-check">
              <input type="checkbox" checked={!!whatif[k]} onChange={(e) => setWhatif({ ...whatif, [k]: e.target.checked })} />
              <span>{c} 부스 창구 2배</span>
            </label>
          );
        })}
      </aside>

      <div className="sim-map-col">
        <div className="sim-toolbar">
          <button type="button" className="btn" disabled={running || !ready} onClick={() => { runningRef.current = true; setRunning(true); send({ type: "run" }); }}>재생</button>
          <button type="button" className="btn" disabled={!running} onClick={() => { runningRef.current = false; setRunning(false); send({ type: "pause" }); }}>멈춤</button>
          <button type="button" className="btn" onClick={() => setWhatif({ ...whatif })}>처음부터</button>
          <label className="sim-inline"><span>배속</span>
            <input type="range" min={1} max={60} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /> <b className="num">{speed}×</b>
          </label>
          <label className="sim-inline"><input type="checkbox" checked={show.agents} onChange={(e) => setShow({ ...show, agents: e.target.checked })} /> 사람</label>
          <label className="sim-inline"><input type="checkbox" checked={show.heat} onChange={(e) => setShow({ ...show, heat: e.target.checked })} /> 지금 밀도</label>
          <label className="sim-inline"><input type="checkbox" checked={show.peak} onChange={(e) => setShow({ ...show, peak: e.target.checked })} /> 최대 밀도</label>
        </div>
        <div
          ref={mapEl}
          className="sim-map"
          data-mode={mode}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={onClick}
          onDoubleClick={onDblClick}
        >
          <canvas ref={canvasEl} className="sim-overlay" />
        </div>
        <form ref={geoFormRef} action={saveAction} className="sim-hidden-form">
          <input type="hidden" name="venue" value="" readOnly />
          <input type="hidden" name="entryId" value={entryId ?? ""} readOnly />
        </form>
        <p className="sim-status num">{status}</p>
      </div>

      <aside className="sim-panel">
        <h3>물어보기</h3>
        <p className="sim-small">말로 물으면 시나리오로 옮겨 90분을 돌리고, 시뮬이 잰 값으로만 답합니다. 예: &quot;17번 부스에 사람 몰리면 줄 때문에 통행 방해 받지 않을까?&quot;</p>
        <textarea className="sim-q" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="사고 날 것 같은 구간이 어디야?" />
        <button type="button" className="btn" disabled={!ready || !!asking || !question.trim()} onClick={runQuestion}>시뮬로 답하기</button>
        {asking && <p className="sim-small num">{asking}</p>}
        {answer && (
          <div className="sim-answer">
            <p className="sim-small"><strong>가정</strong> {answer.sc.restated || "화면의 시나리오 그대로"} <span className="sim-tag">{answer.sc.source === "model" ? "모델이 옮김" : "규칙으로 옮김"}</span></p>
            {answer.focus.map((f) => (
              <p key={f.name} className={f.corridorCells > 0 ? "alert" : "note"} data-level={f.corridorCells > 0 ? "심각" : undefined}>
                <strong>{f.name}</strong> — 줄 최대 <b className="num">{f.waitingMax}</b>, 최장 대기 <b className="num">{f.maxWaitMin.toFixed(1)}분</b>, 줄 포기 <b className="num">{f.balked}</b>.
                앞 10m 안에서 3명/㎡ 이상을 겪은 칸 <b className="num">{f.corridorCells}</b>개
                {f.corridorCells > 0 ? <>, 최장 <b className="num">{f.corridorSecMax.toFixed(0)}초</b>, 최대 <b className="num">{f.corridorPeak.toFixed(2)}명/㎡</b>. 줄이 통로를 먹는다.</> : ". 통로는 버틴다 — 이 가정 안에서."}
              </p>
            ))}
            <p className="sim-small"><strong>병목 상위</strong> ({answer.minutes}분 재생)</p>
            <ol className="sim-ol">
              {answer.hotspots.length === 0 && <li>3명/㎡ 이상이 지속된 칸이 없다</li>}
              {answer.hotspots.map((h, i) => (
                <li key={i}>{h.where} — 최대 <b className="num">{h.peak.toFixed(2)}</b>, 지속 <b className="num">{h.sec.toFixed(0)}초</b></li>
              ))}
            </ol>
            {answer.limitSec >= 60 ? (
              <p className="alert" data-level="심각">행안부 &quot;위험&quot;(5명/㎡)이 <b className="num">{answer.limitSec.toFixed(0)}초</b> 이어진 자리가 있다 — {answer.limitWhere}. 이 가정에서는 배치를 바꿔야 한다.</p>
            ) : (
              <p className="note">5명/㎡ 60초 지속 지점은 없다. 근거를 못 찾은 것이지 안전하다는 뜻이 아니다.</p>
            )}
            <p className="sim-small">가정 도면(부스 좌표 가정) 위에서 점 하나를 {Math.max(5, ppa)}명으로 놓고 {answer.minutes}분 돌린 결과다. 예측이 아니다.</p>
          </div>
        )}

        <h3>지금</h3>
        <div className="sim-kpi">
          <div><span>시각(개장 후)</span><b className="num">{sum ? fmtT(sum.time) : "00:00"}</b></div>
          <div><span>장내 인원</span><b className="num">{sum?.inside ?? 0}</b></div>
          <div><span>최대 밀도(명/㎡)</span><b className="num">{sum ? sum.peak.density.toFixed(2) : "0.00"}</b></div>
          <div><span>최대 밀도 등급</span><b>{sum ? losOf(sum.peak.density).grade : "여유"}</b></div>
        </div>
        <p className="sim-legend">
          {LOS.map((l) => (
            <span key={l.grade}><i style={{ background: l.color }} />{l.grade}{l.max === Infinity ? "" : ` <${l.max}`}</span>
          ))}
        </p>
        {worst ? (
          <p className="alert" data-level="심각">
            행안부 &quot;주의&quot;(3명/㎡) 이상이 <b className="num">{worst.secAboveD.toFixed(0)}초</b> 지속된 지점이 있다 — 최대 <b className="num">{worst.peak.toFixed(2)}명/㎡</b> ({losOf(worst.peak).grade}). 지도의 짙은 칸이 그 자리다.
          </p>
        ) : (
          <p className="note">아직 3명/㎡ 이상이 지속된 지점이 없다. (가정 안에서의 결과다 — &quot;안전하다&quot;는 뜻이 아니다)</p>
        )}

        <h3>병목 상위 (3명/㎡ 이상 지속 시간)</h3>
        <table className="sim-table">
          <thead><tr><th>#</th><th>위치</th><th>최대</th><th>지속</th></tr></thead>
          <tbody>
            {hotspots.map((h, i) => (
              <tr key={i}><td>{i + 1}</td><td>{venue ? nearestName(venue, h.x, h.y) : "-"}</td><td className="num">{h.peak.toFixed(2)}</td><td className="num">{h.secAboveD.toFixed(0)}s</td></tr>
            ))}
          </tbody>
        </table>

        <h3>대기열</h3>
        <table className="sim-table">
          <thead><tr><th>부스</th><th>대기</th><th>최대 대기</th><th>처리</th><th>줄 포기</th></tr></thead>
          <tbody>
            {(sum?.queues ?? []).slice(0, 8).map((q) => (
              <tr key={q.id}><td>{q.name}</td><td className="num">{q.waiting}</td><td className="num">{(q.maxWait / 60).toFixed(1)}분</td><td className="num">{q.served}</td><td className="num">{q.balked}</td></tr>
            ))}
          </tbody>
        </table>

        <h3>출입구별 입장</h3>
        <table className="sim-table">
          <thead><tr><th>출입구</th><th>입장</th><th>몫</th></tr></thead>
          <tbody>
            {(venue?.gates ?? []).map((g) => (
              <tr key={g.id}><td>{g.name}</td><td className="num">{sum?.gateCount[g.id] ?? 0}</td><td className="num">{(((sum?.gateCount[g.id] ?? 0) / tot) * 100).toFixed(0)}%</td></tr>
            ))}
          </tbody>
        </table>

        <h3>스트레스 테스트</h3>
        <p className="sim-small">배수를 0.5씩 올려 가며 첫 1.5시간을 재생한다. 행안부 &quot;위험&quot;(5명/㎡)이 60초 넘게 유지되는 첫 배수가 이 배치의 상한이다. 점=1명으로만 잰다.</p>
        <button type="button" className="btn" disabled={!ready || !!stressMsg} onClick={runStress}>배수 올려 가며 재생</button>
        {stressMsg && <p className="sim-small num">{stressMsg}</p>}
        {stress && (
          <>
            <table className="sim-table">
              <thead><tr><th>배수</th><th>최대 밀도</th><th>어디</th><th>3↑지속</th><th>5↑지속</th></tr></thead>
              <tbody>
                {stress.rows.map((o) => (
                  <tr key={o.k}><td className="num">{o.k.toFixed(1)}×</td><td className="num">{o.peak.toFixed(2)}</td><td>{o.where}</td><td className="num">{o.sec.toFixed(0)}s</td><td className="num">{o.sec5.toFixed(0)}s</td></tr>
                ))}
              </tbody>
            </table>
            {stress.limit ? (
              <p className="alert" data-level="심각">시나리오의 <b className="num">{stress.limit.k.toFixed(1)}배</b>에서 <b>{stress.limit.where}</b>가 행안부 &quot;위험&quot;(5명/㎡) 이상을 60초 넘게 유지한다. 이 배치가 견디는 상한은 그 아래다.</p>
            ) : (
              <p className="note">4배까지 5명/㎡ 60초 지속 지점이 없다 — 이 시나리오·가정 안에서.</p>
            )}
          </>
        )}
        <p className="sim-small">엔진은 폭 2m 통로 정상류에서 Weidmann 기본도표 ±30% 안(7점 중 6점, 전부 느린 쪽)을 통과했다(2026-09-09). 5명/㎡ 위 구간은 어떤 모델도 검증 밖이라, 상한 배수는 <strong>구간</strong>으로 읽을 것.</p>
      </aside>
    </div>
  );
}
