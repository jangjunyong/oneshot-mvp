// 기획안 팩트체크 — 담당자가 쓴 숫자를 공사 KT 실측과 같은 자로 재서 판정한다 (기획/08 §2.2).
//
// 입력은 URL(GET 폼)이고 저장이 없다. 같은 링크면 같은 판정이다 — 결정론이 곧 재현성이고,
// 자바스크립트 없는 e2e 가 이 화면을 그대로 검증한다.
// 판정·구간은 순수 함수(lib/verdict.ts · lib/range.ts)가 내고, 이 파일은 파일을 읽어 넘기고 그린다.
// 모델 호출 0회.

import Link from "next/link";
import { loadDaily, manifest, sigunguCode } from "@/lib/kto/daily";
import { historyOf } from "@/lib/history";
import { checkQueryString, DEMO_BUDGET_SOURCE, HISTORY_SLOTS, parseCheckQuery, type CheckQuery } from "@/lib/checkquery";
import { checkBudget } from "@/lib/budget";
import {
  checkSchedule,
  checkVisitors,
  DOW_KO,
  explainVisitors,
  KT_API,
  noEvidence,
  THRESHOLDS,
  type Label,
  type Measured,
  type Segment,
} from "@/lib/verdict";
import { bandText, nextYearRange } from "@/lib/range";
import { backtestSentence, RANGE_BACKTEST_PUBLISHED } from "@/lib/backtest";
import { peerBandFor } from "@/lib/peerband";
import { populationOf } from "@/lib/festivals";
import { ymdDashed } from "@/lib/history";
import { Num } from "@/app/_components/num";
import { hasTourKey, searchFestivalsInPeriod } from "@/lib/tourapi";
import { attributionCaveat, competitorsNear, NEARBY_RADIUS_KM, type Competitor, type CompetitionStatus } from "@/lib/overlap";
import { coordsOf } from "@/lib/match";

export const dynamic = "force-dynamic";
export const metadata = { title: "기획안 판정 · 기획안 팩트체크" };

/** 라벨 → 경보 색. 통과는 무채색이다 — "안전하다"가 아니라 "기획안이 이력 안에 있다"일 뿐 */
const LEVEL_OF: Record<Label, string | undefined> = {
  "성립 불가": "심각",
  과대: "심각",
  주의: "주의",
  과소: "주의",
  통과: undefined,
  "근거 없음": "근거없음",
  "단위 미상": "근거없음",
};

const DATE = (s: string) => (s ? ymdDashed(s) : "");

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

