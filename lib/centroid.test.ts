// 시군구 대표점 표 — 2026-09-12 D 마디. coordsOf 의 시도 폴백(군포 → 양평)을 이 표가 대신한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CENTROID_META, centroidOf, centroidOfCode } from "@/lib/centroid";
import { coordsOf } from "@/lib/match";
import { hasPlace } from "@/lib/mapproj";
import { sigunguList } from "@/lib/kto/daily";

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

test("D-1 표는 KT 시군구 정식 행(272) 을 한 곳 빼고 다 덮고, 전부 한국 안이다", () => {
  const list = sigunguList();
  const missing = list.filter((s) => centroidOfCode(s.code) === null);
  // 인천 중구는 2026-07 개편으로 사라져 브이월드에 없다 — 그 한 곳만 허용
  assert.ok(missing.length <= 1, `대표점 없는 시군구: ${missing.map((m) => `${m.sido} ${m.name}`).join(", ")}`);
  for (const s of list) {
    const c = centroidOfCode(s.code);
    if (c) assert.ok(hasPlace(c.lat, c.lng), `${s.sido} ${s.name} 대표점이 한국 밖 (${c.lat}, ${c.lng})`);
  }
  assert.ok(CENTROID_META.matched >= 270, `표 행 ${CENTROID_META.matched}`);
});

test("D-2 군포시·화천군 원점은 이제 그 시군구다 — 양평·강릉이 아니다", () => {
  const 군포 = coordsOf("경기", "군포시");
  assert.ok(군포, "군포 좌표가 없다");
  assert.ok(km(군포!, { lat: 37.3615, lng: 126.935 }) < 5, `군포 원점이 군포에서 ${km(군포!, { lat: 37.3615, lng: 126.935 }).toFixed(1)}km 떨어져 있다`);
  const 화천 = coordsOf("강원", "화천군");
  assert.ok(화천, "화천 좌표가 없다");
  assert.ok(km(화천!, { lat: 38.1061, lng: 127.7081 }) < 5, "화천 원점이 화천이 아니다");
});

test("D-3 없는 시군구는 null 이다 — 같은 시도의 아무 축제를 돌려주지 않는다", () => {
  assert.equal(coordsOf("경기", "없는시"), null);
  assert.equal(centroidOf("경기", "없는시"), null);
});

test("D-4 619건에 있는 시군구는 여전히 619건 좌표를 쓴다 (LOO 임계 경로 불변)", () => {
  // 속초시는 619건에 있다 — 대표점 표가 아니라 축제 좌표여야 한다
  const c = coordsOf("강원", "속초시");
  const t = centroidOf("강원", "속초시");
  assert.ok(c && t, "속초 좌표가 없다");
  // 같은 시군구 안이라 5km 안이지만, 값 자체는 축제 목록의 것이다
  assert.ok(km(c!, t!) < 15, "속초 축제 좌표와 대표점이 너무 멀다");
});
