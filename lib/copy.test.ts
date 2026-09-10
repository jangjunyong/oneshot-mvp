// 화면 문구 규약의 기계 검사 (verdict 2026-09-09 §4 M2).
//
// 이 테스트는 코드가 아니라 화면 소스 파일의 문구를 읽는다. 문구가 판정
// 규율(불문율 4 — 재지 않은 것을 단언하지 않는다, 그리고 "무엇을 내는가"가
// "무엇을 안 하는가"보다 먼저)을 어기면 여기서 깨진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

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
