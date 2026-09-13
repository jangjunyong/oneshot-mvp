// 예비 데모 기획서 PDF — 「군포 철쭉축제 기획서.pdf」 (2026-09-13 사용자 지시. 옛 이름 견본_기획안_군포철쭉축제_2027.pdf).
//
// 사이트에는 견본이 없다. 이 PDF 를 첫 화면에 올려야 판정·시뮬레이션이 선다. 숫자는 lib/checkquery.ts GUNPO_2027 에서 가져오고,
// 항목 순서는 /form 양식(v2)과 같다. 배치도는 public/venue/gunpo.geojson(시뮬레이션이 여는 군포 실도면)을 축척 막대·방위와 함께 그린다 —
// 시뮬레이션의 "배치도 밑그림"에 이 PDF 를 올리면 2쪽(배치도)을 찾아 깔고, 축척 막대로 축척을 맞출 수 있다. 손글씨 숫자 0.
// 1쪽에는 "배치도"라는 낱말을 쓰지 않는다 — 편집기가 그 낱말로 배치도 쪽을 찾는다.
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/sample-plan.mjs
//   → public/군포 철쭉축제 기획서.pdf (헤드리스 크롬)

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
const FOOT = 70; // 축척 막대·방위 자리
const H = Math.round((maxY - minY) * scale) + 20 + FOOT;
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
    if (k === "gate") { gates++; labels.push(`<text x="${X(c[0])}" y="${(+Y(c[1]) - 7).toFixed(1)}" font-size="7" text-anchor="middle">출입구 ${gates}</text>`); }
  } else if (g.type === "LineString") {
    const w = Math.max(1.5, (f.properties.width ?? 4) * (scale / 111320));
    shapes.push(`<polyline points="${poly(g.coordinates)}" style="fill:none;stroke:#BBB;stroke-width:${w.toFixed(1)};stroke-linecap:round;stroke-linejoin:round"/>`);
  } else if (g.type === "Point" && k === "gate") {
    gates++;
    shapes.push(`<circle cx="${X(g.coordinates[0])}" cy="${Y(g.coordinates[1])}" r="5" style="${style.gate}"/>`);
    labels.push(`<text x="${X(g.coordinates[0])}" y="${(+Y(g.coordinates[1]) - 8).toFixed(1)}" font-size="7" text-anchor="middle">출입구 ${gates}</text>`);
  }
}
// 축척 막대 — SVG 1단위 = 111,320 ÷ scale m (위도 1도 ≈ 111.32km, 경도는 cosLat 로 이미 줄였다)
const mPerUnit = 111320 / scale;
const bar50 = 50 / mPerUnit;
// 도면을 한 쪽 높이에 맞추면 0.4배쯤 줄어든다 — 막대·글자를 그만큼 키워야 종이에서도, 밑그림으로 깔았을 때도 읽힌다
const by = H - 16;
const scaleBar = `<g font-size="20"><rect x="24" y="${by}" width="${(bar50 / 2).toFixed(1)}" height="10" fill="#171717"/><rect x="${(24 + bar50 / 2).toFixed(1)}" y="${by}" width="${(bar50 / 2).toFixed(1)}" height="10" fill="#fff" stroke="#171717" stroke-width="1.5"/>
<text x="24" y="${by - 6}" text-anchor="middle">0</text><text x="${(24 + bar50 / 2).toFixed(1)}" y="${by - 6}" text-anchor="middle">25</text><text x="${(24 + bar50).toFixed(1)}" y="${by - 6}" text-anchor="middle">50 m</text></g>`;
const north = `<g transform="translate(${W - 10} ${H - 44})" font-size="20" text-anchor="middle"><path d="M0 -24 L10 10 L0 3 L-10 10 Z" fill="#171717"/><text y="32">N</text></g>`;
// 부지가 남북으로 길어 폭에 맞추면 두 쪽으로 갈린다 — 밑그림은 한 쪽만 까니 높이에 맞춰 한 쪽 안에 넣는다
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 20} ${H}" style="display:block;margin:0 auto;height:205mm;width:auto;max-width:100%;border:1px solid #EBEBEB;background:#fff">${shapes.join("")}${labels.join("")}${scaleBar}${north}</svg>`;
const kinds = fc.features.reduce((m, f) => { const k = f.properties.kind ?? "booth"; m[k] = (m[k] ?? 0) + 1; return m; }, {});
const year = q.start.slice(0, 4);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${year}년 ${q.name} 추진계획(안)</title>
<style>@page{size:A4;margin:16mm} body{font-family:"Pretendard","IBM Plex Sans KR","Malgun Gothic",sans-serif;color:#171717;font-size:10.5pt;line-height:1.65;max-width:178mm;margin:0 auto}
h1{font-size:17pt;font-weight:600;text-align:center;margin:0 0 .2em} .sub{text-align:center;color:#666;font-size:9.5pt;margin-bottom:1.4em}
h2{font-size:12pt;font-weight:600;margin:1.3em 0 .4em} table{width:100%;border-collapse:collapse;font-size:10pt} th,td{border:1px solid #D4D4D4;padding:.35em .6em;text-align:left;vertical-align:top} th{background:#F5F5F5;width:28%;font-weight:500}
ul{margin:.2em 0 .4em 1.2em;padding:0} .note{color:#666;font-size:9pt} .pb{break-before:page}</style></head><body>
<h1>${year}년 ${q.name} 추진계획(안)</h1>
<div class="sub">군포시 문화관광과 · 시연용 예비 데모 문서(총사업비는 가정값) · 작성 ${new Date().toISOString().slice(0, 10)}</div>

<h2>1. 축제</h2>
<table>
<tr><th>행사명</th><td>제${year - 1998}회 ${q.name}</td></tr>
<tr><th>개최지역</th><td>경기도 군포시 (철쭉동산 및 초막골생태공원 일원)</td></tr>
<tr><th>개최기간</th><td>${dash(q.start)}(토) ~ ${dash(q.end)}(일), ${days}일간</td></tr>
<tr><th>주요내용</th><td>${THEME_NAME[d.themeCode]} — 수리산 자락 철쭉 군락 관람과 야간 경관 조명</td></tr>
<tr><th>주최·주관</th><td>군포시 · 군포문화재단</td></tr>
</table>

<h2>2. 예상 방문객</h2>
<table>
<tr><th>예상 방문객 수</th><td>${q.n.toLocaleString("ko-KR")}명</td></tr>
<tr><th>단위</th><td>기간 총계, 연인원 기준</td></tr>
<tr><th>산출 근거</th><td>${year - 1}년 시 목표치 준용</td></tr>
</table>

<h2>3. 지난 회차 개최 실적</h2>
<table>
<tr><th>회차</th><td>개최 기간</td></tr>
${q.history.map((h) => `<tr><th>${h.year}년</th><td>${dash(h.start)} ~ ${dash(h.end)}</td></tr>`).join("")}
</table>
<p class="note">방문객 수는 발표치와 이동통신 실측의 정의가 달라 본 계획에서는 기간만 적는다.</p>

<h2>4. 예산·시설</h2>
<table>
<tr><th>총사업비</th><td>${(q.budgetManWon * 10).toLocaleString("ko-KR")}천원 (시비)</td></tr>
<tr><th>주차면</th><td>임시 주차장 300면(초막골 공영주차장 + 인근 학교 운동장), 주말 셔틀버스 2개 노선</td></tr>
<tr><th>부스 수</th><td>${kinds.booth ?? 0}개 (3×3m)</td></tr>
<tr><th>교통·접근성</th><td>지하철 4호선 수리산역 1번 출구에서 도보 5분 (접근성 ${ACCESSIBILITY_LABEL[d.accessibility]})</td></tr>
</table>

<h2>5. 주요 프로그램</h2>
<ul>
<li>철쭉 군락지 산책로 개방, 야간 경관 조명(19:00~22:00)</li>
<li>먹거리·체험·판매 부스 운영, 주무대 공연(주말 저녁), 어린이 체험 존</li>
</ul>

<h2 class="pb">6. 행사장 배치도</h2>
<p class="note">군포철쭉축제 2026 실도면(OSM 실측 기반, 부스 좌표는 가정). 부스 ${kinds.booth ?? 0}·출입구 ${kinds.gate ?? 0}·무대 ${kinds.stage ?? 0}·화장실 ${kinds.toilet ?? 0}. 번호는 부스 번호, 회색 띠는 통로(폭 그대로). 왼쪽 아래 축척 막대 0~50 m, 오른쪽 아래 북쪽.</p>
${svg}
<table style="margin-top:1em">
<tr><th>축척</th><td>축척 막대 50 m (시뮬레이션 밑그림 축척 맞추기에 쓴다)</td></tr>
<tr><th>통로·출입구</th><td>주 도로 폭 26m, 산책로 3~4m · 출입구 ${kinds.gate ?? 0}곳 (수리산역 방면 주출입구 포함)</td></tr>
<tr><th>화장실</th><td>${kinds.toilet ?? 0}곳 (이동식 포함)</td></tr>
</table>
</body></html>`;

const dir = mkdtempSync(path.join(os.tmpdir(), "sample-plan-"));
const htmlPath = path.join(dir, "plan.html");
writeFileSync(htmlPath, html);
const out = path.resolve("public/군포 철쭉축제 기획서.pdf");
const chrome = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${out}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
console.log("wrote", out, `booths ${kinds.booth} gates ${kinds.gate} · 50m bar ${bar50.toFixed(1)} units`);
