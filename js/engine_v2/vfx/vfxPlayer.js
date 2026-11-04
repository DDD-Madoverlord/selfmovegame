/* ==========================================================================
   PROJECT: MAD OVERLORD // VFX PLAYER (v2)
   데이터로 정의한 스킬 이펙트를 재생한다. 게임(battleFx.js)과 테스트 화면(rig_test.html)이 함께 사용.
   constructor({style: 'glow'|'pixel'}): pixel은 이펙트만 1/3 해상도에 그리고 보간 없이 확대한다.
   style은 재생 중에도 변경 가능. 원래 캔버스 변환·앞/바닥 레이어 순서를 유지한다.

   이펙트 정의 = { layers: [...], sfx?: '효과음 이름' }
     layer 공통: { type, at(시작 초), dur(길이 초), color('r, g, b'), layer?('ground'|'front'),
                  dy?(기준점 위아래 px), pos?('to' = 목표 지점에 표시) }
     type (모양)
       sprite  : 그림 프레임 이펙트 (Gemini 손그림 시트, VFX_SHEETS) {sheet, size, angle?, flipX?, squash?, blend?, alpha?, glow?, hue?(색 돌리기 도)}
       starburst: 윤곽 별 섬광 {r, points, inner, stretch?, angle?, outline?, width?} (처음 0.05초 최대)
       speedlines: 삼각 속도선 {count, len, angle?, cone?, width, outline?}
       ribbon  : 단색 불길/광선/기둥 {len, w, angle?, jag?, outline?, width?} (to가 있으면 두 점 연결)
       tendrils: 재질 위주의 솟는 촉수 {count, h, w, spread, angular?, outline?, width?}
       flash   : 순간 섬광 {r}
       fireball: 부풀었다 사그라드는 불덩이 (흰 중심 → 노랑 → 색) {r}
       ring    : 퍼지는 고리 {r, width, ground?(바닥 타원), inward?(조여드는 고리)}
       bolt    : 재점화하며 갈라지는 번개 {count, len?, angle?(라디안, 없으면 방사형), jag(px), branches(가닥당), width, flicker(초)} (to 우선)
       slash   : 쓸고 지나가는 초승달 베기 + 잔상 {r, arc(라디안), angle(베는 방향), width, sweep(초), thick(두께 배수)}
       shockwave: 밝은 안쪽에서 바깥으로 번지는 충격파 띠 {r, width(띠 두께), ground?(바닥 타원)}
       rays    : 회전하며 길이가 출렁이는 빛살 {count, len, width, spin(초당 라디안)}
       glow    : 바닥 잔광 {r}
       pillar  : 바닥에서 솟는 빛기둥 {h, w}
       rune    : 바닥 마법진 (회전하는 룬 고리 + 별) {r, spin}
       swirl   : 안으로 말려드는 소용돌이 {r, arms, spin}
       beam    : 기준점 → 목표 지점 광선 {w}  (play 옵션 to 필요)
       claw    : 할퀸/베인 자국 {count, len, gap, angle, width?(색 번짐 굵기), bend?(휜 정도)}
       bite    : 위아래 턱이 닫히는 물기 자국 {r}
       cracks  : 바닥 균열 {count, len}
       jet     : 기준점 → 목표 지점 물줄기 (출렁이는 굵은 줄기 + 흰 심 + 끝의 물보라) {w, spray}  (play 옵션 to 필요)
       hands   : 바닥에서 솟아 움켜쥐는 유령 손 {count, h, spread}
       crystals: 바닥에서 솟는 얼음 결정 가시 (솟고 → 버티고 → 사라짐) {count, h, spread}
       mist    : 낮게 흐르는 옅은 안개 띠 {r, h, life(초), drift(px/초), rim?(고정 바닥 경계)} (입자 0)
     type (입자)
       flame   : 부채꼴로 뿜어져 커지고 식는 불길 {count, speed, angle?, cone?, size, grow, life:[min,max], drag, rise, color?, smoke?, matte?(비발광 재질)}
       embers  : 날리다 붉게 식어 꺼지는 불씨 {count, speed, angle?, cone?, size, life:[min,max], drag, rise, color?}
       sparks  : 사방/부채꼴로 튀는 빛줄기 {count, speed, angle?, cone?}
       streaks : 감속하는 불티 (흰 머리 + 속도 방향의 긴 꼬리) {count, speed, angle?, cone?, len, life(초 또는 [min,max])}
       motes   : 떠오르는 빛가루 {count, spread, rise:[min,max], life:[min,max], size}
       smoke   : 퍼지며 흩어지는 연기 {count, spread, spreadY, size, life:[min,max], rise, speed?, angle?(분출 방향)}
       debris  : 중력으로 떨어지는 파편 {count, speed, size, angle?, cone?}
       chevrons: 가라앉는 ▼ 표식 (디버프) {count, spread, fall, life:[min,max], size}
       drops   : 위로 튀었다 떨어지는 둥근 물방울 {count, speed, size, angle?, cone?}
       shards  : 회전하는 3~5각 파편, 밝은 모서리·어두운 면 + 바닥에서 한 번 튕김
                 {count, speed, angle?, cone?, size, spin, gravity?, life(초 또는 [min,max]), shape?('ice'|'rock'|'shell'), color}
       goo     : 속도 방향으로 늘어지는 광택 덩어리 → 바닥 얼룩 + 작은 방울 2개
                 {count, speed, angle?, cone?, size, life(초 또는 [min,max]), splat?(기본 true), color}
                 shards·goo의 floor?: 발생점 아래 바닥 높이(px, 기본 32), dy로 공중 발생 시 그 높이만큼 지정
       dust    : 바닥을 따라 굴러 커지고 흐려지는 낮은 흙먼지 {count, speed, dir?('both'|'left'|'right'), size, life, color}
   크기 단위: 게임 전장 px. play(..., {scale})로 배율 지정 (테스트 화면은 캐릭터가 커서 배율 ↑)
   좌표: 화면 좌표(y 아래로 증가). 바닥 이펙트는 발 높이 y 기준.

   그 밖에
     setPersistent(key, layer, follow, scale, {targets}): 계속 떠 있는 이펙트. pulse(key)로 번쩍임
       layer.kind 'rune'(기본): 바닥 마법진 {r, spin}
       layer.kind 'field': 저주 장판 — 어두운 웅덩이 + 일렁이는 테두리 + 피어오르는 기운 + 틱마다 앞으로 쓸리는 파문
                          {rx, flat, dy, color, dark, haze, wisps(초당), origin(발밑 근원 위치), rune?}
                          targets() → [{key, x, y, w}]: 장판 안 대상의 발 위치 → 발목을 휘감는 촉수
     launchWave / launchOrb / launchMissile / launchChain / launchNeedle: 이동하는 투사체
       orb: 흰 구체 심 + 색 테두리 + 리본 꼬리 / missile: 추진 불꽃(flame) + 연기 / needle: 긴 속도 꼬리
       beam: 흰 심 + 맥박치는 색 띠 + 일렁이는 가장자리 (기존 w·to 유지)
     onSfx(name, x): 효과음 연결 지점 (x = 이펙트 자리, 소리 좌우에 씀 — battleFx가 사운드 매니저를 연결)
   ========================================================================== */

const WHITE = '255, 255, 255';
const GROUND_TYPES = new Set(['rune', 'glow', 'cracks', 'mist']);
const MAX_PARTS = 700;   // 입자 상한: 넘으면 오래된 것부터 버림 (스킬이 겹쳐도 프레임 유지)

export class VfxPlayer {
    constructor({ style = 'glow' } = {}) {
        this.style = style;
        this.pixelCanvas = null;
        this.items = [];
        this.parts = [];
        this.projectiles = [];
        this.persistent = new Map();
        this.time = 0;
        this.seed = 7331;
        this.onSfx = null;
    }

    rand() {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }

    range([a, b]) {
        return a + (b - a) * this.rand();
    }

    clear() {
        this.items = [];
        this.parts = [];
        this.projectiles = [];
        this.persistent.clear();
    }

    /** 이펙트 재생. opts: { scale, follow: () => [x, y] (따라다닐 때), to: [x, y] (광선/목표 지점 레이어) } */
    play(def, x, y, opts = {}) {
        const s = opts.scale || 1;
        for (const layer of def.layers) {
            this.items.push({ ...layer, t: -(layer.at || 0), x, y, s, follow: opts.follow || null,
                to: opts.to || null, started: false, owner: opts.owner });
        }
        if (def.sfx && this.onSfx) this.onSfx(def.sfx, x);
    }

    setPersistent(key, layer, follow, scale = 1, opts = {}) {
        if (!layer) {
            this.persistent.delete(key);
            return;
        }
        this.persistent.set(key, { ...layer, follow, s: scale, t: 0, pulse: 0, open: 0, emit: 0,
            targets: opts.targets || null, targetList: [], grips: new Map() });
    }

    removeOwner(owner) {
        this.items = this.items.filter(it => it.owner !== owner);
        this.parts = this.parts.filter(p => p.owner !== owner);
        this.projectiles = this.projectiles.filter(pr => pr.owner !== owner);
    }

    pulse(key) {
        const p = this.persistent.get(key);
        if (p) p.pulse = 1;
    }

    /**
     * 어둠 파동: 초승달 모양이 앞으로 날아가며 지나간 구간마다 onMove(x0, x1) 호출
     * o: { x, y, dir(1|-1), speed, range, h, color, scale, onMove, onEnd }
     */
    launchWave(o) {
        this.projectiles.push({ kind: 'wave', dist: 0, t: 0, trailAcc: 0, dir: 1, speed: 520, h: 70, scale: 1, ...o });
    }

    /** 세뇌 구체: from에서 to로 포물선 비행 후 onArrive. o: { from:[x,y], to: () => [x,y], dur, color, scale, onArrive } */
    launchOrb(o) {
        this.projectiles.push({ kind: 'orb', t: 0, dur: 0.45, scale: 1, trail: [], ...o });
    }

    /** 미사일: 포물선 비행 + 연기 꼬리, 도착 시 onArrive(x, y). o: { from, to, dur, apex, color, scale, onArrive } */
    launchMissile(o) {
        this.projectiles.push({ kind: 'missile', t: 0, dur: 0.55, apex: 70, scale: 1, trailAcc: 0,
            color: '255, 170, 60', ...o, x: o.from[0], y: o.from[1], angle: 0 });
    }

    /**
     * 앵커 사슬: 손(from)에서 앵커가 목표로 날아가 박힘 → onHook → 사슬을 감아 손으로 돌아옴 → onDone
     * o: { from: () => [x, y], to: () => [x, y], out(초), back(초), color, scale, onHook(x, y), onDone }
     * 감는 동안 앵커 머리는 back초에 걸쳐 박힌 자리에서 손으로 (끌려오는 적은 전투 엔진이 같은 시간에 옮김)
     */
    launchChain(o) {
        const [x, y] = o.from();
        this.projectiles.push({ kind: 'chain', t: 0, out: 0.28, back: 0.35, scale: 1, color: '60, 225, 200', ...o,
            phase: 'out', x, y, hx: x, hy: y, angle: 0 });
    }

    /** 주사 바늘: from에서 to로 곧게 빠르게 날아가 onArrive(x, y). o: { from:[x,y], to: () => [x,y], dur, color, scale, onArrive } */
    launchNeedle(o) {
        this.projectiles.push({ kind: 'needle', t: 0, dur: 0.16, scale: 1, color: '235, 40, 70', ...o,
            x: o.from[0], y: o.from[1], angle: 0 });
    }

    // ------------------------------------------------------------------
    update(dt) {
        this.time += dt;
        for (const it of this.items) {
            it.t += dt;
            if (!it.started && it.t >= 0) {
                it.started = true;
                const first = this.parts.length;
                this._burst(it);
                if (it.owner) for (let i = first; i < this.parts.length; i++) this.parts[i].owner = it.owner;
            }
        }
        this.items = this.items.filter(it => it.t < (it.dur || 0) || !it.started);

        for (const p of this.persistent.values()) {
            p.t += dt;
            p.open = Math.min(1, p.open + dt / 0.4);
            p.pulse = Math.max(0, p.pulse - dt / (p.pulseSec || 0.35));
            if (p.kind === 'field') this._updateField(p, dt);
        }

        for (const p of this.parts) {
            p.t += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 1 - (p.drag || 0) * dt;
            p.vy *= 1 - (p.drag || 0) * dt;
            p.vy += (p.g || 0) * dt;
            if (p.vr) p.rot += p.vr * dt;
            if ((p.kind === 'shard' || p.kind === 'goo') && p.y >= p.floor && p.vy > 0) {
                p.y = p.floor;
                if (p.kind === 'shard') {
                    if (!p.bounced) {
                        p.vy *= -0.32;
                        p.vx *= 0.65;
                        p.vr *= 0.55;
                        p.bounced = true;
                    } else {
                        p.vx = p.vy = p.g = p.vr = 0;
                        p.t = Math.max(p.t, p.dur - 0.16);
                    }
                } else if (p.splat) {
                    p.kind = 'splat';
                    p.layer = 'ground';
                    p.t = 0;
                    p.dur = p.splatLife;
                    p.vx = p.vy = p.g = 0;
                    // 자식은 얼룩·재분열 없이 끝남. 작은 방울도 같은 700개 상한을 사용한다.
                    for (let i = 0; i < 2 && this.parts.length < MAX_PARTS; i++) {
                        this.parts.push({ kind: 'goo', x: p.x, y: p.y - p.r * 0.3, floor: p.floor,
                            vx: (i ? 1 : -1) * (25 + this.rand() * 35) * p.s, vy: -(40 + this.rand() * 45) * p.s,
                            g: 650 * p.s, drag: 1.8, t: 0, dur: 0.3, r: p.r * 0.28, s: p.s, color: p.color, splat: false, owner: p.owner });
                    }
                } else p.t = p.dur;
            }
        }
        this.parts = this.parts.filter(p => p.t < p.dur);
        if (this.parts.length > MAX_PARTS) this.parts.splice(0, this.parts.length - MAX_PARTS);

        for (const pr of this.projectiles) {
            if (pr.owner && !this.projectiles.includes(pr)) continue;
            const first = this.parts.length;
            this._updateProjectile(pr, dt);
            if (pr.owner) {
                for (let i = first; i < this.parts.length; i++) this.parts[i].owner = pr.owner;
                // 적중 처리 중 철수/승리가 시작됐다면 방금 생긴 꼬리 입자도 제거한다.
                if (!this.projectiles.includes(pr)) this.removeOwner(pr.owner);
            }
        }
        this.projectiles = this.projectiles.filter(pr => !pr.done);
        if (this.parts.length > MAX_PARTS) this.parts.splice(0, this.parts.length - MAX_PARTS);
    }

