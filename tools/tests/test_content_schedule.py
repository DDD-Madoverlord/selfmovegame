"""콘텐츠 분할 공개: 기본 동작 · 한국 시간 경계 · 구역/캐릭터 잠금 · 파견 · QA 우회"""

SCHEDULE = "const C = await import('/js/engine_v2/contentSchedule_v2.js');"
STAGES = "const S = await import('/js/engine_v2/stages_v2.js');"
CLEAR = "{ stars: [true,true,true], cleared: true, bestTime: 60 }"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    st = g.js(SCHEDULE + STAGES + f"""
        C.setReleaseSchedule({{}});
        const before = S.chapterUnlocked(S.CHAPTER2, progress);
        S.CHAPTER1.stages.forEach(s => progress.stages[s.id] = {CLEAR});
        return {{ before, after: S.chapterUnlocked(S.CHAPTER2, progress),
            stage: S.isUnlocked('2-1', progress), date: C.releaseDateOf('zones', 2),
            character: C.isCharacterReleased('frost') }};""")
    ctx.check(not st['before'] and st['after'] and st['stage'] and st['date'] is None and st['character'],
              '빈 설정: 기존처럼 1-B 클리어 후 구역 2 열림, 공개 제한 없음', str(st))

    st = g.js(SCHEDULE + """
        C.setReleaseSchedule({ zones: { 2: '2030-01-15' }, characters: { frost: '2030-01-15' } });
        const at = Date.parse('2030-01-14T15:00:00Z');
        return { before: C.isZoneReleased(2, at - 1), at: C.isZoneReleased(2, at),
            charBefore: C.isCharacterReleased('frost', at - 1), charAt: C.isCharacterReleased('frost', at),
            date: C.releaseDateOf('characters', 'frost') };""")
    ctx.check(not st['before'] and st['at'] and not st['charBefore'] and st['charAt'] and st['date'] == '1월 15일',
              '한국 시간 0시 직전은 잠김, 정확히 0시부터 공개', str(st))

    st = g.js(SCHEDULE + STAGES + f"""
        C.setReleaseSchedule({{ zones: {{ 2: '2999-12-31' }} }});
        S.CHAPTER2.stages.forEach(s => progress.stages[s.id] = {CLEAR});
        const menu = window.madOverlordGameV2.menuController;
        menu.renderStages();
        const before = progress.selectedStage;
        menu.stageMap.go(1);   // 지도를 구역 2로 넘기고 정거장을 누름 (잠긴 안내)
        const page = menu.stageMap.root.querySelectorAll('.v2-smap__page')[1];
        page.querySelector('.v2-smap__stop').click();
        menu.selectStage('2-1');
        const diffs = ['normal', 'hard', 'hell', 'nightmare'].map(d => {{
            progress.recordsOf(d)['1-B'] = {CLEAR};
            progress.difficulty = d;
            return S.isUnlocked('2-1', progress);
        }});
        progress.difficulty = 'normal';
        progress.unlockedChars = ['kaiju'];
        return {{ chapter: S.chapterUnlocked(S.CHAPTER2, progress), diffs,
            locked: !menu.stageMap.pages[1].open, fog: page.querySelector('.v2-smap__fog')?.textContent || '',
            foot: document.getElementById('menu-map-foot-v2').textContent,
            unchanged: before === progress.selectedStage, zones: progress.dispatchZones(),
            dispatch: progress.startDispatch('kaiju', 2).success }};""")
    ctx.check(not st['chapter'] and not any(st['diffs']) and st['unchanged'],
              '미래 구역: 이전 구역·기존 클리어 기록이 있어도 모든 난이도에서 선택 불가', str(st))
    ctx.check(st['locked'] and '12월 31일 공개 예정' in st['fog'] and st['foot'] == '해안 시추 단지: 끓어오르는 대지 — 12월 31일 공개 예정',
              '지도: 잠긴 구역 안개·안내 문구에 공개 날짜 (구역 번호 없음)', str(st))
    ctx.check(2 not in st['zones'] and not st['dispatch'], '미래 구역: 클리어 기록이 있어도 파견 불가', str(st))

    g.js("(await import('/js/ui_v2/growthUi_v2.js')).openGrowthPanel('dispatch');")
    st = g.js("""const z = document.querySelector('.v2-dsp-zone[data-zone="2"]');
        return { disabled: z.disabled, text: z.textContent };""")
    ctx.check(st['disabled'] and '곧 공개 · 12월 31일' in st['text'], '파견 구역 카드: 공개 예정 날짜와 비활성 표시', str(st))
    g.js("(await import('/js/ui_v2/growthUi_v2.js')).closeGrowthPanel();")

    st = g.js(SCHEDULE + STAGES + """
        C.setReleaseSchedule({ zones: { 2: '2000-01-01' } });
        const menu = window.madOverlordGameV2.menuController;
        menu.renderStages(); menu.selectZone('ch2');
        return { chapter: S.chapterUnlocked(S.CHAPTER2, progress), stage: S.isUnlocked('2-1', progress),
            selected: progress.selectedStage, zones: progress.dispatchZones() };""")
    ctx.check(st['chapter'] and st['stage'] and st['selected'].startswith('2-') and 2 in st['zones'],
              '과거 날짜로 교체: 구역 선택과 파견 가능', str(st))

    st = g.js(SCHEDULE + STAGES + """
        C.setReleaseSchedule({ zones: { 2: '2999-12-31' } });
        progress.selectedStage = '2-1';
        window.madOverlordGameV2.menuController.renderStages();
        const selected = progress.selectedStage;
        const released = C.isZoneReleased(S.stageById(selected).zone);
        C.setReleaseSchedule({});
        return { selected, released };
        """)
    ctx.check(not st['selected'].startswith('2-') and st['released'],
              '저장된 선택 구역이 공개 전이면 열린 스테이지로 돌아감', str(st))

    st = g.js(SCHEDULE + """
        C.setReleaseSchedule({ characters: { frost: '2999-12-31' } });
        progress.totalStars = () => 999;
        const spent = progress.spentStars;
        const denied = progress.unlockCharacter('frost');
        progress.unlockedChars.push('frost');
        window.madOverlordGameV2.switchScreen('select');
        const card = document.querySelector('.v2-charcard[data-char="frost"]');
        const before = progress.character;
        card.click();
        return { success: denied.success, spent: progress.spentStars - spent,
            unlocked: progress.isCharacterUnlocked('frost'), saved: progress.unlockedChars.includes('frost'),
            text: card.querySelector('.v2-charcard__foot').textContent,
            unchanged: before === progress.character, info: document.getElementById('select-info-v2').textContent };
        """)
    ctx.check(not st['success'] and st['spent'] == 0 and not st['unlocked'] and st['saved'] and st['unchanged'],
              '미래 캐릭터: 별 해금·선택 불가, 기존 해금 기록 유지', str(st))
    ctx.check('곧 공개 · 12월 31일' in st['text'] and '로 해금' not in st['text'] and '곧 공개' in st['info'],
              '캐릭터 카드와 클릭 안내: 별 해금 대신 곧 공개 날짜', str(st))

    st = g.js(SCHEDULE + """
        C.setReleaseSchedule({ characters: { frost: '2000-01-01' } });
        const saved = progress.isCharacterUnlocked('frost');
        progress.unlockedChars = progress.unlockedChars.filter(id => id !== 'frost');
        const result = progress.unlockCharacter('frost');
        window.madOverlordGameV2.selectController.pick('frost');
        return { saved, success: result.success, cost: result.cost, selected: progress.character };
        """)
    ctx.check(st['saved'] and st['success'] and st['cost'] > 0 and st['selected'] == 'frost',
              '과거 캐릭터: 저장 해금 복구, 별 해금과 선택 정상', str(st))

    st = g.js(SCHEDULE + STAGES + """
        C.setReleaseSchedule({ zones: { 2: '2999-12-31' }, characters: { frost: '2999-12-31' } });
        const original = location.href;
        const url = new URL(original); url.searchParams.set('allContent', '1');
        history.replaceState(null, '', url);
        const result = { zone: S.chapterUnlocked(S.CHAPTER2, progress),
            char: progress.isCharacterUnlocked('frost'), dispatch: progress.dispatchZones().includes(2) };
        history.replaceState(null, '', original);
        C.setReleaseSchedule(null);
        return result;""")
    ctx.check(st['zone'] and st['char'] and st['dispatch'], '?allContent=1: 미래 구역·캐릭터·파견 공개 제한 우회', str(st))
