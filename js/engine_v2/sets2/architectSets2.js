/* ==========================================================================
   PROJECT: MAD OVERLORD // 철거의 설계자 — 기본·강화 파츠 8개 + 세트 9개 (새 캐릭터 5, D-079 — MD/새캐릭터2종_설계안.md 2~4장)
   기본·강화 파츠도 부품 스킬(skillKit_v2.js)로: 기본 공격 공압 드릴 · 기초 파쇄 · 강제 재건(철골 바리케이드 = 그림 있는 강철 벽 장판) · 철거 명령 · 안전화
   레어 ① 현장 반장(a) · ② 폭파 기술자(b) · ③ 크레인 기사(c) · ④ 측량 설계사(d) · 유니크 ① 불도저 장갑(u) · ② 타워크레인 거신(v) · ③ 유압 해체 집게(w)
   · 레전더리 ① 대재건의 건축왕(l) · ② 종말의 해체 거신(m)
   세트 그림은 강화 그림 + 세트 색. 동작은 rig/architectRig.js (slam·cast·swing·throw). 대표 시트는 vfxPlayer.js VFX_SHEETS (Gemini 전엔 임시)
   ========================================================================== */

import { packOf, basePackOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';
import { sound } from '../audio/sound_v2.js';
import { stageOf, previewStage, tgtOf, previewTargets, withPreview } from '../vfx/stageFx.js';

const SPARK = '255, 170, 60', STEEL = '200, 215, 235', BLUE = '120, 190, 255', GOLD = '255, 205, 90', RED = '255, 80, 60';
const SCAFFOLD = { cls: 'is-scaffold', w: 110, h: 170, dx: -30 };   // 철골 바리케이드 그림 (ui_v2.css, 장판 오른쪽 끝이 벽)
const isUnit = e => !e.isBuilding && !e.isBarricade;
const onScreenUnits = b => b.enemies.filter(e => isUnit(e) && e.x - b.monsterX < 1200);

// ==== D-148 (2026-11-18): 철거의 설계자 스킬 이펙트를 설명대로 — 떨어지는 것은 하늘에서 떨어지고, 던지는 것은 날아가고, 매다는 것은 줄이 보이게 ====
// 물건 그림 arch_set (Gemini 흰 배경 4×2 → build_saint_set.py arch_set 4 2 256, 불투명): 0 렌치 · 1 다이너마이트 · 2 크레인 훅 · 3 황금 말뚝 · 4 불도저 삽날
//   · 5 시한폭탄 · 6 측량 레이저 수준기 · 7 경고 표지판
const DIRT = '190, 160, 120', TEAL = '90, 220, 210';
// 11-18 피드백(삽날 방패가 캐릭터 도트보다 너무 고운 그림): 모든 물건을 도트판 arch_set_px로 (D-149)
const AS = (f, size, o = {}) => spr('arch_set_px', size, { frameRange: [f, f], blend: 'normal', glow: 0, ...o });
const DUST = (w = 120, at = 0) => ({ type: 'dustCloud', at, dur: 1, w, h: w * 0.4, color: DIRT, alpha: 0.6 });
const ROCKS = (n = 10, speed = 280, at = 0, color = '120, 100, 80') => ({ type: 'shards', at, count: n, speed, angle: -1.57, cone: 1.4, size: 5, spin: 8, life: [0.6, 1.1], floor: 0, color });
const CRACKS = (len = 90, color = SPARK) => ({ type: 'cracks', at: 0, dur: 1.2, count: 6, len, color });
const SHOCK = (r = 140, color = SPARK) => ({ type: 'shockwave', at: 0, dur: 0.4, r, width: 8, ground: true, color });
const CHAIN = (sec, color = STEEL, w = 4) => fxOf({ type: 'threadPath', at: 0, dur: sec, mode: 'chain', color, w, sag: 5 });
// 떨어질 자리: 적이 있으면 적 자리 먼저, 없으면 앞쪽 [a, z] 사이 (rain 단계와 같은 규칙)
function dropSpots(b, n, a, z) {
    const ts = pickTargets(b, 'random', n, z);
    return Array.from({ length: n }, (_, i) => ts[i] ? () => aimAt(ts[i]).x + (Math.random() - 0.5) * 20 : (r => () => b.frontX() + a + r * (z - a))(Math.random()));
}
const pvSpots = (S, n) => { const ds = S.api.dummies; return Array.from({ length: n }, (_, i) => () => ds[i % ds.length].x + ((i * 37) % 60 - 30) * S.k); };
/** 하늘에서 떨어짐: fall(dur) 그림이 (x + dx, h0) → (x, 0), 닿으면 land 그림 + onHit(x) */
function playDrop(S, x, fall, land, o = {}) {
    const sec = o.sec ?? 0.3, h0 = o.h0 ?? 560;
    if (o.shadow) S.play(fxOf({ type: 'mist', at: 0, dur: sec, r: o.shadow, h: 10, life: sec, drift: 0, color: '30, 25, 20' }), x, 0);
    S.play(fall(sec), x + (o.dx ?? 0) * S.k, h0, { to: [x, o.toH ?? 0] });
    S.later(sec, () => { S.play(land, x, 0); o.onHit?.(x); });
}

// ---- 기본 ----
// 철거 명령 (필살기): 예전엔 철구 그림이 제자리에서 → 크레인 철구가 왼쪽 위 하늘에서 사슬을 끌며 휘둘러 내려와 앞쪽을 세 번 내리침(땅 금·돌·먼지·충격 고리)
const BALL_FALL = sec => fxOf(spr('crane_ball', 280, { frameRange: [1, 2], dur: sec, anchorY: 0.75, travel: true, upright: true, glow: 0.8 }));
const BALL_LAND = fxOf(spr('crane_ball', 300, { frameRange: [3, 8], dur: 0.7, anchorY: 0.95 }), CRACKS(110), ROCKS(12, 320), DUST(170, 0.05), SHOCK(170));
function demolish(b, ctx, s) {
    const S = stageOf(b);
    dropSpots(b, s.count, 60, 380).forEach((xf, i) => S.later(i * s.every, () => playDrop(S, xf(), BALL_FALL, BALL_LAND, { sec: 0.32, dx: -260, h0: 520, onHit: x => {
        enemiesNear(b, x, s.radius).forEach(e => kitHit(b, e, s.dmg, { baseMul: s.baseMul, knock: 0.9 }));
        if (s.sfx) sound.play(s.sfx, { vol: 0.6 });
        b.director.shake(9, 220);
    } })));
}
demolish.preview = api => { const S = previewStage(api); pvSpots(S, 3).forEach((xf, i) => S.later(i * 0.45, () => playDrop(S, xf(), BALL_FALL, BALL_LAND, { sec: 0.32, dx: -260, h0: 520 }))); };
// 강제 재건: 철골이 솟는 그림에 용접 불티를 더하고, 끝날 때 철골이 넘어지며 먼지·돌 (예전엔 땅 충격 그림만)
const SCAFFOLD_UP = fxOf(spr('steel_scaffold', 230, { anchorY: 0.95, dur: 0.7 }), { type: 'sparks', at: 0.1, count: 10, speed: 220, life: [0.3, 0.6], color: SPARK }, DUST(110, 0.05));
const SCAFFOLD_FALL = fxOf(spr('steel_beam', 230, { frameRange: [5, 8], dur: 0.8, anchorY: 0.92 }), V.impact(0, 200).layers, ROCKS(10, 260), DUST(160));
// 기초 파쇄: 예전엔 작은 불티 → 드릴이 박힌 자리에서 땅이 크게 터지고(돌·금·먼지·충격 고리)
const FOUNDATION_BURST = fxOf(spr('drill_burst', 250, { anchorY: 0.88, dur: 0.6 }), CRACKS(100), ROCKS(10, 300), DUST(150, 0.05), SHOCK(150));

// ---- 현장 반장 ----
// 안전 점검 (필살기): 예전엔 경광등 한 번 + 작은 고리 → 안전모 위 경광등이 1.2초 돌며 빛을 뿌리고, 화면 적마다 머리 위 경고 표지판이 4초 흔들림(감속·취약), 나는 6초 주황 빛
const SIREN = fxOf(spr('safety_siren', 170, { frameRange: [1, 5], dur: 1.2, loopSec: 0.4 }), spr('safety_siren', 70, { frameRange: [8, 8], dur: 1.2, blend: 'normal', glow: 0, anchorY: 0.75 }));
const WARN_SIGN = sec => fxOf(AS(7, 46, { dur: sec, popIn: 0.25, fadeOut: 0.3, swing: { amp: 0.18, speed: 6, decay: 0.4 }, anchorY: 0.95 }));
const GUARD = (sec, color, r = 100) => fxOf({ type: 'candleGlow', at: 0, dur: sec, r, ground: true, color });
function playInspection(S, list, head) {
    S.play(SIREN, ...head(), { follow: head });
    S.play(GUARD(6, SPARK), S.me(), 0, { follow: () => [S.me(), 0] });
    list.slice(0, 12).forEach((t, i) => S.later(0.1 + i * 0.04, () => { const p = () => [t.pos()[0], t.pos()[1] + 62]; S.play(WARN_SIGN(4), ...p(), { follow: p, alive: t.ok }); }));
}
const inspectionFx = withPreview((b, ctx, s) => playInspection(stageOf(b), onScreenUnits(b).map(e => tgtOf(b, e)), () => [b.monsterX + 44, 200]),
    (S, api) => playInspection(S, previewTargets(api), () => [S.me() + 6 * S.k, 200]));
// 안전 펜스: 펜스가 서며 먼지 + 펜스에 경고 표지판이 걸림 (예전엔 그림 벽만)
function playFence(S, x, sec) {
    S.play(fxOf(DUST(110), { type: 'sparks', at: 0, count: 8, speed: 200, life: [0.3, 0.5], color: SPARK }), x, 0);
    S.play(fxOf(AS(7, 52, { dur: sec, popIn: 0.2, fadeOut: 0.3, swing: { amp: 0.1, speed: 5, decay: 1 }, anchorY: 0.1 })), x, 112);
}
const fenceFx = withPreview((b, ctx, s) => playFence(stageOf(b), b.frontX() + 55, s.sec), S => playFence(S, S.front() + 55 * S.k, 2.5));
// 렌치 강타: 예전엔 주먹 그림 → 큰 렌치를 머리 위에서 앞으로 휘둘러 내려침(손잡이 끝을 축으로 돎), 맞은 적 머리 위에 2초 어지러운 별
const WRENCH = fxOf(AS(0, 150, { dur: 0.24, anchorX: 0.86, anchorY: 0.86, angle: -0.2, spin: 12, fadeOut: 0.06 }));
const DIZZY = sec => fxOf({ type: 'swirl', at: 0, dur: sec, r: 22, arms: 3, spin: 6, color: '255, 230, 120' });
const WRENCH_HIT = fxOf(V.punch(180, 140).layers, { type: 'sparks', at: 0, count: 8, speed: 240, life: [0.2, 0.4], color: SPARK });
function playWrench(S, t) {
    S.play(WRENCH, S.me() + 24 * S.k, 104);
    S.later(0.2, () => { S.play(WRENCH_HIT, ...t.pos()); const p = () => [t.pos()[0], t.pos()[1] + 56]; S.play(DIZZY(2), ...p(), { follow: p, alive: t.ok }); });
}
function wrench(b, ctx, s) {
    const e = pickTargets(b, 'nearest', 1, s.range)[0];
    if (!e) return;
    playWrench(stageOf(b), tgtOf(b, e));
    b.schedule(0.2, () => { if (b.enemies.includes(e)) kitHit(b, e, s.dmg, { status: { stun: 2 }, knock: 0.8 }); b.director.shake(4, 150); });
}
wrench.preview = api => playWrench(previewStage(api), previewTargets(api)[0]);

// ---- 폭파 기술자 ----
// 연쇄 발파 (필살기): 예전엔 폭발만 차례로 → 앞쪽에 다이너마이트 6개가 꽂혀 심지가 타들어 가다 하나씩 차례로 폭발(돌·먼지·흔들림)
const DYNAMITE = sec => fxOf(AS(1, 84, { dur: sec, anchorY: 0.92, popIn: 0.15 }), { type: 'motes', at: 0, count: Math.round(sec * 14), spread: 6, rise: [20, 50], life: [0.2, 0.4], size: 1.8, color: '255, 220, 120', dy: -78 });
const DYN_BLAST = fxOf(spr('dynamite_blast', 200, { frameRange: [3, 8], dur: 0.6, anchorY: 0.85 }), ROCKS(8, 300), DUST(120, 0.1));
function playChainBlast(S, xs, onBoom) {
    xs.forEach((x, i) => {
        const fuse = 0.5 + i * 0.22;
        S.later(i * 0.05, () => S.play(DYNAMITE(fuse - i * 0.05), x, 0));
        S.later(fuse, () => { S.play(DYN_BLAST, x, 0); onBoom?.(x); });
    });
}
function chainBlast(b, ctx, s) {
    playChainBlast(stageOf(b), dropSpots(b, 6, 60, 420).map(f => f()), x => {
        enemiesNear(b, x, 80).forEach(e => kitHit(b, e, 1.3, { baseMul: 1.5, knock: 0.6 }));
        sound.play('mech_missile_blast', { vol: 0.5 });
        b.director.shake(4, 140);
    });
}
chainBlast.preview = api => { const S = previewStage(api); playChainBlast(S, pvSpots(S, 6).map(f => f())); };
// 발파 준비: 예전엔 불티 → 6초 동안 다이너마이트 셋이 몸 둘레를 돌고(심지 불꽃) 발밑 붉은 빛, 끝날 때 다이너마이트 폭발
const VEST = sec => fxOf(...[0, 2.1, 4.2].map(ph => AS(1, 54, { dur: sec, orbit: { r: 58, ry: 16, speed: 3, phase: ph }, dy: -86, fadeIn: 0.2, fadeOut: 0.3 })),
    GUARD(sec, RED, 90).layers);
const VEST_BOOM = fxOf(spr('dynamite_blast', 300, { frameRange: [3, 8], dur: 0.7, anchorY: 0.85 }), ROCKS(14, 360), DUST(200, 0.1), SHOCK(200, RED));
const blastReadyFx = withPreview((b, ctx, s) => { const me = () => [b.monsterX + 38, 0]; stageOf(b).play(VEST(s.sec), ...me(), { follow: me }); },
    S => S.play(VEST(2.5), S.me(), 0));
// 설치 폭탄: 예전엔 바닥에 작은 빛 → 시한폭탄을 앞에 던져 놓고(포물선) 1.2초 동안 붉은 등이 깜빡이다 크게 폭발
const BOMB_FLY = sec => fxOf(AS(5, 58, { dur: sec, travel: true, upright: true, arc: 60, spin: 8 }));
const BOMB_SIT = sec => fxOf(AS(5, 78, { dur: sec, anchorY: 0.9 }), ...[0, 0.3, 0.6, 0.85, 1.05].filter(t => t < sec).map(t => ({ type: 'flash', at: t, dur: 0.12, r: 26, color: RED, dy: -68 })));
const BOMB_BOOM = fxOf(spr('dynamite_blast', 230, { frameRange: [3, 8], dur: 0.6, anchorY: 0.85 }), ROCKS(10, 320), DUST(150, 0.1), SHOCK(150, RED));
function playPlantBomb(S, x, sec) {
    const fly = 0.25;
    S.play(BOMB_FLY(fly), S.me() + 40 * S.k, 110, { to: [x, 26] });
    S.later(fly, () => S.play(BOMB_SIT(sec - fly), x, 0));
}
const plantBombFx = withPreview((b, ctx, s) => playPlantBomb(stageOf(b), b.frontX() + 140, 1.2),
    S => { const x = S.front() + 140 * S.k; playPlantBomb(S, x, 1.2); S.later(1.2, () => S.play(BOMB_BOOM, x, 0)); });

// ---- 크레인 기사 · 타워크레인 거신 ----
// 철골 낙하·철골 폭우 (필살기): 예전엔 철골 그림이 제자리에서 → 철골이 하늘에서 비스듬히 떨어져 땅에 꽂히며 불티·돌·먼지 (그림자 먼저)
const BEAM_FALL = sec => fxOf(spr('steel_beam', 210, { frameRange: [1, 2], dur: sec, anchorY: 0.92, travel: true, upright: true, glow: 0.7 }));
const BEAM_LAND = fxOf(spr('steel_beam', 210, { frameRange: [3, 8], dur: 0.6, anchorY: 0.92 }), ROCKS(6, 240), DUST(100, 0.05));
function beamRain(b, ctx, s) {
    const S = stageOf(b);
    dropSpots(b, s.count, s.x[0], s.x[1]).forEach((xf, i) => S.later(i * s.every, () => playDrop(S, xf(), BEAM_FALL, BEAM_LAND, { sec: 0.28, dx: 60, shadow: 40, onHit: x => {
        enemiesNear(b, x, s.radius).forEach(e => kitHit(b, e, s.dmg, { status: s.status, knock: 0.5 }));
        b.director.shake(s.shake || 2, 120);
    } })));
}
beamRain.preview = api => { const S = previewStage(api); pvSpots(S, 8).forEach((xf, i) => S.later(i * 0.18, () => playDrop(S, xf(), BEAM_FALL, BEAM_LAND, { sec: 0.28, dx: 60, shadow: 40 }))); };
// 훅 끌어올리기: 예전엔 번개 줄 → 손에서 쇠사슬 끝 크레인 훅이 날아가 먼 적 셋을 걸고, 사슬에 끌려 앞으로 옴
const HOOK = sec => fxOf(AS(2, 82, { dur: sec, anchorY: 0.75, fadeOut: 0.1 }));
function playHook(S, t, fly, hold) {
    const hand = () => [S.me() + 46 * S.k, 120];
    const hookAt = () => [t.pos()[0], t.pos()[1] + 30];
    S.play(fxOf(AS(2, 82, { dur: fly, travel: true, upright: true, anchorY: 0.75 })), ...hand(), { to: hookAt() });
    S.play(CHAIN(fly + hold), ...hand(), { path: () => [hand(), hookAt()], alive: t.ok });
    S.later(fly, () => S.play(HOOK(hold), ...hookAt(), { follow: hookAt, alive: t.ok }));
}
function hookLift(b, ctx, s) {
    const S = stageOf(b), fly = 0.22;
    pickTargets(b, 'farthest', s.n, s.range).forEach((e, i) => {
        playHook(S, tgtOf(b, e), fly, s.sec + 0.1);
        b.schedule(fly, () => {
            if (!b.enemies.includes(e)) return;
            if (isUnit(e) && !e.boss && b.pullEnemy) b.pullEnemy(e, b.frontX() + s.to + i * 30, s.sec);
            b.schedule(s.sec, () => { if (b.enemies.includes(e)) { kitHit(b, e, s.dmg, { status: s.status, knock: 0 }); b.kitPushed?.(e); } });
        });
    });
}
hookLift.preview = api => { const S = previewStage(api); previewTargets(api).slice(-3).forEach(t => playHook(S, t, 0.22, 0.6)); };
// 철구 스윙: 예전엔 땅 충격 그림 줄 → 사슬 달린 철구가 앞으로 휩쓸며 날아가고(흙먼지 꼬리), 끝에서 부딪혀 터짐
const BALL_SWING = (sec) => fxOf(spr('crane_ball', 170, { frameRange: [1, 2], dur: sec, loopSec: 0.2, travel: true, upright: true, arc: -18, anchorY: 0.7, glow: 0.6 }));
const SWING_DUST = fxOf(spr('bulldozer_dust', 110, { frameRange: [1, 4], dur: 0.5, anchorY: 0.85, alpha: 0.7 }));
function playWreckSwing(S, x0, dist, speed) {
    const sec = dist / (speed * S.k);
    S.play(BALL_SWING(sec), x0, 60, { to: [x0 + dist, 50] });
    for (let t = 0.08; t < sec; t += 0.1) S.later(t, () => S.play(SWING_DUST, x0 + dist * (t / sec), 0));
    S.later(sec, () => S.play(fxOf(spr('crane_ball', 200, { frameRange: [3, 6], dur: 0.45, anchorY: 0.9 }), ROCKS(6, 220)), x0 + dist, 0));
}
const wreckSwingFx = withPreview((b, ctx, s) => playWreckSwing(stageOf(b), b.frontX() - 40, s.dist, s.speed), S => playWreckSwing(S, S.front(), 260 * S.k, 480));

// ---- 측량 설계사 ----
// 정밀 측량 (필살기): 예전엔 설계도 격자 한 번 → 발 앞에 측량 레이저 수준기가 서서 10초 동안 앞으로 푸른 레이저 선을 쏘고, 발밑에 설계도 격자가 깔림
const SURVEY = sec => fxOf(spr('blueprint_grid', 260, { frameRange: [0, 6], dur: 0.9, anchorY: 0.9 }),
    spr('blueprint_grid', 220, { at: 0.8, frameRange: [1, 2], dur: sec - 0.8, loopSec: 1.2, pingPong: true, anchorY: 0.9, alpha: 0.45, fadeOut: 0.5 }));
const LEVEL = sec => fxOf(AS(6, 66, { dur: sec, anchorY: 0.95, popIn: 0.25, fadeOut: 0.4 }));
const LASER = sec => fxOf({ type: 'beam', at: 0, dur: sec, w: 2.2, color: BLUE });
function playSurvey(S, sec, far) {
    const me = () => [S.me(), 0], lv = () => [S.me() + 64 * S.k, 0];
    S.play(SURVEY(sec), ...me(), { follow: me });
    S.play(LEVEL(sec), ...lv(), { follow: lv });
    S.later(0.3, () => S.play(LASER(sec - 0.3), lv()[0], 52, { to: [lv()[0] + far, 52], follow: () => [lv()[0], 52] }));
}
const surveyFx = withPreview((b, ctx, s) => playSurvey(stageOf(b), s.sec, 900), S => playSurvey(S, 3, 600 * S.k));
// 도면 투영: 예전엔 금빛 번쩍 → 머리 위에서 푸른 투영 빛이 적마다 뻗어 설계도 선(철탑 도면)이 몸에 그려지고, 6초 동안 조준 표식
const PROJ_BEAM = fxOf({ type: 'beam', at: 0, dur: 0.5, w: 5, color: BLUE });
const BLUEPRINT_ON = fxOf(spr('blueprint_grid', 140, { frameRange: [3, 6], dur: 0.7, anchorY: 0.6 }));
const MARK = sec => fxOf({ type: 'reticle', at: 0, dur: sec, r: 30, color: BLUE });
function playProjection(S, list) {
    const eye = [S.me() + 20 * S.k, 168];
    list.slice(0, 8).forEach((t, i) => S.later(i * 0.05, () => {
        S.play(PROJ_BEAM, ...eye, { to: t.pos() });
        S.play(BLUEPRINT_ON, ...t.pos());
        S.play(MARK(6), ...t.pos(), { follow: t.pos, alive: t.ok });
    }));
}
function projection(b, ctx, s) {
    const list = pickTargets(b, 'all', 99, s.range);
    playProjection(stageOf(b), list.map(e => tgtOf(b, e)));
    list.forEach(e => kitHit(b, e, s.dmg, { status: s.status }));
}
projection.preview = api => playProjection(previewStage(api), previewTargets(api));
// 레이저 재단: 손에 수준기를 들어 레이저를 쏨 (레이저 선은 그대로 + 수준기·끝 불티)
const LASER_DEVICE = fxOf(AS(6, 50, { dur: 0.6, popIn: 0.15, fadeOut: 0.2, angle: 0 }), { type: 'flash', at: 0, dur: 0.15, r: 30, color: BLUE, dx: 20 });

// ---- 불도저 장갑 ----
// 평탄화 돌진 (필살기): 예전엔 흙먼지만 → 몸 앞에 큰 불도저 삽날이 붙어 흙더미를 밀며 돌진(흙덩이·먼지)
// 삽날 그림은 오목한 면이 왼쪽 → 앞(오른쪽)을 보게 좌우 뒤집음 (11-18 피드백)
const BLADE = (sec, size = 230) => fxOf(AS(4, size, { dur: sec, anchorY: 0.92, fadeOut: 0.15, flipX: true }));
const PILE = sec => fxOf(spr('bulldozer_dust', 170, { frameRange: [2, 4], dur: sec, loopSec: 0.4, pingPong: true, anchorY: 0.88, alpha: 0.85 }), ROCKS(10, 200));
function playBulldoze(S, sec) {
    const front = () => [S.me() + 92 * S.k, 0], pile = () => [S.me() + 190 * S.k, 0];
    S.play(PILE(sec + 0.2), ...pile(), { follow: pile });
    S.play(BLADE(sec + 0.2), ...front(), { follow: front });
}
const bulldozeFx = withPreview((b, ctx, s) => playBulldoze(stageOf(b), 0.45), S => playBulldoze(S, 0.8));
// 삽날 방패: 예전엔 오라 → 6초 동안 몸 앞에 불도저 삽날이 방패처럼 서고(주황 빛), 날아오는 것을 막을 때 불티
const BLADE_GUARD = sec => fxOf(AS(4, 130, { dur: sec, anchorY: 0.92, popIn: 0.25, fadeOut: 0.4, flipX: true }), GUARD(sec, '255, 170, 60', 80).layers);
function playBladeShield(S, sec) {
    const p = () => [S.me() + 60 * S.k, 0];
    S.play(BLADE_GUARD(sec), ...p(), { follow: p });
    for (let t = 0.6; t < sec; t += 1.2) S.later(t, () => S.play(fxOf({ type: 'sparks', at: 0, count: 6, speed: 200, life: [0.2, 0.4], color: SPARK }), p()[0] + 30 * S.k, 70));
}
const bladeShieldFx = withPreview((b, ctx, s) => playBladeShield(stageOf(b), s.sec), S => playBladeShield(S, 2.5));
// 흙더미 밀어내기: 예전엔 땅 충격 그림 → 삽날이 앞으로 밀고 나가며 흙더미가 굴러가 적을 덮침(흙덩이·먼지)
const DIRT_WAVE = sec => fxOf(spr('bulldozer_dust', 200, { frameRange: [1, 5], dur: sec + 0.3, anchorY: 0.88, travel: true, upright: true }), ROCKS(12, 220));
function playDirtPush(S) {
    const x0 = S.front();
    S.play(fxOf(AS(4, 130, { dur: 0.35, anchorY: 0.92, travel: true, upright: true, fadeOut: 0.12, flipX: true })), x0 - 20 * S.k, 0, { to: [x0 + 60 * S.k, 0] });
    S.play(DIRT_WAVE(0.35), x0 + 30 * S.k, 0, { to: [x0 + 220 * S.k, 0] });
}
const dirtPushFx = withPreview((b, ctx, s) => playDirtPush(stageOf(b)), S => playDirtPush(S));

// ---- 타워크레인 거신 ----
// 평형추 낙하: 예전엔 평형추 그림이 제자리 → 바닥에 그림자가 커지고 거대한 평형추가 하늘에서 떨어져 땅이 갈라짐(돌·먼지·큰 충격 고리)
const WEIGHT_FALL = sec => fxOf(spr('counterweight', 280, { frameRange: [1, 2], dur: sec, anchorY: 0.95, travel: true, upright: true }));
const WEIGHT_LAND = fxOf(spr('counterweight', 320, { frameRange: [3, 8], dur: 0.8, anchorY: 0.95 }), CRACKS(130), ROCKS(14, 340), DUST(220, 0.05), SHOCK(200));
function counterweight(b, ctx, s) {
    const S = stageOf(b), x = dropSpots(b, 1, 120, 300)[0]();
    playDrop(S, x, WEIGHT_FALL, WEIGHT_LAND, { sec: 0.4, h0: 620, shadow: 90, onHit: cx => {
        enemiesNear(b, cx, s.radius).forEach(e => kitHit(b, e, s.dmg, { status: { stun: 2 }, knock: 0.8 }));
        b.director.shake(9, 260);
    } });
}
counterweight.preview = api => { const S = previewStage(api); playDrop(S, api.dummies[1].x, WEIGHT_FALL, WEIGHT_LAND, { sec: 0.4, h0: 620, shadow: 90 }); };
// 훅 연쇄: 예전엔 번개 줄 → 쇠사슬이 적 넷을 차례로 꿰어 2초 묶고, 적마다 크레인 훅이 걸려 있음
function hookChainTrail(b, s, order, start) {
    const S = stageOf(b), ts = order.map(e => tgtOf(b, e)), st = [start[0], start[1] - FOOT_B];
    S.play(CHAIN(2.2), ...st, { path: () => [st, ...ts.filter(t => t.ok()).map(t => t.pos())] });
    ts.forEach((t, i) => S.later(i * (s.gap ?? 0.08), () => { const p = () => [t.pos()[0], t.pos()[1] + 30]; S.play(HOOK(2), ...p(), { follow: p, alive: t.ok }); }));
}
hookChainTrail.preview = api => {
    const S = previewStage(api), ts = previewTargets(api, 4), st = [S.me() + 46 * S.k, 120];
    S.play(CHAIN(2), ...st, { path: () => [st, ...ts.map(t => t.pos())] });
    ts.forEach(t => S.play(HOOK(2), t.pos()[0], t.pos()[1] + 30));
};

// ---- 유압 해체 집게 ----
// 해체 분쇄 (필살기): 예전엔 집게 그림이 쥘 때마다 → 거대 유압 집게가 가장 강한 적을 위에서 붙잡고(벌린 채 내려와 물고 있음), 쥘 때마다 청록 터짐·파편, 마지막에 크게 터짐
// 집게 그림(crusher_claw)은 왼쪽을 보고 벌어짐 → 적 쪽(오른쪽)을 보게 좌우 뒤집음 (11-18 피드백)
const CLAW_HOLD = sec => fxOf(spr('crusher_claw', 200, { frameRange: [1, 2], dur: sec, loopSec: 0.35, pingPong: true, fadeOut: 0.2, flipX: true }));
const SQUEEZE = fxOf(spr('crusher_claw', 200, { frameRange: [3, 4], dur: 0.3, flipX: true }), ROCKS(6, 220, 0, '150, 160, 170'), { type: 'sparks', at: 0, count: 6, speed: 220, life: [0.2, 0.4], color: TEAL });
const CRUSH_END = fxOf(spr('crusher_claw', 230, { frameRange: [4, 8], dur: 0.7, flipX: true }), ROCKS(12, 300, 0, '150, 160, 170'));
function playCrush(S, t, times) {
    const p = () => [t.pos()[0], t.pos()[1] + 30];
    S.play(CLAW_HOLD(times * 0.35 + 0.1), ...p(), { follow: p, alive: t.ok });
    for (let i = 0; i < times; i++) S.later(0.05 + i * 0.35, () => S.play(i === times - 1 ? CRUSH_END : SQUEEZE, ...p()));
}
function crushFx(b, ctx, s) {
    const e = pickTargets(b, 'strongest', 1, s.range)[0];
    if (e) playCrush(stageOf(b), tgtOf(b, e), s.times);
}
crushFx.preview = api => playCrush(previewStage(api), previewTargets(api)[1], 3);
// 과압: 예전엔 오라 → (11-18 다시: 등에서 큰 김 기둥이 솟아 어색) 시전 때 등 펌프에서 짧은 김이 양옆으로 칙 빠지고 청록 압력 고리가 퍼짐,
//   8초 동안 집게 팔에 청록 압력 빛이 맺히고 0.5초마다 펌프 박동처럼 작은 압력 고리 + 불티, 발밑 청록 빛
const PUFF = (dir, at = 0) => ({ type: 'smoke', at, count: 3, spread: 6, spreadY: 4, size: 9, life: [0.35, 0.55], rise: 8, speed: 90, angle: dir > 0 ? 0 : Math.PI, color: '215, 245, 245' });
const PRESSURE_ON = fxOf({ type: 'ring', at: 0, dur: 0.45, r: 95, color: TEAL, width: 5 }, { type: 'flash', at: 0, dur: 0.15, r: 40, color: TEAL },
    PUFF(-1), PUFF(1, 0.05), { type: 'sparks', at: 0, count: 8, speed: 220, life: [0.2, 0.4], color: TEAL });
const PUMP = fxOf({ type: 'ring', at: 0, dur: 0.35, r: 46, color: TEAL, width: 3 }, { type: 'sparks', at: 0, count: 3, speed: 140, life: [0.15, 0.3], color: TEAL });
const ARM_GLOW = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 22, color: TEAL });
function playOverpressure(S, sec) {
    const me = () => [S.me(), 0], back = () => [S.me() - 30 * S.k, 118], arm = () => [S.me() + 44 * S.k, 96], chest = () => [S.me() + 4 * S.k, 96];
    S.play(PRESSURE_ON, ...back());
    S.play(GUARD(sec, TEAL, 80), ...me(), { follow: me });
    S.play(ARM_GLOW(sec), ...arm(), { follow: arm });
    for (let t = 0.5; t < sec - 0.2; t += 0.5) S.later(t, () => S.play(PUMP, ...chest()));
}
const overpressureFx = withPreview((b, ctx, s) => playOverpressure(stageOf(b), s.sec), S => playOverpressure(S, 2.5));
// 움켜잡기: 예전엔 발톱 그림 → 유압 집게가 호스를 끌며 날아가 적을 물고 끌어옴
function playGrab(S, t, fly, hold) {
    const hand = () => [S.me() + 46 * S.k, 110];
    S.play(fxOf(spr('crusher_claw', 120, { frameRange: [1, 1], dur: fly, travel: true, upright: true, flipX: true })), ...hand(), { to: t.pos() });
    S.play(CHAIN(fly + hold, TEAL, 4), ...hand(), { path: () => [hand(), t.pos()], alive: t.ok });
    S.later(fly, () => S.play(fxOf(spr('crusher_claw', 130, { frameRange: [2, 4], dur: hold, flipX: true })), ...t.pos(), { follow: t.pos, alive: t.ok }));
}
function grab(b, ctx, s) {
    const e = pickTargets(b, 'nearest', 1, s.range)[0];
    if (!e) return;
    const fly = 0.15;
    playGrab(stageOf(b), tgtOf(b, e), fly, s.sec + 0.1);
    b.schedule(fly, () => {
        if (!b.enemies.includes(e)) return;
        if (isUnit(e) && !e.boss && b.pullEnemy) b.pullEnemy(e, b.frontX() + s.to, s.sec);
        b.schedule(s.sec, () => { if (b.enemies.includes(e)) { kitHit(b, e, s.dmg, { status: s.status, knock: 0 }); b.kitPushed?.(e); } });
    });
}
grab.preview = api => playGrab(previewStage(api), previewTargets(api)[0], 0.15, 0.4);

