"""서리의 무희 (새 캐릭터 3, D-046): 파츠 8개·연구소, 리그 연결(기본·강화 그림, 뒷머리),
서리 부채(냉기 → 빙결), 초승달 참격, 눈보라 춤, 영원한 안식(가뒀다 깨뜨림), 빙판 걸음"""

BASIC = ('head_frost', 'body_frost', 'arm_frost', 'leg_frost')
UP = ('head_frost_up', 'body_frost_up', 'arm_frost_up', 'leg_frost_up')
CLEAN = "b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.playerSpeed = 0;"


def spawn(typ, dx, hp=3000):
    """적 하나를 주인공 앞면 + dx에 세움 (움직이지 않고 공격도 안 함)"""
    return (f"(() => {{ const e = b.spawnMinion('{typ}', {{ x: b.frontX() + {dx}, elite: false }});"
            f" e.speed = 0; e.hp = e.maxHp = {hp}; e.dps = 0; e.dom.style.left = e.x + 'px'; return e; }})();")


def fresh_battle(g, build):
    g.battle(build, wait_ms=2900)
    g.wait(2900)   # 출격 인트로가 끝날 때까지
    g.js(CLEAN + "b.ultGauge = 0; b.skillCd = { arm: 0, body: 0 };")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 파츠 8개 + 스킬 구성
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const { skillsForParts, legPassiveOf } = await import('/js/engine_v2/skills_v2.js');
        const get = (s, id) => PARTS_DB[s].find(p => p.id === id);
        const ids = ['head', 'body', 'arm', 'leg'].flatMap(s => PARTS_DB[s].filter(p => String(p.faction).includes('서리의 무희') && !p.rigVariant).map(p => p.id));
        const sk = skillsForParts({ head: get('head', 'head_frost'), body: get('body', 'body_frost_up'), arm: get('arm', 'arm_frost') });
        return { ids, sk: [sk.arm && sk.arm.name, sk.body && sk.body.name, sk.head && sk.head.name],
                 leg: legPassiveOf(get('leg', 'leg_frost')).name, type: get('arm', 'arm_frost_up').attackType };""")
    ctx.check(len(st['ids']) == 8 and st['type'] == 'frost', '파츠 8개 (머리·몸통·팔·다리 × 기본·강화), 팔은 서리 부채 공격', str(st))
    ctx.check(st['sk'] == ['초승달 참격', '눈보라 춤', '영원한 안식'] and st['leg'] == '빙판 걸음',
              '스킬: 팔 초승달 참격 · 몸통 눈보라 춤 · 머리 영원한 안식 · 다리 빙판 걸음', str(st))

    # 연구소: 강화 머리 → 머리와 뒷머리가 함께 강화 그림
    # 연구소에는 고른 캐릭터의 파츠만 나옴 (D-051) → 먼저 이 캐릭터를 고름
    g.js(f"progress.selectCharacter('frost'); gameState.cartParts = {{ head: '{UP[0]}', body: '{BASIC[1]}', arm: '{UP[2]}', leg: '{BASIC[3]}' }};"
         "window.madOverlordGameV2.switchScreen('lab');")
    g.wait(1500)
    st = g.js("""const lab = window.madOverlordGameV2.labController;
        const card = document.querySelector('#parts-grid-v2 .v2-partcard[data-id="head_frost_up"]');   // '얼음 결정 왕관'은 유니크 세트에도 같은 이름이 있음
        const sk = lab.rig && lab.rig.skeleton;
        return { name: document.getElementById('lab-unit-name-v2').textContent, img: card && card.querySelector('img').getAttribute('src'),
                 parts: sk && ['head', 'hair', 'torso', 'armF', 'legF'].map(k => sk.byName[k].part) };""")
    ctx.check(st['name'] == '서리의 무희' and st['img'] and st['img'].endswith('head_up.png')
              and st['parts'] == ['head_up', 'hair_up', 'torso', 'armF_up', 'legF'],
              '연구소: 강화 카드 그림 + 미리보기는 강화 머리(뒷머리 포함)·팔만 바뀜', str(st))
    g.shot('frost_lab', '#screen-lab-v2')

    # 전투: 기본 파츠 → 리그 frost
    fresh_battle(g, BASIC)
    st = g.js("""const sk = m.rigBattle.skeleton;
        return { id: m.getCharacterId(), type: b.attackType, hair: sk.byName.hair.part,
                 skills: [b.skills.arm.name, b.skills.body.name, b.skills.head.name] };""")
    ctx.check(st['id'] == 'frost' and st['type'] == 'frost' and st['hair'] == 'hair', '전투: 서리의 무희 리그(뒷머리 조각), 서리 부채 공격', str(st))

    # 서리 부채: 맞을수록 냉기 → 빙결 (얼음 색·아이콘), 앞의 둘까지
    g.js(spawn('guard', 60, hp=8000) + spawn('raider', 110, hp=8000) + spawn('guard', 200, hp=8000))
    g.wait(3500)
    st = g.js("""return b.enemies.map(e => ({ hurt: e.hp < e.maxHp, chill: e.chill || 0, frozen: e.frozenT > 0,
        icon: !!e.dom.querySelector('.is-frozen, .is-chill') }));""")
    ctx.check(st[0]['hurt'] and st[1]['hurt'] and (st[0]['frozen'] or st[0]['chill'] > 0) and st[0]['icon'],
              '서리 부채: 앞의 적 둘에게 피해 + 냉기 (아이콘)', str(st))
    g.js(CLEAN + spawn('guard', 60, hp=8000) + "const e = b.enemies[0]; b.applyChill(e, 3); b.applyChill(e, 1);")
    st = g.js("const e = b.enemies[0]; return { frozen: e.frozenT > 0, stun: e.stunT > 0, chill: e.chill, filter: e.dom.style.filter };")
    ctx.check(st['frozen'] and st['stun'] and st['chill'] == 0 and 'hue-rotate' in st['filter'], '냉기 4 → 빙결 (멈춤, 얼음 색)', str(st))
    g.shot('frost_freeze', '#screen-battle-v2')

    # 빙판 걸음: 얼어 있는 적에게 피해 30% 더
    st = g.js("""const e = b.enemies[0]; e.frozenT = 2; const h0 = e.hp; b.dealDamageToEnemy(e, 100, false); const frozenDmg = h0 - e.hp;
        e.frozenT = 0; const h1 = e.hp; b.dealDamageToEnemy(e, 100, false); return { frozenDmg, normal: h1 - e.hp };""")
    ctx.check(abs(st['frozenDmg'] - 130) < 0.5 and abs(st['normal'] - 100) < 0.5, '빙판 걸음: 얼어 있는 적에게 피해 30% 증가', str(st))

    # 초승달 참격: 지나간 적 모두 피해 + 냉기 2
    g.js(CLEAN + spawn('guard', 40) + spawn('raider', 150) + spawn('shield', 300))
    ok = g.js("return b.useSkill('arm');")
    g.wait(1600)
    st = g.js("return b.enemies.map(e => ({ hurt: e.hp < e.maxHp, chill: (e.chill || 0) + (e.frozenT > 0 ? 9 : 0) }));")
    ctx.check(ok and len(st) == 3 and all(s['hurt'] and s['chill'] >= 2 for s in st), '초승달 참격: 앞의 적 모두 피해 + 냉기 2', str(st))

    # 눈보라 춤: 둘레 적 계속 피해 + 냉기, 그동안 받는 피해 감소
    g.js(CLEAN + spawn('guard', 30) + spawn('raider', 120) + spawn('guard', 400))
    hp0 = g.js("return b.enemies.map(e => e.hp);")
    ok = g.js("return b.useSkill('body');")
    g.wait(1800)
    st = g.js("""const p0 = b.playerHp; b.damagePlayer(100, 0.016); const taken = p0 - b.playerHp;
        return { on: !!b.blizzard, taken: Math.round(taken), e: b.enemies.map(e => ({ hp: Math.round(e.hp), chill: (e.chill || 0) + (e.frozenT > 0 ? 9 : 0) })) };""")
    g.shot('frost_blizzard', '#screen-battle-v2')
    inside, outside = st['e'][:2], st['e'][2]
    ctx.check(ok and st['on'] and st['taken'] == 70 and all(s['hp'] < h and s['chill'] >= 1 for s, h in zip(inside, hp0[:2]))
              and outside['hp'] == round(hp0[2]), '눈보라 춤: 둘레 적 피해 + 냉기, 받는 피해 30% 감소 (먼 적은 그대로)', f'{hp0} → {st}')
    g.wait(3000)
    ctx.check(g.js("return !b.blizzard;"), '눈보라 춤: 4초 뒤 끝남')

    # 영원한 안식: 가두고(빙결) → 2.4초 뒤 한꺼번에 깨뜨림
    g.js(CLEAN + spawn('guard', 40, hp=5000) + spawn('shield', 160, hp=5000) + spawn('tranq', 280, hp=5000) + "b.ultGauge = 1;")
    ok = g.js("return b.useSkill('head');")
    g.wait(2000)   # 필살기 컷인 슬로모션(1초) + 시전
    st = g.js("return b.enemies.map(e => ({ frozen: e.frozenT > 0, hp: Math.round(e.hp) }));")
    g.shot('frost_eternal', '#screen-battle-v2')
    g.wait(2800)
    hp2 = g.js("return b.enemies.map(e => Math.round(e.hp));")
    ctx.check(ok and len(st) == 3 and all(s['frozen'] for s in st) and all(h < s['hp'] - 300 for h, s in zip(hp2, st)),
              '영원한 안식: 앞의 적을 가뒀다가 한꺼번에 깨뜨림', f'{st} → {hp2}')

    # 강화 파츠: 부위 그림이 강화로, 앞 부채 소켓 바꿈
    g.js("b.stopBattle();")
    fresh_battle(g, UP)
    st = g.js("""const sk = m.rigBattle.skeleton;
        return { parts: ['head', 'hair', 'torso', 'armF', 'armB', 'legF', 'legB'].map(k => sk.byName[k].part), alias: sk.socketAlias };""")
    ctx.check(st['parts'] == ['head_up', 'hair_up', 'torso_up', 'armF_up', 'armB_up', 'legF_up', 'legB_up']
              and st['alias'].get('fanF') == 'fanFUp', '강화 파츠: 모든 부위 강화 그림(뒷머리 포함), 앞 부채 소켓', str(st))
    g.js(spawn('guard', 60) + spawn('guard', 150))
    g.wait(1500)
    g.shot('frost_up_battle', '#screen-battle-v2')
    g.js("b.stopBattle();")
