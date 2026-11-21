/* ==========================================================================
   PROJECT: MAD OVERLORD // 그림 캔버스 해상도 배율 (v2, Q-008 퀄리티업 Q1 "선명하게")
   1280x720 화면은 창 크기에 맞춰 CSS로 확대된다(main_v2.js fitScreens). 캔버스를 1배로 그리면 큰 화면에서 흐려지므로,
   캐릭터 리그(rigAvatar.js)·전투 이펙트(battleFx.js) 캔버스는 화면 맞춤 배율 × 기기 배율만큼 더 촘촘히 그린다.
   좌표는 그대로 CSS px — 그리기 직전에 배율만큼 늘린 변환을 씌움. 설정 "선명한 그림"을 끄거나 "저사양 모드"를 켜면 1배 (느린 기기).
   ========================================================================== */

import { settings } from './settings_v2.js';

export const MAX_RES = 2;   // 이펙트 캔버스가 화면 전체라 너무 크게 하지 않음 (1280x720 × 2 = 2560x1440)
let fitScale = 1;

/** main_v2.js fitScreens가 알려 주는 화면 맞춤 배율 */
export function setFitScale(k) {
    fitScale = Number.isFinite(k) && k > 0 ? k : 1;
}

/** 지금 쓸 해상도 배율 (1 ~ MAX_RES, 0.25 단위 반올림 — 창을 조금 바꿀 때마다 캔버스를 다시 만들지 않게.
 *  올림이면 1080p 전체 화면(1.506)이 1.75가 되어 픽셀을 괜히 많이 그림 — 성능 측정 2026-10-21) */
export function displayRes() {
    if (settings.get('sharp') === false || settings.get('lowSpec')) return 1;
    const r = fitScale * (window.devicePixelRatio || 1);
    return Math.max(1, Math.min(MAX_RES, Math.round(r * 4) / 4));
}
