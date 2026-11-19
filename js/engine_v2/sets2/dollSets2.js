/* ==========================================================================
   PROJECT: MAD OVERLORD // 뒤틀린 인형사 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-8)
   레어 ① 태엽 장난감 공방(a) · 레어 ② 인형극 연출가(b) · 유니크 ① 영원한 가족(u) · 레어 ③ 오르골 소녀(c) · 레어 ④ 종이 인형 마술사(d)
   · 유니크 ② 그림자 인형극(v) · 유니크 ③ 도자기 인형 여왕(w) · 레전더리 ① 꼭두각시 황제(l) · 레전더리 ② 태엽 시계탑의 마녀(m)
   꼭두각시 = status puppet (battle/doll.js tickDoll — 옆 적을 때림, 시간 + 값 puppetSec, 피해 + 값 puppetDmg). 토끼 인형 = spawnAllyMinion 'rabbit'.
   새 캐릭터 세트는 강화 그림 + 세트 색. 동작은 rig/dollRig.js (throw·spin은 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear, runKitStep } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B, DOLL } from '../battle/tuning.js';
import { chestH, stageOf, previewStage, tgtOf, previewTargets, withPreview } from '../vfx/stageFx.js';

const THREAD = '70, 220, 200', TOY = '255, 200, 120', MUSIC = '255, 170, 210', PAPER = '245, 245, 240', SHADOW = '150, 110, 200', PORCELAIN = '255, 230, 170', EMPEROR = '255, 210, 90', CLOCK = '200, 150, 255';
const TOY_TINT = 'sepia(0.3) saturate(2.2) hue-rotate(-20deg) brightness(1.2)';
const isUnit = e => !e.isBuilding && !e.isBarricade;
const onScreen = b => b.enemies.filter(e => isUnit(e) && e.x - b.monsterX < 1000);
const rabbit = (b, x) => b.spawnAllyMinion?.(x, 'rabbit', { hp: DOLL.rabbitHp, dps: DOLL.rabbitDps, speed: DOLL.rabbitSpeed });

// 황금 실 표식: 같은 적을 need번 맞히면 2초 꼭두각시 (2부위: 3 → 2번)
function goldThread(b, e) {
    if (!isUnit(e) || e.boss) return;
    const need = 3 + (b.kitPatch?._threadMark?.n || 0);
    e.kitMarks = (e.kitMarks || 0) + 1;
    if (e.kitMarks >= need) { e.kitMarks = 0; b.kitStatus(e, { puppet: 2 }); }
}

// 시간 되감기: 3초 전 체력으로 (더 높을 때만) + 팔 스킬 쿨다운 초기화 (4부위: 시간 되감기 쿨다운 절반)
// 4부위는 예전 "몸통 스킬도 초기화" — 시간 되감기가 곧 몸통 스킬이라 자기 쿨다운을 0으로 돌려, 자동 스킬이면 0.5초마다 끝없이 다시 씀
//   (되감기 이펙트가 몸을 늘 덮고 '시간 되감기!' 글자가 쌓이며, 팔 쿨다운도 매번 0이라 시계바늘 회전이 5~6겹 겹침 — 11-19 영상).
//   같은 "한 번 더"를 끝없이 돌지 않게: 지금 걸린 몸통 쿨다운을 절반으로 (16 → 약 8초, 16초에 두 번)
function rewind(b) {
    const log = b.kitHpLog || [];
    const past = log.length >= 6 ? log[log.length - 6] : log[0];
    if (past > b.playerHp) b.kitHeal(past - b.playerHp);
    b.skillCd.arm = 0;
    if (b.kitFlag('rewindBody')) b.skillCd.body *= 0.5;
    b.fx.play(REWIND, b.monsterX + 38, FOOT_B + 100);
    b.createDamagePopup(b.monsterX + 40, 220, '시간 되감기!', false);
}

// ==== D-147 (2026-11-18): 뒤틀린 인형사 9세트 — 스킬 설명에 맞는 이펙트 (실 청록 · 장난감 주황 · 오르골 분홍 · 종이 흰 · 그림자 보라 · 도자기 크림 · 황제 금 · 시계 보라) ====
// 물건 그림 doll_set (Gemini 4×2 → build_saint_set.py doll_set 4 2 256, 불투명): 0 깜짝 상자 · 1 무대 막 · 2 발레리나 오르골 인형 · 3 그림자 까마귀
//   · 4 시계바늘(오른쪽 위, 축 왼쪽 아래) · 5 헝겊·종이 인형 · 6 태엽 열쇠 · 7 조종 십자틀
// 그림 함수는 무대(S)를 받아 전투·연구소 미리보기에 함께 씀: S.play(fx, x, h, o) — h = 바닥에서 위로 높이, o.to·path·follow도 [x, h]. S.k = 크기 배율(미리보기)
const STUFF = '250, 238, 215', BRASS = '230, 190, 110', AMBER = '255, 175, 80', INK = '60, 30, 90';
const DS = (f, size, o = {}) => spr('doll_set', size, { frameRange: [f, f], blend: 'normal', glow: 0, ...o });
const CONFETTI = (n = 16, speed = 260, at = 0) => [TOY, MUSIC, THREAD, '255, 240, 140'].map((c, i) =>
    ({ type: 'shards', at: at + i * 0.02, count: Math.ceil(n / 4), speed, angle: -1.57, cone: 1.3, size: 4, spin: 10, life: [0.7, 1.2], floor: 0, color: c }));
const COTTON = (n = 6, spread = 40, at = 0) => ({ type: 'smoke', at, count: n, spread, spreadY: 14, size: 18, life: [0.6, 1], rise: 30, color: STUFF });
const PUPPET_THREADS = sec => fxOf({ type: 'threadPath', at: 0, dur: sec, mode: 'fan', reveal: 0.25, color: THREAD, w: 1.6, sag: 4 });

// ---- 태엽 장난감 공방 ----
// 장난감 행진 (필살기): 예전엔 병정이 작은 불꽃과 함께 나타남 → 앞에 큰 깜짝 상자가 튀어 열리며 색종이, 병정마다 작은 깜짝 상자가 열리며 나옴,
//   병정이 터질 때 불꽃 + 색종이 + 태엽 부품
const JACK_POP = (size = 90) => fxOf(DS(0, size, { dur: 0.75, anchorY: 0.92, popIn: 0.3, fadeOut: 0.25, swing: { amp: 0.22, speed: 14, decay: 3 } }),
    CONFETTI(10, 200, 0.08), { type: 'flash', at: 0.06, dur: 0.15, r: size * 0.35, color: TOY, dy: -size * 0.55 });
const TOY_BLAST = fxOf(V.blast(40, 120).layers, CONFETTI(12, 280),
    { type: 'shards', at: 0, count: 5, speed: 220, angle: -1.57, cone: 1.6, size: 5, spin: 8, life: [0.6, 1], floor: 0, color: BRASS });
const toyMarchCall = withPreview((b, ctx, s) => playToyMarch(stageOf(b)), S => playToyMarch(S));
function playToyMarch(S) {
    const x = S.me() + 120 * S.k;
    S.play(JACK_POP(210), x, 0);
    S.play(fxOf({ type: 'shockwave', at: 0.1, dur: 0.5, r: 200, width: 10, ground: true, color: TOY }, CONFETTI(24, 380, 0.1)), x, 120);
}
// 태엽 감기: 예전엔 금빛 번쩍 한 번 → 6초 동안 등에 꽂힌 큰 태엽 열쇠가 돌아가고(가로 축으로 돌며 접혔다 펴짐) 발밑 주황 빛, 1.5초마다 금빛 톱니 반짝
const WIND_KEY = sec => fxOf(DS(6, 110, { dur: sec, flipX: true, anchorX: 0.1, flapY: { speed: 5, min: 0.18 }, fadeIn: 0.2, fadeOut: 0.4, glow: 1.15, alpha: 0.95 }),
    { type: 'candleGlow', at: 0, dur: sec, r: 120, ground: true, color: TOY, dy: 0 });
const WIND_TICK = fxOf(spr('clock_gear', 90, { frameRange: [2, 5], dur: 0.5, hue: 200, alpha: 0.6 }),
    { type: 'motes', at: 0, count: 6, spread: 26, rise: [20, 50], life: [0.4, 0.7], size: 2, color: BRASS });
const windUpFx = withPreview((b, ctx, s) => playWindUp(stageOf(b), s.sec), S => playWindUp(S, 2.5));
function playWindUp(S, sec) {
    const back = () => [S.me() - 50 * S.k, 112];
    S.play(WIND_KEY(sec), ...back(), { follow: back });
    for (let t = 0; t < sec - 0.3; t += 1.5) S.later(t, () => S.play(WIND_TICK, back()[0], back()[1]));
}
// 깜짝 상자 포탄: 예전엔 하늘에서 불꽃만 → 대포에서 깜짝 상자가 포물선으로 날아가 떨어져 크게 터지며 광대가 튀어나옴(색종이),
//   작은 장난감(깜짝 상자·태엽 열쇠) n개가 사방으로 튀어 다시 터짐
const BOX_FLY = sec => fxOf(DS(0, 80, { dur: sec, travel: true, upright: true, arc: 70, spin: 7 }));
const BOX_LAND = fxOf(V.blast(40, 180).layers, JACK_POP(130).layers, { type: 'shockwave', at: 0, dur: 0.4, r: 110, width: 8, ground: true, color: TOY });
const TOY_FLY = (sec, i) => fxOf(DS(i % 2 ? 6 : 0, i % 2 ? 40 : 46, { dur: sec, travel: true, upright: true, arc: 50 + (i % 3) * 20, spin: 9 * (i % 2 ? 1 : -1) }));
const TOY_POP = fxOf(V.blast(80, 90).layers, CONFETTI(6, 180));
function playJackBox(S, x, n, hit) {
    const from = [S.me() + 46 * S.k, 112], fly = 0.45;
    S.play(BOX_FLY(fly), ...from, { to: [x, 30] });
    S.later(fly, () => { S.play(BOX_LAND, x, 0); hit?.(x, 90, 1.8, true); });
    for (let i = 0; i < n; i++) {
        const dx = (i % 2 ? 1 : -1) * (60 + (i * 47) % 90) * S.k + 25 * S.k, sec = 0.38 + (i % 3) * 0.06;
        S.later(fly + 0.2 + i * 0.07, () => S.play(TOY_FLY(sec, i), x, 40, { to: [x + dx, 16] }));
        S.later(fly + 0.2 + i * 0.07 + sec, () => { S.play(TOY_POP, x + dx, 0); hit?.(x + dx, 50, 0.7, false); });
    }
}
function jackBox(b, ctx, s) {
    const t = pickTargets(b, 'nearest', 1, ctx.range)[0];
    const x = t ? aimAt(t).x : b.frontX() + 200;
    playJackBox(stageOf(b), x, s.n, (cx, r, dmg, big) => {
        enemiesNear(b, cx, r).forEach(e => kitHit(b, e, dmg, { knock: big ? 0.6 : 0.3 }));
        if (big) b.director.shake(3, 140);
    });
}
jackBox.preview = api => playJackBox(previewStage(api), api.dummies[1].x, 3);

// ---- 인형극 연출가 ----
// 커튼콜 (필살기): 예전엔 실 몇 줄과 베기 → 화면 가운데 붉은 무대 막이 양옆으로 열리고 조명, 꼭두각시가 된 적마다 머리 위 조종 십자틀에서
//   청록 실이 내려와 매달림(8초) → 끝날 때 인사하듯 터지며 불꽃 + 색종이
const CURTAIN_OPEN = (flip, sec) => fxOf(DS(1, 360, { dur: sec, anchorY: 0.97, travel: true, upright: true, flipX: flip, fadeOut: 0.35 }));
const SPOT = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 380, ground: true, color: '255, 240, 200' },
    { type: 'flash', at: 0.2, dur: 0.4, r: 220, color: '255, 240, 210', dy: -140 });
const PUPPET_BAR = sec => fxOf(DS(7, 76, { dur: sec, popIn: 0.25, fadeOut: 0.3, swing: { amp: 0.12, speed: 3 } }));
const BOW_BLAST = fxOf(V.blast(150, 120).layers, CONFETTI(10, 240));
function playPuppetHang(S, t, sec, h = 165) {
    const bar = () => [t.pos()[0], t.pos()[1] + h];
    S.play(PUPPET_BAR(sec), ...bar(), { follow: bar, alive: t.ok });
    S.play(PUPPET_THREADS(sec), ...bar(), { alive: t.ok, path: () => {
        const [x, c] = t.pos(), [bx, bh] = bar();
        return [[bx, bh - 8], [x - 14, c + 34], [x + 14, c - 6], [x - 6, c - 30]];
    } });
}
function playCurtainCall(S, list, sec) {
    const cx = S.front() + 300 * S.k;
    S.play(CURTAIN_OPEN(false, 0.9), cx - 80 * S.k, 0, { to: [cx - 420 * S.k, 0] });
    S.play(CURTAIN_OPEN(true, 0.9), cx + 80 * S.k, 0, { to: [cx + 420 * S.k, 0] });
    S.play(SPOT(sec), cx, 0);
    list.slice(0, 8).forEach((t, i) => S.later(0.25 + i * 0.06, () => playPuppetHang(S, t, sec - 0.25 - i * 0.06)));
}
function curtainCall(b, ctx, s) {
    const list = onScreen(b).filter(e => !e.boss);
    const chosen = list.slice(0, Math.ceil(list.length / 2));
    chosen.forEach((e, i) => b.schedule(i * 0.06, () => { if (b.enemies.includes(e)) { kitHit(b, e, s.hitDmg, { knock: 0 }); b.kitStatus(e, { puppet: s.sec }); } }));
    playCurtainCall(stageOf(b), chosen.map(e => tgtOf(b, e)), s.sec);
    b.schedule(s.sec, () => chosen.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(BOW_BLAST, aimAt(e).x, aimAt(e).b);
        enemiesNear(b, aimAt(e).x, 80).forEach(o => kitHit(b, o, s.dmg, { knock: 0.6 }));
    }));
}
curtainCall.preview = api => {
    const S = previewStage(api), ts = previewTargets(api);
    playCurtainCall(S, ts, 2.6);
    S.later(2.6, () => ts.forEach(t => S.play(BOW_BLAST, ...t.pos())));
};
// 무대 막: 예전엔 베기 그림이 계속 → 무대 막이 위에서 떨어져 내려 앞을 막고(4초, 살짝 흔들림), 떨어질 때 먼지
const CURTAIN_DROP = fxOf(DS(1, 240, { dur: 0.22, anchorY: 0.03, travel: true, upright: true }));
const CURTAIN_HOLD = sec => fxOf(DS(1, 240, { dur: sec, anchorY: 0.03, fadeOut: 0.35, swing: { amp: 0.05, speed: 3.2, decay: 0.3 } }),
    { type: 'candleGlow', at: 0, dur: sec, r: 70, ground: true, color: '255, 120, 110' });
const CURTAIN_DUST = fxOf({ type: 'dustCloud', at: 0, dur: 0.9, w: 120, h: 40, color: '220, 200, 190', alpha: 0.55 },
    { type: 'shockwave', at: 0, dur: 0.35, r: 90, width: 5, ground: true, color: '255, 160, 140' });
function playStageCurtain(S, x, sec) {
    const top = 232;
    S.play(CURTAIN_DROP, x, 560, { to: [x, top] });
    S.later(0.22, () => { S.play(CURTAIN_HOLD(sec - 0.22), x, top); S.play(CURTAIN_DUST, x, 0); });
}
const stageCurtainFx = withPreview((b, ctx, s) => playStageCurtain(stageOf(b), b.frontX() + 53, s.sec), S => playStageCurtain(S, S.front() + 60 * S.k, 2.5));
// 낚아채기: 예전엔 번개 실 한 줄 → 손에서 청록 실 올가미가 날아가 감기고, 그 적 머리 위에 조종 십자틀이 생겨 4초 동안 매달림
const LASSO = fxOf({ type: 'threadPath', at: 0, dur: 0.5, mode: 'chain', reveal: 0.18, color: THREAD, w: 2, sag: 18 });
const SNAG = fxOf({ type: 'threadWrap', at: 0, dur: 0.5, rx: 34, ry: 46, count: 5, color: THREAD }, { type: 'flash', at: 0.15, dur: 0.15, r: 40, color: THREAD });
function playSnatch(S, t, sec) {
    const hand = [S.me() + 44 * S.k, 120];
    S.play(LASSO, ...hand, { path: () => [hand, t.pos()] });
    S.later(0.18, () => { S.play(SNAG, t.foot(), 0); playPuppetHang(S, t, sec); });
}
function snatch(b, ctx, s) {
    const t = pickTargets(b, 'strongest', 1, b.playerRange + 300)[0];
    if (!t) return;
    playSnatch(stageOf(b), tgtOf(b, t), s.sec);
    b.kitStatus(t, { puppet: s.sec });
    kitHit(b, t, s.dmg, { knock: 0 });
}
snatch.preview = api => playSnatch(previewStage(api), previewTargets(api)[1], 2.5);

// ---- 영원한 가족 ----
// 아빠 곰 (필살기): 예전엔 토끼 인형을 크게 → 진짜 거대 곰 인형 그림(papa_bear: 뒤뚱 걷기 · 두 앞발 내려치기). 하늘에서 실에 매달려 내려와 솜이 터지고,
//   내려칠 때마다 앞발 자리에 땅 울림 + 솜 + 금(범위 + 0.4초 기절), 사라질 때 솜이 크게 터짐
const BEAR_DROP = fxOf(COTTON(9, 70, 0.1),
    { type: 'shockwave', at: 0.1, dur: 0.5, r: 180, width: 10, ground: true, color: STUFF }, { type: 'flash', at: 0.1, dur: 0.2, r: 90, color: STUFF, dy: -80 });
const BEAR_SLAM = fxOf(V.impact(30, 190).layers, COTTON(6, 50),
    { type: 'shockwave', at: 0, dur: 0.4, r: 130, width: 8, ground: true, color: STUFF },
    { type: 'motes', at: 0.05, count: 8, spread: 50, rise: [30, 80], life: [0.5, 0.9], size: 2.6, color: STUFF });
const BEAR_BURST = fxOf(COTTON(14, 90), CONFETTI(8, 220), { type: 'shards', at: 0, count: 10, speed: 260, angle: -1.57, cone: 1.5, size: 5, spin: 6, life: [0.7, 1.2], floor: 0, color: STUFF });
// 인형 수선: 예전엔 실 알갱이 → 나와 아군마다 재봉 바늘이 둘레를 돌며 청록 실로 꿰매고(감기는 실) 크림색 솜 빛, 6초 동안 발밑 보호 빛
const NEEDLE = (r, sec) => spr('saint_set', 46, { frameRange: [4, 4], blend: 'normal', glow: 0, dur: sec, orbit: { r, ry: r * 0.4, speed: 9, spin: true }, dy: -70 });
const STITCH = (k = 1) => fxOf(NEEDLE(46 * k, 1.1), { type: 'threadWrap', at: 0, dur: 1.2, rx: 46 * k, ry: 66 * k, count: 6, color: THREAD },
    { type: 'motes', at: 0.2, count: 10, spread: 30 * k, rise: [30, 70], life: [0.5, 0.9], size: 2.4, color: '125, 255, 154' }, COTTON(3, 24 * k, 0.4));
const REPAIR_GUARD = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 90, ground: true, color: STUFF });
function playRepair(S, allies, sec) {
    const me = () => [S.me(), 0];
    S.play(STITCH(1.2), ...me(), { follow: me });
    S.play(REPAIR_GUARD(sec), ...me(), { follow: me });
    allies.slice(0, 6).forEach((x, i) => S.later(0.1 + i * 0.08, () => S.play(STITCH(0.8), x, 0)));
}
const repairFx = withPreview((b, ctx, s) => playRepair(stageOf(b), b.allies.map(a => a.x + 38 + (a.kitReach || 0)), s.sec),
    (S, api) => playRepair(S, [S.me() + 80 * S.k], 2.5));
// 실 감옥: 예전엔 번개 실 → 적마다 머리 위 조종 십자틀에서 실이 내려와 몸을 칭칭 감아 매달고(3초), 끝나면 땅에 내리꽂혀 땅 울림 + 금 + 솜
const SLAM_DOWN = fxOf(V.impact(170, 150).layers, { type: 'cracks', at: 0, dur: 1, count: 5, len: 70, color: THREAD }, COTTON(4, 40),
    { type: 'dustCloud', at: 0.03, dur: 0.9, w: 100, h: 40, color: '210, 200, 190', alpha: 0.5 });
function playStringPrison(S, list, sec) {
    list.forEach((t, i) => S.later(i * 0.08, () => {
        playPuppetHang(S, t, sec);
        S.play(fxOf({ type: 'threadWrap', at: 0, dur: sec, rx: 34, ry: 56, count: 7, color: THREAD, alpha: 0.8 }), t.foot(), 0, { follow: () => [t.foot(), 0], alive: t.ok });
    }));
}
function stringPrison(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, b.playerRange + 120);
    list.forEach(e => b.kitStatus(e, { stun: s.sec + 0.1 }));
    playStringPrison(stageOf(b), list.map(e => tgtOf(b, e)), s.sec);
    b.schedule(s.sec, () => list.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(SLAM_DOWN, aimAt(e).x, FOOT_B);
        enemiesNear(b, aimAt(e).x, 90).forEach(o => kitHit(b, o, s.dmg, { knock: 0.8 }));
    }));
    b.schedule(s.sec, () => b.director.shake(4, 160));
}
stringPrison.preview = api => {
    const S = previewStage(api), ts = previewTargets(api, 3);
    playStringPrison(S, ts, 2);
    S.later(2, () => ts.forEach(t => S.play(SLAM_DOWN, t.foot(), 0)));
};

// 실 채찍 (영원한 가족 기본 공격): 예전 V.slash(130)는 초록으로 물든 산 모양 베기 그림이라 어색(11-18 피드백) → 청록 실이 휘감아 때리는 가는 채찍 자국 + 실 가루
const THREAD_WHIP = fxOf({ type: 'slash', at: 0, dur: 0.26, r: 46, arc: 1.7, sweep: 0.1, thick: 0.6, angle: 0.5, width: 4, color: THREAD },
    { type: 'flash', at: 0.02, dur: 0.1, r: 16, color: THREAD }, { type: 'motes', at: 0.03, count: 5, spread: 14, rise: [20, 45], life: [0.4, 0.7], size: 1.8, color: THREAD });
// 4부위: 아빠 곰과 함께 있을 때 쓰러진 적 → 토끼 인형 (아빠 곰 한 번에 최대 3). 예전엔 판 전체에서 3마리라 두 번째 아빠 곰부터는 안 나왔음 (11-18 피드백)
const RABBIT_POP = fxOf(COTTON(5, 30), { type: 'flash', at: 0, dur: 0.15, r: 30, color: STUFF, dy: -30 }, { type: 'motes', at: 0, count: 6, spread: 20, rise: [30, 60], life: [0.4, 0.7], size: 2, color: THREAD });
function papaRabbit(b, info) {
    if (!info.enemy || (b.papaRabbits || 0) >= 3) return;
    b.papaRabbits = (b.papaRabbits || 0) + 1;
    const x = aimAt(info.enemy).x;
    b.fx.play(RABBIT_POP, x, FOOT_B);
    rabbit(b, x - 38);
}

// ---- 오르골 소녀 ----
// 자장가 (필살기): 예전엔 오르골 그림 1초 → 하늘에 큰 오르골이 열려 6초 동안 돌아가며 음표가 흩날리고, 화면이 어스름해지며 분홍 반짝이가 내림,
//   잠든 적마다 머리 위로 'Zz' 와 분홍 빛
const LULLABY_SKY = sec => fxOf(spr('music_box', 250, { dur: sec, frameRange: [3, 6], loopSec: 1.6, pingPong: true, fadeIn: 0.3, fadeOut: 0.6, glow: 1.2 }));
const LULLABY_DUSK = (w, sec) => fxOf({ type: 'snowFall', at: 0, dur: sec, w, count: 60, top: -10, wind: 15, speed: 0.12, flake: 0.8, dim: 0.28, cloud: false, color: '255, 190, 225' });
const NOTES = fxOf(spr('encore_notes', 90, { frameRange: [0, 2], dur: 1.1, hue: -40, alpha: 0.8 }));
const SLEEPY = fxOf({ type: 'motes', at: 0, count: 5, spread: 16, rise: [20, 40], life: [0.8, 1.2], size: 2.4, color: '200, 180, 255' },
    { type: 'glow', at: 0, dur: 1, r: 22, color: '200, 180, 255', dy: -10 });
function playLullaby(S, list, sec, w) {
    const x = S.front() + 260 * S.k;
    S.play(LULLABY_SKY(sec), x, 250);
    S.play(LULLABY_DUSK(w, sec), x, 0);
    for (let t = 0.3; t < sec - 0.5; t += 0.7) S.later(t, () => S.play(NOTES, x + (Math.random() - 0.5) * 520 * S.k, 140 + Math.random() * 140));
    list.slice(0, 10).forEach((tg, i) => { for (let t = 0.3; t < sec; t += 1.5) S.later(t + i * 0.05, () => { if (tg.ok()) { const [px, h] = tg.pos(); S.play(SLEEPY, px, h + 50); S.zz?.(px, h); } }); });
}
function lullabyFx(b, ctx, s) {
    const S = stageOf(b);
    S.zz = (x, h) => b.createDamagePopup(x, FOOT_B + h + 70, 'Zz', false);
    playLullaby(S, onScreen(b).filter(e => !e.boss).map(e => tgtOf(b, e)), s.sec, 1100);
}
lullabyFx.preview = api => playLullaby(previewStage(api), previewTargets(api), 3, 800);
// 회전 무대: 예전엔 분홍 알갱이 → 4초 동안 발레리나 인형 셋이 회전목마처럼 몸 둘레를 돌고(빙글 접혔다 펴짐), 분홍 꽃잎 소용돌이 + 바닥 분홍 빛
const CAROUSEL = sec => fxOf(...[0, 2.1, 4.2].map(ph => DS(2, 74, { dur: sec, orbit: { r: 125, ry: 26, speed: 4.2, phase: ph }, dy: -36, flap: { speed: 9, min: 0.45, seed: ph }, fadeIn: 0.2, fadeOut: 0.35 })),
    { type: 'petalVortex', at: 0, dur: sec, rx: 140, h: 150, count: 30, color: MUSIC, backColor: '200, 150, 255', hiColor: '255, 240, 250' },
    { type: 'candleGlow', at: 0, dur: sec, r: 150, ground: true, color: MUSIC });
const carouselFx = withPreview((b, ctx, s) => { const me = () => [b.monsterX + 38, 0]; stageOf(b).play(CAROUSEL(s.sec), ...me(), { follow: me }); },
    S => S.play(CAROUSEL(2.5), S.me(), 0));
// 발레리나 투척: 예전엔 베기 그림 줄 → 발레리나 인형이 빙글빙글(접혔다 펴짐) 앞으로 날아가 적 사이를 지나 돌아옴, 분홍 빛 꼬리
const BALLERINA = (sec, arc) => fxOf(DS(2, 84, { dur: sec, travel: true, upright: true, arc, flap: { speed: 16, min: 0.2 }, glow: 1.15 }),
    { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.18, w: 4, color: MUSIC });
function playBallerina(S, x0, x1) {
    const h = 96, sec = Math.abs(x1 - x0) / (300 * S.k);
    S.play(BALLERINA(sec, 14), x0, h, { to: [x1, h] });
    S.later(sec, () => S.play(BALLERINA(sec, -14), x1, h, { to: [x0, h] }));
}
const ballerinaFx = withPreview((b, ctx, s) => playBallerina(stageOf(b), b.frontX(), b.frontX() + s.dist), S => playBallerina(S, S.front(), S.front() + 300 * S.k));

// ---- 종이 인형 마술사 ----
// 종이학 폭풍 (필살기): 예전엔 적 자리에 종이학 하나씩 → 종이학 떼가 화면을 가로질러 날아가고(4마리씩 10무리), 적 자리엔 종이 벰(조각 흩날림)
// 11-18 피드백: 종이학을 아래쪽(적 가슴 높이)으로, 피격도 아무 자리가 아니라 종이학이 적을 지나가는 순간에 — 종이학마다 화면 적 하나를 골라
//   그 적 높이로 날아가 지나갈 때 베고(피해·종이 조각) 계속 날아감. 종이학 40마리 × 피해 0.35는 그대로 (예전 rain 40번과 같은 합)
const CRANE = (sec, size) => fxOf(spr('paper_crane', size, { dur: sec, frameRange: [2, 3], loopSec: 0.3, pingPong: true, travel: true, upright: true, glow: 0.6, fadeIn: 0.1, fadeOut: 0.2 }));
const CRANE_CUT = fxOf(spr('paper_crane', 100, { frameRange: [4, 6], dur: 0.4 }),
    { type: 'shards', at: 0, count: 5, speed: 180, size: 4, spin: 9, life: [0.5, 0.9], floor: 0, color: PAPER });
const CRANE_SPEED = 640;
/** pick() → 과녁(없으면 null), onCut(과녁) — 종이학 4마리씩 0.6초마다 */
function playCraneStorm(S, sec, pick, onCut) {
    const x0 = S.me() - 120 * S.k, x1 = S.me() + 1000 * S.k, d = (x1 - x0) / (CRANE_SPEED * S.k);
    for (let g = 0; g * 0.6 < sec; g++) for (let j = 0; j < 4; j++) {
        const i = g * 4 + j;
        S.later(g * 0.6 + j * 0.09, () => {
            const t = pick(i), sx = x0 - (j % 2) * 30 * S.k;
            const h = t ? t.pos()[1] + ((i * 37) % 30 - 15) : 50 + (i * 53) % 80;
            S.play(CRANE(d, 64 + (j % 3) * 14), sx, h, { to: [x1, h + (j % 2 ? 14 : -10)] });
            if (!t) return;
            const hitAt = Math.max(0.05, (t.pos()[0] - sx) / (x1 - sx) * d);
            S.later(hitAt, () => { if (t.ok()) { S.play(CRANE_CUT, ...t.pos()); onCut?.(t); } });
        });
    }
}
function craneStorm(b, ctx, s) {
    playCraneStorm(stageOf(b), s.sec, () => { const list = onScreen(b); return list.length ? tgtOf(b, list[Math.floor(Math.random() * list.length)]) : null; },
        t => kitHit(b, t.e, s.dmg, { knock: 0.2 }));
}
craneStorm.preview = api => { const S = previewStage(api), ts = previewTargets(api); playCraneStorm(S, 2.5, i => ts[i % ts.length]); };
// 종이 분신: 예전엔 하얗게 칠한 토끼 → 종이 인형 그림(paper_doll, 팔랑팔랑 걷기). 접혀 펼쳐지며 나타나고(종이 조각·빛), 찢어질 때 종이 조각이 흩날림
const PAPER_FOLD = fxOf(spr('paper_crane', 90, { frameRange: [0, 1], dur: 0.35 }), { type: 'flash', at: 0, dur: 0.15, r: 40, color: PAPER, dy: -50 },
    { type: 'shards', at: 0.05, count: 6, speed: 150, angle: -1.57, cone: 1.4, size: 3.5, spin: 8, life: [0.4, 0.7], floor: 0, color: PAPER });
