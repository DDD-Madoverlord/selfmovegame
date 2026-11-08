/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 봉합 성녀 (v2, 새 캐릭터 2 — D-046)
   쓰러진 적을 꿰매 아군으로 일으키는 버티기 캐릭터.
     기본 공격 봉합 주사(팔 attackType 'needle'): 바늘이 꽂힌 적에 "봉합" 표식 → 표식이 남은 채 쓰러지면 바닥에 시체가 남음
       꽂힌 적에서 근처 적 둘까지 붉은 실이 이어져 절반 피해 + 표식 (봉합 실)
     팔 스킬 봉합 주사 3연발: 바늘 셋 — 피해 + 짧게 묶음 + 표식
     몸통 스킬 생명 봉인: 앞에 붉은 실 장판 — 안의 적은 묶이고 계속 피해, 표식
     머리 필살기 억지 부활: 시체(모자라면 체력이 가장 낮은 적)를 꿰매 아군으로 일으킴
     다리 패시브 자가 봉합: 내구도가 낮을수록 빨리 회복
   수치는 battle/tuning.js SAINT, 이펙트는 vfx/saintVfx.js. 아군 그림은 쓰러진 적의 그림 + 붉은 실 (enemies_v2.js)
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { SAINT_VFX, BLOOD } from '../vfx/saintVfx.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { SAINT, FOOT_B } from './tuning.js';
import { playImageField } from '../vfx/imageEffects.js';

const solid = e => e.isBuilding || e.isBarricade;
const hitPoint = e => {
    const a = aimOf(e);
    return { x: solid(e) ? e.x + 12 : a.x, b: a.b };
};

