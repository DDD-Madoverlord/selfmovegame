/* ==========================================================================
   PROJECT: MAD OVERLORD // 설정 창 (v2)
   전체/효과음/배경음 음량, 음소거, 화면 흔들림. 값은 settings_v2.js에 바로 저장되어 즉시 적용.
   openSettings(): 화면 위에 창을 띄움 (전투 일시정지 메뉴, 메인 화면 톱니바퀴에서 연다)
   ========================================================================== */

import { icon } from './icons.js';
import { openAccount } from './account_v2.js';
import { settings } from '../engine_v2/settings_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { progress, exportSave, importSave } from '../engine_v2/progress_v2.js';
import { VERSION, BUILD } from '../version_v2.js';
import { isApp, checkForUpdate } from './appUpdate_v2.js';
import { openProbInfo } from './probInfo_v2.js';
import { commerceEnvironment, initCommerceDev, isMockCommerce } from '../engine_v2/commerceDev_v2.js';

const SLIDERS = [
    { key: 'master', label: '전체 음량', preview: 'ui_click' },
    { key: 'sfx', label: '효과음', preview: 'mech_missile_blast' },
    { key: 'bgm', label: '배경음', preview: null }
];
const TOGGLES = [
    { key: 'mute', label: '음소거', desc: '모든 소리 끄기' },
    { key: 'shake', label: '화면 흔들림', desc: '폭발·착지·타격 때 화면이 흔들림' },
    { key: 'sharp', label: '선명한 그림', desc: '큰 화면에서 캐릭터·이펙트를 높은 해상도로 (느리면 끄기)' }
];
// 화면 배치 (Q-015, main_v2.js fitScreens): 휴대폰 배치 = 메인 시안 B · 전투 시안 A
const LAYOUTS = [['auto', '자동'], ['mobile', '휴대폰'], ['pc', 'PC']];

