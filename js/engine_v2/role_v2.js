/* ==========================================================================
   PROJECT: MAD OVERLORD // 원거리·근거리 (D-119 4·13번, Q-039·Q-040 임시)
   장착한 팔의 '공격 종류'로 나눈다 — 캐릭터가 아님 (거대로봇 주먹/레이저, 히어로 대검/파동처럼 한 캐릭터가 둘 다 됨).
   사거리 숫자로 나누면 강화 파츠에서 뒤집혀서(길잡이 물줄기 250 → 강화 280) 쓰지 않음.
     근거리: 주먹·발톱·대검·가위·드릴 (attackType melee·scissors, 2차 세트 kitAttack melee·multi)
     원거리: 레이저·미사일·레일건·어둠 파동·암흑 구체·산성 침·서리 부채 (2차 세트 shot·lob·pierce·chain), 총구에서 쏘는 팔(shotFx)
     중거리(보정 없음): 길잡이 물줄기·성녀 바늘·합성괴인 산탄 — 버티는 캐릭터라 원거리 보정(속도 절반·받는 피해 +)과 안 맞음
   배율은 battle/tuning.js ROLE. 능력치(progress_v2.js statsFor)에 곱해 연구소 표시와 전투가 같은 값을 씀.
   ========================================================================== */

import { ROLE } from './battle/tuning.js';

const MELEE = new Set(['melee', 'scissors']);
const MID = new Set(['water', 'needle', 'shotgun']);
const KIT_MELEE = new Set(['melee', 'multi']);

/** 팔 파츠 → 'melee' | 'ranged' | 'mid' (팔이 없으면 근거리 — 맨주먹) */
export function roleOfArm(arm) {
    if (!arm || arm.id === 'none') return 'melee';
    if (arm.shotFx) return 'ranged';
    const t = arm.attackType || 'melee';
    if (t === 'kit') return KIT_MELEE.has(arm.kitAttack && arm.kitAttack.kind) ? 'melee' : 'ranged';
    if (MELEE.has(t)) return 'melee';
    if (MID.has(t)) return 'mid';
    return 'ranged';
}

/** 역할 배율 { move, taken, dps } */
export function roleMods(role) {
    return ROLE[role] || ROLE.mid;
}

/** 방어력(%) = 받는 피해 감소율 — 근거리 25 · 원거리 −20 · 중거리 0 */
export function armorOf(role) {
    return Math.round((1 - roleMods(role).taken) * 100);
}

export const ROLE_NAME = { melee: '근거리', ranged: '원거리', mid: '중거리' };
