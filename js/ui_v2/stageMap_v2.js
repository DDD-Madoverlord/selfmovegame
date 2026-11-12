/* ==========================================================================
   PROJECT: MAD OVERLORD // 스테이지 지도 (v2) — 메인 화면 STORY MAP (menu_v2.js, D-104 · 2026-11-04)
   레이더 점 대신 구역마다 그린 지도(16비트 RPG 월드맵) 위 길을 따라 정거장 11곳.
   정거장마다 그 판에서 처음 나오는 적이 NPC처럼 서 있고(보스는 크게), 고른 판에는 내 캐릭터가 마주 서 있음.
   - 구역 번호 탭(1~10) 없음: 지도를 좌우로 밀어서(‹ › 단추·키보드 ← → 도 됨) 구역을 넘김, 아래 점은 지금 위치만
   - 정거장을 누르면 캐릭터가 길을 따라 걸어가서 그 판을 고름 (잠긴 판은 검은 실루엣, 누르면 흔들림)
   - 깬 판: 오버로드 점령 문장(육각 배지) + 별, 다음에 깰 판: NPC 위 '!' · 걷는 동작, 잠긴 구역: 안개 + 자물쇠
   - 화면이 지도보다 납작하면(휴대폰 전체 화면) 고른 정거장을 따라 위아래로 카메라가 움직임
   좌표는 지도 그림(1024×572, tools/images/build_map_art.py) 기준 px. 시안 찍기: tools/mockups/stage_map_mock.py
   ========================================================================== */

import { ENEMY_ART } from '../engine_v2/enemyArt_v2.js';
import { RigAvatar, rigConfigFor } from '../engine_v2/rig/rigAvatar.js';
import { icon } from './icons.js';

const MAP_W = 1024;
const MAP_H = 572;
// route = 길이 꺾이는 점(지도 px), stops = 정거장 11곳(route 번호, 마지막이 보스)
export const MAP_ROUTES = {
    1: {
        art: 'assets/sprites/stage/map/zone1.webp',
        route: [[40, 392], [88, 396], [160, 392], [190, 350], [190, 209], [225, 150], [297, 136], [365, 140], [399, 185], [399, 209], [412, 250],
            [415, 290], [420, 340], [426, 365], [460, 425], [528, 445], [600, 440], [640, 395], [640, 358], [640, 289], [650, 240], [662, 215],
            [700, 160], [748, 155], [800, 165], [832, 200], [832, 217], [860, 265], [900, 287], [935, 287]],
        stops: [1, 4, 6, 9, 13, 15, 18, 21, 23, 26, 29]
    },
    2: {
        art: 'assets/sprites/stage/map/zone2.webp',
        route: [[175, 84], [218, 86], [300, 87], [340, 100], [365, 121], [395, 150], [401, 188], [390, 225], [371, 258], [360, 300], [362, 335],
            [380, 375], [414, 401], [460, 418], [507, 420], [560, 395], [598, 365], [645, 368], [662, 400], [647, 437], [660, 470], [689, 494],
            [740, 505], [793, 501], [850, 485], [886, 461], [915, 420], [932, 380]],
        stops: [1, 4, 6, 8, 10, 12, 14, 16, 21, 23, 27]
    },
    3: {
        art: 'assets/sprites/stage/map/zone3.webp',
        route: [[180, 120], [195, 168], [230, 228], [205, 270], [190, 302], [177, 383], [210, 447], [277, 472], [340, 442], [382, 385], [432, 330],
            [507, 288], [590, 258], [672, 270], [722, 315], [728, 387], [770, 448], [843, 473], [908, 437], [930, 368]],
        stops: [1, 4, 6, 8, 10, 11, 13, 15, 16, 17, 19]
    },
    4: {
        art: 'assets/sprites/stage/map/zone4.webp',
        route: [[30, 284], [118, 272], [150, 230], [200, 176], [245, 138], [300, 122], [355, 135], [398, 178], [418, 240], [437, 320], [452, 400],
            [520, 450], [580, 415], [608, 320], [625, 235], [700, 175], [742, 215], [765, 318], [785, 385], [845, 425], [915, 380], [940, 285]],
        stops: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]
    },
    5: {
        art: 'assets/sprites/stage/map/zone5.webp',
        route: [[205, 152], [280, 150], [330, 118], [385, 85], [455, 84], [515, 125], [550, 160], [565, 186], [535, 225], [506, 267], [525, 300],
            [580, 322], [615, 360], [585, 400], [549, 452], [570, 495], [632, 512], [715, 510], [770, 460], [830, 410], [900, 395], [945, 400]],
        stops: [1, 3, 4, 5, 7, 9, 12, 14, 16, 18, 21]
    },
    6: {
        art: 'assets/sprites/stage/map/zone6.webp',
        route: [[20, 275], [100, 275], [162, 275], [195, 305], [200, 358], [205, 420], [240, 455], [300, 462], [370, 458], [410, 435], [435, 395],
            [455, 358], [485, 315], [510, 280], [525, 215], [578, 185], [630, 195], [655, 245], [660, 360], [670, 430], [710, 460], [770, 462],
            [850, 462], [935, 460]],
        stops: [1, 2, 4, 7, 9, 11, 13, 15, 18, 21, 23]
    },
    7: {
        art: 'assets/sprites/stage/map/zone7.webp',
        route: [[25, 258], [88, 260], [208, 260], [238, 295], [247, 345], [270, 400], [337, 440], [400, 410], [420, 330], [433, 257], [470, 210],
            [522, 193], [590, 205], [638, 265], [650, 350], [680, 420], [745, 460], [800, 420], [817, 345], [835, 275], [885, 230]],
        stops: [1, 2, 4, 6, 9, 11, 13, 14, 16, 18, 20]
    },
    8: {
        art: 'assets/sprites/stage/map/zone8.webp',
        route: [[100, 530], [108, 465], [95, 370], [108, 262], [115, 195], [135, 148], [180, 105], [238, 88], [310, 110], [350, 170], [335, 240],
            [325, 312], [345, 400], [412, 465], [480, 430], [513, 368], [515, 250], [530, 175], [568, 142], [630, 125], [685, 165], [700, 250],
            [710, 342], [760, 430], [840, 465], [925, 462], [960, 400], [960, 300], [925, 205]],
        stops: [1, 3, 7, 9, 11, 13, 15, 18, 22, 25, 28]
    },
    9: {
        art: 'assets/sprites/stage/map/zone9.webp',
        route: [[40, 192], [92, 193], [195, 193], [245, 215], [262, 268], [230, 310], [175, 350], [150, 385], [135, 425], [158, 465], [230, 480],
            [302, 477], [355, 428], [395, 395], [440, 382], [500, 385], [530, 415], [555, 440], [632, 477], [710, 462], [762, 410], [838, 370],
            [945, 365]],
        stops: [1, 2, 4, 7, 9, 11, 14, 17, 18, 20, 22]
    },
    10: {
        art: 'assets/sprites/stage/map/zone10.webp',
        route: [[30, 483], [135, 483], [205, 462], [252, 408], [270, 340], [285, 283], [312, 178], [345, 118], [413, 103], [480, 118], [512, 183],
            [512, 290], [512, 383], [530, 460], [578, 486], [630, 465], [645, 413], [665, 290], [690, 228], [725, 214], [765, 232], [785, 300],
            [805, 400], [857, 437], [920, 420], [943, 365], [928, 315]],
        stops: [1, 3, 6, 8, 10, 12, 14, 16, 19, 23, 26]
    }
};
// 지도 그림이 아직 없는 구역: 먼 배경을 흐리게 깔고 이 길
const FALLBACK = {
    route: [[80, 330], [170, 250], [260, 300], [340, 380], [430, 330], [510, 240], [600, 280], [690, 360], [780, 320], [860, 240], [940, 290]],
    stops: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
};
const WALK_SPEED = 260;   // 지도 px/초 — 리그 걷기 동작 1배에서 발이 땅과 거의 맞는 빠르기 (전투 바닥 427px/초 · 배율 0.235 기준 약 290)
const HERO_DX = -3.4;     // 캐릭터는 정거장 왼쪽(지도 폭 %), NPC는 오른쪽
const NPC_DX = 2.6;
const HERO_RIG = { width: 180, height: 180, rootX: 90, rootY: 170, scale: 0.3, fit: { x: 8, y: 6 }, shadow: true, fitCss: true };

