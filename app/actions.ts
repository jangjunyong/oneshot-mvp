"use server";

// 진단 화면의 쓰기 경로 넷.
//
// 왜 화면 파일 밖에 있나 — 이것들은 렌더와 아무 상관이 없다. `Home` 안에
// 있던 시절에도 스코프 변수를 하나도 캡처하지 않았는데, 그건 **우연이었지
// 가드가 아니었다.** 컴포넌트 안에 두면 요청 파라미터(`params.err`,
// `draftId`, 고른 진단)를 한 줄 끌어다 쓰기가 너무 쉽고, 그러면 폼을 낸
// 시점이 아니라 **화면을 그린 시점**의 값이 클로저에 얼어붙는다. 조용히
// 틀리는 종류라 화면에서는 안 보인다.
//
// 파일을 갈라 두면 그 사고 경로가 타입 수준에서 사라진다 — 여기서는
// 애초에 그 변수들이 보이지 않는다.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { countExtractsToday, deleteEntry, save, saveDraft } from "@/lib/store";
import { extractPlan, hasModelKey } from "@/lib/extract";
import { extractPdfText } from "@/lib/pdf";
import { festivalStartDate, toExtraction } from "@/lib/tourapi";
import { validatePlanInput } from "@/lib/match";
import { DAILY_EXTRACT_LIMIT } from "@/lib/types";

// "use server" 파일의 export 는 전부 async 여야 한다. 이건 내부용이라 안 낸다.
const 오류로 = (message: string, extra = "") =>
  redirect("/?err=" + encodeURIComponent(message) + extra);

/** 1단계 — 기획서 텍스트에서 초안을 뽑는다. 모델을 부르는 유일한 곳이다 */
export async function 추출(formData: FormData) {
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
export async function 선택(formData: FormData) {
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
export async function 저장(formData: FormData) {
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
export async function 지운다(formData: FormData) {
  try {
    await deleteEntry(String(formData.get("entryId") ?? ""));
  } catch {
    오류로("지우지 못했습니다. 잠시 후 다시 눌러 주세요.");
  }
  revalidatePath("/");
}
