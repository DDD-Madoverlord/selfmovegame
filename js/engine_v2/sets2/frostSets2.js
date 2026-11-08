/* ==========================================================================
   PROJECT: MAD OVERLORD // 서리의 무희 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-7)
   레어 ① 설원 검무(a) · 레어 ② 눈보라 마녀(b) · 유니크 ① 얼음 여왕(u) · 레어 ③ 오로라 가희(c) · 레어 ④ 서리 늑대 사냥꾼(d)
   · 유니크 ② 빙하 거인 소환사(v) · 유니크 ③ 밤의 백조(w) · 레전더리 ① 영원한 겨울의 여제(l) · 레전더리 ② 달빛 검희(m)
   냉기·빙결은 battle/frost.js (status chill = 냉기 n, freeze = 빙결 초, 단계 값 shatter = 얼어 있으면 배수로 깨뜨림).
   새 캐릭터 세트는 강화 그림 + 세트 색 (common.js). 동작은 rig/frostRig.js (dashSlash·raise는 2차에서 더함)
   ========================================================================== */

import { packOf, V, fxOf } from './common.js';
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
    list.forEach(e => {
        if (e.boss) b.applyChill?.(e, 3); else b.freezeEnemy?.(e, s.hold + 0.2);
        b.fx.play(V.ice(0, 110), aimAt(e).x, aimAt(e).b);
    });
    b.fx.play(V.ring(ICE, 320), b.frontX() + 250, FOOT_B);
    b.schedule(s.hold, () => list.forEach((e, i) => b.schedule(i * 0.12, () => {
        if (!b.enemies.includes(e)) return;
        const x = aimAt(e).x;
        b.fx.play(V.shatter(0, 150), x, FOOT_B);
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
            b.fx.play(V.sheet('frost_wolf', 160, { dur: 0.45 }), aimAt(t).x, aimAt(t).b);
            kitHit(b, t, s.dmg, { knock: 0.5, status: { chill: 2 } });
        });
    }
}

