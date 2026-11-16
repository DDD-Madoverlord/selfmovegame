/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 서리의 무희 (v2, 새 캐릭터 3 — D-046)
   얼리고 깨뜨리는 원거리 군중 제어.
     냉기: 무희의 공격에 맞을 때마다 쌓임 → freezeAt이 되면 빙결(기절 + 얼음 색), 냉기는 비움. 한동안 안 맞으면 사라짐
     기본 공격 서리 부채(팔 attackType 'frost'): 작은 서리 초승달 — 앞의 적 둘까지, 냉기 1
     팔 스킬 초승달 참격: 큰 초승달이 지나간 적 모두 피해 + 냉기 2
     몸통 스킬 눈보라 춤: 몇 초간 둘레 눈보라 — 안의 적 계속 피해 + 냉기, 그동안 무희가 받는 피해 감소
     머리 필살기 영원한 안식: 앞의 적을 얼음 결정에 가뒀다가 한꺼번에 깨뜨림 (거점은 깨지는 피해만)
     다리 패시브 빙판 걸음: 얼어 있는 적에게 주는 모든 피해 증가 (enemyField.dealDamageToEnemy가 shatterBonus를 곱함)
   보스는 얼지 않음(냉기만 쌓임). 수치는 battle/tuning.js FROST, 이펙트는 vfx/frostVfx.js.
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { FROST_VFX, ICE, MIST } from '../vfx/frostVfx.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { FROST, FOOT_B } from './tuning.js';
import { spr, fxOf } from '../skillKit_v2.js';
import { ICE_C, FROST_W, SNOW_C, ICE_PRISON, ICE_BREAK, ICE_SPROUT, ICE_HIT, FS } from '../vfx/iceFx.js';

// 눈보라 춤 (D-137, 2026-11-16 피드백: 바닥 효과뿐이라 설명과 안 맞고 약함): 무희 둘레에 눈보라가 휘몰아침 —
//   눈송이 회오리(몸 둘레를 돌며 오르내림) + 눈꽃 고리 소용돌이 + 바람에 휘날리는 눈발 + 큰 눈꽃이 머리 위에서 돎, 바닥엔 서리 안개
const BLIZZARD = (sec, w) => fxOf(
    { type: 'petalVortex', at: 0, dur: sec, rx: w * 0.5, h: 210, count: 70, color: SNOW_C, backColor: '120, 170, 220', hiColor: '255, 255, 255' },
    spr('eternal_winter', w * 1.15, { dur: sec, frameRange: [3, 5], loopSec: 0.8, pingPong: true, dy: -95, alpha: 0.55, squash: 0.55, fadeIn: 0.3, fadeOut: 0.5 }),
    { type: 'snowFall', at: 0, dur: sec, w: w * 1.3, count: 60, top: -10, wind: 260, speed: 0.9, storm: true, cloud: false, alpha: 0.8 },
    FS(1, 90, { dur: sec, dy: -200, spin: 2.2, alpha: 0.8, popIn: 0.3, fadeOut: 0.5 }),
    { type: 'mist', at: 0, r: w * 0.45, h: 14, life: sec, drift: 18, color: '110, 160, 200' },
    { type: 'ring', at: 0, dur: 0.5, r: w * 0.6, ground: true, color: FROST_W, width: 5 });
const BLIZZARD_TICK = fxOf(spr('ice_burst', 80, { frameRange: [3, 7], dur: 0.35 }),
    { type: 'motes', at: 0, count: 4, spread: 12, rise: [10, 40], life: [0.3, 0.5], size: 2, color: FROST_W });
// 영원한 안식 (D-137 피드백: 얼음이 바닥을 따라 나아가며, 맞은 적은 얼음에 갇힘): 무희 발밑 서리 문양 → 얼음 결정 줄기가 땅을 따라
//   앞으로 솟으며 달려가고, 닿은 적마다 반투명 얼음 감옥에 갇힘 → 한꺼번에 깨짐
const REST_CALL = fxOf({ type: 'rune', at: 0, dur: 0.85, r: 80, color: FROST_W, spin: 0.6 },
    { type: 'ring', at: 0, dur: 0.6, r: 200, ground: true, color: ICE_C, width: 6 },
    { type: 'glow', at: 0, dur: 1, r: 120, color: ICE_C });
