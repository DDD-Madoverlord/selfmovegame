/**
 * 재화 표시줄 — 별·조각·코어 + DM을 화면마다 같은 모양·같은 값으로 (11-05 피드백 12번, 전투 화면은 HUD 그대로)
 * 자리 = data-currency가 붙은 요소: 메인·캐릭터 선택·연구소 위 줄(index.html), 작전 지원 창 머리(growthUi_v2.js),
 * 상점 머리(shop_v2.js), 휴대폰 지도 창 아래 줄(index.html). 안의 .v2-chip--res · .v2-chip--dm strong을 한 번에 갱신.
 * gameState가 바뀔 때마다(progress도 바뀌면 gameState.notify) 붙은 자리 모두를 다시 채움.
 */
import { gameState } from '../engine/state.js';
import { icon } from './icons.js';
import { resChipHtml } from './growthUi_v2.js';

/** 새 자리에 넣을 칩 두 개 (위 줄과 같은 모양) */
export function currencyChipsHtml() {
    return `<div class="v2-chip v2-chip--res">${resChipHtml()}</div>`
        + `<div class="v2-chip v2-chip--dm">${icon('gem', 18)}<strong>${gameState.darkMatter.toLocaleString()}</strong><small>DM</small></div>`;
}

/** 화면에 있는 재화 자리 모두 갱신 */
export function refreshCurrency() {
    const dm = gameState.darkMatter.toLocaleString();
    const res = resChipHtml();
    document.querySelectorAll('[data-currency]').forEach(box => {
        box.querySelectorAll('.v2-chip--res').forEach(el => { if (el.innerHTML !== res) el.innerHTML = res; });
        box.querySelectorAll('.v2-chip--dm strong').forEach(el => { el.textContent = dm; });
    });
}

gameState.subscribe(refreshCurrency);
