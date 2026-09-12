// 흑백 + 파란 핀 규율(2026-09-12 사용자 지시 8·4)의 기계 검사.
//
// 유채색은 --accent* 세 토큰에만 있고, 그 토큰은 지도 핀·"당신의 위치" 표식에만 쓴다.
// CSS 만 보면 캔버스 코드의 하드코딩 색이 새므로 tsx 도 훑는다(히트맵·3D 선택 마커는 예외 목록으로 명시).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

function walk(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function hexIsChromatic(hex: string): boolean {
  const h = hex.length === 4 ? hex.split("").map((c) => c + c).join("").slice(1) : hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) > 12;
}

test("D-1 design-system.css 의 유채색 토큰은 --accent 셋뿐이다", () => {
  const css = read("app/design-system.css");
  const chromatic = [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g)].filter((m) => hexIsChromatic(m[2])).map((m) => m[1]);
  assert.deepEqual(chromatic.sort(), ["accent", "accent-deep", "accent-light"], chromatic.join(","));
});

test("D-2 app/**/*.{css,tsx} 에 하드코딩 유채색이 없다 (예외: 3D 지도 선택 마커·도면 편집기·밀도 히트맵)", () => {
  const EXEMPT = ["app/design-system.css", "app/twin-map-3d.tsx", "app/venue/editor.tsx", "app/venue/sim-map.tsx"]; // 토큰 정의 파일은 D-1 이 잰다
  const bad: string[] = [];
  for (const f of walk("app", [".css", ".tsx"])) {
    if (EXEMPT.includes(f)) continue;
    const src = read(f);
    for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g)) {
      if (hexIsChromatic(m[0])) bad.push(`${f}: ${m[0]}`);
    }
    for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 12) bad.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("D-3 --accent 는 지도 핀·'당신의 위치' 표식에만 쓴다 — 버튼·링크·경보에는 안 쓴다", () => {
  const css = read("app/globals.css");
  const lines = css.split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => /var\(--accent/.test(l));
  for (const [n, l] of lines) {
    const ctx = css.split("\n").slice(Math.max(0, n - 4), n).join("\n");
    assert.ok(/map-origin|pin|peer-me/.test(ctx + l), `globals.css:${n} 에서 accent 를 다른 곳에 썼다: ${l.trim()}`);
  }
  assert.ok(lines.length >= 4, "핀·선택 핀·또래 표식에 accent 가 안 붙었다");
});

test("D-4 판정 7종은 data-label 형태 어휘를 갖고, 화면은 data-label 을 붙인다", () => {
  const css = read("app/globals.css");
  for (const label of ["상한 초과", "과대", "주의", "과소", "통과", "근거 없음", "단위 미상"]) {
    assert.ok(css.includes(`[data-label="${label}"]`), `globals.css 에 ${label} 형태 규칙이 없다`);
  }
  assert.ok(read("app/check/page.tsx").includes("data-label={visitors.verdict.label}"), "/check 판정 알림에 data-label 이 없다");
  assert.ok(read("app/report/check/page.tsx").includes("data-label={최종}"), "/report/check 결론에 data-label 이 없다");
  assert.ok(read("app/twin-map.tsx").includes('className="pin-body"'), "지도에 파란 핀이 없다");
});
