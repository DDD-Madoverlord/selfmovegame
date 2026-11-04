"""스토리 인트로 (모션 코믹, D-100): 1-1·2-1·3-1·4-1을 처음 출격하면 그 구역 이야기 → 전투.
탭으로 글자 완성 → 다음 장면, Space·Esc, 한 번 본 뒤에는 바로 전투, STORY 단추로 다시 보기, 컷 그림 파일·제목 카드
컷 그림은 칸마다 새로 그린 일러스트만 (게임 배경·적·리그 그림 재활용 안 함, 11-03)"""

INTRO = "const S = await import('/js/ui_v2/storyIntro_v2.js'); const c = S.currentIntro();"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js('window.madOverlordNoIntro = false;')   # common.enter_v2가 끈 것을 다시 켬

    # 대본에 쓴 그림 파일이 모두 있는가
    st = g.js("""const { STORY_INTROS } = await import('/js/engine_v2/storyIntros_v2.js');
        const urls = new Set(), other = [];
        let panels = 0;
        for (const sc of Object.values(STORY_INTROS)) {
            urls.add(sc.title.face);
            sc.pages.forEach(p => Object.values(p.panels).forEach(pd => {
                panels += 1;
                (pd.layers || []).forEach(l => {
                    if (l.img) urls.add(l.img);
                    if (l.sheet || l.rig || l.tile) other.push(l.sheet || l.rig || l.tile);
                });
            }));
        }
        const bad = [];
        for (const u of urls) { const r = await fetch('/' + u, { method: 'HEAD' }); if (!r.ok) bad.push(u); }
        return { zones: Object.keys(STORY_INTROS), panels, n: urls.size, bad, other,
            notIntro: [...urls].filter(u => !u.startsWith('assets/sprites/intro/')) };""")
    nz = len(st['zones'])
    ctx.check(st['zones'] == [str(z) for z in range(1, nz + 1)] and nz >= 4 and st['panels'] >= 27 and st['n'] == st['panels'] + nz and not st['bad'],
              f'대본 1~{nz} · 칸 {st["panels"]}개 컷 그림(칸마다 다른 그림) + 제목 얼굴 {nz}장 파일 모두 있음', str(st))
    ctx.check(not st['other'] and not st['notIntro'], '게임 리소스(배경·적 시트·리그) 재활용 없음 — 인트로 전용 그림만', str(st))

    # 1-1 첫 출격 → 인트로 (메인 화면 위, 전투는 아직)
    ctx.check(g.js("return progress.selectedStage === '1-1' && !document.getElementById('btn-story-intro-v2').hidden;"),
              '1-1 선택 · STORY 다시 보기 단추 보임')
    g.page.click('#btn-to-battle-v2')
    g.wait(300)
    g.js(INTRO + "for (let k = 0; k < 60 && c && c.i < 0; k++) await new Promise(r => setTimeout(r, 50));")   # 첫 쪽 그림 미리 받기 (최대 3초)
    g.wait(400)
    st = g.js(INTRO + """return { on: !!document.querySelector('.v2-story'), i: c && c.i, panels: document.querySelectorAll('.v2-story__panel.is-in').length,
        screen: window.madOverlordGameV2.currentScreen, active: b.isActive, skip: !!document.querySelector('.v2-story__skip') };""")
    ctx.check(st['on'] and st['i'] == 0 and st['panels'] == 1 and st['screen'] == 'menu' and not st['active'] and st['skip'],
              '1-1 첫 출격: 인트로 먼저 (첫 칸 등장 · 전투 시작 전 · SKIP 단추)', str(st))
    g.shot('story_intro_z1', '.v2-story')

    # 탭: 글자가 나오는 중이면 완성, 다 나왔으면 다음 장면
    g.wait(300)
    g.page.mouse.click(640, 400)
    g.wait(150)
    st = g.js(INTRO + "return { i: c.i, typing: c.typers.length, busy: c.busy(), texts: document.querySelectorAll('.v2-story__text').length };")
    ctx.check(st['i'] == 0 and st['typing'] == 0 and not st['busy'] and st['texts'] == 2, '탭 1번: 이번 장면 글자 모두 완성 (넘어가지 않음)', str(st))
    g.page.mouse.click(640, 400)
    g.wait(400)
    ctx.check(g.js(INTRO + "return c.i;") == 1, '탭 2번: 다음 장면')
    g.key(' ')
    g.wait(100)
    g.key(' ')
    g.wait(300)
    ctx.check(g.js(INTRO + "return c.i;") >= 2, 'Space로도 넘김')

    # Esc → 끝 → 1-1 전투, 본 것으로 저장
    g.key('Escape')
    g.wait(1600)
    st = g.js("""return { gone: !document.querySelector('.v2-story'), screen: window.madOverlordGameV2.currentScreen, active: b.isActive,
        stage: b.stage && b.stage.id, seen: progress.hasTip('intro_z1') };""")
    ctx.check(st['gone'] and st['screen'] == 'battle' and st['active'] and st['stage'] == '1-1' and st['seen'],
              'Esc: 인트로 끝 → 1-1 전투 시작 · 본 것으로 저장', str(st))

    # 다시 출격: 이미 봤으면 바로 전투
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)
    g.page.click('#btn-to-battle-v2')
    g.wait(600)
    st = g.js("return { intro: !!document.querySelector('.v2-story'), screen: window.madOverlordGameV2.currentScreen };")
    ctx.check(not st['intro'] and st['screen'] == 'battle', '두 번째 출격: 인트로 없이 바로 전투', str(st))
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)

    # 1-2는 인트로 없음 / 2-1·3-1·4-1은 있음 / 대본이 아직 없는 구역(다음 번호)은 없음 (STORY 단추 숨김)
    st = g.js("""const S = await import('/js/ui_v2/storyIntro_v2.js');
        const St = await import('/js/engine_v2/stages_v2.js');
        St.unlockAllStagesTemp();
        const menu = window.madOverlordGameV2.menuController;
        const none = [5, 6, 7, 8, 9, 10].find(z => !S.hasIntro(z));
        let hidN = true;
        if (none) { menu.selectStage(none + '-1'); hidN = document.getElementById('btn-story-intro-v2').hidden; }
        menu.selectStage('2-1');
        return { z12: S.introZoneOf('1-2'), z21: S.introZoneOf('2-1'), z31: S.introZoneOf('3-1'), z41: S.introZoneOf('4-1'), zB: S.introZoneOf('2-B'),
            none, zN: none ? S.introZoneOf(none + '-1') : null, play21: S.shouldPlayIntro('2-1'), hidN, show2: !document.getElementById('btn-story-intro-v2').hidden };""")
    ctx.check(st['z12'] is None and st['z21'] == 2 and st['z31'] == 3 and st['z41'] == 4 and st['zB'] is None and st['zN'] is None and st['play21'],
              '인트로는 2-1·3-1·4-1에도 (1-2·2-B·대본 없는 구역은 없음)', str(st))
    ctx.check(st['hidN'] and st['show2'], 'STORY 단추: 대본 있는 구역만', str(st))

    # 구역 2·3 끝까지 넘겨 보기: 칸·리그·제목 카드, 다시 보기는 메인 화면 그대로
    for zone, name in ((2, '끓어오르는 대지'), (3, '피로 물든 순례길'), (4, '진화의 심연')):
        if zone == 2:
            g.page.click('#btn-story-intro-v2')
        else:
            g.js(f"import('/js/ui_v2/storyIntro_v2.js').then(S => S.playStoryIntro({zone}));")
        g.wait(600)
        imgs = 0
        for _ in range(40):
            st = g.js(INTRO + "if (!c) return null; if (!c.titleShown) c.next(); return { i: c.i, title: c.titleShown, imgs: document.querySelectorAll('.v2-story__img').length };")
            if not st:
                break
            imgs = max(imgs, st['imgs'])
            if st['title']:
                break
            g.wait(120)
        g.wait(700)
        st2 = g.js("const t = document.querySelector('.v2-story__title h2'); return { title: t && t.textContent, face: !!document.querySelector('.v2-story__title-face img') };")
        ctx.check(st and st['title'] and st2['title'] == name and st2['face'] and imgs >= 3,
                  f'구역 {zone}: 모든 장면 → 제목 카드 "{name}" · 칸마다 컷 그림', f'{st} {st2} imgs={imgs}')
        if zone >= 3:
            g.shot(f'story_intro_z{zone}_title', '.v2-story')
        g.page.mouse.click(640, 400)   # 제목 카드에서 탭 → 끝
        g.wait(900)
        st = g.js("return { gone: !document.querySelector('.v2-story'), screen: window.madOverlordGameV2.currentScreen, active: b.isActive };")
        ctx.check(st['gone'] and st['screen'] == 'menu' and not st['active'], f'구역 {zone}: 다시 보기 끝 → 메인 화면 그대로 (출격 안 함)', str(st))

    # 가만히 두면 저절로 다음 장면
    g.js("import('/js/ui_v2/storyIntro_v2.js').then(S => S.playStoryIntro(1));")
    g.wait(7500)
    ctx.check(g.js(INTRO + "return c ? c.i : -1;") >= 1, '자동 재생: 읽을 시간 뒤 다음 장면으로')
    g.page.click('.v2-story__skip')
    g.wait(900)
    ctx.check(g.js("return !document.querySelector('.v2-story') && window.madOverlordGameV2.currentScreen === 'menu';"), 'SKIP 단추: 다시 보기 끝')
