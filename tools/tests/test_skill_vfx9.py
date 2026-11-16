"""서리의 무희 스킬 이펙트 개선 (D-137, 2026-11-16 피드백 — 기본 눈보라 춤·영원한 안식 + 2차 세트 9개 27스킬): 실제 전투에서 쓰고 그림 층 확인 + 캡처.
눈보라 춤(몸 둘레 눈보라) · 영원한 안식(바닥을 따라 나아가는 얼음 → 얼음 감옥) · 설원 검무 · 눈보라 마녀 · 얼음 여왕 · 오로라 가희 · 서리 늑대 사냥꾼
· 빙하 거인 소환사 · 밤의 백조 · 영원한 겨울의 여제 · 달빛 검희."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))
BASE = ('head_frost', 'body_frost', 'arm_frost', 'leg_frost')

# 그림 층 기록: 시트·종류|크기, frost_set 칸
REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__frames = new Set(); window.__types = new Set();
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => {
        const k = it.sheet || it.type; window.__seen.add(`${k}|${it.size}`); window.__types.add(k);
        if (it.sheet === 'frost_set' && it.frameRange) window.__frames.add(it.frameRange[0]); }); }, 8);"""

CASES = [
    ('blizzard', BASE, 'body', [800, 2500], "return { vortex: __types.has('petalVortex'), snow: __types.has('snowFall'), flake: __frames.has(1), noAura: !b.fx.vfx.persistent.has('blizzard') };"),
    ('rest', BASE, 'head', [1300, 2400], "return { sprout: __seen.has('ice_shatter|124') || __seen.has('ice_shatter|100'), prison: __frames.has(0), frozen: b.enemies.some(e => e.frozenT > 0) };"),
    ('whitenight', SET('frost', 'a'), 'head', [800, 1300], "return { arc: __seen.has('ice_burst|320') };"),
    ('mirror', SET('frost', 'a'), 'body', [600, 2000], "return { mirror: __frames.has(0) && __seen.has('frost_set|170') };"),
    ('lance', SET('frost', 'a'), 'arm', [250, 500], "return { lance: __frames.has(2) && __seen.has('frost_set|200'), trail: __types.has('boltTrail') };"),
    ('polar', SET('frost', 'b'), 'head', [2000, 5000], "return { snow: __types.has('snowFall'), flake: __frames.has(1) };"),
    ('spirits', SET('frost', 'b'), 'body', [600, 2000, 3000], """return { pop: __seen.has('frost_set|110'),
        spirit: b.allies.some(a => a.kind === 'kit' && a.dom.style.cssText.includes('frost_spirit_walk')),
        arrow: __seen.has('frost_set|58') && b.allies.some(a => a.kitShoot && a.kitShootT != null) };"""),   # 얼음 화살 (D-140)
    ('hail', SET('frost', 'b'), 'arm', [700, 1000], "return { hail: __frames.has(5) && __seen.has('frost_set|80'), hit: __seen.has('ice_shatter|180') };"),
    ('zero', SET('frost', 'u'), 'head', [1500, 2600], "return { wave: __seen.has('eternal_winter|480'), prison: __frames.has(0) };"),
    ('knights', SET('frost', 'u'), 'body', [600, 2000], "return { rise: __seen.has('ice_shatter|200') };"),
    ('spike', SET('frost', 'u'), 'arm', [650, 900], "return { sprout: __seen.has('ice_shatter|130') };"),
    ('aurora', SET('frost', 'c'), 'head', [2000, 4000], "return { sky: __seen.has('aurora_ribbon|420') };"),
    ('ribbonspin', SET('frost', 'c'), 'body', [1200, 2500], "return { orbit: __seen.has('aurora_ribbon|170'), vortex: __types.has('petalVortex') };"),
    ('ribbonthrow', SET('frost', 'c'), 'arm', [550, 800], "return { fly: __seen.has('aurora_ribbon|160') };"),
    ('wolfpack', SET('frost', 'd'), 'head', [2000, 4000], "return { run: __seen.has('ice_wolf|170'), leap: __seen.has('ice_wolf|180'), noHead: !__seen.has('frost_wolf|150') };"),
    ('howl', SET('frost', 'd'), 'body', [600, 1200], "return { wolf: __seen.has('frost_wolf|230'), ring: __seen.has('sonic_ring|300') };"),
    ('pounce', SET('frost', 'd'), 'arm', [350, 600], "return { wolf: __seen.has('frost_wolf|190') };"),
    ('giant', SET('frost', 'v'), 'head', [1200, 1800, 3600], """return { giant: __seen.has('glacier_giant|440'), cracks: __types.has('cracks'),
        golem: b.allies.some(a => a.kind === 'kit' && a.dom.style.cssText.includes('glacier_golem_walk')),
        slam: __seen.has('ice_shatter|120') && __seen.has('frost_set|120'), frozen: b.enemies.some(e => e.frozenT > 0) };"""),   # 내려치기 범위 빙결 (D-140)
    ('icewall', SET('frost', 'v'), 'body', [600, 2000], "return { rise: __seen.has('ice_shatter|230') };"),
    ('glacierdrop', SET('frost', 'v'), 'arm', [850, 1100], "return { rock: __frames.has(5) && __seen.has('frost_set|230'), dome: __types.has('domeWave') };"),
    ('blackswan', SET('frost', 'w'), 'head', [3000, 6900], "return { swan: __frames.has(3), feathers: __seen.has('feather_black|380') || __types.has('feather_black'), end: __seen.has('feather_black|420') };"),
    ('veil', SET('frost', 'w'), 'body', [1000, 4200], "return { veil: __seen.has('feather_black|260'), burst: __seen.has('feather_black|300') };"),
    ('swanspin', SET('frost', 'w'), 'arm', [400, 700], "return { swan: __frames.has(3) && __seen.has('frost_set|130') };"),
    ('winter', SET('frost', 'l'), 'head', [2700, 3500, 7000], "return { snow: __types.has('snowFall'), flake: __seen.has('frost_set|300'), wave: __seen.has('frost_wave|320'), spray: __seen.has('frost_wave|200') };"),   # 냉기 파도 (D-139)
    ('barrier', SET('frost', 'l'), 'body', [1000, 3000], "return { flake: __frames.has(1), snow: __types.has('snowFall') };"),
    ('icestar', SET('frost', 'l'), 'arm', [1000, 1600], "return { star: __frames.has(4) && __seen.has('frost_set|110'), boom: __seen.has('ice_burst|240') };"),
    ('moonfall', SET('frost', 'm'), 'head', [1500, 3000], "return { dome: __types.has('domeWave'), field: __types.has('snowFall') };"),
    ('moonbless', SET('frost', 'm'), 'body', [500, 2000], "return { moon: __seen.has('ice_burst|260') };"),
    ('moonslash', SET('frost', 'm'), 'arm', [500, 1400], "return { line: __types.has('dashStreak'), burst: __seen.has('moon_fall|300') };"),
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
            g.shot(f'vfx9_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층 확인', str(st))
        g.wait(2500)

    # 영원한 안식: 얼음이 바닥을 따라 나아가 가까운 적부터 차례로 갇히고, 한꺼번에 깨지며 피해
    g.battle(BASE)
    g.place_enemies(n=4, first=150, gap=70, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(2300)   # 필살기 컷인(1초) + 얼음 줄기가 끝 적까지 닿는 시간
    st = g.js("return { frozen: b.enemies.filter(e => e.frozenT > 0).length };")
    g.wait(2500)
    st2 = g.js("return { hurt: b.enemies.filter(e => e.hp < 100000).length };")
    ctx.check(st['frozen'] >= 3 and st2['hurt'] >= 3, '영원한 안식: 가뒀다가 한꺼번에 깨뜨림', f'{st} {st2}')
    # 얼음 거울: 원거리 탄이 거울 자리에서 막혀 되받아쳐짐 — 주인공까지 날아와 맞지(피해·감속) 않음
    g.battle(SET('frost', 'a'))
    g.place_enemies(n=2, first=230, gap=60, hp=100000, speed=0, dps=0)
    g.js("""b.autoSkills = false; b.skillCd['body'] = 0; b.useSkill('body');""")
    g.wait(500)
    st = g.js("""const hp = b.playerHp; let caught = 0; const o = b.fx.vfx.onCatch; b.fx.vfx.onCatch = (...a) => { caught++; o(...a); };
        let dealt = 0; const dd = b.dealDamageToEnemy.bind(b); b.dealDamageToEnemy = (e, a, ...r) => { dealt += a; return dd(e, a, ...r); };
        let slow = 0; const s0 = b.applyPlayerSlow.bind(b); b.applyPlayerSlow = (...a) => { slow++; s0(...a); };
        const e = b.enemies.find(x => !x.isBuilding);
        b.fx.launchOrb({ x: e.x + 12, bottom: 96 }, () => ({ x: b.monsterX + 60, b: 120 }), '90, 230, 255', 0.38, () => {
            b.damagePlayer(80, 0, null, e); b.applyPlayerSlow(1); }, null);
        await new Promise(r => setTimeout(r, 900));
        return { caught, hurt: hp - b.playerHp, slow, dealt: Math.round(dealt), x: b.kitMirrorX() - b.monsterX };""")
    ctx.check(st['caught'] == 1 and st['hurt'] <= 0 and st['slow'] == 0 and st['dealt'] > 0, '얼음 거울: 원거리 탄을 거울에서 막아 되받아침', str(st))
    g.shot('vfx9_mirror_catch', '#screen-battle-v2')

