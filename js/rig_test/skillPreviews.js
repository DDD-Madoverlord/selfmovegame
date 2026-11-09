/* ==========================================================================
   PROJECT: MAD OVERLORD // RIG TEST — 스킬 미리보기 (캐릭터 · 스킬 탭의 ▶)
   키 = skills_v2.js의 스킬 키 (PART_SKILL 값), 다리 패시브는 파츠 id (LEG_PASSIVES 키)
   값 = (api) => { ... } — api는 main.js의 previewApi:
     api.at(정의, 적 번호 0~2, 바닥?) · api.atEach(정의, 바닥?) · api.atSelf(정의) · api.seq(a, b, 지연)
     api.muzzle() 무기 끝 · api.socket(소켓, 뼈) · api.selfChest() · api.enemyChestY() · api.dummies[i].x
     api.playClip(클립, onCast) 동작 + cast 순간 콜백 · api.later(초, fn) · api.hit(적 번호, 감속초) · api.shake(세기, 초)
     api.vfx (VfxPlayer: play·launchOrb·launchMissile·launchWave·launchChain·launchNeedle·setPersistent) · api.VFX_SCALE
     api.previews.* 예전 미리보기 (laser·missiles·jet·anchor·surge·needles(n)·frostWave(h, range, hits)·puppet·
       mindWave·launchWave·toggleCurse·toggleWave·toggleSeal·toggleBlizzard·shield·breakShield·phase2)
   게임과 같은 이펙트 정의(js/engine_v2/vfx/)를 쓰고, 동작은 전투 로직(skills_v2.js·battle/)을 따라 흉내 낸다.
   ========================================================================== */

import { MECH_VFX, KAIJU_VFX, CHIMERA_VFX, DIVER_VFX, SAINT_VFX, FROST_VFX, DOLL_VFX } from '../engine_v2/vfx/vfxDefs.js';
import { SET_VFX } from '../engine_v2/vfx/setVfx.js';
import { LEG, SET, SAINT, FOOT_B } from '../engine_v2/battle/tuning.js';
import { SKILLS } from '../engine_v2/skills_v2.js';
import { imageField, breathImage } from '../engine_v2/vfx/imageEffects.js';

// 전투에 별도 이펙트가 없는 수치 패시브: 발밑에 작은 팩션 색 고리와 빛가루만.
const passiveMark = color => ({ layers: [
    { type: 'ring', at: 0, dur: 0.65, r: 32, ground: true, color, width: 2 },
    { type: 'motes', at: 0, count: 6, spread: 24, rise: [15, 35], life: [0.4, 0.7], size: 2, color }
] });
const PASSIVE_VFX = {
    mech: passiveMark('62, 230, 255'), hero: passiveMark('200, 110, 255'),
    chimera: passiveMark('255, 150, 40'), diver: passiveMark('40, 220, 190'),
    frost: passiveMark('127, 212, 255'), doll: passiveMark('90, 230, 240')
};

function repeat(api, n, gap, fn, start = 0) {
    for (let i = 0; i < n; i++) api.later(start + i * gap, () => fn(i));
}

// cast 이벤트가 없는 구형 공격·포효 클립은 전투의 schedule 시각에 발동한다.
function playAt(api, clip, sec, onCast) {
    let fired = false;
    const release = () => { if (!fired) { fired = true; onCast(); } };
    api.playClip(clip, release);
    api.later(sec, release);
}

function tickTargets(api, def, sec, ground = false, slow = 0) {
    repeat(api, Math.floor(sec / 0.5), 0.5, () => api.dummies.forEach((d, i) => {
        api.at(def, i, ground);
        api.hit(i, slow);
    }), 0.5);
}

// 구역은 유한한 퍼프로 보여 주어 다른 스킬을 누른 뒤에도 장판이 남지 않게 한다.
function zone(api, def, sec, every, slow = 0, scale = 1, targets = api.dummies) {
    repeat(api, Math.ceil(sec / every), every, k => {
        const d = targets[k % targets.length];
        api.vfx.play(def, d.x, api.GROUND_Y - 10 * api.VFX_SCALE, { scale: api.VFX_SCALE * scale });
        targets.forEach(t => api.hit(api.dummies.indexOf(t), slow));
    });
}

