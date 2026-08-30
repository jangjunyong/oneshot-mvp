// 검색량이 실측 방문 배수를 설명하는가 — 붙일지 말지를 정하는 실험.
//
// 우리에겐 정답지가 있다. 619건의 actualVisitSurge 는 KT 이동통신 실측이다.
// 그래서 검색량이 쓸모 있는지 **추측하지 않고 상관을 재서** 정할 수 있다.
// 상관이 없으면 이 축은 버린다 — 그게 이 스크립트의 존재 이유다.
//
// 동시에 사용자의 물음도 끝낸다: "타겟이 고령이면 검색량에 안 잡히지 않나."
// 연령 필터(11 = 60세 이상)로 테마별 고령층 비중을 잰다.
//
// ── 쓰는 법 ──
//   1. NCP 콘솔 → **NAVER API HUB** → Subscription 이용 신청 →
//      Application 등록에서 Data Lab 검색어트렌드 선택 → 인증 정보
//      (AI·NAVER API 메뉴가 아니다 — lib/searchvolume.ts 머리말)
//   2. .env.local 에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
//   3. node --env-file=.env.local --experimental-strip-types --no-warnings \
//        --import ./test-loader.mjs evals/search-volume.mjs [표본수]
//
// 데이터랩은 하루 호출 한도가 있다. 표본을 크게 잡지 말 것 — 기본 40건이고
// 축제 하나당 2회(전체·60세 이상) 부른다.

import { FESTIVALS } from "../lib/festivals.ts";
import {
  buildTrendBody,
  fetchTrend,
  hasNaverKey,
  leadRatio,
} from "../lib/searchvolume.ts";

const N = Number(process.argv[2] ?? 40);
const LEAD_DAYS = 7;
/** 평소 구간을 넉넉히 두려고 개최 8주 전부터 본다 */
const BASELINE_WEEKS = 8;

if (!hasNaverKey()) {
  console.error(
    "네이버 키가 없다. .env.local 에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 을 넣고\n" +
      "node --env-file=.env.local ... 로 실행할 것.",
  );
  process.exit(1);
}

const ymd = (d) => d.toISOString().slice(0, 10);
const 날짜 = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);

