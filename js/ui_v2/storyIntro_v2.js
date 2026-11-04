/* ==========================================================================
   스토리 인트로 (모션 코믹) — 구역 N의 첫 스테이지(N-1) 출격 전에 그 구역 이야기를 보여 줌 (D-100)
   대본: js/engine_v2/storyIntros_v2.js · 모양: ui_v2.css '스토리 인트로' · 컷 그림: tools/images/build_intro_art.py
   - 만화 칸(panel)이 차례로 들어오고, 칸마다 새로 그린 일러스트가 천천히 밀고 들어가거나 흐르며
     흔들림·섬광·입자·도장 같은 효과가 얹힘 (모션 그래픽) + 내레이션 상자·말풍선(한 글자씩)·효과음 글자·시스템 경고 (만화)
   - 탭 / Space / Enter: 글자가 나오는 중이면 바로 다 보여 주고, 다 나왔으면 다음 장면.
     가만히 두면 읽을 시간 뒤 저절로 넘어감 · SKIP / Esc: 바로 끝
   - 처음 출격할 때 한 번만 (progress.tips 'intro_z<구역>') · 메인 화면 '스토리' 단추로 다시 보기
   ========================================================================== */

import { sound } from '../engine_v2/audio/sound_v2.js';
import { progress } from '../engine_v2/progress_v2.js';
import { displayRes } from '../engine_v2/displayRes.js';
import { STORY_INTROS } from '../engine_v2/storyIntros_v2.js';

const TYPE_CPS = 38;                                       // 글자 나오는 속도 (초당 글자)
const READ = { base: 0.8, perChar: 0.045, max: 4.2 };       // 다 나온 뒤 읽을 시간 (초)
const TEXT_AT = 0.35;                                      // 글자 상자 기본 등장 시각 (칸이 들어온 뒤)
const tipId = zone => `intro_z${zone}`;

/** 스테이지 id → 인트로가 있는 구역 번호 (N-1만) */
export function introZoneOf(stageId) {
    const m = /^(\d+)-1$/.exec(stageId || '');
    return m && STORY_INTROS[+m[1]] ? +m[1] : null;
}

export function hasIntro(zone) {
    return !!STORY_INTROS[zone];
}

/** 이 스테이지 출격 전에 인트로를 틀어야 하는가 (처음 한 번 · 검사 도구는 window.madOverlordNoIntro로 끔) */
export function shouldPlayIntro(stageId) {
    const zone = introZoneOf(stageId);
    return !!zone && !progress.hasTip(tipId(zone)) && !window.madOverlordNoIntro;
}

let current = null;

/** 지금 재생 중인 인트로 (없으면 null) — 검사 도구용 */
export function currentIntro() {
    return current;
}

/** 인트로 재생 → 끝나거나 건너뛰면 true로 풀림 (본 것으로 기록) */
export function playStoryIntro(zone) {
    const script = STORY_INTROS[zone];
    if (!script) return Promise.resolve(false);
    if (current) current.finish();
    return new Promise(resolve => { current = new StoryIntro(script, zone, resolve); });
}

// ---- 작은 도구 ----
const rand = (a, b) => a + Math.random() * (b - a);
const pick = v => Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
const range = v => Array.isArray(v) ? rand(v[0], v[1]) : v;

function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
}

/** 층 움직임 상태 {x, y, s, r, o} → transform */
function tf(st) {
    return `translate(${st.x || 0}px, ${st.y || 0}px) rotate(${st.r || 0}deg) scale(${st.s ?? 1})`;
}
const BASE_STATE = { x: 0, y: 0, s: 1, r: 0 };

