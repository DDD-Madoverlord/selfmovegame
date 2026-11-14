/* ==========================================================================
   PROJECT: MAD OVERLORD // 사운드 장면 점검실 — 장면 157개
   이름 → { when: 게임에서 나는 순간, len: 권장 길이(초), run: 장면 }
   - 지금 있는 소리는 게임과 같은 이펙트 정의를 재생 → 정의에 붙은 sfx가 게임처럼 남 (따로 부르지 않음)
   - 새 소리(48개)는 아직 게임 코드가 부르지 않으므로 장면이 알맞은 순간에 s.sfx(이름)으로 부름
     지금은 NEW_RULES의 src(지금 그 자리에 빌려 쓰는 소리)가 남 → 파일을 넣으면 그 파일로 바뀜
   목록·이름·등급은 cue_list.json (11-06 사운드 기획서 소리 목록)
   ========================================================================== */

import { SLOTS, HERO_X, FB, W, H } from './stage.js';
import { MECH_VFX as M, KAIJU_VFX as K, HERO_VFX as HV, CHIMERA_VFX as CV, DIVER_VFX as DV, SAINT_VFX as SV, FROST_VFX as FV,
    DOLL_VFX as DL, ZONE_VFX as Z, BOSS_VFX as BV, BATTLE_VFX as BT, SET_VFX as ST, GENERIC_VFX as G, ELITE_VFX as EV } from '/js/engine_v2/vfx/vfxDefs.js';
import { ICE, MIST } from '/js/engine_v2/vfx/frostVfx.js';
import { HERO_WAVE, HERO_ORB } from '/js/engine_v2/vfx/heroVfx.js';
import { WATER, ABYSS } from '/js/engine_v2/vfx/diverVfx.js';
import { BLOOD } from '/js/engine_v2/vfx/saintVfx.js';
import { THREAD } from '/js/engine_v2/vfx/dollVfx.js';
import { ACID } from '/js/engine_v2/vfx/kaijuVfx.js';
import { SKILLS } from '/js/engine_v2/skills_v2.js';
import { registerAllSets2 } from '/js/engine_v2/sets2/index.js';
import { spr, fxOf } from '/js/engine_v2/skillKit_v2.js';
import { STAGES } from '/js/engine_v2/stages_v2.js';
import { sound } from '/js/engine_v2/audio/sound_v2.js';

try { registerAllSets2(); } catch (e) { console.warn('[장면] 2차 세트 등록 실패', e); }

const quiet = d => (d ? { ...d, sfx: undefined } : null);   // 정의에 붙은 소리 없이 그림만 (새 소리 장면용)
const rand = (a, b) => a + Math.random() * (b - a);
const MELEE = [455, 545, 635];
const NEAR = [520, 640, 760];
const FRONT = HERO_X + 60;
const HIT_X = HERO_X + 25;          // 적 공격이 닿는 주인공 자리 (게임 monsterX + 60)
const CH_ZONE = { mech: 1, kaiju: 2, hero: 3, chimera: 4, diver: 5, saint: 6, doll: 7, frost: 8, architect: 9, broadcaster: 10 };
const ZFOES = {
    1: ['conscript', 'riot', 'taser'], 2: ['merc', 'dozer', 'acidmech'], 3: ['zealot', 'executioner', 'lightmage'],
    4: ['mutant', 'boneshield', 'sporecaster'], 5: ['marine', 'hatchshield', 'toxicdiver'], 6: ['orderly', 'maidenshield', 'bloated'],
    7: ['trench', 'wireshield', 'grenadier'], 8: ['torch', 'furnaceshield', 'hunter'], 9: ['thug', 'safetywarden', 'dynamite'],
    10: ['citizen', 'sonicshield', 'enforcer']
};
const stageOf = id => STAGES.find(st => st.id === id) || STAGES[0];

// ---------------------------------------------------------------------------
// 새 소리 48개의 재생 규칙 (아직 게임 표에 없음 — 장면에서만). src = 지금 그 자리에 빌려 쓰는 소리
export const NEW_RULES = {
    hit_start_slash: { vol: 0.42, gap: 0.05, voices: 4, pitch: 0.08, src: 'generic_slash' },
    hit_start_blunt: { vol: 0.5, gap: 0.05, voices: 4, pitch: 0.06, src: 'chimera_punch' },
    hit_start_pierce: { vol: 0.3, gap: 0.05, voices: 4, pitch: 0.1, src: 'saint_stitch' },
    hit_start_energy: { vol: 0.24, gap: 0.05, voices: 4, pitch: 0.1, src: 'mech_laser_hit' },
    hit_body_light: { vol: 0.3, gap: 0.05, voices: 4, pitch: 0.1, src: 'frost_hit' },
    hit_body_mid: { vol: 0.45, gap: 0.05, voices: 4, pitch: 0.08, src: 'hero_slash_hit' },
    hit_body_heavy: { vol: 0.55, gap: 0.06, voices: 3, pitch: 0.06, src: 'mech_fist_hit' },
    hit_tail_metal: { vol: 0.25, gap: 0.08, voices: 3, pitch: 0.1, src: 'shield_hit' },
    hit_tail_debris: { vol: 0.3, gap: 0.08, voices: 3, pitch: 0.1, src: 'base_blast' },
    hit_tail_energy: { vol: 0.25, gap: 0.08, voices: 3, pitch: 0.08, src: 'hero_wave_hit' },
    hit_crit: { vol: 0.55, gap: 0.1, voices: 2, pitch: 0.05, src: 'mech_fist_hit' },
    kill_small: { vol: 0.3, gap: 0.06, voices: 3, pitch: 0.12, src: 'enemy_die' },
    kill_large: { vol: 0.5, gap: 0.1, voices: 2, pitch: 0.08, src: 'mech_missile_blast' },
    kill_boss: { vol: 0.9, duck: 0.35, src: 'base_destroyed' },
    arch_basic_hit: { vol: 0.5, gap: 0.05, voices: 3, pitch: 0.08, src: 'chimera_punch' },
    bc_basic_hit: { vol: 0.3, gap: 0.06, voices: 3, pitch: 0.1, src: 'hero_wave_hit' },
    en_melee: { vol: 0.35, gap: 0.08, voices: 3, pitch: 0.1, src: 'generic_slash' },
    en_gun: { vol: 0.2, gap: 0.06, voices: 4, pitch: 0.12, src: 'mech_laser' },
    en_cannon: { vol: 0.3, gap: 0.1, voices: 3, pitch: 0.1, src: 'mech_missile_launch' },
    en_shot: { vol: 0.22, gap: 0.08, voices: 3, pitch: 0.1, src: 'zone_arrow' },
    en_explosive: { vol: 0.38, gap: 0.1, voices: 3, pitch: 0.1, src: 'mech_missile_blast' },
    en_fire: { vol: 0.26, gap: 0.1, voices: 3, pitch: 0.1, src: 'zone_spell_fire' },
    en_electric: { vol: 0.24, gap: 0.1, voices: 3, pitch: 0.12, src: 'zone_spell_bolt' },
    en_toxic: { vol: 0.26, gap: 0.1, voices: 3, pitch: 0.1, src: 'zone_venom' },
    en_holy: { vol: 0.24, gap: 0.1, voices: 3, pitch: 0.08, src: 'zone_heal_holy' },
    en_sonic: { vol: 0.5, gap: 0.12, voices: 2, pitch: 0.08, src: 'bc_burst' },
    en_machine: { vol: 0.35, gap: 0.12, voices: 2, pitch: 0.08, src: 'arch_drill' },
    en_beast: { vol: 0.35, gap: 0.08, voices: 3, pitch: 0.1, src: 'kaiju_bite' },
    boss_guardian: { vol: 0.65, gap: 0.5, duck: 0.6, src: 'zone_knight' },
    boss_scrapking: { vol: 0.6, gap: 0.5, duck: 0.6, src: 'mech_fist_hit' },
    boss_archbishop: { vol: 0.65, gap: 0.5, duck: 0.6, src: 'zone_judgment' },
    boss_oculus: { vol: 0.7, gap: 0.5, duck: 0.6, src: 'zone_mutation' },
    boss_orbian: { vol: 0.65, gap: 0.5, duck: 0.6, src: 'zone_judgment' },
    boss_wmdalpha: { vol: 0.7, gap: 0.5, duck: 0.6, src: 'mech_laser_big' },
    boss_terraformer: { vol: 0.75, gap: 0.5, duck: 0.6, src: 'chimera_slam' },
    boss_benedict: { vol: 0.42, gap: 0.5, duck: 0.6, src: 'zone_hellgate' },
    boss_ironclad: { vol: 0.5, gap: 0.5, duck: 0.6, src: 'diver_surge' },
    boss_grailheart: { vol: 0.65, gap: 0.5, duck: 0.6, src: 'zone_judgment' },
    boss_behemoth: { vol: 0.6, gap: 0.5, duck: 0.6, src: 'base_blast' },
    boss_vladimir: { vol: 0.4, gap: 0.5, duck: 0.6, src: 'kaiju_breath' },
    boss_panopticon: { vol: 0.77, gap: 0.5, duck: 0.6, src: 'arch_crane' },
    boss_mothervoice: { vol: 0.55, gap: 0.5, duck: 0.6, src: 'bc_emergency' },
    ui_buy: { vol: 0.55, gap: 0.1, src: 'ui_equip' },
    ui_upgrade_ok: { vol: 0.5, src: 'reward_done' },
    ui_upgrade_fail: { vol: 0.45, src: 'ui_error' },
    ui_unlock: { vol: 0.55, src: 'star_get' },
    ui_coin: { vol: 0.14, gap: 0.05, pitch: 0.05, src: 'ui_tick' },
    ui_levelup: { vol: 0.6, src: 'mission_complete' }
};

// ---------------------------------------------------------------------------
// 공통 준비
async function field(s, o = {}) {
    s.setZone(o.zone ?? CH_ZONE[o.hero] ?? 1, !!o.boss);
    await s.setHero(o.hero ?? null, { arm: o.arm, mode: o.mode || 'idle' });
    const us = o.foes ? s.foes(o.foes, { slots: o.slots, scale: o.scale }) : [];
    if (o.hud) s.hud(o.hud === true ? {} : o.hud);
    s.quietSteps = o.steps !== true;     // 발소리는 걷는 장면에서만
    return us;
}

/** 기본 공격 반복: 리그 공격 동작의 발사 순간(fire/impact)마다 shot(대상) — 이벤트가 없으면 일정 간격 */
function autoFire(s, us, shot, o = {}) {
    const until = o.until ?? 4.2, killAt = o.killAt ?? 3;
    let k = 0, fired = 0;
    const fire = () => {
        const live = us.filter(u => !u.dead);
        if (!live.length) return;
        const u = live[k++ % live.length];
        shot(u, live);
        u.hits = (u.hits || 0) + 1;
        if (killAt && u.hits >= killAt) s.at(s.time + (o.killDelay ?? 0.18), () => s.kill(u, { sound: o.dieSound !== false }));
    };
    s.onFire = () => { fired++; fire(); };
    s.at(o.wait ?? 1.25, () => {
        if (fired) return;
        for (let t = s.time; t < until; t += o.period ?? 0.7) s.at(t, fire);
    });
    s.at(until, () => { s.onFire = null; s.rig?.setMode('idle'); });
    s.end(until + 0.8);
}

const live = us => us.filter(u => !u.dead);

// ---- 캐릭터 기본 공격 (battle/attacks.js · diver/saint/frost/doll.js와 같은 이펙트) ----
const SHOT = {
    mech: s => u => {
        const m = s.muzzle(), c = u.chest();
        s.fx2(M.laser, m.x, m.b, { to: [c.x, c.b] });
        s.at(s.time + 0.04, () => { s.fxOn(M.laserHit, u); s.hit(u, { kb: 4 }); });
    },
    mechFist: s => u => { const c = u.chest(); s.fx2(M.fistHit, c.x - 10, c.b - 20); s.hit(u, { kb: 14 }); s.shake(3, 140); },
    kaiju: s => u => { s.fxOn(K.biteHit, u); s.hit(u, { kb: 10 }); },
    heroSlash: s => u => { s.fxOn(HV.slashHit, u); s.hit(u, { kb: 10 }); },
    chimera: s => u => { s.fxOn(CV.punchHit, u); s.hit(u, { kb: 12 }); },
    chimeraClaw: s => u => { s.fxOn(CV.clawHit, u); s.hit(u, { kb: 8 }); },
    diver: s => u => {
        const m = s.muzzle(), c = u.chest();
        s.fx2(DV.jet, m.x, m.b, { to: [c.x, c.b] });
        s.at(s.time + 0.08, () => s.hit(u, { kb: 9 }));
    },
    saint: s => u => {
        const m = s.muzzle();
        s.fx.launchNeedle({ x: m.x, bottom: m.b }, () => u.chest(), () => { s.fxOn(SV.needleHit, u); s.hit(u, { kb: 3 }); });
    },
    doll: s => u => { s.fxOn(DL.snipHit, u); s.hit(u, { kb: 8 }); },
    heroWave: s => () => {
        const m = s.muzzle(), done = new Set();
        s.fx.launchWave({ x: m.x, b: Math.max(80, m.b), range: 520, color: HERO_WAVE.color, speed: HERO_WAVE.speed, h: HERO_WAVE.h,
            onPass: (x0, x1) => s.units.forEach(u => {
                if (u.dead || done.has(u) || u.x < x0 || u.x > x1) return;
                done.add(u);
                s.fxOn(HV.waveHit, u);
                s.hit(u, { kb: 8 });
            }) });
    },
    frost: s => () => {
        const m = s.muzzle(), done = new Set();
        s.fx.launchWave({ x: m.x, b: Math.max(70, m.b - 10), range: 520, speed: 820, h: 54, color: ICE, mist: MIST, sfx: 'frost_fan',
            onPass: (x0, x1) => s.units.forEach(u => {
                if (u.dead || done.has(u) || done.size >= 2 || u.x < x0 || u.x > x1) return;
                done.add(u);
                s.fxOn(FV.fanHit, u);
                s.hit(u, { kb: 5 });
            }) });
    }
};