/** 피어슨 상관 */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/** 스피어만 순위상관 — 이상치에 덜 흔들린다 */
function spearman(xs, ys) {
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    idx.forEach(([, i], k) => (r[i] = k + 1));
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

// 배수가 고른 표본을 뽑는다 — 높은 것만 보면 상관이 부풀려진다.
//
// 처음엔 `filter(i % 간격 === 0).slice(0, N)` 이었는데 **틀렸다.** 619건에
// N=120 이면 간격 5 라 filter 가 124건을 만들고 slice 가 뒤 4건을 잘랐다.
// 배수 오름차순이라 잘린 것이 가장 높은 쪽(2.27·2.37·2.56·2.77)이었고,
// 표본 최대가 2.20 인데 전체 최대는 3.28 이었다. 제품이 정작 관심 있는
// 고배수 구간이 빠진 채로 상관을 잰 셈이다 — 범위 제한은 상관을 **낮은
// 쪽으로 끌어내린다.** 양 끝을 반드시 포함하도록 자리를 직접 계산한다.
const 정렬 = [...FESTIVALS].sort((a, b) => a.actualVisitSurge - b.actualVisitSurge);
const 뽑을수 = Math.min(N, 정렬.length);
const 자리 = new Set();
for (let k = 0; k < 뽑을수; k++) {
  자리.add(뽑을수 === 1 ? 0 : Math.round((k * (정렬.length - 1)) / (뽑을수 - 1)));
}
const 표본 = [...자리].map((i) => 정렬[i]);

console.log(`표본 ${표본.length}건 · 개최 전 ${LEAD_DAYS}일 vs 평소 ${BASELINE_WEEKS}주\n`);

const rows = [];
const 건너뜀 = [];
for (const f of 표본) {
  const 개최 = 날짜(f.eventStartDate);
  const 시작 = new Date(개최);
  시작.setDate(시작.getDate() - BASELINE_WEEKS * 7);
  const 끝 = new Date(개최);
  끝.setDate(끝.getDate() - 1);

  try {
    const 전체 = await fetchTrend(
      buildTrendBody(f.name, ymd(시작), ymd(끝)),
    );
    const 고령 = await fetchTrend(
      buildTrendBody(f.name, ymd(시작), ymd(끝), ["11"]),
    );

    const lr = leadRatio(전체, f.eventStartDate, LEAD_DAYS);
    if (lr === null) {
      // 건너뛴 것도 세어 둔다. 검색량이 0 인 축제가 특정 배수 구간에
      // 몰려 있으면 남은 표본으로 잰 상관은 그만큼 거짓이다(생존 편향).
      건너뜀.push(f.actualVisitSurge);
      console.log(`  건너뜀 ${f.name} — 표본 부족(검색량이 거의 0)`);
      continue;
    }
    // 상대값이라 전체와 고령의 합을 직접 비교하진 못한다. 개최 전 구간의
    // 고령 배수가 전체 배수보다 낮으면 "고령은 덜 검색한다"의 신호다
    const lrOld = leadRatio(고령, f.eventStartDate, LEAD_DAYS);

    rows.push({
      name: f.name,
      theme: f.themeCode,
      surge: f.actualVisitSurge,
      searchRatio: lr.ratio,
      oldRatio: lrOld?.ratio ?? null,
    });
    console.log(
      `  ${f.name.slice(0, 20).padEnd(22)} 실측 ${f.actualVisitSurge.toFixed(2)}배 · ` +
        `검색 ${lr.ratio.toFixed(2)}배` +
        (lrOld ? ` · 60세+ ${lrOld.ratio.toFixed(2)}배` : " · 60세+ 표본없음"),
    );
  } catch (e) {
    console.log(`  실패 ${f.name}: ${String(e).slice(0, 60)}`);
  }
}

if (rows.length < 3) {
  console.log("\n표본이 모자라 상관을 못 낸다.");
  process.exit(0);
}

const xs = rows.map((r) => r.searchRatio);
const ys = rows.map((r) => r.surge);

console.log(`\n=== 검색량 배수 vs 실측 방문 배수 (n=${rows.length}) ===`);
console.log(`  피어슨   r = ${pearson(xs, ys)?.toFixed(3) ?? "—"}`);
console.log(`  스피어만 ρ = ${spearman(xs, ys)?.toFixed(3) ?? "—"}`);

const 요약 = (a) => {
  if (a.length === 0) return "없음";
  const s = [...a].sort((x, y) => x - y);
  return `n=${s.length} · 중앙 ${s[Math.floor(s.length / 2)].toFixed(2)}배 · ` +
    `2.0 이상 ${s.filter((v) => v >= 2).length}건`;
};
console.log(
  "\n=== 생존 편향 점검 ===\n" +
    `  상관에 든 것        ${요약(rows.map((r) => r.surge))}\n` +
    `  검색량 0 이라 뺀 것  ${요약(건너뜀)}\n` +
    "  뺀 쪽이 고배수에 몰려 있으면 위 상관은 그만큼 못 믿는다.",
);

const 고령있음 = rows.filter((r) => r.oldRatio !== null);
if (고령있음.length >= 3) {
  const 낮음 = 고령있음.filter((r) => r.oldRatio < r.searchRatio).length;
  console.log(
    `\n=== 60세 이상 (n=${고령있음.length}) ===\n` +
      `  개최 전 배수가 전체보다 낮은 축제: ${낮음}/${고령있음.length}` +
      ` (${((낮음 / 고령있음.length) * 100).toFixed(0)}%)`,
  );
}

console.log(
  "\n판정 기준 — |ρ| 가 0.3 을 넘지 못하면 이 축은 버린다.\n" +
    "검색량은 관심이지 방문이 아니고, 우리에겐 이미 KT 이동통신 실측이 있다.",
);
