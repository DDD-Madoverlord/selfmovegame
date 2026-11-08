/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 주인공 공격과 스킬 (v2)
   기본 공격(근접 휩쓸기·레이저·어둠 파동·유도 미사일·물줄기·주사 바늘·서리 부채·가위 참격), 스킬 공용 기능(사거리 안의 적, 예약 실행,
   쿨다운·필살기 게이지·자동 사용), 스킬이 쓰는 효과(드론, 실드). 스킬 정의는 skills_v2.js.
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { gameTime } from '../gameTime.js';
import { sound } from '../audio/sound_v2.js';
import { HERO_WAVE } from '../vfx/heroVfx.js';
import { HERO_VFX, MECH_VFX, meleeHitVfx } from '../vfx/vfxDefs.js';
import { hasTarget, ULT_FILL } from '../skills_v2.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { HERO, DRONE, MELEE_CLEAVE, SET } from './tuning.js';

// 근접 휩쓸기를 팔마다 다르게 (타락 기사 대검은 넓게, D-050)
const CLEAVE_BY_ARM = { arm_hero_a: SET.greatsword };

export const SKILL_AUTO_KEY = 'mo_v2_auto_skill';

export const AttackMethods = {
    // 공격 이펙트 / 투사체 생성
    // hitScale: 기본 1타 대비 피해 비율 (리그 캐논은 연사 1발당 0.2)
    fireAttack(targetEnemy, hitScale = 1) {
        if (!targetEnemy || !this.domProjectiles) return;
        this.ultGauge = Math.min(1, this.ultGauge + ULT_FILL.perHit * hitScale * this.kitUltRate());

        // 거대로봇 리그면 실제 총구 위치에서 발사, 아니면 기존 고정 위치
        const muzzle = monsterControllerV2.getMuzzlePoint();
        const monsterFireX = muzzle ? muzzle.x : this.monsterX + 90;
        const dmg = this.playerDps * 0.5 * hitScale * this.dmgMul() * this.kitOnAttack(targetEnemy);   // 세트 버프·패시브 (battle/sets.js) · 2차 다음 공격 배율·N번째 덤 (kit.js)
        const isCrit = Math.random() < 0.2;
        const finalDmg = isCrit ? dmg * 1.5 : dmg;
        this.cloneEcho(targetEnemy, finalDmg);   // 그림자 분신이 있으면 같이 쏨

        // 2차 세트 새 기본 공격 · 변신 공격 (battle/kit.js)
        if ((this.attackType === 'kit' || this.kitXform?.attack) && this.fireKitAttack(targetEnemy, finalDmg, isCrit)) return;
        // A·B 세트 새 기본 공격 4종 (battle/sets.js)
        if (this.attackType === 'rail') return this.fireRail(targetEnemy, finalDmg, isCrit);
        if (this.attackType === 'spit') return this.fireSpit(targetEnemy, finalDmg, isCrit);
        if (this.attackType === 'orb') return this.fireDarkOrb(targetEnemy, finalDmg, isCrit);
        if (this.attackType === 'shotgun') return this.fireShotgun(targetEnemy, finalDmg, isCrit);

        if (this.attackType === 'laser') {
            // 초장거리 포격: 총구 → 적 몸통 중앙 보라 광선
            const from = muzzle || { x: monsterFireX, bottom: 120 };
            const aim = aimOf(targetEnemy);
            this.fx.play(MECH_VFX.laser, from.x, from.bottom, { to: [aim.x, aim.b] });
            this.dealDamageToEnemy(targetEnemy, finalDmg, isCrit, { knock: 0.3, delivery: 'ranged', area: false });
        }
        else if (this.attackType === 'wave') {
            // 어둠 파동: 칼을 휘두른 타격 순간 파동 발사 (피해는 파동이 적을 지날 때)
            this.launchDarkWave(monsterFireX, finalDmg, isCrit);
        }
        else if (this.attackType === 'water') {
            // 고압 방수포 (심연의 길잡이): 사거리 안 적을 꿰뚫는 물줄기 (battle/diver.js)
            this.fireWaterJet(targetEnemy, finalDmg, isCrit);
        }
        else if (this.attackType === 'needle') {
            // 봉합 주사 (봉합 성녀): 바늘이 꽂힌 적에 봉합 표식 (battle/saint.js)
            this.fireNeedle(targetEnemy, finalDmg, isCrit, { link: true });
        }
        else if (this.attackType === 'frost') {
            // 서리 부채 (서리의 무희): 작은 서리 초승달, 냉기 (battle/frost.js)
            this.fireFrostFan(targetEnemy, finalDmg, isCrit);
        }
        else if (this.attackType === 'scissors') {
            // 가위 참격 (뒤틀린 인형사): 방어 일부 무시 + 휩쓸기 (battle/doll.js)
            this.snipScissors(targetEnemy, finalDmg, isCrit, hitScale);
        }
        else if (this.attackType === 'missile') {
            // 유도 미사일: 포물선으로 날아가 폭발 (목표가 먼저 쓰러지면 마지막 위치에 떨어짐)
            this.fireMissile(targetEnemy, finalDmg * 1.2, {}, isCrit);
        }
        else {
            // 캐릭터별 타격 이펙트 (로봇 주먹 / 괴수 물기 / 히어로 베기 / 합성괴인 주먹·클로 / 페이퍼돌 기본 베기)
            const aim = aimOf(targetEnemy);
            this.fx.play(meleeHitVfx(monsterControllerV2.getCharacterId(), this.equippedArmId), aim.x, aim.b + 5);
            const cleave = CLEAVE_BY_ARM[this.equippedArmId] || MELEE_CLEAVE;
            const near = this.enemies.filter(o => o !== targetEnemy && !o.isBuilding && Math.abs(o.x - targetEnemy.x) <= cleave.radius);
            this.dealDamageToEnemy(targetEnemy, finalDmg * MELEE_CLEAVE.dmg, isCrit, { knock: 1, stop: hitScale >= 1 });   // 근접 주 대상 피해 상향 (11-03)
            near.forEach(o => this.dealDamageToEnemy(o, finalDmg * cleave.mul, false, { knock: 0.6 }));
            if (this.equippedArmId === 'arm_mutant') this.applyAcid(targetEnemy);   // 산성 이빨
        }
    },

    // [타락 히어로 팔] 어둠 파동: 칼끝에서 초승달 파동이 앞으로 날아가며 지나가는 적 전부에게 피해 + 감속
    // 거점·바리케이드는 앞면(왼쪽 끝)에 닿으면 맞음 — 가운데로 판정하면 넓은 거점 그림(벙커 217px 등)에는 사거리 끝에서 파동이 닿지 않아
    // 기본 공격이 거점에 안 들어갔음 (2026-10-03 발견)
    launchDarkWave(fromX, dmg, isCrit) {
        const hit = new Set();
        let mul = 1;   // 관통할수록 약해짐
        this.fx.launchWave({
            x: fromX, b: 88, range: Math.max(this.playerRange, HERO.waveRange), speed: HERO_WAVE.speed,
            h: HERO_WAVE.h, color: HERO_WAVE.color,
            onPass: (x0, x1) => {
                [...this.enemies].forEach(e => {
                    const solid = e.isBuilding || e.isBarricade;
                    const cx = solid ? e.x + 12 : aimOf(e).x;
                    if (cx < x0 || cx > x1 || hit.has(e)) return;
                    hit.add(e);
                    this.fx.play(HERO_VFX.waveHit, cx, 88);
                    if (!solid) this.slowEnemy(e);
                    this.dealDamageToEnemy(e, dmg * mul * (solid ? HERO.waveBaseMul : 1), isCrit, { knock: 0.6, delivery: 'ranged', area: true });
                    mul *= HERO.wavePierce;
                });
            }
        });
    },

    // 유도 미사일 1발 (기본 공격/미사일 일제 사격 공용)
    fireMissile(targetEnemy, dmg, opts = {}, isCrit = false) {
        const muzzle = monsterControllerV2.getMuzzlePoint();
        const from = muzzle || { x: this.monsterX + 90, bottom: 130 };
        let aim = aimOf(targetEnemy);
        this.fx.launchMissile(from, () => {
            if (this.enemies.includes(targetEnemy)) aim = aimOf(targetEnemy);
            return aim;
        }, () => {
            this.fx.play(MECH_VFX.missileBlast, aim.x, aim.b);
            if (!this.isActive) return;
            if (this.enemies.includes(targetEnemy)) {
                this.dealDamageToEnemy(targetEnemy, dmg, isCrit, { knock: 0.8, delivery: 'ranged', area: true });
            }
            [...this.enemies].forEach(other => {
                if (other !== targetEnemy && Math.abs(other.x - targetEnemy.x) < 90) {
                    this.dealDamageToEnemy(other, dmg * 0.45, false, { knock: 0.5, delivery: 'ranged', area: true });
                }
            });
        }, { dur: 0.5, apex: 55, ...opts });
    },

    // [거대로봇 머리 필살기 '스웜 드론 총출격'] 캐니스터 발사구에서 드론 → 가까운 적부터 돌진 폭발 (범위 피해)
    launchDrones(count) {
        const ahead = this.enemies.filter(e => e.x > this.monsterX).sort((a, b) => a.x - b.x);
        const from = monsterControllerV2.getSocketPoint('droneBay', 'canister') || { x: this.monsterX + 40, bottom: 230 };
        for (let i = 0; i < count; i++) {
            let target = ahead[i % Math.max(1, ahead.length)];
            this.fx.launchDrone({
                from: { x: from.x, b: from.bottom },
                index: (i % 3),
                delay: Math.floor(i / 3) * 0.25,
                getTarget: () => {
                    if (!this.enemies.includes(target)) {
                        target = this.enemies.filter(e => e.x > this.monsterX).sort((a, b) => a.x - b.x)[0];
                    }
                    return target ? aimOf(target) : null;
                },
                onHit: pos => {
                    const dmg = this.playerDps * DRONE.dmgMul;
                    [...this.enemies].forEach(e => {
                        const d = Math.abs(aimOf(e).x - pos.x);
                        if (d < DRONE.splash) this.dealDamageToEnemy(e, e === target ? dmg : dmg * 0.5, false, { knock: 0.8, delivery: 'ranged', area: true });
                    });
                }
            });
        }
    },

    // [반사 실드] 최대 체력 ratio만큼 흡수하는 실드를 sec초 동안
    applyShield(ratio, sec, color) {
        this.shieldHp = Math.max(this.shieldHp, this.maxPlayerHp * ratio);
        this.shieldTimer = sec;
        this.shieldDuration = sec;
        monsterControllerV2.shieldOn(color);
        sound.play('shield_on');
        this.createDamagePopup(this.monsterX + 40, 210, '⬢ 실드 전개', false);
    },

    // ---- 스킬 시스템 공용 ----
    /** 전투 시간(일시정지/배속/히트스톱 반영)으로 sec초 뒤 fn 실행 */
    schedule(sec, fn) {
        this.timers.push({ t: sec, fn });
    },

    tickTimers(dt) {
        if (!this.timers.length) return;
        const due = [];
        for (const tm of this.timers) {
            tm.t -= dt;
            if (tm.t <= 0) due.push(tm);
        }
        this.timers = this.timers.filter(tm => tm.t > 0);
        due.forEach(tm => tm.fn());
    },

    frontX() {
        return this.monsterX + 100;
    },

    /** 기본 공격 1타 피해 (세트 버프·패시브 배율 포함 — 스킬 피해의 기준) */
    unit() {
        return this.playerDps * 0.5 * this.dmgMul();
    },

    /** 몬스터 앞 range 안의 적 (가까운 순) */
    enemiesInRange(range) {
        const fx = this.frontX();
        return this.enemies.filter(e => e.x - fx >= -60 && e.x - fx <= range).sort((a, b) => a.x - b.x);
    },

    nearestEnemy(extra = 0) {
        return this.enemiesInRange(this.playerRange + extra)[0] || null;
    },

    /** 슬롯 스킬 사용 가능 여부: { ready, hasTarget } */
    skillState(slot) {
        const sk = this.skills[slot];
        if (!sk) return { ready: false, hasTarget: false };
        const ready = sk.ult ? this.ultGauge >= 1 : this.skillCd[slot] <= 0;
        return { ready, hasTarget: hasTarget(this, sk) };
    },

    /** 스킬 사용 (버튼/단축키/자동). 성공하면 true */
    useSkill(slot) {
        const sk = this.skills[slot];
        if (!this.isActive || this.cinematic || this.finalBaseDestroyed || !sk || gameTime.paused || this.playerStunned()) return false;
        const st = this.skillState(slot);
        if (!st.ready || !st.hasTarget) return false;
        if (sk.ult) this.ultGauge = 0;
        else this.skillCd[slot] = this.skillCooldown(slot, sk);   // 스킬 레벨·재충전·과부하 변이 (growth.js)
        sk.use(sk.module ? this : this.skillCaster(slot));         // 스킬 레벨 피해 배율 (growth.js)
        if (!sk.module) this.kitOnSkill(sk);                        // 2차 패시브·세트 계기 (kit.js)
        if (!sk.ult) sound.play('skill_use');
        this.hud.onSkillUsed(slot, sk);
        return true;
    },

    setAutoSkills(on) {
        this.autoSkills = on;
        try { localStorage.setItem(SKILL_AUTO_KEY, on ? '1' : '0'); } catch (e) { /* 저장 불가 환경 */ }
    },

    tickSkills(dt) {
        const cdDt = dt * this.kitCdRate();   // 2차: 쿨다운이 빨리 줄어드는 버프 (kit.js)
        for (const slot in this.skillCd) this.skillCd[slot] = Math.max(0, this.skillCd[slot] - (slot.startsWith('mod') ? dt : cdDt));   // 팔·몸통 + 전술 모듈 mod1·mod2
        this.ultGauge = Math.min(1, this.ultGauge + ULT_FILL.perSec * dt * this.kitUltRate());
        if (this.shieldTimer !== Infinity) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldTimer = Infinity;
                if (this.shieldHp > 0) {
                    this.shieldHp = 0;
                    monsterControllerV2.shieldOff();
                }
            }
        }
        if (this.autoSkills) {
            for (const slot of ['arm', 'body', 'head']) this.useSkill(slot);
            // 전술 모듈은 쓸 상황일 때만 (모듈마다 auto 조건 — growth.js)
            for (const slot of ['mod1', 'mod2']) if (this.skills[slot]?.auto(this) && this.skillCd[slot] <= 0) this.useSkill(slot);
        }
    }
};
