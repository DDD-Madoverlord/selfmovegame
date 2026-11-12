"""새 캐릭터 5·6 철거의 설계자 · 침묵의 방송자 (D-079): 파츠 8개 + 세트 9개 등록, 해금 별, 연구소(강화 그림 바꿔 끼우기),
전투 리그·기본 공격(부품 공격), 설계자 기초 파쇄·강제 재건(철골 바리케이드가 적을 막음)·철거 명령·안전화,
방송자 공명 파열·정적의 장막(침묵: 원거리 적이 못 쏨)·긴급 방송·잡음 차단, 침묵한 보스는 기술을 못 씀"""

ARCH = ('head_architect', 'body_architect', 'arm_architect', 'leg_architect')
ARCH_UP = ('head_architect_up', 'body_architect_up', 'arm_architect_up', 'leg_architect_up')
CAST = ('head_broadcaster', 'body_broadcaster', 'arm_broadcaster', 'leg_broadcaster')
CAST_UP = ('head_broadcaster_up', 'body_broadcaster_up', 'arm_broadcaster_up', 'leg_broadcaster_up')
CLEAN = ("b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.playerSpeed = 0;"
         "b.allies.forEach(a => a.dom && a.dom.remove()); b.allies = []; b.kitZones.forEach(z => b.kitZoneArt(z, true)); b.kitZones = [];"
         "if (!b._spy) { b._spy = true; const f = b.damagePlayer; b.damagePlayer = function (a, ...r) { b._hurt = (b._hurt || 0) + a; return f.call(this, a, ...r); }; }"
         "b._hurt = 0;")


def spawn(typ, dx, hp=3000, speed=0, dps=0):
    return (f"(() => {{ const e = b.spawnMinion('{typ}', {{ x: b.frontX() + {dx}, elite: false }});"
            f" e.speed = {speed}; e.hp = e.maxHp = {hp}; e.dps = {dps}; e.dom.style.left = e.x + 'px'; return e; }})();")


