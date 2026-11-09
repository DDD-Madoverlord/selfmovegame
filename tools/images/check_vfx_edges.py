"""
이펙트 시트 잘림 점검 (11-05 피드백 20번 — '스킬 연출 이미지가 잘려 보이는 것')

실행: python tools/images/check_vfx_edges.py [--top 20] [--sheet 저장할 그림.png] [이름 ...]
  → 시트(assets/sprites/vfx/png/<이름>.png, 9칸 가로 띠)마다 칸의 네 변 안쪽 띠(가장자리 옅게 18px 바로 안, 18~26px)의
    평균 진하기(알파 0~1)를 재서, 진한 변이 있는 칸 수와 가장 진한 값을 표로 보여 준다.
    값이 크면 그림이 칸 경계를 넘어 이어지다 Gemini 3×3 칸 자르기(build_vfx_sheet.py)에서 잘린 것 — 옅게 처리해도 잘린 느낌이 남음.
  --sheet: 의심 시트를 한 장에 모은 그림 (변마다 빨간 선 = 진함)
일부러 한쪽 변에 붙인 그림(숨결은 입 쪽 = 왼쪽, 바닥 기준 그림은 아래)은 ALLOWED에 적어 빼고 잰다.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw

VFX_PNG = os.path.join('assets', 'sprites', 'vfx', 'png')
FRAMES = 9
BAND = (18, 26)      # 칸 가장자리에서 이 범위(px)의 띠 — build_vfx_sheet.py FADE(18) 바로 안쪽
LIMIT = 0.15         # 이보다 진하면 '닿음' (빨간 선)
SERIOUS = 0.25       # 이보다 진하면 눈에 띄게 잘림 — 11-05엔 0.4, 11-09 수정 창 착지(0.36)도 잘려 보인다는 피드백으로 낮춤 (D-118)
SIDES = ('top', 'bottom', 'left', 'right')
# 일부러 그 변에서 시작하는 그림 (vfxPlayer.js VFX_SHEETS 주석: '입 기준, 오른쪽으로'·'왼쪽 기준'·'바닥 기준')
ALLOWED = {
    'breath_fire': {'left'}, 'breath_gold': {'left'}, 'roar_green': {'left'},
    'orbital_beam': {'top'}, 'pillar_gold': {'top'}, 'judgment_violet': {'top'}, 'revive_crimson': {'top'},   # 하늘에서 내려오는 빛기둥 (vfxPlayer BEAM_UP이 위로 늘려 그림)
    'crusher_claw': {'top'},   # 화면 밖에서 뻗어 들어오는 집게 팔
}
# 바닥 기준 그림(anchorY 0.9 — 칸 아래 10%는 땅선 아래): 아래 변은 soften_vfx_edges.py로 24px 옅게 함 (11-05) → 아래 변은 빼고 잼
for _n in ('revive_crimson', 'orbital_beam', 'summon_portal', 'meteor_cyan', 'power_aura', 'trident_gold', 'meteor_red',
           'live_broadcast', 'plasma_white', 'pillar_gold', 'explosion_big'):
    ALLOWED.setdefault(_n, set()).add('bottom')


def edge_values(arr):
    """한 칸(정사각 RGBA)의 네 변 안쪽 띠 평균 알파"""
    a = arr[..., 3] / 255
    lo, hi = BAND
    return {'top': a[lo:hi, lo:-lo].mean(), 'bottom': a[-hi:-lo, lo:-lo].mean(),
            'left': a[lo:-lo, lo:hi].mean(), 'right': a[lo:-lo, -hi:-lo].mean()}


def measure(name):
    im = np.asarray(Image.open(os.path.join(VFX_PNG, f'{name}.png')).convert('RGBA'))
    size = im.shape[1] // FRAMES
    per = [edge_values(im[:, i * size:(i + 1) * size]) for i in range(FRAMES)]
    allowed = ALLOWED.get(name, set())
    out = {}
    for s in SIDES:
        if s in allowed:
            continue
        vals = [p[s] for p in per]
        out[s] = {'max': max(vals), 'frames': sum(v > LIMIT for v in vals)}
    worst = max(out.values(), key=lambda v: v['max']) if out else {'max': 0, 'frames': 0}
    return {'name': name, 'sides': out, 'max': worst['max'], 'frames': max((v['frames'] for v in out.values()), default=0), 'per': per, 'size': size}


def contact_sheet(rows, path, scale=0.5):
    """의심 시트를 줄마다 하나씩 — 진한 변에 빨간 선"""
    s = int(rows[0]['size'] * scale)
    out = Image.new('RGBA', (FRAMES * (s + 4) + 4, len(rows) * (s + 22) + 4), (16, 18, 24, 255))
    d = ImageDraw.Draw(out)
    for r, row in enumerate(rows):
        strip = Image.open(os.path.join(VFX_PNG, f"{row['name']}.png")).convert('RGBA')
        y = 4 + r * (s + 22)
        d.text((6, y), f"{row['name']}  max {row['max']:.2f}  ({row['frames']}/9)", fill=(230, 230, 240, 255))
        for i in range(FRAMES):
            fr = strip.crop((i * row['size'], 0, (i + 1) * row['size'], row['size'])).resize((s, s))
            bg = Image.new('RGBA', (s, s), (40, 44, 56, 255))
            bg.alpha_composite(fr)
            x = 4 + i * (s + 4)
            out.alpha_composite(bg, (x, y + 16))
            for side, v in row['per'][i].items():
                if v <= LIMIT or side in ALLOWED.get(row['name'], set()):
                    continue
                box = {'top': (x, y + 16, x + s, y + 18), 'bottom': (x, y + 14 + s, x + s, y + 16 + s),
                       'left': (x, y + 16, x + 2, y + 16 + s), 'right': (x + s - 2, y + 16, x + s, y + 16 + s)}[side]
                d.rectangle(box, fill=(255, 60, 60, 255))
    out.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('names', nargs='*')
    ap.add_argument('--top', type=int, default=20)
    ap.add_argument('--sheet')
    args = ap.parse_args()
    names = args.names or sorted(f[:-4] for f in os.listdir(VFX_PNG) if f.endswith('.png'))
    rows = sorted((measure(n) for n in names), key=lambda r: -r['max'])
    hit = [r for r in rows if r['max'] > LIMIT]
    bad = [r for r in rows if r['max'] > SERIOUS]
    print(f'시트 {len(rows)}장 중 칸 경계에 닿은 것 {len(hit)}장 (띠 {BAND[0]}~{BAND[1]}px 평균 알파 > {LIMIT}) · 눈에 띄게 잘린 것 {len(bad)}장 (> {SERIOUS})')
    print(f"{'시트':<22}{'최대':>6}{'칸':>6}  변별 (최대·닿은 칸)")
    for r in rows[:args.top]:
        sides = ' · '.join(f"{s} {v['max']:.2f}/{v['frames']}" for s, v in r['sides'].items() if v['max'] > LIMIT)
        print(f"{r['name']:<22}{r['max']:>6.2f}{r['frames']:>4}/9  {sides}")
    if args.sheet and hit:
        contact_sheet(hit[:args.top], args.sheet)
        print('한눈에 보기:', args.sheet)


if __name__ == '__main__':
    main()
