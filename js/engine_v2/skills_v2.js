/* ==========================================================================
   PROJECT: MAD OVERLORD // 파츠 액티브 스킬 (v2)
   장착 파츠가 스킬을 결정한다.
     팔   = 공격 스킬 (버튼, 쿨다운)          단축키 1
     몸통 = 보조 스킬 (버튼, 쿨다운)          단축키 2
     머리 = 필살기 (게이지를 모아 사용, 컷인)  단축키 3 / Space
     다리 = 패시브 (기존 다리 효과 그대로)
   스킬 효과는 전투 엔진(battle_v2.js)의 공용 메서드와 이펙트 정의(vfx/*.js)를 조합해 만든다.
   피해 단위 u = 기본 공격 1타 피해 (playerDps × 0.5)
   ========================================================================== */

import { monsterControllerV2 as monster } from './monster_v2.js';
import { HERO_VFX, MECH_VFX, KAIJU_VFX, CHIMERA_VFX, SET_VFX, meleeHitVfx } from './vfx/vfxDefs.js';
import { aimAt } from './bases_v2.js';
import { sound } from './audio/sound_v2.js';
import { SET, FOOT_B } from './battle/tuning.js';
import { breathImage } from './vfx/imageEffects.js';

export const SLOT_KEYS = { arm: '1', body: '2', head: '3', mod1: '4', mod2: '5' };   // mod = 전술 모듈 (Q-006)
export const ULT_FILL = { perSec: 1 / 24, perHit: 0.03 };   // 필살기 게이지: 24초 + 기본 공격 1타당 3%

const aim = aimAt;   // 적 몸통 중앙 (건물은 그림 크기의 가운데)

