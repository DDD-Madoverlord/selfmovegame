"""
뒤틀린 인형사 2차 세트 머리·몸통 나누기 고침 — D-145

문제 (11-17 사용자 '머리와 몸통 분리가 잘못된 경우가 많네'):
  cut_newchar_sets.py는 기본 인형사의 머리 다각형(얼굴 원) + '그 위로 솟은 것'만 머리로 잡아서,
  얼굴 원 옆으로 넓게 퍼진 모자 챙·뒷머리·후드는 몸통에 남고(머리가 끄덕이면 모자·머리카락이 갈라짐),
  거꾸로 머리 위로 솟은 등짐(인형극 연출가의 커튼 봉·주름 덮개)은 머리에 들어가 머리와 같이 흔들렸음.
고침 (리그 좌표, 기본 자세 합친 그림은 그대로):
  TO_HEAD  : 다각형 안의 몸통 픽셀 → 머리 (마녀 모자 챙, 그림자 인형극 중절모 챙, 종이 모자 챙, 곰 후드 옆,
             오르골 소녀 뒷머리·왕관 띠, 도자기 여왕 뒷머리·티아라 띠)
             몸통에는 남은 몸통에 닿는 곳(UNDER px 안)만 밑그림으로 남김 — 머리가 기울어도 이음매가 비지 않게
  TO_TORSO : 다각형 안의 머리 픽셀 → 몸통 (인형극 연출가 커튼 봉·주름 덮개)

실행: 프로젝트 루트에서  python tools/rig/fix_doll_heads.py [글자…]   (기본 b u c d v w m)
  cut_newchar_sets.py doll <글자>로 다시 자른 뒤에는 이걸 한 번 더 돌림 (이미 고친 그림이면 옮길 픽셀이 없어 그대로)
"""
import json
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = 'assets/sprites/rig/doll'
W = H = 1024
UNDER = 12
ORDER = ['legB', 'legF', 'torso', 'head', 'armB', 'handF', 'armF']   # 게임 그리는 순서 (dollRig z)
TO_HEAD = {
    'm': [(285, 240), (705, 240), (705, 272), (520, 272), (520, 300), (470, 300), (465, 430), (430, 430), (330, 430), (285, 420)],   # 마녀 모자 챙 왼쪽·모자 띠
    'v': [(450, 250), (675, 250), (675, 300), (620, 315), (520, 320), (450, 310)],                          # 중절모 챙
    'd': [(360, 250), (720, 250), (720, 278), (560, 278), (470, 312), (420, 348), (360, 352)],               # 종이 모자 챙
    'u': [(330, 245), (745, 245), (745, 265), (480, 265), (480, 470), (380, 476), (330, 446)],               # 곰 후드 왼쪽 옆·띠
    'c': [(430, 250), (625, 250), (625, 266), (500, 266), (500, 382), (470, 386), (440, 362), (430, 300)],   # 뒷머리·왕관 띠
    # 도자기 인형 여왕 (11-17 새 그림 — 큰 왕관·무도회 드레스): 왼쪽으로 퍼진 머리카락·왕관 아래 띠
    'w': [(320, 230), (790, 230), (790, 268), (470, 268), (470, 462), (390, 466), (320, 430)],
}
TO_TORSO = {
    'b': [(150, 140), (685, 140), (685, 232), (650, 240), (600, 248), (545, 252), (500, 262), (150, 262)],   # 커튼 봉·주름 덮개 (등에 진 인형극 무대)
}


def layer(parts, name):
    p = parts[name]
    a = np.zeros((H, W, 4), np.uint8)
    im = np.asarray(Image.open(f'{OUT}/{p["src"]}').convert('RGBA'))
    a[p['y']:p['y'] + im.shape[0], p['x']:p['x'] + im.shape[1]] = im
    return a


def over(dst, src):
    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    col = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([col, oa * 255]).round().clip(0, 255).astype(np.uint8)


def poly(pts):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(pts, fill=1)
    return np.asarray(m).astype(bool)


