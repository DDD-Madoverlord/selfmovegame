/* 공급자 교체 지점. 가짜 응답은 현재 실행의 메모리에만 남는다. */
import { PRODUCTS, productOf } from './shopCatalog_v2.js';
import { isMockCommerce, commerceEnvironment } from './commerceDev_v2.js';

const handlers = new Set();
const purchases = new Map();
let nextPurchase = 'success';
let nextAd = 'success';
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const mock = () => isMockCommerce();
export const payment = {
    get id() { return mock() ? 'mock' : 'unavailable'; },
    async getProducts(productIds = PRODUCTS.map(p => p.id)) {
        return productIds.map(productOf).filter(Boolean).map(p => ({ ...p, productId: p.id,
            currency: 'KRW', displayPrice: `${p.priceKRW.toLocaleString('ko-KR')}원`, available: mock() }));
    },
    async purchase(productId, requestId = id(), now = Date.now()) {
        if (!mock()) return { status: 'failed', reason: '결제 준비 중' };
        if (!productOf(productId)) return { status: 'failed', reason: '알 수 없는 상품' };
        const result = { productId, requestId, orderId: `mock-${id()}`, provider: 'mock',
            environment: commerceEnvironment().environment, status: nextPurchase, purchasedAt: now };
        nextPurchase = 'success';
        purchases.set(result.orderId, result);
        return { ...result };
    },
    async restore() {
        return mock() ? [...purchases.values()].filter(p => p.status === 'success' && productOf(p.productId)?.type === 'permanent').map(p => ({ ...p })) : [];
    },
    onPurchaseUpdated(handler) { handlers.add(handler); return () => handlers.delete(handler); }
};
export const ads = {
    get available() { return mock(); },
    async showRewarded(placement) {
        if (!mock()) return { status: 'failed', reason: '광고 준비 중' };
        if (placement !== 'idle_double') return { status: 'failed', reason: '알 수 없는 광고 위치' };
        const result = { status: nextAd, operationId: id(), provider: 'mock' };
        nextAd = 'success';
        return result;
    }
};
export function setMockResult(kind, status) {
    if (!mock() || !['success', 'cancelled', 'failed', ...(kind === 'purchase' ? ['pending'] : [])].includes(status)) return false;
    if (kind === 'purchase') nextPurchase = status;
    else if (kind === 'ad') nextAd = status;
    else return false;
    return true;
}
export function completeMockPurchase(orderId, status = 'success') {
    const order = purchases.get(orderId);
    if (!mock() || !order || order.status !== 'pending' || !['success', 'cancelled', 'failed'].includes(status)) return false;
    order.status = status;
    handlers.forEach(handler => handler({ ...order }));
    return true;
}
