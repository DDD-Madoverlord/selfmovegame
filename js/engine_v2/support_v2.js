// D-069: 내 캐릭터 협력 출격. 편성/저장 규칙은 전투·화면이 함께 사용한다.
import { PARTS_DB } from '../data/parts.js';
import { ROSTER, SLOTS, characterOfPart, rosterOf, partsOfCharacter } from './roster_v2.js';
import { skillsForParts, SKILLS, PART_SKILL } from './skills_v2.js';
import { RIG_CHARACTERS } from './rig/characters.js';
import { setPerkOf } from './sets_v2.js';

export const SUPPORT = Object.freeze({
    cooldown: 40, // 첫 충전·재충전. 계정 연구로 최대 9초 단축.
    actorFront: 60, meleeGap: 80, dashSec: 0.22, dashRange: 260,
    duration: 10, enter: 0.4, ultimateTimes: [0.4, 5.4], castDuration: 1.5,
    attackAt: 1.9, exitAt: 9.5, attacksEvery: 0.65,
    basicFxScale: 1.5, // 일반 공격 가독성만 확대. 피해·주기·사거리에는 적용하지 않는다.
    damage: 0.55, ultimate: 1.6, baseDamage: 0.65, synergy: 0.15,
    shield: 0.08, bossShield: 0.12, shieldCap: 0.12, shatter: 0.45,
    range: 520, maxTargets: 6, autoHealth: 0.4, autoCrowd: 4
});
export const SUPPORT_UNITS = {
    mech: { role: '원거리 화력', ult: '스웜 드론 총출격', skill: 'droneSwarm', clip: 'attack', icon: 'drone',
        brief: '드론 포격 · 원거리 피해 +15%',
        effect: '드론 6기로 포격. 명중한 적에게 주인공의 원거리 피해 +15%.', partners: ['hero', 'frost', 'diver'] },
    kaiju: { role: '광역 제압', ult: '대지 포효', skill: 'earthRoar', clip: 'victory', icon: 'roar',
        brief: '광역 기절 · 근접 피해 +15%',
        effect: '포효로 일반 적 2초 기절. 명중한 적에게 주인공의 근접 피해 +15%.', partners: ['chimera', 'doll'] },
    hero: { role: '세뇌 · 약화', ult: '대세뇌', skill: 'massMind', clip: 'cast', icon: 'mind',
        brief: '적 2기 세뇌 · 적 공격 피해 -15%',
        effect: '일반 적 최대 2기를 임시 아군화. 표식 주변 적의 공격 피해 -15%. 보스·거점에는 약화 표식.', partners: ['mech', 'frost'] },
    chimera: { role: '근접 화력 · 지휘', ult: '파괴 광란', skill: 'rampage', clip: 'transform', icon: 'rampage',
        brief: '연속 강타 · 아군 공격속도 +15%',
        effect: '광란 강타 후 연속 공격. 주인공과 아군 소환수의 공격속도 +15%.', partners: ['kaiju', 'saint', 'doll'] },
    diver: { role: '구속 · 범위 연계', ult: '심연의 손', skill: 'abyssHands', clip: 'cast', icon: 'hand',
        brief: '구속 · 지속 피해 · 범위 피해 +15%',
        effect: '일반 적을 2초 구속하고 지속 피해. 표식 대상에게 주인공의 범위 피해 +15%. 보스·거점에는 피해 표식.', partners: ['mech', 'kaiju'] },
    saint: { role: '보호 · 부활', ult: '억지 부활', skill: 'forcedRevive', clip: 'cast', icon: 'redcross',
        brief: '임시 부활 · 보호막 8~12%',
        effect: '시체 우선, 일반 적까지 최대 3기를 임시 아군화. 주인공·기존 소환수 보호막 8%, 보스전 12%.', partners: ['chimera', 'doll'] },
    frost: { role: '빙결 · 파쇄', ult: '영원한 안식', skill: 'eternalRest', clip: 'cast', icon: 'icecage',
        brief: '빙결 · 첫 타격 추가 파쇄',
        effect: '일반 적을 1.5초 빙결 후 파쇄. 주인공 첫 타격에 추가 파쇄 1회. 보스·거점에는 추가 피해 표식.', partners: ['kaiju', 'chimera'] },
    doll: { role: '교란 · 방어 약화', ult: '인형 실', skill: 'puppetStrings', clip: 'strings', icon: 'puppet',
        brief: '적 조종 · 방어 25% 무시',
        effect: '일반 적 최대 4기를 3초 조종. 표식 대상에게 주인공 공격이 방어 25% 무시. 보스·거점에는 방어 약화.', partners: ['mech', 'hero'] },
    architect: { role: '거점 철거', ult: '철거 명령', skill: 'arDemolish', clip: 'cast', icon: 'hammer',
        brief: '철구 3연타 · 거점 피해 3배',
        effect: '크레인 철구를 세 번 내리쳐 최대 6명을 공격. 거점에 주는 지원 궁극기 피해 3배.',
        partners: [], volley: 3, buildingMul: 3 },
    broadcaster: { role: '침묵 · 광역 화력', ult: '긴급 방송', skill: 'bcEmergency', clip: 'cast', icon: 'speaker',
        brief: '음파 3연타 · 기술 침묵',
        effect: '음파 폭발 세 번으로 최대 6명을 공격. 일반 적은 4초, 보스는 2초 침묵. 거점에는 피해만 적용.',
        partners: [], volley: 3, silence: 4 }
};

