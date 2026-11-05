"""연구소 세트 알아보기 (2026-10-24): 세트 탭(세트마다 네 부위·세트 효과·[세트로 담기]), 카드 그림 모서리 세트 표시(R① 등),
모으는 세트의 짝 카드 맨 앞·테두리, 부위 탭의 점"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.page.click('#btn-to-lab-v2')
    g.wait(900)

    # 세트 탭: 거대로봇 9세트, 레어 ① 포격 사령부가 맨 위, 강화 칸은 숨김
    g.page.click('.v2-slottab[data-slot="set"]')
    g.wait(200)
    st = g.js("""const rows = [...document.querySelectorAll('#parts-grid-v2 .v2-setrow:not(.is-common)')];
        return { n: rows.length, first: rows[0] && rows[0].querySelector('.v2-setrow__head b').textContent,
                 parts: rows[0] ? rows[0].querySelectorAll('.v2-setrow__part[data-id]').length : 0,
                 bonus: rows[0] ? rows[0].querySelectorAll('.v2-setrow__bonus li').length : 0,
                 upgHidden: document.getElementById('lab-upgrade-v2').hidden };""")
    ctx.check(st['n'] == 9 and st['first'] == '레어 ① 포격 사령부' and st['parts'] == 4 and st['bonus'] >= 1 and st['upgHidden'],
              '세트 탭: 거대로봇 9세트 (레어 → 유니크 → 레전더리 순), 한 줄에 네 부위·세트 효과, 강화 칸 숨김', str(st))

    # 커먼(세트 아님) 파츠도 맨 아래 줄로 보임 — Trello '세트장비 표시에 일반등급 장비 표기 안 됨' (11-03)
    st = g.js("""const all = [...document.querySelectorAll('#parts-grid-v2 .v2-setrow')];
        const rows = all.filter(r => r.classList.contains('is-common'));
        return { last: all.indexOf(rows[0]) === all.length - rows.length,
                 rows: rows.map(r => [r.querySelector('.v2-setmark').textContent, r.querySelector('.v2-setrow__head b').textContent,
                     [...r.querySelectorAll('.v2-setrow__part[data-id]')].map(b => b.dataset.id).join(','), r.querySelector('.v2-setrow__bonus').textContent.trim()]) };""")
    ctx.check(st['last'] and len(st['rows']) == 3 and st['rows'][0][:3] == ['C①', '커먼 기본 파츠', 'head_red_robot,body_red_robot,arm_red_robot,leg_red_robot']
              and st['rows'][1][2] == 'head_mech,body_mech,arm_mech_laser,leg_mech_wheel' and st['rows'][2][2] == 'arm_mech_missile'
              and st['rows'][0][3] == '세트 효과 없음',
              '세트 탭: 커먼 파츠도 맨 아래 줄로 (거대로봇 기본 로봇 · 메카닉 · 미사일 팔), 세트 효과 없음', str(st))
    take = "const rows = [...document.querySelectorAll('.v2-setrow.is-common')]; return rows.map(r => r.querySelector('.v2-setrow__take').textContent);"
    before = g.js(take)
    g.page.locator('.v2-setrow.is-common', has_text='커먼 강화 파츠').first.locator('.v2-setrow__take').click()
    g.wait(300)
    st = g.js("""const c = gameState.getCartObjects();
        return ['head', 'body', 'arm', 'leg'].map(s => c[s] && c[s].id);""")
    ctx.check(before[:2] == ['담음', '세트로 담기'] and before[2] == '모두 담기'
              and st == ['head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel'] and g.js(take)[:2] == ['세트로 담기', '담음'],
              '커먼 줄 [세트로 담기]: 기본 파츠는 처음부터 담음, 메카닉 줄을 누르면 네 부위가 장바구니에', str({'before': before, 'cart': st}))
    g.js("progress.selectCharacter('frost'); window.madOverlordGameV2.labController.refresh();")
    g.wait(300)
    st = g.js("""return [...document.querySelectorAll('#parts-grid-v2 .v2-setrow.is-common')].map(r => [r.querySelector('.v2-setmark').textContent,
        [...r.querySelectorAll('.v2-setrow__part[data-id]')].map(b => b.dataset.id).join(',')]);""")
    ctx.check(st == [['C①', 'head_frost,body_frost,arm_frost,leg_frost'], ['C②', 'head_frost_up,body_frost_up,arm_frost_up,leg_frost_up']],
              '새 캐릭터(서리): 커먼 기본 · 강화 두 줄', str(st))
    g.js("progress.selectCharacter('mech'); window.madOverlordGameV2.labController.refresh();")
    g.wait(300)

    # [세트로 담기] → 네 부위가 장바구니에, 세트 효과 켜짐 표시, 부위 탭 점 4개
    g.page.locator('.v2-setrow', has_text='레어 ① 포격 사령부').locator('.v2-setrow__take').click()
    g.wait(300)
    st = g.js("""const { setCounts } = await import('/js/engine_v2/sets_v2.js');
        const row = [...document.querySelectorAll('.v2-setrow')].find(r => r.textContent.includes('포격 사령부'));
        return { n: setCounts(gameState.getCartObjects()).mech_a, inRow: row.querySelectorAll('.v2-setrow__part.is-in').length,
                 on: row.querySelectorAll('.v2-setrow__bonus li.is-on').length,
                 dots: [...document.querySelectorAll('.v2-slottab__dot.is-on')].length };""")
    ctx.check(st['n'] == 4 and st['inRow'] == 4 and st['on'] >= 1 and st['dots'] == 4,
              '[세트로 담기]: 네 부위 한 번에 장바구니, 세트 효과 켜짐, 부위 탭 점 4개', str(st))
    g.shot('setui_sets', '.v2-lab__parts')
    # [세트 스킬] (11-05 피드백 6): 세트 줄마다 단추 → 세트 효과 + 네 파츠 스킬 창, Escape로 닫힘 (커먼 줄은 단추 없음)
    st = g.js("""const rows = [...document.querySelectorAll('#parts-grid-v2 .v2-setrow')];
        return { set: rows.filter(r => !r.classList.contains('is-common')).every(r => r.querySelector('.v2-setrow__skills')),
            common: rows.filter(r => r.classList.contains('is-common')).every(r => !r.querySelector('.v2-setrow__skills')) };""")
    g.page.locator('.v2-setrow:not(.is-common) .v2-setrow__skills').first.click()
    g.wait(200)
    pop = g.js("""const box = document.querySelector('.v2-setskill');
        if (!box) return null;
        return { title: box.querySelector('h3').textContent, bonus: box.querySelectorAll('.v2-setskill__bonus li').length,
            skills: [...box.querySelectorAll('.v2-setskill__list li b')].map(b => b.textContent.trim()),
            tags: [...box.querySelectorAll('.v2-setskill__list li em')].map(e => e.textContent) };""")
    ctx.check(st['set'] and st['common'] and pop and pop['bonus'] >= 2 and len(pop['skills']) == 4 and pop['tags'] == ['ULT', '2', '1', 'P']
              and all('스킬 없음' not in s for s in pop['skills']),
              '세트 탭 [세트 스킬]: 세트 효과 + 네 파츠 스킬(필살기·스킬 2·스킬 1·패시브) 창', str((st, pop)))
    g.shot('setui_setskill', '.v2-lab')
    g.key('Escape')
    g.wait(150)
    ctx.check(g.js("return !document.querySelector('.v2-setskill') && window.madOverlordGameV2.currentScreen === 'lab';"), '[세트 스킬] 창은 Escape로 닫히고 연구소 그대로')

    # 부위 탭: 모으는 세트의 짝이 맨 앞 + 테두리 + 그림 모서리 R①, 강화 칸 다시 보임
    g.page.click('.v2-slottab[data-slot="body"]')
    g.wait(200)
    st = g.js("""const c = document.querySelector('#parts-grid-v2 .v2-partcard');
        return { mate: c.classList.contains('is-setmate'), mark: c.querySelector('.v2-setmark') && c.querySelector('.v2-setmark').textContent,
                 label: c.querySelector('.v2-partcard__faction').textContent, upg: document.getElementById('lab-upgrade-v2').hidden,
                 marks: [...document.querySelectorAll('#parts-grid-v2 .v2-setmark')].map(m => m.textContent) };""")
    ctx.check(st['mate'] and st['mark'] == 'R①' and '모으는 중 4/4' in st['label'] and not st['upg']
              and 'U①' in st['marks'] and 'L②' in st['marks'],
              '몸통 탭: 모으는 세트 짝이 맨 앞(테두리·"모으는 중 4/4"), 그림 모서리 세트 표시(R①·U①·L② …)', str(st))
    g.shot('setui_body', '.v2-lab__parts')

    # 다른 세트 파츠를 고르면 그 세트가 모으는 세트가 됨 (팔: 레어 ② 돌격 강습대) → 팔 점만 켜짐
    g.page.click('.v2-slottab[data-slot="arm"]')
    g.wait(200)
    g.js("""const { setIdOf } = await import('/js/engine_v2/sets_v2.js');
        [...document.querySelectorAll('#parts-grid-v2 .v2-partcard')].find(c => c.textContent.includes('레어 ② 돌격 강습대')).click();""")
    g.wait(200)
    st = g.js("""const c = document.querySelector('#parts-grid-v2 .v2-partcard');
        const dots = [...document.querySelectorAll('.v2-slottab[data-slot]')].filter(t => t.querySelector('.v2-slottab__dot.is-on')).map(t => t.dataset.slot);
        return { first: c.querySelector('.v2-partcard__faction').textContent, dots };""")
    ctx.check('돌격 강습대' in st['first'] and st['dots'] == ['arm'], '다른 세트 파츠를 고르면 그 세트가 모으는 세트 (맨 앞·점은 팔만)', str(st))
