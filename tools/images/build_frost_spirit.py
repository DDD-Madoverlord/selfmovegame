"""
서리 정령 소환물 그림 (D-137 보완, 2026-11-16 — 예전엔 외눈 괴물 oculus 그림에 얼음 색만 입혀 기괴했음)
Gemini 한 장(떠 있는 눈 요정 정령, 오른쪽을 봄) → assets/sprites/rig/frost_spirit/frost_spirit_{walk,attack}.webp

  walk  16칸: 둥실 떠다님 — 위아래로 오르내리고 살짝 기울며 빛이 숨 쉬듯 밝아졌다 어두워짐
  attack 12칸: 앞으로 몸을 숙여 얼음 조각을 내밀며 빛이 번쩍
틀 180×190, 발(꼬리 끝) 자리 anchorX 90, 왼쪽을 보게 구움(소환물 CSS가 좌우를 뒤집어 오른쪽을 봄) — 바닥에서 14px 떠 있음. 알파는 밝기로(가장자리 빛 번짐은 반투명 — 정령 느낌)
실행: python tools/images/build_frost_spirit.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402

FW, FH, BODY, LIFT = 180, 190, 160, 14
OUT = os.path.join('assets', 'sprites', 'rig', 'frost_spirit')

rgb, _ = load_clean(os.path.join('assets', 'sprites', 'vfx', 'src', 'frost_spirit_raw.png'))
c = rgb.astype(np.float32)
lum = c.max(axis=2)
a = np.clip((lum - 16) / 70, 0, 1)
a = a * a * (3 - 2 * a)
mx = np.maximum(lum[..., None], 1)
lift = 1 + (1 - a[..., None]) * (np.maximum(1, 170 / mx) - 1)   # 반투명 가장자리 밝기 되살림 (어두운 테 방지)
col = np.where(a[..., None] > 0.02, np.minimum(c * lift, 255), 0)
src = Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), 'RGBA')
ys, xs = np.nonzero(a > 0.08)
src = src.crop((xs.min() - 6, ys.min() - 6, xs.max() + 7, ys.max() + 7))
k = BODY / max(src.size)
src = src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)


def frame(dy=0.0, ang=0.0, dx=0.0, bright=1.0, scale=1.0):
    im = src
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if bright != 1.0:
        r, g, b, al = im.split()
        im = Image.merge('RGBA', (*ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(bright).split(), al))
    if ang:
        im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
    f = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    x = round(FW / 2 - im.width / 2 + dx)
    y = round(FH - LIFT - im.height + dy)
    f.alpha_composite(im, (max(0, x), max(0, y)))
    return f


def strip(frames, name):
    # 소환물 그림은 적 그림을 빌려 쓰는 틀이라 CSS가 좌우를 뒤집음(scaleX(-1), 적은 왼쪽을 봄) → 왼쪽을 보게 구워 둠
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f.transpose(Image.FLIP_LEFT_RIGHT), (i * FW, 0))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f'frost_spirit_{name}.webp')
    s.save(p, 'WEBP', quality=90, method=6)
    print(p, s.size, os.path.getsize(p) // 1024, 'KB')


walk = [frame(dy=-6 * math.sin(i / 16 * 2 * math.pi), ang=2.5 * math.sin(i / 16 * 2 * math.pi + 1),
              bright=1 + 0.08 * math.sin(i / 16 * 4 * math.pi)) for i in range(16)]
atk = []
for i in range(12):
    u = i / 12
    lean = math.sin(min(1, u / 0.45) * math.pi / 2) if u < 0.45 else math.cos((u - 0.45) / 0.55 * math.pi / 2)
    atk.append(frame(dy=-4 * lean, ang=-12 * lean, dx=10 * lean, bright=1 + 0.35 * lean, scale=1 + 0.05 * lean))
strip(walk, 'walk')
strip(atk, 'attack')
