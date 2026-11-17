/* ==========================================================================
   PROJECT: MAD OVERLORD // 뒤틀린 인형사 세트 9개 (Q-009 · D-071 — 1차 계획 레어 ①② · 유니크 ① = MD/새캐릭터_파츠확장_기획안.md 4장,
   2차 6세트 = MD/파츠확장_2차_기획안.md 5-8)
   레어 ① 태엽 장난감 공방(a) · 레어 ② 인형극 연출가(b) · 유니크 ① 영원한 가족(u) · 레어 ③ 오르골 소녀(c) · 레어 ④ 종이 인형 마술사(d)
   · 유니크 ② 그림자 인형극(v) · 유니크 ③ 도자기 인형 여왕(w) · 레전더리 ① 꼭두각시 황제(l) · 레전더리 ② 태엽 시계탑의 마녀(m)
   꼭두각시 = status puppet (battle/doll.js tickDoll — 옆 적을 때림, 시간 + 값 puppetSec, 피해 + 값 puppetDmg). 토끼 인형 = spawnAllyMinion 'rabbit'.
   새 캐릭터 세트는 강화 그림 + 세트 색. 동작은 rig/dollRig.js (throw·spin은 2차에서 더함)
   ========================================================================== */

import { packOf, V } from './common.js';
import { kitHit, pickTargets, enemiesNear, runKitStep } from '../skillKit_v2.js';
import { aimAt } from '../bases_v2.js';
import { FOOT_B, DOLL } from '../battle/tuning.js';

const THREAD = '70, 220, 200', TOY = '255, 200, 120', MUSIC = '255, 170, 210', PAPER = '245, 245, 240', SHADOW = '150, 110, 200', PORCELAIN = '255, 230, 170', EMPEROR = '255, 210, 90', CLOCK = '200, 150, 255';
const TOY_TINT = 'sepia(0.3) saturate(2.2) hue-rotate(-20deg) brightness(1.2)';
const isUnit = e => !e.isBuilding && !e.isBarricade;
const onScreen = b => b.enemies.filter(e => isUnit(e) && e.x - b.monsterX < 1000);
const rabbit = (b, x) => b.spawnAllyMinion?.(x, 'rabbit', { hp: DOLL.rabbitHp, dps: DOLL.rabbitDps, speed: DOLL.rabbitSpeed });

// 커튼콜: 화면 보통 적 절반을 sec초 꼭두각시로, 끝날 때 꼭두각시가 인사하며 터짐
function curtainCall(b, ctx, s) {
    const list = onScreen(b).filter(e => !e.boss);
    const chosen = list.slice(0, Math.ceil(list.length / 2));
    chosen.forEach((e, i) => b.schedule(i * 0.06, () => { if (b.enemies.includes(e)) { kitHit(b, e, s.hitDmg, { knock: 0 }); b.kitStatus(e, { puppet: s.sec }); } }));
    b.fx.play(V.cleave(-20, 420, { dur: 0.8 }), b.frontX() + 250, 330);
    b.schedule(s.sec, () => chosen.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(V.blast(150, 120), aimAt(e).x, aimAt(e).b);
        enemiesNear(b, aimAt(e).x, 80).forEach(o => kitHit(b, o, s.dmg, { knock: 0.6 }));
    }));
}

// 낚아채기: 가장 강한 적(엘리트 먼저) 하나를 sec초 꼭두각시로
function snatch(b, ctx, s) {
    const t = pickTargets(b, 'strongest', 1, b.playerRange + 300)[0];
    if (!t) return;
    b.fx.play(V.chainBolt(THREAD), b.monsterX + 60, 200, { to: [aimAt(t).x, aimAt(t).b + 40] });
    b.kitStatus(t, { puppet: s.sec });
    kitHit(b, t, s.dmg, { knock: 0 });
}

