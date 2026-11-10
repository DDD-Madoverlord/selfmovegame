/* ==========================================================================
   PROJECT: MAD OVERLORD // 오버로드의 탑 (D-119 12번 1인 컨텐츠 안 A · D-126, Q-047 임시)
   끝없는 층. 노말 1-B를 깨면 열림(스페셜맵과 같이), 횟수 제한 없음, 층은 한 번 깨면 끝(다음은 그 위 층).
     세기  : 기준 판(보통 층 1-5 · 보스 층 1-B, 노말)의 적·거점 수치 × 1.06^(층−1), 50층부터는 ×1.03씩 (높은 층 숫자가 너무 커지지 않게)
     구성  : 공개된 구역을 돌아가며 그 구역 판의 적 종류·배경·보스를 씀 (수치만 위 곡선) — 숨김 그룹 구역은 빠짐
     변이  : 5층마다 나이트메어 전장 변이가 하나씩 쌓임(5층 1개 … 30층부터 6개 모두), 시작 변이는 이번 주 변이부터 차례로
     보스  : 10층마다 보스 층 (그 구역 보스전)
     보상  : 층을 처음 깨면 DM, 5층마다 스킬 코어, 10층마다 조각 + 승급석 · 주간 최고 층 기록
   전투는 스페셜맵 판과 같은 모양 — stage.special = 'tower', stage.mutators[] (battle/growth.js combineMutators)
   ========================================================================== */

import { STAGES } from './stages_v2.js';
import { MUTATORS, MUTATOR_ORDER, weeklyMutator } from './growth_v2.js';
import { isZoneReleased } from './contentSchedule_v2.js';

export const TOWER = {
    unlockStage: '1-B',
    grow: 0.06, growLate: 0.03, lateFrom: 50,
    mutatorEvery: 5, bossEvery: 10,
    ref: { floor: '1-5', boss: '1-B' },
    eliteUp: 0.004, eliteMax: 0.4   // 층마다 엘리트 비율 +0.4%p (최대 40%)
};

const r2 = v => Math.round(v * 100) / 100;
const roundTo = (v, step) => Math.round(v / step) * step;
const stageById = id => STAGES.find(s => s.id === id);

/** 탑에 나오는 구역 (공개된 구역만) */
export function towerZones(now = Date.now()) {
    return [...new Set(STAGES.map(s => s.zone))].filter(z => isZoneReleased(z, now));
}

/** 층 배율: 1.06^(층−1), 50층부터 1.03씩 */
export function towerMul(floor) {
    const early = Math.min(floor, TOWER.lateFrom) - 1;
    const late = Math.max(0, floor - TOWER.lateFrom);
    return Math.pow(1 + TOWER.grow, early) * Math.pow(1 + TOWER.growLate, late);
}

export const isBossFloor = floor => floor % TOWER.bossEvery === 0;

/** 그 층에 쌓인 전장 변이 (5층마다 하나, 이번 주 변이부터 차례로) */
export function towerMutators(floor, now = Date.now()) {
    const n = Math.min(MUTATOR_ORDER.length, Math.floor(floor / TOWER.mutatorEvery));
    const start = MUTATOR_ORDER.indexOf(weeklyMutator(now));
    return Array.from({ length: n }, (_, i) => MUTATOR_ORDER[(start + i) % MUTATOR_ORDER.length]);
}

/** 층을 처음 깨면 받는 보상 */
export function towerReward(floor) {
    return {
        dm: 800 + 120 * floor,
        cores: floor % 5 === 0 ? 2 + Math.floor(floor / 10) : 0,
        shards: isBossFloor(floor) ? 8 : 0,
        stones: isBossFloor(floor) ? 2 + Math.floor(floor / 30) : 0
    };
}

/** 층의 전투 스테이지 (보통 스테이지 모양) */
export function towerStage(floor, now = Date.now()) {
    const zones = towerZones(now);
    const zone = zones[(floor - 1) % zones.length];
    const boss = isBossFloor(floor);
    const lap = Math.ceil(floor / zones.length);   // 구역을 한 바퀴 돌 때마다 그 구역의 다음 판 구성
    const comp = stageById(boss ? `${zone}-B` : `${zone}-${((lap - 1) % 10) + 1}`);
    const ref = stageById(boss ? TOWER.ref.boss : TOWER.ref.floor);
    const k = towerMul(floor);
    const muts = towerMutators(floor, now);
    const spawnMul = muts.reduce((m, id) => m * (MUTATORS[id].spawnMul || 1), 1);
    return {
        ...comp,
        id: `SP-tower-${floor}`, special: 'tower', specialStep: floor, specialZone: zone,
        name: `오버로드의 탑 ${floor}층`, desc: boss ? `${zone}구역 보스 층 — 보스를 쓰러뜨려라` : `${zone}구역 — 거점을 모두 부숴라`,
        difficulty: 'normal',
        enemy: { ...comp.enemy, hp: r2(ref.enemy.hp * k), dps: r2(ref.enemy.dps * k), spawn: r2(comp.enemy.spawn * spawnMul) },
        base: { mid: roundTo(ref.base.mid * k, 100), final: roundTo(ref.base.final * k, 100) },
        reward: { kill: ref.reward.kill, mid: 0, final: 0 },
        elite: Math.min(TOWER.eliteMax, r2((comp.elite || 0) + TOWER.eliteUp * floor)),
        mutators: muts, mutator: muts[0] || null
    };
}
