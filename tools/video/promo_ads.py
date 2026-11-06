"""광고 영상 시안 3개 (11-03) 2단계: 세로 15초 광고 만들기

  python tools/video/ad_capture.py     # 먼저 장면 찍기 (tools/video/_out/ad_clips/)
  python tools/video/promo_ads.py      # A·B·C 전부 → tools/video/_out/ad_<A|B|C>.mp4
  python tools/video/promo_ads.py B    # 하나만

 A 시네마틱 트레일러 — 스토리 컷(버림받은 사연) → "괴물이 되었다" → 필살기 몽타주 → 10명 → 엔딩
 B 게임플레이 하이라이트 — 훅("한 방에 쓸어버려!") → 보스 등장 → 필살기 8연속 콤보 → 기지 폭파 → 3성 클리어 → 엔딩
 C 성장·조합 — 기본 로봇 → 연구소에서 파츠 4개 교체 → BEFORE/AFTER 위아래 비교 → 10명 컷인 → 엔딩
화면 1080×1920 · 30fps · H.264 + AAC. 프레임은 ffmpeg에 바로 흘려 넣고(디스크에 안 남김), 소리는 배경음 + 효과음을 시각에 맞춰 섞는다.
배경음 assets/audio/bgm(CC0), 효과음 assets/audio/sfx(CC0)만 씀. ffmpeg는 imageio_ffmpeg 패키지에 든 것.
"""
import bisect
import json
import math
import os
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(HERE, '_out', 'ad_clips')
OUT = os.path.join(HERE, '_out')
W, H, FPS = 1080, 1920, 30
FF = imageio_ffmpeg.get_ffmpeg_exe()

CHARS = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint', 'doll', 'frost', 'architect', 'broadcaster']
# 11-05 피드백 24: 광고에는 6명만 보이고 나머지 4명은 물음표 (공개 6명 = 스토리 순서 1~6, Q-031 임시)
SHOWN = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint']
HIDDEN = ['doll', 'frost', 'architect', 'broadcaster']
ROSTER = SHOWN + HIDDEN
SHOWN_SETS, SHOWN_PARTS = 54, 254   # 공개 6명의 세트·파츠 수 (11-05 sets_v2·partSkills.gen 기준 — 10명은 90세트·430파츠)
KO_NAME = {'mech': '거대로봇', 'kaiju': '거대괴수', 'hero': '타락 히어로', 'chimera': '합성괴인', 'diver': '심연의 길잡이',
           'saint': '봉합 성녀', 'doll': '뒤틀린 인형사', 'frost': '서리의 무희', 'architect': '철거의 설계자', 'broadcaster': '침묵의 방송자'}
# 필살기 장면: 클립 · 터지는 구간(초) · 필살기 이름 · 효과음 — 컷인(얼굴 띠)은 모든 클립 1.85~2.45초
ULT = {
    'mech': ('ult_mech', 4.35, 5.6, '종말의 포', 'mech_laser_big'),
    'kaiju': ('ult_kaiju', 4.75, 5.6, '대멸종', 'base_blast'),
    'hero': ('ult_hero', 3.6, 4.6, '마왕 강림', 'hero_curse_nova'),
    'chimera': ('ult_chimera', 2.75, 3.4, '최종 병기 투입', 'chimera_slam'),
    'diver': ('ult_diver', 2.8, 3.8, '리바이어던 강림', 'diver_surge'),
    'saint': ('ult_saint', 2.75, 3.5, '운명 재봉', 'saint_seal'),
    'doll': ('ult_doll', 2.75, 3.6, '실의 왕좌', 'doll_burst'),
    'frost': ('ult_frost', 2.7, 3.7, '절대 영도', 'frost_shatter'),
    'architect': ('ult_architect', 2.75, 3.4, '도시 재건', 'mech_missile_blast'),
    'broadcaster': ('ult_broadcaster', 2.75, 3.6, '진실의 방송', 'hero_wave'),
}
CUTIN = (1.85, 2.45)
SQ = (40, 420, 1000, 1380)   # 전투 화면(2600×1480)에서 주인공과 앞 적이 들어오는 정사각형


# ---------------------------------------------------------------- 공통 도구
_fonts = {}


def font(kind, size):
    key = (kind, size)
    if key not in _fonts:
        if kind == 'en':
            f = ImageFont.truetype('C:/Windows/Fonts/impact.ttf', size)
        else:
            f = ImageFont.truetype('C:/Windows/Fonts/NotoSerifKR-VF.ttf' if kind == 'serif' else 'C:/Windows/Fonts/NotoSansKR-VF.ttf', size)
            f.set_variation_by_name('Black')
        _fonts[key] = f
    return _fonts[key]


_texts = {}