// ---- 입자 (칸마다 캔버스 하나) ----
// life 초 · vx/vy px/초 · g 중력 · size px · draw: dot | streak | wisp | ring | puff | chunk
const PARTICLES = {
    sparks: { life: [0.25, 0.6], vx: [-170, 170], vy: [-230, -30], g: 650, size: [1.4, 2.6], color: ['#bff3ff', '#66d9ff', '#ffffff'], draw: 'streak' },
    redsparks: { life: [0.25, 0.6], vx: [-170, 170], vy: [-230, -30], g: 650, size: [1.4, 2.6], color: ['#ffd0a0', '#ff6a3a', '#ffffff'], draw: 'streak' },
    embers: { life: [1.4, 3], vx: [-22, 22], vy: [-95, -30], g: -8, size: [1.4, 3.2], color: ['#ffb347', '#ff6a2a', '#ffd27a'], draw: 'dot', flicker: true },
    ash: { life: [3, 5.5], vx: [-18, 18], vy: [18, 46], g: 0, size: [1.4, 2.8], color: ['#bfb6a8', '#7d746b', '#5d554e'], draw: 'dot' },
    ghosts: { life: [1.8, 3.2], vx: [-26, 26], vy: [-80, -30], g: 0, size: [9, 22], color: ['181,108,255', '122,60,255', '217,166,255'], draw: 'wisp', swirl: 40 },
    bubbles: { life: [1.6, 3.2], vx: [-12, 12], vy: [-130, -60], g: 0, size: [2, 6], color: ['#bfe9ff', '#7fcfff'], draw: 'ring', swirl: 18 },
    steam: { life: [1.6, 3], vx: [-24, 24], vy: [-70, -28], g: 0, size: [22, 48], grow: 1.9, color: ['235,232,228', '200,196,190', '255,190,140'], draw: 'puff' },
    dust: { life: [0.7, 1.5], vx: [-80, 80], vy: [-60, 20], g: 160, size: [2, 4.5], color: ['#8a7f70', '#5c544a', '#a39684'], draw: 'dot' },
    debris: { life: [0.8, 1.6], vx: [-60, 60], vy: [40, 160], g: 700, size: [3, 7], color: ['#3b3f47', '#565c66', '#2a2d33'], draw: 'chunk' }
};

class ParticleLayer {
    constructor(inner, w, h) {
        this.w = w;
        this.h = h;
        this.res = Math.min(2, displayRes());
        this.canvas = el('canvas', 'v2-story__particles', inner);
        this.canvas.width = Math.round(w * this.res);
        this.canvas.height = Math.round(h * this.res);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx = this.canvas.getContext('2d');
        this.emitters = [];
        this.list = [];
    }

    add(def) {
        const em = { type: PARTICLES[def.particles], rate: def.rate ?? 10, area: def.area || [0, 0, this.w, this.h], acc: 0, color: def.color, z: def.z };
        this.emitters.push(em);
        return em;
    }

    burst(em, n) {
        for (let i = 0; i < n; i += 1) this.spawn(em);
    }

    spawn(em) {
        const t = em.type;
        const [ax, ay, aw, ah] = em.area;
        this.list.push({
            t, x: ax + Math.random() * aw, y: ay + Math.random() * ah,
            vx: range(t.vx), vy: range(t.vy), size: range(t.size), color: pick(em.color || t.color),
            life: range(t.life), age: 0, ph: Math.random() * 6.28
        });
    }

    update(dt) {
        for (const em of this.emitters) {
            em.acc += em.rate * dt;
            while (em.acc >= 1) { em.acc -= 1; this.spawn(em); }
        }
        const c = this.ctx;
        c.setTransform(this.res, 0, 0, this.res, 0, 0);
        c.clearRect(0, 0, this.w, this.h);
        this.list = this.list.filter(p => (p.age += dt) < p.life);
        for (const p of this.list) {
            const t = p.t;
            p.vy += (t.g || 0) * dt;
            const sw = t.swirl ? Math.sin(p.age * 3 + p.ph) * t.swirl : 0;
            p.x += (p.vx + sw) * dt;
            p.y += p.vy * dt;
            const k = p.age / p.life;
            let a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
            if (t.flicker) a *= 0.6 + 0.4 * Math.sin(p.age * 18 + p.ph);
            c.globalAlpha = Math.max(0, a);
            if (t.draw === 'dot' || t.draw === 'chunk') {
                c.fillStyle = p.color;
                const s = p.size;
                c.fillRect(p.x - s / 2, p.y - s / 2, s, t.draw === 'chunk' ? s * 0.7 : s);
            } else if (t.draw === 'streak') {
                c.strokeStyle = p.color;
                c.lineWidth = p.size;
                c.beginPath();
                c.moveTo(p.x, p.y);
                c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
                c.stroke();
            } else if (t.draw === 'ring') {
                c.strokeStyle = p.color;
                c.lineWidth = 1.2;
                c.beginPath();
                c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                c.stroke();
            } else {
                const r = p.size * (t.grow ? 1 + (t.grow - 1) * k : 1);
                const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                const alpha = t.draw === 'wisp' ? 0.75 : 0.32;
                g.addColorStop(0, `rgba(${p.color},${alpha})`);
                g.addColorStop(1, `rgba(${p.color},0)`);
                c.fillStyle = g;
                c.beginPath();
                c.arc(p.x, p.y, r, 0, Math.PI * 2);
                c.fill();
            }
        }
        c.globalAlpha = 1;
    }
}

