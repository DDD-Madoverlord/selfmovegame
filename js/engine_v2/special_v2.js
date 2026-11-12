/* ==========================================================================
   PROJECT: MAD OVERLORD // 스페셜맵 규칙 (D-119 9번, Q-044 임시: 모드마다 하루 3회)
   두 모드, 노말 1-B를 깨면 열림. 하루 횟수는 한국 시간 0시에 다시 채움 (progressSpecial_v2.js).
     보스 러시: 단계 1~30. 한 판 = 공개된 구역 보스 하나(돌아가며) + 호위 조금, 문(아주 약한 최종 거점)을 부수면 보스 등장,
               보스 처치 = 승리, 제한 90초. 세기: 1~9 노말에서 단계마다 +8%, 10단계 하드 · 20단계 헬 · 30단계 나이트메어부터 다시.
               이기면 승급석(5번 파츠 성장) 2 · 10단계부터 3 · 20단계부터 4 + DM + 스킬 코어, 5단계마다 처음 깨면 조각 10
     파괴 작전: 60초 동안 전장에 놓인 물체(보급 상자 · 감시탑 · 발전기 · 동상)를 최대한 부숨, 방해하는 적 조금.
               점수 = 부순 물체 값 합 + 연속 파괴 보너스 → 등급 S·A·B·C, 등급별 조각 + DM. 주마다 물체 배치가 바뀜
   전투는 보통 스테이지와 같은 모양의 객체를 받아 돌림 — stage.special = 'boss' | 'smash' (battle_v2.js)
   ========================================================================== */

import { STAGES } from './stages_v2.js';
import { stageFor } from './difficulty_v2.js';
import { isZoneReleased } from './contentSchedule_v2.js';
import { kstWeekKey } from './kstTime_v2.js';

export const SPECIAL = {
    unlockStage: '1-B',
    daily: { boss: 3, smash: 3 },
    boss: {
        steps: 30, timeLimit: 90, starTime: 60, grow: 0.08,
        bands: [{ from: 1, diff: 'normal' }, { from: 10, diff: 'hard' }, { from: 20, diff: 'hell' }, { from: 30, diff: 'nightmare' }],
        escort: { spawnMul: 1.6, max: 3 },   // 호위: 소환 간격 ×1.6 · 최대 3마리
        gateHp: 100                           // 보스가 숨어 있는 문 (금방 부서짐)
    },
    smash: {
        sec: 60,
        // 물체: 체력(적 체력 배율 곱하기 전), 점수, 그림(거점 그림 재사용)
        objects: {
            crate: { name: '보급 상자', hp: 380, score: 100, art: 'barricade' },
            tower: { name: '감시탑', hp: 1200, score: 400, art: 'tower' },
            generator: { name: '발전기', hp: 800, score: 250, art: 'bunker' },
            statue: { name: '동상', hp: 2000, score: 700, art: 'tower' }
        },
        // 주마다 바뀌는 배치 (x = 진격 거리 m) — 넓게 흩어진 상자 주 = 빠른 근거리 유리, 멀리 높은 감시탑 주 = 원거리 유리 (13번)
        layouts: [
            { id: 'scatter', name: '흩어진 보급품', items: [['crate', 40], ['crate', 90], ['crate', 140], ['generator', 200], ['crate', 260], ['crate', 320], ['statue', 420], ['crate', 480], ['crate', 540], ['generator', 620]] },
            { id: 'towers', name: '감시탑 줄', items: [['tower', 60], ['crate', 120], ['tower', 200], ['tower', 300], ['crate', 360], ['tower', 440], ['statue', 560], ['tower', 640]] },
            { id: 'plant', name: '발전 시설', items: [['generator', 50], ['generator', 130], ['crate', 180], ['generator', 240], ['statue', 330], ['generator', 420], ['crate', 470], ['generator', 540]] }
        ],
        comboSec: 3, comboBonus: 0.2,   // 3초 안에 다음 물체를 부수면 +20%씩 (최대 +100%)
        grades: [{ id: 'S', min: 3000 }, { id: 'A', min: 2000 }, { id: 'B', min: 1000 }, { id: 'C', min: 0 }],
        reward: { S: { shards: 12, dm: 6000 }, A: { shards: 8, dm: 4000 }, B: { shards: 5, dm: 2500 }, C: { shards: 3, dm: 1500 } },
        enemy: { spawnMul: 2, max: 3 }
    }
};

