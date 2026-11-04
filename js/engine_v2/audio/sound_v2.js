/* ==========================================================================
   PROJECT: MAD OVERLORD // 사운드 매니저 (v2)
   - 효과음: assets/audio/sfx/<이름>.ogg (tools/audio/build_audio.py로 만듦). 이름은 이펙트 정의의 sfx,
     전투 연출(director.sfx), 전투 엔진/HUD에서 부르는 이름과 같다.
   - 배경음: assets/audio/bgm/<menu|battle|boss>.ogg — 곡이 바뀔 때 서로 교차해 페이드
   - 음량은 settings_v2.js(전체/효과음/배경음/음소거)를 따른다.

   재생 규칙 (SFX 표)
     vol   : 기본 음량 (0~1)
     ext   : 외부 라이브러리 소리(sfx_ext/<이름>.ogg, tools/audio/build_ext.py — 저장소에 없음)를 읽었을 때의 음량.
             그 파일들은 표준 크기로 만들어 지금 소리와 같은 크기가 되게 1을 넘을 수 있음. 파일이 없으면 sfx/의 CC0 소리 + vol
     gap   : 같은 소리를 다시 낼 수 있는 최소 간격(초) — 연사/지속 피해가 소리로 뭉개지지 않게
     voices: 같은 소리 동시 재생 최대 수
     pitch : 재생마다 음높이를 ±pitch 만큼 흔듦 (같은 소리 반복이 기계적으로 들리지 않게)
     duck  : 재생하는 동안 배경음을 이 비율로 낮춤 (큰 연출 순간)
     vars  : 변형 파일 수 — <이름>.ogg, <이름>_2.ogg … 중 바로 앞과 다른 것을 골라 냄 (tools/audio/polish_audio.py가 만듦)
     with  : 같이 겹쳐 낼 소리 이름들 (몸통 + 꼬리처럼 레이어로 — 각자 자기 규칙대로)
     src   : 다른 소리 파일을 빌려 씀 (전용 소리가 생기기 전 임시), rate: 기본 음높이 배율

   묶음(catOf): 전투 소리(skill·enemy·player)와 연출·UI(cue·ui)를 따로 모아 CAT_VOL로 묶음 음량을 맞춘다.
   전투 소리만 받는 일:
     - 화면 위치: play(name, { x: -1(왼쪽) ~ 1(오른쪽) }) → 좌우로 조금 (PAN)
     - 느린 화면(gameTime.slowMo): 새로 나는 소리는 음높이가 내려가고, 전투 소리 전체가 잠깐 먹먹해짐(저역 통과)
     - 동시 재생 상한(MAX_VOICES): 넘치면 새 전투 소리를 건너뜀 (연출·UI 소리는 항상 남)

   브라우저 자동 재생 제한: 첫 클릭/키 입력 뒤에 소리를 켠다(unlock). 그 전의 배경음 요청은 기억했다가 재생.
   ========================================================================== */

import { settings } from '../settings_v2.js';
import { gameTime } from '../gameTime.js';

const BASE = 'assets/audio/';
const PAN = 0.55;          // 화면 끝에서 좌우로 이만큼 (1 = 한쪽 귀만)
const MAX_VOICES = 28;     // 전투 소리 동시 재생 상한
export const CAT_VOL = { skill: 1, enemy: 0.85, player: 1, cue: 1, ui: 0.9 };
const WORLD = new Set(['skill', 'enemy', 'player']);

/** 소리 이름 → 묶음 */
export function catOf(name) {
    if (name.startsWith('ui_') || name === 'reward_done') return 'ui';
    if (/^(warning|ult_|skill_|intro_|mission_|result_|star_get|low_hp)/.test(name)) return 'cue';
    if (name.startsWith('zone_') || name === 'enemy_die') return 'enemy';
    if (name === 'player_hit' || name === 'player_down' || name.startsWith('shield_')) return 'player';
    return 'skill';
}

