/* ==========================================================================
   PROJECT: MAD OVERLORD // 세트 장비 표 (v2, Q-008 — MD/세트장비_퀄리티업_단계계획.md, 2차 Q-009 — MD/파츠확장_2차_기획안.md)
   캐릭터마다 레어 세트 ①~④ + 유니크 ①~③ + 레전더리 ①·②. 세트는 "등급 바닥"을 정한다 — 그 세트 파츠는 이 등급 아래로 없음.
     레어 세트: 연구소 DM 구매 + 하드부터 드랍 + 파츠 조각 제작 (기존 4종은 A·B 세트, D-053)
     유니크 세트: 헬부터 드랍 + 조각 제작 (DM 구매 없음 — 파츠에 cost 없이 dropOnly)
     레전더리 세트 (D-071): 나이트메어 드랍 + 조각 제작 (DM 구매 없음)
   세트 효과: 같은 세트 부위를 n개 끼우면 켜짐 (bonus { 개수: 설명 }) — 효과는 전투 코드에서 b.setOn(세트 id, 개수)로 봄.
   파츠 → 세트: 파츠 id 이름 규칙 `<부위>_<캐릭터>_<글자>` → 세트 id `<캐릭터>_<글자>`.
     글자: 레어 a·b·c·d (①~④), 유니크 u·v·w (①~③), 레전더리 l·m (①·②). 2차 세트 표는 sets2/*.js가 SETS에 더함 (registerSets2).
   등급·드랍 수치는 growth_v2.js, 저장·지급은 progressGrowth_v2.js.
   ========================================================================== */

export const SET_TIERS = {
    rare: { name: '레어', minGrade: 'rare' },
    unique: { name: '유니크', minGrade: 'unique' },
    legendary: { name: '레전더리', minGrade: 'legendary' }
};
/** 세트 id 끝 글자 → { 등급, 번호 } */
export const SET_LETTERS = { a: ['rare', 1], b: ['rare', 2], c: ['rare', 3], d: ['rare', 4], u: ['unique', 1], v: ['unique', 2], w: ['unique', 3], l: ['legendary', 1], m: ['legendary', 2] };

export const SETS = {
    // ---- 기존 4종: A·B 세트 = 레어 ①·② (Q-008 S1·S3) ----
    mech_a: { character: 'mech', tier: 'rare', no: 1, name: '포격 사령부', bonus: { 4: '충전 레일 사격 충전 1초 → 0.7초' } },
    mech_b: { character: 'mech', tier: 'rare', no: 2, name: '돌격 강습대', bonus: { 4: '로켓 돌진이 끝날 때 충격파 — 둘레 적 0.5초 기절' } },
    kaiju_a: { character: 'kaiju', tier: 'rare', no: 1, name: '가시 갑각', bonus: { 4: '가시 갑옷 동안 진격 속도 +30%, 되돌림 50% → 80%' } },
    kaiju_b: { character: 'kaiju', tier: 'rare', no: 2, name: '독안개', bonus: { 4: '독 구름·산성 웅덩이가 거점에 2배, 산성에 녹던 적이 쓰러지면 옆 적에게 옮음' } },
    hero_a: { character: 'hero', tier: 'rare', no: 1, name: '타락 기사', bonus: { 4: '회전 베기 3 → 4회전, 돌면서 앞으로 나아감' } },
    hero_b: { character: 'hero', tier: 'rare', no: 2, name: '그림자 마도사', bonus: { 4: '그림자 분신 2 → 3명' } },
    chimera_a: { character: 'chimera', tier: 'rare', no: 1, name: '광폭 실험체', bonus: { 4: '아드레날린 주입 동안 밀려나지 않음' } },
    chimera_b: { character: 'chimera', tier: 'rare', no: 2, name: '조직 사령관', bonus: { 4: '졸개가 쓰러질 때 작은 폭발 (주변 적 피해)' } }
    // 유니크 세트(…_u)·새 캐릭터 세트는 그 세트를 만들 때 더함 (단계 3·4)
};

const SET_ID_RE = /^(?:head|body|arm|leg)_([a-z]+)_([abcduvwlm])$/;