const REST_SPEED = 900, REST_STEP = 34;

const solid = e => e.isBuilding || e.isBarricade;
const hitX = e => (solid(e) ? e.x + 12 : aimOf(e).x);

export const FrostMethods = {
    // ---- 냉기·빙결 ----
    /** 냉기 n 쌓기 → freezeAt이면 빙결 (거점·바리케이드는 없음, 보스는 쌓이기만) */
    applyChill(e, n = 1) {
        if (!e || solid(e) || e.hp <= 0 || e.frozenT > 0) return;
        e.chill = (e.chill || 0) + n;
        e.chillT = FROST.chillSec;
        if (e.chill >= FROST.freezeAt && !e.boss) {
            e.chill = 0;
            this.freezeEnemy(e, FROST.freezeSec + (this.kitMod?.('freezeSec') || 0));   // 2차 세트 얼음 여왕 2부위: 빙결 시간 +
        } else {
            this.updateEnemyFilter(e);
        }
    },

    freezeEnemy(e, sec) {
        if (!e || solid(e) || e.boss || !this.enemies.includes(e)) return;
        this.stunEnemy(e, sec);
        e.frozenT = Math.max(e.frozenT || 0, sec);
        e.chill = 0;
        this.updateEnemyFilter(e);
        this.fx.play(FROST_VFX.freeze, aimOf(e).x, FOOT_B);
        this.kitOnFreeze?.(e);   // 2차 패시브 얼음 왕국 (battle/kit.js)
    },

    /** 다리 패시브 빙판 걸음: 얼어 있는 적에게 주는 피해 배율 증가분 (아니면 0) */
    shatterBonus() {
        return FROST.shatter[this.equippedLegId] || 0;
    },

    // ---- 기본 공격: 서리 부채 ----
    fireFrostFan(target, dmg, isCrit) {
        const fan = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 110 };
        const hit = [];
        this.fx.launchWave({
            x: fan.x, b: Math.max(70, fan.bottom - 10), range: this.playerRange + 30, speed: 820, h: 54,
            color: ICE, mist: MIST, sfx: 'frost_fan',
            onPass: (x0, x1) => {
                if (hit.length >= FROST.fanTargets) return;
                [...this.enemies].forEach(e => {
                    const x = hitX(e);
                    if (x < x0 || x > x1 || hit.includes(e) || hit.length >= FROST.fanTargets) return;
                    hit.push(e);
                    const mul = hit.length === 1 ? 1 : FROST.fanSecond;
                    this.fx.play(FROST_VFX.fanHit, x, aimOf(e).b);
                    this.dealDamageToEnemy(e, dmg * mul, isCrit && mul === 1, { knock: 0.3 });
                    if (this.enemies.includes(e)) this.applyChill(e, 1);
                });
            }
        });
    },

    // ---- 팔 스킬: 초승달 참격 ----
    crescentSlash(range) {
        const fan = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 110 };
        this.fx.play(FROST_VFX.crescentBurst, fan.x, fan.bottom);
        const hit = new Set();
        this.fx.launchWave({
            x: fan.x, b: 86, range: this.playerRange + range, speed: 700, h: 130, color: ICE, mist: MIST,
            sfx: null,
            onPass: (x0, x1) => {
                [...this.enemies].forEach(e => {
                    const x = hitX(e);
                    if (x < x0 || x > x1 || hit.has(e)) return;
                    hit.add(e);
                    this.fx.play(FROST_VFX.crescentHit, x, aimOf(e).b);
                    this.dealDamageToEnemy(e, this.unit() * FROST.crescentDmg, false, { knock: 0.6, stop: hit.size === 1 });
                    if (this.enemies.includes(e)) this.applyChill(e, FROST.crescentChill);
                });
            }
        });
    },

    // ---- 몸통 스킬: 눈보라 춤 ----
    blizzardDance() {
        this.blizzard = { t: FROST.blizzardSec, tick: 0 };
        const z = FROST.blizzardZone, cx = () => this.frontX() + (z[0] + z[1]) / 2;
        this.fx.play(BLIZZARD(FROST.blizzardSec, z[1] - z[0]), cx(), FOOT_B, { follow: () => [cx(), FOOT_B], alive: () => !!this.blizzard });
    },

    inBlizzard(e) {
        const d = hitX(e) - this.frontX();
        return d >= FROST.blizzardZone[0] && d <= FROST.blizzardZone[1];
    },

    endBlizzard() {
        this.blizzard = null;
    },

    // ---- 머리 필살기: 영원한 안식 ----
    eternalRest(range) {
        const x0 = this.monsterX + 60;
        this.fx.play(REST_CALL, this.monsterX + 35, FOOT_B);
        const list = this.enemiesInRange(this.playerRange + range).slice(0, FROST.restMax);
        const reach = list.length ? Math.max(...list.map(hitX)) + 40 : x0 + range;
        for (let x = x0, k = 0; x <= reach; x += REST_STEP, k++) {   // 땅을 따라 나아가는 얼음 줄기
            this.schedule(0.1 + (x - x0) / REST_SPEED, () => this.isActive && this.fx.play(ICE_SPROUT(k % 2 ? 100 : 124), x, FOOT_B));
        }
        const at = e => 0.1 + Math.max(0, hitX(e) - x0) / REST_SPEED;
        const breakAt = (list.length ? Math.max(...list.map(at)) : 0.1) + FROST.restSec;
        list.forEach((e, i) => this.schedule(at(e), () => {
            if (!this.isActive || !this.enemies.includes(e)) return;
            const hold = breakAt - at(e);
            this.fx.play(ICE_PRISON(hold, solid(e) ? 190 : 150), hitX(e), FOOT_B, { follow: () => [hitX(e), FOOT_B], alive: () => this.enemies.includes(e) });
            if (!solid(e) && !e.boss) {
                this.stunEnemy(e, hold + 0.1);
                e.frozenT = hold + 0.1;
                e.chill = 0;
                this.updateEnemyFilter(e);
            }
            this.schedule(hold, () => {   // 한꺼번에 깨짐 (얼어 있으면 빙판 걸음 보너스도 받음)
                if (!this.isActive || !this.enemies.includes(e)) return;
                this.fx.play(ICE_BREAK(solid(e) ? 210 : 180), hitX(e), FOOT_B);
                if (i === 0) this.director?.shake?.(8, 300);
                this.dealDamageToEnemy(e, this.unit() * (solid(e) ? FROST.restBaseDmg : FROST.restDmg), false, { knock: 1, stop: i === 0 });
            });
        }));
    },

    /** 매 프레임: 냉기·빙결 시간, 눈보라 */
    tickFrost(dt) {
        this.enemies.forEach(e => {
            if (e.chill > 0) {
                e.chillT -= dt;
                if (e.chillT <= 0) {
                    e.chill = 0;
                    this.updateEnemyFilter(e);
                }
            }
            if (e.frozenT > 0) {
                e.frozenT -= dt;
                if (e.frozenT <= 0) { this.updateEnemyFilter(e); this.kitOnThaw?.(e); }   // 2차 패시브 동상 (battle/kit.js)
            }
        });
        if (!this.blizzard) return;
        this.blizzard.t -= dt;
        this.blizzard.tick -= dt;
        const tick = this.blizzard.tick <= 0;
        if (tick) this.blizzard.tick = FROST.blizzardTick;
        [...this.enemies].forEach(e => {
            if (!this.inBlizzard(e)) return;
            this.dealDamageToEnemy(e, this.unit() * FROST.blizzardDps * dt, false, { dot: true });
            if (tick && this.enemies.includes(e)) {
                this.applyChill(e, 1);
                this.fx.play(BLIZZARD_TICK, hitX(e), aimOf(e).b);
            }
        });
        if (this.blizzard.t <= 0) this.endBlizzard();
    }
};
