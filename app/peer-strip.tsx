// 또래 분포 띠 — "같은 규모 지역 중 상위 5%"를 그림으로.
//
// 숫자 하나보다 분포를 보는 편이 빠르다. 또래가 어디 몰려 있고 이 기획안이
// 어디 서 있는지, 등급 컷을 넘었는지가 한눈에 들어온다.
//
// 지도(TwinMap) 아래 왼쪽 열의 빈 자리에 앉는다 — 그 열은 지도 높이에서
// 끝나는데 오른쪽 본문은 훨씬 길어 아래가 비어 있었다.
//
// 차트 라이브러리를 쓰지 않는다. 눈금 몇 개와 선 두 개면 되는 그림에
// 의존성을 늘릴 이유가 없다 (지도도 같은 이유로 직접 그렸다).

import { GRADE_CUT } from "@/lib/types";
import type { PeerContext } from "@/lib/peer";

const W = 240;
const H = 92;
const PAD = 10;
/** 눈금이 서는 바닥선 */
const BASE = 58;

export function PeerStrip({
  peer,
  surges,
  surge,
}: {
  peer: PeerContext;
  /** 또래 배수 전부(오름차순) */
  surges: number[];
  /** 이 기획안의 배수 */
  surge: number;
}) {
  if (surges.length === 0) return null;

  // 축 범위 — 또래 최댓값과 우리 값 중 큰 쪽까지. 1.0 에서 시작한다
  // (배수 1 미만은 "평소보다 적게 왔다"라 이 그림의 관심 밖이다)
  const lo = 1;
  const hi = Math.max(surges[surges.length - 1], surge, GRADE_CUT.severe) * 1.02;
  const x = (v: number) => PAD + ((v - lo) / (hi - lo)) * (W - PAD * 2);

  const cut = (v: number, label: string) => (
    <g key={label}>
      <line x1={x(v)} y1={20} x2={x(v)} y2={BASE + 4} className="peer-cut" />
      <text x={x(v)} y={16} className="peer-cutlabel" textAnchor="middle">
        {label}
      </text>
    </g>
  );

  return (
    <figure className="peer-strip">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`같은 규모 축제 ${peer.n}곳의 배수 분포에서 이 기획안의 위치`}>
        {/* 등급 컷 — 어디를 넘으면 경보인지가 그림에 있어야 한다 */}
        {cut(GRADE_CUT.caution, "주의 1.5")}
        {cut(GRADE_CUT.severe, "심각 2.0")}

        {/* 또래 하나하나. 겹쳐도 그대로 둔다 — 겹친 곳이 곧 밀집이다 */}
        {surges.map((s, i) => (
          <line
            key={i}
            x1={x(s)}
            y1={BASE - 16}
            x2={x(s)}
            y2={BASE}
            className="peer-tick"
          />
        ))}

        {/* 바닥선 */}
        <line x1={PAD} y1={BASE} x2={W - PAD} y2={BASE} className="peer-axis" />

        {/* 또래 중앙값 */}
        <line
          x1={x(peer.median)}
          y1={BASE}
          x2={x(peer.median)}
          y2={BASE + 5}
          className="peer-axis"
        />
        <text x={x(peer.median)} y={BASE + 15} className="peer-tip" textAnchor="middle">
          또래 중앙 {peer.median.toFixed(2)}
        </text>

        {/* 이 기획안 — 유일하게 굵고 붉다 */}
        <g className="peer-me">
          <line x1={x(surge)} y1={BASE - 26} x2={x(surge)} y2={BASE} />
          <circle cx={x(surge)} cy={BASE - 29} r={3} />
        </g>
        <text
          x={Math.min(Math.max(x(surge), 26), W - 26)}
          y={BASE - 34}
          className="peer-melabel"
          textAnchor="middle"
        >
          이 기획안 {surge.toFixed(2)}
        </text>
      </svg>
      <figcaption>
        같은 규모(인구 {peer.label}) 축제 <strong>{peer.n}곳</strong>의 실측 배수와
        이 기획안의 자리 — <strong>상위 {peer.topPercent}%</strong>.
        눈금 하나가 축제 한 곳이다.
      </figcaption>
    </figure>
  );
}
