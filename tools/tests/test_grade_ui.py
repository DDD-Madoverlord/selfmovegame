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
