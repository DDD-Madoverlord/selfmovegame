"""
서리 왕좌 구두(leg_frost_l) 신발 바꾸기 — 세트 그림의 신발이 작은 얼음 의자 모양이라 (11-16 사용자 '의자 모양 같다')
여왕 부츠(왕관 수정 커프 + 수정 스틸레토 굽) 그림으로 갈아 끼움. D-138

실행: 프로젝트 루트에서  python tools/rig/fix_frost_l_boots.py [--preview]
  cut_newchar_sets.py frost l 로 세트를 다시 자른 뒤에도 이걸 한 번 더 돌리면 됨 (의자 그림이 다시 나오므로)

입력
 - assets/sprites/parts/frost/src/frost_queen_boots34_raw.png : Gemini 원본 크기 다운로드 (1376×768, 초록 배경, 3/4 정면 부츠 두 짝 — 캐릭터 각도에 맞춤, D-141)
   (처음 쓴 옆모습 부츠 frost_queen_boots_raw.png는 앞코가 너무 오른쪽을 봐서 바꿈)
 - assets/sprites/parts/frost/src/legF_l_chair.png · legB_l_chair.png : 처음 자른 다리 그림(의자 구두) 보관본 — 없으면 지금 그림을 보관본으로 복사
출력: assets/sprites/rig/frost/legF_l.png · legB_l.png (자리 그대로, pad가 있으면 오른쪽으로 넓히고 rig.json 너비 맞춤 — 지금은 둘 다 원래 너비)

방법
 1. 초록 키 → 큰 덩어리 두 개 = 부츠 두 짝 (오른쪽 아래 Gemini 로고는 작은 덩어리라 빠짐)
 2. 다리 그림에서 의자 자리(다각형)를 지움 — 위쪽 망토 자락·다리는 그대로
 3. 부츠를 '단단한 몸통 시작 줄 → 다리 끝 줄', '밑창 → 바닥 줄'에 맞춰 줄이고, 발목 중심을 다리 중심에 맞춰 붙임.
    왕관 가시 사이 빈틈(원래 초록)은 그 자리의 다리(살·스타킹)가 보이고, 의자 조각이 남은 곳은 부츠 안감 남색으로 채움
 4. 두 다리 모두 왼쪽 짝을 씀 (짝마다 크기가 조금 달라 앞뒤 다리 크기가 어긋나지 않게), 뒷다리(legB)는 조금 어둡게 (다른 세트처럼 뒤쪽이 한 톤 어두움)
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

SRC = 'assets/sprites/parts/frost/src/'
OUT = 'assets/sprites/rig/frost/'
RAW = SRC + 'frost_queen_boots34_raw.png'   # 3/4 정면 부츠 (11-16 밤 — 옆모습 부츠는 앞코가 너무 오른쪽을 봐 캐릭터 각도와 안 맞음, 옛 그림은 frost_queen_boots_raw.png)
LINING = (28, 40, 92)       # 부츠 안감 (가시 사이로 보이는 안쪽)

# 다리별 자리 (그림 1:1 좌표): 지울 의자 다각형, 되살릴 망토 자락 다각형, 다리 끝 줄(부츠 단단한 몸통이 시작), 바닥 줄(밑창), 발목 중심 x, 밝기
LEGS = {
    # 앞다리: 의자 팔걸이가 덮던 망토 끝 삼각형도 같이 지움 (뒤에 몸통 망토가 있어 비어 보이지 않음)
    'legF': {'erase': [(18, 104), (96, 104), (134, 150), (134, 235), (0, 235), (0, 200), (18, 186)], 'robe': [],
             'top': 120, 'floor': 232, 'cx': 42, 'tone': 1.0, 'boot': 0},
    'legB': {'erase': [(0, 86), (100, 86), (100, 215), (0, 215)],
             'robe': [(84, 100), (112, 100), (112, 194), (94, 194), (84, 160)],
             'top': 100, 'floor': 212, 'cx': 58, 'tone': 0.82, 'boot': 0, 'pad': 0},   # 3/4 부츠는 앞코가 짧아 그림 안에 들어감 (옆모습 부츠 땐 36px 넓혔음)
}


def boots():
    rgb = np.asarray(Image.open(RAW).convert('RGB')).astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    fg = ~((g > 140) & (g > r + 50) & (g > b + 50))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
    big = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
    big.sort(key=lambda i: st[i, 0])          # 왼쪽 짝, 오른쪽 짝
    out = []
    for i in big:
        x, y, w, h = st[i, :4]
        m = (lab == i)[y:y + h, x:x + w]
        # 가시 사이 구멍 = 가장 큰 덩어리 밖의 초록 중 부츠 윤곽(행별 좌우 끝) 안쪽
        c = rgb[y:y + h, x:x + w].copy()
        c[..., 1] = np.minimum(c[..., 1], np.maximum(c[..., 0], c[..., 2]) + 8)   # 초록 번짐 제거
        a = np.dstack([c.clip(0, 255).astype(np.uint8), (m * 255).astype(np.uint8)])
        # 단단한 몸통 시작 줄: 끊김 없이 이어지고 폭이 짝 너비의 40% 넘는 첫 줄 (위쪽 가시 끝 한 줄은 빼고)
        def full_row(yy):
            xs = np.where(m[yy])[0]
            return len(xs) > 0.4 * w and np.all(m[yy, xs[0]:xs[-1] + 1])
        solid = next(yy for yy in range(h) if full_row(yy))
        sx = np.where(m[solid])[0]
        out.append({'img': a, 'solid': solid, 'cx': (sx[0] + sx[-1]) / 2, 'h': h})
    return out


def fit(boot, top, floor):
    """부츠를 줄여 (그림, 단단한 줄 위 높이, 발목 중심) 돌려줌"""
    s = (floor - top) / (boot['h'] - boot['solid'])
    im = Image.fromarray(boot['img'], 'RGBA')
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    pm = np.asarray(im).astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    small = cv2.resize(pm, (w, h), interpolation=cv2.INTER_AREA)
    al = small[..., 3]
    col = small[..., :3] / np.maximum(al[..., None], 1) * 255
    keep = al >= 110
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = col.clip(0, 255).astype(np.uint8)
    out[..., 3] = np.where(keep, 255, 0)
    return out, round(boot['solid'] * s), boot['cx'] * s


def crown_holes(alpha, solid_y):
    """왕관 가시 사이 빈틈: 단단한 줄 위쪽에서, 같은 줄의 가장 왼쪽·오른쪽 가시 사이 빈 칸"""
    holes = np.zeros_like(alpha, bool)
    for y in range(solid_y):
        xs = np.where(alpha[y] > 0)[0]
        if len(xs) > 1:
            holes[y, xs[0]:xs[-1] + 1] = alpha[y, xs[0]:xs[-1] + 1] == 0
    # 아래가 열려 있는(부츠 몸통에 닿는) 빈틈만 — 가시 바깥쪽 경사면은 뺌
    for y in range(solid_y - 2, -1, -1):
        holes[y] &= holes[y + 1] | (alpha[y + 1] > 0)
    return holes


def is_leg(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    skin = r > 170 and r > b + 25 and g > 110
    stock = r < 110 and g < 90 and b < 110 and r >= b - 12 and r + g + b > 60
    return skin or stock


def is_chair(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    ice = r + g + b > 200 and b >= r - 5 and g >= r and r > 0.55 * b
    return ice or max(r, g, b) < 30


def build(preview=False):
    pair = boots()
    res = {}
    for leg, cfg in LEGS.items():
        keep = SRC + f'{leg}_l_chair.png'
        if not os.path.exists(keep):
            shutil.copyfile(OUT + f'{leg}_l.png', keep)
        base = np.asarray(Image.open(keep).convert('RGBA'))
        if cfg.get('pad'):
            base = np.pad(base, ((0, 0), (0, cfg['pad']), (0, 0)))
        base = base.copy()
        H, W = base.shape[:2]
        er = Image.new('L', (W, H), 0)
        ImageDraw.Draw(er).polygon(cfg['erase'], fill=1)
        er = np.asarray(er).astype(bool)
        orig = base.copy()
        ys = np.arange(H)[:, None]
        low = er & (ys >= cfg['top'])
        base[low] = 0          # 부츠 몸통 줄 아래 의자 자리는 지우고, 부츠가 안 덮는 곳의 망토(남색)는 뒤에서 되살림
        bt, solid, bcx = fit(pair[cfg['boot']], cfg['top'], cfg['floor'])
        if cfg['tone'] != 1.0:
            bt[..., :3] = (bt[..., :3].astype(np.float32) * cfg['tone']).astype(np.uint8)
        ox, oy = round(cfg['cx'] - bcx), cfg['top'] - solid
        holes = crown_holes(bt[..., 3], solid)
        bh, bw = bt.shape[:2]
        for y in range(bh):
            for x in range(bw):
                X, Y = x + ox, y + oy
                if not (0 <= X < W and 0 <= Y < H):
                    continue
                if bt[y, x, 3]:
                    base[Y, X] = bt[y, x]
                elif holes[y, x]:
                    o = orig[Y, X]
                    if o[3] and is_leg(o):
                        base[Y, X] = o
                    else:
                        base[Y, X] = (*LINING, 255) if cfg['tone'] == 1.0 else (*[int(c * cfg['tone']) for c in LINING], 255)
        # 의자 맨 윗줄 ~ 부츠 몸통 줄 사이에서 부츠가 안 덮는 의자 조각(밝은 얼음·검은 윤곽) → 바로 위 픽셀로 이어 그림
        cover = np.zeros((H, W), bool)
        yy, xx = np.where((bt[..., 3] > 0) | holes)
        ok = (yy + oy >= 0) & (yy + oy < H) & (xx + ox >= 0) & (xx + ox < W)
        cover[yy[ok] + oy, xx[ok] + ox] = True
        top0 = min(p[1] for p in cfg['erase'])
        for Y in range(max(top0, 1), cfg['top']):
            for X in range(W):
                if er[Y, X] and not cover[Y, X] and base[Y, X, 3] and is_chair(base[Y, X]):
                    base[Y, X] = base[Y - 1, X]
        # 몸통 줄 아래 망토 자락 자리(robe 다각형): 부츠 밖이고 망토 남색이면(의자 얼음·윤곽이 아니면) 원래 픽셀 되살림 → 작은 조각(8px 미만)은 버림
        rz = Image.new('L', (W, H), 0)
        if cfg['robe']:
            ImageDraw.Draw(rz).polygon(cfg['robe'], fill=1)
        back = low & np.asarray(rz).astype(bool) & ~cover & (orig[..., 3] > 0) & ~np.apply_along_axis(is_chair, 2, orig) & ~np.apply_along_axis(is_leg, 2, orig)
        n, lab, st, _ = cv2.connectedComponentsWithStats(back.astype(np.uint8), 4)
        got = np.zeros((H, W), bool)
        for i in range(1, n):
            if st[i, 4] >= 8:
                got |= lab == i
        base[got] = orig[got]
        # 의자 얼음이 있던 구멍은 둘레 남색으로 메움 (닫기 → 새로 생긴 칸만 inpaint)
        zone = np.asarray(rz).astype(bool) & low & ~cover
        shut = cv2.morphologyEx(got.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool)
        gap = shut & zone & ~got
        if gap.any():
            fill = cv2.inpaint(np.ascontiguousarray(base[..., :3]), gap.astype(np.uint8), 3, cv2.INPAINT_TELEA)
            base[gap, :3] = fill[gap]
            base[gap, 3] = 255
        clipped = [(x + ox, y + oy) for y, x in zip(*np.where(bt[..., 3] > 0))
                   if not (0 <= x + ox < W and 0 <= y + oy < H)]
        if clipped:
            print(f'[{leg}] 그림 밖으로 나간 부츠 픽셀 {len(clipped)}개 — 자리 조정 필요')
        res[leg] = base
        print(f'[{leg}] 부츠 {bw}×{bh} at ({ox},{oy}) 몸통 줄 {cfg["top"]} 바닥 {cfg["floor"]}')
        if not preview:
            Image.fromarray(base, 'RGBA').save(OUT + f'{leg}_l.png')
    if not preview:   # 넓힌 그림은 rig.json 너비도 맞춤 (x·y·피벗은 그대로)
        path = OUT + 'rig.json'
        layout = json.load(open(path, encoding='utf-8'))
        for leg in LEGS:
            layout['parts'][f'{leg}_l']['w'] = int(res[leg].shape[1])
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(layout, f, ensure_ascii=False, indent=2)
    return res


if __name__ == '__main__':
    out = build('--preview' in sys.argv)
    if '--preview' in sys.argv:
        tiles = [Image.fromarray(out[k], 'RGBA') for k in ('legB', 'legF')]
        W = sum(t.width for t in tiles) + 20
        c = Image.new('RGBA', (W, max(t.height for t in tiles)), (0, 160, 0, 255))
        x = 0
        for t in tiles:
            c.alpha_composite(t, (x, 0)); x += t.width + 20
        c.resize((c.width * 3, c.height * 3), Image.NEAREST).save('tools/rig/_frost_l_boots.png')
        print('tools/rig/_frost_l_boots.png')
