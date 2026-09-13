"use client";

// MapLibre 는 window 가 필요해서 서버 렌더가 불가능하다. ssr:false 동적 로드는
// 클라이언트 경계 안에서만 되므로 이 껍데기가 그 경계다.

import dynamic from "next/dynamic";
import type { Venue } from "@/lib/venue";

const SimMap = dynamic(() => import("@/app/venue/sim-map"), {
  ssr: false,
  loading: () => <p className="note">행사장 시뮬레이션을 불러오는 중…</p>,
});

export function SimShell(props: {
  vworldKey: string | null;
  scenario: { surge: number | null; label: string } | null;
  initialCenter: { lat: number; lng: number } | null;
  initialGeo: NonNullable<Venue["geo"]> | null;
  /** 저장해 둔 배치도 밑그림(data URL). 자리는 initialGeo.underlay 에 있다 */
  initialUnderlay: string | null;
  /** 이 도면이 딸린 기획안의 판정 URL 쿼리("?…"). 저장 뒤 같은 기획안으로 돌아오는 데 쓴다 */
  planQuery: string;
  entryId: string | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return <SimMap {...props} />;
}
