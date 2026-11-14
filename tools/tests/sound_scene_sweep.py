"""사운드 장면 점검실(tools/sound/scene.html) — 장면 157개를 차례로 돌려 오류·소리 재생을 확인하고, 그 소리가 난 순간을 캡처

  PYTHONUTF8=1 python tools/tests/sound_scene_sweep.py [출력 폴더] [소리 이름 …]
  결과: <출력>/sweep.json (장면마다 이 소리 횟수 · 같이 난 소리 · 오류) · <출력>/shots/<이름>.png · <출력>/sheet_N.png (모아 보기)
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from common import start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '_out', 'sound_scene')
only = sys.argv[2:]
os.makedirs(os.path.join(out, 'shots'), exist_ok=True)
httpd, base = start_server()
results = []
with sync_playwright() as pw:
    br = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    page = br.new_page(viewport={'width': 1600, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(base + '/tools/sound/scene.html')
    page.wait_for_function('window.soundScene', timeout=30000)
    page.click('#btnReplay')
    page.evaluate("""() => {
        const S = window.soundScene;
        const orig = S.audio.onPlay;
        window.__plays = [];
        S.audio.onPlay = (n, p) => { if (p) window.__plays.push([n, S.stage.time]); orig(n, p); };
        document.querySelector('#btnLoop').click();   // 반복 끔
    }""")
    ids = only or page.evaluate('window.soundScene.cues.map(c => c.id)')
    for cid in ids:
        errors.clear()
        page.evaluate("id => { window.__plays = []; window.__shot = false; window.soundScene.select(id); }", cid)
        t0 = time.time()
        shot = False
        while time.time() - t0 < 12:
            st = page.evaluate("""id => { const S = window.soundScene;
                return { t: S.stage.time, dur: S.stage.duration, paused: S.stage.paused, focus: window.__plays.filter(p => p[0] === id).length,
                         ev: S.stage.events.length }; }""", cid)
            if not shot and st['focus'] > 0:
                page.wait_for_timeout(140)
                page.locator('#stageBox').screenshot(path=os.path.join(out, 'shots', f'{cid}.png'))
                shot = True
            if not st['paused'] and st['t'] >= st['dur'] and st['ev'] == 0:
                break
            page.wait_for_timeout(80)
        if not shot:
            page.locator('#stageBox').screenshot(path=os.path.join(out, 'shots', f'{cid}.png'))
        page.wait_for_timeout(500)   # 연출(실제 시간)이 끝나도록
        plays = page.evaluate('window.__plays')
        focus = [round(t, 2) for n, t in plays if n == cid]
        others = {}
        for n, _ in plays:
            if n != cid:
                others[n] = others.get(n, 0) + 1
        r = {'id': cid, 'focus': len(focus), 'at': focus[:6], 'others': others, 'errors': list(errors)[:5], 'sec': round(time.time() - t0, 1)}
        results.append(r)
        print(f"{'OK ' if focus and not errors else 'XX '} {cid:22s} 이 소리 {len(focus):2d}번 {focus[:3]} 같이 {sum(others.values())} 오류 {len(errors)}", flush=True)
    br.close()
httpd.shutdown()
json.dump(results, open(os.path.join(out, 'sweep.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# 모아 보기 (가로 4 × 세로 6, 칸마다 이름)
try:
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
    cw, chh, cols, rows = 400, 225, 4, 6
    per = cols * rows
    for k in range(0, len(results), per):
        sheet = Image.new('RGB', (cols * cw, rows * (chh + 26)), (8, 9, 12))
        d = ImageDraw.Draw(sheet)
        for j, r in enumerate(results[k:k + per]):
            x, y = (j % cols) * cw, (j // cols) * (chh + 26)
            p = os.path.join(out, 'shots', f"{r['id']}.png")
            if os.path.exists(p):
                im = Image.open(p).convert('RGB').resize((cw - 4, chh - 4))
                sheet.paste(im, (x + 2, y + 2))
            d.text((x + 6, y + chh), f"{r['id']}  ×{r['focus']}" + ('  오류' if r['errors'] else ''), fill=(255, 176, 32) if r['focus'] and not r['errors'] else (255, 77, 106), font=font)
        sheet.save(os.path.join(out, f'sheet_{k // per + 1}.png'))
except Exception as e:  # noqa: BLE001
    print('모아 보기 실패', e)
bad = [r for r in results if not r['focus'] or r['errors']]
print(f'끝: {len(results) - len(bad)}/{len(results)} 정상')
for r in bad:
    print('  문제:', r['id'], r['focus'], r['errors'][:2])
