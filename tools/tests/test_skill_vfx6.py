"""스킬 이펙트 6차 개선 (D-126, 2026-11-14 저녁 피드백 10항목): 실제 전투에서 쓰고 그림 층을 확인 + 화면 캡처.
유성 사슬·별자리 심판(별을 먹는 자) · 영혼 독수리·만수 행진(만수의 왕) · 소용돌이 닻·심해 압력장(리바이어던)
· 별똥 작살비·별빛 거품·은하 해류(별바다 항해사) + 별을 먹는 자 별빛 오브가 손 앞에 그려짐."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))

REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__frames = new Set();
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => {
        const k = it.sheet || it.type; window.__seen.add(`${k}|${it.size}`);
        if (it.sheet === 'spirit_set' && it.frameRange) window.__frames.add(it.frameRange[0]); }); }, 8);"""

CASES = [
    ('chain', SET('hero', 'm'), 'arm', [450, 700], "return { bolt: __seen.has('bolt|undefined'), zap: __seen.has('lightning_burst|170') };"),
    ('constel', SET('hero', 'm'), 'head', [1300, 2700], """return { star: __seen.has('starPoint|undefined'), line: __seen.has('starLine|undefined'),
        beam: __seen.has('star_judgment|340'), nova: __seen.has('plasma_white|560') };"""),
    ('eagles', SET('chimera', 'm'), 'arm', [550, 900], "return { eagle: __frames.has(0) && __seen.has('spirit_set|210'), hit: __seen.has('golden_burst|190') };"),
    ('march', SET('chimera', 'm'), 'head', [1100, 2500], """return { lion: __seen.has('spirit_charge|220'), eagle: __frames.has(0), bear: __frames.has(1),
        snake: __frames.has(2), wolf: __frames.has(3) };"""),
    ('anchor', SET('diver', 'l'), 'arm', [900, 1800], "return { anchor: __frames.has(5) && __seen.has('spirit_set|130'), whirl: __seen.has('water_burst|330') };"),
    ('pressure', SET('diver', 'l'), 'body', [1500, 4000], "return { field: __seen.has('pressureField|undefined') };"),
    ('harpoon', SET('diver', 'm'), 'arm', [700, 1100], "return { harpoon: __frames.has(4) && __seen.has('spirit_set|210'), hit: __seen.has('star_judgment|170') };"),
    ('bubble', SET('diver', 'm'), 'body', [600, 3000], "return { bubble: __seen.has('bubble|undefined') };"),
    ('current', SET('diver', 'm'), 'head', [1200, 3200], "return { flow: __seen.has('star_current|0'), ride: __seen.has('star_current|400') };"),
]


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    for name, build, slot, shots, check in CASES:
        g.battle(build)
        g.place_enemies(n=4, first=230, gap=60, hp=100000, speed=0, dps=0)
        used = g.js(REC + f"b.autoSkills = false; b.ultGauge = 1; b.skillCd['{slot}'] = 0; return b.useSkill('{slot}');")
        ctx.check(bool(used), f'{name}: 실제 스킬 발동')
        last = 0
        for i, t in enumerate(shots):
            g.wait(t - last)
            last = t
            g.shot(f'vfx6_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층 확인', str(st))
        g.wait(2500)

    # 별을 먹는 자: 별빛 오브(sword_m, rig.json z 9.5)가 팔(armF) 앞에 그려짐 — 예전엔 팔 뒤라 주먹과 이음매가 깨져 보였음
    g.battle(SET('hero', 'm'))
    order = g.js("const sk = m.rigBattle.skeleton; return sk._order().map(b => b.name);")
    ctx.check(order.index('sword') > order.index('armF'), '별을 먹는 자: 별빛 오브가 손 앞에 그려짐', str(order))
