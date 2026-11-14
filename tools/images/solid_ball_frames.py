"""
철거 철구 쇠공을 불투명하게 (D-125): 이펙트 시트는 알파 = 밝기라 쇠공의 검은 줄무늬·그늘이 투명해져, 굴러갈 때 배경·캐릭터가 공 너머로 비쳤음
→ 쇠공이 있는 칸(1~3)의 공 원(BALL — 시트에서 잰 값) 안은 Gemini 원본 색 그대로·알파 255로 칠함(가장자리 1.5px 부드럽게).
원 밖(불꽃·먼지)은 그대로. 게임은 이 칸들을 보통 섞기(blend normal)로 그림 (mechSets2.js WRECK_RIDE).

실행: python tools/images/solid_ball_frames.py   (png/wrecking_ball.png는 build_vfx_sheet.py 결과 → round_vfx_frames.py 4-8 → 이 스크립트 순서)
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vfx_sheet import INSET, save_webp  # noqa: E402
from unlogo import load_clean  # noqa: E402

NAME, N, SIZE = 'wrecking_ball', 3, 256
# 칸별 공 원 (칸 좌표 중심 x, y, 반지름) — 시트 알파에서 공 테두리를 재어 정함 (자동 찾기는 불꽃·꼬리까지 묶여 어긋났음)
BALL = {1: (165, 142, 64), 2: (166, 144, 64), 3: (149, 139, 64)}
FRAMES = tuple(BALL)
SRC = os.path.join('assets', 'sprites', 'vfx', 'src', f'{NAME}_raw.png')
PNG = os.path.join('assets', 'sprites', 'vfx', 'png', f'{NAME}.png')

rgb, _ = load_clean(SRC)
h, w = rgb.shape[:2]
sheet = np.array(Image.open(PNG).convert('RGBA')).astype(np.float32)
for f in FRAMES:
    r, c = divmod(f, N)
    x0, x1 = round(w * c / N) + INSET, round(w * (c + 1) / N) - INSET
    y0, y1 = round(h * r / N) + INSET, round(h * (r + 1) / N) - INSET
    cell = np.array(Image.fromarray(rgb[y0:y1, x0:x1]).resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32)
    fr = sheet[:, f * SIZE:(f + 1) * SIZE]
    cx, cy, rad = BALL[f]
    yy, xx = np.mgrid[:SIZE, :SIZE]
    k = np.clip((rad - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)) / 1.5, 0, 1)[..., None]
    fr[..., :3] = fr[..., :3] * (1 - k) + cell * k
    fr[..., 3] = np.maximum(fr[..., 3], k[..., 0] * 255)
    sheet[:, f * SIZE:(f + 1) * SIZE] = fr
    print(f'칸 {f}: 공 중심 ({cx:.0f}, {cy:.0f}) 반지름 {rad:.0f}')
Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8), 'RGBA').save(PNG, optimize=True)
save_webp(NAME)
