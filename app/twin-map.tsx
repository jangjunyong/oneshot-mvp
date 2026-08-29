// 쌍둥이 축제 지도 — 한 장의 대한민국 위에 핀.
//
// **서버 컴포넌트다.** 619건 배경점을 여기서 만들어 SVG 문자열로만 내보내므로
// festivals.json(199KB)이 클라이언트로 넘어가지 않는다. 클라이언트 컴포넌트로
// 바꾸면 그 순간 번들에 통째로 들어간다 — 그러지 말 것.
//
// 상호작용도 자바스크립트 없이 한다. 핀은 <a href="?entry=…&pin=…"> 라서
// JS 가 없어도 눌리고, 무JS fetch 로 도는 e2e 가 그대로 검증할 수 있다.
//
// 라이브러리도 타일도 쓰지 않는다. 회색 점 619개가 그 자체로 나라 모양이라
// 화면의 모든 점이 실측이다.

import Link from "next/link";
import { COAST_RINGS, COAST_SOURCE } from "@/lib/coastline";
import { FESTIVALS } from "@/lib/festivals";
import {
  hasPlace,
  layoutPins,
  MAP_H,
  MAP_W,
  PIN_HEAD_R,
  project,
} from "@/lib/mapproj";
import type { MatchedFestival } from "@/lib/types";

/** 좌표가 실제로 있는 축제만. 4건은 빈 값이거나 기본값이 박혀 있어서
 *  그대로 찍으면 바다에 없는 축제가 생긴다 (mapproj.hasPlace) */
const 찍히는축제 = FESTIVALS.filter((f) => hasPlace(f.lat, f.lng));

/** 점을 path 하나로 접는다 — circle 615개면 DOM 이 터진다.
 *  길이 0 선분 + 둥근 끝 = 점. 모듈 로드 때 한 번만 만든다. */
const 배경점들 = 찍히는축제
  .map((f) => {
    const p = project(f.lat, f.lng);
    return `M${p.x} ${p.y}l0 0`;
  })
  .join("");

