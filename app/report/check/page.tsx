// 기획안 검증 보고서 — A4 두 장 (기획/08 §2.1 `/report`).
//
// 1장: 결론(판정)·정의 불일치 문장·판정표·내년 배수 구간·보완. 결재자가 멈추는 장이다.
// 2장: 근거 표(연도별 실측)·판정에 쓴 실측 셀의 출처·정의와 임계값·단서.
// /check 와 같은 URL 을 읽고 같은 순수 함수로 같은 값을 낸다. 자바스크립트 0, 브라우저 인쇄가 PDF 를 만든다.
// 옛 진단서(app/report/page.tsx)는 그대로 둔다 — 그쪽은 619건 옛 정의 진단이다.

import Link from "next/link";
import { dailyRange, loadDaily, manifest, resolveRegion } from "@/lib/kto/daily";
import { historyOf, ymdDashed } from "@/lib/history";
import { checkQueryString, DEMO_BUDGET_SOURCE, DEMOS, parseCheckQuery } from "@/lib/checkquery";
import { checkBudget } from "@/lib/budget";
import {
  adviseVisitors,
  checkSchedule,
  checkVisitors,
  DOW_KO,
  explainVisitors,
  KT_API,
  THRESHOLDS,
  type Label,
  type Measured,
  type Segment,
} from "@/lib/verdict";
import { bandText, nextYearRange } from "@/lib/range";
import { backtestSentence, RANGE_BACKTEST_PUBLISHED } from "@/lib/backtest";
import { peerBandFor } from "@/lib/peerband";
import { populationOfCode } from "@/lib/region";
import { 긴시각 } from "@/lib/datetime";
import { Num, measured } from "@/app/_components/num";
import { hasTourKey, searchFestivalsInPeriod } from "@/lib/tourapi";
import { attributionCaveat, competitorsNear, type Competitor, type CompetitionStatus } from "@/lib/overlap";
import { coordsOf } from "@/lib/match";

export const dynamic = "force-dynamic";
export const metadata = { title: "기획안 검증 보고서 · 기획안 팩트체크" };

const LEVEL_OF: Record<Label, string | undefined> = {
  "상한 초과": "심각",
  과대: "심각",
  주의: "주의",
  과소: "주의",
  통과: undefined,
  "근거 없음": "근거없음",
  "단위 미상": "근거없음",
};
const DATE = (s: string) => (s ? ymdDashed(s) : "");
const dow = (s: string) => DOW_KO[new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))).getUTCDay()];

function Sentence({ seg, by }: { seg: Segment[]; by: Map<string, Measured> }) {
  return (
    <>
      {seg.map((s, i) => {
        if ("t" in s) return <span key={i}>{s.t}</span>;
        if ("num" in s) {
          const m = by.get(s.num);
          return m ? <Num key={i} m={m} /> : <span key={i}>(값 없음)</span>;
        }
        return (
          <span key={i} className="num">
            {s.ratio.toFixed(s.digits ?? 2)}
          </span>
        );
      })}
    </>
  );
}

