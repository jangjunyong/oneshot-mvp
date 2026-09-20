// 기획안 넣기 — 첫 화면 (2026-09-12 A2, 사용자 지시 1·3·7).
//
// 여기서 하는 일은 하나다: 기획서를 받아 판정(/check)으로 보낸다. PDF 가 주, 붙여넣기는 접힘.
//
// 2026-09-21 사용자 지시로 09-12·09-13 의 "첫 화면엔 입력만" 을 뒤집었다 — 공고문이 1차 심사를
// "서면 및 기능심사"로 규정하고 심사위원이 서비스를 직접 여는데, 올릴 기획서가 없는 사람에게는
// 이 화면이 막다른 길이었다. 아래 한 줄이 그 길을 연다. 완성된 판정 주소는 모델·DB·인증키를
// 하나도 타지 않으므로, 잔액이 떨어지거나 키가 만료돼도 그 화면은 선다.
// 저장 없음. 모델은 서버 액션(추출)에서 숫자를 옮겨 적는 데만 쓴다.

import Link from "next/link";
import { 추출 } from "@/app/actions";
import { MAX_PLAN_TEXT } from "@/lib/types";
import { SubmitButton } from "@/app/_components/submit-button";
import { checkQueryString, DEMOS } from "@/lib/checkquery";

export const dynamic = "force-dynamic";

/** 업로드·모델·DB 없이 열리는 완성 판정 화면 — 심사위원이 URL 만 들고 왔을 때의 길 */
const DEMO_CHECK = `/check${checkQueryString(DEMOS.gunpo.query)}`;

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
          <label className="dropzone" htmlFor="planPdf">
            <span className="dropzone-title">기획서 PDF 올리기</span>
            <input id="planPdf" name="planPdf" type="file" accept="application/pdf" />
          </label>

          <p className="intake-actions">
            <SubmitButton pendingText="읽는 중…">읽어서 판정하기</SubmitButton>
          </p>

          <details className="intake-paste">
            <summary>PDF 대신 텍스트로 붙여넣기</summary>
            <textarea id="planText" name="planText" rows={8} maxLength={MAX_PLAN_TEXT} />
          </details>
        </form>

        <p className="intake-ways">
          올릴 기획서가 없으면 <Link href={DEMO_CHECK}>완성된 판정 화면을 그대로 보거나</Link>,{" "}
          <a href="/sample-plan.pdf">예비 데모 기획서(PDF)</a> 를 내려받아 위에 올려 보십시오.
        </p>
      </main>
    </div>
  );
}
