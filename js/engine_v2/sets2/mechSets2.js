/* ==========================================================================
   PROJECT: MAD OVERLORD // 거대로봇 2차 세트 (Q-009 · D-071 — MD/파츠확장_2차_기획안.md 5-1, 유니크 ①은 Q-008 3-2)
   유니크 ① 천둥 거신(u) · 레어 ③ 공병 중장비(c) · 레어 ④ 정찰 저격대(d) · 유니크 ② 플라즈마 정화대(v)
   · 유니크 ③ 방주 수호기(w) · 레전더리 ① 기신 아포칼립스(l) · 레전더리 ② 성간 방랑자(m)
   무기 팔 그림은 rigArm으로 (캐논 팔 = 원거리 포, 주먹 팔 = 주먹·드릴·방패·칼날)
   스킬은 부품 단계(skillKit_v2.js), 동작은 rig/mechRig.js (drill·doomCannon은 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';
import { FOOT_B } from '../battle/tuning.js';

const CYAN = '120, 240, 255', AMBER = '255, 180, 70', PLASMA = '215, 235, 255', GOLD = '255, 215, 110', RED = '255, 70, 60', STAR = '150, 255, 240';

// ---- D-118 스킬 이펙트 개선 (MD/스킬_이펙트_변경사항_공유.md 2차) — 기존 손그림 시트를 색 돌려 씀 ----
const muzzleAt = b => monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 125 };
/** 기본 공격 발사 (장거리 저격포·플라즈마 방사 팔 공용, attacks.js fireShotFx): 총구 섬광 + 빛줄기 탄, 맞는 판정은 예전 근접과 같음 */
const SNIPER_SHOT = { hue: 35, speed: 1900, size: 120, flash: 82, hitVfx: V.blast(20, 90, { dur: 0.32 }) };
/** 관통 저격 충전: 둘레 빛이 총구로 모임 — 저음 폭발(bass_drop) 고리를 거꾸로 틀어 줄어들게 + 모이는 빛줄기 */
function snipeCharge(b, ctx, s) {
    const at = () => { const m = muzzleAt(b); return [m.x, m.bottom]; };
    const [x, y] = at();
    b.fx.play(chargeFx(s.sec), x, y, { follow: at });
}
const chargeFx = sec => fxOf(
    { type: 'sprite', sheet: 'bass_drop', at: 0, dur: sec, size: 150, frameRange: [1, 4], reverse: true, hue: 115, glow: 0, fadeIn: 0.12 },
    { type: 'gather', at: 0, dur: sec, r: 95, count: 16, color: AMBER });
const FLASH_FX = fxOf({ type: 'sprite', sheet: 'needle_crimson', at: 0, dur: 0.22, size: 170, frameRange: [2, 4], hue: 35, glow: 1.3 },
    { type: 'sprite', sheet: 'golden_burst', at: 0.02, dur: 0.25, size: 110, frameRange: [1, 3], glow: 0 });
/** 관통 저격 발사 순간: 총구 섬광 (needle_crimson 별빛 칸) */
function snipeFlash(b) {
    const m = muzzleAt(b);
    b.fx.play(FLASH_FX, m.x, m.bottom);
}
/** 표적 지정 포격 한 발: 큰 궤도 광선(주황) + 대폭발 + 충격파 */
const STRIKE_FX = fxOf(
    { type: 'sprite', sheet: 'orbital_beam', at: 0, dur: 0.7, width: 300, height: 470, anchorY: 0.93, hue: -150, glow: 1.15 },
    { type: 'sprite', sheet: 'explosion_big', at: 0.16, dur: 0.85, size: 330, anchorY: 0.9, frameRange: [1, 7], glow: 0, blend: 'normal', alpha: 0.95, dispersion: 'burst' },
    { type: 'sprite', sheet: 'ground_impact', at: 0.14, dur: 0.6, size: 300, anchorY: 0.85, dispersion: 'burst', glow: 1.2 },
    ...V.shock(460, 0, 0.6).layers.map(l => ({ ...l, at: 0.15 })),
    { type: 'shards', at: 0.16, count: 10, speed: 360, size: 8, spin: 7, life: [0.7, 1.1], shape: 'rock', color: '95, 85, 75', floor: 0 }
);

// 천둥 폭풍 한 번: 무작위 적에게 하늘에서 번개 → 옆 적 jumps명에게 튐
function thunder(b, ctx, s) {
    const t = pickTargets(b, 'random', 1, b.playerRange + 500)[0];
    if (!t) return;
    const a = aimAt(t);
    b.fx.play(V.sheet('thunder_storm', 260, { anchorY: 0.95, dur: 0.5 }), a.x, FOOT_B);
    kitHit(b, t, s.dmg, { knock: 0.3, status: { stun: s.stun } });
    const done = new Set([t]);
    let from = [a.x, a.b];
    for (let i = 0; i < s.jumps; i++) {
        const next = b.enemies.filter(e => !done.has(e) && e.hp > 0 && Math.abs(aimAt(e).x - from[0]) <= 180)
            .sort((p, q) => Math.abs(aimAt(p).x - from[0]) - Math.abs(aimAt(q).x - from[0]))[0];
        if (!next) break;
        done.add(next);
        const to = [aimAt(next).x, aimAt(next).b], f = from;
        b.schedule((i + 1) * 0.07, () => {
            b.fx.play(V.chainBolt(CYAN), f[0], f[1], { to });
            kitHit(b, next, s.dmg * 0.6, { knock: 0.2, status: { stun: s.stun } });
        });
        from = to;
    }
    if (Math.random() < 0.5) b.director.shake(3, 120);
}