// 새 캐릭터 기본 공격 그림 (2차 kitAttack 모양)
const ARCH_HIT = fxOf(spr('drill_burst', 120, { anchorY: 0.6, dur: 0.35 }));
const BC_HIT = fxOf(spr('sonic_pink', 90, { dur: 0.3 }));

/** 캐릭터 기본 공격 장면 (지금 소리 그대로) */
function basicScene(hero, shotKey, o = {}) {
    return async s => {
        const us = await field(s, { hero, arm: o.arm, mode: 'attack', foes: o.foes || ZFOES[CH_ZONE[hero]], slots: o.slots || (o.melee ? MELEE : SLOTS) });
        autoFire(s, us, SHOT[shotKey](s), o);
    };
}

// ---- 2차 단계표 스킬 재생 (skillKit_v2.js runSteps 흉내 — 같은 그림 · 같은 순서) ----
const KSTEP = {
    hit(s, st) {
        for (let i = 0; i < (st.times || 1); i++) {
            s.at(s.time + i * (st.every ?? 0.12), () => {
                const list = st.pick === 'all' ? live(s.units) : live(s.units).slice(0, st.n || 1);
                list.forEach(u => { if (st.vfx) s.fxOn(st.vfx, u, !!st.ground); s.hit(u, { kb: 10 }); });
                if (st.sfx) s.sfx(st.sfx, { vol: 0.6 });
            });
        }
    },
    fx(s, st) {
        const x = st.on === 'self' ? HERO_X + 35 + (st.x || 0) : FRONT + (st.x || 0);
        s.fx2(st.vfx, x, st.b ?? FB, { scale: st.scale || 1, ...(st.follow ? { follow: () => [x, st.b ?? FB] } : {}) });
    },
    rain(s, st) {
        const [a, z] = st.x || [40, 380];
        const count = Math.max(1, Math.round(st.count || 1));
        const targets = live(s.units);
        for (let i = 0; i < count; i++) {
            s.at(s.time + i * (st.every ?? 0.15), () => {
                const t = targets[i % Math.max(1, targets.length)];
                const x = (t && !t.dead ? t.x : FRONT + a + Math.random() * (z - a)) + (Math.random() - 0.5) * (st.jitter ?? 20);
                if (st.fall) {
                    s.fx2(st.fall, x + (st.fallDx ?? 0), H + 60, { scale: st.scale || 1, to: [x, (st.vfxB ?? FB) + (st.fallTo ?? 0)] });
                    s.at(s.time + (st.delay ?? 0), () => st.vfx && s.fx2(st.vfx, x, st.vfxB ?? FB, { scale: st.scale || 1 }));
                } else if (st.vfx) s.fx2(st.vfx, x, st.vfxB ?? FB, { scale: st.scale || 1 });
                s.at(s.time + (st.delay ?? 0), () => s.units.forEach(u => { if (!u.dead && Math.abs(u.x - x) < (st.radius ?? 60) + 30) s.hit(u, { kb: 12 }); }));
                if (st.shake) s.shake(st.shake, 140);
                if (st.sfx && i % 2 === 0) s.sfx(st.sfx, { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
            });
        }
    },
    wave(s, st) {
        const w = { x: FRONT + (st.from ?? -40), b: st.b ?? FB + 40, gone: 0, dist: st.dist ?? 380, speed: st.speed ?? 420, vfxT: 0, hit: new Set() };
        if (st.sfx) s.sfx(st.sfx, { vol: 0.7 });
        if (st.ride) s.fx2(st.ride, w.x, w.b, { follow: () => [w.x, w.b], alive: () => w.gone < w.dist });
        const tick = 1 / 30;
        const step = () => {
            if (w.gone >= w.dist) return;
            w.x += w.speed * tick;
            w.gone += w.speed * tick;
            w.vfxT -= tick;
            if (st.vfx && w.vfxT <= 0) { w.vfxT = st.vfxEvery ?? 0.1; s.fx2(st.vfx, w.x, w.b, { scale: st.scale || 1 }); }
            s.units.forEach(u => { if (!u.dead && !w.hit.has(u) && Math.abs(u.x - w.x) < (st.w ?? 50)) { w.hit.add(u); s.hit(u, { kb: 10 }); } });
            s.at(s.time + tick, step);
        };
        step();
    },
    line(s, st) {
        const from = st.from === 'mouth' ? s.socket('mouth', 'head') : s.muzzle();
        if (st.vfx) s.fx2(st.vfx, from.x, st.b ?? from.b, { to: [FRONT + 520, st.b ?? 100] });
        live(s.units).forEach((u, i) => s.at(s.time + i * (st.gap ?? 0.03), () => { if (st.hitVfx) s.fxOn(st.hitVfx, u); s.hit(u, { kb: 4, num: i === 0 }); }));
    },
    screen(s, st) {
        live(s.units).forEach((u, i) => {
            if (st.vfx && i < (st.maxFx ?? 10)) s.fxOn(st.vfx, u, !!st.ground);
            if (st.dmg) s.hit(u, { kb: 6 });
        });
    },
    shake(s, st) { s.shake(st.power ?? 6, st.ms ?? 220); },
    zone(s, st) { if (st.puff) s.fx2(st.puff, FRONT + (st.x || 0) + (st.w || 80) / 2, FB + 20); }
};

/** SKILLS[id]를 게임 순서대로: 사용 순간 skill.sfx → 동작 → 단계 (o.sound=false면 스킬 소리 없이) */
function runKit(s, id, o = {}) {
    const sk = SKILLS[id];
    if (!sk || !sk.steps) { console.warn('[장면] 스킬 없음', id); return 0; }
    if (sk.sfx && o.sound !== false) s.sfx(sk.sfx);
    s.clip(sk.clip || 'cast');
    let last = 0;
    for (const st of sk.steps) {
        const reps = Math.max(1, Math.round(st.repeat || 1));
        for (let r = 0; r < reps; r++) {
            const at = (typeof st.at === 'number' ? st.at : 0) + r * (st.repeatGap ?? 0.3);
            last = Math.max(last, at);
            s.at(s.time + at, () => KSTEP[st.do]?.(s, st));
        }
    }
    return last;
}

/** 적이 주인공에게 구체·탄을 쏨 (게임 shootTranq·castSpell — launchOrb) */
function foeOrb(s, u, color, onArrive, dur = 0.38) {
    s.foeAttack(u);
    s.fx.launchOrb({ x: u.x - 12, bottom: 96 }, () => ({ x: HIT_X, b: 120 }), color, dur, onArrive, null);
}

/** 적 탄이 주인공에게 닿음: 움찔 + 숫자 + player_hit (게임처럼 0.4초에 한 번까지, o.sound=false면 없이) */
function heroHit(s, o = {}) {
    s.heroHurt(o.dmg ?? Math.round(rand(30, 60)));
    if (o.sound !== false) s.sfx('player_hit');
}

// 짧은 직선 탄 (총·저격 — 새 소리 장면용, 소리 없음)
const TRACER = color => ({ layers: [{ type: 'beam', at: 0, dur: 0.07, w: 3, color }, { type: 'flash', at: 0, dur: 0.06, r: 10, color }] });
const MUZZLE = color => ({ layers: [{ type: 'flash', at: 0, dur: 0.07, r: 16, color }, { type: 'sparks', at: 0, count: 5, speed: 160, angle: Math.PI, cone: 0.6, color }] });
const IMPACT = (color, r = 30) => ({ layers: [{ type: 'flash', at: 0, dur: 0.1, r, color }, { type: 'sparks', at: 0, count: 8, speed: 220, color }, { type: 'ring', at: 0, dur: 0.25, r: r * 1.6, width: 3, color }] });

/** 타격 층 장면: 주인공이 때릴 때마다 layers(층 소리 이름들)를 한꺼번에 — 앞이 지금 고르는 층 */
function layerScene(hero, shotKey, layers, o = {}) {
    return async s => {
        const us = await field(s, { hero, arm: o.arm, mode: 'attack', foes: o.foes || ZFOES[CH_ZONE[hero]], slots: o.slots || (o.melee ? MELEE : SLOTS) });
        s.layerMeter?.(o.crit ? ['hit_crit', ...layers] : layers);
        const quietShot = SHOT[shotKey](s);
        const prev = s.muteGame;
        s.muteGame = new Set(o.mute || []);     // 이 장면에서 끄는 게임 소리 (원래 타격 소리)
        let n = 0;
        autoFire(s, us, u => {
            quietShot(u);
            const crit = o.crit && n++ % 2 === 1;   // 치명타 장면: 두 번에 한 번 (게임은 20% 확률)
            s.at(s.time + (o.delay ?? 0.04), () => {
                layers.forEach((n, i) => s.at(s.time + (o.stagger ? i * o.stagger : 0), () => s.sfx(n)));
                if (crit) { s.sfx('hit_crit'); s.num(u.head(), Math.round(rand(300, 420)), true); s.hitStop(0.05); }
            });
        }, { ...o, dieSound: o.dieSound });
        s.at(s.duration, () => { s.muteGame = prev; });
    };
}

// ---------------------------------------------------------------------------
// 장면
export const SCENES = {
    // =================== 캐릭터 10명 — 거대로봇 ===================
    mech_laser: { when: '거대로봇 기본 공격(포 팔) — 총구에서 레이저가 나가는 순간. 아주 자주(0.05초 간격 허용, 동시 4개)', len: [0.1, 0.35],
        run: basicScene('mech', 'mech') },
    mech_laser_hit: { when: '레이저가 적 몸에 닿는 순간 — 발사음 바로 뒤, 같은 빈도로 겹침', len: [0.08, 0.3],
        run: basicScene('mech', 'mech') },
    mech_fist_hit: { when: '거대로봇 주먹 팔 기본 공격이 적을 칠 때 · 다리 궤도 돌진에 부딪칠 때', len: [0.15, 0.5],
        run: basicScene('mech', 'mechFist', { arm: 'fist', melee: true }) },
    mech_missile_launch: { when: '미사일 팔·유도 미사일 스킬 — 미사일이 발사구에서 솟는 순간 (여러 발 연달아)', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            const salvo = t0 => {
                s.at(t0, () => s.clip('salvo'));
                for (let i = 0; i < 4; i++) s.at(t0 + 0.25 + i * 0.12, () => {
                    const u = live(us)[i % Math.max(1, live(us).length)];
                    if (!u) return;
                    const m = s.muzzle();
                    s.fx.launchMissile({ x: m.x, bottom: m.b + 20 }, () => u.chest(), () => { s.fx2(M.missileBlast, u.chest().x, u.chest().b); s.hit(u, { kb: 14 }); }, { apex: 90 + i * 15 });
                });
            };
            salvo(0.4);
            salvo(2.4);
            s.end(4.2);
        } },
    mech_missile_blast: { when: '미사일이 적에게 떨어져 터지는 순간 (산탄 팔·엽총 세트도 같은 소리)', len: [0.3, 0.9],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.every(0.4, 0.9, 4, i => {
                const u = live(us)[i % Math.max(1, live(us).length)];
                if (!u) return;
                const m = s.muzzle();
                s.fx.launchMissile({ x: m.x, bottom: m.b + 20 }, () => u.chest(), () => {
                    s.fx2(M.missileBlast, u.chest().x, u.chest().b);
                    s.hit(u, { kb: 16 });
                    s.shake(4, 160);
                    if (i === 3) s.kill(u);
                }, { apex: 110 });
            });
            s.end(4.6);
        } },
    mech_drone_launch: { when: '스웜 드론 스킬 — 드론 세 대가 등에서 솟아오르는 순간', len: [0.3, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            const go = t0 => s.at(t0, () => {
                s.clip('launch');
                for (let i = 0; i < 3; i++) s.fx.launchDrone({ from: { x: HERO_X + 10, b: FB + 170 }, index: i, delay: 0.2,
                    getTarget: () => { const u = live(us)[i % Math.max(1, live(us).length)]; return u ? u.chest() : null; },
                    onHit: () => { const u = live(us)[i % Math.max(1, live(us).length)]; if (u) s.hit(u, { kb: 16 }); } });
            });
            go(0.3);
            go(3.0);
            s.end(5.6);
        } },
    mech_drone_blast: { when: '드론이 적에게 돌진해 자폭하는 순간 (세 번 연달아)', len: [0.3, 0.9],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.3, () => {
                s.clip('launch');
                for (let i = 0; i < 3; i++) s.fx.launchDrone({ from: { x: HERO_X + 10, b: FB + 170 }, index: i, delay: 0.2,
                    getTarget: () => { const u = us[i]; return u && !u.dead ? u.chest() : { x: SLOTS[i], b: FB + 50 }; },
                    onHit: () => { if (us[i]) { s.hit(us[i], { kb: 18 }); s.kill(us[i]); } } });
            });
            s.end(4.2);
        } },
    mech_laser_big: { when: '충전 레이저·궤도 폭격 같은 큰 한 방 — 기 모은 뒤 굵은 광선이 터지는 순간', len: [0.8, 2.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.3, () => s.clip('beam'));
            s.at(1.0, () => {
                const m = s.muzzle();
                s.fx2(M.laserBig, m.x, m.b, { to: [W, m.b - 10] });
                s.shake(8, 600);
                s.hitStop(0.06);
                us.forEach((u, i) => s.at(s.time + 0.05 + i * 0.05, () => { s.hit(u, { kb: 26, dmg: 880, crit: i === 0 }); }));
                s.at(s.time + 0.5, () => us.forEach(u => s.kill(u)));
            });
            s.end(3.6);
        } },
    mech_land: { when: '출격 점프 뒤 착지 (전투 시작 · 점프 스킬) — 땅이 울리는 순간', len: [0.4, 1.2],
        run: async s => {
            await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.3, () => s.clip('jump'));
            s.at(3.0, () => s.clip('jump'));
            s.end(5.4);
        } },
    mech_thrust: { when: '점프·돌진 동작에서 등 로켓이 분사되는 순간 (점프 이륙)', len: [0.3, 1.0],
        run: async s => {
            await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.3, () => s.clip('jump'));
            s.at(2.4, () => s.clip('dash') || s.clip('rush'));
            s.end(4.6);
        } },
    giant_step: { when: '거대 캐릭터가 걸을 때 발이 땅에 닿는 순간 (사람 크기 캐릭터는 같은 소리를 작고 높게)', len: [0.15, 0.5],
        run: async s => {
            await field(s, { hero: 'mech', mode: 'walk', steps: true });
            s.walkBg = true;
            s.at(3.2, () => s.setHero('frost', { mode: 'walk' }));
            s.at(3.2, () => s.note('사람 크기 캐릭터 (같은 소리 × 0.45 크기 · 1.5배 높게)'));
            s.end(6.0);
        } },
    charge_up: { when: '기 모으기 — 충전 레이저·레일건 충전, 오버드라이브 (적이 기 모을 때도 씀)', len: [0.6, 1.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.3, () => { s.clip('rail'); s.sfx('charge_up'); s.fx2(ST.railCharge && quiet(ST.railCharge), s.muzzle().x, s.muzzle().b); });
            s.at(1.5, () => { const m = s.muzzle(); s.fx2(quiet(ST.railShot) || quiet(M.laser), m.x, m.b, { to: [W, m.b] }); us.forEach(u => s.hit(u, { kb: 18 })); });
            s.end(3.6);
        } },
    // =================== 거대괴수 ===================
    kaiju_bite: { when: '거대괴수 기본 공격 — 턱이 닫히며 적을 물어뜯는 순간 (전투 군견 물기도 빌려 씀)', len: [0.15, 0.5],
        run: basicScene('kaiju', 'kaiju', { melee: true }) },
    kaiju_roar: { when: '대지 포효 스킬 — 포효하며 충격파가 퍼지는 순간 (배경음이 잠깐 낮아짐)', len: [1.0, 2.5],
        run: async s => {
            const us = await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.at(0.4, () => s.cast('roar', 0.5, () => {
                const h = s.hero();
                s.fx2(K.roarBurst, HERO_X + 80, h.b + 30);
                s.shake(9, 700);
                us.forEach(u => { s.hit(u, { kb: 26 }); u.status = 'stun'; });
            }));
            s.end(4.0);
        } },
    kaiju_spore: { when: '포자 장판 — 독 포자가 적 위에서 틱마다 퍼지는 순간 (작고 잦음)', len: [0.15, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.every(0.3, 0.5, 8, i => { us.forEach(u => { if (!u.dead) { s.fxOn(K.sporeTick, u); s.hit(u, { kb: 1, dmg: 24 }); } }); });
            s.end(4.6);
        } },
    kaiju_egg_lay: { when: '산란 스킬 — 알이 땅에 떨어지는 순간', len: [0.3, 0.8],
        run: async s => {
            await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.at(0.4, () => { s.clip('lay'); s.fx.addEgg(HERO_X + 140, 1.6, () => {}); });
            s.at(1.0, () => s.fx.addEgg(HERO_X + 200, 1.8, () => {}));
            s.end(4.2);
        } },
    kaiju_egg_hatch: { when: '알이 깨지고 새끼 괴수가 나오는 순간', len: [0.3, 0.9],
        run: async s => {
            await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.at(0.2, () => { s.clip('lay'); s.fx.addEgg(HERO_X + 150, 1.2, () => {}); s.fx.addEgg(HERO_X + 210, 1.6, () => {}); });
            s.end(4.0);
        } },
    kaiju_regen: { when: '재생 — 몸에 초록 기운이 돌며 체력이 차는 순간 (길게 은은히)', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.every(0.4, 1.4, 3, () => { const h = s.hero(); s.fx2(K.regen, HERO_X + 30, FB); s.num({ x: HERO_X, b: h.top }, '+120', false, '#7dff6a'); });
            s.end(4.6);
        } },
    kaiju_breath: { when: '멸망의 숨결 필살기 — 입에서 초록 열선을 4초간 뿜는 순간', len: [1.5, 4.0],
        run: async s => {
            await field(s, { hero: 'kaiju', foes: ZFOES[2] });
            s.at(0.3, () => runKit(s, 'kjDoomBeam'));
            s.end(5.6);
        } },
    // =================== 타락 히어로 ===================
    hero_slash_hit: { when: '타락 히어로 대검이 가까운 적을 벨 때 (회오리 세트도 같은 소리)', len: [0.15, 0.45],
        run: basicScene('hero', 'heroSlash', { melee: true }) },
    hero_wave: { when: '타락 히어로 기본 공격 — 칼을 휘둘러 어둠 파동이 날아가는 순간', len: [0.25, 0.7],
        run: basicScene('hero', 'heroWave', { killAt: 0 }) },
    hero_wave_hit: { when: '어둠 파동이 적을 지나며 맞히는 순간 (여러 마리 연달아)', len: [0.1, 0.35],
        run: basicScene('hero', 'heroWave', { killAt: 0 }) },
    hero_orb: { when: '암흑 구체 — 손에서 보라 구체가 포물선으로 날아가는 순간', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'hero', foes: ZFOES[3] });
            s.every(0.4, 0.9, 4, i => {
                const u = live(us)[i % Math.max(1, live(us).length)];
                if (!u) return;
                s.clip('cast');
                const m = s.muzzle();
                s.fx.launchOrb({ x: m.x, bottom: m.b }, () => u.chest(), HERO_ORB.color, HERO_ORB.dur, () => { s.fx2(quiet(ST.orbBlast) || quiet(HV.waveHit), u.chest().x, u.chest().b); s.hit(u); });
            });
            s.end(4.4);
        } },
    hero_cast: { when: '흑마법 시전 — 마법진을 펼치고 힘을 해방하는 순간', len: [0.5, 1.2],
        run: async s => {
            await field(s, { hero: 'hero', foes: ZFOES[3] });
            s.at(0.3, () => s.cast('cast', 0.6, () => s.fx2(HV.castRelease, HERO_X + 30, FB)));
            s.at(2.4, () => s.cast('raise', 0.6, () => s.fx2(HV.castRelease, HERO_X + 30, FB)));
            s.end(4.4);
        } },
    hero_curse_tick: { when: '저주 장판 위 적이 0.5초마다 피해를 입는 순간 (작고 잦음)', len: [0.1, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'hero', foes: ZFOES[3], slots: NEAR });
            s.at(0.2, () => s.cast('cast', 0.5, () => {}));
            s.every(0.8, 0.5, 8, () => us.forEach(u => { u.status = 'curse'; s.fxOn(HV.curseTick, u, true); s.hit(u, { kb: 0, dmg: 18 }); }));
            s.end(5.0);
        } },
    hero_curse_nova: { when: '저주 폭발 — 저주가 한꺼번에 터지는 큰 순간 (심판 세트·블랙홀 끝도 같은 소리)', len: [0.8, 2.0],
        run: async s => {
            const us = await field(s, { hero: 'hero', foes: ZFOES[3], slots: NEAR });
            s.at(0.3, () => s.cast('raise', 0.6, () => {
                s.fx2(HV.curseNova, 640, FB);
                s.shake(9, 600);
                s.hitStop(0.06);
                us.forEach(u => { s.hit(u, { kb: 24, dmg: 640 }); });
                s.at(s.time + 0.4, () => us.forEach(u => s.kill(u)));
            }));
            s.end(3.8);
        } },
    hero_mind_convert: { when: '세뇌 — 적이 보라빛에 휩싸여 아군으로 돌아서는 순간', len: [0.4, 1.0],
        run: async s => {
            const us = await field(s, { hero: 'hero', foes: ZFOES[3] });
            s.every(0.5, 1.2, 3, i => { const u = us[i]; s.fxOn(HV.mindConvert, u); u.tint = 'hue-rotate(250deg) saturate(1.6) drop-shadow(0 0 6px rgba(190,95,255,0.9))'; });
            s.end(4.6);
        } },
    // =================== 합성괴인 ===================
    chimera_punch: { when: '합성괴인 기본 공격 — 주먹이 적을 치는 순간', len: [0.15, 0.45],
        run: basicScene('chimera', 'chimera', { melee: true }) },
    chimera_claw: { when: '발톱 할퀴기 — 세 줄 할퀸 자국이 나는 순간', len: [0.15, 0.45],
        run: async s => {
            const us = await field(s, { hero: 'chimera', foes: ZFOES[4], slots: MELEE });
            s.every(0.4, 0.8, 5, i => { s.clip('slashes'); const u = live(us)[0]; if (u) s.at(s.time + 0.2, () => { s.fxOn(CV.clawHit, u); s.hit(u, { kb: 10 }); if (i === 2) s.kill(u); }); });
            s.end(4.8);
        } },
    chimera_summon: { when: '졸개 소환 — 바닥 마법진에서 졸개가 튀어나오는 순간', len: [0.5, 1.2],
        run: async s => {
            await field(s, { hero: 'chimera', foes: ZFOES[4] });
            s.at(0.3, () => s.cast('summon', 0.5, () => { [HERO_X + 120, HERO_X + 190].forEach(x => { s.fx2(CV.summon, x, FB); s.foe('minion', x, { fadeIn: 0.3 }); }); }));
            s.end(3.8);
        } },
    chimera_quake: { when: '지진 걸음 — 걸을 때마다 땅이 흔들려 앞쪽 적이 틱 피해 (작게 반복)', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'chimera', foes: ZFOES[4], slots: NEAR });
            s.every(0.3, 0.6, 7, () => { s.fx2(CV.quakeTick, HERO_X + 160, FB); s.shake(2, 120); us.forEach(u => s.hit(u, { kb: 2, dmg: 20 })); });
            s.end(4.8);
        } },
    chimera_slam: { when: '내려찍기 — 양팔로 땅을 내려쳐 균열이 터지는 큰 순간 (많은 세트·적이 빌려 씀)', len: [0.6, 1.6],
        run: async s => {
            const us = await field(s, { hero: 'chimera', foes: ZFOES[4], slots: MELEE });
            s.at(0.3, () => s.cast('smash', 0.55, () => {
                s.fx2(CV.slam, HERO_X + 170, FB);
                s.shake(10, 500);
                s.hitStop(0.07);
                us.forEach(u => s.hit(u, { kb: 28, dmg: 520 }));
            }));
            s.end(3.6);
        } },
    chimera_phase2: { when: '체력 50% 아래 2페이즈 거대화 — 몸이 커지며 실드가 켜지는 순간 (배경음 낮아짐)', len: [1.0, 2.5],
        run: async s => {
            await field(s, { hero: 'chimera', foes: ZFOES[4] });
            s.at(0.4, () => {
                s.clip('transform');
                s.fx2(CV.phase2Burst, HERO_X + 20, FB);
                s.rig.setGiant(1.3);
                s.rig.shieldOn();
                s.shake(8, 600);
                s.slowMo(0.45, 0.8);
            });
            s.end(4.0);
        } },
    rampage_roar: { when: '변신 스킬(삼두 포효 등) — 변신하며 내지르는 포효 (배경음 낮아짐)', len: [1.0, 2.5],
        run: async s => {
            await field(s, { hero: 'chimera', foes: ZFOES[4] });
            s.at(0.4, () => {
                s.clip('transform');
                s.sfx('rampage_roar', { vol: 0.7 });
                s.fx2(quiet(ST.adrenaline) || quiet(CV.phase2Burst), HERO_X + 20, FB);
                s.rig.setGiant(1.2);
                s.shake(7, 500);
            });
            s.end(3.8);
        } },
    // =================== 심연의 길잡이 ===================
    diver_jet: { when: '심연의 길잡이 기본 공격 — 방수포 고압 물줄기가 적을 꿰뚫는 순간', len: [0.2, 0.6],
        run: basicScene('diver', 'diver') },
    diver_anchor_throw: { when: '앵커 스킬 — 사슬 달린 닻을 던지는 순간', len: [0.3, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'diver', foes: ZFOES[5] });
            const go = (t0, u) => s.at(t0, () => {
                s.clip('anchor');
                s.fx.launchChain(() => s.muzzle(), () => u.chest(), { onHook: () => s.hit(u, { kb: 0 }), onDone: () => {} });
            });
            go(0.3, us[2]);
            go(2.4, us[1]);
            s.end(4.6);
        } },
    diver_anchor_hit: { when: '닻이 적에게 꽂히는 순간 (그 뒤 끌어옴)', len: [0.15, 0.5],
        run: async s => {
            const us = await field(s, { hero: 'diver', foes: ZFOES[5] });
            const go = (t0, u) => s.at(t0, () => {
                s.clip('anchor');
                s.fx.launchChain(() => s.muzzle(), () => u.chest(), {
                    onHook: () => { s.fxOn(DV.anchorHook, u); s.hit(u, { kb: 0 }); },
                    onDone: () => {} });
                s.at(s.time + 0.3, () => { u.vx = -900; s.at(s.time + 0.35, () => { u.vx = 0; }); });
            });
            go(0.3, us[2]);
            go(2.4, us[1]);
            s.end(4.6);
        } },
    diver_surge: { when: '고압 분사 물결 — 앞쪽에 큰 물결이 솟아 밀어내는 순간', len: [0.6, 1.5],
        run: async s => {
            const us = await field(s, { hero: 'diver', foes: ZFOES[5], slots: NEAR });
            s.at(0.4, () => s.cast('cast', 0.45, () => { s.fx2(DV.surgeBurst, HERO_X + 190, FB); s.shake(6, 400); us.forEach(u => s.hit(u, { kb: 28 })); }));
            s.end(3.6);
        } },
    diver_hands: { when: '심연의 손 필살기 — 바닥에서 유령 손이 솟아 움켜쥐는 순간 (배경음 낮아짐)', len: [1.2, 3.0],
        run: async s => {
            const us = await field(s, { hero: 'diver', foes: ZFOES[5], slots: NEAR });
            s.at(0.4, () => s.cast('cast', 0.5, () => { s.fx2(DV.hands, 640, FB); s.shake(7, 900); us.forEach(u => { u.status = 'stun'; s.hit(u, { kb: 0, dmg: 420 }); }); }));
            s.end(4.4);
        } },
    // =================== 봉합 성녀 ===================
    saint_needle: { when: '봉합 성녀 기본 공격 — 주사 바늘이 쏘아지는 순간 (잦음)', len: [0.08, 0.3],
        run: basicScene('saint', 'saint') },
    saint_stitch: { when: '바늘이 꽂혀 실로 꿰매는 순간 (발사 바로 뒤)', len: [0.1, 0.35],
        run: basicScene('saint', 'saint') },
    saint_seal: { when: '생명 봉인 스킬 — 적 발밑에 붉은 봉인진이 열리는 순간', len: [0.6, 1.5],
        run: async s => {
            const us = await field(s, { hero: 'saint', foes: ZFOES[6], slots: NEAR });
            s.at(0.4, () => s.cast('cast', 0.5, () => { s.fx2(SV.sealOpen, 640, FB); us.forEach(u => s.hit(u, { kb: 0, dmg: 160 })); }));
            s.end(3.8);
        } },
    saint_revive: { when: '억지 부활 필살기 — 쓰러진 자리에서 꿰매어 일으켜 세우는 순간 (배경음 낮아짐)', len: [1.2, 3.0],
        run: async s => {
            await field(s, { hero: 'saint', foes: ZFOES[6] });
            s.at(0.4, () => s.cast('cast', 0.5, () => { s.fx2(SV.reviveCall, HERO_X + 30, FB); s.flash('#ff2a4a', 300, 0.3); }));
            s.end(4.2);
        } },
    // =================== 서리의 무희 ===================
    frost_fan: { when: '서리의 무희 기본 공격 — 부채에서 서리 초승달이 날아가는 순간', len: [0.2, 0.55],
        run: basicScene('frost', 'frost', { killAt: 0 }) },
    frost_hit: { when: '서리 초승달이 적을 맞히는 순간 (한 번에 두 마리까지)', len: [0.08, 0.3],
        run: basicScene('frost', 'frost', { killAt: 0 }) },
    frost_freeze: { when: '냉기가 쌓여 적이 얼어붙는 순간', len: [0.3, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'frost', foes: ZFOES[8] });
            s.every(0.5, 1.0, 3, i => { const u = us[i]; s.fxOn(FV.freeze, u, true); u.status = 'frozen'; u.idle = true; });
            s.end(4.2);
        } },
    frost_shatter: { when: '얼어 있는 적이 깨지는 순간 (산산조각)', len: [0.25, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'frost', foes: ZFOES[8] });
            us.forEach(u => { u.status = 'frozen'; });
            s.every(0.6, 0.8, 3, i => { const u = us[i]; s.fxOn(FV.shatter, u); s.kill(u, { sound: false }); });
            s.end(3.8);
        } },
    frost_crescent: { when: '초승달 참격 스킬 — 큰 얼음 초승달이 쓸고 지나가는 순간', len: [0.5, 1.2],
        run: async s => {
            const us = await field(s, { hero: 'frost', foes: ZFOES[8], slots: NEAR });
            s.at(0.4, () => s.cast('crescent', 0.4, () => { s.fx2(FV.crescentBurst, HERO_X + 200, FB + 60); us.forEach(u => s.hit(u, { kb: 18, dmg: 380 })); }));
            s.end(3.4);
        } },
    frost_blizzard: { when: '눈보라 춤 스킬 — 회전하며 눈보라가 몰아치는 순간', len: [0.8, 2.0],
        run: async s => {
            const us = await field(s, { hero: 'frost', foes: ZFOES[8], slots: NEAR });
            s.at(0.4, () => s.cast('spin', 0.3, () => { s.fx2(FV.blizzardOpen, 600, FB); us.forEach(u => { u.status = 'frozen'; s.hit(u, { kb: 6 }); }); }));
            s.end(4.0);
        } },
    frost_eternal: { when: '영원한 안식 필살기 — 거대한 얼음이 전장을 덮는 순간 (배경음 낮아짐)', len: [1.5, 3.5],
        run: async s => {
            const us = await field(s, { hero: 'frost', foes: ZFOES[8], slots: NEAR });
            s.at(0.4, () => s.cast('raise', 0.5, () => { s.fx2(FV.eternalCall, 640, FB); s.shake(6, 900); us.forEach(u => { u.status = 'frozen'; s.hit(u, { kb: 0, dmg: 900 }); }); }));
            s.end(4.6);
        } },
    // =================== 뒤틀린 인형사 ===================
    doll_snip: { when: '뒤틀린 인형사 기본 공격 — 거대 가위가 싹둑 자르는 순간', len: [0.12, 0.4],
        run: basicScene('doll', 'doll', { melee: true }) },
    doll_xcut: { when: '가위 X자 베기 스킬 — X자로 두 번 베는 순간', len: [0.3, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'doll', foes: ZFOES[7], slots: MELEE });
            s.at(0.4, () => s.cast('xcut', 0.35, () => { s.fxOn(DL.xcut, us[0]); us.slice(0, 2).forEach(u => s.hit(u, { kb: 16, dmg: 420 })); }));
            s.at(2.2, () => s.cast('xcut', 0.35, () => { s.fxOn(DL.xcut, us[1]); s.hit(us[1], { kb: 16, dmg: 420 }); }));
            s.end(4.0);
        } },
    doll_summon: { when: '토끼 인형 소환 — 인형이 떨어져 착지하는 순간', len: [0.3, 0.8],
        run: async s => {
            await field(s, { hero: 'doll', foes: ZFOES[7] });
            s.at(0.4, () => s.cast('cast', 0.4, () => [HERO_X + 120, HERO_X + 180].forEach((x, i) => s.at(s.time + i * 0.25, () => { s.fx2(DL.dollDrop, x, FB); s.foe('rabbit', x, { fadeIn: 0.15 }); }))));
            s.end(3.6);
        } },
    doll_burst: { when: '토끼 인형이 적에게 달려가 터지는 순간', len: [0.25, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'doll', foes: ZFOES[7] });
            const r = [s.foe('rabbit', HERO_X + 120), s.foe('rabbit', HERO_X + 170)];
            r.forEach(b => { b.vx = 260; b.idle = false; });
            r.forEach((b, i) => s.at(1.4 + i * 0.4, () => { b.vx = 0; s.fx2(DL.dollBurst, b.x, FB + 40); b.dead = true; b.deadT = 0.4; s.hit(us[i], { kb: 18 }); }));
            s.end(3.8);
        } },
    doll_strings: { when: '인형 실 필살기 — 실이 적을 꿰어 조종하는 순간 (배경음 낮아짐)', len: [1.2, 3.0],
        run: async s => {
            const us = await field(s, { hero: 'doll', foes: ZFOES[7], slots: NEAR });
            s.at(0.4, () => s.cast('strings', 0.5, () => { s.fx2(DL.stringsCall, 640, FB); us.forEach(u => { u.tint = 'drop-shadow(0 0 6px rgba(90,230,240,0.9))'; s.hit(u, { kb: 0, dmg: 300 }); }); }));
            s.end(4.4);
        } },
    // =================== 철거의 설계자 ===================
    arch_basic_hit: { when: '[새로] 철거의 설계자 기본 공격 — 공압 드릴이 적을 때리는 순간 (지금은 전용 소리 없음)', len: [0.12, 0.45],
        run: async s => {
            const us = await field(s, { hero: 'architect', mode: 'attack', foes: ZFOES[9], slots: MELEE });
            autoFire(s, us, u => { s.fxOn(ARCH_HIT, u); s.hit(u, { kb: 10 }); s.sfx('arch_basic_hit'); });
        } },
    arch_drill: { when: '기초 파쇄 스킬 — 드릴을 땅에 박아 앞쪽 지면이 다이너마이트처럼 터지는 순간', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'architect', foes: ZFOES[9], slots: MELEE });
            s.at(0.4, () => runKit(s, 'arFoundation'));
            s.end(3.6);
        } },
    arch_scaffold: { when: '강제 재건 스킬 — 철골 바리케이드가 땅에서 솟는 순간', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'architect', foes: ZFOES[9] });
            s.at(0.4, () => runKit(s, 'arRebuild'));
            s.end(3.6);
        } },
    arch_crane: { when: '철거 명령 필살기 — 크레인 철구가 세 번 내리치는 순간 (한 번마다)', len: [0.5, 1.3],
        run: async s => {
            await field(s, { hero: 'architect', foes: ZFOES[9] });
            s.at(0.4, () => runKit(s, 'arDemolish'));
            s.end(4.2);
        } },
    // =================== 침묵의 방송자 ===================
    bc_basic_hit: { when: '[새로] 침묵의 방송자 기본 공격 — 음파가 적을 때리는 순간 (지금은 전용 소리 없음)', len: [0.12, 0.45],
        run: async s => {
            const us = await field(s, { hero: 'broadcaster', mode: 'attack', foes: ZFOES[10] });
            autoFire(s, us, u => { s.fxOn(BC_HIT, u); s.hit(u, { kb: 6 }); s.sfx('bc_basic_hit'); });
        } },
    bc_burst: { when: '공명 파열 스킬 — 소리굽쇠를 울려 음파 고리 3겹이 앞으로 퍼지는 순간', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'broadcaster', foes: ZFOES[10], slots: NEAR });
            s.at(0.4, () => runKit(s, 'bcBurst'));
            s.end(3.6);
        } },
    bc_dome: { when: '정적의 장막 스킬 — 분홍 반구 장막이 덮이는 순간', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'broadcaster', foes: ZFOES[10], slots: NEAR });
            s.at(0.4, () => runKit(s, 'bcDome'));
            s.end(3.6);
        } },
    bc_emergency: { when: '긴급 방송 필살기 — 도시 스피커를 장악해 음파 폭발 3번 (배경음 낮아짐)', len: [1.2, 3.0],
        run: async s => {
            await field(s, { hero: 'broadcaster', foes: ZFOES[10], slots: NEAR });
            s.at(0.4, () => runKit(s, 'bcEmergency'));
            s.end(4.4);
        } },

    // =================== 전투 공용 층 ===================
    hit_start_slash: { when: '[새로] 타격 시작 층 · 베기 — 칼·가위·발톱이 닿는 첫 0.05초 (몸통·꼬리 층과 겹쳐 한 소리)', len: [0.03, 0.15],
        run: layerScene('hero', 'heroSlash', ['hit_start_slash', 'hit_body_mid', 'hit_tail_debris'], { melee: true, mute: ['hero_slash_hit'] }) },
    hit_start_blunt: { when: '[새로] 타격 시작 층 · 때리기 — 주먹·몽둥이·철구가 닿는 첫 순간', len: [0.03, 0.15],
        run: layerScene('chimera', 'chimera', ['hit_start_blunt', 'hit_body_heavy', 'hit_tail_debris'], { melee: true, mute: ['chimera_punch'] }) },
    hit_start_pierce: { when: '[새로] 타격 시작 층 · 찌르기 — 바늘·작살·화살이 꽂히는 첫 순간', len: [0.03, 0.15],
        run: layerScene('saint', 'saint', ['hit_start_pierce', 'hit_body_light', 'hit_tail_metal'], { mute: ['saint_needle', 'saint_stitch'], delay: 0.16 }) },
    hit_start_energy: { when: '[새로] 타격 시작 층 · 에너지 — 레이저·음파·마법이 닿는 첫 순간', len: [0.03, 0.15],
        run: layerScene('mech', 'mech', ['hit_start_energy', 'hit_body_light', 'hit_tail_energy'], { mute: ['mech_laser_hit'] }) },
    hit_body_light: { when: '[새로] 타격 몸통 층 · 가벼움 — 작은 공격의 몸통 (빠르고 짧게)', len: [0.08, 0.25],
        run: layerScene('frost', 'frost', ['hit_body_light', 'hit_start_energy', 'hit_tail_energy'], { mute: ['frost_hit'], killAt: 0, delay: 0.2 }) },
    hit_body_mid: { when: '[새로] 타격 몸통 층 · 중간 — 보통 기본 공격의 몸통', len: [0.1, 0.35],
        run: layerScene('hero', 'heroSlash', ['hit_body_mid', 'hit_start_slash', 'hit_tail_debris'], { melee: true, mute: ['hero_slash_hit'] }) },
    hit_body_heavy: { when: '[새로] 타격 몸통 층 · 무거움 — 큰 주먹·내려찍기의 몸통 (저음은 휴대폰에서 안 들리니 중음역 두께로)', len: [0.15, 0.5],
        run: layerScene('mech', 'mechFist', ['hit_body_heavy', 'hit_start_blunt', 'hit_tail_metal'], { arm: 'fist', melee: true, mute: ['mech_fist_hit'] }) },
    hit_tail_metal: { when: '[새로] 타격 꼬리 층 · 금속 울림 — 기계·갑옷 적을 친 뒤 남는 울림', len: [0.2, 0.7],
        run: layerScene('mech', 'mechFist', ['hit_tail_metal', 'hit_start_blunt', 'hit_body_heavy'], { arm: 'fist', melee: true, mute: ['mech_fist_hit'], foes: ['riot', 'exo', 'riot'] }) },
    hit_tail_debris: { when: '[새로] 타격 꼬리 층 · 파편 — 맞은 뒤 부스러기·잔해가 흩어지는 꼬리', len: [0.2, 0.7],
        run: layerScene('chimera', 'chimera', ['hit_tail_debris', 'hit_start_blunt', 'hit_body_heavy'], { melee: true, mute: ['chimera_punch'] }) },
    hit_tail_energy: { when: '[새로] 타격 꼬리 층 · 에너지 잔향 — 에너지 공격 뒤 지지직 남는 꼬리', len: [0.2, 0.7],
        run: layerScene('mech', 'mech', ['hit_tail_energy', 'hit_start_energy', 'hit_body_light'], { mute: ['mech_laser_hit'] }) },
    hit_crit: { when: '[새로] 치명타 층 — 20% 확률 치명타에만 더해지는 날카로운 한 겹 (지금은 치명타 소리가 없음)', len: [0.1, 0.4],
        run: layerScene('hero', 'heroSlash', [], { melee: true, crit: true, mute: [] }) },   // 지금 타격음(대검 베기) 위에 치명타 층만
    kill_small: { when: '[새로] 처치 · 소형 — 보병 같은 작은 적이 쓰러질 때 (지금은 enemy_die 하나로 모두)', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', mode: 'attack', foes: ['conscript', 'taser', 'conscript'] });
            s.onKill = () => s.sfx('kill_small');     // 처치 순간 enemy_die 대신 이 소리
            autoFire(s, us, SHOT.mech(s), { killAt: 2, dieSound: false });
        } },
    kill_large: { when: '[새로] 처치 · 대형 — 전차·워커 같은 큰 적이 무너질 때', len: [0.5, 1.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ['exo', 'spiderwalker'], slots: [700, 900] });
            s.every(0.4, 0.5, 4, i => { const u = us[i % 2]; const m = s.muzzle(); s.fx.launchMissile({ x: m.x, bottom: m.b + 20 }, () => u.chest(), () => { s.fx2(quiet(M.missileBlast), u.chest().x, u.chest().b); s.hit(u, { kb: 8 }); }, { apex: 100 }); });
            [0, 1].forEach(i => s.at(2.6 + i * 0.9, () => {
                const u = us[i];
                s.fx2(quiet(BT.baseBlast), u.x, FB + 60, { scale: 1.2 });
                s.shake(8, 400);
                s.kill(u, { sound: false });
                s.sfx('kill_large');
            }));
            s.end(4.8);
        } },
    kill_boss: { when: '[새로] 처치 · 보스 — 보스가 쓰러지는 마지막 순간 (가장 큰 처치음, 배경음 낮아짐)', len: [1.5, 4.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, boss: true });
            const b = s.foe('wmdalpha', 980, { fadeIn: 0.01 });
            s.every(0.3, 0.35, 5, i => { s.fx2(quiet(BT.baseBlast), b.x - 60 + i * 30, FB + 60 + (i % 3) * 50); s.hit(b, { kb: 4, num: false }); });
            s.at(2.2, () => {
                s.fx2(quiet(BT.baseFinale), b.x, FB, { scale: 1.2 });
                s.flash('#fff3d0', 420, 0.9);
                s.shake(16, 900);
                s.slowMo(0.3, 1.4);
                s.kill(b, { sound: false });
                s.sfx('kill_boss');
                s.stamp('BOSS DOWN', 'WMD-알파 격파', 'is-gold is-big', 1800);
            });
            s.end(4.8);
        } },
    enemy_die: { when: '적이 쓰러질 때 (모든 적 공통 — 가장 자주 나는 소리 중 하나)', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', mode: 'attack', foes: ZFOES[1].concat(ZFOES[1]), slots: [690, 780, 870, 960, 1050, 1140] });
            autoFire(s, us, SHOT.mech(s), { killAt: 2, until: 5.2 });
        } },
    generic_slash: { when: '리그 없는 캐릭터의 기본 베기 · 그림자 집행자 공격 (공용 베기)', len: [0.12, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'hero', mode: 'attack', foes: ZFOES[3], slots: MELEE });
            autoFire(s, us, u => { s.fxOn(G.slashHit, u); s.hit(u, { kb: 10 }); });
        } },
    player_hit: { when: '주인공이 맞을 때 (0.4초에 한 번까지 — 많이 맞아도 뭉개지지 않게)', len: [0.1, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1], slots: NEAR, hud: true });
            s.every(0.4, 0.55, 7, i => { const u = us[i % 3]; foeOrb(s, u, '90, 230, 255', () => { heroHit(s); s.fx2(IMPACT('255, 90, 90'), HIT_X, 120); }); });
            s.end(4.8);
        } },
    shield_on: { when: '실드가 켜질 때 (2페이즈·가시 갑옷·피의 갑옷 등)', len: [0.4, 1.0],
        run: async s => {
            await field(s, { hero: 'mech', foes: ZFOES[1] });
            s.at(0.4, () => { s.clip('guard'); s.rig.shieldOn(); s.sfx('shield_on'); });
            s.at(2.4, () => { s.rig.shieldOff(); });
            s.at(2.6, () => { s.rig.shieldOn('255, 80, 110'); s.fx2(ST.bloodOn, HERO_X + 20, FB); });
            s.end(4.4);
        } },
    shield_hit: { when: '실드가 공격을 막을 때', len: [0.12, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1], slots: NEAR });
            s.at(0.1, () => s.rig.shieldOn());
            s.every(0.5, 0.45, 8, i => foeOrb(s, us[i % 3], '255, 200, 60', () => { s.rig.shieldHit(); s.sfx('shield_hit'); }));
            s.end(4.6);
        } },
    shield_break: { when: '실드가 깨질 때 · 과부하(내구도 0) · EMP에 맞을 때', len: [0.4, 1.2],
        run: async s => {
            const us = await field(s, { hero: 'mech', foes: ZFOES[1], slots: NEAR, hud: true });
            s.at(0.1, () => s.rig.shieldOn());
            s.every(0.4, 0.4, 4, i => foeOrb(s, us[i % 3], '255, 200, 60', () => { s.rig.shieldHit(); s.sfx('shield_hit'); }));
            s.at(2.2, () => { s.rig.breakShield(); s.sfx('shield_break'); s.shake(5, 300); });
            s.at(3.6, () => s.director.overload(3));
            s.end(5.4);
        } },
    base_blast: { when: '거점(건물)이 맞을 때 · 연쇄 폭발 (작은 폭발이 연달아)', len: [0.3, 0.9],
        run: async s => {
            await field(s, { hero: 'mech', mode: 'attack' });
            const b = s.base('st1_fort', 820);
            let n = 0;
            s.onFire = () => { const c = s.baseCenter(b); const m = s.muzzle(); s.fx2(quiet(M.laser), m.x, m.b, { to: [c.x, c.b] }); if (n++ % 2 === 0) { s.fx2(BT.baseBlast, c.x + rand(-50, 50), c.b + rand(-40, 60)); b.flash = 1; b.shake = 0.4; } };
            s.at(1.4, () => { if (!n) s.every(s.time, 0.4, 7, () => s.onFire?.()); });
            s.at(4.2, () => { s.onFire = null; s.rig.setMode('idle'); });
            s.end(5.0);
        } },
    base_destroyed: { when: '거점이 무너지는 마지막 대폭발 (중간 요새 · 최종 기지, 배경음 낮아짐)', len: [1.2, 3.0],
        run: async s => {
            await field(s, { hero: 'mech', hud: true });
            const b = s.base('st1_fort', 820);
            s.at(0.4, () => {
                b.shake = 1;
                s.director.baseDestroyed({ x: b.x, size: { w: b.art.w, h: b.art.h } }, false);
                s.at(s.time + 0.9, () => { b.state = 2; });
            });
            s.end(4.6);
        } },

    // =================== 적 공용 공격 (새로) ===================
    en_melee: { when: '[새로] 적 근접 공격 — 몽둥이·칼·방패로 주인공을 칠 때 (지금은 캐릭터 소리를 빌려 씀)', len: [0.12, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ['conscript', 'riot', 'thug'], slots: [400, 470, 540] });
            s.every(0.4, 0.6, 7, i => { const u = us[i % 3]; s.foeAttack(u); s.at(s.time + 0.25, () => { s.sfx('en_melee'); s.fx2(quiet(G.slashHit), HIT_X + 20, 120, { scale: 0.7 }); heroHit(s); }); });
            s.end(4.8);
        } },
    en_gun: { when: '[새로] 적 총 — 보병·용병·저격 경찰이 총을 쏠 때 (아주 잦음)', len: [0.05, 0.25],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 2, foes: ['merc', 'conscript', 'merc'] });
            s.every(0.3, 0.32, 13, i => { const u = us[i % 3]; s.foeAttack(u); const from = { x: u.x - 30, b: FB + u.h * 0.62 };
                s.fx2(MUZZLE('255, 220, 140'), from.x, from.b); s.fx2(TRACER('255, 230, 160'), from.x, from.b, { to: [HIT_X, 120] }); s.sfx('en_gun', { x: (u.x / W) * 2 - 1 }); if (i % 2) heroHit(s, { dmg: 12 }); });
            s.end(4.8);
        } },
    en_cannon: { when: '[새로] 적 포·로켓 — 로켓 보병·함포·전차가 발사할 때', len: [0.25, 0.8],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ['rocket', 'rocket', 'rocket'] });
            s.every(0.4, 1.1, 4, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('en_cannon');
                s.fx.vfx.launchMissile({ from: [u.x - 20, H - (FB + 70)], to: () => [HIT_X, H - 120], apex: 60, color: '255, 170, 60',
                    onArrive: () => { s.fx2(quiet(Z.rocketBlast) || quiet(M.missileBlast), HIT_X, 120); heroHit(s); s.shake(4, 200); } }); });
            s.end(5.0);
        } },
    en_shot: { when: '[새로] 적 화살·작살·저격 — 곧게 날아와 꽂히는 한 발', len: [0.1, 0.4],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 5, foes: ['marine', 'hunter', 'marine'] });
            s.every(0.4, 0.8, 6, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('en_shot');
                s.fx.vfx.launchNeedle({ from: [u.x - 20, H - (FB + 60)], to: () => [HIT_X, H - 120], color: '210, 210, 220', dur: 0.2, onArrive: () => { s.fx2(quiet(Z.arrowHit), HIT_X, 120); heroHit(s); } }); });
            s.end(5.0);
        } },
    en_explosive: { when: '[새로] 적 폭발물 — 수류탄·다이너마이트·수뢰가 터질 때', len: [0.4, 1.2],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 7, foes: ['grenadier', 'dynamite', 'grenadier'] });
            s.every(0.4, 1.0, 4, i => { const u = us[i % 3]; s.foeAttack(u);
                s.fx.vfx.launchMissile({ from: [u.x - 10, H - (FB + 80)], to: () => [HIT_X + rand(-20, 40), H - (FB + 10)], apex: 180, dur: 0.75, color: '120, 120, 120',
                    onArrive: () => { s.fx2(quiet(M.missileBlast), HIT_X + 20, FB + 30, { scale: 1.2 }); s.sfx('en_explosive'); heroHit(s); s.shake(6, 300); } }); });
            s.end(5.0);
        } },
    en_fire: { when: '[새로] 적 화염 — 화염방사병·횃불·끓는 기름 공격', len: [0.4, 1.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 8, foes: ['torch', 'oilthrower', 'torch'], slots: [480, 560, 640] });
            s.every(0.4, 1.2, 4, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('en_fire'); s.fx2(quiet(Z.fireBreath) || quiet(Z.napalmBurst), u.x - 30, FB + 60, { to: [HIT_X, 110] }); s.at(s.time + 0.25, () => heroHit(s)); });
            s.end(5.2);
        } },
    en_electric: { when: '[새로] 적 전기 — 전기 충격병·테이저·EMP 드론', len: [0.2, 0.7],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ['taser', 'empdrone', 'shock'], slots: [480, 620, 760] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('en_electric'); s.fx2(quiet(Z.empZap) || quiet(BT.emp), HIT_X, 120); heroHit(s); });
            s.end(5.0);
        } },
    en_toxic: { when: '[새로] 적 독·산 — 산성액·독가스·오염된 성수를 뿌릴 때', len: [0.3, 0.9],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 2, foes: ['acidmech', 'gassoldier', 'holywater'] });
            s.every(0.4, 1.0, 5, i => { const u = us[i % 3]; s.sfx('en_toxic'); foeOrb(s, u, ACID, () => { s.fx2(quiet(Z.venomSplash), HIT_X + 30, FB + 10); heroHit(s); }, 0.6); });
            s.end(5.2);
        } },
    en_holy: { when: '[새로] 적 성스러운 빛 — 빛의 마법사·전투 신관의 빛 공격', len: [0.3, 1.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['lightmage', 'battlepriest', 'lightmage'] });
            s.every(0.4, 1.0, 5, i => { const u = us[i % 3]; s.sfx('en_holy'); foeOrb(s, u, '255, 230, 140', () => { s.fx2(quiet(Z.arrowHit), HIT_X, 120); heroHit(s); }, 0.5); });
            s.end(5.2);
        } },
    en_sonic: { when: '[새로] 적 음파 — 음파 차단 탑·스피커 드론·우퍼 메카', len: [0.4, 1.2],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 10, foes: ['speakerdrone', 'woofermech', 'sonictower'] });
            s.every(0.4, 1.2, 4, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('en_sonic'); s.fx2(quiet(Z.sonicRing), u.x - 20, FB + 60); s.at(s.time + 0.35, () => heroHit(s)); });
            s.end(5.2);
        } },
    en_machine: { when: '[새로] 적 기계 — 회전톱 드론·불도저·드릴·용접기', len: [0.3, 1.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 2, foes: ['sawdrone', 'dozer', 'welderwalker'], slots: [430, 560, 700] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.at(s.time + 0.2, () => { s.sfx('en_machine'); s.fx2(quiet(Z.chargeImpact), HIT_X + 40, 110, { scale: 0.8 }); heroHit(s); }); });
            s.end(5.0);
        } },
    en_beast: { when: '[새로] 적 짐승 — 군견·융합수·늑대 기사가 물고 할퀼 때', len: [0.15, 0.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ['hound', 'fusionbeast', 'hound'], slots: [420, 500, 580] });
            s.every(0.4, 0.7, 6, i => { const u = us[i % 3]; s.foeAttack(u); s.at(s.time + 0.25, () => { s.sfx('en_beast'); s.fx2(quiet(K.biteHit), HIT_X + 20, 120, { scale: 0.7 }); heroHit(s); }); });
            s.end(4.8);
        } },

    // =================== 구역 적 · 보스 ===================
    zone_arrow: { when: '요새·적 원거리 사격 — 화살·탄이 날아오는 순간 (거점 포탑도 같은 소리)', len: [0.1, 0.4],
        run: async s => {
            await field(s, { hero: 'mech', zone: 3 });
            const b = s.base('st3_fort', 860);
            s.every(0.4, 0.9, 5, () => { s.sfx('zone_arrow', { rate: 1.25, vol: 0.4 }); s.fx.launchOrb({ x: b.x + 40, bottom: 240 }, () => ({ x: HIT_X, b: 120 }), '255, 230, 140', 0.55, () => { s.fx2(Z.arrowHit, HIT_X, 115); heroHit(s); }, null); });
            s.end(5.0);
        } },
    zone_axe: { when: '처형인·악마기사의 대검·도끼 내려찍기', len: [0.3, 0.9],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['executioner', 'demonknight'], slots: [430, 560] });
            s.every(0.5, 1.4, 3, i => { const u = us[i % 2]; s.foeAttack(u); s.at(s.time + 0.35, () => { s.fx2(Z.axeCleave, HIT_X + 45, 100); s.shake(7, 300); heroHit(s); }); });
            s.end(5.0);
        } },
    zone_charge: { when: '강화병·늑대 기사·레킹볼 강타 (돌진해 부딪치는 순간)', len: [0.3, 0.9],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 8, foes: ['wolfknight', 'exo'], slots: [700, 900] });
            us[0].vx = -520; us[0].idle = false;
            s.at(0.6, () => { us[0].vx = 0; s.foeAttack(us[0]); s.fx2(Z.chargeImpact, HIT_X + 45, 100); s.shake(8, 300); heroHit(s); s.rig.react('hurt'); });
            s.at(2.2, () => { us[1].vx = -700; us[1].idle = false; });
            s.at(2.85, () => { us[1].vx = 0; s.foeAttack(us[1]); s.fx2(Z.chargeImpact, HIT_X + 45, 100); s.shake(8, 300); heroHit(s); });
            s.end(4.6);
        } },
    zone_gas: { when: '유독 가스 구역 기믹 — 가스가 뿜어지며 전장이 누렇게 변함 (배경음 낮아짐)', len: [0.8, 2.0],
        run: async s => {
            await field(s, { hero: 'mech', zone: 2, foes: ZFOES[2] });
            s.at(0.5, () => { s.fx2(Z.toxicBurst, 640, FB); s.frame.classList.add('v2-gas'); });
            s.at(3.6, () => s.frame.classList.remove('v2-gas'));
            s.end(4.6);
        } },
    zone_goo: { when: '슬라임 점액이 튀어 바닥에 들러붙는 순간', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 4, foes: ['chimeraslime', 'slime', 'chimeraslime'] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.fx2(Z.gooSplat, HIT_X + 40, FB + 30); heroHit(s); });
            s.end(5.0);
        } },
    zone_heal_holy: { when: '신관·성배가 적을 치유할 때 — 금빛 기운이 오름', len: [0.4, 1.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['zealot', 'battlepriest', 'zealot'] });
            s.every(0.5, 1.1, 4, i => { s.foeAttack(us[1]); const u = us[[0, 2][i % 2]]; s.fx2(Z.holyHeal, u.x, FB); s.num(u.head(), '+80', false, '#ffe27a'); });
            s.end(5.0);
        } },
    zone_hellgate: { when: '대주교 지옥문 — 땅에서 지옥문이 열려 악마병이 나오는 순간', len: [0.6, 1.5],
        run: async s => {
            await field(s, { hero: 'mech', zone: 3, boss: true });
            const boss = s.foe('archbishop', 1020);
            s.at(0.4, () => { s.foeAttack(boss, 'bash'); [760, 880].forEach((x, i) => s.at(s.time + 0.3 + i * 0.4, () => { s.fx2(Z.hellGate, x + 38, FB + 30); s.at(s.time + 0.4, () => s.foe('demon', x, { fadeIn: 0.4 })); })); });
            s.end(4.2);
        } },
    zone_judgment: { when: '심판 기둥 — 예고 원 뒤 하늘에서 빛기둥이 꽂히는 순간 (구역 3 보스 · 종 · 핏빛 파동)', len: [0.6, 1.6],
        run: async s => {
            await field(s, { hero: 'mech', zone: 3, boss: true });
            const boss = s.foe('archbishop', 1020);
            const strike = t0 => { s.at(t0, () => { s.foeAttack(boss); s.fx2(Z.judgmentWarn, HERO_X + 35, FB); }); s.at(t0 + 1.2, () => { s.fx2(Z.heavenPillar, HERO_X + 35, FB); s.shake(6, 300); heroHit(s); }); };
            strike(0.3);
            strike(2.6);
            s.end(5.2);
        } },
    zone_knight: { when: '심연의 문에서 악마기사가 등장할 때 (배경음 낮아짐)', len: [0.8, 2.0],
        run: async s => {
            await field(s, { hero: 'mech', zone: 3, boss: true });
            s.at(0.5, () => { s.fx2(Z.abyssGate, 900, FB + 40); s.flash('#ff1a3c', 300, 0.25); s.at(s.time + 0.6, () => s.foe('demonknight', 880, { fadeIn: 0.5 })); });
            s.end(4.0);
        } },
    zone_mutation: { when: '관장자의 변이 — 적이 부풀어 변이하는 순간 (배경음 낮아짐)', len: [0.8, 2.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 4, boss: true, foes: ['mutant', 'mutant'], slots: [700, 820] });
            const boss = s.foe('oculus', 1040);
            s.at(0.5, () => { s.foeAttack(boss, 'magnet'); s.fx2(Z.mutationBurst, 760, FB + 90); us.forEach(u => { u.scale = 1.35; u.tint = 'hue-rotate(60deg) saturate(1.5)'; }); });
            s.end(4.0);
        } },
    zone_spell_bolt: { when: '마법사 번개 — 노란 구체가 날아와 감전 (작고 잦음)', len: [0.15, 0.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['mage', 'lightmage', 'mage'] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('zone_spell_bolt', { rate: 1.4, vol: 0.5 }); s.fx.launchOrb({ x: u.x + 10, bottom: 110 }, () => ({ x: HIT_X, b: 120 }), '255, 240, 120', 0.36, () => { s.fx2(Z.spellBolt, HIT_X, 120); heroHit(s); }, null); });
            s.end(5.0);
        } },
    zone_spell_fire: { when: '마법사 불 · 네이팜·화염 숨결 (불덩이가 터짐)', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['mage', 'lightmage', 'mage'] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('zone_spell_fire', { rate: 1.4, vol: 0.5 }); s.fx.launchOrb({ x: u.x + 10, bottom: 110 }, () => ({ x: HIT_X, b: 120 }), '255, 140, 40', 0.36, () => { s.fx2(Z.spellFire, HIT_X, 120); heroHit(s); }, null); });
            s.end(5.0);
        } },
    zone_spell_ice: { when: '마법사 얼음 — 얼음 구체가 날아와 둔화', len: [0.15, 0.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 3, foes: ['mage', 'lightmage', 'mage'] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; s.foeAttack(u); s.sfx('zone_spell_ice', { rate: 1.4, vol: 0.5 }); s.fx.launchOrb({ x: u.x + 10, bottom: 110 }, () => ({ x: HIT_X, b: 120 }), '150, 220, 255', 0.36, () => { s.fx2(Z.spellIce, HIT_X, 120); heroHit(s); }, null); });
            s.end(5.0);
        } },
    zone_split: { when: '슬라임이 쓰러지며 작은 슬라임 둘로 갈라지는 순간', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', mode: 'attack', zone: 4, foes: ['chimeraslime', 'chimeraslime', 'chimeraslime'] });
            s.onKill = u => { if (u.scale < 1) return; s.fx2(Z.slimeSplit, u.x, FB + 20); [-34, 34].forEach(d => s.foe('slime', u.x + d, { scale: 0.55, fadeIn: 0.15 })); };
            autoFire(s, us, SHOT.mech(s), { killAt: 2 });
        } },
    zone_spore: { when: '포자 술사의 포자 폭발 — 포자 구름이 터짐', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 4, foes: ['sporecaster', 'sporer', 'sporecaster'] });
            s.every(0.4, 0.9, 5, i => { s.foeAttack(us[i % 3]); s.fx2(Z.sporeBurst, HIT_X + 40, FB + 40); heroHit(s); });
            s.end(5.0);
        } },
    zone_venom: { when: '독 뱉기·독 웅덩이 — 독액이 튀는 순간', len: [0.2, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 2, foes: ['sludge', 'acidmech', 'toxicdiver'] });
            s.every(0.4, 0.9, 5, i => { const u = us[i % 3]; foeOrb(s, u, ACID, () => { s.fx2(Z.venomSplash, HIT_X + 30, FB + 10); heroHit(s); }, 0.55); });
            s.end(5.0);
        } },
    boss_guardian: { when: '[새로] 정의의 수호자 대표 소리 — 방패 강타 · 심판의 일격', len: [0.6, 2.0], run: bossScene('guardian', 1, 'bash', s => { s.fx2(quiet(Z.chargeImpact), HIT_X + 45, 100, { scale: 1.4 }); s.fx2(quiet(BV.guardianBarrier), 1000, FB); }) },
    boss_scrapking: { when: '[새로] 고철왕 대표 소리 — 자석 끌어당기기 · 고철 낙하', len: [0.6, 2.0], run: bossScene('scrapking', 2, 'drop', s => { s.fx2(quiet(Z.containerSlam), HIT_X + 30, FB); }) },
    boss_archbishop: { when: '[새로] 대주교 베네딕트 대표 소리 — 천상의 심판', len: [0.6, 2.0], run: bossScene('archbishop', 3, 'bash', s => { s.fx2(quiet(Z.heavenPillar), HIT_X + 10, FB); }, s => s.fx2(quiet(Z.judgmentWarn), HIT_X + 10, FB)) },
    boss_oculus: { when: '[새로] 관장자 오큘러스 대표 소리 — 심연의 파동', len: [0.6, 2.0], run: bossScene('oculus', 4, 'magnet', s => { s.fx2(quiet(BV.gaze), 1000, FB + 160, { to: [HIT_X, 120] }); }, s => s.fx2(quiet(BV.gazeWarn), 1000, FB + 160)) },
    boss_orbian: { when: '[새로] 자애의 대사제 오르비안 대표 소리 — 단죄의 빛', len: [0.6, 2.0], run: bossScene('orbian', 6, 'attack', s => { s.fx2(quiet(Z.heavenPillar), HIT_X + 10, FB); }, s => s.fx2(quiet(Z.judgmentWarn), HIT_X + 10, FB)) },
    boss_wmdalpha: { when: '[새로] WMD-알파 대표 소리 — 플라스마 레이저', len: [0.8, 2.5], run: bossScene('wmdalpha', 1, 'laser', s => { s.fx2(quiet(Z.plasmaBeam), 900, FB + 150, { to: [HIT_X - 100, 110] }); }, s => s.fx2(quiet(Z.plasmaWarn), HIT_X, FB)) },
    boss_terraformer: { when: '[새로] 기간틱 테라포머 대표 소리 — 대지 분쇄(파일벙커)', len: [0.8, 2.5], run: bossScene('terraformer', 2, 'attack', s => { s.fx2(quiet(Z.quakeSpike), HIT_X + 20, FB); }, s => s.fx2(quiet(Z.quakeWarn), HIT_X + 20, FB)) },
    boss_benedict: { when: '[새로] 타락한 대주교 베네딕트 대표 소리 — 신성한 심판 · 지옥문', len: [0.8, 2.5], run: bossScene('benedict', 3, 'bash', s => { s.fx2(quiet(Z.hellGate), HIT_X + 60, FB + 30, { scale: 1.3 }); }) },
    boss_ironclad: { when: '[새로] 해군 총사령관 아이언클래드 대표 소리 — 심해 압축포', len: [0.8, 2.5], run: bossScene('ironclad', 5, 'attack', s => { s.fx2(quiet(Z.waterBeam), 900, FB + 120, { to: [HIT_X - 100, 110] }); }, s => s.fx2(quiet(Z.waterWarn), HIT_X, FB)) },
    boss_grailheart: { when: '[새로] 기적의 성배 : 탐욕의 심장 대표 소리 — 핏빛 파동', len: [0.8, 2.5], run: bossScene('grailheart', 6, 'attack', s => { s.fx2(quiet(Z.bloodPulse), 980, FB + 60, { scale: 1.3 }); }) },
    boss_behemoth: { when: '[새로] 심판의 구포 : 베헤모스 대표 소리 — 철갑탄 직사', len: [0.8, 2.5], run: bossScene('behemoth', 7, 'attack', s => { s.fx2(quiet(Z.rocketBlast), HIT_X, 120, { scale: 1.5 }); }) },
    boss_vladimir: { when: '[새로] 탐욕의 폭군 블라디미르 대표 소리 — 화룡의 숨결', len: [0.8, 2.5], run: bossScene('vladimir', 8, 'attack', s => { s.fx2(quiet(Z.fireBreath), 900, FB + 120, { to: [HIT_X - 60, 110] }); }, s => s.fx2(quiet(Z.fireWarn), HIT_X, FB)) },
    boss_panopticon: { when: '[새로] 탐욕의 파노프티콘 대표 소리 — H빔 투하', len: [0.8, 2.5], run: bossScene('panopticon', 9, 'attack', s => { s.fx2(quiet(Z.containerSlam), HIT_X + 20, FB); }, s => s.fx2(quiet(Z.containerWarn), HIT_X + 20, FB)) },
    boss_mothervoice: { when: '[새로] 절대 발언권 마더 보이스 대표 소리 — 주파수 폭발', len: [0.8, 2.5], run: bossScene('mothervoice', 10, 'attack', s => { s.fx2(quiet(Z.sonicRing), 980, FB + 80, { scale: 1.6 }); }) },

    // =================== 연출 · 알림 ===================
    intro_whoosh: { when: '출격 인트로 — 작전명 카드가 휙 들어오는 순간', len: [0.3, 1.0],
        run: async s => { await field(s, { hero: 'mech', zone: 1, hud: true }); s.at(0.3, () => s.director.intro(stageOf('1-3'))); s.end(4.2); } },
    intro_sortie: { when: '출격 인트로 — SORTIE! 도장이 찍히는 순간', len: [0.5, 1.5],
        run: async s => { await field(s, { hero: 'mech', zone: 1, hud: true }); s.at(0.3, () => s.director.intro(stageOf('1-3'))); s.end(4.2); } },
    warning: { when: '중간 거점 요새 출현 경고 — WARNING 띠 (배경음 낮아짐)', len: [1.0, 2.5],
        run: async s => { await field(s, { hero: 'mech', zone: 1, mode: 'walk', hud: true }); s.walkBg = true; s.at(0.3, () => s.director.warning('mid')); s.at(1.2, () => { s.walkBg = false; s.rig.setMode('idle'); s.base('st1_fort', 900); }); s.end(3.6); } },
    warning_danger: { when: '최종 기지 출현 · 보스 등장 · 보스 기술 예고 — DANGER 띠 (배경음 낮아짐)', len: [1.0, 2.5],
        run: async s => { await field(s, { hero: 'mech', zone: 1, boss: true, hud: true }); s.at(0.3, () => s.director.warning('final')); s.at(1.0, () => s.base('st1_base', 940)); s.end(3.6); } },
    ult_cutin: { when: '필살기 컷인 — 화면이 어두워지며 사선 띠에 이름이 뜨는 순간 (느린 화면 · 배경음 낮아짐)', len: [0.8, 2.0],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ZFOES[1], hud: true });
            s.at(0.4, () => { s.director.ultCutIn({ name: '궤도 폭격', desc: '하늘에서 레이저 포격', icon: 'orbital' }, null); s.clip('call'); });
            s.at(1.5, () => us.forEach((u, i) => s.at(s.time + i * 0.2, () => { s.fx2(quiet(ST.orbitalHit) || quiet(M.laserBig), u.x, FB); s.hit(u, { kb: 20, dmg: 990 }); })));
            s.end(4.0);
        } },
    ult_ready: { when: '필살기 게이지가 다 찼을 때 (HUD 필살기 단추가 빛남)', len: [0.4, 1.2],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1, mode: 'attack', foes: ZFOES[1], hud: { skills: [{ icon: 'laser', cd: 0.3 }, { icon: 'missile', cd: 0.5 }, { icon: 'orbital', ult: true, cd: 1 }] } });
            const btn = s.skillBtn(2);
            let g = 1;
            const tick = () => { g = Math.max(0, g - 0.04); btn.style.setProperty('--cd', g); btn.style.setProperty('--gauge', 1 - g); if (g > 0) s.at(s.time + 0.06, tick); else { btn.classList.add('is-ready'); s.sfx('ult_ready'); } };
            s.at(0.2, tick);
            s.end(3.6);
        } },
    skill_ready: { when: '스킬 쿨다운이 끝나 단추가 다시 켜질 때', len: [0.2, 0.7],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1, mode: 'attack', foes: ZFOES[1], hud: { skills: [{ icon: 'laser', cd: 1 }, { icon: 'missile', cd: 1 }, { icon: 'orbital', ult: true, cd: 0.6 }] } });
            [0, 1].forEach(i => {
                const btn = s.skillBtn(i), num = btn.querySelector('.v2-skill__num');
                let cd = 1;
                const tick = () => { cd = Math.max(0, cd - 0.05); btn.style.setProperty('--cd', cd); num.textContent = cd > 0 ? String(Math.ceil(cd * 3)) : ''; if (cd > 0) s.at(s.time + 0.06 + i * 0.05, tick); else { btn.classList.add('is-ready'); s.sfx('skill_ready'); } };
                s.at(0.2 + i * 0.4, tick);
            });
            s.end(3.6);
        } },
    skill_use: { when: '스킬 단추를 눌러 스킬을 쓰는 순간 (스킬 자체 소리 앞에)', len: [0.15, 0.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ZFOES[1], hud: { skills: [{ icon: 'missile', ready: true }, { icon: 'drone', ready: true }, { icon: 'orbital', ult: true, cd: 0.4 }] } });
            s.tap(0.7, '.v2-skill[data-i="0"]', el => {
                s.sfx('skill_use');
                el.classList.remove('is-ready'); el.style.setProperty('--cd', 1);
                s.clip('salvo');
                for (let i = 0; i < 3; i++) s.at(s.time + 0.25 + i * 0.12, () => { const u = us[i]; const m = s.muzzle(); s.fx.launchMissile({ x: m.x, bottom: m.b + 20 }, () => u.chest(), () => { s.fx2(M.missileBlast, u.chest().x, u.chest().b); s.hit(u); }); });
            });
            s.tap(2.4, '.v2-skill[data-i="1"]', el => {
                s.sfx('skill_use');
                el.classList.remove('is-ready'); el.style.setProperty('--cd', 1);
                s.clip('launch');
                for (let i = 0; i < 3; i++) s.fx.launchDrone({ from: { x: HERO_X + 10, b: FB + 170 }, index: i, getTarget: () => us[i].chest(), onHit: () => s.hit(us[i]) });
            });
            s.end(4.8);
        } },
    low_hp: { when: '체력 30% 아래 — 심장 박동이 반복 재생되고 화면 가장자리가 붉게 (이음매 없이 반복되어야 함)', len: [0.8, 1.6],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ZFOES[1], slots: NEAR, hud: { hp: 0.24 } });
            s.at(0.4, () => s.director.setLowHp(true));
            s.every(0.8, 1.4, 3, i => foeOrb(s, us[i % 3], '90, 230, 255', () => heroHit(s)));
            s.at(5.4, () => s.director.setLowHp(false));
            s.end(5.8);
        } },
    star_get: { when: '중간 요새를 부숴 별이 HUD로 날아가는 순간', len: [0.4, 1.2],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1, hud: { stars: '☆☆' } });
            const b = s.base('st1_fort', 820);
            s.at(0.3, () => { s.director.baseDestroyed({ x: b.x, size: { w: b.art.w, h: b.art.h } }, false); s.at(s.time + 0.9, () => { b.state = 2; }); });
            s.end(4.8);
        } },
    mission_complete: { when: '최종 기지 파괴 뒤 MISSION COMPLETE 도장', len: [1.0, 3.0],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1, hud: true });
            const b = s.base('st1_base', 880);
            s.at(0.3, () => { s.director.baseDestroyed({ x: b.x, size: { w: b.art.w, h: b.art.h } }, true); s.at(s.time + 1.3, () => { b.state = 2; }); });
            s.end(6.4);
        } },
    mission_failed: { when: '제한 시간 초과 · 쓰러짐 뒤 MISSION FAILED / TIME OVER 도장', len: [1.0, 3.0],
        run: async s => { await field(s, { hero: 'mech', zone: 1, foes: ZFOES[1], hud: true }); s.at(0.4, () => s.director.timeOver()); s.end(4.4); } },
    player_down: { when: '목숨을 다 쓰고 주인공이 쓰러지는 순간 (붉은 섬광 · 느린 화면 · 배경음 꺼짐)', len: [1.0, 2.5],
        run: async s => {
            const us = await field(s, { hero: 'mech', zone: 1, foes: ZFOES[1], slots: NEAR, hud: { hp: 0.05 } });
            s.at(0.3, () => foeOrb(s, us[0], '255, 90, 90', () => { heroHit(s); s.director.playerDown(); s.heroCanvas.style.filter = 'grayscale(1) brightness(0.6)'; }));
            s.end(4.6);
        } },
    result_win: { when: '승리 결과 화면이 뜨는 순간 (그 뒤 별 · 숫자 · 보상음이 이어짐)', len: [1.0, 3.0], run: resultScene(true) },
    result_lose: { when: '패배 결과 화면이 뜨는 순간', len: [1.0, 3.0], run: resultScene(false) },
    result_star: { when: '결과 화면 별 도장이 하나씩 찍히는 순간 (0.3초 간격)', len: [0.2, 0.6], run: resultScene(true) },

    // =================== UI · 보상 ===================
    ui_tick: { when: '결과 화면 DM 숫자가 올라갈 때 (0.05초에 한 번까지 — 아주 짧게)', len: [0.02, 0.08], run: resultScene(true, { dm: 2480 }) },
    reward_done: { when: '보상 숫자가 다 올라간 순간 (결과 화면 끝)', len: [0.4, 1.2], run: resultScene(true, { dm: 1200 }) },
    ui_click: { when: '단추를 누를 때 (모든 화면 공통 — 가장 자주 듣는 UI 소리)', len: [0.03, 0.15],
        run: async s => {
            await field(s, { hero: null });
            s.ui(menuHtml());
            ['[data-b="1"]', '[data-b="2"]', '[data-b="3"]', '[data-b="1"]'].forEach((sel, i) => s.tap(0.6 + i * 0.75, sel, () => s.sfx('ui_click')));
            s.end(3.8);
        } },
    ui_tab: { when: '탭을 바꿀 때 (연구소 부위 · 성장 창 · 작전 지원)', len: [0.03, 0.15],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(tabsHtml());
            const tabs = [...root.querySelectorAll('.ss-tab')];
            [1, 2, 3, 0].forEach((k, i) => s.tap(0.6 + i * 0.75, tabs[k], () => { tabs.forEach(t => t.classList.toggle('is-on', t === tabs[k])); root.querySelector('.ss-tabbody').textContent = TAB_BODY[k]; s.sfx('ui_tab'); }, { noPress: true }));
            s.end(3.8);
        } },
    ui_toggle: { when: '설정의 켜기/끄기 · 자동 스킬(AUTO) 단추', len: [0.03, 0.15],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(settingsHtml());
            const sw = [...root.querySelectorAll('.v2-switch')];
            [0, 1, 0, 2].forEach((k, i) => s.tap(0.6 + i * 0.75, sw[k], el => { el.classList.toggle('is-on'); s.sfx('ui_toggle'); }, { noPress: true }));
            s.end(3.8);
        } },
    ui_pause: { when: '전투 중 일시정지 단추를 눌러 PAUSED 창이 뜰 때', len: [0.1, 0.4],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1, mode: 'attack', foes: ZFOES[1], hud: true });
            s.tap(1.0, '.ss-pausebtn', () => { s.sfx('ui_pause'); s.ui(pauseHtml(), 'is-overlay'); s.freeze(1.8); });
            s.end(4.0);
        } },
    ui_equip: { when: '연구소에서 파츠를 장착할 때 · 작전 지원 장착', len: [0.2, 0.6],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(equipHtml());
            [0, 1, 2].forEach(i => s.tap(0.6 + i * 1.0, root.querySelectorAll('.ss-part')[i], el => {
                root.querySelectorAll('.ss-part').forEach(p => p.classList.remove('is-on'));
                el.classList.add('is-on');
                const slot = root.querySelector('.ss-slot');
                slot.innerHTML = el.innerHTML;
                slot.classList.remove('is-pop'); void slot.offsetWidth; slot.classList.add('is-pop');
                s.sfx('ui_equip');
            }));
            s.end(3.8);
        } },
    ui_error: { when: '안 되는 것을 눌렀을 때 — 재화 부족 · 쿨다운 중 스킬 · 잠긴 판', len: [0.1, 0.4],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(shopHtml(120));
            const b = root.querySelector('[data-buy="2"]');
            [0.7, 2.2].forEach(t => s.tap(t, b, el => { el.classList.remove('ss-shake'); void el.offsetWidth; el.classList.add('ss-shake'); toast(s, 'DM이 부족해요 (1,500 필요)'); s.sfx('ui_error'); }));
            s.end(3.6);
        } },
    ui_buy: { when: '[새로] 상점에서 물건을 살 때 — 결제가 끝나는 순간 (지금은 장착 소리를 빌려 씀)', len: [0.3, 0.9],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(shopHtml(9800));
            [0.7, 2.2].forEach((t, i) => s.tap(t, root.querySelector(`[data-buy="${i}"]`), el => { el.closest('.ss-item').classList.add('is-sold'); countTo(s, root.querySelector('.ss-dm'), i ? 8100 : 9300); s.sfx('ui_buy'); }));
            s.end(3.8);
        } },
    ui_upgrade_ok: { when: '[새로] 파츠 강화 성공 — Lv가 오르는 순간', len: [0.5, 1.4],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(upgradeHtml(7));
            [0.7, 2.3].forEach((t, i) => s.tap(t, root.querySelector('.ss-upbtn'), () => {
                const card = root.querySelector('.ss-upcard');
                card.classList.remove('is-ok', 'is-fail'); void card.offsetWidth; card.classList.add('is-ok');
                root.querySelector('.ss-lv').textContent = `Lv ${8 + i}`;
                s.sfx('ui_upgrade_ok');
            }));
            s.end(4.0);
        } },
    ui_upgrade_fail: { when: '[새로] 파츠 강화(승급) 실패 — 확률 실패 순간', len: [0.4, 1.2],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(upgradeHtml(12, true));
            [0.7, 2.3].forEach(t => s.tap(t, root.querySelector('.ss-upbtn'), () => {
                const card = root.querySelector('.ss-upcard');
                card.classList.remove('is-ok', 'is-fail'); void card.offsetWidth; card.classList.add('is-fail');
                s.sfx('ui_upgrade_fail');
            }));
            s.end(4.0);
        } },
    ui_unlock: { when: '[새로] 해금 — 새 캐릭터 합류 · 난이도·판이 열리는 순간', len: [0.6, 1.6],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(unlockHtml());
            s.at(0.8, () => { root.querySelector('.ss-lock').classList.add('is-open'); s.sfx('ui_unlock'); });
            s.end(3.6);
        } },
    ui_coin: { when: '[새로] 재화 획득 — 동전·DM이 재화 칸으로 날아들어갈 때 (여러 번 짧게)', len: [0.04, 0.2],
        run: async s => {
            await field(s, { hero: null });
            const root = s.ui(coinHtml());
            const chip = root.querySelector('.ss-dm');
            let dm = 1240;
            for (let i = 0; i < 10; i++) s.at(0.6 + i * 0.12, () => flyCoin(s, root, () => { dm += 50; chip.textContent = dm.toLocaleString(); s.sfx('ui_coin'); }));
            s.end(3.4);
        } },
    ui_levelup: { when: '[새로] 레벨 업 — 계정·펫·캐릭터 레벨이 오르는 순간', len: [0.8, 2.0],
        run: async s => {
            await field(s, { hero: 'mech', zone: 1 });
            s.at(0.6, () => { const el = document.createElement('div'); el.className = 'ss-tmp ss-levelup'; el.innerHTML = '<strong>LEVEL UP</strong><small>Lv 14 → 15</small>'; s.frame.appendChild(el); s.fx2(quiet(BT.eliteSpawn), HERO_X + 30, FB); s.sfx('ui_levelup'); setTimeout(() => el.remove(), 2200); });
            s.end(3.6);
        } }
};

