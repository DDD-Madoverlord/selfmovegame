/* ==========================================================================
   PROJECT: MAD OVERLORD // 로딩 화면 (v2)
   v2 시작 시 캐릭터 리그 그림 4종, 전장 스프라이트, 효과음을 미리 받으며 진행 바를 보여준다.
   (받는 동안 메인 화면이 뒤에서 준비되고, 끝나면 로딩 화면이 사라진다)
   ========================================================================== */

import { RIG_CHARACTERS } from '../engine_v2/rig/characters.js';
import { loadRigAssets } from '../engine_v2/rig/rigAvatar.js';
import { sound, SFX } from '../engine_v2/audio/sound_v2.js';
import { baseImagesFor } from '../engine_v2/bases_v2.js';
import { CHAPTERS } from '../engine_v2/stages_v2.js';

const IMAGES = ['assets/sprites/rig/kaiju/baby_walk.png', 'assets/sprites/rig/minion/minion_walk.webp', 'assets/sprites/rig/minion/minion_attack.webp', 'assets/sprites/enemy/goblin_walk_sheet.png', 'assets/sprites/stage/bg/hall.webp', 'assets/sprites/stage/bg/hall_alarm.webp', 'assets/sprites/stage/bg/machinery.webp', 'assets/sprites/stage/bg/floor.webp', 'assets/sprites/stage/bg/hangar.webp',
    'assets/sprites/stage/st1/far.webp', 'assets/sprites/stage/st1/far_boss.webp', 'assets/sprites/stage/st1/mid.webp', 'assets/sprites/stage/st1/floor.webp',
    'assets/sprites/stage/st2/far.webp', 'assets/sprites/stage/st2/far_boss.webp', 'assets/sprites/stage/st2/mid.webp', 'assets/sprites/stage/st2/floor.webp',
    ...baseImagesFor(CHAPTERS.flatMap(ch => Object.values(ch.art || {})).concat(['bunker', 'tower', 'barricade']))];   // 지금 구역들이 쓰는 거점 그림 (+ 기본 그림)
const MIN_SHOW_MS = 700;   // 너무 빨리 깜빡이지 않게

function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
    });
}

export async function runLoading() {
    const el = document.createElement('div');
    el.className = 'v2-loading';
    el.innerHTML = `
        <div class="v2-loading__box">
            <small>SECTOR 07 // OPERATION: OVERLORD</small>
            <h1>MAD OVERLORD</h1>
            <div class="v2-loading__bar"><i></i></div>
            <p><span class="v2-loading__label">시스템 기동 중</span><b class="v2-loading__pct">0%</b></p>
        </div>`;
    document.body.appendChild(el);
    const bar = el.querySelector('.v2-loading__bar i');
    const label = el.querySelector('.v2-loading__label');
    const pct = el.querySelector('.v2-loading__pct');
    const started = performance.now();

    const tasks = [
        ...Object.values(RIG_CHARACTERS).map(c => [`${c.name} 조립 중`, () => loadRigAssets(c)]),
        ...IMAGES.map(src => ['전장 준비 중', () => loadImage(src)]),
        ['사운드 준비 중', () => {
            sound.unlock();
            return Promise.all(Object.keys(SFX).map(name => sound.load(name)));
        }]
    ];
    let done = 0;
    await Promise.all(tasks.map(([text, fn]) => Promise.resolve()
        .then(fn)
        .catch(() => { /* 실패한 항목은 건너뜀 (게임 중 다시 시도) */ })
        .then(() => {
            done += 1;
            const p = Math.round((done / tasks.length) * 100);
            bar.style.width = `${p}%`;
            pct.textContent = `${p}%`;
            label.textContent = done === tasks.length ? '출격 준비 완료' : text;
        })));

    const wait = MIN_SHOW_MS - (performance.now() - started);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    el.classList.add('is-done');
    setTimeout(() => el.remove(), 450);
}
