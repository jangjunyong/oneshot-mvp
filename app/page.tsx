import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countExtractsToday,
  deleteEntry,
  getDraft,
  HISTORY_LIMIT,
  list,
  save,
  saveDraft,
  storageMode,
  type Draft,
  type Entry,
} from "@/lib/store";
import { DEMO_ENTRY, DEMO_ENTRY_ID, DEMO_LABEL } from "@/lib/demo";
import { extractPlan, hasModelKey, modelName } from "@/lib/extract";
import { extractPdfText } from "@/lib/pdf";
import {
  festivalDetail,
  festivalStartDate,
  hasTourKey,
  searchFestivals,
  searchFestivalsInPeriod,
  toExtraction,
  type FestivalDetail,
  type TourFestival,
} from "@/lib/tourapi";
import {
  competitionHeadline,
  competitorsNear,
  dayLabel,
  monthWindow,
  NEARBY_RADIUS_KM,
  type Competitor,
} from "@/lib/overlap";
import { coordsOf, findSimilar, validatePlanInput } from "@/lib/match";
import { LOO_PUBLISHED, WITHIN_BAND, pct } from "@/lib/eval";
import { capacityBand, localBaseline, ratioText } from "@/lib/capacity";
import { scanSeason, type SeasonScan } from "@/lib/season";
import { peerContext, peerSurges } from "@/lib/peer";
import { PeerStrip } from "@/app/peer-strip";
import { TwinMap } from "@/app/twin-map";
import { grade } from "@/lib/grade";
import {
  ACCESSIBILITY_LABEL,
  DAILY_EXTRACT_LIMIT,
  DATA_SOURCE,
  MAX_PLAN_TEXT,
  THEME_NAME,
  type MatchedFestival,
} from "@/lib/types";

// 저장한 것이 바로 보여야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

/**
 * 서버는 UTC 로 돈다. 그대로 찍으면 담당자에게 9시간 틀린 시각이 보이고,
 * 390px 한 줄의 절반을 기계 형식이 잡아먹는다. 시간대를 못 박아 옮긴다.
 */
