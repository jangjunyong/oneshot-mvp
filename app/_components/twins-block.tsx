// 닮은 과거 축제(보조 근거) — /check 판정 아래 한 블록 (2026-09-12 M3a-2, 사용자 지시 7 "판정과 진단을 합쳐라").
//
// 옛 `/`(진단 이력) 화면의 지도·카드·등급을 그대로 옮겼다. 입력은 저장소가 아니라 판정 URL 이다 —
// 시도·시군구·월(start)은 판정 파라미터에서, 인구는 행안부 표에서, 테마·접근성은 주석 키 `theme`·`acc` 에서.
// 그래서 같은 링크면 같은 블록이고(결정론), 판정 블록(#verdict) 밖에 서며, 모델 호출 0.
//
// 열어 두는 것: 지도 + 등급 한 줄 + 카드. 접는 것: 감당 범위 · 왜 닮았나 · 달을 바꾸면 · 자기검증 · 출처 · 3D.
// 같은 시기 경쟁(TourAPI 실시간)은 옮기지 않았다 — 직렬 8초 호출이 하나 더 생기고, 귀속 경고가 같은 이야기를 한다.

import Link from "next/link";
import { coordsOf, findSimilar } from "@/lib/match";
import { grade, levelLabel } from "@/lib/grade";
import { capacityBand, localBaseline, ratioText } from "@/lib/capacity";
import { peerContext, peerSurges } from "@/lib/peer";
import { scanSeason } from "@/lib/season";
import { LOO_PUBLISHED, WITHIN_BAND, pct } from "@/lib/eval";
import { ACCESSIBILITY_LABEL, DATA_SOURCE, THEME_NAME, type PlanInput } from "@/lib/types";
import { PeerStrip } from "@/app/peer-strip";
import { TwinMap } from "@/app/twin-map";
import { TwinMap3DShell } from "@/app/twin-map-3d-shell";
import { TwinCards } from "@/app/_components/twin-cards";
import { SeasonTable } from "@/app/_components/season-table";

export interface TwinsBlockProps {
  sido: string;
  /** 619건 표기의 시군구(시 단위). 자치구가 오면 호출부가 상위 시로 바꿔 준다 */
  sigungu: string;
  /** 기획 기간의 달. 기간이 없으면 null */
  month: number | null;
  /** 만 명. 담당자 입력 → 행안부 표 → null */
  populationManMyeong: number | null;
  theme: number | null;
  acc: number | null;
  /** 지도에서 고른 핀(축제 id) */
  pin: string | null;
  /** 테마·접근성 고르기 링크 — 현재 판정 URL 을 보존한 채 한 키만 바꾼다 */
  chooseHref: (patch: { theme?: number; acc?: number }) => string;
  /** 핀·카드 링크 */
  pinHref: (festivalId: string) => string;
  /** 3D 기둥 클릭 주소 (문자열 둘 — 클라이언트 경계) */
  pinHrefBase: string;
  pinHrefSuffix: string;
  /** 견본이면 테마·접근성이 가정값이라고 말한다 */
  isDemo: boolean;
  vworldKey: string | null;
}

