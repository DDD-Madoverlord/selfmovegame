"""게임 시작 화면 · 계정 연동 화면 (D-119 ③ 단계 — 기획서 1·2번, D-106).
- 로딩 뒤 시작 화면: 로고 · TOUCH TO START · 캐릭터 줄(숨김 그룹은 ?) · 계정 줄 · 버전. 처음 실행은 약관 동의 한 번 → 메뉴, 다음부터 바로
- 계정 화면: 게스트(기록 요약 · 연동 보상 · 동의 2개가 있어야 구글 단추) → 연결 중 → 연동됨 / 기록이 둘(하나 고르고 한 번 더 확인) / 실패
- 실제 구글 로그인은 아직 없어 '준비 중', 로컬 ?mockAuth=…로 흐름 확인. 1-5를 처음 깨고 메뉴로 오면 한 번만 안내
다른 검사는 common.py가 ?skipTitle=1로 건너뜀 — 여기서만 시작 화면을 켬."""
import time


def open_page(ctx, query='', touch=False, viewport=(1300, 740)):
    g = ctx.game(fresh=True, viewport=viewport, touch=touch)
    g.page.goto(f'{g.base}/index.html?openGroups=0{query}&t={time.time()}')
    g.page.click('#btn-select-v2')
    g.page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    g.page.wait_for_selector('.v2-title', timeout=10000)
    g.wait(400)
    return g


def check_logo(ctx, viewport, shape):
    """제작팀 로고 영상: 로딩과 같이 뜨고, 끝나면 시작 화면으로 (누르면 건너뜀)"""
    g = ctx.game(fresh=True, viewport=viewport)
    g.page.goto(f'{g.base}/index.html?openGroups=0&t={time.time()}')
    g.page.click('#btn-select-v2')
    g.page.wait_for_selector('.v2-logo-intro video', timeout=10000)
    g.page.wait_for_function("document.querySelector('.v2-logo-intro video')?.currentTime > 0.8", timeout=6000)   # 로딩과 겹치면 시작이 1초쯤 늦음
    st = g.js("""const v = document.querySelector('.v2-logo-intro video');
        return { shape: v.dataset.shape, src: v.getAttribute('src'), t: v.currentTime, w: v.videoWidth, h: v.videoHeight, muted: v.muted, title: !!document.querySelector('.v2-title') };""")
    ctx.check(st['shape'] == shape and shape in st['src'] and st['t'] > 0 and st['w'] > 0 and st['muted'] and not st['title'],
              f'로고 영상({shape}): 켜자마자 재생 · 소리 없음 · 그동안 시작 화면은 아직 없음', str(st))
    g.shot(f'title_logo_{shape}')
    return g