/** 보스 러시에 나오는 구역 (공개된 구역만 — 숨김 그룹 구역은 빠짐) */
export function bossZones(now = Date.now()) {
    return [...new Set(STAGES.map(s => s.zone))].filter(z => isZoneReleased(z, now));
}

/** 단계 → 난이도 줄 { diff, from } */
export function bandOf(step) {
    return [...SPECIAL.boss.bands].reverse().find(b => step >= b.from);
}

/** 단계 보상 (이기면) */
export function bossReward(step) {
    return { stones: step >= 20 ? 4 : step >= 10 ? 3 : 2, dm: 2000 + 400 * step, cores: 3 + Math.floor(step / 5), shards: step % 5 === 0 ? 10 : 0 };
}

const r2 = v => Math.round(v * 100) / 100;

/** 보스 러시 단계의 전투 스테이지 (보통 스테이지 모양) */
export function bossStage(step, now = Date.now()) {
    const zones = bossZones(now);
    const zone = zones[(step - 1) % zones.length];
    const base = STAGES.find(s => s.id === `${zone}-B`);
    const band = bandOf(step);
    const s = stageFor(base, band.diff, now);
    const k = 1 + SPECIAL.boss.grow * (step - band.from);
    const B = SPECIAL.boss;
    return {
        ...s,
        id: `SP-boss-${step}`, special: 'boss', specialStep: step, specialZone: zone,
        name: `보스 러시 ${step}단계`, desc: `${zone}구역 보스 — 문을 부수면 나타남, 쓰러뜨리면 승리`,
        timeLimit: B.timeLimit, starTime: B.starTime, distance: 60, midAt: 1e9, finalAt: 20,
        enemy: { ...s.enemy, hp: r2(s.enemy.hp * k), dps: r2(s.enemy.dps * k), spawn: r2(s.enemy.spawn * B.escort.spawnMul), max: B.escort.max },
        base: { mid: 0, final: B.gateHp },
        reward: { kill: s.reward.kill, mid: 0, final: 0 },
        boss: { ...(s.boss || {}), afterBase: true, gate: '보스의 문' },
        difficulty: band.diff
    };
}

/** 이번 주 파괴 작전 배치 */
export function smashLayout(now = Date.now()) {
    const L = SPECIAL.smash.layouts;
    const week = Number(kstWeekKey(now).replace(/\D/g, '')) || 0;
    return L[week % L.length];
}

/** 점수 → 등급 */
export function smashGrade(score) {
    return SPECIAL.smash.grades.find(g => score >= g.min).id;
}

/** 파괴 작전 전투 스테이지 — 구역 1 배경, 노말 1-10 세기의 적 조금, 거점 없음 */
export function smashStage(now = Date.now()) {
    const base = STAGES.find(s => s.id === '1-10');
    const lay = smashLayout(now);
    const S = SPECIAL.smash;
    return {
        ...base,
        id: 'SP-smash', special: 'smash', specialLayout: lay.id,
        name: `파괴 작전 · ${lay.name}`, desc: `${S.sec}초 동안 물체를 최대한 부숴라`,
        timeLimit: S.sec, starTime: S.sec, distance: 700, midAt: 1e9, finalAt: 1e9,
        enemy: { ...base.enemy, spawn: r2(base.enemy.spawn * S.enemy.spawnMul), max: S.enemy.max },
        base: { mid: 0, final: 0 }, reward: { kill: base.reward.kill, mid: 0, final: 0 }, boss: null,
        smashItems: lay.items.map(([type, at], i) => ({ id: `obj${i}`, type, at, ...S.objects[type] }))
    };
}
