/* ==========================================================================
   PROJECT: MAD OVERLORD // 거대괴수 2차 세트 (Q-009 · D-071 — MD/파츠확장_2차_기획안.md 5-2, 유니크 ①은 Q-008 3-2)
   유니크 ① 원시의 군주(u) · 레어 ③ 화산 등딱지(c) · 레어 ④ 늪지 포식자(d) · 유니크 ② 수정 거수(v) · 유니크 ③ 폭풍 해룡(w)
   · 레전더리 ① 종말의 거신(l) · 레전더리 ② 태고의 용왕(m)
   스킬은 부품 단계(skillKit_v2.js), 동작은 rig/kaijuRig.js (claw3·roarSky는 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf, spr } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';

const GREEN = '160, 255, 60', LAVA = '255, 120, 40', CRYSTAL = '150, 240, 255', SEA = '80, 220, 255', GOLD = '255, 210, 90', DOOM = '255, 70, 40';

// 수정 감옥: 가둔 적을 기억했다가 3초 뒤 깨뜨림 (파편이 옆 적에게)
function crystalPrison(b, ctx, s) {
    const list = pickTargets(b, 'strongest', s.n, b.playerRange + 700).filter(e => !e.isBuilding);
    list.forEach(e => {
        b.kitStatus(e, { stun: s.sec });
        b.fx.play(V.shatter(0, 150, { dur: 0.6 }), aimAt(e).x, FOOT_B);
    });
    b.schedule(s.sec, () => {
        list.forEach(e => {
            if (!b.enemies.includes(e)) return;
            const x = aimAt(e).x;
            b.fx.play(V.ice(0, 170), x, aimAt(e).b);
            kitHit(b, e, s.dmg, { knock: 1 });
            enemiesNear(b, x, 110).filter(o => o !== e).forEach(o => kitHit(b, o, s.dmg * 0.4, { knock: 0.6 }));
        });
        b.director.shake(6, 250);
    });
}

// 포식: 보통 적은 한입에, 엘리트·보스는 큰 피해 + 체력 회복
function devour(b, ctx, s) {
    const t = pickTargets(b, 'nearest', 1, b.playerRange + 60)[0];
    if (!t) return;
    const big = t.elite || t.boss || t.isBuilding;
    b.fx.play(V.bite(0, 170), aimAt(t).x, aimAt(t).b);
    kitHit(b, t, big ? s.dmg : 40, { knock: 1.2, stop: true });
    b.kitHeal(b.maxPlayerHp * s.heal);
    b.fx.play(V.motes(GREEN, 14), b.monsterX + 60, 120);
}

export const KAIJU_SETS2 = packOf('kaiju', [
    // ---- 유니크 ① 원시의 군주 (Q-008 3-2) — 등지느러미가 빛나는 태고의 괴수, 느림·약함을 메움 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '원시의 군주', style: 'speed', tint: 'hue-rotate(-20deg) saturate(1.4) brightness(1.15) drop-shadow(0 0 6px rgba(200, 255, 160, 0.6))',
        bonus: { 2: '포식 쿨다운 -3초', 4: '체력 50% 아래에서 판마다 한 번 재생 폭발 — 체력 30% 회복 + 둘레 적 밀쳐냄' },
        kit: {
            2: { patch: { kjDevour: { cd: -3 } } },
            4: { on: [{ when: 'lowHp', once: 'regen', heal: 0.3, label: '재생 폭발!', step: { do: 'push', range: 300, dist: 150, dmg: 1.2, vfx: null } }] }
        },
        head: { name: '원시 왕관 머리', look: '큰 뿔 왕관, 빛나는 초록 눈', skill: 'kjDoomBeam', desc: '필살기 멸망의 숨결: 등지느러미가 빛난 뒤 4초간 초록 열선 (일직선 지속 피해, 거점 2배)', stats: { hp: 1100, dps: 90, range: 30, speed: 0 } },
        body: { name: '발광 등판 외피', look: '등에 수정 같은 발광 지느러미 줄', skill: 'kjMolt', desc: '진화 탈피: 체력 25% 회복 + 해로운 효과 풀림 + 5초 진격 속도 +30%', stats: { hp: 2800, dps: 60, range: 0, speed: 0 } },
        arm: { name: '대지 파쇄 앞발', look: '바위 같은 큰 앞발, 발톱', skill: 'kjDevour', desc: '기본 공격 땅울림 (뒤 적까지) · 포식: 보통 적을 한입에, 엘리트·보스는 큰 피해 + 체력 10%', stats: { hp: 800, dps: 500, range: 200, speed: 0 },
            kitAttack: { kind: 'melee', vfx: V.impact(0, 150), splash: 150, splashMul: 0.5, knock: 1 } },
        leg: { name: '거신의 다리', look: '굵고 긴 뒷다리, 땅을 쥔 발톱', desc: '포식 성장: 적을 쓰러뜨릴 때마다 최대 체력 +1% (판마다 최대 +30%), 몸이 조금씩 커짐', stats: { hp: 1300, dps: 60, range: 0, speed: 130 },
            passive: { name: '포식 성장', desc: '적을 쓰러뜨릴 때마다 최대 체력 +1% (최대 +30%)', onKill: { grow: { hp: 0.01, max: 0.3, size: 0.15 } } } },
        skills: {
            kjDoomBeam: { name: '멸망의 숨결', slot: 'head', ult: true, cd: 0, icon: 'breath', color: '#a0ff32', target: 'enemy', range: 380,
                desc: '등지느러미가 차례로 빛난 뒤 4초간 초록 열선 — 일직선 지속 피해, 거점 2배', clip: 'breath', sfx: 'kaiju_breath',
                steps: [{ at: 0, do: 'fx', on: 'self', vfx: V.aura(-60, 260), follow: true },
                    { at: 0.4, do: 'line', dmg: 0.9, baseMul: 2, decay: 0.9, vfx: V.sheet('primal_beam', 430, { anchorX: 0.03, dur: 0.45, glow: 1.1 }), hitVfx: V.acid(0, 70), repeat: 10, repeatGap: 0.4, knock: 0.3 },
                    { at: 0.4, do: 'shake', power: 5, ms: 4000 }] },
            kjMolt: { name: '진화 탈피', slot: 'body', cd: 15, icon: 'egg', color: '#a0ff32', target: 'self', clip: 'brace', cast: true, sfx: 'shield_on',
                desc: '허물을 벗어 체력 25% 회복 + 해로운 효과 풀림 + 5초 진격 속도 +30%',
                steps: [{ do: 'cleanse' }, { do: 'heal', ratio: 0.25 }, { do: 'buff', sec: 5, mods: { move: 0.3 }, vfx: V.mutation(-40, 180) }] },
            kjDevour: { name: '포식', slot: 'arm', cd: 9, icon: 'maul', color: '#a0ff32', target: 'enemy', range: 60, clip: 'lunge',
                desc: '앞의 보통 적을 삼켜 바로 쓰러뜨림 (엘리트·보스는 큰 피해) + 체력 10% 회복', p: {},
                steps: [{ at: 0.35, do: 'custom', fn: devour, dmg: 5, heal: 0.1 }] }
        }
    },

    // ---- 레어 ③ 화산 등딱지 (공격) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '화산 등딱지', style: 'dps', tint: 'sepia(0.7) saturate(2.4) hue-rotate(-25deg) brightness(0.95)',
        bonus: { 4: '화산 분화 용암탄 8 → 12개' },
        kit: { 4: { patch: { kjEruption: { count: 4 } } } },
        head: { name: '분화구 머리', look: '정수리에 김이 오르는 분화구', skill: 'kjEruption', desc: '필살기 화산 분화: 용암탄 8개 (범위 피해 + 4초 용암 장판)' },
        body: { name: '현무암 등딱지', look: '검은 현무암 판, 틈새로 흐르는 용암', skill: 'kjLavaSkin', desc: '용암 갑옷: 6초간 받는 피해 -30%, 근접으로 때린 적 화상' },
        arm: { name: '흑요석 발톱', look: '검게 빛나는 흑요석 발톱', skill: 'kjLavaClaw', desc: '용암 할퀴기: 3번 할퀴기 — 3초 화상' },
        leg: { name: '바위 다리', look: '현무암 덩어리 같은 다리', desc: '열기 발자국: 지나간 자리 2초 불씨 (밟은 적 화상)',
            passive: { name: '열기 발자국', desc: '지나간 자리에 2초 불씨 — 밟은 적 화상',
                step: { do: 'zone', x: -110, w: 70, sec: 2, status: { burn: [2, 0.15] }, every: 0.5, puff: V.embers(LAVA), puffEvery: 0.3 } } },
        skills: {
            kjEruption: { name: '화산 분화', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#ff7a1a', target: 'enemy', range: 420, clip: 'roar', sfx: 'kaiju_roar',
                desc: '등에서 용암탄이 솟아 앞쪽에 떨어짐 — 범위 피해 + 4초 용암 장판', p: { count: 8 },
                steps: [{ at: 0, do: 'fx', on: 'self', vfx: V.blast(0, 220, { anchorY: 0.9 }), b: FOOT_B + 120 },
                    { at: 0.4, do: 'rain', count: '$count', x: [60, 520], every: 0.16, radius: 70, dmg: 2.2, delay: 0.25, vfx: V.sheet('lava_burst', 210, { anchorY: 0.85, dur: 0.6 }), shake: 4,
                        zone: { w: 90, sec: 4, dps: 0.5, puff: V.embers(LAVA), puffEvery: 0.35 }, sfx: 'mech_missile_blast' }] },
            kjLavaSkin: { name: '용암 갑옷', slot: 'body', cd: 14, icon: 'shield', color: '#ff7a1a', target: 'self', clip: 'brace', cast: true,
                desc: '6초간 받는 피해 -30%, 근접으로 때린 적은 화상',
                steps: [{ do: 'buff', sec: 6, mods: { def: 0.3, reflectStatus: { burn: [3, 0.3] } }, vfx: V.aura(-140, 230) }] },
            kjLavaClaw: { name: '용암 할퀴기', slot: 'arm', cd: 8, icon: 'claw', color: '#ff7a1a', target: 'enemy', range: 40, clip: 'claw3',
                desc: '3번 할퀴기 — 맞은 적 3초 화상',
                steps: [{ at: 0.12, do: 'hit', times: 3, every: 0.16, dmg: 1.1, vfx: V.claw(0, 140), status: { burn: [3, 0.25] }, knock: 0.8 }] }
        }
    },

    // ---- 레어 ④ 늪지 포식자 (탱커) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '늪지 포식자', style: 'tank', tint: 'sepia(0.5) hue-rotate(35deg) saturate(0.9) brightness(0.85)',
        bonus: { 4: '늪 위에서 적이 쓰러지면 체력 2% 회복' },
        kit: { 4: { on: [{ when: 'kill', inZone: 'swamp', heal: 0.02 }] } },
        head: { name: '악어 턱 머리', look: '길쭉한 악어 턱, 이끼 낀 비늘', skill: 'kjSwamp', desc: '필살기 늪 삼키기: 앞쪽 바닥이 8초 늪 — 적이 느려지고 초당 피해' },
        body: { name: '이끼 비늘', look: '두꺼운 이끼와 덩굴이 덮인 등', skill: 'kjSubmerge', desc: '늪 위장: 4초간 받는 피해 -70%, 나올 때 앞 적 물어 2초 기절' },
        arm: { name: '덫 발톱', look: '갈고리처럼 휜 긴 발톱', skill: 'kjDrag', desc: '물어 끌기: 사거리 안 가장 먼 적을 끌어와 물기 (큰 피해)' },
        leg: { name: '물갈퀴 다리', look: '넓은 물갈퀴 발', desc: '늪지 적응: 장판(늪·독 구름·오물) 감속 무시, 장판 위 진격 속도 +20%',
            passive: { name: '늪지 적응', desc: '장판 감속 무시, 장판 위에서 진격 속도 +20%', flags: ['ignoreHazard'], self: [{ when: 'hazard', mods: { move: 0.2 } }] } },
        skills: {
            kjSwamp: { name: '늪 삼키기', slot: 'head', ult: true, cd: 0, icon: 'acid', color: '#7a9a30', target: 'enemy', range: 400, clip: 'slam', sfx: 'chimera_slam',
                desc: '앞쪽 바닥이 8초간 늪으로 — 적이 느려지고 초당 피해',
                steps: [{ at: 0.4, do: 'zone', tag: 'swamp', x: 20, w: 380, sec: 8, dps: 0.4, slow: true, puff: V.sheet('swamp_bubble', 110, { anchorY: 0.85, dur: 0.8 }), puffEvery: 0.22, puffB: 0, scale: 1 },
                    { at: 0.4, do: 'fx', x: 200, vfx: V.impact(-40, 260) }] },
            kjSubmerge: { name: '늪 위장', slot: 'body', cd: 14, icon: 'egg', color: '#7a9a30', target: 'self', clip: 'lay',
                desc: '4초간 늪에 잠겨 받는 피해 -70%, 나오며 앞 적을 물어 2초 기절',
                steps: [{ do: 'buff', sec: 4, mods: { def: 0.7 }, vfx: V.acid(-35, 200, { anchorY: 0.9, dur: 0.7 }) },
                    { at: 4, do: 'hit', pick: 'nearest', dmg: 2, status: { stun: 2 }, vfx: V.bite(-30, 150), range: 120 }] },
            kjDrag: { name: '물어 끌기', slot: 'arm', cd: 9, icon: 'anchor', color: '#7a9a30', target: 'enemy', range: 160, clip: 'lunge',
                desc: '사거리 안 가장 먼 적을 끌어와 물기 — 큰 피해',
                steps: [{ at: 0.2, do: 'pull', pick: 'farthest', n: 1, to: 10, sec: 0.3, dmg: 3.2, vfx: V.acid(-30, 90) },
                    { at: 0.55, do: 'hit', pick: 'nearest', dmg: 0, vfx: V.bite(-30, 150) }] }
        }
    },

    // ---- 유니크 ② 수정 거수 (균형) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '수정 거수', style: 'balance', tint: 'saturate(0.6) brightness(1.2) drop-shadow(0 0 6px rgba(150, 240, 255, 0.7))',
        bonus: { 2: '수정 감옥 +2명', 4: '반사 수정막이 끝나면 수정 폭발 (둘레 큰 피해)' },
        kit: { 2: { patch: { kjPrison: { n: 2 } } }, 4: { patch: { kjVeil: { burst: 4 } } } },
        head: { name: '수정 왕관 머리', look: '머리에 솟은 청백 수정 왕관', skill: 'kjPrison', desc: '필살기 수정 감옥: 적 6명을 3초 가둠 → 깨지며 큰 피해 + 파편' },
        body: { name: '수정 등뼈', look: '등뼈를 따라 솟은 수정 기둥', skill: 'kjVeil', desc: '반사 수정막: 5초간 원거리 피해 되돌림 + 근접 피해 -30%' },
        arm: { name: '수정 송곳 앞발', look: '발톱 끝이 수정 송곳', skill: 'kjCrystalSpear', desc: '수정 창 투척: 수정 창 3개 — 떨어진 자리 1초 속박' },
        leg: { name: '수정 발굽', look: '수정으로 감싼 발', desc: '공명: 갇히거나 속박된 적에게 피해 +25%',
            passive: { name: '공명', desc: '갇히거나(기절) 속박된 적에게 주는 피해 +25%', target: [{ when: 'status', status: 'held', dmg: 0.25 }] } },
        skills: {
            kjPrison: { name: '수정 감옥', slot: 'head', ult: true, cd: 0, icon: 'icecage', color: '#9ff0ff', target: 'enemy', range: 700, clip: 'roar', sfx: 'frost_freeze',
                desc: '강한 적부터 6명을 수정에 3초 가둠 → 깨지며 큰 피해, 파편이 옆 적에게', p: { n: 6 },
                steps: [{ at: 0.35, do: 'custom', fn: crystalPrison, n: '$n', sec: 3, dmg: 3.5 }] },
            kjVeil: { name: '반사 수정막', slot: 'body', cd: 15, icon: 'shield', color: '#9ff0ff', target: 'self', clip: 'brace', cast: true, p: { burst: 0 },
                desc: '5초간 원거리 피해를 되돌리고 근접 피해 -30%',
                steps: [{ do: 'buff', sec: 5, mods: { rangedReflect: true, def: 0.3 }, vfx: V.shatter(0, 220, { dur: 0.7 }) },
                    { at: 5, do: 'hit', pick: 'all', range: 220, dmg: '$burst', vfx: V.ice(0, 160), when: b => b.kitPatch?.kjVeil?.burst > 0 }] },
            kjCrystalSpear: { name: '수정 창 투척', slot: 'arm', cd: 9, icon: 'spikes', color: '#9ff0ff', target: 'enemy', range: 220, clip: 'spit',
                desc: '수정 창 3개를 던짐 — 떨어진 자리 피해 + 1초 속박',
                steps: [{ at: 0.15, do: 'rain', count: 3, every: 0.18, radius: 55, dmg: 1.6, vfx: V.shatter(0, 130), status: { root: 1 }, delay: 0.15 }] }
        }
    },

    // ---- 유니크 ③ 폭풍 해룡 (사거리) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '폭풍 해룡', style: 'range', tint: 'hue-rotate(95deg) saturate(1.3) brightness(1.1)',
        bonus: { 2: '해일이 두 번', 4: '폭풍 충전 번개에 맞은 적 0.3초 기절' },
        kit: { 2: { patch: { kjTidal: { waves: 1 } } }, 4: { patch: { kjStorm: { stun: 0.3 } } } },
        head: { name: '해룡 지느러미 머리', look: '귀 대신 큰 지느러미, 청록 비늘', skill: 'kjTidal', desc: '필살기 해일: 큰 파도가 화면을 쓸고 감 — 피해 + 멀리 밀어냄 (거점 큰 피해)' },
        body: { name: '번개 지느러미 등', look: '등에 번개가 튀는 지느러미', skill: 'kjStorm', desc: '폭풍 충전: 8초간 기본 공격마다 번개가 가까운 적 2명에게' },
        arm: { name: '해룡 앞발', look: '물갈퀴 달린 앞발', skill: 'kjVortex', desc: '소용돌이: 3초간 적을 가운데로 모으며 초당 피해' },
        leg: { name: '꼬리 지느러미 다리', look: '다리 뒤로 늘어진 지느러미', desc: '해류 타기: 밀쳐낸 적은 3초간 받는 피해 +15%',
            passive: { name: '해류 타기', desc: '밀거나 끌어온 적은 3초간 받는 피해 +15%', pushedVuln: [3, 0.15] } },
        skills: {
            kjTidal: { name: '해일', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#50dcff', target: 'enemy', range: 800, clip: 'breath', sfx: 'diver_surge', p: { waves: 1 },
                desc: '큰 파도가 화면을 쓸고 지나감 — 피해 + 멀리 밀어냄, 거점 큰 피해',
                steps: [{ at: 0.35, do: 'wave', from: -60, speed: 520, dist: 900, w: 70, dmg: 2.5, push: 70, baseMul: 2, vfx: V.sheet('tidal_wave', 250, { anchorY: 0.85, dur: 0.55 }), vfxEvery: 0.08, b: FOOT_B, repeat: '$waves', repeatGap: 1.4 }] },
            kjStorm: { name: '폭풍 충전', slot: 'body', cd: 14, icon: 'wave', color: '#50dcff', target: 'self', clip: 'roar', p: { stun: 0 },
                desc: '8초간 기본 공격마다 번개가 가까운 적 2명에게 튐',
                steps: [{ at: 0.3, do: 'buff', sec: 8, mods: { onHit: { do: 'chain', n: 2, dmg: 0.45, jump: 200, vfx: V.chainBolt(SEA), hitVfx: V.bolt(0, 70), status: { stun: '$stun' } } }, vfx: V.bolt(0, 200) }] },
            kjVortex: { name: '소용돌이', slot: 'arm', cd: 9, icon: 'whirl', color: '#50dcff', target: 'enemy', range: 200, clip: 'slam',
                desc: '앞쪽 소용돌이 3초 — 적을 가운데로 모으며 초당 피해',
                steps: [{ at: 0.4, do: 'zone', x: 90, w: 180, sec: 3, dps: 0.9, pull: 90, puff: V.water(0, 110, { dur: 0.5 }), puffEvery: 0.2 }] }
        }
    },

    // ---- 레전더리 ① 종말의 거신 (탱커) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '종말의 거신', style: 'tank', tint: 'brightness(0.55) saturate(1.6) sepia(0.4) hue-rotate(-30deg) drop-shadow(0 0 7px rgba(255, 70, 40, 0.8))',
        bonus: { 2: '대지 뒤집기 범위 +40%', 4: '체력 30% 아래에서 판마다 한 번 거신 각성 — 10초 크기 1.3배·피해 +50%·받는 피해 -50%' },
        kit: {
            2: { patch: { kjOverturn: { range: 90 } } },
            4: { on: [{ when: 'lowHp', once: 'titan', label: '거신 각성!', xform: { key: 'titan', sec: 10, giant: 1.3, mods: { dmg: 0.5, def: 0.5 } } }] }
        },
        head: { name: '종말 뿔 왕관', look: '검은 화산암 뿔, 갈라진 틈의 붉은 빛', skill: 'kjExtinction', desc: '필살기 대멸종: 3초 경고 뒤 거대 운석 — 화면 전체 큰 피해 + 3초 기절 (거점 2배)' },
        body: { name: '핵 심장 갑각', look: '가슴 갑각 아래 고동치는 붉은 핵', skill: 'kjHeartbeat', desc: '핵 심장 고동: 박동 3번 — 넓은 충격파 + 박동마다 체력 4% 회복' },
        arm: { name: '대지 붕괴 앞발', look: '용암이 흐르는 거대한 앞발', skill: 'kjOverturn', desc: '기본 공격 균열 강타 (뒤 적까지 + 감속) · 대지 뒤집기: 1.5초 기절 + 큰 피해',
            kitAttack: { kind: 'melee', vfx: V.impact(-20, 170), splash: 170, splashMul: 0.55, status: { slow: 1.5 }, knock: 1 } },
        leg: { name: '거신 다리', look: '기둥 같은 다리, 걸음마다 갈라지는 땅', desc: '멸종의 발걸음: 걸음마다 둘레 적 감속, 받는 피해 -10%',
            passive: { name: '멸종의 발걸음', desc: '받는 피해 -10%, 걸음마다 둘레 적 피해 + 감속', mods: { def: 0.1 },
                step: { do: 'hit', pick: 'all', range: 130, dmg: 0.15, status: { slow: 1 }, knock: 0.2 } } },
        skills: {
            kjExtinction: { name: '대멸종', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#ff4628', target: 'enemy', range: 600, clip: 'roarSky', sfx: 'kaiju_roar',
                desc: '3초 경고 뒤 하늘에서 거대 운석 — 화면 전체 큰 피해 + 3초 기절, 거점 2배',
                steps: [{ at: 0.2, do: 'fx', x: 260, vfx: V.ring(DOOM, 260, { dur: 2.6, inward: true }) },
                    { at: 2.2, do: 'fx', x: 260, vfx: V.sheet('meteor_red', 560, { anchorY: 0.85, dur: 1.1 }) },
                    { at: 2.7, do: 'screen', dmg: 6, status: { stun: 3 }, baseMul: 2, vfx: V.blast(-10, 120), maxFx: 8 },
                    { at: 2.7, do: 'shake', power: 14, ms: 700 }] },
            kjHeartbeat: { name: '핵 심장 고동', slot: 'body', cd: 16, icon: 'roar', color: '#ff4628', target: 'enemy', range: 160, clip: 'brace', cast: true,
                desc: '심장이 3번 고동 — 박동마다 넓은 충격파 + 체력 4% 회복',
                steps: [{ do: 'hit', pick: 'all', range: 260, dmg: 1.2, knock: 1, repeat: 3, repeatGap: 0.6 },
                    { do: 'heal', ratio: 0.04, repeat: 3, repeatGap: 0.6 },
                    { do: 'fx', on: 'self', x: 40, vfx: V.ring(DOOM, 200), repeat: 3, repeatGap: 0.6 }] },
            kjOverturn: { name: '대지 뒤집기', slot: 'arm', cd: 9, icon: 'slam', color: '#ff4628', target: 'enemy', range: 40, clip: 'slam', p: { range: 220 },
                desc: '앞쪽 땅을 뒤집어 적을 띄움 — 큰 피해 + 1.5초 기절',
                steps: [{ at: 0.4, do: 'hit', pick: 'all', range: '$range', dmg: 2.6, status: { stun: 1.5 }, vfx: V.impact(-20, 180), ground: true, knock: 0.4 },
                    { at: 0.4, do: 'shake', power: 8, ms: 300 }] }
        }
    },

    // ---- 레전더리 ② 태고의 용왕 (공격) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '태고의 용왕', style: 'dps', tint: 'sepia(0.6) saturate(2) hue-rotate(5deg) brightness(1.2) drop-shadow(0 0 7px rgba(255, 210, 90, 0.8))',
        bonus: { 2: '날개 돌풍 뒤 3초 진격 속도 +40%', 4: '숨결이 지난 자리에 금빛 불길 장판 4초' },
        kit: { 2: { patch: { kjGale: { rush: 0.4 } } }, 4: { patch: { kjKingBreath: { trail: 1 } } } },
        head: { name: '용왕 왕관 머리', look: '금빛 뿔 왕관, 청록 비늘', skill: 'kjKingBreath', desc: '필살기 용왕의 숨결: 6초간 금빛 숨결 — 매초 피해 + 화상 (거점 2배)' },
        body: { name: '용 날개 등', look: '등에 금빛 막 날개 한 쌍', skill: 'kjGale', desc: '날개 돌풍: 앞 적 모두 멀리 밀어냄' },
        arm: { name: '용 발톱', look: '금빛 비늘 덮인 세 갈래 발톱', skill: 'kjScaleRain', desc: '기본 공격 용 발톱 3연 · 용린 비: 비늘 20개 — 방어 -20% 5초',
            kitAttack: { kind: 'multi', n: 3, gap: 0.08, vfx: V.claw(30, 130), splash: 90, splashMul: 0.4 } },
        leg: { name: '용왕 다리', look: '금빛 비늘 다리, 용 발톱', desc: '용의 위엄: 엘리트·보스에게 받는 피해 -25%, 주는 피해 +15%',
            passive: { name: '용의 위엄', desc: '엘리트·보스에게 받는 피해 -25%, 주는 피해 +15%', target: [{ when: 'elite', dmg: 0.15 }], incoming: [{ when: 'elite', def: 0.25 }] } },
        skills: {
            kjKingBreath: { name: '용왕의 숨결', slot: 'head', ult: true, cd: 0, icon: 'breath', color: '#ffd25a', target: 'enemy', range: 420, clip: 'breath', sfx: 'kaiju_breath', p: { trail: 0 },
                desc: '6초간 금빛 숨결로 앞을 쓸어내림 — 매초 피해 + 3초 화상, 거점 2배',
                steps: [{ at: 0.35, do: 'line', dmg: 0.9, baseMul: 2, decay: 0.95, vfx: V.sheet('breath_gold', 430, { anchorX: 0.03, dur: 0.55 }), status: { burn: [3, 0.3] }, repeat: 12, repeatGap: 0.5, knock: 0.2 },
                    { at: 0.6, do: 'zone', x: 0, w: 420, sec: 9.5, status: { burn: [2, 0.3] }, every: 0.8, puff: V.blast(25, 80), puffEvery: 0.18, when: b => b.kitPatch?.kjKingBreath?.trail > 0 }] },
            kjGale: { name: '날개 돌풍', slot: 'body', cd: 14, icon: 'wave', color: '#ffd25a', target: 'enemy', range: 400, clip: 'roar', p: { rush: 0 },
                desc: '날개를 펴 돌풍 — 앞 적 모두 멀리 밀어냄',
                steps: [{ at: 0.3, do: 'push', range: 420, dist: 170, dmg: 0.8 },
                    { at: 0.3, do: 'fx', x: 60, vfx: fxOf({ type: 'speedlines', at: 0, dur: 0.4, count: 10, len: 120, angle: 0, cone: 0.6, width: 4, color: GOLD }) },
                    { at: 0.3, do: 'buff', key: 'galeRush', sec: 3, mods: { move: '$rush' }, when: b => b.kitPatch?.kjGale?.rush > 0 }] },
            kjScaleRain: { name: '용린 비', slot: 'arm', cd: 9, icon: 'spikes', color: '#ffd25a', target: 'enemy', range: 260, clip: 'roar',
                desc: '금빛 비늘 20개를 흩뿌림 — 피해 + 5초 방어 -20%',
                steps: [{ at: 0.3, do: 'rain', count: 20, every: 0.04, radius: 45, dmg: 0.45, vfx: V.gold(0, 70), status: { vuln: [5, 0.2] }, jitter: 60 }] }
        }
    }
]);
