/* 방치 보상: 실제 부재만 합산하고, 수령 전 묶음의 조건은 고정한다. */
import { gameState } from '../engine/state.js';
import { STAGES } from './stages_v2.js';
import { track } from './analytics_v2.js';

export const OFFLINE_MIN_MS = 10 * 60 * 1000;
export const OFFLINE_HOUR_MS = 3600000;
const FACTORS = { normal: 1, hard: 1.2, hell: 1.4, nightmare: 1.6 };
const uint = n => Number.isSafeInteger(n) && n >= 0;
const identifier = s => typeof s === 'string' && s.length > 0 && s.length <= 150;

export function emptyOffline() {
    return { lastSeenAt: 0, awayAt: null, pool: null, lastClaimId: null, adPending: false };
}

export function validateOffline(o) {
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const shape = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
    const fail = () => { throw new Error('방치 보상 저장 데이터가 올바르지 않습니다.'); };
    if (!shape(o, ['lastSeenAt', 'awayAt', 'pool', 'lastClaimId', ...(Object.hasOwn(o || {}, 'adPending') ? ['adPending'] : [])])
        || !uint(o.lastSeenAt) || (o.adPending !== undefined && typeof o.adPending !== 'boolean')
        || !(o.awayAt === null || (uint(o.awayAt) && o.awayAt <= o.lastSeenAt))
        || !(o.lastClaimId === null || identifier(o.lastClaimId))) fail();
    const p = o.pool;
    if (p !== null && (!shape(p, ['id', 'stageId', 'difficulty', 'ratePerHour', 'capMs', 'elapsedMs', 'readyReported',
        ...(Object.hasOwn(p || {}, 'dmBonus') ? ['dmBonus'] : [])])
        || !identifier(p.id) || p.id === o.lastClaimId || !STAGES.some(s => s.id === p.stageId)
        || !Object.hasOwn(FACTORS, p.difficulty) || !uint(p.ratePerHour) || p.ratePerHour <= 0
        || ![8, 12].includes(p.capMs / OFFLINE_HOUR_MS) || !uint(p.elapsedMs) || p.elapsedMs > p.capMs
        || typeof p.readyReported !== 'boolean' || (p.readyReported && p.elapsedMs < OFFLINE_MIN_MS)
        || (p.dmBonus !== undefined && (!Number.isFinite(p.dmBonus) || p.dmBonus < 0 || p.dmBonus > 0.25)))) fail();
    return true;
}

export function offlineRate(stageId, difficulty = 'normal') {
    const s = STAGES.find(v => v.id === stageId);
    if (!s || !Object.hasOwn(FACTORS, difficulty)) return 0;
    const part = stageId.split('-')[1];
    const p = part === 'B' ? 11 : Number(part);
    return Math.floor(s.zone * (100 + 2 * (p - 1)) * FACTORS[difficulty]);
}

export function bestOfflineStage(progress) {
    let best = null;
    for (const difficulty of Object.keys(FACTORS)) {
        for (const s of STAGES) {
            if (!progress.stage(s.id, difficulty).cleared) continue;
            const ratePerHour = offlineRate(s.id, difficulty);
            if (!best || ratePerHour > best.ratePerHour) best = { stageId: s.id, difficulty, ratePerHour };
        }
    }
    return best;
}

export function offlineDm(pool) {
    if (!pool) return 0;
    const base = Math.floor(pool.ratePerHour * pool.elapsedMs / OFFLINE_HOUR_MS);
    return Math.floor(base * (1 + Math.min(0.25, Math.max(0, pool.dmBonus || 0))));
}

const eventData = p => ({ reward_id: p.id, stage_id: p.stageId, difficulty: p.difficulty,
    elapsed_seconds: p.elapsedMs / 1000, cap_seconds: p.capMs / 1000, rate_per_hour: p.ratePerHour, base_dm: offlineDm(p) });