// ---- 스킬 정의 ----
// target: 'enemy'(사거리 안에 적이 있어야 사용) | 'self'(언제나) , range: 전방 사거리 추가 px
export const SKILLS = {
    // ===== 팔 =====
    rush: {
        name: '연타 러시', slot: 'arm', cd: 8, icon: 'fist', color: '#3ee6ff', target: 'enemy', range: 40,
        desc: '가장 가까운 적에게 강타 3연속',
        use(b) {
            monster.playSkillAnim('rush');   // 거대로봇 전용 동작 (Q7)
            const hitVfx = meleeHitVfx(monster.getCharacterId(), b.equippedArmId);
            for (let i = 0; i < 3; i++) {
                b.schedule(0.12 + i * 0.16, () => {
                    const t = b.nearestEnemy(this.range);
                    if (!t) return;
                    b.fx.play(hitVfx, aim(t).x, aim(t).b + 5);
                    b.dealDamageToEnemy(t, b.unit() * 1.3, false, { knock: 1.2, stop: i === 2 });
                });
            }
        }
    },
    pierceLaser: {
        name: '관통 레이저', slot: 'arm', cd: 9, icon: 'laser', color: '#d75aff', target: 'enemy', range: 250,
        desc: '전방 일직선의 모든 적을 꿰뚫는 굵은 광선',
        use(b) {
            monster.playSkillAnim('beam');
            b.schedule(0.3, () => {
                const from = monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 120 };
                const endX = b.frontX() + b.playerRange + this.range;
                b.fx.play(MECH_VFX.laserBig, from.x, from.bottom, { to: [endX, 90] });
                b.enemiesInRange(b.playerRange + this.range).forEach((e, i) => b.schedule(i * 0.04, () => {
                    if (!b.enemies.includes(e)) return;
                    b.fx.play(MECH_VFX.laserHit, aim(e).x, aim(e).b);
                    b.dealDamageToEnemy(e, b.unit() * 3, false, { knock: 1.5, stop: i === 0 });
                }));
            });
        }
    },
    missileSalvo: {
        name: '미사일 일제 사격', slot: 'arm', cd: 9, icon: 'missile', color: '#ff9a3c', target: 'enemy', range: 200,
        desc: '미사일 6발을 여러 적에게 동시에 사출',
        use(b) {
            monster.playSkillAnim('salvo');
            const targets = b.enemiesInRange(b.playerRange + this.range);
            for (let i = 0; i < 6; i++) {
                b.schedule(i * 0.08, () => {
                    const t = targets[i % targets.length];
                    if (t) b.fireMissile(t, b.unit() * 1.1, { apex: 50 + (i % 3) * 25 });
                });
            }
        }
    },
    frenzyClaw: {
        name: '광폭 할퀴기', slot: 'arm', cd: 8, icon: 'claw', color: '#ff9628', target: 'enemy', range: 40,
        desc: '전방을 세 번 할퀴어 주변 적 모두에게 피해',
        use(b) {
            monster.playSkillAnim('attack');
            [2.2, 0.9, 1.6].forEach((angle, i) => b.schedule(0.1 + i * 0.14, () => {
                const t = b.nearestEnemy(this.range);
                if (!t) return;
                const def = { ...CHIMERA_VFX.clawHit, layers: CHIMERA_VFX.clawHit.layers.map(l => (l.type === 'claw' ? { ...l, angle, len: 95 } : l)) };
                b.fx.play(def, aim(t).x, aim(t).b + 5);
                b.enemies.filter(e => Math.abs(e.x - t.x) < 110).forEach(e =>
                    b.dealDamageToEnemy(e, b.unit() * 1.1, false, { knock: 0.8, stop: i === 2 }));
            }));
        }
    },
    tripleWave: {
        name: '어둠 파동 3연', slot: 'arm', cd: 9, icon: 'wave', color: '#c86eff', target: 'enemy', range: 120,
        desc: '관통하며 감속시키는 어둠 파동을 세 번 발사',
        use(b) {
            monster.playSkillAnim('attack');
            for (let i = 0; i < 3; i++) {
                b.schedule(0.25 + i * 0.2, () => {
                    const tip = monster.getMuzzlePoint();
                    b.launchDarkWave(tip ? tip.x : b.monsterX + 90, b.unit() * 1.4, false);
                });
            }
        }
    },
    anchorPull: {
        name: '앵커 견인', slot: 'arm', cd: 10, icon: 'anchor', color: '#3fe0c8', target: 'enemy', range: 420,
        desc: '먼 적(사수·의무병 먼저)을 발 앞으로 끌어와 기절',
        use(b) {
            const t = b.anchorTarget(this.range);
            if (t) monster.playCast(() => b.throwAnchor(t, this.range), 'anchor');
        }
    },
    needleTriple: {
        name: '봉합 주사 3연발', slot: 'arm', cd: 9, icon: 'syringe', color: '#ff4d6d', target: 'enemy', range: 120,
        desc: '바늘 셋을 연달아 쏴 피해 + 잠깐 묶고 봉합 표식',
        use(b) {
            monster.playCast(() => b.tripleNeedle(this.range), 'triple');
        }
    },
    crescentSlash: {
        name: '초승달 참격', slot: 'arm', cd: 9, icon: 'crescent', color: '#7fd4ff', target: 'enemy', range: 200,
        desc: '큰 서리 초승달이 앞의 적을 모두 베고 냉기 2',
        use(b) {
            monster.playCast(() => b.crescentSlash(this.range), 'crescent');
        }
    },
    scissorX: {
        name: '가위 참격 X자', slot: 'arm', cd: 8, icon: 'scissors', color: '#d8e8f4', target: 'enemy', range: 60,
        desc: '앞의 적을 X자로 크게 벰 (방패 방어 일부 무시)',
        use(b) {
            monster.playCast(() => b.scissorX(this.range), 'xcut');
        }
    },
    acidCharge: {
        name: '산성 돌진', slot: 'arm', cd: 9, icon: 'acid', color: '#a0ff32', target: 'enemy', range: 90,
        desc: '거체로 들이받아 큰 피해 + 주변 적을 밀쳐내고 산성 웅덩이로 부식 (거점에 강함)',
        use(b) {
            monster.playSkillAnim('lunge');   // 거대괴수 전용 동작 (Q7)
            b.schedule(0.35, () => {
                const t = b.nearestEnemy(this.range);
                if (!t) return;
                const a = aim(t);
                b.fx.play(KAIJU_VFX.acidCharge, a.x, 58);
                b.dealDamageToEnemy(t, b.unit() * (t.isBuilding ? 4.5 : 3), false, { knock: 2, stop: true });
                b.enemiesInRange(b.playerRange + this.range + 60).forEach(e => {
                    if (e !== t) b.dealDamageToEnemy(e, b.unit() * 1.2, false, { knock: 2.2 });
                    b.applyAcid(e, 4);
                });
                if (b.enemies.includes(t)) b.applyAcid(t, 4);
            });
        }
    },

    // ===== 몸통 =====
    reflectShield: {
        name: '반사 실드', slot: 'body', cd: 16, icon: 'shield', color: '#3ee6ff', target: 'self',
        desc: '5초간 최대 체력 20%의 피해를 막는 에너지 실드',
        use(b) {
            monster.playSkillAnim('guard');
            b.applyShield(0.2, 5, '62, 230, 255');
        }
    },
    callMinions: {
        name: '졸개 호출', slot: 'body', cd: 14, icon: 'minions', color: '#ff9628', target: 'self',
        desc: '졸개 미니언 2기를 즉시 소환 (최대 8기)',
        use(b) {
            monster.playSkillAnim('summon');   // 합성괴인 전용 동작 (Q7)
            [60, 110].forEach((dx, i) => b.schedule(i * 0.15, () => {
                if (b.allies.length < 8) b.spawnAllyMinion(b.monsterX + dx, 'chimera');
            }));
        }
    },
    layEggs: {
        name: '산란', slot: 'body', cd: 14, icon: 'egg', color: '#a0ff32', target: 'self',
        desc: '알 2개를 낳아 새끼 괴수 부화 (최대 5마리)',
        use(b) {
            monster.playSkillAnim('lay');
            [12, 55].forEach((dx, i) => b.schedule(i * 0.2, () => b.layEgg(b.monsterX + dx, 5)));
        }
    },
    curseBurst: {
        name: '흑마법 폭발', slot: 'body', cd: 15, icon: 'curse', color: '#c86eff', target: 'enemy', range: 200,
        desc: '전방 광역에 흑마법 기둥 — 피해 + 감속',
        use(b) {
            monster.playSkillAnim('cast');
            b.schedule(0.3, () => {
                b.fx.play(HERO_VFX.curseNova, b.frontX() + 140, 58);
                b.enemiesInRange(b.playerRange + this.range).forEach((e, i) => b.schedule(0.1 + i * 0.05, () => {
                    if (!b.enemies.includes(e)) return;
                    b.fx.play(HERO_VFX.curseTick, aim(e).x, 58);
                    if (!e.isBuilding) b.slowEnemy(e);
                    b.dealDamageToEnemy(e, b.unit() * 2, false, { knock: 0.5 });
                }));
            });
        }
    },

    pressureSurge: {
        name: '고압 분사', slot: 'body', cd: 14, icon: 'surge', color: '#5ae1eb', target: 'enemy', range: 160,
        desc: '물살로 앞의 적을 모두 밀어내고 감속',
        use(b) {
            monster.playCast(() => b.pressureSurge(this.range));
        }
    },

    lifeSeal: {
        name: '생명 봉인', slot: 'body', cd: 15, icon: 'sealring', color: '#ff5a78', target: 'enemy', range: 200,
        desc: '앞에 붉은 실 장판 4초: 안의 적을 묶고 계속 피해',
        use(b) {
            monster.playCast(() => b.lifeSeal());
        }
    },

    blizzardDance: {
        name: '눈보라 춤', slot: 'body', cd: 15, icon: 'fan', color: '#a8e4ff', target: 'enemy', range: 140,
        desc: '4초간 둘레 눈보라: 계속 피해 + 냉기, 받는 피해 30% 감소',
        use(b) {
            monster.playCast(() => b.blizzardDance(), 'spin');
        }
    },

    dollFamily: {
        name: '인형 가족', slot: 'body', cd: 14, icon: 'rabbit', color: '#5ae6f0', target: 'self',
        desc: '토끼 인형 3기: 적을 붙잡아 막고 쓰러지면 터짐 (최대 4)',
        use(b) {
            monster.playCast(() => b.dollFamily());
        }
    },

    // ===== 머리 (필살기) =====
    droneSwarm: {
        name: '스웜 드론 총출격', slot: 'head', ult: true, icon: 'drone', color: '#d75aff', target: 'enemy', range: 400,
        desc: '자폭 드론 6기가 적진에 돌진',
        use(b) {
            monster.playSkillAnim('launch');
            b.launchDrones(6);
        }
    },
    earthRoar: {
        name: '대지 포효', slot: 'head', ult: true, icon: 'roar', color: '#a0ff32', target: 'enemy', range: 250,
        desc: '산성 충격파로 주변 적에게 큰 피해 + 2초 기절',
        use(b) {
            monster.playSkillAnim('roar');
            b.schedule(0.4, () => {
                b.fx.play(KAIJU_VFX.roarBurst, b.monsterX + 60, 58);
                b.enemiesInRange(b.playerRange + this.range).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * 3, false, { knock: 2, stop: true });
                    if (!e.isBuilding) b.stunEnemy(e, 2);
                });
            });
        }
    },
    massMind: {
        name: '대세뇌', slot: 'head', ult: true, icon: 'mind', color: '#c86eff', target: 'minion', range: 350,
        desc: '가까운 적 보병 2기를 즉시 세뇌해 아군으로',
        use(b) {
            const targets = b.enemiesInRange(b.playerRange + this.range).filter(e => !e.isBuilding).slice(0, 2);
            monster.playCast(() => targets.forEach((e, i) => b.schedule(i * 0.12, () => b.convertEnemy(e))));
        }
    },
    abyssHands: {
        name: '심연의 손', slot: 'head', ult: true, icon: 'hand', color: '#28dcbe', target: 'enemy', range: 320,
        desc: '유령 손이 적 6명까지 묶고 지속 피해 (거점도)',
        use(b) {
            monster.playCast(() => b.abyssHands(this.range));
        }
    },
    forcedRevive: {
        name: '억지 부활', slot: 'head', ult: true, icon: 'redcross', color: '#ff3355', target: 'enemy', range: 400,
        desc: '봉합된 시체(없으면 약한 적)를 3명까지 아군으로',
        use(b) {
            monster.playCast(() => b.forcedRevive(this.range));
        }
    },
    eternalRest: {
        name: '영원한 안식', slot: 'head', ult: true, icon: 'icecage', color: '#9fe0ff', target: 'enemy', range: 350,
        desc: '앞의 적을 얼음 결정에 가뒀다가 한꺼번에 깨뜨림',
        use(b) {
            monster.playCast(() => b.eternalRest(this.range));
        }
    },
    puppetStrings: {
        name: '인형 실', slot: 'head', ult: true, icon: 'puppet', color: '#5ae6f0', target: 'minion', range: 320,
        desc: '적 4명까지 4초간 꼭두각시로: 멈춘 채 다른 적을 때림',
        use(b) {
            monster.playCast(() => b.puppetStrings(this.range), 'strings');
        }
    },
    rampage: {
        name: '파괴 광란', slot: 'head', ult: true, icon: 'rampage', color: '#ff9628', target: 'self',
        desc: '즉시 2페이즈 변신. 이미 변신했다면 대형 충격파 + 1.5초 기절',
        use(b) {
            if (!b.phase2) {
                b.enterPhase2();
                return;
            }
            monster.playCast(() => {   // 두 손 내려치는 순간 충격파 (smash 'cast')
                b.fx.play(CHIMERA_VFX.slam, b.monsterX + 35, 58);
                b.enemiesInRange(b.playerRange + 200).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * 3, false, { knock: 2, stop: true });
                    if (!e.isBuilding) b.stunEnemy(e, 1.5);
                });
            }, 'smash');
        }
    }
};