    // 저주 장판: 장판 곳곳에서 기운이 피어오르고, 안에 들어온 대상마다 촉수가 자라남
    _updateField(p, dt) {
        const [cx, cy] = p.follow();
        const s = p.s;
        const rx = p.rx * s * p.open, ry = rx * (p.flat || 0.22);
        const y = cy + (p.dy || 0) * s;
        p.emit += dt * (p.wisps || 0);
        while (p.emit >= 1) {
            p.emit -= 1;
            const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * 0.9;
            const px = cx + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
            this.parts.push({ kind: 'smoke', x: px, y: py, vx: (this.rand() - 0.5) * 12 * s, vy: -(16 + this.rand() * 22) * s,
                t: 0, dur: 1.0 + this.rand() * 0.8, drag: 0.5, color: p.haze || p.dark, r: (12 + this.rand() * 12) * s, layer: 'ground' });
            if (this.rand() < 0.4) {
                this.parts.push({ kind: 'mote', x: px, y: py, vx: 0, vy: -(26 + this.rand() * 36) * s, t: 0,
                    dur: 0.7 + this.rand() * 0.6, color: p.color, r: 1.7 * s, phase: this.rand() * 6 });
            }
        }
        if (!p.targets) return;
        p.targetList = p.targets();
        const seen = new Set();
        for (const tg of p.targetList) {
            seen.add(tg.key);
            p.grips.set(tg.key, (p.grips.get(tg.key) || 0) + dt);
        }
        for (const k of [...p.grips.keys()]) if (!seen.has(k)) p.grips.delete(k);
    }

    _pos(it) {
        let x, y;
        if (it.pos === 'to' && it.to) [x, y] = it.to;
        else [x, y] = it.follow ? it.follow() : [it.x, it.y];
        return [x, y + (it.dy || 0) * it.s];
    }

    _cone(it) {
        return (it.angle != null ? it.angle : 0) + (it.cone != null ? (this.rand() - 0.5) * it.cone : this.rand() * Math.PI * 2);
    }

    _burst(it) {
        const s = it.s;
        const [x, y] = this._pos(it);
        if (it.type === 'sparks') {
            for (let i = 0; i < (it.count || 12); i++) {
                const a = this._cone(it);
                const v = (it.speed || 260) * s * (0.5 + this.rand() * 0.8);
                this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0,
                    dur: 0.25 + this.rand() * 0.2, drag: 4, color: it.color, s });
            }
        } else if (it.type === 'streaks') {
            for (let i = 0; i < Math.min(it.count ?? 8, MAX_PARTS); i++) {
                const a = this._cone(it);
                const v = (it.speed ?? 380) * s * (0.65 + this.rand() * 0.7);
                this.parts.push({ kind: 'streak', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0,
                    dur: Array.isArray(it.life) ? this.range(it.life) : (it.life ?? this.range([0.3, 0.55])), drag: 3.5, color: it.color, s,
                    len: (it.len ?? 32) * s * (0.8 + this.rand() * 0.4), layer: it.layer || 'front' });
            }
        } else if (it.type === 'shards' || it.type === 'goo') {
            const shard = it.type === 'shards';
            for (let i = 0; i < Math.min(it.count ?? 6, MAX_PARTS); i++) {
                const a = this._cone({ angle: -Math.PI / 2, cone: 2.6, ...it });
                const v = (it.speed ?? 190) * s * (0.65 + this.rand() * 0.55);
                const p = { kind: shard ? 'shard' : 'goo', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    t: 0, dur: Array.isArray(it.life) ? this.range(it.life) : (it.life ?? 0.85),
                    g: (it.gravity ?? (shard ? 850 : 700)) * s, drag: shard ? 0.4 : 1.4,
                    floor: y + (it.floor ?? 32) * s, r: (it.size ?? 6) * s * (0.75 + this.rand() * 0.5),
                    color: it.color || (shard ? '150, 220, 255' : '150, 255, 90'), s, layer: it.layer || 'front' };
                if (shard) {
                    p.rot = this.rand() * Math.PI * 2;
                    p.vr = (it.spin ?? 8) * (this.rand() < 0.5 ? -1 : 1);
                    p.shape = it.shape || 'ice';
                    p.points = [];
                    const n = 3 + Math.floor(this.rand() * 3);
                    for (let k = 0; k < n; k++) {
                        const angle = k / n * Math.PI * 2;
                        const r = p.r * (0.65 + this.rand() * 0.35);
                        p.points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
                    }
                } else {
                    p.splat = it.splat !== false;
                    p.splatLife = p.dur * 0.7;
                }
                this.parts.push(p);
            }
        } else if (it.type === 'dust') {
            const n = Math.min(it.count ?? 5, MAX_PARTS);
            for (let i = 0; i < n; i++) {
                const dir = it.dir === 'left' ? -1 : it.dir === 'right' ? 1 : (i % 2 ? 1 : -1);
                this.parts.push({ kind: 'dust', x: x + dir * this.rand() * 8 * s, y, vx: dir * (it.speed ?? 130) * s * (0.6 + this.rand() * 0.6),
                    vy: 0, drag: 1.2, t: 0, dur: Array.isArray(it.life) ? this.range(it.life) : (it.life ?? 0.9),
                    r: (it.size ?? 18) * s * (0.8 + this.rand() * 0.4), phase: this.rand() * Math.PI * 2,
                    color: it.color || '145, 120, 90', layer: it.layer || 'ground' });
            }
        } else if (it.type === 'mist') {
            it.dur = it.life ?? it.dur ?? 1;
        } else if (it.type === 'bolt') {
            it.seed = this.rand() * 10000;
        } else if (it.type === 'flame') {
            for (let i = 0; i < Math.min(it.count ?? 6, MAX_PARTS); i++) {
                const a = this._cone({ angle: 0, cone: 0.3, ...it });
                const v = (it.speed ?? 420) * s * (0.9 + this.rand() * 0.2);
                this.parts.push({ kind: 'flame', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    t: 0, dur: this.range(it.life || [0.5, 0.7]), drag: it.drag ?? 1.8, g: -(it.rise ?? 60) * s,
                    r: (it.size ?? 10) * s * (0.85 + this.rand() * 0.3), grow: it.grow ?? 4,
                    color: (it.color || '255, 125, 30').split(',').map(Number), smoke: it.smoke !== false, matte: it.matte,
                    phase: this.rand() * Math.PI * 2, layer: it.layer || 'front' });
            }
        } else if (it.type === 'embers') {
            for (let i = 0; i < Math.min(it.count ?? 3, MAX_PARTS); i++) {
                const a = this._cone({ angle: -Math.PI / 2, cone: 1.8, ...it });
                const v = (it.speed ?? 100) * s * (0.6 + this.rand() * 0.6);
                this.parts.push({ kind: 'ember', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    t: 0, dur: this.range(it.life || [0.4, 0.8]), drag: it.drag ?? 1.5, g: -(it.rise ?? 25) * s,
                    r: (it.size ?? 1.5) * s * (0.7 + this.rand() * 0.6), color: it.color || '255, 175, 65',
                    phase: this.rand() * Math.PI * 2, layer: it.layer || 'front' });
            }
        } else if (it.type === 'motes') {
            for (let i = 0; i < (it.count || 8); i++) {
                this.parts.push({ kind: 'mote', x: x + (this.rand() - 0.5) * 2 * (it.spread || 20) * s,
                    y: y - this.rand() * 10 * s, vx: (this.rand() - 0.5) * 20 * s, vy: -this.range(it.rise || [50, 110]) * s,
                    t: 0, dur: this.range(it.life || [0.5, 1]), color: it.color, r: (it.size || 2.5) * s, phase: this.rand() * 6 });
            }
        } else if (it.type === 'smoke') {
            for (let i = 0; i < (it.count || 5); i++) {
                this.parts.push({ kind: 'smoke', x: x + (this.rand() - 0.5) * 2 * (it.spread || 20) * s,
                    y: y - this.rand() * (it.spreadY || 10) * s, vx: (this.rand() - 0.5) * 30 * s + (it.speed || 0) * Math.cos(it.angle || 0) * s,
                    vy: -(it.rise || 25) * s * (0.5 + this.rand()) + (it.speed || 0) * Math.sin(it.angle || 0) * s, t: 0, dur: this.range(it.life || [0.7, 1.2]),
                    drag: 1.2, color: it.color, r: (it.size || 16) * s * (0.7 + this.rand() * 0.6),
                    layer: it.layer || 'front' });
            }
        } else if (it.type === 'debris') {
            for (let i = 0; i < (it.count || 8); i++) {
                const a = it.cone != null || it.angle != null ? this._cone({ angle: -Math.PI / 2, cone: 1.8, ...it })
                    : -Math.PI / 2 + (this.rand() - 0.5) * 1.8;
                const v = (it.speed || 240) * s * (0.5 + this.rand() * 0.7);
                this.parts.push({ kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0,
                    dur: 0.55 + this.rand() * 0.35, g: 950 * s, rot: this.rand() * 6, vr: (this.rand() - 0.5) * 16,
                    color: it.color, r: (it.size || 4) * s * (0.6 + this.rand() * 0.8) });
            }
        } else if (it.type === 'drops') {
            for (let i = 0; i < (it.count || 10); i++) {
                const a = this._cone({ angle: -Math.PI / 2, cone: 2.2, ...it });
                const v = (it.speed || 240) * s * (0.4 + this.rand() * 0.8);
                this.parts.push({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0,
                    dur: 0.45 + this.rand() * 0.35, g: 900 * s, color: it.color, r: (it.size || 3) * s * (0.6 + this.rand() * 0.7) });
            }
        } else if (it.type === 'jet' && it.to) {
            // 물줄기 옆으로 흩날리는 물방울
            const [tx, ty] = it.to;
            for (let i = 0; i < (it.spray ?? 8); i++) {
                const f = this.rand();
                const v = 120 * s * (0.5 + this.rand());
                const a = -Math.PI / 2 + (this.rand() - 0.5) * 2.4;
                this.parts.push({ kind: 'drop', x: x + (tx - x) * f, y: y + (ty - y) * f, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    t: 0, dur: 0.35 + this.rand() * 0.25, g: 900 * s, color: it.color, r: (1.5 + this.rand() * 1.8) * s });
            }
        } else if (it.type === 'chevrons') {
            // 위아래로 겹친 ▼ 표식이 천천히 가라앉음 (능력치 감소 느낌)
            for (let i = 0; i < (it.count || 2); i++) {
                this.parts.push({ kind: 'chevron', x: x + (this.rand() - 0.5) * 2 * (it.spread || 6) * s,
                    y: y - i * (it.size || 5) * 1.6 * s, vx: 0, vy: (it.fall || 30) * s, t: 0,
                    dur: this.range(it.life || [0.5, 0.75]), color: it.color, r: (it.size || 5) * s, s });
            }
        } else if (it.type === 'cracks') {
            // 균열 모양은 시작할 때 한 번 정함 (지그재그 선)
            it.lines = [];
            const n = it.count || 6;
            for (let i = 0; i < n; i++) {
                const a0 = (i / n) * Math.PI * 2 + (this.rand() - 0.5) * 0.5;
                const pts = [[0, 0]];
                let a = a0, r = 0;
                for (let k = 0; k < 4; k++) {
                    r += (0.2 + this.rand() * 0.15);
                    a += (this.rand() - 0.5) * 0.6;
                    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
                }
                it.lines.push(pts);
            }
        }
    }

    _updateProjectile(pr, dt) {
        pr.t += dt;
        if (pr.kind === 'wave') {
            const x0 = pr.x;
            const step = pr.speed * pr.scale * dt;
            pr.x += step * pr.dir;
            pr.dist += step;
            if (pr.onMove) pr.onMove(Math.min(x0, pr.x), Math.max(x0, pr.x));
            // 꼬리: 보라 연기 + 빛가루
            pr.trailAcc += dt;
            while (pr.trailAcc > 0.035) {
                pr.trailAcc -= 0.035;
                const s = pr.scale;
                this.parts.push({ kind: 'smoke', x: pr.x - pr.dir * 10 * s, y: pr.y + (this.rand() - 0.5) * pr.h * 0.6 * s,
                    vx: -pr.dir * 30 * s, vy: -10 * s, t: 0, dur: 0.5, drag: 2, color: pr.mist || '60, 15, 95', r: 14 * s, layer: 'front' });
                this.parts.push({ kind: 'mote', x: pr.x, y: pr.y + (this.rand() - 0.5) * pr.h * 0.7 * s,
                    vx: -pr.dir * 60 * s, vy: -30 * s, t: 0, dur: 0.4, color: pr.color, r: 2.2 * s, phase: 0 });
            }
            if (pr.dist >= pr.range * pr.scale) {
                pr.done = true;
                this.play({ layers: [
                    { type: 'flash', at: 0, dur: 0.15, r: 26, color: pr.color },
                    { type: 'smoke', at: 0, count: 5, spread: 12, spreadY: pr.h * 0.4, size: 16, life: [0.4, 0.7], color: pr.mist || '60, 15, 95' }
                ] }, pr.x, pr.y, { scale: pr.scale, owner: pr.owner });
                if (pr.onEnd) pr.onEnd();
            }
        } else if (pr.kind === 'orb') {
            const u = Math.min(1, pr.t / pr.dur);
            const [tx, ty] = pr.to();
            const [fx, fy] = pr.from;
            const apex = 60 * pr.scale;
            pr.x = fx + (tx - fx) * u;
            pr.y = fy + (ty - fy) * u - Math.sin(u * Math.PI) * apex;
            pr.trail.push([pr.x, pr.y]);
            if (pr.trail.length > 14) pr.trail.shift();
            if (u >= 1) {
                pr.done = true;
                if (pr.onArrive) pr.onArrive(tx, ty);
            }
        } else if (pr.kind === 'needle') {
            const u = Math.min(1, pr.t / pr.dur);
            const [tx, ty] = pr.to();
            const [fx, fy] = pr.from;
            pr.x = fx + (tx - fx) * u;
            pr.y = fy + (ty - fy) * u;
            pr.angle = Math.atan2(ty - fy, tx - fx);
            if (u >= 1) {
                pr.done = true;
                if (pr.onArrive) pr.onArrive(tx, ty);
            }
        } else if (pr.kind === 'chain') {
            const [fx, fy] = pr.from();
            pr.x = fx;
            pr.y = fy;
            if (pr.phase === 'out') {
                const u = Math.min(1, pr.t / pr.out);
                const [tx, ty] = pr.to();
                const e = 1 - (1 - u) * (1 - u);
                pr.hx = fx + (tx - fx) * e;
                pr.hy = fy + (ty - fy) * e - Math.sin(u * Math.PI) * 26 * pr.scale;
                pr.angle = Math.atan2(ty - fy, tx - fx);
                if (u >= 1) {
                    pr.phase = 'back';
                    pr.t = 0;
                    pr.bx = pr.hx;
                    pr.by = pr.hy;
                    if (pr.onHook) pr.onHook(pr.hx, pr.hy);
                }
            } else {
                const u = Math.min(1, pr.t / pr.back);
                pr.hx = pr.bx + (fx - pr.bx) * u;
                pr.hy = pr.by + (fy - pr.by) * u;
                if (u >= 1) {
                    pr.done = true;
                    if (pr.onDone) pr.onDone();
                }
            }
        } else if (pr.kind === 'missile') {
            const u = Math.min(1, pr.t / pr.dur);
            const [tx, ty] = pr.to();
            const [fx, fy] = pr.from;
            const s = pr.scale;
            const px = pr.x, py = pr.y;
            const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;   // 출발은 느리게, 끝은 빠르게
            pr.x = fx + (tx - fx) * e;
            pr.y = fy + (ty - fy) * e - Math.sin(u * Math.PI) * pr.apex * s;
            if (pr.x !== px || pr.y !== py) pr.angle = Math.atan2(pr.y - py, pr.x - px);
            pr.trailAcc += dt;
            while (pr.trailAcc > 0.018) {
                pr.trailAcc -= 0.018;
                const bx = pr.x - Math.cos(pr.angle) * 9 * s, by = pr.y - Math.sin(pr.angle) * 9 * s;
                this.parts.push({ kind: 'smoke', x: bx, y: by, vx: (this.rand() - 0.5) * 20 * s, vy: -12 * s, t: 0,
                    dur: 0.45 + this.rand() * 0.25, drag: 2, color: '120, 110, 120', r: 7 * s, layer: 'front' });
                this.parts.push({ kind: 'flame', x: bx, y: by, vx: -Math.cos(pr.angle) * 85 * s, vy: -Math.sin(pr.angle) * 85 * s,
                    t: 0, dur: 0.18, drag: 2, g: -20 * s, r: 4 * s, grow: 2.2,
                    color: pr.color.split(',').map(Number), smoke: false, phase: this.rand() * Math.PI * 2, layer: 'front' });
            }
            if (u >= 1) {
                pr.done = true;
                if (pr.onArrive) pr.onArrive(tx, ty);
            }
        }
    }

    // ------------------------------------------------------------------
    /** layer: 'ground'(캐릭터/적 아래) | 'front'(위) */
    draw(ctx, layer) {
        if (this.style !== 'pixel') return this._draw(ctx, layer);
        if (!this.pixelCanvas) this.pixelCanvas = document.createElement('canvas');
        const canvas = this.pixelCanvas, w = ctx.canvas.width, h = ctx.canvas.height;
        if (canvas.width !== Math.ceil(w / 3)) canvas.width = Math.ceil(w / 3);
        if (canvas.height !== Math.ceil(h / 3)) canvas.height = Math.ceil(h / 3);
        const low = canvas.getContext('2d'), m = ctx.getTransform();
        low.setTransform(1, 0, 0, 1, 0, 0);
        low.clearRect(0, 0, canvas.width, canvas.height);
        low.setTransform(m.a / 3, m.b / 3, m.c / 3, m.d / 3, m.e / 3, m.f / 3);
        this._draw(low, layer);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, canvas.width * 3, canvas.height * 3);
        ctx.restore();
    }

    _draw(ctx, layer) {
        ctx.save();
        for (const p of this.persistent.values()) {
            const [x, y] = p.follow();
            if (p.kind === 'field') {
                if (layer === 'ground') drawField(ctx, x, y, p, p.t);
                else drawGrips(ctx, p, p.t);
            } else if (layer === 'ground') {
                drawRune(ctx, x, y, p, p.t, p.open, p.pulse);
            }
        }
        for (const it of this.items) {
            if (!it.started) continue;
            const itLayer = it.layer || (it.ground || GROUND_TYPES.has(it.type) ? 'ground' : 'front');
            if (itLayer !== layer) continue;
            const u = Math.min(1, it.t / it.dur);
            const [x, y] = this._pos(it);
            if (DRAW[it.type]) DRAW[it.type](ctx, x, y, it, u, it.s, this.time);
        }
        this._drawParts(ctx, layer);
        if (layer === 'front') {
            for (const pr of this.projectiles) {
                if (pr.kind === 'wave') drawWave(ctx, pr);
                else if (pr.kind === 'orb') drawOrb(ctx, pr, this.time);
                else if (pr.kind === 'missile') drawMissile(ctx, pr, this.time);
                else if (pr.kind === 'chain') drawChain(ctx, pr, this.time);
                else if (pr.kind === 'needle') drawNeedle(ctx, pr);
            }
        }
        ctx.restore();
    }

    _drawParts(ctx, layer) {
        for (const p of this.parts) {
            if ((p.layer || 'front') !== layer) continue;
            const u = p.t / p.dur;
            if (p.kind === 'spark') {
                const a = 1 - u;
                const n = Math.hypot(p.vx, p.vy) || 1;
                const len = Math.min(22 * p.s, n * 0.05);
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = `rgba(${p.color}, ${a})`;
                ctx.lineWidth = 3 * p.s * a + 0.8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x - (p.vx / n) * len, p.y - (p.vy / n) * len);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            } else if (p.kind === 'streak') {
                const a = (1 - u) * tail(u, 0.65);
                const n = Math.hypot(p.vx, p.vy) || 1;
                const len = Math.min(p.len * (1 - u * 0.5), n * 0.09, p.t * n * 1.8);
                const tx = p.x - p.vx / n * len, ty = p.y - p.vy / n * len;
                ctx.save();
                const opacity = ctx.globalAlpha;
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'round';
                const g = ctx.createLinearGradient(tx, ty, p.x + 0.01, p.y);
                g.addColorStop(0, `rgba(${p.color}, 0)`);
                g.addColorStop(0.7, `rgba(${p.color}, ${0.8 * a})`);
                g.addColorStop(1, `rgba(${WHITE}, ${a})`);
                for (const [w, alpha] of [[5, 0.22], [1.8, 1]]) {
                    ctx.globalAlpha = opacity * alpha;
                    ctx.strokeStyle = g;
                    ctx.lineWidth = w * p.s * (0.5 + 0.5 * (1 - u));
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                }
                ctx.restore();
            } else if (p.kind === 'shard') {
                drawShard(ctx, p, u);
            } else if (p.kind === 'goo' || p.kind === 'splat') {
                drawGoo(ctx, p, u);
            } else if (p.kind === 'dust') {
                drawDust(ctx, p, u);
            } else if (p.kind === 'flame') {
                drawFlame(ctx, p, u);
            } else if (p.kind === 'ember') {
                const a = (1 - u) * (0.75 + 0.25 * Math.sin(p.t * 32 + p.phase));
                const r = p.r * (1 - u * 0.6);
                ctx.globalCompositeOperation = 'lighter';
                glow(ctx, p.x, p.y, r * 3, `rgba(220, 45, 10, ${0.5 * a})`);
                glow(ctx, p.x, p.y, r, `rgba(${u < 0.45 ? p.color : '210, 55, 15'}, ${a})`);
            } else if (p.kind === 'mote') {
                const a = Math.min(1, u / 0.15) * (1 - u);
                const x = p.x + Math.sin(this.time * 6 + p.phase) * 3 * p.r;
                ctx.globalCompositeOperation = 'lighter';
                glow(ctx, x, p.y, p.r * 3.2, `rgba(${p.color}, ${0.55 * a})`);
                glow(ctx, x, p.y, p.r, `rgba(${WHITE}, ${0.9 * a})`);
            } else if (p.kind === 'smoke') {
                const a = Math.min(1, u / 0.2) * (1 - u);
                ctx.globalCompositeOperation = 'source-over';
                glow(ctx, p.x, p.y, p.r * (1 + u * 1.3), `rgba(${p.color}, ${0.6 * a})`);
            } else if (p.kind === 'chevron') {
                const a = Math.min(1, u / 0.2) * (1 - u);
                const r = p.r;
                ctx.globalCompositeOperation = 'lighter';
                glow(ctx, p.x, p.y, r * 2.2, `rgba(${p.color}, ${0.35 * a})`);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (const [w, color, al] of [[3.2, p.color, 0.9], [1.1, WHITE, 0.9]]) {
                    ctx.strokeStyle = `rgba(${color}, ${al * a})`;
                    ctx.lineWidth = w * p.s;
                    ctx.beginPath();
                    ctx.moveTo(p.x - r, p.y - r * 0.55);
                    ctx.lineTo(p.x, p.y + r * 0.45);
                    ctx.lineTo(p.x + r, p.y - r * 0.55);
                    ctx.stroke();
                }
            } else if (p.kind === 'drop') {
                const a = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
                ctx.globalCompositeOperation = 'lighter';
                glow(ctx, p.x, p.y, p.r * 2.2, `rgba(${p.color}, ${0.5 * a})`);
                glow(ctx, p.x, p.y, p.r * 0.8, `rgba(${WHITE}, ${0.9 * a})`);
            } else if (p.kind === 'debris') {
                const a = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
                ctx.globalCompositeOperation = 'source-over';
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = `rgba(${p.color}, ${a})`;
                ctx.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4);
                ctx.restore();
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}

