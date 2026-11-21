/* ==========================================================================
   PROJECT: MAD OVERLORD // 밸런스 조절 (시험용, D-127)
   팀이 게임을 하면서 공격력·원거리/근거리 배율·적 세기를 바로바로 바꿔 보는 값. 이 기기에만 저장(localStorage 'mo_dev_tune' —
   저장 백업 'mo_v2_*'에는 안 들어감). 기본값이면 게임에 아무 영향 없음.
     playerAtk        주인공 공격력 전체 배율
     charAtk[캐릭터]   캐릭터별 공격력 배율 (출격 캐릭터 = 몸통 파츠)
     role[유형]       원거리·근거리·중거리 { dps 공격력, move 이동, taken 받는 피해 } — battle/tuning.js ROLE을 바로 고침(연구소 표시도 같이)
     enemyHp / enemyDps  적 체력(거점·바리케이드 포함) · 공격력 배율 — 전투 중에 바꾸면 새로 나오는 적·다음 공격부터
   묶음 B (회의 ② ⑧ · D-158, 2026-11-22) — growth_v2.js GRADES · LEG · GRADE_TRAIT, battle/tuning.js MELEE_FEATURE를 바로 고침:
     grade[등급]      { mul 체력·공격력 배율, atkSpd 공격 속도, pierce 방어 무시, rangeBonus 사거리 +px, knockCut 넉백 저항, ccCut 상태이상 저항 }
     leg              { base 다리 속도 기준(×0.5/0.8/1.2/1.5), cap 진격 속도 상한 }
     trait.power      등급 고유 능력치 세기 (방어 무시 · 사거리 · 넉백 · 상태이상 한꺼번에, 0이면 꺼짐)
     melee            근거리 특징 { building 건물형 거점 +, monster 몬스터형 보통 적 + }
     forceGrade       '등급 고정' — 모든 파츠를 이 등급으로 셈 (파츠를 안 가져도 등급별로 시험, progress.statGradeOf). null = 끔
   적용: progress_v2.js statsFor(공격력) · battle_v2.js startBattle/applyLiveTune(적, 전투 중 다시 계산) · 화면 ui_v2/tunePanel_v2.js
   ========================================================================== */

import { ROLE, MELEE_FEATURE } from './battle/tuning.js';
import { GRADES, GRADE_BASE, LEG, LEG_BASE, GRADE_TRAIT, GRADE_TRAIT_BASE } from './growth_v2.js';

const KEY = 'mo_dev_tune';
const KEY_ON = 'mo_dev_tune_on';
export const CHARACTERS = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint', 'doll', 'frost', 'architect', 'broadcaster'];
export const ROLES = ['melee', 'mid', 'ranged'];
export const ROLE_KEYS = ['dps', 'move', 'taken'];
export const GRADE_IDS = GRADES.map(g => g.id);
export const GRADE_KEYS = ['atkSpd', 'mul', 'pierce', 'rangeBonus', 'knockCut', 'ccCut'];
export const RANGE = { min: 0.1, max: 3, step: 0.05 };

// 값마다 범위 · 단계 · 보이는 모양 (mul = ×1.00, pct = 15%, px = 140)
const SPECS = [
    [/^grade\.\w+\.atkSpd$/, { min: 0.5, max: 2, step: 0.01, kind: 'mul' }],
    [/^grade\.\w+\.mul$/, { min: 0.5, max: 3, step: 0.05, kind: 'mul' }],
    [/^grade\.\w+\.pierce$/, { min: 0, max: 0.9, step: 0.05, kind: 'pct' }],
    [/^grade\.\w+\.rangeBonus$/, { min: 0, max: 200, step: 5, kind: 'px' }],
    [/^grade\.\w+\.knockCut$/, { min: 0, max: 1, step: 0.05, kind: 'pct' }],
    [/^grade\.\w+\.ccCut$/, { min: 0, max: 0.7, step: 0.05, kind: 'pct' }],
    [/^leg\.base$/, { min: 50, max: 300, step: 10, kind: 'px' }],
    [/^leg\.cap$/, { min: 100, max: 500, step: 10, kind: 'px' }],
    [/^trait\.power$/, { min: 0, max: 2, step: 0.1, kind: 'mul' }],
    [/^melee\.(building|monster)$/, { min: 0, max: 1, step: 0.05, kind: 'pct' }]
];
/** 그 값의 { min, max, step, kind } */
export function specOf(path) {
    const hit = SPECS.find(([re]) => re.test(path));
    return hit ? hit[1] : { ...RANGE, kind: 'mul' };
}
/** 보이는 글자: ×1.05 · 15% · 140 */
export function fmtOf(path, v) {
    const k = specOf(path).kind;
    if (k === 'pct') return `${Math.round(Number(v) * 100)}%`;
    if (k === 'px') return `${Math.round(Number(v))}`;
    return `×${Number(v).toFixed(2)}`;
}

// 코드 기본값 (불러오기 전에 복사해 둠 — 되돌리기·바뀐 값 표시용)
const BASE_ROLE = JSON.parse(JSON.stringify(ROLE));
const BASE_MELEE = { building: MELEE_FEATURE.building, monster: MELEE_FEATURE.monster };

