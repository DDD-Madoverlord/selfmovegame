"""구역 5 (해상 요새 포세이돈: 가라앉는 오만) — 새 기획 D-085: 구역 탭·해금(4-B 다음), 배경, 새 적 행동
(해치 장벽·3초 그물·폭뢰 곡사·소나 스킬 지연·맹독 자폭·함포 직사), 해상 차단 수문 사격, 5-B 아이언클래드(압축포·폭뢰 융단폭격)·해저 화산 간헐천"""

from test_zone34 import CLEAR, CLEAN, BG, battle_at, place


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 구역 5는 4-B 전까지 잠김 → 구역 1~4를 깨면 열리고 누르면 5-1, 5-B 다음 = 6-1
    g.js(CLEAR.replace('IDS', '[1, 2, 3]') + "window.madOverlordGameV2.menuController.renderStages();")
    st = g.map_zone('ch5')
    ctx.check(st['locked'] and '오큘러스' in st['foot'], '구역 5는 4-B 보스 전까지 잠김', str(st))
    g.js(CLEAR.replace('IDS', '[1, 2, 3, 4]') + "window.madOverlordGameV2.menuController.renderStages();")
    name = g.map_zone('ch5')['name']
    st = g.js("""const S = await import('/js/engine_v2/stages_v2.js');
        return { sel: progress.selectedStage, n: S.CHAPTER5.stages.length, after4: S.nextStageOf('4-B').id, after5: S.nextStageOf('5-B').id };""")
    st['name'] = name
    ctx.check(st['sel'] == '5-1' and name.startswith('해상 요새 포세이돈') and st['n'] == 11 and st['after4'] == '5-1' and st['after5'] == '6-1',
              '4-B 클리어 → 구역 5 열림(5-1), 11판, 4-B 다음 = 5-1, 5-B 다음 = 6-1', str(st))
    g.shot('zone5_menu', '#screen-menu-v2')

    battle_at(g, '5-1')
    place(g, 'marine', 300)
    st = g.js(BG + """const e = b.enemies.find(e => e.type === 'marine');
        return { zone: sc.classList.contains('v2-zone-5'), sky: bg('sky'), city: bg('city'), ground: bg('ground'),
                 img: getComputedStyle(e.dom.querySelector('.v2-enemy__sprite')).backgroundImage };""")
    ctx.check(st['zone'] and 'st5/far.webp' in st['sky'] and 'st5/mid.webp' in st['city'] and 'st5/floor.webp' in st['ground'] and 'marine_walk' in st['img'],
              '구역 5 배경 3층(폭풍 바다·크레인 띠·젖은 갑판) + 작살총 해병 그림', str(st))

    # 해상 차단 수문: 다가가면 전기 작살
    g.js(CLEAN + "b.distanceTraveled = b.stage.midAt - 0.5; b.playerSpeed = 100;")
    g.wait(1200)
    g.js(CLEAN + "const t = b.enemies.find(e => e.isBuilding); b.monsterX = t.x - 100 - 380; m.setMonsterPosition(b.monsterX);")
    g.wait(2600)
    st = g.js("const t = b.enemies.find(e => e.isBuilding); return { art: t && t.art, hurt: b._hurt };")
    ctx.check(st['art'] == 'st5_fort' and st['hurt'] > 0, '해상 차단 수문: 다가가면 전기 작살', str(st))
    g.js("const t = b.enemies.find(e => e.isBuilding); if (t) { t.dom.remove(); b.enemies = b.enemies.filter(e => e !== t); } b.monsterX = 150; m.setMonsterPosition(150);")

    place(g, 'hatchshield', 260, 'e.cd.build = 99;')
    g.wait(1600)
    ctx.check(g.js("return b.enemies.some(e => e.isBarricade && e.art === 'st5_barr');"), '격벽 방패수: 해치 장벽을 세움')
    place(g, 'netgunner', 250, 'e.cd.skill = 99;')
    g.wait(1200)
    ctx.check(g.js("return b.pRootT;") > 2, '그물망 사수: 3초 속박')
    place(g, 'mineman', 260, 'e.cd.skill = 99;')
    g.wait(1600)
    ctx.check(g.js("return b._hurt;") > 0, '수뢰 투척병: 곡사 폭뢰 피해')
    st = g.js(CLEAN + "window.__cd0 = { ...b.skillCd }; const e = b.spawnMinion('sonardrone', { x: b.frontX() + 280, elite: false }); e.speed = 0; e.cd.skill = 99; return parseFloat(e.dom.style.bottom);")
    g.wait(1000)
    cd = g.js("return { before: window.__cd0, after: { ...b.skillCd } };")
    ctx.check(st > 100 and any(cd['after'].get(k, 0) > cd['before'].get(k, 0) + 0.3 for k in ('arm', 'body') if k in cd['before']),
              '소나 드론: 떠서 다님 + 스킬 쿨다운 늘림', str([st, cd]))
    g.js(CLEAN + "const e = b.spawnMinion('toxicdiver', { x: b.frontX() + 30, elite: false });")
    g.wait(400)
    st = g.js("return { hurt: b._hurt, puddles: b.hazards.length, alive: b.enemies.some(e => e.type === 'toxicdiver') };")
    ctx.check(st['hurt'] > 0 and st['puddles'] >= 1 and not st['alive'], '맹독 잠수부: 붙으면 자폭 → 피해 + 산성 장판 (자기는 쓰러짐)', str(st))
    g.js(CLEAN + "b.monsterX = 420; m.setMonsterPosition(420); const e = b.spawnMinion('deckgun', { x: 420 + 100 + 500, elite: false }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1200)
    st = g.js("return { x: b.monsterX, hurt: b._hurt };")
    ctx.check(st['x'] < 420 and st['hurt'] > 0, '함포 포탑: 일직선 철갑 유탄 → 피해 + 조금 밀려남', str(st))
    g.shot('zone5_enemies', '#screen-battle-v2')

    # 5-B: 중앙 통제 시추선 · 아이언클래드 · 압축포 · 폭뢰 융단 · 해저 화산
    g.js("b.stopBattle();" + CLEAR.replace('IDS', '[1, 2, 3, 4, 5]'))
    battle_at(g, '5-B')
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = 100;")
    g.wait(2600)
    st = g.js(BG + "const f = b.enemies.find(e => e.isFinal); return { art: f && f.art, boss: b.boss && b.boss.type, sky: bg('sky') };")
    ctx.check(st['art'] == 'st5_base' and st['boss'] == 'ironclad' and 'st5/far_boss' in st['sky'], '5-B: 중앙 통제 시추선 · 아이언클래드 · 보스전 배경', str(st))
    g.js(CLEAN + "b.monsterX = 420; m.setMonsterPosition(420); b.boss.x = 760; b.boss.dom.style.left = '760px'; b.boss.speed = 0;"
         "b.boss.cd.cannon = b.boss.t.cannon.every - 0.05; b.boss.cd.barrage = -99;")
    g.wait(1700)
    st = g.js("return { hurt: b._hurt, x: b.monsterX };")
    ctx.check(st['hurt'] > 0 and st['x'] < 420, '심해 압축포: 조준 뒤 물기둥 → 피해 + 크게 밀려남', str(st))
    g.js("b._hurt = 0; b.boss.cd.cannon = -99; b.boss.cd.barrage = b.boss.t.barrage.every - 0.05;")
    g.wait(2600)
    ctx.check(g.js("return b._hurt;") > 0, '폭뢰 융단폭격: 예고 원 뒤 연쇄 폭발')
    g.shot('zone5_boss', '#screen-battle-v2')
    g.js("b._hurt = 0; b.boss.cd.barrage = -99; b.geyserTimer = b.stage.boss.geysers.every - 0.05;")
    g.wait(int(2200 + 1200))
    st = g.js("return { hurt: b._hurt, fire: b.hazards.filter(h => h.fire > 0).length };")
    ctx.check(st['hurt'] > 0 and st['fire'] >= 2, '해저 화산: 맹독 간헐천 → 불 장판 위에서 지속 피해', str(st))
    g.shot('zone5_geyser', '#screen-battle-v2')
