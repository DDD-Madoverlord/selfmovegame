"""엘리트 속성 8종: 구역별 개수·이름표·보상, 이동·피해·회복·감속·처치 효과"""

import json

from test_zone34 import CLEAR, CLEAN, battle_at


def place_elite(g, affixes, typ='guard', dx=300, extra=''):
    """spawnMinion은 affixes를 넘기지 않아 spawnEnemy로 속성을 고정"""
    g.js(CLEAN + f"""b.timers = []; b.hazards.forEach(h => h.dom.remove()); b.hazards = [];
        b.pSlowT = 0; b.pRootT = 0; b.equippedLegId = 'leg_red_robot';
        const {{ spawnEnemy }} = await import('/js/engine_v2/enemies_v2.js');
        const e = spawnEnemy(b, '{typ}', {{ x: b.frontX() + {dx}, elite: true, affixes: {json.dumps(affixes)} }});
        e.speed = 0; {extra}""")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js(CLEAR.replace('IDS', '[1, 2, 3, 4]'))
    battle_at(g, '1-1')

    st = g.js(CLEAN + """const { spawnEnemy, ELITE_AFFIXES } = await import('/js/engine_v2/enemies_v2.js');
        const es = Array.from({ length: 16 }, () => b.spawnMinion('guard', { x: 1100, elite: true }));
        const boss = spawnEnemy(b, 'guardian', { x: 1100, elite: true, affixes: ['swift'] });
        const plain = spawnEnemy(b, 'guard', { x: 1100, elite: false, affixes: ['iron'] });
        const result = { count: es.every(e => e.affixes.length === 1 && ELITE_AFFIXES[e.affixes[0]]),
            reward: es.every(e => e.reward === 5), boss: !boss.elite && boss.affixes.length === 0,
            plain: plain.affixes.length === 0 && !plain.knockResist };
        boss.dom.remove(); b.enemies = b.enemies.filter(e => e !== boss); return result;""")
    ctx.check(st['count'] and st['reward'], '구역 1: 무작위 속성 1개, 기존 엘리트 보상 ×1.25', str(st))
    ctx.check(st['boss'] and st['plain'], '보스·일반 적은 강제 속성도 받지 않음', str(st))

    place_elite(g, ['swift', 'shielded', 'swift'])
    st = g.js("""const e = b.enemies[0]; return { name: e.dom.dataset.name, affixes: e.affixes,
        filter: e.baseFilter, reward: e.reward, hp: e.maxHp, scale: e.scale };""")
    ctx.check(st['name'] == '엘리트 [가속·보호막] 경비병' and st['affixes'] == ['swift', 'shielded']
              and st['reward'] == 6 and st['hp'] == 1050 and st['scale'] == 1.3
              and st['filter'].index('#ffd24a') < st['filter'].index('120, 220, 255'),
              '강제 속성 중복 제거·이름표·첫 속성 색, 기존 체력·크기 배율 유지', str(st))
    g.shot('elite_name', '#screen-battle-v2')

    # 가속: 같은 위치에서 실제 이동량 비교 (속도 범위가 겹치지 않음)
    st = g.js(CLEAN + """const { spawnEnemy, updateEnemy } = await import('/js/engine_v2/enemies_v2.js');
        const x = b.frontX() + 500;
        const normal = spawnEnemy(b, 'guard', { x, elite: true, affixes: [] });
        const swift = spawnEnemy(b, 'guard', { x, elite: true, affixes: ['swift'] });
        updateEnemy(b, normal, 0.5, b.frontX()); updateEnemy(b, swift, 0.5, b.frontX());
        const result = { normal: x - normal.x, swift: x - swift.x, dps: swift.dps / normal.dps };
        normal.speed = swift.speed = 0; return result;""")
    ctx.check(st['swift'] > st['normal'] and 60 <= st['swift'] <= 80 and abs(st['dps'] - 1.15) < 0.001,
              '가속: 이동 ×1.6, 엘리트 공격력에서 ×1.15 추가', str(st))

    place_elite(g, ['shielded'])
    # 파괴 이펙트: 지금 쓰는 정의(A 코드 또는 그림 D)의 첫 레이어가 재생됐는지
    st = g.js("""const { ELITE_VFX } = await import('/js/engine_v2/vfx/vfxDefs.js'), L = ELITE_VFX.shieldBreak.layers[0];
        const e = b.enemies[0], hp = e.hp; b.dealDamageToEnemy(e, 100, false);
        const first = { hp: e.hp, shield: e.shield, filter: e.dom.style.filter };
        b.dealDamageToEnemy(e, 350, false); b.dealDamageToEnemy(e, 10, false);
        return { hp, maxShield: e.maxShield, first, shield: e.shield, damage: hp - e.hp,
            filter: e.dom.style.filter, broken: b.fx.vfx.items.some(i => ['type', 'color', 'sheet', 'size', 'r'].every(k => i[k] === L[k])) };""")
    ctx.check(st['maxShield'] == st['hp'] * 0.4 and st['first']['hp'] == st['hp'] and st['first']['shield'] == 320
              and '10px' in st['first']['filter'], '보호막: 최대 체력 40%, 체력보다 먼저 흡수·파란 테두리', str(st))
    ctx.check(st['shield'] == 0 and st['damage'] == 40 and st['broken'] and '10px' not in st['filter'],
              '보호막: 넘친 피해만 체력으로, 파괴 이펙트·테두리 제거·재생성 없음', str(st))

    place_elite(g, ['thorns'])
    st = g.js("""const e = b.enemies[0]; b._hurt = 0; b.shieldHp = 0;
        b.dealDamageToEnemy(e, 10, false, { knock: 0 }); const first = b._hurt;
        b.dealDamageToEnemy(e, 500, false, { knock: 0 }); const direct = b._hurt;
        b.dealDamageToEnemy(e, 10, false, { dot: true }); b.dealDamageToEnemy(e, 10, false);
        return { first, cap: direct - first, expected: b.maxPlayerHp * 0.01, unchanged: b._hurt === direct,
            sparks: b.fx.vfx.items.filter(i => i.type === 'sparks' && i.color === '170, 230, 90').length };""")
    ctx.check(abs(st['first'] - 1.2) < 0.001 and abs(st['cap'] - st['expected']) < 0.001,
              '가시: 직접 타격 12% 되돌림, 한 번에 최대 내구도 1%', str(st))
    ctx.check(st['unchanged'] and st['sparks'] == 1, '가시: 지속 피해·react 없는 피해 제외, 불꽃은 0.3초 제한', str(st))

    place_elite(g, ['regen'], extra='b.dealDamageToEnemy(e, 210, false, { dot: true });')
    hp = g.js('return b.enemies[0].hp;')
    g.wait(1000)
    ctx.check(g.js('return b.enemies[0].hp;') == hp, '재생: 마지막 피격 뒤 2초 전에는 회복 안 함')
    g.wait(1500)
    st = g.js("""const e = b.enemies[0]; return { hp: e.hp, bar: parseFloat(e.hpBar.style.width), max: e.maxHp };""")
    ctx.check(st['hp'] > hp and abs(st['bar'] - st['hp'] / st['max'] * 100) < 0.001,
              '재생: 2초 뒤 회복, 체력바도 갱신', str(st))
    st = g.js("""const { updateEnemy } = await import('/js/engine_v2/enemies_v2.js');
        const e = b.enemies[0]; b.dealDamageToEnemy(e, 10, false); const hp = e.hp;
        updateEnemy(b, e, 0.5, b.frontX()); const blocked = e.hp === hp;
        e.lastHit = b.stats.time - 3; updateEnemy(b, e, 0.5, b.frontX()); const healed = e.hp - hp;
        e.hp = e.maxHp - 1; updateEnemy(b, e, 0.5, b.frontX()); const capped = e.hp === e.maxHp;
        e.hp -= 10; b.stunEnemy(e, 1); b.tickEnemies(0.1, b.frontX());
        return { blocked, healed, expected: e.maxHp * 0.03 * 0.5, capped, stunned: e.hp === e.maxHp - 10 };""")
    ctx.check(st['blocked'] and abs(st['healed'] - st['expected']) < 0.001 and st['capped'] and st['stunned'],
              '재생: 재피격으로 지연, 초당 3%·최대 체력 제한·기절 중 중단', str(st))

    # 근접은 공격 중에만 누적, 원거리·치유형은 발사 0.4초 뒤 감속
    place_elite(g, ['frost'], extra='e.cd.frost = 3.8;')
    g.wait(350)
    ctx.check(g.js('return b.pSlowT <= 0 && b.enemies[0].cd.frost === 3.8;'), '서리: 접근 중에는 근접 주기 안 쌓임')
    g.js('const e = b.enemies[0]; e.x = b.frontX() + 30; e.dom.style.left = `${e.x}px`;')
    g.wait(400)
    st = g.js('return { slow: b.pSlowT, move: b.moveMul(), cd: b.enemies[0].cd.frost };')
    ctx.check(1 < st['slow'] <= 1.5 and st['move'] == 0.5 and st['cd'] < 1,
              '서리 근접: 실제 공격 4초마다 감속 1.5초', str(st))

    place_elite(g, ['frost'], typ='netter', dx=200, extra='e.cd.skill = e.t.net.every - 0.05;')
    g.wait(200)
    ctx.check(g.js('return b.pSlowT <= 0;'), '서리 원거리: 발사 직후에는 감속 없음')
    g.wait(450)
    ctx.check(g.js('return b.pSlowT > 1 && b.pSlowT <= 1.5;'), '서리 원거리: 0.4초 뒤 감속')
    g.js("b.equippedLegId = 'leg_mech_b'; b.pSlowT = 0; b.enemies[0].cd.skill = 99;")
    g.wait(650)
    ctx.check(g.js('return b.pSlowT > 0 && b.pSlowT <= 0.75;'), '서리 원거리: 자기장 방벽이면 감속 시간 절반')
    g.js("b.equippedLegId = 'leg_hero_hover'; b.pSlowT = 0; b.enemies[0].cd.skill = 99;")
    g.wait(650)
    ctx.check(g.js('return b.pSlowT <= 0;'), '서리: 반중력 부양은 감속 면역')

    place_elite(g, ['frost'], typ='medic', dx=240,
                extra="e.cd.skill = e.t.heal.every - 0.05; const target = b.spawnMinion('guard', { x: e.x + 40, elite: false });"
                      "target.speed = 0; target.hp *= 0.5;")
    g.wait(650)
    ctx.check(g.js('return b.pSlowT > 1;'), '서리 치유형: 치유를 쏠 때도 감속')

    place_elite(g, ['toxic'])
    st = g.js("""const e = b.enemies[0], x = e.x + 38 - 60; b.dealDamageToEnemy(e, e.hp + 1, false);
        const h = b.hazards[0]; return { n: b.hazards.length, x: h.x, expectedX: x, w: h.w, sec: h.t,
            cloud: b.fx.vfx.items.some(i => i.type === 'smoke' && i.color === '190, 230, 40') };""")
    ctx.check(st['n'] == 1 and st['x'] == st['expectedX'] and st['w'] == 120 and st['sec'] == 4 and st['cloud'],
              '독 구름: 쓰러진 몸 가운데에 폭 120·4초 웅덩이 + 연두 연기', str(st))
    st = g.js("""const h = b.hazards[0], x = b.monsterX; b.monsterX = h.x; b.pSlowT = 0;
        b.tickHazards(0.1); const slow = b.pSlowT; b.monsterX = x; b.tickHazards(4);
        return { slow, gone: b.hazards.length === 0 };""")
    ctx.check(st['slow'] > 0 and st['gone'], '독 구름: 밟으면 감속, 수명 뒤 제거', str(st))

    place_elite(g, ['volatile'], extra='e.x = b.monsterX + 60 + 150 - 38; b.dealDamageToEnemy(e, e.hp + 1, false);')
    g.wait(500)
    ctx.check(g.js('return b._hurt === 0;'), '폭발: 1초 예고 중에는 피해 없음')
    g.wait(650)
    st = g.js('return { hurt: b._hurt, expected: b.maxPlayerHp * 0.04 };')
    ctx.check(abs(st['hurt'] - st['expected']) < 0.001, '폭발: 몸 가운데 거리 150px 경계에서 최대 내구도 4% 피해', str(st))
    place_elite(g, ['volatile'], extra='e.x = b.monsterX + 60 + 151 - 38; b.dealDamageToEnemy(e, e.hp + 1, false);')
    g.wait(1150)
    ctx.check(g.js('return b._hurt === 0;'), '폭발: 151px 밖이면 피해 없음')
    place_elite(g, ['volatile'], extra='e.x = b.monsterX + 22; b.dealDamageToEnemy(e, e.hp + 1, false);')
    st = g.js("""b.finalBaseDestroyed = true; b.tickTimers(1.1); b.finalBaseDestroyed = false;
        return b._hurt;""")
    ctx.check(st == 0, '폭발: 전투 종료 뒤 예약 피해 없음')

    place_elite(g, ['iron'])
    st = g.js("""const e = b.enemies[0], hp = e.hp, x = e.x;
        b.dealDamageToEnemy(e, 100, false, { knock: 1 }); b.dealDamageToEnemy(e, 10, false, { knock: 1 });
        return { damage: hp - e.hp, fixed: e.x === x, resist: e.knockResist,
            sparks: b.fx.vfx.items.filter(i => i.type === 'sparks' && i.color === '200, 205, 215').length };""")
    ctx.check(st['damage'] == 88 and st['fixed'] and st['resist'] and st['sparks'] == 1,
              '강철: 피해 20% 감소·밀리지 않음, 금속 불꽃은 0.3초 제한', str(st))
    place_elite(g, ['iron'], typ='shield')
    st = g.js("""const e = b.enemies[0], hp = e.hp; b.dealDamageToEnemy(e, 100, false);
        return hp - e.hp;""")
    ctx.check(st == 48, '강철: 기존 방어 40%와 곱해서 100 → 48 피해', str(st))

    battle_at(g, '3-1')
    st = g.js(CLEAN + """const es = Array.from({ length: 24 }, () => b.spawnMinion('guard', { x: 1100, elite: true }));
        const knight = b.spawnMinion('demonknight', { x: 1100, elite: true });
        return { count: [...es, knight].every(e => e.affixes.length === 1),
            reward: es.every(e => e.reward === 5), knight: knight.dom.dataset.name };""")
    ctx.check(st['count'] and st['reward'] and '엘리트 [' in st['knight'],
              '구역 3 노말: 속성 1개·보상 ×1.25 (회의 ⑩ 11-21 — 예전엔 구역 3부터 2개), 악마기사도 속성 표시', str(st))
