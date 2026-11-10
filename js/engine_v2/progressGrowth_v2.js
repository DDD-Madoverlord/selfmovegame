/* ==========================================================================
   PROJECT: MAD OVERLORD // 강화 외 성장 — 저장·지급 (v2, Q-006)
   Progress(progress_v2.js)에 메서드로 붙는다 (this = progress). 수치는 growth_v2.js.
   저장 필드 (progress_v2.js save/init):
     grades { 파츠 id: 'rare' … } (없으면 커먼) · options { 파츠 id: ['elite', …] } · shards 파츠 조각 · cores 스킬 코어
     skillLevels { 스킬 id: 2~5 } · modules { owned: [], equipped: [id|null, id|null], levels: { id: 2~3 } }
     research { 연구 id: 레벨 } · spentStars 쓴 별 · unlockedChars [캐릭터 id] · dispatch [{ character, zone, start, end }]
     skins { owned: [외형 id], equipped: { 캐릭터 id: 외형 id } } · charStarRefund 1 = 예전 별 해금 값을 돌려줌 (D-119)
   세트 장비 (Q-008, sets_v2.js): 세트 파츠는 등급 바닥(레어 세트 = 레어, 유니크 세트 = 유니크) 아래로 없음 —
     저장은 그대로 두고 gradeOf에서 바닥을 씌움 (예전에 산 A·B 세트는 불러올 때 레어로 보이고 옵션을 채움).
     드랍은 묶음 가중(기본·강화 / 레어 세트 / 유니크 세트, DROP.poolWeights), 안 가진 세트 파츠는 조각으로 만듦(craftPart).
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { PARTS_DB } from '../data/parts.js';
import { SLOTS, DEFAULT_CHARACTER, characterOfPart, partsOfCharacter } from './roster_v2.js';
import { STAGES, CHAPTERS } from './stages_v2.js';
import { isZoneReleased, isCharacterReleased, releaseLabelOf } from './contentSchedule_v2.js';
import { minGradeOf, dropGroupOf, setOf, setPerkOf } from './sets_v2.js';
import { DIFFICULTIES, highestDifficulty, difficultyOf } from './difficulty_v2.js';
import { emptyPets } from './pets_v2.js';
import {
    GRADES, gradeOf, gradeIndex, OPTIONS, OPTION_CAPS, DROP, AFFINITY, SKILL_LEVEL, CORES,
    MODULES, MODULE_SLOTS, MODULE_MAX_LEVEL, MODULE_LEVEL_COST, DISPATCH, CHARACTER_ZONE, LEGACY_CHARACTER_STARS, RESEARCH, pickWeighted,
    SKINS, SKIN_STARS, skinById, skinCharacterOf
} from './growth_v2.js';

const partById = id => SLOTS.map(s => (PARTS_DB[s] || []).find(p => p.id === id)).find(Boolean) || null;

export function emptyGrowth() {
    return {
        grades: {}, options: {}, shards: 0, cores: 0, skillLevels: {},
        modules: { owned: [], equipped: [], levels: {} }, research: {}, spentStars: 0, unlockedChars: [], dispatch: [], pets: emptyPets(),
        skins: { owned: [], equipped: {} }, charStarRefund: 0
    };
}
export const GROWTH_KEYS = Object.keys(emptyGrowth());

export const GrowthMethods = {
    // ---- 저장 ----
    loadGrowth(data) {
        const g = emptyGrowth();
        for (const k of GROWTH_KEYS) {
            const v = data && data[k];
            if (v == null) continue;
            if (Array.isArray(g[k])) g[k] = Array.isArray(v) ? [...v] : g[k];
            else if (typeof g[k] === 'object') g[k] = typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : g[k];
            else if (Number.isFinite(v)) g[k] = v;
        }
        g.modules = { owned: [], equipped: [], levels: {}, ...g.modules };
        g.skins = { owned: Array.isArray(g.skins.owned) ? g.skins.owned.filter(id => skinById(id)) : [],
            equipped: Object.fromEntries(Object.entries(g.skins.equipped || {}).filter(([c, id]) => skinCharacterOf(id) === c)) };
        Object.assign(this, g);
        // 세트 파츠: 등급 바닥에 맞게 옵션 수를 채움 (예전에 산 A·B 세트 → 레어 옵션 1개)
        for (const id of this.owned || []) this.ensureGradeOptions(id);
        // 예전 저장(성장 필드 전): 돈 주고 산 파츠가 있는 캐릭터는 이미 열린 것으로 한 번 옮겨 둠
        if (data && !('unlockedChars' in data)) {
            for (const id of Object.keys(CHARACTER_ZONE)) {
                if (SLOTS.some(s => partsOfCharacter(id, s).some(p => p.cost && this.owned.has(p.id)))) this.unlockedChars.push(id);
            }
        } else if (data && !this.charStarRefund) {
            // 별로 캐릭터를 사던 때(D-044)의 저장: 그때 쓴 별을 한 번 돌려줌 (D-119 10번 — 이제 구역에 가면 저절로 합류)
            const refund = this.unlockedChars.reduce((n, id) => n + (LEGACY_CHARACTER_STARS[id] || 0), 0);
            this.spentStars = Math.max(0, this.spentStars - refund);
        }
        this.charStarRefund = 1;
        this.syncCharacterUnlocks();
    },
    growthData() {
        return Object.fromEntries(GROWTH_KEYS.map(k => [k, this[k]]));
    },

    // ---- 2-1 파츠 등급·옵션 ----
    /** 파츠 등급 id: 저장된 등급과 세트 등급 바닥 중 높은 것 */
    gradeOf(id) {
        const saved = gradeOf(this.grades[id]).id;
        const floor = minGradeOf(id);
        return gradeIndex(floor) > gradeIndex(saved) ? floor : saved;
    },
    /** 등급만큼 옵션이 있게 채움 (구매·불러오기 — 드랍은 grantPart가 채움) */
    ensureGradeOptions(id, rnd = Math.random) {
        if (!id || id === 'none') return;
        const n = gradeOf(this.gradeOf(id)).options;
        if (this.optionsOf(id).length < n) this.fillOptions(id, n, rnd);
    },
    optionsOf(id) {
        return this.options[id] || [];
    },
    /** 옵션을 count개가 될 때까지 겹치지 않게 더함 */
    fillOptions(id, count, rnd = Math.random) {
        const have = [...this.optionsOf(id)];
        const pool = Object.keys(OPTIONS).filter(o => !have.includes(o));
        while (have.length < count && pool.length) have.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
        if (have.length) this.options[id] = have;
    },
    /**
     * 파츠 하나 받기 (드랍·파견). 없으면 그 등급으로 얻음, 낮은 등급이면 올림, 같거나 높으면 DM·조각 환급
     * @returns {{ type: 'new'|'upgrade'|'refund', id, name, grade, prev?, options, dm?, shards? }}
     */
    grantPart(id, grade, rnd = Math.random) {
        const part = partById(id);
        const floor = minGradeOf(id);
        const g = gradeOf(gradeIndex(floor) > gradeIndex(grade) ? floor : grade);   // 세트 등급 바닥
        const base = { id, name: part ? part.name : id, grade: g.id };
        if (!this.owned.has(id)) {
            this.owned.add(id);
            if (g.id !== 'common') this.grades[id] = g.id;
            this.fillOptions(id, g.options, rnd);
            gameState.notify();
            return { ...base, type: 'new', options: this.optionsOf(id) };
        }
        const prev = this.gradeOf(id);
        if (gradeIndex(g.id) > gradeIndex(prev)) {
            this.grades[id] = g.id;
            this.fillOptions(id, g.options, rnd);
            gameState.notify();
            return { ...base, type: 'upgrade', prev, options: this.optionsOf(id) };
        }
        const r = DROP.refund[g.id];
        const shards = Math.round(r.shards * (1 + this.researchBonus('shardBoost')));
        gameState.darkMatter += r.dm;
        this.shards += shards;
        gameState.notify();
        return { ...base, type: 'refund', options: this.optionsOf(id), dm: r.dm, shards };
    },
    /** 조각으로 등급 한 칸 올리기 비용 (가진 파츠만, 레전더리면 null) */
    shardUpgradeCost(id) {
        if (!this.owned.has(id) || id === 'none') return null;
        const next = GRADES[gradeIndex(this.gradeOf(id)) + 1];
        return next ? { grade: next.id, shards: DROP.shardCost[next.id] } : null;
    },
    upgradeGradeWithShards(id) {
        const c = this.shardUpgradeCost(id);
        if (!c) return { success: false, reason: '더 올릴 수 없는 파츠입니다' };
        if (this.shards < c.shards) return { success: false, reason: '파츠 조각이 부족합니다' };
        this.shards -= c.shards;
        this.grades[id] = c.grade;
        this.fillOptions(id, gradeOf(c.grade).options);
        gameState.notify();
        return { success: true, grade: c.grade, options: this.optionsOf(id) };
    },
    /** 장착 파츠 옵션 합계 (전투 battle/growth.js) */
    gearTotals(partsObj) {
        const t = {};
        for (const slot of SLOTS) {
            const p = partsObj && partsObj[slot];
            if (!p || p.id === 'none') continue;
            for (const o of this.optionsOf(p.id)) {
                const def = OPTIONS[o];
                if (def) t[def.key] = (t[def.key] || 0) + def.value;
            }
        }
        for (const [k, cap] of Object.entries(OPTION_CAPS)) if (t[k] > cap) t[k] = cap;
        return t;
    },

    // ---- 드랍 (전투 결과) ----
    /** 그 구역 상성 캐릭터인지 */
    isAffinity(character, zone) {
        return (AFFINITY[zone] || []).includes(character);
    },
    /**
     * 클리어 드랍: 확률(25% + 상성 + 연구) → 공용 파츠 조각(등급은 난이도 표, 양은 DROP.shardDrop — 11-05 피드백 23번),
     * 보스전 첫 클리어는 확정으로 출전 캐릭터 파츠 하나(예전 그대로)
     * @returns { type: 'shards', grade, shards } · 받은 파츠 결과(grantPart) · null
     */
    rollBattleDrop({ character, zone, difficulty, boss, firstClear }, rnd = Math.random) {
        const chance = DROP.chance + (this.isAffinity(character, zone) ? DROP.affinityBonus : 0) + this.researchBonus('dropRate');
        const sure = DROP.bossFirstClear && boss && firstClear;
        if (!sure && rnd() >= chance) return null;
        const diff = difficultyOf(difficulty).id;
        if (!sure) {
            const grade = pickWeighted(DROP.grades[diff] || DROP.grades.normal, rnd);
            const shards = Math.round(DROP.shardDrop[grade] * (1 + this.researchBonus('shardBoost')));
            this.shards += shards;
            return { type: 'shards', grade, shards, sure: false };
        }
        const part = this.pickDropPart(character, diff, { prefer: DROP.firstClearGroups[diff] }, rnd);
        if (!part) return null;
        const grade = pickWeighted(DROP.grades[diff] || DROP.grades.normal, rnd);
        return { ...this.grantPart(part.id, grade, rnd), sure };
    },
    /** 캐릭터 파츠를 묶음(기본·강화 / 레어 세트 / 유니크 세트 / 레전더리 세트)으로 나눔 */
    dropGroups(character) {
        const groups = { base: [], rare: [], unique: [], legendary: [] };
        for (const p of SLOTS.flatMap(s => partsOfCharacter(character, s))) {
            if (p.id !== 'none') groups[dropGroupOf(p)].push(p);
        }
        return groups;
    },
    /**
     * 드랍할 파츠 하나: 난이도의 묶음 가중(DROP.poolWeights)에서 묶음을 뽑고 그 안에서 같은 확률.
     * prefer = 묶음 순서(보스 첫 클리어 — 앞 묶음이 비면 다음), exclude = 뺄 묶음(파견은 유니크 제외)
     */
    pickDropPart(character, diff, { prefer = null, exclude = [] } = {}, rnd = Math.random) {
        const groups = this.dropGroups(character);
        const usable = k => groups[k] && groups[k].length && !exclude.includes(k);
        let key = prefer ? prefer.find(usable) : null;
        if (!key) {
            const w = Object.fromEntries(Object.entries(DROP.poolWeights[diff] || DROP.poolWeights.normal).filter(([k, v]) => v > 0 && usable(k)));
            key = Object.keys(w).length ? pickWeighted(w, rnd) : ['base', 'rare', 'unique', 'legendary'].find(usable);
        }
        if (!key) return null;
        const list = groups[key];
        return list[Math.floor(rnd() * list.length)];
    },
    /** 조각으로 만들기 비용 (안 가진 세트 파츠만, 아니면 null) */
    craftCost(id) {
        if (!id || id === 'none' || this.owned.has(id)) return null;
        const s = setOf(id);
        return s ? { shards: DROP.craftCost[s.tier], grade: minGradeOf(id) } : null;
    },
    /** 조각으로 세트 파츠 만들기 → 등급 바닥으로 얻음 */
    craftPart(id, rnd = Math.random) {
        const c = this.craftCost(id);
        if (!c) return { success: false, reason: '만들 수 없는 파츠입니다' };
        const lock = this.tierLock(partById(id));   // 등급 단계 (progress_v2.js tierLock, 11-03)
        if (lock) return { success: false, reason: this.tierLockText(lock) };
        if (this.shards < c.shards) return { success: false, reason: `파츠 조각이 부족합니다 (${c.shards}개 필요)` };
        this.shards -= c.shards;
        const got = this.grantPart(id, c.grade, rnd);
        return { success: true, shards: c.shards, ...got };
    },
    addCores(n) {
        const got = Math.round(n * (1 + this.researchBonus('coreBoost')));
        this.cores += got;
        return got;
    },

    // ---- 2-2 스킬 강화 ----
    skillLevel(skillId) {
        return this.skillLevels[skillId] || 1;
    },
    skillUpgradeCost(skillId) {
        const lv = this.skillLevel(skillId);
        return lv >= SKILL_LEVEL.max ? null : SKILL_LEVEL.cost[lv];
    },
    upgradeSkill(skillId) {
        const c = this.skillUpgradeCost(skillId);
        if (!c) return { success: false, reason: '이미 최대 레벨입니다' };
        if (this.cores < c.cores) return { success: false, reason: '스킬 코어가 부족합니다' };
        if (gameState.darkMatter < c.dm) return { success: false, reason: '다크 매터(DM)가 부족합니다' };
        this.cores -= c.cores;
        gameState.darkMatter -= c.dm;
        this.skillLevels[skillId] = this.skillLevel(skillId) + 1;
        gameState.notify();
        return { success: true, level: this.skillLevels[skillId] };
    },

    // ---- 별 ----
    totalStars() {
        let n = 0;
        for (const d of DIFFICULTIES) for (const s of STAGES) n += this.starCount(s.id, d.id);
        return n;
    },
    availableStars() {
        return Math.max(0, this.totalStars() - this.spentStars);
    },
    spendStars(n) {
        if (this.availableStars() < n) return false;
        this.spentStars += n;
        return true;
    },

    // ---- 2-7 캐릭터 합류 (D-119 10번 — 별 해금을 바꿈) ----
    /** 그 캐릭터의 구역 (거대로봇 = null) */
    characterZone(id) {
        return CHARACTER_ZONE[id] || null;
    },
    /** 구역 n의 첫 판 n-1이 노말에서 열렸는지 (= n-1 구역 보스전 노말을 깸, 구역 공개 포함 — 고른 난이도와 상관없이) */
    characterReached(id) {
        const z = CHARACTER_ZONE[id];
        if (!z) return false;
        const first = STAGES.findIndex(s => s.id === `${z}-1`);
        return first > 0 && isZoneReleased(z) && this.stage(STAGES[first - 1].id, 'normal').cleared;
    },
    /** 기본 캐릭터 · 구역에 도착한 캐릭터 · 예전에 연 캐릭터는 열림 (공개 전 캐릭터는 아님 — 선택창 select_v2.js) */
    isCharacterUnlocked(id) {
        return isCharacterReleased(id) && (id === DEFAULT_CHARACTER || this.unlockedChars.includes(id) || !(id in CHARACTER_ZONE) || this.characterReached(id));
    },
    /** 구역에 도착했는데 아직 기록에 없는 캐릭터를 합류시키고 그 목록을 돌려줌 (판 기록 뒤·불러올 때) */
    syncCharacterUnlocks() {
        const joined = Object.keys(CHARACTER_ZONE).filter(id => !this.unlockedChars.includes(id) && isCharacterReleased(id) && this.characterReached(id));
        this.unlockedChars.push(...joined);
        return joined;
    },
    /** 잠긴 캐릭터 안내 (별로 사는 길은 없음 — 예전 호출 자리 호환) */
    unlockCharacter(id) {
        if (!isCharacterReleased(id)) return { success: false, reason: releaseLabelOf('characters', id) };
        if (this.isCharacterUnlocked(id)) return { success: true };
        const z = CHARACTER_ZONE[id];
        return { success: false, reason: `구역 ${z}에 도착하면 합류합니다 (${z - 1}-B 노말 클리어)` };
    },

    // ---- 캐릭터 외형 (D-119 11번) ----
    ownsSkin(id) {
        return this.skins.owned.includes(id);
    },
    buySkin(id) {
        const skin = skinById(id);
        if (!skin) return { success: false, reason: '없는 외형입니다' };
        if (this.ownsSkin(id)) return { success: false, reason: '이미 가진 외형입니다' };
        if (!this.spendStars(SKIN_STARS)) return { success: false, reason: `별이 부족합니다 (★${SKIN_STARS} 필요)` };
        this.skins.owned.push(id);
        this.skins.equipped[skinCharacterOf(id)] = id;
        gameState.notify();
        return { success: true };
    },
    /** 외형 입기 (id = null이면 기본 외형) */
    equipSkin(character, id) {
        if (id && (!this.ownsSkin(id) || skinCharacterOf(id) !== character)) return false;
        if (id) this.skins.equipped[character] = id;
        else delete this.skins.equipped[character];
        gameState.notify();
        return true;
    },
    /** 캐릭터가 입은 외형의 색 필터 (리그 그림 전체 — rigAvatar.js setSkinResolver) */
    skinFilterOf(character) {
        const id = this.skins && this.skins.equipped[character];
        return (id && skinById(id)?.filter) || null;
    },

    // ---- 2-3 전술 모듈 ----
    moduleSlots() {
        return MODULE_SLOTS[highestDifficulty(this).id] || 1;
    },
    ownsModule(id) {
        return this.modules.owned.includes(id);
    },
    buyModule(id) {
        const m = MODULES[id];
        if (!m) return { success: false, reason: '없는 모듈입니다' };
        if (this.ownsModule(id)) return { success: false, reason: '이미 가진 모듈입니다' };
        if (!this.spendStars(m.stars)) return { success: false, reason: `별이 부족합니다 (★${m.stars} 필요)` };
        this.modules.owned.push(id);
        const free = Array.from({ length: this.moduleSlots() }, (_, i) => i).find(i => !this.modules.equipped[i]);
        if (free != null) this.modules.equipped[free] = id;
        gameState.notify();
        return { success: true };
    },
    /** 칸에 끼우기 (같은 모듈이 다른 칸에 있으면 빼고), id = null이면 비움 */
    equipModule(slot, id) {
        if (slot < 0 || slot >= this.moduleSlots()) return false;
        if (id && !this.ownsModule(id)) return false;
        const eq = this.modules.equipped;
        if (id) eq.forEach((m, i) => { if (m === id) eq[i] = null; });
        eq[slot] = id || null;
        gameState.notify();
        return true;
    },
    /** 출격 때 쓰는 모듈 (칸 수까지, 가진 것만) */
    equippedModules() {
        return Array.from({ length: this.moduleSlots() }, (_, i) => this.modules.equipped[i]).filter(id => id && this.ownsModule(id));
    },
    moduleLevel(id) {
        return this.modules.levels[id] || 1;
    },
    moduleUpgradeCost(id) {
        const lv = this.moduleLevel(id);
        return !this.ownsModule(id) || lv >= MODULE_MAX_LEVEL ? null : MODULE_LEVEL_COST[lv];
    },
    upgradeModule(id) {
        const cost = this.moduleUpgradeCost(id);
        if (cost == null) return { success: false, reason: '강화할 수 없습니다' };
        if (gameState.darkMatter < cost) return { success: false, reason: '다크 매터(DM)가 부족합니다' };
        gameState.darkMatter -= cost;
        this.modules.levels[id] = this.moduleLevel(id) + 1;
        gameState.notify();
        return { success: true, level: this.modules.levels[id] };
    },

    // ---- 2-7 계정 연구 (별) ----
    researchLevel(id) {
        return this.research[id] || 0;
    },
    researchBonus(id) {
        const r = RESEARCH[id];
        return r ? this.researchLevel(id) * r.per : 0;
    },
    researchCost(id) {
        const r = RESEARCH[id];
        const lv = this.researchLevel(id);
        return r && lv < r.max ? r.stars[lv] : null;
    },
    buyResearch(id) {
        const cost = this.researchCost(id);
        if (cost == null) return { success: false, reason: '최대 단계입니다' };
        if (!this.spendStars(cost)) return { success: false, reason: `별이 부족합니다 (★${cost} 필요)` };
        this.research[id] = this.researchLevel(id) + 1;
        gameState.notify();
        return { success: true, level: this.research[id] };
    },

    // ---- 2-6 파견 ----
    dispatchSlots() {
        return (DISPATCH.slots[highestDifficulty(this).id] || 1) + this.researchBonus('dispatchSlot');
    },
    dispatchMs() {
        return Math.round(DISPATCH.hours * 3600 * 1000 * (1 - this.researchBonus('dispatchTime')));
    },
    /** 파견할 수 있는 구역: 노말에서 보스전까지 깬 구역 */
    dispatchZones() {
        return CHAPTERS.filter(ch => isZoneReleased(ch.zone) && this.stage(ch.stages[ch.stages.length - 1].id, 'normal').cleared).map(ch => ch.zone);
    },
    isDispatched(character) {
        return this.dispatch.some(d => d.character === character);
    },
    /** 파견 후보와 실행이 함께 쓰는 조건: 해금·4부위 보유, 주인공·파견 중 제외 */
    dispatchReason(character) {
        if (character === this.character) return '출전 중인 캐릭터는 보낼 수 없습니다';
        if (!this.isCharacterUnlocked(character)) return '잠긴 캐릭터입니다';
        if (this.isDispatched(character)) return '이미 파견 중입니다';
        if (!SLOTS.every(slot => partsOfCharacter(character, slot).some(p => this.isOwned(p.id)))) {
            return '파츠 4부위를 보유한 캐릭터만 파견할 수 있습니다';
        }
        return '';
    },
    /** 파견 보내기: 보유 캐릭터, 지금 고른 캐릭터가 아님, 이미 파견 중이 아님, 깬 구역, 빈 칸 */
    startDispatch(character, zone, now = Date.now()) {
        if (!isZoneReleased(zone)) return { success: false, reason: `구역 ${zone} · ${releaseLabelOf('zones', zone)}` };
        if (this.dispatch.length >= this.dispatchSlots()) return { success: false, reason: '파견 칸이 모두 찼습니다' };
        const reason = this.dispatchReason(character);
        if (reason) return { success: false, reason };
        if (!this.dispatchZones().includes(zone)) return { success: false, reason: '아직 깨지 않은 구역입니다' };
        this.dispatch.push({ character, zone, start: now, end: now + this.dispatchMs() });
        // 협력으로 골라 둔 캐릭터를 파견 보내면 협력 선택을 비움 — 파견 중에는 협력 편성 불가 (11-03, 홍도도 QA6)
        const supportCleared = this.supportCharacter === character;
        if (supportCleared) { this.supportCharacter = null; this.supportRandom = false; }
        gameState.notify();
        return { success: true, supportCleared };
    },
    /** 다 끝난 파견 받기: DM·조각·코어 + 30% 확률로 그 캐릭터 파츠(레어 이하) */
    collectDispatch(index, now = Date.now(), rnd = Math.random) {
        const d = this.dispatch[index];
        if (!d) return { success: false, reason: '없는 파견입니다' };
        if (now < d.end) return { success: false, reason: '아직 진행 중입니다' };
        // 파견 보낸 캐릭터가 끼운 세트의 전투 밖 효과: 보상 ×(1 + dispatchLoot) (sets_v2.js SET_PERKS, 11-03)
        const loot = setPerkOf(Object.fromEntries(Object.entries(this.loadoutFor(d.character)).map(([slot, id]) => [slot, partById(id)])), 'dispatchLoot');
        const base = DISPATCH.reward(d.zone);
        const r = loot ? { dm: Math.round(base.dm * (1 + loot)), shards: Math.round(base.shards * (1 + loot)), cores: Math.round(base.cores * (1 + loot)),
            partChance: base.partChance * (1 + loot) } : base;
        this.dispatch.splice(index, 1);
        gameState.darkMatter += r.dm;
        this.shards += r.shards;
        const cores = this.addCores(r.cores);
        let part = null;
        if (rnd() < r.partChance) {
            // 파츠는 레어 이하: 유니크 세트는 빼고, 노말만 깼으면 기본·강화만 (묶음 가중은 열린 가장 높은 난이도)
            const top = highestDifficulty(this).id;
            const pick = this.pickDropPart(d.character, top, { exclude: ['unique', 'legendary'] }, rnd);
            if (pick) part = this.grantPart(pick.id, top === 'normal' ? 'common' : 'rare', rnd);
        }
        gameState.notify();
        return { success: true, dm: r.dm, shards: r.shards, cores, part, character: d.character, zone: d.zone, loot };
    }
};

/** 전투 결과 화면·연구소에서 쓰는 등급 표시 정보 */
export function gradeInfo(id) {
    return gradeOf(id);
}
export { CORES };
