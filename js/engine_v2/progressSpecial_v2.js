/* ==========================================================================
   PROJECT: MAD OVERLORD // 스페셜맵 저장·횟수·보상 (D-119 9번, 규칙은 special_v2.js)
   Progress(progress_v2.js)에 메서드로 붙는다 (this = progress).
   저장 special: { dayKey(한국 날짜), used: { boss, smash }, bossBest(깬 가장 높은 단계), smashBest: { week, score }, lastSeenAt }
   하루 횟수: 들어가면 1회 (이기든 지든). 시계를 되돌려도 lastSeenAt보다 이전 날로는 안 감 (상점과 같은 방식).
   보상 재화 승급석(stones)은 성장 필드(progressGrowth_v2.js) — 5번 파츠 성장의 승급 재료
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { SPECIAL, bossReward, smashGrade, bossStage, smashStage } from './special_v2.js';
import { TOWER, towerReward, towerStage } from './tower_v2.js';
import { kstDayKey, kstWeekKey } from './kstTime_v2.js';
import { track } from './analytics_v2.js';

// tower: 오버로드의 탑 (D-126) { best 깬 가장 높은 층, week 주 키, weekBest 이번 주 깬 가장 높은 층 } — 횟수 제한 없음
export const emptySpecial = () => ({ dayKey: null, used: { boss: 0, smash: 0 }, bossBest: 0, smashBest: { week: null, score: 0 }, lastSeenAt: 0,
    tower: { best: 0, week: null, weekBest: 0 } });

export const SpecialMethods = {
    loadSpecial(data) {
        const v = data && data.special;
        const e = emptySpecial();
        if (!v || typeof v !== 'object') { this.special = e; return; }
        this.special = {
            dayKey: typeof v.dayKey === 'string' ? v.dayKey : null,
            used: { boss: Math.max(0, Math.floor(v.used?.boss || 0)), smash: Math.max(0, Math.floor(v.used?.smash || 0)) },
            bossBest: Math.min(SPECIAL.boss.steps, Math.max(0, Math.floor(v.bossBest || 0))),
            smashBest: { week: typeof v.smashBest?.week === 'string' ? v.smashBest.week : null, score: Math.max(0, Math.floor(v.smashBest?.score || 0)) },
            lastSeenAt: Number.isFinite(v.lastSeenAt) ? v.lastSeenAt : 0,
            tower: { best: Math.max(0, Math.floor(v.tower?.best || 0)), week: typeof v.tower?.week === 'string' ? v.tower.week : null,
                weekBest: Math.max(0, Math.floor(v.tower?.weekBest || 0)) }
        };
    },
    specialData() {
        return this.special;
    },
    /** 시계 되돌림 막기: 본 적 있는 가장 늦은 시각 */
    specialTime(now = Date.now()) {
        this.special.lastSeenAt = Math.max(this.special.lastSeenAt || 0, now);
        return this.special.lastSeenAt;
    },
    specialUnlocked() {
        return this.stage(SPECIAL.unlockStage, 'normal').cleared;
    },
    /** 오늘 남은 횟수 */
    specialLeft(mode, now = Date.now()) {
        const key = kstDayKey(this.specialTime(now));
        const used = this.special.dayKey === key ? this.special.used[mode] || 0 : 0;
        return Math.max(0, SPECIAL.daily[mode] - used);
    },
    /** 다음에 도전할 보스 러시 단계 */
    nextBossStep() {
        return Math.min(SPECIAL.boss.steps, (this.special.bossBest || 0) + 1);
    },
    /** 들어가기: 횟수 1 쓰고 전투 스테이지를 돌려줌 */
    startSpecial(mode, now = Date.now()) {
        if (!this.specialUnlocked()) return { success: false, reason: `노말 ${SPECIAL.unlockStage}를 깨면 열립니다` };
        if (this.specialLeft(mode, now) <= 0) return { success: false, reason: '오늘 횟수를 다 썼어요 (한국 시간 0시에 다시 채워짐)' };
        const key = kstDayKey(this.specialTime(now));
        if (this.special.dayKey !== key) this.special = { ...this.special, dayKey: key, used: { boss: 0, smash: 0 } };
        this.special.used[mode] = (this.special.used[mode] || 0) + 1;
        const stage = mode === 'boss' ? bossStage(this.nextBossStep(), now) : smashStage(now);
        track('special_start', { mode, step: stage.specialStep || 0 });
        gameState.notify();
        return { success: true, stage };
    },
    /** 보스 러시 끝: 이기면 단계 기록·보상 */
    finishSpecialBoss(step, victory) {
        track('special_end', { mode: 'boss', step, result: victory ? 'victory' : 'defeat' });
        if (!victory) return { victory: false, step };
        const r = bossReward(step);
        const first = step > (this.special.bossBest || 0);
        const shards = first ? r.shards : 0;
        this.special.bossBest = Math.max(this.special.bossBest || 0, step);
        this.stones = (this.stones || 0) + r.stones;
        this.cores = (this.cores || 0) + r.cores;
        this.shards = (this.shards || 0) + shards;
        gameState.darkMatter += r.dm;
        gameState.notify();
        return { victory: true, step, first, stones: r.stones, cores: r.cores, dm: r.dm, shards };
    },
    // ---- 오버로드의 탑 (D-126) ----
    nextTowerFloor() {
        return (this.special.tower?.best || 0) + 1;
    },
    /** 이번 주 깬 가장 높은 층 (새 주면 0) */
    towerWeekBest(now = Date.now()) {
        const t = this.special.tower;
        return t && t.week === kstWeekKey(this.specialTime(now)) ? t.weekBest : 0;
    },
    /** 들어가기 (횟수 없음): 다음 층 스테이지 */
    startTower(now = Date.now()) {
        if (!this.stage(TOWER.unlockStage, 'normal').cleared) return { success: false, reason: `노말 ${TOWER.unlockStage}를 깨면 열립니다` };
        const stage = towerStage(this.nextTowerFloor(), now);
        track('special_start', { mode: 'tower', step: stage.specialStep });
        return { success: true, stage };
    },
    /** 탑 층 끝: 처음 깬 층이면 보상 · 최고 층 · 주간 최고 */
    finishTower(floor, victory, now = Date.now()) {
        track('special_end', { mode: 'tower', step: floor, result: victory ? 'victory' : 'defeat' });
        if (!victory) return { victory: false, floor, best: this.special.tower.best };
        const t = this.special.tower;
        const week = kstWeekKey(this.specialTime(now));
        if (t.week !== week) { t.week = week; t.weekBest = 0; }
        t.weekBest = Math.max(t.weekBest, floor);
        const first = floor > t.best;
        const r = first ? towerReward(floor) : { dm: 0, cores: 0, shards: 0, stones: 0 };
        if (first) t.best = floor;
        this.cores = (this.cores || 0) + r.cores;
        this.shards = (this.shards || 0) + r.shards;
        this.stones = (this.stones || 0) + r.stones;
        gameState.darkMatter += r.dm;
        gameState.notify();
        return { victory: true, floor, first, ...r, best: t.best, weekBest: t.weekBest };
    },

    /** 파괴 작전 끝: 점수 → 등급 보상, 주간 최고 기록 */
    finishSpecialSmash(score, now = Date.now()) {
        const grade = smashGrade(score);
        const r = SPECIAL.smash.reward[grade];
        const week = kstWeekKey(this.specialTime(now));
        const best = this.special.smashBest.week === week ? this.special.smashBest.score : 0;
        const newBest = score > best;
        if (newBest) this.special.smashBest = { week, score };
        this.shards = (this.shards || 0) + r.shards;
        gameState.darkMatter += r.dm;
        track('special_end', { mode: 'smash', score, grade });
        gameState.notify();
        return { score, grade, shards: r.shards, dm: r.dm, newBest, best: Math.max(best, score) };
    }
};
