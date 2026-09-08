// 위경도 ↔ 행사장 평면(m). 행사장은 1km 안쪽이라 등장방형 근사면 오차 <0.1%.
const R = 6378137;
export function makeProjection(originLng, originLat) {
  const cos = Math.cos((originLat * Math.PI) / 180);
  return {
    toM([lng, lat]) {
      return [((lng - originLng) * Math.PI / 180) * R * cos, ((lat - originLat) * Math.PI / 180) * R];
    },
    toLngLat([x, y]) {
      return [originLng + (x / (R * cos)) * 180 / Math.PI, originLat + (y / R) * 180 / Math.PI];
    },
  };
}

/** GeoJSON FeatureCollection → 엔진이 먹는 venue(m). properties.kind 로 분류 */
export function venueFromGeoJSON(fc, proj) {
  const venue = { sites: [], obstacles: [], soft: [], corridors: [], gates: [], attractions: [] };
  const ring = f => f.geometry.coordinates[0].slice(0, -1).map(proj.toM);
  for (const f of fc.features) {
    const p = f.properties ?? {};
    if (f.geometry.type === "LineString") {
      if (p.kind === "corridor" || p.kind === "path") venue.corridors.push({ points: f.geometry.coordinates.map(proj.toM), width: p.width ?? 4 });
      continue;
    }
    if (f.geometry.type !== "Polygon") continue;
    const poly = ring(f);
    switch (p.kind) {
      case "site": venue.sites.push(poly); break;
      case "obstacle": case "building": case "water": venue.obstacles.push(poly); break;
      case "planting": venue.soft.push(poly); break; // 식재지는 통로(산책로)에 진다
      case "gate": venue.gates.push({ id: p.id ?? f.id ?? `gate${venue.gates.length}`, name: p.name ?? "출입구", poly, share: p.share ?? 1 }); break;
      case "booth": case "stage": case "toilet": case "view": {
        // 몸체는 장애물, 앞(front)은 대기 지점. front 가 없으면 다각형 중심에서 queueDir 반대편 모서리 바깥 1m
        if (p.kind !== "view") venue.obstacles.push(poly);
        const c = centroid(poly);
        // 영벡터 방향은 금지 — 앞 지점이 몸체 중심이 되어 무대 위에 사람이 올라간다(레드팀 2026-09-05)
        const dir = p.queueDir && (p.queueDir[0] || p.queueDir[1]) ? p.queueDir : [0, -1];
        const front = p.front ? proj.toM(p.front) : [c[0] + dir[0] * (halfExtent(poly, dir) + 1.0), c[1] + dir[1] * (halfExtent(poly, dir) + 1.0)];
        venue.attractions.push({ id: p.id ?? f.id ?? `${p.kind}${venue.attractions.length}`, name: p.name ?? p.kind, kind: p.kind, poly, front, queueDir: dir, popularity: p.popularity ?? 1, servers: p.servers ?? 1, serviceSec: p.serviceSec ?? 60 });
        break;
      }
    }
  }
  const s = venue.gates.reduce((a, g) => a + g.share, 0) || 1;
  for (const g of venue.gates) g.share /= s;
  return venue;
}
export function centroid(poly) { let x = 0, y = 0; for (const [a, b] of poly) { x += a; y += b; } return [x / poly.length, y / poly.length]; }
function halfExtent(poly, dir) { const c = centroid(poly); let m = 0; for (const [x, y] of poly) m = Math.max(m, (x - c[0]) * dir[0] + (y - c[1]) * dir[1]); return m; }