export const SFX = {
    // 거대로봇
    mech_laser: { vol: 0.26, gap: 0.045, voices: 4, pitch: 0.06 },
    mech_laser_big: { vol: 0.7 },
    mech_laser_hit: { vol: 0.22, gap: 0.06, voices: 3, pitch: 0.1 },
    mech_missile_launch: { vol: 0.32, gap: 0.05, voices: 4, pitch: 0.1 },
    mech_missile_blast: { vol: 0.42, gap: 0.05, voices: 4, pitch: 0.1 },
    mech_drone_launch: { vol: 0.35, gap: 0.08, pitch: 0.1 },
    mech_drone_blast: { vol: 0.42, gap: 0.06, voices: 4, pitch: 0.1 },
    mech_fist_hit: { vol: 0.55, gap: 0.05, pitch: 0.06 },
    mech_land: { vol: 0.7 },
    mech_thrust: { vol: 0.45 },
    giant_step: { vol: 0.22, gap: 0.12, pitch: 0.08 },
    charge_up: { vol: 0.32, ext: 0.63 },
    // 거대괴수
    kaiju_bite: { vol: 0.5, gap: 0.08, pitch: 0.06 },
    kaiju_roar: { vol: 0.8, duck: 0.45 },
    kaiju_spore: { vol: 0.16, gap: 0.25, pitch: 0.1 },
    kaiju_egg_lay: { vol: 0.45, gap: 0.1 },
    kaiju_egg_hatch: { vol: 0.5, gap: 0.08, pitch: 0.08 },
    kaiju_regen: { vol: 0.14, gap: 0.8 },
    // 타락 히어로
    hero_slash_hit: { vol: 0.48, gap: 0.05, pitch: 0.06 },
    hero_wave: { vol: 0.38, gap: 0.08, pitch: 0.05 },
    hero_wave_hit: { vol: 0.28, gap: 0.06, voices: 4, pitch: 0.1 },
    hero_orb: { vol: 0.35, gap: 0.1, pitch: 0.05 },
    hero_cast: { vol: 0.5 },
    hero_curse_tick: { vol: 0.15, gap: 0.3, pitch: 0.05 },
    hero_curse_nova: { vol: 0.7 },
    hero_mind_convert: { vol: 0.45, gap: 0.1 },
    // 합성괴인
    chimera_punch: { vol: 0.55, gap: 0.05, pitch: 0.06 },
    chimera_claw: { vol: 0.42, gap: 0.05, pitch: 0.08 },
    chimera_summon: { vol: 0.5, gap: 0.2 },
    chimera_quake: { vol: 0.18, gap: 0.3 },
    chimera_slam: { vol: 0.75 },
    // 심연의 길잡이 (합성음, tools/audio/build_audio.py)
    diver_jet: { vol: 0.31, gap: 0.08, voices: 3, pitch: 0.1 },
    diver_anchor_throw: { vol: 0.63, gap: 0.2 },
    diver_anchor_hit: { vol: 0.22, gap: 0.1, pitch: 0.05 },
    diver_surge: { vol: 1.02 },
    diver_hands: { vol: 0.83, duck: 0.6 },
    // 봉합 성녀 (합성음)
    saint_needle: { vol: 0.26, gap: 0.06, voices: 3, pitch: 0.08 },
    saint_stitch: { vol: 0.21, gap: 0.06, voices: 3, pitch: 0.1 },
    saint_seal: { vol: 0.98 },
    saint_revive: { vol: 1.22, duck: 0.55 },
    // 서리의 무희 (합성음)
    frost_fan: { vol: 0.37, gap: 0.08, voices: 3, pitch: 0.08 },
    frost_hit: { vol: 0.16, gap: 0.06, voices: 3, pitch: 0.12 },
    frost_freeze: { vol: 0.3, gap: 0.12, pitch: 0.1 },
    frost_shatter: { vol: 0.29, gap: 0.08, voices: 4, pitch: 0.1 },
    frost_crescent: { vol: 0.79 },
    frost_blizzard: { vol: 0.81 },
    frost_eternal: { vol: 0.3, duck: 0.55 },
    // 뒤틀린 인형사 (합성음)
    doll_snip: { vol: 0.47, gap: 0.06, voices: 3, pitch: 0.1 },
    doll_xcut: { vol: 0.55 },
    doll_summon: { vol: 0.74, gap: 0.1, pitch: 0.12 },
    doll_burst: { vol: 0.52, gap: 0.08, voices: 3, pitch: 0.12 },
    doll_strings: { vol: 0.75, duck: 0.55 },
    chimera_phase2: { vol: 0.8, duck: 0.45 },
    rampage_roar: { vol: 0.7, duck: 0.5 },                                     // 변신 (kit.kitTransform · 삼두 포효) — AI 소리 (D-109)
    kaiju_breath: { vol: 0.35 },                                               // 멸망의 숨결 · 용왕의 숨결 (불 뿜기) — AI 소리 (D-109)
    generic_slash: { vol: 0.42, gap: 0.05, pitch: 0.08 },
    // 설계자 · 방송자 기본 스킬 — AI 소리 (D-109, 전에는 남의 소리를 빌려 씀)
    arch_drill: { vol: 0.61 },                                                 // 기초 파쇄 (드릴 — 다이너마이트처럼 터짐)
    arch_scaffold: { vol: 0.6 },                                               // 강제 재건 (철골 바리케이드)
    arch_crane: { vol: 0.77, gap: 0.2, pitch: 0.06 },                          // 철거 명령 (철구 3번)
    bc_burst: { vol: 0.98 },                                                   // 공명 파열 (음파 고리 3겹 — 코드 음파 + AI)
    bc_dome: { vol: 1.62 },                                                    // 정적의 장막
    bc_emergency: { vol: 0.5, duck: 0.55 },                                    // 긴급 방송 (필살기)
    // 실드
    shield_on: { vol: 0.5 },
    shield_hit: { vol: 0.28, ext: 0.25, gap: 0.15, pitch: 0.1 },
    shield_break: { vol: 0.7 },
    // 전투 공용
    enemy_die: { vol: 0.28, ext: 0.41, gap: 0.06, voices: 3, pitch: 0.12 },
    player_hit: { vol: 0.22, ext: 0.3, gap: 0.4, pitch: 0.1 },
    base_blast: { vol: 0.5, gap: 0.08, voices: 4, pitch: 0.12 },
    base_destroyed: { vol: 0.9, duck: 0.35 },
    player_down: { vol: 0.8, duck: 0.35 },
    // 연출
    intro_whoosh: { vol: 0.45, ext: 0.59 },
    intro_sortie: { vol: 0.6, ext: 1.19 },
    warning: { vol: 0.32, ext: 1.72, duck: 0.6 },
    warning_danger: { vol: 0.38, ext: 1.27, duck: 0.5 },
    ult_cutin: { vol: 0.62, duck: 0.45 },
    ult_ready: { vol: 0.42, ext: 1.7, gap: 1 },
    skill_ready: { vol: 0.32, ext: 0.35, gap: 0.3 },
    skill_use: { vol: 0.55, gap: 0.1 },
    star_get: { vol: 0.55, ext: 2.06 },
    mission_complete: { vol: 0.7, ext: 1.79 },
    mission_failed: { vol: 0.7, ext: 1.76 },
    result_win: { vol: 0.4, ext: 1.14 },
    result_lose: { vol: 0.52 },
    result_star: { vol: 0.5, ext: 1.07, gap: 0.1 },
    low_hp: { vol: 0.55, ext: 0.81 },
    // 구역 2·3·4 적·보스·거점 (합성, D-056)
    zone_gas: { vol: 0.55, gap: 0.5, duck: 0.7 },
    zone_judgment: { vol: 0.65, gap: 0.5, duck: 0.6 },
    zone_hellgate: { vol: 0.42, gap: 0.2, pitch: 0.06 },
    zone_knight: { vol: 0.65, gap: 0.5, duck: 0.6 },
    zone_axe: { vol: 0.45, gap: 0.15, pitch: 0.06 },
    zone_spell_fire: { vol: 0.26, gap: 0.08, voices: 3, pitch: 0.1 },
    zone_spell_bolt: { vol: 0.24, gap: 0.08, voices: 3, pitch: 0.12 },
    zone_spell_ice: { vol: 0.24, gap: 0.08, voices: 3, pitch: 0.1 },
    zone_arrow: { vol: 0.22, gap: 0.06, voices: 3, pitch: 0.1 },
    zone_venom: { vol: 0.26, gap: 0.1, voices: 3, pitch: 0.1 },
    zone_heal_holy: { vol: 0.2, gap: 0.1, voices: 3, pitch: 0.08 },
    zone_spore: { vol: 0.24, gap: 0.08, voices: 3, pitch: 0.1 },
    zone_goo: { vol: 0.38, gap: 0.15, pitch: 0.1 },
    zone_mutation: { vol: 0.7, gap: 0.5, duck: 0.6 },
    zone_charge: { vol: 0.5, gap: 0.2, pitch: 0.06 },
    zone_split: { vol: 0.32, gap: 0.12, pitch: 0.1 },
    // UI
    ui_click: { vol: 0.45, gap: 0.04 },
    ui_toggle: { vol: 0.4, gap: 0.04 },
    ui_pause: { vol: 0.45, gap: 0.05 },
    ui_tab: { vol: 0.32, gap: 0.04 },
    ui_tick: { vol: 0.12, gap: 0.05, pitch: 0.04 },
    ui_equip: { vol: 0.55 },
    ui_error: { vol: 0.45, gap: 0.1 },
    reward_done: { vol: 0.5 }
};