// ---- 대재건의 건축왕 ----
// (11-18 다시 조정) 예전 1차는 적마다 황금 비계 빛(scaffold_rise)이 겹쳐 하얗게 번진 띠가 되고, 설계 수정의 철탑 도면이 캐릭터를 덮었음
// 도시 재건 (필살기): 성벽 자리에 금빛 설계도 선이 그려지고 그 위로 황금 철골 비계가 솟음(불티·충격 고리), 적마다 발밑에서 작은 황금 비계가 솟아 찌름,
//   8초 동안 성벽 밑 금빛, 무너질 때 황금 철골이 넘어지며 폭발
const GOLD_SCAFFOLD = (size, at = 0) => spr('steel_scaffold', size, { at, frameRange: [0, 6], dur: 0.8, anchorY: 0.95, hue: 18, glow: 0.5 });
const CITY_WALL = sec => fxOf(spr('blueprint_grid', 260, { frameRange: [1, 5], dur: 0.6, anchorY: 0.9, hue: 190, alpha: 0.8 }), GOLD_SCAFFOLD(280, 0.3),
    SHOCK(260, GOLD), { type: 'sparks', at: 0.35, count: 14, speed: 260, life: [0.3, 0.6], color: GOLD }, DUST(160, 0.35),
    { type: 'candleGlow', at: 0.3, dur: sec, r: 90, ground: true, color: GOLD });
