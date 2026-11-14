/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 심연의 길잡이 (v2, 새 캐릭터 1 — D-044)
   끌어오고 밀어내는 무거운 탱커.
     기본 공격 고압 방수포(팔 attackType 'water'): 사거리 안 적을 꿰뚫는 물줄기, 바리케이드·거점에서 멈춤
     팔 스킬 앵커 견인: 가장 먼 적(사수·의무병·수리공 먼저)을 발 앞으로 끌어와 기절
     몸통 스킬 고압 분사: 물결이 지나가며 적을 밀어내고 감속
     머리 필살기 심연의 손: 유령 손이 적을 붙잡아 묶고 지속 피해 (거점도)
     다리 패시브 잠수화: 밀려남·감속·속박에 강함 (player.js가 bootsCut으로 줄임)
   수치는 battle/tuning.js DIVER, 이펙트는 vfx/diverVfx.js.
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { DIVER_VFX, WATER, ABYSS } from '../vfx/diverVfx.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { DIVER, FOOT_B } from './tuning.js';

const SURGE_MIST = '40, 110, 130';
const solid = e => e.isBuilding || e.isBarricade;
// 물줄기·앵커가 닿는 자리: 병사는 몸통 가운데, 거점·바리케이드는 앞면(왼쪽 끝) — 넓은 그림의 가운데는 사거리 밖일 수 있음
const hitPoint = e => {
    const a = aimOf(e);
    return { x: solid(e) ? e.x + 12 : a.x, b: a.b };
};