export const BGM = { menu: 'bgm/menu.ogg', battle: 'bgm/battle.ogg', boss: 'bgm/boss.ogg' };

class SoundManager {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.buffers = new Map();
        this.loading = new Map();
        this.lastAt = new Map();
        this.playing = new Map();
        this.loops = new Map();
        this.bgm = null;            // { name, el, gain }
        this.wantBgm = null;        // unlock 전에 요청된 배경음
        this.duckUntil = 0;
        this.active = 0;            // 지금 나는 전투 소리 수
        this.lastVar = new Map();   // 이름 → 바로 앞에 낸 변형 번호
        this.extLoaded = new Set();  // sfx_ext/에서 읽은 이름 (음량은 ext)
        settings.subscribe(() => this.applyVolumes());
        gameTime.onSlow = (scale, sec) => this.slowMo(scale, sec);
    }

    // ---- 시작 ----
    /** 첫 사용자 입력에서 소리를 켬 (브라우저 자동 재생 제한) */
    listenForUnlock() {
        const go = () => {
            this.unlock();
            window.removeEventListener('pointerdown', go, true);
            window.removeEventListener('keydown', go, true);
        };
        window.addEventListener('pointerdown', go, true);
        window.addEventListener('keydown', go, true);
        this.unlock();   // 이미 사용자가 클릭해 진입한 경우 바로 켜짐
    }

    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();
            this.bgmBus = this.ctx.createGain();
            this.bgmDuck = this.ctx.createGain();
            // 마지막 단: 리미터 (폭발이 겹쳐도 소리가 찢어지지 않게)
            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.value = -8;
            this.limiter.knee.value = 6;
            this.limiter.ratio.value = 12;
            this.limiter.attack.value = 0.003;
            this.limiter.release.value = 0.25;
            this.sfxBus.connect(this.master);
            // 묶음별 버스: 전투 소리는 저역 통과(느린 화면에서 먹먹하게)를 거쳐 효과음 버스로
            this.worldFilter = this.ctx.createBiquadFilter();
            this.worldFilter.type = 'lowpass';
            this.worldFilter.frequency.value = 20000;
            this.worldFilter.connect(this.sfxBus);
            this.buses = {};
            for (const [cat, v] of Object.entries(CAT_VOL)) {
                const g = this.ctx.createGain();
                g.gain.value = v;
                g.connect(WORLD.has(cat) ? this.worldFilter : this.sfxBus);
                this.buses[cat] = g;
            }
            this.bgmDuck.connect(this.bgmBus);
            this.bgmBus.connect(this.master);
            this.master.connect(this.limiter);
            this.limiter.connect(this.ctx.destination);
            this.applyVolumes();
        }
        const resumed = this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume();
        resumed.then(() => {
            if (this.unlocked || this.ctx.state !== 'running') return;
            this.unlocked = true;
            Object.keys(SFX).forEach(name => this.load(name));
            if (this.wantBgm) this.playBgm(this.wantBgm);
        }).catch(() => { /* 아직 사용자 입력 전 — 다음 입력에서 다시 시도 */ });
    }

    applyVolumes() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const s = settings.values;
        this.master.gain.setTargetAtTime(s.mute ? 0 : s.master, t, 0.03);
        this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.03);
        this.bgmBus.gain.setTargetAtTime(s.bgm, t, 0.03);
    }

    /** 소리 파일 읽기: 변형까지 모두 (buffers: 이름 → AudioBuffer 목록, 첫 파일이 없으면 무음).
        ext가 있으면 sfx_ext/를 먼저, 없으면 sfx/ */
    load(name) {
        if (this.buffers.has(name) || this.loading.has(name) || !this.ctx) return this.loading.get(name);
        const def = SFX[name] || {};
        const file = def.src || name;
        const one = f => fetch(`${BASE}${f}.ogg`)
            .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then(buf => this.ctx.decodeAudioData(buf))
            .catch(() => null);   // 파일 없음/해석 실패: 그 변형만 빠짐
        const fromDir = dir => Promise.all([file, ...Array.from({ length: Math.max(0, (def.vars || 1) - 1) }, (_, i) => `${file}_${i + 2}`)]
            .map(f => one(dir + f))).then(list => (list[0] ? list.filter(Boolean) : null));
        const p = (def.ext ? fromDir('sfx_ext/').then(l => (l ? (this.extLoaded.add(name), l) : fromDir('sfx/'))) : fromDir('sfx/'))
            .then(list => { if (list) this.buffers.set(name, list); })
            .finally(() => this.loading.delete(name));
        this.loading.set(name, p);
        return p;
    }

    /** 표의 기본 음량 (외부 소리 파일을 읽었으면 ext) */
    volOf(name) {
        const def = SFX[name] || {};
        return (this.extLoaded.has(name) ? def.ext : def.vol) ?? 0.5;
    }

    /** 변형 고르기: 바로 앞과 다른 것 */
    pickVariant(name, bufs) {
        if (bufs.length === 1) return bufs[0];
        const last = this.lastVar.get(name) ?? -1;
        let i = Math.floor(Math.random() * (bufs.length - 1));
        if (i >= last && last >= 0) i += 1;
        this.lastVar.set(name, i);
        return bufs[i];
    }

    // ---- 효과음 ----
    /** opts: { vol(배율), rate(음높이 배율), x(화면 위치 -1 ~ 1, 전투 소리 좌우) } */
    play(name, opts = {}) {
        const def = SFX[name];
        if (!def || !this.unlocked) return;
        const now = this.ctx.currentTime;
        if (def.gap && now - (this.lastAt.get(name) ?? -9) < def.gap) return;
        const count = this.playing.get(name) || 0;
        if (count >= (def.voices || 6)) return;
        const cat = catOf(name);
        const world = WORLD.has(cat);
        if (world && this.active >= MAX_VOICES) return;
        const bufs = this.buffers.get(name);
        if (!bufs) {
            this.load(name);
            return;
        }
        const buf = this.pickVariant(name, bufs);
        this.lastAt.set(name, now);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const wobble = def.pitch ? 1 + (Math.random() * 2 - 1) * def.pitch : 1;
        const slow = world ? 0.6 + 0.4 * gameTime.slowFactor(performance.now()) : 1;   // 느린 화면: 음높이도 내려감
        src.playbackRate.value = (def.rate || 1) * (opts.rate || 1) * wobble * slow;
        const g = this.ctx.createGain();
        g.gain.value = this.volOf(name) * (opts.vol ?? 1);
        let out = src.connect(g);
        if (world && Number.isFinite(opts.x) && this.ctx.createStereoPanner) {
            const pan = this.ctx.createStereoPanner();
            pan.pan.value = Math.max(-1, Math.min(1, opts.x)) * PAN;
            out = out.connect(pan);
        }
        out.connect(this.buses[cat]);
        this.playing.set(name, count + 1);
        if (world) this.active += 1;
        src.onended = () => {
            this.playing.set(name, Math.max(0, (this.playing.get(name) || 1) - 1));
            if (world) this.active = Math.max(0, this.active - 1);
        };
        src.start();
        if (def.duck) this.duck(def.duck, buf.duration + 0.3);
        if (def.with && !opts.layered) def.with.forEach(w => this.play(w, { ...opts, layered: true }));
    }

    /** 느린 화면 동안 전투 소리를 먹먹하게 (scale이 작을수록 더), 끝 30%에서 원래대로 (gameTime.slowMo와 같은 모양) */
    slowMo(scale, sec) {
        if (!this.ctx || !this.worldFilter) return;
        const t = this.ctx.currentTime;
        const f = this.worldFilter.frequency;
        f.cancelScheduledValues(t);
        f.setTargetAtTime(500 + 2500 * scale, t, 0.04);
        f.setTargetAtTime(20000, t + sec * 0.7, sec * 0.1);
    }

    /** 반복 재생 (저체력 심장 박동 등). 이미 켜져 있으면 무시 */
    loop(name) {
        if (!this.unlocked || this.loops.has(name)) return;
        const bufs = this.buffers.get(name);
        if (!bufs) {
            const p = this.load(name);
            if (p) p.then(() => this.buffers.has(name) && this.loop(name));
            return;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = bufs[0];
        src.loop = true;
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(this.volOf(name), this.ctx.currentTime, 0.1);
        src.connect(g).connect(this.buses[catOf(name)]);
        src.start();
        this.loops.set(name, { src, g });
    }

    stopLoop(name, fade = 0.3) {
        const l = this.loops.get(name);
        if (!l) return;
        this.loops.delete(name);
        const t = this.ctx.currentTime;
        l.g.gain.setTargetAtTime(0, t, fade / 3);
        l.src.stop(t + fade + 0.05);
    }

    stopAllLoops() {
        [...this.loops.keys()].forEach(name => this.stopLoop(name, 0.15));
    }

    // ---- 배경음 ----
    /** 곡 전환: 이전 곡은 fade초 동안 줄어들고 새 곡이 커짐 */
    playBgm(name, fade = 1.2) {
        this.wantBgm = name;
        if (!this.unlocked) return;
        if (this.bgm && this.bgm.name === name) return;
        this.stopBgm(fade);
        const el = new Audio(`${BASE}${BGM[name]}`);
        el.loop = true;
        el.preload = 'auto';
        const node = this.ctx.createMediaElementSource(el);
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        node.connect(gain).connect(this.bgmDuck);
        gain.gain.setTargetAtTime(1, this.ctx.currentTime, fade / 3);
        el.play().catch(() => { /* 재생 실패(파일 없음 등): 무음 */ });
        this.bgm = { name, el, gain };
    }

    stopBgm(fade = 0.8) {
        if (!this.bgm) return;
        const { el, gain } = this.bgm;
        this.bgm = null;
        if (this.ctx) gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
        setTimeout(() => { el.pause(); el.src = ''; }, fade * 1000 + 200);
    }

    /** 잠깐 배경음 낮춤 (큰 효과음/연출 동안) */
    duck(level = 0.4, sec = 1.2) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = this.bgmDuck.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(level, t, 0.05);
        const until = t + sec;
        this.duckUntil = Math.max(this.duckUntil, until);
        g.setTargetAtTime(1, this.duckUntil, 0.35);
    }

    /** 일시정지 중에는 배경음을 낮춰 둠 */
    setPaused(on) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.bgmDuck.gain.cancelScheduledValues(t);
        this.bgmDuck.gain.setTargetAtTime(on ? 0.35 : 1, t, 0.1);
        this.duckUntil = 0;
    }
}

export const sound = new SoundManager();
