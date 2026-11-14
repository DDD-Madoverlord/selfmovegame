/* ==========================================================================
   PROJECT: MAD OVERLORD // 사운드 장면 점검실 — 무대 (tools/sound/scene.html)
   게임 전투 화면과 같은 1280×720 판에 게임 코드를 그대로 얹어 장면을 재생한다.
   - 캐릭터: 게임 리그(RigAvatar) · 적: 게임 적 그림(ENEMY_ART) · 거점: BASE_ART
   - 이펙트·투사체: 게임 BattleFx(VfxPlayer) — 이펙트 정의의 sfx가 게임처럼 소리를 냄
   - 경고·컷인·도장·결과 화면: 게임 BattleDirector(ui_v2.css 그대로)
   - 소리: 게임 사운드 매니저(sound) — 간격·동시 재생·음높이 흔들림·배경음 낮춤 규칙 그대로
   장면(cues.js)은 s.at(초, fn)으로 시간표를 짜고, 여기 도우미(s.hit · s.kill · s.fx …)로 화면을 움직인다.
   ========================================================================== */

import { RigAvatar } from '/js/engine_v2/rig/rigAvatar.js';
import { BattleFx } from '/js/engine_v2/battleFx.js';
import { gameTime } from '/js/engine_v2/gameTime.js';
import { ENEMY_ART } from '/js/engine_v2/enemyArt_v2.js';
import { BASE_ART } from '/js/engine_v2/stageArt_v2.js';
import { BATTLE_VFX, MECH_VFX } from '/js/engine_v2/vfx/vfxDefs.js';
import { preloadVfxSheets } from '/js/engine_v2/vfx/vfxPlayer.js';
import { sound } from '/js/engine_v2/audio/sound_v2.js';
import { BattleDirector } from '/js/ui_v2/battleDirector_v2.js';
import { monsterControllerV2 } from '/js/engine_v2/monster_v2.js';
import { icon } from '/js/ui_v2/icons.js';

export const W = 1280, H = 720, FB = 58;      // 판 크기 · 지면 높이(bottom px, 게임 battleDirector FB와 같음)
export const HERO_X = 300;
export const SLOTS = [700, 830, 960];          // 적 세 자리 (발 x)
// 캐릭터별 전투 배율 (monster_v2.js BATTLE_RIG_SCALE와 같음)
const RIG_SCALE = { mech: 0.235, kaiju: 0.235, hero: 0.215, chimera: 0.235, diver: 0.25, saint: 0.235, frost: 0.225, doll: 0.26,
    architect: 0.235, broadcaster: 0.24 };
// 구역 배경 (ui_v2.css #screen-battle-v2.v2-zone-N 규칙과 같은 그림·밝기)
const ZONE_BG = {
    1: { mid: 56, floor: 75, far: [0.62, 0.9], m: [0.6, 0.85] }, 2: { mid: 29, floor: 76, far: [0.6, 0.9], m: [0.58, 0.85] },
    3: { mid: 1, floor: 77, far: [0.62, 0.95], m: [0.6, 0.85] }, 4: { mid: 38, floor: 84, far: [0.7, 1], m: [0.5, 0.9] },
    5: { mid: 58, floor: 90, far: [0.62, 0.9], m: [0.55, 0.85] }, 6: { mid: 38, floor: 71, far: [0.62, 0.9], m: [0.55, 0.85] },
    7: { mid: 43, floor: 80, far: [0.62, 0.85], m: [0.55, 0.8] }, 8: { mid: 26, floor: 72, far: [0.66, 0.9], m: [0.58, 0.85] },
    9: { mid: 67, floor: 81, far: [0.62, 0.9], m: [0.55, 0.85] }, 10: { mid: 60, floor: 76, far: [0.66, 0.95], m: [0.58, 0.9] }
};
// 그림이 따로 없는 적 (enemies_v2.js artAs·tint)
const ART_ALIAS = { orbian: ['archbishop', 'grayscale(0.55) brightness(1.3) sepia(0.3) drop-shadow(0 0 9px rgba(255, 220, 120, 0.85))'] };

