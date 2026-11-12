"""스킬 이펙트 4차 개선 (D-120, 2026-11-11 피드백 6항목): 실제 전투에서 쓰고 그림 층·판정을 확인 + 화면 캡처."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))
CHIMERA_A = ('head_chimera_a', 'body_chimera_a', 'arm_chimera_a', 'leg_chimera_a')
KAIJU_A = ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a')

# 지나간 그림 기록: '시트 또는 종류|크기' (캡처가 느려 확인 시각이 밀려도 한 번이라도 나왔는지)
REC = """clearInterval(window.__seenT); window.__seen = new Set(); window.__maxProj = 0;
    window.__seenT = setInterval(() => { b.fx.vfx.items.forEach(it => window.__seen.add(`${it.sheet || it.type}|${it.size}`));
        window.__maxProj = Math.max(window.__maxProj, b.fx.vfx.projectiles.filter(p => p.core).length); }, 8);"""

# (이름, 빌드, 슬롯, 캡처 시각들(ms), 확인 JS — dict를 return)
CASES = [
    ('earth_smash', CHIMERA_A, 'arm', [450, 650, 1300, 2300], """
        return { dome: __seen.has('domeWave|undefined'), dust: __seen.has('dustCloud|undefined'), cracks: __seen.has('cracks|undefined') };"""),
    ('ground_slam', KAIJU_A, 'arm', [450, 650, 1300, 2300], """
        return { dome: __seen.has('domeWave|undefined'), dust: __seen.has('dustCloud|undefined'), noFissure: !__seen.has('fissure|undefined') };"""),
    ('stingers', SET('chimera', 'c'), 'arm', [260, 400], """
        return { needle: __seen.has('needle_crimson|95') };"""),
    ('spiderlings', SET('chimera', 'c'), 'body', [600, 1500], """
        const a = b.allies.filter(a => a.kind === 'kit');
        return { four: a.length === 4, spider: a.every(a => (a.dom.style.cssText || '').includes('spiderling')) };"""),
    ('bats', SET('chimera', 'd'), 'body', [700, 1600, 2600], """
        return { bats: __seen.has('batSwarm|undefined'), noDark: !__seen.has('dark_burst|70') };"""),
    ('soar', SET('chimera', 'u'), 'body', [300, 550, 800, 1100], """
        return { ok: true };"""),
    ('triple_roar', SET('chimera', 'u'), 'head', [450, 1050, 1650], """
        return { roar: __seen.has('roar_triple|380'), stars: __seen.has('starburst|undefined'), gust: __seen.has('feather_black|210'),
            venom: window.__maxProj >= 2 };"""),
]


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    for name, build, slot, shots, check in CASES:
        g.battle(build)
        g.place_enemies(n=4, first=230, gap=70, hp=100000, speed=0, dps=0)
        used = g.js(REC + f"b.autoSkills = false; b.ultGauge = 1; b.skillCd['{slot}'] = 0; return b.useSkill('{slot}');")
        ctx.check(bool(used), f'{name}: 실제 스킬 발동')
        last = 0
        for i, t in enumerate(shots):
            g.wait(t - last)
            last = t
            g.shot(f'vfx4_{name}_{i}', '#screen-battle-v2')
        st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                  "for (let i = 0; i < 300; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                  "return r;")
        ctx.check(all(st.values()), f'{name}: 그림 층·판정 확인', str(st))
        g.wait(3000)

    # 비상 강하: 공중에서 다리도 몸과 같이 떠 있음 (다리 소켓 높이가 땅보다 위)
    g.battle(SET('chimera', 'u'))
    g.place_enemies(n=2, first=260, gap=70, hp=100000, speed=0, dps=0)
    st = g.js("""b.autoSkills = false; b.skillCd.body = 0; b.useSkill('body');
        let best = 0;
        for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 10));
            const f = m.getSocketPoint('footF', 'legF'), t = m.getSocketPoint('mouth', 'head');
            if (f) best = Math.max(best, f.bottom); }
        return { footUp: best };""")
    ctx.check(st.get('footUp', 0) > 90, '비상 강하: 발도 함께 날아오름 (발 높이 > 90 — 예전엔 땅에 남음)', str(st))

    # 새끼 거미 걷기 확대 캡처
    g.battle(SET('chimera', 'c'))
    g.place_enemies(n=1, first=420, gap=60, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.skillCd.body = 0; b.useSkill('body');")
    g.wait(900)
    g.shot('vfx4_spider_walk', '#screen-battle-v2')
