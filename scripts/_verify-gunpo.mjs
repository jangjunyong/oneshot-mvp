import { loadDaily, resolveRegion } from "../lib/kto/daily.ts";
const rows = loadDaily(resolveRegion("경기", "군포시").code);
for (const d of ["20250420", "20250419", "20260418"]) {
  const r = rows.find((x) => x.ymd === d);
  if (!r) { console.log(d, "없음"); continue; }
  const 전체 = r.loc + r.out + r.frn;
  console.log(d, "전체체류", Math.round(전체).toLocaleString("ko-KR"),
    "| 외지인", Math.round(r.out).toLocaleString("ko-KR"),
    "| 217,502 대비", (217502 / 전체 * 100).toFixed(1) + "%");
}
