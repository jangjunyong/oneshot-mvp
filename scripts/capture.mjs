// 제출용 캡처를 헤드리스 크롬으로 찍는다 — 화면을 고칠 때마다 21장을 손으로 다시 찍지 않으려고.
//
// 왜 의존성이 없나: puppeteer 를 넣으면 새 의존성이다(저장소 규칙). Node 24 에 전역
// WebSocket 이 있어 CDP 를 직접 말하면 된다. 크롬은 이미 깔려 있는 것을 쓴다.
//
// 왜 픽셀 자르기가 아니라 선택자인가: 2026-09-18 캡처는 전체 화면을 찍고 손으로 잘라서
// 자른 상자가 어디에도 안 남아 있다. 화면이 바뀌면 다시 잘라야 한다. 선택자로 찍으면
// 화면이 바뀌어도 같은 것을 찍는다.
//
// 쓰기
//   node scripts/capture.mjs                     전체(docs/제출양식/캡처/)
//   node scripts/capture.mjs --only f2_1_verdict 하나만
//   node scripts/capture.mjs --list /check?...   그 화면의 절·선택자 목록만 찍어 본다
//   node scripts/capture.mjs --base http://...   운영 주소로 (기본은 next start 를 스스로 띄운다)

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PORT = 3210;
const OUT = "docs/제출양식/캡처";
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const LIST = arg("--list");
const ONLY = arg("--only");
const BASE = arg("--base") || `http://127.0.0.1:${PORT}`;
const SELF = !arg("--base");

// 견본 기획안 — e2e.test.mjs 와 같은 값 (lib/checkquery.ts GUNPO_2027 · HWACHEON_2027)
const 군포 =
  "name=군포철쭉축제&sido=경기&sigungu=군포시&n=600000&basis=period&counting=personDays&budget=100000&pop=24.9&start=2027-04-17&end=2027-04-25&h1s=2024-04-20&h1e=2024-04-28&h2s=2025-04-19&h2e=2025-04-27&h3s=2026-04-18&h3e=2026-04-26";
const 화천 =
  "name=화천산천어축제&sido=강원&sigungu=화천군&n=1860000&basis=period&counting=personDays&pop=2.3&start=2027-01-09&end=2027-01-31&h1s=2024-01-06&h1e=2024-01-28&h2s=2025-01-11&h2e=2025-02-02&h3s=2026-01-10&h3e=2026-02-01";
const 첫회 =
  "name=새봄축제&sido=경기&sigungu=군포시&n=80000&basis=period&counting=personDays&pop=24.9&start=2027-05-01&end=2027-05-03";

/** 절(.section) 을 제목 글자로 고른다 — 클래스가 바뀌어도 살아남는 선택자 */
const 절 = (글자) => ({ kind: "section", text: 글자 });

/**
 * 찍을 것. fill.py 의 이름을 그대로 쓴다 (docs/제출양식/fill.py 의 IMG 표).
 * target: css 선택자 | 절("제목 일부") | "page"(전체)
 */
