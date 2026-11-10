"""메인 화면·연구소·선택창·저장: 로딩 화면, 화면 크기 맞춤, 파츠 구매(소유)·재장착 무료·강화,
캐릭터 선택창(연구소는 고른 캐릭터 파츠만, 캐릭터별 장착 기억, 몸통 없으면 출격 막힘), 새로고침 후 유지, 예전 저장 바꾸기"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 로딩이 끝나고 메인 화면이 보임
    st = g.js("""return { name: document.getElementById('menu-unit-name-v2').textContent,
        callouts: document.querySelectorAll('#menu-callouts-v2 li').length,
        scale: getComputedStyle(document.documentElement).getPropertyValue('--v2-scale').trim(),
        loaded: sound.buffers.size, dm: gameState.darkMatter };""")
    ctx.check(st['name'] == '거대로봇', '메인: 기본 캐릭터 표시 (거대로봇)', st['name'])
    ctx.check(st['callouts'] == 4, '메인: 부위 설명 4칸')
    ctx.check(st['scale'] not in ('', '0'), '화면 크기 맞춤 배율 적용', st['scale'])
    ctx.check(st['loaded'] >= 60, '로딩: 효과음 미리 받기', str(st['loaded']))
    st = g.js("return progress.equippedStats();")   # 기본 로봇: 속도 10 + 5 + 10 + 기본 다리 70, 공격력 80 + 60 + 기본 팔 520 + 30 (v2에서만, D-043)
    ctx.check(st['speed'] == 95 and st['dps'] == 690, 'v2 능력치 덮어쓰기: 기본 로봇 속도 95·공격력 690', str(st))
    g.shot('menu_main', '#screen-menu-v2')

    # 연구소: 고른 캐릭터(거대로봇) 파츠만, [파츠제거] 없음 (D-051)
    g.page.click('#btn-to-lab-v2')
    g.wait(900)
    names = []
    for slot in ('head', 'body', 'arm', 'leg'):
        g.page.click(f'.v2-slottab[data-slot="{slot}"]')
        g.wait(100)
        names += g.js("return [...document.querySelectorAll('#parts-grid-v2 .v2-partcard__name')].map(e => e.firstChild.textContent);")  # 이름만 (뒤의 Lv·등급 표시 빼고)
    ctx.check(len(names) == 45 and '[파츠제거]' not in names and '흑마법 룬 갑옷' not in names and '산성 발톱 팔' not in names
              and '레일건' in names and '파일 벙커' in names and '뇌운 관제 헬름' in names,
              '연구소: 거대로봇 파츠만 45개 (기본 9 + A·B 세트 8 + 2차 7세트 28, [파츠제거]·다른 캐릭터 없음)', str(names))

    # 머리 구매: 타겟팅 레이저 바이저 (500 DM)
    g.page.click('.v2-slottab[data-slot="head"]')
    g.page.locator('.v2-partcard', has_text='타겟팅 레이저 바이저').click()
    g.wait(300)
    before = g.js('return gameState.darkMatter;')
    g.page.click('#btn-equip-confirm-v2')
    g.wait(300)
    st = g.js("return { dm: gameState.darkMatter, head: gameState.equippedParts.head, owned: progress.isOwned('head_mech') };")
    ctx.check(st['head'] == 'head_mech' and st['owned'], '연구소: 파츠 구매 후 장착·보유')
    ctx.check(before - st['dm'] == 500, '연구소: 구매 비용 500 DM 차감', f"{before} → {st['dm']}")

    # 기본 머리로 바꿨다가 다시 바이저 → 보유 중이라 무료
    g.page.locator('.v2-partcard', has_text='기본 머리').click()
    g.page.click('#btn-equip-confirm-v2')
    g.wait(200)
    g.page.locator('.v2-partcard', has_text='타겟팅 레이저 바이저').click()
    cost = g.js('return progress.cartCost();')
    ctx.check(cost == 0, '보유 파츠 다시 장착은 무료', str(cost))
    g.page.click('#btn-equip-confirm-v2')
    g.wait(200)

    # 강화: Lv1 → Lv2, 비용 차감, 능력치 상승
    hp1 = g.js('return progress.equippedStats().hp;')
    dm1 = g.js('return gameState.darkMatter;')
    up_cost = g.js("return progress.upgradeCost('head_mech');")
    g.page.click('#btn-upgrade-v2')
    g.wait(300)
    st = g.js("return { lv: progress.levelOf('head_mech'), hp: progress.equippedStats().hp, dm: gameState.darkMatter };")
    ctx.check(st['lv'] == 2, '강화: Lv1 → Lv2', str(st['lv']))
    ctx.check(dm1 - st['dm'] == up_cost, '강화: 비용 차감', f'{up_cost}')
    ctx.check(st['hp'] > hp1, '강화: 능력치 상승 (HP)', f"{hp1} → {st['hp']}")
    g.shot('lab_upgrade', '#screen-lab-v2')

    # 캐릭터 선택창 (D-051): 카드 10장(기존 4 + 새 캐릭터 6, 한 화면 4장 + 가로로 넘김), 지금 캐릭터 표시
    g.page.click('#btn-lab-back-v2')
    g.wait(400)
    g.page.click('#btn-to-select-v2')
    g.wait(1200)
    st = g.js("""const grid = document.getElementById('select-grid-v2');
        const vis = [...document.querySelectorAll('.v2-charcard')].filter(c => c.offsetLeft + c.offsetWidth <= grid.scrollLeft + grid.clientWidth + 1);
        return { cards: document.querySelectorAll('.v2-charcard').length, visible: vis.length, scroll: grid.scrollWidth > grid.clientWidth,
            sel: document.querySelector('.v2-charcard.is-selected')?.dataset.char };""")
    ctx.check(st['cards'] == 10 and st['visible'] == 4 and st['scroll'] and st['sel'] == 'mech',
              '선택창: 카드 10장 (한 화면 4장 + 가로로 넘김), 지금 캐릭터 = 거대로봇', str(st))

    # 구역에 가면 합류하는 캐릭터 (D-119 — 예전 별 해금 Q-006): 아직이면 잠김 안내, 구역 4의 4-1이 열리면 합류
    st = g.js("""return { lock: document.querySelector('.v2-charcard[data-char="chimera"]').classList.contains('is-locked'),
        foot: document.querySelector('.v2-charcard[data-char="chimera"] .v2-charcard__foot').textContent };""")
    g.page.click('.v2-charcard[data-char="chimera"]')
    g.wait(300)
    st2 = g.js("return { ch: progress.character, info: document.getElementById('select-info-v2').textContent };")
    ctx.check(st['lock'] and '구역 4 도착 시 합류' in st['foot'] and '★' not in st['foot'] and st2['ch'] == 'mech' and '구역 4에 도착하면' in st2['info'],
              '선택창: 잠긴 합성괴인 — "구역 4 도착 시 합류", 아직이면 안 바뀌고 안내', str([st, st2]))
    g.js("(await import('/js/engine_v2/stages_v2.js')).CHAPTERS.slice(0, 3).flatMap(ch => ch.stages).forEach(s => progress.stages[s.id] = { stars: [true,true,true], cleared: true, bestTime: 60 });")
    g.js("window.madOverlordGameV2.selectController.render();")

    # 합성괴인 (파츠 무료·보유) → 3-B까지 깨서 합류(별 안 씀), 바로 그 캐릭터 파츠로
    stars0 = g.js("return progress.availableStars();")
    g.page.click('.v2-charcard[data-char="chimera"]')
    g.wait(300)
    st = g.js("return { ch: progress.character, eq: gameState.equippedParts, ready: progress.isReady(), stars: progress.availableStars() };")
    ctx.check(st['ch'] == 'chimera' and st['eq']['body'] == 'body_chimera' and st['eq']['arm'] == 'arm_chimera' and st['ready'] and st['stars'] == stars0 == 99,
              '선택창: 3-B까지 깨면 합성괴인 합류(별 99개 그대로) → 가진 합성괴인 파츠로 장착', str(st))

    # 타락 히어로 (파츠 없음) → 빈 장착, 흐린 모습, 출격 막힘
    g.page.click('.v2-charcard[data-char="hero"]')
    g.wait(800)
    g.shot('select_hero', '#screen-select-v2')
    st = g.js("return { ch: progress.character, eq: gameState.equippedParts, ready: progress.isReady() };")
    ctx.check(st['ch'] == 'hero' and set(st['eq'].values()) == {'none'} and not st['ready'],
              '선택창: 안 산 캐릭터 → 부위가 빈 장착, 출격 불가', str(st))
    g.page.click('#btn-select-confirm-v2')
    g.wait(500)
    g.page.click('#btn-to-battle-v2')
    g.wait(300)
    st = g.js("""return { scr: gameState.currentScreen, name: document.getElementById('menu-unit-name-v2').textContent,
        foot: document.getElementById('menu-map-foot-v2').textContent };""")
    ctx.check(st['scr'] == 'menu' and st['name'] == '타락 히어로' and '출격 불가' in st['foot'],
              '메인: 몸통 없으면 출격 버튼이 막힘 (흐린 타락 히어로)', str(st))

    # 연구소: 히어로 파츠만 → 몸통 구매하면 출격 가능
    g.page.click('#btn-to-lab-v2')
    g.wait(800)
    g.page.click('.v2-slottab[data-slot="body"]')
    names = g.js("return [...document.querySelectorAll('#parts-grid-v2 .v2-partcard__name')].map(e => e.firstChild.textContent);")  # 이름만 (뒤의 Lv·등급 표시 빼고)
    # 순서는 등급 묶음(Q-017 C안, test_grade_ui) — 여기서는 어떤 카드가 있는지만
    ctx.check({'흑마법 룬 갑옷', '찢어진 망토 갑옷', '저주 룬 로브'} <= set(names) and len(names) == 10 and '검은 날개 갑주' in names,
              '연구소: 타락 히어로 몸통만 표시 (기본 + A·B 세트 + 2차 7세트)', str(names))
    g.page.locator('.v2-partcard', has_text='흑마법 룬 갑옷').click()
    g.page.click('#btn-equip-confirm-v2')
    g.wait(300)
    ctx.check(g.js('return progress.isReady();'), '연구소: 몸통 구매 → 출격 가능')

    # 거대로봇으로 돌아가면 아까 장착(바이저) 그대로
    g.page.click('#btn-lab-back-v2')
    g.wait(300)
    g.page.click('#btn-to-select-v2')
    g.wait(500)
    g.page.click('.v2-charcard[data-char="mech"]')
    g.wait(300)
    st = g.js("return gameState.equippedParts;")
    ctx.check(st['head'] == 'head_mech' and st['body'] == 'body_red_robot', '캐릭터별 장착 기억: 거대로봇 = 바이저 장착 그대로', str(st))
    g.page.click('#btn-select-confirm-v2')
    g.wait(300)

    # 새로고침 후에도 유지
    saved = g.js('return { dm: gameState.darkMatter };')
    g.reload_v2()
    st = g.js("""return { dm: gameState.darkMatter, ch: progress.character, head: gameState.equippedParts.head,
        lv: progress.levelOf('head_mech'), hero: progress.loadouts.hero, heroOwned: progress.isOwned('body_hero') };""")
    ctx.check(st['dm'] == saved['dm'], '저장: DM 유지', f"{saved['dm']} / {st['dm']}")
    ctx.check(st['ch'] == 'mech' and st['head'] == 'head_mech' and st['lv'] == 2, '저장: 캐릭터·장착·강화 레벨 유지', str(st))
    ctx.check(st['heroOwned'] and st['hero'] and st['hero']['body'] == 'body_hero', '저장: 다른 캐릭터 장착 기억 유지 (히어로 몸통)', str(st['hero']))
    name = g.js("return document.getElementById('menu-unit-name-v2').textContent;")
    ctx.check(name == '거대로봇', '저장: 새로고침 후 메인 캐릭터 = 거대로봇', name)

    # 전투 능력치에 강화 반영
    g.battle(None, wait_ms=500)
    hp = g.js('return b.maxPlayerHp;')
    ctx.check(hp == g.js('return progress.equippedStats().hp;'), '전투 최대 체력 = 강화 반영 능력치', str(hp))

    # 화면 크기 맞춤: 창이 크면 확대
    g.page.set_viewport_size({'width': 1920, 'height': 1080})
    g.wait(300)
    k = float(g.js("return getComputedStyle(document.documentElement).getPropertyValue('--v2-scale');"))
    ctx.check(1.4 < k < 1.5, '창 1920x1080 → 약 1.48배 확대', f'{k:.3f}')

    # 예전 저장(v1, 다른 캐릭터 파츠를 섞어 낌) → 몸통 캐릭터로 바꿈, 다른 캐릭터 부위는 그 캐릭터 파츠를 줌 (D-051)
    g2 = ctx.game(fresh=True)
    g2.page.evaluate("""() => localStorage.setItem('mo_v2_save', JSON.stringify({ v: 1, dm: 1234,
        equipped: { head: 'head_red_robot', body: 'body_hero', arm: 'arm_mech_laser', leg: 'leg_hero_hover' },
        owned: ['body_hero', 'arm_mech_laser', 'leg_hero_hover'], levels: { arm_mech_laser: 3 }, stages: {} }))""")
    g2.page.reload()
    g2.enter_v2()
    st = g2.js("""return { ch: progress.character, eq: gameState.equippedParts, dm: gameState.darkMatter,
        wand: progress.isOwned('arm_hero_wave'), laser: progress.isOwned('arm_mech_laser'), lv: progress.levelOf('arm_mech_laser'),
        name: document.getElementById('menu-unit-name-v2').textContent };""")
    ctx.check(st['ch'] == 'hero' and st['name'] == '타락 히어로', '예전 저장: 몸통 캐릭터(타락 히어로)로', str(st))
    ctx.check(st['eq'] == {'head': 'head_hero', 'body': 'body_hero', 'arm': 'arm_hero_wave', 'leg': 'leg_hero_hover'} and st['wand'],
              '예전 저장: 다른 캐릭터 부위 → 히어로 파츠로 바꿔 줌', str(st['eq']))
    ctx.check(st['laser'] and st['lv'] == 3 and st['dm'] == 1234, '예전 저장: 산 파츠·강화 레벨·DM 그대로', str(st))
