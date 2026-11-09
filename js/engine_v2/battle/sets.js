/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 기존 4종 A·B 세트 (v2, D-050 파츠 확장 1차)
   새 파츠 32개가 쓰는 전투 기능 (기획안 4장 "새로 만드는 기능 묶음"):
     새 기본 공격 4종 (레일건 관통 탄 · 산성 침 · 암흑 구체 · 산탄), 일정 시간 강화(버프),
     지속 피해 구역 (독안개 · 화염 · 산성 웅덩이), 가시 독·저주 지속 피해, 속박, 블랙홀, 자동 포탑, 그림자 분신, 돌진,
     다리 패시브 8종 (포격 고정 · 자기장 방벽 · 단단한 껍질 · 질주 본능 · 불굴 · 그림자 회피 · 짓밟기 · 졸개 지휘),
     레어 세트 4부위 효과 (Q-008, sets_v2.js — 켜졌는지는 this.setOn(세트 id), 수치는 SET.setBonus)
   스킬 정의는 skills_v2.js, 수치는 battle/tuning.js SET, 이펙트는 vfx/setVfx.js.
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { playImageField } from '../vfx/imageEffects.js';
import { sound } from '../audio/sound_v2.js';
import { SET_VFX } from '../vfx/setVfx.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { SET, FOOT_B } from './tuning.js';

const ACID_RGB = '160, 255, 50';
const DARK_RGB = '200, 110, 255';

