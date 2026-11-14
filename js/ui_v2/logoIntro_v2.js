/* ==========================================================================
   PROJECT: MAD OVERLORD // 제작팀 로고 영상 (DDD · Deep Dark Dragon — 홍도도 제작, 4.5초 · 소리 없음)
   게임을 켜면 로딩과 같이 재생: 로딩 화면 위를 덮고, 영상이 끝나고 로딩도 끝나면 시작 화면으로 넘어감.
   화면이 가로면 1920×1080, 세로면 1080×1920 영상. 화면을 누르면 건너뜀.
   영상이 재생되지 않으면(자동 재생 막힘 · 파일 없음 · 4초 안에 시작 못 함 · 시작 뒤 6초 넘김) 그냥 넘어감 — 게임 시작을 막지 않음.
   로딩이 그림을 한꺼번에 받는 동안에는 영상 시작이 1초 넘게 늦을 수 있어 시작은 넉넉히 기다림.
   자동 검사·측정은 ?skipTitle=1로 건너뜀 (main_v2.js)
   ========================================================================== */

const SRC = {
    landscape: 'assets/video/logo_intro_landscape_1920x1080.mp4',
    portrait: 'assets/video/logo_intro_portrait_1080x1920.mp4'
};
const MAX_MS = 6000;      // 재생이 시작된 뒤: 영상 4.5초 + 여유. 넘기면 멈춘 것으로 보고 넘어감
const START_MS = 4000;    // 이 안에 재생이 시작되지 않으면 넘어감

/**
 * 로고 영상을 띄움. 영상이 끝나면(또는 건너뛰면) 끝나는 Promise — 값은 '덮개를 걷는 함수'.
 * 덮개는 다음 화면(시작 화면)을 깐 뒤에 걷어야 사이에 메뉴가 비치지 않음.
 */
export function playLogoIntro() {
    return new Promise(resolve => {
        const el = document.createElement('div');
        el.className = 'v2-logo-intro';
        const wide = window.innerWidth >= window.innerHeight;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.preload = 'auto';
        video.src = wide ? SRC.landscape : SRC.portrait;
        video.dataset.shape = wide ? 'landscape' : 'portrait';
        el.appendChild(video);
        document.body.appendChild(el);

        let over = false;
        const dismiss = () => {
            el.classList.add('is-leaving');
            setTimeout(() => el.remove(), 350);
        };
        const finish = () => {
            if (over) return;
            over = true;
            clearTimeout(maxT);
            clearInterval(startPoll);
            clearTimeout(startT);
            try { video.pause(); } catch (e) { /* 이미 멈춤 */ }
            resolve(dismiss);
        };
        let maxT = 0;
        const startT = setTimeout(() => { if (!(video.currentTime > 0)) finish(); }, START_MS);
        // 첫 장면이 실제로 나온 때부터 길이를 잼 ('playing'은 버퍼만 차도 오므로 currentTime으로 봄)
        const startPoll = setInterval(() => {
            if (!(video.currentTime > 0)) return;
            clearInterval(startPoll);
            maxT = setTimeout(finish, MAX_MS);
        }, 100);
        video.addEventListener('ended', finish);
        video.addEventListener('error', finish);
        el.addEventListener('click', finish);
        const p = video.play();
        if (p && p.catch) p.catch(finish);
    });
}
