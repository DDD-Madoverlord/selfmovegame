/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 스킬 부품 (파츠 확장 2차, Q-009 · D-071)
   skillKit_v2.js의 단계가 쓰는 전투 기능과 2차 세트의 패시브·세트 효과:
     값을 가진 버프(addKitBuff — 피해·받는 피해·이동·공격 속도·쿨다운·회피·회복·면역), 적 상태(화상·독·취약·약화·공포·잠),
     장판(kitZone), 움직이는 판정(kitWave), 소환(spawnKitAlly), 변신(kitTransform), 새 기본 공격(fireKitAttack),
     다리 패시브(KIT_PASSIVES — 늘 붙는 값·조건 값·N번째 공격·처치·걸음·막기·버티기·보행 충전), 세트 효과(고침 patch · 값 mods · 깃발 flags · 계기 on),
     강철 벽(장판 wall — 적 진격을 막음)·투사체 막기(깃발 projBlock — sets.js rangedMul)·막은 피해 모으기(버프 store).
     새 캐릭터 2종 (D-079): 적 상태 침묵(silence — enemies_v2.js가 기술·원거리·치유를 멈춤), 그림 있는 장판(art — 철골 바리케이드·음파 장막).
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진). 설계: MD/파츠확장_2차_기획안.md 3장.
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { sound } from '../audio/sound_v2.js';
import { aimAt as aimOf } from '../bases_v2.js';
import { ENEMY_ART } from '../enemyArt_v2.js';
import { ensureEnemyStyles } from '../enemies_v2.js';
import { SETS } from '../sets_v2.js';
import { KIT_PASSIVES, runKitStep, spr, fxOf } from '../skillKit_v2.js';
import { FOOT_B, SET, SAINT, DOLL, PIERCE2 } from './tuning.js';
import { playImageField } from '../vfx/imageEffects.js';

const ART_FOOT_B = 58;
const DOT_FX = {
    burn: fxOf(spr('fire_burst', 46, { dur: 0.35, glow: 0.8 })),
    poison: fxOf({ type: 'motes', at: 0, count: 5, spread: 22, rise: [12, 30], life: [0.4, 0.7], size: 2.2, color: '170, 240, 60' })
};
const KIT_FX = {
    poof: fxOf(spr('defeat_puff', 90, { blend: 'normal', anchorY: 0.85, dur: 0.45 })),
    block: fxOf({ type: 'ring', at: 0, dur: 0.35, r: 46, color: '255, 224, 138', width: 4 }, { type: 'flash', at: 0, dur: 0.15, r: 40, color: '255, 240, 200' }),
    dodge: fxOf({ type: 'speedlines', at: 0, dur: 0.25, count: 6, len: 26, angle: Math.PI, cone: 0.8, width: 2, color: '200, 220, 255' }),
    heal: fxOf({ type: 'motes', at: 0, count: 8, spread: 36, rise: [30, 70], life: [0.5, 0.9], size: 2.4, color: '125, 255, 154' }),
    awaken: fxOf(spr('power_aura', 240, { anchorY: 0.92, dur: 0.8 }), { type: 'shockwave', at: 0, dur: 0.5, r: 140, width: 14, ground: true, color: '255, 120, 60' })
};

// 적 상태 이름 → 화면 표시 (enemyField.js updateEnemyFilter가 아이콘·색으로 씀)
export const KIT_STATUS_ICON = { burn: 'fire', poison: 'acid', vuln: 'spikes', weak: 'retreat', fear: 'horn', sleep: 'pause', thread: 'stitch', silence: 'mute' };
export const KIT_STATUS_TINT = {
    fear: 'saturate(0.6) brightness(0.85) drop-shadow(0 0 6px #ff4466)',
    sleep: 'saturate(0.5) brightness(0.95) drop-shadow(0 0 6px #b9a8ff)',
    burn: 'sepia(0.4) saturate(1.6) drop-shadow(0 0 5px #ff8a30)',
    vuln: 'drop-shadow(0 0 6px #ff5ad1)',
    thread: 'drop-shadow(0 0 5px #ff3c50)',
    silence: 'saturate(0.55) drop-shadow(0 0 6px #ff50aa)'
};

const sum = (list, key) => list.reduce((a, m) => a + (m[key] || 0), 0);
const isUnit = e => !e.isBuilding && !e.isBarricade;

