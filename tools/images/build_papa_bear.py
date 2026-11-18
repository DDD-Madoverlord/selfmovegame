"""
아빠 곰 소환물 그림 (D-147, 영원한 가족 필살기 '아빠 곰' — 예전엔 토끼 인형 그림을 2.2배로 키워 갈색을 입힌 것이라 곰으로 안 보였음)
Gemini 한 장(누더기 곰 인형 3칸: 0 걷기 · 1 두 앞발을 머리 위로 · 2 두 앞발로 바닥을 내리침 + 솜 터짐)
  → assets/sprites/rig/papa_bear/papa_bear_{walk,attack}.webp

  walk   16칸: 뒤뚱뒤뚱 — 한 주기에 두 번 내려앉으며 좌우로 기욺
  attack 14칸: 앞발을 들어 올림(0~5, 1칸 자세) → 내리침(6~9, 2칸 자세, 6이 닿는 순간 — kit.js slam at 0.43) → 걷기 자세로(10~13)
틀 300×300, 발 자리 anchorX 150. 소환물 CSS가 좌우를 뒤집으니 왼쪽을 보게 구움. 알파는 밝기로
실행: python tools/images/build_papa_bear.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402

FW, FH, BODY = 300, 300, 250
OUT = os.path.join('assets', 'sprites', 'rig', 'papa_bear')
rgb, _ = load_clean(os.path.join('assets', 'sprites', 'vfx', 'src', 'papa_bear_raw.png'))
h, w = rgb.shape[:2]


def cut(c):
    cell = rgb[10:h - 10, round(w * c / 3) + 10:round(w * (c + 1) / 3) - 10].astype(np.float32)
    lum = cell.max(axis=2)
    a = np.clip((lum - 22) / 50, 0, 1)
    a = a * a * (3 - 2 * a)
    mx = np.maximum(lum[..., None], 1)
    lift = 1 + (1 - a[..., None]) * (np.maximum(1, 150 / mx) - 1)
    col = np.where(a[..., None] > 0.02, np.minimum(cell * lift, 255), 0)
    im = Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), 'RGBA')
    ys, xs = np.nonzero(a > 0.5)
    return im, (xs.min(), ys.min(), xs.max(), ys.max())


poses = [cut(0), cut(1), cut(2)]
# 걷기 자세 키가 BODY — 다른 자세도 같은 배율. 앞발 든 자세(더 큼)가 틀 위로 잘리지 않게 그 키가 FH - 22 안으로 (끝부분 잘림 방지)
k = min(BODY / (poses[0][1][3] - poses[0][1][1]), (FH - 22) / ((poses[1][1][3] - poses[1][1][1]) * 1.04))


def place(pose, dy=0.0, ang=0.0, sx=1.0, sy=1.0, dx=0.0, bright=1.0):
    im, (x0, y0, x1, y1) = poses[pose]
    im = im.resize((round(im.width * k * sx), round(im.height * k * sy)), Image.LANCZOS)
    fx, fb = (x0 + x1) / 2 * k * sx, y1 * k * sy
    if bright != 1.0:
        r, g, b, al = im.split()
        im = Image.merge('RGBA', (*ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(bright).split(), al))
    f = Image.new('RGBA', (FW * 2, FH * 2), (0, 0, 0, 0))
    f.alpha_composite(im, (round(FW - fx + dx), round(FH * 2 - 6 - fb + dy)))
    if ang:
        f = f.rotate(ang, resample=Image.BICUBIC, center=(FW, FH * 2 - 6))
    return f.crop((FW // 2, FH, FW // 2 + FW, FH * 2))


def mix(a, b, u):
    A, B = (np.asarray(x).astype(np.float32) / 255 for x in (a, b))
    al = A[..., 3:] * (1 - u) + B[..., 3:] * u
    col = (A[..., :3] * A[..., 3:] * (1 - u) + B[..., :3] * B[..., 3:] * u) / np.maximum(al, 1e-4)
    return Image.fromarray((np.dstack([col, al]) * 255).round().clip(0, 255).astype(np.uint8), 'RGBA')


def strip(frames, name):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f.transpose(Image.FLIP_LEFT_RIGHT), (i * FW, 0))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f'papa_bear_{name}.webp')
    s.save(p, 'WEBP', quality=90, method=6)
    print(p, s.size, os.path.getsize(p) // 1024, 'KB')


walk = []
for i in range(16):
    u = i / 16
    bob = abs(math.sin(u * 2 * math.pi))
    walk.append(place(0, dy=-7 * bob, ang=4 * math.sin(u * 2 * math.pi), sy=1 - 0.03 * (1 - bob), sx=1 + 0.02 * (1 - bob)))
atk = []
for i in range(6):           # 앞발을 들어 올림
    u = i / 5
    atk.append(mix(place(0), place(1, dy=-4 * u, ang=4 * u), min(1, u * 2.5)) if u < 0.4 else place(1, dy=-4 * u, ang=4 * u, sy=1 + 0.03 * u, bright=1 + 0.08 * u))
atk.append(place(2, dy=4, sx=1.07, sy=0.92, dx=4, bright=1.2))       # 6 쾅
atk.append(place(2, dy=2, sx=1.03, sy=0.97, dx=3, bright=1.08))      # 7
atk.append(place(2, dx=2))                                            # 8
atk.append(place(2, dx=2))                                            # 9
for u in (0.25, 0.5, 0.75, 1.0):                                      # 10~13 일어남
    atk.append(mix(place(2, dy=-3 * u), place(0), u))
strip(walk, 'walk')
strip(atk, 'attack')
