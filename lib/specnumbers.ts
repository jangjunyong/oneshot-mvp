// 기능설명서에 나가는 숫자를 코드 상수·자료 매니페스트·테스트 카운트에서 생성한다 (verdict 2026-09-09 §4 M12-2).
//
// 문서의 숫자는 여기서 만든 문자열과 글자까지 같아야 한다. lib/specnumbers.test.ts 가 docs/기능설명서.md 를
// 읽어 대조하므로, 상수·자료·테스트 수가 바뀌었는데 문서를 안 고치면 npm test 가 깨진다.
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/spec-numbers.mjs

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { LOO_PUBLISHED, pct } from "@/lib/eval";
import { RANGE_BACKTEST_PUBLISHED, PRIOR_PEAK_MIN } from "@/lib/backtest";
import { THRESHOLDS, checkVisitors } from "@/lib/verdict";
import { DISTANCE_THRESHOLD, GRADE_CUT } from "@/lib/types";
import { FESTIVALS, RECOMPUTED } from "@/lib/festivals";
import { coverageStats, manifest, loadDaily } from "@/lib/kto/daily";
import { historyOf } from "@/lib/history";
import { DEMOS } from "@/lib/checkquery";
import { peerBandFor } from "@/lib/peerband";
import { populationOfCode } from "@/lib/region";

const ymd = (s: string | null) => (s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "—");

/** `test(`·`it(` 로 시작하는 줄 수 — node --test 가 세는 것과 같다 (서브테스트 없음) */
function countTests(files: string[]): number {
  let n = 0;
  for (const f of files) for (const line of readFileSync(f, "utf8").split("\n")) if (/^\s*(test|it)\(/.test(line)) n++;
  return n;
}

function demoLabel(key: keyof typeof DEMOS) {
  const d = DEMOS[key].query;
  const code = d.sido === "경기" ? "41410" : "51790";
  const hist = historyOf(loadDaily(code), d.history, "spec").years;
  // 화면(app/check/page.tsx)과 같은 순서 — 담당자(견본) 입력 → 행안부 표
  const pop = d.populationManMyeong ?? populationOfCode(code);
  const v = checkVisitors({ n: d.n!, basis: d.basis, counting: d.counting }, hist, pop !== null ? peerBandFor(pop) : null).verdict;
  return v;
}

/** 문서에 그대로 들어가는 문자열들. 키는 설명용, 값이 대조 대상이다 */
export function specNumbers(): Record<string, string> {
  const m = manifest();
  const cov = coverageStats();
  const bt = RANGE_BACKTEST_PUBLISHED;
  const gunpoOld = checkVisitors({ n: 217502, basis: "peakDay", counting: "personDays" }, historyOf(loadDaily("41410"), DEMOS.gunpo.query.history, "spec").years).verdict;
  const gunpo = demoLabel("gunpo");
  const hwacheon = demoLabel("hwacheon");
  const unitFiles = readdirSync("lib").filter((f) => f.endsWith(".test.ts")).map((f) => path.join("lib", f));
  return {
    정밀도: pct(LOO_PUBLISHED.precision),
    재현율: pct(LOO_PUBLISHED.recall),
    리프트: `${LOO_PUBLISHED.lift.toFixed(2)}배`,
    기저율: pct(LOO_PUBLISHED.baseRate),
    밴드안: pct(LOO_PUBLISHED.withinRatio),
    절대오차중앙: `${LOO_PUBLISHED.medianAbsErr.toFixed(2)}배`,
    표본619: `${FESTIVALS.length}건`,
    재계산: `${RECOMPUTED}/${FESTIVALS.length}`,
    닮음임계: String(DISTANCE_THRESHOLD),
    등급컷: `${GRADE_CUT.severe.toFixed(1)} / ${GRADE_CUT.caution.toFixed(1)}`,
    백테스트표본: `표본 ${bt.n1.n + bt.n2.n}건`,
    백테스트n2: `${bt.n2.n}건 중 ${bt.n2.hitsPeak}건(${bt.n2.coverPeak === null ? "백분율 없음" : pct(bt.n2.coverPeak)})`,
    백테스트n1: `${bt.n1.n}건 중 ${bt.n1.hitsPeak}건(${bt.n1.coverPeak === null ? "백분율 없음" : pct(bt.n1.coverPeak)})`,
    백테스트필터: `≥${PRIOR_PEAK_MIN.toFixed(1)}`,
    상한임계: `${THRESHOLDS.cap.impossible.toFixed(2)} / ${THRESHOLDS.cap.over.toFixed(2)}`,
    순증임계: `${THRESHOLDS.increment.peakDay.toFixed(1)}(일 최다) · ${THRESHOLDS.increment.period.toFixed(1)}(기간)`,
    배수임계: `${THRESHOLDS.multiple.under.toFixed(2)} / ${THRESHOLDS.multiple.pass.toFixed(2)} / ${THRESHOLDS.multiple.caution.toFixed(2)}`,
    회전율예시: `${gunpoOld.breakevenTurnover!.toFixed(2)}회`,
    군포견본: gunpo.label,
    화천견본: hwacheon.label,
    화천회전율: `${hwacheon.breakevenTurnover!.toFixed(2)}회`,
    일수: `${m.days.toLocaleString("ko-KR")}일`,
    // 2026-09-12 정정 — "299개 × 2,658일, 빠진 날 0"은 거짓이었다. 전남·광주 27곳은 12xxx 로 갈라져 있었고(병합됨),
    // 부천 3구·화성 4구·인천 신설 4구는 KT 제공 시작일이 늦다. 전수와 나머지를 갈라 적는다
    시군구: `${cov.sigungu}개`,
    전수시군구: `${cov.fullCount}곳`,
    적재행: `${cov.rows.toLocaleString("ko-KR")}행`,
    최소일수: `${cov.minDays}일`,
    자료기간: `${ymd(m.from)}~${ymd(m.to)}`,
    유닛: `유닛 ${countTests(unitFiles)}`,
    e2e: `e2e ${countTests(["e2e.test.mjs"])}`,
  };
}

/** 문서에 붙여 넣는 블록 — scripts/spec-numbers.mjs 가 찍는다 */
export function specBlock(): string {
  const n = specNumbers();
  return Object.entries(n)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
