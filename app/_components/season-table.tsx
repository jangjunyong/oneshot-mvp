// 시기 민감도 표.
//
// 진단 화면(`app/page.tsx`)이 쓰는 표시 전용 조각. props 만 보고 그리며
// 요청·저장소·모델을 모르므로 화면 파일 밖에 둘 수 있다.

import type { SeasonScan } from "@/lib/season";

/**
 * 시기 민감도 표.
 *
 * 제목이 "N월에 열면"이 아닌 이유가 이 컴포넌트의 전부다 — 요청월과 쌍둥이
 * 실제 개최월은 19%만 일치한다. 그래서 각 행에 **쌍둥이가 실제로 열린 달**을
 * 찍어 표가 스스로 한계를 말하게 한다 (lib/season.ts 머리말).
 */
export function SeasonTable({ scan }: { scan: SeasonScan }) {
  if (scan.months.length === 0) return null;

  return (
    <div className="season">
      <h3>달을 바꾸면 어떤 쌍둥이가 뽑히나</h3>

      {/* 어느 달에도 쌍둥이가 없으면 견줄 것이 없다. 최저·최고를 고르는
          문장은 잰 것이 있을 때만 쓴다 (lib/season.ts 의 고른달) */}
      {/* 몇 달을 잴 수 있었는지를 먼저 말한다. 이걸 안 밝히면 1달만 잰
          조건에서도 "달을 바꿔도 그게 그거"로 읽힌다 */}
      {scan.measured > 0 && scan.measured < scan.months.length && (
        <p className="season-head num">
          12달 중 <strong>{scan.measured}달</strong>만 닮은 축제를 찾을 수
          있었습니다. 나머지 {scan.months.length - scan.measured}달은 평평한 것이
          아니라 재지 못한 것입니다.
        </p>
      )}
      {scan.quietest.length === 0 ? (
        <p className="season-head">
          달을 12번 바꿔 물어도 닮은 축제를 찾지 못했습니다. 시기를 견줄 근거가
          없습니다.
        </p>
      ) : scan.flat ? (
        <p className="season-head num">
          달을 바꿔도 쌍둥이 배수 폭이{" "}
          <strong>
            {Math.min(
              ...scan.months.map((m) => m.medianSurge ?? Infinity),
            ).toFixed(2)}
            ~
            {Math.max(...scan.months.map((m) => m.medianSurge ?? 0)).toFixed(2)}배
          </strong>{" "}
          안에 머뭅니다 — 이 조건에서 시기는 갈리지 않습니다
        </p>
      ) : (
        <p className="season-head num">
          가장 낮았던 달은 <strong>{scan.quietest.join("·")}월</strong>, 가장
          높았던 달은 <strong>{scan.busiest.join("·")}월</strong>입니다 (폭{" "}
          {scan.spread?.toFixed(2)}배)
        </p>
      )}

      {/* 12행이라 펼쳐 두면 화면이 이 표만으로 한 화면을 먹는다. 요약 한 줄은
          위에 남기고 표는 접는다 — 볼 사람만 편다 */}
      <details>
        <summary>달마다 뽑힌 쌍둥이 12줄 보기</summary>
      <table className="season-table">
        <thead>
          <tr>
            <th>물은 달</th>
            <th>쌍둥이</th>
            <th>배수</th>
            <th>중앙</th>
            <th>등급</th>
            <th>쌍둥이가 실제로 열린 달</th>
          </tr>
        </thead>
        <tbody>
          {scan.months.map((m) => (
            <tr key={m.month} data-plan={m.month === scan.planMonth || undefined}>
              <th scope="row" className="num">
                {m.month}월
              </th>
              <td className="num">{m.matched}곳</td>
              <td className="num">
                {m.loSurge === null
                  ? "—"
                  : `${m.loSurge.toFixed(2)}~${m.hiSurge!.toFixed(2)}`}
              </td>
              <td className="num">{m.medianSurge?.toFixed(2) ?? "—"}</td>
              <td>{m.level}</td>
              <td className="num season-twinmonths">
                {m.twinMonths.length === 0
                  ? "—"
                  : m.twinMonths
                      .map((tm) => (tm === m.month ? `${tm}월✓` : `${tm}월`))
                      .join(" ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </details>

      {/* 뽑힌 쌍둥이가 하나도 없으면 "매칭이 시기에 흔들린다"는 주의는
          주의할 대상이 없다. 표가 전부 빈칸인 것으로 이미 다 말했다 */}
      {scan.quietest.length > 0 && (
      <p className="note">
        읽을 때 조심할 것이 있습니다. 이 표가 재는 것은 시기의 효과가 아니라
        매칭이 시기에 얼마나 흔들리는가입니다. 닮음을 재는 다섯 축에서 개최
        시기가 차지하는 비중은 10%뿐이라, 달을 바꿔도 같은 지역 축제 몇 곳이
        순위만 바꿔 다시 섭니다. 물은 달에 실제로 열린 쌍둥이는{" "}
        <strong>{Math.round((scan.monthMatchRate ?? 0) * 100)}%</strong>(
        <span className="season-twinmonths">✓</span> 표시)뿐이고 나머지는 다른 달
        축제입니다. 그러니 &ldquo;그 달로 옮기면 이렇게 된다&rdquo;로 읽으면 안
        됩니다.
        {!scan.robust && (
          <>
            {" "}표본 수에도 흔들립니다. 쌍둥이를 3곳이 아니라 5곳이나 7곳으로
            잡으면 일부 달의 등급이 바뀝니다. 3곳짜리 중앙값이라 한 건만 교체돼도
            컷을 넘습니다.
          </>
        )}
      </p>
      )}
    </div>
  );
}
