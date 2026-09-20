# 작성본 pptx → 제출용 pdf. PowerPoint 를 띄워 내보낸다(링크가 살아 있어야 해서 인쇄가 아니라 내보내기다).
#
# 왜 파일로 남기나: 2026-09-18 에는 손으로 내보내서 절차가 어디에도 안 남았다.
# 화면을 고칠 때마다 캡처 → fill.py → 이 파일 순서로 한 줄씩 돌리면 제출물이 다시 만들어진다.
#
#   python fill.py && python topdf.py

import os
import sys

import win32com.client

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "기능설명서_기획안팩트체크_작성본.pptx")
DST = os.path.join(HERE, "기능설명서_기획안팩트체크_최종본.pdf")

FORMAT_PDF = 32  # ppSaveAsPDF (대비용 폴백)
# ExportAsFixedFormat 인자 — SaveAs 는 화면용 해상도로 그림을 줄여 버린다(표지·화면 캡처가 뭉개지는 원인).
# 인쇄 품질로 내보내면 그림이 원본 해상도에 가깝게 남는다.
PDF_TYPE = 2   # ppFixedFormatTypePDF
INTENT_PRINT = 2  # ppFixedFormatIntentPrint (1 = Screen)

if not os.path.exists(SRC):
    sys.exit("작성본이 없다. 먼저 fill.py 를 돌린다: " + SRC)

app = win32com.client.Dispatch("PowerPoint.Application")
deck = app.Presentations.Open(SRC, WithWindow=False)
try:
    try:
        # 인쇄 품질 내보내기 — 그림 해상도를 지킨다
        deck.ExportAsFixedFormat(DST, PDF_TYPE, INTENT_PRINT, False, 1, 1, False, None, 1, "", True, True, True, False, False)
        print("ExportAsFixedFormat(인쇄 품질)")
    except Exception as e:
        print("ExportAsFixedFormat 실패 → SaveAs 로 폴백:", e)
        deck.SaveAs(DST, FORMAT_PDF)
finally:
    deck.Close()
    app.Quit()

size = os.path.getsize(DST)
print("saved %s (%.1f MB)" % (os.path.basename(DST), size / 1024 / 1024))

# 쪽수·글자 확인 — 제출 전에 눈으로 보기 전의 기계 검사
try:
    from pypdf import PdfReader

    r = PdfReader(DST)
    text = "\n".join((p.extract_text() or "") for p in r.pages)
    print("pages=%d (expect 12)" % len(r.pages))
    # PDF 추출은 공백을 흘린다. 공백을 지우고 견준다 (2026-09-21)
    flat = "".join(text.split())
    for 말 in ("기획안 팩트체크", "#사전 수요 예측", "oneshot-mvp.vercel.app", "judge-guide.pdf"):
        print("has %-24s %s" % (말, "".join(말.split()) in flat))
    print("placeholders=%d (expect 0)" % sum(text.count(x) for x in ("[캡처", "[대표 이미지", "[상세 이미지")))
except ImportError:
    print("pypdf 가 없어 본문 검사는 건너뛴다")
