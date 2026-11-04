"""
새 캐릭터 세트 부위 그림 자르기 (파츠 확장 2차 D-071의 남은 그림 단계) → assets/sprites/rig/<id>/<부위>_<글자>.png + rig.json에 추가

실행: 프로젝트 루트에서
  python tools/rig/cut_newchar_sets.py diver a b u      # 세트 글자 여럿 (없으면 그림이 있는 세트 전부)
  python tools/rig/cut_newchar_sets.py diver a --preview # 자르는 영역만 그려 확인 (tools/rig/_cut_<id>_set_<글자>.png)

입력 (assets/sprites/parts/<id>/src, Gemini "이미지 복사" 1024 그림 — 요청 글은 tools/images/make_newchar_set_prompts.py)
 - <id>_set_<글자>_gemini.png         : 기본 전신(<id>_1_gemini.png)을 첨부해 "같은 자세·자리로 장비만" 바꾼 세트 전신
 - <id>_set_<글자>_armless_gemini.png : 세트 전신 한 장만 첨부해 두 팔(+ 든 것)을 지운 것

방법 — 기본 그림을 자른 cut_newchar_parts.py의 선을 그대로 씀 (뼈대·피벗·소켓은 기본 한 벌을 같이 씀)
 1. 세트 그림을 기본 전신에, 팔 없는 그림을 세트 전신에 ±16px 안에서 윤곽이 가장 많이 겹치게 옮김 (보통 0~1px)
 2. 팔 = 전신과 팔 없는 그림의 차이, 머리 = 머리 다각형 + 그 위로 솟은 것(높은 모자·투구 장식), 다리·뒷머리 = 기본 선
 3. 손목 관절이 있는 캐릭터(cut_joints.py의 손)는 세트 팔을 기본 소매 자리(4px 넓힘)와 나머지(손 + 무기)로 나눔.
    손이 비면(무기가 소매 안에만 있으면) 손 조각은 1px 빈 그림 — 게임에서 기본 손이 대신 그려지지 않게
 4. 조각 이름은 <부위>_<글자> (armF_a, handF_a …). 게임은 세트 파츠(rigUpgrade + rigVariant)의 <부위>_up 뼈를
    <부위>_<글자>로 바꿔 그림 (rigAvatar.variantAlias)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rigcut import poly_mask, largest, grow, cut, save_parts, rest_check, drop_specks  # noqa: E402
import cut_newchar_parts  # noqa: E402
from cut_newchar_parts import CHARS, ORDER, load, masks_for, preview as base_preview  # noqa: E402
from cut_joints import CHARS as JOINTS, mask_of  # noqa: E402

_arm_masks = cut_newchar_parts.arm_masks

LETTERS = ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm']
SHIFT = 16          # 맞추기 찾는 범위(px)
SLEEVE_GROW = 4     # 기본 소매 자리를 이만큼 넓혀 세트 소매로


def shift_img(img, dx, dy):
    out = np.zeros_like(img)
    H, W = img.shape[:2]
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = img[ys, xs]
    return out


def align(img, ref, region=None):
    """img를 ref 윤곽에 가장 많이 겹치게 옮긴 것과 (dx, dy, IoU). region = 비교할 곳(팔 빼고 머리·다리 줄 등)"""
    a = ref[..., 3] > 0
    b = img[..., 3] > 0
    if region is not None:
        a, b = a & region, b
    small = lambda m: cv2.resize(m.astype(np.uint8), (256, 256), interpolation=cv2.INTER_AREA) > 0
    best = (-1, 0, 0)
    sa = small(a)
    for dy in range(-SHIFT, SHIFT + 1, 4):
        for dx in range(-SHIFT, SHIFT + 1, 4):
            sb = small(shift_img(b, dx, dy) & (region if region is not None else True))
            iou = (sa & sb).sum() / max(1, (sa | sb).sum())
            if iou > best[0]:
                best = (iou, dx, dy)
    _, cx, cy = best
    best = (-1, 0, 0)
    for dy in range(cy - 4, cy + 5):
        for dx in range(cx - 4, cx + 5):
            sb = shift_img(b, dx, dy) & (region if region is not None else True)
            iou = (a & sb).sum() / max(1, (a | sb).sum())
            if iou > best[0]:
                best = (iou, dx, dy)
    iou, dx, dy = best
    return shift_img(img, dx, dy), (dx, dy, round(float(iou), 3))


def _back_gray_to_torso(x_max, y_max=0):
    """머리 다각형(방송자는 기본 머리에 붙은 모니터 자리까지 넓음)에 걸린 등짐 회색 픽셀을 몸통으로 — 머리가 돌 때
    등짐이 갈라지지 않게. x < x_max 또는 y < y_max 인 픽셀 중 붉은 머리카락이 아닌 것만 (스피커 금테 등도 같이)"""
    def fix(masks, full):
        H, W = full.shape[:2]
        rows = np.broadcast_to(np.arange(H)[:, None], (H, W))
        cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
        r, g, b = (full[..., i].astype(int) for i in range(3))
        hair = (r - g > 60) & (r - b > 40)
        move = masks['head'] & ~hair & ((cols < x_max) | (rows < y_max))
        masks['head'] &= ~move
        masks['torso'] |= move
    return fix


def _clip_arm(arm, poly):
    """팔 없는 그림이 팔 밖(코트 자락·배지 등)까지 바꿔 차이에 섞인 것을 팔 다각형 밖은 버림"""
    def fix(masks, full):
        masks[arm] &= poly_mask(full.shape[:2], poly)
    return fix


SET_FIX = {
    ('broadcaster', 'c'): _back_gray_to_torso(380),        # 송신기 배낭 안테나
    ('broadcaster', 'v'): _back_gray_to_torso(400, 178),   # 등에 진 스피커 탑 (왕관 위로 솟음)
    # 해킹 태블릿 팔 — 팔 없는 그림(3번째 시도)이 코트 왼쪽 자락·주머니 배지·모니터 한 점까지 바꿈
    ('broadcaster', 'w'): _clip_arm('armB', [(320, 450), (440, 450), (440, 590), (390, 605), (395, 705),
                                             (300, 705), (215, 545), (290, 515)]),
}


def _arm_masks_split(full, armless, acfg, rows, op1, op2):
    """두 팔 차이가 몸 앞에서 이어져 덩어리가 하나뿐이면(설계자 d 등) 두 어깨 피벗 가운데 x로 나눔"""
    try:
        return _arm_masks(full, armless, acfg, rows, op1, op2)
    except IndexError:
        cols = np.broadcast_to(np.arange(rows.shape[1])[None, :], rows.shape)
        diff = np.abs(full[..., :3].astype(int) - armless[..., :3].astype(int)).max(axis=2) > 48
        arms = op1 & (diff | ~op2) & (rows >= acfg.get('arm_top', acfg['head_y']))
        for x0, y0, x1, y1 in acfg.get('not_arm', []):
            arms &= ~((cols >= x0) & (cols < x1) & (rows >= y0) & (rows < y1))
        arms = cv2.morphologyEx(arms.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        arms = drop_specks(arms, 300)
        mid = acfg['_split_x']
        print(f'  (팔 덩어리가 하나 → x {mid:.0f}에서 나눔)')
        return {'armF': arms & (cols < mid), 'armB': arms & (cols >= mid)}   # arm_masks와 같이 왼쪽이 armF 키


cut_newchar_parts.arm_masks = _arm_masks_split   # masks_for가 부르는 팔 나누기


def set_masks(cfg, full, armless):
    """기본 선으로 자르되 머리 다각형 위로 솟은 몸통 픽셀(높은 모자·잠망경 등)은 머리로"""
    piv = cfg['pivots']
    cfg = {**cfg, 'arm': {**cfg['arm'], '_split_x': (piv['armF'][0] + piv['armB'][0]) / 2}}
    masks = masks_for(cfg, full, armless)
    H, W = full.shape[:2]
    rows = np.broadcast_to(np.arange(H)[:, None], (H, W))
    top = min(y for _, y in cfg['head_poly'])
    above = masks['torso'] & (rows < top)
    if above.any():
        masks['head'] = masks['head'] | above
        masks['torso'] = masks['torso'] & ~above
    # 팔 감지 줄(arm_top)보다 위로 치켜든 무기·소품(세트마다 다름 — 머리 위로 든 꼭두각시 십자틀 등):
    # 전신에만 있고 팔 없는 그림엔 없는 덩어리 중 팔 조각에 닿은 것은 그 팔로
    # (몸 앞을 지나는 자루는 팔 없는 그림에도 몸이 있어 색 차이로 찾음 — arm_top 위 줄만)
    diff = np.abs(full[..., :3].astype(int) - armless[..., :3].astype(int)).max(axis=2) > 48
    arm_top = cfg['arm'].get('arm_top', cfg['arm']['head_y'])
    extra = ((full[..., 3] > 0) & ((armless[..., 3] == 0) | (diff & (rows < arm_top)))
             & ~masks['head'] & ~masks['armF'] & ~masks['armB'])
    extra = cv2.morphologyEx(extra.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    n, lab, _, _ = cv2.connectedComponentsWithStats(extra.astype(np.uint8), connectivity=8)
    for arm in ('armF', 'armB'):
        while True:   # 자루 → 십자틀처럼 이어진 덩어리를 차례로 (7px 안이면 닿은 것으로)
            near = cv2.dilate(masks[arm].astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
            ids = set(np.unique(lab[near & (lab > 0)])) - {0}
            if not ids:
                break
            for i in ids:
                masks[arm] |= lab == i
                lab[lab == i] = 0
    # 팔 없는 그림이 군데군데 조금 달라져 생긴 잔점(설계자 l 날개·다리 위 수백 px)은 팔에서 빼기
    # — 팔과 함께 돌면 떠다니는 점이 됨. 팔 본체에 닿지 않은 600px 미만 덩어리만 (몸통은 팔 없는 그림이라 그대로)
    for arm in ('armF', 'armB'):
        main = largest(masks[arm])
        touch = cv2.dilate(main.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        n, lab, st, _ = cv2.connectedComponentsWithStats((masks[arm] & ~main).astype(np.uint8), connectivity=8)
        for i in range(1, n):
            blob = lab == i
            if st[i, cv2.CC_STAT_AREA] < 600 and not (blob & touch).any():
                masks[arm] &= ~blob
    # 몸통 본체와 떨어져 머리에 붙은 작은 덩어리(투구 옆 등불 등)도 머리로
    # — 목 관절보다 아래로 내려오는 덩어리(팔을 지워 몸과 떨어진 방송자 a 등에 멘 앰프 등)는 몸통에 둠
    torso = masks['torso']
    main = largest(torso)
    near_head = cv2.dilate(masks['head'].astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((torso & ~main).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        blob = lab == i
        if (blob & near_head).any() and st[i, cv2.CC_STAT_TOP] + st[i, cv2.CC_STAT_HEIGHT] <= piv['head'][1]:
            masks['head'] |= blob
            masks['torso'] &= ~blob
    return masks


def split_hands(cid, layout, out_dir, masks, full):
    """손목 관절이 있는 팔: 세트 팔 = 기본 소매 자리(+4px) / 나머지(손 + 무기) → {손 이름: 마스크}"""
    hands = {}
    for arm_bone, hand_bone in JOINTS.get(cid, {}).get('hands', {}).items():
        base_sleeve = mask_of(layout, arm_bone, out_dir)
        arm = masks[arm_bone]
        sleeve = arm & grow(base_sleeve, np.ones_like(base_sleeve), SLEEVE_GROW)
        hand = arm & ~sleeve
        hand = cv2.morphologyEx(hand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        if hand.sum() < 150:      # 무기가 소매 자리 안에만 → 손 없이 팔 한 장
            hand = np.zeros_like(hand)
        masks[arm_bone] = arm & ~hand
        hands[hand_bone] = hand
    return hands


def preview(cfg, masks, full, path):
    base_preview(cfg, masks, full, path)
    im = Image.open(path).convert('RGB')
    vis = np.asarray(im).copy()
    for k, m in masks.items():
        if k.startswith('hand') or k.startswith('anchor'):
            vis[m] = (vis[m] * 0.4 + np.array((255, 230, 40)) * 0.6).astype(np.uint8)
    Image.fromarray(vis).save(path)


def cut_set(cid, v, layout, show=False):
    cfg = CHARS[cid]
    src = f'assets/sprites/parts/{cid}/src/'
    out_dir = f'assets/sprites/rig/{cid}'
    base = load(src + cfg['src'][0], cfg)
    full = load(src + f'{cid}_set_{v}_gemini.png', cfg)
    armless = load(src + f'{cid}_set_{v}_armless_gemini.png', cfg)
    full, p1 = align(full, base)
    H = full.shape[0]
    rows = np.broadcast_to(np.arange(H)[:, None], full.shape[:2])
    body_rows = (rows < cfg['arm'].get('arm_top', cfg['arm']['head_y'])) | (rows > 780)   # 팔이 없는 줄(머리·발)로 맞춤
    armless, p2 = align(armless, full, body_rows)
    print(f'[{cid} {v}] 세트 → 기본 {p1} · 팔 없음 → 세트 {p2}')
    masks = set_masks(cfg, full, armless)
    if (cid, v) in SET_FIX:
        SET_FIX[(cid, v)](masks, full)
    hands = split_hands(cid, layout, out_dir, masks, full)
    if show:
        preview(cfg, {**masks, **hands}, full, os.path.join(HERE, f'_cut_{cid}_set_{v}.png'))
        return {}
    parts = {}
    split_arms = {arm for arm, hand in JOINTS.get(cid, {}).get('hands', {}).items() if hands.get(hand) is not None and hands[hand].any()}
    for k, m in masks.items():
        # 손을 뗀 팔: 뼈는 소매(<팔>_<글자>_sleeve.png), <팔>_<글자>.png(손까지 전체)는 연구소 카드 그림 — 기본 그림과 같은 방식
        key = f'{k}_{v}_sleeve' if k in split_arms else f'{k}_{v}'
        parts[key] = cut(full if k.startswith('arm') else armless, m)
    for k, m in hands.items():
        if m.any():
            parts[f'{k}_{v}'] = cut(full, m)
    empty = [k for k, p in parts.items() if not p[..., 3].any()]
    if empty:
        raise SystemExit(f'[{cid} {v}] 비어 있는 조각: {empty}')
    named = save_parts(parts, out_dir)
    for arm in split_arms:
        named[f'{arm}_{v}'] = named.pop(f'{arm}_{v}_sleeve')
        hand = JOINTS[cid]['hands'][arm]
        save_parts({f'{arm}_{v}': cut(full, masks[arm] | hands[hand])}, out_dir)   # 카드 그림 (rig.json에는 안 넣음)
    for k, m in hands.items():   # 손이 없는 세트: 1px 빈 그림 (기본 손이 대신 그려지지 않게)
        if not m.any():
            Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(f'{out_dir}/{k}_{v}.png')
            named[f'{k}_{v}'] = {'src': f'{k}_{v}.png', 'x': 0, 'y': 0, 'w': 1, 'h': 1}
    order = [f'{k}_{v}' for k in ORDER if f'{k}_{v}' in named] + [f'{k}_{v}' for k in hands if f'{k}_{v}' in named]
    rest_check(out_dir, {'parts': named}, order, full, os.path.join(HERE, f'_rest_check_{cid}_set_{v}.png'))
    print(f'[{cid} {v}] 조각: {sorted(named)}')
    return named


def main():
    cid = sys.argv[1]
    show = '--preview' in sys.argv
    letters = [a for a in sys.argv[2:] if not a.startswith('--')]
    src = f'assets/sprites/parts/{cid}/src/'
    if not letters:
        letters = [v for v in LETTERS if os.path.exists(src + f'{cid}_set_{v}_armless_gemini.png')]
    out_dir = f'assets/sprites/rig/{cid}'
    path = f'{out_dir}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    for v in letters:
        layout['parts'].update(cut_set(cid, v, layout, show))
    if show:
        print('preview', os.path.join(HERE, f'_cut_{cid}_set_*.png'))
        return
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print('rig.json 부위 그림:', len(layout['parts']), '개')


if __name__ == '__main__':
    main()
