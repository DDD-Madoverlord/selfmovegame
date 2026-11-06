"""
거대괴수 A·B 세트 부위 그림 자르기 (D-050 파츠 확장) → assets/sprites/rig/kaiju/<부위>_a.png · <부위>_b.png + rig.json에 추가

실행: 프로젝트 루트에서  python tools/rig/cut_kaiju_sets.py [글자…]   (기본 a b — 2차 세트는 u c d v w l m, D-071)
      (기본 그림은 cut_kaiju_parts.py가 만든 것을 그대로 둠)

입력 (Gemini 원본 크기 다운로드, assets/sprites/parts/kaiju/src/)
 - kaiju_<a|b>_step2_gemini.png : 세트 전신 — 기본 리그 그림(kaiju_step2의 위쪽 큰 괴수)을 첨부해 "같은 자세·자리로 장비만" 바꾼 것
 - kaiju_<a|b>_step3_gemini.png : 같은 대화에서 팔·아래턱·꼬리를 지운 몸

방법
 1. 맞추기: 세트 전신을 기본 리그 그림(450×345 칸)과 윤곽이 가장 많이 겹치는 배율·자리로 줄이고,
    팔 없는 몸은 세트 전신과 머리·다리 줄이 가장 많이 겹치게 맞춘다 (Gemini가 캔버스 비율을 조금 바꿀 때가 있음)
 2. 자르기: 세트 그림은 가시·집게·촉수처럼 기본 그림과 윤곽이 달라 기본 자르는 다각형을 그대로 쓰면 끝이 잘린다
    → 팔·아래턱·꼬리는 "전신 - 팔 없는 몸" 차이에서 자리별로 고른다. 머리·다리·몸통 경계와 뼈 위치는 기본과 같게
 3. 같은 3배 확대로 저장해 기본 부위 그림과 크기가 같다 (게임은 rigAvatar.setVariants로 그림 키만 바꿔 그림)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigcut import remove_key_background, poly_mask, rect_mask, largest, grow, drop_specks, cut, save_parts, rest_check
import cut_kaiju_parts as base

SRC_DIR = 'assets/sprites/parts/kaiju/src'
OUT_DIR = 'assets/sprites/rig/kaiju'
TMP_DIR = 'tools/rig/_sets_tmp'
W, H = base.CROP[2], base.CROP[3]       # 기본 리그 그림 칸 (450×338)
FRAME_H = 345                           # Gemini에 첨부한 참고 그림의 칸 (450×345) — 이 칸에서 맞춘 뒤 H로 자름
MAGENTA = (253, 0, 249)

# 자리별로 차이(전신 - 팔 없는 몸)를 고르는 범위 (기본 좌표)
ARM_ZONE = (290, 90, W, 250)            # 앞으로 뻗은 팔 (집게·촉수가 기본 팔보다 길고 높음)
JAW_ZONE = (262, 95, 372, 165)
TAIL_ZONE_X = 205                       # 꼬리: 이 x 왼쪽
HEAD_EXTRA = (252, 0, 380, 64)          # 머리 위 장식(가시 왕관 등)은 기본 머리 다각형 위로 나옴
# 세트별로 기본 머리·턱 선 밖으로 나오는 곳 (기본 좌표). 안 넣으면 그 끝이 몸통 조각에 남아 물기 때 떨어져 보임
# d 늪지 포식자 '악어 턱 머리': 긴 코끝(x 372~404)·아래턱 끝(x 356~370) (디스코드 QA 11-05 홍도도)
HEAD_ADD = {'d': [(352, 66), (408, 76), (408, 124), (366, 124), (356, 116)],
            'l': [(376, 8), (402, 8), (402, 66), (376, 66)]}   # l 종말의 거신: 앞 뿔 끝 (x 380~389, 같은 종류 점검)
JAW_ADD = {'d': [(350, 119), (374, 119), (374, 147), (346, 147)]}
# 입 틈: 원래 그림은 윗니와 아래턱 사이 입 틈이 뚫려 있음(배경이 보임). d는 팔 없는 몸에 회색 닫힌 턱이 그려져 있어,
# 그걸로 턱 뒤를 채우면 입을 벌릴 때 턱이 두 겹처럼 보였고(디스코드 QA 11-05), 입안 색으로 칠해도 띠만 떠 보였음
# → 아래턱을 가장 크게 벌리는 각도(kaijuRig 물기 +14°)로 돌려 봤을 때 드러나는 자리는 원래 입 틈처럼 비움.
#   그 밖의 턱 뒤(목)는 몸통 조각에 팔 없는 몸으로 채워 턱을 다물 때 목이 보이게 (머리 조각에는 채우지 않음)
MOUTH_OPEN = {'d': 14}
MOUTH_THROAT_Y = 128   # 팔 없는 몸 d의 회색 닫힌 턱 아래 끝 (기본 좌표) — 이 아래만 목으로 채움
# 입안 그림 (11-06 사용자 "Gemini에게 다시 그려 더 자세히"): 머리·목을 6배로 키워 첨부하고 "아래턱만 지우고 그 자리에
# 입안(어두운 목구멍·잇몸·건너편 작은 이빨)을, 혀 없이, 나머지는 그대로" → 아래턱 없는 머리 그림 (assets/.../src).
# 아래턱 자리와 입 틈(원래 그림에서 비어 있던 곳)의 머리 조각을 이 그림으로 채움 — 벌리면 입안, 꽉 물면 그 아래 목·허공이
# 그림대로 보임. 상자 = 첨부한 칸(기본 좌표), 그림은 같은 칸 비율 그대로 (맞추기 IoU 0.998, 어긋남 0)
# 두 장: base = 아래턱 없는 머리(뒤쪽 목구멍만, 코 밑은 허공 — 첫 시도, 참고용),
#       open = 코끝까지 입안(건너편 잇몸·위로 솟은 작은 이빨 — 입 틈과 벌릴 때 드러나는 곳에 씀)
MOUTH_ART = {'d': {'base': 'kaiju_d_mouth_gemini.png', 'open': 'kaiju_d_mouth_open_gemini.png',
                   'wide': 'kaiju_d_mouth_wide_gemini.png', 'cavity': 'kaiju_d_mouth_cavity_gemini.png', 'box': (225, 5, 425, 180)}}
# wide = 같은 머리에 아래턱만 더 벌린 그림(Gemini) — '건너편 아래턱' 조각을 만들어 보려던 참고 그림 (안 씀)
# cavity = 아래턱을 지우고 입가~코끝을 이빨·잇몸 없는 매끈한 어두운 입안으로 (씀) — open(건너편 잇몸·이빨)은 벌리면 진짜 아래턱 위에
#          가짜 아래턱이 한 겹 더 보여 찢어진 금처럼 보였음 (사용자 11-06 'gif에서 입이 여전히 찢어진다')
MOUTH_ART_ZONE = (262, 95, 380, 151)
CAVITY_MAX = 95   # 입안 그림 밝기 상한 (가장 밝은 채널) — 테두리의 밝은 빨강을 눌러 매끈한 어두운 입안으로   # 이 안에서 아래턱 자리이거나 원래 비어 있던 곳만 채움 (기본 좌표)


def mouth_art(v, which, shape, name=None):
    """입안 그림(which = base | open | cavity …, 또는 파일 이름 name)을 기본 좌표 칸에 놓기 (칸마다 가운데 픽셀 — 도트 유지) → RGBA"""
    name, (x0, y0, x1, y1) = name or MOUTH_ART[v][which], MOUTH_ART[v]['box']
    a = np.asarray(Image.open(f'{SRC_DIR}/{name}').convert('RGB'))
    ah, aw = a.shape[:2]
    w, h = x1 - x0, y1 - y0
    ax = np.clip(((np.arange(w) + 0.5) * aw / w).astype(int), 0, aw - 1)
    ay = np.clip(((np.arange(h) + 0.5) * ah / h).astype(int), 0, ah - 1)
    cell = a[ay][:, ax]
    out = np.zeros((shape[0], shape[1], 4), np.uint8)
    out[y0:y1, x0:x1, :3] = cell
    r, g, b = cell[..., 0].astype(int), cell[..., 1].astype(int), cell[..., 2].astype(int)
    bg = ~keymask(cell) | ((r - g > 50) & (b - g > 50))   # 마젠타 바탕 + 번진 보라 가장자리 (윗니 사이 보라 점)
    out[y0:y1, x0:x1, 3] = np.where(bg, 0, 255)
    return out
# 입 벌린 머리 그림으로 바꿔 끼우기 (11-06 사용자 "머리·아래턱 경계가 갈라져 보임" → 방법 ①): 잘라 돌린 아래턱 대신,
# 아래턱이 min° 이상 벌어지면 머리를 '입 벌린 머리 그림' 한 장으로 바꾸고 아래턱 조각은 숨김 (rig.json poseSwaps → rig.js).
# 그림 = 이 도구가 아래턱을 deg°로 돌려 그린 기준 그림(*_ref.png, 6배·마젠타)을 Gemini가 '아래턱은 그대로, 입안·입가 이음매만
# 한 장처럼' 다시 그린 것 — 입 둘레(머리·아래턱·그 사이)만 가져오고 나머지는 원래 머리 그림 그대로.
MOUTH_FRAMES = {'d': [{'deg': 8, 'min': 4, 'name': 'half', 'src': 'kaiju_d_frame8_gemini.png'},
                      {'deg': 14, 'min': 11, 'name': 'open', 'src': 'kaiju_d_frame14_gemini.png'}]}
MOUTH_FRAME_ZONE = (262, 92, 396, 178)   # 그림을 가져오는 입 둘레 (기본 좌표)
# 자른 뒤 손으로 고친 그림 — 다시 잘라도 덮어쓰지 않음 (피드백 20: c 화산 등딱지 머리 위 연기를 옅게, 7739ee2)
HAND_EDITED = {'head_c'}


def keymask(rgb):
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    return ~((r > 170) & (b > 170) & (g < 110))


def place(im, sx, sy, dx, dy):
    """세트 그림을 참고 그림 칸(W×FRAME_H)에 놓기: 높이를 칸에 맞춘 뒤 가로·세로 배율과 이동"""
    w = round(im.width * FRAME_H / im.height * sx)
    h = round(FRAME_H * sy)
    can = Image.new('RGB', (W, FRAME_H), MAGENTA)
    can.paste(im.resize((w, h), Image.BOX), ((W - w) // 2 + dx, (FRAME_H - h) // 2 + dy))
    return can


def best_fit(im, target, rows=None):
    """target 윤곽(bool)과 IoU가 가장 큰 배율·이동"""
    best = (-1, None, None)
    for sx in np.arange(0.97, 1.035, 0.01):
        for sy in (0.99, 1.0, 1.01):
            for dx in range(-8, 9, 2):
                for dy in range(-4, 5, 2):
                    can = place(im, sx, sy, dx, dy)
                    m = keymask(np.asarray(can))
                    t, c = (target, m) if rows is None else (target[rows], m[rows])
                    iou = (t & c).sum() / max(1, (t | c).sum())
                    if iou > best[0]:
                        best = (iou, (round(float(sx), 2), sy, dx, dy), can)
    return best


def component_in(mask, zone_mask, pick='largest'):
    """zone 안 mask의 덩어리 하나 (가장 큰 것 / 가장 오른쪽까지 뻗은 것)"""
    m = mask & zone_mask
    if not m.any():
        return m
    if pick == 'largest':
        return largest(m)
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    ok = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 80]
    if not ok:
        return largest(m)
    right = max(ok, key=lambda i: st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH])
    return lab == right


def jaw_turned(img, deg):
    """아래턱 그림을 축(PIVOTS['jaw']) 기준 화면 시계 방향 deg°로 (cv2 각도 음수 = 턱 끝이 아래로)"""
    import cv2
    rot = cv2.getRotationMatrix2D(tuple(float(c) for c in base.PIVOTS['jaw']), -deg, 1.0)
    return cv2.warpAffine(img, rot, (img.shape[1], img.shape[0]), flags=cv2.INTER_NEAREST)


def mouth_frame_ref(v, parts, deg, path):
    """Gemini에 보낼 기준 그림: 몸통 + 머리 + deg°로 벌린 아래턱 (앞발 없음), 입안 그림 칸을 6배·마젠타 바탕으로"""
    can = np.zeros_like(parts['body'])
    for p in (parts['body'], parts['head'], jaw_turned(parts['jaw'], deg)):
        a = p[..., 3:] > 0
        can = np.where(a, p, can)
    x0, y0, x1, y1 = MOUTH_ART[v]['box']
    crop = can[y0:y1, x0:x1]
    rgb = np.where(crop[..., 3:] > 0, crop[..., :3], np.array([255, 0, 255], np.uint8))
    Image.fromarray(rgb.astype(np.uint8)).resize(((x1 - x0) * 6, (y1 - y0) * 6), Image.NEAREST).save(path)


def mouth_frame(v, fr, parts, shape, cols, rows2):
    """입 벌린 머리 그림 한 장: 원래 머리 + deg°로 벌린 아래턱, 입 둘레만 Gemini 그림으로 (그림이 없으면 기준 그림만 만들고 멈춤)"""
    import cv2
    ref = f'{SRC_DIR}/{fr["src"].replace("_gemini.png", "_ref.png")}'
    if not os.path.exists(ref):
        mouth_frame_ref(v, parts, fr['deg'], ref)
    if not os.path.exists(f'{SRC_DIR}/{fr["src"]}'):
        raise SystemExit(f'[{v}] {fr["src"]} 없음 — 기준 그림 {ref}를 Gemini에 보내 입안·입가만 다시 그려 받을 것')
    head, jaw = parts['head'], jaw_turned(parts['jaw'], fr['deg'])
    out = np.where(jaw[..., 3:] > 0, jaw, head)                     # 머리 위에 벌린 아래턱 (z 순서대로)
    sil = (head[..., 3] > 0) | (jaw[..., 3] > 0)
    inner = cv2.morphologyEx(sil.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)).astype(bool)   # 두 턱 사이 입안까지
    zone = rect_mask(shape, MOUTH_FRAME_ZONE) & (cols >= base.NECK_BAND_X)
    take = zone & cv2.dilate(((inner & ~(head[..., 3] > 0)) | (jaw[..., 3] > 0)).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    take |= zone & (head[..., 3] > 0) & cv2.dilate((jaw[..., 3] > 0).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)   # 입천장·윗니 둘레도
    # 다문 아래턱 자리(머리 그림에 입안을 칠해 둔 곳)도 — 벌린 그림에선 드러나므로 Gemini 그림으로 (안 그러면 턱 끝 앞에 붉은 얼룩)
    take |= zone & cv2.dilate((parts['jaw'][..., 3] > 0).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    art = mouth_art(v, None, shape, name=fr['src'])
    out[take] = art[take]                                            # 그림의 마젠타(빈 곳)는 비움
    return out


def cut_set(v):
    os.makedirs(TMP_DIR, exist_ok=True)
    ref = np.asarray(Image.open(base.SRC_RIG).convert('RGB'))[:FRAME_H, :W]
    full_im = Image.open(f'{SRC_DIR}/kaiju_{v}_step2_gemini.png').convert('RGB')
    less_im = Image.open(f'{SRC_DIR}/kaiju_{v}_step3_gemini.png').convert('RGB')
    iou1, p1, full_can = best_fit(full_im, keymask(ref))
    rows = np.zeros(FRAME_H, bool)
    rows[:115] = True
    rows[276:] = True
    iou2, p2, less_can = best_fit(less_im, keymask(np.asarray(full_can)), rows)
    print(f'[{v}] 전신 → 기본: IoU {iou1:.3f} {p1} / 팔 없는 몸 → 전신(머리·다리 줄): IoU {iou2:.3f} {p2}')
    full_path, less_path = f'{TMP_DIR}/{v}_full.png', f'{TMP_DIR}/{v}_less.png'
    full_can.crop((0, 0, W, H)).save(full_path)   # 기본 자르기 칸(450×338)으로
    less_can.crop((0, 0, W, H)).save(less_path)

    src = remove_key_background(full_path, 'magenta', key_t=base.KEY_T)
    limbless = remove_key_background(less_path, 'magenta', key_t=base.KEY_T)
    shape = src.shape
    opaque = src[..., 3] > 0
    less = limbless[..., 3] > 0
    cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
    rows2 = np.broadcast_to(np.arange(H)[:, None], (H, W))
    diff = drop_specks(opaque & ~less, 30)

    # 아래턱: 지워도 윤곽은 거의 그대로(입안 색만 바뀜)라 차이로는 안 잡힘 → 머리 자리가 맞으므로 기본 턱 다각형
    jaw_poly = poly_mask(shape, base.JAW_POLY) | (poly_mask(shape, JAW_ADD[v]) if v in JAW_ADD else False)
    jaw = largest(jaw_poly & opaque)
    jaw_zone = grow(jaw_poly, np.ones(shape[:2], bool), 6)
    # 팔: 차이 중 가장 오른쪽까지 뻗은 덩어리. 턱 밑(턱이 있던 자리)이 이어 붙어 나오므로 턱 둘레와 어깨 위는 뺌
    arm = component_in(diff & ~jaw_zone & (rows2 >= 135), rect_mask(shape, ARM_ZONE), pick='rightmost')
    arm = drop_specks(grow(arm, opaque & ~jaw_zone & (cols >= base.ARM_BODY_CUT_X - base.SEAM_OVERLAP - 1), 3), 40)
    if v in MOUTH_OPEN:   # 아래턱 아래 테두리 선(기본 턱 선보다 몇 px 아래)이 몸통에 남으면 꽉 물 때 턱 밑에 줄로 떠 보임
        jaw = jaw | (grow(jaw, opaque & ~arm & (limbless[..., 3] == 0), 4) & (rows2 >= 140))   # 팔 없는 몸에 없는 픽셀만, 아래로만
    tail = component_in(diff, cols < TAIL_ZONE_X)
    head_poly = poly_mask(shape, base.HEAD_POLY) | rect_mask(shape, HEAD_EXTRA)
    if v in HEAD_ADD:
        head_poly |= poly_mask(shape, HEAD_ADD[v])
    head = head_poly & opaque & ~jaw & ~arm & (rows2 < 150)
    jaw_piece = grow(jaw, opaque, base.SEAM_OVERLAP)
    head_piece = grow(head, opaque & ~jaw & (cols >= base.NECK_BAND_X - 12), base.SEAM_OVERLAP)
    leg_n = largest(poly_mask(shape, base.LEG_N_POLY) & opaque & ~tail & ~arm)
    leg_f = largest(poly_mask(shape, base.LEG_F_POLY) & opaque & ~arm)
    mouth = np.zeros(shape[:2], bool)
    if v in MOUTH_OPEN:   # 입을 벌리면 드러나는 자리 (아랫니 사이 틈까지 메운 턱 자리 - 벌린 각도로 돌린 턱)
        import cv2
        solid = cv2.morphologyEx(jaw.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        rot = cv2.getRotationMatrix2D(tuple(float(c) for c in base.PIVOTS['jaw']), -MOUTH_OPEN[v], 1.0)   # cv2 음수 = 화면 시계 방향 = 턱 끝이 아래로
        opened = cv2.warpAffine(solid, rot, (W, H), flags=cv2.INTER_NEAREST).astype(bool)
        mouth = solid.astype(bool) & ~opened & ~head

    # 목 이음새 가림(NECK_BAND_X 왼쪽 머리를 몸통에도 남김)은 목 높이에서만 — 머리 위 장식(HEAD_EXTRA)까지 남기면
    # 머리를 움직일 때 장식이 몸통에 겹쳐 남아 두 개로 보임 (u 뿔, 같은 종류 점검)
    body = (opaque
            & ~(tail & (cols < base.TAIL_BODY_CUT_X))
            & ~(arm & (cols >= base.ARM_BODY_CUT_X))
            & ~jaw
            & ~(head & ((cols >= base.NECK_BAND_X) | (rows2 < HEAD_EXTRA[3])))
            & ~((leg_n | leg_f) & (rows2 >= base.LEG_BODY_CUT_Y)))
    body = drop_specks(body, 200)

    # 몸통: 팔이 가리던 가슴과 턱 아래 목은 팔 없는 몸에서 (기본과 같은 방식)
    body_img = cut(src, body)
    jaw_fill = rect_mask(shape, JAW_ZONE)
    if v in MOUTH_OPEN:   # 원래 빈 곳(입 틈)과 입을 벌리면 드러나는 자리는 비워 둠
        # 팔 없는 몸의 회색 닫힌 턱(y < MOUTH_THROAT_Y)은 빼고 그 아래 목만 — 물기 때 머리가 젖혀지면 입 틈 뒤로 몸통이 보임
        jaw_fill = jaw_fill & opaque & ~mouth & (rows2 >= MOUTH_THROAT_Y)
    fill = ((rect_mask(shape, base.ARM_FILL_ZONE) | jaw_fill | arm)
            & (body_img[..., 3] == 0) & (limbless[..., 3] == 255) & (cols < W - 2))
    body_img[fill] = limbless[fill]
    # 머리: 턱 뒤(입안)는 팔 없는 몸에서 (MOUTH_OPEN 세트는 몸통이 맡음 — 머리에 채우면 입 틈이 막힘)
    head_img = cut(src, head_piece)
    if v not in MOUTH_OPEN:
        fill = jaw_fill & ~arm & (head_img[..., 3] == 0) & (limbless[..., 3] == 255) & (cols >= base.NECK_BAND_X)
        head_img[fill] = limbless[fill]
    if v in MOUTH_ART:   # 입안 (Gemini 매끈한 입안 그림 cavity): 아래턱 자리 + 입 틈의 머리 조각을 통째로 채움
        # 아래턱은 원래 자리보다 위로 다물지 않게(rig.json limits → rig.js) 해서 턱 밑으로 입안이 드러나지 않음 —
        # 그래서 그림을 자르지 않고 그대로 씀. (머리에 붙인 입안을 '꽉 물 때 가려지는 곳'으로 잘랐더니 벌릴 때 조각나 찢어져 보였고,
        #  아래턱과 같이 움직이는 '건너편 아래턱' 조각도 해 봤으나 Gemini 아래턱 모양이 원본과 달라 깔끔히 떼어 내지 못해 뺌)
        import cv2
        solid = cv2.morphologyEx(jaw.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
        top = np.where(solid.any(0), solid.argmax(0), -1)
        gap = ~opaque & (rows2 < top[None, :])   # 입 틈 = 원래 비어 있던 곳 중 아래턱 윗면보다 위 (턱 밑·코 밑 허공은 비움)
        art = mouth_art(v, 'cavity', shape)
        # 아랫니 사이 틈(solid엔 있고 jaw엔 없음)은 원본처럼 비움 — 채우면 다문 모습에서 턱 끝에 붉은 점
        # 아래턱 가장자리(반투명 픽셀) 뒤도 비움 — 칠하면 다문 모습에서 턱 끝 테두리로 입안 색이 비침
        edge = cv2.dilate((jaw & (src[..., 3] < 255)).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~gap
        # 앞쪽은 벌렸을 때(+MOUTH_OPEN°) 아래턱 끝 자리까지만 — 턱 끝은 벌리면 왼쪽 아래로 내려가서, 원래 턱 끝 자리의 입안이
        # 턱 밖으로 혀처럼 튀어나와 보였음 (다문 모습에서도 턱 끝 앞 가는 띠)
        pivot = tuple(float(c) for c in base.PIVOTS['jaw'])
        opened = cv2.warpAffine(jaw.astype(np.uint8), cv2.getRotationMatrix2D(pivot, -MOUTH_OPEN[v], 1.0), (W, H), flags=cv2.INTER_NEAREST)
        front = int(np.nonzero(opened.any(0))[0].max()) - 1   # cv2 음수 = 턱 끝이 아래로
        # 윗니 쪽에서 벌린 턱 끝까지 완만하게 좁아지는 윤곽 (한 열에서 수직으로 끊지 않음).
        front_line = front + np.rint(np.clip((139 - rows2) / 2, -4, 9)).astype(int)
        hidden = jaw_piece & (src[..., 3] == 255)   # 다문 턱이 완전히 가리는 곳만 색·윤곽을 바꿀 수 있음
        zone = rect_mask(shape, MOUTH_ART_ZONE) & ~arm & (cols >= base.NECK_BAND_X)
        put = (zone & (cols <= front_line) & (head_img[..., 3] == 0)
               & (jaw | gap) & ~edge & (art[..., 3] == 255))
        # 밝은 붉은 테두리(입안 그림의 아래 가장자리)는 어두운 입안 색조로 — 벌리면 아래턱 끝 앞으로 혀처럼 튀어나와 보였음
        rgb = art[..., :3].astype(float)
        peak = rgb.max(2, keepdims=True)
        rgb = np.where(peak > CAVITY_MAX, rgb * (CAVITY_MAX / np.maximum(peak, 1)), rgb)
        cavity_rgb = rgb.copy()
        # 입천장 아래의 살색을 가까운 원본 픽셀에서 가져와 4단계로 입안 그림자에 이음.
        # 원본의 어두운 턱 경계도 턱에 가려지는 2px 겹침 안에서만 함께 풀어 줌.
        original = head_img[..., :3].astype(float)
        roof = (zone & (head_img[..., 3] == 255) & (original[..., 1] < original[..., 0] * 0.55)
                & (original[..., 2] < original[..., 0] * 0.5) & (original[..., 0] > 65))
        if roof.any():
            distance, labels = cv2.distanceTransformWithLabels((~roof).astype(np.uint8), cv2.DIST_L2, 5,
                                                              labelType=cv2.DIST_LABEL_PIXEL)
            palette = np.zeros((int(labels.max()) + 1, 3), float)
            palette[labels[roof]] = original[roof]
            flesh = palette[labels]
            weight = np.clip(np.ceil((8 - distance) / 2) / 4, 0, 1)[..., None]
            rgb = rgb * (1 - weight) + flesh * weight
            # 입가 쐐기는 검은 금 대신 붉은 안쪽 살, 축에 가까울수록 원본 볼의 회색으로.
            inner = np.median(src[jaw & (src[..., 0].astype(int) > src[..., 1].astype(int) + 30), :3], axis=0)
            hinge = (np.clip((302 - cols) / 26, 0, 1) * np.clip((rows2 - 104) / 8, 0, 1))[..., None]
            cheek = np.median(src[111:123, 268:276, :3], axis=(0, 1))
            skin = np.clip((280 - cols) / 12, 0, 1)[..., None]
            tissue = inner * (1 - skin) + cheek * skin
            rgb = rgb * (1 - hinge) + tissue * hinge
            blend = zone & hidden & ~edge & (head_img[..., 3] == 255) & ((distance <= 3) | ((cols < 300) & (distance <= 6)))
            head_img[blend, :3] = rgb[blend].astype(np.uint8)
        # 새로 드러나는 앞쪽 윤곽만 1px 그림자. 기존 입 틈·반투명 턱 뒤는 그대로 비움.
        rim = put & hidden & (cols == front_line)
        rgb[rim] *= 0.85
        rgb[~hidden] = cavity_rgb[~hidden]   # 다문 모습에 보이는 기존 입 틈의 색은 보존
        put &= hidden | (cols <= front)
        head_img[zone & hidden & (cols > front_line)] = 0
        head_img[put, :3] = rgb[put].astype(np.uint8)
        head_img[put, 3] = 255

    parts = {'body': body_img, 'head': head_img, 'jaw': cut(src, jaw_piece), 'armF': cut(src, arm),
             'legN': cut(src, leg_n), 'legF': cut(src, leg_f)}
    for name, (x0, x1) in base.TAIL_SEGMENTS.items():
        parts[name] = cut(src, tail & (cols >= x0) & (cols < x1))
    empty = [k for k, p in parts.items() if not p[..., 3].any()]
    if empty:
        raise SystemExit(f'[{v}] 비어 있는 조각: {empty} — 자리 범위(ARM_ZONE 등)를 확인')
    named = {f'{k}_{v}': p for k, p in parts.items()}
    for fr in MOUTH_FRAMES.get(v, []):   # 입 벌린 머리 그림 (머리 기준 좌표 — 머리 뼈에 그대로 붙음)
        named[f'head_{v}_{fr["name"]}'] = mouth_frame(v, fr, parts, shape, cols, rows2)
    old = json.load(open(f'{OUT_DIR}/rig.json', encoding='utf-8'))['parts']
    keep = {k: old[k] for k in named if k in HAND_EDITED and k in old}
    for k in keep:
        print(f'[{v}] {k}: 손으로 고친 그림이라 그대로 둠')
    layout_parts = {**save_parts({k: p for k, p in named.items() if k not in keep}, OUT_DIR, base.SCALE), **keep}
    ref3 = src.repeat(base.SCALE, axis=0).repeat(base.SCALE, axis=1)
    order = ['tail3', 'tail2', 'tail1', 'legF', 'legN', 'body', 'head', 'jaw', 'armF']
    rest_check(OUT_DIR, {'parts': layout_parts}, [f'{k}_{v}' for k in order], ref3,
               os.path.join(os.path.dirname(os.path.abspath(__file__)), f'_rest_check_kaiju_{v}.png'))
    return layout_parts


def main():
    path = f'{OUT_DIR}/rig.json'
    layout = json.load(open(path, encoding='utf-8'))
    letters = sys.argv[1:] or ['a', 'b']   # 2차 세트 (D-071): python tools/rig/cut_kaiju_sets.py u c d v w l m
    for v in letters:
        layout['parts'].update(cut_set(v))
    layout['pivots'].pop('jawFar', None)
    layout['parts'].pop('jawFar_d', None)
    # 입안 그림 세트의 아래턱은 원래 자리보다 위로 다물지 않음 (rig.js 회전 한도 — 그림 키 기준이라 이 세트만)
    layout['limits'] = {**layout.get('limits', {}), **{f'jaw_{x}': {'min': 0} for x in MOUTH_ART}}
    # 입 벌린 머리 그림으로 바꿔 끼우기 (rig.js poseSwaps — 그림 키 기준이라 이 세트만)
    layout['poseSwaps'] = {**layout.get('poseSwaps', {}), **{
        f'head_{x}': [{'bone': 'jaw', 'min': fr['min'], 'part': f'head_{x}_{fr["name"]}', 'hide': ['jaw']} for fr in frs]
        for x, frs in MOUTH_FRAMES.items()}}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print('rig.json 부위 그림:', len(layout['parts']), '개')


if __name__ == '__main__':
    main()