export default async function CheckPage({ searchParams }: PageProps<"/check">) {
  const params = await searchParams;
  const { query: q, isDemo, errors } = parseCheckQuery(params);
  const qs = checkQueryString(q, isDemo);

  const code = q.sido && q.sigungu ? sigunguCode(q.sido, q.sigungu) : null;
  const rows = code ? loadDaily(code) : [];
  const man = manifest();
  const fetchedAt = man.builtAt ? man.builtAt.slice(0, 10) : "";
  const hist = historyOf(rows, q.history, fetchedAt);
  const pop = q.sido && q.sigungu ? populationOf(q.sido, q.sigungu) : null;
  const peer = pop !== null ? peerBandFor(pop) : null;

  const 판정가능 = errors.length === 0 && code !== null;
  const visitors =
    판정가능 && q.n !== null ? checkVisitors({ n: q.n, basis: q.basis, counting: q.counting }, hist.years, peer) : null;
  const schedule = 판정가능 && q.start && q.end ? checkSchedule({ start: q.start, end: q.end }, hist.years) : null;
  const range = 판정가능 ? nextYearRange(hist.years, peer) : null;
  // 1인당 예산 대조 — 새 자료·새 라벨 0. 분모는 방문객 판정 2단계의 실측 셀(같은 단위)
  const budget = visitors ? checkBudget(q.budgetManWon, visitors, isDemo ? DEMO_BUDGET_SOURCE : "기획안") : null;
  const by = new Map<string, Measured>([...(visitors?.evidence ?? []), ...(budget?.evidence ?? [])].map((m) => [m.key, m]));

  // 순증 귀속 경고 — 작년(이력 중 최근 해) 축제 기간에 반경 50km 다른 축제가 있었나. 공사 TourAPI 실시간.
  // 죽어도 판정은 나가야 하므로 실패는 상태로만 남긴다
  const last = hist.years.length ? hist.years[hist.years.length - 1] : null;
  let 경쟁: Competitor[] = [];
  let 경쟁상태: CompetitionStatus = "none";
  if (판정가능 && last) {
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
  const 시군구배수 = 경쟁.length > 0;
  const stageNum = (key: string) => {
    const m = by.get(key);
    return m ? <Num m={m} /> : <span className="note">—</span>;
  };

  return (
    <div className="sheet check-sheet">
      <header className="topbar">
        <span className="logo">기획안 팩트체크</span>
        <nav>
          <Link href="/check" aria-current="page">
            기획안 판정
          </Link>
          <Link href={`/evidence${qs}`}>실측 근거</Link>
          <Link href="/venue">행사장 도면</Link>
          <Link href="/">진단(보조)</Link>
        </nav>
      </header>

      <main>
        <span className="grid-ref">
          <b>A-02</b> · 기획안 팩트체크 · 공사 KT 일별 방문자 {man.days.toLocaleString("ko-KR")}일분
        </span>
        <h1 className="display">
          기획안의 숫자를
          <br />
          실측으로 판정합니다
        </h1>
        <p className="lede">
          담당자가 쓴 예상 방문객을 <strong>이 축제가 실제로 겪은 배수</strong>와 같은 자로 잽니다. 몇 명이
          아니라 몇 배를, 점이 아니라 구간으로. 판정과 구간은 규칙이 내고 모델은 부르지 않습니다.
        </p>

        {isDemo && (
          <p className="alert" data-level="근거없음">
            <strong>견본</strong>입니다. 군포철쭉축제 2027 기획안이고, 예상 방문객은 2025년 발표 최다일 값, 이력은
            2024·2025·2026 세 해입니다. 아래 칸을 고쳐 다른 축제를 넣을 수 있습니다.
          </p>
        )}
        {errors.map((e) => (
          <p key={e} className="alert" data-level="심각" role="alert">
            {e}
          </p>
        ))}
        {errors.length === 0 && code === null && q.sigungu && (
          <p className="alert" data-level="심각" role="alert">
            &ldquo;{q.sido} {q.sigungu}&rdquo; 에 맞는 KT 시군구 코드를 찾지 못했다. 시도는 짧은 이름(경기·강원…), 시군구는
            행정 이름 그대로(군포시·청주시 상당구) 적어 달라.
          </p>
        )}

        <div className="dim">
          <span>SECTION A — 기획안</span>
        </div>
        <CheckForm q={q} />

        {판정가능 && (
          <>
            <div className="dim">
              <span>SECTION B — 판정</span>
            </div>
            <div className="check-layout">
              <section className="check-main">
                <h2>
                  {q.name || `${q.sido} ${q.sigungu} 축제`} {q.start && q.end ? `${DATE(q.start)} ~ ${DATE(q.end)}` : ""}
                </h2>

                {visitors ? (
                  <>
                    <p className="alert" data-level={LEVEL_OF[visitors.verdict.label]} data-labeled="">
                      <strong>예상 방문객 {visitors.verdict.label}</strong>
                      {visitors.verdict.confidence === "low" && " · 신뢰도 낮음"}
                      {visitors.verdict.confidence === "none" && " · 비교할 이력이 없다"}
                    </p>
                    <p className="check-sentence">
                      <Sentence seg={explainVisitors(visitors.verdict)} by={by} />
                    </p>

                    <table className="report-table check-table">
                      <thead>
                        <tr>
                          <th>검사</th>
                          <th>담당자 값</th>
                          <th>같은 자의 실측</th>
                          <th>비</th>
                          <th>결과</th>
                          <th>임계(정한 값)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitors.verdict.stages.map((s, i) => (
                          <tr key={s.id} data-result={s.result}>
                            <th>
                              {i + 1}단계 {s.title}
                              <span className="note">
                                {s.id === "cap" && " · 하드 게이트"}
                                {s.id === "increment" && " · 보조 신호"}
                                {s.id === "multiple" && " · 주 근거"}
                              </span>
                            </th>
                            <td>{stageNum(s.slots.numerator)}</td>
                            <td>
                              {stageNum(s.slots.denominator)}
                              {s.slots.denominator && by.get(s.slots.denominator) && (
                                <span className="note check-cell-label"> {by.get(s.slots.denominator)!.label}</span>
                              )}
                            </td>
                            <td className="num">{s.ratio === null ? "—" : s.ratio.toFixed(2)}</td>
                            <td>
                              <span className="chip" data-level={LEVEL_OF[s.result as Label]}>
                                {s.result}
                              </span>
                            </td>
                            <td className="note">{s.threshold}</td>
                          </tr>
                        ))}
                        {visitors.verdict.r !== null && (
                          <tr>
                            <th>
                              3단계 세부<span className="note"> · r = 요구 배수 ÷ 이력 배수</span>
                            </th>
                            <td className="num">{visitors.verdict.requiredMult?.toFixed(2)}배 요구</td>
                            <td>{stageNum("historyMult")}</td>
                            <td className="num">{visitors.verdict.r.toFixed(2)}</td>
                            <td colSpan={2} className="note">
                              이력 = 연도별 배수의 최댓값 ({visitors.verdict.historyYears.join("·")})
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="note">예상 방문객을 적으면 3단 검사를 돌린다.</p>
                )}

                <h3>다른 항목</h3>
                <table className="report-table check-table">
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th>담당자 값</th>
                      <th>근거</th>
                      <th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr data-labeled={schedule ? "" : undefined}>
                      <th>개최 기간·요일</th>
                      <td>
                        {schedule ? (
                          <>
                            {DATE(q.start)} ~ {DATE(q.end)} · {schedule.lengthDays}일 ·{" "}
                            {schedule.weekdays.map((d) => DOW_KO[d]).join("")}
                          </>
                        ) : (
                          <span className="note">기간 없음</span>
                        )}
                      </td>
                      <td>{schedule ? schedule.note : "—"}</td>
                      <td>
                        {schedule && (
                          <span className="chip" data-level={LEVEL_OF[schedule.label]}>
                            {schedule.label}
                          </span>
                        )}
                      </td>
                    </tr>
                    {budget && (
                      <tr data-labeled="">
                        <th>예산 · 1인당</th>
                        <td>
                          {stageNum("budget")}
                          <span className="note check-cell-label"> 기획안대로면 1인당 {stageNum("perClaim")}</span>
                        </td>
                        <td>
                          {budget.verdict.slots.perMeasured ? (
                            <>
                              작년 같은 단위 실측 순증으로 나누면 1인당 {stageNum("perMeasured")}
                              <span className="note check-cell-label"> {by.get("perMeasured")!.label}</span>
                            </>
                          ) : (
                            <span className="note">{budget.verdict.note}</span>
                          )}
                        </td>
                        <td>
                          <span className="chip" data-level={LEVEL_OF[budget.verdict.label]}>
                            {budget.verdict.label}
                          </span>
                          <span className="note check-cell-label">방문객 판정 상속</span>
                        </td>
                      </tr>
                    )}
                    {[
                      noEvidence("주차면", "주차 수요를 잴 공사 데이터가 없다. 담당자 확인."),
                      noEvidence("부스 수", "부스 수요를 잴 공사 데이터가 없다. 행사장 도면 시뮬로 통로 밀도만 본다."),
                      ...(budget ? [] : [noEvidence("예산", "기획안에 예산이 없다. 예산 미공개. 적으면 1인당 예산을 대조한다.")]),
                    ].map((v) => (
                      <tr key={v.item}>
                        <th>{v.item}</th>
                        <td className="note">—</td>
                        <td className="note">{v.note}</td>
                        <td>
                          <span className="chip" data-level="근거없음">
                            {v.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(visitors || 귀속경고) && (
                  <details className="selfcheck" open>
                    <summary>단서 · 이 판정이 말하지 않는 것</summary>
                    <ul>
                      {귀속경고 && (
                        <li className="attribution" data-status={경쟁상태}>
                          <strong>귀속 경고</strong> {귀속경고}
                        </li>
                      )}
                      {visitors?.verdict.caveats.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                      <li>
                        임계값은 정한 값이다: 상한 {THRESHOLDS.cap.impossible.toFixed(2)}/{THRESHOLDS.cap.over.toFixed(2)} · 순증{" "}
                        {THRESHOLDS.increment.peakDay.toFixed(1)}(일 최다)·{THRESHOLDS.increment.period.toFixed(1)}(기간) · 배수{" "}
                        {THRESHOLDS.multiple.under.toFixed(2)}/{THRESHOLDS.multiple.pass.toFixed(2)}/{THRESHOLDS.multiple.caution.toFixed(2)}.
                        군포 2025 한 건으로 맞췄다.
                      </li>
                      <li>“통과”는 안전하다는 뜻이 아니다. 기획안이 이 축제 이력 안에 있다는 뜻이다.</li>
                    </ul>
                  </details>
                )}
              </section>

              <aside className="check-side">
                {budget && (
                  <>
                    <h2>1인당 예산</h2>
                    <div className="range-card budget-card" data-level={LEVEL_OF[budget.verdict.label]}>
                      <p className="range-line">
                        <span>기획안대로</span>
                        <strong className="num">{stageNum("perClaim")}</strong>
                      </p>
                      {budget.verdict.slots.perMeasured && (
                        <p className="range-line">
                          <span>작년 실측 순증</span>
                          <strong className="num">{stageNum("perMeasured")}</strong>
                        </p>
                      )}
                      <p className="note">
                        총예산 {stageNum("budget")}
                        {budget.verdict.ratio !== null && <> · 실측 기준이 기획안 기준의 {budget.verdict.ratio.toFixed(1)}배</>}. {budget.verdict.note}
                        {isDemo && " 견본 예산은 가정값이다."}
                      </p>
                    </div>
                  </>
                )}
                <h2>내년 배수 구간</h2>
                {range && (
                  <div className="range-card" data-years={range.years.length}>
                    {range.mean ? (
                      <>
                        <p className="range-line">
                          <span>평균</span>
                          <strong className="num">{bandText(range.mean)}</strong>
                        </p>
                        <p className="range-line">
                          <span>최대일</span>
                          <strong className="num">{bandText(range.peak)}</strong>
                        </p>
                        <p className="note">
                          자기 이력 {range.years.join("·")} 의 연도별 배수를 0.1 단위로 바깥 반올림한 구간. 이력 범위({range.years.length}년).
                          적중률은 −52주 근사로만 쟀다(아래).{range.years.length === 1 && " 이력이 1년뿐이라 구간이 점이다."}
                        </p>
                        <p className="note backtest">{backtestSentence(RANGE_BACKTEST_PUBLISHED)}</p>
                      </>
                    ) : (
                      <p className="note">자기 이력이 없어 또래 구간만 낸다.</p>
                    )}
                    {range.peerMean && (
                      <>
                        <p className="range-line range-peer">
                          <span>또래 평균</span>
                          <span className="num">{bandText(range.peerMean)}</span>
                        </p>
                        <p className="range-line range-peer">
                          <span>또래 최대일</span>
                          <span className="num">{bandText(range.peerPeak)}</span>
                        </p>
                        <p className="note">
                          {range.peerLabel} {peer?.n}곳의 중앙값~상위 5%. 619건을 같은 산출식으로 재계산한 값.
                        </p>
                      </>
                    )}
                    <p className="note">
                      배수는 평소(전후 4주 외지인 중앙값) 대비다. 명 수로 바꾸지 않는다.
                      {시군구배수 && ` 작년 기간에 반경 ${NEARBY_RADIUS_KM}km 다른 축제가 있어 이 배수는 개최 주 시군구 배수다.`}
                    </p>
                  </div>
                )}

                <h2>자기 이력</h2>
                {hist.years.length === 0 ? (
                  <p className="note">이력 기간을 적으면 연도별 배수가 선다.</p>
                ) : (
                  <table className="report-table check-table">
                    <thead>
                      <tr>
                        <th>연도</th>
                        <th>기간</th>
                        <th>평균</th>
                        <th>최대일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.years.map((y) => (
                        <tr key={y.year}>
                          <th>{y.year}</th>
                          <td className="num">
                            {DATE(y.start).slice(5)}~{DATE(y.end).slice(5)}
                          </td>
                          <td className="num">{y.multMean.toFixed(2)}배</td>
                          <td className="num">
                            {y.multPeak.toFixed(2)}배 <span className="note">({DATE(y.peakYmd).slice(5)} {DOW_KO[new Date(Date.UTC(+y.peakYmd.slice(0, 4), +y.peakYmd.slice(4, 6) - 1, +y.peakYmd.slice(6, 8))).getUTCDay()]})</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {hist.skipped.map((s) => (
                  <p key={s.period.start} className="note">
                    {s.period.year} {DATE(s.period.start)}~{DATE(s.period.end)}: 자료 밖이라 뺐다 ({s.reason}). 적재 범위{" "}
                    {DATE(man.from ?? "")}~{DATE(man.to ?? "")}.
                  </p>
                ))}
                <p className="note">
                  출처: 한국관광공사 {KT_API} (KT 이동통신, 시군구 {code}) · 조회 {fetchedAt} ·{" "}
                  <Link href={`/evidence${qs}`}>일별 곡선과 근거 표 →</Link>
                </p>
                <p>
                  <Link href={`/report/check${qs}`}>검증 보고서 두 장 (인쇄용) →</Link>
                </p>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function CheckForm({ q }: { q: CheckQuery }) {
  const d = (s: string) => (s ? ymdDashed(s) : "");
  return (
    <form action="/check" method="get" className="check-form">
      <p>
        <label htmlFor="name">축제 이름</label>
        <input id="name" name="name" defaultValue={q.name} placeholder="예) 군포철쭉축제" />
      </p>
      <p>
        <label htmlFor="sido">시도 · 시군구</label>
        <input id="sido" name="sido" defaultValue={q.sido} placeholder="경기" required />
        <input id="sigungu" name="sigungu" defaultValue={q.sigungu} placeholder="군포시" required />
      </p>
      <p>
        <label htmlFor="n">예상 방문객</label>
        <input id="n" name="n" inputMode="numeric" defaultValue={q.n === null ? "" : String(q.n)} placeholder="기획안의 숫자 그대로" />
        <span className="note">명</span>
      </p>
      <fieldset className="check-units">
        <legend>이 숫자의 단위 (둘 다 골라야 판정한다)</legend>
        <label>
          <input type="radio" name="basis" value="peakDay" defaultChecked={q.basis === "peakDay"} /> 일 최다
        </label>
        <label>
          <input type="radio" name="basis" value="period" defaultChecked={q.basis === "period"} /> 기간 총계
        </label>
        <span className="note">×</span>
        <label>
          <input type="radio" name="counting" value="personDays" defaultChecked={q.counting === "personDays"} /> 연인원
        </label>
        <label>
          <input type="radio" name="counting" value="unique" defaultChecked={q.counting === "unique"} /> 실인원
        </label>
        <span className="note">발표치는 대개 일 최다·연인원, KT 는 일 단위 실인원이다.</span>
      </fieldset>
      <p>
        <label htmlFor="budget">총예산</label>
        <input id="budget" name="budget" inputMode="numeric" defaultValue={q.budgetManWon === null ? "" : String(q.budgetManWon)} placeholder="기획안의 총예산" />
        <span className="note">만 원 · 적으면 1인당 예산을 대조한다</span>
      </p>
      <p>
        <label htmlFor="start">기획 기간</label>
        <input id="start" name="start" type="date" defaultValue={d(q.start)} />
        <input id="end" name="end" type="date" defaultValue={d(q.end)} />
      </p>
      {Array.from({ length: HISTORY_SLOTS }, (_, i) => {
        const h = q.history[i];
        return (
          <p key={i}>
            <label htmlFor={`h${i + 1}s`}>{i === 0 ? "지난 회차 기간" : ""}</label>
            <input id={`h${i + 1}s`} name={`h${i + 1}s`} type="date" defaultValue={h ? d(h.start) : ""} />
            <input id={`h${i + 1}e`} name={`h${i + 1}e`} type="date" defaultValue={h ? d(h.end) : ""} />
          </p>
        );
      })}
      <p className="note">
        지난 회차 날짜는 담당자가 안다. KT 자료는 시군구 유동인구라 축제가 언제였는지 모른다. 가장 최근 해가
        &ldquo;작년&rdquo;이 되어 1·2단계의 분모가 된다.
      </p>
      <p>
        <button type="submit">판정</button>
      </p>
    </form>
  );
}