// ---- 그리기 ------------------------------------------------------------
function drawShard(ctx, p, u) {
    const a = tail(u, 0.65), ice = p.shape === 'ice', rock = p.shape === 'rock';
    const shine = rock ? 0.25 : Math.pow(Math.max(0, Math.cos(p.rot * 2)), 6);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(0.5 + Math.abs(Math.cos(p.rot)) * 0.5, 1);
    ctx.beginPath();
    p.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = `rgba(${p.color}, ${(ice ? 0.58 : 0.95) * a})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rock ? p.color : WHITE}, ${(rock ? 0.4 : 0.65 + shine * 0.35) * a})`;
    ctx.lineWidth = (rock ? 0.7 : 1.1) * p.s;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i < 3; i++) ctx.lineTo(...p.points[i]);
    ctx.closePath();
    ctx.fillStyle = `rgba(15, 25, 40, ${(ice ? 0.22 : 0.38) * a})`;
    ctx.fill();
    if (!rock) {
        ctx.beginPath();
        ctx.moveTo(...p.points[0]);
        ctx.lineTo(0, 0);
        ctx.lineTo(...p.points[2]);
        ctx.strokeStyle = `rgba(${WHITE}, ${(0.25 + shine * 0.7) * a})`;
        ctx.stroke();
    }
    ctx.restore();
}