export const DiverMethods = {
    // ---- 기본 공격: 고압 방수포 ----
    fireWaterJet(target, dmg, isCrit) {
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 110 };
        const hits = [];
        for (const e of this.enemiesInRange(this.playerRange)) {
            hits.push(e);
            if (solid(e) || hits.length >= DIVER.jetMax) break;   // 벽·거점에서 물줄기가 막힘 · 최대 DIVER.jetMax명 (D-119)
        }
        if (!hits.length) hits.push(target);
        const end = hitPoint(hits[hits.length - 1]);
        this.fx.play(DIVER_VFX.jet, muzzle.x, muzzle.bottom, { to: [end.x, end.b] });
        let mul = 1;
        hits.forEach(e => {
            const p = hitPoint(e);
            this.fx.play(DIVER_VFX.jetHit, p.x, p.b);
            this.dealDamageToEnemy(e, dmg * mul, isCrit && mul === 1, { knock: DIVER.jetKnock });
            mul *= DIVER.jetPierce;
        });
    },

    // ---- 팔 스킬: 앵커 견인 ----
    /** 끌어올 적: 사거리 안 병사 중 지원·원거리(치유·수리·사격·늪·그물·바리케이드)를 먼저, 그중 가장 먼 적. 병사가 없으면 거점·바리케이드 */
    anchorTarget(range) {
        const list = this.enemiesInRange(this.playerRange + range);
        const troops = list.filter(e => !solid(e));
        if (!troops.length) return list[0] || null;
        const t = e => e.t || {};
        const support = troops.filter(e => t(e).heal || t(e).ranged || t(e).sludge || t(e).net || t(e).barricade);
        const pool = support.length ? support : troops;
        return pool[pool.length - 1];
    },

    /** 앵커를 던져 박고(피해·기절) 사슬을 감아 발 앞으로 끌어옴 (보스·거점은 끌려오지 않음) */
    throwAnchor(target, range) {
        if (!this.isActive) return;
        if (!this.enemies.includes(target)) target = this.anchorTarget(range);
        if (!target) return;
        const hand = () => monsterControllerV2.getSocketPoint('hand', 'armB') || { x: this.monsterX + 60, bottom: 110 };
        let last = hitPoint(target);
        this.fx.launchChain(() => { const h = hand(); return { x: h.x, b: h.bottom }; }, () => {
            if (this.enemies.includes(target)) last = hitPoint(target);
            return last;
        }, {
            out: 0.28, back: DIVER.pullSec, color: ABYSS,
            onHook: () => {
                if (!this.isActive || !this.enemies.includes(target)) return;
                this.fx.play(DIVER_VFX.anchorHook, last.x, last.b);
                this.dealDamageToEnemy(target, this.unit() * DIVER.anchorDmg, false, { stop: true });
                if (!this.enemies.includes(target) || solid(target)) return;
                this.stunEnemy(target, DIVER.anchorStun);
                if (!target.boss) this.pullEnemy(target, this.frontX() + DIVER.pullGap, DIVER.pullSec);
            }
        });
    },

    /** 적을 sec초에 걸쳐 x = toX까지 끌어옴 (기절 중이라 스스로 움직이지 않음, tickDiver가 옮김) */
    pullEnemy(e, toX, sec) {
        if (e.x <= toX) return;
        e.pull = { from: e.x, to: toX, t: 0, sec };
    },

    // ---- 몸통 스킬: 고압 분사 ----
    pressureSurge(range) {
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 110 };
        this.fx.play(DIVER_VFX.surgeBurst, muzzle.x, muzzle.bottom);
        const hit = new Set();
        this.fx.launchWave({
            x: muzzle.x, b: 84, range: this.playerRange + range, speed: 620, h: 120, color: WATER, mist: SURGE_MIST,
            sfx: 'diver_surge',
            onPass: (x0, x1) => {
                [...this.enemies].forEach(e => {
                    const p = hitPoint(e);
                    if (p.x < x0 || p.x > x1 || hit.has(e)) return;
                    hit.add(e);
                    this.fx.play(DIVER_VFX.surgeHit, p.x, p.b);
                    if (!solid(e)) this.slowEnemy(e);
                    this.dealDamageToEnemy(e, this.unit() * DIVER.surgeDmg, false, { knock: solid(e) ? 0 : DIVER.surgeKnock });
                });
            }
        });
    },

    // ---- 머리 필살기: 심연의 손 ----
    abyssHands(range) {
        this.fx.play(DIVER_VFX.abyssCall, this.monsterX + 35, FOOT_B);
        this.enemiesInRange(this.playerRange + range).slice(0, DIVER.handsMax).forEach((e, i) => this.schedule(0.12 + i * 0.08, () => {
            if (!this.isActive || !this.enemies.includes(e)) return;
            this.fx.play(DIVER_VFX.hands, aimOf(e).x, FOOT_B);
            this.dealDamageToEnemy(e, this.unit() * DIVER.handsDmg, false, { stop: i === 0 });
            if (!this.enemies.includes(e)) return;
            if (!solid(e)) this.stunEnemy(e, DIVER.handsHold);
            e.abyssT = DIVER.handsSec;
            this.updateEnemyFilter(e);
        }));
    },

    /** 매 프레임: 끌려오는 적 옮기기, 심연의 손 지속 피해 */
    tickDiver(dt) {
        const dps = this.playerDps * DIVER.handsDps;
        [...this.enemies].forEach(e => {
            if (e.pull) {
                const p = e.pull;
                p.t += dt;
                const u = Math.min(1, p.t / p.sec);
                e.x = p.from + (p.to - p.from) * u * u;   // 감을수록 빨라짐
                if (e.dom) e.dom.style.left = `${e.x}px`;
                if (u >= 1) {
                    e.pull = null;
                    this.fx.play(DIVER_VFX.anchorLand, aimOf(e).x, FOOT_B);
                }
            }
            if (e.abyssT > 0) {
                e.abyssT -= dt;
                e.abyssFx = (e.abyssFx || 0) + dt;
                if (e.abyssFx >= 0.6) {
                    e.abyssFx = 0;
                    this.fx.play(DIVER_VFX.handsTick, aimOf(e).x, FOOT_B);
                }
                this.dealDamageToEnemy(e, dps * (e.isBuilding ? DIVER.handsBaseMul : 1) * dt, false, { dot: true });
                if (e.abyssT <= 0 && this.enemies.includes(e)) this.updateEnemyFilter(e);
            }
        });
    },

    // ---- 다리 패시브: 잠수화 ----
    /** kind 'push'(밀려남) | 'slow'(감속·속박 시간)의 감소율 (잠수화가 아니면 0) */
    bootsCut(kind) {
        const b = DIVER.boots[this.equippedLegId];
        return b ? b[kind] : 0;
    }
};
