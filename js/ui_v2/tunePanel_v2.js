/* ==========================================================================
   PROJECT: MAD OVERLORD // 밸런스 조절 패널 (시험용, D-127)
   화면 왼쪽 가장자리 '⚖ 밸런스' 탭 → 오른쪽 서랍. 슬라이더를 움직이면 바로 적용 (전투 중이면 그 자리에서).
   탭이 보이는 때: 메인 왼쪽 위 아이콘을 5번 눌러 시험 모드를 켬 · 주소 ?tune=1 · 값이 하나라도 바뀌어 있음(잊지 않게 항상).
   '값 복사'로 바뀐 값만 글로 복사 → 디스코드·Trello에 붙여 넣어 정한 값을 코드에 넣음.
   묶음 B (회의 ② ⑧ · D-158): 맨 위 '등급' 묶음 — 지금 장착 값 · 등급 고정(시험용) · 등급 표(공격 속도 · 배율 · 방어 무시 · 사거리 · 넉백 · 상태이상) ·
   다리 속도 기준 · 진격 속도 상한 · 고유 능력치 세기 · 근거리 특징
   값·저장은 engine_v2/liveTune_v2.js
   ========================================================================== */

import { liveTune, CHARACTERS, ROLES, GRADE_IDS, GRADE_KEYS, specOf, fmtOf } from '../engine_v2/liveTune_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { ROLE_NAME } from '../engine_v2/role_v2.js';
import { battleEngineV2 } from '../engine_v2/battle_v2.js';
import { progress } from '../engine_v2/progress_v2.js';
import { gameState } from '../engine/state.js';
import { GRADES, gradeOf } from '../engine_v2/growth_v2.js';
import { MELEE_FEATURE } from '../engine_v2/battle/tuning.js';

const NAME = Object.fromEntries(ROSTER.map(c => [c.id, c.faction]));
const ROLE_KEY_NAME = { dps: '공격력', move: '이동 속도', taken: '받는 피해' };
const GRADE_NAME = Object.fromEntries(GRADES.map(g => [g.id, g.name]));
// 등급 표 줄: 이름 · 붙는 부위 (값은 growth_v2.js GRADES)
const GRADE_ROW = {
    atkSpd: ['공격 속도', '팔 · 기본 공격 빠르기'], mul: ['체력·공격력', '모든 부위 배율'], pierce: ['방어 무시 %', '근거리 팔 (중거리 절반)'],
    rangeBonus: ['사거리 +', '원거리 팔 (중거리 절반)'], knockCut: ['넉백 저항 %', '몸통 · 밀리는 거리 −'], ccCut: ['상태이상 저항 %', '머리 · 감속·기절·속박 −']
};
const SLOT_NAME = { head: '머리', body: '몸통', arm: '팔', leg: '다리' };
let tab = null, panel = null, timer = null;

/** 한 줄: 이름 · 슬라이더 · 값 · 되돌리기 (범위 · 단계는 값마다 — liveTune specOf) */
function row(path, label, hint = '') {
    const v = liveTune.valueOf(path), base = liveTune.baseOf(path), s = specOf(path);
    const changed = Math.abs(v - base) > 1e-9;
    return `<label class="v2-tune__row${changed ? ' is-changed' : ''}" data-path="${path}">
        <span class="v2-tune__name">${label}${hint ? `<small>${hint}</small>` : ''}</span>
        <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" data-path="${path}" aria-label="${label}">
        <b class="v2-tune__val">${fmtOf(path, v)}</b>
        <button type="button" class="v2-tune__reset" data-reset="${path}" title="기본값 ${fmtOf(path, base)}" ${changed ? '' : 'hidden'}>↺</button>
    </label>`;
}

/** 등급 표 칸: 숫자 입력 (% 값은 100을 곱해 보여 줌) */
function gradeCell(gid, key) {
    const path = `grade.${gid}.${key}`, s = specOf(path), k = s.kind === 'pct' ? 100 : 1;
    const v = liveTune.valueOf(path), changed = Math.abs(v - liveTune.baseOf(path)) > 1e-9;
    const shown = +(v * k).toFixed(2);
    return `<td><input type="number" class="v2-tune__cell${changed ? ' is-changed' : ''}" data-path="${path}" data-k="${k}" value="${shown}"
        min="${s.min * k}" max="${s.max * k}" step="${+(s.step * k).toFixed(2)}" inputmode="decimal" aria-label="${GRADE_NAME[gid]} ${GRADE_ROW[key][0]}"></td>`;
}

