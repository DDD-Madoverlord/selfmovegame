/* ==========================================================================
   PROJECT: MAD OVERLORD // 진행 저장 · 파츠 소유 · 파츠 강화 · 스테이지 기록 (v2)
   구버전과 같이 쓰는 gameState(js/engine/state.js)는 고치지 않는다.
   v2가 시작할 때 저장된 값을 gameState에 채워 넣고, gameState 변경을 구독해 다시 저장한다.

   저장 (localStorage 'mo_v2_save'):
     dm        다크 매터
     equipped  장착 파츠 { head, body, arm, leg }
     owned     보유 파츠 id 목록 (가격 0인 파츠와 [파츠제거]는 처음부터 보유)
     levels    파츠 강화 레벨 { id: 1~5 }  (결정 D-015)
     stages    스테이지 기록 { '1-1': { stars: [요새, 기지, 체력50%], cleared, bestTime, losses? } }  (D-016) — 노말, losses = 못 깬 판의 연패 수(연패 보정)
     diffStages 하드·헬·나이트메어 기록 { hard: { '1-1': { … } }, … }  (D-063, 난이도마다 따로)
     difficulty 메인 화면에서 고른 난이도 id (difficulty_v2.js)
     강화 외 성장 (Q-006, progressGrowth_v2.js): grades · options · shards · cores · skillLevels · modules · research ·
       spentStars · unlockedChars · dispatch — 없으면 빈 값이라 예전 저장 그대로 읽힘
     character 선택창에서 고른 캐릭터 id (D-051)
     loadouts  캐릭터별 마지막 장착 { mech: { head, body, arm, leg }, ... } — 다시 고르면 그대로
   v1 저장(캐릭터 없음, 다른 캐릭터 파츠를 섞어 낌)은 처음 읽을 때 몸통 캐릭터로 바꾼다 (fixMixed)
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { PARTS_DB } from '../data/parts.js';
import { ROSTER, SLOTS, DEFAULT_CHARACTER, rosterOf, characterOfPart, partsOfCharacter } from './roster_v2.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, difficultyOf, difficultyUnlocked, highestDifficulty, assistOf } from './difficulty_v2.js';
import { GrowthMethods, emptyGrowth } from './progressGrowth_v2.js';
import { CommerceMethods, emptyCommerce } from './progressCommerce_v2.js';
import { PetMethods } from './progressPets_v2.js';
import { OfflineMethods, emptyOffline } from './offlineReward_v2.js';
import { TutorialMethods, emptyTutorial } from './tutorial_v2.js';
import { track } from './analytics_v2.js';
import { gradeOf, TIER_UNLOCK } from './growth_v2.js';
import { isDropOnly, dropGroupOf } from './sets_v2.js';
import { allStagesUnlocked, isUnlockedNormally, GROUP_FIRST } from './stages_v2.js';
import { revealAllTemp } from './contentSchedule_v2.js';
import * as saveStore from './saveStore_v2.js';
import { settings } from './settings_v2.js';
import { SupportProgressMethods } from './support_v2.js';

const KEY = 'mo_v2_save';
export const MAX_LEVEL = 5;           // 노말 강화 한도 — 높은 난이도를 열면 올라감 (progress.maxLevel(), D-063)
export const LEVEL_BONUS = 0.12;      // 강화 1레벨마다 그 파츠의 HP·DPS +12%
export const STAR_BONUS_DM = 300;     // 새로 얻은 별 하나마다 보너스

function partOf(slot, id) {
    return (PARTS_DB[slot] || []).find(p => p.id === id) || null;
}

function slotOf(id) {
    return SLOTS.find(s => partOf(s, id));
}

class Progress {
    constructor() {
        this.owned = new Set();
        this.levels = {};
        this.stages = {};
        this.diffStages = {};        // 하드 이상 난이도별 기록 (저장)
        this.difficulty = DEFAULT_DIFFICULTY;   // 메인 화면에서 고른 난이도 (저장)
        this.selectedStage = null;   // 메인 화면에서 고른 스테이지 (저장)
        this.character = DEFAULT_CHARACTER;   // 선택창에서 고른 캐릭터 (저장)
        this.loadouts = {};                   // 캐릭터별 마지막 장착 (저장)
        this.tips = new Set();                // 본 첫 출격 안내 id (저장, coach_v2.js)
        this.supportCharacter = null;
        this.supportAuto = false;
        this.supportRandom = false;
        this.supportHelpSeen = false;
        Object.assign(this, emptyGrowth());   // 파츠 등급·조각·코어·스킬 레벨·모듈·연구·별 사용·파견 (저장)
        this.commerce = emptyCommerce();
        this.offline = emptyOffline();
        this.tutorial = emptyTutorial();
        this.loaded = false;
        this.saveTimer = null;
        this.saveId = null;
    }

    // ---- 시작 / 저장 ----
    /** v2 시작 시 한 번: 저장값을 gameState에 적용하고 변경을 구독 */
    init() {
        if (this.loaded) return;
        this.loaded = true;
        // 가격 0인 파츠는 처음부터 보유 (드랍 전용 — 유니크 세트 — 은 빼고)
        SLOTS.forEach(slot => (PARTS_DB[slot] || []).forEach(p => { if (!p.cost && !isDropOnly(p)) this.owned.add(p.id); }));
        let data = null;
        try { data = JSON.parse(saveStore.load(KEY) || 'null'); } catch (e) { data = null; }
        if (data) {
            if (typeof data.saveId === 'string' && data.saveId) this.saveId = data.saveId;
            if (Number.isFinite(data.dm)) gameState.darkMatter = data.dm;
            if (data.equipped) {
                SLOTS.forEach(slot => {
                    if (partOf(slot, data.equipped[slot])) gameState.equippedParts[slot] = data.equipped[slot];
                });
            }
            (data.owned || []).forEach(id => this.owned.add(id));
            this.levels = { ...(data.levels || {}) };
            this.stages = { ...(data.stages || {}) };
            DIFFICULTIES.forEach(d => {
                if (d.id !== DEFAULT_DIFFICULTY && data.diffStages && data.diffStages[d.id]) this.diffStages[d.id] = { ...data.diffStages[d.id] };
            });
            this.selectedStage = data.selectedStage || null;
            if (data.difficulty && difficultyUnlocked(data.difficulty, this)) this.difficulty = difficultyOf(data.difficulty).id;
            this.loadouts = { ...(data.loadouts || {}) };
            (data.tips || []).forEach(t => this.tips.add(t));
            this.supportCharacter = rosterOf(data.supportCharacter) ? data.supportCharacter : null;
            this.supportAuto = data.supportAuto === true;
            this.supportRandom = data.supportRandom === true;
            this.supportHelpSeen = data.supportHelpSeen === true;
            this.loadGrowth(data);
        }
        this.loadTutorial(data);
        this.loadCommerce(data);
        this.loadPets(data);
        this.loadOffline(data);   // 펫 지급 등의 즉시 저장보다 먼저, 원래 savedAt으로 정산
        SLOTS.forEach(slot => this.owned.add(gameState.equippedParts[slot]));   // 장착 중인 파츠는 보유
        // 고른 캐릭터: 저장에 있으면 그것, v1 저장이면 몸통 캐릭터
        const saved = data && rosterOf(data.character) ? data.character : null;
        this.character = saved || characterOfPart(partOf('body', gameState.equippedParts.body)) || DEFAULT_CHARACTER;
        this.clearSupportIfMain();
        this.fixMixed(!saved);
        this.rememberLoadout();
        gameState.cartParts = { ...gameState.equippedParts };
        this.checkPetRewards('migration');
        this.resolvePendingCommercePets();
        gameState.subscribe(() => this.saveSoon());
        this.save();
    }

    /** 첫 출격 안내 (coach_v2.js): 본 적 있는가 / 봤다고 저장 */
    hasTip(id) {
        return this.tips.has(id);
    }

    markTip(id) {
        this.tips.add(id);
        this.saveSoon();
    }

    saveSoon() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), 250);
    }

    save() {
        clearTimeout(this.saveTimer);
        if (!this.saveId) this.saveId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        // 장착이 바깥(검사 도구 등)에서 바뀌었으면 몸통 캐릭터를 따라감
        const bodyChar = characterOfPart(partOf('body', gameState.equippedParts.body));
        if (bodyChar) this.character = bodyChar;
        this.rememberLoadout();
        const data = {
            v: 3,   // 3: 강화 외 성장 필드 추가 (Q-006)
            savedAt: Date.now(),
            saveId: this.saveId,
            dm: gameState.darkMatter,
            equipped: { ...gameState.equippedParts },
            owned: [...this.owned],
            levels: this.levels,
            stages: this.stages,
            diffStages: this.diffStages,
            difficulty: this.difficulty,
            selectedStage: this.selectedStage,
            character: this.character,
            loadouts: this.loadouts,
            tips: [...this.tips],
            commerce: this.commerce,
            offline: this.offline,
            tutorial: this.tutorial,
            supportCharacter: this.supportCharacter,
            supportAuto: this.supportAuto,
            supportRandom: this.supportRandom,
            supportHelpSeen: this.supportHelpSeen,
            ...this.growthData()
        };
        const text = JSON.stringify(data);
        saveStore.save(KEY, text);
        this._offlineSavedText = text;
    }

    /** 가져오기·다른 탭이 바꾼 저장을 생명주기 저장으로 덮어쓰지 않는다. */
    offlineStorageCurrent() {
        return this._offlineSavedText === undefined || saveStore.load(KEY) === this._offlineSavedText;
    }

    /** 처음부터 다시 (설정 창의 진행 초기화) */
    resetAll() {
        clearTimeout(this.saveTimer);
        saveStore.remove(KEY);
        location.reload();
    }

    // ---- 캐릭터 선택 (D-051) ----
    /**
     * 장착 중인 다른 캐릭터 파츠를 고른 캐릭터 파츠로 바꿈 (v1 저장 변환).
     * 그 부위에 가진 파츠가 있으면 그것, 없으면 가장 싼 파츠 — grant면 그 파츠를 줌 (예전에 끼우던 부위를 비우지 않게)
     */
    fixMixed(grant) {
        for (const slot of SLOTS) {
            const id = gameState.equippedParts[slot];
            if (id === 'none' || characterOfPart(partOf(slot, id)) === this.character) continue;
            const list = partsOfCharacter(this.character, slot);
            const pick = list.find(p => this.owned.has(p.id))
                || (grant ? list.filter(p => !p.dropOnly && p.cost != null).sort((a, b) => a.cost - b.cost)[0] : null);   // 드랍 전용(값 없음) 세트 파츠는 빼고
            if (pick) this.owned.add(pick.id);
            gameState.equippedParts[slot] = pick ? pick.id : 'none';
        }
    }

    /** 지금 장착을 고른 캐릭터의 장착으로 기억 (다른 캐릭터 파츠가 섞여 있으면 기억하지 않음) */
    rememberLoadout() {
        const eq = gameState.equippedParts;
        const mine = SLOTS.every(s => eq[s] === 'none' || characterOfPart(partOf(s, eq[s])) === this.character);
        if (mine) this.loadouts[this.character] = { ...eq };
    }

    /**
     * 캐릭터의 장착 파츠 id {head, body, arm, leg}: 기억해 둔 장착 → 없으면 부위마다 가진 파츠 중 첫 번째.
     * 그 부위 파츠를 하나도 안 가졌으면 'none' (연구소에서 구매)
     */
    loadoutFor(character) {
        if (character === this.character) return { ...gameState.equippedParts };
        const saved = this.loadouts[character] || {};
        const out = {};
        for (const slot of SLOTS) {
            const id = saved[slot];
            const keep = id && this.owned.has(id) && characterOfPart(partOf(slot, id)) === character;
            out[slot] = keep ? id : (partsOfCharacter(character, slot).find(p => this.owned.has(p.id)) || { id: 'none' }).id;
        }
        return out;
    }

    /** 캐릭터 바꾸기: 지금 장착을 기억하고 그 캐릭터의 장착으로 */
    selectCharacter(id) {
        if (!rosterOf(id)) return false;
        if (id === this.character) {
            if (this.clearSupportIfMain()) gameState.notify();
            return true;
        }
        this.rememberLoadout();
        const next = this.loadoutFor(id);
        this.character = id;
        gameState.equippedParts = next;
        gameState.cartParts = { ...next };
        this.clearSupportIfMain();
        gameState.notify();
        return true;
    }

    /** 캐릭터 파츠 보유 수 { owned, total } */
    ownedCountOf(character) {
        const all = SLOTS.flatMap(s => partsOfCharacter(character, s));
        return { owned: all.filter(p => this.owned.has(p.id)).length, total: all.length };
    }

    /** 출격 가능: 몸통 파츠를 끼웠을 때 */
    isReady() {
        return gameState.equippedParts.body !== 'none';
    }

    // ---- 파츠 소유 ----
    isOwned(id) {
        return this.owned.has(id);
    }

    /** 시험용 전체 해제 2단계 (메뉴 왼쪽 위 아이콘 5번 → 다시 5번, menu_v2.js): 저장을 메모리 사본으로 돌린 뒤
     *  캐릭터 전부·파츠 전부를 가짐. 이 뒤의 진행은 실제 저장에 안 남고, 게임을 다시 켜면 원래 저장 */
    unlockEverythingTemp() {
        if (this.everythingUnlocked) return false;
        saveStore.isolateSaveInMemory();
        this.everythingUnlocked = true;
        revealAllTemp();   // 숨김 그룹(구역 7~10·캐릭터 4명)도 이번 실행 동안만 공개 (D-119)
        ROSTER.forEach(c => { if (!this.unlockedChars.includes(c.id)) this.unlockedChars.push(c.id); });
        SLOTS.forEach(slot => (PARTS_DB[slot] || []).forEach(p => { if (p.id !== 'none') this.owned.add(p.id); }));
        this.save();
        gameState.notify();
        return true;
    }

    /** 장바구니 중 보유하지 않은 파츠의 구매 비용 */
    cartCost() {
        return SLOTS.reduce((sum, slot) => {
            const id = gameState.cartParts[slot];
            const p = partOf(slot, id);
            return sum + (p && !this.owned.has(id) ? p.cost || 0 : 0);
        }, 0);
    }

    cartChanges() {
        return SLOTS.filter(s => gameState.cartParts[s] !== gameState.equippedParts[s]).length;
    }

    /** 장바구니에서 살 수 없는 파츠 (안 가진 드랍 전용 — 유니크 세트) */
    cartLocked() {
        return SLOTS.map(slot => partOf(slot, gameState.cartParts[slot]))
            .filter(p => p && p.id !== 'none' && !this.owned.has(p.id) && isDropOnly(p));
    }

    /** 등급 단계 잠김 (growth_v2.js TIER_UNLOCK): 안 가진 파츠가 아직 못 여는 등급이면 { tier, from, need, have }, 열렸으면 null.
     *  그 등급 파츠가 need개보다 적은 캐릭터는 그 등급을 전부 가지면 열림 */
    tierLock(part) {
        if (!part || part.id === 'none' || this.owned.has(part.id)) return null;
        const tierOf = p => (dropGroupOf(p) === 'base' ? 'common' : dropGroupOf(p));
        const tier = tierOf(part), rule = TIER_UNLOCK[tier];
        if (!rule) return null;
        const pool = SLOTS.flatMap(slot => partsOfCharacter(characterOfPart(part), slot)).filter(p => tierOf(p) === rule.from);
        const need = Math.min(rule.need, pool.length);
        const have = pool.filter(p => this.owned.has(p.id)).length;
        return have >= need ? null : { tier, from: rule.from, need, have };
    }

    tierLockText(lock) {
        return `${gradeOf(lock.tier).name} 파츠는 이 캐릭터의 ${gradeOf(lock.from).name} 파츠를 ${lock.need}개 가지면 열립니다 (지금 ${lock.have}개)`;
    }

    /** 장바구니 확정: 보유하지 않은 파츠는 구매 후 장착 (세트 파츠는 등급 바닥만큼 옵션을 채움) */
    confirmCart() {
        const locked = this.cartLocked();
        if (locked.length) return { success: false, reason: `${locked[0].name}: 드랍·조각으로만 얻는 파츠입니다` };
        const tierLocked = SLOTS.map(slot => partOf(slot, gameState.cartParts[slot])).find(p => this.tierLock(p));
        if (tierLocked) return { success: false, reason: `${tierLocked.name}: ${this.tierLockText(this.tierLock(tierLocked))}` };
        const cost = this.cartCost();
        if (gameState.darkMatter < cost) return { success: false, reason: '다크 매터(DM)가 부족합니다' };
        const partIds = SLOTS.map(slot => gameState.cartParts[slot]).filter(id => id !== 'none' && !this.owned.has(id));
        SLOTS.forEach(slot => {
            const id = gameState.cartParts[slot];
            if (!this.owned.has(id)) {
                this.owned.add(id);
                this.ensureGradeOptions(id);
            }
        });
        gameState.darkMatter -= cost;
        gameState.equippedParts = { ...gameState.cartParts };
        this.rememberLoadout();
        gameState.notify();
        if (partIds.length) track('part_purchase', { partIds, cost });
        if (partIds.length) this.tutorialGrowth(partIds[0]);
        return { success: true, cost };
    }

    // ---- 파츠 강화 ----
    levelOf(id) {
        return this.levels[id] || 1;
    }

    /** 강화 한도: 열린 난이도 중 가장 높은 난이도의 한도 (노말 Lv5 → 하드 Lv7 → 헬 Lv9 → 나이트메어 Lv10)
     *  + 숨김 그룹 첫 판(7-1 · 9-1)이 노말에서 열릴 때마다 +2 (D-119 8번, Q-043 임시 — 그룹 노말이 이미 헬 수준) */
    maxLevel() {
        const groups = [2, 3].filter(g => this.groupReached(g)).length;
        return highestDifficulty(this).maxLevel + 2 * groups;
    }

    /** 숨김 그룹 첫 판이 노말에서 열렸는지 (고른 난이도와 상관없이) */
    groupReached(group) {
        const diff = this.difficulty;
        this.difficulty = DEFAULT_DIFFICULTY;
        try { return isUnlockedNormally(GROUP_FIRST[group], this); } finally { this.difficulty = diff; }
    }

    /** 장착한 파츠 중 지금 DM으로 강화할 수 있는 것이 있는지 (연구소 강화 안내 — main_v2.js) */
    canUpgradeEquipped() {
        return SLOTS.some(slot => { const c = this.upgradeCost(gameState.equippedParts[slot]); return c != null && c <= gameState.darkMatter; });
    }

    /** 다음 레벨 강화 비용 (최대면 null) */
    upgradeCost(id) {
        const lv = this.levelOf(id);
        if (lv >= this.maxLevel() || id === 'none') return null;
        const p = partOf(slotOf(id), id);
        // 강화 기준값 = 가격 (가격 없는 유니크 세트는 1200 — 레어 세트 부위 값보다 조금 위, 레전더리 세트는 1600)
        const base = Math.max(p ? p.cost || ({ unique: 1200, legendary: 1600 }[dropGroupOf(p)] || 0) : 0, 200);
        const grade = gradeOf(this.gradeOf(id)).upCost;   // 등급 배율 (growth_v2.js GRADES upCost, 11-03)
        return Math.round((base * 0.6 * lv * grade) / 10) * 10;
    }

    upgrade(id) {
        if (!this.owned.has(id)) return { success: false, reason: '먼저 파츠를 구매해야 합니다' };
        const cost = this.upgradeCost(id);
        if (cost == null) return { success: false, reason: '이미 최대 레벨입니다' };
        if (gameState.darkMatter < cost) return { success: false, reason: '다크 매터(DM)가 부족합니다' };
        gameState.darkMatter -= cost;
        this.levels[id] = this.levelOf(id) + 1;
        gameState.notify();
        return { success: true, cost, level: this.levels[id] };
    }

    /** 강화 레벨·등급(커먼 ×1 ~ 레전더리 ×1.35)을 반영한 파츠 능력치 */
    partStats(part) {
        const s = (part && part.stats) || {};
        const k = (1 + LEVEL_BONUS * (this.levelOf(part && part.id) - 1)) * gradeOf(part ? this.gradeOf(part.id) : null).mul;   // 세트 등급 바닥 포함
        return { hp: Math.round((s.hp || 0) * k), dps: Math.round((s.dps || 0) * k), range: s.range || 0, speed: s.speed || 0 };
    }

    /** 파츠 조합 능력치 (구버전 calculateStats와 같은 규칙 + 강화 레벨) */
    statsFor(partsObj) {
        let hp = 0, dps = 0, range = 0, speed = 0;
        for (const slot of SLOTS) {
            const part = partsObj[slot];
            if (!part || !part.stats) continue;
            const s = this.partStats(part);
            hp += s.hp;
            dps += s.dps;
            if (slot === 'arm') range = part.stats.range || 100;   // 사거리는 팔이 기준
            else range += s.range;
            speed += s.speed;
        }
        return { hp, dps, range: Math.max(80, range), speed: Math.max(30, speed) };
    }

    equippedStats() {
        return this.statsFor(gameState.getEquippedObjects());
    }

    // ---- 스테이지 기록 ----
    selectStage(id) {
        this.selectedStage = id;
        this.saveSoon();
    }

    /** 난이도 고르기 (열린 난이도만) — 기록·잠금·별 표시가 그 난이도 것으로 바뀜 */
    selectDifficulty(id) {
        if (!difficultyUnlocked(id, this)) return false;
        this.difficulty = difficultyOf(id).id;
        this.saveSoon();
        return true;
    }

    /** 그 난이도의 기록 저장소 (노말 = stages) */
    recordsOf(diff = this.difficulty) {
        if (diff === DEFAULT_DIFFICULTY) return this.stages;
        return (this.diffStages[diff] ||= {});
    }

    /** 스테이지 기록. diff를 안 주면 지금 고른 난이도 */
    stage(id, diff = this.difficulty) {
        const rec = diff === DEFAULT_DIFFICULTY ? this.stages[id] : this.diffStages[diff] && this.diffStages[diff][id];
        return rec || { stars: [false, false, false], cleared: false, bestTime: null };
    }

    /** 연패 보정 비율 (0 ~ 0.4) — 깬 판은 0 (difficulty_v2.js ASSIST) */
    assist(id, diff = this.difficulty) {
        const rec = this.stage(id, diff);
        return rec.cleared ? 0 : assistOf(rec.losses);
    }

    starCount(id, diff = this.difficulty) {
        return this.stage(id, diff).stars.filter(Boolean).length;
    }

    /**
     * 전투 결과 기록. stars: [요새, 기지, 체력50%] 이번 판 달성 여부, diff = 싸운 난이도
     * @returns {{ newStars: number, bonus: number }} 새로 얻은 별 수와 보너스 DM (보너스는 여기서 지급, 난이도 보상 배율)
     */
    recordStage(id, { stars, cleared, time }, diff = this.difficulty) {
        // 시험용 전체 해제로 연 판(원래 잠긴 판)은 기록하지 않음 — 다시 켜면 이전 진행 그대로
        if (allStagesUnlocked() && !isUnlockedNormally(id, this)) return { newStars: 0, bonus: 0, pets: [], skipped: true };
        const prev = this.stage(id, diff);
        const merged = prev.stars.map((had, i) => had || !!stars[i]);
        const newStars = merged.filter(Boolean).length - prev.stars.filter(Boolean).length;
        const rec = {
            stars: merged,
            cleared: prev.cleared || !!cleared,
            bestTime: cleared ? Math.min(prev.bestTime ?? Infinity, time) : prev.bestTime
        };
        if (!rec.cleared) rec.losses = (prev.losses || 0) + 1;   // 못 깬 판에서 짐 → 연패 +1 (연패 보정), 깨면 지움
        this.recordsOf(diff)[id] = rec;
        const bonus = Math.round(newStars * STAR_BONUS_DM * difficultyOf(diff).reward);
        if (bonus) gameState.darkMatter += bonus;
        gameState.notify();
        const pets = this.checkPetRewards();
        const chars = this.syncCharacterUnlocks();   // 구역 n-1이 열리면 그 구역 캐릭터 합류 (D-119 10번)
        chars.forEach(id => track('character_unlock', { character: id, zone: this.characterZone(id) }));
        if (chars.length) this.saveSoon();
        return { newStars, bonus, pets, chars };
    }
}

Object.assign(Progress.prototype, GrowthMethods);
Object.assign(Progress.prototype, CommerceMethods);
Object.assign(Progress.prototype, PetMethods);
Object.assign(Progress.prototype, OfflineMethods);
Object.assign(Progress.prototype, TutorialMethods);
Object.assign(Progress.prototype, SupportProgressMethods);

export const progress = new Progress();

export function exportSave() {
    progress.save();
    saveStore.save('mo_v2_settings', JSON.stringify(settings.values));
    return saveStore.exportSave();
}

export function importSave(code) {
    const result = saveStore.importSave(code);
    if (result.success) clearTimeout(progress.saveTimer);
    return result;
}
