// 대비 진단서 — A4 한 장.
//
// 이 제품이 팔리는 경로는 하나다: **"왜 물량을 3배로 잡았습니까"에 댈 근거.**
// 그런데 지금까지 그 근거는 전부 화면에만 있었다. 결재는 종이로 올라간다.
//
// PDF 라이브러리를 넣지 않는다. 브라우저 인쇄가 이미 PDF 를 만들 줄 알고,
// 의존성 하나가 늘면 심사에서 "왜 필요한가"를 설명해야 한다. 여기서는
// 서버가 A4 한 장을 렌더하고 사람이 Ctrl+P 를 누른다 — 자바스크립트 0.

import Link from "next/link";
import { getEntry, latestVenueForEntry } from "@/lib/store";
import { DEMO_ENTRY_ID, DEMO_LABEL } from "@/lib/demo";
import { coordsOf, findSimilar } from "@/lib/match";
import { grade } from "@/lib/grade";
import { LOO_PUBLISHED, WITHIN_BAND, pct } from "@/lib/eval";
import { capacityBand, localBaseline, ratioText } from "@/lib/capacity";
import { scanSeason } from "@/lib/season";
import { scanVenue } from "@/lib/scan";
import { VENUE_KIND_NAME } from "@/lib/venue";
import {
  competitionHeadline,
  competitorsNear,
  dayLabel,
  monthWindow,
  NEARBY_RADIUS_KM,
  type Competitor,
} from "@/lib/overlap";
import { hasTourKey, searchFestivalsInPeriod } from "@/lib/tourapi";
import {
  ACCESSIBILITY_LABEL,
  DATA_SOURCE,
  DISTANCE_THRESHOLD,
  THEME_NAME,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 진단서에 이름을 적는 경쟁 축제 수.
 *
 * A4 한 장이 이 문서의 규격이라 목록 길이가 곧 장수다. 그리고 이 목록만
 * 길이에 상한이 없다 — 그 달에 반경 50km 안에서 열린 축제가 열 곳이면 열
 * 줄이 된다. 여섯 곳까지 싣던 것을 셋으로 줄이고, 자른 만큼은 "외 N곳"으로
 * 적는다. 실측: 이 상한에서 진단서가 최악일 때 269mm, A4 가용은 273mm.
 */
const REPORT_RIVALS = 3;

/** 문서에 찍는 시각. 서버는 UTC 라 그대로 두면 9시간 틀린 진단서가 나간다 */
function 발행시각(): string {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "long",
    timeStyle: "short",
  });
}

/**
 * 이 진단이 저장된 시각.
 *
 * 지금까지 종이에는 **인쇄한 순간**만 찍혔다. 그래서 시연용 견본을 인쇄해도
 * 오늘 날짜가 박혀 방금 낸 진단처럼 보였다 — `lib/demo.ts` 가 저장 시각을
 * 굳이 고정해 둔 이유가 바로 그것이었는데, 진단서는 그 값을 안 썼다.
 */
