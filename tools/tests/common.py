"""
브라우저 자동 검사 공용 도구 (v2)

- 검사용 HTTP 서버를 임의 포트로 직접 띄운다 (serve.py를 켜 둘 필요 없음)
- 헤드리스 Chrome(설치된 Chrome 사용)으로 게임을 열고 v2 모드로 들어간다
- 페이지 오류/콘솔 오류를 모아 검사 실패로 보고한다
- 스크린샷은 tools/tests/_out/ (git 제외)

사용: 각 test_*.py 가 run(ctx) -> None 을 정의하고 ctx.check(조건, 설명) 로 판정한다.
"""
import functools
import http.server
import os
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out')

# 페이지에서 쓰는 모듈 (검사 JS 앞에 붙임)
IMPORTS = """
const { gameState } = await import('/js/engine/state.js');
const { battleEngineV2: b } = await import('/js/engine_v2/battle_v2.js');
const { progress } = await import('/js/engine_v2/progress_v2.js');
const { sound, SFX } = await import('/js/engine_v2/audio/sound_v2.js');
const { settings } = await import('/js/engine_v2/settings_v2.js');
const { monsterControllerV2: m } = await import('/js/engine_v2/monster_v2.js');
const { gameTime } = await import('/js/engine_v2/gameTime.js');
"""

# 캐릭터별 풀세트 (머리, 몸통, 팔, 다리)
BUILDS = {
    'mech': ('head_mech', 'body_red_robot', 'arm_mech_missile', 'leg_red_robot'),
    'kaiju': ('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant'),
    'hero': ('head_hero', 'body_hero', 'arm_hero_wave', 'leg_hero_hover'),
    'chimera': ('head_chimera', 'body_chimera', 'arm_chimera', 'leg_chimera'),
}


class _Handler(http.server.SimpleHTTPRequestHandler):
    # Windows에서 .js가 text/plain으로 나가 ES 모듈이 막히는 문제 방지
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webp': 'image/webp'}

    def log_message(self, *args):
        pass


class _Server(http.server.ThreadingHTTPServer):
    # 로딩 화면이 그림·효과음을 한꺼번에 받을 때 연결이 거부되지 않게 대기열을 늘림 (serve.py와 같음)
    request_queue_size = 64


# Chrome이 막는 포트(ERR_UNSAFE_PORT) — 임의 포트가 여기 걸리면 페이지를 못 엶 (예: 5060)
UNSAFE_PORTS = {1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
                6679, 6697, 10080}


def start_server():
    while True:
        httpd = _Server(('127.0.0.1', 0), functools.partial(_Handler, directory=ROOT))
        if httpd.server_address[1] not in UNSAFE_PORTS:
            break
        httpd.server_close()
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