def text(s, size, fill=(255, 255, 255), kind='ko', stroke=9, stroke_fill=(10, 8, 14), spacing=6, shadow=True):
    """글자 그림(RGBA): 두꺼운 테두리 + 아래 그림자"""
    key = (s, size, fill, kind, stroke, stroke_fill, spacing, shadow)
    if key in _texts:
        return _texts[key]
    f = font(kind, size)
    bb = ImageDraw.Draw(Image.new('L', (1, 1))).multiline_textbbox((0, 0), s, font=f, stroke_width=stroke, spacing=spacing, align='center')
    pad = 24
    w, h = math.ceil(bb[2] - bb[0]) + pad * 2, math.ceil(bb[3] - bb[1]) + pad * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pos = (pad - bb[0], pad - bb[1])
    if shadow:
        sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).multiline_text((pos[0], pos[1] + 10), s, font=f, fill=(0, 0, 0, 170), stroke_width=stroke, stroke_fill=(0, 0, 0, 170), spacing=spacing, align='center')
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(8)))
    ImageDraw.Draw(im).multiline_text(pos, s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill, spacing=spacing, align='center')
    _texts[key] = im
    return im


def gradient_text(s, size, top, bottom, kind='en', stroke=10, stroke_fill=(40, 12, 0)):
    """위→아래 색이 바뀌는 제목 글자"""
    key = ('grad', s, size, top, bottom, kind)
    if key in _texts:
        return _texts[key]
    base = text(s, size, (255, 255, 255), kind, stroke, stroke_fill)
    f = font(kind, size)
    mask = Image.new('L', base.size, 0)
    bb = ImageDraw.Draw(Image.new('L', (1, 1))).multiline_textbbox((0, 0), s, font=f, stroke_width=stroke, align='center')
    ImageDraw.Draw(mask).multiline_text((24 - bb[0], 24 - bb[1]), s, font=f, fill=255, align='center')
    grad = Image.new('RGBA', base.size)
    gd = ImageDraw.Draw(grad)
    for y in range(base.height):
        k = y / max(1, base.height - 1)
        gd.line([(0, y), (base.width, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)) + (255,))
    out = base.copy()
    out.paste(grad, (0, 0), mask)
    _texts[key] = out
    return out


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def back(t):
    t = max(0.0, min(1.0, t))
    c = 1.9
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def put(canvas, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if alpha <= 0.01 or scale <= 0.01:
        return
    if abs(scale - 1) > 0.005:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    if alpha < 0.99:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


def pop(canvas, im, cx, cy, t, dur=0.22, big=1.7, rot=0.0):
    """t초 전에 나타난 글자: 크게 → 제자리로 튕기며"""
    if t < 0:
        return
    p = t / dur
    s = 1 + (big - 1) * (1 - back(p)) if p < 1 else 1.0
    put(canvas, im, cx, cy, s, min(1.0, p * 2.5), rot)


def slide(canvas, im, cx, cy, t, dx=-260, dur=0.25):
    if t < 0:
        return
    k = ease(t / dur)
    put(canvas, im, cx + dx * (1 - k), cy, 1.0, k)


def flash(im, a, color=(255, 255, 255)):
    return Image.blend(im, Image.new('RGB', im.size, color), a) if a > 0.01 else im


def shake_xy(t, amp, seed=0):
    return (int(amp * math.sin(t * 91 + seed) * math.cos(t * 37)), int(amp * math.sin(t * 73 + 2 + seed)))


_vig = None


def vignette(canvas, strength=0.75):
    global _vig
    if _vig is None:
        m = Image.radial_gradient('L').resize((W, H))   # 가운데 0 → 가장자리 255
        _vig = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        _vig.putalpha(m.point(lambda v: int(min(255, max(0, (v - 90) * 1.6)))))
    canvas.paste(Image.new('RGB', (W, H), (0, 0, 0)), (0, 0), _vig.getchannel('A').point(lambda v: int(v * strength)))


class Clip:
    def __init__(self, name):
        self.dir = os.path.join(CLIPS, name)
        fr = json.load(open(os.path.join(self.dir, 'frames.json'), encoding='utf-8'))
        t0 = fr[0]['t']
        self.ts = [f['t'] - t0 for f in fr]
        self.idx = [f['i'] for f in fr]
        self.cache = {}

    def at(self, t):
        j = bisect.bisect_left(self.ts, t)
        if j >= len(self.ts) or (j > 0 and t - self.ts[j - 1] < self.ts[j] - t):
            j = max(0, j - 1)
        i = self.idx[min(j, len(self.idx) - 1)]
        if i not in self.cache:
            if len(self.cache) > 24:
                self.cache.clear()
            self.cache[i] = Image.open(os.path.join(self.dir, f'{i:04d}.jpg')).convert('RGB')
        return self.cache[i]


_clips = {}


def clip(name):
    if name not in _clips:
        _clips[name] = Clip(name)
    return _clips[name]


def view(img, box, size, zoom=1.0):
    """box(원본 좌표)를 size로 — zoom>1이면 가운데로 당겨 확대"""
    x0, y0, x1, y1 = box
    if zoom != 1:
        cx, cy, hw, hh = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 / zoom, (y1 - y0) / 2 / zoom
        x0, y0, x1, y1 = cx - hw, cy - hh, cx + hw, cy + hh
    return img.resize(size, Image.LANCZOS, box=(x0, y0, x1, y1))


_bgs = {}


def blur_bg(img, key=None, dark=0.32):
    if key is not None and key in _bgs:
        return _bgs[key].copy()
    small = img.resize((60, max(1, int(60 * img.height / img.width)))).filter(ImageFilter.GaussianBlur(2))
    k = max(W / small.width, H / small.height)
    big = small.resize((int(small.width * k) + 2, int(small.height * k) + 2), Image.BILINEAR)
    x, y = (big.width - W) // 2, (big.height - H) // 2
    big = ImageEnhance.Brightness(big.crop((x, y, x + W, y + H))).enhance(dark)
    if key is not None:
        _bgs[key] = big
    return big.copy()


_panels = {}


def panel(path):
    if path not in _panels:
        _panels[path] = Image.open(os.path.join(ROOT, 'assets', 'sprites', 'intro', path + '.webp')).convert('RGB')
    return _panels[path]


def band(path, p, fx0, fx1, h=1000, z0=1.0, z1=1.08):
    """스토리 컷을 높이 h 띠로: 옆으로 흐르며(fx) 천천히 확대(z)"""
    im = panel(path)
    z = z0 + (z1 - z0) * p
    fx = fx0 + (fx1 - fx0) * p
    sc = h / im.height * z
    sw, sh = im.width * sc, im.height * sc
    x0 = min(max(0, fx * sw - W / 2), sw - W)
    y0 = (sh - h) / 2
    return im.resize((W, h), Image.BICUBIC, box=(x0 / sc, y0 / sc, (x0 + W) / sc, (y0 + h) / sc))


def face(ch, size):
    key = ('face', ch, size)
    if key not in _texts:
        im = Image.open(os.path.join(ROOT, 'assets', 'sprites', 'intro', f'face_{ch}.webp')).convert('RGB').resize((size, size), Image.LANCZOS)
        out = Image.new('RGBA', (size + 12, size + 12), (0, 0, 0, 0))
        d = ImageDraw.Draw(out)
        d.ellipse((0, 0, size + 11, size + 11), fill=(255, 190, 60, 255))
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out.paste(im, (6, 6), mask)
        _texts[key] = out
    return _texts[key]


def mystery(size):
    """숨긴 캐릭터 자리: 어두운 원 + 큰 물음표 (실루엣도 안 보임 — 누군지 짐작 못 하게)"""
    key = ('mystery', size)
    if key not in _texts:
        out = Image.new('RGBA', (size + 12, size + 12), (0, 0, 0, 0))
        d = ImageDraw.Draw(out)
        d.ellipse((0, 0, size + 11, size + 11), fill=(120, 90, 200, 255))
        d.ellipse((6, 6, size + 5, size + 5), fill=(22, 16, 36, 255))
        glow = Image.new('RGBA', out.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse((size * 0.2, size * 0.2, size * 0.8 + 12, size * 0.8 + 12), fill=(150, 110, 255, 90))
        out = Image.alpha_composite(out, glow.filter(ImageFilter.GaussianBlur(size // 8)))
        q = text('?', int(size * 0.62), (235, 225, 255), 'en', stroke=6, stroke_fill=(40, 20, 80), shadow=False)
        out.paste(q, ((out.width - q.width) // 2, (out.height - q.height) // 2), q)
        _texts[key] = out
    return _texts[key]


def portrait(ch, size):
    """공개 캐릭터는 얼굴, 숨긴 캐릭터는 물음표"""
    return face(ch, size) if ch in SHOWN else mystery(size)


def tag(s, color, size=44):
    """색 띠 이름표"""
    key = ('tag', s, color, size)
    if key not in _texts:
        t = text(s, size, (255, 255, 255), stroke=0, shadow=False)
        w, h = t.width + 20, t.height - 10
        out = Image.new('RGBA', (w + 30, h + 30), (0, 0, 0, 0))
        d = ImageDraw.Draw(out)
        d.polygon([(26, 15), (w + 30, 15), (w + 4, h + 15), (0, h + 15)], fill=color + (235,))
        out.paste(t, ((out.width - t.width) // 2, (out.height - t.height) // 2), t)
        _texts[key] = out
    return _texts[key]


def button(s, color, w=640, h=128):
    key = ('btn', s, color, w, h)
    if key not in _texts:
        out = Image.new('RGBA', (w + 40, h + 40), (0, 0, 0, 0))
        glow = Image.new('RGBA', out.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).rounded_rectangle((20, 20, w + 20, h + 20), radius=h // 2, fill=color + (200,))
        out = Image.alpha_composite(out, glow.filter(ImageFilter.GaussianBlur(14)))
        d = ImageDraw.Draw(out)
        d.rounded_rectangle((20, 20, w + 20, h + 20), radius=h // 2, fill=color + (255,), outline=(255, 255, 255, 255), width=5)
        t = text(s, 66, (255, 255, 255), 'en', stroke=4, stroke_fill=(60, 20, 0), shadow=False)
        out.paste(t, ((out.width - t.width) // 2, (out.height - t.height) // 2 - 2), t)
        _texts[key] = out
    return _texts[key]


# ---------------------------------------------------------------- 공통 장면
def endcard(t, dur, accent, tagline, sub=f'오버로드 {len(SHOWN)}명 공개 · {len(HIDDEN)}명은 곧 · 자동 전투'):
    c = Image.new('RGB', (W, H), (10, 7, 14))
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse((W // 2 - 620, 420, W // 2 + 620, 1160), fill=tuple(int(v * 0.55) for v in accent))
    c = Image.blend(c, glow.filter(ImageFilter.GaussianBlur(150)), 0.9)
    s1 = 1 + 1.2 * (1 - ease(t / 0.18))
    dx, dy = shake_xy(t, 22 * max(0, 1 - t / 0.45))
    title1 = gradient_text('MAD', 230, (255, 236, 150), (255, 140, 20))
    title2 = gradient_text('OVERLORD', 196, (255, 236, 150), (255, 140, 20))
    put(c, title1, W // 2 + dx, 610 + dy, s1, min(1, t / 0.08))
    put(c, title2, W // 2 + dx, 830 + dy, s1, min(1, t / 0.08))
    pop(c, text('매드 오버로드', 66, (255, 255, 255)), W // 2, 990, t - 0.22, big=1.3)
    slide(c, text(tagline, 48, (230, 232, 240), stroke=7), W // 2, 1090, t - 0.35, dx=0)
    for k, ch in enumerate(ROSTER):
        cx, cy = W // 2 + ((k % 5) - 2) * 186, 1300 + (k // 5) * 196
        pop(c, portrait(ch, 158), cx, cy, t - 0.45 - k * 0.04, dur=0.18, big=1.5)
    put(c, text(sub, 34, (190, 196, 210), stroke=5), W // 2, 1590, 1.0, ease((t - 0.8) / 0.3))
    if t > 0.75:
        pulse = 1 + 0.04 * math.sin((t - 0.75) * 9)
        put(c, button('COMING SOON', accent), W // 2, 1745, pulse * (1 + 0.3 * (1 - ease((t - 0.75) / 0.2))), ease((t - 0.75) / 0.15))
    vignette(c, 0.6)
    return flash(c, max(0, 0.9 - t / 0.12))


def mini_logo(c, y=1835):
    put(c, gradient_text('MAD OVERLORD', 70, (255, 236, 150), (255, 140, 20), stroke=6), W // 2, y)


def letterbox(c, top=260, bottom=260):
    d = ImageDraw.Draw(c)
    d.rectangle((0, 0, W, top), fill=(0, 0, 0))
    d.rectangle((0, H - bottom, W, H), fill=(0, 0, 0))


def ult_square(ch, t, dur, size=1080, zoom0=1.14, zoom1=1.0, part='fx'):
    """필살기 장면 정사각형: part='fx' 터지는 구간, 'cutin' 얼굴 띠"""
    name, a, b, _, _ = ULT[ch]
    if part == 'cutin':
        a, b = CUTIN
    src = clip(name).at(a + (b - a) * min(1, t / dur))
    z = zoom1 + (zoom0 - zoom1) * (1 - ease(t / 0.2))
    return view(src, SQ, (size, size), z), src


# ---------------------------------------------------------------- A 시네마틱 트레일러
def ad_a():
    segs, cues = [], []
    accent = (230, 40, 70)
    music = [('menu', 0.0, 0.0, 5.2, 0.75), ('boss', 0.0, 4.7, 15.0, 0.9)]   # (곡, 곡 시작, 영상 시작, 영상 끝, 크기)

    def story(path, fx0, fx1, caption, dur, color=(255, 255, 255), z1=1.08, red=False):
        def r(t):
            c = Image.new('RGB', (W, H), (0, 0, 0))
            b = band(path, t / dur, fx0, fx1, 1000, 1.0, z1)
            if red:
                b = Image.blend(b, Image.new('RGB', b.size, (120, 0, 20)), 0.18 + 0.12 * math.sin(t * 12))
            c.paste(b, (0, 460))
            put(c, text(caption, 86, color, 'serif', stroke=7), W // 2, 1650, 1.0, ease((t - 0.15) / 0.4))
            vignette(c, 0.5)
            return flash(c, max(0, 0.6 - t / 0.1))
        return dur, r

    segs.append(story('st1/B', 0.12, 0.42, '세상을 위해\n모든 것을 바쳤다', 1.6))
    cues += [(0.0, 'intro_whoosh', 0.5)]
    segs.append(story('st3/B', 0.38, 0.55, '돌아온 것은\n배신과 처형대', 1.4))
    cues += [(2.75, 'hero_slash_hit', 0.9)]

    mont = [('st5/B', 0.22), ('st2/C', 0.45), ('st4/B', 0.25), ('st6/C', 0.5)]   # 공개 6명의 스토리 칸만 (11-05 — 예전 st7·st9는 숨긴 캐릭터)

    def montage(t):
        k = min(3, int(t / 0.25))
        path, fx = mont[k]
        lt = t - k * 0.25
        c = Image.new('RGB', (W, H), (0, 0, 0))
        c.paste(band(path, lt / 0.25, fx, fx, 1000, 1.06, 1.0), (0, 460))
        put(c, text('모든 것을 잃은\n자들은—', 86, (255, 255, 255), 'serif', stroke=7), W // 2, 1650)
        vignette(c, 0.5)
        return flash(c, max(0, 0.7 - lt / 0.08))
    segs.append((1.0, montage))
    cues += [(3.0 + k * 0.25, 'player_hit', 0.7) for k in range(4)]

    def monster(t):
        c = Image.new('RGB', (W, H), (0, 0, 0))
        b = band('st3/C', min(1, t / 1.3), 0.7, 0.74, 1000, 1.0, 1.22)
        b = Image.blend(b, Image.new('RGB', b.size, (140, 0, 30)), 0.15 + 0.15 * max(0, math.sin(t * 10)))
        dx, dy = shake_xy(t, 14 if t > 0.45 else 0)
        c.paste(b, (dx, 460 + dy))
        pop(c, text('괴물이 되었다', 120, (255, 50, 70), 'ko', stroke=10), W // 2 + dx, 1640, t - 0.45, big=2.2)
        vignette(c, 0.55)
        return flash(c, 0.9 if 0.45 <= t < 0.5 else max(0, 0.5 - (t - 0.5) / 0.15) if t >= 0.5 else 0, (255, 60, 80))
    segs.append((1.3, monster))
    cues += [(4.0, 'hero_cast', 0.8), (4.45, 'hero_curse_nova', 1.0), (4.47, 'base_blast', 0.6)]

    order = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint']   # 공개 6명만 (11-05)
    lines = ['버림받은 괴물들이', '세상에 복수한다']

    def gameplay(t):
        k = min(5, int(t / 0.9))
        lt = t - k * 0.9
        ch = order[k]
        sq, src = ult_square(ch, lt, 0.9)
        c = blur_bg(src, key=('A', ch))
        dx, dy = shake_xy(t, 16 * max(0, 1 - lt / 0.3))
        c.paste(sq, (dx, 420 + dy))
        letterbox(c, 200, 200)
        put(c, text(lines[k // 3], 76, (255, 255, 255)), W // 2, 330, 1.0, 1.0 if k % 3 else ease(lt / 0.2))
        slide(c, tag(f'{KO_NAME[ch]} · 「{ULT[ch][3]}」', accent), W // 2, 1600, lt - 0.05)
        return flash(c, max(0, 0.85 - lt / 0.09))
    segs.append((5.4, gameplay))
    cues += [(5.3 + k * 0.9, ULT[ch][4], 0.9) for k, ch in enumerate(order)] + [(5.3 + k * 0.9, 'shield_hit', 0.5) for k in range(6)]

    def roster(t):
        c = Image.new('RGB', (W, H), (8, 6, 12))
        for k, ch in enumerate(ROSTER):
            cx, cy = W // 2 + ((k % 5) - 2) * 196, 820 + (k // 5) * 210
            pop(c, portrait(ch, 170), cx, cy, t - k * 0.07, dur=0.15, big=1.6)
        pop(c, text('10명의 오버로드', 92, (255, 255, 255)), W // 2, 500, t - 0.75, big=1.6)
        pop(c, text(f'{len(HIDDEN)}명은 아직 비밀', 54, (200, 180, 255)), W // 2, 1150, t - 0.9, big=1.4)
        pop(c, text('복수가 시작된다', 80, (255, 70, 90)), W // 2, 1260, t - 1.0, big=1.5)
        vignette(c, 0.6)
        return c
    segs.append((1.5, roster))
    cues += [(10.7 + k * 0.07, 'ui_tick', 0.6) for k in range(10)] + [(11.45, 'star_get', 0.8), (11.7, 'shield_hit', 0.7)]

    segs.append((2.8, lambda t: endcard(t, 2.8, accent, '세상에 버림받은 괴물들의 역습')))
    cues += [(12.2, 'base_destroyed', 1.0), (12.95, 'result_star', 0.7)]
    return segs, cues, music


# ---------------------------------------------------------------- B 게임플레이 하이라이트
def ad_b():
    segs, cues = [], []
    accent = (255, 168, 20)
    music = [('battle', 0.0, 0.0, 15.0, 0.9)]

    def hook(t):
        sq, src = ult_square('mech', t, 1.33, zoom0=1.25)
        c = blur_bg(src, key=('B', 'hook'))
        dx, dy = shake_xy(t, 12)
        c.paste(sq, (dx, 470 + dy))
        pop(c, text('한 방에', 120, (255, 255, 255)), W // 2, 230, t - 0.05, big=2.0, rot=-3)
        pop(c, text('쓸어버려!', 150, (255, 205, 40)), W // 2, 380, t - 0.3, big=2.2, rot=-3)
        mini_logo(c)
        return flash(c, max(0, 0.8 - t / 0.08))
    segs.append((40 / FPS, hook))
    cues += [(0.0, 'mech_laser_big', 1.0), (0.05, 'base_blast', 0.6), (0.3, 'shield_hit', 0.7)]

    def boss(t):
        src = clip('boss_wmd').at(0.3 + t * 1.25)   # 공개 구역 보스 (예전 boss_vladimir = 숨긴 캐릭터 구역)
        c = blur_bg(src, key=('B', 'boss'))
        c.paste(view(src, (700, 80, 2200, 1440), (1080, 979)), (0, 500))
        red = 0.25 + 0.2 * math.sin(t * 14)
        c = Image.blend(c, Image.new('RGB', c.size, (200, 0, 20)), max(0, red * 0.5))
        if int(t * 6) % 2 == 0:
            put(c, text('WARNING', 150, (255, 60, 60), 'en', stroke=8), W // 2, 300)
        pop(c, text('거대 보스 등장!', 104, (255, 255, 255)), W // 2, 1640, t - 0.2, big=1.8)
        mini_logo(c)
        return c
    segs.append((50 / FPS, boss))
    cues += [(1.33, 'warning_danger', 0.9), (2.1, 'giant_step', 0.9)]

    order = ['diver', 'saint', 'chimera', 'hero', 'mech', 'kaiju']   # 공개 6명 (11-05) — 길이는 그대로 160프레임
    cut = 160 / len(order) / FPS

    def combo(t):
        k = min(len(order) - 1, int(t / cut))
        lt = t - k * cut
        ch = order[k]
        sq, src = ult_square(ch, lt, cut, zoom0=1.2)
        c = blur_bg(src, key=('B', ch))
        dx, dy = shake_xy(t, 18 * max(0, 1 - lt / 0.25))
        c.paste(sq, (dx, 470 + dy))
        put(c, text('필살기 콤보', 70, (255, 255, 255)), W // 2, 200)
        pop(c, text(f'x{k + 1}', 170, (255, 205, 40), 'en', stroke=10), W // 2, 360, lt, dur=0.15, big=1.8, rot=-4)
        slide(c, tag(f'{KO_NAME[ch]} · 「{ULT[ch][3]}」', accent), W // 2, 1650, lt, dx=-300, dur=0.15)
        mini_logo(c)
        return flash(c, max(0, 0.75 - lt / 0.07))
    segs.append((160 / FPS, combo))
    cues += [(3.0 + k * cut, ULT[ch][4], 0.85) for k, ch in enumerate(order)] + [(3.0 + k * cut, 'shield_hit', 0.45) for k in range(len(order))]

    def base(t):
        src = clip('base_kaiju').at(1.9 + t * 1.2)
        c = blur_bg(src, key=('B', 'base'))
        dx, dy = shake_xy(t, 20 if 0.55 < t < 1.6 else 4)
        k = ease((t - 1.5) / 0.5)   # 처음엔 기지 가까이, MISSION COMPLETE 때 넓게
        box = tuple(a + (b - a) * k for a, b in zip((500, 280, 1900, 1420), (460, 0, 2280, 1480)))
        c.paste(view(src, box, (1080, 880)), (dx, 540 + dy))
        mini_logo(c)
        pop(c, text('기지 폭파!', 140, (255, 120, 40)), W // 2, 360, t - 0.6, big=2.2, rot=-3)
        return flash(c, max(0, 0.7 - abs(t - 0.62) / 0.1), (255, 220, 160))
    segs.append((90 / FPS, base))
    cues += [(8.4, 'kaiju_roar', 0.7), (8.95, 'base_destroyed', 1.0), (9.3, 'base_blast', 0.8), (10.4, 'mission_complete', 0.9)]

    def result(t):
        src = clip('base_kaiju').at(7.7 + t * 1.25)
        c = blur_bg(src, key=('B', 'result'))
        c.paste(ImageEnhance.Brightness(view(src, (1380, 220, 2470, 1130), (1080, 902))).enhance(1.4), (0, 540))
        mini_logo(c)
        pop(c, text('3성 클리어!', 120, (255, 220, 60)), W // 2, 330, t - 0.1, big=1.9)
        return c
    segs.append((40 / FPS, result))
    cues += [(11.45, 'result_star', 0.9), (11.75, 'result_star', 0.9), (12.2, 'reward_done', 0.8)]

    segs.append((70 / FPS, lambda t: endcard(t, 70 / FPS, accent, '지금 바로 출격하라!')))
    cues += [(12.67, 'base_destroyed', 1.0), (13.4, 'result_star', 0.7)]
    return segs, cues, music


# ---------------------------------------------------------------- C 성장·조합
def ad_c():
    segs, cues = [], []
    accent = (40, 190, 255)
    music = [('boss', 0.0, 0.0, 15.0, 0.85)]

    def weak(t):
        src = clip('basic_mech').at(0.2 + t)
        c = blur_bg(src, key=('C', 'weak'))
        sq = ImageEnhance.Color(view(src, SQ, (1080, 1080))).enhance(0.45)
        c.paste(sq, (0, 520))
        pop(c, text('기본 로봇으로는', 96, (255, 255, 255)), W // 2, 230, t - 0.05, big=1.5)
        pop(c, text('부족하다면?', 130, (90, 210, 255)), W // 2, 400, t - 0.7, big=2.0, rot=-3)
        mini_logo(c)
        return c
    segs.append((50 / FPS, weak))
    cues += [(0.2, 'mech_fist_hit', 0.5), (0.7, 'mech_fist_hit', 0.5), (1.4, 'ui_error', 0.7)]

    swaps = [(0.25, '팔'), (1.15, '머리'), (2.05, '몸통'), (2.95, '다리')]
    dur2 = 130 / FPS

    def lab(t):
        src = clip('lab_mech').at(0.3 + t * 1.22)
        c = blur_bg(src, key=('C', 'lab'))
        c.paste(view(src, (0, 140, 1300, 1200), (1080, 880)), (0, 560))
        put(c, text('파츠를 바꿔 끼우면', 84, (255, 255, 255)), W // 2, 250)
        a = 0
        for k, (st, part) in enumerate(swaps):
            lt = t - st
            if 0 <= lt < (swaps[k + 1][0] - st if k < 3 else 9):
                pop(c, tag(f'{part} 교체!', (60, 60, 80), 54), W // 2 - 150, 1560, lt, big=1.6)
                pop(c, tag('LEGENDARY', (230, 70, 40), 54), W // 2 + 200, 1560, lt - 0.08, big=1.6)
            if 0 <= lt < 0.12:
                a = 0.6 * (1 - lt / 0.12)
        if t > 3.55:
            pop(c, text('능력치 폭증!', 120, (255, 200, 40)), W // 2, 420, t - 3.55, big=2.0, rot=-3)
        mini_logo(c)
        return flash(c, a, (255, 230, 170))
    segs.append((dur2, lab))
    cues += [(1.67 + st, 'ui_equip', 1.0) for st, _ in swaps] + [(1.7 + st, 'star_get', 0.6) for st, _ in swaps] + [(1.67 + 3.55, 'result_star', 0.9)]

    def versus(t):
        before = clip('basic_mech').at(2.0 + t * 0.72)
        after = clip('ult_mech').at(3.6 + t * 0.72)
        c = Image.new('RGB', (W, H), (10, 8, 16))
        box = (40, 560, 1340, 1420)   # 위아래 반쪽: 1080×715
        b = ImageEnhance.Color(view(before, box, (1080, 715))).enhance(0.4)
        dx, dy = shake_xy(t, 14 if t > 0.75 else 0)
        c.paste(b, (0, 140))
        c.paste(view(after, box, (1080, 715)), (dx, 875 + dy))
        d = ImageDraw.Draw(c)
        d.rectangle((0, 865, W, 877), fill=accent)
        slide(c, tag('BEFORE · 기본 파츠', (90, 94, 110), 48), 290, 200, t)
        slide(c, tag('AFTER · 레전더리 세트', (230, 120, 20), 48), 330, 935, t - 0.15)
        pop(c, text('VS', 120, (255, 255, 255), 'en', stroke=10), W - 130, 871, t - 0.1, big=2.0)
        if t > 2.3:
            pop(c, text('같은 로봇,\n완전히 다른 화력!', 92, (255, 220, 60)), W // 2, 1735, t - 2.3, big=1.7)
        return c
    segs.append((120 / FPS, versus))
    cues += [(6.1, 'shield_hit', 0.7), (6.0 + 0.75, 'mech_laser_big', 1.0), (8.3, 'base_blast', 0.6)]

    order = ['kaiju', 'hero', 'chimera', 'diver', 'saint', '?', '?']   # 공개 5명 + 물음표 2 (11-05)
    cut = 10 / FPS

    def roster(t):
        k = min(6, int(t / cut))
        lt = t - k * cut
        ch = order[k]
        if ch == '?':   # 숨긴 캐릭터: 어두운 판 + 물음표
            c = Image.new('RGB', (W, H), (14, 10, 24))
            put(c, mystery(620), W // 2, 1060, 1.0 + 0.08 * (1 - ease(lt / cut)))
            put(c, text('COMING SOON', 84, (200, 180, 255), 'en', stroke=6), W // 2, 1500)
        else:
            sq, src = ult_square(ch, lt, cut, zoom0=1.08, part='cutin')
            c = blur_bg(src, key=('C', ch))
            c.paste(sq, (0, 520))
        put(c, text(f'{len(SHOWN)}명 · {SHOWN_SETS}세트 · 그리고 ???', 96, (255, 255, 255)), W // 2, 250)
        n = int(SHOWN_PARTS * ease(t / 2.0))
        put(c, text(f'파츠 {n}개', 96, (90, 210, 255)), W // 2, 400)
        mini_logo(c)
        return flash(c, max(0, 0.5 - lt / 0.06))
    segs.append((70 / FPS, roster))
    cues += [(10.0 + k * cut, 'skill_use', 0.6) for k in range(7)]

    segs.append((80 / FPS, lambda t: endcard(t, 80 / FPS, accent, '나만의 조합으로 진화하라')))
    cues += [(12.33, 'base_destroyed', 1.0), (13.1, 'result_star', 0.7)]
    return segs, cues, music


# ---------------------------------------------------------------- 만들기
def render(name, build):
    segs, cues, music = build()
    total = sum(d for d, _ in segs)
    nframes = round(total * FPS)
    vid = os.path.join(OUT, f'_ad_{name}_video.mp4')
    p = subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', vid], stdin=subprocess.PIPE)
    start = 0.0
    bounds = []
    for d, fn in segs:
        bounds.append((start, start + d, fn))
        start += d
    for f in range(nframes):
        t = f / FPS
        for a, b, fn in bounds:
            if a <= t < b or (fn is bounds[-1][2] and t >= a):
                im = fn(t - a)
                break
        if im.size != (W, H) or im.mode != 'RGB':
            im = im.convert('RGB').resize((W, H))
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()
    # 소리: 배경음 + 효과음
    args = [FF, '-y', '-loglevel', 'error', '-i', vid]
    parts, n = [], 1
    for song, s0, a, b, vol in music:
        args += ['-ss', f'{s0}', '-t', f'{b - a + 0.5:.2f}', '-i', os.path.join(ROOT, 'assets', 'audio', 'bgm', f'{song}.ogg')]
        fade_out = b - a - 0.6
        parts.append(f'[{n}:a]volume={vol},afade=t=in:st=0:d=0.25,afade=t=out:st={fade_out:.2f}:d=0.6,adelay={int(a * 1000)}|{int(a * 1000)}[a{n}]')
        n += 1
    for at, sfx, vol in cues:
        path = os.path.join(ROOT, 'assets', 'audio', 'sfx', f'{sfx}.ogg')
        if not os.path.exists(path) or at >= total:
            continue
        args += ['-i', path]
        parts.append(f'[{n}:a]volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[a{n}]')
        n += 1
    mix = ''.join(f'[a{i}]' for i in range(1, n))
    graph = ';'.join(parts) + f';{mix}amix=inputs={n - 1}:normalize=0,volume=0.7,alimiter=limit=0.85,afade=t=out:st={total - 0.4:.2f}:d=0.4[aout]'
    out = os.path.join(OUT, f'ad_{name}.mp4')
    subprocess.run(args + ['-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                           '-t', f'{total:.3f}', '-movflags', '+faststart', out], check=True)
    os.remove(vid)
    print(f'{out} — {nframes}프레임 · {total:.1f}초 · {os.path.getsize(out) // 1024} KB · 효과음 {n - 1 - len(music)}개')


ADS = {'A': ad_a, 'B': ad_b, 'C': ad_c}

if __name__ == '__main__':
    for k in (sys.argv[1:] or list(ADS)):
        render(k, ADS[k.upper()])
