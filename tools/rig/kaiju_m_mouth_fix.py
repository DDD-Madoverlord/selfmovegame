"""
태고의 용왕(괴수 m) 머리 그림 손질 (D-123): head_m에 아래턱·아랫니가 같이 그려져 있어, 따로 움직이는 아래턱(jaw_m)이 벌어지면
입이 두 겹으로 보였음 → head_m에서 jaw_m이 덮는 앞쪽 자리(아래턱·아랫니)를 입안(붉은 혀·목구멍) 색으로 칠함.
윗니 끝(아래턱 윗변 바로 아래의 밝은 이)은 남김. 아래턱이 위로 닫히는 쪽은 rig.json limits jaw_m min 0으로 막음
(위로 올라가면 머리의 아래 입술이 턱 밑에 드러남 — jaw_d와 같은 방식).

D-124 (보완): 몸통 그림 body_m에도 머리 밑에 입(윗니 줄·아래턱)이 그려져 있어, 기본 공격 때 머리가 앞뒤로 기울면
머리 아래로 몸통의 입이 드러나 윗니가 두 줄로 보였음 → body_m에서 머리·아래턱이 덮는 자리(경첩 x 860 뒤쪽·목은 남김)를 투명하게.

실행: python tools/rig/kaiju_m_mouth_fix.py   (원본은 git의 head_m.png·body_m.png — 다시 돌리려면 git checkout 뒤에)
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

D = os.path.join('assets', 'sprites', 'rig', 'kaiju')
rig = json.load(open(os.path.join(D, 'rig.json'), encoding='utf-8'))
ph, pj = rig['parts']['head_m'], rig['parts']['jaw_m']
head = np.array(Image.open(os.path.join(D, 'head_m.png')).convert('RGBA')).astype(np.float32)
jaw = Image.open(os.path.join(D, 'jaw_m.png')).convert('RGBA')

# 아래턱 자리 (머리 그림 좌표). 윗변 쪽(윗니 아래)만 3px 넓힘 — 아랫변은 넓히지 않음(턱 밑으로 삐져나오지 않게)
mask = Image.new('L', (head.shape[1], head.shape[0]), 0)
mask.paste(jaw.getchannel('A').point(lambda a: 255 if a > 40 else 0), (pj['x'] - ph['x'], pj['y'] - ph['y']))
m0 = np.array(mask) > 0
md = np.array(mask.filter(ImageFilter.MaxFilter(7))) > 0
FRONT = 96            # 경첩 쪽(뒤 96px)은 턱이 거의 안 움직이고 목·뺨이라 그대로
X_END = 250           # 입안(목구멍) 앞 끝 — 이보다 앞은 아래턱이 벌어지면 트인 공간(투명)
mask = np.zeros_like(m0)
for x in range(FRONT, m0.shape[1]):
    col = np.nonzero(m0[:, x])[0]
    if not len(col):
        continue
    t0 = col.min()
    up = np.nonzero(md[:t0 + 1, x])[0]
    mask[(up.min() if len(up) else t0):col.max() + 1, x] = True

# D-124 보완: 예전엔 아래턱 자리 전체를 납작한 붉은 색으로 칠하고 아랫변 22px은 머리 그림의 아래 입술을 남겨,
#   용왕의 숨결(턱 20° 벌림)에서 붉은 판과 입술 조각이 허공에 떠 아랫입이 깨진 듯 보였음
#   → 입안은 목구멍 쪽에서 앞으로 갈수록 낮아지는 사선 아래(경계)까지만 칠하고(어두운 목구멍 → 붉은 입천장, 경계에 짙은 잇몸 선),
#     그 앞·아래는 투명(아래턱이 벌어지면 트인 입). 윗니 끝은 남김
ys, xs = np.nonzero(mask)
top = {x: ys[xs == x].min() for x in np.unique(xs)}
bot = {x: ys[xs == x].max() for x in np.unique(xs)}
lum = head[..., :3] @ np.array([0.3, 0.59, 0.11])
out = head.copy()
for y, x in zip(ys, xs):
    if head[y, x, 3] < 20:
        continue
    if y < top[x] + 14 and lum[y, x] > 165:   # 윗니 끝
        continue
    t = min(1.0, (x - FRONT) / (X_END - FRONT))
    yb = top[x] + (bot[x] - top[x]) * (1 - t) ** 0.9 * 0.92   # 입안 경계 (뒤는 깊고 앞으로 갈수록 윗니 쪽으로)
    if y > yb or x >= X_END:
        out[y, x, 3] = 0
        continue
    f = (y - top[x]) / max(1.0, yb - top[x])                 # 0 입천장 → 1 경계
    deep = 1 - t                                             # 목구멍 쪽일수록 어둡게
    base = np.array([96, 34, 34]) * (1 - f * 0.5) + np.array([128, 48, 44]) * f * 0.5
    base = base * (0.62 + 0.38 * t) if deep > 0.5 else base * (0.8 + 0.2 * t)
    if yb - y < 3:                                           # 경계의 짙은 잇몸 선
        base = np.array([48, 14, 18])
    out[y, x, :3] = np.clip(base, 0, 255)
    out[y, x, 3] = 255
Image.fromarray(out.astype(np.uint8), 'RGBA').save(os.path.join(D, 'head_m.png'))

lim = rig.setdefault('limits', {})
lim['jaw_m'] = {'min': 0}
txt = json.dumps(rig, ensure_ascii=False, indent=2)
raw = open(os.path.join(D, 'rig.json'), encoding='utf-8').read()
open(os.path.join(D, 'rig.json'), 'w', encoding='utf-8', newline='\n').write(txt if raw.endswith('}') and not raw.endswith('}\n') else txt + '\n')
print('head_m: 아래턱 자리', int(mask.sum()), 'px → 입안·트인 입 / limits jaw_m min 0')

# ---- body_m: 머리·아래턱이 덮는 자리의 몸통 입 지우기 (D-124) ----
pb = rig['parts']['body_m']
body = np.array(Image.open(os.path.join(D, 'body_m.png')).convert('RGBA'))
cover = Image.new('L', (body.shape[1], body.shape[0]), 0)
for name in ('head_m', 'jaw_m'):
    p = rig['parts'][name]
    cover.paste(Image.open(os.path.join(D, p['src'])).convert('RGBA').getchannel('A').point(lambda a: 255 if a > 40 else 0),
                (p['x'] - pb['x'], p['y'] - pb['y']), Image.open(os.path.join(D, p['src'])).convert('RGBA').getchannel('A').point(lambda a: 255 if a > 40 else 0))
cover = np.array(cover.filter(ImageFilter.MaxFilter(5))) > 0   # 2px 넓혀 이 외곽선 부스러기까지 (뒤쪽 목 이음매는 HINGE로 남김)
HINGE = 860 - pb['x']   # 머리 경첩(804) 조금 앞부터 — 그 뒤는 목이라 머리가 기울어도 거의 안 드러남
cover[:, :HINGE] = False
body[cover, 3] = 0
Image.fromarray(body, 'RGBA').save(os.path.join(D, 'body_m.png'))
print('body_m: 머리 밑 몸통 입', int(cover.sum()), 'px → 투명')
