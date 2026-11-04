// 협력 출격 전용 시전자/타이머/표식. 주인공 스킬의 전역 monster 참조를 사용하지 않는다.
import { progress } from '../progress_v2.js';
import { SUPPORT as T, supportUnitOf } from '../support_v2.js';
import { rosterOf } from '../roster_v2.js';
import { RigAvatar, rigConfigFor } from '../rig/rigAvatar.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';
import { gameTime } from '../gameTime.js';
import { aimAt } from '../bases_v2.js';
import { sound } from '../audio/sound_v2.js';
import { MECH_VFX, KAIJU_VFX, HERO_VFX, CHIMERA_VFX, DIVER_VFX, SAINT_VFX, FROST_VFX, DOLL_VFX, meleeHitVfx } from '../vfx/vfxDefs.js';

const VFX = { mech: MECH_VFX.droneBlast, kaiju: KAIJU_VFX.roarBurst, hero: HERO_VFX.mindConvert,
    chimera: CHIMERA_VFX.slam, diver: DIVER_VFX.hands, saint: SAINT_VFX.corpseRise,
    frost: FROST_VFX.encase, doll: DOLL_VFX.puppetHit };
const HIT = { mech: MECH_VFX.laserHit, kaiju: KAIJU_VFX.biteHit, hero: HERO_VFX.waveHit,
    chimera: CHIMERA_VFX.clawHit, diver: DIVER_VFX.jetHit, saint: SAINT_VFX.needleHit,
    frost: FROST_VFX.fanHit, doll: DOLL_VFX.snipHit };
const MELEE = new Set(['melee', 'scissors']);
const AREA = new Set(['rail', 'water', 'wave', 'frost', 'missile', 'shotgun', 'orb', 'spit', 'melee', 'scissors']);
const solid = e => e.isBuilding || e.isBarricade;