const BOSS_HERO_DX = -8.5;   // 보스 판은 보스가 커서 더 왼쪽에 섬
const HERO_EDGE = 7;         // 캐릭터 가운데는 지도 왼쪽 끝에서 7% 안쪽까지만

const pct = ([x, y]) => [(x / MAP_W) * 100, (y / MAP_H) * 100];
export const plainName = name => name.replace(/^구역 \d+ · /, '');   // 번호 없이 '성왕국 수도: 피로 물든 순례길'
const routeOf = zone => MAP_ROUTES[zone] || FALLBACK;

/** 판마다 세울 NPC(적 종류): 그 판에서 처음 나오는 적 하나, 새 적이 없는 혼합 판은 셋, 보스 판은 보스 */
export function stageNpcs(ch) {
    const seen = new Set();
    let mixed = 0;
    return ch.stages.map(st => {
        if (st.boss) return [st.boss.unit];
        const mix = st.enemy.mix;
        const keys = Object.keys(mix).filter(k => ENEMY_ART[k]).sort((a, b) => mix[b] - mix[a]);
        const fresh = keys.filter(k => !seen.has(k));
        keys.forEach(k => seen.add(k));
        if (fresh.length) return [fresh[0]];
        const from = (mixed++ * 3) % Math.max(1, keys.length);
        return [0, 1, 2].map(i => keys[(from + i) % keys.length]).filter((k, i, a) => k && a.indexOf(k) === i);
    });
}

// 꺾은선의 부드러운 SVG 경로 (Catmull-Rom → 3차 베지어)
function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
}

function npcHtml(type, k, n, boss) {
    const a = ENEMY_ART[type];
    if (!a) return '';
    const h = Math.min(a.frameHeight / 92, boss ? 2.1 : 1.35) * (n > 1 ? 0.82 : 1);
    const spread = n > 1 ? [[0, 0], [2.1, -0.9], [2.4, 1.1]][k] : [0, 0];
    return `<i class="v2-smap__npc" style="--h:${h.toFixed(2)};--fw:${a.frameWidth};--fh:${a.frameHeight};--ax:${(a.anchorX / a.frameWidth).toFixed(3)};`
        + `--n:${a.walk.frames};--dur:${(a.walk.duration * 1.6).toFixed(2)}s;--dx:${(boss ? 0.6 : NPC_DX) + spread[0]};--dy:${spread[1]};z-index:${2 + k};`
        + `background-image:url('${a.walk.src}')"></i>`;
}

