/* ==========================================================================
   PROJECT: MAD OVERLORD // 피로도 출격 확인 · 부족 창 (Q-049 기획서 2단계 — 규칙은 engine_v2/stamina_v2.js)
   출격 길(메인 출격 단추 · 결과 화면 '다음'·'재도전'·'다시 출격' · 화면 전환 안전망)에서 staminaGate(go)를 부른다.
   모자라면 부족 창: 필요 · 지금 · 기다릴 시간 · [광고 보고 +30] · [DM으로 +40] · [닫기]. 충전해서 모자라지 않게 되면 바로 출격(go).
   스페셜맵·탑은 부르는 쪽에서 건너뜀 (pendingSpecial), 켜지기 전·시험 모드 2단계는 progress.staminaCheck가 { ok: true }.
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { STAMINA } from '../engine_v2/stamina_v2.js';
import { AD_LIMITS } from '../engine_v2/shopCatalog_v2.js';
import { stageById, defaultStage } from '../engine_v2/stages_v2.js';
import { difficultyUnlocked, DEFAULT_DIFFICULTY } from '../engine_v2/difficulty_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { track } from '../engine_v2/analytics_v2.js';

let el = null;
let pending = null;   // { go, msg, busy }

/** 출격할 판과 난이도 — 전투 시작(battle_v2.js startBattle)과 같은 규칙 */
export function sortieTarget() {
    const diff = difficultyUnlocked(progress.difficulty, progress) ? progress.difficulty : DEFAULT_DIFFICULTY;
    const stage = stageById(progress.selectedStage) || defaultStage(progress);
    return { stage, diff };
}

/** 피로도 확인만 — 넉넉하면 true. 모자라면 부족 창을 열고 false (충전해서 채우면 go를 부름) */
export function staminaReady(go) {
    const { stage, diff } = sortieTarget();
    const c = progress.staminaCheck(stage, diff);
    if (c.ok) return true;
    sound.play('ui_error');
    openStaminaShort(go);
    track('stamina_short', { stageId: stage?.id, difficulty: diff, need: c.need, have: c.have });
    return false;
}

/** 피로도 확인 뒤 출격(go). 모자라면 부족 창을 열고 false */
export function staminaGate(go) {
    if (!staminaReady(go)) return false;
    go();
    return true;
}

/** 남은 시간 글자: '24분' · '1시간 5분' · '1분 안' */
export function waitText(ms) {
    const m = Math.ceil(Math.max(0, ms) / 60000);
    if (m < 1) return '1분 안';
    const h = Math.floor(m / 60);
    return h ? `${h}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
}

export function openStaminaShort(go = null) {
    pending = { go, msg: '', busy: false };
    if (!el) {
        el = document.createElement('div');
        el.className = 'v2-stamina';
        el.addEventListener('click', onClick);
        document.body.appendChild(el);
    }
    render();
}

export function closeStaminaShort() {
    if (el) el.remove();
    el = null;
    pending = null;
}

export const staminaShortOpen = () => !!el;

function render() {
    if (!el || !pending) return;
    const { stage, diff } = sortieTarget();
    const c = progress.staminaCheck(stage, diff);
    const adLeft = progress.staminaAdLeft(), buyLeft = progress.staminaBuyLeft(), price = progress.staminaBuyPrice();
    const adUsed = AD_LIMITS.stamina_ad - adLeft, buyUsed = STAMINA.buy.daily - buyLeft;
    const dm = gameState.darkMatter;
    const skip = progress.canSkipAd('stamina_ad');
    el.innerHTML = `<div class="v2-stamina__panel v2-panel" role="dialog" aria-label="피로도 부족">
        <small class="v2-stamina__kicker">STAMINA</small>
        <h2>피로도가 모자랍니다</h2>
        <div class="v2-stamina__need"><span>필요<b>⚡ ${c.need ?? 0}</b></span><span>지금<b>⚡ ${c.have ?? 0}</b></span></div>
        <p class="v2-stamina__wait">기다리면 <b>${waitText(c.waitMs)}</b> 뒤 출격할 수 있어요 · 6분마다 1씩 찹니다</p>
        <div class="v2-stamina__row">
            <button class="v2-btn" data-act="ad" ${adLeft > 0 && !pending.busy ? '' : 'disabled'}>${skip ? '바로 받기' : '광고 보고'} +${STAMINA.ad.amount} <small>오늘 ${adUsed}/${AD_LIMITS.stamina_ad}</small></button>
            <button class="v2-btn" data-act="buy" ${price !== null && dm >= price && !pending.busy ? '' : 'disabled'}>${price === null ? 'DM 충전' : `${price.toLocaleString()} DM으로`} +${STAMINA.buy.amount} <small>오늘 ${buyUsed}/${STAMINA.buy.daily}</small></button>
        </div>
        ${pending.msg ? `<p class="v2-stamina__msg">${pending.msg}</p>` : ''}
        <div class="v2-stamina__row v2-stamina__row--end"><button class="v2-btn v2-btn--ghost" data-act="close">닫기</button></div>
    </div>`;
}

/** 충전 뒤: 이제 출격할 수 있으면 창을 닫고 출격, 아니면 창을 새로 그림 */
function afterCharge(r) {
    if (!pending) return;
    pending.busy = false;
    if (!r.success) {
        pending.msg = r.reason || '충전하지 못했습니다';
        sound.play('ui_error');
        render();
        return;
    }
    sound.play('ui_equip');
    const { stage, diff } = sortieTarget();
    if (progress.staminaCheck(stage, diff).ok && pending.go) {
        const go = pending.go;
        closeStaminaShort();
        go();
        return;
    }
    pending.msg = `피로도 +${r.added}`;
    render();
}

async function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act && e.target === el) { closeStaminaShort(); return; }   // 바깥(어두운 곳)을 누르면 닫힘
    if (!act || !pending || pending.busy) return;
    if (act === 'close') { sound.play('ui_click'); closeStaminaShort(); return; }
    if (act === 'buy') { afterCharge(progress.buyStamina()); return; }
    if (act === 'ad') {
        pending.busy = true;
        pending.msg = '';
        render();
        let r;
        try { r = await progress.adStamina(); } catch (err) { r = { success: false, reason: '광고 요청에 실패했습니다. 다시 시도해 주세요' }; }
        afterCharge(r);
    }
}
