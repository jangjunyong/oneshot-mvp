// 기획안 넣기 — 첫 화면 (2026-09-12 A2, 사용자 지시 1·3·6·7).
//
// 여기서 하는 일은 하나다: 기획서를 받아 판정(/check)으로 보낸다. PDF 가 주, 붙여넣기는 접힘.
// 옛 진단 이력·지도·5축 폼·"직접 입력하기"는 지웠다 — 닮은 축제는 /check 안에서 선다(twins-block).
// 저장 없음. 모델은 서버 액션(추출)에서 숫자를 옮겨 적는 데만 쓴다.

import Link from "next/link";
import { 추출 } from "@/app/actions";
import { hasModelKey } from "@/lib/extract";
import { DAILY_EXTRACT_LIMIT, MAX_PLAN_TEXT } from "@/lib/types";
import { KT_API } from "@/lib/verdict";
import { FESTIVALS } from "@/lib/festivals";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const 입력오류 = typeof params.err === "string" ? params.err : null;

  return (
    <div className="sheet">
      <header className="topbar">
        <span className="logo">기획안 팩트체크</span>
        <nav>
          <Link href="/" aria-current="page">기획안 넣기</Link>
          <Link href="/check">판정</Link>
          <Link href="/venue">시뮬레이션</Link>
        </nav>
      </header>

      <main>
        <h1 className="display">
          기획안의 숫자,
          <br />
          실측이 판정합니다
        </h1>
        <p className="lede">축제 기획서를 올리면 예상 방문객을 그 축제가 실제로 겪은 배수로 판정합니다.</p>

        {/* 짧음·한도·추출 실패 — 빈손으로 두지 않는다. 판정 화면 폼에 직접 적을 수 있다 */}
        {입력오류 && (
          <p className="alert" data-level="심각" role="alert">
            {입력오류}{" "}
            <Link href="/check?sido=&sigungu=">판정 화면에 직접 적기 →</Link>
          </p>
        )}

        <form action={추출} className="intake">
          {/* PDF 가 주 입력. 지자체 양식이 아니어도 그대로 읽는다 */}
          <label className="dropzone" htmlFor="planPdf">
            <span className="dropzone-title">기획서 PDF 올리기</span>
            <span className="note">지자체 양식 그대로. 10MB 까지, 스캔본 제외</span>
            <input id="planPdf" name="planPdf" type="file" accept="application/pdf" />
          </label>

          <p className="intake-actions">
            <button type="submit">읽어서 판정하기</button>
            <Link className="button-link button-secondary" href="/check">
              견본으로 먼저 보기 → 군포철쭉축제 2027
            </Link>
          </p>

          <p className="note">
            다른 견본 <Link href="/check?demo=hwacheon">화천산천어축제 2027</Link> · 빈 양식이 필요하면{" "}
            <Link href="/form">입력 양식 한 장</Link>(<a href="/기획안_양식.pdf">PDF</a>)
          </p>

          <details className="intake-paste">
            <summary>PDF 대신 텍스트로 붙여넣기</summary>
            <textarea
              id="planText"
              name="planText"
              rows={8}
              maxLength={MAX_PLAN_TEXT}
              placeholder={"예) 제1회 김천김밥축제 추진계획\n○ 개최기간: 2024년 10월 중 3일간\n○ 개최장소: 경상북도 김천시 일원\n○ 예상 방문객: 10만 명"}
            />
          </details>

          <p className="note">
            하루 {DAILY_EXTRACT_LIMIT}건 ·{" "}
            {hasModelKey() ? "문서에서 숫자를 옮겨 적는 데만 모델을 씁니다. 판정에는 쓰지 않습니다" : "키가 없어 고정 샘플로 채웁니다"}
          </p>
        </form>

        {/* 사용자 지시 6 — 관광데이터가 어디에 쓰이는지 세 줄 */}
        <section className="section data-strip" aria-labelledby="data-strip-h">
          <h2 id="data-strip-h">판정이 쓰는 한국관광공사 데이터 셋</h2>
          <ol className="data-strip-list">
            <li>
              <b>KT 일별 방문자</b> <span className="note">TourAPI {KT_API}</span>
              <br />
              판정의 분모. 축제 기간에 그 시군구를 찾은 외지인이 평소의 몇 배였나.
            </li>
            <li>
              <b>축제 검색</b> <span className="note">TourAPI searchFestival2</span>
              <br />
              같은 시기 반경 50km 의 다른 축제. 배수가 우리 축제 몫인지 가리는 귀속 경고.
            </li>
            <li>
              <b>축제 {FESTIVALS.length}건 실측</b> <span className="note">한국관광 데이터랩</span>
              <br />
              같은 인구 규모의 또래 구간과 닮은 과거 축제 3곳. 첫 회 축제의 보조 근거.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
