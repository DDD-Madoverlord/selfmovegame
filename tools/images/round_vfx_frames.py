"""
시트의 일부 칸을 둥글게(타원) 옅게 (D-124 — 철거 철구 끝 흙먼지가 칸 좌우 끝까지 차 있어 직선으로 잘려 보였음)

실행: python tools/images/round_vfx_frames.py <이름> <칸들 예: 4-8> [가운데 y 비율=0.6] [안쪽 반지름=0.6] [바깥 반지름=1.0]
  → assets/sprites/vfx/png/<이름>.png 의 그 칸만, 칸 가운데(x 0.5, y=가운데)에서 타원 거리 안쪽→바깥 반지름 사이를 0 → 1로 옅게 → WebP 다시
soften_vfx_edges.py(변 하나씩 직선으로 옅게)로는 칸을 꽉 채운 구름이 세로 띠처럼 남을 때 씀. 원본 띠는 git에 있음.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vfx_sheet import save_webp  # noqa: E402

name, rng = sys.argv[1], sys.argv[2]
cy = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
r0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
r1 = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
a, b = (int(v) for v in rng.split('-'))
path = os.path.join('assets', 'sprites', 'vfx', 'png', f'{name}.png')
im = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
h = im.shape[0]
yy = (np.arange(h)[:, None] - cy * h) / (h * max(cy, 1 - cy))
xx = (np.arange(h)[None, :] - h / 2) / (h / 2)
d = np.sqrt(xx ** 2 + yy ** 2)
k = np.clip((r1 - d) / (r1 - r0), 0, 1)
k = k * k * (3 - 2 * k)
for f in range(a, b + 1):
    im[:, f * h:(f + 1) * h, 3] *= k
Image.fromarray(im.astype(np.uint8), 'RGBA').save(path, optimize=True)
print(path, f'칸 {a}~{b} 둥글게', (cy, r0, r1))
save_webp(name)
