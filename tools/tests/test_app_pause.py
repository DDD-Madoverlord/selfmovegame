"""앱이 뒤로 가면 멈춤·소리 끔 (11-05 피드백 22번): 화면 가림(visibilitychange)·Android 앱 신호(mo-app-state) 모두 — 소리(AudioContext·배경음) 정지, 전투 일시정지, 돌아오면 소리만 다시 (전투는 일시정지 창 그대로)."""

STATE = "return { ctx: sound.ctx && sound.ctx.state, away: !!sound.away, bgmPaused: sound.bgm ? sound.bgm.el.paused : null, bgm: sound.bgm && sound.bgm.name, paused: gameTime.paused, battle: b.isActive };"
HIDE = "Object.defineProperty(document, 'hidden', { configurable: true, get: () => %s }); document.dispatchEvent(new Event('visibilitychange'));"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.wait(600)
    st = g.js(STATE)
    ctx.check(st['ctx'] == 'running' and not st['away'] and st['bgm'] == 'menu', '처음: 소리 켜짐 · 메뉴 배경음', str(st))

    # 메뉴에서 화면 가림 → 소리 정지 / 돌아오면 다시
    g.js(HIDE % 'true')
    g.wait(300)
    st = g.js(STATE)
    ctx.check(st['ctx'] == 'suspended' and st['away'] and st['bgmPaused'], '메뉴에서 화면이 가려지면: 효과음 엔진 정지 · 배경음 일시정지', str(st))
    n0 = g.js("return sound.playing.get('ui_click') || 0;")
    g.js("sound.play('ui_click');")
    ctx.check(g.js("return sound.playing.get('ui_click') || 0;") == n0, '가려진 동안 새 효과음은 안 냄 (돌아올 때 한꺼번에 터지지 않게)')
    g.js(HIDE % 'false')
    g.wait(400)
    st = g.js(STATE)
    ctx.check(st['ctx'] == 'running' and not st['away'] and st['bgmPaused'] is False, '돌아오면: 소리 다시 (효과음 엔진·배경음)', str(st))

    # 전투 중 Android 앱 신호(MainActivity onPause) → 전투 일시정지 + 소리 정지 / onResume → 소리만, 전투는 일시정지 창 그대로
    g.battle('mech', wait_ms=2800)
    g.js("window.dispatchEvent(new CustomEvent('mo-app-state', { detail: { active: false } }));")
    g.wait(300)
    st = g.js(STATE)
    t0 = g.js("return b.stats.time;")
    g.wait(800)
    ctx.check(st['battle'] and st['paused'] and st['ctx'] == 'suspended' and st['bgmPaused'], '전투 중 앱이 뒤로 감(앱 신호): 전투 일시정지 · 소리 정지', str(st))
    ctx.check(g.js("return b.stats.time;") == t0, '뒤에 있는 동안 전투 시간이 흐르지 않음', f'{t0} → {g.js("return b.stats.time;")}')
    g.js("window.dispatchEvent(new CustomEvent('mo-app-state', { detail: { active: true } }));")
    g.wait(400)
    st = g.js(STATE)
    ctx.check(st['ctx'] == 'running' and not st['away'] and st['paused'], '앱으로 돌아오면: 소리는 다시, 전투는 일시정지 그대로(직접 이어 하기)', str(st))

    # 설정에서 소리를 꺼 둔 사람: 돌아와도 꺼진 그대로 (음량은 settings — 정지·재개와 따로)
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.js("settings.set('mute', true); sound.applyVolumes();")
    g.wait(300)
    g.js("window.dispatchEvent(new CustomEvent('mo-app-state', { detail: { active: false } })); window.dispatchEvent(new CustomEvent('mo-app-state', { detail: { active: true } }));")
    g.wait(400)
    st = g.js("return { ctx: sound.ctx.state, gain: sound.master.gain.value, mute: settings.values.mute };")
    ctx.check(st['ctx'] == 'running' and st['mute'] and st['gain'] < 0.01, '설정에서 소리를 끈 경우: 돌아와도 꺼진 그대로', str(st))
    g.js("settings.set('mute', false); sound.applyVolumes();")
