/* ==========================================================================
   PROJECT: MAD OVERLORD // 봉합 성녀 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-6)
   레어 ① 종지기 수녀(a) · 레어 ② 붉은 실 재봉사(b) · 유니크 ① 천 개의 실 날개(u) · 레어 ③ 약초 치유사(c) · 레어 ④ 눈물의 조각상(d)
   · 유니크 ② 나비 실 수녀(v) · 유니크 ③ 흑철 재봉 기계(w) · 레전더리 ① 운명의 직조자(l) · 레전더리 ② 진홍 장미 성녀(m)
   꿰맨 아군 = battle/saint.js riseAlly (상한 SAINT.allyMax + 값 allyMax) — 처치 때 꿰매기는 battle/kit.js kitRaiseAlly, 버프 값 raise = 그동안 n명.
   붉은 실(status thread) = 이어진 적끼리 받은 피해의 30%를 나눔. 새 캐릭터 세트는 강화 그림 + 세트 색. 동작은 rig/saintRig.js (slam·throw는 2차에서 더함)
   ========================================================================== */

import { packOf, V } from './common.js';
import { kitHit, pickTargets, enemiesNear } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';

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

// 운명 재봉: 화면 모든 적을 실로 꿰어 sec초 매달고 → 꿰인 수만큼 커지는 폭발
function fateSew(b, ctx, s) {
    const list = onScreen(b);
    list.forEach(e => { b.kitStatus(e, { stun: s.sec, thread: s.sec }); b.fx.play(V.chainBolt(GOLD), b.monsterX + 60, 160, { to: [aimAt(e).x, aimAt(e).b + 40] }); });
    b.fx.play(V.sheet('fate_thread', 420, { dur: 0.9 }), b.frontX() + 250, 210);
    const mul = 1 + 0.15 * list.length;
    b.schedule(s.sec, () => list.forEach((e, i) => b.schedule(i * 0.06, () => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(V.gold(-20, 140), aimAt(e).x, aimAt(e).b);
        kitHit(b, e, s.dmg * mul, { knock: 1 });
    })));
}

