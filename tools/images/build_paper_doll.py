"""
종이 분신 소환물 그림 (D-147, 종이 인형 마술사 몸통 '종이 분신' — 예전엔 토끼 인형을 흑백으로 바꾼 것)
doll_set 5칸(흰 헝겊·종이 인형)을 떼어 종이처럼 팔랑이는 걷기 12칸 → assets/sprites/rig/paper_doll/paper_doll_walk.webp
  얇은 종이라 좌우로 납작해졌다 펴지고(돌아서는 듯) 위아래로 통통 튐. 공격 동작은 걷기를 빠르게 (kit.js KIT_ALLY_ART)
틀 160×170, 발 자리 anchorX 80. 소환물 CSS가 좌우를 뒤집으니 왼쪽을 보게 구움
실행: python tools/images/build_paper_doll.py   (doll_set.png를 먼저 만듦 — build_saint_set.py doll_set 4 2 256)
"""
import math
import os

import numpy as np
from PIL import Image

FW, FH, BODY = 160, 170, 140
OUT = os.path.join('assets', 'sprites', 'rig', 'paper_doll')
sheet = Image.open(os.path.join('assets', 'sprites', 'vfx', 'png', 'doll_set.png')).convert('RGBA')
cell = sheet.crop((5 * 256, 0, 6 * 256, 256))
cell = cell.crop(cell.getbbox())
k = BODY / cell.height
doll = cell.resize((round(cell.width * k), BODY), Image.LANCZOS)


def frame(squeeze, dy, ang):
    w = max(8, round(doll.width * squeeze))
    im = doll.resize((w, doll.height), Image.LANCZOS)
    f = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    f.alpha_composite(im, (round(FW / 2 - w / 2), round(FH - 4 - doll.height + dy)))
    return f.rotate(ang, resample=Image.BICUBIC, center=(FW / 2, FH - 4))


frames = []
for i in range(12):
    u = i / 12
    frames.append(frame(0.78 + 0.22 * abs(math.cos(u * 2 * math.pi)), -8 * abs(math.sin(u * 2 * math.pi)), 7 * math.sin(u * 2 * math.pi)))
s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
for i, f in enumerate(frames):
    s.paste(f.transpose(Image.FLIP_LEFT_RIGHT), (i * FW, 0))
os.makedirs(OUT, exist_ok=True)
p = os.path.join(OUT, 'paper_doll_walk.webp')
s.save(p, 'WEBP', quality=90, method=6)
a = np.asarray(s)[..., 3]
print(p, s.size, os.path.getsize(p) // 1024, 'KB', '위 여백', int(np.nonzero(a.max(1) > 20)[0].min()))