export const SaintMethods = {
    // ---- 봉합 표식 ----
    /** 병사에게 봉합 표식 (보스·거점·바리케이드는 없음). 표식이 남은 채 쓰러지면 시체가 됨 */
    markStitch(e, sec = SAINT.markSec) {
        if (!e || solid(e) || e.boss || e.hp <= 0) return;
        const fresh = !(e.stitchT > 0);
        e.stitchT = Math.max(e.stitchT || 0, sec);
        if (fresh) this.updateEnemyFilter(e);
    },

    // ---- 기본 공격·3연발: 바늘 ----
    /** 총구에서 바늘 → 꽂히면 표식 + 피해 (opts.stun: 묶는 시간, opts.link: 근처 적에 봉합 실) */
    fireNeedle(target, dmg, isCrit, opts = {}) {
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 120 };
        let aim = hitPoint(target);
        this.fx.launchNeedle(muzzle, () => {
            if (this.enemies.includes(target)) aim = hitPoint(target);
            return aim;
        }, () => {
            if (!this.isActive) return;
            this.fx.play(SAINT_VFX.needleHit, aim.x, aim.b);
            if (!this.enemies.includes(target)) return;
            this.markStitch(target);   // 먼저 꿰맴 — 이 바늘에 쓰러져도 시체가 남게
            this.dealDamageToEnemy(target, dmg, isCrit, { knock: 0.3, stop: !!opts.stun });
            if (opts.stun && this.enemies.includes(target) && !solid(target)) {
                this.stunEnemy(target, opts.stun);
                this.fx.play(SAINT_VFX.stitchBind, aimOf(target).x, FOOT_B);
            }
            if (opts.link) this.threadLink(aim, target, dmg);
        }, { color: BLOOD, sfx: opts.sfx });
    },

    /** 봉합 실: 꽂힌 자리에서 가까운 다른 적 linkN명까지 실 → 피해 × linkMul + 표식 */
    threadLink(from, target, dmg) {
        this.enemies.filter(e => e !== target && Math.abs(hitPoint(e).x - from.x) <= SAINT.linkRadius)
            .sort((a, c) => Math.abs(hitPoint(a).x - from.x) - Math.abs(hitPoint(c).x - from.x))
            .slice(0, SAINT.linkN)
            .forEach(e => {
                const p = hitPoint(e);
                this.fx.play(SAINT_VFX.threadLink, from.x, from.b, { to: [p.x, p.b] });
                this.markStitch(e);
                this.dealDamageToEnemy(e, dmg * SAINT.linkMul, false, { knock: 0.2 });
            });
    },

    /** [팔 스킬] 봉합 주사 3연발: 가까운 적부터 셋에게 (적이 적으면 돌아가며) */
    tripleNeedle(range) {
        const list = this.enemiesInRange(this.playerRange + range);
        if (!list.length) return;
        for (let i = 0; i < 3; i++) {
            this.schedule(i * SAINT.tripleGap, () => {
                const alive = this.enemiesInRange(this.playerRange + range);
                const t = list.filter(e => alive.includes(e))[i % Math.max(1, list.length)] || alive[0];
                if (t) this.fireNeedle(t, this.unit() * SAINT.tripleDmg, false, { stun: SAINT.tripleStun });
            });
        }
    },

    // ---- 몸통 스킬: 생명 봉인 ----
    lifeSeal() {
        this.seal = { t: SAINT.sealSec, tick: 0 };
        const seal = this.seal;
        playImageField(this.fx, 'seal', SAINT.sealZone[1] - SAINT.sealZone[0], SAINT.sealSec,
            () => [this.frontX() + SAINT.sealDx, FOOT_B], () => this.seal === seal && seal.t > 0, () => seal.t);
        this.fx.play(SAINT_VFX.sealOpen, this.frontX() + SAINT.sealDx, FOOT_B);
        this.fx.setAura('seal', SAINT_VFX.sealField, () => [this.frontX() + SAINT.sealDx, FOOT_B],
            () => this.enemies.filter(e => e.sealed).map(e => ({ key: e.id, x: aimOf(e).x, b: FOOT_B, w: 14 })));
    },

    /** 장판 안: 주인공 앞면 기준 sealZone */
    inSeal(e) {
        const d = aimOf(e).x - this.frontX();
        return d >= SAINT.sealZone[0] && d <= SAINT.sealZone[1];
    },

    endSeal() {
        this.seal = null;
        this.fx.setAura('seal', null);
        this.enemies.forEach(e => { e.sealed = false; });
    },

    // ---- 머리 필살기: 억지 부활 ----
    /** 시체를 먼저, 모자라면 범위 안 체력이 가장 낮은 병사를 꿰매 아군으로 (최대 reviveMax, 아군 상한 allyMax) */
    forcedRevive(range) {
        this.fx.play(SAINT_VFX.reviveCall, this.monsterX + 35, FOOT_B);
        const room = Math.max(0, SAINT.allyMax + (this.kitMod?.('allyMax') || 0) - this.allies.length);   // 2차 세트: 꿰맬 수 있는 아군 +
        let n = Math.min(SAINT.reviveMax, room);
        const corpses = [...this.corpses].sort((a, b) => a.x - b.x).slice(0, n);
        corpses.forEach((c, i) => this.schedule(0.15 + i * 0.12, () => this.raiseCorpse(c)));
        n -= corpses.length;
        if (n <= 0) return;
        this.enemiesInRange(this.playerRange + range).filter(e => !solid(e) && !e.boss)
            .sort((a, b) => a.hp - b.hp).slice(0, n)
            .forEach((e, i) => this.schedule(0.2 + (corpses.length + i) * 0.12, () => {
                if (!this.isActive || !this.enemies.includes(e)) return;
                this.enemies = this.enemies.filter(o => o !== e);   // 산 채로 꿰맴 (보상 없음, 히어로 대세뇌와 같은 규칙)
                if (e.dom) e.dom.remove();
                this.riseAlly(e.x, e.artKey || e.type, e.maxHp, e.dps);
            }));
    },

    raiseCorpse(c) {
        if (!this.isActive || !this.corpses.includes(c)) return;
        this.removeCorpse(c);
        this.riseAlly(c.x, c.type, c.hp, c.dps);
    },

    riseAlly(x, type, hp, dps) {
        if (this.finalBaseDestroyed) return;
        this.fx.play(SAINT_VFX.corpseRise, x + 38, FOOT_B);
        this.schedule(0.35, () => {
            if (!this.isActive || this.finalBaseDestroyed) return;
            this.spawnAllyMinion(x, 'stitch', {
                art: type,
                hp: Math.min(SAINT.allyHpMax, Math.max(SAINT.allyHpMin, hp * SAINT.allyHp)),
                dps: dps * SAINT.allyDps
            });
        });
    },

    // ---- 시체 ----
    /** 봉합 표식이 남은 적이 쓰러지면 (enemyField.onEnemyKilled) 바닥에 실 매듭 시체 */
    addCorpse(e) {
        if (!this.domEnemies) return;
        if (this.corpses.length >= SAINT.corpseMax) this.removeCorpse(this.corpses[0]);
        const el = document.createElement('div');
        el.className = 'v2-corpse';
        el.style.left = `${e.x + 14}px`;
        this.domEnemies.appendChild(el);
        this.corpses.push({ x: e.x, type: e.artKey || e.type, hp: e.maxHp, dps: e.dps, t: SAINT.corpseSec, dom: el });
        this.fx.play(SAINT_VFX.corpseStitch, e.x + 38, FOOT_B);
    },

    removeCorpse(c) {
        this.corpses = this.corpses.filter(o => o !== c);
        if (!c.dom) return;
        c.dom.classList.add('is-fading');
        setTimeout(() => c.dom.remove(), 400);
    },

    /** 걷는 동안 시체도 바닥과 같이 흘러감 (화면 밖으로 나가면 사라짐) */
    scrollCorpses(dt) {
        [...this.corpses].forEach(c => {
            c.x -= this.groundSpeed() * dt;
            if (c.dom) c.dom.style.left = `${c.x + 14}px`;
            if (c.x < -80) this.removeCorpse(c);
        });
    },

    /** 매 프레임: 표식 시간, 생명 봉인 장판, 시체 시간, 자가 봉합 */
    tickSaint(dt) {
        this.enemies.forEach(e => {
            if (e.stitchT > 0) {
                e.stitchT -= dt;
                if (e.stitchT <= 0) this.updateEnemyFilter(e);
            }
        });
        if (this.seal) {
            this.seal.t -= dt;
            this.seal.tick -= dt;
            const tick = this.seal.tick <= 0;
            if (tick) {
                this.seal.tick = SAINT.sealTick;
                this.fx.pulseAura('seal');
            }
            [...this.enemies].forEach(e => {
                const inside = !e.isBuilding && this.inSeal(e);
                e.sealed = inside;
                if (!inside) return;
                this.dealDamageToEnemy(e, this.unit() * SAINT.sealDps * dt, false, { dot: true });
                if (tick && this.enemies.includes(e)) {
                    this.markStitch(e, SAINT.markSec);
                    if (!e.boss && !e.isBarricade) this.stunEnemy(e, SAINT.sealTick + 0.15);   // 실에 묶여 못 움직임
                    this.fx.play(SAINT_VFX.sealTick, aimOf(e).x, FOOT_B);
                }
            });
            if (this.seal.t <= 0) this.endSeal();
        }
        if (this.corpses.length) {
            [...this.corpses].forEach(c => {
                c.t -= dt;
                if (c.t <= 0) this.removeCorpse(c);
            });
        }
        const regen = SAINT.regen[this.equippedLegId];
        if (regen && this.overloadT <= 0 && this.playerHp > 0 && this.playerHp < this.maxPlayerHp) {
            const missing = 1 - this.playerHp / this.maxPlayerHp;
            const heal = this.maxPlayerHp * (regen.base + regen.k * missing) * dt;
            this.healPlayer(heal);
            this.stitchHealAcc = (this.stitchHealAcc || 0) + heal;
            this.stitchHealT = (this.stitchHealT || 0) + dt;
            if (this.stitchHealT >= 1) {
                if (this.stitchHealAcc >= 1) {
                    this.createDamagePopup(this.monsterX + 40, 180, `+${Math.round(this.stitchHealAcc)} 봉합 회복`, false);
                    this.fx.play(SAINT_VFX.selfStitch, this.monsterX + 35, FOOT_B, { follow: () => [this.monsterX + 35, FOOT_B] });
                }
                this.stitchHealT = 0;
                this.stitchHealAcc = 0;
            }
        }
    }
};