const SHOTS = [
  // 대표·상세
  { file: "hero_wide.png", url: `/check?${군포}`, target: ".check-main", width: 1440, clipMax: 900 },
  { file: "detail_panels.png", url: `/check?${군포}`, target: ".check-table", width: 1280 },

  // 흐름 1 — 기획서를 넣는다 → 도면 위에서 본다
  { file: "f1_1_home.png", url: "/", target: "main", width: 1100, clipMax: 720 },
  { file: "f1_2_underlay.png", url: `/venue?${군포}`, target: ".sim-panel", width: 1440, wait: 7000, clipMax: 520 },
  { file: "f1_3_venue.png", url: `/venue?${군포}`, target: ".sim-map-col", width: 1440, wait: 7000 },
  { file: "f1_4_panel.png", url: `/venue?${군포}`, target: ".sim-panel:has(.sim-kpi)", width: 1440, wait: 7000, clipMax: 560 },

  // 흐름 2 — 판정
  { file: "f2_1_verdict.png", url: `/check?${군포}`, target: 절("판정"), width: 1100 },
  { file: "f2_2_stages.png", url: `/check?${군포}`, target: ".check-table", width: 1100 },
  { file: "f2_3_range.png", url: `/check?${군포}`, target: ".range-card", width: 1100 },
  { file: "f2_4_first.png", url: `/check?${첫회}`, target: ".check-main", width: 1100, clipMax: 900 },

  // 흐름 3 — 다른 축제·예산·귀속·보고서
  { file: "f3_1_other.png", url: `/check?${화천}`, target: ".check-main", width: 1100, clipMax: 900 },
  { file: "f3_2_budget.png", url: `/check?${군포}`, target: ".budget-card", width: 1100 },
  { file: "f3_3_attrib.png", url: `/check?${군포}`, target: ".rival-surge, .attribution", width: 1100, open: true },
  { file: "f3_4_report.png", url: `/report/check?${군포}`, target: ".report-page", width: 1000 },

  // 흐름 4 — 근거
  { file: "f4_1_datause.png", url: `/check?${군포}`, target: ".data-usage", width: 1100 },
  { file: "f4_2_evidence.png", url: `/evidence?${군포}`, target: ".evidence-fig", width: 1100, clipMax: 900 },
  { file: "f4_3_twins.png", url: `/check?${군포}`, target: ".twins", width: 1100, clipMax: 900 },
  { file: "f4_4_history.png", url: `/evidence?${군포}`, target: "table.check-table", width: 1100, open: true, clipMax: 700 },

  // 전체 화면 (문서 밖 참고용)
  { file: "page_home.png", url: "/", target: "page", width: 1280 },
  { file: "page_check.png", url: `/check?${군포}`, target: "page", width: 1280 },
  { file: "page_venue.png", url: `/venue?${군포}`, target: "page", width: 1440, wait: 3500 },
  { file: "page_evidence.png", url: `/evidence?${군포}`, target: "page", width: 1280 },
  { file: "page_report.png", url: `/report/check?${군포}`, target: "page", width: 1000 },
  { file: "page_mobile.png", url: `/check?${군포}`, target: "page", width: 390 },
];

// ── CDP ──────────────────────────────────────────────────────────

