/* ==========================================================================
   PROJECT: MAD OVERLORD // 게임 설정 (v2)
   음량(전체/효과음/배경음), 음소거, 화면 흔들림, 선명한 그림(캔버스 고해상도 — displayRes.js). 브라우저(localStorage)에 저장해 다음 실행에도 유지.
   settings.get(key) / settings.set(key, value) / settings.subscribe(fn)
   ========================================================================== */

import * as saveStore from './saveStore_v2.js';

const KEY = 'mo_v2_settings';
// layout: 화면 배치 'auto'(휴대폰·태블릿이면 휴대폰 배치, PC는 예전 배치) | 'mobile' | 'pc' — main_v2.js fitScreens (Q-015)
export const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.9, bgm: 0.5, mute: false, shake: true, sharp: true, layout: 'auto' };

function load() {
    try {
        const raw = JSON.parse(saveStore.load(KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...raw };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

export const settings = {
    values: load(),
    listeners: new Set(),

    get(key) {
        return this.values[key];
    },

    set(key, value) {
        if (this.values[key] === value) return;
        this.values[key] = value;
        saveStore.save(KEY, JSON.stringify(this.values));
        this.listeners.forEach(fn => fn(key, value));
    },

    reset() {
        Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => this.set(k, v));
    },

    /** fn(key, value). 해제 함수 반환 */
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
};
