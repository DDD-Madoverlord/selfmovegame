"""그림(C단계): 거점(요새·최종 기지 → 파손 → 잔해, 요새 잔해는 다시 걸으면 흘러 나감), 적(경비병 걷기·공격 스프라이트, 세뇌 보병), 구역 1 배경 3층·보스전 경보 조명"""


def state(g, final=False):
    return g.js(f"""const bd = [...document.querySelectorAll('.building-entity')].find(d => d.classList.contains('final-base') === {str(final).lower()});
        if (!bd) return null;
        const r = bd.getBoundingClientRect();
        return {{ art: bd.classList.contains('v2-base'), state: bd.dataset.state, img: bd.style.backgroundImage,
                 w: bd.offsetWidth, h: bd.offsetHeight, left: parseFloat(bd.style.left) }};""")


def run(ctx):
    for part in (run_bases, run_hero_wave, run_guard, run_roster, run_background):
        part(ctx)
        # 끝난 창의 전투를 멈춤 — 창들이 함께 열려 있어 앞 창의 전투가 계속 돌면 다음 창 로딩이 30초를 넘김(11-04, 혼자 열면 4초)
        for g in ctx.games:
            g.js("if (b.isActive) b.stopBattle();")


def run_hero_wave(ctx):
    """타락 히어로 어둠 파동이 사거리 끝에서도 넓은 거점 그림에 맞는지 (가운데로 판정하던 때는 기본 공격이 거점에 안 들어감)"""
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('hero', wait_ms=2900)
    g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.distanceTraveled = b.stage.midAt - 0.5;")
    g.wait(1500)
    g.js("const f = b.enemies.find(e => e.isBuilding); if (f) { f.hp = f.maxHp = 50000; }")   # 재는 동안 부서지지 않게
    g.wait(3000)   # 주인공이 사거리 끝까지 걸어감
    hp0 = g.js("const f = b.enemies.find(e => e.isBuilding); return f && { hp: f.hp, gap: Math.round(f.x - b.frontX()), range: b.playerRange };")
    g.wait(2500)
    hp1 = g.js("const f = b.enemies.find(e => e.isBuilding); return f && f.hp;")
    ctx.check(hp0 and hp0['gap'] > hp0['range'] - 40 and hp1 is not None and hp1 < hp0['hp'],
              '타락 히어로 파동: 사거리 끝에서 넓은 거점에 맞음', f'{hp0} → {hp1}')


