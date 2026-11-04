/* ==========================================================================
   PROJECT: MAD OVERLORD // 난이도 (v2, D-063) — 2026-10-09 회의 "디아블로식 4단계"
   노말 → 하드 → 헬 → 나이트메어. 앞 난이도의 마지막 스테이지(4-B)까지 깨면 다음 난이도가 열린다.
   같은 스테이지(stages_v2.js)를 배율만 바꿔 다시 쓴다: stageFor(stage, id)가 배율을 곱한 복사본을 돌려주고,
   전투는 그 복사본(b.stage)만 읽으므로 전투 코드는 난이도를 몰라도 된다.

   항목 (스테이지 값에 곱함)
     enemyHp / enemyDps : 적 체력·공격력 (보스·바리케이드·요새 사격 포함 — 모두 stage.enemy 배율을 씀)
     base     : 중간 요새·최종 기지 체력
     elite    : 엘리트로 나올 확률에 더함
     affixes  : 엘리트 속성 수 최소 (노말은 구역 1·2 = 1개, 구역 3·4 = 2개), affixesLate = 구역 3·4에서의 수
     bossHaste: 보스 기술 간격을 이 값으로 나눔 (경고 시간은 그대로) — 보스 종류 기술 + 구역 기믹(EMP·가스·악마기사)
     time     : 제한 시간·별 목표 시간
     reward   : DM 보상(처치·요새·기지)과 새 별 보너스
     maxLevel : 이 난이도가 열리면 파츠 강화 한도 (progress_v2.js maxLevel)
     mutators : 전장 변이 (나이트메어, 주마다 하나 — growth_v2.js MUTATORS, 효과는 battle/growth.js)
   배율은 tools/tests/balance_sim.py --diff=<id>로 재서 맞춘다 (MD/밸런스_기록.md "난이도").
   ========================================================================== */

import { STAGES } from './stages_v2.js';
import { MUTATORS, weeklyMutator } from './growth_v2.js';

export const DIFFICULTIES = [
    { id: 'normal', name: '노말', en: 'NORMAL', color: '120, 220, 140',
        enemyHp: 1, enemyDps: 1, base: 1, elite: 0, affixes: 0, bossHaste: 1, time: 1, reward: 1, maxLevel: 5 },
    { id: 'hard', name: '하드', en: 'HARD', color: '255, 176, 32',
        enemyHp: 1.4, enemyDps: 1.3, base: 1.3, elite: 0.05, affixes: 0, bossHaste: 1, time: 1.05, reward: 1.6, maxLevel: 7 },
    { id: 'hell', name: '헬', en: 'HELL', color: '255, 74, 58',
        enemyHp: 1.9, enemyDps: 1.6, base: 1.65, elite: 0.1, affixes: 2, bossHaste: 1, time: 1.1, reward: 2.4, maxLevel: 9 },
    { id: 'nightmare', name: '나이트메어', en: 'NIGHTMARE', color: '180, 92, 255',
        enemyHp: 2.5, enemyDps: 2, base: 2.1, elite: 0.15, affixes: 2, affixesLate: 3, bossHaste: 1.25, time: 1.2, reward: 3.5, maxLevel: 10,
        mutators: true }
];
export const DEFAULT_DIFFICULTY = 'normal';
/**
 * 다음 난이도를 여는 스테이지: 구역 4 보스전. 구역 5~8을 더하는 동안은 4-B 그대로 둔다 —
 * 마지막 스테이지로 옮기면 이미 연 난이도가 다시 잠김 (D-078 임의 결정, 구역이 다 들어오면 다시 정함)
 */
export const FINAL_STAGE_ID = '4-B';
if (!STAGES.some(s => s.id === FINAL_STAGE_ID)) throw new Error(`difficulty_v2: FINAL_STAGE_ID '${FINAL_STAGE_ID}' 스테이지가 없음`);

export function difficultyOf(id) {
    return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[0];
}

/** 열린 난이도: 노말 + 바로 앞 난이도의 마지막 스테이지를 깬 난이도 */
export function difficultyUnlocked(id, progress) {
    const i = DIFFICULTIES.findIndex(d => d.id === id);
    return i === 0 || (i > 0 && progress.stage(FINAL_STAGE_ID, DIFFICULTIES[i - 1].id).cleared);
}

/** 열린 난이도 중 가장 높은 것 */
export function highestDifficulty(progress) {
    return [...DIFFICULTIES].reverse().find(d => difficultyUnlocked(d.id, progress)) || DIFFICULTIES[0];
}

