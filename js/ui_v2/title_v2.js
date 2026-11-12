/* ==========================================================================
   PROJECT: MAD OVERLORD // 게임 시작 화면 (D-119 1번, 시안 https://claude.ai/artifact/Xjf9JxAjYV3sgowDKApbTu 01 탭)
   로딩이 끝나면 메인 메뉴 위에 덮어 보여 줌: 대표 그림 · 로고 · TOUCH TO START · 캐릭터 줄(공개 전 그룹은 실루엣 ?) ·
   왼쪽 아래 계정 줄(누르면 계정 연동 화면) · 오른쪽 아래 버전. 화면 아무 곳이나 누르면 처음 실행일 때만 약관 동의를 한 번 받고 메뉴로.
   첫 터치에서 소리 잠금을 풀어 메뉴 배경음이 바로 나옴. 처음 실행은 로그인 없이 게스트 (D-106).
   자동 검사·측정은 ?skipTitle=1(로컬 주소만)로 건너뜀 (tools/tests/common.py).
   대표 그림·로고는 아직 임시(스토리 1 연구소 그림 + 글자 로고) — Gemini 그림이 오면 바꿈 (Q-037)
   ========================================================================== */

import { VERSION, BUILD } from '../version_v2.js';
import * as saveStore from '../engine_v2/saveStore_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { isCharacterReleased } from '../engine_v2/contentSchedule_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { track } from '../engine_v2/analytics_v2.js';
import { auth } from '../engine_v2/auth_v2.js';
import { settings } from '../engine_v2/settings_v2.js';
import { openAccount } from './account_v2.js';

const CONSENT_KEY = 'mo_v2_consent';   // 약관·개인정보 동의 (한 번) — 저장 백업에도 들어감
const KEY_ART = 'assets/sprites/intro/st1/A.webp';

function localHost() {
    return typeof location !== 'undefined' && ['localhost', '127.0.0.1', ''].includes(location.hostname);
}

/** 시작 화면을 건너뛸지: 로컬 주소의 ?skipTitle=1 (자동 검사 · 측정) */
export function skipTitle() {
    return localHost() && new URLSearchParams(location.search).get('skipTitle') === '1';
}

function consented() {
    try { return !!JSON.parse(saveStore.load(CONSENT_KEY) || 'null'); } catch (e) { return false; }
}

const ICON = {
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>'
};

/**
 * 시작 화면을 띄우고, 플레이어가 들어가면 끝나는 Promise (main_v2.js — runLoading 다음)
 */
export function showTitle() {
    return new Promise(resolve => {
        const el = document.createElement('div');
        el.className = 'v2-title';
        const faces = ROSTER.map(c => isCharacterReleased(c.id)
            ? `<i class="v2-title__face" title="${c.faction}" style="background-image:url('assets/sprites/intro/face_${c.id}.webp')"></i>`
            : '<i class="v2-title__face is-secret" title="곧 공개"></i>').join('');
        el.innerHTML = `
            <div class="v2-title__bg" style="background-image:url('${KEY_ART}')"></div>
            <div class="v2-title__shade"></div>
            <div class="v2-title__icons"><button type="button" data-act="mute" aria-label="소리 켜기/끄기"></button></div>
            <div class="v2-title__logo"><span class="mad">MAD</span><span class="over">OVERLORD</span><span class="kr">매드 오버로드</span></div>
            <div class="v2-title__tap">TOUCH TO START</div>
            <div class="v2-title__lineup">${faces}</div>
            <button type="button" class="v2-title__acct" data-act="account"><i></i><span></span></button>
            <div class="v2-title__ver">v${VERSION}-b${BUILD}</div>
            <div class="v2-title__consent" hidden>
                <div class="v2-title__box v2-panel" role="dialog" aria-label="이용약관 동의">
                    <h3>시작하기 전에</h3>
                    <p>처음 한 번만 받습니다. 동의하면 게스트로 바로 시작하고, 계정 연동은 나중에 언제든 할 수 있어요.</p>
                    <label><input type="checkbox" data-agree="0"> 이용약관 동의 (필수)</label>
                    <label><input type="checkbox" data-agree="1"> 개인정보 처리방침 동의 (필수)</label>
                    <button type="button" class="v2-btn" data-act="agree" disabled>동의하고 시작</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        const consentEl = el.querySelector('.v2-title__consent');
        const agreeBtn = el.querySelector('[data-act="agree"]');
        const drawAcct = () => {
            const a = auth.state();
            const btn = el.querySelector('.v2-title__acct');
            btn.classList.toggle('is-linked', a.status === 'linked');
            btn.querySelector('span').innerHTML = a.status === 'linked' ? a.email : '게스트 · <u>계정 연동하기</u>';
        };
        drawAcct();
        const drawMute = () => { el.querySelector('[data-act="mute"]').innerHTML = settings.get('mute') ? ICON.muted : ICON.sound; };
        drawMute();
        const unsub = auth.subscribe(drawAcct);
        track('screen_view', { screen: 'title' });

        const enter = () => {
            unsub();
            sound.unlock();
            sound.play('ui_click');
            el.classList.add('is-leaving');
            setTimeout(() => el.remove(), 350);
            track('title_start', { firstRun: !consented() });
            resolve();
        };
        el.addEventListener('change', () => {
            const boxes = [...el.querySelectorAll('[data-agree]')];
            agreeBtn.disabled = !boxes.every(b => b.checked);
        });
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-act]');
            const act = b && b.dataset.act;
            if (act === 'account') { sound.unlock(); return openAccount('settings'); }
            if (act === 'mute') { sound.unlock(); settings.set('mute', !settings.get('mute')); return drawMute(); }
            if (act === 'agree') {
                try { saveStore.save(CONSENT_KEY, JSON.stringify({ at: Date.now() })); } catch (err) { /* 저장 못 해도 시작 */ }
                return enter();
            }
            if (e.target.closest('.v2-title__box')) return;   // 동의 창 안을 누름
            if (!consented()) { sound.unlock(); consentEl.hidden = false; return; }
            enter();
        });
    });
}
