"""
11-14 버그 점검에서 찾아 고친 것들이 다시 생기지 않는지 (MD/버그점검_20261114.md 번호)

다른 검사와 다른 점 — 이 버그들이 숨어 있던 길로 일부러 들어감:
  숨김 그룹을 닫은 보통 상태(?openGroups 없음) · 피로도 켬 · 휴대폰 창 폭 · 스페셜맵은 피해를 직접 넣지 않고 기본 공격으로
"""
import time

ALL_IDS = [f'{z}-{i}' for z in range(1, 11) for i in list(range(1, 11)) + ['B']]
Z1 = [f'1-{i}' for i in range(1, 11)] + ['1-B']
BUILDS = {
    'mech': ('head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel'),
    'hero': ('head_hero', 'body_hero', 'arm_hero_wave', 'leg_hero_hover'),
}


def plain(ctx, viewport=(1300, 740), touch=False):
    """실제 출시 상태: 숨김 그룹(구역 7~10) 닫힘 · 피로도·인트로 켬"""
    g = ctx.game(fresh=True, viewport=viewport, touch=touch)
    g.page.goto(f'{ctx.base}/index.html?skipTitle=1&t={time.time()}')
    g.page.evaluate('() => localStorage.clear()')
    g.page.reload()
    g.enter_v2()
    g.js("window.madOverlordNoStamina = false;")
    return g


def clear(g, ids, diff='normal'):
    g.js(f"""{ids}.forEach(id => progress.recordsOf('{diff}')[id] = {{ stars: [true,true,true], cleared: true, bestTime: 1 }});
        progress.syncStamina(); progress.tips.add('stamina_intro'); progress.save(); gameState.notify();""")


def gear(g, char, stage, level=13, grade='legendary', all_clear=True):
    head, body, arm, leg = BUILDS[char]
    pre = (f"['normal','hard','hell','nightmare'].forEach(d => {ALL_IDS}.forEach(id => progress.recordsOf(d)[id] = "
           "{ stars: [true,true,true], cleared: true, bestTime: 1 }));") if all_clear else ''
    g.js(pre + f"""
        ['{arm}', '{head}', '{body}', '{leg}'].forEach(id => {{ progress.owned.add(id); progress.levels[id] = {level}; if ('{grade}') progress.grades[id] = '{grade}'; }});
        if (!progress.unlockedChars.includes('{char}')) progress.unlockedChars.push('{char}');
        gameState.equippedParts = {{ head: '{head}', body: '{body}', arm: '{arm}', leg: '{leg}' }};
        progress.supportCharacter = null; progress.supportAuto = false; progress.selectStage('{stage}');""")


def start(g, wait=2600):
    g.js("window.madOverlordGameV2.switchScreen('battle');")
    g.wait(wait)
    g.js("b.setAutoSkills(false); gameTime.speed = 1;")


def to_final(g):
    g.js("b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5; b.playerSpeed = Math.max(b.playerSpeed, 100);")
    for _ in range(48):
        g.wait(250)
        if g.js("return !!b.enemies.find(e => e.isBuilding && e.isFinal);"):
            return True
    return False


KILL_FINAL = "const bd = b.enemies.find(e => e.isBuilding && e.isFinal); if (bd) { bd.hp = 1; b.dealDamageToEnemy(bd, 50, true, { knock: 0 }); }"


