// 심사위원 시연 안내를 만든다 — docs/심사위원_시연안내.md (+ 같은 내용의 HTML 을 임시로 써서 헤드리스 크롬으로 public/심사위원_안내.pdf).
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/judge-guide.mjs [--pdf]
// 숫자는 전부 lib/judgeguide.ts 가 자료에서 만든다. 이 파일은 쓰기만 한다.
import { writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { judgeGuideMarkdown } from "@/lib/judgeguide";

const md = judgeGuideMarkdown();
writeFileSync("docs/심사위원_시연안내.md", md);
console.log("wrote docs/심사위원_시연안내.md", md.length, "chars");

if (process.argv.includes("--pdf")) {
  // 아주 작은 md → html (제목·목록·코드블록·굵게만). 라이브러리 없이 — 문서 하나 만드는 데 의존성을 늘리지 않는다
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const lines = md.split("\n");
  let html = "";
  let inCode = false;
  let list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    if (raw.startsWith("```")) { if (inCode) { html += "</pre>"; inCode = false; } else { closeList(); html += "<pre>"; inCode = true; } continue; }
    if (inCode) { html += esc(raw) + "\n"; continue; }
    const line = esc(raw).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    let m;
    if ((m = line.match(/^(#{1,3}) (.*)$/))) { closeList(); html += `<h${m[1].length}>${m[2]}</h${m[1].length}>`; continue; }
    if ((m = line.match(/^(\d+)\. (.*)$/))) { if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${m[2]}</li>`; continue; }
    if ((m = line.match(/^- (.*)$/))) { if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${m[1]}</li>`; continue; }
    if (line.trim() === "") { closeList(); continue; }
    closeList(); html += `<p>${line}</p>`;
  }
  closeList();
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>기획안 팩트체크 — 심사위원 시연 안내</title>
<style>@page{size:A4;margin:14mm} body{font-family:"Pretendard","IBM Plex Sans KR","Malgun Gothic",sans-serif;color:#171717;font-size:10.5pt;line-height:1.6;max-width:180mm;margin:0 auto}
h1{font-size:18pt;font-weight:500;letter-spacing:-.02em;margin:0 0 .4em} h2{font-size:12.5pt;font-weight:500;margin:1.2em 0 .3em;padding-top:.5em;border-top:1px solid #EBEBEB}
p,li{margin:.2em 0} ol,ul{padding-left:1.3em} b{font-weight:600} pre{font-size:8.5pt;background:#FAFAFA;border:1px solid #EBEBEB;padding:.6em;white-space:pre-wrap}</style></head><body>${html}</body></html>`;
  const dir = mkdtempSync(path.join(os.tmpdir(), "judge-"));
  const htmlPath = path.join(dir, "guide.html");
  writeFileSync(htmlPath, page);
  const out = path.resolve("public/심사위원_안내.pdf");
  const chrome = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${out}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
  console.log("wrote", out);
}
