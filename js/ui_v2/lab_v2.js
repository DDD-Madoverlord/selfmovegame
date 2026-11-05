/* ==========================================================================
   PROJECT: MAD OVERLORD // 연구소: 파츠 개조·강화 (v2, 가로 1280x720)
   - 왼쪽: 개조 미리보기 — 장바구니(선택 중인) 파츠로 조립한 리그 캐릭터 (캐릭터는 선택창에서 고름, 안 산 부위는 흐리게)
   - 가운데: 능력치 비교(현재 → 개조 후, 강화 레벨 반영) + 스킬 구성(팔 1 / 몸통 2 / 머리 필살기 / 다리 패시브)
   - 오른쪽: 부위 탭 + 파츠 카드(리그 부위 그림, 캐릭터 색, 세트, 레벨, 능력치, 부여 스킬, 장착·보유·가격) + 선택 파츠 강화
     카드는 고른 캐릭터의 파츠만, [파츠제거]는 없음 — 부위마다 하나는 꼭 낌 (D-051)
   - 아래: 변경 수, 구매 비용, 개조 후 잔액, 되돌리기, 개조 확정
   세트 장비 (Q-008, sets_v2.js): 카드에 "레어 ① 포격 사령부"·등급 바닥, 스킬 구성 아래에 세트 효과(2·4부위),
     안 가진 세트 파츠는 등급 칸 버튼이 "만들기"(파츠 조각), 드랍 전용(유니크 세트)은 DM으로 못 삼
   세트 알아보기 (2026-10-24): 카드 그림 모서리에 세트 표시(R① · U② · L① — 등급 색), 지금 모으는 세트(마지막으로 고른 세트 파츠,
     없으면 장바구니에 가장 많이 낀 세트)의 짝 카드는 맨 앞 + 테두리, 부위 탭에 그 세트를 담은 부위 점(●),
     다섯째 "세트" 탭 = 세트마다 네 부위 그림·보유·세트 효과 한 줄 + [세트로 담기](네 부위를 한 번에 장바구니로)
   파츠 등급 (2026-11-03, Q-017 C안 → D-096): 카드 그림 칸·테두리·이름 = 등급 색 + 그림 아래 등급 이름 띠(커먼 포함),
     목록은 모으는 세트 짝 → 등급 높은 순으로 묶고 묶음마다 머리 줄, 부위 탭 아래 등급 거르기 칩(전체·레전더리·유니크·레어·커먼)
   파츠 소유·강화·저장은 js/engine_v2/progress_v2.js (D-015). 파츠 데이터는 js/data/parts.js (구버전과 공용, 읽기만), 캐릭터별 목록은 roster_v2.js
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { PART_SKILL, SKILLS, skillsForParts, legPassiveOf } from '../engine_v2/skills_v2.js';
import { progress, LEVEL_BONUS } from '../engine_v2/progress_v2.js';
import { highestDifficulty, nextDifficultyOf, FINAL_STAGE_ID } from '../engine_v2/difficulty_v2.js';
import { RigAvatar, rigConfigFor, variantThumb, mechArmOf } from '../engine_v2/rig/rigAvatar.js';
import { RIG_CHARACTERS } from '../engine_v2/rig/characters.js';
import { rosterOf, characterOfPart, partsOfCharacter, partSetLabel } from '../engine_v2/roster_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { icon, fillIcons } from './icons.js';
import { openSettings } from './settingsPanel_v2.js';
import { GRADES, gradeOf, gradeIndex, SKILL_LEVEL } from '../engine_v2/growth_v2.js';
import { optionText } from './growthUi_v2.js';
import { refreshCurrency } from './currencyBar_v2.js';
import { setOf, setIdOf, setCounts, setLabelOf, setBonusList, isDropOnly, SETS, SET_TIERS, SET_PERKS } from '../engine_v2/sets_v2.js';

const $ = id => document.getElementById(id);
const ROLE = { arm: { tag: '1', label: '스킬 1' }, body: { tag: '2', label: '스킬 2' }, head: { tag: 'ULT', label: '필살기' }, leg: { tag: 'P', label: '패시브' } };
// 카드 그림: 그 캐릭터 리그의 해당 부위 그림 (새 캐릭터는 강화 파츠면 <부위>_up 그림)
const upThumb = file => p => (p.rigUpgrade ? file.replace('.png', '_up.png') : file);
const NEW_THUMB = { head: upThumb('head.png'), body: upThumb('torso.png'), arm: upThumb('armF.png'), leg: upThumb('legF.png') };
const THUMB = {
    mech: { head: 'head.png', body: 'body.png', arm: p => `armR_${mechArmOf(p)}.png`, leg: 'legR.png' },   // 팔은 전투 리그와 같은 규칙 (2차 세트 rigArm)
    kaiju: { head: 'head.png', body: 'body.png', arm: 'armF.png', leg: 'legF.png' },
    hero: { head: 'head.png', body: 'torso.png', arm: 'sword.png', leg: 'shinF.png' },
    chimera: { head: 'head.png', body: 'torso.png', arm: 'armF.png', leg: 'legF.png' },
    // 새 캐릭터: 강화 파츠는 강화 그림 (D-044)
    diver: NEW_THUMB,
    saint: NEW_THUMB,
    frost: NEW_THUMB,
    doll: NEW_THUMB,
    architect: NEW_THUMB,
    broadcaster: NEW_THUMB
};
const SLOTS4 = ['head', 'body', 'arm', 'leg'];
const SLOT_NAME = { head: '머리', body: '몸통', arm: '팔', leg: '다리' };
const TIER_ORDER = { rare: 0, unique: 1, legendary: 2 };
const TIER_SHORT = { rare: 'R', unique: 'U', legendary: 'L' };
/** 카드 그림 모서리의 세트 표시: 등급 첫 글자 + 번호 (R① · U② · L①), 등급 색 */
const setMark = s => (s ? `<span class="v2-setmark" style="--grade:${gradeOf(SET_TIERS[s.tier].minGrade).color}">${TIER_SHORT[s.tier]}${'①②③④'[s.no - 1] || s.no}</span>` : '');
const COMPARE_ROWS = [['최대 체력', 'hp'], ['초당 피해', 'dps'], ['사거리', 'range'], ['이동 속도', 'speed']];   // 능력치 비교 · 휴대폰 카드 안 능력치
const LAB_RIG = { width: 350, height: 400, rootX: 175, rootY: 384, scale: 0.36, fit: { x: 22, y: 16 }, shadow: true, fitCss: true };   // fitCss: 휴대폰 배치 실제 크기에서도 선명하게 (rigAvatar.js _fitRes)

