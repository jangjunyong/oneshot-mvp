// 기획서에서 옮겨 적은 값의 근거 — /check 결과 머리에 붙는 주석 블록 (2026-09-12, 확인 화면 폐지).
// 판정 블록(#verdict) 밖에 둔다: 이 블록은 초안(DB)에서 오고, 판정은 URL 에서만 온다.
// 원문 인용 안의 "N명"은 담당자 문서의 글자다 — data-num 셀(origin input, 출처 기획안 원문)로 감싸
// "출처 셀 밖 명 수 0건" 규율을 지킨다.

import Link from "next/link";
import type { Draft } from "@/lib/store";

const FACT_ORDER = ["expectedVisitors", "startDate", "endDate", "budgetManWon", "parkingSpaces", "boothCount", "sido", "sigungu"] as const;
const KOREAN_FACT_NAME: Record<(typeof FACT_ORDER)[number], string> = {
  expectedVisitors: "예상 방문객",
  startDate: "개최 시작",
  endDate: "개최 끝",
  budgetManWon: "예산",
  parkingSpaces: "주차면",
  boothCount: "부스",
  sido: "시도",
  sigungu: "시군구",
};

export function DraftNote({ draft, id }: { draft: Draft; id: string }) {
  const quotes = FACT_ORDER.map((k) => [k, draft.evidence[k as keyof typeof draft.evidence]] as const).filter(([, v]) => !!v);
  return (
    <section className="draft-note" aria-labelledby="draft-note-h">
      <h2 id="draft-note-h">기획안에서 옮겨 적은 값</h2>
      {draft.source === "sample" && (
        <p className="alert" data-level="주의">
          모델 키가 없어 <strong>고정 샘플</strong>(김천김밥축제)로 채웠습니다. 실제 문서에서 뽑은 값이 아닙니다.
        </p>
      )}
      {quotes.length > 0 ? (
        <ul className="evidence-list">
          {quotes.map(([k, v]) => (
            <li key={k}>
              <b>{KOREAN_FACT_NAME[k] ?? k}</b>{" "}
              <q className="evidence" data-num="" data-origin="input" data-source-api="기획안 원문" data-source-value="" data-source-period="" data-source-date="">
                {v}
              </q>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">문서에서 근거 문장을 찾지 못했습니다. 아래 폼에 직접 적으면 그 값으로 판정합니다.</p>
      )}
      {draft.missing.length > 0 && (
        <p className="note">
          문서에서 못 찾은 항목: {draft.missing.join(" · ")}. 아래 폼에서 채우면 됩니다.
        </p>
      )}
      <p className="note">
        닮은 과거 축제(보조 근거)까지 보려면 <Link href={`/?draft=${id}`}>보조 진단 이어서 →</Link>
      </p>
    </section>
  );
}
