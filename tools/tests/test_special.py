"""스페셜맵 (D-119 9번 · D-123): 보스 러시 · 파괴 작전, 모드마다 하루 3회 (Q-044 임시).
- 노말 1-B를 깨면 열림, 들어가면 1회, 한국 시간 0시에 다시 채움, 시계를 되돌려도 다시 안 채움
- 보스 러시: 단계 1~30, 10단계 하드 · 20단계 헬, 문을 부수면 보스, 보스 처치 = 승리 → 승급석·코어·DM, 보통 판 기록에는 안 남음
- 파괴 작전: 진격 거리에 맞춰 물체, 부수면 점수 + 연속 보너스, 모두 부수면 남은 시간 보너스 → 등급·조각·주간 최고
- 작전 지원 '스페셜' 탭, 결과 화면 '한 번 더', 저장 백업 검사"""

PACK = """const backup = await import('/js/engine_v2/saveStore_v2.js');
const pack = value => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
const save = JSON.parse(entries.mo_v2_save);"""
SP = "const SP = await import('/js/engine_v2/special_v2.js');"
CLEAR_1 = """const S = await import('/js/engine_v2/stages_v2.js'); for (const s of S.STAGES) { progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 }; if (s.id === '1-B') break; }"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("const r = progress.startSpecial('boss'); return { ok: r.success, reason: r.reason, unlocked: progress.specialUnlocked() };")
    ctx.check(not st['ok'] and not st['unlocked'] and '1-B' in (st['reason'] or ''), '노말 1-B 전에는 잠김', str(st))

    # ===== 하루 횟수 =====
    st = g.js(CLEAR_1 + """const day = Date.parse('2026-11-10T03:00:00Z');   // 한국 11-10 12시
        const left0 = progress.specialLeft('boss', day);
        const r = [1, 2, 3, 4].map(() => progress.startSpecial('boss', day).success);
        const smash = progress.specialLeft('smash', day);
        const next = progress.specialLeft('boss', day + 13 * 3600 * 1000);          // 한국 11-11 01시
        progress.startSpecial('boss', day + 13 * 3600 * 1000);
        const back = progress.specialLeft('boss', day);                              // 시계를 11-10으로 되돌림
        return { left0, r, smash, next, back };""")
    ctx.check(st['left0'] == 3 and st['r'] == [True, True, True, False] and st['smash'] == 3,
              '보스 러시 하루 3회 (4번째는 막힘), 파괴 작전 횟수는 따로 3회', str(st))
    ctx.check(st['next'] == 3 and st['back'] == 2, '한국 시간 0시에 다시 3회 · 시계를 되돌려도 다시 안 채움', str(st))

    # ===== 단계 세기 =====
    st = g.js(SP + """const D = await import('/js/engine_v2/difficulty_v2.js'); const S = await import('/js/engine_v2/stages_v2.js');
        const C = await import('/js/engine_v2/contentSchedule_v2.js'); C.setReleaseGroups(null);   // 이 확인만 숨김 그룹을 켬 (검사 화면은 열어 둠)
        const s1 = SP.bossStage(1), s9 = SP.bossStage(9), s10 = SP.bossStage(10), s20 = SP.bossStage(20), s30 = SP.bossStage(30);
        const z = SP.bossZones();
        const base9 = D.stageFor(S.stageById(z[8 % z.length] + '-B'), 'normal');
        return { d: [s1.difficulty, s9.difficulty, s10.difficulty, s20.difficulty, s30.difficulty], zones: z, z1: s1.specialZone, z2: SP.bossStage(2).specialZone,
            hp9: s9.enemy.hp, want9: Math.round(base9.enemy.hp * 1.64 * 100) / 100, gate: s1.base.final, boss: s1.boss.afterBase, time: s1.timeLimit,
            rw: [SP.bossReward(1).stones, SP.bossReward(10).stones, SP.bossReward(20).stones], _: C.setReleaseGroups([]) };""")
    ctx.check(st['d'] == ['normal', 'normal', 'hard', 'hell', 'nightmare'] and abs(st['hp9'] - st['want9']) < 0.02,
              '보스 러시: 1~9 노말(단계마다 +8%), 10단계 하드 · 20단계 헬 · 30단계 나이트메어', str(st))
    ctx.check(st['z1'] == 1 and st['z2'] == 2 and 7 not in st['zones'] and st['gate'] == 100 and st['boss'] and st['time'] == 90 and st['rw'] == [2, 3, 4],
              '단계마다 공개된 구역 보스를 돌아가며(숨김 구역 빠짐) · 약한 문 → 보스 · 90초 · 승급석 2/3/4', str(st))

    # ===== 보스 러시 실제 전투 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js(CLEAR_1 + " progress.difficulty = 'normal'; const r = progress.startSpecial('boss'); window.madOverlordGameV2.startSpecial(r.stage);")
    g.wait(2500)
    st = g.js("return { sp: b.stage.special, step: b.stage.specialStep, gate: b.finalBaseSpawned, timeLimit: b.stage.timeLimit };")
    for _ in range(20):
        if g.js("return b.finalBaseSpawned;"):
            break
        g.wait(500)
    ctx.check(st['sp'] == 'boss' and st['step'] == 1 and st['timeLimit'] == 90, '보스 러시 1단계 출격 (90초)', str(st))
    came = g.open_boss_gate(timeout=12000)
    ctx.check(came, '문을 부수면 보스 등장')
    stones0 = g.js("return progress.stones || 0;")
    g.js("b.playerHp = b.maxPlayerHp; const boss = b.boss; boss.hp = 1; b.dealDamageToEnemy(boss, 999999, true, { knock: 0 });")
    g.wait(5000)
    st = g.js("""const el = document.querySelector('.v2-result');
        return { title: el?.querySelector('.v2-result__title')?.textContent || '', line: el?.querySelector('.v2-result__special')?.textContent || '',
            again: el?.querySelector('[data-act=retry]')?.textContent || '', best: progress.special.bossBest, stones: progress.stones || 0,
            recorded: Object.keys(progress.stages).some(k => k.startsWith('SP-')), starsHidden: getComputedStyle(el.querySelector('.v2-result__stars')).display === 'none',
            hud: document.getElementById('hud-stage-v2').textContent };""")
    ctx.check(st['title'] == 'BOSS DOWN' and '1단계' in st['line'] and st['best'] == 1 and st['stones'] - stones0 == 2,
              "보스 처치 → 'BOSS DOWN' · 1단계 돌파 · 승급석 +2 · 최고 단계 기록", str(st))
    ctx.check(not st['recorded'] and st['starsHidden'] and '한 번 더' in st['again'] and '2회 남음' in st['again'] and st['hud'].startswith('SPECIAL'),
              "보통 판 기록·별에는 안 남음(별 칸 안 보임) · '한 번 더 (오늘 2회 남음)' · 전투 위 표시 SPECIAL", str(st))
    g.shot('special_boss_result', '#screen-battle-v2')

    # ===== 파괴 작전 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js(CLEAR_1 + " const r = progress.startSpecial('smash'); window.madOverlordGameV2.startSpecial(r.stage);")
    g.wait(2500)
    st = g.js("return { sp: b.stage.special, items: b.smashQueue.length, bases: !!b.stage.base.final, limit: b.stage.timeLimit };")
    ctx.check(st['sp'] == 'smash' and st['items'] >= 7 and not st['bases'] and st['limit'] == 60, '파괴 작전 출격: 물체 7개 이상 · 거점 없음 · 60초', str(st))
    shards0 = g.js("return progress.shards || 0;")
    st = g.js("""b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding && !e.isBarricade).forEach(e => { e.dom && e.dom.remove(); }); b.enemies = b.enemies.filter(e => e.isBuilding || e.isBarricade);
        b.distanceTraveled = 9999; b.tickSmash();
        const objs = b.enemies.filter(e => e.smashScore); const scores = objs.map(e => e.smashScore);
        objs.forEach(e => b.dealDamageToEnemy(e, e.hp + 10, false, { knock: 0 }));
        return { n: objs.length, sum: scores.reduce((a, c) => a + c, 0), score: b.smashScore, broken: b.smashBroken };""")
    ctx.check(st['n'] >= 7 and st['broken'] == st['n'] and st['score'] > st['sum'], '물체를 이어 부수면 연속 보너스로 기본 점수 합보다 큼', str(st))
    g.js("b.tickSmash();")
    g.wait(4000)
    st = g.js("""const el = document.querySelector('.v2-result');
        return { title: el?.querySelector('.v2-result__title')?.textContent || '', line: el?.querySelector('.v2-result__special')?.textContent || '',
            best: progress.special.smashBest.score, shards: progress.shards || 0 };""")
    ctx.check(st['title'].startswith('GRADE') and '점수' in st['line'] and '이번 주 최고' in st['line'] and st['best'] > 0 and st['shards'] > shards0,
              '모두 부수면 남은 시간 보너스 → 결과 등급 · 조각 · 이번 주 최고 기록', str(st))
    g.shot('special_smash_result', '#screen-battle-v2')

    # ===== 작전 지원 '스페셜' 탭 =====
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    g.js("const gu = await import('/js/ui_v2/growthUi_v2.js'); gu.openGrowthPanel('special');")
    g.wait(400)
    st = g.js("""const p = document.querySelector('.v2-growth'); const tab = [...p.querySelectorAll('[data-act=tab]')].find(b => b.dataset.tab === 'special'); tab && tab.click();
        const cards = [...p.querySelectorAll('.v2-special__card')];
        return { n: cards.length, text: cards.map(c => c.textContent.replace(/\\s+/g, ' ').slice(0, 60)), dots: cards.map(c => c.querySelectorAll('.v2-special__left i.is-on').length) };""")
    ctx.check(st['n'] == 3 and st['dots'][:2] == [3, 2] and '보스 러시' in st['text'][0] and '다음 1단계' in st['text'][0] and '오버로드의 탑' in st['text'][2],
              "작전 지원 '스페셜' 탭: 보스 러시(다음 1단계 · 남은 3회) · 파괴 작전(남은 2회) · 오버로드의 탑(D-126, 횟수 없음)", str(st))
    g.shot('special_tab', '.v2-growth')
    g.page.click('.v2-special__card[data-mode="boss"] [data-act=startSpecial]')
    g.wait(2500)
    st = g.js("return { sp: b.stage.special, step: b.stage.specialStep, left: progress.specialLeft('boss') };")
    ctx.check(st['sp'] == 'boss' and st['step'] == 1 and st['left'] == 2, '탭에서 도전 → 보스 러시 1단계 출격 · 남은 횟수 2', str(st))

    # 저장 백업: 스페셜 기록이 들어 있음 · 모양이 틀리면 거절
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    st = g.js(PACK + """const kept = save.special; save.special = { dayKey: 3, used: { boss: -1, smash: 0 }, bossBest: 0, smashBest: {} };
        const bad = backup.importSave(pack({ entries: { ...entries, mo_v2_save: JSON.stringify(save) } }));
        return { kept: !!kept && kept.used.boss === 1 && kept.used.smash === 1 && kept.smashBest.score > 0, bad: bad.success, msg: bad.reason || '' };""")
    ctx.check(st['kept'] and not st['bad'] and '스페셜' in st['msg'], '저장 백업: 스페셜 기록이 들어 있음 · 모양이 틀리면 거절', str(st))
