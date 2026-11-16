"""
냉기 파도 시트 (D-139, 영겁의 겨울 '냉기 파도') — 해일 파도 tidal_wave(9칸: 솟음 → 말림 → 부서짐 → 물보라 → 흩어짐)를
얼음 빛깔로 다시 칠해 assets/sprites/vfx/frost_wave.webp (그림 모양·칸·알파는 그대로, 테두리 잘림 처리도 원본 그대로)

색: 밝기(0~1)를 남색 → 얼음 하늘색 → 흰 눈 띠로 옮김 (청록 물빛 → 얼음빛). 밝은 물마루·물보라는 거의 흰색이라 서리·눈보라처럼 보임.
실행: python tools/images/build_frost_wave.py
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vfx_sheet import save_webp  # noqa: E402

SRC = os.path.join('assets', 'sprites', 'vfx', 'png', 'tidal_wave.png')
OUT = os.path.join('assets', 'sprites', 'vfx', 'png', 'frost_wave.png')
# 밝기 → 색 (얼음 계열: 서리의 무희 ICE 150,220,255 · SNOW 230,245,255)
RAMP = [(0.0, (70, 135, 215)), (0.4, (135, 205, 255)), (0.65, (185, 232, 255)), (0.85, (230, 247, 255)), (1.0, (255, 255, 255))]


def ramp(t):
    xs = [p for p, _ in RAMP]
    return np.stack([np.interp(t, xs, [c[i] for _, c in RAMP]) for i in range(3)], -1)


a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
lum = (a[..., 0] * 0.3 + a[..., 1] * 0.45 + a[..., 2] * 0.25) / 255
t = np.clip((lum - 0.45) / 0.55, 0, 1)
out = a.copy()
out[..., :3] = ramp(t)
Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA').save(OUT, optimize=True)
print(OUT, out.shape[1], 'x', out.shape[0])
save_webp('frost_wave')