export function openSettings() {
    if (document.querySelector('.v2-settings')) return;
    const el = document.createElement('div');
    el.className = 'v2-settings v2-growth__body';
    el.innerHTML = `
        <div class="v2-settings__panel v2-panel v2-growth__body" role="dialog" aria-label="설정">
            <div class="v2-hazard v2-settings__stripe"></div>
            <h2>${icon('gear', 22)} SETTINGS <small>설정</small></h2>
            <section>
                <h3>사운드</h3>
                ${SLIDERS.map(s => `
                    <label class="v2-settings__row">
                        <span>${s.label}</span>
                        <input type="range" min="0" max="100" step="5" data-key="${s.key}">
                        <output data-out="${s.key}"></output>
                    </label>`).join('')}
            </section>
            <section>
                <h3>화면 / 조작</h3>
                ${TOGGLES.map(t => `
                    <div class="v2-settings__row">
                        <span>${t.label}<small>${t.desc}</small></span>
                        <button class="v2-switch" data-toggle="${t.key}" role="switch"><i></i></button>
                    </div>`).join('')}
                <div class="v2-settings__row">
                    <span>화면 배치<small>자동: 휴대폰·태블릿은 큰 글자·아이콘 배치, PC는 예전 배치</small></span>
                    <div class="v2-settings__actions" role="group" aria-label="화면 배치">
                        ${LAYOUTS.map(([v, label]) => `<button class="v2-btn v2-btn--ghost" data-layout="${v}">${label}</button>`).join('')}
                    </div>
                </div>
            </section>
            <section>
                <h3>진행 데이터</h3>
                <div class="v2-settings__row" data-row="account">
                    <span>계정<small>게스트 기록을 구글 계정에 연동 (연동 보상 DM 5,000)</small></span>
                    <div class="v2-settings__actions"><button class="v2-btn v2-btn--ghost" data-act="account">계정 연동</button></div>
                </div>
                <div class="v2-settings__row">
                    <span>첫 성장 안내<small>진행과 보상 기록을 유지하며 안내를 볼 수 있어요</small></span>
                    <div class="v2-settings__actions">
                        <button class="v2-btn v2-btn--ghost" data-act="tutorial-replay">첫 성장 안내 다시 보기</button>
                        <button class="v2-btn v2-btn--ghost" data-act="tutorial-resume">이어보기</button>
                    </div>
                </div>
                <div class="v2-settings__row" data-row="backup">
                    <span>저장 백업<small data-out="backup" role="status">다른 기기로 옮길 코드를 보관하세요</small>
                        <textarea data-code="backup" aria-label="저장 백업 코드" rows="2" cols="16" readonly hidden></textarea>
                    </span>
                    <div class="v2-settings__actions">
                        <button class="v2-btn v2-btn--ghost" data-act="copy-save">코드 복사</button>
                        <button class="v2-btn v2-btn--ghost" data-act="download-save">파일로 저장</button>
                    </div>
                </div>
                <div class="v2-settings__row" data-row="import">
                    <span>저장 불러오기<small data-out="import" role="status">백업 코드를 붙여 넣으세요</small>
                        <textarea data-code="import" aria-label="불러올 백업 코드" rows="2" cols="16"></textarea>
                    </span>
                    <button class="v2-btn v2-btn--ghost v2-settings__reset" data-act="import-save">불러오기</button>
                </div>
                <div class="v2-settings__row">
                    <span>진행 초기화<small>DM·파츠·강화·스테이지 기록을 처음으로 (설정은 유지)</small></span>
                    <button class="v2-btn v2-btn--danger v2-settings__reset" data-act="wipe">초기화</button>
                </div>
            </section>
            <section>
                <h3>정보</h3>
                <div class="v2-settings__row">
                    <span>버전 ${VERSION} <small data-out="update">빌드 ${BUILD} · ${isApp() ? 'Android 앱' : '웹'}</small></span>
                    ${isApp() ? '<button class="v2-btn v2-btn--ghost v2-settings__reset" data-act="update">업데이트 확인</button>' : ''}
                </div>
                <div class="v2-settings__row">
                    <span>확률 정보<small>파츠 옵션·등급 · 판 클리어 드랍 확률 (11-05 상점·연구소에서 옮김)</small></span>
                    <button class="v2-btn v2-btn--ghost v2-settings__reset" data-act="prob">보기</button>
                </div>
                <div class="v2-settings__row">
                    <span>사운드<small>일부 효과음·배경음 Powered by Stability AI (Stable Audio 3) · 그 밖은 CC0 (Kenney 등)</small></span>
                </div>
            </section>
            <div class="v2-settings__actions">
                <button class="v2-btn v2-btn--ghost" data-act="reset">기본값</button>
                <button class="v2-btn" data-act="close">닫기</button>
            </div>
        </div>`;
    document.body.appendChild(el);
    if (commerceEnvironment().appDev) {
        const section = document.createElement('section');
        section.innerHTML = `<h3>개발판 시험</h3><div class="v2-settings__row"><span>결제·광고 시험<small>현재 진행을 메모리로 복사합니다. 새로고침하면 시험분은 사라집니다. 시험 중 백업 내보내기 불가.</small></span>
            <button class="v2-switch ${isMockCommerce() ? 'is-on' : ''}" data-commerce-test role="switch" aria-checked="${isMockCommerce()}"><i></i></button></div>`;
        el.querySelector('.v2-settings__panel').appendChild(section);
        section.querySelector('[data-commerce-test]').addEventListener('click', e => {
            if (isMockCommerce()) {
                const url = new URL(location.href);
                url.searchParams.delete('mockCommerce');
                location.replace(url.href);
                return;
            }
            progress.save();
            if (!initCommerceDev({ explicit: true })) return;
            progress.commerce.mockSession = true;
            progress.save();
            const btn = e.currentTarget;
            btn.classList.add('is-on');
            btn.setAttribute('aria-checked', 'true');
        });
    }

    const render = () => {
        el.querySelectorAll('input[data-key]').forEach(inp => {
            const v = Math.round(settings.get(inp.dataset.key) * 100);
            inp.value = v;
            inp.style.setProperty('--val', `${v}%`);
            el.querySelector(`[data-out="${inp.dataset.key}"]`).textContent = v;
        });
        el.querySelectorAll('[data-toggle]').forEach(btn => {
            const on = !!settings.get(btn.dataset.toggle);
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-checked', String(on));
        });
        el.querySelectorAll('[data-layout]').forEach(btn => {
            const on = settings.get('layout') === btn.dataset.layout;
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', String(on));
        });
    };
    render();

    el.querySelectorAll('input[data-key]').forEach(inp => {
        inp.addEventListener('input', () => {
            settings.set(inp.dataset.key, Number(inp.value) / 100);
            render();
        });
        // 손을 떼면 그 소리 크기로 미리 들려줌
        inp.addEventListener('change', () => {
            const s = SLIDERS.find(x => x.key === inp.dataset.key);
            if (s && s.preview) sound.play(s.preview);
        });
    });
    el.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
        const key = btn.dataset.toggle;
        settings.set(key, !settings.get(key));
        sound.play('ui_toggle');
        render();
    }));
    el.querySelectorAll('[data-layout]').forEach(btn => btn.addEventListener('click', () => {
        settings.set('layout', btn.dataset.layout);
        sound.play('ui_toggle');
        render();
    }));

    const close = () => {
        sound.play('ui_click');
        el.classList.add('is-out');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => el.remove(), 180);
    };
    const onKey = e => {
        if (document.querySelector('.v2-prob-info')) return;   // 위에 뜬 확률 창이 먼저 닫힘 (그 창이 Escape를 받음)
        if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
            close();
        }
    };
    document.addEventListener('keydown', onKey, true);
    el.querySelector('[data-act="close"]').addEventListener('click', close);
    el.querySelector('[data-act="prob"]').addEventListener('click', openProbInfo);
    el.querySelector('[data-act="tutorial-replay"]').addEventListener('click', () => { progress.replayTutorial(); close(); });
    el.querySelector('[data-act="account"]').addEventListener('click', () => { close(); openAccount('settings'); });   // 계정 연동 화면 (D-119 2번)
    el.querySelector('[data-act="tutorial-resume"]').addEventListener('click', () => { progress.resumeTutorial(); close(); });
    el.querySelector('[data-act="copy-save"]').addEventListener('click', async () => {
        const out = el.querySelector('[data-out="backup"]');
        try {
            const code = exportSave();
            const box = el.querySelector('[data-code="backup"]');
            box.value = code;
            try {
                await navigator.clipboard.writeText(code);
                out.textContent = '백업 코드를 복사했습니다';
            } catch (e) {
                box.hidden = false;
                box.focus();
                box.select();
                out.textContent = '선택된 코드를 직접 복사해 주세요';
            }
        } catch (e) { out.textContent = `백업 실패: ${e.message}`; }
    });
    el.querySelector('[data-act="download-save"]').addEventListener('click', () => {
        const out = el.querySelector('[data-out="backup"]');
        try {
            const url = URL.createObjectURL(new Blob([exportSave()], { type: 'text/plain;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `MAD-OVERLORD-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            out.textContent = '백업 파일을 저장했습니다';
        } catch (e) { out.textContent = `백업 실패: ${e.message}`; }
    });
    el.querySelector('[data-act="import-save"]').addEventListener('click', () => {
        if (!confirm('지금 진행을 덮어씁니다. 백업을 불러올까요?')) return;
        const result = importSave(el.querySelector('[data-code="import"]').value);
        if (!result.success) el.querySelector('[data-out="import"]').textContent = result.reason;
    });
    // 진행 초기화: 두 번 눌러야 실행 (실수 방지)
    const wipe = el.querySelector('[data-act="wipe"]');
    wipe.addEventListener('click', () => {
        if (!wipe.classList.contains('is-armed')) {
            wipe.classList.add('is-armed');
            wipe.textContent = '한 번 더 누르면 초기화';
            sound.play('ui_error');
            setTimeout(() => { wipe.classList.remove('is-armed'); wipe.textContent = '초기화'; }, 3000);
            return;
        }
        progress.resetAll();
    });
    el.querySelector('[data-act="update"]')?.addEventListener('click', () => {
        sound.play('ui_click');
        const out = el.querySelector('[data-out="update"]');
        checkForUpdate({ silent: false, onStatus: text => { out.textContent = text; } });
    });
    el.querySelector('[data-act="reset"]').addEventListener('click', () => {
        settings.reset();
        sound.play('ui_toggle');
        render();
    });
    el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
}
