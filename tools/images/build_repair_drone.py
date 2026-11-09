"""수리 드론 그림 (D-118): 방주 수호기 몸통(rig/mech/body_w.png) 어깨 포드를 떼어 드론 몸체로 쓰고,
같은 도트 크기로 뒤 덮개·회전날개·수리 노즐을 덧그림 → assets/sprites/vfx/art/repair_drone.webp
실행: python tools/images/build_repair_drone.py assets/sprites/rig/mech/body_w.png assets/sprites/vfx/art/repair_drone.webp"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
P = 4                      # 원본 그림의 도트 한 칸 ≈ 4px
OL = (18, 18, 24, 255)     # 외곽선 (원본과 같은 검정)
WHITE, WHITE2, GREY = (236, 236, 232, 255), (196, 198, 200, 255), (130, 134, 142, 255)
GOLD, GOLD2 = (226, 172, 52, 255), (170, 118, 30, 255)

im = Image.open(SRC).convert('RGBA').crop((0, 100, 250, 350))
a = np.array(im)
yy, xx = np.mgrid[0:250, 0:250]
keep = (a[:, :, 3] > 100) & ~((xx > 170) & (yy < 95)) & (xx < 222)
lab, n = ndimage.label(keep)
main = lab == (np.argmax(ndimage.sum(keep, lab, range(1, n + 1))) + 1)
a[:, :, 3] = np.where(ndimage.binary_closing(main, iterations=2) & (a[:, :, 3] > 100), a[:, :, 3], 0)
pod = Image.fromarray(a)
pod = pod.crop(pod.getbbox()).transpose(Image.FLIP_LEFT_RIGHT)      # 렌즈가 오른쪽(앞)
pw, ph = pod.width // P, pod.height // P
small = pod.resize((pw, ph), Image.BOX)

W, H = pw + 26, ph + 22
g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(g)
ox, oy = 14, 12
# 뒤 덮개 (몸통에서 뗀 평평한 면을 둥글게 닫음)
d.ellipse([ox - 10, oy + 10, ox + 14, oy + ph - 4], fill=OL)
d.ellipse([ox - 9, oy + 11, ox + 13, oy + ph - 5], fill=WHITE2)
d.ellipse([ox - 8, oy + 12, ox + 8, oy + ph - 12], fill=WHITE)
d.rectangle([ox - 6, oy + ph // 2 - 2, ox + 4, oy + ph // 2], fill=GOLD)
# 몸체
g.alpha_composite(small, (ox, oy))
# 회전날개 두 개 (기둥 + 흐린 원판)
for cx in (ox + 14, ox + pw - 14):
    col = np.array(small)[:, max(0, min(pw - 1, cx - ox)), 3]
    top = int(np.argmax(col > 100)) if (col > 100).any() else 4   # 기둥을 몸체 윗면까지 내림
    d.rectangle([cx - 1, oy - 6, cx + 1, oy + top + 1], fill=OL)
    d.rectangle([cx - 3, oy + top - 2, cx + 3, oy + top + 1], fill=GREY)
    d.rectangle([cx - 3, oy - 9, cx + 3, oy - 5], fill=OL)
    d.rectangle([cx - 2, oy - 8, cx + 2, oy - 6], fill=GOLD)
    blade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blade)
    bd.ellipse([cx - 13, oy - 10, cx + 13, oy - 4], fill=(230, 245, 255, 95), outline=(255, 255, 255, 170))
    g.alpha_composite(blade)
# 아래 수리 노즐 + 초록 렌즈
nx, ny = ox + pw // 2 + 2, oy + ph - 2
d.polygon([(nx - 5, ny - 1), (nx + 5, ny - 1), (nx + 3, ny + 5), (nx - 3, ny + 5)], fill=OL)
d.rectangle([nx - 3, ny, nx + 3, ny + 3], fill=GREY)
d.rectangle([nx - 2, ny + 4, nx + 2, ny + 6], fill=OL)
d.rectangle([nx - 1, ny + 4, nx + 1, ny + 5], fill=(140, 255, 160, 255))
# 옆 초록 십자 (수리 표시)
cx, cy = ox + 9, oy + ph // 2 + 6
d.rectangle([cx - 1, cy - 3, cx + 1, cy + 3], fill=(110, 230, 130, 255))
d.rectangle([cx - 3, cy - 1, cx + 3, cy + 1], fill=(110, 230, 130, 255))

out = g.crop(g.getbbox())
out = out.resize((out.width * P, out.height * P), Image.NEAREST)
pad = Image.new('RGBA', (out.width + 16, out.height + 16), (0, 0, 0, 0))
pad.paste(out, (8, 8))
pad.save(OUT, 'WEBP', quality=92, alpha_quality=100, method=6)
print(OUT, pad.size)
