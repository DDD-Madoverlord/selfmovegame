"""인스타 홍보 영상(11-03 시도) 1단계: 게임 장면 찍기

  python tools/video/promo_capture.py            # 장면 4개 전부
  python tools/video/promo_capture.py frost      # 이름에 'frost'가 들어간 장면만

헤드리스 Chrome에서 전투를 열고, 적을 화면 가득 세운 뒤 스킬·필살기를 쓰는 동안
CDP 화면 중계(Page.startScreencast)로 프레임을 받아 tools/video/_out/clips/<장면>/ 에 저장한다.
프레임마다 받은 시각을 frames.json에 남겨 2단계(promo_build.py)가 30fps로 고르게 맞춘다.
"""
import base64
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tests'))
from playwright.sync_api import sync_playwright  # noqa: E402
import common  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'clips')

# 장면: 스테이지 · 파츠 4개 · 적 · (시각 초, 할 일) — 찍는 길이 sec
SCENES = [
    {'name': 'mech', 'stage': '1-5', 'parts': ('head_mech_l', 'body_mech_l', 'arm_mech_l', 'leg_mech_l'), 'enemy': 'riot', 'n': 7, 'sec': 6.0,
     'acts': [(0.2, "b.useSkill('arm')"), (1.0, 'b.ultGauge = 1; b.useSkill(\'head\')')]},
    {'name': 'kaiju', 'stage': '2-3', 'parts': ('head_kaiju_u', 'body_kaiju_u', 'arm_kaiju_u', 'leg_kaiju_u'), 'enemy': None, 'n': 7, 'sec': 6.0,
     'acts': [(0.2, "b.useSkill('body')"), (1.0, "b.ultGauge = 1; b.useSkill('head')")]},
    {'name': 'frost', 'stage': '8-2', 'parts': ('head_frost_u', 'body_frost_u', 'arm_frost_u', 'leg_frost_u'), 'enemy': None, 'n': 8, 'sec': 6.0,
     'acts': [(0.2, "b.useSkill('arm')"), (0.9, "b.ultGauge = 1; b.useSkill('head')")]},
    {'name': 'saint', 'stage': '6-3', 'parts': ('head_saint_u', 'body_saint_u', 'arm_saint_u', 'leg_saint_u'), 'enemy': None, 'n': 7, 'sec': 6.0,
     'acts': [(0.2, "b.useSkill('arm')"), (0.8, "b.useSkill('body')"), (1.4, "b.ultGauge = 1; b.useSkill('head')")]},
]


def capture(pw, base, sc):
    g = common.Game(pw, base, fresh=True)
    try:
        g.enter_v2()
        g.js("const St = await import('/js/engine_v2/stages_v2.js'); St.unlockAllStagesTemp();"
             f"progress.selectedStage = '{sc['stage']}';"
             "document.querySelectorAll('.v2-coach, .v2-tutorial').forEach(e => e.remove());")
        h, bo, a, le = sc['parts']
        g.js(f"gameState.equippedParts = {{ head: '{h}', body: '{bo}', arm: '{a}', leg: '{le}' }};")
        g.js("window.madOverlordGameV2.switchScreen('battle');")
        g.wait(3600)   # 출격 인트로
        g.js("[...document.querySelectorAll('button')].find(x => x.textContent.trim() === '건너뛰기')?.click();")   # 첫 성장 안내 줄 치움
        enemy = f"'{sc['enemy']}'" if sc['enemy'] else 'undefined'
        g.js(f"""document.querySelectorAll('.v2-coach, .v2-tip, .v2-tutorial').forEach(e => e.remove());
            b.spawnInterval = 999;
            for (let i = 0; i < {sc['n']}; i++) {{ const e = b.spawnMinion({enemy}, {{ x: b.frontX() + 90 + i * 70, elite: i === 3 }});
                e.hp = e.maxHp = 9000; e.dom.style.left = e.x + 'px'; }}
            b.skillCd = {{ arm: 0, body: 0 }};""")
        g.wait(700)
        dest = os.path.join(OUT, sc['name'])
        os.makedirs(dest, exist_ok=True)
        for f in os.listdir(dest):
            os.remove(os.path.join(dest, f))
        cdp = g.page.context.new_cdp_session(g.page)
        frames = []

        def on_frame(ev):
            i = len(frames)
            with open(os.path.join(dest, f'{i:04d}.jpg'), 'wb') as fp:
                fp.write(base64.b64decode(ev['data']))
            frames.append({'i': i, 't': ev['metadata']['timestamp']})
            cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})

        cdp.on('Page.screencastFrame', on_frame)
        cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': 1300, 'maxHeight': 740, 'everyNthFrame': 1})
        t0 = time.time()
        acts = sorted(sc['acts'])
        while time.time() - t0 < sc['sec']:
            while acts and time.time() - t0 >= acts[0][0]:
                g.js(acts.pop(0)[1])
            g.wait(30)
        cdp.send('Page.stopScreencast')
        with open(os.path.join(dest, 'frames.json'), 'w', encoding='utf-8') as fp:
            json.dump(frames, fp)
        span = frames[-1]['t'] - frames[0]['t'] if frames else 0
        print(f"{sc['name']}: 프레임 {len(frames)}장 / {span:.1f}초 ({len(frames) / max(span, 0.01):.0f}fps), 오류 {len(g.errors)}")
    finally:
        g.close()


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    httpd, base = common.start_server()
    try:
        with sync_playwright() as pw:
            for sc in SCENES:
                if only in sc['name']:
                    capture(pw, base, sc)
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    main()
