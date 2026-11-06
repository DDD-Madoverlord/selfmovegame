"""처음 하는 사람용 다듬기 (2026-10-24): 첫 출격 안내 말풍선(한 번만·조작을 막지 않음), 패배 원인 알려주기(runReport.js),
보스 등장 카드"""

REPORT = "const { runReport, runSegments } = await import('/js/engine_v2/battle/runReport.js');"


def run(ctx):
    # ---- 패배 원인 계산 (순수 함수) ----
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(REPORT + """
        const base = { time: 200, distance: 1000, maxDistance: 1000, overloads: 0, overloadSec: 4 };
        const walk = runReport({ ...base, distance: 620, marks: { midSeen: 40, midDown: 90 }, finalPct: null, bossPct: null });
        const mid = runReport({ ...base, marks: { midSeen: 40 }, finalPct: null, bossPct: null });
        const fin = runReport({ ...base, marks: { midSeen: 40, midDown: 70, finalSeen: 110 }, finalPct: 0.6, bossPct: null });
        const almost = runReport({ ...base, marks: { midSeen: 40, midDown: 70, finalSeen: 110 }, finalPct: 0.12, bossPct: null, overloads: 3 });
        const boss = runReport({ ...base, marks: { midSeen: 40, midDown: 70, finalSeen: 110, gateDown: 150 }, finalPct: null, bossPct: 0.4, bossName: '대주교' });
        const seg = runSegments({ time: 200, marks: { midSeen: 40, midDown: 70, finalSeen: 110, gateDown: 150 } });
        return { walk, mid, fin, almost, boss, seg: seg.map(s => [s.label, Math.round(s.sec)]) };""")
    ctx.check(st['walk']['cause']['key'] == 'walk' and '62%' in st['walk']['cause']['text'] and st['mid']['cause']['key'] == 'mid'
              and st['fin']['cause']['key'] == 'final' and '60%' in st['fin']['cause']['text'] and st['almost']['cause']['key'] == 'almost'
              and any('과부하 3번' in t and '12초' in t for t in st['almost']['tips']) and st['boss']['cause']['key'] == 'boss'
              and '대주교' in st['boss']['cause']['text'] and '40%' in st['boss']['cause']['text'],
              '패배 원인: 진격 부족 · 요새 · 최종 기지(남은 %) · 거의 다 · 보스(남은 %) + 과부하가 잦으면 몸통 강화', str({k: st[k]['cause'] for k in ('walk', 'mid', 'fin', 'almost', 'boss')}))
    ctx.check(st['seg'] == [['진격', 40], ['중간 요새', 30], ['진격', 40], ['최종 기지', 40], ['보스', 50]] and st['boss']['longest'] == 4,
              '구간: 진격 → 요새 → 진격 → 최종 기지 → 보스, 가장 오래 걸린 구간 표시', str(st['seg']))

    # ---- 첫 출격 안내 ----
    g.js("progress.selectStage('1-1');")
    g.battle('mech', wait_ms=4200)
    st = g.js("""const c = document.querySelector('#screen-battle-v2 .v2-coach');
        const r = c && c.getBoundingClientRect(), s = document.querySelector('#battle-hud-v2 .v2-skills').getBoundingClientRect();
        return { text: c && c.innerText, tip: progress.hasTip('battle_skills'), above: r && r.bottom <= s.top + 2,
                 pe: c && getComputedStyle(c).pointerEvents };""")
    ctx.check(st['text'] and '스킬' in st['text'] and st['tip'] and st['above'] and st['pe'] == 'none',
              '첫 출격: 인트로 뒤 스킬 단추 위에 안내 말풍선 (누를 수 없음 — 조작을 막지 않음)', str(st))
    g.shot('firstplay_coach', '#screen-battle-v2')
    g.place_enemies(3)
    st = g.js("""b.skillCd.arm = 0; const before = b.skillCd.arm;
        document.querySelector('#battle-hud-v2 .v2-skill[data-slot="arm"]').click();
        return { used: b.skillCd.arm > before };""")
    g.page.mouse.click(10, 10)
    ctx.check(st['used'], '말풍선이 떠 있어도 스킬 단추가 눌림', str(st))
    g.js("b.ultGauge = 1; b.updateHud();")
    g.wait(500)
    ctx.check(g.js("return [...document.querySelectorAll('.v2-coach')].some(c => c.innerText.includes('필살기')) && progress.hasTip('battle_ult');"),
              '필살기가 처음 준비되면 필살기 안내')
    g.js("b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.spawnInterval = 999; b.distanceTraveled = b.stage.midAt - 0.5;")
    g.wait(900)
    ctx.check(g.js("return [...document.querySelectorAll('.v2-coach')].some(c => c.innerText.includes('제한 시간')) && progress.hasTip('battle_base');"),
              '첫 요새가 나오면 별·승리 조건·제한 시간 안내 (시계 아래)')

    # ---- 패배 화면: 원인·구간 막대·할 일 ----
    g.js("b.stats.time = b.stage.timeLimit - 0.05;")
    g.wait(4500)
    st = g.js("""const w = document.querySelector('.v2-result.is-lose .v2-result__why');
        return { why: !!w, cause: w && w.querySelector('.v2-result__cause').innerText, bars: w ? w.querySelectorAll('.v2-why-bar i').length : 0,
                 longOne: w ? w.querySelectorAll('.v2-why-bar i.is-long').length : 0, tips: w ? w.querySelectorAll('.v2-result__tips li').length : 0 };""")
    st['coach'] = g.js("return document.querySelectorAll('#screen-battle-v2 .v2-coach').length;")
    ctx.check(st['why'] and '요새' in (st['cause'] or '') and st['bars'] == 2 and st['longOne'] == 1 and st['tips'] >= 1 and st['coach'] == 0,
              'TIME OVER 결과: 패배 원인(요새를 못 부숨) · 구간 막대(가장 긴 구간 강조) · 할 일', str(st))
    g.shot('firstplay_defeat', '.v2-result__panel')

    # ---- 두 번째 출격: 본 안내는 다시 안 뜸, 메인 화면에서 연구소 안내 (한 번) ----
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(1200)
    st = g.js("""const c = document.querySelector('#screen-menu-v2 .v2-coach'), l = document.getElementById('btn-to-lab-v2').getBoundingClientRect();
        const r = c && c.getBoundingClientRect();
        return { text: c && c.innerText, near: r && Math.abs((r.left + r.right) / 2 - (l.left + l.right) / 2) < 200 && r.bottom <= l.top + 2,
                 inside: r && r.right <= innerWidth && r.left >= 0 };""")
    ctx.check(st['text'] and '연구소' in st['text'] and st['near'] and st['inside'], '전투 뒤 메인 화면: 연구소 단추 위에 안내 (화면 안)', str(st))
    g.js("document.querySelectorAll('.v2-coach').forEach(c => c.remove()); window.madOverlordGameV2.switchScreen('lab');")
    g.wait(400)
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(1200)
    ctx.check(g.js("return !document.querySelector('#screen-menu-v2 .v2-coach');"), '연구소 안내는 한 번만')
    g.battle('mech', wait_ms=4200)
    ctx.check(g.js("return !document.querySelector('#screen-battle-v2 .v2-coach');"), '두 번째 출격엔 안내 없음 (저장된 tips)')
    ctx.check(g.js("return JSON.parse(localStorage.getItem('mo_v2_save')).tips.length;") >= 4, '본 안내가 저장됨')

    # ---- 보스 등장 카드 ----
    g.js("b.stopBattle(); progress.selectStage('1-B');")
    g.battle('mech', wait_ms=3000)
    g.js("b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.spawnInterval = 999;"
         "b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage.finalAt - 0.5;")
    g.wait(900)
    g.open_boss_gate()   # 11-05 피드백 17: 보스는 최종 거점을 부순 뒤 나옴 → 그때 카드
    g.wait(300)
    st = g.js("""const c = document.querySelector('.v2-bosscard'); return { text: c && c.innerText, boss: !!b.boss };""")
    ctx.check(st['text'] and 'WMD-알파' in st['text'] and 'BOSS' in st['text'] and '플라스마 레이저' in st['text'] and st['boss'],
              '보스 등장 카드: BOSS · 이름 · 주요 기술 (최종 거점을 부순 뒤 — 피드백 17)', str(st))
    g.shot('firstplay_boss', '#screen-battle-v2')

    # ---- 2026-11-03 튜토리얼 세부: 첫 과부하 · 첫 최종 기지 · 연구소 강화 단추 안내 (각각 한 번, tips에 저장) ----
    g.js("document.querySelectorAll('.v2-coach').forEach(c => c.remove()); b.playerHp = 0;")
    g.wait(600)
    ctx.check(g.js("return [...document.querySelectorAll('#screen-battle-v2 .v2-coach')].some(c => c.innerText.includes('긴급 수리')) && progress.hasTip('battle_overload');"),
              '첫 과부하: 긴급 수리 안내')
    # 이 판은 이미 최종 기지 지점(900m)을 지나 안내를 봤을 수 있음 → 본 기록을 지우고 기지를 새로 세워 확인
    g.js("document.querySelectorAll('.v2-coach').forEach(c => c.remove()); progress.tips.delete('battle_final');"
         " b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.finalBaseSpawned = false; b.spawnFinalBase();")
    g.wait(600)
    st = g.js("return { ok: [...document.querySelectorAll('#screen-battle-v2 .v2-coach')].some(c => c.innerText.includes('최종 기지')), tip: progress.hasTip('battle_final'),"
              " spawned: b.finalBaseSpawned, active: b.isActive, coaches: [...document.querySelectorAll('.v2-coach')].map(c => c.innerText) };")
    ctx.check(st['ok'] and st['tip'], '첫 최종 기지: 승리 조건 안내', str(st))
    g.js("b.stopBattle(); progress.skipTutorial(); gameState.darkMatter = 99999; document.querySelectorAll('.v2-coach').forEach(c => c.remove()); window.madOverlordGameV2.switchScreen('lab');")
    g.wait(1200)
    st = g.js("""const c = document.querySelector('#screen-lab-v2 .v2-coach');
        return { text: c && c.innerText, tip: progress.hasTip('lab_upgrade') };""")
    ctx.check(st['text'] and '강화' in st['text'] and st['tip'], '연구소: 장착 파츠를 강화할 수 있으면 강화 단추 안내', str(st))
    g.shot('firstplay_lab_upgrade', '#screen-lab-v2')