// 실 감옥: 적 n명을 실로 sec초 매달았다가 바닥에 내리꽂음 (범위 피해)
function stringPrison(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, b.playerRange + 120);
    list.forEach(e => { b.kitStatus(e, { stun: s.sec + 0.1 }); b.fx.play(V.chainBolt(THREAD), aimAt(e).x, 470, { to: [aimAt(e).x, aimAt(e).b] }); });
    b.schedule(s.sec, () => list.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(V.impact(150, 140), aimAt(e).x, FOOT_B);
        enemiesNear(b, aimAt(e).x, 90).forEach(o => kitHit(b, o, s.dmg, { knock: 0.8 }));
    }));
}

// 종이 분신: 맞으면 찢어지는 종이 인형 n기 (적이 노림), 찢어질 때 작은 폭발
function paperClones(b, ctx, s) {
    for (let i = 0; i < s.n; i++) {
        b.schedule(i * 0.12, () => {
            if (!b.isActive) return;
            const a = b.spawnKitAlly(b.monsterX + 70 + i * 35, { art: 'rabbit', scale: 0.7, filter: 'grayscale(1) brightness(1.8) contrast(1.2)', hp: 0.06, dps: 0.05, speed: 0.2, life: 6, blast: { dmg: 1, radius: 70 }, color: '#f5f5f0' });
            if (a) a.kitTag = 'paper';
        });
    }
}

// 그림자 연극: sec초 동안 1초마다 적마다 자기 그림자에게 맞음 (자기 공격력만큼)
function shadowPlay(b, ctx, s) {
    for (let t = 0; t < s.sec; t += 1) {
        b.schedule(t, () => {
            if (!b.isActive) return;
            onScreen(b).forEach((e, i) => {
                if (i < 8) b.fx.play(V.sheet('shadow_play', 120, { dur: 0.6 }), aimAt(e).x - 20, aimAt(e).b);
                b.dealDamageToEnemy(e, (e.dps || 10) * s.mul + b.unit() * 0.2, false, { dot: true });
            });
        });
    }
}

// 티 파티: 보통 적 n명을 찻잔 의자에 sec초 앉힘(멈춤) → 찻잔이 깨지며 폭발
function teaParty(b, ctx, s) {
    const list = pickTargets(b, 'nearest', s.n, b.playerRange + 300).filter(e => isUnit(e) && !e.boss);
    list.forEach(e => { b.kitStatus(e, { stun: s.sec }); b.fx.play(V.sheet('teacup_burst', 120, { anchorY: 0.85, dur: 0.6 }), aimAt(e).x, FOOT_B); });
    b.schedule(s.sec, () => list.forEach(e => {
        if (!b.enemies.includes(e)) return;
        b.fx.play(V.shatter(30, 150), aimAt(e).x, FOOT_B);
        enemiesNear(b, aimAt(e).x, 80).forEach(o => kitHit(b, o, s.dmg * (1 + s.mul), { knock: 0.8 }));
    }));
}

// 황금 실 표식: 같은 적을 need번 맞히면 2초 꼭두각시 (2부위: 3 → 2번)
function goldThread(b, e) {
    if (!isUnit(e) || e.boss) return;
    const need = 3 + (b.kitPatch?._threadMark?.n || 0);
    e.kitMarks = (e.kitMarks || 0) + 1;
    if (e.kitMarks >= need) { e.kitMarks = 0; b.kitStatus(e, { puppet: 2 }); }
}

