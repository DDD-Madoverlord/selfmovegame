/* ==========================================================================
   PROJECT: MAD OVERLORD // 캐릭터 고유 특성 (D-119 6번 · 3번 안 A, Q-038 임시)
   캐릭터마다 파츠와 상관없이 항상 켜지는 특성 하나 — 역할을 뚜렷하게 (수치는 battle/tuning.js SIGNATURE).
     거대로봇  전환 장갑: 근거리 팔이면 받는 피해 −10%, 원거리 팔이면 멈춰 쏠 때 피해 +15%
     거대괴수  산성 부식: 거점·바리케이드 피해 +30%
     타락 히어로 저주: 감속된 적이 받는 피해 +12%
     합성괴인  졸개 군단: 졸개 공격력 +25%
     심연의 길잡이 심해 압력: 기절·붙잡힌 적이 받는 피해 +15%
     봉합 성녀  봉합 회수: 봉합 표식이 남은 적이 쓰러지면 내구도 2% 회복
     뒤틀린 인형사 인형극: 기절·붙잡힌 적이 받는 피해 +20%
     서리의 무희 빙결 파쇄: 얼어 있는 적이 받는 피해 +20% (다리 '빙판 걸음'과 더해짐)
     철거의 설계자 철거 전문: 거점·바리케이드 피해 +25%
     침묵의 방송자 잡음: 기본 공격에 맞은 보통 적 1초 침묵
   전투 쪽에 붙는 곳: dealDamageToEnemy(sigTargetMul) · damagePlayer → incomingMul(sigIncomingMul) · onEnemyKilled(sigOnKill) ·
   allies.js 졸개 공격력(sigAllyMul) · 기본 공격 맞힘(sigOnBasicHit)
   ========================================================================== */

import { SIGNATURE } from './tuning.js';
import { progress } from '../progress_v2.js';
import { characterOfPart } from '../roster_v2.js';
import { roleOfArm } from '../role_v2.js';

const isUnit = e => e && !e.isBuilding && !e.isBarricade;

export const TraitMethods = {
    /** 출격 때: 이번 캐릭터와 팔 역할 (battle_v2.js startBattle) */
    setupTraits(equippedObjs) {
        // 리그(monster_v2)는 이 뒤에 바뀌므로 몸통 파츠로 캐릭터를 정함 (없으면 고른 캐릭터)
        this.sigChar = characterOfPart(equippedObjs && equippedObjs.body) || progress.character;
        this.sigRole = roleOfArm(equippedObjs && equippedObjs.arm);
    },

    /** 주인공이 적에게 주는 피해 배율 (협력 공격 제외 — enemyField.js dealDamageToEnemy): 고유 특성 × 특성 트리 '주는 피해' (D-125) */
    sigTargetMul(e) {
        return this.sigCharMul(e) * (1 + (this.treeMods?.dmg || 0));
    },

    /** 고유 특성만의 피해 배율 */
    sigCharMul(e) {
        const s = SIGNATURE;
        switch (this.sigChar) {
        case 'mech': return this.sigRole === 'ranged' && this.isAttacking ? 1 + s.mech.anchorDmg : 1;
        case 'kaiju': return e.isBuilding || e.isBarricade ? 1 + s.kaiju.siege : 1;
        case 'hero': return e.slowT > 0 ? 1 + s.hero.slowedDmg : 1;
        case 'diver': return e.stunT > 0 ? 1 + s.diver.heldDmg : 1;
        case 'doll': return e.stunT > 0 ? 1 + s.doll.heldDmg : 1;
        case 'frost': return e.frozenT > 0 ? 1 + s.frost.frozenDmg : 1;
        case 'architect': return e.isBuilding || e.isBarricade ? 1 + s.architect.siege : 1;
        default: return 1;
        }
    },

    /** 주인공이 받는 피해 배율 (sets.js incomingMul) */
    sigIncomingMul() {
        const tree = 1 - (this.treeMods?.taken || 0);   // 특성 트리 '받는 피해 −' (D-125)
        return (this.sigChar === 'mech' && this.sigRole === 'melee' ? 1 - SIGNATURE.mech.meleeGuard : 1) * tree;
    },

    /** 졸개(합성괴인 기본 졸개·총동원령) 공격력 배율 (allies.js) */
    sigAllyMul() {
        return this.sigChar === 'chimera' ? 1 + SIGNATURE.chimera.minionDmg : 1;
    },

    /** 적이 쓰러질 때 (enemyField.js onEnemyKilled) */
    sigOnKill(e) {
        if (this.sigChar === 'saint' && e.stitchT > 0) this.healPlayer(this.maxPlayerHp * SIGNATURE.saint.stitchHeal);
    },

    /** 기본 공격이 적에게 맞았을 때 (attacks.js fireAttack · kit.js 기본 공격) */
    sigOnBasicHit(e) {
        if (this.sigChar === 'broadcaster' && isUnit(e) && !e.boss && this.kitStatus) this.kitStatus(e, { silence: SIGNATURE.broadcaster.silence });
    }
};