// ---------------------------------------------------------------------------
// 보스 장면: 보스 등장 카드(소리 없이) → 예고 → 대표 기술
function bossScene(kind, zone, anim, hitFx, warnFx) {
    return async s => {
        await field(s, { hero: 'mech', zone, boss: true, hud: true });
        const boss = s.foe(kind, 1000, { fadeIn: 0.5 });
        s.at(0.2, () => {
            const el = s.director.layer('v2-bosscard ss-quietcard', `<div class="v2-bosscard__band"><small>BOSS</small><strong>${BOSS_NAME[kind] || kind}</strong></div>`);
            setTimeout(() => el.remove(), 1500);
        });
        const once = t0 => {
            if (warnFx) s.at(t0 - 0.9, () => warnFx(s));
            s.at(t0, () => {
                s.foeAttack(boss, anim);
                s.at(s.time + 0.25, () => {
                    s.sfx(`boss_${kind}`);
                    hitFx(s);
                    s.shake(8, 400);
                    s.at(s.time + 0.15, () => heroHit(s, { dmg: 180 }));
                });
            });
        };
        once(1.9);
        once(4.0);
        s.end(5.8);
    };
}
const BOSS_NAME = { guardian: '정의의 수호자', scrapking: '고철왕', archbishop: '대주교 베네딕트', oculus: '관장자 오큘러스', orbian: '자애의 대사제 오르비안',
    wmdalpha: 'WMD-알파', terraformer: '기간틱 테라포머', benedict: '타락한 대주교 베네딕트', ironclad: '해군 총사령관 아이언클래드',
    grailheart: '기적의 성배 : 탐욕의 심장', behemoth: '심판의 구포 : 베헤모스', vladimir: '탐욕의 폭군 블라디미르', panopticon: '탐욕의 파노프티콘',
    mothervoice: '절대 발언권 마더 보이스' };

