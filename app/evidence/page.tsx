// 실측 근거 — 판정의 분모가 어디서 왔는지 일별 곡선과 표로 보인다 (기획/08 §2.1 `/evidence`).
//
// 판정 규칙이 못 서도 이 화면 하나로 제품이다(롤백 화면). 그래서 /check 와 같은 URL 을 읽고
// 같은 순수 함수(lib/surge.ts → lib/history.ts)로 같은 값을 낸다 — 두 화면의 숫자가 갈릴 통로가 없다.
// 자바스크립트 0. 곡선은 서버가 SVG 로 그린다.

import Link from "next/link";
import { dailyRange, loadDaily, manifest, resolveRegion } from "@/lib/kto/daily";
import { historyOf, ymdDashed } from "@/lib/history";
import { checkQueryString, DEMOS, parseCheckQuery } from "@/lib/checkquery";
import { computeSurge, type DailyRow } from "@/lib/surge";
import { DOW_KO, KT_API, type HistoryYear } from "@/lib/verdict";
import { measured, Num } from "@/app/_components/num";
import { hasTourKey, searchFestivalsInPeriod } from "@/lib/tourapi";
import { attributionCaveat, competitorsNear, type Competitor, type CompetitionStatus } from "@/lib/overlap";
import { coordsOf } from "@/lib/match";

export const dynamic = "force-dynamic";
export const metadata = { title: "실측 근거 · 기획안 팩트체크" };

const DAY = 86400000;
const toTime = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
const toYmd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const DATE = (s: string) => (s ? ymdDashed(s) : "");
const dow = (s: string) => DOW_KO[new Date(toTime(s)).getUTCDay()];

const W = 720;
const H = 200;
const PAD = { l: 56, r: 12, t: 10, b: 26 };
const WEEKS = 4;

/** 한 해의 창(전후 4주) 일별 외지인을 곡선으로. 축척은 여러 해가 같이 쓴다 */
function Curve({ y, rows, yMax, fetchedAt }: { y: HistoryYear; rows: readonly DailyRow[]; yMax: number; fetchedAt: string }) {
  const by = new Map(rows.map((r) => [r.ymd, r]));
  const t0 = toTime(y.start) - WEEKS * 7 * DAY;
  const t1 = toTime(y.end) + WEEKS * 7 * DAY;
  const n = Math.round((t1 - t0) / DAY) + 1;
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * i) / (n - 1);
  const yy = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / yMax);
  const pts: string[] = [];
  let missing = 0;
  for (let i = 0; i < n; i++) {
    const r = by.get(toYmd(t0 + i * DAY));
    if (!r) {
      missing++;
      continue;
    }
    pts.push(`${x(i).toFixed(1)},${yy(r.out).toFixed(1)}`);
  }
  const fs = Math.round((toTime(y.start) - t0) / DAY);
  const fe = Math.round((toTime(y.end) - t0) / DAY);
  const pi = Math.round((toTime(y.peakYmd) - t0) / DAY);
  const ticks = [0, 0.5, 1].map((f) => Math.round((yMax * f) / 1000) * 1000);
  return (
    <figure className="evidence-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${y.year} 전후 4주 일별 외지인 곡선`}>
        <rect className="ev-fest" x={x(fs)} y={PAD.t} width={x(fe) - x(fs)} height={H - PAD.t - PAD.b} />
        {ticks.map((v) => (
          <g key={v}>
            <line className="ev-grid" x1={PAD.l} x2={W - PAD.r} y1={yy(v)} y2={yy(v)} />
            <text className="ev-tick" x={PAD.l - 6} y={yy(v) + 3} textAnchor="end">
              {(v / 1000).toFixed(0)}k
            </text>
          </g>
        ))}
        <line className="ev-base" x1={PAD.l} x2={W - PAD.r} y1={yy(y.baseline)} y2={yy(y.baseline)} />
        <text className="ev-tick" x={W - PAD.r - 4} y={yy(y.baseline) - 4} textAnchor="end">
          평소
        </text>
        <polyline className="ev-line" points={pts.join(" ")} />
        {by.get(y.peakYmd) && <circle className="ev-peak" cx={x(pi)} cy={yy(y.peakOut)} r={3.5} />}
        <text className="ev-tick" x={x(fs)} y={H - 8}>
          {DATE(y.start).slice(5)}
        </text>
        <text className="ev-tick" x={x(fe)} y={H - 8} textAnchor="end">
          {DATE(y.end).slice(5)}
        </text>
        <text className="ev-tick" x={PAD.l} y={H - 8}>
          −4주
        </text>
        <text className="ev-tick" x={W - PAD.r} y={H - 8} textAnchor="end">
          +4주
        </text>
      </svg>
      <figcaption className="note">
        {y.year} · 음영이 축제 기간, 점선이 평소(전후 4주 외지인 중앙값), 점이 최대일. 외지인 체류(명/일), 조회 {fetchedAt}.
        {missing > 0 && ` 창 안에 빠진 날 ${missing}일.`}
      </figcaption>
    </figure>
  );
}