// 표적 지정 포격: 강한 적 n명에 표적 → delay초 뒤 정밀 포격
function targetStrike(b, ctx, s) {
    const list = pickTargets(b, 'strongest', s.n, b.playerRange + 500);
    list.forEach((t, i) => {
        // 조준 표식: 적을 따라다니며 줄어들어 고정 (D-118 — 예전 작은 고리 대신)
        b.fx.play(fxOf({ type: 'reticle', at: 0, dur: s.delay + i * 0.15 + 0.12, r: 46, color: RED }), aimAt(t).x, aimAt(t).b,
            { follow: () => [aimAt(t).x, aimAt(t).b] });
        b.schedule(s.delay + i * 0.15, () => {
            if (!b.enemies.includes(t)) return;
            b.fx.play(STRIKE_FX, aimAt(t).x, FOOT_B);
            kitHit(b, t, s.dmg, { knock: 1.2, baseMul: 1.5 });
            enemiesNear(b, aimAt(t).x, 70, true).filter(e => e !== t).forEach(e => kitHit(b, e, s.dmg * 0.3, { knock: 0.6 }));
            b.director.shake(9, 320);
        });
    });
}

// 광학 위장: sec초 반투명 (kit.js setupKit이 판마다 되돌림)
function cloak(b, ctx, s) {
    const c = monster.spriteCanvas;
    if (!c) return;
    c.style.opacity = '0.4';
    b.schedule(s.sec, () => { c.style.opacity = ''; });
}

// 방주 방벽이 끝날 때: 모은 피해를 앞쪽 충격파로 (4부위)
function arkRelease(b) {
    const dmg = b.kitStored || 0;
    b.kitStored = 0;
    if (dmg <= 0 || !b.isActive) return;
    b.fx.play(V.ring(GOLD, 220), b.monsterX + 90, FOOT_B);
    b.fx.play(V.gold(0, 200), b.monsterX + 110, FOOT_B + 60);
    b.enemiesInRange(260).forEach(e => b.dealDamageToEnemy(e, dmg, false, { knock: 1.2 }));
    b.createDamagePopup(b.monsterX + 40, 220, '방주 반격!', false);
}

const DRONES = [[-80, -200, 0], [22, -240, 2.1], [118, -195, 4.2]];   // 머리 위 자리 [x, y, 흔들림 위상]
const droneFx = (sec, ox, oy, phase, i) => fxOf({ type: 'drone', at: 0, dur: sec, size: 52, ox, oy, phase, tx: (i - 1) * 14, ty: -85, color: '125, 255, 154' });
// 수리 드론 3기: 캐릭터를 따라 떠다니며 치료 광선 (vfx/skillFx2.js drone)
function repairDrones(b, ctx, s) {
    const at = () => [b.monsterX + 60, FOOT_B];
    DRONES.forEach(([ox, oy, phase], i) => b.schedule(i * 0.12, () => {
        if (!b.isActive) return;
        b.fx.play(droneFx(s.sec - i * 0.12, ox, oy, phase, i), ...at(), { follow: at });
    }));
    b.fx.play(V.sheet('heal_rain', 260, { dur: 1.2, frameRange: [2, 7], glow: 0, dy: -110 }), b.monsterX + 60, FOOT_B);
}

// 기신 보행: 걸음마다 앞 적 작은 피해, 10% 확률 0.5초 기절
function titanStep(b) {
    const list = enemiesNear(b, b.frontX() + 50, 70, true);
    if (!list.length) return;
    b.fx.play(V.impact(-30, 110, { dur: 0.35 }), b.frontX() + 40, FOOT_B);
    list.forEach(e => kitHit(b, e, 0.15, { knock: 0.2, status: Math.random() < 0.1 ? { stun: 0.5 } : null }));
}

