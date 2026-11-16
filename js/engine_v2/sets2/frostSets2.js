/* ==========================================================================
   PROJECT: MAD OVERLORD // 서리의 무희 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-7)
   레어 ① 설원 검무(a) · 레어 ② 눈보라 마녀(b) · 유니크 ① 얼음 여왕(u) · 레어 ③ 오로라 가희(c) · 레어 ④ 서리 늑대 사냥꾼(d)
   · 유니크 ② 빙하 거인 소환사(v) · 유니크 ③ 밤의 백조(w) · 레전더리 ① 영원한 겨울의 여제(l) · 레전더리 ② 달빛 검희(m)
   냉기·빙결은 battle/frost.js (status chill = 냉기 n, freeze = 빙결 초, 단계 값 shatter = 얼어 있으면 배수로 깨뜨림).
   새 캐릭터 세트는 강화 그림 + 세트 색 (common.js). 동작은 rig/frostRig.js (dashSlash·raise는 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { FS, ICE_PRISON, ICE_BREAK, ICE_SPROUT, ICE_HIT, SNOW_FALL, FROST_W } from '../vfx/iceFx.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';

const ICE = '150, 220, 255', SNOW = '230, 245, 255', AURORA = '140, 255, 200', WOLF = '200, 225, 240', GLACIER = '120, 220, 230', SWAN = '120, 100, 160', MOON = '220, 230, 255';
const ICY = 'hue-rotate(170deg) saturate(0.55) brightness(1.55) drop-shadow(0 0 6px rgba(150, 220, 255, 0.9))';
const isUnit = e => !e.isBuilding && !e.isBarricade;
const onScreen = b => b.enemies.filter(e => isUnit(e) && e.x - b.monsterX < 1000);

// 절대 영도: 화면 모든 적 빙결(보스는 냉기 3) → hold초 뒤 차례로 깨짐 (둘레에 연쇄 피해)
function absoluteZero(b, ctx, s) {
    const list = onScreen(b);
    b.fx.play(ZERO_WAVE, b.frontX() + 160, FOOT_B);
    list.forEach((e, i) => b.schedule(Math.max(0, aimAt(e).x - b.monsterX) / 1400, () => {   // 냉기 파도가 닿는 차례로 얼음 감옥 (D-137)
        if (!alive(b, e)) return;
        if (e.boss) b.applyChill?.(e, 3); else b.freezeEnemy?.(e, s.hold + 0.2);
        b.fx.play(ICE_PRISON(s.hold + 0.1), aimAt(e).x, FOOT_B, { follow: () => [aimAt(e).x, FOOT_B], alive: () => alive(b, e) });
    }));
    b.schedule(s.hold, () => list.forEach((e, i) => b.schedule(i * 0.12, () => {
        if (!b.enemies.includes(e)) return;
        const x = aimAt(e).x;
        b.fx.play(ICE_BREAK(190), x, FOOT_B);
        if (i === 0) b.director.shake(7, 300);
        kitHit(b, e, s.dmg, { shatter: 1.5, knock: 0.8 });
        enemiesNear(b, x, 90, true).filter(o => o !== e).forEach(o => kitHit(b, o, s.dmg * 0.35, { knock: 0.3, status: { chill: 1 } }));
    })));
}

// 늑대 무리 사냥: 얼음 늑대 n마리가 6초간 무작위 적을 물어뜯음 (냉기 2)
function wolfHunt(b, ctx, s) {
    const bites = Math.round(s.n) * 3;
    for (let i = 0; i < bites; i++) {
        b.schedule(0.2 + (i * s.sec) / bites, () => {
            if (!b.isActive) return;
            const t = pickTargets(b, 'random', 1, b.playerRange + 450)[0];
            if (!t) return;
            // 얼음늑대(전신)가 뒤에서 바닥을 달려와 → 덤벼 적을 물어뜯음 (D-137 보완: 예전엔 늑대 머리 그림만)
            const tx = aimAt(t).x, run0 = [tx - 330, FOOT_B + 42], run1 = [tx - 95, FOOT_B + 44];
            b.fx.play(WOLF_RUN(WOLF_T.run), ...run0, { to: run1 });
            b.schedule(WOLF_T.run, () => {
                if (!b.isActive) return;
                const c = alive(b, t) ? chestOf(t) : [tx, FOOT_B + 60];
                b.fx.play(WOLF_LEAP(WOLF_T.leap), ...run1, { to: [c[0] - 20, holdY(c)] });
            });
            b.schedule(WOLF_T.run + WOLF_T.leap, () => {
                if (!alive(b, t)) return;
                const c = chestOf(t);
                b.fx.play(WOLF_HOLD, c[0] - 20, holdY(c));
                b.fx.play(WOLF_BITE, ...c);
                kitHit(b, t, s.dmg, { knock: 0.5, status: { chill: 2 } });
            });
        });
    }
}

// 영겁의 겨울: sec초 — 모든 적 느려짐, gap초마다 냉기 파도(냉기 2, 파도가 닿는 차례로), 끝날 때 얼은 적 모두 깨짐
function eternalWinter(b, ctx, s) {
    for (let t = 0; t < s.sec; t += 1) b.schedule(t, () => { if (b.isActive) onScreen(b).forEach(e => b.kitStatus(e, { slow: 1.2 })); });
    for (let t = s.gap; t < s.sec; t += s.gap) {
        b.schedule(t, () => {
            if (!b.isActive) return;
            // 냉기 파도 (D-139): 예전엔 하늘 그림 + 바닥 고리가 한 번 번쩍 → 여제 앞에서 얼음 파도가 솟아 말리며 화면 끝까지 밀려가고,
            //   지나간 자리는 물보라·서리 결정, 파도가 닿는 차례로 적에게 냉기 2 + 얼음 튐
            const x0 = b.frontX() + 170, x1 = b.monsterX + 1150, sec = (x1 - x0) / WAVE_SPEED;
            playColdWave((fx, x, y, o) => b.fx.play(fx, x, y, o), (d, f) => b.schedule(d, () => { if (b.isActive) f(); }), x0, x1, FOOT_B, 1);
            b.director.shake(3, 220);
            b.schedule(sec * 0.5, () => b.director.shake(2, 160));
            onScreen(b).forEach(e => b.schedule(0.12 + Math.min(sec, Math.max(0, aimAt(e).x - x0) / WAVE_SPEED), () => {   // 파도는 0.12초 솟은 뒤 출발
                if (!alive(b, e)) return;
                b.kitStatus(e, { chill: 2 });
                b.fx.play(WAVE_HIT, ...chestOf(e));
            }));
        });
    }
    b.schedule(s.sec, () => {
        if (!b.isActive) return;
        b.enemies.filter(e => e.frozenT > 0).forEach((e, i) => b.schedule(i * 0.08, () => {
            if (!b.enemies.includes(e)) return;
            b.fx.play(ICE_BREAK(190), aimAt(e).x, FOOT_B);
            kitHit(b, e, s.dmg, { shatter: 2, knock: 0.8 });
        }));
    });
}

// 냉기 파도 (영겁의 겨울, D-139): 얼음빛 파도 시트 frost_wave (tidal_wave를 얼음 색으로, 0 솟음 · 2~4 말림 · 5~8 부서짐·물보라)
const WAVE_SPEED = 820;
const WAVE_RISE = fxOf(spr('frost_wave', 280, { frameRange: [0, 2], dur: 0.3, anchorY: 0.86 }),
    { type: 'flash', at: 0, dur: 0.25, r: 120, color: FROST_W, dy: -60 },
    { type: 'shockwave', at: 0, dur: 0.5, r: 220, width: 10, ground: true, color: SNOW });
const WAVE_RIDE = sec => fxOf(spr('frost_wave', 320, { dur: sec, frameRange: [2, 3], loopSec: 0.45, pingPong: true, anchorY: 0.86, travel: true, glow: 0.5, fadeOut: 0.2 }),
    spr('frost_wave', 250, { dur: sec, frameRange: [1, 3], loopSec: 0.5, pingPong: true, phase: 0.2, anchorY: 0.86, travel: true, alpha: 0.55, dx: -90 }));
const WAVE_SPRAY = fxOf(spr('frost_wave', 200, { frameRange: [6, 8], dur: 0.5, anchorY: 0.86, alpha: 0.28 }),
    { type: 'motes', at: 0, count: 4, spread: 50, rise: [30, 90], life: [0.5, 0.9], size: 2.4, color: FROST_W });
const WAVE_FROST = ICE_SPROUT(70, 0.45);
const WAVE_BREAK = fxOf(spr('frost_wave', 320, { frameRange: [4, 8], dur: 0.7, anchorY: 0.86 }),
    { type: 'shards', at: 0, count: 10, speed: 260, angle: -1.2, cone: 1.2, size: 4.5, spin: 9, life: [0.6, 1], shape: 'ice', floor: 0, color: '200, 235, 255' });
const WAVE_HIT = ICE_HIT(110);
/** 파도 하나: play(fx, x, y, o)·later(초, 함수)로 전투·미리보기 함께 씀. k = 미리보기 배율 */
function playColdWave(play, later, x0, x1, y, k) {
    const sec = (x1 - x0) / (WAVE_SPEED * k);
    play(WAVE_RISE, x0, y, { scale: k });
    later(0.12, () => play(WAVE_RIDE(sec), x0, y, { scale: k, to: [x1, y] }));
    for (let t = 0.2; t < sec; t += 0.1) {
        const x = x0 + (x1 - x0) * (t / sec);
        later(0.12 + t, () => play(WAVE_SPRAY, x - 70 * k, y, { scale: k }));
        if (Math.round(t / 0.1) % 2 === 0) later(0.12 + t, () => play(WAVE_FROST, x - 120 * k, y, { scale: k }));
    }
    later(0.12 + sec, () => play(WAVE_BREAK, x1, y, { scale: k }));
}
eternalWinter.preview = api => {
    const k = kOf(api), x1 = api.dummies[api.dummies.length - 1].x + 120 * k;
    playColdWave((fx, x, y, o) => api.vfx.play(fx, x, y, o), (d, f) => api.later(d, f), api.CHAR_X + 170 * k, x1, api.GROUND_Y, k);
};

