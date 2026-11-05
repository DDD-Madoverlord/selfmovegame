"""휴대폰 배치 (Q-015 모바일 가독성 — 메인 시안 B · 전투 시안 A): 휴대폰·태블릿(손가락이 주 입력)이면 자동으로 켜지고, PC는 창 크기와 상관없이 그대로 (D-099)."""

# 보이는 글자마다 실제 화면 크기(계산된 글자 크기 × 화면 위 크기 / 배치 크기 — 게임 판 배율·zoom 모두 반영)를 재서 11px보다 작은 글자 수 (MD/화면UI.MD 2-2 측정과 같은 방식)
SMALL_TEXT = """(sel) => {
    let all = 0, small = 0;
    const root = document.querySelector(sel);
    if (!root) return { all: -1, small: -1 };
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
        const t = n.textContent.replace(/\\s+/g, '');
        const el = n.parentElement;
        if (!t || !el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        const r = document.createRange(); r.selectNodeContents(n); const rr = r.getBoundingClientRect();
        if (rr.width < 1 || rr.bottom < 0 || rr.top > innerHeight || rr.right < 0 || rr.left > innerWidth) continue;   // 밀어야 보이는 글자는 뺌
        const ratio = el.offsetHeight ? el.getBoundingClientRect().height / el.offsetHeight : 1;
        if (parseFloat(getComputedStyle(el).fontSize) === 0) continue;   // 글자 크기 0 = 숨긴 글 (CSS ::after로 바꿔 쓴 단추 이름)
        all += t.length;
        if (parseFloat(getComputedStyle(el).fontSize) * ratio < 10.5) small += t.length;
    }
    return { all, small };
}"""
# 화면 안에 다 들어오는가 (창 폭·높이 밖으로 넘치지 않음)
INSIDE = "(sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }"