// ==========================================================================
// 기존 4종 A·B 세트 스킬 (D-050 파츠 확장 1차 — 기획안 4장 그대로, 수치는 battle/tuning.js SET과 아래 배율)
// 세트 기능(버프·구역·돌진·포탑·분신·블랙홀 등)은 battle/sets.js
// ==========================================================================
const enemiesAhead = (b, from, to) => b.enemies.filter(e => { const d = e.x - b.frontX(); return d >= from && d <= to; });
const isSoldier = e => !e.isBuilding && !e.isBarricade;

Object.assign(SKILLS, {
    // ===== 거대로봇 A 「포격 사령부」 =====
    orbitalStrike: {
        name: '궤도 폭격', slot: 'head', ult: true, icon: 'orbital', color: '#d75aff', target: 'enemy', range: 400,
        desc: '앞쪽 5곳에 위성 레이저가 차례로 떨어짐 (큰 범위 피해, 거점 1.5배)',
        use(b) {
            monster.playSkillAnim('call');
            const x0 = b.frontX() + 40;
            for (let i = 0; i < 5; i++) {
                const x = x0 + i * 95;
                b.schedule(i * 0.22, () => b.fx.play(SET_VFX.orbitalWarn, x, FOOT_B));
                b.schedule(i * 0.22 + 0.4, () => {
                    b.fx.play(SET_VFX.orbitalHit, x, FOOT_B);
                    b.director.shake(5, 220);
                    [...b.enemies].forEach(e => {
                        if (Math.abs(aim(e).x - x) < 75) b.dealDamageToEnemy(e, b.unit() * 2.4 * (e.isBuilding ? 1.5 : 1), false, { knock: 1, stop: i === 4 });
                    });
                });
            }
        }
    },
    autoTurret: {
        name: '자동 포탑 전개', slot: 'body', cd: 14, icon: 'turret', color: '#3ee6ff', target: 'self',
        desc: '8초간 어깨 포탑이 가장 가까운 적을 연사',
        use(b) {
            monster.playSkillAnim('guard');
            b.startTurret(SET.turret.sec);
        }
    },
    chargedRail: {
        name: '충전 레일 사격', slot: 'arm', cd: 9, icon: 'rail', color: '#00e6ff', target: 'enemy', range: 250,
        desc: '1초 충전 뒤 전장 끝까지 꿰뚫는 큰 피해',
        use(b) {
            monster.playSkillAnim(b.setOn('mech_a') ? 'railQuick' : 'rail');   // 충전 시간에 맞춘 반동 (포격 사령부 4부위 0.7초)
            const muzzle = () => monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 120 };
            b.fx.play(SET_VFX.railCharge, muzzle().x, muzzle().bottom, { follow: () => [muzzle().x, muzzle().bottom] });
            const charge = b.setOn('mech_a') ? SET.setBonus.railCharge : 1.0;   // 포격 사령부 4부위
            b.schedule(charge, () => {
                const from = muzzle();
                b.fx.play(SET_VFX.railBig, from.x, from.bottom, { to: [1300, from.bottom - 10] });
                enemiesAhead(b, -60, Infinity).sort((p, q) => p.x - q.x).forEach((e, i) => b.schedule(i * 0.03, () => {
                    if (!b.enemies.includes(e)) return;
                    b.fx.play(SET_VFX.railHit, aim(e).x, aim(e).b);
                    b.dealDamageToEnemy(e, b.unit() * 4 * (e.isBuilding ? 1.2 : 1), false, { knock: 1.5, stop: i === 0 });
                }));
            });
        }
    },

    // ===== 거대로봇 B 「돌격 강습대」 =====
    overdrive: {
        name: '오버드라이브', slot: 'head', ult: true, icon: 'overdrive', color: '#d75aff', target: 'self',
        desc: '6초간 공격 속도 +50%·진격 속도 +40%·받는 피해 -30%',
        use(b) {
            monster.playSkillAnim('power');
            b.fx.play(SET_VFX.overdrive, b.monsterX + 35, FOOT_B);
            b.addBuff('overdrive', SET.overdrive.sec);
            b.createDamagePopup(b.monsterX + 40, 210, 'OVERDRIVE!', false);
        }
    },
    rocketDash: {
        name: '로켓 돌진', slot: 'body', cd: 13, icon: 'rocket', color: '#3ee6ff', target: 'enemy', range: 200,
        desc: '앞으로 200px 돌진 — 부딪힌 적을 밀쳐내고 피해',
        use(b) {
            monster.playSkillAnim('dash');
            sound.play('mech_thrust');
            b.dashForward(200, 0.3, e => {
                b.fx.play(SET_VFX.rocketHit, aim(e).x, aim(e).b);
                b.dealDamageToEnemy(e, b.unit() * 2, false, { knock: 3, stop: true });
                if (isSoldier(e) && b.enemies.includes(e)) b.stunEnemy(e, 0.4);
            }, SET_VFX.rocketTrail);
            if (b.setOn('mech_b')) b.schedule(0.33, () => b.dashShockwave());   // 돌격 강습대 4부위
        }
    },
    pileBunker: {
        name: '파일 벙커 관통', slot: 'arm', cd: 9, icon: 'pile', color: '#3ee6ff', target: 'enemy', range: 40,
        desc: '한 적에 큰 피해 + 1.5초 기절 (거점 2배)',
        use(b) {
            monster.playSkillAnim('pile');
            b.schedule(0.3, () => {
                const t = b.nearestEnemy(this.range);
                if (!t) return;
                b.fx.play(SET_VFX.pileHit, aim(t).x, aim(t).b, { to: [aim(t).x + 60, aim(t).b] });
                b.director.shake(6, 220);
                b.dealDamageToEnemy(t, b.unit() * 4.5 * (t.isBuilding ? 2 : 1), false, { knock: 2, stop: true });
                if (isSoldier(t) && b.enemies.includes(t)) b.stunEnemy(t, 1.5);
            });
        }
    },

    // ===== 거대괴수 A 「가시 갑각」 =====
    spikeStorm: {
        name: '가시 폭풍', slot: 'head', ult: true, icon: 'spikes', color: '#a0ff32', target: 'enemy', range: 300,
        desc: '등 가시를 사방으로 쏴 범위 피해 + 4초 가시 독 (지속 피해)',
        use(b) {
            monster.playSkillAnim('roar');
            b.schedule(0.35, () => {
                b.fx.play(SET_VFX.spikeStorm, b.monsterX + 50, FOOT_B);
                b.enemiesInRange(b.playerRange + this.range).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * 2.5, false, { knock: 1.5, stop: true });
                    b.applyBleed(e, 4, b.playerDps * 0.3);
                });
            });
        }
    },
    thornArmor: {
        name: '가시 갑옷', slot: 'body', cd: 15, icon: 'thorns', color: '#a0ff32', target: 'self',
        desc: '6초간 받는 피해 -25%, 나를 때린 적에게 받은 피해의 50%를 되돌림',
        use(b) {
            monster.playCast(() => {   // 움츠렸다 부풀 때 가시가 돋음 (brace 'cast')
                b.fx.play(SET_VFX.thornOn, b.monsterX + 35, FOOT_B);
                b.addBuff('thornArmor', SET.thorn.sec);
            }, 'brace');
        }
    },
    groundSlam: {
        name: '지면 내려찍기', slot: 'arm', cd: 9, icon: 'slam', color: '#a0ff32', target: 'enemy', range: 80,
        desc: '앞쪽 충격파 — 피해 + 0.8초 기절',
        use(b) {
            monster.playSkillAnim('slam');
            b.schedule(0.4, () => {
                b.fx.play(SET_VFX.groundSlam, b.frontX() + 60, FOOT_B);
                b.director.shake(7, 260);
                enemiesAhead(b, -30, b.playerRange + 120).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * 2.2, false, { knock: 1.2, stop: true });
                    if (isSoldier(e) && b.enemies.includes(e)) b.stunEnemy(e, 0.8);
                });
            });
        }
    },

    // ===== 거대괴수 B 「독안개」 =====
    toxicBreath: {
        name: '독안개 숨결', slot: 'head', ult: true, icon: 'breath', color: '#a0ff32', target: 'enemy', range: 260,
        desc: '앞쪽에 6초 독 구름 — 지속 피해 + 감속',
        use(b) {
            monster.playSkillAnim('breath');
            b.schedule(0.35, () => {
                const x = b.frontX() + 10;
                b.fx.play(SET_VFX.toxicBreath, x + 150, FOOT_B);
                b.addZone({ x, w: 300, sec: 6, dps: b.playerDps * 0.4, slow: true, field: 'poison',
                    baseMul: b.setOn('kaiju_b') ? SET.setBonus.toxicBaseMul : 1 });   // 독안개 4부위: 거점 2배
            });
        }
    },
    // ===== 합성괴인 추가 머리 「화룡 머리」 (세트 밖, 2026-10-17, D-054) =====
    // 포효 동작 동안 입(리그 mouth 소켓)에서 불길 → 앞쪽 화염 피해 + 바닥이 4초간 불탐. 수치는 battle/tuning.js SET.dragonBreath
    dragonBreath: {
        name: '용의 숨결', slot: 'head', ult: true, icon: 'fire', color: '#ff6a1e', target: 'enemy', range: 260,
        desc: '입에서 불길 — 앞쪽 화염 피해 + 4초 불바다 (지속 피해, 거점 포함)',
        use(b) {
            const T = SET.dragonBreath;
            monster.playSkillAnim('breath');
            const mouth = () => monster.getSocketPoint('mouth', 'head') || monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 130 };
            b.schedule(0.4, () => {
                const m = mouth();
                b.fx.play(breathImage('breath_fire', T.width + 100, T.breathSec), m.x, m.bottom,
                    { follow: () => { const p = mouth(); return [p.x, p.bottom]; } });
            });
            b.schedule(0.5, () => {
                const x = b.frontX() - 10;
                b.director.shake(5, 220);
                enemiesAhead(b, -20, b.playerRange + this.range).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * T.hitMul, false, { knock: 0.8 });
                });
                b.addZone({ x, w: T.width, sec: T.zoneSec, dps: b.playerDps * T.zoneDps, field: 'fire' });
            });
        }
    },
    sporeBurst: {
        name: '독 포자 폭발', slot: 'body', cd: 14, icon: 'spore', color: '#a0ff32', target: 'enemy', range: 120,
        desc: '몸 둘레 폭발 — 피해 + 산성 부식 4초',
        use(b) {
            monster.playCast(() => {   // 부풀었다 터지는 순간 (brace 'cast')
                b.fx.play(SET_VFX.sporeBurst, b.monsterX + 50, FOOT_B);
                enemiesAhead(b, -160, 180).forEach(e => {
                    b.dealDamageToEnemy(e, b.unit() * 2, false, { knock: 1.5 });
                    b.applyAcid(e, 4);
                });
            }, 'brace');
        }
    },
    acidSpit3: {
        name: '산성 침 3연발', slot: 'arm', cd: 8, icon: 'acid', color: '#a0ff32', target: 'enemy', range: 120,
        desc: '산성 침 3발을 연달아 — 맞은 자리마다 산성 웅덩이',
        use(b) {
            monster.playSkillAnim('spit');
            for (let i = 0; i < 3; i++) {
                b.schedule(0.15 + i * 0.18, () => {
                    const list = b.enemiesInRange(b.playerRange + this.range);
                    if (list.length) b.fireSpit(list[i % list.length], b.unit() * 1.5, false);
                });
            }
        }
    },

    // ===== 타락 히어로 A 「타락 기사」 =====
    judgmentBlade: {
        name: '심판의 일격', slot: 'head', ult: true, icon: 'sword', color: '#c86eff', target: 'enemy', range: 300,
        desc: '하늘에서 거대한 보라 검이 떨어짐 — 큰 범위 피해 + 2초 기절',
        use(b) {
            monster.playCast(() => {
                const t = b.nearestEnemy(this.range);
                const x = t ? aim(t).x + 30 : b.frontX() + 150;
                b.fx.play(SET_VFX.judgmentWarn, x, FOOT_B);
                b.schedule(0.5, () => {
                    b.fx.play(SET_VFX.judgmentHit, x, FOOT_B);
                    b.director.shake(10, 400);
                    b.director.flash('#e6c8ff', 180, 0.5);
                    [...b.enemies].forEach(e => {
                        if (Math.abs(aim(e).x - x) > 130) return;
                        b.dealDamageToEnemy(e, b.unit() * 4.5, false, { knock: 2, stop: true });
                        if (isSoldier(e) && b.enemies.includes(e)) b.stunEnemy(e, 2);
                    });
                });
            });
        }
    },
    bloodOath: {
        name: '어둠의 서약', slot: 'body', cd: 15, icon: 'oath', color: '#b04dff', target: 'self',   // 12세 기준(Q-008 S6): 피의 서약 → 어둠의 서약
        desc: '6초간 준 피해의 20%만큼 내구도 회복',
        use(b) {
            b.fx.play(SET_VFX.bloodOn, b.monsterX + 35, FOOT_B);
            b.addBuff('bloodOath', SET.blood.sec);
        }
    },
    whirlwind: {
        name: '회전 베기', slot: 'arm', cd: 8, icon: 'whirl', color: '#c86eff', target: 'enemy', range: 60,
        desc: '제자리 3회전 — 둘레 적 모두 피해',
        use(b) {
            monster.playSkillAnim('attack');
            const knight = b.setOn('hero_a');   // 타락 기사 4부위: 4회전 + 도는 동안 앞으로
            const spins = knight ? SET.setBonus.whirlSpins : 3;
            if (knight) b.dashForward(SET.setBonus.whirlAdvance, 0.1 + spins * 0.2, () => {}, null);
            for (let i = 0; i < spins; i++) {
                b.schedule(0.1 + i * 0.2, () => {
                    const cx = b.monsterX + 60;
                    b.fx.play(SET_VFX.whirl, cx, 110);
                    [...b.enemies].forEach(e => {
                        if (Math.abs(aim(e).x - cx) < 170) b.dealDamageToEnemy(e, b.unit() * 1.3, false, { knock: 0.8, stop: i === spins - 1 });
                    });
                });
            }
        }
    },

    // ===== 타락 히어로 B 「그림자 마도사」 =====
    shadowClones: {
        name: '그림자 분신', slot: 'head', ult: true, icon: 'clone', color: '#c86eff', target: 'self',
        desc: '6초간 분신 2명이 함께 공격 (기본 공격을 같이 쏨)',
        use(b) {
            monster.playCast(() => b.startClones(SET.clones.sec));
        }
    },
    curseChains: {
        name: '저주의 사슬', slot: 'body', cd: 14, icon: 'chain', color: '#c86eff', target: 'minion', range: 250,
        desc: '적 3명을 사슬로 4초 속박 + 지속 피해',
        use(b) {
            const targets = b.enemiesInRange(b.playerRange + this.range).filter(isSoldier).slice(0, 3);
            monster.playCast(() => targets.forEach((e, i) => b.schedule(i * 0.1, () => {
                if (!b.enemies.includes(e)) return;
                b.fx.play(SET_VFX.chainBind, aim(e).x, FOOT_B);
                b.rootEnemy(e, 4);
                b.applyBleed(e, 4, b.playerDps * 0.3, 'curse');
                b.dealDamageToEnemy(e, b.unit() * 0.8, false, { knock: 0 });
            })));
        }
    },
    blackHole: {
        name: '블랙홀', slot: 'arm', cd: 10, icon: 'blackhole', color: '#c86eff', target: 'enemy', range: 200,
        desc: '3초간 적을 한곳으로 빨아들이며 피해',
        use(b) {
            monster.playSkillAnim('cast');
            const t = b.nearestEnemy(this.range);
            b.startBlackHole(t ? aim(t).x + 50 : b.frontX() + 160, SET.blackHole.sec);
        }
    },

    // ===== 합성괴인 A 「광폭 실험체」 =====
    maulCharge: {
        name: '광견 돌진', slot: 'head', ult: true, icon: 'maul', color: '#ff9628', target: 'enemy', range: 200,
        desc: '앞으로 돌진하며 지나간 적 모두 밀쳐내고 1.5초 기절',
        use(b) {
            monster.playSkillAnim('lunge');
            b.dashForward(240, 0.35, e => {
                b.fx.play(SET_VFX.maulHit, aim(e).x, aim(e).b);
                b.dealDamageToEnemy(e, b.unit() * 2.2, false, { knock: 3, stop: true });
                if (isSoldier(e) && b.enemies.includes(e)) b.stunEnemy(e, 1.5);
            }, SET_VFX.maulTrail);
        }
    },
    adrenaline: {
        name: '아드레날린 주입', slot: 'body', cd: 15, icon: 'injector', color: '#ff9628', target: 'self',
        desc: '8초간 주는 피해 +40%',
        use(b) {
            monster.playCast(() => {   // 근육을 부풀리는 순간 (flex 'cast')
                b.fx.play(SET_VFX.adrenaline, b.monsterX + 35, FOOT_B);
                b.addBuff('adrenaline', SET.adrenaline.sec);
            }, 'flex');
        }
    },
    earthSmash: {
        name: '대지 강타', slot: 'arm', cd: 9, icon: 'hammer', color: '#ff9628', target: 'enemy', range: 80,
        desc: '크게 내리쳐 넓은 충격파 (거점 1.5배)',
        use(b) {
            monster.playSkillAnim('smash');
            b.schedule(0.4, () => {
                b.fx.play(SET_VFX.earthSmash, b.frontX() + 50, FOOT_B);
                b.director.shake(8, 300);
                enemiesAhead(b, -30, b.playerRange + 180).forEach(e =>
                    b.dealDamageToEnemy(e, b.unit() * 2.6 * (e.isBuilding ? 1.5 : 1), false, { knock: 1.5, stop: true }));
            });
        }
    },

    // ===== 합성괴인 B 「조직 사령관」 =====
    mobilize: {
        name: '총동원령', slot: 'head', ult: true, icon: 'horn', color: '#ff9628', target: 'self',
        desc: '졸개 4기 소환 + 6초간 모든 졸개 피해 2배',
        use(b) {
            monster.playSkillAnim('summon');
            b.fx.play(SET_VFX.mobilize, b.monsterX + 90, FOOT_B);
            for (let i = 0; i < SET.mobilize.count; i++) {
                b.schedule(i * 0.12, () => {
                    if (b.allies.length < SET.mobilize.cap) b.spawnAllyMinion(b.monsterX + 50 + i * 35, 'chimera');
                });
            }
            b.addBuff('mobilize', SET.mobilize.sec);
        }
    },
    boostShot: {
        name: '강화 주사', slot: 'body', cd: 14, icon: 'injector', color: '#78ff8c', target: 'self',
        desc: '모든 아군 졸개 체력 50% 회복 + 6초 공격 속도 증가',
        use(b) {
            monster.playCast(() => {   // 힘주는 순간 졸개들에게 (flex 'cast')
                b.allies.forEach(a => {
                    a.hp = Math.min(a.maxHp, a.hp + a.maxHp * SET.boost.heal);
                    if (a.hpBar) a.hpBar.style.width = `${(a.hp / a.maxHp) * 100}%`;
                    b.fx.play(SET_VFX.boostShot, a.x + 30, FOOT_B);
                });
                b.addBuff('boost', SET.boost.sec);
            }, 'flex');
        }
    },
    flamethrower: {
        name: '화염 방사', slot: 'arm', cd: 9, icon: 'fire', color: '#ff6a1e', target: 'enemy', range: 120,
        desc: '3초간 앞쪽 화염 지속 피해',
        use(b) {
            monster.playSkillAnim('spray');
            b.addZone({ x: b.frontX() - 10, w: b.playerRange + this.range, sec: 3, dps: b.playerDps * 0.7, field: 'fire' });
            const muzzle = () => monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 120 };
            const m = muzzle();
            b.fx.play(breathImage('breath_fire', b.playerRange + this.range + 80, 3), m.x, m.bottom,
                { follow: () => { const p = muzzle(); return [p.x, p.bottom]; } });
        }
    }
});