let styled = false;
function ensureStyles() {
    if (styled) return;
    styled = true;
    const el = document.createElement('style');
    el.id = 'v2-smap-style';
    el.textContent = `
.v2-smap { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; outline: none; background: #07090d; }
.v2-smap.is-paused * { animation-play-state: paused !important; }
.v2-smap__track { display: flex; width: 100%; height: 100%; will-change: transform; }
.v2-smap__page { flex: 0 0 100%; height: 100%; position: relative; overflow: hidden; container-type: size; }
.v2-smap__land { position: absolute; left: 50%; top: 0; width: max(100cqw, calc(100cqh * ${MAP_W / MAP_H})); aspect-ratio: ${MAP_W} / ${MAP_H};
    transform: translate(-50%, var(--cam, 0px)); container-type: inline-size; }
.v2-smap__art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; -webkit-user-drag: none; }
.v2-smap__art--far { filter: blur(3px) brightness(0.45) saturate(0.7); transform: scale(1.04); }
.v2-smap__land::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(4, 6, 10, 0.55)); }
.v2-smap__trail { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 1; }
.v2-smap__trail path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.v2-smap__trail .is-todo { stroke: rgba(10, 12, 18, 0.55); stroke-width: 5; stroke-dasharray: 2 9; }
.v2-smap__trail .is-done { stroke: #ffb020; stroke-width: 3.2; stroke-dasharray: 10 7; filter: drop-shadow(0 0 4px rgba(255, 160, 20, 0.9)); animation: v2-smap-march 1.2s linear infinite; }
@keyframes v2-smap-march { to { stroke-dashoffset: -17; } }
.v2-smap__stop { position: absolute; left: var(--x); top: var(--y); width: 9cqw; height: 11cqw; margin: -9cqw 0 0 -4.5cqw; padding: 0; border: 0; background: none; cursor: pointer; z-index: calc(10 + var(--z)); -webkit-tap-highlight-color: transparent; }
.v2-smap__stop.is-boss { width: 15cqw; height: 16cqw; margin: -14cqw 0 0 -7.5cqw; }
.v2-smap__at { position: absolute; left: 50%; bottom: 2cqw; width: 0; height: 0; }
.v2-smap__stop.is-boss .v2-smap__at { bottom: 2cqw; }
.v2-smap__pad { position: absolute; left: 0; top: 0; width: 4.4cqw; height: 1.9cqw; transform: translate(-50%, -50%); border-radius: 50%; border: 0.3cqw solid rgba(120, 128, 146, 0.55); background: rgba(0, 0, 0, 0.35); }
.is-boss .v2-smap__pad { width: 7.5cqw; height: 3.1cqw; border-color: rgba(255, 70, 60, 0.85); box-shadow: 0 0 1.4cqw rgba(255, 50, 40, 0.7); }
.is-cleared .v2-smap__pad { border-color: #e2a32a; background: rgba(60, 40, 6, 0.55); }
.is-open:not(.is-cleared) .v2-smap__pad { border-color: #ffcf5a; box-shadow: 0 0 1.2cqw rgba(255, 176, 32, 0.9); animation: v2-smap-pulse 1.1s ease-in-out infinite; }
.is-sel .v2-smap__pad { border-color: #fff; background: rgba(255, 190, 60, 0.35); box-shadow: 0 0 0 0.45cqw rgba(255, 176, 32, 0.55), 0 0 2.2cqw rgba(255, 176, 32, 0.95); }
@keyframes v2-smap-pulse { 50% { box-shadow: 0 0 2.4cqw rgba(255, 176, 32, 1); } }
.v2-smap__npc { position: absolute; left: calc(var(--dx) * 1cqw); top: calc(var(--dy) * 1cqw); --hh: calc(var(--h) * 6.4cqw); --ww: calc(var(--hh) * var(--fw) / var(--fh));
    width: var(--ww); height: var(--hh); transform: translate(calc(var(--ax) * -100%), -96%); background-repeat: no-repeat; background-size: auto 100%; background-position: 0 0;
    filter: drop-shadow(0 0.3cqw 0.25cqw rgba(0, 0, 0, 0.8)); transition: filter 0.3s; }
.is-open:not(.is-cleared) .v2-smap__npc, .is-sel .v2-smap__npc { animation: v2-smap-walk var(--dur) steps(var(--n)) infinite; }
@keyframes v2-smap-walk { to { background-position-x: calc(var(--ww) * var(--n) * -1); } }
/* 깬 판 = 오버로드 점령 문장 (D-108): 메뉴 왼쪽 위 브랜드 문장과 같은 주황 육각형 + 뿔 가면을 정거장에 세움. 깬 판 적은 치우고, 그 판을 다시 고르면 적이 다시 섬 */
.v2-smap__clear { display: none; position: absolute; left: 0; top: -0.7cqw; width: 3.6cqw; height: 4.15cqw; transform: translate(-50%, -100%);
    filter: drop-shadow(0 0 0.7cqw rgba(255, 176, 32, 0.5)) drop-shadow(0 0.3cqw 0.25cqw rgba(0, 0, 0, 0.85)); }
.v2-smap__clear::after { content: ''; position: absolute; left: 50%; top: 100%; width: 0.32cqw; height: 0.7cqw; transform: translateX(-50%); background: #c97a10; }
.v2-smap__clear b { position: absolute; inset: 0; display: grid; place-items: center; background: #ffb020; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.v2-smap__clear b::before { content: ''; position: absolute; inset: 0.3cqw; background: radial-gradient(circle at 50% 40%, #3d2808, #0c0a08 75%); clip-path: inherit; }
.v2-smap__clear svg { position: relative; width: 64%; height: 64%; color: #ffb020; }
.is-boss .v2-smap__clear { width: 5.6cqw; height: 6.45cqw; top: -1cqw; }
.is-boss .v2-smap__clear b { background: linear-gradient(#ffd36a, #ff6a2a); }
.is-boss .v2-smap__clear svg { color: #ffd36a; }
.is-cleared:not(.is-sel) .v2-smap__clear { display: block; }
.is-cleared:not(.is-sel) .v2-smap__npc { display: none; }
.is-locked .v2-smap__npc { filter: brightness(0) drop-shadow(0 0 0.25cqw rgba(190, 200, 230, 0.45)); opacity: 0.85; }
.is-locked.is-boss .v2-smap__npc { filter: brightness(0) drop-shadow(0 0 0.6cqw rgba(255, 60, 50, 0.85)); }
.v2-smap__stars { position: absolute; left: 0; top: 1.4cqw; transform: translateX(-50%); display: flex; gap: 0.15cqw; color: #4a4f5c; filter: drop-shadow(0 0 0.2cqw #000); }
.v2-smap__stars svg { width: 1.7cqw; height: 1.7cqw; }
.v2-smap__stars .is-on { color: #ffc83a; }
.v2-smap__mark { position: absolute; left: calc((${NPC_DX} + 0.2) * 1cqw); top: -10.5cqw; transform: translateX(-50%); font: 900 4cqw/1 var(--v2-font, sans-serif); color: #ffd23a;
    -webkit-text-stroke: 0.35cqw #2a1600; paint-order: stroke; animation: v2-smap-bob 0.9s ease-in-out infinite; z-index: 9; }
@keyframes v2-smap-bob { 50% { transform: translate(-50%, -0.9cqw); } }
.v2-smap__q { position: absolute; left: calc(${NPC_DX} * 1cqw); top: -9cqw; transform: translateX(-50%); font: 900 2.6cqw/1 var(--v2-font, sans-serif); color: rgba(200, 210, 235, 0.7); }
.v2-smap__tag { position: absolute; left: 0; top: 3.5cqw; transform: translateX(-50%); white-space: nowrap; padding: 0.45cqw 1.3cqw; border-radius: 0.9cqw;
    background: rgba(12, 14, 19, 0.92); border: 0.2cqw solid #ffb020; font: 800 1.9cqw/1.2 var(--v2-font, sans-serif); color: #ffe2a0; z-index: 9; pointer-events: none; }
.v2-smap__tag small { display: block; font-size: 1.35cqw; color: #ff8a7a; letter-spacing: 0.1em; }
.v2-smap__stop.is-shake { animation: v2-smap-shake 0.34s; }
@keyframes v2-smap-shake { 25% { translate: -0.6cqw 0; } 75% { translate: 0.6cqw 0; } }
.v2-smap__hero { position: absolute; width: 9.5cqw; height: 9.5cqw; transform: translate(-50%, -94%); pointer-events: none; transition: opacity 0.25s; }
.v2-smap__hero.is-left { transform: translate(-50%, -94%) scaleX(-1); }
.v2-smap__hero.is-warp { opacity: 0; }
.v2-smap__fog { position: absolute; inset: 0; z-index: 300; display: grid; place-content: center; justify-items: center; gap: 1.2cqh; text-align: center;
    background: radial-gradient(ellipse at 50% 50%, rgba(6, 8, 12, 0.55), rgba(6, 8, 12, 0.92)); color: #c6ccda; }
.v2-smap__fog svg { width: 9cqh; height: 9cqh; color: #8b93a6; }
.v2-smap__fog strong { font: 900 7cqh/1.15 var(--v2-font, sans-serif); color: #e8ecf4; }
.v2-smap__fog small { font: 600 4.6cqh/1.3 var(--v2-font, sans-serif); color: #9aa2b4; }
/* 옆 구역 단추: 가장자리의 가는 띠 (화살표 + 세로 글씨 옆 구역 이름) — 구역 첫 판에 선 캐릭터를 덜 가리게 */
.v2-smap__nav { position: absolute; top: 50%; z-index: 400; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 22px; padding: 10px 0; border: 0; background: rgba(8, 10, 14, 0.55); color: #ffb020; cursor: pointer; }
.v2-smap__nav small { writing-mode: vertical-rl; font: 700 10px/1 var(--v2-font, sans-serif); letter-spacing: 1px; color: #c6ccda; white-space: nowrap; max-height: 8.5em; overflow: hidden; }
.v2-smap__nav i { width: 8px; height: 8px; margin-left: 3px; border: solid currentColor; border-width: 0 0 3px 3px; transform: rotate(45deg); }
.v2-smap__nav--next i { margin: 0 3px 0 0; transform: rotate(-135deg); }
.v2-smap__nav--prev { left: 0; border-radius: 0 8px 8px 0; } .v2-smap__nav--next { right: 0; border-radius: 8px 0 0 8px; }
.v2-smap__nav:hover { background: rgba(8, 10, 14, 0.85); }
.v2-smap__nav[hidden] { display: none; }
.v2-smap__dots { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 400; display: flex; gap: 6px; padding: 5px 9px; border-radius: 99px; background: rgba(8, 10, 14, 0.6); pointer-events: none; }
.v2-smap__dots i { width: 7px; height: 7px; border-radius: 99px; background: #5a6276; transition: width 0.25s, background 0.25s; }
.v2-smap__dots i.is-locked { background: #2c313c; }
.v2-smap__dots i.is-here { box-shadow: 0 0 0 2px rgba(255, 176, 32, 0.6); }
.v2-smap__dots i.is-on { width: 22px; background: #ffb020; }
body.v2-mobile .v2-smap__nav { width: 46px; padding: 18px 0; gap: 12px; } body.v2-mobile .v2-smap__nav small { font-size: 20px; }
body.v2-mobile .v2-smap__nav i { width: 18px; height: 18px; margin-left: 6px; border-width: 0 0 6px 6px; } body.v2-mobile .v2-smap__nav--next i { margin: 0 6px 0 0; }
body.v2-mobile .v2-smap__dots { gap: 10px; bottom: 12px; } body.v2-mobile .v2-smap__dots i { width: 12px; height: 12px; } body.v2-mobile .v2-smap__dots i.is-on { width: 36px; }
`;
    document.head.appendChild(el);
}