export function TwinsBlock(p: TwinsBlockProps) {
  const ready = p.month !== null && p.populationManMyeong !== null && p.theme !== null && p.acc !== null;

  return (
    <section id="twins" className="twins section" aria-labelledby="twins-h">
      <h2 id="twins-h">닮은 과거 축제</h2>
      <p className="note">
        전국 619개 축제에서 지역·인구·접근성·시기·테마 다섯 축으로 고른 3곳. 판정의 보조 근거이고, 배수는 전부 실측입니다.
      </p>

      {/* 테마·접근성은 문서에서만 온다. GET 폼이 아니라 링크다 — 폼은 판정 쿼리를 통째로 갈아 견본으로 튄다 */}
      <p className="twin-choose">
        <span className="twin-choose-label">테마{p.isDemo && p.theme !== null ? " (견본 가정)" : ""}</span>
        {Object.entries(THEME_NAME).map(([k, v]) => (
          <Link key={k} href={p.chooseHref({ theme: Number(k) })} data-on={Number(k) === p.theme ? "1" : undefined}>
            {v}
          </Link>
        ))}
      </p>
      <p className="twin-choose">
        <span className="twin-choose-label">접근성{p.isDemo && p.acc !== null ? " (견본 가정)" : ""}</span>
        {Object.entries(ACCESSIBILITY_LABEL).map(([k, v]) => (
          <Link key={k} href={p.chooseHref({ acc: Number(k) })} data-on={Number(k) === p.acc ? "1" : undefined}>
            {v}
          </Link>
        ))}
      </p>

      {!ready && (
        <p className="note">
          {p.month === null && "기획 기간을 적으면 개최 월이 정해집니다. "}
          {p.populationManMyeong === null && "지역 인구가 없어 또래를 못 고릅니다. 위 폼의 지역 인구를 적어 주세요. "}
          {(p.theme === null || p.acc === null) && "테마와 접근성을 고르면 닮은 축제가 섭니다."}
        </p>
      )}

      {ready && <TwinsBody {...p} />}
    </section>
  );
}

