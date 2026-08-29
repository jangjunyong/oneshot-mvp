// 닮은 축제 지도 — 라이브러리도 지도 타일도 안 쓴다.
//
// 619건 전부에 실측 위경도가 있으므로, 그 점들을 연하게 다 찍으면
// 그 자체로 대한민국 윤곽이 나온다. 지도 이미지를 구해 오는 순간
// 출처 없는 그림이 하나 생기는데, 이 방식은 화면의 모든 점이 실측이다.

import { FESTIVALS } from "@/lib/festivals";
import type { MatchedFestival } from "@/lib/types";

// 위도 5.8° × 경도 6.7°. 경도 1°는 이 위도에서 cos(36°)≈0.81 만큼 짧으므로
// 가로를 그만큼 줄여야 지도가 홀쭉해지지 않는다: 6.7×0.81 / 5.8 ≈ 0.94.
const W = 356;
const H = 380;

// 619건 실측 좌표의 범위에 여백을 준 것. 제주(33.2)~휴전선 아래(38.6),
// 서해 백령 쪽은 데이터가 없어 본토 서안(124.6)부터다.
const LAT_MAX = 38.8;
const LAT_MIN = 33.0;
const LNG_MIN = 124.5;
const LNG_MAX = 131.2;

const x = (lng: number) => (((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W).toFixed(1);
const y = (lat: number) => (((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H).toFixed(1);

// 619개 점을 <circle> 619개로 그리면 이력 한 건마다 DOM 이 수백 개 생긴다.
// 길이 0 선분 + 둥근 끝 = 점. 전부 <path> 하나에 담는다. 모듈 로드 때 한 번만.
const 배경점들 = FESTIVALS.map(
  (f) => `M${x(f.lng)} ${y(f.lat)}l0 0`,
).join("");

/**
 * 같은 좌표의 축제(같은 시군구 두 곳 등)는 마커가 정확히 포개져 번호
 * 하나가 사라진다. 좌표가 같으면 한 마커로 묶어 "1·2" 로 적는다.
 */
function 묶어서(matched: MatchedFestival[]) {
  const groups = new Map<
    string,
    { key: string; x: string; y: string; nums: number[]; titles: string[] }
  >();
  matched.forEach((m, i) => {
    const key = `${x(m.festival.lng)},${y(m.festival.lat)}`;
    const g = groups.get(key) ?? {
      key,
      x: x(m.festival.lng),
      y: y(m.festival.lat),
      nums: [],
      titles: [],
    };
    g.nums.push(i + 1);
    g.titles.push(
      `${m.festival.name} — 평소 대비 ${m.festival.actualVisitSurge.toFixed(2)}배`,
    );
    groups.set(key, g);
  });
  return [...groups.values()].map((g) => ({ ...g, title: g.titles.join(" / ") }));
}

/**
 * 진단 결과 한 건의 지도. 회색 점 619개(전수) 위에 닮은 축제와
 * 입력 지역을 올린다. 클릭 없이 바로 보이는 것이 목적이다.
 */
export function FestivalMap({
  matched,
  origin,
}: {
  matched: MatchedFestival[];
  origin: { lat: number; lng: number } | null;
}) {
  return (
    <svg
      className="map"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="닮은 과거 축제 위치 지도"
    >
      <path
        d={배경점들}
        stroke="#c9c9c9"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {묶어서(matched).map((g) => (
        <g key={g.key}>
          <circle cx={g.x} cy={g.y} r={g.nums.length > 1 ? 9 : 7} fill="#111">
            <title>{g.title}</title>
          </circle>
          <text
            x={g.x}
            y={g.y}
            dy="3.5"
            textAnchor="middle"
            fontSize={g.nums.length > 1 ? 7 : 9}
            fill="#fff"
          >
            {g.nums.join("·")}
          </text>
        </g>
      ))}
      {origin && (
        <g stroke="#b3261e" strokeWidth="2.4">
          <line
            x1={Number(x(origin.lng)) - 6}
            y1={Number(y(origin.lat)) - 6}
            x2={Number(x(origin.lng)) + 6}
            y2={Number(y(origin.lat)) + 6}
          />
          <line
            x1={Number(x(origin.lng)) - 6}
            y1={Number(y(origin.lat)) + 6}
            x2={Number(x(origin.lng)) + 6}
            y2={Number(y(origin.lat)) - 6}
          />
          <title>입력한 기획안의 지역</title>
        </g>
      )}
    </svg>
  );
}
