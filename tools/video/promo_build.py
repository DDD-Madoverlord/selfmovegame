"""인스타 홍보 영상(11-03 시도) 2단계: 세로 15초 영상 만들기

  python tools/video/promo_capture.py   # 먼저 장면 찍기
  python tools/video/promo_build.py     # → tools/video/_out/promo_15s.mp4 (1080×1920, 30fps, H.264 + 배경음)

구성: 0~1.8초 얼굴 6장 + "세상에 버림받은 괴물들" → 장면 4개(각 약 2.6초, 필살기 구간을 빠르게) → 끝 2.4초 제목·COMING SOON
화면: 위 자막(미끄러져 들어옴) · 가운데 전투 장면(크게 잘라 천천히 확대) · 배경은 같은 장면을 흐리게 · 장면이 바뀔 때 흰 번쩍임
소리: assets/audio/bgm/boss.ogg (CC0, Juhani Junkala) 앞 15초, 끝 1초 줄여 사라짐
ffmpeg는 imageio_ffmpeg 패키지에 든 것을 쓴다.
"""
import json
import os
import shutil
import subprocess

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(HERE, '_out', 'clips')
FRAMES = os.path.join(HERE, '_out', 'frames')
OUT = os.path.join(HERE, '_out', 'promo_15s.mp4')
W, H, FPS = 1080, 1920, 30
KO = 'C:/Windows/Fonts/malgunbd.ttf'
EN = 'C:/Windows/Fonts/bahnschrift.ttf'
FACES = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint']

# 장면: 찍은 구간(초) · 빠르기 · 자막 · 이름표 · 강조 색
SCENES = [
    {'clip': 'mech', 'from': 1.05, 'to': 5.6, 'speed': 1.75, 'text': '인류에게 버림받은\n괴물들이', 'tag': '거대로봇 — 필살기 「종말의 포」', 'color': (255, 70, 70)},
    {'clip': 'kaiju', 'from': 1.05, 'to': 4.6, 'speed': 1.35, 'text': '세상을 향해\n진격한다', 'tag': '거대괴수 — 필살기 「멸망의 숨결」', 'color': (120, 255, 90)},
    {'clip': 'frost', 'from': 0.95, 'to': 5.6, 'speed': 1.8, 'text': '필살기 한 방으로\n전장을 뒤집고', 'tag': '서리의 무희 — 필살기 「절대 영도」', 'color': (120, 210, 255)},
    {'clip': 'saint', 'from': 2.2, 'to': 5.9, 'speed': 1.4, 'text': '파츠를 바꿔 끼워\n진화하라', 'tag': '봉합 성녀 — 필살기 「구원의 비」', 'color': (255, 80, 120)},
]
INTRO, OUTRO = 1.8, 2.4
CROP = (40, 215, 900, 735)   # 찍은 1300×740 화면에서 전투가 보이는 곳 (주인공·적·필살기 컷인, 오른쪽 스킬 단추는 뺌)


def font(path, size):
    return ImageFont.truetype(path, size)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def text_block(draw, xy, text, fnt, fill, stroke=(0, 0, 0), sw=6, anchor='la', spacing=10):
    draw.multiline_text(xy, text, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor, spacing=spacing, align='left' if anchor[0] == 'l' else 'center')


def load_clip(sc):
    d = os.path.join(CLIPS, sc['clip'])
    frames = json.load(open(os.path.join(d, 'frames.json'), encoding='utf-8'))
    t0 = frames[0]['t']
    times = [f['t'] - t0 for f in frames]
    n = round((sc['to'] - sc['from']) / sc['speed'] * FPS)
    pick = []
    for k in range(n):
        want = sc['from'] + k / FPS * sc['speed']
        j = min(range(len(times)), key=lambda i: abs(times[i] - want))
        pick.append(os.path.join(d, f'{frames[j]["i"]:04d}.jpg'))
    return pick