export default async function CheckReportPage({ searchParams }: PageProps<"/report/check">) {
  const params = await searchParams;
  const { query: q0, isDemo, demo, errors } = parseCheckQuery(params);
  const region = q0.sido && q0.sigungu ? resolveRegion(q0.sido, q0.sigungu) : null;
  const q = region ? { ...q0, sido: region.sido, sigungu: region.name } : q0;
  const qs = checkQueryString(q, isDemo);
  const code = region?.code ?? null;

  if (errors.length > 0 || code === null) {
    return (
      <div className="report">
        <main>
          <h1>보고서를 만들 수 없습니다</h1>
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          {code === null && errors.length === 0 && (
            <p>
              &ldquo;{q.sido} {q.sigungu}&rdquo; 에 맞는 KT 시군구를 찾지 못했습니다.
            </p>
          )}
          <p>
            <Link href={`/check${qs}`}>기획안 판정으로 돌아가기</Link>
          </p>
        </main>
      </div>
    );
  }

  const rows = loadDaily(code);
  const dataRange = dailyRange(code);
  const man = manifest();
  const fetchedAt = man.builtAt ? man.builtAt.slice(0, 10) : "";
  const hist = historyOf(rows, q.history, fetchedAt);
  // 담당자 입력 → 행안부 표 → null (app/check/page.tsx 와 같은 순서)
  const pop = q.populationManMyeong ?? populationOfCode(code);
  const peer = pop !== null ? peerBandFor(pop) : null;
  const visitors = q.n !== null ? checkVisitors({ n: q.n, basis: q.basis, counting: q.counting }, hist.years, peer) : null;
  const schedule = q.start && q.end ? checkSchedule({ start: q.start, end: q.end }, hist.years) : null;
  const range = nextYearRange(hist.years, peer);
  const budget = visitors ? checkBudget(q.budgetManWon, visitors, isDemo ? DEMO_BUDGET_SOURCE : "기획안") : null;
  const evidence: Measured[] = [...(visitors?.evidence ?? []), ...(budget?.evidence ?? [])];
  const by = new Map<string, Measured>(evidence.map((m) => [m.key, m]));
  const last = hist.years.length ? hist.years[hist.years.length - 1] : null;
  let 경쟁: Competitor[] = [];
  let 경쟁상태: CompetitionStatus = "none";
  if (last) {
    if (!hasTourKey()) 경쟁상태 = "nokey";
    else {
      try {
        경쟁 = competitorsNear(coordsOf(q.sido, q.sigungu), await searchFestivalsInPeriod(last.start, last.end));
        경쟁상태 = "ok";
      } catch {
        경쟁상태 = "fail";
      }
    }
  }
  const 귀속경고 = last ? attributionCaveat(last.year, 경쟁, 경쟁상태) : null;
  const cell = (key: string) => {
    const m = by.get(key);
    return m ? <Num m={m} /> : "—";
  };
  const 이름 = q.name || `${q.sido} ${q.sigungu} 축제`;
  const 최종 = visitors?.verdict.label ?? "근거 없음";
  const period = (y: { start: string; end: string }) => `${DATE(y.start)}~${DATE(y.end)}`;

  return (
    <div className="report report-check">
      <p className="no-print report-hint">
        <span className="logo">기획안 팩트체크</span> 브라우저 인쇄(Ctrl+P)에서 <strong>대상을 PDF로 저장</strong>하면 A4 두 장으로 나옵니다.{" "}
        <Link href={`/check${qs}`}>판정으로 돌아가기</Link>
      </p>

      {/* ── 1장 ── */}
      <section className="report-page">
        <header className="report-head">
          <h1>기획안 검증 보고서</h1>
          {isDemo && demo && (
            <p className="report-demo">
              <strong>견본</strong> · {DEMOS[demo].banner} 결재에 쓸 문서가 아닙니다. 예상 방문객 출처: {DEMOS[demo].claimSource}. 지역 인구
              출처: {DEMOS[demo].populationSource}.
            </p>
          )}
          <p className="num">
            {이름} · {q.sido} {q.sigungu}(시군구 {code}) · 기획 기간 {q.start && q.end ? `${DATE(q.start)}~${DATE(q.end)}` : "미기재"} · 자기 이력{" "}
            {hist.years.length ? hist.years.map((y) => y.year).join("·") : "없음"}
          </p>
        </header>

        <section className="report-verdict">
          <p className="alert" data-level={LEVEL_OF[최종]}>
            예상 방문객 {최종}
            {visitors?.verdict.confidence === "low" && " · 신뢰도 낮음"}
          </p>
          {visitors && (
            <p className="headline">
              <Sentence seg={explainVisitors(visitors.verdict)} by={by} />
            </p>
          )}
          {!visitors && <p className="headline">예상 방문객이 기획안에 없어 판정하지 않았습니다.</p>}
        </section>

        <section>
          <h2>판정표 — 담당자 값을 같은 자의 실측으로 잰 결과</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>담당자 값</th>
                <th>같은 자의 실측</th>
                <th>비</th>
                <th>판정</th>
                <th>임계(정한 값)</th>
              </tr>
            </thead>
            <tbody>
              {visitors?.verdict.stages.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    예상 방문객 {i + 1}단계 {s.title}
                  </td>
                  <td className="num">{cell(s.slots.numerator)}</td>
                  <td>
                    {cell(s.slots.denominator)}
                    {by.get(s.slots.denominator) && <span className="report-cell-label"> {by.get(s.slots.denominator)!.label}</span>}
                  </td>
                  <td className="num">{s.ratio === null ? "—" : s.ratio.toFixed(2)}</td>
                  <td className="report-label">{s.result}</td>
                  <td>
                    {s.threshold}
                    {s.id === "cap" && visitors.verdict.breakevenTurnover !== null && (
                      <span className="report-cell-label">손익분기 회전율 {visitors.verdict.breakevenTurnover.toFixed(2)}회 = N ÷ (0.80 × 상한). 회전율은 가정하지 않는다</span>
                    )}
                  </td>
                </tr>
              ))}
              {visitors && visitors.verdict.r !== null && (
                <tr>
                  <td>예상 방문객 최종 (r = 요구 배수 ÷ 이력 배수)</td>
                  <td className="num">{visitors.verdict.requiredMult!.toFixed(2)}배 요구</td>
                  <td>{cell("historyMult")}</td>
                  <td className="num">{visitors.verdict.r.toFixed(2)}</td>
                  <td className="report-label">
                    <strong>{visitors.verdict.label}</strong>
                  </td>
                  <td>1단계 상한 초과면 즉시. 아니면 3단계, 2단계 주의 신호면 통과를 주의로</td>
                </tr>
              )}
              <tr>
                <td>개최 기간·요일</td>
                <td>
                  {schedule ? (
                    <>
                      {DATE(q.start)}~{DATE(q.end)}
                      <span className="report-cell-label">
                        {schedule.lengthDays}일 · {schedule.weekdays.map((d) => DOW_KO[d]).join("")}
                      </span>
                    </>
                  ) : (
                    "미기재"
                  )}
                </td>
                <td colSpan={2}>{schedule ? schedule.note : "—"}</td>
                <td className="report-label">{schedule?.label ?? "근거 없음"}</td>
                <td>이력 최대일 요일 포함 · 주말 포함 · 길이 ≤ 이력 최장 1.5배</td>
              </tr>
              <tr>
                <td>주차면 · 부스 수</td>
                <td>—</td>
                <td colSpan={2}>공사 데이터에 주차·부스 수요가 없다. 담당자 확인. 부스 통로 밀도는 시뮬레이션으로 본다.</td>
                <td className="report-label">근거 없음</td>
                <td>—</td>
              </tr>
              {budget ? (
                <tr>
                  <td>예산 · 1인당</td>
                  <td className="num">
                    {cell("budget")}
                    <span className="report-cell-label">기획안 총예산 ÷ 예상 방문객 = {cell("perClaim")}</span>
                  </td>
                  <td>
                    {budget.verdict.slots.perMeasured ? (
                      <>
                        {cell("perMeasured")}
                        <span className="report-cell-label">{by.get("perMeasured")!.label}</span>
                      </>
                    ) : (
                      budget.verdict.note
                    )}
                  </td>
                  <td className="num">{budget.verdict.ratio === null ? "—" : budget.verdict.ratio.toFixed(2)}</td>
                  <td className="report-label">
                    {budget.verdict.label}
                    <span className="report-cell-label">방문객 판정 상속</span>
                  </td>
                  <td>임계 없음. 비는 2단계 순증분 비와 같다. 1인당 예산의 오차는 예상 방문객의 오차라 그 판정을 물려받는다{isDemo && q.budgetManWon !== null && ". 견본 예산은 가정값"}</td>
                </tr>
              ) : (
                <tr>
                  <td>예산</td>
                  <td>—</td>
                  <td colSpan={2}>기획안에 예산이 없다. 예산 미공개.</td>
                  <td className="report-label">근거 없음</td>
                  <td>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="report-range">
          <h2>내년 배수 구간 — 예측이 아니라 이력의 연장</h2>
          <p className="num">
            {range.mean ? (
              <>
                자기 이력 {range.years.join("·")}: <strong>평균 {bandText(range.mean)} · 최대일 {bandText(range.peak)}</strong>. 이력 범위({range.years.length}년). 적중률은 −52주 근사로만 쟀다(아래).{range.years.length === 1 && " 이력이 1년뿐이라 구간이 점이다."}
              </>
            ) : (
              <>자기 이력이 없어 구간을 내지 못했습니다.</>
            )}{" "}
            {range.peerMean && (
              <>
                {range.peerLabel} {peer?.n}곳: 평균 {bandText(range.peerMean)} · 최대일 {bandText(range.peerPeak)} (중앙값~상위 5%).
              </>
            )}
          </p>
          <p className="num">
            연도별 배수의 최소~최대를 0.1 단위로 바깥 반올림한 구간입니다. 배수는 평소(축제 전후 4주 외지인 중앙값) 대비이며 명 수로 바꾸지
            않습니다. 그해 평소 값에 이 구간을 곱하는 것은 담당 부서의 판단입니다.
          </p>
          <p className="num backtest">{backtestSentence(RANGE_BACKTEST_PUBLISHED)}</p>
        </section>

        <section className="report-advice">
          <h2>보완</h2>
          {visitors ? (
            <p className="num">
              <Sentence seg={adviseVisitors(visitors.verdict)} by={by} />
            </p>
          ) : (
            <p className="num">예상 방문객을 단위와 함께 적고 다시 판정합니다.</p>
          )}
          {schedule && schedule.label !== "통과" && <p className="num">개최 기간·요일: {schedule.note}</p>}
          {귀속경고 && (
            <p className="num report-caveat">
              <strong>귀속 경고</strong> {귀속경고}
            </p>
          )}
          {visitors?.verdict.caveats.map((c) => (
            <p key={c} className="num report-caveat">
              {c}
            </p>
          ))}
        </section>

        <footer className="report-foot">
          {isDemo && <span className="report-foot-demo">견본 · 결재용 아님</span>}
          <span>1/2</span>
          <span>인쇄 {긴시각()}</span>
          <span>출처 한국관광공사 TourAPI · {KT_API} · 조회 {fetchedAt}</span>
        </footer>
      </section>

      {/* ── 2장 ── */}
      <section className="report-page">
        <header className="report-head">
          <h1>근거 — {이름}</h1>
          <p className="num">
            KT 이동통신 기반 시군구 일별 방문자(현지인·외지인·외국인 체류) · 전국 적재 {DATE(man.from ?? "")}~{DATE(man.to ?? "")} · 이 시군구 자료{" "}
            {dataRange ? `${DATE(dataRange.from)}~${DATE(dataRange.to)} (${dataRange.days.toLocaleString("ko-KR")}일)` : "없음"}
          </p>
        </header>

        <section>
          <h2>근거 1 — 자기 이력 실측 (연도별)</h2>
          {hist.years.length === 0 ? (
            <p className="num">이력 기간이 없거나 자료 밖입니다.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>연도</th>
                  <th>기간</th>
                  <th>평소(전후 4주 중앙)</th>
                  <th>최대일 외지인</th>
                  <th>배수 평균</th>
                  <th>배수 최대일</th>
                  <th>축제일 최대 전체 체류</th>
                  <th>축제 연인원 산출</th>
                </tr>
              </thead>
              <tbody>
                {[...hist.years].reverse().map((y) => (
                  <tr key={y.year}>
                    <td className="num">{y.year}</td>
                    <td className="num">
                      {DATE(y.start).slice(5)}~{DATE(y.end).slice(5)} · {y.festivalDays}일
                    </td>
                    <td>
                      <Num m={measured(`${y.year}-b`, "전후 4주 외지인 중앙값", y.baseline, "명", KT_API, `${period(y)} 전후 4주`, y.fetchedAt)} />
                    </td>
                    <td>
                      <Num m={measured(`${y.year}-p`, "축제 최대일 외지인", y.peakOut, "명", KT_API, DATE(y.peakYmd), y.fetchedAt)} />{" "}
                      <span className="report-cell-label">
                        {DATE(y.peakYmd).slice(5)} {dow(y.peakYmd)}
                      </span>
                    </td>
                    <td className="num">{y.multMean.toFixed(2)}배</td>
                    <td className="num">{y.multPeak.toFixed(2)}배</td>
                    <td>
                      <Num m={measured(`${y.year}-t`, "축제일 최대 전체 체류", y.maxDayTotal, "명", KT_API, DATE(y.maxDayTotalYmd), y.fetchedAt)} />
                    </td>
                    <td>{y.visitors === null ? "—" : <Num m={measured(`${y.year}-v`, "Σ 같은 요일 순증", y.visitors, "명", KT_API, period(y), y.fetchedAt)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hist.skipped.map((s) => (
            <p key={s.period.start} className="num">
              {s.period.year} {period(s.period)}: 자료 밖이라 뺐습니다 ({s.reason}).
            </p>
          ))}
        </section>

        {visitors && (
          <section>
            <h2>근거 2 — 판정에 쓴 실측 셀과 출처</h2>
            <table className="report-table">
              <thead>
                <tr>
                  <th>셀</th>
                  <th>값</th>
                  <th>출처</th>
                  <th>기간</th>
                  <th>조회일</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td className="num">
                      <Num m={m} />
                    </td>
                    <td>
                      {m.origin === "input" ? (m.api === "기획안" ? "담당자 기획안" : m.api) : m.origin === "derived" ? `${m.api} (입력 ÷ 실측)` : `한국관광공사 ${m.api}`}
                    </td>
                    <td className="num">{m.period || "—"}</td>
                    <td className="num">{m.date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="report-limits">
          <h2>정의 · 임계값 · 이 보고서가 말하지 않는 것</h2>
          <ul className="report-list">
            <li>
              <strong>평소</strong> = 축제 전후 각 4주(축제일 제외) 외지인의 중앙값. <strong>배수</strong> = 축제일 외지인 ÷ 평소. <strong>순증</strong> = 같은 요일
              중앙값 대비 외지인 증가. 산출식은 코드 한 곳(lib/surge.ts)이고 619건 또래도 같은 식으로 재계산했습니다.
            </li>
            <li>
              1단계 상한비 ≥{THRESHOLDS.cap.impossible.toFixed(2)} 상한 초과(실인원 기준. 연인원이면 손익분기 회전율을 병기) · ≥{THRESHOLDS.cap.over.toFixed(2)} 과대. 2단계 증분비 ≥
              {THRESHOLDS.increment.peakDay.toFixed(1)}(일 최다)·{THRESHOLDS.increment.period.toFixed(1)}(기간) 주의 신호. 3단계 r &lt;
              {THRESHOLDS.multiple.under.toFixed(2)} 과소 · ≤{THRESHOLDS.multiple.pass.toFixed(2)} 통과 · ≤{THRESHOLDS.multiple.caution.toFixed(2)} 주의 · 그 위 과대.
              전부 정한 값이며 군포 2025 한 건으로 맞췄습니다.
            </li>
            <li>
              <strong>방문객 수를 예측하지 않습니다.</strong> 이 문서의 명 수는 담당자 입력값이거나 공사 실측값이며 각 셀에 출처가 붙어 있습니다.
            </li>
            <li>
              <strong>&ldquo;안전하다&rdquo;고 말하지 않습니다.</strong> 통과는 기획안이 이력 안에 있다는 뜻입니다.
            </li>
            <li>순증은 귀속 100%가 아닙니다. 같은 기간 반경 50km 다른 축제·연휴가 섞입니다. 현지인 참여가 큰 축제는 외지인 기준 순증이 과소 평가됩니다.</li>
            <li>KT 자료는 시군구 유동인구이며 축제 방문객이 아닙니다. 자료는 전월 초까지만 있습니다(한 달 이상 지연).</li>
          </ul>
        </section>

        <footer className="report-foot">
          {isDemo && <span className="report-foot-demo">견본 · 결재용 아님</span>}
          <span>2/2</span>
          <span>인쇄 {긴시각()}</span>
          <span>출처 한국관광공사 {KT_API} · 조회 {fetchedAt}</span>
          <span>기획안 팩트체크</span>
        </footer>
      </section>
    </div>
  );
}
