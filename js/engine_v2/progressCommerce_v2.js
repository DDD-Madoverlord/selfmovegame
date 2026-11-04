/* Progress에 붙는 상점 권한·주문·매일 받기. 지급과 기록을 함께 즉시 저장한다. */
import { gameState } from '../engine/state.js';
import { track } from './analytics_v2.js';
import { productOf, CATALOG_VERSION, PASS_HOURS, PASS_DAILY, AD_LIMITS } from './shopCatalog_v2.js';
import { payment, ads } from './commerceProviders_v2.js';
import { isMockCommerce, commerceEnvironment } from './commerceDev_v2.js';
import { validateCommerce } from './saveStore_v2.js';
import { kstDayKey, kstWeekKey } from './kstTime_v2.js';
import { isPetReleased } from './pets_v2.js';

export function emptyCommerce() {
    return { schema: 1, permanents: {}, weeklyPass: null, orders: [],
        dailyAds: { dayKey: null, counts: {} }, weeklyPurchases: { weekKey: null, counts: {} },
        rewardClaims: {}, pendingPets: [], lastSeenAt: 0, mockSession: isMockCommerce() };
}
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const timeOf = (p, now) => {
    p.commerce.lastSeenAt = Math.max(p.commerce.lastSeenAt, now);
    return p.commerce.lastSeenAt;
};
const trusted = order => isMockCommerce() && order?.provider === 'mock' && ['local', 'app-dev'].includes(order.environment);
const commit = p => { p.save(); gameState.notify(); };

