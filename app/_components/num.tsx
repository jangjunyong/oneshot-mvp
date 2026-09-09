// 명·배·일 숫자는 이 컴포넌트로만 화면에 나간다 — 출처 4속성(API·값·기간·조회일)이 없으면
// 그릴 수 없게 타입이 강제한다. e2e 가 `[data-num]` 을 걷어낸 본문에 "N명" 이 남는지 센다.
// 그것이 불문율 1·4(예측 명 수 0건, 출처 없는 숫자 0건)의 집행기다 (기획/08 §2.4).

import type { Measured } from "@/lib/verdict";

export function formatMeasured(m: Measured): string {
  if (m.unit === "명") return Math.round(m.value).toLocaleString("ko-KR") + "명";
  if (m.unit === "배") return m.value.toFixed(2) + "배";
  return String(Math.round(m.value)) + "일";
}

export function Num({ m }: { m: Measured }) {
  const 출처 = m.origin === "input" ? `${m.label} · 담당자 입력` : `${m.label} · ${m.api} · ${m.period} · 조회 ${m.date}`;
  return (
    <span
      className="num"
      data-num=""
      data-origin={m.origin}
      data-source-api={m.api}
      data-source-value={String(m.value)}
      data-source-period={m.period}
      data-source-date={m.date}
      title={출처}
    >
      {formatMeasured(m)}
    </span>
  );
}

/** 화면이 직접 만드는 실측 셀 — 판정 엔진 밖의 숫자(일별 곡선 등)도 같은 규격을 지킨다 */
export function measured(
  key: string,
  label: string,
  value: number,
  unit: Measured["unit"],
  api: string,
  period: string,
  date: string,
): Measured {
  return { key, label, value, unit, origin: "measured", api, period, date };
}