const imgCache = new Map();
export function loadImg(src) {
    if (!imgCache.has(src)) {
        imgCache.set(src, new Promise(res => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => res(null);
            im.src = src;
        }));
    }
    return imgCache.get(src);
}
const imgNow = new Map();   // 다 읽은 그림 (그리기용)
async function want(src) {
    const im = await loadImg(src);
    if (im) imgNow.set(src, im);
    return im;
}

const rand = (a, b) => a + Math.random() * (b - a);
const ease = u => 1 - Math.pow(1 - u, 3);

/** 적 하나 (게임 적 그림을 캔버스에 그림) */
class Unit {
    constructor(kind, x, o = {}) {
        const alias = ART_ALIAS[kind];
        this.kind = kind;
        this.art = ENEMY_ART[alias ? alias[0] : kind] || ENEMY_ART.guard;
        this.tint = o.tint || (alias ? alias[1] : null);
        this.x = x;
        this.scale = o.scale || 1;
        this.anim = 'walk';
        this.idle = o.idle !== false;     // 서 있음 (걷기 첫 장)
        this.t = Math.random();
        this.once = null;                 // 한 번 재생 동작 (attack 등)
        this.flash = 0;
        this.kb = 0;
        this.alpha = 0;
        this.fadeIn = o.fadeIn ?? 0.25;
        this.dead = false;
        this.status = null;               // 'frozen' · 'stun' · 'curse' 색
        this.vx = o.vx || 0;
        this.hidden = false;
        for (const a of Object.values(this.art)) if (a && a.src) want(a.src);
    }
    get w() { return this.art.frameWidth * this.scale; }
    get h() { return this.art.frameHeight * this.scale; }
    /** 몸통 가운데 (x, bottom) */
    chest() { return { x: this.x + this.kb, b: FB + this.h * 0.52 }; }
    head() { return { x: this.x + this.kb, b: FB + this.h * 0.95 }; }
    play(anim) {
        if (!this.art[anim]) anim = 'attack';
        if (!this.art[anim]) return;
        this.once = anim;
        this.t = 0;
    }
}

export class Stage {
    constructor(host) {
        this.host = host;
        host.innerHTML = `
            <section id="screen-battle-v2" class="ss-screen">
                <div class="v2-battle ss-frame">
                    <div id="battle-viewport-v2" class="ss-viewport">
                        <canvas class="ss-bg" width="${W}" height="${H}"></canvas>
                        <div id="ss-entity" class="ss-entity">
                            <canvas class="ss-hero"></canvas>
                            <canvas class="ss-units" width="${W}" height="${H}"></canvas>
                        </div>
                    </div>
                    <div class="ss-hud-host"></div>
                    <div class="ss-ui"></div>
                    <div class="ss-note" aria-live="polite"></div>
                </div>
            </section>`;
        this.frame = host.querySelector('.ss-frame');
        this.viewport = host.querySelector('.ss-viewport');
        this.bgCanvas = host.querySelector('.ss-bg');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.unitCanvas = host.querySelector('.ss-units');
        this.uctx = this.unitCanvas.getContext('2d');
        this.heroCanvas = host.querySelector('.ss-hero');
        this.hudHost = host.querySelector('.ss-hud-host');
        this.uiHost = host.querySelector('.ss-ui');
        this.noteEl = host.querySelector('.ss-note');

        preloadVfxSheets();
        this.fx = new BattleFx('ss-entity');
        this.fx.start();
        this.director = new BattleDirector({ fx: this.fx, collapseBase: () => false });
        // 연출이 부르는 캐릭터 반응 (게임에선 monster_v2) → 이 무대 캐릭터
        monsterControllerV2.playReaction = name => this.rig?.react(name);
        monsterControllerV2.freezeRig = on => { if (this.rig) this.rig.timeScale = on ? 0 : 1; };

        this.rig = null;
        this.heroId = null;
        this.units = [];
        this.bases = [];
        this.nums = [];
        this.events = [];
        this.time = 0;
        this.zone = 1;
        this.boss = false;
        this.scroll = 0;
        this.walkBg = false;
        this.token = 0;
        this.duration = 4;
        this.onDone = null;
        this.last = performance.now();
        requestAnimationFrame(t => this.loop(t));
    }

