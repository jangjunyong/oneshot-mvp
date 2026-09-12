// 견본 기획안 PDF — 심사위원에게 따로 주는 파일 (2026-09-12 밤, 사용자 지시).
//
// 이 PDF 를 첫 화면에 올리면 판정 화면이 견본(군포철쭉축제 2027)과 같은 숫자로 선다: 숫자는 lib/checkquery.ts DEMOS.gunpo
// 에서 가져오고, 배치도는 public/venue/gunpo.geojson(시뮬레이션이 쓰는 실도면)을 그대로 그린다. 손글씨 숫자 0.
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/sample-plan.mjs
//   → public/견본_기획안_군포철쭉축제_2027.pdf (헤드리스 크롬)

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { DEMOS } from "@/lib/checkquery";
import { THEME_NAME, ACCESSIBILITY_LABEL } from "@/lib/types";

const d = DEMOS.gunpo;
const q = d.query;
const dash = (s) => `${s.slice(0, 4)}. ${Number(s.slice(4, 6))}. ${Number(s.slice(6, 8))}.`;
const days = (Date.UTC(+q.end.slice(0, 4), +q.end.slice(4, 6) - 1, +q.end.slice(6, 8)) - Date.UTC(+q.start.slice(0, 4), +q.start.slice(4, 6) - 1, +q.start.slice(6, 8))) / 86400000 + 1;
const fc = JSON.parse(readFileSync("public/venue/gunpo.geojson", "utf8"));

