"""구역 3 (성왕국 수도: 피로 물든 순례길)·구역 4 (진화의 심연: 살점의 요람) — 새 기획 D-085 (예전 D-056 7판을 바꿈):
구역 탭·해금, 배경(2026-10-25 그림), 새 적 행동(채찍 출혈·빛 곡사·치유·성수 약화·발리스타 밀어냄 / 분열·포자·장벽·기생충 광폭화·안광·산성 혈액),
요새 사격·독액, 3-B 정문 → 대주교 베네딕트(신성한 심판·숨겨진 마성) → 지옥문(악마기사 2기) → 승리, 4-B 오큘러스 기술·극한의 변이·돌진"""

CLEAR = ("(await import('/js/engine_v2/stages_v2.js')).STAGES.filter(s => IDS.includes(s.zone))"
         ".forEach(s => progress.stages[s.id] = { stars: [true,true,true], cleared: true, bestTime: 60 });")
# 소환 멈춤, 적 치움(거점·보스는 남김), 주인공 제자리·공격력 0 (적이 죽지 않게), 받은 피해 합계 b._hurt
CLEAN = ("b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding && !e.boss).forEach(e => e.dom && e.dom.remove());"
         "b.enemies = b.enemies.filter(e => e.isBuilding || e.boss); b.playerSpeed = 0; b.playerDps = 0;"
         "if (!b._spy) { b._spy = true; const f = b.damagePlayer; b.damagePlayer = function (a, ...r) { b._hurt = (b._hurt || 0) + a; return f.call(this, a, ...r); }; }"
         "b._hurt = 0; b.pSlowT = 0; b.pStunT = 0; b.pRootT = 0; b.pVulnT = 0; b.playerHp = b.maxPlayerHp;"
         "b.hazards.forEach(h => h.dom.remove()); b.hazards = [];")
BG = """const bg = k => getComputedStyle(document.getElementById(`bg-${k}-v2`)).backgroundImage;
    const sc = document.getElementById('screen-battle-v2');"""


def battle_at(g, stage):
    g.js(f"progress.selectStage('{stage}');")
    g.battle('mech', wait_ms=2900)
    g.wait(2900)
    g.js(CLEAN)