// 천 갈래 실: 실 n가닥이 사방 적에 꽂혀 delay초 뒤 당겨지며 피해 + 모음
function thousandThreads(b, ctx, s) {
    const list = pickTargets(b, 'random', s.n, b.playerRange + 300);
    list.forEach(e => { b.kitStatus(e, { thread: s.delay + 1 }); b.fx.play(V.chainBolt(GOLD), b.monsterX + 60, 140, { to: [aimAt(e).x, aimAt(e).b] }); });
    b.schedule(s.delay, () => list.forEach(e => {
        if (!b.enemies.includes(e)) return;
        kitHit(b, e, s.dmg, { knock: 0 });
        if (b.enemies.includes(e) && isUnit(e) && !e.boss && b.pullEnemy) { b.pullEnemy(e, b.frontX() + 40, 0.3); b.kitPushed?.(e); }
    }));
}

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
                steps: [{ at: 0.45, do: 'fx', x: 220, b: 300, vfx: V.gold(0, 300, { dur: 0.8 }) }, { at: 0.45, do: 'fx', x: 100, vfx: V.ring(HOLY, 380) },
                    { at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { stun: 2 }, vfx: V.gold(0, 80, { dur: 0.3 }), maxFx: 8 },
                    { at: 0.45, do: 'heal', allies: true, allyRatio: 0.5 }, { at: 0.45, do: 'buff', key: 'bellToll', sec: 8, mods: { allyDmg: 0.5 } }] },
            stCandles: { name: '봉헌의 촛불', slot: 'body', cd: 15, icon: 'fire', color: '#ffd782', target: 'self', clip: 'cast',
                desc: '8초간 촛불 자리 — 안의 나·아군 초당 회복, 다가온 적 불티 피해',
                steps: [{ at: 0.45, do: 'zone', tag: 'candle', x: -140, w: 300, sec: 8, heal: 0.01, allyHeal: 0.01, dps: 0.3, puff: V.embers(HOLY), puffEvery: 0.3, puffB: 20 }] },
            stBellStrike: { name: '종 추 강타', slot: 'arm', cd: 9, icon: 'hammer', color: '#ffd782', target: 'enemy', range: 150, clip: 'slam',
                desc: '앞쪽 내려쳐 피해 + 1초 기절 + 음파',
                steps: [{ at: 0.42, do: 'hit', pick: 'all', range: 150, dmg: 1.8, status: { stun: 1 }, knock: 0.8, vfx: V.impact(40, 150) }, { at: 0.42, do: 'fx', x: 60, vfx: V.ring(HOLY, 180) }] }
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
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { thread: 6 }, vfx: V.needle(0, 90), maxFx: 10 }] },
            stCocoon: { name: '실 고치', slot: 'body', cd: 14, icon: 'shield', color: '#eb2846', target: 'self', clip: 'cast',
                desc: '4초간 실 고치 — 받는 피해 -60%, 끝나면 실이 사방으로 튀어 피해',
                steps: [{ do: 'buff', key: 'cocoon', sec: 4, mods: { def: 0.6, onEnd: { do: 'hit', pick: 'all', range: 220, dmg: 1.5, knock: 0.6, vfx: V.needle(0, 110) } }, vfx: V.revive(0, 200, { dur: 0.8 }) }] },
            stStitchChain: { name: '꿰매기 사슬', slot: 'arm', cd: 8, icon: 'chain', color: '#eb2846', target: 'enemy', range: 300, clip: 'triple',
                desc: '바늘이 적 4명을 차례로 꿰뚫고 실로 묶음 — 2초 속박',
                steps: [{ at: 0.2, do: 'chain', n: 4, range: 300, jump: 170, dmg: 1, decay: 0.95, status: { root: 2, thread: 4 }, vfx: V.chainBolt(BLOOD), hitVfx: V.needle(0, 70) }] }
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
            kitAttack: { kind: 'shot', n: 2, gap: 0.1, color: HOLY, vfx: V.needle(0, 70, { dur: 0.3 }), onHit: (b, e) => b.markStitch?.(e) } },
        leg: { name: '떠 있는 실 신발', look: '땅에서 살짝 뜬 발, 늘어진 실', desc: '떠 있는 성녀: 장판·넉백 무시, 근접 피해 -20%', stats: { hp: 900, dps: 70, range: 0, speed: 130 },
            passive: { name: '떠 있는 성녀', desc: '장판·넉백 무시, 근접 피해 -20%', flags: ['knockImmune', 'ignoreHazard'], incoming: [{ when: 'melee', def: 0.2 }] } },
        skills: {
            stSalvation: { name: '구원의 비', slot: 'head', ult: true, cd: 0, icon: 'stitch', color: '#ffd782', target: 'enemy', range: 520, clip: 'cast', sfx: 'saint_revive',
                desc: '8초간 화면에 빛 바늘 비 — 맞은 적 피해, 이 동안 쓰러진 적 최대 5명이 꿰맨 아군으로 일어남',
                steps: [{ at: 0.4, do: 'buff', key: 'salvation', sec: 8.2, mods: { raise: 5 } },
                    { at: 0.45, do: 'rain', count: 32, every: 0.25, x: [30, 520], radius: 55, dmg: 0.5, vfx: V.pillar(-20, 120, { dur: 0.4 }) }] },
            stGuardThread: { name: '수호 실타래', slot: 'body', cd: 15, icon: 'shield', color: '#ffd782', target: 'self', clip: 'cast',
                desc: '나와 아군 모두에게 6초간 실 보호막 (최대 체력 20%)',
                steps: [{ at: 0.45, do: 'shield', ratio: 0.2, sec: 6, allies: true, color: HOLY }, { at: 0.45, do: 'fx', on: 'self', x: 30, vfx: V.revive(30, 200) }] },
            stThousandNeedles: { name: '천의 바늘', slot: 'arm', cd: 9, icon: 'stitch', color: '#ffd782', target: 'enemy', range: 320, clip: 'triple',
                desc: '앞쪽 부채꼴로 바늘 12개 — 맞은 적 1초 속박',
                steps: [{ at: 0.2, do: 'hit', pick: 'all', range: 320, times: 3, every: 0.12, dmg: 0.4, status: { root: 1 }, vfx: V.needle(-20, 80, { dur: 0.3 }) }] }
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
                    { at: 0.45, do: 'zone', tag: 'healRain', x: -220, w: 820, sec: 8, slow: true, allyHeal: 0.03, puff: V.sheet('heal_rain', 160, { dur: 0.6 }), puffEvery: 0.15, puffB: 120 }] },
            stHerbSmoke: { name: '약초 연기', slot: 'body', cd: 13, icon: 'spore', color: '#96ffa0', target: 'enemy', range: 220, clip: 'cast',
                desc: '앞 적에게 5초 독 연기 + 내 해로운 효과 풀림',
                steps: [{ do: 'cleanse' }, { at: 0.45, do: 'zone', tag: 'smoke', field: 'herb', x: 0, w: 220, sec: 5, status: { poison: [2, 0.3] }, every: 1 }] },
            stPotionThrow: { name: '약병 투척', slot: 'arm', cd: 8, icon: 'syringe', color: '#96ffa0', target: 'enemy', range: 320, clip: 'throw',
                desc: '약병 3개를 던짐 — 터진 자리 3초 장판 (적 피해·나·아군 회복)',
                steps: [{ at: 0.35, do: 'rain', count: 3, every: 0.15, radius: 60, dmg: 0.8, delay: 0.35, vfx: V.acid(60, 160), zone: { field: 'herb', w: 120, sec: 3, dps: 0.3, heal: 0.02, allyHeal: 0.02 } }] }
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
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.6, status: { stun: '$sec', vuln: ['$sec', 0.3] }, vfx: V.sheet('stone_grey', 120, { anchorY: 0.85, dur: 0.6 }), maxFx: 10 }] },
            stStatue: { name: '석상 자세', slot: 'body', cd: 14, icon: 'shield', color: '#dcdce6', target: 'self', clip: 'cast',
                desc: '4초간 받는 피해 -80% — 끝날 때 돌 조각 폭발',
                steps: [{ do: 'buff', key: 'statue', sec: 4, mods: { def: 0.8, onEnd: { do: 'hit', pick: 'all', range: 180, dmg: 1.5, knock: 0.8, vfx: V.impact(0, 140) } }, vfx: V.impact(0, 200) }] },
            stStonePalm: { name: '돌 손바닥', slot: 'arm', cd: 8, icon: 'hand', color: '#dcdce6', target: 'enemy', range: 130, clip: 'slam',
                desc: '앞 적 하나를 내려쳐 2초 기절',
                steps: [{ at: 0.42, do: 'hit', pick: 'nearest', range: 130, dmg: 2, status: { stun: 2 }, knock: 0.8, vfx: V.impact(0, 160) }, { at: 0.42, do: 'shake', power: 4, ms: 150 }] }
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
                    { at: 0.45, do: 'rain', count: '$n', every: 0.26, x: [30, 480], radius: 45, dmg: 0.4, vfx: V.sheet('butterfly_red', 110, { dur: 0.6 }), vfxB: FOOT_B + 70 }] },
            stPowder: { name: '나비 가루', slot: 'body', cd: 14, icon: 'spore', color: '#ff5a6e', target: 'enemy', range: 260, clip: 'cast',
                desc: '앞 적 4초 도취 — 주는 피해 -50%, 느려짐',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 260, dmg: 0.2, status: { weak: [4, 0.5], slow: 4 }, vfx: V.spore(-40, 100) }] },
            stButterflyArrow: { name: '나비 실 화살', slot: 'arm', cd: 8, icon: 'chain', color: '#ff5a6e', target: 'enemy', range: 350, clip: 'throw',
                desc: '나비 5마리가 실을 끌고 날아가 적 5명을 이어 2초 속박',
                steps: [{ at: 0.35, do: 'chain', n: 5, range: 350, jump: 180, dmg: 0.9, decay: 0.95, status: { root: 2, thread: 3 }, vfx: V.chainBolt(BUTTERFLY), hitVfx: V.spore(-40, 60) }] }
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
                steps: [{ at: 0.45, do: 'rain', count: '$n', every: 0.18, x: [40, 520], aim: false, radius: 45, dmg: 0.9, status: { root: 1, mark: [6, 0.15] }, vfx: V.sheet('machine_needle', 180, { anchorY: 0.92, dur: 0.4 }), shake: 2 }] },
            stThreadArmor: { name: '실 감기 장갑', slot: 'body', cd: 14, icon: 'shield', color: '#b43c46', target: 'self', clip: 'cast',
                desc: '6초간 받는 피해 -40% — 나를 때린 적 1초 속박',
                steps: [{ do: 'buff', key: 'threadArmor', sec: 6, mods: { def: 0.4, reflectStatus: { root: 1 } }, vfx: V.revive(-20, 200) }] },
            stThreadPull: { name: '실 끌어당기기', slot: 'arm', cd: 9, icon: 'chain', color: '#b43c46', target: 'enemy', range: 360, clip: 'triple',
                desc: '앞 적 4명을 내 앞으로 끌어와 2초 속박 + 피해',
                steps: [{ at: 0.2, do: 'pull', pick: 'nearest', n: 4, range: 360, to: 30, sec: 0.35, dmg: 1.2, status: { root: 2 }, vfx: V.chainBolt(IRON) }] }
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
                steps: [{ at: 0.45, do: 'custom', fn: fateSew, sec: '$sec', dmg: 2 }] },
            stLifeFabric: { name: '생명의 직물', slot: 'body', cd: 15, icon: 'stitch', color: '#ffc85a', target: 'self', clip: 'cast', p: { self: 0 },
                desc: '아군 모두 체력 전부 회복 + 8초 아군 공격 +50% (4부위: 나도 30% 회복)',
                steps: [{ at: 0.45, do: 'heal', allies: true, allyRatio: 1, ratio: '$self' }, { at: 0.45, do: 'buff', key: 'lifeFabric', sec: 8, mods: { allyDmg: 0.5 }, vfx: V.gold(0, 220) }] },
            stThousandThreads: { name: '천 갈래 실', slot: 'arm', cd: 9, icon: 'chain', color: '#ffc85a', target: 'enemy', range: 400, clip: 'throw',
                desc: '실 10가닥이 적에 꽂혀 3초 뒤 당겨지며 피해 + 앞으로 모음',
                steps: [{ at: 0.35, do: 'custom', fn: thousandThreads, n: 10, delay: 3, dmg: 1.6 }] }
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
                steps: [{ at: 0.45, do: 'zone', tag: 'rose', x: 0, w: 430, sec: 8, dps: 0.4, status: { root: 1 }, every: 3, allyHeal: 0.02, puff: V.sheet('rose_petal', 130, { dur: 0.6 }), puffEvery: 0.2 }] },
            stPetalStorm: { name: '꽃잎 폭풍', slot: 'body', cd: 14, icon: 'whirl', color: '#ff4664', target: 'self', clip: 'cast',
                desc: '4초 꽃잎 회오리 — 둘레 적 매초 피해 + 투사체 막음',
                steps: [{ do: 'buff', key: 'petalStorm', sec: 4, mods: { flags: ['projBlock'] } },
                    { at: 0.3, do: 'zone', follow: true, x: -100, w: 280, sec: 4, dps: 0.6, puff: V.motes(ROSE, 8), puffEvery: 0.12, puffB: 80 }] },
            stVineBind: { name: '넝쿨 포박', slot: 'arm', cd: 9, icon: 'thorns', color: '#ff4664', target: 'enemy', range: 320, clip: 'slam', p: { n: 4 },
                desc: '앞 적 4명을 넝쿨로 3초 속박 + 매초 피해 (가시 독)',
                steps: [{ at: 0.42, do: 'hit', pick: 'nearest', n: '$n', range: 320, dmg: 0.6, status: { root: 3, poison: [3, 0.3] }, vfx: V.needle(-40, 100) }] }
        }
    }
]);
