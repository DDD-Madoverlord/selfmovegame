"""
새끼 거미(합성괴인 거미 실험체 '새끼 거미 떼' 소환물, D-120) 리그 파츠를 픽셀 그림으로 만든다.

실행: 프로젝트 루트에서
  python tools/rig/make_spiderling.py      → assets/sprites/rig/spiderling/{torso, legN1~4, legF1~4}.png + rig.json
  python tools/rig/bake_enemies.py spiderling   → 걷기·공격 시트 (enemyArt_v2.js)

- 다른 적처럼 왼쪽(주인공 쪽)을 봄 — 아군 소환물은 CSS가 좌우를 뒤집음
- 논리 픽셀 128×128(1칸 = 원본 8px)로 그려 8배 확대 (게임의 굵은 외곽선 픽셀 그림 느낌), 바닥 y = 113
- 다리 8개는 조각마다 엉덩이(몸통 붙는 곳)를 축으로 돌아 걷기에서 번갈아 디딤 (enemyRigs.js spiderling)
- 슬라임 그림을 보라로 물들여 쓰던 예전 새끼 거미가 거미처럼 안 보인다는 피드백 (2026-11-11)
"""
import json
import math
import os

from PIL import Image, ImageDraw

OUT = 'assets/sprites/rig/spiderling'
N, K = 128, 8          # 논리 크기 · 확대 배율 (원본 1024)
GROUND = 113

OUTLINE = (12, 6, 16, 255)
BODY = (44, 26, 58, 255)
BODY_SH = (27, 15, 37, 255)
BODY_HI = (78, 46, 102, 255)
MARK = (182, 92, 255, 255)
MARK_HI = (232, 170, 255, 255)
EYE = (236, 140, 255, 255)
FANG = (214, 200, 226, 255)
LEG_NEAR = (60, 37, 76, 255)
LEG_NEAR_HI = (112, 72, 138, 255)
LEG_FAR = (34, 21, 45, 255)
LEG_FAR_HI = (58, 37, 74, 255)

# 몸: 배(뒤·오른쪽) + 머리가슴(앞·왼쪽)
ABD = (78, 80, 21, 16)       # cx, cy, rx, ry
CEPH = (50, 86, 13, 10)
HIP_Y = 88
# 다리: (엉덩이 x, 무릎 x·y, 발 x) — 앞(0) → 뒤(3). 앞다리는 왼쪽 앞으로, 뒷다리는 오른쪽 뒤로
LEGS = [(47, 28, 70, 14), (51, 42, 64, 34), (56, 68, 64, 78), (60, 86, 70, 102)]


def outlined(img):
    """불투명 칸 둘레 1칸 외곽선"""
    src = img.copy()
    px, out = src.load(), img.load()
    for y in range(N):
        for x in range(N):
            if px[x, y][3]:
                continue
            if any(0 <= x + dx < N and 0 <= y + dy < N and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUTLINE
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[x, y] = OUTLINE
    return img


def ellipse_shaded(d, cx, cy, rx, ry, base, shade, hi):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            nx, ny = (x - cx) / rx, (y - cy) / ry
            r = nx * nx + ny * ny
            if r > 1:
                continue
            light = -0.55 * nx - 0.75 * ny   # 왼쪽 위에서 빛
            col = hi if light > 0.55 and r < 0.75 else shade if light < -0.35 or r > 0.82 and ny > 0 else base
            d.point((x, y), col)


def body():
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ellipse_shaded(d, *ABD, BODY, BODY_SH, BODY_HI)
    ellipse_shaded(d, *CEPH, BODY, BODY_SH, BODY_HI)
    cx, cy, rx, ry = ABD
    # 배 무늬: 등줄기를 따라 굵은 보라 독 갈매기 무늬 3개 (2칸 두께) + 빛나는 점
    for off in (-11, -2, 7):
        for t in range(-6, 7):
            for w in (0, 1):
                x, y = cx + off + abs(t) // 2 + w, cy - 6 + t
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.78:
                    d.point((x, y), MARK_HI if w == 0 and abs(t) < 2 else MARK)
    for x, y in ((cx + 13, cy - 8), (cx - 13, cy - 7), (cx + 5, cy + 9), (cx - 5, cy + 10)):
        d.point((x, y), MARK_HI)
    # 눈: 얼굴 앞에 크게 빛나는 겹눈 2개 + 작은 눈 4개
    ex, ey = CEPH[0] - 9, CEPH[1] - 3
    for x, y, big in ((ex, ey, True), (ex + 5, ey - 2, True), (ex + 1, ey - 5, False), (ex + 5, ey - 6, False), (ex + 9, ey - 4, False), (ex - 2, ey - 2, False)):
        d.point((x, y), EYE)
        if big:
            for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 0), (0, -1)):
                d.point((x + dx, y + dy), EYE)
            d.point((x, y), (255, 240, 255, 255))
    # 독니 (아래로 굽은 두 개)
    for fx in (CEPH[0] - 11, CEPH[0] - 7):
        for k, (dx, dy) in enumerate(((0, 0), (0, 1), (-1, 2), (-1, 3), (0, 4))):
            d.point((fx + dx, CEPH[1] + 3 + dy), MARK if k == 4 else FANG)
    return outlined(img)


