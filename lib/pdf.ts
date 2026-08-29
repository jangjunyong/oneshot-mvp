// PDF 기획서 → 텍스트.
//
// 지자체 기획서는 PDF 로 도는 일이 많다(법정 서식의 첨부서류 —
// docs/참고사이트.md). 복붙이 안 되는 담당자를 위해 파일을 받아 글자만
// 뽑고, 그다음은 기존 추출 파이프라인(extract.ts)에 그대로 태운다.
//
// unpdf 를 쓰는 이유 — pdf.js(Mozilla)를 서버리스에서 그대로 쓸 수 있게
// 감싼 것뿐이라 네이티브 빌드가 없고 Vercel 에서 바로 돈다 (2026-08-29
// 사용자 승인으로 추가한 의존성).

import { extractText, getDocumentProxy } from "unpdf";

/**
 * 받는 PDF 의 상한. next.config 의 서버 액션 본문 한도와 짝이다 —
 * 여기가 먼저 거절해야 사유가 한국어로 나간다.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** PDF 바이트에서 전체 텍스트. 스캔본(글자 없는 이미지)이면 빈 문자열이 온다 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF 가 너무 큽니다 — 10MB 까지 받습니다");
  }
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  } catch {
    // 라이브러리 예외를 그대로 올리면 화면이 스택트레이스를 보여준다.
    throw new Error("PDF 를 읽지 못했습니다 — 텍스트를 직접 붙여넣어 주세요");
  }
}
