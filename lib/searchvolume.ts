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
// 두 가지가 남아 화면에는 안 붙인다.
//   1. **키가 없다.** 네이버 클라우드 플랫폼 콘솔에서 Search Trend 를 신청하는
//      일은 계정 주인만 할 수 있다 (2026-08-30 확인 — 개발자센터가 아니다)
//   2. **검증이 안 됐다.** 검색량 배수가 619건 실측 배수를 설명하는지 아직
//      모른다. 상관도 안 재 보고 숫자를 올리면 불문율 4번을 어긴다
//
// 그래서 이 파일은 순수 변환 + 네트워크까지만이고, 상관은
// `evals/search-volume.mjs` 가 키가 꽂히면 잰다. 붙일지는 그 결과가 정한다.
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
 * 네이버 **개발자센터**의 데이터랩 문.
 *
 * ── 왜 여기인가, 그리고 왜 한 번 옮겼다가 돌아왔나 (2026-08-31) ──
 *
 * 사용자가 "키 발급처는 네이버 클라우드 플랫폼"이라고 해서 NCP 의
 * `naveropenapi.apigw.ntruss.com/datalab/v1/search` 로 옮겼다가 되돌렸다.
 * 콘솔에 직접 들어가 확인한 결과 **그 상품을 신청할 수가 없다**:
 *
 *   - AI·NAVER API > Application 등록에 Search Trend 가 없다 (CLOVA 둘뿐)
 *   - 플랫폼 Classic 은 잠겨 있다 ("선택하신 리전에서는 VPC만 제공하고 있습니다")
 *   - 콘솔 검색에 Search Trend 가 안 잡히고, 상품 소개 페이지는 404 다
 *   - NCP Search Trend 는 2026-07-23 종료됐다
 *
 * 두 문 다 키 없이 두드리면 401 이라 **살아 있는지로는 못 가른다.** 가르는
 * 것은 "어느 문 열쇠를 받을 수 있나"이고, 그건 개발자센터뿐이다.
 */
export const ENDPOINT = "https://openapi.naver.com/v1/datalab/search";

/**
 * 인증 헤더. 이름을 틀리면 401 만 돌아오고 이유를 안 알려준다 —
 * 그래서 테스트가 이름을 못 박는다.
 *
 * NCP 문으로 착각하면 `X-NCP-APIGW-API-KEY-ID` 를 쓰게 되는데, 그러면
 * 개발자센터는 "Not Exist Client ID" 만 돌려주고 왜인지는 말해 주지 않는다.
 */
export function authHeaders(): Record<string, string> {
  return {
    "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID ?? "",
    "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET ?? "",
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
