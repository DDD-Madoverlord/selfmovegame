"""
물건 그림 시트를 캐릭터 도트 그림처럼 (D-149): 칸마다 1/F로 줄여 색을 줄이고 알파를 딱 끊은 뒤 1px 어두운 테를 두르고 F배로 키움(가장 가까운 픽셀)
→ assets/sprites/vfx/<이름>_px.webp (칸 수·크기 그대로, 그릴 때 blend 'normal')

실행: python tools/images/pixelate_sheet.py arch_set 8 4 [색 수]
  arch_set 8칸을 4배 도트로 (256px 칸 → 64칸 도트 → 256). 철거의 설계자 삽날 방패가 너무 고운 그림이라 캐릭터 도트와 어울리게 (11-18 피드백)
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vfx_sheet import save_webp  # noqa: E402

NAME, N, F = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
COLORS = int(sys.argv[4]) if len(sys.argv) > 4 else 20
src = Image.open(os.path.join('assets', 'sprites', 'vfx', 'png', f'{NAME}.png')).convert('RGBA')
fw, fh = src.width // N, src.height
out = Image.new('RGBA', src.size, (0, 0, 0, 0))
for i in range(N):
    cell = src.crop((i * fw, 0, (i + 1) * fw, fh))
    small = cell.resize((fw // F, fh // F), Image.LANCZOS)
    a = np.array(small)
    solid = a[..., 3] > 110
    rgb = Image.fromarray(a[..., :3]).quantize(COLORS, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    rgb = np.array(rgb)
    # 1px 어두운 테: 칸 안 물건 바로 바깥 픽셀을 물건 가장자리 색의 어두운 판으로
    pad = np.pad(solid, 1)
    near = (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]) & ~solid
    edge_col = np.array([40, 28, 22], np.uint8)
    res = np.zeros((*solid.shape, 4), np.uint8)
    res[solid, :3] = rgb[solid]
    res[solid, 3] = 255
    res[near, :3] = edge_col
    res[near, 3] = 255
    big = Image.fromarray(res, 'RGBA').resize((fw, fh), Image.NEAREST)
    out.paste(big, (i * fw, 0))
dst = os.path.join('assets', 'sprites', 'vfx', 'png', f'{NAME}_px.png')
out.save(dst, optimize=True)
print(dst, out.size)
save_webp(f'{NAME}_px')
