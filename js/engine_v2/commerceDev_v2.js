/* 시험은 후보 환경 + 명시적 활성화일 때만. 일반 저장에는 쓰지 않는다. */
import * as saveStore from './saveStore_v2.js';

let enabled = false;
export function commerceEnvironment(env = globalThis) {
    const loc = env.location || {};
    const appDev = !!env.Capacitor?.Plugins?.AppUpdate;
    const app = !!env.madOverlordApp || !!env.Capacitor?.isNativePlatform?.();
    const local = !app && ['http:', 'https:'].includes(loc.protocol)
        && ['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname);
    return { candidate: appDev || local, appDev, environment: appDev ? 'app-dev' : local ? 'local' : 'public' };
}
export function isMockCommerce() { return enabled && commerceEnvironment().candidate; }
export function initCommerceDev({ env = globalThis, explicit = false } = {}) {
    const info = commerceEnvironment(env);
    if (!info.candidate || !(explicit || new URLSearchParams(env.location?.search || '').get('mockCommerce') === '1')) return false;
    if (enabled) return true;
    const copy = new Map(['mo_v2_save', 'mo_v2_settings', 'mo_v2_auto_skill'].map(key => [key, saveStore.load(key)]));
    saveStore.setSaveStore({
        load: key => copy.get(key) ?? null,
        save: (key, value) => copy.set(key, value),
        remove: key => copy.delete(key),
        keys: () => copy.keys()
    });
    enabled = true;
    return true;
}
