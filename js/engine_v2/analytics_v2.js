/* ==========================================================================
   게임 통계 이벤트 층 (v2): 기기 안 기록으로 유입 → 첫 플레이 → 재접속을 확인한다.
   이벤트: first_open, session_start, screen_view, stage_start, stage_end,
           part_purchase, session_end. 개인정보 없이 무작위 installId만 사용한다.
   공급자 추가: addAnalyticsProvider(event => { ... }); Firebase Analytics / GA4도
   이 함수로 연결한다. 실제 외부 전송 공급자를 붙일 때 개인정보 동의·처리방침이 필요하다.
   ========================================================================== */

import { VERSION, BUILD } from '../version_v2.js';

function readStored(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
}

function writeStored(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 시에도 게임은 계속 */ }
}

function randomId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const storedLog = readStored('mo_analytics_log', []);
let log = Array.isArray(storedLog) ? storedLog.slice(-200) : [];
const providers = [event => {
    log.push(event);
    log = log.slice(-200);
    writeStored('mo_analytics_log', log);
}, event => {
    if (new URLSearchParams(window.location.search).get('debugAnalytics') === '1') console.debug('[analytics]', event);
}];
let session = null;
let sessionEnded = false;

export function addAnalyticsProvider(fn) {
    if (typeof fn === 'function') providers.push(fn);
}

export function readAnalyticsLog() {
    return log.slice();
}

function attribution(ts) {
    const query = new URLSearchParams(window.location.search);
    const touch = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        if (query.get(key)) touch[key] = query.get(key);
    }
    if (window.madOverlordApp && !Object.keys(touch).length) return touch;
    try {
        if (document.referrer) touch.referrer = new URL(document.referrer).host;
    } catch (e) { /* 유효하지 않은 참조 주소는 생략 */ }
    touch.landedAt = ts;
    return touch;
}

export function initAnalytics() {
    if (session) return;
    const ts = Date.now();
    const savedFirstOpen = readStored('mo_first_open_at', null);
    const isFirstSession = !Number.isFinite(savedFirstOpen) || savedFirstOpen <= 0;
    const firstOpenAt = isFirstSession ? ts : savedFirstOpen;
    const installId = readStored('mo_install_id', null) || randomId();
    writeStored('mo_install_id', installId);
    if (isFirstSession) writeStored('mo_first_open_at', firstOpenAt);
    session = { sessionId: randomId(), installId, firstOpenAt, startedAt: ts };
    const lastTouch = attribution(ts);
    let firstTouch = readStored('mo_attribution', null);
    if (!firstTouch || typeof firstTouch !== 'object' || Array.isArray(firstTouch)) {
        firstTouch = { ...lastTouch, landedAt: ts };
        writeStored('mo_attribution', firstTouch);
    }
    if (isFirstSession) track('first_open');
    track('session_start', { firstTouch, lastTouch, isFirstSession });

    const endSession = () => {
        if (sessionEnded) return;
        sessionEnded = true;
        track('session_end', { duration: Math.max(0, (Date.now() - session.startedAt) / 1000) });
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') endSession();
    });
    window.addEventListener('pagehide', endSession);
}

export function track(name, params = {}) {
    initAnalytics();
    const ts = Date.now();
    const event = {
        ...params, name, ts,
        sessionId: session.sessionId,
        installId: session.installId,
        platform: window.madOverlordApp ? 'app' : 'web',
        version: VERSION, build: BUILD,
        firstOpenAt: session.firstOpenAt,
        daysSinceFirst: Math.max(0, Math.floor((ts - session.firstOpenAt) / 86400000))
    };
    for (const provider of providers) {
        try {
            const pending = provider(event);
            if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        } catch (e) { /* 공급자 오류가 게임이나 다른 공급자를 막지 않음 */ }
    }
}
