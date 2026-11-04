"""
거점 그림(Gemini) → 게임용 그림 (로드맵 C단계)

실행: 프로젝트 루트에서  python tools/images/build_bases.py          (전부)
                         python tools/images/build_bases.py st1_ st2_ (이름 앞부분으로 골라서, 나머지는 기존 값)

입력: assets/sprites/stage/src/<그림>_{1,2,3}_gemini.png  (1 온전 / 2 파손 / 3 붕괴) — 그림 목록은 BASES
출력: assets/sprites/stage/<그림>_{1,2,3}.png  (게임 크기의 2배 — 화면을 키워도 선명하게, 무손실 원본)
      assets/sprites/stage/<그림>_{1,2,3}.webp (게임이 읽는 것 — 품질 90, PNG의 약 1/6 · 로딩 단축 2026-10-24)
      js/engine_v2/stageArt_v2.js  (게임 크기·바닥 위치·포구 위치, 자동 생성)
      tools/images/_out/bases_preview.png  (게임 1배 크기로 세 상태를 나란히)

처리 순서
 1. Gemini 로고 지우기 (unlogo.py, 역합성)
 2. 단색 배경(초록·마젠타) 지우기: 배경색에 가까울수록 투명하게(반투명 연기·가장자리), 남은 초록빛은 빼서 회색으로
 3. 작은 잡티 제거 (연기·불꽃처럼 떨어진 조각은 남김)
 4. 세 장을 같은 틀로 자르기 (세 상태의 합집합) → 상태를 바꿔 끼워도 자리가 같음
    바닥선 = 1단계 건물 맨 아래. 붕괴 잔해처럼 바닥선 아래로 퍼진 부분은 sink만큼 땅에 묻힘
 5. 1단계 건물 높이가 게임 높이(h)가 되도록 줄이기 (알파를 곱한 상태로 줄여 가장자리 번짐 방지)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402

SRC = 'assets/sprites/stage/src/{name}_{n}_gemini.png'
OUT = 'assets/sprites/stage/{name}_{n}.png'
JS_OUT = 'js/engine_v2/stageArt_v2.js'
PREVIEW = 'tools/images/_out/bases_preview.png'

# 거점·장애물 그림 (그림 이름 → 설정). 구역마다 어떤 그림을 요새/기지로 쓸지는 stages_v2.js 챕터의 art
#  h: 게임 높이(px, 1단계 건물 기준 — 주인공 약 186px), states: 상태 수(3 = 온전·파손·붕괴, 2 = 온전·파손)
#  key: 배경색, muzzle: 포구·굴뚝 끝(원본 px — 보스전 기믹 이펙트가 여기서 나감)
#  top: 높이를 잴 때 건물 맨 위(원본 y — 위로 솟은 연기는 높이에서 빼고, 위쪽을 흐리게)
#  blank: [(state, x0, y0, x1, y1)] 그 상태 그림의 이 영역 글자를 지움(간판을 바탕색으로) — Gemini가 넣은 글자
BASES = {
    # 구역 1 · 지하 비밀 연구소
    'bunker': {'h': 220},
    'tower': {'h': 280, 'muzzle': (92, 166)},
    # 구역 2 · 하부 쓰레기 폐기 정착지 (D-040)
    'gate': {'h': 220, 'key': 'magenta', 'blank': [(2, 445, 268, 493, 297), (2, 618, 410, 676, 441)]},
    'furnace': {'h': 280, 'key': 'magenta', 'top': 95, 'muzzle': (431, 96)},
    'barricade': {'h': 80, 'key': 'magenta', 'states': 2},
    # 구역 3 · 성왕국 수도 (D-056, 그림 2026-10-24) — 심문소 통제탑(꼭대기 수정에서 화살·마법), 대성당 정문, 방패 장벽
    'inqtower': {'h': 200, 'muzzle': (398, 178)},
    'cathedral': {'h': 240},
    'shieldwall': {'h': 66, 'states': 2},
    # 구역 4 · 진화의 심연 (그림 2026-10-24, 노랑 배경) — 박동하는 유기질 벽(노즐에서 독액), 우주적 고치(촉수 끝은 높이에서 뺌), 갑각 장벽
    'fleshwall': {'h': 230, 'key': 'yellow', 'muzzle': (262, 228)},
    'cocoon': {'h': 270, 'key': 'yellow', 'top': 120},
    'chitin': {'h': 66, 'key': 'yellow', 'states': 2},
}
# ---- 새 기획 스테이지 1~10 (D-085, 그림 2026-10-25 Gemini 765×1024 / 장벽 1024×1024) ----
# 그림 이름 st<N>_fort(중간 요새) · st<N>_base(최종 기지) · st<N>_barr(장벽), 원본 src/st<N>/<fort|base|barr>_<1|2|3>_gemini.png
# clip_x0: 이 x보다 왼쪽을 지움 (10단계 요새 왼쪽으로 뻗은 레이저 선)
NEW_BASES = {
    1: {'fort': {'h': 220, 'muzzle': (98, 116)},                      # 보안 게이트 — 위 자동 포탑
        'base': {'h': 300},                                           # 지상행 거대 승강기
        'barr': {'h': 58}},                                           # 대전차 장애물
    2: {'fort': {'h': 220, 'muzzle': (28, 349)},                      # 해안 방파제 게이트 — 왼쪽 위 쌍포
        'base': {'h': 290, 'top': 140, 'muzzle': (452, 150)},          # 메인 시추 코어 — 꼭대기 불꽃은 높이에서 뺌
        'barr': {'h': 70}},                                           # 드럼통 장벽
    3: {'fort': {'h': 240, 'muzzle': (57, 372)},                      # 이단 심문소 철문 — 왼쪽 쇠꼬챙이
        'base': {'h': 280},                                           # 대성당 정문
        'barr': {'h': 80}},                                           # 성십자 방패 장벽
    4: {'fort': {'h': 230, 'key': 'yellow'},                          # 박동하는 고기 벽
        'base': {'h': 270, 'key': 'yellow', 'top': 180},               # 우주적 고치 — 위 촉수는 높이에서 뺌
        'barr': {'h': 70, 'key': 'yellow'}},                          # 갑각 장벽
    5: {'fort': {'h': 230, 'muzzle': (51, 128)},                      # 해상 차단 수문 — 위 작살포
        'base': {'h': 290, 'muzzle': (36, 558)},                       # 중앙 통제 시추선 — 왼쪽 배관 노즐
        'barr': {'h': 54}},                                           # 닻사슬 장벽
    6: {'fort': {'h': 210, 'muzzle': (57, 605)},                      # 화형의 소각로 — 왼쪽 분사구
        'base': {'h': 260},                                           # 성배의 성역
        'barr': {'h': 66}},                                           # 병상 장벽
    7: {'fort': {'h': 150, 'muzzle': (11, 505)},                      # 강철 참호 벙커 — 왼쪽 포신
        'base': {'h': 330},                                           # 제국군 전방 사령탑
        'barr': {'h': 66}},                                           # 철조망 장벽
    8: {'fort': {'h': 240},                                           # 용광로 성문
        'base': {'h': 250},                                           # 메인 화로석 제단
        'barr': {'h': 60}},                                           # 화로 방패 장벽
    9: {'fort': {'h': 170, 'muzzle': (123, 290)},                     # 불법 톨게이트 — 위 기관총
        'base': {'h': 340},                                           # 메인 크레인 타워
        'barr': {'h': 66}},                                           # 공사 차단벽
    10: {'fort': {'h': 250, 'muzzle': (220, 520), 'clip_x0': 205},     # 전파 차단 격벽 — 왼쪽 레이저 발사구
         'base': {'h': 290, 'top': 160},                               # 타워 최상층 코어 룸 — 위 케이블은 높이에서 뺌
         'barr': {'h': 70}},                                          # 진압 차단벽
}
for _n, _kinds in NEW_BASES.items():
    for _k, _spec in _kinds.items():
        BASES[f'st{_n}_{_k}'] = {'src': f'st{_n}/{_k}', **({'states': 2} if _k == 'barr' else {}), **_spec}
OUT_SCALE = 2
WEBP_Q = 90                 # 게임이 읽는 .webp 품질 (stageArt_v2.js src) — 이펙트 시트와 같음 (D-062)
KEY_LO, KEY_HI = 12, 60     # 초록 정도(초록 - max(빨강, 파랑)): LO 이하 불투명, HI 이상 투명, 사이는 반투명
MIN_PART = 40               # 이보다 작은 떨어진 덩어리는 잡티로 지움
GROUND_B = 60               # 게임 바닥 높이 (bottom px, index.css .building-entity)


def key_out(rgb, key='green'):
    """단색 배경 지우기 — key 'green'(#00FF00) | 'magenta'(#FF00FF, 구역 2) | 'yellow'(#FFFF00, 구역 4 — 보라·형광 녹색을 써서)"""
    a = rgb.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if key == 'yellow':
        k = np.minimum(r, g) - b
        alpha = np.clip((KEY_HI - k) / (KEY_HI - KEY_LO), 0, 1)
        # 섞인 배경 노랑을 뺌: 빨강·초록을 파랑 쪽으로 끌어내림
        lim = b + KEY_LO
        a[..., 0] = np.where(k > KEY_LO, np.minimum(r, lim), r)
        a[..., 1] = np.where(k > KEY_LO, np.minimum(g, lim), g)
    elif key == 'magenta':
        k = np.minimum(r, b) - g
        alpha = np.clip((KEY_HI - k) / (KEY_HI - KEY_LO), 0, 1)
        # 섞인 배경 분홍을 뺌: 빨강·파랑을 초록 쪽으로 끌어내림
        lim = g + KEY_LO
        a[..., 0] = np.where(k > KEY_LO, np.minimum(r, lim), r)
        a[..., 2] = np.where(k > KEY_LO, np.minimum(b, lim), b)
    else:
        k = g - np.maximum(r, b)
        alpha = np.clip((KEY_HI - k) / (KEY_HI - KEY_LO), 0, 1)
        # 반투명·가장자리 픽셀에 섞인 배경 초록을 뺌 (연기가 초록빛으로 남지 않게)
        a[..., 1] = np.where(k > KEY_LO, np.maximum(r, b), g)
    mask = alpha > 0.05
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= MIN_PART
    alpha[~keep[lab]] = 0
    main = lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])) if n > 1 else mask
    return np.dstack([a, alpha * 255]).round().astype(np.uint8), main


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def shrink(rgba, size):
    return Image.fromarray(rgba, 'RGBA').convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def blank_text(rgb, box):
    """간판의 글자를 지움: 영역 안에서 바탕(중간 밝기)과 다른 글자 픽셀을 바탕색으로. 아주 어두운 탄 자국은 남김"""
    x0, y0, x1, y1 = box
    reg = rgb[y0:y1, x0:x1].astype(np.int32)
    lum = reg.mean(axis=2)
    base = np.median(reg[lum >= np.percentile(lum, 55)], axis=0)
    text = (np.abs(reg - base).max(axis=2) > 28) & (lum > 38)
    reg[text] = base
    out = rgb.copy()
    out[y0:y1, x0:x1] = reg.astype(np.uint8)
    return out


