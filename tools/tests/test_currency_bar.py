"""재화 표시줄 (11-05 피드백 12번): 메인·캐릭터 선택·연구소·작전 지원·상점·휴대폰 지도 창이 같은 별·조각·코어·DM을 보여 주고, DM이 바뀌면 모두 함께 바뀜. 전투 화면은 HUD 그대로."""

READ = """const vis = el => el.getClientRects().length > 0;
    return [...document.querySelectorAll('[data-currency]')].filter(vis).map(box => ({
        dm: box.querySelector('.v2-chip--dm strong')?.textContent || '',
        res: (box.querySelector('.v2-chip--res')?.textContent || '').replace(/\\s+/g, ''),
        resShown: !!box.querySelector('.v2-chip--res') && vis(box.querySelector('.v2-chip--res')) }));"""


def same(rows, dm):
    return rows and all(r['dm'] == dm and r['res'] == rows[0]['res'] and r['resShown'] for r in rows)


def run(ctx):
    # ---- PC ----
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("gameState.darkMatter = 12345; gameState.notify();")
    seen = {}
    for screen in ('menu', 'select', 'lab'):
        g.js(f"window.madOverlordGameV2.switchScreen('{screen}');")
        g.wait(700)
        seen[screen] = g.js(READ)
    ok = all(same(rows, '12,345') for rows in seen.values()) and len({rows[0]['res'] for rows in seen.values()}) == 1
    ctx.check(ok, 'PC 메인·캐릭터 선택·연구소: 같은 재화 표시줄 (별·조각·코어 + DM 12,345 — 선택창에도 별·조각·코어)', str(seen))
    # DM이 바뀌면 지금 화면 표시줄이 바로 바뀜
    g.js("gameState.darkMatter = 777; gameState.notify();")
    g.wait(100)
    rows = g.js(READ)
    ctx.check(same(rows, '777'), '연구소에서 DM이 바뀌면 표시줄도 바로 (777)', str(rows))
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)
    g.js("const { openGrowthPanel } = await import('/js/ui_v2/growthUi_v2.js'); openGrowthPanel('modules');")
    g.wait(400)
    rows = g.js(READ)
    ctx.check(same(rows, '777') and len(rows) >= 2, '작전 지원 창 머리도 같은 표시줄', str(rows))
    g.key('Escape')
    g.wait(300)
    # 전투 화면: 표시줄 없음 (HUD의 DM 그대로)
    g.battle('mech', wait_ms=2500)
    rows = g.js(READ)
    ctx.check(not rows, '전투 화면에서는 재화 표시줄이 안 보임 (HUD 그대로)', str(rows))
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)
    ctx.check(g.js("const mo = document.querySelector('.v2-radar__money'); return !!mo && mo.getClientRects().length === 0;"), 'PC 메인 지도 칸에는 휴대폰용 재화 자리가 안 보임 (위 줄에 이미 있음)')
    g.js("window.madOverlordGameV2.switchScreen('menu');")

    # ---- 휴대폰: 지도 창은 위 줄을 가리므로 아래 줄에 같은 표시 ----
    p = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    p.enter_v2()
    p.js("gameState.darkMatter = 4321; gameState.notify();")
    p.wait(200)
    top = p.js(READ)
    p.page.click('#menu-stage-card-v2 .v2-mstage__pick')
    p.wait(400)
    st = p.js("""const mo = document.querySelector('.v2-radar__money'); const r = mo.getBoundingClientRect();
        return { shown: mo.getClientRects().length > 0, inside: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
            dm: mo.querySelector('.v2-chip--dm strong').textContent, res: mo.querySelector('.v2-chip--res').textContent.replace(/\\s+/g, '') };""")
    ctx.check(st['shown'] and st['inside'] and st['dm'] == '4,321' and top and st['res'] == top[0]['res'],
              '휴대폰 지도 창: 아래 줄에 메인 위 줄과 같은 재화 (4,321)', str((top, st)))
    p.shot('currency_map')
