"""
봉합성녀 세트 그림 나누기 손질 (D-121, 2026-11-11 피드백) — cut_newchar_sets.py saint u l m 다음에 실행

실행: 프로젝트 루트에서  python tools/rig/cut_newchar_sets.py saint u l m && python tools/rig/saint_set_fix.py
  → assets/sprites/rig/saint/{head,torso,armB}_<글자>.png + rig.json 자리·크기

왜
 - 천 개의 실 날개(u)·운명의 직조자(l): 기본 머리 다각형이 넓어(x 238~685) 머리 양옆으로 펼친 날개가 머리 조각에 들어감
   → 고개를 까딱이면 날개가 같이 흔들리고, 이 머리를 다른 몸통에 끼우면 날개가 따라감. 머리 핵심(후광·왕관·두건·머리카락)
   다각형 HEAD_CORE 밖은 몸통으로 옮김
 - 진홍 장미 성녀(m): 팔 없는 그림에서 뒷팔 소매와 손에 든 장미 두 송이가 지워지지 않아(팔 = 차이) 뒷팔 조각엔 줄기·손만,
   장미는 머리·몸통, 소매는 몸통에 붙어 있었음 → 뒷팔(소매 + 손 + 줄기 + 장미 두 송이)을 ARM_B 다각형으로 다시 모음.
   어깨 맨살·목둘레 잎은 몸통에 남김 (소매는 드레스 옆에 따로 늘어져 있어 몸통에 칠할 구멍은 없음 — 칠했던 번진 덩어리는 뺌, 11-11 저녁).
   몸통 윗변에 남은 머리카락 줄은 머리로, 떨어진 부스러기는 지움
좌표는 세트 원본 그림 기준 — 리그 칸과의 어긋남(dx, dy)은 조각들을 합친 그림과 맞춰 구함
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cut_newchar_parts import load, CHARS  # noqa: E402

OUT = 'assets/sprites/rig/saint'
SRC = 'assets/sprites/parts/saint/src/saint_set_{}_gemini.png'
S = 1024
HEAD_CORE = {
    'u': [(330, 165), (598, 165), (606, 290), (594, 340), (590, 470), (570, 508), (336, 508), (334, 470), (341, 380), (332, 330), (330, 280)],
    'l': [(340, 175), (645, 175), (636, 296), (594, 326), (593, 470), (585, 508), (440, 508), (415, 488), (384, 450), (378, 330), (340, 300)],
}
# 뒷팔 영역: 장미 두 송이 + 줄기 + 손 + 소매(어깨 리본 위끝까지). 어깨 맨살·목둘레 잎은 이 안에 걸쳐도 몸통에 둠 (rose_arm)
ARM_B = {'m': [(175, 428), (312, 428), (330, 504), (372, 504), (390, 506), (403, 513), (414, 540), (420, 556), (412, 574),
               (396, 602), (372, 632), (346, 642), (318, 668), (306, 756), (172, 756), (172, 640), (226, 600), (212, 560), (176, 500)]}


def poly(pts, dx=0, dy=0):
    im = Image.new('L', (S, S), 0)
    ImageDraw.Draw(im).polygon([(x + dx, y + dy) for x, y in pts], fill=255)
    return np.asarray(im) > 0


def load_part(parts, name):
    full = np.zeros((S, S, 4), np.uint8)
    p = parts[name]
    full[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']] = np.asarray(Image.open(os.path.join(OUT, p['src'])).convert('RGBA'))
    return full


def save_part(parts, name, full):
    a = full[..., 3] > 0
    if not a.any():
        raise SystemExit(f'{name}: 비었음')
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(full[y0:y1, x0:x1]).save(os.path.join(OUT, f'{name}.png'))
    parts[name] = {**parts.get(name, {}), 'src': f'{name}.png', 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def offset(parts, v):
    """세트 원본 → 리그 칸 어긋남 (조각을 합친 윤곽과 가장 많이 겹치는 dx, dy)"""
    full = load(SRC.format(v), CHARS['saint'])
    union = np.zeros((S, S), bool)
    for k in ('legB', 'legF', 'torso', 'head', 'armB', 'armF', 'handF'):
        if f'{k}_{v}' in parts:
            union |= load_part(parts, f'{k}_{v}')[..., 3] > 0
    b = full[..., 3] > 0
    best = max(((union & np.roll(np.roll(b, dy, 0), dx, 1)).sum() / (union | np.roll(np.roll(b, dy, 0), dx, 1)).sum(), dx, dy)
               for dy in range(-8, 9) for dx in range(-8, 9))
    return best[1], best[2]


def move(src, dst, m):
    dst[m] = src[m]
    src[m] = 0


def wings_to_torso(parts, v):
    dx, dy = offset(parts, v)
    head, torso = load_part(parts, f'head_{v}'), load_part(parts, f'torso_{v}')
    wing = (head[..., 3] > 0) & ~poly(HEAD_CORE[v], dx, dy)
    move(head, torso, wing)
    save_part(parts, f'head_{v}', head)
    save_part(parts, f'torso_{v}', torso)
    print(f'[{v}] 날개 {int(wing.sum())}px 머리 → 몸통 (어긋남 {dx}, {dy})')


def rose_arm(parts, v):
    dx, dy = offset(parts, v)
    head, torso, arm = (load_part(parts, f'{k}_{v}') for k in ('head', 'torso', 'armB'))
    region = poly(ARM_B[v], dx, dy)
    # 어깨 맨살(밝은 살색)·목둘레 잎(초록)은 몸통 것 — 영역에 걸쳐도 빼고, 그 둘레 2px 외곽선도 몸통에
    rgb_t = torso[..., :3].astype(int)
    r, g, b = rgb_t[..., 0], rgb_t[..., 1], rgb_t[..., 2]
    keep_t = (torso[..., 3] > 0) & (((r > 190) & (g > 140) & (b > 120)) | ((g > r) & (g > b)))
    rows_, cols_ = np.mgrid[0:S, 0:S]
    keep_t = cv2.dilate(keep_t.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & (torso[..., 3] > 0) & \
        ~((r > 120) & (g < 80)) & (rows_ < 545 + dy) & (cols_ > 392 + dx)   # 어깨·목둘레 근처 외곽선만 (소매 외곽선은 팔로)
    region &= ~keep_t
    for src in (head, torso):
        move(src, arm, region & (src[..., 3] > 0) & (arm[..., 3] == 0))
        src[region] = 0
    hole = np.zeros((S, S), bool)   # (예전엔 소매 뒤 옆구리를 칠했으나 몸통 밖이라 번진 덩어리로 보였음 → 칠하지 않음)
    # 몸통 윗변 머리카락(밝은 회색) → 머리, 몸통 본체와 떨어진 부스러기 → 지움
    rows = np.arange(S)[:, None].repeat(S, 1)
    rgb = torso[..., :3].astype(int)
    hair = (torso[..., 3] > 0) & (rows < 512 + dy) & (rgb.min(2) > 150) & (rgb.max(2) - rgb.min(2) < 40)
    move(torso, head, hair)
    n, lab, st, _ = cv2.connectedComponentsWithStats((torso[..., 3] > 0).astype(np.uint8), connectivity=8)
    main = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    torso[(lab != main) & (lab > 0)] = 0
    shoulders(parts, v, torso)
    for k, img in (('head', head), ('torso', torso), ('armB', arm)):
        save_part(parts, f'{k}_{v}', img)
    print(f'[{v}] 뒷팔(소매·손·장미) {int((arm[..., 3] > 0).sum())}px, 옆구리 칠함 {int(hole.sum())}px, 머리카락 {int(hair.sum())}px (어긋남 {dx}, {dy})')


# 어깨 맨살 채우기 (11-11 밤 피드백 — m 몸통에 다른 세트 팔을 끼우면 어깨가 비어 보임): 이 드레스는 어깨가 드러나는데
# 맨살 어깨가 원래 소매(팔 조각)에 가려 그려지지 않았음 → 목둘레와 팔 관절(armB 385,552 · armF 588,548) 사이에
# 둥근 어깨(타원)를 살색(위는 밝고 아래는 그늘) + 바깥 외곽선으로 채움. m 몸통이 이미 그린 곳은 그대로 (리그 칸 좌표)
SHOULDER = {'m': [(414, 536, 36, 22), (414, 548, 22, 18), (584, 532, 22, 17)]}   # 가운데 x, y, 가로 반지름, 세로 반지름
SKIN = np.array([248, 210, 196]), np.array([214, 150, 142]), np.array([58, 24, 30])   # 밝은 살 · 그늘 · 외곽선


def shoulders(parts, v, torso):
    rows_, cols_ = np.mgrid[0:S, 0:S]
    shape = np.zeros((S, S), bool)
    for cx, cy, rx, ry in SHOULDER[v]:
        shape |= ((cols_ - cx) / rx) ** 2 + ((rows_ - cy) / ry) ** 2 <= 1
    fill = shape & (torso[..., 3] == 0)
    if not fill.any():
        return
    t = np.zeros((S, S))
    for cx, cy, rx, ry in SHOULDER[v]:
        t = np.where(((cols_ - cx) / rx) ** 2 + ((rows_ - cy) / ry) ** 2 <= 1, np.clip((rows_ - (cy - ry)) / (2 * ry), 0, 1), t)
    rgb = SKIN[0] * (1 - t[..., None] * 0.85) + SKIN[1] * (t[..., None] * 0.85)
    edge = shape & ~cv2.erode(shape.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & fill
    edge &= ~(cv2.dilate((torso[..., 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool))   # 몸통과 맞닿은 쪽은 외곽선 없이
    torso[fill, :3] = rgb[fill].astype(np.uint8)
    torso[fill, 3] = 255
    torso[edge, :3] = SKIN[2]
    print(f'[{v}] 어깨 맨살 채움 {int(fill.sum())}px')


def main():
    path = os.path.join(OUT, 'rig.json')
    layout = json.load(open(path, encoding='utf-8'))
    for v in HEAD_CORE:
        wings_to_torso(layout['parts'], v)
    for v in ARM_B:
        rose_arm(layout['parts'], v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