/** 지금 장착한 파츠 기준 값 (등급 고정이면 그 등급으로) */
function equippedHtml() {
    const eq = gameState.getEquippedObjects();
    const st = progress.statsFor(eq), t = st.traits || {};
    const grades = ['head', 'body', 'arm', 'leg'].map(s => {
        const p = eq[s];
        return p && p.id !== 'none' ? `${SLOT_NAME[s]} <b style="color:rgb(${gradeOf(progress.statGradeOf(p.id)).color})">${GRADE_NAME[progress.statGradeOf(p.id)]}</b>` : `${SLOT_NAME[s]} —`;
    }).join(' · ');
    const pct = v => `${Math.round((v || 0) * 100)}%`;
    const feat = st.role === 'melee' && MELEE_FEATURE.type[progress.character]
        ? ` · 근거리 특징 ${MELEE_FEATURE.type[progress.character] === 'building' ? `건물형 거점 +${pct(MELEE_FEATURE.building)}` : `몬스터형 적 +${pct(MELEE_FEATURE.monster)}`}` : '';
    return `<div class="v2-tune__now" data-now>
        <p>${grades} · ${ROLE_NAME[st.role] || ''}</p>
        <p>공격 속도 <b>×${(t.atkSpd || 1).toFixed(2)}</b> · 방어 무시 <b>${pct(t.pierce)}</b> · 사거리 <b>${st.range}</b>${t.rangeBonus ? ` (+${t.rangeBonus})` : ''}
            · 넉백 저항 <b>${pct(t.knockCut)}</b> · 상태이상 저항 <b>${pct(t.ccCut)}</b> · 진격 <b>${st.speed}</b>${feat}</p></div>`;
}

function gradeHtml() {
    const forced = liveTune.forcedGrade();
    const seg = [['', '끔'], ...GRADE_IDS.map(g => [g, GRADE_NAME[g]])]
        .map(([g, n]) => `<button type="button" data-force="${g}" aria-pressed="${(forced || '') === g}">${n}</button>`).join('');
    const head = `<tr><th></th>${GRADE_IDS.map(g => `<th style="color:rgb(${gradeOf(g).color})">${GRADE_NAME[g]}</th>`).join('')}</tr>`;
    const rows = GRADE_KEYS.map(key => `<tr><th><span>${GRADE_ROW[key][0]}</span><small>${GRADE_ROW[key][1]}</small></th>${GRADE_IDS.map(g => gradeCell(g, key)).join('')}</tr>`).join('');
    return `<section class="v2-tune__grade"><h3>등급 <small>회의 ② ⑤ ⑧ · 묶음 B</small></h3>
        ${equippedHtml()}
        <div class="v2-tune__force"><span>등급 고정 <small>모든 파츠를 이 등급으로 셈 (안 가진 등급도 시험)</small></span><div class="v2-tune__seg">${seg}</div></div>
        <div class="v2-tune__gridwrap"><table class="v2-tune__grid">${head}${rows}</table></div>
        <p class="v2-tune__hint">칸을 고치고 다른 곳을 누르면 바로 적용 (전투 중이면 그 자리에서). 다리 속도는 아래 기준 × 0.5 / 0.8 / 1.2 / 1.5</p>
        ${row('leg.base', '다리 속도 기준', `지금 다리 ${GRADES.map(g => g.legSpeed).join(' · ')}`)}
        ${row('leg.cap', '진격 속도 상한', '하한은 30')}
        ${row('trait.power', '고유 능력치 세기', '방어 무시·사거리·넉백·상태이상 (0 = 끔)')}
        ${row('melee.building', '근거리 건물형', '거대로봇·합성괴인: 거점 피해 +')}
        ${row('melee.monster', '근거리 몬스터형', '거대괴수·타락 히어로: 보통 적 +')}
        <button type="button" class="v2-tune__groupreset" data-act="resetGrade">등급 묶음만 기본값</button>
    </section>`;
}

function bodyHtml() {
    const roles = ROLES.map(r => `<h4>${ROLE_NAME[r]}</h4>${['dps', 'move', 'taken'].map(k => row(`role.${r}.${k}`, ROLE_KEY_NAME[k])).join('')}`).join('');
    return `${gradeHtml()}
        <section><h3>주인공 공격력</h3>${row('playerAtk', '전체', '모든 캐릭터')}</section>
        <section><h3>캐릭터별 공격력</h3>${CHARACTERS.map(c => row(`charAtk.${c}`, NAME[c] || c)).join('')}</section>
        <section><h3>유형별 (팔 공격 종류)</h3><p class="v2-tune__hint">근거리 = 주먹·발톱·대검·가위·드릴 · 원거리 = 레이저·미사일·파동·서리·음파… · 중거리 = 물줄기·바늘·산탄</p>${roles}</section>
        <section><h3>적</h3>${row('enemyHp', '체력', '거점·바리케이드 포함')}${row('enemyDps', '공격력')}<p class="v2-tune__hint">전투 중에 바꾸면 새로 나오는 적·다음 공격부터</p></section>`;
}

/** 전투 중이면 지금 값 한 줄 */
function statusText() {
    const b = battleEngineV2;
    if (!b.isActive) return '전투 밖 — 바꾼 값은 다음 출격부터 (연구소 능력치에도 바로 보임)';
    const role = ROLE_NAME[b.sigRole] || '';
    return `전투 중: ${NAME[b.sigChar] || ''} · ${role} — 공격력 ${Math.round(b.playerDps).toLocaleString()} · 이동 ${Math.round(b.playerSpeed)} · 받는 피해 ×${(b.roleTaken || 1).toFixed(2)}`
        + ` · 공격 속도 ×${(b.gradeTr?.atkSpd || 1).toFixed(2)} · 사거리 ${Math.round(b.playerRange)}`;
}

