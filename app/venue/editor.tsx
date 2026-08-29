"use client";

// 행사장 도면 편집기 (M1).
//
// 레딧의 주차장 도구처럼 "그리는 사람" 관점으로 만든다 — 팔레트에서 놓고,
// 끌고, 돌리고, 늘린다. IT 지식이 없는 담당자가 배치도 사진을 깔고 그 위를
// 따라 그리는 흐름이 전부다. 여기엔 판정이 없다 — 판정(M2)은 결정론
// 엔진의 몫이고, 이 파일은 도면 JSON 을 정확히 만드는 것까지만 한다.

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  metersOf,
  scaleFromPoints,
  VENUE_KIND_NAME,
  type Venue,
  type VenueItem,
  type VenueKind,
} from "@/lib/venue";
import {
  MAX_ZOOM,
  metersPerPixel,
  MIN_ZOOM,
  panCenter,
  TILE_ATTRIBUTION,
  visibleTiles,
  type Tile,
} from "@/lib/tilemap";

type Mode = "select" | "scale" | "path" | "pan";

/** 팔레트에서 새로 놓을 때의 기본 크기(px) */
const DEFAULT_SIZE: Record<Exclude<VenueKind, "path">, [number, number]> = {
  booth: [60, 40],
  stage: [130, 80],
  parking: [150, 100],
  toilet: [46, 46],
  gate: [34, 56],
};

/** 종류별 채움색 — 흑백 도면 위에서 구분만 되면 된다. 위험색(적색)은 출입구만 */
const FILL: Record<Exclude<VenueKind, "path">, string> = {
  booth: "#ffffff",
  stage: "#e5e0d8",
  parking: "#eeeeee",
  toilet: "#dbe7db",
  gate: "#fbe9e9",
};

const 통로기본폭 = 16;
const MAX_UNDERLAY_BYTES = 4 * 1024 * 1024;

let seq = 0;
const newId = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

const snap = (n: number) => Math.round(n / 5) * 5;

/** 타일 이미지를 내려받아 캐싱한다. 로드 완료 때만 상태를 만진다 */
function useTileImages(tiles: Tile[]) {
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({});
  const started = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const t of tiles) {
      if (started.current.has(t.url)) continue;
      started.current.add(t.url);
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setImgs((m) => ({ ...m, [t.url]: img }));
      img.src = t.url;
    }
  }, [tiles]);
  return imgs;
}

