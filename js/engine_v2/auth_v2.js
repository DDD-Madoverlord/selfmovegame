/* ==========================================================================
   PROJECT: MAD OVERLORD // 계정 연동 창구 (D-119 2번 · D-106)
   처음 실행은 로그인 없이 게스트(지금 기기 저장 그대로). 로그인은 구글 계정만, 연동하면 게스트 기록을 서버 계정으로 옮기고
   연동 보상 DM 5,000(구글 계정마다 한 번 — 서버가 판단). 이미 기록이 있는 구글 계정이면 두 기록 중 하나를 고름(합치지 않음).

   화면(js/ui_v2/account_v2.js)은 아래 auth의 함수 네 개만 부른다:
     linkGoogle() → { status: 'linked' | 'conflict' | 'error', email?, server?, reason? }
     chooseRecord('device' | 'server') → { status: 'linked' }
     signOut() · deleteAccount()
   ★ 실제 구글 로그인·Supabase 연결은 Trello 12번 담당 팀원 몫 — 이 파일의 provider만 바꿔 끼우면 화면은 안 고침
     (웹 signInWithOAuth, 앱은 기기 구글 로그인 → signInWithIdToken, D-106 추천). 지금은 '준비 중' 응답.
   로컬 시험: ?mockAuth=linked | conflict | error-net | error-cancel | error-server (localhost만) — 화면 흐름 검사용 가짜 결과

   저장 (mo_v2_account): { status: 'guest' | 'linked', email, linkedAt, rewardClaimed, promptShown }
   ========================================================================== */

import * as saveStore from './saveStore_v2.js';

const KEY = 'mo_v2_account';
export const LINK_REWARD_DM = 5000;

const empty = () => ({ status: 'guest', email: null, linkedAt: null, rewardClaimed: false, promptShown: false });

function read() {
    try {
        const v = JSON.parse(saveStore.load(KEY) || 'null');
        return v && typeof v === 'object' ? { ...empty(), ...v } : empty();
    } catch (e) {
        return empty();
    }
}

let account = read();
const listeners = new Set();

function write() {
    try { saveStore.save(KEY, JSON.stringify(account)); } catch (e) { /* 저장소를 못 써도 화면은 계속 */ }
    listeners.forEach(fn => { try { fn(account); } catch (e) { /* 무시 */ } });
}

function localHost() {
    return typeof location !== 'undefined' && ['localhost', '127.0.0.1', ''].includes(location.hostname);
}

function mockMode() {
    return localHost() ? new URLSearchParams(location.search).get('mockAuth') : null;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/** 진짜 연동 공급자 (팀원이 채움). 없으면 '준비 중' */
let provider = null;
export function setAuthProvider(p) {
    provider = p;
}

export const auth = {
    state() {
        return { ...account };
    },
    subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    /** 1-5 뒤 안내를 이미 보였는지 (한 번만 — D-106) */
    markPrompted() {
        account.promptShown = true;
        write();
    },
    async linkGoogle() {
        const mock = mockMode();
        if (mock) {
            await wait(600);
            if (mock === 'linked') return this._linked('player****@gmail.com');
            if (mock === 'conflict') return { status: 'conflict', email: 'player****@gmail.com',
                server: { zone: 4, characters: 4, dm: 48200, stars: 118, lastPlayed: '11월 2일' } };
            const reason = { 'error-net': 'net', 'error-cancel': 'cancel', 'error-server': 'server' }[mock] || 'server';
            return { status: 'error', reason };
        }
        if (!provider) return { status: 'error', reason: 'not_ready' };
        try {
            const r = await provider.linkGoogle();
            return r.status === 'linked' ? this._linked(r.email) : r;
        } catch (e) {
            return { status: 'error', reason: 'server' };
        }
    },
    async chooseRecord(side) {
        if (provider && !mockMode()) await provider.chooseRecord(side);
        return this._linked(account.email || 'player****@gmail.com');
    },
    async signOut() {
        if (provider && !mockMode()) await provider.signOut();
        account = { ...empty(), promptShown: true, rewardClaimed: account.rewardClaimed };
        write();
        return { status: 'guest' };
    },
    async deleteAccount() {
        if (provider && !mockMode()) await provider.deleteAccount();
        account = { ...empty(), promptShown: true };
        write();
        return { status: 'guest' };
    },
    _linked(email) {
        const first = !account.rewardClaimed;
        account = { ...account, status: 'linked', email, linkedAt: Date.now(), rewardClaimed: true };
        write();
        return { status: 'linked', email, reward: first ? LINK_REWARD_DM : 0 };
    }
};
