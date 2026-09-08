"use client";

// 쌍둥이 축제 3D 지도 — 평면 SVG 지도(twin-map.tsx)의 **보조** 화면이다.
//
// SVG 지도는 무JS·서버 렌더라 e2e 와 번들 크기의 근거이고, 이 화면은 사용자가 "3D 로
// 보기"를 눌러야 뜬다. 619건 배경점은 여기 없다 — 서버가 넘기는 것은 닮은 축제 몇 곳과
// 이 기획안의 지역뿐이라 festivals.json 은 클라이언트로 오지 않는다.
//
// 기둥 높이 = 실측 배수. 사람 수가 아니다. 기둥은 지도 위 캔버스에 직접 그린다 —
// MapLibre 의 GeoJSON 소스는 Next 아래서 워커가 안 살아나 못 쓴다(sim-map.tsx 와 같은 이유).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Map as MLMap, NavigationControl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./twin-map-3d.css";

export interface Pin3D {
  id: string;
  name: string;
  lat: number;
  lng: number;
  num: number;
  year: string;
  /** 실측 방문 배수 — 기둥 높이 */
  surge: number;
}

function baseStyle(key: string | null): StyleSpecification {
  const src = key
    ? { tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`], attribution: "국토교통부 브이월드", maxzoom: 19 }
    : { tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], attribution: "© OpenStreetMap contributors", maxzoom: 19 };
  return { version: 8, sources: { base: { type: "raster", tileSize: 256, ...src } }, layers: [{ id: "base", type: "raster", source: "base" }] };
}

interface Drawn { id: string; x: number; y: number; w: number; h: number }

export default function TwinMap3D({
  pins,
  origin,
  entryId,
  selectedPin,
  vworldKey,
}: {
  pins: Pin3D[];
  origin: { lat: number; lng: number } | null;
  entryId: string;
  selectedPin: string | null;
  vworldKey: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const drawnRef = useRef<Drawn[]>([]);
  const hoverRef = useRef<string | null>(null);
  const propsRef = useRef({ pins, origin, selectedPin, vworldKey });
  useEffect(() => { propsRef.current = { pins, origin, selectedPin, vworldKey }; });

  useEffect(() => {
    if (!open || !mapEl.current || mapRef.current) return;
    const { pins: ps, origin: o, vworldKey: key } = propsRef.current;
    const pts = [...ps.map((p) => [p.lng, p.lat] as [number, number]), ...(o ? [[o.lng, o.lat] as [number, number]] : [])];
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const center: [number, number] = pts.length ? [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] : [127.8, 36.3];
    const map = new MLMap({
      container: mapEl.current, style: baseStyle(key), center, zoom: 6.5, pitch: 58, bearing: -12, maxZoom: 13, attributionControl: {},
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-left");
    if (pts.length >= 2) {
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 90, pitch: 58, bearing: -12, duration: 0, maxZoom: 9 });
    } else if (pts.length === 1) {
      map.jumpTo({ center: pts[0], zoom: 8.5, pitch: 58, bearing: -12 });
    }
    mapRef.current = map;

    const fit = () => {
      const c = canvasEl.current, el = mapEl.current;
      if (!c || !el) return;
      const r = el.getBoundingClientRect();
      c.width = r.width * devicePixelRatio; c.height = r.height * devicePixelRatio;
      c.style.width = r.width + "px"; c.style.height = r.height + "px";
    };
    const ro = new ResizeObserver(() => { fit(); map.resize(); });
    ro.observe(mapEl.current);
    fit();

    let raf = 0, frame = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasEl.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      if (!map.loaded() && frame++ % 30 === 0) map.triggerRepaint();
      const dpr = devicePixelRatio;
      ctx.clearRect(0, 0, c.width, c.height);
      const { pins: P, origin: O, selectedPin: S } = propsRef.current;
      const sc = (lng: number, lat: number): [number, number] => { const q = map.project([lng, lat]); return [q.x * dpr, q.y * dpr]; };
      // 이 기획안의 지역 — 과녁
      if (O) {
        const [x, y] = sc(O.lng, O.lat);
        ctx.strokeStyle = "#171717"; ctx.lineWidth = 2 * dpr; ctx.setLineDash([]);
        ctx.beginPath(); ctx.ellipse(x, y, 11 * dpr, 6 * dpr, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 18 * dpr, y); ctx.lineTo(x + 18 * dpr, y); ctx.moveTo(x, y - 10 * dpr); ctx.lineTo(x, y + 10 * dpr); ctx.stroke();
        ctx.font = `600 ${11 * dpr}px var(--font-body, sans-serif)`; ctx.textAlign = "center"; ctx.fillStyle = "#171717";
        ctx.fillText("이 기획안", x, y + 22 * dpr);
      }
      // 기둥 — 멀리 있는 것(화면 위쪽)부터 그려 가까운 것이 덮는다
      const drawn: Drawn[] = [];
      const order = [...P].map((p) => ({ p, s: sc(p.lng, p.lat) })).sort((a, b) => a.s[1] - b.s[1]);
      for (const { p, s } of order) {
        const [x, y] = s;
        const sel = p.id === S, hov = p.id === hoverRef.current;
        const w = 16 * dpr, d = 7 * dpr;
        const h = (28 + Math.min(4, Math.max(0, p.surge)) * 26) * dpr;
        const ink = sel ? "#C62A20" : "#171717";
        // 바닥 그림자
        ctx.fillStyle = "rgba(23,23,23,0.18)";
        ctx.beginPath(); ctx.ellipse(x + 4 * dpr, y + 2 * dpr, w * 0.9, w * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        // 앞면
        ctx.fillStyle = sel ? "#C62A20" : hov ? "#3a3a3a" : "#262626";
        ctx.fillRect(x - w / 2, y - h, w, h);
        // 옆면 (오른쪽, 어둡게)
        ctx.fillStyle = sel ? "#8f1d16" : "#0f0f0f";
        ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2 + d, y - d * 0.6); ctx.lineTo(x + w / 2 + d, y - h - d * 0.6); ctx.lineTo(x + w / 2, y - h); ctx.closePath(); ctx.fill();
        // 윗면 (밝게)
        ctx.fillStyle = sel ? "#e0574d" : "#6b6b6b";
        ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w / 2 + d, y - h - d * 0.6); ctx.lineTo(x - w / 2 + d, y - h - d * 0.6); ctx.closePath(); ctx.fill();
        // 번호 + 배수
        ctx.font = `700 ${12 * dpr}px var(--font-display, sans-serif)`; ctx.textAlign = "center"; ctx.fillStyle = "#FFFFFF";
        ctx.fillText(String(p.num), x, y - h + 15 * dpr);
        const label = `×${p.surge.toFixed(2)}`;
        ctx.font = `${11 * dpr}px var(--font-mono, monospace)`;
        ctx.lineWidth = 3 * dpr; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.strokeText(label, x, y - h - 12 * dpr);
        ctx.fillStyle = ink; ctx.fillText(label, x, y - h - 12 * dpr);
        if (sel || hov) {
          ctx.font = `600 ${11 * dpr}px var(--font-body, sans-serif)`;
          const t = `${p.name} (${p.year})`;
          ctx.strokeText(t, x, y + 18 * dpr); ctx.fillStyle = ink; ctx.fillText(t, x, y + 18 * dpr);
        }
        drawn.push({ id: p.id, x: x - w / 2, y: y - h, w: w + d, h: h + d });
      }
      drawnRef.current = drawn;
    };
    raf = requestAnimationFrame(draw);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); map.remove(); mapRef.current = null; };
  }, [open]);

  const hitAt = (e: React.MouseEvent) => {
    const el = mapEl.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) * devicePixelRatio, y = (e.clientY - r.top) * devicePixelRatio;
    for (let i = drawnRef.current.length - 1; i >= 0; i--) {
      const d = drawnRef.current[i];
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.id;
    }
    return null;
  };

  return (
    <div className="twin-3d">
      <button type="button" className="twin-3d-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "3D 지도 닫기" : "3D 지도로 보기"}
      </button>
      {open && (
        <div
          ref={mapEl}
          className="twin-3d-map"
          onMouseMove={(e) => { hoverRef.current = hitAt(e); if (mapEl.current) mapEl.current.style.cursor = hoverRef.current ? "pointer" : ""; }}
          onClick={(e) => { const id = hitAt(e); if (id) router.push(`/?entry=${entryId}&pin=${id}#twin`); }}
        >
          <canvas ref={canvasEl} className="twin-3d-overlay" />
          <p className="twin-3d-note">기둥 높이 = 그 축제가 실제로 겪은 평소 대비 배수. 기둥을 누르면 근거로 간다. 끌어서 돌리고 기울일 수 있다.</p>
        </div>
      )}
    </div>
  );
}