/** 해안선 53개 링도 path 하나로. 이것도 모듈 로드 때 한 번만 */
const 해안선 = COAST_RINGS.map(
  (ring) =>
    ring
      .map((c, i) => {
        const p = project(c[1], c[0]);
        return `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
      })
      .join("") + "Z",
).join("");

/** 홀로 떨어져 있어 모양만으로는 못 알아보는 섬. 이름을 달아 준다.
 *  좌표는 해안선과 같은 Natural Earth 링의 중심이다 */
const 섬이름 = [
  { name: "울릉도", lat: 37.5, lng: 130.87, anchor: "start" as const, dx: 8 },
  { name: "독도", lat: 37.24, lng: 131.86, anchor: "end" as const, dx: -8 },
];

/** 핀 하나. 기둥 + 바닥 그림자 + 머리 — 평면 지도 위에 서 있게 보이는 최소 단서.
 *  기둥 높이는 밖에서 준다 — 이웃과 머리가 겹치면 layoutPins 가 늘려 보낸다 */
function Pin({
  x,
  y,
  stem,
  label,
  href,
  selected,
}: {
  x: number;
  y: number;
  stem: number;
  label: string;
  href: string;
  selected: boolean;
}) {
  const r = selected ? PIN_HEAD_R + 2 : PIN_HEAD_R;
  return (
    <Link href={href} aria-label={`닮은 축제 ${label} 자세히 보기`}>
      <g className="pin" data-selected={selected ? "1" : undefined}>
        {/* 바닥 그림자 — 핀이 땅에 꽂혀 있다는 유일한 단서 */}
        <ellipse className="pin-foot" cx={x} cy={y} rx={r * 0.75} ry={r * 0.3} />
        <line x1={x} y1={y} x2={x} y2={y - stem} strokeWidth={selected ? 3 : 2} />
        <circle cx={x} cy={y - stem} r={r} />
        <text
          x={x}
          y={y - stem + 4}
          textAnchor="middle"
          fontSize={selected ? 12 : 11}
          fontWeight="700"
        >
          {label}
        </text>
      </g>
    </Link>
  );
}

/** 이 핀이 지금 고른 것인가 (1/0) — 그리는 순서를 정하는 데도 쓴다 */
const 고른것 = (g: { ids: string[] }, selectedPin: string | null) =>
  g.ids.includes(selectedPin ?? "") ? 1 : 0;

/**
 * 진단 한 건의 지도.
 *
 * 핀 개수는 matched 가 정한다 (0~3). findSimilar 는 3개를 채우려고 억지로
 * 넣지 않으므로 여기서도 3을 가정하지 않는다 — 0건이면 핀 없이 "찾아본 범위"를
 * 말한다 (근거를 못 찾은 것과 안전한 것은 다르다).
 */
export function TwinMap({
  matched,
  origin,
  entryId,
  selectedPin,
  scope,
}: {
  matched: MatchedFestival[];
  origin: { lat: number; lng: number } | null;
  entryId: string;
  selectedPin: string | null;
  scope: string;
}) {
  // 좌표가 없는 곳은 핀을 세울 자리가 없다. 순번은 목록과 같아야 하므로
  // 거르기 **전에** 매겨서 넘긴다 — 목록의 3번이 지도의 3번이다.
  const 핀들 = layoutPins(
    matched
      .map((m, i) => ({
        id: m.festival.id,
        lat: m.festival.lat,
        lng: m.festival.lng,
        num: i + 1,
      }))
      .filter((p) => hasPlace(p.lat, p.lng)),
  );
  const 못올린수 = matched.length - 핀들.reduce((n, g) => n + g.ids.length, 0);
  const o = origin && hasPlace(origin.lat, origin.lng) ? project(origin.lat, origin.lng) : null;

  return (
    <figure className="twin-map">
      <svg
        className="map"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label={`남한 해안선 위에 찍은 닮은 과거 축제 ${matched.length}곳의 위치. 배경 점은 좌표가 있는 축제 ${찍히는축제.length}곳`}
      >
        {/* 해안선이 먼저 — 실측 점이 그 위에 얹혀야 "어디에 찍혔는지"가 읽힌다 */}
        <path className="map-coast" d={해안선} strokeWidth="0.9" />
        {섬이름.map((s) => {
          const p = project(s.lat, s.lng);
          return (
            <text
              key={s.name}
              className="map-label"
              x={p.x + s.dx}
              y={p.y + 3}
              textAnchor={s.anchor}
            >
              {s.name}
            </text>
          );
        })}

        <path className="map-dots" d={배경점들} strokeWidth="2.6" strokeLinecap="round" />

        {/* 입력 지역 — 핀이 아니라 과녁이다. 여기가 '이 기획안'이다 */}
        {o && (
          <g className="map-origin" strokeWidth="2">
            <circle cx={o.x} cy={o.y} r="7" />
            <line x1={o.x - 11} y1={o.y} x2={o.x + 11} y2={o.y} />
            <line x1={o.x} y1={o.y - 11} x2={o.x} y2={o.y + 11} />
          </g>
        )}

        {/* 고른 핀을 맨 나중에 그린다 — SVG 는 z-index 가 없어 그리는 순서가
            곧 위아래다. 고른 핀이 이웃 기둥에 가리면 무엇을 골랐는지 흐려진다 */}
        {[...핀들]
          .sort((a, b) => 고른것(a, selectedPin) - 고른것(b, selectedPin))
          .map((g) => (
            <Pin
              key={g.ids[0]}
              x={g.x}
              y={g.y}
              stem={g.stem}
              label={g.nums.join("·")}
              href={`/?entry=${entryId}&pin=${g.ids[0]}#twin`}
              selected={고른것(g, selectedPin) === 1}
            />
          ))}
      </svg>

      <figcaption className="note">
        {matched.length === 0
          ? `비교할 만한 과거 축제가 없습니다 — 찾아본 범위: ${scope}`
          : `점 = 좌표가 있는 축제 ${찍히는축제.length}곳 · 핀 = 닮은 축제 ${matched.length}곳(누르면 근거) · ⊕ = 이 기획안의 지역` +
            (못올린수 > 0 ? ` · 좌표가 없어 지도에 못 올린 ${못올린수}곳은 아래 목록에 있습니다` : "")}
        <br />
        해안선: {COAST_SOURCE}
      </figcaption>
    </figure>
  );
}