def fresh_battle(g, build):
    g.js("progress.selectStage('2-2');")
    g.battle(build, wait_ms=2900)
    g.wait(2900)
    g.js(CLEAN + "b.ultGauge = 0; b.skillCd = { arm: 0, body: 0 };")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 등록: 파츠 8개(기본·강화) + 세트 9개 × 4, 스킬·패시브, 해금 별, 선택창 카드
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const { skillsForParts, legPassiveOf } = await import('/js/engine_v2/skills_v2.js');
        const { characterOfPart, ROSTER } = await import('/js/engine_v2/roster_v2.js');
        const { CHARACTER_ZONE } = await import('/js/engine_v2/growth_v2.js');
        const get = id => Object.values(PARTS_DB).flat().find(p => p.id === id);
        const out = {};
        for (const c of ['architect', 'broadcaster']) {
            const all = Object.values(PARTS_DB).flat().filter(p => characterOfPart(p) === c);
            const sk = skillsForParts({ head: get(`head_${c}`), body: get(`body_${c}`), arm: get(`arm_${c}`) });
            out[c] = { base: all.filter(p => !p.rigVariant).length, sets: all.filter(p => p.rigVariant).length,
                skills: [sk.arm?.name, sk.body?.name, sk.head?.name], leg: legPassiveOf(get(`leg_${c}`))?.name,
                atk: get(`arm_${c}`).attackType, up: !!get(`arm_${c}_up`).rigUpgrade, zone: CHARACTER_ZONE[c],
                roster: !!ROSTER.find(r => r.id === c) };
        }
        return out;""")
    a, c = st['architect'], st['broadcaster']
    ctx.check(a['base'] == 8 and a['sets'] == 36 and c['base'] == 8 and c['sets'] == 36,
              '파츠: 캐릭터마다 기본·강화 8개 + 세트 9개(36개)', str(st))
    ctx.check(a['skills'] == ['기초 파쇄', '강제 재건', '철거 명령'] and a['leg'] == '안전화' and a['atk'] == 'kit' and a['up'],
              '설계자: 기초 파쇄 · 강제 재건 · 철거 명령 · 안전화, 기본 공격 부품 공격(공압 드릴)', str(a))
    ctx.check(c['skills'] == ['공명 파열', '정적의 장막', '긴급 방송'] and c['leg'] == '잡음 차단' and c['atk'] == 'kit' and c['up'],
              '방송자: 공명 파열 · 정적의 장막 · 긴급 방송 · 잡음 차단, 기본 공격 부품 공격(공명 음파)', str(c))
    ctx.check(a['zone'] == 9 and c['zone'] == 10 and a['roster'] and c['roster'], '선택창 10명, 설계자는 구역 9 · 방송자는 구역 10에서 합류 (D-119)', str(st))

    # 연구소: 강화 몸통·다리만 강화 그림
    for cid, base, up, name in (('architect', ARCH, ARCH_UP, '철거의 설계자'), ('broadcaster', CAST, CAST_UP, '침묵의 방송자')):
        g.js(f"progress.unlockedChars = [...new Set([...(progress.unlockedChars || []), '{cid}'])]; progress.selectCharacter('{cid}');"
             f"gameState.cartParts = {{ head: '{base[0]}', body: '{up[1]}', arm: '{base[2]}', leg: '{up[3]}' }};"
             "window.madOverlordGameV2.switchScreen('lab');")
        g.wait(1500)
        st = g.js("""const lab = window.madOverlordGameV2.labController;
            const sk = lab.rig && lab.rig.skeleton;
            return { name: document.getElementById('lab-unit-name-v2').textContent,
                     parts: sk && ['head', 'torso', 'armF', 'legF', 'legB'].map(k => sk.byName[k].part),
                     cards: document.querySelectorAll('#parts-grid-v2 .v2-partcard').length };""")
        ctx.check(st['name'] == name and st['parts'] == ['head', 'torso_up', 'armF', 'legF_up', 'legB_up'] and st['cards'] >= 2,
                  f'연구소({name}): 강화 몸통·다리만 강화 그림', str(st))
        g.shot(f'{cid}_lab', '#screen-lab-v2')
        g.js("window.madOverlordGameV2.switchScreen('menu');")
        g.wait(400)

    # ---- 철거의 설계자 ----
    fresh_battle(g, ARCH)
    st = g.js("return { id: m.getCharacterId(), type: b.attackType, arm: m.rigBattle.skeleton.byName.armF.part, hand: m.rigBattle.skeleton.byName.handF.part };")
    ctx.check(st['id'] == 'architect' and st['type'] == 'kit' and st['arm'] == 'armF' and st['hand'] == 'handF', '전투: 설계자 리그(드릴 손 관절), 기본 그림', str(st))
    g.js(spawn('guard', 60, hp=9000))
    g.wait(2500)
    ctx.check(g.js("const e = b.enemies[0]; return e.hp < e.maxHp;"), '공압 드릴: 가까운 적에게 피해')
    g.js(CLEAN + spawn('guard', 60) + spawn('raider', 130))
    ok = g.js("return b.useSkill('arm');")
    g.wait(800)
    st = g.js("return b.enemies.map(e => ({ held: e.stunT > 0, hurt: e.hp < e.maxHp }));")
    ctx.check(ok and len(st) == 2 and all(s['held'] and s['hurt'] for s in st), '기초 파쇄: 앞 적 피해 + 기절', str(st))
    # 강제 재건: 철골 바리케이드 — 걸어오는 적이 벽에서 멈춤
    g.js(CLEAN + "b.skillCd.body = 0; window.__dps = b.playerDps; b.playerDps = 0;" + spawn('guard', 150, hp=9000))
    ok = g.js("return b.useSkill('body');")
    g.wait(900)
    g.js("b.enemies[0].speed = 90;")   # 벽이 선 뒤 걸어옴
    g.wait(2400)
    st = g.js("""const z = b.kitZones.find(z => z.wall), e = b.enemies[0];
        return { wall: !!z, art: !!document.querySelector('.v2-kit-art.is-scaffold'), edge: z ? Math.round(z.x + z.w) : null,
                 ex: e ? Math.round(e.x + 38) : null, front: Math.round(b.frontX()) };""")
    ctx.check(ok and st['wall'] and st['art'] and st['ex'] is not None and st['ex'] >= st['edge'] - 2,
              '강제 재건: 철골 바리케이드 그림 + 걸어오는 적이 벽에서 멈춤', str(st))
    g.shot('architect_scaffold', '#screen-battle-v2')
    g.wait(4200)
    ctx.check(g.js("return !b.kitZones.some(z => z.wall) && !document.querySelector('.v2-kit-art:not(.is-gone)');"), '6초 뒤 바리케이드가 무너지며 사라짐')
    g.js("b.playerDps = window.__dps;")
    # 안전화: 거점·바리케이드 피해 +25%
    st = g.js(CLEAN + "const br = b.spawnBarricade(b.frontX() + 200, 5000); const e = " + spawn('guard', 100).rstrip(';') + ";"
              " return { bar: b.kitTargetMul(br), unit: b.kitTargetMul(e) };")
    ctx.check(abs(st['bar'] - 1.25) < 1e-6 and abs(st['unit'] - 1) < 1e-6, '안전화: 바리케이드·거점 피해 +25% (적은 그대로)', str(st))
    # 철거 명령 (필살기)
    g.js(CLEAN + spawn('guard', 80) + spawn('shield', 200) + "b.ultGauge = 1;")
    ok = g.js("return b.useSkill('head');")
    g.wait(3200)
    st = g.js("return b.enemies.map(e => e.hp < e.maxHp);")
    ctx.check(ok and any(st), '철거 명령: 크레인 철구가 내리쳐 피해', str(st))
    g.shot('architect_ult', '#screen-battle-v2')
    # 강화 파츠: 그림·총구
    fresh_battle(g, ARCH_UP)
    st = g.js("const sk = m.rigBattle.skeleton; return { parts: ['head', 'torso', 'armF', 'handF', 'armB', 'legF'].map(k => sk.byName[k].part), muzzle: sk.socketAlias && sk.socketAlias.muzzle };")
    ctx.check(st['parts'] == ['head_up', 'torso_up', 'armF_up', 'handF_up', 'armB_up', 'legF_up'] and st['muzzle'] == 'muzzleUp',
              '강화 파츠: 강화 그림(큰 드릴·유압 집게), 드릴 끝 소켓', str(st))
    g.shot('architect_up', '#screen-battle-v2')

    # ---- 침묵의 방송자 ----
    fresh_battle(g, CAST)
    st = g.js("return { id: m.getCharacterId(), type: b.attackType, arm: m.rigBattle.skeleton.byName.armF.part };")
    ctx.check(st['id'] == 'broadcaster' and st['type'] == 'kit' and st['arm'] == 'armF', '전투: 방송자 리그, 기본 그림', str(st))
    g.js(spawn('guard', 120, hp=9000) + spawn('raider', 180, hp=9000))
    g.wait(2600)
    ctx.check(g.js("return b.enemies.filter(e => e.hp < e.maxHp).length;") >= 2, '공명 음파: 앞 적들을 꿰뚫어 피해')
    g.js(CLEAN + spawn('guard', 80) + spawn('raider', 200))
    ok = g.js("return b.useSkill('arm');")
    g.wait(1400)
    st = g.js("return b.enemies.map(e => ({ hurt: e.hp < e.maxHp, stun: e.stunT > 0 || e.cd.stunSeen }));")
    ctx.check(ok and len(st) == 2 and all(s['hurt'] for s in st), '공명 파열: 음파 고리 3겹이 지나간 적에게 피해', str(st))
    # 정적의 장막: 장막 가운데의 마취총 사수(원거리, 밀리지 않게)는 침묵 → 못 쏨 / 장막이 걷히면 다시 쏨
    g.js(CLEAN + "b.skillCd.body = 0; window.__dps = b.playerDps; b.playerDps = 0;"
         "const e = b.spawnMinion('tranq', { x: b.frontX() + 150, elite: false }); e.speed = 0; e.hp = e.maxHp = 9000; e.knockResist = true;")
    ok = g.js("return b.useSkill('body');")
    g.wait(900)
    g.js("const z = b.kitZones.find(z => z.tag === 'dome'); const e = b.enemies[0]; e.x = z.x + z.w / 2 - 38; e.dom.style.left = e.x + 'px';")
    g.wait(1300)   # 장판 침묵이 걸린 뒤 쏠 준비를 끝내 둠 → 침묵이면 쏘지 못하고 그대로
    g.js("b.enemies[0].cd.skill = 99;")
    g.wait(1200)
    st = g.js("""const e = b.enemies[0];
        return { dome: !!document.querySelector('.v2-kit-art.is-dome'), silence: e.kitSilenceT > 0, icon: !!e.dom.querySelector('.v2-status__icon.is-silence'),
                 held: e.cd.skill >= 99, mul: b.kitTargetMul(e) };""")
    ctx.check(ok and st['dome'] and st['silence'] and st['icon'] and st['held'],
              '정적의 장막: 분홍 반구 + 안의 원거리 적 침묵(아이콘) → 쏘지 못함', str(st))
    ctx.check(abs(st['mul'] - 1.2) < 1e-6, '잡음 차단: 침묵한 적에게 피해 +20%', str(st))
    g.shot('broadcaster_dome', '#screen-battle-v2')
    g.js("b.kitZones.forEach(z => b.kitZoneArt(z, true)); b.kitZones = []; delete b.kitBuffs.dome; b.kitModCache = null;"
         "const e = b.enemies[0]; e.kitSilenceT = 0; b._hurt = 0; b.playerDps = window.__dps;")
    g.wait(1500)
    st = g.js("return { hurt: Math.round(b._hurt), cd: b.enemies[0].cd.skill };")
    ctx.check(st['hurt'] > 0 and st['cd'] < 99, '장막이 걷히고 침묵이 풀리면 다시 쏨 (대조)', str(st))
    # 긴급 방송: 화면 적 모두 침묵 + 피해
    g.js(CLEAN + spawn('guard', 80) + spawn('mage', 250) + spawn('priest', 400) + "b.ultGauge = 1;")
    ok = g.js("return b.useSkill('head');")
    g.wait(2600)
    st = g.js("return b.enemies.map(e => ({ silence: e.kitSilenceT > 0, hurt: e.hp < e.maxHp }));")
    ctx.check(ok and len(st) == 3 and all(s['silence'] and s['hurt'] for s in st), '긴급 방송: 화면 적 모두 침묵 + 음파 피해', str(st))
    g.shot('broadcaster_ult', '#screen-battle-v2')
    # 침묵한 보스: 기술을 못 씀 (오르비안 파문의 종)
    st = g.js(CLEAN + "const e = " + spawn('orbian', 200, hp=90000).rstrip(';') + ";"
              " b.kitStatus(e, { silence: 6 }); b.skillCd.arm = 0; e.cd.bell = 99; e.cd.judgment = -99; e.cd.scales = -99;"
              " return { t: Math.round(e.kitSilenceT * 10) / 10 };")
    g.wait(1800)
    st2 = g.js("return { arm: b.skillCd.arm, hurt: Math.round(b._hurt) };")
    ctx.check(st['t'] == 3 and st2['arm'] == 0 and st2['hurt'] == 0, '보스 침묵은 시간 절반 · 침묵한 동안 기술(파문의 종)을 못 씀', f'{st} {st2}')
    # 강화 파츠
    fresh_battle(g, CAST_UP)
    st = g.js("const sk = m.rigBattle.skeleton; return { parts: ['head', 'torso', 'armF', 'armB', 'legF'].map(k => sk.byName[k].part), muzzle: sk.socketAlias && sk.socketAlias.muzzle };")
    ctx.check(st['parts'] == ['head_up', 'torso_up', 'armF_up', 'armB_up', 'legF_up'] and st['muzzle'] == 'muzzleUp',
              '강화 파츠: 강화 그림(큰 소리굽쇠·스피커 대포), 소리굽쇠 끝 소켓', str(st))
    g.shot('broadcaster_up', '#screen-battle-v2')
    g.js("b.stopBattle();")
