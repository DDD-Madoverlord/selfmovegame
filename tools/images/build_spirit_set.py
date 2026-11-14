"""
영혼 동물·작살·닻 그림 묶음 (D-126, 2026-11-14 Gemini 한 장 3×2칸) → 6칸 가로 띠 assets/sprites/vfx/spirit_set.webp

칸 순서 (0부터): 0 독수리(오른쪽 아래로 내리꽂음) · 1 곰 · 2 뱀 · 3 늑대 (모두 금빛 영혼, 오른쪽을 봄) · 4 별똥 작살(아래를 향함, 보라) · 5 물 닻(청록)
실행: python tools/images/build_spirit_set.py   (원본 src/spirit_set_raw.png 1200×896, 칸 사이 회색 격자선은 안쪽으로 들여 잘라 지움)
알파 = 밝기 (다른 이펙트 시트와 같이 'lighter'로 겹쳐 그림). 칸이 가로로 길어 정사각 256칸 가운데에 비율 그대로 놓음.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402
from build_vfx_sheet import save_webp  # noqa: E402

NAME, COLS, ROWS, SIZE, INSET, FADE = 'spirit_set', 3, 2, 256, 8, 14
rgb, _ = load_clean(os.path.join('assets', 'sprites', 'vfx', 'src', f'{NAME}_raw.png'))
h, w = rgb.shape[:2]
frames = []
for r in range(ROWS):
    for c in range(COLS):
        x0, x1 = round(w * c / COLS) + INSET, round(w * (c + 1) / COLS) - INSET
        y0, y1 = round(h * r / ROWS) + INSET, round(h * (r + 1) / ROWS) - INSET
        cell = rgb[y0:y1, x0:x1].astype(np.float32)
        a = cell.max(axis=2)
        floor = max(10.0, float(np.percentile(a, 40)) + 8)
        a = np.clip((a - floor) / (255 - floor), 0, 1)
        ch, cw = a.shape
        yy = np.minimum(np.arange(ch), np.arange(ch)[::-1])[:, None]
        xx = np.minimum(np.arange(cw), np.arange(cw)[::-1])[None, :]
        ramp = np.clip(np.minimum(yy, xx) / FADE, 0, 1)
        a *= ramp * ramp * (3 - 2 * ramp)
        col = np.where(a[..., None] > 0, cell / np.maximum(a[..., None] * 255, 1) * 255, 0)
        im = Image.fromarray(np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8), 'RGBA')
        k = SIZE / max(cw, ch)
        im = im.resize((round(cw * k), round(ch * k)), Image.LANCZOS)
        sq = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        sq.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
        frames.append(sq)
strip = Image.new('RGBA', (SIZE * len(frames), SIZE), (0, 0, 0, 0))
for i, f in enumerate(frames):
    strip.paste(f, (i * SIZE, 0))
out = os.path.join('assets', 'sprites', 'vfx', 'png', f'{NAME}.png')
strip.save(out, optimize=True)
print(out, strip.size)
save_webp(NAME)
