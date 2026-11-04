/* 방치 보상은 메뉴 단추를 직접 눌렀을 때만 연다. */
import { progress } from '../engine_v2/progress_v2.js';
import { ads } from '../engine_v2/commerceProviders_v2.js';
import { difficultyOf } from '../engine_v2/difficulty_v2.js';
import { STAGES } from '../engine_v2/stages_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { commerceDialog } from './probInfo_v2.js';

const duration = ms => `${Math.floor(ms / 3600000)}시간 ${Math.floor(ms / 60000) % 60}분`;

export function createOfflineRewardButton(before, onChange) {
    const button = document.createElement('button');
    button.id = 'btn-menu-offline-v2';
    button.className = 'v2-supportbtn v2-offlinebtn';
    button.hidden = true;
    before.before(button);
    button.addEventListener('click', () => openOfflineReward(onChange));
    return button;
}

export function updateOfflineRewardButton(button, reportReady = false) {
    if (!button) return;
    const r = progress.offlineReward(reportReady);
    button.hidden = !r.unlocked;
    button.classList.toggle('is-ready', r.ready);
    button.textContent = r.ready ? `방치 보상 · ${r.dm.toLocaleString()} DM ●` : '방치 보상 · 누적 중';
}

export function openOfflineReward(onChange = () => {}) {
    if (!progress.offlineUnlocked() || document.querySelector('.v2-offline')) return;
    const dialog = commerceDialog('v2-offline', '방치 보상');
    let busy = false, message = '';
    dialog.panel.innerHTML = `<header><h2>방치 보상</h2><button class="v2-btn v2-btn--ghost" data-close>닫기</button></header>
        <p>자리를 비운 동안 DM을 모았어요.</p><div data-summary></div>
        <p data-result role="status" aria-live="polite"></p><div class="v2-commerce__actions">
        <button class="v2-btn" data-claim="base">받기</button><button class="v2-btn" data-claim="double"></button></div>`;
    const render = () => {
        if (!dialog.overlay.isConnected) return;
        const r = progress.offlineReward(true), p = r.pool;
        const stage = p && STAGES.find(s => s.id === p.stageId);
        const summary = dialog.panel.querySelector('[data-summary]');
        summary.textContent = p ? `기준: 구역 ${stage.zone} · ${stage.name} · ${difficultyOf(p.difficulty).name}\n`
            + `적립: ${duration(p.elapsedMs)} / 최대 ${p.capMs / 3600000}시간\n기본 보상: ${r.dm.toLocaleString()} DM`
            + (p.dmBonus ? ` (펫 보너스 +${Number((p.dmBonus * 100).toFixed(2))}% 포함)` : '')
            + (r.ready ? '' : '\n10분 이상 모이면 받을 수 있어요.') : '다음 부재부터 DM이 쌓여요. 누적 10분부터 받을 수 있어요.';
        dialog.panel.querySelector('[data-result]').textContent = message;
        dialog.panel.querySelector('[data-claim="base"]').disabled = busy || !r.ready;
        const double = dialog.panel.querySelector('[data-claim="double"]');
        const skip = progress.canSkipAd('idle_double'), remaining = progress.adQuotaRemaining('idle_double');
        double.textContent = !remaining ? '오늘 2배 받기 완료' : !skip && !ads.available ? '광고 준비 중'
            : `${skip ? '광고 없이 2배 받기' : '광고 보고 2배'} · ${(r.dm * 2).toLocaleString()} DM (${remaining}/2회)`;
        double.disabled = busy || !r.ready || !remaining || (!skip && !ads.available);
    };
    dialog.panel.querySelector('[data-close]').addEventListener('click', dialog.close);
    dialog.panel.addEventListener('click', async e => {
        const button = e.target.closest('[data-claim]');
        if (!button || button.disabled || busy) return;
        busy = true; render();
        try {
            const r = await progress.claimOfflineReward(button.dataset.claim === 'double');
            message = r.success ? `${r.grantedDm.toLocaleString()} DM 받았어요` : r.reason;
            sound.play(r.success ? 'ui_equip' : 'ui_error');
        } finally { busy = false; render(); onChange(); }
    });
    const timer = setInterval(render, 15000);
    dialog.onClose(() => { clearInterval(timer); onChange(); });
    render();
    dialog.panel.querySelector('[data-close]').focus();
}
