// 심사위원 안내 문서의 숫자는 코드가 만든다 — 손글씨 숫자가 생기면 여기서 깨진다 (2026-09-12 F)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { judgeGuideMarkdown } from "@/lib/judgeguide";

test("J-1 docs/심사위원_시연안내.md 는 judgeGuideMarkdown() 과 글자까지 같다", () => {
  const p = "docs/심사위원_시연안내.md";
  assert.ok(existsSync(p), `${p} 가 없다 — scripts/judge-guide.mjs 를 돌려라`);
  assert.equal(readFileSync(p, "utf8").replace(/\r\n/g, "\n"), judgeGuideMarkdown());
});

test("J-2 안내에는 예측·안전 단언이 없고 시뮬 가정의 출처 없음이 적혀 있다", () => {
  const md = judgeGuideMarkdown();
  assert.doesNotMatch(md, /안전합니다|안전한 배치/);
  assert.match(md, /출처 없는 가정/);
  assert.match(md, /방문객 수를 예측하지 않습니다/);
  assert.match(md, /oneshot-mvp\.vercel\.app/);
});
