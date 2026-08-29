// PDF 텍스트 추출 테스트.
//
// 픽스처는 손으로 조립한 최소 PDF 다 — 외부 파일에 기대면 테스트가
// 저장소 밖 상태에 묶인다. 표준 14폰트(Helvetica)는 한글 인코딩이 없어
// 본문은 ASCII 로 둔다. 한글 추출 품질은 라이브러리(pdf.js)의 몫이고,
// 여기서 지키는 것은 **뽑는다 / 거절한다 / 상한** 세 가지 계약이다.

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractPdfText, MAX_PDF_BYTES } from "@/lib/pdf";

/** 한 페이지짜리 진짜 PDF 를 바이트로 조립한다 */
function 최소PDF(본문: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${본문}) Tj ET`;
  const objs = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
  ];
  const body = `%PDF-1.4\n${objs.join("\n")}\ntrailer << /Root 1 0 R /Size 6 >>\n%%EOF`;
  return new TextEncoder().encode(body);
}

test("PDF 에서 텍스트를 뽑는다", async () => {
  const text = await extractPdfText(최소PDF("GIMCHEON GIMBAP FESTIVAL 2024"));
  assert.match(text, /GIMCHEON GIMBAP FESTIVAL/);
});

test("PDF 가 아닌 파일은 한국어 사유로 거절한다", async () => {
  const 쓰레기 = new TextEncoder().encode("이것은 PDF 가 아니라 그냥 텍스트다");
  await assert.rejects(
    () => extractPdfText(쓰레기),
    /PDF 를 읽지 못했습니다/,
    "깨진 파일이 라이브러리 스택트레이스로 터지면 화면이 그걸 그대로 보여준다",
  );
});

test("상한을 넘는 PDF 는 파싱을 시작하지도 않는다", async () => {
  // 서버 액션 본문 한도(next.config)와 짝이다. 여기가 먼저 거절해야
  // 사유가 한국어로 나간다.
  const 큰것 = new Uint8Array(MAX_PDF_BYTES + 1);
  await assert.rejects(() => extractPdfText(큰것), /너무 큽니다/);
});
