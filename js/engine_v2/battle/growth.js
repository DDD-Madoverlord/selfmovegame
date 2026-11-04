/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 강화 외 성장 연결 (v2, Q-006)
   파츠 옵션 합계(gear) · 스킬 레벨(피해·쿨다운) · 전술 모듈(스킬 칸 mod1·mod2, 키 4·5) · 나이트메어 전장 변이 ·
   스킬 코어·파츠 드랍 (결과 화면). 수치는 growth_v2.js, 저장·지급은 progressGrowth_v2.js.
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { gameState } from '../../engine/state.js';
import { progress } from '../progress_v2.js';
import { sound } from '../audio/sound_v2.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { characterOfPart } from '../roster_v2.js';
import { difficultyOf, difficultyOfStage } from '../difficulty_v2.js';
import { MODULES, MODULE_MAX_LEVEL, MUTATORS, SKILL_LEVEL, CORES } from '../growth_v2.js';
import { setCounts } from '../sets_v2.js';
import { SET_VFX } from '../vfx/vfxDefs.js';
import { FOOT_B } from './tuning.js';
import { PET_DM_CAP, PET_CDR_CAP } from '../pets_v2.js';

export const MODULE_SLOT_IDS = ['mod1', 'mod2'];

/** 스킬 레벨 → 피해 배율 (Lv1 ×1 … Lv5 ×1.4) */
export function skillPowerOf(level) {
    return 1 + SKILL_LEVEL.dmgPer * (Math.max(1, level) - 1);
}
/** 스킬 레벨 → 쿨다운 배율 (Lv3·4 ×0.9, Lv5 ×0.8) */
export function skillCdMulOf(level) {
    let cut = 0;
    for (const [lv, c] of Object.entries(SKILL_LEVEL.cdCut)) if (level >= Number(lv)) cut = c;
    return 1 - cut;
}

const spr = (sheet, size, extra = {}) => ({ type: 'sprite', sheet, at: 0, dur: 0.5, size, glow: 1.2, ...extra });
const MODULE_VFX = {
    purify: { layers: [spr('golden_burst', 150), { type: 'ring', at: 0, dur: 0.45, r: 90, color: '255, 224, 138', width: 4 }] },
    purifyHit: { layers: [spr('golden_burst', 80, { dur: 0.35 })] },
    barrier: { layers: [spr('power_aura', 220, { anchorY: 0.92, dur: 0.7 }), { type: 'ring', at: 0, dur: 0.5, r: 70, ground: true, color: '127, 212, 255', width: 4 }] },
    repair: { layers: [spr('pillar_gold', 170, { anchorY: 0.92, dur: 0.7 }), { type: 'motes', at: 0.1, count: 10, spread: 40, rise: [50, 110], life: [0.6, 1.0], size: 2.4, color: '125, 255, 154' }] },
    timeWarp: { layers: [spr('ice_burst', 110, { dur: 0.45 })] }
};

