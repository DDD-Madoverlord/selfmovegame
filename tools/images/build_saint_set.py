"""
봉합 성녀 물건 그림 묶음 (Gemini 한 장 3×2칸) → 6칸 가로 띠 assets/sprites/vfx/<이름>.webp

saint_set (D-127): 0 금종 · 1 촛불(금 촛대) · 2 초록 약병 · 3 붉은 실 고치 · 4 재봉 바늘(오른쪽 아래를 향함, 붉은 실) · 5 대리석 손(손바닥 아래, 손가락 오른쪽)
saint_set2 (D-128): 0 붉은 나비(오른쪽으로 남) · 1 금빛 바늘(아래를 향함) · 2 장미 넝쿨 덤불(바닥이 평평) · 3 큰 진홍 장미 · 4 금 가위(벌어짐) · 5 금실 천 리본(가로)
실행: python tools/images/build_saint_set.py [saint_set2]   (원본 src/<이름>_raw.png 1200×896, 칸 사이 회색 격자선은 안쪽으로 들여 잘라 지움)

빛 이펙트 시트(알파 = 밝기, 'lighter')와 달리 단단한 물건이라 **불투명**하게 뽑음: 검은 배경 문턱 위는 곧 불투명(알파 = (밝기 - 문턱) / 폭),
둘레 은은한 빛 번짐만 반투명. 그릴 때 blend 'normal' (철구가 반투명해 보이던 일, D-125와 같은 까닭).
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402
from build_vfx_sheet import save_webp  # noqa: E402

NAME = sys.argv[1] if len(sys.argv) > 1 else 'saint_set'
COLS, ROWS, SIZE, INSET, FADE = 3, 2, 256, 8, 14
FLOOR, RAMP = 34.0, 40.0   # 검은 배경 문턱·불투명해지는 폭 (밝기 0~255)
rgb, _ = load_clean(os.path.join('assets', 'sprites', 'vfx', 'src', f'{NAME}_raw.png'))
h, w = rgb.shape[:2]
frames = []
for r in range(ROWS):
    for c in range(COLS):
        x0, x1 = round(w * c / COLS) + INSET, round(w * (c + 1) / COLS) - INSET
        y0, y1 = round(h * r / ROWS) + INSET, round(h * (r + 1) / ROWS) - INSET
        cell = rgb[y0:y1, x0:x1].astype(np.float32)
        a = np.clip((cell.max(axis=2) - FLOOR) / RAMP, 0, 1)
        a = a * a * (3 - 2 * a)
        ch, cw = a.shape
        yy = np.minimum(np.arange(ch), np.arange(ch)[::-1])[:, None]
        xx = np.minimum(np.arange(cw), np.arange(cw)[::-1])[None, :]
        ramp = np.clip(np.minimum(yy, xx) / FADE, 0, 1)
        a *= ramp * ramp * (3 - 2 * ramp)
        # 반투명 가장자리(빛 번짐)는 검은 배경과 섞여 어두운 색 → 색조는 두고 밝기를 160까지 올림 (밝은 배경 위에서 검은 테로 보이지 않게)
        mx = np.maximum(cell.max(axis=2, keepdims=True), 1)
        lift = 1 + (1 - a[..., None]) * (np.maximum(1, 160 / mx) - 1)
        col = np.where(a[..., None] > 0.02, np.minimum(cell * lift, 255), 0)
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