const CITY_RISE = fxOf(GOLD_SCAFFOLD(150), { type: 'sparks', at: 0.1, count: 6, speed: 200, life: [0.2, 0.4], color: GOLD }, DUST(80, 0.1));
const CITY_FALL = fxOf(spr('steel_beam', 260, { frameRange: [5, 8], dur: 0.8, anchorY: 0.92, hue: 15 }), V.blast(20, 240).layers, ROCKS(16, 360, 0, GOLD), DUST(240, 0.1), SHOCK(240, GOLD));
const cityWallFx = withPreview((b, ctx, s) => stageOf(b).play(CITY_WALL(s.sec), b.frontX() + 65, 0), S => S.play(CITY_WALL(2.5), S.front() + 65 * S.k, 0));
// 설계 수정: 발밑에 금빛 설계도 격자가 펼쳐지고(평평한 바닥 격자만 — 철탑 도면은 캐릭터를 덮어 뺌) 마법진, 8초 동안 은은한 금빛 격자
const REVISE = sec => fxOf(spr('blueprint_grid', 260, { frameRange: [0, 2], dur: 0.6, anchorY: 0.9, hue: 190, squash: 0.45 }),   // squash: 세운 판처럼 보이지 않게 바닥에 납작하게
    spr('blueprint_grid', 250, { at: 0.55, frameRange: [1, 2], dur: sec - 0.55, loopSec: 1.2, pingPong: true, anchorY: 0.9, hue: 190, alpha: 0.4, fadeOut: 0.5, squash: 0.45 }),
    { type: 'rune', at: 0, dur: 1.2, r: 100, color: GOLD, spin: 1.2 }, { type: 'motes', at: 0.1, count: 12, spread: 50, rise: [40, 90], life: [0.6, 1], size: 2.2, color: GOLD });
