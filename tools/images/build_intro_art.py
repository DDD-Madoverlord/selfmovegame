"""
스토리 인트로(모션 코믹, D-100) 컷 그림 → 게임용 그림

실행: 프로젝트 루트에서  python tools/images/build_intro_art.py

입력: assets/sprites/intro/src/st<N>_<칸>_gemini.png  (Gemini 웹 '이미지 복사' 1024×572, 요청 글 tools/images/pending_story_intro.json)
      컷마다 새로 그린 일러스트 — 게임 배경·적·리그 그림은 쓰지 않음 (사용자 11-03 "리소스 재활용하지 말고")
출력: assets/sprites/intro/st<N>/<칸>.webp  (로고 지움, 품질 90 — 칸 크기에 맞춰 js/engine_v2/storyIntros_v2.js가 자르고 움직임)
      assets/sprites/intro/face_<캐릭터>.webp  (제목 카드 얼굴, 컷에서 잘라 냄)
      tools/images/_out/intro_panels_preview.jpg  (한눈에 보기)
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlogo import load_clean  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'intro', 'src')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'intro')
PREVIEW = os.path.join(ROOT, 'tools', 'images', '_out', 'intro_panels_preview.jpg')

# 칸 → 원본 (다시 그린 것은 그 파일: st2 D2·F2 = 컨셉의 통통한 체형으로 다시)
PANELS = {
    1: {p: f'st1_{p}_gemini.png' for p in 'ABCDEFG'},
    2: {'A': 'st2_A_gemini.png', 'B': 'st2_B_gemini.png', 'C': 'st2_C_gemini.png', 'D': 'st2_D2_gemini.png',
        'E': 'st2_E_gemini.png', 'F': 'st2_F2_gemini.png'},
    3: {p: f'st3_{p}_gemini.png' for p in 'ABCDEFG'},
    4: {p: f'st4_{p}_gemini.png' for p in 'ABCDEFG'},
    5: {p: f'st5_{p}_gemini.png' for p in 'ABCDEFG'},
    6: {p: f'st6_{p}_gemini.png' for p in 'ABCDEFG'},
    7: {p: f'st7_{p}_gemini.png' for p in 'ABCDEFG'},
    8: {p: f'st8_{p}_gemini.png' for p in 'ABCDEFG'},
    9: {p: f'st9_{p}_gemini.png' for p in 'ABCDEFG'},
    10: {p: f'st10_{p}_gemini.png' for p in 'ABCDEFG'},
}
# 제목 카드 얼굴: (원본, 자를 칸 x0, y0, 한 변) — 1024×572 기준
FACES = {
    'mech': ('st1_F_gemini.png', 96, 20, 330),
    'kaiju': ('st2_F2_gemini.png', 560, 10, 420),
    'hero': ('st3_E_gemini.png', 90, 40, 380),
    'chimera': ('st4_E_gemini.png', 70, 80, 390),
    'diver': ('st5_C_gemini.png', 292, 40, 440),
    'saint': ('st6_E_gemini.png', 50, 100, 380),
    'doll': ('st7_E_gemini.png', 30, 40, 340),
    'frost': ('st8_C_gemini.png', 290, 60, 440),
    'architect': ('st9_E_gemini.png', 40, 20, 440),
    'broadcaster': ('st10_E_gemini.png', 60, 80, 400),
}


def main():
    thumbs = []
    for n, panels in PANELS.items():
        os.makedirs(os.path.join(OUT, f'st{n}'), exist_ok=True)
        for p, name in panels.items():
            rgb, _ = load_clean(os.path.join(SRC, name))
            im = Image.fromarray(rgb)
            im.save(os.path.join(OUT, f'st{n}', f'{p}.webp'), 'WEBP', quality=90, method=6)
            thumbs.append(im)
            print(f'st{n}/{p}.webp ← {name} {im.size}')
    for c, (name, x, y, s) in FACES.items():
        rgb, _ = load_clean(os.path.join(SRC, name))
        Image.fromarray(rgb).crop((x, y, x + s, y + s)).resize((360, 360), Image.LANCZOS) \
            .save(os.path.join(OUT, f'face_{c}.webp'), 'WEBP', quality=90, method=6)
        print(f'face_{c}.webp ← {name}')
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    cols, w, h = 4, 384, 214
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * w, rows * h), (18, 18, 24))
    for i, im in enumerate(thumbs):
        sheet.paste(im.resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
    sheet.save(PREVIEW, quality=85)


if __name__ == '__main__':
    main()
