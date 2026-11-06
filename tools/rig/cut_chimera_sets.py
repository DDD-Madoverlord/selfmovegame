"""
합성괴인 A·B 세트 부위 그림 자르기 (D-050 파츠 확장) → assets/sprites/rig/chimera/<부위>_a.png · <부위>_b.png + rig.json에 추가

실행: 프로젝트 루트에서  python tools/rig/cut_chimera_sets.py [글자…]   (기본 a b — 2차 세트 u c d v w l m, D-071; 기본 그림은 cut_chimera_parts.py가 만든 것을 그대로 둠)

입력 (Gemini 원본 크기 다운로드, assets/sprites/parts/chimera/src/, 2026-10-17)
 - chimera_<a|b>_base_gemini.png   : 세트 전신 — 기준 원본(chimera_base)을 첨부해 장비만 바꾼 것 (날개·꼬리는 그대로)
 - chimera_<a|b>_nowing_gemini.png : 같은 대화에서 날개·꼬리를 지운 것 (B는 원본 크기 파일에 남은 날개 잔상을 지운 파일)

방법
 1. setfit으로 로고를 지우고 기본 원본 칸(886×1024)에 맞춘다 (날개 없는 그림은 세트 전신의 왼쪽 — 날개·꼬리가 없는 쪽 — 에 맞춤)
 2. cut_chimera_parts와 같은 선으로 자른다 (날개·꼬리 = 날개 없는 그림과 다른 곳, 등은 날개 없는 그림으로 채움)
    세트 장비가 기본 선 밖으로 나오는 곳만 넓힘: 앞팔(A 쇠망치, B 산탄총 — 왼쪽 아래로 큼), B 투구 안테나(머리 왼쪽 위)
 3. A의 초록 약병·관은 배경 초록과 비슷해 배경 지우기에서 구멍이 남 → 윤곽선 안에 갇힌 구멍 중 배경색이 아닌 것(r·b가 높은 초록)을 되살림
 4. 저장은 기본과 같이 좌우 반전 (오른쪽을 보게)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigcut import remove_key_background, poly_mask, rect_mask, largest, grow, cut, save_parts, rest_check  # noqa: E402
import cut_chimera_parts as base  # noqa: E402
import setfit  # noqa: E402

SRC_DIR = base.SRC_DIR
OUT_DIR = base.OUT_DIR
TMP_DIR = 'tools/rig/_sets_tmp'
CHECK_DIR = os.path.dirname(os.path.abspath(__file__))
SEAM = base.SEAM
NOWING_FIT_X = 480            # 날개 없는 그림은 이 x 왼쪽(머리·앞팔·앞다리)으로 세트 전신에 맞춤
VIAL_RB = 25                  # 구멍 덩어리의 min(r, b) 평균이 이보다 크면 약병 초록(배경은 0~15)

# 앞팔: 기본 선을 왼쪽·아래로 넓힘 (쇠망치 머리·산탄총 총열)
ARM_F_POLY = [(0, 553), (80, 553), (170, 558), (178, 610), (166, 660), (160, 700), (158, 772), (128, 830),
              (122, 865), (0, 865)]
HEAD_EXTRA = {'a': None, 'b': [(150, 100), (205, 100), (205, 300), (150, 300)],   # B 투구 안테나
              'u': [(50, 180), (185, 180), (185, 315), (50, 315)],               # 2차 u 완전체 키메라: 어깨 위 독수리 머리
              'd': [(360, 90), (520, 90), (520, 320), (360, 320)]}               # 2차 d 박쥐 음파: 큰 박쥐 귀
WING_KEEP_ORANGE = {'u', 'm', 'd'}   # 날개가 금·갈색(주황 판정)인 세트 — 기본은 몸통 주황을 날개에서 빼지만 이 세트는 날개 색이라 빼지 않음


def restore_vials(img):
    """배경 지우기로 생긴 '갇힌 구멍' 중 약병 초록인 덩어리를 원래 색으로 되살림"""
    alpha = img[..., 3] > 0
    holes = base_fill_holes(alpha) & ~alpha
    n, lab, st, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), connectivity=4)
    rb = np.minimum(img[..., 0], img[..., 2]).astype(float)
    out = img.copy()
    restored = 0
    for i in range(1, n):
        m = lab == i
        if rb[m].mean() > VIAL_RB:
            out[m, 3] = 255
            restored += int(st[i, cv2.CC_STAT_AREA])
    return out, restored


def base_fill_holes(mask):
    m = mask.astype(np.uint8)
    h, w = m.shape
    flood = m.copy()
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
    return mask | (flood == 0)


def cut_set(v):
    ref = setfit.keymask(np.asarray(Image.open(base.SRC_BASE).convert('RGB')))
    full_rgb, iou1, p1 = setfit.fit(setfit.load(f'{SRC_DIR}/chimera_{v}_base_gemini.png'), ref)
    region = np.zeros(ref.shape, bool)
    region[:, :NOWING_FIT_X] = True
    less_rgb, iou2, p2 = setfit.fit(setfit.load(f'{SRC_DIR}/chimera_{v}_nowing_gemini.png'), setfit.keymask(full_rgb), region)
    print(f'[{v}] 전신 → 기본: IoU {iou1:.3f} {p1} / 날개 없는 그림 → 전신(왼쪽): IoU {iou2:.3f} {p2}')
    src = remove_key_background(setfit.save_tmp(full_rgb, f'{TMP_DIR}/chimera_{v}_full.png'), 'green')
    nowing = remove_key_background(setfit.save_tmp(less_rgb, f'{TMP_DIR}/chimera_{v}_less.png'), 'green')
    src, r1 = restore_vials(src)
    nowing, r2 = restore_vials(nowing)
    if r1 or r2:
        print(f'[{v}] 약병 초록 되살림: 전신 {r1}px, 날개 없는 그림 {r2}px')

    H, W = src.shape[:2]
    shape = src.shape
    opaque = src[..., 3] > 0
    cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
    rows = np.broadcast_to(np.arange(H)[:, None], (H, W))

    differs = (nowing[..., 3] == 0) | (np.abs(src[..., :3].astype(int) - nowing[..., :3].astype(int)).max(2) > 60)
    orange_out = np.zeros(shape[:2], bool) if v in WING_KEEP_ORANGE else (base.is_orange(src) & (rows > 200))
    wing = poly_mask(shape, base.WING_POLY) & opaque & differs & ~orange_out
    wing = cv2.morphologyEx(wing.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool)
    wing = largest(wing & opaque)
    tail = largest(poly_mask(shape, base.TAIL_POLY) & opaque & differs)

    head_core = poly_mask(shape, base.HEAD_POLY) & opaque
    if HEAD_EXTRA.get(v):
        head_core |= poly_mask(shape, HEAD_EXTRA[v]) & opaque
    head = grow(head_core, opaque, SEAM)
    arm_f = largest(poly_mask(shape, ARM_F_POLY) & opaque & ~head_core)
    arm_b = largest(poly_mask(shape, base.ARM_B_POLY) & opaque & ~wing & ~tail)
    leg_f = largest(poly_mask(shape, base.LEG_L_POLY) & opaque & ~arm_f)
    leg_b = largest(poly_mask(shape, base.LEG_R_POLY) & opaque & ~arm_b & ~tail)

    body_side = cv2.dilate((opaque & ~head_core).astype(np.uint8), np.ones((base.NECK_BAND * 2 + 1,) * 2, np.uint8)).astype(bool)
    head_inner = head_core & ~body_side
    torso = (opaque & ~head_inner & ~arm_f & ~arm_b & ~wing & ~tail
             & ~((leg_f | leg_b) & (rows >= base.LEG_CUT_Y)))
    torso = largest(torso)
    torso_img = cut(src, torso)
    fill = rect_mask(shape, base.BACK_FILL_ZONE) & wing & (nowing[..., 3] == 255) & (torso_img[..., 3] == 0)
    torso_img[fill] = nowing[fill]

    covered = torso | head | arm_f | arm_b | wing | tail | leg_f | leg_b
    left = opaque & ~covered
    print(f'[{v}] 어느 조각에도 안 들어간 px: {int(left.sum())}')
    if v not in ('a', 'b'):   # 2차 세트 (D-071): 남은 픽셀(장식이 기본 선 밖으로 큰 세트)
        # 남은 덩어리마다 맞닿은 움직이는 조각에 붙임 (낫 끝·날개 끝·발톱 끝) — 예전엔 몸통에 붙여서
        # 그 조각이 움직이면 끝만 떨어져 보였음 (디스코드 QA 11-05 같은 종류 점검, v 낫 끝). 안 닿으면 날개 자리면 날개, 아니면 몸통
        # 머리는 SEAM만큼 넓힌 조각(head)으로 봄 — 머리 장식 끝(d 박쥐 귀·l 투구 깃털·m 사슴뿔)은 그 바깥에서 이어짐
        movers = {'armF': arm_f, 'armB': arm_b, 'legF': leg_f, 'legB': leg_b, 'tail': tail, 'wing': wing, 'head': head}
        near = {k: cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) for k, m in movers.items()}
        n, lab = cv2.connectedComponents(left.astype(np.uint8), connectivity=8)
        moved = {k: 0 for k in movers}
        to_torso = np.zeros(shape[:2], bool)
        for i in range(1, n):
            comp = lab == i
            touch = {k: int((near[k] & comp).sum()) for k in movers}
            best = max(touch, key=touch.get)
            if touch[best] == 0:
                best = 'wing' if (comp & poly_mask(shape, base.WING_POLY)).any() else None
            if best is None:
                to_torso |= comp
                continue
            movers[best] |= comp
            moved[best] += int(comp.sum())
        arm_f, arm_b, leg_f, leg_b, tail, wing, head = (movers[k] for k in ('armF', 'armB', 'legF', 'legB', 'tail', 'wing', 'head'))
        torso_img[to_torso] = src[to_torso]
        print(f'[{v}] → ' + ' · '.join(f'{k} {px}px' for k, px in moved.items() if px) + f' · 몸통 {int(to_torso.sum())}px')

    parts = {
        'torso': torso_img,
        'head': cut(src, head),
        'armF': cut(src, grow(arm_f, opaque & ~head_core, SEAM)),
        'armB': cut(src, grow(arm_b, opaque & ~wing & ~tail, SEAM)),
        'wing': cut(src, wing),
        'legF': cut(src, leg_f),
        'legB': cut(src, leg_b),
        'tail1': cut(src, tail & (cols < 752)),
        'tail2': cut(src, tail & (cols >= 738)),
    }
    empty = [k for k, p in parts.items() if not p[..., 3].any()]
    if empty:
        raise SystemExit(f'[{v}] 비어 있는 조각: {empty}')

    if v not in ('a',):   # 갇힌 배경 초록 찌꺼기 지우기 (A만 초록 약병이 있어 뺌) — 2차 세트 (D-071)
        for p in parts.values():
            r, g, bb = p[..., 0].astype(int), p[..., 1].astype(int), p[..., 2].astype(int)
            p[(g > 150) & (g > r + 60) & (g > bb + 60), 3] = 0
    flipped = {f'{k}_{v}': np.ascontiguousarray(p[:, ::-1]) for k, p in parts.items()}
    layout_parts = save_parts(flipped, OUT_DIR)
    order = ['tail1', 'tail2', 'legB', 'legF', 'torso', 'wing', 'armB', 'armF', 'head']
    rest_check(OUT_DIR, {'parts': layout_parts}, [f'{k}_{v}' for k in order], np.ascontiguousarray(src[:, ::-1]),
               os.path.join(CHECK_DIR, f'_rest_check_chimera_{v}.png'))
    print(f'[{v}] 조각: {list(flipped)}')
    return layout_parts


def main():
    path = f'{OUT_DIR}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    letters = sys.argv[1:] or ['a', 'b']   # 2차 세트 (D-071): python tools/rig/cut_chimera_sets.py u c d v w l m
    for v in letters:
        layout['parts'].update(cut_set(v))
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print('rig.json 부위 그림:', len(layout['parts']), '개')


if __name__ == '__main__':
    main()
