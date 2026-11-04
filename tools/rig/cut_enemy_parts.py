"""
리그용 적 파츠 분리 스크립트 (Gemini 그림 2장 → 조각 PNG + rig.json) — 경비병·방패병·마취총 사수·전기 충격병·의무병·보스

실행: 프로젝트 루트에서
  python tools/rig/cut_enemy_parts.py guard            # 한 종류
  python tools/rig/cut_enemy_parts.py all              # 전부
  python tools/rig/cut_enemy_parts.py shield --preview # 자르는 선·팔 영역만 그려 확인 (tools/rig/_cut_<적>.png)

입력 (assets/sprites/stage/src, 1024×1024, 두 장은 픽셀 정렬 확인됨: 겹쳐 어긋남 0px)
 - <적>_1_gemini.png : 전신 (왼쪽을 봄, 걷는 중간 자세)
 - <적>_2_gemini.png : 같은 그림에서 팔(소매·손·무기)만 지운 몸

분리 방침 (경비병에서 확인한 방식, D-035)
 - 팔 = 두 그림이 다른 곳. 'two' = 왼쪽 덩어리가 앞팔(무기), 오른쪽이 뒷팔 / 'one' = 두 팔 + 무기를 한 조각(마취총)
   어두운 팔과 그 뒤 배낭처럼 색이 비슷하면 차이가 조각나므로 close(px)로 틈을 메움
 - 몸통 = 팔 없는 그림 (팔이 움직이면 드러나는 곳이 이미 채워져 있음)
 - 머리: head_y 위. 그 아래 몇 px는 몸통에도 남겨(목 띠) 고개를 까딱여도 틈이 안 보이게
 - 다리: hip_y 아래를 사타구니 선(x = crotch + slope × (y - hip_y))으로 둘로. 위쪽 몇 px는 몸통(골반)에도 남김
 - 무기 끝의 불꽃처럼 떨어진 작은 조각도 살림 (가장 큰 덩어리만 남기지 않음)
 - 오른쪽 아래 Gemini 로고는 unlogo.py로 지운 뒤 처리
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'images'))
from rigcut import remove_key_background, largest, grow, cut, save_parts, write_layout, rest_check  # noqa: E402
from unlogo import load_clean  # noqa: E402

SRC = 'assets/sprites/stage/src/{name}_{n}_gemini.png'
SRC_GPT = 'assets/sprites/stage/src/{src}_{n}_gpt.png'   # 새 기획 적 (D-085, GPT 투명 PNG 1254×1254) — cfg 'src' = 'st<N>/<적>'
OUT = 'assets/sprites/rig/{name}'

# head_y: 머리/몸통 경계(턱 아래), hip_y: 몸통/다리 경계, crotch: hip_y에서 다리 나누는 x, slope: 아래로 갈수록 x 이동
# arms: 'two' | 'one', close: 팔 영역 틈 메우기(px), key: 배경색
# arm_top: 팔(무기) 차이를 찾기 시작하는 y (방패가 머리 높이까지 올라오면 더 위로), head_x: 머리 조각 x 범위 (어깨 갑옷 제외)
# cape: (x, y) 오른쪽 아래의 파란 망토를 따로 한 조각으로 (다리에 붙어 같이 흔들리지 않게, 몸통 뒤에서 살랑임)
# pivot: 자동으로 잡은 회전 중심 대신 (방패·분사기는 맨 위가 아니라 손잡이/어깨에서 돌아야 함)
# flip: 좌우 뒤집어서 처리 (오른쪽을 보는 그림), tail: (x0, y0, x1, y1) 이 영역의 꼬리를 따로 한 조각으로
# not_arm: [(x0, y0, x1, y1)] 팔 차이에서 뺄 곳 (팔 없는 그림이 가슴·망토를 다시 그려 차이가 생긴 곳)
# head_cut: [(x0, y0, x1, y1)] 머리에서 뺄 곳 (머리 높이까지 올라온 등짐 — 몸통에 남김)
ENEMIES = {
    'guard':    {'key': 'green', 'head_y': 392, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 0},
    'shield':   {'key': 'green', 'head_y': 408, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 11,
                 'arm_top': 200, 'pivot': {'armF': (365, 520)}},
    'tranq':    {'key': 'green', 'head_y': 392, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'one', 'close': 5},
    'shock':    {'key': 'green', 'head_y': 392, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 9},
    'medic':    {'key': 'magenta', 'head_y': 410, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 9,
                 'pivot': {'armF': (425, 478)}},
    'guardian': {'key': 'green', 'head_y': 305, 'hip_y': 752, 'crotch': 577, 'slope': 0.35, 'arms': 'two', 'close': 7,
                 'arm_top': 200, 'head_x': (370, 600), 'cape': (600, 380), 'pivot': {'armF': (365, 410)}},
    # ---- 구역 2: 고철 약탈단 (마젠타 배경, D-040) ----
    'raider':   {'key': 'magenta', 'head_y': 400, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 9,
                 'not_arm': [(410, 440, 610, 700)]},
    'builder':  {'key': 'magenta', 'head_y': 430, 'hip_y': 735, 'crotch': 517, 'slope': 0.3, 'arms': 'two', 'close': 9,
                 'head_x': (320, 565)},
    'sludge':   {'key': 'magenta', 'head_y': 405, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 9,
                 'head_cut': [(615, 285, 900, 410)]},
    'netter':   {'key': 'magenta', 'head_y': 395, 'hip_y': 715, 'crotch': 540, 'slope': 0.3, 'arms': 'one', 'close': 9,
                 'not_arm': [(605, 380, 800, 800)]},
    'mechanic': {'key': 'magenta', 'head_y': 405, 'hip_y': 700, 'crotch': 510, 'slope': 0.35, 'arms': 'two', 'close': 9},
    # 보스 고철왕: 폐차 조종석 = 몸통, 조종사(위) = 머리, 크레인 팔(앞) = armF, 집게 팔(뒤) = armB
    'scrapking': {'key': 'magenta', 'head_y': 290, 'hip_y': 560, 'crotch': 535, 'slope': 0.25, 'arms': 'two', 'close': 5,
                  'arm_top': 60, 'head_x': (470, 700),
                  'pivot': {'armF': (395, 300), 'armB': (812, 420), 'legF': (450, 580), 'legB': (690, 575)}},
    # 합성괴인 졸개(아군): 오른쪽을 보는 그림 → 뒤집어서 적과 같은 방향으로 자름 (게임에선 아군이라 다시 뒤집어 그림)
    'minion':   {'key': 'green', 'flip': True, 'head_y': 470, 'hip_y': 640, 'crotch': 505, 'slope': 0.12, 'arms': 'two',
                 'close': 7, 'arm_top': 400, 'head_x': (200, 560), 'tail': (712, 655, 1024, 775),
                 'pivot': {'armF': (320, 515), 'armB': (585, 470), 'legB': (590, 655), 'tail': (712, 728)}},
    # ---- 구역 3: 성왕국 이단심문소 (초록 배경, D-056) ----
    'soldier':    {'key': 'green', 'head_y': 440, 'hip_y': 690, 'crotch': 520, 'slope': 0.35, 'arms': 'two', 'close': 9},
    # inquisitor · holyshield: 새 기획 스테이지 3 GPT 그림으로 바뀜 (아래 'st3/…', D-085)
    'priest':     {'key': 'green', 'head_y': 440, 'hip_y': 720, 'crotch': 510, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 9,
                   'arm_top': 250},   # 책 위로 피어오르는 빛가루도 앞팔에
    'mage':       {'key': 'green', 'head_y': 450, 'hip_y': 730, 'crotch': 520, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 9,
                   'arm_top': 150},
    'demon':      {'key': 'green', 'head_y': 430, 'hip_y': 700, 'crotch': 520, 'slope': 0.3, 'arms': 'two', 'close': 9},
    'demonknight': {'key': 'green', 'head_y': 400, 'hip_y': 720, 'crotch': 530, 'slope': 0.3, 'arms': 'two', 'close': 9,
                    'cape': (600, 420), 'cape_color': 'red'},
    # 보스 대주교: 가마에 떠 있어 다리 없음 (가마·예복 아래쪽 = 몸통), 등 뒤 악마 그림자는 몸통에 남김
    'archbishop': {'key': 'green', 'legs': 'none', 'head_y': 420, 'hip_y': 720, 'crotch': 520, 'slope': 0.0, 'arms': 'two', 'shoulder': True,
                   'close': 9, 'arm_top': 100, 'head_x': (330, 640),
                   'pivot': {'armF': (370, 395), 'armB': (650, 410)}},   # 넓은 소매: 닿는 곳 대신 어깨를 직접
    # ---- 구역 4: 진화의 심연 (노랑 배경) ----
    'cultist':    {'key': 'yellow', 'head_y': 430, 'hip_y': 720, 'crotch': 520, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 9,
                   'arm_top': 150},   # 머리 높이까지 치켜든 뒷손·지팡이 끝
    'tentacle':   {'key': 'yellow', 'head_y': 400, 'hip_y': 700, 'crotch': 540, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 9,
                   'arm_top': 150},
    'carapace':   {'key': 'yellow', 'head_y': 400, 'hip_y': 700, 'crotch': 540, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 11,
                   'arm_top': 150, 'head_x': (270, 545)},   # 등껍질 윗부분은 몸통에 (고개를 까딱여도 등껍질은 그대로)
    'sporer':     {'key': 'yellow', 'head_y': 430, 'hip_y': 720, 'crotch': 520, 'slope': 0.3, 'arms': 'two', 'shoulder': True, 'close': 9,
                   'head_x': (300, 560)},
    # 보스 관장자 오큘러스: 아래는 거대한 벌레 몸 (다리 없음 — 몸통에 포함), 2페이즈(oculus2)는 외눈 투구·톱날 팔
    # 새 기획 스테이지 4 그림 (D-085, GPT): 위 = 뇌가 드러난 인간형, 아래 = 다리가 엉킨 벌레 몸 (몸통에 포함). 2페이즈(oculus2)는 예전 그림
    'oculus':     {'src': 'st4/oculus', 'key': None, 'legs': 'none', 'head_y': 330, 'hip_y': 1000, 'crotch': 600, 'slope': 0.0, 'arms': 'two',
                   'shoulder': True, 'arm_reach': 50, 'close': 9, 'arm_top': 300, 'head_x': (250, 620)},
    'oculus2':    {'key': 'yellow', 'legs': 'none', 'head_y': 330, 'hip_y': 700, 'crotch': 520, 'slope': 0.0, 'arms': 'two',
                   'shoulder': True, 'close': 9, 'arm_top': 60, 'head_x': (360, 790)},
    # 키메라 슬라임: 팔·다리·머리 없는 한 덩어리 (걷기 = 눌렸다 늘어나기)
    'slime':      {'key': 'yellow', 'arms': 'none', 'head_y': 300, 'hip_y': 800, 'crotch': 512, 'slope': 0.0,
                   'pivot': {'root': (530, 910), 'body': (530, 905)}},   # 바닥 가운데에서 눌렸다 늘어남 (오른쪽 아래 방울은 무시)
    # 뒤틀린 인형사의 토끼 인형(아군, 새 캐릭터 D-049): 오른쪽을 보는 그림 → 뒤집어 자름. 앞으로 뻗은 두 팔이 겹쳐 한 조각
    'rabbit':   {'key': 'green', 'flip': True, 'head_y': 520, 'hip_y': 770, 'crotch': 495, 'slope': 0.0, 'arms': 'one',
                 'close': 9, 'arm_top': 470, 'pivot': {'arms': (480, 548)}},
    # ---- 새 기획 스테이지 1 · 블랙 하운드 (D-085, GPT 투명 PNG 1254px — key None, src = 원본 자리) ----
    # erase_white: [(x0, y0, w, h)] 호스 고리 안에 갇혀 남은 흰 배경을 지움
    'conscript': {'src': 'st1/conscript', 'key': None, 'head_y': 500, 'hip_y': 846, 'crotch': 644, 'slope': 0.05, 'arms': 'one', 'close': 9},
    'riot':      {'src': 'st1/riot', 'key': None, 'head_y': 480, 'hip_y': 863, 'crotch': 650, 'slope': 0.1, 'arms': 'two', 'close': 11,
                  'arm_top': 250},
    'taser':     {'src': 'st1/taser', 'key': None, 'head_y': 495, 'hip_y': 790, 'crotch': 627, 'slope': 0.0, 'arms': 'two', 'close': 9},
    'rocket':    {'src': 'st1/rocket', 'key': None, 'head_y': 495, 'hip_y': 800, 'crotch': 633, 'slope': 0.0, 'arms': 'one', 'close': 9,
                  'arm_top': 250},
    'flamer':    {'src': 'st1/flamer', 'key': None, 'head_y': 465, 'hip_y': 805, 'crotch': 624, 'slope': 0.08, 'arms': 'one', 'close': 9,
                  'not_arm': [(780, 420, 1010, 760)], 'erase_white': [(772, 747, 77, 51)]},
    'exo':       {'src': 'st1/exo', 'key': None, 'head_y': 330, 'hip_y': 690, 'crotch': 578, 'slope': 0.05, 'arms': 'two', 'close': 11,
                  'arm_top': 250, 'shoulder': True, 'head_x': (420, 650),
                  'erase_white': [(1014, 191, 49, 148), (750, 549, 120, 145), (393, 578, 76, 83)]},
    # 보스 WMD-알파: 머리 = 몸통 가운데 붉은 눈 감지기, 앞팔 = 플라스마 포, 뒷팔 = 집게 팔
    'wmdalpha':  {'src': 'st1/wmdalpha', 'key': None, 'head_y': 410, 'hip_y': 660, 'crotch': 588, 'slope': 0.39, 'arms': 'two', 'close': 11,
                  'arm_top': 150, 'shoulder': True, 'head_x': (470, 660)},
    # 한 장짜리(팔 없는 몸 없음): 몸 한 조각 — 군견은 달리며 들썩, EMP 드론은 떠서 출렁 (게임에서 fly만큼 띄움)
    'hound':     {'src': 'st1/hound', 'key': None, 'arms': 'none', 'head_y': 400, 'hip_y': 900, 'crotch': 620, 'slope': 0.0,
                  'pivot': {'root': (620, 924), 'body': (620, 900)}},
    'empdrone':  {'src': 'st1/empdrone', 'key': None, 'arms': 'none', 'head_y': 400, 'hip_y': 900, 'crotch': 626, 'slope': 0.0,
                  'pivot': {'root': (626, 982), 'body': (626, 680)}},
    # ---- 새 기획 스테이지 2 · 에너지 코퍼레이션 중장비 방위군 (D-085) ----
    'merc':      {'src': 'st2/merc', 'key': None, 'head_y': 515, 'hip_y': 860, 'crotch': 663, 'slope': 0.12, 'arms': 'one', 'close': 9},
    # 산성액 투척 메카: 머리 = 주황 조종석, 팔 = 드럼통을 든 앞팔 하나 (등의 드럼통은 몸통)
    'acidmech':  {'src': 'st2/acidmech', 'key': None, 'head_y': 440, 'hip_y': 700, 'crotch': 700, 'slope': 0.1, 'arms': 'one', 'close': 11,
                  'arm_top': 150, 'head_x': (470, 700)},
    # 채굴용 엑스카베이터: 머리 = 조종석 유리, 앞·뒤 드릴 팔
    'excavator': {'src': 'st2/excavator', 'key': None, 'head_y': 400, 'hip_y': 740, 'crotch': 660, 'slope': -0.1, 'arms': 'two', 'close': 11,
                  'arm_top': 300, 'shoulder': True, 'head_x': (400, 720)},
    # 보스 기간틱 테라포머: 머리 = 위 운전석, 앞팔 = 파일벙커, 뒷팔 = 집게 크레인 팔
    'terraformer': {'src': 'st2/terraformer', 'key': None, 'head_y': 320, 'hip_y': 640, 'crotch': 580, 'slope': 0.45, 'arms': 'two', 'close': 11,
                    'arm_top': 100, 'shoulder': True, 'head_x': (380, 700)},
    # 한 장짜리: 불도저 드로이드 · 작살포 트럭 · 회전톱 드론(뜸) · 음파 차단 탑 · 포격 워커
    'dozer':     {'src': 'st2/dozer', 'key': None, 'arms': 'none'},
    'harpoon':   {'src': 'st2/harpoon', 'key': None, 'arms': 'none'},
    'sawdrone':  {'src': 'st2/sawdrone', 'key': None, 'arms': 'none'},
    'sonictower': {'src': 'st2/sonictower', 'key': None, 'arms': 'none'},
    'spiderwalker': {'src': 'st2/spiderwalker', 'key': None, 'arms': 'none',
                     'erase_white': [(984, 365, 37, 46), (1060, 447, 35, 57), (433, 496, 88, 43)]},
    # ---- 새 기획 스테이지 3 · 성왕국 이단 토벌대 & 광신도 연합 (D-085) — 긴 옷자락은 다리를 밑단 아래로 ----
    'zealot':    {'src': 'st3/zealot', 'key': None, 'head_y': 565, 'hip_y': 960, 'crotch': 650, 'slope': -0.1, 'arms': 'two', 'arm_reach': 45, 'close': 9,
                  'arm_top': 150, 'shoulder': True},   # 앞 = 쇠스랑, 뒤 = 높이 든 횃불
    'holyshield': {'src': 'st3/holyshield', 'key': None, 'head_y': 480, 'hip_y': 940, 'crotch': 670, 'slope': 0.0, 'arms': 'two', 'close': 11,
                   'arm_top': 250},
    'inquisitor': {'src': 'st3/inquisitor', 'key': None, 'head_y': 575, 'hip_y': 1010, 'crotch': 740, 'slope': 0.0, 'arms': 'one', 'arm_reach': 45,
                   'close': 9, 'arm_top': 300},   # 가시 쇠사슬 채찍 + 두 팔 (넓은 소매가 가슴에서 이어져 한 조각)
    'lightmage': {'src': 'st3/lightmage', 'key': None, 'head_y': 570, 'hip_y': 1000, 'crotch': 660, 'slope': 0.0, 'arms': 'two', 'arm_reach': 45, 'close': 9,
                  'arm_top': 100, 'shoulder': True},   # 앞 = 빛 구슬, 뒤 = 긴 지팡이
    'battlepriest': {'src': 'st3/battlepriest', 'key': None, 'head_y': 545, 'hip_y': 1010, 'crotch': 650, 'slope': 0.0, 'arms': 'two', 'arm_reach': 50, 'close': 9,
                     'arm_top': 300},   # 앞 = 십자가 향로
    'executioner': {'src': 'st3/executioner', 'key': None, 'head_y': 420, 'hip_y': 900, 'crotch': 800, 'slope': 0.0, 'arms': 'one', 'arm_reach': 60, 'close': 11,
                    'arm_top': 380, 'head_x': (480, 760)},   # 처형용 대검을 두 손으로
    # 보스 대주교 베네딕트: 땅에 끌리는 교황복 (다리 없음 — 몸통째 출렁), 앞팔 = 강철 십자가, 뒷팔 = 검붉은 손
    'benedict':  {'src': 'st3/benedict', 'key': None, 'legs': 'none', 'head_y': 520, 'hip_y': 1000, 'crotch': 700, 'slope': 0.0, 'arms': 'two',
                  'arm_reach': 50, 'close': 11, 'arm_top': 150, 'shoulder': True, 'head_x': (440, 720),
                  'not_arm': [(700, 820, 1254, 1254)]},   # 옷자락 밑 검은 촉수는 팔이 아님 (팔 없는 그림에 없어 빠짐 — 장식)
    'griffon':   {'src': 'st3/griffon', 'key': None, 'arms': 'none'},
    'ballista':  {'src': 'st3/ballista', 'key': None, 'arms': 'none', 'erase_white': [(28, 502, 239, 82)]},
    # ---- 새 기획 스테이지 4 · 별의 사도들과 실패한 진화체들 (D-085) ----
    'mutant':    {'src': 'st4/mutant', 'key': None, 'head_y': 470, 'hip_y': 905, 'crotch': 610, 'slope': 0.5, 'arms': 'two', 'arm_reach': 50,
                  'close': 9, 'arm_top': 350, 'shoulder': True},
    'boneshield': {'src': 'st4/boneshield', 'key': None, 'head_y': 430, 'hip_y': 870, 'crotch': 600, 'slope': 0.6, 'arms': 'two', 'close': 11,
                   'arm_top': 200},
    'leechfiend': {'src': 'st4/leechfiend', 'key': None, 'head_y': 440, 'hip_y': 880, 'crotch': 620, 'slope': 0.8, 'arms': 'one', 'arm_reach': 60, 'close': 9,
                   'arm_top': 350},   # 양팔 = 거머리 촉수 (겹쳐서 한 조각)
    'sporecaster': {'src': 'st4/sporecaster', 'key': None, 'head_y': 470, 'hip_y': 985, 'crotch': 640, 'slope': 0.3, 'arms': 'two',
                    'arm_reach': 45, 'close': 9, 'arm_top': 400, 'shoulder': True, 'head_x': (200, 700)},   # 등 뒤 포자 촉수는 몸통
    'chimeraslime': {'src': 'st4/chimeraslime', 'key': None, 'arms': 'none'},
    'parasite':  {'src': 'st4/parasite', 'key': None, 'arms': 'none'},
    'eyetower':  {'src': 'st4/eyetower', 'key': None, 'arms': 'none'},
    'fusionbeast': {'src': 'st4/fusionbeast', 'key': None, 'arms': 'none'},
    # ---- 새 기획 스테이지 5 · 어비스 연합 해군 & 특수 잠수 부대 (D-085) ----
    'marine':    {'src': 'st5/marine', 'key': None, 'head_y': 525, 'hip_y': 860, 'crotch': 622, 'slope': 0.1, 'arms': 'one', 'close': 9},
    'hatchshield': {'src': 'st5/hatchshield', 'key': None, 'head_y': 525, 'hip_y': 860, 'crotch': 628, 'slope': 0.1, 'arms': 'two', 'close': 11,
                    'arm_top': 300},   # 앞 = 해치 방패, 뒤 = 렌치
    'netgunner': {'src': 'st5/netgunner', 'key': None, 'head_y': 525, 'hip_y': 860, 'crotch': 628, 'slope': 0.1, 'arms': 'one', 'close': 9,
                  'arm_top': 250},   # 어깨에 멘 그물포
    'mineman':   {'src': 'st5/mineman', 'key': None, 'head_y': 525, 'hip_y': 860, 'crotch': 628, 'slope': 0.1, 'arms': 'two', 'close': 9,
                  'arm_top': 300, 'shoulder': True},   # 앞 = 치켜든 폭뢰
    'toxicdiver': {'src': 'st5/toxicdiver', 'key': None, 'head_y': 520, 'hip_y': 830, 'crotch': 618, 'slope': 0.15, 'arms': 'two', 'close': 9,
                   'arm_top': 450, 'shoulder': True, 'head_x': (400, 770)},   # 등의 맹독 산소통은 몸통
    # 보스 아이언클래드: 머리 = 위 조종석 유리, 앞팔 = 압축포, 뒷팔 = 집게 팔
    'ironclad':  {'src': 'st5/ironclad', 'key': None, 'head_y': 330, 'hip_y': 900, 'crotch': 710, 'slope': 0.15, 'arms': 'two', 'close': 11,
                  'arm_top': 300, 'shoulder': True, 'head_x': (560, 880)},
    'sonardrone': {'src': 'st5/sonardrone', 'key': None, 'arms': 'none'},
    'deckgun':   {'src': 'st5/deckgun', 'key': None, 'arms': 'none'},
    'subwalker': {'src': 'st5/subwalker', 'key': None, 'arms': 'none'},
    # ---- 새 기획 스테이지 6 · 성혈 의료 기사단 (D-085) — 긴 옷은 밑단 아래를 다리로 ----
    'orderly':   {'src': 'st6/orderly', 'key': None, 'head_y': 520, 'hip_y': 975, 'crotch': 640, 'slope': 0.3, 'arms': 'two', 'arm_reach': 45,
                  'close': 9, 'arm_top': 350, 'shoulder': True},   # 앞 = 수술용 메스, 뒤 = 뼈톱
    'maidenshield': {'src': 'st6/maidenshield', 'key': None, 'head_y': 520, 'hip_y': 975, 'crotch': 610, 'slope': 0.3, 'arms': 'two', 'close': 11,
                     'arm_top': 250, 'head_x': (440, 760)},   # 앞 = 아이언 메이든 방패, 뒤 = 철퇴
    'holywater': {'src': 'st6/holywater', 'key': None, 'head_y': 500, 'hip_y': 1025, 'crotch': 640, 'slope': 0.6, 'arms': 'two', 'arm_reach': 45,
                  'close': 9, 'arm_top': 300, 'shoulder': True},   # 앞 = 성수 병
    'anesthetist': {'src': 'st6/anesthetist', 'key': None, 'head_y': 540, 'hip_y': 1025, 'crotch': 660, 'slope': 0.3, 'arms': 'two', 'arm_reach': 45,
                    'close': 9, 'arm_top': 350, 'shoulder': True},   # 앞 = 수면 가스 향로
    'bloated':   {'src': 'st6/bloated', 'key': None, 'head_y': 460, 'hip_y': 925, 'crotch': 605, 'slope': 0.2, 'arms': 'two', 'close': 9,
                  'arm_top': 450, 'shoulder': True, 'head_x': (330, 640)},   # 등의 수혈 거치대는 몸통
    'surgeon':   {'src': 'st6/surgeon', 'key': None, 'head_y': 470, 'hip_y': 1020, 'crotch': 800, 'slope': 0.5, 'arms': 'one', 'arm_reach': 60,
                  'close': 11, 'arm_top': 450, 'head_x': (600, 900),
                  'erase_white': [(690, 120, 260, 200), (560, 590, 150, 170), (950, 580, 60, 140)]},   # 전기톱 십자가를 두 손으로 (후광 안 흰 배경 지움)
    'bloodbagdrone': {'src': 'st6/bloodbagdrone', 'key': None, 'arms': 'none'},
    'ambulance': {'src': 'st6/ambulance', 'key': None, 'arms': 'none'},
    'grailheart': {'src': 'st6/grailheart', 'key': None, 'arms': 'none'},   # 보스: 공중에 뜬 핏빛 보석 심장 (한 조각)
    # ---- 새 기획 스테이지 7 · 제국 제1 포병 사단 (D-085) — 긴 외투는 밑단 아래를 다리로 ----
    'trench':    {'src': 'st7/trench', 'key': None, 'head_y': 545, 'hip_y': 935, 'crotch': 740, 'slope': 0.6, 'arms': 'one', 'arm_reach': 50,
                  'close': 9, 'arm_top': 450, 'head_x': (450, 830)},   # 총검 소총을 두 손으로 (등의 배낭은 몸통)
    'wireshield': {'src': 'st7/wireshield', 'key': None, 'head_y': 560, 'hip_y': 925, 'crotch': 632, 'slope': 0.23, 'arms': 'two', 'arm_reach': 45, 'close': 11,
                   'arm_top': 350},   # 앞 = 철조망 바리케이드
    'grenadier': {'src': 'st7/grenadier', 'key': None, 'head_y': 560, 'hip_y': 925, 'crotch': 632, 'slope': 0.23, 'arms': 'two', 'arm_reach': 50, 'close': 9,
                  'arm_top': 250, 'shoulder': True},   # 뒤 = 치켜든 수류탄
    'gassoldier': {'src': 'st7/gassoldier', 'key': None, 'head_y': 560, 'hip_y': 925, 'crotch': 632, 'slope': 0.23, 'arms': 'one', 'arm_reach': 45,
                   'close': 9, 'arm_top': 450, 'not_arm': [(760, 380, 1254, 820)], 'head_x': (420, 770)},   # 가스 분사기를 두 손으로 (등의 가스통은 몸통)
    'officer':   {'src': 'st7/officer', 'key': None, 'head_y': 545, 'hip_y': 925, 'crotch': 632, 'slope': 0.23, 'arms': 'two', 'close': 9,
                  'arm_top': 450, 'shoulder': True},   # 앞 = 군도
    'sapper':    {'src': 'st7/sapper', 'key': None, 'head_y': 560, 'hip_y': 925, 'crotch': 632, 'slope': 0.23, 'arms': 'one', 'arm_reach': 45,
                  'close': 9, 'arm_top': 500, 'head_x': (440, 760)},   # 대전차 지뢰를 두 손으로 (등의 삽은 몸통)
    'mgnest':    {'src': 'st7/mgnest', 'key': None, 'arms': 'none'},
    'steamtank': {'src': 'st7/steamtank', 'key': None, 'arms': 'none'},
    'behemoth':  {'src': 'st7/behemoth', 'key': None, 'arms': 'none'},   # 보스 심판의 구포: 다족 보행 공성포 (한 조각)
    # ---- 새 기획 스테이지 8 · 노르딘 왕실 근위대 (D-085) ----
    'torch':     {'src': 'st8/torch', 'key': None, 'head_y': 545, 'hip_y': 925, 'crotch': 610, 'slope': 0.3, 'arms': 'two', 'arm_reach': 45,
                  'close': 9, 'arm_top': 120, 'shoulder': True},   # 앞 = 치켜든 횃불
    'furnaceshield': {'src': 'st8/furnaceshield', 'key': None, 'head_y': 540, 'hip_y': 925, 'crotch': 610, 'slope': 0.3, 'arms': 'one', 'close': 5,
                      'arm_top': 250},   # 화로석 방패 + 도끼 (두 팔이 몸 앞에서 이어져 한 조각)
    'oilthrower': {'src': 'st8/oilthrower', 'key': None, 'head_y': 545, 'hip_y': 925, 'crotch': 610, 'slope': 0.3, 'arms': 'two', 'arm_reach': 45,
                   'close': 9, 'arm_top': 300, 'shoulder': True, 'not_arm': [(0, 880, 1254, 1254)]},   # 앞 = 끓는 기름 단지
    'hunter':    {'src': 'st8/hunter', 'key': None, 'head_y': 545, 'hip_y': 925, 'crotch': 610, 'slope': 0.3, 'arms': 'one', 'arm_reach': 50,
                  'close': 9, 'arm_top': 450, 'head_x': (380, 780), 'not_arm': [(760, 300, 1254, 1254)]},   # 작살 석궁을 두 손으로 (늑대 가죽 망토는 몸통)
    'heatshaman': {'src': 'st8/heatshaman', 'key': None, 'head_y': 545, 'hip_y': 975, 'crotch': 620, 'slope': 0.3, 'arms': 'two', 'arm_reach': 45,
                   'close': 9, 'arm_top': 120, 'shoulder': True, 'not_arm': [(0, 940, 1254, 1254)]},   # 앞 = 화로석 지팡이
    'steambomber': {'src': 'st8/steambomber', 'key': None, 'head_y': 545, 'hip_y': 905, 'crotch': 520, 'slope': 0.4, 'arms': 'one', 'arm_reach': 50,
                    'close': 9, 'arm_top': 500, 'head_x': (250, 600), 'not_arm': [(600, 200, 1254, 900)]},   # 증기 노즐 (등의 증기 탱크는 몸통)
    # 보스 블라디미르: 긴 망토로 다리가 거의 가려 다리 없음 (몸통째 묵직하게), 팔 = 불타는 대검을 든 앞팔
    'vladimir':  {'src': 'st8/vladimir', 'key': None, 'legs': 'none', 'head_y': 330, 'hip_y': 1000, 'crotch': 700, 'slope': 0.0, 'arms': 'one',
                  'arm_reach': 60, 'close': 11, 'arm_top': 350, 'head_x': (560, 820)},
    'frozenstatue': {'src': 'st8/frozenstatue', 'key': None, 'arms': 'none'},
    'heatturret': {'src': 'st8/heatturret', 'key': None, 'arms': 'none'},
    'wolfknight': {'src': 'st8/wolfknight', 'key': None, 'arms': 'none'},
    # ---- 새 기획 스테이지 9 · 골드만 건설 용역 및 중장비 경비대 (D-085) ----
    'thug':      {'src': 'st9/thug', 'key': None, 'head_y': 525, 'hip_y': 820, 'crotch': 600, 'slope': 0.08, 'arms': 'two', 'close': 9,
                  'arm_top': 250, 'shoulder': True},   # 앞 = 쇠파이프, 뒤 = 네일건
    'cementsprayer': {'src': 'st9/cementsprayer', 'key': None, 'head_y': 525, 'hip_y': 820, 'crotch': 600, 'slope': 0.08, 'arms': 'one', 'arm_reach': 50,
                      'close': 9, 'arm_top': 400, 'head_x': (420, 760), 'not_arm': [(760, 300, 1254, 1000), (0, 790, 1254, 1254)]},   # 살수 호스 (등의 시멘트 통·다리 뒤 호스 고리는 몸통)
    'rivetsniper': {'src': 'st9/rivetsniper', 'key': None, 'head_y': 525, 'hip_y': 820, 'crotch': 600, 'slope': 0.08, 'arms': 'one', 'arm_reach': 50,
                    'close': 9, 'arm_top': 400, 'head_x': (440, 780)},   # 리벳 소총 (탄띠·등짐은 몸통)
    'dynamite':  {'src': 'st9/dynamite', 'key': None, 'head_y': 525, 'hip_y': 820, 'crotch': 582, 'slope': 0.15, 'arms': 'one', 'arm_reach': 50,
                  'close': 9, 'arm_top': 450, 'shoulder': True, 'head_x': (250, 600)},   # 등의 다이너마이트 다발은 몸통
    # 안전 감시관: 종류 id는 예전 구역 6 'warden'(병동 간수)과 겹치지 않게 safetywarden
    'safetywarden': {'src': 'st9/warden', 'key': None, 'head_y': 525, 'hip_y': 820, 'crotch': 608, 'slope': 0.1, 'arms': 'two', 'close': 9,
                     'arm_top': 350, 'shoulder': True},   # 앞 = 확성기, 뒤 = 서류판
    'concretedrone': {'src': 'st9/concretedrone', 'key': None, 'arms': 'none'},
    'welderwalker': {'src': 'st9/welderwalker', 'key': None, 'arms': 'none'},
    'wreckingcrane': {'src': 'st9/wreckingcrane', 'key': None, 'arms': 'none'},
    'panopticon': {'src': 'st9/panopticon', 'key': None, 'arms': 'none'},   # 보스: 걸어 다니는 거북 요새 (한 조각)
    # ---- 새 기획 스테이지 10 · 언론 통제국 & 세뇌된 진압대 (D-085) ----
    'citizen':   {'src': 'st10/citizen', 'key': None, 'head_y': 480, 'hip_y': 870, 'crotch': 627, 'slope': 0.03, 'arms': 'two', 'close': 9,
                  'arm_top': 450, 'shoulder': True},
    'sonicshield': {'src': 'st10/sonicshield', 'key': None, 'head_y': 520, 'hip_y': 870, 'crotch': 610, 'slope': 0.15, 'arms': 'two', 'close': 9,
                    'arm_top': 250},   # 앞 = 음파 실드, 뒤 = 진압봉
    'lasersniper': {'src': 'st10/lasersniper', 'key': None, 'head_y': 520, 'hip_y': 830, 'crotch': 690, 'slope': 0.05, 'arms': 'one', 'arm_reach': 50,
                    'close': 9, 'arm_top': 350, 'head_x': (520, 860)},   # 레이저 소총 (등짐은 몸통)
    'enforcer':  {'src': 'st10/enforcer', 'key': None, 'head_y': 470, 'hip_y': 920, 'crotch': 700, 'slope': 0.5, 'arms': 'two', 'close': 11,
                  'arm_top': 150, 'shoulder': True},   # 앞 = 전기 진압봉
    'speakerdrone': {'src': 'st10/speakerdrone', 'key': None, 'arms': 'none'},
    'jammer':    {'src': 'st10/jammer', 'key': None, 'arms': 'none'},
    'woofermech': {'src': 'st10/woofermech', 'key': None, 'arms': 'none'},
    'mothervoice': {'src': 'st10/mothervoice', 'key': None, 'arms': 'none'},   # 보스: 떠 있는 핑크 기계 심장 (한 조각)
}
NECK_BAND = 14            # 몸통이 머리 아래쪽으로 더 가지는 목 띠(px)
HIP_BAND = 32             # 다리가 골반(몸통) 아래로 더 올라가는 겹침(px)
ARM_DIFF = 40             # 두 그림의 색 차이가 이보다 크면 팔
SEAM = 3                  # 팔 조각을 윤곽선까지 넓히는 폭
MIN_ARM = 1500            # 이보다 작은 차이 덩어리는 팔이 아님(다시 그려진 작은 무늬)


def src_path(name, cfg, n):
    return SRC_GPT.format(src=cfg['src'], n=n) if 'src' in cfg else SRC.format(name=name, n=n)


def keyed(path, key):
    """로고를 지운 그림 → 배경 제거 RGBA (떨어진 작은 조각도 살림). GPT 그림(key None)은 이미 투명 — 반투명 잡티만 지움"""
    if key is None:
        a = np.array(Image.open(path).convert('RGBA'))
        a[a[..., 3] < 24] = 0
        from rigcut import drop_specks
        a[~drop_specks(a[..., 3] > 0, 120)] = 0
        return a
    rgb, _ = load_clean(path)
    tmp = os.path.join(HERE, f'_tmp_{os.path.basename(path)}')
    Image.fromarray(rgb).save(tmp)
    try:
        return remove_key_background(tmp, key, min_part=40)
    finally:
        os.remove(tmp)


def arm_masks(full, armless, cfg, rows, op1, op2):
    diff = np.abs(full[..., :3].astype(int) - armless[..., :3].astype(int)).max(axis=2) > ARM_DIFF
    cols = np.broadcast_to(np.arange(rows.shape[1])[None, :], rows.shape)
    arms = op1 & (diff | ~op2) & (rows >= cfg.get('arm_top', cfg['head_y']))
    if cfg.get('key', 'green') is None:
        # GPT 그림: 팔 없는 몸을 새로 그려 무늬가 조금씩 달라짐 → 색 차이는 '팔 없는 그림에 없는 곳'(팔이 몸 밖으로 나온 곳)과
        # 이어진 덩어리만 팔로 (조끼 무늬·등짐처럼 다시 그려진 곳은 버림)
        seed = op1 & ~op2 & (rows >= cfg.get('arm_top', cfg['head_y']))
        seed = cv2.morphologyEx(seed.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
        cand = cv2.morphologyEx(arms.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n0, lab0 = cv2.connectedComponents(cand, connectivity=8)
        hit = np.unique(lab0[seed & (lab0 > 0)])
        arms = np.isin(lab0, hit) & (lab0 > 0)
        if cfg.get('arm_reach'):
            # 넓은 소매·옷자락: 다시 그려진 옷 무늬가 팔과 이어져 몸통까지 번지지 않게, 몸 밖으로 나온 팔에서 arm_reach px 안만
            r = cfg['arm_reach']
            near = cv2.dilate(seed.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0
            arms &= near
    for x0, y0, x1, y1 in cfg.get('not_arm', []):
        arms &= ~((cols >= x0) & (cols < x1) & (rows >= y0) & (rows < y1))
    arms = cv2.morphologyEx(arms.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    if cfg['close']:
        k = np.ones((cfg['close'], cfg['close']), np.uint8)
        arms = (cv2.morphologyEx(arms.astype(np.uint8), cv2.MORPH_CLOSE, k) > 0) & op1
    n, lab, st, cent = cv2.connectedComponentsWithStats(arms.astype(np.uint8), connectivity=8)
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= MIN_ARM]
    if cfg['arms'] == 'one':
        arm = np.isin(lab, big)
        return {'arms': grow(arm, op1, SEAM)}
    big = sorted(big, key=lambda i: -st[i, cv2.CC_STAT_AREA])[:2]
    big.sort(key=lambda i: cent[i][0])
    arm_f, arm_b = (lab == big[0]), (lab == big[1])
    # 무기 끝 불꽃처럼 떨어진 작은 조각: 앞팔 가까이(왼쪽)면 앞팔에
    # 팔 없는 그림에 아예 없는 조각(뒷손에 매달린 향로 등)은 가까운 팔에
    for i in range(1, n):
        if i in big or st[i, cv2.CC_STAT_AREA] < 20:
            continue
        piece = lab == i
        if cent[i][0] < cent[big[0]][0] + 40:
            arm_f |= piece
        elif not (piece & op2).any():
            near_f = abs(cent[i][0] - cent[big[0]][0]) < abs(cent[i][0] - cent[big[1]][0])
            if near_f:
                arm_f |= piece
            else:
                arm_b |= piece
    return {'armF': grow(arm_f, op1 & ~arm_b, SEAM), 'armB': grow(arm_b, op1 & ~arm_f, SEAM)}


def arm_pivot(mask):
    """팔 조각 맨 위(어깨) 근처 가운데"""
    ys, xs = np.nonzero(mask)
    top = ys.min()
    band = ys < top + 24
    return float(xs[band].mean()), float(top + 18)


def shoulder_pivot(mask, body):
    """팔 조각이 몸통(팔 없는 그림)에 닿는 곳의 맨 위 = 어깨.
    지팡이 끝·치켜든 손이 어깨보다 높아 '맨 위'가 어깨가 아닐 때 (cfg shoulder: True)"""
    contact = mask & grow(body, np.ones_like(body), 4) & ~body
    if not contact.any():
        contact = mask & body
    ys, xs = np.nonzero(contact)
    top = ys.min()
    band = ys < top + 30
    return float(xs[band].mean()), float(top + 14)


def erase_white(img, cfg):
    """cfg erase_white [(x, y, w, h)]: 그 영역의 흰 픽셀(고리·틈 안에 갇혀 gpt_clean이 못 지운 배경)을 투명하게"""
    for x, y, w, h in cfg.get('erase_white', []):
        reg = img[y:y + h, x:x + w]
        white = (reg[..., :3].min(axis=2) > 225) & (reg[..., 3] > 0)
        reg[white] = 0


def masks_for(name):
    cfg = ENEMIES[name]
    full = keyed(src_path(name, cfg, 1), cfg['key'])
    erase_white(full, cfg)
    if cfg['arms'] == 'none':
        # 팔·다리·머리 없는 덩어리(슬라임·차량·드론·탑): 그림 한 장 = 몸통 한 조각
        return cfg, full, full, {'torso': full[..., 3] > 0}
    armless = keyed(src_path(name, cfg, 2), cfg['key'])
    erase_white(armless, cfg)
    if cfg.get('flip'):
        full, armless = np.ascontiguousarray(full[:, ::-1]), np.ascontiguousarray(armless[:, ::-1])
    H, W = full.shape[:2]
    op1, op2 = full[..., 3] > 0, armless[..., 3] > 0
    rows = np.broadcast_to(np.arange(H)[:, None], (H, W))
    cols = np.broadcast_to(np.arange(W)[None, :], (H, W))
    arms = arm_masks(full, armless, cfg, rows, op1, op2)
    anyarm = np.zeros_like(op1)
    for m in arms.values():
        anyarm |= m
    # 따로 흔드는 조각: 보스 망토(파란색, cape_color로 바꿈) / 졸개 꼬리(영역)
    cape, extra_name, region = np.zeros_like(op1), None, None
    if 'cape' in cfg:
        rgb = armless[..., :3].astype(int)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        if cfg.get('cape_color') == 'red':
            tone = (r > g + 40) & (r > b + 15)
        else:
            tone = (b > r + 50) & (b > g + 30)
        region = (cols >= cfg['cape'][0]) & (rows >= cfg['cape'][1])
        cape = largest(op2 & tone & region)
        if cfg.get('cape_close'):
            k = np.ones((cfg['cape_close'], cfg['cape_close']), np.uint8)
            cape = (cv2.morphologyEx(cape.astype(np.uint8), cv2.MORPH_CLOSE, k) > 0) & op2 & region
        extra_name = 'cape'
    elif 'tail' in cfg:
        x0, y0, x1, y1 = cfg['tail']
        region = (cols >= x0) & (cols < x1) & (rows >= y0) & (rows < y1)
        cape = largest(op2 & region)
        extra_name = 'tail'
    if extra_name:
        cape = grow(cape, op2 & region, SEAM)
    head = op1 & (rows < cfg['head_y']) & ~anyarm
    if 'head_x' in cfg:
        head &= (cols >= cfg['head_x'][0]) & (cols < cfg['head_x'][1])
    for x0, y0, x1, y1 in cfg.get('head_cut', []):
        head &= ~((cols >= x0) & (cols < x1) & (rows >= y0) & (rows < y1))
    if cfg.get('legs') == 'none':
        # 다리 없음(가마에 뜬 대주교 등): 아래쪽 전부 몸통 — 걷기는 몸통이 떠서 출렁임
        torso = op2 & ((rows >= cfg['head_y'] - NECK_BAND) | (op1 & ~head & ~anyarm)) & ~cape
        masks = {**({extra_name: cape} if cape.any() else {}), 'torso': torso, **arms, 'head': head}
        return cfg, full, armless, masks
    torso = op2 & ((rows >= cfg['head_y'] - NECK_BAND) | (op1 & ~head & ~anyarm)) & (rows < cfg['hip_y']) & ~cape
    legs = op2 & (rows >= cfg['hip_y'] - HIP_BAND) & ~cape
    split = cfg['crotch'] + cfg['slope'] * (rows - cfg['hip_y'])
    leg_b, leg_f = largest(legs & (cols >= split)), largest(legs & (cols < split))
    rest = legs & ~leg_b & ~leg_f                      # 떨어져 나간 자투리(망토 윤곽선, 뒤꿈치): 망토 또는 가까운 다리로
    if cape.any():
        cape |= rest & region
        rest &= ~cape
    leg_b |= rest & (cols >= split)
    leg_f |= rest & (cols < split)
    masks = {**({extra_name: cape} if cape.any() else {}),
             'legB': leg_b, 'legF': leg_f,
             'torso': torso, **arms, 'head': head}
    return cfg, full, armless, masks


def preview(name):
    cfg, full, armless, masks = masks_for(name)
    colors = {'cape': (255, 255, 60), 'tail': (255, 255, 60), 'legB': (80, 80, 255), 'legF': (60, 200, 255), 'torso': (120, 120, 120), 'armB': (255, 160, 40),
              'armF': (255, 60, 60), 'arms': (255, 60, 60), 'head': (80, 230, 80)}
    vis = (full[..., :3] * 0.45).astype(np.uint8)
    for k, m in masks.items():
        if k == 'torso':
            continue
        vis[m] = (vis[m] * 0.4 + np.array(colors[k]) * 0.6).astype(np.uint8)
    im = Image.fromarray(vis)
    d = ImageDraw.Draw(im)
    W = full.shape[1]
    d.line([(0, cfg['head_y']), (W, cfg['head_y'])], fill=(80, 255, 80))
    if 'legF' in masks:
        d.line([(0, cfg['hip_y']), (W, cfg['hip_y'])], fill=(80, 160, 255))
        d.line([(cfg['crotch'], cfg['hip_y']), (cfg['crotch'] + cfg['slope'] * 250, cfg['hip_y'] + 250)], fill=(80, 160, 255))
    out = os.path.join(HERE, f'_cut_{name}.png')
    im.save(out)
    print('preview', out)


def build(name):
    cfg, full, armless, masks = masks_for(name)
    H, W = full.shape[:2]
    op1 = full[..., 3] > 0
    ground = int(np.nonzero(op1.any(axis=1))[0].max())
    feet_x = np.nonzero(op1[ground - 40:ground + 1].any(axis=0))[0]     # 두 발 끝 사이 가운데
    root_x = float((feet_x.min() + feet_x.max()) / 2)
    pivots = {
        'root': (root_x, float(ground)),
        # 한 장짜리(arms 'none' — 차량·드론·탑): 몸 피벗 = 바닥 가운데 (눌렸다 늘어나기·출렁임)
        'body': ((root_x, float(ground - 20)) if cfg['arms'] == 'none' and 'crotch' not in cfg
                 else (float(cfg['crotch']), float((cfg['head_y'] + cfg['hip_y']) / 2))),
    }
    if 'head' in masks:
        row = masks['head'][cfg['head_y'] - 1]
        pivots['head'] = (float(np.nonzero(row)[0].mean()) if row.any() else float(cfg['crotch']), float(cfg['head_y'] + 2))
    if 'legF' in masks and cfg.get('key', 'green') is None:
        # GPT 그림(1254px, 다리 폭이 제각각): 다리 조각 윗부분 가운데를 엉덩이 관절로
        for k in ('legF', 'legB'):
            ys, xs = np.nonzero(masks[k][cfg['hip_y']:cfg['hip_y'] + 40])
            pivots[k] = (float(xs.mean()) if len(xs) else float(cfg['crotch']), float(cfg['hip_y'] + 6))
        sockets = {'footF': (pivots['legF'][0], float(ground)), 'footB': (pivots['legB'][0], float(ground))}
    elif 'legF' in masks:
        pivots['legF'] = (float(cfg['crotch'] - 58), float(cfg['hip_y'] + 6))
        pivots['legB'] = (float(cfg['crotch'] + 72), float(cfg['hip_y'] + 6))
        sockets = {'footF': (pivots['legF'][0], float(ground)), 'footB': (pivots['legB'][0], float(ground))}
    else:                                                      # 다리 없음: 발 소켓은 바닥 가운데
        sockets = {'footF': (pivots['root'][0] - 40, float(ground)), 'footB': (pivots['root'][0] + 40, float(ground))}
    weapon = masks.get('armF', masks.get('arms', masks['torso']))
    for k in ('armF', 'armB', 'arms', 'cape', 'tail'):
        if k in masks:
            pivots[k] = arm_pivot(masks[k])
    if cfg.get('shoulder'):
        for k in ('armF', 'armB', 'arms'):
            if k in masks:
                pivots[k] = shoulder_pivot(masks[k], armless[..., 3] > 0)
    pivots.update({k: (float(x), float(y)) for k, (x, y) in cfg.get('pivot', {}).items()})
    ys, xs = np.nonzero(weapon)
    tip = int(np.argmin(xs))                                   # 무기 끝 = 앞쪽 조각의 맨 왼쪽
    sockets['tip'] = (float(xs[tip]), float(ys[tip]))

    parts = {}
    for k, m in masks.items():
        src = full if k in ('armF', 'armB', 'arms', 'head') else armless
        parts[k] = cut(src, m)
    out_dir = OUT.format(name=name)
    layout = {'source': {'w': W, 'h': H}, 'ground': ground,
              'parts': save_parts(parts, out_dir),
              'pivots': {k: [float(x), float(y)] for k, (x, y) in pivots.items()},
              'sockets': {k: [float(x), float(y)] for k, (x, y) in sockets.items()}}
    write_layout(out_dir, layout)
    print(name, 'parts:', {k: (v['w'], v['h']) for k, v in layout['parts'].items()})
    order = [k for k in ('cape', 'tail', 'legB', 'legF', 'torso', 'armB', 'arms', 'armF', 'head') if k in parts]
    rest_check(out_dir, layout, order, full, os.path.join(HERE, f'_rest_check_{name}.png'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = list(ENEMIES) if args == ['all'] else args
    for name in names:
        (preview if '--preview' in sys.argv else build)(name)


if __name__ == '__main__':
    main()
