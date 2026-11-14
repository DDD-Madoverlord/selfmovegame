"""스킬 이펙트 5차 개선 (D-122, 2026-11-14 피드백 12항목) + 보완 (D-123 — Gemini 시트 earth_flip·wing_gust, 종말의 포 충전, 심장 핵 자리)
+ 2차 보완 (D-124 — 충전 발밑 불꽃 뺌, 날개 펄럭임 wingFlap, 강철 방벽이 적·투사체를 막음):
실제 전투에서 쓰고 그림 층·판정을 확인 + 화면 캡처."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))

# 지나간 그림 기록: '시트 또는 종류|크기' + 던진 덩이 모양(lob style) + 그림별 가장 긴 길이·시간 (캡처가 느려 확인 시각이 밀려도 한 번이라도 나왔는지)
REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__lob = new Set(); window.__max = {}; window.__atk = 0;
    if (!b.__atkWrap) { const f = b.fireAttack.bind(b); b.fireAttack = (...a) => { window.__atk++; return f(...a); }; b.__atkWrap = true; }
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => {
        const k = it.sheet || it.type; window.__seen.add(`${k}|${it.size}`);
        if (it.type === 'lob') window.__lob.add(it.style);
        if (it.type === 'heartPulse' && it.started) { const c = m.getSocketPoint('core', 'body'), [px, py] = b.fx.vfx._pos(it);
            window.__hpOff = c ? Math.hypot(px - c.x, py - (b.fx.H - c.bottom)) : 999; }
        const mx = window.__max[k] || (window.__max[k] = { h: 0, dur: 0 });
        mx.h = Math.max(mx.h, it.height || 0); mx.dur = Math.max(mx.dur, it.dur || 0); }); }, 8);"""

