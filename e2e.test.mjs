// 핵심 흐름 하나를 자동으로 확인한다.
//   축제 조건을 저장한다 → 목록에 남는다 → 닮은 축제와 경보 등급이 보인다
//
// 새 라이브러리를 쓰지 않는다. next start 를 띄우고 fetch 로 Server Action 을
// 직접 부른다. DATABASE_URL 을 주지 않아 메모리 저장소로 돌아가므로 외부
// 호출이 없다 — 실행할 때마다 빈 상태에서 시작한다.
//
// 먼저 `npm run build` 가 돼 있어야 한다.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
let server;

async function 서버가뜰때까지(ms = 60000) {
  const 끝 = Date.now() + ms;
  while (Date.now() < 끝) {
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) return;
    } catch {
      // 아직 안 떴다
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("서버가 뜨지 않았다");
}

before(async () => {
  const env = { ...process.env };
  delete env.DATABASE_URL; // 메모리 저장소로 — 외부 호출 없음
  // .env.local 에 진짜 키가 꽂혀 있어도 이 테스트의 전제는 "키 없음"이다.
  // delete 로는 안 된다 — next start 가 .env.local 로 도로 채운다.
  // 빈 문자열로 덮어야 이미 있는 값으로 취급되어 파일이 못 건드린다.
  env.OPENROUTER_API_KEY = "";
  env.TOUR_API_KEY = "";
  server = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "--port", String(PORT)],
    { env, stdio: "ignore", shell: process.platform === "win32" },
  );
  await 서버가뜰때까지();
});

after(() => {
  if (!server?.pid) return;
  // Windows 에서는 shell:true 로 띄운 탓에 kill() 이 셸만 죽이고 next start 는
  // 살아남는다. 그러면 다음 실행이 그 유령에게 붙어 **옛 빌드를 테스트한다** —
  // 코드를 고쳐도 결과가 안 바뀌어서 원인을 찾는 데 한참 걸린다.
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      stdio: "ignore",
    });
  } else {
    server.kill();
  }
});

/**
 * 자바스크립트 없이 폼을 제출할 때 브라우저가 하는 것을 그대로 흉내낸다.
 * multipart/form-data 에 $ACTION_ID_<id> 필드를 얹어 보낸다.
 * Next-Action 헤더는 붙이지 않는다 — 그건 JS 가 있을 때 쓰는 경로다.
 */
async function 폼을낸다(경로, 값) {
  const html = await (await fetch(BASE + 경로)).text();
  const id = html.match(/\$ACTION_ID_([0-9a-f]+)/)?.[1];
  assert.ok(id, `폼에서 Server Action id 를 찾지 못했다 (${경로})`);

  const fd = new FormData();
  fd.set(`$ACTION_ID_${id}`, "");
  for (const [k, v] of Object.entries(값)) fd.set(k, v);

  return fetch(BASE + 경로, { method: "POST", body: fd, redirect: "manual" });
}

// 폼이 두 화면으로 갈렸다. 화면마다 액션 id 가 다르므로 경로를 함께 준다.
/** 확인·수정 화면(?manual=1)의 저장 액션 */
const 저장한다 = (값) => 폼을낸다("/?manual=1", 값);

/** 붙여넣기 화면(/)의 추출 액션 */
const 붙여넣는다 = (planText) => 폼을낸다("/", { planText });

/** "진단 이력 (N건)" 에서 N */
async function 건수() {
  const html = await (await fetch(BASE + "/")).text();
  const m = html.match(/진단 이력\s*(?:<!--\s*-->)?\s*\((\d+)건\)/);
  assert.ok(m, "진단 이력 건수를 읽지 못했다");
  return Number(m[1]);
}

