// 기획서 텍스트 → 5축 초안.
//
// 지자체마다 기획서 양식이 다르다. 법정 서식([별지 제20호의3] 지역축제
// 안전관리계획서)이 통일한 것은 표지 한 장뿐이고, 실제 계획은 "첨부서류"로
// 빠져 있다 (docs/참고사이트.md). 그래서 자유 텍스트를 읽어야 한다.
//
// 이 파일이 하는 일은 **옮겨 적기**지 판단이 아니다.
// 닮은 축제 찾기(match.ts)와 등급(grade.ts)에는 모델이 끼지 않는다.
// 여기서 나온 값은 확정이 아니라 사람이 고칠 초안이다.
//
// OpenRouter 를 쓰는 이유는 키마다 지출 상한을 걸 수 있어서다. 배포본은
// 로그인이 없어 주소를 아는 사람은 누구나 누를 수 있다. SDK 는 안 쓴다 —
// POST 한 번이라 의존성을 늘릴 이유가 없다.

import {
  ACCESSIBILITY_LABEL,
  MAX_PLAN_TEXT,
  THEME_NAME,
  type ExtractedKey,
  type Extraction,
} from "@/lib/types";
import { populationOf } from "@/lib/festivals";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * 무료 모델. 크레딧을 넣지 않으면 청구 자체가 불가능하다.
 *
 * 무료 + structured outputs 를 둘 다 만족하는 5개 중 한국어에 가장 낫다.
 * 대안 — nvidia/nemotron-3-super-120b-a12b:free
 * 품질이 모자라면 OPENROUTER_MODEL 로 갈아끼운다
 * (google/gemini-3.7-flash 약 3원/건 · anthropic/claude-sonnet-5 약 16원/건).
 */
const DEFAULT_MODEL = "z-ai/glm-5.2:free";

const KOREAN_NAME: Record<ExtractedKey, string> = {
  sido: "시도",
  sigungu: "시군구",
  month: "개최 월",
  themeCode: "테마",
  accessibility: "접근성",
};

const themeChoices = Object.entries(THEME_NAME)
  .map(([code, name]) => `${code}=${name}`)
  .join(" · ");

const accessChoices = Object.entries(ACCESSIBILITY_LABEL)
  .map(([code, name]) => `${code}=${name}`)
  .join(" · ");

const SYSTEM = `너는 한국 지자체의 축제 기획서에서 정해진 항목만 옮겨 적는다.

규칙:
- 문서에 근거가 없는 항목은 반드시 null 로 둔다. 추측하지 않는다.
- 값을 채운 항목은 evidence 에 **원문 문장을 그대로** 옮긴다. 요약하거나 고쳐 쓰지 않는다.
- 방문객 수는 다루지 않는다. 문서에 예상 인원이 적혀 있어도 무시한다.

themeCode 는 다음 중 하나: ${themeChoices}
accessibility 는 교통 접근성이다. 다음 중 하나: ${accessChoices}
  판단 기준 — 고속철도역·고속도로IC·지하철역까지의 거리, 대중교통 편수,
  주차 규모가 문서에 적혀 있으면 그것을 근거로 고른다. 아무 언급이 없으면 null.`;

