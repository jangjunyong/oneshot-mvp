"use client";

// 제출 중에는 버튼을 막는다 — 추출은 15초까지 걸리고, 그 사이 두 번 누르면 모델 호출이 두 번 나가 하루 한도를 두 칸 먹었다
// (2026-09-11 검증 S1 #11). 자바스크립트가 없으면 평범한 제출 버튼으로 남는다.

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
