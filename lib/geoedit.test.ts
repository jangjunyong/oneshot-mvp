import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBooth, addCorridor, alignToNeighbor, centroidM, hitCorridor, hitTest, nextId, orientationOf, projectionOf, remove, rotate, rotateTo, snapToRow, translate, type FC,
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

describe("이웃 줄에 맞추기 — 15° 눌러서는 도로 각도에 못 맞춘다", () => {
  it("orientationOf 는 놓은 각도를 돌려준다", () => {
    const fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x", rotation: 8.6 });
    assert.ok(Math.abs(orientationOf(fc.features[0], proj) - 8.6) < 1e-6);
  });
  it("snapToRow: 이웃 옆을 누르면 같은 각도·3.5m 피치 자리로", () => {
    const fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x", rotation: 30 });
    const a = (30 * Math.PI) / 180;
    // 축 방향으로 3.2m, 옆으로 0.4m 어긋난 점 → 3.5m 자리, 옆 어긋남 0
    const p: [number, number] = [3.2 * Math.cos(a) - 0.4 * Math.sin(a), 3.2 * Math.sin(a) + 0.4 * Math.cos(a)];
    const r = snapToRow(fc, proj, p);
    assert.ok(Math.abs(r.rotation - 30) < 1e-6);
    assert.ok(Math.abs(r.at[0] - 3.5 * Math.cos(a)) < 1e-6 && Math.abs(r.at[1] - 3.5 * Math.sin(a)) < 1e-6);
    assert.equal(r.neighbor?.properties?.id, "b1");
  });
  it("snapToRow: 옆으로 멀면 각도만, 이웃이 없으면 그대로", () => {
    const fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x", rotation: 30 });
    const far = snapToRow(fc, proj, [0, 5]);
    assert.ok(Math.abs(far.rotation - 30) < 1e-6);
    assert.deepEqual(far.at, [0, 5]);
    const none = snapToRow(fc, proj, [50, 50]);
    assert.equal(none.neighbor, null);
    assert.equal(none.via, null);
    assert.equal(none.rotation, 0);
  });
  it("rotateTo·alignToNeighbor 는 절대 각도로 맞춘다", () => {
    let fc = addBooth(base, proj, [0, 0], { name: "a", cat: "x", rotation: 8.6 });
    fc = addBooth(fc, proj, [4, 0], { name: "b", cat: "x", rotation: 45 });
    fc = rotateTo(fc, proj, "b2", 100);
    assert.ok(Math.abs(orientationOf(fc.features[1], proj) - 100) < 1e-6);
    fc = alignToNeighbor(fc, proj, "b2");
    assert.ok(Math.abs(orientationOf(fc.features[1], proj) - 8.6) < 1e-6);
  });
});

describe("첫 부스 — 이웃이 없으면 통로 방향·연석 바깥에 붙는다", () => {
  it("도로 띠 안을 누르면 도로 각도로, 누른 쪽 연석 바깥 0.3m 에", () => {
    // 폭 10m 도로가 (0,0)→(100,50) 으로 비스듬히
    const fc = addCorridor(base, proj, [[0, 0], [100, 50]], 10);
    const ang = Math.atan2(50, 100), ux = Math.cos(ang), uy = Math.sin(ang);
    // 도로 위 s=40 지점에서 왼쪽으로 2m 들어간 곳을 누른다
    const foot: [number, number] = [40 * ux, 40 * uy];
    const p: [number, number] = [foot[0] - uy * 2, foot[1] + ux * 2];
    const r = snapToRow(fc, proj, p);
    assert.equal(r.via, "corridor");
    assert.ok(Math.abs(r.rotation - (ang * 180) / Math.PI) < 1e-6);
    // 왼쪽 연석(5m) 바깥 1.8m = 6.8m
    const lat = -(r.at[0] - foot[0]) * uy + (r.at[1] - foot[1]) * ux;
    assert.ok(Math.abs(lat - 6.8) < 1e-6, String(lat));
  });
  it("통로에서 멀리(가장자리 3m 밖) 누르면 각도만 맞추고 자리는 그대로", () => {
    const fc = addCorridor(base, proj, [[0, 0], [100, 0]], 4);
    const r = snapToRow(fc, proj, [50, 9]);
    assert.equal(r.via, "corridor");
    assert.equal(r.rotation, 0);
    assert.deepEqual(r.at, [50, 9]);
  });
  it("통로가 15m 안에 없으면 아무것도 안 한다", () => {
    const fc = addCorridor(base, proj, [[0, 0], [100, 0]], 4);
    assert.equal(snapToRow(fc, proj, [50, 40]).via, null);
  });
  it("이웃 부스가 있으면 부스가 통로보다 우선", () => {
    let fc = addCorridor(base, proj, [[0, 0], [100, 0]], 4);
    fc = addBooth(fc, proj, [50, 3.8], { name: "a", cat: "x", rotation: 20 });
    const r = snapToRow(fc, proj, [53.4, 4.1]);
    assert.equal(r.via, "booth");
    assert.ok(Math.abs(r.rotation - 20) < 1e-6);
  });
});
