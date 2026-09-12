// 핵심 흐름을 자동으로 확인한다 (2026-09-12 A2 뒤).
//   기획서를 넣는다 → 판정(/check)으로 간다 → 판정·닮은 축제·시뮬 요약이 한 화면에 선다
// 옛 첫 화면(진단 이력·5축 폼·지도)은 지웠으므로 그 검사 7건도 지웠다 — 닮은 축제는 /check 검사가 잰다
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

/** 붙여넣기 화면(/)의 추출 액션 */
const 붙여넣는다 = (planText) => 폼을낸다("/", { planText });

test("첫 화면 — PDF 입력과 붙여넣기만 있고, 견본 버튼·데이터 설명·한도 문구·옛 진단 이력은 없다", async () => {
  const 홈 = (await (await fetch(BASE + "/")).text()).replace(/<!--\s*-->/g, "");
  assert.match(홈, /type="file"[^>]*accept="application\/pdf"/, "PDF 입력이 없다");
  assert.match(홈, /name="planText"/, "붙여넣기 칸이 없다");
  for (const gone of ["진단 이력", "직접 입력하기", "manual=1", "시연용 예시", "등록된 축제에서 찾기", 'class="map"', "견본으로 먼저 보기", "데이터 셋", "하루 45건", "스캔본 제외", "demo=hwacheon", 'href="/form"']) {
    assert.ok(!홈.includes(gone), `첫 화면에 없어야 할 조각이 있다: ${gone}`);
  }
  const 본문 = 홈.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(본문, /\d[\d,]*\s*명/, "첫 화면에 명 수가 있다");
});

test("견본 진단서와 견본 도면은 링크 없이도 선다 (옛 보조 경로의 잔존 확인)", async () => {
  const 진단서 = await (await fetch(BASE + "/report?entry=demo")).text();
  assert.match(진단서, /시연용 예시/, "진단서에 예시 표시가 없다");
  assert.match(진단서, /결재용 아님/, "꼬리말에 견본 표시가 없다");
  const 없는것 = await fetch(`${BASE}/report?entry=999999`);
  assert.ok(없는것.status < 500, `없는 진단에서 서버 오류 (${없는것.status})`);
  assert.match(await 없는것.text(), /진단서를 만들 수 없습니다/);
  const 도면 = await fetch(BASE + "/venue?entry=demo");
  assert.equal(도면.status, 200);
  assert.match(await 도면.text(), /시연용 예시/, "도면에 예시 표시가 없다");
});

test("기획서를 붙여넣으면 확인 화면 없이 판정(/check)으로 가고, 초안 주석은 판정 블록을 바꾸지 않는다", async () => {
  // OPENROUTER_API_KEY 가 없으므로 모델을 부르지 않는다 — 고정 샘플로 떨어진다. 네트워크도 돈도 안 쓴다
  const res = await 붙여넣는다(
    `제1회 김천김밥축제 추진계획
○ 개최기간: 2024년 10월 중 3일간
○ 개최장소: 경상북도 김천시 일원
○ 주요내용: 지역 특산물인 김밥을 주제로 한 음식 축제`,
  );
  assert.ok(res.status < 500, `추출이 서버 오류로 끝났다 (${res.status})`);
  const loc = res.headers.get("location") ?? res.headers.get("x-action-redirect") ?? "";
  assert.match(loc, /\/check\?/, `판정으로 리다이렉트하지 않았다: ${loc}`);
  assert.match(loc, /draft=\d+/, `초안 id 가 안 실렸다: ${loc}`);
  const p = new URLSearchParams(loc.replace(/^[^?]*\?/, ""));
  assert.equal(p.get("sigungu"), "김천시");
  assert.equal(p.get("n"), "100000");
  assert.equal(p.get("start"), "2024-10-25");
  const 판정페이지 = (await (await fetch(BASE + loc.replace(/^https?:\/\/[^/]+/, ""))).text()).replace(/<!--\s*-->/g, "");
  assert.match(판정페이지, /기획안에서 옮겨 적은 값/, "초안 주석 블록이 없다");
  assert.match(판정페이지, /고정 샘플/, "샘플이라는 표시가 판정 화면에 없다");
  assert.doesNotMatch(판정페이지, /견본입니다/, "다리로 왔는데 견본 판정을 보여 준다");
  assert.match(판정페이지, /김천시/);
  assert.doesNotMatch(출처셀걷기(판정페이지), /\d[\d,]*\s*명/, "판정 화면 출처 셀 밖에 명 수가 있다");
  // 결정론 — draft 를 빼도 판정 블록(#verdict~#verdict-end)의 HTML 은 같다
  const 없이 = (await (await fetch(BASE + loc.replace(/^https?:\/\/[^/]+/, "").replace(/&draft=\d+/, ""))).text()).replace(/<!--\s*-->/g, "");
  const 블록 = (h) => h.match(/<div id="verdict"[\s\S]*?<span id="verdict-end"/)?.[0] ?? "";
  assert.ok(블록(판정페이지).length > 500, "판정 블록을 못 찾았다");
  assert.equal(블록(판정페이지), 블록(없이), "draft 주석이 판정 블록을 바꿨다");
});

