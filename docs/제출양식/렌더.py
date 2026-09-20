# 제출 PDF 를 장별 PNG 로 굽는다 - 눈으로 한 장씩 보기 위한 도구
import sys, os, fitz
src = sys.argv[1] if len(sys.argv) > 1 else "기능설명서_기획안팩트체크_최종본.pdf"
out = "렌더"
os.makedirs(out, exist_ok=True)
doc = fitz.open(src)
for i, page in enumerate(doc, start=1):
    pix = page.get_pixmap(dpi=110)
    p = os.path.join(out, "p%02d.png" % i)
    pix.save(p)
    print(p, pix.width, "x", pix.height)