def save(name, img, parts):
    ys, xs = np.nonzero(img[..., 3])
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    Image.fromarray(np.ascontiguousarray(img[y0:y1, x0:x1]), 'RGBA').save(f'{OUT}/{name}.png')
    parts[name] = {**parts[name], 'src': f'{name}.png', 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def rest(parts, v):
    c = np.zeros((H, W, 4), np.uint8)
    for k in ORDER:
        if f'{k}_{v}' in parts:
            c = over(c, layer(parts, f'{k}_{v}'))
    return c


# 배경(마젠타)과 비슷한 분홍 보석이 배경 지우기에서 구멍으로 빠진 세트: 머리 안에 갇힌 구멍을 원본 그림 색으로 되살림
GEM_HOLES = {'w': 'assets/sprites/parts/doll/src/doll_set_w_gemini.png'}   # 왕관 분홍 보석 (세트 그림이 기본과 0px 맞춤)


def fill_gem(head, v):
    if v not in GEM_HOLES:
        return 0
    from scipy.ndimage import binary_fill_holes
    op = head[..., 3] > 0
    holes = binary_fill_holes(op) & ~op
    n, lab, st, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), connectivity=4)
    raw = np.asarray(Image.open(GEM_HOLES[v]).convert('RGB'))
    got = 0
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] <= 3000:
            m = lab == i
            head[m, :3] = raw[m]
            head[m, 3] = 255
            got += int(m.sum())
    return got


def fix_pink(parts, v):
    """배경 지우기의 마젠타 번짐 보정이 분홍(장미·보석)을 회색으로 바꾼 것을 원본 색으로 — 모든 조각 (D-145 도자기 여왕)"""
    if v not in GEM_HOLES:
        return parts
    raw = np.asarray(Image.open(GEM_HOLES[v]).convert('RGB')).astype(int)
    R, G, B = raw[..., 0], raw[..., 1], raw[..., 2]
    pink = (R > 150) & (R - G > 45) & (B > 80) & (G > 50)
    out, got = dict(parts), 0
    for k in ORDER:
        name = k if k.endswith('_' + v) else f'{k}_{v}'
        if name not in parts or parts[name]['w'] <= 1:
            continue
        p = parts[name]
        im = np.asarray(Image.open(f'{OUT}/{p["src"]}').convert('RGBA')).copy()
        sub = pink[p['y']:p['y'] + im.shape[0], p['x']:p['x'] + im.shape[1]] & (im[..., 3] > 0)
        if not sub.any():
            continue
        im[sub, :3] = raw[p['y']:p['y'] + im.shape[0], p['x']:p['x'] + im.shape[1]][sub]
        Image.fromarray(im, 'RGBA').save(f'{OUT}/{p["src"]}')
        got += int(sub.sum())
    print(f'[{v}] 분홍(장미·보석) 색 되살림 {got}px')
    return out


def fix(parts, v):
    hn, tn = f'head_{v}', f'torso_{v}'
    before = rest(parts, v)
    head, torso = layer(parts, hn), layer(parts, tn)
    gem = fill_gem(head, v)
    if gem:
        print(f'[{v}] 보석 구멍 되살림 {gem}px')
        before = None
    both = over(torso, head)
    moved = 0
    if v in TO_HEAD:
        take = poly(TO_HEAD[v]) & (torso[..., 3] > 0)
        moved = int((take & (head[..., 3] < 255)).sum())
        head[take] = both[take]
        keep = torso[..., 3] > 0
        keep &= ~take
        near = cv2.dilate(keep.astype(np.uint8), np.ones((UNDER * 2 + 1,) * 2, np.uint8)).astype(bool)
        torso[take & ~near] = 0          # 남은 몸통에서 먼 곳은 머리만 (밑그림 없음)
    if v in TO_TORSO:
        give = poly(TO_TORSO[v]) & (head[..., 3] > 0)
        moved = int(give.sum())
        torso[give] = both[give]
        head[give] = 0
    if not moved and not gem:
        print(f'[{v}] 옮길 픽셀 없음 — 그대로')
        return parts
    out = dict(parts)
    save(hn, head, out)
    save(tn, torso, out)
    if before is not None:
        diff = int((np.abs(rest(out, v).astype(int) - before.astype(int)).max(2) > 2).sum())
        print(f'[{v}] 옮김 {moved}px · 기본 자세 바뀐 픽셀 {diff}')
    else:
        print(f'[{v}] 옮김 {moved}px (보석을 되살려 기본 자세 그림이 그만큼 채워짐)')
    return out


def main():
    letters = [a for a in sys.argv[1:]] or list(TO_HEAD) + list(TO_TORSO)
    path = f'{OUT}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    for v in letters:
        layout['parts'] = fix(layout['parts'], v)
        layout['parts'] = fix_pink(layout['parts'], v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
