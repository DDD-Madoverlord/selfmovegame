"""파츠 확장 2차 (Q-009 · D-071): 레전더리 세트 등급·드랍·조각, 스킬 부품(skillKit_v2.js · battle/kit.js), 2차 세트 묶음(sets2/*.js)
— 세트마다 4부위를 끼우고 기본 공격·스킬 1·2·필살기를 써서 피해·오류를 봄, 세트 효과 고침·패시브·상태·장판·소환·변신"""

LETTERS = 'cduvwlm'


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- 등록: 세트 표·파츠·스킬·패시브·색 ----
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const { SETS, setOf, setLabelOf, isPurchasable, isDropOnly, minGradeOf } = await import('/js/engine_v2/sets_v2.js');
        const { PART_SKILL, SKILLS, LEG_PASSIVES } = await import('/js/engine_v2/skills_v2.js');
        const { PACKS } = await import('/js/engine_v2/sets2/index.js');
        const { characterOfPart } = await import('/js/engine_v2/roster_v2.js');
        const { SET_TINT } = await import('/js/engine_v2/rig/rigAvatar.js');
        const { icon } = await import('/js/ui_v2/icons.js');
        const ids = PACKS.flatMap(p => Object.keys(p.sets));
        const parts = Object.values(PARTS_DB).flat().filter(p => setOf(p) && ids.includes(setOf(p).id));
        const noSkill = parts.filter(p => (p.id.startsWith('leg_') ? !LEG_PASSIVES[p.id] : !SKILLS[PART_SKILL[p.id]])).map(p => p.id);
        const wrongChar = parts.filter(p => !p.id.includes('_' + characterOfPart(p) + '_')).map(p => p.id);
        const star = icon('star');
        const noIcon = ids.flatMap(id => parts.filter(p => setOf(p).id === id && !p.id.startsWith('leg_')).map(p => SKILLS[PART_SKILL[p.id]]))
            .filter(s => s && icon(s.icon) === star).map(s => s.name);
        const tint = ids.filter(id => { const [c, l] = id.split('_'); return !(SET_TINT[c] || {})[l]; });
        const leg = parts.find(p => p.id === 'head_kaiju_l'), rare = parts.find(p => p.id === 'head_kaiju_c');
        return { sets: ids.length, parts: parts.length, noSkill, wrongChar, noIcon, tint,
            label: setLabelOf(setOf('head_kaiju_l')), labelU: setLabelOf(setOf('head_kaiju_v')),
            legBuy: isPurchasable(leg), legDrop: isDropOnly(leg), legGrade: minGradeOf(leg), rareBuy: isPurchasable(rare) };""")
    ctx.check(st['sets'] >= 7 and st['parts'] == st['sets'] * 4, f"2차 세트 묶음 등록 ({st['sets']}세트 · 파츠 {st['parts']})", str(st))
    ctx.check(not st['noSkill'] and not st['wrongChar'] and not st['noIcon'] and not st['tint'],
              '2차 파츠마다 스킬·패시브·아이콘·세트 색, 캐릭터 판정', str(st))
    ctx.check(st['label'] == '레전더리 ① 종말의 거신' and st['labelU'] == '유니크 ② 수정 거수',
              '이름표: "레전더리 ① …" · "유니크 ② …"', str(st))
    ctx.check(not st['legBuy'] and st['legDrop'] and st['legGrade'] == 'legendary' and st['rareBuy'],
              '레전더리 세트: DM 구매 없음·드랍 전용·등급 바닥 레전더리, 레어 ③은 DM 구매', str(st))

    # ---- 드랍 묶음: 나이트메어에 레전더리 20%, 보스 첫 클리어는 레전더리부터, 파견은 빼고, 조각 200 ----
    st = g.js("""const G = await import('/js/engine_v2/growth_v2.js');
        const groups = progress.dropGroups('kaiju');
        let seq = 0; const rnd = () => { seq = (seq * 9301 + 49297) % 233280; return seq / 233280; };
        const picks = { base: 0, rare: 0, unique: 0, legendary: 0 };
        const { dropGroupOf } = await import('/js/engine_v2/sets_v2.js');
        for (let i = 0; i < 2000; i++) picks[dropGroupOf(progress.pickDropPart('kaiju', 'nightmare', {}, rnd))]++;
        const first = progress.pickDropPart('kaiju', 'nightmare', { prefer: G.DROP.firstClearGroups.nightmare }, rnd);
        let disp = 0;
        for (let i = 0; i < 400; i++) { const p = progress.pickDropPart('kaiju', 'nightmare', { exclude: ['unique', 'legendary'] }, rnd); if (['unique', 'legendary'].includes(dropGroupOf(p))) disp++; }
        const craft = progress.craftCost('arm_kaiju_m');
        return { leg: groups.legendary.length, picks, first: dropGroupOf(first), disp, craft, w: G.DROP.poolWeights.nightmare };""")
    p = st['picks']
    ctx.check(st['leg'] == 8 and 0.15 < p['legendary'] / 2000 < 0.25 and st['first'] == 'legendary' and st['disp'] == 0,
              '드랍: 나이트메어 레전더리 약 20%, 보스 첫 클리어는 레전더리 세트, 파견은 유니크·레전더리 빠짐', str(st))
    ctx.check(st['craft'] and st['craft']['shards'] == 200 and st['craft']['grade'] == 'legendary', '조각 제작: 레전더리 200개 → 레전더리 등급', str(st['craft']))

    # ---- 세트마다 전투 ----
    sets = g.js("""const { PACKS } = await import('/js/engine_v2/sets2/index.js');
        return PACKS.flatMap(p => Object.keys(p.sets));""")
    for sid in sets:
        c, l = sid.split('_')
        parts = tuple(f'{s}_{c}_{l}' for s in ('head', 'body', 'arm', 'leg'))
        for attempt in range(2):   # 긴 검사 중 가끔 한 판이 통째로 멈춤(창 포커스 일시정지 추정) → 피해가 하나도 없으면 한 번 다시
            g.js("progress.selectStage('2-1');")   # 새 기획 2-2는 장갑 불도저가 섞여 피해가 판마다 들쭉날쭉 → 용병만 나오는 2-1
            g.battle(parts, wait_ms=1500)
            g.place_enemies(n=5, gap=45, first=110, hp=9000, speed=8, dps=8)
            g.wait(1600)
            # 처음 놓은 적만 따라감 (새로 나온 졸개는 빼고, 쓰러진 적은 체력 0으로 셈)
            hp0 = g.js("window.__kitT = b.enemies.filter(e => !e.isBuilding); return window.__kitT.reduce((s, e) => s + e.hp, 0);")
            st = g.js("""const on = Object.keys(b.setCount).filter(k => b.setOn(k));
                b.skillCd.arm = 0; b.skillCd.body = 0; b.ultGauge = 1;
                const used = ['arm', 'body', 'head'].map(s => b.useSkill(s));
                return { used, on, kit: !!b.kitPassive, atk: b.attackType };""")
            g.wait(3200)
            hp1 = g.js("return window.__kitT.reduce((s, e) => s + (b.enemies.includes(e) ? Math.max(0, e.hp) : 0), 0);")
            if hp1 < hp0:
                break
        ctx.check(all(st['used']) and sid in st['on'] and st['kit'], f'{sid}: 4부위 세트 효과 켜짐 · 스킬 1·2·필살기 사용 · 다리 패시브', str(st))
        # 1200: 원거리 관통 하향(D-098, 물줄기 0.6 → 0.45) 뒤 탱커 세트(길잡이 '산호 수호자')가 약 1700 — 피해가 들어가는지만 봄
        ctx.check(hp1 < hp0 - 1200, f'{sid}: 기본 공격·스킬이 적에게 피해', f'{round(hp0)} → {round(hp1)}')
        g.shot(f'kit_{sid}', '#screen-battle-v2')

    # ---- 부품 동작 하나씩 ----
    g.battle(('head_kaiju_d', 'body_kaiju_d', 'arm_kaiju_d', 'leg_kaiju_d'), wait_ms=1500)
    g.place_enemies(n=4, gap=60, first=150, hp=9000, speed=8, dps=8)
    st = g.js("""const e = b.enemies.filter(x => !x.isBuilding)[0];
        b.kitStatus(e, { burn: [2, 0.3], vuln: [2, 0.5], weak: [2, 0.5] });
        const s0 = b.kitStates(e);
        const k = b.kitTargetMul(e);
        b.addKitBuff('t', 1, { dmg: 0.5, def: 0.5, move: 0.2, cdRate: 1 });
        const r = { s0, k, dmg: b.kitDmgMul(), inc: b.kitIncomingMul(), move: b.kitMoveMul(), cd: b.kitCdRate(), haz: b.kitFlag('ignoreHazard'), patch: b.kitPatch };
        return r;""")
    ctx.check(set(st['s0']) >= {'burn', 'vuln', 'weak'} and abs(st['k'] - 1.5) < 1e-6, '적 상태: 화상·취약·약화 표시, 취약 +50% 피해', str(st))
    ctx.check(abs(st['dmg'] - 1.5) < 1e-6 and abs(st['inc'] - 0.5) < 1e-6 and abs(st['move'] - 1.2) < 1e-6 and st['cd'] == 2 and st['haz'],
              '값 가진 버프: 피해·받는 피해·이동·쿨다운, 늪지 적응 장판 무시 깃발', str(st))
    st = g.js("""const n0 = b.allies.length;
        b.spawnKitAlly(b.monsterX + 80, { art: 'guard', hp: 0.1, dps: 0.2, life: 1, label: '시험 소환' });
        const n1 = b.allies.length;
        b.kitWave({ x: b.frontX(), speed: 600, dist: 400, w: 60, dmg: 1 });
        b.kitZone({ x: 40, w: 200, sec: 1, dps: 1, slow: true });
        await new Promise(r => setTimeout(r, 1600));
        return { n0, n1, n2: b.allies.length, waves: b.kitWaves.length, zones: b.kitZones.length };""")
    ctx.check(st['n1'] == st['n0'] + 1 and st['n2'] == st['n0'] and st['waves'] == 0 and st['zones'] == 0,
              '소환물(시간이 다 되면 사라짐) · 움직이는 판정 · 장판이 끝나면 사라짐', str(st))

    # 세트 효과 고침: 2부위(종말의 거신) → 대지 뒤집기 범위 +90, 4부위 아님
    g.battle(('head_kaiju_l', 'body_kaiju_l', 'arm_kaiju', 'leg_kaiju'), wait_ms=1200)
    st = g.js("return { on2: b.setOn('kaiju_l', 2), on4: b.setOn('kaiju_l'), patch: b.kitPatch, trig: b.kitTriggers.length };")
    ctx.check(st['on2'] and not st['on4'] and st['patch'].get('kjOverturn', {}).get('range') == 90 and st['trig'] == 0,
              '세트 효과: 2부위만 끼우면 2부위 고침만 (대지 뒤집기 범위 +90), 4부위 각성은 꺼짐', str(st))
    # 변신 (4부위 거신 각성): 체력 30% 아래로
    g.battle(('head_kaiju_l', 'body_kaiju_l', 'arm_kaiju_l', 'leg_kaiju_l'), wait_ms=1200)
    st = g.js("""b.playerHp = b.maxPlayerHp * 0.2;
        await new Promise(r => setTimeout(r, 400));
        return { x: !!b.kitXform, dmg: b.kitDmgMul(), once: b.kitOnce };""")
    ctx.check(st['x'] and st['dmg'] >= 1.5, '레전더리 4부위: 체력 30% 아래 거신 각성 (크기·피해 +50%)', str(st))

    # 연구소: 레전더리 카드 등급 색 · 드랍 전용
    g.js("b.stopBattle(); progress.selectCharacter('kaiju'); window.madOverlordGameV2.switchScreen('lab');")
    g.wait(800)
    st = g.js("""const labels = [...document.querySelectorAll('.v2-partcard__faction')].map(c => c.textContent);
        const tags = [...document.querySelectorAll('.v2-partcard .v2-partcard__grade')].map(t => t.textContent);
        return { n: labels.filter(t => /레어 ③|레어 ④|유니크|레전더리/.test(t)).length, leg: tags.filter(t => t === '레전더리').length, any: labels.length };""")
    ctx.check(st['n'] >= 7 and st['leg'] >= 2, '연구소: 2차 세트 파츠 카드 (레어 ③④·유니크·레전더리 등급 표시)', str(st))
    g.shot('kit_lab')
