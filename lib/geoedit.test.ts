import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBooth, addCorridor, centroidM, hitCorridor, hitTest, nextId, projectionOf, remove, rotate, translate, type FC,
} from "@/lib/geoedit";

const base: FC = { type: "FeatureCollection", origin: [126.925, 37.355], features: [] };
const proj = projectionOf(base);

describe("geoedit — 부스 놓기·옮기기·돌리기는 m 평면에서 정확해야 한다", () => {
  it("3×3 부스를 놓으면 중심이 그 점이고 넓이가 9㎡", () => {
    const fc = addBooth(base, proj, [10, 20], { name: "체험 1", cat: "체험" });
    const f = fc.features[0];
    assert.equal(f.properties?.id, "b1");
    const c = centroidM(f, proj);
    assert.ok(Math.abs(c[0] - 10) < 1e-6 && Math.abs(c[1] - 20) < 1e-6);
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0].map((p) => proj.toM(p));
    const w = Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]);
    const h = Math.hypot(ring[2][0] - ring[1][0], ring[2][1] - ring[1][1]);
    assert.ok(Math.abs(w - 3) < 1e-6 && Math.abs(h - 3) < 1e-6);
  });
  it("hitTest 는 안쪽 점만 맞히고, 나중에 놓은 것이 위", () => {
    let fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x" });
    fc = addBooth(fc, proj, [1, 0], { name: "b", cat: "x" });
    assert.equal(hitTest(fc, proj, [0.5, 0])?.properties?.name, "b");
    assert.equal(hitTest(fc, proj, [-1.2, 0])?.properties?.name, "a");
    assert.equal(hitTest(fc, proj, [10, 10]), null);
  });
  it("translate 는 중심을 dx,dy 만큼 옮기고 원본은 안 건드린다", () => {
    const fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x" });
    const moved = translate(fc, proj, "b1", 5, -2);
    const c = centroidM(moved.features[0], proj);
    assert.ok(Math.abs(c[0] - 5) < 1e-6 && Math.abs(c[1] + 2) < 1e-6);
    const c0 = centroidM(fc.features[0], proj);
    assert.ok(Math.abs(c0[0]) < 1e-6);
  });
  it("rotate 90° 는 중심을 지키고 줄 방향도 돈다", () => {
    const fc = addBooth(base, proj, [3, 3], { name: "a", cat: "x" });
    const r = rotate(fc, proj, "b1", 90);
    const c = centroidM(r.features[0], proj);
    assert.ok(Math.abs(c[0] - 3) < 1e-6 && Math.abs(c[1] - 3) < 1e-6);
    const qd = r.features[0].properties?.queueDir as [number, number];
    // 처음 [0,-1](남) → 90° 돌면 [1,0](동)
    assert.ok(Math.abs(qd[0] - 1) < 1e-3 && Math.abs(qd[1]) < 1e-3);
  });
  it("nextId 는 비어 있는 다음 번호, remove 는 그 id 만 지운다", () => {
    let fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x" });
    fc = addBooth(fc, proj, [9, 9], { name: "b", cat: "x" });
    assert.equal(nextId(fc, "b"), "b3");
    fc = remove(fc, "b1");
    assert.deepEqual(fc.features.map((f) => f.properties?.id), ["b2"]);
    assert.equal(nextId(fc, "b"), "b3");
  });
  it("addCorridor 는 두 점 이상만, hitCorridor 는 폭/2+여유 안", () => {
    const one = addCorridor(base, proj, [[0, 0]], 4);
    assert.equal(one.features.length, 0);
    const fc = addCorridor(base, proj, [[0, 0], [10, 0]], 4, "통로");
    assert.equal(fc.features[0].properties?.id, "c1");
    assert.ok(hitCorridor(fc, proj, [5, 2.5]));
    assert.equal(hitCorridor(fc, proj, [5, 3.5]), null);
  });
});