// strict:true 라서 nullable 은 type 배열로 적어야 한다. 빼면 모델이 항목을
// 지어내서라도 채운다 — 그게 제일 나쁜 결과다.
const SCHEMA = {
  type: "object",
  properties: {
    sido: { type: ["string", "null"], description: "광역시도. 예: 경북, 전남" },
    sigungu: {
      type: ["string", "null"],
      description: "시군구. 예: 김천시, 담양군",
    },
    month: { type: ["integer", "null"], description: "개최 월 1~12" },
    themeCode: { type: ["integer", "null"], description: "테마 코드 1~8" },
    accessibility: {
      type: ["integer", "null"],
      description: "교통 접근성 1~5",
    },
    evidence: {
      type: "object",
      description: "값을 채운 항목만. 원문 문장을 그대로 옮긴다",
      properties: {
        sido: { type: "string" },
        sigungu: { type: "string" },
        month: { type: "string" },
        themeCode: { type: "string" },
        accessibility: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  required: [
    "sido",
    "sigungu",
    "month",
    "themeCode",
    "accessibility",
    "evidence",
  ],
  additionalProperties: false,
} as const;

/** 모델이 돌려준 것. populationManMyeong·missing·source 는 여기서 붙인다 */
interface ModelOutput {
  sido: string | null;
  sigungu: string | null;
  month: number | null;
  themeCode: number | null;
  accessibility: number | null;
  evidence: Partial<Record<ExtractedKey, string>>;
}

/**
 * 키가 없을 때 쓰는 고정 초안. 김천김밥축제 1회 조건이다 (PRD 성공 판정).
 *
 * 화면을 만드는 동안 모델을 부르지 않기 위한 것이고, 동시에 실패 경로이기도
 * 하다 — 배포본에서 한도가 걸리거나 API 가 죽어도 화면은 살아 있어야 한다
 * (docs/FLOW.md "도구가 죽으면 축소 응답").
 */
const SAMPLE: ModelOutput = {
  sido: "경북",
  sigungu: "김천시",
  month: 10,
  themeCode: 1,
  accessibility: 2,
  evidence: {
    sido: "[샘플] 경상북도 김천시 일원에서 개최한다.",
    sigungu: "[샘플] 경상북도 김천시 일원에서 개최한다.",
    month: "[샘플] 개최 기간: 10월 중 3일간",
    themeCode: "[샘플] 지역 특산물인 김밥을 주제로 한 음식 축제",
    accessibility: "[샘플] KTX 김천구미역에서 차량 20분, 전용 주차장 400면",
  },
};

/** 키가 있으면 진짜로 부르고, 없으면 샘플로 떨어진다 */
export function hasModelKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modelName(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

function assemble(out: ModelOutput, source: Extraction["source"]): Extraction {
  const missing = (Object.keys(KOREAN_NAME) as ExtractedKey[])
    .filter((k) => out[k] === null || out[k] === undefined)
    .map((k) => KOREAN_NAME[k]);

  // 인구는 지역이 정해져야 찾을 수 있다. 지역이 비면 인구도 빈다.
  const population =
    out.sido && out.sigungu ? populationOf(out.sido, out.sigungu) : null;
  if (population === null) missing.push("지역 인구");

  return { ...out, populationManMyeong: population, missing, source };
}

/**
 * 기획서 텍스트에서 초안을 뽑는다.
 *
 * 호출 전에 반드시 하루 한도를 확인할 것 — 이 함수는 한도를 모른다.
 * 입력은 MAX_PLAN_TEXT 에서 자른다. 1건당 비용 상한을 고정하기 위해서다.
 */
/**
 * 추출이 실패했을 때 **화면에 나갈 한 문장**.
 *
 * 2026-08-30 실제로 터진 것: 무료 모델이 429 를 뱉었는데 그 본문이 담당자
 * 화면과 주소창에 통째로 실렸다 —
 *   `추출 요청이 거절됐습니다 (429) {"error":{"message":"Provider returned
 *    error","code":429,"metadata":{"raw":"z-ai/glm-5.2:free is temporarily
 *    rate-limited upstream. Please retry shortly, or add your own key...`
 *
 * 공급자 사정은 우리가 고칠 몫이지 사용자가 읽을 몫이 아니다. 원문은
 * 서버 로그로 보내고, 여기서는 **무엇을 할 수 있는지**만 말한다.
 * 어느 갈래로 가든 다음 행동(다시 누르기 / 직접 넣기)으로 이어야 한다 —
 * 막다른 문장을 내면 담당자는 화면을 닫는다.
 *
 * `detail` 은 받되 쓰지 않는다. 인자로 남겨 둔 이유는 나중에 사유별로
 * 갈래를 더 나눌 때 여기가 그 자리이기 때문이다.
 */
export function extractFailureMessage(status: number, detail = ""): string {
  void detail;
  if (status === 429) {
    return "지금 자동 추출이 붐빕니다. 잠시 후 다시 누르거나 항목을 직접 넣어 주세요";
  }
  if (status === 401 || status === 403) {
    return "자동 추출을 쓸 수 없는 상태입니다. 항목을 직접 넣어 주세요";
  }
  if (status === 402) {
    return "자동 추출 한도를 다 썼습니다. 항목을 직접 넣어 주세요";
  }
  if (status === 408 || status === 504) {
    return "자동 추출이 시간 안에 끝나지 않았습니다. 다시 누르거나 직접 넣어 주세요";
  }
  if (status >= 500) {
    return "자동 추출이 일시적으로 멈췄습니다. 잠시 후 다시 눌러 주세요";
  }
  return "자동 추출에 실패했습니다. 항목을 직접 넣어 주세요";
}

export async function extractPlan(planText: string): Promise<Extraction> {
  if (!hasModelKey()) return assemble(SAMPLE, "sample");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // 오픈라우터 대시보드에서 어느 앱이 쓴 건지 구분하기 위한 것
      "X-Title": "oneshot-mvp",
    },
    body: JSON.stringify({
      model: modelName(),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: planText.slice(0, MAX_PLAN_TEXT) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "festival_plan", strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    // 사유는 서버 로그에만 남긴다. 화면에는 다듬은 한국어만 내보낸다 —
    // 담당 공무원이 공급자 사정을 읽을 이유가 없다 (extractFailureMessage).
    const detail = await res.text().catch(() => "");
    console.error("[extract] 추출 실패", res.status, detail.slice(0, 300));
    throw new Error(extractFailureMessage(res.status, detail));
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("모델이 값을 돌려주지 않았습니다");

  // 스키마를 걸었어도 파싱은 감싼다. 여기서 터지면 화면이 통째로 죽는다.
  let out: ModelOutput;
  try {
    out = JSON.parse(content) as ModelOutput;
  } catch {
    throw new Error("모델 응답을 읽지 못했습니다");
  }

  return assemble(out, "llm");
}