def run(ctx):
    # ===== S2 · L3 · S7 · M1 : 숨김 그룹이 닫힌 보통 상태 =====
    g = plain(ctx)
    clear(g, [f'{z}-{i}' for z in range(1, 7) for i in list(range(1, 11)) + ['B']][:-1])   # 6-10까지
    gear(g, 'mech', '6-B', all_clear=False)
    g.js("progress.save(); gameState.notify();")
    g.page.click('#btn-to-battle-v2')
    g.wait(2500)
    g.js("b.finishBattle(true);")
    g.page.wait_for_selector('.v2-result [data-act]', timeout=20000)
    st = g.js("""const { isUnlocked } = await import('/js/engine_v2/stages_v2.js');
        return { acts: [...document.querySelectorAll('.v2-result [data-act]')].map(x => x.dataset.act), cleared: progress.stage('6-B', 'normal').cleared,
                 open71: isUnlocked('7-1', progress) };""")
    ctx.check(st['cleared'] and not st['open71'] and 'next' not in st['acts'] and 'retry' in st['acts'],
              "S2 6-B를 깬 결과 화면에 '다음 7-1'이 없음 (구역 7은 공개 전)", str(st))
    g.page.click(".v2-result [data-act='menu']")
    g.wait(600)

    # L3: 협력 출격 창·확률 정보에 공개 전 캐릭터가 안 보임
    g.page.click('#btn-menu-coop-v2')
    g.wait(700)
    st = g.js("""const t = document.querySelector('.v2-growth').innerText;
        return { hidden: ['인형사', '서리의 무희', '설계자', '방송자'].filter(n => t.includes(n)), shown: ['거대괴수', '타락 히어로'].filter(n => t.includes(n)).length,
                 chip: !!document.querySelector('.v2-growth [data-stamina-chip]:not([hidden])') };""")
    ctx.check(not st['hidden'] and st['shown'] == 2, 'L3 협력 출격 창에 공개 전 캐릭터 4명이 안 나옴 (공개된 캐릭터는 그대로)', str(st))
    ctx.check(st['chip'], 'L2 작전 지원 창 머리에 ⚡ 칩', str(st))
    g.js("(await import('/js/ui_v2/growthUi_v2.js')).closeGrowthPanel();")
    g.wait(300)

    # S7: 몸통 없는 캐릭터로 스페셜맵·탑 입장 불가 (횟수도 안 씀)
    st = g.js("""const keep = { ...gameState.equippedParts };
        gameState.equippedParts = { head: 'none', body: 'none', arm: 'none', leg: 'none' };
        const used0 = (progress.special.used || {}).boss || 0;
        const r = progress.startSpecial('boss'), tw = progress.startTower();
        const out = { ok: r.success, reason: r.reason || '', tower: tw.success, used: ((progress.special.used || {}).boss || 0) - used0 };
        gameState.equippedParts = keep;
        const r2 = progress.startSpecial('boss');
        return { ...out, withBody: r2.success };""")
    ctx.check(not st['ok'] and not st['tower'] and st['used'] == 0 and '몸통' in st['reason'] and st['withBody'],
              'S7 몸통이 없으면 스페셜맵·탑 입장 불가 · 횟수 그대로 (몸통이 있으면 입장)', str(st))

    # M1: 지도 정거장을 누르면 걷는 동안에도 이미 그 판이 골라져 있음
    g = plain(ctx)
    clear(g, [f'1-{i}' for i in range(1, 9)])
    g.js("progress.stamina.on = false; progress.selectStage('1-2'); progress.save(); gameState.notify();")
    g.wait(600)
    g.page.click('.v2-smap__stop[data-id="1-9"]', force=True)
    g.wait(150)
    mid = g.js("const sm = window.madOverlordGameV2.menuController.stageMap; return { sel: progress.selectedStage, walking: !!sm.walking, mapSel: sm.sel };")
    g.page.click('#btn-to-battle-v2')
    g.wait(2300)
    st = g.js("return { stage: b.stage && b.stage.id, sel: progress.selectedStage };")
    ctx.check(mid['sel'] == '1-9' and mid['walking'] and st['stage'] == '1-9', 'M1 정거장을 누른 순간 골라짐 — 걷는 동안 출격해도 누른 판(1-9)', f'{mid} {st}')
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== S3 · L7 · L4 : 승리가 정해진 순간 확정 =====
    g = plain(ctx)
    clear(g, Z1)
    gear(g, 'mech', '1-5', all_clear=False)
    g.js("progress.stamina.v = 80; progress.selectStage('1-5'); progress.save(); gameState.notify();")
    g.page.click('#btn-to-battle-v2')
    g.wait(2800)
    cost = g.js("return progress.stamina.pending ? progress.stamina.pending.cost : 0;")
    g.js("if (progress.stamina.pending) progress.stamina.pending.t -= 60000;")   # 포기 환급 시간(10초) 밖
    ok = to_final(g)
    g.js("progress.recordsOf('normal')['1-5'].bestTime = 9999; b.spawnInterval = 999; const bd = b.enemies.find(e => e.isBuilding && e.isFinal); if (bd) { bd.hp = 1; b.schedule(0.05, () => b.dealDamageToEnemy(bd, 50, true, { knock: 0 })); }")
    g.wait(500)
    mid = g.js("return { destroyed: b.finalBaseDestroyed, pending: progress.stamina.pending, v: progress.stamina.v, best: progress.stage('1-5', 'normal').bestTime, state: m.currentState, foes: b.enemies.length };")
    ctx.check(ok and cost == 6 and mid['destroyed'] and mid['pending'] is None and mid['v'] == 74 and mid['best'] < 9999,
              'S3 최종 기지가 부서진 순간 기록·피로도 확정 (연출이 끝나기 전)', str(mid))
    ctx.check(mid['state'] == 'victory' and mid['foes'] == 0, 'L4 예약 타격으로 끝내도 승리 자세 · 새 적 없음', str(mid))
    g.page.click('#btn-pause-v2', force=True)
    g.wait(250)
    g.page.click('#btn-battle-leave-v2')
    g.wait(800)
    g.js("window.__played = []; const op = sound.play.bind(sound); sound.play = (n, o) => { window.__played.push(n); return op(n, o); };")
    g.wait(4200)
    st = g.js("return { menu: !!document.querySelector('#screen-menu-v2.active'), v: progress.stamina.v, played: window.__played, bgm: sound.bgm && sound.bgm.name };")
    ctx.check(st['menu'] and st['v'] == 74, 'S3 연출 중에 포기해도 피로도는 이긴 판만큼(6) — 1만 쓰고 DM을 다 받던 길 없음', str(st))
    ctx.check('mission_complete' not in st['played'] and st['bgm'] == 'menu', 'L7 나간 뒤 메뉴에서 승리 효과음이 안 나고 메뉴 배경음 그대로', str(st))

    # ===== M2 : 목숨을 다 쓴 뒤에는 기지가 부서지지 않음 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    gear(g, 'mech', '1-3')
    start(g)
    to_final(g)
    g.js("b.overloadT = 0; b.lives = 0; b.playerHp = 0;")
    g.wait(500)
    g.js(KILL_FINAL)
    g.wait(300)
    mid = g.js("return { livesOut: b.livesOut, destroyed: b.finalBaseDestroyed };")
    g.page.wait_for_selector('.v2-result', timeout=12000)
    st = g.js("return { win: !!document.querySelector('.v2-result.is-win'), title: document.querySelector('.v2-result__title').textContent };")
    ctx.check(mid['livesOut'] and not mid['destroyed'] and not st['win'] and 'FAILED' in st['title'], 'M2 쓰러지는 연출 중에는 기지가 부서지지 않음 → 패배만', f'{mid} {st}')
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # L5: 피격 움찔 시각은 판마다 새로
    start(g)
    g.js("b.stats.time = 140; b.damagePlayer(5, 0);")
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    start(g, 1500)
    st = g.js("""let n = 0; const o = m.playReaction.bind(m); m.playReaction = (k, ...r) => { if (k === 'hurt') n++; return o(k, ...r); };
        const before = b.hurtReactAt; b.damagePlayer(5, 0); m.playReaction = o; return { before: before ?? null, n };""")
    ctx.check(st['before'] is None and st['n'] == 1, 'L5 다음 판 시작부터 피격 움찔 반응이 나옴', str(st))

    # M4: 걷는 중 판정 — 서서 싸우는 동안은 걷는 중이 아님
    g.place_enemies(n=2, first=120, hp=1e7, speed=0, dps=1)
    g.wait(1200)
    a = g.js("return { attacking: b.isAttacking, walking: b.kitWalking() };")
    g.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding); b.spawnInterval = 999;")
    g.wait(600)
    w = g.js("return { attacking: b.isAttacking, walking: b.kitWalking() };")
    ctx.check(a['attacking'] and not a['walking'] and w['walking'], "M4 '걷는 중'은 공격 중이 아닐 때만 (돌격 자세 첫 타 · 보행 충전)", f'{a} {w}')
    # M5: 세트 4부위 체력 기준은 계기마다
    st = g.js("""b.kitTriggers = [{ when: 'lowHp', below: 0.5, once: 't50', fn: () => { window.__f50 = (window.__f50 || 0) + 1; } },
                                 { when: 'lowHp', once: 't30', fn: () => { window.__f30 = (window.__f30 || 0) + 1; } }];
        b.kitOnce = {}; window.__f50 = 0; window.__f30 = 0;
        b.playerHp = b.maxPlayerHp * 0.45; b.tickKit(0.016);
        const at45 = [window.__f50, window.__f30];
        b.playerHp = b.maxPlayerHp * 0.25; b.tickKit(0.016);
        const at25 = [window.__f50, window.__f30];
        b.playerHp = b.maxPlayerHp; return { at45, at25 };""")
    ctx.check(st['at45'] == [1, 0] and st['at25'] == [1, 1], 'M5 체력 50% 기준 효과는 50%에서, 기본(30%) 효과는 30%에서 발동', str(st))
    st = g.js("""const K = (await import('/js/engine_v2/sets2/kaijuSets2.js')), C = (await import('/js/engine_v2/sets2/chimeraSets2.js'));
        const find = (mod, once) => JSON.stringify(mod).includes(once);
        const src = async p => (await (await fetch(p)).text());
        const k = await src('/js/engine_v2/sets2/kaijuSets2.js'), c = await src('/js/engine_v2/sets2/chimeraSets2.js');
        return { kaiju: /when: 'lowHp', below: 0\\.5, once: 'regen'/.test(k) && k.includes('체력 50% 아래에서 판마다 한 번 재생 폭발'),
                 chimera: /when: 'lowHp', below: 0\\.4, once: 'perfect'/.test(c) && c.includes('체력 40% 아래에서 판마다 한 번 완전체 각성') };""")
    ctx.check(st['kaiju'] and st['chimera'], 'M5 원시의 군주 50% · 완전체 키메라 40% — 설명과 기준이 같음', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== S1 : 대세뇌는 보스를 세뇌하지 않음 =====
    gear(g, 'hero', '3-B')
    start(g)
    to_final(g)
    gate = g.open_boss_gate()
    st = g.js("""b.spawnInterval = 999;
        b.enemies.filter(e => !e.boss && !e.isBuilding).forEach(e => e.dom && e.dom.remove());
        b.enemies = b.enemies.filter(e => e.boss || e.isBuilding);
        b.boss.x = b.monsterX + 260; b.boss.dom.style.left = b.boss.x + 'px';
        b.ultGauge = 1;
        const { SKILLS, hasTarget } = await import('/js/engine_v2/skills_v2.js');
        const usable = hasTarget(b, SKILLS.massMind);
        b.convertEnemy(b.boss);
        return { usable, bossIn: b.enemies.includes(b.boss), dom: !!(b.boss.dom && b.boss.dom.isConnected) };""")
    ctx.check(gate and not st['usable'] and st['bossIn'] and st['dom'], 'S1 보스만 있으면 대세뇌를 쓸 수 없고, 보스는 세뇌되지 않음', str(st))
    g.js("b.spawnMinion('templar'); const e = b.enemies.find(x => x.type === 'templar'); e.x = b.monsterX + 200; e.dom.style.left = e.x + 'px';")
    g.js("b.ultGauge = 1; b.updateHud();")
    g.key('3')
    g.wait(2200)
    st = g.js("return { bossIn: b.enemies.includes(b.boss), templar: b.enemies.filter(x => x.type === 'templar').length, allies: b.allies.length };")
    ctx.check(st['bossIn'] and st['templar'] == 0 and st['allies'] >= 1, 'S1 대세뇌: 보병은 세뇌되고 보스는 남음', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== S5 : 보스가 바로 앞에 있어도 실험체가 바로 흡수되지 않음 =====
    gear(g, 'mech', '6-B', level=1, grade='')
    start(g)
    g.js("b.maxPlayerHp = 1e9; b.playerHp = 1e9;")
    to_final(g)
    g.open_boss_gate()
    g.js("""b.spawnInterval = 999; b.boss.cd.drain = -999; b.boss.cd.pulse = -999; b.boss.cd.shards = -999;
        b.boss.x = b.frontX() + 40; b.boss.dom.style.left = b.boss.x + 'px'; b.boss.hp = b.boss.maxHp * 0.5; b.boss.shield = 0;
        b.donorTimer = b.stage.boss.donors.every - 0.05;""")
    g.wait(1600 + 900)   # 경보 1.6초 뒤 등장 → 0.9초
    a = g.js("const d = b.enemies.filter(e => e.type === 'pauper'); return { n: d.length, shield: b.boss.shield || 0, side: d.every(e => e.x <= b.boss.x) };")
    g.wait(3000)
    z = g.js("return { n: b.enemies.filter(e => e.type === 'pauper').length, shield: b.boss.shield || 0 };")
    ctx.check(a['n'] == 3 and a['shield'] == 0 and a['side'], 'S5 보스가 40px 앞에 있어도 실험체 3명이 나와서 서 있음 (바로 흡수 안 됨 · 주인공 쪽에서 나옴)', str(a))
    ctx.check(z['n'] == 0 and z['shield'] > 0, 'S5 2.5초가 지나도록 못 부수면 흡수 → 방어막', str(z))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== M6 · M8 · L6 =====
    gear(g, 'mech', '8-5')
    start(g)
    st = g.js("""b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);
        b.spawnInterval = 999;
        b.spawnMinion('heatshaman'); b.spawnMinion('heatshaman');
        b.tickEnemies(0.016, b.frontX());
        const statues = b.enemies.filter(e => e.type === 'frozenstatue').length;
        const [s1, s2] = b.enemies.filter(e => e.type === 'heatshaman');
        b.dealDamageToEnemy(s1, 1e9, true, { knock: 0 });
        const afterKill = b.enemies.filter(e => e.type === 'frozenstatue').length;
        b.convertEnemy(s2);
        return { statues, afterKill, afterConvert: b.enemies.filter(e => e.type === 'frozenstatue').length, mine1: s1.statues.length };""")
    ctx.check(st['statues'] >= 6 and st['afterKill'] == st['statues'] - st['mine1'] and st['afterConvert'] == 0,
              'M6 열기 주술사가 해동 전에 쓰러지거나 세뇌되면 조각상도 부서짐 (적 수 상한을 안 막음)', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    st = g.js("""const { stageFor } = await import('/js/engine_v2/difficulty_v2.js'); const { stageById } = await import('/js/engine_v2/stages_v2.js');
        const out = {};
        for (const [id, key] of [['8-B', 'altars'], ['9-B', 'scrap'], ['10-B', 'antennas'], ['6-B', 'donors']]) {
            out[id] = [stageById(id).boss[key].every, stageFor(stageById(id), 'nightmare').boss[key].every];
        }
        return out;""")
    ctx.check(all(v[1] < v[0] for v in st.values()), 'M8 나이트메어: 구역 8·9·10 보스 기믹 간격도 줄어듦', str(st))
    gear(g, 'mech', '9-B')
    start(g)
    to_final(g)
    g.open_boss_gate()
    g.js("b.bossShieldTimer = b.stage.boss.scrap.every - 0.02;")   # 곧 폐자재 더미가 나옴 (그동안 보스 무적)
    g.wait(900)
    up = g.js("return { inv: !!b.boss.invulnerable, cls: b.boss.dom.classList.contains('is-invulnerable'), piles: b.enemies.filter(e => e.isBossShield).length };")
    g.js("b.shieldFuseAt = b.stats.time - 0.01; b.maxPlayerHp = 1e9; b.playerHp = 1e9;")
    g.wait(500)
    dn = g.js("return { inv: !!b.boss.invulnerable, cls: b.boss.dom.classList.contains('is-invulnerable'), piles: b.enemies.filter(e => e.isBossShield).length };")
    ctx.check(up['inv'] and up['cls'] and up['piles'] > 0 and not dn['inv'] and not dn['cls'] and dn['piles'] == 0,
              'L6 폐자재가 폭발로 끝나도 보스 무적 표시가 풀림', f'{up} {dn}')
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== S4 : 파괴 작전 — 기본 공격만으로 물체가 부서짐 =====
    gear(g, 'hero', '1-1')
    st = g.js("const r = progress.startSpecial('smash'); if (r.success) window.madOverlordGameV2.startSpecial(r.stage); return r.success;")
    g.wait(2600)
    g.js("b.setAutoSkills(false); gameTime.speed = 4;")
    s = None
    for _ in range(10):
        g.wait(1000)
        s = g.js("const o = b.enemies.filter(e => e.smashScore); return { t: b.stats.time, broken: b.smashBroken, score: b.smashScore, objs: o.length, range: b.playerRange, active: b.isActive };")
        if s['broken'] >= 2 or not s['active']:
            break
        g.js("if (!gameTime.paused) gameTime.speed = 4;")
    ctx.check(st and s['broken'] >= 2 and s['score'] > 0 and s['objs'] <= 2, 'S4 파괴 작전: 사거리 280 근접 캐릭터의 기본 공격으로 물체가 부서지고 한 자리에 쌓이지 않음', str(s))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== S6 : 새 저장은 별 환급 없음 =====
    g = plain(ctx)
    g.js(f"""{Z1}.forEach(id => progress.recordStage(id, {{ stars: [true, true, true], cleared: true, time: 60 }}, 'normal'));
        progress.spentStars = 9; progress.save();""")
    raw = g.js("const r = JSON.parse(localStorage.getItem('mo_v2_save')); return { flag: r.charStarRefund, has: 'charStarRefund' in r, chars: r.unlockedChars };")
    g.reload_v2()
    st = g.js("return { spent: progress.spentStars, flag: progress.charStarRefund };")
    ctx.check('kaiju' in raw['chars'] and raw['has'] and st['spent'] == 9, 'S6 새 저장: 다시 켜도 쓴 별이 줄지 않음', f'{raw} {st}')
    st = g.js("""progress.loadGrowth({ unlockedChars: ['kaiju', 'hero'], spentStars: 20 });
        const legacy = progress.spentStars;
        progress.loadGrowth({ unlockedChars: ['kaiju', 'hero'], spentStars: 20, charStarRefund: 0 });
        return { legacy, fresh: progress.spentStars };""")
    ctx.check(st['legacy'] == 8 and st['fresh'] == 20, 'S6 표시가 없는 예전 저장만 환급 (표시가 0으로 있는 새 저장은 그대로)', str(st))

    # ===== M3 · M7 · L1 =====
    g = plain(ctx)
    clear(g, Z1)
    g.js("""const id = 'arm_mech_laser'; progress.owned.add(id); gameState.equippedParts.arm = id;
        progress.levels[id] = progress.shardUpgradeCost(id).needLevel; progress.shards = 9999; progress.stones = 99; gameState.darkMatter = 1000000;
        progress.stamina.v = 10; progress.save(); gameState.notify();""")
    g.js("window.madOverlordGameV2.switchScreen('lab');")
    g.wait(1000)
    g.js("const tab = [...document.querySelectorAll('#screen-lab-v2 [data-slot]')].find(x => x.dataset.slot === 'arm'); if (tab) tab.click();")
    g.wait(400)
    g.js("const card = [...document.querySelectorAll('#screen-lab-v2 [data-id], #screen-lab-v2 [data-part]')].find(x => (x.dataset.id || x.dataset.part) === 'arm_mech_laser'); if (card) card.click();")
    g.wait(500)
    st = g.js("""const gc = progress.shardUpgradeCost('arm_mech_laser'); const btn = document.getElementById('btn-grade-v2');
        const r = btn.getBoundingClientRect(), em = btn.querySelector('em'), er = em ? em.getBoundingClientRect() : null;
        return { text: btn.innerText.replace(/\\s+/g, ' '), dm: gc.dm.toLocaleString(), disabled: btn.disabled,
                 inside: !!er && er.left >= r.left - 1 && er.right <= r.right + 1 && er.bottom <= r.bottom + 1 };""")
    ctx.check(st['dm'] in st['text'] and not st['disabled'] and st['inside'], "M3 연구소 '등급 ▲' 단추에 DM 값이 보임 (단추 안에 들어감)", str(st))
    g.shot('bugs1114_grade_button', '#lab-upgrade-v2')
    g.js("progress.levels['arm_mech_laser'] = 1; gameState.notify(); window.madOverlordGameV2.labController.render && window.madOverlordGameV2.labController.render();")
    g.wait(400)
    st = g.js("const btn = document.getElementById('btn-grade-v2'); return { text: btn.innerText.replace(/\\s+/g, ' '), disabled: btn.disabled };")
    ctx.check(st['disabled'] and '강화' in st['text'] and 'Lv' in st['text'], 'M3 강화 레벨이 모자라 꺼진 단추에는 그 까닭이 보임', str(st))
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)

    # L1: 상점 안 ⚡ 칩 → 피로도 창이 상점 위
    g.js("(await import('/js/ui_v2/shop_v2.js')).openShop('menu');")
    g.wait(800)
    pos = g.js("const c = document.querySelector('.v2-commerce [data-stamina-chip]'); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };")
    g.page.mouse.click(pos['x'], pos['y'])
    g.wait(600)
    st = g.js("""const s = document.querySelector('.v2-stamina'); if (!s) return { open: false };
        const r = s.querySelector('.v2-stamina__panel').getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
        return { open: true, onTop: !!(top && top.closest('.v2-stamina')) };""")
    ctx.check(st.get('open') and st.get('onTop'), 'L1 상점 안에서 ⚡ 칩을 누르면 피로도 창이 상점 위에 열림', str(st))
    # M7: 그 창에서 DM 충전을 빠르게 두 번 눌러도 한 번만
    before = g.js("return { dm: gameState.darkMatter, n: progress.stamina.buy.n, price: progress.staminaBuyPrice() };")
    pos = g.js("const b2 = document.querySelector('.v2-stamina [data-act=\"buy\"]'); const r = b2.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };")
    g.page.mouse.dblclick(pos['x'], pos['y'])
    g.wait(300)
    mid = g.js("return { dm: gameState.darkMatter, n: progress.stamina.buy.n, dis: document.querySelector('.v2-stamina [data-act=\"buy\"]').disabled };")
    g.wait(900)
    aft = g.js("return { dis: document.querySelector('.v2-stamina [data-act=\"buy\"]').disabled };")
    ctx.check(mid['n'] == before['n'] + 1 and before['dm'] - mid['dm'] == before['price'] and mid['dis'] and not aft['dis'],
              'M7 DM 충전을 두 번 눌러도 한 번만 사고, 잠깐 뒤 다시 누를 수 있음', f'{before} {mid} {aft}')
    g.js("document.querySelector('.v2-stamina [data-act=\"close\"]').click();")
    g.key('Escape')
    g.wait(300)

    # ===== L8 : 결과에서 바로 다음 구역 첫 판으로 가도 인트로 음악이 메뉴 음악으로 안 바뀜 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("window.madOverlordNoIntro = false;")
    g.js(f"""{Z1[:-1]}.forEach(id => progress.recordsOf('normal')[id] = {{ stars: [true,true,true], cleared: true, bestTime: 1 }});
        progress.selectStage('1-B'); progress.save(); gameState.notify();""")
    g.js("window.madOverlordGameV2.switchScreen('battle');")
    g.wait(2600)
    g.js("b.finishBattle(true);")
    g.page.wait_for_selector(".v2-result [data-act='next']", timeout=15000)
    g.wait(150)
    g.page.click(".v2-result [data-act='next']", force=True)
    g.wait(3200)
    st = g.js("return { intro: !!document.querySelector('.v2-story'), bgm: sound.bgm && sound.bgm.name };")
    ctx.check(st['intro'] and st['bgm'] != 'menu', "L8 결과 창이 뜨자마자 '다음 2-1' → 스토리 인트로 음악이 그대로", str(st))

    # ===== S8 : 휴대폰 창 폭에서도 적·거점 자리가 PC와 같음 =====
    xs = {}
    for name, vp, touch in (('pc', (1300, 740), False), ('phone', (892, 412), True)):
        p = ctx.game(fresh=True, viewport=vp, touch=touch)
        p.enter_v2()
        gear(p, 'mech', '1-4', level=1, grade='')
        start(p, 2200)
        p.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding); b.spawnInterval = 999;")
        ex = p.js("const e = b.spawnMinion('conscript'); return Math.round(e.x);")
        p.js("b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.spawnBase('mid');")
        bx = p.js("const bd = b.enemies.find(e => e.isBuilding); return bd ? Math.round(bd.x) : null;")
        xs[name] = (ex, bx, p.js("return innerWidth;"))
    ctx.check(xs['pc'][:2] == xs['phone'][:2] and xs['phone'][2] <= 1000 and xs['pc'][0] == 980,
              'S8 휴대폰 창 폭(1000px 이하)에서도 적 등장 자리(980)·거점 자리가 PC와 같음', str(xs))