/** 결과 화면 (게임 showResult 그대로 — 결과음 · 별 도장 · 숫자 올라감 · 보상음이 차례로) */
function resultScene(victory, o = {}) {
    return async s => {
        await field(s, { hero: 'mech', zone: 1 });
        const stage = stageOf('1-3');
        s.at(0.3, () => s.director.showResult({
            victory, stage, starFlags: victory ? [true, true, true] : [false, false, false], bestStars: [true, true, false], prevStars: [true, false, false],
            newStars: victory ? 2 : 0, bonus: victory ? 600 : 0, next: victory ? stageOf('1-4') : null, distance: victory ? 1000 : 640, kills: 48, time: 94,
            dm: o.dm ?? (victory ? 1840 : 320), loot: null
        }, () => {}));
        s.end(victory ? 4.8 : 3.6);
    };
}

// ---- UI 화면 흉내 (게임 단추·판 모양) ----
const TAB_BODY = ['머리 파츠 — 필살기 · 센서', '몸통 파츠 — 체력 · 방어 스킬', '팔 파츠 — 기본 공격 · 팔 스킬', '다리 파츠 — 이동 속도 · 패시브'];
function menuHtml() {
    return `<div class="ss-menu v2-panel"><div class="v2-hazard ss-stripe"></div><h3>MAIN MENU</h3>
        <button class="v2-btn v2-btn--primary" data-b="1">${'출격'}</button><button class="v2-btn" data-b="2">연구소</button><button class="v2-btn v2-btn--ghost" data-b="3">설정</button></div>`;
}
function tabsHtml() {
    return `<div class="ss-menu v2-panel ss-wide"><h3>연구소</h3><div class="ss-tabs">${['머리', '몸통', '팔', '다리'].map((t, i) => `<button class="ss-tab${i ? '' : ' is-on'}">${t}</button>`).join('')}</div>
        <div class="ss-tabbody">${TAB_BODY[0]}</div></div>`;
}
function settingsHtml() {
    return `<div class="ss-menu v2-panel ss-wide"><h3>설정</h3>${['화면 흔들림', '진동', '자동 스킬 (AUTO)'].map((t, i) => `<div class="ss-row"><span>${t}</span><button class="v2-switch${i === 0 ? ' is-on' : ''}"><i></i></button></div>`).join('')}</div>`;
}
function pauseHtml() {
    return `<div class="v2-pause ss-pause"><div class="v2-pause__panel v2-panel"><div class="v2-hazard v2-pause__stripe"></div><h2>PAUSED</h2><p>작전 일시 정지</p>
        <button class="v2-btn">계속하기</button><button class="v2-btn v2-btn--ghost">설정</button><button class="v2-btn v2-btn--danger">작전 포기 (퇴각)</button></div></div>`;
}
function equipHtml() {
    const parts = [['레일건 팔', 'rail'], ['산탄 팔', 'missile'], ['궤도 포격 머리', 'orbital']];
    return `<div class="ss-menu v2-panel ss-wide"><h3>파츠 장착</h3><div class="ss-equip"><div class="ss-slot">빈 칸</div>
        <div class="ss-parts">${parts.map(([n]) => `<button class="ss-part"><b>${n}</b><small>EPIC · Lv 5</small></button>`).join('')}</div></div></div>`;
}
function shopHtml(dm) {
    const items = [['DM 꾸러미', '500'], ['스킬 코어 ×3', '700'], ['승급석', '1,500']];
    return `<div class="ss-menu v2-panel ss-wide"><h3>상점 <span class="v2-chip"><strong class="ss-dm">${dm.toLocaleString()}</strong><small>DM</small></span></h3>
        <div class="ss-shop">${items.map(([n, p], i) => `<div class="ss-item"><b>${n}</b><button class="v2-btn v2-btn--primary" data-buy="${i}">${p} DM</button></div>`).join('')}</div></div>`;
}
function upgradeHtml(lv, risky = false) {
    return `<div class="ss-menu v2-panel ss-wide"><h3>${risky ? '승급' : '파츠 강화'}</h3><div class="ss-upcard"><b>궤도 포격 머리</b><span class="ss-lv">Lv ${lv}</span>
        <small>${risky ? '성공 확률 45%' : '강화비 1,240 DM'}</small></div><button class="v2-btn v2-btn--primary ss-upbtn">${risky ? '승급' : '강화'}</button></div>`;
}
function unlockHtml() {
    return `<div class="ss-menu v2-panel ss-wide ss-center"><div class="ss-lock"><span class="ss-lockicon">🔒</span><b>침묵의 방송자</b><small>합류! 캐릭터 선택에서 고를 수 있습니다</small></div></div>`;
}
function coinHtml() {
    return `<div class="ss-menu v2-panel ss-wide"><h3>방치 보상 <span class="v2-chip"><strong class="ss-dm">1,240</strong><small>DM</small></span></h3><div class="ss-chest">💎</div><small>8시간 동안 모은 보상</small></div>`;
}
function toast(s, text) {
    const el = document.createElement('div');
    el.className = 'ss-tmp ss-toast';
    el.textContent = text;
    s.frame.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}
function countTo(s, el, to) {
    const from = Number(el.textContent.replace(/,/g, ''));
    const t0 = performance.now();
    const step = now => { const u = Math.min(1, (now - t0) / 500); el.textContent = Math.round(from + (to - from) * u).toLocaleString(); if (u < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}
function flyCoin(s, root, onLand) {
    const chest = root.querySelector('.ss-chest'), chip = root.querySelector('.ss-dm');
    const fr = s.frame.getBoundingClientRect(), k = fr.width / W;
    const a = chest.getBoundingClientRect(), b = chip.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'ss-tmp ss-coin';
    el.textContent = '💎';
    const x0 = (a.left - fr.left + a.width / 2) / k + rand(-30, 30), y0 = (a.top - fr.top + a.height / 2) / k;
    const x1 = (b.left - fr.left + b.width / 2) / k, y1 = (b.top - fr.top + b.height / 2) / k;
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    s.frame.appendChild(el);
    el.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(calc(${x1 - x0}px - 50%), calc(${y1 - y0}px - 50%)) scale(0.6)` }],
        { duration: 420, easing: 'cubic-bezier(.5,0,.8,.6)' }).onfinish = () => { el.remove(); onLand(); };
}