test("시뮬레이션 화면이 뜬다", async () => {
  const 도면 = await (await fetch(BASE + "/venue")).text();
  assert.match(도면, /시뮬레이션/, "시뮬레이션 화면이 안 뜬다");
  // 캔버스는 클라이언트 몫이라 SSR 본문엔 로딩 문구까지만 있으면 된다
  assert.match(도면, /편집기를 불러오는 중|venue-layout/, "편집기 자리가 없다");
});

test("너무 짧은 입력은 모델을 부르지 않고 되돌려보내며, 첫 화면이 오류와 대체 경로를 보인다", async () => {
  const res = await 붙여넣는다("축제");
  assert.ok(res.status < 500, `서버 오류로 끝났다 (${res.status})`);
  const 화면 = await (await fetch(BASE + "/?err=%EB%84%88%EB%AC%B4")).text();
  assert.match(화면, /role="alert"/, "오류 배너가 없다");
  assert.match(화면, /판정 화면에 직접 적기/, "대체 경로가 없다");
  assert.match(화면, /type="file"/, "첫 화면으로 돌아오지 않았다");
});

// ── 기획안 팩트체크 (/check · /evidence) — 기획/08 §4 완료조건 4a·4b·13 ─────────
//
// 명 수는 <span data-num …> 안에만 있어야 한다. 그 span 을 걷어낸 본문에 "N명" 이 남으면
// 출처 없는 숫자다. 판정 라벨은 lib/verdict.test.ts 가 잰 것과 같아야 한다(결정론).

function 출처셀걷기(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<span[^>]*data-num[^>]*>[\s\S]*?<\/span>/g, "")
    .replace(/<!--\s*-->/g, "");
}

