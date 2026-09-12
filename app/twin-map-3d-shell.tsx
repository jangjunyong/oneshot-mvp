"use client";

// MapLibre 는 window 가 필요하다. 이 껍데기가 클라이언트 경계다.
// 2026-09-12: 버튼을 누르기 전에는 3D 모듈(maplibre 청크)을 아예 내려받지 않는다 —
// /check 는 클라이언트 JS 가 거의 0 인 화면이라, 접힌 블록 하나 때문에 청크를 당기면 안 된다.

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Pin3D } from "@/app/twin-map-3d";

const TwinMap3D = dynamic(() => import("@/app/twin-map-3d"), { ssr: false, loading: () => null });

export function TwinMap3DShell(props: {
  pins: Pin3D[];
  origin: { lat: number; lng: number } | null;
  pinHrefBase: string;
  pinHrefSuffix: string;
  selectedPin: string | null;
  vworldKey: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="twin-3d">
        <button type="button" className="twin-3d-toggle" onClick={() => setOpen(true)} aria-expanded={false}>
          3D 지도로 보기
        </button>
      </div>
    );
  }
  return <TwinMap3D {...props} initialOpen />;
}
