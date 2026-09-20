// 기획서를 아직 안 넣었을 때의 판정·실측 근거·시뮬레이션 화면 (2026-09-13 사용자 지시).
// 견본으로 채우지 않는다 — 기획서를 넣어야 기능이 선다.
//
// 2026-09-21 사용자 결정: 공고문이 1차 심사를 "서면 및 기능심사"로 규정하고 심사위원이 서비스를 직접 연다.
// 그래서 **이 빈 화면에만** 길을 연다. 첫 화면(/)은 입력만 그대로다. 사이트에 견본 데이터를 세우는 것이
// 아니라 문서 둘(양식·안내)로 보내므로 09-13 결정("예시가 사이트에 있는 게 싫다")과 어긋나지 않는다.

import Link from "next/link";
import { checkQueryString, DEMOS } from "@/lib/checkquery";

const DEMO_CHECK = `/check${checkQueryString(DEMOS.gunpo.query)}`;

export function PlanGate({ title, active }: { title: string; active: "/check" | "/venue" | null }) {
  return (
    <div className="sheet check-sheet">
      <header className="topbar">
        <span className="logo">기획안 팩트체크</span>
        <nav>
          <Link href="/">기획안 넣기</Link>
          <Link href="/check" aria-current={active === "/check" ? "page" : undefined}>판정</Link>
          <Link href="/venue" aria-current={active === "/venue" ? "page" : undefined}>시뮬레이션</Link>
        </nav>
      </header>
      <main>
        <h1>{title}</h1>
        <p className="plan-gate">
          기획서를 넣으면 이 화면이 열립니다. <Link href="/">기획안 넣기 →</Link>
        </p>
        <p className="plan-gate-docs">
          <Link href={DEMO_CHECK}>완성된 판정 화면 보기</Link> · <a href="/sample-plan.pdf">예비 데모 기획서(PDF)</a> ·{" "}
          <a href="/plan-form.pdf">기획안 양식</a> · <a href="/judge-guide.pdf">3분 안내</a>
        </p>
      </main>
    </div>
  );
}
