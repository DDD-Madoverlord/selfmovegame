"""스테이지 지도 (D-104, 2026-11-04): 메인 화면 STORY MAP(js/ui_v2/stageMap_v2.js — 게임에 붙음)을 진행 흉내로 찍는다

  python tools/mockups/stage_map_mock.py          # 그림 + 시연 영상 (PC·휴대폰)
  python tools/mockups/stage_map_mock.py shots    # 그림만

진행 흉내: 구역 1·2 모두 깸, 구역 3은 3-4까지 깸 → 3-5가 다음 판. 결과는 MD/스테이지배치_시안/지도_*.
영상은 CDP 화면 중계로 받은 프레임을 받은 시각대로 30fps mp4로 묶는다 (프레임은 tools/mockups/_out, git 제외).
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'tests'))
from playwright.sync_api import sync_playwright  # noqa: E402
import common  # noqa: E402

OUT = os.path.join(ROOT, 'MD', '스테이지배치_시안')
TMP = os.path.join(HERE, '_out')

SETUP = """
const St = await import('/js/engine_v2/stages_v2.js');
// 진행 흉내: 구역 1·2 전부, 구역 3은 3-4까지 (별은 판마다 섞어서)
const done = [...St.CHAPTERS[0].stages, ...St.CHAPTERS[1].stages, ...St.CHAPTERS[2].stages.slice(0, 4)];
done.forEach((s, i) => { progress.stages[s.id] = { stars: [true, i % 3 !== 2, i % 4 === 0], cleared: true, bestTime: 90 }; });
progress.selectedStage = '3-5';
document.querySelectorAll('.v2-tutorial, .v2-coach, #tutorial-progress-v2').forEach(e => e.style.display = 'none');
const mc = window.madOverlordGameV2.menuController;
mc.renderStages();
window.__smap = mc.stageMap;
return true;
"""

RECT = """sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }"""
STOP = """id => { const b = [...document.querySelectorAll('.v2-smap__stop')].find(x => x.dataset.id === id); const r = b.querySelector('.v2-smap__pad').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2 - 12]; }"""


class Recorder:
    """CDP 화면 중계 프레임 → TMP/<이름>/ (frames.json = 받은 시각)"""

    def __init__(self, page, name, size):
        self.dest = os.path.join(TMP, name)
        shutil.rmtree(self.dest, ignore_errors=True)
        os.makedirs(self.dest)
        self.frames, self.size = [], size
        self.cdp = page.context.new_cdp_session(page)
        self.cdp.on('Page.screencastFrame', self.on_frame)

    def on_frame(self, ev):
        i = len(self.frames)
        with open(os.path.join(self.dest, f'{i:04d}.jpg'), 'wb') as fp:
            fp.write(base64.b64decode(ev['data']))
        self.frames.append(ev['metadata']['timestamp'])
        try:
            self.cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
        except Exception:
            pass

    def start(self):
        self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': self.size[0], 'maxHeight': self.size[1], 'everyNthFrame': 1})

    def stop_and_encode(self, mp4):
        self.cdp.send('Page.stopScreencast')
        time.sleep(0.3)
        import imageio_ffmpeg
        t = self.frames
        lines = []
        for i in range(len(t)):
            dur = (t[i + 1] - t[i]) if i + 1 < len(t) else 0.5
            lines += [f"file '{i:04d}.jpg'", f'duration {max(dur, 0.001):.4f}']
        lines.append(f"file '{len(t) - 1:04d}.jpg'")
        lst = os.path.join(self.dest, 'list.txt')
        with open(lst, 'w', encoding='utf-8') as fp:
            fp.write('\n'.join(lines))
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                        '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], check=True)
        print(f'영상 {os.path.relpath(mp4, ROOT)}: 프레임 {len(t)}장 / {t[-1] - t[0]:.1f}초')


def drag(g, dx_frac, hold_ms=0, steps=14):
    x, y, w, h = g.page.evaluate(RECT, '.v2-smap')
    sx, sy = x + w * (0.5 - dx_frac / 2), y + h * 0.62
    g.page.mouse.move(sx, sy)
    g.page.mouse.down()
    g.page.mouse.move(sx + w * dx_frac, sy + 4, steps=steps)
    if hold_ms:
        g.wait(hold_ms)
        return
    g.page.mouse.up()


def tap(g, stage_id):
    x, y = g.page.evaluate(STOP, stage_id)
    g.page.mouse.click(x, y)


def run(pw, base, label, vp, touch, shots_only):
    g = common.Game.__new__(common.Game)   # common.Game + 기기 배율 2 (선명하게)
    g.base, g.errors = base, []
    g.browser = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    g.page = g.browser.new_page(viewport={'width': vp[0], 'height': vp[1]}, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    g.page.on('pageerror', lambda e: g.errors.append('pageerror: ' + (e.stack or str(e))[:400]))
    g.page.goto(f'{base}/index.html?t={time.time()}')
    g.page.evaluate('() => localStorage.clear()')
    g.page.reload()
    g.enter_v2()
    g.js(SETUP)
    if touch:
        g.js("window.madOverlordGameV2.menuController.openStages(true);")
    g.wait(1500)
    shot = lambda name: g.page.screenshot(path=os.path.join(OUT, f'지도_{label}_{name}.jpg'), type='jpeg', quality=90)
    shot('1_지금구역')
    drag(g, 0.42, hold_ms=250)
    shot('2_밀기중')
    g.page.mouse.up()
    g.wait(900)
    g.js('window.__smap.go(0);')
    g.wait(1200)
    shot('3_깬구역')
    g.js('window.__smap.go(3);')
    g.wait(900)
    shot('4_잠긴구역')
    g.js("window.__smap.go(2);")
    g.wait(1200)
    if not shots_only:
        rec = Recorder(g.page, f'smap_{label}', (vp[0] * 2, vp[1] * 2))
        rec.start()
        g.wait(1200)
        tap(g, '3-2')        # 깬 판으로 걸어 돌아감
        g.wait(3200)
        tap(g, '3-5')        # 다음 판으로 다시 걸어감
        g.wait(3200)
        drag(g, 0.55)        # 오른쪽으로 밀기 → 구역 2
        g.wait(1600)
        drag(g, 0.55)        # → 구역 1
        g.wait(1600)
        drag(g, -0.55)
        g.wait(1000)
        drag(g, -0.55)       # 구역 3으로 돌아옴
        g.wait(1400)
        drag(g, -0.55)       # → 구역 4 (잠김)
        g.wait(1500)
        g.js('window.__smap.go(2);')
        g.wait(1500)
        rec.stop_and_encode(os.path.join(OUT, f'지도_시연_{label}.mp4'))
    print(label, '오류', g.errors[:3])
    g.browser.close()


def main():
    shots_only = len(sys.argv) > 1 and sys.argv[1] == 'shots'
    os.makedirs(OUT, exist_ok=True)
    httpd, base = common.start_server()
    try:
        with sync_playwright() as pw:
            run(pw, base, 'PC', (1300, 740), False, shots_only)
            run(pw, base, '폰', (800, 360), True, shots_only)
    finally:
        httpd.shutdown()
    sheet()


def sheet():
    """한눈에 보기: 위 PC 지금 구역, 아래 휴대폰 4장"""
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.truetype('C:/Windows/Fonts/NotoSansKR-VF.ttf', 34)
    try:
        font.set_variation_by_name('Bold')
    except Exception:
        pass
    W = 2000
    pc = Image.open(os.path.join(OUT, '지도_PC_1_지금구역.jpg')).convert('RGB')
    pc = pc.resize((W, round(pc.height * W / pc.width)))
    names = [('1_지금구역', '지금 구역 · 깬 판 · 다음 판(!) · 잠긴 판'), ('2_밀기중', '좌우로 밀어 구역 넘기기'),
             ('3_깬구역', '다 깬 구역 — 보스 판에 선 캐릭터'), ('4_잠긴구역', '잠긴 구역 — 안개 + 여는 조건')]
    cw = W // 2
    phones = [Image.open(os.path.join(OUT, f'지도_폰_{n}.jpg')).convert('RGB') for n, _ in names]
    ch = round(phones[0].height * cw / phones[0].width)
    cap = 60
    out = Image.new('RGB', (W, cap + pc.height + 2 * (cap + ch)), (12, 14, 19))
    d = ImageDraw.Draw(out)
    d.text((20, 10), 'PC — 메인 화면 오른쪽 지도 (구역 번호 탭 없음)', font=font, fill=(255, 200, 80))
    out.paste(pc, (0, cap))
    for i, (img, (_, txt)) in enumerate(zip(phones, names)):
        x, y = (i % 2) * cw, cap + pc.height + (i // 2) * (cap + ch)
        d.text((x + 20, y + 10), f'휴대폰 — {txt}', font=font, fill=(255, 200, 80))
        out.paste(img.resize((cw, ch)), (x, y + cap))
    path = os.path.join(OUT, '지도_한눈에보기.jpg')
    out.save(path, quality=88)
    print('한눈에 보기', os.path.relpath(path, ROOT), out.size)


if __name__ == '__main__':
    main()