// ── 배치도 SVG — 위경도를 그대로 평면에 놓는다(작은 부지라 왜곡 무시). 부스에 번호, 출입구·무대·화장실은 글자로
const pts = fc.features.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.type === "LineString" ? f.geometry.coordinates : [f.geometry.coordinates]));
const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
const minX = Math.min(...lngs), maxX = Math.max(...lngs), minY = Math.min(...lats), maxY = Math.max(...lats);
const W = 700, cosLat = Math.cos((37.354 * Math.PI) / 180);
const scale = W / ((maxX - minX) * cosLat);
const H = Math.round((maxY - minY) * scale) + 20;
const X = (lng) => ((lng - minX) * cosLat * scale + 10).toFixed(1);
const Y = (lat) => ((maxY - lat) * scale + 10).toFixed(1);
const poly = (ring) => ring.map((p) => `${X(p[0])},${Y(p[1])}`).join(" ");
const centroid = (ring) => { const n = ring.length; return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]; };
const style = { site: "fill:none;stroke:#171717;stroke-width:1.2", corridor: "fill:#F5F5F5;stroke:#D4D4D4;stroke-width:.6", booth: "fill:#FFFFFF;stroke:#171717;stroke-width:.7", gate: "fill:#171717", stage: "fill:#EDEDED;stroke:#171717;stroke-width:.8", toilet: "fill:#FAFAFA;stroke:#666;stroke-width:.6;stroke-dasharray:2 1", view: "fill:none;stroke:#999;stroke-width:.5;stroke-dasharray:1 1", planting: "fill:#F5F5F5;stroke:#999;stroke-width:.5" };
let booths = 0, gates = 0;
const shapes = [];
const labels = [];
for (const f of fc.features) {
  const k = f.properties.kind ?? "booth";
  const g = f.geometry;
  if (g.type === "Polygon") {
    shapes.push(`<polygon points="${poly(g.coordinates[0])}" style="${style[k] ?? style.booth}"/>`);
    const c = centroid(g.coordinates[0]);
    if (k === "booth") { booths++; labels.push(`<text x="${X(c[0])}" y="${Y(c[1])}" font-size="5.5" text-anchor="middle" dominant-baseline="middle">${f.properties.no ?? booths}</text>`); }
    if (k === "stage") labels.push(`<text x="${X(c[0])}" y="${Y(c[1])}" font-size="8" text-anchor="middle" dominant-baseline="middle">무대</text>`);
    if (k === "toilet") labels.push(`<text x="${X(c[0])}" y="${Y(c[1])}" font-size="6" text-anchor="middle" dominant-baseline="middle">화장실</text>`);
  } else if (g.type === "LineString") {
    shapes.push(`<polyline points="${poly(g.coordinates)}" style="fill:none;stroke:#BBB;stroke-width:3"/>`);
  } else if (g.type === "Point") {
    if (k === "gate") { gates++; shapes.push(`<circle cx="${X(g.coordinates[0])}" cy="${Y(g.coordinates[1])}" r="5" style="${style.gate}"/>`); labels.push(`<text x="${X(g.coordinates[0])}" y="${(+Y(g.coordinates[1]) - 8).toFixed(1)}" font-size="7" text-anchor="middle">출입구 ${gates}${f.properties.name ? ` ${f.properties.name}` : ""}</text>`); }
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 20} ${H}" width="100%" style="border:1px solid #EBEBEB;background:#fff">${shapes.join("")}${labels.join("")}</svg>`;
const kinds = fc.features.reduce((m, f) => { const k = f.properties.kind ?? "booth"; m[k] = (m[k] ?? 0) + 1; return m; }, {});

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${q.name} ${q.start.slice(0, 4)} 추진계획(안)</title>
<style>@page{size:A4;margin:16mm} body{font-family:"Pretendard","IBM Plex Sans KR","Malgun Gothic",sans-serif;color:#171717;font-size:10.5pt;line-height:1.65;max-width:178mm;margin:0 auto}
h1{font-size:17pt;font-weight:600;text-align:center;margin:0 0 .2em} .sub{text-align:center;color:#666;font-size:9.5pt;margin-bottom:1.4em}
h2{font-size:12pt;font-weight:600;margin:1.3em 0 .4em} table{width:100%;border-collapse:collapse;font-size:10pt} th,td{border:1px solid #D4D4D4;padding:.35em .6em;text-align:left;vertical-align:top} th{background:#F5F5F5;width:28%;font-weight:500}
ul{margin:.2em 0 .4em 1.2em;padding:0} .note{color:#666;font-size:9pt} .pb{break-before:page}</style></head><body>
<h1>${q.start.slice(0, 4)}년 ${q.name} 추진계획(안)</h1>
<div class="sub">군포시 문화관광과 · 견본 문서(기획안 팩트체크 시연용) · 작성 ${new Date().toISOString().slice(0, 10)}</div>

<h2>1. 개요</h2>
<table>
<tr><th>행사명</th><td>제${q.start.slice(0, 4) - 1998}회 ${q.name}</td></tr>
<tr><th>개최기간</th><td>${dash(q.start)}(토) ~ ${dash(q.end)}(일), ${days}일간</td></tr>
<tr><th>개최장소</th><td>경기도 군포시 철쭉동산 및 초막골생태공원 일원</td></tr>
<tr><th>주제</th><td>${THEME_NAME[d.themeCode]} — 수리산 자락 철쭉 군락 관람과 야간 경관 조명</td></tr>
<tr><th>주최·주관</th><td>군포시 · 군포문화재단</td></tr>
<tr><th>예상 방문객</th><td>${q.n.toLocaleString("ko-KR")}명 (기간 총계, 연인원 기준 · ${q.start.slice(0, 4) - 1}년 목표치 준용)</td></tr>
<tr><th>총사업비</th><td>${(q.budgetManWon * 10).toLocaleString("ko-KR")}천원 (시비)</td></tr>
</table>

<h2>2. 지난 회차 개최 실적</h2>
<table>
<tr><th>회차</th><td>개최 기간</td></tr>
${q.history.map((h) => `<tr><th>${h.year}년</th><td>${dash(h.start)} ~ ${dash(h.end)}</td></tr>`).join("")}
</table>
<p class="note">방문객 수는 발표치와 이동통신 실측의 정의가 달라 본 계획에서는 기간만 적는다.</p>

<h2>3. 교통·접근성</h2>
<ul>
<li>지하철 4호선 수리산역 1번 출구에서 도보 5분 (접근성 ${ACCESSIBILITY_LABEL[d.accessibility]})</li>
<li>임시 주차장 300면(초막골 공영주차장 + 인근 학교 운동장), 주말 셔틀버스 2개 노선 운행</li>
</ul>

<h2>4. 주요 프로그램</h2>
<ul>
<li>철쭉 군락지 산책로 개방, 야간 경관 조명(19:00~22:00)</li>
<li>먹거리·체험·판매 부스 운영, 주무대 공연(주말 저녁), 어린이 체험 존</li>
</ul>

<h2 class="pb">5. 행사장 배치도</h2>
<p class="note">출처: 군포철쭉축제 2026 실도면(OSM 실측 기반, 부스 ${kinds.booth ?? 0}·출입구 ${kinds.gate ?? 0}·무대 ${kinds.stage ?? 0}·화장실 ${kinds.toilet ?? 0}). 번호는 부스 번호. 웹의 시뮬레이션 탭에서 같은 배치를 열어 옮기고 다시 돌릴 수 있다.</p>
${svg}
<table style="margin-top:1em">
<tr><th>부스</th><td>${kinds.booth ?? 0}개 (3×3m, 통로 폭 4m 이상 유지)</td></tr>
<tr><th>출입구</th><td>${kinds.gate ?? 0}곳 (수리산역 방면 주출입구 포함)</td></tr>
<tr><th>주무대</th><td>${kinds.stage ?? 0}곳</td></tr>
<tr><th>화장실</th><td>${kinds.toilet ?? 0}곳 (이동식 포함)</td></tr>
</table>
</body></html>`;

const dir = mkdtempSync(path.join(os.tmpdir(), "sample-plan-"));
const htmlPath = path.join(dir, "plan.html");
writeFileSync(htmlPath, html);
const out = path.resolve("public/견본_기획안_군포철쭉축제_2027.pdf");
const chrome = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${out}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
console.log("wrote", out, `booths ${kinds.booth} gates ${kinds.gate}`);