    // ------------------------------------------------------------------
    // 장면 준비 · 정리
    async reset() {
        this.token += 1;
        this.events = [];
        this.time = 0;
        this.units = [];
        this.bases = [];
        this.nums = [];
        this.onFire = null;
        this.onKill = null;
        this.castCb = null;
        this.muteGame = null;
        this.quietSteps = true;
        this.walkBg = false;
        gameTime.paused = false;
        this.fx.reset();
        this.director.clear();
        this.frame.classList.remove('ss-down', 'ss-ui-on', 'ss-dim');
        this.frame.querySelectorAll('.v2-fx-layer, .ss-tmp').forEach(n => n.remove());
        this.hudHost.innerHTML = '';
        this.uiHost.innerHTML = '';
        this.note('');
        sound.stopAllLoops();
        gameTime.reset();
        gameTime.speed = this.speed || 1;
        if (this.rig) {
            this.rig.timeScale = 1;
            this.rig.resetSkills();
            this.rig.setMode('idle');
            this.heroCanvas.style.opacity = '';
            this.heroCanvas.style.filter = '';
        }
    }

    /** 속도 (0.5 = 느리게 보기) — 게임 시간 배속을 씀 (리그·이펙트·시간표가 함께 느려짐) */
    setSpeed(v) {
        this.speed = v;
        gameTime.speed = v;
    }

    setZone(z, boss = false) {
        this.zone = ZONE_BG[z] ? z : 1;
        this.boss = boss;
        const d = `assets/sprites/stage/st${this.zone}/`;
        this.bgSrc = { far: d + (boss ? 'far_boss.webp' : 'far.webp'), mid: d + 'mid.webp', floor: d + 'floor.webp' };
        Object.values(this.bgSrc).forEach(want);
    }

    async setHero(id, o = {}) {
        if (!id) {
            this.heroCanvas.hidden = true;
            return;
        }
        this.heroCanvas.hidden = false;
        if (!this.rig) {
            this.rig = new RigAvatar(this.heroCanvas, {
                character: id, width: W, height: H, rootX: HERO_X, rootY: H - FB, scale: RIG_SCALE[id] || 0.235, shadow: true,
                onEvent: (name, data) => this.rigEvent(name, data)
            });
            await this.rig.ready;
            this.rig.start();
        } else if (this.heroId !== id) {
            await this.rig.setCharacter(id, RIG_SCALE[id] || 0.235);
        }
        this.heroId = id;
        this.rig.resetSkills();
        if (o.arm && this.rig.setArm) this.rig.setArm(o.arm);
        else if (id === 'mech' && this.rig.setArm) this.rig.setArm('cannon');
        this.rig.setMode(o.mode || 'idle');
        this.rig.timeScale = 1;
    }

    /** 리그 동작 이벤트 → 게임과 같은 소리·이펙트 (battle_v2.js onRigEvent) */
    rigEvent(name, data = {}) {
        if (this.quietSteps && (name === 'stomp' || name === 'step')) return;
        if (name === 'land') this.fx.play(MECH_VFX.landing, HERO_X + 35, FB);
        if (name === 'stomp') sound.play('giant_step');
        else if (name === 'step') sound.play('giant_step', { vol: 0.45, rate: 1.5 });
        else if (name === 'thrust') sound.play('mech_thrust');
        else if (name === 'charge') sound.play('charge_up');
        if (name === 'cast' && this.castCb) {
            const cb = this.castCb;
            this.castCb = null;
            cb();
        }
        if (data.hit && this.onFire) this.onFire(name, data);
    }

    // ------------------------------------------------------------------
    // 시간표
    at(t, fn) {
        const tok = this.token;
        this.events.push({ t, fn: () => tok === this.token && fn() });
        this.events.sort((a, b) => a.t - b.t);
    }

    every(t0, gap, n, fn) {
        for (let i = 0; i < n; i++) this.at(t0 + i * gap, () => fn(i));
    }

    end(sec) {
        this.duration = sec;
    }

    note(text) {
        this.noteEl.textContent = text || '';
        this.noteEl.hidden = !text;
    }

    // ------------------------------------------------------------------
    // 무대 위 것들
    foe(kind, x, o) {
        const u = new Unit(kind, x, o);
        this.units.push(u);
        return u;
    }