const PAPER_TEAR = fxOf(spr('paper_crane', 140, { frameRange: [5, 8], dur: 0.5, dy: -50 }),
    { type: 'shards', at: 0, count: 14, speed: 260, angle: -1.57, cone: 1.6, size: 5, spin: 10, life: [0.7, 1.2], floor: 0, color: PAPER },
    { type: 'flash', at: 0, dur: 0.15, r: 60, color: PAPER, dy: -50 });
function paperClones(b, ctx, s) {
    for (let i = 0; i < s.n; i++) {
        b.schedule(i * 0.12, () => {
            if (!b.isActive) return;
            const a = b.spawnKitAlly(b.monsterX + 40 + i * 35, { art: 'paper_doll', scale: 0.72, hp: 0.06, dps: 0.05, speed: 0.2, life: 6,
                blast: { dmg: 1, radius: 70, fx: PAPER_TEAR }, color: '#f5f5f0', vfx: PAPER_FOLD });
            if (a) a.kitTag = 'paper';
        });
    }
}
paperClones.preview = api => { const S = previewStage(api); [0, 1, 2].forEach(i => S.later(i * 0.12, () => S.play(PAPER_FOLD, S.me() + (80 + i * 35) * S.k, 0))); };
// 종이 칼날: 예전엔 베기 그림 줄 → 회전하는 종이 칼날 4장이 위아래로 휘어 날아가며 관통 (흰 빛 꼬리)
const BLADE = (sec, arc) => fxOf(spr('blade_flurry', 84, { frameRange: [0, 1], loopSec: 0.12, dur: sec, travel: true, upright: true, arc, spin: 16, glow: 0.8 }),
    { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.14, w: 3, color: PAPER });
