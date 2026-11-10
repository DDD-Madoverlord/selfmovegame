/* v2 동기 저장 통로. 저장을 막은 환경에서는 이번 실행의 메모리로 대체한다. */
import { isMockCommerce } from './commerceDev_v2.js';
import { productOf, CATALOG_VERSION, PASS_HOURS, AD_LIMITS } from './shopCatalog_v2.js';
import { kstDayKey, kstWeekKey } from './kstTime_v2.js';
import { validatePets } from './pets_v2.js';
import { validateOffline } from './offlineReward_v2.js';
import { validateTutorial } from './tutorial_v2.js';

const memory = new Map();
const listeners = new Set();
const knownKeys = new Set(['mo_v2_save', 'mo_v2_settings', 'mo_v2_auto_skill']);
const localStore = {
    load(key) {
        if (memory.has(key)) return memory.get(key);
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    save(key, text) {
        try { localStorage.setItem(key, text); memory.delete(key); }
        catch (e) { memory.set(key, text); }
    },
    remove(key) {
        try { localStorage.removeItem(key); memory.delete(key); }
        catch (e) { memory.set(key, null); }
    }
};
let store = localStore;

export function setSaveStore(next) {
    if (!next || ['load', 'save', 'remove'].some(k => typeof next[k] !== 'function')) {
        throw new Error('저장소에 load·save·remove 함수가 필요합니다.');
    }
    store = next;
}

/** 시험용 전체 해제(메뉴 아이콘 — menu_v2.js): 지금 저장을 메모리 사본으로 바꿔 이번 실행에서 바뀐 것은 실제 저장에 남기지 않음.
 *  새로고침하면 원래 저장 (상점 시험 모드 commerceDev_v2.js와 같은 방식) */
let isolated = false;
export function isolateSaveInMemory() {
    if (isolated) return false;
    const copy = new Map([...knownKeys].map(key => [key, load(key)]));
    setSaveStore({ load: key => copy.get(key) ?? null, save: (key, value) => copy.set(key, value), remove: key => copy.delete(key), keys: () => copy.keys() });
    isolated = true;
    return true;
}
export const saveIsolated = () => isolated;

export function load(key) {
    knownKeys.add(key);
    return store.load(key);
}

export function save(key, text) {
    knownKeys.add(key);
    store.save(key, text);
    listeners.forEach(fn => { try { fn(key, text); } catch (e) { /* 동기화 오류는 게임 저장에 영향 없음 */ } });
}

export function remove(key) {
    store.remove(key);
}

/** fn(key, text). 구독 해제 함수 반환 */
export function onSaved(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function backupKeys() {
    const keys = new Set(knownKeys);
    if (store === localStore) {
        try {
            for (let i = 0; i < localStorage.length; i++) keys.add(localStorage.key(i));
        } catch (e) { /* 저장 불가 환경 */ }
    }
    if (typeof store.keys === 'function') for (const key of store.keys()) keys.add(key);
    return [...keys].filter(key => typeof key === 'string' && key.startsWith('mo_v2_'));
}

function checksum(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function exportSave() {
    if (isMockCommerce() || isolated) throw new Error('시험 중에는 백업을 내보낼 수 없습니다. 새로고침하면 일반 진행으로 돌아갑니다.');
    const progress = JSON.parse(load('mo_v2_save') || 'null');
    if (progress?.commerce) validateCommerce(progress.commerce, false);
    const entries = {};
    backupKeys().forEach(key => {
        const value = load(key);
        if (value != null) entries[key] = value;
    });
    const bytes = new TextEncoder().encode(JSON.stringify({ entries }));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    const payload = btoa(binary);
    return `MO1:${payload}:${checksum(payload)}`;
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 선택 commerce 필드의 직접 로드·백업 공통 검사. 영수증·토큰 등 미지 필드도 거부한다. */
export function validateCommerce(c, allowMock = isMockCommerce()) {
    const fail = () => { throw new Error('상점 저장 데이터가 올바르지 않거나 시험 저장입니다.'); };
    const uint = n => Number.isSafeInteger(n) && n >= 0;
    const str = s => typeof s === 'string' && s.length > 0 && s.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(s);
    const shape = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
    const day = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
        && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
    if (!object(c) || !shape(c, ['schema', 'permanents', 'weeklyPass', 'orders', 'dailyAds', 'weeklyPurchases', 'rewardClaims', 'lastSeenAt', 'mockSession',
        ...(Object.hasOwn(c, 'pendingPets') ? ['pendingPets'] : [])])
        || c.schema !== 1 || typeof c.mockSession !== 'boolean' || (!allowMock && c.mockSession)
        || !uint(c.lastSeenAt) || !object(c.permanents) || !Array.isArray(c.orders) || !object(c.rewardClaims)
        || (c.pendingPets !== undefined && !Array.isArray(c.pendingPets))) fail();
    const ids = new Set();
    for (const o of c.orders) {
        if (!shape(o, ['requestId', 'orderId', 'productId', 'provider', 'environment', 'status', 'purchasedAt', 'appliedAt', 'catalogVersion', 'grant'])
            || !str(o.requestId) || !str(o.orderId) || ids.has(o.orderId) || !productOf(o.productId)
            || o.provider !== 'mock' || !allowMock || !c.mockSession || !['local', 'app-dev'].includes(o.environment)
            || !['success', 'cancelled', 'failed', 'pending'].includes(o.status) || !uint(o.purchasedAt)
            || !(o.appliedAt === null || uint(o.appliedAt)) || (o.appliedAt !== null && o.status !== 'success')
            || o.catalogVersion !== CATALOG_VERSION || !object(o.grant)
            || JSON.stringify(o.grant) !== JSON.stringify(productOf(o.productId).grant)) fail();
        ids.add(o.orderId);
    }
    const source = (productId, provider, orderId) => c.orders.find(o => o.productId === productId && o.provider === provider
        && o.orderId === orderId && o.status === 'success' && o.appliedAt !== null);
    for (const [key, v] of Object.entries(c.permanents)) {
        if (productOf(key)?.type !== 'permanent' || !shape(v, ['provider', 'orderId', 'purchasedAt'])
            || !uint(v.purchasedAt) || !source(key, v.provider, v.orderId)) fail();
    }
    const p = c.weeklyPass;
    if (p !== null && (!shape(p, ['productId', 'provider', 'orderId', 'startsAt', 'expiresAt', 'lastClaimDay', 'claimCount'])
        || p.productId !== 'weekly_pass_7d' || !source(p.productId, p.provider, p.orderId)
        || !uint(p.startsAt) || !uint(p.expiresAt) || p.expiresAt - p.startsAt !== PASS_HOURS * 3600000
        || !uint(p.claimCount) || p.claimCount > 7 || (p.lastClaimDay !== null && !day(p.lastClaimDay))
        || (p.claimCount === 0) !== (p.lastClaimDay === null))) fail();
    for (const [key, value] of Object.entries(c.rewardClaims)) if (!str(key) || value !== true) fail();
    for (const v of c.pendingPets || []) {
        if (!shape(v, ['id', 'source', 'duplicateShards']) || v.id !== 'clockwork_keeper' || !str(v.source)
            || ![0, 1].includes(v.duplicateShards)
            || !c.orders.some(o => o.status === 'success' && o.appliedAt !== null
                && ((o.productId === 'pet_clockwork_keeper' && v.source === o.orderId && v.duplicateShards === 0)
                    || (o.productId === 'weekly_pass_7d' && v.source === `pass:${o.orderId}:7` && c.rewardClaims[v.source] && v.duplicateShards === 1)))) fail();
    }
    for (const [field, dateField, allowed, max] of [['dailyAds', 'dayKey', Object.keys(AD_LIMITS), 2],
        ['weeklyPurchases', 'weekKey', ['supply_small', 'supply_medium'], 1]]) {
        const v = c[field];
        if (!shape(v, [dateField, 'counts']) || !object(v.counts) || !(v[dateField] === null || day(v[dateField]))
            || (v[dateField] === null && Object.keys(v.counts).length)
            || Object.entries(v.counts).some(([k, n]) => !allowed.includes(k) || !uint(n) || n > max)) fail();
        if (field === 'weeklyPurchases' && v.weekKey && kstWeekKey(Date.parse(v.weekKey)) !== v.weekKey) fail();
    }
    if (c.dailyAds.dayKey && kstDayKey(c.lastSeenAt) < c.dailyAds.dayKey) fail();
    return true;
}

function validate(entries) {
    if (!object(entries) || Object.entries(entries).some(([k, v]) => !k.startsWith('mo_v2_') || typeof v !== 'string')) {
        throw new Error('백업 저장 항목의 모양이 올바르지 않습니다.');
    }
    const data = JSON.parse(entries.mo_v2_save);
    if (!object(data) || !Number.isFinite(data.dm) || !Array.isArray(data.owned)
        || data.owned.some(id => typeof id !== 'string') || !object(data.equipped)
        || Object.values(data.equipped).some(id => typeof id !== 'string')) {
        throw new Error('진행 데이터의 DM·보유 파츠·장착 파츠가 올바르지 않습니다.');
    }
    for (const key of ['levels', 'stages', 'diffStages', 'loadouts', 'grades', 'options', 'skillLevels', 'research']) {
        if (data[key] !== undefined && !object(data[key])) throw new Error(`진행 데이터의 ${key} 모양이 올바르지 않습니다.`);
    }
    for (const key of ['tips', 'unlockedChars']) {
        if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].some(v => typeof v !== 'string'))) {
            throw new Error(`진행 데이터의 ${key} 모양이 올바르지 않습니다.`);
        }
    }
    if (data.v !== undefined && ![1, 2, 3].includes(data.v)) throw new Error('지원하지 않는 진행 저장 버전입니다.');
    if (data.commerce !== undefined) validateCommerce(data.commerce);
    if (data.pets !== undefined) validatePets(data.pets);
    if (data.offline !== undefined) validateOffline(data.offline);
    if (data.tutorial !== undefined) validateTutorial(data.tutorial);
    if (data.savedAt !== undefined && !Number.isFinite(data.savedAt)) throw new Error('저장 시간이 올바르지 않습니다.');
    if (data.saveId !== undefined && (typeof data.saveId !== 'string' || !data.saveId)) throw new Error('저장 식별자가 올바르지 않습니다.');
    for (const key of ['shards', 'cores', 'spentStars', 'charStarRefund']) {
        if (data[key] !== undefined && !Number.isFinite(data[key])) throw new Error(`진행 데이터의 ${key} 값이 올바르지 않습니다.`);
    }
    const records = [data.stages || {}, ...Object.values(data.diffStages || {})];
    for (const stages of records) {
        if (!object(stages) || Object.values(stages).some(rec => !object(rec) || !Array.isArray(rec.stars)
            || rec.stars.length !== 3 || rec.stars.some(v => typeof v !== 'boolean')
            || typeof rec.cleared !== 'boolean' || (rec.bestTime != null && !Number.isFinite(rec.bestTime))
            || (rec.losses !== undefined && !(Number.isInteger(rec.losses) && rec.losses >= 0)))) {
            throw new Error('스테이지 기록의 모양이 올바르지 않습니다.');
        }
    }
    if (data.options && Object.values(data.options).some(v => !Array.isArray(v) || v.some(id => typeof id !== 'string'))) {
        throw new Error('파츠 옵션의 모양이 올바르지 않습니다.');
    }
    if (data.skins !== undefined && (!object(data.skins) || !Array.isArray(data.skins.owned) || data.skins.owned.some(id => typeof id !== 'string')
        || !object(data.skins.equipped) || Object.values(data.skins.equipped).some(id => typeof id !== 'string'))) {
        throw new Error('캐릭터 외형의 모양이 올바르지 않습니다.');
    }
    if (data.modules !== undefined && (!object(data.modules)
        || ['owned', 'equipped'].some(key => data.modules[key] !== undefined && !Array.isArray(data.modules[key]))
        || (data.modules.levels !== undefined && !object(data.modules.levels)))) {
        throw new Error('전술 모듈의 모양이 올바르지 않습니다.');
    }
    if (data.dispatch !== undefined && (!Array.isArray(data.dispatch) || data.dispatch.some(v => !object(v)))) {
        throw new Error('파견 기록의 모양이 올바르지 않습니다.');
    }
    if (entries.mo_v2_settings !== undefined) {
        const settings = JSON.parse(entries.mo_v2_settings);
        if (!object(settings)) throw new Error('설정 데이터의 모양이 올바르지 않습니다.');
        for (const key of ['master', 'sfx', 'bgm']) {
            if (settings[key] !== undefined && (!Number.isFinite(settings[key]) || settings[key] < 0 || settings[key] > 1)) {
                throw new Error('설정 음량이 올바르지 않습니다.');
            }
        }
        for (const key of ['mute', 'shake', 'sharp']) {
            if (settings[key] !== undefined && typeof settings[key] !== 'boolean') throw new Error('설정 스위치 값이 올바르지 않습니다.');
        }
    }
    if (entries.mo_v2_auto_skill !== undefined && !['0', '1'].includes(entries.mo_v2_auto_skill)) {
        throw new Error('스킬 자동 사용 값이 올바르지 않습니다.');
    }
}

export function importSave(code) {
    let entries;
    try {
        if (typeof code !== 'string' || !code.trim().startsWith('MO1:')) throw new Error('백업 코드의 앞머리가 MO1:이 아닙니다.');
        const parts = code.trim().split(':');
        if (parts.length !== 3 || !/^[A-Za-z0-9+/]+={0,2}$/.test(parts[1]) || parts[1].length % 4 !== 0) {
            throw new Error('백업 코드의 base64가 깨졌습니다.');
        }
        const binary = atob(parts[1]);
        if (btoa(binary) !== parts[1]) throw new Error('백업 코드의 base64가 깨졌습니다.');
        if (checksum(parts[1]) !== parts[2]) throw new Error('백업 코드의 확인값이 다릅니다. 코드를 다시 확인해 주세요.');
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
        if (!object(data)) throw new Error('백업 JSON의 모양이 올바르지 않습니다.');
        entries = data.entries;
        validate(entries);
    } catch (e) {
        const reason = e instanceof SyntaxError ? '백업 JSON을 읽을 수 없습니다.'
            : e instanceof TypeError ? '백업 데이터의 문자 인코딩이 올바르지 않습니다.' : e.message;
        return { success: false, reason };
    }
    const before = new Map();
    try {
        const keys = new Set([...backupKeys(), ...Object.keys(entries)]);
        keys.forEach(key => before.set(key, load(key)));
        keys.forEach(key => {
            if (Object.hasOwn(entries, key)) store.save(key, entries[key]);
            else store.remove(key);
        });
    } catch (e) {
        before.forEach((value, key) => {
            try { if (value == null) store.remove(key); else store.save(key, value); } catch (err) { /* 저장소 복구 불가 */ }
        });
        return { success: false, reason: '저장소에 백업을 쓰지 못했습니다.' };
    }
    Object.entries(entries).forEach(([key, value]) => {
        knownKeys.add(key);
        listeners.forEach(fn => { try { fn(key, value); } catch (e) { /* 동기화 오류 무시 */ } });
    });
    location.reload();
    return { success: true };
}
