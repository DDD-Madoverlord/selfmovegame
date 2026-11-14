/* ==========================================================================
   PROJECT: MAD OVERLORD // 피로도 저장·출격 확인·맡김·정리 (규칙은 stamina_v2.js, Q-049)
   Progress(progress_v2.js)에 메서드로 붙는다 (this = progress). 저장 필드 stamina.
   쓰지 않는 때: 켜지기 전(노말 1-B 첫 클리어 전) · 스페셜맵·오버로드의 탑(stage.special) ·
                 시험 모드 2단계(저장을 메모리 사본으로 돌린 뒤 — saveStore_v2.js saveIsolated) · 조절 패널 '피로도 끄기'(staminaTestOff) ·
                 자동 검사(window.madOverlordNoStamina — tools/tests/common.py가 켬, 출격을 여러 번 하는 검사가 피로도에 막히지 않게)
   출격 길: 확인·부족 창 ui_v2/staminaUi_v2.js staminaGate · 맡김 battle_v2.js startBattle · 정리 finishBattle(이김·짐) / stopBattle(끝나기 전에 나감 = 포기)
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { STAMINA, emptyStamina, validateStamina, maxOf, costOf, regen, view, waitFor, reserve, settle, addOver, turnOn,
    buyLeft, buyPrice, markBuy } from './stamina_v2.js';
import { bestOfflineStage, offlineRate } from './offlineReward_v2.js';
import { saveIsolated } from './saveStore_v2.js';
import { track } from './analytics_v2.js';

export const StaminaMethods = {
    /** 불러오기: 손상된 필드만 버림 · 맡긴 판이 남아 있으면(전투 중 꺼짐) 진 것으로 정리 · 켜질 조건이면 켬 */
    loadStamina(data, now = Date.now()) {
        this.stamina = emptyStamina();
        if (data?.stamina !== undefined) {
            try { validateStamina(data.stamina); this.stamina = JSON.parse(JSON.stringify(data.stamina)); }
            catch (e) { /* 손상된 피로도 필드만 버리고 진행·재화는 보존 */ }
        }
        this.staminaStale = null;
        if (this.stamina.pending) {
            this.staminaStale = settle(this.stamina, 'lose', now, this.staminaMax(now));
            track('stamina_settle', { ...this.staminaStale, reason: 'relaunch' });
        }
        this.syncStamina(now);
        regen(this.stamina, now, this.staminaMax(now));
    },
    staminaUnlocked() {
        return this.stage(STAMINA.unlockStage, 'normal').cleared;
    },
    /** 최대치 — 주간 패스 기간 +40 */
    staminaMax(now = Date.now()) {
        return maxOf(!!this.activePass?.(now));
    },
    /** 켜질 조건(노말 1-B 깸)이면 켬 — 가득 채움. 켰으면 true (불러오기 · 스테이지 기록 뒤) */
    syncStamina(now = Date.now()) {
        if (this.stamina.on || !this.staminaUnlocked()) return false;
        turnOn(this.stamina, now, this.staminaMax(now));
        this.staminaJustOn = true;   // 처음 켜질 때 안내 말풍선 (3단계 화면에서 읽고 지움)
        track('stamina_on', { v: this.stamina.v });
        return true;
    },
    /** 피로도를 쓰지 않는 상태인가 (스테이지와 상관없이) */
    staminaExempt() {
        return !this.stamina.on || saveIsolated() || this.staminaTestOff === true || globalThis.madOverlordNoStamina === true;
    },
    /** 이 판이 피로도를 쓰나 */
    staminaApplies(stage) {
        return !!stage && !stage.special && !this.staminaExempt();
    },
    staminaCost(diff = this.difficulty) {
        return costOf(diff);
    },
    /** 지금 값 { on, v, max, full, over, nextMs, fullMs, pending } */
    staminaView(now = Date.now()) {
        return view(this.stamina, now, this.staminaMax(now));
    },
    /** 출격 전 확인 — { ok, cost, have, need, waitMs }. 쓰지 않는 판이면 { ok: true, cost: 0 } */
    staminaCheck(stage, diff = this.difficulty, now = Date.now()) {
        if (!this.staminaApplies(stage)) return { ok: true, cost: 0 };
        const max = this.staminaMax(now), cost = costOf(diff);
        regen(this.stamina, now, max);
        return { ok: this.stamina.v >= cost, cost, have: this.stamina.v, need: cost, waitMs: waitFor(this.stamina, cost, now, max) };
    },
    /** 전투 시작: 보통 판이면 비용을 빼고 맡김 — { success, cost } / 모자라면 { success: false, need, have, waitMs } */
    reserveStamina(stage, diff = this.difficulty, now = Date.now()) {
        if (!this.staminaApplies(stage)) return { success: true, cost: 0 };
        const r = reserve(this.stamina, { stage: stage.id, diff, cost: costOf(diff) }, now, this.staminaMax(now));
        if (r.success) { this.save(); gameState.notify(); }
        return r;
    },
    /** 전투 끝: result 'win' | 'lose' | 'quit' — { used, refund } (맡긴 판이 없으면 0) */
    settleStamina(result, now = Date.now()) {
        if (!this.stamina.pending) return { result, used: 0, refund: 0 };
        const r = settle(this.stamina, result, now, this.staminaMax(now));
        this.save();
        gameState.notify();
        track('stamina_settle', { ...r, reason: 'battle' });
        return r;
    },
    /** 넘침까지 더함 (충전·선물) — 실제로 더한 양 */
    grantStamina(n, now = Date.now()) {
        if (!this.stamina.on) return 0;
        const added = addOver(this.stamina, n, now, this.staminaMax(now));
        if (added) { this.save(); gameState.notify(); }
        return added;
    },
    /** DM 충전 값의 기준 — 지금 방치 보상 시간당 DM (펫 보너스 빼고) */
    staminaRatePerHour() {
        return bestOfflineStage(this)?.ratePerHour || offlineRate('1-1', 'normal');
    },
    staminaBuyLeft(now = Date.now()) {
        return buyLeft(this.stamina, now);
    },
    /** 오늘 다음 DM 충전 값 (다 썼으면 null) */
    staminaBuyPrice(now = Date.now()) {
        return buyPrice(this.stamina, now, this.staminaRatePerHour());
    },
    /** 광고 충전 오늘 남은 횟수 (다른 보상형 광고와 같은 하루 한도 — AD_LIMITS.stamina_ad) */
    staminaAdLeft(now = Date.now()) {
        return this.adQuotaRemaining('stamina_ad', now);
    },
    /** 광고 보고 +30 — 광고 제거·주간 패스면 광고 없이 (requestAdReward) — { success, added } */
    async adStamina(now = Date.now()) {
        if (!this.stamina.on) return { success: false, reason: '아직 피로도가 없습니다' };
        if (this._staminaAdBusy) return { success: false, reason: '광고를 보는 중입니다' };
        if (this.staminaAdLeft(now) <= 0) return { success: false, reason: '오늘 광고 충전을 다 썼어요 (한국 시간 0시에 다시 채워짐)' };
        this._staminaAdBusy = true;
        try {
            const claimId = globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`;
            const ad = await this.requestAdReward('stamina_ad', claimId, now);
            if (!ad.success) return { success: false, reason: ad.reason || (ad.status === 'cancelled' ? '광고를 취소했습니다' : '광고를 완료하지 못했습니다') };
            const t = Math.max(now, Date.now());
            const added = addOver(this.stamina, STAMINA.ad.amount, t, this.staminaMax(t));
            this.save();
            gameState.notify();
            this.recordAdReward('stamina_ad', claimId, 0, ad.mode);
            track('stamina_ad', { added, mode: ad.mode });
            return { success: true, added };
        } finally {
            this._staminaAdBusy = false;
        }
    },
    /** DM으로 +40 — { success, price, added } */
    buyStamina(now = Date.now()) {
        if (!this.stamina.on) return { success: false, reason: '아직 피로도가 없습니다' };
        const price = this.staminaBuyPrice(now);
        if (price === null) return { success: false, reason: '오늘 DM 충전을 다 썼어요 (한국 시간 0시에 다시 채워짐)' };
        if (gameState.darkMatter < price) return { success: false, reason: 'DM이 모자랍니다', price };
        gameState.darkMatter -= price;
        markBuy(this.stamina, now);
        const added = addOver(this.stamina, STAMINA.buy.amount, now, this.staminaMax(now));
        this.save();
        gameState.notify();
        track('stamina_buy', { price, added, n: this.stamina.buy.n });
        return { success: true, price, added };
    }
};
