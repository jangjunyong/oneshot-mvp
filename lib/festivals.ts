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
 * 시군구의 인구(만 명). 같은 시군구가 619건에 있을 때만 돌려준다.
 *
 * 인구는 모델에게 묻지 않는다 — 기획서에 안 적혀 있고, 물으면 지어낸다.
 * 619건이 이미 실측 인구를 들고 있으므로 여기서 꺼내 쓴다.
 * 없으면 null 을 돌려 담당자가 직접 채우게 한다. **같은 시도의 다른 곳으로 대신하지 않는다** —
 * 2026-09-11 까지 그렇게 했고, "강원 고한읍"에 강릉 인구 20.7만(정선군 3.3만의 6.3배)이
 * 조용히 붙어 또래 구간과 첫 회 판정이 통째로 틀렸다.
 * "보령"처럼 접미사가 빠진 표기는 시·군·구 중 하나만 맞을 때 그것으로 본다.
 */
export function populationOf(sido: string, sigungu: string): number | null {
  const s = sigungu.trim();
  const inSido = FESTIVALS.filter((f) => f.sido === sido);
  const exact = inSido.find((f) => f.sigungu === s);
  if (exact) return exact.populationManMyeong;
  if (s.length > 0 && !/[시군구]$/.test(s)) {
    const hits = ["시", "군", "구"]
      .map((suf) => inSido.find((f) => f.sigungu === s + suf))
      .filter((f): f is Festival => !!f);
    if (hits.length === 1) return hits[0].populationManMyeong;
  }
  return null;
}
