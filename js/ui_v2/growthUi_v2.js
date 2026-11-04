/* ==========================================================================
   PROJECT: MAD OVERLORD // 강화 외 성장 화면 조각 (v2, Q-006)
   ① 재화 칩 (★ 남은 별 · 파츠 조각 · 스킬 코어) — 메인·연구소 위쪽
   ② 작전 지원 창 (메인 "작전 지원" 버튼): 전술 모듈 · 파견 · 계정 연구 — 별·DM·조각·코어를 쓰는 곳
   수치는 engine_v2/growth_v2.js, 저장은 engine_v2/progressGrowth_v2.js.
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { MODULES, MODULE_MAX_LEVEL, RESEARCH, gradeOf, OPTIONS } from '../engine_v2/growth_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { icon } from './icons.js';
import { mountDispatch, tickDispatch, unmountDispatch, dispatchAct, showReturn } from './dispatchUi_v2.js';
import { petsHtml, petAct } from './petsUi_v2.js';
import { supportHtml } from './supportUi_v2.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 재화 칩 안쪽 HTML */
export function resChipHtml() {
    // em = 휴대폰 배치(Q-015)에서 글자 이름 대신 보이는 아이콘
    return `<span title="남은 별 (캐릭터 해금·전술 모듈·계정 연구)" aria-label="별 ${progress.availableStars()}"><em>${icon('star', 15)}</em><i>★</i><b>${progress.availableStars()}</b></span>`
        + `<span title="파츠 조각 (등급 올리기)" aria-label="조각 ${progress.shards}"><em>${icon('shard', 15)}</em><i>조각</i><b>${progress.shards}</b></span>`
        + `<span title="스킬 코어 (스킬 강화)" aria-label="코어 ${progress.cores}"><em>${icon('core', 15)}</em><i>코어</i><b>${progress.cores}</b></span>`;
}

/** 등급 표시 태그 (커먼이면 빈 문자열) */
export function gradeTag(partId) {
    const g = gradeOf(progress.gradeOf(partId));
    return g.id === 'common' ? '' : `<span class="v2-gradetag" style="--grade:${g.color}">${g.name}</span>`;
}

/** 옵션 한 줄 */
export function optionText(partId) {
    const opts = progress.optionsOf(partId).map(o => OPTIONS[o]).filter(Boolean);
    return opts.length ? `옵션: ${opts.map(o => `${o.name}(${o.desc})`).join(' · ')}` : '';
}

// ---- 작전 지원 창 ----
let panel = null;
let tab = 'modules';
let timer = null;
let onChange = null;

export function openGrowthPanel(startTab = 'modules', changed = null) {
    tab = startTab;
    if (tab === 'coop') { progress.supportHelpSeen = true; progress.save(); }
    onChange = changed;
    if (!panel) {
        panel = document.createElement('div');
        panel.className = 'v2-growth';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', '작전 지원');
        panel.addEventListener('click', e => {
            if (e.target === panel) return closeGrowthPanel();
            const el = e.target.closest('[data-act]');
            if (el && !el.disabled) act(el.dataset.act, el.dataset);
        });
        document.addEventListener('keydown', e => { if (panel?.isConnected && e.key === 'Escape') closeGrowthPanel(); });
    }
    document.body.appendChild(panel);   // 설정 창처럼 화면 전체 위 (settingsPanel_v2.js)
    render(false);
    clearInterval(timer);
    timer = setInterval(() => { if (tab === 'dispatch' && panel.isConnected && tickDispatch()) render(); }, 1000);   // 파견: 시간만 고치고, 끝난 파견이 생기면 다시 그림
    sound.play('ui_click');
}

export function closeGrowthPanel() {
    clearInterval(timer);
    unmountDispatch();
    if (panel?.isConnected) panel.remove();
    if (onChange) onChange();
}