function 진단시각(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const params = await searchParams;
  const entryId = typeof params.entry === "string" ? params.entry : null;

  const entry = entryId ? await getEntry(entryId).catch(() => null) : null;
  if (entry === null) {
    return (
      <div className="sheet">
        <main>
          <h1>진단서를 만들 수 없습니다</h1>
          <p>
            진단 이력에서 진단을 하나 고른 뒤 다시 눌러 주세요.{" "}
            <Link href="/">진단으로 돌아가기</Link>
          </p>
        </main>
      </div>
    );
  }

  const result = findSimilar({
    sido: entry.sido,
    sigungu: entry.sigungu,
    month: Number(entry.month),
    themeCode: Number(entry.theme),
    populationManMyeong: Number(entry.population),
    accessibility: Number(entry.accessibility),
  });
  const g = grade(result);

  // 같은 시기 경쟁 — 공사 OpenAPI. 죽어도 진단서는 나가야 한다
  const 창 = monthWindow(Number(entry.month), new Date());
  let 경쟁: Competitor[] = [];
  let 경쟁실패 = false;
  if (hasTourKey() && !result.invalid) {
    try {
      경쟁 = competitorsNear(
        coordsOf(entry.sido, entry.sigungu),
        await searchFestivalsInPeriod(창.start, 창.end),
      );
    } catch {
      경쟁실패 = true;
    }
  }

  // 진단서에 이름을 적을 경쟁 축제.
  //
  // `competitorsNear` 는 **거리순**으로 주는데 `competitionHeadline` 은
  // **배수가 가장 큰** 곳을 지목한다. 가까운 순으로 잘라 실으면 헤드라인이
  // "그중 하나는 평소의 2.38배를 불렀습니다"라고 말해 놓고 그 축제가 목록에
  // 없는 종이가 나간다. 지목된 곳을 맨 앞으로 당겨 반드시 싣는다.
  const 지목 = 경쟁.reduce<Competitor | null>(
    (a, c) => (c.surge !== null && (a === null || c.surge > a.surge!) ? c : a),
    null,
  );
  const 실을경쟁 = [
    ...(지목 ? [지목] : []),
    ...경쟁.filter((c) => c !== 지목),
  ].slice(0, REPORT_RIVALS);

  // 도면이 있으면 그 배치의 쏠림 스캔까지 한 장에 담는다.
  // 배수는 grade 가 이미 낸 것을 쓴다 — 여기서 중앙값을 다시 세면 짝수 개일 때
  // 위/아래가 갈려 **같은 문서 안에서 등급과 스캔이 다른 배수**를 쓰게 된다
  // (grade.ts 는 경보를 보수적으로 내려고 위쪽 값을 쓴다).
  const 도면 = await latestVenueForEntry(entry.id).catch(() => null);
  const 배수 = g.medianSurge;
  const scan = 도면 ? scanVenue(도면.venue, 배수) : null;

  // 감당 범위 — 같은 시군구·같은 달의 실측을 기준으로 몇 배 구간인지
  const 기준 = localBaseline(
    { sido: entry.sido, sigungu: entry.sigungu, month: Number(entry.month) },
    result.matched,
  );
  const 감당 = capacityBand(
    g,
    result.matched.map((m) => m.festival.actualVisitSurge),
    기준?.surge ?? null,
  );

  // 시기 민감도 — A4 한 장이라 12행을 다 못 싣는다. 최저 한 달·기획안의 달·
  // 최고 한 달만 싣는다(전에는 최저·최고를 두 달씩 실어 다섯 행이었다).
  // 같은 달이 여러 역할이면 중복을 걷고 달 순서로 되돌린다
  const 시기 = result.invalid
    ? null
    : scanSeason({
        sido: entry.sido,
        sigungu: entry.sigungu,
        month: Number(entry.month),
        themeCode: Number(entry.theme),
        populationManMyeong: Number(entry.population),
        accessibility: Number(entry.accessibility),
      });
  const 시기요약 = 시기
    ? [
        ...new Set([
          ...시기.quietest.slice(0, 1),
          시기.planMonth,
          ...시기.busiest.slice(0, 1),
        ]),
      ]
        .sort((a, b) => a - b)
        .map((mm) => 시기.months.find((x) => x.month === mm)!)
        .filter(Boolean)
    : [];
  const 이름 = (id: string) =>
    도면?.venue.items.find((it) => it.id === id)?.name ?? id;

  return (
    <div className="report">
      <p className="no-print report-hint">
        브라우저 인쇄(Ctrl+P)에서 <strong>대상을 PDF로 저장</strong>하면 A4 한
        장으로 나옵니다. <Link href={`/?entry=${entry.id}#twin`}>진단으로 돌아가기</Link>
      </p>

      <header className="report-head">
        <h1>축제 위험 경보 진단서</h1>
        {/* 인쇄본이 손을 떠나면 이 표시가 유일한 구분이다. 종이에도 남긴다 */}
        {entry.id === DEMO_ENTRY_ID && (
          <p className="report-demo">
            <strong>{DEMO_LABEL}</strong> · 예시 기획안으로 만든 견본입니다.
            결재에 쓸 문서가 아닙니다.
          </p>
        )}
        <p className="num">
          {entry.sido} {entry.sigungu} · {entry.month}월 ·{" "}
          {THEME_NAME[Number(entry.theme)] ?? entry.theme} · 인구 {entry.population}만
          · 접근성{" "}
          {ACCESSIBILITY_LABEL[Number(entry.accessibility)] ?? entry.accessibility}
        </p>
      </header>

      {result.invalid ? (
        <section>
          <h2>판정할 수 없습니다</h2>
          <ul>
            {result.invalid.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="report-verdict">
            <p className="alert" data-level={g.level}>
              {g.level === "심각" || g.level === "주의"
                ? `⚠ 경보: ${g.level}`
                : g.level === "근거없음"
                  ? "위험 근거 못 찾음"
                  : "비교 대상 없음"}
            </p>
            <p className="headline">{g.headline}</p>
          </section>

          <section>
            <h2>근거 1 — 닮은 과거 축제의 실측</h2>
            {result.matched.length === 0 ? (
              <p className="note">
                비교할 만한 과거 축제를 찾지 못했습니다 — 찾아본 범위:{" "}
                {result.searchedScope}
              </p>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>축제</th>
                    <th>지역</th>
                    <th>연도</th>
                    <th>평소 대비</th>
                    <th>닮은 점</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matched.map((m) => (
                    <tr key={m.festival.id}>
                      <td>{m.festival.name}</td>
                      <td>
                        {m.festival.sido} {m.festival.sigungu}
                      </td>
                      <td className="num">{m.year}</td>
                      <td className="num">
                        {m.festival.actualVisitSurge.toFixed(2)}배
                      </td>
                      <td>{m.axes.map((a) => a.detail).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>근거 2 — 같은 시기 경쟁</h2>
            {!hasTourKey() ? (
              <p className="note">조회하지 않았습니다</p>
            ) : 경쟁실패 ? (
              <p className="note">
                한국관광공사 OpenAPI 조회에 실패했습니다 — 이 항목은 비어 있습니다
              </p>
            ) : (
              <>
                <p>{competitionHeadline(창.year, Number(entry.month), 경쟁)}</p>
                {경쟁.length > 0 && (
                  <ul className="report-list">
                    {실을경쟁.map((c) => (
                      <li key={c.contentId}>
                        {c.title} · {dayLabel(c.startDate)}~{dayLabel(c.endDate)} ·{" "}
                        {c.distanceKm.toFixed(0)}km
                        {c.surge !== null && ` · 평소 ${c.surge.toFixed(2)}배`}
                      </li>
                    ))}
                    {/* 자르고 말 안 하면 "네 곳뿐"으로 읽힌다. 몇 곳을 뺐는지 적는다 */}
                    {경쟁.length > 실을경쟁.length && (
                      <li>
                        외 {경쟁.length - 실을경쟁.length}곳 (화면에서 전부 볼 수 있습니다)
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
          </section>

          <section>
            <h2>근거 3 — 행사장 배치의 쏠림</h2>
            {scan === null ? (
              <p className="note">
                이 진단에 연결된 도면이 아직 없습니다 — 행사장 도면을 그리면 배치의
                병목까지 이 진단서에 들어갑니다
              </p>
            ) : scan.blocked ? (
              <p className="note">{scan.blocked}</p>
            ) : scan.top.length === 0 ? (
              <p>
                배치한 {도면?.venue.items.length ?? 0}개 중 부하가 넘치는 곳은
                없었습니다
              </p>
            ) : (
              <>
                <p>
                  {/* JSX 는 줄바꿈 앞의 공백을 지운다 — 안 붙이면 "다음3곳" 이 된다 */}
                  쌍둥이 실측 배수({배수?.toFixed(2)}배)로 스캔한 결과, 다음{" "}
                  {scan.top.length}곳이 넘칩니다.
                </p>
                <ul className="report-list">
                  {scan.top.map((id) => {
                    const load = scan.loads.find((l) => l.id === id);
                    return (
                      <li key={id}>
                        {이름(id)} — 부하 {load?.load.toFixed(1)}배 · 인력을 늘리거나
                        나누세요
                      </li>
                    );
                  })}
                  {scan.invasions.length > 0 && (
                    <li>
                      대기열이 통로를 침범하는 곳 {scan.invasions.length}건 —
                      통로 폭을 넓히거나 대기 공간을 따로 두세요
                    </li>
                  )}
                  {scan.outside.length > 0 && (
                    <li>
                      부지 경계 밖에 놓인 것 {scan.outside.length}건 —{" "}
                      {scan.outside.map(이름).join(" · ")}
                    </li>
                  )}
                </ul>
                {도면?.venue.mPerPx != null && (
                  <p className="note">
                    {scan.siteAreaM2 !== null &&
                      `부지 ${Math.round(scan.siteAreaM2).toLocaleString()}㎡ · `}
                    도면 축척 1px = {도면.venue.mPerPx.toFixed(3)}m · 도면 폭 ≈{" "}
                    {Math.round(도면.venue.width * 도면.venue.mPerPx)}m
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* 근거 넷 — 시기 민감도. A4 한 장을 지키려고 12행을 다 싣지 않고
          최저·기획안의 달·최고만 싣는다. 제목이 "N월에 열면"이 아닌 이유는
          lib/season.ts 머리말 */}
      {시기 && 시기.months.length > 0 && (
        <section className="report-season">
          <h2>근거 4 — 시기 민감도</h2>
          {/* 잰 달이 하나도 없으면 최저·최고를 고르지 않는다 (lib/season.ts) */}
          {시기.quietest.length === 0 ? (
            <p className="num">
              달을 12번 바꿔 물어도 닮은 축제를 찾지 못했습니다. 시기를 견줄
              근거가 없습니다.
            </p>
          ) : 시기.flat ? (
            <p className="num">
              달을 바꿔도 쌍둥이 배수 폭이 {시기.spread?.toFixed(2)}배 안에
              머뭅니다 — 이 조건에서 시기는 갈리지 않습니다.
            </p>
          ) : (
            <>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>물은 달</th>
                    <th>쌍둥이</th>
                    <th>배수</th>
                    <th>중앙</th>
                    <th>등급</th>
                    <th>쌍둥이가 실제로 열린 달</th>
                  </tr>
                </thead>
                <tbody>
                  {시기요약.map((m) => (
                    <tr key={m.month}>
                      <td className="num">
                        {m.month}월{m.month === 시기.planMonth ? " (기획안)" : ""}
                      </td>
                      <td className="num">{m.matched}곳</td>
                      <td className="num">
                        {m.loSurge === null
                          ? "—"
                          : `${m.loSurge.toFixed(2)}~${m.hiSurge!.toFixed(2)}`}
                      </td>
                      <td className="num">{m.medianSurge?.toFixed(2) ?? "—"}</td>
                      <td>{m.level}</td>
                      <td className="num">
                        {m.twinMonths.map((tm) => `${tm}월`).join(" ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {/* A4 한 장을 지키려고 문장을 줄였다. 남긴 두 가지는 못 뺀다 —
              이 표가 무엇을 재는지, 그리고 요청월과 실제 개최월이 얼마나
              어긋나는지 (docs/DECISIONS.md 의 3번) */}
          {시기.quietest.length > 0 && (
          <p className="num">
            이 표가 재는 것은 시기의 효과가 아니라 매칭이 시기에 얼마나
            흔들리는가입니다.{" "}
            {시기.measured < 시기.months.length &&
              `12달 중 ${시기.measured}달만 잴 수 있었고, `}
            물은 달에 실제로 열린 쌍둥이는{" "}
            {Math.round((시기.monthMatchRate ?? 0) * 100)}%뿐이라 &ldquo;그 달로
            옮기면 이렇게 된다&rdquo;로 읽으면 안 됩니다.
            {!시기.robust && " 쌍둥이를 5·7곳으로 잡으면 일부 달의 등급이 바뀝니다."}
          </p>
          )}
        </section>
      )}

      {/* 근거 다섯 — 결론. "왜 물량을 3배로 잡았습니까"에 대한 답이 여기 있다.
          개수가 아니라 구간을 낸다 (lib/capacity.ts 머리말) */}
      {감당 && (
        <section className="report-capacity">
          <h2>근거 5 — 감당 범위</h2>
          {감당.baseSurge !== null && 기준 ? (
            <>
              <p className="num">
                {기준.year}년 물량이 감당한 수준의{" "}
                <strong>최대 {ratioText(감당.hi!)}</strong>까지 보십시오. 기준으로
                삼은 것은 {기준.name}({기준.year}년)의 {기준.surge.toFixed(2)}배이고,
                닮은 축제 {result.matched.length}곳은{" "}
                {감당.twinLo.toFixed(2)}~{감당.twinHi.toFixed(2)}배였습니다.
              </p>
              {/* 하한은 잰 값이 아니라 항등식이다 (lib/capacity.ts 의 floored) */}
              <p className="num">
                하한은 언제나 1배입니다. 기준으로 삼는 축제를 닮은 축제 안에서
                고르기 때문에 계산상 그렇게 됩니다. 잰 값이 아닙니다.
              </p>
              <p className="num">
                같은 시군구에서 같은 달에 열린 축제를 기준으로 잡았습니다. 품목별 개수는
                내지 않습니다. 그해 대장의 수량에 이 배수를 곱하는 것은 담당 부서의
                판단입니다.
              </p>
            </>
          ) : (
            <p className="num">
              닮은 축제 3곳은 평소의{" "}
              <strong>
                {감당.twinLo.toFixed(2)}~{감당.twinHi.toFixed(2)}배
              </strong>
              였습니다. 같은 시군구·같은 달에 열린 축제의 실측이 619건에 없어
              작년 대비 몇 배인지는 내지 못했습니다 — 없는 것이 아니라 비교
              기준을 못 찾은 것입니다.
            </p>
          )}
        </section>
      )}

      {/* 결재자가 반드시 묻는 것 — "그게 맞는 건 어떻게 압니까".
          근거 세 종류를 다 낸 뒤에 이 방식 자체의 적중률을 낸다 */}
      <section className="report-selfcheck">
        <h2>이 방식은 얼마나 맞는가 — 619건 자기검증</h2>
        <p className="num">
          619건을 하나씩 빼고 그 축제를 다시 맞혀 봤습니다. 맞힐 때 그 축제 자신은
          뺐습니다. 위험한 축제를 무작위의{" "}
          <strong>{LOO_PUBLISHED.lift.toFixed(2)}배</strong>로 집어냈습니다.
          정밀도 {pct(LOO_PUBLISHED.precision)}, 재현율 {pct(LOO_PUBLISHED.recall)},
          실제 위험군 비율 {pct(LOO_PUBLISHED.baseRate)}. 맞힌 배수와 실제 배수의
          차이는 중앙값 {LOO_PUBLISHED.medianAbsErr.toFixed(2)}배이고{" "}
          {pct(LOO_PUBLISHED.withinRatio)}가 ±{WITHIN_BAND}배 안에 들었습니다.
        </p>
        <p className="num">
          재현율이 {pct(LOO_PUBLISHED.recall)}이니 절반 가까이는 놓칩니다.
          경보이지 보증이 아닙니다.
          {/* 종이는 자리가 비싸다. 화면에는 같은 뜻의 긴 문장이 있다 */}{" "}
          가중치와 임계값도 이 619건으로 골랐습니다(별도 시험 표본 없음).
        </p>
      </section>

      <section className="report-limits">
        <h2>이 진단서가 말하지 않는 것</h2>
        <ul className="report-list">
          <li>
            <strong>방문객 수를 예측하지 않습니다.</strong> 화면과 이 문서의 숫자는
            모두 과거 축제가 실제로 겪은 <strong>평소 대비 배수</strong>입니다.
          </li>
          <li>
            <strong>&ldquo;안전하다&rdquo;고 말하지 않습니다.</strong> 근거를 못 찾은
            것과 안전한 것은 다릅니다.
          </li>
          <li>
            닮음의 임계값은 {DISTANCE_THRESHOLD} 입니다 — 619건 leave-one-out
            실측에서 진짜 축제의 3번째 이웃 거리가 최대 0.2674 였습니다. 그 밖은
            실측이 보증하지 않아 비교하지 않습니다.
          </li>
          <li>
            {VENUE_KIND_NAME.booth} 부하는 상대 지수이며 대기 인원 예측이 아닙니다.
          </li>
        </ul>
      </section>

      <footer className="report-foot">
        {/* 머리말이 잘려도 종이가 견본임을 말하게 한다 */}
        {entry.id === DEMO_ENTRY_ID && (
          <span className="report-foot-demo">{DEMO_LABEL} · 결재용 아님</span>
        )}
        <span>진단 {진단시각(entry.savedAt)}</span>
        <span>인쇄 {발행시각()}</span>
        <span>출처 {DATA_SOURCE}</span>
        <span>같은 시기 경쟁: 한국관광공사 OpenAPI 실시간 조회 · 반경 {NEARBY_RADIUS_KM}km</span>
        <span>축제 위험 경보 · 전국 619개 축제 실측</span>
      </footer>
    </div>
  );
}
