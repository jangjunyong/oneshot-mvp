import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicScenario, pinNumberedBooths, sanitizeScenario, type VenueIndex } from "@/lib/simask";

const index: VenueIndex = {
  booths: [
    { id: "b17", name: "체험 17", cat: "철쭉마켓(체험)" },
    { id: "b117", name: "철쭉푸드 17", cat: "먹거리" },
    { id: "b2", name: "푸드트럭 1", cat: "푸드트럭" },
  ],
  gates: [
    { id: "g_suri", name: "8단지입구·수리산역 입구" },
    { id: "g_fire", name: "소방서사거리 입구(산본역·버스)" },
  ],
};

describe("sanitizeScenario — 도면에 없는 id 는 버리고 범위를 고정한다", () => {
  it("모르는 부스·출입구 id 를 버린다", () => {
    const s = sanitizeScenario(
      { intent: "queue_blocks", focusBooths: ["b17", "b999"], boost: 9, closeGates: ["g_suri", "nope"], doubleServersCats: ["먹거리", "없는분류"], inflowScale: 12, restated: " x " },
      index,
      "model",
    );
    assert.deepEqual(s.focusBooths, ["b17"]);
    assert.deepEqual(s.closeGates, ["g_suri"]);
    assert.deepEqual(s.doubleServersCats, ["먹거리"]);
    assert.equal(s.boost, 5);
    assert.equal(s.inflowScale, 4);
    assert.equal(s.restated, "x");
  });
  it("엉뚱한 입력이면 general 빈 시나리오", () => {
    const s = sanitizeScenario("garbage", index, "model");
    assert.equal(s.intent, "general");
    assert.deepEqual(s.focusBooths, []);
    assert.equal(s.boost, 1);
    assert.equal(s.inflowScale, null);
  });
});

describe("heuristicScenario — 모델 없이 키워드로", () => {
  it("'17번 부스' 는 이름에 17 이 든 부스 전부, 줄 얘기면 queue_blocks", () => {
    const s = heuristicScenario("17번 부스에 사람 몰리면 줄 때문에 통행 방해 받지 않을까?", index);
    assert.equal(s.intent, "queue_blocks");
    assert.deepEqual(s.focusBooths.sort(), ["b117", "b17"]);
    assert.equal(s.boost, 3);
    assert.equal(s.source, "rule");
    assert.match(s.restated, /체험 17/);
  });
  it("'117' 은 17번이 아니다 — 숫자 경계", () => {
    const s = heuristicScenario("1번 부스 어때", index);
    assert.deepEqual(s.focusBooths, ["b2"]);
  });
  it("출입구를 닫는 질문은 gate_closure", () => {
    const s = heuristicScenario("소방서사거리 입구를 닫으면 어디가 병목이야?", index);
    assert.equal(s.intent, "gate_closure");
    assert.deepEqual(s.closeGates, ["g_fire"]);
  });
  it("병목·사고 구간 일반 질문은 hotspots", () => {
    const s = heuristicScenario("사고 날 것 같은 구간이 어디야?", index);
    assert.equal(s.intent, "hotspots");
    assert.deepEqual(s.focusBooths, []);
  });
  it("같은 질문이면 같은 시나리오", () => {
    const q = "푸드트럭 1에 엄청 몰릴 것 같은데";
    assert.deepEqual(heuristicScenario(q, index), heuristicScenario(q, index));
    assert.equal(heuristicScenario(q, index).boost, 5);
  });
});

describe("pinNumberedBooths — 번호 지목은 규칙이 모델을 이긴다", () => {
  it("모델이 b17(체험 13)을 골라도 '17번' 이면 이름의 17 로 바꾼다", () => {
    const model = sanitizeScenario({ intent: "queue_blocks", focusBooths: ["b2"], boost: 1, closeGates: [], doubleServersCats: [], inflowScale: null, restated: "x" }, index, "model");
    const out = pinNumberedBooths("17번 부스에 사람 몰리면?", index, model);
    assert.deepEqual(out.focusBooths.sort(), ["b117", "b17"]);
    assert.equal(out.boost, 3);
    assert.equal(out.source, "model");
  });
  it("번호가 없으면 모델 결과 그대로", () => {
    const model = sanitizeScenario({ intent: "hotspots", focusBooths: ["b2"], boost: 2, closeGates: [], doubleServersCats: [], inflowScale: null, restated: "x" }, index, "model");
    assert.deepEqual(pinNumberedBooths("푸드트럭 쪽 어때", index, model).focusBooths, ["b2"]);
  });
});