function toast(msg, ok = true) {
    const el = document.createElement('div');
    el.className = `v2-toast${ok ? '' : ' is-error'}`;
    el.textContent = msg;
    panel.querySelector('.v2-growth__box').appendChild(el);
    setTimeout(() => el.remove(), 2200);
    sound.play(ok ? 'ui_equip' : 'ui_error');
}

function act(name, d) {
    let r = null;
    if (name === 'tab') {
        if (tab === 'dispatch' && d.tab !== 'dispatch') unmountDispatch();
        tab = d.tab;
        if (tab === 'coop') { progress.supportHelpSeen = true; progress.save(); }
        sound.play('ui_tab');
        return render(false);
    }
    if (name.startsWith('dsp')) return dispatchAct(name, d) ? render() : null;   // 파견 탭: 구역·캐릭터 고르기, 귀환 장면 닫기
    if (name === 'close') return closeGrowthPanel();
    if (name === 'equipPet' || name === 'upPet') r = petAct(name, d);
    if (name === 'selectSupport') { progress.selectSupport(d.id || null); return render(); }
    if (name === 'randomSupport') { progress.randomSupport(); return render(); }
    if (name === 'supportAuto') { progress.setSupportAuto(!progress.supportAuto); return render(); }
    if (name === 'buyModule') r = progress.buyModule(d.id);
    if (name === 'equipModule') { progress.equipModule(Number(d.slot), d.id || null); sound.play('ui_tab'); return render(); }
    if (name === 'upModule') r = progress.upgradeModule(d.id);
    if (name === 'buyResearch') r = progress.buyResearch(d.id);
    if (name === 'dispatch') r = progress.startDispatch(d.char, Number(d.zone));
    if (name === 'collect') {
        r = progress.collectDispatch(Number(d.index));
        if (r.success) {
            showReturn(r);   // 귀환 장면 (구역 일러스트 + 승리 동작 + 보상) — 다시 그려도 창 위에 남음
            return render();
        }
    }
    render();
    if (r) toast(r.success ? (name === 'dispatch' ? (r.supportCleared ? '파견 출발! 협력 출격에서 빠졌습니다' : '파견 출발!') : '완료!') : r.reason, r.success);
}

function render(preserveScroll = true) {
    if (!panel) return;
    const scrollTop = preserveScroll ? (panel.querySelector('.v2-growth__body')?.scrollTop || 0) : 0;
    const petUnlocked = progress.stage('1-1', 'normal').cleared || progress.pets.owned.some(id => progress.canUsePet(id));
    const tabs = [['coop', '협력 출격'], ['modules', '전술 모듈'], ['dispatch', '파견'], ['research', '계정 연구'], ['pets', '펫']];
    const body = tab === 'coop' ? supportHtml() : tab === 'dispatch' ? '' : tab === 'research' ? researchHtml() : tab === 'pets'
        ? petUnlocked ? petsHtml() : '<p class="v2-growth__hint">노말 1-1을 클리어하면 펫이 열립니다.</p>' : modulesHtml();
    panel.innerHTML = `<div class="v2-growth__box v2-panel">
        <div class="v2-growth__head">
            <h2>작전 지원</h2>
            <div class="v2-chip v2-chip--res">${resChipHtml()}</div>
            <div class="v2-chip v2-chip--dm">${icon('gem', 16)}<strong>${gameState.darkMatter.toLocaleString()}</strong><small>DM</small></div>
            <button class="v2-iconbtn" data-act="close" aria-label="닫기">✕</button>
        </div>
        <nav class="v2-growth__tabs">${tabs.map(([id, label]) => `<button data-act="tab" data-tab="${id}" class="${tab === id ? 'is-on' : ''}" ${id === 'pets' && !petUnlocked ? 'disabled title="노말 1-1 클리어 후 해금"' : ''}>${label}${id === 'pets' && !petUnlocked ? ' 🔒' : ''}</button>`).join('')}</nav>
        <div class="v2-growth__body${tab === 'dispatch' ? ' is-dispatch' : ''}">${body}</div>
    </div>`;
    if (tab === 'dispatch') mountDispatch(panel.querySelector('.v2-growth__body'));   // 파견 중 장면 (dispatchUi_v2.js)
    panel.querySelector('.v2-growth__body').scrollTop = scrollTop;
}