export const CommerceMethods = {
    loadCommerce(data) {
        this.commerce = emptyCommerce();
        if (data?.commerce !== undefined) {
            try { validateCommerce(data.commerce); this.commerce = { ...emptyCommerce(), ...JSON.parse(JSON.stringify(data.commerce)) }; }
            catch (e) { /* 손상된 상점만 버리고 기존 진행 보존 */ }
        }
        this.commerce.mockSession = isMockCommerce();
        if (!this._commerceUnsubscribe) this._commerceUnsubscribe = payment.onPurchaseUpdated(order => this.applyCommerceOrder(order));
    },
    activePass(now = Date.now()) {
        const p = this.commerce.weeklyPass;
        const t = timeOf(this, now);
        return !!p && this.commerce.orders.some(o => trusted(o) && o.orderId === p.orderId && o.productId === 'weekly_pass_7d'
            && o.status === 'success' && o.appliedAt !== null) && t >= p.startsAt && t < p.expiresAt;
    },
    hasPermanentProduct(productId) {
        const record = this.commerce.permanents[productId];
        return !!record && this.commerce.orders.some(o => trusted(o) && o.productId === productId && o.orderId === record.orderId
            && o.status === 'success' && o.appliedAt !== null);
    },
    hasPetEntitlement(id) {
        return id === 'clockwork_keeper' && (this.hasPermanentProduct('pet_clockwork_keeper')
            || this.commerce.orders.some(o => trusted(o) && o.productId === 'weekly_pass_7d' && o.status === 'success'
                && o.appliedAt !== null && this.commerce.rewardClaims[`pass:${o.orderId}:7`]));
    },
    hasAdRemoval(now = Date.now()) {
        return this.hasPermanentProduct('remove_ads_forever') || this.activePass(now);
    },
    canSkipAd(placement = 'idle_double', now = Date.now()) { return !!AD_LIMITS[placement] && this.hasAdRemoval(now); },
    offlineCapHours(now = Date.now()) { return this.activePass(now) ? 12 : 8; },
    canClaimPass(now = Date.now()) {
        const p = this.commerce.weeklyPass;
        return now >= this.commerce.lastSeenAt && this.activePass(now) && p.claimCount < 7
            && (!p.lastClaimDay || kstDayKey(now) > p.lastClaimDay);
    },
    commerceProductState(productId, now = Date.now()) {
        const product = productOf(productId);
        if (!product) return '알 수 없는 상품';
        if (product.grant.petId && typeof this.grantPet !== 'function') return '준비 중';
        if (product.grant.petId && !isPetReleased(product.grant.petId, now)) return '공개 예정';
        if (!isMockCommerce()) return '결제 준비 중';
        if (product.grant.petId && this.pets?.owned?.includes(product.grant.petId)) return '보유 중';
        if (this._commerceBusy?.has(productId) || this.commerce.orders.some(o => o.productId === productId && o.status === 'pending')) return '구매 확인 중';
        if (product.type === 'permanent' && this.commerce.permanents[productId]) return '보유 중';
        if (product.type === 'pass' && this.activePass(now)) return '이용 중';
        if (product.type === 'consumable' && this.commerce.orders.some(o => o.productId === productId && o.appliedAt !== null
            && kstWeekKey(o.appliedAt) === kstWeekKey(timeOf(this, now)))) return '이번 주 구매 완료';
        return null;
    },
    async purchaseProduct(productId, now = Date.now()) {
        const reason = this.commerceProductState(productId, now);
        if (reason) return { success: false, status: 'failed', reason };
        this._commerceBusy ||= new Set();
        this._commerceBusy.add(productId);
        const req = requestId();
        track('purchase_start', { productId, requestId: req, priceKRW: productOf(productId).priceKRW,
            provider: payment.id, environment: commerceEnvironment().environment });
        try {
            const result = await payment.purchase(productId, req, timeOf(this, now));
            return this.applyCommerceOrder(result, now);
        } catch (e) {
            track('purchase_result', { productId, requestId: req, status: 'failed', granted: false, reason: '공급자 오류',
                provider: payment.id, environment: commerceEnvironment().environment });
            return { success: false, status: 'failed', reason: '결제 요청 실패' };
        } finally { this._commerceBusy.delete(productId); }
    },
    applyCommerceOrder(result, now = Date.now()) {
        const product = productOf(result.productId);
        if (!product || !trusted(result) || !result.orderId || !result.requestId || !Number.isSafeInteger(result.purchasedAt)
            || result.purchasedAt < 0 || !['success', 'pending', 'cancelled', 'failed'].includes(result.status)) return { success: false, reason: '결제 준비 중' };
        const c = this.commerce;
        let order = c.orders.find(o => o.orderId === result.orderId);
        if (order && (order.productId !== result.productId || order.provider !== result.provider || order.requestId !== result.requestId)) return { success: false, reason: '주문 불일치' };
        if (order?.appliedAt !== null && order?.appliedAt !== undefined) return { success: true, status: 'success', granted: false, orderId: order.orderId };
        if (!order) {
            order = { requestId: result.requestId, orderId: result.orderId, productId: product.id, provider: result.provider,
                environment: result.environment, status: result.status, purchasedAt: result.purchasedAt,
                appliedAt: null, catalogVersion: CATALOG_VERSION, grant: { ...product.grant } };
            c.orders.push(order);
        }
        order.status = result.status;
        let granted = false;
        const t = timeOf(this, now);
        if (result.status === 'success') {
            const already = product.type === 'permanent' ? !!c.permanents[product.id]
                : product.type === 'pass' ? this.activePass(t)
                    : c.orders.some(o => o !== order && o.productId === product.id && o.appliedAt !== null && kstWeekKey(o.appliedAt) === kstWeekKey(t));
            if (already) {
                order.status = 'pending';
                this.save();
                track('purchase_result', { productId: product.id, requestId: order.requestId, status: 'pending',
                    reason: '중복 권한·주간 제한 확인 필요', granted: false, provider: order.provider, environment: order.environment });
                return { success: false, status: 'pending', reason: '중복 권한·주간 제한 확인 필요' };
            }
            // ⑧에서 구매 전 적립분을 정산하는 연결 지점.
            if (product.type === 'pass') this.settleOfflineBeforePass?.(t);
            order.appliedAt = t;
            if (product.type === 'permanent') c.permanents[product.id] = { provider: order.provider, orderId: order.orderId, purchasedAt: order.purchasedAt };
            if (product.type === 'pass') c.weeklyPass = { productId: product.id, provider: order.provider, orderId: order.orderId,
                startsAt: t, expiresAt: t + PASS_HOURS * 3600000, lastClaimDay: null, claimCount: 0 };
            if (product.type === 'consumable') {
                if (c.weeklyPurchases.weekKey !== kstWeekKey(t)) c.weeklyPurchases = { weekKey: kstWeekKey(t), counts: {} };
                c.weeklyPurchases.counts[product.id] = 1;
            }
            gameState.darkMatter += product.grant.dm || 0;
            this.shards += product.grant.shards || 0;
            if (product.grant.petId) this.grantCommercePet(product.grant.petId, order.orderId, 0);
            granted = true;
        }
        c.lastSeenAt = t;
        commit(this);
        track('purchase_result', { productId: product.id, requestId: order.requestId, status: order.status, granted,
            provider: order.provider, environment: order.environment });
        return { success: result.status === 'success', status: result.status, granted, orderId: order.orderId };
    },
    grantCommercePet(id, source, duplicateShards = 0) {
        if (!this.hasPetEntitlement(id)) return false;
        const key = `pet:${source}`;
        const claimed = !!this.commerce.rewardClaims[key];
        const owned = this.pets?.owned?.includes(id);
        if (claimed && owned) return true;
        if (!isPetReleased(id)) {
            if (!this.commerce.pendingPets.some(p => p.source === source)) this.commerce.pendingPets.push({ id, source, duplicateShards });
            return false;
        }
        let granted = !!owned;
        if (owned && duplicateShards && !claimed) this.shards += duplicateShards;
        else if (!owned && typeof this.grantPet === 'function') {
            try {
                const result = this.grantPet(id, { source: source.startsWith('pass:') ? 'pass' : 'shop', sourceId: source,
                    providerMode: isMockCommerce() ? 'mock' : 'none' });
                granted = result !== false && result?.success !== false;
            } catch (e) { /* 펫 모듈이 지급하지 못하면 보류 */ }
        }
        if (granted) this.commerce.rewardClaims[key] = true;
        else if (!this.commerce.pendingPets.some(p => p.source === source)) this.commerce.pendingPets.push({ id, source, duplicateShards });
        return granted;
    },
    /** ⑩의 지급 함수 연결 뒤 호출. 같은 보류 건을 다시 처리해도 중복 지급하지 않는다. */
    resolvePendingCommercePets() {
        if (typeof this.grantPet !== 'function') return;
        this.commerce.pendingPets = this.commerce.pendingPets.filter(p => !this.grantCommercePet(p.id, p.source, p.duplicateShards));
        commit(this);
    },
    claimPass(now = Date.now()) {
        if (!this.canClaimPass(now)) return { success: false, reason: '오늘 받을 패스 보상이 없습니다' };
        const c = this.commerce, p = c.weeklyPass;
        const key = `pass:${p.orderId}:${kstDayKey(now)}`;
        if (c.rewardClaims[key]) return { success: false, reason: '이미 받았습니다' };
        c.rewardClaims[key] = true;
        p.lastClaimDay = kstDayKey(now);
        p.claimCount++;
        c.lastSeenAt = timeOf(this, now);
        gameState.darkMatter += PASS_DAILY.dm;
        this.shards += PASS_DAILY.shards;
        if (p.claimCount === 7) {
            const source = `pass:${p.orderId}:7`;
            c.rewardClaims[source] = true;
            this.grantCommercePet('clockwork_keeper', source, 1);
        }
        commit(this);
        return { success: true, ...PASS_DAILY, claimCount: p.claimCount };
    },
    async restorePurchases() {
        if (!isMockCommerce()) return { success: false, reason: '결제 준비 중' };
        const orders = [...this.commerce.orders, ...await payment.restore()];
        for (const order of orders) {
            if (productOf(order.productId)?.type !== 'permanent' || order.status !== 'success' || !trusted(order)) continue;
            if (!this.commerce.orders.some(o => o.orderId === order.orderId)) this.applyCommerceOrder(order);
            const saved = this.commerce.orders.find(o => o.orderId === order.orderId && o.appliedAt !== null);
            if (!saved) continue;
            this.commerce.permanents[saved.productId] = { provider: saved.provider, orderId: saved.orderId, purchasedAt: saved.purchasedAt };
            const pet = productOf(saved.productId).grant.petId;
            if (pet) this.grantCommercePet(pet, saved.orderId, 0);
        }
        commit(this);
        return { success: true };
    },
    adQuotaRemaining(placement = 'idle_double', now = Date.now()) {
        if (!AD_LIMITS[placement]) return 0;
        const daily = this.commerce.dailyAds;
        return AD_LIMITS[placement] - (daily.dayKey === kstDayKey(timeOf(this, now)) ? daily.counts[placement] || 0 : 0);
    },
    consumeAdQuota(placement, claimId, now = Date.now()) {
        if (typeof claimId !== 'string' || !claimId || claimId.length > 150 || !this.adQuotaRemaining(placement, now)) return false;
        const c = this.commerce, key = `ad:${placement}:${claimId}`;
        if (c.rewardClaims[key]) return false;
        const t = timeOf(this, now), dayKey = kstDayKey(t);
        if (c.dailyAds.dayKey !== dayKey) c.dailyAds = { dayKey, counts: {} };
        c.dailyAds.counts[placement] = (c.dailyAds.counts[placement] || 0) + 1;
        c.rewardClaims[key] = true;
        c.lastSeenAt = t;
        this.save();
        return true;
    },
    /** ⑧은 이 자격 결과를 받고 같은 저장에 추가 DM과 수령 기록을 반영한다. */
    async requestAdReward(placement, claimId, now = Date.now()) {
        if (!this.adQuotaRemaining(placement, now)) return { success: false, reason: '오늘 광고 한도에 도달했습니다' };
        const skip = this.canSkipAd(placement, now);
        const result = skip ? { status: 'success' } : await ads.showRewarded(placement);
        if (result.status !== 'success') return { success: false, ...result };
        if (!this.consumeAdQuota(placement, claimId, now)) return { success: false, reason: '이미 받았거나 한도 초과' };
        return { success: true, claimId, mode: skip ? 'entitlement' : 'mock' };
    },
    /** ⑧이 실제 추가 DM과 수령 기록을 저장한 뒤 호출하는 통계 연결 지점. */
    recordAdReward(placement, claimId, grantedDm, mode) {
        const c = this.commerce, key = `ad_event:${placement}:${claimId}`;
        if (!c.rewardClaims[`ad:${placement}:${claimId}`] || c.rewardClaims[key]
            || !Number.isSafeInteger(grantedDm) || grantedDm < 0 || !['ad', 'entitlement', 'mock'].includes(mode)) return false;
        c.rewardClaims[key] = true;
        this.save();
        track('ad_reward', { placement, claimId, mode, grantedDm, provider: payment.id, environment: commerceEnvironment().environment });
        return true;
    }
};
