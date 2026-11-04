"""세트 그림 한눈에 보기: tools/rig/_rest_check_<id>_set_<글자>.png 9장을 한 장으로 (tools/rig/_sets_<id>.png)
  python tools/rig/set_sheet.py diver
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
cid = sys.argv[1]
letters = ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm']
cell = 300
sheet = Image.new('RGB', (cell * 5, cell * 2), (40, 44, 52))
d = ImageDraw.Draw(sheet)
for i, v in enumerate(letters):
    p = os.path.join(HERE, f'_rest_check_{cid}_set_{v}.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA').resize((cell, cell))
    x, y = (i % 5) * cell, (i // 5) * cell
    sheet.paste(im, (x, y), im)
    d.text((x + 8, y + 6), v, fill=(255, 220, 120))
out = os.path.join(HERE, f'_sets_{cid}.png')
sheet.save(out)
print(out)