function playPaperBlades(S, x0, dist) {
    [34, -24, 46, -38].forEach((arc, i) => S.later(i * 0.1, () => S.play(BLADE(dist / (640 * S.k), arc), x0, 120, { to: [x0 + dist, 110] })));
}
const paperBladesFx = withPreview((b, ctx, s) => playPaperBlades(stageOf(b), b.frontX(), s.dist), S => playPaperBlades(S, S.front(), 380 * S.k));

// ---- 그림자 인형극 ----
// 그림자 연극 (필살기): 예전엔 적마다 그림자 그림만 → 모자 램프가 켜져 앞을 비추고 화면이 어두워짐(8초), 적 발밑에 그림자 웅덩이가 생겨 그림자가 일어나 벰
const LAMP = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 34, color: '255, 220, 150' });
const DUSK = (w, sec) => fxOf({ type: 'snowFall', at: 0, dur: sec, w, count: 1, top: -10, speed: 0.01, flake: 0.1, dim: 0.36, cloud: false, color: '40, 30, 60' });
const SHADOW_POOL = fxOf({ type: 'mist', at: 0, dur: 1, r: 46, h: 10, life: 1, drift: 6, color: INK });
function shadowPlay(b, ctx, s) {
    const head = () => [b.monsterX + 52, 186];
    const S = stageOf(b);
    S.play(DUSK(1400, s.sec), b.monsterX + 520, 0);
    S.play(LAMP(s.sec), ...head(), { follow: head });
    for (let t = 0; t < s.sec; t += 1) {
        b.schedule(t, () => {
            if (!b.isActive) return;
            onScreen(b).forEach((e, i) => {
                if (i < 8) { b.fx.play(SHADOW_POOL, aimAt(e).x, FOOT_B); b.fx.play(V.sheet('shadow_play', 130, { dur: 0.6 }), aimAt(e).x - 20, aimAt(e).b); }
                b.dealDamageToEnemy(e, (e.dps || 10) * s.mul + b.unit() * 0.2, false, { dot: true });
            });
        });
    }
}
shadowPlay.preview = api => {
    const S = previewStage(api);
    S.play(DUSK(800, 3), (api.dummies[0].x + api.dummies[api.dummies.length - 1].x) / 2, 0);
    S.play(LAMP(3), S.me() + 14 * S.k, 186);
    [0, 1, 2].forEach(t => S.later(t, () => previewTargets(api).forEach(g => { S.play(SHADOW_POOL, g.foot(), 0); S.play(V.sheet('shadow_play', 130, { dur: 0.6 }), g.pos()[0] - 20 * S.k, g.pos()[1]); })));
};
// 촛불 무대: 예전엔 불티만 → 무대 바닥에 촛불 여섯 자루가 원을 그리며 켜지고(흔들리는 불빛), 무대 전체가 따뜻한 보라·금빛 (6초)
const CANDLE = (sec, i) => fxOf(spr('saint_set', 58, { frameRange: [1, 1], blend: 'normal', glow: 0, dur: sec, anchorY: 0.92, popIn: 0.3, fadeOut: 0.4 }),
    { type: 'candleGlow', at: 0, dur: sec, r: 26, color: '255, 200, 120', seed: i, dy: -46 });
