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

/**
 * 시군구의 인구(만 명). 같은 시군구를 먼저 찾고 없으면 같은 시도의 첫 건을 쓴다.
 *
 * 인구는 모델에게 묻지 않는다 — 기획서에 안 적혀 있고, 물으면 지어낸다.
 * 619건이 이미 실측 인구를 들고 있으므로 여기서 꺼내 쓴다.
 * 둘 다 없으면 null 을 돌려 담당자가 직접 채우게 한다.
 */
export function populationOf(sido: string, sigungu: string): number | null {
  const hit =
    FESTIVALS.find((f) => f.sido === sido && f.sigungu === sigungu) ??
    FESTIVALS.find((f) => f.sido === sido);
  return hit ? hit.populationManMyeong : null;
}
