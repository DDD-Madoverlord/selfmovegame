"""연구소 파츠 등급 표기 (2026-11-03, Q-017 C안 → D-096): 카드 그림 아래 등급 띠(커먼 포함, 긴 이름에도 보임),
목록은 모으는 세트 → 등급 높은 순 묶음 + 머리 줄, 부위 탭 아래 등급 거르기 칩, 세트 탭에서는 칩 숨김"""

# 거대로봇 팔: 네 등급이 다 나오게 (세트 파츠는 등급 바닥 이상)
GRADES = {
    'arm_red_robot': 'common', 'arm_mech_laser': 'rare', 'arm_mech_missile': 'unique',
    'arm_mech_a': 'rare', 'arm_mech_b': 'rare', 'arm_mech_u': 'legendary',
    'arm_mech_c': 'rare', 'arm_mech_d': 'unique', 'arm_mech_v': 'unique', 'arm_mech_w': 'unique',
    'arm_mech_l': 'legendary', 'arm_mech_m': 'legendary',
}
ORDER = ['legendary', 'unique', 'rare', 'common']

CARDS = """return [...document.querySelectorAll('#parts-grid-v2 .v2-partcard')].map(c => {
    const rb = c.querySelector('.v2-partcard__grade'), r = rb && rb.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { name: c.querySelector('.v2-partcard__name').firstChild.textContent, grade: c.dataset.grade, ribbon: rb ? rb.textContent : '',
             shown: !!r && r.width > 20 && r.height >= 10 && r.left >= cr.left && r.right <= cr.right, mate: c.classList.contains('is-setmate') };
});"""
HEADS = "return [...document.querySelectorAll('#parts-grid-v2 .v2-partgroup')].map(h => h.firstChild.textContent);"
CHIPS = """return [...document.querySelectorAll('#parts-gradebar-v2 .v2-gradechip')].map(c => ({ id: c.dataset.grade, on: c.classList.contains('is-on'),
    n: Number(c.querySelector('b').textContent), off: c.disabled }));"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js(f"Object.entries({GRADES!r}).forEach(([id, gr]) => {{ progress.owned.add(id); progress.grades[id] = gr; }}); return true;")
    g.page.click('#btn-to-lab-v2')
    g.wait(900)
    g.page.click('.v2-slottab[data-slot="arm"]')
    g.wait(300)

    # 카드마다 그림 아래 등급 띠 — 커먼도 표시, 이름이 긴 레전더리(로켓 펀치 건틀릿)도 띠가 카드 안에 보임
    cards = g.js(CARDS)
    names = {'common': '커먼', 'rare': '레어', 'unique': '유니크', 'legendary': '레전더리'}
    ctx.check(len(cards) == 12 and all(c['ribbon'] == names[c['grade']] and c['shown'] for c in cards),
              '등급 띠: 카드 12장 모두 그림 아래 등급 이름 (커먼 포함)', str(cards))
    # 카드 그림: 2차 세트 대포 팔(장거리 저격포·플라즈마 방사 팔·쌍열 가속포)도 그림이 나옴 — 전투 리그와 같은 규칙(rigArm, mechArmOf)
    g.wait(800)
    blank = g.js("""return [...document.querySelectorAll('#parts-grid-v2 .v2-partcard')].filter(c => {
        const img = c.querySelector('.v2-partcard__thumb img'); return !img || !img.complete || img.naturalWidth === 0; }).map(c => c.dataset.id);""")
    ctx.check(not blank, '카드 그림: 거대로봇 팔 12장 모두 그림이 나옴 (2차 세트 대포 팔 포함)', str(blank))
    rocket = next((c for c in cards if c['name'] == '로켓 펀치 건틀릿'), {})
    ctx.check(rocket.get('ribbon') == '레전더리' and rocket.get('shown'), '등급 띠: 긴 이름 카드도 등급이 잘리지 않음', str(rocket))

    # 목록: 등급 높은 순 묶음 + 머리 줄 (모으는 세트 없음)
    idx = [ORDER.index(c['grade']) for c in cards]
    heads = g.js(HEADS)
    ctx.check(idx == sorted(idx) and heads == ['레전더리', '유니크', '레어', '커먼'],
              '목록: 레전더리 → 유니크 → 레어 → 커먼 묶음, 묶음마다 머리 줄', f'{heads} {[c["grade"] for c in cards]}')

    # 거르기 칩: 전체 12 · 레전더리 3 · 유니크 4 · 레어 4 · 커먼 1, 처음은 전체
    chips = g.js(CHIPS)
    ctx.check([(c['id'], c['n']) for c in chips] == [('all', 12), ('legendary', 3), ('unique', 4), ('rare', 4), ('common', 1)]
              and chips[0]['on'] and not any(c['off'] for c in chips),
              '거르기 칩: 전체·레전더리·유니크·레어·커먼 + 개수, 처음은 전체', str(chips))
    g.shot('grade_ui_arm', '.v2-lab__parts')

    # 레전더리 칩 → 레전더리만, 다른 부위 탭으로 가도 유지, 전체 칩 → 다시 모두
    g.page.click('.v2-gradechip[data-grade="legendary"]')
    g.wait(200)
    cards = g.js(CARDS)
    chips = g.js(CHIPS)
    ctx.check(len(cards) == 3 and all(c['grade'] == 'legendary' for c in cards) and chips[1]['on'] and not chips[0]['on'],
              '레전더리 칩: 레전더리 카드만', str(cards))
    g.page.click('.v2-slottab[data-slot="head"]')
    g.wait(200)
    st = g.js("""const cards = [...document.querySelectorAll('#parts-grid-v2 .v2-partcard')];
        return { n: cards.length, leg: cards.every(c => c.dataset.grade === 'legendary'),
                 on: document.querySelector('.v2-gradechip.is-on').dataset.grade };""")
    ctx.check(st['n'] >= 1 and st['leg'] and st['on'] == 'legendary', '부위 탭을 바꿔도 등급 거르기 유지 (머리 레전더리 세트 파츠)', str(st))
    g.page.click('.v2-gradechip[data-grade="all"]')
    g.wait(200)
    st = g.js("return document.querySelectorAll('#parts-grid-v2 .v2-partcard').length;")
    ctx.check(st > 3, '전체 칩: 다시 모든 카드', str(st))

    # 세트 탭: 거르기 칩 숨김 → 부위 탭으로 돌아오면 다시 보임
    g.page.click('.v2-slottab[data-slot="set"]')
    g.wait(200)
    hidden = g.js("return document.getElementById('parts-gradebar-v2').hidden;")
    g.page.click('.v2-slottab[data-slot="arm"]')
    g.wait(200)
    shown = g.js("return !document.getElementById('parts-gradebar-v2').hidden;")
    ctx.check(hidden and shown, '세트 탭에서는 거르기 칩 숨김, 부위 탭에서 다시 보임')

    # 모으는 세트(레어 ① 포격 사령부 — 레일건)를 고르면 그 짝이 '모으는 세트' 묶음으로 맨 앞, 나머지는 등급 순
    g.page.locator('.v2-partcard', has_text='레일건').click()
    g.wait(200)
    cards = g.js(CARDS)
    heads = g.js(HEADS)
    rest = [ORDER.index(c['grade']) for c in cards if not c['mate']]
    ctx.check(heads[0] == '모으는 세트' and cards[0]['name'] == '레일건' and cards[0]['mate'] and rest == sorted(rest),
              "모으는 세트 짝은 '모으는 세트' 묶음으로 맨 앞, 나머지는 등급 순", f'{heads} {[c["name"] for c in cards]}')

    # 등급별 강화 비용 (11-03): 같은 파츠·같은 레벨이면 커먼 < 레어 < 유니크 < 레전더리 (배율 1.0 · 1.3 · 1.7 · 2.2, growth_v2.js GRADES upCost)
    st = g.js("""const id = 'arm_mech_laser', out = {};
        for (const gr of ['common', 'rare', 'unique', 'legendary']) { progress.grades[id] = gr; out[gr] = progress.upgradeCost(id); }
        progress.grades[id] = 'rare';
        return out;""")
    ctx.check(st['common'] < st['rare'] < st['unique'] < st['legendary'] and abs(st['legendary'] / st['common'] - 2.2) < 0.05,
              '강화 비용: 등급이 높을수록 비쌈 (레전더리 = 커먼의 약 2.2배)', str(st))

    # 등급 단계 (11-03, growth_v2.js TIER_UNLOCK): 그 캐릭터의 커먼 3개 → 레어 · 레어 4개 → 유니크 · 유니크 5개 → 레전더리
    st = g.js("""const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js'); const S = await import('/js/engine_v2/sets_v2.js');
        const all = SLOTS.flatMap(s => partsOfCharacter('kaiju', s)), tier = p => S.dropGroupOf(p);
        const rare = partsOfCharacter('kaiju', 'arm').find(p => tier(p) === 'rare'), unique = all.find(p => tier(p) === 'unique');
        all.forEach(p => progress.owned.delete(p.id));
        all.filter(p => tier(p) === 'base').slice(0, 2).forEach(p => progress.owned.add(p.id));
        const l2 = progress.tierLock(rare);
        gameState.darkMatter = 99999;
        const cart0 = { ...gameState.cartParts };
        gameState.cartParts = { ...cart0, arm: rare.id };
        const buy = progress.confirmCart();
        gameState.cartParts = cart0;
        all.filter(p => tier(p) === 'base').slice(0, 3).forEach(p => progress.owned.add(p.id));
        const l3 = progress.tierLock(rare), u0 = progress.tierLock(unique);
        all.filter(p => tier(p) === 'rare').slice(0, 4).forEach(p => progress.owned.add(p.id));
        const u4 = progress.tierLock(unique);
        progress.owned.delete(all.filter(p => tier(p) === 'base').at(2).id);   // 다시 커먼 2개로 → 연구소 카드 자물쇠 확인
        all.filter(p => tier(p) === 'rare').forEach(p => progress.owned.delete(p.id));
        return { l2, buy: [buy.success, buy.reason || ''], l3, u0, u4 };""")
    ctx.check(st['l2'] and st['l2']['need'] == 3 and st['l2']['have'] == 2 and not st['buy'][0] and '커먼 파츠를 3개' in st['buy'][1]
              and st['l3'] is None and st['u0'] and st['u0']['need'] == 4 and st['u4'] is None,
              '등급 단계: 커먼 2개면 레어 세트 구매 막힘 · 3개면 열림 · 레어 4개면 유니크 열림', str(st))
    g.js("progress.selectCharacter('kaiju'); window.madOverlordGameV2.switchScreen('lab');")
    g.wait(800)
    g.page.click('.v2-slottab[data-slot="arm"]')
    g.wait(300)
    st = g.js("""const c = document.querySelector('#parts-grid-v2 .v2-partcard.is-tierlocked[data-grade="rare"]');
        return c && { badge: c.querySelector('.v2-partcard__badge').textContent, title: c.title };""")
    ctx.check(st and '2/3' in st['badge'] and '커먼' in st['badge'] and '3개' in st['title'],
              '연구소 카드: 잠긴 레어 세트에 자물쇠 + "커먼 2/3", 마우스를 올리면 조건 설명', str(st))
    g.shot('grade_ui_tierlock', '.v2-lab__parts')