export const SupportMethods = {
    setupSupport() {
        this.clearSupport();
        const main = monster.getCharacterId() || progress.character;
        const snapshot = progress.supportSnapshot(main);
        const interval = snapshot?.cooldown ?? progress.supportCooldown();
        this.support = { snapshot, interval, cooldown: interval, serial: 0, active: null, auto: !!progress.supportAuto };
        this.supportShield = 0;
        this.stats.supportCalls = 0;
        this.stats.supportUltimates = 0;
        this.stats.supportBasicAttacks = 0;
        this.stats.supportDamage = 0;
    },
    supportTargets() {
        return this.enemies.filter(e => e.hp > 0 && e.x >= this.monsterX - 80 && e.x <= this.frontX() + T.range)
            .sort((a, b) => a.x - b.x);
    },
    supportStatus() {
        const s = this.support;
        const active = s?.active;
        const targets = this.supportTargets();
        const defensive = s?.snapshot?.id === 'saint' && this.overloadT <= 0 &&
            (this.playerHp < this.maxPlayerHp || this.allies.some(a => a.hp < a.maxHp));
        const cooldown = s?.cooldown || 0;
        return { ready: !!s?.snapshot && cooldown === 0 && !active,
            hasTarget: targets.length > 0 || defensive, cooldown,
            charge: s?.snapshot ? Math.max(0, Math.min(1, 1 - cooldown / s.interval)) : 0,
            time: active ? Math.max(0, active.duration - active.elapsed) : 0 };
    },
    callSupport() {
        const status = this.supportStatus();
        if (!this.isActive || this.cinematic || this.finalBaseDestroyed || this.timeUp || gameTime.paused ||
            document.querySelector('.v2-opcard') ||
            document.querySelector('.v2-settings') || !status.ready || !status.hasTarget) return false;
        const s = this.support, snap = s.snapshot;
        const target = this.supportTargets()[0];
        // 협력 시간: 기본 T.duration + 주인공 세트의 전투 밖 효과(sets_v2.js SET_PERKS supportTime, 11-03) — 퇴장 시각도 같이 늦춤
        const active = { owner: `support-${this.runId}-${++s.serial}`, elapsed: 0, cast: false, casts: 0, castUntil: 0, basicAttacks: 0, nextAttack: T.attackAt,
            duration: T.duration + (snap.extraTime || 0), exitAt: T.exitAt + (snap.extraTime || 0),
            marks: new Map(), tasks: [], snapshot: snap, x: this.monsterX - 45, shieldAllies: new Set(),
            melee: MELEE.has(snap.parts.arm?.attackType || 'melee') || snap.parts.arm?.kitAttack?.kind === 'melee', target, dash: null, dashUsed: false };
        active.x = this.supportPositionX(active.melee && target ? this.supportCombatX(active, target) : active.x);
        s.active = active;
        s.cooldown = s.interval;
        this.stats.supportCalls = (this.stats.supportCalls || 0) + 1;
        const el = document.createElement('div');
        el.className = 'v2-support-actor';
        el.style.setProperty('--support', rosterOf(snap.id).color);
        el.innerHTML = '<canvas></canvas><span>CO-OP · 협력 출격</span>';
        this.domEnemies?.appendChild(el);
        active.dom = el;
        const config = rigConfigFor(snap.parts, snap.id);
        const avatar = new RigAvatar(el.querySelector('canvas'), {
            character: snap.id, width: 360, height: 300, rootX: 160, rootY: 265,
            scale: 0.22, fit: { x: 24, y: 16 }, shadow: true
        });
        active.avatar = avatar;
        avatar.setArm(config.arm);
        avatar.setUpgrades(config.upgrades);
        avatar.setVariants(config.variants);
        avatar.setPartFilters(config.filters);
        avatar.ready.then(() => {
            if (this.support?.active !== active || !this.isActive) return;
            avatar.setMode('idle');
            if (active.elapsed < active.castUntil) avatar.playSkillAnim(supportUnitOf(snap.id).clip);
            avatar.start();
        });
        this.positionSupport(active);
        sound.play('ui_equip');
        this.hud.supportNotice?.(rosterOf(snap.id).faction, `${active.duration}초 지원 · 궁극기 ${T.ultimateTimes.length}회`);
        return true;
    },
    // 몸의 앞면을 건물/바리케이드보다 왼쪽에 둔다. 먼 적 앞으로 소환해도 방벽을 건너뛰지 않는다.
    supportPositionX(x) {
        const wall = this.enemies.filter(e => e.hp > 0 && solid(e)).reduce((p, e) => Math.min(p, e.x - 100), Infinity);
        return Math.min(wall, Math.max(20, x));
    },
    supportCombatX(a, target) {
        return target.x - T.actorFront - Math.min(T.meleeGap, Math.max(70, a.snapshot.stats.range) * 0.5);
    },
    supportInRange(a, target) {
        const dx = target.x - (a.x + T.actorFront);
        return dx >= -35 && dx <= Math.max(70, a.snapshot.stats.range) + 20;
    },
    positionSupport(a, dt = 0) {
        const target = this.supportTargets()[0];
        const reach = Math.max(70, a.snapshot.stats.range);
        const desired = this.supportPositionX(a.melee ? (target ? this.supportCombatX(a, target) : a.x)
            : a.elapsed >= T.attackAt && target
                ? Math.max(this.monsterX - 45, target.x - reach - T.actorFront) : this.monsterX - 45);
        if (a.melee && a.elapsed < a.exitAt && target && a.target &&
            !this.enemies.includes(a.target) && !a.dashUsed && !this.supportInRange(a, target) && Math.abs(desired - a.x) <= T.dashRange) {
            a.dash = { from: a.x, to: desired, at: a.elapsed };
            a.dashUsed = true;
        }
        if (target) a.target = target;
        if (a.dash) {
            const u = Math.min(1, (a.elapsed - a.dash.at) / T.dashSec);
            a.x = this.supportPositionX(a.dash.from + (a.dash.to - a.dash.from) * (1 - (1 - u) ** 2));
            a.moving = true;
            if (u >= 1) a.dash = null;
        } else if (!a.melee || a.elapsed >= T.attackAt) {
            const gap = desired - a.x;
            const step = Math.max(90, a.snapshot.stats.speed) * dt;
            a.moving = Math.abs(gap) > 2;
            a.x = this.supportPositionX(a.x + Math.sign(gap) * Math.min(Math.abs(gap), step));
        }
        if (a.dom) {
            const fade = Math.min(1, a.elapsed / T.enter, (a.duration - a.elapsed) / (a.duration - a.exitAt));
            a.dom.style.left = `${a.x - 160}px`;
            a.dom.style.opacity = String(Math.max(0, fade));
            a.dom.style.transform = `translateX(${a.elapsed < T.enter ? -35 * (1 - fade) : a.elapsed > a.exitAt ? -35 * (1 - fade) : 0}px)`;
        }
    },
    tickSupport(dt) {
        const s = this.support;
        if (!s || !this.isActive) return;
        if (this.cinematic || this.finalBaseDestroyed || this.timeUp) { this.clearSupport(); return; }
        if (dt <= 0 || gameTime.paused) return;
        s.cooldown = Math.max(0, s.cooldown - dt);
        if (s.cooldown < 1e-6) s.cooldown = 0;
        if (!s.active) {
            if (s.auto && s.cooldown === 0 && s.snapshot && this.stats.time >= 2.5) {
                const targets = this.supportTargets();
                const id = s.snapshot.id;
                const danger = this.playerHp / this.maxPlayerHp <= T.autoHealth;
                const boss = targets.some(e => e.boss);
                const elites = targets.filter(e => e.elite).length >= 2;
                const crowd = targets.filter(e => !solid(e)).length >= T.autoCrowd;
                const finalPush = targets.some(e => e.isFinal) || this.timeLeft() < 20;
                const reason = id === 'saint' ? danger || boss || finalPush : boss || elites || crowd || (danger && targets.length) || finalPush;
                if (reason) this.callSupport();
            }
            return;
        }
        const a = s.active;
        a.elapsed += dt;
        if (a.elapsed >= a.duration) { this.clearSupport(); return; }
        this.positionSupport(a, dt);
        if (a.casts < T.ultimateTimes.length && a.elapsed >= T.ultimateTimes[a.casts] && a.elapsed < a.exitAt) {
            a.cast = true;
            a.casts++;
            this.stats.supportUltimates++;
            a.castUntil = a.elapsed + T.castDuration;
            a.nextAttack = Math.max(a.nextAttack, a.castUntil);
            const def = supportUnitOf(a.snapshot.id);
            a.avatar?.playSkillAnim(def.clip);
            a.dom.querySelector('span').textContent = `${def.ult} · ${a.casts}/${T.ultimateTimes.length}`;
            this.hud.supportNotice?.(rosterOf(a.snapshot.id).faction, `${def.ult} ${a.casts}/${T.ultimateTimes.length}`);
            this.supportCastFx(a, def);
            this.supportUltimate(a);
        }
        if (this.support?.active !== a) return;
        const due = a.tasks.filter(t => t.at <= a.elapsed);
        a.tasks = a.tasks.filter(t => t.at > a.elapsed);
        for (const task of due) {
            if (this.support?.active !== a || !this.isActive || this.finalBaseDestroyed) break;
            task.fn();
        }
        if (this.support?.active !== a) return;
        for (const [e, m] of a.marks) {
            if (!this.enemies.includes(e)) { e.dom?.classList.remove('v2-support-mark'); a.marks.delete(e); continue; }
            if (m.holdUntil <= a.elapsed) e.dom?.classList.remove('is-support-held');
            if (m.silenceUntil && m.silenceUntil <= a.elapsed) { m.silenceUntil = 0; this.updateEnemyFilter(e); }
            if (m.kind === 'diver') this.supportHit(a, e, a.snapshot.stats.dps * 0.12 * dt, { dot: true });
        }
        if (!a.dash && a.elapsed >= a.castUntil && a.elapsed >= a.nextAttack && a.elapsed < a.exitAt) {
            a.nextAttack += T.attacksEvery;
            const target = this.supportTargets().find(e => this.supportInRange(a, e));
            a.avatar?.setMode(target ? 'attack' : a.moving ? 'walk' : 'idle');
            if (target) {
                this.supportBasicAttack(a, target);
            }
            if (a.snapshot.id === 'doll') {
                for (const [e, m] of a.marks) {
                    if (m.holdUntil <= a.elapsed || e.boss || solid(e)) continue;
                    const victim = this.supportTargets().find(t => t !== e && !this.supportHeld(t));
                    if (victim) this.supportHit(a, victim, a.snapshot.stats.dps * 0.12);
                }
            }
        }
        if (a.elapsed >= a.exitAt) a.avatar?.setMode('idle');
    },
    supportLater(a, delay, fn) { a.tasks.push({ at: a.elapsed + delay, fn }); },
    supportBasicAttack(a, target) {
        if (this.support?.active !== a || !this.isActive || a.elapsed < a.castUntil || a.elapsed >= a.exitAt) return;
        const arm = a.snapshot.parts.arm;
        const type = arm?.attackType || 'melee';
        const visualScale = T.basicFxScale;
        const point = a.avatar?.muzzlePoint();
        // 협력 리그 캔버스(360×300, left=x-160, bottom=25)의 소켓을 전장 좌표로 변환.
        const from = point ? { x: a.x - 160 + point[0], bottom: 325 - point[1] }
            : { x: a.x + T.actorFront, bottom: 130 };
        const color = rosterOf(a.snapshot.id).color.slice(1).match(/../g).map(c => parseInt(c, 16)).join(',');
        const hitFx = arm?.kitAttack?.hitVfx || (a.melee
            ? arm?.kitAttack?.vfx || (a.snapshot.id === 'doll' ? DOLL_VFX.snipHit : meleeHitVfx(a.snapshot.id, arm?.id))
            : HIT[a.snapshot.id]) || CHIMERA_VFX.punchHit;
        let aim = aimAt(target), hit = false;
        const destination = () => {
            if (this.enemies.includes(target) && target.hp > 0) aim = aimAt(target);
            return aim;
        };
        const impact = () => {
            if (hit || this.support?.active !== a || !this.isActive || a.elapsed >= a.exitAt) return;
            hit = true;
            const p = destination();
            this.supportPlayFx(a, hitFx, p.x, p.b, { scale: visualScale });
            this.supportHit(a, target, a.snapshot.stats.dps * T.attacksEvery * T.damage);
        };
        a.basicAttacks++;
        this.stats.supportBasicAttacks++;
        a.avatar?.playSkillAnim('attack');
        this.supportPlayFx(a, { layers: [
            { type: 'flash', at: 0, dur: 0.16, r: a.melee ? 14 : 22, color },
            { type: 'sparks', at: 0, count: 5, speed: 110, angle: 0, cone: 0.6, color }
        ] }, from.x, from.bottom, { scale: visualScale });
        if (a.melee) {
            this.supportPlayFx(a, hitFx, from.x, from.bottom, { scale: 0.65 * visualScale });
            impact();
        } else if (type === 'water' || type === 'laser' || type === 'rail' || arm?.kitAttack?.kind === 'pierce') {
            const beam = arm?.kitAttack?.vfx || (type === 'water' ? DIVER_VFX.jet : MECH_VFX.laser);
            this.supportPlayFx(a, beam, from.x, from.bottom, { to: [aim.x, aim.b], scale: visualScale });
            impact();
        } else if (type === 'missile') {
            this.fx.launchMissile(from, destination, impact, { owner: a.owner, dur: 0.3, apex: 40 / visualScale, scale: 0.8 * visualScale });
        } else if ((type === 'wave' || type === 'frost') && aim.x > from.x) {
            this.fx.launchWave({ x: from.x, b: from.bottom, range: aim.x - from.x + 40, speed: 650,
                h: (type === 'frost' ? 34 : 48) * visualScale, color, owner: a.owner, sfx: null,
                onPass: (x0, x1) => { const p = destination(); if (p.x >= x0 && p.x <= x1) impact(); } });
        } else {
            this.fx.launchNeedle(from, destination, impact, { owner: a.owner, dur: 0.22, color, scale: 1.2 * visualScale, sfx: null });
        }
    },
    supportPlayFx(a, def, x, b, opts = {}) {
        if (this.support?.active === a && def?.layers) this.fx.play(def, x, b, { ...opts, owner: a.owner });
    },
    supportCastFx(a, def) {
        const color = rosterOf(a.snapshot.id).color.slice(1).match(/../g).map(c => parseInt(c, 16)).join(',');
        // 시전자 위치의 발동 효과는 적 유무·전환 여부와 관계없이 보인다.
        this.supportPlayFx(a, { layers: [
            { type: 'ring', at: 0, dur: 0.65, r: 92, ground: true, width: 8, color },
            { type: 'pillar', at: 0.05, dur: 0.5, h: 150, w: 28, color },
            { type: 'motes', at: 0, count: 12, spread: 48, rise: [60, 120], life: [0.5, 0.9], size: 3, color }
        ] }, a.x, 60);
        if (VFX[a.snapshot.id]) this.supportPlayFx(a, VFX[a.snapshot.id], a.x + T.actorFront, 70, { scale: 0.8 });
    },
    supportHit(a, enemy, damage, extra = {}) {
        if (this.support?.active !== a || !this.isActive || this.cinematic || this.finalBaseDestroyed ||
            a.elapsed >= a.exitAt || !this.enemies.includes(enemy) || enemy.hp <= 0) return;
        const base = solid(enemy) ? T.baseDamage : 1;
        this.dealDamageToEnemy(enemy, damage * base, false, { ...extra, source: 'support', supportGear: a.snapshot.gear });
    },
    supportMark(a, e, hold = 0, shatter = false) {
        if (this.support?.active !== a || !this.enemies.includes(e) || e.hp <= 0) return;
        const control = !e.boss && !solid(e);
        a.marks.set(e, { kind: a.snapshot.id, holdUntil: a.elapsed + (control ? hold : 0), shatter });
        e.dom?.classList.add('v2-support-mark');
        e.dom?.style.setProperty('--support-mark', rosterOf(a.snapshot.id).color);
        e.dom?.classList.toggle('is-support-held', control && hold > 0);
    },
    supportUltimate(a) {
        const id = a.snapshot.id;
        const def = supportUnitOf(id);
        const targets = this.supportTargets().slice(0, T.maxTargets);
        const u = a.snapshot.stats.dps * T.damage * T.ultimate * (1 + 0.1 * (a.snapshot.skillLevel - 1));
        if (def.volley) {
            for (let i = 0; i < def.volley; i++) this.supportLater(a, i * 0.45, () => {
                const liveTargets = this.supportTargets().slice(0, T.maxTargets);
                const center = liveTargets[Math.floor(liveTargets.length / 2)];
                if (center) {
                    const p = aimAt(center);
                    // 광역 연출을 적마다 겹치면 하얗게 뭉개지므로 타격당 중심에서 한 번만 표시한다.
                    this.supportPlayFx(a, def.vfx || CHIMERA_VFX.slam, p.x, id === 'architect' ? 60 : p.b, { scale: 0.8 });
                }
                for (const e of liveTargets) {
                    if (def.silence && !solid(e)) {
                        this.supportMark(a, e);
                        a.marks.get(e).silenceUntil = a.elapsed + def.silence * (e.boss ? 0.5 : 1);
                        this.updateEnemyFilter(e);
                    }
                    this.supportHit(a, e, u / def.volley * (solid(e) ? def.buildingMul || 1 : 1));
                }
            });
            return;
        }
        if (id === 'chimera' && monster.rigBattle) monster.rigBattle.supportAttackSpeed = 1 + T.synergy;
        if (id === 'saint') {
            const ratio = targets.some(e => e.boss) || this.stage.boss ? T.bossShield : T.shield;
            this.supportShield = Math.min(a.snapshot.stats.hp * 0.12, this.maxPlayerHp * ratio, this.maxPlayerHp * T.shieldCap);
            for (const ally of this.allies) {
                ally.supportShield = Math.min(ally.maxHp * ratio, a.snapshot.stats.hp * 0.04);
                a.shieldAllies.add(ally);
            }
        }
        if (id === 'hero' || id === 'saint') {
            const cap = id === 'hero' ? 2 : 3;
            let made = this.allies.filter(ally => ally.supportOwner === a.owner).length;
            if (id === 'saint') {
                for (const c of [...this.corpses].slice(0, Math.max(0, cap - made))) {
                    this.supportPlayFx(a, VFX[id], c.x, 60);
                    this.spawnSupportAlly(a, c.x, 'stitch', c.type);
                    this.removeCorpse(c);
                    made++;
                }
            }
            for (const e of targets.filter(e => !e.boss && !solid(e)).slice(0, Math.max(0, cap - made))) {
                const x = e.x;
                const p = aimAt(e);
                this.supportPlayFx(a, VFX[id], p.x, p.b); // 전환으로 적 DOM을 제거하기 전에 연출
                this.enemies = this.enemies.filter(t => t !== e); // 전환은 처치/드랍 보상 없음
                e.dom?.remove();
                this.spawnSupportAlly(a, x, id === 'hero' ? 'mind' : 'stitch', e.artKey || e.type);
            }
            if (id === 'hero') {
                // 세뇌된 적 자리 주위(180px)에 약화, 보스/거점 단독일 때도 유효.
                const centers = targets.slice(0, 2).map(e => e.x);
                for (const e of this.supportTargets()) if (centers.some(x => Math.abs(e.x - x) <= 180)) this.supportMark(a, e);
            }
            for (const e of targets.filter(e => e.boss || solid(e))) {
                this.supportMark(a, e);
                const p = aimAt(e); this.supportPlayFx(a, VFX[id], p.x, p.b);
                this.supportHit(a, e, u * 0.65);
            }
            return;
        }
        if (id === 'mech') {
            for (let i = 0; i < 6; i++) {
                let target = targets[i % targets.length];
                this.fx.launchDrone({ from: { x: a.x + 40, b: 210 }, index: i % 3,
                    delay: Math.floor(i / 3) * 0.2, owner: a.owner,
                    getTarget: () => {
                        if (this.support?.active !== a) return null;
                        if (!this.enemies.includes(target)) target = this.supportTargets()[0];
                        if (!target) return null;
                        const p = aimAt(target); return { x: p.x, b: p.b };
                    },
                    onHit: () => {
                        if (!target || this.support?.active !== a) return;
                        this.supportMark(a, target);
                        this.supportHit(a, target, u / 3);
                    }
                });
            }
            return;
        }
        const list = id === 'doll' ? targets.slice(0, 4) : targets;
        for (const e of list) {
            const hold = id === 'kaiju' || id === 'diver' ? 2 : id === 'frost' ? 1.5 : id === 'doll' ? 3 : 0;
            this.supportMark(a, e, hold, id === 'frost');
            const p = aimAt(e);
            this.supportPlayFx(a, VFX[id], p.x, p.b, { scale: 0.8 });
            if (id === 'frost') {
                this.supportLater(a, 1.5, () => {
                    if (!this.enemies.includes(e)) return;
                    const q = aimAt(e); this.supportPlayFx(a, FROST_VFX.shatter, q.x, q.b);
                    this.supportHit(a, e, u);
                });
            } else this.supportHit(a, e, u * (id === 'doll' ? 0.65 : 1));
        }
    },
    spawnSupportAlly(a, x, kind, art) {
        const ally = this.spawnAllyMinion(x, kind, { art,
            hp: Math.max(100, Math.min(a.snapshot.stats.hp * 0.08, 700)),
            dps: a.snapshot.stats.dps * 0.09, speed: a.snapshot.stats.speed });
        if (!ally) return;
        ally.supportOwner = a.owner;
        ally.supportGear = a.snapshot.gear;
        ally.dom?.classList.add('v2-support-minion');
    },
    supportHeld(e) {
        const a = this.support?.active;
        const m = a?.marks.get(e);
        return !!m && !e.boss && !solid(e) && m.holdUntil > a.elapsed;
    },
    supportSilenced(e) {
        const a = this.support?.active;
        return !!a && (a.marks.get(e)?.silenceUntil || 0) > a.elapsed;
    },
    supportEnemyDamageMul(e) {
        return this.support?.active?.marks.get(e)?.kind === 'hero' ? 1 - T.synergy : 1;
    },
    supportAttackMul() {
        return this.support?.active?.cast && this.support.active.snapshot.id === 'chimera' ? 1 + T.synergy : 1;
    },
    // 주인공만 연계 혜택. 지원/임시 아군은 주인공 옵션·흡혈·빙판 걸음을 빌리지 않는다.
    supportModifyDamage(enemy, damage, react) {
        if (react?.source === 'support' || react?.source === 'ally' || damage <= 0) return { damage, pierce: react?.pierce || 0 };
        const a = this.support?.active, m = a?.marks.get(enemy);
        let pierce = react?.pierce || 0;
        if (!m) return { damage, pierce };
        const melee = react?.delivery ? react.delivery === 'melee' : MELEE.has(this.attackType);
        const area = react?.area ?? AREA.has(this.attackType);
        if ((m.kind === 'mech' && !melee) || (m.kind === 'kaiju' && melee) || (m.kind === 'diver' && area)) damage *= 1 + T.synergy;
        if (m.kind === 'doll') pierce = Math.max(pierce, 0.25);
        if (m.kind === 'frost' && m.shatter) {
            m.shatter = false;
            damage += Math.min(a.snapshot.stats.dps * T.shatter, this.playerDps * 0.75);
            const p = aimAt(enemy); this.supportPlayFx(a, FROST_VFX.shatter, p.x, p.b, { scale: 0.6 });
        }
        return { damage, pierce };
    },
    clearSupport() {
        const a = this.support?.active;
        if (a) {
            a.tasks.length = 0;
            a.avatar?.stop();
            this.fx?.vfx?.removeOwner(a.owner);
            if (this.fx?.drones) this.fx.drones = this.fx.drones.filter(d => d.owner !== a.owner);
            a.dom?.remove();
            for (const e of a.marks.keys()) {
                a.marks.get(e).silenceUntil = 0;
                e.dom?.classList.remove('v2-support-mark', 'is-support-held');
                e.dom?.style.removeProperty('--support-mark');
                this.updateEnemyFilter(e);
            }
            for (const ally of this.allies || []) if (ally.supportOwner === a.owner) ally.dom?.remove();
            this.allies = (this.allies || []).filter(ally => ally.supportOwner !== a.owner);
            for (const ally of a.shieldAllies) delete ally.supportShield;
            this.support.active = null;
        }
        this.supportShield = 0;
        if (monster.rigBattle) monster.rigBattle.supportAttackSpeed = 1;
        this.hud?.clearSupportNotice?.();
    }
};
