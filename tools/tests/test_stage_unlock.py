"""시험용 전체 스테이지 잠금 해제: 메뉴 왼쪽 위 아이콘 5번 연속 → 모든 스테이지·구역 열림(이번 실행만),
원래 잠긴 판은 기록 안 됨, 다시 켜면 이전 진행 그대로.
5번 더 → 캐릭터·파츠 전부 해제, 그 뒤 진행은 메모리에만 저장(11-03)"""


def taps(g, n, gap=100):
    for _ in range(n):
        g.page.click('#screen-menu-v2 .v2-brand__emblem', force=True)
        g.wait(gap)


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    taps(g, 4)
    ctx.check(g.js("const S = await import('/js/engine_v2/stages_v2.js'); return !S.allStagesUnlocked() && !S.isUnlocked('2-1', progress);"),
              '4번은 아무 일 없음')
    g.wait(1500)   # 앞의 4번과 이어지지 않게
    taps(g, 5, gap=1200)
    ctx.check(g.js("const S = await import('/js/engine_v2/stages_v2.js'); return !S.allStagesUnlocked();"),
              '천천히(1초 넘게) 누르면 해제 안 됨')
    g.wait(1500)
    taps(g, 5)
    st = g.js("""const S = await import('/js/engine_v2/stages_v2.js');
        return { on: S.allStagesUnlocked(), last: S.isUnlocked('10-B', progress), mid: S.isUnlocked('5-3', progress),
            locked: window.madOverlordGameV2.menuController.stageMap.pages.filter(p => !p.open).length,
            glow: document.querySelector('#screen-menu-v2 .v2-brand__emblem').classList.contains('is-dev-unlocked'),
            foot: document.getElementById('menu-map-foot-v2').textContent };""")
    ctx.check(st['on'] and st['last'] and st['mid'] and st['locked'] == 0 and st['glow'] and '시험 모드' in st['foot'],
              '5번 연속: 모든 스테이지·지도 구역 열림 + 아이콘 빛 + 안내 문구', str(st))
    g.map_zone('ch10')   # 지도를 마지막 구역으로 넘김
    g.wait(300)
    st = g.js("""return { sel: progress.selectedStage, sortie: !document.getElementById('btn-to-battle-v2').disabled };""")
    ctx.check(st['sel'].startswith('10-') and st['sortie'], '마지막 구역을 골라 출격 단추가 켜짐', str(st))
    st = g.js("""const before = gameState.darkMatter;
        const r = progress.recordStage('5-3', { stars: [true, true, true], cleared: true, time: 50 }, 'normal');
        const ok = progress.recordStage('1-1', { stars: [true, false, false], cleared: true, time: 120 }, 'normal');
        progress.save();
        return { skipped: !!r.skipped, notSaved: !progress.stage('5-3', 'normal').cleared, dm: gameState.darkMatter - before,
            normal: progress.stage('1-1', 'normal').cleared && !ok.skipped };""")
    ctx.check(st['skipped'] and st['notSaved'] and st['normal'],
              '원래 잠긴 판(5-3)은 기록 안 됨 · 원래 열린 판(1-1)은 그대로 기록', str(st))
    # 5번 더: 캐릭터 전부·파츠 전부 해제, 그때부터 저장은 메모리에만 (백업 내보내기도 막힘)
    g.wait(1500)
    taps(g, 5)
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js'); const { ROSTER } = await import('/js/engine_v2/roster_v2.js');
        const store = await import('/js/engine_v2/saveStore_v2.js');
        const all = Object.values(PARTS_DB).flat().filter(p => p.id !== 'none');
        let blocked = false; try { store.exportSave(); } catch (e) { blocked = e.message.includes('시험'); }
        return { chars: ROSTER.every(c => progress.isCharacterUnlocked(c.id)), parts: all.every(p => progress.isOwned(p.id)), n: all.length,
                 iso: store.saveIsolated(), blocked, glow: document.querySelector('#screen-menu-v2 .v2-brand__emblem').classList.contains('is-dev-all'),
                 foot: document.getElementById('menu-map-foot-v2').textContent };""")
    ctx.check(st['chars'] and st['parts'] and st['n'] >= 430 and st['iso'] and st['blocked'] and st['glow'] and '파츠' in st['foot'],
              '5번 더: 캐릭터 10명·파츠 전부 해제 + 저장은 메모리에만(백업 내보내기 막힘) + 아이콘 금색', str({k: v for k, v in st.items() if k != 'foot'}))
    g.js("gameState.darkMatter += 77777; progress.save();")
    g.reload_v2()
    st = g.js("""const S = await import('/js/engine_v2/stages_v2.js');
        return { on: S.allStagesUnlocked(), s12: S.isUnlocked('1-2', progress), s13: S.isUnlocked('1-3', progress), s53: S.isUnlocked('5-3', progress),
            locked: window.madOverlordGameV2.menuController.stageMap.pages.filter(p => !p.open).length };""")
    ctx.check(not st['on'] and st['s12'] and not st['s13'] and not st['s53'] and st['locked'] == 9,
              '다시 켜면 원래대로: 1-1 다음(1-2)까지만 열림, 구역 2~10 잠김', str(st))
    st = g.js("""const { ROSTER } = await import('/js/engine_v2/roster_v2.js');
        return { locked: ROSTER.filter(c => !progress.isCharacterUnlocked(c.id)).length, owned: progress.owned.size, dm: gameState.darkMatter };""")
    ctx.check(st['locked'] > 0 and st['owned'] < 200 and st['dm'] < 77777, '다시 켜면 캐릭터·파츠 해제와 그 뒤 진행(DM)은 남지 않음', str(st))
    g.close()
