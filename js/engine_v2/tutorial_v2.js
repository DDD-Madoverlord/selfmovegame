/* 첫 성장 안내: 말풍선 열람과 별개로 실제 행동을 저장한다. */
import { gameState } from '../engine/state.js';
import { PARTS_DB } from '../data/parts.js';
import { isDropOnly } from './sets_v2.js';
import { stageById } from './stages_v2.js';
import { DIFFICULTIES } from './difficulty_v2.js';
import { characterOfPart } from './roster_v2.js';
import { track } from './analytics_v2.js';

export const TUTORIAL_STEPS = ['sortie', 'combat', 'result', 'lab', 'compare', 'equip', 'resortie'];
export const TUTORIAL_INTROS = ['offline', 'pet', 'shop'];
const parts = () => Object.values(PARTS_DB).flat();

export function emptyTutorial(status = 'active') {
    return { version: 1, status, done: [], startedAt: null, completedAt: null,
        firstBattle: null, growthPartId: null, rewardClaimed: false, introSeen: [] };
}

export function validateTutorial(t) {
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const shape = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
    const time = v => v === null || (Number.isSafeInteger(v) && v >= 0);
    const list = (v, ids) => Array.isArray(v) && new Set(v).size === v.length && v.every(id => ids.includes(id));
    const fail = () => { throw new Error('첫 성장 안내 저장 데이터가 올바르지 않습니다.'); };
    if (!shape(t, Object.keys(emptyTutorial())) || t.version !== 1 || !['active', 'skipped', 'complete', 'legacy'].includes(t.status)
        || !list(t.done, TUTORIAL_STEPS) || !list(t.introSeen, ['characters', ...TUTORIAL_INTROS])
        || !time(t.startedAt) || !time(t.completedAt) || typeof t.rewardClaimed !== 'boolean'
        || !(t.growthPartId === null || parts().some(p => p.id === t.growthPartId && p.id !== 'none'))) fail();
    if (t.firstBattle !== null && (!shape(t.firstBattle, ['stageId', 'difficulty', 'victory'])
        || stageById(t.firstBattle.stageId)?.id !== t.firstBattle.stageId
        || !DIFFICULTIES.some(d => d.id === t.firstBattle.difficulty)
        || ![null, true, false].includes(t.firstBattle.victory))) fail();
    const complete = TUTORIAL_STEPS.every(id => t.done.includes(id));
    if ((t.status === 'complete') !== complete || (t.completedAt !== null) !== complete
        || (t.rewardClaimed && !complete) || (t.done.includes('sortie') && !t.firstBattle)
        || (t.done.includes('result') && (t.firstBattle?.victory == null))
        || (t.done.includes('equip') && !t.growthPartId)
        || (t.done.includes('resortie') && (!t.done.includes('equip') || !t.done.includes('result')))
        || (t.startedAt !== null && t.completedAt !== null && t.completedAt < t.startedAt)) fail();
    return true;
}

/** 기본 파츠를 채우기 전의 저장 원문으로 판별한다. */
export function hasTutorialHistory(data) {
    if (!data) return false;
    const records = [data.stages || {}, ...Object.values(data.diffStages || {})];
    return records.some(r => Object.keys(r).length) || !!data.tips?.length
        || Object.values(data.levels || {}).some(n => n > 1)
        || (data.owned || []).some(id => parts().some(p => p.id === id && (p.cost > 0 || isDropOnly(p))))
        || Object.values(data.equipped || {}).some(id => parts().some(p => p.id === id && (p.cost > 0 || isDropOnly(p))))
        || (Number.isFinite(data.dm) && data.dm !== 2500) || !!data.spentStars
        || Object.keys(data.research || {}).length > 0 || !!data.pets?.owned?.length;
}

