"use client";

// MapLibre 는 window 가 필요하다. 이 껍데기가 클라이언트 경계이고, 3D 지도는
// 사용자가 열기 전엔 코드만 내려오고 지도는 만들지 않는다.

import dynamic from "next/dynamic";
import type { Pin3D } from "@/app/twin-map-3d";

const TwinMap3D = dynamic(() => import("@/app/twin-map-3d"), { ssr: false, loading: () => null });

export function TwinMap3DShell(props: {
  pins: Pin3D[];
  origin: { lat: number; lng: number } | null;
  entryId: string;
  selectedPin: string | null;
  vworldKey: string | null;
}) {
  return <TwinMap3D {...props} />;
}
