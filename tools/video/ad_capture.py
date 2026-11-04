"""광고 영상 시안(11-03) 1단계: 게임 장면을 2배 해상도로 찍기

  python tools/video/ad_capture.py            # 장면 전부
  python tools/video/ad_capture.py ult_       # 이름에 'ult_'가 들어간 장면만

헤드리스 Chrome(2600×1480 — 게임 화면 맞춤 배율 2)에서 장면을 만들고 CDP 화면 중계(Page.startScreencast)로 프레임을 받아
tools/video/_out/ad_clips/<장면>/ 에 저장한다 (frames.json = 프레임마다 받은 시각). 2단계는 promo_ads.py.
장면 종류
  ult    레전더리 세트로 적 무리 앞에서 스킬 → 필살기
  boss   보스 판 최종 기지 등장 (DANGER · 보스 카드)
  base   최종 기지를 부숨 → 연쇄 폭발 → MISSION COMPLETE → 결과 화면(별·보상)
  lab    연구소에서 부위를 하나씩 레전더리로 바꿈 (리그 미리보기가 바뀜)
  basic  기본 파츠로 같은 적 무리와 싸움 (전후 비교용)
전투 HUD(.v2-hud)는 숨기고 필살기 컷인·도장·데미지 숫자는 그대로 둔다 (hud=True면 HUD도 보임).
"""
import base64
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tests'))
from playwright.sync_api import sync_playwright  # noqa: E402
import common  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', 'ad_clips')
HIDE_HUD = '.v2-hud, .v2-coach, .v2-tutorial, #tutorial-progress-v2 { display: none !important; } #screen-battle-v2 .enemy-entity.v2-enemy::after { content: none !important; }'
HIDE_GUIDE = '.v2-coach, .v2-tutorial, #tutorial-progress-v2 { display: none !important; } #screen-battle-v2 .enemy-entity.v2-enemy::after { content: none !important; }'   # 안내 말풍선·첫 성장 안내 줄

ULT = lambda ch, stage, **kw: {'name': f'ult_{ch}', 'kind': 'ult', 'char': ch, 'stage': stage, 'sec': 5.0, **kw}
SCENES = [
    ULT('mech', '1-5', enemy='riot', sec=6.6), ULT('kaiju', '2-3', sec=6.6), ULT('hero', '3-4'), ULT('chimera', '4-3'), ULT('diver', '5-3'),
    ULT('saint', '6-3'), ULT('doll', '7-3'), ULT('frost', '8-3', letter='u'), ULT('architect', '9-3'), ULT('broadcaster', '10-3'),
    {'name': 'boss_wmd', 'kind': 'boss', 'char': 'mech', 'stage': '1-B', 'sec': 4.2},
    {'name': 'boss_vladimir', 'kind': 'boss', 'char': 'frost', 'stage': '8-B', 'sec': 4.2},
    {'name': 'base_kaiju', 'kind': 'base', 'char': 'kaiju', 'stage': '2-5', 'sec': 9.5, 'hud': True},
    {'name': 'lab_mech', 'kind': 'lab', 'char': 'mech', 'sec': 5.6},
    {'name': 'basic_mech', 'kind': 'basic', 'char': 'mech', 'stage': '1-5', 'enemy': 'riot', 'sec': 5.0},
]

SET_PARTS = """async ([ch, letter]) => {
    const { PARTS_DB } = await import('/js/data/parts.js');
    const { partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
    const { setIdOf } = await import('/js/engine_v2/sets_v2.js');
    const out = {};
    for (const s of ['head', 'body', 'arm', 'leg']) {
        const list = partsOfCharacter(ch, s);
        const p = letter ? list.find(x => setIdOf(x) === ch + '_' + letter) : list[0];
        out[s] = p && p.id;
    }
    return out;
}"""


def new_page(pw, base):
    browser = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 2600, 'height': 1480})   # 게임이 화면에 맞춰 2배로 그림 (main_v2.js FRAME.max 2)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)[:200]))
    page.goto(f'{base}/index.html?t={time.time()}')
    page.evaluate('() => localStorage.clear()')
    page.reload()
    page.click('#btn-select-v2')
    page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
    page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    page.evaluate('() => { window.madOverlordNoIntro = true; }')
    page.wait_for_timeout(300)
    return browser, page, errors


def js(page, code):
    return page.evaluate(f'async () => {{ {common.IMPORTS} {code} }}')


