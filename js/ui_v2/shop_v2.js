/* 사용자 요청으로만 여는 상점. 재화·권한 변경은 progress가 담당한다. */
import { progress } from '../engine_v2/progress_v2.js';
import { PRODUCTS, productOf } from '../engine_v2/shopCatalog_v2.js';
import { payment, setMockResult, completeMockPurchase } from '../engine_v2/commerceProviders_v2.js';
import { isMockCommerce, commerceEnvironment } from '../engine_v2/commerceDev_v2.js';
import { track } from '../engine_v2/analytics_v2.js';
import { commerceDialog, openProbInfo } from './probInfo_v2.js';

export function openShop(entry = 'menu', onChange = () => {}) {
    if (document.querySelector('.v2-shop')) return;
    const dialog = commerceDialog('v2-shop', '상점');
    let confirming = null, busy = false, message = '', pendingOrder = null;
    track('shop_open', { entry, tab: 'products', provider: payment.id, environment: commerceEnvironment().environment });
    dialog.panel.innerHTML = `<header><h2>상점</h2><button class="v2-btn v2-btn--ghost" data-act="close">닫기</button></header>
        <p data-mode></p><div data-products></div><section data-confirm hidden></section>
        <p data-result role="status" aria-live="polite"></p><div class="v2-commerce__actions">
        <button class="v2-btn" data-act="claim">오늘 패스 받기</button>
        <button class="v2-btn v2-btn--ghost" data-act="restore">구매 복원</button>
        <button class="v2-btn v2-btn--ghost" data-act="prob">확률 정보</button></div>
        ${isMockCommerce() ? '<label>시험 구매 결과 <select data-mock><option value="success">성공</option><option value="cancelled">취소</option><option value="failed">실패</option><option value="pending">대기</option></select></label><button class="v2-btn v2-btn--ghost" data-act="complete" hidden>대기 주문 성공 통지</button>' : ''}`;
    const render = () => {
        if (!dialog.overlay.isConnected) return;
        dialog.panel.querySelector('[data-mode]').textContent = isMockCommerce()
            ? '시험 구매 — 실제 청구 없음. 메모리에서만 시험하며 새로고침하면 시험분은 사라집니다. 시험 중 백업 내보내기 불가.' : '결제 준비 중 · 실제 결제와 광고는 아직 연결되지 않았습니다.';
        dialog.panel.querySelector('[data-products]').innerHTML = PRODUCTS.map(p => {
            const reason = progress.commerceProductState(p.id);
            return `<article class="v2-shop__product"><div><h3>${p.name} · ${p.priceKRW.toLocaleString('ko-KR')}원</h3><p>${p.desc}</p></div>
                <button class="v2-btn" data-buy="${p.id}" ${reason || busy ? 'disabled' : ''}>${reason || '구매'}</button></article>`;
        }).join('');
        const pass = progress.commerce.weeklyPass;
        const claim = dialog.panel.querySelector('[data-act="claim"]');
        claim.disabled = busy || !progress.canClaimPass();
        claim.textContent = !pass ? '패스 미보유' : !progress.activePass() ? '패스 기간 종료'
            : pass.claimCount >= 7 ? '7회 모두 받음' : progress.canClaimPass() ? `오늘 받기 · ${pass.claimCount}/7회` : `오늘 받음 · ${pass.claimCount}/7회`;
        claim.title = pass ? `만료: ${new Date(pass.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 한국시간` : '';
        dialog.panel.querySelector('[data-act="restore"]').disabled = busy || !isMockCommerce();
        dialog.panel.querySelector('[data-result]').textContent = message;
        dialog.panel.querySelector('[data-products]').hidden = !!confirming;
        dialog.panel.querySelector('[data-confirm]').hidden = !confirming;
        const complete = dialog.panel.querySelector('[data-act="complete"]');
        if (complete) complete.hidden = !pendingOrder;
    };
    const run = async fn => {
        if (busy) return;
        busy = true; render();
        try { await fn(); } catch (e) { message = '요청을 완료하지 못했습니다. 다시 시도해 주세요.'; }
        finally { busy = false; render(); onChange(); }
    };
    dialog.panel.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        if (btn.dataset.buy) {
            confirming = productOf(btn.dataset.buy);
            const box = dialog.panel.querySelector('[data-confirm]');
            box.innerHTML = `<h3>구매 확인</h3><p>${confirming.name} · ${confirming.priceKRW.toLocaleString('ko-KR')}원</p><p>${confirming.desc}</p>
                <p>시험 구매 — 실제 청구 없음</p><button class="v2-btn" data-act="purchase">구매 확정</button> <button class="v2-btn v2-btn--ghost" data-act="back">돌아가기</button>`;
            render(); box.querySelector('[data-act="back"]').focus();
        } else if (btn.dataset.act === 'close') dialog.close();
        else if (btn.dataset.act === 'back' && !busy) { confirming = null; render(); }
        else if (btn.dataset.act === 'prob') openProbInfo();
        else if (btn.dataset.act === 'purchase') run(async () => {
            btn.disabled = true;
            setMockResult('purchase', dialog.panel.querySelector('[data-mock]').value);
            const result = await progress.purchaseProduct(confirming.id);
            confirming = null;
            pendingOrder = result.status === 'pending' ? result.orderId : null;
            message = result.status === 'success' ? '구매 성공 · 표시된 구성과 권한을 지급했습니다.' : result.status === 'cancelled' ? '구매를 취소했습니다.'
                : result.status === 'pending' ? '구매 확인 중 · 성공 확인 전에는 지급하지 않습니다.' : result.reason || '구매 실패 · 다시 시도해 주세요.';
        });
        else if (btn.dataset.act === 'claim') run(async () => {
            const hadPet = progress.ownsPet('clockwork_keeper');
            const r = progress.claimPass(); message = r.success ? `1,500 DM·조각 3개 받음 (${r.claimCount}/7회)`
                + (r.claimCount === 7 ? hadPet ? ' · 펫 중복 조각 1개' : progress.ownsPet('clockwork_keeper') ? ' · 태엽 묘지기 획득' : ' · 펫 공개 후 지급' : '') : r.reason;
        });
        else if (btn.dataset.act === 'restore') run(async () => {
            const r = await progress.restorePurchases(); message = r.success ? '영구 구매 복원을 확인했습니다. 소모 재화는 다시 지급하지 않습니다.' : r.reason;
        });
        else if (btn.dataset.act === 'complete') {
            completeMockPurchase(pendingOrder); pendingOrder = null; message = '대기 주문 성공을 확인했습니다.'; render(); onChange();
        }
    });
    const timer = setInterval(render, 15000);
    const unsubscribe = payment.onPurchaseUpdated(result => {
        if (!progress.commerce.orders.some(o => o.orderId === result.orderId)) return;
        pendingOrder = null;
        message = result.status === 'success' ? '구매 성공을 확인했습니다.' : result.status === 'cancelled' ? '구매를 취소했습니다.' : '구매 확인에 실패했습니다.';
        render(); onChange();
    });
    dialog.onClose(() => { clearInterval(timer); unsubscribe(); onChange(); });
    render();
    dialog.panel.querySelector('[data-act="close"]').focus();
}
