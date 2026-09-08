// 담당자의 말 → 시뮬 시나리오.
//
// "17번 부스에 사람 몰리면 줄 때문에 통행 방해 받지 않을까?" 같은 질문을
// 시뮬이 먹는 값(어느 부스를 몇 배로, 어느 출입구를 닫고, 무엇을 물을지)으로
// 옮긴다. 모델이 하는 일은 **옮기기**뿐이다 — 숫자를 만들지 않고, 판정도
// 하지 않는다. 답은 결정론 시뮬(lib/sim/sim.js)이 낸 값으로만 쓴다(불문율 5).
//
// 모델 호출은 기획서 추출(lib/extract.ts)과 같은 경로·같은 상한을 쓴다.
// 키가 없거나 실패하면 키워드 규칙(heuristicScenario)으로 떨어진다 — 심사장
// 데모가 모델 장애로 멈추면 안 된다.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
/** 질문 한 줄이라 짧게 잠근다 */
export const MAX_QUESTION = 400;
const MAX_OUTPUT_TOKENS = 400;

export type AskIntent = "hotspots" | "queue_blocks" | "gate_closure" | "capacity" | "general";

/** 시뮬이 그대로 먹는 시나리오. 전부 도면에 있는 id 만 담는다 */
export interface AskScenario {
  intent: AskIntent;
  /** 사람이 몰린다고 가정할 부스 id */
  focusBooths: string[];
  /** focusBooths 의 인기 배수 (1~5) */
  boost: number;
  closeGates: string[];
  /** 창구를 2배로 볼 부스 분류 */
  doubleServersCats: string[];
  /** 유입 배수. null 이면 화면 값 그대로 */
  inflowScale: number | null;
  /** 모델이 질문을 시나리오로 되풀이한 한 문장 — 화면에 "이렇게 가정했다"로 보인다 */
  restated: string;
  source: "model" | "rule";
}

/** 도면에서 뽑은 색인 — 모델에게 고를 수 있는 이름을 준다 */
export interface VenueIndex {
  booths: { id: string; name: string; cat: string | null }[];
  gates: { id: string; name: string }[];
}

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["hotspots", "queue_blocks", "gate_closure", "capacity", "general"] },
    focusBooths: { type: "array", items: { type: "string" }, description: "부스 id 목록. 질문이 특정 부스를 가리킬 때만" },
    boost: { type: "number", description: "focusBooths 인기 배수 1~5. 몰린다는 말이 없으면 1" },
    closeGates: { type: "array", items: { type: "string" }, description: "닫는다고 가정할 출입구 id" },
    doubleServersCats: { type: "array", items: { type: "string" }, description: "창구를 2배로 볼 부스 분류 이름" },
    inflowScale: { type: ["number", "null"], description: "유입 배수 0.2~4. 질문에 없으면 null" },
    restated: { type: "string", description: "질문을 시나리오로 되풀이한 한국어 한 문장" },
  },
  required: ["intent", "focusBooths", "boost", "closeGates", "doubleServersCats", "inflowScale", "restated"],
  additionalProperties: false,
} as const;

function systemPrompt(index: VenueIndex): string {
  const booths = index.booths.map((b) => `${b.id}=${b.name}${b.cat ? `(${b.cat})` : ""}`).join(" · ");
  const gates = index.gates.map((g) => `${g.id}=${g.name}`).join(" · ");
  const cats = Array.from(new Set(index.booths.map((b) => b.cat).filter((c): c is string => !!c))).join(" · ");
  return `너는 축제 담당 공무원의 질문을 보행자 시뮬레이션 시나리오로 옮긴다.

규칙:
- 답을 만들지 않는다. 어디가 막힐지, 몇 명이 올지 절대 쓰지 않는다. 시나리오만 만든다.
- id 는 아래 목록에 있는 것만 쓴다. 목록에 없는 부스·출입구는 비워 둔다.
- "17번 부스"처럼 번호만 말하면 이름에 그 번호가 든 부스를 고른다. 여러 개면 전부.
- "몰린다·붐빈다·인기" 는 boost 3, "엄청·전부" 는 5, 언급 없으면 1.
- "닫으면·막히면·통제" 는 closeGates. "창구 늘리면·2배" 는 doubleServersCats.
- 어디가 위험한지·병목인지 묻는 일반 질문은 intent=hotspots, 줄·대기·통행 방해는 queue_blocks,
  출입구 얘기는 gate_closure, 몇 배까지 견디나는 capacity, 나머지는 general.
- restated 는 "…라고 가정하고 돌린다" 꼴의 한 문장. 존댓말 아님.

부스: ${booths}
출입구: ${gates}
부스 분류: ${cats}`;
}

