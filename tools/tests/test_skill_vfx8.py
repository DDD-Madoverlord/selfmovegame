"""스킬 이펙트 8차 개선 (D-128, 2026-11-14 밤 — 봉합 성녀 5세트 15스킬을 더 화려하고 타격감 있게): 실제 전투에서 쓰고 그림 층 확인 + 캡처.
천 개의 실 날개(구원의 비·수호 실타래·천의 바늘) · 나비 실 수녀(나비 떼의 춤·나비 가루·나비 실 화살) · 흑철 재봉 기계(기계 재봉·실 감기 장갑·실 끌어당기기)
· 운명의 직조자(운명 재봉·생명의 직물·천 갈래 실) · 진홍 장미 성녀(장미 정원·꽃잎 폭풍·넝쿨 포박)."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))

# 그림 층 기록: 시트·종류|크기, saint_set2 칸
REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__frames = new Set(); window.__types = new Set();
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => {
        const k = it.sheet || it.type; window.__seen.add(`${k}|${it.size}`); window.__types.add(k);
        if (it.sheet === 'saint_set2' && it.frameRange) window.__frames.add(it.frameRange[0]); }); }, 8);"""

CASES = [
    ('salvation', SET('saint', 'u'), 'head', [1500, 3500], "return { needle: __frames.has(1) && __seen.has('saint_set2|120'), rain: __types.has('rainFall'), flash: __seen.has('needle_crimson|120'), noPillar: !__seen.has('pillar_gold|150') };"),
    ('guardthread', SET('saint', 'u'), 'body', [700, 3000], "return { start: __seen.has('revive_crimson|230'), spool: __seen.has('saint_set|250'), wrap: __types.has('threadWrap'), shield: b.shieldHp > 0, noRigShield: !(await import('/js/engine_v2/monster_v2.js')).monsterControllerV2.rigBattle?.effects?.shield, noDome: !__seen.has('dome_gold|240') };"),
    ('thneedles', SET('saint', 'u'), 'arm', [380, 800], "return { needle: __seen.has('saint_set2|62'), pin: __seen.has('needle_crimson|110') };"),
    ('butterflies', SET('saint', 'v'), 'head', [1500, 3500], "return { swarm: __seen.has('butterfly_red|300'), fly: __frames.has(0) && __seen.has('saint_set2|70'), pop: __seen.has('butterfly_red|150') };"),
    ('powder', SET('saint', 'v'), 'body', [600, 1200], "return { cloud: __seen.has('spore_burst|0'), fly: __seen.has('saint_set2|58'), weak: b.enemies.some(e => e.kitWeakT > 0 || e.weakT > 0 || e.slowT > 0) };"),
    ('barrow', SET('saint', 'v'), 'arm', [550, 1500], "return { fly: __seen.has('saint_set2|72'), thread: __types.has('threadPath') };"),
    ('machinesew', SET('saint', 'w'), 'head', [1100, 2700], "return { needle: __seen.has('machine_needle|300'), seam: __types.has('threadPath'), cracks: __types.has('cracks') };"),
    ('threadarmor', SET('saint', 'w'), 'body', [600, 3000], "return { wrap: __types.has('threadWrap'), rise: __seen.has('revive_crimson|260') };"),
    ('threadpull', SET('saint', 'w'), 'arm', [400, 1200], "return { needle: __seen.has('saint_set|100'), thread: __types.has('threadPath'), hit: __seen.has('needle_crimson|130') };"),
    ('fatesew', SET('saint', 'l'), 'head', [1500, 6500], "return { sigil: __seen.has('fate_thread|340'), puppet: __types.has('threadPath'), scissors: __frames.has(4), boom: __types.has('golden_burst') };"),
    ('lifefabric', SET('saint', 'l'), 'body', [650, 3000], "return { fabric: __frames.has(5) && __seen.has('saint_set2|150'), pillar: __seen.has('pillar_gold|260'), aura: __seen.has('power_aura|170') };"),
    ('thousandthreads', SET('saint', 'l'), 'arm', [1200, 3700], "return { needle: __seen.has('saint_set2|62'), thread: __types.has('threadPath'), snap: __seen.has('golden_burst|130') };"),
    ('rosegarden', SET('saint', 'm'), 'head', [2000, 4000], """return { bush: __frames.has(2), bloom: __frames.has(3), bind: __seen.has('rose_petal|170'),
        n: b.fx.vfx.items.filter(it => it.sheet === 'saint_set2' && it.frameRange[0] === 2).length >= 6 };"""),
    ('petalstorm', SET('saint', 'm'), 'body', [1200, 2500], "return { vortex: __types.has('petalVortex'), rose: __frames.has(3), swirl: __seen.has('rose_petal|300') };"),
    ('vinebind', SET('saint', 'm'), 'arm', [600, 1500], "return { vine: __frames.has(2) && __seen.has('saint_set2|130'), bind: __seen.has('rose_petal|170'), whip: __seen.has('cleave_crimson|230') };"),
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
            g.shot(f'vfx8_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층 확인', str(st))
        g.wait(2500)

    # 피해·상태는 그대로: 기계 재봉이 직접 판정 (속박 + 꿰맨 표식), 장미 정원 장판, 꽃잎 폭풍 장판
    g.battle(SET('saint', 'w'))
    g.place_enemies(n=4, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(4500)
    st = g.js("return { hurt: b.enemies.filter(e => e.hp < 100000).length };")
    ctx.check(st['hurt'] >= 3, '기계 재봉: 가로지르며 앞 적들 피해', str(st))
    g.battle(SET('saint', 'm'))
    g.place_enemies(n=3, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(2500)
    st = g.js("return { rose: b.kitZones.filter(z => z.tag === 'rose').length, hurt: b.enemies.some(e => e.hp < 100000) };")
    ctx.check(st['rose'] == 1 and st['hurt'], '장미 정원: 장미 장판 + 피해', str(st))
    # 빛 바늘 석궁 기본 공격: 금빛 바늘 화살 + 빛 꼬리가 날아감 (구슬 아님)
    g.battle(SET('saint', 'u'))
    g.place_enemies(n=3, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js(REC + "b.autoSkills = false;")
    g.wait(1500)
    st = g.js("return { arrow: __seen.has('saint_set2|66'), trail: __types.has('boltTrail'), hurt: b.enemies.some(e => e.hp < 100000) };")
    ctx.check(all(st.values()), '빛 바늘 석궁 기본 공격: 화살이 날아가 맞음', str(st))
    g.shot('vfx8_arrow', '#screen-battle-v2')
