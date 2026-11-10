/* ==========================================================================
   PROJECT: MAD OVERLORD // 스페셜맵 전투 (D-119 9번 — 규칙 special_v2.js, 저장·보상 progressSpecial_v2.js)
   보스 러시: 보통 스테이지 장치를 그대로 씀 — 아주 약한 문(최종 거점, boss.afterBase) → 보스 → 보스 처치 = 승리(enemyField.bossVictory)
   파괴 작전: 진격 거리에 맞춰 물체(바리케이드형, 움직이지 않음)가 나타나고, 부수면 점수 + 3초 안 연속 파괴 보너스.
             60초가 끝나거나 물체를 모두 부수면 끝(남은 시간 × 25점 보너스). 진 판이 없음 — 점수로 등급
   ========================================================================== */

import { SPECIAL } from '../special_v2.js';

export const SpecialBattleMethods = {
    /** 출격 때 (battle_v2.js startBattle) */
    setupSpecial() {
        this.smashScore = 0;
        this.smashBroken = 0;
        this.smashCombo = 0;
        this.smashLastAt = -99;
        this.smashQueue = this.stage.smashItems ? this.stage.smashItems.map(o => ({ ...o })) : null;
        this.smashEnding = false;
    },

    /** 파괴 작전: 진격 거리에 이른 물체를 화면 오른쪽에 세움 (battle_v2.js 루프) */
    tickSmash() {
        if (!this.smashQueue || this.smashEnding) return;
        while (this.smashQueue.length && this.distanceTraveled >= this.smashQueue[0].at) {
            const o = this.smashQueue.shift();
            const x = Math.min(1080, this.frontX() + 420);
            const b = this.spawnBarricade(x, Math.round(o.hp * this.stage.enemy.hp), o.name, o.art);
            if (b) { b.smashScore = o.score; b.t = { name: o.name }; }
        }
        // 다 세웠고 다 부쉈으면 일찍 끝냄
        if (!this.smashQueue.length && !this.enemies.some(e => e.smashScore)) this.endSmash(true);
    },

    /** 물체를 부숨 (enemyField.js onEnemyKilled 바리케이드 갈래) */
    smashOnBreak(e) {
        const S = SPECIAL.smash;
        const t = this.stats.time;
        this.smashCombo = t - this.smashLastAt <= S.comboSec ? Math.min(5, this.smashCombo + 1) : 0;
        this.smashLastAt = t;
        const mul = 1 + S.comboBonus * this.smashCombo;
        const pts = Math.round(e.smashScore * mul);
        this.smashScore += pts;
        this.smashBroken += 1;
        this.createDamagePopup(e.x + 10, 230, `+${pts}${this.smashCombo ? ` · 연속 ×${mul.toFixed(1)}` : ''}`, true);
        if (this.domTargetLabel) this.domTargetLabel.textContent = `파괴 작전 점수 ${this.smashScore.toLocaleString()}`;
    },

    /** 파괴 작전 끝: 시간 끝(allDone=false) 또는 모두 부숨(남은 시간 보너스) → 결과 */
    endSmash(allDone) {
        if (this.smashEnding) return;
        this.smashEnding = true;
        if (allDone) {
            const bonus = Math.round(this.timeLeft() * 25);
            this.smashScore += bonus;
            if (bonus) this.createDamagePopup(this.monsterX + 30, 250, `모두 부숨! 남은 시간 보너스 +${bonus}`, true);
        }
        this.finalBaseDestroyed = true;   // 전투 루프 정지 (결과까지)
        this.cinematic = true;
        this.clearSupport();
        this.director.alarm(allDone ? 'CLEAR' : 'TIME UP', `파괴 작전 점수 ${this.smashScore.toLocaleString()}`, 1.2);
        const run = this.runId;
        setTimeout(() => { if (this.runId === run && this.isActive) this.finishBattle(true); }, 1300);
    }
};