// ==== D-137 (2026-11-16): 서리의 무희 2차 세트 9개 — 스킬 설명에 맞는 이펙트 (얼음·눈은 푸른·흰 계통, 오로라 초록·분홍, 흑조 보라, 달빛 연보라) ====
// 물건 그림 frost_set (vfx/iceFx.js FS): 0 얼음 감옥 블록 · 1 큰 눈꽃 · 2 얼음 창 · 3 흑조 · 4 얼음 별 · 5 빙하 덩어리
const alive = (b, e) => b.enemies.includes(e) && e.hp > 0;
const chestOf = e => [aimAt(e).x, aimAt(e).b];
const kOf = api => api.VFX_SCALE * 0.56;
const midOf = api => (api.dummies[0].x + api.dummies[api.dummies.length - 1].x) / 2;

// ---- 설원 검무 ----
// 백야의 검무 (필살기): 예전엔 적마다 작은 X자 → 6번 벨 때마다 앞쪽 전체를 가르는 큰 얼음 초승달이 번갈아 휘고(위·아래),
//   적마다 X자 얼음 베기 + 서리 번쩍, 마지막 베기는 크게 터지며 흔들림
const WN_ARC = (flip, last) => fxOf(spr('ice_burst', last ? 380 : 320, { frameRange: [1, last ? 5 : 3], dur: last ? 0.45 : 0.25, flipX: flip, angle: flip ? 0.25 : -0.25, glow: 1.2 }),
    { type: 'streaks', at: 0, count: last ? 18 : 8, speed: 520, angle: 0, cone: 0.5, len: 30, life: [0.2, 0.4], color: FROST_W });
function whiteNightArcs(b) {
    for (let i = 0; i < 6; i++) b.schedule(i * 0.18, () => {
        if (!b.isActive) return;
        b.fx.play(WN_ARC(i % 2 === 1, i === 5), b.frontX() + 210, FOOT_B + 80);
        b.director.shake(i === 5 ? 7 : 2, i === 5 ? 260 : 90);
    });
}
whiteNightArcs.preview = api => { for (let i = 0; i < 6; i++) api.later(i * 0.18, () => api.vfx.play(WN_ARC(i % 2 === 1, i === 5), midOf(api), api.GROUND_Y - 80 * kOf(api), { scale: kOf(api) })); };

// 얼음 거울: 예전엔 얼음 터짐 두 번 → 내 앞에 반투명 얼음 거울판(4초)이 서서 빛이 스치고, 0.6초마다 거울 면이 번쩍 (되돌림)
const MIRROR = sec => fxOf(FS(0, 170, { dur: sec, width: 80, height: 190, anchorY: 0.9, alpha: 0.5, popIn: 0.25, fadeOut: 0.4 }),
    spr('ice_shatter', 150, { frameRange: [0, 2], dur: 0.3, anchorY: 0.9 }),
    { type: 'candleGlow', at: 0.1, dur: sec, r: 60, color: '170, 230, 255', dy: -90 },
    { type: 'crystals', at: 0.05, dur: sec, count: 4, h: 30, spread: 34, color: '150, 220, 255' });
const MIRROR_GLINT = fxOf({ type: 'flash', at: 0, dur: 0.16, r: 50, color: FROST_W }, { type: 'streaks', at: 0, count: 6, speed: 260, len: 18, life: [0.2, 0.35], color: FROST_W });
// 거울에 막힌 적 탄: 거울 면에서 번쩍 + 얼음 조각이 튐 → 탄이 얼음빛으로 되받아쳐짐 (battle/kit.js kitMirrorCatch)
const MIRROR_BOUNCE = fxOf({ type: 'flash', at: 0, dur: 0.14, r: 34, color: FROST_W },
    spr('ice_burst', 90, { frameRange: [3, 6], dur: 0.3 }),
    { type: 'shards', at: 0, count: 5, speed: 180, angle: 0, cone: 1.4, size: 4, spin: 9, life: [0.4, 0.7], shape: 'ice', floor: 0, color: '190, 230, 255' });
function iceMirror(b, ctx, s) {
    const at = () => [b.monsterX + 120, FOOT_B];
    b.fx.play(MIRROR(s.sec), ...at(), { follow: at, alive: () => b.isActive });
    for (let t = 0.6; t < s.sec; t += 0.6) b.schedule(t, () => b.isActive && b.fx.play(MIRROR_GLINT, b.monsterX + 120, FOOT_B + 100));
}
iceMirror.preview = api => api.vfx.play(MIRROR(2.5), api.CHAR_X + 90 * kOf(api), api.GROUND_Y, { scale: kOf(api) });

// 빙창 찌르기: 예전엔 얼음 깨짐 한 번 → 큰 얼음 창이 앞으로 꿰뚫으며 날아가고(빛 꼬리), 꿰인 자리 얼음 터짐 + 결정 솟음
const LANCE = sec => fxOf(FS(2, 200, { dur: sec, travel: true, glow: 1.2 }), { type: 'boltTrail', at: 0, dur: sec + 0.15, fly: sec, len: 0.1, w: 7, color: '150, 220, 255' });
function lanceThrust(b) {
    const from = [b.monsterX + 70, FOOT_B + 70];
    b.fx.play(LANCE(0.22), ...from, { to: [from[0] + 260, from[1]] });
    b.schedule(0.1, () => b.isActive && b.fx.play(ICE_BREAK(150), b.frontX() + 100, FOOT_B));
}
lanceThrust.preview = api => { const m = [api.CHAR_X + 40 * kOf(api), api.enemyChestY()]; api.vfx.play(LANCE(0.22), ...m, { scale: kOf(api), to: [api.dummies[1].x, m[1]] }); };
const LANCE_HIT = ICE_HIT(140);

// ---- 눈보라 마녀 ----
// 극야 (필살기): 예전엔 눈 알갱이 몇 점 → 10초 동안 하늘이 어두워지고 화면 위끝부터 전장 전체에 눈이 휘날려 내림(눈구름 띠·눈송이·바닥 서리빛),
//   큰 눈꽃 몇 송이가 천천히 돌며 떨어짐
const POLAR = (w, sec) => fxOf(SNOW_FALL(w, sec, { count: 260, wind: 110, speed: 0.32, flake: 1.25, dim: 0.32, storm: true, cloudColor: '120, 150, 200' }),
    { type: 'candleGlow', at: 0, dur: sec, r: w * 0.5, ground: true, color: '150, 200, 255' });
function polarNight(b, ctx, s) {
    const x = b.frontX() + 230, top = (b.fx.H || 600) - 40;
    b.fx.play(POLAR(1500, s.sec), b.monsterX + 500, FOOT_B, { alive: () => b.isActive });
    [0, 1, 2, 3].forEach(i => b.schedule(i * 2.2, () => b.isActive && b.fx.play(fxOf(FS(1, 70 + (i % 2) * 26, { dur: 3.4, travel: true, spin: 1.3, alpha: 0.8, fadeOut: 0.7 })),
        x + (i - 1.5) * 200, top, { to: [x + (i - 1.5) * 200 + 60, FOOT_B + 20] })));
}
polarNight.preview = api => api.vfx.play(POLAR(700, 4), midOf(api), api.GROUND_Y, { scale: kOf(api) });

// 서리 정령: 예전엔 얼음 터짐 한 번 → 눈꽃이 돌며 피어나 정령이 깨어남(눈꽃 + 서리 소용돌이 + 눈 알갱이)
const SPIRIT_POP = fxOf(FS(1, 110, { dur: 0.8, spin: 4, popIn: 0.25, fadeOut: 0.35 }),
    { type: 'swirl', at: 0, dur: 0.7, r: 50, arms: 4, spin: 12, color: FROST_W },
    { type: 'motes', at: 0.05, count: 12, spread: 30, rise: [20, 60], life: [0.5, 0.9], size: 2.2, color: FROST_W });

// 서리 정령 얼음 화살 (D-140): 예전엔 적에게 붙어 몸으로 침 → 사거리 240에서 멈춰 0.8초마다 얼음 창(frost_set 2칸)을 쏨, 맞으면 얼음 튐 + 냉기 1
const SPIRIT_ARROW = sec => fxOf(FS(2, 58, { dur: sec, travel: true, glow: 1.3 }),
    { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.12, w: 4, color: '200, 235, 255' });
const SPIRIT_ARROW_HIT = ICE_HIT(72);

// 우박 낙하: 예전엔 얼음 깨짐만 → 하늘에서 얼음 덩어리 우박이 비스듬히 쏟아져 땅에 부딪히며 깨지고 눈먼지
const HAIL_FALL = sec => fxOf(FS(5, 80, { dur: sec, travel: true, spin: 6 }), { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.08, w: 5, color: '200, 235, 255' });
const HAIL_HIT = fxOf(spr('ice_shatter', 180, { frameRange: [4, 8], dur: 0.5, anchorY: 0.88 }),
    { type: 'shards', at: 0, count: 10, speed: 300, size: 6, spin: 9, life: [0.6, 1], shape: 'ice', floor: 0, color: '200, 235, 255' },
    { type: 'dustCloud', at: 0.04, dur: 1.1, w: 110, h: 50, color: '200, 225, 245', alpha: 0.6 },
    { type: 'shockwave', at: 0, dur: 0.35, r: 80, width: 5, ground: true, color: '150, 220, 255' });

// ---- 얼음 여왕 ----
// 절대 영도 (필살기): 예전엔 적마다 작은 얼음 터짐 → 여왕에게서 냉기 파도가 화면 끝까지 퍼지고(눈꽃 고리 + 바닥 서리 고리),
//   모든 적이 반투명 얼음 감옥에 갇힘 → 2초 뒤 차례로 크게 깨짐
const ZERO_WAVE = fxOf(spr('eternal_winter', 480, { frameRange: [2, 6], dur: 0.9, dy: -60 }),
    { type: 'shockwave', at: 0, dur: 0.8, r: 760, width: 26, ground: true, color: '150, 220, 255' },
    { type: 'flash', at: 0, dur: 0.25, r: 200, color: FROST_W, dy: -60 });

// 얼음 기사 소환: 예전엔 얼음 깨짐 한 번 → 땅에서 얼음 결정이 솟고 서리 고리 위로 기사가 나타남
const KNIGHT_RISE = fxOf(spr('ice_shatter', 200, { frameRange: [0, 6], dur: 0.8, anchorY: 0.9 }),
    { type: 'ring', at: 0, dur: 0.5, r: 90, ground: true, color: FROST_W, width: 4 },
    { type: 'motes', at: 0.1, count: 10, spread: 30, rise: [30, 80], life: [0.5, 0.9], size: 2.2, color: FROST_W });

// 얼음 가시 길: 예전엔 작은 얼음 깨짐이 줄줄이 → 땅을 따라 큰 얼음 가시가 차례로 솟았다 부서지며 달려감 (얼음 줄기)
const SPIKE_STEP = ICE_SPROUT(130, 0.7);

