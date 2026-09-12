// 기획안 입력 양식 — 담당자가 채워 PDF 로 올리면 추출이 가장 정확하게 붙는 한 장 (2026-09-12 사용자 지시 3).
// 항목은 lib/extract.ts 의 스키마와 1:1 이다. 양식이 아닌 지자체 기획서를 올려도 같은 추출기가 읽는다 —
// 이 양식은 "잘 읽히는 순서"를 보여 주는 것이지 필수가 아니다. 자바스크립트 0, 브라우저 인쇄로 PDF.

import Link from "next/link";

export const metadata = { title: "기획안 입력 양식 · 기획안 팩트체크" };

const Line = ({ label, hint, wide }: { label: string; hint?: string; wide?: boolean }) => (
  <tr>
    <th scope="row">{label}</th>
    <td className={wide ? "form-wide" : undefined}>
      <span className="form-blank" aria-hidden="true" />
      {hint && <span className="note"> {hint}</span>}
    </td>
  </tr>
);

export default function FormPage() {
  return (
    <div className="report report-form">
      <p className="no-print report-hint">
        <span className="logo">기획안 팩트체크</span> 브라우저 인쇄(Ctrl+P)에서 <strong>대상을 PDF로 저장</strong>하면 한 장 양식이 됩니다. 채운 뒤{" "}
        <Link href="/">첫 화면</Link>에 PDF 로 올리면 됩니다. 지자체 고유 양식 기획서를 그대로 올려도 읽습니다.
      </p>
      <section className="report-page">
        <header className="report-head">
          <h1>축제 기획안 — 팩트체크 입력 양식</h1>
          <p className="num">한국관광공사 KT 시군구 일별 실측으로 예상 방문객·기간·예산을 판정합니다. 근거가 되는 문장을 그대로 적어 주세요.</p>
        </header>

        <h2>1. 축제</h2>
        <table className="report-table form-table">
          <tbody>
            <Line label="축제 이름" />
            <Line label="개최 지역" hint="시·도 / 시·군·구 (예: 충남 보령시)" />
            <Line label="개최 기간" hint="YYYY-MM-DD ~ YYYY-MM-DD (준비·용역 기간이 아니라 관람객이 오는 날)" />
            <Line label="주요 내용" hint="프로그램·테마 한 줄" wide />
          </tbody>
        </table>

        <h2>2. 예상 방문객</h2>
        <table className="report-table form-table">
          <tbody>
            <Line label="예상 방문객 수" hint="명. 산출 근거 문장을 같이 적으면 판정에 인용됩니다" />
            <Line label="단위" hint="□ 기간 총계  □ 일 최다   ×   □ 연인원(누적)  □ 실인원(고유 방문자)" />
            <Line label="산출 근거" hint="예: 작년 발표 54만 명의 110%" wide />
          </tbody>
        </table>

        <h2>3. 지난 회차 (있는 만큼, 최대 3회)</h2>
        <table className="report-table form-table">
          <thead>
            <tr>
              <th>연도</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>발표 방문객(있으면)</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <td><span className="form-blank" /></td>
                <td><span className="form-blank" /></td>
                <td><span className="form-blank" /></td>
                <td><span className="form-blank" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">지난 회차 기간은 KT 자료에서 그 축제의 실측 배수를 재는 데 씁니다. 모르면 비워 두세요 — 또래 기준 참고값만 냅니다.</p>

        <h2>4. 예산·시설</h2>
        <table className="report-table form-table">
          <tbody>
            <Line label="총예산" hint="만 원 (천원·백만원 단위면 그렇게 적어도 됩니다)" />
            <Line label="주차면" hint="면" />
            <Line label="부스 수" hint="개" />
          </tbody>
        </table>

        <footer className="report-foot">
          <span>기획안 팩트체크 · 양식 v1 (2026-09)</span>
          <span>채운 PDF 는 첫 화면에 올립니다. 숫자는 문서에서 옮겨 적기만 하고 판정에는 모델을 쓰지 않습니다.</span>
        </footer>
      </section>
    </div>
  );
}