// ---- CSS 소품 (slash 칼날 섬광 · stamp 붉은 도장 — 둘 다 is-go로 움직임) ----
const PROPS = {
    slash(box, l) {
        Object.assign(box.style, { width: `${l.w || 600}px`, left: `${-(l.w || 600) / 2}px`, rotate: `${l.r ?? -24}deg` });
    },
    stamp(box, l) {
        box.textContent = l.text || '';
        box.style.setProperty('--r', `${l.r ?? -12}deg`);
    }
};

// ---- 재생기 ----
class StoryIntro {
    constructor(script, zone, resolve) {
        this.script = script;
        this.zone = zone;
        this.resolve = resolve;
        this.beats = script.pages.flatMap((page, p) => page.beats.map(beat => ({ page: p, beat })));
        this.beats.push({ page: -1, beat: { title: true } });   // 마지막: 스테이지 제목 카드
        this.i = -1;
        this.pageNo = -1;
        this.pending = [];
        this.typers = [];
        this.autoTimer = null;
        this.pages = [];
        this.done = false;
        this.build();
        this.preloadSounds();
        sound.playBgm(script.bgm || 'boss', 1.5);
        this.last = performance.now();
        this.raf = requestAnimationFrame(t => this.loop(t));
        this.preloadImages().then(() => { if (!this.done && this.i < 0) this.next(); });
    }

    /** 컷 그림 미리 받기: 첫 쪽(+ 제목 카드 얼굴)은 풀릴 때까지(최대 3초) 기다리고, 나머지 쪽은 뒤에서 */
    preloadImages() {
        const srcsOf = page => Object.values(page.panels).flatMap(p => (p.layers || []).filter(l => l.img).map(l => l.img));
        const load = src => {
            const img = new Image();
            img.src = src;
            this.imgCache.push(img);   // 받는 동안 사라지지 않게 붙잡아 둠
            return img.decode().catch(() => { /* 없으면 칸만 빈 채로 진행 */ });
        };
        this.imgCache = [];
        const first = [...srcsOf(this.script.pages[0]), this.script.title.face].map(load);
        this.script.pages.slice(1).forEach(page => srcsOf(page).forEach(load));
        return Promise.race([Promise.all(first), new Promise(r => setTimeout(r, 3000))]);
    }

