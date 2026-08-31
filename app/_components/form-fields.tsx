// 확인·수정 폼의 입력 칸 두 종류.
//
// 진단 화면(`app/page.tsx`)이 쓰는 표시 전용 조각. props 만 보고 그리며
// 요청·저장소·모델을 모르므로 화면 파일 밖에 둘 수 있다.

/** 값 한 칸 + 그 값이 어디서 나왔는지. 근거 없이 값만 두면 못 믿는다 */
export function Field({
  id,
  label,
  defaultValue,
  evidence,
}: {
  id: string;
  label: string;
  defaultValue: string;
  evidence?: string;
}) {
  return (
    <>
      <p>
        <label htmlFor={id}>{label}</label>{" "}
        <input id={id} name={id} defaultValue={defaultValue} required />
      </p>
      {evidence && <p className="evidence">“{evidence}”</p>}
    </>
  );
}

/**
 * 고르는 칸. 담당자는 "테마 코드 3" 이나 "접근성 2등급" 을 모른다.
 * 숫자는 안쪽에만 남기고 화면에는 이름만 낸다.
 */
export function Choice({
  id,
  name,
  label,
  defaultValue,
  options,
  evidence,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number | string;
  options: [number, string][];
  evidence?: string;
}) {
  return (
    <>
      <p>
        <label htmlFor={id}>{label}</label>{" "}
        <select id={id} name={name} defaultValue={String(defaultValue)} required>
          <option value="" disabled>
            고르세요
          </option>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </p>
      {evidence && <p className="evidence">“{evidence}”</p>}
    </>
  );
}
