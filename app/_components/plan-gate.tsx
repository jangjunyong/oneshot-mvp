// 기획서를 아직 안 넣었을 때의 판정·실측 근거·시뮬레이션 화면 (2026-09-13 사용자 지시).
// 견본으로 채우지 않는다 — 기획서를 넣어야 기능이 선다. 문구는 한 줄과 링크 하나뿐이다.

import Link from "next/link";

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
      </main>
    </div>
  );
}
