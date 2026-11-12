"""협력 출격: 소유/편성/저장, 8종 효과, 출격 시간, 시전자 분리, 종료 수명."""
SEED = """
const { PARTS_DB } = await import('/js/data/parts.js');
const { ROSTER } = await import('/js/engine_v2/roster_v2.js');
progress.unlockedChars = ROSTER.map(c => c.id);
for (const list of Object.values(PARTS_DB)) for (const p of list) progress.owned.add(p.id);
progress.dispatch = [];
progress.research.supportCooldown = 0;
"""


def setup(g, support, main='mech', enemies=6, charged=True):
    g.js("b.stopBattle();" + SEED)
    g.equip(main)
    g.js(f"""progress.character = '{main}'; progress.supportCharacter = '{support}'; progress.supportAuto = false;
        window.madOverlordGameV2.switchScreen('battle');
        cancelAnimationFrame(b.loopId); b.director.clear(); b.cinematic = false; gameTime.reset();
        b.spawnInterval = 999; b.enemies.forEach(e => e.dom?.remove()); b.enemies = [];
        b.midBaseSpawned = true; b.distanceTraveled = 0;
        for (let i = 0; i < {enemies}; i++) {{ const e = b.spawnMinion('guard', {{ x: b.monsterX + 120 + i * 38, elite: false }});
            e.hp = e.maxHp = 50000; e.armor = 0; e.speed = 0; e.dps = 10; }}
    """)
    # 효과 검사는 충전 완료 상태로 시작. 첫 충전 규칙은 test_support_ui에서 별도 확인한다.
    if charged:
        g.js('b.support.cooldown = 0;')
    g.js('b.hud.updateSupport();')


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("return { selected: progress.supportCharacter, auto: progress.supportAuto, own: progress.supportCandidates().length };")
    ctx.check(st['selected'] is None and not st['auto'] and st['own'] == 0, '새 저장: 지원 없음·수동, 잠긴 무료 파츠 캐릭터도 제외', str(st))
    st = g.js(SEED + """
        const ownMain = progress.selectSupport('mech');
        progress.dispatch = [{ character: 'saint' }];
        const dispatched = progress.selectSupport('saint');
        const saved = progress.loadoutFor('frost'); progress.owned.delete(saved.leg);
        const missing = progress.supportReason('frost');
        // 한 슬롯의 다른 보유 파츠로 대체할 수 있으면 여전히 유효하다. 모든 다리 파츠를 없앤다.
        for (const p of PARTS_DB.leg.filter(p => p.faction.includes('서리의 무희'))) progress.owned.delete(p.id);
        const noLeg = progress.selectSupport('frost');
        const locked = (progress.unlockedChars = progress.unlockedChars.filter(id => id !== 'hero'), progress.selectSupport('hero'));
        return { ownMain, dispatched, noLeg, locked };
    """)
    ctx.check(not any(st.values()), '편성 제한: 주인공·파견·미보유 부위·잠금 캐릭터 거부', str(st))
    st = g.js(SEED + """
        progress.randomSupport(() => 0); const id = progress.supportCharacter;
        const random = progress.supportRandom; progress.setSupportAuto(true);
        progress.save(); const saved = JSON.parse(localStorage.getItem('mo_v2_save'));
        return { id, random, saved: saved.supportCharacter, auto: saved.supportAuto };
    """)
    ctx.check(st['id'] != 'mech' and st['id'] == st['saved'] and st['random'] and st['auto'], '랜덤: 보유 후보만, 결과 공개·저장', str(st))
    g.reload_v2()
    ctx.check(g.js("return progress.supportCharacter !== null && progress.supportAuto && progress.supportRandom;"), '새로고침 후 지원 편성·자동·랜덤 결과 유지')
    g.page.click('#btn-menu-coop-v2')
    ctx.check(g.page.locator('.v2-coop-card').count() == 10, '편성 창: 10종 역할·필살기·시너지 카드')
    g.shot('support_selection')
    g.page.click('[data-act="selectSupport"][data-id="diver"]')
    g.page.click('[data-act="close"]')
    ctx.check('심연의 길잡이' in g.page.locator('#btn-menu-coop-v2').inner_text(), '선택 후 메인 편성 요약 표시')

    setup(g, 'frost')
    st = g.js("""const snap = b.support.snapshot;
        const before = snap.stats.dps; progress.levels[snap.parts.arm.id] = 5; b.playerDps *= 100;
        const original = JSON.stringify(gameState.equippedParts);
        gameTime.paused = true; const paused = b.callSupport(); gameTime.paused = false;
        b.cinematic = true; const cinematic = b.callSupport(); b.cinematic = false;
        const first = b.callSupport(), second = b.callSupport();
        b.tickSupport(0.5);
        return { before, after: snap.stats.dps, original, now: JSON.stringify(gameState.equippedParts), first, second, paused, cinematic,
            held: b.supportHeld(b.enemies[0]), count: document.querySelectorAll('.v2-support-actor').length };
    """)
    ctx.check(st['before'] == st['after'] and st['original'] == st['now'], '출격 스냅샷: 장비·강화·주인공 공격력 변경과 분리', str(st))
    ctx.check(st['first'] and not st['second'] and not st['paused'] and not st['cinematic'], '호출: 중복·재충전 중·일시정지·연출 중 거부', str(st))
    ctx.check(st['held'] and st['count'] == 1, '지원 무희 등장 후 필살기로 일반 적 빙결')
    st = g.js("""const e = b.enemies[0], hp = e.hp;
        const a = b.support.active; a.snapshot.gear = {};
        b.gear = { bossDmg: 9 }; e.boss = true; e.armor = 0;
        b.supportHit(a, e, 100); const damage = hp - e.hp;
        b.buffs.bloodOath = 10; b.playerHp = b.maxPlayerHp / 2;
        const playerHp = b.playerHp; b.supportHit(a, e, 100);
        const healed = b.playerHp - playerHp;
        const once = b.supportModifyDamage(e, 100, null).damage;
        const twice = b.supportModifyDamage(e, 100, null).damage;
        return { damage, healed, once, twice };
    """)
    ctx.check(abs(st['damage'] - 100) < 0.001 and st['healed'] == 0, '지원 피해: 주인공 보스 옵션·흡혈을 공유하지 않음', str(st))
    ctx.check(st['once'] > st['twice'] and st['twice'] == 100, '빙결 연계: 대상당 주인공 추가 파쇄 1회', str(st))
    g.wait(250)
    g.shot('support_battle', '#screen-battle-v2')
    st = g.js("""b.tickSupport(0); const elapsed = b.support.active.elapsed;
        b.tickSupport(8.9); const alive = !!b.support.active;
        b.tickSupport(0.61);
        return { elapsed, alive, gone: !b.support.active, marks: document.querySelectorAll('.v2-support-mark').length,
            actors: document.querySelectorAll('.v2-support-actor').length, ready: b.supportStatus().ready };
    """)
    ctx.check(st['elapsed'] == 0.5 and st['alive'] and st['gone'] and not st['marks'] and not st['actors'] and not st['ready'],
              '10초 철수: 효과·외형 제거, 재충전 중 호출 불가', str(st))

    for unit in ('mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint', 'frost', 'doll'):
        setup(g, unit, main='hero' if unit == 'mech' else 'mech')
        st = g.js("""const originalAllies = b.allies.length, originalEnemies = b.enemies.length;
            b.spawnAllyMinion(b.monsterX, 'chimera'); const ownAlly = b.allies[b.allies.length - 1];
            const hp = b.enemies[0].hp; const called = b.callSupport(); b.tickSupport(0.5);
            const id = b.support.snapshot.id;
            const mark = [...b.support.active.marks.values()][0];
            const held = b.enemies.some(e => b.supportHeld(e));
            const made = b.allies.filter(a => a.supportOwner).length;
            const shield = b.supportShield;
            const attack = b.supportAttackMul();
            b.tickSupport(1.6);
            const damaged = b.enemies.some(e => e.hp < 50000);
            b.clearSupport();
            return { id, called, held, made, shield, attack, damaged,
                clean: b.allies.includes(ownAlly) && !b.allies.some(a => a.supportOwner) && !ownAlly.supportShield && b.supportShield === 0,
                speed: m.rigBattle.supportAttackSpeed, marks: document.querySelectorAll('.v2-support-mark').length };
        """)
        expected = (st['made'] == 2 if unit == 'hero' else st['made'] == 3 and st['shield'] > 0 if unit == 'saint'
                    else st['attack'] > 1 if unit == 'chimera' else st['held'] if unit in ('kaiju', 'diver', 'frost', 'doll') else True)
        ctx.check(st['called'] and expected and st['clean'] and st['speed'] == 1 and st['marks'] == 0,
                  f'{unit}: 대표 필살기·특성 적용, 철수 시 기존 아군 보존', str(st))
        setup(g, unit, main='hero' if unit == 'mech' else 'mech', enemies=1)
        st = g.js("""const e = b.enemies[0]; e.boss = true;
            b.callSupport(); b.tickSupport(0.5); b.tickSupport(1.6);
            return { same: b.enemies.includes(e), held: b.supportHeld(e), mark: b.support.active.marks.has(e),
                shield: b.supportShield, attack: b.supportAttackMul(), damage: 50000 - e.hp };
        """)
        ctx.check(st['same'] and not st['held'] and (st['mark'] or st['shield'] > 0 or st['attack'] > 1 or unit == 'mech'),
                  f'{unit}: 보스 단독이어도 지원 효과, 세뇌·빙결·조종 제외', str(st))

    setup(g, 'hero', enemies=0)
    ctx.check(g.js("return !b.callSupport() && b.support.cooldown === 0;"), '유효 대상 없으면 충전 게이지 보존')
    setup(g, 'saint', enemies=0)
    ctx.check(g.js("b.playerHp *= 0.5; return b.callSupport();"), '성녀는 적이 없어도 부상 시 생존 지원 가능')
    setup(g, 'diver', enemies=1)
    st = g.js("""b.support.auto = true; b.stats.time = 10; b.tickSupport(0.1); const saved = b.support.cooldown;
        b.enemies[0].boss = true; b.tickSupport(0.1); return { saved, called: !!b.support.active, cooldown: b.support.cooldown };
    """)
    ctx.check(st['saved'] == 0 and st['called'] and st['cooldown'] == 40, '지원 AUTO: 일반 적 1명에는 보존, 보스 때 호출')
    st = g.js("""b.stopBattle(); return { actors: document.querySelectorAll('.v2-support-actor').length,
        marks: document.querySelectorAll('.v2-support-mark').length, active: b.support.active, shield: b.supportShield };
    """)
    ctx.check(not any(st.values()), '퇴각: 예약 효과·표식·아바타·보호막 정리', str(st))
    setup(g, 'frost', enemies=1)
    st = g.js("""b.callSupport(); b.tickSupport(0.5); const target = b.enemies[0];
        const hp = target.hp; b.stopBattle(); b.tickSupport(2); return target.hp === hp && !b.support.active;
    """)
    ctx.check(st, '철수 이후 예약 파쇄 공격이 다음 전투에 누출되지 않음')
    setup(g, 'chimera', enemies=1)
    st = g.js("""b.callSupport(); b.tickSupport(0.5); b.timeUp = true; b.clearSupport();
        b.startBattle(); cancelAnimationFrame(b.loopId); b.director.clear();
        return b.support.cooldown === 40 && !b.support.active && m.rigBattle.supportAttackSpeed === 1;
    """)
    ctx.check(st, '재시작: 첫 충전 40초·공격속도·남은 효과 초기화')
    setup(g, 'diver', enemies=1)
    st = g.js("""progress.dispatch = [{ character: 'diver' }]; b.startBattle();
        cancelAnimationFrame(b.loopId); b.director.clear();
        return !b.support.snapshot && !b.callSupport();
    """)
    ctx.check(st, '출격 재검증: 편성 후 파견된 캐릭터는 지원에서 제외')
    setup(g, 'hero', enemies=1)
    st = g.js("""const e = b.enemies[0]; e.boss = true; b.callSupport(); b.tickSupport(.5);
        b.playerHp = b.maxPlayerHp; const hp = b.playerHp; b.damagePlayer(100, 0, e);
        return (hp - b.playerHp) / (b.roleTaken * b.sigIncomingMul());   // 원거리·근거리 배율(D-119)을 뺀 값
    """)
    ctx.check(abs(st - 85) < .001, '히어로 약화: 실제 보스 공격 피해 15% 감소', str(st))
    st = g.js("""const { SET } = await import('/js/engine_v2/battle/tuning.js');
        const e = b.enemies[0]; b.buffs.thornArmor = 2; const hp = e.hp, playerHp = b.playerHp;
        b.damagePlayer(100, 0, null, e);
        return { reflected: hp - e.hp, actual: playerHp - b.playerHp, expected: 100 * (1 - SET.thorn.reduce) * .85 * b.roleTaken * b.sigIncomingMul() };
    """)
    ctx.check(st['reflected'] == 0 and abs(st['actual'] - st['expected']) < .001,
              '공격자 추적: 지원 약화는 적용하고 기존 원거리 반격 규칙은 보존', str(st))
    setup(g, 'chimera', enemies=1)
    st = g.js("""const rig = m.rigBattle; b.callSupport(); b.tickSupport(.5);
        const boosted = rig.supportAttackSpeed; b.buffs.overdrive = 2; m.setAnimBoost(1.3);
        b.clearSupport(); return { boosted, base: rig.supportAttackSpeed, overdrive: m.animBoost };
    """)
    ctx.check(abs(st['boosted'] - 1.15) < .001 and st['base'] == 1 and st['overdrive'] == 1.3,
              '광란 공격속도: 기존 오버드라이브를 보존하고 별도 종료', str(st))
    setup(g, 'saint', enemies=1)
    st = g.js("""b.shieldHp = 100; b.callSupport(); b.tickSupport(.5);
        const supportShield = b.supportShield; b.damagePlayer(20, 0);
        const ownShield = b.shieldHp; b.clearSupport();
        return { supportShield, ownShield, after: b.shieldHp, supportAfter: b.supportShield };
    """)
    ctx.check(st['supportShield'] > 20 and st['ownShield'] == 100 and st['after'] == 100 and st['supportAfter'] == 0,
              '성녀 보호막: 지원분을 먼저 흡수, 철수해도 기존 실드 보존', str(st))
    setup(g, 'doll', enemies=1)
    st = g.js("""const e = b.enemies[0]; e.boss = true; e.armor = .5; b.callSupport(); b.tickSupport(.5);
        const hp = e.hp; b.dealDamageToEnemy(e, 100, false, { source: 'player' });
        return hp - e.hp;
    """)
    ctx.check(abs(st - 62.5) < .001, '인형사 보스 연계: 방어 25% 무시가 실제 피해에 반영', str(st))
    setup(g, 'kaiju', enemies=1)
    st = g.js("""const e = b.enemies[0]; e.stunT = 7; b.callSupport(); b.tickSupport(.5);
        const a = b.support.active; const hp = e.hp; const kills = b.stats.kills;
        e.hp = 1; b.supportHit(a, e, 100); const dm = gameState.darkMatter;
        b.supportHit(a, e, 100); const once = b.stats.kills === kills + 1 && dm === gameState.darkMatter;
        b.clearSupport(); return { once, stun: e.stunT };
    """)
    ctx.check(st['once'] and st['stun'] == 7, '지원 처치: 보상 1회, 철수 시 주인공이 준 기존 기절 보존', str(st))
    setup(g, 'hero', enemies=4)
    st = g.js("""b.callSupport(); b.tickSupport(.5); b.spawnFinalBase();
        const base = b.enemies.find(e => e.isFinal); base.hp = 1; b.dealDamageToEnemy(base, 100, false);
        const clean = !b.support.active && !b.allies.some(a => a.supportOwner) && !document.querySelector('.v2-support-actor');
        b.director.clear(); return b.finalBaseDestroyed && clean;
    """)
    ctx.check(st, '승리 연출 시작 즉시 지원 본체·미니언·표식 제거')

    # 실제 RAF 루프/키 입력으로 시간 배율과 일시정지를 확인한다.
    setup(g, 'kaiju', enemies=1)
    g.js("""b.playerDps = 0; gameTime.speed = 2; b.lastTime = performance.now();
        b.loopId = requestAnimationFrame(t => b.loop(t));""")
    g.key('q')
    g.wait(500)
    g.key('p')
    elapsed = g.js('return b.support.active?.elapsed;')
    g.wait(450)
    frozen = g.js('return b.support.active?.elapsed;')
    ctx.check(elapsed is not None and abs(frozen - elapsed) < .001, '실제 Q 호출·P 일시정지: 지원 시간도 멈춤', str((elapsed, frozen)))
    g.key('p')
    g.wait(700)
    ctx.check(g.js('return b.support.active && b.support.active.elapsed > 1.8;'), '실제 2배속: 게임 시간 기준으로 지원 진행')
    g.shot('support_live', '#screen-battle-v2')
    g.wait(4300)
    ctx.check(g.js("return !b.support.active && b.support.cooldown > 0 && !document.querySelector('.v2-support-actor');"),
              '실제 루프: 2배속 약 5초 출격 후 철수')
    g.js('b.stopBattle();')
