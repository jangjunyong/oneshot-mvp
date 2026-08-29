"use client";

// Konva 는 window 가 필요해서 서버 렌더가 불가능하다. ssr:false 동적 로드는
// 클라이언트 경계 안에서만 되므로 이 껍데기가 그 경계다.

import dynamic from "next/dynamic";
import type { Venue } from "@/lib/venue";

const Editor = dynamic(() => import("@/app/venue/editor"), {
  ssr: false,
  loading: () => <p className="note">도면 편집기를 불러오는 중…</p>,
});

export function EditorShell(props: {
  initialVenue: Venue;
  entryId: string | null;
  initialCenter: { lat: number; lng: number } | null;
  vworldKey: string | null;
  scenario: { surge: number | null; label: string } | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return <Editor {...props} />;
}