export const KitMethods = {
    /** 전투 시작 (setupGrowth 뒤): 패시브·세트 효과 정리 */
    setupKit(equippedObjs) {
        this.kitBuffs = {};
        this.kitZones = [];
        this.kitWaves = [];
        this.kitXform = null;
        this.kitAttackN = 0;
        this.kitNextMul = 1;
        this.kitBlockT = 0;
        this.kitStillT = 0;
        this.kitEveryT = 0;
        this.kitOnce = {};
        this.kitGrow = 0;
        this.kitBaseHp = 0;
        this.kitOnHazard = false;
        this.kitAdapt = {};
        this.kitStored = 0;
        this.kitHpLog = [];
        this.kitCharged = false;
        this.kitChargeT = 0;
        this.kitChargeFxT = 0;
        this.kitModCache = null;
        if (monsterControllerV2.spriteCanvas) monsterControllerV2.spriteCanvas.style.opacity = '';   // 광학 위장(반투명)이 판 사이에 남지 않게
        this.kitPassive = KIT_PASSIVES[this.equippedLegId] || null;
        this.kitAttackDef = equippedObjs.arm?.kitAttack || null;
        // 세트 효과 (SETS[id].kit = { 2: { patch, mods, flags, on }, 4: … })
        this.kitPatch = {};
        this.kitSetMods = [];
        this.kitFlags = new Set(this.kitPassive?.flags || []);
        this.kitTriggers = [];
        this.kitSetTargets = [];
        for (const [sid, set] of Object.entries(SETS)) {
            if (!set.kit) continue;
            for (const [need, k] of Object.entries(set.kit)) {
                if (!this.setOn(sid, Number(need))) continue;
                for (const [skill, keys] of Object.entries(k.patch || {})) {
                    const cur = this.kitPatch[skill] || (this.kitPatch[skill] = {});
                    for (const [key, v] of Object.entries(keys)) cur[key] = typeof v === 'number' && typeof cur[key] === 'number' ? cur[key] + v : v;
                }
                if (k.mods) this.kitSetMods.push(k.mods);
                (k.flags || []).forEach(f => this.kitFlags.add(f));
                (k.on || []).forEach(t => this.kitTriggers.push({ ...t, set: sid }));
                if (k.target) this.kitSetTargets.push(...k.target);   // 대상 조건 (종지기 수녀 4부위: 기절한 적 피해 +)
            }
        }
        if (this.kitPassive?.on) this.kitTriggers.push(...this.kitPassive.on);
    },

    kitFlag(name) {
        if (this.kitFlags?.has(name)) return true;
        return Object.values(this.kitBuffs || {}).some(bf => bf.mods.flags?.includes(name));
    },

    // ---- 값 (버프 + 패시브 + 세트 효과 + 조건) ----
    /** 지금 켜진 값 목록 (프레임마다 한 번 계산) */
    kitModList() {
        if (this.kitModCache) return this.kitModCache;
        const list = Object.values(this.kitBuffs || {}).map(b => b.mods);
        if (this.kitSetMods) list.push(...this.kitSetMods);
        const ps = this.kitPassive;
        if (ps?.mods) list.push(ps.mods);
        for (const c of ps?.self || []) if (this.kitSelfCond(c)) list.push(c.mods);
        if (ps?.perUnit) {   // 가족 행렬: 내 아군·꼭두각시 하나마다 받는 피해 - (최대 max)
            const n = this.allies.length + this.enemies.filter(e => e.puppetT > 0).length;
            if (n) list.push({ def: Math.min(ps.perUnit.max, n * ps.perUnit.def) });
        }
        if (ps?.perFrozen) {   // 겨울의 심장: 빙결된 적 하나마다 피해 + (최대 max)
            const n = this.enemies.filter(e => e.frozenT > 0).length;
            if (n) list.push({ dmg: Math.min(ps.perFrozen.max, n * ps.perFrozen.dmg) });
        }
        this.kitModCache = list;
        return list;
    },
    kitMod(key) {
        return sum(this.kitModList(), key);
    },
    /** 나에 대한 조건: walking · still · hpBelow · allies · enemiesNear · frozenNear */
    kitSelfCond(c) {
        switch (c.when) {
            case 'walking': return this.isWalking === true || (!this.isAttacking && this.kitStillT <= 0);
            case 'still': return this.kitStillT >= (c.after ?? 0);
            case 'hpBelow': return this.playerHp < this.maxPlayerHp * c.ratio;
            case 'allies': return this.allies.length >= (c.n || 1);
            case 'frozenNear': return this.enemies.some(e => e.frozenT > 0 && e.x - this.frontX() < 300);
            case 'hazard': return this.kitOnHazard;
            default: return false;
        }
    },

    /** 주는 피해 배율 (sets.js dmgMul) — 버프·패시브·세트의 dmg, 다음 공격 배율은 fireAttack에서 */
    kitDmgMul() {
        return 1 + this.kitMod('dmg');
    },
    /** 적 이동 배율 (enemies_v2.js moveBy): 패시브 enemySlow — 보통 적만 (마왕의 위압) */
    kitEnemyMove(e) {
        const s = this.kitPassive?.enemySlow;
        return s && !e.elite && !e.boss ? 1 - s : 1;
    },
    /** 받는 피해 배율 (sets.js incomingMul) */
    kitIncomingMul() {
        return this.kitModList().reduce((m, x) => m * (1 - Math.min(0.9, x.def || 0)), 1);
    },
    kitMoveMul() {
        return Math.max(0.2, 1 + this.kitMod('move'));
    },
    /** 스킬 쿨다운이 줄어드는 빠르기 (1 = 보통, 2 = 2배) */
    kitCdRate() {
        return 1 + this.kitMod('cdRate');
    },
    kitUltRate() {
        return 1 + this.kitMod('ult');
    },
    kitCcMul() {
        if (this.kitFlag('ccImmune')) return 0;
        return Math.max(0, 1 - this.kitMod('ccCut'));
    },
    kitAllyMul() {
        return 1 + this.kitMod('allyDmg');
    },

    /** 이 적에게 주는 피해 배율 (dealDamageToEnemy): 적의 취약 + 패시브·세트 조건 */
    kitTargetMul(e) {
        let k = 1;
        if (e.kitVulnT > 0) k *= 1 + (e.kitVuln || 0);
        const conds = [...(this.kitPassive?.target || []), ...(this.kitSetTargets || [])];
        for (const c of conds) if (this.kitTargetCond(c, e)) k *= 1 + c.dmg;
        return k;
    },
    kitTargetCond(c, e) {
        switch (c.when) {
            case 'far': return e.x - this.frontX() > (c.dist ?? 200);
            case 'elite': return !!(e.elite || e.boss);
            case 'boss': return !!e.boss;
            case 'building': return !!(e.isBuilding || e.isBarricade);
            case 'ranged': return !!(e.t && (e.t.ranged || e.t.sludge || e.t.net || e.t.spell || e.t.spore || e.t.heal));
            case 'lowHp': return isUnit(e) && e.hp < e.maxHp * (c.below ?? 0.5);
            case 'status': return this.kitHasStatus(e, c.status);
            default: return false;
        }
    },
    kitHasStatus(e, st) {
        const list = Array.isArray(st) ? st : [st];
        return list.some(s => ({
            slow: e.slowT > 0, root: e.rootT > 0, stun: e.stunT > 0, frozen: e.frozenT > 0, chill: e.chill > 0,
            burn: e.kitDots?.burn?.t > 0, poison: e.kitDots?.poison?.t > 0 || e.acidT > 0, sleep: e.kitSleepT > 0,
            puppet: e.puppetT > 0, held: e.stunT > 0 || e.rootT > 0 || e.frozenT > 0, vuln: e.kitVulnT > 0, weak: e.kitWeakT > 0,
            silence: e.kitSilenceT > 0
        })[s]);
    },

    /** 받는 피해 (sets.js setIncoming 앞): 무적·막기·회피·약화된 적. 0이면 다 막음 */
    kitIncoming(amount, dt, src) {
        const store = Object.values(this.kitBuffs).find(b => b.mods.store > 0)?.mods;   // 막은 피해를 모아 끝날 때 씀 (방주 방벽 4부위·날개 방패)
        if (this.kitFlag('invuln')) {
            if (store) this.kitStored += amount * store.store;
            return 0;
        }
        if (src && src.kitWeakT > 0) amount *= 1 - (src.kitWeak || 0);
        const ad = this.kitPassive?.adapt;   // 적응 진화: 같은 종류 피해를 n번 받으면 그 종류 -cut
        if (ad) {
            const kind = src ? 'melee' : dt > 0 ? 'zone' : 'ranged';
            const cnt = this.kitAdapt || (this.kitAdapt = {});
            if (dt === 0 || this.setFxReady(`adapt_${kind}`, 0.7)) cnt[kind] = (cnt[kind] || 0) + 1;
            if (cnt[kind] === ad.n && this.setFxReady(`adaptFx_${kind}`, 999)) {
                this.fx.play(KIT_FX.awaken, this.monsterX + 35, FOOT_B);
                this.createDamagePopup(this.monsterX + 40, 220, `적응! ${{ melee: '근접', ranged: '원거리', zone: '장판' }[kind]} 피해 -${Math.round(ad.cut * 100)}%`, false);
            }
            if (cnt[kind] >= ad.n) amount *= 1 - ad.cut;
        }
        for (const c of this.kitPassive?.incoming || []) {   // 받는 쪽 조건 (용의 위엄: 엘리트·보스에게 받는 피해 -25%)
            if (c.when === 'elite' && src && (src.elite || src.boss)) amount *= 1 - c.def;
            if (c.when === 'ranged' && !src) amount *= 1 - c.def;
            if (c.when === 'melee' && src) amount *= 1 - c.def;
            if (c.when === 'zone' && !src && dt > 0) amount *= 1 - c.def;   // 장판·지속 피해 (심해 적응)
        }
        // 근접으로 때린 적에게 상태 (용암 갑옷: 화상)
        const back = src && this.enemies.includes(src) && Object.values(this.kitBuffs).find(b => b.mods.reflectStatus)?.mods.reflectStatus;
        if (back && this.setFxReady('kitReflect', 0.4)) this.kitStatus(src, back);
        // 원거리 피해 되돌림 (반사 수정막): 한 방 원거리는 가장 가까운 적에게 그대로
        if (!src && dt === 0 && Object.values(this.kitBuffs).some(b => b.mods.rangedReflect)) {
            const t = this.nearestEnemy(400);
            if (t) this.dealDamageToEnemy(t, amount, false, { knock: 0.4 });
            if (this.setFxReady('kitMirror', 0.25)) this.fx.play(KIT_FX.block, this.monsterX + 60, 130);
            return 0;
        }
        if (dt === 0) {
            // 회피 횟수 (예지: 버프 guard = 다음 n번 공격을 피함 + counter)
            const guard = Object.values(this.kitBuffs).find(b => b.mods.guard > (b.used || 0));
            if (guard) {
                guard.used = (guard.used || 0) + 1;
                this.fx.play(KIT_FX.dodge, this.monsterX + 50, 120);
                this.createDamagePopup(this.monsterX + 40, 200, '예지 회피!', false);
                this.kitOnDodge();
                return 0;
            }
            // 막기 (완충 장갑): block초마다 한 방
            if (this.kitPassive?.block && this.kitBlockT <= 0) {
                this.kitBlockT = this.kitPassive.block;
                this.fx.play(KIT_FX.block, this.monsterX + 50, 120);
                this.createDamagePopup(this.monsterX + 40, 200, '막음!', false);
                return 0;
            }
            const dodge = this.kitMod('dodge') + (src ? this.kitMod('dodgeMelee') : this.kitMod('dodgeRanged'));
            if (dodge > 0 && Math.random() < dodge) {
                this.fx.play(KIT_FX.dodge, this.monsterX + 50, 120);
                this.createDamagePopup(this.monsterX + 40, 200, '회피!', false);
                this.kitOnDodge();
                return 0;
            }
        } else {
            const dodge = this.kitMod('dodge') + (src ? this.kitMod('dodgeMelee') : 0);
            if (dodge > 0) amount *= 1 - Math.min(0.9, dodge);
        }
        if (store) this.kitStored += amount * Math.min(0.9, store.def || 0) * store.store;
        return amount;
    },
    /** 피했을 때 (예지: 어둠 탄 반격) */
    kitOnDodge() {
        const counter = Object.values(this.kitBuffs).find(b => b.mods.counter)?.mods.counter;
        if (counter) runKitStep(this, counter);
    },

    // ---- 버프 ----
    /** key 버프를 sec초 (같은 key면 새로). mods: { dmg, def, move, atkSpd, cdRate, ult, dodge, dodgeMelee, dodgeRanged, regen, lifesteal, allyDmg, ccCut, flags[], counter(step) } */
    addKitBuff(key, sec, mods, vfx = null, display = null) {
        this.kitBuffs[key] = { t: sec, duration: sec, mods, display };
        this.kitModCache = null;
        if (vfx) this.fx.play(vfx, this.monsterX + 35, FOOT_B, { follow: () => [this.monsterX + 35, FOOT_B] });
    },
    kitHeal(amount) {
        if (amount <= 0 || this.playerHp <= 0) return;
        amount *= 1 + this.kitMod('healAmp');
        this.healPlayer(amount);
    },

    // ---- 적 상태 ----
    /** 상태 묶음 적용 (skillKit_v2.js 상태 표) */
    kitStatus(e, st) {
        if (!e || !this.enemies.includes(e)) return;
        const unit = isUnit(e);
        if (st.stun && unit) this.stunEnemy(e, st.stun);
        if (st.slow && unit) {
            const fresh = !(e.slowT > 0);
            e.slowT = Math.max(e.slowT || 0, st.slow);
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.root && unit) this.rootEnemy(e, st.root);
        if (st.freeze && unit && this.freezeEnemy) this.freezeEnemy(e, st.freeze);
        if (st.chill && unit && this.applyChill) this.applyChill(e, st.chill);
        if (st.acid) this.applyAcid(e, st.acid);
        if (st.burn) this.kitDot(e, 'burn', st.burn[0], this.playerDps * st.burn[1]);
        if (st.poison) this.kitDot(e, 'poison', st.poison[0], this.playerDps * st.poison[1]);
        const vuln = st.vuln || st.mark;
        if (vuln) {
            const fresh = !(e.kitVulnT > 0);
            e.kitVulnT = Math.max(e.kitVulnT || 0, vuln[0]);
            e.kitVuln = Math.max(fresh ? 0 : e.kitVuln || 0, vuln[1]);
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.weak) {
            const fresh = !(e.kitWeakT > 0);
            e.kitWeakT = Math.max(e.kitWeakT || 0, st.weak[0]);
            e.kitWeak = Math.max(fresh ? 0 : e.kitWeak || 0, st.weak[1]);
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.fear && unit && !e.boss) {
            const fresh = !(e.kitFearT > 0);
            e.kitFearT = Math.max(e.kitFearT || 0, st.fear * (e.elite ? 0.5 : 1));
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.puppet && unit) {   // 꼭두각시 (뒤틀린 인형사 doll.js tickDoll): 보스는 짧은 기절만, 시간 + 값 puppetSec
            if (e.boss) this.stunEnemy(e, DOLL.puppetBossStun);
            else {
                e.puppetT = Math.max(e.puppetT || 0, st.puppet + this.kitMod('puppetSec'));
                e.puppetFx = 0;
                this.stunEnemy(e, 0.2);
                this.updateEnemyFilter(e);
            }
        }
        if (st.thread) {   // 붉은 실: 이어진 적끼리 받은 피해를 나눔 (kitThreadShare)
            const fresh = !(e.kitThreadT > 0);
            e.kitThreadT = Math.max(e.kitThreadT || 0, st.thread);
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.silence && unit) {   // 침묵 (침묵의 방송자): 기술·원거리·치유를 못 씀 (enemies_v2.js updateEnemy). 보스는 시간 절반
            const fresh = !(e.kitSilenceT > 0);
            e.kitSilenceT = Math.max(e.kitSilenceT || 0, st.silence * (e.boss ? 0.5 : 1));
            if (fresh) this.updateEnemyFilter(e);
        }
        if (st.sleep && unit && !e.boss) {
            e.kitSleepT = Math.max(e.kitSleepT || 0, st.sleep);
            this.stunEnemy(e, st.sleep);
            this.updateEnemyFilter(e);
        }
    },
    kitDot(e, kind, sec, dps) {
        if (!e || e.hp <= 0) return;
        const dots = e.kitDots || (e.kitDots = {});
        const d = dots[kind];
        const fresh = !(d?.t > 0);
        dots[kind] = { t: Math.max(d?.t || 0, sec), dps: Math.max(fresh ? 0 : d.dps, dps), fx: d?.fx || 0 };
        if (fresh) this.updateEnemyFilter(e);
    },
    /** 맞으면 깸 (잠) — dealDamageToEnemy가 부름 */
    kitWake(e) {
        if (!(e.kitSleepT > 0)) return;
        e.kitSleepT = 0;
        e.stunT = Math.min(e.stunT || 0, 0.05);
        this.updateEnemyFilter(e);
    },
    /** 공포: 뒤로 물러남 (tickEnemies — true면 그 적의 이동·공격을 건너뜀) */
    kitEnemyHeld(e, dt) {
        if (!(e.kitFearT > 0)) return false;
        e.kitFearT -= dt;
        e.x += (e.speed || 60) * 0.6 * dt;
        if (e.dom) e.dom.style.left = `${e.x}px`;
        if (e.kitFearT <= 0) this.updateEnemyFilter(e);
        return true;
    },
    /** 상태 아이콘 이름 (updateEnemyFilter) */
    kitStates(e) {
        return [e.kitFearT > 0 && 'fear', e.kitSleepT > 0 && 'sleep', e.kitDots?.burn?.t > 0 && 'burn', e.kitDots?.poison?.t > 0 && 'poison',
            e.kitVulnT > 0 && 'vuln', e.kitWeakT > 0 && 'weak', e.kitThreadT > 0 && 'thread', (e.kitSilenceT > 0 || this.supportSilenced?.(e)) && 'silence'].filter(Boolean);
    },

    // ---- 장판 ----
    /** o: { x(frontX 기준), w, sec, dps(×playerDps), slow?, vuln?[초,비율], status?(every초마다), every?, heal?(안에 있으면 나 초당 비율), allyHeal?,
     *       puff(이펙트), puffEvery?, baseMul?, follow?(나를 따라옴), end?{ dmg, radius, vfx }, wall?(보스가 아닌 적은 넘어오지 못함),
     *       field?(imageEffects.js IMAGE_FIELDS 키): 판정 폭·수명과 함께 움직이는 이미지 장판,
     *       art?{ cls(ui_v2.css 모양 — 철골 바리케이드·음파 장막), w?, h?, dx? } (장판 자리에 세우는 그림, 끝나면 무너지며 사라짐) } */
    kitZone(o) {
        const x = (o.follow ? this.monsterX + 60 : this.frontX()) + (o.x ?? 0);
        const z = { puffT: 0, tickT: 0, ...o, x, t: o.sec, ox: o.x ?? 0 };
        if (o.art && this.domEnemies) {
            const el = document.createElement('div');
            el.className = `v2-kit-art ${o.art.cls || ''}`;
            el.style.width = `${o.art.w ?? o.w}px`;
            if (o.art.h) el.style.height = `${o.art.h}px`;
            this.domEnemies.appendChild(el);
            z.artEl = el;
            z.artDx = o.art.dx ?? 0;
            el.style.left = `${x + z.artDx}px`;
        }
        this.kitZones.push(z);
        if (o.field) {
            playImageField(this.fx, o.field, z.w, z.sec, () => [z.x + z.w / 2, FOOT_B],
                () => z.t > 0 && this.kitZones.includes(z), () => z.t);
        }
    },
    /** 그림 있는 장판: 자리 맞추기 / 끝나면 무너지며 사라짐 */
    kitZoneArt(z, gone = false) {
        if (!z.artEl) return;
        if (!gone) { z.artEl.style.left = `${z.x + z.artDx}px`; return; }
        const el = z.artEl;
        z.artEl = null;
        el.classList.add('is-gone');
        setTimeout(() => el.remove(), 450);
    },
    tickKitZones(dt) {
        if (!this.kitZones.length) return;
        this.kitZones = this.kitZones.filter(z => {
            z.t -= dt;
            if (z.follow) z.x = this.monsterX + 60 + z.ox;
            this.kitZoneArt(z);
            if (z.t <= 0) {
                this.kitZoneArt(z, true);
                if (z.end) {
                    const cx = z.x + z.w / 2;
                    if (z.end.vfx) this.fx.play(z.end.vfx, cx, FOOT_B);
                    this.enemies.filter(e => Math.abs(aimOf(e).x - cx) <= (z.end.radius ?? z.w / 2 + 40))
                        .forEach(e => {
                            this.dealDamageToEnemy(e, this.unit() * (z.end.dmg || 0), false, { knock: 0.8 });
                            if (z.end.status && this.enemies.includes(e)) this.kitStatus(e, z.end.status);
                        });
                }
                return false;
            }
            z.puffT -= dt;
            if (z.puff && z.puffT <= 0) {
                z.puffT = z.puffEvery || 0.35;
                const offset = Math.random() * z.w;
                this.fx.play(z.puff, z.x + offset, FOOT_B + (z.puffB ?? 8), { scale: z.scale || 1,
                    ...(z.field ? { follow: () => [z.x + offset, FOOT_B + (z.puffB ?? 8)],
                        alive: () => z.t > 0 && this.kitZones.includes(z) } : {}) });
            }
            z.tickT -= dt;
            const statusNow = z.status && z.tickT <= 0;
            if (statusNow) z.tickT = z.every || 1;
            [...this.enemies].forEach(e => {
                const cx = e.isBuilding || e.isBarricade ? e.x + 12 : aimOf(e).x;
                if (cx < z.x || cx > z.x + z.w) return;
                if (z.slow && isUnit(e)) {
                    const fresh = !(e.slowT > 0);
                    e.slowT = Math.max(e.slowT || 0, 0.4);
                    if (fresh) this.updateEnemyFilter(e);
                }
                if (z.vuln) this.kitStatus(e, { vuln: [0.4, z.vuln] });
                if (z.pull && isUnit(e) && !e.boss && e.dom) {   // 소용돌이: 가운데로
                    const d = z.x + z.w / 2 - cx;
                    e.x += Math.sign(d) * Math.min(Math.abs(d), z.pull * dt);
                    e.dom.style.left = `${e.x}px`;
                }
                if (statusNow) this.kitStatus(e, z.status);
                if (z.dps) this.dealDamageToEnemy(e, this.playerDps * z.dps * (e.isBuilding ? (z.baseMul || 1) : 1) * dt, false, { dot: true });
            });
            const me = this.monsterX + 60;
            if (z.heal && me >= z.x && me <= z.x + z.w) this.kitHeal(this.maxPlayerHp * z.heal * dt);
            if (z.allyHeal) this.allies.forEach(a => {
                if (a.x + 30 < z.x || a.x + 30 > z.x + z.w) return;
                a.hp = Math.min(a.maxHp, a.hp + a.maxHp * z.allyHeal * dt);
                if (a.hpBar) a.hpBar.style.width = `${(a.hp / a.maxHp) * 100}%`;
            });
            return true;
        });
    },
    /** 강철 방벽(장판 wall): 보스가 아닌 적은 벽 오른쪽 끝에서 멈춤 (enemyField.js tickEnemies) */
    kitWallHold(e) {
        if (!isUnit(e) || e.boss || !this.kitZones.length) return;
        for (const z of this.kitZones) {
            if (!z.wall) continue;
            const cx = aimOf(e).x, edge = z.x + z.w;
            if (cx < z.x || cx >= edge) continue;
            e.x += edge - cx;
            if (e.dom) e.dom.style.left = `${e.x}px`;
        }
    },

    /** 걷는 동안 장판도 바닥과 같이 흘러감 (sets.js scrollZones) */
    scrollKit(dt) {
        const d = this.groundSpeed() * dt;
        this.kitZones.forEach(z => { if (!z.follow) z.x -= d; });
        this.kitWaves.forEach(w => { w.x -= d; w.start -= d; });
    },

    // ---- 움직이는 판정 ----
    /** o: { x, dir?, speed, dist, w(반폭), dmg, status?, knock?, push?(맞을 때마다 밀기 px), every?(다시 맞는 간격), back?, vfx?, vfxEvery?, b?, baseMul?, hitVfx? } */
    kitWave(o) {
        this.kitWaves.push({ dir: 1, speed: 420, w: 50, every: 0, vfxEvery: 0.1, b: FOOT_B + 40, ...o, start: o.x, gone: 0, vfxT: 0, hit: new Map() });
        if (o.sfx) sound.play(o.sfx, { vol: 0.7 });
    },
    tickKitWaves(dt) {
        if (!this.kitWaves.length) return;
        this.kitWaves = this.kitWaves.filter(w => {
            const step = w.speed * dt;
            w.x += step * w.dir;
            w.gone += step;
            w.vfxT -= dt;
            if (w.vfx && w.vfxT <= 0) {
                w.vfxT = w.vfxEvery;
                this.fx.play(w.vfx, w.x, w.b, { scale: w.scale || 1 });
            }
            const now = this.stats.time;
            [...this.enemies].forEach(e => {
                const cx = e.isBuilding || e.isBarricade ? e.x + 12 : aimOf(e).x;
                if (Math.abs(cx - w.x) > w.w) return;
                const last = w.hit.get(e);
                if (last != null && (!w.every || now - last < w.every)) return;
                w.hit.set(e, now);
                const mul = e.isBuilding ? (w.baseMul ?? 1) : 1;
                if (w.dmg) this.dealDamageToEnemy(e, this.unit() * w.dmg * mul, false, { knock: w.knock ?? 0.6 });
                if (w.hitVfx && this.enemies.includes(e)) this.fx.play(w.hitVfx, cx, aimOf(e).b);
                if (w.status && this.enemies.includes(e)) this.kitStatus(e, w.status);
                if (w.push && isUnit(e) && !e.boss && !e.knockResist && this.enemies.includes(e)) {
                    e.x += w.push * w.dir;
                    if (e.dom) e.dom.style.left = `${e.x}px`;
                    this.kitPushed(e);
                }
            });
            if (w.gone < w.dist) return true;
            if (w.back && w.dir === 1) {   // 되돌아옴: 다시 맞을 수 있게
                w.dir = -1;
                w.gone = 0;
                w.dist = Math.max(40, w.x - (this.monsterX + 80));
                w.hit = new Map();
                return true;
            }
            return false;
        });
    },
    /** 끌려오거나 밀린 적 (패시브 심연의 주인·해류 타기: 잠시 취약) */
    kitPushed(e) {
        const v = this.kitPassive?.pushedVuln;
        if (v) this.kitStatus(e, { vuln: v });
        const st = this.kitPassive?.pushedStun;   // 조류 지배: 끌려오거나 밀린 적 기절
        if (st && this.enemies.includes(e)) this.kitStatus(e, { stun: st });
        if (this.setFxReady('kitPushedFire', 0.1)) this.kitFire('pushed', { enemy: e });   // 유령선 선장 2부위: 게이지
    },

    // ---- 소환 ----
    /** o: { art(적 그림 id), filter?, hp(×최대 체력), dps(×playerDps), speed(×진격 속도, 기본 0.6), life(초), scale?, label?, color?, hit?(1초마다 상태), blast?{dmg, radius} } */
    spawnKitAlly(x, o) {
        if (!this.domEnemies) return;
        ensureEnemyStyles();
        const art = ENEMY_ART[o.art] || ENEMY_ART.guard;
        const bases = this.enemies.filter(e => e.isBuilding);
        if (bases.length) x = Math.min(x, Math.min(...bases.map(e => e.x)) - 40);
        const el = document.createElement('div');
        el.className = 'ally-minion v2-kit-ally';
        const id = o.art in ENEMY_ART ? o.art : 'guard';
        el.style.cssText = `left:${x}px;--w:${art.frameWidth}px;--h:${art.frameHeight}px;--k:${o.scale || 1};`
            + `--walk:url('${art.walk.src}');--walk-anim:v2-${id}-walk ${art.walk.duration}s steps(${art.walk.frames}) infinite;`
            + `--atk:url('${(art.attack || art.walk).src}');--atk-anim:v2-${id}-${art.attack ? 'attack' : 'walk'} ${(art.attack || art.walk).duration}s steps(${(art.attack || art.walk).frames}) infinite;`
            + `--ally-filter:${o.filter || 'none'};bottom:${ART_FOOT_B}px`;
        const hpBar = document.createElement('div');
        hpBar.className = 'ally-hp';
        hpBar.style.width = '100%';
        if (o.color) { hpBar.style.background = o.color; hpBar.style.boxShadow = `0 0 6px ${o.color}`; }
        el.appendChild(hpBar);
        this.domEnemies.appendChild(el);
        const maxHp = Math.round(this.maxPlayerHp * (o.hp ?? 0.15));
        const ally = { id: `kit_${Date.now()}_${Math.random()}`, kind: 'kit', x, hp: maxHp, maxHp, dps: this.playerDps * (o.dps ?? 0.25),
            speed: this.playerSpeed * (o.speed ?? 0.6), dom: el, hpBar, kitLife: o.life ?? 10, kitHit: o.hit || null, kitHitT: 0, kitBlast: o.blast || null };
        this.allies.push(ally);
        if (o.vfx) this.fx.play(o.vfx, x + 38, FOOT_B);
        if (o.label) this.createDamagePopup(x, 180, o.label, false);
        return ally;
    },
    tickKitAllies(dt) {
        for (const a of [...this.allies]) {
            if (a.kind !== 'kit') continue;
            a.kitLife -= dt;
            if (a.kitLife <= 0) { this.removeAlly(a); continue; }
            if (a.kitHit && a.attacking) {
                a.kitHitT -= dt;
                if (a.kitHitT <= 0) {
                    a.kitHitT = 1;
                    const t = this.enemies.filter(e => e.x - a.x >= -35 && e.x - a.x <= 70)[0];
                    if (t) this.kitStatus(t, a.kitHit);
                }
            }
        }
    },
    /** 아군이 사라질 때 (allies.js removeAlly): 소환물 폭발 · 다시 소환 (군단 보급) */
    kitOnAllyDown(ally) {
        if (!this.isActive) return;
        if (ally.kind === 'kit' || ally.kind === 'chimera' || ally.kind === 'rabbit') this.fx.play(KIT_FX.poof, ally.x + 38, FOOT_B);
        if (ally.kitBlast) {
            const cx = ally.x + 38;
            this.enemies.filter(e => Math.abs(aimOf(e).x - cx) <= (ally.kitBlast.radius ?? 90))
                .forEach(e => this.dealDamageToEnemy(e, this.unit() * ally.kitBlast.dmg, false, { knock: 0.6 }));
        }
        this.kitFire('allyDown', { ally });
    },

    // ---- 변신 ----
    /** o: { key, sec, giant?, mods?, attack?(새 기본 공격), vfx? } */
    kitTransform(o) {
        this.kitXform = { t: o.sec, duration: o.sec, attack: o.attack || null, giant: o.giant || 1, key: o.key };
        if (o.giant && o.giant !== 1) monsterControllerV2.rigBattle?.setGiant?.(o.giant);
        if (o.mods) this.addKitBuff(`xform_${o.key}`, o.sec, o.mods, o.vfx || null);
        sound.play('rampage_roar', { vol: 0.7 });
    },
    tickKitXform(dt) {
        const x = this.kitXform;
        if (!x) return;
        x.t -= dt;
        if (x.t > 0) return;
        if (x.giant !== 1) monsterControllerV2.rigBattle?.setGiant?.(1);
        this.kitXform = null;
    },

    // ---- 새 기본 공격 (attackType 'kit' — 파츠 kitAttack, 변신 중이면 변신 공격) ----
    /** def: { kind: 'shot'|'lob'|'melee'|'pierce'|'chain'|'multi', vfx?, hitVfx?, color?, splash?, splashMul?, n?, gap?, decay?, jump?, status?, statusPick?[] } */
    fireKitAttack(target, dmg, isCrit) {
        const def = this.kitXform?.attack || this.kitAttackDef;
        if (!def) return false;
        const extraN = this.kitPatch?._attack?.n || 0;   // 세트 효과: 연쇄 번개 +1 등
        const nth = def.nth && (this.kitNthN = (this.kitNthN || 0) + 1) % def.nth.n === 0;   // N번째 공격마다 상태 (종 추: 3번째 기절)
        const st0 = def.statusPick ? def.statusPick[Math.floor(Math.random() * def.statusPick.length)] : def.status;
        const status = nth ? { ...(st0 || {}), ...def.nth.status } : st0;
        const hit = (e, d, crit = false) => {
            if (!this.enemies.includes(e)) return;
            if (def.hitVfx) this.fx.play(def.hitVfx, aimOf(e).x, aimOf(e).b);
            this.dealDamageToEnemy(e, d, crit, { knock: def.knock ?? 0.6, pierce: def.pierce });
            if (status && this.enemies.includes(e)) this.kitStatus(e, status);
            if (def.onHit && this.enemies.includes(e)) def.onHit(this, e);
        };
        const splash = (x, d) => {
            if (!def.splash) return;
            this.enemies.filter(o => o !== target && Math.abs(aimOf(o).x - x) <= def.splash).forEach(o => hit(o, d * (def.splashMul ?? 0.5)));
        };
        const muzzle = monsterControllerV2.getMuzzlePoint() || { x: this.monsterX + 90, bottom: 125 };
        switch (def.kind) {
            case 'shot':
            case 'lob': {
                let aim = aimOf(target);
                const go = () => this.fx.launchOrb(muzzle, () => { if (this.enemies.includes(target)) aim = aimOf(target); return aim; },
                    def.color || '255, 200, 120', def.dur ?? (def.kind === 'lob' ? 0.45 : 0.25), () => {
                        if (!this.isActive) return;
                        if (def.vfx) this.fx.play(def.vfx, aim.x, aim.b);
                        hit(target, dmg / n, isCrit);
                        splash(aim.x, dmg / n);
                    }, def.sfx ?? null);
                const n = (def.n || 1) + extraN;   // 여러 발이면 피해를 나눔 (쌍열 포격)
                for (let i = 0; i < n; i++) this.schedule(i * (def.gap ?? 0.1), go);
                break;
            }
            case 'pierce': {
                const range = this.playerRange + (def.extra || 0);
                if (def.vfx) this.fx.play(def.vfx, muzzle.x, muzzle.bottom, { to: [this.frontX() + range, aimOf(target).b] });
                let mul = 1;
                this.enemiesInRange(range).slice(0, def.n || 3).forEach((e, i) => { hit(e, dmg * mul, isCrit && i === 0); mul *= (def.decay ?? 0.7) * PIERCE2.kitDecay; });   // 관통 2차 (D-119)
                break;
            }
            case 'chain': {
                const done = new Set();
                let cur = target, from = [muzzle.x, muzzle.bottom];
                for (let i = 0; i < (def.n || 3) + extraN && cur; i++) {
                    const e = cur, to = [aimOf(e).x, aimOf(e).b], f = from;
                    done.add(e);
                    this.schedule(i * 0.06, () => { if (def.vfx) this.fx.play(def.vfx, f[0], f[1], { to }); hit(e, dmg * Math.pow(def.decay ?? 0.6, i), isCrit && i === 0); });
                    from = to;
                    cur = this.enemies.filter(o => !done.has(o) && Math.abs(aimOf(o).x - to[0]) <= (def.jump ?? 160))
                        .sort((p, q) => Math.abs(aimOf(p).x - to[0]) - Math.abs(aimOf(q).x - to[0]))[0];
                }
                break;
            }
            default: {   // melee · multi: 맞힌 적 + 휩쓸기 (세트 효과로 연타 +n — 설원 검무 4부위)
                const n = (def.n || 1) + extraN;
                for (let i = 0; i < n; i++) {
                    this.schedule(i * (def.gap ?? 0.09), () => {
                        if (!this.enemies.includes(target)) return;
                        const a = aimOf(target);
                        if (def.vfx) this.fx.play(def.vfx, a.x, a.b + 5);
                        hit(target, dmg / n * (def.n ? 1 : 1), isCrit && i === 0);
                        splash(a.x, dmg / n);
                    });
                }
            }
        }
        return true;
    },

    // ---- 계기 (패시브·세트 효과 on: [{ when, ... }]) ----
    /** when: 'ult' | 'skill' | 'kill' | 'allyDown' | 'lowHp' | 'attack' — 맞으면 실행: buff · step · resetCd · gauge · heal · summon */
    kitFire(when, info = {}) {
        for (const t of this.kitTriggers || []) {
            if (t.when !== when) continue;
            if (t.slot && info.skill && info.skill.slot !== t.slot) continue;
            if (t.skillId && info.skill && info.skill.id !== t.skillId) continue;
            if (t.chance != null && Math.random() >= t.chance) continue;
            if (t.status && info.enemy && !this.kitHasStatus(info.enemy, t.status)) continue;
            if (t.flag && !this.kitFlag(t.flag)) continue;
            if (t.inZone && info.enemy && !this.kitZones.some(z => z.tag === t.inZone && aimOf(info.enemy).x >= z.x && aimOf(info.enemy).x <= z.x + z.w)) continue;
            if (t.once) {
                const key = `${t.set || 'p'}_${when}_${t.once}`;
                if (this.kitOnce[key]) continue;
                this.kitOnce[key] = true;
            }
            if (t.max) {
                const key = `${t.set || 'p'}_${when}_max`;
                this.kitOnce[key] = (this.kitOnce[key] || 0) + 1;
                if (this.kitOnce[key] > t.max) continue;
            }
            const go = () => {
                if (!this.isActive) return;
                if (t.buff) this.addKitBuff(t.buff.key || `t_${when}`, t.buff.sec, t.buff.mods, t.buff.vfx || null);
                if (t.step) runKitStep(this, t.step);
                if (t.resetCd) t.resetCd.forEach(s => { this.skillCd[s] = 0; });
                if (t.gauge) this.ultGauge = Math.min(1, this.ultGauge + t.gauge);
                if (t.heal) this.kitHeal(this.maxPlayerHp * t.heal);
                if (t.summon) this.spawnKitAlly((info.enemy ? info.enemy.x : this.monsterX + 70), t.summon);
                if (t.xform) this.kitTransform({ key: t.xform.key || when, ...t.xform });
                if (t.fn) t.fn(this, info);
                if (t.label) this.createDamagePopup(this.monsterX + 40, 220, t.label, false);
                if (t.vfx) this.fx.play(t.vfx, this.monsterX + 35, FOOT_B);
            };
            if (t.delay) this.schedule(t.delay, go); else go();
        }
    },
    /** 슬롯 스킬을 값 없이 바로 씀 (게이지·쿨다운 그대로 — 세트 효과 계기용) */
    useSkillFree(slot) {
        const sk = this.skills?.[slot];
        if (sk && this.isActive && !this.playerStunned()) sk.use(this.skillCaster(slot));
    },

    /** 스킬을 쓸 때 (skillKit_v2.js kitSkill.use · 기존 스킬은 attacks.js useSkill) */
    kitOnSkill(skill) {
        const ps = this.kitPassive;
        if (ps?.onSkill) this.addKitBuff('p_onSkill', ps.onSkill.sec, ps.onSkill.mods, null,
            { name: ps.name, icon: 'overdrive', color: '#ffcf83' });
        if (ps?.nextMul) this.kitNextMul = Math.max(this.kitNextMul, ps.nextMul);
        this.kitFire(skill.slot === 'head' ? 'ult' : 'skill', { skill });
    },
    /** 기본 공격 1타 (fireAttack): 다음 공격 배율을 돌려줌 + N번째 공격 덤 */
    kitOnAttack(target) {
        let mul = 1;
        if (this.kitNextMul > 1) { mul = this.kitNextMul; this.kitNextMul = 1; }
        const ch = this.kitPassive?.charge;   // 보행 충전: 찬 전기를 이번 공격에
        if (ch && this.kitCharged && target) {
            this.kitCharged = false;
            mul = Math.max(mul, ch.mul || 1);
            if (ch.step) this.schedule(0.06, () => { if (this.isActive) runKitStep(this, ch.step); });
        }
        const ev = this.kitPassive?.every;
        if (ev && target) {
            this.kitAttackN += 1;
            if (this.kitAttackN % ev.n === 0) this.schedule(0.08, () => { if (this.isActive) runKitStep(this, ev.step); });
        }
        const onHit = Object.values(this.kitBuffs).find(b => b.mods.onHit)?.mods.onHit;
        if (onHit && target) this.schedule(0.05, () => { if (this.isActive) runKitStep(this, onHit); });
        if (this.kitPassive?.hitStatus && target) this.schedule(0.02, () => this.kitStatus(target, this.kitPassive.hitStatus));
        const buffStatus = Object.values(this.kitBuffs).find(b => b.mods.hitStatus)?.mods.hitStatus;
        if (buffStatus && target) this.schedule(0.02, () => this.kitStatus(target, buffStatus));
        return mul;
    },
    /** 적이 쓰러질 때 (enemyField.js onEnemyKilled) */
    kitOnKill(enemy) {
        if (enemy.kitRefund) {   // 사냥 개시: 표식 적이 쓰러지면 필살기 게이지를 돌려받음
            this.ultGauge = Math.min(1, this.ultGauge + enemy.kitRefund);
            this.createDamagePopup(this.monsterX + 40, 220, `사냥 성공! 게이지 +${Math.round(enemy.kitRefund * 100)}%`, false);
        }
        const rb = Object.values(this.kitBuffs).find(bf => bf.mods.raise > (bf.raised || 0));   // 구원의 비·치유의 비 등: 그동안 쓰러진 적 n명을 꿰맨 아군으로
        if (rb && this.kitRaiseAlly(enemy)) rb.raised = (rb.raised || 0) + 1;
        const k = this.kitPassive?.onKill;
        if (k) {
            if (k.heal) this.kitHeal(this.maxPlayerHp * k.heal);
            if (k.gauge) this.ultGauge = Math.min(1, this.ultGauge + k.gauge);
            if (k.summon && Math.random() < (k.chance ?? 1) && this.allies.filter(a => a.kitTag === k.summon.tag).length < (k.summon.max ?? 3)) {
                const a = this.spawnKitAlly(enemy.x, k.summon);
                if (a) a.kitTag = k.summon.tag;
            }
            if (k.grow && (this.kitGrow || 0) < k.grow.max) {   // 포식 성장: 쓰러뜨릴 때마다 최대 체력 + (판 안, 최대 max), 몸이 조금씩 커짐
                const add = Math.min(k.grow.hp, k.grow.max - (this.kitGrow || 0));
                this.kitGrow = (this.kitGrow || 0) + add;
                const hp = (this.kitBaseHp ||= this.maxPlayerHp) * add;
                this.maxPlayerHp += hp;
                this.playerHp += hp;
                monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
                if (!this.kitXform) monsterControllerV2.rigBattle?.setGiant?.(1 + (k.grow.size || 0.15) * (this.kitGrow / k.grow.max));
            }
        }
        this.kitFire('kill', { enemy });
    },
    /** 적이 빙결될 때 (frost.js freezeEnemy): 패시브 onFreeze.spread — 가장 가까운 다른 적에 냉기 (얼음 왕국) */
    kitOnFreeze(e) {
        const sp = this.kitPassive?.onFreeze?.spread;
        if (!sp || !this.applyChill || !this.setFxReady('kitFreezeSpread', 0.12)) return;
        const x = aimOf(e).x;
        const t = this.enemies.filter(o => o !== e && isUnit(o) && o.hp > 0 && !(o.frozenT > 0) && Math.abs(aimOf(o).x - x) < 220)
            .sort((p, q) => Math.abs(aimOf(p).x - x) - Math.abs(aimOf(q).x - x))[0];
        if (!t) return;
        this.fx.play(fxOf({ type: 'bolt', at: 0, dur: 0.2, count: 1, jag: 8, branches: 0, width: 2, color: '170, 230, 255' }), x, aimOf(e).b, { to: [aimOf(t).x, aimOf(t).b] });
        this.applyChill(t, sp);
    },
    /** 빙결이 풀릴 때 (frost.js tickFrost): 패시브 thaw — 그 적이 잠시 취약 (동상) */
    kitOnThaw(e) {
        const th = this.kitPassive?.thaw;
        if (th && this.enemies.includes(e)) this.kitStatus(e, { vuln: th });
    },
    /** 얼어 있는 적을 깨뜨릴 때 (skillKit_v2.js kitHit shatter) */
    kitOnShatter(e) {
        this.fx.play(fxOf(spr('ice_shatter', 120, { anchorY: 0.85, dur: 0.4 })), aimOf(e).x, FOOT_B);
        this.kitFire('shatter', { enemy: e });
    },

    /** 쓰러진 적을 꿰맨 아군으로 (봉합 성녀 riseAlly — 아군 상한 = SAINT.allyMax + 값 allyMax). 됐으면 true */
    kitRaiseAlly(e) {
        if (!e || !this.riseAlly || e.isBuilding || e.isBarricade || e.boss) return false;
        if (this.allies.length >= SAINT.allyMax + this.kitMod('allyMax')) return false;
        this.riseAlly(e.x, e.artKey || e.type, e.maxHp, e.dps);
        return true;
    },
    /** 붉은 실로 이어진 적이 피해를 받으면 이어진 다른 적에게 share만큼 (enemyField.js dealDamageToEnemy) */
    kitThreadShare(e, damage) {
        const others = this.enemies.filter(o => o !== e && o.kitThreadT > 0 && o.hp > 0);
        if (!others.length || damage <= 0) return;
        const d = damage * 0.3;
        others.forEach(o => this.dealDamageToEnemy(o, d, false, { dot: true, share: true }));
        if (this.setFxReady('kitThreadFx', 0.35)) {
            const o = others[0];
            this.fx.play(fxOf({ type: 'bolt', at: 0, dur: 0.25, count: 1, jag: 6, branches: 0, width: 2, color: '255, 60, 80' }), aimOf(e).x, aimOf(e).b, { to: [aimOf(o).x, aimOf(o).b] });
        }
    },

    /** 걸음 이벤트 (battle_v2.js onRigEvent 'step'/'stomp') */
    kitOnStep() {
        const st = this.kitPassive?.step;
        if (!st || this.playerStunned()) return;
        runKitStep(this, st);
    },

    // ---- 매 프레임 ----
    tickKit(dt) {
        this.kitModCache = null;
        for (const [key, b] of Object.entries(this.kitBuffs)) {
            b.t -= dt;
            if (b.t > 0) continue;
            delete this.kitBuffs[key];
            if (b.mods.onEnd) runKitStep(this, b.mods.onEnd);   // 끝날 때 (수정 폭발·깃털 폭발 등)
        }
        this.kitModCache = null;
        this.kitHpT = (this.kitHpT || 0) + dt;   // 체력 기록 0.5초마다 (시간 되감기: 3초 전 체력)
        if (this.kitHpT >= 0.5) {
            this.kitHpT = 0;
            (this.kitHpLog ||= []).push(this.playerHp);
            if (this.kitHpLog.length > 8) this.kitHpLog.shift();
        }
        const regen = this.kitMod('regen');
        if (regen > 0) this.kitHeal(this.maxPlayerHp * regen * dt);
        const drain = this.kitMod('drain');   // 동력 과부하: 초당 체력 비율을 잃음 (1 아래로는 안 내려감)
        if (drain > 0 && this.playerHp > 1) {
            this.playerHp = Math.max(1, this.playerHp - this.maxPlayerHp * drain * dt);
            monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
        }
        // 공격 속도 = 공격 동작 빠르기 (오버드라이브와 겹치면 큰 쪽)
        const atk = Math.max(this.buffs?.overdrive ? SET.overdrive.atk : 1, 1 + this.kitMod('atkSpd'));
        if (Math.abs(atk - (monsterControllerV2.animBoost ?? 1)) > 0.01) monsterControllerV2.setAnimBoost(atk);
        if (this.kitBlockT > 0) this.kitBlockT -= dt;
        const me = this.monsterX + 60;
        const onHaz = (this.hazards || []).some(h => me >= h.x && me <= h.x + h.w) || this.kitZones.some(z => me >= z.x && me <= z.x + z.w);
        if (onHaz !== !!this.kitOnHazard) { this.kitOnHazard = onHaz; this.kitModCache = null; }
        this.kitStillT = this.isAttacking || this.enemiesInRange(this.playerRange).length ? this.kitStillT + dt : 0;
        const ev = this.kitPassive?.periodic;   // 가속 태엽: every초마다 sec초 버프
        if (ev) {
            this.kitEveryT += dt;
            if (this.kitEveryT >= ev.every) { this.kitEveryT = 0; this.addKitBuff('p_periodic', ev.sec, ev.mods); }
        }
        const ch = this.kitPassive?.charge;   // 보행 충전: 걷는 동안 sec초 쌓이면 다음 기본 공격 mul배 + step
        if (ch && !this.kitCharged && this.groundSpeed() > 0 && !this.playerStunned()) {
            this.kitChargeT += dt;
            this.kitChargeFxT -= dt;
            if (ch.fx && this.kitChargeFxT <= 0) { this.kitChargeFxT = 0.8; this.fx.play(ch.fx, this.monsterX + 40 + Math.random() * 40, FOOT_B + 10); }
            if (this.kitChargeT >= ch.sec) {
                this.kitCharged = true;
                this.kitChargeT = 0;
                this.fx.play(KIT_FX.awaken, this.monsterX + 35, FOOT_B);
                this.createDamagePopup(this.monsterX + 40, 220, ch.label || '충전 완료!', false);
            }
        }
        const ac = this.kitPassive?.afterCc;   // 부력 추진: 기절·속박이 풀린 뒤 sec초 버프
        if (ac) {
            const held = this.playerStunned() || this.pRootT > 0;
            if (this.kitWasHeld && !held) this.addKitBuff('p_afterCc', ac.sec, ac.mods);
            this.kitWasHeld = held;
        }
        const fh = this.kitPassive?.firstHit;   // 돌격 자세: 걷다가 멈춘 뒤 첫 기본 공격 배수
        if (fh) {
            const walking = this.groundSpeed() > 0;
            if (this.kitWasWalking && !walking) this.kitNextMul = Math.max(this.kitNextMul, fh);
            this.kitWasWalking = walking;
        }
        const ls = this.kitPassive?.lastStand;
        if (ls && !this.kitOnce.lastStand && this.playerHp > 0 && this.playerHp < this.maxPlayerHp * ls.below) {
            this.kitOnce.lastStand = true;
            this.addKitBuff('p_lastStand', ls.sec, ls.mods || { flags: ['invuln'] }, KIT_FX.awaken);
            this.createDamagePopup(this.monsterX + 40, 220, ls.label || '버팀!', false);
        }
        if (this.playerHp > 0 && this.playerHp < this.maxPlayerHp * 0.3) this.kitFire('lowHp');
        // 적 상태 (화상·독·취약·약화·잠)
        [...this.enemies].forEach(e => {
            if (e.kitVulnT > 0) { e.kitVulnT -= dt; if (e.kitVulnT <= 0) this.updateEnemyFilter(e); }
            if (e.kitWeakT > 0) { e.kitWeakT -= dt; if (e.kitWeakT <= 0) this.updateEnemyFilter(e); }
            if (e.kitSleepT > 0) { e.kitSleepT -= dt; if (e.kitSleepT <= 0) this.updateEnemyFilter(e); }
            if (e.kitThreadT > 0) { e.kitThreadT -= dt; if (e.kitThreadT <= 0) this.updateEnemyFilter(e); }
            if (e.kitSilenceT > 0) { e.kitSilenceT -= dt; if (e.kitSilenceT <= 0) this.updateEnemyFilter(e); }
            if (!e.kitDots) return;
            for (const [kind, d] of Object.entries(e.kitDots)) {
                if (!(d.t > 0)) continue;
                d.t -= dt;
                d.fx -= dt;
                if (d.fx <= 0) { d.fx = 0.5; this.fx.play(DOT_FX[kind], aimOf(e).x, aimOf(e).b); }
                this.dealDamageToEnemy(e, d.dps * dt, false, { dot: true });
                if (d.t <= 0 && this.enemies.includes(e)) this.updateEnemyFilter(e);
            }
        });
        this.tickKitZones(dt);
        this.tickKitWaves(dt);
        this.tickKitAllies(dt);
        this.tickKitXform(dt);
    }
};