/** 전술 모듈 하나를 스킬 칸 정의로 (useSkill·HUD·자동 사용이 그대로 씀) */
function moduleSkill(id, level, b) {
    const m = MODULES[id];
    const base = { id, module: true, name: m.name, icon: m.icon, color: m.color, desc: m.desc, level,
        cd: m.cd * (1 - 0.1 * (Math.min(level, MODULE_MAX_LEVEL) - 1)) };
    const ahead = (range, f = () => true) => b.enemies.filter(e => !e.isBuilding && !e.isBarricade
        && e.x - b.frontX() >= -60 && e.x - b.frontX() <= range && f(e));
    switch (id) {
        case 'purify': return { ...base, target: 'self',
            use(bb) {
                const list = ahead(m.range);
                bb.fx.play(MODULE_VFX.purify, bb.monsterX + 120, FOOT_B + 60);
                list.forEach(e => {
                    e.purifyUntil = bb.stats.time + m.sec;
                    if (e.shield > 0) { e.shield = 0; bb.updateEnemyFilter(e); }
                    if (e.elite) bb.fx.play(MODULE_VFX.purifyHit, aimOf(e).x, aimOf(e).b);
                });
                bb.createDamagePopup(bb.monsterX + 60, 210, `✦ 정화 — 엘리트 효과 ${m.sec}초 무효`, false);
                sound.play('shield_on', { rate: 1.4 });
            },
            auto: bb => ahead(m.range, e => e.elite && !(e.purifyUntil > bb.stats.time)).length > 0 };
        case 'barrier': return { ...base, target: 'self',
            use(bb) {
                bb.ccImmuneT = m.sec;
                bb.pSlowT = 0;
                bb.pRootT = 0;
                if (!(bb.overloadT > 0)) bb.pStunT = 0;   // 과부하(긴급 수리)는 그대로
                bb.updatePlayerStatus();
                bb.fx.play(MODULE_VFX.barrier, bb.monsterX + 35, FOOT_B, { follow: () => [bb.monsterX + 35, FOOT_B] });
                bb.createDamagePopup(bb.monsterX + 40, 210, `⬢ 방벽 — ${m.sec}초 상태 이상 면역`, false);
                sound.play('shield_on');
            },
            auto: bb => bb.pSlowT > 0 || bb.pRootT > 0 || (bb.pStunT > 0 && !(bb.overloadT > 0)) };
        case 'repair': return { ...base, target: 'self',
            use(bb) {
                const amount = bb.maxPlayerHp * m.heal;
                bb.healPlayer(amount);
                bb.fx.play(MODULE_VFX.repair, bb.monsterX + 35, FOOT_B);
                bb.createDamagePopup(bb.monsterX + 40, 200, `🔧 +${Math.round(amount)} 수리`, false);
                sound.play('shield_on', { rate: 1.2 });
            },
            auto: bb => bb.playerHp < bb.maxPlayerHp * 0.45 && !(bb.overloadT > 0) };
        case 'orbital': return { ...base, target: 'building', reach: m.range,
            use(bb) {
                const t = bb.enemies.filter(e => e.isBuilding && e.x - bb.frontX() <= m.range).sort((p, q) => p.x - q.x)[0];
                if (!t) return;
                const a = aimOf(t);
                bb.fx.play(SET_VFX.orbitalHit, a.x, FOOT_B);
                bb.director.shake(8, 350);
                bb.schedule(0.15, () => { if (bb.enemies.includes(t)) bb.dealDamageToEnemy(t, bb.unit() * m.dmg, true, { knock: 0, stop: true }); });
                sound.play('mech_laser_big');
            },
            auto: bb => bb.enemies.some(e => e.isBuilding && e.x - bb.frontX() <= m.range) };
        case 'timeWarp': return { ...base, target: 'self',
            use(bb) {
                const list = bb.enemies.filter(e => !e.isBuilding && !e.isBarricade && e.x - bb.monsterX < 1100);
                list.forEach((e, i) => {
                    e.slowT = Math.max(e.slowT || 0, m.sec);
                    bb.updateEnemyFilter(e);
                    if (i < 8) bb.fx.play(MODULE_VFX.timeWarp, aimOf(e).x, aimOf(e).b);
                });
                bb.createDamagePopup(bb.monsterX + 60, 210, `⏳ 시간 왜곡 — 적 ${list.length}명 감속`, false);
                sound.play('frost_freeze');
            },
            auto: bb => ahead(420).length >= 4 };
        case 'overcharge': return { ...base, target: 'self',
            use(bb) {
                bb.ultGauge = Math.min(1, bb.ultGauge + m.gauge);
                bb.fx.play(SET_VFX.adrenaline, bb.monsterX + 35, FOOT_B);
                bb.createDamagePopup(bb.monsterX + 40, 210, `⚡ 필살기 게이지 +${Math.round(m.gauge * 100)}%`, false);
                sound.play('charge_up');
            },
            auto: bb => bb.ultGauge >= 0.2 && bb.ultGauge < 0.65 };
        default: return null;
    }
}

