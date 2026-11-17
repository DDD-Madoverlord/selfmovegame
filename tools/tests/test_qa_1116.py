"""디스코드 QA (11-14 ~ 11-16, #세션-수정사항 홍도도) 회귀 검사
- 진격이 빠르면(근거리 이동 ×2) 거점이 설 때 오른쪽에서 걸어오던 적이 거점 뒤에 남던 것 → 거점 앞으로 달려 나옴
- 거점이 있을 때 다른 적이 불러낸 적·3열 대열이 거점 자리·뒤에 생기던 것 → 거점 앞에서만
- 차원 도약: 시간 균열이 떠난 자리(주인공 뒤)에 남아 적이 밟을 일이 없던 것 → 도착한 자리 앞쪽 + 받는 피해 +15%
- 실 그물 걸음: 실이 걸은 자리(뒤)에 남던 것 → 앞쪽 바닥에 깔려 다가오는 적이 느려짐
- 잠항: 3초 숨기 → 1.2초 숨었다가 바로 솟구쳐 기절 → (D-146) 상어 급강하: 뛰어올라(피해 무시) 1초 뒤 앞으로 내리꽂혀 기절"""

CLEAR = """b.autoSkills = false; b.spawnInterval = 999;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom?.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);"""
SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))
BACK = "progress.selectedStage = '1-1'; b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectedStage = '1-1';")

    # ---- 거점이 설 때 그 자리·뒤에 있던 적은 거점 앞으로 ----
    g.battle('mech', wait_ms=2000)
    g.js(CLEAR)
    st = g.js("""b.setAutoSkills?.(false); gameTime.speed = 1;
        for (let i = 0; i < 5; i++) b.spawnMinion();
        const xs = [400, 760, 830, 900, 980];
        const units = b.enemies.filter(e => !e.isBuilding);
        units.forEach((e, i) => { e.x = xs[i]; e.speed = 0; e.dps = 0; e.hp = e.maxHp = 900000; e.dom.style.left = e.x + 'px'; });
        b.spawnMidBase();
        const base = b.enemies.find(e => e.isBuilding);
        const moving = units.filter(e => e.sortie).length;
        await new Promise(r => setTimeout(r, 120));
        const mid = units.map(e => Math.round(e.x));
        await new Promise(r => setTimeout(r, 700));
        const end = units.map(e => Math.round(e.x));
        return { base: base && base.x, moving, mid, end, left: units.filter(e => e.sortie).length,
            dom: units.every(e => Math.abs(parseFloat(e.dom.style.left) - e.x) < 1) };""")
    line = (st['base'] or 0) - 30
    ctx.check(st['base'] and st['moving'] == 4 and st['end'][0] == 400,
              '거점이 설 때: 거점 자리·뒤에 있던 적 4기만 옮김 (앞에 있던 적은 그대로)', str(st))
    ctx.check(all(x <= line + 1 for x in st['end']) and st['left'] == 0 and st['dom'],
              f'거점이 선 뒤 0.8초: 모든 적이 거점 앞 줄(x ≤ {line})에 섬 — 거점 뒤에 남는 적 없음', str(st))
    ctx.check(st['end'][1] < st['end'][2] < st['end'][3] < st['end'][4] and st['end'][1] > line - 150,
              '거점 앞으로 나온 적: 왼쪽부터 차례 그대로, 한 점에 겹치지 않고 거점 앞 150px 안', str(st))
    ctx.check(any(line < x < 980 for x in st['mid'][1:]) or st['mid'][4] < 980,
              '거점 앞으로는 순간 이동이 아니라 달려 나옴 (0.12초 때 가는 중)', str(st))
    g.shot('qa1116_base_sortie', '#screen-battle-v2')

    # 거점이 있을 때 불러낸 적·대열도 거점 앞에서만
    st = g.js("""const { ENEMY_TYPES } = await import('/js/engine_v2/enemies_v2.js');
        const base = b.enemies.find(e => e.isBuilding);
        const far = b.spawnMinion('guard', { x: base.x + 120, elite: false });
        const squadType = Object.keys(ENEMY_TYPES).find(k => ENEMY_TYPES[k].squad);
        const before = new Set(b.enemies);
        const mix = b.stage.enemy.mix; b.stage.enemy.mix = { [squadType]: 1 };
        b.spawnMinion(); b.stage.enemy.mix = mix;
        const squad = b.enemies.filter(e => !before.has(e)).map(e => Math.round(e.x));
        return { line: base.x - 30, far: far.x, squadType, squad };""")
    ctx.check(st['far'] <= st['line'], '거점이 있을 때 거점 뒤 자리로 부른 적도 거점 앞에서 나옴', str(st))
    ctx.check(len(st['squad']) == 3 and all(x <= st['line'] for x in st['squad']) and len(set(st['squad'])) == 3,
              f"거점이 있을 때 3열 대열({st['squadType']})은 거점 앞쪽으로 줄을 섬 (예전엔 거점 자리로 겹침)", str(st))
    g.js(BACK)
    g.wait(400)

    # 거점이 없을 때 대열은 예전처럼 뒤(오른쪽)로
    g.battle('mech', wait_ms=1500)
    g.js(CLEAR)
    st = g.js("""const { ENEMY_TYPES } = await import('/js/engine_v2/enemies_v2.js');
        const squadType = Object.keys(ENEMY_TYPES).find(k => ENEMY_TYPES[k].squad);
        const mix = b.stage.enemy.mix; b.stage.enemy.mix = { [squadType]: 1 };
        b.spawnMinion(); b.stage.enemy.mix = mix;
        return b.enemies.filter(e => !e.isBuilding).map(e => Math.round(e.x));""")
    ctx.check(len(st) == 3 and min(st) >= 975 and max(st) > 1000, '거점이 없을 때 대열은 그대로 오른쪽 끝에서 뒤로 줄을 섬', str(st))
    g.js(BACK)
    g.wait(400)

    # ---- 차원 도약: 균열은 도착한 자리 앞쪽, 안의 적 감속 + 받는 피해 +15% ----
    g.battle(SET('mech', 'm'), wait_ms=1800)
    g.js(CLEAR)
    g.place_enemies(n=3, gap=60, first=400, hp=900000, speed=0, dps=0)
    st = g.js("""gameTime.speed = 1; const x0 = b.monsterX;
        b.skillCd.body = 0; const used = b.useSkill('body');
        await new Promise(r => setTimeout(r, 700));
        const z = b.kitZones.find(k => k.tag === 'rift');
        const e0 = b.enemies.filter(e => !e.isBuilding).sort((p, q) => p.x - q.x)[0];
        return { used, moved: Math.round(b.monsterX - x0), front: b.frontX(), z: z && { x: Math.round(z.x), w: z.w, t: +z.t.toFixed(1), vuln: z.vuln, field: z.field },
            art: b.fx.vfx.items.some(it => it.fieldStyle === 'timeRift') && b.fx.vfx.items.some(it => it.type === 'afterimage' || it.sheet === 'time_stop'),
            slow: e0.slowT > 0, vuln: e0.kitVulnT > 0, vulnAmt: e0.kitVuln };""")
    z = st['z'] or {}
    ctx.check(st['used'] and st['moved'] > 100 and st['z'] and z['x'] + z['w'] > st['front'] + 150 and z['x'] >= st['front'] - 60,
              '차원 도약: 시간 균열이 도착한 자리 앞쪽에 깔림 (예전엔 떠난 자리 = 주인공 뒤)', str(st))
    ctx.check(st['slow'] and st['vuln'] and abs((st['vulnAmt'] or 0) - 0.15) < 0.001,
              '차원 도약: 균열 안의 적은 감속 + 받는 피해 +15%', str(st))
    ctx.check(z.get('field') == 'timeRift' and st['art'], '차원 도약: 청록 시계 마법진 시간 균열 + 잔상 그림 (D-143)', str(st))
    g.shot('qa1116_warp_rift', '#screen-battle-v2')
    g.js(BACK)
    g.wait(400)

    # ---- 실 그물 걸음: 걸음마다 앞쪽 바닥에 실 그물, 다가오는 적이 밟으면 느려짐 ----
    g.battle(SET('saint', 'b'), wait_ms=1800)
    g.js(CLEAR)
    g.wait(900)
    st = g.js("""gameTime.speed = 1;
        const walked = b.kitZones.filter(k => k.tag === 'web').length;
        b.kitOnStep();
        const z = b.kitZones.filter(k => k.tag === 'web').at(-1);
        const front = b.frontX();
        const info = { walked, dx: Math.round(z.x - front), w: z.w, sec: z.sec, net: b.kitZones.some(k => k.tag === 'web' && k.field === 'threadNet')
            && b.fx.vfx.items.some(it => it.fieldStyle === 'threadNet') };
        b.spawnMinion(); const e = b.enemies.filter(o => !o.isBuilding).at(-1);
        e.x = z.x + z.w - 60; e.speed = 30; e.dps = 0; e.hp = e.maxHp = 900000; e.dom.style.left = e.x + 'px';
        await new Promise(r => setTimeout(r, 400));
        return { ...info, slow: e.slowT > 0, ahead: e.x > front };""")
    ctx.check(st['walked'] >= 1 and st['dx'] == 60 and st['w'] == 240 and st['sec'] == 4,
              '실 그물 걸음: 걷는 동안 걸음마다 앞쪽 60~300px 바닥에 실 그물 4초 (예전엔 뒤쪽 60px · 2초)', str(st))
    ctx.check(st['slow'] and st['ahead'], '실 그물 걸음: 앞에서 다가오는 적이 그물을 밟으면 느려짐', str(st))
    ctx.check(st['net'], '실 그물 걸음: 바닥에 붉은 실 그물 그림 (D-143)', str(st))
    g.js(BACK)
    g.wait(400)

    # ---- 상어 급강하 (예전 잠항, D-146): 뛰어올라(피해 무시) 1초 뒤 앞으로 내리꽂혀 기절 ----
    g.battle(SET('chimera', 'w'), wait_ms=1800)
    g.js(CLEAR)
    g.place_enemies(n=2, gap=60, first=200, hp=900000, speed=0, dps=0)
    st = g.js("""gameTime.speed = 1;
        const es = b.enemies.filter(e => !e.isBuilding); const x0 = b.monsterX;
        b.skillCd.body = 0; const used = b.useSkill('body');
        await new Promise(r => setTimeout(r, 600));
        const hp0 = b.playerHp; b.damagePlayer(500, 0);
        const during = { invuln: b.kitFlag('invuln'), took: Math.round(hp0 - b.playerHp), stun: es.some(e => e.stunT > 0) };
        await new Promise(r => setTimeout(r, 1300));
        return { used, during, after: { invuln: b.kitFlag('invuln'), stun: es.every(e => e.stunT > 0), hit: es.every(e => e.hp < e.maxHp), moved: Math.round(b.monsterX - x0) }, cd: Math.round(b.skillCd.body) };""")
    ctx.check(st['used'] and st['during']['invuln'] and st['during']['took'] == 0 and not st['during']['stun'],
              '상어 급강하 0.6초 때: 공중(피해 무시), 아직 내리꽂히지 않음', str(st))
    ctx.check(not st['after']['invuln'] and st['after']['stun'] and st['after']['hit'] and st['after']['moved'] > 0,
              '상어 급강하 1.9초 때: 앞으로 내리꽂혀 앞 적들이 피해 + 기절', str(st))
    ctx.check(8 <= st['cd'] <= 11, '상어 급강하 쿨다운 12초 (쓴 뒤 1.9초 → 약 10초 남음)', str(st))
    g.js(BACK)
    g.wait(300)
