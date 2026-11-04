"""파견 화면 (D-070, js/ui_v2/dispatchUi_v2.js): 파견 중 장면(배경 흐름·캐릭터 걷기·적과 맞붙음) · 남은 시간·단계·보상·기록 · 새 파견 · 귀환 장면"""

ALL = "(await import('/js/engine_v2/stages_v2.js')).STAGES.filter(s => s.zone !== 6).map(s => s.id)"   # 구역 6만 빼고 모든 스테이지 id (구역 6 잠김 확인용)
CLEAR = "{ stars: [true,true,true], cleared: true, bestTime: 60 }"
DSP = "const D = await import('/js/ui_v2/dispatchUi_v2.js');"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    # 해금만 된 캐릭터/일부 부위만 가진 캐릭터는 목록과 실행에서 모두 제외한다.
    st = g.js("""const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
        const locked = progress.startDispatch('architect', 1).success;
        progress.stages['1-B'] = { cleared: true, stars: [true,true,true], bestTime: 60 };
        progress.unlockedChars.push('architect');
        const empty = progress.startDispatch('architect', 1).success;
        const ids = SLOTS.map(s => partsOfCharacter('architect', s)[0].id);
        ids.slice(0, 3).forEach(id => progress.owned.add(id));
        const partial = progress.startDispatch('architect', 1).success;
        progress.owned.add(ids[3]);
        const ready = !progress.dispatchReason('architect');
        const sent = progress.startDispatch('architect', 1).success;
        const duplicate = progress.startDispatch('architect', 1).success;
        progress.dispatch = [];
        ids.forEach(id => progress.owned.delete(id));
        return { locked, empty, partial, ready, sent, duplicate };""")
    ctx.check(not st['locked'] and not st['empty'] and not st['partial'] and st['ready'] and st['sent'] and not st['duplicate'],
              '파견 보유 검사: 잠금·파츠 없음·3부위 거부, 4부위 보유 시 가능, 중복 파견 거부', str(st))
    # 협력으로 골라 둔 캐릭터를 파견 보내면 협력 선택이 비고, 파견 중에는 다시 고를 수 없음 (11-03, 홍도도 QA6)
    st = g.js("""const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
        progress.unlockedChars.push('kaiju');
        SLOTS.forEach(s => progress.owned.add(partsOfCharacter('kaiju', s)[0].id));
        const picked = progress.selectSupport('kaiju');
        const r = progress.startDispatch('kaiju', 1);
        const res = { picked, sent: r.success, cleared: r.supportCleared, support: progress.supportCharacter,
                      again: progress.selectSupport('kaiju'), reason: progress.supportReason('kaiju') };
        progress.dispatch = [];
        return res;""")
    ctx.check(st['picked'] and st['sent'] and st['cleared'] and st['support'] is None and not st['again'] and st['reason'] == '파견 중',
              '협력으로 고른 캐릭터를 파견 → 협력 선택 비움, 파견 중엔 다시 못 고름', str(st))
    # 모든 구역을 깨고 하드·헬도 열어 칸 3개, 캐릭터 모두 열기
    g.js(f"""{ALL}.forEach(id => progress.stages[id] = {CLEAR});
        for (const d of ['hard', 'hell']) ({ALL}).forEach(id => progress.recordsOf(d)[id] = {CLEAR});
        progress.unlockedChars = ['kaiju', 'hero', 'chimera', 'diver', 'saint', 'frost', 'doll'];
        const {{ SLOTS, partsOfCharacter }} = await import('/js/engine_v2/roster_v2.js');
        progress.unlockedChars.forEach(c => SLOTS.forEach(s => progress.owned.add(partsOfCharacter(c, s)[0].id)));
        progress.unlockedChars.push('architect');   // 해금했어도 파츠가 없는 설계자는 후보에 나오지 않음
        progress.selectCharacter('mech');
        const now = Date.now();
        progress.startDispatch('frost', 2, now - 60 * 60 * 1000);      // 1시간 지남
        progress.startDispatch('kaiju', 4, now - 10 * 1000);           // 막 출발
        progress.save();""")

    # 기록: 같은 파견이면 같은 기록, 출발 → … → 귀환 완료 순서
    st = g.js(DSP + """const d = progress.dispatch[0];
        const a = D.dispatchLog(d), b2 = D.dispatchLog(d), other = D.dispatchLog({ ...d, start: d.start + 1 });
        return { n: a.length, same: JSON.stringify(a) === JSON.stringify(b2), diff: JSON.stringify(a) !== JSON.stringify(other),
            sorted: a.every((e, i) => i === 0 || e.at >= a[i - 1].at), first: a[0].text, last: a[a.length - 1].kind,
            zones: Object.keys(D.DISPATCH_ZONES).length };""")
    ctx.check(st['n'] == 10 and st['same'] and st['diff'] and st['sorted'] and st['last'] == 'done' and st['zones'] == 10,
              '파견 기록: 출발·진입·6개·귀환 10줄, 같은 파견은 늘 같은 기록, 구역 10개 설정 (1~10)', str(st))

    g.page.click('#btn-menu-support-v2')
    g.wait(300)
    g.page.click('.v2-growth__tabs [data-tab="dispatch"]')
    g.wait(2500)
    st = g.js("""const sc = [...document.querySelectorAll('.v2-dsp:not(.v2-dsp--empty)')];
        const s = sc[0];
        return { scenes: sc.length, empty: document.querySelectorAll('.v2-dsp--empty').length,
            time: s.querySelector('.v2-dsp__time strong').textContent, bar: parseFloat(s.querySelector('.v2-dsp__bar i').style.width),
            steps: s.querySelectorAll('.v2-dsp__steps li.is-on').length, log: s.querySelectorAll('.v2-dsp__log li').length,
            reward: s.querySelector('.v2-dsp__reward .is-dm b').textContent, rig: s.querySelector('canvas').width > 0,
            zones: document.querySelectorAll('.v2-dsp-zone').length, locked: document.querySelectorAll('.v2-dsp-zone.is-lock').length,
            chars: [...document.querySelectorAll('.v2-dsp-char')].map(b => b.dataset.char) };""")
    ctx.check(st['scenes'] == 2 and st['empty'] == 1, '파견 칸: 진행 중 장면 2개 + 빈 칸 1개 (헬까지 열림 = 3칸)', str(st))
    ctx.check(st['time'].startswith('1:') or st['time'].startswith('2:'), '남은 시간 표시 (3시간 중 1시간 지남 → 약 2시간)', str(st))
    ctx.check(30 < st['bar'] < 37 and st['steps'] >= 2 and st['log'] >= 1 and st['reward'] == '3,000' and st['rig'],
              '진행 막대 1/3 · 단계 눈금 · 기록 · 예상 보상(구역 2 DM 3,000) · 캐릭터 그림', str(st))
    ctx.check(st['zones'] == 10 and st['locked'] == 1 and 'mech' not in st['chars'] and 'frost' not in st['chars'] and 'hero' in st['chars']
              and 'architect' not in st['chars'],
              '새 파견: 구역 10개(구역 6은 6-B 전이라 잠김), 출전 중·파견 중·파츠 미보유 캐릭터는 목록에 없음', str(st))

    # 배경이 흐르고 적이 다가와 맞붙음 (첫 적은 1.5~4.5초 뒤)
    st = g.js("""const s = document.querySelector('.v2-dsp');
        const x0 = parseFloat(s.querySelector('.v2-dsp__far').style.backgroundPositionX || '0');
        let fought = false, enemy = false, popped = false;
        for (let i = 0; i < 90 && !(fought && popped); i++) {
            await new Promise(r => setTimeout(r, 100));
            enemy ||= !!s.querySelector('.v2-dsp__enemy');
            fought ||= s.querySelector('.v2-dsp__scene').classList.contains('is-fight');
            popped ||= !!s.querySelector('.v2-dsp__pop, .v2-dsp__enemy.is-fall');
        }
        const x1 = parseFloat(s.querySelector('.v2-dsp__far').style.backgroundPositionX || '0');
        return { moved: x0 !== x1, enemy, fought, popped };""")
    ctx.check(st['moved'] and st['enemy'] and st['fought'] and st['popped'], '장면: 파견 일러스트가 흐르고, 적이 다가와 맞붙은 뒤 쓰러짐', str(st))
    g.shot('dispatch_running', '.v2-growth__box')

    # 새 파견: 구역·캐릭터 고르고 보내기
    g.page.set_viewport_size({'width': 900, 'height': 520})
    g.page.locator('.v2-dsp-zone[data-zone="3"]').scroll_into_view_if_needed()
    before = g.js("return document.querySelector('.v2-growth__body').scrollTop;")
    g.page.click('.v2-dsp-zone[data-zone="3"]')
    g.wait(150)
    after = g.js("return document.querySelector('.v2-growth__body').scrollTop;")
    ctx.check(before > 0 and abs(before - after) <= 1, '구역 선택 후 작전 지원 스크롤 위치 유지', str([before, after]))
    g.page.locator('.v2-dsp-char[data-char="saint"]').scroll_into_view_if_needed()
    before = g.js("return document.querySelector('.v2-growth__body').scrollTop;")
    g.page.click('.v2-dsp-char[data-char="saint"]')
    g.wait(150)
    after = g.js("return document.querySelector('.v2-growth__body').scrollTop;")
    ctx.check(before > 0 and abs(before - after) <= 1, '캐릭터 선택 후 작전 지원 스크롤 위치 유지', str([before, after]))
    g.page.set_viewport_size({'width': 1300, 'height': 740})
    g.page.click('.v2-dsp-go button[data-act="dispatch"]')
    g.wait(800)
    st = g.js("""return { n: progress.dispatch.length, last: progress.dispatch[2] && [progress.dispatch[2].character, progress.dispatch[2].zone],
        scenes: document.querySelectorAll('.v2-dsp:not(.v2-dsp--empty)').length, empty: document.querySelectorAll('.v2-dsp--empty').length,
        go: document.querySelector('.v2-dsp-go button').disabled };""")
    ctx.check(st['n'] == 3 and st['last'] == ['saint', 3] and st['scenes'] == 3 and st['empty'] == 0 and st['go'],
              '새 파견: 구역 3 · 봉합 성녀 보내기 → 장면 3개, 칸이 차서 버튼 꺼짐', str(st))

    # 끝난 파견: 받기 버튼 → 귀환 장면
    g.js("progress.dispatch[0].end = Date.now() - 1000;")
    g.wait(1600)
    st = g.js("""const s = document.querySelector('.v2-dsp[data-char="frost"]');
        return { done: s.classList.contains('is-done'), btn: !!s.querySelector('button[data-act="collect"]') };""")
    ctx.check(st['done'] and st['btn'], '끝난 파견: "귀환 완료" + 보상 받기 버튼', str(st))
    g.shot('dispatch_done', '.v2-growth__box')
    dm0 = g.js("return gameState.darkMatter;")
    g.page.click('.v2-dsp[data-char="frost"] button[data-act="collect"]')
    g.wait(1600)
    st = g.js("""const back = document.querySelector('.v2-dsp-back');
        return { back: !!back, rows: back ? back.querySelectorAll('li').length : 0, dm: gameState.darkMatter, left: progress.dispatch.length,
            rig: back ? back.querySelector('canvas').width > 0 : false, scenes: document.querySelectorAll('.v2-dsp:not(.v2-dsp--empty)').length };""")
    ctx.check(st['back'] and st['rows'] >= 3 and st['dm'] - dm0 == 3000 and st['left'] == 2 and st['rig'] and st['scenes'] == 2,
              '귀환 장면: 보상 줄(DM·조각·코어 + 파츠) · 승리 동작, DM 3,000 받음, 칸 하나 비움', str(st))
    g.shot('dispatch_return', '.v2-growth__box')
    g.page.click('.v2-dsp-back button[data-act="dspClose"]')
    g.wait(300)
    ctx.check(not g.js("return !!document.querySelector('.v2-dsp-back');"), '귀환 장면 닫기', '')

    # 탭을 바꾸거나 창을 닫으면 장면 리그가 멈춤
    g.page.click('.v2-growth__tabs [data-tab="modules"]')
    g.wait(200)
    g.page.click('.v2-growth__tabs [data-tab="dispatch"]')
    g.wait(400)
    g.page.keyboard.press('Escape')
    g.wait(300)
    ctx.check(not g.js("return !!document.querySelector('.v2-growth');"), '작전 지원 창 닫기 (파견 탭에서 Esc)', '')
