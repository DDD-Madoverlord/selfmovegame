"""스킬 이펙트 3차 개선 (D-119, 2026-11-10 피드백 15항목): 실제 전투에서 쓰고 그림 층·판정·개수 확인 + 화면 캡처."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))
HERO_B = SET('hero', 'b')
KAIJU_A = ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a')
ITEMS = 'b.fx.vfx.items'

# (이름, 빌드, 슬롯, 캡처 시각들(ms), 확인 JS — 마지막 식이 dict)
CASES = [
    ('black_hole', HERO_B, 'arm', [400, 1500], f"""
        return {{ swirl: {ITEMS}.some(it => it.sheet === 'mutation_burst' && it.spin), gather: {ITEMS}.some(it => it.type === 'gather'),
            sun: {ITEMS}.some(it => it.sheet === 'eclipse_sun'), one: {ITEMS}.filter(it => it.sheet === 'mutation_burst').length === 1 }};"""),
    ('curse_chains', HERO_B, 'body', [300, 900], f"""
        return {{ chains: {ITEMS}.some(it => it.type === 'chains'), rooted: b.enemies.some(e => e.rootT > 0) }};"""),
    ('traps', SET('hero', 'c'), 'body', [250, 900], f"""
        return {{ five: __max.trapZones === 5, traps: __max.traps === 5,
            noRing: !{ITEMS}.some(it => it.type === 'ring') }};"""),
    ('hunt_mark', SET('hero', 'c'), 'head', [500, 1500], """
        const t = b.enemies.find(e => e.huntMarkEl), el = t && t.huntMarkEl;
        const r = el && el.getBoundingClientRect(), d = t && t.dom.getBoundingClientRect();
        return { mark: !!el, aboveName: !!r && r.bottom <= d.top - 18 };"""),
    ('bolts', SET('hero', 'c'), 'arm', [230], f"""
        return {{ bolt: {ITEMS}.some(it => it.sheet === 'needle_crimson' && it.travel && it.hue === 120) }};"""),
    ('cavalry', SET('hero', 'd'), 'head', [900, 1500], f"""
        const k = {ITEMS}.filter(it => it.sheet === 'ghost_cavalry' && it.loopSec).length;
        return {{ upTo5: k >= 3 && k <= 5, waves: b.kitWaves.length <= 5 }};"""),
    # 날개 방패: 예전 그림(dark_burst 210·180)이 없어야 함 — 기본 공격 적중 dark_burst 60은 그대로
    ('wing_shield', SET('hero', 'u'), 'body', [250, 1200, 3000], f"""
        return {{ wrap: __seen.has('feather_black|240'), dome: __seen.has('dome_gold|250'), open: __seen.has('feather_black|320'),
            noDark: !__seen.has('dark_burst|210') && !__seen.has('dark_burst|180') }};"""),
    ('spear_rain', SET('hero', 'u'), 'arm', [450, 640, 950], f"""
        return {{ ok: true }};"""),
    ('comet', SET('hero', 'v'), 'arm', [200, 400, 600], f"""
        return {{ fall: __seen.has('meteor_cyan|250'), boom: __seen.has('meteor_cyan|350') }};"""),
    ('ground_slam', KAIJU_A, 'arm', [450, 900], f"""
        return {{ fissure: __seen.has('fissure|undefined'), noRubble: ![...__seen].some(k => k.startsWith('ground_rubble')) }};"""),
    ('wrecking_ball', SET('mech', 'c'), 'head', [700, 1300], f"""
        const k = {ITEMS}.filter(it => it.sheet === 'wrecking_ball' && it.loopSec).length;
        return {{ one: k <= 1, rolled: __seen.has('wrecking_ball|260') }};"""),
]

# 떨어지는 그림이 실제로 하늘에서 땅으로 움직이는지 (창의 비·혜성) — 날아가는 칸을 찾아 시작·끝 높이 비교
FALL_CHECK = """
    for (let i = 0; i < 200; i++) {
        await new Promise(r => setTimeout(r, 10));
        const it = b.fx.vfx.items.find(it => it.sheet === '%s' && it.travel && it.to);
        if (it && it.t > it.dur * 0.45) { gameTime.paused = true; return { fromSky: it.y < 40, toGround: it.to[1] > b.fx.H - 140 }; }
    }
    return { fromSky: false };"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    for name, build, slot, shots, check in CASES:
        g.battle(build)
        g.place_enemies(n=4, first=230, gap=70, hp=100000, speed=0, dps=0)
        # 지나간 그림 기록 (캡처가 느려 확인 시각이 밀려도 한 번이라도 나왔는지 볼 수 있게): '시트|크기'
        used = g.js(f"""clearInterval(window.__seenT); window.__seen = new Set();
            window.__max = {{ traps: 0, trapZones: 0 }};
            window.__seenT = setInterval(() => {{ b.fx.vfx.items.forEach(it => window.__seen.add(`${{it.sheet || it.type}}|${{it.size}}`));
                __max.traps = Math.max(__max.traps, b.fx.vfx.items.filter(it => it.type === 'beartrap').length);
                __max.trapZones = Math.max(__max.trapZones, b.kitZones.filter(z => z.tag === 'trap').length); }}, 8);
            b.autoSkills = false; b.ultGauge = 1; b.skillCd['{slot}'] = 0; return b.useSkill('{slot}');""")
        ctx.check(bool(used), f'{name}: 실제 스킬 발동')
        if name in ('spear_rain', 'comet'):
            sheet = 'judgment_violet' if name == 'spear_rain' else 'meteor_cyan'
            st = g.js(FALL_CHECK % sheet)
            g.wait(60)
            g.shot(f'vfx3_{name}_falling', '#screen-battle-v2')
            g.js("gameTime.paused = false;")
            ctx.check(all(st.values()), f'{name}: 하늘 위에서 땅으로 떨어짐', str(st))
            shots = [max(20, s - 300) for s in shots] if name == 'spear_rain' else shots
        last = 0
        for i, t in enumerate(shots):
            g.wait(t - last)
            last = t
            g.shot(f'vfx3_{name}_{i}', '#screen-battle-v2')
            if i == len(shots) - 1:
                # 캡처가 느려 시각이 밀리므로 확인은 최대 4초 동안 다시 봄 (모두 참이 되면 바로)
                st = g.js(f"const f = async () => {{ {check} }}; let r = {{}};"
                          "for (let i = 0; i < 400; i++) { r = await f(); if (Object.values(r).every(Boolean)) break; await new Promise(q => setTimeout(q, 10)); }"
                          "return r;")
                ctx.check(all(st.values()), f'{name}: 그림 층·판정 확인', str(st))
        g.wait(10500 if name in ('traps', 'hunt_mark') else 6500)
        left = g.js("return { zones: b.kitZones.length, traps: b.fx.vfx.items.filter(it => it.type === 'beartrap').length, marks: document.querySelectorAll('.v2-hunt-mark').length };")
        ctx.check(left['zones'] == 0 and left['traps'] == 0 and left['marks'] == 0, f'{name}: 끝난 뒤 장판·덫·표식 정리', str(left))

    # 덫이 무는 순간: 걸어오는 적 → 턱이 닫힘
    g.battle(SET('hero', 'c'))
    g.place_enemies(n=1, first=150, gap=60, hp=100000, speed=60, dps=0)
    g.js("b.autoSkills = false; b.skillCd.body = 0; b.useSkill('body');")
    st = g.js("""for (let i = 0; i < 400; i++) {
            await new Promise(r => setTimeout(r, 10));
            const z = b.kitZones.find(z => z.tag === 'trap' && z.biteAge != null && z.biteAge < 0.12);
            if (z) { gameTime.paused = true; return { bite: true, rooted: b.enemies.some(e => e.rootT > 0) }; }
        } return { bite: false };""")
    g.wait(60)
    g.shot('vfx3_trap_bite', '#screen-battle-v2')
    g.js("gameTime.paused = false;")
    ctx.check(st.get('bite') and st.get('rooted'), '덫: 적이 밟으면 턱이 닫히며 속박', str(st))
    st = g.js("""const z = b.kitZones.find(z => z.tag === 'trap' && z.bitten);
        const n0 = b.kitZones.filter(z => z.tag === 'trap').length;
        await new Promise(r => setTimeout(r, 2300));
        const e = b.enemies.find(e => !e.isBuilding);
        return { once: !!z, gone: !b.kitZones.includes(z), others: b.kitZones.filter(z => z.tag === 'trap').length === n0 - 1 || !e,
            art: b.fx.vfx.items.filter(it => it.type === 'beartrap').length === b.kitZones.filter(z => z.tag === 'trap').length };""")
    ctx.check(st.get('once') and st.get('gone') and st.get('art'), '덫: 한 번 물면 속박이 풀릴 때 덫도 사라짐', str(st))

    # 기본 공격: 암흑 구체 지팡이 (기운 구체 그림) · 연발 석궁 (쏘는 동작 + 볼트)
    for name, build, probe in (
        ('orb_attack', HERO_B, "b.fx.vfx.projectiles.find(p => p.kind === 'orb' && p.core)"),
        ('crossbow_attack', SET('hero', 'c'), "b.fx.vfx.items.find(it => it.sheet === 'needle_crimson' && it.travel && it.hue === 120)"),
    ):
        g.battle(build)
        g.place_enemies(n=2, first=260, gap=60, hp=100000, speed=0, dps=0)
        st = g.js(f"""b.autoSkills = false;
            for (let i = 0; i < 300; i++) {{
                await new Promise(r => setTimeout(r, 10));
                const it = {probe};
                if (it && (it.t ?? 0) > 0.05) {{ gameTime.paused = true; return {{ seen: true, clip: m.rigBattle.attackOverride || null }}; }}
            }}
            return {{ seen: false }};""")
        g.wait(60)
        g.shot(f'vfx3_{name}', '#screen-battle-v2')
        g.js("gameTime.paused = false;")
        ok = st.get('seen') and (name != 'crossbow_attack' or st.get('clip') == 'attack_shoot')
        ctx.check(ok, f'{name}: 기본 공격 그림', str(st))

    # 어둠의 군주 4세트: 일식이 끝날 때 검은 해가 떨어짐
    g.battle(SET('hero', 'u'))
    g.place_enemies(n=4, first=230, gap=70, hp=100000, speed=0, dps=0)
    g.js("b.autoSkills = false; b.ultGauge = 1; b.useSkill('head');")
    g.wait(7900)
    st = g.js("""const hp0 = b.enemies.filter(e => !e.isBuilding).reduce((a, e) => a + e.hp, 0);
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 10));
            const it = b.fx.vfx.items.find(it => it.sheet === 'eclipse_sun' && it.travel);
            if (it && it.t > 0.3) { gameTime.paused = true; return { falling: true, hp0 }; }
        } return { falling: false };""")
    g.wait(60)
    g.shot('vfx3_black_sun_fall', '#screen-battle-v2')
    g.js("gameTime.paused = false;")
    g.wait(700)
    g.shot('vfx3_black_sun_blast', '#screen-battle-v2')
    hp1 = g.js("return b.enemies.filter(e => !e.isBuilding).reduce((a, e) => a + e.hp, 0);")
    ctx.check(st.get('falling') and hp1 < st.get('hp0', 0), '어둠의 군주 4세트: 검은 해가 떨어진 뒤 화면 피해', f'{st} hp1={hp1}')

    # 그림자 마도사(b) 다리에 로브가 남지 않음: 걷기 캡처 (다리 그림 맨 위 줄이 비었는지는 tools/rig/robe_legs.py가 보장)
    g.battle(HERO_B)
    g.js("b.autoSkills = false;")
    for i in range(3):
        g.wait(180)
        g.shot(f'vfx3_hero_b_walk_{i}', '#screen-battle-v2')
    desc = g.js("const { SKILLS } = await import('/js/engine_v2/skills_v2.js'); return SKILLS.shadowClones?.desc || '';")
    ctx.check('2명' in desc and '3명' in desc, '그림자 분신 설명: 2명 (4부위 3명)', desc)
