"""연구소 스킬 미리보기 (11-05 피드백 11번): 파츠를 고르면 캐릭터 칸에서 그 파츠 스킬이 재생 — 리그 확인 페이지 무대(rig_test.html?embed=1)를
iframe으로 띄워 같은 스킬 미리보기(skillPreviews.js)를 씀. 끝나면 사라지고 [▶ 스킬]로 다시. PC·휴대폰."""

STATE = """const box = document.querySelector('#screen-lab-v2 .v2-skillprev'); const lab = window.madOverlordGameV2.labController;
    return { shown: !!box && !box.hidden && box.classList.contains('is-on'), ready: !!lab.prevReady, done: lab.prevDone || null,
        name: box?.querySelector('.v2-skillprev__name')?.textContent || '', again: !!lab.replayBtn && !lab.replayBtn.hidden };"""


def pick_arm(g):
    """팔 탭에서 스킬 있는 파츠 카드(지금 고른 것 말고) 하나를 누름 → 그 파츠 id"""
    g.page.click('#screen-lab-v2 .v2-slottab[data-slot="arm"]')
    g.wait(300)
    return g.js("""const c = [...document.querySelectorAll('#parts-grid-v2 .v2-partcard:not(.is-selected)')].find(c => c.querySelector('.v2-partcard__skill em'));
        c.scrollIntoView({ block: 'center' }); return c.dataset.id;""")


def run(ctx):
    for name, kw in (('PC', {}), ('휴대폰', {'viewport': (800, 360), 'touch': True})):
        g = ctx.game(fresh=True, **kw)
        g.enter_v2()
        g.js("progress.unlockEverythingTemp(); window.madOverlordGameV2.switchScreen('lab');")
        g.wait(900)
        pid = pick_arm(g)
        g.page.click(f'#parts-grid-v2 .v2-partcard[data-id="{pid}"]')
        st = None
        for _ in range(40):   # 무대(리그 확인 페이지)를 처음 불러오는 데 시간이 걸림
            g.wait(250)
            st = g.js(STATE)
            if st['done']:
                break
        ctx.check(st['shown'] and st['ready'] and st['done'] and st['done']['ok'] and st['done']['part'] == pid,
                  f'{name}: 파츠를 고르면 캐릭터 칸에서 그 스킬 재생 (무대 준비 → 재생됨)', str(st))
        g.wait(900)
        g.shot(f'lab_skill_preview_{"pc" if name == "PC" else "mobile"}', '#screen-lab-v2')
        g.wait(4200)
        st = g.js(STATE)
        ctx.check(not st['shown'] and st['again'], f'{name}: 끝나면 사라지고 [▶ 스킬] 단추', str(st))
        g.js("window.madOverlordGameV2.labController.prevDone = null;")
        g.page.click('#screen-lab-v2 .v2-skillprev__again')
        g.wait(600)
        st = g.js(STATE)
        ctx.check(st['shown'] and st['done'] and st['done']['ok'], f'{name}: [▶ 스킬]로 다시 재생', str(st))
        g.page.click('#screen-lab-v2 .v2-slottab[data-slot="set"]')
        g.wait(200)
        ctx.check(g.js("return window.madOverlordGameV2.labController.replayBtn.hidden;"), f'{name}: 세트 탭에서는 [▶ 스킬] 숨김')