class Game:
    """게임 페이지 하나. fresh=True면 저장 데이터를 지우고 시작"""

    def __init__(self, pw, base, fresh=True, viewport=(1300, 740), touch=False):
        self.base = base
        self.errors = []
        self.browser = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
        # touch=True: 휴대폰·태블릿 흉내 (손가락이 주 입력 → 휴대폰 배치, D-099)
        self.page = self.browser.new_page(viewport={'width': viewport[0], 'height': viewport[1]}, has_touch=touch, is_mobile=touch)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror: ' + (e.stack or str(e))[:400]))
        self.page.on('console', self._console)
        # openGroups=1: 숨김 그룹(구역 7~10·캐릭터 4명, D-119)을 열고 검사 — 숨김 자체는 test_groups.py가 끄고 확인
        # skipTitle=1: 시작 화면·1-5 뒤 계정 안내를 건너뜀 (D-119 — 확인은 test_title.py)
        self.page.goto(f'{base}/index.html?openGroups=1&skipTitle=1&t={time.time()}')
        if fresh:
            self.page.evaluate('() => localStorage.clear()')
            self.page.reload()

    def _console(self, msg):
        # ERR_NAME_NOT_RESOLVED: 바깥 서버 주소를 못 찾음(인터넷·외부 서비스 문제 — 11-10 Supabase 주소가 안 풀림). 게임 파일은 로컬 서버라 해당 없음
        if msg.type == 'error' and 'favicon' not in msg.text and 'status of 404' not in msg.text and 'ERR_NAME_NOT_RESOLVED' not in msg.text:
            self.errors.append('console: ' + msg.text[:300])

    def enter_v2(self):
        self.page.click('#btn-select-v2')
        self.page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
        self.page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
        # 스토리 인트로(1-1·2-1·3-1 첫 출격, D-100)는 출격 단추를 누르는 검사마다 끼어들므로 끔 — test_story_intro.py만 다시 켬
        self.page.evaluate('() => { window.madOverlordNoIntro = true; }')
        # 피로도(Q-049)도 끔 — 출격을 여러 번 하는 검사가 피로도에 막히지 않게. test_stamina.py만 다시 켬
        self.page.evaluate('() => { window.madOverlordNoStamina = true; }')
        self.wait(300)

    def reload_v2(self):
        self.page.reload()
        self.enter_v2()

    def js(self, code):
        return self.page.evaluate(f'async () => {{ {IMPORTS} {code} }}')

    def equip(self, build):
        head, body, arm, leg = BUILDS[build] if isinstance(build, str) else build
        self.js(f"gameState.equippedParts = {{ head: '{head}', body: '{body}', arm: '{arm}', leg: '{leg}' }};")

    def battle(self, build=None, wait_ms=2800):
        if build:
            self.equip(build)
        self.js("window.madOverlordGameV2.switchScreen('battle');")
        self.wait(wait_ms)

    def place_enemies(self, n=3, gap=60, first=170, hp=4000, speed=35, dps=20):
        self.js(f"""b.spawnInterval = 999;
            for (let i = 0; i < {n}; i++) b.spawnMinion();
            b.enemies.filter(e => !e.isBuilding).forEach((e, i) => {{
                e.x = b.monsterX + {first} + i * {gap}; e.speed = {speed}; e.hp = e.maxHp = {hp}; e.dps = {dps};
                e.dom.style.left = e.x + 'px'; }});""")

    def map_zone(self, ch_id):
        """메인 화면 지도(stageMap_v2.js)를 그 구역으로 넘김 (좌우 밀기·‹ › 단추와 같음, D-104).
        열린 구역이면 그 구역 판이 골라지고, 잠긴 구역이면 첫 정거장을 눌러 잠긴 안내를 띄움"""
        return self.js(f"""const sm = window.madOverlordGameV2.menuController.stageMap;
            const i = sm.pages.findIndex(p => 'ch' + p.zone === '{ch_id}');
            sm.go(i);
            const page = sm.root.querySelectorAll('.v2-smap__page')[i];
            if (!sm.pages[i].open) page.querySelector('.v2-smap__stop').click();
            return {{ n: sm.pages.length, locked: !sm.pages[i].open, fog: page.querySelector('.v2-smap__fog')?.textContent || '',
                     sel: progress.selectedStage, name: document.getElementById('menu-map-name-v2').textContent,
                     foot: document.getElementById('menu-map-foot-v2').textContent }};""")

    def open_boss_gate(self, timeout=8000):
        """보스 판(X-B): 최종 거점을 부숴 보스를 불러냄 — 11-05 피드백 17부터 보스는 거점을 부순 뒤 나옴(boss.afterBase).
        보스가 나올 때까지 기다림(거점 붕괴 연출의 느린 화면 때문에 1.3초보다 걸릴 수 있음). 돌려주는 값: 나왔는지"""
        self.js("const bd = b.enemies.find(e => e.isBuilding && e.isFinal); if (bd) { bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 }); }")
        for _ in range(timeout // 200):
            if self.js("return !!(b.boss && b.boss.hp > 0 && b.boss.dom);"):
                self.wait(1200)   # 거점 붕괴 연출(느린 화면·보스 카드)이 끝나게
                self.js("gameTime.slowUntil = 0; gameTime.speed = 1;")
                return True
            self.wait(200)
        return False

    def wait(self, ms):
        self.page.wait_for_timeout(ms)

    def key(self, k):
        self.page.keyboard.press(k)

    def shot(self, name, selector=None):
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, f'{name}.png')
        (self.page.locator(selector) if selector else self.page).screenshot(path=path)
        return path

    def close(self):
        self.browser.close()


class Context:
    """검사 하나의 판정 모음"""

    def __init__(self, name, base, pw):
        self.name = name
        self.base = base
        self.pw = pw
        self.results = []
        self.games = []

    def game(self, fresh=True, **kw):
        g = Game(self.pw, self.base, fresh=fresh, **kw)
        self.games.append(g)
        return g

    def check(self, ok, desc, detail=''):
        self.results.append((bool(ok), desc, detail))
        return ok

    def finish(self):
        for g in self.games:
            self.check(not g.errors, '페이지 오류 없음', '; '.join(g.errors[:3]))
            g.close()


def run_tests(modules):
    """모듈 목록 실행 → (통과 수, 실패 수, 줄 목록)"""
    httpd, base = start_server()
    lines, npass, nfail = [], 0, 0
    with sync_playwright() as pw:
        for mod in modules:
            ctx = Context(mod.__name__, base, pw)
            t0 = time.time()
            try:
                mod.run(ctx)
            except Exception as e:   # 검사 코드 자체 실패도 실패로
                ctx.check(False, '검사 실행', f'{type(e).__name__}: {str(e)[:300]}')
            ctx.finish()
            lines.append(f'\n[{mod.__name__}] ({time.time() - t0:.1f}s)')
            for ok, desc, detail in ctx.results:
                npass += ok
                nfail += not ok
                lines.append(f"  {'PASS' if ok else 'FAIL'}  {desc}{'' if ok or not detail else '  → ' + detail}")
    httpd.shutdown()
    return npass, nfail, lines