// 시간 되감기: 3초 전 체력으로 (더 높을 때만) + 팔 스킬 쿨다운 초기화 (4부위: 몸통도)
function rewind(b) {
    const log = b.kitHpLog || [];
    const past = log.length >= 6 ? log[log.length - 6] : log[0];
    if (past > b.playerHp) b.kitHeal(past - b.playerHp);
    b.skillCd.arm = 0;
    if (b.kitFlag('rewindBody')) b.schedule(0.05, () => { b.skillCd.body = 0; });
    b.fx.play(V.portal(260, 220, { dur: 0.8 }), b.monsterX + 35, FOOT_B);
    b.createDamagePopup(b.monsterX + 40, 220, '시간 되감기!', false);
}

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
                steps: [{ at: 0.45, do: 'summon', n: 6, gap: 0.15, spread: 26, art: 'soldier', scale: 0.55, filter: TOY_TINT, hp: 0.04, dps: 0.25, speed: 1.3, life: 5, blast: { dmg: 2, radius: 100 }, color: '#ffc878', vfx: V.blast(40, 70) }] },
            dlWindUp: { name: '태엽 감기', slot: 'body', cd: 14, icon: 'gear', color: '#ffc878', target: 'self', clip: 'cast',
                desc: '6초간 아군 공격 +50%, 스킬 쿨다운 2배 빨리',
                steps: [{ do: 'buff', key: 'windUp', sec: 6, mods: { allyDmg: 0.5, cdRate: 1 }, vfx: V.gold(30, 180) }] },
            dlJackBox: { name: '깜짝 상자 포탄', slot: 'arm', cd: 9, icon: 'missile', color: '#ffc878', target: 'enemy', range: 320, clip: 'throw', p: { n: 3 },
                desc: '큰 포탄 — 터지며 작은 장난감 3개가 흩어져 2차 폭발',
                steps: [{ at: 0.35, do: 'rain', count: 1, radius: 90, dmg: 1.8, delay: 0.4, vfx: V.blast(40, 180), shake: 3 },
                    { at: 1.0, do: 'rain', count: '$n', every: 0.08, radius: 50, dmg: 0.7, vfx: V.blast(80, 90) }] }
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
                steps: [{ at: 0.5, do: 'custom', fn: curtainCall, sec: 8, dmg: 1.5, hitDmg: 0.6 }] },
            dlStageCurtain: { name: '무대 막', slot: 'body', cd: 15, icon: 'fort', color: '#46dcc8', target: 'self', clip: 'cast',
                desc: '앞쪽에 무대 막 4초 — 적이 넘어오지 못하고 원거리 공격을 막음',
                steps: [{ at: 0.45, do: 'zone', tag: 'curtain', wall: true, x: 30, w: 46, sec: 4, puff: V.cleave(-20, 150, { dur: 0.5 }), puffEvery: 0.25 },
                    { at: 0.45, do: 'buff', key: 'curtain', sec: 4, mods: { flags: ['projBlock'] } }, { at: 0.45, do: 'shake', power: 3, ms: 150 }] },
            dlSnatch: { name: '낚아채기', slot: 'arm', cd: 9, icon: 'puppet', color: '#46dcc8', target: 'enemy', range: 300, clip: 'strings',
                desc: '가장 강한 적 하나(엘리트 먼저)를 4초 꼭두각시로 — 그 적이 주변 적을 공격',
                steps: [{ at: 0.5, do: 'custom', fn: snatch, sec: 4, dmg: 1.6 }] }
        }
    },

    // ---- 유니크 ① 영원한 가족 (1차 계획) — 거대 곰 인형 '아빠 곰'과 인형 가족 ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '영원한 가족', style: 'tank', tint: 'sepia(0.6) saturate(1.2) brightness(1.25) drop-shadow(0 0 5px rgba(255, 230, 170, 0.8))',
        bonus: { 2: '꼭두각시 시간 +2초', 4: '아빠 곰과 함께 있을 때 쓰러진 적은 토끼 인형으로 (최대 3)' },
        kit: { 2: { mods: { puppetSec: 2 } }, 4: { on: [{ when: 'kill', flag: 'papaBear', max: 3, fn: (b, info) => { if (info.enemy) rabbit(b, info.enemy.x); } }] } },
        head: { name: '곰 귀 보닛', look: '곰 귀가 달린 크림색 보닛, 단추 장식', skill: 'dlPapaBear', desc: '필살기 아빠 곰: 거대한 곰 인형이 8초간 나타나 앞으로 걸으며 내려침 (범위 + 짧은 기절)', stats: { hp: 950, dps: 120, range: 30, speed: 10 } },
        body: { name: '인형 수선 앞치마', look: '바늘꽂이·실패·천 조각 앞치마', skill: 'dlRepair', desc: '인형 수선: 모든 아군 체력 전부 회복 + 6초간 받는 피해 -50%', stats: { hp: 2300, dps: 90, range: 0, speed: 10 } },
        arm: { name: '실 지휘봉', look: '끝에 실이 수십 가닥 매달린 지휘봉', skill: 'dlStringPrison', desc: '기본 공격 실 채찍 (15% 확률로 보통 적 2초 꼭두각시) · 실 감옥: 적 3명을 3초 매달았다 내리꽂음', stats: { hp: 600, dps: 560, range: 260, speed: 0 },
            kitAttack: { kind: 'melee', vfx: V.slash(130, 140, { dur: 0.3 }), splash: 70, splashMul: 0.5, onHit: (b, e) => { if (isUnit(e) && !e.boss && !e.elite && Math.random() < 0.15) b.kitStatus(e, { puppet: 2 }); } } },
        leg: { name: '인형 장식 부츠', look: '발목에 작은 인형들이 매달린 부츠', desc: '가족 행렬: 내 아군·꼭두각시 하나마다 받는 피해 -4% (최대 -20%)', stats: { hp: 950, dps: 70, range: 0, speed: 120 },
            passive: { name: '가족 행렬', desc: '내 아군·꼭두각시 하나마다 받는 피해 -4% (최대 -20%)', perUnit: { def: 0.04, max: 0.2 } } },
        skills: {
            dlPapaBear: { name: '아빠 곰', slot: 'head', ult: true, cd: 0, icon: 'rabbit', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '거대한 곰 인형이 8초간 나타나 앞으로 걸으며 내려침 (범위 + 짧은 기절)',
                steps: [{ at: 0.45, do: 'buff', key: 'papaBear', sec: 8, mods: { flags: ['papaBear'] } },
                    { at: 0.45, do: 'summon', n: 1, x: 90, art: 'rabbit', scale: 2.2, filter: 'sepia(0.8) saturate(1.3) hue-rotate(-10deg) brightness(1.1)', hp: 0.7, dps: 1.2, speed: 0.45, life: 8, hit: { stun: 0.4 }, color: '#ffe6aa', label: '아빠 곰!', blast: { dmg: 2.5, radius: 140 }, vfx: V.impact(30, 220) }] },
            dlRepair: { name: '인형 수선', slot: 'body', cd: 14, icon: 'stitch', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '모든 아군 체력 전부 회복 + 6초간 받는 피해 -50%',
                steps: [{ at: 0.45, do: 'heal', allies: true, allyRatio: 1 }, { at: 0.45, do: 'buff', key: 'repair', sec: 6, mods: { def: 0.5, allyDef: 0.5 }, vfx: V.motes(THREAD, 14) }] },
            dlStringPrison: { name: '실 감옥', slot: 'arm', cd: 9, icon: 'puppet', color: '#ffe6aa', target: 'enemy', range: 120, clip: 'strings',
                desc: '적 3명을 실로 3초 매달았다가 바닥에 내리꽂음 (범위 피해)',
                steps: [{ at: 0.5, do: 'custom', fn: stringPrison, n: 3, sec: 3, dmg: 1.6 }] }
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
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0, status: { sleep: '$sec' } }, { at: 0.45, do: 'fx', x: 220, b: 300, vfx: V.sheet('music_box', 320, { dur: 1.0 }) }] },
            dlCarousel: { name: '회전 무대', slot: 'body', cd: 13, icon: 'whirl', color: '#ffaad2', target: 'self', clip: 'spin',
                desc: '4초간 빙글 돌며 둘레 적을 밀치고 매초 피해',
                steps: [{ at: 0.15, do: 'zone', follow: true, x: -90, w: 260, sec: 4, dps: 0.5, puff: V.motes(MUSIC, 8), puffEvery: 0.15, puffB: 80 },
                    { at: 0.15, do: 'push', range: 160, dist: 45, dmg: 0.3, repeat: 4, repeatGap: 1 }] },
            dlBallerina: { name: '발레리나 투척', slot: 'arm', cd: 8, icon: 'scissors', color: '#ffaad2', target: 'enemy', range: 300, clip: 'throw',
                desc: '작은 발레리나 인형이 적 사이를 돌며 벰 (갔다 돌아옴)',
                steps: [{ at: 0.35, do: 'wave', from: 0, speed: 300, dist: 300, w: 40, every: 0.3, dmg: 0.5, back: true, vfx: V.slash(-60, 100, { dur: 0.25 }), vfxEvery: 0.08, b: 110 }] }
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
                steps: [{ at: 0.45, do: 'rain', count: 40, every: 0.15, x: [30, 500], radius: 40, dmg: 0.35, vfx: V.sheet('paper_crane', 110, { dur: 0.5 }), vfxB: FOOT_B + 60 }] },
            dlPaperClones: { name: '종이 분신', slot: 'body', cd: 14, icon: 'clone', color: '#f5f5f0', target: 'self', clip: 'cast',
                desc: '종이 인형 3기 — 적이 노림, 6초 뒤나 맞으면 찢어지며 작은 폭발',
                steps: [{ at: 0.45, do: 'custom', fn: paperClones, n: 3 }] },
            dlPaperBlades: { name: '종이 칼날', slot: 'arm', cd: 8, icon: 'scissors', color: '#f5f5f0', target: 'enemy', range: 360, clip: 'throw',
                desc: '휘어 날아가는 종이 칼날 4장 — 관통',
                steps: [{ at: 0.35, do: 'wave', from: 0, speed: 640, dist: 380, w: 35, dmg: 0.7, vfx: V.slash(0, 100, { dur: 0.25, hue: 0 }), vfxEvery: 0.05, b: 120, repeat: 4, repeatGap: 0.1 }] }
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
                steps: [{ at: 0.5, do: 'buff', key: 'shadowPlay', sec: '$sec', mods: { flags: ['shadowPlay'] } }, { at: 0.5, do: 'custom', fn: shadowPlay, sec: '$sec', mul: 1 }] },
            dlCandleStage: { name: '촛불 무대', slot: 'body', cd: 14, icon: 'fire', color: '#966ec8', target: 'self', clip: 'cast',
                desc: '6초간 촛불 원 — 아군 공격 +40%, 안의 적 감속',
                steps: [{ at: 0.45, do: 'zone', tag: 'candleStage', x: -120, w: 320, sec: 6, slow: true, puff: V.embers(PORCELAIN), puffEvery: 0.25, puffB: 20 },
                    { at: 0.45, do: 'buff', key: 'candleStage', sec: 6, mods: { allyDmg: 0.4 } }] },
            dlShadowCrows: { name: '그림자 까마귀', slot: 'arm', cd: 9, icon: 'wave', color: '#966ec8', target: 'enemy', range: 400, clip: 'throw',
                desc: '까마귀 5마리가 적을 쪼고 2초 눈가림 (주는 피해 -70%)',
                steps: [{ at: 0.35, do: 'hit', pick: 'random', n: 5, range: 400, dmg: 0.7, status: { weak: [2, 0.7] }, vfx: V.dark(0, 90) }] }
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
                steps: [{ at: 0.45, do: 'custom', fn: teaParty, n: '$n', sec: 6, dmg: 1.8, mul: '$mul' }] },
            dlGoldMend: { name: '금 이음', slot: 'body', cd: 14, icon: 'stitch', color: '#ffe6aa', target: 'self', clip: 'cast',
                desc: '4초에 걸쳐 체력 8% 회복 + 보호막 15%',
                steps: [{ do: 'heal', over: [4, 0.02] }, { do: 'shield', ratio: 0.15, sec: 6, color: PORCELAIN }, { do: 'fx', on: 'self', x: 30, vfx: V.gold(0, 200) }] },
            dlHotTea: { name: '뜨거운 차', slot: 'arm', cd: 8, icon: 'fire', color: '#ffe6aa', target: 'enemy', range: 200, clip: 'xcut',
                desc: '부채꼴로 뜨거운 차를 뿌림 — 화상 4초',
                steps: [{ at: 0.4, do: 'hit', pick: 'all', range: 200, dmg: 0.8, status: { burn: [4, 0.3] }, vfx: V.water(-160, 110) }] }
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
                steps: [{ at: 0.5, do: 'buff', key: 'throne', sec: '$sec', mods: { def: 0.5 }, vfx: V.sheet('throne_thread', 300, { anchorY: 0.92, dur: 0.9 }) },
                    { at: 0.6, do: 'pull', pick: 'strongest', n: 1, range: 500, to: 40, sec: 0.3, dmg: 2.5, status: { stun: 1 }, vfx: V.chainBolt(EMPEROR), repeat: '$sec', repeatGap: 1 }] },
            dlLoyalty: { name: '충성 서약', slot: 'body', cd: 15, icon: 'puppet', color: '#ffd25a', target: 'self', clip: 'cast',
                desc: '8초간 아군·꼭두각시 피해 +60%, 꼭두각시 시간 +3초',
                steps: [{ do: 'buff', key: 'loyalty', sec: 8, mods: { allyDmg: 0.6, puppetDmg: 0.6, puppetSec: 3 }, vfx: V.gold(0, 200) }] },
            dlThreadNet: { name: '실의 그물', slot: 'arm', cd: 9, icon: 'net', color: '#ffd25a', target: 'enemy', range: 320, clip: 'strings',
                desc: '실 그물로 적 5명을 2초 매달아 한데 모음',
                steps: [{ at: 0.5, do: 'hit', pick: 'nearest', n: 5, range: 320, dmg: 1, status: { stun: 2 }, vfx: V.chainBolt(EMPEROR) },
                    { at: 0.55, do: 'zone', tag: 'net', x: 60, w: 220, sec: 0.8, pull: 260 }] }
        }
    },

    // ---- 레전더리 ② 태엽 시계탑의 마녀 (균형) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '태엽 시계탑의 마녀', style: 'balance', tint: 'hue-rotate(100deg) saturate(1.4) brightness(1.05) drop-shadow(0 0 7px rgba(200, 150, 255, 0.85))',
        bonus: { 2: '자정의 종 폭발 범위 +50%', 4: '시간 되감기가 몸통 스킬도 초기화' },
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
                    { at: 0.45, do: 'fx', x: 220, b: 300, vfx: V.ring(CLOCK, 260), repeat: 12, repeatGap: 1 },
                    { at: 11.6, do: 'hit', pick: 'all', range: '$range', dmg: 3, knock: 1, vfx: V.portal(260, 200) }, { at: 11.6, do: 'shake', power: 7, ms: 300 }] },
            dlRewind: { name: '시간 되감기', slot: 'body', cd: 16, icon: 'speed', color: '#c896ff', target: 'self', clip: 'cast',
                desc: '3초 전 체력으로 되돌림 + 팔 스킬 쿨다운 초기화 (4부위: 몸통도)',
                steps: [{ at: 0.45, do: 'custom', fn: rewind }] },
            dlClockHands: { name: '시계바늘 회전', slot: 'arm', cd: 9, icon: 'whirl', color: '#c896ff', target: 'enemy', range: 220, clip: 'spin',
                desc: '거대 시계바늘 둘이 앞에서 3초 회전 — 여러 번 피해 + 짧은 멈춤',
                steps: [{ at: 0.15, do: 'zone', follow: true, x: 0, w: 220, sec: 3, dps: 1, status: { stun: 0.2 }, every: 0.5, puff: V.slash(260, 120, { dur: 0.3 }), puffEvery: 0.12, puffB: 70 }] }
        }
    }
]);
