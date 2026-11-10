"""오버로드의 탑 (D-119 12번 1인 컨텐츠 안 A · D-126, Q-047 임시): 끝없는 층, 횟수 제한 없음, 층은 한 번 깨면 끝.
- 층 배율 1.06^(층−1), 50층부터 1.03씩 · 5층마다 전장 변이가 하나씩 쌓임(30층부터 6개) · 10층마다 보스 층
- 구성은 공개된 구역을 돌아가며(숨김 구역 빠짐), 수치는 기준 판(1-5 · 1-B) × 층 배율
- 처음 깨면 DM · 5층마다 코어 · 10층마다 조각 + 승급석, 주간 최고 층 (한국 시간 월요일에 새 주)
- 여러 변이를 한 번에 받는 전투(battle/growth.js combineMutators), 작전 지원 › 스페셜 세 번째 카드, 결과 '다음 층'"""

CLEAR_1 = """const S = await import('/js/engine_v2/stages_v2.js'); for (const s of S.STAGES) { progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 }; if (s.id === '1-B') break; }"""
TW = "const TW = await import('/js/engine_v2/tower_v2.js');"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("const r = progress.startTower(); return { ok: r.success, reason: r.reason };")
    ctx.check(not st['ok'] and '1-B' in (st['reason'] or ''), '노말 1-B 전에는 잠김', str(st))

    # ===== 층 규칙 =====
    st = g.js(TW + """const C = await import('/js/engine_v2/contentSchedule_v2.js'); const S = await import('/js/engine_v2/stages_v2.js');
        C.setReleaseGroups(null);   // 이 확인만 숨김 그룹을 켬
        const muls = [1, 2, 11, 50, 51, 60].map(f => Math.round(TW.towerMul(f) * 10000) / 10000);
        const day = Date.parse('2026-11-10T03:00:00Z');
        const mc = [4, 5, 9, 10, 29, 30, 45].map(f => TW.towerMutators(f, day).length);
        const s5 = TW.towerStage(5, day), s10 = TW.towerStage(10, day), s7 = TW.towerStage(7, day), s11 = TW.towerStage(11, day);
        const ref = S.stageById('1-5'), refB = S.stageById('1-B');
        const zones = TW.towerZones(day);
        const out = { muls, m: mc, z: [TW.towerStage(1, day).specialZone, TW.towerStage(2, day).specialZone, s7.specialZone], zones,
            hp11: s11.enemy.hp, want11: Math.round(ref.enemy.hp * Math.pow(1.06, 10) * 100) / 100,
            base10: s10.base.final, wantB: Math.round(refB.base.final * Math.pow(1.06, 9) / 100) * 100,
            boss10: !!s10.boss, boss5: !!(s5.boss && s5.boss.unit), id10: s10.id, sp: s10.special, mut5: s5.mutators, first: s5.mutator,
            comp7: s7.stageLabel || null, rw: [TW.towerReward(4), TW.towerReward(5), TW.towerReward(10)], _: C.setReleaseGroups([]) };
        return out;""")
    ctx.check(st['muls'][0] == 1 and abs(st['muls'][1] - 1.06) < 1e-4 and abs(st['muls'][3] - 1.06 ** 49) < 1e-3 and abs(st['muls'][4] / st['muls'][3] - 1.03) < 1e-3,
              '층 배율 1.06^(층−1), 50층부터 한 층에 ×1.03', str(st['muls']))
    ctx.check(st['m'] == [0, 1, 1, 2, 5, 6, 6] and len(st['mut5']) == 1 and st['first'] == st['mut5'][0],
              '5층마다 전장 변이가 하나씩 쌓임 (5층 1개 · 10층 2개 · 30층부터 6개 모두)', str(st))
    ctx.check(st['z'][:2] == [1, 2] and 7 not in st['zones'] and abs(st['hp11'] - st['want11']) < 0.02 and st['boss10'] and st['base10'] == st['wantB'] and st['sp'] == 'tower',
              '구역을 돌아가며 구성(숨김 구역 빠짐) · 수치는 기준 판 × 층 배율 · 10층은 보스 층', str(st))
    ctx.check(st['rw'][0]['cores'] == 0 and st['rw'][1]['cores'] == 2 and st['rw'][2]['stones'] == 2 and st['rw'][2]['shards'] == 8 and st['rw'][0]['dm'] == 800 + 480,
              '보상: DM 800 + 120×층 · 5층마다 코어 · 10층마다 조각 8 + 승급석', str(st['rw']))

    # ===== 여러 변이를 한 번에 =====
    st = g.js("""const G = await import('/js/engine_v2/growth_v2.js');
        const one = G.combineMutators(['overload']), two = G.combineMutators(['icefloor', 'reinforce', 'ironwall', 'bloodmoon']);
        return { one: [one.id, one.cdMul, one.name], move: two.moveMul, spawn: two.spawnMul, siege: two.siegeCut, blast: two.deathBlast, ids: two.ids, none: G.combineMutators([]) };""")
    ctx.check(st['one'] == ['overload', 1.2, '과부하'] and abs(st['move'] - 0.85) < 1e-9 and abs(st['spawn'] - 0.85) < 1e-9 and abs(st['siege'] - 0.2) < 1e-9 and st['blast'] == 0.02 and st['none'] is None,
              '변이 묶기: 하나면 예전과 같고, 여럿이면 효과가 함께 붙음', str(st))

    # ===== 실제 전투: 5층(변이 하나) 이기면 다음 층 =====
    g.js(CLEAR_1 + " progress.special.tower.best = 4; const r = progress.startTower(); window.madOverlordGameV2.startSpecial(r.stage);")
    g.wait(2500)
    st = g.js("return { sp: b.stage.special, floor: b.stage.specialStep, mut: b.mutator && b.mutator.ids, hud: document.getElementById('hud-stage-v2').textContent };")
    ctx.check(st['sp'] == 'tower' and st['floor'] == 5 and st['mut'] and len(st['mut']) == 1 and st['hud'].startswith('SPECIAL'),
              '탑 5층 출격 — 변이 하나가 전투에 붙음 · 전투 위 SPECIAL', str(st))
    dm0 = g.js("return gameState.darkMatter;")
    cores0 = g.js("return progress.cores || 0;")
    g.js("b.finishBattle(true);")
    g.wait(2500)
    st = g.js("""const el = document.querySelector('.v2-result');
        return { title: el?.querySelector('.v2-result__title')?.textContent || '', line: el?.querySelector('.v2-result__special')?.textContent || '',
            again: el?.querySelector('[data-act=retry]')?.textContent || '', best: progress.special.tower.best, week: progress.special.tower.weekBest,
            recorded: Object.keys(progress.stages).some(k => k.startsWith('SP-')), dm: gameState.darkMatter, cores: progress.cores || 0 };""")
    ctx.check(st['title'] == 'FLOOR CLEAR' and '5층' in st['line'] and st['best'] == 5 and st['week'] == 5 and st['cores'] - cores0 == 2 and st['dm'] - dm0 >= 800 + 600,
              "이기면 'FLOOR CLEAR' · 최고 5층 · 주간 5층 · 코어 +2 · DM", str(st))
    ctx.check('6층' in st['again'] and not st['recorded'], "결과 '다음 층 (6층)' · 보통 판 기록에는 안 남음", str(st))
    g.shot('tower_result', '#screen-battle-v2')
    g.page.click('.v2-result [data-act=retry]')
    g.wait(2500)
    st = g.js("return { floor: b.stage.specialStep, sp: b.stage.special };")
    ctx.check(st['sp'] == 'tower' and st['floor'] == 6, "'다음 층'으로 바로 6층 출격 (횟수 제한 없음)", str(st))
    g.js("b.finishBattle(false);")
    g.wait(2500)
    st = g.js("""const el = document.querySelector('.v2-result');
        return { title: el?.querySelector('.v2-result__title')?.textContent || '', again: el?.querySelector('[data-act=retry]')?.textContent || '', best: progress.special.tower.best };""")
    ctx.check(st['title'] == 'TOWER FAILED' and '다시' in st['again'] and st['best'] == 5, "지면 'TOWER FAILED' · 층 그대로 · '다시 도전'", str(st))

    # ===== 주간 최고: 새 주에는 0부터 =====
    st = g.js("""const week1 = Date.parse('2026-11-10T03:00:00Z'), week2 = week1 + 7 * 24 * 3600 * 1000;
        progress.special.tower = { best: 12, week: null, weekBest: 0 };
        progress.finishTower(13, true, week1); const a = progress.towerWeekBest(week1);
        const b2 = progress.towerWeekBest(week2);
        progress.finishTower(14, true, week2); const c = progress.towerWeekBest(week2);
        const again = progress.finishTower(14, true, week2);
        return { a, b2, c, best: progress.special.tower.best, again: again.first };""")
    ctx.check(st['a'] == 13 and st['b2'] == 0 and st['c'] == 14 and st['best'] == 14 and st['again'] is False,
              '주간 최고 층: 새 주에는 0부터 · 이미 깬 층은 보상 없음', str(st))

    # ===== 작전 지원 › 스페셜 세 번째 카드 =====
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    g.js("const gu = await import('/js/ui_v2/growthUi_v2.js'); gu.openGrowthPanel('special');")
    g.wait(400)
    st = g.js("""const card = document.querySelector('.v2-special__card[data-mode="tower"]');
        return { has: !!card, text: card ? card.textContent.replace(/\\s+/g, ' ') : '', btn: card?.querySelector('[data-act=startTower]')?.textContent || '',
            muts: card ? card.querySelectorAll('.v2-tower__mut').length : -1 };""")
    ctx.check(st['has'] and '오버로드의 탑' in st['text'] and '15층' in st['btn'] and '최고 14층' in st['text'] and st['muts'] == 3,
              "스페셜 탭 세 번째 카드 '오버로드의 탑': 다음 15층 · 쌓인 변이 3개 · 최고 14층", str(st))
    g.shot('tower_card', '.v2-growth')
    g.page.click('.v2-special__card[data-mode="tower"] [data-act=startTower]')
    g.wait(2500)
    st = g.js("return { floor: b.stage.specialStep, sp: b.stage.special, muts: b.mutator && b.mutator.ids.length };")
    ctx.check(st['sp'] == 'tower' and st['floor'] == 15 and st['muts'] == 3, '카드에서 도전 → 15층 출격 (변이 3개)', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
