// 해안선 — 남한 육지와 섬의 외곽선.
//
// 619개 점만으로도 나라 모양은 나왔지만, 축제가 없는 해안(강원 동해안·서해
// 도서)은 비어 있어서 어디가 바다인지 모르는 담당자가 있었다. 테두리를
// 얹으면 점이 어디에 찍혀 있는지가 그제서야 읽힌다.
//
// 그림을 아무 데서나 가져오지 않는다 — Natural Earth 는 퍼블릭 도메인이고
// 출처를 화면에 적는다. 이 파일이 화면에 나가는 유일한 "실측이 아닌 선"이라
// 어디서 왔는지가 데이터 안에 같이 들어 있다.

import raw from "@/data/coastline.json";

interface Bundle {
  source: string;
  url: string;
  note: string;
  /** 링마다 [경도, 위도] 의 배열 */
  rings: number[][][];
}

const bundle = raw as Bundle;

export const COAST_RINGS: readonly (readonly (readonly number[])[])[] = bundle.rings;

/** 화면에 그대로 적는 출처 */
export const COAST_SOURCE = bundle.source;