def run_bases(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('kaiju', wait_ms=2900)

    # 요새: 그림 + 크기
    g.js("b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.distanceTraveled = b.stage.midAt - 0.5;")
    g.wait(1500)
    st = state(g)
    ctx.check(st and st['art'] and st['state'] == '0' and 'st1/fort_1' in st['img'], '요새 그림 (온전)', str(st))
    ctx.check(st and st['w'] > 150 and st['h'] > 200, '요새 그림 크기 (주인공보다 크게)', str(st and (st['w'], st['h'])))
    g.js("b.spd0 = b.playerSpeed; b.monsterX = 150; m.setMonsterPosition(150); b.playerSpeed = 0;")   # 주인공은 그 자리에 (화면 확인용)
    g.wait(300)
    g.shot('bases_mid_intact', '#screen-battle-v2')

    # 체력 절반 아래 → 파손 그림
    g.js("const bd = b.enemies.find(e => e.isBuilding); bd.hp = bd.maxHp * 0.45; b.dealDamageToEnemy(bd, 1, false);")
    g.wait(400)
    st = state(g)
    ctx.check(st and st['state'] == '1' and 'st1/fort_2' in st['img'], '체력 절반 → 요새 파손 그림', str(st))
    g.shot('bases_mid_damaged', '#screen-battle-v2')

    # 파괴 → 잔해 그림으로 남고, 무너지는 동안 주인공은 멈춰 있음
    g.js("const bd = b.enemies.find(e => e.isBuilding); bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 });")
    g.wait(1300)
    st = state(g)
    hold = g.js("return { hold: b.ruinHoldT > 0, mstate: m.currentState, ruins: b.ruins.length };")
    ctx.check(st and st['state'] == '2' and 'st1/fort_3' in st['img'], '요새 파괴 → 잔해 그림으로 남음', str(st))
    ctx.check(hold['ruins'] == 1 and hold['mstate'] == 'victory', '무너지는 동안 주인공 승리 자세로 멈춤', str(hold))
    g.shot('bases_mid_ruin', '#screen-battle-v2')

    # 다시 걸으면 잔해가 바닥과 함께 왼쪽으로 흘러 나감
    left0 = st['left'] if st else 0
    g.wait(1600)
    st = state(g)
    ctx.check(st is None or st['left'] < left0 - 100, '다시 걸으면 잔해가 왼쪽으로 흘러감', f'{left0} → {st and st["left"]}')
    gone = False
    for _ in range(30):   # 바닥은 캐릭터 진격 속도에 맞춰 흐름 (Q2) — 느린 캐릭터는 늦게 나감, 최대 6초
        g.wait(200)
        gone = g.js("return b.ruins.length === 0 && !document.querySelector('.building-entity');")
        if gone:
            break
    ctx.check(gone, '화면 밖으로 나간 잔해는 치움')

    # 최종 기지: 그림 → 파손 → 파괴 뒤 잔해가 승리 연출 동안 남음
    g.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = []; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = b.spd0;")
    g.wait(1500)
    g.js("b.playerSpeed = 0;")
    st = state(g, final=True)
    ctx.check(st and st['art'] and st['state'] == '0' and 'st1/base_1' in st['img'], '최종 기지 그림 (온전)', str(st))
    ctx.check(st and st['h'] > 250, '최종 기지가 요새보다 큼', str(st and (st['w'], st['h'])))
    g.shot('bases_final_intact', '#screen-battle-v2')
    g.js("const bd = b.enemies.find(e => e.isFinal); bd.hp = bd.maxHp * 0.4; b.dealDamageToEnemy(bd, 1, false);")
    g.wait(400)
    st = state(g, final=True)
    ctx.check(st and st['state'] == '1' and 'st1/base_2' in st['img'], '체력 절반 → 최종 기지 파손 그림', str(st))
    g.shot('bases_final_damaged', '#screen-battle-v2')
    g.js("const bd = b.enemies.find(e => e.isFinal); bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 });")
    g.wait(2600)
    st = state(g, final=True)
    ctx.check(st and st['state'] == '2' and 'st1/base_3' in st['img'], '최종 기지 파괴 → 잔해 그림 (승리 연출 중)', str(st))
    g.shot('bases_final_ruin', '#screen-battle-v2')
    g.wait(6000)
    ctx.check(g.js("return !!document.querySelector('.v2-result.is-win');"), '최종 기지 파괴 → 승리 결과 화면')


def run_guard(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('hero', wait_ms=2900)
    # 경비병 셋(하나는 엘리트) + 방패병
    g.js("""b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = [];
        b.spawnMinion('guard', { x: b.monsterX + 330 }); b.spawnMinion('guard', { x: b.monsterX + 430, elite: true });
        b.spawnMinion('guard', { x: b.monsterX + 560 }); b.spawnMinion('shield', { x: b.monsterX + 660 });
        b.enemies.forEach(e => { e.hp = e.maxHp = 99999; e.speed = 0; });""")
    g.wait(300)
    st = g.js("""const g = b.enemies.find(e => e.type === 'guard'); const sp = g.dom.querySelector('.v2-enemy__sprite');
        const sh = b.enemies.find(e => e.type === 'shield');
        return { art: g.dom.classList.contains('has-art'), img: sp && getComputedStyle(sp).backgroundImage,
                 h: g.dom.offsetHeight, shieldArt: sh.dom.classList.contains('has-art') };""")
    ctx.check(st['art'] and 'guard_walk' in (st['img'] or ''), '경비병: 걷기 스프라이트', str(st))
    ctx.check(st['h'] == 92 and st['shieldArt'], '경비병 92px, 방패병도 그림', str(st))

    # 주인공에게 닿으면 공격 스프라이트
    g.js("const g = b.enemies.find(e => e.type === 'guard'); g.x = b.monsterX + 100 + 40; g.dom.style.left = g.x + 'px'; g.dps = 1;")
    g.wait(400)
    st = g.js("""const g = b.enemies.find(e => e.type === 'guard'); const sp = g.dom.querySelector('.v2-enemy__sprite');
        return { attacking: g.dom.classList.contains('is-attacking'), img: getComputedStyle(sp).backgroundImage };""")
    ctx.check(st['attacking'] and 'guard_attack' in st['img'], '경비병: 닿으면 공격 스프라이트', str(st))
    g.wait(250)
    g.shot('enemy_guard', '#screen-battle-v2')

    # 세뇌 보병(징집한 아군)은 경비병 그림을 오른쪽으로 돌린 검보라
    g.js("b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.spawnAllyMinion(b.monsterX + 220); b.allies.forEach(a => a.speed = 0);")
    g.wait(300)
    img = g.js("const a = document.querySelector('.ally-minion.v2-mind'); return a && getComputedStyle(a).backgroundImage;")
    ctx.check('guard_walk' in (img or ''), '세뇌 보병: 경비병 그림(검보라)', str(img))
    g.shot('enemy_guard_mind', '#screen-battle-v2')

    # 합성괴인 졸개(아군): 졸개 그림, 오른쪽(좌우 반전), 적과 붙으면 공격 동작
    g.js("""b.allies.forEach(a => a.dom && a.dom.remove()); b.allies = [];
        b.spawnAllyMinion(b.monsterX + 200, 'chimera');
        b.spawnMinion('guard', { x: b.monsterX + 240 }); b.enemies.forEach(e => { e.hp = e.maxHp = 99999; e.speed = 0; e.dps = 0; });""")
    g.wait(500)
    st = g.js("""const a = document.querySelector('.ally-minion.chimera-minion-v2'); const cs = a && getComputedStyle(a);
        return a && { img: cs.backgroundImage, flip: cs.transform, h: a.offsetHeight, att: a.classList.contains('is-attacking') };""")
    ctx.check(st and 'minion/minion_attack' in st['img'] and st['att'], '합성괴인 졸개: 졸개 그림, 붙으면 공격 동작', str(st))
    ctx.check(st and st['flip'].startswith('matrix(-1') and st['h'] == 92, '합성괴인 졸개: 오른쪽을 봄, 92px', str(st))


TYPES = ['guard', 'shield', 'tranq', 'shock', 'medic', 'guardian']
TYPES_Z1 = ['conscript', 'riot', 'taser', 'rocket', 'empdrone', 'hound', 'flamer', 'exo', 'wmdalpha']   # 새 기획 구역 1 (D-085)


def run_roster(ctx):
    """적 5종 + 보스: 모두 그림, 보스는 구운 크기 그대로, 마취탄 발사·보스 방패 강타는 한 번 동작"""
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('kaiju', wait_ms=2900)
    g.js(f"""b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = [];
        {TYPES}.forEach((t, i) => b.spawnMinion(t, {{ x: b.monsterX + 300 + i * 120 }}));
        b.enemies.forEach(e => {{ e.hp = e.maxHp = 99999; e.speed = 0; e.dps = 0; }});""")
    g.wait(400)
    st = g.js("""return b.enemies.map(e => { const sp = e.dom.querySelector('.v2-enemy__sprite');
        return { t: e.type, art: e.dom.classList.contains('has-art'), img: sp ? getComputedStyle(sp).backgroundImage : '',
                 h: e.dom.offsetHeight, tf: e.dom.style.transform, filter: e.dom.style.filter }; });""")
    ok = all(x['art'] and f"{x['t']}_walk" in x['img'] for x in st)
    ctx.check(ok, '적 5종 + 보스: 모두 걷기 그림', str([(x['t'], x['art']) for x in st]))
    boss = next(x for x in st if x['t'] == 'guardian')
    ctx.check(boss['h'] > 200 and not boss['tf'], '보스: 구운 크기 그대로(약 196px, 배율 없음)', str(boss))
    ctx.check(all('hue-rotate' not in x['filter'] for x in st), '그림 적은 임시 색조를 쓰지 않음', str([x['filter'] for x in st]))
    g.shot('enemy_roster', '#screen-battle-v2')

    # 마취총 사수: 사거리 안에서 쏘면 발사 동작
    g.js("const e = b.enemies.find(e => e.type === 'tranq'); e.x = b.monsterX + 100 + 200; e.dom.style.left = e.x + 'px'; e.cd.skill = 99;")
    g.wait(150)
    ctx.check(g.js("return b.enemies.find(e => e.type === 'tranq').dom.classList.contains('is-attacking');"), '마취총 사수: 쏠 때 발사 동작')
    # 보스: 붙으면 베기, 방패 강타 때는 강타 동작
    g.js("""const e = b.enemies.find(e => e.type === 'guardian'); e.x = b.monsterX + 100 + 40; e.dom.style.left = e.x + 'px';
        e.dps = 1; e.cd.skill = e.t.bash.every - 0.05;""")
    g.wait(200)
    st = g.js("const d = b.enemies.find(e => e.type === 'guardian').dom; return { slash: d.classList.contains('is-attacking'), bash: d.classList.contains('is-bash') };")
    ctx.check(st['slash'] and st['bash'], '보스: 붙으면 베기 + 방패 강타 동작', str(st))
    g.shot('enemy_boss_bash', '#screen-battle-v2')

    # 새 기획 구역 1 (D-085): 적 8종 + 보스 모두 자기 그림, EMP 드론은 떠 있음
    g.js(f"""b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = [];
        {TYPES_Z1}.forEach((t, i) => b.spawnMinion(t, {{ x: b.monsterX + 260 + i * 95 }}));
        b.enemies.forEach(e => {{ e.hp = e.maxHp = 99999; e.speed = 0; e.dps = 0; e.cd.skill = -999; }});""")
    g.wait(400)
    st = g.js("""return b.enemies.map(e => { const sp = e.dom.querySelector('.v2-enemy__sprite');
        return { t: e.type, img: sp ? getComputedStyle(sp).backgroundImage : '', b: parseFloat(getComputedStyle(e.dom).bottom) }; });""")
    ctx.check(all(f"{x['t']}_walk" in x['img'] for x in st) and len({x['t'] for x in st}) == len(TYPES_Z1),
              '구역 1 적 8종 + WMD-알파: 모두 걷기 그림', str([x['t'] for x in st if f"{x['t']}_walk" not in x['img']]))
    drone = next(x for x in st if x['t'] == 'empdrone')
    ctx.check(drone['b'] > 100, 'EMP 드론: 땅에서 떠서 다님', str(drone['b']))
    g.shot('enemy_roster_zone1', '#screen-battle-v2')


BG = "return ['sky', 'city', 'ground'].map(k => getComputedStyle(document.getElementById(`bg-${k}-v2`)).backgroundImage);"


def run_background(ctx):
    """구역 1 배경: 먼 배경(탱크 홀)·중간(기계 띠)·바닥(철망 통로), 보스전은 붉은 경보 조명"""
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.battle('mech', wait_ms=2900)
    sky, city, ground = g.js(BG)
    ctx.check('st1/far.webp' in sky and 'st1/mid.webp' in city and 'st1/floor.webp' in ground, '배경 3층 = 벙커 철골·서버랙 띠·강철 그릴 바닥 (새 기획 구역 1)', str([sky[-30:], city[-30:], ground[-30:]]))
    ctx.check(g.js("return getComputedStyle(document.getElementById('bg-ground-v2')).animationName;") == 'scroll-bg', '걷는 동안 배경이 흐름')
    g.js("['1-1','1-2','1-3','1-4','1-5','1-6','1-7','1-8','1-9','1-10'].forEach(id => progress.stages[id] = { stars: [true,true,true], cleared: true, bestTime: 60 }); progress.selectStage('1-B');")
    g.battle('mech', wait_ms=1500)
    sky = g.js(BG)[0]
    ctx.check('st1/far_boss.webp' in sky, '보스전: 천장 해치 달빛 배경', sky[-40:])
