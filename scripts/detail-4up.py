# 상세 이미지 한 장 — 양식이 요구하는 "서비스 상세 이미지(3~5장)"를 한 칸 안에서 채운다.
#
# 왜 스크립트인가: 2026-09-20 에 손으로 붙였더니 capture.mjs 의 촬영 목록에 이 파일이 없어서,
# 다음 회차에 다른 그림은 새 화면인데 이 한 장만 옛 화면인 채로 조용히 섞일 뻔했다.
# 이제 capture.mjs 가 전체 촬영을 마친 뒤 이 파일을 부른다.
#
#   python scripts/detail-4up.py

import os

from PIL import Image, ImageDraw, ImageFont

OUT = "docs/제출양식/캡처"
FONT = "C:/Windows/Fonts/malgun.ttf"
PANELS = [
    ("① 첫 화면 — 기획서 PDF 입력", "page_home.png"),
    ("② 판정 — 3단 판정표·공사 데이터", "page_check.png"),
    ("③ 실측 근거 — 연도별 곡선·표", "page_evidence.png"),
    ("④ 시뮬레이션 — 도면 위 보행자", "page_venue.png"),
]
W, CAP, PAD, BODY = 1000, 44, 16, 1150

font = ImageFont.truetype(FONT, 26)
cells = []
for label, name in PANELS:
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        raise SystemExit("먼저 capture.mjs 로 전체 화면을 찍어야 한다: " + path)
    im = Image.open(path).convert("RGB")
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    im = im.crop((0, 0, W, min(BODY, im.height)))
    cell = Image.new("RGB", (W, CAP + im.height), "white")
    d = ImageDraw.Draw(cell)
    d.rectangle([0, 0, W - 1, CAP - 1], fill=(31, 35, 40))
    d.text((12, 9), label, font=font, fill="white")
    cell.paste(im, (0, CAP))
    d.rectangle([0, 0, W - 1, cell.height - 1], outline=(140, 140, 140), width=2)
    cells.append(cell)

# 가로 한 줄 — 양식의 상세 이미지 칸이 가로로 길어서, 2×2 로 붙이면 높이에 걸려 우표만 해진다
ch = max(c.height for c in cells)
out = Image.new("RGB", (W * 4 + PAD * 5, ch + PAD * 2), "white")
for n, c in enumerate(cells):
    out.paste(c, (PAD + n * (W + PAD), PAD))

dst = os.path.join(OUT, "detail_4up.png")
out.save(dst)
print("detail_4up.png %dx%d %dKB (four panels, this run)" % (out.width, out.height, os.path.getsize(dst) / 1024))
