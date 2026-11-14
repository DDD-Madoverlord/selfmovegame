/* ==========================================================================
   PROJECT: MAD OVERLORD // 봉합 성녀 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-6)
   레어 ① 종지기 수녀(a) · 레어 ② 붉은 실 재봉사(b) · 유니크 ① 천 개의 실 날개(u) · 레어 ③ 약초 치유사(c) · 레어 ④ 눈물의 조각상(d)
   · 유니크 ② 나비 실 수녀(v) · 유니크 ③ 흑철 재봉 기계(w) · 레전더리 ① 운명의 직조자(l) · 레전더리 ② 진홍 장미 성녀(m)
   꿰맨 아군 = battle/saint.js riseAlly (상한 SAINT.allyMax + 값 allyMax) — 처치 때 꿰매기는 battle/kit.js kitRaiseAlly, 버프 값 raise = 그동안 n명.
   붉은 실(status thread) = 이어진 적끼리 받은 피해의 30%를 나눔. 새 캐릭터 세트는 강화 그림 + 세트 색. 동작은 rig/saintRig.js (slam·throw는 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';

const HOLY = '255, 215, 130', BLOOD = '235, 40, 70', HERB = '150, 255, 160', MARBLE = '220, 220, 230', BUTTERFLY = '255, 90, 110', IRON = '180, 60, 70', GOLD = '255, 200, 90', ROSE = '255, 70, 100';
const isUnit = e => !e.isBuilding && !e.isBarricade;
const onScreen = b => b.enemies.filter(e => isUnit(e) && e.x - b.monsterX < 1000);

// 붉은 실 4부위: 실로 이어진 적이 쓰러지면 가장 가까운 적에게 실이 옮겨 붙음
function threadJump(b, info) {
    const e = info.enemy;
    if (!e || !(e.kitThreadT > 0)) return;
    const x = aimAt(e).x;
    const t = b.enemies.filter(o => o !== e && isUnit(o) && o.hp > 0 && !(o.kitThreadT > 0))
        .sort((p, q) => Math.abs(aimAt(p).x - x) - Math.abs(aimAt(q).x - x))[0];
    if (!t) return;
    b.fx.play(V.chainBolt(BLOOD), x, aimAt(e).b, { to: [aimAt(t).x, aimAt(t).b] });
    b.kitStatus(t, { thread: e.kitThreadT });
}

// ==== 7차 개선 (D-127, 2026-11-14 밤): 종지기 수녀·붉은 실 재봉사·약초 치유사·눈물의 조각상 — 설명과 이펙트 맞추기 ====
// 물건 그림 saint_set (Gemini 한 장 3×2칸 → tools/images/build_saint_set.py): 0 금종 · 1 촛불 · 2 약병 · 3 실 고치 · 4 재봉 바늘 · 5 대리석 손.
// 불투명 그림이라 blend 'normal'.
const ITEM = (frame, size, o = {}) => spr('saint_set', size, { frameRange: [frame, frame], blend: 'normal', ...o });
const FADE = (sec, o = {}) => ({ dur: sec, fadeIn: 0.15, fadeOut: 0.35, ...o });
const alive = (b, e) => b.enemies.includes(e) && e.hp > 0;
const chest = e => [aimAt(e).x, aimAt(e).b];

// 종 추 강타: 예전엔 작은 바닥 충격 + 초록 고리 → 금빛 땅 충격(반구 충격파) + 앞으로 퍼지는 금빛 음파 두 겹 + 울림 고리 두 번(댕—) + 흙먼지
const BELL_STRIKE = fxOf(
    { type: 'domeWave', at: 0, dur: 0.85, r: 190, h: 0.5, color: HOLY },
    spr('ground_impact', 230, { anchorY: 0.85, glow: 1.2 }),
    spr('sonic_ring', 230, { hue: -145, frameRange: [1, 6], dur: 0.6, dx: 100, dy: -60, alpha: 0.85 }),
    spr('sonic_ring', 290, { at: 0.2, hue: -145, frameRange: [1, 6], dur: 0.6, dx: 170, dy: -60, alpha: 0.6 }),
    { type: 'shockwave', at: 0.02, dur: 0.5, r: 200, width: 10, ground: true, color: HOLY },
    { type: 'shockwave', at: 0.24, dur: 0.6, r: 270, width: 7, ground: true, color: GOLD },
    { type: 'streaks', at: 0.02, count: 16, speed: 420, angle: -Math.PI / 2, cone: 1.6, len: 22, life: [0.25, 0.5], color: '255, 230, 160' },
    { type: 'dustCloud', at: 0.05, dur: 1.4, w: 150, h: 70, color: '150, 130, 110', alpha: 0.7 });

// 만종 (필살기): 예전엔 작은 금빛 터짐뿐 → 하늘 가운데 큰 금종이 튀어나와 크게 흔들리며 두 번 울림 —
//   울릴 때마다 종에서 화면을 덮는 금빛 소리 고리 세 겹 + 번쩍임, 땅에도 울림 고리. 적은 금빛 별(기절)
const BELL_SKY = sec => fxOf(
    { type: 'candleGlow', at: 0, dur: sec, r: 150, color: GOLD, dy: -30 },
    ITEM(0, 250, { ...FADE(sec, { fadeIn: 0.1, fadeOut: 0.5 }), anchorY: 0.12, popIn: 0.35, swing: { amp: 0.42, speed: 7.5, decay: 0.5 } }));
const DONG = (k = 1) => fxOf(
    { type: 'flash', at: 0, dur: 0.2, r: 160 * k, color: GOLD },
    ...[0, 0.16, 0.32].map((at, i) => ({ type: 'shockwave', at, dur: 0.85, r: (520 + i * 160) * k, width: 22 - i * 5, color: i ? GOLD : HOLY })),
    { type: 'sparks', at: 0, count: 18, speed: 380, color: '255, 230, 160' });
function bellToll(b) {
    const x = b.monsterX + 330, top = Math.min((b.fx.H || 520) - 120, FOOT_B + 330);
    b.fx.play(BELL_SKY(2.4), x, top, { alive: () => b.isActive });
    b.schedule(0.4, () => { b.fx.play(DONG(1), x, top - 120); b.fx.play(V.ring(HOLY, 520), x, FOOT_B); b.director.shake(8, 350); });
    b.schedule(1.25, () => { if (b.isActive) { b.fx.play(DONG(0.7), x, top - 120); b.fx.play(V.ring(GOLD, 380), x, FOOT_B); } });
}
bellToll.preview = api => {
    const k = api.VFX_SCALE * 0.56, x = (api.CHAR_X + api.dummies[api.dummies.length - 1].x) / 2, y = api.GROUND_Y - 300 * k;
    api.vfx.play(BELL_SKY(2.4), x, y, { scale: k });
    api.later(0.4, () => { api.vfx.play(DONG(1), x, y + 120 * k, { scale: k }); api.vfx.play(V.ring(HOLY, 520), x, api.GROUND_Y, { scale: k }); });
    api.later(1.25, () => api.vfx.play(DONG(0.7), x, y + 120 * k, { scale: k }));
};

// 봉헌의 촛불: 예전엔 불티 몇 점 → 촛불 자리(8초) 위에 촛불 다섯 자루가 솟아 서서 흔들리는 불빛 + 바닥 따뜻한 빛 + 불티
const CANDLE_N = 5;
const CANDLE = (sec, i, remaining) => fxOf(
    ITEM(1, i % 2 ? 70 : 84, { dur: sec + 0.4, anchorY: 0.84, popIn: 0.3 + i * 0.06, fadeIn: 0.1, fadeOut: 0.45, remaining }),
    { type: 'candleGlow', at: 0, dur: sec + 0.4, r: 34, seed: i, dy: (i % 2 ? -50 : -61), remaining });
const CANDLE_FLOOR = (sec, w, remaining) => fxOf({ type: 'candleGlow', at: 0, dur: sec + 0.4, r: w * 0.62, ground: true, remaining });
function offerCandles(b, ctx, s) {
    const z = b.kitZone({ tag: 'candle', x: -140, w: 300, sec: s.sec, heal: 0.01, allyHeal: 0.01, dps: 0.3, puff: V.embers(HOLY), puffEvery: 0.3, puffB: 60 });
    if (!z) return;
    const live = () => b.kitZones.includes(z), rem = () => z.t;
    b.fx.play(CANDLE_FLOOR(s.sec, z.w, rem), z.x + z.w / 2, FOOT_B, { follow: () => [z.x + z.w / 2, FOOT_B], alive: live });
    for (let i = 0; i < CANDLE_N; i++) {
        const dx = z.w * (i + 0.5) / CANDLE_N + (i % 2 ? 6 : -6), lift = i % 2 ? 6 : 0;
        b.fx.play(CANDLE(s.sec, i, rem), z.x + dx, FOOT_B + lift, { follow: () => [z.x + dx, FOOT_B + lift], alive: live });
    }
}
offerCandles.preview = api => {
    const k = api.VFX_SCALE * 0.56, x0 = api.CHAR_X - 140 * k, w = 300;
    api.vfx.play(CANDLE_FLOOR(3, w), x0 + w * k / 2, api.GROUND_Y, { scale: k });
    for (let i = 0; i < CANDLE_N; i++) api.vfx.play(CANDLE(3, i), x0 + w * k * (i + 0.5) / CANDLE_N, api.GROUND_Y - (i % 2 ? 6 : 0) * k, { scale: k });
};

// 꿰매기 사슬: 예전엔 가는 붉은 번개선뿐 → 재봉 바늘이 적에서 적으로 날아가 꿰뚫고, 지나간 자리에 붉은 실이 남아
//   묶인 적들을 이은 채(적을 따라감) 속박 시간 동안 남음 + 꿰인 자리 X자 땀
const NEEDLE_FLY = sec => fxOf(ITEM(4, 120, { dur: sec, travel: true, angleOffset: -Math.PI / 4 - 0.05 }),
    { type: 'motes', at: 0, count: 4, spread: 10, rise: [0, 10], life: [0.2, 0.4], size: 2, color: BLOOD });
const THREAD = (sec, mode = 'chain', reveal = 0, color = BLOOD) => fxOf({ type: 'threadPath', at: 0, dur: sec, mode, reveal, color });
// 튀는 사슬 그림: fly(초)가 적에서 적으로 날아가고 지나간 자리에 color 실이 남아 묶인 적을 따라감 (꿰매기 사슬 바늘 · 나비 실 화살 나비, D-128 공용)
function threadTrail(fly, color, n = 4) {
    const fn = (b, s, list, start) => {
        const gap = s.gap ?? 0.12, pts = [start, ...list.map(chest)];
        list.forEach((e, i) => b.schedule(i * gap, () => {
            if (!b.isActive) return;
            const from = i ? (alive(b, list[i - 1]) ? chest(list[i - 1]) : pts[i]) : start;
            b.fx.play(fly(gap + 0.04), from[0], from[1], { to: alive(b, e) ? chest(e) : pts[i + 1] });
        }));
        const sec = (s.status?.root ?? 2) + gap * list.length;
        b.fx.play(THREAD(sec, 'chain', gap * (list.length + 1), color), start[0], start[1], {
            path: () => [start, ...list.filter(e => alive(b, e)).map(chest)], alive: () => b.isActive });
    };
    fn.preview = api => {
        const m = api.muzzle(), y = api.enemyChestY(), ds = api.dummies.slice(0, n);
        ds.forEach((d, i) => api.later(i * 0.12, () => api.vfx.play(fly(0.16), i ? ds[i - 1].x : m[0], i ? y : m[1],
            { scale: api.VFX_SCALE * 0.56, to: [d.x, y] })));
        api.vfx.play(THREAD(2.4, 'chain', 0.6, color), m[0], m[1], { scale: api.VFX_SCALE * 0.56, path: () => [m, ...ds.map(d => [d.x, y])] });
    };
    return fn;
}
const stitchTrail = threadTrail(NEEDLE_FLY, BLOOD);

// 실 고치: 예전엔 붉은 부활 그림 한 번 → 실 고리들이 몸에 감겨 조여들며 붉은 실 고치가 몸을 감쌈(4초, 반투명) → 끝에 고치가 터져
//   실이 사방으로 튀며 둘레 적 피해
const COCOON = sec => fxOf(
    { type: 'threadWrap', at: 0, dur: sec, rx: 62, ry: 92, count: 8 },
    ITEM(3, 250, { at: 0.25, dur: sec - 0.25, anchorY: 0.85, alpha: 0.72, popIn: 0.25, fadeIn: 0.1, fadeOut: 0.2 }),
    { type: 'candleGlow', at: 0.25, dur: sec - 0.25, r: 95, color: BLOOD, dy: -90 });
const COCOON_BURST = fxOf(
    spr('needle_crimson', 280, { frameRange: [3, 8], dur: 0.55, dy: -85, glow: 1.3 }),
    { type: 'streaks', at: 0, count: 26, speed: 520, len: 30, life: [0.3, 0.55], color: BLOOD, dy: -85 },
    { type: 'shockwave', at: 0, dur: 0.45, r: 230, width: 10, ground: true, color: BLOOD },
    { type: 'sparks', at: 0, count: 14, speed: 300, color: '255, 160, 180', dy: -85 });
function cocoonWrap(b, ctx, s) {
    const at = () => [b.monsterX + 38, FOOT_B];
    b.fx.play(COCOON(s.sec), ...at(), { follow: at, alive: () => b.isActive });
}
cocoonWrap.preview = api => api.vfx.play(COCOON(2.2), api.CHAR_X, api.GROUND_Y, { scale: api.VFX_SCALE * 0.56 });
function cocoonBurst(b) {
    b.fx.play(COCOON_BURST, b.monsterX + 38, FOOT_B);
    b.director.shake(5, 200);
    enemiesNear(b, b.monsterX + 60, 220, true).forEach(e => { kitHit(b, e, 1.5, { knock: 0.6 }); b.fx.play(V.needle(0, 90), ...chest(e)); });
}

// 운명의 실타래 (필살기): 예전엔 적마다 작은 바늘 반짝임 → 하늘에 운명의 실 문양(fate_thread)이 짜이고, 실타래 관(머리)에서
//   화면 모든 적에게 붉은 실이 뻗어 꽂힘 + 적끼리도 실로 이어짐 — 6초 동안 적을 따라 남음 (피해 나눔이 보이게)
const FATE_SIGIL = fxOf(spr('fate_thread', 380, { dur: 1.3, frameRange: [0, 7], glow: 1.2 }),
    { type: 'motes', at: 0.2, count: 26, spread: 160, rise: [10, 60], life: [0.6, 1.1], size: 2.4, color: BLOOD });
function fateWeb(b, ctx, s) {
    const list = onScreen(b).sort((p, q) => p.x - q.x);
    if (!list.length) return;
    const head = () => [b.monsterX + 34, FOOT_B + 150];
    const mid = (aimAt(list[0]).x + aimAt(list[list.length - 1]).x) / 2;
    b.fx.play(FATE_SIGIL, mid, FOOT_B + 230);
    const pts = () => list.filter(e => alive(b, e)).map(chest);
    b.fx.play(THREAD(s.sec, 'fan', 0.5), ...head(), { path: () => [head(), ...pts()], alive: () => b.isActive });
    b.fx.play(fxOf({ type: 'threadPath', at: 0.45, dur: s.sec - 0.45, mode: 'chain', reveal: 0.4, color: '255, 90, 110', w: 1.8, sag: 22 }), ...head(),
        { path: pts, alive: () => b.isActive });
}
fateWeb.preview = api => {
    const k = api.VFX_SCALE * 0.56, y = api.enemyChestY(), head = [api.CHAR_X, api.GROUND_Y - 150 * k], ds = api.dummies;
    api.vfx.play(FATE_SIGIL, (ds[0].x + ds[ds.length - 1].x) / 2, api.GROUND_Y - 230 * k, { scale: k });
    api.vfx.play(THREAD(3, 'fan', 0.5), ...head, { scale: k, path: () => [head, ...ds.map(d => [d.x, y])] });
    api.vfx.play(fxOf({ type: 'threadPath', at: 0.45, dur: 2.5, mode: 'chain', reveal: 0.4, color: '255, 90, 110', w: 1.8, sag: 22 }), ...head,
        { scale: k, path: () => ds.map(d => [d.x, y]) });
};

// 약병 투척: 예전엔 던지는 약병 없이 터짐만 → 초록 약병이 빙글 돌며 포물선으로 날아가 깨지며 초록 물보라 + 유리 조각
const POTION = ITEM(2, 52, { spin: 11, arc: 70 });
const POTION_BURST = fxOf(spr('acid_burst', 150, { glow: 1.2 }),
    { type: 'shards', at: 0, count: 8, speed: 260, size: 4, spin: 9, life: [0.4, 0.7], shape: 'rock', floor: 0, color: '200, 255, 220' },
    { type: 'motes', at: 0.05, count: 10, spread: 40, rise: [20, 60], life: [0.5, 0.9], size: 2.2, color: HERB });

// 약초 연기: 예전엔 작은 연기 그림을 칸칸이 깔기 → 연기 그림 한 장(defeat_puff 연기 칸, 초록으로)을 장판 너비만큼 크게 5초 동안
//   한 번에 덮고 천천히 일렁임 + 약초 빛 알갱이
const SMOKE = (w, sec, remaining) => fxOf(
    spr('defeat_puff', 0, { width: w + 110, height: 210, dur: sec, frameRange: [5, 6], loopSec: 1.8, pingPong: true, hue: -160, alpha: 1,
        anchorY: 0.86, fadeIn: 0.45, fadeOut: 0.9, remaining, softEdges: 0.18 }),
    { type: 'motes', at: 0.2, count: 18, spread: w * 0.45, rise: [20, 70], life: [0.8, 1.4], size: 2.2, color: HERB, dy: -30 });
function herbSmoke(b, ctx, s) {
    const z = b.kitZone({ tag: 'smoke', x: 0, w: 220, sec: s.sec, status: { poison: [2, 0.3] }, every: 1 });
    if (!z) return;
    b.fx.play(SMOKE(z.w, s.sec, () => z.t), z.x + z.w / 2, FOOT_B, { follow: () => [z.x + z.w / 2, FOOT_B], alive: () => b.kitZones.includes(z) });
}
herbSmoke.preview = api => {
    const k = api.VFX_SCALE * 0.56;
    api.vfx.play(SMOKE(220, 3), api.CHAR_X + (100 + 110) * k, api.GROUND_Y, { scale: k });
};

// 치유의 비 (필살기): 예전엔 작은 잎 빛 몇 점이 잠깐 → 8초 동안 화면 위끝에서 바닥까지 초록 빛비가 넓게 쏟아짐(빛구름 띠·빗줄기·
//   바닥 튀는 고리) + 치유 비 그림 겹 + 바닥에서 오르는 치유 빛 알갱이
const HEAL_RAIN = (w, sec, remaining) => fxOf(
    { type: 'rainFall', at: 0, dur: sec, w, count: 120, top: -10, remaining },
    ...[-0.32, 0, 0.32].map((f, i) => spr('heal_rain', 300, { dur: sec, dx: f * w, dy: -150, loopSec: 0.9, phase: i * 0.3, alpha: 0.75,
        fadeIn: 0.5, fadeOut: 0.8, remaining })),
    { type: 'motes', at: 0.3, count: 40, spread: w * 0.45, rise: [30, 90], life: [0.9, 1.6], size: 2.6, color: HERB, dy: -10 });
function healRain(b, ctx, s) {
    const z = b.kitZone({ tag: 'healRain', x: -220, w: 820, sec: s.sec, slow: true, allyHeal: 0.03 });
    if (!z) return;
    b.fx.play(HEAL_RAIN(z.w, s.sec, () => z.t), z.x + z.w / 2, FOOT_B, { follow: () => [z.x + z.w / 2, FOOT_B], alive: () => b.kitZones.includes(z) });
    b.fx.play(V.ring(HERB, 420), b.monsterX + 40, FOOT_B);
}
healRain.preview = api => {
    const k = api.VFX_SCALE * 0.56, far = api.dummies[api.dummies.length - 1].x;
    api.vfx.play(HEAL_RAIN((far - api.CHAR_X) / k + 260, 4), (api.CHAR_X + far) / 2, api.GROUND_Y, { scale: k });
};

// 돌 손바닥: 예전엔 작은 바닥 충격 → 하늘에서 거대한 대리석 손이 손바닥을 아래로 내리꽂힌 뒤 잠깐 누르고, 대지 강타처럼
//   반구 충격파·땅 균열·튀는 돌 조각·자갈·흙먼지 구름 (대리석 흰빛)
const PALM_FALL = (dx, dy) => fxOf(ITEM(5, 210, { dur: 0.16, anchorY: 0.62, angleOffset: -Math.atan2(dy, dx) - 0.12 }));
const PALM_PRESS = fxOf(ITEM(5, 210, { dur: 0.5, anchorY: 0.62, angle: -0.12, squash: 0.92, fadeOut: 0.3 }));
const PALM_BLAST = fxOf(
    { type: 'domeWave', at: 0, dur: 0.9, r: 210, h: 0.5, color: '235, 235, 245' },
    { type: 'cracks', at: 0.02, dur: 1.6, count: 7, len: 115, color: '205, 215, 235' },
    { type: 'streaks', at: 0.02, count: 20, speed: 480, angle: -Math.PI / 2, cone: 1.8, len: 24, life: [0.3, 0.55], color: '240, 240, 250' },
    { type: 'shards', at: 0.03, count: 14, speed: 420, size: 6, spin: 7, life: [0.8, 1.3], shape: 'rock', floor: 0, color: '215, 215, 225' },
    { type: 'debris', at: 0.05, count: 16, speed: 290, size: 3, color: '190, 190, 200' },
    spr('stone_grey', 170, { at: 0.05, frameRange: [7, 8], dur: 0.7, anchorY: 0.85, alpha: 0.85 }),
    { type: 'dustCloud', at: 0.08, dur: 2.2, w: 190, h: 100, color: '175, 170, 165', alpha: 0.85 });
function stonePalm(b, ctx, s) {
    const e = pickTargets(b, 'nearest', 1, s.range ?? ctx.range)[0];
    const x = e ? aimAt(e).x : b.frontX() + 60, from = [x - 80, FOOT_B + 330], to = [x + 10, FOOT_B + 30];
    b.fx.play(PALM_FALL(to[0] - from[0], from[1] - to[1]), ...from, { to });
    b.schedule(0.16, () => {
        if (!b.isActive) return;
        b.fx.play(PALM_PRESS, ...to);
        b.fx.play(PALM_BLAST, x, FOOT_B);
        b.director.shake(8, 260);
    });
}
stonePalm.preview = api => {
    const k = api.VFX_SCALE * 0.56, x = api.dummies[0].x, to = [x + 10 * k, api.GROUND_Y - 30 * k], from = [x - 80 * k, api.GROUND_Y - 330 * k];
    api.vfx.play(PALM_FALL(80, 300), ...from, { scale: k, to });
    api.later(0.16, () => { api.vfx.play(PALM_PRESS, ...to, { scale: k }); api.vfx.play(PALM_BLAST, x, api.GROUND_Y, { scale: k }); api.shake(6, 0.25); });
};

// 석화의 눈물 (필살기): 예전엔 돌 그림이 적 몸 가운데에 잠깐 → 적마다 발밑 바닥에서 돌이 솟아 다리를 덮고(석화 시간 동안 남음)
//   몸이 잿빛 돌색(.is-stone)으로 굳었다가, 끝나면 돌이 부서져 흩어짐. 시전 때 대리석 눈물 빛 고리
const STONE_RISE = sec => fxOf(
    spr('stone_grey', 118, { frameRange: [1, 2], dur: 0.3, anchorY: 0.9, blend: 'normal' }),
    spr('stone_grey', 118, { at: 0.3, frameRange: [2, 2], dur: Math.max(0.1, sec - 0.3), anchorY: 0.9, blend: 'normal' }),
    spr('stone_grey', 150, { at: sec, frameRange: [7, 8], dur: 0.5, anchorY: 0.9 }),
    { type: 'debris', at: 0, count: 8, speed: 160, size: 3, color: '200, 200, 210' },
    { type: 'debris', at: sec, count: 10, speed: 220, size: 3, color: '200, 200, 210' });
function petrifyAll(b, ctx, s) {
    const sec = Number(s.sec) || 3;
    b.fx.play(fxOf({ type: 'shockwave', at: 0, dur: 0.6, r: 520, width: 16, ground: true, color: MARBLE },
        { type: 'motes', at: 0, count: 16, spread: 40, rise: [20, 60], life: [0.5, 1], size: 2.4, color: '200, 230, 255', dy: -120 }), b.monsterX + 40, FOOT_B);
    onScreen(b).slice(0, 12).forEach(e => {
        b.fx.play(STONE_RISE(sec), aimAt(e).x, FOOT_B, { follow: () => [aimAt(e).x, FOOT_B], alive: () => alive(b, e) });
        e.dom?.classList.add('is-stone');
        b.schedule(sec, () => e.dom?.classList.remove('is-stone'));
    });
}
petrifyAll.preview = api => {
    const k = api.VFX_SCALE * 0.56;
    api.vfx.play(V.ring(MARBLE, 520), api.CHAR_X, api.GROUND_Y, { scale: k });
    api.dummies.forEach(d => api.vfx.play(STONE_RISE(2.5), d.x, api.GROUND_Y, { scale: k * 1.4 }));
};

// ==== 8차 개선 (D-128, 2026-11-14 밤): 천 개의 실 날개·나비 실 수녀·흑철 재봉 기계·운명의 직조자·진홍 장미 성녀 — 더 화려하고 타격감 있게 ====
// 물건 그림 saint_set2 (Gemini 한 장 3×2칸 → tools/images/build_saint_set.py saint_set2):
//   0 붉은 나비 · 1 금빛 바늘(아래를 향함) · 2 장미 넝쿨 덤불(바닥 평평) · 3 큰 진홍 장미 · 4 금 가위 · 5 금실 천 리본
const ITEM2 = (frame, size, o = {}) => spr('saint_set2', size, { frameRange: [frame, frame], blend: 'normal', ...o });
const DOWN = -Math.PI / 2;   // 아래를 향한 그림을 진행 방향으로 (바늘)
const muzzleOf = b => { const m = monster.getMuzzlePoint(); return m ? [m.x, m.bottom] : [b.monsterX + 90, FOOT_B + 70]; };
const TOP_B = b => Math.min((b.fx.H || 560) - 20, FOOT_B + 400);

// ---- 천 개의 실 날개 ----
// 구원의 비 (필살기): 예전엔 가는 빛기둥이 여기저기 → 8초 동안 하늘 금빛 띠에서 빛 바늘 소나기가 쏟아지고(코드 빗줄기),
//   판정마다 큰 금빛 바늘이 하늘에서 꽂혀 금빛 기둥 + 고리 + 불티, 성녀 머리 위 후광
const LIGHT_NEEDLE = sec => fxOf(ITEM2(1, 120, { dur: sec, travel: true, angleOffset: DOWN, glow: 1.2 }));
// 꽂힌 자리: 바늘이 땅에 박힌 채 잠깐 빛나다 스러지고, 바닥에 금빛 별빛 번쩍 + 잔물결 고리 + 튀는 불티·오르는 빛 알갱이
//   (예전 이 자리의 빛기둥은 바늘이 내려꽂히는데 빛이 위로 솟아 어색했음 — 2026-11-14 피드백)
const SALV_HIT = fxOf(ITEM2(1, 120, { dur: 0.55, anchorY: 0.82, fadeIn: 0, fadeOut: 0.35, glow: 1.2 }),
    spr('needle_crimson', 120, { frameRange: [2, 6], dur: 0.4, hue: 55, dy: -6 }),
    { type: 'shockwave', at: 0, dur: 0.45, r: 75, width: 5, ground: true, color: HOLY },
    { type: 'shockwave', at: 0.12, dur: 0.5, r: 110, width: 3, ground: true, color: '255, 240, 200' },
    { type: 'sparks', at: 0, count: 9, speed: 200, color: '255, 235, 170' },
    { type: 'motes', at: 0.05, count: 6, spread: 14, rise: [20, 55], life: [0.4, 0.7], size: 2, color: HOLY });
// 빛 바늘 석궁 기본 공격: 구슬 대신 금빛 바늘 화살이 빛 꼬리를 끌며 날아가 꽂히고 금빛 번쩍 (2026-11-14 피드백)
const LIGHT_ARROW = dur => fxOf(ITEM2(1, 66, { dur, travel: true, angleOffset: DOWN, glow: 1.2 }),
    { type: 'boltTrail', at: 0, dur: dur + 0.12, fly: dur, len: 0.07, w: 4, color: HOLY });
const ARROW_HIT = fxOf(spr('needle_crimson', 80, { frameRange: [2, 6], dur: 0.3, hue: 55 }),
    { type: 'sparks', at: 0, count: 5, speed: 160, color: '255, 235, 170' });
const SALV_SKY = (w, sec) => fxOf({ type: 'rainFall', at: 0, dur: sec, w, count: 70, top: -10, color: HOLY });
function salvationSky(b, ctx, s) {
    const x0 = b.frontX() + 30, x1 = b.frontX() + 520;
    b.fx.play(SALV_SKY(x1 - x0 + 80, s.sec), (x0 + x1) / 2, FOOT_B, { alive: () => b.isActive });
    b.fx.play(fxOf({ type: 'candleGlow', at: 0, dur: s.sec, r: 60, color: HOLY }), b.monsterX + 34, FOOT_B + 175,
        { follow: () => [b.monsterX + 34, FOOT_B + 175], alive: () => b.isActive });
}
salvationSky.preview = api => {
    const k = api.VFX_SCALE * 0.56, far = api.dummies[api.dummies.length - 1].x;
    api.vfx.play(SALV_SKY((far - api.dummies[0].x) / k + 160, 4), (api.dummies[0].x + far) / 2, api.GROUND_Y, { scale: k });
    api.dummies.forEach((d, i) => api.later(0.2 + i * 0.25, () => {
        api.vfx.play(LIGHT_NEEDLE(0.2), d.x, api.GROUND_Y - 420 * k, { scale: k, to: [d.x, api.GROUND_Y] });
        api.later(0.2, () => api.vfx.play(SALV_HIT, d.x, api.GROUND_Y, { scale: k }));
    }));
};

// 수호 실타래: 방어막 대신 **금빛 실타래(실 고치 그림을 금빛으로)가 몸을 감싸 지켜 줌** — 반투명(45%), 막이 있는 동안(최대 6초) 남고
//   안쪽에 옅은 금실 고리가 천천히 감겨 돎. 시작 때 금실이 감겨 들며 실타래가 맺힘 (2026-11-14 피드백: 방어막처럼 보이는 것보다 실타래가 몸을 보호하는 모습)
//   꿰맨 아군도 작은 금빛 실타래
const GUARD_START = fxOf(spr('revive_crimson', 230, { frameRange: [1, 5], dur: 0.75, hue: 30, alpha: 0.55 }),
    { type: 'threadWrap', at: 0, dur: 0.8, rx: 62, ry: 96, count: 7, color: HOLY, alpha: 0.7 },
    { type: 'motes', at: 0.15, count: 12, spread: 60, rise: [20, 70], life: [0.6, 1.1], size: 2.2, color: HOLY, dy: -40 });
const GUARD_SPOOL = (sec, size) => fxOf(
    ITEM(3, size, { at: 0.25, dur: sec - 0.25, hue: 55, anchorY: 0.86, alpha: 0.4, popIn: 0.3, fadeIn: 0.1, fadeOut: 0.4 }),
    { type: 'threadWrap', at: 0.3, dur: sec - 0.3, rx: size * 0.26, ry: size * 0.39, count: 6, color: HOLY, alpha: 0.35 });
function guardThread(b, ctx, s) {
    const me = () => [b.monsterX + 38, FOOT_B];
    b.fx.play(GUARD_START, ...me(), { follow: me });
    b.fx.play(GUARD_SPOOL(s.sec, 250), ...me(), { follow: me, alive: () => b.isActive && b.shieldHp > 0 });
    (b.allies || []).forEach(a => {
        const at = () => [a.x + 38, FOOT_B];
        b.fx.play(GUARD_SPOOL(s.sec, 170), ...at(), { follow: at, alive: () => b.isActive && b.allies.includes(a) });
    });
}
guardThread.preview = api => {
    const k = api.VFX_SCALE * 0.56;
    api.vfx.play(GUARD_START, api.CHAR_X, api.GROUND_Y, { scale: k });
    api.vfx.play(GUARD_SPOOL(2.5, 250), api.CHAR_X, api.GROUND_Y, { scale: k });
};

// 천의 바늘: 예전엔 적 몸에 작은 반짝임 → 석궁에서 금빛 바늘이 부채꼴로 세 번 쏟아져 적에 꽂히고(빗나간 바늘은 바닥에), 꽂힌 자리 금빛 터짐
const FAN_NEEDLE = sec => fxOf(ITEM2(1, 62, { dur: sec, travel: true, angleOffset: DOWN }));
const NEEDLE_PIN = fxOf(spr('needle_crimson', 110, { frameRange: [2, 6], dur: 0.35, hue: 55 }),
    { type: 'sparks', at: 0, count: 5, speed: 160, color: '255, 230, 160' });
function needleFan(b, ctx, s) {
    for (let v = 0; v < 3; v++) b.schedule(v * 0.12, () => {
        if (!b.isActive) return;
        const m = muzzleOf(b), list = b.enemiesInRange(320).slice(0, 4);
        list.forEach((e, i) => b.schedule(i * 0.02, () => alive(b, e) && b.fx.play(FAN_NEEDLE(0.12), ...m, { to: chest(e) })));
        for (let j = 0; j < 4 - list.length + 1; j++) {   // 부채꼴로 흩어지는 빈 바늘 (바닥에 꽂힘)
            const tx = m[0] + 140 + Math.random() * 180;
            b.fx.play(FAN_NEEDLE(0.16), ...m, { to: [tx, FOOT_B + 4] });
        }
    });
}
needleFan.preview = api => {
    const m = api.muzzle(), y = api.enemyChestY(), k = api.VFX_SCALE * 0.56;
    for (let v = 0; v < 3; v++) api.later(v * 0.12, () => api.dummies.forEach(d => {
        api.vfx.play(FAN_NEEDLE(0.12), ...m, { scale: k, to: [d.x, y] });
        api.later(0.12, () => api.vfx.play(NEEDLE_PIN, d.x, y, { scale: k }));
    }));
};

// ---- 나비 실 수녀 ----
// 나비 떼의 춤 (필살기): 예전엔 땅에 나비 터짐만 → 8초 동안 붉은 나비들이 전장 위를 크게 돌며 날갯짓하고(orbit), 나비 떼 구름이 일렁임,
//   판정마다 나비 한 마리가 하늘에서 내려와 적에게 부딪혀 붉은 나비 소용돌이 + 반짝임
const BUTTERFLY_FLY = (sec, size = 64) => fxOf(ITEM2(0, size, { dur: sec, travel: true, upright: true, flap: { speed: 22, min: 0.35 } }),
    { type: 'motes', at: 0, count: 3, spread: 8, rise: [0, 10], life: [0.25, 0.45], size: 1.8, color: BUTTERFLY });
const BUTTERFLY_POP = fxOf(spr('butterfly_red', 150, { frameRange: [4, 7], dur: 0.6 }),
    { type: 'sparks', at: 0, count: 8, speed: 200, color: '255, 160, 180' });
const SWARM = sec => fxOf(
    ...[0, 1, 2].map(i => spr('butterfly_red', 300, { dur: sec, frameRange: [2, 3], loopSec: 0.8, pingPong: true, phase: i * 0.3,
        dx: (i - 1) * 170, dy: -150 - (i % 2) * 40, alpha: 0.65, fadeIn: 0.5, fadeOut: 0.8 })),
    ...Array.from({ length: 8 }, (_, i) => ITEM2(0, 44 + (i % 3) * 8, { dur: sec, upright: true, flap: { speed: 18 + i, min: 0.3, seed: i },
        orbit: { r: 240 - (i % 3) * 40, ry: 70, speed: 1.1 + (i % 4) * 0.25, phase: i * 0.8 }, dy: -120 - (i % 3) * 30, fadeIn: 0.4, fadeOut: 0.6 })),
    { type: 'motes', at: 0.2, count: 40, spread: 260, rise: [10, 50], life: [1, 1.8], size: 2.2, color: BUTTERFLY, dy: -110 });
function butterflySwarm(b, ctx, s) {
    const x = b.frontX() + 260;
    b.fx.play(SWARM(s.sec), x, FOOT_B, { alive: () => b.isActive });
}
butterflySwarm.preview = api => {
    const k = api.VFX_SCALE * 0.56, mid = (api.dummies[0].x + api.dummies[api.dummies.length - 1].x) / 2;
    api.vfx.play(SWARM(4), mid, api.GROUND_Y, { scale: k });
    api.dummies.forEach((d, i) => api.later(0.3 + i * 0.3, () => {
        api.vfx.play(BUTTERFLY_FLY(0.35, 70), d.x - 260 * k, api.GROUND_Y - 380 * k, { scale: k, to: [d.x, api.enemyChestY()] });
        api.later(0.35, () => api.vfx.play(BUTTERFLY_POP, d.x, api.enemyChestY(), { scale: k }));
    }));
};

// 나비 가루: 예전엔 노란 포자 한 번 → 나비 세 마리가 앞으로 날며 반짝이는 분홍 가루 구름을 뿌려 앞쪽을 덮고(1.4초), 금빛 반짝임이 내려앉음
const POWDER = fxOf(
    spr('spore_burst', 0, { width: 380, height: 230, frameRange: [3, 7], dur: 1.4, hue: 200, alpha: 0.85, anchorY: 0.85, softEdges: 0.2 }),
    spr('butterfly_red', 320, { frameRange: [6, 8], dur: 1.4, dy: -60, alpha: 0.9 }),
    { type: 'motes', at: 0.1, count: 34, spread: 170, rise: [-20, 40], life: [0.8, 1.4], size: 2.4, color: '255, 225, 160', dy: -70 });
function powderCloud(b, ctx, s) {
    const m = muzzleOf(b), x = b.frontX() + 130;
    for (let i = 0; i < 3; i++) b.fx.play(BUTTERFLY_FLY(0.5, 58), m[0], m[1] + i * 18, { to: [x + 80 + i * 50, FOOT_B + 80 + i * 22] });
    b.schedule(0.2, () => b.isActive && b.fx.play(POWDER, x, FOOT_B));
}
powderCloud.preview = api => {
    const k = api.VFX_SCALE * 0.56, m = api.muzzle(), x = api.CHAR_X + 230 * k;
    for (let i = 0; i < 3; i++) api.vfx.play(BUTTERFLY_FLY(0.5, 58), m[0], m[1] - i * 18 * k, { scale: k, to: [x + (80 + i * 50) * k, api.GROUND_Y - (80 + i * 22) * k] });
    api.later(0.2, () => api.vfx.play(POWDER, x, api.GROUND_Y, { scale: k }));
};

// 나비 실 화살: 예전엔 분홍 번개선 → 나비가 적에서 적으로 날아가며 분홍 실을 끌고, 실이 묶인 적들을 이은 채 속박 동안 남음
const butterflyTrail = threadTrail(sec => BUTTERFLY_FLY(sec, 72), BUTTERFLY, 5);

// ---- 흑철 재봉 기계 ----
// 기계 재봉 (필살기): 예전엔 가는 바늘 그림이 무작위 자리에 → 거대 재봉틀 바늘이 앞쪽을 왼쪽에서 오른쪽으로 가로지르며 12번 내리찍고,
//   찍을 때마다 쇳불꽃·땅 금·고리 + 흔들림, 지나간 자리에 붉은 바느질 솔기(땀)가 이어져 남음
const MACHINE_STAB = fxOf(
    spr('machine_needle', 300, { frameRange: [1, 7], dur: 0.45, anchorY: 0.92 }),
    { type: 'cracks', at: 0.12, dur: 0.9, count: 4, len: 50, color: '255, 120, 110' },
    { type: 'shockwave', at: 0.12, dur: 0.35, r: 80, width: 6, ground: true, color: '255, 110, 110' },
    { type: 'sparks', at: 0.12, count: 12, speed: 300, color: '255, 200, 150' },
    { type: 'debris', at: 0.12, count: 5, speed: 160, size: 2.5, color: '90, 80, 85' });
const SEAM = sec => fxOf({ type: 'threadPath', at: 0, dur: sec, mode: 'chain', color: '255, 70, 90', w: 3, sag: 0 });
function machineSew(b, ctx, s) {
    const n = Math.max(1, Math.round(s.n)), x0 = b.frontX() + 40, x1 = b.frontX() + 520, pts = [];
    b.fx.play(SEAM(n * 0.18 + 2.2), x0, FOOT_B + 2, { path: () => pts, alive: () => b.isActive });
    for (let i = 0; i < n; i++) b.schedule(i * 0.18, () => {
        if (!b.isActive) return;
        const x = x0 + (x1 - x0) * i / Math.max(1, n - 1) + (Math.random() - 0.5) * 16;
        b.fx.play(MACHINE_STAB, x, FOOT_B);
        b.schedule(0.12, () => {
            if (!b.isActive) return;
            pts.push([x, FOOT_B + 2]);
            enemiesNear(b, x, 45).forEach(e => kitHit(b, e, s.dmg, { status: { root: 1, mark: [6, 0.15] } }));
            b.director.shake(3, 120);
        });
    });
}
machineSew.preview = api => {
    const k = api.VFX_SCALE * 0.56, x0 = api.dummies[0].x - 40 * k, x1 = api.dummies[api.dummies.length - 1].x + 40 * k, pts = [];
    api.vfx.play(SEAM(3.5), x0, api.GROUND_Y, { scale: k, path: () => pts });
    for (let i = 0; i < 8; i++) api.later(i * 0.18, () => {
        const x = x0 + (x1 - x0) * i / 7;
        api.vfx.play(MACHINE_STAB, x, api.GROUND_Y, { scale: k });
        api.later(0.12, () => { pts.push([x, api.GROUND_Y]); api.shake(2, 0.1); });
    });
};

// 실 감기 장갑: 예전엔 붉은 부활 그림 한 번 → 붉은 실이 소용돌이치며 솟고, 6초 동안 강철빛 붉은 실 고리들이 몸을 감아 돎 + 쇳빛 번쩍
const ARMOR = sec => fxOf(
    spr('revive_crimson', 260, { frameRange: [1, 5], dur: 0.7 }),
    { type: 'threadWrap', at: 0.1, dur: sec, rx: 58, ry: 92, count: 10, color: '220, 70, 85' },
    { type: 'candleGlow', at: 0.1, dur: sec, r: 80, color: '200, 80, 90', dy: -90 },
    { type: 'sparks', at: 0.05, count: 12, speed: 260, color: '230, 220, 230', dy: -80 });
function threadArmorFx(b, ctx, s) {
    const me = () => [b.monsterX + 38, FOOT_B];
    b.fx.play(ARMOR(s.sec), ...me(), { follow: me, alive: () => b.isActive });
}
threadArmorFx.preview = api => api.vfx.play(ARMOR(2.5), api.CHAR_X, api.GROUND_Y, { scale: api.VFX_SCALE * 0.56 });

// 실 끌어당기기: 예전엔 쇳빛 번개선 → 기관포에서 재봉 바늘 네 개가 적에 꽂히고, 팽팽한 붉은 실이 적을 내 앞으로 끌어옴(실이 적을 따라 짧아짐)
//   → 도착하면 쇳불꽃 + 붉은 찌름
const PULL_NEEDLE = sec => fxOf(ITEM(4, 100, { dur: sec, travel: true, angleOffset: -Math.PI / 4 - 0.05 }));
const PULL_HIT = fxOf(spr('needle_crimson', 130, { frameRange: [2, 6], dur: 0.4 }), { type: 'sparks', at: 0, count: 8, speed: 220, color: '255, 200, 160' });
function pullThreads(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n || 4, s.range ?? ctx.range), m = muzzleOf(b);
    list.forEach((e, i) => b.fx.play(PULL_NEEDLE(0.12 + i * 0.02), ...m, { to: chest(e) }));
    b.fx.play(THREAD(0.95, 'fan', 0.12, '255, 80, 95'), ...m, { path: () => [muzzleOf(b), ...list.filter(e => alive(b, e)).map(chest)], alive: () => b.isActive });
    b.schedule(0.5, () => list.forEach(e => alive(b, e) && b.fx.play(PULL_HIT, ...chest(e))));
}
pullThreads.preview = api => {
    const m = api.muzzle(), y = api.enemyChestY(), k = api.VFX_SCALE * 0.56, ds = api.dummies.slice(0, 4);
    ds.forEach(d => api.vfx.play(PULL_NEEDLE(0.14), ...m, { scale: k, to: [d.x, y] }));
    api.vfx.play(THREAD(0.95, 'fan', 0.12, '255, 80, 95'), ...m, { scale: k, path: () => [m, ...ds.map(d => [d.x, y])] });
    api.later(0.5, () => ds.forEach(d => api.vfx.play(PULL_HIT, d.x, y, { scale: k })));
};

// ---- 운명의 직조자 ----
// 운명 재봉 (필살기): 예전엔 큰 실 문양 한 번 + 끝에 작은 금빛 터짐 → 하늘에 운명의 실 문양이 짜이고 모든 적이 하늘에서 내려온 금실에
//   꼭두각시처럼 매달림(4초, 적을 따라감) → 하늘에 금 가위가 나타나 싹둑 → 실이 끊기며 적마다 꿰인 수만큼 커지는 금빛 폭발 + 큰 흔들림
const FATE_SIGIL2 = fxOf(spr('fate_thread', 340, { dur: 1.1, frameRange: [0, 7], glow: 1.2 }));
const PUPPET = sec => fxOf({ type: 'threadPath', at: 0, dur: sec, mode: 'chain', reveal: 0.25, color: GOLD, w: 2.2, sag: 0 },
    { type: 'candleGlow', at: 0.2, dur: sec - 0.2, r: 36, color: GOLD });
const SCISSORS = fxOf(ITEM2(4, 170, { dur: 0.6, popIn: 0.2, squash: 0.85, fadeOut: 0.2, glow: 1.2 }),
    { type: 'flash', at: 0.35, dur: 0.18, r: 120, color: GOLD },
    { type: 'sparks', at: 0.35, count: 16, speed: 320, color: '255, 235, 170' });
const FATE_BOOM = n => fxOf(spr('golden_burst', Math.min(320, 150 + n * 20), { glow: 1.3 }),
    { type: 'domeWave', at: 0, dur: 0.7, r: Math.min(220, 100 + n * 15), h: 0.5, color: GOLD },
    { type: 'sparks', at: 0, count: 14, speed: 340, color: '255, 230, 160' });
function fateSew(b, ctx, s) {
    const list = onScreen(b), top = TOP_B(b);
    if (!list.length) return;
    const mid = (Math.min(...list.map(e => aimAt(e).x)) + Math.max(...list.map(e => aimAt(e).x))) / 2;
    b.fx.play(FATE_SIGIL2, mid, top - 110);
    list.forEach(e => {
        b.kitStatus(e, { stun: s.sec, thread: s.sec });
        b.fx.play(PUPPET(s.sec), aimAt(e).x, top, { path: () => [[aimAt(e).x, top], chest(e)], follow: () => chest(e), alive: () => alive(b, e) });
    });
    b.schedule(s.sec - 0.4, () => b.isActive && b.fx.play(SCISSORS, mid, top - 60));
    const n = list.length, mul = 1 + 0.15 * n;
    b.schedule(s.sec, () => {
        if (!b.isActive) return;
        b.director.shake(Math.min(14, 6 + n), 450);
        list.forEach((e, i) => b.schedule(i * 0.06, () => {
            if (!b.enemies.includes(e)) return;
            b.fx.play(FATE_BOOM(n), ...chest(e));
            kitHit(b, e, s.dmg * mul, { knock: 1 });
        }));
    });
}
fateSew.preview = api => {
    const k = api.VFX_SCALE * 0.56, y = api.enemyChestY(), top = api.GROUND_Y - 400 * k, ds = api.dummies;
    const mid = (ds[0].x + ds[ds.length - 1].x) / 2;
    api.vfx.play(FATE_SIGIL2, mid, top + 110 * k, { scale: k });
    ds.forEach(d => api.vfx.play(PUPPET(2), d.x, top, { scale: k, path: () => [[d.x, top], [d.x, y]], follow: () => [d.x, y] }));
    api.later(1.6, () => api.vfx.play(SCISSORS, mid, top + 60 * k, { scale: k }));
    api.later(2, () => { ds.forEach(d => api.vfx.play(FATE_BOOM(ds.length), d.x, y, { scale: k })); api.shake(8, 0.4); });
};

// 생명의 직물: 예전엔 금빛 터짐 한 번 → 금실 천 두 폭이 몸 둘레를 감아 돌며 금빛 기둥이 솟고, 아군마다 금빛 회복 기둥,
//   8초 동안 발밑에 금빛 기운(공격 +50%)
const FABRIC = fxOf(
    ...[0, Math.PI].map(ph => ITEM2(5, 150, { dur: 1.5, orbit: { r: 70, ry: 26, speed: 4.2, phase: ph }, dy: -80, fadeIn: 0.15, fadeOut: 0.4, popIn: 0.3 })),
    spr('pillar_gold', 260, { frameRange: [1, 6], dur: 0.9, anchorY: 0.9 }),
    { type: 'motes', at: 0.1, count: 26, spread: 70, rise: [40, 120], life: [0.7, 1.2], size: 2.4, color: HOLY, dy: -40 });
const FABRIC_ALLY = fxOf(spr('pillar_gold', 170, { frameRange: [1, 6], dur: 0.8, anchorY: 0.9 }),
    { type: 'motes', at: 0.1, count: 10, spread: 30, rise: [30, 80], life: [0.6, 1], size: 2, color: HERB, dy: -30 });
const FABRIC_AURA = (sec, size) => fxOf(spr('power_aura', size, { dur: sec, frameRange: [1, 2], loopSec: 0.7, pingPong: true, anchorY: 0.88, hue: 10, alpha: 0.6, fadeIn: 0.3, fadeOut: 0.6 }));
function lifeFabricFx(b, ctx, s) {
    const me = () => [b.monsterX + 38, FOOT_B];
    b.fx.play(FABRIC, ...me(), { follow: me });
    b.fx.play(FABRIC_AURA(s.sec, 170), ...me(), { follow: me, alive: () => b.isActive });
    (b.allies || []).forEach(a => {
        const at = () => [a.x + 38, FOOT_B];
        b.fx.play(FABRIC_ALLY, ...at(), { follow: at });
        b.fx.play(FABRIC_AURA(s.sec, 120), ...at(), { follow: at, alive: () => b.isActive && b.allies.includes(a) });
    });
}
lifeFabricFx.preview = api => {
    const k = api.VFX_SCALE * 0.56;
    api.vfx.play(FABRIC, api.CHAR_X, api.GROUND_Y, { scale: k });
    api.vfx.play(FABRIC_AURA(2.5, 170), api.CHAR_X, api.GROUND_Y, { scale: k });
};

// 천 갈래 실: 예전엔 금빛 번개선 → 금빛 바늘 10개가 대바늘에서 흩어져 적에 꽂히고, 팽팽한 금실이 3초 동안 적을 따라 이어짐
//   → 당길 때 실이 번쩍이며 적마다 금빛 터짐 + 앞으로 끌려옴
const THREAD_SNAP = fxOf(spr('golden_burst', 130), { type: 'sparks', at: 0, count: 10, speed: 260, color: '255, 235, 170' });
function thousandThreads(b, ctx, s) {
    const list = pickTargets(b, 'random', s.n, b.playerRange + 300), m = muzzleOf(b);
    list.forEach((e, i) => {
        b.kitStatus(e, { thread: s.delay + 1 });
        b.schedule(i * 0.03, () => alive(b, e) && b.fx.play(FAN_NEEDLE(0.16), ...muzzleOf(b), { to: chest(e) }));
    });
    const path = () => [muzzleOf(b), ...list.filter(e => alive(b, e)).map(chest)];
    b.fx.play(THREAD(s.delay + 0.5, 'fan', 0.35, GOLD), ...m, { path, alive: () => b.isActive });
    b.schedule(s.delay, () => {
        if (!b.isActive) return;
        b.fx.play(fxOf({ type: 'threadPath', at: 0, dur: 0.45, mode: 'fan', color: '255, 245, 200', w: 4.5 }), ...muzzleOf(b), { path });
        b.director.shake(5, 220);
        list.forEach(e => {
            if (!b.enemies.includes(e)) return;
            b.fx.play(THREAD_SNAP, ...chest(e));
            kitHit(b, e, s.dmg, { knock: 0 });
            if (b.enemies.includes(e) && isUnit(e) && !e.boss && b.pullEnemy) { b.pullEnemy(e, b.frontX() + 40, 0.3); b.kitPushed?.(e); }
        });
    });
}
thousandThreads.preview = api => {
    const m = api.muzzle(), y = api.enemyChestY(), k = api.VFX_SCALE * 0.56, ds = api.dummies;
    ds.forEach((d, i) => api.later(i * 0.03, () => api.vfx.play(FAN_NEEDLE(0.16), ...m, { scale: k, to: [d.x, y] })));
    api.vfx.play(THREAD(2, 'fan', 0.35, GOLD), ...m, { scale: k, path: () => [m, ...ds.map(d => [d.x, y])] });
    api.later(1.5, () => ds.forEach(d => api.vfx.play(THREAD_SNAP, d.x, y, { scale: k })));
};

// ---- 진홍 장미 성녀 ----
// 장미 정원 (필살기): 예전엔 장미 꽃잎 몇 번 → 8초 동안 장판 너비 바닥에 가시 넝쿨 덤불이 차례로 자라나고 큰 장미가 피며, 꽃잎이 흩날리고
//   바닥이 진홍빛 — 3초마다 넝쿨이 적 발밑에서 솟아 감음(속박)
const ROSE_BUSH = (sec, i, remaining) => fxOf(ITEM2(2, 150 + (i % 3) * 20, { dur: sec, anchorY: 0.86, growIn: 0.45, at: i * 0.08, fadeOut: 0.6, remaining }));
const ROSE_BLOOM = (sec, i, remaining) => fxOf(ITEM2(3, 40 + (i % 2) * 12, { at: 0.4 + i * 0.1, dur: sec, popIn: 0.3, fadeOut: 0.6, remaining }));
const ROSE_FLOOR = (sec, w, remaining) => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: w * 0.6, ground: true, color: ROSE, remaining });
const VINE_BIND = sec => fxOf(spr('rose_petal', 170, { frameRange: [2, 4], dur: 0.45, anchorY: 0.9 }),
    spr('rose_petal', 170, { at: 0.45, frameRange: [4, 4], dur: Math.max(0.1, sec - 0.45), anchorY: 0.9, fadeOut: 0.3 }),
    spr('rose_petal', 170, { at: sec, frameRange: [6, 8], dur: 0.5, anchorY: 0.9 }));
function roseGarden(b, ctx, s) {
    const z = b.kitZone({ tag: 'rose', x: 0, w: 430, sec: s.sec, dps: 0.4, status: { root: 1 }, every: 3, allyHeal: 0.02,
        puff: V.motes(ROSE, 6), puffEvery: 0.25, puffB: 90 });
    if (!z) return;
    const live = () => b.kitZones.includes(z), rem = () => z.t, at = dx => () => [z.x + dx, FOOT_B];
    b.fx.play(ROSE_FLOOR(s.sec, z.w, rem), ...at(z.w / 2)(), { follow: at(z.w / 2), alive: live });
    for (let i = 0; i < 6; i++) b.fx.play(ROSE_BUSH(s.sec, i, rem), ...at(z.w * (i + 0.5) / 6)(), { follow: at(z.w * (i + 0.5) / 6), alive: live });
    for (let i = 0; i < 5; i++) {
        const dx = z.w * (i + 0.7) / 5.6, lift = 28 + (i % 3) * 18;
        b.fx.play(ROSE_BLOOM(s.sec, i, rem), z.x + dx, FOOT_B + lift, { follow: () => [z.x + dx, FOOT_B + lift], alive: live });
    }
    [0.05, 3, 6].forEach(t => b.schedule(t, () => {
        if (!b.isActive || !live()) return;
        b.enemies.filter(e => isUnit(e) && aimAt(e).x > z.x && aimAt(e).x < z.x + z.w).slice(0, 10)
            .forEach(e => b.fx.play(VINE_BIND(1.2), aimAt(e).x, FOOT_B, { follow: () => [aimAt(e).x, FOOT_B], alive: () => alive(b, e) }));
    }));
}
roseGarden.preview = api => {
    const k = api.VFX_SCALE * 0.56, x0 = api.dummies[0].x - 60 * k, w = (api.dummies[api.dummies.length - 1].x - x0) / k + 80;
    api.vfx.play(ROSE_FLOOR(3, w), x0 + w * k / 2, api.GROUND_Y, { scale: k });
    for (let i = 0; i < 6; i++) api.vfx.play(ROSE_BUSH(3, i), x0 + w * k * (i + 0.5) / 6, api.GROUND_Y, { scale: k });
    for (let i = 0; i < 5; i++) api.vfx.play(ROSE_BLOOM(3, i), x0 + w * k * (i + 0.7) / 5.6, api.GROUND_Y - (28 + (i % 3) * 18) * k, { scale: k });
    api.dummies.forEach(d => api.vfx.play(VINE_BIND(1.2), d.x, api.GROUND_Y, { scale: k }));
};

// 꽃잎 폭풍: 예전엔 꽃잎 점 몇 개 → 4초 동안 몸 둘레에 진홍 꽃잎 회오리(코드 꽃잎 수십 장이 돌며 오르내림) + 장미 소용돌이 그림 + 큰 장미가 가운데서 핌
const PETAL_STORM = sec => fxOf(
    { type: 'petalVortex', at: 0, dur: sec, rx: 135, h: 190, count: 54 },
    spr('rose_petal', 300, { dur: sec, frameRange: [4, 6], loopSec: 0.9, pingPong: true, anchorY: 0.9, alpha: 0.55, fadeIn: 0.3, fadeOut: 0.5 }),
    ITEM2(3, 70, { dur: sec, dy: -95, popIn: 0.3, fadeOut: 0.4, alpha: 0.9 }),
    { type: 'shockwave', at: 0, dur: 0.5, r: 180, width: 10, ground: true, color: ROSE });
function petalStormFx(b, ctx, s) {
    const me = () => [b.monsterX + 38, FOOT_B];
    b.fx.play(PETAL_STORM(s.sec), ...me(), { follow: me, alive: () => b.isActive });
}
petalStormFx.preview = api => api.vfx.play(PETAL_STORM(2.5), api.CHAR_X, api.GROUND_Y, { scale: api.VFX_SCALE * 0.56 });

// 넝쿨 포박: 예전엔 바늘 반짝임 → 가시 채찍이 앞을 휘감고, 적 네 명 발밑에서 가시 넝쿨 덤불이 솟아 감고(속박 3초 동안 남음)
//   넝쿨 기둥이 몸을 휘감았다가 부서짐 + 초록 독 기운
const VINE_HOLD = sec => fxOf(ITEM2(2, 130, { dur: sec, anchorY: 0.86, growIn: 0.25, fadeOut: 0.4 }),
    { type: 'motes', at: 0.2, count: 8, spread: 26, rise: [10, 50], life: [0.6, 1], size: 2, color: '140, 230, 110', dy: -30 });
const WHIP = fxOf(spr('cleave_crimson', 230, { dur: 0.35, hue: -10 }));
function vineBindFx(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, s.range ?? ctx.range);
    b.fx.play(WHIP, b.frontX() + 70, FOOT_B + 70);
    list.forEach((e, i) => b.schedule(0.05 + i * 0.05, () => {
        if (!alive(b, e)) return;
        const at = () => [aimAt(e).x, FOOT_B];
        b.fx.play(VINE_BIND(3), ...at(), { follow: at, alive: () => alive(b, e) });
        b.fx.play(VINE_HOLD(3), ...at(), { follow: at, alive: () => alive(b, e) });
    }));
}
vineBindFx.preview = api => {
    const k = api.VFX_SCALE * 0.56;
    api.vfx.play(WHIP, api.CHAR_X + 120 * k, api.GROUND_Y - 70 * k, { scale: k });
    api.dummies.slice(0, 4).forEach(d => { api.vfx.play(VINE_BIND(2), d.x, api.GROUND_Y, { scale: k }); api.vfx.play(VINE_HOLD(2), d.x, api.GROUND_Y, { scale: k }); });
};

export const SAINT_SETS2 = packOf('saint', [
    // ---- 레어 ① 종지기 수녀 (1차 계획) — 종소리로 기절시키고 아군을 북돋는 근접 지원 ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '종지기 수녀', style: 'support', tint: 'sepia(0.5) saturate(1.5) brightness(1.15)',
        bonus: { 4: '기절한 적에게 주는 피해 +20%' },
        kit: { 4: { target: [{ when: 'status', status: 'stun', dmg: 0.2 }] } },
        head: { name: '종 장식 베일', look: '작은 금종이 달린 흰 베일', skill: 'stBellToll', desc: '필살기 만종: 큰 종이 울려 화면 적 2초 기절 + 꿰맨 아군 체력 50% 회복·8초 공격 +50%', stats: { hp: 800, dps: 90, range: 20, speed: 10 } },
        body: { name: '촛불 수도복', look: '허리에 촛대·초 장식', skill: 'stCandles', desc: '봉헌의 촛불: 8초간 촛불 자리 — 나·아군 초당 회복, 다가온 적 불티 피해', stats: { hp: 1900, dps: 70, range: 0, speed: 10 } },
        arm: { name: '종 추 철퇴', look: '사슬에 매단 종 모양 철퇴', skill: 'stBellStrike', desc: '기본 공격 종 추 내려치기 (3번째마다 짧은 기절) · 종 추 강타: 앞쪽 내려쳐 피해 + 1초 기절', stats: { hp: 550, dps: 500, range: 180, speed: 0 },
            kitAttack: { kind: 'melee', vfx: V.impact(40, 110, { dur: 0.35 }), splash: 60, splashMul: 0.4, nth: { n: 3, status: { stun: 0.5 } } } },
        leg: { name: '순례자 장화', look: '끈을 동여맨 낡은 장화', desc: '순례의 행렬: 아군이 있으면 진격 속도 +15%, 받는 피해 -10%', stats: { hp: 850, dps: 50, range: 0, speed: 105 },
            passive: { name: '순례의 행렬', desc: '아군(꿰맨 아군 등)이 있으면 진격 속도 +15%, 받는 피해 -10%', self: [{ when: 'allies', n: 1, mods: { move: 0.15, def: 0.1 } }] } },
        skills: {
            stBellToll: { name: '만종', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#ffd782', target: 'enemy', range: 600, clip: 'cast', sfx: 'saint_seal',
                desc: '큰 종이 울려 화면 적 2초 기절 + 꿰맨 아군 체력 50% 회복·8초 공격 +50%',
                steps: [{ at: 0.05, do: 'custom', fn: bellToll, preview: bellToll.preview },
                    { at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { stun: 2 }, vfx: V.gold(0, 90, { dur: 0.35 }), maxFx: 10 },
                    { at: 0.45, do: 'heal', allies: true, allyRatio: 0.5 }, { at: 0.45, do: 'buff', key: 'bellToll', sec: 8, mods: { allyDmg: 0.5 } }] },
            stCandles: { name: '봉헌의 촛불', slot: 'body', cd: 15, icon: 'fire', color: '#ffd782', target: 'self', clip: 'cast',
                desc: '8초간 촛불 자리 — 안의 나·아군 초당 회복, 다가온 적 불티 피해',
                steps: [{ at: 0.45, do: 'custom', fn: offerCandles, sec: 8, preview: offerCandles.preview }] },
            stBellStrike: { name: '종 추 강타', slot: 'arm', cd: 9, icon: 'hammer', color: '#ffd782', target: 'enemy', range: 150, clip: 'slam',
                desc: '앞쪽 내려쳐 피해 + 1초 기절 + 음파',
                steps: [{ at: 0.42, do: 'hit', pick: 'all', range: 150, dmg: 1.8, status: { stun: 1 }, knock: 0.8, vfx: V.gold(0, 100, { dur: 0.35 }) },
                    { at: 0.42, do: 'fx', x: 50, vfx: BELL_STRIKE }, { at: 0.42, do: 'shake', power: 6, ms: 220 }] }
        }
    },

    // ---- 레어 ② 붉은 실 재봉사 (1차 계획) — 실로 적을 이어 피해를 퍼뜨리는 원거리 ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '붉은 실 재봉사', style: 'range', tint: 'hue-rotate(-20deg) saturate(1.8) brightness(0.95)',
        bonus: { 4: '실로 이어진 적이 쓰러지면 실이 가장 가까운 적에게 옮겨 붙음' },
        kit: { 4: { on: [{ when: 'kill', fn: threadJump }] } },
        head: { name: '실타래 관', look: '머리 위로 떠도는 붉은 실타래들', skill: 'stFateThread', desc: '필살기 운명의 실타래: 6초간 화면 모든 적을 붉은 실로 이음 — 한 적이 받은 피해의 30%가 이어진 적 모두에게', stats: { hp: 700, dps: 110, range: 40, speed: 10 } },
        body: { name: '실 고치 드레스', look: '실을 겹겹이 감은 드레스', skill: 'stCocoon', desc: '실 고치: 4초간 받는 피해 -60%, 끝나면 실이 사방으로 튀어 피해', stats: { hp: 1700, dps: 90, range: 0, speed: 10 } },
        arm: { name: '긴 재봉 바늘', look: '창처럼 긴 바늘, 실패 달린 팔', skill: 'stStitchChain', desc: '꿰매기 사슬: 바늘이 적 4명을 차례로 꿰뚫고 실로 묶음 + 2초 속박', stats: { hp: 400, dps: 500, range: 280, speed: 0 } },
        leg: { name: '실 그물 신발', look: '발끝에서 실이 풀려 나오는 신발', desc: '실 그물 걸음: 걸은 자리에 실이 남아 밟은 적 느려짐', stats: { hp: 750, dps: 60, range: 0, speed: 115 },
            passive: { name: '실 그물 걸음', desc: '걸은 자리에 실이 2초 남아 밟은 적 느려짐', step: { do: 'zone', tag: 'web', x: -50, w: 60, sec: 2, slow: true, puff: V.needle(0, 40, { dur: 0.4 }), puffEvery: 0.7 } } },
        skills: {
            stFateThread: { name: '운명의 실타래', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#eb2846', target: 'enemy', range: 600, clip: 'cast',
                desc: '6초간 화면 모든 적을 붉은 실로 이음 — 한 적이 받은 피해의 30%가 이어진 적 모두에게',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { thread: 6 }, vfx: V.needle(0, 90), maxFx: 10 },
                    { at: 0.45, do: 'custom', fn: fateWeb, sec: 6, preview: fateWeb.preview }] },
            stCocoon: { name: '실 고치', slot: 'body', cd: 14, icon: 'shield', color: '#eb2846', target: 'self', clip: 'cast',
                desc: '4초간 실 고치 — 받는 피해 -60%, 끝나면 실이 사방으로 튀어 피해',
                steps: [{ do: 'buff', key: 'cocoon', sec: 4, mods: { def: 0.6, onEnd: { do: 'custom', fn: cocoonBurst } } },
                    { do: 'custom', fn: cocoonWrap, sec: 4, preview: cocoonWrap.preview }] },
            stStitchChain: { name: '꿰매기 사슬', slot: 'arm', cd: 8, icon: 'chain', color: '#eb2846', target: 'enemy', range: 300, clip: 'triple',
                desc: '바늘이 적 4명을 차례로 꿰뚫고 실로 묶음 — 2초 속박',
                steps: [{ at: 0.2, do: 'chain', n: 4, range: 300, jump: 170, gap: 0.12, dmg: 1, decay: 0.95, status: { root: 2, thread: 4 }, hitVfx: V.needle(0, 70),
                    trail: stitchTrail, trailPreview: stitchTrail.preview }] }
        }
    },

    // ---- 유니크 ① 천 개의 실 날개 (1차 계획) — 실로 짠 날개로 떠올라 하늘에서 꿰매는 모습 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '천 개의 실 날개', style: 'balance', tint: 'sepia(0.3) saturate(1.6) brightness(1.2) drop-shadow(0 0 5px rgba(255, 215, 130, 0.8))',
        bonus: { 2: '꿰맬 수 있는 아군 수 +2', 4: '꿰맨 아군이 쓰러질 때 실이 터져 주변 적 피해 + 1초 속박' },
        kit: { 2: { mods: { allyMax: 2 } }, 4: { on: [{ when: 'allyDown', fn: (b, info) => {
            const a = info.ally;
            if (!a || a.kind !== 'stitch') return;
            b.fx.play(V.needle(0, 120), a.x + 38, FOOT_B + 50);
            enemiesNear(b, a.x + 38, 110, true).forEach(e => kitHit(b, e, 1, { knock: 0.4, status: { root: 1 } }));
        } }] } },
        head: { name: '실타래 고리 베일', look: '머리 위를 도는 금빛 실 고리, 붉은 실로 풀리는 베일', skill: 'stSalvation', desc: '필살기 구원의 비: 8초간 빛 바늘 비 — 맞은 적 피해, 이 동안 쓰러진 적 최대 5명이 꿰맨 아군으로', stats: { hp: 900, dps: 130, range: 40, speed: 10 } },
        body: { name: '실 날개 드레스', look: '등에 붉은 실로 짠 큰 날개 한 쌍, 금빛 수', skill: 'stGuardThread', desc: '수호 실타래: 나와 아군 모두에게 6초간 실 보호막 (최대 체력 20%)', stats: { hp: 2100, dps: 100, range: 0, speed: 10 } },
        arm: { name: '빛 바늘 석궁', look: '팔에 얹은 작은 석궁, 화살 대신 긴 바늘', skill: 'stThousandNeedles', desc: '기본 공격 바늘 2연사 (봉합 표식) · 천의 바늘: 앞쪽 부채꼴로 바늘 — 맞은 적 1초 속박', stats: { hp: 500, dps: 560, range: 300, speed: 0 },
            kitAttack: { kind: 'shot', n: 2, gap: 0.1, color: HOLY, fly: LIGHT_ARROW, flyFrom: [-30, 4], dur: 0.2, vfx: ARROW_HIT, onHit: (b, e) => b.markStitch?.(e) } },
        leg: { name: '떠 있는 실 신발', look: '땅에서 살짝 뜬 발, 늘어진 실', desc: '떠 있는 성녀: 장판·넉백 무시, 근접 피해 -20%', stats: { hp: 900, dps: 70, range: 0, speed: 130 },
            passive: { name: '떠 있는 성녀', desc: '장판·넉백 무시, 근접 피해 -20%', flags: ['knockImmune', 'ignoreHazard'], incoming: [{ when: 'melee', def: 0.2 }] } },
        skills: {
            stSalvation: { name: '구원의 비', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#ffd782', target: 'enemy', range: 520, clip: 'cast', sfx: 'saint_revive',
                desc: '8초간 화면에 빛 바늘 비 — 맞은 적 피해, 이 동안 쓰러진 적 최대 5명이 꿰맨 아군으로 일어남',
                steps: [{ at: 0.4, do: 'buff', key: 'salvation', sec: 8.2, mods: { raise: 5 } },
                    { at: 0.45, do: 'custom', fn: salvationSky, sec: 8.2, preview: salvationSky.preview },
                    { at: 0.45, do: 'rain', count: 32, every: 0.25, x: [30, 520], radius: 55, dmg: 0.5, fall: LIGHT_NEEDLE(0.2), delay: 0.2, vfx: SALV_HIT }] },
            stGuardThread: { name: '수호 실타래', slot: 'body', cd: 15, icon: 'shield', color: '#ffd782', target: 'self', clip: 'cast',
                desc: '나와 아군 모두에게 6초간 실 보호막 (최대 체력 20%)',
                steps: [{ at: 0.45, do: 'shield', ratio: 0.2, sec: 6, allies: true, color: HOLY, quiet: true },
                    { at: 0.45, do: 'custom', fn: guardThread, sec: 6, preview: guardThread.preview }] },
            stThousandNeedles: { name: '천의 바늘', slot: 'arm', cd: 9, icon: 'stitch', color: '#ffd782', target: 'enemy', range: 320, clip: 'triple',
                desc: '앞쪽 부채꼴로 바늘 12개 — 맞은 적 1초 속박',
                steps: [{ at: 0.2, do: 'custom', fn: needleFan, preview: needleFan.preview },
                    { at: 0.32, do: 'hit', pick: 'all', range: 320, times: 3, every: 0.12, dmg: 0.4, status: { root: 1 }, vfx: NEEDLE_PIN }] }
        }
    },

    // ---- 레어 ③ 약초 치유사 (지원) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '약초 치유사', style: 'support', tint: 'hue-rotate(80deg) saturate(1.1) brightness(1.15)',
        bonus: { 4: '치유의 비 동안 쓰러진 적 2명이 꿰맨 아군으로' },
        kit: { 4: { patch: { stHealRain: { raise: 2 } } } },
        head: { name: '약초 화관 베일', look: '약초 화관을 얹은 베일', skill: 'stHealRain', desc: '필살기 치유의 비: 8초간 초록 빛비 — 나·아군 초당 3% 회복, 적 느려짐' },
        body: { name: '약초 주머니 수도복', look: '약초 주머니를 단 수도복', skill: 'stHerbSmoke', desc: '약초 연기: 앞 적 5초 독 연기 + 내 해로운 효과 풀림' },
        arm: { name: '약병 투척 팔', look: '허리에 약병을 찬 팔', skill: 'stPotionThrow', desc: '약병 투척: 약병 3개 — 터진 자리 3초 장판 (적 피해·나·아군 회복)' },
        leg: { name: '약초밭 장화', look: '흙 묻은 약초밭 장화', desc: '약효: 회복량 +25%',
            passive: { name: '약효', desc: '내 회복량 +25%', mods: { healAmp: 0.25 } } },
        skills: {
            stHealRain: { name: '치유의 비', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#96ffa0', target: 'self', clip: 'cast', p: { raise: 0 },
                desc: '8초간 초록 빛비 — 나·아군 초당 3% 회복, 적 느려짐',
                steps: [{ at: 0.45, do: 'buff', key: 'healRain', sec: 8, mods: { regen: 0.03, raise: '$raise' } },
                    { at: 0.45, do: 'custom', fn: healRain, sec: 8, preview: healRain.preview }] },
            stHerbSmoke: { name: '약초 연기', slot: 'body', cd: 13, icon: 'spore', color: '#96ffa0', target: 'enemy', range: 220, clip: 'cast',
                desc: '앞 적에게 5초 독 연기 + 내 해로운 효과 풀림',
                steps: [{ do: 'cleanse' }, { at: 0.45, do: 'custom', fn: herbSmoke, sec: 5, preview: herbSmoke.preview }] },
            stPotionThrow: { name: '약병 투척', slot: 'arm', cd: 8, icon: 'syringe', color: '#96ffa0', target: 'enemy', range: 320, clip: 'throw',
                desc: '약병 3개를 던짐 — 터진 자리 3초 장판 (적 피해·나·아군 회복)',
                steps: [{ at: 0.35, do: 'rain', count: 3, every: 0.15, radius: 60, dmg: 0.8, lob: { speed: 700, sprite: POTION }, vfx: POTION_BURST,
                    zone: { field: 'herb', w: 120, sec: 3, dps: 0.3, heal: 0.02, allyHeal: 0.02 } }] }
        }
    },

    // ---- 레어 ④ 눈물의 조각상 (탱커) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '눈물의 조각상', style: 'tank', tint: 'grayscale(0.7) brightness(1.3) contrast(1.05)',
        bonus: { 4: '석화 +1.5초' },
        kit: { 4: { patch: { stPetrify: { sec: 1.5 } } } },
        head: { name: '대리석 베일', look: '대리석으로 굳은 베일', skill: 'stPetrify', desc: '필살기 석화의 눈물: 화면 적 3초 돌로 굳음 (멈춤, 받는 피해 +30%)' },
        body: { name: '대리석 수도복', look: '대리석 결의 흰 수도복', skill: 'stStatue', desc: '석상 자세: 4초간 받는 피해 -80%, 끝날 때 돌 조각 폭발' },
        arm: { name: '대리석 손', look: '거대한 대리석 손', skill: 'stStonePalm', desc: '돌 손바닥: 앞 적 하나 내려쳐 2초 기절' },
        leg: { name: '석좌 다리', look: '석좌 받침 같은 다리', desc: '굳건함: 밀려나지 않음, 기절 시간 -50%',
            passive: { name: '굳건함', desc: '밀려나지 않음, 감속·기절·속박 시간 -50%', flags: ['knockImmune'], mods: { ccCut: 0.5 } } },
        skills: {
            stPetrify: { name: '석화의 눈물', slot: 'head', ult: true, cd: 0, icon: 'icecage', color: '#dcdce6', target: 'enemy', range: 600, clip: 'cast', p: { sec: 3 },
                desc: '화면 적이 3초 돌로 굳음 — 멈추고 받는 피해 +30%',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.6, status: { stun: '$sec', vuln: ['$sec', 0.3] } },
                    { at: 0.45, do: 'custom', fn: petrifyAll, sec: '$sec', preview: petrifyAll.preview }] },
            stStatue: { name: '석상 자세', slot: 'body', cd: 14, icon: 'shield', color: '#dcdce6', target: 'self', clip: 'cast',
                desc: '4초간 받는 피해 -80% — 끝날 때 돌 조각 폭발',
                steps: [{ do: 'buff', key: 'statue', sec: 4, mods: { def: 0.8, onEnd: { do: 'hit', pick: 'all', range: 180, dmg: 1.5, knock: 0.8, vfx: V.impact(0, 140) } }, vfx: V.impact(0, 200) }] },
            stStonePalm: { name: '돌 손바닥', slot: 'arm', cd: 8, icon: 'hand', color: '#dcdce6', target: 'enemy', range: 130, clip: 'slam',
                desc: '앞 적 하나를 내려쳐 2초 기절',
                steps: [{ at: 0.26, do: 'custom', fn: stonePalm, range: 130, preview: stonePalm.preview },
                    { at: 0.42, do: 'hit', pick: 'nearest', range: 130, dmg: 2, status: { stun: 2 }, knock: 0.8 }] }
        }
    },

    // ---- 유니크 ② 나비 실 수녀 (사거리) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '나비 실 수녀', style: 'range', tint: 'hue-rotate(-35deg) saturate(1.7) brightness(1.1)',
        bonus: { 2: '나비 떼 +10', 4: '도취한 적에게 피해 +30%' },
        kit: { 2: { patch: { stButterflies: { n: 10 } } }, 4: { target: [{ when: 'status', status: 'weak', dmg: 0.3 }] } },
        head: { name: '나비 베일', look: '붉은 나비가 앉은 베일', skill: 'stButterflies', desc: '필살기 나비 떼의 춤: 8초간 붉은 나비 30마리 — 피해, 쓰러진 적 최대 3명 꿰맨 아군' },
        body: { name: '나비 날개 드레스', look: '붉은 나비 날개 드레스', skill: 'stPowder', desc: '나비 가루: 앞 적 4초 도취 (주는 피해 -50%, 느려짐)' },
        arm: { name: '나비 실 장갑', look: '금 실이 감긴 장갑', skill: 'stButterflyArrow', desc: '나비 실 화살: 나비 5마리가 실을 끌고 날아가 적 5명을 이어 2초 속박' },
        leg: { name: '나비 날개 구두', look: '나비 날개 장식 구두', desc: '나풀 걸음: 원거리 공격 25% 피함',
            passive: { name: '나풀 걸음', desc: '원거리 공격 25%를 피함', mods: { dodgeRanged: 0.25 } } },
        skills: {
            stButterflies: { name: '나비 떼의 춤', slot: 'head', ult: true, cd: 0, icon: 'fan', color: '#ff5a6e', target: 'enemy', range: 480, clip: 'cast', p: { n: 30 },
                desc: '8초간 붉은 나비 30마리 — 닿은 적 피해, 쓰러진 적 최대 3명 꿰맨 아군',
                steps: [{ at: 0.4, do: 'buff', key: 'butterflies', sec: 8.2, mods: { raise: 3 } },
                    { at: 0.45, do: 'custom', fn: butterflySwarm, sec: 8.2, preview: butterflySwarm.preview },
                    { at: 0.45, do: 'rain', count: '$n', every: 0.26, x: [30, 480], radius: 45, dmg: 0.4, fall: BUTTERFLY_FLY(0.35, 70), fallDx: -260, delay: 0.35,
                        vfx: BUTTERFLY_POP, vfxB: FOOT_B + 55 }] },
            stPowder: { name: '나비 가루', slot: 'body', cd: 14, icon: 'spore', color: '#ff5a6e', target: 'enemy', range: 260, clip: 'cast',
                desc: '앞 적 4초 도취 — 주는 피해 -50%, 느려짐',
                steps: [{ at: 0.3, do: 'custom', fn: powderCloud, preview: powderCloud.preview },
                    { at: 0.6, do: 'hit', pick: 'all', range: 260, dmg: 0.2, status: { weak: [4, 0.5], slow: 4 }, vfx: V.motes(BUTTERFLY, 10) }] },
            stButterflyArrow: { name: '나비 실 화살', slot: 'arm', cd: 8, icon: 'chain', color: '#ff5a6e', target: 'enemy', range: 350, clip: 'throw',
                desc: '나비 5마리가 실을 끌고 날아가 적 5명을 이어 2초 속박',
                steps: [{ at: 0.35, do: 'chain', n: 5, range: 350, jump: 180, gap: 0.12, dmg: 0.9, decay: 0.95, status: { root: 2, thread: 3 }, hitVfx: BUTTERFLY_POP,
                    trail: butterflyTrail, trailPreview: butterflyTrail.preview }] }
        }
    },

    // ---- 유니크 ③ 흑철 재봉 기계 (공격) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '흑철 재봉 기계', style: 'dps', tint: 'brightness(0.55) saturate(1.4) hue-rotate(-15deg) contrast(1.2)',
        bonus: { 2: '기계 재봉 12 → 18번', 4: '표식 적이 쓰러지면 바로 꿰맨 아군 (최대 4)' },
        kit: { 2: { patch: { stMachineSew: { n: 6 } } }, 4: { on: [{ when: 'kill', status: 'vuln', max: 4, fn: (b, info) => b.kitRaiseAlly?.(info.enemy) }] } },
        head: { name: '재봉틀 투구', look: '재봉틀 바늘이 달린 검은 강철 투구', skill: 'stMachineSew', desc: '필살기 기계 재봉: 거대 재봉틀 바늘이 12번 내리찍음 — 속박 + 꿰맨 표식' },
        body: { name: '재봉틀 동체', look: '톱니와 실패가 도는 강철 동체', skill: 'stThreadArmor', desc: '실 감기 장갑: 6초간 받는 피해 -40%, 때린 적 1초 속박' },
        arm: { name: '바늘 기관포', look: '바늘을 쏘는 기관포 팔', skill: 'stThreadPull', desc: '실 끌어당기기: 앞 적 4명을 내 앞으로 끌어와 2초 속박 + 피해' },
        leg: { name: '톱니 장화', look: '톱니바퀴 장화', desc: '기계의 박자: 기본 공격 4번째마다 바늘 3개 더',
            passive: { name: '기계의 박자', desc: '기본 공격 4번째마다 바늘 3개 더', every: { n: 4, step: { do: 'hit', pick: 'nearest', n: 3, range: 320, dmg: 0.4, vfx: V.needle(0, 70) } } } },
        skills: {
            stMachineSew: { name: '기계 재봉', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#b43c46', target: 'enemy', range: 520, clip: 'cast', p: { n: 12 },
                desc: '거대 재봉틀 바늘이 앞쪽을 가로지르며 12번 내리찍음 — 피해 + 1초 속박 + 꿰맨 표식',
                steps: [{ at: 0.45, do: 'custom', fn: machineSew, n: '$n', dmg: 0.9, preview: machineSew.preview }] },
            stThreadArmor: { name: '실 감기 장갑', slot: 'body', cd: 14, icon: 'shield', color: '#b43c46', target: 'self', clip: 'cast',
                desc: '6초간 받는 피해 -40% — 나를 때린 적 1초 속박',
                steps: [{ do: 'buff', key: 'threadArmor', sec: 6, mods: { def: 0.4, reflectStatus: { root: 1 } } },
                    { do: 'custom', fn: threadArmorFx, sec: 6, preview: threadArmorFx.preview }] },
            stThreadPull: { name: '실 끌어당기기', slot: 'arm', cd: 9, icon: 'chain', color: '#b43c46', target: 'enemy', range: 360, clip: 'triple',
                desc: '앞 적 4명을 내 앞으로 끌어와 2초 속박 + 피해',
                steps: [{ at: 0.2, do: 'custom', fn: pullThreads, n: 4, range: 360, preview: pullThreads.preview },
                    { at: 0.32, do: 'pull', pick: 'nearest', n: 4, range: 360, to: 30, sec: 0.35, dmg: 1.2, status: { root: 2 } }] }
        }
    },

    // ---- 레전더리 ① 운명의 직조자 (지원 · 공격) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '운명의 직조자', style: 'support', tint: 'sepia(0.6) saturate(2) hue-rotate(-15deg) brightness(1.15) drop-shadow(0 0 7px rgba(255, 200, 90, 0.85))',
        bonus: { 2: '운명 재봉 +1초', 4: '생명의 직물이 성녀도 30% 회복' },
        kit: { 2: { patch: { stFateSew: { sec: 1 } } }, 4: { patch: { stLifeFabric: { self: 0.3 } } } },
        head: { name: '운명의 실타래 관', look: '금·진홍 실타래가 도는 관', skill: 'stFateSew', desc: '필살기 운명 재봉: 화면 모든 적을 실로 꿰어 4초 매달고 → 꿰인 수만큼 커지는 폭발' },
        body: { name: '베틀 날개 드레스', look: '등에 베틀 같은 금빛 날개', skill: 'stLifeFabric', desc: '생명의 직물: 아군 모두 체력 전부 회복 + 8초 공격 +50%' },
        arm: { name: '황금 대바늘', look: '창만 한 황금 대바늘', skill: 'stThousandThreads', desc: '기본 공격 황금 대바늘 (관통, 표식) · 천 갈래 실: 실 10가닥이 적에 꽂혀 3초 뒤 당겨지며 피해 + 모음',
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, vfx: V.beam(GOLD, 8), hitVfx: V.gold(0, 60, { dur: 0.3 }), status: { mark: [4, 0.1] } } },
        leg: { name: '직조 신발', look: '금실로 짠 신발', desc: '끝없는 실: 꿰맬 수 있는 아군 +3',
            passive: { name: '끝없는 실', desc: '꿰맬 수 있는 아군 +3', mods: { allyMax: 3 } } },
        skills: {
            stFateSew: { name: '운명 재봉', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#ffc85a', target: 'enemy', range: 600, clip: 'cast', p: { sec: 4 },
                desc: '화면 모든 적을 실로 꿰어 4초 매달고 → 꿰인 수만큼 커지는 폭발',
                steps: [{ at: 0.45, do: 'custom', fn: fateSew, sec: '$sec', dmg: 2, preview: fateSew.preview }] },
            stLifeFabric: { name: '생명의 직물', slot: 'body', cd: 15, icon: 'stitch', color: '#ffc85a', target: 'self', clip: 'cast', p: { self: 0 },
                desc: '아군 모두 체력 전부 회복 + 8초 아군 공격 +50% (4부위: 나도 30% 회복)',
                steps: [{ at: 0.45, do: 'heal', allies: true, allyRatio: 1, ratio: '$self' }, { at: 0.45, do: 'buff', key: 'lifeFabric', sec: 8, mods: { allyDmg: 0.5 } },
                    { at: 0.45, do: 'custom', fn: lifeFabricFx, sec: 8, preview: lifeFabricFx.preview }] },
            stThousandThreads: { name: '천 갈래 실', slot: 'arm', cd: 9, icon: 'chain', color: '#ffc85a', target: 'enemy', range: 400, clip: 'throw',
                desc: '실 10가닥이 적에 꽂혀 3초 뒤 당겨지며 피해 + 앞으로 모음',
                steps: [{ at: 0.35, do: 'custom', fn: thousandThreads, n: 10, delay: 3, dmg: 1.6, preview: thousandThreads.preview }] }
        }
    },

    // ---- 레전더리 ② 진홍 장미 성녀 (탱커) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '진홍 장미 성녀', style: 'tank', tint: 'hue-rotate(-25deg) saturate(2.2) brightness(0.9) drop-shadow(0 0 7px rgba(255, 70, 100, 0.85))',
        bonus: { 2: '넝쿨 포박 +2명', 4: '장미 정원에서 쓰러진 적이 꿰맨 아군으로' },
        kit: { 2: { patch: { stVineBind: { n: 2 } } }, 4: { on: [{ when: 'kill', inZone: 'rose', fn: (b, info) => b.kitRaiseAlly?.(info.enemy) }] } },
        head: { name: '장미 가시 관', look: '진홍 장미와 가시 넝쿨 관', skill: 'stRoseGarden', desc: '필살기 장미 정원: 8초간 넝쿨 — 3초마다 속박 + 매초 피해, 아군 회복' },
        body: { name: '장미 드레스', look: '진홍 장미 꽃잎 드레스', skill: 'stPetalStorm', desc: '꽃잎 폭풍: 4초 회오리 — 둘레 적 매초 피해 + 투사체 막음' },
        arm: { name: '가시 채찍', look: '가시 넝쿨 채찍', skill: 'stVineBind', desc: '기본 공격 가시 채찍 (중거리, 가시 독) · 넝쿨 포박: 앞 적 4명 3초 속박 + 매초 피해',
            kitAttack: { kind: 'melee', vfx: V.slash(-30, 140, { dur: 0.3 }), splash: 80, splashMul: 0.5, status: { poison: [3, 0.15] } } },
        leg: { name: '장미 뿌리 신발', look: '뿌리가 뻗은 신발', desc: '피어나는 생명: 적이 쓰러질 때 체력 1% 회복',
            passive: { name: '피어나는 생명', desc: '적이 쓰러질 때마다 체력 1% 회복', onKill: { heal: 0.01 } } },
        skills: {
            stRoseGarden: { name: '장미 정원', slot: 'head', ult: true, cd: 0, icon: 'thorns', color: '#ff4664', target: 'enemy', range: 440, clip: 'cast',
                desc: '8초간 바닥에 장미 넝쿨 — 3초마다 속박 + 매초 피해, 아군 회복',
                steps: [{ at: 0.45, do: 'custom', fn: roseGarden, sec: 8, preview: roseGarden.preview }] },
            stPetalStorm: { name: '꽃잎 폭풍', slot: 'body', cd: 14, icon: 'whirl', color: '#ff4664', target: 'self', clip: 'cast',
                desc: '4초 꽃잎 회오리 — 둘레 적 매초 피해 + 투사체 막음',
                steps: [{ do: 'buff', key: 'petalStorm', sec: 4, mods: { flags: ['projBlock'] } },
                    { at: 0.3, do: 'zone', follow: true, x: -100, w: 280, sec: 4, dps: 0.6 },
                    { at: 0.3, do: 'custom', fn: petalStormFx, sec: 4, preview: petalStormFx.preview }] },
            stVineBind: { name: '넝쿨 포박', slot: 'arm', cd: 9, icon: 'thorns', color: '#ff4664', target: 'enemy', range: 320, clip: 'slam', p: { n: 4 },
                desc: '앞 적 4명을 넝쿨로 3초 속박 + 매초 피해 (가시 독)',
                steps: [{ at: 0.38, do: 'custom', fn: vineBindFx, n: '$n', range: 320, preview: vineBindFx.preview },
                    { at: 0.42, do: 'hit', pick: 'nearest', n: '$n', range: 320, dmg: 0.6, status: { root: 3, poison: [3, 0.3] }, vfx: V.motes('140, 230, 110', 8) }] }
        }
    }
]);
