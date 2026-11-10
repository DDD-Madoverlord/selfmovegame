"""
타락 히어로 A·B 세트 부위 그림 자르기 (D-050 파츠 확장) → assets/sprites/rig/hero/<부위>_a.png · <부위>_b.png + rig.json에 추가

실행: 프로젝트 루트에서  python tools/rig/cut_hero_sets.py [글자…]   (기본 a b — 2차 세트는 u c d v w l m, D-071. 기본 그림은 cut_hero_parts.py가 만든 것을 그대로 둠)

입력 (Gemini 원본 크기 다운로드, assets/sprites/parts/hero/src/, 2026-10-17)
 - hero_<a|b>_neutral_gemini.png : 세트 기본 자세 — 중립 원본(hero_neutral)을 첨부해 장비만 바꾼 것
 - hero_<a|b>_armfwd_gemini.png  : 같은 대화에서 앞팔만 앞으로 든 것 (B는 16:9 캔버스)
 - hero_<a|b>_weapon_gemini.png  : 칼 든 원본(hero_armforward)을 첨부해 칼만 바꾼 것 (A 검은 대검, B 구슬 지팡이 — 16:9)

방법
 1. setfit으로 로고를 지우고 기본 원본 칸(1024×982)에 맞춘다. 팔 든 그림은 세트 기본 자세의 머리·다리 줄에,
    무기 그림은 칼 든 원본의 위쪽(머리·팔)에 맞춘다. 무기는 칼끝·구슬이 칸 밖으로 나가므로 칸을 오른쪽으로 넓혀 맞춘다
 2. cut_hero_parts와 같은 선으로 자른다: 앞팔 = 두 그림의 차이, 망토·다리·견갑·머리는 기본 선.
    머리는 세트 그림 그대로(기본은 눈 때문에 다른 그림에서 가져왔지만 세트 그림은 눈이 살아 있음)
 3. 무기 = 칼 든 원본에서 "칼을 뺀 몸"이 아닌 곳 + 몸 위에 겹쳐 색이 바뀐 곳. 손잡이를 기본 칼처럼 주먹 자리로 옮긴다
    (손잡이: 칼자루 끝 → 가드의 0.59 지점 — 기본 칼에서 (668, 668)이 나오는 비율. 지팡이는 자루가 기본 손잡이 자리를 지남)
 4. B(그림자 마법사): 연기 왕관·발밑 그림자 자락이 떨어진 조각이라 작은 조각도 남기고, 다리 범위를 오른쪽 자락까지 넓힘.
    다리는 긴 로브 속이라 로브 아랫자락이 다리 조각으로 잘려 걸을 때 함께 흔들렸음 → robe_legs.py가 로브를 몸통으로 옮김 (D-119)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigcut import (remove_key_background, poly_mask, rect_mask, largest, grow, drop_specks, fill_flat, cut,  # noqa: E402
                    save_parts, rest_check)
import cut_hero_parts as base  # noqa: E402
from cut_hero_parts import fill_holes  # noqa: E402
import setfit  # noqa: E402

SRC_DIR = base.SRC_DIR
OUT_DIR = base.OUT_DIR
TMP_DIR = 'tools/rig/_sets_tmp'
CHECK_DIR = os.path.dirname(os.path.abspath(__file__))
SEAM = base.SEAM
PAD = 220                      # 무기 그림은 칸을 오른쪽으로 이만큼 넓혀 맞춤
WEAPON_ZONE = (540, 560, 1024 + PAD, 900)
GRIP_T = 0.59
ORB_AHEAD = (70, -10)          # 구슬(손잡이 없는 무기) 중심 = 주먹 + 이만큼

SETS = {
    'a': {'min_part': None, 'grip': None, 'legs_box': base.LEGS_BOX, 'leg_poly': base.LEG_N_POLY},
    'b': {'min_part': 20, 'grip': base.SWORD_GRIP_OLD, 'legs_box': (425, base.LEG_TOP_Y, 775, 982),
          'leg_poly': base.LEG_N_POLY[:6] + [(775, 840), (775, 982), (515, 982)] + base.LEG_N_POLY[9:]},
}
# 2차 세트 (D-071): 갑옷 세트는 A처럼, 긴 로브·그림자 자락 세트는 B처럼. 칼이 아닌 무기(창·석궁·지팡이·낫·구슬)는
# 칼날 가드가 없어 손잡이를 기본 칼 자리(SWORD_GRIP_OLD)로 — 칼(장검·마검)만 가드에서 찾음
for _v in 'ucdvwlm':
    _robe = _v in 'vm'
    SETS[_v] = dict(SETS['b' if _robe else 'a'], grip=None if _v in 'dl' else base.SWORD_GRIP_OLD, min_part=20 if _v in 'vwm' else None)
SETS['m']['grip'] = 'orb'   # 별빛 구슬: 손잡이가 없어 구슬 중심을 주먹 바로 앞(ORB_AHEAD)에 둠


def find_grip(mask):
    """칼의 축(주성분)에서 칼자루 끝과 가드(앞 40% 안에서 가장 넓은 곳)를 찾아 GRIP_T 지점"""
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs, ys], 1).astype(float)
    c = pts.mean(0)
    ax = np.linalg.svd(pts - c, full_matrices=False)[2][0]
    if ax[0] < 0:
        ax = -ax
    nrm = np.array([-ax[1], ax[0]])
    t, w = (pts - c) @ ax, (pts - c) @ nrm
    t0, L = t.min(), np.ptp(t)
    bins = np.arange(t0, t0 + L * 0.4, 2)
    widths = [np.ptp(w[(t >= a) & (t < a + 2)]) if ((t >= a) & (t < a + 2)).any() else 0 for a in bins]
    tg = bins[int(np.argmax(widths))] + 1
    tm = t0 + (tg - t0) * GRIP_T
    p = c + ax * tm + nrm * np.median(w[(t > t0) & (t < tg)])
    return int(round(p[0])), int(round(p[1]))


def cut_weapon(v, cfg):
    """세트 무기를 잘라 기본 칼처럼 주먹 자리로 옮긴 RGBA (칸 폭 W + PAD)"""
    orig = remove_key_background(base.SRC_SWORD, 'green', min_part=3000)
    H, W = orig.shape[:2]
    cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
    rows = np.broadcast_to(np.arange(H)[:, None], (H, W))
    old_sword = largest(poly_mask(orig.shape, base.SWORD_POLY) & (orig[..., 3] > 0) & ~((cols < 600) & (rows > 655)))
    orig_p = np.pad(orig, ((0, 0), (0, PAD), (0, 0)))
    body_old = np.pad((orig[..., 3] > 0) & ~grow(old_sword, np.ones((H, W), bool), 2), ((0, 0), (0, PAD)))

    ref = np.pad(setfit.keymask(np.asarray(Image.open(base.SRC_SWORD).convert('RGB'))), ((0, 0), (0, PAD)))
    region = np.zeros(ref.shape, bool)
    region[:560] = True
    rgb, iou, prm = setfit.fit(setfit.load(f'{SRC_DIR}/hero_{v}_weapon_gemini.png'), ref, region)
    print(f'[{v}] 무기 → 칼 든 원본(위쪽): IoU {iou:.3f} {prm}')
    new = remove_key_background(setfit.save_tmp(rgb, f'{TMP_DIR}/hero_{v}_weapon.png'), 'green', min_part=60)
    op_new = new[..., 3] > 0
    diff = np.abs(new[..., :3].astype(int) - orig_p[..., :3].astype(int)).max(2) > 50
    m = op_new & (~body_old | diff) & rect_mask(new.shape, WEAPON_ZONE)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    m = drop_specks(m, 60)
    main = largest(m)
    m = main | (m & ~main & drop_specks(m, 60))      # 떨어진 구슬·반짝이도 남김
    m = grow(m, op_new & rect_mask(new.shape, WEAPON_ZONE), 2)
    if cfg['grip'] == 'orb':
        ys, xs = np.nonzero(main)
        grip = (int(xs.mean()) - ORB_AHEAD[0], int(ys.mean()) - ORB_AHEAD[1])
    else:
        grip = cfg['grip'] or find_grip(main)
    dx, dy = base.FIST[0] - grip[0], base.FIST[1] - grip[1]
    print(f'[{v}] 무기 손잡이 {grip} → 주먹 {base.FIST} (이동 {dx}, {dy})')
    return np.roll(cut(new, m), (dy, dx), axis=(0, 1))


def cut_set(v):
    cfg = SETS[v]
    ref = setfit.keymask(np.asarray(Image.open(base.SRC_RIG).convert('RGB')))
    neu_rgb, iou1, p1 = setfit.fit(setfit.load(f'{SRC_DIR}/hero_{v}_neutral_gemini.png'), ref)
    region = np.zeros(ref.shape, bool)
    region[:380] = True
    region[760:] = True
    fwd_rgb, iou2, p2 = setfit.fit(setfit.load(f'{SRC_DIR}/hero_{v}_armfwd_gemini.png'), setfit.keymask(neu_rgb), region)
    print(f'[{v}] 기본 자세 → 원본: IoU {iou1:.3f} {p1} / 팔 든 그림 → 기본 자세(머리·다리 줄): IoU {iou2:.3f} {p2}')
    src = remove_key_background(setfit.save_tmp(neu_rgb, f'{TMP_DIR}/hero_{v}_neutral.png'), 'green', min_part=cfg['min_part'])
    fwd = remove_key_background(setfit.save_tmp(fwd_rgb, f'{TMP_DIR}/hero_{v}_armfwd.png'), 'green', min_part=cfg['min_part'])
    H, W = src.shape[:2]
    shape = src.shape
    opaque = src[..., 3] > 0
    cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
    rows = np.broadcast_to(np.arange(H)[:, None], (H, W))

    # 머리 (세트 그림 그대로)
    head_mask = (poly_mask(shape, base.HEAD_POLY) | (rows < 300)) & opaque
    head_img = cut(src, grow(head_mask, opaque, SEAM))
    head_cover = head_img[..., 3] > 0

    # 앞팔: 팔 내린/든 두 그림의 차이 (기본과 같은 방법)
    diff = np.abs(src[..., :3].astype(int) - fwd[..., :3].astype(int)).max(2) > 50
    diff |= (src[..., 3] > 0) != (fwd[..., 3] > 0)
    pauldron = poly_mask(shape, base.PAULDRON_POLY) & opaque
    arm = diff & opaque & rect_mask(shape, base.ARM_ZONE) & ~pauldron
    arm = cv2.morphologyEx(arm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    arm = largest(arm)
    arm = fill_holes(cv2.morphologyEx(arm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(bool))
    arm = grow(arm & opaque, opaque & rect_mask(shape, base.ARM_ZONE) & ~pauldron, SEAM)

    # 다리 (B는 작은 그림자 조각도 남김)
    legs_zone = rect_mask(shape, cfg['legs_box']) & opaque & (cols >= base.CAPE_X + 12)
    if cfg['min_part']:
        leg_f = drop_specks(poly_mask(shape, cfg['leg_poly']) & legs_zone, cfg['min_part'])
        leg_b = drop_specks(legs_zone & ~leg_f, cfg['min_part'])
    else:
        leg_f = largest(poly_mask(shape, cfg['leg_poly']) & legs_zone)
        leg_b = largest(legs_zone & ~leg_f)

    cape = opaque & (cols < base.CAPE_MARGIN_X) & (rows >= base.CAPE_TOP_Y) & ~legs_zone

    torso = (opaque & ~arm & ~(cape & ((cols < base.CAPE_X) | (rows >= base.LEG_CUT_Y - 10)))
             & ~((leg_f | leg_b) & (rows >= base.LEG_CUT_Y))
             & ~(head_cover & (rows < 400)))
    torso = largest(torso)
    torso_img = cut(src, torso)
    fill = (rect_mask(shape, base.TORSO_FILL_ZONE) & arm & (torso_img[..., 3] == 0) & (fwd[..., 3] == 255)
            & ~rect_mask(shape, base.ARMFWD_ARM))
    torso_img[fill] = fwd[fill]
    hole = rect_mask(shape, base.TORSO_FILL_ZONE) & arm & (torso_img[..., 3] == 0) & (cols < 598)
    torso_img = fill_flat(torso_img, hole, rect_mask(shape, (440, 520, 520, 620)))

    ys, xs = base.CAPE_SPLIT_Y
    parts = {
        'torso': torso_img,
        'head': head_img,
        'pauldron': cut(src, pauldron),
        'armF': cut(src, arm),
        'sword': cut_weapon(v, cfg),
        'cape1': cut(src, cape & (rows < ys)),
        'cape2': cut(src, cape & (rows >= xs)),
    }
    for side, leg in (('F', leg_f), ('B', leg_b)):
        thigh_end, shin_start = base.KNEE_SPLIT[side]
        parts[f'thigh{side}'] = cut(src, leg & (rows < thigh_end))
        parts[f'shin{side}'] = cut(src, leg & (rows >= shin_start))
    empty = [k for k, p in parts.items() if not p[..., 3].any()]
    if empty:
        raise SystemExit(f'[{v}] 비어 있는 조각: {empty}')

    named = {f'{k}_{v}': p for k, p in parts.items()}
    layout_parts = save_parts(named, OUT_DIR)
    ref_img = src.copy()
    order = ['cape2', 'cape1', 'shinB', 'thighB', 'shinF', 'thighF', 'torso', 'head', 'armF', 'pauldron']
    rest_check(OUT_DIR, {'parts': layout_parts}, [f'{k}_{v}' for k in order], ref_img,
               os.path.join(CHECK_DIR, f'_rest_check_hero_{v}.png'))
    print(f'[{v}] 조각: {list(named)}')
    return layout_parts


def main():
    path = f'{OUT_DIR}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    letters = sys.argv[1:] or ['a', 'b']
    for v in letters:
        layout['parts'].update(cut_set(v))
    import robe_legs   # 긴 로브 세트(b·v): 다리 조각의 로브를 몸통으로 (D-119)
    for v in letters:
        if v in robe_legs.CUT_Y:
            robe_legs.merge(layout, v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print('rig.json 부위 그림:', len(layout['parts']), '개')


if __name__ == '__main__':
    main()
