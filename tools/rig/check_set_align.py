"""세트 그림이 기본 그림과 같은 자리·크기인지 확인 (cut_newchar_sets.py 전에): 윤곽 IoU · 바닥선 · 높이 · 나란히 놓은 그림

  python tools/rig/check_set_align.py <id> <기본 그림> <세트 그림> [미리보기 경로]
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_enemy_parts import keyed  # noqa: E402

KEY = {'diver': 'magenta', 'doll': 'magenta'}


def stats(m):
    ys, xs = np.nonzero(m)
    return ys.min(), ys.max(), xs.min(), xs.max()


def main(cid, base, setp, out=None):
    k = KEY.get(cid, 'green')
    a, b = keyed(base, k), keyed(setp, k)
    ma, mb = a[..., 3] > 0, b[..., 3] > 0
    iou = (ma & mb).sum() / max(1, (ma | mb).sum())
    ta, ba, la, ra = stats(ma)
    tb, bb, lb, rb = stats(mb)
    print(f'IoU {iou:.3f} · 바닥선 {ba} → {bb} ({bb - ba:+d}) · 위 {ta} → {tb} · 높이 {(bb - tb) / (ba - ta):.3f} · 좌우 {la}-{ra} → {lb}-{rb}')
    if out:
        can = Image.new('RGBA', (2048, 1024), (40, 44, 52, 255))
        can.alpha_composite(Image.fromarray(a), (0, 0))
        can.alpha_composite(Image.fromarray(b), (1024, 0))
        can.convert('RGB').resize((1024, 512)).save(out)
    return iou


if __name__ == '__main__':
    main(*sys.argv[1:5])
