// 렌더된 HTML 골든 스냅샷 — 화면 리팩터의 안전망.
//
//   npm run build && node evals/golden.mjs before   ← 고치기 전
//   (리팩터)
//   npm run build && node evals/golden.mjs after    ← 출력이 같은지
//
// page.tsx 를 분해하기 전과 후의 **출력이 같은지** 바이트로 비교한다.
// app/ 에는 유닛 테스트가 0개고 e2e 8개는 DOM 순서·클래스 개수·React 가
// 끼우는 <!-- --> 위치에 물려 있다 — 즉 쪼개면 "통과하면서 깨질" 수 있다.
// 여기서 재는 것은 동작이 아니라 **출력 그 자체**라 그 틈이 없다.
//
//   node golden.mjs before   → 스냅샷 저장
//   node golden.mjs after    → 저장본과 비교
//
// $ACTION_ID_ 해시는 서버 액션이 어느 모듈에 사는지로 정해지므로 파일을
// 옮기면 반드시 바뀐다. 그건 의도한 변화라 자리표시자로 정규화한다.
// 정규화하고도 **개수와 등장 순서**는 그대로 비교되므로, e2e 가 의존하는
// "첫 액션이 추출 폼이다"는 계약은 여전히 지켜진다.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PORT = 3211;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(import.meta.dirname, ".golden"); // .gitignore 대상
const 모드 = process.argv[2] ?? "before";

let server;

async function 서버가뜰때까지(ms = 90000) {
  const 끝 = Date.now() + ms;
  while (Date.now() < 끝) {
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) return;
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("서버가 뜨지 않았다");
}

/** e2e 와 같은 방식 — 첫 서버 액션에 multipart 로 폼을 낸다 */
async function 폼을낸다(경로, 값) {
  const html = await (await fetch(BASE + 경로)).text();
  const id = html.match(/\$ACTION_ID_([0-9a-f]+)/)?.[1];
  if (!id) throw new Error(`액션 id 를 못 찾았다: ${경로}`);
  const fd = new FormData();
  for (const [k, v] of Object.entries(값)) fd.set(k, v);
  fd.set(`$ACTION_ID_${id}`, "");
  return fetch(BASE + 경로, { method: "POST", body: fd, redirect: "manual" });
}

/**
 * 비교에서 빼는 것 — 분해와 무관하게 매번 달라지는 값들.
 * 액션 해시는 **자리표시자로 바꾸되 지우지 않는다**(개수·순서는 계속 비교된다).
 */
// Next 의 빌드 id 는 빌드마다 바뀐다. 플라이트 페이로드에 박혀 있어서
// 이걸 안 지우면 **모든 화면이 항상 다르다**고 나온다 (실제로 그랬다).
const BUILD_ID = (() => {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
})();

function 정규화(html) {
  let s = html;
  if (BUILD_ID) s = s.split(BUILD_ID).join("<buildid>");
  return s
    .replace(/\$ACTION_ID_[0-9a-f]+/g, "$ACTION_ID_<h>")
    // 플라이트 페이로드 쪽 액션 id. 액션이 어느 모듈에 사는지로 정해지므로
    // 파일을 옮기면 반드시 바뀐다 — 개수와 등장 위치는 그대로 비교된다.
    .replace(/\\"id\\":\\"[0-9a-f]{30,50}\\"/g, '\\"id\\":\\"<action>\\"')
    // ko-KR · hour12:false 는 "2026. 08. 31. 11:29" 로 찍힌다
    .replace(/\d{4}\. \d{2}\. \d{2}\. \d{1,2}:\d{2}/g, "<한국시각>")
    .replace(/"\$@?[0-9a-f]{2,}"/g, '"<ref>"')
    .replace(/\/_next\/static\/[^/"]+\//g, "/_next/static/<build>/")
    .replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+/g, "<시각>")
    .replace(/\d{4}년 \d{1,2}월 \d{1,2}일[^<"]*/g, "<날짜>")
    .replace(/(오전|오후) \d{1,2}:\d{2}(:\d{2})?/g, "<시분>");
}

const 화면들 = [
  ["home-빈상태", "/"],
  ["home-직접입력", "/?manual=1"],
  ["home-없는초안", "/?draft=999999"],
  ["home-오류", "/?err=" + encodeURIComponent("시험용 오류")],
  ["venue-빈", "/venue"],
  ["venue-없는도면", "/venue?id=999999"],
  ["venue-시연", "/venue?id=demo-venue"],
  ["report-시연", "/report?entry=demo"],
];

async function 찍는다() {
  const 결과 = {};
  for (const [이름, 경로] of 화면들) {
    const r = await fetch(BASE + 경로);
    결과[이름] = `HTTP ${r.status}\n` + 정규화(await r.text());
  }

  // 이력이 있는 상태의 `/` — 결과 본문 JSX 가 여기서만 렌더된다
  await 폼을낸다("/?manual=1", {
    sido: "경북",
    sigungu: "김천시",
    month: "10",
    theme: "1",
    population: "13.4",
    accessibility: "3",
  });
  const 목록 = await (await fetch(BASE + "/")).text();
  결과["home-이력1건"] = 정규화(목록);

  const entryId = 목록.match(/\/report\?entry=(\d+)/)?.[1];
  if (entryId) {
    for (const [이름, 경로] of [
      ["home-진단선택", `/?entry=${entryId}`],
      ["report-실제", `/report?entry=${entryId}`],
      ["venue-진단연결", `/venue?entry=${entryId}`],
    ]) {
      const r = await fetch(BASE + 경로);
      결과[이름] = `HTTP ${r.status}\n` + 정규화(await r.text());
    }
  } else {
    결과["home-진단선택"] = "entryId 를 못 찾았다";
  }
  return 결과;
}

const env = { ...process.env };
delete env.DATABASE_URL;
env.OPENROUTER_API_KEY = "";
env.TOUR_API_KEY = "";
server = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "--port", String(PORT)],
  { env, stdio: "ignore", shell: process.platform === "win32" },
);

try {
  await 서버가뜰때까지();
  const 결과 = await 찍는다();
  mkdirSync(OUT, { recursive: true });

  if (모드 === "before") {
    for (const [이름, 본문] of Object.entries(결과)) {
      writeFileSync(join(OUT, `${이름}.html`), 본문, "utf8");
    }
    console.log(`저장: ${Object.keys(결과).length}개 화면`);
    for (const [이름, 본문] of Object.entries(결과)) {
      console.log(`  ${이름.padEnd(18)} ${본문.length} bytes`);
    }
  } else {
    let 다름 = 0;
    for (const [이름, 본문] of Object.entries(결과)) {
      const p = join(OUT, `${이름}.html`);
      if (!existsSync(p)) {
        console.log(`  ${이름.padEnd(18)} 기준본 없음`);
        다름 += 1;
        continue;
      }
      const 기준 = readFileSync(p, "utf8");
      if (기준 === 본문) {
        console.log(`  ${이름.padEnd(18)} 같음 (${본문.length} bytes)`);
      } else {
        다름 += 1;
        console.log(`  ${이름.padEnd(18)} ★다름 (${기준.length} → ${본문.length} bytes)`);
        writeFileSync(join(OUT, `${이름}.after.html`), 본문, "utf8");
      }
    }
    console.log(다름 === 0 ? "\n전부 같다 — 출력이 안 바뀌었다" : `\n${다름}개 화면이 달라졌다`);
    process.exitCode = 다름 === 0 ? 0 : 1;
  }
} finally {
  if (server?.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  }
}
