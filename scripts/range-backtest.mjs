// −52주 근사 백테스트를 돌려 docs/range_backtest.md 를 쓴다 (verdict 2026-09-09 §4 M5).
//
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/range-backtest.mjs
// 계산은 전부 lib/backtest.ts(순수 함수)에 있다. 이 파일은 표로 옮겨 적기만 한다.
// 게시 상수(RANGE_BACKTEST_PUBLISHED)는 손으로 옮기고 lib/backtest.test.ts 가 데이터와 대조한다.

import { writeFileSync } from "node:fs";
import { backtestRange, backtestSentence, RANGE_BACKTEST_PUBLISHED, PRIOR_PEAK_MIN, MIN_SAMPLE_FOR_PERCENT } from "@/lib/backtest";

const r = backtestRange();
const pct = (x) => (x === null ? "백분율 없음(30건 미만)" : `${(x * 100).toFixed(1)}%`);
const f2 = (x) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(2));
const f1 = (x) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(1));
const today = new Date().toISOString().slice(0, 10);
const ymd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

const g = r.gunpo;
const lines = [];
lines.push(`# 내년 배수 구간의 −52주 근사 백테스트 (${today})`);
lines.push("");
lines.push(`> 산출: \`scripts/range-backtest.mjs\` → \`lib/backtest.ts\`. 자료: 공사 KT 일별 방문자 ${ymd(r.dataFrom)}~${ymd(r.dataTo)}. 게시값은 \`RANGE_BACKTEST_PUBLISHED\`, \`lib/backtest.test.ts\` 가 데이터와 대조한다.`);
lines.push("");
lines.push("## 0. 이것은 근사다");
lines.push("");
lines.push(`같은 축제의 다년 표본이 0건이다(619건은 축제당 1행, TourAPI 는 과거 연도를 거의 남기지 않는다). 그래서 각 축제의 올해 기간을 −364·−728일 옮긴 창을 "근사 전 회차"로 삼았다. 364 = 52주라 요일이 맞는다. 옮긴 창의 최대일 배수가 ≥${PRIOR_PEAK_MIN.toFixed(1)}일 때만 채택했다(그 해에도 축제가 있었다는 최소 신호). 채택 0이면 표본에서 뺐다.`);
lines.push("");
lines.push("HANDOFF 의 \"이력 기간은 담당자 입력. 자동 탐지 없음\"은 제품 입력에 관한 규칙이고 이 방법 검증에는 적용하지 않는다.");
lines.push("");
lines.push("## 1. 표본과 덮은 비율");
lines.push("");
lines.push("| 표본 | 건수 | 최대일 구간이 올해 실측을 덮음 | 평균 구간이 덮음 | 구간 규칙 |");
lines.push("|---|---|---|---|---|");
lines.push(`| n=2 (−364·−728 둘 다 채택) | ${r.n2.n} | ${r.n2.hitsPeak}건 · ${pct(r.n2.coverPeak)} | ${r.n2.hitsMean}건 · ${pct(r.n2.coverMean)} | 두 해 배수의 0.1 단위 바깥 반올림 (lib/range.ts) |`);
lines.push(`| n=1 (−364만 채택) | ${r.n1.n} | ${r.n1.hitsPeak}건 · ${pct(r.n1.coverPeak)} | ${r.n1.hitsMean}건 · ${pct(r.n1.coverMean)} | 한 해 배수 ~ max(그 값, 또래 상위 5%) — 자기 제외 |`);
lines.push(`| 표본 합 | ${r.n1.n + r.n2.n} | | | |`);
lines.push(`| 제외: 채택 창 0 | ${r.excluded.noWindow} | | | 필터 탈락 |`);
lines.push(`| 제외: −728만 채택 | ${r.excluded.only728} | | | 작년 신호 없음 |`);
lines.push(`| 제외: 올해 산출 불가 | ${r.excluded.noSurge} | | | |`);
lines.push(`| 전체 | ${r.total} | | | |`);
lines.push("");
lines.push(`${MIN_SAMPLE_FOR_PERCENT}건 미만인 표본에는 백분율을 만들지 않는다.`);
lines.push("");
lines.push("## 2. 필터가 표본을 어디로 쏠리게 했나 (통과군 vs 탈락군)");
lines.push("");
lines.push("| 군 | 건수 | 시군구 인구 평균(만 명) | 올해 최대일 배수 평균 | 올해 평균 배수 평균 |");
lines.push("|---|---|---|---|---|");
lines.push(`| 통과(n=1·n=2) | ${r.groups.passed.n} | ${f1(r.groups.passed.meanPop)} | ${f2(r.groups.passed.meanPeak)} | ${f2(r.groups.passed.meanMean)} |`);
lines.push(`| 탈락(채택 0·−728만) | ${r.groups.failed.n} | ${f1(r.groups.failed.meanPop)} | ${f2(r.groups.failed.meanPeak)} | ${f2(r.groups.failed.meanMean)} |`);
lines.push("");
lines.push("통과군의 배수가 탈락군보다 크다. 필터는 KT 유동인구에서 신호가 잡힐 만큼 크고 날짜가 정렬된 축제를 남긴다. 그런 축제는 해마다 규모가 안정적이라 적중률을 **올리는** 방향(상향 편향)이다. −52주 근사 자체는 실제 기간과 어긋날 수 있어 적중률을 **낮추는** 방향(하향 편향)이다. **두 편향은 서로 반대 방향이며, 어느 쪽이 큰지는 재지 않았다.**");
lines.push("");
lines.push("## 3. 군포 3개년 — 실제 다년 표본 유일 사례 (근사 표본과 섞지 않음)");
lines.push("");
lines.push("| 연도 | 실측 최대일 배수 | 실측 평균 배수 |");
lines.push("|---|---|---|");
g.actualYears.forEach((y, i) => lines.push(`| ${y} | ${f2(g.actualPeak[i])} | ${f2(g.actualMean[i])} |`));
lines.push("");
lines.push(`- 2024·2025 실측 구간이 2026 을 덮는가: 최대일 **${g.actualCoverPeak ? "덮음" : "못 덮음"}** · 평균 **${g.actualCoverMean ? "덮음" : "못 덮음"}**`);
lines.push(`- 2026 기간을 −364·−728 옮긴 근사 최대일 배수: ${f2(g.approxPeak[0])} · ${f2(g.approxPeak[1])} → 근사 구간이 2026 을 덮는가: ${g.approxCoverPeak === null ? "—" : g.approxCoverPeak ? "덮음" : "못 덮음"}`);
lines.push(`- **−52주 근사(−364) 최대일 배수 − 2025 실측 최대일 배수 = ${f2(g.approxMinusActualPeak)}** (n=1). 군포는 4월 셋째~넷째 주말에 고정이라 −364일이 곧 작년 실제 기간이다. 이 한 건으로 근사 오차의 크기를 일반화하지 않는다.`);
lines.push("");
lines.push("## 4. 화면 문장 (두 화면이 같은 함수를 부른다)");
lines.push("");
lines.push(`> ${backtestSentence(RANGE_BACKTEST_PUBLISHED)}`);
lines.push("");
lines.push("## 5. 게시값 대조");
lines.push("");
const same = (a, b) => (a === b) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
const P = RANGE_BACKTEST_PUBLISHED;
const checks = [
  ["n=2 건수", P.n2.n, r.n2.n], ["n=2 최대일 적중", P.n2.hitsPeak, r.n2.hitsPeak], ["n=1 건수", P.n1.n, r.n1.n], ["n=1 최대일 적중", P.n1.hitsPeak, r.n1.hitsPeak],
  ["탈락", P.excluded.noWindow, r.excluded.noWindow], ["−728만", P.excluded.only728, r.excluded.only728],
];
lines.push("| 항목 | 게시 | 실측 | |");
lines.push("|---|---|---|---|");
for (const [k, a, b] of checks) lines.push(`| ${k} | ${a} | ${b} | ${same(a, b) ? "같음" : "**다름 — 상수를 갱신할 것**"} |`);
lines.push("");
lines.push("## 6. 표본 행 (n=2 · n=1, 축제별)");
lines.push("");
lines.push("| 축제 | 인구(만) | 올해 최대일 | −364 | −728 | 종류 | 구간 | 덮음 |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const x of r.rows.filter((x) => x.kind === "n2" || x.kind === "n1").sort((a, b) => a.name.localeCompare(b.name, "ko"))) {
  lines.push(`| ${x.name} | ${x.pop} | ${f2(x.thisPeak)} | ${f2(x.prior364)} | ${f2(x.prior728)} | ${x.kind} | ${x.bandPeak ? `${x.bandPeak.lo.toFixed(1)}~${x.bandPeak.hi.toFixed(1)}` : "—"} | ${x.hitPeak === null ? "—" : x.hitPeak ? "○" : "×"} |`);
}
lines.push("");
writeFileSync("docs/range_backtest.md", lines.join("\n") + "\n", "utf8");
console.log(`docs/range_backtest.md 작성 · 표본 ${r.n1.n + r.n2.n} (n2 ${r.n2.n} · n1 ${r.n1.n}) · 최대일 덮음 n2 ${pct(r.n2.coverPeak)} n1 ${pct(r.n1.coverPeak)}`);