export const SetMethods = {
    /** 전투 시작마다 (battle_v2.js startBattle) */
    resetSetState() {
        this.buffs = {};
        this.zones = [];
        this.turretT = 0;
        this.turretCd = 0;
        this.clonesT = 0;
        this.blackHole = null;
        this.isAttacking = false;
        this.setFx = {};          // 이펙트·알림이 너무 자주 나오지 않게 (이름 → 남은 초)
        this.drainAcc = 0;
        monsterControllerV2.setClones(0);
        monsterControllerV2.setAnimBoost(1);
    },

    /** 매 프레임: 버프·구역·지속 피해·블랙홀·포탑·분신·패시브 표시 */
    tickSets(dt) {
        for (const k of Object.keys(this.setFx)) this.setFx[k] -= dt;
        this.tickSetBuffs(dt);
        this.tickZones(dt);
        this.tickSetDots(dt);
        this.tickBlackHole(dt);
        this.tickTurret(dt);
        this.tickClones(dt);
        this.tickSetPassiveFx();
    },

    /** name 이펙트가 every초 안에 이미 나왔으면 false (나올 차례면 true로 표시하고 시간 기록) */
    setFxReady(name, every) {
        if (this.setFx[name] > 0) return false;
        this.setFx[name] = every;
        return true;
    },

    // ---- 버프 (오버드라이브·아드레날린·가시 갑옷·어둠의 서약·총동원령·강화 주사) ----
    addBuff(key, sec) {
        this.buffs[key] = { t: sec, duration: sec };
        if (key === 'overdrive') monsterControllerV2.setAnimBoost(SET.overdrive.atk);   // 공격 동작이 빨라짐 = 공격 속도
    },

    tickSetBuffs(dt) {
        for (const [key, b] of Object.entries(this.buffs)) {
            b.t -= dt;
            if (b.t > 0) continue;
            delete this.buffs[key];
            if (key === 'overdrive') monsterControllerV2.setAnimBoost(1);
        }
    },

    /** 주인공이 주는 피해 배율 (기본 공격·스킬 모두: attacks.js unit()·fireAttack) */
    dmgMul() {
        let m = this.kitDmgMul();   // 2차 버프·패시브·세트 (battle/kit.js)
        if (this.buffs.adrenaline) m *= 1 + SET.adrenaline.dmg;
        if (this.equippedLegId === 'leg_mech_a' && this.isAttacking) m *= 1 + SET.anchor.dmg;
        if (this.equippedLegId === 'leg_chimera_b') m *= 1 + SET.commander.perAlly * Math.min(SET.commander.max, this.allies.length);
        return m;
    },

    /** 주인공이 받는 피해 배율 (player.js damagePlayer) */
    incomingMul() {
        let m = this.kitIncomingMul();   // 2차 버프·패시브·세트 (battle/kit.js)
        if (this.buffs.thornArmor) m *= 1 - SET.thorn.reduce;
        if (this.buffs.overdrive) m *= 1 - SET.overdrive.reduce;
        if (this.equippedLegId === 'leg_kaiju_a') m *= 1 - SET.shell.reduce;
        if (this.equippedLegId === 'leg_hero_a' && this.playerHp < this.maxPlayerHp * SET.indomitable.below) m *= 1 - SET.indomitable.reduce;
        return m;
    },

    /**
     * 받는 피해에 세트 효과 적용 (실드 전): 그림자 회피·감소·가시 되돌림·껍질 조각
     * @param amount 피해, dt 지속 피해면 프레임 시간(0이면 한 방), src 때린 적(근접)
     */
    setIncoming(amount, dt, src) {
        if (amount <= 0) return amount;
        amount = this.kitIncoming(amount, dt, src);   // 2차: 무적·막기·회피·약화된 적 (battle/kit.js)
        if (amount <= 0) return 0;
        if (this.equippedLegId === 'leg_hero_b') {
            // 그림자 회피: 한 방은 확률로 통째로 무시, 계속 맞는 근접 피해는 같은 기댓값으로 깎음 (프레임마다 굴리면 들쭉날쭉)
            if (dt > 0) amount *= 1 - SET.dodge.chance;
            else if (Math.random() < SET.dodge.chance) {
                this.fx.play(SET_VFX.dodge, this.monsterX + 35, FOOT_B);
                this.createDamagePopup(this.monsterX + 40, 200, '회피!', false);
                return 0;
            }
            if (this.setFxReady('dodge', 0.7)) this.fx.play(SET_VFX.dodge, this.monsterX + 35, FOOT_B);
        }
        if (this.buffs.thornArmor && src && !src.isBuilding && this.enemies.includes(src)) {
            const reflect = this.setOn('kaiju_a') ? SET.setBonus.thornReflect : SET.thorn.reflect;   // 가시 갑각 4부위
            this.dealDamageToEnemy(src, amount * reflect, false, { dot: true });   // 나를 때린 적에게 되돌림
            if (this.setFxReady('thorn', 0.35)) this.fx.play(SET_VFX.thornReflect, aimOf(src).x - 10, aimOf(src).b);
        }
        if (this.equippedLegId === 'leg_kaiju_a' && this.setFxReady('shell', 0.6)) this.fx.play(SET_VFX.shellChip, this.monsterX + 70, 110);
        return amount * this.incomingMul();
    },

    /** 원거리 공격(마취탄·그물·오물·자석) 피해·효과 배율: 자기장 방벽 다리면 절반 (enemies_v2.js) */
    rangedMul() {
        if (this.kitFlag('projBlock')) {   // 2차 세트: 강철 방벽·방주 방벽·전자기 펄스 — 투사체를 막음 (battle/kit.js)
            if (this.setFxReady('projBlock', 0.3)) this.fx.play(SET_VFX.magField, this.monsterX + 60, 110);
            return 0;
        }
        const cut = this.kitMod('rangedCut');   // 2차 세트 성운 장막: 원거리 피해·효과 감소
        if (cut > 0) return Math.max(0, 1 - cut) * (this.equippedLegId === 'leg_mech_b' ? 1 - SET.magField.reduce : 1);
        if (this.equippedLegId !== 'leg_mech_b') return 1;
        if (this.setFxReady('magField', 0.3)) this.fx.play(SET_VFX.magField, this.monsterX + 60, 110);
        return 1 - SET.magField.reduce;
    },

    /** 진격 속도 배율 (player.js moveMul): 오버드라이브, 질주 본능(앞에 적이 없을 때) */
    moveBuffMul() {
        let m = this.kitMoveMul();   // 2차 버프·패시브 (battle/kit.js)
        if (this.buffs.overdrive) m *= 1 + SET.overdrive.move;
        if (this.buffs.thornArmor && this.setOn('kaiju_a')) m *= 1 + SET.setBonus.thornMove;   // 가시 갑각 4부위
        if (this.equippedLegId === 'leg_kaiju_b' && !this.enemiesInRange(this.playerRange + SET.sprint.clear).length) {
            m *= 1 + SET.sprint.move;
            if (this.setFxReady('sprint', 0.15)) this.fx.play(SET_VFX.sprintTrail, this.monsterX - 10, FOOT_B);
        }
        return m;
    },

    /** 아군 졸개 피해 배율 (allies.js): 총동원령 ×2, 강화 주사 ×1.5 */
    allyDmgMul() {
        let m = this.kitAllyMul();   // 2차 버프 (battle/kit.js)
        if (this.buffs.mobilize) m *= SET.mobilize.allyMul;
        if (this.buffs.boost) m *= SET.boost.allyMul;
        return m;
    },

    /** 어둠의 서약(예전 이름 피의 서약): 직접 준 피해의 20% 회복 (enemyField.js dealDamageToEnemy) */
    lifesteal(damage) {
        if (!this.buffs.bloodOath || damage <= 0 || this.overloadT > 0) return;
        const heal = damage * SET.blood.ratio;
        this.healPlayer(heal);
        this.drainAcc += heal;
        if (this.setFxReady('drain', 0.5)) {
            this.fx.play(SET_VFX.bloodDrain, this.monsterX + 40, 120);
            this.createDamagePopup(this.monsterX + 40, 180, `+${Math.round(this.drainAcc)} 회복`, false);
            this.drainAcc = 0;
        }
    },

    // ---- 새 기본 공격 4종 (attacks.js fireAttack이 attackType으로 부름) ----
    /** [레일건] 일직선 관통 탄: 사거리 안 적을 모두 꿰뚫음, 뒤로 갈수록 × pierce */
    fireRail(target, dmg, isCrit) {
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 120 };
        const aim = aimOf(target);
        const endX = this.frontX() + this.playerRange + SET.rail.extra;
        this.fx.play(SET_VFX.railShot, muzzle.x, muzzle.bottom, { to: [endX, aim.b] });
        let mul = 1;
        this.enemiesInRange(this.playerRange + SET.rail.extra).forEach((e, i) => {
            this.fx.play(SET_VFX.railHit, aimOf(e).x, aimOf(e).b);
            this.dealDamageToEnemy(e, dmg * mul, isCrit && i === 0, { knock: 0.4 });
            mul *= SET.rail.pierce;
        });
    },

    /** [산성 침] 포물선 산성 방울 → 맞은 자리에 작은 산성 웅덩이 */
    fireSpit(target, dmg, isCrit) {
        const from = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 130 };
        let aim = aimOf(target);
        this.fx.launchOrb(from, () => {
            if (this.enemies.includes(target)) aim = aimOf(target);
            return aim;
        }, ACID_RGB, 0.45, () => {
            if (!this.isActive) return;
            this.fx.play(SET_VFX.spitSplash, aim.x, FOOT_B);
            if (this.enemies.includes(target)) this.dealDamageToEnemy(target, dmg, isCrit, { knock: 0.5 });
            const w = SET.spit.puddleW;
            this.addZone({ x: aim.x - w / 2, w, sec: SET.spit.puddleSec, dps: this.playerDps * SET.spit.puddleDps, field: 'acid',
                baseMul: this.setOn('kaiju_b') ? SET.setBonus.toxicBaseMul : 1 });   // 독안개 4부위: 거점 2배
        }, 'kaiju_spore');
    },

    /** [암흑 구체] 적을 따라가 폭발 (작은 범위) */
    fireDarkOrb(target, dmg, isCrit, from = null) {
        from = from || monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 130 };
        let aim = aimOf(target);
        this.fx.launchOrb(from, () => {
            if (this.enemies.includes(target)) aim = aimOf(target);
            return aim;
        }, DARK_RGB, 0.4, () => {
            if (!this.isActive) return;
            this.fx.play(SET_VFX.orbBlast, aim.x, aim.b);
            [...this.enemies].forEach(e => {
                if (e === target) this.dealDamageToEnemy(e, dmg, isCrit, { knock: 0.5 });
                else if (Math.abs(aimOf(e).x - aim.x) < SET.orb.splash) this.dealDamageToEnemy(e, dmg * SET.orb.splashMul, false, { knock: 0.3 });
            });
        }, 'hero_orb');
    },

    /** [산탄] 가까운 부채꼴 여러 적: 가장 가까운 적은 그대로, 나머지는 × mul */
    fireShotgun(target, dmg, isCrit) {
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 120 };
        this.fx.play(SET_VFX.shotgunBlast, muzzle.x, muzzle.bottom);
        const list = this.enemiesInRange(this.playerRange).slice(0, SET.shotgun.max);
        if (!list.includes(target)) list.unshift(target);
        list.slice(0, SET.shotgun.max).forEach((e, i) => {
            const a = aimOf(e);
            this.fx.play(SET_VFX.pellet, a.x, a.b + (i % 2 ? 12 : -8));
            this.dealDamageToEnemy(e, i === 0 ? dmg : dmg * SET.shotgun.mul, isCrit && i === 0, { knock: 0.6 });
        });
    },

    // ---- 지속 피해 구역 (독안개 숨결·화염 방사·산성 웅덩이) ----
    /** o: { x, w, sec, dps, slow?, puff(이펙트), every(퍼프 간격), scale?, baseMul?(거점 배율) } — x~x+w 안 적에게 초당 dps */
    addZone(o) {
        const z = { puffT: 0, ...o, t: o.sec };
        this.zones.push(z);
        if (o.field) playImageField(this.fx, o.field, z.w, z.sec, () => [z.x + z.w / 2, FOOT_B],
            () => z.t > 0 && this.zones.includes(z), () => z.t);
    },

    tickZones(dt) {
        if (!this.zones.length) return;
        this.zones = this.zones.filter(z => {
            z.t -= dt;
            if (z.t <= 0) return false;
            z.puffT -= dt;
            if (z.puff && z.puffT <= 0) {
                z.puffT = z.every || 0.35;
                this.fx.play(z.puff, z.x + Math.random() * z.w, FOOT_B + 10, { scale: z.scale || 1 });
            }
            [...this.enemies].forEach(e => {
                const cx = aimOf(e).x;
                if (cx < z.x || cx > z.x + z.w) return;
                if (z.slow && !e.isBuilding && !e.isBarricade) {
                    const fresh = !(e.slowT > 0);
                    e.slowT = Math.max(e.slowT || 0, 0.5);
                    if (fresh) this.updateEnemyFilter(e);
                }
                this.dealDamageToEnemy(e, z.dps * (e.isBuilding ? (z.baseMul || 1) : 1) * dt, false, { dot: true });
            });
            return true;
        });
    },

    /** 걷는 동안 구역도 바닥과 같이 흘러감 (battle_v2.js tickAdvance) */
    scrollZones(dt) {
        this.zones.forEach(z => { z.x -= this.groundSpeed() * dt; });
        if (this.blackHole) this.blackHole.x -= this.groundSpeed() * dt;
    },

    // ---- 가시 독(가시 폭풍, 예전 이름 출혈)·저주(저주의 사슬) 지속 피해, 속박 ----
    applyBleed(e, sec, dps, kind = 'bleed') {
        if (!e || e.hp <= 0) return;
        const fresh = !(e.bleedT > 0);
        e.bleedT = Math.max(e.bleedT || 0, sec);
        e.bleedDps = Math.max(fresh ? 0 : e.bleedDps || 0, dps);
        e.bleedKind = kind;
        if (fresh) this.updateEnemyFilter(e);
    },

    rootEnemy(e, sec) {
        if (!e || e.isBuilding) return;
        const fresh = !(e.rootT > 0);
        e.rootT = Math.max(e.rootT || 0, sec);
        if (fresh) this.updateEnemyFilter(e);
    },

    tickSetDots(dt) {
        [...this.enemies].forEach(e => {
            if (e.rootT > 0) {
                e.rootT -= dt;
                if (e.rootT <= 0) this.updateEnemyFilter(e);
            }
            if (!(e.bleedT > 0)) return;
            e.bleedT -= dt;
            e.bleedFx = (e.bleedFx || 0) + dt;
            if (e.bleedFx >= 0.5) {
                e.bleedFx = 0;
                this.fx.play(e.bleedKind === 'curse' ? SET_VFX.chainTick : SET_VFX.bleedTick, aimOf(e).x, aimOf(e).b);
            }
            this.dealDamageToEnemy(e, e.bleedDps * dt, false, { dot: true });
            if (e.bleedT <= 0 && this.enemies.includes(e)) this.updateEnemyFilter(e);
        });
    },

    // ---- 블랙홀 (그림자 마도사 팔): radius 안 적을 한곳으로 끌어당기며 피해 ----
    startBlackHole(x, sec) {
        this.blackHole = { x, t: sec, fxT: 0 };
    },

    tickBlackHole(dt) {
        const h = this.blackHole;
        if (!h) return;
        h.t -= dt;
        h.fxT -= dt;
        if (h.fxT <= 0) {
            h.fxT = 0.5;
            this.fx.play(SET_VFX.blackHole, h.x, 100);
        }
        [...this.enemies].forEach(e => {
            const d = h.x - aimOf(e).x;
            if (Math.abs(d) > SET.blackHole.radius) return;
            if (!e.isBuilding && !e.isBarricade && !e.boss && e.dom) {   // 거점·보스는 끌려오지 않고 피해만
                e.x += Math.sign(d) * Math.min(Math.abs(d), SET.blackHole.pull * dt);
                e.dom.style.left = `${e.x}px`;
            }
            this.dealDamageToEnemy(e, this.playerDps * SET.blackHole.dps * dt, false, { dot: true });
        });
        if (h.t <= 0) {
            this.fx.play(SET_VFX.blackHoleEnd, h.x, 100);
            this.blackHole = null;
        }
    },

    // ---- 자동 포탑 (포격 사령부 몸통): 어깨 포탑이 가장 가까운 적을 연사 ----
    turretPoint() {
        return monsterControllerV2.getSocketPoint('droneBay', 'canister') || { x: this.monsterX + 40, bottom: 230 };
    },

    startTurret(sec) {
        this.turretT = sec;
        this.turretCd = 0;
        const p = this.turretPoint();
        this.fx.play(SET_VFX.turretOn, p.x, p.bottom);
    },

    tickTurret(dt) {
        if (!(this.turretT > 0)) return;
        this.turretT -= dt;
        this.turretCd -= dt;
        if (this.turretCd > 0 || this.playerStunned()) return;
        this.turretCd = SET.turret.every;
        const t = this.nearestEnemy(SET.turret.range);
        if (!t) return;
        const p = this.turretPoint();
        const a = aimOf(t);
        this.fx.play(SET_VFX.turretShot, p.x, p.bottom, { to: [a.x, a.b] });
        sound.play('mech_laser', { rate: 2.2, vol: 0.35 });
        this.dealDamageToEnemy(t, this.unit() * SET.turret.dmg, false, { knock: 0.2 });
    },

    // ---- 그림자 분신 (그림자 마도사 머리): 반투명 분신 2명이 기본 공격을 같이 쏨 ----
    /** 분신 수: 2명, 그림자 마도사 4부위면 3명 */
    cloneCount() {
        return SET.clones.count + (this.setOn('hero_b') ? SET.setBonus.clonesExtra : 0);
    },

    startClones(sec) {
        this.clonesT = sec;
        this.clonesN = this.cloneCount();
        monsterControllerV2.setClones(this.clonesN, SET.clones.gap);
        for (let i = 1; i <= this.clonesN; i++) this.fx.play(SET_VFX.clonePoof, this.monsterX + 35 - SET.clones.gap * i, FOOT_B);
    },

    tickClones(dt) {
        if (!(this.clonesT > 0)) return;
        this.clonesT -= dt;
        if (this.clonesT > 0) return;
        monsterControllerV2.setClones(0);
        for (let i = 1; i <= (this.clonesN || SET.clones.count); i++) this.fx.play(SET_VFX.clonePoof, this.monsterX + 35 - SET.clones.gap * i, FOOT_B);
    },

    /** 기본 공격 1타마다 분신도 같이 쏨 (분신 자리에서 암흑 구체, 피해 × mul) */
    cloneEcho(target, dmg) {
        if (!(this.clonesT > 0) || !target) return;
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 130 };
        for (let i = 1; i <= (this.clonesN || SET.clones.count); i++) {
            this.schedule(0.06 * i, () => {
                if (this.isActive && this.enemies.includes(target)) {
                    this.fireDarkOrb(target, dmg * SET.clones.mul, false, { x: muzzle.x - SET.clones.gap * i, bottom: muzzle.bottom });
                }
            });
        }
    },

    // ---- 돌진 (로켓 돌진·광견 돌진) ----
    /** dist px를 sec초 동안 앞으로 (거점 앞에서 멈춤), 지나간 적마다 onHit(e) 한 번
     *  opt.shove (방패 돌진): 뚫고 지나가지 않고 만난 적을 앞에 붙여 같이 밀고 감 — 밀리지 않는 적(보스·방패병 등)·바리케이드
     *  앞에서는 멈춤 (디스코드 QA 11-05 홍도도 "돌진 스킬을 쓰면 적을 뚫고 지나감") */
    dashForward(dist, sec, onHit, trailFx, opt = {}) {
        const building = this.enemies.find(e => e.isBuilding);
        const start = this.monsterX;
        const end = Math.max(start, Math.min(start + dist, building ? building.x - 110 : Infinity));
        const hit = new Set();
        const steps = 8;
        const gap = opt.gap ?? SET.shove.gap;
        const heavy = e => e.boss || e.knockResist || e.isBarricade;
        let stopped = false;
        for (let i = 1; i <= steps; i++) {
            this.schedule((sec * i) / steps, () => {
                if (!this.isActive || stopped) return;
                let x = start + ((end - start) * i) / steps;
                if (opt.shove) {   // 밀리지 않는 적 바로 앞에서 멈춤 (이미 겹쳐 있으면 그 자리)
                    const wall = this.enemies.filter(e => !e.isBuilding && e.hp > 0 && heavy(e) && e.x - this.frontX() >= -60)
                        .sort((p, q) => p.x - q.x)[0];
                    if (wall && x + 100 + gap > wall.x) {
                        x = Math.max(this.monsterX, wall.x - gap - 100);
                        stopped = true;
                    }
                }
                this.monsterX = x;
                monsterControllerV2.setMonsterPosition(this.monsterX);
                if (trailFx) this.fx.play(trailFx, this.monsterX + 10, FOOT_B + 30);
                const front = this.frontX();
                [...this.enemies].forEach(e => {
                    if (e.x - front > (opt.shove ? gap : 40) || e.x - front < -150) return;
                    if (!hit.has(e)) {
                        hit.add(e);
                        onHit(e);
                    }
                });
                if (opt.shove) {   // 방패 앞에 붙여 같이 밀림 — 앞 적이 뒤 적을 밀어내듯 서로 stack px 이상 띄움 (한 자리에 겹치지 않게)
                    let edge = front + gap;
                    this.enemies.filter(e => !e.isBuilding && !heavy(e) && e.hp > 0 && (hit.has(e) || e.x - front <= gap + SET.shove.stack * 3))
                        .sort((p, q) => p.x - q.x)
                        .forEach(e => {
                            if (e.x - front < -150) return;
                            if (e.x < edge) {
                                if (!hit.has(e)) { hit.add(e); onHit(e); }
                                e.x = edge;
                                if (e.dom) e.dom.style.left = `${e.x}px`;
                            }
                            edge = e.x + SET.shove.stack;
                        });
                }
            });
        }
    },

    // ---- 레어 세트 4부위 효과 (Q-008) — 스킬 안에서 켜는 것(레일 충전·4회전·분신 수·독 거점 배율)은 그 자리에서 ----
    /** 돌격 강습대: 로켓 돌진이 끝난 자리에서 충격파 — 둘레 적 피해 + 보통 적 기절 */
    dashShockwave() {
        if (!this.isActive) return;
        const T = SET.setBonus.dashShock;
        const cx = this.frontX() + 20;
        this.fx.play(SET_VFX.groundSlam, cx, FOOT_B, { scale: 0.8 });
        this.director.shake(5, 200);
        [...this.enemies].forEach(e => {
            if (Math.abs(aimOf(e).x - cx) > T.radius) return;
            this.dealDamageToEnemy(e, this.unit() * T.dmg, false, { knock: 0.8 });
            if (!e.isBuilding && !e.isBarricade && this.enemies.includes(e)) this.stunEnemy(e, T.stun);
        });
    },

    /** 광폭 실험체: 아드레날린 동안 밀려나지 않음 (player.js knockPlayerBack) */
    knockImmuneBySet() {
        return !!this.buffs?.adrenaline && this.setOn('chimera_a');
    },

    /** 적이 쓰러질 때 (enemyField.js onEnemyKilled) — 독안개: 산성에 녹던 적이면 가까운 적에게 산성이 옮음 */
    onSetKill(enemy) {
        if (!this.setOn('kaiju_b') || !(enemy.acidT > 0)) return;
        const T = SET.setBonus;
        const cx = aimOf(enemy).x;
        const next = this.enemies.filter(e => e !== enemy && e.hp > 0 && !e.isBarricade && Math.abs(aimOf(e).x - cx) <= T.acidSpread)
            .sort((p, q) => Math.abs(aimOf(p).x - cx) - Math.abs(aimOf(q).x - cx))[0];
        if (!next) return;
        this.applyAcid(next, T.acidSec);
        this.fx.play(SET_VFX.toxicPuff, aimOf(next).x, FOOT_B + 10, { scale: 0.7 });
    },

    /** 아군이 쓰러질 때 (allies.js removeAlly) — 조직 사령관: 졸개가 터지며 주변 적 피해 */
    onSetAllyDown(ally) {
        if (!this.isActive || ally.kind !== 'chimera' || !this.setOn('chimera_b')) return;
        const T = SET.setBonus.minionBlast;
        const cx = ally.x + 38;
        this.fx.play(SET_VFX.maulHit, cx, FOOT_B + 30, { scale: 0.8 });
        [...this.enemies].forEach(e => {
            if (Math.abs(aimOf(e).x - cx) <= T.radius) this.dealDamageToEnemy(e, this.unit() * T.dmg, false, { knock: 0.6 });
        });
    },

    // ---- 다리 패시브 ----
    /** 리그 걸음 이벤트마다 (battle_v2.js onRigEvent 'stomp'/'step'): 짓밟기 충격파 */
    onFootstep() {
        if (this.equippedLegId !== 'leg_chimera_a' || this.playerStunned()) return;
        this.fx.play(SET_VFX.stomp, this.monsterX + 50, FOOT_B);
        const front = this.frontX();
        [...this.enemies].forEach(e => {
            const d = e.x - front;
            if (d >= -20 && d <= SET.stomp.range) this.dealDamageToEnemy(e, this.unit() * SET.stomp.dmg, false, { knock: 0.3 });
        });
    },

    /** 늘 켜진 패시브·버프의 표시 (포격 고정 앵커, 불굴 방패 빛, 오버드라이브 증기) */
    tickSetPassiveFx() {
        if (this.equippedLegId === 'leg_mech_a' && this.isAttacking && this.setFxReady('anchor', 1.2)) {
            this.fx.play(SET_VFX.anchor, this.monsterX + 35, FOOT_B);
        }
        if (this.equippedLegId === 'leg_hero_a' && this.playerHp < this.maxPlayerHp * SET.indomitable.below
            && this.playerHp > 0 && this.setFxReady('indomitable', 1.0)) {
            this.fx.play(SET_VFX.indomitable, this.monsterX + 35, FOOT_B, { follow: () => [this.monsterX + 35, FOOT_B] });
        }
        if (this.buffs.overdrive && this.setFxReady('overdrive', 0.4)) this.fx.play(SET_VFX.overdriveTick, this.monsterX + 35, FOOT_B);
    }
};
