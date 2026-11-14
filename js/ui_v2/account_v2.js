/* ==========================================================================
   PROJECT: MAD OVERLORD // 계정 연동 화면 (D-119 2번 · D-106, 시안 https://claude.ai/artifact/Xjf9JxAjYV3sgowDKApbTu 02 탭)
   여는 곳: ① 노말 1-5를 처음 깨고 메뉴로 돌아올 때 한 번(entry 'prompt') ② 시작 화면 계정 줄 ③ 설정 › 계정 (entry 'settings')
   상태: 게스트(기록 요약 · 연동 보상 · 동의 2개 · 구글 단추) → 연결 중 → 연동됨 / 기록이 둘(하나 고름) / 실패(이유별 한 줄)
   로그인 자체는 engine_v2/auth_v2.js (지금은 '준비 중', 로컬 ?mockAuth=…로 화면 흐름 시험)
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { auth } from '../engine_v2/auth_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { track } from '../engine_v2/analytics_v2.js';
import { STAGES } from '../engine_v2/stages_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ERR = {
    net: ['인터넷에 연결되지 않았어요', '연결을 확인한 뒤 다시 시도하세요. 게스트 기록은 그대로 있습니다.'],
    cancel: ['로그인을 취소했어요', '언제든 다시 연동할 수 있어요. 게스트 기록은 그대로 있습니다.'],
    server: ['서버에서 연동을 끝내지 못했어요', '잠시 뒤 다시 시도하세요. 계속 안 되면 고객센터에 알려 주세요.'],
    not_ready: ['구글 연동은 준비 중이에요', '지금은 게스트로 계속 즐겨 주세요. 기록은 이 기기에 저장됩니다.']
};

let el = null;
let view = { state: 'guest', entry: 'settings', pick: null, server: null, err: null, agree: [false, false], confirm: false };

/** 지금 기록 요약 (게스트 화면 · 기록 고르기 카드) */
function deviceRecord() {
    const front = STAGES.find(s => !progress.stage(s.id, 'normal').cleared) || STAGES[STAGES.length - 1];
    return { zone: front.zone, characters: ROSTER.filter(c => progress.isCharacterUnlocked(c.id)).length, dm: gameState.darkMatter, stars: progress.totalStars() };
}

export function openAccount(entry = 'settings') {
    const a = auth.state();
    view = { state: a.status === 'linked' ? 'linked' : 'guest', entry, pick: null, server: null, err: null, agree: [false, false], confirm: false };
    if (entry === 'prompt') auth.markPrompted();
    track('screen_view', { screen: 'account', entry });
    if (!el) {
        el = document.createElement('div');
        el.className = 'v2-account';
        el.addEventListener('click', onClick);
        el.addEventListener('change', onChange);
        document.body.appendChild(el);
    }
    render();
}

export function closeAccount() {
    if (el) el.remove();
    el = null;
}

/** 1-5를 처음 깨고 메뉴로 돌아왔을 때 한 번만 (D-106) — main_v2.js 화면 전환에서 부름 */
export function maybePromptAccount() {
    const a = auth.state();
    if (a.status !== 'guest' || a.promptShown || el) return false;
    if (!progress.stage('1-5', 'normal').cleared) return false;
    openAccount('prompt');
    return true;
}

function head() {
    return view.entry === 'prompt'
        ? '<small class="v2-account__kicker">ACCOUNT LINK</small><h2>기록을 안전하게 지키세요</h2><p class="v2-account__sub">지금 기록은 이 기기에만 저장돼 있어요. 구글 계정에 연동하면 기기를 바꾸거나 앱을 다시 설치해도 이어서 할 수 있습니다.</p>'
        : '<small class="v2-account__kicker">SETTINGS · ACCOUNT</small><h2>계정</h2>';
}