# (이름, 빌드, 슬롯, 캡처 시각들(ms), 확인 JS — dict를 return)
CASES = [
    ('salvo', SET('mech', 'l'), 'arm', [300, 700], """
        return { shell: __lob.has('shell'), blast: __seen.has('fire_burst|110') };"""),
    ('doom', SET('mech', 'l'), 'head', [1100, 2300, 3600], """
        const W = b.fx.canvas.width / (b.fx.res || 1);
        return { charge: __seen.has('gather|undefined') && __seen.has('bass_drop|240'), noFootFlame: !__seen.has('power_aura|250'), beam: __seen.has('orbital_beam|0'), toEdge: (__max.orbital_beam?.h || 0) >= W - b.monsterX, long: (__max.orbital_beam?.dur || 0) >= 3,
            noOld: !__seen.has('apocalypse_beam|560') };"""),
    ('dimcut', SET('mech', 'm'), 'arm', [330, 1350], """
        return { rift: __seen.has('riftCut|undefined'), noBeam: !__seen.has('beam|undefined') };"""),
    ('meteor', SET('mech', 'm'), 'head', [1500, 2600], """
        return { fall: __seen.has('meteor_cyan|220'), hit: __seen.has('meteor_cyan|290') };"""),
    ('overturn', SET('kaiju', 'l'), 'arm', [600, 800], """
        return { slabs: [...__seen].some(k => k.startsWith('earth_flip|')), toss: b.enemies.some(e => e.recoil && e.recoil.playState === 'running') || window.__tossed };"""),
    ('heart', SET('kaiju', 'l'), 'body', [200, 400], """
        return { atCore: window.__hpOff < 4, pulse: __seen.has('heartPulse|undefined'), dome: __seen.has('domeWave|undefined'), noSub: !__seen.has('subwoofer_blast|undefined') };"""),
    ('scale', SET('kaiju', 'm'), 'arm', [450, 800], """
        return { scale: __lob.has('scale'), noBurst: !__seen.has('golden_burst|70') };"""),
    ('gale', SET('kaiju', 'm'), 'body', [250, 520, 700], """
        return { flap: m.rigBattle.onceClip === 'wingFlap' || window.__flapSeen, swirl: __seen.has('wing_gust|300'), gust: __seen.has('wing_gust|0'), noLines: !__seen.has('speedlines|undefined') && !__seen.has('gust|undefined') };"""),
    ('blade', SET('hero', 'l'), 'arm', [250, 500], """
        return { after: __seen.has('afterimage|undefined'), dash: __seen.has('dashStreak|undefined') };"""),
    ('fear', SET('hero', 'l'), 'body', [700, 1600], """
        return { loom: __seen.has('shadow_rise|340'), feared: !!document.querySelector('#screen-battle-v2 .enemy-entity.is-feared') };"""),
]


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    for name, build, slot, shots, check in CASES:
        g.battle(build)
        g.place_enemies(n=4, first=160 if name == 'fear' else 230, gap=60, hp=100000, speed=40 if name == 'fear' else 0, dps=0)
        if name == 'gale':
            g.js("window.__flapSeen = false; clearInterval(window.__flapT); window.__flapT = setInterval(() => { if (m.rigBattle.onceClip === 'wingFlap') window.__flapSeen = true; }, 10);")
        if name == 'overturn':   # 뒤집기 애니메이션이 한 번이라도 돌았는지 (캡처가 느려 끝난 뒤 확인될 수 있음)
            g.js("window.__tossed = false; const t = b.tossEnemy.bind(b); b.tossEnemy = (...a) => { window.__tossed = true; return t(...a); };")
        used = g.js(REC + f"b.autoSkills = false; b.ultGauge = 1; b.skillCd['{slot}'] = 0; return b.useSkill('{slot}');")
        ctx.check(bool(used), f'{name}: 실제 스킬 발동')
        last = 0
        for i, t in enumerate(shots):
            g.wait(t - last)
            last = t
            g.shot(f'vfx5_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층·판정 확인', str(st))
        if name == 'blade':   # 연무가 끝나면 캐릭터가 다시 보임
            g.wait(1200)
            ctx.check(g.js("return m.spriteCanvas.style.opacity === '';") is True, 'blade: 끝나면 캐릭터가 다시 보임')
        g.wait(2500)

    # 용왕의 숨결: 6초 숨결 동안 기본 공격이 나가지 않음 (예전엔 숨결 동작 1.3초가 끝나면 물기 공격이 같이 나갔음)
    g.battle(SET('kaiju', 'm'))
    g.place_enemies(n=4, first=200, gap=60, hp=100000, speed=0, dps=0)
    g.js(REC + "b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(700)
    g.js("window.__atk = 0;")
    g.wait(3000)
    g.shot('vfx5_breath', '#screen-battle-v2')
    g.wait(2000)
    st = g.js("return { atk: window.__atk, one: (__max.breath_gold?.dur || 0) >= 5 };")
    ctx.check(st['atk'] == 0 and st['one'], '용왕의 숨결: 숨결 동안 기본 공격 없음 + 6초 이어지는 숨결 하나', str(st))
    g.wait(1500)
    st = g.js("window.__atk = 0; return true;")
    g.wait(2500)
    ctx.check(g.js("return window.__atk;") > 0, '용왕의 숨결: 끝나면 기본 공격이 다시 나감')

    # 열기 발자국: 걸을 때 불씨가 앞으로 날아감 (적이 멀어 걷는 중)
    g.battle(SET('kaiju', 'c'))
    g.place_enemies(n=2, first=650, gap=60, hp=100000, speed=0, dps=0)
    g.js(REC + "b.autoSkills = false;")
    g.wait(1200)
    g.shot('vfx5_heat', '#screen-battle-v2')
    st = g.js("for (let i = 0; i < 200 && !__lob.has('ember'); i++) await new Promise(q => setTimeout(q, 10)); return { ember: __lob.has('ember') };")
    ctx.check(st['ember'], '열기 발자국: 걸음마다 불씨가 앞으로 튐', str(st))

    # 강철 방벽 (D-124): 근접 적은 벽 그림 뒤(오른쪽)에 서서 주인공을 못 때림, 적 탄은 벽에서 막혀 도착하지 않음
    g.battle(SET('mech', 'c'))
    g.js("""b.spawnInterval = 999; for (let i = 0; i < 3; i++) b.spawnMinion('guard');
        b.enemies.filter(e => !e.isBuilding).forEach((e, i) => { e.x = b.monsterX + 260 + i * 50; e.speed = 90; e.hp = e.maxHp = 100000; e.dps = 40;
            e.dom.style.left = e.x + 'px'; });
        b.autoSkills = false; b.skillCd.body = 0; b.useSkill('body'); window.__hp0 = b.playerHp;""")
    g.wait(1800)
    g.shot('vfx5_steel_wall', '#screen-battle-v2')
    st = g.js("""const z = b.kitZones.find(z => z.wall); const edge = z ? b.kitWallEdge(z) : 0;
        window.__arrived = false;
        b.fx.launchNeedle({ x: b.frontX() + 400, bottom: 120 }, () => ({ x: b.monsterX + 40, b: 120 }), () => { window.__arrived = true; }, { dur: 0.5, sfx: null });
        const units = b.enemies.filter(e => !e.isBuilding);
        return { wall: !!z, behind: units.every(e => e.x >= edge - 1), noHit: Math.round(window.__hp0 - b.playerHp) === 0,
            pixel: getComputedStyle(document.querySelector('#screen-battle-v2 .v2-kit-art.is-steelwall')).imageRendering === 'pixelated' };""")
    g.wait(900)
    st['blocked'] = g.js("return window.__arrived === false;")
    ctx.check(all(st.values()), '강철 방벽: 적이 벽 뒤에 서고 주인공을 못 때림 + 적 탄이 벽에서 막힘 + 도트 그림', str(st))

