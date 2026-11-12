"""구역 6 (기적의 대병동: 피에 젖은 성역) — 새 기획 D-085 (예전 "성왕국 변두리" D-078을 바꿈): 구역 탭·해금(5-B 다음, 다음 난이도는 6-B로 — D-119),
배경, 새 적(가시 장벽·독 장판 성수·마취 기절·수혈 드론·피의 자폭·구급 마차 보병 배출), 화형의 소각로 불 장판,
6-B 탐욕의 심장(핏빛 파동·혈정석 쐐기·생명력 착취)·강제 헌혈 → 승리, 파견 구역 6.
예전 구역 6 종류(병동 간수·그림자 집행자·헌금 기사)는 지금 구역에 안 나오지만 행동은 남아 있어 직접 불러 확인"""

from test_zone34 import CLEAR, CLEAN, BG, battle_at, place


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 구역 6은 5-B 전까지 잠김 → 구역 1~5를 깨면 열리고 누르면 6-1, 다음 난이도는 그룹 1 마지막 판 6-B로 (D-119, 예전 4-B)
    g.js(CLEAR.replace('IDS', '[1, 2, 3, 4]') + "window.madOverlordGameV2.menuController.renderStages();")
    st = g.map_zone('ch6')
    ctx.check(st['fog'].startswith('기적의 대병동') and st['locked'] and '아이언클래드' in st['foot'], '구역 6은 5-B 보스 전까지 잠김 (안개에 구역 이름)', str(st))
    g.js(CLEAR.replace('IDS', '[1, 2, 3, 4, 5]') + "window.madOverlordGameV2.menuController.renderStages();")
    name = g.map_zone('ch6')['name']
    st = g.js("""const S = await import('/js/engine_v2/stages_v2.js'), D = await import('/js/engine_v2/difficulty_v2.js');
        return { sel: progress.selectedStage, n: S.CHAPTER6.stages.length, after5: S.nextStageOf('5-B').id, final: D.FINAL_STAGE_ID, hard: D.difficultyUnlocked('hard', progress) };""")
    st['name'] = name
    ctx.check(st['sel'] == '6-1' and '피에 젖은 성역' in st['name'] and st['n'] == 11 and st['after5'] == '6-1'
              and st['final'] == '6-B' and not st['hard'], '5-B 클리어 → 구역 6 열림(6-1), 11판, 하드는 아직(6-B를 깨야 열림)', str(st))
    g.shot('zone6_menu', '#screen-menu-v2')

    battle_at(g, '6-1')
    place(g, 'orderly', 300)
    st = g.js(BG + """const e = b.enemies.find(e => e.type === 'orderly');
        return { zone: sc.classList.contains('v2-zone-6'), sky: bg('sky'), city: bg('city'), ground: bg('ground'), skyF: getComputedStyle(document.getElementById('bg-sky-v2')).filter,
                 img: getComputedStyle(e.dom.querySelector('.v2-enemy__sprite')).backgroundImage };""")
    ctx.check(st['zone'] and 'st6/far.webp' in st['sky'] and 'st6/mid.webp' in st['city'] and 'st6/floor.webp' in st['ground']
              and 'grayscale' not in st['skyF'] and 'orderly_walk' in st['img'], '구역 6 배경 3층(스테인드글라스·수술대 띠·핏빛 대리석) + 간병 보병 그림', str(st))

    # 화형의 소각로: 다가가면 화염 + 불 장판
    g.js(CLEAN + "b.distanceTraveled = b.stage.midAt - 0.5; b.playerSpeed = 100;")
    g.wait(1200)
    g.js(CLEAN + "const t = b.enemies.find(e => e.isBuilding); b.monsterX = t.x - 100 - 260; m.setMonsterPosition(b.monsterX);")
    g.wait(3500)
    st = g.js("const t = b.enemies.find(e => e.isBuilding); return { art: t && t.art, hurt: b._hurt, fire: b.hazards.filter(h => h.fire > 0).length };")
    ctx.check(st['art'] == 'st6_fort' and st['hurt'] > 0 and st['fire'] >= 1, '화형의 소각로: 다가가면 화염 + 불 장판', str(st))
    g.shot('zone6_fort', '#screen-battle-v2')
    g.js("const t = b.enemies.find(e => e.isBuilding); if (t) { t.dom.remove(); b.enemies = b.enemies.filter(e => e !== t); } b.monsterX = 150; m.setMonsterPosition(150);")

    place(g, 'maidenshield', 260, 'e.cd.build = 99;')
    g.wait(1600)
    ctx.check(g.js("return b.enemies.some(e => e.isBarricade && e.art === 'st6_barr');"), '철의 처녀 방패수: 장벽을 세움')
    place(g, 'holywater', 220, 'e.cd.skill = 99;')
    g.wait(1500)
    st = g.js("return { holy: document.querySelectorAll('.v2-puddle--holy').length, hurt: b._hurt };")
    ctx.check(st['holy'] >= 1 and st['hurt'] > 0, '오염된 성수 투척병: 보랏빛 독 장판 위에서 지속 피해', str(st))
    place(g, 'anesthetist', 260, 'e.cd.skill = 99;')
    g.wait(1100)
    ctx.check(g.js("return b.pStunT;") > 1, '마취의 주술사: 마취 가스 → 2초 기절')
    place(g, 'bloodbagdrone', 300, "e.cd.skill = 99; const s = b.spawnMinion('orderly', { x: b.frontX() + 240, elite: false }); s.speed = 0; s.hp = s.maxHp * 0.3;")
    g.wait(700)
    st = g.js("const d = b.enemies.find(e => e.type === 'bloodbagdrone'), s = b.enemies.find(e => e.type === 'orderly'); return { fly: parseFloat(d.dom.style.bottom), hp: s.hp / s.maxHp };")
    ctx.check(st['fly'] > 100 and st['hp'] > 0.3, '수혈 팩 드론: 떠서 다니며 병사 치유', str(st))
    g.js(CLEAN + "b.spawnMinion('bloated', { x: b.frontX() + 30, elite: false });")
    g.wait(400)
    st = g.js("return { hurt: b._hurt, slow: b.pSlowT > 0, alive: b.enemies.some(e => e.type === 'bloated') };")
    ctx.check(st['hurt'] > 0 and st['slow'] and not st['alive'], '강제 수혈 실험체: 닿으면 터짐 → 피해 + 감속', str(st))
    place(g, 'ambulance', 400, 'e.cd.spawn = 99;')
    g.wait(600)
    st = g.js("const a = b.enemies.find(e => e.type === 'ambulance'); return { orderly: b.enemies.filter(e => e.type === 'orderly').length, spawned: (a.spawned || []).length };")
    ctx.check(st['orderly'] >= 1 and st['spawned'] >= 1, '기계화 구급 마차: 하급 사제를 내보냄', str(st))
    g.shot('zone6_enemies', '#screen-battle-v2')

    # 예전 구역 6 종류 (행동은 남아 있음): 병동 간수 사슬 속박 · 그림자 집행자 은신 · 헌금 기사 축복
    place(g, 'warden', 250, 'e.cd.skill = 99;')
    g.wait(1100)
    ctx.check(g.js("return b.pRootT;") > 0, '(예전 종류) 병동 간수: 사슬 투척 → 속박')
    place(g, 'shade', 420)
    g.wait(200)
    st = g.js("const e = b.enemies.find(e => e.type === 'shade'); const hp = e.hp; b.dealDamageToEnemy(e, 100, false); return { hidden: e.hidden, lost: Math.round(hp - e.hp) };")
    ctx.check(st['hidden'] and st['lost'] == 50, '(예전 종류) 그림자 집행자: 숨어 있는 동안 받는 피해 50% 감소', str(st))
    place(g, 'tithe', 300, "const s = b.spawnMinion('orderly', { x: b.frontX() + 360, elite: false }); s.speed = 0;")
    g.wait(400)
    st = g.js("const s = b.enemies.find(e => e.type === 'orderly'); const hp = s.hp; b.dealDamageToEnemy(s, 100, false); return { blessed: !!s.blessed, lost: Math.round(hp - s.hp) };")
    ctx.check(st['blessed'] and st['lost'] == 80, '(예전 종류) 헌금 기사: 주변 적 받는 피해 20% 감소', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # 6-B: 성배의 성역 앞 탐욕의 심장 → 파동·쐐기·착취·강제 헌혈 → 쓰러뜨리면 승리
    g.js(CLEAR.replace('IDS', '[1, 2, 3, 4, 5, 6]'))
    battle_at(g, '6-B')
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = 100;")
    g.wait(2600)
    g.js("window.__finalArt = b.enemies.find(e => e.isFinal)?.art;")
    g.open_boss_gate()   # 11-05 피드백 17: 보스는 최종 거점을 부순 뒤 나옴
    st = g.js("const f = { art: window.__finalArt }; return { art: f && f.art, boss: b.boss && b.boss.type, fly: b.boss && parseFloat(b.boss.dom.style.bottom) };")
    ctx.check(st['art'] == 'st6_base' and st['boss'] == 'grailheart' and st['fly'] > 100, '6-B: 성배의 성역 · 떠 있는 탐욕의 심장', str(st))
    g.shot('zone6_boss', '#screen-battle-v2')
    g.js(CLEAN + "b.monsterX = 420; m.setMonsterPosition(420); b.boss.x = 760; b.boss.dom.style.left = '760px'; b.boss.speed = 0;"
         "b.boss.cd.pulse = b.boss.t.pulse.every - 0.05; b.boss.cd.shards = -99; b.boss.cd.drain = -99;")
    g.wait(900)
    st = g.js("return { hurt: b._hurt, x: b.monsterX };")
    ctx.check(st['hurt'] > 0 and st['x'] < 420, '핏빛 파동: 피해 + 밀쳐냄', str(st))
    g.js("b._hurt = 0; b.boss.cd.pulse = -99; b.boss.cd.shards = b.boss.t.shards.every - 0.05;")
    g.wait(1200)
    ctx.check(g.js("return b._hurt;") > 0, '혈정석 쐐기: 부채꼴 산탄 피해')
    g.js("b._hurt = 0; b.pRootT = 0; b.boss.cd.shards = -99; b.boss.hp = b.boss.maxHp * 0.5; window.__hp = b.boss.hp;"
         "b.boss.x = b.frontX() + 300; b.boss.dom.style.left = b.boss.x + 'px'; b.boss.cd.drain = b.boss.t.drain.every - 0.05;")
    g.wait(1600)
    st = g.js("return { hurt: b._hurt, root: b.pRootT > 0, healed: b.boss.hp > window.__hp };")
    ctx.check(st['hurt'] > 0 and st['root'] and st['healed'], '생명력 착취: 피의 촉수 → 피해 + 속박 + 보스 회복', str(st))
    # 강제 헌혈: 실험체 3명이 심장으로 걸어감 → 닿으면 보스 회복 + 피의 방어막
    g.js("b.boss.cd.drain = -99; b.boss.hp = b.boss.maxHp * 0.5; window.__hp = b.boss.hp; b.boss.shield = 0; b.donorTimer = b.stage.boss.donors.every - 0.05;")
    g.wait(2000)
    ctx.check(g.js("return b.enemies.filter(e => e.type === 'pauper').length;") == 3, '강제 헌혈: 실험체 3명이 끌려 나옴')
    g.js("b.enemies.filter(e => e.type === 'pauper').forEach(e => { e.speed = 2000; });")
    g.wait(800)
    st = g.js("return { left: b.enemies.filter(e => e.type === 'pauper').length, healed: b.boss.hp > window.__hp, shield: b.boss.shield > 0 };")
    ctx.check(st['left'] == 0 and st['healed'] and st['shield'], '실험체가 심장에 닿으면 흡수 → 보스 회복 + 피의 방어막', str(st))
    g.shot('zone6_donors', '#screen-battle-v2')

    g.js("b.boss.shield = 0; b.boss.hp = 1; b.dealDamageToEnemy(b.boss, 1000, false);")
    g.wait(2500)
    g.js("const f = b.enemies.find(e => e.isFinal); if (f) b.dealDamageToEnemy(f, f.hp + 10, false);")
    g.wait(7000)
    st = g.js("return { win: !!document.querySelector('.v2-result.is-win'), stage: progress.stage('6-B').cleared };")
    ctx.check(st['win'] and st['stage'], '탐욕의 심장·성역 파괴 → 승리 (6-B 클리어)', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # 파견: 6-B를 깨면 구역 6 파견이 열림 (파견 그림은 아직 없음 → 전투 배경)
    st = g.js("""const D = await import('/js/ui_v2/dispatchUi_v2.js'), { ENEMY_TYPES } = await import('/js/engine_v2/enemies_v2.js');
        const z = D.DISPATCH_ZONES[6], log = D.dispatchLog({ character: 'saint', zone: 6, start: 1 });
        return { zones: progress.dispatchZones(), first: log[0].text, enemies: z.enemies.every(id => ENEMY_TYPES[id]), trek: z.trek };""")
    ctx.check(6 in st['zones'] and '기적의 대병동' in st['first'] and st['enemies'] and st['trek'] is None,
              '파견: 6-B 클리어 → 구역 6 열림, 기록에 "기적의 대병동"', str(st))
    g.js("""progress.unlockedChars = ['kaiju', 'hero', 'chimera', 'diver', 'saint', 'frost', 'doll']; progress.selectCharacter('mech');""")
    g.page.click('#btn-menu-support-v2')
    g.wait(300)
    g.page.click('.v2-growth__tabs [data-tab="dispatch"]')
    g.wait(1500)
    st = g.js("""const c = document.querySelector('.v2-dsp-zone[data-zone="6"]');
        return c ? { open: !c.disabled, text: c.textContent.replace(/\\s+/g, ' ').trim(), imgs: c.querySelectorAll('i').length } : null;""")
    ctx.check(bool(st) and st['open'] and '기적의 대병동' in st['text'] and st['imgs'] == 1,
              '파견 화면: 구역 6 카드 (파견 그림 없이 전투 배경 썸네일)', str(st))
    g.shot('zone6_dispatch', '.v2-growth__box')
