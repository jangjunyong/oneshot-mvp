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
import { FESTIVALS } from "@/lib/festivals";
import { MAP_H, MAP_W, pinGroups, project } from "@/lib/mapproj";
import type { MatchedFestival } from "@/lib/types";

/** 619개 점을 path 하나로 접는다 — circle 619개면 DOM 이 터진다.
 *  길이 0 선분 + 둥근 끝 = 점. 모듈 로드 때 한 번만 만든다. */
const 배경점들 = FESTIVALS.map((f) => {
  const p = project(f.lat, f.lng);
  return `M${p.x} ${p.y}l0 0`;
}).join("");

/** 핀 하나. 기둥 + 바닥 그림자 + 머리 — 평면 지도 위에 서 있게 보이는 최소 단서 */
function Pin({
  x,
  y,
  label,
  href,
  selected,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  href: string;
  selected: boolean;
  tone: string;
}) {
  const 기둥 = 26;
  const r = selected ? 11 : 9;
  return (
    <Link href={href} aria-label={`닮은 축제 ${label} 자세히 보기`}>
      <g className="pin" data-selected={selected ? "1" : undefined}>
        {/* 바닥 그림자 — 핀이 땅에 꽂혀 있다는 유일한 단서 */}
        <ellipse cx={x} cy={y} rx={r * 0.75} ry={r * 0.3} fill="#000" opacity="0.18" />
        <line x1={x} y1={y} x2={x} y2={y - 기둥} stroke={tone} strokeWidth={selected ? 3 : 2} />
        <circle cx={x} cy={y - 기둥} r={r} fill={tone} stroke="#fff" strokeWidth="1.5" />
        <text
          x={x}
          y={y - 기둥 + 4}
          textAnchor="middle"
          fontSize={selected ? 12 : 11}
          fontWeight="700"
          fill="#fff"
        >
          {label}
        </text>
      </g>
    </Link>
  );
}

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
  const groups = pinGroups(
    matched.map((m) => ({ id: m.festival.id, lat: m.festival.lat, lng: m.festival.lng })),
  );
  const o = origin ? project(origin.lat, origin.lng) : null;

  return (
    <figure className="twin-map">
      <svg
        className="map"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label={`닮은 과거 축제 ${matched.length}곳의 위치. 배경 점은 잰 축제 ${FESTIVALS.length}곳 전부`}
      >
        <path d={배경점들} stroke="var(--line-strong)" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* 입력 지역 — 핀이 아니라 과녁이다. 여기가 '이 기획안'이다 */}
        {o && (
          <g stroke="var(--severe)" strokeWidth="2" fill="none">
            <circle cx={o.x} cy={o.y} r="7" />
            <line x1={o.x - 11} y1={o.y} x2={o.x + 11} y2={o.y} />
            <line x1={o.x} y1={o.y - 11} x2={o.x} y2={o.y + 11} />
          </g>
        )}

        {groups.map((g) => {
          const 대표 = g.ids[0];
          const 선택됨 = g.ids.includes(selectedPin ?? "");
          return (
            <Pin
              key={대표}
              x={g.x}
              y={g.y}
              label={g.nums.join("·")}
              href={`/?entry=${entryId}&pin=${대표}#twin`}
              selected={선택됨}
              tone={선택됨 ? "var(--severe)" : "var(--ink)"}
            />
          );
        })}
      </svg>

      <figcaption className="note">
        {matched.length === 0
          ? `비교할 만한 과거 축제가 없습니다 — 찾아본 범위: ${scope}`
          : `점 = 잰 축제 ${FESTIVALS.length}곳 전부 · 핀 = 닮은 축제 ${matched.length}곳(누르면 근거) · ⊕ = 이 기획안의 지역`}
      </figcaption>
    </figure>
  );
}
