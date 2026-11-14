"""강화 외 성장 (Q-006): 파츠 등급·드랍·조각·옵션, 스킬 레벨, 전술 모듈, 별·캐릭터 해금·계정 연구, 파견, 나이트메어 전장 변이, 저장"""
from test_stages import clear_stage_fast

ZONE1 = "(await import('/js/engine_v2/stages_v2.js')).CHAPTER1.stages.map(s => s.id)"
ALL = "(await import('/js/engine_v2/stages_v2.js')).STAGES.map(s => s.id)"   # 모든 스테이지 id (구역이 늘어도 그대로)
CLEAR = "{ stars: [true,true,true], cleared: true, bestTime: 60 }"
IMPORTS = """const G = await import('/js/engine_v2/growth_v2.js');
    const { ELITE_AFFIXES } = await import('/js/engine_v2/enemies_v2.js');"""


FREE = ('head_red_robot', 'body_red_robot', 'arm_red_robot', 'leg_red_robot')   # 기본 로봇 (연타 러시 = 'rush')


def fresh_battle(g, stage='1-2', build=FREE):
    g.js(f"progress.selectStage('{stage}');")
    g.battle(build, wait_ms=2900)
    g.js("b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ===== 1. 파츠 등급·드랍·조각·옵션 =====
    st = g.js(IMPORTS + """
        const seq = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2];   // 옵션 뽑기용 고정 난수
        let i = 0; const rnd = () => seq[i++ % seq.length];
        const a = progress.grantPart('arm_mech_laser', 'common', rnd);            // 없던 파츠 → 커먼으로 얻음
        const hp0 = progress.partStats({ id: 'arm_mech_laser', stats: { hp: 200, dps: 350 } }).dps;
        const b2 = progress.grantPart('arm_mech_laser', 'unique', rnd);           // 커먼 → 유니크 (옵션 2개)
        const hp1 = progress.partStats({ id: 'arm_mech_laser', stats: { hp: 200, dps: 350 } }).dps;
        const dm = gameState.darkMatter, sh = progress.shards;
        const c = progress.grantPart('arm_mech_laser', 'rare', rnd);              // 낮은 등급 → 환급
        return { a: a.type, b: b2.type, prev: b2.prev, opts: progress.optionsOf('arm_mech_laser').length, owned: progress.isOwned('arm_mech_laser'),
            c: c.type, dmGain: gameState.darkMatter - dm, shGain: progress.shards - sh, want: G.DROP.refund.rare,
            hp0, hp1, mul: G.GRADES[2].mul };""")
    ctx.check(st['a'] == 'new' and st['owned'], '드랍: 없던 파츠 → 그 등급으로 얻음', str(st))
    ctx.check(st['b'] == 'upgrade' and st['prev'] == 'common' and st['opts'] == 2, '드랍: 높은 등급 → 등급 상승 + 옵션 2개 (유니크)', str(st))
    ctx.check(st['c'] == 'refund' and st['dmGain'] == st['want']['dm'] and st['shGain'] == st['want']['shards'],
              '드랍: 같거나 낮은 등급 → DM·파츠 조각 환급', str(st))
    ctx.check(abs(st['hp1'] - round(st['hp0'] * st['mul'])) <= 1, f"등급 능력치: 유니크 ×{st['mul']}", str(st))

    st = g.js("""progress.shards = 100; progress.stones = 50; gameState.darkMatter = 500000;
        const cost = progress.shardUpgradeCost('arm_mech_laser');
        progress.levels['arm_mech_laser'] = cost.needLevel;   // 등급 올리기 전에 지금 등급 한도까지 강화 (D-124)
        const dm0 = gameState.darkMatter;
        const r = progress.upgradeGradeWithShards('arm_mech_laser');
        return { cost, r, grade: progress.gradeOf('arm_mech_laser'), shards: progress.shards, stones: progress.stones, dm: dm0 - gameState.darkMatter,
            max: progress.shardUpgradeCost('arm_mech_laser'), none: progress.shardUpgradeCost('arm_mech_missile') };""")
    ctx.check(st['cost']['grade'] == 'legendary' and st['r']['success'] and st['grade'] == 'legendary' and st['shards'] == 100 - st['cost']['shards']
              and st['stones'] == 50 - st['cost']['stones'] and st['dm'] == st['cost']['dm'] and st['max'] is None and st['none'] is None,
              '등급 올리기: 유니크 → 레전더리 (조각·DM·승급석 차감, D-124), 최고 등급·안 가진 파츠는 불가', str(st))

    st = g.js(IMPORTS + """
        const parts = gameState.getEquippedObjects();
        progress.options[parts.arm.id] = ['elite', 'reflectBlock', 'recharge'];
        progress.options[parts.head.id] = ['reflectBlock', 'recharge'];
        progress.options[parts.leg.id] = ['reflectBlock', 'ccResist', 'swift'];
        const t = progress.gearTotals(parts);
        return { t, caps: G.OPTION_CAPS };""")
    t = st['t']
    ctx.check(abs(t['eliteDmg'] - 0.15) < 1e-9 and t['reflectCut'] == st['caps']['reflectCut'] and abs(t['cdr'] - 0.16) < 1e-9 and t['speed'] == 0.08,
              '옵션 합계: 장착 파츠 옵션을 더하고 한도(반사 차단 90%)', str(t))

    # 드랍 판정: 난이도별 등급표·보스전 첫 클리어 확정 (고정 난수)
    st = g.js("""const r = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };
        const none = progress.rollBattleDrop({ character: 'mech', zone: 1, difficulty: 'normal', boss: false, firstClear: false }, r([0.9]));
        const n = progress.rollBattleDrop({ character: 'mech', zone: 1, difficulty: 'normal', boss: false, firstClear: false }, r([0.1, 0.0, 0.5, 0.5]));
        const h = progress.rollBattleDrop({ character: 'mech', zone: 1, difficulty: 'hard', boss: false, firstClear: false }, r([0.1, 0.3, 0.1, 0.5]));
        const nm = progress.rollBattleDrop({ character: 'mech', zone: 1, difficulty: 'nightmare', boss: false, firstClear: false }, r([0.1, 0.6, 0.5, 0.5]));
        const sure = progress.rollBattleDrop({ character: 'mech', zone: 1, difficulty: 'normal', boss: true, firstClear: true }, r([0.99, 0.2, 0.5]));
        const aff = [progress.isAffinity('mech', 1), progress.isAffinity('mech', 3), progress.isAffinity('chimera', 4)];
        return { none, n: n && n.grade, h: h && h.grade, nm: nm && nm.grade, sure: sure && sure.sure, aff,
            kinds: [n.type, h.type, nm.type, sure.type], amounts: [n.shards, nm.shards], boost: progress.researchBonus('shardBoost') };""")
    ctx.check(st['none'] is None and st['n'] == 'common' and st['h'] in ('rare', 'unique') and st['nm'] == 'legendary',
              '드랍 판정: 25% 밖이면 없음 · 노말 커먼 · 하드 레어/유니크 · 나이트메어 레전더리', str(st))
    ctx.check(st['sure'] and st['aff'] == [True, False, True], '보스전 첫 클리어는 확정 드랍 · 구역 상성(구역 1 거대로봇, 구역 4 합성괴인)', str(st))
    ctx.check(st['kinds'][:3] == ['shards'] * 3 and st['kinds'][3] != 'shards' and (st['boost'] > 0 or st['amounts'] == [2, 20]),
              '판 클리어 드랍 = 파츠 대신 공용 파츠 조각(노말 커먼 2 · 나이트메어 레전더리 20), 보스전 첫 클리어만 파츠 (11-05 피드백 23)', str(st))

    # 세트 장비 (Q-008): 등급 바닥 · 묶음 가중 드랍 · 보스 첫 클리어 세트 부위 · 조각 제작 · 드랍 전용 잠금 · 예전 저장
    st = g.js("""const S = await import('/js/engine_v2/sets_v2.js');
        const { PARTS_DB } = await import('/js/data/parts.js');
        const r = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };
        progress.owned.delete('arm_kaiju_a'); progress.owned.delete('arm_kaiju_b'); delete progress.grades.arm_kaiju_a;
        const floor = [progress.gradeOf('arm_kaiju_a'), progress.gradeOf('arm_kaiju'), S.minGradeOf('head_mech_b')];
        const arm = PARTS_DB.arm.find(p => p.id === 'arm_kaiju_a');
        const dps = progress.partStats(arm).dps, want = Math.round(arm.stats.dps * 1.1);
        // 묶음 가중: 노말은 기본·강화만, 하드 0.5 → 레어 세트(기본 40% 다음), 하드 보스 첫 클리어 → 레어 세트, 헬 첫 클리어 → 유니크 없으면 레어
        const kinds = diff => [0.05, 0.3, 0.45, 0.7, 0.95].map(v => S.dropGroupOf(progress.pickDropPart('kaiju', diff, {}, r([v, 0.5]))));
        const normal = kinds('normal'), hard = kinds('hard');
        const first = S.dropGroupOf(progress.pickDropPart('kaiju', 'hard', { prefer: ['rare', 'base'] }, r([0.5])));
        const hellFirst = S.dropGroupOf(progress.pickDropPart('kaiju', 'hell', { prefer: ['unique', 'rare', 'base'] }, r([0.5])));
        // 드랍으로 얻은 레어 세트 파츠는 커먼으로 뽑혀도 레어
        const got = progress.grantPart('arm_kaiju_b', 'common', r([0.3]));
        // 등급 단계 (11-03): 거대괴수 커먼 파츠를 3개 가져야 레어 세트를 만들 수 있음 → 커먼 없이 막히는 것을 본 뒤 3개를 줌
        const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
        const commons = SLOTS.flatMap(s => partsOfCharacter('kaiju', s)).filter(q => S.dropGroupOf(q) === 'base').map(q => q.id);
        commons.forEach(id => progress.owned.delete(id));
        progress.shards = 40;
        const tierLocked = progress.craftPart('arm_kaiju_a');
        commons.slice(0, 3).forEach(id => progress.owned.add(id));
        // 조각 제작
        progress.shards = 10;
        const c0 = progress.craftCost('arm_kaiju_a'), poor = progress.craftPart('arm_kaiju_a');
        progress.shards = 40;
        const made = progress.craftPart('arm_kaiju_a');
        const after = { owned: progress.isOwned('arm_kaiju_a'), shards: progress.shards, again: progress.craftCost('arm_kaiju_a'), base: progress.craftCost('arm_kaiju') };
        // 드랍 전용(유니크 세트 표시)은 DM으로 못 삼
        const p = PARTS_DB.leg.find(q => q.id === 'leg_kaiju_b'); progress.owned.delete('leg_kaiju_b'); p.dropOnly = true;
        const cart0 = { ...gameState.cartParts }; gameState.cartParts = { ...gameState.cartParts, leg: 'leg_kaiju_b' };
        const locked = progress.confirmCart(); gameState.cartParts = cart0; delete p.dropOnly;
        // 예전 저장: 산 A·B 세트 → 레어 + 옵션 1개
        const save = { ...progress.growthData(), options: {}, grades: {} };
        progress.owned.add('head_hero_a'); delete progress.options.head_hero_a;
        progress.loadGrowth(save);
        return { tierLocked: [tierLocked.success, tierLocked.reason || ''], floor, dps, want, normal, hard, first, hellFirst, got: [got.type, got.grade, progress.optionsOf('arm_kaiju_b').length],
            c0, poor: poor.success, made: [made.success, made.grade, made.shards], after, locked: locked.success, lockedWhy: locked.reason || '',
            old: [progress.gradeOf('head_hero_a'), progress.optionsOf('head_hero_a').length],
            label: S.setLabelOf(S.setOf('head_hero_a')) };""")
    ctx.check(st['floor'] == ['rare', 'common', 'rare'] and abs(st['dps'] - st['want']) <= 1,
              '세트 등급 바닥: A·B(레어 세트)는 안 가져도 레어, 능력치 ×1.1 · 기본 파츠는 커먼', str(st))
    ctx.check(set(st['normal']) == {'base'} and st['hard'] == ['base', 'base', 'rare', 'rare', 'rare'],
              '드랍 묶음 가중: 노말 기본·강화만 · 하드 기본 40% / 레어 세트 60%', str(st['normal']) + str(st['hard']))
    ctx.check(st['first'] == 'rare' and st['hellFirst'] == 'unique', '보스 첫 클리어: 하드 레어 세트 · 헬 유니크 (2차 세트로 거대괴수도 유니크가 생김)', str(st))
    ctx.check(st['got'] == ['new', 'rare', 1], '드랍: 레어 세트 파츠는 커먼으로 뽑혀도 레어 + 옵션 1개', str(st['got']))
    ctx.check(st['c0'] == {'shards': 30, 'grade': 'rare'} and not st['poor'] and st['made'] == [True, 'rare', 30]
              and st['after'] == {'owned': True, 'shards': 10, 'again': None, 'base': None},
              '조각 제작: 레어 세트 부위 30개 (부족하면 실패), 가진 파츠·기본 파츠는 불가', str(st))
    ctx.check(not st['tierLocked'][0] and '커먼 파츠를 3개' in st['tierLocked'][1],
              '등급 단계: 거대괴수 커먼 파츠가 3개 안 되면 레어 세트를 조각으로도 못 만듦', str(st['tierLocked']))
    ctx.check(not st['locked'] and '드랍·조각' in st['lockedWhy'], '드랍 전용 파츠는 개조 확정(DM 구매) 불가', st['lockedWhy'])
    ctx.check(st['old'] == ['rare', 1] and st['label'] == '레어 ① 타락 기사', '예전 저장: 산 A·B → 레어 + 옵션 1개 · 이름표 "레어 ① 타락 기사"', str(st))
    g.js("progress.options = {}; progress.grades = {};")

    # 전투: 옵션 효과 (엘리트 피해·보호막 파쇄·반사 차단·치유 방해·냉기 저항)
    g.js("progress.options = {}; progress.grades = {};")
    fresh_battle(g)
    base = g.js("""const e = b.spawnMinion('guard', { x: b.monsterX + 500, elite: true }); e.affixes = []; e.shield = 0;
        const h0 = e.hp; b.dealDamageToEnemy(e, 100, false); return h0 - e.hp;""")
    g.js("b.gear = { eliteDmg: 0.15, shieldDmg: 0.6, reflectCut: 0.6, healBlock: 3, ccCut: 0.3 }; b.roleTaken = 1; b.sigChar = null;")   # 근거리 받는 피해·고유 특성(D-121)은 빼고 옵션만 봄
    st = g.js(IMPORTS + """
        const e = b.spawnMinion('guard', { x: b.monsterX + 500, elite: true }); e.affixes = []; e.shield = 0;
        const h0 = e.hp; b.dealDamageToEnemy(e, 100, false); const elite = h0 - e.hp;
        const s = b.spawnMinion('guard', { x: b.monsterX + 520, elite: true }); s.affixes = []; s.shield = 160;
        b.dealDamageToEnemy(s, 100, false); const shieldLeft = s.shield;
        const th = b.spawnMinion('guard', { x: b.monsterX + 540, elite: true }); th.affixes = ['thorns'];
        const p0 = b.playerHp; b.dealDamageToEnemy(th, 2000, false, { knock: 0 }); const reflected = p0 - b.playerHp;
        const rg = b.spawnMinion('guard', { x: b.monsterX + 560, elite: true }); rg.affixes = ['regen']; rg.shield = 0;   // 무작위 보호막 속성이 붙어도 피해가 들어가게
        b.dealDamageToEnemy(rg, 50, false); rg.lastHit = -99; const r0 = rg.hp;
        b.pSlowT = 0; b.applyPlayerSlow(2);
        return { elite, shieldLeft, reflected, cap: b.maxPlayerHp * ELITE_AFFIXES.thorns.cap, blocked: rg.healBlockUntil > b.stats.time, r0, slow: b.pSlowT };""")
    ctx.check(abs(st['elite'] - base * 1.15) < 0.6, f"옵션 엘리트 사냥꾼: 엘리트 피해 ×1.15 ({base:.0f} → {st['elite']:.0f})", str(st))
    ctx.check(st['shieldLeft'] == 0, '옵션 보호막 파쇄: 피해 100이 보호막 160을 깸 (×1.6)', str(st))
    ctx.check(abs(st['reflected'] - st['cap'] * 0.4) < 1, '옵션 반사 차단: 가시 반사 피해 -60%', str(st))
    ctx.check(st['blocked'] and abs(st['slow'] - 1.4) < 1e-6, '옵션 치유 방해: 맞은 적 3초 재생 정지 표시 · 냉기 저항: 감속 2초 → 1.4초', str(st))
    g.wait(1500)
    regen = g.js("const rg = b.enemies.find(e => e.affixes?.includes('regen')); return rg ? [rg.hp, rg.maxHp] : null;")
    ctx.check(regen and regen[0] < regen[1], '치유 방해: 재생 엘리트가 3초 동안 회복 못 함', str(regen))

    # 보스전 첫 클리어 → 결과 화면에 확정 드랍 + 스킬 코어
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.js(f"{ZONE1}.filter(id => id !== '1-B').forEach(id => progress.stages[id] = {CLEAR});")
    fresh_battle(g, '1-B')
    g.js("b.loot.cores = 3;")
    clear_stage_fast(g, keep_hp=True)
    st = g.js("""return { loot: document.querySelector('.v2-result__loot')?.textContent || '', cores: progress.cores,
        part: !!document.querySelector('.v2-loot__part') };""")
    import re
    got = re.search(r'스킬 코어 \+(\d+)', st['loot'])
    ctx.check(st['part'] and '보스전 첫 클리어' in st['loot'] and got and int(got.group(1)) >= 3 and st['cores'] >= 3,
              '결과 화면: 보스전 첫 클리어 확정 파츠 + 스킬 코어 지급 (보스를 쓰러뜨려 이기므로 보스 코어도 더해짐 — 피드백 17)', ' '.join(st['loot'].split())[:120])
    g.shot('growth_result', '#screen-battle-v2')

    # ===== 2. 스킬 레벨 · 전술 모듈 =====
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    st = g.js(IMPORTS + """
        progress.cores = 200; gameState.darkMatter = 50000;
        const r = [1, 2, 3, 4].map(() => progress.upgradeSkill('rush'));
        const over = progress.upgradeSkill('rush');
        return { lv: progress.skillLevel('rush'), r: r.map(x => x.success), over: over.success, cores: progress.cores,
            spent: G.SKILL_LEVEL.cost.slice(1).reduce((s, c) => s + c.cores, 0) };""")
    ctx.check(st['lv'] == 5 and all(st['r']) and not st['over'] and st['cores'] == 200 - st['spent'],
              '스킬 강화: Lv1 → 5 (코어·DM 차감), 최대에서 더 못 올림', str(st))
    fresh_battle(g, '1-2')
    st = g.js("""const u = b.unit(), c = b.skillCaster('arm');
        b.spawnMinion('guard', { x: b.monsterX + 180, elite: false });
        const used = b.useSkill('arm');
        return { ratio: c.unit() / u, same: b.skillCaster('body') === b, used, cd: b.skillCd.arm, base: b.skills.arm.cd };""")
    ctx.check(abs(st['ratio'] - 1.4) < 1e-6 and st['same'], '스킬 Lv5: 스킬 피해 기준(unit) ×1.4, Lv1 스킬은 그대로', str(st))
    ctx.check(st['used'] and abs(st['cd'] - st['base'] * 0.8) < 1e-6, '스킬 Lv5: 쿨다운 ×0.8', str(st))

    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    st = g.js(IMPORTS + f"""
        progress.stages = {{}}; progress.spentStars = 0;   // 앞의 보스전 별을 지우고 별 0개에서
        const before = progress.buyModule('repair');
        {ZONE1}.forEach(id => progress.stages[id] = {CLEAR});
        const avail = progress.availableStars();
        const r1 = progress.buyModule('repair'), r2 = progress.buyModule('barrier'), dup = progress.buyModule('repair');
        return {{ before: before.success, avail, r1: r1.success, r2: r2.success, dup: dup.success, slots: progress.moduleSlots(),
            eq: progress.equippedModules(), left: progress.availableStars(), cost: G.MODULES.repair.stars + G.MODULES.barrier.stars }};""")
    ctx.check(not st['before'] and st['r1'] and st['avail'] == 33 and st['left'] == 33 - st['cost'] and not st['dup'],   # 구역 1 = 11판 × 별 3
              '전술 모듈: 별이 없으면 못 삼, 별로 해금(겹쳐 사지 않음)', str(st))
    ctx.check(st['slots'] == 1 and st['eq'] == ['repair'], '모듈 칸: 노말만 열리면 1칸 (먼저 산 긴급 수리가 끼워짐)', str(st))
    g.js(f"{ALL}.forEach(id => progress.stages[id] = {CLEAR}); progress.equipModule(1, 'barrier');")
    ctx.check(g.js("return [progress.moduleSlots(), progress.equippedModules()];") == [2, ['repair', 'barrier']],
              '모듈 칸: 하드가 열리면 2칸 (방벽 발생기를 2칸에)')

    fresh_battle(g, '1-2')
    st = g.js("""const dock = [...document.querySelectorAll('#skill-dock-v2 .v2-skill')].map(e => e.dataset.slot);
        b.playerHp = b.maxPlayerHp * 0.3;
        const h0 = b.playerHp; const ok = b.useSkill('mod1'); const healed = b.playerHp - h0;
        const ok2 = b.useSkill('mod2'); b.applyPlayerStun(2); const stun = b.pStunT;
        b.applyPlayerSlow(3); const slow = b.pSlowT;
        return { dock, ok, healed: healed / b.maxPlayerHp, cd: b.skillCd.mod1, ok2, stun, slow, immune: b.ccImmuneT };""")
    ctx.check(st['dock'] == ['arm', 'body', 'mod1', 'mod2', 'head'], 'HUD: 전술 모듈 2칸이 스킬 칸에 (키 4·5)', str(st['dock']))
    ctx.check(st['ok'] and abs(st['healed'] - 0.3) < 1e-6 and st['cd'] == 40, '긴급 수리: 내구도 30% 회복, 쿨다운 40초', str(st))
    ctx.check(st['ok2'] and st['stun'] == 0 and st['slow'] == 0 and st['immune'] > 5, '방벽 발생기: 6초간 기절·감속 면역', str(st))
    g.page.keyboard.press('4')
    g.wait(100)
    ctx.check(g.js("return b.skillCd.mod1 > 0;"), '키 4로 모듈 1 사용 (쿨다운 중이면 그대로)')

    # 나머지 모듈 효과: 정화 파동·궤도 지원 사격·시간 왜곡·과충전 (거점이 나오는 거리까지)
    g.js("b.distanceTraveled = b.stage.midAt - 0.5;")
    g.wait(900)
    st = g.js(IMPORTS + """
        const sk = (id) => { const s = { ...b.skills.mod1 }; return s; };
        const mods = await import('/js/engine_v2/battle/growth.js');
        progress.modules.owned.push('purify', 'orbital', 'timeWarp', 'overcharge');
        progress.equipModule(0, 'purify'); progress.equipModule(1, 'orbital');
        b.setupGrowth(gameState.getEquippedObjects());
        const e = b.spawnMinion('guard', { x: b.monsterX + 300, elite: true }); e.affixes = ['shielded', 'regen', 'swift']; e.shield = 300;
        b.useSkill('mod1');
        const purified = b.isPurified(e), shield = e.shield;
        const bd = b.enemies.find(x => x.isBuilding); bd.x = b.frontX() + 300; const bh = bd.hp;
        const ok = b.useSkill('mod2');
        return { purified, shield, ok, names: [b.skills.mod1.name, b.skills.mod2.name], bh };""")
    g.wait(400)
    st2 = g.js("const bd = b.enemies.find(x => x.isBuilding); return bd ? bd.hp : -1;")
    ctx.check(st['purified'] and st['shield'] == 0, '정화 파동: 앞쪽 엘리트 효과 끔 (보호막 제거)', str(st))
    ctx.check(st['ok'] and st2 < st['bh'], '궤도 지원 사격: 가까운 거점에 큰 피해', f"{st['bh']} → {st2}")
    st = g.js("""progress.equipModule(0, 'timeWarp'); progress.equipModule(1, 'overcharge'); b.setupGrowth(gameState.getEquippedObjects());
        const es = [0, 1, 2].map(i => b.spawnMinion('guard', { x: b.monsterX + 300 + i * 40, elite: false }));
        b.ultGauge = 0.3; b.useSkill('mod1'); b.useSkill('mod2');
        return { slowed: es.every(e => e.slowT >= 4.9), gauge: b.ultGauge };""")
    ctx.check(st['slowed'] and abs(st['gauge'] - 0.65) < 1e-6, '시간 왜곡: 적 모두 5초 감속 · 과충전: 필살기 게이지 +35%', str(st))
    st = g.js("""const r1 = progress.upgradeModule('timeWarp'), r2 = progress.upgradeModule('timeWarp'), r3 = progress.upgradeModule('timeWarp');
        b.setupGrowth(gameState.getEquippedObjects());
        return { r: [r1.success, r2.success, r3.success], lv: progress.moduleLevel('timeWarp'), cd: b.skills.mod1.cd };""")
    ctx.check(st['r'] == [True, True, False] and st['lv'] == 3 and abs(st['cd'] - 35 * 0.8) < 1e-6, '모듈 강화: Lv3까지 DM, 쿨다운 -10%씩 (35 → 28초)', str(st))

    # ===== 3. 별·캐릭터 해금·계정 연구·파견 =====
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    st = g.js("""const total = progress.totalStars();
        const spent = progress.spentStars;
        const a = progress.isCharacterUnlocked('kaiju'); const r = progress.unlockCharacter('kaiju');
        const doll = progress.isCharacterUnlocked('doll');
        const keep = progress.stages['6-B'];
        delete progress.stages['6-B'];   // 6-B를 안 깬 것으로: 7-1이 안 열림 → 인형사 아직
        progress.unlockedChars = progress.unlockedChars.filter(id => id !== 'doll');
        const dollAfter = progress.isCharacterUnlocked('doll');
        progress.stages['6-B'] = keep;
        return { total, a, r: r.success, stars: progress.spentStars - spent, doll, dollAfter, mech: progress.isCharacterUnlocked('mech') };""")
    ctx.check(st['total'] == 330 and st['a'] and st['r'] and st['stars'] == 0 and st['doll'] and not st['dollAfter'] and st['mech'],
              '별: 노말 110판 × 3 = 330개 · 캐릭터는 별을 안 씀(D-119): 구역 n-1이 열리면 합류(거대괴수·인형사), 6-B를 안 깼으면 인형사 잠김 · 거대로봇은 처음부터', str(st))
    st = g.js(f"""progress.spentStars = 0;
        for (const d of ['hard', 'hell']) ({ALL}).forEach(id => progress.recordsOf(d)[id] = {CLEAR});
        const avail = progress.availableStars();
        const r = progress.buyResearch('dmBoost'); progress.buyResearch('dropRate'); progress.buyResearch('dispatchSlot');
        return {{ avail, r: r.success, dm: progress.researchBonus('dmBoost'), drop: progress.researchBonus('dropRate'), slots: progress.dispatchSlots() }};""")
    ctx.check(st['avail'] == 990 and st['r'] and abs(st['dm'] - 0.05) < 1e-9 and abs(st['drop'] - 0.01) < 1e-9 and st['slots'] == 4,
              '계정 연구: 별로 DM +5% · 드랍 +1%p · 파견 칸 +1 (나이트메어까지 열림 = 3칸 + 1)', str(st))
    fresh_battle(g, '1-2')
    st = g.js("const { stageById } = await import('/js/engine_v2/stages_v2.js'); return [b.stage.reward.final, stageById('1-2').reward.final];")
    ctx.check(st[0] == round(st[1] * 1.05), '연구 DM 정제: 전투 보상 +5%', str(st))

    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    st = g.js("""progress.selectCharacter('mech');
        const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
        SLOTS.forEach(s => progress.owned.add(partsOfCharacter('kaiju', s)[0].id));
        const self = progress.startDispatch('mech', 1, 1000);
        const lock = progress.startDispatch('doll', 1, 1000);
        const ok = progress.startDispatch('kaiju', 2, 1000);
        const dup = progress.startDispatch('kaiju', 1, 1000);
        const early = progress.collectDispatch(0, 2000);
        const end = progress.dispatch[0].end;
        const dm = gameState.darkMatter, sh = progress.shards, co = progress.cores;
        const done = progress.collectDispatch(0, end + 1, () => 0.9);
        return { self: self.success, lock: lock.success, ok: ok.success, dup: dup.success, early: early.success,
            hours: (end - 1000) / 3600000, done, dmGain: gameState.darkMatter - dm, left: progress.dispatch.length };""")
    ctx.check(not st['self'] and not st['lock'] and st['ok'] and not st['dup'], '파견: 출전 중·잠긴·이미 보낸 캐릭터는 못 보냄', str(st))
    ctx.check(not st['early'] and abs(st['hours'] - 3) < 1e-9 and st['done']['success'] and st['dmGain'] == 3000 and st['left'] == 0,
              '파견: 3시간 전에는 못 받고, 끝나면 구역 2 보상 (DM 3,000 · 조각 · 코어)', str(st))

    g.js("progress.startDispatch('kaiju', 1, Date.now()); window.madOverlordGameV2.switchScreen('select');")
    g.wait(1000)
    g.page.click('.v2-charcard[data-char="kaiju"]')
    g.wait(300)
    st = g.js("return { ch: progress.character, foot: document.querySelector('.v2-charcard[data-char=\"kaiju\"] .v2-charcard__foot').textContent };")
    ctx.check(st['ch'] == 'mech' and '파견 중' in st['foot'], '선택창: 파견 중인 캐릭터는 못 고름', str(st))
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # 작전 지원 창 (메인 버튼): 세 탭
    g.page.click('#btn-menu-support-v2')
    g.wait(300)
    tabs = []
    for t in ('modules', 'dispatch', 'research'):
        g.page.click(f'.v2-growth__tabs [data-tab="{t}"]')
        g.wait(150)
        tabs.append(g.js("return document.querySelector('.v2-growth__body').children.length;"))
    g.shot('growth_panel')
    g.page.keyboard.press('Escape')
    g.wait(200)
    ctx.check(all(n > 0 for n in tabs) and not g.js("return !!document.querySelector('.v2-growth');"),
              '작전 지원 창: 전술 모듈·파견·계정 연구 탭, Esc로 닫힘', str(tabs))

    # ===== 4. 나이트메어 전장 변이 =====
    st = g.js("""const { weeklyMutator, MUTATOR_ORDER } = await import('/js/engine_v2/growth_v2.js');
        const { stageFor } = await import('/js/engine_v2/difficulty_v2.js');
        const { stageById } = await import('/js/engine_v2/stages_v2.js');
        const wk = 7 * 24 * 3600 * 1000, t0 = Date.UTC(2026, 9, 19);
        const seq = [0, 1, 2, 3, 4, 5, 6].map(i => weeklyMutator(t0 + i * wk));
        const n = stageFor(stageById('2-2'), 'nightmare', t0), h = stageFor(stageById('2-2'), 'hell', t0);
        const re = stageFor(stageById('2-2'), 'nightmare', t0 + MUTATOR_ORDER.indexOf('reinforce') * wk - MUTATOR_ORDER.indexOf(weeklyMutator(t0)) * wk);
        return { seq, uniq: new Set(seq.slice(0, 6)).size, wrap: seq[6] === seq[0], n: n.mutator, h: h.mutator,
            reSpawn: re.enemy.spawn, base: stageById('2-2').enemy.spawn, reMut: re.mutator };""")
    ctx.check(st['uniq'] == 6 and st['wrap'] and st['n'] == st['seq'][0] and st['h'] is None,
              '전장 변이: 주마다 6종이 돌아가며, 나이트메어에만', str(st))
    ctx.check(st['reMut'] == 'reinforce' and abs(st['reSpawn'] - st['base'] * 0.85) < 0.011, '증원 변이: 적 소환 간격 ×0.85', str(st))
    g.js("progress.recordsOf('hell')['4-B'] = " + CLEAR + "; progress.selectDifficulty('nightmare');")
    fresh_battle(g, '1-2')
    st = g.js(IMPORTS + """
        const res = {};
        b.mutator = null; const cd0 = b.skillCooldown('arm', b.skills.arm);   // 변이 없을 때 (스킬 Lv5 단축 포함)
        for (const id of ['icefloor', 'overload', 'ironwall']) {
            b.mutator = { id, ...G.MUTATORS[id] };
            res[id] = id === 'icefloor' ? b.gearMoveMul() : id === 'overload' ? b.skillCooldown('arm', b.skills.arm) / cd0
                : b.gearDamageMul({ isBuilding: true });
        }
        b.mutator = { id: 'bloodmoon', ...G.MUTATORS.bloodmoon }; b.roleTaken = 1; b.sigChar = null;   // 변이 피해만 봄 (D-121 역할·고유 특성 제외)
        const e = b.spawnMinion('guard', { x: b.monsterX + 40, elite: false }); const p0 = b.playerHp;
        b.dealDamageToEnemy(e, 1e6, false); const blast = p0 - b.playerHp;
        return { res, blast: blast / b.maxPlayerHp, hud: document.getElementById('hud-stage-v2').textContent, mut: b.stage.mutator };""")
    r = st['res']
    ctx.check(abs(r['icefloor'] - 0.85) < 1e-6 and abs(r['overload'] - 1.2) < 1e-6 and abs(r['ironwall'] - 0.8) < 1e-6,
              '변이 효과: 얼음 바닥 진격 ×0.85 · 과부하 쿨다운 ×1.2 · 철벽 거점 피해 ×0.8', str(r))
    ctx.check(abs(st['blast'] - 0.02) < 1e-6 and st['mut'], '핏빛 달: 가까운 적이 쓰러지면 내구도 -2%, 나이트메어 전투에 이번 주 변이', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    ctx.check('이번 주 변이' in g.js("return document.getElementById('menu-diffnote-v2').textContent;"), '메인 레이더: 나이트메어 이번 주 변이 표시')

    # ===== 5. 저장 → 다시 열기 =====
    g.js("progress.grades['arm_mech_laser'] = 'legendary'; progress.options['arm_mech_laser'] = ['elite', 'siege']; progress.save();")
    g.reload_v2()
    st = g.js("""return { grade: progress.gradeOf('arm_mech_laser'), opts: progress.optionsOf('arm_mech_laser').length, rush: progress.skillLevel('rush'),
        mods: progress.modules.owned.length, research: progress.researchLevel('dmBoost'), unlocked: progress.unlockedChars.includes('kaiju'),
        dispatch: progress.dispatch.length, shards: progress.shards >= 0, cores: progress.cores >= 0 };""")
    ctx.check(st['grade'] == 'legendary' and st['opts'] == 2 and st['rush'] == 5 and st['mods'] >= 6 and st['research'] == 1
              and st['unlocked'] and st['dispatch'] == 1, '저장: 등급·옵션·스킬 레벨·모듈·연구·해금·파견이 다시 열어도 유지', str(st))
    # 예전 저장(성장 필드 없음): 돈 주고 산 파츠가 있는 캐릭터는 열린 것으로 옮김
    st = g.js("""const raw = JSON.parse(localStorage.getItem('mo_v2_save'));
        ['grades','options','shards','cores','skillLevels','modules','research','spentStars','unlockedChars','dispatch'].forEach(k => delete raw[k]);
        raw.owned = [...new Set([...(raw.owned || []), 'body_hero'])];
        raw.stages = {};   // 노말 기록 없음 — 구역 도착 합류(D-119)가 아니라 예전 저장 옮기기로만 열리는지 보려고
        localStorage.setItem('mo_v2_save', JSON.stringify(raw));
        return true;""")
    g.reload_v2()
    st = g.js("return { hero: progress.isCharacterUnlocked('hero'), doll: progress.isCharacterUnlocked('doll'), cores: progress.cores, mods: progress.modules.owned };")
    ctx.check(st['hero'] and not st['doll'] and st['cores'] == 0 and st['mods'] == [], '예전 저장 읽기: 성장 필드는 빈 값, 몸통을 산 히어로는 열림', str(st))
    ctx.check(not g.errors, '페이지 오류 없음', '; '.join(g.errors[:3]))
