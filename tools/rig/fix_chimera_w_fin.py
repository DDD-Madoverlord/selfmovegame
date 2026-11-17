"""
심해 상어 괴인(합성괴인 2차 세트 w) 등지느러미 한 조각으로 — D-144

문제 (11-17 사용자 '상어머리 지느러미 부분이 잘못되어 있네? 움직일 때 일부가 잘려서 보여'):
  cut_chimera_sets.py가 기본 합성괴인의 선(날개·머리·몸통)으로 자르다 보니, 상어 머리 뒤로 솟은 큰 등지느러미가
  날개(wing_w — 끝부분) · 몸통(torso_w — 가운데 띠) · 머리(head_w — 앞쪽)로 세 동강 → 날개는 날갯짓, 머리는 끄덕임으로
  따로 움직여 지느러미가 잘려 보임.
고침 (오른쪽을 보게 뒤집은 리그 좌표에서):
  - 지느러미 전체(날개 조각 전부 + 몸통 띠 FIN_POLY 안)를 머리 조각으로 옮김 → 머리와 지느러미가 한 덩어리로 움직임
  - 몸통에는 지느러미 아랫부분(UNDER_Y 아래)만 밑그림으로 남김 → 머리가 기울어도 지느러미 뿌리 밑이 비지 않음 (기본 자세에선 머리에 가려 안 보임)
  - 날개 조각은 투명 1×1 (조각 이름은 남겨야 기본 날개 그림으로 대체되지 않음)
  기본 자세 합친 그림은 그대로 (검사: 바뀐 픽셀 0)

실행: 프로젝트 루트에서  python tools/rig/fix_chimera_w_fin.py   (cut_chimera_sets.py w 다음에 자동으로 돎 — 이미 고친 그림이면 건너뜀)
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

OUT = 'assets/sprites/rig/chimera'
W, H = 886, 1024
FIN_POLY = [(225, 20), (455, 20), (455, 90), (374, 250), (330, 268), (225, 300)]   # 몸통 쪽 지느러미 띠 (리그 좌표)
UNDER_Y = 200   # 이 줄 아래 지느러미는 몸통에도 남김 (밑그림)


def layer(parts, name):
    p = parts[name]
    a = np.zeros((H, W, 4), np.uint8)
    im = np.asarray(Image.open(f'{OUT}/{p["src"]}').convert('RGBA'))
    a[p['y']:p['y'] + im.shape[0], p['x']:p['x'] + im.shape[1]] = im
    return a


def over(dst, src):
    """src를 dst 위에 (알파 합성)"""
    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    col = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([col, oa * 255]).round().clip(0, 255).astype(np.uint8)


def save(name, img, parts):
    ys, xs = np.nonzero(img[..., 3])
    if not len(xs):   # 빈 조각: 투명 1×1 (자리는 그대로)
        Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(f'{OUT}/{name}.png')
        parts[name] = {**parts[name], 'w': 1, 'h': 1}
        return
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    Image.fromarray(np.ascontiguousarray(img[y0:y1, x0:x1]), 'RGBA').save(f'{OUT}/{name}.png')
    parts[name] = {'src': f'{name}.png', 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def fix(parts):
    if parts['wing_w']['w'] <= 1:
        print('[w 지느러미] 이미 고친 그림 — 건너뜀')
        return parts
    order = ['tail1_w', 'tail2_w', 'legB_w', 'legF_w', 'torso_w', 'wing_w', 'armB_w', 'armF_w', 'head_w']
    before = np.zeros((H, W, 4), np.uint8)
    for n in order:
        before = over(before, layer(parts, n))
    torso, wing, head = layer(parts, 'torso_w'), layer(parts, 'wing_w'), layer(parts, 'head_w')
    poly = Image.new('L', (W, H), 0)
    ImageDraw.Draw(poly).polygon(FIN_POLY, fill=1)
    fin = (wing[..., 3] > 0) | ((torso[..., 3] > 0) & np.asarray(poly).astype(bool))
    under = over(torso, wing)                       # 머리 밑에 보이던 지느러미 (몸통 + 날개)
    head_new = head.copy()
    take = fin & (head[..., 3] < 255)
    head_new[take] = over(under, head)[take]
    rows = np.arange(H)[:, None]
    torso_new = torso.copy()
    torso_new[fin & (rows < UNDER_Y)] = 0
    torso_new[fin & (rows >= UNDER_Y)] = under[fin & (rows >= UNDER_Y)]   # 뿌리 밑그림 (날개 쪽 지느러미 아래도 메움)
    out = dict(parts)
    save('torso_w', torso_new, out)
    save('head_w', head_new, out)
    save('wing_w', np.zeros((H, W, 4), np.uint8), out)
    after = np.zeros((H, W, 4), np.uint8)
    for n in order:
        after = over(after, layer(out, n))
    diff = int((np.abs(after.astype(int) - before.astype(int)).max(2) > 2).sum())
    print(f'[w 지느러미] 머리로 옮김 {int(take.sum())}px · 몸통 밑그림 {int((fin & (rows >= UNDER_Y)).sum())}px · 기본 자세 바뀐 픽셀 {diff}')
    return out


def main():
    path = f'{OUT}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    layout['parts'] = fix(layout['parts'])
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