/** 다음 난이도 (없으면 null) */
export function nextDifficultyOf(id) {
    const i = DIFFICULTIES.findIndex(d => d.id === id);
    return i >= 0 && i < DIFFICULTIES.length - 1 ? DIFFICULTIES[i + 1] : null;
}

/** 엘리트 속성 수: 노말 규칙(구역 3·4는 2개)과 난이도 최소 중 큰 값 */
export function affixCountFor(zone, d) {
    const base = zone >= 3 ? 2 : 1;
    return Math.max(base, d.affixes || 0, zone >= 3 ? d.affixesLate || 0 : 0);
}

const round2 = v => Math.round(v * 100) / 100;
const roundTo = (v, step) => Math.round(v / step) * step;

// 구역 기믹(EMP 포격·유독 가스·심연의 문 + 새 기획 궤도 폭격·컨테이너·간헐천·강제 헌혈 등)의 간격만 줄임 — 경고(warn)·효과 시간은 그대로
function hasteBoss(boss, haste) {
    if (!boss || typeof boss !== 'object' || haste === 1) return boss;
    const out = { ...boss };
    for (const k of ['artillery', 'gas', 'knights', 'orbital', 'containers', 'geysers', 'donors', 'flares', 'freeze', 'blackout', 'broadcast']) {
        if (boss[k]) out[k] = { ...boss[k], every: round2(boss[k].every / haste) };
    }
    return out;
}

const stageCache = new Map();
/**
 * 난이도 배율을 곱한 스테이지. 노말은 원래 객체 그대로 (stage.difficulty 없음 = 노말).
 * 같은 난이도·스테이지는 같은 객체를 돌려줌.
 */
export function stageFor(stage, id = DEFAULT_DIFFICULTY, now = Date.now()) {
    const d = difficultyOf(id);
    if (d.id === DEFAULT_DIFFICULTY || !stage) return stage;
    const mutator = d.mutators ? weeklyMutator(now) : null;   // 나이트메어: 이번 주 전장 변이
    const key = `${d.id}:${stage.id}:${mutator || ''}`;
    if (stageCache.has(key)) return stageCache.get(key);
    const s = {
        ...stage,
        difficulty: d.id,
        timeLimit: roundTo(stage.timeLimit * d.time, 5),
        starTime: roundTo(stage.starTime * d.time, 5),
        enemy: { ...stage.enemy, hp: round2(stage.enemy.hp * d.enemyHp), dps: round2(stage.enemy.dps * d.enemyDps),
            spawn: round2(stage.enemy.spawn * (mutator && MUTATORS[mutator].spawnMul || 1)) },
        mutator,
        elite: Math.min(0.5, round2((stage.elite || 0) + d.elite)),
        affixCount: affixCountFor(stage.zone, d),
        bossHaste: d.bossHaste,
        base: { mid: roundTo(stage.base.mid * d.base, 100), final: roundTo(stage.base.final * d.base, 100) },
        reward: {
            kill: Math.round(stage.reward.kill * d.reward),
            mid: roundTo(stage.reward.mid * d.reward, 50),
            final: roundTo(stage.reward.final * d.reward, 50)
        },
        boss: hasteBoss(stage.boss, d.bossHaste)
    };
    stageCache.set(key, s);
    return s;
}

/** 스테이지의 난이도 id (노말 스테이지는 difficulty가 없음) */
export function difficultyOfStage(stage) {
    return (stage && stage.difficulty) || DEFAULT_DIFFICULTY;
}

const typeCache = new Map();
/** 보스 종류의 기술 간격(every)을 haste로 나눈 복사본 — 나이트메어 보스 (enemies_v2.js spawnEnemy) */
export function hastedType(typeId, t, haste) {
    if (!haste || haste === 1) return t;
    const key = `${typeId}@${haste}`;
    if (typeCache.has(key)) return typeCache.get(key);
    const walk = v => {
        if (Array.isArray(v)) return v.map(walk);
        if (!v || typeof v !== 'object') return v;
        const o = {};
        for (const [k, x] of Object.entries(v)) {
            if (k === 'every') o[k] = Array.isArray(x) ? x.map(n => round2(n / haste)) : round2(x / haste);
            else o[k] = walk(x);
        }
        return o;
    };
    const out = walk(t);
    typeCache.set(key, out);
    return out;
}
