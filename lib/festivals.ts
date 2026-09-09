import raw from "@/data/festivals.json";
import surgeRaw from "@/data/festivals.surge.json";
import type { Festival } from "@/lib/types";

interface Bundle {
  meta: { source: string; collectedAt: string; count: number; note: string };
  festivals: Festival[];
}

const bundle = raw as Bundle;

/**
 * 619건의 배수를 **lib/surge.ts 한 정의**(전후 4주 외지인 중앙값 대비 축제일 평균)로 다시 잰 값.
 * scripts/recompute619.ts 가 공사 KT 일별 원본에서 만든다. 2026-09-09 부터 619/619 이 선다.
 *
 * 수집 당시 값(actualVisitSurge 원본)은 베이스라인 정의가 코드에 남아 있지 않아 대조용으로만
 * data/festivals.json 에 남긴다. 화면·매칭·등급은 여기서 덮어쓴 값을 쓴다 — 그래야 /check 의
 * 자기 이력과 / 의 닮은 축제가 같은 자로 잰 배수가 된다 (기획/08 §2.3 "619 재계산").
 */
const SURGE = (surgeRaw as unknown as { festivals: Record<string, { ok: boolean; surgeMean?: number }> }).festivals;

/** 619건 전수. 정적 JSON 이라 요청마다 다시 읽지 않는다. 배수는 재계산본 */
export const FESTIVALS: readonly Festival[] = bundle.festivals.map((f) => {
  const s = SURGE[f.id];
  return s?.ok && s.surgeMean !== undefined ? { ...f, actualVisitSurge: s.surgeMean } : f;
});

/** 재계산본으로 덮인 건수 — 화면이 "619건 중 N건 재계산" 이라고 말할 수 있게 */
export const RECOMPUTED = bundle.festivals.filter((f) => SURGE[f.id]?.ok).length;

/**
 * 데이터 출처·수집일. 화면에 아직 안 붙어 있다 — 붙일 자리를 정하지 못했다.
 * "출처 없는 숫자는 화면에 올리지 않는다"가 이 프로젝트 규칙이라 지우지 않고
 * 남긴다. 지우면 619건의 출처가 코드에서 사라진다.
 */
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