// 파츠 → 스킬 (파츠제거 'none'은 스킬 없음)
export const PART_SKILL = {
    arm_red_robot: 'rush', arm_mech_laser: 'pierceLaser', arm_mech_missile: 'missileSalvo',
    arm_chimera: 'frenzyClaw', arm_hero_wave: 'tripleWave', arm_mutant: 'acidCharge',
    body_red_robot: 'reflectShield', body_mech: 'reflectShield', body_chimera: 'callMinions',
    body_mutant: 'layEggs', body_hero: 'curseBurst',
    head_red_robot: 'droneSwarm', head_mech: 'droneSwarm', head_mutant: 'earthRoar',
    head_hero: 'massMind', head_chimera: 'rampage',
    // A·B 세트 (D-050)
    head_mech_a: 'orbitalStrike', body_mech_a: 'autoTurret', arm_mech_a: 'chargedRail',
    head_mech_b: 'overdrive', body_mech_b: 'rocketDash', arm_mech_b: 'pileBunker',
    head_kaiju_a: 'spikeStorm', body_kaiju_a: 'thornArmor', arm_kaiju_a: 'groundSlam',
    head_kaiju_b: 'toxicBreath', body_kaiju_b: 'sporeBurst', arm_kaiju_b: 'acidSpit3',
    head_chimera_dragon: 'dragonBreath',   // 추가 머리 (세트 밖, D-054)
    head_hero_a: 'judgmentBlade', body_hero_a: 'bloodOath', arm_hero_a: 'whirlwind',
    head_hero_b: 'shadowClones', body_hero_b: 'curseChains', arm_hero_b: 'blackHole',
    head_chimera_a: 'maulCharge', body_chimera_a: 'adrenaline', arm_chimera_a: 'earthSmash',
    head_chimera_b: 'mobilize', body_chimera_b: 'boostShot', arm_chimera_b: 'flamethrower'
,
    // 심연의 길잡이 (기본·강화 파츠가 같은 스킬 — 강화는 능력치와 그림)
    arm_diver: 'anchorPull', arm_diver_up: 'anchorPull', body_diver: 'pressureSurge', body_diver_up: 'pressureSurge',
    head_diver: 'abyssHands', head_diver_up: 'abyssHands',
    // 봉합 성녀
    arm_saint: 'needleTriple', arm_saint_up: 'needleTriple', body_saint: 'lifeSeal', body_saint_up: 'lifeSeal',
    head_saint: 'forcedRevive', head_saint_up: 'forcedRevive',
    // 서리의 무희
    arm_frost: 'crescentSlash', arm_frost_up: 'crescentSlash', body_frost: 'blizzardDance', body_frost_up: 'blizzardDance',
    head_frost: 'eternalRest', head_frost_up: 'eternalRest',
    // 뒤틀린 인형사
    arm_doll: 'scissorX', arm_doll_up: 'scissorX', body_doll: 'dollFamily', body_doll_up: 'dollFamily',
    head_doll: 'puppetStrings', head_doll_up: 'puppetStrings'
};

