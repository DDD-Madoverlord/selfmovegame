/* ==========================================================================
   PROJECT: MAD OVERLORD // 캐릭터 목록 (v2) — 캐릭터 선택창·연구소·저장이 같이 씀 (D-051)
   - 캐릭터는 선택창에서 고르고, 연구소에는 고른 캐릭터의 파츠만 나온다 (D-050 추가, D-004를 바꿈)
   - 파츠가 어느 캐릭터 것인지는 parts.js의 faction 문자열로 판정 (parts.js는 구버전과 공용이라 읽기만)
   - 새 캐릭터를 합칠 때는 ROSTER에 한 줄씩 더하면 선택창 카드가 늘어남
   ========================================================================== */

import { PARTS_DB } from '../data/parts.js';
import { setOf, setLabelOf } from './sets_v2.js';

export const SLOTS = ['head', 'body', 'arm', 'leg'];
export const DEFAULT_CHARACTER = 'mech';

// id = 리그 캐릭터 id (rig/characters.js), faction = parts.js faction 문자열에 들어 있는 이름
export const ROSTER = [
    { id: 'mech', faction: '거대로봇', tag: 'MECHANIC', color: '#3ee6ff', desc: '주먹으로 버티다 레이저·미사일 팔로 멀리서 포격. 반사 실드와 드론 필살기.' },
    { id: 'kaiju', faction: '거대괴수', tag: 'MUTANT', color: '#a0ff32', desc: '두꺼운 체력과 재생. 산성 돌진·산란·대지 포효로 밀고 나간다.' },
    { id: 'hero', faction: '타락 히어로', tag: 'BRAINWASHED', color: '#c86eff', desc: '어둠 파동과 흑마법 폭발. 필살기로 적 보병을 세뇌해 아군으로.' },
    { id: 'chimera', faction: '합성괴인', tag: 'CHIMERA', color: '#ff9628', desc: '졸개를 불러 함께 싸우고 파괴 광란으로 날뛴다. 파츠가 모두 무료.' },
    // 새 캐릭터 (D-044~D-049, feature/new-characters에서 합침 2026-10-17) — 부위마다 기본 → 강화(rigUpgrade)
    { id: 'diver', faction: '심연의 길잡이', tag: 'ABYSS', color: '#3fe0c8', desc: '무거운 탱커. 물줄기로 꿰뚫고 앵커로 먼 적을 끌어와, 심연의 손으로 붙잡는다.' },
    { id: 'saint', faction: '봉합 성녀', tag: 'SUTURE', color: '#ff4d6d', desc: '버티며 쓰러진 적을 꿰매 아군으로. 봉합 주사·생명 봉인·억지 부활.' },
    { id: 'frost', faction: '서리의 무희', tag: 'FROST', color: '#7fd4ff', desc: '냉기를 쌓아 얼리고 깨뜨리는 원거리. 초승달 참격·눈보라 춤·영원한 안식.' },
    { id: 'doll', faction: '뒤틀린 인형사', tag: 'PUPPET', color: '#5ae6f0', desc: '토끼 인형 가족으로 막고 꼭두각시로 교란하는 근접. 가위 X자 참격.' },
    // 새 캐릭터 5·6 (D-079, MD/새캐릭터2종_설계안.md) — 탐욕의 도시, 기본·강화 파츠도 부품 스킬(sets2/<id>Sets2.js)
    { id: 'architect', faction: '철거의 설계자', tag: 'DEMOLISH', color: '#ff9a2e', desc: '드릴로 갈아 버리는 근접 브루저. 철골 바리케이드로 적을 막고 거점을 철거.' },
    { id: 'broadcaster', faction: '침묵의 방송자', tag: 'SILENCE', color: '#ff50aa', desc: '분홍 음파로 넓게 때리는 원거리. 정적의 장막으로 적의 기술을 침묵시킴.' }
];

export function rosterOf(id) {
    return ROSTER.find(c => c.id === id) || null;
}

/** 파츠의 캐릭터 id ('none'·알 수 없는 팩션이면 null) */
export function characterOfPart(part) {
    const f = String((part && part.faction) || '');
    const c = ROSTER.find(r => f.includes(r.faction));
    return c ? c.id : null;
}

// 출시 캐릭터 4명과 후발 캐릭터 보정 (회의 ① · D-154 ⑥, 2026-11-21): 나중에 공개하는 캐릭터는 기존 캐릭터보다 조금 좋아야 함 —
// 5번째부터 공격력 · 체력 +5% (progress_v2.js statsFor). 많이 차이 나면 안 되므로 5%
export const LAUNCH_CHARACTERS = ['mech', 'kaiju', 'hero', 'chimera'];
export const LATE_CHARACTER_BONUS = 1.05;
export const lateBonusOf = id => (!id || LAUNCH_CHARACTERS.includes(id) ? 1 : LATE_CHARACTER_BONUS);

/** 캐릭터의 한 부위 파츠 목록 (parts.js 순서, [파츠제거] 제외) */
export function partsOfCharacter(character, slot) {
    return (PARTS_DB[slot] || []).filter(p => characterOfPart(p) === character);
}

/**
 * 연구소 카드의 세트 표시: 세트 표(sets_v2.js)에 있으면 "레어 ① 포격 사령부"처럼 등급과 함께, 그 밖에 set이 있으면 그것,
 * 거대로봇 기본 로봇 파츠는 '기본 로봇', 나머지 지금 파츠는 팩션 괄호 안 이름(메카닉 / 돌연변이 / 세뇌 / 키메라)
 */
export function partSetLabel(part) {
    if (!part || part.id === 'none') return '';
    const s = setOf(part);
    if (s) return setLabelOf(s);
    if (part.set) return part.set;
    if (part.id.endsWith('_red_robot')) return '기본 로봇';
    const m = String(part.faction || '').match(/\(([^)]+)\)/);
    return m ? m[1] : '';
}