// 무대의 캐릭터 기준점은 고정: 전투의 8단계 돌진 궤적을 적 쪽으로 펼쳐 충돌을 보여 준다.
function dash(api, trail, impact, sec, stun) {
    const start = api.CHAR_X + 10 * api.VFX_SCALE;
    const end = api.dummies[2].x;
    const hit = new Set();
    repeat(api, 8, sec / 8, k => {
        const x = start + (end - start) * (k + 1) / 8;
        api.vfx.play(trail, x, api.GROUND_Y - 30 * api.VFX_SCALE, { scale: api.VFX_SCALE });
        api.dummies.forEach((d, i) => {
            if (d.x > x || hit.has(i)) return;
            hit.add(i);
            api.at(impact, i);
            api.hit(i, stun);
        });
    }, sec / 8);
}

const allyX = (api, i) => api.CHAR_X + (88 + i * 35) * api.VFX_SCALE * 0.56;

// ---- 2차 세트 스킬 (skillKit_v2.js 단계 데이터): 손으로 짠 미리보기가 없으면 단계를 읽어 무대에서 흉내 (11-05 피드백 11번 — 게임 연구소 미리보기) ----
// 전투 좌표 → 무대: 가로 px는 거의 1:1(k = VFX_SCALE × 0.56, 적 자리와 같은 비율), 세로는 발 기준(FOOT_B) 높이를 GROUND_Y 위로
const rgbOf = hex => (/^#?([0-9a-f]{6})$/i.test(hex || '') ? [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16)).join(', ') : '62, 230, 255');
const valOf = (sk, v, d) => (typeof v === 'string' && v.startsWith('$') ? Number(sk.p?.[v.slice(1)]) || d : Number(v) || d);

export function kitPreview(key, slot) {
    const sk = SKILLS[key];
    if (!sk || !Array.isArray(sk.steps)) return null;
    return api => {
        const k = api.VFX_SCALE * 0.56;
        const front = api.CHAR_X + 100 * k;
        const yOf = b => api.GROUND_Y - ((b ?? FOOT_B) - FOOT_B) * k;
        const chestY = api.enemyChestY();
        const far = api.dummies[api.dummies.length - 1].x;
        const aura = passiveMark(rgbOf(sk.color));   // 이펙트가 없는 단계(버프·실드·회복…)는 스킬 색 고리
        const play = (def, x, y, o = {}) => { if (def) api.vfx.play(def, x, y, { scale: api.VFX_SCALE * (o.scale || 1), ...(o.to ? { to: o.to } : {}) }); };
        const field = (s, origin = front) => {
            const sec = valOf(sk, s.sec, 5), w = s.w || 170;
            play(imageField(s.field, w * 0.56, sec), origin + ((s.x || 0) + w / 2) * k, api.GROUND_Y);
            if (s.puff) repeat(api, Math.ceil(sec / (s.puffEvery || 0.35)), s.puffEvery || 0.35, () =>
                play(s.puff, origin + ((s.x || 0) + Math.random() * w) * k, yOf(FOOT_B + (s.puffB ?? 8)), s));
        };
        const run = s => {
            const v = s.vfx;
            switch (s.do) {
                case 'fx': play(v, (s.on === 'self' ? api.CHAR_X : front) + (s.x || 0) * k, yOf(s.b), s); break;
                case 'hit':
                    for (let t = 0; t < Math.min(6, s.times || 1); t++) api.later(t * (s.every ?? 0.12), () => api.dummies.slice(0, s.n || 1).forEach((d, i) => {
                        play(v, d.x, s.ground ? api.GROUND_Y : chestY); api.hit(i);
                    }));
                    break;
                case 'screen':
                    if (s.field) play(imageField(s.field, (far - api.dummies[0].x) / api.VFX_SCALE + 112, s.fieldSec || 0.65),
                        (far + api.dummies[0].x) / 2, api.GROUND_Y);
                    api.dummies.forEach((d, i) => { play(v, d.x, s.ground ? api.GROUND_Y : chestY); api.hit(i); });
                    break;
                case 'line': {
                    const m = s.from === 'mouth' ? api.socket('mouth', 'head') : api.muzzle();
                    play(v, m[0], m[1], { to: [far + 60, chestY] });
                    api.dummies.forEach((d, i) => api.later(i * 0.05, () => api.hit(i)));
                    break;
                }
                case 'rain': {
                    const n = Math.max(1, Math.min(12, Math.round(valOf(sk, s.count, 6))));
                    for (let i = 0; i < n; i++) api.later(i * (s.every ?? 0.15), () => {
                        const d = api.dummies[i % api.dummies.length];
                        play(v, d.x + (Math.random() - 0.5) * 60, s.vfxB != null ? yOf(s.vfxB) : api.GROUND_Y, s);
                        api.later(s.delay ?? 0, () => api.hit(i % api.dummies.length));
                        if (s.zone?.field) api.later(s.delay ?? 0, () => field(s.zone, d.x - (s.zone.w || 80) * k / 2));
                    });
                    break;
                }
                case 'wave':
                    for (let i = 0; i < 5; i++) api.later(i * 0.12, () => play(v || s.trail, front + i * (far - front) / 4, api.GROUND_Y - 30 * k, s));
                    api.dummies.forEach((d, i) => api.later(0.2 + i * 0.12, () => api.hit(i)));
                    break;
                case 'chain': {
                    let from = api.muzzle();
                    api.dummies.slice(0, Math.round(valOf(sk, s.n, 3))).forEach((d, i) => {
                        const a = from;
                        api.later(i * (s.gap ?? 0.08), () => { play(v, a[0], a[1], { to: [d.x, chestY] }); api.hit(i); });
                        from = [d.x, chestY];
                    });
                    break;
                }
                case 'zone':
                    if (s.field) { field(s); api.dummies.forEach((_, i) => api.hit(i, 0.4)); break; }
                    if (s.art?.sheet) {
                        const x = front + ((s.x || 0) + (s.w || 0) / 2) * k, sec = valOf(sk, s.sec, 5);
                        play({ layers: [{ type: 'sprite', sheet: s.art.sheet, width: s.art.w * 0.56, height: s.art.h * 0.56,
                            anchorY: 1, blend: 'normal', dur: sec, fadeIn: 0.2, fadeOut: 0.15 }] }, x, api.GROUND_Y);
                        if (s.end?.vfx) api.later(sec, () => play(s.end.vfx, x, api.GROUND_Y));
                        break;
                    }
                    for (let t = 0; t < 4; t++) api.later(t * 0.45, () => {
                        play(v || s.tickVfx, api.dummies[1].x, api.GROUND_Y - 10 * k, s);
                        api.dummies.forEach((_, i) => api.hit(i, 0.4));
                    });
                    break;
                case 'pull': case 'push': api.dummies.forEach((d, i) => { play(v, d.x, chestY); api.hit(i); }); break;
                case 'dash': case 'blink':
                    for (let i = 0; i < 6; i++) api.later(i * 0.05, () => play(v || s.trail, api.CHAR_X + i * (far - api.CHAR_X) / 5, api.GROUND_Y - 40 * k));
                    if (s.leave?.field) field(s.leave, api.CHAR_X + 20 * k);
                    break;
                case 'summon': for (let i = 0; i < Math.min(3, Math.round(valOf(sk, s.n, 1))); i++) play(v || aura, api.CHAR_X + (70 + i * 24) * k, api.GROUND_Y); break;
                case 'shake': api.shake(Math.min(10, s.power ?? 6), (s.ms ?? 250) / 1000); break;
                case 'custom': play(v, api.dummies[0].x, chestY); break;
                default: play(v || aura, api.CHAR_X, api.GROUND_Y);   // buff · shield · heal · cleanse · transform · gauge
            }
        };
        const start = () => sk.steps.forEach(s => {
            for (let r = 0; r < Math.min(4, valOf(sk, s.repeat, 1)); r++)
                api.later((s.at || 0) + r * valOf(sk, s.repeatGap, 1), () => run(s));
        });
        api.playClip(sk.clip || (slot === 'head' ? 'ult' : 'attack'), start);   // 동작이 없으면 바로 (previewApi.playClip)
    };
}

/** 2차 세트 다리 패시브: 발밑 팩션 색 고리 세 번 */
export function kitPassivePreview(char) {
    const def = PASSIVE_VFX[char] || passiveMark('62, 230, 255');
    return api => [0, 0.5, 1].forEach(t => api.later(t, () => api.atSelf(def)));
}

export const SKILL_PREVIEWS = {
    // ---- 거대로봇 ----
    rush: api => api.playClip('attack', () => [0, 0.18, 0.36].forEach(t => api.later(t, () => api.at(MECH_VFX.fistHit, 0)))),
    pierceLaser: api => api.previews.laser(),
    missileSalvo: api => api.previews.missiles(),
    reflectShield: api => api.previews.shield(),
    droneSwarm: api => [0, 1, 2].forEach(i => api.later(0.15 * i, () => api.at(MECH_VFX.droneBlast, i))),
    // ---- 거대괴수 ----
    layEggs: api => api.at(api.seq(KAIJU_VFX.eggLay, KAIJU_VFX.eggHatch, 1.2), 1, true),
    // ---- 타락 히어로 ----
    tripleWave: api => api.previews.toggleWave(),
    curseBurst: api => api.previews.toggleCurse(),
    massMind: api => api.previews.mindWave(),
    // ---- 합성괴인 ----
    frenzyClaw: api => [0, 0.15, 0.3].forEach(t => api.later(t, () => api.at(CHIMERA_VFX.clawHit, 0))),
    callMinions: api => api.at(CHIMERA_VFX.summon, 1, true),
    rampage: api => api.previews.phase2(),
    leg_chimera: api => api.atEach(CHIMERA_VFX.quakeTick),
    // ---- 심연의 길잡이 ----
    anchorPull: api => api.previews.anchor(),
    pressureSurge: api => api.previews.surge(),
    abyssHands: api => { api.atSelf(DIVER_VFX.abyssCall); api.atEach(DIVER_VFX.hands); },
    // ---- 봉합 성녀 ----
    needleTriple: api => api.playClip('triple', () => api.previews.needles(3)),
    lifeSeal: api => {
        api.previews.toggleSeal();
        api.vfx.play(imageField('seal', SAINT.sealZone[1] - SAINT.sealZone[0], SAINT.sealSec),
            api.CHAR_X + 150 * api.VFX_SCALE, api.GROUND_Y, { scale: api.VFX_SCALE });
    },
    forcedRevive: api => { api.atSelf(SAINT_VFX.reviveCall); api.at(api.seq(SAINT_VFX.corpseStitch, SAINT_VFX.corpseRise, 0.9), 1, true); },
    // ---- 서리의 무희 ----
    crescentSlash: api => api.playClip('crescent', () => api.previews.frostWave(130, 520, 9)),
    blizzardDance: api => api.previews.toggleBlizzard(),
    eternalRest: api => { api.atSelf(FROST_VFX.eternalCall); api.atEach(api.seq(FROST_VFX.encase, FROST_VFX.shatter, 2.4)); },
    // ---- 뒤틀린 인형사 ----
    scissorX: api => api.playClip('xcut', () => api.at(DOLL_VFX.xcut, 0)),
    dollFamily: api => api.dummies.forEach((d, i) => api.later(0.12 * i, () => api.vfx.play(DOLL_VFX.dollDrop, d.x, api.GROUND_Y,
        { scale: api.VFX_SCALE, to: [d.x, api.GROUND_Y - 300 * api.VFX_SCALE * 0.56] }))),
    puppetStrings: api => api.previews.puppet(),

    // ---- 거대로봇 추가 ----
    // 충전 레일 사격: 총구에서 1초 충전 뒤 관통 광선, 앞의 적부터 스파크.
    chargedRail: api => playAt(api, 'attack_cannon', 0, () => {
        const m = api.muzzle();
        api.vfx.play(SET_VFX.railCharge, m[0], m[1], { scale: api.VFX_SCALE, follow: () => api.muzzle() });
        api.later(1, () => {
            const from = api.muzzle();
            api.vfx.play(SET_VFX.railBig, from[0], from[1],
                { scale: api.VFX_SCALE, to: [api.dummies[2].x + 100, from[1] + 10 * api.VFX_SCALE] });
            api.dummies.forEach((d, i) => api.later(i * 0.03, () => { api.at(SET_VFX.railHit, i); api.hit(i); }));
        });
    }),
    // 파일 벙커 관통: 한 적에게 말뚝 광선과 충격 고리, 1.5초 기절.
    pileBunker: api => playAt(api, 'attack_fist', 0.3, () => {
        const x = api.dummies[0].x, y = api.enemyChestY();
        api.vfx.play(SET_VFX.pileHit, x, y, { scale: api.VFX_SCALE, to: [x + 60 * api.VFX_SCALE, y] });
        api.hit(0, 1.5);
        api.shake(6, 0.22);
    }),
    // 자동 포탑 전개: 어깨 포탑 점등 뒤 8초간 0.3초마다 가장 가까운 적에게 광선.
    autoTurret: api => {
        const p = api.socket('droneBay', 'canister');
        api.vfx.play(SET_VFX.turretOn, p[0], p[1], { scale: api.VFX_SCALE });
        repeat(api, Math.ceil(SET.turret.sec / SET.turret.every), SET.turret.every, () => {
            const from = api.socket('droneBay', 'canister');
            api.vfx.play(SET_VFX.turretShot, from[0], from[1],
                { scale: api.VFX_SCALE, to: [api.dummies[0].x, api.enemyChestY()] });
            api.hit(0);
        });
    },
    // 로켓 돌진: 0.3초 추진 궤적을 따라 충돌 충격파, 맞은 적은 0.4초 기절.
    rocketDash: api => playAt(api, 'attack_cannon', 0, () => dash(api, SET_VFX.rocketTrail, SET_VFX.rocketHit, 0.3, 0.4)),
    // 궤도 폭격: 앞쪽 5곳에 예고 원 뒤 0.4초 후 위성 레이저가 차례로.
    orbitalStrike: api => playAt(api, 'attack_cannon', 0, () => {
        const x0 = api.dummies[0].x - 60;
        const gap = (Math.max(api.dummies[2].x, api.dummies[0].x + 90) + 30 - x0) / 4;
        repeat(api, 5, 0.22, i => {
            const x = x0 + i * gap;
            api.vfx.play(SET_VFX.orbitalWarn, x, api.GROUND_Y, { scale: api.VFX_SCALE });
            api.later(0.4, () => {
                api.vfx.play(SET_VFX.orbitalHit, x, api.GROUND_Y, { scale: api.VFX_SCALE });
                api.shake(5, 0.22);
                api.dummies.forEach((d, j) => { if (Math.abs(d.x - x) < 75 * api.VFX_SCALE) api.hit(j); });
            });
        });
    }),
    // 오버드라이브: 발동 섬광 뒤 6초간 0.4초마다 몸에서 보라 증기.
    overdrive: api => {
        api.atSelf(SET_VFX.overdrive);
        repeat(api, Math.ceil(SET.overdrive.sec / 0.4), 0.4, () => api.atSelf(SET_VFX.overdriveTick));
    },
    // 유압 서스펜션: 진격 속도 능력치를 청록 발밑 고리와 빛가루로 표시.
    leg_red_robot: api => api.atSelf(PASSIVE_VFX.mech),
    // 궤도 돌진: 적과 접촉할 때 주먹 충돌 이펙트와 짧은 기절.
    leg_mech_wheel: api => api.playClip('walk', () => {
        api.vfx.play(MECH_VFX.fistHit, api.dummies[0].x - 10 * api.VFX_SCALE,
            api.enemyChestY() + 20 * api.VFX_SCALE, { scale: api.VFX_SCALE });
        api.hit(0, LEG.ramStun);
    }),
    // 포격 고정: 멈춰 공격할 때 발밑 청록 앵커 균열과 먼지.
    leg_mech_a: api => api.playClip('attack_cannon', () => {
        api.atSelf(SET_VFX.anchor);
        api.later(1.2, () => api.atSelf(SET_VFX.anchor));
    }),
    // 자기장 방벽: 원거리 공격을 받을 때 몸 앞에 청록 방벽 섬광.
    leg_mech_b: api => {
        const p = api.selfChest();
        api.vfx.play(SET_VFX.magField, p[0], p[1], { scale: api.VFX_SCALE });
    },

    // ---- 거대괴수 추가 ----
    // 산성 돌진: 물기 동작에 맞춰 적 발밑 산성 폭발, 주변 적에게 4초 부식.
    acidCharge: api => playAt(api, 'attack_bite', 0.35, () => {
        api.at(KAIJU_VFX.acidCharge, 0, true);
        api.dummies.forEach((d, i) => api.hit(i));
        tickTargets(api, KAIJU_VFX.acidTick, 4);
    }),
    // 지면 내려찍기: 앞쪽 바닥 균열과 흙먼지 충격파, 0.8초 기절.
    groundSlam: api => playAt(api, 'attack_bite', 0.4, () => {
        api.at(SET_VFX.groundSlam, 0, true);
        api.dummies.forEach((d, i) => api.hit(i, 0.8));
        api.shake(7, 0.26);
    }),
    // 산성 침 3연발: 0.18초 간격 포물선 방울, 착탄 뒤 2.5초 독 웅덩이.
    acidSpit3: api => playAt(api, 'attack_bite', 0.15, () => repeat(api, 3, 0.18, i => {
        const d = api.dummies[i];
        api.vfx.launchOrb({ from: api.muzzle(), to: () => [d.x, api.enemyChestY()],
            color: '160, 255, 50', dur: 0.45, scale: api.VFX_SCALE,
            onArrive: () => {
                api.at(SET_VFX.spitSplash, i, true);
                api.hit(i);
                api.vfx.play(imageField('acid', SET.spit.puddleW, SET.spit.puddleSec), d.x, api.GROUND_Y, { scale: api.VFX_SCALE });
            } });
    })),
    // 가시 갑옷: 몸의 가시 발동 뒤 공격자를 찌르는 반사 스파크.
    thornArmor: api => {
        api.atSelf(SET_VFX.thornOn);
        api.later(0.7, () => { api.at(SET_VFX.thornReflect, 0); api.hit(0); });
    },
    // 독 포자 폭발: 몸 둘레 독주머니 폭발 뒤 적들에게 4초 부식 틱.
    sporeBurst: api => {
        api.atSelf(SET_VFX.sporeBurst);
        api.dummies.forEach((d, i) => api.hit(i));
        tickTargets(api, KAIJU_VFX.acidTick, 4);
    },
    // 대지 포효: 포효 동작에 산성 충격파와 균열, 적들은 2초 기절.
    earthRoar: api => playAt(api, 'victory', 0.4, () => {
        api.atSelf(KAIJU_VFX.roarBurst);
        api.dummies.forEach((d, i) => api.hit(i, 2));
    }),
    // 가시 폭풍: 포효하며 뼈 가시를 사방으로 쏘고 4초간 출혈 방울.
    spikeStorm: api => playAt(api, 'victory', 0.35, () => {
        api.atSelf(SET_VFX.spikeStorm);
        api.dummies.forEach((d, i) => api.hit(i));
        tickTargets(api, SET_VFX.bleedTick, 4);
    }),
    // 독안개 숨결: 포효 뒤 앞쪽 독 구름, 6초간 0.18초 간격 퍼프와 감속.
    toxicBreath: api => playAt(api, 'victory', 0.35, () => {
        api.at(SET_VFX.toxicBreath, 1, true);
        api.vfx.play(imageField('poison', 300, 6), api.dummies[1].x, api.GROUND_Y, { scale: api.VFX_SCALE });
    }),
    // 독성 점액: 전방 적 발밑에 0.75초 간격 포자 구름과 감속.
    leg_mutant: api => repeat(api, 4, 0.75, () => {
        api.atEach(KAIJU_VFX.sporeTick, true);
        api.dummies.forEach((d, i) => api.hit(i, 0.8));
    }),
    // 단단한 껍질: 맞을 때 몸 앞에서 초록 껍질 조각이 튐.
    leg_kaiju_a: api => {
        const p = api.selfChest();
        api.vfx.play(SET_VFX.shellChip, p[0], p[1], { scale: api.VFX_SCALE });
    },
    // 질주 본능: 진격 동작 뒤로 0.15초마다 초록 잔상과 먼지.
    leg_kaiju_b: api => api.playClip('walk', () => repeat(api, 8, 0.15, () =>
        api.vfx.play(SET_VFX.sprintTrail, api.CHAR_X - 10 * api.VFX_SCALE, api.GROUND_Y, { scale: api.VFX_SCALE }))),

    // ---- 타락 히어로 추가 ----
    // 회전 베기: 제자리에서 0.2초 간격 세 번 보라 원형 칼자국.
    whirlwind: api => playAt(api, 'attack_slash', 0.1, () => repeat(api, 3, 0.2, () => {
        const p = api.selfChest();
        api.vfx.play(SET_VFX.whirl, p[0], p[1], { scale: api.VFX_SCALE });
        api.dummies.forEach((d, i) => api.hit(i));
    })),
    // 블랙홀: 시전 뒤 적들 사이에 3초 소용돌이, 끝나면 보라 폭발.
    blackHole: api => playAt(api, 'cast', 0, () => {
        const x = api.dummies[0].x + 50 * api.VFX_SCALE, y = api.enemyChestY();
        repeat(api, Math.ceil(SET.blackHole.sec / 0.5), 0.5, () => {
            api.vfx.play(SET_VFX.blackHole, x, y, { scale: api.VFX_SCALE });
            api.dummies.forEach((d, i) => { if (Math.abs(d.x - x) <= SET.blackHole.radius * api.VFX_SCALE) api.hit(i, 0.5); });
        });
        api.later(SET.blackHole.sec, () => api.vfx.play(SET_VFX.blackHoleEnd, x, y, { scale: api.VFX_SCALE }));
    }),
    // 피의 서약: 몸 둘레 붉은 기운 뒤 흡혈 회복 빛가루.
    bloodOath: api => {
        api.atSelf(SET_VFX.bloodOn);
        api.later(0.5, () => {
            const p = api.selfChest();
            api.vfx.play(SET_VFX.bloodDrain, p[0], p[1], { scale: api.VFX_SCALE });
        });
    },
    // 저주의 사슬: 세 적을 0.1초 간격으로 속박하고 4초간 저주 틱.
    curseChains: api => api.playClip('cast', () => api.dummies.forEach((d, i) => api.later(i * 0.1, () => {
        api.at(SET_VFX.chainBind, i, true);
        api.hit(i, 4);
        repeat(api, 8, 0.5, () => { api.at(SET_VFX.chainTick, i); api.hit(i); }, 0.5);
    }))),
    // 심판의 일격: 시전 후 예고 마법진, 0.5초 뒤 거대 검과 충격파·2초 기절.
    judgmentBlade: api => api.playClip('cast', () => {
        const x = api.dummies[0].x + 30 * api.VFX_SCALE;
        api.vfx.play(SET_VFX.judgmentWarn, x, api.GROUND_Y, { scale: api.VFX_SCALE });
        api.later(0.5, () => {
            api.vfx.play(SET_VFX.judgmentHit, x, api.GROUND_Y, { scale: api.VFX_SCALE });
            api.shake(10, 0.4);
            api.dummies.forEach((d, i) => { if (Math.abs(d.x - x) <= 130 * api.VFX_SCALE) api.hit(i, 2); });
        });
    }),
    // 그림자 분신: 뒤쪽 두 자리에서 출현 연기, 6초간 암흑 구체 추가 사격 뒤 소멸 연기.
    shadowClones: api => api.playClip('cast', () => {
        for (let i = 1; i <= SET.clones.count; i++) {
            const x = api.CHAR_X - SET.clones.gap * i * api.VFX_SCALE;
            api.vfx.play(SET_VFX.clonePoof, x, api.GROUND_Y, { scale: api.VFX_SCALE });
            repeat(api, 6, 0.9, () => {
                const m = api.muzzle();
                api.vfx.launchOrb({ from: [m[0] - SET.clones.gap * i * api.VFX_SCALE, m[1]],
                    to: () => [api.dummies[0].x, api.enemyChestY()], color: '200, 110, 255', dur: 0.4, scale: api.VFX_SCALE,
                    onArrive: () => { api.at(SET_VFX.orbBlast, 0); api.hit(0); } });
            }, 0.06 * i);
            api.later(SET.clones.sec, () => api.vfx.play(SET_VFX.clonePoof, x, api.GROUND_Y, { scale: api.VFX_SCALE }));
        }
    }),
    // 반중력 부양: 피해 감소·감속 무효를 보라 발밑 고리와 빛가루로 표시.
    leg_hero_hover: api => api.atSelf(PASSIVE_VFX.hero),
    // 불굴: 내구도가 낮을 때 몸을 감싸는 보라 방패 빛을 1초마다.
    leg_hero_a: api => repeat(api, 3, 1, () => api.atSelf(SET_VFX.indomitable)),
    // 그림자 회피: 공격을 피하며 몸 둘레에 흐려지는 보라 연기.
    leg_hero_b: api => api.atSelf(SET_VFX.dodge),

    // ---- 합성괴인 추가 ----
    // 대지 강타: 주먹 동작에 앞쪽 큰 균열·바위 파편과 화면 흔들림.
    earthSmash: api => playAt(api, 'attack_punch', 0.4, () => {
        api.at(SET_VFX.earthSmash, 0, true);
        api.dummies.forEach((d, i) => api.hit(i));
        api.shake(8, 0.3);
    }),
    // 화염 방사: 공격 동작 뒤 3초간 0.12초 간격 총구 불길과 0.14초 간격 불바닥.
    flamethrower: api => playAt(api, 'attack_punch', 0, () => {
        const m = api.muzzle();
        api.vfx.play(breathImage('breath_fire', 380, 3), m[0], m[1], { scale: api.VFX_SCALE, follow: () => api.muzzle() });
        api.vfx.play(imageField('fire', 330, 3), api.dummies[1].x, api.GROUND_Y, { scale: api.VFX_SCALE });
    }),
    // 아드레날린 주입: 몸 둘레 주황 고리·증기·빛가루로 공격력 강화.
    adrenaline: api => api.atSelf(SET_VFX.adrenaline),
    // 강화 주사: 적이 아닌 앞쪽 아군 졸개 자리마다 초록 회복 빛.
    boostShot: api => [0, 1, 2].forEach(i =>
        api.vfx.play(SET_VFX.boostShot, allyX(api, i), api.GROUND_Y, { scale: api.VFX_SCALE })),
    // 광견 돌진: 0.35초 흙먼지 궤적 뒤 지나간 적에게 주황 충돌과 1.5초 기절.
    maulCharge: api => playAt(api, 'attack_punch', 0, () => dash(api, SET_VFX.maulTrail, SET_VFX.maulHit, 0.35, 1.5)),
    // 총동원령: 큰 소환진 뒤 0.12초 간격 네 아군 자리에서 졸개 소환진.
    mobilize: api => {
        api.vfx.play(SET_VFX.mobilize, api.CHAR_X + 90 * api.VFX_SCALE, api.GROUND_Y, { scale: api.VFX_SCALE });
        repeat(api, SET.mobilize.count, 0.12, i =>
            api.vfx.play(CHIMERA_VFX.summon, allyX(api, i), api.GROUND_Y, { scale: api.VFX_SCALE }));
    },
    // 용의 숨결: 포효 중 입에서 1.6초 불길, 첫 타격 후 4초 불바다.
    dragonBreath: api => playAt(api, 'victory', 0.4, () => {
        const m = api.socket('mouth', 'head');
        api.vfx.play(breathImage('breath_fire', SET.dragonBreath.width + 100, SET.dragonBreath.breathSec),
            m[0], m[1], { scale: api.VFX_SCALE, follow: () => api.socket('mouth', 'head') });
        api.later(0.1, () => {
            api.shake(5, 0.22);
            api.dummies.forEach((d, i) => api.hit(i));
            api.vfx.play(imageField('fire', SET.dragonBreath.width, SET.dragonBreath.zoneSec),
                api.dummies[1].x, api.GROUND_Y, { scale: api.VFX_SCALE });
        });
    }),
    // 짓밟기: 걷기 클립의 두 착지 시각에 발밑 주황 충격파와 앞쪽 피해.
    leg_chimera_a: api => {
        api.playClip('walk');
        [0.42, 0.97].forEach(t => api.later(t, () => {
            api.vfx.play(SET_VFX.stomp, api.CHAR_X + 50 * api.VFX_SCALE, api.GROUND_Y, { scale: api.VFX_SCALE });
            api.hit(0);
        }));
    },
    // 졸개 지휘: 졸개 수에 따른 피해 증가를 주황 발밑 고리와 빛가루로 표시.
    leg_chimera_b: api => api.atSelf(PASSIVE_VFX.chimera),

    // ---- 새 캐릭터 다리 ----
    // 잠수화: 밀려남·감속·속박 저항을 청록 발밑 고리와 빛가루로 표시.
    leg_diver: api => api.atSelf(PASSIVE_VFX.diver),
    // 잠수화 강화: 더 높은 저항 수치를 같은 청록 발밑 고리로 표시.
    leg_diver_up: api => api.atSelf(PASSIVE_VFX.diver),
    // 자가 봉합: 잃은 내구도를 회복하며 1초마다 붉은 실 빛가루.
    leg_saint: api => repeat(api, 3, 1, () => api.atSelf(SAINT_VFX.selfStitch)),
    // 자가 봉합 강화: 더 높은 회복량, 같은 1초 간격 봉합 이펙트.
    leg_saint_up: api => repeat(api, 3, 1, () => api.atSelf(SAINT_VFX.selfStitch)),
    // 빙판 걸음: 빙결 적 대상 피해 증가를 서리색 발밑 고리와 빛가루로 표시.
    leg_frost: api => api.atSelf(PASSIVE_VFX.frost),
    // 빙판 걸음 강화: 더 높은 빙결 피해 보너스를 같은 서리색 발밑 고리로 표시.
    leg_frost_up: api => api.atSelf(PASSIVE_VFX.frost),
    // 실 걸음: 토끼 인형 수에 따른 진격 속도 증가를 청록 발밑 고리와 빛가루로 표시.
    leg_doll: api => api.atSelf(PASSIVE_VFX.doll),
    // 실 걸음 강화: 더 높은 진격 속도 보너스를 같은 청록 발밑 고리로 표시.
    leg_doll_up: api => api.atSelf(PASSIVE_VFX.doll)
};