const STAGE_LIGHT = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 200, ground: true, color: '200, 140, 230' },
    { type: 'candleGlow', at: 0, dur: sec, r: 120, ground: true, color: '255, 200, 120', seed: 3 });
function playCandleStage(S, cx, sec) {
    S.play(STAGE_LIGHT(sec), cx, 0);
    [-150, -90, -30, 30, 90, 150].forEach((dx, i) => S.later(i * 0.07, () => S.play(CANDLE(sec - i * 0.07, i), cx + dx * S.k, (i % 2 ? 8 : -4))));
}
const candleStageFx = withPreview((b, ctx, s) => playCandleStage(stageOf(b), b.frontX() + 40, s.sec), S => playCandleStage(S, S.front() + 40 * S.k, 2.5));
// 그림자 까마귀: 예전엔 어둠 번쩍 → 그림자 까마귀 다섯이 날갯짓하며 적마다 날아가 쪼고(깃털·어둠), 2초 동안 작은 까마귀가 머리 둘레를 돌며 눈을 가림
const CROW = (sec, arc) => fxOf(DS(3, 74, { dur: sec, travel: true, upright: true, arc, flapY: { speed: 14, min: 0.55 }, glow: 1.2 }));
const PECK = fxOf(spr('feather_black', 90, { dur: 0.45 }), V.dark(0, 80).layers);
const BLIND = sec => fxOf(DS(3, 36, { dur: sec, orbit: { r: 24, ry: 8, speed: 6 }, alpha: 0.85, fadeOut: 0.3, flapY: { speed: 14, min: 0.5 } }));
function playCrows(S, list, onHit) {
    const from = [S.me() + 30 * S.k, 160];
    list.forEach((t, i) => S.later(i * 0.08, () => {
        const sec = 0.38;
        S.play(CROW(sec, 50 - i * 22), ...from, { to: t.pos() });
        S.later(sec, () => {
            if (!t.ok()) return;
            S.play(PECK, ...t.pos());
            const eye = () => [t.pos()[0], t.pos()[1] + 46];
            S.play(BLIND(2), ...eye(), { follow: eye, alive: t.ok });
            onHit?.(t);
        });
    }));
}
function shadowCrows(b, ctx, s) {
    playCrows(stageOf(b), pickTargets(b, 'random', s.n, s.range).map(e => tgtOf(b, e)), t => kitHit(b, t.e, s.dmg, { status: { weak: [2, 0.7] } }));
}
shadowCrows.preview = api => playCrows(previewStage(api), previewTargets(api, 5));

// ---- 도자기 인형 여왕 ----
// 티 파티 (필살기): 예전엔 찻잔 그림이 0.6초 → 적마다 발밑에 찻잔이 빛나며 나타나 6초 내내 앉혀 두고(찻잔 흔들림), 끝나면 찻잔이 깨지며 불꽃 + 도자기 조각
const TEACUP = sec => fxOf(spr('teacup_burst', 130, { frameRange: [0, 1], dur: 0.3, anchorY: 0.85 }),
    spr('teacup_burst', 130, { at: 0.25, frameRange: [2, 3], dur: sec - 0.25, loopSec: 1.2, pingPong: true, anchorY: 0.85, blend: 'normal', glow: 0, fadeOut: 0.1 }),
    { type: 'candleGlow', at: 0, dur: sec, r: 60, ground: true, color: PORCELAIN });
const TEACUP_BREAK = fxOf(spr('teacup_burst', 150, { frameRange: [5, 8], dur: 0.7, anchorY: 0.85 }), V.shatter(30, 150).layers,
    { type: 'shards', at: 0, count: 10, speed: 260, angle: -1.57, cone: 1.4, size: 5, spin: 9, life: [0.6, 1.1], floor: 0, color: '250, 245, 235' });
function teaParty(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, b.playerRange + 300).filter(e => isUnit(e) && !e.boss);
    const S = stageOf(b);
    list.forEach(e => { b.kitStatus(e, { stun: s.sec }); const t = tgtOf(b, e); S.play(TEACUP(s.sec), t.foot(), 0, { follow: () => [t.foot(), 0], alive: t.ok }); });
    b.schedule(s.sec, () => list.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(TEACUP_BREAK, aimAt(e).x, FOOT_B);
        enemiesNear(b, aimAt(e).x, 80).forEach(o => kitHit(b, o, s.dmg * (1 + s.mul), { knock: 0.8 }));
    }));
}
teaParty.preview = api => { const S = previewStage(api); previewTargets(api).forEach(t => { S.play(TEACUP(2.4), t.foot(), 0); S.later(2.4, () => S.play(TEACUP_BREAK, t.foot(), 0)); }); };
// 금 이음: 예전엔 금빛 번쩍 → 발밑에 금빛 이음 금이 번지고(깨진 도자기를 금으로 잇는 킨츠기), 4초 동안 금가루가 피어오르며 금빛 막
const KINTSUGI = fxOf({ type: 'cracks', at: 0, dur: 1.6, count: 7, len: 90, color: EMPEROR }, V.gold(0, 170, { dy: -70 }).layers,
    { type: 'ring', at: 0.1, dur: 0.6, r: 90, color: EMPEROR, width: 4 });
const GOLD_DUST = fxOf({ type: 'motes', at: 0, count: 7, spread: 34, rise: [40, 90], life: [0.6, 1], size: 2.4, color: EMPEROR });
const GOLD_GUARD = sec => fxOf({ type: 'candleGlow', at: 0, dur: sec, r: 100, ground: true, color: PORCELAIN });
function playGoldMend(S, sec) {
    const me = () => [S.me(), 0];
    S.play(KINTSUGI, ...me());
    S.play(GOLD_GUARD(sec), ...me(), { follow: me });
    for (let t = 0.3; t < 4; t += 0.5) S.later(t, () => S.play(GOLD_DUST, S.me(), 60));
}
const goldMendFx = withPreview((b, ctx, s) => playGoldMend(stageOf(b), s.sec), S => playGoldMend(S, 2.5));
// 뜨거운 차: 예전엔 물보라 → 찻주전자에서 호박색 찻물이 부채꼴로 쏟아져(방울이 포물선) 적마다 뜨거운 물보라 + 김이 피어오름
const TEA_DROP = sec => fxOf(spr('water_burst', 34, { frameRange: [1, 2], dur: sec, travel: true, hue: 190, glow: 1 }),
    { type: 'boltTrail', at: 0, dur: sec + 0.1, fly: sec, len: 0.2, w: 4, color: AMBER });
const TEA_SPLASH = fxOf(spr('water_burst', 110, { frameRange: [2, 6], dur: 0.45, hue: 190 }),
    spr('steam_vent', 110, { at: 0.15, frameRange: [1, 6], dur: 1.2, anchorY: 0.9, alpha: 0.55, dy: 0 }));