// ---- 오로라 가희 ----
// 오로라 장막 (필살기): 예전엔 오로라 그림이 1초씩 떴다 사라짐 → 8초 동안 하늘에 오로라 빛띠 세 폭이 길게 일렁이고, 바닥은 초록 빛, 반짝이는 빛 알갱이가 내림
const AURORA_SKY = (w, sec) => fxOf(
    ...[-1, 0, 1].map(i => spr('aurora_ribbon', 420, { dur: sec, frameRange: [0, 8], loopSec: 2.2, pingPong: true, phase: i * 0.7, dx: i * w * 0.3, dy: -260 + Math.abs(i) * 30,
        alpha: 0.85, fadeIn: 0.6, fadeOut: 0.8 })),
    { type: 'candleGlow', at: 0, dur: sec, r: w * 0.5, ground: true, color: '140, 255, 200' },
    { type: 'snowFall', at: 0.3, dur: sec - 0.3, w, count: 40, top: -10, wind: 20, speed: 0.2, cloud: false, color: '170, 255, 220' });
function auroraSky(b, ctx, s) { b.fx.play(AURORA_SKY(780, s.sec), b.frontX() + 230, FOOT_B, { alive: () => b.isActive }); }
auroraSky.preview = api => api.vfx.play(AURORA_SKY(700, 4), midOf(api), api.GROUND_Y, { scale: kOf(api) });

// 빛띠 회전: 예전엔 빛 알갱이 몇 점 → 4초 동안 오로라 빛띠 세 줄이 몸 둘레를 감아 돌고, 빛 알갱이 회오리 + 바닥 초록 빛
const RIBBON_SPIN = sec => fxOf(
    ...[0, 2.1, 4.2].map(ph => spr('aurora_ribbon', 170, { dur: sec, frameRange: [0, 8], loopSec: 1.2, orbit: { r: 95, ry: 30, speed: 4.5, phase: ph }, dy: -80,
        fadeIn: 0.2, fadeOut: 0.4 })),
    { type: 'petalVortex', at: 0, dur: sec, rx: 120, h: 170, count: 40, color: '160, 255, 210', backColor: '120, 160, 255', hiColor: '255, 220, 245' },
    { type: 'candleGlow', at: 0, dur: sec, r: 140, ground: true, color: '140, 255, 200' });
function ribbonSpin(b, ctx, s) { const me = () => [b.monsterX + 38, FOOT_B]; b.fx.play(RIBBON_SPIN(s.sec), ...me(), { follow: me, alive: () => b.isActive }); }
ribbonSpin.preview = api => api.vfx.play(RIBBON_SPIN(2.5), api.CHAR_X, api.GROUND_Y, { scale: kOf(api) });

// 빛띠 날리기: 예전엔 작은 베기 줄 → 오로라 빛띠 세 줄이 위·가운데·아래로 휘어 날아가 적을 꿰뚫음(빛 꼬리)
const RIBBON_FLY = (sec, arc) => fxOf(spr('aurora_ribbon', 160, { dur: sec, frameRange: [0, 8], loopSec: 0.5, travel: true, arc }),
    { type: 'motes', at: 0, count: 6, spread: 20, rise: [0, 20], life: [0.3, 0.5], size: 2, color: '160, 255, 210' });
function ribbonThrow(b) {
    [40, 0, -40].forEach((arc, i) => b.schedule(i * 0.12, () => {
        if (!b.isActive) return;
        const m = [b.monsterX + 80, FOOT_B + 110];
        b.fx.play(RIBBON_FLY(0.62, arc), ...m, { to: [m[0] + 400, FOOT_B + 100] });
    }));
}
ribbonThrow.preview = api => [40, 0, -40].forEach((arc, i) => api.later(i * 0.12, () => {
    const m = api.muzzle(); api.vfx.play(RIBBON_FLY(0.62, arc), ...m, { scale: kOf(api), to: [api.dummies[api.dummies.length - 1].x, m[1]] });
}));

// ---- 서리 늑대 사냥꾼 ----
// 늑대 무리 사냥 (필살기): 예전엔 적 자리에 늑대 머리 그림만 → 얼음늑대(전신)가 뒤에서 바닥을 달려와 덤벼 물어뜯음(얼음 터짐·발톱·조각), 서리 안개
// 얼음늑대 전신 그림 ice_wolf (Gemini 2칸 → build_saint_set.py ice_wolf 2 1 320): 0 달리기 · 1 덤비기 (불투명)
const IWOLF = (frame, size, o = {}) => spr('ice_wolf', size, { frameRange: [frame, frame], blend: 'normal', ...o });
const WOLF_T = { run: 0.3, leap: 0.14 };
// 덤비기 칸은 뒷발이 그림 아래 0.82 자리 → 크기 180이면 가운데가 바닥 + 64 아래로 내려가면 뒷발이 바닥 밑으로 (11-16 피드백)
const WOLF_HOLD_MIN = 64;
const holdY = c => Math.max(c[1] + 10, FOOT_B + WOLF_HOLD_MIN);
const WOLF_RUN = sec => fxOf(IWOLF(0, 170, { dur: sec, travel: true, upright: true, arc: 6, squash: 0.96, fadeIn: 0.06, glow: 1.2 }),
    { type: 'mist', at: 0, r: 30, h: 8, life: 0.6, drift: 20, color: '110, 160, 200' },
    { type: 'motes', at: 0, count: 8, spread: 40, rise: [0, 20], life: [0.3, 0.6], size: 2, color: FROST_W });
const WOLF_LEAP = sec => fxOf(IWOLF(1, 180, { dur: sec, travel: true, upright: true, arc: 14, glow: 1.25 }));
const WOLF_HOLD = fxOf(IWOLF(1, 180, { dur: 0.32, fadeOut: 0.2, glow: 1.25 }));
const WOLF_BITE = fxOf(spr('ice_burst', 150, { frameRange: [3, 8], dur: 0.45 }),
    spr('claw_fire', 150, { at: 0.03, hue: 180, dur: 0.3 }),
    { type: 'shards', at: 0.05, count: 7, speed: 230, size: 4.5, spin: 9, life: [0.6, 1], shape: 'ice', floor: 30, color: '190, 230, 255' });

// 연구소 미리보기: 얼음늑대들이 차례로 달려와 허수아비마다 덤빔
function wolfHuntPreview(api) {
    const k = api.VFX_SCALE * 0.56, y = api.enemyChestY();
    api.dummies.forEach((d, i) => api.later(i * 0.35, () => {
        const r0 = [d.x - 330 * k, api.GROUND_Y - 42 * k], r1 = [d.x - 95 * k, api.GROUND_Y - 44 * k];
        api.vfx.play(WOLF_RUN(WOLF_T.run), ...r0, { scale: k, to: r1 });
        const hy = Math.min(y - 10 * k, api.GROUND_Y - WOLF_HOLD_MIN * k);
        api.later(WOLF_T.run, () => api.vfx.play(WOLF_LEAP(WOLF_T.leap), ...r1, { scale: k, to: [d.x - 20 * k, hy] }));
        api.later(WOLF_T.run + WOLF_T.leap, () => { api.vfx.play(WOLF_HOLD, d.x - 20 * k, hy, { scale: k }); api.vfx.play(WOLF_BITE, d.x, y, { scale: k }); });
    }));
}
// 늑대 울음: 예전엔 초록 포효 → 흰 늑대 머리 형상이 하늘을 향해 울부짖고 얼음빛 음파가 퍼지며, 6초 동안 내 발밑 얼음빛 기운
const HOWL = sec => fxOf(spr('frost_wolf', 230, { frameRange: [2, 2], dur: 1.1, dy: -150, angle: -0.35, alpha: 0.75, popIn: 0.25, fadeOut: 0.5 }),
    spr('sonic_ring', 300, { frameRange: [1, 6], dur: 0.7, hue: 10, dx: 90, dy: -110, alpha: 0.85 }),
    spr('sonic_ring', 380, { at: 0.25, frameRange: [1, 6], dur: 0.7, hue: 10, dx: 160, dy: -110, alpha: 0.6 }),
    { type: 'shockwave', at: 0.05, dur: 0.6, r: 420, width: 14, ground: true, color: '200, 225, 240' },
    spr('power_aura', 170, { dur: sec, frameRange: [1, 2], loopSec: 0.7, pingPong: true, anchorY: 0.88, hue: 175, alpha: 0.55, fadeIn: 0.3, fadeOut: 0.6 }));
function howlFx(b, ctx, s) { const me = () => [b.monsterX + 38, FOOT_B]; b.fx.play(HOWL(s.sec), ...me(), { follow: me, alive: () => b.isActive }); b.director.shake(4, 250); }
howlFx.preview = api => api.vfx.play(HOWL(2.5), api.CHAR_X, api.GROUND_Y, { scale: kOf(api) });

// 덮치기: 예전엔 발톱 그림 하나 → 얼음 늑대 머리가 앞으로 덮치며 큰 얼음 발톱 자국 + 얼음 깨짐 + 흔들림
const POUNCE = fxOf(spr('frost_wolf', 190, { frameRange: [2, 6], dur: 0.45, dx: -30 }),
    spr('claw_fire', 220, { at: 0.08, hue: 180, dur: 0.35 }),
    spr('ice_shatter', 170, { at: 0.08, frameRange: [4, 8], dur: 0.5, anchorY: 0.6 }));

// ---- 빙하 거인 소환사 ----
// 빙하 거인 (필살기): 예전엔 거인 그림이 한 번 → 땅이 갈라지며 거대한 빙하 거인이 솟아오르고(더 크게), 서리 고리·얼음 조각·흔들림
const GIANT_RISE = fxOf(spr('glacier_giant', 440, { frameRange: [0, 6], dur: 1.1, anchorY: 0.92 }),
    { type: 'cracks', at: 0, dur: 1.4, count: 7, len: 130, color: '150, 220, 255' },
    { type: 'shockwave', at: 0.3, dur: 0.6, r: 300, width: 14, ground: true, color: '150, 220, 255' },
    { type: 'shards', at: 0.3, count: 14, speed: 360, size: 7, spin: 7, life: [0.8, 1.3], shape: 'ice', floor: 0, color: '190, 230, 255' },
    { type: 'dustCloud', at: 0.35, dur: 1.6, w: 220, h: 90, color: '200, 225, 245', alpha: 0.7 });