function TwinsBody(p: TwinsBlockProps) {
  const input: PlanInput = {
    sido: p.sido,
    sigungu: p.sigungu,
    month: p.month!,
    themeCode: p.theme!,
    populationManMyeong: p.populationManMyeong!,
    accessibility: p.acc!,
  };
  const result = findSimilar(input);
  const g = grade(result);

  if (result.invalid) {
    return (
      <div className="twin-detail">
        <p className="alert" data-level="심각">입력을 확인해 주세요</p>
        <ul>
          {result.invalid.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    );
  }

  const origin = coordsOf(p.sido, p.sigungu);
  const 기준 = localBaseline(input, result.matched);
  const surges = result.matched.map((m) => m.festival.actualVisitSurge);
  const 범위 = capacityBand(g, surges, 기준?.surge ?? null);
  const 핀 = result.matched.find((m) => m.festival.id === p.pin) ?? null;
  const 핀번호 = 핀 ? result.matched.indexOf(핀) + 1 : 0;
  const 또래 = g.medianSurge !== null ? peerContext(input.populationManMyeong, g.medianSurge) : null;

  return (
    <div className="twin-layout">
      <div className="twin-left">
        <TwinMap matched={result.matched} origin={origin} pinHref={p.pinHref} selectedPin={핀?.festival.id ?? null} scope={result.searchedScope} />
        <TwinCards
          pinHref={p.pinHref}
          matched={result.matched}
          baseline={기준}
          selectedPin={핀?.festival.id ?? null}
          scope={result.searchedScope}
          capacityShown={범위 !== null}
        />
        {또래 && g.medianSurge !== null && <PeerStrip peer={또래} surges={peerSurges(input.populationManMyeong)} surge={g.medianSurge} />}
      </div>

      <div className="twin-detail">
        <p className="alert" data-level={g.level}>{levelLabel(g.level)}</p>
        <p className="headline">{g.headline}</p>
        {또래 && (
          <p className="basis num">
            배수는 축제 기간에 그 시군구를 찾은 외지인이 평소의 몇 배였나입니다. 인구 {또래.label} 지역의 축제 {또래.n}곳 중{" "}
            <strong>상위 {또래.topPercent}%</strong>, 그 중앙값은 {또래.median.toFixed(2)}배.
          </p>
        )}

        {핀 && (
          <div className="pin-card">
            <p className="num">
              <strong>{핀번호}</strong> {핀.festival.name}
            </p>
            <p>
              {핀.festival.sido} {핀.festival.sigungu} · {핀.year}년 · 평소 대비 <strong>{핀.festival.actualVisitSurge.toFixed(2)}배</strong>
            </p>
            <ul>
              {핀.axes.map((a) => (
                <li key={a.axis}>
                  {a.label}: {a.detail}
                </li>
              ))}
            </ul>
            <p>
              <Link href={p.pinHref("")}>핀 선택 해제</Link>
            </p>
          </div>
        )}

        {/* 사용자 지시 5: 결론(등급·배수) 아래 근거는 접어 둔다 */}
        <details className="selfcheck aux-detail">
          <summary>근거 더 보기 — 감당 범위 · 왜 닮았나 · 달을 바꾸면 · 자기검증 · 출처 · 3D 지도</summary>

          {범위 && (
            <div className="capacity">
              <h3>감당 범위</h3>
              {범위.baseSurge !== null && 기준 ? (
                <>
                  <p className="capacity-head num">
                    {기준.year}년 물량이 감당한 수준의 <strong>최대 {ratioText(범위.hi!)}</strong>까지
                  </p>
                  <p className="note num">
                    기준은 {기준.name}({기준.year}년) {기준.surge.toFixed(2)}배. 닮은 축제 {result.matched.length}곳은 {범위.twinLo.toFixed(2)}~
                    {범위.twinHi.toFixed(2)}배. 하한은 계산상 언제나 1배라 잰 값이 아닙니다. 품목별 개수는 내지 않습니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="capacity-head num">
                    닮은 축제 {result.matched.length}곳은 평소의 <strong>{범위.twinLo.toFixed(2)}~{범위.twinHi.toFixed(2)}배</strong>
                  </p>
                  <p className="note">같은 시군구·같은 달의 축제가 619건에 없어 작년 대비 몇 배인지는 못 냈습니다. 없는 것이 아니라 못 찾은 것입니다.</p>
                </>
              )}
            </div>
          )}

          {result.matched.length > 0 && (
            <details>
              <summary>왜 닮았나</summary>
              <ul>
                {result.matched.map((m) => (
                  <li key={m.festival.id}>
                    {m.festival.name}
                    <ul>
                      {m.axes.map((a) => (
                        <li key={a.axis}>
                          {a.label}: {a.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <SeasonTable scan={scanSeason(input)} />

          {/* "그게 맞는 건 어떻게 압니까" — 619건 leave-one-out. 한계(재현율)도 같이 */}
          <details className="selfcheck">
            <summary>이 방식은 얼마나 맞는가 — 보조 근거(619건) 자기검증</summary>
            <p className="num">
              619건을 하나씩 빼고 다시 맞혀 봤습니다. 위험한 축제를 무작위의 <strong>{LOO_PUBLISHED.lift.toFixed(2)}배</strong>로 집어냈습니다. 정밀도{" "}
              {pct(LOO_PUBLISHED.precision)}, 재현율 {pct(LOO_PUBLISHED.recall)}, 실제 위험군 비율 {pct(LOO_PUBLISHED.baseRate)}.
            </p>
            <p className="num">
              맞힌 배수와 실제 배수의 차이는 중앙값 {LOO_PUBLISHED.medianAbsErr.toFixed(2)}배, {pct(LOO_PUBLISHED.withinRatio)}가 ±{WITHIN_BAND}배 안.
            </p>
            <p className="note">
              재현율이 {pct(LOO_PUBLISHED.recall)}이니 절반 가까이는 놓칩니다. 가중치와 임계값도 이 619건으로 골라 따로 떼어 둔 시험 표본이 없습니다.
            </p>
          </details>

          {result.matched.length > 0 && (
            <TwinMap3DShell
              pins={result.matched.map((m, i) => ({
                id: m.festival.id,
                name: m.festival.name,
                lat: m.festival.lat,
                lng: m.festival.lng,
                num: i + 1,
                year: m.year,
                surge: m.festival.actualVisitSurge,
              }))}
              origin={origin}
              pinHrefBase={p.pinHrefBase}
              pinHrefSuffix={p.pinHrefSuffix}
              selectedPin={핀?.festival.id ?? null}
              vworldKey={p.vworldKey}
            />
          )}

          <p className="note">출처: {DATA_SOURCE}</p>
        </details>

        <p>
          <Link href="/venue">이 쏠림에 대비하기 · 시뮬레이션 →</Link>
        </p>
      </div>
    </div>
  );
}