function playHotTea(S, list) {
    const spout = [S.me() + 52 * S.k, 116];
    list.forEach((t, i) => S.later(i * 0.05, () => {
        const sec = 0.28;
        S.play(TEA_DROP(sec), ...spout, { to: t.pos() });
        S.later(sec, () => S.play(TEA_SPLASH, ...t.pos()));
    }));
    for (let j = 0; j < 6; j++) S.later(j * 0.04, () => S.play(TEA_DROP(0.3), ...spout, { to: [spout[0] + (90 + j * 22) * S.k, 10 + j * 18] }));
}
function hotTea(b, ctx, s) {
    const list = pickTargets(b, 'all', 99, s.range);
    playHotTea(stageOf(b), list.slice(0, 8).map(e => tgtOf(b, e)));
    list.forEach(e => b.schedule(0.28, () => { if (b.enemies.includes(e)) kitHit(b, e, s.dmg, { status: { burn: [4, 0.3] } }); }));
}
hotTea.preview = api => playHotTea(previewStage(api), previewTargets(api));

// ---- 꼭두각시 황제 ----
// 실의 왕좌 (필살기): 예전엔 왕좌 그림 0.9초 → 10초 내내 등 뒤에 실의 왕좌가 서 있고 발밑 금빛, 1초마다 왕관에서 금실이 날아가 가장 강한 적을 낚아
//   앞으로 끌어와 내리꽂음(금빛 땅 울림 + 금)
const THRONE = sec => fxOf(spr('throne_thread', 280, { dur: sec, anchorY: 0.92, loopSec: 1.5, fadeIn: 0.4, fadeOut: 0.5, alpha: 0.55, glow: 0.8 }),
    { type: 'candleGlow', at: 0, dur: sec, r: 170, ground: true, color: EMPEROR });
const GOLD_LINE = fxOf({ type: 'threadPath', at: 0, dur: 0.45, mode: 'chain', reveal: 0.1, color: EMPEROR, w: 2.4, sag: 6 });
const THRONE_SLAM = fxOf(V.impact(40, 180).layers, { type: 'cracks', at: 0, dur: 1, count: 6, len: 90, color: EMPEROR },
    { type: 'shockwave', at: 0, dur: 0.4, r: 120, width: 7, ground: true, color: EMPEROR });
function throneFx(b, ctx, s) { const me = () => [b.monsterX - 30, 0]; stageOf(b).play(THRONE(s.sec), ...me(), { follow: me }); }
throneFx.preview = api => { const S = previewStage(api); S.play(THRONE(3), S.me() - 68 * S.k, 0); };
function throneYank(b, ctx, s) {
    const e = pickTargets(b, 'strongest', 1, s.range)[0];
    if (!e) return;
    const S = stageOf(b), t = tgtOf(b, e), crown = () => [b.monsterX + 48, 214];
    S.play(GOLD_LINE, ...crown(), { path: () => [crown(), t.pos()], alive: t.ok });
    if (!isUnit(e) || e.boss) { kitHit(b, e, s.dmg, s); return; }
    if (b.pullEnemy) b.pullEnemy(e, b.frontX() + s.to, s.sec);
    b.schedule(s.sec, () => {
        if (b.enemies.includes(e)) { b.fx.play(THRONE_SLAM, aimAt(e).x, FOOT_B); kitHit(b, e, s.dmg, s); b.kitPushed?.(e); }
        b.director.shake(3, 120);
    });
}
throneYank.preview = api => {
    const S = previewStage(api), ts = previewTargets(api);
    [0, 1, 2].forEach(i => S.later(i, () => { const t = ts[2 - i] || ts[0]; S.play(GOLD_LINE, S.me() + 10 * S.k, 214, { path: () => [[S.me() + 10 * S.k, 214], t.pos()] }); S.later(0.3, () => S.play(THRONE_SLAM, t.foot(), 0)); }));
};
// 충성 서약: 예전엔 금빛 번쩍 → 발밑에 금빛 마법진이 펼쳐지고 아군·꼭두각시마다 머리 위 금빛 고리 + 금가루 (8초 동안 발밑 금빛)
const OATH = sec => fxOf({ type: 'rune', at: 0, dur: 1.4, r: 110, color: EMPEROR, spin: 1.5 }, V.gold(0, 200, { dy: -60 }).layers,
    { type: 'candleGlow', at: 0, dur: sec, r: 110, ground: true, color: EMPEROR });
const OATH_MARK = fxOf({ type: 'ring', at: 0, dur: 0.6, r: 30, color: EMPEROR, width: 4 }, GOLD_DUST.layers);
function playLoyalty(S, marks, sec) {
    const me = () => [S.me(), 0];
    S.play(OATH(sec), ...me(), { follow: me });
    marks.slice(0, 10).forEach((p, i) => S.later(0.15 + i * 0.05, () => S.play(OATH_MARK, p[0], p[1])));
}
function loyaltyFx(b, ctx, s) {
    const marks = [...b.allies.map(a => [a.x + 38 + (a.kitReach || 0), 110]), ...b.enemies.filter(e => e.puppetT > 0).map(e => [aimAt(e).x, chestH(e) + 50])];
    playLoyalty(stageOf(b), marks, s.sec);
}
loyaltyFx.preview = api => playLoyalty(previewStage(api), previewTargets(api).map(t => [t.pos()[0], t.pos()[1] + 50]), 2.5);
// 실의 그물: 예전엔 번개 실 → 홀에서 금실 다섯 가닥이 부채꼴로 뻗어 적마다 금빛 실 그물이 펼쳐져 매닮 (2초)
const GOLD_NET = sec => fxOf(spr('web_purple', 140, { frameRange: [1, 6], dur: sec, anchorY: 0.82, hue: 130, fadeOut: 0.3 }),
    { type: 'threadWrap', at: 0, dur: sec, rx: 32, ry: 50, count: 5, color: EMPEROR, alpha: 0.7 });
const GOLD_FAN = sec => fxOf({ type: 'threadPath', at: 0, dur: sec, mode: 'fan', reveal: 0.2, color: EMPEROR, w: 1.8, sag: 10 });
function playThreadNet(S, list, sec) {
    const hand = () => [S.me() + 46 * S.k, 130];
    S.play(GOLD_FAN(0.9), ...hand(), { path: () => [hand(), ...list.filter(t => t.ok()).map(t => t.pos())] });
    list.forEach((t, i) => S.later(0.12 + i * 0.04, () => S.play(GOLD_NET(sec), t.foot(), 0, { follow: () => [t.foot(), 0], alive: t.ok })));
}
function threadNet(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, s.range);
    playThreadNet(stageOf(b), list.map(e => tgtOf(b, e)), s.sec);
    list.forEach(e => kitHit(b, e, s.dmg, { status: { stun: s.sec } }));
}
threadNet.preview = api => playThreadNet(previewStage(api), previewTargets(api, 5), 2);

// ---- 태엽 시계탑의 마녀 ----
// 자정의 종 (필살기): 예전엔 고리 + 작은 시계 → 하늘에 큰 시계가 12초 동안 떠서 째깍이고, 종이 울릴 때마다 시계가 번쩍 + 보라 고리,
//   12번째에 시계가 깨지며 화면을 덮는 큰 폭발
const SKY_CLOCK = sec => fxOf(spr('time_stop', 360, { dur: sec, frameRange: [3, 5], loopSec: 2, pingPong: true, alpha: 0.6, fadeIn: 0.5, fadeOut: 0.3 }));
const BELL = fxOf({ type: 'flash', at: 0, dur: 0.2, r: 150, color: CLOCK }, spr('sonic_ring', 340, { frameRange: [1, 6], dur: 0.6, hue: 60, alpha: 0.7 }));
const MIDNIGHT_END = fxOf(spr('time_stop', 520, { frameRange: [6, 8], dur: 0.8 }), spr('clock_gear', 420, { frameRange: [4, 8], dur: 0.9 }),
    { type: 'flash', at: 0, dur: 0.3, r: 320, color: '240, 220, 255' },
    { type: 'shards', at: 0.05, count: 18, speed: 380, size: 6, spin: 8, life: [0.8, 1.3], color: CLOCK });
function playMidnight(S, n) {
    const x = S.front() + 260 * S.k, h = 320;
    S.play(SKY_CLOCK(n + 0.2), x, h);
    for (let i = 0; i < n; i++) S.later(i, () => S.play(BELL, x, h));
    S.later(n - 0.4, () => S.play(MIDNIGHT_END, x, h - 140));
}
const midnightFx = withPreview((b, ctx, s) => playMidnight(stageOf(b), 12), S => playMidnight(S, 4));
// 시간 되감기: 예전엔 차원문 → 몸 앞에 시계가 거꾸로 돌고(톱니 시계 거꾸로 재생 + 거꾸로 도는 소용돌이), 보라 고리가 안으로 모여듦
const REWIND = fxOf(spr('clock_gear', 230, { dur: 0.9, reverse: true, spin: -5 }), { type: 'swirl', at: 0, dur: 0.8, r: 90, arms: 4, spin: -10, color: CLOCK },
    { type: 'ring', at: 0, dur: 0.5, r: 120, inward: true, ground: true, color: CLOCK, width: 4 },
    { type: 'motes', at: 0.2, count: 12, spread: 50, rise: [-40, -10], life: [0.5, 0.8], size: 2.2, color: CLOCK });
// 시계바늘 회전: 예전엔 베기 그림 → 앞쪽에 시계판이 떠오르고 긴 바늘·짧은 바늘(시계바늘 그림)이 축을 중심으로 3초 동안 빙글 돎, 보라 불꽃
const HAND_FX = (sec, size, spin, a0) => DS(4, size, { dur: sec, anchorX: 0.2, anchorY: 0.56, angle: a0, spin, glow: 1.15, popIn: 0.2, fadeOut: 0.3 });
const CLOCK_HANDS = sec => fxOf(spr('time_stop', 250, { frameRange: [2, 3], dur: sec, loopSec: 1, pingPong: true, alpha: 0.45, fadeIn: 0.2, fadeOut: 0.3 }),
    HAND_FX(sec, 240, 7, -1.14), HAND_FX(sec, 160, 3.5, 0.43),
    { type: 'candleGlow', at: 0, dur: sec, r: 120, ground: true, color: CLOCK, dy: 92 });
function clockHandsFx(b, ctx, s) { const p = () => [b.frontX() + 110, 92]; stageOf(b).play(CLOCK_HANDS(s.sec), ...p(), { follow: p }); }
clockHandsFx.preview = api => { const S = previewStage(api); S.play(CLOCK_HANDS(2.5), S.front() + 110 * S.k, 92); };