let nextId = 1;
function cdp(ws) {
  const 대기 = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && 대기.has(m.id)) {
      const { ok, no } = 대기.get(m.id);
      대기.delete(m.id);
      if (m.error) no(new Error(JSON.stringify(m.error)));
      else ok(m.result);
    }
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

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 기다린다(fn, ms, 이름) {
  const 끝 = Date.now() + ms;
  while (Date.now() < 끝) {
    try {
      if (await fn()) return true;
    } catch {
      /* 아직 */
    }
    await 잠깐(300);
  }
  throw new Error(이름 + " 가 안 떴다");
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  let server = null;
  if (SELF) {
    const env = { ...process.env };
    server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "--port", String(PORT)], {
      env,
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
      "--remote-debugging-port=9333",
      "--hide-scrollbars",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=" + join(process.env.TEMP || "/tmp", "capture-profile"),
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let info;
  await 기다린다(async () => {
    info = await (await fetch("http://127.0.0.1:9333/json/version")).json();
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

  async function 연다(url, width, wait) {
    await S("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: width <= 480,
    });
    await S("Page.navigate", { url: BASE + url });
    await 기다린다(
      async () =>
        (await S("Runtime.evaluate", { expression: "document.readyState", returnByValue: true })).result.value ===
        "complete",
      30000,
      url,
    );
    await 잠깐(wait ?? 900);
  }

  async function 상자(target) {
    const expr =
      typeof target === "string"
        ? `(() => { const e = document.querySelector(${JSON.stringify(target)}); if (!e) return null;
             const r = e.getBoundingClientRect(); const s = window.scrollY, x = window.scrollX;
             return { x: r.x + x, y: r.y + s, w: r.width, h: r.height }; })()`
        : `(() => { const secs = [...document.querySelectorAll('.section, section, main > div')];
             const e = secs.find((s) => (s.querySelector('h1,h2,h3')?.textContent || '').includes(${JSON.stringify(target.text)}));
             if (!e) return null; const r = e.getBoundingClientRect(); const s = window.scrollY, x = window.scrollX;
             return { x: r.x + x, y: r.y + s, w: r.width, h: r.height }; })()`;
    const { result } = await S("Runtime.evaluate", { expression: expr, returnByValue: true });
    return result.value;
  }

  async function 찍는다(shot) {
    await 연다(shot.url, shot.width, shot.wait);

    // 접힌 것 안은 크기가 0 이라 못 잰다. 기능설명서 그림은 펴 놓고 찍는다
    if (shot.open) {
      await S("Runtime.evaluate", {
        expression: "document.querySelectorAll('details').forEach((d) => (d.open = true))",
      });
      await 잠깐(400);
    }

    let clip = null;
    if (shot.target !== "page") {
      const b = await 상자(shot.target);
      if (!b || b.w < 20 || b.h < 20) {
        console.log(`  건너뜀 ${shot.file} — 대상을 못 찾음 (${JSON.stringify(shot.target)})`);
        return false;
      }
      const pad = 12;
      clip = {
        x: Math.max(0, b.x - pad),
        y: Math.max(0, b.y - pad),
        width: Math.min(b.w + pad * 2, shot.width),
        height: Math.min(b.h + pad * 2, shot.clipMax ?? 2400),
        scale: 1,
      };
    } else {
      const m = await S("Page.getLayoutMetrics");
      const h = Math.min(Math.ceil(m.cssContentSize.height), 6000);
      clip = { x: 0, y: 0, width: shot.width, height: h, scale: 1 };
    }

    const { data } = await S("Page.captureScreenshot", {
      format: "png",
      clip,
      captureBeyondViewport: true,
      fromSurface: true,
    });
    writeFileSync(join(OUT, shot.file), Buffer.from(data, "base64"));
    console.log(`  ${shot.file}  ${Math.round(clip.width)}×${Math.round(clip.height)}`);
    return true;
  }

  try {
    if (LIST) {
      await 연다(LIST, 1280);
      const { result } = await S("Runtime.evaluate", {
        expression: `[...document.querySelectorAll('.section, main > div, main > section')].map((e, i) => {
          const r = e.getBoundingClientRect();
          return (e.className || '(무클래스)') + ' | ' + ((e.querySelector('h1,h2,h3')?.textContent || '').slice(0, 30)) + ' | ' + Math.round(r.width) + 'x' + Math.round(r.height);
        }).join('\\n')`,
        returnByValue: true,
      });
      console.log(result.value);
    } else {
      const 목록 = ONLY ? SHOTS.filter((s) => s.file.startsWith(ONLY)) : SHOTS;
      let 성공 = 0;
      for (const s of 목록) if (await 찍는다(s)) 성공++;
      console.log(`\n${성공}/${목록.length} 장 — ${OUT}`);
      if (성공 < 목록.length) process.exitCode = 1;
      // 상세 이미지 4분할은 방금 찍은 전체 화면 넷을 붙여 만든다 — 손으로 조립하면 다음 회차에 옛 화면이 섞인다
      if (!ONLY && 성공 === 목록.length) await 합친다();
    }
  } finally {
    ws.close();
    chrome.kill();
    if (server?.pid) {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
      else server.kill();
    }
  }
}

/** 상세 이미지(양식 "상세 이미지 3~5장") — page_home·page_check·page_evidence·page_venue 를 한 장으로 */
async function 합친다() {
  const { spawnSync } = await import("node:child_process");
  const py = spawnSync("python", ["scripts/detail-4up.py"], { encoding: "utf8" });
  console.log((py.stdout || py.stderr || "").trim());
  if (py.status !== 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