class Recorder:
    def __init__(self, page, dest):
        self.page, self.dest, self.frames = page, dest, []
        os.makedirs(dest, exist_ok=True)
        for f in os.listdir(dest):
            os.remove(os.path.join(dest, f))
        self.cdp = page.context.new_cdp_session(page)
        self.cdp.on('Page.screencastFrame', self.on_frame)

    def on_frame(self, ev):
        i = len(self.frames)
        with open(os.path.join(self.dest, f'{i:04d}.jpg'), 'wb') as fp:
            fp.write(base64.b64decode(ev['data']))
        self.frames.append({'i': i, 't': ev['metadata']['timestamp']})
        try:
            self.cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
        except Exception:   # 멈춘 뒤 늦게 온 프레임
            pass

    def start(self):
        self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 90, 'maxWidth': 2600, 'maxHeight': 1480, 'everyNthFrame': 1})

    def stop(self):
        self.cdp.send('Page.stopScreencast')
        with open(os.path.join(self.dest, 'frames.json'), 'w', encoding='utf-8') as fp:
            json.dump(self.frames, fp)
        span = self.frames[-1]['t'] - self.frames[0]['t'] if self.frames else 0
        return len(self.frames), span


def run_timeline(page, sec, acts):
    t0 = time.time()
    acts = sorted(acts)
    while time.time() - t0 < sec:
        while acts and time.time() - t0 >= acts[0][0]:
            js(page, acts.pop(0)[1])
        page.wait_for_timeout(25)


def capture(pw, base, sc):
    browser, page, errors = new_page(pw, base)
    try:
        js(page, "const St = await import('/js/engine_v2/stages_v2.js'); St.unlockAllStagesTemp();"
                 f"progress.selectCharacter('{sc['char']}');" + (f"progress.selectedStage = '{sc['stage']}';" if sc.get('stage') else ''))
        letter = None if sc['kind'] == 'basic' else sc.get('letter', 'l')   # 기본은 레전더리 세트, 서리는 유니크(절대 영도)가 더 화려함
        parts = page.evaluate(SET_PARTS, [sc['char'], letter])
        assert all(parts.values()), f"{sc['name']}: 파츠를 못 찾음 {parts}"
        rec = Recorder(page, os.path.join(OUT, sc['name']))

        if sc['kind'] == 'lab':
            basic = page.evaluate(SET_PARTS, [sc['char'], None])
            js(page, f"gameState.cartParts = {json.dumps(basic)}; gameState.equippedParts = {json.dumps(basic)};"
                     "window.madOverlordGameV2.switchScreen('lab');")
            page.wait_for_timeout(1500)
            page.add_style_tag(content=HIDE_GUIDE)
            rec.start()
            acts = [(0.6 + k * 1.1, f"gameState.selectCartPart('{s}', '{parts[s]}'); window.madOverlordGameV2.labController.refresh();")
                    for k, s in enumerate(['arm', 'head', 'body', 'leg'])]
            run_timeline(page, sc['sec'], acts)
        else:
            js(page, f"gameState.equippedParts = {json.dumps(parts)}; window.madOverlordGameV2.switchScreen('battle');")
            page.wait_for_timeout(3600)   # 출격 인트로
            page.add_style_tag(content=HIDE_GUIDE if sc.get('hud') else HIDE_HUD)
            enemy = f"'{sc['enemy']}'" if sc.get('enemy') else 'undefined'
            spawn = (f"b.spawnInterval = 999; for (let i = 0; i < 8; i++) {{ const e = b.spawnMinion({enemy}, {{ x: b.frontX() + 80 + i * 62, elite: i === 4 }});"
                     " e.hp = e.maxHp = 6000; e.dom.style.left = e.x + 'px'; } b.skillCd = { arm: 0, body: 0 };")
            if sc['kind'] in ('ult', 'basic'):
                js(page, spawn)
                page.wait_for_timeout(500)
                rec.start()
                run_timeline(page, sc['sec'], [(0.25, "b.useSkill('arm')"), (0.8, "b.useSkill('body')"), (1.5, "b.ultGauge = 1; b.useSkill('head')")])
            elif sc['kind'] == 'boss':
                js(page, "b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = [];")
                rec.start()
                run_timeline(page, sc['sec'], [(0.2, 'b.spawnFinalBase();')])
            elif sc['kind'] == 'base':
                js(page, "b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.spawnFinalBase();")
                page.wait_for_timeout(2600)   # DANGER 경고가 지나가게
                js(page, "const base = b.enemies.find(e => e.isFinal); base.x = b.frontX() + 120; base.dom.style.left = base.x + 'px'; base.hp = Math.min(base.hp, 900);"
                         "for (let i = 0; i < 4; i++) { const e = b.spawnMinion(undefined, { x: b.frontX() + 30 + i * 22, elite: false }); e.hp = e.maxHp = 300; }")
                rec.start()
                run_timeline(page, sc['sec'], [(0.3, "b.ultGauge = 1; b.useSkill('head')"), (1.6, "b.useSkill('arm')")])
        n, span = rec.stop()
        print(f"{sc['name']}: {n}장 / {span:.1f}초 ({n / max(span, 0.01):.0f}fps) 오류 {len(errors)}")
    finally:
        browser.close()


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