export const TutorialMethods = {
    loadTutorial(data) {
        this._tutorialReplay = null;
        this._tutorialShown = null;
        try {
            if (data?.tutorial !== undefined) { validateTutorial(data.tutorial); this.tutorial = structuredClone(data.tutorial); return; }
        } catch (e) { /* 손상된 안내만 초기화하고 기존 진행은 보존 */ }
        this.tutorial = emptyTutorial(hasTutorialHistory(data) ? 'legacy' : 'active');
    },
    tutorialState() { return this._tutorialReplay || this.tutorial; },
    tutorialStep() {
        const t = this.tutorialState();
        return t.status === 'active' ? TUTORIAL_STEPS.find(id => !t.done.includes(id)) : null;
    },
    tutorialEvent(step, action, now = Date.now()) {
        const t = this.tutorialState();
        return { tutorial_version: 1, step_id: step, step_index: TUTORIAL_STEPS.indexOf(step) + 1,
            mode: this._tutorialReplay ? 'replay' : 'normal', action,
            elapsed_ms: t.startedAt === null ? 0 : Math.max(0, now - t.startedAt),
            stage_id: t.firstBattle?.stageId || this.selectedStage, difficulty: t.firstBattle?.difficulty || this.difficulty };
    },
    tutorialShown(now = Date.now()) {
        const t = this.tutorialState(), step = this.tutorialStep();
        if (!step || this._tutorialShown === step) return;
        if (t.startedAt === null) t.startedAt = now;
        this._tutorialShown = step;
        track('tutorial_step', this.tutorialEvent(step, 'shown', now));
        if (!this._tutorialReplay) this.save();
    },
    tutorialDone(step, now = Date.now()) {
        const t = this.tutorialState();
        if (t.status !== 'active' || t.done.includes(step) || !TUTORIAL_STEPS.includes(step)) return false;
        t.done.push(step);
        track('tutorial_step', this.tutorialEvent(step, 'completed', now));
        if (TUTORIAL_STEPS.every(id => t.done.includes(id))) {
            t.status = 'complete'; t.completedAt = now;
            track('tutorial_complete', { ...this.tutorialEvent(step, 'completed', now), growth_part_id: t.growthPartId,
                retry: t.firstBattle?.victory === false });
        }
        if (!this._tutorialReplay) this.save();
        return true;
    },
    tutorialBattleStart(stageId, difficulty, now = Date.now()) {
        const t = this.tutorialState();
        if (t.status !== 'active') return;
        if (t.done.includes('sortie') && t.done.includes('equip') && t.firstBattle?.victory !== null
            && ((stageId !== t.firstBattle.stageId || difficulty !== t.firstBattle.difficulty) || t.firstBattle.victory === false)) {
            this.tutorialDone('resortie', now);
        }
        if (!t.firstBattle || t.firstBattle.victory === null) t.firstBattle = { stageId, difficulty, victory: null };
        this.tutorialDone('sortie', now);
    },
    tutorialBattleResult(stageId, difficulty, victory, now = Date.now()) {
        const t = this.tutorialState();
        if (t.status !== 'active') return;
        if (!t.firstBattle) this.tutorialBattleStart(stageId, difficulty, now);
        if (t.firstBattle.stageId === stageId && t.firstBattle.difficulty === difficulty && t.firstBattle.victory === null) {
            t.firstBattle.victory = !!victory;
        }
        this.tutorialDone('combat', now);
        this.tutorialDone('result', now);
    },
    tutorialCompare(id) {
        const p = parts().find(p => p.id === id);
        if (p && !this.isOwned(id) && !isDropOnly(p) && p.cost <= gameState.darkMatter) this.tutorialDone('compare');
    },
    tutorialCanBuy() {
        return parts().some(p => p.cost > 0 && !isDropOnly(p) && !this.isOwned(p.id)
            && characterOfPart(p) === this.character && p.cost <= gameState.darkMatter);
    },
    tutorialGrowth(id, fallback = false) {
        const t = this.tutorialState();
        if (t.status !== 'active' || !id || !this.isOwned(id) || !Object.values(gameState.equippedParts).includes(id)) return;
        if (fallback && this.tutorialCanBuy()) return;
        if (!t.growthPartId) t.growthPartId = id;
        this.tutorialDone('compare');
        this.tutorialDone('equip');
    },
    skipTutorial() {
        const t = this.tutorialState(), step = this.tutorialStep();
        if (!step) return;
        track('tutorial_skip', { ...this.tutorialEvent(step, 'skipped'), completed_count: t.done.length });
        if (this._tutorialReplay) this._tutorialReplay = null;
        else { t.status = 'skipped'; this.save(); }
        this._tutorialShown = null;
    },
    replayTutorial() { this._tutorialReplay = emptyTutorial(); this._tutorialShown = null; },
    resumeTutorial() {
        if (this.tutorial.status === 'legacy') { this.replayTutorial(); return; }
        this._tutorialReplay = null;
        this._tutorialShown = null;
        if (this.tutorial.status === 'skipped') { this.tutorial.status = 'active'; this.save(); }
    },
    claimTutorialReward() {
        if (this._tutorialReplay || this.tutorial.status !== 'complete' || this.tutorial.rewardClaimed
            || this.offlineStorageCurrent?.() === false) return false;
        this.tutorial.rewardClaimed = true;
        gameState.darkMatter += 200;
        this.save();
        gameState.notify();
        return true;
    },
    nextTutorialIntro() {
        if (this._tutorialReplay || this.tutorial.status !== 'complete') return null;
        const seen = this.tutorial.introSeen;
        if (!seen.includes('offline')) return this.offlineReward().ready ? 'offline' : null;
        if (!seen.includes('pet')) return this.hasNewPet() ? 'pet' : null;
        if (!seen.includes('shop')) return this.stage('1-3', 'normal').cleared ? 'shop' : null;
        return null;
    },
    markTutorialIntro(id) {
        if (id !== this.nextTutorialIntro()) return;
        this.tutorial.introSeen.push(id);
        this.save();
    }
};
