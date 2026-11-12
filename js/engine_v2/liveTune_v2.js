/* ==========================================================================
   PROJECT: MAD OVERLORD // 밸런스 조절 (시험용, D-127)
   팀이 게임을 하면서 공격력·원거리/근거리 배율·적 세기를 바로바로 바꿔 보는 값. 이 기기에만 저장(localStorage 'mo_dev_tune' —
   저장 백업 'mo_v2_*'에는 안 들어감). 기본값이면 게임에 아무 영향 없음.
     playerAtk        주인공 공격력 전체 배율
     charAtk[캐릭터]   캐릭터별 공격력 배율 (출격 캐릭터 = 몸통 파츠)
     role[유형]       원거리·근거리·중거리 { dps 공격력, move 이동, taken 받는 피해 } — battle/tuning.js ROLE을 바로 고침(연구소 표시도 같이)
     enemyHp / enemyDps  적 체력(거점·바리케이드 포함) · 공격력 배율 — 전투 중에 바꾸면 새로 나오는 적·다음 공격부터
   적용: progress_v2.js statsFor(공격력) · battle_v2.js startBattle/applyLiveTune(적, 전투 중 다시 계산) · 화면 ui_v2/tunePanel_v2.js
   ========================================================================== */

import { ROLE } from './battle/tuning.js';

const KEY = 'mo_dev_tune';
const KEY_ON = 'mo_dev_tune_on';
export const CHARACTERS = ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint', 'doll', 'frost', 'architect', 'broadcaster'];
export const ROLES = ['melee', 'mid', 'ranged'];
export const ROLE_KEYS = ['dps', 'move', 'taken'];
export const RANGE = { min: 0.1, max: 3, step: 0.05 };

// 코드 기본값 (불러오기 전에 복사해 둠 — 되돌리기·바뀐 값 표시용)
const BASE_ROLE = JSON.parse(JSON.stringify(ROLE));

const fresh = () => ({
    playerAtk: 1,
    charAtk: Object.fromEntries(CHARACTERS.map(c => [c, 1])),
    role: JSON.parse(JSON.stringify(BASE_ROLE)),
    enemyHp: 1, enemyDps: 1
});

let tune = fresh();
const listeners = new Set();

const clamp = v => Math.min(RANGE.max, Math.max(RANGE.min, Math.round(Number(v) * 100) / 100));
const num = v => Number.isFinite(Number(v)) && Number(v) > 0;

function store(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* 막힌 저장소: 이번 실행만 */ }
}
function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

/** ROLE(tuning.js)에 지금 값을 씀 — roleMods·armorOf·statsFor가 바로 읽음 */
function pushRole() {
    for (const r of ROLES) for (const k of ROLE_KEYS) ROLE[r][k] = tune.role[r][k];
}

function load() {
    tune = fresh();
    let saved = null;
    try { saved = JSON.parse(read(KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
        if (num(saved.playerAtk)) tune.playerAtk = clamp(saved.playerAtk);
        if (num(saved.enemyHp)) tune.enemyHp = clamp(saved.enemyHp);
        if (num(saved.enemyDps)) tune.enemyDps = clamp(saved.enemyDps);
        for (const c of CHARACTERS) if (num(saved.charAtk?.[c])) tune.charAtk[c] = clamp(saved.charAtk[c]);
        for (const r of ROLES) for (const k of ROLE_KEYS) if (num(saved.role?.[r]?.[k])) tune.role[r][k] = clamp(saved.role[r][k]);
    }
    pushRole();
}

function persist() {
    store(KEY, liveTune.isModified() ? JSON.stringify(tune) : null);
    pushRole();
    listeners.forEach(fn => { try { fn(tune); } catch (e) { console.error(e); } });
}

export const liveTune = {
    get: () => tune,
    base: () => ({ ...fresh(), role: JSON.parse(JSON.stringify(BASE_ROLE)) }),
    /** path: 'playerAtk' | 'enemyHp' | 'enemyDps' | 'charAtk.mech' | 'role.ranged.dps' */
    set(path, value) {
        if (!num(value)) return false;
        const parts = path.split('.');
        let o = tune;
        for (let i = 0; i < parts.length - 1; i++) o = o?.[parts[i]];
        const last = parts[parts.length - 1];
        if (!o || !(last in o)) return false;
        o[last] = clamp(value);
        persist();
        return true;
    },
    valueOf(path) {
        return path.split('.').reduce((o, k) => o?.[k], tune);
    },
    baseOf(path) {
        return path.split('.').reduce((o, k) => o?.[k], this.base());
    },
    reset(path = null) {
        if (path) return this.set(path, this.baseOf(path));
        tune = fresh();
        persist();
        return true;
    },
    /** 기본값과 다른 값 목록 [[path, 지금, 기본]] */
    changes() {
        const out = [];
        const walk = (o, b, pre) => {
            for (const k of Object.keys(b)) {
                const p = pre ? `${pre}.${k}` : k;
                if (typeof b[k] === 'object') walk(o[k], b[k], p);
                else if (Math.abs(o[k] - b[k]) > 1e-9) out.push([p, o[k], b[k]]);
            }
        };
        walk(tune, this.base(), '');
        return out;
    },
    isModified() {
        return this.changes().length > 0;
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
