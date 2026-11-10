"""원거리·근거리 차등 · 관통 2차 하향 · 캐릭터 고유 특성 (D-119 ② 단계 — 기획서 4·13·6번, Q-039·040 임시 = 사용자 요청 값).
- 팔의 공격 종류로 나눔: 근거리 이동 ×2 · 받는 피해 −25% · 공격 ×1.2 · 휩쓸기 110px·75% / 원거리 이동 ×0.5 · 받는 피해 +20% · 공격 ×0.85 / 중거리(물줄기·바늘·산탄) 그대로
- 방어력(받는 피해 감소율)을 연구소에 표시, 관통(파동·레일건·물줄기)은 두 번째부터 ×0.3 · 최대 4명
- 캐릭터 고유 특성 10종 (battle/traits.js)"""

PARTS = """const { PARTS_DB } = await import('/js/data/parts.js'); const R = await import('/js/engine_v2/role_v2.js');
const T = await import('/js/engine_v2/battle/tuning.js');
const part = id => ['head', 'body', 'arm', 'leg'].map(s => PARTS_DB[s].find(p => p.id === id)).find(Boolean);"""


def line_up(g, n=6, gap=36, first=150, hp=99999):
    """주인공 앞에 적 n마리를 한 줄로 (움직이지 않음, 체력 많음)"""
    return g.js(f"""b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);
        const es = [];
        for (let i = 0; i < {n}; i++) {{ const e = b.spawnMinion('guard', {{ x: b.frontX() + {first} + i * {gap}, elite: false }}); e.speed = 0; e.hp = e.maxHp = {hp}; e.dps = 0; e.armor = 0; es.push(e); }}
        window.__es = es; return es.length;""")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(PARTS + """const sniper = PARTS_DB.arm.find(p => p.shotFx);
        const ids = ['arm_red_robot', 'arm_mech_laser', 'arm_mech_missile', 'arm_mech_a', 'arm_mech_b', 'arm_hero_wave', 'arm_hero_a', 'arm_kaiju_b',
            'arm_chimera_b', 'arm_diver', 'arm_diver_up', 'arm_saint', 'arm_frost', 'arm_doll', 'arm_architect', 'arm_broadcaster'];
        return { ...Object.fromEntries(ids.map(id => [id, R.roleOfArm(part(id))])), sniper: sniper ? R.roleOfArm(sniper) : 'none', none: R.roleOfArm(null) };""")
    want = {'arm_red_robot': 'melee', 'arm_mech_laser': 'ranged', 'arm_mech_missile': 'ranged', 'arm_mech_a': 'ranged', 'arm_mech_b': 'melee',
            'arm_hero_wave': 'ranged', 'arm_hero_a': 'melee', 'arm_kaiju_b': 'ranged', 'arm_chimera_b': 'mid', 'arm_diver': 'mid', 'arm_diver_up': 'mid',
            'arm_saint': 'mid', 'arm_frost': 'ranged', 'arm_doll': 'melee', 'arm_architect': 'melee', 'arm_broadcaster': 'ranged', 'sniper': 'ranged', 'none': 'melee'}
    ctx.check(st == want, '팔 공격 종류로 나눔: 주먹·대검·가위·드릴 = 근거리 / 레이저·미사일·레일건·파동·침·서리·음파·저격포 = 원거리 / 물줄기·바늘·산탄 = 중거리 (강화 물줄기도 중거리)', str({k: v for k, v in st.items() if want.get(k) != v}))

    st = g.js(PARTS + """const objs = ids => Object.fromEntries(['head', 'body', 'arm', 'leg'].map((s, i) => [s, part(ids[i])]));
        const raw = o => ['head', 'body', 'arm', 'leg'].reduce((a, s) => ({ dps: a.dps + o[s].stats.dps, speed: a.speed + o[s].stats.speed }), { dps: 0, speed: 0 });
        const out = {};
        for (const [k, ids] of Object.entries({ fist: ['head_red_robot', 'body_red_robot', 'arm_red_robot', 'leg_red_robot'], laser: ['head_red_robot', 'body_red_robot', 'arm_mech_laser', 'leg_red_robot'],
                diver: ['head_diver', 'body_diver', 'arm_diver', 'leg_diver'] })) {
            const o = objs(ids), s = progress.statsFor(o), r = raw(o);
            out[k] = { role: s.role, armor: s.armor, speed: s.speed, dps: s.dps, rawSpeed: r.speed, rawDps: r.dps };
        }
        return { out, M: T.ROLE.melee, Rg: T.ROLE.ranged };""")
    o, M, Rg = st['out'], st['M'], st['Rg']
    jsround = lambda v: int(v + 0.5)   # JS Math.round (파이썬 round는 .5를 짝수로)
    ctx.check(o['fist']['role'] == 'melee' and o['fist']['armor'] == 25 and o['fist']['speed'] == jsround(o['fist']['rawSpeed'] * M['move'])
              and abs(o['fist']['dps'] - o['fist']['rawDps'] * M['dps']) <= 2,
              f"근거리(주먹 로봇) 능력치: 이동 ×{M['move']} · 공격 ×{M['dps']} · 방어력 25%", str(o['fist']))
    ctx.check(o['laser']['role'] == 'ranged' and o['laser']['armor'] == -20 and o['laser']['speed'] == jsround(o['laser']['rawSpeed'] * Rg['move'])
              and abs(o['laser']['dps'] - o['laser']['rawDps'] * Rg['dps']) <= 2,
              f"원거리(레이저 로봇) 능력치: 이동 ×{Rg['move']} · 공격 ×{Rg['dps']} · 방어력 −20%", str(o['laser']))
    ctx.check(o['diver']['role'] == 'mid' and o['diver']['armor'] == 0 and o['diver']['speed'] == o['diver']['rawSpeed'] and o['diver']['dps'] == o['diver']['rawDps'],
              '중거리(길잡이 물줄기): 보정 없음', str(o['diver']))

    # 전투: 속도·받는 피해가 능력치와 같음
    g.battle('kaiju', wait_ms=2200)
    st = g.js("""const s = progress.statsFor(gameState.getEquippedObjects()); b.shieldHp = 0; b.supportShield = 0;
        const hp = b.playerHp; b.damagePlayer(100, 0); const lost = hp - b.playerHp;
        return { speed: b.playerSpeed, want: s.speed, lost, role: s.role };""")
    ctx.check(st['role'] == 'melee' and st['speed'] == st['want'] and abs(st['lost'] - 75) < 0.01, '전투(거대괴수 근거리): 진격 속도 = 표시 속도, 100 피해 → 75만 받음', str(st))
    st = g.js("""const T = await import('/js/engine_v2/battle/tuning.js'); return [T.MELEE_CLEAVE.radius, T.MELEE_CLEAVE.mul];""")
    ctx.check(st == [110, 0.75], '근거리 휩쓸기 반경 110px · 둘레 피해 75%', str(st))
    st = g.js("return b.sigTargetMul({ isBuilding: true }) === 1.3 && b.sigTargetMul({}) === 1;")
    ctx.check(st, '고유 특성 거대괴수 산성 부식: 거점 피해 +30%')

    # 원거리 서리: 받는 피해 +20%, 빙결 적 +20%
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.js("progress.unlockedChars.push('frost'); progress.selectCharacter('frost'); const ids = ['head_frost', 'body_frost', 'arm_frost', 'leg_frost']; ['head', 'body', 'arm', 'leg'].forEach((s, i) => { progress.owned.add(ids[i]); gameState.equippedParts[s] = ids[i]; }); gameState.notify();")
    g.battle(None, wait_ms=2200)
    st = g.js("""b.shieldHp = 0; b.supportShield = 0; b.blizzard = null; const hp = b.playerHp; b.damagePlayer(100, 0);
        return { lost: hp - b.playerHp, frozen: b.sigTargetMul({ frozenT: 1 }), char: b.sigChar };""")
    ctx.check(st['char'] == 'frost' and abs(st['lost'] - 120) < 0.01 and abs(st['frozen'] - 1.2) < 1e-9,
              '전투(서리의 무희 원거리): 100 피해 → 120 받음 · 고유 특성 얼린 적 +20%', str(st))

    # 관통: 어둠 파동·레일건·물줄기 — 두 번째부터 ×0.3, 최대 4명
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    for build, char, label in [("['head_hero', 'body_hero', 'arm_hero_wave', 'leg_hero_hover']", 'hero', '어둠 파동'),
                               ("['head_red_robot', 'body_red_robot', 'arm_mech_a', 'leg_red_robot']", 'mech', '레일건'),
                               ("['head_diver', 'body_diver', 'arm_diver', 'leg_diver']", 'diver', '물줄기')]:
        g.js(f"progress.unlockedChars.push('{char}'); progress.selectCharacter('{char}'); const ids = {build}; ['head', 'body', 'arm', 'leg'].forEach((s, i) => {{ progress.owned.add(ids[i]); gameState.equippedParts[s] = ids[i]; }}); gameState.notify();")
        g.battle(None, wait_ms=2000)
        line_up(g, n=6, gap=30, first=60)
        # 기본 공격 한 번이 준 '바로 맞는' 피해만 모음 (저주 장판 같은 지속 피해 dot는 뺌)
        g.js("""window.__es.forEach(e => { e.hp = e.maxHp; }); window.__hits = new Map();
            const o = b.dealDamageToEnemy; b.dealDamageToEnemy = function (e, d, c, r) { if (!(r && r.dot) && window.__es.includes(e)) window.__hits.set(e, (window.__hits.get(e) || 0) + d); return o.call(this, e, d, c, r); };
            b.fireAttack(window.__es[0]);""")
        g.wait(1200)
        st = g.js("delete b.dealDamageToEnemy; return window.__es.map(e => Math.round(window.__hits.get(e) || 0));")
        hit = [d for d in st if d > 0]
        ratio = (hit[1] / hit[0]) if len(hit) > 1 and hit[0] else 0
        ctx.check(len(hit) <= 4 and len(hit) >= 2 and abs(ratio - 0.3) < 0.06, f'{label}: 관통은 최대 4명, 두 번째 적은 ×0.3', str(st))
        g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
        g.wait(300)

    # 고유 특성: 방송자 기본 공격 침묵 · 성녀 표식 적 처치 회복 · 합성괴인 졸개 공격력 · 거대로봇 주먹 받는 피해
    st = g.js("""progress.unlockedChars.push('broadcaster', 'saint', 'chimera');
        const r = {};
        b.sigChar = 'broadcaster'; const e = { isBuilding: false, boss: false }; let st = null; const k = b.kitStatus; b.kitStatus = (x, s) => { st = s; }; b.sigOnBasicHit(e); b.kitStatus = k; r.silence = st && st.silence;
        b.sigChar = 'saint'; b.maxPlayerHp = 1000; b.playerHp = 500; b.sigOnKill({ stitchT: 2 }); r.heal = b.playerHp - 500;
        b.sigChar = 'chimera'; r.ally = b.sigAllyMul();
        b.sigChar = 'mech'; b.sigRole = 'melee'; r.guard = b.sigIncomingMul(); b.sigRole = 'ranged'; b.isAttacking = true; r.anchor = b.sigTargetMul({}); b.isAttacking = false; r.walk = b.sigTargetMul({});
        b.sigChar = 'architect'; r.arch = b.sigTargetMul({ isBarricade: true });
        b.sigChar = 'hero'; r.hero = b.sigTargetMul({ slowT: 1 }); b.sigChar = 'diver'; r.diver = b.sigTargetMul({ stunT: 1 }); b.sigChar = 'doll'; r.doll = b.sigTargetMul({ stunT: 1 });
        return r;""")
    ctx.check(st['silence'] == 1 and abs(st['heal'] - 20) < 0.01 and abs(st['ally'] - 1.25) < 1e-9,
              '고유 특성: 방송자 기본 공격 → 1초 침묵 · 성녀 표식 적 처치 → 내구도 2% · 합성괴인 졸개 공격 +25%', str(st))
    ctx.check(abs(st['guard'] - 0.9) < 1e-9 and abs(st['anchor'] - 1.15) < 1e-9 and st['walk'] == 1 and abs(st['arch'] - 1.25) < 1e-9
              and abs(st['hero'] - 1.12) < 1e-9 and abs(st['diver'] - 1.15) < 1e-9 and abs(st['doll'] - 1.2) < 1e-9,
              '고유 특성: 거대로봇 주먹 받는 피해 −10% · 멈춰 쏠 때 +15% · 설계자 거점 +25% · 히어로 감속 적 +12% · 길잡이 +15% · 인형사 +20%', str(st))

    # 연구소: 방어력 줄 + 유형 안내
    g.js("progress.selectCharacter('mech'); gameState.resetCartToEquipped(); window.madOverlordGameV2.switchScreen('lab');")
    g.wait(600)
    st = g.js("const el = document.getElementById('lab-compare-v2'); return el ? el.textContent : '';")
    ctx.check('방어력' in st and ('근거리' in st or '원거리' in st or '중거리' in st), '연구소 능력치: 방어력 줄 · 근거리/원거리 유형과 배율 안내', st[:160])
    g.shot('role_lab', '#screen-lab-v2')
