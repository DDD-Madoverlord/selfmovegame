"""펫 그림 만들기 (11-03): ChatGPT 원본(투명 1254²) → 게임용 정사각 webp.

  python tools/images/build_pet_art.py            # assets/sprites/pets/src/<id>_gpt.png 전부
  python tools/images/build_pet_art.py scrap_drone

원본 가장자리의 희미한 잡티(알파 16 미만)는 지우고, 그림 둘레로 잘라 여백 6%를 둔 정사각형으로 맞춘 뒤 192px로 줄인다.
화면에는 40px(전투) · 56px(작전 지원 카드)로 나오므로 192px면 고해상도 화면에서도 충분하다.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'pets', 'src')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'pets')
SIZE = 192
MARGIN = 0.06


def build(pet_id):
    im = Image.open(os.path.join(SRC, f'{pet_id}_gpt.png')).convert('RGBA')
    alpha = im.getchannel('A').point(lambda v: 0 if v < 16 else v)
    im.putalpha(alpha)
    im = im.crop(alpha.getbbox())
    side = round(max(im.size) * (1 + 2 * MARGIN))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, f'{pet_id}.webp')
    sq.save(path, 'WEBP', quality=92, method=6)
    print(f'{pet_id}: {path} ({os.path.getsize(path) // 1024} KB)')


if __name__ == '__main__':
    ids = sys.argv[1:] or sorted(f[:-8] for f in os.listdir(SRC) if f.endswith('_gpt.png'))
    for pet_id in ids:
        build(pet_id)
