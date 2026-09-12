// 화면 문구 규약의 기계 검사 (verdict 2026-09-09 §4 M2).
//
// 이 테스트는 코드가 아니라 화면 소스 파일의 문구를 읽는다. 문구가 판정
// 규율(불문율 4 — 재지 않은 것을 단언하지 않는다, 그리고 "무엇을 내는가"가
// "무엇을 안 하는가"보다 먼저)을 어기면 여기서 깨진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

/** 하위 폴더까지 .tsx 전부 — 파일 목록을 손으로 적으면 새 화면이 검사 밖에 남는다 */
function allTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...allTsx(p));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** JSX 소스에서 첫 문단을 뽑는다 — `.lede` 가 있으면 그것, 없으면 <h1> 뒤 첫 <p>. */
function firstParagraph(src: string): string {
  const lede = src.match(/<p className="lede">([\s\S]*?)<\/p>/);
  let body: string;
  if (lede) body = lede[1];
  else {
    const h1 = src.indexOf("<h1");
    assert.ok(h1 >= 0, "h1 이 없다");
    const m = src.slice(h1).match(/<p[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(m, "h1 뒤 <p> 가 없다");
    body = m[1];
  }
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SCREENS: Record<string, string> = {
  "/": "app/page.tsx",
  "/check": "app/check/page.tsx",
  "/venue": "app/venue/page.tsx",
  "/report/check": "app/report/check/page.tsx",
  "/report": "app/report/page.tsx",
};

test("M2-1 첫 문단의 첫 문장에 '예측하지 않'이 없고, 있다면 '몇 배'·'구간' 이 그보다 앞이다", () => {
  for (const [route, file] of Object.entries(SCREENS)) {
    const p = firstParagraph(read(file));
    const first = p.split(/(?<=[.!?])\s+/)[0];
    assert.ok(!/예측하지 않/.test(first), `${route} 첫 문장이 부정형으로 시작한다: ${first}`);
    const neg = p.indexOf("예측하지 않");
    if (neg >= 0) {
      const a = p.indexOf("몇 배");
      const b = p.indexOf("구간");
      assert.ok(a >= 0 && a < neg, `${route}: '몇 배' 가 '예측하지 않' 앞에 없다\n${p}`);
      assert.ok(b >= 0 && b < neg, `${route}: '구간' 이 '예측하지 않' 앞에 없다\n${p}`);
    }
  }
});

test("M2-2 두 보고서의 출처 고지 문장은 그대로 있다", () => {
  assert.ok(
    read("app/report/check/page.tsx").includes("<strong>방문객 수를 예측하지 않습니다.</strong> 이 문서의 명 수는 담당자 입력값이거나 공사 실측값이며"),
    "/report/check 출처 고지가 사라졌다",
  );
  assert.ok(
    read("app/report/page.tsx").includes("<strong>방문객 수를 예측하지 않습니다.</strong> 화면과 이 문서의 숫자는"),
    "/report 출처 고지가 사라졌다",
  );
});

test("M2-3 기능설명서에 '무엇을 하지 않는가' 절 제목이 없다", () => {
  const lines = read("docs/기능설명서.md").split("\n").filter((l) => /^#+\s/.test(l));
  assert.deepEqual(lines.filter((l) => l.includes("무엇을 하지 않는가")), []);
});

test("M2-4 도면 화면의 '담당자 말' 은 접촉 기록(docs/interviews.md) 없이는 쓰지 않는다", () => {
  const src = read("app/venue/sim-map.tsx");
  if (!existsSync("docs/interviews.md")) {
    const hits = src.split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => /담당자 말/.test(l));
    assert.deepEqual(hits, [], "접촉 기록이 없는데 '담당자 말' 을 출처로 세웠다");
  }
});

// ── M4 로고·나침반 통일 (verdict §4 M4) ─────────────────────────────────────
const ALL_SCREENS = { ...SCREENS, "/evidence": "app/evidence/page.tsx" };

test("M4-1 여섯 화면의 .logo 문자열이 하나다", () => {
  const logos = new Set<string>();
  for (const [route, file] of Object.entries(ALL_SCREENS)) {
    const m = read(file).match(/className="logo">([^<]+)</);
    assert.ok(m, `${route} 에 .logo 가 없다`);
    logos.add(m[1].trim());
  }
  assert.equal(logos.size, 1, [...logos].join(" | "));
});

test("M4-2 나침반 순서는 /check → /evidence → /venue → /(보조)", () => {
  for (const file of ["app/page.tsx", "app/check/page.tsx", "app/evidence/page.tsx", "app/venue/page.tsx"]) {
    const nav = read(file).match(/<nav>([\s\S]*?)<\/nav>/);
    assert.ok(nav, `${file} 에 nav 가 없다`);
    const links = [...nav[1].matchAll(/<Link href=\{?[`"]([^`"$?]+)[^>]*>([\s\S]*?)<\/Link>/g)].map((m) => [m[1], m[2].replace(/\s+/g, " ").trim()]);
    assert.deepEqual(links.map((l) => l[0]), ["/check", "/evidence", "/venue", "/"], `${file}: ${JSON.stringify(links)}`);
    assert.ok(links[3][1].includes("보조"), `${file}: '/' 항목에 '보조' 가 없다`);
  }
});

test("M4-3 옛 진단서 상단에 검증 보고서 링크와 '보조 근거 진단서' 문구", () => {
  const src = read("app/report/page.tsx");
  assert.ok(src.includes('href="/report/check'), "/report/check 링크가 없다");
  assert.ok(src.includes("보조 근거 진단서"), "'보조 근거 진단서' 문구가 없다");
});


// ── 2026-09-10 엔드포인트별 적대적 검증(docs/critic_endpoints_2026-09-10.md)에서 확정한 결함 ──
test("V1-1 철회한 임계 근거 0.2674 가 화면·문서에 없다 (정정값 0.2371)", () => {
  for (const f of ["app/report/page.tsx", "docs/기능설명서.md"]) {
    assert.ok(!read(f).includes("0.2674"), `${f} 에 옛 값이 남았다`);
  }
});

test("V1-2 내부 상태·옛 이름이 화면 문자열에 없다", () => {
  const app = ["app/page.tsx", "app/venue/page.tsx", "app/report/check/page.tsx", "lib/store.ts"].map(read).join("\n");
  for (const bad of ["DATABASE_URL 없음", "축제 위험 경보 · 기획안 팩트체크", "<dd>축제 위험 경보</dd>"]) {
    assert.ok(!app.includes(bad), `남은 문자열: ${bad}`);
  }
});

test("V1-3 모노 서체 사슬에 한글 글리프 서체가 있고 세리프 변수는 로드된 서체를 쓴다", () => {
  const css = read("app/design-system.css");
  const mono = css.match(/--font-mono:\s*([^;]+);/)![1];
  assert.match(mono, /IBM Plex Sans KR|Pretendard/, mono);
  const serif = css.match(/--font-serif:\s*([^;]+);/)![1];
  assert.ok(!/Noto Serif KR/.test(serif) || /var\(--font-/.test(serif), serif);
});

test("V1-4 보고서 2장 각주는 두 API 를 구분해 적고, 619 적중률 문단은 보조 근거임을 먼저 말한다", () => {
  assert.ok(read("app/report/check/page.tsx").includes("TourAPI · {KT_API}"), "TourAPI 와 DataLab 이 붙어 있다");
  const p = read("app/page.tsx");
  const i = p.indexOf("LOO_PUBLISHED.lift");
  assert.ok(i > 0 && p.slice(Math.max(0, i - 400), i).includes("보조 근거"), "619 적중률 앞에 '보조 근거' 가 없다");
});

test("V1-5 화면마다 metadata title 이 다르다", () => {
  const titles = new Set<string>();
  for (const f of ["app/check/page.tsx", "app/evidence/page.tsx", "app/venue/page.tsx", "app/report/page.tsx", "app/report/check/page.tsx"]) {
    const m = read(f).match(/export const metadata[^=]*=\s*\{[^}]*title:\s*"([^"]+)"/);
    assert.ok(m, `${f} 에 metadata.title 이 없다`);
    titles.add(m[1]);
  }
  assert.equal(titles.size, 5);
});

test("V1-6 /venue: 스트레스 중엔 재생이 막히고, 유입 배열·밀도 등급의 출처 문구가 있다", () => {
  const s = read("app/venue/sim-map.tsx");
  assert.ok(s.includes("disabled={running || !ready || !!stressMsg}"), "스트레스 중 재생이 안 막힌다");
  assert.ok(s.includes("출처 없음"), "유입 배열에 출처 없음 표기가 없다");
  assert.ok(s.includes("행안부"), "밀도 등급 출처가 화면에 없다");
  assert.ok(s.includes("상한 배수 과소"), "Weidmann 편향 방향이 없다");
});


test("M6-3 옛 라벨 '성립 불가' 와 가정 회전율 구간 '1.0~2.0' 이 코드·화면·e2e 에 없다", () => {
  // 2026-09-12: 목록에 app/page.tsx 가 없어 홈 카드의 옛 라벨(줄바꿈으로 갈라져 grep 도 못 잡던)이 9/10 이후로 살아 있었다. app/**/*.tsx 전수로
  const files = ["lib/verdict.ts", "lib/budget.ts", "app/layout.tsx", "e2e.test.mjs", "lib/verdict.test.ts", "lib/budget.test.ts", ...allTsx("app")];
  for (const f of files) {
    const s = read(f).replace(/\s+/g, " ");
    assert.ok(!s.includes("성립 불가"), `${f} 에 '성립 불가' 가 남았다`);
    assert.ok(!s.includes("1.0~2.0"), `${f} 에 가정 회전율 구간이 있다`);
  }
});

test("M6-5 단위 안내에 '둘 다 골라야 판정한다' 와 회전율 한 줄이 있다", () => {
  const s = read("app/check/page.tsx");
  assert.ok(s.includes("둘 다 골라야 판정한다"));
  assert.ok(s.includes("이 선택이 손익분기 회전율 표시를 바꾼다"));
});


// 2026-09-12 사용자 지시 6 — 공사 데이터가 이 판정의 어디에 쓰였는지 한 블록으로. 접힘 밖, 판정표 위
test("M0-데이터활용 블록이 있고 공사 엔드포인트 3종·빌드 전 적재·모델 0회가 적혀 있다", () => {
  const comp = read("app/_components/data-usage.tsx");
  for (const must of ["KT_API", "searchFestival2", "데이터랩 축제 목록", "빌드 전", "모델은 부르지 않는다", "coverageStats"]) {
    assert.ok(comp.includes(must), `data-usage.tsx 에 "${must}" 가 없다`);
  }
  const check = read("app/check/page.tsx");
  const use = check.indexOf("<DataUsage");
  const table = check.indexOf('<table className="report-table check-table">');
  assert.ok(use > 0 && table > use, "DataUsage 가 판정표 앞에 없다");
  assert.ok(!/<details[^>]*>[\s\S]*<DataUsage/.test(check.slice(0, use).slice(-2000)), "DataUsage 가 details 안에 있다");
});

test("M0-검색삭제 축제 검색 절과 선택 액션이 없다 (사용자 지시 3)", () => {
  assert.ok(!read("app/page.tsx").includes("등록된 축제에서 찾기"), "축제 검색 절이 남았다");
  assert.ok(!read("app/actions.ts").includes("export async function 선택"), "선택 액션이 남았다");
});

test("M0-개명 나침반과 화면 제목이 '시뮬레이션'이고 '행사장 도면'은 화면 문구에 없다 (사용자 지시 7)", () => {
  for (const f of allTsx("app")) {
    const s = read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    assert.ok(!s.includes("행사장 도면"), `${f} 에 '행사장 도면' 이 남았다`);
  }
  assert.ok(read("app/venue/page.tsx").includes("<h1>시뮬레이션</h1>"));
});
