// 네이버 데이터랩 검색어트렌드 — **검증되기 전까지 화면에 안 나간다.**
//
// ── 왜 만들었고 왜 아직 안 붙였나 (2026-08-30, docs/DECISIONS.md) ──
//
// 사용자 물음: "축제 수요는 검색량이 제일 ground truth 같지 않나? 근데 타겟이
// 고령이면 검색량에 안 잡히는데."
//
// 사양을 확인했다 — 2016-01-01~, **일 단위**, PC/모바일, **연령(11 = 60세
// 이상)·성별 필터 있음**, **지역 필터 없음**, `ratio` 는 **상대값**(요청한
// 키워드 그룹 안에서 최댓값 100 기준. 절대 검색량은 안 준다).
//
// 그래서:
//   - "평소 대비 N배"는 낼 수 있다. 상대값끼리의 비는 유효하다
//   - "고령층은 안 잡힌다"는 추측하지 말고 **연령 필터로 재면 된다**
//   - 지역 필터가 없는 건 문제가 아니다. "김천김밥축제"라는 검색어 자체가
//     지역을 특정한다
//
// ── 판정: 화면에 붙이지 않는다 (2026-08-31, 실측으로 끝냄) ──
//
// 키를 받아 실제로 재 봤다. NAVER API HUB 에서 발급, 표본 120건 중 검색량이
// 잡힌 90건:
//
//   검색량 배수 vs 실측 방문 배수 (n=90)
//     피어슨   r = 0.037
//     스피어만 ρ = 0.192      <- 미리 정해 둔 컷 0.3 미만
//
// **버린다.** 기준은 재기 전에 정해 뒀고(`evals/search-volume.mjs` 꼬리말),
// 결과가 마음에 안 든다고 기준을 옮기지 않는다. 검색량은 관심이지 방문이
// 아니고, 우리에겐 이미 KT 이동통신 실측이 있다.
//
// 덤으로 사용자의 가설도 수치로 끝났다 — "타겟이 고령이면 검색량에 안 잡힌다":
// 60세 이상의 개최 전 배수가 전체보다 낮은 축제가 **80건 중 62건(78%)**.
// 방향은 맞았다. 다만 그게 이 축을 살릴 근거는 아니다.
//
// 파일을 지우지는 않는다. 실험을 되돌려 볼 수 있어야 하고, 누가 다시
// "검색량 쓰면 되지 않나"라고 물을 때 답이 여기 있어야 한다.
// **화면에는 연결하지 말 것.**
//
// 덧: 공모전 배점의 "데이터 활용 20점"은 **한국관광공사 OpenAPI 필수**라
// 네이버는 그 점수에 안 잡힌다. 이건 점수용이 아니라 물음에 답하려고 만든다.