export default function Editor({
  initialVenue,
  entryId,
  initialCenter,
  saveAction,
}: {
  initialVenue: Venue;
  entryId: string | null;
  initialCenter: { lat: number; lng: number } | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [venue, setVenue] = useState<Venue>(initialVenue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [scalePts, setScalePts] = useState<{ x: number; y: number }[]>([]);
  const [scaleMeters, setScaleMeters] = useState("");
  const [pathPts, setPathPts] = useState<number[]>([]);
  const [underlayImg, setUnderlayImg] = useState<HTMLImageElement | null>(null);
  const [알림, set알림] = useState<string | null>(null);

  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

  const selected = venue.items.find((it) => it.id === selectedId) ?? null;

  // 위성지도 타일 — 지도가 깔려 있을 때만 계산·다운로드
  const tiles = venue.map
    ? visibleTiles(venue.map.lat, venue.map.lng, venue.map.zoom, venue.width, venue.height)
    : [];
  const tileImgs = useTileImages(tiles);

  /** 도형 전체를 픽셀만큼 옮긴다 — 지도를 끌면 도형이 땅에 붙어 따라온다 */
  function shiftItems(items: VenueItem[], dx: number, dy: number): VenueItem[] {
    return items.map((it) =>
      it.kind === "path"
        ? { ...it, points: (it.points ?? []).map((n, i) => n + (i % 2 === 0 ? dx : dy)) }
        : { ...it, x: it.x + dx, y: it.y + dy },
    );
  }

  /** 캔버스 중앙 기준으로 도형을 배율만큼 키운다 — 줌해도 땅에 붙어 있다 */
  function zoomItems(items: VenueItem[], f: number): VenueItem[] {
    const cx = venue.width / 2;
    const cy = venue.height / 2;
    return items.map((it) =>
      it.kind === "path"
        ? {
            ...it,
            w: Math.max(2, it.w * f),
            points: (it.points ?? []).map((n, i) =>
              i % 2 === 0 ? cx + (n - cx) * f : cy + (n - cy) * f,
            ),
          }
        : {
            ...it,
            x: cx + (it.x - cx) * f,
            y: cy + (it.y - cy) * f,
            w: it.w * f,
            h: it.h * f,
          },
    );
  }

  function layMap() {
    const lat = initialCenter?.lat ?? 37.5663; // 서울시청 — 이력 없이 들어온 경우
    const lng = initialCenter?.lng ?? 126.9779;
    const zoom = 16;
    setVenue((v) => ({ ...v, map: { lat, lng, zoom }, mPerPx: metersPerPixel(lat, zoom) }));
    setMode("pan");
  }

  function changeZoom(dir: 1 | -1) {
    const m = venue.map;
    if (!m) return;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, m.zoom + dir));
    if (zoom === m.zoom) return;
    const f = 2 ** (zoom - m.zoom);
    setVenue((v) => ({
      ...v,
      map: { ...m, zoom },
      mPerPx: metersPerPixel(m.lat, zoom),
      items: zoomItems(v.items, f),
    }));
  }

  function onStageDragEnd(e: KonvaEventObject<DragEvent>) {
    const stage = e.target.getStage();
    if (!stage || e.target !== stage || !venue.map) return;
    const dx = stage.x();
    const dy = stage.y();
    stage.position({ x: 0, y: 0 });
    const m = venue.map;
    setVenue((v) => ({
      ...v,
      map: { ...m, ...panCenter(m.lat, m.lng, m.zoom, dx, dy) },
      items: shiftItems(v.items, dx, dy),
    }));
  }

  // 밑그림 dataURL → 이미지 객체. 로드는 비동기라 onload 에서만 상태를 만진다.
  useEffect(() => {
    if (!venue.underlay) return;
    const img = new window.Image();
    img.onload = () => setUnderlayImg(img);
    img.src = venue.underlay;
  }, [venue.underlay]);

  // 선택이 바뀌면 변형 핸들을 그 도형에 붙인다 (통로는 제외 — 점을 끌면 된다)
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node =
      selected && selected.kind !== "path"
        ? (nodeRefs.current.get(selected.id) ?? null)
        : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected]);

  // Delete 키로 삭제 — 입력칸에 타이핑 중일 때는 건드리지 않는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (selectedId) removeItem(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function updateItem(id: string, patch: Partial<VenueItem>) {
    setVenue((v) => ({
      ...v,
      items: v.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  function removeItem(id: string) {
    nodeRefs.current.delete(id);
    setVenue((v) => ({ ...v, items: v.items.filter((it) => it.id !== id) }));
    setSelectedId(null);
  }

  function addItem(kind: Exclude<VenueKind, "path">) {
    const [w, h] = DEFAULT_SIZE[kind];
    const n = venue.items.length;
    const item: VenueItem = {
      id: newId(),
      kind,
      x: snap(80 + (n % 6) * 30),
      y: snap(80 + (n % 6) * 24),
      w,
      h,
      rotation: 0,
      name: `${VENUE_KIND_NAME[kind]} ${venue.items.filter((i) => i.kind === kind).length + 1}`,
      ...(kind === "booth" ? { staff: 2, popularity: 3 } : {}),
    };
    setVenue((v) => ({ ...v, items: [...v.items, item] }));
    setSelectedId(item.id);
    setMode("select");
  }

  function finishPath() {
    if (pathPts.length >= 4) {
      const item: VenueItem = {
        id: newId(),
        kind: "path",
        x: 0,
        y: 0,
        w: 통로기본폭,
        h: 0,
        rotation: 0,
        name: `통로 ${venue.items.filter((i) => i.kind === "path").length + 1}`,
        points: pathPts,
      };
      setVenue((v) => ({ ...v, items: [...v.items, item] }));
      setSelectedId(item.id);
    }
    setPathPts([]);
    setMode("select");
  }

  function onStageMouseDown(e: KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (mode === "scale") {
      const pts = [...scalePts, { x: pos.x, y: pos.y }];
      setScalePts(pts.slice(0, 2));
      return;
    }
    if (mode === "path") {
      setPathPts((p) => [...p, snap(pos.x), snap(pos.y)]);
      return;
    }
    // 빈 곳을 누르면 선택 해제
    if (e.target === stage) setSelectedId(null);
  }

  function applyScale() {
    const meters = Number(scaleMeters);
    const mPerPx =
      scalePts.length === 2
        ? scaleFromPoints(scalePts[0], scalePts[1], meters)
        : null;
    if (mPerPx === null) {
      set알림("두 점을 찍고 0보다 큰 실거리(m)를 넣어 주세요");
      return;
    }
    setVenue((v) => ({ ...v, mPerPx }));
    setScalePts([]);
    setScaleMeters("");
    setMode("select");
    set알림(null);
  }

  function onUnderlay(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UNDERLAY_BYTES) {
      set알림("밑그림은 4MB 까지 받습니다 — 사진을 줄여서 올려 주세요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setVenue((v) => ({ ...v, underlay: String(reader.result) }));
    reader.readAsDataURL(file);
    set알림(null);
  }

  function onTransformEnd(item: VenueItem) {
    const node = nodeRefs.current.get(item.id);
    if (!node) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateItem(item.id, {
      x: snap(node.x()),
      y: snap(node.y()),
      w: Math.max(10, Math.round(item.w * sx)),
      h: Math.max(10, Math.round(item.h * sy)),
      rotation: Math.round(node.rotation()),
    });
  }

  const 축척문구 =
    venue.mPerPx === null
      ? "축척 없음 — 쏠림 검증 전에 재 두세요"
      : `1px = ${venue.mPerPx.toFixed(3)}m · 도면 폭 ≈ ${Math.round(venue.width * venue.mPerPx)}m${venue.map ? " (지도 줌에서 자동)" : ""}`;

  const selectedMeters = selected ? metersOf(selected, venue.mPerPx) : null;

  return (
    <div className="venue-layout">
      <div className="venue-canvas">
        <Stage
          width={venue.width}
          height={venue.height}
          onMouseDown={onStageMouseDown}
          draggable={mode === "pan"}
          onDragEnd={onStageDragEnd}
          style={{ cursor: mode === "select" ? "default" : mode === "pan" ? "grab" : "crosshair" }}
        >
          <Layer>
            <Rect x={0} y={0} width={venue.width} height={venue.height} fill="#fcfbf9" stroke="#c9c4bd" listening={mode !== "select"} />
            {tiles.map(
              (t) =>
                tileImgs[t.url] && (
                  <KonvaImage key={t.url} image={tileImgs[t.url]} x={t.px} y={t.py} width={256} height={256} listening={false} />
                ),
            )}
            {venue.map && (
              <Text x={venue.width - 190} y={venue.height - 18} width={184} align="right" text={TILE_ATTRIBUTION} fontSize={10} fill="#ffffff" opacity={0.85} listening={false} />
            )}
            {underlayImg && (
              <KonvaImage image={underlayImg} width={venue.width} height={venue.height} opacity={0.45} listening={false} />
            )}

            {venue.items.map((it) =>
              it.kind === "path" ? (
                <Line
                  key={it.id}
                  points={it.points ?? []}
                  stroke={selectedId === it.id ? "#b3261e" : "#b9b2a8"}
                  strokeWidth={it.w}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.55}
                  draggable={mode === "select"}
                  onClick={() => setSelectedId(it.id)}
                  onDragEnd={(e) => {
                    const dx = e.target.x();
                    const dy = e.target.y();
                    e.target.position({ x: 0, y: 0 });
                    updateItem(it.id, {
                      points: (it.points ?? []).map((n, i) =>
                        snap(n + (i % 2 === 0 ? dx : dy)),
                      ),
                    });
                  }}
                />
              ) : (
                <Group
                  key={it.id}
                  ref={(node) => {
                    if (node) nodeRefs.current.set(it.id, node);
                  }}
                  x={it.x}
                  y={it.y}
                  rotation={it.rotation}
                  draggable={mode === "select"}
                  onClick={() => setSelectedId(it.id)}
                  onTap={() => setSelectedId(it.id)}
                  onDragEnd={(e) =>
                    updateItem(it.id, { x: snap(e.target.x()), y: snap(e.target.y()) })
                  }
                  onTransformEnd={() => onTransformEnd(it)}
                >
                  <Rect
                    width={it.w}
                    height={it.h}
                    fill={FILL[it.kind]}
                    stroke={selectedId === it.id ? "#b3261e" : "#37332f"}
                    strokeWidth={selectedId === it.id ? 2 : 1.2}
                  />
                  <Text
                    text={it.name}
                    width={it.w}
                    height={it.h}
                    align="center"
                    verticalAlign="middle"
                    fontSize={11}
                    fill="#37332f"
                    listening={false}
                  />
                </Group>
              ),
            )}

            {/* 축척 측정 점 · 그리는 중인 통로 미리보기 */}
            {scalePts.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={5} fill="#b3261e" />
            ))}
            {scalePts.length === 2 && (
              <Line points={[scalePts[0].x, scalePts[0].y, scalePts[1].x, scalePts[1].y]} stroke="#b3261e" strokeWidth={2} dash={[6, 4]} />
            )}
            {pathPts.length >= 2 && (
              <Line points={pathPts} stroke="#b3261e" strokeWidth={통로기본폭} lineCap="round" lineJoin="round" opacity={0.4} />
            )}

            <Transformer ref={trRef} rotateEnabled flipEnabled={false} boundBoxFunc={(o, n) => (n.width < 10 || n.height < 10 ? o : n)} />
          </Layer>
        </Stage>
      </div>

      <aside className="venue-panel">
        {알림 && (
          <p className="alert" data-level="주의" role="alert">{알림}</p>
        )}

        <h2>놓기</h2>
        <div className="palette">
          {(Object.keys(DEFAULT_SIZE) as Exclude<VenueKind, "path">[]).map((k) => (
            <button key={k} type="button" onClick={() => addItem(k)}>
              {VENUE_KIND_NAME[k]}
            </button>
          ))}
          {mode !== "path" ? (
            <button type="button" onClick={() => { setMode("path"); setSelectedId(null); }}>
              통로 그리기
            </button>
          ) : (
            <button type="button" className="active" onClick={finishPath}>
              통로 끝내기 ({pathPts.length / 2}점)
            </button>
          )}
        </div>
        {mode === "path" && (
          <p className="note">도면을 눌러 통로의 꺾이는 점을 찍고, 통로 끝내기 버튼을 누르세요</p>
        )}

        <h2>배경 지도</h2>
        {!venue.map ? (
          <p>
            <button type="button" onClick={layMap}>위성지도 깔기</button>{" "}
            <span className="note">
              {initialCenter ? "진단한 지역에서 시작합니다" : "서울에서 시작 — 끌어서 옮기세요"}
            </span>
          </p>
        ) : (
          <>
            <p>
              {mode !== "pan" ? (
                <button type="button" onClick={() => { setMode("pan"); setSelectedId(null); }}>지도 이동</button>
              ) : (
                <button type="button" className="active" onClick={() => setMode("select")}>이동 끝 — 배치로</button>
              )}{" "}
              <button type="button" onClick={() => changeZoom(1)}>확대 +</button>{" "}
              <button type="button" onClick={() => changeZoom(-1)}>축소 −</button>
            </p>
            <p className="note">
              강·다리·도로가 보이는 실제 부지 위에 배치하세요. 지도를 끌거나
              줌해도 놓은 것들은 땅에 붙어 따라옵니다
            </p>
          </>
        )}

        <h2>사진 밑그림 · 축척</h2>
        <p>
          <input type="file" accept="image/*" onChange={onUnderlay} />
        </p>
        {venue.map ? (
          <p className="note num">{축척문구}</p>
        ) : mode !== "scale" ? (
          <p>
            <button type="button" onClick={() => { setMode("scale"); setScalePts([]); setSelectedId(null); }}>
              축척 재기
            </button>{" "}
            <span className="note num">{축척문구}</span>
          </p>
        ) : (
          <div>
            <p className="note">실거리를 아는 두 점(예: 정문 폭의 양 끝)을 도면에서 찍으세요 — {scalePts.length}/2</p>
            <p>
              <label htmlFor="scale-m">실제 거리(m)</label>{" "}
              <input id="scale-m" type="number" min="0.1" step="any" value={scaleMeters} onChange={(e) => setScaleMeters(e.target.value)} />{" "}
              <button type="button" onClick={applyScale} disabled={scalePts.length < 2}>확정</button>
            </p>
          </div>
        )}

        <h2>선택한 것</h2>
        {!selected ? (
          <p className="note">도형을 누르면 이름·인력·선호도를 고칠 수 있습니다</p>
        ) : (
          <div className="props">
            <p className="note">{VENUE_KIND_NAME[selected.kind]}{selectedMeters ? ` · 실측 ${selectedMeters.wM}m × ${selectedMeters.hM}m` : ""}</p>
            <p>
              <label htmlFor="p-name">이름</label>{" "}
              <input id="p-name" value={selected.name} onChange={(e) => updateItem(selected.id, { name: e.target.value })} />
            </p>
            {selected.kind === "booth" && (
              <>
                <p>
                  <label htmlFor="p-staff">배치 인력</label>{" "}
                  <input id="p-staff" type="number" min="0" value={selected.staff ?? 0} onChange={(e) => updateItem(selected.id, { staff: Number(e.target.value) })} />
                </p>
                <p>
                  <label htmlFor="p-pop">예상 선호도</label>{" "}
                  <select id="p-pop" value={selected.popularity ?? 3} onChange={(e) => updateItem(selected.id, { popularity: Number(e.target.value) })}>
                    <option value="1">1 — 한산</option>
                    <option value="2">2</option>
                    <option value="3">3 — 보통</option>
                    <option value="4">4</option>
                    <option value="5">5 — 인기(쏠림 후보)</option>
                  </select>
                </p>
              </>
            )}
            {selected.kind === "path" && (
              <p>
                <label htmlFor="p-width">통로 폭(px)</label>{" "}
                <input id="p-width" type="number" min="4" value={selected.w} onChange={(e) => updateItem(selected.id, { w: Math.max(4, Number(e.target.value)) })} />
              </p>
            )}
            <p>
              <button type="button" className="note" onClick={() => removeItem(selected.id)}>이것 지우기</button>
            </p>
          </div>
        )}

        <h2>저장</h2>
        <form action={saveAction}>
          <input type="hidden" name="venue" value={JSON.stringify(venue)} />
          <input type="hidden" name="entryId" value={entryId ?? ""} />
          <p>
            <button type="submit">도면 저장</button>{" "}
            <span className="note num">{venue.items.length}개 배치됨</span>
          </p>
        </form>
      </aside>
    </div>
  );
}
