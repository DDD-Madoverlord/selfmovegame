/* ==========================================================================
   PROJECT: MAD OVERLORD // 서리의 무희 얼음 이펙트 공용 묶음 (D-137, 2026-11-16 — 기본 스킬 + 2차 세트 9개)
   물건 그림 frost_set (Gemini 한 장 3×2칸 → tools/images/build_saint_set.py frost_set, 불투명 → blend 'normal'):
     0 얼음 감옥 블록(바닥 평평) · 1 큰 눈꽃 · 2 얼음 창(오른쪽) · 3 흑조(오른쪽으로 남) · 4 얼음 별 표창 · 5 빙하 덩어리
   기존 얼음 시트: ice_shatter(바닥에서 솟는 얼음 결정 → 깨짐) · ice_burst(초승달 → 터짐) · xcut_cyan · eternal_winter(눈꽃 고리)
   · frost_wolf · glacier_giant · feather_black · moon_fall · aurora_ribbon.  색은 얼음 하늘색·흰 서리 계통
   ========================================================================== */

import { spr, fxOf } from '../skillKit_v2.js';

export const ICE_C = '150, 220, 255', FROST_W = '220, 242, 255', SNOW_C = '235, 245, 255', DEEP_C = '90, 150, 210';
export const FS = (frame, size, o = {}) => spr('frost_set', size, { frameRange: [frame, frame], blend: 'normal', ...o });

/** 얼음 감옥: 발밑에서 얼음이 솟아 반투명 얼음 블록이 몸을 가둠 → sec초 남음 (깨짐은 따로 ICE_BREAK) */
export const ICE_PRISON = (sec, size = 150) => fxOf(
    spr('ice_shatter', size * 0.9, { frameRange: [0, 2], dur: 0.25, anchorY: 0.9 }),
    FS(0, size, { at: 0.08, dur: sec, anchorY: 0.88, alpha: 0.6, popIn: 0.18, fadeIn: 0.05, fadeOut: 0.15 }),
    { type: 'crystals', at: 0.05, dur: sec, count: 5, h: size * 0.25, spread: size * 0.28, color: ICE_C },
    { type: 'mist', at: 0, r: size * 0.32, h: 10, life: Math.max(0.6, sec), drift: 8, color: '110, 160, 200' },
    { type: 'flash', at: 0.08, dur: 0.14, r: size * 0.22, color: FROST_W, dy: -size * 0.35 });

/** 얼음 깨짐: 감옥·빙결이 한꺼번에 부서짐 — 얼음 결정 깨짐 + 조각 + 번쩍 + 고리 */
export const ICE_BREAK = (size = 170) => fxOf(
    spr('ice_shatter', size, { frameRange: [3, 8], dur: 0.6, anchorY: 0.88, glow: 1.25 }),
    { type: 'flash', at: 0, dur: 0.16, r: size * 0.28, color: FROST_W, dy: -size * 0.3 },
    { type: 'shards', at: 0, count: 12, speed: 340, size: 6, spin: 9, life: [0.7, 1.1], shape: 'ice', floor: 0, color: '190, 230, 255', dy: -size * 0.3 },
    { type: 'shockwave', at: 0, dur: 0.4, r: size * 0.55, width: 7, ground: true, color: ICE_C },
    { type: 'motes', at: 0.04, count: 8, spread: 24, rise: [20, 65], life: [0.6, 1], size: 2.2, color: FROST_W, dy: -size * 0.25 });

/** 얼음 싹: 바닥에서 얼음 결정이 솟았다 부서짐 (땅을 따라 나아가는 얼음 줄기 한 칸) */
export const ICE_SPROUT = (size = 110, alpha = 1) => fxOf(   // 가운데 하얀 터짐 칸(3~5)은 건너뜀 — 줄지어 겹치면 하얀 덩어리로 보임
    spr('ice_shatter', size, { frameRange: [1, 2], dur: 0.32, anchorY: 0.9, glow: 1, alpha }),
    spr('ice_shatter', size, { at: 0.32, frameRange: [6, 8], dur: 0.35, anchorY: 0.9, alpha: 0.8 * alpha, glow: 1 }),
    { type: 'mist', at: 0, r: size * 0.3, h: 7, life: 0.7, drift: 10, color: '110, 160, 200' });

/** 얼음 맞음 (가슴 높이): 얼음 터짐 + 조각 */
export const ICE_HIT = (size = 120, o = {}) => fxOf(
    spr('ice_burst', size, { frameRange: [3, 8], dur: 0.45, ...o }),
    { type: 'shards', at: 0, count: 6, speed: 220, size: 4.5, spin: 9, life: [0.6, 1], shape: 'ice', floor: 30, color: '190, 230, 255' });

/** 눈 내림 / 눈보라 (화면 위끝부터) — 층 하나 (fxOf 안에 넣어 씀) */
export const SNOW_FALL = (w, sec, o = {}) => ({ type: 'snowFall', at: 0, dur: sec, w, count: 90, top: -10, ...o });
