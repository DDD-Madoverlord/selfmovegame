"""
긴 로브 세트의 다리 조각에 섞인 로브 몸통을 몸통 그림으로 옮김 (D-119, 2026-11-10 피드백 — '그림자 마도사 다리에 몸체 일부가 포함되어 애니메이션이 이상함')

실행: 프로젝트 루트에서  python tools/rig/robe_legs.py [글자…]   (기본 b v — cut_hero_sets.py도 자른 뒤 이것을 부름)
  → assets/sprites/rig/hero/torso_<글자>.png를 넓혀 다리 조각의 로브 부분(전체 좌표 y < 자를 선)을 합치고,
    다리 조각(thighB·shinB·thighF·shinF_<글자>)에서는 그 부분을 지움. rig.json의 torso_<글자> 자리·크기를 고침.

왜: cut_hero_sets.py는 로브 세트도 다리 범위를 상자로 잘라(로브 아랫자락까지 다리 조각) 걸을 때 로브 덩어리가 다리와 함께
   따로 흔들리고 윗변(y 700)이 직선으로 끊겨 보였음. 로브는 몸통과 같이 움직이고, 로브 밑으로 보이는 발만 다리로 둠.
  - b 그림자 마도사: 로브가 땅까지 → 다리 조각 전부 몸통으로 (발이 안 보임)
  - v 공허의 예언자: 로브 아랫단 y 862 아래 신발만 다리로
합칠 때 그리는 순서는 리그와 같음: 뒤 다리(thighB·shinB) → 몸통 → 앞 다리(thighF·shinF).
"""
import json
import os
import sys

from PIL import Image

OUT_DIR = 'assets/sprites/rig/hero'
CUT_Y = {'b': 10000, 'v': 862}       # 이 y(rig.json 전체 좌표)보다 위 = 로브 → 몸통
BACK, FRONT = ('thighB', 'shinB'), ('thighF', 'shinF')


def merge(layout, v):
    parts = layout['parts']
    cut_y = CUT_Y[v]
    keys = [k for k in BACK + ('torso',) + FRONT]
    boxes = {k: parts[f'{k}_{v}'] for k in keys}
    x0 = min(b['x'] for b in boxes.values()); y0 = min(b['y'] for b in boxes.values())
    x1 = max(b['x'] + b['w'] for b in boxes.values()); y1 = max(b['y'] + b['h'] for b in boxes.values())
    canvas = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for k in keys:
        b = boxes[k]
        path = os.path.join(OUT_DIR, b['src'])
        im = Image.open(path).convert('RGBA')
        if k == 'torso':
            canvas.alpha_composite(im, (b['x'] - x0, b['y'] - y0))
            continue
        top_h = max(0, min(im.height, cut_y - b['y']))   # 이 조각에서 로브 줄 수
        if top_h <= 0:
            continue
        robe = Image.new('RGBA', im.size, (0, 0, 0, 0))
        robe.paste(im.crop((0, 0, im.width, top_h)), (0, 0))
        canvas.alpha_composite(robe, (b['x'] - x0, b['y'] - y0))
        rest = im.copy()
        rest.paste(Image.new('RGBA', (im.width, top_h), (0, 0, 0, 0)), (0, 0))
        rest.save(path)
    bbox = canvas.getbbox()
    torso = canvas.crop(bbox)
    tb = boxes['torso']
    torso.save(os.path.join(OUT_DIR, tb['src']))
    parts[f'torso_{v}'] = {**tb, 'x': x0 + bbox[0], 'y': y0 + bbox[1], 'w': torso.width, 'h': torso.height}
    print(f'torso_{v}: {tb["w"]}x{tb["h"]} → {torso.width}x{torso.height} (로브 합침, 자를 선 y {cut_y})')


def main(letters):
    path = f'{OUT_DIR}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    for v in letters:
        merge(layout, v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main(sys.argv[1:] or list(CUT_Y))
