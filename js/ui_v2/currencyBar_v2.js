/**
 * 재화 표시줄 — ⚡ 피로도 · 별·조각·코어 + DM을 화면마다 같은 모양·같은 값으로 (11-05 피드백 12번, 전투 화면은 HUD 그대로)
 * 자리 = data-currency가 붙은 요소: 메인·캐릭터 선택·연구소 위 줄(index.html), 작전 지원 창 머리(growthUi_v2.js),
 * 상점 머리(shop_v2.js), 휴대폰 지도 창 아래 줄(index.html). 안의 .v2-chip--res · .v2-chip--dm strong을 한 번에 갱신.
 * gameState가 바뀔 때마다(progress도 바뀌면 gameState.notify) 붙은 자리 모두를 다시 채움.
 * ⚡ 피로도 칩 (Q-049 3단계): 자리마다 맨 앞(별·조각 칩 앞)에 JS가 붙임 — 켜지기 전(노말 1-B 전)에는 숨김.
 *   누르면 피로도 창(다음 1까지 · 가득까지 · 충전, staminaUi_v2.js). 시간으로 1이 차면 1초 안에 gameState.notify로 화면을 다시 그림.
 */
import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { icon } from './icons.js';
import { resChipHtml } from './growthUi_v2.js';
import { openStaminaInfo } from './staminaUi_v2.js';

let lastStamina = '';   // 마지막으로 그린 피로도 (on:v:max) — 시간 회복으로 바뀌면 다시 그림

/** ⚡ 칩 안쪽 HTML — 지금 / 최대 (넘쳤으면 is-over) */
function staminaInner(v) {
    return `<em>${icon('bolt', 16)}</em><b>${v.v}</b><small>/${v.max}</small>`;
}

function staminaAttrs(chip, v) {
    chip.hidden = !v.on || progress.staminaExempt();   // 켜지기 전 · 시험 모드 2단계 · 피로도 끄기 · 자동 검사면 숨김
    chip.classList.toggle('is-over', v.over);
    chip.classList.toggle('is-low', v.on && v.v < progress.staminaCost('normal'));
    chip.title = `피로도 ${v.v}/${v.max} — 출격할 때 씀 (노말 ${progress.staminaCost('normal')}) · 6분마다 1`;
    chip.setAttribute('aria-label', `피로도 ${v.v} / ${v.max}`);
}

function staminaChip(v) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'v2-chip v2-chip--stamina';
    chip.dataset.staminaChip = '';
    chip.innerHTML = staminaInner(v);
    staminaAttrs(chip, v);
    return chip;
}

/** 새 자리에 넣을 칩 (위 줄과 같은 모양) */
export function currencyChipsHtml() {
    const v = progress.staminaView();
    return `<button type="button" class="v2-chip v2-chip--stamina${v.over ? ' is-over' : ''}" data-stamina-chip${v.on && !progress.staminaExempt() ? '' : ' hidden'} aria-label="피로도 ${v.v} / ${v.max}">${staminaInner(v)}</button>`
        + `<div class="v2-chip v2-chip--res">${resChipHtml()}</div>`
        + `<div class="v2-chip v2-chip--dm">${icon('gem', 18)}<strong>${gameState.darkMatter.toLocaleString()}</strong><small>DM</small></div>`;
}

/** 화면에 있는 재화 자리 모두 갱신 */
export function refreshCurrency() {
    const dm = gameState.darkMatter.toLocaleString();
    const res = resChipHtml();
    const v = progress.staminaView();
    const inner = staminaInner(v);
    lastStamina = `${v.on}:${v.v}:${v.max}`;
    // 휴대폰 메인 위 줄은 칩 하나만큼 자리가 모자라 — 칩이 보이면 body.v2-has-stamina로 '방치 보상'을 이름 아래로 (ui_v2_mobile.css)
    document.body.classList.toggle('v2-has-stamina', v.on && !progress.staminaExempt());
    document.querySelectorAll('[data-currency]').forEach(box => {
        let chip = box.querySelector('.v2-chip--stamina');
        if (!chip) box.insertBefore(chip = staminaChip(v), box.querySelector('.v2-chip--res') || box.querySelector('.v2-chip--dm') || null);
        if (chip.innerHTML !== inner) chip.innerHTML = inner;
        staminaAttrs(chip, v);
        box.querySelectorAll('.v2-chip--res').forEach(el => { if (el.innerHTML !== res) el.innerHTML = res; });
        box.querySelectorAll('.v2-chip--dm strong').forEach(el => { el.textContent = dm; });
    });
}

gameState.subscribe(refreshCurrency);

// 칩을 누르면 피로도 창
document.addEventListener('click', e => {
    if (!e.target.closest('[data-stamina-chip]')) return;
    openStaminaInfo();
});

// 시간으로 1이 차면 화면 갱신 (값이 바뀔 때만 notify — 출격 단추 비용 색·결과 화면 밖 칩 모두)
setInterval(() => {
    if (window.madOverlordGameMode !== 'v2' || document.hidden || !progress.stamina?.on) return;
    const v = progress.staminaView();
    const key = `${v.on}:${v.v}:${v.max}`;
    if (key !== lastStamina) { lastStamina = key; gameState.notify(); }
}, 1000);
