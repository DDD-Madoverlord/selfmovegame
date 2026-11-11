"""
긴 로브 세트(b 그림자 마도사 · v 공허의 예언자)의 망토와 로브를 그림의 실제 경계선으로 다시 나눔 (D-121, 2026-11-11 피드백)

실행: 프로젝트 루트에서  python tools/rig/cut_hero_sets.py b v   (자른 뒤 robe_legs.py → 이 파일 process() 순서로 부름)

왜: cut_hero_sets.py는 망토를 세로 직선(x 408·425)으로 잘라
  - 로브 뒤쪽 끝(파란·보라 천)이 망토 조각에 섞여 망토와 같이 흔들리고(v: 망토 아랫자락 오른쪽에 파란 천),
  - 망토 위쪽 회색 천이 몸통에 남아 몸통 왼쪽 위에 깃발처럼 붙고, 몸통 왼쪽이 곧은 직선으로 끊겨 보였음
  - 망토 윗조각(cape1) 아랫변이 가로 직선이라 아랫조각(cape2)보다 덜 흔들릴 때 줄이 보였음
고친 방법
  1. 몸통·망토 조각을 합친 그림에서, 로브 바깥 검은 외곽선을 따라 그린 경계선(BOUNDARY) 왼쪽 = 망토, 오른쪽 = 로브(몸통)
     (외곽선은 로브 쪽). 목둘레 두건(y < HOOD_Y)은 몸통에 그대로 둠
  2. 망토는 몸통 뒤에 그려지므로, 경계선 오른쪽 UNDER px만큼 망토 색으로 이어 칠해 둠 (평소엔 로브에 가려 안 보이고,
     망토가 흔들려 벌어져도 사이가 비지 않음). 망토 윗조각도 두건 밑으로 OVERLAP_UP px 이어 그림
  3. 망토 윗조각과 아랫조각은 SPLIT 범위에서 겹치고, 윗조각 아랫변은 그 범위에서 점점 투명해져 이음매가 안 보임
  4. b는 망토 끝자락 아래(HEM_Y)로 퍼진 로브 아랫단·발밑 그림자 띠를 몸통에 둠 (망토와 같이 들리지 않게)
  5. 망토 안감 capeIn_<글자>(몸통에 고정, 망토 뒤 — heroRig.js 'capeIn' 뼈)을 만들어 망토가 흔들려 벌어져도 빈 곳이 안 보이게
  6. b 그림자 마도사는 로브가 땅까지라 다리 그림이 없어 걸을 때 미끄러지듯 보였음 → 공허의 예언자(v) 신발을
     그림자 마도사 색(어두운 보라)으로 물들여 다리로 씀: 로브 밑·앞으로 내딛는 발끝만 보임
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

OUT_DIR = 'assets/sprites/rig/hero'
W, H = 1024, 982
HOOD_Y = 420
OVERLAP_UP = 30
UNDER = 30
SPLIT = (625, 672)          # cape1: y < 672 (625~672는 점점 투명), cape2: y >= 625
# 로브 뒤쪽 검은 외곽선의 왼쪽 가장자리 (위 → 아래). 이 선 왼쪽이 망토 (tools/rig/_sets_tmp/hero_<글자>_neutral.png 기준)
BOUNDARY = {
    'b': [(446, HOOD_Y), (440, 470), (426, 515), (414, 545), (403, 575), (399, 640), (399, 900), (396, 982)],
    'v': [(444, HOOD_Y), (432, 470), (424, 500), (414, 540), (410, 600), (400, 640), (400, 900), (400, 982)],
}
# 망토 끝자락 아래 = 로브 아랫단·발밑 그림자 띠(망토 밑으로 왼쪽까지 퍼짐) → 몸통 (땅에 붙어 있어야 함, 11-11 저녁 피드백:
#   이 띠가 망토 조각에 있어 망토가 흔들릴 때 바닥 그림자가 같이 들려 잘린 것처럼 보였음)
HEM_Y = {'b': 884}
LINING, LINING_FADE, LINING_DARK = 90, 40, 0.62   # 망토 안감: 경계선에서 90px까지 진하게, 40px 동안 옅어짐, 밝기 ×0.62
BOOT_TINT = {'b': (0.62, 0.48, 0.78)}   # 신발 빌려 쓰기 (v → b): 곱할 색 (어두운 보라)


def load(parts, name):
    """조각 그림을 전체 칸(W×H) RGBA 배열로"""
    p = parts[name]
    full = np.zeros((H, W, 4), np.uint8)
    im = np.asarray(Image.open(os.path.join(OUT_DIR, p['src'])).convert('RGBA'))
    full[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']] = im
    return full


def save(parts, name, full):
    a = full[..., 3] > 0
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(full[y0:y1, x0:x1]).save(os.path.join(OUT_DIR, f'{name}.png'))
    parts[name] = {'src': f'{name}.png', 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def over(dst, src):
    """src를 dst 위에 (불투명 픽셀만)"""
    m = src[..., 3] > 0
    dst[m] = src[m]
    return dst


def left_of(v):
    img = Image.new('L', (W, H), 0)
    pts = BOUNDARY[v]
    ImageDraw.Draw(img).polygon([(0, pts[0][1])] + pts + [(0, H)], fill=255)
    return np.asarray(img) > 0


def recut(layout, v):
    parts = layout['parts']
    torso, cape1, cape2 = (load(parts, f'{k}_{v}') for k in ('torso', 'cape1', 'cape2'))
    union = over(over(over(np.zeros_like(torso), cape2), cape1), torso)   # 몸통이 위
    opaque = union[..., 3] > 0
    rows = np.arange(H)[:, None].repeat(W, 1)
    left = left_of(v)
    cape = opaque & left & (rows >= HOOD_Y) & (rows < HEM_Y.get(v, H))
    body = opaque & ~cape

    torso_new = union.copy(); torso_new[~body] = 0
    cape_img = union.copy(); cape_img[~cape] = 0
    # 2. 경계선 오른쪽 UNDER px · 두건 밑 OVERLAP_UP px를 망토 그림을 거울처럼 비춰 이어 그림 (로브·두건에 가려지는 곳)
    cape_full = cape_img.copy()
    fill = np.zeros((H, W), bool)
    for y in range(HOOD_Y, H):
        xs = np.nonzero(cape[y])[0]
        if not len(xs):
            continue
        xb = xs.max()
        for d in range(1, UNDER + 1):
            x, xm = xb + d, xb - d + 1
            if x >= W or xm < 0 or not opaque[y, x] or not cape[y, xm]:
                break
            cape_full[y, x] = cape_img[y, xm]; fill[y, x] = True
    for x in range(W):
        if not cape[HOOD_Y, x]:
            continue
        for d in range(1, OVERLAP_UP + 1):
            y, ym = HOOD_Y - d, HOOD_Y + d - 1
            if not opaque[y, x] or not left[y, x] or not cape[ym, x]:
                break
            cape_full[y, x] = cape_img[ym, x]; fill[y, x] = True
    cape_mask = cape | fill
    # 3. 위·아래 조각 + 겹치는 범위에서 윗조각 아랫변을 점점 투명하게
    c1 = cape_full.copy(); c1[~(cape_mask & (rows < SPLIT[1]))] = 0
    ramp = np.clip((SPLIT[1] - rows) / (SPLIT[1] - SPLIT[0]), 0, 1)
    c1[..., 3] = (c1[..., 3] * np.where(rows >= SPLIT[0], ramp, 1)).astype(np.uint8)
    c2 = cape_full.copy(); c2[~(cape_mask & (rows >= SPLIT[0]))] = 0
    # 로브 아랫단 아래(robe_legs.CUT_Y)로 내려온 몸통 픽셀 = 예전 망토 직선 안에 있던 뒷발 뒤꿈치 → 뒷다리 정강이로
    import robe_legs
    low = (torso_new[..., 3] > 0) & (rows >= robe_legs.CUT_Y.get(v, H))
    if low.any():
        shin = load(parts, f'shinB_{v}')
        shin[low] = torso_new[low]
        torso_new[low] = 0
        save(parts, f'shinB_{v}', shin)
    save(parts, f'torso_{v}', torso_new)
    # 5. 망토 안감 capeIn: 몸통에 고정된 망토 뒤 그림. 경계선에서 LINING px 안쪽까지 망토를 어둡게(안쪽 천) 그리고
    #    바깥 LINING_FADE px는 점점 투명 — 망토가 흔들려 로브와 망토 사이가 벌어져도 빈 곳 대신 망토 안쪽이 보임 (11-11 밤 피드백)
    xb = np.where(left, np.arange(W)[None, :], -1).max(1)                     # 줄마다 경계선 x
    d = xb[:, None] - np.arange(W)[None, :]
    lin = cape_full.copy()
    lin_mask = cape_mask & (d <= LINING + LINING_FADE) & (rows >= HOOD_Y)
    lin[~lin_mask] = 0
    lin[..., :3] = (lin[..., :3] * LINING_DARK).astype(np.uint8)
    lin[..., 3] = (lin[..., 3] * np.clip((LINING + LINING_FADE - d) / LINING_FADE, 0, 1)).astype(np.uint8)
    save(parts, f'capeIn_{v}', lin)
    layout['pivots'].setdefault('capeIn', layout['pivots']['torso'])
    save(parts, f'cape1_{v}', c1)
    save(parts, f'cape2_{v}', c2)
    print(f'[{v}] 망토 {int(cape.sum())}px (이어 칠함 {int(fill.sum())}px) · 몸통 {int(body.sum())}px')


def clean_boots(layout, v):
    """로브 아랫단에서 잘린 신발 조각: 맨 위 몇 줄에 남은 로브 단(밝은 천 줄)과 떨어진 작은 부스러기를 지움
    (걸을 때 신발과 같이 흔들려 로브 끝이 따로 노는 것처럼 보였음)"""
    from scipy import ndimage
    parts = layout['parts']
    for k in ('shinF', 'shinB', 'thighF', 'thighB'):
        full = load(parts, f'{k}_{v}')
        a = full[..., 3] > 0
        if not a.any():
            continue
        top = np.nonzero(a.any(1))[0].min()
        lum = full[..., :3].astype(int).mean(2)
        rows = np.arange(H)[:, None].repeat(W, 1)
        a &= ~((rows < top + 4) & (lum > 110))
        lab, n = ndimage.label(a)
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 40])
        full[~keep] = 0
        save(parts, f'{k}_{v}', full)


def borrow_boots(layout, v, src='v'):
    """로브가 땅까지 닿아 다리 그림이 없는 세트: src 세트 신발을 물들여 다리로 (로브 뒤라 내딛는 발끝만 보임)"""
    parts = layout['parts']
    tint = np.array(BOOT_TINT[v])
    for k in ('thighF', 'shinF', 'thighB', 'shinB'):
        full = load(parts, f'{k}_{src}')
        if not (full[..., 3] > 0).any():
            continue
        rgb = full[..., :3].astype(float)
        lum = rgb.mean(2, keepdims=True)
        out = rgb * tint
        # 공허의 예언자의 하늘빛 별 반짝임 → 그림자 마도사 보라 기운 (밝을수록 진한 보라)
        glow = np.clip((lum - 110) / 90, 0, 1)
        out = out * (1 - glow) + np.array([150, 70, 220]) * (lum / 200) * glow
        full[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
        save(parts, f'{k}_{v}', full)
    print(f'[{v}] 다리: {src} 신발을 물들여 씀')


def process(layout, v):
    recut(layout, v)
    if v == 'v':
        clean_boots(layout, v)
    if v in BOOT_TINT:
        borrow_boots(layout, v)


if __name__ == '__main__':
    raise SystemExit('cut_hero_sets.py b v 로 실행 (자른 직후 그림에서만 다시 나눔 — 두 번 돌리면 겹침이 쌓임)')