// 다리 패시브 (v2 기준 설명 — parts.js 설명은 구버전과 공용이라 여기서 덮어씀). 효과는 battle/player.js (수치는 battle/tuning.js LEG)
export const LEG_PASSIVES = {
    leg_red_robot: { name: '유압 서스펜션', desc: '진격 속도 증가 (능력치)' },
    leg_chimera: { name: '지진 분쇄', desc: '전방 적에게 계속 지진 피해 (초당 30)' },
    leg_mutant: { name: '독성 점액', desc: '전방 적을 감속시키고 계속 독 피해 (초당 30)' },
    leg_mech_wheel: { name: '궤도 돌진', desc: '처음 부딪힌 적에게 돌진 피해를 주고 밀쳐내며 잠깐 기절 (적마다 4초에 한 번)' },
    leg_hero_hover: { name: '반중력 부양', desc: '근접 피해 30% 감소, 감속에 걸리지 않음' },
    // A·B 세트 (D-050) — 효과는 battle/sets.js (수치는 battle/tuning.js SET)
    leg_mech_a: { name: '포격 고정', desc: '멈춰 공격하는 동안 피해 +20% (걷는 동안 없음)' },
    leg_mech_b: { name: '자기장 방벽', desc: '원거리 공격(마취탄·그물·오물·자석)의 피해·효과 50% 감소' },
    leg_kaiju_a: { name: '단단한 껍질', desc: '받는 피해 15% 감소, 밀려나지 않음' },
    leg_kaiju_b: { name: '질주 본능', desc: '앞에 적이 없을 때 진격 속도 +30%' },
    leg_hero_a: { name: '불굴', desc: '내구도 30% 아래에서 받는 피해 40% 감소' },
    leg_hero_b: { name: '그림자 회피', desc: '25% 확률로 받는 피해 무시' },
    leg_chimera_a: { name: '짓밟기', desc: '걸음마다 앞쪽 작은 충격파 피해' },
    leg_chimera_b: { name: '졸개 지휘', desc: '졸개 하나마다 주는 피해 +5% (최대 4기)' }
,
    leg_diver: { name: '잠수화', desc: '밀려남 60% 감소, 감속·속박 시간 절반' },
    leg_diver_up: { name: '잠수화 (강화)', desc: '밀려남 80% 감소, 감속·속박 시간 70% 감소' },
    leg_saint: { name: '자가 봉합', desc: '잃은 내구도가 많을수록 빨리 회복 (최대 초당 2%)' },
    leg_saint_up: { name: '자가 봉합 (강화)', desc: '잃은 내구도가 많을수록 빨리 회복 (최대 초당 2.8%)' },
    leg_frost: { name: '빙판 걸음', desc: '얼어 있는 적에게 주는 피해 30% 증가' },
    leg_frost_up: { name: '빙판 걸음 (강화)', desc: '얼어 있는 적에게 주는 피해 45% 증가' },
    leg_doll: { name: '실 걸음', desc: '토끼 인형 하나마다 진격 속도 5% 증가 (최대 4기)' },
    leg_doll_up: { name: '실 걸음 (강화)', desc: '토끼 인형 하나마다 진격 속도 7% 증가 (최대 4기)' }
};

/** 다리 파츠 패시브 { name, desc } (없으면 null) */
export function legPassiveOf(part) {
    return part ? LEG_PASSIVES[part.id] || null : null;
}

/** 장착 파츠로 슬롯별 스킬 목록 { arm, body, head } (없으면 null) */
export function skillsForParts(equipped) {
    const pick = slot => {
        const id = equipped[slot] && PART_SKILL[equipped[slot].id];
        return id ? { id, ...SKILLS[id] } : null;
    };
    return { arm: pick('arm'), body: pick('body'), head: pick('head') };
}

/** 지금 사용할 대상이 있는지 */
export function hasTarget(b, skill) {
    if (skill.target === 'self') return true;
    if (skill.target === 'building') return b.enemies.some(e => e.isBuilding && e.x - b.frontX() <= skill.reach);   // 궤도 지원 사격
    const list = b.enemiesInRange(b.playerRange + (skill.range || 0));
    return skill.target === 'minion' ? list.some(e => !e.isBuilding) : list.length > 0;
}
