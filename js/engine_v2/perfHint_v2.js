/* ==========================================================================
   PROJECT: MAD OVERLORD // 느린 기기 안내 (v2, 회의 ⑬ 2026-11-21)
   전투 중 화면 갱신이 계속 느리면 "저사양 모드를 켜 보세요"를 기기마다 한 번만 띄운다. 자동으로 켜지는 않음 (사용자가 고름).
   - battle_v2.js 루프가 프레임마다 perfHint.tick(실제 프레임 간격 초)를 부름. 일시정지·히트스톱·탭이 뒤로 간 긴 간격(0.5초 넘음)은 세지 않음
   - WINDOW초 구간의 평균 fps가 SLOW_FPS보다 낮은 구간이 NEED번 이어지면 안내 (잠깐 끊기는 것은 무시)
   - 이미 저사양 모드거나, 한 번 안내했으면(localStorage mo_v2_lowspec_hint) 다시 안 뜸. 자동 검사는 window.madOverlordNoPerfHint로 끔
   저사양 모드가 줄이는 것: 캔버스 해상도 1배(displayRes.js) · 이펙트 입자 수(vfx/vfxPlayer.js) · 흐림 효과(body.v2-lowspec, ui_v2.css)
   ========================================================================== */

import { settings } from './settings_v2.js';
import * as saveStore from './saveStore_v2.js';

const KEY = 'mo_v2_lowspec_hint';
const WINDOW = 4;       // 초
const SLOW_FPS = 38;
const NEED = 2;         // 느린 구간이 이만큼 이어지면
const SHOW_MS = 14000;

export const perfHint = {
    frames: 0,
    elapsed: 0,
    slowRuns: 0,
    el: null,

    reset() {
        this.frames = 0;
        this.elapsed = 0;
        this.slowRuns = 0;
    },

    /** 프레임마다 (realDt = 실제 프레임 간격 초). 안내를 띄웠으면 true */
    tick(realDt) {
        if (!(realDt > 0) || realDt > 0.5) return false;   // 멈춤·탭 전환 뒤 첫 프레임은 버림
        this.frames += 1;
        this.elapsed += realDt;
        if (this.elapsed < WINDOW) return false;
        const fps = this.frames / this.elapsed;
        this.frames = 0;
        this.elapsed = 0;
        this.slowRuns = fps < SLOW_FPS ? this.slowRuns + 1 : 0;
        if (this.slowRuns < NEED) return false;
        this.slowRuns = 0;
        return this.maybeShow();
    },

    maybeShow() {
        if (window.madOverlordNoPerfHint || settings.get('lowSpec') || this.el) return false;
        try { if (saveStore.load(KEY)) return false; } catch (e) { return false; }
        this.show();
        return true;
    },

    /** 전투 화면 위쪽에 한 줄: [저사양 모드 켜기] [닫기] */
    show() {
        const screen = document.getElementById('screen-battle-v2') || document.body;
        const el = this.el = document.createElement('div');
        el.className = 'v2-perfhint';
        el.setAttribute('role', 'status');
        el.innerHTML = '<span>화면이 느린가요? <b>저사양 모드</b>를 켜면 더 부드러워져요 <small>(설정 › 화면에서 언제든 바꿀 수 있어요)</small></span>'
            + '<button class="v2-btn" data-act="on">저사양 모드 켜기</button><button class="v2-btn v2-btn--ghost" data-act="close">닫기</button>';
        const close = () => { el.remove(); if (this.el === el) this.el = null; };
        el.addEventListener('click', e => {
            const act = e.target.closest('button')?.dataset.act;
            if (!act) return;
            if (act === 'on') settings.set('lowSpec', true);
            close();
        });
        screen.appendChild(el);
        try { saveStore.save(KEY, '1'); } catch (e) { /* 저장 불가 환경: 다음 실행에 다시 뜰 수 있음 */ }
        setTimeout(close, SHOW_MS);
    }
};

/** 설정 값에 맞춰 body.v2-lowspec (흐림 효과 끄기 — ui_v2.css). 시작할 때 한 번 + 바뀔 때마다 */
export function syncLowSpecClass() {
    document.body.classList.toggle('v2-lowspec', !!settings.get('lowSpec'));
}
settings.subscribe(key => { if (key === 'lowSpec') syncLowSpecClass(); });
syncLowSpecClass();