/** 파츠(또는 파츠 id)의 세트 id — 세트 표에 없으면 null */
export function setIdOf(part) {
    const id = typeof part === 'string' ? part : part && part.id;
    const m = SET_ID_RE.exec(id || '');
    const sid = m ? `${m[1]}_${m[2]}` : null;
    return sid && SETS[sid] ? sid : null;
}

export function setOf(part) {
    const sid = setIdOf(part);
    return sid ? { id: sid, ...SETS[sid] } : null;
}

/** 등급 바닥: 레어 세트 'rare', 유니크 세트 'unique', 나머지 'common' */
export function minGradeOf(part) {
    const s = setOf(part);
    return s ? SET_TIERS[s.tier].minGrade : 'common';
}

/** 드랍 묶음: 'base'(기본·강화) | 'rare' | 'unique' | 'legendary' */
export function dropGroupOf(part) {
    const s = setOf(part);
    return s ? s.tier : 'base';
}

const DROP_ONLY_GROUPS = new Set(['unique', 'legendary']);

/** DM으로 살 수 있는지: 가격이 있고 드랍 전용·유니크·레전더리 세트가 아님 */
export function isPurchasable(part) {
    return !!(part && part.cost) && !part.dropOnly && !DROP_ONLY_GROUPS.has(dropGroupOf(part));
}

/** 드랍·조각으로만 얻는 파츠 (연구소에서 "드랍 전용") */
export function isDropOnly(part) {
    return !!part && part.id !== 'none' && (!!part.dropOnly || DROP_ONLY_GROUPS.has(dropGroupOf(part)));
}

/** 연구소·결과 화면 이름표: "레어 ① 포격 사령부" / "유니크 ② 플라즈마 정화대" / "레전더리 ① 기신 아포칼립스" */
export function setLabelOf(set) {
    if (!set) return '';
    const tier = SET_TIERS[set.tier].name;
    return `${tier} ${'①②③④'[set.no - 1] || set.no} ${set.name}`;
}

/** 장착 파츠 { head, body, arm, leg } → { 세트 id: 끼운 부위 수 } */
export function setCounts(partsObj) {
    const out = {};
    for (const p of Object.values(partsObj || {})) {
        const sid = setIdOf(p);
        if (sid) out[sid] = (out[sid] || 0) + 1;
    }
    return out;
}

/** 장착에 걸린 세트 효과 목록 [{ id, name, label, count, need, desc, on, perk? }] (연구소 표시) — 전투 밖 효과(SET_PERKS)도 함께 */
export function setBonusList(partsObj) {
    const counts = setCounts(partsObj);
    const out = [];
    for (const [sid, count] of Object.entries(counts)) {
        const s = SETS[sid];
        const perk = SET_PERKS[sid];
        const lines = [...Object.entries(s.bonus || {}), ...(perk ? [[perk.need, perk.text]] : [])];
        for (const [need, desc] of lines) {
            out.push({ id: sid, name: s.name, label: setLabelOf({ id: sid, ...s }), count, need: Number(need), desc, on: count >= Number(need), perk: desc === perk?.text });
        }
    }
    return out;
}

/**
 * 전투 밖 세트 효과 (2026-11-03 Trello '파츠 세트효과 추가', 세트·수치는 임시 Q-018): 같은 세트를 need부위 이상 끼우면 켜짐.
 *   supportTime: 주인공이 끼우면 협력 출격 시간 +초 · supportCd: 주인공이 끼우면 협력 대기 시간 −초
 *   dispatchLoot: 파견 보낸 캐릭터가 끼우고 있으면 파견 보상(DM·조각·코어·파츠 확률) ×(1 + 값)
 */
export const SET_PERKS = {
    mech_a: { need: 2, supportTime: 3, text: '협력 출격 시간 +3초' },
    chimera_b: { need: 2, supportCd: 5, text: '협력 대기 시간 −5초' },
    hero_b: { need: 2, dispatchLoot: 0.2, text: '이 캐릭터를 파견하면 보상 +20%' }
};

/** 파츠 묶음(부위 → 파츠)에서 켜진 전투 밖 세트 효과의 합 */
export function setPerkOf(partsObj, key) {
    const counts = setCounts(partsObj);
    return Object.entries(SET_PERKS).reduce((sum, [sid, p]) => sum + ((counts[sid] || 0) >= p.need ? p[key] || 0 : 0), 0);
}
