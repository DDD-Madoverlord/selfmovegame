/* ==========================================================================
   PROJECT: MAD OVERLORD // 합성괴인 2차 세트 (Q-009 · D-071 — MD/파츠확장_2차_기획안.md 5-4, 유니크 ①은 Q-008 3-2)
   유니크 ① 완전체 키메라(u) · 레어 ③ 거미 실험체(c) · 레어 ④ 박쥐 음파 연구체(d) · 유니크 ② 사마귀 칼날 괴인(v)
   · 유니크 ③ 심해 상어 괴인(w) · 레전더리 ① 키메라 군단 총수(l) · 레전더리 ② 만수의 왕(m)
   스킬은 부품 단계(skillKit_v2.js), 동작은 rig/chimeraRig.js (slashes·soar는 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';

const ORANGE = '255, 150, 40', VENOM = '190, 90, 255', SONIC = '120, 230, 255', BLADE = '200, 180, 255', SEA = '60, 150, 255', GOLD = '255, 210, 90';

// ---- D-120 (2026-11-11 피드백) ----
// 삼두 포효: 스킬 설명(사자 포효 기절 → 독수리 돌풍 밀침 → 뱀 독)이 화면에서 세 박자로 보이게 — 박자마다 이름 + 그 머리다운 그림
const mouthOf = () => monster.getSocketPoint?.('mouth', 'head') || monster.getMuzzlePoint() || null;
const ROAR_WAVE = fxOf(spr('roar_triple', 380, { anchorX: 0.05, dur: 0.6, glow: 1.2 }),
    ...[0, 0.1, 0.2].map(at => ({ type: 'ring', at, dur: 0.45, r: 120, width: 6, color: ORANGE })));   // 사자: 입에서 주황 음파 + 퍼지는 고리
const STUN_HIT = fxOf({ type: 'starburst', at: 0, dur: 0.32, r: 34, points: 5, inner: 0.45, color: '255, 215, 90', outline: '24, 14, 8', width: 3 },
    { type: 'sparks', at: 0, count: 8, speed: 180, color: '255, 225, 120' });                               // 기절: 노란 별
const GUST_FEATHERS = fly => fxOf(spr('feather_black', 210, { dur: fly, frameRange: [1, 3], loopSec: 0.24, travel: true, angleOffset: 0, alpha: 0.9, glow: 0.6 }),
    { type: 'streaks', at: 0, count: 18, speed: 980, angle: 0, cone: 0.35, len: 70, life: [0.3, 0.5], color: '235, 245, 255' });   // 독수리: 깃털과 바람 줄기가 휩쓸고 감
const GUST_DUST = fxOf({ type: 'dust', at: 0, count: 6, speed: 260, dir: 'right', size: 18, life: 0.7, color: '200, 190, 170' });
function roarPhase(b, ctx, s) {
    const m = mouthOf() || { x: b.monsterX + 120, bottom: 150 };
    b.fx.play(ROAR_WAVE, m.x, m.bottom);
    b.director.shake(6, 350);
    b.createDamagePopup(b.monsterX + 30, 250, '사자 포효!', false);
}
roarPhase.preview = api => { const [x, y] = api.socket('mouth', 'head'); api.vfx.play(ROAR_WAVE, x, y, { scale: api.VFX_SCALE }); };
function gustPhase(b, ctx, s) {
    const x0 = b.frontX() - 20, fly = 0.45;
    b.fx.play(GUST_FEATHERS(fly), x0, 120, { to: [x0 + 420, 110] });
    b.enemiesInRange(320).forEach(e => b.fx.play(GUST_DUST, aimAt(e).x, FOOT_B));
    b.createDamagePopup(b.monsterX + 30, 250, '독수리 돌풍!', false);
}
gustPhase.preview = api => { const x0 = api.CHAR_X + 60; api.vfx.play(GUST_FEATHERS(0.45), x0, api.enemyChestY(), { scale: api.VFX_SCALE, to: [x0 + 520, api.enemyChestY()] }); };
// 뱀: 뱀 머리가 적마다 독 덩이를 뱉음 → 맞는 순간 독 (예전엔 적 자리 산성 터짐만)
function venomSpit(b, ctx, s) {
    const m = mouthOf() || { x: b.monsterX + 120, bottom: 150 };
    b.createDamagePopup(b.monsterX + 30, 250, '뱀 독!', false);
    b.enemiesInRange(s.range).forEach((e, i) => b.schedule(i * 0.06, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        b.fx.launchOrb(m, () => aimAt(e), '150, 255, 80', 0.32, () => {
            if (!b.enemies.includes(e)) return;
            b.fx.play(V.acid(60, 90), aimAt(e).x, aimAt(e).b);
            kitHit(b, e, s.dmg, s);
        }, i ? null : 'kaiju_spore', { core: true });
    }));
}
venomSpit.preview = api => api.dummies.forEach((d, i) => api.later(i * 0.06, () => api.vfx.launchOrb({ from: api.socket('mouth', 'head'),
    to: () => [d.x, api.enemyChestY()], color: '150, 255, 80', dur: 0.32, scale: api.VFX_SCALE, core: true, onArrive: () => api.hit(i) })));

// 박쥐 떼: 앞쪽 구역 위를 박쥐 7마리가 날아다니며 적에게 차례로 내리꽂힘 (예전엔 박쥐 없이 어두운 터짐만)
function batSwarm(b, ctx, s) {
    const x0 = () => b.monsterX + 5;
    const w = s.w || 340;
    b.fx.play(fxOf({ type: 'batSwarm', at: 0, dur: s.sec, n: 7, w, color: SONIC,
        targets: () => b.enemies.filter(e => !e.isBuilding && aimAt(e).x >= x0() && aimAt(e).x <= x0() + w).slice(0, 4)
            .map(e => [aimAt(e).x - x0(), aimAt(e).b - FOOT_B]) }), x0(), FOOT_B, { follow: () => [x0(), FOOT_B] });
}
batSwarm.preview = (api, scale) => {
    const x0 = api.CHAR_X, k = scale * 0.56;
    api.vfx.play(fxOf({ type: 'batSwarm', at: 0, dur: 3.5, n: 7, w: 340 * 0.56, color: SONIC,
        targets: () => api.dummies.map(d => [d.x - x0, (api.GROUND_Y - api.enemyChestY()) ])}), x0, api.GROUND_Y, { scale });
    void k;
};
// 독침 연사: 앞발 독침 끝에서 보라 독침이 날아가 꽂힘 (예전엔 탄 없이 맞은 자리만)
const STINGER_SHOT = { speed: 1300, fly: fxOf(spr('needle_crimson', 95, { frameRange: [1, 1], hue: -70, travel: true, anchorX: 0.6, glow: 1.3 })),
    flash: fxOf(spr('needle_crimson', 46, { dur: 0.12, frameRange: [2, 3], hue: -70, glow: 1.2 })) };
const SPIDERLING = { art: 'spiderling', scale: 1.3, spread: 34 };   // 새끼 거미 그림 (tools/rig/make_spiderling.py, 예전엔 슬라임을 보라로 물들임)

// 사냥의 광란: sec초 동안 every초마다 체력 낮은 적을 물어뜯음, 쓰러뜨리면 체력 회복
function frenzy(b, ctx, s) {
    const n = Math.round(s.sec / s.every);
    for (let i = 0; i < n; i++) {
        b.schedule(i * s.every, () => {
            if (!b.isActive) return;
            const t = pickTargets(b, 'lowest', 1, b.playerRange + 400)[0];
            if (!t) return;
            b.fx.play(V.sheet('shark_bite', 150, { dur: 0.4 }), aimAt(t).x, aimAt(t).b);
            kitHit(b, t, s.dmg, { knock: 0.8 });
            if (!b.enemies.includes(t)) b.kitHeal(b.maxPlayerHp * s.heal);
        });
    }
}

// 포위 섬멸: 졸개가 모두 가장 강한 적 앞으로 + 3초 졸개 피해 2배 + 내 강타
function encircle(b, ctx, s) {
    const t = pickTargets(b, 'strongest', 1, b.playerRange + 300)[0];
    if (!t) return;
    b.allies.forEach((a, i) => {
        a.x = Math.min(a.x + 200, t.x - 40 - (i % 3) * 18);
        if (a.dom) a.dom.style.left = `${a.x}px`;
    });
    b.addKitBuff('encircle', 3, { allyDmg: 1 });
    b.fx.play(V.impact(20, 170), aimAt(t).x, FOOT_B);
    kitHit(b, t, s.dmg, { knock: 1, stop: true });
}

// 진화 순환: 무작위 진화 n개 (공격 / 받는 피해 / 이동 / 회복)
// ---- D-126 (2026-11-14 저녁): 태초의 키메라 ----
// 만수 행진: 예전엔 다섯 동물 모두 같은 사자 그림(spirit_charge)을 색만 바꿔 0.1초마다 찍음 → 동물마다 제 그림 하나가 판정과 함께 달림 (wave ride)
//   사자 spirit_charge(1~4칸) · 독수리·곰·뱀·늑대 spirit_set(Gemini 영혼 동물) + 빛 꼬리·흙먼지, 끝에서 금빛으로 흩어짐(spirit_charge 5~7칸)
const BEAST = (frame, size, o = {}) => fxOf(
    spr('spirit_set', size, { dur: 30, frameRange: [frame, frame], glow: 1.3, fadeIn: 0.1, hue: o.hue || 0, angle: o.angle || 0, dy: o.dy || 0 }),
    { type: 'motes', at: 0, count: 14, spread: size * 0.3, rise: [10, 40], life: [0.3, 0.6], size: 2.6, color: o.color || '255, 235, 180' });
const LION = fxOf(spr('spirit_charge', 220, { dur: 30, frameRange: [1, 4], loopSec: 0.36, glow: 1.2, fadeIn: 0.1 }));
const BEAST_END = hue => fxOf(spr('spirit_charge', 200, { dur: 0.6, frameRange: [5, 7], hue, glow: 1.1 }));
const BEAST_DUST = fxOf({ type: 'dust', at: 0, dy: 62, count: 3, speed: 90, dir: 'left', size: 18, life: [0.4, 0.7], color: '170, 150, 120' });   // 발밑 흙먼지 (판정 높이 b에서 내려 바닥에)
const MARCH = {
    lion: { ride: LION, rideEnd: BEAST_END(0), vfx: BEAST_DUST },
    eagle: { ride: BEAST(0, 230, { angle: -0.55, color: '180, 240, 255', hue: 0 }), rideEnd: BEAST_END(180) },
    bear: { ride: BEAST(1, 260, { dy: -20, color: '255, 200, 160' }), rideEnd: BEAST_END(-30), vfx: BEAST_DUST },
    snake: { ride: BEAST(2, 220, { dy: -10, color: '220, 180, 255' }), rideEnd: BEAST_END(230) },
    wolf: { ride: BEAST(3, 230, { dy: -10, color: '200, 255, 200' }), rideEnd: BEAST_END(140), vfx: BEAST_DUST }
};

// 영혼 독수리: 예전엔 금빛 터짐(golden_burst)만 → 하늘 왼쪽 위에서 영혼 독수리(spirit_set 0칸)가 비스듬히 내리꽂힌 뒤 금빛 충격 + 깃털 같은 불티
const EAGLE_DIR = 0.72;   // spirit_set 0칸 독수리가 내리꽂는 방향 (아래 오른쪽, 라디안)
const EAGLE_FALL = fly => fxOf(spr('spirit_set', 210, { dur: fly, frameRange: [0, 0], travel: true, angleOffset: -EAGLE_DIR, glow: 1.4 }),
    { type: 'motes', at: 0, count: 10, spread: 40, rise: [10, 40], life: [0.3, 0.5], size: 2.4, color: '255, 240, 200' });
const EAGLE_HIT = fxOf(spr('golden_burst', 190, { dur: 0.45, glow: 1.2 }),
    { type: 'shockwave', at: 0, dur: 0.4, r: 110, width: 9, ground: true, color: GOLD },
    { type: 'sparks', at: 0, count: 12, speed: 320, angle: -Math.PI / 2, cone: 2.4, color: '255, 240, 200' },
    { type: 'dust', at: 0.03, count: 5, speed: 200, size: 20, life: [0.5, 0.8], color: '170, 150, 120' });

const EVOLVE = [
    { key: 'evoAtk', mods: { dmg: 0.5 }, label: '진화: 공격 +50%' },
    { key: 'evoDef', mods: { def: 0.5 }, label: '진화: 받는 피해 -50%' },
    { key: 'evoMove', mods: { move: 0.5 }, label: '진화: 이동 +50%' },
    { key: 'evoRegen', mods: { regen: 0.03 }, label: '진화: 초당 3% 회복' }
];
function evolve(b, ctx, s) {
    const pool = [...EVOLVE].sort(() => Math.random() - 0.5).slice(0, Math.round(s.n));
    pool.forEach((e, i) => {
        b.addKitBuff(e.key, s.sec, e.mods);
        b.createDamagePopup(b.monsterX + 40, 220 + i * 24, e.label, false);
    });
    b.fx.play(V.aura(30, 230), b.monsterX + 35, FOOT_B, { follow: () => [b.monsterX + 35, FOOT_B] });
}

// 졸개 소환 (기존 합성괴인 졸개)
function minions(b, ctx, s) {
    for (let i = 0; i < Math.round(s.n); i++) b.schedule(i * 0.15, () => { if (b.isActive) b.spawnAllyMinion(b.monsterX + 60 + i * 45, 'chimera'); });
}

export const CHIMERA_SETS2 = packOf('chimera', [
    // ---- 유니크 ① 완전체 키메라 (Q-008 3-2) — 사자·독수리·뱀을 합친 조직의 최고 걸작 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '완전체 키메라', style: 'balance', tint: 'sepia(0.4) saturate(1.8) hue-rotate(-5deg) brightness(1.1)',
        bonus: { 2: '독이 쌓인 적이 쓰러지면 주변 적에게 독이 튐', 4: '체력 40% 아래에서 판마다 한 번 완전체 각성 — 삼두 포효 바로 + 6초 받는 피해 -50%' },
        kit: {
            2: { on: [{ when: 'kill', status: 'poison', fn: (b, info) => {
                const x = aimAt(info.enemy).x;
                enemiesNear(b, x, 120, true).forEach(e => b.kitStatus(e, { poison: [4, 0.15] }));
                b.fx.play(V.acid(40, 110), x, aimAt(info.enemy).b);
            } }] },
            4: { on: [{ when: 'lowHp', below: 0.4, once: 'perfect', label: '완전체 각성!', buff: { key: 'perfect', sec: 6, mods: { def: 0.5 } }, step: { do: 'custom', fn: (b) => b.useSkillFree?.('head') } }] }
        },
        head: { name: '삼두 키메라 머리', look: '사자 머리 + 어깨 위 독수리·뱀 머리', skill: 'cmTripleRoar', desc: '필살기 삼두 포효: 사자 포효(1.5초 기절) → 독수리 돌풍(밀쳐냄) → 뱀 독(4초)', stats: { hp: 800, dps: 100, range: 20, speed: 10 } },
        body: { name: '합성 날개 몸통', look: '등에 박쥐 날개 + 독수리 깃', skill: 'cmSoarDive', desc: '비상 강하: 날아올라(1초 무적) 앞쪽에 내리꽂힘 — 넓은 범위 + 밀쳐냄', stats: { hp: 1900, dps: 90, range: 0, speed: 10 } },
        arm: { name: '뱀 머리 팔', look: '팔 끝이 커다란 뱀 머리', skill: 'cmViperFlurry', desc: '기본 공격 독니 (독) · 독사 연타: 5번 물기, 마지막에 1초 기절', stats: { hp: 500, dps: 480, range: 220, speed: 0 },
            kitAttack: { kind: 'melee', vfx: V.bite(70, 120), splash: 70, splashMul: 0.4, status: { poison: [4, 0.15] } } },
        leg: { name: '키메라 뒷다리', look: '사자 다리 + 독수리 발톱', desc: '적응 진화: 같은 종류 피해(근접·원거리·장판)를 3번 받으면 그 종류 피해 -30%', stats: { hp: 900, dps: 90, range: 0, speed: 110 },
            passive: { name: '적응 진화', desc: '같은 종류 피해를 3번 받으면 그 종류 피해 -30%', adapt: { n: 3, cut: 0.3 } } },
        skills: {
            cmTripleRoar: { name: '삼두 포효', slot: 'head', ult: true, cd: 0, icon: 'roar', color: '#ff9628', target: 'enemy', range: 320, clip: 'summon', sfx: 'rampage_roar',
                desc: '세 머리가 차례로 — 사자 포효(앞쪽 1.5초 기절) → 독수리 돌풍(밀쳐냄) → 뱀 독(4초 지속 피해)',
                // D-120: 세 박자가 이름과 함께 보이게 — 사자(입에서 주황 음파·고리 → 적마다 기절 별) → 독수리(깃털·바람 줄기가 휩쓸고 흙먼지)
                //   → 뱀(입에서 적마다 독 덩이를 뱉어 맞는 순간 독). 피해·기절·밀침·독 수치는 그대로
                steps: [{ at: 0.25, do: 'custom', fn: roarPhase, preview: roarPhase.preview },
                    { at: 0.3, do: 'hit', pick: 'all', range: 320, dmg: 1, status: { stun: 1.5 }, vfx: STUN_HIT },
                    { at: 0.85, do: 'custom', fn: gustPhase, preview: gustPhase.preview },
                    { at: 0.95, do: 'push', range: 320, dist: 120, dmg: 0.6 },
                    { at: 1.45, do: 'custom', fn: venomSpit, range: 360, dmg: 0.4, status: { poison: [4, 0.3] }, preview: venomSpit.preview }] },
            cmSoarDive: { name: '비상 강하', slot: 'body', cd: 14, icon: 'wave', color: '#ff9628', target: 'enemy', range: 240, clip: 'soar',
                desc: '날아올라(공중 동안 피해 안 받음) 1초 뒤 앞쪽에 내리꽂힘 — 넓은 범위 피해 + 밀쳐냄',
                steps: [{ do: 'buff', key: 'soar', sec: 1.1, mods: { flags: ['invuln'] } },
                    { at: 1.0, do: 'blink', dist: 110 },
                    { at: 1.05, do: 'hit', pick: 'all', range: 240, dmg: 2.4, knock: 1.4, vfx: V.impact(20, 220), ground: true },
                    { at: 1.05, do: 'fx', x: 60, vfx: V.ring(ORANGE, 170) }, { at: 1.05, do: 'shake', power: 8, ms: 300 }] },
            cmViperFlurry: { name: '독사 연타', slot: 'arm', cd: 9, icon: 'claw', color: '#be5aff', target: 'enemy', range: 60, clip: 'slashes',
                desc: '뱀 머리로 5번 빠르게 물기 — 독이 쌓이고 마지막에 1초 기절',
                steps: [{ at: 0.1, do: 'hit', times: 5, every: 0.12, dmg: 0.7, status: { poison: [4, 0.15] }, vfx: V.bite(70, 120) },
                    { at: 0.7, do: 'hit', dmg: 0, status: { stun: 1 } }] }
        }
    },

    // ---- 레어 ③ 거미 실험체 (사거리) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '거미 실험체', style: 'range', tint: 'hue-rotate(-40deg) saturate(1.3) brightness(0.8)',
        bonus: { 4: '거미줄에 걸린 적이 쓰러지면 새끼 거미 1기 (최대 4)' },
        kit: { 4: { on: [{ when: 'kill', inZone: 'web', summon: { ...SPIDERLING, hp: 0.05, dps: 0.12, life: 8, hit: { poison: [3, 0.1] }, color: '#be5aff' } }] } },
        head: { name: '복안 거미 머리', look: '얼굴 가득 빛나는 보라 겹눈', skill: 'cmWebTrap', desc: '필살기 거미줄 덫: 앞쪽 6초 거미줄 — 느려지고 받는 피해 +20%' },
        body: { name: '거미 다리 몸통', look: '등에서 솟은 마디 거미 다리 넷', skill: 'cmSpiderlings', desc: '새끼 거미 떼: 새끼 거미 4기 (8초, 독)' },
        arm: { name: '독침 앞발', look: '보라 독이 맺힌 긴 독침', skill: 'cmStingers', desc: '독침 연사: 독침 5발 — 4초 독' },
        leg: { name: '거미 다리', look: '검붉은 키틴 다리', desc: '벽 타기: 밀려나지 않음, 장판 감속 무시',
            passive: { name: '벽 타기', desc: '밀려나지 않음, 장판(늪·독 구름·오물) 감속 무시', flags: ['knockImmune', 'ignoreHazard'] } },
        skills: {
            cmWebTrap: { name: '거미줄 덫', slot: 'head', ult: true, cd: 0, icon: 'net', color: '#be5aff', target: 'enemy', range: 420, clip: 'summon',
                desc: '앞쪽 전체에 거미줄 6초 — 걸린 적은 느려지고 받는 피해 +20%',
                steps: [{ at: 0.3, do: 'zone', tag: 'web', field: 'web', x: 10, w: 430, sec: 6, slow: true, vuln: 0.2, dps: 0.1 }] },
            cmSpiderlings: { name: '새끼 거미 떼', slot: 'body', cd: 14, icon: 'minions', color: '#be5aff', target: 'self', clip: 'flex', cast: true,
                desc: '새끼 거미 4기 (8초) — 적에 달라붙어 독',
                steps: [{ do: 'summon', n: 4, ...SPIDERLING, hp: 0.05, dps: 0.12, speed: 0.9, life: 8, hit: { poison: [3, 0.1] }, color: '#be5aff', label: '새끼 거미!' }] },
            cmStingers: { name: '독침 연사', slot: 'arm', cd: 8, icon: 'injector', color: '#be5aff', target: 'enemy', range: 160, clip: 'spray',
                desc: '독침 5발 — 맞은 적 4초 독',
                steps: [{ at: 0.15, do: 'hit', pick: 'random', n: 1, times: 5, every: 0.1, dmg: 0.6, status: { poison: [4, 0.2] }, shot: STINGER_SHOT,
                    vfx: V.needle(-70, 70, { dur: 0.22, frameRange: [2, 4] }) }] }
        }
    },

    // ---- 레어 ④ 박쥐 음파 연구체 (균형) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '박쥐 음파 연구체', style: 'balance', tint: 'saturate(0.5) brightness(0.95) hue-rotate(160deg)',
        bonus: { 4: '박쥐 떼 회복 2배' },
        kit: { 4: { patch: { cmBats: { heal: 0.012 } } } },
        head: { name: '거대 귀 박쥐 머리', look: '거대한 박쥐 귀와 납작한 코', skill: 'cmUltrasonic', desc: '필살기 초음파 폭풍: 6초간 음파 고리 — 피해 + 적 공격 -40%' },
        body: { name: '날개막 몸통', look: '커진 회색 날개막, 어깨 음파 장치', skill: 'cmBats', desc: '박쥐 떼: 8초간 앞 적을 쪼아 피해 + 내 회복' },
        arm: { name: '음파 발톱', look: '팔에 작은 스피커 창살, 긴 발톱', skill: 'cmSonicClaw', desc: '음파 할퀴기: 음파 칼날 3줄 관통' },
        leg: { name: '박쥐 발 다리', look: '발톱 달린 박쥐 발', desc: '반향 감지: 원거리 공격 적(사수·마법사 등)에게 피해 +25%',
            passive: { name: '반향 감지', desc: '원거리·치유 적에게 주는 피해 +25%', target: [{ when: 'ranged', dmg: 0.25 }] } },
        skills: {
            cmUltrasonic: { name: '초음파 폭풍', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#78e6ff', target: 'enemy', range: 500, clip: 'summon',
                desc: '6초간 음파 고리가 연달아 — 피해 + 적 공격 -40% (약화)',
                steps: [{ at: 0.2, do: 'wave', from: 0, speed: 620, dist: 520, w: 55, dmg: 0.8, status: { weak: [3, 0.4] }, vfx: V.sheet('sonic_ring', 170, { dur: 0.4 }), vfxEvery: 0.09, b: 120, repeat: 6, repeatGap: 1 }] },
            cmBats: { name: '박쥐 떼', slot: 'body', cd: 14, icon: 'minions', color: '#78e6ff', target: 'self', clip: 'summon', p: { heal: 0.006 },
                desc: '8초간 박쥐 무리가 앞 적을 쪼아 피해 + 내 체력 회복',
                steps: [{ at: 0.2, do: 'zone', follow: true, x: -30, w: 340, sec: 8, dps: 0.45, heal: '$heal' },
                    { at: 0.2, do: 'custom', fn: batSwarm, sec: 8, w: 340, preview: batSwarm.preview }] },
            cmSonicClaw: { name: '음파 할퀴기', slot: 'arm', cd: 8, icon: 'claw', color: '#78e6ff', target: 'enemy', range: 200, clip: 'smash',
                desc: '음파 칼날 3줄이 앞으로 — 관통',
                steps: [{ at: 0.35, do: 'wave', from: -20, speed: 720, dist: 340, w: 40, dmg: 1.0, vfx: V.sheet('sonic_ring', 120, { dur: 0.3 }), vfxEvery: 0.06, b: 110, repeat: 3, repeatGap: 0.12 }] }
        }
    },

    // ---- 유니크 ② 사마귀 칼날 괴인 (공격) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '사마귀 칼날 괴인', style: 'dps', tint: 'hue-rotate(220deg) saturate(0.8) brightness(1.15)',
        bonus: { 2: '회전 낫 2개', 4: '천 갈래 참격 동안 쓰러진 적마다 필살기 게이지 +4%' },
        kit: { 2: { patch: { cmSickle: { count: 1 } } }, 4: { on: [{ when: 'kill', flag: 'mantisUlt', gauge: 0.04 }] } },
        head: { name: '사마귀 겹눈 머리', look: '은보라 큰 겹눈과 큰 턱', skill: 'cmThousandCuts', desc: '필살기 천 갈래 참격: 1.5초 동안 앞쪽을 수십 번 벰 (방어 무시)' },
        body: { name: '키틴 날개 몸통', look: '등에 겹겹 보라 키틴 날개', skill: 'cmAfterimage', desc: '잔상 이동: 앞으로 순간 이동하며 베기 + 2초 회피 50%' },
        arm: { name: '낫 칼날 팔', look: '주먹 대신 커다란 은빛 낫', skill: 'cmSickle', desc: '회전 낫: 부메랑처럼 갔다 돌아옴 — 갈 때·올 때 피해' },
        leg: { name: '도약 다리', look: '보라 키틴 다리', desc: '사냥 도약: 스킬을 쓴 뒤 다음 기본 공격 2배',
            passive: { name: '사냥 도약', desc: '스킬을 쓴 뒤 다음 기본 공격 피해 2배', nextMul: 2 } },
        skills: {
            cmThousandCuts: { name: '천 갈래 참격', slot: 'head', ult: true, cd: 0, icon: 'whirl', color: '#c8b4ff', target: 'enemy', range: 300, clip: 'slashes',
                desc: '1.5초 동안 앞쪽을 수십 번 벰 — 방어 무시',
                steps: [{ do: 'buff', key: 'mantisUlt', sec: 1.8, mods: { flags: ['mantisUlt'] } },
                    { at: 0.1, do: 'hit', pick: 'all', range: 300, times: 15, every: 0.1, dmg: 0.35, pierce: 1, knock: 0.2, vfx: V.sheet('blade_flurry', 140, { dur: 0.35 }) }] },
            cmAfterimage: { name: '잔상 이동', slot: 'body', cd: 13, icon: 'clone', color: '#c8b4ff', target: 'enemy', range: 160, clip: 'lunge',
                desc: '앞으로 순간 이동하며 지나간 적 베기 + 2초 회피 50%',
                steps: [{ at: 0.1, do: 'blink', dist: 170, dmg: 1.5, vfx: V.slash(180, 160) }, { at: 0.1, do: 'buff', key: 'afterimage', sec: 2, mods: { dodge: 0.5 } }] },
            cmSickle: { name: '회전 낫', slot: 'arm', cd: 9, icon: 'scissors', color: '#c8b4ff', target: 'enemy', range: 260, clip: 'smash', p: { count: 1 },
                desc: '낫을 부메랑처럼 던짐 — 갈 때·올 때 피해',
                steps: [{ at: 0.4, do: 'wave', from: 0, speed: 520, dist: 300, w: 45, dmg: 1.3, back: true, vfx: V.slash(180, 110, { dur: 0.25 }), vfxEvery: 0.05, b: 110, repeat: '$count', repeatGap: 0.25 }] }
        }
    },

    // ---- 유니크 ③ 심해 상어 괴인 (속도) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '심해 상어 괴인', style: 'speed', tint: 'hue-rotate(185deg) saturate(1.2) brightness(0.9)',
        bonus: { 2: '잠항 동안 초당 3% 회복', 4: '사냥의 광란 +3초' },
        kit: { 2: { patch: { cmSubmerge: { regen: 0.03 } } }, 4: { patch: { cmFrenzy: { sec: 3 } } } },
        head: { name: '상어 머리', look: '하얀 이빨 줄의 상어 머리', skill: 'cmFrenzy', desc: '필살기 사냥의 광란: 8초간 체력 낮은 적부터 물어뜯음 (쓰러뜨리면 체력 3%)' },
        body: { name: '지느러미 몸통', look: '등에 솟은 큰 상어 등지느러미', skill: 'cmSubmerge', desc: '잠항: 3초 땅속(피해 무시) → 솟구쳐 1.5초 기절' },
        arm: { name: '톱니 이빨 팔', look: '상어 이빨 톱니 건틀릿', skill: 'cmSawBite', desc: '톱니 물기: 3번 물기 — 5초 방어 -30%' },
        leg: { name: '꼬리 지느러미 다리', look: '지느러미 달린 다리', desc: '사냥 감각: 체력 50% 아래 적에게 피해 +20%',
            passive: { name: '사냥 감각', desc: '체력 50% 아래 적에게 주는 피해 +20%', target: [{ when: 'lowHp', below: 0.5, dmg: 0.2 }] } },
        skills: {
            cmFrenzy: { name: '사냥의 광란', slot: 'head', ult: true, cd: 0, icon: 'maul', color: '#3c96ff', target: 'enemy', range: 400, clip: 'lunge', p: { sec: 8 },
                desc: '8초간 체력 낮은 적부터 차례로 물어뜯음 — 쓰러뜨리면 체력 3% 회복',
                steps: [{ do: 'custom', fn: frenzy, sec: '$sec', every: 0.5, dmg: 3, heal: 0.03 }, { do: 'buff', key: 'frenzy', sec: '$sec', mods: { move: 0.2 } }] },
            cmSubmerge: { name: '잠항', slot: 'body', cd: 14, icon: 'wave', color: '#3c96ff', target: 'self', clip: 'flex', p: { regen: 0 },
                desc: '3초간 땅속으로(피해 무시) → 앞 적 아래에서 솟구쳐 1.5초 기절',
                steps: [{ do: 'buff', key: 'submerge', sec: 3, mods: { flags: ['invuln'], regen: '$regen' }, vfx: V.water(0, 160, { anchorY: 0.85 }) },
                    { at: 3, do: 'hit', pick: 'nearest', n: 3, range: 220, dmg: 2, status: { stun: 1.5 }, vfx: V.sheet('shark_bite', 170, { dur: 0.45 }) }] },
            cmSawBite: { name: '톱니 물기', slot: 'arm', cd: 8, icon: 'claw', color: '#3c96ff', target: 'enemy', range: 50, clip: 'smash',
                desc: '앞 적을 3번 물기 — 5초 방어 -30%',
                steps: [{ at: 0.35, do: 'hit', times: 3, every: 0.15, dmg: 1, status: { vuln: [5, 0.3] }, vfx: V.sheet('shark_bite', 120, { dur: 0.35 }) }] }
        }
    },

    // ---- 레전더리 ① 키메라 군단 총수 (졸개) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '키메라 군단 총수', style: 'support', tint: 'sepia(0.7) saturate(2.2) hue-rotate(-12deg) brightness(1.1) drop-shadow(0 0 7px rgba(255, 210, 90, 0.8))',
        bonus: { 2: '최종 병기 +6초', 4: '전군 강화 졸개 +2' },
        kit: { 2: { patch: { cmFinalWeapon: { life: 6 } } }, 4: { patch: { cmRally: { n: 2 } } } },
        head: { name: '총수의 왕관 투구', look: '붉은 깃 장식의 금빛 지휘관 왕관 투구', skill: 'cmFinalWeapon', desc: '필살기 최종 병기 투입: 거대 키메라 병기 1기 12초 (범위 공격)' },
        body: { name: '사령 장갑', look: '금빛 장갑과 붉은 망토', skill: 'cmRally', desc: '전군 강화: 졸개 2기 + 8초 졸개 피해·공격 +60%' },
        arm: { name: '지휘 건틀릿', look: '무거운 금빛 지휘 건틀릿', skill: 'cmEncircle', desc: '기본 공격 지휘 강타 (맞은 적 3초 받는 피해 +25%) · 포위 섬멸: 졸개가 강한 적에게 몰려듦',
            kitAttack: { kind: 'melee', vfx: V.punch(-170, 130), splash: 80, splashMul: 0.4, status: { vuln: [3, 0.25] } } },
        leg: { name: '총수의 군화', look: '금빛 정강이 갑옷', desc: '군단 보급: 졸개가 쓰러지면 3초 뒤 새 졸개 (판마다 6번)',
            passive: { name: '군단 보급', desc: '졸개·소환물이 쓰러지면 3초 뒤 새 졸개 (판마다 6번)',
                on: [{ when: 'allyDown', max: 6, delay: 3, step: { do: 'custom', fn: minions, n: 1 } }] } },
        skills: {
            cmFinalWeapon: { name: '최종 병기 투입', slot: 'head', ult: true, cd: 0, icon: 'rampage', color: '#ffd25a', target: 'self', clip: 'summon', p: { life: 12 },
                desc: '거대 키메라 병기 1기 투입 (12초, 앞으로 나가 범위 공격)',
                steps: [{ at: 0.3, do: 'fx', x: -20, vfx: V.portal(0, 260) },
                    { at: 0.5, do: 'summon', n: 1, x: 90, art: 'guardian', scale: 0.85, filter: 'sepia(0.6) saturate(2.4) hue-rotate(-20deg) brightness(1.05)', hp: 0.6, dps: 1.2, speed: 0.5, life: '$life', color: '#ffd25a', label: '최종 병기 투입!', blast: { dmg: 3, radius: 160 } }] },
            cmRally: { name: '전군 강화', slot: 'body', cd: 15, icon: 'horn', color: '#ffd25a', target: 'self', clip: 'flex', cast: true, p: { n: 2 },
                desc: '졸개 2기를 부르고 8초간 졸개 피해 +60%',
                steps: [{ do: 'custom', fn: minions, n: '$n' }, { do: 'buff', key: 'rally', sec: 8, mods: { allyDmg: 0.6 }, vfx: V.gold(0, 200) }] },
            cmEncircle: { name: '포위 섬멸', slot: 'arm', cd: 9, icon: 'minions', color: '#ffd25a', target: 'enemy', range: 300, clip: 'smash',
                desc: '졸개 모두가 가장 강한 적에게 몰려들고(3초 졸개 피해 2배) 내가 강타',
                steps: [{ at: 0.4, do: 'custom', fn: encircle, dmg: 2.5 }] }
        }
    },

    // ---- 레전더리 ② 만수의 왕 (균형) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '만수의 왕', style: 'balance', tint: 'sepia(0.5) saturate(1.6) brightness(1.3) drop-shadow(0 0 8px rgba(255, 240, 200, 0.9))',
        bonus: { 2: '진화 순환이 2개 동시', 4: '만수 행진 5 → 7마리' },
        kit: { 2: { patch: { cmEvolve: { n: 1 } } }, 4: { patch: { cmBeastMarch: { extra: 1 } } } },
        head: { name: '만수 왕관', look: '여러 짐승 뿔로 엮은 왕관, 흰빛 눈', skill: 'cmBeastMarch', desc: '필살기 만수 행진: 동물 영혼 5마리가 차례로 돌진 (기절·밀침·큰 피해·독·감속)' },
        body: { name: '진화 심장 몸통', look: '흰 깃과 금빛 막이 섞인 빛나는 날개', skill: 'cmEvolve', desc: '진화 순환: 10초간 무작위 진화 (공격·받는 피해·이동·회복 중 하나)' },
        arm: { name: '변이 발톱', look: '금빛 문양이 빛나는 거대한 짐승 팔', skill: 'cmSpiritEagles', desc: '기본 공격 변이 발톱 (화상·독·감속·짧은 기절 중 하나) · 영혼 독수리 3마리',
            kitAttack: { kind: 'melee', vfx: V.claw(-30, 140), splash: 90, splashMul: 0.45, statusPick: [{ burn: [3, 0.2] }, { poison: [3, 0.2] }, { slow: 2 }, { stun: 0.4 }] } },
        leg: { name: '만수 다리', look: '흰 털 깃 달린 짐승 다리', desc: '적응 본능: 해로운 효과 시간 -50%',
            passive: { name: '적응 본능', desc: '감속·기절·속박 시간 -50%', mods: { ccCut: 0.5 } } },
        skills: {
            cmBeastMarch: { name: '만수 행진', slot: 'head', ult: true, cd: 0, icon: 'roar', color: '#fff0c8', target: 'enemy', range: 600, clip: 'summon', p: { extra: 0 },
                desc: '동물 영혼이 차례로 돌진 — 사자(기절) · 독수리(밀침) · 곰(큰 피해) · 뱀(독) · 늑대(감속)',
                steps: [
                    { at: 0.2, do: 'wave', from: -40, speed: 640, dist: 700, w: 60, dmg: 1, status: { stun: 1 }, ...MARCH.lion, vfxEvery: 0.15, b: FOOT_B + 70 },
                    { at: 0.7, do: 'wave', from: -40, speed: 700, dist: 700, w: 60, dmg: 0.8, push: 40, ...MARCH.eagle, b: FOOT_B + 130 },
                    { at: 1.2, do: 'wave', from: -40, speed: 560, dist: 700, w: 70, dmg: 2.6, ...MARCH.bear, vfxEvery: 0.15, b: FOOT_B + 80 },
                    { at: 1.7, do: 'wave', from: -40, speed: 640, dist: 700, w: 60, dmg: 0.8, status: { poison: [4, 0.3] }, ...MARCH.snake, b: FOOT_B + 55 },
                    { at: 2.2, do: 'wave', from: -40, speed: 680, dist: 700, w: 60, dmg: 0.8, status: { slow: 3 }, ...MARCH.wolf, vfxEvery: 0.15, b: FOOT_B + 65 },
                    { at: 2.7, do: 'wave', from: -40, speed: 640, dist: 700, w: 60, dmg: 1, status: { stun: 1 }, ...MARCH.lion, vfxEvery: 0.15, b: FOOT_B + 70, when: b => b.kitPatch?.cmBeastMarch?.extra > 0 },
                    { at: 3.2, do: 'wave', from: -40, speed: 700, dist: 700, w: 60, dmg: 0.8, push: 40, ...MARCH.eagle, b: FOOT_B + 130, when: b => b.kitPatch?.cmBeastMarch?.extra > 0 }] },
            cmEvolve: { name: '진화 순환', slot: 'body', cd: 15, icon: 'injector', color: '#fff0c8', target: 'self', clip: 'flex', cast: true, p: { n: 1 },
                desc: '10초간 무작위 진화 하나 — 공격 +50% / 받는 피해 -50% / 이동 +50% / 초당 3% 회복',
                steps: [{ do: 'custom', fn: evolve, n: '$n', sec: 10 }] },
            cmSpiritEagles: { name: '영혼 독수리', slot: 'arm', cd: 9, icon: 'wave', color: '#fff0c8', target: 'enemy', range: 260, clip: 'summon',
                desc: '영혼 독수리 3마리가 내리꽂힘 — 범위 피해 + 밀침',
                steps: [{ at: 0.3, do: 'rain', count: 3, every: 0.2, radius: 85, dmg: 1.8, knock: 1.2, vfx: EAGLE_HIT, fall: EAGLE_FALL(0.38), fallDx: -300, fallTo: 20, delay: 0.38, shake: 3 }] }
        }
    }
]);
