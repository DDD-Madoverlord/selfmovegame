/* ==========================================================================
   PROJECT: MAD OVERLORD // 심연의 길잡이 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-5)
   레어 ① 심해 잠수정(a) · 레어 ② 심해 등불지기(b) · 유니크 ① 유령선 선장(u) · 레어 ③ 산호 수호자(c) · 레어 ④ 해파리 발광체(d)
   · 유니크 ② 열수구 탐사대(v) · 유니크 ③ 고대 해신 기사(w) · 레전더리 ① 리바이어던(l) · 레전더리 ② 별바다 항해사(m)
   끌어오기는 battle/diver.js pullEnemy, 밀어내기는 단계 push(dist가 음수면 끌어옴). 새 캐릭터 세트는 강화 그림 + 세트 색.
   동작은 rig/diverRig.js (thrust·slam은 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { FOOT_B } from '../battle/tuning.js';
import { monsterControllerV2 as monster } from '../monster_v2.js';
import { enemiesNear, kitHit } from '../skillKit_v2.js';

const WATER = '90, 225, 235', ABYSS = '40, 220, 190', CORAL = '255, 140, 150', JELLY = '220, 140, 255', STEAM = '240, 240, 235', GOLD = '255, 215, 110', STAR = '200, 180, 255';
const isUnit = e => !e.isBuilding && !e.isBarricade;

// 심연의 등대: 원거리 적(사수·의무병·수리공 등)이 빛을 향해 걸어 나옴
function lureRanged(b) {
    b.enemies.filter(e => isUnit(e) && !e.boss && e.t && (e.t.ranged || e.t.heal || e.t.net || e.t.sludge || e.t.spell) && e.x - b.monsterX < 900)
        .forEach(e => { if (b.pullEnemy) b.pullEnemy(e, b.frontX() + 80, 1.4); b.kitPushed?.(e); });
}

// 산호초 성벽: 앞쪽에 산호 벽 3개 (적 진격 막음, 닿은 적 가시 피해, 끝날 때 무너짐)
function coralWalls(b, ctx, s) {
    [40, 110, 180].forEach((x, i) => b.schedule(i * 0.12, () => {
        if (!b.isActive) return;
        b.kitZone({ tag: 'coral', wall: true, x, w: 34, sec: s.sec, dps: 0.35, puff: V.sheet('coral_pink', 120, { anchorY: 0.9, dur: 0.6 }), puffEvery: 0.35,
            end: { dmg: s.endDmg, radius: 90, vfx: V.impact(-30, 140) } });
        b.fx.play(V.impact(-30, 150), b.frontX() + x + 17, FOOT_B);
    }));
}

// ---- D-126 (2026-11-14 저녁): 리바이어던 · 별바다 항해사 ----
// 심해 압력장: 예전엔 바닥 물 장판뿐 → 압력장 너비에 짙은 바닷물 기둥(pressureField — 일렁이는 수면·빛줄기·오르는 거품·1초마다 내려오는 압력 물결)
function pressureField(b, ctx, s) {
    const z = b.kitZone({ tag: 'pressure', field: 'water', x: 0, w: s.w, sec: s.sec, slow: true, dps: 0.4, status: { weak: [1, 0.3] }, every: 0.5 });
    if (!z) return;
    b.fx.play(fxOf({ type: 'pressureField', at: 0, dur: s.sec + 0.3, w: s.w, h: 240, remaining: () => z.t }), z.x + z.w / 2, FOOT_B,
        { follow: () => [z.x + z.w / 2, FOOT_B], alive: () => b.kitZones.includes(z) });
}
pressureField.preview = api => {
    const k = api.VFX_SCALE * 0.56, d = api.dummies, x0 = api.CHAR_X + 60 * k, x1 = d[d.length - 1].x + 40 * k;
    api.vfx.play(fxOf({ type: 'pressureField', at: 0, dur: 3, w: (x1 - x0) / k, h: 240 }), (x0 + x1) / 2, api.GROUND_Y, { scale: k });
};

// 소용돌이 닻: 예전엔 바닥 물 장판뿐 → 물 닻(spirit_set 5칸, Gemini) 두 개가 몸 둘레를 크게 돌며(orbit) 소용돌이(water_burst 고리, 눕혀 회전),
//   둘레에서 물보라가 안쪽으로 빨려 듦(gather) — 3초
const ANCHOR = (sec, phase) => spr('spirit_set', 130, { dur: sec, frameRange: [5, 5], glow: 1.2, fadeIn: 0.15, fadeOut: 0.3, dy: -60,
    orbit: { r: 150, ry: 46, speed: 7, phase, spin: 1.4 } });
const WHIRL = sec => fxOf(ANCHOR(sec, 0), ANCHOR(sec, Math.PI),
    spr('water_burst', 330, { dur: sec, frameRange: [3, 3], squash: 0.32, spin: 5, alpha: 0.8, fadeIn: 0.2, fadeOut: 0.4, layer: 'ground' }),
    spr('tidal_wave', 200, { dur: sec, frameRange: [5, 7], loopSec: 0.45, alpha: 0.55, dx: 120, anchorY: 0.9, fadeOut: 0.4 }),
    { type: 'gather', at: 0, dur: sec, r: 200, count: 22, cycles: 4, color: WATER, dy: -40 });
function whirlAnchor(b, ctx, s) {
    const at = () => [b.monsterX + 60, FOOT_B + 10];
    b.fx.play(WHIRL(s.sec), ...at(), { follow: at, alive: () => b.isActive });
}
whirlAnchor.preview = api => api.vfx.play(WHIRL(2.5), api.CHAR_X, api.GROUND_Y, { scale: api.VFX_SCALE * 0.6 });

// 은하 해류 (필살기): 예전엔 작은 별 해류 그림(200)을 0.1초마다 찍는 작은 파도 8번 → 8초 동안 화면을 가로지르는 큰 은하 물결(star_current 1~4칸 크게)이
//   흐르고, 매초 거대한 은하 소용돌이(star_current 4~7칸 400)가 판정과 함께 밀고 나가며(wave ride), 맞으면 보라 별빛 터짐
const GALAXY_FLOW = sec => fxOf(spr('star_current', 0, { width: 760, height: 360, dur: sec, frameRange: [1, 4], loopSec: 1.1, pingPong: true, alpha: 0.7,
        anchorX: 0.02, fadeIn: 0.5, fadeOut: 0.8, softEdges: 0.2 }),
    { type: 'motes', at: 0, count: 40, spread: 340, rise: [20, 80], life: [0.8, 1.4], size: 2.6, color: STAR, dx: 320 });
const GALAXY_RIDE = fxOf(spr('star_current', 400, { dur: 30, frameRange: [3, 6], loopSec: 0.5, glow: 1.3, fadeIn: 0.1 }),
    { type: 'sparks', at: 0, count: 8, speed: 200, angle: Math.PI, cone: 0.6, color: STAR });
const GALAXY_END = fxOf(spr('star_current', 380, { dur: 0.6, frameRange: [6, 8], glow: 1.2 }));
const GALAXY_HIT = fxOf(spr('star_judgment', 160, { dur: 0.45, frameRange: [4, 7], anchorY: 0.6, glow: 1.2 }), { type: 'flash', at: 0, dur: 0.12, r: 40, color: STAR });
function galaxyFlow(b, ctx, s) {
    b.fx.play(GALAXY_FLOW(s.sec), b.monsterX + 60, FOOT_B + 120, { follow: () => [b.monsterX + 60, FOOT_B + 120], alive: () => b.isActive });
}
galaxyFlow.preview = api => {
    const k = api.VFX_SCALE * 0.5;
    api.vfx.play(GALAXY_FLOW(3), api.CHAR_X, api.GROUND_Y - 120 * k, { scale: k });
    api.later(0.3, () => api.vfx.play(GALAXY_RIDE, api.CHAR_X + 200 * k, api.GROUND_Y - 120 * k, { scale: k, to: [api.CHAR_X + 700 * k, api.GROUND_Y - 120 * k] }));
};

// 별빛 거품: 예전엔 머리 위 아이콘과 처음 포털 그림뿐 → 5초 동안 몸을 감싼 무지개빛 비눗방울(bubble — 테 색이 돌고, 반사광·별가루, 끝에 톡 터짐)
function starBubble(b, ctx, s) {
    const at = () => [b.monsterX + 60, FOOT_B + 95];
    b.fx.play(fxOf({ type: 'bubble', at: 0, dur: s.sec, r: 100, ry: 118 }), ...at(), { follow: at, alive: () => b.isActive });
}
starBubble.preview = api => api.vfx.play(fxOf({ type: 'bubble', at: 0, dur: 3, r: 100, ry: 118 }), api.CHAR_X, api.GROUND_Y - 95 * api.VFX_SCALE * 0.6, { scale: api.VFX_SCALE * 0.6 });

// 별똥 작살비: 예전엔 금빛 터짐(golden_burst)만 → 작살총에서 별빛이 하늘로 쏘아 오른 뒤, 하늘에서 별똥 작살(spirit_set 4칸)이 비스듬히 꽂히고
//   꽂힌 자리에 별빛 기둥 조각 + 작은 충격
const HARPOON_FALL = fly => fxOf(spr('spirit_set', 210, { dur: fly, frameRange: [4, 4], travel: true, angleOffset: -Math.PI / 2, anchorY: 0.82, glow: 1.4 }));
const HARPOON_HIT = fxOf(spr('star_judgment', 170, { dur: 0.5, frameRange: [4, 7], anchorY: 0.92, glow: 1.2 }),
    { type: 'shockwave', at: 0, dur: 0.35, r: 70, width: 6, ground: true, color: STAR },
    { type: 'sparks', at: 0, count: 8, speed: 260, angle: -Math.PI / 2, cone: 1.8, color: STAR });
const HARPOON_UP = fxOf({ type: 'streaks', at: 0, count: 6, speed: 900, angle: -Math.PI / 2, cone: 0.25, len: 40, color: STAR },
    { type: 'flash', at: 0, dur: 0.12, r: 40, color: STAR });
function harpoonsUp(b) {
    const m = monster.getMuzzlePoint();
    if (m) b.fx.play(HARPOON_UP, m.x, m.bottom);
}
harpoonsUp.preview = api => api.vfx.play(HARPOON_UP, ...api.muzzle(), { scale: api.VFX_SCALE * 0.6 });

export const DIVER_SETS2 = packOf('diver', [
    // ---- 레어 ① 심해 잠수정 (1차 계획) — 멀리서 어뢰로 부수는 포격형 ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '심해 잠수정', style: 'range', tint: 'hue-rotate(20deg) saturate(1.3) brightness(1.05)',
        bonus: { 4: '어뢰 일제 발사 3 → 5발, 어뢰 폭발 범위 +20%' },
        kit: { 4: { patch: { dvTorpedoes: { n: 2 } } } },
        head: { name: '잠망경 잠수모', look: '잠망경과 탐조등이 달린 둥근 잠수모', skill: 'dvPressure', desc: '필살기 심해 수압: 6초간 화면 모든 적이 짓눌림 — 느려짐 + 매초 피해 (거점에도 절반)', stats: { hp: 800, dps: 110, range: 40, speed: 0 } },
        body: { name: '기포 방패 잠수복', look: '등 뒤 기포 발생기·유리 돔', skill: 'dvBubble', desc: '기포 방패: 6초간 원거리 피해·효과 흡수, 끝날 때 터지며 둘레 적 밀쳐냄', stats: { hp: 2100, dps: 80, range: 0, speed: -5 } },
        arm: { name: '어뢰 발사관', look: '팔에 달린 3연장 어뢰관', skill: 'dvTorpedoes', desc: '기본 공격 어뢰 (첫 적에서 작은 폭발) · 어뢰 일제 발사: 어뢰 3발이 서로 다른 적에게', stats: { hp: 400, dps: 470, range: 330, speed: 0 },
            kitAttack: { kind: 'shot', color: WATER, vfx: V.water(0, 90, { dur: 0.35 }), splash: 60, splashMul: 0.5 } },
        leg: { name: '추진 핀 잠수화', look: '발뒤꿈치 추진 프로펠러', desc: '부력 추진: 기절·속박이 풀린 뒤 2초간 진격 속도 +30%', stats: { hp: 900, dps: 60, range: 0, speed: 90 },
            passive: { name: '부력 추진', desc: '기절·속박이 풀린 뒤 2초간 진격 속도 +30%', afterCc: { sec: 2, mods: { move: 0.3 } } } },
        skills: {
            dvPressure: { name: '심해 수압', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#5ae1eb', target: 'enemy', range: 600, clip: 'cast', sfx: 'diver_surge',
                desc: '6초간 화면 모든 적이 짓눌림 — 느려짐 + 매초 피해 (거점에도 절반)',
                steps: [{ at: 0.4, do: 'screen', dmg: 0.5, baseMul: 0.5, status: { slow: 1.2 }, vfx: V.water(0, 90, { dur: 0.4 }), maxFx: 6, repeat: 6, repeatGap: 1 },
                    { at: 0.4, do: 'fx', x: 260, b: 300, vfx: V.water(-15, 300, { anchorY: 0.9, dur: 0.8 }), repeat: 6, repeatGap: 1 }] },
            dvBubble: { name: '기포 방패', slot: 'body', cd: 15, icon: 'shield', color: '#5ae1eb', target: 'self', clip: 'cast',
                desc: '6초간 거품 막 — 원거리 피해·효과를 흡수, 끝날 때 터지며 둘레 적 밀쳐냄',
                steps: [{ do: 'buff', key: 'bubble', sec: 6, mods: { rangedCut: 1, onEnd: { do: 'push', range: 180, dist: 100, dmg: 0.8 } }, vfx: V.water(0, 200, { dur: 0.8 }) },
                    { at: 0.8, do: 'fx', on: 'self', x: 25, b: FOOT_B + 70, follow: true, vfx: V.motes(WATER, 8), repeat: 6, repeatGap: 0.9 }] },
            dvTorpedoes: { name: '어뢰 일제 발사', slot: 'arm', cd: 9, icon: 'missile', color: '#5ae1eb', target: 'enemy', range: 380, clip: 'cast', p: { n: 3 },
                desc: '어뢰 3발이 서로 다른 적에게 — 맞은 자리 물 폭발',
                steps: [{ at: 0.42, do: 'hit', pick: 'random', n: '$n', dmg: 1.3, knock: 0.6, vfx: V.water(0, 120) }] }
        }
    },

    // ---- 레어 ② 심해 등불지기 (1차 계획) — 끌어모아 버티는 근접 탱커 ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '심해 등불지기', style: 'tank', tint: 'hue-rotate(-20deg) saturate(1.6) brightness(1.1)',
        bonus: { 4: '체력 30% 아래로 떨어지면 등불이 켜져 5초간 받는 피해 -40% (판마다 한 번)' },
        kit: { 4: { on: [{ when: 'lowHp', once: 'lamp', label: '등불 점화!', buff: { key: 'lamp', sec: 5, mods: { def: 0.4 } }, vfx: V.pillar(-80, 200) }] } },
        head: { name: '등대 잠수모', look: '정수리에 큰 청록 등불, 빛이 새는 창', skill: 'dvLighthouse', desc: '필살기 심연의 등대: 8초간 등불 빛 — 빛 안 적은 받는 피해 +30%, 원거리 적은 빛을 향해 걸어 나옴', stats: { hp: 1000, dps: 80, range: 20, speed: 0 } },
        body: { name: '유령 불꽃 잠수복', look: '가슴 유리창 안 청록 유령 불길', skill: 'dvGhostFire', desc: '유령 불길: 5초간 둘레 불길 장판 — 지속 피해 + 안의 적 주는 피해 -30%', stats: { hp: 2500, dps: 60, range: 0, speed: 0 } },
        arm: { name: '사슬 앵커', look: '굵은 사슬에 매단 큰 앵커', skill: 'dvChainSweep', desc: '사슬 휘두르기: 앞쪽 반원을 크게 휩쓸어 피해 + 앞으로 끌어옴', stats: { hp: 600, dps: 460, range: 250, speed: 0 } },
        leg: { name: '납 추 잠수화', look: '납덩이를 단 무거운 장화', desc: '심해 적응: 장판 피해 60% 감소, 장판 위 감속 무시', stats: { hp: 1100, dps: 50, range: 0, speed: 100 },
            passive: { name: '심해 적응', desc: '장판(늪·독 구름·오물) 피해 60% 감소, 장판 위 감속 무시', flags: ['ignoreHazard'], incoming: [{ when: 'zone', def: 0.6 }] } },
        skills: {
            dvLighthouse: { name: '심연의 등대', slot: 'head', ult: true, cd: 0, icon: 'surge', color: '#28dcbe', target: 'enemy', range: 420, clip: 'cast',
                desc: '8초간 등불 빛 — 빛 안 적은 받는 피해 +30%, 원거리 적은 빛을 향해 걸어 나옴',
                steps: [{ at: 0.4, do: 'zone', tag: 'light', x: 0, w: 420, sec: 8, vuln: 0.3, puff: V.pillar(-80, 180, { dur: 0.6 }), puffEvery: 0.4 },
                    { at: 0.4, do: 'custom', fn: lureRanged, repeat: 3, repeatGap: 2.5 }] },
            dvGhostFire: { name: '유령 불길', slot: 'body', cd: 14, icon: 'fire', color: '#28dcbe', target: 'self', clip: 'cast',
                desc: '5초간 몸 둘레 청록 유령 불길 — 지속 피해 + 안의 적 주는 피해 -30%',
                steps: [{ at: 0.3, do: 'zone', field: 'ghostFire', follow: true, x: -90, w: 260, sec: 5, dps: 0.5, status: { weak: [1, 0.3] }, every: 0.5 }] },
            dvChainSweep: { name: '사슬 휘두르기', slot: 'arm', cd: 9, icon: 'anchor', color: '#28dcbe', target: 'enemy', range: 240, clip: 'slam',
                desc: '앞쪽 반원을 크게 휩쓸어 피해 + 앞으로 끌어옴',
                steps: [{ at: 0.5, do: 'push', range: 240, dist: -60, dmg: 1.3 }, { at: 0.5, do: 'fx', x: 90, b: FOOT_B + 40, vfx: V.cleave(150, 200) }] }
        }
    },

    // ---- 유니크 ① 유령선 선장 (1차 계획) — 끌어오기·밀어내기의 끝 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '유령선 선장', style: 'balance', tint: 'hue-rotate(-40deg) saturate(1.3) brightness(0.95) drop-shadow(0 0 5px rgba(40, 220, 190, 0.7))',
        bonus: { 2: '적을 끌어오거나 밀어낼 때마다 필살기 게이지 +2%', 4: '유령선이 되돌아와 한 번 더 지나감' },
        kit: { 2: { on: [{ when: 'pushed', gauge: 0.02 }] }, 4: { patch: { dvGhostShip: { back: true } } } },
        head: { name: '선장 잠수 투구', look: '낡은 선장 모자를 얹은 황동 투구, 청록 유령 불빛', skill: 'dvGhostShip', desc: '필살기 유령선 돌격: 반투명 유령선이 화면을 가로지름 — 큰 피해 + 앞으로 밀어 모음 (거점에도)', stats: { hp: 900, dps: 130, range: 40, speed: 0 } },
        body: { name: '유령 선장 코트', look: '잠수복 위 낡은 선장 코트, 소매에서 유령 불길', skill: 'dvAnchorDrop', desc: '닻 내리기: 앞쪽에 큰 유령 닻 — 둘레 적을 모으고 2초 기절', stats: { hp: 2500, dps: 90, range: 0, speed: 0 } },
        arm: { name: '고래잡이 작살포', look: '팔에 얹은 큰 작살포, 감긴 밧줄', skill: 'dvChainHarpoon', desc: '기본 공격 작살 (관통) · 연쇄 작살: 작살 하나가 적 5명을 꿰어 한꺼번에 끌어옴', stats: { hp: 550, dps: 540, range: 330, speed: 0 },
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, vfx: V.beam(ABYSS, 6), hitVfx: V.water(160, 60, { dur: 0.3 }) } },
        leg: { name: '닻사슬 장화', look: '발목에 감긴 짧은 닻사슬', desc: '조류 지배: 끌어오기·밀어내기 거리 +50%, 끌리거나 밀린 적 1초 기절', stats: { hp: 1100, dps: 70, range: 0, speed: 100 },
            passive: { name: '조류 지배', desc: '밀어내기 거리 +50%, 끌리거나 밀린 적 1초 기절', mods: { pullMul: 0.5 }, pushedStun: 1 } },
        skills: {
            dvGhostShip: { name: '유령선 돌격', slot: 'head', ult: true, cd: 0, icon: 'anchor', color: '#28dcbe', target: 'enemy', range: 600, clip: 'slam', p: { back: false },
                desc: '반투명 유령선이 화면을 가로지름 — 지나간 적 큰 피해 + 앞으로 밀어 모음 (4부위: 되돌아옴)',
                steps: [{ at: 0.5, do: 'wave', from: -90, speed: 520, dist: 760, w: 80, dmg: 3, push: 55, knock: 1, back: '$back', vfx: V.sheet('ghost_ship', 300, { anchorY: 0.85, dur: 0.4 }), vfxEvery: 0.12, b: FOOT_B + 5 },
                    { at: 0.5, do: 'shake', power: 6, ms: 900 }] },
            dvAnchorDrop: { name: '닻 내리기', slot: 'body', cd: 15, icon: 'anchor', color: '#28dcbe', target: 'enemy', range: 300, clip: 'slam',
                desc: '앞쪽에 큰 유령 닻을 내리꽂음 — 둘레 적을 닻 쪽으로 모으고 2초 기절',
                steps: [{ at: 0.5, do: 'fx', x: 170, vfx: V.impact(150, 220) }, { at: 0.5, do: 'zone', tag: 'anchor', x: 70, w: 200, sec: 0.8, pull: 320 },
                    { at: 1.3, do: 'hit', pick: 'all', range: 300, dmg: 1.2, status: { stun: 2 }, vfx: V.water(160, 100) }, { at: 0.5, do: 'shake', power: 5, ms: 200 }] },
            dvChainHarpoon: { name: '연쇄 작살', slot: 'arm', cd: 9, icon: 'chain', color: '#28dcbe', target: 'enemy', range: 380, clip: 'thrust',
                desc: '작살 하나가 적 5명을 꿰어 한꺼번에 앞으로 끌어옴',
                steps: [{ at: 0.25, do: 'pull', pick: 'nearest', n: 5, range: 380, to: 30, sec: 0.35, dmg: 1.4, vfx: V.chainBolt(ABYSS) }] }
        }
    },

    // ---- 레어 ③ 산호 수호자 (탱커) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '산호 수호자', style: 'tank', tint: 'hue-rotate(150deg) saturate(1.5) brightness(1.15)',
        bonus: { 4: '산호 벽이 무너질 때 파편 폭발' },
        kit: { 4: { patch: { dvCoralReef: { endDmg: 2 } } } },
        head: { name: '산호 왕관 잠수모', look: '분홍·주황 산호가 자란 잠수모', skill: 'dvCoralReef', desc: '필살기 산호초 성벽: 앞쪽에 산호 벽 3개 8초 — 적 진격 막음, 닿은 적 가시 피해' },
        body: { name: '산호 갑주 잠수복', look: '산호 판 갑주 잠수복', skill: 'dvCoralRegen', desc: '산호 재생: 6초간 초당 2.5% 회복 + 받는 피해 -20%' },
        arm: { name: '산호 창', look: '산호 가시가 돋은 창', skill: 'dvCoralThrust', desc: '산호 가시 찌르기: 산호 가시 3줄기 — 2초 속박' },
        leg: { name: '산호 발판 장화', look: '산호 발판이 붙은 장화', desc: '군락: 멈춰 있는 동안 받는 피해 -20%',
            passive: { name: '군락', desc: '멈춰 싸우는 동안 받는 피해 -20%', self: [{ when: 'still', after: 0.5, mods: { def: 0.2 } }] } },
        skills: {
            dvCoralReef: { name: '산호초 성벽', slot: 'head', ult: true, cd: 0, icon: 'fort', color: '#ff8c96', target: 'self', clip: 'cast', p: { endDmg: 0 },
                desc: '앞쪽에 산호 벽 3개 8초 — 적 진격을 막고 닿은 적 가시 피해',
                steps: [{ at: 0.4, do: 'custom', fn: coralWalls, sec: 8, endDmg: '$endDmg' }, { at: 0.4, do: 'shake', power: 4, ms: 250 }] },
            dvCoralRegen: { name: '산호 재생', slot: 'body', cd: 14, icon: 'stitch', color: '#ff8c96', target: 'self', clip: 'cast',
                desc: '6초간 초당 2.5% 회복 + 받는 피해 -20%',
                steps: [{ do: 'buff', key: 'coralRegen', sec: 6, mods: { regen: 0.025, def: 0.2 }, vfx: V.motes(CORAL, 12) }] },
            dvCoralThrust: { name: '산호 가시 찌르기', slot: 'arm', cd: 8, icon: 'spikes', color: '#ff8c96', target: 'enemy', range: 220, clip: 'thrust',
                desc: '산호 가시 3줄기 — 앞 적 셋 피해 + 2초 속박',
                steps: [{ at: 0.25, do: 'hit', pick: 'nearest', n: 3, range: 220, dmg: 1.1, status: { root: 2 }, vfx: V.needle(-20, 110) }] }
        }
    },

    // ---- 레어 ④ 해파리 발광체 (균형) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '해파리 발광체', style: 'balance', tint: 'hue-rotate(100deg) saturate(1.4) brightness(1.2)',
        bonus: { 4: '해파리 12 → 18마리' },
        kit: { 4: { patch: { dvJellySwarm: { n: 6 } } } },
        head: { name: '해파리 갓 잠수모', look: '반투명 해파리 갓 잠수모', skill: 'dvJellySwarm', desc: '필살기 해파리 떼: 해파리 12마리가 떠다니며 닿은 적 감전 (0.5초 기절)' },
        body: { name: '촉수 망토 잠수복', look: '발광 촉수 망토', skill: 'dvFlash', desc: '발광 섬광: 앞 적 2초 눈부심 (주는 피해 -70%)' },
        arm: { name: '전기 촉수 팔', look: '전기가 흐르는 촉수 팔', skill: 'dvTentacleWhip', desc: '촉수 채찍: 3번 넓게 휘둘러 감전 (0.3초 기절)' },
        leg: { name: '떠다니는 촉수 다리', look: '떠다니는 해파리 촉수 다리', desc: '부유: 밀리지 않음, 장판 무시',
            passive: { name: '부유', desc: '밀리지 않음, 장판(늪·독 구름·오물) 무시', flags: ['knockImmune', 'ignoreHazard'] } },
        skills: {
            dvJellySwarm: { name: '해파리 떼', slot: 'head', ult: true, cd: 0, icon: 'surge', color: '#dc8cff', target: 'enemy', range: 450, clip: 'cast', p: { n: 12 },
                desc: '해파리 12마리가 떠다니며 닿은 적 감전 (0.5초 기절)',
                steps: [{ at: 0.4, do: 'rain', count: '$n', every: 0.6, radius: 55, dmg: 0.6, status: { stun: 0.5 }, vfx: V.sheet('jelly_glow', 140, { dur: 0.6 }), vfxB: FOOT_B + 80 }] },
            dvFlash: { name: '발광 섬광', slot: 'body', cd: 13, icon: 'surge', color: '#dc8cff', target: 'enemy', range: 260, clip: 'cast',
                desc: '눈부신 섬광 — 앞 적 2초 동안 주는 피해 -70%',
                steps: [{ at: 0.4, do: 'hit', pick: 'all', range: 260, dmg: 0.2, status: { weak: [2, 0.7] }, vfx: V.gold(240, 100, { dur: 0.3 }) }, { at: 0.4, do: 'fx', on: 'self', x: 80, b: 130, vfx: V.gold(240, 260, { dur: 0.35 }) }] },
            dvTentacleWhip: { name: '촉수 채찍', slot: 'arm', cd: 8, icon: 'whirl', color: '#dc8cff', target: 'enemy', range: 200, clip: 'slam',
                desc: '촉수를 3번 넓게 휘둘러 감전 (0.3초 기절)',
                steps: [{ at: 0.35, do: 'hit', pick: 'all', range: 200, times: 3, every: 0.25, dmg: 0.7, status: { stun: 0.3 }, vfx: V.bolt(80, 90, { dur: 0.3 }) }] }
        }
    },

    // ---- 유니크 ② 열수구 탐사대 (공격) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '열수구 탐사대', style: 'dps', tint: 'hue-rotate(170deg) saturate(1.8) brightness(1.05)',
        bonus: { 2: '증기 기둥 5 → 7곳', 4: '증기 장막 동안 받는 피해 -30%' },
        kit: { 2: { patch: { dvSteamVent: { n: 2 } } }, 4: { patch: { dvSteamVeil: { def: 0.3 } } } },
        head: { name: '열수 탐사 헬멧', look: '주황 열선이 달린 탐사 헬멧', skill: 'dvSteamVent', desc: '필살기 열수 분출: 앞쪽 5곳에서 증기 기둥 — 피해 + 1초 기절 + 화상' },
        body: { name: '내압 증기 잠수복', look: '증기 배출구가 달린 내압 잠수복', skill: 'dvSteamVeil', desc: '증기 장막: 6초간 원거리 피해 -60%, 둘레 적 초당 피해' },
        arm: { name: '증기 망치 팔', look: '증기 피스톤 망치 팔', skill: 'dvSteamHammer', desc: '증기 해머: 크게 내려쳐 앞쪽 충격파 + 화상 3초' },
        leg: { name: '열선 장화', look: '붉은 열선이 감긴 장화', desc: '열수 순환: 화상 입은 적에게 피해 +20%',
            passive: { name: '열수 순환', desc: '화상 입은 적에게 주는 피해 +20%', target: [{ when: 'status', status: 'burn', dmg: 0.2 }] } },
        skills: {
            dvSteamVent: { name: '열수 분출', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#ff9650', target: 'enemy', range: 480, clip: 'slam', p: { n: 5 },
                desc: '앞쪽 5곳에서 증기 기둥이 차례로 — 피해 + 1초 기절 + 화상',
                steps: [{ at: 0.5, do: 'rain', count: '$n', every: 0.22, x: [40, 470], aim: false, radius: 60, dmg: 1.5, status: { stun: 1, burn: [3, 0.3] }, vfx: V.sheet('steam_vent', 220, { anchorY: 0.92, dur: 0.6 }), shake: 2 }] },
            dvSteamVeil: { name: '증기 장막', slot: 'body', cd: 14, icon: 'shield', color: '#ff9650', target: 'self', clip: 'cast', p: { def: 0 },
                desc: '6초간 증기 장막 — 원거리 피해 -60%, 둘레 적 초당 피해',
                steps: [{ do: 'buff', key: 'steamVeil', sec: 6, mods: { rangedCut: 0.6, def: '$def' } },
                    { at: 0.3, do: 'zone', field: 'steam', follow: true, x: -90, w: 260, sec: 6, dps: 0.4 }] },
            dvSteamHammer: { name: '증기 해머', slot: 'arm', cd: 9, icon: 'hammer', color: '#ff9650', target: 'enemy', range: 260, clip: 'slam',
                desc: '크게 내려쳐 앞쪽으로 충격파 — 피해 + 화상 3초',
                steps: [{ at: 0.5, do: 'fx', x: 60, vfx: V.shock(50, 340) },
                    { at: 0.5, do: 'wave', from: 20, speed: 640, dist: 280, w: 50, dmg: 1.6, status: { burn: [3, 0.3] }, knock: 0.8, vfx: V.impact(10, 190, { dur: 0.4, softEdges: 0.13 }), vfxEvery: 0.14, b: FOOT_B },
                    { at: 0.5, do: 'shake', power: 5, ms: 200 }] }
        }
    },

    // ---- 유니크 ③ 고대 해신 기사 (사거리) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '고대 해신 기사', style: 'range', tint: 'sepia(0.5) saturate(1.6) hue-rotate(10deg) brightness(1.15)',
        bonus: { 2: '해신의 삼지창 범위 +30%', 4: '고대 방벽이 끝날 때 최대 체력 10% 회복' },
        kit: { 2: { patch: { dvTrident: { radius: 50 } } }, 4: { patch: { dvAncientWall: { heal: 0.1 } } } },
        head: { name: '고대 해신 투구', look: '금·청록 고대 해신 투구', skill: 'dvTrident', desc: '필살기 해신의 삼지창: 하늘에서 거대 삼지창 — 넓게 큰 피해 + 물결이 밀침 + 3초 감속' },
        body: { name: '고대 비늘 갑주', look: '금빛 고대 비늘 갑주', skill: 'dvAncientWall', desc: '고대 방벽: 5초간 물 보호막 (최대 체력 25%), 끝날 때 물 폭발' },
        arm: { name: '삼지창', look: '금빛 삼지창', skill: 'dvTripleThrust', desc: '삼연 찌르기: 3번 찔러 일직선 관통, 마지막에 물결' },
        leg: { name: '고대 장화', look: '금빛 고대 장화', desc: '조수의 가호: 체력 50% 아래면 초당 1.5% 회복',
            passive: { name: '조수의 가호', desc: '체력 50% 아래면 초당 1.5% 회복', self: [{ when: 'hpBelow', ratio: 0.5, mods: { regen: 0.015 } }] } },
        skills: {
            dvTrident: { name: '해신의 삼지창', slot: 'head', ult: true, cd: 0, icon: 'spikes', color: '#ffd76e', target: 'enemy', range: 450, clip: 'cast', p: { radius: 160 },
                desc: '하늘에서 거대 삼지창 — 넓게 큰 피해 + 물결이 밀침 + 3초 감속',
                steps: [{ at: 0.4, do: 'rain', count: 1, x: [200, 230], aim: false, jitter: 0, radius: '$radius', dmg: 4, status: { slow: 3 }, knock: 1.4, delay: 0.35, shake: 7, vfx: V.sheet('trident_gold', 340, { anchorY: 0.92, dur: 0.8 }) },
                    { at: 0.8, do: 'push', range: 420, dist: 70, dmg: 0 }] },
            dvAncientWall: { name: '고대 방벽', slot: 'body', cd: 15, icon: 'shield', color: '#ffd76e', target: 'self', clip: 'cast', p: { heal: 0 },
                desc: '5초간 물 보호막 (최대 체력 25%) — 끝날 때 물 폭발',
                steps: [{ do: 'shield', ratio: 0.25, sec: 5, color: WATER },
                    { do: 'buff', key: 'ancientWall', sec: 5, mods: { onEnd: { do: 'custom', fn: b => {
                        const h = b.kitPatch?.dvAncientWall?.heal || 0;
                        if (h) b.kitHeal(b.maxPlayerHp * h);
                        b.fx.play(V.water(0, 200), b.monsterX + 70, FOOT_B + 60);
                        b.enemiesInRange(160).forEach(e => b.dealDamageToEnemy(e, b.unit() * 1.2, false, { knock: 1 }));
                    } } }, vfx: V.water(0, 190, { dur: 0.8 }) }] },
            dvTripleThrust: { name: '삼연 찌르기', slot: 'arm', cd: 8, icon: 'sword', color: '#ffd76e', target: 'enemy', range: 340, clip: 'thrust',
                desc: '3번 찔러 일직선 관통 — 마지막에 물결이 밀침',
                steps: [{ at: 0.25, do: 'line', dmg: 0.9, decay: 0.9, knock: 0.3, vfx: V.beam(GOLD, 10), repeat: 3, repeatGap: 0.15 },
                    { at: 0.7, do: 'wave', from: 0, speed: 560, dist: 300, w: 45, dmg: 0.6, push: 35, vfx: V.water(160, 100, { dur: 0.3 }), vfxEvery: 0.06, b: FOOT_B + 30 }] }
        }
    },

    // ---- 레전더리 ① 리바이어던 (탱커) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '리바이어던', style: 'tank', tint: 'brightness(0.6) saturate(1.6) hue-rotate(-20deg) drop-shadow(0 0 7px rgba(40, 220, 190, 0.8))',
        bonus: { 2: '심해 압력장 범위 +40%', 4: '강림 뒤 10초간 받는 피해 -40%' },
        kit: { 2: { patch: { dvPressureField: { w: 160 } } }, 4: { on: [{ when: 'ult', delay: 1.5, buff: { key: 'leviathanGuard', sec: 10, mods: { def: 0.4 } } }] } },
        head: { name: '리바이어던 두개골 투구', look: '거대 바다뱀 두개골 투구', skill: 'dvLeviathan', desc: '필살기 리바이어던 강림: 거대 바다뱀이 솟아 화면을 가로지름 (거점 2배)' },
        body: { name: '고래뼈 갑주', look: '고래뼈와 검은 남색 비늘 갑주', skill: 'dvPressureField', desc: '심해 압력장: 8초간 넓은 압력장 — 적 느려짐·주는 피해 -30% + 초당 피해' },
        arm: { name: '이빨 닻', look: '거대 이빨 모양 닻', skill: 'dvWhirlAnchor', desc: '기본 공격 이빨 닻 던지기 (맞은 적 조금 끌어옴) · 소용돌이 닻: 3초간 둘레 적을 끌어모으며 여러 번 피해',
            kitAttack: { kind: 'shot', color: ABYSS, vfx: V.water(160, 80, { dur: 0.3 }), splash: 40, splashMul: 0.5,
                onHit: (b, e) => { if (isUnit(e) && !e.boss && !e.knockResist) { e.x -= 18; if (e.dom) e.dom.style.left = `${e.x}px`; b.kitPushed(e); } } } },
        leg: { name: '심해 군주 장화', look: '검은 비늘 군주 장화', desc: '심연의 주인: 끌려오거나 밀린 적은 2초간 받는 피해 +20%',
            passive: { name: '심연의 주인', desc: '끌려오거나 밀린 적은 2초간 받는 피해 +20%', pushedVuln: [2, 0.2] } },
        skills: {
            dvLeviathan: { name: '리바이어던 강림', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#28dcbe', target: 'enemy', range: 650, clip: 'slam', sfx: 'diver_surge',
                desc: '거대 바다뱀이 아래에서 솟아 화면을 가로지름 — 큰 피해 (거점 2배)',
                steps: [{ at: 0.5, do: 'wave', from: -100, speed: 480, dist: 800, w: 90, dmg: 3.5, baseMul: 2, knock: 1.2, vfx: V.sheet('leviathan', 340, { anchorY: 0.85, dur: 0.45 }), vfxEvery: 0.14, b: FOOT_B + 5 },
                    { at: 0.5, do: 'shake', power: 8, ms: 1400 }] },
            dvPressureField: { name: '심해 압력장', slot: 'body', cd: 15, icon: 'wave', color: '#28dcbe', target: 'self', clip: 'cast', p: { w: 400 },
                desc: '8초간 넓은 압력장 — 적 느려짐·주는 피해 -30% + 초당 피해',
                steps: [{ at: 0.4, do: 'custom', fn: pressureField, w: '$w', sec: 8, preview: pressureField.preview }] },
            dvWhirlAnchor: { name: '소용돌이 닻', slot: 'arm', cd: 9, icon: 'whirl', color: '#28dcbe', target: 'self', clip: 'anchor',
                desc: '닻을 돌려 3초간 둘레 적을 끌어모으며 여러 번 피해',
                steps: [{ at: 0.45, do: 'zone', field: 'water', follow: true, x: -60, w: 240, sec: 3, pull: 200, dps: 0.8 },
                    { at: 0.45, do: 'custom', fn: whirlAnchor, sec: 3, preview: whirlAnchor.preview }] }
        }
    },

    // ---- 레전더리 ② 별바다 항해사 (속도) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '별바다 항해사', style: 'speed', tint: 'hue-rotate(60deg) saturate(1.5) brightness(1.1) drop-shadow(0 0 7px rgba(200, 180, 255, 0.85))',
        bonus: { 2: '별똥 작살비 +4개', 4: '은하 해류 동안 스킬 쿨다운 2배 빨리' },
        kit: { 2: { patch: { dvStarHarpoons: { n: 4 } } }, 4: { on: [{ when: 'ult', buff: { key: 'currentCd', sec: 8, mods: { cdRate: 1 } } }] } },
        head: { name: '별빛 유리 헬멧', look: '은하가 비치는 유리 헬멧', skill: 'dvStarCurrent', desc: '필살기 은하 해류: 8초간 별빛 해류 — 적을 계속 밀며 매초 피해, 내 진격 속도 +30%' },
        body: { name: '항성 잠수복', look: '남보라 별빛 잠수복', skill: 'dvStarBubble', desc: '별빛 거품: 5초간 해로운 효과 무시 + 나·아군 받는 피해 -30%' },
        arm: { name: '유성 작살총', look: '별빛이 도는 작살총', skill: 'dvStarHarpoons', desc: '기본 공격 유성 작살 (관통, 작은 폭발) · 별똥 작살비: 작살 8개가 앞쪽에 떨어짐',
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, vfx: V.beam(STAR, 8), hitVfx: V.gold(220, 60, { dur: 0.3 }) } },
        leg: { name: '무중력 장화', look: '떠오르는 무중력 장화', desc: '무중력 유영: 밀림·기절 시간 -40%',
            passive: { name: '무중력 유영', desc: '감속·기절·속박 시간 -40%', mods: { ccCut: 0.4 } } },
        skills: {
            dvStarCurrent: { name: '은하 해류', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#c8b4ff', target: 'enemy', range: 520, clip: 'cast',
                desc: '8초간 별빛 해류 — 적을 계속 밀며 매초 피해, 내 진격 속도 +30%',
                steps: [{ at: 0.4, do: 'buff', key: 'starCurrent', sec: 8, mods: { move: 0.3 } },
                    { at: 0.4, do: 'custom', fn: galaxyFlow, sec: 8, preview: galaxyFlow.preview },
                    { at: 0.4, do: 'shake', power: 4, ms: 300, repeat: 8, repeatGap: 1 },
                    { at: 0.4, do: 'wave', from: 0, speed: 620, dist: 560, w: 70, dmg: 0.6, push: 30, ride: GALAXY_RIDE, rideEnd: GALAXY_END, hitVfx: GALAXY_HIT,
                        b: FOOT_B + 110, repeat: 8, repeatGap: 1 }] },
            dvStarBubble: { name: '별빛 거품', slot: 'body', cd: 14, icon: 'shield', color: '#c8b4ff', target: 'self', clip: 'cast',
                desc: '5초간 해로운 효과 무시 + 나·아군 받는 피해 -30%',
                steps: [{ do: 'cleanse' }, { do: 'buff', key: 'starBubble', sec: 5, mods: { flags: ['ccImmune'], def: 0.3, allyDef: 0.3 }, vfx: V.portal(200, 200, { dur: 0.7 }) },
                    { do: 'custom', fn: starBubble, sec: 5, preview: starBubble.preview }] },
            dvStarHarpoons: { name: '별똥 작살비', slot: 'arm', cd: 9, icon: 'rocket', color: '#c8b4ff', target: 'enemy', range: 400, clip: 'cast', p: { n: 8 },
                desc: '작살 8개가 하늘로 쏘아져 앞쪽에 떨어짐',
                steps: [{ at: 0.38, do: 'custom', fn: harpoonsUp, preview: harpoonsUp.preview },
                    { at: 0.42, do: 'rain', count: '$n', every: 0.1, radius: 50, dmg: 0.8, vfx: HARPOON_HIT, fall: HARPOON_FALL(0.4), fallDx: -90, fallTo: 6, delay: 0.4 }] }
        }
    }
]);
