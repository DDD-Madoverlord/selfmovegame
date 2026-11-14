"""
태고의 용왕(괴수 m) 날개 떼기 (D-124): 몸통 그림 body_m에 붙어 있던 앞(가까운) 날개를 따로 떼어 wing_m.png로 → 리그 뼈 'wing'(몸통 뒤)이
날개 돌풍 때 펄럭임 (kaijuRig.js wingFlap 동작). 다른 세트는 날개 그림이 없어 'wing' 뼈가 그리지 않음 (히어로 capeIn과 같은 방식).
날개는 몸통 뒤에 있어 떼어 낸 자리를 따로 채울 것은 없음 (어깨·팔이 앞에서 가림).

실행: python tools/rig/kaiju_m_wing.py   (body_m은 git 원본 → kaiju_m_mouth_fix.py → 이 스크립트 순서)
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

D = os.path.join('assets', 'sprites', 'rig', 'kaiju')
RIG = os.path.join(D, 'rig.json')
rig = json.load(open(RIG, encoding='utf-8'))
pb = rig['parts']['body_m']
# 앞 날개 영역 (body_m 그림 좌표): 날개 팔뼈 오른쪽 외곽선 → 어깨 → 몸통 옆 → 아래 날개막 가리비 끝
POLY = [(0, 0), (398, 0), (410, 25), (428, 90), (445, 160), (458, 230), (440, 262), (400, 300), (372, 345),
        (352, 400), (340, 460), (325, 535), (230, 560), (120, 572), (0, 578)]
PIVOT = (445, 250)   # 어깨 (날개 팔뼈 뿌리)

body = Image.open(os.path.join(D, 'body_m.png')).convert('RGBA')
mask = Image.new('L', body.size, 0)
ImageDraw.Draw(mask).polygon(POLY, fill=255)
m = np.array(mask) > 0
b = np.array(body)
wing = np.zeros_like(b)
wing[m] = b[m]
b[m, 3] = 0
ys, xs = np.nonzero(wing[..., 3] > 0)
x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
Image.fromarray(wing[y0:y1, x0:x1], 'RGBA').save(os.path.join(D, 'wing_m.png'))
Image.fromarray(b, 'RGBA').save(os.path.join(D, 'body_m.png'))
rig['parts']['wing_m'] = {'src': 'wing_m.png', 'x': int(pb['x'] + x0), 'y': int(pb['y'] + y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}
rig['pivots']['wing'] = [float(pb['x'] + PIVOT[0]), float(pb['y'] + PIVOT[1])]
open(RIG, 'w', encoding='utf-8', newline='\n').write(json.dumps(rig, ensure_ascii=False, indent=2))
print('wing_m', rig['parts']['wing_m'], 'pivot', rig['pivots']['wing'])