function modulesHtml() {
    const slots = progress.moduleSlots();
    const eq = Array.from({ length: slots }, (_, i) => progress.modules.equipped[i] || null);
    const slotHtml = eq.map((id, i) => {
        const m = id && MODULES[id];
        return `<div class="v2-modslot"><small>칸 ${i + 1} · 키 ${i + 4}</small>${m ? `${icon(m.icon, 18)}<b>${m.name}</b>` : '<em>비어 있음</em>'}</div>`;
    }).join('');
    const cards = Object.entries(MODULES).map(([id, m]) => {
        const own = progress.ownsModule(id);
        const lv = progress.moduleLevel(id);
        const up = progress.moduleUpgradeCost(id);
        const slotBtns = own ? Array.from({ length: slots }, (_, i) => `<button data-act="equipModule" data-slot="${i}" data-id="${eq[i] === id ? '' : id}" class="${eq[i] === id ? 'is-on' : ''}">${eq[i] === id ? `칸 ${i + 1} 빼기` : `칸 ${i + 1}에`}</button>`).join('') : '';
        return `<div class="v2-modcard${own ? ' is-own' : ''}" style="--sk:${m.color}">
            <div class="v2-modcard__head">${icon(m.icon, 22)}<b>${m.name}</b>${own ? `<i>Lv${lv}/${MODULE_MAX_LEVEL}</i>` : ''}</div>
            <p>${esc(m.desc)}</p><small>쿨다운 ${Math.round(m.cd * (1 - 0.1 * (lv - 1)))}초${own && lv < MODULE_MAX_LEVEL ? ' · 강화마다 -10%' : ''}</small>
            <div class="v2-modcard__acts">${own ? slotBtns + (up != null ? `<button data-act="upModule" data-id="${id}" ${up > gameState.darkMatter ? 'disabled' : ''}>강화 ${up.toLocaleString()} DM</button>` : '<span class="is-max">MAX</span>')
                : `<button data-act="buyModule" data-id="${id}" ${progress.availableStars() < m.stars ? 'disabled' : ''}>★${m.stars}로 해금</button>`}</div>
        </div>`;
    }).join('');
    return `<p class="v2-growth__hint">출격 때 끼우는 보조 스킬 (키 4·5, AUTO면 쓸 상황에 자동). 칸: 노말 1칸 → 하드를 열면 2칸. 별로 해금, DM으로 강화.</p>
        <div class="v2-modslots">${slotHtml}</div><div class="v2-modgrid">${cards}</div>`;
}

function researchHtml() {
    const rows = Object.entries(RESEARCH).map(([id, r]) => {
        const lv = progress.researchLevel(id);
        const cost = progress.researchCost(id);
        return `<div class="v2-research">
            <b>${r.name}</b><small>${esc(r.desc)} · 단계 ${lv}/${r.max}</small>
            <div class="v2-pips">${Array.from({ length: r.max }, (_, i) => `<i class="${i < lv ? 'is-on' : ''}"></i>`).join('')}</div>
            ${cost == null ? '<span class="is-max">MAX</span>' : `<button data-act="buyResearch" data-id="${id}" ${progress.availableStars() < cost ? 'disabled' : ''}>★${cost}</button>`}
        </div>`;
    }).join('');
    return `<p class="v2-growth__hint">별로 계정 전체에 붙는 작은 영구 보너스. 별은 난이도마다 따로 모여요 (지금 모은 별 ★${progress.totalStars()}, 쓴 별 ★${progress.spentStars}).</p>
        <div class="v2-researchlist">${rows}</div>`;
}
