"""스테이지 지도 Q-022 비교 시안 (2026-11-04): 게임 코드는 그대로, 찍을 때만 바꿔 봄 → MD/스테이지배치_시안/Q022/

  python tools/mockups/stage_map_q022.py

1 NPC 표시: 깃발 시안 → 사용자가 '깬 판 표시 = 게임 기획에 맞는 아이콘'으로 정함(D-108, 오버로드 점령 문장이 기본) — 여기서는 안 찍음
2 번호 표기: 지금(정보 줄·출격 단추·휴대폰 카드에 '3-5') ↔ 뺌
3 걷기 속도: 지금(260px/초) ↔ 가장 느린 안(90px/초, 다리 동작도 같은 비율로 느리게) — 위아래로 붙인 영상
진행 흉내는 stage_map_mock.py와 같음 (구역 1·2 다 깸 + 3-4까지 → 3-5가 다음 판).
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from stage_map_mock import ROOT, SETUP, TMP, Recorder, common, sync_playwright, tap  # noqa: E402

OUT = os.path.join(ROOT, 'MD', '스테이지배치_시안', 'Q022')
SLOW = 90
# 번호 뺀 안: 정보 줄 '3-5 심문소 돌파' → '심문소 돌파', 출격 'STAGE 3-5 심문소 돌파 출격' → '심문소 돌파 출격', 휴대폰 카드 큰 '3-5' 없앰
STRIP = """const fb = document.querySelector('#menu-map-foot-v2 b'); if (fb) fb.textContent = fb.textContent.replace(/^\\d+-[\\dB]+ /, '');
const sub = document.getElementById('menu-sortie-sub-v2'); sub.textContent = sub.textContent.replace(/^STAGE \\d+-[\\dB]+ /, '');
document.querySelector('#menu-stage-card-v2 .v2-mstage__title b')?.remove();"""


def font(size):
    f = ImageFont.truetype('C:/Windows/Fonts/NotoSansKR-VF.ttf', size)
    try:
        f.set_variation_by_name('Bold')
    except Exception:
        pass
    return f


def open_game(pw, base, vp, touch):
    g = common.Game.__new__(common.Game)
    g.base, g.errors = base, []
    g.browser = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    g.page = g.browser.new_page(viewport={'width': vp[0], 'height': vp[1]}, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    g.page.on('pageerror', lambda e: g.errors.append('pageerror: ' + (e.stack or str(e))[:400]))
    g.page.goto(f'{base}/index.html')
    g.page.evaluate('() => localStorage.clear()')
    g.page.reload()
    g.enter_v2()
    g.js(SETUP)
    return g


def shot(g, name, selector=None):
    path = os.path.join(OUT, f'{name}.jpg')
    if selector:
        g.page.locator(selector).screenshot(path=path, type='jpeg', quality=90)
    else:
        g.page.screenshot(path=path, type='jpeg', quality=90)


def stills(pw, base):
    # 2 번호 표기 — PC 메인 · 휴대폰 메인(스테이지 카드) · 휴대폰 스테이지 선택(정보 줄)
    g = open_game(pw, base, (1300, 740), False)
    g.wait(1200)
    shot(g, '2_번호_지금_PC')
    g.js(STRIP)
    g.wait(200)
    shot(g, '2_번호_뺌_PC')
    g.browser.close()
    g = open_game(pw, base, (800, 360), True)
    g.wait(1200)
    shot(g, '2_번호_지금_폰메인')
    g.js(STRIP)
    g.wait(200)
    shot(g, '2_번호_뺌_폰메인')
    g.js("window.madOverlordGameV2.menuController.renderStages(); window.madOverlordGameV2.menuController.openStages(true);")
    g.wait(1200)
    shot(g, '2_번호_지금_폰지도')
    g.js(STRIP)
    g.wait(200)
    shot(g, '2_번호_뺌_폰지도')
    print('번호 오류', g.errors[:2])
    g.browser.close()


def walk_run(pw, base, speed, name):
    """휴대폰 스테이지 선택 화면: 3-5 → 3-4(한 칸) → 3-5 → 3-2(세 칸) 걷기를 찍음 (걷기가 끝날 때까지 기다림)"""
    g = open_game(pw, base, (800, 360), True)
    g.js(f"window.madOverlordGameV2.menuController.openStages(true); window.__smap.walkSpeed = {speed};")
    g.wait(1500)
    rec = Recorder(g.page, name, (1600, 720))
    rec.start()
    g.wait(1000)
    for sid in ('3-4', '3-5', '3-2'):
        tap(g, sid)
        g.wait(300)
        g.page.wait_for_function('() => !window.__smap.walking', timeout=20000)
        g.wait(700)
    g.wait(500)
    rec.cdp.send('Page.stopScreencast')
    g.wait(300)
    print(name, '프레임', len(rec.frames), '오류', g.errors[:2])
    g.browser.close()
    return rec


def side_by_side(a, b, mp4):
    """두 녹화를 시작 시각에 맞춰 위아래로 붙이고 이름표를 얹어 30fps mp4로"""
    import imageio_ffmpeg
    W, H, CAP = 1280, 576, 56
    labels = [f'지금 — {260}px/초 (한 칸 약 0.3~0.6초)', f'가장 느린 안 — {SLOW}px/초 (한 칸 약 1~1.8초, 다리 동작도 느리게)']
    f = font(30)
    t0 = [r.frames[0] for r in (a, b)]
    dur = max(r.frames[-1] - r.frames[0] for r in (a, b)) + 0.5
    tmp = os.path.join(TMP, 'q022_speed')
    os.makedirs(tmp, exist_ok=True)
    idx = [0, 0]
    n = int(dur * 30)
    cache = {}
    for i in range(n):
        t = i / 30
        canvas = Image.new('RGB', (W, 2 * (H + CAP)), (12, 14, 19))
        d = ImageDraw.Draw(canvas)
        for k, r in enumerate((a, b)):
            while idx[k] + 1 < len(r.frames) and r.frames[idx[k] + 1] - t0[k] <= t:
                idx[k] += 1
            key = (k, idx[k])
            if key not in cache:
                cache.clear() if len(cache) > 8 else None
                cache[key] = Image.open(os.path.join(r.dest, f'{idx[k]:04d}.jpg')).convert('RGB').resize((W, H))
            y = k * (H + CAP)
            d.text((18, y + 8), labels[k], font=f, fill=(255, 200, 80) if k == 0 else (120, 220, 255))
            canvas.paste(cache[key], (0, y + CAP))
        canvas.save(os.path.join(tmp, f'{i:05d}.jpg'), quality=88)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(tmp, '%05d.jpg'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', mp4], check=True)
    print('영상', os.path.relpath(mp4, ROOT), f'{dur:.1f}초')


def main():
    os.makedirs(OUT, exist_ok=True)
    httpd, base = common.start_server()
    try:
        with sync_playwright() as pw:
            stills(pw, base)
            a = walk_run(pw, base, 260, 'q022_now')
            b = walk_run(pw, base, SLOW, 'q022_slow')
    finally:
        httpd.shutdown()
    side_by_side(a, b, os.path.join(OUT, '3_걷기속도_비교.mp4'))


if __name__ == '__main__':
    main()