export const OfflineMethods = {
    offlineUnlocked() { return this.stage('1-1', 'normal').cleared; },
    loadOffline(data, now = Date.now()) {
        this.offline = emptyOffline();
        let valid = false;
        if (data?.offline !== undefined) {
            try { validateOffline(data.offline); this.offline = JSON.parse(JSON.stringify(data.offline)); valid = true; }
            catch (e) { /* 손상된 방치 필드만 버리고 진행·재화는 보존 */ }
        }
        if (!valid && data?.offline === undefined && uint(data?.savedAt) && data.savedAt > 0 && this.offlineUnlocked()) {
            this.offline.lastSeenAt = data.savedAt;
        }
        if (!this.offlineUnlocked()) this.offline = emptyOffline();
        const o = this.offline;
        const start = Math.max(o.awayAt ?? 0, o.lastSeenAt) || now;
        if (!o.adPending && this.offlineUnlocked() && now > start) this.addOfflineTime(start, now);
        o.lastSeenAt = Math.max(o.lastSeenAt, now);
        o.awayAt = null;
        o.adPending = false;
    },
    ensureOfflinePool(now = Date.now()) {
        if (!this.offlineUnlocked() || this.offline.pool) return;
        const best = bestOfflineStage(this);
        if (!best) return;
        this.offline.pool = { id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random()}`, ...best,
            capMs: this.offlineCapHours(now) * OFFLINE_HOUR_MS, elapsedMs: 0, readyReported: false,
            dmBonus: Math.min(0.25, Math.max(0, this.petOfflineDmBonus())) };
    },
    addOfflineTime(start, now) {
        if (!uint(now) || now <= start || !this.offlineUnlocked()) return;
        this.ensureOfflinePool(start);
        const p = this.offline.pool;
        if (p) p.elapsedMs = Math.min(p.capMs, p.elapsedMs + now - start);
    },
    offlineActivity(now = Date.now()) {
        if (!uint(now) || !this.offlineUnlocked() || this.offlineStorageCurrent?.() === false
            || this.offline.awayAt !== null || this._offlineBusy) return;
        this.offline.lastSeenAt = Math.max(this.offline.lastSeenAt, now);
        this.save();
    },
    offlineAway(now = Date.now()) {
        if (!uint(now) || !this.offlineUnlocked() || this.offlineStorageCurrent?.() === false
            || this._offlineBusy || this.offline.awayAt !== null) return;
        const o = this.offline;
        o.lastSeenAt = Math.max(o.lastSeenAt, now);
        this.ensureOfflinePool(o.lastSeenAt);
        o.awayAt = o.lastSeenAt;
        this.save();
    },
    offlineReturn(now = Date.now()) {
        if (!uint(now) || !this.offlineUnlocked() || this.offlineStorageCurrent?.() === false || this._offlineBusy) return;
        const o = this.offline;
        if (o.awayAt !== null) this.addOfflineTime(Math.max(o.awayAt, o.lastSeenAt), now);
        o.lastSeenAt = Math.max(o.lastSeenAt, now);
        o.awayAt = null;
        this.save();
    },
    settleOfflineBeforePass(now = Date.now()) { this.offlineReturn(now); },
    settleOfflineBeforePet(now = Date.now()) { this.offlineReturn(now); },
    offlineReward(reportReady = false) {
        const p = this.offline.pool;
        const ready = this.offlineUnlocked() && !!p && p.elapsedMs >= OFFLINE_MIN_MS;
        if (ready && reportReady && !p.readyReported) {
            p.readyReported = true;
            this.save();
            track('offline_reward_ready', { ...eventData(p), multiplier: 1 });
        }
        return { unlocked: this.offlineUnlocked(), ready, pool: p, dm: offlineDm(p) };
    },
    async claimOfflineReward(double = false, now = Date.now()) {
        if (this._offlineBusy || !this.offlineReward().ready) return { success: false, reason: '받을 방치 보상이 없습니다' };
        if (this.offlineStorageCurrent?.() === false) return { success: false, reason: '저장 내용이 바뀌었습니다. 새로고침해 주세요' };
        const p = this.offline.pool;
        if (p.id === this.offline.lastClaimId) return { success: false, reason: '이미 받은 보상입니다' };
        this._offlineBusy = true;
        const clockStart = Date.now();
        let ad = null;
        try {
            if (double) {
                this.offline.adPending = true;
                this.save();   // 광고 도중 종료되어도 다음 접속에서 광고 시간을 제외
                try { ad = await this.requestAdReward('idle_double', p.id, now); }
                catch (e) { return { success: false, reason: '광고 요청에 실패했습니다. 다시 시도해 주세요' }; }
                if (!ad.success) return { success: false, reason: ad.reason || (ad.status === 'cancelled' ? '광고를 취소했습니다' : '광고를 완료하지 못했습니다') };
            }
            if (this.offline.pool !== p || this.offline.lastClaimId === p.id) return { success: false, reason: '보상 상태가 바뀌었습니다' };
            const multiplier = double ? 2 : 1, grantedDm = offlineDm(p) * multiplier;
            const claimMethod = double ? ad.mode === 'entitlement' ? 'ad_free' : 'ad' : 'base';
            gameState.darkMatter += grantedDm;
            this.offline.pool = null;
            this.offline.lastClaimId = p.id;
            this.save();   // 재화·묶음 삭제·수령 ID를 한 저장에 함께 반영
            track('offline_reward_claim', { ...eventData(p), granted_dm: grantedDm, multiplier, claim_method: claimMethod });
            if (ad) this.recordAdReward('idle_double', p.id, grantedDm, ad.mode);
            gameState.notify();
            return { success: true, grantedDm, multiplier };
        } finally {
            this._offlineBusy = false;
            if (double) {
                // 광고가 가린 시간은 적립하지 않고, 광고 종료 뒤부터 다시 측정한다.
                const endedAt = now + Math.max(0, Date.now() - clockStart);
                this.offline.lastSeenAt = Math.max(this.offline.lastSeenAt, endedAt);
                this.offline.awayAt = null;
                this.offline.adPending = false;
                if (typeof document !== 'undefined' && document.hidden) this.offlineAway(endedAt);
            }
            this.save();
        }
    }
};
