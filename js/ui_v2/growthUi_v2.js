/* ==========================================================================
   PROJECT: MAD OVERLORD // 강화 외 성장 화면 조각 (v2, Q-006)
   ① 재화 칩 (★ 남은 별 · 파츠 조각 · 스킬 코어) — 메인·연구소 위쪽
   ② 작전 지원 창 (메인 "작전 지원" 버튼): 전술 모듈 · 파견 · 계정 연구 — 별·DM·조각·코어를 쓰는 곳
   수치는 engine_v2/growth_v2.js, 저장은 engine_v2/progressGrowth_v2.js.
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { MODULES, MODULE_MAX_LEVEL, RESEARCH, gradeOf, OPTIONS, SKINS, SKIN_STARS } from '../engine_v2/growth_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { isCharacterReleased } from '../engine_v2/contentSchedule_v2.js';
import { SPECIAL, bossReward, smashLayout, bossZones } from '../engine_v2/special_v2.js';
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
    if (name === 'buySkin') r = progress.buySkin(d.id);
    if (name === 'startSpecial') {   // 스페셜맵 입장 (D-123): 횟수 1 쓰고 전투로
        const res = progress.startSpecial(d.mode);
        if (!res.success) { toast(res.reason, false); return render(); }
        closeGrowthPanel();
        window.madOverlordGameV2.startSpecial(res.stage);
        return;
    }
    if (name === 'equipSkin') { progress.equipSkin(d.char, d.id || null); sound.play('ui_equip'); return render(); }
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
    const tabs = [['coop', '협력 출격'], ['special', '스페셜'], ['modules', '전술 모듈'], ['dispatch', '파견'], ['research', '계정 연구'], ['skins', '외형'], ['pets', '펫']];
    const body = tab === 'coop' ? supportHtml() : tab === 'dispatch' ? '' : tab === 'research' ? researchHtml() : tab === 'skins' ? skinsHtml() : tab === 'special' ? specialHtml() : tab === 'pets'
        ? petUnlocked ? petsHtml() : '<p class="v2-growth__hint">노말 1-1을 클리어하면 펫이 열립니다.</p>' : modulesHtml();
    panel.innerHTML = `<div class="v2-growth__box v2-panel">
        <div class="v2-growth__head" data-currency>
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

/** 스페셜맵 (D-123): 보스 러시 · 파괴 작전, 모드마다 하루 3회 (한국 시간 0시에 다시 채움) */
function specialHtml() {
    if (!progress.specialUnlocked()) return `<p class="v2-growth__hint">노말 ${SPECIAL.unlockStage}를 깨면 스페셜맵이 열립니다.</p>`;
    const dots = mode => Array.from({ length: SPECIAL.daily[mode] }, (_, i) => `<i class="${i < progress.specialLeft(mode) ? 'is-on' : ''}"></i>`).join('');
    const step = progress.nextBossStep(), rw = bossReward(step);
    const band = step >= 30 ? '나이트메어' : step >= 20 ? '헬' : step >= 10 ? '하드' : '노말';
    const zones = bossZones();
    const lay = smashLayout();
    const sb = progress.special.smashBest;
    const card = (mode, title, lines, btn) => `<div class="v2-special__card" data-mode="${mode}"><b>${title}</b><div class="v2-pips v2-special__left" title="오늘 남은 횟수">${dots(mode)}</div>
        ${lines.map(l => `<small>${l}</small>`).join('')}
        <button data-act="startSpecial" data-mode="${mode}" ${progress.specialLeft(mode) > 0 ? '' : 'disabled'}>${progress.specialLeft(mode) > 0 ? btn : '오늘 횟수 끝'}</button></div>`;
    return `<p class="v2-growth__hint">하루 3회씩(한국 시간 0시에 다시 채움). 들어가면 1회를 써요. 보스 러시의 승급석은 파츠 승급 재료가 됩니다.</p>
        <div class="v2-special">${card('boss', '보스 러시', [`다음 <b>${step}단계</b> · ${band} · ${zones[(step - 1) % zones.length]}구역 보스`, `이기면 승급석 ${rw.stones} · 코어 ${rw.cores} · DM ${rw.dm.toLocaleString()}${rw.shards ? ` · 처음이면 조각 ${rw.shards}` : ''}`, `10단계 하드 · 20단계 헬 · 30단계 나이트메어 · 최고 ${progress.special.bossBest}단계`], `${step}단계 도전`)}
        ${card('smash', '파괴 작전', [`이번 주: <b>${esc(lay.name)}</b> — ${SPECIAL.smash.sec}초 동안 물체를 최대한 부수기`, '3초 안에 이어 부수면 연속 보너스, 모두 부수면 남은 시간 보너스', `등급 S ${SPECIAL.smash.reward.S.shards}조각 · A ${SPECIAL.smash.reward.A.shards} · B ${SPECIAL.smash.reward.B.shards} · C ${SPECIAL.smash.reward.C.shards} · 이번 주 최고 ${(sb.week ? sb.score : 0).toLocaleString()}`], '도전')}</div>`;
}

/** 캐릭터 외형 (D-119 11번): 캐릭터마다 색 바꿔 입기 2종, 별 25개. 미리보기는 캐릭터 얼굴 그림에 같은 색 필터 */
function skinsHtml() {
    const rows = ROSTER.filter(c => isCharacterReleased(c.id)).map(c => {
        const on = progress.skins.equipped[c.id] || null;
        const opt = (id, name, filter) => {
            const own = !id || progress.ownsSkin(id);
            const btn = on === id ? '<span class="is-max">입는 중</span>'
                : own ? `<button data-act="equipSkin" data-char="${c.id}" data-id="${id || ''}">입기</button>`
                : `<button data-act="buySkin" data-id="${id}" ${progress.availableStars() < SKIN_STARS ? 'disabled' : ''}>★${SKIN_STARS}</button>`;
            return `<div class="v2-skin${on === id ? ' is-on' : ''}"><i style="background-image:url('assets/sprites/intro/face_${c.id}.webp');${filter ? `filter:${filter}` : ''}"></i><small>${esc(name)}</small>${btn}</div>`;
        };
        return `<div class="v2-skinrow" style="--sk:${c.color}"><b>${esc(c.faction)}</b>${opt(null, '기본', '')}${SKINS[c.id].map(k => opt(k.id, k.name, k.filter)).join('')}</div>`;
    }).join('');
    return `<p class="v2-growth__hint">별로 캐릭터 색을 바꿔 입어요. 하나에 ★${SKIN_STARS}, 사면 바로 입고, 언제든 기본으로 돌아갈 수 있어요. 출격·선택창·연구소에 모두 보입니다.</p>
        <div class="v2-skinlist">${rows}</div>`;
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