export default async function EvidencePage({ searchParams }: PageProps<"/evidence">) {
  const params = await searchParams;
  const { query: q0, isDemo, demo, errors } = parseCheckQuery(params);
  const region = q0.sido && q0.sigungu ? resolveRegion(q0.sido, q0.sigungu) : null;
  const q = region ? { ...q0, sido: region.sido, sigungu: region.name } : q0;
  const qs = checkQueryString(q, isDemo);
  const code = region?.code ?? null;
  const rows = code ? loadDaily(code) : [];
  const dataRange = code ? dailyRange(code) : null;
  const man = manifest();
  const fetchedAt = man.builtAt ? man.builtAt.slice(0, 10) : "";
  const hist = historyOf(rows, q.history, fetchedAt);
  const years = [...hist.years].reverse();

  // 축척은 세 해가 같이 쓴다 — 해마다 다르면 눈이 "올해가 더 컸다"고 잘못 읽는다
  let yMax = 0;
  const by = new Map(rows.map((r) => [r.ymd, r]));
  for (const y of years) {
    const t0 = toTime(y.start) - WEEKS * 7 * DAY;
    const t1 = toTime(y.end) + WEEKS * 7 * DAY;
    for (let t = t0; t <= t1; t += DAY) {
      const r = by.get(toYmd(t));
      if (r && r.out > yMax) yMax = r.out;
    }
  }
  yMax = yMax > 0 ? yMax * 1.08 : 1;

  const period = (y: HistoryYear) => `${DATE(y.start)}~${DATE(y.end)}`;

  const last = years[0] ?? null;
  let 경쟁: Competitor[] = [];
  let 경쟁상태: CompetitionStatus = "none";
  if (code && last) {
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
  const m = (y: HistoryYear, key: string, label: string, value: number, unit: "명" | "배" | "일", p = period(y)) =>
    measured(`${y.year}-${key}`, label, value, unit, KT_API, p, y.fetchedAt);

  return (
    <div className="sheet check-sheet">
      <header className="topbar">
        <span className="logo">기획안 팩트체크</span>
        <nav>
          <Link href={`/check${qs}`}>기획안 판정</Link>
          <Link href="/evidence" aria-current="page">
            실측 근거
          </Link>
          <Link href="/venue">시뮬레이션</Link>
          <Link href="/">진단(보조)</Link>
        </nav>
      </header>

      <main>
        <span className="grid-ref">
          <b>A-03</b> · 실측 근거 · {KT_API} · 전국 적재 {DATE(man.from ?? "")}~{DATE(man.to ?? "")}
          {dataRange && ` · 이 시군구 자료 ${DATE(dataRange.from)}~${DATE(dataRange.to)} (${dataRange.days.toLocaleString("ko-KR")}일)`}
        </span>
        <h1 className="display">
          이 축제가
          <br />
          실제로 겪은 것
        </h1>
        <p className="lede">
          시군구에 있던 사람을 KT 이동통신으로 센 일별 값입니다. 축제 방문객이 아니라 <strong>시군구 유동인구</strong>라서,
          평소(전후 4주) 대비 배수와 같은 요일 대비 순증으로 축제 몫을 뽑습니다. 산출식은 <code>lib/surge.ts</code> 한 곳입니다.
        </p>

        {isDemo && demo && (
          <p className="alert" data-level="근거없음">
            <strong>견본</strong>입니다. {q.sido} {q.sigungu}의 {q.history.map((h) => h.year).join("·")} {q.name} 기간을 봅니다. 기간 출처:{" "}
            {q.history.map((h) => `${h.year} ${h.source ?? "—"}`).join(" / ")}. {DEMOS[demo].why}.
          </p>
        )}
        {errors.map((e) => (
          <p key={e} className="alert" data-level="심각" role="alert">
            {e}
          </p>
        ))}
        {!code && errors.length === 0 && (
          <p className="alert" data-level="심각">
            &ldquo;{q.sido} {q.sigungu}&rdquo; 에 맞는 KT 시군구를 찾지 못했다. <Link href={`/check${qs}`}>기획안 판정</Link>에서 시도·시군구를 고쳐 달라.
          </p>
        )}
        {code && years.length === 0 && (
          <p className="note">
            이력 기간이 없거나 자료 밖이다. <Link href={`/check${qs}`}>기획안 판정</Link>에서 지난 회차 날짜를 적어 달라.
          </p>
        )}

        {years.length > 0 && (
          <>
            <div className="dim">
              <span>SECTION A — 일별 곡선 (외지인)</span>
            </div>
            {years.map((y) => (
              <Curve key={y.year} y={y} rows={rows} yMax={yMax} fetchedAt={fetchedAt} />
            ))}

            <div className="dim">
              <span>SECTION B — 배수와 순증</span>
            </div>
            <table className="report-table check-table">
              <thead>
                <tr>
                  <th>연도</th>
                  <th>기간</th>
                  <th>평소(전후 4주 중앙)</th>
                  <th>평소 주말</th>
                  <th>최대일 외지인</th>
                  <th>배수 평균</th>
                  <th>배수 최대일</th>
                  <th>최대일 전체 체류</th>
                  <th>축제 연인원 산출</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year}>
                    <th>{y.year}</th>
                    <td className="num">
                      {DATE(y.start).slice(5)}~{DATE(y.end).slice(5)} · {y.festivalDays}일
                    </td>
                    <td>
                      <Num m={m(y, "baseline", "전후 4주 외지인 중앙값", y.baseline, "명", `${period(y)} 전후 4주`)} />
                    </td>
                    <td>
                      {y.baselineWeekend === null ? "—" : <Num m={m(y, "bw", "전후 4주 토·일 외지인 중앙값", y.baselineWeekend, "명", `${period(y)} 전후 4주`)} />}
                    </td>
                    <td>
                      <Num m={m(y, "peak", "축제 최대일 외지인", y.peakOut, "명", DATE(y.peakYmd))} />{" "}
                      <span className="note">
                        {DATE(y.peakYmd).slice(5)} {dow(y.peakYmd)}
                      </span>
                    </td>
                    <td className="num">{y.multMean.toFixed(2)}배</td>
                    <td className="num">{y.multPeak.toFixed(2)}배</td>
                    <td>
                      <Num m={m(y, "total", "축제일 최대 전체 체류(현지인+외지인+외국인)", y.maxDayTotal, "명", DATE(y.maxDayTotalYmd))} />
                    </td>
                    <td>
                      {y.visitors === null ? "—" : <Num m={m(y, "visitors", "Σ(같은 요일 외지인 순증 + 현지인 순증⁺)", y.visitors, "명")} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              배수 = 축제일 외지인 ÷ 평소(전후 4주 중앙값). 순증은 같은 요일 중앙값 대비라 토요일이 원래 많은 효과를 걷어낸다.
              축제 연인원 산출은 순증의 합이고, 반경 50km 다른 축제·연휴가 섞여 귀속 100% 가 아니다. 현지인 참여가 큰 축제는
              과소 평가된다.
            </p>
            {귀속경고 && (
              <p className="note attribution" data-status={경쟁상태}>
                <strong>귀속 경고</strong> {귀속경고}
              </p>
            )}

            <div className="dim">
              <span>SECTION C — 일별 표 (최근 회차)</span>
            </div>
            <DailyTable y={years[0]} rows={rows} />
          </>
        )}

        {hist.skipped.map((s) => (
          <p key={s.period.start} className="note">
            {s.period.year} {DATE(s.period.start)}~{DATE(s.period.end)}: 자료 밖이라 뺐다 ({s.reason}).
          </p>
        ))}
        <p className="note">
          출처: 한국관광공사 TourAPI {KT_API} (KT 이동통신 기반 시군구 일별 방문자{code ? `, 시군구 ${code}` : ""}) · 조회 {fetchedAt}
          {" · "}
          <Link href={`/check${qs}`}>← 기획안 판정</Link>
        </p>
      </main>
    </div>
  );
}

function DailyTable({ y, rows }: { y: HistoryYear; rows: readonly DailyRow[] }) {
  const r = computeSurge({ rows, start: y.start, end: y.end });
  if (!r.ok) return null;
  return (
    <table className="report-table check-table">
      <thead>
        <tr>
          <th>날짜</th>
          <th>요일</th>
          <th>외지인</th>
          <th>같은 요일 평소</th>
          <th>순증</th>
          <th>배수</th>
          <th>현지인</th>
          <th>전체 체류</th>
        </tr>
      </thead>
      <tbody>
        {r.days.map((d) => (
          <tr key={d.ymd} data-peak={d.ymd === y.peakYmd ? "" : undefined}>
            <th className="num">{DATE(d.ymd)}</th>
            <td>{DOW_KO[d.dow]}</td>
            <td>
              <Num m={measured(`d-${d.ymd}-out`, "외지인 체류", d.out, "명", KT_API, DATE(d.ymd), y.fetchedAt)} />
            </td>
            <td>{d.baseDow === null ? "—" : <Num m={measured(`d-${d.ymd}-base`, "같은 요일 전후 4주 중앙값", d.baseDow, "명", KT_API, `${DATE(y.start)}~${DATE(y.end)} 전후 4주`, y.fetchedAt)} />}</td>
            <td>{d.deltaOut === null ? "—" : <Num m={measured(`d-${d.ymd}-delta`, "외지인 순증", d.deltaOut, "명", KT_API, DATE(d.ymd), y.fetchedAt)} />}</td>
            <td className="num">{d.mult.toFixed(2)}</td>
            <td>
              <Num m={measured(`d-${d.ymd}-loc`, "현지인 체류", d.loc, "명", KT_API, DATE(d.ymd), y.fetchedAt)} />
            </td>
            <td>
              <Num m={measured(`d-${d.ymd}-total`, "전체 체류", d.total, "명", KT_API, DATE(d.ymd), y.fetchedAt)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
