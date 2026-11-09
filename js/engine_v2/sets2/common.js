/* ==========================================================================
   PROJECT: MAD OVERLORD // 2차 세트 공통 (파츠 확장 2차, Q-009 · D-071 — MD/파츠확장_2차_기획안.md)
   세트 하나 = { letter, tier, no, name, style, tint, bonus{개수: 설명}, kit{개수: { patch, mods, flags, on }},
                 head/body/arm/leg: { name, look, desc, skill?, kitAttack?, attackType?, rigArm?, passive? }, skills: { id: 부품 스킬 } }
   → packOf(캐릭터, [세트…])가 registerSets2(skillKit_v2.js)에 넘길 묶음을 만든다.
   능력치는 캐릭터 기준(레어 = A·B 세트 평균) × 등급 배수 × 성격으로 정함 — 단계 J 측정에서 맞춤.
   ========================================================================== */

import { DIVER_FACTION, SAINT_FACTION, FROST_FACTION, DOLL_FACTION, ARCHITECT_FACTION, BROADCASTER_FACTION } from '../partsExtra_v2.js';
import { spr, fxOf } from '../skillKit_v2.js';
import { imageShockwave } from '../vfx/imageEffects.js';

export { spr, fxOf };

export const FACTION = {
    mech: '거대로봇 (메카닉)', kaiju: '거대괴수 (돌연변이)', hero: '타락 히어로 (세뇌)', chimera: '합성괴인 (키메라)',
    diver: DIVER_FACTION, saint: SAINT_FACTION, frost: FROST_FACTION, doll: DOLL_FACTION,
    architect: ARCHITECT_FACTION, broadcaster: BROADCASTER_FACTION
};

// 캐릭터 기준 능력치 (레어 세트 부위 — 기존 4종은 A·B 평균, 새 캐릭터는 1차 기획 레어 세트 평균)
const BASE = {
    mech: { head: [550, 110, 50, 5], body: [1650, 90, 0, 5], arm: [350, 450, 310, 0], leg: [875, 115, 0, 138] },
    kaiju: { head: [950, 60, 20, 5], body: [2250, 45, 0, 0], arm: [550, 410, 255, 0], leg: [1100, 40, 0, 98] },
    hero: { head: [700, 100, 25, 12], body: [1450, 120, 0, 18], arm: [475, 410, 260, 12], leg: [750, 95, 0, 112] },
    chimera: { head: [650, 70, 10, 10], body: [1500, 65, 0, 10], arm: [425, 380, 215, 5], leg: [700, 85, 0, 92] },
    diver: { head: [900, 95, 30, 0], body: [2300, 70, 0, 0], arm: [500, 465, 290, 0], leg: [1000, 55, 0, 95] },
    saint: { head: [750, 100, 30, 10], body: [1800, 80, 0, 10], arm: [475, 500, 230, 0], leg: [800, 55, 0, 110] },
    frost: { head: [725, 110, 35, 10], body: [1700, 85, 0, 10], arm: [450, 520, 245, 0], leg: [750, 60, 0, 115] },
    doll: { head: [825, 95, 25, 10], body: [1950, 75, 0, 10], arm: [450, 480, 255, 0], leg: [825, 60, 0, 108] },
    // 새 캐릭터 5·6 (D-079): 강화 파츠보다 조금 위 (기존 새 캐릭터의 레어 세트 ÷ 강화 파츠 비율)
    architect: { head: [900, 95, 20, 5], body: [2150, 75, 0, 5], arm: [500, 500, 180, 0], leg: [875, 60, 0, 100] },
    broadcaster: { head: [725, 110, 35, 10], body: [1700, 85, 0, 10], arm: [450, 520, 290, 0], leg: [750, 60, 0, 115] }
};
const TIER_MUL = { rare: 1, unique: 1.15, legendary: 1.3 };
// 성격: 탱커 · 공격 · 사거리 · 속도 · 균형 · 지원
const STYLE = {
    tank: { hp: 1.25, dps: 0.85, speed: -10 },
    dps: { hp: 0.9, dps: 1.15 },
    range: { hp: 0.92, range: 90 },
    speed: { hp: 0.95, dps: 1.05, speed: 20 },
    balance: {},
    support: { hp: 1.1, dps: 0.95 }
};
// 레어 세트 DM 가격 (기존 4종 3200 · 새 캐릭터 4200 — Q-008 S2)
const COST = {
    old: { head: 750, body: 800, arm: 900, leg: 750 },
    new: { head: 1000, body: 1050, arm: 1150, leg: 1000 }
};
const NEW_CHARS = new Set(['diver', 'saint', 'frost', 'doll', 'architect', 'broadcaster']);
const TIER_NAME = { rare: '레어', unique: '유니크', legendary: '레전더리' };
// 새 캐릭터 세트 팔이 새 기본 공격(kitAttack)을 갖지 않으면 캐릭터 기본 공격을 그대로 (D-079 — 전에는 맨주먹 'melee'로 떨어졌음)
const BASE_ATTACK = { diver: 'water', saint: 'needle', frost: 'frost', doll: 'scissors' };
const r10 = v => Math.round(v / 10) * 10;

