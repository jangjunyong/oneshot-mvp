// 닮은 축제 카드 넷.
//
// 진단 화면(`app/page.tsx`)이 쓰는 표시 전용 조각. props 만 보고 그리며
// 요청·저장소·모델을 모르므로 화면 파일 밖에 둘 수 있다.

import Link from "next/link";
import type { MatchedFestival } from "@/lib/types";

/**
 * 지도 아래 넉 장 — 감당 범위의 **기준** 하나와 **닮은 축제** 셋.
 *
 * 왜 여기 있나. 오른쪽 본문이 왼쪽 지도보다 훨씬 길어 지도 아래가 늘 비어
 * 있었다(2026-08-30 사용자 지적). 닮은 축제 목록은 원래 오른쪽에 한 줄씩
 * 있었는데, 그건 지도의 핀 1·2·3 을 설명하는 것이라 지도 옆에 있는 편이 맞다.
 *
 * 기준 카드는 겹칠 수 있다. `localBaseline` 은 **닮은 축제 셋 중에서** 같은
 * 시군구·같은 달인 것을 고르므로, 기준이 있으면 그것은 반드시 셋 중 하나다.
 * 숨기지 않고 "닮은 축제 ①이기도 합니다"라고 카드에 적는다 — 감당 범위가
 * 무엇에 대고 잰 값인지는 닮음과 다른 질문이라 칸을 따로 둘 값어치가 있다.
 */
export function TwinCards({
  entryId,
  matched,
  baseline,
  selectedPin,
  scope,
  capacityShown,
}: {
  entryId: string;
  matched: MatchedFestival[];
  baseline: { id: string; name: string; year: string; surge: number } | null;
  selectedPin: string | null;
  scope: string;
  /** 오른쪽에 감당 범위 블록이 실제로 서는가. 근거없음 등급이면 안 선다 */
  capacityShown: boolean;
}) {
  if (matched.length === 0) return null;

  const 배수폭 = matched.map((m) => m.festival.actualVisitSurge);

  return (
    <div className="twin-cards">
      {matched.map((m, i) => {
        const 기준인가 = baseline?.id === m.festival.id;
        return (
          <Link
            key={m.festival.id}
            className="twin-card"
            data-role={기준인가 ? "base" : undefined}
            data-current={m.festival.id === selectedPin ? "1" : undefined}
            href={`/?entry=${entryId}&pin=${m.festival.id}#twin`}
          >
            <p className="twin-card-label">
              <strong>{i + 1}</strong> 닮은 축제
            </p>
            <p className="twin-card-name">{m.festival.name}</p>
            <p className="twin-card-meta num">
              {m.festival.sido} {m.festival.sigungu} · {m.year}년
            </p>
            <p className="twin-card-surge num">
              평소 대비 <strong>{m.festival.actualVisitSurge.toFixed(2)}배</strong>
            </p>
            {/* 기준은 언제나 이 셋 중 하나다. 칸을 따로 세우면 같은 축제가 두 번
                나오므로 그 카드에 표를 얹는다 (2026-08-30 사용자 지시) */}
            {기준인가 && (
              <p className="twin-card-base">
                같은 시군구, 같은 달
                {capacityShown ? " · 감당 범위의 기준" : ""}
              </p>
            )}
            <p className="twin-card-foot">
              {m.festival.id === selectedPin ? "지금 펼친 축제" : "눌러서 근거 보기"}
            </p>
          </Link>
        );
      })}

      {/* 넷째 칸 — 셋을 다 채우고 남는 자리.
          기준을 못 찾았으면 그 사실이 급하다(오른쪽 감당 범위의 숫자가 어디서
          왔는지 담당자가 알아야 한다). 찾았으면 그 자리는 카드에 얹혔으니,
          화면 어디에도 없던 값을 낸다 — 이 셋이 얼마나 닮았는가. */}
      <div className="twin-card" data-role="how">
        {baseline === null && capacityShown ? (
          <>
            <p className="twin-card-label">감당 범위의 기준</p>
            <p className="twin-card-name">못 찾았습니다</p>
            <p className="twin-card-meta">
              같은 시군구·같은 달의 축제가 619건에 없습니다
            </p>
            <p className="twin-card-surge num">
              대신 닮은 축제 {matched.length}곳의{" "}
              <strong>
                {Math.min(...배수폭).toFixed(2)}~{Math.max(...배수폭).toFixed(2)}배
              </strong>
            </p>
            <p className="twin-card-foot">없는 것이 아니라 못 찾은 것입니다</p>
          </>
        ) : (
          <>
            <p className="twin-card-label">어떻게 골랐나</p>
            <p className="twin-card-name">{scope}에서 {matched.length}곳</p>
            <p className="twin-card-meta">
              지역·인구·접근성·시기·테마 다섯 축으로 쟀습니다
            </p>
            {/* 닮음 거리(0.09 같은 값)를 여기 내던 것을 걷어냈다.
                담당자가 그 숫자로 할 수 있는 일이 없다 — 결재에서
                "닮음 거리가 0.09였습니다"라고 답할 수 없고, 척도가 없으면
                0.11 이 0.27 의 절반이라는 것도 뜻을 못 만든다.
                불문율 3 이 금지한 "유사도 점수만 던지기"가 바로 이것이고,
                왜 닮았는지는 아래 details 와 핀 카드가 축별로 낸다 */}
            <p className="twin-card-foot">
              다섯 축이 충분히 가깝지 않으면 쓰지 않습니다. 억지로 가장 가까운
              것을 내놓지 않습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