def run(ctx):
    g = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    g.enter_v2()
    vis = "const vis = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; };"

    # ---- 메인 (시안 B) ----
    st = g.js(vis + """return { mobile: document.body.classList.contains('v2-mobile'),
        rail: ['#btn-rail-select-v2', '#btn-rail-lab-v2', '#btn-rail-shop-v2', '#btn-rail-support-v2', '#btn-rail-pets-v2'].every(vis),
        pcButtons: ['#btn-to-lab-v2', '#btn-to-select-v2', '#menu-callouts-v2 li', '#menu-statusbar-v2'].some(vis),
        card: document.getElementById('menu-stage-card-v2').innerText, sortie: document.getElementById('btn-to-battle-v2').innerText.trim(),
        radar: vis('.v2-smap'), running: window.madOverlordGameV2.menuController.stageMap.active,
        width: document.getElementById('screen-menu-v2').getBoundingClientRect().width,
        dialog: [...document.querySelectorAll('[role="dialog"]')].some(d => d.getClientRects().length), partsBtn: !!document.getElementById('btn-menu-parts-v2') };""")
    ctx.check(not st['dialog'] and not st['partsBtn'], '메인: 열린 창 없음 · [파츠·스킬] 단추 없음 (11-04 디자인 제안 — 화면에 바로)', str(st))
    ctx.check(st['mobile'], '휴대폰(터치) 가로 800×360: 휴대폰 배치 켜짐 (body.v2-mobile)')
    ctx.check(st['rail'] and not st['pcButtons'], '메인: 왼쪽 메뉴 줄 5개, PC 단추·부위 설명·상태 줄 숨김', str(st))
    ctx.check('1-1' in st['card'] and '박살 난 연구소' in st['card'] and '스테이지 선택' in st['card'], '메인: 스테이지 카드 (1-1 박살 난 연구소)', st['card'])
    ctx.check(st['sortie'] == '출격', '메인: 출격 단추는 한글 한 단어', st['sortie'])
    ctx.check(not st['radar'] and not st['running'], '메인: 지도는 접혀 있고 멈춤')
    ctx.check(abs(st['width'] - 800) < 2, '메인: 창 전체 폭 사용 (20:9 양옆 빈칸 없음)', str(st['width']))
    t = g.page.evaluate(SMALL_TEXT, '#screen-menu-v2')
    ctx.check(t['all'] < 230 and t['small'] <= t['all'] * 0.05, '메인: 보이는 글자 230자 미만(파츠 4칸 포함), 실제 11px 미만 5% 이하 (예전 497자 · 87%)', str(t))
    g.shot('mobile_menu')

    # 스테이지 선택 = 지도 전체 화면 → 닫기 (D-104)
    g.page.click('#menu-stage-card-v2 .v2-mstage__pick')
    g.wait(300)
    st = g.js(vis + "return { radar: vis('.v2-smap'), running: window.madOverlordGameV2.menuController.stageMap.active, w: document.querySelector('.v2-smap').getBoundingClientRect().width, tabs: !!document.querySelector('.v2-zonetab'), dots: document.querySelectorAll('.v2-smap__dots i').length };")
    ctx.check(st['radar'] and st['running'] and st['w'] > 600 and not st['tabs'] and st['dots'] == 10, '스테이지 선택: 지도가 전체 화면으로 열리고 움직임 (구역 번호 탭 없음, 아래 점 10개)', str(st))
    g.shot('mobile_stages')
    g.page.click('#btn-radar-close-v2')
    g.wait(200)
    ctx.check(g.js(vis + "return !vis('.v2-smap') && !window.madOverlordGameV2.menuController.stageMap.active;"), '스테이지 선택: 닫으면 접히고 멈춤')

    # 파츠 4칸 (머리·팔·몸통·다리): 화면 아래에 바로, 능력치는 캐릭터 오른쪽 세로 (11-04 디자인 제안)
    st = g.js(vis + """const rows = [...document.querySelectorAll('#menu-parts-list-v2 li')];
        const r = s => document.querySelector(s).getBoundingClientRect();
        const stats = [...document.querySelectorAll('#menu-stats-v2 > div')].map(n => n.getBoundingClientRect());
        return { rows: rows.map(li => li.innerText.replace(/\\s+/g, ' ')), shown: rows.every(li => li.getClientRects().length),
            column: stats.length === 4 && stats.every((b, i) => !i || (Math.abs(b.left - stats[0].left) < 2 && b.top > stats[i - 1].top)),
            right: stats[0].left > r('#menu-sprite-canvas-v2').left };""")
    ctx.check(len(st['rows']) == 4 and st['shown'] and '팔 · 스킬 1' in st['rows'][1] and '연타 러시' in st['rows'][1], '메인: 파츠 4칸이 화면에 바로 (부위·역할 · 파츠 이름 · 스킬)', str(st['rows']))
    ctx.check(st['column'] and st['right'], '메인: 능력치 4칸은 캐릭터 오른쪽에 세로로', str(st))
    g.shot('mobile_parts')

    # 메뉴 줄: 캐릭터 → 선택창, 돌아와서 몸통 없는 캐릭터로 출격하면 알림
    g.page.click('#btn-rail-select-v2')
    g.wait(400)
    ctx.check(g.js("return window.madOverlordGameV2.currentScreen;") == 'select', '메뉴 줄 캐릭터 → 캐릭터 선택창')
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- 전투 (시안 A) ----
    g.page.click('#btn-to-battle-v2')
    g.wait(5500)
    st = g.js(vis + """const r = s => document.querySelector(s).getBoundingClientRect();
        return { active: window.madOverlordGameV2.currentScreen === 'battle',
            hidden: ['#hud-name-v2', '#monster-state-text-v2', '.v2-log', '.v2-skill-name', '#battle-distance-v2', '.v2-skill kbd'].filter(vis),
            badge: vis('#hud-state-badge-v2'), hp: document.getElementById('hud-hp-text-v2').innerText.trim(),
            skill: r('.v2-skill:not(.v2-skill--ult)').width, ult: r('.v2-skill--ult').width, pause: r('#btn-pause-v2').height };""")
    ctx.check(st['active'], '출격 단추 → 전투')
    ctx.check(not st['hidden'], '전투: 이름·상태 글·전황 문장·스킬 이름·거리·단축키 숨김', str(st['hidden']))
    ctx.check(st['badge'] and st['hp'] == '3,300', '전투: 초상화 옆 상태 아이콘 + 체력 숫자만', str(st))
    ctx.check(st['skill'] >= 54 and st['ult'] >= 70 and st['pause'] >= 34, '전투: 스킬 약 56px·필살기 약 72px·일시정지 약 36px (실제 크기)', str(st))
    t = g.page.evaluate(SMALL_TEXT, '#battle-hud-v2')
    ctx.check(t['all'] < 60 and t['small'] <= t['all'] * 0.05, '전투 HUD: 보이는 글자 60자 미만, 실제 11px 미만 5% 이하 (예전 196자 · 100%)', str(t))
    g.shot('mobile_battle')

    # 전투 결과: 두 칸 + 아래 단추 줄이 화면 안에
    g.js("b.stats.time = 80; b.finishBattle(true);")
    g.wait(3200)
    t = g.page.evaluate(SMALL_TEXT, '.v2-result')
    ctx.check(t['all'] > 40 and t['small'] <= t['all'] * 0.05 and g.page.evaluate(INSIDE, '.v2-result__actions'),
              '결과 화면: 실제 11px 미만 5% 이하, 단추 줄이 화면 안 (예전 88%)', str(t))
    g.shot('mobile_result')
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- 연구소: 실제 크기 두 칸 ----
    g.js("window.madOverlordGameV2.switchScreen('lab');")
    g.wait(900)
    st = g.js(vis + """const tf = getComputedStyle(document.getElementById('screen-lab-v2')).transform;
        return { tf, parts: vis('#parts-grid-v2 .v2-partcard'), skills: vis('#lab-skills-v2'), btn: vis('#btn-lab-skills-v2') };""")
    t = g.page.evaluate(SMALL_TEXT, '#screen-lab-v2')
    ctx.check(st['tf'] == 'none' and st['parts'] and not st['skills'] and st['btn'] and g.page.evaluate(INSIDE, '#btn-equip-confirm-v2')
              and g.page.evaluate(INSIDE, '#btn-upgrade-v2'), '연구소: 게임 판 배율 없이 실제 크기 · 파츠 카드 · 개조 확정·강화 단추가 화면 안', str(st))
    ctx.check(t['all'] > 150 and t['small'] <= t['all'] * 0.1, '연구소: 실제 11px 미만 10% 이하 (예전 99%)', str(t))
    st = g.js("""const r = s => document.querySelector(s).getBoundingClientRect();
        const tabs = [...document.querySelectorAll('#screen-lab-v2 .v2-slottab')].map(t => t.getBoundingClientRect());
        const others = [...document.querySelectorAll('#parts-grid-v2 .v2-partcard:not(.is-selected)')].map(c => c.getBoundingClientRect().height);
        const parts = r('#screen-lab-v2 .v2-lab__parts'), reset = r('#btn-cart-reset-v2'), ok = r('#btn-equip-confirm-v2'), upg = r('#lab-upgrade-v2');
        return { vertical: tabs.length === 5 && tabs.every((t, i) => !i || (Math.abs(t.left - tabs[0].left) < 2 && t.top > tabs[i - 1].top)),
            totals: document.querySelectorAll('#parts-grid-v2 .v2-partcard.is-selected .v2-partcard__totals > div').length,
            compact: others.length > 0 && Math.max(...others) < 60,
            reset: reset.top < parts.top + 40 && reset.right > parts.right - 40,
            confirm: ok.top >= upg.top - 2 && ok.bottom <= upg.bottom + 2 && ok.right > upg.right - 60,
            cart: getComputedStyle(document.querySelector('#screen-lab-v2 .v2-lab__cart')).display };""")
    ctx.check(st['vertical'] and st['totals'] == 4 and st['compact'], '연구소: 부위 탭 세로 · 고른 파츠 카드에 개조 후 능력치 4칸 · 나머지 파츠는 한 줄 (11-04 디자인 제안)', str(st))
    ctx.check(st['reset'] and st['confirm'] and st['cart'] == 'none', '연구소: [초기화]는 파츠 칸 오른쪽 위, [확정]은 강화 줄 오른쪽, 아래 비용 줄 없음', str(st))
    # [확정] 자리 = 목록과 안 겹침 (부위 탭·세트 탭 모두 — 세트 탭은 강화 줄이 없어 단추가 목록을 덮던 것, 피드백 7) · 단추에 드는 DM (피드백 9)
    OVERLAP = """const ok = document.getElementById('btn-equip-confirm-v2').getBoundingClientRect(), grid = document.getElementById('parts-grid-v2').getBoundingClientRect();
        return { under: ok.top >= grid.bottom - 1, ok: [ok.top, ok.bottom].map(Math.round), grid: [grid.top, grid.bottom].map(Math.round) };"""
    st = g.js(OVERLAP)
    ctx.check(st['under'], '연구소 부위 탭: [확정] 단추가 파츠 목록 아래 (안 겹침)', str(st))
    cost0 = g.js("return document.getElementById('lab-confirm-cost-v2').textContent;")
    priced = g.js("""const c = [...document.querySelectorAll('#parts-grid-v2 .v2-partcard')].find(c => /DM/.test(c.querySelector('.v2-partcard__badge')?.textContent || ''));
        if (!c) return null; c.click(); return c.querySelector('.v2-partcard__badge').textContent.replace(/\s+/g, ' ').trim();""")
    g.wait(200)
    st = g.js("""const em = document.getElementById('lab-confirm-cost-v2'); return { text: em.textContent, shown: em.getClientRects().length > 0, cost: progress.cartCost() };""")
    ctx.check(cost0 == '' and priced and st['shown'] and st['cost'] > 0 and st['text'] == f"{st['cost']:,} DM",
              '연구소 [확정]: 바꾼 것이 없으면 금액 없음, DM 파츠를 담으면 단추 아래 줄에 드는 DM', f'{cost0!r} → {priced} → {st}')
    g.page.click('#screen-lab-v2 .v2-slottab[data-slot="set"]')
    g.wait(300)
    st = g.js(OVERLAP)
    ctx.check(st['under'], '연구소 세트 탭: [확정] 단추가 세트 목록 아래 (강화 줄이 없어도 자리 유지)', str(st))
    g.shot('mobile_lab_set')
    g.js("gameState.resetCartToEquipped(); window.madOverlordGameV2.labController?.refresh?.();")
    g.page.click('#screen-lab-v2 .v2-slottab[data-slot="head"]')
    g.wait(200)
    g.shot('mobile_lab')
    g.page.click('#btn-lab-skills-v2')
    g.wait(200)
    st = g.js(vis + "return { skills: vis('#lab-loadout-v2 li'), parts: getComputedStyle(document.querySelector('#screen-lab-v2 .v2-lab__parts')).visibility, pressed: document.getElementById('btn-lab-skills-v2').getAttribute('aria-pressed') };")
    ctx.check(st['skills'] and st['parts'] == 'hidden' and st['pressed'] == 'true', '연구소 [스킬]: 파츠 칸 자리에 스킬 구성', str(st))
    g.page.click('#btn-lab-skills-v2')

    # ---- 캐릭터 선택창: 한 화면 3장 ----
    g.js("window.madOverlordGameV2.switchScreen('select');")
    g.wait(900)
    n = g.js("return [...document.querySelectorAll('#select-grid-v2 .v2-charcard')].filter(c => { const r = c.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }).length;")
    # 캐릭터 그림(캔버스)이 그림 칸 밖으로 넘쳐 잘리지 않음 — 11-03 휴대폰에서 1.55배로 키운 머리가 잘렸던 것
    clip = g.js("""return [...document.querySelectorAll('#select-grid-v2 .v2-charcard__stage')].map(st => {
        const a = st.getBoundingClientRect(), c = st.querySelector('canvas').getBoundingClientRect();
        return c.top >= a.top - 1 && c.bottom <= a.bottom + 1 && c.left >= a.left - 1 && c.right <= a.right + 1 && a.height >= 80; }).every(Boolean);""")
    ctx.check(clip, '선택창: 캐릭터 그림이 칸 안에 통째로 (잘림 없음 · 높이 360px 화면에서도 칸 80px 이상)')
    t = g.page.evaluate(SMALL_TEXT, '#screen-select-v2')
    st = g.js(vis + """const lab = document.getElementById('btn-select-lab-v2').getBoundingClientRect();
        return { confirm: vis('#btn-select-confirm-v2'), info: vis('#select-info-v2'), labTop: lab.top < 60 && lab.width > 0, res: vis('#select-res-v2'),
            badge: getComputedStyle(document.querySelector('.v2-charcard.is-selected .v2-charcard__badge'), '::after').content,
            stats: document.querySelectorAll('#select-grid-v2 .v2-charcard.is-selected .v2-charcard__stats > div').length };""")
    ctx.check(n == 3 and not st['confirm'] and not st['info'] and st['labTop'] and st['res'], '선택창: 한 화면에 카드 3장 · 아래 줄·[결정] 없음 · [연구소]·재화는 위 줄', str((n, st)))
    ctx.check('선택' in st['badge'] and st['stats'] == 4, "선택창: 고른 카드 표시 '선택' · 능력치 4칸(사거리 포함)", str(st))
    ctx.check(t['all'] > 100 and t['small'] <= t['all'] * 0.1, '선택창: 실제 11px 미만 10% 이하 (예전 98%)', str(t))
    # 능력치 = 1000 단위 K 표기 (11-05 피드백 2) · 휴대폰 카드 캐릭터는 배율 상한을 올려 칸을 거의 채움 (피드백 3)
    st = g.js("""const { fmtK } = await import('/js/ui_v2/fmt_v2.js');
        const cases = [[999, '999'], [1000, '1K'], [3300, '3.3K'], [12345, '12.3K'], [99999, '99.9K'], [100000, '100K'], [123456, '123K'], [999999, '999K'], [1000000, '1M'], [1234567, '1.2M']];
        const bad = cases.filter(([n, s]) => fmtK(n) !== s).map(([n, s]) => `${n}→${fmtK(n)}≠${s}`);
        const card = document.querySelector('#select-grid-v2 .v2-charcard.is-selected');
        const hp = card.querySelector('.v2-charcard__stats dd').textContent;
        const rig = window.madOverlordGameV2.selectController?.cards?.find?.(c => c.el === card)?.rig;
        return { bad, hp, scale: rig ? rig.scale ?? rig.stageScale ?? null : null };""")
    ctx.check(not st['bad'] and st['hp'] == '3.3K', '선택창 능력치: 1000 단위 K (3,300 → 3.3K, 경계값 10개)', str(st))
    g.shot('mobile_select')
    # 잠긴 캐릭터를 누르면 잠깐 뜨는 알림 (아래 줄 대신), 고른 캐릭터를 누르면 [결정] 없이 바로 메인으로
    g.page.click('#select-grid-v2 .v2-charcard.is-locked')
    g.wait(200)
    toast = g.js("const t = document.getElementById('select-toast-v2'); return t.hidden ? '' : t.textContent;")
    ctx.check('별' in toast, '선택창: 잠긴 캐릭터를 누르면 잠깐 뜨는 알림 (별이 모자람)', toast)
    g.page.click('#select-grid-v2 .v2-charcard.is-selected')
    g.wait(500)
    ctx.check(g.js("return window.madOverlordGameV2.currentScreen;") == 'menu', '선택창: 카드를 누르면 [결정] 없이 바로 메인으로')
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- 화면 위 창: 설정 · 작전 지원 ----
    g.page.click('#btn-menu-settings-v2')
    g.wait(400)
    t = g.page.evaluate(SMALL_TEXT, '.v2-settings')
    ctx.check(t['all'] > 20 and t['small'] == 0 and g.page.evaluate(INSIDE, '.v2-settings__panel'), '설정 창: 실제 11px 이상 · 창이 화면 안 (예전 96%)', str(t))
    g.key('Escape')
    g.wait(300)
    g.js("document.querySelectorAll('.v2-settings').forEach(n => n.remove());")
    g.page.click('#btn-rail-support-v2')
    g.wait(400)
    t = g.page.evaluate(SMALL_TEXT, '.v2-growth')
    ctx.check(t['all'] > 50 and t['small'] <= t['all'] * 0.05 and g.page.evaluate(INSIDE, '.v2-growth__box'), '작전 지원 창: 실제 11px 미만 5% 이하 · 창이 화면 안 (예전 99%)', str(t))
    g.key('Escape')
    g.wait(300)

    # ---- 태블릿(터치)도 휴대폰 배치, 설정 'PC'로 고정하면 예전 배치 ----
    g.page.set_viewport_size({'width': 1180, 'height': 820})
    g.wait(300)
    ctx.check(g.js("return document.body.classList.contains('v2-mobile');"), '태블릿(터치) 1180×820: 휴대폰 배치')
    g.js("settings.set('layout', 'pc');")
    g.wait(200)
    ctx.check(not g.js("return document.body.classList.contains('v2-mobile');"), "설정 '화면 배치 → PC': 터치 기기에서도 PC 배치")
    g.js("settings.set('layout', 'auto');")

    # 휴대폰 웹: 숨겨 둔 '가로로 돌려 주세요' 창(role=dialog)이 있어도 첫 성장 뒤 소개 말풍선(방치 보상)이 뜸
    g.page.set_viewport_size({'width': 800, 'height': 360})
    g.wait(300)
    st = g.js("""const router = window.madOverlordGameV2;
        progress.loadTutorial(null); Object.assign(progress.tutorial, { status: 'complete', rewardClaimed: true });
        progress.stages = { '1-1': { stars: [true, true, true], cleared: true, bestTime: 1 } };   // 방치 보상은 1-1을 깨면 열림
        progress.loadOffline(null); progress.addOfflineTime(Date.now() - 600000, Date.now()); progress.save();
        document.querySelectorAll('.v2-coach').forEach(n => n.remove());
        router.switchScreen('menu'); router.tutorialUi.update();
        return { portrait: !!document.querySelector('.v2-mobile-web__portrait[role="dialog"][hidden]'), next: progress.tutorial.introSeen.join(), coach: document.querySelector('.v2-coach')?.textContent || '' };""")
    ctx.check(st['portrait'] and st['next'] == 'offline' and st['coach'], "휴대폰 웹: 숨긴 '가로로 돌려 주세요' 창이 있어도 소개 말풍선이 뜸", str(st))
    g.js("document.querySelectorAll('.v2-coach').forEach(n => n.remove());")

    # ---- PC(마우스)는 창 크기와 상관없이 예전 배치, 설정 '휴대폰'으로 고정하면 휴대폰 배치 ----
    p = ctx.game(fresh=True, viewport=(800, 360))
    p.enter_v2()
    ctx.check(not p.js("return document.body.classList.contains('v2-mobile');"), 'PC 작은 창 800×360: 예전 배치 그대로 (휴대폰 크기여도 마우스면 PC)')
    p.page.set_viewport_size({'width': 1300, 'height': 740})
    p.wait(300)
    st = p.js(vis + "return { mobile: document.body.classList.contains('v2-mobile'), lab: vis('#btn-to-lab-v2'), rail: vis('#btn-rail-lab-v2'), radar: vis('.v2-smap'), running: window.madOverlordGameV2.menuController.stageMap.active };")
    ctx.check(not st['mobile'] and st['lab'] and not st['rail'] and st['radar'] and st['running'], 'PC 1300×740: 예전 배치 (메뉴 줄 없음, 지도 보이고 움직임)', str(st))
    p.js("window.madOverlordGameV2.switchScreen('lab');")
    p.wait(600)
    st = p.js("""const probe = document.createElement('div'); probe.className = 'v2-result__head'; document.body.append(probe);
        const head = getComputedStyle(probe).display; probe.remove();
        return { lab: getComputedStyle(document.getElementById('screen-lab-v2')).transform, skillsBtn: getComputedStyle(document.getElementById('btn-lab-skills-v2')).display,
            info: getComputedStyle(document.querySelector('#screen-lab-v2 .v2-lab__info')).display, head };""")
    ctx.check(st['lab'].startswith('matrix') and st['skillsBtn'] == 'none' and st['info'] != 'contents' and st['head'] == 'contents',
              'PC: 연구소·결과 화면은 예전 그대로 (게임 판 배율, [스킬] 단추 없음, 결과 묶음 없음)', str(st))
    p.js("window.madOverlordGameV2.switchScreen('menu');")
    p.wait(300)
    p.js("settings.set('layout', 'mobile');")
    p.wait(200)
    ctx.check(p.js("return document.body.classList.contains('v2-mobile');"), "설정 '화면 배치 → 휴대폰': PC에서도 휴대폰 배치")
    p.js("settings.set('layout', 'auto');")
    p.wait(200)
    ctx.check(not p.js("return document.body.classList.contains('v2-mobile');"), "설정 '화면 배치 → 자동': PC는 다시 예전 배치")