// 빙하 거인 내려치기 (D-140, kit.js tickKitSlam): 두 주먹이 땅에 박히는 순간 — 땅 갈라짐 + 서리 고리(범위) + 주먹 둘레로 얼음 가시 줄 + 얼음 조각·눈 먼지
//   범위 안 적은 얼음 감옥(빙결 1초)에 갇힘. 예전엔 맞붙은 적 하나에 1초마다 빙결만 (그림·효과 없음)
const GOLEM_SPIKES = [-110, -55, 0, 55, 110].flatMap((dx, i) => [
    spr('ice_shatter', i === 2 ? 120 : 90, { at: 0.02 + Math.abs(i - 2) * 0.05, frameRange: [1, 2], dur: 0.3, anchorY: 0.9, glow: 1, dx }),
    spr('ice_shatter', i === 2 ? 120 : 90, { at: 0.32 + Math.abs(i - 2) * 0.05, frameRange: [6, 8], dur: 0.35, anchorY: 0.9, alpha: 0.8, glow: 1, dx })]);
const GOLEM_SLAM = fxOf(GOLEM_SPIKES,
    { type: 'flash', at: 0, dur: 0.16, r: 90, color: FROST_W, dy: -20 },
    { type: 'cracks', at: 0, dur: 0.9, count: 6, len: 120, color: '150, 220, 255' },
    { type: 'shockwave', at: 0, dur: 0.45, r: 160, width: 12, ground: true, color: ICE },
    { type: 'shockwave', at: 0.08, dur: 0.5, r: 120, width: 6, ground: true, color: SNOW },
    { type: 'shards', at: 0, count: 12, speed: 320, angle: -1.57, cone: 1.3, size: 5.5, spin: 9, life: [0.6, 1], shape: 'ice', floor: 0, color: '190, 230, 255' },
    { type: 'dustCloud', at: 0.02, dur: 0.9, w: 200, h: 60, color: '200, 225, 245', alpha: 0.6 });
const GOLEM_FROZEN = ICE_PRISON(0.9, 120);

// 빙벽: 예전엔 벽 그림뿐 → 땅에서 얼음 결정이 크게 솟으며 벽이 세워지고(서리 안개·결정), 끝날 때 무너지며 크게 깨짐
const WALL_RISE = fxOf(spr('ice_shatter', 230, { frameRange: [0, 3], dur: 0.45, anchorY: 0.9 }),
    { type: 'crystals', at: 0, dur: 1.2, count: 6, h: 60, spread: 40, color: '150, 220, 255' },
    { type: 'mist', at: 0, r: 70, h: 12, life: 1.4, drift: 10, color: '110, 160, 200' },
    { type: 'shards', at: 0.1, count: 8, speed: 200, size: 5, spin: 7, life: [0.6, 1], shape: 'ice', floor: 0, color: '190, 230, 255' });

// 빙하 낙석: 예전엔 얼음 깨짐만 → 거대한 빙하 덩어리가 하늘에서 떨어져 땅에 처박히며 반구 충격파·땅 균열·얼음 조각·눈먼지
const GLACIER_FALL = sec => fxOf(FS(5, 230, { dur: sec, travel: true, spin: 1.5 }), { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.12, w: 14, color: '200, 235, 255' });
const GLACIER_HIT = fxOf(spr('ice_shatter', 320, { frameRange: [3, 8], dur: 0.7, anchorY: 0.88, glow: 1.3 }),
    { type: 'domeWave', at: 0, dur: 0.85, r: 200, h: 0.5, color: '170, 230, 255' },
    { type: 'cracks', at: 0.02, dur: 1.5, count: 7, len: 120, color: '150, 220, 255' },
    { type: 'shards', at: 0.03, count: 16, speed: 420, size: 7, spin: 7, life: [0.8, 1.3], shape: 'ice', floor: 0, color: '190, 230, 255' },
    { type: 'dustCloud', at: 0.08, dur: 2, w: 200, h: 100, color: '200, 225, 245', alpha: 0.8 });

// ---- 밤의 백조 ----
// 흑조의 군무 (필살기): 예전엔 깃털 소용돌이 그림이 칸칸이 → 6초 동안 흑조 네 마리가 장판 위를 크게 돌며 날고, 검은 깃털 소용돌이가 일렁이며
//   깃털이 흩날림 → 마지막에 깃털이 한꺼번에 터짐(보라 충격파)
const SWAN_DANCE = (w, sec) => fxOf(
    spr('feather_black', w * 0.95, { dur: sec, frameRange: [1, 3], loopSec: 1.2, pingPong: true, dy: -90, alpha: 0.7, squash: 0.6, fadeIn: 0.4, fadeOut: 0.5 }),
    ...[0, 1, 2, 3].map(i => FS(3, 90 + (i % 2) * 20, { dur: sec, flap: { speed: 9 + i, min: 0.55, seed: i }, orbit: { r: w * 0.42, ry: 50, speed: 1.6 + i * 0.2, phase: i * 1.6 },
        dy: -110 - (i % 2) * 40, fadeIn: 0.3, fadeOut: 0.5 })),
    { type: 'snowFall', at: 0.2, dur: sec - 0.2, w, count: 40, top: -10, wind: -60, speed: 0.25, cloud: false, color: '120, 100, 160' });
const SWAN_END = fxOf(spr('feather_black', 420, { frameRange: [4, 8], dur: 0.8, dy: -70 }),
    { type: 'shockwave', at: 0, dur: 0.6, r: 360, width: 18, ground: true, color: '150, 120, 200' },
    { type: 'flash', at: 0, dur: 0.2, r: 160, color: '200, 180, 255', dy: -70 });
function swanDance(b, ctx, s) {
    const z = b.kitZone({ tag: 'swan', x: 0, w: 400, sec: s.sec, dps: 0.6, status: { chill: 1 }, every: 1 });
    if (!z) return;
    const at = () => [z.x + z.w / 2, FOOT_B];
    b.fx.play(SWAN_DANCE(z.w, s.sec), ...at(), { follow: at, alive: () => b.kitZones.includes(z) });
    b.schedule(s.sec, () => b.isActive && b.fx.play(SWAN_END, ...at()));
}
swanDance.preview = api => { api.vfx.play(SWAN_DANCE(400, 3), midOf(api), api.GROUND_Y, { scale: kOf(api) }); api.later(3, () => api.vfx.play(SWAN_END, midOf(api), api.GROUND_Y, { scale: kOf(api) })); };

// 깃털 장막: 예전엔 어둠 터짐 → 4초 동안 검은 깃털 소용돌이가 몸을 감싸고 흑조 날개 그림자, 끝날 때 깃털이 터져 흩어짐
const VEIL = sec => fxOf(spr('feather_black', 260, { dur: sec, frameRange: [1, 3], loopSec: 1, pingPong: true, dy: -90, alpha: 0.65, fadeIn: 0.3, fadeOut: 0.3 }),
    { type: 'petalVortex', at: 0, dur: sec, rx: 90, h: 180, count: 36, color: '110, 90, 150', backColor: '60, 50, 90', hiColor: '200, 190, 240' });
const VEIL_BURST = fxOf(spr('feather_black', 300, { frameRange: [4, 8], dur: 0.6, dy: -80 }), { type: 'shockwave', at: 0, dur: 0.45, r: 200, width: 12, ground: true, color: '150, 120, 200' });
function veilBurst(b) {
    b.fx.play(VEIL_BURST, b.monsterX + 38, FOOT_B);
    b.director.shake(4, 200);
    enemiesNear(b, b.monsterX + 60, 180, true).forEach(e => kitHit(b, e, 1.5, { knock: 0.8 }));
}
function featherVeil(b, ctx, s) { const me = () => [b.monsterX + 38, FOOT_B]; b.fx.play(VEIL(s.sec), ...me(), { follow: me, alive: () => b.isActive }); }
featherVeil.preview = api => api.vfx.play(VEIL(2.5), api.CHAR_X, api.GROUND_Y, { scale: kOf(api) });

// 백조 회전: 예전엔 베기 하나 → 흑조가 날개를 펴고 앞으로 미끄러지며 지나간 자리에 보라 깃털 베기 + 깃털 흩날림
const SWAN_GLIDE = sec => fxOf(FS(3, 130, { dur: sec, travel: true, upright: true, flap: { speed: 14, min: 0.6 } }),
    { type: 'dashStreak', at: 0, dur: sec + 0.2, color: '150, 120, 200', w: 12 });
const SWAN_CUT = fxOf(spr('slash_violet', 170, { dur: 0.3 }), spr('feather_black', 160, { frameRange: [5, 8], dur: 0.5 }));
function swanGlide(b, ctx, s) {
    const from = [b.monsterX + 30, FOOT_B + 80];
    b.fx.play(SWAN_GLIDE(0.3), ...from, { to: [from[0] + (s.dist || 160) + 60, from[1]] });
}
swanGlide.preview = api => { const m = [api.CHAR_X, api.GROUND_Y - 80 * kOf(api)]; api.vfx.play(SWAN_GLIDE(0.3), ...m, { scale: kOf(api), to: [api.dummies[0].x, m[1]] }); };

// ---- 영원한 겨울의 여제 ----
// 영겁의 겨울 (필살기): 예전엔 3초마다 눈꽃 고리만 → 12초 동안 화면 전체에 눈이 내리고 하늘에 거대한 눈꽃이 천천히 돎,
//   3초마다 눈꽃 고리 냉기 파도 + 바닥 서리 고리, 끝날 때 얼은 적 모두 깨짐
const WINTER_SKY = (w, sec) => fxOf(SNOW_FALL(w, sec, { count: 240, wind: 50, speed: 0.28, flake: 1.2, dim: 0.22 }),
    FS(1, 300, { dur: sec, dy: -330, spin: 0.35, alpha: 0.4, popIn: 0.6, fadeOut: 1 }),
    { type: 'candleGlow', at: 0, dur: sec, r: w * 0.5, ground: true, color: '200, 235, 255' });
function winterSky(b, ctx, s) { b.fx.play(WINTER_SKY(1500, s.sec), b.monsterX + 500, FOOT_B, { alive: () => b.isActive }); }
winterSky.preview = api => api.vfx.play(WINTER_SKY(700, 4), midOf(api), api.GROUND_Y, { scale: kOf(api) });

