/* 모바일 웹 진입 안내. Android 앱은 자체 가로 고정·전체 화면을 사용한다. */
const IN_APP_BROWSERS = /Instagram|FBAN|FBAV|musical_ly|BytedanceWebview|TikTok|KAKAOTALK|NAVER.*inapp|\bLine\//i;
const DISMISS_KEY = 'madOverlord.mobileWeb.dismissed';

function initMobileWeb() {
    if (window.madOverlordApp === true) return;
    if (!matchMedia('(pointer: coarse)').matches && !(navigator.maxTouchPoints > 0)) return;

    const root = document.createElement('div');
    root.className = 'v2-mobile-web';
    root.innerHTML = `
        <div class="v2-mobile-web__portrait" hidden role="dialog" aria-modal="true" aria-label="화면 회전 안내">
            <svg class="v2-mobile-web__rotate" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                <rect x="20" y="13" width="24" height="38" rx="4" transform="rotate(30 32 32)"/>
                <path d="M8 28A25 25 0 0 1 45 10M45 3v8h-8M56 36A25 25 0 0 1 19 54M19 61v-8h8"/>
            </svg>
            <h2>가로로 돌려 주세요</h2>
            <p>매드 오버로드는 가로 화면으로 즐길 수 있어요.</p>
        </div>`;
    document.body.append(root);
    const portrait = root.querySelector('.v2-mobile-web__portrait');
    const battleScreen = document.getElementById('screen-battle-v2');
    const updateOrientation = () => {
        portrait.hidden = window.innerHeight <= window.innerWidth;
        // 기존 HUD를 통해 시간·소리·일시정지 화면을 함께 멈춘다. 자동 재개하지 않는다.
        if (!portrait.hidden && battleScreen?.classList.contains('active')
            && document.getElementById('pause-overlay-v2')?.hidden) {
            document.getElementById('btn-pause-v2')?.click();
        }
    };
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    if (battleScreen) new MutationObserver(updateOrientation).observe(battleScreen, { attributes: true, attributeFilter: ['class'] });
    updateOrientation();

    const target = document.documentElement;
    const requestFullscreen = target.requestFullscreen || target.webkitRequestFullscreen;
    if (requestFullscreen) {
        const buttons = [root, portrait].map(parent => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'v2-mobile-web__fullscreen';
            button.textContent = '전체 화면';
            button.addEventListener('click', async () => {
                try {
                    await requestFullscreen.call(target);
                    await screen.orientation?.lock?.('landscape');
                } catch (_) { /* 전체 화면·방향 잠금을 지원하지 않거나 거부하면 그대로 둔다. */ }
            });
            parent.append(button);
            return button;
        });
        const updateFullscreen = () => {
            const fullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
            buttons[0].hidden = fullscreen || !portrait.hidden;
            buttons[1].hidden = fullscreen;
        };
        window.addEventListener('resize', updateFullscreen);
        window.addEventListener('orientationchange', updateFullscreen);
        document.addEventListener('fullscreenchange', updateFullscreen);
        document.addEventListener('webkitfullscreenchange', updateFullscreen);
        updateFullscreen();
    }

    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { /* 저장 차단 환경 */ }
    const ua = navigator.userAgent;
    if (IN_APP_BROWSERS.test(ua) && !dismissed) {
        const banner = document.createElement('div');
        banner.className = 'v2-mobile-web__banner';
        banner.setAttribute('role', 'note');
        const message = document.createElement('span');
        message.textContent = '앱 안 브라우저에서는 저장이 지워질 수 있어요. 크롬·사파리로 열어 주세요.';
        banner.append(message);
        if (/KAKAOTALK/i.test(ua) || /Android/i.test(ua)) {
            const link = document.createElement('a');
            link.className = 'v2-mobile-web__external';
            if (/KAKAOTALK/i.test(ua)) {
                link.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
                link.textContent = '다른 브라우저로 열기';
            } else {
                link.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=${location.protocol.slice(0, -1)};package=com.android.chrome;end`;
                link.textContent = '크롬으로 열기';
            }
            banner.append(link);
        } else {
            const hint = document.createElement('span');
            hint.textContent = '오른쪽 위 ··· 메뉴 → 다른 브라우저로 열기';
            banner.append(hint);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'v2-mobile-web__close';
        close.textContent = '×';
        close.setAttribute('aria-label', '앱 안 브라우저 안내 닫기');
        close.addEventListener('click', () => {
            banner.hidden = true;
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (_) { /* 저장 차단 환경 */ }
        });
        banner.append(close);
        root.append(banner);
    }
}

initMobileWeb();
