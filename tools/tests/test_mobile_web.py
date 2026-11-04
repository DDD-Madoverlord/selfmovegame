"""모바일 웹 안내: 회전·일시정지·전체 화면·외부 브라우저 링크."""

ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'


def run(ctx):
    g = ctx.game(fresh=True)

    def open_page(ua=ANDROID, touch=True, app=False, script=''):
        context = g.browser.new_context(
            has_touch=touch, is_mobile=touch, user_agent=ua,
            viewport={'width': 390, 'height': 844})
        if app:
            context.add_init_script('window.madOverlordApp = true;')
        if script:
            context.add_init_script(script)
        page = context.new_page()
        page.on('pageerror', lambda e: g.errors.append('pageerror: ' + str(e)))
        page.on('console', g._console)
        page.goto(ctx.base + '/index.html?mobile=1&source=sns#entry', wait_until='domcontentloaded')
        page.evaluate("async () => { await import('/js/ui_v2/mobileWeb_v2.js'); }")
        return context, page

    context, page = open_page()
    original_page = g.page
    try:
        overlay = page.locator('.v2-mobile-web__portrait')
        ctx.check(overlay.is_visible() and '가로로 돌려 주세요' in overlay.inner_text(),
                  '터치 휴대폰 세로 화면 안내 표시')
        page.set_viewport_size({'width': 844, 'height': 390})
        overlay.wait_for(state='hidden')
        ctx.check(not overlay.is_visible(), '가로 회전 시 안내 숨김')
        g.page = page
        g.enter_v2()
        g.battle('mech', wait_ms=500)
        page.set_viewport_size({'width': 390, 'height': 844})
        overlay.wait_for(state='visible')
        ctx.check(g.js('return gameTime.paused;') and page.locator('#pause-overlay-v2').is_visible(),
                  '전투 중 세로 전환 시 기존 HUD로 일시정지')
        page.set_viewport_size({'width': 844, 'height': 390})
        overlay.wait_for(state='hidden')
        ctx.check(g.js('return gameTime.paused;'), '가로 복귀 후 자동 재개하지 않음')
        page.locator('#btn-resume-v2').click()
        ctx.check(g.js('return !gameTime.paused;'), '계속하기로 직접 재개')
    finally:
        g.page = original_page
        context.close()

    for label, options in [('Android 앱', {'app': True, 'ua': ANDROID + ' Instagram'}),
                           ('데스크톱', {'touch': False, 'ua': 'Mozilla/5.0 Instagram'})]:
        context, page = open_page(**options)
        try:
            ctx.check(page.locator('.v2-mobile-web').count() == 0,
                      label + '에서는 모바일 웹 UI를 만들지 않음')
        finally:
            context.close()

    for ua, kakao in [(ANDROID + ' Instagram', False), (ANDROID + ' KAKAOTALK', True),
                      (IPHONE + ' KAKAOTALK', True)]:
        context, page = open_page(ua=ua)
        try:
            banner = page.locator('.v2-mobile-web__banner')
            href = page.locator('.v2-mobile-web__external').get_attribute('href')
            expected = page.evaluate("""kakao => kakao
                ? 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href)
                : 'intent://' + location.host + location.pathname + location.search
                    + '#Intent;scheme=http;package=com.android.chrome;end'""", kakao)
            ctx.check(banner.is_visible() and href == expected,
                      ('카카오톡' if kakao else 'Instagram') + ' 안내와 외부 브라우저 주소')
            page.locator('.v2-mobile-web__close').click()
            ctx.check(not banner.is_visible(), '앱 안 브라우저 안내 닫기')
            page.reload(wait_until='domcontentloaded')
            page.evaluate("async () => { await import('/js/ui_v2/mobileWeb_v2.js'); }")
            ctx.check(page.locator('.v2-mobile-web__banner').count() == 0,
                      '같은 접속에서 새로고침해도 안내 숨김 유지')
        finally:
            context.close()

    context, page = open_page(ua=IPHONE + ' Instagram')
    try:
        ctx.check(page.locator('.v2-mobile-web__banner').is_visible()
                  and page.locator('.v2-mobile-web__external').count() == 0
                  and '오른쪽 위 ··· 메뉴 → 다른 브라우저로 열기'
                  in page.locator('.v2-mobile-web__banner').inner_text(),
                  '아이폰 Instagram은 메뉴로 여는 방법 표시')
    finally:
        context.close()

    context, page = open_page(script='''
        Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined });
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined });
    ''')
    try:
        ctx.check(page.locator('.v2-mobile-web__fullscreen').count() == 0,
                  'Fullscreen API가 없으면 전체 화면 버튼 없음')
    finally:
        context.close()

    context, page = open_page(script='''
        window.fullscreenCalls = [];
        Element.prototype.requestFullscreen = async function () {
            window.fullscreenCalls.push('fullscreen');
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this });
            document.dispatchEvent(new Event('fullscreenchange'));
        };
        screen.orientation.lock = async function (direction) {
            window.fullscreenCalls.push(direction);
            throw new Error('방향 잠금 미지원');
        };
    ''')
    try:
        ctx.check(page.locator('.v2-mobile-web__portrait .v2-mobile-web__fullscreen').is_visible()
                  and not page.locator('.v2-mobile-web > .v2-mobile-web__fullscreen').is_visible(),
                  '세로 안내 안에 전체 화면 버튼 표시')
        page.set_viewport_size({'width': 844, 'height': 390})
        button = page.locator('.v2-mobile-web > .v2-mobile-web__fullscreen')
        button.wait_for(state='visible')
        button.click()
        ctx.check(page.evaluate('window.fullscreenCalls') == ['fullscreen', 'landscape']
                  and page.locator('.v2-mobile-web__fullscreen:visible').count() == 0,
                  '전체 화면 다음 가로 잠금 시도, 잠금 거부 무시, 버튼 숨김')
        page.evaluate("""() => {
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
            document.dispatchEvent(new Event('fullscreenchange'));
        }""")
        ctx.check(button.is_visible(), '전체 화면 종료 시 버튼 다시 표시')
    finally:
        context.close()
