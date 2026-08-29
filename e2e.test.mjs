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
  assert.match(뒤, /class="map"/, "지도가 안 보인다");

  // 4. 제품의 존재 이유 — 방문객 수를 만들어내지 않는다
  const 본문 = 뒤.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(본문, /\d+\s*명\s*(예상|올)/, "방문객 수 예측이 화면에 있다");
  assert.doesNotMatch(본문, /안전합니다|안전한/, "안전 판정을 하고 있다");

  // 5. 시연 중 쌓인 것을 그 자리에서 지울 수 있다 (screens.md 구멍 B-1)
  const entryId = 뒤.match(/name="entryId" value="(\d+)"/)?.[1];
  assert.ok(entryId, "지우기 폼이 이력에 없다");
  const 지우기폼 = 뒤
    .split("<form")
    .find((c) => c.includes(`name="entryId" value="${entryId}"`));
  const 지우기액션 = 지우기폼?.match(/\$ACTION_ID_([0-9a-f]+)/)?.[1];
  assert.ok(지우기액션, "지우기 폼에서 Server Action id 를 찾지 못했다");

  const fd = new FormData();
  fd.set(`$ACTION_ID_${지우기액션}`, "");
  fd.set("entryId", entryId);
  const 삭제 = await fetch(BASE + "/", {
    method: "POST",
    body: fd,
    redirect: "manual",
  });
  assert.ok(삭제.status < 500, `지우기가 서버 오류로 끝났다 (${삭제.status})`);
  assert.equal(await 건수(), 전건수, "지웠는데 건수가 돌아오지 않았다");
});

test("지도는 한 장이고, 핀을 누르면 그 축제의 근거가 펴진다", async () => {
  await 저장한다({
    sido: "경북", sigungu: "김천시", month: "10",
    theme: "1", population: "14", accessibility: "2",
  });

  const 홈 = await (await fetch(BASE + "/")).text();

  // 이력이 몇 건이든 지도는 하나다 — 썸네일이 이력마다 깔리면 아무것도 안 읽힌다
  assert.equal(
    (홈.match(/class="map"/g) || []).length,
    1,
    "지도가 한 장이 아니다",
  );

  // 요약 행은 등급만 남기지 않는다. 근거 한 조각(배수)이 같이 있어야 한다
  assert.match(홈, /평소 대비 \d+\.\d+배/, "요약에 근거가 없다");

  // 같은 시기 경쟁은 공사 OpenAPI 가 있어야 되는 기능이다. 이 테스트는
  // 키 없음이 전제이므로 섹션째 없어야 한다 — 없는 기능을 광고하지 않는다
  assert.doesNotMatch(
    홈,
    /같은 시기 경쟁/,
    "키가 없는데 경쟁 섹션이 떴다",
  );

  // 핀은 자바스크립트 없이 눌린다 — 링크가 실제 주소여야 한다
  const 핀 = 홈.match(/href="\/\?entry=(\d+)&(?:amp;)?pin=([^"#]+)#twin"/);
  assert.ok(핀, "핀에 걸린 주소가 없다");

  const 펴짐 = await (
    await fetch(`${BASE}/?entry=${핀[1]}&pin=${핀[2]}#twin`)
  ).text();
  assert.match(펴짐, /핀 선택 해제/, "핀을 눌러도 상세가 펴지지 않는다");
  assert.match(펴짐, /class="pin-card"/, "고른 축제의 근거 카드가 없다");

  // 등록 정보(개최·장소·주최)는 공사 OpenAPI 몫이다. 키가 없으면 그 줄들만
  // 빠지고 카드는 우리가 잰 값(배수·닮은 축)으로 그대로 서야 한다
  assert.doesNotMatch(펴짐, /class="pin-detail"/, "키가 없는데 등록 정보가 떴다");
  assert.match(펴짐, /평소 대비/, "키가 없다고 우리 실측까지 사라지면 안 된다");
  assert.equal(
    (펴짐.match(/class="map"/g) || []).length,
    1,
    "핀을 눌렀더니 지도가 늘었다",
  );
});

test("진단서 한 장 — 결론과 근거와 한계가 자바스크립트 없이 나온다", async () => {
  await 저장한다({
    sido: "경북", sigungu: "김천시", month: "10",
    theme: "1", population: "14", accessibility: "2",
  });
  const 홈 = await (await fetch(BASE + "/")).text();
  const id = 홈.match(/name="entryId" value="(\d+)"/)?.[1];
  assert.ok(id, "진단 이력이 없다");

  // 진단 화면에서 진단서로 가는 길이 있어야 한다
  assert.match(홈, /report\?entry=/, "진단서로 가는 링크가 없다");

  const res = await fetch(`${BASE}/report?entry=${id}`);
  assert.equal(res.status, 200);
  const 진단서 = await res.text();

  assert.match(진단서, /축제 위험 경보 진단서/, "표제가 없다");
  assert.match(진단서, /경북/, "대상이 안 적혀 있다");
  assert.match(진단서, /근거 1/, "닮은 축제 근거가 없다");
  assert.match(진단서, /근거 3/, "도면 근거 칸이 없다");
  assert.match(진단서, /배/, "실측 배수가 없다");
  assert.match(진단서, /한국관광공사/, "출처가 없다");

  // 진단서에서도 제품의 선은 같다 — 예측하지 않고, 안전하다고 말하지 않는다
  assert.match(진단서, /예측하지 않습니다/, "한계 고지가 없다");
  const 본문 = 진단서.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(본문, /\d+\s*명\s*(예상|올)/, "방문객 수 예측이 있다");

  // 없는 진단을 부르면 죽지 않고 되돌려보낸다
  const 없는것 = await fetch(`${BASE}/report?entry=999999`);
  assert.ok(없는것.status < 500, `없는 진단에서 서버 오류 (${없는것.status})`);
  assert.match(await 없는것.text(), /진단서를 만들 수 없습니다/);
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

test("도면 화면이 뜨고, 진단 이력에서 도면으로 가는 길이 있다", async () => {
  const 도면 = await (await fetch(BASE + "/venue")).text();
  assert.match(도면, /행사장 도면/, "도면 화면이 안 뜬다");

  // 캔버스는 클라이언트 몫이라 SSR 본문엔 로딩 문구까지만 있으면 된다
  assert.match(도면, /편집기를 불러오는 중|venue-layout/, "편집기 자리가 없다");

  // 이력이 있어야 링크가 보인다 — 하나 만들었다가 치운다
  await 저장한다({
    sido: "경북", sigungu: "김천시", month: "10",
    theme: "1", population: "14", accessibility: "2",
  });
  const 홈 = await (await fetch(BASE + "/")).text();
  assert.match(홈, /행사장 도면/, "이력에서 도면으로 가는 링크가 없다");
  assert.match(홈, /venue\?entry=/, "링크가 진단 이력과 연결돼 있지 않다");
});

test("너무 짧은 입력은 모델을 부르지 않고 되돌려보낸다", async () => {
  const res = await 붙여넣는다("축제");
  assert.ok(res.status < 500, `서버 오류로 끝났다 (${res.status})`);

  const 화면 = await (await fetch(BASE + "/?err=%EB%84%88%EB%AC%B4")).text();
  assert.match(화면, /기획서 붙여넣기/, "붙여넣기 화면으로 돌아오지 않았다");
});
