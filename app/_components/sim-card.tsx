// 시뮬레이션 요약 카드 — 판정 결과에 먼저 보이는 "어디가 막히는가" (2026-09-12 M7a, 사용자 지시 7).
// 값은 scripts/sim-precompute.mjs 가 고정 설정(SIM_CARD_SETTINGS)으로 미리 돌린 data/sim/gunpo_base.json 에서 온다.
// 서버 렌더, 자바스크립트 0. 밀도 숫자는 출처(엔진·설정)를 단 셀로만 나간다 — 판정 화면의 "출처 셀 밖 명 수 0건" 규율.
// 도면은 군포 한 곳뿐이라 다른 축제의 판정에서는 "군포 실도면 예시"라고 밝힌다.

import Link from "next/link";
import base from "@/data/sim/gunpo_base.json";
import { DENSITY_CAP, SIM_CARD_SETTINGS } from "@/lib/simcard";

const card = base.card;
const S = SIM_CARD_SETTINGS;
const SRC = `lib/sim/sim.js · 시드 ${S.seed} · 점 하나 ${S.personsPerAgent}명 · ${S.minutes}분 · 산출 ${base.builtAt}`;

function Dens({ v }: { v: number }) {
  return (
    <span className="num" data-num="" data-origin="derived" data-source-api="시뮬레이션(가정)" data-source-value={String(v)} data-source-period={SRC} data-source-date={base.builtAt} title={`밀도(명/㎡) · ${SRC}`}>
      {v.toFixed(2)}명/㎡
    </span>
  );
}

export function SimCardBlock({ isGunpo }: { isGunpo: boolean }) {
  const over = card.peak.density > DENSITY_CAP;
  return (
    <section className="sim-card" aria-labelledby="sim-card-h">
      <h2 id="sim-card-h">시뮬레이션 요약{!isGunpo && " — 군포 실도면 예시"}</h2>
      {over ? (
        <p className="alert" data-label="근거 없음">
          미리 돌린 결과가 물리 상한을 넘어 카드를 내지 않습니다. <Link href="/venue">시뮬레이션 화면에서 직접 돌려 주세요 →</Link>
        </p>
      ) : (
        <>
          <p>
            군포철쭉축제 실도면(부스 114·출입구 4)에서 개장 뒤 {S.minutes}분을 미리 돌렸습니다. 최대 밀도 <Dens v={card.peak.density} /> ({card.peak.where}).{" "}
            {card.secAbove5 >= 60
              ? `행안부 "위험" 등급이 ${Math.round(card.secAbove5)}초 이어진 자리가 있습니다${card.limitWhere ? `: ${card.limitWhere}` : ""}. 이 가정에서는 배치를 바꿔야 합니다.`
              : card.hotspots.length > 0
                ? `행안부 "주의" 등급 이상이 잠시 나타난 자리 ${card.hotspots.length}곳(${card.hotspots.map((h) => h.where).join(" · ")}). "위험" 등급이 이어진 자리는 없습니다.`
                : `"주의" 등급 이상이 지속된 자리는 없습니다.`}{" "}
            가정 안에서의 결과이고 안전하다는 뜻이 아닙니다.
          </p>
          <p className="note">
            가정: 시간당 유입 {S.inflowPerHour.map((n) => n.toLocaleString("ko-KR")).join(" → ")} (출처 없음, 순수 가정) · 1인 {S.visitsPerPerson}곳 방문 · 관람 {S.dwellSecMean}초 · 점 하나 = {S.personsPerAgent}. 밀도 등급 경계 3·5는 행안부 다중운집인파사고 안전관리 가이드라인(2024.9).{" "}
            <Link href="/venue">시뮬레이션에서 배치·유입을 바꿔 직접 돌리기 →</Link>
          </p>
        </>
      )}
    </section>
  );
}