export const DOLL_SETS2 = packOf('doll', [
    // ---- 레어 ① 태엽 장난감 공방 (1차 계획) — 장난감을 쏘고 풀어놓는 원거리 소환 ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '태엽 장난감 공방', style: 'range', tint: 'sepia(0.4) saturate(1.8) hue-rotate(-10deg) brightness(1.1)',
        bonus: { 4: '깜짝 상자 포탄의 작은 장난감 3 → 5개' },
        kit: { 4: { patch: { dlJackBox: { n: 2 } } } },
        head: { name: '태엽 열쇠 모자', look: '머리에 꽂힌 큰 태엽 열쇠', skill: 'dlToyMarch', desc: '필살기 장난감 행진: 태엽 병정 6기가 행진 — 쓰러지거나 시간이 다 되면 터짐 (범위)', stats: { hp: 800, dps: 90, range: 30, speed: 10 } },
        body: { name: '태엽 상자 몸통', look: '등에 큰 태엽 감는 상자', skill: 'dlWindUp', desc: '태엽 감기: 6초간 아군 공격 +50%, 스킬 쿨다운 2배 빨리', stats: { hp: 1900, dps: 70, range: 0, speed: 10 } },
        arm: { name: '장난감 대포 팔', look: '팔에 박힌 알록달록 장난감 대포', skill: 'dlJackBox', desc: '기본 공격 장난감 포탄 (포물선, 작은 폭발) · 깜짝 상자 포탄: 큰 포탄 → 작은 장난감 3개가 흩어져 2차 폭발', stats: { hp: 400, dps: 460, range: 300, speed: 0 },
            kitAttack: { kind: 'lob', color: TOY, vfx: V.blast(40, 90, { dur: 0.35 }), splash: 60, splashMul: 0.5 } },
        leg: { name: '태엽 다리', look: '종아리에 작은 태엽', desc: '태엽 가속: 스킬을 쓸 때마다 2초간 진격 속도 +25%', stats: { hp: 800, dps: 60, range: 0, speed: 105 },
            passive: { name: '태엽 가속', desc: '스킬을 쓸 때마다 2초간 진격 속도 +25%', onSkill: { sec: 2, mods: { move: 0.25 } } } },
        skills: {
            dlToyMarch: { name: '장난감 행진', slot: 'head', ult: true, cd: 0, icon: 'minions', color: '#ffc878', target: 'self', clip: 'cast',
                desc: '태엽 병정 6기가 북을 치며 행진 — 쓰러지거나 5초가 되면 터짐 (큰 범위)',
                steps: [{ at: 0.3, do: 'custom', fn: toyMarchCall, preview: toyMarchCall.preview },
                    { at: 0.5, do: 'summon', n: 6, gap: 0.15, spread: 26, art: 'soldier', scale: 0.55, filter: TOY_TINT, hp: 0.04, dps: 0.25, speed: 1.3, life: 5, blast: { dmg: 2, radius: 100, fx: TOY_BLAST }, color: '#ffc878', vfx: JACK_POP(80) }] },
            dlWindUp: { name: '태엽 감기', slot: 'body', cd: 14, icon: 'gear', color: '#ffc878', target: 'self', clip: 'cast',
                desc: '6초간 아군 공격 +50%, 스킬 쿨다운 2배 빨리',
                steps: [{ do: 'buff', key: 'windUp', sec: 6, mods: { allyDmg: 0.5, cdRate: 1 }, vfx: V.gold(30, 180) }, { do: 'custom', fn: windUpFx, sec: 6, preview: windUpFx.preview }] },
            dlJackBox: { name: '깜짝 상자 포탄', slot: 'arm', cd: 9, icon: 'missile', color: '#ffc878', target: 'enemy', range: 320, clip: 'throw', p: { n: 3 },
                desc: '큰 포탄 — 터지며 작은 장난감 3개가 흩어져 2차 폭발',
                steps: [{ at: 0.35, do: 'custom', fn: jackBox, n: '$n', preview: jackBox.preview }] }
        }
    },

    // ---- 레어 ② 인형극 연출가 (1차 계획) — 꼭두각시를 크게 부리는 조종가 ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '인형극 연출가', style: 'support', tint: 'hue-rotate(-60deg) saturate(1.5) brightness(1.05)',
        bonus: { 4: '꼭두각시가 주는 피해 +50%' },
        kit: { 4: { mods: { puppetDmg: 0.5 } } },
        head: { name: '연출가 가면', look: '웃는·우는 두 얼굴 가면', skill: 'dlCurtainCall', desc: '필살기 커튼콜: 8초간 화면 보통 적 절반을 꼭두각시로, 끝날 때 꼭두각시가 터짐', stats: { hp: 850, dps: 100, range: 20, speed: 10 } },
        body: { name: '무대 장치 코트', look: '등에 접힌 무대 막·도르래', skill: 'dlStageCurtain', desc: '무대 막: 앞쪽에 무대 막(벽) 4초 — 적 진격과 원거리 공격을 막음', stats: { hp: 2000, dps: 80, range: 0, speed: 10 } },
        arm: { name: '조종 십자틀', look: '실이 잔뜩 매달린 조종 막대', skill: 'dlSnatch', desc: '낚아채기: 가장 강한 적 하나(엘리트 먼저)를 4초 꼭두각시로', stats: { hp: 500, dps: 500, range: 210, speed: 0 } },
        leg: { name: '무대 굽 구두', look: '굽 높은 연극 구두', desc: '관객의 갈채: 꼭두각시가 있을 때 적이 쓰러지면 필살기 게이지 +5%', stats: { hp: 850, dps: 60, range: 0, speed: 110 },
            passive: { name: '관객의 갈채', desc: '꼭두각시가 있을 때 적이 쓰러지면 필살기 게이지 +5%',
                on: [{ when: 'kill', fn: b => { if (b.enemies.some(e => e.puppetT > 0)) b.ultGauge = Math.min(1, b.ultGauge + 0.05); } }] } },
        skills: {
            dlCurtainCall: { name: '커튼콜', slot: 'head', ult: true, cd: 0, icon: 'puppet', color: '#46dcc8', target: 'enemy', range: 600, clip: 'strings',
                desc: '8초간 화면 보통 적 절반을 꼭두각시로 — 끝날 때 꼭두각시가 인사하며 터짐',
                steps: [{ at: 0.5, do: 'custom', fn: curtainCall, sec: 8, dmg: 1.5, hitDmg: 0.6, preview: curtainCall.preview }] },
            dlStageCurtain: { name: '무대 막', slot: 'body', cd: 15, icon: 'fort', color: '#46dcc8', target: 'self', clip: 'cast',
                desc: '앞쪽에 무대 막 4초 — 적이 넘어오지 못하고 원거리 공격을 막음',
                steps: [{ at: 0.45, do: 'zone', tag: 'curtain', wall: true, x: 30, w: 46, sec: 4 }, { at: 0.45, do: 'custom', fn: stageCurtainFx, sec: 4, preview: stageCurtainFx.preview },
                    { at: 0.45, do: 'buff', key: 'curtain', sec: 4, mods: { flags: ['projBlock'] } }, { at: 0.45, do: 'shake', power: 3, ms: 150 }] },
            dlSnatch: { name: '낚아채기', slot: 'arm', cd: 9, icon: 'puppet', color: '#46dcc8', target: 'enemy', range: 300, clip: 'strings',
                desc: '가장 강한 적 하나(엘리트 먼저)를 4초 꼭두각시로 — 그 적이 주변 적을 공격',
                steps: [{ at: 0.5, do: 'custom', fn: snatch, sec: 4, dmg: 1.6, preview: snatch.preview }] }
        }
    },

    // ---- 유니크 ① 영원한 가족 (1차 계획) — 거대 곰 인형 '아빠 곰'과 인형 가족 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '영원한 가족', style: 'tank', tint: 'sepia(0.6) saturate(1.2) brightness(1.25) drop-shadow(0 0 5px rgba(255, 230, 170, 0.8))',
        bonus: { 2: '꼭두각시 시간 +2초', 4: '아빠 곰과 함께 있을 때 쓰러진 적은 토끼 인형으로 (아빠 곰 한 번에 최대 3)' },
        kit: { 2: { mods: { puppetSec: 2 } }, 4: { on: [{ when: 'kill', flag: 'papaBear', fn: papaRabbit }] } },
        head: { name: '곰 귀 보닛', look: '곰 귀가 달린 크림색 보닛, 단추 장식', skill: 'dlPapaBear', desc: '필살기 아빠 곰: 거대한 곰 인형이 8초간 나타나 앞으로 걸으며 내려침 (범위 + 짧은 기절)', stats: { hp: 950, dps: 120, range: 30, speed: 10 } },
        body: { name: '인형 수선 앞치마', look: '바늘꽂이·실패·천 조각 앞치마', skill: 'dlRepair', desc: '인형 수선: 모든 아군 체력 전부 회복 + 6초간 받는 피해 -50%', stats: { hp: 2300, dps: 90, range: 0, speed: 10 } },
        arm: { name: '실 지휘봉', look: '끝에 실이 수십 가닥 매달린 지휘봉', skill: 'dlStringPrison', desc: '기본 공격 실 채찍 (15% 확률로 보통 적 2초 꼭두각시) · 실 감옥: 적 3명을 3초 매달았다 내리꽂음', stats: { hp: 600, dps: 560, range: 260, speed: 0 },
            kitAttack: { kind: 'melee', vfx: THREAD_WHIP, splash: 70, splashMul: 0.5, onHit: (b, e) => { if (isUnit(e) && !e.boss && !e.elite && Math.random() < 0.15) b.kitStatus(e, { puppet: 2 }); } } },
        leg: { name: '인형 장식 부츠', look: '발목에 작은 인형들이 매달린 부츠', desc: '가족 행렬: 내 아군·꼭두각시 하나마다 받는 피해 -4% (최대 -20%)', stats: { hp: 950, dps: 70, range: 0, speed: 120 },
            passive: { name: '가족 행렬', desc: '내 아군·꼭두각시 하나마다 받는 피해 -4% (최대 -20%)', perUnit: { def: 0.04, max: 0.2 } } },
        skills: {
            dlPapaBear: { name: '아빠 곰', slot: 'head', ult: true, cd: 0, icon: 'rabbit', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '거대한 곰 인형이 8초간 나타나 앞으로 걸으며 내려침 (범위 + 짧은 기절)',
                steps: [{ at: 0.45, do: 'buff', key: 'papaBear', sec: 8, mods: { flags: ['papaBear'] } }, { at: 0.45, do: 'custom', fn: b => { b.papaRabbits = 0; }, preview: () => {} },
                    { at: 0.45, do: 'summon', n: 1, x: 60, art: 'papa_bear', scale: 0.9, filter: 'drop-shadow(0 0 6px rgba(255, 230, 170, 0.7))', hp: 0.7, dps: 1.2, speed: 0.45, life: 8, color: '#ffe6aa', label: '아빠 곰!',
                        blast: { dmg: 2.5, radius: 140, fx: BEAR_BURST }, vfx: BEAR_DROP,
                        slam: { at: 0.43, dx: 70, radius: 120, status: { stun: 0.4 }, dmg: 0.5, fx: BEAR_SLAM, shake: [3, 140] } }] },
            dlRepair: { name: '인형 수선', slot: 'body', cd: 14, icon: 'stitch', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '모든 아군 체력 전부 회복 + 6초간 받는 피해 -50%',
                steps: [{ at: 0.45, do: 'heal', allies: true, allyRatio: 1 }, { at: 0.45, do: 'buff', key: 'repair', sec: 6, mods: { def: 0.5, allyDef: 0.5 } },
                    { at: 0.45, do: 'custom', fn: repairFx, sec: 6, preview: repairFx.preview }] },
            dlStringPrison: { name: '실 감옥', slot: 'arm', cd: 9, icon: 'puppet', color: '#ffe6aa', target: 'enemy', range: 120, clip: 'strings',
                desc: '적 3명을 실로 3초 매달았다가 바닥에 내리꽂음 (범위 피해)',
                steps: [{ at: 0.5, do: 'custom', fn: stringPrison, n: 3, sec: 3, dmg: 1.6, preview: stringPrison.preview }] }
        }
    },

    // ---- 레어 ③ 오르골 소녀 (지원) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '오르골 소녀', style: 'support', tint: 'hue-rotate(130deg) saturate(1.3) brightness(1.2)',
        bonus: { 4: '자장가 +2초' },
        kit: { 4: { patch: { dlLullaby: { sec: 2 } } } },
        head: { name: '오르골 왕관', look: '분홍·금 오르골 왕관', skill: 'dlLullaby', desc: '필살기 자장가: 6초간 화면 보통 적 잠듦 (맞으면 깸)' },
        body: { name: '태엽 오르골 몸통', look: '등에 오르골 태엽', skill: 'dlCarousel', desc: '회전 무대: 4초간 돌며 둘레 적 밀침 + 매초 피해' },
        arm: { name: '발레리나 인형 팔', look: '손 위의 작은 발레리나 인형', skill: 'dlBallerina', desc: '발레리나 투척: 작은 발레리나 인형이 적 사이를 돌며 벰' },
        leg: { name: '오르골 태엽 다리', look: '오르골 태엽 장식 다리', desc: '음악 상자: 꼭두각시·잠든 적에게 피해 +20%',
            passive: { name: '음악 상자', desc: '꼭두각시·잠든 적에게 주는 피해 +20%', target: [{ when: 'status', status: ['sleep', 'puppet'], dmg: 0.2 }] } },
        skills: {
            dlLullaby: { name: '자장가', slot: 'head', ult: true, cd: 0, icon: 'pause', color: '#ffaad2', target: 'enemy', range: 600, clip: 'cast', p: { sec: 6 },
                desc: '6초간 화면 보통 적이 잠듦 (맞으면 깸)',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0, status: { sleep: '$sec' } }, { at: 0.45, do: 'custom', fn: lullabyFx, sec: '$sec', preview: lullabyFx.preview }] },
            dlCarousel: { name: '회전 무대', slot: 'body', cd: 13, icon: 'whirl', color: '#ffaad2', target: 'self', clip: 'spin',
                desc: '4초간 빙글 돌며 둘레 적을 밀치고 매초 피해',
                steps: [{ at: 0.15, do: 'zone', follow: true, x: -90, w: 260, sec: 4, dps: 0.5 }, { at: 0.15, do: 'custom', fn: carouselFx, sec: 4, preview: carouselFx.preview },
                    { at: 0.15, do: 'push', range: 160, dist: 45, dmg: 0.3, repeat: 4, repeatGap: 1 }] },
            dlBallerina: { name: '발레리나 투척', slot: 'arm', cd: 8, icon: 'scissors', color: '#ffaad2', target: 'enemy', range: 300, clip: 'throw',
                desc: '작은 발레리나 인형이 적 사이를 돌며 벰 (갔다 돌아옴)',
                steps: [{ at: 0.35, do: 'wave', from: 0, speed: 300, dist: 300, w: 40, every: 0.3, dmg: 0.5, back: true, vfx: V.slash(-60, 70, { dur: 0.2, alpha: 0.6 }), vfxEvery: 0.18, b: 96 },
                    { at: 0.35, do: 'custom', fn: ballerinaFx, dist: 300, preview: ballerinaFx.preview }] }
        }
    },

    // ---- 레어 ④ 종이 인형 마술사 (사거리) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '종이 인형 마술사', style: 'range', tint: 'grayscale(0.8) brightness(1.35) contrast(1.2)',
        bonus: { 4: '종이 분신이 찢어질 때 종이학 5마리' },
        kit: { 4: { on: [{ when: 'allyDown', fn: (b, info) => {
            if (info.ally?.kitTag !== 'paper') return;
            runKitStep(b, { do: 'rain', count: 5, every: 0.1, radius: 40, dmg: 0.4, vfx: V.sheet('paper_crane', 100, { dur: 0.5 }) });
        } }] } },
        head: { name: '종이 모자', look: '흰 종이 접기 모자', skill: 'dlCraneStorm', desc: '필살기 종이학 폭풍: 종이학 40마리가 화면을 날며 벰' },
        body: { name: '종이 망토', look: '흰 종이와 검은 잉크 망토', skill: 'dlPaperClones', desc: '종이 분신: 종이 인형 3기 — 적이 노림, 6초 뒤나 맞으면 찢어지며 작은 폭발' },
        arm: { name: '가위 펜 팔', look: '가위와 잉크 펜이 달린 팔', skill: 'dlPaperBlades', desc: '종이 칼날: 휘어 날아가는 종이 칼날 4장 관통' },
        leg: { name: '종이 접기 다리', look: '종이 접기 다리', desc: '가벼운 종이: 진격 속도 +10%, 근접 피해 15% 피함',
            passive: { name: '가벼운 종이', desc: '진격 속도 +10%, 근접 공격 15%를 피함', mods: { move: 0.1, dodgeMelee: 0.15 } } },
        skills: {
            dlCraneStorm: { name: '종이학 폭풍', slot: 'head', ult: true, cd: 0, icon: 'fan', color: '#f5f5f0', target: 'enemy', range: 500, clip: 'cast',
                desc: '종이학 40마리가 화면을 날며 벰',
                steps: [{ at: 0.45, do: 'custom', fn: craneStorm, sec: 6, dmg: 0.35, vfx: CRANE_CUT, preview: craneStorm.preview }] },
            dlPaperClones: { name: '종이 분신', slot: 'body', cd: 14, icon: 'clone', color: '#f5f5f0', target: 'self', clip: 'cast',
                desc: '종이 인형 3기 — 적이 노림, 6초 뒤나 맞으면 찢어지며 작은 폭발',
                steps: [{ at: 0.45, do: 'custom', fn: paperClones, n: 3, preview: paperClones.preview }] },
            dlPaperBlades: { name: '종이 칼날', slot: 'arm', cd: 8, icon: 'scissors', color: '#f5f5f0', target: 'enemy', range: 360, clip: 'throw',
                desc: '휘어 날아가는 종이 칼날 4장 — 관통',
                steps: [{ at: 0.35, do: 'wave', from: 0, speed: 640, dist: 380, w: 35, dmg: 0.7, b: 120, repeat: 4, repeatGap: 0.1 },
                    { at: 0.35, do: 'custom', fn: paperBladesFx, dist: 380, preview: paperBladesFx.preview }] }
        }
    },

    // ---- 유니크 ② 그림자 인형극 (균형) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '그림자 인형극', style: 'balance', tint: 'brightness(0.55) saturate(0.8) hue-rotate(40deg) contrast(1.2)',
        bonus: { 2: '그림자 연극 +3초', 4: '그림자 연극 동안 적이 쓰러지면 가장 가까운 적이 3초 꼭두각시로' },
        kit: { 2: { patch: { dlShadowPlay: { sec: 3 } } }, 4: { on: [{ when: 'kill', flag: 'shadowPlay', fn: (b, info) => {
            const x = info.enemy ? aimAt(info.enemy).x : b.frontX();
            const t = b.enemies.filter(e => isUnit(e) && !e.boss && !(e.puppetT > 0)).sort((p, q) => Math.abs(aimAt(p).x - x) - Math.abs(aimAt(q).x - x))[0];
            if (t) b.kitStatus(t, { puppet: 3 });
        } }] } },
        head: { name: '그림자극 램프 모자', look: '작은 램프가 달린 검은 모자', skill: 'dlShadowPlay', desc: '필살기 그림자 연극: 8초간 적들의 그림자가 일어나 주인을 공격 (적마다 매초 자기 공격력만큼)' },
        body: { name: '램프 코트', look: '촛불 램프가 달린 코트', skill: 'dlCandleStage', desc: '촛불 무대: 6초간 촛불 원 — 아군 공격 +40%, 안의 적 감속' },
        arm: { name: '그림자 손 인형 팔', look: '그림자 손 인형을 낀 팔', skill: 'dlShadowCrows', desc: '그림자 까마귀: 까마귀 5마리가 적을 쪼고 2초 눈가림 (주는 피해 -70%)' },
        leg: { name: '그림자 발 다리', look: '그림자가 흐르는 다리', desc: '그림자 걸음: 원거리 공격 30% 피함',
            passive: { name: '그림자 걸음', desc: '원거리 공격 30%를 피함', mods: { dodgeRanged: 0.3 } } },
        skills: {
            dlShadowPlay: { name: '그림자 연극', slot: 'head', ult: true, cd: 0, icon: 'mind', color: '#966ec8', target: 'enemy', range: 600, clip: 'strings', p: { sec: 8 },
                desc: '8초간 적들의 그림자가 일어나 주인을 공격 — 적마다 매초 자기 공격력만큼',
                steps: [{ at: 0.5, do: 'buff', key: 'shadowPlay', sec: '$sec', mods: { flags: ['shadowPlay'] } }, { at: 0.5, do: 'custom', fn: shadowPlay, sec: '$sec', mul: 1, preview: shadowPlay.preview }] },
            dlCandleStage: { name: '촛불 무대', slot: 'body', cd: 14, icon: 'fire', color: '#966ec8', target: 'self', clip: 'cast',
                desc: '6초간 촛불 원 — 아군 공격 +40%, 안의 적 감속',
                steps: [{ at: 0.45, do: 'zone', tag: 'candleStage', x: -120, w: 320, sec: 6, slow: true, puff: V.embers(PORCELAIN), puffEvery: 0.6, puffB: 20 },
                    { at: 0.45, do: 'custom', fn: candleStageFx, sec: 6, preview: candleStageFx.preview },
                    { at: 0.45, do: 'buff', key: 'candleStage', sec: 6, mods: { allyDmg: 0.4 } }] },
            dlShadowCrows: { name: '그림자 까마귀', slot: 'arm', cd: 9, icon: 'wave', color: '#966ec8', target: 'enemy', range: 400, clip: 'throw',
                desc: '까마귀 5마리가 적을 쪼고 2초 눈가림 (주는 피해 -70%)',
                steps: [{ at: 0.35, do: 'custom', fn: shadowCrows, n: 5, range: 400, dmg: 0.7, preview: shadowCrows.preview }] }
        }
    },

    // ---- 유니크 ③ 도자기 인형 여왕 (탱커) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '도자기 인형 여왕', style: 'tank', tint: 'saturate(0.3) brightness(1.5) sepia(0.2) drop-shadow(0 0 4px rgba(255, 220, 140, 0.8))',
        bonus: { 2: '티 파티 +2명', 4: '깨진 찻잔 폭발 2배' },
        kit: { 2: { patch: { dlTeaParty: { n: 2 } } }, 4: { patch: { dlTeaParty: { mul: 1 } } } },
        head: { name: '도자기 티아라', look: '분홍 보석이 박힌 금빛 도자기 왕관', skill: 'dlTeaParty', desc: '필살기 티 파티: 보통 적 5명을 찻잔 의자에 앉혀 6초 멈춤 → 찻잔이 깨지며 폭발' },
        body: { name: '도자기 드레스', look: '장미 장식 도자기 무도회 드레스와 금빛 망토', skill: 'dlGoldMend', desc: '금 이음: 4초에 걸쳐 체력 8% 회복 + 보호막 15%' },
        arm: { name: '찻주전자 팔', look: '장미 무늬 도자기 찻주전자를 든 팔', skill: 'dlHotTea', desc: '뜨거운 차: 부채꼴로 뜨거운 차 — 화상 4초' },
        leg: { name: '도자기 구두', look: '흰 도자기 구두', desc: '깨지지 않는 미소: 체력 30% 아래로 떨어지면 판마다 한 번 4초 무적',
            passive: { name: '깨지지 않는 미소', desc: '체력 30% 아래로 떨어지면 판마다 한 번 4초 무적', lastStand: { below: 0.3, sec: 4, label: '깨지지 않는 미소!' } } },
        skills: {
            dlTeaParty: { name: '티 파티', slot: 'head', ult: true, cd: 0, icon: 'icecage', color: '#ffe6aa', target: 'enemy', range: 300, clip: 'cast', p: { n: 5, mul: 0 },
                desc: '보통 적 5명을 찻잔 의자에 앉혀 6초 멈춤 → 찻잔이 깨지며 폭발',
                steps: [{ at: 0.45, do: 'custom', fn: teaParty, n: '$n', sec: 6, dmg: 1.8, mul: '$mul', preview: teaParty.preview }] },
            dlGoldMend: { name: '금 이음', slot: 'body', cd: 14, icon: 'stitch', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '4초에 걸쳐 체력 8% 회복 + 보호막 15%',
                steps: [{ do: 'heal', over: [4, 0.02] }, { do: 'shield', ratio: 0.15, sec: 6, color: PORCELAIN }, { do: 'custom', fn: goldMendFx, sec: 6, preview: goldMendFx.preview }] },
            dlHotTea: { name: '뜨거운 차', slot: 'arm', cd: 8, icon: 'fire', color: '#ffe6aa', target: 'enemy', range: 200, clip: 'xcut',
                desc: '부채꼴로 뜨거운 차를 뿌림 — 화상 4초',
                steps: [{ at: 0.4, do: 'custom', fn: hotTea, range: 200, dmg: 0.8, preview: hotTea.preview }] }
        }
    },

    // ---- 레전더리 ① 꼭두각시 황제 (공격) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '꼭두각시 황제', style: 'dps', tint: 'brightness(0.65) saturate(1.8) sepia(0.4) hue-rotate(-10deg) drop-shadow(0 0 7px rgba(255, 210, 90, 0.85))',
        bonus: { 2: '황금 실 표식 3 → 2번', 4: '실의 왕좌 +4초' },
        kit: { 2: { patch: { _threadMark: { n: -1 } } }, 4: { patch: { dlThrone: { sec: 4 } } } },
        head: { name: '황제의 실 왕관', look: '수천 가닥 실이 늘어진 검은·금 왕관', skill: 'dlThrone', desc: '필살기 실의 왕좌: 10초간 1초마다 가장 강한 적을 끌어와 내리꽂음 (큰 피해 + 기절), 받는 피해 -50%' },
        body: { name: '황제의 망토', look: '금실로 수놓은 검은 망토', skill: 'dlLoyalty', desc: '충성 서약: 8초간 아군·꼭두각시 피해 +60%, 꼭두각시 시간 +3초' },
        arm: { name: '황금 조종 홀', look: '황금 실이 감긴 조종 홀', skill: 'dlThreadNet', desc: '기본 공격 황금 실 (같은 적 3번이면 2초 꼭두각시) · 실의 그물: 적 5명을 2초 매달아 모음',
            kitAttack: { kind: 'shot', color: EMPEROR, vfx: V.gold(0, 70, { dur: 0.3 }), splash: 40, splashMul: 0.4, onHit: goldThread } },
        leg: { name: '황제 구두', look: '금빛 굽의 검은 구두', desc: '군림: 엘리트·보스에게 피해 +20%, 꼭두각시 시간 +1초',
            passive: { name: '군림', desc: '엘리트·보스에게 주는 피해 +20%, 꼭두각시 시간 +1초', target: [{ when: 'elite', dmg: 0.2 }], mods: { puppetSec: 1 } } },
        skills: {
            dlThrone: { name: '실의 왕좌', slot: 'head', ult: true, cd: 0, icon: 'puppet', color: '#ffd25a', target: 'enemy', range: 500, clip: 'strings', p: { sec: 10 },
                desc: '실 왕좌에 앉음 — 1초마다 가장 강한 적을 끌어와 내리꽂음 (큰 피해 + 기절), 받는 피해 -50%',
                steps: [{ at: 0.5, do: 'buff', key: 'throne', sec: '$sec', mods: { def: 0.5 } }, { at: 0.5, do: 'custom', fn: throneFx, sec: '$sec', preview: throneFx.preview },
                    { at: 0.6, do: 'custom', fn: throneYank, range: 500, to: 40, sec: 0.3, dmg: 2.5, status: { stun: 1 }, repeat: '$sec', repeatGap: 1, preview: throneYank.preview }] },
            dlLoyalty: { name: '충성 서약', slot: 'body', cd: 15, icon: 'puppet', color: '#ffd25a', target: 'self', clip: 'cast',
                desc: '8초간 아군·꼭두각시 피해 +60%, 꼭두각시 시간 +3초',
                steps: [{ do: 'buff', key: 'loyalty', sec: 8, mods: { allyDmg: 0.6, puppetDmg: 0.6, puppetSec: 3 } }, { do: 'custom', fn: loyaltyFx, sec: 8, preview: loyaltyFx.preview }] },
            dlThreadNet: { name: '실의 그물', slot: 'arm', cd: 9, icon: 'net', color: '#ffd25a', target: 'enemy', range: 320, clip: 'strings',
                desc: '실 그물로 적 5명을 2초 매달아 한데 모음',
                steps: [{ at: 0.5, do: 'custom', fn: threadNet, n: 5, range: 320, dmg: 1, sec: 2, preview: threadNet.preview },
                    { at: 0.55, do: 'zone', tag: 'net', x: 60, w: 220, sec: 0.8, pull: 260 }] }
        }
    },

    // ---- 레전더리 ② 태엽 시계탑의 마녀 (균형) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '태엽 시계탑의 마녀', style: 'balance', tint: 'hue-rotate(100deg) saturate(1.4) brightness(1.05) drop-shadow(0 0 7px rgba(200, 150, 255, 0.85))',
        bonus: { 2: '자정의 종 폭발 범위 +50%', 4: '시간 되감기 쿨다운 절반 (16 → 8초)' },
        kit: { 2: { patch: { dlMidnight: { range: 150 } } }, 4: { flags: ['rewindBody'] } },
        head: { name: '시계탑 모자', look: '시계 톱니가 도는 자정 보라 모자', skill: 'dlMidnight', desc: '필살기 자정의 종: 1초마다 종 12번 — 울릴 때마다 화면 적 피해 + 0.3초 멈춤, 12번째에 큰 폭발' },
        body: { name: '톱니 드레스', look: '톱니바퀴가 돌아가는 드레스', skill: 'dlRewind', desc: '시간 되감기: 3초 전 체력으로 되돌림 + 팔 스킬 쿨다운 초기화' },
        arm: { name: '시계바늘 창', look: '거대한 시계바늘 창', skill: 'dlClockHands', desc: '기본 공격 시계바늘 찌르기 (관통, 0.2초 멈춤) · 시계바늘 회전: 거대 시계바늘 둘이 앞에서 3초 회전',
            kitAttack: { kind: 'pierce', n: 2, decay: 0.8, vfx: V.beam(CLOCK, 8), status: { stun: 0.2 } } },
        leg: { name: '태엽 구두', look: '태엽이 달린 구두', desc: '가속 태엽: 10초마다 3초간 진격·공격 속도 +20%',
            passive: { name: '가속 태엽', desc: '10초마다 3초간 진격·공격 속도 +20%', periodic: { every: 10, sec: 3, mods: { move: 0.2, atkSpd: 0.2 } } } },
        skills: {
            dlMidnight: { name: '자정의 종', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#c896ff', target: 'enemy', range: 600, clip: 'cast', p: { range: 300 },
                desc: '1초마다 종 12번 — 울릴 때마다 화면 적 피해 + 0.3초 멈춤, 12번째에 큰 폭발',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.4, status: { stun: 0.3 }, vfx: V.sheet('clock_gear', 90, { dur: 0.4 }), maxFx: 6, repeat: 12, repeatGap: 1 },
                    { at: 0.45, do: 'custom', fn: midnightFx, preview: midnightFx.preview },
                    // 폭발 이펙트는 fxOf로 감싼 정의여야 함 — spr(...) 한 층만 넣으면 fx.play가 def.layers를 못 읽어 오류 → 전투 루프가 멈춤 (11-19 영상: 12번째 종에서 게임 정지)
                    { at: 11.6, do: 'hit', pick: 'all', range: '$range', dmg: 3, knock: 1, vfx: fxOf(spr('clock_gear', 160, { frameRange: [4, 8], dur: 0.6 })) }, { at: 11.6, do: 'shake', power: 7, ms: 300 }] },
            dlRewind: { name: '시간 되감기', slot: 'body', cd: 16, icon: 'speed', color: '#c896ff', target: 'self', clip: 'cast',
                desc: '3초 전 체력으로 되돌림 + 팔 스킬 쿨다운 초기화 (4부위: 쿨다운 절반)',
                steps: [{ at: 0.45, do: 'custom', fn: rewind, preview: api => previewStage(api).play(REWIND, api.CHAR_X, 100) }] },
            dlClockHands: { name: '시계바늘 회전', slot: 'arm', cd: 9, icon: 'whirl', color: '#c896ff', target: 'enemy', range: 220, clip: 'spin',
                desc: '거대 시계바늘 둘이 앞에서 3초 회전 — 여러 번 피해 + 짧은 멈춤',
                steps: [{ at: 0.15, do: 'zone', follow: true, x: 0, w: 220, sec: 3, dps: 1, status: { stun: 0.2 }, every: 0.5, puff: fxOf({ type: 'sparks', at: 0, count: 4, speed: 160, life: [0.2, 0.4], color: CLOCK }), puffEvery: 0.25, puffB: 70 },
                    { at: 0.15, do: 'custom', fn: clockHandsFx, sec: 3, preview: clockHandsFx.preview }] }
        }
    }
]);