export const MECH_SETS2 = packOf('mech', [
    // ---- 유니크 ① 천둥 거신 (Q-008 3-2) — 번개를 다루는 최종 병기 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '천둥 거신', style: 'dps', tint: 'hue-rotate(-70deg) saturate(1.5) brightness(1.15)',
        bonus: { 2: '연쇄 번개가 1명 더 튐', 4: '천둥 폭풍 동안 스킬 쿨다운 2배 빨리' },
        kit: { 2: { patch: { _attack: { n: 1 } } }, 4: { on: [{ when: 'ult', buff: { key: 'stormCd', sec: 8, mods: { cdRate: 1 } } }] } },
        head: { name: '뇌운 관제 헬름', look: '피뢰침 뿔 둘, 청록 눈 줄', skill: 'mcThunderStorm', desc: '필살기 천둥 폭풍: 8초간 0.5초마다 무작위 적에게 번개 (옆 적 2명에게 튐, 0.3초 기절)', stats: { hp: 600, dps: 140, range: 60, speed: 5 } },
        body: { name: '테슬라 코일 코어', look: '가슴에 도는 코일, 어깨 방전구', skill: 'mcEmp', desc: '전자기 펄스: 날아오는 적 투사체를 지우고 둘레 적 2초 기절', stats: { hp: 1900, dps: 100, range: 0, speed: 0 } },
        arm: { name: '로켓 펀치 건틀릿', look: '팔꿈치 추진기가 달린 큰 주먹', skill: 'mcRocketPunch', desc: '기본 공격 연쇄 번개 (가까운 적 2명에게 튐, 60%) · 로켓 펀치: 일직선을 꿰뚫고 되돌아옴', stats: { hp: 400, dps: 540, range: 360, speed: 0 },
            rigArm: 'fist', kitAttack: { kind: 'chain', n: 3, decay: 0.6, jump: 160, vfx: V.chainBolt(CYAN), hitVfx: V.bolt(0, 70, { dur: 0.3 }), knock: 0.3 } },
        leg: { name: '전자기 레일 다리', look: '발바닥 자기 레일, 청록 불빛', desc: '보행 충전: 10초 걸으면 다음 기본 공격 3배 + 둘레 적에게 번개', stats: { hp: 900, dps: 80, range: 0, speed: 140 },
            passive: { name: '보행 충전', desc: '걸을수록 전기가 참 — 10초 걸으면 다음 기본 공격 3배 + 둘레 적 3명에게 번개', charge: { sec: 10, mul: 3, label: '전기 충전 완료!',
                step: { do: 'hit', pick: 'nearest', n: 3, range: 220, dmg: 0.8, status: { stun: 0.3 }, vfx: V.bolt(0, 110) }, fx: V.motes(CYAN, 6) } } },
        skills: {
            mcThunderStorm: { name: '천둥 폭풍', slot: 'head', ult: true, cd: 0, icon: 'surge', color: '#78f0ff', target: 'enemy', range: 500, clip: 'call',
                desc: '8초간 0.5초마다 무작위 적에게 번개 — 옆 적 2명에게 튀고 0.3초 기절',
                steps: [{ at: 0.3, do: 'custom', fn: thunder, dmg: 1.4, jumps: 2, stun: 0.3, repeat: 16, repeatGap: 0.5 }] },
            mcEmp: { name: '전자기 펄스', slot: 'body', cd: 15, icon: 'stun', color: '#78f0ff', target: 'self', clip: 'power',
                desc: '날아오는 적 투사체를 지우고 둘레 적 2초 기절',
                steps: [{ do: 'buff', key: 'emp', sec: 1.2, mods: { flags: ['projBlock'] } },
                    { at: 0.3, do: 'fx', on: 'self', x: 25, b: FOOT_B + 40, vfx: V.ring(CYAN, 230) },
                    { at: 0.3, do: 'fx', on: 'self', x: 40, b: FOOT_B + 90, vfx: V.bolt(0, 200) },
                    { at: 0.3, do: 'hit', pick: 'all', range: 230, dmg: 0.5, status: { stun: 2 }, vfx: V.bolt(0, 80, { dur: 0.3 }) }] },
            mcRocketPunch: { name: '로켓 펀치', slot: 'arm', cd: 9, icon: 'fist', color: '#78f0ff', target: 'enemy', range: 380, clip: 'pile',
                desc: '주먹이 날아가 일직선을 꿰뚫고 되돌아옴 — 갈 때·올 때 피해',
                steps: [{ at: 0.3, do: 'wave', from: 0, speed: 780, dist: 400, w: 45, dmg: 1.7, back: true, knock: 0.8, vfx: V.punch(0, 110, { dur: 0.25 }), vfxEvery: 0.05, b: 125, hitVfx: V.bolt(0, 70, { dur: 0.3 }) }] }
        }
    },

    // ---- 레어 ③ 공병 중장비 (탱커) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '공병 중장비', style: 'tank', tint: 'sepia(0.6) saturate(2.2) hue-rotate(5deg) brightness(1.1)',
        bonus: { 4: '강철 방벽이 서 있는 동안 공격 속도 +30%' },
        kit: { 4: { patch: { mcSteelWall: { atk: 0.3 } } } },
        head: { name: '작업 관제 헬멧', look: '노랑·검정 경고 줄무늬 헬멧과 경광등', skill: 'mcWreckingBall', desc: '필살기 철거 철구: 거대 철구가 앞쪽을 쓸고 지나감 — 모든 적 피해 + 크게 밀침 (거점 2배)' },
        body: { name: '굴착기 동체', look: '노랑 굴착기 장갑과 배기관', skill: 'mcSteelWall', desc: '강철 방벽: 앞에 강철 벽 5초 — 적 진격·투사체를 막고, 끝날 때 무너지며 앞쪽 피해' },
        arm: { name: '유압 드릴 팔', look: '팔 끝 거대 회전 드릴', skill: 'mcDrill', desc: '드릴 관통: 가장 가까운 적을 6번 갈아냄 (방어 무시), 마지막에 밀침', rigArm: 'fist' },
        leg: { name: '무한궤도', look: '다리 아래 무한궤도', desc: '궤도 차체: 감속 무시, 거점에 주는 피해 +15%',
            passive: { name: '궤도 차체', desc: '감속 무시, 거점·바리케이드에 주는 피해 +15%', flags: ['slowImmune'], target: [{ when: 'building', dmg: 0.15 }] } },
        skills: {
            mcWreckingBall: { name: '철거 철구', slot: 'head', ult: true, cd: 0, icon: 'hammer', color: '#ffd23c', target: 'enemy', range: 600, clip: 'call',
                desc: '거대 철구가 앞쪽을 쓸고 지나감 — 모든 적 피해 + 크게 밀침 (거점 2배)',
                steps: [{ at: 0.4, do: 'wave', from: -60, speed: 560, dist: 760, w: 75, dmg: 3, baseMul: 2, push: 90, knock: 1.4, vfx: V.sheet('wrecking_ball', 260, { anchorY: 0.85, dur: 0.4 }), vfxEvery: 0.12, b: FOOT_B + 5, hitVfx: V.impact(30, 120) },
                    { at: 0.4, do: 'shake', power: 7, ms: 900 }] },
            mcSteelWall: { name: '강철 방벽', slot: 'body', cd: 14, icon: 'fort', color: '#ffd23c', target: 'self', clip: 'guard', p: { atk: 0 },
                desc: '앞에 강철 벽 5초 — 적이 넘어오지 못하고 투사체를 막음, 끝날 때 무너지며 앞쪽 피해',
                // D-118: 위에서 쏘는 빛기둥(pillar) 대신 강철 벽 그림이 솟음 (판정 폭 46px 그대로, 그림은 kit.js art · ui_v2.css is-steelwall)
                steps: [{ at: 0.2, do: 'zone', tag: 'wall', wall: true, x: 30, w: 46, sec: 5, art: { cls: 'is-steelwall', sheet: 'steel_wall', w: 140, h: 200, dx: -47 },
                    end: { dmg: 2.5, radius: 160, vfx: fxOf(...V.impact(30, 240).layers, { type: 'shards', at: 0, count: 12, speed: 320, size: 9, spin: 6, life: [0.8, 1.2], shape: 'rock', color: '130, 135, 145', floor: 0, dy: -60 }) } },
                    { at: 0.2, do: 'buff', key: 'steelWall', sec: 5, mods: { flags: ['projBlock'], atkSpd: '$atk' } },
                    { at: 0.2, do: 'fx', x: 53, vfx: V.sheet('bulldozer_dust', 190, { anchorY: 0.9, dur: 0.6, frameRange: [1, 6], blend: 'normal', alpha: 0.8, glow: 0 }) },
                    { at: 0.2, do: 'fx', x: 53, vfx: V.impact(30, 150) }, { at: 0.2, do: 'shake', power: 5, ms: 200 }] },
            mcDrill: { name: '드릴 관통', slot: 'arm', cd: 8, icon: 'pile', color: '#ffd23c', target: 'enemy', range: 60, clip: 'drill',
                desc: '가장 가까운 적을 6번 갈아냄 (방어 무시) — 마지막에 크게 밀침',
                steps: [{ at: 0.2, do: 'hit', times: 6, every: 0.15, dmg: 0.7, pierce: 1, knock: 0.1, vfx: V.punch(-150, 90, { dur: 0.2 }) },
                    { at: 1.15, do: 'hit', dmg: 0.8, knock: 2, vfx: V.impact(30, 130) }] }
        }
    },

    // ---- 레어 ④ 정찰 저격대 (사거리) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '정찰 저격대', style: 'range', tint: 'sepia(0.7) saturate(1.2) hue-rotate(-10deg) brightness(1.05)',
        bonus: { 4: '관통 저격에 맞은 첫 적 1.5초 기절, 쿨다운 -2초' },
        kit: { 4: { patch: { mcSnipe: { stun: 1.5, cd: -2 } } } },
        head: { name: '정찰 바이저', look: '돔 앞의 큰 주황 조준 렌즈와 안테나', skill: 'mcTargetStrike', desc: '필살기 표적 지정 포격: 강한 적 3명(엘리트·보스 먼저)에 표적 → 1.2초 뒤 정밀 포격' },
        body: { name: '광학 위장 장갑', look: '모래색 위장 무늬 장갑', skill: 'mcCloak', desc: '광학 위장: 4초간 받는 피해 -80%, 끝나면 다음 기본 공격 3배' },
        arm: { name: '장거리 저격포', look: '아주 긴 저격포 포신', skill: 'mcSnipe', desc: '관통 저격: 사거리 끝까지 꿰뚫는 한 발, 엘리트·보스 피해 2배', rigArm: 'cannon', shotFx: SNIPER_SHOT },
        leg: { name: '지지대 다리', look: '땅에 박는 지지대가 달린 다리', desc: '원거리 조준: 200px보다 먼 적에게 피해 +15%',
            passive: { name: '원거리 조준', desc: '200px보다 먼 적에게 주는 피해 +15%', target: [{ when: 'far', dist: 200, dmg: 0.15 }] } },
        skills: {
            mcTargetStrike: { name: '표적 지정 포격', slot: 'head', ult: true, cd: 0, icon: 'orbital', color: '#ffb446', target: 'enemy', range: 500, clip: 'call',
                desc: '강한 적 3명(엘리트·보스 먼저)에 표적 → 1.2초 뒤 정밀 포격 (각각 큰 피해)',
                steps: [{ at: 0.25, do: 'custom', fn: targetStrike, n: 3, delay: 1.2, dmg: 6, preview: (api, k) => api.dummies.forEach((d, i) => {
                    api.vfx.play(fxOf({ type: 'reticle', at: 0, dur: 1.2 + i * 0.15, r: 46, color: RED }), d.x, api.enemyChestY(), { scale: k });
                    api.later(1.2 + i * 0.15, () => { api.vfx.play(STRIKE_FX, d.x, api.GROUND_Y, { scale: k }); api.hit(i); api.shake(8, 0.3); });
                }) }] },
            mcCloak: { name: '광학 위장', slot: 'body', cd: 15, icon: 'clone', color: '#ffb446', target: 'self', clip: 'guard',
                desc: '4초간 받는 피해 -80% — 끝나면 다음 기본 공격 3배',
                steps: [{ do: 'buff', key: 'cloak', sec: 4, mods: { def: 0.8, onEnd: { do: 'custom', fn: b => { b.kitNextMul = Math.max(b.kitNextMul, 3); } } }, vfx: V.motes('210, 230, 255', 14) },
                    { do: 'custom', fn: cloak, sec: 4 }] },
            mcSnipe: { name: '관통 저격', slot: 'arm', cd: 9, icon: 'rail', color: '#ffb446', target: 'enemy', range: 600, clip: 'rail', p: { stun: 0 },
                desc: '사거리 끝까지 꿰뚫는 한 발 — 엘리트·보스 피해 2배',
                // D-118: 0.05~1초 총구로 빛이 모이는 충전 → 섬광 + 호박색 광선 (apocalypse_beam 색 돌림)
                steps: [{ at: 0.05, do: 'custom', fn: snipeCharge, sec: 0.95, preview: (api, k) => { const [x, y] = api.muzzle(); api.vfx.play(chargeFx(0.95), x, y, { scale: k, follow: () => api.muzzle() }); } },
                    { at: 1.0, do: 'custom', fn: snipeFlash, preview: (api, k) => { const [x, y] = api.muzzle(); api.vfx.play(FLASH_FX, x, y, { scale: k }); } },
                    { at: 1.0, do: 'line', dmg: 3, eliteMul: 2, pierce: 0.5, decay: 1, knock: 0.8,
                        // 강한 저격탄: 큰 빛줄기 탄이 화면 끝까지 날아가고, 지나간 자리에 호박색 탄도(누운 궤도 광선 기둥)가 탄과 같이 뻗었다 사라짐
                        vfx: fxOf(spr('needle_crimson', 300, { dur: 0.12, frameRange: [1, 1], hue: 35, travel: true, anchorX: 0.62, glow: 1.4 }),
                            ...V.laser(-150, 1100, 110, { dur: 0.45, growIn: 0.12, fadeOut: 0.3 }).layers,
                            ...V.laser(-150, 1100, 44, { dur: 0.4, growIn: 0.12, fadeOut: 0.25, glow: 0 }).layers),
                        hitVfx: V.blast(20, 80, { dur: 0.3 }) },
                    { at: 1.0, do: 'hit', pick: 'nearest', range: 600, dmg: 0, status: { stun: '$stun' } }] }
        }
    },

    // ---- 유니크 ② 플라즈마 정화대 (균형) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '플라즈마 정화대', style: 'balance', tint: 'saturate(0.3) brightness(1.45) hue-rotate(180deg)',
        bonus: { 2: '플라즈마 고리가 되돌아옴', 4: '융단 장판 위 적은 받는 피해 +25%' },
        kit: { 2: { patch: { mcPlasmaRing: { back: true } } }, 4: { patch: { mcPlasmaCarpet: { vuln: 0.25 } } } },
        head: { name: '정화 헬름', look: '흰 장갑 헬름과 청백 빛 줄', skill: 'mcPlasmaCarpet', desc: '필살기 플라즈마 융단: 앞쪽 전체 폭격 → 6초 타는 장판 (거점에도)' },
        body: { name: '냉각 배기 동체', look: '흰 장갑 동체, 등에 냉각 배기구', skill: 'mcCoolant', desc: '냉각 배출: 내 해로운 효과 풀림 + 앞 적 밀침 + 2초 감속' },
        arm: { name: '플라즈마 방사 팔', look: '청백 빛 고리가 감긴 방사기 팔', skill: 'mcPlasmaRing', desc: '플라즈마 고리: 도는 고리가 앞으로 날아가며 지나는 적을 여러 번', rigArm: 'cannon', shotFx: SNIPER_SHOT },   // 기본 공격 = 장거리 저격포와 같은 발사 연출 (D-118)
        leg: { name: '내열 다리', look: '붉게 달아오른 냉각핀 다리', desc: '과열 순환: 스킬을 쓰면 3초간 기본 공격에 화상',
            passive: { name: '과열 순환', desc: '스킬을 쓰면 3초간 기본 공격에 화상', onSkill: { sec: 3, mods: { hitStatus: { burn: [3, 0.3] } } } } },
        skills: {
            mcPlasmaCarpet: { name: '플라즈마 융단', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#d7ebff', target: 'enemy', range: 520, clip: 'salvo', p: { vuln: 0 },
                desc: '앞쪽 전체에 플라즈마 폭격 → 6초간 타는 장판 (거점에도)',
                // D-118: 연기 시트 대신 하늘에서 내리꽂는 청백 레이저(orbital_beam) → 바닥이 타는 장판(plasmaBurn = power_aura 불꽃을 청백으로)
                steps: [{ at: 0.2, do: 'rain', count: 8, every: 0.12, x: [40, 520], aim: false, radius: 70, dmg: 1.4, baseMul: 1.5, delay: 0.12, shake: 3,
                        vfx: fxOf(spr('orbital_beam', 0, { width: 190, height: 430, anchorY: 0.93, dur: 0.6, hue: 10, glow: 1.25 }),
                            spr('lightning_burst', 150, { at: 0.12, dur: 0.35, hue: 150, frameRange: [1, 5], glow: 0, dy: -20 })) },
                    { at: 1.2, do: 'zone', tag: 'plasma', field: 'plasmaBurn', x: 30, w: 500, sec: 6, dps: 0.4, baseMul: 1, vuln: '$vuln' }] },
            mcCoolant: { name: '냉각 배출', slot: 'body', cd: 14, icon: 'wave', color: '#d7ebff', target: 'self', clip: 'power',
                desc: '증기 분출 — 내 해로운 효과 풀림 + 앞 적 밀침 + 2초 감속',
                steps: [{ do: 'cleanse' }, { at: 0.2, do: 'push', range: 200, dist: 110, dmg: 0.6, status: { slow: 2 } },
                    { at: 0.2, do: 'fx', on: 'self', x: 60, b: FOOT_B + 70, vfx: V.ice(0, 170) },
                    { at: 0.2, do: 'fx', on: 'self', x: 20, b: FOOT_B + 120, vfx: V.motes(PLASMA, 16) }] },
            mcPlasmaRing: { name: '플라즈마 고리', slot: 'arm', cd: 9, icon: 'wave', color: '#d7ebff', target: 'enemy', range: 360, clip: 'beam', p: { back: false },
                desc: '도는 플라즈마 고리가 앞으로 날아가며 지나는 적을 여러 번 (2부위: 되돌아옴)',
                steps: [{ at: 0.3, do: 'wave', from: 0, speed: 380, dist: 380, w: 50, every: 0.25, dmg: 0.7, back: '$back', knock: 0.2, vfx: V.sheet('sonic_ring', 120, { dur: 0.3, hue: 20 }), vfxEvery: 0.07, b: 120, status: { burn: [2, 0.2] } }] }
        }
    },

    // ---- 유니크 ③ 방주 수호기 (탱커) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '방주 수호기', style: 'tank', tint: 'sepia(0.5) saturate(1.6) brightness(1.35) hue-rotate(-10deg)',
        bonus: { 2: '방패 돌진 쿨다운 -2초', 4: '방주 방벽이 끝날 때 막은 피해의 50%를 앞쪽 충격파로' },
        kit: { 2: { patch: { mcShieldRush: { cd: -2 } } }, 4: { patch: { mcArkWall: { store: 0.5 } } } },
        head: { name: '방주 관제 헬름', look: '흰·금 장갑 헬름과 금빛 문장', skill: 'mcArkWall', desc: '필살기 방주 방벽: 6초 금빛 돔 — 받는 피해 -70%, 적 투사체 막음, 아군 보호막' },
        body: { name: '수리 정거장 동체', look: '흰 장갑 동체와 등의 수리 드론 정거장', skill: 'mcRepairDrones', desc: '수리 드론: 6초간 초당 체력 2% (아군도)' },
        arm: { name: '방패 팔', look: '팔에 붙은 커다란 흰·금 방패', skill: 'mcShieldRush', desc: '방패 돌진: 짧게 돌진 — 앞 적 크게 밀침 + 1초 기절', rigArm: 'fist' },
        leg: { name: '완충 다리', look: '두꺼운 완충 장치 다리', desc: '완충 장갑: 5초마다 받는 공격 하나를 막음',
            passive: { name: '완충 장갑', desc: '5초마다 받는 공격 하나를 막음', block: 5 } },
        skills: {
            mcArkWall: { name: '방주 방벽', slot: 'head', ult: true, cd: 0, icon: 'shield', color: '#ffd76e', target: 'self', clip: 'guard', p: { store: 0 },
                desc: '6초간 금빛 돔 — 받는 피해 -70%, 적 투사체 막음, 아군에게 보호막',
                steps: [{ do: 'buff', key: 'ark', sec: 6, mods: { def: 0.7, flags: ['projBlock'], store: '$store', onEnd: { do: 'custom', fn: arkRelease } } },
                    // D-118: 리그 실드 막(quiet)과 0.82초마다 겹쳐 틀던 돔이 두 겹으로 보였음 → 금빛 돔 하나를 6초 이어 틀기 (빛 번짐 사본 없음, 잘린 마지막 칸 제외)
                    { do: 'shield', ratio: 0.2, sec: 6, allies: true, color: GOLD, quiet: true },
                    { at: 0.05, do: 'fx', on: 'self', x: 30, follow: true, vfx: V.sheet('dome_gold', 340, { anchorY: 0.88, dur: 5.95, frameRange: [1, 6], loopSec: 1.6, pingPong: true,
                        glow: 0, fadeIn: 0.25, fadeOut: 0.45, mask: 'dome', rim: GOLD }) }] },   // 칸 좌우에 닿아 세로로 잘리던 벽 → 돔 윤곽으로 가림 + 빛 테두리
            mcRepairDrones: { name: '수리 드론', slot: 'body', cd: 15, icon: 'drone', color: '#ffd76e', target: 'self', clip: 'launch',
                desc: '수리 드론 3기 6초 — 초당 체력 2% (아군도)',
                // D-118: 드론 3기(art/repair_drone)가 머리 위를 떠다니며 1초마다 치료 광선 — 회복 판정(장판)은 그대로
                steps: [{ at: 0.3, do: 'zone', follow: true, x: -170, w: 360, sec: 6, heal: 0.02, allyHeal: 0.02 },
                    { at: 0.3, do: 'custom', fn: repairDrones, sec: 6, preview: (api, k) => DRONES.forEach(([ox, oy, phase], i) =>
                        api.vfx.play(droneFx(4, ox, oy, phase, i), api.CHAR_X + 40 * k, api.GROUND_Y, { scale: k })) }] },
            mcShieldRush: { name: '방패 돌진', slot: 'arm', cd: 9, icon: 'shield', color: '#ffd76e', target: 'enemy', range: 160, clip: 'dash',
                desc: '짧게 돌진 — 앞 적 크게 밀침 + 1초 기절',
                // shove: 적을 뚫고 지나가지 않고 방패 앞에 붙여 밀고 감, 밀리지 않는 적 앞에선 멈춤 → 끝에 앞쪽 밀침 (디스코드 QA 11-05 홍도도)
                steps: [{ do: 'dash', dist: 130, sec: 0.3, dmg: 1.2, knock: 0, shove: true, status: { stun: 1 } },
                    { at: 0.32, do: 'push', range: 160, dist: 45 },   // 밀고 온 무리를 통째로 한 번 더 밀침 (간격 유지)
                    { at: 0.3, do: 'fx', on: 'self', x: 90, b: 110, vfx: V.gold(0, 150) }, { at: 0.3, do: 'shake', power: 4, ms: 150 }] }
        }
    },

    // ---- 레전더리 ① 기신 아포칼립스 (공격) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '기신 아포칼립스', style: 'dps', tint: 'brightness(0.55) saturate(1.8) hue-rotate(-60deg) contrast(1.2) drop-shadow(0 0 7px rgba(255, 60, 60, 0.8))',
        bonus: { 2: '가속포 난사 +6발', 4: '종말의 포를 쏜 뒤 팔·몸통 스킬 쿨다운 초기화' },
        kit: { 2: { patch: { mcSalvoStorm: { count: 6 } } }, 4: { on: [{ when: 'ult', delay: 5.2, resetCd: ['arm', 'body'], label: '재장전 완료!' }] } },
        head: { name: '종말 연산 헬름', look: '검은 장갑 헬름과 붉은 눈 줄', skill: 'mcDoomCannon', desc: '필살기 종말의 포: 2초 충전 후 화면 끝까지 거대 광선 3초 (거점 2배)' },
        body: { name: '과부하 동력로', look: '가슴에 붉게 빛나는 동력로 코어', skill: 'mcOverload', desc: '동력 과부하: 8초간 공격 속도 +40%·쿨다운 2배 빨리, 대신 초당 체력 1%' },
        arm: { name: '쌍열 가속포', look: '포신 두 개가 나란한 검붉은 가속포', skill: 'mcSalvoStorm', desc: '기본 공격 쌍열 포격 (두 발, 작은 범위 폭발) · 가속포 난사: 1.5초 동안 포탄 12발',
            rigArm: 'cannon', kitAttack: { kind: 'shot', n: 2, gap: 0.1, color: RED, vfx: V.blast(0, 80, { dur: 0.35 }), splash: 70, splashMul: 0.5 } },
        leg: { name: '기신의 다리', look: '붉은 균열이 빛나는 거대한 검은 다리', desc: '기신 보행: 걸음마다 땅울림 — 앞 적 작은 피해, 10% 확률 0.5초 기절',
            passive: { name: '기신 보행', desc: '걸음마다 땅울림 — 앞 적 작은 피해, 10% 확률 0.5초 기절', step: { do: 'custom', fn: titanStep } } },
        skills: {
            mcDoomCannon: { name: '종말의 포', slot: 'head', ult: true, cd: 0, icon: 'laser', color: '#ff463c', target: 'enemy', range: 700, clip: 'doomCannon', sfx: 'charge_up',
                desc: '2초 충전 → 화면 끝까지 거대 광선 3초 (거점 2배)',
                steps: [{ do: 'buff', key: 'doomCannon', sec: 5.2, mods: { flags: ['knockImmune'] } },
                    { at: 0.1, do: 'fx', on: 'self', x: 50, vfx: V.aura(-40, 230, { dur: 1 }), repeat: 2, repeatGap: 0.95 },
                    { at: 2.0, do: 'shake', power: 9, ms: 3000 },
                    { at: 2.0, do: 'line', dmg: 1.2, baseMul: 2, decay: 1, knock: 0.3, vfx: V.sheet('apocalypse_beam', 560, { anchorX: 0.03, dur: 0.45 }), hitVfx: V.blast(0, 70, { dur: 0.3 }), repeat: 8, repeatGap: 0.38 }] },
            mcOverload: { name: '동력 과부하', slot: 'body', cd: 16, icon: 'overdrive', color: '#ff463c', target: 'self', clip: 'power',
                desc: '8초간 공격 속도 +40% · 쿨다운 2배 빨리 — 대신 초당 체력 1%',
                steps: [{ do: 'buff', key: 'overload', sec: 8, mods: { atkSpd: 0.4, cdRate: 1, drain: 0.01 }, vfx: V.aura(-40, 210) },
                    { at: 0.2, do: 'fx', on: 'self', x: 30, b: FOOT_B + 120, vfx: V.embers(RED), repeat: 8, repeatGap: 1 }] },
            mcSalvoStorm: { name: '가속포 난사', slot: 'arm', cd: 9, icon: 'missile', color: '#ff463c', target: 'enemy', range: 380, clip: 'salvo', p: { count: 12 },
                desc: '1.5초 동안 포탄 12발을 흩뿌림 (2부위: +6발)',
                steps: [{ at: 0.1, do: 'rain', count: '$count', every: 0.12, radius: 55, dmg: 0.6, vfx: V.blast(0, 110), delay: 0.15, shake: 2 }] }
        }
    },

    // ---- 레전더리 ② 성간 방랑자 (속도) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '성간 방랑자', style: 'speed', tint: 'saturate(0.4) brightness(1.3) hue-rotate(150deg) drop-shadow(0 0 7px rgba(120, 255, 240, 0.8))',
        bonus: { 2: '차원 도약 쿨다운 -4초', 4: '유성에 쓰러진 적마다 체력 1% 회복' },
        kit: { 2: { patch: { mcWarp: { cd: -4 } } }, 4: { on: [{ when: 'kill', flag: 'meteorUlt', heal: 0.01 }] } },
        head: { name: '항성 관측 헬름', look: '은빛 헬름과 별빛 청록 렌즈', skill: 'mcMeteorShower', desc: '필살기 유성우: 7초간 유성 18개 (큰 범위 + 0.5초 기절)' },
        body: { name: '워프 코어', look: '가슴에 도는 청록 워프 고리', skill: 'mcWarp', desc: '차원 도약: 앞으로 200px 순간 이동 — 떠난 자리에 시간 균열 5초 (적 감속)' },
        arm: { name: '광자 블레이드', look: '팔 끝에서 뻗은 청록 빛 칼날', skill: 'mcDimensionCut', desc: '기본 공격 광자 베기 (중거리 호, 둘레까지) · 차원 절단: 일직선 베기 → 1초 뒤 같은 줄 두 번째 베기',
            rigArm: 'fist', kitAttack: { kind: 'melee', vfx: V.slash(-100, 150), splash: 90, splashMul: 0.6 } },
        leg: { name: '추진 비행 다리', look: '발에 청록 추진 불꽃', desc: '저중력 비행: 장판·밀림 무시, 진격 속도 +10%',
            passive: { name: '저중력 비행', desc: '장판·밀림 무시, 진격 속도 +10%', flags: ['knockImmune', 'ignoreHazard'], mods: { move: 0.1 } } },
        skills: {
            mcMeteorShower: { name: '유성우', slot: 'head', ult: true, cd: 0, icon: 'rocket', color: '#96fff0', target: 'enemy', range: 560, clip: 'call',
                desc: '7초간 유성 18개 — 큰 범위 피해 + 0.5초 기절',
                steps: [{ do: 'buff', key: 'meteorUlt', sec: 7.5, mods: { flags: ['meteorUlt'] } },
                    { at: 0.3, do: 'rain', count: 18, every: 0.38, x: [40, 560], radius: 85, dmg: 1.6, status: { stun: 0.5 }, vfx: V.sheet('meteor_cyan', 270, { anchorY: 0.85, dur: 0.7 }), delay: 0.35, shake: 3 }] },
            mcWarp: { name: '차원 도약', slot: 'body', cd: 14, icon: 'speed', color: '#96fff0', target: 'enemy', range: 200, clip: 'dash',
                desc: '앞으로 200px 순간 이동 — 떠난 자리에 시간 균열 5초 (적 감속)',
                steps: [{ at: 0.1, do: 'blink', dist: 200, dmg: 0.8, vfx: V.portal(120, 150, { dur: 0.5, softEdges: 0.16 }), leave: { tag: 'rift', field: 'rift', w: 170, sec: 5, slow: true } }] },
            mcDimensionCut: { name: '차원 절단', slot: 'arm', cd: 9, icon: 'sword', color: '#96fff0', target: 'enemy', range: 400, clip: 'rush',
                desc: '사거리 400 일직선 베기 → 1초 뒤 같은 줄 두 번째 베기',
                steps: [{ at: 0.15, do: 'line', dmg: 1.6, pierce: 0.3, decay: 1, knock: 0.4, vfx: V.beam(STAR, 14), hitVfx: V.xcut(0, 90) },
                    { at: 1.15, do: 'line', dmg: 1.6, pierce: 0.3, decay: 1, knock: 0.6, vfx: V.beam(STAR, 18), hitVfx: V.xcut(0, 110) }] }
        }
    }
]);
