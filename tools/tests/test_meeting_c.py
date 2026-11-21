"""묶음 B 등급 체계 개편 (2026-11-22, Q-053 → D-158 · 설계서 Claude Docs):
② 등급 고유 능력치 — 팔 공격 속도 · 근거리 방어 무시 / 원거리 사거리 / 중거리 둘 다 절반 · 몸통 넉백 저항 · 머리 상태이상 저항
⑤ 다리 표 기준 140 (70 / 112 / 168 / 210) + 진격 속도 상한 240 · ③ 원거리 받는 피해 ×1.1 · 공격 ×0.9 · 근거리 특징 · 사거리 기준
⑧ 밸런스 조절 패널 '등급' 묶음 (지금 장착 값 · 등급 고정 · 등급 표 · 다리 기준 · 상한 · 세기 · 근거리 특징)"""

RARE_KAIJU = ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a')   # 근거리 레어 세트
RARE_MECH = ('head_mech_a', 'body_mech_a', 'arm_mech_a', 'leg_mech_a')         # 원거리 레어 세트
FREE_MECH = ('head_red_robot', 'body_red_robot', 'arm_red_robot', 'leg_red_robot')
LT = "const { liveTune: LT } = await import('/js/engine_v2/liveTune_v2.js');"


def objs(ids):
    return "{ " + ", ".join(f"{s}: PARTS_DB.{s}.find(p => p.id === '{i}')" for s, i in zip(('head', 'body', 'arm', 'leg'), ids)) + " }"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    P = "const { PARTS_DB } = await import('/js/data/parts.js');"

    # ---- 표 값 ----
    st = g.js("""const G = await import('/js/engine_v2/growth_v2.js'); const T = await import('/js/engine_v2/battle/tuning.js');
        return { leg: G.GRADES.map(g => g.legSpeed), atk: G.GRADES.map(g => g.atkSpd), pierce: G.GRADES.map(g => g.pierce), range: G.GRADES.map(g => g.rangeBonus),
            knock: G.GRADES.map(g => g.knockCut), cc: G.GRADES.map(g => g.ccCut), cap: G.LEG.cap, base: G.LEG.base, ranged: T.ROLE.ranged, melee: T.MELEE_FEATURE };""")
    ctx.check(st['leg'] == [70, 112, 168, 210] and st['base'] == 140 and st['cap'] == 240,
              '다리 표 = 기준 140 × 0.5 / 0.8 / 1.2 / 1.5 = 70 · 112 · 168 · 210, 진격 속도 상한 240', str(st))
    ctx.check(st['atk'] == [1, 1.05, 1.1, 1.15] and st['pierce'] == [0, 0.15, 0.3, 0.45] and st['range'] == [0, 20, 40, 60]
              and st['knock'] == [0, 0.25, 0.5, 0.75] and st['cc'] == [0, 0.1, 0.2, 0.3],
              '등급 고유 능력치 표: 공격 속도 ×1.00~1.15 · 방어 무시 0~45% · 사거리 +0~60 · 넉백 저항 0~75% · 상태이상 저항 0~30%', str(st))
    ctx.check(st['ranged'] == {'move': 1, 'taken': 1.1, 'dps': 0.9} and st['melee']['type'] == {'mech': 'building', 'chimera': 'building', 'kaiju': 'monster', 'hero': 'monster'}
              and st['melee']['building'] == 0.25 and st['melee']['monster'] == 0.15,
              '원거리 받는 피해 ×1.1 · 공격 ×0.9 · 근거리 특징 건물형(거대로봇 · 합성괴인 +25%) / 몬스터형(거대괴수 · 타락 히어로 +15%)', str(st))

    # ---- 조합별 고유 능력치 · 사거리 · 진격 속도 ----
    st = g.js(P + f"""const t = o => {{ const s = progress.statsFor(o); return {{ ...s.traits, range: s.range, speed: s.speed, role: s.role }}; }};
        const mid = {objs(('head_chimera', 'body_chimera', 'arm_chimera_b', 'leg_chimera'))};
        return {{ kaiju: t({objs(RARE_KAIJU)}), mech: t({objs(RARE_MECH)}), free: t({objs(FREE_MECH)}), mid: t(mid), midArm: mid.arm.stats.range }};""")
    k, m, f, md = st['kaiju'], st['mech'], st['free'], st['mid']
    ctx.check(k['role'] == 'melee' and k['atkSpd'] == 1.05 and abs(k['pierce'] - 0.15) < 1e-9 and k['rangeBonus'] == 0 and k['knockCut'] == 0.25 and abs(k['ccCut'] - 0.1) < 1e-9,
              '근거리 레어 세트(가시 갑각): 공격 속도 ×1.05 · 방어 무시 15% · 사거리 보너스 없음 · 넉백 25% · 상태이상 10%', str(k))
    ctx.check(m['role'] == 'ranged' and m['pierce'] == 0 and m['rangeBonus'] == 20 and m['range'] == 380,
              '원거리 레어 세트(포격 사령부): 방어 무시 없음 · 사거리 360 + 20 = 380', str(m))
    ctx.check(md['role'] == 'mid' and abs(md['pierce'] - 0.075) < 1e-9 and md['rangeBonus'] == 10 and md['range'] == st['midArm'] + 10,
              '중거리 레어 팔(산탄 개조 팔): 방어 무시 7.5% · 사거리 +10 (둘 다 절반)', str(md))
    ctx.check(f['atkSpd'] == 1 and f['pierce'] == 0 and f['knockCut'] == 0 and f['ccCut'] == 0 and f['speed'] == 143,
              '커먼 기본 로봇: 고유 능력치 없음 · 진격 143 (11-21 전과 같음)', str(f))

    # ---- 등급 고정 (시험용) · 진격 속도 상한 ----
    st = g.js(LT + P + f"""const o = {objs(('head_hero_a', 'body_hero_a', 'arm_hero_a', 'leg_hero_a'))};
        const before = progress.statsFor(o).speed;
        LT.setForcedGrade('legendary'); const s = progress.statsFor(o); const lvl = progress.partStats(o.arm);
        const card = progress.partStats(PARTS_DB.arm.find(p => p.id === 'arm_red_robot')).dps;
        LT.setForcedGrade(null); const back = progress.statsFor(o).speed, cardBack = progress.partStats(PARTS_DB.arm.find(p => p.id === 'arm_red_robot')).dps;
        return {{ before, forced: s.speed, atk: s.traits.atkSpd, back, card, cardBack, changed: LT.isModified() }};""")
    ctx.check(st['before'] == 221 and st['forced'] == 240 and st['atk'] == 1.15 and st['back'] == 221 and st['card'] > st['cardBack'] and not st['changed'],
              "등급 고정 '레전더리': 타락 기사 진격 221 → 상한 240 · 공격 속도 ×1.15 · 커먼 파츠도 레전더리로 셈 → 끄면 원래", str(st))

    # ---- 전투: 공격 속도 · 방어 무시 · 넉백 · 상태이상 ----
    g.battle(RARE_KAIJU, wait_ms=2500)
    st = g.js("""const { SET } = await import('/js/engine_v2/battle/tuning.js');
        const base = m.animBoost;
        b.addBuff('overdrive', 3); b.tickKit(0.016); const od = m.animBoost;
        delete b.buffs.overdrive; b.tickKit(0.016);
        return { base, od, tr: b.gradeTr.atkSpd };""")
    ctx.check(abs(st['base'] - 1.05) < 1e-9 and abs(st['od'] - 1.05 * 1.5) < 1e-9,
              '전투 공격 속도: 레어 팔이면 공격 동작 ×1.05, 오버드라이브(×1.5)와 곱해 ×1.575', str(st))
    st = g.js(LT + """LT.set('grade.rare.atkSpd', 1.5); b.addBuff('overdrive', 3); b.tickKit(0.016); const capped = m.animBoost;
        delete b.buffs.overdrive; LT.reset('grade.rare.atkSpd'); b.tickKit(0.016);
        return { capped, after: m.animBoost, tr: b.gradeTr.atkSpd };""")
    ctx.check(abs(st['capped'] - 1.9) < 1e-9 and abs(st['after'] - 1.05) < 1e-9 and st['tr'] == 1.05,
              '조절 패널로 레어 공격 속도 ×1.5 → 오버드라이브와 곱해도 동작은 ×1.9까지 · 되돌리면 ×1.05 (전투 중 바로)', str(st))

    # 방어 무시: 방패병(방어 40%)에게 같은 100 → 세기 0(무시 끔)일 때와 견줌
    st = g.js(LT + """b.spawnInterval = 999;
        const hit = (src) => { const e = b.spawnMinion('shield', { x: b.monsterX + 300, elite: false }); e.hp = e.maxHp = 1e7; const h = e.hp;
            b.dealDamageToEnemy(e, 100, false, src ? { source: src } : {}); const d = h - e.hp; e.dom && e.dom.remove(); b.enemies = b.enemies.filter(x => x !== e); return d; };
        const on = hit(), ally = hit('ally');
        LT.set('trait.power', 0); const off = hit(); LT.reset('trait.power');
        return { on, off, ally, ratio: on / off };""")
    ctx.check(abs(st['ratio'] - (1 - 0.4 * 0.85) / 0.6) < 0.01 and abs(st['ally'] - st['off']) < 0.01,
              '방어 무시 15%: 방패병(방어 40%)이 받는 피해 60% → 66% (×1.1) · 아군 공격에는 안 붙음', str(st))

    # 넉백 · 상태이상
    # 가시 갑각 다리는 원래 '밀려나지 않음' 패시브라 이 검사 동안만 다리 id를 비움
    st = g.js(LT + """const leg0 = b.equippedLegId; b.equippedLegId = null;
        b.monsterX = 500; m.setMonsterPosition(500); b.knockPlayerBack(100, null); const pushed = 500 - b.monsterX;
        b.pStunT = 0; b.applyPlayerStun(2); const stun = b.pStunT; b.pStunT = 0;
        LT.setForcedGrade('common'); const tr0 = { ...b.gradeTr };
        b.monsterX = 500; m.setMonsterPosition(500); b.knockPlayerBack(100, null); const pushed0 = 500 - b.monsterX;
        b.applyPlayerStun(2); const stun0 = b.pStunT; b.pStunT = 0; LT.setForcedGrade(null); b.updatePlayerStatus();
        b.equippedLegId = leg0; b.monsterX = 500; m.setMonsterPosition(500);
        return { pushed, stun, pushed0, stun0, tr0 };""")
    ctx.check(abs(st['pushed'] - 75) < 0.5 and abs(st['stun'] - 1.8) < 1e-6 and abs(st['pushed0'] - 100) < 0.5 and abs(st['stun0'] - 2) < 1e-6,
              '몸통 레어 넉백 저항 25%: 100 밀릴 것 → 75 · 머리 레어 상태이상 10%: 기절 2초 → 1.8초 (등급 고정 커먼이면 100 · 2초)', str(st))

    # 근거리 특징
    st = g.js("""const r = {};
        b.sigChar = 'mech'; b.sigRole = 'melee'; r.mechBase = b.sigTargetMul({ isBuilding: true }); r.mechUnit = b.sigTargetMul({});
        b.sigRole = 'ranged'; b.isAttacking = false; r.mechRanged = b.sigTargetMul({ isBuilding: true });
        b.sigChar = 'chimera'; b.sigRole = 'melee'; r.chimeraBar = b.sigTargetMul({ isBarricade: true });
        b.sigChar = 'hero'; r.heroUnit = b.sigTargetMul({}); r.heroElite = b.sigTargetMul({ elite: true }); r.heroBoss = b.sigTargetMul({ boss: true }); r.heroBase = b.sigTargetMul({ isBuilding: true });
        b.sigChar = 'diver'; r.diver = b.sigTargetMul({});
        b.setupTraits(gameState.getEquippedObjects());
        return r;""")
    ctx.check(abs(st['mechBase'] - 1.25) < 1e-9 and st['mechUnit'] == 1 and st['mechRanged'] == 1 and abs(st['chimeraBar'] - 1.25) < 1e-9
              and abs(st['heroUnit'] - 1.15) < 1e-9 and abs(st['heroElite'] - 1.15) < 1e-9 and st['heroBoss'] == 1 and st['heroBase'] == 1 and st['diver'] == 1,
              '근거리 특징: 거대로봇 · 합성괴인 근거리 = 거점 · 바리케이드 +25% (원거리 팔이면 없음) / 타락 히어로 = 보통 적 · 엘리트 +15% (보스 · 거점 없음) / 후발은 없음', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ---- 사거리 기준 밖이던 팔 10개 ----
    st = g.js(P + """const r = id => PARTS_DB.arm.find(p => p.id === id).stats.range;
        return ['arm_mech_c', 'arm_mech_w', 'arm_mech_m', 'arm_hero_d', 'arm_hero_v', 'arm_hero_w', 'arm_kaiju_w', 'arm_chimera_c', 'arm_hero_wave', 'arm_hero_l'].map(r);""")
    ctx.check(st == [230] * 8 + [300, 300], '사거리 기준: 근거리 8개 230 · 원거리(파동 지팡이 · 마검) 300', str(st))

    # ---- 밸런스 조절 패널 '등급' 묶음 ----
    g.js("const e = document.querySelector('.v2-brand__emblem'); for (let i = 0; i < 5; i++) e.click();")
    g.equip(RARE_KAIJU)
    g.js("(await import('/js/ui_v2/tunePanel_v2.js')).openTunePanel();")
    g.wait(400)
    st = g.js("""const p = document.querySelector('.v2-tune');
        return { cells: p.querySelectorAll('.v2-tune__grid input.v2-tune__cell').length, seg: p.querySelectorAll('[data-force]').length,
            now: p.querySelector('[data-now]')?.textContent.replace(/\\s+/g, ' ') || '', rows: ['leg.base', 'leg.cap', 'trait.power', 'melee.building', 'melee.monster'].every(x => p.querySelector(`.v2-tune__row[data-path="${x}"]`)),
            pierceCell: p.querySelector('input[data-path="grade.rare.pierce"]').value };""")
    ctx.check(st['cells'] == 24 and st['seg'] == 5 and st['rows'] and st['pierceCell'] == '15' and '공격 속도 ×1.05' in st['now'] and '방어 무시 15%' in st['now'] and '진격 176' in st['now'],
              "패널 '등급' 묶음: 등급 표 24칸(6줄 × 4등급, %는 15처럼) · 등급 고정 5단추 · 다리 기준 · 상한 · 세기 · 근거리 특징 · 지금 장착 값", str(st))
    st = g.js(LT + """const p = document.querySelector('.v2-tune'); const c = p.querySelector('input[data-path="grade.rare.pierce"]');
        c.value = '40'; c.dispatchEvent(new Event('change', { bubbles: true }));
        const v = LT.valueOf('grade.rare.pierce'), now = p.querySelector('[data-now]').textContent.replace(/\\s+/g, ' '), changed = c.classList.contains('is-changed');
        p.querySelector('[data-force="legendary"]').click();
        const forced = LT.forcedGrade(), now2 = document.querySelector('.v2-tune [data-now]').textContent.replace(/\\s+/g, ' ');
        const { tuneText } = await import('/js/ui_v2/tunePanel_v2.js'); const text = tuneText();
        document.querySelector('.v2-tune [data-act="resetGrade"]').click();
        return { v, changed, now, forced, now2, text, clean: !LT.isModified() };""")
    ctx.check(abs(st['v'] - 0.4) < 1e-9 and st['changed'] and '방어 무시 40%' in st['now'] and st['forced'] == 'legendary' and '진격 240' in st['now2']
              and '레어 방어 무시: 15% → 40%' in st['text'] and '등급 고정 (시험용): 레전더리' in st['text'] and st['clean'],
              "패널: 칸에 40 → 레어 방어 무시 40% 바로 적용 · '레전더리' 고정 → 진격 240 · 값 복사 글 · [등급 묶음만 기본값]", str(st))
    g.shot('meeting_c_panel', '.v2-tune')
    g.js("(await import('/js/ui_v2/tunePanel_v2.js')).closeTunePanel();")
    g.wait(200)

    # ---- 연구소: 고유 능력치 줄 · 카드 글 ----
    g.page.click('#btn-to-lab-v2')
    g.wait(900)
    g.page.click('.v2-slottab[data-slot="arm"]')
    g.wait(400)
    st = g.js("""const rows = [...document.querySelectorAll('#lab-compare-v2 .v2-compare__trait')].map(r => r.dataset.trait);
        const card = document.querySelector('#parts-grid-v2 [data-id="arm_kaiju_a"] .v2-partcard__trait')?.textContent || '';
        const role = document.querySelector('#lab-compare-v2 .v2-compare__role dd')?.textContent || '';
        return { rows, card, role };""")
    ctx.check(st['rows'] == ['atkSpd', 'pierce', 'knockCut', 'ccCut'] and '공속×1.05' in st['card'] and '방무15%' in st['card'] and '몬스터형 적 +15%' in st['role'],
              '연구소: 레어 세트면 능력치 칸에 공격 속도 · 방어 무시 · 넉백 · 상태이상 줄 · 팔 카드에 등급 색 글 · 유형 줄에 근거리 특징', str(st))
    g.shot('meeting_c_lab', '.v2-lab')
    g.equip(FREE_MECH)
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.page.click('#btn-to-lab-v2')
    g.wait(900)
    st = g.js("return document.querySelectorAll('#lab-compare-v2 .v2-compare__trait').length;")
    ctx.check(st == 0, '연구소: 커먼만 끼면 고유 능력치 줄 없음 (화면이 예전과 같음)', str(st))
