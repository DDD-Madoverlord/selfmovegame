/* ==========================================================================
   PROJECT: MAD OVERLORD // 밸런스 조절 패널 (시험용, D-127)
   화면 왼쪽 가장자리 '⚖ 밸런스' 탭 → 오른쪽 서랍. 슬라이더를 움직이면 바로 적용 (전투 중이면 그 자리에서).
   탭이 보이는 때: 메인 왼쪽 위 아이콘을 5번 눌러 시험 모드를 켬 · 주소 ?tune=1 · 값이 하나라도 바뀌어 있음(잊지 않게 항상).
   '값 복사'로 바뀐 값만 글로 복사 → 디스코드·Trello에 붙여 넣어 정한 값을 코드에 넣음.
   값·저장은 engine_v2/liveTune_v2.js
   ========================================================================== */

import { liveTune, CHARACTERS, ROLES, RANGE } from '../engine_v2/liveTune_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { ROLE_NAME } from '../engine_v2/role_v2.js';
import { battleEngineV2 } from '../engine_v2/battle_v2.js';

const NAME = Object.fromEntries(ROSTER.map(c => [c.id, c.faction]));
const ROLE_KEY_NAME = { dps: '공격력', move: '이동 속도', taken: '받는 피해' };
const fmt = v => `×${Number(v).toFixed(2)}`;
let tab = null, panel = null, timer = null;

/** 한 줄: 이름 · 슬라이더 · 값 · 되돌리기 */
function row(path, label, hint = '') {
    const v = liveTune.valueOf(path), base = liveTune.baseOf(path);
    const changed = Math.abs(v - base) > 1e-9;
    return `<label class="v2-tune__row${changed ? ' is-changed' : ''}" data-path="${path}">
        <span class="v2-tune__name">${label}${hint ? `<small>${hint}</small>` : ''}</span>
        <input type="range" min="${RANGE.min}" max="${RANGE.max}" step="${RANGE.step}" value="${v}" data-path="${path}" aria-label="${label}">
        <b class="v2-tune__val">${fmt(v)}</b>
        <button type="button" class="v2-tune__reset" data-reset="${path}" title="기본값 ${fmt(base)}" ${changed ? '' : 'hidden'}>↺</button>
    </label>`;
}

function bodyHtml() {
    const roles = ROLES.map(r => `<h4>${ROLE_NAME[r]}</h4>${['dps', 'move', 'taken'].map(k => row(`role.${r}.${k}`, ROLE_KEY_NAME[k])).join('')}`).join('');
    return `<section><h3>주인공 공격력</h3>${row('playerAtk', '전체', '모든 캐릭터')}</section>
        <section><h3>캐릭터별 공격력</h3>${CHARACTERS.map(c => row(`charAtk.${c}`, NAME[c] || c)).join('')}</section>
        <section><h3>유형별 (팔 공격 종류)</h3><p class="v2-tune__hint">근거리 = 주먹·발톱·대검·가위·드릴 · 원거리 = 레이저·미사일·파동·서리·음파… · 중거리 = 물줄기·바늘·산탄</p>${roles}</section>
        <section><h3>적</h3>${row('enemyHp', '체력', '거점·바리케이드 포함')}${row('enemyDps', '공격력')}<p class="v2-tune__hint">전투 중에 바꾸면 새로 나오는 적·다음 공격부터</p></section>`;
}

/** 전투 중이면 지금 값 한 줄 */
function statusText() {
    const b = battleEngineV2;
    if (!b.isActive) return '전투 밖 — 바꾼 값은 다음 출격부터 (연구소 능력치에도 바로 보임)';
    const role = ROLE_NAME[b.sigRole] || '';
    return `전투 중: ${NAME[b.sigChar] || ''} · ${role} — 공격력 ${Math.round(b.playerDps).toLocaleString()} · 이동 ${Math.round(b.playerSpeed)} · 받는 피해 ×${(b.roleTaken || 1).toFixed(2)}`;
}

function render() {
    if (!panel) return;
    const n = liveTune.changes().length;
    panel.innerHTML = `<div class="v2-tune__head"><b>⚖ 밸런스 조절 <small>시험용 · 이 기기에만</small></b><button type="button" data-act="close" aria-label="닫기">✕</button></div>
        <p class="v2-tune__status">${statusText()}</p>
        <div class="v2-tune__body">${bodyHtml()}</div>
        <div class="v2-tune__foot">
            <button type="button" data-act="copy">값 복사 (${n}개 바뀜)</button>
            <button type="button" data-act="resetAll" ${n ? '' : 'disabled'}>모두 기본값</button>
            ${n ? '' : '<button type="button" data-act="hide" title="시험 모드 탭 숨기기 (메인 왼쪽 위 아이콘 5번이면 다시)">탭 숨기기</button>'}
        </div>`;
}