// 영겁의 겨울: sec초 — 모든 적 느려짐, gap초마다 냉기 파도(냉기 2), 끝날 때 얼은 적 모두 깨짐
function eternalWinter(b, ctx, s) {
    for (let t = 0; t < s.sec; t += 1) b.schedule(t, () => { if (b.isActive) onScreen(b).forEach(e => b.kitStatus(e, { slow: 1.2 })); });
    for (let t = s.gap; t < s.sec; t += s.gap) {
        b.schedule(t, () => {
            if (!b.isActive) return;
            b.fx.play(V.sheet('eternal_winter', 420, { dur: 0.8 }), b.frontX() + 250, 200);
            b.fx.play(V.ring(SNOW, 360), b.frontX() + 200, FOOT_B);
            onScreen(b).forEach(e => b.kitStatus(e, { chill: 2 }));
        });
    }
    b.schedule(s.sec, () => {
        if (!b.isActive) return;
        b.enemies.filter(e => e.frozenT > 0).forEach((e, i) => b.schedule(i * 0.08, () => {
            if (!b.enemies.includes(e)) return;
            b.fx.play(V.shatter(0, 150), aimAt(e).x, FOOT_B);
            kitHit(b, e, s.dmg, { shatter: 2, knock: 0.8 });
        }));
    });
}

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
                steps: [{ at: 0.2, do: 'hit', pick: 'all', range: 420, times: 6, every: 0.18, dmg: 0.8, shatter: 2.5, status: { chill: 4 }, knock: 0.3, vfx: V.xcut(0, 160, { dur: 0.3 }) }] },
            fsIceMirror: { name: '얼음 거울', slot: 'body', cd: 14, icon: 'shield', color: '#96dcff', target: 'self', clip: 'cast',
                desc: '4초간 얼음 거울 — 원거리 공격을 되돌리고, 근접으로 때린 적은 빙결',
                steps: [{ do: 'buff', key: 'iceMirror', sec: 4, mods: { rangedReflect: true, reflectStatus: { freeze: 1 } }, vfx: V.ice(0, 170) },
                    { at: 0.5, do: 'fx', on: 'self', x: 70, b: FOOT_B + 70, follow: true, vfx: V.ice(0, 130, { dur: 0.6 }), repeat: 6, repeatGap: 0.6 }] },
            fsIceLance: { name: '빙창 찌르기', slot: 'arm', cd: 9, icon: 'sword', color: '#96dcff', target: 'enemy', range: 160, clip: 'dashSlash',
                desc: '앞으로 파고드는 관통 찌르기 — 얼어 있는 적은 깨져 2배 피해',
                steps: [{ at: 0.2, do: 'dash', dist: 120, sec: 0.25, dmg: 1.6, shatter: 2, knock: 0.6 }, { at: 0.3, do: 'fx', on: 'self', x: 110, b: 110, vfx: V.shatter(0, 120) }] }
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
                    { at: 0.4, do: 'fx', x: 260, b: 320, vfx: V.motes(SNOW, 30), repeat: 20, repeatGap: 0.5 }] },
            fsSpirits: { name: '서리 정령', slot: 'body', cd: 15, icon: 'snow', color: '#e6f5ff', target: 'self', clip: 'cast', p: { n: 2, life: 8 },
                desc: '눈 정령 2기 (8초) — 가까운 적에게 얼음 화살 (냉기)',
                steps: [{ at: 0.4, do: 'summon', n: '$n', art: 'oculus', scale: 0.55, filter: ICY, hp: 0.06, dps: 0.3, speed: 0.8, life: '$life', hit: { chill: 1 }, color: '#e6f5ff', vfx: V.ice(0, 100) }] },
            fsHail: { name: '우박 낙하', slot: 'arm', cd: 9, icon: 'snow', color: '#e6f5ff', target: 'enemy', range: 340, clip: 'cast',
                desc: '앞쪽 넓은 자리에 우박 3번 — 피해 + 냉기 (거점에도)',
                steps: [{ at: 0.4, do: 'rain', count: 3, every: 0.2, radius: 80, dmg: 1.2, status: { chill: 1 }, vfx: V.shatter(0, 160), delay: 0.3, shake: 3 }] }
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
                steps: [{ at: 0.4, do: 'summon', n: 2, spread: 40, art: 'guardian', scale: 0.75, filter: ICY, hp: 0.2, dps: 0.5, speed: 0.7, life: 10, hit: { chill: 2 }, color: '#aae6ff', vfx: V.shatter(0, 140), label: '얼음 기사!' }] },
            fsSpikePath: { name: '얼음 가시 길', slot: 'arm', cd: 9, icon: 'spikes', color: '#aae6ff', target: 'enemy', range: 420, clip: 'cast',
                desc: '앞으로 땅을 따라 얼음 가시가 줄지어 솟음 — 관통, 냉기 3',
                steps: [{ at: 0.45, do: 'wave', from: 0, speed: 520, dist: 440, w: 40, dmg: 1.2, status: { chill: 3 }, knock: 0.3, vfx: V.shatter(0, 110, { dur: 0.4 }), vfxEvery: 0.06, b: FOOT_B }] }
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
                    { at: 0.4, do: 'fx', x: 260, b: 330, vfx: V.sheet('aurora_ribbon', 460, { dur: 1.2 }), repeat: 7, repeatGap: 1.1 },
                    { at: 0.9, do: 'screen', units: true, dmg: 0, status: { chill: 1 }, repeat: 8, repeatGap: 1 }] },
            fsRibbonSpin: { name: '빛띠 회전', slot: 'body', cd: 13, icon: 'whirl', color: '#8cffc8', target: 'self', clip: 'spin',
                desc: '4초간 빛띠를 두르고 돎 — 둘레 적 매초 피해 + 냉기',
                steps: [{ at: 0.3, do: 'zone', follow: true, x: -110, w: 280, sec: 4, dps: 0.5, status: { chill: 1 }, every: 1, puff: V.motes(AURORA, 8), puffEvery: 0.2, puffB: 90 }] },
            fsRibbonThrow: { name: '빛띠 날리기', slot: 'arm', cd: 8, icon: 'crescent', color: '#8cffc8', target: 'enemy', range: 360, clip: 'crescent',
                desc: '휘어 날아가는 빛띠 3줄 — 관통, 냉기',
                steps: [{ at: 0.38, do: 'wave', from: 0, speed: 620, dist: 380, w: 38, dmg: 0.9, status: { chill: 1 }, vfx: V.slash(-160, 120, { dur: 0.25 }), vfxEvery: 0.05, b: 120, repeat: 3, repeatGap: 0.12 }] }
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
                steps: [{ at: 0.4, do: 'custom', fn: wolfHunt, n: '$n', sec: 6, dmg: 1.2 }] },
            fsHowl: { name: '늑대 울음', slot: 'body', cd: 14, icon: 'roar', color: '#c8e1f0', target: 'self', clip: 'raise',
                desc: '6초간 나·아군 공격 +30%, 적 공격 -20%',
                steps: [{ do: 'buff', key: 'howl', sec: 6, mods: { dmg: 0.3, allyDmg: 0.3 }, vfx: V.roar(-90, 220, { dur: 0.6 }) },
                    { at: 0.3, do: 'screen', units: true, dmg: 0, status: { weak: [6, 0.2] } }] },
            fsPounce: { name: '덮치기', slot: 'arm', cd: 8, icon: 'claw', color: '#c8e1f0', target: 'enemy', range: 180, clip: 'dashSlash',
                desc: '앞으로 뛰어들어 덮침 — 2초 기절 + 냉기 3',
                steps: [{ at: 0.2, do: 'dash', dist: 140, sec: 0.25, dmg: 1.4, knock: 0.4, status: { stun: 2, chill: 3 } }, { at: 0.3, do: 'fx', on: 'self', x: 120, b: 110, vfx: V.claw(160, 140) }] }
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
                steps: [{ at: 0.4, do: 'fx', x: -20, vfx: V.sheet('glacier_giant', 320, { anchorY: 0.92, dur: 0.9 }) },
                    { at: 0.6, do: 'summon', n: 1, x: 90, art: 'guardian', scale: 1.05, filter: ICY, hp: 0.6, dps: 1.1, speed: 0.45, life: '$life', hit: { freeze: 1 }, color: '#78dce6', label: '빙하 거인!', blast: { dmg: 2.5, radius: 150 } }] },
            fsIceWall: { name: '빙벽', slot: 'body', cd: 14, icon: 'fort', color: '#78dce6', target: 'self', clip: 'cast', p: { endFreeze: 0 },
                desc: '앞에 얼음 벽 5초 — 적 진격을 막고 부딪친 적 냉기, 끝날 때 무너지며 피해',
                steps: [{ at: 0.4, do: 'zone', tag: 'icewall', wall: true, x: 30, w: 46, sec: 5, status: { chill: 1 }, every: 1,
                    art: { cls: 'is-icewall', sheet: 'ice_wall', w: 142, h: 224, dx: -48 },
                    end: { dmg: 1.5, radius: 160, vfx: V.shatter(0, 220), status: { freeze: '$endFreeze' } } }, { at: 0.4, do: 'shake', power: 4, ms: 200 }] },
            fsGlacierDrop: { name: '빙하 낙석', slot: 'arm', cd: 9, icon: 'slam', color: '#78dce6', target: 'enemy', range: 360, clip: 'cast',
                desc: '거대 빙하 덩어리가 떨어짐 — 넓은 범위 + 냉기 3',
                steps: [{ at: 0.45, do: 'rain', count: 1, radius: 130, dmg: 2.5, status: { chill: 3 }, vfx: V.shatter(0, 280), delay: 0.4, shake: 6 }] }
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
                steps: [{ at: 0.4, do: 'zone', tag: 'swan', x: 0, w: 400, sec: 6, dps: 0.6, status: { chill: 1 }, every: 1, puff: V.sheet('feather_black', 150, { dur: 0.6 }), puffEvery: 0.25, puffB: 70 },
                    { at: 6.4, do: 'hit', pick: 'all', range: 420, dmg: 2.5, shatter: '$shatter', knock: 1, vfx: V.dark(200, 170) }, { at: 6.4, do: 'shake', power: 6, ms: 300 }] },
            fsFeatherVeil: { name: '깃털 장막', slot: 'body', cd: 14, icon: 'shield', color: '#7864a0', target: 'self', clip: 'cast',
                desc: '4초간 받는 피해 -60% — 끝날 때 깃털이 터져 둘레 피해',
                steps: [{ do: 'buff', key: 'featherVeil', sec: 4, mods: { def: 0.6, onEnd: { do: 'hit', pick: 'all', range: 180, dmg: 1.5, knock: 0.8, vfx: V.dark(200, 130) } }, vfx: V.dark(200, 200, { dur: 0.8 }) }] },
            fsSwanSpin: { name: '백조 회전', slot: 'arm', cd: 8, icon: 'whirl', color: '#7864a0', target: 'enemy', range: 200, clip: 'spin', p: { dist: 160 },
                desc: '회전하며 앞으로 미끄러져 지나간 적 베기 + 냉기 2',
                steps: [{ at: 0.25, do: 'blink', dist: '$dist', dmg: 1.3, status: { chill: 2 }, vfx: V.slash(160, 150) }] }
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
        leg: { name: '서리 왕좌 구두', look: '수정 왕좌 장식 구두', desc: '겨울의 심장: 빙결된 적 하나마다 피해 +3% (최대 +30%)',
            passive: { name: '겨울의 심장', desc: '빙결된 적 하나마다 주는 피해 +3% (최대 +30%)', perFrozen: { dmg: 0.03, max: 0.3 } } },
        skills: {
            fsEternalWinter: { name: '영겁의 겨울', slot: 'head', ult: true, cd: 0, icon: 'snow', color: '#c8f0ff', target: 'enemy', range: 600, clip: 'raise', sfx: 'frost_blizzard', p: { gap: 3 },
                desc: '12초간 겨울 왕국 — 모든 적 느려짐, 3초마다 냉기 파도(냉기 2), 끝날 때 얼은 적 모두 깨짐',
                steps: [{ at: 0.4, do: 'custom', fn: eternalWinter, sec: 12, gap: '$gap', dmg: 2.5 }, { at: 0.4, do: 'fx', x: 260, b: 320, vfx: V.motes(SNOW, 30), repeat: 24, repeatGap: 0.5 }] },
            fsSnowBarrier: { name: '눈꽃 결계', slot: 'body', cd: 15, icon: 'icecage', color: '#c8f0ff', target: 'self', clip: 'cast',
                desc: '6초간 앞에 눈꽃 결계 — 안의 적은 공격 못 함, 나 받는 피해 -30%',
                steps: [{ do: 'buff', key: 'snowBarrier', sec: 6, mods: { def: 0.3 } },
                    { at: 0.4, do: 'zone', tag: 'barrier', x: 0, w: 260, sec: 6, status: { stun: 0.6 }, every: 0.5, puff: V.ice(0, 110, { dur: 0.6 }), puffEvery: 0.25 }] },
            fsIceStar: { name: '얼음 별', slot: 'arm', cd: 9, icon: 'snow', color: '#c8f0ff', target: 'enemy', range: 380, clip: 'cast', p: { split: 0 },
                desc: '도는 얼음 별이 앞으로 날아가 냉기 3 — 끝에서 폭발 (4부위: 작은 별 4개로)',
                steps: [{ at: 0.45, do: 'wave', from: 0, speed: 420, dist: 380, w: 45, every: 0.3, dmg: 0.6, status: { chill: 3 }, vfx: V.ice(0, 100, { dur: 0.3 }), vfxEvery: 0.07, b: 120 },
                    { at: 1.4, do: 'rain', count: 1, x: [360, 380], aim: false, jitter: 0, radius: 90, dmg: 1.5, status: { chill: 2 }, vfx: V.shatter(0, 200) },
                    { at: 1.5, do: 'rain', count: '$split', x: [260, 460], aim: false, radius: 60, dmg: 0.8, status: { chill: 1 }, vfx: V.ice(0, 110), every: 0.08, when: b => (b.kitPatch?.fsIceStar?.split || 0) > 0 }] }
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
                    { at: 1.0, do: 'hit', pick: 'all', range: 450, dmg: 3, knock: 1.2, status: { chill: 2 } }, { at: 1.0, do: 'shake', power: 8, ms: 400 },
                    { at: 1.0, do: 'zone', tag: 'moon', field: 'moon', x: 60, w: 400, sec: 8, dps: 0.3, status: { chill: 1 }, every: 1 },
                    { at: 1.0, do: 'buff', key: 'moonLight', sec: 8, mods: { atkSpd: 0.3 } }] },
            fsMoonBlessing: { name: '달의 가호', slot: 'body', cd: 15, icon: 'shield', color: '#dce6ff', target: 'self', clip: 'cast',
                desc: '6초간 보호막 (최대 체력 30%) + 필살기 게이지 초당 +2%',
                steps: [{ do: 'shield', ratio: 0.3, sec: 6, color: MOON }, { at: 1, do: 'gauge', add: 0.02, repeat: 6, repeatGap: 1 }, { do: 'fx', on: 'self', x: 30, vfx: V.gold(200, 180) }] },
            fsMoonSlash: { name: '월광 일섬', slot: 'arm', cd: 9, icon: 'sword', color: '#dce6ff', target: 'enemy', range: 300, clip: 'dashSlash',
                desc: '앞으로 베고 지나감 → 1초 뒤 같은 자리에 달빛 폭발',
                steps: [{ at: 0.2, do: 'blink', dist: 220, dmg: 1.5, status: { chill: 1 }, vfx: V.xcut(40, 150) },
                    { at: 1.2, do: 'hit', pick: 'all', range: 160, dmg: 1.5, knock: 0.8, vfx: V.gold(200, 150) }] }
        }
    }
]);