export class StageMap {
    /**
     * @param {HTMLElement} host 지도를 채울 상자 (레이더 화면 .v2-radar__screen)
     * @param {Object} opts { onSelect(stageId) — 걸어간 뒤, onZone(zone) — 다른 열린 구역으로 넘겼을 때, onView(page) — 넘길 때마다(머리 이름),
     *                       onLocked(stage|page) — 잠긴 판·구역을 눌렀을 때 }
     */
    constructor(host, opts = {}) {
        ensureStyles();
        this.opts = opts;
        this.pages = [];
        this.index = 0;
        this.sel = null;
        this.hero = null;
        this.walking = null;
        this.look = null;   // 손으로 위아래로 끈 지도 위치 { page, y: 화면 가운데의 지도 높이 % } — 걷거나 구역을 넘기면 다시 캐릭터를 따라감
        this.active = true;
        this.walkSpeed = WALK_SPEED;   // 지도 px/초 (Q-022 비교: 지금 그대로 두기로 함 — D-108)
        this.root = document.createElement('div');
        this.root.className = 'v2-smap';
        this.root.tabIndex = 0;
        this.root.setAttribute('role', 'region');
        this.root.setAttribute('aria-label', '스테이지 지도 — 좌우로 밀어 구역 넘기기');
        this.root.innerHTML = '<div class="v2-smap__track"></div>'
            + '<button class="v2-smap__nav v2-smap__nav--prev" aria-label="이전 구역"><i></i><small></small></button>'
            + '<button class="v2-smap__nav v2-smap__nav--next" aria-label="다음 구역"><i></i><small></small></button><div class="v2-smap__dots"></div>';
        host.prepend(this.root);
        this.track = this.root.querySelector('.v2-smap__track');
        this.root.querySelector('.v2-smap__nav--prev').addEventListener('click', () => this.go(this.index - 1));
        this.root.querySelector('.v2-smap__nav--next').addEventListener('click', () => this.go(this.index + 1));
        this.root.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') this.go(this.index - 1);
            else if (e.key === 'ArrowRight') this.go(this.index + 1);
        });
        this._bindSwipe();
        this.resizeObs = new ResizeObserver(() => this._camera(true));
        this.resizeObs.observe(this.root);
    }

    /**
     * pages: [{ zone, name, open, lockText, nodes: [{ id, name, boss, state: 'cleared'|'open'|'locked', stars: [bool×3], npcs: [적 종류] }] }]
     * selected: 고른 스테이지 id (그 구역 지도로 넘어가고 캐릭터가 그 정거장에 섬)
     */
    setPages(pages, selected) {
        const same = this.pages.length === pages.length && this.pages.every((p, i) => p.zone === pages[i].zone);
        this.pages = pages;
        if (!same) this.track.innerHTML = pages.map(p => `<section class="v2-smap__page" data-zone="${p.zone}"></section>`).join('');
        const moved = selected !== this.sel;
        this.sel = selected;
        pages.forEach((p, i) => this._renderPage(i));
        const at = this._find(selected);
        if (at) {
            if (moved || !same) this.go(at.page, { instant: !same, silent: true });
            this._placeHero(at, moved && same);
        }
        this._chrome();
    }

    /** 고른 캐릭터(리그)와 장착 파츠 객체 (gameState.getEquippedObjects) — 바뀌었을 때만 리그에 반영 */
    setHero(character, parts) {
        const key = `${character}|${['head', 'arm', 'body', 'leg'].map(s => parts?.[s]?.id).join(',')}`;
        if (key === this.heroKey) return;
        this.heroKey = key;
        this.heroChar = character;
        this.heroParts = parts;
        if (this.hero) this._applyHero();
    }

    /** 보일 때만 움직임 (메인 화면 밖·휴대폰에서 스테이지 선택을 닫았을 때·SPECIAL MAP이면 멈춤) */
    setActive(on) {
        if (this.active === on) return;
        this.active = on;
        this.root.classList.toggle('is-paused', !on);
        if (!this.hero) return;
        if (on) this.hero.rig.start();
        else this.hero.rig.stop();
    }

    /** 지금 보고 있는 구역 (머리 이름) */
    get viewed() {
        return this.pages[this.index];
    }

    go(i, { instant = false, silent = false } = {}) {
        if (!this.pages.length) return;
        const to = Math.max(0, Math.min(this.pages.length - 1, i));
        this.track.style.transition = instant ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        this.track.style.transform = `translateX(${-to * 100}%)`;
        const changed = to !== this.index;
        if (changed) this.look = null;
        this.index = to;
        this._chrome();
        if (changed) this.opts.onView?.(this.pages[to]);
        if (!silent && this.pages[to].open) this.opts.onZone?.(this.pages[to].zone);   // 받는 쪽이 이미 그 구역이면 그대로 둠
    }

    destroy() {
        this.resizeObs.disconnect();
        if (this.hero) this.hero.rig.stop();
        this.root.remove();
    }

    // ---- 그리기 ----
    _renderPage(i) {
        const p = this.pages[i];
        const el = this.track.children[i];
        const r = routeOf(p.zone);
        const src = MAP_ROUTES[p.zone] ? r.art : `assets/sprites/stage/st${p.zone}/far.webp`;
        // 길: 깬 곳까지(다음에 깰 정거장 포함) 주황 점선, 나머지는 어두운 점선
        const reach = p.nodes.reduce((m, n, k) => (n.state !== 'locked' ? k : m), -1);
        const cut = reach >= 0 ? r.stops[reach] : 0;
        const trail = `<svg class="v2-smap__trail" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none">`
            + `<path class="is-todo" d="${smoothPath(r.route)}"/>${p.open && reach > 0 ? `<path class="is-done" d="${smoothPath(r.route.slice(0, cut + 1))}"/>` : ''}</svg>`;
        const frontier = p.nodes.findIndex(n => n.state === 'open');
        const stops = p.nodes.map((n, k) => {
            const [x, y] = pct(r.route[r.stops[k]] || r.route[r.route.length - 1]);
            const cls = `v2-smap__stop is-${n.state}${n.state === 'cleared' ? ' is-open' : ''}${n.boss ? ' is-boss' : ''}${n.id === this.sel ? ' is-sel' : ''}`;
            const locked = n.state === 'locked' || !p.open;
            const stars = n.state === 'cleared' && !n.boss
                ? `<span class="v2-smap__stars">${n.stars.map(f => `<i class="${f ? 'is-on' : ''}">${icon('star', 12)}</i>`).join('')}</span>` : '';
            return `<button class="${cls}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--z:${Math.round(y) * 2}" data-id="${n.id}" aria-label="${n.name}${locked ? ' (잠김)' : n.state === 'cleared' ? ' (클리어)' : ''}">`
                + `<span class="v2-smap__at"><span class="v2-smap__pad"></span>${n.npcs.map((t, j) => npcHtml(t, j, n.npcs.length, n.boss)).join('')}${stars}`
                + (n.state === 'cleared' ? `<i class="v2-smap__clear"><b>${icon('overlord', 24)}</b></i>` : '')
                + (k === frontier && p.open ? '<b class="v2-smap__mark">!</b>' : '')
                + (locked && !n.boss ? '<b class="v2-smap__q">?</b>' : '')
                + (n.id === this.sel ? `<span class="v2-smap__tag">${n.boss ? '<small>BOSS</small>' : ''}${n.name}</span>` : '')
                + '</span></button>';
        }).join('');
        const fog = p.open ? '' : `<div class="v2-smap__fog">${icon('lock', 34)}<strong>${plainName(p.name)}</strong><small>${p.lockText || '잠김'}</small></div>`;
        // 지도 그림·캐릭터·카메라 위치는 그대로 두고 길·정거장·안개만 다시 (메인 화면 갱신마다 불림)
        let land = el.querySelector('.v2-smap__land');
        if (!land || land.dataset.art !== src) {
            el.innerHTML = `<div class="v2-smap__land" data-art="${src}"><img class="v2-smap__art${MAP_ROUTES[p.zone] ? '' : ' v2-smap__art--far'}" src="${src}" alt="" draggable="false"></div>`;
            land = el.firstChild;
        }
        [...land.children].forEach(c => { if (!c.matches('.v2-smap__art, .v2-smap__hero')) c.remove(); });
        el.querySelector('.v2-smap__fog')?.remove();
        land.insertAdjacentHTML('beforeend', trail + stops);
        if (fog) el.insertAdjacentHTML('beforeend', fog);
        if (this.hero && this.hero.page === i && this.hero.el.parentNode !== land) land.appendChild(this.hero.el);
        land.querySelectorAll('.v2-smap__stop').forEach(b => b.addEventListener('click', () => this._tap(i, b)));
    }

    _chrome() {
        const prev = this.pages[this.index - 1], next = this.pages[this.index + 1];
        const short = p => plainName(p.name).split(':')[0];   // '제14 비밀 벙커'
        const [bp, bn] = this.root.querySelectorAll('.v2-smap__nav');
        bp.hidden = !prev;
        bn.hidden = !next;
        if (prev) bp.querySelector('small').textContent = short(prev);
        if (next) bn.querySelector('small').textContent = short(next);
        const here = this._find(this.sel)?.page;
        this.root.querySelector('.v2-smap__dots').innerHTML = this.pages
            .map((p, i) => `<i class="${i === this.index ? 'is-on' : ''}${p.open ? '' : ' is-locked'}${i === here ? ' is-here' : ''}"></i>`).join('');
    }

    _find(id) {
        for (let page = 0; page < this.pages.length; page++) {
            const k = this.pages[page].nodes.findIndex(n => n.id === id);
            if (k >= 0) return { page, k };
        }
        return null;
    }

    // ---- 내 캐릭터 ----
    _applyHero() {
        const config = rigConfigFor(this.heroParts || {}, this.heroChar);
        const rig = this.hero.rig;
        rig.setCharacter(this.heroChar);
        if (config) {
            if (config.arm) rig.setArm(config.arm);
            rig.setPartFilters(config.filters);
            rig.setVariants(config.variants);
            rig.setUpgrades(config.upgrades);
        }
        if (this.active) rig.start();
    }

    _placeHero(at, walk) {
        if (!this.hero) {
            const el = document.createElement('canvas');
            el.className = 'v2-smap__hero';
            el.width = HERO_RIG.width;
            el.height = HERO_RIG.height;
            this.hero = { el, page: -1, pos: null, rig: new RigAvatar(el, { ...HERO_RIG, character: this.heroChar || 'mech' }) };
            this._applyHero();
        }
        const h = this.hero;
        const r = routeOf(this.pages[at.page].zone);
        const target = r.stops[at.k];
        if (walk && h.page === at.page && h.pos != null && (h.pos !== target || this.walking)) return this._walk(at.page, h.pos, target);
        if (this.walking) {   // 걷다가 순간 이동(다른 구역 등): 걷기를 멈춤 — 안 멈추면 걷기가 계속 자리를 덮어씀
            cancelAnimationFrame(this.walking.raf);
            this.walking = null;
            h.rig.setMode('idle');
        }
        // 다른 구역으로 넘어가면 그 지도로 순간 이동 (살짝 나타남)
        const land = this.track.children[at.page].querySelector('.v2-smap__land');
        if (h.el.parentNode !== land) {
            h.el.classList.add('is-warp');
            land.appendChild(h.el);
            requestAnimationFrame(() => h.el.classList.remove('is-warp'));
        }
        h.page = at.page;
        h.pos = target;
        this._heroAt(r.route[target], this._heroDx(at.page, target));
        h.el.classList.remove('is-left');
        this._camera(true);
    }

    _heroDx(page, routeIndex) {
        const r = routeOf(this.pages[page].zone);
        const dx = this.pages[page].nodes[r.stops.indexOf(routeIndex)]?.boss ? BOSS_HERO_DX : HERO_DX;
        return Math.max(dx, HERO_EDGE - pct(r.route[routeIndex])[0]);   // 왼쪽 끝 정거장: 옆 구역 단추에 덜 가리게 조금 안쪽
    }

    _heroAt([x, y], dx = this.hero.dx) {
        const [px, py] = pct([x, y]);
        this.hero.dx = dx;
        this.hero.el.style.left = `calc(${px.toFixed(2)}% + ${dx.toFixed(2)}cqw)`;
        this.hero.el.style.top = `${py.toFixed(2)}%`;
        this.hero.el.style.zIndex = 11 + Math.round(py) * 2;   // 정거장(10 + y×2)과 같은 깊이 순서
        this.hero.y = py;
    }

    /** 길(route 점 from → to)을 따라 걷기. 다 걸으면 onSelect
     *  걷는 중에 다시 누르면: 같은 곳이면 그대로 계속, 다른 곳이면 지금 서 있는 자리에서 이어 걸음
     *  (예전: 출발 정거장으로 돌아가 처음부터 다시 걸음 — 1 → 10 걷다가 10을 또 누르면 1부터, 11-07 QA) */
    _walk(page, from, to) {
        const h = this.hero;
        const route = routeOf(this.pages[page].zone).route;
        const w = this.walking && this.walking.page === page ? this.walking : null;
        if (w && w.to === to) return;
        const f = w ? w.f : from;                          // 길 위 지금 자리 (소수 = 두 점 사이)
        const step = f < to ? 1 : -1;
        const idx = [];
        for (let i = step > 0 ? Math.floor(f) + 1 : Math.ceil(f) - 1; step > 0 ? i <= to : i >= to; i += step) idx.push(i);
        const pts = [w ? w.cur : route[from], ...idx.map(i => route[i])];
        const fs = [f, ...idx];
        const id = this.pages[page].nodes[routeOf(this.pages[page].zone).stops.indexOf(to)]?.id;
        if (this.walking) cancelAnimationFrame(this.walking.raf);
        this.walking = null;
        const arrive = () => {
            this.walking = null;
            h.pos = to;
            h.rig.setMode('idle');
            h.el.classList.remove('is-left');   // 멈추면 NPC 쪽(오른쪽)을 봄
            if (id) this.opts.onSelect?.(id);
        };
        if (pts.length < 2) return arrive();
        const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
        const total = segs.reduce((a, b) => a + b, 0);
        const dur = Math.max(0.35, total / this.walkSpeed);
        h.rig.walkScale = Math.min(1, this.walkSpeed / WALK_SPEED);   // 느리게 하면 다리 동작도 같이 (발이 미끄러지지 않게)
        const dx0 = h.dx, dx1 = this._heroDx(page, to);
        this.look = null;
        h.rig.setMode('walk');
        const t0 = performance.now();
        const walking = { page, to, f, cur: pts[0], raf: 0 };
        const tick = now => {
            const t = Math.min(1, (now - t0) / 1000 / dur);
            let d = t * total, k = 0;
            while (k < segs.length - 1 && d > segs[k]) d -= segs[k++];
            const a = pts[k], b = pts[k + 1], u = segs[k] ? Math.min(1, d / segs[k]) : 1;
            walking.cur = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
            walking.f = fs[k] + (fs[k + 1] - fs[k]) * u;
            this._heroAt(walking.cur, dx0 + (dx1 - dx0) * t);
            if (Math.abs(b[0] - a[0]) > 2) h.el.classList.toggle('is-left', b[0] < a[0]);
            this._camera(false);
            if (t < 1) { walking.raf = requestAnimationFrame(tick); return; }
            arrive();
        };
        walking.raf = requestAnimationFrame(tick);
        this.walking = walking;
    }

    /** 화면이 지도보다 납작하면 캐릭터(없으면 다음 정거장) 높이에 맞춰 지도를 위아래로 옮김 — 손으로 끈 뒤에는 그 자리 */
    _camera(instant) {
        this.pages.forEach((p, i) => {
            const page = this.track.children[i];
            const land = page?.querySelector('.v2-smap__land');
            if (!land) return;
            const ph = page.clientHeight, lh = land.offsetHeight;
            let y = 50;
            if (this.look && this.look.page === i) y = this.look.y;
            else if (this.hero && this.hero.page === i && this.hero.y != null) y = this.hero.y - 4;
            else {
                const r = routeOf(p.zone);
                const k = Math.max(0, p.nodes.findIndex(n => n.state === 'open'));
                y = pct(r.route[r.stops[k]])[1] - 4;
            }
            const cam = Math.min(0, Math.max(ph - lh, ph / 2 - (y / 100) * lh));
            land.style.transition = instant ? 'none' : 'transform 0.15s linear';
            land.style.setProperty('--cam', `${cam.toFixed(1)}px`);
        });
    }

    // ---- 누르기 · 밀기 ----
    _tap(i, btn) {
        if (this.dragged) return;
        const p = this.pages[i];
        const n = p.nodes.find(x => x.id === btn.dataset.id);
        if (!p.open || !n || n.state === 'locked') {
            btn.classList.remove('is-shake');
            void btn.offsetWidth;
            btn.classList.add('is-shake');
            this.opts.onLocked?.(p.open ? n : p);   // 잠긴 구역이면 구역 안내 (여는 조건)
            return;
        }
        if (n.id === this.sel && !this.walking) return;
        if (this.hero && this.hero.page === i) {
            this.sel = n.id;
            this.track.children[i].querySelectorAll('.v2-smap__stop').forEach(b => b.classList.toggle('is-sel', b === btn));
            this._placeHero({ page: i, k: p.nodes.indexOf(n) }, true);
        } else this.opts.onSelect?.(n.id);
    }

    /** 지금 구역 지도를 위아래로 끌기 (화면이 지도보다 납작할 때만 — 휴대폰 가로에서 위·아래 정거장이 잘려 못 누르던 것) */
    _dragY(d) {
        const page = this.track.children[this.index];
        const land = page?.querySelector('.v2-smap__land');
        if (!land) return;
        const ph = page.clientHeight, lh = land.offsetHeight;
        if (lh <= ph + 1) return;
        if (d.cam0 == null) d.cam0 = parseFloat(land.style.getPropertyValue('--cam')) || 0;
        const cam = Math.min(0, Math.max(ph - lh, d.cam0 + d.dy));
        land.style.transition = 'none';
        land.style.setProperty('--cam', `${cam.toFixed(1)}px`);
        this.look = { page: this.index, y: (ph / 2 - cam) / lh * 100 };
    }

    _bindSwipe() {
        const vp = this.root;
        vp.addEventListener('pointerdown', e => {
            if (e.button > 0 || e.target.closest('.v2-smap__nav')) return;
            this.drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, on: false, id: e.pointerId };
        });
        vp.addEventListener('pointermove', e => {
            const d = this.drag;
            if (!d || e.pointerId !== d.id) return;
            d.dx = e.clientX - d.x0;
            d.dy = e.clientY - d.y0;
            if (!d.on && Math.max(Math.abs(d.dx), Math.abs(d.dy)) > 8) {   // 처음 움직인 방향으로 좌우(구역 넘기기)·위아래(지도 보기)를 가름
                d.on = Math.abs(d.dx) > Math.abs(d.dy) ? 'x' : 'y';
                vp.setPointerCapture(d.id);
                if (d.on === 'x') this.track.style.transition = 'none';
            }
            if (!d.on) return;
            if (d.on === 'y') { this._dragY(d); return; }
            const edge = (this.index === 0 && d.dx > 0) || (this.index === this.pages.length - 1 && d.dx < 0);
            this.track.style.transform = `translateX(calc(${-this.index * 100}% + ${(edge ? d.dx * 0.3 : d.dx).toFixed(1)}px))`;
        });
        const end = e => {
            const d = this.drag;
            if (!d || e.pointerId !== d.id) return;
            this.drag = null;
            if (!d.on) return;
            this.dragged = true;
            setTimeout(() => { this.dragged = false; }, 60);
            if (d.on === 'y') return;
            const w = vp.clientWidth;
            const v = d.dx / Math.max(1, performance.now() - d.t0);
            let to = this.index;
            if (d.dx < -w * 0.18 || v < -0.45) to++;
            else if (d.dx > w * 0.18 || v > 0.45) to--;
            this.go(to);   // 덜 밀었으면 제자리로 돌아감
        };
        vp.addEventListener('pointerup', end);
        vp.addEventListener('pointercancel', end);
        vp.addEventListener('wheel', e => {   // PC: 휠로 위아래
            if (!e.deltaY) return;
            e.preventDefault();
            this._dragY({ dy: -e.deltaY });
        }, { passive: false });
    }
}
