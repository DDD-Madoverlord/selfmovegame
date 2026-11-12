"""구역 2 (새 기획 D-085 해안 시추 단지 — 예전 하부 쓰레기 폐기 정착지 D-040을 바꿈): 구역 탭·해금, 배경, 거점 그림,
새 적 행동(불도저 밀어냄·작살 감속·톱날 드론 비행·산성 웅덩이·음파 스킬 지연·장거리 곡사), 보스 기간틱 테라포머·컨테이너 투하,
예전 공용 행동(바리케이드·그물·수리 — 다른 구역 적도 씀)"""

CLEAR_CH1 = "['1-1','1-2','1-3','1-4','1-5','1-6','1-7','1-8','1-9','1-10','1-B'].forEach(id => progress.stages[id] = { stars: [true,true,true], cleared: true, bestTime: 60 });"
CLEAN = "b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.playerSpeed = 0;"
RESET = "b.pSlowT = 0; b.pStunT = 0; b.pRootT = 0; b.hazards.forEach(h => h.dom.remove()); b.hazards = []; b.playerHp = b.maxPlayerHp;"


def battle_at(g, stage, build='kaiju'):   # 감속 면역이 없는 다리 (히어로 반중력 부양은 감속 무시)
    g.js(f"progress.selectStage('{stage}');")
    g.battle(build, wait_ms=2900)
    g.wait(2900)
    g.js(CLEAN + "b.roleTaken = 1; b.sigChar = null;")   # 원거리/근거리 받는 피해·고유 특성(D-121)은 빼고 적 기능만 봄


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 지도: 처음엔 구역 2 잠김 (넘기면 안개, 정거장을 누르면 여는 조건 = 1-B 보스)
    st = g.map_zone('ch2')
    ctx.check(st['n'] >= 2 and st['locked'] and 'WMD-알파' in st['foot'] and 'WMD-알파' in st['fog'], '지도: 구역 2는 1-B 전까지 잠김', str(st))

    # 1-B를 깨면 구역 2가 열리고, 넘기면 2-1
    g.js(CLEAR_CH1 + "window.madOverlordGameV2.menuController.renderStages();")
    st = g.map_zone('ch2')
    ctx.check(st['sel'] == '2-1' and st['name'].startswith('해안 시추 단지') and '2-1' in st['foot'], '1-B 클리어 → 구역 2 열림, 2-1 선택 (머리 이름에 구역 번호 없음)', str(st))
    ctx.check(g.js("return (await import('/js/engine_v2/stages_v2.js')).nextStageOf('1-B').id;") == '2-1', '1-B 다음 스테이지 = 2-1')
    ctx.check(g.js("return (await import('/js/engine_v2/stages_v2.js')).CHAPTER2.stages.length;") == 11, '구역 2 = 11판 (2-1 ~ 2-10 + 보스)')
    g.shot('zone2_menu', '#screen-menu-v2')

    # 2-1 전투: 구역 2 배경, 방파제 게이트 그림, 용병 그림
    battle_at(g, '2-1')
    st = g.js("""const bg = k => getComputedStyle(document.getElementById(`bg-${k}-v2`)).backgroundImage;
        return { zone: document.getElementById('screen-battle-v2').classList.contains('v2-zone-2'), sky: bg('sky'), city: bg('city'), ground: bg('ground') };""")
    ctx.check(st['zone'] and 'st2/far.webp' in st['sky'] and 'st2/mid.webp' in st['city'] and 'st2/floor.webp' in st['ground'],
              '구역 2 배경 3층 = 매연 굴뚝·파이프라인·용암 아스팔트', str(st))
    g.js("b.distanceTraveled = b.stage.midAt - 0.5; b.playerSpeed = 100;")
    g.wait(1500)
    st = g.js("const mb = b.enemies.find(e => e.isBuilding); return mb && { art: mb.art, img: mb.dom.style.backgroundImage };")
    ctx.check(st and st['art'] == 'st2_fort' and 'st2/fort_1' in st['img'], '구역 2 중간 요새 = 해안 방파제 게이트 그림', str(st))
    g.js(CLEAN + "b.spawnMinion('merc', { x: b.monsterX + 300 });")
    g.wait(300)
    img = g.js("const e = b.enemies.find(e => e.type === 'merc'); return getComputedStyle(e.dom.querySelector('.v2-enemy__sprite')).backgroundImage;")
    ctx.check('merc_walk' in img, '코퍼레이션 용병 그림', img)

    # 불도저 드로이드: 붙으면 배토판으로 밀어냄
    g.js(CLEAN + RESET + "b.monsterX = 420; m.setMonsterPosition(420); const e = b.spawnMinion('dozer', { x: b.frontX() + 20 }); e.speed = 0; e.cd.skill = 99; e.hp = e.maxHp = 99999;")
    g.wait(900)
    st = g.js("return { x: b.monsterX };")
    ctx.check(st['x'] < 420, '불도저 드로이드: 배토판에 밀려남', str(st))
    # 작살포 트럭: 맞으면 감속
    g.js(CLEAN + RESET + "const e = b.spawnMinion('harpoon', { x: b.monsterX + 100 + 280 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1200)
    ctx.check(g.js('return b.pSlowT > 0;'), '고압 작살포 트럭: 강철 작살 → 감속')
    # 회전톱 드론: 떠서 다님
    st = g.js(CLEAN + RESET + "const e = b.spawnMinion('sawdrone', { x: b.monsterX + 400 }); return parseFloat(e.dom.style.bottom);")
    ctx.check(st > 90, '벌목용 회전톱 드론: 떠서 다님', str(st))
    # 산성액 메카: 웅덩이 → 감속
    g.js(CLEAN + RESET + "const e = b.spawnMinion('acidmech', { x: b.monsterX + 100 + 240 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1500)
    st = g.js("return { puddles: b.hazards.length, slow: b.pSlowT > 0 };")
    ctx.check(st['puddles'] >= 1 and st['slow'], '산성액 투척 메카: 산성 웅덩이 → 감속', str(st))
    g.shot('zone2_puddle', '#screen-battle-v2')
    # 음파 차단 탑: 스킬 쿨다운 늘림
    g.js(CLEAN + RESET + "window.__cd0 = { ...b.skillCd }; const e = b.spawnMinion('sonictower', { x: b.monsterX + 100 + 300 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1000)
    cd = g.js("return { before: window.__cd0, after: { ...b.skillCd } };")
    ctx.check(any(cd['after'].get(k, 0) > cd['before'].get(k, 0) + 0.3 for k in ('arm', 'body') if k in cd['before']), '음파 차단 탑: 스킬 쿨다운 늘림', str(cd))
    # 대물 포격 워커: 먼 거리에서 곡사 철갑탄
    g.js(CLEAN + RESET + "window.__hp0 = b.playerHp; const e = b.spawnMinion('spiderwalker', { x: b.monsterX + 100 + 440 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(2400)
    ctx.check(g.js('return b.playerHp < window.__hp0 - 40;'), '대물 포격 워커: 먼 거리 곡사 철갑탄 큰 피해', str(g.js('return [window.__hp0, b.playerHp];')))

    # 예전 공용 행동 (구역 3·4·6 적도 씀): 바리케이드 세우기·파손·부수기, 그물 속박, 수리
    g.js(CLEAN + RESET + "const e = b.spawnMinion('builder', { x: b.monsterX + 100 + 260 }); e.speed = 0; e.cd.build = 99;")
    g.wait(1600)
    st = g.js("const br = b.enemies.find(e => e.isBarricade); return br && { img: br.dom.style.backgroundImage };")
    ctx.check(st and 'st2/barr_1' in st['img'], '바리케이드: 구역 2 그림(드럼통 장벽)으로 세움', str(st))
    g.js("const br = b.enemies.find(e => e.isBarricade); br.hp = br.maxHp * 0.4; b.dealDamageToEnemy(br, 1, false);")
    g.wait(300)
    st = g.js("const br = b.enemies.find(e => e.isBarricade); return br && br.dom.style.backgroundImage;")
    ctx.check(st and 'st2/barr_2' in st, '바리케이드 체력 절반 → 파손 그림', str(st))
    kills = g.js("return b.stats.kills;")
    g.js("const br = b.enemies.find(e => e.isBarricade); br.hp = 1; b.dealDamageToEnemy(br, 50, false, { knock: 0 });")
    g.wait(300)
    st = g.js(f"return {{ left: b.enemies.some(e => e.isBarricade), kills: b.stats.kills, before: {kills} }};")
    ctx.check(not st['left'] and st['kills'] == st['before'], '바리케이드를 부수면 사라짐 (처치 수에는 안 셈)', str(st))
    g.js(CLEAN + RESET + "const e = b.spawnMinion('netter', { x: b.monsterX + 100 + 220 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(1200)
    st = g.js("return { root: b.pRootT > 0, move: b.moveMul(), stunned: b.playerStunned(), icon: !!document.querySelector('#hud-pstatus-v2 .is-net') };")
    ctx.check(st['root'] and st['move'] == 0 and not st['stunned'] and st['icon'], '그물: 속박 (진격 0, 기절 아님, HUD 아이콘)', str(st))
    g.js(CLEAN + RESET + "const br = b.spawnBarricade(b.monsterX + 400, 1000); br.hp = 300;"
         "const e = b.spawnMinion('mechanic', { x: b.monsterX + 100 + 300 }); e.speed = 0; e.cd.skill = 99;")
    g.wait(800)
    hp = g.js("const br = b.enemies.find(e => e.isBarricade); return br && br.hp;")
    ctx.check(hp and hp > 300, '수리: 바리케이드를 고침', str(hp))

    # 보스전 2-B: 메인 시추 코어, 기간틱 테라포머, 파일벙커(피해 + 기절), 컨테이너 투하(기절 + 잠시 바리케이드)
    g.js("for (let i = 1; i <= 10; i++) progress.stages['2-' + i] = { stars: [true,true,true], cleared: true, bestTime: 60 };")
    battle_at(g, '2-B')
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = 100;")
    g.wait(2600)
    g.js("window.__finalArt = b.enemies.find(e => e.isFinal)?.art;")
    g.open_boss_gate()   # 11-05 피드백 17: 보스는 최종 거점을 부순 뒤 나옴
    st = g.js("""const f = { art: window.__finalArt }; const sky = getComputedStyle(document.getElementById('bg-sky-v2')).backgroundImage;
        return { art: f && f.art, boss: b.boss && b.boss.type, sky };""")
    ctx.check(st['art'] == 'st2_base' and st['boss'] == 'terraformer' and 'st2/far_boss' in st['sky'], '2-B: 메인 시추 코어 · 기간틱 테라포머 · 보스전 배경', str(st))
    g.js("b.enemies.filter(e => !e.isBuilding && !e.boss).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding || e.boss); b.spawnInterval = 999;"
         "b.boss.speed = 0; b.boss.cd.pile = b.boss.t.pile.every - 0.05; b.playerSpeed = 0;" + RESET + "window.__hp0 = b.playerHp;"
         "window.__stun = 0; const orig = b.applyPlayerStun.bind(b); b.applyPlayerStun = (s, l) => { window.__stun += 1; return orig(s, l); };")
    g.wait(2200)
    st = g.js("return { hit: b.playerHp < window.__hp0, stun: window.__stun };")
    ctx.check(st['hit'] and st['stun'] > 0, '테라포머 파일벙커: 일직선 충격파 피해 + 기절', str(st))
    g.shot('zone2_boss', '#screen-battle-v2')
    g.js(RESET + "window.__hp0 = b.playerHp; window.__stun = 0; b.boss.cd.pile = -99; b.containerTimer = b.stage.boss.containers.every - 0.05;")
    g.wait(int(2200 + 900))
    st = g.js("return { hit: b.playerHp < window.__hp0, stun: window.__stun, bars: b.enemies.filter(e => e.isBarricade && e.expireAt != null).length };")
    ctx.check(st['hit'] and st['stun'] > 0 and st['bars'] >= 2, '컨테이너 투하: 맞으면 피해·기절 + 떨어진 컨테이너가 바리케이드', str(st))
    g.shot('zone2_containers', '#screen-battle-v2')
    g.js("b.enemies.filter(e => e.expireAt != null).forEach(e => e.expireAt = b.stats.time);")
    g.wait(400)
    ctx.check(g.js("return b.enemies.filter(e => e.expireAt != null).length;") == 0, '컨테이너 바리케이드는 시간이 지나면 사라짐')
    g.js('delete b.applyPlayerStun;')