function render() {
    if (!el) return;
    const d = deviceRecord();
    const rec = r => `<div class="v2-account__rec"><span>진행<b>구역 ${r.zone}</b></span><span>캐릭터<b>${r.characters}명</b></span><span>DM<b>${Number(r.dm).toLocaleString()}</b></span><span>별<b>${r.stars}</b></span></div>`;
    let body = '';
    if (view.state === 'guest') {
        const ok = view.agree[0] && view.agree[1];
        body = `${head()}${rec(d)}${auth.state().rewardClaimed ? '' : '<span class="v2-account__reward">◆ 연동 보상 DM 5,000</span>'}
            <div class="v2-account__checks">
                <label><input type="checkbox" data-agree="0" ${view.agree[0] ? 'checked' : ''}> 이용약관 동의 (필수)</label>
                <label><input type="checkbox" data-agree="1" ${view.agree[1] ? 'checked' : ''}> 개인정보 처리방침 동의 (필수)</label>
            </div>
            <div class="v2-account__row"><button class="v2-account__google" data-act="link" ${ok ? '' : 'disabled'}><span class="g" aria-hidden="true">G</span>Google로 계속하기</button>
                <button class="v2-btn v2-btn--ghost" data-act="close">${view.entry === 'prompt' ? '나중에' : '닫기'}</button></div>
            <p class="v2-account__fine">로그인은 구글 계정만 씁니다. 게스트 기록은 연동하는 순간 그대로 옮겨집니다.</p>`;
    } else if (view.state === 'linking') {
        body = `<small class="v2-account__kicker">CONNECTING</small><h2>구글 로그인 중</h2><div class="v2-account__spin" aria-hidden="true"></div>
            <p class="v2-account__sub">열린 구글 로그인 창에서 계정을 고르세요.</p>`;
    } else if (view.state === 'conflict') {
        const s = view.server || {};
        const card = (side, title, r, when) => `<button class="v2-account__card${view.pick === side ? ' is-on' : ''}" data-act="pick" data-side="${side}">
            <strong>${title}</strong><span>진행 <em>구역 ${r.zone}</em> · 캐릭터 <em>${r.characters}명</em></span><span>DM <em>${Number(r.dm).toLocaleString()}</em> · 별 <em>${r.stars}</em></span><span>${esc(when)}</span></button>`;
        const lose = view.pick === 'device' ? '구글 계정에 저장된 기록' : '이 기기 (게스트) 기록';
        body = `<small class="v2-account__kicker">TWO RECORDS</small><h2>이 구글 계정에 이미 기록이 있어요</h2><p class="v2-account__sub">두 기록은 합칠 수 없어요. 이어서 할 기록 하나를 고르세요.</p>
            <div class="v2-account__pick">${card('device', '이 기기 (게스트)', d, '지금 이 기기')}${card('server', '구글 계정에 저장된 기록', { zone: s.zone, characters: s.characters, dm: s.dm, stars: s.stars }, `마지막 플레이 ${s.lastPlayed || '-'}`)}</div>
            <p class="v2-account__warn">${view.pick ? (view.confirm ? `한 번 더 누르면 '${lose}'은 지워집니다. 되돌릴 수 없어요.` : `고르지 않은 '${lose}'은 지워집니다.`) : '기록 카드를 눌러 고르세요.'}</p>
            <div class="v2-account__row"><button class="v2-btn" data-act="choose" ${view.pick ? '' : 'disabled'}>${view.confirm ? '정말 이 기록으로 계속' : '이 기록으로 계속'}</button><button class="v2-btn v2-btn--ghost" data-act="back">취소</button></div>`;
    } else if (view.state === 'linked') {
        const a = auth.state();
        body = `<small class="v2-account__kicker">LINKED</small><h2>구글 계정에 연동됨</h2>
            <dl class="v2-account__info"><dt>계정</dt><dd>${esc(a.email || '')}</dd><dt>연동 보상</dt><dd>${a.rewardClaimed ? 'DM 5,000 받음' : '-'}</dd></dl>
            <div class="v2-account__row"><button class="v2-btn v2-btn--ghost" data-act="signout">로그아웃</button><button class="v2-btn v2-btn--danger" data-act="delete">${view.confirm ? '정말 계정 삭제' : '계정 삭제'}</button><button class="v2-btn v2-btn--ghost" data-act="close">닫기</button></div>
            <p class="v2-account__fine">로그아웃해도 기록은 서버에 남습니다. 계정 삭제는 서버 기록까지 지우며 되돌릴 수 없어요.</p>`;
    } else {
        const [t, m] = ERR[view.err] || ERR.server;
        body = `${head()}<div class="v2-account__err"><b>!</b><div><b>${t}</b><br>${m}</div></div>
            <div class="v2-account__row"><button class="v2-btn" data-act="retry">다시 시도</button><button class="v2-btn v2-btn--ghost" data-act="close">닫기</button></div>`;
    }
    el.innerHTML = `<div class="v2-account__panel v2-panel" role="dialog" aria-label="계정 연동" data-state="${view.state}">${body}</div>`;
}

function onChange(e) {
    const i = e.target.dataset.agree;
    if (i == null) return;
    view.agree[Number(i)] = e.target.checked;
    render();
}

async function onClick(e) {
    if (e.target === el) return closeAccount();   // 바깥 어두운 곳
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    sound.play('ui_click');
    if (act === 'close') return closeAccount();
    if (act === 'retry') { view.state = 'guest'; return render(); }
    if (act === 'back') { view.state = 'guest'; view.pick = null; view.confirm = false; return render(); }
    if (act === 'pick') { view.pick = b.dataset.side; view.confirm = false; return render(); }
    if (act === 'link') {
        view.state = 'linking';
        render();
        const r = await auth.linkGoogle();
        if (!el) return;
        track('account_link', { result: r.status, reason: r.reason || '' });
        if (r.status === 'conflict') { view.state = 'conflict'; view.server = r.server; }
        else if (r.status === 'linked') { grant(r); view.state = 'linked'; }
        else { view.state = 'error'; view.err = r.reason; }
        return render();
    }
    if (act === 'choose') {
        if (!view.confirm) { view.confirm = true; return render(); }
        const r = await auth.chooseRecord(view.pick);
        grant(r);
        view.state = 'linked'; view.confirm = false;
        return render();
    }
    if (act === 'signout') { await auth.signOut(); view.state = 'guest'; return render(); }
    if (act === 'delete') {
        if (!view.confirm) { view.confirm = true; return render(); }
        await auth.deleteAccount();
        view.state = 'guest'; view.confirm = false;
        return render();
    }
}

/** 연동 보상 (구글 계정마다 한 번 — 진짜 연결에서는 서버가 지급하고 여기선 표시만 하도록 바꿈) */
function grant(r) {
    if (r && r.reward > 0) {
        gameState.darkMatter += r.reward;
        gameState.notify();
    }
}
