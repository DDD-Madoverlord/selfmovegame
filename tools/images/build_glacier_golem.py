"""
빙하 거인 소환물 그림 (D-137 보완, 2026-11-16 — 예전엔 기사 그림 guardian에 얼음 색만 입혀 "일반 기사"처럼 보였음)
Gemini 한 장(빙하 얼음 거인 전신 2칸: 0 걷기 · 1 두 주먹을 머리 위로) → assets/sprites/rig/glacier_golem/glacier_golem_{walk,attack}.webp

  walk   16칸: 무겁게 쿵쿵 걸음 — 한 주기에 두 번 내려앉으며(쿵) 몸이 좌우로 살짝 기욺
  attack 14칸 (D-140 — 예전엔 내려칠 때 걷기 자세를 기울이기만 해 바닥을 치는 모습이 아니었음):
         두 주먹 깍지 끼고 들어 올림(0~5, 뒤로 젖히며 커짐) → 휘두름(6) → 두 주먹이 바닥에 박힘(7~10, 7이 닿는 순간 —
         kit.js slam at 0.5) → 걷기 자세로 돌아옴(11~13, 겹쳐 바뀜)
  내려치기 두 자세는 Gemini 한 장 더(src/glacier_golem_slam_raw.png: 0 깍지 낀 두 주먹을 머리 위로 · 1 두 주먹이 바닥에) —
  처음 그림과 색 평균·대비를 맞추고, 깍지 자세 키가 처음 그림의 주먹 든 자세 키와 같게 줄임
틀 300×300, 발 자리 anchorX 150. 소환물 CSS가 좌우를 뒤집으니 왼쪽을 보게 구움. 알파는 밝기로(서리 안개는 반투명)
실행: python tools/images/build_glacier_golem.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402

FW, FH, BODY = 300, 300, 270
OUT = os.path.join('assets', 'sprites', 'rig', 'glacier_golem')

SRC = os.path.join('assets', 'sprites', 'vfx', 'src')
RGB = {n: load_clean(os.path.join(SRC, f'{n}.png'))[0] for n in ('glacier_golem_raw', 'glacier_golem_slam_raw')}


def cut(c, name='glacier_golem_raw', match=None):
    rgb = RGB[name]
    h, w = rgb.shape[:2]
    cell = rgb[8:h - 8, round(w * c / 2) + 8:round(w * (c + 1) / 2) - 8].astype(np.float32)
    if match is not None:   # 색 맞춤: 몸통 픽셀의 채널별 평균·표준편차를 처음 그림에 맞춤
        m = cell.max(axis=2) > 60
        mu, sd = cell[m].mean(0), cell[m].std(0) + 1e-3
        cell = np.where(m[..., None] | (cell.max(axis=2, keepdims=True) > 18),
                        np.clip((cell - mu) / sd * match[1] + match[0], 0, 255), cell)
    lum = cell.max(axis=2)
    a = np.clip((lum - 18) / 60, 0, 1)
    a = a * a * (3 - 2 * a)
    mx = np.maximum(lum[..., None], 1)
    lift = 1 + (1 - a[..., None]) * (np.maximum(1, 160 / mx) - 1)
    col = np.where(a[..., None] > 0.02, np.minimum(cell * lift, 255), 0)
    im = Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), 'RGBA')
    solid = a > 0.5   # 몸통(안개 빼고)으로 키·발 자리를 잼
    ys, xs = np.nonzero(solid)
    return im, (xs.min(), ys.min(), xs.max(), ys.max())


def body_stats(name, c):
    rgb = RGB[name]
    h, w = rgb.shape[:2]
    cell = rgb[8:h - 8, round(w * c / 2) + 8:round(w * (c + 1) / 2) - 8].astype(np.float32)
    m = cell.max(axis=2) > 60
    return cell[m].mean(0), cell[m].std(0)


ref = body_stats('glacier_golem_raw', 0)
poses = [cut(0), cut(1), cut(0, 'glacier_golem_slam_raw', ref), cut(1, 'glacier_golem_slam_raw', ref)]
k = BODY / max(b[3] - b[1] for _, b in poses[:2])   # 처음 두 자세 같은 배율 (키가 큰 쪽이 BODY)
k2 = 0.9 * k * (poses[1][1][3] - poses[1][1][1]) / (poses[2][1][3] - poses[2][1][1])   # 내려치기 그림: 주먹 든 키를 맞춤 (들어 올리며 커지는 몫 10% 남김)
SCALE = [k, k, k2, k2]


def place(pose, dy=0.0, ang=0.0, sx=1.0, sy=1.0, dx=0.0, bright=1.0):
    im, (x0, y0, x1, y1) = poses[pose]
    kk = SCALE[pose]
    im = im.resize((round(im.width * kk * sx), round(im.height * kk * sy)), Image.LANCZOS)
    fx, fb = (x0 + x1) / 2 * kk * sx, y1 * kk * sy   # 몸 가운데 x · 발바닥 y
    if bright != 1.0:
        r, g, b, al = im.split()
        im = Image.merge('RGBA', (*ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(bright).split(), al))
    f = Image.new('RGBA', (FW * 2, FH * 2), (0, 0, 0, 0))
    f.alpha_composite(im, (round(FW - fx + dx), round(FH * 2 - 6 - fb + dy)))
    if ang:
        f = f.rotate(ang, resample=Image.BICUBIC, center=(FW, FH * 2 - 6))
    return f.crop((FW // 2, FH, FW // 2 + FW, FH * 2))


def strip(frames, name):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f.transpose(Image.FLIP_LEFT_RIGHT), (i * FW, 0))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f'glacier_golem_{name}.webp')
    s.save(p, 'WEBP', quality=90, method=6)
    print(p, s.size, os.path.getsize(p) // 1024, 'KB')


walk = []
for i in range(16):
    u = i / 16
    stomp = abs(math.sin(u * 2 * math.pi))          # 한 주기에 두 번 쿵
    walk.append(place(0, dy=-5 * stomp, ang=2.2 * math.sin(u * 2 * math.pi), sy=1 - 0.025 * (1 - stomp), sx=1 + 0.012 * (1 - stomp)))
def mix(a, b, u):
    """두 칸을 겹쳐 바꿈 (알파를 곱한 채로 섞어야 투명 가장자리가 검게 번지지 않음)"""
    A, B = (np.asarray(x).astype(np.float32) / 255 for x in (a, b))
    al = A[..., 3:] * (1 - u) + B[..., 3:] * u
    col = (A[..., :3] * A[..., 3:] * (1 - u) + B[..., :3] * B[..., 3:] * u) / np.maximum(al, 1e-4)
    return Image.fromarray((np.dstack([col, al]) * 255).round().clip(0, 255).astype(np.uint8), 'RGBA')


atk = []
for i in range(6):     # 깍지 낀 두 주먹을 들어 올림 (뒤로 젖히며 커짐)
    u = i / 5
    atk.append(place(2, dy=-5 * u, ang=5 * u, sx=1 + 0.03 * u, sy=1 + 0.04 * u, bright=1 + 0.12 * u))
atk.append(place(2, dy=-2, ang=-10, sx=1.03, sy=1.0, dx=-6, bright=1.15))            # 6 휘두름 (앞으로 숙임)
atk.append(place(3, dy=3, sx=1.06, sy=0.93, dx=6, bright=1.3))                      # 7 쾅 (바닥에 닿는 순간, 납작)
atk.append(place(3, dy=1, sx=1.03, sy=0.97, dx=4, bright=1.15))                     # 8
atk.append(place(3, sx=1.0, sy=1.0, dx=2))                                         # 9
atk.append(place(3, sx=1.0, sy=1.0, dx=2))                                         # 10 (주먹을 박은 채)
atk.append(place(3, dy=-3, sy=1.02, dx=1))                                          # 11 몸을 일으킴
for u in (0.5, 1.0):                                                               # 12~13 걷기 자세로 돌아옴
    atk.append(mix(place(3, dy=-5, sy=1.03), place(0, dy=3 * (1 - u)), u))
strip(walk, 'walk')
strip(atk, 'attack')