    build() {
        const app = document.getElementById('app') || document.body;
        // 창 전체를 덮는 바탕 (휴대폰 배치는 메인 화면이 16:9 틀보다 넓어 양옆이 비침) — 눌러도 다음 장면
        this.backdrop = el('div', 'v2-story-backdrop', app);
        // .screen-v2를 쓰지 않음: 화면 전환(main_v2.js switchScreen)이 모든 .screen-v2를 숨기므로 — 크기·맞춤은 ui_v2.css .v2-story
        const root = el('section', 'v2-story', app);
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', `스토리 인트로 — ${this.script.title.name}`);
        root.dataset.zone = this.zone;
        this.root = root;
        this.stage = el('div', 'v2-story__stage', root);
        const ui = el('div', 'v2-story__ui', root);
        root.style.setProperty('--accent', this.script.title.color || '#ff3b4a');
        ui.innerHTML = '<button type="button" class="v2-story__skip" data-act="skip">SKIP <b>▶▶</b></button>'
            + '<span class="v2-story__hint">탭하여 계속</span>'
            + '<div class="v2-story__progress"><i></i></div>';
        this.progressBar = ui.querySelector('.v2-story__progress i');
        const skip = ui.querySelector('[data-act="skip"]');
        skip.addEventListener('pointerdown', e => e.stopPropagation());   // 화면 탭(다음 장면)으로 세지 않음
        skip.addEventListener('click', e => { e.stopPropagation(); this.finish(); });
        this.onTap = e => { if (e.button === 0 || e.pointerType === 'touch') this.tap(); };
        this.onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); this.finish(); }
            else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); this.tap(); }
        };
        this.onVis = () => {
            if (document.hidden) { clearTimeout(this.autoTimer); this.autoTimer = null; }
            else this.checkDone();
        };
        root.addEventListener('pointerdown', this.onTap);
        this.backdrop.addEventListener('pointerdown', this.onTap);
        document.addEventListener('keydown', this.onKey, true);
        document.addEventListener('visibilitychange', this.onVis);
        requestAnimationFrame(() => { root.style.opacity = '1'; this.backdrop.style.opacity = '1'; });
    }

    preloadSounds() {
        const names = new Set(['intro_whoosh', 'intro_sortie']);
        this.script.pages.forEach(p => p.beats.forEach(b => (b.sfx || []).forEach(([n]) => names.add(n))));
        names.forEach(n => { try { sound.load?.(n); } catch (e) { /* 소리 없이 진행 */ } });
    }

    // ---- 진행 ----
    tap() {
        if (this.done) return;
        if (this.titleShown) return this.finish();
        if (this.busy()) this.flush();
        else this.next();
    }

    /** 아직 안 나온 글자·동작이 있거나 글자가 나오는 중인가 */
    busy() {
        return this.pending.some(ev => !ev.sound) || this.typers.length > 0;
    }

    /** 이번 장면의 남은 것을 바로 (효과음은 버림) */
    flush() {
        const list = this.pending;
        this.pending = [];
        list.forEach(ev => { clearTimeout(ev.timer); if (!ev.sound) ev.run(); });
        [...this.typers].forEach(t => t.finish());
        this.checkDone();
    }

    next() {
        if (this.done) return;
        this.flush();
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
        this.i += 1;
        const item = this.beats[this.i];
        this.progressBar.style.width = `${Math.min(100, (this.i / (this.beats.length - 1)) * 100)}%`;
        if (!item) return this.finish();
        if (item.beat.title) return this.showTitle();
        if (item.page !== this.pageNo) this.openPage(item.page);
        this.runBeat(item.beat);
    }

    runBeat(beat) {
        const events = [];
        const shows = [].concat(beat.show || []);
        shows.forEach((id, k) => events.push({ at: k * 0.18, run: () => this.showPanel(id, beat) }));
        (beat.texts || []).forEach(t => events.push({ at: t.at ?? TEXT_AT, run: () => this.addText(t) }));
        (beat.acts || []).forEach(a => events.push({ at: a.at ?? 0, run: () => this.act(a) }));
        (beat.sfx || []).forEach(([name, at = 0, opts]) => events.push({ at, sound: true, run: () => sound.play(name, opts) }));
        const chars = (beat.texts || []).filter(t => t.type !== 'sfx').reduce((n, t) => n + [...t.text].length, 0);
        this.readSec = Math.min(READ.max, chars ? READ.base + READ.perChar * chars : 0.6);
        this.minEnd = performance.now() + (beat.dur || 0) * 1000;
        this.pending = events;
        events.sort((a, b) => a.at - b.at).forEach(ev => {
            if (ev.at <= 0) this.fire(ev);
            else ev.timer = setTimeout(() => this.fire(ev), ev.at * 1000);
        });
        this.checkDone();
    }

    fire(ev) {
        if (this.done || !this.pending.includes(ev)) return;
        this.pending = this.pending.filter(e => e !== ev);
        ev.run();
        this.checkDone();
    }

    /** 다 나왔으면 읽을 시간(또는 장면 최소 길이) 뒤 다음 장면 */
    checkDone() {
        if (this.done || this.titleShown || this.busy() || this.autoTimer || document.hidden) return;
        const wait = Math.max(this.minEnd - performance.now(), this.readSec * 1000);
        this.autoTimer = setTimeout(() => { this.autoTimer = null; this.next(); }, wait);
    }

    // ---- 페이지·칸 ----
    openPage(p) {
        const old = this.pageEl;
        if (old) {
            old.classList.add('is-out');
            setTimeout(() => this.disposePage(old), 700);
        }
        const def = this.script.pages[p];
        const page = el('div', 'v2-story__page', this.stage);
        page._fx = [];
        this.panels = {};
        Object.entries(def.panels).forEach(([id, pd]) => { this.panels[id] = this.buildPanel(id, pd, page); });
        this.textLayer = el('div', 'v2-story__texts', page);
        this.pageEl = page;
        this.pageNo = p;
        this.pages.push(page);
    }

    disposePage(page) {
        page._fx.length = 0;
        page.remove();
        this.pages = this.pages.filter(p => p !== page);
    }

    buildPanel(id, pd, page) {
        const [x, y, w, h] = pd.rect;
        const panel = el('div', `v2-story__panel in-${pd.enter || 'fade'}`, page);
        Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
        const inner = el('div', 'v2-story__inner', panel);
        if (pd.poly) {
            const poly = `polygon(${pd.poly.map(([px, py]) => `${px}% ${py}%`).join(',')})`;
            panel.style.clipPath = poly;
            inner.style.clipPath = poly;
        }
        if (pd.bg) inner.style.background = pd.bg;
        if (pd.tone) inner.classList.add(`is-${pd.tone}`);
        const scene = el('div', 'v2-story__scene', inner);
        const info = { id, el: panel, inner, scene, x, y, w, h, layers: {}, particles: null, page };
        (pd.layers || []).forEach((l, k) => this.buildLayer(info, l, k));
        el('i', 'v2-story__halftone', inner);
        return info;
    }

    buildLayer(panel, l, k) {
        const { scene, w, h } = panel;
        if (l.particles) {
            if (!panel.particles) {
                panel.particles = new ParticleLayer(scene, w, h);
                panel.particles.canvas.style.zIndex = l.z ?? 30;
                panel.page._fx.push(panel.particles);
            }
            const em = panel.particles.add(l);
            if (l.id) panel.layers[l.id] = { emitter: em, particles: panel.particles };
            return;
        }
        const wrap = el('div', 'v2-story__layer', scene);
        wrap.style.left = `${l.x ?? 0}px`;
        wrap.style.top = `${l.y ?? 0}px`;
        wrap.style.zIndex = l.z ?? k + 1;
        const flip = el('div', 'v2-story__flip', wrap);
        if (l.flip) flip.style.transform = 'scaleX(-1)';
        const layer = { def: l, wrap, state: { ...BASE_STATE, ...(l.from || {}) } };
        let content = null;
        if (l.img) {
            content = el('img', `v2-story__img is-${l.anchor || (l.w && l.h ? 'tl' : 'b')}`, flip);
            content.src = l.img;
            content.alt = '';
            content.draggable = false;
            if (l.w) content.style.width = `${l.w}px`;
            if (l.h) content.style.height = `${l.h}px`;
        } else if (l.fx) {
            content = el('div', `v2-story__fx is-${l.fx}`, flip);
            wrap.style.left = '0px';
            wrap.style.top = '0px';
            Object.assign(content.style, { width: `${w}px`, height: `${h}px` });
            if (l.color) content.style.setProperty('--c', l.color);
            if (l.at) content.style.setProperty('--at', l.at);
            if (l.css) content.style.background = l.css;
        } else if (l.prop) {
            content = el('div', `v2-story-${l.prop}`, flip);
            PROPS[l.prop](content, l);
        }
        if (content && l.filter) content.style.filter = l.filter;
        if (content && l.blend) wrap.style.mixBlendMode = l.blend;
        if (content && l.cls) content.classList.add(...[].concat(l.cls));
        layer.content = content;
        wrap.style.transform = tf(layer.state);
        wrap.style.opacity = l.o ?? 1;
        if (l.anim) this.move(layer, l.anim.to, l.anim);
        if (l.id) panel.layers[l.id] = layer;
    }

    /**
     * 층 이동: to {x, y, s, r, o} (빠진 값은 지금 값) · opts {dur, delay, ease, loop, alt}
     * 불투명도만 바꾸면 진행 중인 카메라 움직임(밀고 들어가기)은 그대로 두고 따로 겹쳐 돌림
     */
    move(layer, to, opts = {}) {
        const timing = {
            duration: (opts.dur ?? 1) * 1000, delay: (opts.delay ?? 0) * 1000, easing: opts.ease || 'ease-in-out', fill: 'both',
            iterations: opts.loop ? Infinity : 1, direction: opts.alt ? 'alternate' : 'normal'
        };
        const fromO = layer.opacity ?? Number(layer.wrap.style.opacity || 1);
        const toO = to.o ?? fromO;
        if (Object.keys(to).every(k => k === 'o')) {
            layer.wrap.animate([{ opacity: fromO }, { opacity: toO }], timing);
            layer.opacity = toO;
            return;
        }
        // 이동이 이미 돌고 있으면 지금 자리에서 이어서
        const running = layer.wrap.getAnimations();
        running.forEach(a => { try { a.commitStyles(); } catch (e) { /* 화면에 없음 */ } a.cancel(); });
        const fromTf = running.length ? layer.wrap.style.transform : tf(layer.state);
        const target = { ...layer.state, ...to };
        layer.wrap.animate([{ transform: fromTf, opacity: fromO }, { transform: tf(target), opacity: toO }], timing);
        if (!opts.loop) {
            layer.state = target;
            layer.opacity = toO;
        }
    }

    showPanel(id, beat) {
        const p = this.panels[id];
        if (!p || p.el.classList.contains('is-in')) return;
        p.el.classList.add('is-in');
        if (!beat.quiet) sound.play('intro_whoosh', { vol: 0.55 });
    }

    // ---- 장면 동작 ----
    act(a) {
        const panel = a.on ? this.panels[a.on] : null;
        if (a.fx) {
            if (panel) this.panelFx(panel, a.fx);
            else this.stageFx(a.fx);
        }
        if (!panel || !a.id) return;
        const layer = panel.layers[a.id];
        if (!layer) return;
        if (layer.emitter) {
            if (a.rate !== undefined) layer.emitter.rate = a.rate;
            if (a.burst) layer.particles.burst(layer.emitter, a.burst);
            return;
        }
        if (a.to) this.move(layer, a.to, a);
        if (a.cls && layer.content) layer.content.classList.add(...[].concat(a.cls));
    }

    /** 칸 효과: shake 흔들림 · quake 큰 흔들림 · punch 확대 · flash 흰 섬광 · red 붉은 섬광 · black 암전 */
    panelFx(panel, fx) {
        if (fx === 'shake' || fx === 'quake') {
            const m = fx === 'quake' ? 14 : 7;
            const frames = [];
            for (let i = 0; i < 9; i += 1) frames.push({ transform: `translate(${rand(-m, m)}px, ${rand(-m, m)}px)` });
            frames.push({ transform: 'none' });
            panel.scene.animate(frames, { duration: fx === 'quake' ? 620 : 380, easing: 'linear' });
        } else if (fx === 'punch') {
            panel.scene.animate([{ transform: 'scale(1.07)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
        } else {
            const f = el('i', `v2-story__flash is-${fx}`, panel.inner);
            f.addEventListener('animationend', () => f.remove());
        }
    }

    stageFx(fx) {
        const f = el('i', `v2-story__flash is-${fx}`, this.stage);
        f.addEventListener('animationend', () => f.remove());
    }

    // ---- 글자 ----
    /** type: cap 내레이션 · say 말풍선(tone dark/red/gold, shout) · sys 시스템 경고 · sfx 효과음 글자 */
    addText(t) {
        const panel = this.panels[t.on];
        if (!panel) return;
        const type = t.type || 'say';
        const box = el('div', `v2-story__text is-${type}`, this.textLayer);
        if (t.tone) box.classList.add(`tone-${t.tone}`);
        if (t.shout) box.classList.add('is-shout');
        if (t.tail) box.classList.add(`tail-${t.tail}`);
        box.style.left = `${panel.x + (t.x ?? 0)}px`;
        box.style.top = `${panel.y + (t.y ?? 0)}px`;
        if (t.w) box.style.maxWidth = `${t.w}px`;
        if (t.size) box.style.fontSize = `${t.size}px`;
        if (t.color) box.style.setProperty('--c', t.color);
        box.style.setProperty('--r', `${t.rot ?? 0}deg`);
        if (t.who) el('em', 'v2-story__who', box).textContent = t.who;
        const body = el('span', 'v2-story__body', box);
        if (type === 'sfx') body.textContent = t.text;
        else this.typeText(body, t.text);
        // 휴대폰 배치에서 키울 때(--k) 화면 가장자리 쪽 상자는 안쪽으로 커지게: 기준점을 가까운 모서리로
        const cx = box.offsetLeft + box.offsetWidth / 2, cy = box.offsetTop + box.offsetHeight / 2;
        box.style.transformOrigin = `${cx > 640 ? '100%' : '0'} ${cy > 360 ? '100%' : '0'}`;
    }

    typeText(body, text) {
        const shown = el('span', null, body);
        const rest = el('span', 'is-rest', body);
        const chars = [...text];
        rest.textContent = text;
        let n = 0;
        let id = 0;
        const typer = {
            finish: () => {
                clearInterval(id);
                shown.textContent = text;
                rest.textContent = '';
                this.typers = this.typers.filter(x => x !== typer);
                this.checkDone();
            }
        };
        this.typers.push(typer);
        id = setInterval(() => {
            if (this.done) return clearInterval(id);
            n += 1;
            shown.textContent = chars.slice(0, n).join('');
            rest.textContent = chars.slice(n).join('');
            if (n >= chars.length) typer.finish();
        }, 1000 / TYPE_CPS);
    }

    // ---- 제목 카드 → 끝 ----
    showTitle() {
        this.titleShown = true;
        const t = this.script.title;
        const card = el('div', 'v2-story__title', this.stage);
        card.innerHTML = `<div class="v2-story__title-face"><img src="${t.face}" alt=""></div>`
            + `<div class="v2-story__title-text"><small>${t.no}</small><h2>${t.name}</h2><i></i>`
            + t.rows.map(([k, v]) => `<p><b>${k}</b><span>${v}</span></p>`).join('')
            + '</div>';
        if (t.color) card.style.setProperty('--c', t.color);
        sound.play('intro_sortie');
        this.titleTimer = setTimeout(() => this.finish(), (t.hold ?? 3.6) * 1000);
    }

    finish() {
        if (this.done) return;
        this.done = true;
        clearTimeout(this.autoTimer);
        clearTimeout(this.titleTimer);
        this.pending.forEach(ev => clearTimeout(ev.timer));
        this.pending = [];
        this.typers = [];
        progress.markTip(tipId(this.zone));
        document.removeEventListener('keydown', this.onKey, true);
        document.removeEventListener('visibilitychange', this.onVis);
        this.root.removeEventListener('pointerdown', this.onTap);
        this.root.classList.add('is-closing');
        this.backdrop.classList.add('is-closing');
        if (current === this) current = null;
        setTimeout(() => {
            cancelAnimationFrame(this.raf);
            [...this.pages].forEach(p => this.disposePage(p));
            this.root.remove();
            this.backdrop.remove();
            this.resolve(true);
        }, 420);
    }

    loop(now) {
        if (this.done) return;
        const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
        this.last = now;
        this.pages.forEach(p => p._fx.forEach(f => f.update(dt)));
        this.raf = requestAnimationFrame(t => this.loop(t));
    }
}