const reviseFx = withPreview((b, ctx, s) => { const me = () => [b.monsterX + 38, 0]; stageOf(b).play(REVISE(s.sec), ...me(), { follow: me }); }, S => S.play(REVISE(2.5), S.me(), 0));
// 기초 말뚝: 예전엔 빛기둥 → 적마다 황금 말뚝이 위에서 내리꽂혀 2초 동안 박혀 있음(금빛 땅 금·불티)
const PILE_FALL = sec => fxOf(AS(3, 130, { dur: sec, anchorY: 0.82, travel: true, upright: true, glow: 1.1 }));
const PILE_STAY = sec => fxOf(AS(3, 130, { dur: sec, anchorY: 0.82, fadeOut: 0.3 }), DUST(70), { type: 'sparks', at: 0, count: 8, speed: 220, life: [0.2, 0.4], color: GOLD }, SHOCK(70, GOLD),
    { type: 'candleGlow', at: 0, dur: sec, r: 34, ground: true, color: GOLD });
function playPiles(S, list, sec) {
    list.forEach((t, i) => S.later(i * 0.06, () => {
        const x = t.foot(), fall = 0.16;
        S.play(PILE_FALL(fall), x + 10 * S.k, 300, { to: [x, 0] });
        S.later(fall, () => S.play(PILE_STAY(sec), x, 0));
    }));
}
function piles(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, s.range);
    playPiles(stageOf(b), list.map(e => tgtOf(b, e)), s.sec);
    list.forEach(e => b.schedule(0.16, () => { if (b.enemies.includes(e)) kitHit(b, e, s.dmg, { status: { root: s.sec } }); }));
}
piles.preview = api => playPiles(previewStage(api), previewTargets(api, 5), 2);

