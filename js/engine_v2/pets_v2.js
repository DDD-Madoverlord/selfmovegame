/* 펫 정의·성장 수치 (v2). art를 경로로 바꾸면 카드와 전투 그림에 함께 반영된다. */
import { isZoneReleased } from './contentSchedule_v2.js';

export const PET_MAX_LEVEL = 10;
export const PET_DM_CAP = 0.25;
export const PET_CDR_CAP = 0.35;
export const PET_ATTACK_SECONDS = 2;
export const PETS = {
    scrap_drone: { name: '회수 드론 영호', zone: 1, stage: '1-1', effect: 'battleDm', base: 0.01, per: 0.005,
        condition: '노말 1-1 첫 클리어', art: 'assets/sprites/pets/scrap_drone.webp', color: '#c39aff' },
    cinder_larva: { name: '화산갑각 유생', zone: 2, stage: '2-B', effect: 'attack', base: 0.02, per: 0.005,
        condition: '노말 2-B 첫 클리어', art: 'assets/sprites/pets/cinder_larva.webp', color: '#ff984f' },
    void_eye: { name: '공허 복안체', zone: 4, stage: '4-B', effect: 'cdr', base: 0.005, per: 0.0025,
        condition: '노말 4-B 첫 클리어', art: 'assets/sprites/pets/void_eye.webp', color: '#b493ff' },
    abyss_lantern: { name: '심연 등불충', zone: 1, stars: 30, effect: 'offlineDm', base: 0.02, per: 0.01,
        condition: '노말 누적 별 30개 (소비하지 않음)', art: 'assets/sprites/pets/abyss_lantern.webp', color: '#69ead9' },
    clockwork_keeper: { name: '태엽 묘지기', zone: 7, stage: '7-B', effect: 'battleDm', base: 0.01, per: 0.005,
        condition: '노말 7-B 첫 클리어 / 주간 패스 7회째 받기 / 상점 직접 구매', art: 'assets/sprites/pets/clockwork_keeper.webp', color: '#f0d58f' }
};

export const petOf = id => Object.hasOwn(PETS, id) ? PETS[id] : null;
export const isPetReleased = (id, now = Date.now()) => !!petOf(id) && isZoneReleased(PETS[id].zone, now);
export const emptyPets = () => ({ owned: [], levels: {}, equipped: null, earned: [] });
export function petValue(id, level = 1) {
    const p = petOf(id);
    return p ? Number((p.base + p.per * (Math.max(1, Math.min(PET_MAX_LEVEL, level)) - 1)).toFixed(6)) : 0;
}
export function petUpgradeCost(level) {
    return Number.isInteger(level) && level >= 1 && level < PET_MAX_LEVEL
        ? { dm: 150 * level * (level + 1), shards: Math.floor((level - 1) / 3) } : null;
}

/** 알 수 없는 ID도 모양이 맞으면 보존한다. 장착·효과 허용 여부는 별도로 판단한다. */
export function validatePets(p) {
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
        && [Object.prototype, null].includes(Object.getPrototypeOf(v));
    const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(v);
    const ids = v => Array.isArray(v) && v.every(id) && new Set(v).size === v.length;
    if (!object(p) || Object.keys(p).length !== 4 || !['owned', 'levels', 'equipped', 'earned'].every(k => Object.hasOwn(p, k))
        || !ids(p.owned) || !ids(p.earned) || !object(p.levels) || p.earned.some(v => !p.owned.includes(v))
        || Object.entries(p.levels).some(([k, v]) => !p.owned.includes(k) || !Number.isInteger(v) || v < 1 || v > PET_MAX_LEVEL)
        || !(p.equipped === null || (id(p.equipped) && p.owned.includes(p.equipped)))) {
        throw new Error('펫 저장 데이터의 보유·레벨·장착·획득 기록이 올바르지 않습니다.');
    }
    return true;
}