/** ROSTER가 목록의 원천. 새 캐릭터는 머리의 기본 기술에서 협력 화력·연출을 자동 구성한다.
 * 특화 효과는 선택 사항이며, 별도 협력 정의가 없다는 이유로 캐릭터를 숨기지 않는다. */
export function supportUnitOf(id) {
    const character = rosterOf(id);
    if (!character) return null;
    const head = partsOfCharacter(id, 'head')[0];
    const skillId = SUPPORT_UNITS[id]?.skill || PART_SKILL[head?.id];
    const skill = SKILLS[skillId];
    const visuals = skill?.steps?.filter(step => step.vfx?.layers) || [];
    const vfx = visuals.find(step => step.dmg > 0 && step.vfx.layers.some(layer => layer.type === 'sprite'))?.vfx
        || visuals.find(step => step.vfx.layers.some(layer => layer.type === 'sprite'))?.vfx || visuals[0]?.vfx;
    return { role: '협력 화력', ult: skill?.name || '협력 강타', skill: skillId,
        clip: skill?.clip || 'attack', icon: skill?.icon || 'fist', partners: [],
        brief: '대표 기술 연출 · 광역 지원 공격',
        effect: '대표 기술의 연출로 최대 6명에게 협력 강타. 지원 전용 위력을 사용하며 출격 중 두 번 발동합니다.',
        volley: SUPPORT_UNITS[id] ? 0 : 1, ...SUPPORT_UNITS[id], ...character.support, vfx: character.support?.vfx || vfx };
}

export const SupportProgressMethods = {
    supportReason(id, main = this.character) {
        if (!rosterOf(id)) return '없는 캐릭터';
        if (!RIG_CHARACTERS[id]) return '캐릭터 리그 준비 필요';
        if (id === main) return '현재 출전 캐릭터';
        if (!this.isCharacterUnlocked(id)) return '캐릭터 해금 필요';
        if (this.isDispatched(id)) return '파견 중';
        const eq = this.loadoutFor(id);
        if (!SLOTS.every(s => {
            const p = (PARTS_DB[s] || []).find(p => p.id === eq[s]);
            return p && this.isOwned(p.id) && characterOfPart(p) === id;
        })) return '보유 파츠 4부위 필요';
        return '';
    },
    supportCandidates(main = this.character) {
        return ROSTER.filter(c => !this.supportReason(c.id, main));
    },
    selectSupport(id) {
        if (id != null && this.supportReason(id)) return false;
        this.supportCharacter = id || null;
        this.supportRandom = false;
        this.save();
        return true;
    },
    clearSupportIfMain() {
        if (!this.supportCharacter || this.supportCharacter !== this.character) return false;
        this.supportCharacter = null;
        this.supportRandom = false;
        return true;
    },
    randomSupport(random = Math.random) {
        const list = this.supportCandidates();
        if (!list.length) return false;
        const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
        this.supportCharacter = list[Math.floor(roll * list.length)].id;
        this.supportRandom = true;
        this.save();
        return true;
    },
    setSupportAuto(on) {
        this.supportAuto = !!on;
        this.save();
    },
    supportCooldown() {
        return SUPPORT.cooldown - Math.min(9, Math.max(0, this.researchBonus('supportCooldown'))) - this.mainSetPerk('supportCd');
    },
    /** 주인공이 끼운 세트의 전투 밖 효과 합 (sets_v2.js SET_PERKS — supportTime 협력 시간 · supportCd 협력 대기, 11-03) */
    mainSetPerk(key, main = this.character) {
        const ids = this.loadoutFor(main);
        return setPerkOf(Object.fromEntries(SLOTS.map(s => [s, (PARTS_DB[s] || []).find(p => p.id === ids[s])])), key);
    },
    supportSnapshot(main = this.character) {
        const id = this.supportCharacter;
        if (!id || this.supportReason(id, main)) return null;
        const ids = this.loadoutFor(id);
        // 출격 시점의 독립 복사본. 주인공의 장착/스킬은 바꾸지 않는다.
        const parts = Object.fromEntries(SLOTS.map(s => [s, structuredClone(PARTS_DB[s].find(p => p.id === ids[s]))]));
        const sk = skillsForParts(parts).head;
        const skillLevel = this.skillLevel(sk?.id || supportUnitOf(id).skill);
        return { id, parts, stats: { ...this.statsFor(parts) }, gear: { ...this.gearTotals(parts) }, extraTime: this.mainSetPerk('supportTime', main),
            skillLevel, cooldown: this.supportCooldown(), auto: !!this.supportAuto, random: !!this.supportRandom };
    }
};

export function supportPairText(id, main) {
    const unit = supportUnitOf(id);
    if (!unit) return '지원 캐릭터를 편성하세요';
    return `${unit.partners.includes(main) ? '추천 연계 · ' : ''}${unit.effect}`;
}