def build(name, spec):
    states = []
    src = spec.get('src', name)
    for n in range(1, spec.get('states', 3) + 1):
        rgb, _ = load_clean(SRC.format(name=src, n=n))
        for st, *box in spec.get('blank', []):
            if st == n:
                rgb = blank_text(rgb, box)
        rgba, main = key_out(rgb, spec.get('key', 'green'))
        if 'clip_x0' in spec:
            rgba[:, :spec['clip_x0'], 3] = 0
            main[:, :spec['clip_x0']] = False
        states.append((rgba, main))
    _, top, _, ground = bbox(states[0][1])                  # 1단계 건물 = 높이·바닥선 기준
    top = spec.get('top', top)                              # 연기 등을 뺀 건물 맨 위
    boxes = [bbox(rgba[..., 3] > 0) for rgba, _ in states]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    s = spec['h'] / (ground - top)
    w, h = round((x1 - x0) * s), round((y1 - y0) * s)
    out = []
    for n, (rgba, _) in enumerate(states, 1):
        crop = rgba[y0:y1, x0:x1].copy()
        if 'top' in spec and top > y0:                      # 건물 위로 솟은 연기: 위로 갈수록 흐리게 (잘린 끝이 안 보이게)
            fade = np.linspace(0, 1, top - y0)[:, None]
            crop[:top - y0, :, 3] = (crop[:top - y0, :, 3] * fade).astype(np.uint8)
        img = shrink(crop, (w * OUT_SCALE, h * OUT_SCALE))
        path = OUT.format(name=src, n=n)
        img.save(path, optimize=True)                       # 무손실 원본 (미리보기·다시 굽기용)
        webp = path[:-4] + '.webp'                           # 게임용: WebP 품질 90 — PNG의 약 1/6 (로딩 단축, 2026-10-24)
        img.save(webp, 'WEBP', quality=WEBP_Q, method=6)
        out.append(webp)
    art = {'w': w, 'h': h, 'sink': round((y1 - ground) * s), 'src': out}
    if 'muzzle' in spec:
        mx, my = spec['muzzle']
        art['muzzle'] = [round((mx - x0) * s), GROUND_B + round((ground - my) * s)]
    print(f'{name}: {w}x{h}px (출력 {w * OUT_SCALE}x{h * OUT_SCALE}), 바닥 아래 {art["sink"]}px, 축소 {s:.3f}')
    return art