    /** 적 여러 마리를 세 자리에 (kinds: 문자열 또는 배열) */
    foes(kinds, o = {}) {
        const list = Array.isArray(kinds) ? kinds : [kinds, kinds, kinds];
        return list.map((k, i) => this.foe(k, (o.slots || SLOTS)[i] ?? SLOTS[i % 3] + 60 * Math.floor(i / 3), o));
    }

    base(key, x, o = {}) {
        const art = BASE_ART[key] || BASE_ART.bunker;
        art.src.forEach(want);
        const bs = { key, art, x, state: 0, shake: 0, flash: 0, alpha: 1, scale: o.scale || 1 };
        this.bases.push(bs);
        return bs;
    }

    baseCenter(bs) {
        return { x: bs.x + bs.art.w * bs.scale / 2, b: FB + bs.art.h * bs.scale * 0.45 };
    }

    hero() {
        const r = this.rig;
        const top = r?.headTop?.();
        const hb = top ? H - top.y : 200;
        return { x: HERO_X, b: FB + (hb - FB) * 0.52, top: hb };
    }

    muzzle() {
        const p = this.rig?.muzzlePoint?.();
        if (!p) return { x: HERO_X + 90, b: 130 };
        return { x: p[0], b: H - p[1] };
    }

    socket(name, bone) {
        const p = this.rig?.socketPoint?.(name, bone);
        return p ? { x: p[0], b: H - p[1] } : this.muzzle();
    }

    clip(name) {
        if (!this.rig) return false;
        return this.rig.playOnce(name) || this.rig.playSkillAnim(name);
    }

    /** 시전 동작 + 해방 순간 콜백 (cast 이벤트가 없으면 sec초 뒤) */
    cast(clipName, sec, fn) {
        let fired = false;
        const go = () => { if (!fired) { fired = true; fn(); } };
        this.castCb = go;
        this.clip(clipName);
        this.at(this.time + sec, go);
    }

    // ---- 이펙트 (게임 BattleFx) ----
    fx2(def, x, b, opts) {
        if (def) this.fx.play(def, x, b, opts);
    }

    /** 적 몸통/바닥에 이펙트 */
    fxOn(def, u, ground = false, opts) {
        if (!u || !def) return;
        const c = u.chest();
        this.fx.play(def, c.x, ground ? FB : c.b, opts);
    }

    /** 적이 맞음: 번쩍 · 밀림 · 피해 숫자 */
    hit(u, o = {}) {
        if (!u || u.dead) return;
        u.flash = 1;
        u.kb = Math.min(28, u.kb + (o.kb ?? 7));
        if (o.num !== false) this.num(u.head(), o.dmg ?? Math.round(rand(80, 160)), o.crit);
        if (o.react) u.play('walk');
    }

    num(p, value, crit = false, color = null) {
        this.nums.push({ x: p.x + rand(-14, 14), b: p.b + 6, text: String(value), crit, color, t: 0 });
    }

    /** 적 쓰러짐: 게임처럼 연기 + enemy_die 소리 (o.sound=false면 소리 없음) */
    kill(u, o = {}) {
        if (!u || u.dead) return;
        u.dead = true;
        u.deadT = 0;
        const c = u.chest();
        this.fx.play(BATTLE_VFX.enemyDefeat, c.x, FB + 30);
        if (o.sound !== false) sound.play('enemy_die', { x: (c.x / W) * 2 - 1 });
        this.onKill?.(u);
    }

    /** 잠깐 멈춤 (일시정지 장면) — 게임 시간 정지, sec초 뒤 창을 닫고 다시 */
    freeze(sec) {
        const tok = this.token;
        gameTime.paused = true;
        setTimeout(() => {
            gameTime.paused = false;
            if (tok !== this.token) return;
            this.uiHost.innerHTML = '';
            this.frame.classList.remove('ss-ui-on');
        }, sec * 1000);
    }

    /** 타격 층 표시 (시작 · 몸통 · 꼬리) — 앞이 지금 고르는 층. pulse(이름)로 울릴 때마다 번쩍 */
    layerMeter(names) {
        const el = document.createElement('div');
        el.className = 'ss-tmp ss-layers';
        const label = n => (n.startsWith('hit_start') ? '시작' : n.startsWith('hit_body') ? '몸통' : n.startsWith('hit_tail') ? '꼬리' : n === 'hit_crit' ? '치명타' : '');
        el.innerHTML = `<b>타격 = 층을 겹친 한 소리</b>${names.map((n, i) => `<div class="ss-layer${i ? '' : ' is-focus'}" data-n="${n}"><span>${label(n)}</span><code>${n}</code><i></i></div>`).join('')}`;
        this.frame.appendChild(el);
    }