export function hasNaverKey(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

/** 데이터랩 연령 코드 → 화면에 그대로 나갈 한국어 */
export const AGE_LABEL: Record<string, string> = {
  "1": "0~12세",
  "2": "13~18세",
  "3": "19~24세",
  "4": "25~29세",
  "5": "30~34세",
  "6": "35~39세",
  "7": "40~44세",
  "8": "45~49세",
  "9": "50~54세",
  "10": "55~59세",
  "11": "60세 이상",
};

/** 이 코드가 "고령층"이다. 사용자의 물음이 정확히 이 칸을 가리킨다 */
export const ELDERLY_CODE = "11";

/** 응답의 한 점. period 는 YYYY-MM-DD, ratio 는 **상대값**이다 */
export interface TrendPoint {
  period: string;
  ratio: number;
}

export interface TrendBody {
  startDate: string;
  endDate: string;
  /** 개최 전후를 보려면 일 단위여야 한다 */
  timeUnit: "date";
  keywordGroups: { groupName: string; keywords: string[] }[];
  ages?: string[];
}

/** 요청 본문. 순수 — 네트워크 없이 테스트할 수 있게 갈라 둔다 */
export function buildTrendBody(
  keyword: string,
  startDate: string,
  endDate: string,
  ages?: string[],
): TrendBody {
  return {
    startDate,
    endDate,
    timeUnit: "date",
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    ...(ages && ages.length > 0 ? { ages } : {}),
  };
}

export interface LeadRatio {
  /** 개최 직전 구간 평균 ÷ 평소 구간 평균 */
  ratio: number;
  /** 평소 구간 평균(상대값). 0 이면 배수를 못 낸다 */
  baseline: number;
  leadDays: number;
  /** 평소 구간에 든 날 수 — 표본이 몇 개인지 밝힌다 */
  baselineDays: number;
}

const ymd = (yyyymmdd: string) =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/**
 * 개최 전 검색량 배수 — 평소 구간 대비 개최 직전 `leadDays` 구간.
 *
 * 사용자가 짚은 것: "기획안은 25일 전에 내는데 사람들은 3일 전에 정한다."
 * 그 리드타임이 실제로 며칠인지가 여기서 보인다. 다만 **이건 관심의 배수지
 * 방문의 배수가 아니다** — 둘을 잇는 상관은 evals 가 잰다.
 *
 * 표본이 모자라거나 평소가 0 이면 null. 무한대를 화면에 올리지 않는다.
 */
export function leadRatio(
  rows: readonly TrendPoint[],
  eventStartDate: string,
  leadDays = 7,
): LeadRatio | null {
  if (rows.length === 0 || !/^\d{8}$/.test(eventStartDate)) return null;

  const 개최 = ymd(eventStartDate);
  const 직전시작 = new Date(개최);
  직전시작.setDate(직전시작.getDate() - leadDays);
  const 직전경계 = 직전시작.toISOString().slice(0, 10);

  const 직전 = rows.filter((r) => r.period >= 직전경계 && r.period < 개최);
  const 평소 = rows.filter((r) => r.period < 직전경계);
  if (직전.length === 0 || 평소.length === 0) return null;

  const 평균 = (a: readonly TrendPoint[]) =>
    a.reduce((s, r) => s + r.ratio, 0) / a.length;
  const baseline = 평균(평소);
  if (!(baseline > 0)) return null;

  return {
    ratio: 평균(직전) / baseline,
    baseline,
    leadDays,
    baselineDays: 평소.length,
  };
}

/**
 * 60세 이상이 전체에서 차지하는 몫.
 *
 * 사용자의 가설("타겟이 고령이면 검색량에 안 잡힌다")을 추측이 아니라
 * 수치로 끝내려고 있다. 자료가 없으면 0 이 아니라 **null** — 안 잡힌 것과
 * 0인 것은 다르다.
 */
export function elderlyShare(byAge: Record<string, number>): number | null {
  const 합 = Object.values(byAge).reduce((s, v) => s + v, 0);
  if (!(합 > 0)) return null;
  return (byAge[ELDERLY_CODE] ?? 0) / 합;
}

/**
 * **NAVER API HUB** 의 검색어트렌드 문. 실제 키로 200 을 받아 확인했다.
 *
 * ── 문을 세 번 옮긴 기록 (2026-08-31, 다시 파지 말 것) ──
 *
 * 1. `openapi.naver.com/v1/datalab/search` (개발자센터)
 *    살아 있긴 하다. 그러나 **2026-07-31 로 신규 신청이 닫혔다.**
 * 2. `naveropenapi.apigw.ntruss.com/datalab/v1/search` (옛 AI·NAVER API)
 *    실제 키로 부르면 `210 Permission Denied — A subscription to the API is
 *    required`. 콘솔의 AI·NAVER API 에는 Search Trend 항목 자체가 없다.
 * 3. **여기.** 콘솔 `NAVER API HUB > Application` 에서 Data Lab 검색어트렌드를
 *    골라 등록하면 키가 나온다. 그 키로 이 주소가 200 을 준다.
 *
 * 키 없이 두드리면 1·2 가 다 401 이라 **응답으로는 못 가른다.** 가르는 것은
 * "어느 문 열쇠를 받을 수 있나"이고, 지금 받을 수 있는 것은 API HUB 뿐이다.
 *
 * 본문 형식(startDate·endDate·timeUnit·keywordGroups·ages)과 응답 형식
 * (`results[0].data`)은 셋 다 같다. 다른 것은 주소와 인증 헤더뿐이다.
 */
export const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search-trend/v1/search";

/**
 * 인증 헤더. 이름을 틀리면 401 만 돌아오고 이유를 안 알려준다 —
 * 그래서 테스트가 이름을 못 박는다.
 *
 * 이름은 콘솔이 직접 알려 준다. 인증 정보 화면에 `Client ID
 * (X-NCP-APIGW-API-KEY-ID)` · `Client Secret (X-NCP-APIGW-API-KEY)` 라고 적혀 있다.
 */
export function authHeaders(): Record<string, string> {
  return {
    "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID ?? "",
    "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

/**
 * 실제 조회. 키가 없으면 부르지 않는다 — 없는 기능을 광고하지 않는다.
 * 실패는 던진다. 부르는 쪽이 "못 불러왔다"고 화면에 적을 수 있게.
 */
export async function fetchTrend(body: TrendBody): Promise<TrendPoint[]> {
  if (!hasNaverKey()) throw new Error("네이버 API 키가 없습니다");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`데이터랩 응답 ${res.status}`);

  const json = (await res.json()) as {
    results?: { data?: TrendPoint[] }[];
  };
  return json.results?.[0]?.data ?? [];
}