def write_js(arts):
    lines = [
        '// 자동 생성 파일: python tools/images/build_bases.py (손으로 고치지 말 것)',
        '// 거점·장애물 그림 (그림 이름별, 구역마다 쓰는 그림은 stages_v2.js 챕터의 art). w·h = 게임 크기(px, 그림 파일은 2배),',
        '// sink = 바닥선 아래로 묻히는 px(붕괴 잔해), src = [온전, 파손, (붕괴)], muzzle = [왼쪽에서 x, 화면 바닥에서 b] 포구·굴뚝',
        'export const BASE_ART = {',
    ]
    for kind, a in arts.items():
        src = ', '.join(f"'{p}'" for p in a['src'])
        extra = f", muzzle: [{a['muzzle'][0]}, {a['muzzle'][1]}]" if 'muzzle' in a else ''
        lines.append(f"    {kind}: {{ w: {a['w']}, h: {a['h']}, sink: {a['sink']}, src: [{src}]{extra} }},")
    lines.append('};')
    open(JS_OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def preview(arts):
    W = 20 + sum(len(a['src']) * (a['w'] + 12) + 30 for a in arts.values())
    H, gy = 380, 380 - GROUND_B
    canvas = Image.new('RGBA', (W, H), (20, 18, 28, 255))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, gy, W, H], fill=(42, 36, 51, 255))
    x = 20
    for kind, a in arts.items():
        for p in a['src']:
            img = Image.open(p).resize((a['w'], a['h']), Image.LANCZOS)
            canvas.alpha_composite(img, (x, gy - a['h'] + a['sink']))
            x += a['w'] + 12
        x += 30
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    canvas.convert('RGB').save(PREVIEW)


def main():
    import json
    only = sys.argv[1:]          # 이름 앞부분으로 골라 다시 굽기 (예: st1_) — 나머지는 지금 stageArt_v2.js 값을 그대로 씀
    old = {}
    if only and os.path.exists(JS_OUT):
        for line in open(JS_OUT, encoding='utf-8'):
            line = line.strip()
            if line.endswith('},') and ': {' in line:
                k, v = line.split(': {', 1)
                v = '{' + v[:-1]
                v = v.replace("'", '"')
                for f in ('w', 'h', 'sink', 'src', 'muzzle'):
                    v = v.replace(f'{f}:', f'"{f}":')
                old[k] = json.loads(v)
    arts = {}
    for name, spec in BASES.items():
        if only and not any(name.startswith(p) for p in only) and name in old:
            arts[name] = old[name]
        else:
            arts[name] = build(name, spec)
    write_js(arts)
    preview({k: v for k, v in arts.items() if not only or any(k.startswith(p) for p in only)})
    print(f'→ {JS_OUT}, 미리보기 {PREVIEW}')


if __name__ == '__main__':
    main()