// 눈꽃 결계: 예전엔 얼음 터짐이 칸칸이 → 결계 자리 바닥에 큰 눈꽃 문양이 빛나고(납작하게 돎) 그 위에 반투명 눈꽃이 서서 돌며,
//   가장자리에 얼음 결정 + 눈 알갱이 (6초)
const BARRIER = (w, sec, remaining) => fxOf(
    FS(1, w * 0.9, { dur: sec, squash: 0.22, spin: 0.6, alpha: 0.55, popIn: 0.3, fadeOut: 0.5, remaining }),
    FS(1, 150, { dur: sec, dy: -100, spin: 0.9, alpha: 0.45, popIn: 0.35, fadeOut: 0.5, remaining }),
    { type: 'crystals', at: 0, dur: sec, count: 8, h: 34, spread: w * 0.48, color: '150, 220, 255' },
    { type: 'snowFall', at: 0, dur: sec, w, count: 30, top: -10, wind: 0, speed: 0.2, cloud: false, ground: false, remaining });
function snowBarrier(b, ctx, s) {
    const z = b.kitZone({ tag: 'barrier', x: 0, w: 260, sec: s.sec, status: { stun: 0.6 }, every: 0.5 });
    if (!z) return;
    const at = () => [z.x + z.w / 2, FOOT_B];
    b.fx.play(BARRIER(z.w, s.sec, () => z.t), ...at(), { follow: at, alive: () => b.kitZones.includes(z) });
}
snowBarrier.preview = api => api.vfx.play(BARRIER(260, 2.5), api.CHAR_X + 200 * kOf(api), api.GROUND_Y, { scale: kOf(api) });

// 얼음 별: 예전엔 얼음 터짐 줄 → 도는 얼음 별 표창이 앞으로 날아가며 반짝이는 꼬리, 끝에서 크게 터짐 (4부위: 작은 별 4개가 흩어짐)
const STAR_FLY = sec => fxOf(FS(4, 110, { dur: sec, travel: true, spin: 14 }), { type: 'boltTrail', at: 0, dur: sec + 0.15, fly: sec, len: 0.15, w: 6, color: '170, 230, 255' });
const STAR_BOOM = fxOf(spr('ice_burst', 240, { frameRange: [3, 8], dur: 0.55, glow: 1.3 }),
    { type: 'shards', at: 0, count: 12, speed: 340, size: 6, spin: 9, life: [0.6, 1], shape: 'ice', floor: 30, color: '190, 230, 255' },
    { type: 'shockwave', at: 0, dur: 0.4, r: 120, width: 8, color: '170, 230, 255' });
const STAR_MINI = sec => fxOf(FS(4, 50, { dur: sec, travel: true, spin: 16 }));
function iceStarFly(b) {
    const from = [b.frontX() - 20, FOOT_B + 120];
    b.fx.play(STAR_FLY(0.9), ...from, { to: [b.frontX() + 370, FOOT_B + 120] });
}
iceStarFly.preview = api => { const m = api.muzzle(); api.vfx.play(STAR_FLY(0.9), ...m, { scale: kOf(api), to: [api.dummies[api.dummies.length - 1].x, m[1]] }); };

// ---- 달빛 검희 ----
// 월식 낙하 (필살기): 떨어지는 달(그대로) + 부딪힐 때 연보라 반구 충격파·고리·번쩍 + 8초 달빛 장판 바닥 빛과 달빛 알갱이
const MOON_HIT = fxOf({ type: 'domeWave', at: 0, dur: 0.9, r: 260, h: 0.5, color: '220, 220, 255' },
    { type: 'shockwave', at: 0, dur: 0.6, r: 420, width: 18, ground: true, color: '220, 230, 255' },
    { type: 'flash', at: 0, dur: 0.25, r: 200, color: '240, 240, 255', dy: -60 });
const MOON_FIELD = (w, sec) => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: w * 0.55, ground: true, color: '200, 210, 255' },
    { type: 'snowFall', at: 0, dur: sec, w, count: 36, top: -10, wind: 0, speed: 0.15, cloud: false, color: '220, 225, 255' });
function moonImpact(b) { b.fx.play(MOON_HIT, b.frontX() + 240, FOOT_B); b.fx.play(MOON_FIELD(400, 8), b.frontX() + 260, FOOT_B, { alive: () => b.isActive }); }
moonImpact.preview = api => { api.vfx.play(MOON_HIT, midOf(api), api.GROUND_Y, { scale: kOf(api) }); api.vfx.play(MOON_FIELD(400, 3), midOf(api), api.GROUND_Y, { scale: kOf(api) }); };

// 달의 가호: 예전엔 금빛 터짐 → 6초 동안 등 뒤에 큰 초승달이 떠 빛나고 달빛 알갱이가 오름 (보호막은 리그 실드 그대로)
const MOON_GUARD = sec => fxOf(spr('ice_burst', 260, { dur: sec, frameRange: [2, 2], dx: -40, dy: -110, hue: 40, alpha: 0.55, popIn: 0.3, fadeIn: 0.2, fadeOut: 0.6 }),
    { type: 'candleGlow', at: 0, dur: sec, r: 90, color: '210, 215, 255', dy: -110 },
    { type: 'motes', at: 0.1, count: 20, spread: 50, rise: [40, 110], life: [0.8, 1.4], size: 2.2, color: '220, 230, 255', dy: -20 });
function moonGuard(b, ctx, s) { const me = () => [b.monsterX + 38, FOOT_B]; b.fx.play(MOON_GUARD(s.sec), ...me(), { follow: me, alive: () => b.isActive }); }
moonGuard.preview = api => api.vfx.play(MOON_GUARD(2.5), api.CHAR_X, api.GROUND_Y, { scale: kOf(api) });

// 월광 일섬: 예전엔 X자 + 금빛 터짐 → 지나간 길에 달빛 일섬 줄이 그어지고, 1초 뒤 그 자리에 떨어지는 달 폭발(연보라 반구 충격파)
const MOON_LINE = fxOf({ type: 'dashStreak', at: 0, dur: 0.6, color: '220, 225, 255', w: 16 });
const MOON_BURST = fxOf(spr('moon_fall', 300, { frameRange: [3, 7], dur: 0.7, anchorY: 0.85 }),
    { type: 'domeWave', at: 0.05, dur: 0.7, r: 150, h: 0.5, color: '220, 220, 255' });
function moonSlashFx(b) {
    const x0 = b.monsterX + 40, x1 = x0 + 280;
    b.fx.play(MOON_LINE, x0, FOOT_B + 60, { to: [x1, FOOT_B + 60] });
    b.schedule(0.95, () => { if (b.isActive) { b.fx.play(MOON_BURST, b.frontX() + 80, FOOT_B); b.director.shake(5, 200); } });
}
moonSlashFx.preview = api => { const y = api.GROUND_Y - 60 * kOf(api); api.vfx.play(MOON_LINE, api.CHAR_X, y, { scale: kOf(api), to: [api.dummies[1].x, y] });
    api.later(0.95, () => api.vfx.play(MOON_BURST, api.dummies[0].x, api.GROUND_Y, { scale: kOf(api) })); };