export function statsOf(character, tier, style, slot) {
    const [hp, dps, range, speed] = BASE[character][slot];
    const t = TIER_MUL[tier], s = STYLE[style] || {};
    return {
        hp: r10(hp * t * (s.hp ?? 1)),
        dps: r10(dps * t * (s.dps ?? 1)),
        range: slot === 'arm' ? range + (s.range || 0) : slot === 'head' ? range + Math.round((s.range || 0) / 3) : range,
        speed: slot === 'leg' ? speed + (s.speed || 0) + (tier === 'legendary' ? 5 : 0) : speed
    };
}

/** 세트 목록 → registerSets2 묶음 */
export function packOf(character, list) {
    const pack = { character, sets: {}, parts: { head: [], body: [], arm: [], leg: [] }, skills: {}, partSkill: {}, passives: {}, tints: {} };
    for (const set of list) {
        const sid = `${character}_${set.letter}`;
        const label = `${TIER_NAME[set.tier]} ${'①②③④'[set.no - 1]} ${set.name}`;
        pack.sets[sid] = { character, tier: set.tier, no: set.no, name: set.name, bonus: set.bonus, kit: set.kit || null };
        if (set.tint) pack.tints[set.letter] = set.tint;
        Object.assign(pack.skills, set.skills || {});
        for (const slot of ['head', 'body', 'arm', 'leg']) {
            const d = set[slot];
            const id = `${slot}_${character}_${set.letter}`;
            const part = {
                id, name: d.name, faction: FACTION[character], set: label, rigVariant: set.letter,
                stats: statsOf(character, set.tier, set.style, slot), look: d.look, skillDesc: d.desc
            };
            if (set.tier === 'rare') part.cost = (NEW_CHARS.has(character) ? COST.new : COST.old)[slot];
            else part.dropOnly = true;
            if (NEW_CHARS.has(character)) part.rigUpgrade = true;   // 새 캐릭터 세트는 강화 그림 + 세트 색
            if (d.attackType) part.attackType = d.attackType;
            if (d.kitAttack) { part.attackType = 'kit'; part.kitAttack = d.kitAttack; }
            if (slot === 'arm' && !part.attackType && BASE_ATTACK[character]) part.attackType = BASE_ATTACK[character];
            if (d.rigArm) part.rigArm = d.rigArm;
            if (d.shotFx) part.shotFx = d.shotFx;   // 기본 공격 발사 연출 (D-118 — attacks.js fireShotFx)
            if (d.stats) Object.assign(part.stats, d.stats);
            pack.parts[slot].push(part);
            if (d.skill) pack.partSkill[id] = d.skill;
            if (d.passive) pack.passives[id] = d.passive;
        }
    }
    return pack;
}

