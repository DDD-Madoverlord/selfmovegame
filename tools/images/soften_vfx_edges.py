"""
잘린 이펙트 시트의 잘린 변만 넓게 옅게 (11-05 피드백 20번 — '스킬 연출 이미지가 잘려 보이는 것')

실행: python tools/images/soften_vfx_edges.py [--dry 비교그림.png] <이름> <변:폭> [<변:폭> …] [, <이름> …]
  예) python tools/images/soften_vfx_edges.py breath_gold right:72 , dome_gold left:48 right:48
  → assets/sprites/vfx/png/<이름>.png의 9칸마다 그 변에서 폭(px, 칸 256 기준)만큼 알파를 0 → 1로 부드럽게 올림 → WebP 다시 만듦
  --dry: 파일은 그대로 두고 전·후 비교 그림만

왜: Gemini 3×3 시트는 그림이 칸 경계를 넘어 그려질 때가 있어(숨결 끝·버섯구름 위·장막 양옆), 칸으로 자르면 직선으로 잘림.
다시 그려 달라고 해도(11-05 시험) 칸 안에 넣어 주지 않아서, 잘린 변만 넓게 옅게 해 '불꽃·연기가 흩어지는' 모양으로 바꿈.
어느 변이 잘렸는지는 check_vfx_edges.py 표를 봄. 원본 띠는 git에 있음.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vfx_sheet import save_webp  # noqa: E402

VFX_PNG = os.path.join('assets', 'sprites', 'vfx', 'png')
FRAMES = 9


def soften(strip, sides):
    a = strip.copy()
    size = a.shape[1] // FRAMES
    y = np.arange(size)[:, None].astype(np.float32)
    x = np.arange(size)[None, :].astype(np.float32)
    ramp = np.ones((size, size), np.float32)
    d = {'top': y + 0 * x, 'bottom': (size - 1 - y) + 0 * x, 'left': x + 0 * y, 'right': (size - 1 - x) + 0 * y}
    for side, width in sides.items():
        r = np.clip(d[side] / width, 0, 1)
        ramp = np.minimum(ramp, r * r * (3 - 2 * r))
    for i in range(FRAMES):
        cell = a[:, i * size:(i + 1) * size, 3].astype(np.float32)
        a[:, i * size:(i + 1) * size, 3] = (cell * ramp).astype(np.uint8)
    return a


def parse(args):
    jobs, cur = [], None
    for t in args:
        if t == ',':
            cur = None
        elif ':' in t:
            s, w = t.split(':')
            cur[1][s] = float(w)
        else:
            cur = (t, {})
            jobs.append(cur)
    return jobs


def compare(jobs, path):
    rows = []
    for name, sides in jobs:
        src = np.asarray(Image.open(os.path.join(VFX_PNG, f'{name}.png')).convert('RGBA'))
        rows += [src, soften(src, sides)]
    h, w = rows[0].shape[:2]
    sheet = Image.new('RGBA', (w // 2, len(rows) * (h // 2 + 6)), (16, 18, 24, 255))
    for i, r in enumerate(rows):
        bg = Image.new('RGBA', (w, h), (40, 44, 56, 255))
        bg.alpha_composite(Image.fromarray(np.ascontiguousarray(r)))
        sheet.alpha_composite(bg.resize((w // 2, h // 2)), (0, i * (h // 2 + 6)))
    sheet.convert('RGB').save(path, quality=88)
    print('비교 그림 (위 = 지금, 아래 = 옅게):', path)


def main():
    args = sys.argv[1:]
    dry = None
    if args[:1] == ['--dry']:
        dry, args = args[1], args[2:]
    jobs = parse(args)
    if dry:
        compare(jobs, dry)
        return
    for name, sides in jobs:
        p = os.path.join(VFX_PNG, f'{name}.png')
        out = soften(np.asarray(Image.open(p).convert('RGBA')), sides)
        Image.fromarray(np.ascontiguousarray(out), 'RGBA').save(p, optimize=True)
        print(p, sides)
        save_webp(name)


if __name__ == '__main__':
    main()