const fresh = () => ({
    playerAtk: 1,
    charAtk: Object.fromEntries(CHARACTERS.map(c => [c, 1])),
    role: JSON.parse(JSON.stringify(BASE_ROLE)),
    enemyHp: 1, enemyDps: 1,
    grade: Object.fromEntries(GRADE_BASE.map(g => [g.id, Object.fromEntries(GRADE_KEYS.map(k => [k, g[k]]))])),
    leg: { base: LEG_BASE.base, cap: LEG_BASE.cap },
    trait: { power: GRADE_TRAIT_BASE.power },
    melee: { ...BASE_MELEE }
});

let tune = fresh();
let forceGrade = null;
const listeners = new Set();

const roundTo = (v, step) => { const d = String(step).split('.')[1]?.length || 0; return Number((Math.round(v / step) * step).toFixed(d)); };
function clampPath(path, v) {
    const s = specOf(path);
    return roundTo(Math.min(s.max, Math.max(s.min, Number(v))), s.step);
}
const okFor = (path, v) => Number.isFinite(Number(v)) && Number(v) >= specOf(path).min && (specOf(path).min > 0 || Number(v) >= 0);

/** 숫자 값의 경로 목록 ('grade.rare.atkSpd' …) */
function leafPaths(o = fresh(), pre = '') {
    return Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? leafPaths(v, `${pre}${k}.`) : [`${pre}${k}`]));
}
const getAt = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
function setAt(o, path, v) {
    const parts = path.split('.');
    let x = o;
    for (let i = 0; i < parts.length - 1; i++) x = x?.[parts[i]];
    const last = parts[parts.length - 1];
    if (!x || !(last in x)) return false;
    x[last] = v;
    return true;
}

function store(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* 막힌 저장소: 이번 실행만 */ }
}
function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

/** 게임 쪽 표에 지금 값을 씀 — roleMods · statsFor · 전투가 바로 읽음 */
function push() {
    for (const r of ROLES) for (const k of ROLE_KEYS) ROLE[r][k] = tune.role[r][k];
    for (const g of GRADES) for (const k of GRADE_KEYS) g[k] = tune.grade[g.id][k];
    LEG.base = tune.leg.base;
    LEG.cap = tune.leg.cap;
    GRADE_TRAIT.power = tune.trait.power;
    MELEE_FEATURE.building = tune.melee.building;
    MELEE_FEATURE.monster = tune.melee.monster;
}

function load() {
    tune = fresh();
    forceGrade = null;
    let saved = null;
    try { saved = JSON.parse(read(KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
        for (const p of leafPaths()) {
            const v = getAt(saved, p);
            if (v != null && okFor(p, v)) setAt(tune, p, clampPath(p, v));
        }
        if (GRADE_IDS.includes(saved.forceGrade)) forceGrade = saved.forceGrade;
    }
    push();
}

function persist() {
    store(KEY, liveTune.isModified() ? JSON.stringify({ ...tune, forceGrade }) : null);
    push();
    listeners.forEach(fn => { try { fn(tune); } catch (e) { console.error(e); } });
}

export const liveTune = {
    get: () => tune,
    base: () => fresh(),
    /** path: 'playerAtk' | 'enemyHp' | 'charAtk.mech' | 'role.ranged.dps' | 'grade.rare.atkSpd' | 'leg.base' | 'trait.power' | 'melee.building' */
    set(path, value) {
        if (!okFor(path, value) || getAt(tune, path) == null || typeof getAt(tune, path) === 'object') return false;
        setAt(tune, path, clampPath(path, value));
        persist();
        return true;
    },
    valueOf(path) {
        return getAt(tune, path);
    },
    baseOf(path) {
        return getAt(fresh(), path);
    },
    reset(path = null) {
        if (path === 'forceGrade') { forceGrade = null; persist(); return true; }
        if (path) return this.set(path, this.baseOf(path));
        tune = fresh();
        forceGrade = null;
        persist();
        return true;
    },
    /** 한 묶음(예: 'grade')을 기본값으로 */
    resetGroup(prefix) {
        const base = fresh();
        for (const p of leafPaths().filter(p => p === prefix || p.startsWith(prefix + '.'))) setAt(tune, p, getAt(base, p));
        if (prefix === 'grade') forceGrade = null;
        persist();
    },
    /** 기본값과 다른 값 목록 [[path, 지금, 기본]] — 등급 고정은 ['forceGrade', 등급, null] */
    changes() {
        const base = fresh();
        const out = leafPaths().filter(p => Math.abs(getAt(tune, p) - getAt(base, p)) > 1e-9).map(p => [p, getAt(tune, p), getAt(base, p)]);
        if (forceGrade) out.push(['forceGrade', forceGrade, null]);
        return out;
    },
    isModified() {
        return this.changes().length > 0;
    },
    /** '등급 고정' (시험용): 모든 파츠를 이 등급으로 셈. null = 끔 */
    forcedGrade() {
        return forceGrade;
    },
    setForcedGrade(id) {
        forceGrade = GRADE_IDS.includes(id) ? id : null;
        persist();
    },
    /** 출격 캐릭터의 공격력 배율 (전체 × 캐릭터) — statsFor */
    attackMul(character) {
        return tune.playerAtk * (tune.charAtk[character] ?? 1);
    },
    subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    /** 조절 탭을 보이게 할지 (시험 모드 탭 · 주소 ?tune=1 · 값이 바뀌어 있으면 항상) */
    isEnabled() {
        return read(KEY_ON) === '1' || this.isModified();
    },
    enable(on = true) {
        store(KEY_ON, on ? '1' : null);
        listeners.forEach(fn => { try { fn(tune); } catch (e) { console.error(e); } });
    },
    reload: load
};

load();