    pulse(name) {
        const row = this.frame.querySelector(`.ss-layer[data-n="${name}"]`);
        if (!row) return;
        row.classList.remove('is-hit');
        void row.offsetWidth;
        row.classList.add('is-hit');
    }

    /** 적이 공격 동작 */
    foeAttack(u, anim = 'attack') {
        u?.play(anim);
    }

    /** 주인공이 맞음 (움찔 + 숫자) — 소리는 장면이 정함 */
    heroHurt(dmg = 40) {
        this.rig?.react('hurt');
        const h = this.hero();
        this.num({ x: HERO_X, b: h.top }, `-${dmg}`, false, '#ff5a6e');
    }

    shake(px, ms) { this.director.shake(px, ms); }
    flash(color, ms, peak) { this.director.flash(color, ms, peak); }
    hitStop(sec = 0.05) { gameTime.hitStop(sec, 0); }
    slowMo(scale, sec) { gameTime.slowMo(scale, sec); }
    sfx(name, opts) { sound.play(name, opts); }

    /** 화면 가운데 문구 (게임 도장) */
    stamp(title, sub, cls = '', ms = 1600) { return this.director.stamp(title, sub, cls, ms); }

    /** 주인공 위 말풍선 문구 (상황 설명) */
    tag(text, p, cls = '') {
        const el = document.createElement('div');
        el.className = `ss-tmp ss-tag ${cls}`;
        el.textContent = text;
        el.style.left = `${p.x}px`;
        el.style.top = `${H - p.b}px`;
        this.frame.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    // ---- 전투 HUD (index.html · ui_v2.css 그대로) ----
    hud(o = {}) {
        const skills = o.skills || [{ icon: 'laser', cd: 0 }, { icon: 'shield', cd: 0.6 }, { icon: 'orbital', ult: true, cd: 0 }];
        this.hudHost.innerHTML = `
            <div class="v2-hud ss-hud">
                <div class="v2-unit v2-panel">
                    <div class="v2-unit__portrait"><span class="ss-portrait">${icon(o.portrait || 'overlord', 46)}</span></div>
                    <div class="v2-unit__body">
                        <div class="v2-unit__name"><span>${o.name || 'OVERLORD'}</span><small>${o.faction || ''}</small></div>
                        <div class="v2-bar"><div class="v2-bar__fill" style="width:${(o.hp ?? 1) * 100}%"></div><span class="v2-bar__text">${Math.round((o.hp ?? 1) * 4200)} / 4200</span></div>
                        <div class="v2-unit__state"><strong class="text-neon-green">교전 중 (ENGAGED)</strong></div>
                    </div>
                </div>
                <div class="v2-progress v2-panel">
                    <div class="v2-progress__head">
                        <span class="v2-progress__stage">${o.stage || '3-4'}</span>
                        <span class="v2-progress__dist"><strong>612m</strong> / 1000m</span>
                        <span class="v2-progress__timer">01:12</span>
                        <span class="v2-stars" id="battle-stars-v2">${o.stars || '★☆'}</span>
                    </div>
                    <div class="v2-progress__track"><div class="v2-progress__fill" style="width:61%"></div></div>
                </div>
                <div class="v2-topright">
                    <div class="v2-chip"><strong>1,240</strong><small>DM</small></div>
                    <button class="v2-iconbtn ss-speedbtn">${icon('speed', 16)}<span>1x</span></button>
                    <button class="v2-iconbtn ss-pausebtn">${icon('pause', 20)}</button>
                </div>
                <div class="v2-skilldock">
                    ${skills.map((sk, i) => `<div class="v2-skill-wrap"><button class="v2-skill${sk.ult ? ' v2-skill--ult' : ''}${sk.ready ? ' is-ready' : ''}" data-i="${i}" style="--cd:${sk.cd || 0}">
                        <span class="v2-skill__icon">${icon(sk.icon, sk.ult ? 50 : 40)}</span>${sk.ult ? '' : '<span class="v2-skill__cd"></span>'}<span class="v2-skill__num"></span><kbd>${i + 1}</kbd></button></div>`).join('')}
                </div>
            </div>`;
        return this.hudHost.querySelector('.ss-hud');
    }

    skillBtn(i) { return this.hudHost.querySelector(`.v2-skill[data-i="${i}"]`); }

    // ---- UI 화면 (메뉴·상점·연구소 흉내 — 게임 단추 모양) ----
    ui(html, cls = '') {
        this.frame.classList.add('ss-ui-on');
        this.uiHost.className = `ss-ui ${cls}`;
        this.uiHost.innerHTML = html;
        return this.uiHost;
    }

    /** 손가락이 el로 가서 누름 → 누르는 순간 fn (시간표 기준 t초에 도착) */
    tap(t, sel, fn, o = {}) {
        this.at(Math.max(0, t - 0.45), () => {
            const el = typeof sel === 'string' ? this.frame.querySelector(sel) : sel;
            if (!el) return fn?.();
            const fr = this.frame.getBoundingClientRect();
            const k = fr.width / W;
            const r = el.getBoundingClientRect();
            const x = (r.left - fr.left + r.width / 2) / k, y = (r.top - fr.top + r.height / 2) / k;
            let f = this.frame.querySelector('.ss-finger');
            if (!f) {
                f = document.createElement('div');
                f.className = 'ss-finger ss-tmp';
                f.style.left = `${W * 0.62}px`;
                f.style.top = `${H * 0.9}px`;
                this.frame.appendChild(f);
            }
            const from = { left: f.style.left, top: f.style.top };
            f.animate([{ left: from.left, top: from.top }, { left: `${x}px`, top: `${y}px` }], { duration: 400 / (this.speed || 1), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
            f.style.left = `${x}px`;
            f.style.top = `${y}px`;
        });
        this.at(t, () => {
            const el = typeof sel === 'string' ? this.frame.querySelector(sel) : sel;
            const f = this.frame.querySelector('.ss-finger');
            if (f) {
                f.classList.remove('is-tap');
                void f.offsetWidth;
                f.classList.add('is-tap');
            }
            if (el && !o.noPress) {
                el.classList.add('ss-pressed');
                setTimeout(() => el.classList.remove('ss-pressed'), 140);
            }
            fn?.(el);
        });
    }

    // ------------------------------------------------------------------
    loop(now) {
        const raw = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
        this.last = now;
        const dt = raw * gameTime.scale(now);
        if (!this.paused) {
            this.time += dt;
            while (this.events.length && this.events[0].t <= this.time) {
                const ev = this.events.shift();
                try { ev.fn(); } catch (e) { console.error('[장면]', e); }
            }
            this.update(dt);
            if (this.onDone && this.time >= this.duration && !this.events.length) {
                const cb = this.onDone;
                this.onDone = null;
                cb();
            }
        }
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.walkBg) this.scroll += dt * 140;
        for (const u of this.units) {
            u.t += dt;
            u.alpha = u.dead ? Math.max(0, 1 - (u.deadT += dt) / 0.45) : Math.min(1, u.alpha + dt / Math.max(0.01, u.fadeIn));
            u.flash = Math.max(0, u.flash - dt * 5);
            u.kb *= Math.pow(0.02, dt);
            u.x += u.vx * dt;
            if (u.once) {
                const a = u.art[u.once];
                if (!a || u.t >= a.duration) { u.once = null; u.t = 0; }
            }
        }
        for (const bs of this.bases) {
            bs.shake = Math.max(0, bs.shake - dt * 3);
            bs.flash = Math.max(0, bs.flash - dt * 4);
        }
        this.nums = this.nums.filter(n => (n.t += dt) < 0.9);
    }

    draw() {
        // 배경 (먼 배경 · 중간 띠 · 바닥)
        const g = this.bgCtx;
        const z = ZONE_BG[this.zone] || ZONE_BG[1];
        g.clearRect(0, 0, W, H);
        const far = imgNow.get(this.bgSrc?.far), mid = imgNow.get(this.bgSrc?.mid), floor = imgNow.get(this.bgSrc?.floor);
        g.fillStyle = '#0b0d12';
        g.fillRect(0, 0, W, H);
        if (far) {
            g.filter = `brightness(${z.far[0]}) saturate(${z.far[1]})`;
            const fh = H, fw = far.width * (fh / far.height);
            const off = -((this.scroll * 0.1) % fw);
            for (let x = off; x < W; x += fw) g.drawImage(far, x, 0, fw, fh);
        }
        if (mid) {
            g.filter = `brightness(${z.m[0]}) saturate(${z.m[1]})`;
            const mh = 358, mw = 640;
            const off = -((this.scroll * 0.35) % mw);
            for (let x = off; x < W; x += mw) g.drawImage(mid, x, H - z.mid - mh, mw, mh);
        }
        if (floor) {
            g.filter = 'brightness(0.85)';
            const fh = z.floor, fw = 256;
            const off = -(this.scroll % fw);
            for (let x = off; x < W; x += fw) g.drawImage(floor, x, H - fh, fw, fh);
        }
        g.filter = 'none';

        // 거점 · 적 · 숫자
        const c = this.uctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, W, H);
        for (const bs of this.bases) {
            const src = bs.art.src[Math.min(bs.state, bs.art.src.length - 1)];
            const im = imgNow.get(src);
            if (!im) continue;
            const w = bs.art.w * bs.scale, h = bs.art.h * bs.scale;
            const sx = bs.shake ? rand(-1, 1) * bs.shake * 6 : 0;
            c.globalAlpha = bs.alpha;
            c.drawImage(im, bs.x + sx, H - FB - h + (bs.art.sink || 0) * bs.scale, w, h);
            if (bs.flash > 0) {
                c.filter = 'brightness(3) saturate(0)';
                c.globalAlpha = bs.flash * 0.6;
                c.drawImage(im, bs.x + sx, H - FB - h + (bs.art.sink || 0) * bs.scale, w, h);
                c.filter = 'none';
            }
            c.globalAlpha = 1;
        }
        for (const u of this.units) {
            if (u.hidden || u.alpha <= 0) continue;
            const anim = (u.once && u.art[u.once]) || u.art.walk;
            const im = imgNow.get(anim.src);
            if (!im) continue;
            const n = anim.frames;
            const fw = im.width / n, fh = im.height;
            let f = 0;
            if (u.once) f = Math.min(n - 1, Math.floor((u.t / anim.duration) * n));
            else if (!u.idle || u.vx) f = Math.floor((u.t / anim.duration) * n) % n;
            const dw = u.w, dh = u.h;
            const x = u.x + u.kb - u.art.anchorX * u.scale, y = H - FB - dh;
            // 그림자
            c.globalAlpha = 0.35 * u.alpha;
            c.fillStyle = '#000';
            c.beginPath();
            c.ellipse(u.x + u.kb, H - FB + 2, dw * 0.32, 6, 0, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = u.alpha;
            c.filter = u.status === 'frozen' ? 'saturate(0.3) brightness(1.25) sepia(0.4) hue-rotate(160deg)'
                : u.status === 'curse' ? 'saturate(0.6) brightness(0.8) sepia(0.6) hue-rotate(230deg)'
                    : (u.tint || 'none');
            c.drawImage(im, f * fw, 0, fw, fh, x, y, dw, dh);
            if (u.flash > 0) {
                c.filter = 'brightness(4) saturate(0)';
                c.globalAlpha = u.alpha * u.flash * 0.75;
                c.drawImage(im, f * fw, 0, fw, fh, x, y, dw, dh);
            }
            c.filter = 'none';
            c.globalAlpha = 1;
        }
        for (const n of this.nums) {
            const u = n.t / 0.9;
            const y = H - n.b - 40 * ease(Math.min(1, u * 1.6));
            c.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
            c.font = `${n.crit ? 900 : 800} ${n.crit ? 34 : 24}px Orbitron, 'Chakra Petch', sans-serif`;
            c.textAlign = 'center';
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            c.strokeText(n.text, n.x, y);
            c.fillStyle = n.color || (n.crit ? '#ff3b5c' : '#ffe27a');
            c.fillText(n.text, n.x, y);
            if (n.crit) {
                c.font = "800 13px Orbitron, sans-serif";
                c.fillStyle = '#ffd1d9';
                c.fillText('CRITICAL', n.x, y - 30);
            }
            c.globalAlpha = 1;
        }
    }
}