function render() {
    if (!panel) return;
    const n = liveTune.changes().length;
    const scroll = panel.querySelector('.v2-tune__body')?.scrollTop || 0;   // 다시 그려도 보던 자리 그대로
    panel.innerHTML = `<div class="v2-tune__head"><b>⚖ 밸런스 조절 <small>시험용 · 이 기기에만</small></b><button type="button" data-act="close" aria-label="닫기">✕</button></div>
        <p class="v2-tune__status">${statusText()}</p>
        <div class="v2-tune__body">${bodyHtml()}</div>
        <div class="v2-tune__foot">
            <button type="button" data-act="copy">값 복사 (${n}개 바뀜)</button>
            <button type="button" data-act="resetAll" ${n ? '' : 'disabled'}>모두 기본값</button>
            ${n ? '' : '<button type="button" data-act="hide" title="시험 모드 탭 숨기기 (메인 왼쪽 위 아이콘 5번이면 다시)">탭 숨기기</button>'}
        </div>`;
    const body = panel.querySelector('.v2-tune__body');
    if (body) body.scrollTop = scroll;
}

/** 값이 바뀐 뒤: 바뀐 개수 · 지금 장착 값 · 다리 속도 안내만 다시 (슬라이더를 끄는 중에 통째로 다시 그리지 않음) */
function refreshSummary() {
    const n = liveTune.changes().length;
    const copy = panel.querySelector('[data-act=copy]');
    if (copy) copy.textContent = `값 복사 (${n}개 바뀜)`;
    const all = panel.querySelector('[data-act=resetAll]');
    if (all) all.disabled = !n;
    const now = panel.querySelector('[data-now]');
    if (now) now.outerHTML = equippedHtml();
    const legHint = panel.querySelector('.v2-tune__row[data-path="leg.base"] small');
    if (legHint) legHint.textContent = `지금 다리 ${GRADES.map(g => g.legSpeed).join(' · ')}`;
}

/** 바뀐 값만 글로 (디스코드·Trello에 붙여 넣기) */
export function tuneText() {
    const label = path => {
        const p = path.split('.');
        if (p[0] === 'playerAtk') return '주인공 공격력 (전체)';
        if (p[0] === 'charAtk') return `${NAME[p[1]] || p[1]} 공격력`;
        if (p[0] === 'role') return `${ROLE_NAME[p[1]]} ${ROLE_KEY_NAME[p[2]]}`;
        if (p[0] === 'grade') return `${GRADE_NAME[p[1]]} ${GRADE_ROW[p[2]][0].replace(' %', '')}`;
        if (path === 'leg.base') return '다리 속도 기준';
        if (path === 'leg.cap') return '진격 속도 상한';
        if (path === 'trait.power') return '등급 고유 능력치 세기';
        if (path === 'melee.building') return '근거리 건물형 거점 피해 +';
        if (path === 'melee.monster') return '근거리 몬스터형 피해 +';
        return p[0] === 'enemyHp' ? '적 체력' : '적 공격력';
    };
    const d = new Date();
    const lines = liveTune.changes().map(([p, v, b]) => (p === 'forceGrade'
        ? `- 등급 고정 (시험용): ${GRADE_NAME[v]}` : `- ${label(p)}: ${fmtOf(p, b)} → ${fmtOf(p, v)}`));
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
            r.querySelector('.v2-tune__val').textContent = fmtOf(inp.dataset.path, v);
            r.classList.toggle('is-changed', changed);
            r.querySelector('.v2-tune__reset').hidden = !changed;
            refreshSummary();
        });
        // 등급 표 칸: 다 고친 뒤(포커스가 떠날 때 · Enter) 적용
        panel.addEventListener('change', e => {
            const cell = e.target.closest('input.v2-tune__cell');
            if (!cell) return;
            const k = Number(cell.dataset.k) || 1;
            if (!liveTune.set(cell.dataset.path, Number(cell.value) / k)) say('범위 밖 값이에요 — 칸 위에 마우스를 올리면 범위가 보여요');
            const v = liveTune.valueOf(cell.dataset.path);
            cell.value = +(v * k).toFixed(2);
            cell.classList.toggle('is-changed', Math.abs(v - liveTune.baseOf(cell.dataset.path)) > 1e-9);
            refreshSummary();
        });
        panel.addEventListener('click', async e => {
            const reset = e.target.closest('[data-reset]');
            if (reset) { e.preventDefault(); liveTune.reset(reset.dataset.reset); render(); return; }
            const force = e.target.closest('[data-force]');
            if (force) { liveTune.setForcedGrade(force.dataset.force || null); render(); return; }
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') closeTunePanel();
            if (act === 'resetGrade') { liveTune.resetGroup('grade'); ['leg', 'trait', 'melee'].forEach(g => liveTune.resetGroup(g)); render(); say('등급 묶음을 기본값으로 돌렸어요'); }
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