def background(frame):
    small = frame.resize((W // 8, round(frame.height * (W // 8) / frame.width)))
    k = max(W / small.width, H / small.height)
    big = small.resize((round(small.width * k), round(small.height * k)), Image.BILINEAR)
    big = big.crop(((big.width - W) // 2, (big.height - H) // 2, (big.width - W) // 2 + W, (big.height - H) // 2 + H))
    big = big.filter(ImageFilter.GaussianBlur(18))
    return ImageEnhance.Brightness(big).enhance(0.38)


def scene_frame(path, sc, k, n):
    src = Image.open(path).convert('RGB')
    canvas = background(src)
    main = src.crop(CROP)
    z = 1 + 0.06 * k / max(1, n - 1)                       # 천천히 확대
    mw = round(W * z)
    mh = round(main.height * mw / main.width)
    main = main.resize((mw, mh), Image.LANCZOS)
    main = main.crop(((mw - W) // 2, (mh - round(mh / z)) // 2, (mw - W) // 2 + W, (mh - round(mh / z)) // 2 + round(mh / z)))
    y = 600
    canvas.paste(main, (0, y))
    d = ImageDraw.Draw(canvas)
    c = sc['color']
    d.rectangle((0, y - 6, W, y), fill=c)
    d.rectangle((0, y + main.height, W, y + main.height + 6), fill=c)
    # 위 자막: 왼쪽에서 미끄러져 들어옴
    a = ease(k / (FPS * 0.35))
    x = round(-200 + 270 * a)
    text_block(d, (x, 250), sc['text'], font(KO, 100), (255, 255, 255), stroke=(0, 0, 0), sw=8, spacing=16)
    d.rectangle((x, 218, x + 120, 230), fill=c)
    # 아래 이름표
    tag_a = ease((k - FPS * 0.25) / (FPS * 0.3))
    if tag_a > 0:
        ty = y + main.height + 70 + round(30 * (1 - tag_a))
        text_block(d, (W // 2, ty), sc['tag'], font(KO, 50), c, sw=5, anchor='ma')
    text_block(d, (W // 2, H - 150), 'MAD OVERLORD', font(EN, 56), (255, 190, 60), sw=4, anchor='ma')
    return canvas


def faces_frame(k, n):
    canvas = Image.new('RGB', (W, H), (10, 8, 14))
    d = ImageDraw.Draw(canvas)
    for i, f in enumerate(FACES):
        t = ease((k - i * 3) / 8)
        if t <= 0:
            continue
        im = Image.open(os.path.join(ROOT, 'assets', 'sprites', 'intro', f'face_{f}.webp')).convert('RGB')
        s = round(300 * (0.6 + 0.4 * t))
        im = im.resize((s, s), Image.LANCZOS)
        mask = Image.new('L', (s, s), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
        cx, cy = W // 2 + (i % 3 - 1) * 330, 560 + (i // 3) * 360
        canvas.paste(im, (cx - s // 2, cy - s // 2), mask)
        d.ellipse((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2), outline=(255, 170, 40), width=6)
    a = ease((k - 22) / 10)
    if a > 0:
        text_block(d, (W // 2, 1380 + round(40 * (1 - a))), '세상에 버림받은\n괴물들', font(KO, 104), (255, 255, 255), sw=9, anchor='ma', spacing=18)
    return canvas


def outro_frame(k, n):
    canvas = Image.new('RGB', (W, H), (8, 6, 12))
    d = ImageDraw.Draw(canvas)
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W // 2 - 520, 560, W // 2 + 520, 1160), fill=(140, 60, 10))
    canvas = Image.blend(canvas, glow.filter(ImageFilter.GaussianBlur(120)), 0.6)
    d = ImageDraw.Draw(canvas)
    a = ease(k / 9)
    s = 1.25 - 0.25 * a
    title = font(EN, round(150 * s))
    text_block(d, (W // 2, 700), 'MAD', title, (255, 190, 60), stroke=(60, 20, 0), sw=10, anchor='ma')
    text_block(d, (W // 2, 700 + round(160 * s)), 'OVERLORD', title, (255, 190, 60), stroke=(60, 20, 0), sw=10, anchor='ma')
    b = ease((k - 10) / 8)
    if b > 0:
        text_block(d, (W // 2, 1110), '매드 오버로드', font(KO, 64), (255, 255, 255), sw=6, anchor='ma')
        text_block(d, (W // 2, 1210), '10명의 오버로드 · 파츠 조합 · 자동 전투', font(KO, 42), (200, 205, 220), sw=4, anchor='ma')
    c = ease((k - 22) / 8)
    if c > 0:
        text_block(d, (W // 2, 1420), 'COMING SOON', font(EN, 84), (255, 255, 255), stroke=(200, 60, 30), sw=6, anchor='ma')
    return canvas


def flash(im, amount):
    return Image.blend(im, Image.new('RGB', im.size, (255, 255, 255)), amount) if amount > 0 else im


def main():
    if os.path.isdir(FRAMES):
        shutil.rmtree(FRAMES)
    os.makedirs(FRAMES)
    out = []
    n = round(INTRO * FPS)
    out += [faces_frame(k, n) for k in range(n)]
    for sc in SCENES:
        pick = load_clip(sc)
        for k, p in enumerate(pick):
            im = scene_frame(p, sc, k, len(pick))
            out.append(flash(im, {0: 0.85, 1: 0.5, 2: 0.2}.get(k, 0)))
    n = round(OUTRO * FPS)
    out += [flash(outro_frame(k, n), {0: 0.85, 1: 0.5, 2: 0.2}.get(k, 0)) for k in range(n)]
    for i, im in enumerate(out):
        im.save(os.path.join(FRAMES, f'{i:04d}.png'), compress_level=1)
    dur = len(out) / FPS
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    bgm = os.path.join(ROOT, 'assets', 'audio', 'bgm', 'boss.ogg')
    cmd = [ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(FRAMES, '%04d.png'),
           '-i', bgm, '-t', f'{dur:.3f}', '-af', f'afade=t=out:st={dur - 1:.3f}:d=1',
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k',
           '-movflags', '+faststart', '-shortest', OUT]
    subprocess.run(cmd, check=True)
    shutil.rmtree(FRAMES)   # PNG 프레임은 약 900MB — 영상만 남김
    print(f'{OUT} — {len(out)}프레임 · {dur:.1f}초 · {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    main()
