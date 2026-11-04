"""스테이지(B단계): 선택·잠금, 별 3개·보너스·다음 스테이지, 구역 1 적 능력(새 기획 D-085), 보스 WMD-알파·궤도 폭격, 파츠 색, 소환 유닛 외형"""


def clear_stage_fast(g, keep_hp=True):
    """지금 전투를 빠르게 이김: 요새 → 최종 기지 파괴 (체력 유지)"""
    g.js("b.spawnInterval = 999; b.distanceTraveled = b.stage.midAt - 0.5;")
    g.wait(900)
    g.js("const bd = b.enemies.find(e => e.isBuilding); if (bd) { bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 }); }")
    g.wait(2200)
    g.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);"
         f"{'b.playerHp = b.maxPlayerHp;' if keep_hp else 'b.playerHp = b.maxPlayerHp * 0.3;'} b.distanceTraveled = b.stage.finalAt - 0.5;")
    g.wait(1500)
    g.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);"
         "const bd = b.enemies.find(e => e.isBuilding && e.isFinal); if (bd) { bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 }); }")
    g.wait(7200)


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 선택·잠금
    st = g.js("""const menu = window.madOverlordGameV2.menuController;
        const before = progress.selectedStage;
        menu.selectStage('1-2');
        return { before, after: progress.selectedStage, foot: document.getElementById('menu-map-foot-v2').textContent };""")
    ctx.check(st['before'] == '1-1', '처음 선택 스테이지 = 1-1', str(st['before']))
    ctx.check(st['after'] == '1-1' and '잠김' in st['foot'], '잠긴 1-2는 선택 안 됨', st['foot'])
    g.shot('stage_menu', '#screen-menu-v2')

    # 1-1: 징집 보병만, 거리 800
    g.page.click('#btn-to-battle-v2')
    g.wait(2900)
    st = g.js("b.spawnInterval = 0.2; return { id: b.stage.id, max: b.maxDistance };")
    g.wait(1200)
    types = g.js("return [...new Set(b.enemies.filter(e => !e.isBuilding).map(e => e.type))];")
    ctx.check(st['id'] == '1-1' and st['max'] == 800, '1-1 스테이지 데이터로 전투', str(st))
    ctx.check(types == ['conscript'], '1-1 적 = 징집 보병만', str(types))

    # 체력 유지 클리어 → 별 3개 + 새 별 보너스 900 + 다음 스테이지 버튼
    dm0 = g.js('return gameState.darkMatter;')
    clear_stage_fast(g, keep_hp=True)
    st = g.js("""return { stars: progress.stage('1-1').stars, cleared: progress.stage('1-1').cleared,
        next: !!document.querySelector('.v2-result [data-act="next"]'), news: document.querySelectorAll('.v2-result__star em').length };""")
    ctx.check(st['stars'] == [True, True, True] and st['cleared'], '1-1 별 3개 기록', str(st['stars']))
    ctx.check(st['news'] == 3, '결과 화면: NEW 별 3개')
    ctx.check(st['next'], '결과 화면: 다음 스테이지 버튼')
    gained = g.js('return gameState.darkMatter;') - dm0
    ctx.check(gained >= 500 + 1500 + 900, '보상: 요새 + 기지 + 새 별 보너스 900', str(gained))
    g.shot('stage_result', '#screen-battle-v2')
    g.page.click('.v2-result [data-act="next"]')
    g.wait(1500)
    ctx.check(g.js('return b.stage.id;') == '1-2', '다음 스테이지 버튼 → 1-2 출격')

    # 구역 1 적 능력 (새 기획 D-085, 1-4 설정으로 직접 소환)
    g.js("progress.selectStage('1-4'); progress.stages['1-3'] = { stars: [true,true,false], cleared: true, bestTime: 60 };")
    g.battle('mech', wait_ms=2900)
    ctx.check(g.js('return b.stage.id;') == '1-4', '1-4 스테이지 열림·출격')
    CLEAR = "b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.pSlowT = 0; b.pStunT = 0; b.pRootT = 0; b.playerHp = b.maxPlayerHp;"
    g.js("b.spawnInterval = 999; " + CLEAR)
    st = g.js("""const e = b.spawnMinion('riot', { x: b.monsterX + 600, elite: false }); const h0 = e.hp; b.dealDamageToEnemy(e, 100, false, null);
        b.enemies.forEach(o => o.dom && o.dom.remove()); b.enemies = [];
        const n0 = b.enemies.length; b.stage.enemy.mix = { riot: 1 }; b.spawnMinion(); const squad = b.enemies.filter(o => o.type === 'riot').length;
        return { cut: h0 - e.hp, knock: e.knockResist, squad };""")
    ctx.check(abs(st['cut'] - 60) < 0.01 and st['knock'] and st['squad'] == 3, '진압 방패병: 받는 피해 40% 감소 + 밀리지 않음 + 3열 대열로 나옴', str(st))
    g.js(CLEAR + "const e = b.spawnMinion('taser', { x: b.monsterX + 300, elite: false }); e.cd.skill = 99;")
    g.wait(1300)
    ctx.check(g.js('return b.pRootT > 0;'), '테이저 요원: 전기 올가미로 진격 정지(속박)')
    g.js(CLEAR + "const e = b.spawnMinion('rocket', { x: b.monsterX + 360, elite: false }); e.cd.skill = 99; e.speed = 0; window.__hp0 = b.playerHp;")
    g.wait(2200)
    ctx.check(g.js('return b.playerHp < window.__hp0 - 30;'), '로켓 보병: 곡사 로켓 큰 피해', str(g.js('return [window.__hp0, b.playerHp];')))
    st = g.js(CLEAR + """const cd0 = { ...b.skillCd }; const e = b.spawnMinion('empdrone', { x: b.monsterX + 300, elite: false }); e.cd.skill = 99; e.speed = 0;
        window.__cd0 = cd0; return { bottom: parseFloat(e.dom.style.bottom) };""")
    g.wait(1200)
    cd = g.js("return { before: window.__cd0, after: { ...b.skillCd } };")
    grew = any(cd['after'].get(k, 0) > cd['before'].get(k, 0) + 0.3 for k in ('arm', 'body') if k in cd['before'])   # +1.5초 뒤 그새 줄어든 만큼
    ctx.check(st['bottom'] > 100 and grew, 'EMP 드론: 떠서 다님 + 스킬 쿨다운 늘림', str(st) + str(cd))
    g.js(CLEAR + "const e = b.spawnMinion('hound', { x: b.monsterX + 110, elite: false }); e.cd.skill = 99; e.hp = e.maxHp = 99999; e.dps = 0; window.__hp0 = b.playerHp;")
    g.wait(2600)
    ctx.check(g.js('return b.playerHp < window.__hp0;'), '전투 군견: 물어뜯어 출혈 피해')
    g.js(CLEAR + "const e = b.spawnMinion('flamer', { x: b.monsterX + 250, elite: false }); e.cd.skill = 99; e.speed = 0;")
    g.wait(900)
    st = g.js("window.__hp0 = b.playerHp; return { fire: b.hazards.filter(h => h.fire > 0).length, cls: document.querySelectorAll('.v2-puddle--fire').length };")
    g.wait(800)
    ctx.check(st['fire'] >= 1 and st['cls'] >= 1 and g.js('return b.playerHp < window.__hp0;'), '화염방사병: 네이팜 불 장판 위에서 불 피해', str(st))
    g.shot('stage_enemies', '#screen-battle-v2')

    # 보스전: WMD-알파 등장 + 플라스마 레이저 + 궤도 폭격
    g.js("progress.selectStage('1-B'); progress.stages['1-10'] = { stars: [true,true,true], cleared: true, bestTime: 60 };")
    g.battle('kaiju', wait_ms=2900)
    g.js("b.spawnInterval = 999; b.midBaseSpawned = true; b.midBaseDestroyed = true; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.distanceTraveled = b.stage.finalAt - 0.5;")
    g.wait(1500)
    st = g.js("return { boss: !!b.boss && b.boss.type, bar: !document.getElementById('hud-boss-v2').hidden };")
    ctx.check(st['boss'] == 'wmdalpha' and st['bar'], '보스전: WMD-알파 등장 + 보스 체력 바', str(st))
    g.js("b.playerHp = b.maxPlayerHp; window.__hp0 = b.playerHp; b.boss.cd.laser = b.boss.t.laser.every - 0.05;")
    g.wait(1900)
    ctx.check(g.js('return b.playerHp < window.__hp0;'), 'WMD-알파: 플라스마 레이저 피해', str(g.js('return [window.__hp0, b.playerHp];')))
    st = g.js("""b.playerHp = b.maxPlayerHp; window.__hp0 = b.playerHp; b.boss.cd.laser = -99;
        window.__grunt = b.spawnMinion('conscript', { x: b.monsterX - 3, elite: false }); window.__grunt.hp = window.__grunt.maxHp = 1000; window.__grunt.speed = 0;
        b.orbitalTimer = b.stage.boss.orbital.every - 0.05; return b.stage.boss.orbital.warn;""")
    g.wait(int(st * 1000) + 900)
    st = g.js("return { hit: b.playerHp < window.__hp0, grunt: window.__grunt.hp < 1000 };")
    ctx.check(st['hit'] and st['grunt'], '궤도 폭격: 붉은 원 안의 주인공·적 병사 모두 피해', str(st))
    g.shot('stage_boss', '#screen-battle-v2')

    # 파츠 색: 같은 캐릭터 변형 파츠 / 안 산 부위 흐리게 / 소환 유닛 외형
    # (다른 캐릭터 파츠 테두리 빛은 연구소가 고른 캐릭터 파츠만 보여 주면서 없앰, D-051)
    g.battle(('head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel'), wait_ms=1200)
    f = g.js("return m.rigBattle.partFilters || {};")
    ctx.check('body' in f and 'armR_cannon' in f and 'head' in f, '파츠 색: 바이저 머리·아다만티움 몸통·레이저 팔 변형 색', str(list(f)))
    ctx.check(not any('drop-shadow' in v for v in f.values()), '파츠 색: 다른 캐릭터 테두리 빛 없음', str(f))
    st = g.js("""const { rigConfigFor } = await import('/js/engine_v2/rig/rigAvatar.js');
        const none = gameState.getPartById('head', 'none');
        const c = rigConfigFor({ head: none, body: none, arm: none, leg: none }, 'hero');
        return { ch: c && c.character, torso: c && c.filters.torso, noFallback: rigConfigFor({ head: none, body: none, arm: none, leg: none }) };""")
    ctx.check(st['ch'] == 'hero' and 'grayscale' in (st['torso'] or '') and st['noFallback'] is None,
              '파츠 색: 몸통이 없으면 고른 캐릭터를 흐리게 (고른 캐릭터가 없으면 그림 없음)', str(st))
    g.js("b.spawnAllyMinion(b.monsterX + 60, 'chimera'); b.spawnAllyMinion(b.monsterX + 90, 'mind');")
    cls = g.js("return b.allies.map(a => a.dom.className);")
    ctx.check(any('chimera-minion-v2' in c for c in cls) and any('v2-mind' in c for c in cls), '소환 유닛: 미니 괴인 / 세뇌 보병 외형', str(cls))
    g.shot('stage_parts', '#screen-battle-v2')