function 한국시각(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const 오류로 = (message: string, extra = "") =>
  redirect("/?err=" + encodeURIComponent(message) + extra);

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const 입력오류 = params.err;
  const draftId = typeof params.draft === "string" ? params.draft : null;
  const 수동입력 = params.manual === "1";
  const 검색어 = typeof params.q === "string" ? params.q.trim() : "";

  // 지도에 펼 진단과 그 안에서 고른 핀. 선택은 URL 에만 있다 —
  // 클라이언트 상태로 두면 619건 좌표가 번들로 딸려 들어가고,
  // 자바스크립트 없는 e2e 가 이 화면을 더는 검증하지 못한다.
  const 고른id = typeof params.entry === "string" ? params.entry : null;
  const 고른핀 = typeof params.pin === "string" ? params.pin : null;

  /** 1단계 — 기획서 텍스트에서 초안을 뽑는다. 모델을 부르는 유일한 곳이다 */
  async function 추출(formData: FormData) {
    "use server";
    let planText = String(formData.get("planText") ?? "").trim();

    // PDF 가 오면 글자를 뽑아 붙여넣기를 대신한다. 파일이 우선이다 —
    // 올렸다는 건 그걸 읽어 달라는 뜻이다. 스캔본(글자 없는 이미지)은
    // 뽑히는 게 없으므로 지어내지 않고 되돌려보낸다.
    const pdf = formData.get("planPdf");
    if (pdf instanceof File && pdf.size > 0) {
      let pdfText = "";
      try {
        pdfText = await extractPdfText(new Uint8Array(await pdf.arrayBuffer()));
      } catch (e) {
        오류로(e instanceof Error ? e.message : "PDF 를 읽지 못했습니다");
      }
      if (pdfText.length < 20) {
        오류로(
          "PDF 에서 글자를 거의 찾지 못했습니다 — 스캔본이면 텍스트를 직접 붙여넣어 주세요",
        );
      }
      planText = pdfText;
    }

    if (planText.length < 20) {
      오류로("기획서 내용을 붙여넣어 주세요 — 너무 짧습니다");
    }

    // 한도를 셀 수 없으면 통과시키지 않는다. 상한이 상한이 아니게 된다.
    let 오늘호출: number;
    try {
      오늘호출 = await countExtractsToday();
    } catch {
      오늘호출 = DAILY_EXTRACT_LIMIT;
    }
    if (hasModelKey() && 오늘호출 >= DAILY_EXTRACT_LIMIT) {
      오류로(
        `오늘 자동 추출 한도(${DAILY_EXTRACT_LIMIT}건)를 다 썼습니다. 항목을 직접 넣어 주세요`,
        "&manual=1",
      );
    }

    // 추출이 죽어도 앱은 살아 있어야 한다 — 수동 입력으로 떨어뜨린다.
    // 여기서 샘플로 대신 채우면 지어낸 값이 근거인 척한다. 그건 안 한다.
    let id: string;
    try {
      id = await saveDraft(await extractPlan(planText));
    } catch (e) {
      // extractFailureMessage 가 이미 완결된 한 문장을 준다(다음 행동까지
      // 포함). 여기서 덧붙이면 "…직접 넣어 주세요 — 항목을 직접 넣어 주세요"
      // 처럼 겹친다. 알 수 없는 예외일 때만 우리가 문장을 만든다.
      오류로(
        e instanceof Error && e.message
          ? e.message
          : "자동 추출에 실패했습니다. 항목을 직접 넣어 주세요",
        "&manual=1",
      );
      return;
    }
    redirect(`/?draft=${id}`);
  }

  /**
   * 1단계의 다른 입구 — 검색 결과에서 축제 하나를 고르면 TourAPI 등록
   * 정보(주소·개최일)로 초안을 만든다. 모델은 부르지 않으므로 하루 한도
   * 밖이다. 테마·접근성은 등록 정보에 없어 사람이 확인 화면에서 채운다.
   */
  async function 선택(formData: FormData) {
    "use server";
    const contentId = String(formData.get("contentId") ?? "");
    const title = String(formData.get("title") ?? "");
    const addr1 = String(formData.get("addr1") ?? "");
    if (!/^\d+$/.test(contentId)) {
      오류로("선택한 축제를 읽지 못했습니다 — 항목을 직접 넣어 주세요", "&manual=1");
    }

    // 개최일 조회가 죽어도 주소만으로 초안은 만들 수 있다. 죽이지 않는다.
    let eventstartdate = "";
    try {
      eventstartdate = await festivalStartDate(contentId);
    } catch {
      eventstartdate = "";
    }

    let id: string;
    try {
      id = await saveDraft(toExtraction({ title, addr1, eventstartdate }));
    } catch {
      오류로("초안 저장에 실패했습니다 — 항목을 직접 넣어 주세요", "&manual=1");
      return;
    }
    redirect(`/?draft=${id}`);
  }

  /** 2단계 — 사람이 확인·수정한 값을 저장한다. 여기부터는 모델이 끼지 않는다 */
  async function 저장(formData: FormData) {
    "use server";
    const get = (k: string) => String(formData.get(k) ?? "");
    const raw = {
      sido: get("sido"),
      sigungu: get("sigungu"),
      month: get("month"),
      theme: get("theme"),
      population: get("population"),
      accessibility: get("accessibility"),
    };

    // 저장하기 전에 막는다. 브라우저(HTML5 속성)를 우회해 들어와도 여기서 걸린다.
    // 쓰레기 값이 이력에 남으면 나중에 그게 근거인 척한다.
    const problems = validatePlanInput({
      sido: raw.sido,
      sigungu: raw.sigungu,
      month: Number(raw.month),
      themeCode: Number(raw.theme),
      populationManMyeong: Number(raw.population),
      accessibility: Number(raw.accessibility),
    });
    if (problems.length > 0) {
      오류로("입력을 확인해 주세요 — " + problems.join(" · "), "&manual=1");
    }

    // 저장이 실패해도 화면 전체가 죽으면 안 된다. 담당자는 왜 안 됐는지
    // 알아야 하고 다시 누를 수 있어야 한다.
    let 저장실패 = false;
    try {
      await save(raw);
    } catch {
      저장실패 = true;
    }
    if (저장실패) {
      오류로("저장에 실패했습니다. 잠시 후 저장을 다시 눌러 주세요.", "&manual=1");
    }

    revalidatePath("/");
  }

  /** 이력 한 건 지우기 — 데모 중 쌓인 시험 데이터를 치우는 용도 */
  async function 지운다(formData: FormData) {
    "use server";
    try {
      await deleteEntry(String(formData.get("entryId") ?? ""));
    } catch {
      오류로("지우지 못했습니다. 잠시 후 다시 눌러 주세요.");
    }
    revalidatePath("/");
  }

  // 초안을 못 읽어도 입력 화면은 살아 있어야 한다.
  let draft: Draft | null = null;
  if (draftId) {
    try {
      draft = await getDraft(draftId);
    } catch {
      draft = null;
    }
  }
  const 확인단계 = draft !== null || 수동입력;

  // 축제 이름 검색 — TourAPI 가 죽어도 붙여넣기·직접 입력은 살아 있어야 한다.
  let 검색결과: TourFestival[] = [];
  let 검색실패 = false;
  if (검색어 && hasTourKey() && !확인단계) {
    try {
      검색결과 = await searchFestivals(검색어);
    } catch {
      검색실패 = true;
    }
  }

  // 목록을 못 읽어도 입력 화면은 살아 있어야 한다.
  let entries: Entry[] = [];
  let 조회실패 = false;
  try {
    entries = await list();
  } catch {
    조회실패 = true;
  }

  // 이력마다 한 번만 잰다. 지도(한 건)와 요약 행이 같은 결과를 봐야
  // 목록의 등급과 지도의 등급이 갈리지 않는다.
  const 진단한다 = (e: Entry) => {
    const result = findSimilar({
      sido: e.sido,
      sigungu: e.sigungu,
      month: Number(e.month),
      themeCode: Number(e.theme),
      populationManMyeong: Number(e.population),
      accessibility: Number(e.accessibility),
    });
    return { e, result, g: grade(result) };
  };
  const 이력진단 = entries.map(진단한다);

  // 이력이 0건이면 결과 화면이 통째로 빈다. 서버를 새로 띄운 직후가 늘
  // 그렇다(메모리 저장소). 그 자리에 시연용 예시를 편다 — 이력 건수에는
  // 넣지 않는다. 저장된 진단은 여전히 0건이고, 화면이 그렇게 말해야 한다.
  const 시연중 = !조회실패 && entries.length === 0;
  const 진단들 = 시연중 ? [진단한다(DEMO_ENTRY)] : 이력진단;

  // 지도는 페이지에 하나뿐이다 — 이력마다 썸네일을 깔면 어느 것도 못 읽는다.
  // 고른 게 없으면 가장 최근 진단을 편다(list 는 최신순).
  const 고름 = 진단들.find((d) => d.e.id === 고른id) ?? 진단들[0] ?? null;

  // 감당 범위의 기준이 되는 "같은 시군구·같은 달" 실측.
  // 지도 아래 카드와 감당 범위 블록이 **같은 것**을 가리켜야 하니 한 번만 고른다.
  const 기준 =
    고름 && !고름.result.invalid
      ? localBaseline(
          {
            sido: 고름.e.sido,
            sigungu: 고름.e.sigungu,
            month: Number(고름.e.month),
          },
          고름.result.matched,
        )
      : null;

  // 왼쪽 카드의 "감당 범위의 기준" 라벨이 **화면에 없는 블록**을 가리키면
  // 안 된다. capacityBand 는 근거없음·비교불가에서 null 이라 619건 중 482건이
  // 그 경우였다. 라벨과 블록이 같은 값을 보게 한 번만 잰다.
  const 감당범위있음 =
    고름 !== null &&
    !고름.result.invalid &&
    capacityBand(
      고름.g,
      고름.result.matched.map((m) => m.festival.actualVisitSurge),
      기준?.surge ?? null,
    ) !== null;

  // 핀은 고른 진단의 닮은 축제 중에서만 유효하다. 개수는 0~3 이고
  // 3 을 가정하지 않는다 — findSimilar 는 억지로 채우지 않는다.
  const 핀 = 고름?.result.matched.find((m) => m.festival.id === 고른핀) ?? null;
  const 핀번호 = 핀 && 고름 ? 고름.result.matched.indexOf(핀) + 1 : 0;

  // 고른 핀의 등록 정보 — 619건은 "그 축제가 뭐였는지"를 모른다. 담당자가
  // 벤치마킹하려면 언제 어디서 누가 열었는지를 봐야 하고 그건 공사에만 있다.
  // 실패하면 정적 값(이름·연도·배수)만으로 카드가 그대로 선다.
  let 핀상세: FestivalDetail | null = null;
  if (핀 && hasTourKey()) {
    try {
      핀상세 = await festivalDetail(핀.festival.id);
    } catch {
      핀상세 = null;
    }
  }

  // 같은 시기 경쟁 — 619건이 못 하는 질문("올해 그 달에 누가 여는가")이라
  // 공사 OpenAPI 를 실시간으로 부른다. 지도에 편 한 건에 대해서만 부른다.
  // 죽어도 화면은 살아야 하므로 실패는 목록 없음이 아니라 "못 불러왔다"로 남긴다.
  const 기획지역 = 고름 ? coordsOf(고름.e.sido, 고름.e.sigungu) : null;
  let 경쟁: Competitor[] = [];
  let 경쟁조회실패 = false;
  const 경쟁창 = 고름 ? monthWindow(Number(고름.e.month), new Date()) : null;
  if (고름 && 경쟁창 && hasTourKey() && !고름.result.invalid) {
    try {
      경쟁 = competitorsNear(
        기획지역,
        await searchFestivalsInPeriod(경쟁창.start, 경쟁창.end),
      );
    } catch {
      경쟁조회실패 = true;
    }
  }

  return (
    <div className="sheet">
      <header className="topbar">
        <span className="logo">축제 위험 경보</span>
        <nav>
          <Link href="/" aria-current="page">진단</Link>
          <Link href="/venue">행사장 도면</Link>
        </nav>
      </header>

      <main>
        <span className="grid-ref">
          <b>A-01</b> · 지자체 축제 담당자용 · 619개 축제 실측
        </span>
        <h1 className="display">
          이 축제,
          <br />
          작년 그 축제처럼
          <br />
          무너집니다
        </h1>
        <p className="lede">
          기획안을 넣으면 닮은 과거 축제들이 <strong>실제로 어떻게 됐는지</strong>를
          근거로 경보 등급을 냅니다. 방문객 수는 예측하지 않습니다 — 지진
          조기경보처럼, 과거 중 닮은 것을 찾아 등급만 매깁니다.
        </p>

        {/* 처음 온 사람은 "무엇을 넣으면 무엇이 나오는가"를 3초 안에 알아야
            한다. 그게 없으면 아래 입력칸이 그냥 빈 폼으로 보인다.
            PRD 의 쐐기 도식을 그대로 화면에 올린다 */}
        <ol className="flow">
          <li>
            <b>기획안을 넣으면</b>
            <span>지역, 개최 시기, 테마, 지역 인구, 접근성 다섯 가지를 봅니다</span>
          </li>
          <li>
            <b>닮은 축제를 찾아</b>
            <span>619건 중에서 고르고, 그 축제들이 평소의 몇 배를 겪었는지 봅니다</span>
          </li>
          <li>
            <b>등급과 감당 범위를 냅니다</b>
            <span>
              이를테면 &ldquo;심각, 기준 축제가 감당한 수준의 최대 1.4배까지&rdquo;.
              품목별 개수는 내지 않습니다
            </span>
          </li>
        </ol>

        {/* 근거의 무게가 작은 글씨(A-01)에 묻혀 있었다. 쓰기 전에 보여야 한다 */}
        <p className="trust num">
          배수는 KT 이동통신으로 잰 619건입니다(한국관광 데이터랩). 이 619건을
          하나씩 빼고 다시 맞혀 보니 위험한 축제를 무작위의{" "}
          <strong>{LOO_PUBLISHED.lift.toFixed(2)}배</strong>로 집어냈습니다.
          정밀도 {pct(LOO_PUBLISHED.precision)}, 재현율{" "}
          {pct(LOO_PUBLISHED.recall)}. 절반 가까이는 놓칩니다. 경보이지 보증이
          아닙니다. 가중치와 임계값도 이 619건으로 골랐기 때문에 따로 떼어 둔 시험 표본이 없고, 그만큼 후하게 나온 값입니다.
        </p>

        <div className="dim">
          <span>{확인단계 ? "SECTION B — 항목 확인" : "SECTION A — 기획안 입력"}</span>
        </div>

      {/* 무엇이 안 됐는지. 입력이 짧거나, 추출이 죽었거나, 저장이 실패했거나 */}
      {입력오류 && (
        <p className="alert" data-level="심각" role="alert">
          {입력오류}
        </p>
      )}

      {!확인단계 ? (
        <>
          <h2>기획서 붙여넣기</h2>
          <p className="note">
            지자체마다 양식이 달라도 됩니다. 기획안·계획서를 그대로 붙여넣으면
            지역·시기·테마·인구·접근성을 뽑아 <strong>확인 화면</strong>에 채워
            드립니다. 뽑은 값은 고칠 수 있습니다.
          </p>
          <form action={추출}>
            <p>
              {/* required 는 뺐다 — PDF 만 올리고 제출하는 경로가 있다.
                  빈 제출은 서버 액션이 한국어 사유와 함께 되돌려보낸다 */}
              <textarea
                id="planText"
                name="planText"
                rows={10}
                maxLength={MAX_PLAN_TEXT}
                placeholder={"예) 제1회 김천김밥축제 추진계획\n○ 개최기간: 2024년 10월 중 3일간\n○ 개최장소: 경상북도 김천시 일원\n○ 주요내용: 지역 특산물인 김밥을 주제로 한 음식 축제\n○ 교통: KTX 김천구미역에서 차량 20분, 전용 주차장 400면"}
              />
            </p>
            <p>
              <label htmlFor="planPdf">또는 PDF 기획서 올리기</label>{" "}
              <input
                id="planPdf"
                name="planPdf"
                type="file"
                accept="application/pdf"
              />
            </p>
            <p className="note">
              PDF 를 올리면 글자를 뽑아 같은 방식으로 읽습니다 (10MB 까지 ·
              스캔본 제외) · 텍스트는 최대 {MAX_PLAN_TEXT.toLocaleString()}자 ·
              하루 {DAILY_EXTRACT_LIMIT}건까지
              {hasModelKey()
                ? ` · ${modelName()}`
                : " · 키가 없어 고정 샘플로 채웁니다"}
            </p>
            <p>
              <button type="submit">기획서 읽어오기</button>{" "}
              <Link href="/?manual=1">직접 입력하기</Link>
            </p>
          </form>

          {/* 키가 없으면 섹션째 숨긴다. 담당자에게 환경변수 이름을 보여주는 건
              안내가 아니라 소음이다 — 붙여넣기·직접 입력은 그대로 있으니
              없는 기능을 광고하지 않는 쪽이 낫다. */}
          {hasTourKey() && (
            <>
              <h2>또는 등록된 축제에서 찾기</h2>
              <p className="note">
                한국관광공사 TourAPI 에 등록된 축제를 이름으로 찾아 지역·시기를
                채워 드립니다. 테마·접근성은 등록 정보에 없어 직접 고릅니다.
              </p>
              {/* 검색은 상태를 바꾸지 않는다 — GET 으로 URL 에 남겨 새로고침해도 유지된다 */}
              <form action="/" method="get">
                <p>
                  <input
                    name="q"
                    defaultValue={검색어}
                    placeholder="예) 김밥축제"
                    required
                  />{" "}
                  <button type="submit">축제 검색</button>
                </p>
              </form>
              {검색실패 && (
                <p className="alert" data-level="주의" role="alert">
                  축제 검색에 실패했습니다. 잠시 후 다시 하거나{" "}
                  <Link href="/?manual=1">직접 입력</Link>해 주세요
                </p>
              )}
              {검색어 && !검색실패 && 검색결과.length === 0 && (
                <p className="note">
                  “{검색어}” 로 등록된 축제를 찾지 못했습니다 — 이름을 바꿔
                  보거나 <Link href="/?manual=1">직접 입력</Link>해 주세요
                </p>
              )}
              {검색결과.length > 0 && (
                <ul>
                  {검색결과.map((f) => (
                    <li key={f.contentId}>
                      <form action={선택}>
                        <input type="hidden" name="contentId" value={f.contentId} />
                        <input type="hidden" name="title" value={f.title} />
                        <input type="hidden" name="addr1" value={f.addr1} />
                        <button type="submit">{f.title}</button>{" "}
                        <span className="note">{f.addr1 || "주소 없음"}</span>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <h2>뽑은 항목 확인</h2>

          {draft && draft.source === "sample" && (
            <p className="alert" data-level="근거없음">
              모델 키가 없어 <strong>고정 샘플</strong>로 채웠습니다 — 실제
              문서에서 뽑은 값이 아닙니다
            </p>
          )}

          {draft && draft.source === "tourapi" && (
            <p className="note">
              한국관광공사 TourAPI <strong>등록 정보</strong>에서 채웠습니다 —
              기획서가 아니라 공공 등록 데이터가 출처입니다
            </p>
          )}

          {/* 못 찾은 것과 잘못 뽑은 것은 다르다. 무엇이 없는지 짚어 준다 */}
          {draft && draft.missing.length > 0 && (
            <p className="alert" data-level="주의">
              문서에서 찾지 못한 항목이 있습니다 — {draft.missing.join(" · ")}.
              아래에서 직접 채워 주세요
            </p>
          )}

          <form action={저장}>
            <Field
              id="sido"
              label="시도"
              defaultValue={draft?.sido ?? ""}
              evidence={draft?.evidence.sido}
            />
            <Field
              id="sigungu"
              label="시군구"
              defaultValue={draft?.sigungu ?? ""}
              evidence={draft?.evidence.sigungu}
            />

            <Choice
              id="month"
              name="month"
              label="개최 월"
              defaultValue={draft?.month ?? ""}
              options={Array.from(
                { length: 12 },
                (_, i) => [i + 1, `${i + 1}월`] as [number, string],
              )}
              evidence={draft?.evidence.month}
            />
            <Choice
              id="theme"
              name="theme"
              label="테마"
              defaultValue={draft?.themeCode ?? ""}
              options={Object.entries(THEME_NAME).map(
                ([k, v]) => [Number(k), v] as [number, string],
              )}
              evidence={draft?.evidence.themeCode}
            />
            <Choice
              id="accessibility"
              name="accessibility"
              label="접근성"
              defaultValue={draft?.accessibility ?? ""}
              options={Object.entries(ACCESSIBILITY_LABEL).map(
                ([k, v]) => [Number(k), v] as [number, string],
              )}
              evidence={draft?.evidence.accessibility}
            />

            <p>
              <label htmlFor="population">지역 인구(만 명)</label>{" "}
              {/* step 을 0.1 로 두면 14 같은 값이 부동소수점 오차로 stepMismatch 가
                  나서 브라우저가 조용히 제출을 막는다. 실수 입력은 any 가 맞다. */}
              <input
                id="population"
                name="population"
                defaultValue={draft?.populationManMyeong ?? ""}
                type="number"
                min="0.1"
                step="any"
                required
              />
            </p>
            {/* 인구만은 모델이 아니라 데이터에서 온다. 출처가 다르니 그렇게 적는다 */}
            {draft && (
              <p className="evidence">
                {draft.populationManMyeong != null
                  ? `${DATA_SOURCE} 의 같은 시군구 기록에서 가져왔습니다`
                  : "같은 시군구 기록이 없어 비워 뒀습니다 — 직접 넣어 주세요"}
              </p>
            )}

            <p>
              <button type="submit">이 기획안 진단하기</button>{" "}
              <Link href="/">다른 기획서 넣기</Link>
            </p>
          </form>
        </>
      )}

      <div className="dim">
        <span>SECTION C — 진단 이력</span>
      </div>

      <h2>진단 이력 {조회실패 ? "" : `(${entries.length}건)`}</h2>
      {조회실패 && (
        <p role="alert">
          <strong>진단 이력을 불러오지 못했습니다.</strong> 저장은 그대로 남아
          있습니다. <Link href="/">다시 불러오기</Link>
        </p>
      )}
      {!조회실패 && entries.length === 0 && (
        <p>
          아직 진단한 기획안이 없습니다. 위에 기획서를 붙여넣으면 닮은 과거
          축제와 경보 등급이 여기에 쌓입니다. 그때까지는 아래에{" "}
          <strong>{DEMO_LABEL}</strong> 한 건을 펴 둡니다.
        </p>
      )}
      {/* 상한을 숨기면 "저장했는데 사라졌다"가 된다. 화면이 먼저 말한다 */}
      {!조회실패 && entries.length >= HISTORY_LIMIT && (
        <p className="note">
          최근 {HISTORY_LIMIT}건까지만 보입니다 — 더 오래된 진단은 화면에
          나오지 않습니다
        </p>
      )}
      {/* 한 장의 지도 + 그 지도가 말하는 것. 이력 목록은 그 아래 요약만 */}
      {고름 && (
        <section id="twin" className="twin-layout">
          {/* 입력이 잘못된 것과 닮은 축제가 없는 것을 구분한다.
              둘을 같은 문장으로 답하면 "우리 축제는 전례가 없구나"로 읽힌다. */}
          {고름.result.invalid ? (
            <div className="twin-detail">
              <p className="alert" data-level="심각">
                입력을 확인해 주세요
              </p>
              <ul>
                {고름.result.invalid.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {/* 왼쪽 열 — 지도, 지도가 가리키는 넉 장, 또래 분포.
                  오른쪽 본문이 훨씬 길어 지도 밑이 비어 있었다 (2026-08-30
                  사용자 지적). 그 자리에 근거를 옮겨 담는다 */}
              <div className="twin-left">
                <TwinMap
                  matched={고름.result.matched}
                  origin={coordsOf(고름.e.sido, 고름.e.sigungu)}
                  entryId={고름.e.id}
                  selectedPin={핀?.festival.id ?? null}
                  scope={고름.result.searchedScope}
                />
                <TwinCards
                  entryId={고름.e.id}
                  matched={고름.result.matched}
                  baseline={기준}
                  selectedPin={핀?.festival.id ?? null}
                  scope={고름.result.searchedScope}
                  capacityShown={감당범위있음}
                />
                {고름.g.medianSurge !== null &&
                  (() => {
                    const pop = Number(고름.e.population);
                    const peer = peerContext(pop, 고름.g.medianSurge!);
                    return peer ? (
                      <PeerStrip
                        peer={peer}
                        surges={peerSurges(pop)}
                        surge={고름.g.medianSurge!}
                      />
                    ) : null;
                  })()}
              </div>

              <div className="twin-detail">
                {/* 지어낸 데이터로 보이면 안 된다. 무엇이 예시이고 그 값이
                    어디서 왔는지를 결과보다 먼저 적는다 (불문율 4번) */}
                {고름.e.id === DEMO_ENTRY_ID && (
                  <p className="alert" data-level="근거없음">
                    {DEMO_LABEL}입니다. 저장된 진단이 없어 고령 대가야축제
                    조건을 대신 펴 뒀습니다. 지역·시기·테마·인구·접근성은 619건에
                    등록된 값 그대로입니다. 그래서 <strong>닮은 축제 1번은 이
                    조건의 출처가 된 축제 자신</strong>입니다(닮음 거리 0.00).
                    실제 기획안에서는 이런 일이 없습니다.
                  </p>
                )}
                <p className="num">
                  {고름.e.sido} {고름.e.sigungu} · {고름.e.month}월 ·{" "}
                  {THEME_NAME[Number(고름.e.theme)] ?? 고름.e.theme} · 인구{" "}
                  {고름.e.population}만 · 접근성{" "}
                  {ACCESSIBILITY_LABEL[Number(고름.e.accessibility)] ??
                    고름.e.accessibility}{" "}
                  · {한국시각(고름.e.savedAt)}
                </p>

                {/* 결론이 먼저 */}
                <p className="alert" data-level={고름.g.level}>
                  {고름.g.level === "심각" || 고름.g.level === "주의"
                    ? `⚠ 경보: ${고름.g.level}`
                    : 고름.g.level === "근거없음"
                      ? "위험 근거 못 찾음"
                      : "비교 대상 없음"}
                </p>
                <p className="headline">{고름.g.headline}</p>

                {/* "평소 대비 2.7배"가 무슨 뜻인지 화면 어디에도 없었다.
                    분모가 무엇인지 모르면 그 숫자는 못 쓴다.
                    그리고 그 분모 때문에 인구가 적을수록 배수가 커진다
                    (log(인구) vs 배수 r = -0.486). 숨기지 않고 또래 맥락을 준다 */}
                {고름.g.medianSurge !== null &&
                  (() => {
                    const 또래 = peerContext(
                      Number(고름.e.population),
                      고름.g.medianSurge!,
                    );
                    return (
                      <p className="basis num">
                        여기서 배수란 축제 기간에 그 시군구를 찾은 외지인이
                        평상시의 몇 배였나입니다. 방문객 총수가 아닙니다.
                        {또래 && (
                          <>
                            {" "}평상시가 기준이라 인구가 적은 곳일수록 배수가
                            크게 나옵니다. 인구 {또래.label} 지역의 축제{" "}
                            {또래.n}곳에 넣고 보면 이 기획안은{" "}
                            <strong>상위 {또래.topPercent}%</strong>입니다.
                            그 {또래.n}곳의 중앙값은 {또래.median.toFixed(2)}배였습니다.
                          </>
                        )}
                      </p>
                    );
                  })()}

                {/* 감당 범위 — PRD 가 적어 둔 목적지("왜 물량을 3배로
                    잡았습니까"). 물량 개수는 내지 않는다: 배수의 분모는
                    평상시 지역이지 작년 그 축제가 아니라, 곱하면 근거 1과
                    같은 화면에서 충돌한다 (docs/DECISIONS.md) */}
                {(() => {
                  const 범위 = capacityBand(
                    고름.g,
                    고름.result.matched.map((m) => m.festival.actualVisitSurge),
                    기준?.surge ?? null,
                  );
                  if (!범위) return null;
                  return (
                    <div className="capacity">
                      <h3>감당 범위</h3>
                      {범위.baseSurge !== null && 기준 ? (
                        <>
                          <p className="capacity-head num">
                            {기준.year}년 물량이 감당한 수준의{" "}
                            <strong>최대 {ratioText(범위.hi!)}</strong>까지 보십시오
                          </p>
                          <p className="note num">
                            기준으로 삼은 것은 {기준.name}({기준.year}년)의{" "}
                            {기준.surge.toFixed(2)}배입니다. 닮은 축제{" "}
                            {고름.result.matched.length}곳은{" "}
                            {범위.twinLo.toFixed(2)}~{범위.twinHi.toFixed(2)}배였습니다.
                          </p>
                          {/* 하한은 잰 값이 아니다. 기준을 닮은 축제 셋 안에서
                              고르므로 twinLo <= baseSurge 이고, 하한은 언제나
                              1.00 이 된다(619건 중 기준이 있는 136건 전수 확인).
                              1.00 을 구간의 한쪽 끝으로 내놓으면 담당자가 그걸
                              측정값으로 읽는다 */}
                          <p className="note num">
                            하한은 <strong>언제나 1배</strong>입니다. 기준으로 삼는
                            축제를 닮은 축제 안에서 고르기 때문에 계산상 그렇게
                            됩니다. 잰 값이 아닙니다. 작년보다 줄이라는 말은 실측이
                            뒷받침하지 않습니다.
                          </p>
                          <p className="note">
                            같은 시군구에서 같은 달에 열린 축제를 기준으로 잡았습니다.
                            이 축제가 아니라면 기준이 아닙니다. 품목별 개수는 내지
                            않습니다. 그해 대장의 수량에 이 배수를 곱하는 것은
                            담당자가 할 일입니다.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="capacity-head num">
                            닮은 축제 3곳은 평소의{" "}
                            <strong>
                              {범위.twinLo.toFixed(2)}~{범위.twinHi.toFixed(2)}배
                            </strong>
                            였습니다
                          </p>
                          <p className="note">
                            같은 시군구에서 같은 달에 열린 축제가 619건에 없어
                            작년 대비 몇 배인지는 내지 못했습니다. 없는 것이
                            아니라 비교 기준을 못 찾은 것입니다.
                          </p>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* 핀을 눌렀을 때만 그 한 곳을 깊게 편다. 닮은 곳 전부를 얕게
                    보여 주던 목록은 지도 아래 카드로 옮겼다 — 같은 것을 두 열에
                    쓰면 오른쪽만 길어지고 왼쪽 아래는 계속 빈다 */}
                {핀 ? (
                  <div className="pin-card">
                    <p className="num">
                      <strong>{핀번호}</strong> {핀.festival.name}
                    </p>
                    <p>
                      {핀.festival.sido} {핀.festival.sigungu} · {핀.year}년 ·
                      평소 대비{" "}
                      <strong>{핀.festival.actualVisitSurge.toFixed(2)}배</strong>
                    </p>
                    <ul>
                      {핀.axes.map((a) => (
                        <li key={a.axis}>
                          {a.label} — {a.detail}
                        </li>
                      ))}
                    </ul>

                    {/* 배수·좌표는 우리가 쟀고, 여기부터는 공사가 등록해 둔
                        사실이다. 못 받으면 이 줄들이 통째로 없을 뿐 카드는 선다 */}
                    {핀상세 && (
                      <dl className="pin-detail">
                        {핀상세.startDate && (
                          <>
                            <dt>개최</dt>
                            <dd>
                              {dayLabel(핀상세.startDate)}
                              {핀상세.endDate && `~${dayLabel(핀상세.endDate)}`}
                            </dd>
                          </>
                        )}
                        {핀상세.place && (
                          <>
                            <dt>장소</dt>
                            <dd>{핀상세.place}</dd>
                          </>
                        )}
                        {핀상세.sponsor && (
                          <>
                            <dt>주최</dt>
                            <dd>{핀상세.sponsor}</dd>
                          </>
                        )}
                        {핀상세.fee && (
                          <>
                            <dt>요금</dt>
                            <dd>{핀상세.fee}</dd>
                          </>
                        )}
                        {핀상세.homepage && (
                          <>
                            <dt>홈페이지</dt>
                            <dd>
                              <a
                                href={핀상세.homepage}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {핀상세.homepage.replace(/^https?:\/\//, "")}
                              </a>
                            </dd>
                          </>
                        )}
                      </dl>
                    )}

                    <p>
                      <Link href={`/?entry=${고름.e.id}#twin`}>핀 선택 해제</Link>
                    </p>
                  </div>
                ) : null}

                {/* 결론(누가 몇 배)은 위에 펼쳐져 있다. 접는 건 "왜"뿐이다 */}
                {고름.result.matched.length > 0 && (
                  <details>
                    <summary>왜 닮았나</summary>
                    <ul>
                      {고름.result.matched.map((m) => (
                        <li key={m.festival.id}>
                          {m.festival.name}
                          <ul>
                            {m.axes.map((a) => (
                              <li key={a.axis}>
                                {a.label} — {a.detail}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* 같은 시기 경쟁 — 화면에서 유일하게 **실시간** 공사 OpenAPI 로
                    오는 값이다. 619건은 과거만 알고, 올해 그 달에 누가 여는지는
                    여기서만 온다. 키가 없으면 섹션째 숨긴다(없는 기능은 광고 안 함) */}
                {hasTourKey() && 경쟁창 && (
                  <div className="rivals">
                    <h3>같은 시기 경쟁</h3>
                    {경쟁조회실패 ? (
                      <p className="note">
                        같은 시기 축제를 불러오지 못했습니다 — 잠시 후 새로고침해
                        주세요
                      </p>
                    ) : 기획지역 === null ? (
                      <p className="note">
                        {고름.e.sido} {고름.e.sigungu} 의 좌표를 찾지 못해 거리를
                        재지 못했습니다 — 없는 것이 아니라 못 잰 것입니다
                      </p>
                    ) : (
                      <>
                        <p className="rivals-head">
                          {competitionHeadline(
                            경쟁창.year,
                            Number(고름.e.month),
                            경쟁,
                          )}
                        </p>
                        {경쟁.length > 0 && (
                          <ol className="legend">
                            {경쟁.slice(0, 5).map((c) => (
                              <li key={c.contentId} className="num">
                                {c.title} · {dayLabel(c.startDate)}~
                                {dayLabel(c.endDate)} ·{" "}
                                {c.distanceKm.toFixed(0)}km
                                {c.surge !== null && (
                                  <span className="rival-surge">
                                    평소 {c.surge.toFixed(2)}배
                                  </span>
                                )}
                              </li>
                            ))}
                            {경쟁.length > 5 && (
                              <li className="note">외 {경쟁.length - 5}곳</li>
                            )}
                          </ol>
                        )}
                        <p className="note">
                          한국관광공사 OpenAPI 실시간 조회 · 반경{" "}
                          {NEARBY_RADIUS_KM}km · 축제는 대체로 매년 같은 시기에
                          열리므로 <strong>가장 최근 {Number(고름.e.month)}월
                          실적</strong>으로 봅니다(예측이 아닙니다) · 배수는 619건에
                          실측이 있는 축제에만 붙습니다
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* 시기 민감도. 이름을 조심해서 붙였다 — "N월에 열면"이 아니라
                    "N월로 물으면 어떤 쌍둥이가 뽑히나"다. 요청월과 쌍둥이
                    실제 개최월이 19%만 일치하기 때문이다(lib/season.ts 머리말) */}
                {!고름.result.invalid && <SeasonTable scan={scanSeason({
                  sido: 고름.e.sido,
                  sigungu: 고름.e.sigungu,
                  month: Number(고름.e.month),
                  themeCode: Number(고름.e.theme),
                  populationManMyeong: Number(고름.e.population),
                  accessibility: Number(고름.e.accessibility),
                })} />}

                {/* 결재에서 반드시 받는 질문 — "그게 맞는 건 어떻게 압니까".
                    619건 leave-one-out 자기검증을 숫자로 낸다. 한계(재현율)도
                    같이 낸다 — 맞은 것만 세면 그것도 지어낸 것이다.
                    키·네트워크와 무관한 정적 값이라 게이트 밖에 둔다 */}
                {!고름.result.invalid && (
                  <details className="selfcheck">
                    <summary>이 방식은 얼마나 맞는가 — 619건 자기검증</summary>
                    <p className="num">
                      619건을 하나씩 빼고 그 축제를 다시 맞혀 봤습니다. 위험한
                      축제를 무작위의{" "}
                      <strong>{LOO_PUBLISHED.lift.toFixed(2)}배</strong>로
                      집어냈습니다. 정밀도 {pct(LOO_PUBLISHED.precision)}, 재현율{" "}
                      {pct(LOO_PUBLISHED.recall)}, 실제 위험군 비율{" "}
                      {pct(LOO_PUBLISHED.baseRate)}.
                    </p>
                    <p className="num">
                      맞힌 배수와 실제 배수의 차이는 중앙값{" "}
                      {LOO_PUBLISHED.medianAbsErr.toFixed(2)}배,{" "}
                      {pct(LOO_PUBLISHED.withinRatio)}가 ±{WITHIN_BAND}배 안에
                      들었습니다.
                    </p>
                    <p className="note">
                      맞힐 때 그 축제 자신은 뺐습니다. 안 그러면 정답을 보고 답을
                      쓰는 셈입니다. 재현율이 {pct(LOO_PUBLISHED.recall)}이니
                      절반 가까이는 놓칩니다. 경보이지 보증이 아닙니다.{" "}
                      가중치와 임계값도 이 619건으로 골랐기 때문에 따로 떼어 둔 시험 표본이 없고, 그만큼 후하게 나온 값입니다.
                    </p>
                  </details>
                )}

                <p className="note">출처: {DATA_SOURCE}</p>
                <p>
                  {/* 경보를 받았다 — 그래서 어떻게 대비하나. 도면(M1)으로 잇는다 */}
                  <Link href={`/venue?entry=${고름.e.id}`}>
                    이 쏠림에 대비하기 — 행사장 도면 →
                  </Link>
                  {" · "}
                  {/* 근거는 화면에만 있으면 결재에 못 올라간다 */}
                  <Link href={`/report?entry=${고름.e.id}`}>진단서 한 장 →</Link>
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* 목록은 저장된 이력만이다 — 시연용 예시는 위 지도에만 편다.
          여기 끼우면 "0건"이라고 말해 놓고 한 줄이 서서 화면이 거짓말한다 */}
      <ul>
        {이력진단.map(({ e, result, g }) => {
          const 대표 = result.matched[0];
          const 펴진것 = 고름?.e.id === e.id;

          return (
            <li key={e.id} className="entry" data-current={펴진것 ? "1" : undefined}>
              <p className="num">
                {e.sido} {e.sigungu} · {e.month}월 ·{" "}
                {THEME_NAME[Number(e.theme)] ?? e.theme} · 인구 {e.population}만
                · 접근성{" "}
                {ACCESSIBILITY_LABEL[Number(e.accessibility)] ?? e.accessibility}{" "}
                · {한국시각(e.savedAt)}
              </p>

              {/* 요약 행에도 근거 한 조각을 남긴다. 등급만 남기면 담당자는
                  무엇을 보고 매긴 등급인지 모른 채 목록을 훑게 된다 */}
              <p className="verdict">
                <span className="chip" data-level={g.level}>
                  {g.level === "심각" || g.level === "주의"
                    ? `경보 ${g.level}`
                    : g.level === "근거없음"
                      ? "근거 못 찾음"
                      : "비교 대상 없음"}
                </span>{" "}
                {result.invalid
                  ? "입력을 확인해 주세요"
                  : 대표
                    ? `${대표.festival.name}처럼 — 평소 대비 ${대표.festival.actualVisitSurge.toFixed(2)}배`
                    : `찾아본 범위: ${result.searchedScope}`}
              </p>

              <p>
                {펴진것 ? (
                  <span className="note">지금 지도에 펼친 진단</span>
                ) : (
                  <Link href={`/?entry=${e.id}#twin`}>지도에서 보기</Link>
                )}{" "}
                · <Link href={`/venue?entry=${e.id}`}>행사장 도면 →</Link>
              </p>

              {/* 시연 중 쌓인 시험 데이터를 그 자리에서 치운다. 확인창은 안 띄운다
                  — 진단은 다시 넣으면 그만이고, 모달은 폰 데모를 끊는다 */}
              <form action={지운다}>
                <input type="hidden" name="entryId" value={e.id} />
                <button type="submit" className="note">
                  이 진단 지우기
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      </main>

      {/* 표제란 — 도면 시트의 title block. 이 서비스가 무엇을 근거로 삼는지 */}
      <footer className="titleblock">
        <div>
          <dt>Project</dt>
          <dd>축제 위험 경보</dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd className="num">전국 619개 축제 실측</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{DATA_SOURCE}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{storageMode()}</dd>
        </div>
      </footer>
    </div>
  );
}

/**
 * 지도 아래 넉 장 — 감당 범위의 **기준** 하나와 **닮은 축제** 셋.
 *
 * 왜 여기 있나. 오른쪽 본문이 왼쪽 지도보다 훨씬 길어 지도 아래가 늘 비어
 * 있었다(2026-08-30 사용자 지적). 닮은 축제 목록은 원래 오른쪽에 한 줄씩
 * 있었는데, 그건 지도의 핀 1·2·3 을 설명하는 것이라 지도 옆에 있는 편이 맞다.
 *
 * 기준 카드는 겹칠 수 있다. `localBaseline` 은 **닮은 축제 셋 중에서** 같은
 * 시군구·같은 달인 것을 고르므로, 기준이 있으면 그것은 반드시 셋 중 하나다.
 * 숨기지 않고 "닮은 축제 ①이기도 합니다"라고 카드에 적는다 — 감당 범위가
 * 무엇에 대고 잰 값인지는 닮음과 다른 질문이라 칸을 따로 둘 값어치가 있다.
 */
function TwinCards({
  entryId,
  matched,
  baseline,
  selectedPin,
  scope,
  capacityShown,
}: {
  entryId: string;
  matched: MatchedFestival[];
  baseline: { id: string; name: string; year: string; surge: number } | null;
  selectedPin: string | null;
  scope: string;
  /** 오른쪽에 감당 범위 블록이 실제로 서는가. 근거없음 등급이면 안 선다 */
  capacityShown: boolean;
}) {
  if (matched.length === 0) return null;

  const 배수폭 = matched.map((m) => m.festival.actualVisitSurge);

  return (
    <div className="twin-cards">
      {matched.map((m, i) => {
        const 기준인가 = baseline?.id === m.festival.id;
        return (
          <Link
            key={m.festival.id}
            className="twin-card"
            data-role={기준인가 ? "base" : undefined}
            data-current={m.festival.id === selectedPin ? "1" : undefined}
            href={`/?entry=${entryId}&pin=${m.festival.id}#twin`}
          >
            <p className="twin-card-label">
              <strong>{i + 1}</strong> 닮은 축제
            </p>
            <p className="twin-card-name">{m.festival.name}</p>
            <p className="twin-card-meta num">
              {m.festival.sido} {m.festival.sigungu} · {m.year}년
            </p>
            <p className="twin-card-surge num">
              평소 대비 <strong>{m.festival.actualVisitSurge.toFixed(2)}배</strong>
            </p>
            {/* 기준은 언제나 이 셋 중 하나다. 칸을 따로 세우면 같은 축제가 두 번
                나오므로 그 카드에 표를 얹는다 (2026-08-30 사용자 지시) */}
            {기준인가 && (
              <p className="twin-card-base">
                같은 시군구, 같은 달
                {capacityShown ? " · 감당 범위의 기준" : ""}
              </p>
            )}
            <p className="twin-card-foot">
              {m.festival.id === selectedPin ? "지금 펼친 축제" : "눌러서 근거 보기"}
            </p>
          </Link>
        );
      })}

      {/* 넷째 칸 — 셋을 다 채우고 남는 자리.
          기준을 못 찾았으면 그 사실이 급하다(오른쪽 감당 범위의 숫자가 어디서
          왔는지 담당자가 알아야 한다). 찾았으면 그 자리는 카드에 얹혔으니,
          화면 어디에도 없던 값을 낸다 — 이 셋이 얼마나 닮았는가. */}
      <div className="twin-card" data-role="how">
        {baseline === null && capacityShown ? (
          <>
            <p className="twin-card-label">감당 범위의 기준</p>
            <p className="twin-card-name">못 찾았습니다</p>
            <p className="twin-card-meta">
              같은 시군구·같은 달의 축제가 619건에 없습니다
            </p>
            <p className="twin-card-surge num">
              대신 닮은 축제 {matched.length}곳의{" "}
              <strong>
                {Math.min(...배수폭).toFixed(2)}~{Math.max(...배수폭).toFixed(2)}배
              </strong>
            </p>
            <p className="twin-card-foot">없는 것이 아니라 못 찾은 것입니다</p>
          </>
        ) : (
          <>
            <p className="twin-card-label">어떻게 골랐나</p>
            <p className="twin-card-name">{scope}에서 {matched.length}곳</p>
            <p className="twin-card-meta">
              지역·인구·접근성·시기·테마 다섯 축으로 쟀습니다
            </p>
            {/* 닮음 거리(0.09 같은 값)를 여기 내던 것을 걷어냈다.
                담당자가 그 숫자로 할 수 있는 일이 없다 — 결재에서
                "닮음 거리가 0.09였습니다"라고 답할 수 없고, 척도가 없으면
                0.11 이 0.27 의 절반이라는 것도 뜻을 못 만든다.
                불문율 3 이 금지한 "유사도 점수만 던지기"가 바로 이것이고,
                왜 닮았는지는 아래 details 와 핀 카드가 축별로 낸다 */}
            <p className="twin-card-foot">
              다섯 축이 충분히 가깝지 않으면 쓰지 않습니다. 억지로 가장 가까운
              것을 내놓지 않습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 시기 민감도 표.
 *
 * 제목이 "N월에 열면"이 아닌 이유가 이 컴포넌트의 전부다 — 요청월과 쌍둥이
 * 실제 개최월은 19%만 일치한다. 그래서 각 행에 **쌍둥이가 실제로 열린 달**을
 * 찍어 표가 스스로 한계를 말하게 한다 (lib/season.ts 머리말).
 */
function SeasonTable({ scan }: { scan: SeasonScan }) {
  if (scan.months.length === 0) return null;

  return (
    <div className="season">
      <h3>달을 바꾸면 어떤 쌍둥이가 뽑히나</h3>

      {/* 어느 달에도 쌍둥이가 없으면 견줄 것이 없다. 최저·최고를 고르는
          문장은 잰 것이 있을 때만 쓴다 (lib/season.ts 의 고른달) */}
      {/* 몇 달을 잴 수 있었는지를 먼저 말한다. 이걸 안 밝히면 1달만 잰
          조건에서도 "달을 바꿔도 그게 그거"로 읽힌다 */}
      {scan.measured > 0 && scan.measured < scan.months.length && (
        <p className="season-head num">
          12달 중 <strong>{scan.measured}달</strong>만 닮은 축제를 찾을 수
          있었습니다. 나머지 {scan.months.length - scan.measured}달은 평평한 것이
          아니라 재지 못한 것입니다.
        </p>
      )}
      {scan.quietest.length === 0 ? (
        <p className="season-head">
          달을 12번 바꿔 물어도 닮은 축제를 찾지 못했습니다. 시기를 견줄 근거가
          없습니다.
        </p>
      ) : scan.flat ? (
        <p className="season-head num">
          달을 바꿔도 쌍둥이 배수 폭이{" "}
          <strong>
            {Math.min(
              ...scan.months.map((m) => m.medianSurge ?? Infinity),
            ).toFixed(2)}
            ~
            {Math.max(...scan.months.map((m) => m.medianSurge ?? 0)).toFixed(2)}배
          </strong>{" "}
          안에 머뭅니다 — 이 조건에서 시기는 갈리지 않습니다
        </p>
      ) : (
        <p className="season-head num">
          가장 낮았던 달은 <strong>{scan.quietest.join("·")}월</strong>, 가장
          높았던 달은 <strong>{scan.busiest.join("·")}월</strong>입니다 (폭{" "}
          {scan.spread?.toFixed(2)}배)
        </p>
      )}

      {/* 12행이라 펼쳐 두면 화면이 이 표만으로 한 화면을 먹는다. 요약 한 줄은
          위에 남기고 표는 접는다 — 볼 사람만 편다 */}
      <details>
        <summary>달마다 뽑힌 쌍둥이 12줄 보기</summary>
      <table className="season-table">
        <thead>
          <tr>
            <th>물은 달</th>
            <th>쌍둥이</th>
            <th>배수</th>
            <th>중앙</th>
            <th>등급</th>
            <th>쌍둥이가 실제로 열린 달</th>
          </tr>
        </thead>
        <tbody>
          {scan.months.map((m) => (
            <tr key={m.month} data-plan={m.month === scan.planMonth || undefined}>
              <th scope="row" className="num">
                {m.month}월
              </th>
              <td className="num">{m.matched}곳</td>
              <td className="num">
                {m.loSurge === null
                  ? "—"
                  : `${m.loSurge.toFixed(2)}~${m.hiSurge!.toFixed(2)}`}
              </td>
              <td className="num">{m.medianSurge?.toFixed(2) ?? "—"}</td>
              <td>{m.level}</td>
              <td className="num season-twinmonths">
                {m.twinMonths.length === 0
                  ? "—"
                  : m.twinMonths
                      .map((tm) => (tm === m.month ? `${tm}월✓` : `${tm}월`))
                      .join(" ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </details>

      {/* 뽑힌 쌍둥이가 하나도 없으면 "매칭이 시기에 흔들린다"는 주의는
          주의할 대상이 없다. 표가 전부 빈칸인 것으로 이미 다 말했다 */}
      {scan.quietest.length > 0 && (
      <p className="note">
        읽을 때 조심할 것이 있습니다. 이 표가 재는 것은 시기의 효과가 아니라
        매칭이 시기에 얼마나 흔들리는가입니다. 닮음을 재는 다섯 축에서 개최
        시기가 차지하는 비중은 10%뿐이라, 달을 바꿔도 같은 지역 축제 몇 곳이
        순위만 바꿔 다시 섭니다. 물은 달에 실제로 열린 쌍둥이는{" "}
        <strong>{Math.round((scan.monthMatchRate ?? 0) * 100)}%</strong>(
        <span className="season-twinmonths">✓</span> 표시)뿐이고 나머지는 다른 달
        축제입니다. 그러니 &ldquo;그 달로 옮기면 이렇게 된다&rdquo;로 읽으면 안
        됩니다.
        {!scan.robust && (
          <>
            {" "}표본 수에도 흔들립니다. 쌍둥이를 3곳이 아니라 5곳이나 7곳으로
            잡으면 일부 달의 등급이 바뀝니다. 3곳짜리 중앙값이라 한 건만 교체돼도
            컷을 넘습니다.
          </>
        )}
      </p>
      )}
    </div>
  );
}

/** 값 한 칸 + 그 값이 어디서 나왔는지. 근거 없이 값만 두면 못 믿는다 */
function Field({
  id,
  label,
  defaultValue,
  evidence,
}: {
  id: string;
  label: string;
  defaultValue: string;
  evidence?: string;
}) {
  return (
    <>
      <p>
        <label htmlFor={id}>{label}</label>{" "}
        <input id={id} name={id} defaultValue={defaultValue} required />
      </p>
      {evidence && <p className="evidence">“{evidence}”</p>}
    </>
  );
}

/**
 * 고르는 칸. 담당자는 "테마 코드 3" 이나 "접근성 2등급" 을 모른다.
 * 숫자는 안쪽에만 남기고 화면에는 이름만 낸다.
 */
function Choice({
  id,
  name,
  label,
  defaultValue,
  options,
  evidence,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number | string;
  options: [number, string][];
  evidence?: string;
}) {
  return (
    <>
      <p>
        <label htmlFor={id}>{label}</label>{" "}
        <select id={id} name={name} defaultValue={String(defaultValue)} required>
          <option value="" disabled>
            고르세요
          </option>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </p>
      {evidence && <p className="evidence">“{evidence}”</p>}
    </>
  );
}
