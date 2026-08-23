import raw from "@/data/festivals.json";
import type { Festival } from "@/lib/types";

interface Bundle {
  meta: { source: string; collectedAt: string; count: number; note: string };
  festivals: Festival[];
}

const bundle = raw as Bundle;

/** 619건 전수. 정적 JSON 이라 요청마다 다시 읽지 않는다 */
export const FESTIVALS: readonly Festival[] = bundle.festivals;

export const META = bundle.meta;

/** 못 찾았을 때 화면에 내보내는 "찾아본 범위" */
export const SEARCHED_SCOPE = `전국 ${bundle.festivals.length}개 축제`;

/** eventStartDate(YYYYMMDD) 에서 개최 월 */
export function monthOf(f: Festival): number {
  return Number(f.eventStartDate.slice(4, 6));
}

/** eventStartDate 에서 개최 연도 */
export function yearOf(f: Festival): string {
  return f.eventStartDate.slice(0, 4);
}