function drawGoo(ctx, p, u) {
    const splat = p.kind === 'splat', a = tail(u, splat ? 0.3 : 0.75);
    const r = p.r, stretch = Math.min(1.9, 1 + Math.hypot(p.vx, p.vy) / (220 * p.s));   // 꼬리를 짧게: 길면 바닥에 선 가시처럼 보임
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(p.x, p.y);
    if (splat) ctx.scale(1.5 + easeOut(u) * 1.1, 0.32 + easeOut(u) * 0.12);
    else ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillStyle = `rgba(${p.color}, ${0.85 * a})`;
    ctx.beginPath();
    if (splat) {
        // 불규칙한 가장자리: 같은 원형 빛가루로 보이지 않게 한다.
        for (let i = 0; i <= 16; i++) {
            const ang = i / 16 * Math.PI * 2, rad = r * (1 + Math.sin(ang * 5 + p.r) * 0.14);
            const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
            if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
    } else {
        ctx.moveTo(-r * stretch * 1.25, 0);
        ctx.bezierCurveTo(-r * 0.6, -r * 0.3, -r * 0.3, -r, r * 0.45, -r * 0.75);
        ctx.bezierCurveTo(r * 1.4, -r * 0.4, r * 1.4, r * 0.65, r * 0.35, r * 0.8);
        ctx.quadraticCurveTo(-r * 0.4, r * 0.65, -r * stretch * 1.25, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(25, 45, 35, ${0.35 * a})`;
    ctx.lineWidth = 0.8 * p.s;
    ctx.stroke();
    ctx.fillStyle = `rgba(${WHITE}, ${(splat ? 0.4 : 0.75) * a})`;
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.35, r * 0.3, r * 0.14, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawDust(ctx, p, u) {
    const r = p.r * (0.65 + u * 1.6), a = Math.min(1, u / 0.08) * Math.pow(1 - u, 1.4);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(p.x, p.y - r * 0.45);
    ctx.scale(1, 0.6);
    glow(ctx, 0, 0, r * 1.5, `rgba(${p.color}, ${0.3 * a})`);
    for (let i = 0; i < 3; i++) {
        const angle = p.phase + p.t * (p.vx < 0 ? -5 : 5) + i * 2.1;
        const x = Math.cos(angle) * r * 0.4, y = Math.sin(angle) * r * 0.25;
        ctx.fillStyle = `rgba(${p.color}, ${(0.24 + i * 0.05) * a})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.6 + i * 0.08), r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(220, 205, 180, ${0.14 * a})`;
        ctx.lineWidth = r * 0.06;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.6 + i * 0.08), r * 0.65, 0, Math.PI * 1.12, Math.PI * 1.85);
        ctx.stroke();
    }
    ctx.restore();
}

function drawFlame(ctx, p, u) {
    const flick = Math.sin(p.t * 25 + p.phase);
    const r = p.r * (1 + (p.grow - 1) * u) * (1 + flick * 0.08);
    if (r <= 0.5) return;
    const x = p.x + Math.sin(p.t * 13 + p.phase) * p.r * u * 0.3;
    const y = p.y + flick * p.r * u * 0.2;
    const a = Math.min(1, u / 0.04) * tail(u, 0.65) * (0.88 + flick * 0.12);
    if (p.matte) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.scale(1.3, 0.7);
        const heat = ctx.createRadialGradient(-r * 0.2, 0, r * 0.1, 0, 0, r);
        heat.addColorStop(0, `rgba(${p.color.join(', ')}, ${a * 0.9})`);
        heat.addColorStop(0.5, `rgba(${p.color.map(c => Math.round(c * 0.75)).join(', ')}, ${a * 0.7})`);
        heat.addColorStop(0.85, `rgba(65, 60, 55, ${a * 0.35})`);
        heat.addColorStop(1, 'rgba(65, 60, 55, 0)');
        ctx.fillStyle = heat;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6, rr = r * (0.85 + 0.15 * Math.sin(angle * 3 + p.phase));
            const px = Math.cos(angle) * rr, py = Math.sin(angle) * rr;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }
    const mix = (from, to, t) => from.map((c, i) => Math.round(c + (to[i] - c) * t)).join(', ');
    const color = u < 0.4 ? mix([255, 245, 180], p.color, u / 0.4)
        : mix(p.color, [165, 25, 12], Math.min(1, (u - 0.4) / 0.4));
    const core = u < 0.4 ? mix([255, 252, 215], p.color, u / 0.4) : color;
    const smoke = p.smoke ? Math.max(0, (u - 0.65) / 0.35) : 0;
    // 불 중심은 밝게 겹치고, 식은 가장자리는 어두운 연기로 넘긴다.
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${core}, ${0.65 * a * (1 - smoke)})`);
    g.addColorStop(0.35, `rgba(${color}, ${0.5 * a * (1 - smoke)})`);
    g.addColorStop(0.7, `rgba(220, 45, 10, ${0.2 * a * (1 - smoke)})`);
    g.addColorStop(1, 'rgba(100, 20, 10, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (smoke > 0) {
        ctx.globalCompositeOperation = 'source-over';
        glow(ctx, x, y, r, `rgba(55, 43, 46, ${0.55 * smoke * a})`);
    }
}

function glow(ctx, x, y, r, color) {
    if (r <= 0.5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function ellipseGlow(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    glow(ctx, 0, 0, rx, color);
    ctx.restore();
}

const easeOut = u => 1 - (1 - u) * (1 - u);
// 발동 후 여운: fadeFrom 이후 선형으로 사라짐
const tail = (u, fadeFrom) => (u > fadeFrom ? 1 - (u - fadeFrom) / (1 - fadeFrom) : 1);

// 번개는 재점화 간격에만 꺾임을 다시 계산한다. 입자는 만들지 않고 선을 캐시한다.
function boltPaths(it, dx, dy, s, frame) {
    const noise = n => {
        const v = Math.sin(n * 127.1 + (it.seed || 0) + frame * 311.7) * 43758.5453;
        return v - Math.floor(v);
    };
    const paths = [];
    const count = Math.min(8, Math.max(0, it.count ?? 3));
    for (let k = 0; k < count; k++) {
        const angle = it.angle != null ? it.angle + (k - (count - 1) / 2) * 0.3 : k / count * Math.PI * 2 - Math.PI / 2;
        const len = (it.len ?? 80) * s;
        const ex = it.to ? dx : Math.cos(angle) * len, ey = it.to ? dy : Math.sin(angle) * len;
        const dist = Math.hypot(ex, ey) || 1, nx = -ey / dist, ny = ex / dist;
        const steps = Math.max(5, Math.min(18, Math.ceil(dist / (14 * s))));
        const jag = (it.jag ?? 14) * s;
        const pts = [[0, 0]];
        for (let i = 1; i < steps; i++) {
            const f = i / steps;
            const off = (noise(k * 31 + i) * 2 - 1) * jag * Math.sin(f * Math.PI);
            pts.push([ex * f + nx * off, ey * f + ny * off]);
        }
        pts.push([ex, ey]);
        paths.push({ pts, branch: false });
        for (let b = 0; b < Math.min(4, it.branches ?? 2); b++) {
            const i = 1 + Math.floor(noise(k * 43 + b + 70) * (steps - 2));
            const [bx, by] = pts[i];
            const a = Math.atan2(ey, ex) + (b % 2 ? -1 : 1) * (0.55 + noise(b + k * 7) * 0.7);
            const bl = dist * (0.18 + noise(b + k * 11 + 90) * 0.2);
            const branch = [[bx, by]];
            for (let j = 1; j <= 3; j++) {
                const off = j === 3 ? 0 : (noise(k * 19 + b * 3 + j + 120) - 0.5) * jag;
                branch.push([bx + Math.cos(a) * bl * j / 3 + nx * off, by + Math.sin(a) * bl * j / 3 + ny * off]);
            }
            paths.push({ pts: branch, branch: true });
        }
    }
    return paths;
}

// 양끝이 가늘고 가운데가 두꺼운 초승달 면. 뒤에 남는 잔상도 같은 윤곽을 쓴다.
function slashRibbon(ctx, r, arc, reveal, width, offset = 0) {
    const end = -arc / 2 + arc * reveal;
    ctx.beginPath();
    for (let side = 1; side >= -1; side -= 2) {
        for (let i = 0; i <= 28; i++) {
            const f = side > 0 ? i / 28 : 1 - i / 28;
            const a = -arc / 2 + (end + arc / 2) * f;
            const rr = r + offset + side * width * Math.pow(Math.sin(f * Math.PI), 0.7) / 2;
            const px = Math.cos(a) * rr - r * (1 + Math.cos(arc / 2)) / 2, py = Math.sin(a) * rr;
            if (side > 0 && i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();
}

// 새 단색 모양만 윤곽을 사용한다. 기존 모양의 발광·합성 방식은 그대로 둔다.
function solid(ctx, it, s, alpha) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = `rgb(${it.color})`;
    ctx.fill();
    if (it.outline) {
        ctx.strokeStyle = `rgb(${it.outline})`;
        ctx.lineWidth = (it.width ?? 3) * s;
        ctx.lineJoin = 'miter';
        ctx.stroke();
    }
}

function impactAlpha(it, u) {
    return it.t <= 0.05 ? 1 : Math.max(0, (1 - u) / (1 - Math.min(0.9, 0.05 / it.dur)));
}

// 그림 프레임 이펙트 (D-060): assets/sprites/vfx/<sheet>.webp = 정사각 프레임을 가로로 이어 붙인 띠, 알파 = 밝기
// WebP 품질 90 (D-062) — 무손실 원본 띠는 png/, Gemini 원본은 src/
// (tools/images/build_vfx_sheet.py가 Gemini 검은 배경 시트에서 만듦). 처음 쓸 때 불러오고, 다 불러오기 전에는 건너뜀
export const VFX_SHEETS = {
    slash_violet: { src: 'assets/sprites/vfx/slash_violet.webp', frames: 9 },       // 타락 히어로 베기
    punch_cyan: { src: 'assets/sprites/vfx/punch_cyan.webp', frames: 9 },           // 거대로봇 주먹 (전기)
    bite_green: { src: 'assets/sprites/vfx/bite_green.webp', frames: 9 },           // 거대괴수 물기 (산성)
    claw_fire: { src: 'assets/sprites/vfx/claw_fire.webp', frames: 9 },             // 합성괴인 할퀴기
    punch_fire: { src: 'assets/sprites/vfx/punch_fire.webp', frames: 9 },           // 합성괴인 주먹
    orbital_beam: { src: 'assets/sprites/vfx/orbital_beam.webp', frames: 9 },       // 궤도 폭격 (바닥 기준)
    roar_green: { src: 'assets/sprites/vfx/roar_green.webp', frames: 9 },           // 대지 포효 (왼쪽 기준, 오른쪽으로)
    judgment_violet: { src: 'assets/sprites/vfx/judgment_violet.webp', frames: 9 }, // 심판의 일격 (바닥 기준)
    breath_fire: { src: 'assets/sprites/vfx/breath_fire.webp', frames: 9 },         // 용의 숨결 (입 기준, 오른쪽으로)
    hands_teal: { src: 'assets/sprites/vfx/hands_teal.webp', frames: 9 },           // 길잡이 심연의 손 (바닥 기준)
    revive_crimson: { src: 'assets/sprites/vfx/revive_crimson.webp', frames: 9 },   // 봉합 성녀 억지 부활 (바닥 기준)
    ice_shatter: { src: 'assets/sprites/vfx/ice_shatter.webp', frames: 9 },         // 서리의 무희 얼음 깨짐 (바닥 기준)
    xcut_cyan: { src: 'assets/sprites/vfx/xcut_cyan.webp', frames: 9 },             // 인형사 가위 X자
    pillar_gold: { src: 'assets/sprites/vfx/pillar_gold.webp', frames: 9 },         // 천상의 심판·정의의 일격 (바닥 기준)
    tentacle_void: { src: 'assets/sprites/vfx/tentacle_void.webp', frames: 9 },     // 심연의 파동 촉수 (바닥 기준)
    hellgate_red: { src: 'assets/sprites/vfx/hellgate_red.webp', frames: 9 },       // 지옥문 (바닥 기준)
    explosion_big: { src: 'assets/sprites/vfx/explosion_big.webp', frames: 9 },     // 거점 대폭발 (바닥 기준, 연기는 보통 섞기)
    defeat_puff: { src: 'assets/sprites/vfx/defeat_puff.webp', frames: 9 },         // 적 처치 연기 (바닥 기준, 보통 섞기)
    // 2차 (나머지 스킬·적 기술) — 가운데에서 터지는 폭발류
    fire_burst: { src: 'assets/sprites/vfx/fire_burst.webp', frames: 9 },           // 불 폭발 (미사일·불 원소탄·자폭)
    lightning_burst: { src: 'assets/sprites/vfx/lightning_burst.webp', frames: 9 }, // 번개 폭발 (전기 충격·번개 원소탄)
    acid_burst: { src: 'assets/sprites/vfx/acid_burst.webp', frames: 9 },           // 산성 튀김 (산성 돌진·독액)
    ice_burst: { src: 'assets/sprites/vfx/ice_burst.webp', frames: 9 },             // 얼음 폭발 (서리 칼날·얼음 원소탄)
    dark_burst: { src: 'assets/sprites/vfx/dark_burst.webp', frames: 9 },           // 보라 암흑 폭발 (암흑 구체·드론 자폭)
    cleave_crimson: { src: 'assets/sprites/vfx/cleave_crimson.webp', frames: 9 },   // 진홍 초승달 베기 (악마기사 도끼)
    water_burst: { src: 'assets/sprites/vfx/water_burst.webp', frames: 9 },         // 물보라 (길잡이 물줄기·물살)
    needle_crimson: { src: 'assets/sprites/vfx/needle_crimson.webp', frames: 9 },   // 진홍 찌르기 섬광 (성녀 바늘·외눈 시선)
    golden_burst: { src: 'assets/sprites/vfx/golden_burst.webp', frames: 9 },       // 금빛 섬광 (속죄의 사슬·통제탑 화살)
    mutation_burst: { src: 'assets/sprites/vfx/mutation_burst.webp', frames: 9 },   // 보라 소용돌이 → 변이 폭발 (구역 4·세뇌 변환)
    ground_impact: { src: 'assets/sprites/vfx/ground_impact.webp', frames: 9 },     // 지면 강타 (바닥 기준, 먼지는 가장자리 옅게)
    spore_burst: { src: 'assets/sprites/vfx/spore_burst.webp', frames: 9 },         // 독 포자 주머니 터짐 (가운데 기준)
    power_aura: { src: 'assets/sprites/vfx/power_aura.webp', frames: 9 },           // 주황·금빛 기운 불꽃 (바닥 기준, 아드레날린·2페이즈)
    summon_portal: { src: 'assets/sprites/vfx/summon_portal.webp', frames: 9 },     // 주황·금빛 소환진 + 빛기둥 (원 가운데가 anchorY 0.76)
    // 2차 세트 대표 시트 (D-071) — 거대괴수
    primal_beam: { src: 'assets/sprites/vfx/primal_beam.webp', frames: 9 },         // 멸망의 숨결 초록 열선 (왼쪽 기준, 오른쪽으로)
    lava_burst: { src: 'assets/sprites/vfx/lava_burst.webp', frames: 9 },           // 화산 분화 용암탄 (바닥 기준)
    swamp_bubble: { src: 'assets/sprites/vfx/swamp_bubble.webp', frames: 9 },       // 늪 삼키기 진흙 거품 (바닥 기준)
    tidal_wave: { src: 'assets/sprites/vfx/tidal_wave.webp', frames: 9 },           // 해일 파도 (바닥 기준, 오른쪽으로 덮침)
    meteor_red: { src: 'assets/sprites/vfx/meteor_red.webp', frames: 9 },           // 대멸종 운석 충돌 (바닥 기준)
    breath_gold: { src: 'assets/sprites/vfx/breath_gold.webp', frames: 9 },         // 용왕의 숨결 금빛 불길 (입 기준, 오른쪽으로)
    // 2차 세트 대표 시트 (D-071) — 합성괴인
    roar_triple: { src: 'assets/sprites/vfx/roar_triple.webp', frames: 9 },         // 삼두 포효 주황·보라 음파 (왼쪽 기준, 오른쪽으로)
    web_purple: { src: 'assets/sprites/vfx/web_purple.webp', frames: 9 },           // 거미줄 덫 보라 거미줄 (바닥 기준)
    sonic_ring: { src: 'assets/sprites/vfx/sonic_ring.webp', frames: 9 },           // 초음파 하늘색 음파 고리 (왼쪽에서 오른쪽으로)
    blade_flurry: { src: 'assets/sprites/vfx/blade_flurry.webp', frames: 9 },       // 천 갈래 참격 보라·흰 칼날 (가운데 기준)
    shark_bite: { src: 'assets/sprites/vfx/shark_bite.webp', frames: 9 },           // 상어 물기 물빛 상어 머리 (가운데 기준)
    spirit_charge: { src: 'assets/sprites/vfx/spirit_charge.webp', frames: 9 },     // 만수 행진 금빛 사자 영혼 돌진 (왼쪽에서 오른쪽으로, hue로 다른 동물 색)
    // 2차 세트 대표 시트 (D-071) — 거대로봇
    thunder_storm: { src: 'assets/sprites/vfx/thunder_storm.webp', frames: 9 },     // 천둥 폭풍 먹구름 번개 (바닥 기준)
    wrecking_ball: { src: 'assets/sprites/vfx/wrecking_ball.webp', frames: 9 },     // 철거 철구 경고 줄무늬 쇠공 (왼쪽에서 오른쪽으로)
    plasma_white: { src: 'assets/sprites/vfx/plasma_white.webp', frames: 9 },       // 플라즈마 융단 청백 폭발 (바닥 기준)
    dome_gold: { src: 'assets/sprites/vfx/dome_gold.webp', frames: 9 },             // 방주 방벽 금빛 육각 돔 (바닥 기준, 9칸 모두 돔 — 이어 틀어도 끊기지 않게)
    apocalypse_beam: { src: 'assets/sprites/vfx/apocalypse_beam.webp', frames: 9 }, // 종말의 포 진홍 광선 (왼쪽 기준, 오른쪽으로)
    meteor_cyan: { src: 'assets/sprites/vfx/meteor_cyan.webp', frames: 9 },         // 유성우 청록 별 운석 (바닥 기준)
    // 2차 세트 대표 시트 (D-071) — 타락 히어로
    eclipse_sun: { src: 'assets/sprites/vfx/eclipse_sun.webp', frames: 9 },         // 일식 검은 해 + 보라 코로나 (가운데 기준)
    ghost_cavalry: { src: 'assets/sprites/vfx/ghost_cavalry.webp', frames: 9 },     // 기사단 돌격 흰·금 유령 기사 (왼쪽에서 오른쪽으로)
    time_stop: { src: 'assets/sprites/vfx/time_stop.webp', frames: 9 },             // 시간 정지 시계 마법진 (가운데 기준)
    shadow_rise: { src: 'assets/sprites/vfx/shadow_rise.webp', frames: 9 },         // 그림자 병사 솟아오름 (바닥 기준)
    demon_king: { src: 'assets/sprites/vfx/demon_king.webp', frames: 9 },           // 마왕 강림 진홍 오라 (바닥 기준)
    star_judgment: { src: 'assets/sprites/vfx/star_judgment.webp', frames: 9 },     // 별자리 심판 별빛 기둥 (바닥 기준)
    // 2차 세트 대표 시트 (D-071) — 서리의 무희
    aurora_ribbon: { src: 'assets/sprites/vfx/aurora_ribbon.webp', frames: 9 },     // 오로라 장막 빛띠 (9칸 모두 빛띠 — 이어 틀어도 끊기지 않게)
    frost_wolf: { src: 'assets/sprites/vfx/frost_wolf.webp', frames: 9 },           // 얼음 늑대 물기 (가운데 기준)
    glacier_giant: { src: 'assets/sprites/vfx/glacier_giant.webp', frames: 9 },     // 빙하 거인 등장 (바닥 기준)
    feather_black: { src: 'assets/sprites/vfx/feather_black.webp', frames: 9 },     // 흑조 깃털 (가운데 기준)
    eternal_winter: { src: 'assets/sprites/vfx/eternal_winter.webp', frames: 9 },   // 영겁의 겨울 냉기 파도 (가운데 기준)
    moon_fall: { src: 'assets/sprites/vfx/moon_fall.webp', frames: 9 },             // 월식 낙하 달 (바닥 기준)
    // 2차 세트 대표 시트 (D-071) — 심연의 길잡이
    ghost_ship: { src: 'assets/sprites/vfx/ghost_ship.webp', frames: 9 },           // 유령선 돌격 (왼쪽에서 오른쪽으로)
    coral_pink: { src: 'assets/sprites/vfx/coral_pink.webp', frames: 9 },           // 산호초 성벽 (바닥 기준)
    jelly_glow: { src: 'assets/sprites/vfx/jelly_glow.webp', frames: 9 },           // 해파리 떼 감전 (가운데 기준)
    steam_vent: { src: 'assets/sprites/vfx/steam_vent.webp', frames: 9 },           // 열수 분출 증기 기둥 (바닥 기준)
    trident_gold: { src: 'assets/sprites/vfx/trident_gold.webp', frames: 9 },       // 해신의 삼지창 (바닥 기준)
    leviathan: { src: 'assets/sprites/vfx/leviathan.webp', frames: 9 },             // 리바이어던 강림 (왼쪽에서 오른쪽으로)
    star_current: { src: 'assets/sprites/vfx/star_current.webp', frames: 9 },       // 은하 해류 (왼쪽에서 오른쪽으로)
    // 2차 세트 대표 시트 (D-071) — 봉합 성녀
    heal_rain: { src: 'assets/sprites/vfx/heal_rain.webp', frames: 9 },             // 치유의 비 (칸 전체, 9칸 모두 비 — 이어 틀어도 끊기지 않게)
    stone_grey: { src: 'assets/sprites/vfx/stone_grey.webp', frames: 9 },           // 석화의 눈물 (바닥 기준)
    butterfly_red: { src: 'assets/sprites/vfx/butterfly_red.webp', frames: 9 },     // 나비 떼의 춤 (가운데 기준)
    machine_needle: { src: 'assets/sprites/vfx/machine_needle.webp', frames: 9 },   // 기계 재봉 (바닥 기준)
    fate_thread: { src: 'assets/sprites/vfx/fate_thread.webp', frames: 9 },         // 운명 재봉 (가운데 기준)
    rose_petal: { src: 'assets/sprites/vfx/rose_petal.webp', frames: 9 },           // 장미 정원 (바닥 기준)
    // 2차 세트 대표 시트 (D-071) — 뒤틀린 인형사
    music_box: { src: 'assets/sprites/vfx/music_box.webp', frames: 9 },             // 자장가 오르골 (가운데 기준)
    paper_crane: { src: 'assets/sprites/vfx/paper_crane.webp', frames: 9 },         // 종이학 (왼쪽에서 오른쪽으로)
    shadow_play: { src: 'assets/sprites/vfx/shadow_play.webp', frames: 9 },         // 그림자 연극 (가운데 기준)
    teacup_burst: { src: 'assets/sprites/vfx/teacup_burst.webp', frames: 9 },       // 티 파티 찻잔 (바닥 기준)
    throne_thread: { src: 'assets/sprites/vfx/throne_thread.webp', frames: 9 },     // 실의 왕좌 (바닥 기준, 9칸 모두 왕좌 — 이어 틀어도 끊기지 않게)
    clock_gear: { src: 'assets/sprites/vfx/clock_gear.webp', frames: 9 },           // 자정의 종 시계 (가운데 기준)
    // 새 캐릭터 5·6 (D-079) — 철거의 설계자 · 침묵의 방송자 대표 시트 24장 (Gemini, 프롬프트 tools/images/pending_vfx_sheets_newchars2.json)
    drill_burst: { src: 'assets/sprites/vfx/drill_burst.webp', frames: 9 },   // 설계자 드릴 불티·기초 파쇄 (바닥 기준)
    steel_scaffold: { src: 'assets/sprites/vfx/steel_scaffold.webp', frames: 9 },   // 설계자 강제 재건 — 철골이 솟음 (바닥 기준)
    crane_ball: { src: 'assets/sprites/vfx/crane_ball.webp', frames: 9 },   // 설계자 철거 명령 — 크레인 철구 (바닥 기준)
    sonic_pink: { src: 'assets/sprites/vfx/sonic_pink.webp', frames: 9 },   // 방송자 공명 음파·공명 파열 고리 (가운데 기준)
    silence_dome: { src: 'assets/sprites/vfx/silence_dome.webp', frames: 9 },   // 방송자 정적의 장막 펼쳐짐 (바닥 기준)
    emergency_broadcast: { src: 'assets/sprites/vfx/emergency_broadcast.webp', frames: 9 },   // 방송자 긴급 방송 — 스피커 폭발 (가운데 기준)
    safety_siren: { src: 'assets/sprites/vfx/safety_siren.webp', frames: 9 },   // 설계자 레어① 현장 반장 안전 점검 경광등
    dynamite_blast: { src: 'assets/sprites/vfx/dynamite_blast.webp', frames: 9 },   // 설계자 레어② 폭파 기술자 다이너마이트
    steel_beam: { src: 'assets/sprites/vfx/steel_beam.webp', frames: 9 },   // 설계자 레어③·유니크② 철골 낙하 (바닥 기준)
    blueprint_grid: { src: 'assets/sprites/vfx/blueprint_grid.webp', frames: 9 },   // 설계자 레어④ 측량 설계사 설계도 격자
    bulldozer_dust: { src: 'assets/sprites/vfx/bulldozer_dust.webp', frames: 9 },   // 설계자 유니크① 불도저 흙먼지 (바닥 기준)
    counterweight: { src: 'assets/sprites/vfx/counterweight.webp', frames: 9 },   // 설계자 유니크② 평형추 낙하 (바닥 기준)
    crusher_claw: { src: 'assets/sprites/vfx/crusher_claw.webp', frames: 9 },   // 설계자 유니크③ 유압 집게 쥐기
    scaffold_rise: { src: 'assets/sprites/vfx/scaffold_rise.webp', frames: 9 },   // 설계자 레전더리① 황금 비계 성벽 (바닥 기준)
    mega_drill: { src: 'assets/sprites/vfx/mega_drill.webp', frames: 9 },   // 설계자 레전더리② 거대 굴착 드릴 (바닥 기준)
    encore_notes: { src: 'assets/sprites/vfx/encore_notes.webp', frames: 9 },   // 방송자 레어① 버스커 음표
    bass_drop: { src: 'assets/sprites/vfx/bass_drop.webp', frames: 9 },   // 방송자 레어② DJ 베이스 폭발
    radio_jam: { src: 'assets/sprites/vfx/radio_jam.webp', frames: 9 },   // 방송자 레어③ 전파 교란 잡음
    megaphone_shout: { src: 'assets/sprites/vfx/megaphone_shout.webp', frames: 9 },   // 방송자 레어④ 확성기 함성 (왼쪽 기준)
    ghost_radio: { src: 'assets/sprites/vfx/ghost_radio.webp', frames: 9 },   // 방송자 유니크① 유령 주파수
    subwoofer_blast: { src: 'assets/sprites/vfx/subwoofer_blast.webp', frames: 9 },   // 방송자 유니크② 초저음 충격파 (바닥 기준)
    glitch_hack: { src: 'assets/sprites/vfx/glitch_hack.webp', frames: 9 },   // 방송자 유니크③ 글리치 해킹
    live_broadcast: { src: 'assets/sprites/vfx/live_broadcast.webp', frames: 9 },   // 방송자 레전더리① 진실의 방송 조명
    absolute_silence: { src: 'assets/sprites/vfx/absolute_silence.webp', frames: 9 }   // 방송자 레전더리② 절대 정적
};
const sheetImages = new Map();
/** 그림 시트 (처음 부르면 받기 + 압축 풀기 시작). 압축이 다 풀린 뒤에만 돌려줌 — 캔버스에 그리는 순간 억지로 풀면
 *  한 프레임이 50~100ms 멈춤 (성능 측정 2026-10-21). 덜 풀린 그림은 그 이펙트의 그림 층만 잠깐 빠짐 */
function sheetImage(name) {
    const sheet = VFX_SHEETS[name];
    if (!sheet || typeof Image === 'undefined') return null;
    let img = sheetImages.get(name);
    if (!img) {
        img = new Image();
        img.src = sheet.src;
        sheetImages.set(name, img);
        const done = () => { img.ready = true; };
        if (img.decode) img.decode().then(done, done);
        else img.onload = done;
    }
    return img.ready && img.naturalWidth ? img : null;
}
/** 색을 돌린 시트 (파츠 확장 2차, D-071 — 같은 그림을 다른 색 스킬에 다시 씀): 처음 한 번만 캔버스에 돌려 그려 둠 (그릴 때마다 filter는 느림) */
const hueSheets = new Map();
function hueSheet(name, hue) {
    const key = `${name}|${hue}`;
    if (hueSheets.has(key)) return hueSheets.get(key);
    const img = sheetImage(name);
    if (!img || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.filter = `hue-rotate(${hue}deg)`;
    g.drawImage(img, 0, 0);
    c.naturalWidth = c.width;
    c.naturalHeight = c.height;
    hueSheets.set(key, c);
    return c;
}
/** 시트를 미리 불러 둠 (첫 재생에 그림이 늦게 뜨지 않게) */
export function preloadVfxSheets() {
    Object.keys(VFX_SHEETS).forEach(sheetImage);
}

const DRAW = {
    // 그림 프레임 재생 {sheet, size(px), anchorX?·anchorY?(프레임 안 기준점 0~1, 기본 0.5 — 바닥 기준 그림은 anchorY 0.9,
    //   입에서 뿜는 그림은 anchorX 0.03), angle?, flipX?, squash?, blend?('lighter' 기본 | 'normal'), alpha?, glow?(뒤에 퍼지는 빛 배수)}
    sprite(ctx, x, y, it, u, s) {
        const img = it.hue ? hueSheet(it.sheet, it.hue) : sheetImage(it.sheet);   // hue: 색 돌리기 (도)
        if (!img) return;
        const n = VFX_SHEETS[it.sheet].frames, fw = img.naturalWidth / n, fh = img.naturalHeight;
        const f = Math.min(n - 1, Math.floor(u * n));
        const size = (it.size ?? 160) * s;
        ctx.save();
        ctx.globalCompositeOperation = it.blend === 'normal' ? 'source-over' : 'lighter';
        ctx.globalAlpha = it.alpha ?? 1;
        ctx.translate(x, y);
        ctx.rotate(it.angle || 0);
        ctx.scale(it.flipX ? -1 : 1, it.squash ?? 1);
        const ax = it.anchorX ?? 0.5, ay = it.anchorY ?? 0.5;
        if (it.glow) {                                   // 뒤로 번지는 빛: 같은 프레임을 크게·옅게 한 번 더
            ctx.globalAlpha = (it.alpha ?? 1) * 0.35;
            const g = size * it.glow;
            ctx.drawImage(img, f * fw, 0, fw, fh, -g * ax, -g * ay, g, g);
            ctx.globalAlpha = it.alpha ?? 1;
        }
        ctx.drawImage(img, f * fw, 0, fw, fh, -size * ax, -size * ay, size, size);
        ctx.restore();
    },
    starburst(ctx, x, y, it, u, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(it.angle || 0);
        ctx.scale(1, it.ground ? 0.3 : (it.stretch ?? 1));
        const n = it.points ?? 7, r = it.r * s * (1 - u * 0.3);
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) {
            const a = i * Math.PI / n, rr = r * (i % 2 ? it.inner ?? 0.34 : 1);
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        solid(ctx, it, s, impactAlpha(it, u));
        ctx.restore();
    },
    speedlines(ctx, x, y, it, u, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        const n = it.count ?? 8;
        for (let i = 0; i < n; i++) {
            const a = it.angle == null ? i * Math.PI * 2 / n : it.angle + ((i + 0.5) / n - 0.5) * (it.cone ?? 1);
            const start = (15 + u * 60) * s, end = start + it.len * s * (1 - u * 0.6);
            const w = (it.width ?? 3) * s;
            ctx.moveTo(Math.cos(a) * start, Math.sin(a) * start);
            ctx.lineTo(Math.cos(a) * end - Math.sin(a) * w, Math.sin(a) * end + Math.cos(a) * w);
            ctx.lineTo(Math.cos(a) * end + Math.sin(a) * w, Math.sin(a) * end - Math.cos(a) * w);
            ctx.closePath();
        }
        solid(ctx, it, s, impactAlpha(it, u));
        ctx.restore();
    },
    ribbon(ctx, x, y, it, u, s) {
        ctx.save();
        ctx.translate(x, y);
        const len = it.to ? Math.hypot(it.to[0] - x, it.to[1] - y) : it.len * s;
        ctx.rotate(it.to ? Math.atan2(it.to[1] - y, it.to[0] - x) : it.angle || 0);
        const w = it.w * s * (1 - u * 0.35);
        ctx.beginPath();
        ctx.moveTo(0, -w * 0.25);
        for (let i = 1; i <= 8; i++) ctx.lineTo(len * i / 8, -w * (0.25 + i / 16) - (i % 2 ? (it.jag || 0) * s : 0));
        ctx.lineTo(len * 1.04, 0);
        for (let i = 8; i >= 1; i--) ctx.lineTo(len * i / 8, w * (0.25 + i / 16) + (i % 2 ? (it.jag || 0) * s : 0));
        ctx.lineTo(0, w * 0.25);
        ctx.closePath();
        solid(ctx, it, s, impactAlpha(it, u));
        ctx.restore();
    },
    tendrils(ctx, x, y, it, u, s) {
        ctx.save();
        const grow = Math.min(1, it.t / (it.angular ? 0.03 : 0.18)) * tail(u, 0.6);
        const n = it.count ?? 3;
        for (let i = 0; i < n; i++) {
            const dx = (i - (n - 1) / 2) * it.spread * s, h = it.h * s * grow * (i % 2 ? 1 : 0.8);
            const w = it.w * s, lean = Math.sin(i * 2 + it.t * 2) * h * 0.25;
            ctx.beginPath();
            ctx.moveTo(x + dx - w / 2, y);
            if (it.angular) ctx.lineTo(x + dx - w, y - h * 0.6);
            else ctx.quadraticCurveTo(x + dx - w + lean, y - h * 0.55, x + dx + lean, y - h);
            ctx.lineTo(x + dx + lean, y - h);
            if (it.angular) ctx.lineTo(x + dx + w / 2, y - h * 0.55);
            else ctx.quadraticCurveTo(x + dx + w / 2 + lean, y - h * 0.5, x + dx + w / 2, y);
            ctx.lineTo(x + dx + w / 2, y);
            ctx.closePath();
            ctx.save();
            solid(ctx, it, s, it.angular ? impactAlpha(it, u) : tail(u, 0.8));
            ctx.restore();
        }
        ctx.restore();
    },
    mist(ctx, x, y, it, u, s) {
        const r = (it.r ?? 60) * s, h = (it.h ?? 14) * s;
        const a = Math.min(1, u / 0.08) * tail(u, 0.75);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 3; i++) {
            const phase = i * 2.1 + it.t * 0.8;
            const dx = Math.sin(phase) * r * 0.14 + Math.sin(it.t * 0.5) * (it.drift ?? 12) * s * 2;
            ellipseGlow(ctx, x + dx, y - h * (0.3 + i * 0.24), r * (0.8 + i * 0.08), h * (0.55 + i * 0.15), `rgba(${it.color}, ${0.2 * a})`);
        }
        if (it.rim) {
            ctx.strokeStyle = `rgba(${it.color}, ${0.9 * tail(u, 0.94)})`;
            ctx.lineWidth = 2.5 * s;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    },
    flash(ctx, x, y, it, u, s) {
        ctx.globalCompositeOperation = 'lighter';
        const r = it.r * s * (0.6 + 0.4 * (1 - u));
        glow(ctx, x, y, r * 1.6, `rgba(${it.color}, ${0.7 * (1 - u)})`);
        glow(ctx, x, y, r * 0.7, `rgba(${WHITE}, ${1 - u})`);
    },
    fireball(ctx, x, y, it, u, s) {
        const r = it.r * s * (0.45 + 0.55 * easeOut(Math.min(1, u / 0.35)));
        const a = tail(u, 0.25);
        const core = Math.max(0, 1 - u / 0.45);
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, r * 1.35, `rgba(${it.color}, ${0.55 * a})`);
        glow(ctx, x, y - r * 0.1 * u, r, `rgba(255, 210, 90, ${0.75 * a})`);
        glow(ctx, x, y - r * 0.15 * u, r * 0.55, `rgba(${WHITE}, ${0.95 * core})`);
    },
    ring(ctx, x, y, it, u, s) {
        ctx.globalCompositeOperation = 'lighter';
        const r = it.r * s * (it.inward ? 1 - 0.85 * easeOut(u) : easeOut(u));
        ctx.strokeStyle = `rgba(${it.color}, ${1 - u})`;
        ctx.lineWidth = (it.width || 5) * s * (1 - u) + 1;
        ctx.beginPath();
        if (it.ground) ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
        else ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    },
    bolt(ctx, x, y, it, u, s) {
        const frame = Math.floor(it.t / Math.max(0.016, it.flicker ?? 0.055));
        const dx = it.to ? it.to[0] - x : 0, dy = it.to ? it.to[1] - y : 0;
        if (!it.bolts || frame !== it.boltFrame || dx !== it.boltDx || dy !== it.boltDy) {
            it.bolts = boltPaths(it, dx, dy, s, frame);
            it.boltFrame = frame;
            it.boltDx = dx;
            it.boltDy = dy;
        }
        const a = tail(u, 0.35) * (frame % 3 === 1 ? 0.55 : 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [mul, color, alpha] of [[4.5, it.color, 0.14], [1.8, it.color, 0.6], [0.55, WHITE, 1]]) {
            ctx.strokeStyle = `rgba(${color}, ${alpha * a})`;
            for (const { pts, branch } of it.bolts) {
                ctx.lineWidth = (it.width ?? 2.5) * s * mul * (branch ? 0.5 : 1);
                ctx.beginPath();
                pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
                ctx.stroke();
            }
        }
        ctx.restore();
    },
    slash(ctx, x, y, it, u, s) {
        const reveal = easeOut(Math.min(1, it.t / Math.max(0.01, it.sweep ?? 0.12)));
        const a = tail(u, 0.28);
        const r = (it.r ?? 65) * s;
        const arc = Math.min(Math.PI * 1.9, Math.abs(it.arc ?? 2.5));
        const w = (it.width ?? 18) * (it.thick ?? 1) * s;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((it.angle ?? 0.8) - Math.PI / 2);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 2; i >= 1; i--) {
            ctx.save();
            ctx.rotate(-i * 0.1);
            ctx.fillStyle = `rgba(${it.color}, ${0.1 * a / i})`;
            slashRibbon(ctx, r, arc, reveal, w * (1 + i * 0.3), -i * w * 0.4);
            ctx.restore();
        }
        ctx.fillStyle = `rgba(${it.color}, ${0.15 * a})`;
        slashRibbon(ctx, r, arc, reveal, w * 1.8);
        ctx.fillStyle = `rgba(${it.color}, ${0.85 * a})`;
        slashRibbon(ctx, r, arc, reveal, w);
        ctx.fillStyle = `rgba(${WHITE}, ${0.95 * a})`;
        slashRibbon(ctx, r, arc, reveal, w * 0.22, w * 0.22);
        ctx.restore();
    },
    shockwave(ctx, x, y, it, u, s) {
        const r = (it.r ?? 100) * s * (0.06 + 0.94 * easeOut(u));
        const w = Math.min(r * 0.8, (it.width ?? 28) * s * (1 - u * 0.35));
        const a = tail(u, 0.12);
        ctx.save();
        ctx.translate(x, y);
        if (it.ground) ctx.scale(1, 0.28);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, Math.max(0, r - w), 0, 0, r);
        g.addColorStop(0, `rgba(${it.color}, 0)`);
        g.addColorStop(0.12, `rgba(${WHITE}, ${0.95 * a})`);
        g.addColorStop(0.28, `rgba(${it.color}, ${0.8 * a})`);
        g.addColorStop(0.65, `rgba(${it.color}, ${0.25 * a})`);
        g.addColorStop(1, `rgba(${it.color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },
    rays(ctx, x, y, it, u, s) {
        const n = Math.min(24, Math.max(0, it.count ?? 10));
        const reach = easeOut(Math.min(1, u / 0.16));
        const a = tail(u, 0.2);
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < n; i++) {
            const angle = i / n * Math.PI * 2 + it.t * (it.spin ?? 0.6);
            const len = (it.len ?? 100) * s * reach * (0.72 + 0.15 * Math.sin(i * 7.3) + 0.13 * Math.sin(it.t * 18 + i * 2));
            const w = (it.width ?? 8) * s * (0.7 + 0.3 * Math.sin(i * 4.7 + 1));
            ctx.save();
            ctx.rotate(angle);
            const g = ctx.createLinearGradient(0, 0, len + 0.01, 0);
            g.addColorStop(0, `rgba(${WHITE}, ${0.8 * a})`);
            g.addColorStop(0.2, `rgba(${it.color}, ${0.65 * a})`);
            g.addColorStop(1, `rgba(${it.color}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(len * 0.2, -w);
            ctx.lineTo(len, 0);
            ctx.lineTo(len * 0.2, w);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        glow(ctx, 0, 0, (it.len ?? 100) * s * 0.22, `rgba(${it.color}, ${0.5 * a})`);
        ctx.restore();
    },
    glow(ctx, x, y, it, u, s) {
        ctx.globalCompositeOperation = 'lighter';
        const a = Math.min(1, u / 0.1) * (1 - u);
        ellipseGlow(ctx, x, y, it.r * s, it.r * s * 0.3, `rgba(${it.color}, ${0.7 * a})`);
    },
    pillar(ctx, x, y, it, u, s) {
        // 0~25%: 빠르게 솟음, 이후 가늘어지며 사라짐
        const grow = easeOut(Math.min(1, u / 0.25));
        const a = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
        const h = it.h * s * grow;
        const w = it.w * s * (1 - u * 0.55);
        ctx.globalCompositeOperation = 'lighter';
        ellipseGlow(ctx, x, y, w * 1.8, w * 0.5, `rgba(${it.color}, ${0.8 * a})`);
        const outer = ctx.createLinearGradient(0, y, 0, y - h);
        outer.addColorStop(0, `rgba(${it.color}, ${0.75 * a})`);
        outer.addColorStop(0.7, `rgba(${it.color}, ${0.35 * a})`);
        outer.addColorStop(1, `rgba(${it.color}, 0)`);
        ctx.fillStyle = outer;
        roundTop(ctx, x - w / 2, y - h, w, h);
        const core = ctx.createLinearGradient(0, y, 0, y - h);
        core.addColorStop(0, `rgba(${WHITE}, ${0.95 * a})`);
        core.addColorStop(1, `rgba(${WHITE}, 0)`);
        ctx.fillStyle = core;
        roundTop(ctx, x - w * 0.18, y - h * 0.92, w * 0.36, h * 0.92);
    },
    swirl(ctx, x, y, it, u, s, time) {
        ctx.globalCompositeOperation = 'lighter';
        const a = Math.min(1, u / 0.15) * (1 - u);
        const R = it.r * s * (1 - u * 0.6);
        const arms = it.arms || 3;
        ctx.lineCap = 'round';
        for (let k = 0; k < arms; k++) {
            ctx.strokeStyle = `rgba(${it.color}, ${0.85 * a})`;
            ctx.lineWidth = 3 * s;
            ctx.beginPath();
            for (let i = 0; i <= 24; i++) {
                const f = i / 24;
                const ang = (k / arms) * Math.PI * 2 + f * 3.2 + time * (it.spin || 9);
                const rr = R * (1 - f * 0.85);
                const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.75;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        glow(ctx, x, y, R * 0.5, `rgba(${WHITE}, ${0.6 * a})`);
    },
    rune(ctx, x, y, it, u, s, time) {
        const open = easeOut(Math.min(1, u / 0.2));
        const fade = tail(u, 0.7);
        drawRune(ctx, x, y, { r: it.r, s, color: it.color, spin: it.spin }, time, open * fade, 0.6 * fade);
    },
    beam(ctx, x, y, it, u, s, time) {
        if (!it.to) return;
        const [tx, ty] = it.to;
        const grow = Math.min(1, u / 0.12);
        const fade = tail(u, 0.55);
        const w = it.w * s * grow * (0.55 + 0.45 * fade) * (0.92 + 0.08 * Math.sin(it.t * 42));
        const len = Math.hypot(tx - x, ty - y);
        if (len < 0.01 || w <= 0) return;
        const detail = Math.min(1, it.w / 7);   // 가는 실·예고선은 가장자리 흔들림도 작게
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(ty - y, tx - x));
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, -w * 2.6, 0, w * 2.6);
        g.addColorStop(0, `rgba(${it.color}, 0)`);
        g.addColorStop(0.3, `rgba(${it.color}, ${0.18 * fade})`);
        g.addColorStop(0.5, `rgba(${it.color}, ${0.7 * fade})`);
        g.addColorStop(0.7, `rgba(${it.color}, ${0.18 * fade})`);
        g.addColorStop(1, `rgba(${it.color}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, -w * 2.6, len, w * 5.2);
        for (const [mul, color, alpha] of [[1, it.color, 0.75], [0.3, WHITE, 0.98]]) {
            ctx.fillStyle = `rgba(${color}, ${alpha * fade})`;
            ctx.beginPath();
            for (let side = 1; side >= -1; side -= 2) {
                for (let i = 0; i <= 24; i++) {
                    const f = side > 0 ? i / 24 : 1 - i / 24;
                    const wob = Math.sin(f * 26 - time * 45 + side) * w * 0.1 * detail * Math.sin(f * Math.PI);
                    const py = side * (w * mul / 2 + wob);
                    if (side > 0 && i === 0) ctx.moveTo(0, py);
                    else ctx.lineTo(len * f, py);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
        glow(ctx, 0, 0, w * 2.8, `rgba(${it.color}, ${0.65 * fade})`);
        glow(ctx, len, 0, w * 3.5, `rgba(${it.color}, ${0.7 * fade})`);
        glow(ctx, len, 0, w * 0.8, `rgba(${WHITE}, ${0.9 * fade})`);
        ctx.restore();
    },
    jet(ctx, x, y, it, u, s, time) {
        // 물줄기: 0~15% 뻗어 나감, 굵기가 출렁이고 줄기가 살짝 물결침. 끝에 물보라
        if (!it.to) return;
        const [tx, ty] = it.to;
        const reach = easeOut(Math.min(1, u / 0.15));
        const fade = tail(u, 0.5);
        const ex = x + (tx - x) * reach, ey = y + (ty - y) * reach;
        const len = Math.hypot(ex - x, ey - y) || 1;
        const nx = -(ey - y) / len, ny = (ex - x) / len;
        const w = it.w * s * (0.6 + 0.4 * fade);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [mul, color, alpha, amp] of [[2.4, it.color, 0.25, 1], [1, it.color, 0.75, 0.6], [0.32, WHITE, 0.9, 0.3]]) {
            ctx.strokeStyle = `rgba(${color}, ${alpha * fade})`;
            ctx.lineWidth = Math.max(0.5, w * mul);
            ctx.beginPath();
            for (let i = 0; i <= 12; i++) {
                const f = i / 12;
                const wob = Math.sin(f * 9 - time * 40) * w * 0.35 * amp * f;
                const px = x + (ex - x) * f + nx * wob, py = y + (ey - y) * f + ny * wob;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        glow(ctx, x, y, w * 2, `rgba(${it.color}, ${0.6 * fade})`);
        glow(ctx, ex, ey, w * 3.2 * (0.8 + 0.2 * Math.sin(time * 50)), `rgba(${it.color}, ${0.65 * fade})`);
        glow(ctx, ex, ey, w * 1.2, `rgba(${WHITE}, ${0.8 * fade})`);
    },
    hands(ctx, x, y, it, u, s, time) {
        // 유령 손: 0~25% 바닥에서 솟아 손가락을 벌림 → 25~45% 움켜쥠 → 쥔 채 흔들리다 가라앉음
        const n = it.count || 3;
        const spread = (it.spread || 22) * s;
        const H = (it.h || 46) * s;
        const rise = easeOut(Math.min(1, u / 0.25));
        const grip = easeOut(Math.min(1, Math.max(0, (u - 0.25) / 0.2)));
        const sink = u > 0.75 ? (u - 0.75) / 0.25 : 0;
        const a = Math.min(1, u / 0.1) * (1 - sink);
        ctx.globalCompositeOperation = 'lighter';
        ellipseGlow(ctx, x, y, spread * 1.6, 7 * s, `rgba(${it.color}, ${0.45 * a})`);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let k = 0; k < n; k++) {
            const side = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
            const bx = x + side * spread;
            const h = H * (0.75 + 0.125 * ((k * 7) % 3)) * rise * (1 - sink * 0.6);
            const lean = -side * 0.18 + Math.sin(time * 5 + k * 2) * 0.06;   // 가운데(대상) 쪽으로 살짝 기울어짐
            const wx = bx + Math.sin(lean) * h, wy = y - Math.cos(lean) * h;  // 손목
            const palm = 8.5 * s;
            for (const [lw, color, al] of [[9, it.color, 0.35], [4.2, it.color, 0.8], [1.4, WHITE, 0.85]]) {
                ctx.strokeStyle = `rgba(${color}, ${al * a})`;
                ctx.lineWidth = lw * s;
                ctx.beginPath();
                ctx.moveTo(bx, y);
                ctx.quadraticCurveTo(bx + Math.sin(lean) * h * 0.3, y - h * 0.55, wx, wy);   // 팔뚝
                for (let f = 0; f < 4; f++) {   // 손가락: 벌렸다가(grip 0) 안쪽으로 굽힘(grip 1)
                    const spreadA = lean + (f - 1.5) * 0.38 * (1 - grip * 0.55);
                    const fl = palm * (1.5 - Math.abs(f - 1.5) * 0.18);
                    const mx = wx + Math.sin(spreadA) * fl, my = wy - Math.cos(spreadA) * fl;
                    const curl = spreadA + (side <= 0 ? 1 : -1) * 1.7 * grip;
                    ctx.moveTo(wx, wy);
                    ctx.lineTo(mx, my);
                    ctx.lineTo(mx + Math.sin(curl) * fl * 0.7, my - Math.cos(curl) * fl * 0.7);
                }
                ctx.stroke();
            }
            glow(ctx, wx, wy, palm * 1.8, `rgba(${it.color}, ${0.5 * a})`);
            ctx.fillStyle = `rgba(${it.color}, ${0.75 * a})`;   // 손바닥
            ctx.beginPath();
            ctx.ellipse(wx, wy, palm * 0.6, palm * 0.75, lean, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    crystals(ctx, x, y, it, u, s) {
        // 얼음 결정: 0~15% 바닥에서 솟음, 끝 25%에 금 가며 옅어짐. 가시마다 높이·기울기가 다름(정해진 무늬)
        const n = it.count || 5;
        const spread = (it.spread || 24) * s;
        const H = (it.h || 60) * s;
        const grow = easeOut(Math.min(1, u / 0.15));
        const fade = tail(u, 0.75);
        ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < n; k++) {
            const f = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
            const h = H * (0.55 + 0.45 * Math.cos(f * 1.3)) * (0.8 + 0.2 * ((k * 37) % 5) / 4) * grow;
            const w = (7 + ((k * 13) % 3) * 2) * s;
            const bx = x + f * spread;
            const lean = f * 0.35;
            const tx = bx + Math.sin(lean) * h, ty = y - Math.cos(lean) * h;
            const g = ctx.createLinearGradient(bx, y, tx, ty);
            g.addColorStop(0, `rgba(${it.color}, ${0.85 * fade})`);
            g.addColorStop(1, `rgba(${WHITE}, ${0.95 * fade})`);
            ctx.fillStyle = g;
            ctx.strokeStyle = `rgba(30, 60, 100, ${0.8 * fade})`;
            ctx.lineWidth = 1.2 * s;
            ctx.beginPath();
            ctx.moveTo(bx - w, y);
            ctx.lineTo(tx, ty);
            ctx.lineTo(bx + w, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = `rgba(${WHITE}, ${0.7 * fade})`;   // 결정 가운데 빛나는 선
            ctx.beginPath();
            ctx.moveTo(bx, y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        ellipseGlow(ctx, x, y, spread * 1.6, 8 * s, `rgba(${it.color}, ${0.5 * fade})`);
    },
    claw(ctx, x, y, it, u, s) {
        // 할퀸 자국: 빠르게 그어지고(0~25%) 서서히 사라짐. angle = 긁는 방향(라디안)
        const reveal = easeOut(Math.min(1, u / 0.25));
        const fade = tail(u, 0.3);
        const n = it.count || 3;
        const len = (it.len || 60) * s;
        const ang = it.angle != null ? it.angle : 2.2;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const nx = -dy, ny = dx;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * (it.gap || 12) * s;
            const sx = x - dx * len / 2 + nx * off, sy = y - dy * len / 2 + ny * off;
            const l = len * reveal * (1 - Math.abs(i - (n - 1) / 2) * 0.12);
            const ex = sx + dx * l, ey = sy + dy * l;
            const bend = (it.bend != null ? it.bend : 8) * s;
            const bx = (sx + ex) / 2 + nx * bend, by = (sy + ey) / 2 + ny * bend;   // 살짝 휜 궤적
            const wide = it.width || 8;
            for (const [w, color, a] of [[wide * 1.8, it.color, 0.25], [wide, it.color, 0.55], [wide * 0.3, WHITE, 0.95]]) {
                ctx.strokeStyle = `rgba(${color}, ${a * fade})`;
                ctx.lineWidth = w * s * (0.6 + 0.4 * fade);
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.quadraticCurveTo(bx, by, ex, ey);
                ctx.stroke();
            }
        }
    },
    bite(ctx, x, y, it, u, s) {
        // 위아래 턱이 0~20% 동안 닫히고 이빨 자국이 남았다 사라짐
        const close = easeOut(Math.min(1, u / 0.2));
        const fade = tail(u, 0.25);
        const r = (it.r || 26) * s;
        const off = r * (0.95 - 0.8 * close);
        ctx.globalCompositeOperation = 'lighter';
        for (const side of [-1, 1]) {           // -1: 윗턱(∩), 1: 아랫턱(∪)
            const cy = y + side * off;
            const a0 = side < 0 ? Math.PI * 1.15 : Math.PI * 0.15;
            const a1 = side < 0 ? Math.PI * 1.85 : Math.PI * 0.85;
            ctx.strokeStyle = `rgba(${it.color}, ${0.85 * fade})`;
            ctx.lineWidth = 5 * s;
            ctx.beginPath();
            ctx.arc(x, cy, r, a0, a1);
            ctx.stroke();
            ctx.fillStyle = `rgba(${WHITE}, ${0.95 * fade})`;
            for (let k = 0; k < 5; k++) {
                const a = a0 + (a1 - a0) * (k + 0.5) / 5;
                const px = x + Math.cos(a) * r, py = cy + Math.sin(a) * r;
                const tip = 9 * s;
                const ix = x - px, iy = cy - py, il = Math.hypot(ix, iy) || 1;
                ctx.beginPath();
                ctx.moveTo(px + (-iy / il) * 3.5 * s, py + (ix / il) * 3.5 * s);
                ctx.lineTo(px - (-iy / il) * 3.5 * s, py - (ix / il) * 3.5 * s);
                ctx.lineTo(px + (ix / il) * tip, py + (iy / il) * tip);
                ctx.closePath();
                ctx.fill();
            }
        }
    },
    cracks(ctx, x, y, it, u, s) {
        if (!it.lines) return;
        const grow = easeOut(Math.min(1, u / 0.18));
        const fade = tail(u, 0.35);
        const len = (it.len || 70) * s * grow;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 균열: 색 번짐 + 옅은 밝은 선 (흰 선을 강하게 두면 번개처럼 보임)
        for (const [w, color, a] of [[7, it.color, 0.5], [1.6, '255, 235, 200', 0.45]]) {
            ctx.strokeStyle = `rgba(${color}, ${a * fade})`;
            ctx.lineWidth = w * s * (0.5 + 0.5 * fade);
            for (const pts of it.lines) {
                ctx.beginPath();
                pts.forEach(([px, py], i) => {
                    const X = x + px * len, Y = y + py * len * 0.3;
                    if (i === 0) ctx.moveTo(X, Y);
                    else ctx.lineTo(X, Y);
                });
                ctx.stroke();
            }
        }
        ellipseGlow(ctx, x, y, len * 0.7, len * 0.2, `rgba(${it.color}, ${0.5 * fade})`);
    }
};

function roundTop(ctx, x, y, w, h) {
    const r = Math.min(w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + w / 2, y + r, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
}

// 바닥 마법진: 이중 고리 + 회전하는 룬 눈금 + 육망성 (원근감을 위해 세로로 납작한 타원)
function drawRune(ctx, x, y, p, time, open, pulse) {
    const s = p.s || 1;
    const rx = p.r * s * open, ry = rx * 0.3;
    if (rx < 1) return;
    const base = 0.35 + 0.65 * pulse;
    const rot = time * (p.spin || 0.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ellipseGlow(ctx, x, y, rx * 1.1, ry * 1.1, `rgba(${p.color}, ${0.18 + 0.3 * pulse})`);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = `rgba(${p.color}, ${0.55 * base + 0.2})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${p.color}, ${0.45 * base + 0.15})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 룬 눈금 (두 고리 사이)
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 16; i++) {
        const a = rot + (i / 16) * Math.PI * 2;
        const len = i % 2 ? 0.06 : 0.12;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * rx * 0.82, y + Math.sin(a) * ry * 0.82);
        ctx.lineTo(x + Math.cos(a) * rx * (0.82 + len), y + Math.sin(a) * ry * (0.82 + len));
        ctx.stroke();
    }
    // 육망성 (반대 방향 회전)
    ctx.strokeStyle = `rgba(${p.color}, ${0.5 * base + 0.1})`;
    for (let tri = 0; tri < 2; tri++) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const a = -rot * 0.7 + tri * Math.PI / 3 + (i / 3) * Math.PI * 2;
            const px = x + Math.cos(a) * rx * 0.74, py = y + Math.sin(a) * ry * 0.74;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    ctx.restore();
}

// 저주 장판 (바닥 레이어): 검보라 웅덩이 + 일렁이는 테두리 + 발밑 근원 + 옅은 마법진 + 틱 파문
function drawField(ctx, cx, cy, p, time) {
    const s = p.s || 1;
    const rx = p.rx * s * easeOut(p.open), ry = rx * (p.flat || 0.22);
    if (rx < 1) return;
    const y = cy + (p.dy || 0) * s;
    const pulse = p.pulse;
    const ox = cx - rx + (p.origin || 30) * s;     // 근원 (캐릭터 발밑)
    ctx.save();
    // 바닥을 검보라로 물들임 (밝히지 않고 어둡게)
    ctx.globalCompositeOperation = 'source-over';
    ellipseGlow(ctx, cx, y, rx * 1.08, ry * 1.08, `rgba(${p.dark}, 0.6)`);
    ellipseGlow(ctx, ox, y, rx * 0.55, ry * 0.9, `rgba(${p.dark}, 0.45)`);
    // 장판 면: 가장자리로 갈수록 진해지는 보라 막 (어두운 배경에서도 범위가 보이게)
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(1, ry / rx);
    const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    fill.addColorStop(0, `rgba(${p.color}, ${0.04 + 0.1 * pulse})`);
    fill.addColorStop(0.75, `rgba(${p.color}, ${0.13 + 0.15 * pulse})`);
    fill.addColorStop(0.95, `rgba(${p.color}, ${0.22 + 0.2 * pulse})`);
    fill.addColorStop(1, `rgba(${p.color}, 0)`);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 일렁이는 테두리
    ctx.lineWidth = 1.8 * s;
    ctx.strokeStyle = `rgba(${p.color}, ${0.38 + 0.45 * pulse})`;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const w = 1 + 0.045 * Math.sin(a * 7 + time * 2.3) + 0.03 * Math.sin(a * 13 - time * 3.4);
        const px = cx + Math.cos(a) * rx * w, py = y + Math.sin(a) * ry * w;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 발밑 근원: 가장 진하게 맥동
    const beat = 0.5 + 0.5 * Math.sin(time * 3);
    ellipseGlow(ctx, ox, y, 44 * s, 13 * s, `rgba(${p.color}, ${0.28 + 0.12 * beat + 0.35 * pulse})`);
    // 안쪽 마법진 (옅게, 틱마다 번쩍)
    if (p.rune) {
        drawRune(ctx, cx + (p.rune.dx || 0) * s, y, { r: p.rune.r, s, color: p.color, spin: p.rune.spin },
            time, easeOut(p.open), 0.05 + 0.75 * pulse);
    }
    // 틱 파문: 근원에서 장판 끝으로 쓸려가는 물결
    if (pulse > 0) {
        const u = easeOut(1 - pulse);
        const wx = ox + (cx + rx - ox) * u;
        const k = (wx - cx) / rx;
        const h = ry * Math.sqrt(Math.max(0, 1 - k * k)) * 0.95;
        if (h > 1) {
            ctx.lineCap = 'round';
            for (const [w, color, a] of [[7, p.color, 0.3], [2.4, p.color, 0.85], [0.9, WHITE, 0.7]]) {
                ctx.strokeStyle = `rgba(${color}, ${a * pulse})`;
                ctx.lineWidth = w * s;
                ctx.beginPath();
                ctx.ellipse(wx, y, Math.max(2, 10 * s), h, 0, -Math.PI / 2, Math.PI / 2);
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

// 저주 장판 (앞 레이어): 장판 안 대상의 발목을 휘감는 검은 촉수
function drawGrips(ctx, p, time) {
    if (!p.targetList.length) return;
    const s = p.s || 1;
    ctx.save();
    for (const tg of p.targetList) {
        const g = easeOut(Math.min(1, (p.grips.get(tg.key) || 0) / 0.35));
        if (g <= 0) continue;
        const w = (tg.w || 16) * s;
        ctx.globalCompositeOperation = 'source-over';
        ellipseGlow(ctx, tg.x, tg.y, w * 1.6, 6 * s, `rgba(${p.dark}, ${0.55 * g})`);
        for (let i = 0; i < 3; i++) {
            const seed = String(tg.key).length * 1.37 + i * 2.1;
            const bx = tg.x + (i - 1) * w * 0.85;
            const h = (20 + (i % 2) * 7) * s * g * (0.88 + 0.12 * Math.sin(time * 4 + seed));
            drawTendril(ctx, bx, tg.y, h, (i - 1) * 0.45, time * 3 + seed, s, p);
        }
    }
    ctx.restore();
}

// 촉수 한 가닥: 밑동이 굵고 끝으로 가늘어지며 흔들림 (검보라 몸통 + 보라 윤곽)
function drawTendril(ctx, x, y, h, lean, phase, s, p) {
    const N = 8;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
        const f = i / N;
        const px = x + lean * h * f + Math.sin(phase + f * 4) * 5 * s * f;
        const py = y - h * f;
        const w = 3.6 * s * (1 - f) + 0.4 * s;
        left.push([px - w, py]);
        right.push([px + w, py]);
    }
    ctx.beginPath();
    left.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${p.dark}, 0.92)`;
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${p.color}, 0.55)`;
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
}

// 어둠 파동: 진행 방향을 향한 초승달 (보라 외곽 + 흰 코어), 사거리 끝으로 갈수록 옅어짐
function drawWave(ctx, pr) {
    const s = pr.scale;
    const R = (pr.h / 2) * s;
    const fade = Math.min(1, pr.t / 0.08) * (1 - Math.max(0, pr.dist / (pr.range * s) - 0.7) / 0.3);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.scale(pr.dir, 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, -R * 0.2, 0, R * 1.5, `rgba(${pr.color}, ${0.35 * fade})`);
    ctx.beginPath();
    ctx.arc(-R * 0.55, 0, R, -1.15, 1.15);
    ctx.arc(-R * 1.05, 0, R * 1.02, 1.0, -1.0, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(-R, 0, R * 0.5, 0);
    g.addColorStop(0, `rgba(${pr.color}, 0)`);
    g.addColorStop(0.6, `rgba(${pr.color}, ${0.8 * fade})`);
    g.addColorStop(1, `rgba(${WHITE}, ${0.95 * fade})`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${WHITE}, ${0.9 * fade})`;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(-R * 0.55, 0, R, -1.0, 1.0);
    ctx.stroke();
    ctx.restore();
}

// 구체 꼬리: 지나온 위치를 이은 부드러운 리본 (추가 입자 없음)
function orbRibbon(ctx, pr, time, width, alpha) {
    if (pr.trail.length < 2) return;
    const points = [];
    for (let i = 0; i < pr.trail.length; i++) {
        const f = i / (pr.trail.length - 1);
        const [x, y] = pr.trail[i];
        const prev = pr.trail[Math.max(0, i - 1)], next = pr.trail[Math.min(pr.trail.length - 1, i + 1)];
        const dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(time * 22 + f * 7) * 3 * pr.scale * (1 - f);
        points.push({ x: x - dy / len * wob, y: y + dx / len * wob, nx: -dy / len, ny: dx / len, w: width * f });
    }
    const first = points[0], last = points[points.length - 1];
    const g = ctx.createLinearGradient(first.x, first.y, last.x + 0.01, last.y);
    g.addColorStop(0, `rgba(${pr.color}, 0)`);
    g.addColorStop(0.65, `rgba(${pr.color}, ${alpha * 0.55})`);
    g.addColorStop(1, `rgba(${pr.color}, ${alpha})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const side of [1, -1]) {
        const edge = points.map(p => [p.x + p.nx * p.w * side, p.y + p.ny * p.w * side]);
        if (side < 0) edge.reverse();
        ctx.lineTo(edge[0][0], edge[0][1]);
        for (let i = 1; i < edge.length; i++) {
            const [px, py] = edge[i - 1], [ex, ey] = edge[i];
            ctx.quadraticCurveTo(px, py, (px + ex) / 2, (py + ey) / 2);
        }
        const end = edge[edge.length - 1];
        ctx.lineTo(end[0], end[1]);
    }
    ctx.closePath();
    ctx.fill();
}

// 세뇌 구체: 색이 남는 둥근 테두리 + 밝은 심 + 유선형 리본 꼬리
function drawOrb(ctx, pr, time) {
    const s = pr.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    orbRibbon(ctx, pr, time, 15 * s, 0.2);
    orbRibbon(ctx, pr, time, 7 * s, 0.8);
    const r = 10 * s * (0.95 + 0.05 * Math.sin(time * 20));
    glow(ctx, pr.x, pr.y, r * 3.2, `rgba(${pr.color}, 0.5)`);
    const g = ctx.createRadialGradient(pr.x - r * 0.25, pr.y - r * 0.25, 0, pr.x, pr.y, r);
    g.addColorStop(0, `rgba(${WHITE}, 1)`);
    g.addColorStop(0.3, `rgba(${WHITE}, 0.95)`);
    g.addColorStop(0.7, `rgba(${pr.color}, 0.9)`);
    g.addColorStop(1, `rgba(${pr.color}, 0.15)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// 주사 바늘: 진행 방향으로 붉은 빛 꼬리 + 흰 바늘
function drawNeedle(ctx, pr) {
    const s = pr.scale;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const len = Math.min(95 * s, Math.hypot(pr.x - pr.from[0], pr.y - pr.from[1]) + 12 * s);
    for (const [w, color, a, reach] of [[10, pr.color, 0.18, 1], [3.2, pr.color, 0.85, 1], [1.1, WHITE, 1, 0.6]]) {
        const g = ctx.createLinearGradient(-len * reach, 0, 6 * s, 0);
        g.addColorStop(0, `rgba(${color}, 0)`);
        g.addColorStop(0.85, `rgba(${color}, ${a})`);
        g.addColorStop(1, `rgba(${WHITE}, ${a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        ctx.moveTo(-len * reach, 0);
        ctx.lineTo(6 * s, 0);
        ctx.stroke();
    }
    glow(ctx, 2 * s, 0, 7 * s, `rgba(${pr.color}, 0.7)`);
    ctx.restore();
}

// 앵커 사슬: 손에서 앵커 머리까지 고리 사슬 + 청록 유령 빛, 머리는 갈고리 두 개 달린 앵커
function drawChain(ctx, pr, time) {
    const s = pr.scale;
    const dx = pr.hx - pr.x, dy = pr.hy - pr.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${pr.color}, 0.35)`;
    ctx.lineWidth = 6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr.hx, pr.hy);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const links = Math.max(1, Math.floor(len / (7 * s)));
    for (let i = 0; i < links; i++) {   // 사슬 고리: 넓은 고리와 좁은 고리를 번갈아
        const f = (i + 0.5) / links;
        ctx.save();
        ctx.translate(pr.x + dx * f, pr.y + dy * f);
        ctx.rotate(ang);
        ctx.strokeStyle = i % 2 ? '#8a96a0' : '#5e6872';
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 * s, (i % 2 ? 1.2 : 2.4) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    // 앵커 머리 (날아갈 때는 목표 쪽, 감길 때는 손 쪽으로 갈고리)
    ctx.translate(pr.hx, pr.hy);
    ctx.rotate(pr.phase === 'out' ? pr.angle : ang + Math.PI);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, 16 * s * (0.85 + 0.15 * Math.sin(time * 30)), `rgba(${pr.color}, 0.55)`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#c8d2d8';
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, 0);           // 자루
    ctx.lineTo(7 * s, 0);
    ctx.moveTo(-4 * s, -5 * s);      // 가로대
    ctx.lineTo(-4 * s, 5 * s);
    ctx.moveTo(7 * s, 0);            // 갈고리 두 개
    ctx.quadraticCurveTo(7 * s, -8 * s, 1 * s, -9 * s);
    ctx.moveTo(7 * s, 0);
    ctx.quadraticCurveTo(7 * s, 8 * s, 1 * s, 9 * s);
    ctx.stroke();
    ctx.restore();
}

// 미사일: 진행 방향으로 회전한 탄두 + 꼬리 화염
function drawMissile(ctx, pr, time) {
    const s = pr.scale;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.8 + 0.2 * Math.sin(time * 90);
    const exhaust = ctx.createLinearGradient(-48 * s * flick, 0, -8 * s, 0);
    exhaust.addColorStop(0, `rgba(${pr.color}, 0)`);
    exhaust.addColorStop(0.6, `rgba(${pr.color}, 0.65)`);
    exhaust.addColorStop(1, `rgba(${WHITE}, 0.95)`);
    ctx.fillStyle = exhaust;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -3 * s);
    ctx.quadraticCurveTo(-24 * s, -9 * s * flick, -48 * s * flick, 0);
    ctx.quadraticCurveTo(-24 * s, 9 * s * flick, -8 * s, 3 * s);
    ctx.closePath();
    ctx.fill();
    glow(ctx, -12 * s, 0, 14 * s * flick, `rgba(${pr.color}, 0.8)`);
    glow(ctx, -10 * s, 0, 5 * s, `rgba(${WHITE}, 0.95)`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3a3a48';
    ctx.strokeStyle = '#111118';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(-9 * s, -3.2 * s);
    ctx.lineTo(5 * s, -3.2 * s);
    ctx.lineTo(10 * s, 0);
    ctx.lineTo(5 * s, 3.2 * s);
    ctx.lineTo(-9 * s, 3.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(3 * s, -3.2 * s, 2.5 * s, 6.4 * s);
    ctx.restore();
}