/** 카드 그림 { src, filter }: A·B 세트 파츠는 세트 그림(있으면) 또는 기본 그림 + 세트 색 (D-050) */
function thumbOf(slot, part) {
    const c = characterOfPart(part);
    if (!c || !THUMB[c]) return null;
    const file = THUMB[c][slot];
    const t = variantThumb(c, typeof file === 'function' ? file(part) : file, part.rigVariant);
    return { src: `assets/sprites/rig/${c}/${t.file}`, filter: t.filter };
}

/** 드랍 전용(유니크·레전더리 세트) 카드 배지 = 만들기 조각 수 (11-05 피드백 10번 — 예전 '드랍·조각') */
function dropBadge(part) {
    const c = progress.craftCost(part.id);
    return c ? [`${icon('shard', 11)}조각 ${c.shards}`, `is-drop${c.shards > progress.shards ? ' is-poor' : ''}`] : ['드랍 전용', 'is-drop'];
}

/** 세트 줄: 아직 없는 파츠를 다 얻는 값 — DM으로 살 수 있으면 DM 합, 아니면 만들기 조각 합 (11-05 피드백 10번) */
function setCostHtml(parts) {
    let dm = 0, shards = 0;
    for (const p of parts) {
        if (!p || progress.isOwned(p.id)) continue;
        if (!isDropOnly(p) && p.cost) dm += p.cost;
        else shards += progress.craftCost(p.id)?.shards || 0;
    }
    if (!dm && !shards) return parts.some(Boolean) ? '<span class="v2-setrow__cost is-done">모두 보유</span>' : '';
    const bits = [];
    if (dm) bits.push(`<em class="${dm > gameState.darkMatter ? 'is-poor' : ''}">${icon('gem', 12)}${dm.toLocaleString()} DM</em>`);
    if (shards) bits.push(`<em class="${shards > progress.shards ? 'is-poor' : ''}">${icon('shard', 12)}조각 ${shards}<i>/${progress.shards}</i></em>`);
    return `<span class="v2-setrow__cost" title="아직 없는 파츠를 모두 얻는 값">남은 파츠 ${bits.join(' + ')}</span>`;
}

function skillOf(slot, part) {
    if (!part || part.id === 'none') return null;
    if (slot === 'leg') {
        const p = legPassiveOf(part);
        return p ? { name: p.name, desc: p.desc, icon: 'shield', color: '#8b95a8', passive: true } : null;
    }
    const id = PART_SKILL[part.id];
    return id ? { id, ...SKILLS[id] } : null;
}

export class LabController {
    constructor(switchScreenFn) {
        this.switchScreen = switchScreenFn;
        this.activeSlot = 'head';
        this.gradeFilter = 'all';
        this.root = $('screen-lab-v2');
        this.domPartsGrid = $('parts-grid-v2');
        this.domGradeBar = $('parts-gradebar-v2');
        this.domDmCount = $('lab-dm-count-v2');
        this.btnEquip = $('btn-equip-confirm-v2');
        const canvas = $('lab-rig-canvas-v2');
        this.rig = canvas ? new RigAvatar(canvas, LAB_RIG) : null;
        this.rigOn = false;
        fillIcons(this.root);
        const chip = this.root && this.root.querySelector('.v2-chip--dm');
        if (chip) chip.insertAdjacentHTML('afterbegin', icon('gem', 18));
        this.initEvents();
    }

