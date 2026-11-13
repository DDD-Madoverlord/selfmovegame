/* ==========================================================================
   PROJECT: MAD OVERLORD // 피로도 출격 확인 · 부족 창 · 피로도 창 (Q-049 기획서 2·3단계 — 규칙은 engine_v2/stamina_v2.js)
   출격 길(메인 출격 단추 · 결과 화면 '다음'·'재도전'·'다시 출격' · 화면 전환 안전망)에서 staminaGate(go) / staminaReady(go)를 부른다.
   부족 창(mode 'short'): 필요 · 지금 · 기다릴 시간 · [광고 보고 +30] · [DM으로 +40] · [닫기].
     충전해서 모자라지 않게 되면 바로 출격(go). 창을 열어 둔 채 시간이 차도 [출격] 단추가 나옴.
   피로도 창(mode 'info', 위 재화 줄 ⚡ 칩을 누름 — currencyBar_v2.js): 지금/최대 · 다음 1까지 · 가득까지(1초마다) · 비용 · 충전.
   스페셜맵·탑은 부르는 쪽에서 건너뜀 (pendingSpecial), 켜지기 전·시험 모드 2단계는 progress.staminaCheck가 { ok: true }.
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { STAMINA } from '../engine_v2/stamina_v2.js';
import { AD_LIMITS } from '../engine_v2/shopCatalog_v2.js';
import { stageById, defaultStage } from '../engine_v2/stages_v2.js';
import { difficultyUnlocked, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../engine_v2/difficulty_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { track } from '../engine_v2/analytics_v2.js';
import { icon } from './icons.js';

let el = null;
let view = null;     // { mode: 'short' | 'info', go, msg, busy }
let ticker = null;

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

/** 시계 글자: 4:12 · 2:40:00 */
export function clockText(ms) {
    const t = Math.ceil(Math.max(0, ms) / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const two = n => String(n).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

function open(mode, go) {
    view = { mode, go, msg: '', busy: false };
    if (!el) {
        el = document.createElement('div');
        el.className = 'v2-stamina';
        el.addEventListener('click', onClick);
        document.body.appendChild(el);
    }
    el.dataset.mode = mode;
    render();
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
}

export function openStaminaShort(go = null) {
    open('short', go);
}

/** 피로도 창 (⚡ 칩) — 켜지기 전에는 열지 않음 */
export function openStaminaInfo() {
    if (!progress.stamina?.on) return false;
    sound.play('ui_click');
    open('info', null);
    track('stamina_info', { v: progress.stamina.v });
    return true;
}

export function closeStaminaShort() {
    clearInterval(ticker);
    ticker = null;
    if (el) el.remove();
    el = null;
    view = null;
}

export const staminaShortOpen = () => !!el;

/** 시간 줄 (1초마다 바뀜) */
function timerHtml() {
    if (view.mode === 'short') {
        const { stage, diff } = sortieTarget();
        const c = progress.staminaCheck(stage, diff);
        return c.ok ? '이제 출격할 수 있어요' : `기다리면 <b>${waitText(c.waitMs)}</b> 뒤 출격할 수 있어요 · 6분마다 1씩 찹니다`;
    }
    const v = progress.staminaView();
    if (v.over) return '최대치를 넘었어요 — 넘은 동안은 시간으로 차지 않아요';
    if (v.full) return '가득 찼어요 — 출격하면 다시 6분마다 1씩 찹니다';
    return `다음 1까지 <b>${clockText(v.nextMs)}</b> · 가득까지 <b>${clockText(v.fullMs)}</b>`;
}

function render() {
    if (!el || !view) return;
    const { stage, diff } = sortieTarget();
    const c = progress.staminaCheck(stage, diff);
    const v = progress.staminaView();
    const adLeft = progress.staminaAdLeft(), buyLeft = progress.staminaBuyLeft(), price = progress.staminaBuyPrice();
    const adUsed = AD_LIMITS.stamina_ad - adLeft, buyUsed = STAMINA.buy.daily - buyLeft;
    const skip = progress.canSkipAd('stamina_ad');
    const short = view.mode === 'short';
    const ready = short && c.ok;
    const costs = DIFFICULTIES.map(d => `${d.name} ${progress.staminaCost(d.id)}`).join(' · ');
    el.dataset.mode = view.mode;
    el.innerHTML = `<div class="v2-stamina__panel v2-panel" role="dialog" aria-label="${short ? '피로도 부족' : '피로도'}">
        <small class="v2-stamina__kicker">STAMINA</small>
        <h2>${short ? (ready ? '출격할 수 있어요' : '피로도가 모자랍니다') : `피로도 <span class="v2-stamina__now">${icon('bolt', 22)}${v.v}<small>/ ${v.max}</small></span>`}</h2>
        ${short ? `<div class="v2-stamina__need"><span>필요<b>⚡ ${c.need ?? progress.staminaCost(diff)}</b></span><span${ready ? ' class="is-ok"' : ''}>지금<b>⚡ ${progress.stamina.v}</b></span></div>` : ''}
        <p class="v2-stamina__wait" data-stamina-timer>${timerHtml()}</p>
        ${short ? '' : `<p class="v2-stamina__costs">출격 비용 ${costs}<br>이기면 다 쓰고, 진 판은 1만 씁니다 · 스페셜맵·탑은 쓰지 않아요</p>`}
        <div class="v2-stamina__row">
            <button class="v2-btn" data-act="ad" ${adLeft > 0 && !view.busy ? '' : 'disabled'}>${skip ? '바로 받기' : '광고 보고'} +${STAMINA.ad.amount} <small>오늘 ${adUsed}/${AD_LIMITS.stamina_ad}</small></button>
            <button class="v2-btn" data-act="buy" ${price !== null && gameState.darkMatter >= price && !view.busy ? '' : 'disabled'}>${price === null ? 'DM 충전' : `${price.toLocaleString()} DM으로`} +${STAMINA.buy.amount} <small>오늘 ${buyUsed}/${STAMINA.buy.daily}</small></button>
        </div>
        ${view.msg ? `<p class="v2-stamina__msg">${view.msg}</p>` : ''}
        <div class="v2-stamina__row v2-stamina__row--end">
            <button class="v2-btn v2-btn--ghost" data-act="close">닫기</button>
            ${ready && view.go ? `<button class="v2-btn v2-btn--primary" data-act="go">${icon('play', 16)} 출격</button>` : ''}
        </div>
    </div>`;
}

/** 1초마다: 시간 줄만 바꿈 (단추를 다시 만들지 않음) — 부족 창에서 시간이 다 차면 [출격] 단추가 나오게 한 번 다시 그림 */
function tick() {
    if (!el || !view) { clearInterval(ticker); return; }
    const t = el.querySelector('[data-stamina-timer]');
    const html = timerHtml();
    if (t && t.innerHTML !== html) t.innerHTML = html;
    if (view.mode === 'short' && !view.busy) {
        const { stage, diff } = sortieTarget();
        const ok = progress.staminaCheck(stage, diff).ok;
        if (ok !== !!el.querySelector('[data-act="go"]') && view.go) render();
    }
}

/** 충전 뒤: 부족 창이고 이제 출격할 수 있으면 창을 닫고 출격, 아니면 창을 새로 그림 */
function afterCharge(r) {
    if (!view) return;
    view.busy = false;
    if (!r.success) {
        view.msg = r.reason || '충전하지 못했습니다';
        sound.play('ui_error');
        render();
        return;
    }
    sound.play('ui_equip');
    const { stage, diff } = sortieTarget();
    if (view.mode === 'short' && view.go && progress.staminaCheck(stage, diff).ok) {
        const go = view.go;
        closeStaminaShort();
        go();
        return;
    }
    view.msg = `피로도 +${r.added}`;
    render();
}

async function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act && e.target === el) { closeStaminaShort(); return; }   // 바깥(어두운 곳)을 누르면 닫힘
    if (!act || !view || view.busy) return;
    if (act === 'close') { sound.play('ui_click'); closeStaminaShort(); return; }
    if (act === 'go') {
        const go = view.go;
        closeStaminaShort();
        if (go) staminaGate(go);
        return;
    }
    if (act === 'buy') { afterCharge(progress.buyStamina()); return; }
    if (act === 'ad') {
        view.busy = true;
        view.msg = '';
        render();
        let r;
        try { r = await progress.adStamina(); } catch (err) { r = { success: false, reason: '광고 요청에 실패했습니다. 다시 시도해 주세요' }; }
        afterCharge(r);
    }
}