export const FROST_SETS2 = packOf('frost', [
    // ---- 레어 ① 설원 검무 (1차 계획) — 얼음 쌍검으로 파고드는 근접 딜러 ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '설원 검무', style: 'dps', tint: 'hue-rotate(-15deg) saturate(1.4) brightness(1.1)',
        bonus: { 4: '얼음 쌍검 2연타 → 3연타' },
        kit: { 4: { patch: { _attack: { n: 1 } } } },
        head: { name: '서리 칼날 관', look: '칼날 모양 얼음 머리 장식', skill: 'fsWhiteNight', desc: '필살기 백야의 검무: 앞쪽을 6번 연속 베기 — 냉기 가득(빙결), 얼어 있으면 깨져 큰 피해', stats: { hp: 750, dps: 120, range: 20, speed: 10 } },
        body: { name: '얼음 거울 갑옷', look: '가슴에 얼음 거울판', skill: 'fsIceMirror', desc: '얼음 거울: 4초간 원거리 공격을 되돌리고, 근접으로 때린 적은 빙결', stats: { hp: 1800, dps: 90, range: 0, speed: 10 } },
        arm: { name: '얼음 쌍검', look: '양손 얼음 단검', skill: 'fsIceLance', desc: '기본 공격 얼음 쌍검 2연타 (냉기) · 빙창 찌르기: 앞으로 파고드는 관통 찌르기, 얼어 있으면 깨져 2배', stats: { hp: 500, dps: 560, range: 170, speed: 0 },
            kitAttack: { kind: 'multi', n: 2, gap: 0.1, vfx: V.slash(-80, 110, { dur: 0.25 }), status: { chill: 1 } } },
        leg: { name: '스케이트 날 부츠', look: '발밑에 얼음 스케이트 날', desc: '빙상 질주: 빙결된 적이 앞에 있으면 진격 속도 +20%', stats: { hp: 800, dps: 60, range: 0, speed: 125 },
            passive: { name: '빙상 질주', desc: '빙결된 적이 앞에 있으면 진격 속도 +20%', self: [{ when: 'frozenNear', mods: { move: 0.2 } }] } },
        skills: {
            fsWhiteNight: { name: '백야의 검무', slot: 'head', ult: true, cd: 0, icon: 'crescent', color: '#96dcff', target: 'enemy', range: 420, clip: 'dashSlash', sfx: 'frost_crescent',
                desc: '앞쪽을 6번 연속 베기 — 맞은 적 냉기 가득(빙결), 이미 얼어 있으면 깨져 큰 피해',
                steps: [{ at: 0.2, do: 'custom', fn: whiteNightArcs, preview: whiteNightArcs.preview },
                    { at: 0.2, do: 'hit', pick: 'all', range: 420, times: 6, every: 0.18, dmg: 0.8, shatter: 2.5, status: { chill: 4 }, knock: 0.3, vfx: V.xcut(0, 170, { dur: 0.3 }) }] },
            fsIceMirror: { name: '얼음 거울', slot: 'body', cd: 14, icon: 'shield', color: '#96dcff', target: 'self', clip: 'cast',
                desc: '4초간 얼음 거울 — 원거리 공격을 되돌리고, 근접으로 때린 적은 빙결',
                steps: [{ do: 'buff', key: 'iceMirror', sec: 4, mods: { rangedReflect: true, reflectStatus: { freeze: 1 }, mirrorDx: 150, mirrorFx: MIRROR_BOUNCE, mirrorHit: ICE_HIT(110), mirrorColor: '170, 230, 255' } },
                    { at: 0.2, do: 'custom', fn: iceMirror, sec: 4, preview: iceMirror.preview }] },
            fsIceLance: { name: '빙창 찌르기', slot: 'arm', cd: 9, icon: 'sword', color: '#96dcff', target: 'enemy', range: 160, clip: 'dashSlash',
                desc: '앞으로 파고드는 관통 찌르기 — 얼어 있는 적은 깨져 2배 피해',
                steps: [{ at: 0.15, do: 'custom', fn: lanceThrust, preview: lanceThrust.preview },
                    { at: 0.2, do: 'dash', dist: 120, sec: 0.25, dmg: 1.6, shatter: 2, knock: 0.6, hitVfx: LANCE_HIT }] }
        }
    },

    // ---- 레어 ② 눈보라 마녀 (1차 계획) — 날씨로 전장을 얼리는 원거리 ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '눈보라 마녀', style: 'range', tint: 'saturate(0.4) brightness(1.35) hue-rotate(10deg)',
        bonus: { 4: '서리 정령 2 → 3기, 지속 +4초' },
        kit: { 4: { patch: { fsSpirits: { n: 1, life: 4 } } } },
        head: { name: '눈구름 왕관', look: '머리 위에 작은 눈구름', skill: 'fsPolarNight', desc: '필살기 극야: 10초간 전장 전체에 눈 — 모든 적 매초 냉기 1 + 느려짐', stats: { hp: 700, dps: 100, range: 50, speed: 10 } },
        body: { name: '정령 깃 망토', look: '눈 정령이 깃든 털 망토', skill: 'fsSpirits', desc: '서리 정령: 눈 정령 2기 (8초) — 가까운 적에게 냉기', stats: { hp: 1600, dps: 80, range: 0, speed: 10 } },
        arm: { name: '우박 지팡이', look: '끝에 얼음 결정이 도는 지팡이', skill: 'fsHail', desc: '우박 낙하: 앞쪽 넓은 자리에 우박 3번 — 피해 + 냉기 (거점에도)', stats: { hp: 400, dps: 480, range: 320, speed: 0 } },
        leg: { name: '눈송이 부츠', look: '눈송이 장식 털 부츠', desc: '동상: 빙결이 풀린 적은 3초간 받는 피해 +15%', stats: { hp: 700, dps: 60, range: 0, speed: 105 },
            passive: { name: '동상', desc: '빙결이 풀린 적은 3초간 받는 피해 +15%', thaw: [3, 0.15] } },
        skills: {
            fsPolarNight: { name: '극야', slot: 'head', ult: true, cd: 0, icon: 'snow', color: '#e6f5ff', target: 'enemy', range: 600, clip: 'raise', sfx: 'frost_blizzard',
                desc: '10초간 전장 전체에 눈 — 모든 적 매초 냉기 1 + 느려짐',
                steps: [{ at: 0.4, do: 'screen', units: true, dmg: 0, status: { chill: 1, slow: 1.2 }, repeat: 10, repeatGap: 1 },
                    { at: 0.4, do: 'custom', fn: polarNight, sec: 10, preview: polarNight.preview }] },
            fsSpirits: { name: '서리 정령', slot: 'body', cd: 15, icon: 'snow', color: '#e6f5ff', target: 'self', clip: 'cast', p: { n: 2, life: 8 },
                desc: '눈 정령 2기 (8초) — 가까운 적에게 얼음 화살 (냉기)',
                steps: [{ at: 0.4, do: 'summon', n: '$n', art: 'frost_spirit', scale: 0.62, filter: 'drop-shadow(0 0 6px rgba(150, 220, 255, 0.85))', hp: 0.06, dps: 0.3, speed: 0.8, life: '$life', color: '#e6f5ff', vfx: SPIRIT_POP,
                    shoot: { range: 240, every: 0.8, speed: 680, from: [24, 72], fly: SPIRIT_ARROW, hit: SPIRIT_ARROW_HIT, status: { chill: 1 } } }] },
            fsHail: { name: '우박 낙하', slot: 'arm', cd: 9, icon: 'snow', color: '#e6f5ff', target: 'enemy', range: 340, clip: 'cast',
                desc: '앞쪽 넓은 자리에 우박 3번 — 피해 + 냉기 (거점에도)',
                steps: [{ at: 0.4, do: 'rain', count: 3, every: 0.2, radius: 80, dmg: 1.2, status: { chill: 1 }, fall: HAIL_FALL(0.3), fallDx: -180, vfx: HAIL_HIT, delay: 0.3, shake: 3 }] }
        }
    },

    // ---- 유니크 ① 얼음 여왕 (1차 계획) — 한 번에 얼리고 한 번에 깨뜨림 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '얼음 여왕', style: 'balance', tint: 'saturate(0.6) brightness(1.4) hue-rotate(-10deg) drop-shadow(0 0 5px rgba(170, 230, 255, 0.8))',
        bonus: { 2: '빙결 시간 +0.5초', 4: '빙결을 깨뜨릴 때마다 필살기 게이지 +3%' },
        kit: { 2: { mods: { freezeSec: 0.5 } }, 4: { on: [{ when: 'shatter', gauge: 0.03 }] } },
        head: { name: '얼음 여왕의 왕관', look: '높이 솟은 얼음 결정 왕관, 하늘빛 광채', skill: 'fsAbsoluteZero', desc: '필살기 절대 영도: 화면 모든 적 빙결 → 2초 뒤 차례로 깨짐 (둘레에 연쇄 피해)', stats: { hp: 850, dps: 140, range: 50, speed: 10 } },
        body: { name: '서리 왕실 드레스', look: '긴 얼음 망토가 달린 드레스', skill: 'fsIceKnights', desc: '얼음 기사 소환: 얼음 기사 2기 (10초) — 벤 적에 냉기', stats: { hp: 1900, dps: 100, range: 0, speed: 10 } },
        arm: { name: '얼음 왕홀', look: '끝에 큰 얼음 결정이 박힌 왕홀', skill: 'fsSpikePath', desc: '기본 공격 얼음 기둥 (맞힌 적 발밑에서 솟음, 냉기) · 얼음 가시 길: 땅을 따라 얼음 가시가 줄지어 솟음 — 관통, 냉기 3', stats: { hp: 500, dps: 580, range: 320, speed: 0 },
            kitAttack: { kind: 'melee', vfx: V.shatter(0, 120, { dur: 0.35 }), status: { chill: 1 }, knock: 0.4 } },
        leg: { name: '서리 유리 구두', look: '얼음 유리 구두, 걸음마다 서리꽃', desc: '얼음 왕국: 적이 빙결되면 가장 가까운 적에 냉기 2가 퍼짐', stats: { hp: 850, dps: 70, range: 0, speed: 130 },
            passive: { name: '얼음 왕국', desc: '적이 빙결되면 가장 가까운 다른 적 하나에 냉기 2가 퍼짐', onFreeze: { spread: 2 } } },
        skills: {
            fsAbsoluteZero: { name: '절대 영도', slot: 'head', ult: true, cd: 0, icon: 'icecage', color: '#aae6ff', target: 'enemy', range: 600, clip: 'raise', sfx: 'frost_eternal',
                desc: '화면 모든 적을 한 번에 빙결 → 2초 뒤 차례로 깨짐 (깨질 때 둘레 적에게 연쇄 피해)',
                steps: [{ at: 0.4, do: 'custom', fn: absoluteZero, hold: 2, dmg: 3 }, { at: 0.4, do: 'shake', power: 5, ms: 300 }] },
            fsIceKnights: { name: '얼음 기사 소환', slot: 'body', cd: 16, icon: 'minions', color: '#aae6ff', target: 'self', clip: 'cast',
                desc: '얼음 기사 2기 (10초) — 앞으로 나가 싸우고, 벤 적에 냉기 2',
                steps: [{ at: 0.4, do: 'summon', n: 2, spread: 40, art: 'guardian', scale: 0.75, filter: ICY, hp: 0.2, dps: 0.5, speed: 0.7, life: 10, hit: { chill: 2 }, color: '#aae6ff', vfx: KNIGHT_RISE, label: '얼음 기사!' }] },
            fsSpikePath: { name: '얼음 가시 길', slot: 'arm', cd: 9, icon: 'spikes', color: '#aae6ff', target: 'enemy', range: 420, clip: 'cast',
                desc: '앞으로 땅을 따라 얼음 가시가 줄지어 솟음 — 관통, 냉기 3',
                steps: [{ at: 0.45, do: 'wave', from: 0, speed: 520, dist: 440, w: 40, dmg: 1.2, status: { chill: 3 }, knock: 0.3, vfx: SPIKE_STEP, vfxEvery: 0.09, b: FOOT_B }] }
        }
    },

    // ---- 레어 ③ 오로라 가희 (균형) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '오로라 가희', style: 'balance', tint: 'hue-rotate(-60deg) saturate(1.5) brightness(1.15)',
        bonus: { 4: '오로라 동안 진격 속도 +20%' },
        kit: { 4: { patch: { fsAurora: { move: 0.2 } } } },
        head: { name: '오로라 머리띠', look: '초록·분홍 오로라 빛띠 머리띠', skill: 'fsAurora', desc: '필살기 오로라 장막: 8초간 오로라 — 내 스킬 쿨다운 2배 빨리 + 적 초당 냉기 1' },
        body: { name: '빛띠 드레스', look: '오로라 빛띠가 감긴 드레스', skill: 'fsRibbonSpin', desc: '빛띠 회전: 4초간 둘레 적 매초 피해 + 냉기' },
        arm: { name: '빛띠 부채', look: '빛띠가 흘러나오는 부채', skill: 'fsRibbonThrow', desc: '빛띠 날리기: 휘어 날아가는 빛띠 3줄 관통' },
        leg: { name: '빛 걸음 신발', look: '빛 자국이 남는 신발', desc: '잔광: 스킬을 쓴 뒤 3초간 받는 피해 -25%',
            passive: { name: '잔광', desc: '스킬을 쓴 뒤 3초간 받는 피해 -25%', onSkill: { sec: 3, mods: { def: 0.25 } } } },
        skills: {
            fsAurora: { name: '오로라 장막', slot: 'head', ult: true, cd: 0, icon: 'fan', color: '#8cffc8', target: 'self', clip: 'raise', p: { move: 0 },
                desc: '8초간 오로라 — 내 스킬 쿨다운 2배 빨리 + 적 초당 냉기 1',
                steps: [{ at: 0.4, do: 'buff', key: 'aurora', sec: 8, mods: { cdRate: 1, move: '$move' } },
                    { at: 0.4, do: 'custom', fn: auroraSky, sec: 8, preview: auroraSky.preview },
                    { at: 0.9, do: 'screen', units: true, dmg: 0, status: { chill: 1 }, repeat: 8, repeatGap: 1 }] },
            fsRibbonSpin: { name: '빛띠 회전', slot: 'body', cd: 13, icon: 'whirl', color: '#8cffc8', target: 'self', clip: 'spin',
                desc: '4초간 빛띠를 두르고 돎 — 둘레 적 매초 피해 + 냉기',
                steps: [{ at: 0.3, do: 'zone', follow: true, x: -110, w: 280, sec: 4, dps: 0.5, status: { chill: 1 }, every: 1 },
                    { at: 0.3, do: 'custom', fn: ribbonSpin, sec: 4, preview: ribbonSpin.preview }] },
            fsRibbonThrow: { name: '빛띠 날리기', slot: 'arm', cd: 8, icon: 'crescent', color: '#8cffc8', target: 'enemy', range: 360, clip: 'crescent',
                desc: '휘어 날아가는 빛띠 3줄 — 관통, 냉기',
                steps: [{ at: 0.38, do: 'custom', fn: ribbonThrow, preview: ribbonThrow.preview },
                    { at: 0.38, do: 'wave', from: 0, speed: 620, dist: 380, w: 38, dmg: 0.9, status: { chill: 1 }, hitVfx: V.motes(AURORA, 8), b: 120, repeat: 3, repeatGap: 0.12 }] }
        }
    },

    // ---- 레어 ④ 서리 늑대 사냥꾼 (속도) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '서리 늑대 사냥꾼', style: 'speed', tint: 'saturate(0.3) brightness(1.25) hue-rotate(200deg)',
        bonus: { 4: '늑대 4 → 6마리' },
        kit: { 4: { patch: { fsWolfPack: { n: 2 } } } },
        head: { name: '늑대 머리 망토', look: '흰 늑대 머리 모양 두건', skill: 'fsWolfPack', desc: '필살기 늑대 무리 사냥: 얼음 늑대 4마리가 6초간 적을 물어뜯음 (냉기 2)' },
        body: { name: '털 망토 갑옷', look: '흰 털 망토와 회청 갑옷', skill: 'fsHowl', desc: '늑대 울음: 6초간 나·아군 공격 +30%, 적 공격 -20%' },
        arm: { name: '얼음 송곳니 단검', look: '늑대 송곳니 모양 얼음 단검', skill: 'fsPounce', desc: '덮치기: 앞으로 뛰어들어 2초 기절 + 냉기 3' },
        leg: { name: '설피 장화', look: '눈 위를 걷는 설피 장화', desc: '설원 사냥: 빙결된 적이 앞에 있으면 공격 속도 +20%',
            passive: { name: '설원 사냥', desc: '빙결된 적이 앞에 있으면 공격 속도 +20%', self: [{ when: 'frozenNear', mods: { atkSpd: 0.2 } }] } },
        skills: {
            fsWolfPack: { name: '늑대 무리 사냥', slot: 'head', ult: true, cd: 0, icon: 'maul', color: '#c8e1f0', target: 'enemy', range: 450, clip: 'raise', p: { n: 4 },
                desc: '얼음 늑대 4마리가 6초간 적을 쫓아 물어뜯음 (냉기 2)',
                steps: [{ at: 0.4, do: 'custom', fn: wolfHunt, n: '$n', sec: 6, dmg: 1.2, preview: wolfHuntPreview }] },
            fsHowl: { name: '늑대 울음', slot: 'body', cd: 14, icon: 'roar', color: '#c8e1f0', target: 'self', clip: 'raise',
                desc: '6초간 나·아군 공격 +30%, 적 공격 -20%',
                steps: [{ do: 'buff', key: 'howl', sec: 6, mods: { dmg: 0.3, allyDmg: 0.3 } }, { do: 'custom', fn: howlFx, sec: 6, preview: howlFx.preview },
                    { at: 0.3, do: 'screen', units: true, dmg: 0, status: { weak: [6, 0.2] } }] },
            fsPounce: { name: '덮치기', slot: 'arm', cd: 8, icon: 'claw', color: '#c8e1f0', target: 'enemy', range: 180, clip: 'dashSlash',
                desc: '앞으로 뛰어들어 덮침 — 2초 기절 + 냉기 3',
                steps: [{ at: 0.2, do: 'dash', dist: 140, sec: 0.25, dmg: 1.4, knock: 0.4, status: { stun: 2, chill: 3 } }, { at: 0.3, do: 'fx', on: 'self', x: 130, b: 100, vfx: POUNCE }, { at: 0.3, do: 'shake', power: 5, ms: 200 }] }
        }
    },

    // ---- 유니크 ② 빙하 거인 소환사 (탱커) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '빙하 거인 소환사', style: 'tank', tint: 'hue-rotate(-25deg) saturate(1.1) brightness(1.05) contrast(1.1)',
        bonus: { 2: '빙하 거인 +3초', 4: '빙벽이 깨질 때 파편 폭발 + 빙결' },
        kit: { 2: { patch: { fsGlacierGiant: { life: 3 } } }, 4: { patch: { fsIceWall: { endFreeze: 2 } } } },
        head: { name: '빙하 왕관', look: '청록 빙하 덩어리 왕관', skill: 'fsGlacierGiant', desc: '필살기 빙하 거인: 얼음 거인 8초 — 걸으며 내려침 (범위 + 빙결)' },
        body: { name: '빙하 갑옷 드레스', look: '두꺼운 빙하 판 갑옷 드레스', skill: 'fsIceWall', desc: '빙벽: 앞에 얼음 벽 5초 — 진격을 막고 부딪친 적 냉기' },
        arm: { name: '빙하 지팡이', look: '빙하 덩어리가 달린 지팡이', skill: 'fsGlacierDrop', desc: '빙하 낙석: 거대 빙하 덩어리 — 넓은 범위 + 냉기 3' },
        leg: { name: '빙하 신발', look: '무거운 빙하 신발', desc: '빙하의 무게: 밀려나지 않음, 받는 피해 -10%',
            passive: { name: '빙하의 무게', desc: '밀려나지 않음, 받는 피해 -10%', flags: ['knockImmune'], mods: { def: 0.1 } } },
        skills: {
            fsGlacierGiant: { name: '빙하 거인', slot: 'head', ult: true, cd: 0, icon: 'icecage', color: '#78dce6', target: 'self', clip: 'raise', p: { life: 8 },
                desc: '얼음 거인 8초 — 걸으며 주먹으로 내려침 (범위 + 빙결)',
                steps: [{ at: 0.4, do: 'fx', x: 70, vfx: GIANT_RISE }, { at: 0.55, do: 'shake', power: 8, ms: 400 },
                    { at: 0.6, do: 'summon', n: 1, x: 90, art: 'glacier_golem', scale: 0.95, filter: 'drop-shadow(0 0 8px rgba(120, 220, 230, 0.8))', hp: 0.6, dps: 1.1, speed: 0.45, life: '$life', color: '#78dce6', label: '빙하 거인!', blast: { dmg: 2.5, radius: 150 },
                        slam: { at: 0.5, dx: 80, radius: 150, status: { freeze: 1 }, dmg: 0.6, fx: GOLEM_SLAM, frozenFx: GOLEM_FROZEN, shake: [4, 160] } }] },
            fsIceWall: { name: '빙벽', slot: 'body', cd: 14, icon: 'fort', color: '#78dce6', target: 'self', clip: 'cast', p: { endFreeze: 0 },
                desc: '앞에 얼음 벽 5초 — 적 진격을 막고 부딪친 적 냉기, 끝날 때 무너지며 피해',
                steps: [{ at: 0.4, do: 'zone', tag: 'icewall', wall: true, x: 30, w: 46, sec: 5, status: { chill: 1 }, every: 1,
                    art: { cls: 'is-icewall', sheet: 'ice_wall', w: 142, h: 224, dx: -48 },
                    end: { dmg: 1.5, radius: 160, vfx: ICE_BREAK(260), status: { freeze: '$endFreeze' } } }, { at: 0.4, do: 'fx', x: 53, vfx: WALL_RISE }, { at: 0.4, do: 'shake', power: 4, ms: 200 }] },
            fsGlacierDrop: { name: '빙하 낙석', slot: 'arm', cd: 9, icon: 'slam', color: '#78dce6', target: 'enemy', range: 360, clip: 'cast',
                desc: '거대 빙하 덩어리가 떨어짐 — 넓은 범위 + 냉기 3',
                steps: [{ at: 0.45, do: 'rain', count: 1, radius: 130, dmg: 2.5, status: { chill: 3 }, fall: GLACIER_FALL(0.4), fallDx: -120, vfx: GLACIER_HIT, delay: 0.4, shake: 8 }] }
        }
    },

    // ---- 유니크 ③ 밤의 백조 (공격) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '밤의 백조', style: 'dps', tint: 'brightness(0.6) saturate(0.5) hue-rotate(60deg) contrast(1.2)',
        bonus: { 2: '백조 회전 거리 +50%', 4: '마지막 깃털 폭발이 빙결된 적을 깨뜨려 2배' },
        kit: { 2: { patch: { fsSwanSpin: { dist: 80 } } }, 4: { patch: { fsBlackSwan: { shatter: 2 } } } },
        head: { name: '흑조 깃털관', look: '검은 백조 깃털관', skill: 'fsBlackSwan', desc: '필살기 흑조의 군무: 6초간 검은 깃털 소용돌이 — 매초 피해 + 냉기, 마지막에 깃털 폭발' },
        body: { name: '백조 깃 드레스', look: '검은 깃털 드레스', skill: 'fsFeatherVeil', desc: '깃털 장막: 4초간 받는 피해 -60%, 끝날 때 둘레 피해' },
        arm: { name: '깃털 칼날 부채', look: '깃털 칼날이 달린 부채', skill: 'fsSwanSpin', desc: '백조 회전: 회전하며 앞으로 미끄러져 지나간 적 베기 + 냉기 2' },
        leg: { name: '토슈즈', look: '은빛 리본 토슈즈', desc: '우아한 회피: 근접 피해 20% 피함',
            passive: { name: '우아한 회피', desc: '근접 공격 20%를 피함', mods: { dodgeMelee: 0.2 } } },
        skills: {
            fsBlackSwan: { name: '흑조의 군무', slot: 'head', ult: true, cd: 0, icon: 'fan', color: '#7864a0', target: 'enemy', range: 420, clip: 'spin', p: { shatter: 0 },
                desc: '6초간 검은 깃털이 휘몰아침 — 매초 피해 + 냉기, 마지막에 깃털 폭발',
                steps: [{ at: 0.4, do: 'custom', fn: swanDance, sec: 6, preview: swanDance.preview },
                    { at: 6.4, do: 'hit', pick: 'all', range: 420, dmg: 2.5, shatter: '$shatter', knock: 1, vfx: fxOf(spr('feather_black', 130, { frameRange: [5, 8], dur: 0.4 })) }, { at: 6.4, do: 'shake', power: 8, ms: 350 }] },
            fsFeatherVeil: { name: '깃털 장막', slot: 'body', cd: 14, icon: 'shield', color: '#7864a0', target: 'self', clip: 'cast',
                desc: '4초간 받는 피해 -60% — 끝날 때 깃털이 터져 둘레 피해',
                steps: [{ do: 'buff', key: 'featherVeil', sec: 4, mods: { def: 0.6, onEnd: { do: 'custom', fn: veilBurst } } },
                    { do: 'custom', fn: featherVeil, sec: 4, preview: featherVeil.preview }] },
            fsSwanSpin: { name: '백조 회전', slot: 'arm', cd: 8, icon: 'whirl', color: '#7864a0', target: 'enemy', range: 200, clip: 'spin', p: { dist: 160 },
                desc: '회전하며 앞으로 미끄러져 지나간 적 베기 + 냉기 2',
                steps: [{ at: 0.2, do: 'custom', fn: swanGlide, dist: '$dist', preview: swanGlide.preview },
                    { at: 0.25, do: 'blink', dist: '$dist', dmg: 1.3, status: { chill: 2 }, hitVfx: SWAN_CUT }] }
        }
    },

    // ---- 레전더리 ① 영원한 겨울의 여제 (사거리) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '영원한 겨울의 여제', style: 'range', tint: 'saturate(0.5) brightness(1.5) hue-rotate(-5deg) drop-shadow(0 0 8px rgba(200, 240, 255, 0.9))',
        bonus: { 2: '냉기 파도 3 → 2초마다', 4: '얼음 별이 터질 때 작은 별 4개로' },
        kit: { 2: { patch: { fsEternalWinter: { gap: -1 } } }, 4: { patch: { fsIceStar: { split: 4 } } } },
        head: { name: '영원한 겨울 왕관', look: '흰·파랑 수정이 솟은 왕관', skill: 'fsEternalWinter', desc: '필살기 영겁의 겨울: 12초간 겨울 왕국 — 모든 적 느려짐, 3초마다 냉기 파도, 끝날 때 얼은 적 모두 깨짐' },
        body: { name: '눈꽃 망토 드레스', look: '눈꽃 무늬 긴 망토 드레스', skill: 'fsSnowBarrier', desc: '눈꽃 결계: 6초간 결계 — 안의 적 공격 못 함, 나 받는 피해 -30%' },
        arm: { name: '눈꽃 왕홀', look: '눈꽃 결정이 도는 왕홀', skill: 'fsIceStar', desc: '기본 공격 눈꽃 결정 (맞은 자리 눈꽃 폭발, 범위 냉기) · 얼음 별: 도는 얼음 별이 날아가 냉기 3 + 끝에서 폭발',
            kitAttack: { kind: 'shot', color: SNOW, vfx: V.shatter(0, 90, { dur: 0.35 }), splash: 70, splashMul: 0.5, status: { chill: 1 } } },
        leg: { name: '서리 왕좌 구두', look: '왕관 수정 커프·수정 굽 하이힐 부츠', desc: '겨울의 심장: 빙결된 적 하나마다 피해 +3% (최대 +30%)',
            passive: { name: '겨울의 심장', desc: '빙결된 적 하나마다 주는 피해 +3% (최대 +30%)', perFrozen: { dmg: 0.03, max: 0.3 } } },
        skills: {
            fsEternalWinter: { name: '영겁의 겨울', slot: 'head', ult: true, cd: 0, icon: 'snow', color: '#c8f0ff', target: 'enemy', range: 600, clip: 'raise', sfx: 'frost_blizzard', p: { gap: 3 },
                desc: '12초간 겨울 왕국 — 모든 적 느려짐, 3초마다 냉기 파도(냉기 2), 끝날 때 얼은 적 모두 깨짐',
                steps: [{ at: 0.4, do: 'custom', fn: eternalWinter, sec: 12, gap: '$gap', dmg: 2.5, preview: eternalWinter.preview }, { at: 0.4, do: 'custom', fn: winterSky, sec: 12.4, preview: winterSky.preview }] },
            fsSnowBarrier: { name: '눈꽃 결계', slot: 'body', cd: 15, icon: 'icecage', color: '#c8f0ff', target: 'self', clip: 'cast',
                desc: '6초간 앞에 눈꽃 결계 — 안의 적은 공격 못 함, 나 받는 피해 -30%',
                steps: [{ do: 'buff', key: 'snowBarrier', sec: 6, mods: { def: 0.3 } },
                    { at: 0.4, do: 'custom', fn: snowBarrier, sec: 6, preview: snowBarrier.preview }] },
            fsIceStar: { name: '얼음 별', slot: 'arm', cd: 9, icon: 'snow', color: '#c8f0ff', target: 'enemy', range: 380, clip: 'cast', p: { split: 0 },
                desc: '도는 얼음 별이 앞으로 날아가 냉기 3 — 끝에서 폭발 (4부위: 작은 별 4개로)',
                steps: [{ at: 0.45, do: 'custom', fn: iceStarFly, preview: iceStarFly.preview },
                    { at: 0.45, do: 'wave', from: 0, speed: 420, dist: 380, w: 45, every: 0.3, dmg: 0.6, status: { chill: 3 }, hitVfx: ICE_HIT(90), b: 120 },
                    { at: 1.4, do: 'rain', count: 1, x: [360, 380], aim: false, jitter: 0, radius: 90, dmg: 1.5, status: { chill: 2 }, vfx: STAR_BOOM, vfxB: FOOT_B + 120 },
                    { at: 1.5, do: 'rain', count: '$split', x: [260, 460], aim: false, radius: 60, dmg: 0.8, status: { chill: 1 }, fall: STAR_MINI(0.2), fallDx: -100, delay: 0.2, vfx: ICE_HIT(110), every: 0.08,
                        when: b => (b.kitPatch?.fsIceStar?.split || 0) > 0 }] }
        }
    },

    // ---- 레전더리 ② 달빛 검희 (공격) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '달빛 검희', style: 'dps', tint: 'saturate(0.5) brightness(1.2) hue-rotate(40deg) drop-shadow(0 0 7px rgba(220, 230, 255, 0.85))',
        bonus: { 2: '월광 일섬 뒤 다음 기본 공격 3배', 4: '달빛 장판에서 쓰러진 적마다 필살기 게이지 +3%' },
        kit: { 2: { on: [{ when: 'skill', skillId: 'fsMoonSlash', fn: b => { b.kitNextMul = Math.max(b.kitNextMul, 3); } }] }, 4: { on: [{ when: 'kill', inZone: 'moon', gauge: 0.03 }] } },
        head: { name: '초승달 관', look: '은빛 초승달 머리 장식', skill: 'fsMoonFall', desc: '필살기 월식 낙하: 달이 떨어져 큰 폭발 + 8초 달빛 장판 (적 냉기·피해, 나 공격 속도 +30%)' },
        body: { name: '월광 드레스', look: '보라 밤빛 드레스와 은빛 달무늬', skill: 'fsMoonBlessing', desc: '달의 가호: 6초 보호막 (최대 체력 30%) + 필살기 게이지 초당 +2%' },
        arm: { name: '쌍월 검', look: '초승달 모양 쌍검', skill: 'fsMoonSlash', desc: '기본 공격 쌍월 베기 (X자 2연, 냉기) · 월광 일섬: 앞으로 베고 지나감 → 1초 뒤 달빛 폭발',
            kitAttack: { kind: 'multi', n: 2, gap: 0.1, vfx: V.xcut(40, 120, { dur: 0.25 }), status: { chill: 1 } } },
        leg: { name: '월보 구두', look: '달빛 자국이 남는 구두', desc: '달빛 걸음: 기본 공격 5번째마다 달빛 참격 (관통)',
            passive: { name: '달빛 걸음', desc: '기본 공격 5번째마다 달빛 참격 (관통)', every: { n: 5, step: { do: 'line', dmg: 1.2, pierce: 0.3, decay: 0.9, vfx: V.beam(MOON, 12) } } } },
        skills: {
            fsMoonFall: { name: '월식 낙하', slot: 'head', ult: true, cd: 0, icon: 'crescent', color: '#dce6ff', target: 'enemy', range: 450, clip: 'raise',
                desc: '달이 떨어져 큰 폭발 + 8초 달빛 장판 (적 냉기·피해, 나 공격 속도 +30%)',
                steps: [{ at: 0.3, do: 'fx', x: 240, vfx: V.sheet('moon_fall', 520, { anchorY: 0.85, dur: 1.0 }) },
                    { at: 1.0, do: 'hit', pick: 'all', range: 450, dmg: 3, knock: 1.2, status: { chill: 2 } }, { at: 1.0, do: 'shake', power: 10, ms: 450 },
                    { at: 1.0, do: 'custom', fn: moonImpact, preview: moonImpact.preview },
                    { at: 1.0, do: 'zone', tag: 'moon', field: 'moon', x: 60, w: 400, sec: 8, dps: 0.3, status: { chill: 1 }, every: 1 },
                    { at: 1.0, do: 'buff', key: 'moonLight', sec: 8, mods: { atkSpd: 0.3 } }] },
            fsMoonBlessing: { name: '달의 가호', slot: 'body', cd: 15, icon: 'shield', color: '#dce6ff', target: 'self', clip: 'cast',
                desc: '6초간 보호막 (최대 체력 30%) + 필살기 게이지 초당 +2%',
                steps: [{ do: 'shield', ratio: 0.3, sec: 6, color: MOON }, { at: 1, do: 'gauge', add: 0.02, repeat: 6, repeatGap: 1 }, { do: 'custom', fn: moonGuard, sec: 6, preview: moonGuard.preview }] },
            fsMoonSlash: { name: '월광 일섬', slot: 'arm', cd: 9, icon: 'sword', color: '#dce6ff', target: 'enemy', range: 300, clip: 'dashSlash',
                desc: '앞으로 베고 지나감 → 1초 뒤 같은 자리에 달빛 폭발',
                steps: [{ at: 0.2, do: 'custom', fn: moonSlashFx, preview: moonSlashFx.preview },
                    { at: 0.2, do: 'blink', dist: 220, dmg: 1.5, status: { chill: 1 }, hitVfx: V.xcut(40, 160) },
                    { at: 1.2, do: 'hit', pick: 'all', range: 160, dmg: 1.5, knock: 0.8, vfx: ICE_HIT(110, { hue: 40 }) }] }
        }
    }
]);