    initEvents() {
        $('btn-lab-back-v2')?.addEventListener('click', () => this.switchScreen('menu'));
        $('btn-lab-settings-v2')?.addEventListener('click', () => openSettings());
        // 휴대폰 배치 (ui_v2_mobile.css): [스킬]을 누르면 파츠 칸 자리에 스킬 구성 (한 번 더 누르면 파츠)
        $('btn-lab-skills-v2')?.addEventListener('click', e => {
            const on = this.root?.querySelector('.v2-lab')?.classList.toggle('is-mskills');
            e.currentTarget.setAttribute('aria-pressed', String(!!on));
            this.updateSkillScrollHint();
        });

        const skills = $('lab-skills-v2');
        if (skills) {
            skills.addEventListener('scroll', () => this.updateSkillScrollHint(), { passive: true });
            this.skillResizeObserver = new ResizeObserver(() => this.updateSkillScrollHint());
            [skills, $('lab-loadout-v2'), $('lab-setbonus-v2')].filter(Boolean)
                .forEach(el => this.skillResizeObserver.observe(el));
        }

        const tabs = this.root.querySelectorAll('.tab-btn-v2');
        tabs.forEach(btn => btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.activeSlot = btn.dataset.slot || 'head';
            const upg = $('lab-upgrade-v2');
            if (upg) upg.hidden = this.activeSlot === 'set';   // 세트 탭: 강화 칸 대신 목록을 길게
            this.renderPartsGrid();
            this.renderUpgrade();
            this.renderSetBonus(gameState.getCartObjects());
        }));

        // 등급 거르기 칩 (소리는 main_v2.js가 연구소 버튼마다 냄)
        this.domGradeBar?.addEventListener('click', e => {
            const chip = e.target.closest('.v2-gradechip');
            if (!chip || chip.disabled) return;
            this.gradeFilter = chip.dataset.grade;
            this.renderPartsGrid();
        });

        $('btn-cart-reset-v2')?.addEventListener('click', () => {
            gameState.resetCartToEquipped();
            this.refresh();
        });

        this.btnEquip?.addEventListener('click', () => {
            const changed = Object.keys(gameState.cartParts).filter(slot => gameState.cartParts[slot] !== gameState.equippedParts[slot]);
            const res = progress.confirmCart();
            sound.play(res.success ? 'ui_equip' : 'ui_error');
            if (res.success) {
                if (!res.cost && changed.length) progress.tutorialGrowth(gameState.equippedParts[changed[0]], true);
                this.showNotification(res.cost ? `개조 완료! (구매 -${res.cost.toLocaleString()} DM)` : '개조 완료!', 'success');
                this.refresh();
            } else {
                this.showNotification(res.reason, 'error');
            }
        });

        // 등급 올리기 (파츠 조각, Q-006) · 안 가진 세트 파츠는 조각으로 만들기 (Q-008)
        $('btn-grade-v2')?.addEventListener('click', () => {
            const id = gameState.cartParts[this.activeSlot];
            if (!progress.isOwned(id) && progress.craftCost(id)) {
                const res = progress.craftPart(id);
                sound.play(res.success ? 'ui_equip' : 'ui_error');
                this.showNotification(res.success ? `제작 완료! ${res.name} (${gradeOf(res.grade).name}, 조각 -${res.shards})` : res.reason, res.success ? 'success' : 'error');
                if (res.success) this.refresh();
                return;
            }
            const res = progress.upgradeGradeWithShards(id);
            sound.play(res.success ? 'ui_equip' : 'ui_error');
            this.showNotification(res.success ? `등급 상승! ${gradeOf(res.grade).name}` : res.reason, res.success ? 'success' : 'error');
            if (res.success) this.refresh();
        });
        // 스킬 강화 (스킬 코어 + DM, Q-006) — 스킬 구성 목록의 ▲ 버튼
        $('lab-loadout-v2')?.addEventListener('click', e => {
            const b = e.target.closest('.v2-skillup');
            if (!b || b.disabled) return;
            const res = progress.upgradeSkill(b.dataset.skill);
            sound.play(res.success ? 'ui_equip' : 'ui_error');
            this.showNotification(res.success ? `스킬 강화! Lv${res.level}` : res.reason, res.success ? 'success' : 'error');
            if (res.success) this.refresh();
        });

        $('btn-upgrade-v2')?.addEventListener('click', () => {
            const id = gameState.cartParts[this.activeSlot];
            const res = progress.upgrade(id);
            sound.play(res.success ? 'ui_equip' : 'ui_error');
            if (res.success) {
                progress.tutorialGrowth(id, true);
                this.showNotification(`강화 성공! Lv${res.level} (-${res.cost.toLocaleString()} DM)`, 'success');
                const box = $('lab-upgrade-v2');
                box.classList.remove('is-flash');
                void box.offsetWidth;
                box.classList.add('is-flash');
                this.refresh();
            } else {
                this.showNotification(res.reason, 'error');
            }
        });
    }

    showNotification(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `v2-toast${type === 'success' ? '' : ' is-error'}`;
        el.textContent = msg;
        this.root.querySelector('.v2-lab').appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    refresh() {
        this.renderPartsGrid();
        this.updateMvvmFeedback();
    }

    // ------------------------------------------------------------------
    /** 지금 모으는 세트 id: 마지막으로 고른 세트 파츠의 세트(장바구니에 남아 있으면), 아니면 장바구니에 가장 많이 낀 세트 */
    focusSet() {
        const counts = setCounts(gameState.getCartObjects());
        if (this.lastSet && counts[this.lastSet]) return this.lastSet;
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return best ? best[0] : null;
    }

    /** 부위 탭의 점: 지금 모으는 세트를 장바구니에 담은 부위 */
    renderTabDots() {
        const focus = this.focusSet();
        const cart = gameState.getCartObjects();
        this.root.querySelectorAll('.v2-slottab[data-slot]').forEach(tab => {
            const slot = tab.dataset.slot;
            if (slot === 'set') return;
            let dot = tab.querySelector('.v2-slottab__dot');
            if (!dot) { dot = document.createElement('i'); dot.className = 'v2-slottab__dot'; tab.appendChild(dot); }
            const on = !!focus && setIdOf(cart[slot]) === focus;
            dot.hidden = !focus;
            dot.classList.toggle('is-on', on);
            dot.title = focus ? `${setLabelOf({ id: focus, ...SETS[focus] })} — ${on ? '담음' : '아직 안 담음'}` : '';
        });
    }

    renderPartsGrid() {
        if (!this.domPartsGrid) return;
        const slot = this.activeSlot;
        this.renderTabDots();
        this.renderReplay();
        if (slot === 'set') { this.renderSetGrid(); return; }   // 세트 탭도 등급 칩 (11-05 피드백 8번 — 세트 줄 등급으로 셈)
        this.domPartsGrid.classList.remove('is-sets');
        const focus = this.focusSet();
        // 고른 캐릭터의 파츠만 (D-051) — 모으는 세트의 짝을 맨 앞에, 나머지는 등급 높은 순 (같은 등급은 원래 순서)
        const rows = partsOfCharacter(progress.character, slot).map(part => ({
            part,
            grade: gradeOf(progress.isOwned(part.id) || setOf(part) ? progress.gradeOf(part.id) : 'common'),   // 세트 파츠는 안 가져도 등급 바닥을 보임
            mate: !!focus && setIdOf(part) === focus
        })).sort((a, b) => (b.mate - a.mate) || (gradeIndex(b.grade.id) - gradeIndex(a.grade.id)));
        const counts = Object.fromEntries(GRADES.map(g => [g.id, rows.filter(r => r.grade.id === g.id).length]));
        if (this.gradeFilter !== 'all' && !counts[this.gradeFilter]) this.gradeFilter = 'all';   // 이 부위에 그 등급이 없으면 전체로
        this.renderGradeBar(rows.length, counts);
        const shown = this.gradeFilter === 'all' ? rows : rows.filter(r => r.grade.id === this.gradeFilter);
        const groupOf = r => (r.mate ? 'mate' : r.grade.id);
        const focusCount = focus ? setCounts(gameState.getCartObjects())[focus] || 0 : 0;
        const cartId = gameState.cartParts[slot];
        const equippedId = gameState.equippedParts[slot];

        this.domPartsGrid.innerHTML = '';
        const color = (rosterOf(progress.character) || {}).color || '#5a6272';
        let group = null;
        shown.forEach(row => {
            const { part, grade, mate } = row;
            if (groupOf(row) !== group) {
                group = groupOf(row);
                const head = document.createElement('div');
                head.className = `v2-partgroup${mate ? ' is-mate' : ''}`;
                if (!mate) head.style.setProperty('--grade', grade.color);
                head.innerHTML = `${mate ? '모으는 세트' : grade.name}<small>${shown.filter(r => groupOf(r) === group).length}개</small>`;
                this.domPartsGrid.appendChild(head);
            }
            const sk = skillOf(slot, part);
            const thumb = thumbOf(slot, part);
            const owned = progress.isOwned(part.id);
            const lock = progress.tierLock(part);   // 등급 단계 잠김 (11-03): 아래 등급 파츠를 더 가져야 사거나 만들 수 있음
            const badge = part.id === equippedId ? ['EQUIPPED', 'is-equipped']
                : owned ? [part.cost ? 'OWNED' : 'FREE', part.cost ? 'is-owned' : 'is-free']
                    : lock ? [`${icon('lock', 10)}${gradeOf(lock.from).name} ${lock.have}/${lock.need}`, 'is-tierlock']
                        : isDropOnly(part) ? dropBadge(part)
                            : [`${icon('gem', 11)}${part.cost.toLocaleString()} DM`, part.cost > gameState.darkMatter ? 'is-poor' : ''];
            const st = progress.partStats(part);
            const lv = progress.levelOf(part.id);
            const card = document.createElement('div');
            card.className = `part-card v2-partcard${part.id === cartId ? ' is-selected' : ''}${mate ? ' is-setmate' : ''}${lock ? ' is-tierlocked' : ''}`;
            if (lock) card.title = progress.tierLockText(lock);
            card.dataset.id = part.id;   // 검사는 이름 대신 id로 찾음
            card.dataset.grade = grade.id;
            card.style.setProperty('--fc', color);
            card.style.setProperty('--grade', grade.color);
            card.innerHTML = `
                <div class="v2-partcard__side">
                    <div class="v2-partcard__thumb">${thumb ? `<img src="${thumb.src}" alt=""${thumb.filter ? ` style="filter: ${thumb.filter}"` : ''}>` : icon('retreat', 30)}${setMark(setOf(part))}<span class="v2-partcard__grade">${grade.name}</span></div>
                    <span class="v2-partcard__badge ${badge[1]}">${badge[0]}</span>
                </div>
                <div class="v2-partcard__body">
                    <div class="v2-partcard__name">${part.name}${part.id !== 'none' && lv > 1 ? `<span class="v2-partcard__lv">Lv${lv}</span>` : ''}</div>
                    <div class="v2-partcard__faction">세트 · ${partSetLabel(part)}${mate ? `<b class="v2-partcard__mate">모으는 중 ${focusCount}/4</b>` : ''}</div>
                    <div class="v2-partcard__stats">HP +${st.hp} · DPS +${st.dps}${st.range ? ` · RNG +${st.range}` : ''}</div>
                    <dl class="v2-partcard__totals"></dl>
                    ${sk ? `<div class="v2-partcard__skill" style="--sk:${sk.color}"><em>${ROLE[slot].tag}</em>${icon(sk.icon, 13)}${sk.name}</div>` : '<div class="v2-partcard__skill">스킬 없음</div>'}
                </div>`;
            card.addEventListener('click', () => {
                gameState.selectCartPart(slot, part.id);
                progress.tutorialCompare(part.id);
                const sid = setIdOf(part);
                if (sid) this.lastSet = sid;
                this.renderPartsGrid();
                this.updateMvvmFeedback();
                this.previewSkill(slot, part);
            });
            this.domPartsGrid.appendChild(card);
        });
        this.renderCardTotals();
    }

    /** 부위 탭 아래 등급 거르기 칩: 전체 · 레전더리 · 유니크 · 레어 · 커먼 + 개수 (그 부위에 없는 등급은 못 누름) */
    renderGradeBar(total, counts) {
        if (!this.domGradeBar) return;
        const chip = (id, name, n, color) => `<button class="v2-gradechip${this.gradeFilter === id ? ' is-on' : ''}" data-grade="${id}"`
            + `${color ? ` style="--grade:${color}"` : ''}${n ? '' : ' disabled'}>${name}<b>${n}</b></button>`;
        this.domGradeBar.innerHTML = chip('all', '전체', total) + [...GRADES].reverse().map(g => chip(g.id, g.name, counts[g.id], g.color)).join('');
    }

    /** 세트 탭: 세트마다 한 줄 — 등급·이름·보유/담음, 네 부위 그림(누르면 그 부위만 담기), 세트 효과, [세트로 담기] */
    renderSetGrid() {
        const char = progress.character;
        const cart = gameState.getCartObjects();
        const grid = this.domPartsGrid;
        grid.innerHTML = '';
        grid.classList.add('is-sets');
        const rows = Object.entries(SETS).filter(([, s]) => s.character === char)
            .sort(([, a], [, b]) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || (a.no - b.no))
            .map(([sid, s]) => {
                const perk = SET_PERKS[sid];   // 전투 밖 세트 효과 (협력·파견, 11-03)
                return { sid, grade: SET_TIERS[s.tier].minGrade, color: gradeOf(SET_TIERS[s.tier].minGrade).color, mark: setMark(s), label: setLabelOf({ id: sid, ...s }),
                    parts: SLOTS4.map(slot => partsOfCharacter(char, slot).find(p => setIdOf(p) === sid) || null),
                    bonus: [...Object.entries(s.bonus || {}), ...(perk ? [[perk.need, perk.text]] : [])] };
            });
        // 세트가 아닌 커먼 파츠도 맨 아래에 줄로 보임 — 부위마다 n번째 커먼 파츠끼리 한 줄 (기본 · 강화), 세트 효과 없음 (11-03)
        const commons = SLOTS4.map(slot => partsOfCharacter(char, slot).filter(p => !setIdOf(p)));
        const cColor = gradeOf('common').color;
        for (let k = 0; k < Math.max(0, ...commons.map(l => l.length)); k++) {
            rows.push({ sid: null, grade: 'common', color: cColor, parts: commons.map(l => l[k] || null),
                mark: `<span class="v2-setmark" style="--grade:${cColor}">C${'①②③④'[k] || k + 1}</span>`,
                label: k ? `커먼 강화 파츠${k > 1 ? ` ${k}` : ''}` : '커먼 기본 파츠', bonus: [] });
        }
        if (!rows.length) {
            if (this.domGradeBar) this.domGradeBar.innerHTML = '';
            grid.innerHTML = '<p class="v2-setrow__empty">이 캐릭터는 아직 세트가 없습니다</p>';
            return;
        }
        const counts = Object.fromEntries(GRADES.map(g => [g.id, rows.filter(r => r.grade === g.id).length]));
        if (this.gradeFilter !== 'all' && !counts[this.gradeFilter]) this.gradeFilter = 'all';
        this.renderGradeBar(rows.length, counts);
        const color = (rosterOf(char) || {}).color || '#5a6272';
        for (const { sid, color: gColor, mark, label, parts, bonus: bonusList, grade } of rows) {
            if (this.gradeFilter !== 'all' && grade !== this.gradeFilter) continue;
            const n = parts.filter(Boolean).length;
            const owned = parts.filter(p => p && progress.isOwned(p.id)).length;
            const inCart = parts.filter((p, i) => p && cart[SLOTS4[i]] && cart[SLOTS4[i]].id === p.id).length;
            const row = document.createElement('div');
            row.className = `v2-setrow${inCart ? ' is-in' : ''}${sid ? '' : ' is-common'}`;
            row.style.setProperty('--grade', gColor);
            row.style.setProperty('--fc', color);
            const cells = parts.map((p, i) => {
                if (!p) return '<div class="v2-setrow__part is-none"></div>';
                const t = thumbOf(SLOTS4[i], p);
                const cls = `${cart[SLOTS4[i]] && cart[SLOTS4[i]].id === p.id ? ' is-in' : ''}${progress.isOwned(p.id) ? ' is-owned' : ''}`;
                return `<button class="v2-setrow__part${cls}" data-slot="${SLOTS4[i]}" data-id="${p.id}" title="${p.name}">`
                    + `<span class="v2-setrow__img">${t ? `<img src="${t.src}" alt=""${t.filter ? ` style="filter: ${t.filter}"` : ''}>` : ''}</span>`
                    + `<small>${SLOT_NAME[SLOTS4[i]]}</small><span class="v2-setrow__name">${p.name}</span></button>`;
            }).join('');
            const bonus = bonusList.map(([need, d]) => `<li class="${inCart >= Number(need) ? 'is-on' : ''}"><b>${need}부위</b> ${d}</li>`).join('')
                || '<li>세트 효과 없음</li>';
            row.innerHTML = `
                <div class="v2-setrow__head">${mark}<b>${label}</b>
                    <span class="v2-setrow__meta"><small>보유 ${owned}/${n} · 담음 ${inCart}/${n}</small>${setCostHtml(parts)}</span>
                    ${sid ? '<button class="v2-btn v2-btn--ghost v2-setrow__skills">세트 스킬</button>' : ''}
                    <button class="v2-btn v2-setrow__take" ${inCart === n ? 'disabled' : ''}>${inCart === n ? '담음' : n === 4 ? '세트로 담기' : '모두 담기'}</button></div>
                <div class="v2-setrow__parts">${cells}</div>
                <ul class="v2-setrow__bonus">${bonus}</ul>`;
            row.querySelector('.v2-setrow__take').addEventListener('click', () => {
                parts.forEach((p, i) => {
                    if (p) { gameState.selectCartPart(SLOTS4[i], p.id); progress.tutorialCompare(p.id); }
                });
                this.lastSet = sid;
                sound.play('ui_click');
                this.refresh();
            });
            row.querySelector('.v2-setrow__skills')?.addEventListener('click', () => {
                sound.play('ui_click');
                this.openSetSkills({ mark, label, parts, bonus: bonusList, color: gColor });
            });
            row.querySelectorAll('.v2-setrow__part[data-id]').forEach(b => b.addEventListener('click', () => {
                gameState.selectCartPart(b.dataset.slot, b.dataset.id);
                progress.tutorialCompare(b.dataset.id);
                this.lastSet = sid;
                sound.play('ui_click');
                this.refresh();
            }));
            grid.appendChild(row);
        }
    }

    /**
     * 파츠를 고르면 그 파츠 스킬을 캐릭터 칸에서 재생 (11-05 피드백 11번): 리그 확인 페이지 무대(rig_test.html?embed=1 — 스킬 미리보기
     * skillPreviews.js, 적 더미·같은 이펙트)를 캐릭터 칸 위 iframe으로 띄우고 { char, equip, part }를 보냄. 끝나면 사라지고 [▶ 스킬]로 다시
     */
    previewSkill(slot, part) {
        const sk = skillOf(slot, part);
        const stage = this.root?.querySelector('.v2-lab__stage');
        if (!sk || !stage) return;
        if (!this.skillPrev) {
            const box = this.skillPrev = document.createElement('div');
            box.className = 'v2-skillprev';
            box.hidden = true;
            box.innerHTML = '<iframe src="rig_test.html?embed=1" title="스킬 미리보기" tabindex="-1"></iframe><b class="v2-skillprev__name"></b>';
            box.addEventListener('click', () => this.hideSkillPreview());
            stage.appendChild(box);
            window.addEventListener('message', e => {
                if (e.origin !== location.origin || !e.data) return;
                if (e.data.type === 'mo-skill-preview-ready') { this.prevReady = true; this.sendSkillPreview(); }
                else if (e.data.type === 'mo-skill-preview-done') this.prevDone = e.data;
            });
        }
        this.prevWant = { slot, part };
        this.skillPrev.querySelector('.v2-skillprev__name').innerHTML = `<em style="--sk:${sk.color}">${ROLE[slot].tag}</em>${sk.name}`;
        this.skillPrev.hidden = false;
        this.skillPrev.classList.add('is-on');
        clearTimeout(this.prevTimer);
        this.prevTimer = setTimeout(() => this.hideSkillPreview(), 12000);   // 무대가 안 뜨면(불러오는 중 오류) 그래도 닫힘
        if (this.prevReady) this.sendSkillPreview();
    }

    sendSkillPreview() {
        const w = this.prevWant;
        const win = this.skillPrev?.querySelector('iframe')?.contentWindow;
        if (!w || !win) return;
        this.prevWant = null;
        const cart = gameState.getCartObjects();
        const equip = Object.fromEntries(SLOTS4.map(s => [s, cart[s]?.id]).filter(([, id]) => id && id !== 'none'));
        win.postMessage({ type: 'mo-skill-preview', char: characterOfPart(w.part) || progress.character, equip, part: w.part.id }, location.origin);
        clearTimeout(this.prevTimer);
        this.prevTimer = setTimeout(() => this.hideSkillPreview(), w.slot === 'head' ? 6500 : 4500);   // 필살기는 길게
    }

    /** 캐릭터 칸 [▶ 스킬]: 지금 부위에 담은 파츠의 스킬을 다시 (스킬 없는 파츠·세트 탭에서는 숨김) */
    renderReplay() {
        const stage = this.root?.querySelector('.v2-lab__stage');
        if (!stage) return;
        if (!this.replayBtn) {
            const b = this.replayBtn = document.createElement('button');
            b.className = 'v2-btn v2-btn--ghost v2-skillprev__again';
            b.textContent = '▶ 스킬';
            b.title = '고른 파츠의 스킬 보기';
            b.addEventListener('click', () => {
                const part = gameState.getCartObjects()[this.activeSlot];
                this.previewSkill(this.activeSlot, part);
            });
            stage.appendChild(b);
        }
        const part = this.activeSlot === 'set' ? null : gameState.getCartObjects()[this.activeSlot];
        this.replayBtn.hidden = !skillOf(this.activeSlot, part);
    }

    hideSkillPreview() {
        const box = this.skillPrev;
        if (!box || box.hidden) return;
        clearTimeout(this.prevTimer);
        box.classList.remove('is-on');
        setTimeout(() => { if (!box.classList.contains('is-on')) box.hidden = true; }, 250);
    }

    /** [세트 스킬] 창: 세트 효과(2·4부위) + 네 파츠가 주는 스킬 (11-05 피드백 6번) — 닫기·바깥·Escape로 닫음 */
    openSetSkills({ mark, label, parts, bonus, color }) {
        this.root.querySelector('.v2-setskill')?.remove();
        const box = document.createElement('div');
        box.className = 'v2-setskill';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', `${label} 세트 스킬`);
        const skills = parts.map((p, i) => {
            const slot = SLOTS4[i], sk = skillOf(slot, p);
            if (!p) return '';
            const cd = sk && sk.cd ? `<i>쿨다운 ${sk.cd}초</i>` : sk && sk.passive ? '<i>항상 켜짐</i>' : '';
            return `<li style="--sk:${sk ? sk.color : '#5a6272'}"><span class="v2-setskill__icon">${icon(sk ? sk.icon : 'lock', 22)}</span>`
                + `<div><b><em>${ROLE[slot].tag}</em>${sk ? sk.name : '스킬 없음'}${cd}</b><small>${SLOT_NAME[slot]} · ${p.name}</small>`
                + `${sk && sk.desc ? `<p>${sk.desc}</p>` : ''}</div></li>`;
        }).join('');
        box.innerHTML = `<div class="v2-setskill__box" style="--grade:${color}">
            <header>${mark}<h3>${label}</h3><button class="v2-iconbtn" data-act="close" aria-label="닫기">✕</button></header>
            <ul class="v2-setskill__bonus">${bonus.map(([need, d]) => `<li><b>${need}부위</b> ${d}</li>`).join('') || '<li>세트 효과 없음</li>'}</ul>
            <ul class="v2-setskill__list">${skills}</ul></div>`;
        const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); };
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-act="close"]')) close(); });
        document.addEventListener('keydown', onKey, true);
        (this.root.querySelector('.v2-lab') || this.root).appendChild(box);
        box.querySelector('[data-act="close"]').focus();
    }

    updateMvvmFeedback() {
        refreshCurrency();   // 별·조각·코어 · DM (currencyBar_v2.js)
        this.renderCompare();
        this.renderLoadout();
        this.renderCart();
        this.renderUpgrade();
        // 미리보기는 연구소 화면일 때만 (전투 중 재화 변동으로 불릴 때는 그리지 않음)
        if (gameState.currentScreen === 'lab') this.renderPreview();
    }

    renderCompare() {
        const cur = progress.statsFor(gameState.getEquippedObjects());
        const next = progress.statsFor(gameState.getCartObjects());
        this.renderCardTotals(cur, next);
        $('lab-compare-v2').innerHTML = COMPARE_ROWS.map(([label, k]) => {
            const d = next[k] - cur[k];
            const cls = d > 0 ? 'is-up' : d < 0 ? 'is-down' : '';
            const delta = d ? `${d > 0 ? '▲' : '▼'}${Math.abs(d).toLocaleString()}` : '';
            return `<div><dt>${label}</dt><dd class="is-old">${cur[k].toLocaleString()}</dd><dd class="is-arrow">→</dd>`
                + `<dd class="${cls}">${next[k].toLocaleString()}</dd><dd class="is-delta ${cls}">${delta}</dd></div>`;
        }).join('');
    }

    /** 휴대폰 배치 (11-04 디자인 제안): 고른 파츠 카드 안에 개조 후 능력치 4칸 — PC는 숨김 (ui_v2.css) */
    renderCardTotals(cur = progress.statsFor(gameState.getEquippedObjects()), next = progress.statsFor(gameState.getCartObjects())) {
        const box = this.domPartsGrid?.querySelector('.v2-partcard.is-selected .v2-partcard__totals');
        if (!box) return;
        box.innerHTML = COMPARE_ROWS.map(([label, k]) => {
            const d = next[k] - cur[k];
            return `<div><dt>${label}</dt><dd class="${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}">${next[k].toLocaleString()}</dd></div>`;
        }).join('');
    }

    renderLoadout() {
        const cart = gameState.getCartObjects();
        const eq = gameState.getEquippedObjects();
        const cartSkills = skillsForParts(cart);
        const eqSkills = skillsForParts(eq);
        $('lab-loadout-v2').innerHTML = ['arm', 'body', 'head', 'leg'].map(slot => {
            const sk = slot === 'leg' ? skillOf('leg', cart.leg) : cartSkills[slot];
            const before = slot === 'leg' ? skillOf('leg', eq.leg) : eqSkills[slot];
            const changed = (sk && sk.name) !== (before && before.name);
            const meta = !sk ? '' : sk.ult ? '게이지' : sk.passive ? '상시' : `${sk.cd}초`;
            // 스킬 레벨·강화 (Q-006): 팔·몸통·필살기, 그 파츠를 가졌을 때만
            const part = cart[slot];
            const lvl = sk && !sk.passive && sk.id ? progress.skillLevel(sk.id) : 0;
            const cost = lvl ? progress.skillUpgradeCost(sk.id) : null;
            const canUp = lvl && part && progress.isOwned(part.id);
            const up = !lvl ? '' : cost == null ? `<button class="v2-skillup is-max" disabled>Lv${lvl} MAX</button>`
                : `<button class="v2-skillup" data-skill="${sk.id}" ${!canUp || cost.cores > progress.cores || cost.dm > gameState.darkMatter ? 'disabled' : ''}`
                    + ` title="다음 레벨: 스킬 피해 +${Math.round(SKILL_LEVEL.dmgPer * 100)}%${SKILL_LEVEL.cdCut[lvl + 1] ? ' · 쿨다운 단축' : ''}">Lv${lvl} ▲<small>코어${cost.cores}·${cost.dm.toLocaleString()}</small></button>`;
            return `<li class="${changed ? 'is-changed' : ''}" style="--sk:${sk ? sk.color : '#3a4150'}">
                <span class="v2-loadout__icon">${icon(sk ? sk.icon : 'retreat', 20)}</span>
                <div class="v2-loadout__body">
                    <div class="v2-loadout__name"><em>${ROLE[slot].tag}</em>${sk ? sk.name : '없음'}${changed ? '<b>NEW</b>' : ''}<i>${meta}</i>${up}</div>
                    <div class="v2-loadout__desc">${sk ? (sk.desc || '') : `${ROLE[slot].label} 파츠가 없습니다`}</div>
                </div></li>`;
        }).join('');
        this.renderSetBonus(cart);
        this.updateSkillScrollHint();
    }

    updateSkillScrollHint() {
        const box = $('lab-skills-v2');
        const hint = $('lab-skills-hint-v2');
        if (!box || !hint) return;
        const overflow = box.clientHeight > 0 && box.scrollHeight > box.clientHeight + 1;
        hint.hidden = !overflow;
        if (!overflow) return;
        const above = box.scrollTop > 1;
        const below = box.scrollTop + box.clientHeight < box.scrollHeight - 1;
        hint.textContent = [above ? '↑ 위에 더 있음' : '', below ? '아래에 더 있음 ↓' : ''].filter(Boolean).join(' · ');
    }

    /** 세트 효과 (Q-008): 장바구니 장착에 걸린 세트마다 "레어 ① 포격 사령부 3/4 · 4부위: …" (켜지면 밝게) */
    renderSetBonus(cart) {
        const box = $('lab-setbonus-v2');
        if (!box) return;
        // 자리가 좁아 2부위 이상 모은 세트만, 두 줄까지: 켜진 효과 먼저, 그다음 많이 모은 세트
        const list = setBonusList(cart).filter(b => b.count >= 2).sort((p, q) => (q.on - p.on) || (q.count - p.count)).slice(0, 2);
        box.hidden = !list.length || this.activeSlot !== 'set';   // 부위 탭에서는 세트 효과 줄을 뺌 — 세트 탭에서만 (11-05 피드백 5번)
        box.innerHTML = list.map(b => `<div class="v2-setbonus__row${b.on ? ' is-on' : ''}" title="${b.label} — ${b.need}부위: ${b.desc}">`
            + `<b>${b.on ? '◆' : '◇'} ${b.name} ${Math.min(b.count, b.need)}/${b.need}</b><span>${b.desc}</span></div>`).join('');
    }

    renderCart() {
        const changes = progress.cartChanges();
        const cost = progress.cartCost();
        const remain = gameState.darkMatter - cost;
        $('cart-count-v2').textContent = changes;
        $('cart-cost-v2').textContent = cost.toLocaleString();
        const rem = $('cart-remain-v2');
        rem.textContent = remain.toLocaleString();
        rem.classList.toggle('is-poor', remain < 0);
        if (this.btnEquip) {
            const locked = progress.cartLocked();   // 안 가진 드랍 전용 파츠 (유니크 세트)
            this.btnEquip.disabled = changes === 0 || remain < 0 || locked.length > 0;
            this.btnEquip.querySelector('small').textContent = changes === 0 ? '변경한 파츠 없음'
                : locked.length ? '드랍·조각 전용 파츠가 있음'
                    : remain < 0 ? 'DM 부족' : cost ? `구매 ${cost.toLocaleString()} DM · ${changes}개 장착` : `${changes}개 장착 (보유 파츠)`;
            // 휴대폰 [확정] 아래 줄 = 드는 DM (11-05 피드백 9번 — 휴대폰은 small·비용 줄이 없음)
            const em = $('lab-confirm-cost-v2');
            if (em) {
                em.textContent = changes === 0 ? '' : locked.length ? '조각 전용' : `${remain < 0 ? '부족 ' : ''}${cost.toLocaleString()} DM`;
                em.classList.toggle('is-poor', remain < 0);
            }
        }
    }

    /** 선택 중인(장바구니) 파츠 강화 칸 */
    renderUpgrade() {
        const part = gameState.getCartObjects()[this.activeSlot];
        const btn = $('btn-upgrade-v2');
        if (!btn) return;
        const valid = part && part.id !== 'none';
        const lv = valid ? progress.levelOf(part.id) : 0;
        $('lab-upg-name-v2').textContent = valid ? `${part.name}  Lv${lv}` : '파츠 없음';
        // 등급·옵션·조각으로 등급 올리기 (Q-006)
        const owned0 = valid && progress.isOwned(part.id);
        const g = gradeOf(owned0 ? progress.gradeOf(part.id) : 'common');
        const gTag = $('lab-upg-grade-v2');
        const gShow = valid && (owned0 || !!setOf(part));   // 세트 파츠는 안 가져도 등급 바닥
        const gv = gShow ? gradeOf(progress.gradeOf(part.id)) : g;
        if (gTag) { gTag.textContent = gShow ? gv.name : ''; gTag.style.setProperty('--grade', gv.color); }
        const opts = $('lab-upg-opts-v2');
        const craft = valid && !owned0 ? progress.craftCost(part.id) : null;   // 안 가진 세트 파츠: 조각으로 만들기 (Q-008)
        if (opts) opts.textContent = valid && owned0 ? (optionText(part.id) || (g.id === 'common' ? '옵션 없음 — 레어부터 (하드 이상 드랍·조각)' : ''))
            : craft ? `파츠 조각 ${craft.shards}개로 만들 수 있음 (보유 ${progress.shards}) · ${isDropOnly(part) ? '보스 첫 클리어(헬 이상) 확정 보상으로도 나옴' : 'DM으로도 살 수 있음'}` : '';
        const gc = valid ? progress.shardUpgradeCost(part.id) : null;
        const gBtn = $('btn-grade-v2');
        if (gBtn) {
            gBtn.querySelector('span').textContent = craft ? '만들기' : '등급 ▲';
            gBtn.disabled = craft ? craft.shards > progress.shards : !gc || gc.shards > progress.shards;
            // 필요 / 보유 조각 (11-05 피드백 10번 — 휴대폰은 보유 줄이 숨어 있어 단추에 같이), 모자라면 빨강
            const need = craft ? craft.shards : owned0 && gc ? gc.shards : null;
            $('lab-grade-cost-v2').innerHTML = !valid ? '' : need != null
                ? `${icon('shard', 12)}<b class="${need > progress.shards ? 'is-poor' : ''}">${need}</b><i>/${progress.shards}</i>` : !owned0 ? '구매 후' : 'MAX';
            gBtn.title = craft ? `파츠 조각 ${craft.shards}개로 만들기 — ${gradeOf(craft.grade).name} (보유 ${progress.shards})`
                : gc ? `파츠 조각 ${gc.shards}개로 ${gradeOf(gc.grade).name} (보유 ${progress.shards})` : '';
        }
        // 강화 한도는 열린 난이도에 따라 Lv5 → 7 → 9 → 10 (D-063)
        const max = progress.maxLevel();
        $('lab-upg-pips-v2').innerHTML = valid ? Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'is-on' : ''}"></i>`).join('') : '';
        const cost = valid ? progress.upgradeCost(part.id) : null;
        const owned = valid && progress.isOwned(part.id);
        const pct = Math.round(LEVEL_BONUS * 100);
        const top = highestDifficulty(progress), next = nextDifficultyOf(top.id);
        $('lab-upg-effect-v2').textContent = !valid ? '강화할 파츠를 골라 주세요'
            : cost == null ? `최대 레벨 · HP·DPS +${pct * (lv - 1)}%${next ? ` — ${top.name} ${FINAL_STAGE_ID}를 깨면 ${next.name} · 한도 Lv${next.maxLevel}` : ''}`
                : !owned ? '구매(개조 확정) 후 강화할 수 있습니다'
                    : `다음 Lv: HP·DPS +${pct}% (지금 +${pct * (lv - 1)}%)`;
        $('lab-upg-cost-v2').textContent = cost == null ? (valid ? 'MAX' : '') : `${cost.toLocaleString()} DM`;
        btn.disabled = !valid || cost == null || !owned || cost > gameState.darkMatter;
    }

    renderPreview() {
        const cart = gameState.getCartObjects();
        const config = rigConfigFor(cart, progress.character);
        const body = cart.body && cart.body.id !== 'none' ? cart.body : null;
        const name = config ? RIG_CHARACTERS[config.character].name : '미완성 기체';
        $('lab-unit-name-v2').textContent = name;
        // 계열 이름 '거대로봇 (메카닉)'이 위 캐릭터 이름과 겹치면 괄호 안만 (11-05 피드백 19번 — 이름 두 번)
        const faction = body ? body.faction : '';
        const same = faction.startsWith(name) && faction.match(/\(([^)]*)\)\s*$/);
        $('lab-faction-v2').textContent = !body ? '흐린 부위는 아직 없는 파츠예요' : same ? same[1] : faction.startsWith(name) ? '' : faction;
        $('lab-preview-tag-v2').textContent = progress.cartChanges() ? 'MODIFIED' : 'CURRENT';
        $('lab-empty-v2').hidden = !!config;
        if (!this.rig) return;
        if (!config) {
            this.rig.stop();
            this.rigOn = false;
            const c = this.rig.canvas;
            const ctx = c.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);   // 리그가 남긴 변환 초기화 후 지움
            ctx.clearRect(0, 0, c.width, c.height);
            return;
        }
        this.rig.setCharacter(config.character);
        if (config.arm) this.rig.setArm(config.arm);
        this.rig.setPartFilters(config.filters);
        this.rig.setVariants(config.variants);
        this.rig.setUpgrades(config.upgrades);
        if (!this.rigOn) {
            this.rig.setMode('idle');
            this.rig.start();
            this.rigOn = true;
        }
    }

    /** 연구소를 떠날 때: 미리보기 멈춤 */
    onLeave() {
        if (this.rig) this.rig.stop();
        this.rigOn = false;
        this.hideSkillPreview();
    }
}
