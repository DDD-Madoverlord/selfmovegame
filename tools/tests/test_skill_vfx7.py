"""스킬 이펙트 7차 개선 (D-127, 2026-11-14 밤 피드백 — 봉합 성녀 11항목): 실제 전투에서 쓰고 그림 층을 확인 + 화면 캡처.
종지기 수녀(종 추 강타·봉헌의 촛불·만종) · 붉은 실 재봉사(꿰매기 사슬·실 고치·운명의 실타래)
· 약초 치유사(약병 투척·약초 연기·치유의 비) · 눈물의 조각상(돌 손바닥·석화의 눈물 — 돌이 적 발밑 바닥에서)."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))

# 그림 층 기록: 시트·종류|크기, saint_set 칸, 석화 돌 그림의 화면 y(바닥 = fx.H - FOOT_B), 연기 장판 칸 그림(herb) 수
REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__frames = new Set(); window.__stoneY = []; window.__herb = 0;
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => {
        const k = it.sheet || it.type; window.__seen.add(`${k}|${it.size}`);
        if (it.sheet === 'saint_set' && it.frameRange) window.__frames.add(it.frameRange[0]);
        if (it.sheet === 'stone_grey' && it.t > 0) window.__stoneY.push(Math.round(b.fx.vfx._pos(it)[1]));
        if (it.type === 'groundField') window.__herb++; }); }, 8);"""

CASES = [
    ('bellstrike', SET('saint', 'a'), 'arm', [430, 700], "return { ring: __seen.has('sonic_ring|230'), dome: __seen.has('domeWave|undefined') };"),
    ('candles', SET('saint', 'a'), 'body', [800, 3000], """return { candle: __frames.has(1) && __seen.has('saint_set|84'), glow: __seen.has('candleGlow|undefined'),
        n: b.fx.vfx.items.filter(it => it.sheet === 'saint_set').length >= 5 };"""),
    ('belltoll', SET('saint', 'a'), 'head', [600, 1000], "return { bell: __frames.has(0) && __seen.has('saint_set|250'), wave: __seen.has('shockwave|undefined') };"),
    ('stitch', SET('saint', 'b'), 'arm', [330, 800], "return { needle: __frames.has(4) && __seen.has('saint_set|120'), thread: __seen.has('threadPath|undefined') };"),
    ('cocoon', SET('saint', 'b'), 'body', [1500, 4150], """return { cocoon: __frames.has(3) && __seen.has('saint_set|250'), wrap: __seen.has('threadWrap|undefined'),
        burst: __seen.has('needle_crimson|280') };"""),
    ('fate', SET('saint', 'b'), 'head', [1300, 3000], "return { sigil: __seen.has('fate_thread|380'), thread: __seen.has('threadPath|undefined') };"),
    ('potion', SET('saint', 'c'), 'arm', [520, 950], "return { flask: __frames.has(2) && __seen.has('saint_set|52'), burst: __seen.has('acid_burst|150') };"),
    ('smoke', SET('saint', 'c'), 'body', [1500, 3000], "return { cloud: __seen.has('defeat_puff|0'), noTiles: __herb === 0 };"),
    ('healrain', SET('saint', 'c'), 'head', [2000, 5000], "return { rain: __seen.has('rainFall|undefined'), overlay: __seen.has('heal_rain|300') };"),
    ('palm', SET('saint', 'd'), 'arm', [460, 700], "return { hand: __frames.has(5) && __seen.has('saint_set|210'), dome: __seen.has('domeWave|undefined') };"),
    ('petrify', SET('saint', 'd'), 'head', [1000, 2600], """const ground = Math.round(b.fx.H - 58);
        return { stone: __stoneY.length > 0, onGround: __stoneY.length > 0 && __stoneY.every(y => Math.abs(y - ground) <= 2),
            grey: b.enemies.some(e => e.dom && e.dom.classList.contains('is-stone')) };"""),
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
            g.shot(f'vfx7_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층 확인', str(st))
        g.wait(2500)

    # 석화가 끝나면 잿빛(.is-stone)이 풀림 · 돌 손바닥·약병 투척 피해와 상태는 그대로
    g.battle(SET('saint', 'd'))
    g.place_enemies(n=3, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(7000)   # 석화 3초 + 4세트 1.5초 + 필살기 장면
    ctx.check(not g.js("return b.enemies.some(e => e.dom && e.dom.classList.contains('is-stone'));"), '석화의 눈물: 끝나면 잿빛이 풀림')
    g.battle(SET('saint', 'd'))
    g.place_enemies(n=3, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.wait(300)
    hp0 = g.js("return b.enemies[0].hp;")
    g.js("b.autoSkills = false; b.skillCd['arm'] = 0; b.useSkill('arm');")
    g.wait(900)
    st = g.js("return { hp: b.enemies[0].hp, stun: b.enemies[0].stunT || 0 };")
    ctx.check(st['hp'] < hp0 and st['stun'] > 0, '돌 손바닥: 앞 적 피해 + 기절', str(st))
    g.battle(SET('saint', 'c'))
    g.place_enemies(n=3, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.skillCd['arm'] = 0; b.useSkill('arm');")
    g.wait(1500)
    st = g.js("return { zones: b.kitZones.filter(z => z.field === 'herb').length, hurt: b.enemies.some(e => e.hp < 100000) };")
    ctx.check(st['zones'] > 0 and st['hurt'], '약병 투척: 깨진 자리 장판 + 피해', str(st))
