/* ==========================================================================
   거점 건물 그림·상태 (로드맵 C단계)
   - 그림: stageArt_v2.js (tools/images/build_bases.py가 Gemini 그림에서 만듦) — 그림 이름별(bunker, tower, gate, furnace, barricade)
   - 구역마다 요새·기지에 쓸 그림: 스테이지(챕터)의 art { mid, final }, 없으면 구역 1 그림
   - 상태: 온전 → 체력 BASE_STATE.damaged 이하면 파손 → 파괴 연출의 대폭발 때 붕괴(잔해)
   - 요새 잔해는 그 자리에 남았다가, 주인공이 다시 걸으면(배경이 흐르면) 바닥과 함께 왼쪽으로 흘러 나감
   - 그림이 없으면(stageArt_v2.js에 없음) 예전 임시 상자로 그림
   ========================================================================== */

import { BASE_ART } from './stageArt_v2.js';

// 바닥이 흐르는 속도(px/초): index.css .walking .bg-layer.ground = 폭 200%(2560px)를 3초에 절반 이동
export const GROUND_SPEED = 1280 / 3;
export const BASE_STATE = { damaged: 0.5, ruinHold: 1.4 };   // 파손 체력 비율, 요새 붕괴 뒤 머무는 시간(초)
const GROUND_B = 60;
const OLD_BOX = { mid: { w: 90, h: 150 }, final: { w: 120, h: 200 } };
const DEFAULT_ART = { mid: 'bunker', final: 'tower' };   // 구역 1 (그림 이름)

/** 이 스테이지의 요새(kind 'mid')·기지('final')에 쓸 그림 이름 */
export const baseArtName = (stage, kind) => (stage && stage.art && stage.art[kind]) || DEFAULT_ART[kind];

/** 로딩 화면에서 미리 받을 그림 — 그림 이름을 주면 그 그림들만 (새 기획 거점 80장이 더해져 쓰는 구역 것만 받음, D-085) */
export const BASE_IMAGES = Object.values(BASE_ART).flatMap(a => a.src);
export const baseImagesFor = names => [...new Set(names)].flatMap(n => (BASE_ART[n] ? BASE_ART[n].src : []));

export const baseArt = art => BASE_ART[art] || null;
export const baseSize = (art, kind) => BASE_ART[art] || OLD_BOX[kind];

/** 적·스킬이 겨누는 곳 (건물은 몸통 가운데) */
export function aimAt(e) {
    if (e.isBarricade) return { x: e.x + e.size.w / 2, b: GROUND_B + e.size.h * 0.45 };
    if (!e.isBuilding) return { x: e.x + 38, b: 90 };
    const s = e.size || OLD_BOX[e.isFinal ? 'final' : 'mid'];
    return { x: e.x + s.w / 2, b: GROUND_B + Math.min(s.h, 220) * 0.45 };
}

/** 건물 DOM을 그림으로 꾸밈 (그림이 없으면 그대로 임시 상자). name = 그림 이름, kind = 'mid' | 'final' */
export function dressBase(el, name, kind) {
    const art = BASE_ART[name];
    if (!art) return;
    el.classList.add('v2-base', `v2-base--${kind}`);
    el.style.width = `${art.w}px`;
    el.style.height = `${art.h}px`;
    el.style.bottom = `${GROUND_B - art.sink}px`;
    setBaseState(el, name, 0);
}

/** 0 온전 / 1 파손 / 2 붕괴 (상태 그림이 없으면 마지막 그림) */
export function setBaseState(el, name, state) {
    const art = BASE_ART[name];
    if (!art || !el) return;
    state = Math.min(state, art.src.length - 1);
    el.style.backgroundImage = `url('${art.src[state]}')`;
    el.dataset.state = String(state);
    el.classList.toggle('is-ruin', state === 2);
}