export const GrowthBattleMethods = {
    /** 전투 시작 때 (스탯·스킬을 정한 뒤): 옵션 합계, 모듈 칸, 전장 변이, 전리품 */
    setupGrowth(equippedObjs) {
        this.gear = progress.gearTotals(equippedObjs);
        this.setCount = setCounts(equippedObjs);   // 세트 효과 (Q-008): 세트 id → 끼운 부위 수
        this.growthCharacter = characterOfPart(equippedObjs.body) || progress.character;   // 드랍은 출전 캐릭터 파츠
        this.ccImmuneT = 0;
        this.loot = { cores: 0 };
        this.mutator = this.stage.mutator ? { id: this.stage.mutator, ...MUTATORS[this.stage.mutator] } : null;
        this.skillLevels = {};
        for (const slot of ['arm', 'body', 'head']) {
            const sk = this.skills[slot];
            if (sk) this.skillLevels[slot] = progress.skillLevel(sk.id);
        }
        MODULE_SLOT_IDS.forEach(slot => { delete this.skills[slot]; delete this.skillCd[slot]; });
        progress.equippedModules().forEach((id, i) => {
            const sk = moduleSkill(id, progress.moduleLevel(id), this);
            if (!sk) return;
            this.skills[MODULE_SLOT_IDS[i]] = sk;
            this.skillCd[MODULE_SLOT_IDS[i]] = 0;
        });
    },

    /** 계정 연구 'DM 정제'를 붙인 스테이지 (보상만 바뀐 얕은 복사본) */
    growthStage(stage) {
        const dm = Math.min(PET_DM_CAP, progress.researchBonus('dmBoost') + progress.petBattleDmBonus());
        if (!dm) return stage;
        const r = stage.reward;
        return { ...stage, reward: { kill: Math.round(r.kill * (1 + dm)), mid: Math.round(r.mid * (1 + dm)), final: Math.round(r.final * (1 + dm)) } };
    },

    /** 스킬 쿨다운 (스킬 레벨·재충전 옵션·과부하 변이) */
    skillCooldown(slot, sk) {
        const lvMul = sk.module ? 1 : skillCdMulOf(this.skillLevels?.[slot] || 1);
        const kitCd = sk.module ? 0 : (this.kitPatch?.[sk.id]?.cd || 0);   // 2차 세트 효과: 쿨다운 -초 (kit.js)
        const kitCdr = sk.module ? 0 : this.kitMod('cdr');                  // 2차 패시브: 쿨다운 -%
        const cdr = Math.min(PET_CDR_CAP, (this.gear?.cdr || 0) + (!sk.module && ['arm', 'body'].includes(slot) ? this.petBonuses?.cdr || 0 : 0));
        return Math.max(1, (sk.cd + kitCd) * lvMul * (1 - cdr) * (1 - kitCdr) * (this.mutator?.cdMul || 1));
    },

    /**
     * 스킬을 쓸 때 넘길 전투 엔진: 스킬 레벨이 2 이상이면 unit()(스킬 피해 기준)에 배율을 곱한 대리 객체.
     * 스킬은 대부분 나중에 터지는 타격(b.schedule) 안에서 b.unit()을 부르므로, 대리 객체를 넘겨야 배율이 끝까지 붙음.
     */
    skillCaster(slot) {
        const power = skillPowerOf(this.skillLevels?.[slot] || 1);
        if (power === 1) return this;
        const target = this;
        const proxy = new Proxy(target, {
            get(t, p) {
                if (p === 'unit') return () => t.unit() * power;
                const v = Reflect.get(t, p, t);
                return typeof v === 'function' ? v.bind(proxy) : v;
            },
            set(t, p, v) { t[p] = v; return true; }
        });
        return proxy;
    },

    /** 세트 효과가 켜졌는지: 그 세트 부위를 n개(기본 4) 이상 끼움 (sets_v2.js SETS bonus) */
    setOn(setId, n = 4) {
        return (this.setCount?.[setId] || 0) >= n;
    },

    /** 엘리트 효과가 꺼져 있는지 (정화 파동) */
    isPurified(enemy) {
        return enemy.purifyUntil > this.stats.time;
    },

    /** 옵션·변이를 반영한 적 피해 배율 (dealDamageToEnemy) */
    gearDamageMul(enemy, gear = this.gear) {
        const g = gear || {};
        let k = 1;
        if (enemy.elite) k *= 1 + (g.eliteDmg || 0);
        if (enemy.boss) k *= 1 + (g.bossDmg || 0);
        if (enemy.isBuilding || enemy.isBarricade) k *= 1 + (g.siegeDmg || 0);
        if (enemy.isBuilding && this.mutator?.siegeCut) k *= 1 - this.mutator.siegeCut;
        return k;
    },

    /** 상태 이상 시간 배율 (냉기 저항 옵션, 방벽 발생기 면역이면 0) */
    ccMul() {
        if (this.ccImmuneT > 0) return 0;
        return (1 - (this.gear?.ccCut || 0)) * this.kitCcMul();   // 2차 패시브 (kit.js)
    },

    /** 진격 속도 배율 (신속 진격 옵션 · 얼음 바닥 변이) */
    gearMoveMul() {
        return (1 + (this.gear?.speed || 0)) * (this.mutator?.moveMul || 1);
    },

    tickGrowth(dt) {
        if (this.ccImmuneT > 0) this.ccImmuneT = Math.max(0, this.ccImmuneT - dt);
    },

    /** 적이 쓰러질 때: 스킬 코어(엘리트·보스), 핏빛 달 변이 폭발 */
    onGrowthKill(enemy) {
        const n = enemy.boss ? CORES.boss : enemy.elite ? CORES.elite : 0;
        if (n) {
            const v = n * difficultyOf(difficultyOfStage(this.stage)).reward;
            this.loot.cores += Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
        }
        const blast = this.mutator?.deathBlast;
        if (blast && !enemy.isBarricade) {
            const x = enemy.x + 38;
            this.fx.play({ layers: [spr('fire_burst', 70, { dur: 0.35 })] }, x, FOOT_B + 30);
            if (Math.abs(this.monsterX + 60 - x) <= 120) this.damagePlayer(this.maxPlayerHp * blast, 0);
        }
    },

    /** 전투 끝: 코어 지급 + (승리면) 파츠 드랍 → 결과 화면용 전리품 */
    finishGrowth(victory, firstClear) {
        const cores = this.loot.cores ? progress.addCores(this.loot.cores) : 0;
        const drop = victory ? progress.rollBattleDrop({
            character: this.growthCharacter, zone: this.stage.zone, difficulty: difficultyOfStage(this.stage),
            boss: !!this.stage.boss, firstClear
        }) : null;
        if (cores || drop) gameState.notify();
        return { cores, drop, shards: progress.shards };
    }
};
