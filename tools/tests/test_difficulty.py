"""난이도 (D-063): 노말·하드·헬·나이트메어 — 잠금·해금, 난이도별 기록·별 보너스, 배율, 엘리트 속성, 보스 기술 간격, 강화 한도, 저장"""
from test_stages import clear_stage_fast

ALL = "(await import('/js/engine_v2/stages_v2.js')).STAGES.map(s => s.id)"   # 모든 스테이지 id (구역이 늘어도 그대로)


def clear_all(diff, but=None):
    skip = f" && id !== '{but}'" if but else ''
    return (f"{ALL}.forEach(id => {{ if (true{skip}) progress.recordsOf('{diff}')[id] = "
            "{ stars: [true,true,true], cleared: true, bestTime: 60 }; });")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    menu = "window.madOverlordGameV2.menuController"
    # 배율은 difficulty_v2.js에서 읽어 비교 (수치를 조정해도 검사는 그대로)
    D = g.js("const { DIFFICULTIES } = await import('/js/engine_v2/difficulty_v2.js'); return Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));")
    H, N = D['hard'], D['nightmare']

    def round_to(v, step):
        return round(v / step) * step

    # 처음: 노말만 열림, 잠긴 난이도는 안내만
    st = g.js(f"""const tabs = [...document.querySelectorAll('#menu-diffs-v2 .v2-difftab')];
        {menu}.selectDifficulty('hard');
        return {{ diff: progress.difficulty, tabs: tabs.map(t => [t.dataset.diff, t.classList.contains('is-locked')]),
                 foot: document.getElementById('menu-map-foot-v2').textContent, max: progress.maxLevel() }};""")
    ctx.check(st['tabs'] == [['normal', False], ['hard', True], ['hell', True], ['nightmare', True]],
              '난이도 버튼 4개: 처음엔 노말만 열림', str(st['tabs']))
    ctx.check(st['diff'] == 'normal' and '노말 4-B' in st['foot'], '잠긴 하드: 선택 안 됨 + "노말 4-B까지" 안내', st['foot'])
    ctx.check(st['max'] == 5, '노말만 열렸을 때 강화 한도 Lv5')

    # 배율: 노말은 원래 스테이지 그대로, 하드·나이트메어는 곱한 복사본
    st = g.js("""const { stageFor, DIFFICULTIES } = await import('/js/engine_v2/difficulty_v2.js');
        const { stageById } = await import('/js/engine_v2/stages_v2.js');
        const s = stageById('1-B'), h = stageFor(s, 'hard'), n = stageFor(s, 'nightmare'), n4 = stageFor(stageById('4-B'), 'nightmare');
        const H = DIFFICULTIES[1], N = DIFFICULTIES[3];
        return { same: stageFor(s, 'normal') === s, cached: stageFor(s, 'hard') === h,
            hp: Math.abs(h.enemy.hp - s.enemy.hp * H.enemyHp) < 0.011, dps: Math.abs(h.enemy.dps - s.enemy.dps * H.enemyDps) < 0.011,
            base: Math.abs(h.base.final - s.base.final * H.base) <= 50, reward: Math.abs(h.reward.final - s.reward.final * H.reward) <= 25,
            elite: Math.abs(h.elite - (s.elite + H.elite)) < 0.001, origHp: s.enemy.hp, origEvery: s.boss.orbital.every,
            art: n.boss.orbital.every, artWant: Math.round(20 / N.bossHaste * 100) / 100, warn: n.boss.orbital.warn, time: n.timeLimit, origTime: s.timeLimit,
            aff: [stageFor(stageById('1-1'), 'hard').affixCount, stageFor(stageById('1-1'), 'hell').affixCount, n4.affixCount] };""")
    ctx.check(st['same'] and st['cached'], '노말 = 원래 스테이지 객체, 같은 난이도는 같은 복사본')
    ctx.check(st['hp'] and st['dps'] and st['base'] and st['reward'] and st['elite'],
              '하드: 적 체력·공격력·거점 체력·보상·엘리트 확률 배율', str(st))
    ctx.check(st['origHp'] == 2.3 and st['origEvery'] == 20, '배율은 원래 스테이지 값을 바꾸지 않음', str(st))
    ctx.check(st['art'] == st['artWant'] < 20 and st['warn'] == 2.2 and st['time'] > st['origTime'],
              f"나이트메어: 궤도 폭격 간격 20 → {st['artWant']}초(경고 시간 그대로), 제한 시간 늘어남", str(st))
    ctx.check(st['aff'] == [1, 2, 3], '엘리트 속성 수: 하드 구역 1 = 1개, 헬 = 2개, 나이트메어 구역 4 = 3개', str(st['aff']))

    # 노말 4-B까지 깨면 하드가 열리고 강화 한도 Lv7, 하드는 기록이 따로라 1-1부터
    g.js(clear_all('normal') + f" {menu}.renderStages();")
    st = g.js(f"""{menu}.selectDifficulty('hard');
        const {{ isUnlocked }} = await import('/js/engine_v2/stages_v2.js');
        progress.levels['arm_red_robot'] = 5;
        return {{ diff: progress.difficulty, max: progress.maxLevel(), cur: {menu}.currentStage().id,
                 u12: isUnlocked('1-2', progress), n12: progress.stage('1-2', 'normal').cleared,
                 hell: document.querySelector('#menu-diffs-v2 [data-diff="hell"]').classList.contains('is-locked'),
                 cost: progress.upgradeCost('arm_red_robot'), note: !document.getElementById('menu-diffnote-v2').hidden,
                 sub: document.getElementById('menu-sortie-sub-v2').textContent }};""")
    ctx.check(st['diff'] == 'hard' and st['max'] == 7 and st['cost'], '노말 4-B 클리어 → 하드 열림, 강화 한도 Lv7 (Lv5에서 더 강화 가능)', str(st))
    ctx.check(st['cur'] == '1-1' and not st['u12'] and st['n12'], '하드 기록은 따로: 하드 1-2는 잠김 (노말 기록은 그대로)', str(st))
    ctx.check(st['hell'] and st['note'] and '하드' in st['sub'], '헬은 아직 잠김, 레이더 배율 요약·출격 버튼에 하드 표시', str(st))
    g.shot('difficulty_menu', '#screen-menu-v2')

    # 하드 1-1 전투: 배율이 붙은 스테이지, HUD 난이도 표시, 클리어 → 하드 기록·별 보너스 배율
    g.page.click('#btn-to-battle-v2')
    g.wait(2900)
    st = g.js("""return { diff: b.difficulty, hp: b.stage.enemy.hp, dps: b.stage.enemy.dps, hud: document.getElementById('hud-stage-v2').textContent,
        screen: document.getElementById('screen-battle-v2').dataset.difficulty };""")
    ctx.check(st['diff'] == 'hard' and st['hp'] == H['enemyHp'] and st['dps'] == H['enemyDps'],
              f"하드 1-1 전투: 적 체력 ×{H['enemyHp']} · 공격력 ×{H['enemyDps']}", str(st))
    ctx.check('하드' in st['hud'] and st['screen'] == 'hard', 'HUD에 하드 표시', st['hud'])
    dm0 = g.js('return gameState.darkMatter;')
    clear_stage_fast(g, keep_hp=True)
    st = g.js("""return { hard: progress.stage('1-1', 'hard'), normalStars: progress.stage('1-1', 'normal').stars,
        op: document.querySelector('.v2-result__op')?.textContent || '', bonus: document.querySelector('.v2-result__stats')?.textContent || '' };""")
    ctx.check(st['hard']['cleared'] and st['hard']['stars'] == [True, True, True], '하드 1-1 별 3개가 하드 기록에 저장', str(st['hard']))
    bonus = round(3 * 300 * H['reward'])
    ctx.check('하드' in st['op'] and f'+{bonus:,}' in st['bonus'], f"결과 화면 하드 표시 · 새 별 보너스 3 × 300 × {H['reward']} = {bonus:,}", st['bonus'][:120])
    gained = g.js('return gameState.darkMatter;') - dm0
    want = round_to(500 * H['reward'], 50) + round_to(1500 * H['reward'], 50) + bonus
    ctx.check(gained >= want, f'하드 보상: 요새 + 기지 + 새 별 보너스 = {want:,} 이상', str(gained))
    g.shot('difficulty_result', '#screen-battle-v2')

    # 하드 4-B를 처음 깨면 헬이 열림 (결과 화면 안내) + 강화 한도 Lv9
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    g.js(clear_all('hard', but='4-B') + " progress.selectStage('4-B'); window.madOverlordGameV2.switchScreen('battle');")
    g.wait(2900)
    g.js("b.finishBattle(true);")
    g.wait(1500)
    st = g.js("""return { stage: b.stage.id, diff: b.difficulty, unlock: document.querySelector('.v2-result__unlock')?.textContent || '',
        hell: progress.stage('4-B', 'hard').cleared, max: progress.maxLevel() };""")
    ctx.check(st['stage'] == '4-B' and st['hell'] and '헬' in st['unlock'] and 'Lv9' in st['unlock'] and st['max'] == 9,
              '하드 4-B 클리어 → 결과 화면 "헬 난이도가 열렸습니다 · 강화 한도 Lv9"', str(st))
    g.shot('difficulty_unlock', '#screen-battle-v2')

    # 나이트메어 4-B: 보스 기술 간격 ÷bossHaste, 엘리트 속성 3개 (원래 종류 정의는 그대로)
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    g.js(clear_all('hell') + " progress.selectDifficulty('nightmare'); progress.selectStage('4-B'); window.madOverlordGameV2.switchScreen('battle');")
    g.wait(2900)
    st = g.js("""const { ENEMY_TYPES } = await import('/js/engine_v2/enemies_v2.js');
        b.spawnInterval = 999;
        const boss = b.spawnMinion('oculus', { x: b.monsterX + 700, elite: false });
        const elite = b.spawnMinion('cultist', { x: b.monsterX + 650, elite: true });
        const r = { diff: b.difficulty, gaze: boss.t.rage.gaze.every, wave: boss.t.wave.every, warn: boss.t.rage.gaze.warn,
            orig: ENEMY_TYPES.oculus.rage.gaze.every, origWave: ENEMY_TYPES.oculus.wave.every, aff: elite.affixes.length, max: progress.maxLevel() };
        b.stopBattle();
        return r;""")
    hs = N['bossHaste']
    ctx.check(st['diff'] == 'nightmare' and hs > 1 and abs(st['gaze'] - st['orig'] / hs) < 0.011 and abs(st['wave'] - st['origWave'] / hs) < 0.011
              and st['warn'] == 1.0, f'나이트메어 보스: 기술 간격 ÷{hs} (경고 시간 그대로)', str(st))
    ctx.check(st['orig'] == 9 and st['aff'] == 3 and st['max'] == 10, '원래 보스 정의는 그대로, 엘리트 속성 3개, 강화 한도 Lv10', str(st))

    # 저장 → 다시 열기: 고른 난이도·난이도별 기록 유지
    g.js("window.madOverlordGameV2.switchScreen('menu'); progress.save();")
    g.reload_v2()
    st = g.js("""return { diff: progress.difficulty, hard: progress.stage('1-1', 'hard').cleared, hell: progress.stage('4-B', 'hell').cleared,
        max: progress.maxLevel(), on: document.querySelector('#menu-diffs-v2 .is-on')?.dataset.diff };""")
    ctx.check(st == {'diff': 'nightmare', 'hard': True, 'hell': True, 'max': 10, 'on': 'nightmare'},
              '저장: 난이도·난이도별 기록·강화 한도가 다시 열어도 유지', str(st))
    ctx.check(not g.errors, '페이지 오류 없음', '; '.join(g.errors[:3]))
