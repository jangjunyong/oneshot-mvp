// 검증 보고서가 정말 A4 두 장인지 **인쇄해서** 센다.
//
// 왜: `/report/check` 는 결재 첨부물이라 "두 장"이 제품의 약속이다. 화면 캡처로는 알 수 없고
// 인쇄 CSS 를 눈으로 읽어도 알 수 없다. 2026-08 에 한 번 세 장으로 넘어간 적이 있다(globals.css 인쇄 절 주석).
// 디자인 토큰을 건드린 회차마다 이걸 돌린다.
//
//   node scripts/print-check.mjs            로컬 빌드를 띄워 인쇄
//   node scripts/print-check.mjs --base https://oneshot-mvp.vercel.app

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PORT = 3211;
const OUT = "docs/제출양식/인쇄검사";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const argv = process.argv.slice(2);
const BASE = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : `http://127.0.0.1:${PORT}`;
const SELF = !argv.includes("--base");

const 군포 =
  "name=군포철쭉축제&sido=경기&sigungu=군포시&n=600000&basis=period&counting=personDays&budget=100000&pop=24.9&start=2027-04-17&end=2027-04-25&h1s=2024-04-20&h1e=2024-04-28&h2s=2025-04-19&h2e=2025-04-27&h3s=2026-04-18&h3e=2026-04-26";

/** 재는 것: 경로 → 기대 쪽수 */
const 대상 = [
  { file: "report_check.pdf", url: `/report/check?${군포}`, expect: 2, 이름: "검증 보고서" },
  { file: "form.pdf", url: "/form", expect: 1, 이름: "기획안 양식" },
];

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
async function 기다린다(fn, ms, 이름) {
  const 끝 = Date.now() + ms;
  while (Date.now() < 끝) {
    try {
      if (await fn()) return;
    } catch {
      /* 아직 */
    }
    await 잠깐(300);
  }
  throw new Error(이름 + " 가 안 떴다");
}

let nextId = 1;
function cdp(ws) {
  const 대기 = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (!m.id || !대기.has(m.id)) return;
    const { ok, no } = 대기.get(m.id);
    대기.delete(m.id);
    if (m.error) no(new Error(JSON.stringify(m.error)));
    else ok(m.result);
  });
  return (method, params = {}, sessionId) =>
    new Promise((ok, no) => {
      const id = nextId++;
      대기.set(id, { ok, no });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (!대기.has(id)) return;
        대기.delete(id);
        no(new Error(method + " 시간 초과"));
      }, 60000);
    });
}

/** PDF 바이트에서 쪽수 — /Type /Page 를 센다 (라이브러리 없이) */
function 쪽수(buf) {
  const s = buf.toString("latin1");
  const m = s.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let server = null;
  if (SELF) {
    server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "--port", String(PORT)], {
      env: { ...process.env },
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    await 기다린다(async () => (await fetch(BASE + "/")).ok, 60000, "서버");
  }

  if (!existsSync(CHROME)) throw new Error("크롬을 못 찾았다: " + CHROME);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=9334",
      "--disable-gpu",
      "--no-first-run",
      "--user-data-dir=" + join(process.env.TEMP || "/tmp", "print-profile"),
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let info;
  await 기다린다(async () => {
    info = await (await fetch("http://127.0.0.1:9334/json/version")).json();
    return !!info.webSocketDebuggerUrl;
  }, 30000, "크롬");

  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const send = cdp(ws);
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S("Page.enable");
  await S("Runtime.enable");

  let 실패 = 0;
  try {
    for (const t of 대상) {
      await S("Page.navigate", { url: BASE + t.url });
      await 기다린다(
        async () =>
          (await S("Runtime.evaluate", { expression: "document.readyState", returnByValue: true })).result.value ===
          "complete",
        30000,
        t.url,
      );
      await 잠깐(900);
      // A4 210×297mm = 8.27×11.69in. 여백은 인쇄 CSS 가 잡는다
      const { data } = await S("Page.printToPDF", {
        paperWidth: 8.27,
        paperHeight: 11.69,
        marginTop: 0.47,
        marginBottom: 0.47,
        marginLeft: 0.47,
        marginRight: 0.47,
        printBackground: false,
        preferCSSPageSize: false,
      });
      const buf = Buffer.from(data, "base64");
      writeFileSync(join(OUT, t.file), buf);
      const n = 쪽수(buf);
      const ok = n === t.expect;
      if (!ok) 실패++;
      console.log(`${ok ? "OK  " : "실패"} ${t.이름}: ${n}쪽 (기대 ${t.expect}) → ${join(OUT, t.file)}`);
    }
  } finally {
    ws.close();
    chrome.kill();
    if (server?.pid) {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
      else server.kill();
    }
  }
  if (실패) {
    console.log(`\n${실패}건이 기대 쪽수와 다르다. 인쇄 CSS(app/globals.css 의 @media print)를 확인하라.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
