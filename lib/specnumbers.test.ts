// 기능설명서의 숫자·절 제목이 코드에서 생성한 값과 같은가 (verdict 2026-09-09 §4 M12-1·2·3, 축약본).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { specNumbers } from "@/lib/specnumbers";

const DOC = readFileSync("docs/기능설명서.md", "utf8");
const HASHTAGS = ["#사전 수요 예측", "#보완 피드백 제공", "#데이터 기반", "#축제/행사 기획"];

test("M12-2 문서의 숫자는 코드·자료·테스트 수에서 생성한 문자열과 글자까지 같다", () => {
  const missing = Object.entries(specNumbers()).filter(([, v]) => !DOC.includes(v));
  assert.deepEqual(missing, [], `문서에 없거나 낡은 값: ${missing.map(([k, v]) => `${k}=${v}`).join(" · ")}`);
});

test("M12-1 §4 절 제목은 해시태그 4개로 시작하고 옛 절 제목은 없다", () => {
  const h3 = DOC.split("\n").filter((l) => l.startsWith("### "));
  for (const tag of HASHTAGS) assert.ok(h3.some((l) => l.startsWith(`### ${tag}`)), `${tag} 절이 없다`);
  for (const old of ["4-1. 진단 —", "4-2. 왜 닮았나", "4-3. 지도", "4-4. 같은 시기", "4-5. 시기 민감도", "4-6. 감당 범위", "4-7. 행사장 도면", "4-8. 진단서 A4 한 장"]) {
    assert.ok(!DOC.includes(`### ${old}`), `옛 절 제목이 남았다: ${old}`);
  }
});

test("M12-3 '화면 숫자는 넷뿐' 문장이 없고 새 판정 둘이 있다", () => {
  assert.ok(!DOC.includes("네 가지뿐"), "옛 규칙 문장이 남았다");
  assert.ok(DOC.includes("사람 수(명)와 금액(원)이 붙은 숫자가 0건"), "새 판정 ②가 없다");
  assert.ok(DOC.includes("되짚어지는가"), "새 판정 ①이 없다");
});

test("문서에 '성립 불가'·'신뢰도 높음'·'축제 위험 경보 — 기능설명서' 가 없다", () => {
  for (const bad of ["성립 불가", "신뢰도 높음", "# 축제 위험 경보 — 기능설명서"]) assert.ok(!DOC.includes(bad), bad);
});