test("판정 견본 — 군포 2027(목표 60만) 은 주의, 명 수는 전부 출처 셀 안에", async () => {
  const html = await (await fetch(BASE + "/check")).text();
  const 본문 = html.replace(/<!--\s*-->/g, "");
  assert.match(본문, /견본/, "견본 표시가 없다");
  assert.match(본문, /예상 방문객 주의/, "최종 판정이 없다");
  assert.match(본문, /경인일보/, "견본 방문객의 출처가 없다");
  // M7a(2026-09-12): 시뮬 요약 카드가 판정 결과에 먼저 보인다. 밀도 숫자는 출처 셀 안에만
  assert.match(본문, /시뮬레이션 요약/, "시뮬 요약 카드가 없다");
  assert.match(본문, /data-source-api="시뮬레이션\(가정\)"/, "시뮬 밀도 셀에 출처가 없다");
  // N0(2026-09-11): 619건에 군포시가 없어도 견본은 또래 구간이 서야 한다
  assert.doesNotMatch(본문, /619건 자료에 없어/, "견본에 인구 없음 경고가 떴다");
  assert.match(본문, /또래 평균/, "견본에 또래 구간이 없다");
  assert.match(본문, /인구 출처/, "견본 인구 출처가 없다");
  assert.match(본문, /1\.1~1\.3배/, "내년 구간(평균)이 없다");
  assert.match(본문, /1\.4~1\.6배/, "내년 구간(최대일)이 없다");
  // 안 잰 적중률에 신뢰도 라벨을 붙이지 않는다 (M1)
  assert.match(본문, /이력 범위\(3년\)\. 적중률은 −52주 근사로만 쟀다/, "구간 카드가 적중률의 한계를 말하지 않는다");
  assert.doesNotMatch(본문, /신뢰도 높음|이력 2년 이상\./, "안 잰 신뢰도 라벨이 남았다");
  assert.match(본문, /주의 신호/, "2단계 보조 신호가 없다");
  // 출처 4속성 — measured 셀마다 API·값·기간·조회일
  const 셀들 = html.match(/<span[^>]*data-num[^>]*data-origin="measured"[^>]*>/g) ?? [];
  assert.ok(셀들.length >= 4, `실측 셀이 ${셀들.length}개뿐`);
  for (const 셀 of 셀들) {
    for (const a of ["data-source-api", "data-source-value", "data-source-period", "data-source-date"]) {
      assert.match(셀, new RegExp(`${a}="[^"]+"`), `${a} 가 빈 셀: ${셀}`);
    }
  }
  assert.doesNotMatch(출처셀걷기(html), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
});

test("판정 음성 — 작년 실측 그대로 넣으면 통과, 단위를 빼면 단위 미상", async () => {
  const 기본 = "sido=경기&sigungu=군포시&h1s=2024-04-20&h1e=2024-04-28&h2s=2025-04-19&h2e=2025-04-27&h3s=2026-04-18&h3e=2026-04-26&start=2027-04-17&end=2027-04-25";
  const 통과 = (await (await fetch(`${BASE}/check?${기본}&n=110184&basis=peakDay&counting=unique`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(통과, /예상 방문객 통과/, "음성 케이스가 통과가 아니다");
  assert.doesNotMatch(통과, /견본/, "담당자 입력인데 견본이라 한다");
  const 미상 = (await (await fetch(`${BASE}/check?${기본}&n=110184`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(미상, /단위 미상/, "단위 없이 판정했다");
  // 이력이 없는 축제는 근거 없음 + 또래 구간만
  const 첫회 = (await (await fetch(`${BASE}/check?sido=강원&sigungu=횡성군&n=30000&basis=peakDay&counting=unique`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(첫회, /근거 없음|신뢰도 낮음/, "이력 없는 축제에 확신을 냈다");
  assert.match(첫회, /또래/, "또래 구간이 없다");
});

test("실측 근거 — 곡선 3장, 연도별 표, 일별 표가 자바스크립트 없이 나온다", async () => {
  const html = await (await fetch(BASE + "/evidence")).text();
  assert.equal((html.match(/class="ev-line"/g) ?? []).length, 3, "곡선이 3장이 아니다");
  assert.match(html, /2026-04-18/, "일별 표가 없다");
  assert.match(html, /locgoRegnVisitrDDList/, "출처 API 이름이 없다");
  assert.doesNotMatch(출처셀걷기(html), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
  // 시군구를 못 찾으면 짐작하지 않는다
  const 없음 = (await (await fetch(`${BASE}/evidence?sido=경기&sigungu=없는시`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(없음, /찾지 못했다/, "없는 시군구를 그냥 넘겼다");
});

test("검증 보고서 두 장 — 판정·구간·보완·근거 표가 자바스크립트 없이 나오고 명 수는 출처 셀 안에", async () => {
  const html = await (await fetch(BASE + "/report/check")).text();
  const 본문 = html.replace(/<!--\s*-->/g, "");
  assert.equal((html.match(/class="report-page"/g) ?? []).length, 2, "두 장이 아니다");
  assert.match(본문, /기획안 검증 보고서/);
  assert.match(본문, /견본 · 결재용 아님/, "견본 표시가 종이에 없다");
  assert.match(본문, /예상 방문객 주의/, "결론이 없다");
  assert.match(본문, /1\.4~1\.6배/, "내년 구간이 없다");
  assert.match(본문, /이력 범위\(3년\)\. 적중률은 −52주 근사로만 쟀다/, "보고서 구간 줄이 적중률의 한계를 말하지 않는다");
  assert.match(본문, /<h2>보완<\/h2>/, "보완 절이 없다");
  assert.match(본문, /근거 2 — 판정에 쓴 실측 셀과 출처/, "출처 표가 없다");
  assert.doesNotMatch(출처셀걷기(html), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
  assert.doesNotMatch(본문, /안전합니다/, "안전하다고 말한다");
  // 입력이 깨지면 보고서를 만들지 않는다
  const 깨짐 = await (await fetch(BASE + "/report/check?sido=경기&sigungu=군포시&n=-1")).text();
  assert.match(깨짐, /보고서를 만들 수 없습니다/);
});

test("1인당 예산 대조 — 견본에 기획안 1인당·실측 1인당이 나란히, 판정 라벨 항목 3개 이상, 예산 없으면 카드 없음 (M3)", async () => {
  const html = await (await fetch(BASE + "/check")).text();
  const 본문 = html.replace(/<!--\s*-->/g, "");
  const 카드 = 본문.match(/<div class="range-card budget-card"[\s\S]*?<\/div>/)?.[0];
  assert.ok(카드, "예산 카드가 없다");
  assert.match(카드, /data-origin="input"[^>]*data-source-api="[^"]*기획안[^"]*"/, "기획안 1인당 셀이 없다");
  assert.match(카드, /data-origin="derived"[^>]*data-source-api="[^"]*DataLabService\/locgoRegnVisitrDDList"/, "실측으로 나눈 1인당 셀이 없다 (derived)");
  assert.ok((본문.match(/data-labeled=""/g) ?? []).length >= 3, "판정 라벨이 붙은 항목이 셋 미만");
  assert.doesNotMatch(출처셀걷기(html), /\d[\d,]*\s*원(?!정)/, "출처 셀 밖에 원 값이 있다");
  // 예산이 없으면 카드가 안 뜨고 '예산 미공개' 행이 그대로
  const 없음 = (await (await fetch(`${BASE}/check?sido=경기&sigungu=군포시&h1s=2026-04-18&h1e=2026-04-26&n=110184&basis=peakDay&counting=unique`)).text()).replace(/<!--\s*-->/g, "");
  assert.doesNotMatch(없음, /budget-card/, "예산 없는데 카드가 떴다");
  assert.match(없음, /예산 미공개/, "예산 미공개 행이 사라졌다");
  // 보고서에도 같은 행
  const 보고서 = await (await fetch(BASE + "/report/check")).text();
  assert.match(보고서, /기획안 총예산 ÷/, "보고서 판정표에 예산 행이 없다");
  assert.doesNotMatch(출처셀걷기(보고서), /\d[\d,]*\s*원(?!정)/, "보고서 출처 셀 밖에 원 값이 있다");
});

test("−52주 근사 백테스트 — 두 화면에 근사·표본 N건·편향 양방향이 다 있고, 한정어 없는 적중률은 없다 (M5)", async () => {
  for (const path of ["/check", "/report/check"]) {
    const 본문 = (await (await fetch(BASE + path)).text()).replace(/<!--\s*-->/g, "");
    assert.match(본문, /−52주 근사/, `${path}: '−52주 근사' 가 없다`);
    assert.match(본문, /표본 \d+건/, `${path}: '표본 N건' 이 없다`);
    assert.match(본문, /편향이 양방향이다/, `${path}: 편향 양방향 문구가 없다`);
    assert.match(본문, /어느 쪽이 큰지는 재지 않았다/, `${path}: 편향 크기 미측정 문구가 없다`);
    assert.match(본문, /−52주 근사로 탐지되는 대형 축제 표본에서의/, `${path}: 적중률 한정어가 없다`);
    assert.doesNotMatch(본문, /[^의]적중률 \d/, `${path}: 한정어 없는 적중률 숫자`);
    assert.doesNotMatch(본문, /신뢰도 높음/, `${path}: 안 잰 신뢰도 라벨`);
  }
});

test("견본 2건 — 화천산천어축제(글로벌축제)는 상한 초과 + 손익분기 회전율, 두 견본 모두 '근거 없음' 아님 (M7)", async () => {
  const 화천 = (await (await fetch(BASE + "/check?demo=hwacheon")).text()).replace(/<!--\s*-->/g, "");
  assert.doesNotMatch(화천, /619건 자료에 없어/, "화천 견본에 인구 없음 경고가 떴다");
  assert.match(화천, /또래 평균/, "화천 견본에 또래 구간이 없다");
  assert.match(화천, /견본/, "견본 표시가 없다");
  assert.match(화천, /화천산천어축제/, "화천 견본이 아니다");
  assert.match(화천, /예상 방문객 상한 초과/, "화천 판정이 없다");
  assert.match(화천, /손익분기 회전율/, "연인원인데 회전율이 없다");
  assert.match(화천, /글로벌축제|지정축제/, "지정축제 표기가 없다");
  assert.doesNotMatch(화천, /예상 방문객 근거 없음/, "화천이 근거 없음이다");
  assert.doesNotMatch(출처셀걷기(화천), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
  const 군포 = (await (await fetch(BASE + "/check")).text()).replace(/<!--\s*-->/g, "");
  assert.doesNotMatch(군포, /예상 방문객 근거 없음/, "군포가 근거 없음이다");
  assert.match(군포, /demo=hwacheon/, "군포 견본에서 화천 견본으로 가는 링크가 없다");
  // 근거·보고서도 같은 견본을 물고 간다
  const 근거 = await (await fetch(BASE + "/evidence?demo=hwacheon")).text();
  assert.match(근거, /화천/, "실측 근거가 화천 견본을 잃었다");
  const 보고서 = (await (await fetch(BASE + "/report/check?demo=hwacheon")).text()).replace(/<!--\s*-->/g, "");
  assert.match(보고서, /화천산천어축제/, "보고서가 화천 견본을 잃었다");
  assert.match(보고서, /손익분기 회전율/, "보고서에 회전율이 없다");
});


// 2026-09-12 M3a-2 — 닮은 축제(보조 근거)가 /check 안에 선다. 지도·카드는 열려 있고 핀은 판정 URL 을 보존한 링크다
test("판정 화면 안의 닮은 축제 — 견본에 지도·카드 3장이 열려 있고, 핀 링크가 theme·acc 를 보존하며, 폼 제출도 보존한다", async () => {
  const 군포 = (await (await fetch(BASE + "/check")).text()).replace(/<!--\s*-->/g, "");
  assert.match(군포, /id="twins"/, "닮은 축제 블록이 없다");
  assert.equal((군포.match(/class="map"/g) || []).length, 1, "지도가 한 장이 아니다");
  assert.ok((군포.match(/class="twin-card"/g) || []).length >= 3, "닮은 축제 카드가 셋 미만");
  assert.match(군포, /경보|위험 근거 못 찾음|비교 대상 없음/, "보조 등급이 없다");
  // 지도·카드는 details 밖, 감당 범위 이하는 details 안
  const 블록 = 군포.slice(군포.indexOf('id="twins"'));
  assert.ok(블록.indexOf('class="map"') < 블록.indexOf('class="selfcheck aux-detail"'), "지도가 접힘 안에 들어갔다");
  assert.ok(블록.indexOf("감당 범위") > 블록.indexOf('class="selfcheck aux-detail"'), "감당 범위가 접히지 않았다");
  // 판정이 서면 입력 폼은 접힌다
  assert.match(군포, /class="check-form-fold"/, "입력 폼이 접히지 않았다");
  // 핀 링크 — 견본 가정(theme·acc)을 싣고 #twins 로
  const 핀 = 군포.match(/href="(\/check\?[^"]*pin=[^"#]+#twins)"/)?.[1]?.replace(/&amp;/g, "&");
  assert.ok(핀, "핀 링크가 없다");
  assert.match(핀, /theme=\d/, "핀 링크가 테마를 잃었다");
  assert.match(핀, /acc=\d/, "핀 링크가 접근성을 잃었다");
  const 펴짐 = (await (await fetch(BASE + 핀)).text()).replace(/<!--\s*-->/g, "");
  assert.match(펴짐, /class="pin-card"/, "핀을 눌러도 근거 카드가 없다");
  assert.match(펴짐, /핀 선택 해제/);
  assert.match(펴짐, /견본/, "핀을 눌렀더니 견본이 아니게 됐다");
  // 담당자 입력에서도: theme·acc 를 URL 로 주면 블록이 서고, 폼에 hidden 으로 실려 판정 버튼에 안 사라진다
  const 기본 = "sido=경기&sigungu=군포시&h1s=2026-04-18&h1e=2026-04-26&n=110184&basis=peakDay&counting=unique&start=2027-04-17&end=2027-04-25";
  const 입력 = (await (await fetch(`${BASE}/check?${기본}&theme=2&acc=4`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(입력, /name="theme"[^>]*value="2"|value="2"[^>]*name="theme"/, "theme hidden 이 없다");
  assert.match(입력, /name="acc"[^>]*value="4"|value="4"[^>]*name="acc"/, "acc hidden 이 없다");
  assert.ok((입력.match(/class="twin-card"/g) || []).length >= 1, "담당자 입력에 닮은 축제가 안 선다");
  assert.doesNotMatch(입력, /견본입니다/, "담당자 입력인데 견본이라 한다");
  // 테마·접근성이 없으면 고르기 링크만 서고 블록은 억지로 안 선다
  const 없음 = (await (await fetch(`${BASE}/check?${기본}`)).text()).replace(/<!--\s*-->/g, "");
  assert.match(없음, /테마와 접근성을 고르면/, "고르기 안내가 없다");
  assert.doesNotMatch(없음, /class="twin-card"/, "테마 없이 닮은 축제를 냈다");
  assert.doesNotMatch(출처셀걷기(입력), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
});

// 2026-09-12 M5a-1 — 619건에 없는 시군구도 행안부 표로 또래가 선다 (함평군: 619건 0건, 2026-07 개편으로 행안부 코드 12820)
test("619건에 없는 시군구(함평군)를 넣어도 또래 구간이 서고, 인구 출처가 행안부로 찍힌다", async () => {
  const h = (await (await fetch(BASE + "/check?name=x&sido=전남&sigungu=함평군&n=300000&basis=period&counting=personDays&start=2027-04-24&end=2027-05-05")).text()).replace(/<!--\s*-->/g, "");
  assert.match(h, /또래 평균/, "함평군 또래 구간이 없다");
  assert.doesNotMatch(h, /인구가 행안부 주민등록 표에 없어/, "인구 없음 경고가 떴다");
  assert.match(h, /행정안전부 주민등록인구 2026-08 기준/, "인구 출처가 없다");
  assert.doesNotMatch(출처셀걷기(h), /\d[\d,]*\s*명/, "출처 셀 밖에 명 수가 있다");
});


// 2026-09-12 M4a — 기획안 양식 한 장(/form)과 첫 화면의 양식 링크·PDF 입력 (사용자 지시 3)
test("/form 은 자바스크립트 없이 한 장으로 선다 (M4a)", async () => {
  const res = await fetch(BASE + "/form");
  assert.equal(res.status, 200);
  const 양식 = await res.text();
  assert.match(양식, /팩트체크 입력 양식/);
  for (const must of ["예상 방문객", "지난 회차", "총예산", "개최 지역"]) assert.ok(양식.includes(must), `양식에 "${must}" 가 없다`);
  assert.doesNotMatch(출처셀걷기(양식), /\d[\d,]*\s*명/, "양식에 출처 없는 명 수가 있다");
});


// 2026-09-12 지시 1·5 — 화면에 열린 글자 수를 렌더 HTML 기준으로 잰다(소스 계수는 다른 파일에서 오는 문장을 0으로 센다).
// 닫힌 <details> 안은 빼고, 태그·스크립트를 걷은 뒤 공백을 접어 센다. 상한은 실측(2026-09-12 B 마디 뒤 값)의 1.1배.
function 열린글자수(html) {
  let h = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--\s*-->/g, "");
  // 안쪽부터 닫힌 details 를 걷는다 — 중첩이라 한 번에 안 잡힌다
  for (let i = 0; i < 10; i++) {
    const next = h.replace(/<details(?![^>]*\sopen)[^>]*>(?:(?!<details)[\s\S])*?<\/details>/g, "");
    if (next === h) break;
    h = next;
  }
  return h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().length;
}
// 실측(2026-09-12): / 522 · /check 3,499 · /venue 105 — 상한은 그 1.1배 안팎
const 글자상한 = { "/": 250, "/check": 3600, "/venue": 450 };
test("열린 글자 수 — 첫 화면·판정(군포 견본)·시뮬레이션이 상한 안이다 (렌더 HTML, 닫힌 details 제외)", async () => {
  const 잰값 = {};
  for (const path of Object.keys(글자상한)) 잰값[path] = 열린글자수(await (await fetch(BASE + path)).text());
  console.log("열린 글자 수", JSON.stringify(잰값));
  for (const [path, cap] of Object.entries(글자상한)) assert.ok(잰값[path] <= cap, `${path} 열린 글자 ${잰값[path]}자 > 상한 ${cap}자`);
});
