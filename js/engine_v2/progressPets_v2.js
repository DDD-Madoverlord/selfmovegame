/* Progress에 붙는 계정 공통 펫: 진행 지급·권한·장착·성장. */
import { gameState } from '../engine/state.js';
import { track } from './analytics_v2.js';
import { STAGES } from './stages_v2.js';
import { isZoneReleased } from './contentSchedule_v2.js';
import { PETS, petOf, petValue, petUpgradeCost, emptyPets, validatePets, isPetReleased } from './pets_v2.js';

export const PetMethods = {
    loadPets(data) {
        this.pets = emptyPets();
        if (data?.pets !== undefined) {
            try {
                const p = JSON.parse(JSON.stringify(data.pets));
                if (p && Array.isArray(p.owned) && !p.owned.includes(p.equipped)) p.equipped = null;
                validatePets(p);
                this.pets = p;
            }
            catch (e) { /* 손상된 펫만 초기화하고 나머지 진행 보존 */ }
        }
        for (const id of this.pets.owned) if (!Object.hasOwn(this.pets.levels, id)) this.pets.levels[id] = 1;
        if (!this.canUsePet(this.pets.equipped)) this.pets.equipped = null;
    },
    normalPetStars(now = Date.now()) {
        return STAGES.filter(s => isZoneReleased(s.zone, now)).reduce((n, s) => n + this.starCount(s.id, 'normal'), 0);
    },
    petConditionMet(id, now = Date.now()) {
        const p = petOf(id);
        return isPetReleased(id, now) && (p.stars ? this.normalPetStars(now) >= p.stars : this.stage(p.stage, 'normal').cleared);
    },
    checkPetRewards(source = 'progress', now = Date.now()) {
        const added = [];
        for (const id of Object.keys(PETS)) {
            if (!this.petConditionMet(id, now) || this.pets.earned.includes(id)) continue;
            const r = this.grantPet(id, { source, sourceId: PETS[id].stage || 'normal-stars:30', now });
            if (r.success && r.isNew) added.push(id);
        }
        return added;
    },
    ownsPet(id) { return this.pets.owned.includes(id); },
    canUsePet(id, now = Date.now()) {
        return isPetReleased(id, now) && this.ownsPet(id)
            && (this.pets.earned.includes(id) || !!this.hasPetEntitlement?.(id));
    },
    petLevel(id) { return this.pets.levels[id] || 1; },
    equippedPet() {
        const id = this.pets.equipped;
        return this.canUsePet(id) ? { id, level: this.petLevel(id), ...petOf(id) } : null;
    },
    hasNewPet() { return this.pets.owned.some(id => this.canUsePet(id)) && !this.hasTip('pet_intro'); },
    petBonus(effect) {
        const p = this.equippedPet();
        return p?.effect === effect ? petValue(p.id, p.level) : 0;
    },
    petBattleDmBonus() { return this.petBonus('battleDm'); },
    petCooldownBonus() { return this.petBonus('cdr'); },
    petOfflineDmBonus() { return this.petBonus('offlineDm'); },
    grantPet(id, { source = 'progress', sourceId = '', providerMode = 'none', now = Date.now() } = {}) {
        const earned = ['progress', 'migration'].includes(source);
        if (!isPetReleased(id, now) || (earned ? !this.petConditionMet(id, now) : !this.hasPetEntitlement?.(id))) {
            return { success: false, reason: '아직 획득할 수 없는 펫입니다' };
        }
        const isNew = !this.ownsPet(id);
        if (isNew) { this.pets.owned.push(id); this.pets.levels[id] = 1; }
        if (earned && !this.pets.earned.includes(id)) this.pets.earned.push(id);
        this.save();
        if (isNew) track('pet_get', { petId: id, source, sourceId, providerMode });
        return { success: true, isNew, petId: id };
    },
    equipPet(id = null, now = Date.now()) {
        if (id !== null && !this.canUsePet(id, now)) return { success: false, reason: '사용할 수 없는 펫입니다' };
        const previousPetId = this.pets.equipped;
        if (previousPetId === id) return { success: true, changed: false };
        this.settleOfflineBeforePet?.(now);   // ⑧: 이전 장착 효과로 기존 적립 구간 먼저 정산
        this.pets.equipped = id;
        this.save();
        gameState.notify();
        track('pet_equip', { petId: id, previousPetId, level: id ? this.petLevel(id) : null });
        return { success: true, changed: true };
    },
    petUpgradeCost(id, now = Date.now()) { return this.canUsePet(id, now) ? petUpgradeCost(this.petLevel(id)) : null; },
    upgradePet(id, now = Date.now()) {
        if (!this.canUsePet(id, now)) return { success: false, reason: '먼저 펫을 획득해야 합니다' };
        const cost = this.petUpgradeCost(id, now);
        if (!cost) return { success: false, reason: '이미 최대 레벨입니다' };
        if (gameState.darkMatter < cost.dm || this.shards < cost.shards) return { success: false, reason: 'DM 또는 조각이 부족합니다' };
        this.settleOfflineBeforePet?.(now);
        const fromLevel = this.petLevel(id);
        gameState.darkMatter -= cost.dm;
        this.shards -= cost.shards;
        this.pets.levels[id] = fromLevel + 1;
        this.save();
        gameState.notify();
        track('pet_level_up', { petId: id, fromLevel, toLevel: fromLevel + 1, dmCost: cost.dm, shardCost: cost.shards });
        return { success: true, level: fromLevel + 1, ...cost };
    }
};