def place(g, typ, dx, extra=''):
    """주인공 앞 dx px에 적 하나 (움직이지 않음)"""
    g.js(CLEAN + f"const e = b.spawnMinion('{typ}', {{ x: b.frontX() + {dx}, elite: false }}); e.speed = 0; {extra}")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 지도 구역 10쪽, 구역 3은 2-B 전까지 잠김 → 구역 1·2를 깨면 열리고 넘기면 3-1
    st = g.map_zone('ch3')
    ctx.check(st['n'] == 10 and st['locked'] and '기간틱 테라포머' in st['foot'], '지도 구역 10쪽: 구역 3은 2-B 보스 전까지 잠김', str(st))
    g.js(CLEAR.replace('IDS', '[1, 2]') + "window.madOverlordGameV2.menuController.renderStages();")
    name = g.map_zone('ch3')['name']
    st = g.js("""const S = await import('/js/engine_v2/stages_v2.js');
        return { sel: progress.selectedStage, n3: S.CHAPTER3.stages.length, n4: S.CHAPTER4.stages.length, after2: S.nextStageOf('2-B').id, after3: S.nextStageOf('3-B').id,
                 z4: !window.madOverlordGameV2.menuController.stageMap.pages[3].open };""")
    st['name'] = name
    ctx.check(st['sel'] == '3-1' and name.startswith('성왕국 수도') and st['n3'] == 11 and st['n4'] == 11 and st['after2'] == '3-1'
              and st['after3'] == '4-1' and st['z4'], '2-B 클리어 → 구역 3 열림(3-1), 구역마다 11판, 3-B 다음 = 4-1, 구역 4는 잠김', str(st))
    g.shot('zone3_menu', '#screen-menu-v2')

    # 3-1: 구역 3 배경 + 광신도(자기 그림)
    battle_at(g, '3-1')
    place(g, 'zealot', 300)
    st = g.js(BG + """const e = b.enemies.find(e => e.type === 'zealot');
        return { zone: sc.classList.contains('v2-zone-3'), z2: sc.classList.contains('v2-zone-2'), sky: bg('sky'), city: bg('city'), ground: bg('ground'),
                 img: getComputedStyle(e.dom.querySelector('.v2-enemy__sprite')).backgroundImage };""")
    ctx.check(st['zone'] and not st['z2'] and 'st3/far.webp' in st['sky'] and 'st3/mid.webp' in st['city'] and 'st3/floor.webp' in st['ground']
              and 'zealot_walk' in st['img'], '구역 3 배경 3층(황금 성·화형대 띠·핏빛 대리석) + 광신도 그림', str(st))

    # 이단 심문소 철문: 420px 안이면 쇠꼬챙이·화살
    g.js(CLEAN + "b.distanceTraveled = b.stage.midAt - 0.5; b.playerSpeed = 100;")
    g.wait(1200)
    g.js(CLEAN + "const t = b.enemies.find(e => e.isBuilding); b.monsterX = t.x - 100 - 380; m.setMonsterPosition(b.monsterX);")
    g.wait(2600)
    st = g.js("const t = b.enemies.find(e => e.isBuilding); return { art: t && t.art, hurt: b._hurt };")
    ctx.check(st['art'] == 'st3_fort' and st['hurt'] > 0, '이단 심문소 철문: 다가가면 쇠꼬챙이·화살', str(st))
    g.shot('zone3_fort', '#screen-battle-v2')
    g.js("const t = b.enemies.find(e => e.isBuilding); if (t) { t.dom.remove(); b.enemies = b.enemies.filter(e => e !== t); } b.monsterX = 150; m.setMonsterPosition(150);")

    # 신성 방패병: 성십자 방패 장벽 / 이단심문관: 채찍 출혈 + 감속 / 빛의 마법사: 곡사 / 전투 신관: 병사만 치유
    place(g, 'holyshield', 260, 'e.cd.build = 99;')
    g.wait(1600)
    ctx.check(g.js("return b.enemies.some(e => e.isBarricade && e.art === 'st3_barr' && e.dom.style.backgroundImage.includes('st3/barr_1'));"),
              '신성 방패병: 성십자 방패 장벽을 세움')
    place(g, 'inquisitor', 40, 'e.cd.skill = 99; e.dps = 0;')
    g.wait(500)
    slow = g.js("return b.pSlowT > 0 || b.pStatusShown === 'slow';")
    g.wait(2100)
    st = g.js(f"return {{ hurt: b._hurt, slow: {str(bool(slow)).lower()} }};")
    ctx.check(st['hurt'] > 0 and st['slow'], '이단심문관: 가시 채찍 → 출혈 피해 + 감속', str(st))
    place(g, 'lightmage', 260, 'e.cd.skill = 99;')
    g.wait(1500)
    ctx.check(g.js("return b._hurt;") > 0, '빛의 마법사: 곡사 빛의 화살 피해')
    place(g, 'battlepriest', 300, "e.cd.skill = 99;"
          "const s = b.spawnMinion('zealot', { x: b.frontX() + 240, elite: false }); s.speed = 0; s.hp = s.maxHp * 0.3;"
          "const br = b.spawnBarricade(b.frontX() + 200, 1000); br.hp = 300;")
    g.wait(900)
    st = g.js("""const s = b.enemies.find(e => e.type === 'zealot'), br = b.enemies.find(e => e.isBarricade);
        return { soldier: s.hp / s.maxHp, bar: br.hp };""")
    ctx.check(st['soldier'] > 0.3 and st['bar'] == 300, '전투 신관: 병사만 치유 (장벽은 안 고침)', str(st))

    # 그리폰 기수: 떠서 다님 + 성수 → 약화(받는 피해 증가) / 정화의 발리스타: 먼 거리 쐐기 → 밀려남
    place(g, 'griffon', 240, 'e.cd.skill = 99;')
    g.wait(1200)
    st = g.js("""const e = b.enemies.find(e => e.type === 'griffon'); const before = b._hurt; b.damagePlayer(100, 0);
        return { fly: parseFloat(e.dom.style.bottom), vuln: b.pVulnT > 0, took: Math.round(b._hurt - before) };""")
    ctx.check(st['fly'] > 100 and st['vuln'] and st['took'] == 100, '그리폰 기수: 떠서 다님 + 성수로 약화 상태', str(st))
    st = g.js("b.playerHp = b.maxPlayerHp; const h0 = b.playerHp; b.damagePlayer(100, 0); return Math.round(h0 - b.playerHp);")
    ctx.check(st >= 120, '약화: 받는 피해 +25%', str(st))
    g.js(CLEAN + "b.monsterX = 420; m.setMonsterPosition(420); const e = b.spawnMinion('ballista', { x: 420 + 100 + 500, elite: false }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1200)
    st = g.js("return { x: b.monsterX, hurt: b._hurt };")
    ctx.check(st['x'] < 420 and st['hurt'] > 0, '정화의 발리스타: 먼 거리 은제 쐐기 → 피해 + 밀려남', str(st))
    g.shot('zone3_enemies', '#screen-battle-v2')

    # 3-B: 정문이 나와도 보스는 아직 → 정문을 부수면 베네딕트 → 별 2개째, 전투 계속
    battle_at(g, '3-B')
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = 100;")
    g.wait(1500)
    st = g.js("const f = b.enemies.find(e => e.isFinal); return { art: f && f.art, boss: !!b.boss };")
    ctx.check(st['art'] == 'st3_base' and not st['boss'], '3-B: 대성당 정문, 보스는 아직 없음', str(st))
    g.js(CLEAN + "const f = b.enemies.find(e => e.isFinal); b.dealDamageToEnemy(f, f.hp + 10, false);")
    g.wait(3400)
    st = g.js("""return { phase: b.bossPhase, boss: b.boss && b.boss.type, star: b.starFlags[1], over: b.finalBaseDestroyed, active: b.isActive,
        hud: !document.getElementById('hud-boss-v2').hidden };""")
    ctx.check(st['phase'] and st['boss'] == 'benedict' and st['star'] and not st['over'] and st['active'] and st['hud'],
              '정문을 부수면 대주교 베네딕트 출현 (별 2개째, 전투 계속, 보스 체력 막대)', str(st))
    g.shot('zone3_boss', '#screen-battle-v2')

    # 신성한 심판(빛의 기둥 3개) / 숨겨진 마성(흡혈) / 지옥문(악마기사 2기 엘리트 + 진홍 점멸)
    g.js(CLEAN + "b.boss.speed = 0; window.__n = 0; const f = b.fx.play.bind(b.fx); b.fx.play = (d, ...r) => { if (d && d.sfx === 'zone_judgment') window.__n += 1; return f(d, ...r); };"
         "b.boss.cd.judgment = 99; b.boss.cd.drain = -99;")
    g.wait(3000)
    st = g.js("return { hurt: b._hurt, pillars: window.__n };")
    ctx.check(st['hurt'] > 0, '신성한 심판: 예고 뒤 빛의 기둥 피해 (여러 번)', str(st))
    g.js("delete b.fx.play; b._hurt = 0; b.boss.hp = b.boss.maxHp * 0.5; window.__hp = b.boss.hp; b.boss.x = b.frontX() + 200; b.boss.dom.style.left = b.boss.x + 'px';"
         "b.boss.cd.judgment = -99; b.boss.cd.drain = 99;")
    g.wait(1700)
    st = g.js("return { hurt: b._hurt, healed: b.boss.hp > window.__hp };")
    ctx.check(st['hurt'] > 0 and st['healed'], '숨겨진 마성: 검은 촉수 피해 + 보스 흡혈', str(st))
    g.js("b.knightTimer = b.stage.boss.knights.every - 0.05;")
    g.wait(300)
    st = g.js("""const k = b.enemies.filter(e => e.type === 'demonknight');
        return { n: k.length, elite: k.every(e => e.elite), crimson: document.getElementById('screen-battle-v2').classList.contains('v2-crimson') };""")
    ctx.check(st['n'] == 2 and st['elite'] and st['crimson'], '지옥문: 악마기사(엘리트) 2기 + 배경 진홍 점멸', str(st))
    g.shot('zone3_knight', '#screen-battle-v2')

    # 베네딕트를 쓰러뜨리면 승리
    g.js("b.boss.hp = 1; b.boss.shield = 0; b.dealDamageToEnemy(b.boss, 1000, false);")
    g.wait(6500)
    st = g.js("return { win: !!document.querySelector('.v2-result.is-win'), stage: progress.stage('3-B').cleared };")
    ctx.check(st['win'] and st['stage'], '베네딕트 격파 → 승리 (3-B 클리어)', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # 구역 4: 배경, 슬라임 분열, 포자 술사, 생체 방패수 장벽, 혈관 기생충 치유·광폭화, 안구 감시탑 안광, 융합수 산성 혈액, 고기 벽 독액
    g.js(CLEAR.replace('IDS', '[1, 2, 3]'))
    battle_at(g, '4-1')
    st = g.js(BG + "return { zone: sc.classList.contains('v2-zone-4'), z3: sc.classList.contains('v2-zone-3'), sky: bg('sky'), city: bg('city'), ground: bg('ground') };")
    ctx.check(st['zone'] and not st['z3'] and 'st4/far.webp' in st['sky'] and 'st4/mid.webp' in st['city'] and 'st4/floor.webp' in st['ground'],
              '구역 4 배경 3층 (보라 심연·살점 기둥·유기체 바닥)', str(st))
    place(g, 'chimeraslime', 300)
    g.js("const s = b.enemies.find(e => e.type === 'chimeraslime'); b.dealDamageToEnemy(s, s.hp + 10, false);")
    g.wait(200)
    st = g.js("""const l = b.enemies.filter(e => e.type === 'chimeraslimelet');
        return { small: l.length, scale: l[0]?.dom.style.transform, art: l[0]?.dom.className.includes('v2-art-chimeraslime') };""")
    ctx.check(st['small'] == 2 and '0.6' in (st['scale'] or '') and st['art'], '키메라 슬라임: 쓰러지면 작은 슬라임 2기 (같은 그림을 작게)', str(st))
    g.js("b.enemies.filter(e => e.type === 'chimeraslimelet').forEach(s => b.dealDamageToEnemy(s, s.hp + 10, false));")
    g.wait(200)
    ctx.check(g.js("return b.enemies.filter(e => e.type.startsWith('chimeraslime')).length;") == 0, '작은 슬라임은 다시 갈라지지 않음')
    place(g, 'sporecaster', 260, 'e.cd.skill = 99; e.cd.next = 0.1;')
    g.wait(1500)
    ctx.check(g.js("return b._hurt;") > 0, '포자 술사: 곡사 포자 피해')
    place(g, 'boneshield', 260, 'e.cd.build = 99;')
    g.wait(1600)
    ctx.check(g.js("return b.enemies.some(e => e.isBarricade && e.art === 'st4_barr' && e.dom.style.backgroundImage.includes('st4/barr_1'));"),
              '생체 방패수: 뼈 방패 장벽을 세움')
    place(g, 'parasite', 300, "e.cd.skill = 99; const s = b.spawnMinion('mutant', { x: b.frontX() + 240, elite: false }); s.speed = 50; s.hp = s.maxHp * 0.3;")
    g.wait(700)
    st = g.js("const s = b.enemies.find(e => e.type === 'mutant'); return { hp: s.hp / s.maxHp, haste: s.hasteUntil > b.stats.time, mul: s.hasteMul };")
    ctx.check(st['hp'] > 0.3 and st['haste'] and st['mul'] > 1, '혈관 기생충: 다친 적 치유 + 광폭화(빨라짐)', str(st))
    place(g, 'eyetower', 400, 'e.cd.skill = 99;')
    g.wait(1500)
    ctx.check(g.js("return b._hurt;") > 0, '안구 감시탑: 조준 뒤 보랏빛 안광 피해')
    place(g, 'fusionbeast', 300)
    g.js("const s = b.enemies.find(e => e.type === 'fusionbeast'); b.dealDamageToEnemy(s, s.hp * 2 + 10, false);")   # 피해 감소 20%가 있어 넉넉히
    g.wait(200)
    ctx.check(g.js("return b.hazards.length;") >= 1, '광폭화 융합수: 쓰러지면 산성 혈액 웅덩이')
    g.js(CLEAN + "b.distanceTraveled = b.stage.midAt - 0.5; b.playerSpeed = 100;")
    g.wait(1200)
    g.js(CLEAN + "b.enemies.filter(e => e.isBarricade).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => !e.isBarricade);"
         "const t = b.enemies.find(e => e.isBuilding); b.monsterX = t.x - 100 - 260; m.setMonsterPosition(b.monsterX);")
    g.wait(3500)
    st = g.js("const t = b.enemies.find(e => e.isBuilding); return { art: t && t.art, hurt: b._hurt, puddles: b.hazards.length };")
    ctx.check(st['art'] == 'st4_fort' and st['hurt'] > 0 and st['puddles'] >= 1, '박동하는 고기 벽: 다가가면 독액 + 독 웅덩이', str(st))
    g.shot('zone4_wall', '#screen-battle-v2')

    # 4-B: 우주적 고치 앞 오큘러스 → 유전자 붕괴(감속) · 심연의 파동 · 극한의 변이 · 돌진
    battle_at(g, '4-B')
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = 100;")
    g.wait(2600)
    st = g.js("const f = b.enemies.find(e => e.isFinal); return { art: f && f.art, boss: b.boss && b.boss.type, img: b.boss && b.boss.dom.className };")
    ctx.check(st['art'] == 'st4_base' and st['boss'] == 'oculus' and 'v2-art-oculus' in (st['img'] or ''), '4-B: 우주적 고치 · 관장자 오큘러스(새 그림)', str(st))
    g.js(CLEAN + "b.monsterX = 420; m.setMonsterPosition(420); b.boss.x = 700; b.boss.dom.style.left = '700px'; b.boss.speed = 0;"
         "b.boss.cd.goo = 99; b.boss.cd.wave = 0;")
    g.wait(900)
    ctx.check(g.js("return b.pSlowT;") > 2, '유전자 붕괴: 맞으면 긴 감속')
    g.js("b._hurt = 0; b.boss.cd.wave = 99;")
    g.wait(1500)
    ctx.check(g.js("return b._hurt;") > 0, '심연의 파동: 예고 뒤 촉수 피해')
    g.js("b.boss.hp = b.boss.maxHp * 0.45; b.dealDamageToEnemy(b.boss, 1, false);")
    g.wait(400)
    st = g.js("""return { raged: !!b.boss.raged, rage: document.getElementById('screen-battle-v2').classList.contains('v2-boss-rage'),
        tf: b.boss.dom.style.transform, art2: b.boss.dom.classList.contains('v2-art-oculus2') && b.boss.artKey === 'oculus2' };""")
    ctx.check(st['raged'] and st['rage'] and (st['art2'] or '1.15' in st['tf']), '극한의 변이: 체력 50% → 2페이즈 (진홍 배경, 2페이즈 그림 또는 커짐)', str(st))
    g.shot('zone4_rage', '#screen-battle-v2')
    g.js("b._hurt = 0; b.boss.speed = 0; b.boss.x = 760; b.boss.dom.style.left = '760px'; b.boss.cd.charge = 99;")
    g.wait(1400)
    st = g.js("return { hurt: b._hurt, x: b.boss.x, front: b.frontX(), me: b.monsterX };")
    ctx.check(st['hurt'] > 0 and st['x'] < 700 and st['me'] < 420, '돌진: 주인공에게 달려들어 피해 + 밀어냄', str(st))
