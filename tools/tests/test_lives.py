"""전투 목숨 (11-05 피드백 21번, Q-028 임시): 내구도 0이면 목숨 하나를 쓰고 과부하·긴급 수리로 다시 일어남, 다 쓰고 또 쓰러지면 패배.
무료 2 · 패스(weekly_pass_7d) 4 — 전투마다 새로. HUD 하트 · 결과 '목숨을 모두 잃었습니다'."""

DOWN = "b.playerHp = 0;"
STATE = "return { lives: b.lives, max: b.livesMax, out: !!b.livesOut, over: b.overloadT > 0, hearts: document.querySelectorAll('#hud-lives-v2 i').length, on: document.querySelectorAll('#hud-lives-v2 i.is-on').length };"


def knock_down(g):
    """쓰러뜨리고 과부하가 끝날 때까지 (목숨이 남았을 때) — 다음 쓰러뜨리기 전 내구도 회복"""
    g.js(DOWN)
    g.wait(300)


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('mech', wait_ms=2800)
    g.js("b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);")
    st = g.js(STATE)
    ctx.check(st['lives'] == 2 and st['max'] == 2 and st['hearts'] == 2 and st['on'] == 2, '무료: 목숨 2 · HUD 하트 2개', str(st))

    knock_down(g)
    st = g.js(STATE)
    ctx.check(st['lives'] == 1 and st['over'] and st['on'] == 1 and not st['out'], '첫 번째로 쓰러짐: 목숨 1 남고 과부하(긴급 수리) · 하트 1개 꺼짐', str(st))
    g.js("b.overloadT = 0.01;")
    g.wait(300)
    knock_down(g)
    g.js("b.overloadT = 0.01;")
    g.wait(300)
    st = g.js(STATE)
    ctx.check(st['lives'] == 0 and not st['out'] and g.js("return b.isActive && b.playerHp > 0;"), '두 번째로 쓰러짐: 목숨 0, 그래도 다시 일어남 (다시 일어나는 횟수 2)', str(st))

    knock_down(g)
    st = g.js(STATE)
    ctx.check(st['out'], '목숨 없이 또 쓰러짐: 패배 시작 (쓰러지는 연출)', str(st))
    g.wait(3600)
    res = g.js("return { result: !!document.querySelector('.v2-result'), sub: document.querySelector('.v2-result__sub')?.textContent || '', title: document.querySelector('.v2-result__title')?.textContent || '' };")
    ctx.check(res['result'] and 'FAILED' in res['title'] and '목숨' in res['sub'], "결과: MISSION FAILED · '목숨을 모두 잃었습니다'", str(res))
    g.shot('lives_result', '#screen-battle-v2')

    # 패스가 켜져 있으면 4 (진짜 결제 전이라 activePass를 흉내)
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    g.js("const orig = progress.activePass; progress.activePass = () => true; window.madOverlordGameV2.switchScreen('battle'); progress.activePass = orig;")
    g.wait(2800)
    st = g.js(STATE)
    ctx.check(st['lives'] == 4 and st['hearts'] == 4, '패스: 목숨 4 · 하트 4개 (전투마다 새로)', str(st))

    # 휴대폰 HUD에도 하트
    p = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    p.enter_v2()
    p.battle('mech', wait_ms=3000)
    st = p.js("const l = document.getElementById('hud-lives-v2'); const r = l.getBoundingClientRect(); return { shown: l.getClientRects().length > 0 && r.width > 10, n: l.querySelectorAll('i.is-on').length, inside: r.right <= innerWidth && r.bottom <= innerHeight };")
    ctx.check(st['shown'] and st['n'] == 2 and st['inside'], '휴대폰 전투 HUD에도 목숨 하트', str(st))
    p.shot('lives_mobile_hud')
