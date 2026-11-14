"""
강철 방벽 그림 (D-118에서 미룬 Gemini 그림, D-123 2026-11-14 받음): 마젠타 배경 원본 → 투명 배경 art/steel_wall.webp

실행: python tools/images/build_steel_wall.py
  원본 assets/sprites/vfx/src/steel_wall_raw.png (Gemini 원본 크기 다운로드 896×1200, 프롬프트 tools/images/pending_art_d118.json)
  → 로고 지우기(unlogo) → 마젠타 빼기(build_bases.key_out) → 그림 둘레로 자르고 여백 4%
  → (D-124) 좌우 뒤집기(캐릭터 쪽에서 본 모습) → 도트화: 높이 PIX_H px로 줄여 색 24개로 줄이고 알파는 켜고 끄기만,
    바깥 1px 검은 외곽선 → 3배 그대로 키움(NEAREST) — 캐릭터 도트 그림과 어울리게 (예전: 512px 고해상도 그림)
  → assets/sprites/vfx/art/steel_wall.webp (ui_v2.css .is-steelwall image-rendering: pixelated)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402
from build_bases import key_out  # noqa: E402

SRC = os.path.join('assets', 'sprites', 'vfx', 'src', 'steel_wall_raw.png')
OUT = os.path.join('assets', 'sprites', 'vfx', 'art', 'steel_wall.webp')
PIX_H = 96        # 도트 높이 (D-125: 64 → 96 — 게임에서 약 190px로 보임 → 도트 한 칸 ≈ 2px, 리벳·경고 띠가 또렷하게)
UP = 2
COLORS = 32
OUTLINE = (22, 20, 28)

rgb, _ = load_clean(SRC)
rgba, main = key_out(np.asarray(rgb)[..., :3], 'magenta')
a = rgba[..., 3] > 8
ys, xs = np.nonzero(a)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
img = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1, y1)).transpose(Image.FLIP_LEFT_RIGHT)
w = round(img.width * PIX_H / img.height)
small = img.convert('RGBa').resize((w, PIX_H), Image.LANCZOS).convert('RGBA')
al = small.getchannel('A')
small = ImageEnhance.Color(ImageEnhance.Contrast(small.convert('RGB')).enhance(1.25)).enhance(1.15).convert('RGBA')   # 작게 줄이며 흐려진 면을 또렷하게
small.putalpha(al)
arr = np.array(small)
solid = arr[..., 3] > 110
# 색 줄이기 (불투명 칸만) — 중간색을 덜어 도트 그림처럼 면이 나뉘게
q = Image.fromarray(arr[..., :3]).quantize(COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
out = np.zeros((PIX_H + 2, w + 2, 4), np.uint8)   # 둘레 1px 외곽선 자리
out[1:-1, 1:-1, :3] = np.array(q)
out[1:-1, 1:-1, 3] = np.where(solid, 255, 0)
op = out[..., 3] > 0
ring = np.zeros_like(op)
for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
    ring |= np.roll(np.roll(op, dy, 0), dx, 1)
ring &= ~op
out[ring] = (*OUTLINE, 255)
pix = Image.fromarray(out, 'RGBA')
big = pix.resize((pix.width * UP, pix.height * UP), Image.NEAREST)
big.save(OUT, 'WEBP', lossless=True)
print(OUT, big.size, f'도트 {pix.size}', f'{os.path.getsize(OUT) // 1024} KB')
