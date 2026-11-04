/* ==========================================================================
   PROJECT: MAD OVERLORD // 캐릭터 선택창 (v2, 가로 1280x720) — D-051
   - 메인 화면 CHARACTER 버튼으로 들어옴
   - 캐릭터 카드: 그 캐릭터의 장착(기억해 둔 장착 / 가진 파츠)으로 조립한 리그 idle, 소개, 능력치, 스킬, 보유 파츠 수
   - 카드를 누르면 바로 그 캐릭터로 바뀜 (지금 장착은 캐릭터마다 기억) → 결정(메인 화면) / 연구소
   - 몸통을 아직 안 산 캐릭터도 고를 수 있음: 흐린 모습으로 보이고, 연구소에서 파츠를 사야 출격
   - 휴대폰 배치(ui_v2_mobile.css, 11-04 디자인 제안): 아래 줄·[결정] 없이 카드를 누르면 바로 메인으로, 안내는 잠깐 뜨는 알림
   캐릭터 목록은 js/engine_v2/roster_v2.js, 선택·장착 기억은 progress_v2.js
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { isCharacterReleased, releaseDateOf } from '../engine_v2/contentSchedule_v2.js';
import { ROSTER, rosterOf, SLOTS } from '../engine_v2/roster_v2.js';
import { RigAvatar, rigConfigFor } from '../engine_v2/rig/rigAvatar.js';
import { RIG_CHARACTERS } from '../engine_v2/rig/characters.js';
import { skillsForParts, legPassiveOf } from '../engine_v2/skills_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { icon, fillIcons } from './icons.js';
import { openSettings } from './settingsPanel_v2.js';
import { resChipHtml } from './growthUi_v2.js';

const $ = id => document.getElementById(id);
const isMobile = () => document.body.classList.contains('v2-mobile');
const CARD_RIG = { width: 260, height: 236, rootX: 130, rootY: 226, scale: 0.3, fit: { x: 12, y: 10 }, shadow: true, fitCss: true };   // fitCss: 휴대폰 배치 실제 크기에서도 선명하게 (rigAvatar.js _fitRes)

/** 파츠 id 묶음 → 파츠 객체 묶음 (없는 부위는 [파츠제거] 객체) */
function objectsOf(ids) {
    const out = {};
    for (const slot of SLOTS) out[slot] = gameState.getPartById(slot, ids[slot]);
    return out;
}

export class SelectController {
    constructor(switchScreenFn) {
        this.switchScreen = switchScreenFn;
        this.root = $('screen-select-v2');
        this.grid = $('select-grid-v2');
        this.cards = {};   // 캐릭터 id → { el, rig }
        if (!this.root || !this.grid) return;
        fillIcons(this.root);
        const chip = this.root.querySelector('.v2-chip--dm');
        if (chip) chip.insertAdjacentHTML('afterbegin', icon('gem', 18));
        this.buildCards();
        this.initEvents();
    }

