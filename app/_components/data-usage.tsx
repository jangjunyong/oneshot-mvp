// 데이터 활용 블록 — "관광공사 데이터가 이 판정의 어디에 쓰였나"를 심사위원이 30초 안에 읽게 한다
// (사용자 지시 6, 2026-09-11). 서버 컴포넌트, 자바스크립트 0. 숫자는 판정 엔진이 낸 Measured 셀을
// 그대로 다시 인용한다 — 여기서 새 숫자를 만들지 않는다(불문율 4). 적재 규모는 coverageStats() 에서 온다.

import type { Measured } from "@/lib/verdict";
import { KT_API } from "@/lib/verdict";
import type { PeerBand } from "@/lib/verdict";
import type { CompetitionStatus } from "@/lib/overlap";
import { coverageStats, manifest } from "@/lib/kto/daily";
import { FESTIVALS, RECOMPUTED } from "@/lib/festivals";
import { REGION_META } from "@/lib/region";
import { Num } from "@/app/_components/num";

const DATE = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

export function DataUsage({
  by,
  historyYears,
  dataRange,
  peer,
  competition,
}: {
  /** 판정 엔진이 낸 실측 셀 — 여기서는 인용만 한다 */
  by: Map<string, Measured>;
  historyYears: number;
  dataRange: { from: string; to: string; days: number } | null;
  peer: PeerBand | null;
  competition: { status: CompetitionStatus; count: number };
}) {
  const cov = coverageStats();
  const man = manifest();
  const cells = ["maxDayTotal", "periodTotal", "peakIncrement", "periodVisitors", "baseline"]
    .map((k) => by.get(k))
    .filter((m): m is Measured => !!m);
  const 경쟁문 =
    competition.status === "ok"
      ? `작년 축제 기간 반경 50km 다른 축제 ${competition.count}건 → 귀속 경고`
      : competition.status === "nokey"
        ? "키가 없어 이 화면에서는 조회하지 않았다"
        : competition.status === "fail"
          ? "조회 실패 — 판정에는 영향 없음"
          : "이력이 없어 조회하지 않았다";

  return (
    <section className="data-usage" aria-labelledby="data-usage-h">
      <h2 id="data-usage-h">이 판정에 쓴 공사 데이터</h2>
      <table className="report-table data-usage-table">
        <thead>
          <tr>
            <th>한국관광공사 데이터</th>
            <th>어디에</th>
            <th>이 판정에 찍힌 값</th>
            <th>호출</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>
              TourAPI <code>{KT_API}</code>
              <span className="note"> KT 이동통신 시군구 일별 체류</span>
            </th>
            <td>판정 3단계의 분모 · 자기 이력 {historyYears}년 · 내년 배수 구간</td>
            <td>
              {cells.length === 0
                ? "이력이 없어 실측 셀 없음"
                : cells.map((m, i) => (
                    <span key={m.key}>
                      {i > 0 && " · "}
                      <Num m={m} />
                    </span>
                  ))}
            </td>
            <td className="note">
              빌드 전 적재
              {dataRange && ` · 이 시군구 ${DATE(dataRange.from)}~${DATE(dataRange.to)} ${dataRange.days.toLocaleString("ko-KR")}일`}
            </td>
          </tr>
          <tr>
            <th>
              TourAPI <code>searchFestival2</code>
              <span className="note"> 축제 등록 정보</span>
            </th>
            <td>같은 시기 반경 50km 경쟁 축제 → 귀속 경고</td>
            <td>{경쟁문}</td>
            <td className="note">이 화면에서 실시간 호출</td>
          </tr>
          <tr>
            <th>
              데이터랩 축제 목록 {FESTIVALS.length}건
              <span className="note"> + 위 일별 자료로 재계산 {RECOMPUTED}/{FESTIVALS.length}</span>
            </th>
            <td>또래 구간(같은 인구 구간의 배수 분포) · 닮은 축제</td>
            <td>
              {peer ? `또래 ${peer.n}곳 (${peer.label})` : "인구가 없어 또래 없음"}
              <span className="note"> · 인구 기준 행안부 주민등록({REGION_META.baseMonth.slice(0, 7)}, {REGION_META.matched}곳)</span>
            </td>
            <td className="note">정적 수집 · 빌드 전 재계산</td>
          </tr>
        </tbody>
      </table>
      <p className="note data-usage-scale">
        전국 KT 시군구 <b>{cov.sigungu}개</b>를 빌드 전에 통째로 적재({DATE(man.from ?? "")}~{DATE(man.to ?? "")}, 합계{" "}
        <b>{cov.rows.toLocaleString("ko-KR")}행</b>). 판정과 구간은 규칙이 내고 모델은 부르지 않는다.
      </p>
    </section>
  );
}