/**
 * 새 캐릭터 기본·강화 파츠 8개를 부품 스킬 묶음으로 (D-079 — 새 battle/<캐릭터>.js 없이 데이터만)
 * slots = { head: [기본, 강화], body, arm, leg } — 각 { id, name, cost, src(리그 부위 그림), stats, desc, up?, skill?, kitAttack?, passive? }
 */
export function basePackOf(character, slots, skills = {}) {
    const pack = { character, sets: {}, parts: { head: [], body: [], arm: [], leg: [] }, skills, partSkill: {}, passives: {}, tints: {} };
    for (const slot of ['head', 'body', 'arm', 'leg']) {
        for (const d of slots[slot]) {
            const part = { id: d.id, name: d.name, faction: FACTION[character], cost: d.cost, src: `assets/sprites/rig/${character}/${d.src}`,
                animType: 'pivot', stats: d.stats, skillDesc: d.desc };
            if (d.up) part.rigUpgrade = true;
            if (d.kitAttack) { part.attackType = 'kit'; part.kitAttack = d.kitAttack; }
            pack.parts[slot].push(part);
            if (d.skill) pack.partSkill[d.id] = d.skill;
            if (d.passive) pack.passives[d.id] = d.passive;
        }
    }
    return pack;
}

// ---- 자주 쓰는 이펙트 (지금 시트를 색 돌려 다시 씀 — 세트 대표 시트는 Gemini로 따로) ----
export const V = {
    /** 바닥 충격 (내려찍기·착지) */
    impact: (hue = 0, size = 170, extra = {}) => fxOf(spr('ground_impact', size, { anchorY: 0.85, hue, ...extra })),
    /** 폭발 (불·용암·운석) */
    blast: (hue = 0, size = 150, extra = {}) => fxOf(spr('fire_burst', size, { hue, ...extra })),
    bigBlast: (hue = 0, size = 300, extra = {}) => fxOf(spr('explosion_big', size, { anchorY: 0.9, hue, dur: 0.7, ...extra })),
    acid: (hue = 0, size = 120, extra = {}) => fxOf(spr('acid_burst', size, { hue, ...extra })),
    ice: (hue = 0, size = 120, extra = {}) => fxOf(spr('ice_burst', size, { hue, ...extra })),
    shatter: (hue = 0, size = 150, extra = {}) => fxOf(spr('ice_shatter', size, { anchorY: 0.85, hue, ...extra })),
    bolt: (hue = 0, size = 120, extra = {}) => fxOf(spr('lightning_burst', size, { hue, ...extra })),
    dark: (hue = 0, size = 130, extra = {}) => fxOf(spr('dark_burst', size, { hue, ...extra })),
    gold: (hue = 0, size = 130, extra = {}) => fxOf(spr('golden_burst', size, { hue, ...extra })),
    water: (hue = 0, size = 130, extra = {}) => fxOf(spr('water_burst', size, { hue, ...extra })),
    roar: (hue = 0, size = 260, extra = {}) => fxOf(spr('roar_green', size, { anchorX: 0.05, hue, ...extra })),
    breath: (hue = 0, size = 300, extra = {}) => fxOf(spr('breath_fire', size, { anchorX: 0.03, hue, ...extra })),
    claw: (hue = 0, size = 130, extra = {}) => fxOf(spr('claw_fire', size, { hue, ...extra })),
    bite: (hue = 0, size = 120, extra = {}) => fxOf(spr('bite_green', size, { hue, ...extra })),
    slash: (hue = 0, size = 150, extra = {}) => fxOf(spr('slash_violet', size, { hue, ...extra })),
    cleave: (hue = 0, size = 170, extra = {}) => fxOf(spr('cleave_crimson', size, { hue, ...extra })),
    pillar: (hue = 0, size = 220, extra = {}) => fxOf(spr('pillar_gold', size, { anchorY: 0.92, hue, ...extra })),
    aura: (hue = 0, size = 220, extra = {}) => fxOf(spr('power_aura', size, { anchorY: 0.92, hue, dur: 0.7, ...extra })),
    portal: (hue = 0, size = 200, extra = {}) => fxOf(spr('summon_portal', size, { anchorY: 0.76, hue, dur: 0.7, ...extra })),
    spore: (hue = 0, size = 160, extra = {}) => fxOf(spr('spore_burst', size, { hue, ...extra })),
    mutation: (hue = 0, size = 160, extra = {}) => fxOf(spr('mutation_burst', size, { hue, ...extra })),
    needle: (hue = 0, size = 110, extra = {}) => fxOf(spr('needle_crimson', size, { hue, ...extra })),
    xcut: (hue = 0, size = 140, extra = {}) => fxOf(spr('xcut_cyan', size, { hue, ...extra })),
    hands: (hue = 0, size = 200, extra = {}) => fxOf(spr('hands_teal', size, { anchorY: 0.9, hue, ...extra })),
    tentacle: (hue = 0, size = 220, extra = {}) => fxOf(spr('tentacle_void', size, { anchorY: 0.9, hue, ...extra })),
    orbital: (hue = 0, size = 260, extra = {}) => fxOf(spr('orbital_beam', size, { anchorY: 0.92, hue, ...extra })),
    judgment: (hue = 0, size = 240, extra = {}) => fxOf(spr('judgment_violet', size, { anchorY: 0.92, hue, ...extra })),
    hellgate: (hue = 0, size = 240, extra = {}) => fxOf(spr('hellgate_red', size, { anchorY: 0.9, hue, ...extra })),
    punch: (hue = 0, size = 120, extra = {}) => fxOf(spr('punch_cyan', size, { hue, ...extra })),
    revive: (hue = 0, size = 200, extra = {}) => fxOf(spr('revive_crimson', size, { anchorY: 0.9, hue, ...extra })),
    /** 이름 있는 시트 그대로 (세트 대표 시트) */
    sheet: (sheet, size = 200, extra = {}) => fxOf(spr(sheet, size, extra)),
    shock: (hue = 0, width = 360, sec = 0.65) => imageShockwave(width, hue, sec),
    ring: (color, r = 120, extra = {}) => fxOf({ type: 'shockwave', at: 0, dur: 0.45, r, width: 12, ground: true, color, ...extra }),
    /** 누운 레이저 (D-118): 궤도 광선 시트의 곧은 기둥만 떼어(crop) 오른쪽으로 눕힘 — 총구에서 len만큼 growIn초에 뻗음 */
    laser: (hue = 0, len = 1000, thick = 120, extra = {}) => fxOf(spr('orbital_beam', 0, { width: thick, height: len, crop: [0.22, 0.02, 0.78, 0.5],
        frameRange: [2, 3], loopSec: 0.12, angle: -Math.PI / 2, anchorX: 0.5, anchorY: 0, dur: 0.5, hue, glow: 1.15, growIn: 0.07, fadeOut: 0.25, ...extra })),
    beam: (color, w = 26) => fxOf({ type: 'beam', at: 0, dur: 0.35, w, color }, { type: 'flash', at: 0, dur: 0.12, r: 40, color }),
    chainBolt: color => fxOf({ type: 'bolt', at: 0, dur: 0.25, count: 1, jag: 14, branches: 1, width: 3, flicker: 0.05, color }),
    motes: (color, count = 10) => fxOf({ type: 'motes', at: 0, count, spread: 40, rise: [30, 80], life: [0.5, 0.9], size: 2.4, color }),
    embers: color => fxOf({ type: 'embers', at: 0, count: 6, speed: 60, angle: -Math.PI / 2, cone: 1.2, size: 2.4, life: [0.4, 0.8], drag: 1.5, rise: 30, color })
};