def leg(i, near):
    """다리 하나: 엉덩이 → 무릎(위로 솟음) → 발(바닥). 먼 쪽 다리는 어둡고 조금 뒤·위"""
    hx, kx, ky, fx = LEGS[i]
    sh = 0 if near else 5
    # 가까운 다리는 몸 아래쪽에서 나와 얼굴(눈)을 가리지 않게
    hip = (hx + sh + (4 if near else 0), HIP_Y + (4 if near else -2))
    knee, foot = (kx + sh, ky - (0 if near else 3)), (fx + sh, GROUND - (0 if near else 3))
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col, hi = (LEG_NEAR, LEG_NEAR_HI) if near else (LEG_FAR, LEG_FAR_HI)
    d.line([hip, knee], fill=col, width=3)
    d.line([knee, foot], fill=col, width=2)
    d.line([(hip[0], hip[1] - 1), (knee[0], knee[1] - 1)], fill=hi, width=1)    # 윗면 빛
    d.rectangle([knee[0] - 1, knee[1] - 1, knee[0] + 1, knee[1] + 1], fill=hi)  # 무릎 마디
    mid = ((knee[0] + foot[0]) // 2, (knee[1] + foot[1]) // 2)
    d.point(mid, MARK if near else col)                                          # 정강이 독 마디
    d.point(foot, OUTLINE)
    img = outlined(img)
    return img, hip, foot


def save(img, name, parts):
    box = img.getbbox()
    crop = img.crop(box).resize(((box[2] - box[0]) * K, (box[3] - box[1]) * K), Image.NEAREST)
    crop.save(os.path.join(OUT, name + '.png'))
    parts[name] = {'src': name + '.png', 'x': box[0] * K, 'y': box[1] * K, 'w': (box[2] - box[0]) * K, 'h': (box[3] - box[1]) * K}


def main():
    os.makedirs(OUT, exist_ok=True)
    parts, pivots = {}, {'root': [CEPH[0] * K + 60, GROUND * K], 'body': [(CEPH[0] + 10) * K, HIP_Y * K]}
    save(body(), 'torso', parts)
    feet = {}
    for i in range(4):
        for near in (True, False):
            name = f"leg{'N' if near else 'F'}{i + 1}"
            img, hip, foot = leg(i, near)
            save(img, name, parts)
            pivots[name] = [hip[0] * K, hip[1] * K]
            feet[name] = [foot[0] * K, foot[1] * K]
    rig = {'source': {'w': N * K, 'h': N * K}, 'ground': GROUND * K, 'parts': parts, 'pivots': pivots,
           'sockets': {'tip': [(CEPH[0] - 12) * K, (CEPH[1] + 6) * K], 'footF': feet['legN1'], 'footB': feet['legN4']}}
    json.dump(rig, open(os.path.join(OUT, 'rig.json'), 'w'), indent=2)
    # 확인용 미리보기 (전체 조립)
    full = Image.new('RGBA', (N * K, N * K), (40, 40, 52, 255))
    order = [f'legF{i}' for i in range(1, 5)] + ['torso'] + [f'legN{i}' for i in range(1, 5)]
    for n in order:
        p = parts[n]
        full.alpha_composite(Image.open(os.path.join(OUT, p['src'])), (p['x'], p['y']))
    full.crop((0, 400, 1024, 960)).save('/tmp/spiderling_preview.png')
    print('→', OUT, list(parts))


if __name__ == '__main__':
    main()