    buildCards() {
        this.grid.innerHTML = '';
        for (const c of ROSTER) {
            const el = document.createElement('div');
            el.className = 'v2-charcard';
            el.dataset.char = c.id;
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.style.setProperty('--cc', c.color);
            el.innerHTML = `
                <div class="v2-charcard__head">
                    <div><small>${c.tag}</small><h2>${RIG_CHARACTERS[c.id] ? RIG_CHARACTERS[c.id].name : c.faction}</h2></div>
                    <span class="v2-charcard__badge">SELECTED</span>
                </div>
                <div class="v2-charcard__stage"><div class="v2-showroom__floor"></div><canvas></canvas></div>
                <p class="v2-charcard__desc">${c.desc}</p>
                <dl class="v2-charcard__stats"></dl>
                <ul class="v2-charcard__skills"></ul>
                <div class="v2-charcard__foot"></div>`;
            el.addEventListener('click', () => this.pick(c.id));
            el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(c.id); } });
            this.grid.appendChild(el);
            this.cards[c.id] = { el, rig: null };
        }
        // 카드가 4장보다 많으면 가로로 넘김 (ui_v2.css 11장): 휠 한 칸 = 카드 2장, 양옆 화살표 = 한 화면
        this.grid.addEventListener('wheel', e => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            this.grid.scrollBy({ left: Math.sign(e.deltaY) * this.grid.clientWidth / 2 });
        }, { passive: false });
        this.pagers = [-1, 1].map(dir => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `v2-select__pager ${dir < 0 ? 'is-prev' : 'is-next'}`;
            b.title = dir < 0 ? '앞 캐릭터' : '다음 캐릭터';
            b.textContent = dir < 0 ? '‹' : '›';
            b.addEventListener('click', () => this.grid.scrollBy({ left: dir * this.grid.clientWidth }));
            this.grid.after(b);
            return b;
        });
        this.grid.addEventListener('scroll', () => this.updatePagers());
    }

    /** 넘김 화살표: 더 넘길 쪽에만 보임 */
    updatePagers() {
        if (!this.pagers) return;
        const g = this.grid;
        const max = g.scrollWidth - g.clientWidth;
        this.pagers[0].hidden = g.scrollLeft <= 2;
        this.pagers[1].hidden = g.scrollLeft >= max - 2;
    }

    /** 고른 캐릭터 카드가 화면 밖이면 보이게 넘김 */
    showSelected() {
        const card = this.cards[progress.character];
        if (!card) return;
        const g = this.grid;
        const { offsetLeft: x, offsetWidth: w } = card.el;
        if (x < g.scrollLeft || x + w > g.scrollLeft + g.clientWidth) g.scrollTo({ left: x, behavior: 'auto' });
        this.updatePagers();
    }

    initEvents() {
        $('btn-select-back-v2')?.addEventListener('click', () => this.switchScreen('menu'));
        $('btn-select-confirm-v2')?.addEventListener('click', () => this.switchScreen('menu'));
        $('btn-select-settings-v2')?.addEventListener('click', () => openSettings());
        $('btn-select-lab-v2')?.addEventListener('click', () => {
            gameState.resetCartToEquipped();
            this.switchScreen('lab');
        });
    }

    /** 카드 누름: 그 캐릭터로 바꿈 (지금 장착은 기억). 잠긴 캐릭터는 별로 해금, 파견 중이면 못 고름 (Q-006) */
    pick(id) {
        if (!isCharacterReleased(id)) {
            sound.play('ui_error');
            this.renderInfo(`곧 공개 · ${releaseDateOf('characters', id)}`);
            return;
        }
        if (id === progress.character) {
            if (isMobile()) this.switchScreen('menu');   // 휴대폰 배치: 고른 캐릭터를 다시 누르면 결정
            return;
        }
        if (progress.isDispatched(id)) {
            sound.play('ui_error');
            this.renderInfo('파견 중인 캐릭터입니다 — 작전 지원 → 파견에서 받은 뒤 고르세요');
            return;
        }
        if (!progress.isCharacterUnlocked(id)) {
            const res = progress.unlockCharacter(id);
            if (!res.success) {
                sound.play('ui_error');
                this.renderInfo(`${res.reason} — 별은 스테이지 별(난이도마다 따로)로 모아요`);
                return;
            }
        }
        if (!progress.selectCharacter(id)) return;
        sound.play('ui_equip');
        this.render();
        // 휴대폰 배치: [결정] 없이 바로 메인으로 (고른 표시가 잠깐 보이게)
        if (isMobile()) setTimeout(() => { if (gameState.currentScreen === 'select') this.switchScreen('menu'); }, 280);
    }

    /** 선택창이 보일 때: 카드 내용 갱신 + 리그 재생 */
    render() {
        const dm = $('select-dm-count-v2');
        if (dm) dm.textContent = gameState.darkMatter.toLocaleString();
        const res = $('select-res-v2');   // 별·조각·코어 (휴대폰 배치에서만 보임)
        if (res) res.innerHTML = resChipHtml();
        for (const c of ROSTER) this.renderCard(c);
        this.renderInfo();
        this.showSelected();
    }

    renderCard(c) {
        const card = this.cards[c.id];
        if (!card) return;
        const { el } = card;
        const ids = progress.loadoutFor(c.id);
        const parts = objectsOf(ids);
        const st = progress.statsFor(parts);
        const own = progress.ownedCountOf(c.id);
        const ready = ids.body !== 'none';
        const on = c.id === progress.character;
        const locked = !progress.isCharacterUnlocked(c.id);
        const soon = !isCharacterReleased(c.id);
        const away = progress.isDispatched(c.id);
        el.classList.toggle('is-selected', on);
        el.classList.toggle('is-empty', !ready);
        el.classList.toggle('is-locked', locked);
        el.classList.toggle('is-coming-soon', soon);
        el.setAttribute('aria-disabled', String(soon));
        el.setAttribute('aria-pressed', String(on));

        // 아이콘 · 사거리 칸은 휴대폰 배치에서만 (PC는 글자 이름 3칸 그대로)
        el.querySelector('.v2-charcard__stats').innerHTML = [['ARMOR', 'shield', st.hp], ['POWER', 'bolt', st.dps], ['RANGE', 'aim', st.range], ['SPEED', 'speed', st.speed]]
            .map(([k, ic, v]) => `<div${k === 'RANGE' ? ' class="is-mobile"' : ''}><dt>${icon(ic, 18)}<span>${k}</span></dt><dd>${ready ? Number(v).toLocaleString() : '—'}</dd></div>`).join('');

        const skills = skillsForParts(parts);
        const leg = legPassiveOf(parts.leg);
        const chips = [['arm', '1'], ['body', '2'], ['head', 'ULT']].map(([slot, tag]) => {
            const sk = skills[slot];
            return sk ? `<li style="--sk:${sk.color}" title="${tag === 'ULT' ? '필살기' : `스킬 ${tag}`} · ${sk.name}">${icon(sk.icon, 16)}<span>${sk.name}</span></li>`
                : `<li class="is-off" title="파츠 없음">${icon('lock', 14)}<span>—</span></li>`;
        });
        if (leg) chips.push(`<li style="--sk:#8b95a8" title="패시브 · ${leg.name}">${icon('shield', 16)}<span>${leg.name}</span></li>`);
        el.querySelector('.v2-charcard__skills').innerHTML = chips.join('');

        el.querySelector('.v2-charcard__foot').innerHTML = `<span>파츠 <b>${own.owned}</b> / ${own.total} 보유</span>`
            + (soon ? `<em class="v2-release-date">곧 공개 · ${releaseDateOf('characters', c.id)}</em>`
                : locked ? `<em class="is-lock">${icon('lock', 12)} ★${progress.characterStars(c.id)}로 해금</em>`
                : away ? '<em class="is-need">파견 중</em>'
                    : ready ? '<em class="is-ready">출격 가능</em>' : '<em class="is-need">연구소에서 몸통 구매</em>');

        this.renderRig(c.id, parts);
    }

    renderRig(id, parts) {
        const card = this.cards[id];
        const config = rigConfigFor(parts, id);
        if (!config) return;
        if (!card.rig) card.rig = new RigAvatar(card.el.querySelector('canvas'), { ...CARD_RIG, character: id });
        if (config.arm) card.rig.setArm(config.arm);
        card.rig.setPartFilters(config.filters);
        card.rig.setVariants(config.variants);   // A·B 세트 부위 그림 (D-050)
        card.rig.setUpgrades(config.upgrades);   // 새 캐릭터 강화 부위 그림 (D-044)
        card.rig.start();
    }

    renderInfo(message = '') {
        if (message && isMobile()) this.toast(message);   // 휴대폰 배치는 아래 줄이 없어 잠깐 뜨는 알림으로
        const box = $('select-info-v2');
        if (!box) return;
        const c = rosterOf(progress.character);
        const own = progress.ownedCountOf(progress.character);
        const ready = progress.isReady();
        box.innerHTML = `<span>선택 <b style="color:${c.color}">${RIG_CHARACTERS[c.id].name}</b></span>`
            + `<span>파츠 <b>${own.owned}</b> / ${own.total} 보유</span>`
            + `<span>남은 별 <b>★${progress.availableStars()}</b></span>`
            + `<small${message ? ' class="is-warn"' : ''}>${message || (ready ? '연구소에는 이 캐릭터의 파츠만 나옵니다 · 캐릭터마다 장착을 따로 기억합니다'
                : '몸통 파츠가 없어 아직 출격할 수 없습니다 — 연구소에서 파츠를 구매하세요')}</small>`;
        const lab = $('btn-select-lab-v2');
        if (lab) lab.classList.toggle('is-hint', !ready);
    }

    toast(message) {
        const el = $('select-toast-v2');
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
    }

    /** 선택창을 떠날 때: 카드 리그 멈춤 */
    onLeave() {
        for (const card of Object.values(this.cards)) if (card.rig) card.rig.stop();
    }
}