test("핵심 흐름 — 조건을 저장하면 목록에 남고 경보 등급이 보인다", async () => {
  // 1. 이력이 비어 있으면 무엇을 하면 되는지 알려준다
  const 전건수 = await 건수();
  const 처음 = await (await fetch(BASE + "/")).text();
  assert.match(처음, /진단 이력/);
  if (전건수 === 0) {
    assert.match(처음, /아직 진단한 기획안이 없습니다/);
  }

  // 2. 김천 조건을 저장한다
  const res = await 저장한다({
    sido: "경북",
    sigungu: "김천시",
    month: "10",
    theme: "1",
    population: "14",
    accessibility: "2",
  });
  assert.ok(res.status < 500, `저장이 서버 오류로 끝났다 (${res.status})`);

  // 3. 목록에 남고, 닮은 축제와 등급이 함께 보인다
  const 뒤 = await (await fetch(BASE + "/")).text();
  assert.equal(await 건수(), 전건수 + 1, "저장이 목록에 반영되지 않았다");
  assert.match(뒤, /김천시/, "저장한 조건이 목록에 없다");
  assert.doesNotMatch(뒤, /아직 진단한 기획안이 없습니다/);
  assert.match(뒤, /경보|위험 근거 못 찾음|비교 대상 없음/, "등급이 안 보인다");
  assert.match(뒤, /왜 닮았나/, "근거가 안 보인다");
  assert.match(뒤, /배/, "평소 대비 배수가 안 보인다");

  // 4. 제품의 존재 이유 — 방문객 수를 만들어내지 않는다
  const 본문 = 뒤.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(본문, /\d+\s*명\s*(예상|올)/, "방문객 수 예측이 화면에 있다");
  assert.doesNotMatch(본문, /안전합니다|안전한/, "안전 판정을 하고 있다");
});

test("잘못된 값은 저장되지 않는다", async () => {
  const 전 = await (await fetch(BASE + "/")).text();
  const 전건수 = (전.match(/김천시/g) || []).length;

  await 저장한다({
    sido: "경북",
    sigungu: "김천시",
    month: "0", // 없는 달
    theme: "1",
    population: "14",
    accessibility: "99", // 범위 밖
  });

  const 후 = await (await fetch(BASE + "/")).text();
  const 후건수 = (후.match(/김천시/g) || []).length;
  assert.equal(후건수, 전건수, "잘못된 값이 저장됐다");
});

test("기획서를 붙여넣으면 뽑은 항목이 채워진 확인 화면으로 간다", async () => {
  // OPENROUTER_API_KEY 가 없으므로 모델을 부르지 않는다 — 고정 샘플로 떨어진다.
  // 이 테스트는 네트워크도 돈도 쓰지 않는다.
  const res = await 붙여넣는다(
    `제1회 김천김밥축제 추진계획
○ 개최기간: 2024년 10월 중 3일간
○ 개최장소: 경상북도 김천시 일원
○ 주요내용: 지역 특산물인 김밥을 주제로 한 음식 축제`,
  );
  assert.ok(res.status < 500, `추출이 서버 오류로 끝났다 (${res.status})`);

  // 초안 화면으로 넘어가야 한다
  const 확인 = await (await fetch(BASE + "/?draft=1")).text();
  assert.match(확인, /뽑은 항목 확인/, "확인 화면이 아니다");
  assert.match(확인, /이 기획안 진단하기/, "진단 버튼이 없다");

  // 뽑은 값이 폼에 채워져 있어야 한다 — 비어 있으면 추출한 의미가 없다
  assert.match(확인, /value="김천시"/, "뽑은 시군구가 폼에 안 채워졌다");

  // 값만 던지지 않는다. 어디서 나왔는지 같이 낸다 (암묵지 2)
  assert.match(확인, /class="evidence"/, "근거가 화면에 없다");

  // 샘플이라는 사실을 숨기지 않는다
  assert.match(확인, /고정 샘플/, "샘플이라는 표시가 없다");
});

test("너무 짧은 입력은 모델을 부르지 않고 되돌려보낸다", async () => {
  const res = await 붙여넣는다("축제");
  assert.ok(res.status < 500, `서버 오류로 끝났다 (${res.status})`);

  const 화면 = await (await fetch(BASE + "/?err=%EB%84%88%EB%AC%B4")).text();
  assert.match(화면, /기획서 붙여넣기/, "붙여넣기 화면으로 돌아오지 않았다");
});
