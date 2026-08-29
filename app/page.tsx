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
import { extractPlan, hasModelKey, modelName } from "@/lib/extract";
import { extractPdfText } from "@/lib/pdf";
import {
  festivalStartDate,
  hasTourKey,
  searchFestivals,
  toExtraction,
  type TourFestival,
} from "@/lib/tourapi";
import { coordsOf, findSimilar, validatePlanInput } from "@/lib/match";
import { TwinMap } from "@/app/twin-map";
import { grade } from "@/lib/grade";
import {
  ACCESSIBILITY_LABEL,
  DAILY_EXTRACT_LIMIT,
  DATA_SOURCE,
  MAX_PLAN_TEXT,
  THEME_NAME,
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
      const 사유 = e instanceof Error ? e.message : "추출에 실패했습니다";
      오류로(`${사유} — 항목을 직접 넣어 주세요`, "&manual=1");
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
  const 진단들 = entries.map((e) => {
    const result = findSimilar({
      sido: e.sido,
      sigungu: e.sigungu,
      month: Number(e.month),
      themeCode: Number(e.theme),
      populationManMyeong: Number(e.population),
      accessibility: Number(e.accessibility),
    });
    return { e, result, g: grade(result) };
  });

  // 지도는 페이지에 하나뿐이다 — 이력마다 썸네일을 깔면 어느 것도 못 읽는다.
  // 고른 게 없으면 가장 최근 진단을 편다(list 는 최신순).
  const 고름 = 진단들.find((d) => d.e.id === 고른id) ?? 진단들[0] ?? null;

  // 핀은 고른 진단의 닮은 축제 중에서만 유효하다. 개수는 0~3 이고
  // 3 을 가정하지 않는다 — findSimilar 는 억지로 채우지 않는다.
  const 핀 = 고름?.result.matched.find((m) => m.festival.id === 고른핀) ?? null;
  const 핀번호 = 핀 && 고름 ? 고름.result.matched.indexOf(핀) + 1 : 0;

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
          축제와 경보 등급이 여기에 쌓입니다.
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
              <TwinMap
                matched={고름.result.matched}
                origin={coordsOf(고름.e.sido, 고름.e.sigungu)}
                entryId={고름.e.id}
                selectedPin={핀?.festival.id ?? null}
                scope={고름.result.searchedScope}
              />

              <div className="twin-detail">
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

                {/* 핀을 눌렀으면 그 한 곳을 깊게, 아니면 닮은 곳 전부를 얕게.
                    번호는 지도의 핀 번호와 같은 것이어야 짝이 읽힌다 */}
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
                    <p>
                      <Link href={`/?entry=${고름.e.id}#twin`}>핀 선택 해제</Link>
                    </p>
                  </div>
                ) : (
                  고름.result.matched.length > 0 && (
                    <ol className="legend">
                      {고름.result.matched.map((m, i) => (
                        <li key={m.festival.id} className="num">
                          <Link
                            href={`/?entry=${고름.e.id}&pin=${m.festival.id}#twin`}
                          >
                            <strong>{i + 1}</strong> {m.festival.name} (
                            {m.festival.sido} {m.festival.sigungu}) · {m.year}년
                            · 평소 대비 {m.festival.actualVisitSurge.toFixed(2)}
                            배
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )
                )}

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

                <p className="note">출처: {DATA_SOURCE}</p>
                <p>
                  {/* 경보를 받았다 — 그래서 어떻게 대비하나. 도면(M1)으로 잇는다 */}
                  <Link href={`/venue?entry=${고름.e.id}`}>
                    이 쏠림에 대비하기 — 행사장 도면 →
                  </Link>
                </p>
              </div>
            </>
          )}
        </section>
      )}

      <ul>
        {진단들.map(({ e, result, g }) => {
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