def run(ctx):
    # ===== 0. 제작팀 로고 영상 (DDD) =====
    g = check_logo(ctx, (1300, 740), 'landscape')
    g.page.wait_for_selector('.v2-title', timeout=12000)
    g.wait(600)
    ctx.check(g.js("return !document.querySelector('.v2-logo-intro');"), '영상이 끝나면 로고가 걷히고 시작 화면')
    g = check_logo(ctx, (420, 800), 'portrait')
    g.page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    t0 = time.time()
    g.page.mouse.click(200, 300)
    g.page.wait_for_selector('.v2-title', timeout=3000)
    ctx.check(time.time() - t0 < 2, '로딩이 끝난 뒤 화면을 누르면 영상을 건너뛰고 바로 시작 화면')
    g.js("document.querySelector('.v2-logo-intro')?.remove(); const { playLogoIntro } = await import('/js/ui_v2/logoIntro_v2.js'); const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = () => Promise.reject(new Error('blocked')); window.__logoT = performance.now(); playLogoIntro().then(d => { window.__logoMs = performance.now() - window.__logoT; d(); HTMLMediaElement.prototype.play = o; });")
    g.wait(600)
    ctx.check((g.js("return window.__logoMs;") or 9999) < 300, '자동 재생이 막히면 기다리지 않고 바로 넘어감 (게임 시작을 막지 않음)')

    # ===== 1. 처음 실행: 시작 화면 → 약관 동의 → 메뉴 =====
    g = open_page(ctx)
    st = g.js("""const t = document.querySelector('.v2-title');
        return { logo: t.querySelector('.v2-title__logo').textContent, tap: t.querySelector('.v2-title__tap').textContent,
            faces: t.querySelectorAll('.v2-title__face').length, secret: t.querySelectorAll('.v2-title__face.is-secret').length,
            acct: t.querySelector('.v2-title__acct').textContent, ver: t.querySelector('.v2-title__ver').textContent };""")
    ctx.check('OVERLORD' in st['logo'] and 'TOUCH TO START' in st['tap'] and st['faces'] == 10 and st['secret'] == 4,
              '시작 화면: 로고 · TOUCH TO START · 캐릭터 10명 줄(숨김 그룹 4명은 ?)', str(st))
    ctx.check('게스트' in st['acct'] and st['ver'].startswith('v0.'), '왼쪽 아래 계정 줄 "게스트 · 계정 연동하기" · 오른쪽 아래 버전', str(st))
    g.shot('title_start')
    g.page.click('.v2-title__tap')
    g.wait(300)
    st = g.js("const c = document.querySelector('.v2-title__consent'); return { shown: !c.hidden, disabled: c.querySelector('[data-act=agree]').disabled };")
    ctx.check(st['shown'] and st['disabled'], '처음 실행: 화면을 누르면 약관 동의 창, 두 개 다 체크해야 시작 단추가 켜짐', str(st))
    g.page.check('.v2-title__consent [data-agree="0"]')
    g.page.check('.v2-title__consent [data-agree="1"]')
    g.page.click('.v2-title__consent [data-act=agree]')
    g.wait(700)
    st = g.js("return { gone: !document.querySelector('.v2-title'), menu: document.getElementById('screen-menu-v2').classList.contains('active'), consent: !!localStorage.getItem('mo_v2_consent') };")
    ctx.check(st['gone'] and st['menu'] and st['consent'], '동의하고 시작 → 시작 화면이 사라지고 메뉴, 동의는 저장', str(st))

    # 다시 켜면: 동의 없이 바로
    g.page.reload()
    g.page.click('#btn-select-v2')
    g.page.wait_for_selector('.v2-title', timeout=30000)
    g.page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    g.page.click('.v2-title__tap')
    g.wait(700)
    ctx.check(g.js("return !document.querySelector('.v2-title');"), '두 번째부터는 화면을 누르면 바로 메뉴 (동의 창 없음)')

    # ===== 2. 계정 화면: 실제 연동 전에는 '준비 중' =====
    g.js("const acc = await import('/js/ui_v2/account_v2.js'); acc.openAccount('settings');")
    g.wait(300)
    st = g.js("""const p = document.querySelector('.v2-account__panel');
        return { state: p.dataset.state, rec: p.querySelector('.v2-account__rec')?.textContent || '', reward: !!p.querySelector('.v2-account__reward'),
            google: p.querySelector('.v2-account__google').disabled };""")
    ctx.check(st['state'] == 'guest' and '구역 1' in st['rec'] and st['reward'] and st['google'],
              '계정 화면(게스트): 기록 요약 · 연동 보상 DM 5,000 · 동의 전엔 구글 단추 잠김', str(st))
    g.page.check('.v2-account [data-agree="0"]')
    g.page.check('.v2-account [data-agree="1"]')
    g.page.click('.v2-account [data-act=link]')
    g.wait(500)
    st = g.js("return document.querySelector('.v2-account__panel').textContent;")
    ctx.check('준비 중' in st, "진짜 구글 연결 전: '구글 연동은 준비 중이에요' (게스트로 계속)", st[:120])
    g.js("const acc = await import('/js/ui_v2/account_v2.js'); acc.closeAccount();")

    # ===== 3. 가짜 연동 흐름 (?mockAuth) =====
    g = open_page(ctx, '&mockAuth=linked&skipConsent=1')
    g.js("localStorage.setItem('mo_v2_consent', '{\"at\":1}');")
    g.page.click('.v2-title__acct')
    g.wait(300)
    g.page.check('.v2-account [data-agree="0"]')
    g.page.check('.v2-account [data-agree="1"]')
    dm0 = g.js("return gameState.darkMatter;")
    g.page.click('.v2-account [data-act=link]')
    g.wait(1200)
    st = g.js("""const p = document.querySelector('.v2-account__panel'); const { auth } = await import('/js/engine_v2/auth_v2.js');
        return { state: p.dataset.state, text: p.textContent, acct: document.querySelector('.v2-title__acct').textContent, dm: gameState.darkMatter, a: auth.state() };""")
    ctx.check(st['state'] == 'linked' and 'player****@gmail.com' in st['text'] and st['dm'] - dm0 == 5000 and st['a']['status'] == 'linked',
              '연동 성공: 연동됨 화면 · 연동 보상 DM 5,000 · 계정 상태 저장', str({k: st[k] for k in ('state', 'dm', 'a')}))
    ctx.check('player****' in st['acct'], '시작 화면 계정 줄도 메일 앞부분으로 바뀜', st['acct'])
    g.shot('account_linked')
    g.page.click('.v2-account [data-act=delete]')
    g.wait(200)
    first = g.js("return document.querySelector('.v2-account__panel').dataset.state;")
    g.page.click('.v2-account [data-act=delete]')
    g.wait(300)
    st = g.js("const { auth } = await import('/js/engine_v2/auth_v2.js'); return { state: document.querySelector('.v2-account__panel').dataset.state, a: auth.state().status };")
    ctx.check(first == 'linked' and st['state'] == 'guest' and st['a'] == 'guest', '계정 삭제는 두 번 눌러야 됨 → 게스트로', str(st))

    g = open_page(ctx, '&mockAuth=conflict')
    g.js("const acc = await import('/js/ui_v2/account_v2.js'); acc.openAccount('settings');")
    g.page.check('.v2-account [data-agree="0"]')
    g.page.check('.v2-account [data-agree="1"]')
    g.page.click('.v2-account [data-act=link]')
    g.wait(1200)
    st = g.js("const p = document.querySelector('.v2-account__panel'); return { state: p.dataset.state, cards: p.querySelectorAll('.v2-account__card').length, go: p.querySelector('[data-act=choose]').disabled };")
    ctx.check(st['state'] == 'conflict' and st['cards'] == 2 and st['go'], '기록이 둘: 이 기기 / 구글 계정 카드 2장, 고르기 전엔 계속 단추 잠김', str(st))
    g.page.click('.v2-account__card[data-side="server"]')
    g.page.click('.v2-account [data-act=choose]')
    warn = g.js("return document.querySelector('.v2-account__warn').textContent;")
    g.page.click('.v2-account [data-act=choose]')
    g.wait(300)
    st = g.js("return document.querySelector('.v2-account__panel').dataset.state;")
    ctx.check('지워집니다' in warn and '한 번 더' in warn and st == 'linked', '하나 고르고 한 번 더 확인(고르지 않은 기록은 지워진다는 안내) → 연동됨', warn)
    g.shot('account_conflict')

    g = open_page(ctx, '&mockAuth=error-net')
    g.js("const acc = await import('/js/ui_v2/account_v2.js'); acc.openAccount('settings');")
    g.page.check('.v2-account [data-agree="0"]')
    g.page.check('.v2-account [data-agree="1"]')
    g.page.click('.v2-account [data-act=link]')
    g.wait(1200)
    st = g.js("const p = document.querySelector('.v2-account__panel'); return { state: p.dataset.state, text: p.textContent };")
    ctx.check(st['state'] == 'error' and '인터넷에 연결되지 않았어요' in st['text'], '실패: 이유별 한 줄 (인터넷 없음), 게스트 기록 그대로', st['text'][:100])

    # ===== 4. 1-5를 처음 깨고 메뉴로 오면 한 번만 안내 =====
    g = ctx.game(fresh=True)
    g.page.goto(f'{g.base}/index.html?openGroups=1&t={time.time()}')   # 시작 화면은 켜되 바로 넘김
    g.page.click('#btn-select-v2')
    g.page.wait_for_selector('.v2-title', timeout=30000)
    g.page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    g.js("localStorage.setItem('mo_v2_consent', '{\"at\":1}');")
    g.page.click('.v2-title__tap')
    g.wait(600)
    g.js("""const S = await import('/js/engine_v2/stages_v2.js'); for (const s of S.STAGES) { progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 }; if (s.id === '1-5') break; }
        window.madOverlordGameV2.switchScreen('lab'); window.madOverlordGameV2.switchScreen('menu');""")
    g.wait(400)
    first = g.js("const p = document.querySelector('.v2-account__panel'); return p ? p.textContent : '';")
    g.js("const acc = await import('/js/ui_v2/account_v2.js'); acc.closeAccount(); window.madOverlordGameV2.switchScreen('lab'); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    again = g.js("return !!document.querySelector('.v2-account');")
    ctx.check('기록을 안전하게 지키세요' in first and '나중에' in first and not again, '1-5를 깬 뒤 메뉴로 오면 연동 안내 한 번(나중에) · 다시 안 뜸', first[:80])

    # ===== 5. 휴대폰 가로 화면 =====
    p = open_page(ctx, '', touch=True, viewport=(800, 360))
    st = p.js("""const t = document.querySelector('.v2-title'), r = t.getBoundingClientRect(), l = t.querySelector('.v2-title__lineup').getBoundingClientRect(),
        a = t.querySelector('.v2-title__acct').getBoundingClientRect(), tap = t.querySelector('.v2-title__tap').getBoundingClientRect(),
        kr = t.querySelector('.v2-title__logo .kr').getBoundingClientRect();
        return { full: r.width >= 799 && r.height >= 359, lineIn: l.left >= 0 && l.right <= 800, tapAbove: tap.bottom <= l.top, logoAbove: kr.bottom <= tap.top };""")
    ctx.check(st['full'] and st['lineIn'] and st['tapAbove'] and st['logoAbove'], '휴대폰 가로(800×360): 화면 전체, 캐릭터 줄이 화면 안, 로고 < TOUCH TO START < 캐릭터 줄 (겹치지 않음)', str(st))
    p.shot('title_mobile')
