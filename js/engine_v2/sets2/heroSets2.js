/* ==========================================================================
   PROJECT: MAD OVERLORD // 타락 히어로 2차 세트 (Q-009 · D-071 — MD/파츠확장_2차_기획안.md 5-3, 유니크 ①은 Q-008 3-2)
   유니크 ① 어둠의 군주(u) · 레어 ③ 사냥꾼 결사(c) · 레어 ④ 몰락한 기사단장(d) · 유니크 ② 공허의 예언자(v)
   · 유니크 ③ 심연 소환사(w) · 레전더리 ① 마왕(l) · 레전더리 ② 별을 먹는 자(m)
   세뇌 아군은 allies.js(convertEnemy · mindOrb). 스킬은 부품 단계(skillKit_v2.js), 동작은 rig/heroRig.js (raise·thrust·sweep은 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear, runKitStep } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';

const VIOLET = '170, 90, 255', HUNT = '150, 220, 120', KNIGHT = '255, 230, 170', VOID = '150, 130, 255', SOUL = '190, 110, 255', DEMON = '255, 60, 80', STAR = '200, 160, 255';
const SHADOW = 'brightness(0.18) saturate(0) drop-shadow(0 0 6px rgba(170, 80, 255, 0.95))';
const isUnit = e => !e.isBuilding && !e.isBarricade;

// ---- D-119 이펙트 (2026-11-10 피드백) ----
// 날개 방패: 검은 깃털이 맴도는 보라 돔 (방주 방벽 돔 시트를 보라로 · 돔 윤곽 가림 — 전기 같던 dark_burst 대신)
const WING_DOME = sec => fxOf(
    spr('dome_gold', 250, { anchorY: 0.88, dur: sec, frameRange: [1, 6], loopSec: 1.6, pingPong: true, hue: -150, glow: 0,
        fadeIn: 0.2, fadeOut: 0.35, mask: 'dome', rim: '200, 140, 255' }),
    spr('feather_black', 230, { dur: sec, frameRange: [1, 3], loopSec: 0.9, pingPong: true, alpha: 0.75, glow: 0, dy: -70, fadeIn: 0.25, fadeOut: 0.35 }));
const WING_WRAP = fxOf(spr('feather_black', 240, { dur: 0.6, frameRange: [0, 2], reverse: true, glow: 0.8, dy: -70 }));   // 깃털이 모여 감쌈
const WING_OPEN = fxOf(spr('feather_black', 320, { dur: 0.7, frameRange: [4, 7], glow: 1, dy: -70 }));                     // 깃털이 터지며 펼침
// 창의 비: 보라 창이 하늘에서 비스듬히 내리꽂힘 → 꽂힌 자리 터짐 (수정 창 투척과 같은 시트·방향 맞춤)
const SPEAR_DIR = 1.94;   // judgment_violet 1칸 그림 속 창끝 방향 (라디안, 아래 왼쪽)
const SPEAR_FALL = fly => fxOf(spr('judgment_violet', 210, { dur: fly, frameRange: [1, 1], travel: true, angleOffset: -SPEAR_DIR, anchorX: 0.36, anchorY: 0.8, glow: 1.2 }));
// 혜성: 하늘 왼쪽 위에서 대각선으로 떨어짐 → 땅에서 버섯 폭발 (예전 290px → 20% 크게)
const METEOR_DIR = 0.83;  // meteor_cyan 1·2칸 꼬리 → 머리 방향 (아래 오른쪽)
const COMET_FALL = fly => fxOf(spr('meteor_cyan', 250, { dur: fly, frameRange: [1, 2], loopSec: 0.16, travel: true, angleOffset: -METEOR_DIR,
    anchorX: 0.68, anchorY: 0.7, hue: 60, glow: 1.4 }));
// 어둠의 군주 4세트: 일식 때 떠 있던 검은 해가 땅으로 떨어져 터짐
const SUN_FALL = fly => fxOf(spr('eclipse_sun', 280, { dur: fly, frameRange: [1, 4], loopSec: 0.5, travel: true, angleOffset: -Math.PI / 2, glow: 1.5 }),
    { type: 'embers', at: 0, count: 26, speed: 120, angle: -Math.PI / 2, cone: 0.8, size: 2.6, life: [0.3, 0.6], drag: 1, color: '190, 110, 255' });
const SUN_BLAST = fxOf(spr('eclipse_sun', 460, { dur: 1, frameRange: [4, 8], glow: 1.4, dy: -90 }),
    spr('mutation_burst', 520, { dur: 0.9, frameRange: [2, 6], anchorY: 0.85, hue: 0, glow: 0.8 }),
    { type: 'shockwave', at: 0, dur: 0.6, r: 420, width: 18, ground: true, color: '190, 110, 255' });
// 유령 기사: 판정과 같이 달리는 기사 한 기 (예전엔 0.1초마다 0.35초짜리를 찍어 3~4기씩 겹쳐 보였음)
const KNIGHT_RIDE = fxOf(spr('ghost_cavalry', 210, { anchorY: 0.88, dur: 30, frameRange: [1, 4], loopSec: 0.4, fadeIn: 0.1, fadeOut: 0.2 }));
const KNIGHT_PREVIEW = fxOf(spr('ghost_cavalry', 210, { anchorY: 0.88, dur: 1.1, frameRange: [1, 4], loopSec: 0.4, travel: true, fadeIn: 0.1, fadeOut: 0.2 }));   // 실험실: 같은 기사가 앞으로 달림
const KNIGHT_GONE = fxOf(spr('ghost_cavalry', 210, { anchorY: 0.88, dur: 0.45, frameRange: [5, 8] }));
// 곰덫: 바닥에 놓인 톱니 덫 (skillFx2 beartrap) · 물 때 흙먼지
const TRAP_BITE = fxOf(spr('ground_impact', 90, { anchorY: 0.85, dur: 0.35, hue: 40, glow: 0, alpha: 0.8 }));
// 연발 석궁 기본 공격 / 연사 볼트: 은녹색 볼트가 날아가 꽂힘 (총구 섬광 + 탄 — fireShotFx)
const BOLT_HIT = V.needle(120, 70, { dur: 0.22, frameRange: [2, 4] });
const BOLT_SHOT = { hue: 120, speed: 1700, size: 100, flash: 56, hitVfx: BOLT_HIT };
const BOLT_FLY = fly => fxOf(spr('needle_crimson', 110, { dur: fly, frameRange: [1, 1], hue: 120, travel: true, anchorX: 0.6, glow: 1.3 }));

// 날개 방패가 끝날 때: 날개를 펼쳐 둘레 적을 밀치고 막은 피해의 store만큼 돌려줌
function wingBurst(b) {
    const dmg = b.kitStored || 0;
    b.kitStored = 0;
    if (!b.isActive) return;
    b.fx.play(WING_OPEN, b.monsterX + 50, FOOT_B);
    b.fx.play(V.ring(VIOLET, 200), b.monsterX + 60, FOOT_B);
    b.enemiesInRange(220).forEach(e => {
        b.dealDamageToEnemy(e, b.unit() * 0.8 + dmg, false, { knock: 1.4 });
        if (b.enemies.includes(e) && isUnit(e) && !e.boss) { e.x += 90; if (e.dom) e.dom.style.left = `${e.x}px`; }
    });
    if (dmg > 0) b.createDamagePopup(b.monsterX + 40, 220, '날개 반격!', false);
}

// 사냥 개시: 가장 강한 적에 표식 sec초 — 받는 피해 +vuln, 쓰러지면 게이지 refund (battle/kit.js kitOnKill)
function huntMark(b, ctx, s) {
    const t = pickTargets(b, 'strongest', 1, b.playerRange + 450)[0];
    if (!t) return;
    b.kitStatus(t, { vuln: [s.sec, s.vuln] });
    t.kitRefund = s.refund;
    b.createDamagePopup(aimAt(t).x - 20, aimAt(t).b + 70, '사냥감!', false);
    b.fx.play(V.xcut(-60, 110, { dur: 0.6 }), aimAt(t).x, aimAt(t).b, { follow: () => [aimAt(t).x, aimAt(t).b] });
    // 표식: 이름표 위에 뜨는 조준경 (D-119 — 몸 위 x자는 이름표에 가려 잘 안 보였음). 적 칸(e.dom)에 붙어 같이 움직임
    if (t.dom) {
        t.dom.querySelector('.v2-hunt-mark')?.remove();
        const mark = document.createElement('div');
        mark.className = 'v2-hunt-mark';
        mark.innerHTML = HUNT_MARK_SVG;
        t.dom.appendChild(mark);
        t.huntMarkEl = mark;
    }
    b.schedule(s.sec, () => {
        if (!t) return;
        t.kitRefund = 0;
        if (t.huntMarkEl) { t.huntMarkEl.classList.add('is-gone'); const el = t.huntMarkEl; t.huntMarkEl = null; setTimeout(() => el.remove(), 300); }
    });
}
const HUNT_MARK_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><g class="v2-hunt-mark__ring">' +
    '<circle cx="20" cy="20" r="13" /><path d="M20 2v9M20 29v9M2 20h9M29 20h9" /></g>' +
    '<circle class="v2-hunt-mark__dot" cx="20" cy="20" r="3" /></svg><i class="v2-hunt-mark__arrow"></i>';

// 덫 설치: 앞에 곰덫 n개 (밟으면 속박 + 피해). D-119: 예전엔 0.6초마다 퍼지는 고리만 보여 덫인지 몰랐고 고리가 겹쳐 개수가 많아 보였음
//   → 덫마다 톱니 곰덫 그림 하나 (물면 탁 닫힘). 사냥꾼 결사 4부위면 5개 (세트 효과)
function traps(b, ctx, s) {
    const n = Math.round(s.n), gap = 62;
    for (let i = 0; i < n; i++) {
        // tickT 0.3: 덫이 땅에 놓인 뒤 물기 시작 (놓이자마자 물면 덫 모양이 안 보였음)
        // once: 한 번 물면 물린 적의 속박(2초)이 풀릴 때 덫도 사라짐 (2026-11-10 저녁 피드백 — 예전엔 10초 동안 2.5초마다 다시 물었음)
        const z = b.kitZone({ tag: 'trap', x: 30 + i * gap, w: 34, sec: 10, status: { root: 2 }, every: 0.1, tickT: 0.3, once: true, dps: 0.25, hitFx: TRAP_BITE });
        b.fx.play(fxOf({ type: 'beartrap', at: 0, dur: 10, r: 20, bite: () => z.biteAge, life: () => z.t }),
            z.x + z.w / 2, FOOT_B, { follow: () => [z.x + z.w / 2, FOOT_B], alive: () => z.t > 0 && b.kitZones.includes(z) });
    }
}
traps.preview = (api, scale) => {   // 실험실: 덫 n개가 놓였다가 앞 덫이 물기
    const k = scale * 0.56, x0 = api.CHAR_X + 130 * k;
    let bitten = null;
    for (let i = 0; i < 3; i++) {
        api.vfx.play(fxOf({ type: 'beartrap', at: 0, dur: 3.5, r: 20, bite: () => (i === 0 && bitten != null ? api.vfx.time - bitten : null) }),
            x0 + i * 62 * k, api.GROUND_Y, { scale: k });
    }
    api.later(1.2, () => { bitten = api.vfx.time; api.hit(0); });
};

// 기사단 돌격: 유령 기사 n기가 차례로 화면을 가로지름 (기사단장 4부위면 8기 — 세트 효과)
function cavalry(b, ctx, s) {
    for (let i = 0; i < Math.round(s.n); i++) {
        b.schedule(i * 0.28, () => {
            if (!b.isActive) return;
            b.kitWave({ x: b.frontX() - 70, speed: 640, dist: 760, w: 55, dmg: 1.2, push: 45, knock: 0.8, ride: KNIGHT_RIDE, rideEnd: KNIGHT_GONE, b: FOOT_B + 4 });
        });
    }
}

// 연사 볼트: 총구에서 볼트를 차례로 쏨 — 날아가 꽂힐 때 피해 (D-119: 예전엔 탄 없이 맞은 자리 섬광만)
function bolts(b, ctx, s) {
    const targets = pickTargets(b, 'nearest', s.n, ctx.range);
    if (!targets.length) return;
    for (let i = 0; i < s.n * s.times; i++) {
        const t = targets[i % targets.length];
        b.schedule(Math.floor(i / targets.length) * s.every + (i % targets.length) * 0.05, () => {
            if (!b.isActive || !b.enemies.includes(t)) return;
            const m = monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 125 };
            const aim = aimAt(t), fly = Math.max(0.06, Math.min(0.22, Math.hypot(aim.x - m.x, aim.b - m.bottom) / 1700));
            b.fx.play(fxOf(spr('needle_crimson', 50, { dur: 0.12, frameRange: [2, 3], hue: 120, glow: 1.2 })), m.x, m.bottom);
            b.fx.play(BOLT_FLY(fly), m.x, m.bottom, { to: [aim.x, aim.b] });
            b.schedule(fly, () => {
                if (!b.isActive || !b.enemies.includes(t)) return;
                b.fx.play(BOLT_HIT, aimAt(t).x, aimAt(t).b);
                kitHit(b, t, s.dmg, s);
            });
        });
    }
}
bolts.preview = (api, scale) => {
    for (let i = 0; i < 6; i++) api.later(i * 0.08, () => {
        const m = api.muzzle(), d = api.dummies[i % 3], to = [d.x, api.enemyChestY()];
        api.vfx.play(BOLT_FLY(0.16), m[0], m[1], { scale, to });
        api.later(0.16, () => { api.vfx.play(BOLT_HIT, to[0], to[1], { scale }); api.hit(i % 3); });
    });
};

// 어둠의 군주 4세트: 일식 자리(앞 280px·높이 300)에 떠 있던 검은 해가 땅으로 떨어져 터짐 → 화면 큰 피해
function blackSunFall(b, ctx, s) {
    const x = b.frontX() + 280, fly = 0.75;
    b.fx.play(SUN_FALL(fly), x, 300, { to: [x, FOOT_B + 60] });
    b.director.shake(3, 700);
    b.schedule(fly, () => {
        if (!b.isActive) return;
        b.fx.play(SUN_BLAST, x, FOOT_B);
        b.director.shake(12, 600);
        runKitStep(b, { do: 'screen', dmg: s.dmg, baseMul: s.baseMul, vfx: V.dark(0, 150, { dur: 0.45 }), maxFx: 8 });
    });
}

// 시간 정지: sec초 화면 모든 적 멈춤 (보스 2초), 끝날 때 멈춘 동안 받은 피해의 echo만큼 한 번 더
function timeStop(b, ctx, s) {
    const list = b.enemies.filter(isUnit);
    list.forEach(e => { b.kitStatus(e, { stun: e.boss ? Math.min(2, s.sec) : s.sec }); e.kitStopHp = e.hp; });
    b.fx.play(V.sheet('time_stop', 460, { dur: 0.9 }), b.frontX() + 260, 200);
    const scr = document.getElementById('screen-battle-v2');
    if (scr) scr.classList.add('v2-timestop');
    b.schedule(s.sec, () => {
        if (scr) scr.classList.remove('v2-timestop');
        list.forEach(e => {
            if (!b.enemies.includes(e) || e.kitStopHp == null) return;
            const d = (e.kitStopHp - e.hp) * s.echo;
            e.kitStopHp = null;
            if (d > 0) { b.fx.play(V.dark(-40, 90), aimAt(e).x, aimAt(e).b); b.dealDamageToEnemy(e, d, false, { knock: 0.6 }); }
        });
    });
}

// 영혼 흡수: 앞 적 n명 피해 + 피해의 ratio만큼 회복
function soulDrain(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, b.playerRange + 150);
    let heal = 0;
    list.forEach((e, i) => b.schedule(i * 0.08, () => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(V.chainBolt(SOUL), aimAt(e).x, aimAt(e).b, { to: [b.monsterX + 50, 130] });
        b.fx.play(V.dark(40, 80), aimAt(e).x, aimAt(e).b);
        kitHit(b, e, s.dmg, { knock: 0.3 });
        heal += b.unit() * s.dmg * s.ratio;
        if (i === list.length - 1) b.kitHeal(heal);
    }));
    b.fx.play(V.motes(SOUL, 14), b.monsterX + 40, FOOT_B + 90);
}

// 별자리 심판: 별 n개에서 차례로 빛줄기 → 마지막에 별자리 전체 폭발
function constellation(b, ctx, s) {
    const n = Math.round(s.n);
    const x0 = b.frontX() + 50, span = 520;
    let prev = null;
    for (let i = 0; i < n; i++) {
        const x = x0 + (span * i) / Math.max(1, n - 1), top = 260 + (i % 2) * 50;
        const from = prev;
        prev = [x, top];
        b.schedule(i * 0.28, () => {
            if (!b.isActive) return;
            if (from) b.fx.play(V.chainBolt(STAR), from[0], from[1], { to: [x, top] });
            b.fx.play(V.sheet('star_judgment', 220, { anchorY: 0.92, dur: 0.6 }), x, FOOT_B);
            enemiesNear(b, x, 70).forEach(e => kitHit(b, e, s.dmg, { knock: 0.4 }));
        });
    }
    b.schedule(n * 0.28 + 0.3, () => {
        if (!b.isActive) return;
        b.fx.play(V.gold(220, 360, { dur: 0.7 }), x0 + span / 2, 180);
        b.director.shake(7, 300);
        b.enemies.filter(e => e.x - b.monsterX < 900).forEach(e => kitHit(b, e, s.final, { knock: 0.8, baseMul: 1.5 }));
    });
}

export const HERO_SETS2 = packOf('hero', [
    // ---- 유니크 ① 어둠의 군주 (Q-008 3-2) — 검은 날개와 부서진 왕관 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '어둠의 군주', style: 'balance', tint: 'brightness(0.75) saturate(1.6) hue-rotate(15deg)',
        bonus: { 2: '어둠 창에 맞은 적 15% 확률로 세뇌', 4: '일식이 끝날 때 검은 해가 떨어져 화면 큰 피해' },
        kit: { 2: { flags: ['spearMind'] }, 4: { on: [{ when: 'ult', delay: 8, label: '검은 해 낙하!', step: { do: 'custom', fn: blackSunFall, dmg: 4, baseMul: 1.5 } }] } },
        head: { name: '부서진 왕관', look: '금이 간 검은 왕관, 보라 불꽃', skill: 'hrEclipse', desc: '필살기 일식: 8초간 검은 해 — 모든 적 주는 피해 -40%·느려짐, 내 기본 공격이 화면 끝까지 닿는 어둠 파동', stats: { hp: 700, dps: 130, range: 40, speed: 15 } },
        body: { name: '검은 날개 갑주', look: '등에 큰 검은 날개 한 쌍', skill: 'hrWingShield', desc: '날개 방패: 3초간 모든 피해를 막음 → 펼치며 둘레 적 밀쳐냄 + 막은 피해의 50% 돌려줌', stats: { hp: 1500, dps: 130, range: 0, speed: 15 } },
        arm: { name: '군주의 어둠 창', look: '검보라 긴 창', skill: 'hrSpearRain', desc: '기본 공격 어둠 창 던지기 (관통, 짧은 경직) · 창의 비: 넓은 자리에 창 5자루 — 피해 + 1.5초 속박', stats: { hp: 450, dps: 480, range: 300, speed: 10 },
            kitAttack: { kind: 'pierce', n: 3, decay: 0.7, extra: 60, vfx: V.beam(VIOLET, 10), hitVfx: V.dark(0, 60, { dur: 0.3 }), status: { stun: 0.3 },
                onHit: (b, e) => { if (b.kitFlag('spearMind') && isUnit(e) && !e.boss && !e.elite && Math.random() < 0.15) b.convertEnemy(e); } } },
        leg: { name: '그림자 군화', look: '검은 깃털 장식 군화', desc: '군주의 가호: 세뇌·소환 아군이 받는 피해 -50%, 아군 피해 +15%', stats: { hp: 800, dps: 90, range: 0, speed: 125 },
            passive: { name: '군주의 가호', desc: '세뇌·소환 아군이 받는 피해 -50%, 아군 피해 +15%', mods: { allyDef: 0.5, allyDmg: 0.15 } } },
        skills: {
            hrEclipse: { name: '일식', slot: 'head', ult: true, cd: 0, icon: 'blackhole', color: '#aa5aff', target: 'enemy', range: 600, clip: 'raise', sfx: 'hero_curse_nova',
                desc: '8초간 검은 해 — 모든 적 주는 피해 -40%·느려짐, 내 기본 공격이 화면 끝까지 닿는 어둠 파동',
                steps: [{ at: 0.3, do: 'fx', x: 280, b: 300, vfx: V.sheet('eclipse_sun', 280, { dur: 1.2 }), repeat: 7, repeatGap: 1.1 },
                    { at: 0.4, do: 'screen', units: true, dmg: 0, status: { weak: [8, 0.4], slow: 8 } },
                    { at: 0.4, do: 'transform', sec: 8, attack: { kind: 'pierce', n: 8, decay: 0.9, extra: 700, vfx: V.beam('150, 70, 255', 22), hitVfx: V.dark(0, 70, { dur: 0.3 }) } }] },
            hrWingShield: { name: '날개 방패', slot: 'body', cd: 15, icon: 'shield', color: '#aa5aff', target: 'self', clip: 'cast',
                desc: '날개로 감싸 3초간 모든 피해를 막음 → 펼치며 둘레 적 밀쳐냄 + 막은 피해의 50% 돌려줌',
                // D-119: 전기처럼 보이던 dark_burst 반복 → 깃털이 모여 감싸고(0.6초) 보라 깃털 돔 3초 → 끝날 때 깃털이 터지며 펼침(wingBurst)
                steps: [{ do: 'buff', key: 'wingShield', sec: 3, mods: { flags: ['invuln'], store: 0.5, onEnd: { do: 'custom', fn: wingBurst } }, vfx: WING_WRAP },
                    { at: 0.1, do: 'fx', on: 'self', x: 15, follow: true, vfx: WING_DOME(2.9) }] },
            hrSpearRain: { name: '창의 비', slot: 'arm', cd: 9, icon: 'spikes', color: '#aa5aff', target: 'enemy', range: 380, clip: 'cast',
                desc: '앞쪽 넓은 자리에 어둠 창 5자루 — 피해 + 1.5초 속박',
                // D-119: 제자리에 뜨던 그림 → 창이 하늘에서 비스듬히 내리꽂힌 뒤(0.32초) 꽂힌 자리 터짐 (판정도 꽂힐 때)
                steps: [{ at: 0.3, do: 'rain', count: 5, every: 0.12, radius: 60, dmg: 1.4, status: { root: 1.5 }, fall: SPEAR_FALL(0.32), fallDx: 230, fallTo: 6, delay: 0.32,
                    vfx: V.judgment(0, 200, { dur: 0.5, frameRange: [3, 8] }), shake: 2 }] }
        }
    },

    // ---- 레어 ③ 사냥꾼 결사 (사거리) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '사냥꾼 결사', style: 'range', tint: 'hue-rotate(60deg) saturate(0.7) brightness(0.9)',
        bonus: { 4: '덫 3 → 5개' },   // 4부위 화면에 덫 5개는 이 세트 효과 (2026-11-10 확인)
        kit: { 4: { patch: { hrTraps: { n: 2 } } } },
        head: { name: '사냥꾼 두건', look: '짙은 녹색 두건과 은빛 가면', skill: 'hrHuntMark', desc: '필살기 사냥 개시: 가장 강한 적에 표식 10초 — 받는 피해 +60%, 쓰러지면 필살기 게이지 50%' },
        body: { name: '덫 사냥복', look: '덫·볼트가 매달린 짙은 녹색 사냥복', skill: 'hrTraps', desc: '덫 설치: 앞에 곰덫 3개 (4부위 세트 5개) — 밟은 적 2초 속박 + 피해' },
        // D-119: 석궁인데 칼처럼 베던 기본 공격 → 석궁을 들어 쏘는 동작(attack_shoot) + 볼트가 날아가 꽂힘
        arm: { name: '연발 석궁', look: '은빛 연발 석궁', skill: 'hrBolts', desc: '기본 공격 석궁 볼트 · 연사 볼트: 볼트 6발을 가까운 적들에게 나눠 쏨', rigAttack: 'attack_shoot', shotFx: BOLT_SHOT },
        leg: { name: '사냥 장화', look: '가죽 사냥 장화', desc: '추적자: 감속·속박된 적에게 피해 +20%',
            passive: { name: '추적자', desc: '감속·속박된 적에게 주는 피해 +20%', target: [{ when: 'status', status: ['slow', 'root'], dmg: 0.2 }] } },
        skills: {
            hrHuntMark: { name: '사냥 개시', slot: 'head', ult: true, cd: 0, icon: 'orbital', color: '#96dc78', target: 'enemy', range: 450, clip: 'cast',
                desc: '가장 강한 적에 표식 10초 — 받는 피해 +60%, 쓰러지면 필살기 게이지 50% 돌려받음',
                steps: [{ at: 0.3, do: 'custom', fn: huntMark, sec: 10, vuln: 0.6, refund: 0.5 }] },
            hrTraps: { name: '덫 설치', slot: 'body', cd: 13, icon: 'net', color: '#96dc78', target: 'self', clip: 'cast', p: { n: 3 },
                desc: '앞에 곰덫 3개 (10초, 사냥꾼 결사 4부위면 5개) — 밟은 적 2초 속박 + 피해',
                steps: [{ at: 0.3, do: 'custom', fn: traps, n: '$n', preview: traps.preview }] },
            hrBolts: { name: '연사 볼트', slot: 'arm', cd: 8, icon: 'rail', color: '#96dc78', target: 'enemy', range: 260, clip: 'thrust',
                desc: '볼트 6발을 가까운 적 셋에게 나눠 쏨',
                steps: [{ at: 0.2, do: 'custom', fn: bolts, n: 3, times: 2, every: 0.15, dmg: 0.9, preview: bolts.preview }] }
        }
    },

    // ---- 레어 ④ 몰락한 기사단장 (탱커) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '몰락한 기사단장', style: 'tank', tint: 'sepia(0.7) saturate(1.3) brightness(1.15)',
        bonus: { 4: '기사단 돌격 5 → 8기' },
        kit: { 4: { patch: { hrCavalry: { n: 3 } } } },
        head: { name: '기사단장 투구', look: '녹슨 금빛 투구와 흰 깃', skill: 'hrCavalry', desc: '필살기 기사단 돌격: 유령 기사 5기 (4부위 세트 8기)가 화면을 가로지름 — 피해 + 밀침' },
        body: { name: '기사단 판금', look: '녹슨 금빛 판금과 흰 망토', skill: 'hrPhalanx', desc: '방패 진형: 6초간 나·아군 받는 피해 -40%' },
        arm: { name: '기사단장 장검', look: '곧고 긴 기사 장검', skill: 'hrLunge', desc: '찌르기 돌파: 짧게 돌진하며 찌르기 — 관통 + 1초 기절' },
        leg: { name: '강철 박차 장화', look: '박차 달린 강철 장화', desc: '돌격 자세: 걷는 동안 받는 피해 -15%, 멈춘 뒤 첫 공격 2배',
            passive: { name: '돌격 자세', desc: '걷는 동안 받는 피해 -15%, 멈춘 뒤 첫 기본 공격 2배', self: [{ when: 'walking', mods: { def: 0.15 } }], firstHit: 2 } },
        skills: {
            hrCavalry: { name: '기사단 돌격', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#ffe6aa', target: 'enemy', range: 600, clip: 'raise', p: { n: 5 },
                desc: '유령 기사 5기가 차례로 화면을 가로지름 (몰락한 기사단장 4부위면 8기) — 피해 + 밀침',
                steps: [{ at: 0.4, do: 'custom', fn: cavalry, n: '$n', preview: (api, scale) => [0, 1, 2, 3, 4].forEach(i => api.later(i * 0.28, () =>
                    api.vfx.play(KNIGHT_PREVIEW, api.CHAR_X, api.GROUND_Y, { scale: scale * 0.56, to: [api.CHAR_X + 700 * scale * 0.56, api.GROUND_Y] }))) }, { at: 0.4, do: 'shake', power: 4, ms: 1400 }] },
            hrPhalanx: { name: '방패 진형', slot: 'body', cd: 14, icon: 'shield', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '6초간 나·아군 받는 피해 -40%',
                steps: [{ do: 'buff', key: 'phalanx', sec: 6, mods: { def: 0.4, allyDef: 0.4 }, vfx: V.gold(0, 190) },
                    { at: 0.2, do: 'fx', on: 'self', x: 30, vfx: V.ring('255, 220, 140', 150) }] },
            hrLunge: { name: '찌르기 돌파', slot: 'arm', cd: 9, icon: 'sword', color: '#ffe6aa', target: 'enemy', range: 140, clip: 'thrust',
                desc: '짧게 돌진하며 찌르기 — 관통 + 1초 기절',
                steps: [{ at: 0.15, do: 'dash', dist: 110, sec: 0.25, dmg: 1.8, pierce: 0.5, knock: 1, status: { stun: 1 } },
                    { at: 0.3, do: 'fx', on: 'self', x: 120, b: 115, vfx: V.slash(40, 140) }] }
        }
    },

    // ---- 유니크 ② 공허의 예언자 (균형) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '공허의 예언자', style: 'balance', tint: 'hue-rotate(-40deg) saturate(1.2) brightness(1.1)',
        bonus: { 2: '시간 정지 +1초', 4: '시간 정지 동안 기본 공격 2배 빠름' },
        kit: { 2: { patch: { hrTimeStop: { sec: 1 } } }, 4: { patch: { hrTimeStop: { atk: 1 } } } },
        head: { name: '예언자 눈가리개', look: '별무늬 청자색 눈가리개', skill: 'hrTimeStop', desc: '필살기 시간 정지: 4초간 화면 모든 적 멈춤 (보스 2초), 끝날 때 멈춘 동안 받은 피해의 50% 한 번 더' },
        body: { name: '별무늬 로브', look: '별무늬가 수놓인 청자색 로브', skill: 'hrForesight', desc: '예지: 5초 동안 공격 3번을 피함 + 피할 때마다 어둠 탄 반격' },
        arm: { name: '예언의 지팡이', look: '별이 박힌 긴 지팡이', skill: 'hrComet', desc: '혜성 소환: 혜성이 떨어짐 — 큰 범위 + 2초 불타는 자리' },
        leg: { name: '떠도는 별 신발', look: '발밑에 별빛이 맴도는 신발', desc: '별의 인도: 스킬 쿨다운 10% 빨리',
            passive: { name: '별의 인도', desc: '스킬 쿨다운이 10% 빨리 줄어듦', mods: { cdRate: 0.1 } } },
        skills: {
            hrTimeStop: { name: '시간 정지', slot: 'head', ult: true, cd: 0, icon: 'pause', color: '#9682ff', target: 'enemy', range: 600, clip: 'cast', p: { sec: 4, atk: 0 },
                desc: '4초간 화면 모든 적 멈춤 (보스 2초) — 끝날 때 멈춘 동안 받은 피해의 50% 한 번 더',
                steps: [{ at: 0.3, do: 'custom', fn: timeStop, sec: '$sec', echo: 0.5 }, { at: 0.3, do: 'buff', key: 'timeStop', sec: '$sec', mods: { atkSpd: '$atk' } }] },
            hrForesight: { name: '예지', slot: 'body', cd: 15, icon: 'clone', color: '#9682ff', target: 'self', clip: 'cast',
                desc: '5초 동안 공격 3번을 피함 — 피할 때마다 어둠 탄 반격',
                steps: [{ do: 'buff', key: 'foresight', sec: 5, mods: { guard: 3, counter: { do: 'hit', pick: 'nearest', range: 400, dmg: 1.2, vfx: V.dark(0, 90) } }, vfx: V.motes(VOID, 12) }] },
            hrComet: { name: '혜성 소환', slot: 'arm', cd: 9, icon: 'rocket', color: '#9682ff', target: 'enemy', range: 380, clip: 'cast',
                desc: '혜성이 떨어짐 — 큰 범위 피해 + 2초 불타는 자리',
                // D-119: 제자리에 뜨던 운석 → 하늘 왼쪽 위에서 떨어져(0.5초) 땅에서 터짐, 그림 20% 크게 (290 → 350)
                steps: [{ at: 0.35, do: 'rain', count: 1, radius: 120, dmg: 3, delay: 0.5, shake: 5, fall: COMET_FALL(0.5), fallDx: -380, fallTo: 10,
                    vfx: V.sheet('meteor_cyan', 350, { anchorY: 0.85, dur: 0.75, hue: 60, frameRange: [3, 8] }),
                    zone: { w: 160, sec: 2, status: { burn: [2, 0.3] }, every: 0.5, dps: 0.3, puff: V.blast(250, 60, { dur: 0.4 }), puffEvery: 0.2 } }] }
        }
    },

    // ---- 유니크 ③ 심연 소환사 (공격) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '심연 소환사', style: 'dps', tint: 'hue-rotate(160deg) saturate(1.3) brightness(0.9)',
        bonus: { 2: '그림자 군단 +2기', 4: '영혼 흡수 회복 50% → 100%' },
        kit: { 2: { patch: { hrShadowLegion: { n: 2 } } }, 4: { patch: { hrSoulDrain: { ratio: 0.5 } } } },
        head: { name: '소환사 뿔관', look: '보라·청록 문양이 빛나는 뿔관', skill: 'hrShadowLegion', desc: '필살기 그림자 군단: 그림자 병사 6기 8초 (근접, 사라질 때 폭발)' },
        body: { name: '소환 문양 갑주', look: '청록 소환 문양이 새겨진 갑주', skill: 'hrSoulDrain', desc: '영혼 흡수: 앞 적 최대 5명 피해 + 피해의 50% 회복' },
        arm: { name: '영혼 낫', look: '보라 빛 날의 큰 낫', skill: 'hrScythe', desc: '낫 휘두르기: 반원 크게 — 피해 + 3초 감속' },
        leg: { name: '그림자 장화', look: '그림자가 흘러내리는 장화', desc: '영혼 수확: 적이 쓰러질 때 3% 확률로 그림자 병사 (최대 3)',
            passive: { name: '영혼 수확', desc: '적이 쓰러질 때 3% 확률로 그림자 병사 1기 (최대 3)',
                onKill: { chance: 0.03, summon: { tag: 'shadow', max: 3, art: 'soldier', scale: 0.85, filter: SHADOW, hp: 0.1, dps: 0.35, speed: 0.8, life: 10, blast: { dmg: 1.5, radius: 80 }, color: '#be6eff', label: '그림자 병사!' } } } },
        skills: {
            hrShadowLegion: { name: '그림자 군단', slot: 'head', ult: true, cd: 0, icon: 'minions', color: '#be6eff', target: 'self', clip: 'raise', p: { n: 6 },
                desc: '그림자 병사 6기 8초 — 근접, 사라질 때 폭발',
                steps: [{ at: 0.4, do: 'summon', n: '$n', gap: 0.12, spread: 28, art: 'soldier', scale: 0.85, filter: SHADOW, hp: 0.1, dps: 0.35, speed: 0.8, life: 8,
                    blast: { dmg: 1.5, radius: 80 }, color: '#be6eff', vfx: V.sheet('shadow_rise', 170, { anchorY: 0.9, dur: 0.6 }) }] },
            hrSoulDrain: { name: '영혼 흡수', slot: 'body', cd: 14, icon: 'mind', color: '#be6eff', target: 'enemy', range: 150, clip: 'cast', p: { ratio: 0.5 },
                desc: '앞 적 최대 5명 피해 + 준 피해의 50% 회복',
                steps: [{ at: 0.3, do: 'custom', fn: soulDrain, n: 5, dmg: 1.5, ratio: '$ratio' }] },
            hrScythe: { name: '낫 휘두르기', slot: 'arm', cd: 8, icon: 'whirl', color: '#be6eff', target: 'enemy', range: 200, clip: 'sweep',
                desc: '반원을 크게 휘두름 — 피해 + 3초 감속',
                steps: [{ at: 0.38, do: 'hit', pick: 'all', range: 200, dmg: 1.4, status: { slow: 3 }, vfx: V.cleave(250, 170) }] }
        }
    },

    // ---- 레전더리 ① 마왕 (공격) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '마왕', style: 'dps', tint: 'hue-rotate(-30deg) saturate(2) brightness(0.8) drop-shadow(0 0 7px rgba(255, 40, 60, 0.8))',
        bonus: { 2: '공포의 오라 +2초', 4: '마왕 강림 동안 쓰러뜨린 적의 30%가 세뇌 아군으로' },
        kit: { 2: { patch: { hrFearAura: { sec: 2 } } }, 4: { on: [{ when: 'kill', flag: 'demonKing', chance: 0.3, fn: (b, info) => { if (info.enemy && isUnit(info.enemy) && !info.enemy.boss) b.mindOrb(info.enemy.x); } }] } },
        head: { name: '마왕의 뿔 투구', look: '진홍·검정 큰 뿔 투구', skill: 'hrDemonKing', desc: '필살기 마왕 강림: 10초간 마왕 모습 — 1.4배, 넓은 어둠 베기, 받는 피해 -40%' },
        body: { name: '마왕 망토 갑주', look: '진홍 안감의 검은 망토 갑주', skill: 'hrFearAura', desc: '공포의 오라: 6초간 둘레 적이 겁먹어 뒤로 물러남' },
        arm: { name: '마검', look: '진홍 빛이 흐르는 검은 마검', skill: 'hrBladeDance', desc: '기본 공격 마검 참격 (관통 반달) · 마검 연무: 앞 적들 사이를 오가며 5번 베기',
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, extra: 40, vfx: V.beam(DEMON, 14), hitVfx: V.cleave(0, 110, { dur: 0.3 }) } },
        leg: { name: '마왕 군화', look: '진홍 장식의 검은 군화', desc: '마왕의 위압: 보통 적 이동 -10%, 아군 피해 +20%',
            passive: { name: '마왕의 위압', desc: '보통 적(엘리트·보스 빼고) 이동 -10%, 아군 피해 +20%', enemySlow: 0.1, mods: { allyDmg: 0.2 } } },
        skills: {
            hrDemonKing: { name: '마왕 강림', slot: 'head', ult: true, cd: 0, icon: 'rampage', color: '#ff3c50', target: 'self', clip: 'raise',
                desc: '10초간 마왕 모습 — 크기 1.4배, 기본 공격이 넓은 어둠 베기, 받는 피해 -40%',
                steps: [{ at: 0.4, do: 'transform', sec: 10, giant: 1.4, mods: { def: 0.4, flags: ['demonKing'] },
                    attack: { kind: 'melee', vfx: V.cleave(0, 230), splash: 200, splashMul: 0.7, knock: 1 } },
                    { at: 0.4, do: 'fx', on: 'self', x: 25, follow: true, vfx: V.sheet('demon_king', 320, { anchorY: 0.92, dur: 0.9 }), repeat: 11, repeatGap: 0.9 },
                    { at: 0.4, do: 'shake', power: 6, ms: 400 }] },
            hrFearAura: { name: '공포의 오라', slot: 'body', cd: 15, icon: 'horn', color: '#ff3c50', target: 'self', clip: 'cast', p: { sec: 6 },
                desc: '6초간 둘레 적이 겁먹어 뒤로 물러남 (공격 못 함)',
                steps: [{ do: 'zone', follow: true, x: -40, w: 300, sec: '$sec', status: { fear: 1.2 }, every: 1, puff: V.dark(-20, 120, { dur: 0.5 }), puffEvery: 0.25 },
                    { do: 'fx', on: 'self', x: 40, vfx: V.ring('200, 40, 60', 200) }] },
            hrBladeDance: { name: '마검 연무', slot: 'arm', cd: 9, icon: 'sword', color: '#ff3c50', target: 'enemy', range: 260, clip: 'sweep',
                desc: '앞 적들 사이를 오가며 5번 베기',
                steps: [{ at: 0.15, do: 'hit', pick: 'random', n: 1, range: 260, times: 5, every: 0.12, dmg: 1, vfx: V.cleave(0, 140, { dur: 0.3 }) }] }
        }
    },

    // ---- 레전더리 ② 별을 먹는 자 (사거리) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '별을 먹는 자', style: 'range', tint: 'hue-rotate(40deg) saturate(1.6) brightness(1.05) drop-shadow(0 0 7px rgba(180, 120, 255, 0.85))',
        bonus: { 2: '유성 사슬 +3번', 4: '별자리 심판 별 7 → 10개' },
        kit: { 2: { patch: { hrStarChain: { n: 3 } } }, 4: { patch: { hrConstellation: { n: 3 } } } },
        head: { name: '은하 왕관', look: '은하가 소용돌이치는 왕관', skill: 'hrConstellation', desc: '필살기 별자리 심판: 별 7개에서 차례로 빛줄기 → 별자리 전체 폭발' },
        body: { name: '성운 망토', look: '보라 성운이 흐르는 망토', skill: 'hrNebula', desc: '성운 장막: 6초간 나·아군 받는 피해 -40%, 원거리 피해·효과 -80%' },
        arm: { name: '별빛 오브', look: '손 위에 떠 있는 별빛 구슬', skill: 'hrStarChain', desc: '기본 공격 별빛 구슬 (원거리 유도, 작은 폭발) · 유성 사슬: 별빛이 적 6명을 튀며 피해 + 0.5초 기절',
            kitAttack: { kind: 'shot', color: STAR, vfx: V.gold(220, 70, { dur: 0.3 }), splash: 60, splashMul: 0.5 } },
        leg: { name: '별똥 장화', look: '별똥 꼬리가 남는 장화', desc: '별의 가호: 필살기 게이지 20% 빨리 참',
            passive: { name: '별의 가호', desc: '필살기 게이지가 20% 빨리 참', mods: { ult: 0.2 } } },
        skills: {
            hrConstellation: { name: '별자리 심판', slot: 'head', ult: true, cd: 0, icon: 'orbital', color: '#c8a0ff', target: 'enemy', range: 600, clip: 'cast', p: { n: 7 },
                desc: '별 7개에서 차례로 빛줄기 → 마지막에 별자리 전체 폭발',
                steps: [{ at: 0.3, do: 'custom', fn: constellation, n: '$n', dmg: 1.6, final: 3 }] },
            hrNebula: { name: '성운 장막', slot: 'body', cd: 15, icon: 'shield', color: '#c8a0ff', target: 'self', clip: 'cast',
                desc: '6초간 나·아군 받는 피해 -40%, 원거리 피해·효과 -80%',
                steps: [{ do: 'buff', key: 'nebula', sec: 6, mods: { def: 0.4, allyDef: 0.4, rangedCut: 0.8 }, vfx: V.portal(200, 240, { dur: 0.8 }) },
                    { at: 0.3, do: 'fx', on: 'self', x: 20, b: FOOT_B + 110, vfx: V.motes(STAR, 10), repeat: 6, repeatGap: 1 }] },
            hrStarChain: { name: '유성 사슬', slot: 'arm', cd: 9, icon: 'chain', color: '#c8a0ff', target: 'enemy', range: 400, clip: 'cast', p: { n: 6 },
                desc: '별빛이 적 6명을 차례로 튀며 피해 + 0.5초 기절',
                steps: [{ at: 0.3, do: 'chain', n: '$n', range: 400, jump: 220, dmg: 1.1, decay: 0.95, status: { stun: 0.5 }, vfx: V.chainBolt(STAR), hitVfx: V.gold(220, 60) }] }
        }
    }
]);