// ---- 종말의 해체 거신 ----
// 최종 철거 (필살기): 예전엔 드릴 그림이 제자리 → 거대 굴착 드릴이 하늘에서 내리꽂혀 땅을 뚫고 터짐(붉은 금·돌·먼지·큰 충격), 세 번
const MEGA_FALL = sec => fxOf(spr('mega_drill', 320, { frameRange: [1, 2], dur: sec, loopSec: 0.12, anchorY: 0.95, travel: true, upright: true }));
const MEGA_LAND = fxOf(spr('mega_drill', 340, { frameRange: [3, 8], dur: 0.8, anchorY: 0.95 }), CRACKS(140, RED), ROCKS(16, 360), DUST(240, 0.05), SHOCK(220, RED));
function finalDemolition(b, ctx, s) {
    const S = stageOf(b);
    dropSpots(b, s.count, 60, 480).forEach((xf, i) => S.later(i * 0.55, () => playDrop(S, xf(), MEGA_FALL, MEGA_LAND, { sec: 0.3, h0: 600, shadow: 80, onHit: x => {
        enemiesNear(b, x, 140).forEach(e => kitHit(b, e, 3.2, { baseMul: 3, knock: 1 }));
        sound.play('base_blast', { vol: 0.6 });
        b.director.shake(10, 260);
    } })));
}
finalDemolition.preview = api => { const S = previewStage(api); pvSpots(S, 3).forEach((xf, i) => S.later(i * 0.55, () => playDrop(S, xf(), MEGA_FALL, MEGA_LAND, { sec: 0.3, h0: 600, shadow: 80 }))); };
// 엔진 과열: 예전엔 불티 → 6초 동안 등의 철거 엔진이 불을 뿜고(배기 불꽃이 연달아) 발밑 붉은 열기, 끝날 때 큰 폭발
const EXHAUST = fxOf(spr('fire_burst', 90, { dur: 0.35, glow: 0.8 }), { type: 'motes', at: 0, count: 4, spread: 10, rise: [40, 80], life: [0.3, 0.5], size: 2, color: '255, 140, 60' });
function playEngineHeat(S, sec) {
    const me = () => [S.me(), 0], pipe = () => [S.me() - 30 * S.k, 150];
    S.play(GUARD(sec, RED, 110), ...me(), { follow: me });
    for (let t = 0; t < sec - 0.2; t += 0.22) S.later(t, () => S.play(EXHAUST, ...pipe()));
}
const engineHeatFx = withPreview((b, ctx, s) => playEngineHeat(stageOf(b), s.sec), S => playEngineHeat(S, 2.5));
const ENGINE_BOOM = fxOf(spr('dynamite_blast', 320, { frameRange: [3, 8], dur: 0.7, anchorY: 0.85 }), ROCKS(14, 360), DUST(220, 0.1), SHOCK(220, RED));
// 지반 붕괴: 예전엔 땅 충격 그림 → 앞쪽 바닥이 갈라져 어두운 구덩이가 2초 동안 열리고, 돌이 쏟아지며 먼지
const SINK = sec => fxOf({ type: 'mist', at: 0, dur: sec, r: 130, h: 18, life: sec, drift: 0, color: '25, 15, 10' }, CRACKS(150, RED),
    V.impact(0, 220).layers, ROCKS(14, 260), DUST(240, 0.05), { type: 'candleGlow', at: 0, dur: sec, r: 140, ground: true, color: '255, 90, 40' });
const sinkholeFx = withPreview((b, ctx, s) => stageOf(b).play(SINK(2), b.frontX() + 130, 0), S => S.play(SINK(2), S.front() + 130 * S.k, 0));

// ---- 기본·강화 파츠 (같은 스킬, 강화는 능력치·그림) ----
const DRILL = { kind: 'melee', n: 3, gap: 0.08, vfx: V.blast(10, 70, { dur: 0.22 }), splash: 50, splashMul: 0.35 };
export const ARCHITECT_BASE = basePackOf('architect', {
    head: [
        { id: 'head_architect', name: '주황 안전모', cost: 400, src: 'head.png', stats: { hp: 700, dps: 60, range: 10, speed: 5 }, skill: 'arDemolish',
            desc: '필살기 철거 명령: 크레인 철구가 앞쪽을 세 번 내리침 (거점 3배)' },
        { id: 'head_architect_up', name: '작업등 안전모', cost: 950, src: 'head_up.png', stats: { hp: 900, dps: 90, range: 20, speed: 5 }, skill: 'arDemolish', up: true,
            desc: '철거 명령 (강화 안전모: 작업등)' }
    ],
    body: [
        { id: 'body_architect', name: '작업 조끼·비계', cost: 450, src: 'torso.png', stats: { hp: 1700, dps: 50, range: 0, speed: 5 }, skill: 'arRebuild',
            desc: '강제 재건: 앞에 철골 바리케이드 6초 — 적 진격을 막고 무너지며 피해' },
        { id: 'body_architect_up', name: '설계도 장갑 조끼', cost: 1000, src: 'torso_up.png', stats: { hp: 2100, dps: 80, range: 0, speed: 5 }, skill: 'arRebuild', up: true,
            desc: '강제 재건 (강화 조끼: 어깨 설계도 통)' }
    ],
    arm: [
        { id: 'arm_architect', name: '공압 드릴', cost: 500, src: 'armF.png', stats: { hp: 400, dps: 450, range: 170, speed: 0 }, skill: 'arFoundation', kitAttack: DRILL,
            desc: '기본 공격 공압 드릴 (3연타·휩쓸기) · 기초 파쇄' },
        { id: 'arm_architect_up', name: '대형 드릴·유압 집게', cost: 1100, src: 'armF_up.png', stats: { hp: 500, dps: 540, range: 190, speed: 0 }, skill: 'arFoundation', kitAttack: DRILL, up: true,
            desc: '큰 드릴 · 기초 파쇄' }
    ],
    leg: [
        { id: 'leg_architect', name: '작업화', cost: 400, src: 'legF.png', stats: { hp: 700, dps: 40, range: 0, speed: 85 },
            desc: '안전화: 거점·바리케이드에 주는 피해 +25%',
            passive: { name: '안전화', desc: '거점·바리케이드에 주는 피해 +25%', target: [{ when: 'building', dmg: 0.25 }] } },
        { id: 'leg_architect_up', name: '강철 작업화', cost: 950, src: 'legF_up.png', stats: { hp: 900, dps: 60, range: 0, speed: 100 }, up: true,
            desc: '안전화 (강화): 거점·바리케이드에 주는 피해 +35%',
            passive: { name: '안전화 (강화)', desc: '거점·바리케이드에 주는 피해 +35%', target: [{ when: 'building', dmg: 0.35 }] } }
    ]
}, {
    arFoundation: { name: '기초 파쇄', slot: 'arm', cd: 9, icon: 'drill', color: '#ff9a2e', target: 'enemy', range: 160, clip: 'slam', sfx: 'arch_drill',
        desc: '드릴을 땅에 박아 앞쪽 지면이 터짐 — 범위 피해 + 1초 기절, 거점 2배',
        steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 170, dmg: 2.2, baseMul: 2, status: { stun: 1 }, knock: 0.8, vfx: fxOf(spr('drill_burst', 140, { anchorY: 0.88, dur: 0.45 })), ground: true },
            { at: 0.45, do: 'shake', power: 6, ms: 220 }, { at: 0.45, do: 'fx', x: 70, vfx: FOUNDATION_BURST }] },
    // 벽은 바닥에 서서 걸을 때 함께 흘러감 → 적이 앞에 있을 때만 씀 (target enemy)
    arRebuild: { name: '강제 재건', slot: 'body', cd: 14, icon: 'scaffold', color: '#ff9a2e', target: 'enemy', range: 160, clip: 'cast', sfx: 'arch_scaffold',
        desc: '앞에 철골 바리케이드 6초 — 보스가 아닌 적은 넘어오지 못함, 끝날 때 무너지며 피해',
        steps: [{ at: 0.45, do: 'zone', tag: 'scaffold', wall: true, x: 40, w: 60, sec: 6, art: SCAFFOLD,
            end: { dmg: 2, radius: 150, vfx: SCAFFOLD_FALL } }, { at: 0.45, do: 'fx', x: 70, vfx: SCAFFOLD_UP }] },
    arDemolish: { name: '철거 명령', slot: 'head', ult: true, cd: 0, icon: 'hammer', color: '#ff9a2e', target: 'enemy', range: 420, clip: 'cast',
        desc: '크레인 철구가 앞쪽을 세 번 내리침 — 큰 피해, 거점 3배',
        steps: [{ at: 0.45, do: 'custom', fn: demolish, count: 3, every: 0.45, radius: 120, dmg: 3, baseMul: 3, vfx: BALL_LAND,   // vfx: 협력 출격(support_v2.js)이 쓰는 대표 그림
            sfx: 'arch_crane', preview: demolish.preview }] }
});

