// 기획안 넣기 — 첫 화면 (2026-09-12 A2, 사용자 지시 1·3·7).
//
// 여기서 하는 일은 하나다: 기획서를 받아 판정(/check)으로 보낸다. PDF 가 주, 붙여넣기는 접힘.
// 견본 버튼·데이터 셋 설명·한도 문구는 두지 않는다(2026-09-12 밤 사용자 지시) — 심사위원에게는 문서와 견본 기획서를 따로 준다.
// 저장 없음. 모델은 서버 액션(추출)에서 숫자를 옮겨 적는 데만 쓴다.

import Link from "next/link";
import { 추출 } from "@/app/actions";
import { MAX_PLAN_TEXT } from "@/lib/types";

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
          <label className="dropzone" htmlFor="planPdf">
            <span className="dropzone-title">기획서 PDF 올리기</span>
            <input id="planPdf" name="planPdf" type="file" accept="application/pdf" />
          </label>

          <p className="intake-actions">
            <button type="submit">읽어서 판정하기</button>
          </p>

          <details className="intake-paste">
            <summary>PDF 대신 텍스트로 붙여넣기</summary>
            <textarea id="planText" name="planText" rows={8} maxLength={MAX_PLAN_TEXT} />
          </details>
        </form>
      </main>
    </div>
  );
}