/** 모델 출력이 도면과 맞는지 — id 검증·범위 고정. 순수 함수 */
export function sanitizeScenario(raw: unknown, index: VenueIndex, source: AskScenario["source"]): AskScenario {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const boothIds = new Set(index.booths.map((b) => b.id));
  const gateIds = new Set(index.gates.map((g) => g.id));
  const cats = new Set(index.booths.map((b) => b.cat).filter((c): c is string => !!c));
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const intents: AskIntent[] = ["hotspots", "queue_blocks", "gate_closure", "capacity", "general"];
  const intent = intents.includes(o.intent as AskIntent) ? (o.intent as AskIntent) : "general";
  const boostRaw = typeof o.boost === "number" && Number.isFinite(o.boost) ? o.boost : 1;
  const scaleRaw = typeof o.inflowScale === "number" && Number.isFinite(o.inflowScale) ? o.inflowScale : null;
  return {
    intent,
    focusBooths: strs(o.focusBooths).filter((id) => boothIds.has(id)),
    boost: Math.min(5, Math.max(1, boostRaw)),
    closeGates: strs(o.closeGates).filter((id) => gateIds.has(id)),
    doubleServersCats: strs(o.doubleServersCats).filter((c) => cats.has(c)),
    inflowScale: scaleRaw === null ? null : Math.min(4, Math.max(0.2, scaleRaw)),
    restated: typeof o.restated === "string" && o.restated.trim() ? o.restated.trim().slice(0, 200) : "",
    source,
  };
}

/**
 * 키워드 규칙. 모델이 없을 때의 폴백이고, 같은 질문이면 같은 시나리오다.
 * 번호("17번")·부스 이름·출입구 이름을 질문에서 찾는다.
 */
export function heuristicScenario(question: string, index: VenueIndex): AskScenario {
  const q = question.replace(/\s+/g, " ");
  const focus = new Set<string>();
  for (const m of q.matchAll(/(\d+)\s*번/g)) {
    const n = m[1];
    for (const b of index.booths) if (new RegExp(`(^|\\D)${n}(\\D|$)`).test(b.name)) focus.add(b.id);
  }
  for (const b of index.booths) if (b.name.length >= 2 && q.includes(b.name)) focus.add(b.id);
  const closeGates = index.gates
    .filter((g) => /닫|막|통제|폐쇄/.test(q) && g.name.split(/[(·]/)[0].length >= 2 && q.includes(g.name.split(/[(·]/)[0]))
    .map((g) => g.id);
  const cats = Array.from(new Set(index.booths.map((b) => b.cat).filter((c): c is string => !!c)));
  const doubleServersCats = /창구|2배|두\s*배|늘리/.test(q) ? cats.filter((c) => q.includes(c)) : [];
  const boost = /전부|엄청|다\s*몰/.test(q) ? 5 : /몰리|붐비|인기|쏠리/.test(q) ? 3 : 1;
  const intent: AskIntent = /줄|대기|통행|막히/.test(q) && focus.size
    ? "queue_blocks"
    : closeGates.length
      ? "gate_closure"
      : /몇\s*배|견디|한계|수용/.test(q)
        ? "capacity"
        : /병목|위험|사고|어디|몰리/.test(q)
          ? "hotspots"
          : "general";
  const names = index.booths.filter((b) => focus.has(b.id)).map((b) => b.name);
  const parts: string[] = [];
  if (names.length) parts.push(`${names.join("·")}에 평소의 ${boost}배로 몰린다`);
  if (closeGates.length) parts.push(`${index.gates.filter((g) => closeGates.includes(g.id)).map((g) => g.name).join("·")}를 닫는다`);
  if (doubleServersCats.length) parts.push(`${doubleServersCats.join("·")} 부스 창구를 2배로 한다`);
  const restated = (parts.length ? parts.join(", ") : "화면의 시나리오 그대로") + "고 가정하고 돌린다";
  return sanitizeScenario(
    { intent, focusBooths: [...focus], boost, closeGates, doubleServersCats, inflowScale: null, restated },
    index,
    "rule",
  );
}

/**
 * "17번 부스" 같은 번호 지목은 규칙이 모델을 이긴다.
 * 모델이 id 의 숫자(b17)를 부스 번호로 읽어 엉뚱한 부스(체험 13)를 고른 실측이 있다(2026-09-08).
 * 이름에 그 번호가 든 부스가 정답이고, 그건 문자열 검색으로 확정된다.
 */
export function pinNumberedBooths(question: string, index: VenueIndex, sc: AskScenario): AskScenario {
  if (!/\d+\s*번/.test(question)) return sc;
  const rule = heuristicScenario(question, index);
  if (rule.focusBooths.length === 0) return sc;
  return { ...sc, focusBooths: rule.focusBooths, boost: Math.max(sc.boost, rule.boost) };
}

export function hasModelKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** 모델에게 묻는다. 실패하면 던진다 — 폴백은 호출자가 고른다 */
export async function askModel(question: string, index: VenueIndex): Promise<AskScenario> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "oneshot-mvp",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt(index) },
        { role: "user", content: question.slice(0, MAX_QUESTION) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "sim_scenario", strict: true, schema: SCHEMA } },
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`model ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  return pinNumberedBooths(question, index, sanitizeScenario(JSON.parse(text), index, "model"));
}