// ---- 세트 9개 ----
export const ARCHITECT_SETS2 = packOf('architect', [
    // ---- 레어 ① 현장 반장 (탱커) ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '현장 반장', style: 'tank', tint: 'sepia(0.4) saturate(1.6) hue-rotate(10deg) brightness(1.1)',
        bonus: { 4: '안전 펜스 +2초' },
        kit: { 4: { patch: { arSafetyFence: { sec: 2 } } } },
        head: { name: '반장 안전모', look: '노란 띠를 두른 반장 안전모, 호루라기', skill: 'arInspection', desc: '필살기 안전 점검: 화면 적 4초 감속 + 취약 20%, 나 6초 받는 피해 -30%' },
        body: { name: '형광 안전 조끼', look: '형광 주황 안전 조끼', skill: 'arSafetyFence', desc: '안전 펜스: 앞에 펜스 벽 5초 + 보호막 20%' },
        arm: { name: '대형 렌치', look: '팔만 한 강철 렌치', skill: 'arWrench', desc: '렌치 강타: 앞 적 하나 2초 기절', kitAttack: DRILL },
        leg: { name: '강철 안전화', look: '강철 코 안전화', desc: '안전 제일: 받는 피해 -10%, 밀려나지 않음',
            passive: { name: '안전 제일', desc: '받는 피해 -10%, 밀려나지 않음', flags: ['knockImmune'], mods: { def: 0.1 } } },
        skills: {
            arInspection: { name: '안전 점검', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#ffc850', target: 'enemy', range: 600, clip: 'cast',
                desc: '화면 적 4초 감속 + 취약 20% — 나 6초 받는 피해 -30%',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { slow: 4, vuln: [4, 0.2] } },
                    { at: 0.45, do: 'buff', key: 'inspection', sec: 6, mods: { def: 0.3 } },
                    { at: 0.45, do: 'custom', fn: inspectionFx, preview: inspectionFx.preview }] },
            arSafetyFence: { name: '안전 펜스', slot: 'body', cd: 14, icon: 'scaffold', color: '#ffc850', target: 'enemy', range: 160, clip: 'cast', p: { sec: 5 },
                desc: '앞에 펜스 벽 5초 (보스가 아닌 적은 못 넘어옴) + 보호막 20%',
                steps: [{ at: 0.45, do: 'zone', tag: 'fence', wall: true, x: 40, w: 50, sec: '$sec', art: { cls: 'is-scaffold is-fence', w: 100, h: 130, dx: -25 },
                    end: { dmg: 1.5, radius: 140, vfx: SCAFFOLD_FALL } }, { at: 0.45, do: 'shield', ratio: 0.2, sec: 5, color: SPARK },
                    { at: 0.45, do: 'custom', fn: fenceFx, sec: '$sec', preview: fenceFx.preview }] },
            arWrench: { name: '렌치 강타', slot: 'arm', cd: 8, icon: 'hammer', color: '#ffc850', target: 'enemy', range: 150, clip: 'swing',
                desc: '앞 적 하나를 렌치로 내려쳐 2초 기절',
                steps: [{ at: 0.2, do: 'custom', fn: wrench, range: 150, dmg: 2.2, preview: wrench.preview }] }
        }
    },

    // ---- 레어 ② 폭파 기술자 (공격) ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '폭파 기술자', style: 'dps', tint: 'hue-rotate(-25deg) saturate(1.8) brightness(0.95)',
        bonus: { 4: '설치 폭탄 폭발 범위 +50%' },
        kit: { 4: { patch: { arPlantBomb: { radius: 60 } } } },
        head: { name: '폭파 고글', look: '붉은 렌즈 폭파 고글', skill: 'arChainBlast', desc: '필살기 연쇄 발파: 앞쪽 다이너마이트 6개가 차례로 폭발' },
        body: { name: '다이너마이트 조끼', look: '다이너마이트를 꽂은 조끼', skill: 'arBlastReady', desc: '발파 준비: 6초 피해 +30%, 끝날 때 둘레 폭발' },
        arm: { name: '기폭 장치 팔', look: '기폭 손잡이가 달린 팔', skill: 'arPlantBomb', desc: '설치 폭탄: 앞에 폭탄 → 1.2초 뒤 범위 폭발', kitAttack: DRILL },
        leg: { name: '방폭 부츠', look: '두꺼운 방폭 부츠', desc: '방폭복: 장판·지속 피해 -30%, 받는 피해 -5%',
            passive: { name: '방폭복', desc: '장판·지속 피해 -30%, 받는 피해 -5%', incoming: [{ when: 'zone', def: 0.3 }], mods: { def: 0.05 } } },
        skills: {
            arChainBlast: { name: '연쇄 발파', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#ff5a3c', target: 'enemy', range: 440, clip: 'cast',
                desc: '앞쪽에 다이너마이트 6개 — 차례로 폭발 (거점 1.5배)',
                steps: [{ at: 0.45, do: 'custom', fn: chainBlast, preview: chainBlast.preview }] },
            arBlastReady: { name: '발파 준비', slot: 'body', cd: 13, icon: 'overdrive', color: '#ff5a3c', target: 'self', clip: 'cast',
                desc: '6초 주는 피해 +30% — 끝날 때 둘레 폭발',
                steps: [{ do: 'buff', key: 'blastReady', sec: 6, mods: { dmg: 0.3, onEnd: { do: 'hit', pick: 'all', range: 200, dmg: 1.8, knock: 1 } } },
                    { do: 'custom', fn: blastReadyFx, sec: 6, preview: blastReadyFx.preview }, { at: 6, do: 'fx', on: 'self', x: 40, vfx: VEST_BOOM }] },
            arPlantBomb: { name: '설치 폭탄', slot: 'arm', cd: 8, icon: 'fire', color: '#ff5a3c', target: 'enemy', range: 200, clip: 'throw', p: { radius: 120 },
                desc: '앞에 폭탄을 던져 1.2초 뒤 범위 폭발',
                steps: [{ at: 0.35, do: 'zone', tag: 'bomb', x: 110, w: 60, sec: 1.2,
                    end: { dmg: 2.8, radius: '$radius', vfx: BOMB_BOOM } }, { at: 0.35, do: 'custom', fn: plantBombFx, preview: plantBombFx.preview }, { at: 1.55, do: 'shake', power: 6, ms: 200 }] }
        }
    },

    // ---- 레어 ③ 크레인 기사 (사거리) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '크레인 기사', style: 'range', tint: 'hue-rotate(15deg) saturate(1.3) brightness(1.05)',
        bonus: { 4: '철골 낙하 +4개' },
        kit: { 4: { patch: { arBeamDrop: { count: 4 } } } },
        head: { name: '크레인 조종 헬멧', look: '무전기 달린 조종 헬멧', skill: 'arBeamDrop', desc: '필살기 철골 낙하: 철골 8개가 떨어짐' },
        body: { name: '크레인 조종복', look: '갈고리 줄을 감은 조종복', skill: 'arHookLift', desc: '훅 끌어올리기: 가장 먼 적 3명을 끌어와 1.5초 기절' },
        arm: { name: '크레인 훅 팔', look: '쇠사슬 끝에 철구를 단 팔', skill: 'arWreckSwing', desc: '철구 스윙: 철구가 앞으로 휩쓸며 밀어냄', kitAttack: DRILL },
        leg: { name: '아웃트리거 다리', look: '받침대가 펼쳐지는 다리', desc: '고정 받침: 멈춰 있으면 주는 피해 +20%',
            passive: { name: '고정 받침', desc: '멈춰 있으면 주는 피해 +20%', self: [{ when: 'still', after: 0.5, mods: { dmg: 0.2 } }] } },
        skills: {
            arBeamDrop: { name: '철골 낙하', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffb450', target: 'enemy', range: 480, clip: 'cast', p: { count: 8 },
                desc: '철골 8개가 앞쪽에 떨어짐 — 맞은 적 피해 + 0.5초 기절',
                steps: [{ at: 0.45, do: 'custom', fn: beamRain, count: '$count', every: 0.2, x: [40, 480], radius: 65, dmg: 1.1, status: { stun: 0.5 }, shake: 3, preview: beamRain.preview }] },
            arHookLift: { name: '훅 끌어올리기', slot: 'body', cd: 13, icon: 'chain', color: '#ffb450', target: 'enemy', range: 400, clip: 'throw',
                desc: '가장 먼 적 3명을 갈고리로 끌어와 1.5초 기절',
                steps: [{ at: 0.35, do: 'custom', fn: hookLift, n: 3, range: 400, to: 40, sec: 0.35, dmg: 0.8, status: { stun: 1.5 }, preview: hookLift.preview }] },
            arWreckSwing: { name: '철구 스윙', slot: 'arm', cd: 8, icon: 'maul', color: '#ffb450', target: 'enemy', range: 240, clip: 'swing',
                desc: '철구가 앞으로 휩쓸며 지나간 적 피해 + 밀어냄',
                steps: [{ at: 0.38, do: 'wave', speed: 480, dist: 260, w: 55, dmg: 1.4, knock: 1.2, push: 40 }, { at: 0.38, do: 'custom', fn: wreckSwingFx, dist: 260, speed: 480, preview: wreckSwingFx.preview }] }
        }
    },

    // ---- 레어 ④ 측량 설계사 (속도) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '측량 설계사', style: 'speed', tint: 'hue-rotate(170deg) saturate(0.9) brightness(1.15)',
        bonus: { 4: '표식 적을 쓰러뜨리면 필살기 게이지 +3%' },
        kit: { 4: { on: [{ when: 'kill', status: 'vuln', gauge: 0.03 }] } },
        head: { name: '측량 고글', look: '눈금 렌즈 측량 고글', skill: 'arSurvey', desc: '필살기 정밀 측량: 10초 피해 +40%, 공격 속도 +20%' },
        body: { name: '설계도 망토', look: '푸른 설계도로 지은 망토', skill: 'arProjection', desc: '도면 투영: 앞 적 6초 표식 (받는 피해 +25%)' },
        arm: { name: '측량 레이저 자', look: '레이저를 쏘는 측량 자', skill: 'arLaserCut', desc: '레이저 재단: 일직선 관통 레이저', kitAttack: DRILL },
        leg: { name: '측량 롤러 신발', look: '바퀴 달린 측량 신발', desc: '빠른 실측: 진격 속도 +12%, 걷는 동안 받는 피해 -15%',
            passive: { name: '빠른 실측', desc: '진격 속도 +12%, 걷는 동안 받는 피해 -15%', mods: { move: 0.12 }, self: [{ when: 'walking', mods: { def: 0.15 } }] } },
        skills: {
            arSurvey: { name: '정밀 측량', slot: 'head', ult: true, cd: 0, icon: 'orbital', color: '#78beff', target: 'self', clip: 'cast',
                desc: '10초간 주는 피해 +40%, 공격 속도 +20%',
                steps: [{ at: 0.45, do: 'buff', key: 'survey', sec: 10, mods: { dmg: 0.4, atkSpd: 0.2 } }, { at: 0.45, do: 'custom', fn: surveyFx, sec: 10, preview: surveyFx.preview }] },
            arProjection: { name: '도면 투영', slot: 'body', cd: 13, icon: 'scaffold', color: '#78beff', target: 'enemy', range: 300, clip: 'cast',
                desc: '앞 적에게 도면을 투영해 6초 표식 — 받는 피해 +25%',
                steps: [{ at: 0.45, do: 'custom', fn: projection, range: 300, dmg: 0.3, status: { mark: [6, 0.25] }, preview: projection.preview }] },
            arLaserCut: { name: '레이저 재단', slot: 'arm', cd: 8, icon: 'laser', color: '#78beff', target: 'enemy', range: 400, clip: 'throw',
                desc: '일직선으로 꿰뚫는 측량 레이저',
                steps: [{ at: 0.3, do: 'fx', on: 'self', x: 50, b: FOOT_B + 100, vfx: LASER_DEVICE }, { at: 0.35, do: 'line', range: 420, dmg: 1.8, decay: 0.9, vfx: V.beam(BLUE, 14) }] }
        }
    },

    // ---- 유니크 ① 불도저 장갑 (탱커) ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '불도저 장갑', style: 'tank', tint: 'sepia(0.7) saturate(2) hue-rotate(5deg) brightness(1.05) drop-shadow(0 0 5px rgba(255, 170, 60, 0.7))',
        bonus: { 2: '삽날 방패 +2초', 4: '평탄화 돌진에 지나간 적 1초 기절' },
        kit: { 2: { patch: { arBladeShield: { sec: 2 } } }, 4: { patch: { arBulldoze: { stun: 1 } } } },
        head: { name: '불도저 조종석', look: '유리 덮개가 달린 조종석 투구', skill: 'arBulldoze', desc: '필살기 평탄화 돌진: 삽날로 앞으로 돌진 — 지나간 적 피해 + 밀어냄' },
        body: { name: '불도저 차체', look: '두꺼운 노랑·주황 차체 갑옷', skill: 'arBladeShield', desc: '삽날 방패: 6초 받는 피해 -50%, 투사체 막음' },
        arm: { name: '삽날 팔', look: '팔에 단 불도저 삽날', skill: 'arDirtPush', desc: '기본 공격 삽날 밀기 (크게 밀침) · 흙더미 밀어내기: 앞 적 전부 밀어내고 감속',
            kitAttack: { kind: 'melee', vfx: V.impact(10, 110, { dur: 0.3 }), knock: 1.4, splash: 70, splashMul: 0.5 } },
        leg: { name: '무한궤도', look: '작은 무한궤도 다리', desc: '무한궤도: 밀려나지 않음, 장판 무시',
            passive: { name: '무한궤도', desc: '밀려나지 않음, 장판 무시', flags: ['knockImmune', 'ignoreHazard'] } },
        skills: {
            arBulldoze: { name: '평탄화 돌진', slot: 'head', ult: true, cd: 0, icon: 'rocket', color: '#ffaa3c', target: 'enemy', range: 300, clip: 'swing', p: { stun: 0 },
                desc: '삽날로 앞으로 돌진 — 지나간 적 피해 + 밀어냄',
                steps: [{ at: 0.25, do: 'dash', dist: 260, sec: 0.45, dmg: 2.2, knock: 1.5, status: { stun: '$stun' }, trail: V.sheet('bulldozer_dust', 160, { anchorY: 0.85, dur: 0.5 }) },
                    { at: 0.3, do: 'push', range: 320, dist: 140, dmg: 0.5 }, { at: 0.3, do: 'shake', power: 7, ms: 300 }, { at: 0.25, do: 'custom', fn: bulldozeFx, preview: bulldozeFx.preview }] },
            arBladeShield: { name: '삽날 방패', slot: 'body', cd: 14, icon: 'shield', color: '#ffaa3c', target: 'self', clip: 'cast', p: { sec: 6 },
                desc: '6초 받는 피해 -50%, 투사체 막음',
                steps: [{ do: 'buff', key: 'bladeShield', sec: '$sec', mods: { def: 0.5, flags: ['projBlock'] } }, { do: 'custom', fn: bladeShieldFx, sec: '$sec', preview: bladeShieldFx.preview }] },
            arDirtPush: { name: '흙더미 밀어내기', slot: 'arm', cd: 9, icon: 'slam', color: '#ffaa3c', target: 'enemy', range: 200, clip: 'swing',
                desc: '앞 적 전부를 흙더미로 밀어내고 3초 감속',
                steps: [{ at: 0.38, do: 'push', range: 220, dist: 160, dmg: 1.2, status: { slow: 3 } }, { at: 0.3, do: 'custom', fn: dirtPushFx, preview: dirtPushFx.preview }] }
        }
    },

    // ---- 유니크 ② 타워크레인 거신 (사거리) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '타워크레인 거신', style: 'range', tint: 'hue-rotate(-10deg) saturate(1.5) brightness(1.1) contrast(1.1)',
        bonus: { 2: '철골 폭우 +6개', 4: '평형추 낙하 범위 +50%' },
        kit: { 2: { patch: { arBeamStorm: { count: 6 } } }, 4: { patch: { arCounterweight: { radius: 75 } } } },
        head: { name: '타워크레인 관제모', look: '꼭대기에 경고등이 달린 관제모', skill: 'arBeamStorm', desc: '필살기 철골 폭우: 철골 16개가 화면에 떨어짐' },
        body: { name: '평형추 코어', look: '등에 거대한 평형추', skill: 'arCounterweight', desc: '평형추 낙하: 거대 평형추 — 큰 범위 피해 + 2초 기절' },
        arm: { name: '지브 팔', look: '크레인 지브 같은 긴 팔', skill: 'arHookChain', desc: '훅 연쇄: 갈고리가 적 4명을 차례로 걸어 묶음', kitAttack: DRILL },
        leg: { name: '크레인 기초 다리', look: '콘크리트 받침 다리', desc: '기초 공사: 멈춰 있으면 받는 피해 -20%',
            passive: { name: '기초 공사', desc: '멈춰 있으면 받는 피해 -20%', self: [{ when: 'still', after: 0.5, mods: { def: 0.2 } }] } },
        skills: {
            arBeamStorm: { name: '철골 폭우', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffb450', target: 'enemy', range: 560, clip: 'cast', p: { count: 16 },
                desc: '철골 16개가 화면에 쏟아짐',
                steps: [{ at: 0.45, do: 'custom', fn: beamRain, count: '$count', every: 0.16, x: [30, 560], radius: 60, dmg: 1, shake: 2, preview: beamRain.preview }] },
            arCounterweight: { name: '평형추 낙하', slot: 'body', cd: 14, icon: 'slam', color: '#ffb450', target: 'enemy', range: 300, clip: 'cast', p: { radius: 150 },
                desc: '거대한 평형추가 떨어짐 — 큰 범위 피해 + 2초 기절',
                steps: [{ at: 0.45, do: 'custom', fn: counterweight, radius: '$radius', dmg: 3, preview: counterweight.preview }] },
            arHookChain: { name: '훅 연쇄', slot: 'arm', cd: 9, icon: 'chain', color: '#ffb450', target: 'enemy', range: 320, clip: 'throw',
                desc: '갈고리가 적 4명을 차례로 걸어 2초 묶음',
                steps: [{ at: 0.35, do: 'chain', n: 4, range: 320, jump: 180, dmg: 1, decay: 0.95, status: { root: 2 }, hitVfx: V.impact(0, 80), trail: hookChainTrail, trailPreview: hookChainTrail.preview }] }
        }
    },

    // ---- 유니크 ③ 유압 해체 집게 (공격) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '유압 해체 집게', style: 'dps', tint: 'hue-rotate(150deg) saturate(0.8) brightness(1.05)',
        bonus: { 2: '해체 분쇄 +1번', 4: '과압 +3초' },
        kit: { 2: { patch: { arCrush: { times: 1 } } }, 4: { patch: { arOverpressure: { sec: 3 } } } },
        head: { name: '유압 투구', look: '유압 호스가 달린 투구', skill: 'arCrush', desc: '필살기 해체 분쇄: 집게로 가장 강한 적을 붙잡아 세 번 쥐어짬' },
        body: { name: '유압 펌프 몸통', look: '펌프가 끓는 몸통 갑옷', skill: 'arOverpressure', desc: '과압: 8초 공격 속도 +40%' },
        arm: { name: '대형 집게', look: '청록 유압 집게 팔', skill: 'arGrab', desc: '움켜잡기: 앞 적 하나 끌어와 2초 기절 + 피해', kitAttack: DRILL },
        leg: { name: '유압 다리', look: '피스톤 다리', desc: '분쇄 박자: 기본 공격 5번째마다 집게로 쥐어 추가 피해',
            passive: { name: '분쇄 박자', desc: '기본 공격 5번째마다 집게로 쥐어 추가 피해 + 0.5초 기절',
                every: { n: 5, step: { do: 'hit', pick: 'nearest', range: 220, dmg: 1.5, status: { stun: 0.5 }, vfx: V.claw(150, 110) } } } },
        skills: {
            arCrush: { name: '해체 분쇄', slot: 'head', ult: true, cd: 0, icon: 'claw', color: '#5adcd2', target: 'enemy', range: 300, clip: 'swing', p: { times: 3 },
                desc: '가장 강한 적을 집게로 붙잡아 세 번 쥐어짬 — 큰 피해 + 기절',
                steps: [{ at: 0.33, do: 'custom', fn: crushFx, range: 300, times: '$times', preview: crushFx.preview },
                    { at: 0.38, do: 'hit', pick: 'strongest', range: 300, times: '$times', every: 0.35, dmg: 2.4, status: { stun: 1 }, knock: 0.2 },
                    { at: 0.38, do: 'shake', power: 5, ms: 200, repeat: '$times', repeatGap: 0.35 }] },
            arOverpressure: { name: '과압', slot: 'body', cd: 14, icon: 'overdrive', color: '#5adcd2', target: 'self', clip: 'cast', p: { sec: 8 },
                desc: '8초 공격 속도 +40%',
                steps: [{ do: 'buff', key: 'overpressure', sec: '$sec', mods: { atkSpd: 0.4 } }, { do: 'custom', fn: overpressureFx, sec: '$sec', preview: overpressureFx.preview }] },
            arGrab: { name: '움켜잡기', slot: 'arm', cd: 8, icon: 'claw', color: '#5adcd2', target: 'enemy', range: 220, clip: 'swing',
                desc: '앞 적 하나를 집게로 끌어와 2초 기절 + 피해',
                steps: [{ at: 0.33, do: 'custom', fn: grab, range: 220, to: 20, sec: 0.3, dmg: 1.8, status: { stun: 2 }, preview: grab.preview }] }
        }
    },

    // ---- 레전더리 ① 대재건의 건축왕 (균형) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '대재건의 건축왕', style: 'balance', tint: 'sepia(0.7) saturate(2.2) hue-rotate(-5deg) brightness(1.2) drop-shadow(0 0 7px rgba(255, 205, 90, 0.85))',
        bonus: { 2: '도시 재건 +2초', 4: '도시 재건 성벽이 무너질 때 피해 2배' },
        kit: { 2: { patch: { arCityRebuild: { sec: 2 } } }, 4: { patch: { arCityRebuild: { endDmg: 3 } } } },
        head: { name: '황금 설계도 왕관', look: '황금 설계도가 떠도는 왕관', skill: 'arCityRebuild', desc: '필살기 도시 재건: 황금 비계 성벽이 솟음 — 솟을 때 화면 피해, 8초 적 진격 막음, 무너질 때 큰 피해' },
        body: { name: '비계 날개 망토', look: '등에 황금 비계 날개', skill: 'arRevise', desc: '설계 수정: 8초 받는 피해 -30%, 진격 +20%' },
        arm: { name: '황금 드릴 홀', look: '황금 드릴이 달린 홀', skill: 'arPiles', desc: '기본 공격 황금 드릴 (관통 셋) · 기초 말뚝: 말뚝 5개가 적 5명 2초 속박',
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, vfx: V.beam(GOLD, 10), hitVfx: V.gold(0, 70, { dur: 0.3 }) } },
        leg: { name: '기초석 신발', look: '주춧돌 같은 신발', desc: '반석: 받는 피해 -15%, 거점·바리케이드 피해 +20%',
            passive: { name: '반석', desc: '받는 피해 -15%, 거점·바리케이드에 주는 피해 +20%', mods: { def: 0.15 }, target: [{ when: 'building', dmg: 0.2 }] } },
        skills: {
            arCityRebuild: { name: '도시 재건', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffcd5a', target: 'enemy', range: 600, clip: 'cast', p: { sec: 8, endDmg: 3 },
                desc: '황금 비계 성벽이 솟음 — 솟을 때 화면 피해, 8초 적 진격 막음, 무너질 때 큰 피해',
                steps: [{ at: 0.45, do: 'screen', dmg: 1.2, vfx: CITY_RISE, maxFx: 8, ground: true },
                    { at: 0.45, do: 'zone', tag: 'cityWall', wall: true, x: 30, w: 70, sec: '$sec', art: { cls: 'is-scaffold is-gold', w: 140, h: 230, dx: -35 },
                        end: { dmg: '$endDmg', radius: 260, vfx: CITY_FALL } }, { at: 0.45, do: 'shake', power: 8, ms: 350 }, { at: 0.45, do: 'custom', fn: cityWallFx, sec: '$sec', preview: cityWallFx.preview }] },
            arRevise: { name: '설계 수정', slot: 'body', cd: 15, icon: 'shield', color: '#ffcd5a', target: 'self', clip: 'cast',
                desc: '8초 받는 피해 -30%, 진격 속도 +20%',
                steps: [{ do: 'buff', key: 'revise', sec: 8, mods: { def: 0.3, move: 0.2 } }, { do: 'custom', fn: reviseFx, sec: 8, preview: reviseFx.preview }] },
            arPiles: { name: '기초 말뚝', slot: 'arm', cd: 9, icon: 'pile', color: '#ffcd5a', target: 'enemy', range: 320, clip: 'slam',
                desc: '황금 말뚝 5개가 적 5명을 2초 속박 + 피해',
                steps: [{ at: 0.45, do: 'custom', fn: piles, n: 5, range: 320, dmg: 1.1, sec: 2, preview: piles.preview }] }
        }
    },

    // ---- 레전더리 ② 종말의 해체 거신 (공격) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '종말의 해체 거신', style: 'dps', tint: 'brightness(0.65) saturate(1.6) hue-rotate(-20deg) contrast(1.25) drop-shadow(0 0 7px rgba(255, 80, 60, 0.85))',
        bonus: { 2: '최종 철거 +1번', 4: '지반 붕괴 안의 거점 피해 3배' },
        kit: { 2: { patch: { arFinalDemolition: { count: 1 } } }, 4: { patch: { arSinkhole: { baseMul: 2 } } } },
        head: { name: '해체 거신 투구', look: '붉은 경고등 해체 로봇 투구', skill: 'arFinalDemolition', desc: '필살기 최종 철거: 거대 굴착기가 앞을 세 번 내리찍음 — 거점 3배' },
        body: { name: '철거 엔진', look: '불을 뿜는 철거 엔진', skill: 'arEngineHeat', desc: '엔진 과열: 6초 피해 +50%, 끝날 때 둘레 폭발' },
        arm: { name: '거대 굴착 드릴', look: '몸만 한 굴착 드릴', skill: 'arSinkhole', desc: '기본 공격 굴착 드릴 (4연타) · 지반 붕괴: 앞 바닥이 꺼짐 — 범위 피해 + 2초 속박',
            kitAttack: { kind: 'melee', n: 4, gap: 0.07, vfx: V.blast(10, 80, { dur: 0.25 }), splash: 50, splashMul: 0.3 } },
        leg: { name: '거신 궤도', look: '거대한 무한궤도 다리', desc: '짓밟는 궤도: 걸음마다 앞쪽 작은 충격파',
            passive: { name: '짓밟는 궤도', desc: '걸음마다 앞쪽 작은 충격파', step: { do: 'hit', pick: 'all', range: 120, dmg: 0.4, knock: 0.3, ground: true, vfx: V.shock(50, 150, 0.4) } } },
        skills: {
            arFinalDemolition: { name: '최종 철거', slot: 'head', ult: true, cd: 0, icon: 'drill', color: '#ff503c', target: 'enemy', range: 480, clip: 'slam', p: { count: 3 },
                desc: '거대 굴착기가 앞쪽을 세 번 내리찍음 — 큰 피해, 거점 3배',
                steps: [{ at: 0.45, do: 'custom', fn: finalDemolition, count: '$count', preview: finalDemolition.preview }] },
            arEngineHeat: { name: '엔진 과열', slot: 'body', cd: 15, icon: 'overdrive', color: '#ff503c', target: 'self', clip: 'cast',
                desc: '6초 주는 피해 +50% — 끝날 때 둘레 폭발',
                steps: [{ do: 'buff', key: 'engineHeat', sec: 6, mods: { dmg: 0.5, onEnd: { do: 'hit', pick: 'all', range: 220, dmg: 2, knock: 1.2 } } },
                    { do: 'custom', fn: engineHeatFx, sec: 6, preview: engineHeatFx.preview }, { at: 6, do: 'fx', on: 'self', x: 40, vfx: ENGINE_BOOM }] },
            arSinkhole: { name: '지반 붕괴', slot: 'arm', cd: 9, icon: 'slam', color: '#ff503c', target: 'enemy', range: 260, clip: 'slam', p: { baseMul: 1 },
                desc: '앞쪽 바닥이 꺼짐 — 범위 피해 + 2초 속박',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 260, dmg: 2, baseMul: '$baseMul', status: { root: 2 } }, { at: 0.45, do: 'shake', power: 7, ms: 250 },
                    { at: 0.45, do: 'custom', fn: sinkholeFx, preview: sinkholeFx.preview }] }
        }
    }
]);
