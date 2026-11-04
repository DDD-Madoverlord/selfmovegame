"""스테이지 지도 그림 (시안 Q-022, 2026-11-04): Gemini 지도 원본 → assets/sprites/stage/map/zone<N>.webp

  python tools/images/build_map_art.py          # 원본이 있는 구역 전부
  python tools/images/build_map_art.py --grid   # + 좌표 격자 그림(_out/map_grid_zone<N>.png) — 정거장 좌표(stageMap_v2.js MAP_ROUTES) 잴 때

원본: assets/sprites/stage/map/src/zone<N>_gemini.png (Gemini 웹 '이미지 복사', 1024×572).
로고는 unlogo.py로 지우고, 그래도 남는 별 테두리(1024×572 기준 가운데 933,482)는 주변 색으로 메움.
"""
import argparse
import glob
import os
import re

import cv2
import numpy as np
from PIL import Image, ImageDraw

from unlogo import load_clean

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'stage', 'map', 'src')
DST = os.path.join(ROOT, 'assets', 'sprites', 'stage', 'map')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out')
STAR = (933, 482, 26)   # 1024×572 복사 그림의 로고 별 (가운데 x, y, 반지름)


def unstar(rgb):
    h, w = rgb.shape[:2]
    x, y, r = (round(v * w / 1024) for v in STAR)
    mask = np.zeros((h, w), np.uint8)
    cv2.circle(mask, (x, y), r, 255, -1)
    return cv2.inpaint(rgb, mask, 7, cv2.INPAINT_TELEA)


def grid(im, path):
    g = im.copy()
    d = ImageDraw.Draw(g)
    for x in range(0, g.width, 50):
        d.line([(x, 0), (x, g.height)], fill=(0, 255, 0) if x % 100 == 0 else (0, 110, 0))
        d.text((x + 2, 2), str(x), fill=(255, 255, 0))
    for y in range(0, g.height, 50):
        d.line([(0, y), (g.width, y)], fill=(0, 255, 0) if y % 100 == 0 else (0, 110, 0))
        d.text((2, y + 2), str(y), fill=(255, 255, 0))
    g.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--grid', action='store_true')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for src in sorted(glob.glob(os.path.join(SRC, 'zone*_gemini.png'))):
        n = re.search(r'zone(\d+)_', os.path.basename(src)).group(1)
        rgb, _ = load_clean(src)
        im = Image.fromarray(unstar(np.ascontiguousarray(rgb)))
        dst = os.path.join(DST, f'zone{n}.webp')
        im.save(dst, quality=90, method=6)
        print(f'zone{n}: {im.size} → {os.path.relpath(dst, ROOT)} ({os.path.getsize(dst) // 1024}KB)')
        if args.grid:
            grid(im, os.path.join(OUT, f'map_grid_zone{n}.png'))


if __name__ == '__main__':
    main()