/** 바뀐 값만 글로 (디스코드·Trello에 붙여 넣기) */
export function tuneText() {
    const label = path => {
        const p = path.split('.');
        if (p[0] === 'playerAtk') return '주인공 공격력 (전체)';
        if (p[0] === 'charAtk') return `${NAME[p[1]] || p[1]} 공격력`;
        if (p[0] === 'role') return `${ROLE_NAME[p[1]]} ${ROLE_KEY_NAME[p[2]]}`;
        return p[0] === 'enemyHp' ? '적 체력' : '적 공격력';
    };
    const d = new Date();
    const lines = liveTune.changes().map(([p, v, b]) => `- ${label(p)}: ${fmt(b)} → ${fmt(v)}`);
    return `[밸런스 조절 값 ${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}]\n`
        + (lines.length ? lines.join('\n') : '- 바꾼 값 없음 (모두 기본값)');
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* WebView: 아래 방법 */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
}

function say(msg) {
    const el = document.createElement('div');
    el.className = 'v2-tune__toast';
    el.textContent = msg;
    panel?.appendChild(el);
    setTimeout(() => el.remove(), 2400);
}

export function openTunePanel() {
    if (!panel) {
        panel = document.createElement('aside');
        panel.className = 'v2-tune';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', '밸런스 조절');
        panel.addEventListener('input', e => {
            const inp = e.target.closest('input[type=range]');
            if (!inp) return;
            liveTune.set(inp.dataset.path, Number(inp.value));
            const r = inp.closest('.v2-tune__row');
            const v = liveTune.valueOf(inp.dataset.path), changed = Math.abs(v - liveTune.baseOf(inp.dataset.path)) > 1e-9;
            r.querySelector('.v2-tune__val').textContent = fmt(v);
            r.classList.toggle('is-changed', changed);
            r.querySelector('.v2-tune__reset').hidden = !changed;
            const n = liveTune.changes().length;
            const copy = panel.querySelector('[data-act=copy]');
            if (copy) copy.textContent = `값 복사 (${n}개 바뀜)`;
            const all = panel.querySelector('[data-act=resetAll]');
            if (all) all.disabled = !n;
        });
        panel.addEventListener('click', async e => {
            const reset = e.target.closest('[data-reset]');
            if (reset) { e.preventDefault(); liveTune.reset(reset.dataset.reset); render(); return; }
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') closeTunePanel();
            if (act === 'resetAll') { liveTune.reset(); render(); say('모두 기본값으로 돌렸어요'); }
            if (act === 'hide') { liveTune.enable(false); closeTunePanel(); }
            if (act === 'copy') say(await copyText(tuneText()) ? '복사했어요 — 디스코드·Trello에 붙여 넣어 주세요' : '복사가 막혀 있어요 — 화면을 찍어 보내 주세요');
        });
    }
    document.body.appendChild(panel);
    render();
    clearInterval(timer);
    timer = setInterval(() => {
        const s = panel?.querySelector('.v2-tune__status');
        if (s) s.textContent = statusText();
    }, 500);
    updateTab();
}

export function closeTunePanel() {
    clearInterval(timer);
    if (panel?.isConnected) panel.remove();
    updateTab();
}

/** 왼쪽 가장자리 탭 (보일 때만) — 값이 바뀌어 있으면 '조절 중' */
function updateTab() {
    if (!tab) return;
    const on = liveTune.isEnabled();
    tab.hidden = !on;
    const mod = liveTune.isModified();
    tab.classList.toggle('is-modified', mod);
    tab.innerHTML = `⚖<span>${mod ? '조절 중' : '밸런스'}</span>`;
    tab.setAttribute('aria-label', mod ? '밸런스 조절 (값이 바뀌어 있음)' : '밸런스 조절');
}

/** 시작할 때 한 번 (main_v2.js) */
export function mountTuneTab() {
    if (tab) return;
    try { if (new URLSearchParams(location.search).get('tune') === '1') liveTune.enable(true); } catch (e) { /* 주소 없음 */ }
    tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'v2-tunetab';
    tab.addEventListener('click', () => (panel?.isConnected ? closeTunePanel() : openTunePanel()));
    document.body.appendChild(tab);
    liveTune.subscribe(updateTab);
    updateTab();
}
