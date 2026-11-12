/* ==========================================================================
   PROJECT: MAD OVERLORD // RIG TEST — 테스트 화면 컨트롤러
   rig_test.html 전용. 게임과 같은 리그 엔진(js/engine_v2/rig/)·이펙트 정의로 동작·스킬·적 이펙트를 따로 확인한다.
   - 캐릭터 · 스킬 탭: 캐릭터 카드, 고유 동작, 부위별 파츠·스킬 (PART_CATALOG, 장착하면 세트·강화 그림),
                      ▶ 스킬 미리보기는 skillPreviews.js (previewApi로 무대를 다룸)
   - 적 · 이펙트 탭: 무대 오른쪽의 적(게임의 구운 그림 ENEMY_ART + 색조), 그 적의 기술·엘리트 속성·구역 기믹 이펙트
   - 스프라이트 굽기(tools/rig/bake_sprite.py, ?bake=1)는 window.rigTest와 캔버스만 씀 — 굽기 때는 적을 그리지 않음
   ========================================================================== */

import { Animator, Spring, Mat } from '../engine_v2/rig/rig.js';
import { RIG_CHARACTERS, RIG_ENEMIES, RIG_NEW, attackClipOf, hitSocketOf } from '../engine_v2/rig/characters.js';
import { loadRigAssets, applyRigEvent, applyUpgrades, buildSkeleton, restBounds, shieldGeom, ScaleTween, PHASE2_SCALE, variantAlias, variantSocketsFor, mechArmOf }
    from '../engine_v2/rig/rigAvatar.js';
import { V2_PARTS } from '../engine_v2/partsExtra_v2.js';
import { RigEffects } from '../engine_v2/rig/rigEffects.js';
import { VfxPlayer, preloadVfxSheets } from '../engine_v2/vfx/vfxPlayer.js';
import { HERO_WAVE, HERO_ORB } from '../engine_v2/vfx/heroVfx.js';
import { HERO_VFX, MECH_VFX, KAIJU_VFX, CHIMERA_VFX, DIVER_VFX, SAINT_VFX, FROST_VFX } from '../engine_v2/vfx/vfxDefs.js';
import { ICE, MIST } from '../engine_v2/vfx/frostVfx.js';
import { DOLL_VFX } from '../engine_v2/vfx/vfxDefs.js';
import { BATTLE_VFX, ZONE_VFX, BOSS_VFX, ELITE_VFX } from '../engine_v2/vfx/vfxDefs.js';
import { BLOOD } from '../engine_v2/vfx/saintVfx.js';
import { WATER, ABYSS } from '../engine_v2/vfx/diverVfx.js';
import { ENEMY_TYPES, ELITE_AFFIXES } from '../engine_v2/enemies_v2.js';
import { ENEMY_ART } from '../engine_v2/enemyArt_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { PART_CATALOG } from './partSkills.gen.js';
import { SKILL_PREVIEWS, kitPreview, kitPassivePreview } from './skillPreviews.js';
import { registerAllSets2 } from '../engine_v2/sets2/index.js';
import { VFX_VARIANTS, applyVfxVariant, applyVfxChoices, readVfxChoices, readVfxStyle } from '../engine_v2/vfx/vfxVariants.js';

const BAKE = new URLSearchParams(location.search).has('bake');   // 스프라이트 굽기: 적을 그리지 않음
const CAPTURE = new URLSearchParams(location.search).get('capture') === '1';
const EMBED = new URLSearchParams(location.search).get('embed') === '1';   // 게임 연구소 안 스킬 미리보기 (11-05 피드백 11번)
const vfxChoices = readVfxChoices();
applyVfxChoices(vfxChoices);
const STAGE_W = 960;
const STAGE_H = 600;
const GROUND_Y = 520;
const CHAR_X = 380;
const CHAR_SCALE = 0.42;     // 원본 약 950px → 화면 약 400px
const PIXEL = 4;             // 도트 모드: 1/4 해상도(캐릭터 약 100px)로 그린 뒤 4배 확대
const FIXED_DT = 1 / 120;
const STEP_FPS = 12;
const SCROLL_SPEED = 140;
const FADE_SEC = 0.18;

// bg/fx: 배경·HUD와 이펙트 그리기 (스프라이트 굽기용으로 끌 수 있음, tools/rig/bake_sprite.py)
const opts = { crossfade: true, springs: true, pixel: false, stepped: false, bones: false, scroll: true, speed: 1,
    bg: true, fx: true, dummies: !BAKE };
const state = { char: 'mech', mode: 'idle', arm: 'cannon', paused: false,
    upgrades: { head: false, body: false, arm: false, leg: false },   // 새 캐릭터 강화 그림 (D-044)
    equip: {},                                                        // 부위 → 파츠 id (PART_CATALOG)
    enemy: 'guard', enemyCount: 3, enemyMode: 'walk', elite: false, affixes: [], raged: false, tab: 'char' };

let character, skeleton, animator, effects, springs, bounds, layout;
let onceClip = null;               // 점프/변신처럼 한 번 재생 중인 클립

// ---- 스킬 이펙트 확인용: 전장 VFX + 고블린 더미 (게임 전투와 같은 비율) ----
const vfx = new VfxPlayer();
preloadVfxSheets();
vfx.style = readVfxStyle();
const VFX_SCALE = CHAR_SCALE / 0.235;            // 게임 전투 배율 대비 (캐릭터가 약 1.8배 큼)
const GOBLIN_SRC = 'assets/sprites/enemy/goblin_walk_sheet.png';
const SPREAD_X = [310, 410, 510].map(dx => CHAR_X + dx * VFX_SCALE * 0.56);   // 적 3마리 자리
const dummies = SPREAD_X.map(x => ({ x, flash: 0, slow: 0 }));
const timers = [];                 // 미리보기 예약 (시뮬레이션 시간 기준, previewApi.later)
const skill = { curse: false, wave: false, seal: false, blizzard: false, curseTimer: 0, castCb: null };
let goblinImg = null;
const giant = new ScaleTween();    // 2페이즈 거대화 배율
let mainCtx, offCanvas, offCtx;
let groundOffset = 0;
let simTime = 0;
let dirty = true;
const eventLog = [];
let showcase = null;
let showcaseRequest = 0;
let showcaseLoad = Promise.resolve();

let stageM = Mat.trs(CHAR_X, GROUND_Y, 0, CHAR_SCALE, CHAR_SCALE);
const toStage = p => Mat.apply(stageM, p[0], p[1]);

function applyScale() {
    const s = CHAR_SCALE * giant.value;
    stageM = Mat.trs(CHAR_X, GROUND_Y, 0, s, s);
    effects.k = giant.value;
}

async function init() {
    registerAllSets2();   // 2차 세트 스킬 단계(SKILLS)를 게임처럼 등록 — kitPreview가 읽음
    const canvas = document.getElementById('rig-canvas');
    mainCtx = canvas.getContext('2d');
    offCanvas = document.createElement('canvas');
    offCanvas.width = STAGE_W / PIXEL;
    offCanvas.height = STAGE_H / PIXEL;
    offCtx = offCanvas.getContext('2d');
    effects = new RigEffects();
    goblinImg = new Image();
    goblinImg.src = GOBLIN_SRC;

    await setCharacter(state.char);
    bindUI();
    loadEnemyArt(enemyArtKey());
    placeEnemies();
    renderEnemyTab();
    renderVfxVariants();
    renderWho();
    syncButtons();
    document.getElementById('rig-loading').remove();
    requestAnimationFrame(loop);
    if (EMBED) bindEmbed();
}

/** 게임 연구소(lab_v2.js)가 iframe으로 띄우면: { type: 'mo-skill-preview', char, equip: { 부위: 파츠 id }, part } → 그 캐릭터·파츠로 그 스킬 재생 */
function bindEmbed() {
    window.addEventListener('message', async e => {
        const m = e.data;
        if (e.origin !== location.origin || !m || m.type !== 'mo-skill-preview') return;
        if (m.char && m.char !== state.char && PART_CATALOG[m.char]) await setCharacter(m.char);
        Object.values(m.equip || {}).forEach(id => { if (partById(id)) equip(id); });
        const ok = m.part ? playSkill(m.part) : false;
        e.source?.postMessage({ type: 'mo-skill-preview-done', ok, part: m.part }, e.origin);
    });
    window.parent?.postMessage({ type: 'mo-skill-preview-ready' }, location.origin);
}

/** 캐릭터 교체: 에셋 로드 후 뼈대/스프링/애니메이터를 새로 구성하고 현재 상태 동작을 이어서 재생 */
async function setCharacter(id) {
    showcase = null;
    const next = RIG_CHARACTERS[id] || RIG_ENEMIES[id] || RIG_NEW[id];
    const assets = await loadRigAssets(next);
    const images = assets.images;
    layout = assets.layout;
    character = next;
    state.char = id;
    if (character.arms && !character.arms[state.arm]) state.arm = character.defaultArm;
    skeleton = buildSkeleton(character, layout, images, state.arm);
    applyUpgrades(skeleton, character, state.upgrades);
    if (PART_CATALOG[id]) {
        state.equip = defaultEquip(id);
        applyEquip();
    }
    bounds = restBounds(layout);
    springs = character.springs.map(s => new Spring(s));
    effects.clear();
    onceClip = null;
    giant.set(1, 0);
    applyScale();
    effects.setAmbient(character.ambient, (socket, bone, ox, oy) => {
        const w = skeleton.socketWorld(socket, bone);
        return toStage([w[0] + ox, w[1] + oy]);
    }, GROUND_Y);
    animator = new Animator(character.clips, onEvent);
    animator.play(clipFor(state.mode), 0);
    vfx.clear();
    skill.curse = false;
    skill.seal = false;
    skill.blizzard = false;
    skill.wave = false;
    timers.length = 0;
    skill.castCb = null;
    renderCharTab();
    tick(0);
    syncButtons();
    dirty = true;
}

// ---------------------------------------------------------------------------
// 시뮬레이션
// ---------------------------------------------------------------------------
function tick(h) {
    if (showcase) showcase.age += h;
    animator.update(h);
    if (onceClip && animator.currentTime >= character.clips[onceClip].duration) {
        onceClip = null;
        animator.play(clipFor(state.mode), opts.crossfade ? FADE_SEC : 0);
    }
    if (giant.update(h)) applyScale();
    // 예약된 미리보기는 이펙트 갱신 전에 (그 안에서 쏜 투사체가 위치를 받은 뒤 그려지게)
    for (let i = timers.length - 1; i >= 0; i--) {
        timers[i].t -= h;
        if (timers[i].t <= 0) timers.splice(i, 1)[0].fn();
    }
    vfx.update(h);
    for (const d of dummies) {
        d.flash = Math.max(0, d.flash - h);
        d.slow = Math.max(0, d.slow - h);
    }
    // 흑마법 오라 틱 (게임과 같은 0.65초)
    if (skill.curse) {
        skill.curseTimer += h;
        if (skill.curseTimer >= 0.65) {
            skill.curseTimer = 0;
            vfx.pulse('curse');
            for (const d of dummies) vfx.play(HERO_VFX.curseTick, dummyCenterX(d), GROUND_Y, { scale: VFX_SCALE });
        }
    }
    const pose = animator.sample();
    const offsets = {};
    if (opts.springs) {
        for (const s of springs) {
            offsets[s.bone] = { ...(offsets[s.bone] || {}), [s.channel]: s.value };
        }
    }
    skeleton.update(pose, offsets);
    if (opts.springs && h > 0) {
        for (const s of springs) s.step(skeleton.restPivotWorld(s.bone), h);
    }
    effects.update(h);
    if (state.mode === 'walk' && opts.scroll) groundOffset += SCROLL_SPEED * h;
    simTime += h;
}

function hitSocket() {
    return hitSocketOf(character, state.arm);
}

function onEvent(name, data) {
    applyRigEvent(name, data, {
        effects, skeleton, character, arm: state.arm, toScreen: toStage, groundY: GROUND_Y,
        onGrow: mult => { giant.set(mult); },
        onShield: shieldOn
    });
    if (name === 'cast' && skill.castCb) {
        const cb = skill.castCb;
        skill.castCb = null;
        cb();
    }
    // 공격 타격 순간: 첫 더미 피격 반응 (+ 어둠 파동 팔이면 파동 발사)
    if (name === 'impact' && data.hit && showDummies()) {
        const d = dummies[0];
        if (character.id === 'hero' && !showcase) {
            vfx.play(HERO_VFX.slashHit, dummyCenterX(d), dummyCenterY(), { scale: VFX_SCALE });
            if (skill.wave) launchWave();
        }
        d.flash = 0.08;
    }
    eventLog.unshift(`${simTime.toFixed(2)}s  ${animator.currentName} → ${name}`);
    eventLog.length = Math.min(eventLog.length, 8);
    renderLog();
}

function clipFor(mode) {
    return mode === 'attack' ? attackClipOf(character, state.arm) : mode;
}

function setMode(mode) {
    state.mode = mode;
    if (!onceClip) {
        effects.stopCharge();
        animator.play(clipFor(mode), opts.crossfade ? FADE_SEC : 0);
    }
    syncButtons();
    dirty = true;
}

// ---- 특수 동작 (게임의 RigAvatar와 같은 규칙) ----
function playOnce(name) {
    if (!character.clips[name]) return false;
    onceClip = name;
    effects.stopCharge();
    animator.play(name, 0.12);
    dirty = true;
    return true;
}

function shieldOn() {
    effects.setShield(() => shieldGeom(bounds, toStage, CHAR_SCALE * giant.value));
}

/** 2페이즈: 이미 거대화 상태면 원래대로 되돌림 (반복 확인용) */
function phase2() {
    if (giant.to > 1) {
        giant.set(1, 0.4);
        effects.shield = null;
        return;
    }
    if (!playOnce('transform')) {
        giant.set(PHASE2_SCALE);
        shieldOn();
    }
}

function breakShield() {
    effects.shieldBreak();
}

// ---- 타락 히어로 스킬 (게임 battle_v2.js와 같은 이펙트 정의) ----
function showDummies() {
    return opts.dummies;
}

function dummyCenterX(d) {
    return d.x;
}

function dummyCenterY() {
    return GROUND_Y - 38 * VFX_SCALE * 0.56 * 1.8;
}

function toggleCurse() {
    skill.curse = !skill.curse;
    opts.dummies = true;
    // 저주 장판: 발밑에서 앞으로 (게임과 같은 비율), 허수아비 발목에 촉수
    vfx.setPersistent('curse', skill.curse ? HERO_VFX.curseAura : null,
        () => [CHAR_X + 140 * VFX_SCALE, GROUND_Y], VFX_SCALE,
        { targets: () => dummies.map((d, i) => ({ key: `dummy${i}`, x: dummyCenterX(d), y: GROUND_Y, w: 14 })) });
    syncButtons();
}

function mindWave() {
    opts.dummies = true;
    const release = () => {
        const w = skeleton.socketWorld(character.sockets && character.sockets.hand ? 'hand' : hitSocket()[0],
            character.sockets && character.sockets.hand ? 'armF' : hitSocket()[1]);
        const d = dummies[1];
        vfx.play(HERO_VFX.castRelease, toStage(w)[0], toStage(w)[1], { scale: VFX_SCALE });
        vfx.launchOrb({
            from: toStage(w), to: () => [dummyCenterX(d), dummyCenterY()], color: HERO_ORB.color, dur: HERO_ORB.dur,
            scale: VFX_SCALE, onArrive: () => vfx.play(HERO_VFX.mindConvert, dummyCenterX(d), GROUND_Y, { scale: VFX_SCALE })
        });
    };
    if (playOnce('cast')) skill.castCb = release;
    else release();
    syncButtons();
}

function toggleWave() {
    skill.wave = !skill.wave;
    opts.dummies = true;
    if (skill.wave && state.mode !== 'attack') setMode('attack');
    syncButtons();
}

function launchWave() {
    const tip = toStage(skeleton.socketWorld(hitSocket()[0], hitSocket()[1]));
    const hit = new Set();
    vfx.launchWave({
        x: tip[0], y: dummyCenterY(), range: 340, speed: HERO_WAVE.speed, h: HERO_WAVE.h, color: HERO_WAVE.color,
        scale: VFX_SCALE,
        onMove: (x0, x1) => dummies.forEach(d => {
            if (d.x < x0 || d.x > x1 || hit.has(d)) return;
            hit.add(d);
            d.flash = 0.08;
            d.slow = 2.5;
            vfx.play(HERO_VFX.waveHit, d.x, dummyCenterY(), { scale: VFX_SCALE });
        })
    });
}

// ---- 이펙트 미리보기 (게임과 같은 정의를 더미/캐릭터 위치에서 재생) ----
function vfxAtDummy(def, i = 0, ground = false) {
    const d = dummies[i];
    vfx.play(def, d.x, ground ? GROUND_Y : dummyCenterY(), { scale: VFX_SCALE });
    d.flash = 0.08;
}

function vfxAtEachDummy(def, ground = true) {
    dummies.forEach((d, i) => vfxAtDummy(def, i, ground));
}

function vfxAtSelf(def) {
    vfx.play(def, CHAR_X, GROUND_Y, { scale: VFX_SCALE });
}

/** 두 정의를 이어 붙임 (b는 delay초 뒤) */
function seq(a, b, delay) {
    return { layers: [...a.layers, ...b.layers.map(l => ({ ...l, at: (l.at || 0) + delay }))] };
}

function muzzlePoint() {
    const [socket, bone] = hitSocket();
    return toStage(skeleton.socketWorld(socket, bone));
}

function previewLaser() {
    const m = muzzlePoint();
    const d = dummies[0];
    vfx.play(MECH_VFX.laser, m[0], m[1], { scale: VFX_SCALE, to: [d.x, dummyCenterY()] });
    d.flash = 0.08;
}

function previewMissiles() {
    const m = muzzlePoint();
    dummies.forEach((d, i) => vfx.launchMissile({
        from: m, to: () => [d.x, dummyCenterY()], dur: 0.5 + i * 0.08, apex: 55, scale: VFX_SCALE,
        onArrive: (x, y) => { vfx.play(MECH_VFX.missileBlast, x, y, { scale: VFX_SCALE }); d.flash = 0.08; }
    }));
}

// 심연의 길잡이: 물줄기(더미 셋 관통) · 앵커 사슬(가장 먼 더미) · 물살 · 심연의 손
function previewJet() {
    const m = muzzlePoint();
    const far = dummies[dummies.length - 1];
    vfx.play(DIVER_VFX.jet, m[0], m[1], { scale: VFX_SCALE, to: [far.x, dummyCenterY()] });
    dummies.forEach(d => { vfx.play(DIVER_VFX.jetHit, d.x, dummyCenterY(), { scale: VFX_SCALE }); d.flash = 0.08; });
}

function previewAnchor() {
    const d = dummies[dummies.length - 1];
    const hand = () => toStage(skeleton.socketWorld('hand', 'armB'));
    skill.castCb = () => vfx.launchChain({      // 앵커 동작의 'cast' 순간(손을 떠남)에 던짐
        from: hand, to: () => [d.x, dummyCenterY()], scale: VFX_SCALE, color: ABYSS,
        onHook: (x, y) => { vfx.play(DIVER_VFX.anchorHook, x, y, { scale: VFX_SCALE }); d.flash = 0.08; }
    });
    playOnce('anchor');
}

function previewSurge() {
    const m = muzzlePoint();
    vfx.play(DIVER_VFX.surgeBurst, m[0], m[1], { scale: VFX_SCALE });
    const hit = new Set();
    vfx.launchWave({
        x: m[0], y: dummyCenterY(), range: 480, speed: 620, h: 120, color: WATER, mist: '40, 110, 130', scale: VFX_SCALE,
        onMove: (x0, x1) => dummies.forEach(d => {
            if (d.x < x0 || d.x > x1 || hit.has(d)) return;
            hit.add(d);
            vfx.play(DIVER_VFX.surgeHit, d.x, dummyCenterY(), { scale: VFX_SCALE });
            d.flash = 0.08;
            d.slow = 2.5;
        })
    });
}

// 봉합 성녀: 바늘(더미에 꽂힘) · 3연발 · 생명 봉인 장판(켜고 끄기) · 시체 → 부활
function previewNeedles(n) {
    const m = muzzlePoint();
    dummies.slice(0, n).forEach((d, i) => vfx.launchNeedle({
        from: m, to: () => [d.x, dummyCenterY()], dur: 0.16 + i * 0.07, color: BLOOD, scale: VFX_SCALE,
        onArrive: (x, y) => { vfx.play(SAINT_VFX.needleHit, x, y, { scale: VFX_SCALE }); d.flash = 0.08; }
    }));
}

function toggleSeal() {
    skill.seal = !skill.seal;
    opts.dummies = true;
    vfx.setPersistent('seal', skill.seal ? SAINT_VFX.sealField : null,
        () => [CHAR_X + 150 * VFX_SCALE, GROUND_Y], VFX_SCALE,
        { targets: () => dummies.map((d, i) => ({ key: `dummy${i}`, x: dummyCenterX(d), y: GROUND_Y, w: 14 })) });
    if (skill.seal) vfx.play(SAINT_VFX.sealOpen, CHAR_X + 150 * VFX_SCALE, GROUND_Y, { scale: VFX_SCALE });
}

// 서리의 무희: 서리 부채(앞 둘) · 초승달 참격(모두) · 눈보라(켜고 끄기) · 빙결 · 영원한 안식(가뒀다 깨뜨림)
function previewFrostWave(h, range, hits) {
    const m = toStage(skeleton.socketWorld('fanF', 'handF'));
    const hit = new Set();
    vfx.launchWave({
        x: m[0], y: dummyCenterY(), range, speed: 760, h, color: ICE, mist: MIST, scale: VFX_SCALE,
        onMove: (x0, x1) => dummies.forEach(d => {
            if (d.x < x0 || d.x > x1 || hit.has(d) || hit.size >= hits) return;
            hit.add(d);
            vfx.play(h > 80 ? FROST_VFX.crescentHit : FROST_VFX.fanHit, d.x, dummyCenterY(), { scale: VFX_SCALE });
            d.flash = 0.08;
        })
    });
}

function toggleBlizzard() {
    skill.blizzard = !skill.blizzard;
    opts.dummies = true;
    vfx.setPersistent('blizzard', skill.blizzard ? FROST_VFX.blizzardField : null,
        () => [CHAR_X + 60 * VFX_SCALE, GROUND_Y], VFX_SCALE);
    if (skill.blizzard) vfx.play(FROST_VFX.blizzardOpen, CHAR_X + 60 * VFX_SCALE, GROUND_Y, { scale: VFX_SCALE });
}

// 뒤틀린 인형사: 가위 · X자 · 인형 내려옴 · 인형 터짐 · 인형 실(더미마다 위에서 실)
function previewPuppet() {
    vfxAtSelf(DOLL_VFX.stringsCall);
    dummies.forEach((d, i) => setTimeout(() => {
        vfx.play(DOLL_VFX.puppetString, d.x, GROUND_Y - 330 * VFX_SCALE * 0.56, { scale: VFX_SCALE, to: [d.x, dummyCenterY()] });
        d.slow = 2;
    }, 120 * i / opts.speed));
}

const PREVIEWS = {
    mech: [
        ['레이저 포격', previewLaser],
        ['미사일 3연발', previewMissiles],
        ['드론 폭발', () => vfxAtDummy(MECH_VFX.droneBlast, 1)],
        ['주먹 적중', () => vfxAtDummy(MECH_VFX.fistHit, 0)],
        ['착지 균열', () => vfxAtSelf(MECH_VFX.landing)]
    ],
    kaiju: [
        ['물기 적중', () => vfxAtDummy(KAIJU_VFX.biteHit, 0)],
        ['포자 살포', () => vfxAtEachDummy(KAIJU_VFX.sporeTick)],
        ['알 낳기 → 부화', () => vfxAtDummy(seq(KAIJU_VFX.eggLay, KAIJU_VFX.eggHatch, 1.2), 1, true)],
        ['재생', () => vfxAtSelf(KAIJU_VFX.regen)]
    ],
    hero: [
        ['베기 적중', () => vfxAtDummy(HERO_VFX.slashHit, 0)],
        ['파동 적중', () => vfxAtDummy(HERO_VFX.waveHit, 0)],
        ['시전 해방', () => vfx.play(HERO_VFX.castRelease, ...toStage(skeleton.socketWorld('hand', 'armF')), { scale: VFX_SCALE })],
        ['흑마법 기둥', () => vfxAtEachDummy(HERO_VFX.curseTick)],
        ['세뇌 변환', () => vfxAtDummy(HERO_VFX.mindConvert, 1, true)]
    ],
    chimera: [
        ['주먹 적중', () => vfxAtDummy(CHIMERA_VFX.punchHit, 0)],
        ['클로 할퀴기', () => vfxAtDummy(CHIMERA_VFX.clawHit, 0)],
        ['졸개 소환', () => vfxAtDummy(CHIMERA_VFX.summon, 1, true)],
        ['지진 분쇄', () => vfxAtEachDummy(CHIMERA_VFX.quakeTick)],
        ['2페이즈 충격파', () => vfxAtSelf(CHIMERA_VFX.phase2Burst)]
    ],
    diver: [
        ['고압 방수포', previewJet],
        ['앵커 견인', previewAnchor],
        ['고압 분사', previewSurge],
        ['심연의 손', () => { vfxAtSelf(DIVER_VFX.abyssCall); vfxAtEachDummy(DIVER_VFX.hands); }],
        ['끌려와 착지', () => vfxAtDummy(DIVER_VFX.anchorLand, 0, true)]
    ],
    saint: [
        ['봉합 주사', () => previewNeedles(1)],
        ['3연발', () => { skill.castCb = () => previewNeedles(3); playOnce('triple'); }],
        ['생명 봉인 (켜기/끄기)', toggleSeal],
        ['시체 → 부활', () => vfxAtDummy(seq(SAINT_VFX.corpseStitch, SAINT_VFX.corpseRise, 0.9), 1, true)],
        ['억지 부활 발동', () => vfxAtSelf(SAINT_VFX.reviveCall)]
    ],
    frost: [
        ['서리 부채', () => previewFrostWave(54, 480, 2)],
        ['초승달 참격', () => { skill.castCb = () => previewFrostWave(130, 520, 9); playOnce('crescent'); }],
        ['눈보라 (켜기/끄기)', toggleBlizzard],
        ['빙결', () => vfxAtEachDummy(FROST_VFX.freeze)],
        ['영원한 안식', () => { vfxAtSelf(FROST_VFX.eternalCall); vfxAtEachDummy(seq(FROST_VFX.encase, FROST_VFX.shatter, 2.4)); }]
    ],
    doll: [
        ['가위 참격', () => vfxAtDummy(DOLL_VFX.snipHit, 0)],
        ['가위 참격 X자', () => { skill.castCb = () => vfxAtDummy(DOLL_VFX.xcut, 0); playOnce('xcut'); }],
        ['인형 내려옴', () => dummies.forEach(d => vfx.play(DOLL_VFX.dollDrop, d.x, GROUND_Y, { scale: VFX_SCALE, to: [d.x, GROUND_Y - 300 * VFX_SCALE * 0.56] }))],
        ['인형 터짐', () => vfxAtDummy(DOLL_VFX.dollBurst, 1, true)],
        ['인형 실', previewPuppet]
    ]
};

function previewVfx(i) {
    const list = PREVIEWS[character.id] || [];
    if (!list[i]) return;
    opts.dummies = true;
    list[i][1]();
    syncButtons();
    dirty = true;
}

// ---------------------------------------------------------------------------
// 캐릭터 · 스킬 탭: 캐릭터 카드, 고유 동작, 부위별 파츠·스킬 (PART_CATALOG — node tools/data/export_parts.mjs MD로 다시 만듦)
// ---------------------------------------------------------------------------
const SLOTS = [['arm', '팔', '스킬 1'], ['body', '몸통', '스킬 2'], ['head', '머리', '필살기'], ['leg', '다리', '패시브']];
const ALLIES = [['minion', '합성괴인 졸개'], ['rabbit', '토끼 인형']];
// 캐릭터 고유 동작 [이름, 클립 이름 | 함수] — 새 캐릭터는 리그 정의의 skillClips를 더함
const CHAR_ACTIONS = {
    mech: [['출격 점프', 'jump'], ['반사 실드 → 파괴', () => { shieldOn(); previewApi.later(1.2, breakShield); }]],
    kaiju: [['포효', 'roar']],
    hero: [['시전 동작', 'cast']],
    chimera: [['2페이즈 변신', phase2]]
};

const catalogOf = (id = state.char) => PART_CATALOG[id] || null;
const partById = id => (catalogOf() || []).find(p => p.id === id) || null;

/** 처음 장착: 부위마다 기본 파츠 (세트·강화가 아닌 첫 파츠) */
function defaultEquip(id) {
    const eq = {};
    for (const [slot] of SLOTS) {
        const list = (PART_CATALOG[id] || []).filter(p => p.slot === slot);
        const base = list.find(p => !p.variant && !p.upgrade) || list[0];
        if (base) eq[slot] = base.id;
    }
    return eq;
}

/** 장착한 파츠대로 그림: 세트(a·b·dragon) 부위 그림·색, 새 캐릭터 강화 그림, 거대로봇 무기 팔(근접 = 주먹, 나머지 = 캐논) */
function applyEquip() {
    if (!catalogOf()) return;
    const parts = Object.fromEntries(SLOTS.map(([slot]) => [slot, partById(state.equip[slot])]));
    const variants = {};
    for (const [slot, p] of Object.entries(parts)) if (p && p.variant) variants[slot] = p.variant;
    const { alias, tint } = variantAlias(character.id, layout, variants);
    skeleton.partAlias = alias;
    skeleton.variantSockets = variantSocketsFor(skeleton, alias, character);   // 세트 포신 총구 (D-118)
    skeleton.partFilters = Object.keys(tint).length ? tint : null;
    if (character.upgrade) {
        SLOTS.forEach(([slot]) => { state.upgrades[slot] = !!(parts[slot] && parts[slot].upgrade); });
        applyUpgrades(skeleton, character, state.upgrades);
    }
    if (character.arms && parts.arm) {
        // 게임과 같은 규칙 (rigAvatar.mechArmOf — 2차 세트는 rigArm). 카탈로그엔 rigArm이 없어 게임 파츠 표에서 찾음
        // (예전엔 attackType만 봐서 d 저격포·v 냉각포가 주먹 팔, u·m 주먹이 캐논 팔로 보였음)
        const game = V2_PARTS.arm.find(q => q.id === parts.arm.id);
        const kind = game ? mechArmOf(game) : parts.arm.attackType === 'melee' ? 'fist' : 'cannon';
        if (character.arms[kind] && kind !== state.arm) setArm(kind);
    }
    renderWho();
    dirty = true;
}

function equip(id) {
    const p = partById(id);
    if (!p) return;
    state.equip[p.slot] = id;
    applyEquip();
    syncButtons();
}

// 2차 세트 파츠(kit)는 손으로 짠 미리보기가 없으면 스킬 단계를 읽어 흉내 (skillPreviews.js kitPreview, 11-05 피드백 11번)
const previewOf = p => (p && p.skill && (SKILL_PREVIEWS[p.skill] || (p.kit && (p.slot === 'leg' ? kitPassivePreview(state.char) : kitPreview(p.skill, p.slot))))) || null;

/** 파츠 스킬 미리보기: 그 파츠를 장착하고(그림) 스킬 이펙트를 적에게 */
function playSkill(id) {
    const p = partById(id);
    const fn = previewOf(p);
    if (!fn) return false;
    if (state.equip[p.slot] !== id) equip(id);
    opts.dummies = true;
    fn(previewApi);
    syncButtons();
    dirty = true;
    return true;
}

/** 스킬 미리보기(skillPreviews.js)가 무대를 다루는 도구 */
const previewApi = {
    vfx, VFX_SCALE, GROUND_Y, CHAR_X, dummies,
    get character() { return character; },
    enemyChestY: () => dummyCenterY(),
    selfChest: () => [CHAR_X + 60, GROUND_Y - 180],
    at: vfxAtDummy,                    // (정의, 적 번호, 바닥?) 적 몸 / 발밑
    atEach: vfxAtEachDummy,            // (정의, 바닥?) 적마다
    atSelf: vfxAtSelf,                 // (정의) 캐릭터 발밑
    seq,
    muzzle: muzzlePoint,               // 무기 끝 (공격 소켓)
    socket: (socket, bone) => toStage(skeleton.socketWorld(socket, bone)),
    /** 클립 재생 + 'cast' 이벤트 순간에 onCast (클립에 cast가 없거나 클립이 없으면 바로/조금 뒤) */
    playClip(name, onCast) {
        if (onCast) skill.castCb = onCast;
        const ok = playOnce(name);
        if (onCast && !ok) {
            skill.castCb = null;
            onCast();
        } else if (onCast) {
            previewApi.later(character.clips[name].duration * 0.6, () => {
                if (skill.castCb !== onCast) return;
                skill.castCb = null;
                onCast();
            });
        }
        return ok;
    },
    later: (sec, fn) => timers.push({ t: sec, fn }),
    hit: (i = 0, slow = 0) => { dummies[i].flash = 0.08; if (slow) dummies[i].slow = slow; },
    shake: (amp = 6, dur = 0.25) => effects.shake(amp, dur),
    previews: {
        laser: previewLaser, missiles: previewMissiles, jet: previewJet, anchor: previewAnchor, surge: previewSurge,
        needles: previewNeedles, frostWave: previewFrostWave, puppet: previewPuppet, mindWave, launchWave,
        toggleCurse, toggleWave, toggleSeal, toggleBlizzard, shield: shieldOn, breakShield, phase2
    }
};

function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
}

function renderCharTab() {
    // 캐릭터 카드 (선택창과 같은 8명) + 아군
    const grid = document.getElementById('char-grid');
    if (grid && !grid.childElementCount) {
        ROSTER.forEach(c => {
            const b = el('button', null, (RIG_CHARACTERS[c.id] || RIG_NEW[c.id] || {}).name || c.faction);
            b.dataset.char = c.id;
            b.style.setProperty('--cc', c.color);
            b.addEventListener('click', () => setCharacter(c.id));
            grid.appendChild(b);
        });
        const allies = document.getElementById('ally-row');
        ALLIES.forEach(([id, name]) => {
            if (!(RIG_ENEMIES[id] || RIG_NEW[id])) return;
            const b = el('button', null, name);
            b.dataset.char = id;
            b.addEventListener('click', () => setCharacter(id));
            allies.appendChild(b);
        });
    }
    // 고유 동작
    const actions = [...(CHAR_ACTIONS[character.id] || []), ...(character.skillClips || [])]
        .filter(([, act]) => typeof act === 'function' || character.clips[act]);
    const row = document.getElementById('action-row');
    row.innerHTML = '';
    actions.forEach(([label, act]) => {
        const b = el('button', null, label);
        b.addEventListener('click', () => (typeof act === 'function' ? act() : playOnce(act)));
        row.appendChild(b);
    });
    document.getElementById('action-group').hidden = !actions.length;
    renderPartsList();
    // 기본 공격 · 그 밖의 이펙트 (예전 미리보기)
    const prev = document.getElementById('vfx-preview-row');
    prev.innerHTML = '';
    (PREVIEWS[character.id] || []).forEach(([label], i) => {
        const b = el('button', null, label);
        b.addEventListener('click', () => previewVfx(i));
        prev.appendChild(b);
    });
    document.getElementById('common-group').hidden = !(PREVIEWS[character.id] || []).length;
    renderWho();
}

const SET_TAG = p => (p.upgrade ? '<span class="tag up">강화</span>'
    : p.variant === 'a' ? '<span class="tag a">A</span>' : p.variant === 'b' ? '<span class="tag b">B</span>'
        : p.variant ? '<span class="tag a">추가</span>' : '');

function renderPartsList() {
    const box = document.getElementById('parts-list');
    const list = catalogOf();
    document.getElementById('parts-group').hidden = !list;
    box.innerHTML = '';
    if (!list) return;
    for (const [slot, label, kind] of SLOTS) {
        const parts = list.filter(p => p.slot === slot);
        if (!parts.length) continue;
        const sec = el('div', 'slot', `<div class="slot-head"><span>${label} · ${kind}</span><small>${parts.length}개</small></div>`);
        parts.forEach(p => {
            const fn = previewOf(p);
            const row = el('div', 'part-row', `<div><div class="name">${SET_TAG(p)}${p.name}<small>${p.set || ''}</small></div>
                <span class="skill">${p.skillName || '—'}${p.cd ? ` · ${p.cd}초` : ''}</span>
                <div class="desc">${p.desc || ''}</div></div>`);
            row.dataset.part = p.id;
            const play = el('button', 'play', '▶');
            play.disabled = !fn;
            play.title = fn ? '스킬 이펙트 보기' : '미리보기 없음 (게임에서 확인)';
            play.addEventListener('click', ev => { ev.stopPropagation(); playSkill(p.id); });
            row.appendChild(play);
            row.addEventListener('click', () => equip(p.id));
            sec.appendChild(row);
        });
        box.appendChild(sec);
    }
}

/** 무대 아래 줄: 캐릭터(장착 파츠) VS 적 */
function renderWho() {
    const set = (id, text) => { const n = document.getElementById(id); if (n) n.textContent = text; };
    if (!character) return;
    set('who-char', character.name);
    const list = catalogOf();
    set('who-parts', list ? SLOTS.map(([slot]) => (partById(state.equip[slot]) || {}).name).filter(Boolean).join(' · ')
        : (RIG_ENEMIES[state.char] ? '적 리그 (동작 확인)' : ''));
    const t = enemyType();
    const affix = state.affixes.map(a => ELITE_AFFIXES[a].name).join('·');
    set('who-enemy', `${state.elite || affix ? '엘리트 ' : ''}${affix ? `[${affix}] ` : ''}${enemyName(state.enemy)}`);
    const key = enemyArtKey();
    const zone = ENEMY_GROUPS.find(([, ids]) => ids.includes(state.enemy));
    set('who-enemy-sub', [zone && zone[0], key && key !== state.enemy && t ? `임시 그림: ${enemyName(key)}` : '',
        !showDummies() ? '숨김 (설정 탭)' : ''].filter(Boolean).join(' · '));
}

// ---------------------------------------------------------------------------
// 적 · 이펙트 탭: 무대 오른쪽의 적 (게임과 같은 구운 그림 ENEMY_ART, 그림이 없는 종류는 빌린 그림 artAs + 색조)
// ---------------------------------------------------------------------------
const ENEMY_GROUPS = [
    ['구역 1 · 지하 비밀 연구소', ['guard', 'shield', 'tranq', 'shock', 'medic', 'guardian']],
    ['구역 2 · 하부 쓰레기 폐기 정착지', ['raider', 'builder', 'sludge', 'netter', 'mechanic', 'scrapking']],
    ['구역 3 · 성왕국 수도', ['soldier', 'inquisitor', 'holyshield', 'priest', 'mage', 'demon', 'demonknight', 'archbishop']],
    ['구역 4 · 진화의 심연', ['cultist', 'tentacle', 'carapace', 'slime', 'slimelet', 'sporer', 'oculus']],
    ['그 밖', ['goblin']]
];
const BOSS_X = CHAR_X + 330 * VFX_SCALE * 0.56;   // 보스는 크니 한 마리만, 조금 앞에
const enemyImages = {};   // 그림 이름 → { walk: Image, attack: Image, ... }
const enemyType = (id = state.enemy) => ENEMY_TYPES[id] || null;
const enemyName = id => (id === 'goblin' ? '연습용 더미 (고블린)' : (ENEMY_TYPES[id] || {}).name || id);

function enemyArtKey(id = state.enemy) {
    if (ENEMY_ART[id]) return id;
    const t = ENEMY_TYPES[id];
    return t && t.artAs && ENEMY_ART[t.artAs] ? t.artAs : null;
}

function loadEnemyArt(key) {
    if (!key || enemyImages[key]) return;
    const a = ENEMY_ART[key];
    enemyImages[key] = {};
    for (const clip of Object.keys(a).filter(k => a[k] && a[k].src)) {
        const img = new Image();
        img.onload = () => { dirty = true; };
        img.src = a[clip].src;
        enemyImages[key][clip] = img;
    }
}

/** 적 자리: 3마리면 나란히, 1마리·보스면 세 자리를 한 곳에 모음 (스킬 미리보기가 셋을 노려도 한 적에게) */
function placeEnemies() {
    const t = enemyType();
    const single = state.enemyCount === 1 || (t && t.boss);
    dummies.forEach((d, i) => { d.x = single ? (t && t.boss ? BOSS_X : SPREAD_X[0]) : SPREAD_X[i]; });
}

const frontEnemy = () => dummies[0];

function setEnemy(id) {
    showcase = null;
    state.enemy = id;
    state.affixes = [];
    state.raged = false;
    loadEnemyArt(enemyArtKey(id));
    placeEnemies();
    opts.dummies = true;
    renderEnemyTab();
    renderWho();
    syncButtons();
    dirty = true;
}

// 적 쪽에서 캐릭터 쪽으로 (화면 좌표)
function enemyFrom() {
    const t = enemyType();
    return [frontEnemy().x - 30, GROUND_Y - (t && t.boss ? 190 : 95)];
}
const selfChest = () => [CHAR_X + 60, GROUND_Y - 180];
const atSelfChest = def => vfx.play(def, ...selfChest(), { scale: VFX_SCALE });
const atSelfGround = def => vfx.play(def, CHAR_X + 60, GROUND_Y, { scale: VFX_SCALE });
function atEnemy(def, ground = true) {
    vfx.play(def, frontEnemy().x, ground ? GROUND_Y : dummyCenterY(), { scale: VFX_SCALE });
}
function shoot(color, onHit = null, dur = 0.45) {
    vfx.launchOrb({ from: enemyFrom(), to: selfChest, color, dur, scale: VFX_SCALE, onArrive: () => onHit && onHit() });
}
function lob(color, onHit) {
    vfx.launchMissile({ from: enemyFrom(), to: () => [CHAR_X + 60, GROUND_Y - 60], dur: 0.95, apex: 150, color, scale: VFX_SCALE,
        onArrive: () => onHit && onHit() });
}
const warnHit = (warn, hit, delay) => vfx.play(seq(warn, hit, delay), CHAR_X + 60, GROUND_Y, { scale: VFX_SCALE });
const enemyFront = def => vfx.play(def, frontEnemy().x - 90, GROUND_Y - 40, { scale: VFX_SCALE * 0.7 });   // 적 바로 앞 (장벽 세우기)

// 적 기술: [이름, 설명, 재생] — 게임의 enemies_v2.js·battle/enemyField.js와 같은 이펙트
const ENEMY_SKILLS = {
    tranq: [['마취탄', '맞으면 감속', () => shoot('90, 230, 255')]],
    shock: [['감전', '근접 타격 — 짧은 기절', () => atSelfChest(BATTLE_VFX.shockHit)]],
    medic: [['치유 분사', '다친 적·거점 치유', () => atEnemy(KAIJU_VFX.regen)]],
    guardian: [
        ['방패 강타', '7초마다 — 기절', () => atSelfChest(BATTLE_VFX.shieldBash)],
        ['정의의 일격', '11초마다 예고 → 큰 피해', () => warnHit(BATTLE_VFX.smiteWarn, BATTLE_VFX.smiteHit, 1.2)],
        ['수호의 결계', '15초마다 3초 동안 피해 70% 감소 (D-057)', () => atEnemy(BOSS_VFX.guardianBarrier, false)]
    ],
    builder: [['바리케이드 세우기', '부숴야 진격', () => enemyFront(BATTLE_VFX.shieldBash)]],
    sludge: [['오물 투척', '발밑에 늪 장판 (감속)', () => shoot('190, 230, 40')]],
    netter: [['그물', '속박 — 진격만 막힘', () => shoot('210, 190, 140')]],
    mechanic: [['수리', '거점·바리케이드 수리', () => atEnemy(KAIJU_VFX.regen)]],
    scrapking: [
        ['자석', '붙잡아 뒤로 내던짐', () => shoot('120, 200, 255', null, 0.25)],
        ['고철 낙하', '예고 원 → 큰 피해', () => warnHit(BATTLE_VFX.smiteWarn, BATTLE_VFX.baseBlast, 1.3)],
        ['고철 방벽 투하', '16초마다 자기 앞에 바리케이드 (D-057)', () => enemyFront(BATTLE_VFX.shieldBash)]
    ],
    holyshield: [['방패 장벽', '부숴야 진격', () => enemyFront(BATTLE_VFX.shieldBash)]],
    priest: [['신관 치유', '병사만 조금 치유', () => atEnemy(ZONE_VFX.holyHeal)]],
    mage: [
        ['원소탄 · 불', '화상 3초 (D-057)', () => shoot('255, 140, 40', () => atSelfChest(ZONE_VFX.spellFire), 0.36)],
        ['원소탄 · 번개', '짧은 기절 0.4초', () => shoot('255, 240, 120', () => atSelfChest(ZONE_VFX.spellBolt), 0.36)],
        ['원소탄 · 얼음', '감속 1.5초', () => shoot('150, 220, 255', () => atSelfChest(ZONE_VFX.spellIce), 0.36)]
    ],
    demonknight: [['도끼 내려찍기', '5초마다 — 최대 내구도 5%', () => atSelfChest(ZONE_VFX.axeCleave)]],
    archbishop: [
        ['천상의 심판', '9초마다 예고 → 빛의 기둥', () => warnHit(ZONE_VFX.judgmentWarn, ZONE_VFX.heavenPillar, 1.4)],
        ['악마병 소환 (지옥문)', '체력 50% 아래 — 악마병 2기', () => [0, 1].forEach(i =>
            vfx.play(ZONE_VFX.hellGate, frontEnemy().x - 110 - i * 60, GROUND_Y, { scale: VFX_SCALE }))],
        ['속죄의 사슬', '13초마다 속박 1.6초 (D-057)', () => vfx.launchChain({
            from: enemyFrom, to: selfChest, color: '255, 214, 120', scale: VFX_SCALE,
            onHook: (x, y) => vfx.play(BOSS_VFX.chainHit, x, y, { scale: VFX_SCALE })
        })]
    ],
    slime: [['분열', '쓰러지면 작은 슬라임 2기', () => atEnemy(ZONE_VFX.slimeSplit)]],
    sporer: [['포자 덩어리', '곡사', () => lob('150, 255, 90', () => atSelfGround(ZONE_VFX.sporeBurst))]],
    oculus: [
        ['심연의 파동', '8초마다 예고 → 촉수', () => {
            atSelfGround(ZONE_VFX.abyssWarn);
            [-38, 0, 38].forEach((dx, i) => previewApi.later(1 + i * 0.06, () =>
                vfx.play(BATTLE_VFX.abyssSpike, CHAR_X + 60 + dx, GROUND_Y, { scale: VFX_SCALE * (0.8 + i * 0.15) })));
        }],
        ['유전자 붕괴', '긴 감속 4초', () => shoot('150, 255, 90', () => atSelfGround(ZONE_VFX.gooSplat), 0.5)],
        ['극한의 변이', '체력 50% — 2페이즈 (다시 누르면 원래대로)', () => {
            state.raged = !state.raged;
            if (state.raged) atEnemy(ZONE_VFX.mutationBurst, false);
            renderWho();
        }],
        ['2페이즈 돌진', '7초마다 달려들어 밀어냄', () => atSelfChest(ZONE_VFX.chargeImpact)],
        ['진홍 시선', '2페이즈 9초마다 광선 (D-057)', () =>
            vfx.play(seq(BOSS_VFX.gazeWarn, BOSS_VFX.gaze, 1), frontEnemy().x - 20, GROUND_Y - 300, { scale: VFX_SCALE, to: selfChest() })]
    ]
};
// 구역 기믹·거점 사격 (적 종류와 상관없이)
const ZONE_FX = [
    ['구역 1 · EMP 포격', '보스전 기지 — 주인공 기절, 적 보병 전멸', () => vfx.play(BATTLE_VFX.emp, frontEnemy().x, GROUND_Y - 250, { scale: VFX_SCALE * 0.6 })],
    ['구역 2 · 유독 가스', '보스전 소각탑 — 전장 전체 감속', () => vfx.play(ZONE_VFX.toxicBurst, frontEnemy().x, GROUND_Y - 280, { scale: 0.8 })],
    ['구역 3 · 심연의 문 개방', '3-B 보스전 — 악마기사(엘리트) 소환', () => atEnemy(ZONE_VFX.abyssGate)],
    ['구역 3 · 통제탑 화살', '요새가 다가오면 사격', () => vfx.launchNeedle({
        from: [frontEnemy().x, GROUND_Y - 330], to: selfChest, color: '255, 214, 120', dur: 0.3, scale: VFX_SCALE,
        onArrive: () => atSelfChest(ZONE_VFX.arrowHit) })],
    ['구역 4 · 유기질 벽 독액', '피해 + 독 웅덩이', () => vfx.launchOrb({
        from: [frontEnemy().x, GROUND_Y - 250], to: () => [CHAR_X + 60, GROUND_Y - 10], color: '150, 255, 90', dur: 0.5,
        scale: VFX_SCALE, onArrive: () => atSelfGround(ZONE_VFX.venomSplash) })]
];
// 엘리트 속성: 누르면 이 적에 붙이고(최대 2개) 그 속성 이펙트
const AFFIX_FX = {
    swift: () => atEnemy({ layers: [{ type: 'motes', at: 0, count: 16, spread: 40, rise: [5, 20], life: [0.3, 0.6], size: 2.5,
        color: ELITE_AFFIXES.swift.color }] }),
    shielded: () => atEnemy(ELITE_VFX.shieldBreak, false),
    thorns: () => atEnemy(ELITE_VFX.thornsSpark, false),
    regen: () => atEnemy(ELITE_VFX.regenMotes),
    frost: () => atSelfChest(ELITE_VFX.frostHit),
    toxic: () => atEnemy(ELITE_VFX.toxicCloud),
    volatile: () => atEnemy(seq(ELITE_VFX.volatileWarn, ELITE_VFX.volatileBlast, 1)),
    iron: () => atEnemy(ELITE_VFX.ironSpark, false)
};

function playEnemyFx(fn) {
    opts.dummies = true;
    fn();
    dummies.forEach(d => { d.flash = 0.08; });
    syncButtons();
    dirty = true;
}

function toggleAffix(id) {
    const i = state.affixes.indexOf(id);
    if (i >= 0) state.affixes.splice(i, 1);
    else {
        state.affixes.push(id);
        if (state.affixes.length > 2) state.affixes.shift();
        state.elite = true;
        playEnemyFx(AFFIX_FX[id]);
    }
    renderWho();
    syncButtons();
    dirty = true;
}

function fxRow(name, desc, fn) {
    const row = el('div', 'fx-row', `<div class="name">${name}<small>${desc || ''}</small></div>`);
    const play = el('button', 'play', '▶');
    play.addEventListener('click', () => playEnemyFx(fn));
    row.appendChild(play);
    return row;
}

function renderEnemyTab() {
    const list = document.getElementById('enemy-list');
    if (list && !list.childElementCount) {
        ENEMY_GROUPS.forEach(([zone, ids]) => {
            const block = el('div', 'zone-block', `<div class="zone-name">${zone}</div>`);
            const chips = el('div', 'enemy-chips');
            ids.forEach(id => {
                const t = ENEMY_TYPES[id];
                const b = el('button', t && t.boss ? 'boss' : '', `${t && t.boss ? '★ ' : ''}${enemyName(id)}`);
                b.dataset.enemy = id;
                b.addEventListener('click', () => setEnemy(id));
                chips.appendChild(b);
            });
            block.appendChild(chips);
            list.appendChild(block);
        });
        const affixes = document.getElementById('affix-row');
        Object.entries(ELITE_AFFIXES).forEach(([id, a]) => {
            const b = el('button', null, a.name);
            b.dataset.affix = id;
            b.style.borderLeft = `3px solid rgb(${a.color})`;
            b.addEventListener('click', () => toggleAffix(id));
            affixes.appendChild(b);
        });
        const zoneList = document.getElementById('zone-fx-list');
        ZONE_FX.forEach(([name, desc, fn]) => zoneList.appendChild(fxRow(name, desc, fn)));
    }
    const skills = document.getElementById('enemy-skill-list');
    skills.innerHTML = '';
    const rows = ENEMY_SKILLS[state.enemy] || [];
    rows.forEach(([name, desc, fn]) => skills.appendChild(fxRow(name, desc, fn)));
    if (!rows.length) skills.appendChild(el('div', 'empty', '특수 기술 없음 — 근접 공격만 (아래 "적" 공격 동작으로 확인)'));
    const rig = document.getElementById('btn-enemy-rig');
    if (rig) rig.disabled = !RIG_ENEMIES[enemyArtKey()];
}

function vfxVariantKeys() {
    return Object.entries(VFX_VARIANTS).map(([key, e]) => ({ key, name: e.name,
        variants: Object.entries(e.variants).map(([id, v]) => ({ id, label: v.label })) }));
}

function setVfxVariant(key, id) {
    if (!applyVfxVariant(key, id)) return false;
    const full = VFX_VARIANTS[key] ? key : Object.keys(VFX_VARIANTS).find(k => k.split('.')[1] === key);
    vfxChoices[full] = id;
    try { localStorage.setItem('vfxChoices', JSON.stringify(vfxChoices)); } catch { /* 저장 불가여도 미리보기 가능 */ }
    syncVfxButtons();
    dirty = true;
    return true;
}

function setVfxStyle(style) {
    if (!['glow', 'pixel'].includes(style)) return false;
    vfx.style = style;
    try { localStorage.setItem('vfxStyle', style); } catch { /* 저장 불가여도 미리보기 가능 */ }
    syncVfxButtons();
    dirty = true;
    return true;
}

function syncVfxButtons() {
    document.querySelectorAll('[data-vfx-key]').forEach(b =>
        b.classList.toggle('active', (vfxChoices[b.dataset.vfxKey] || 'A') === b.dataset.vfxId));
    const pixel = document.getElementById('vfx-pixel');
    if (pixel) pixel.checked = vfx.style === 'pixel';
}

function renderVfxVariants() {
    const list = document.getElementById('vfx-variant-list');
    for (const { key, name, variants } of vfxVariantKeys()) {
        const row = el('div', 'vfx-variant-row');
        row.appendChild(el('span', 'name', name));
        for (const { id, label } of variants) {
            const b = el('button', null, id);
            b.title = label;
            b.dataset.vfxKey = key;
            b.dataset.vfxId = id;
            b.addEventListener('click', () => setVfxVariant(key, id));
            row.appendChild(b);
        }
        const play = el('button', 'play', '▶');
        play.title = `${name} 재생`;
        play.addEventListener('click', async () => {
            try { await vfxShowcase(key); state.paused = false; syncButtons(); }
            catch (err) { console.error(err); }
        });
        row.appendChild(play);
        list.appendChild(row);
    }
    document.getElementById('vfx-pixel').addEventListener('change', e => setVfxStyle(e.target.checked ? 'pixel' : 'glow'));
    syncVfxButtons();
}

function vfxDuration(def) {
    return Math.max(0.1, ...def.layers.map(l => {
        const life = Array.isArray(l.life) ? Math.max(...l.life) : l.life;
        return (l.at || 0) + Math.max(l.dur || 0, life || 0.9) * (l.type === 'goo' ? 1.7 : 1);
    }));
}

/** 장면 에셋 준비 후 초 단위 길이를 반환. 재호출하면 예약·입자·포즈를 처음부터 시작한다. */
async function vfxShowcase(key) {
    const full = VFX_VARIANTS[key] ? key : Object.keys(VFX_VARIANTS).find(k => k.split('.')[1] === key);
    const entry = VFX_VARIANTS[full];
    if (!entry) throw new Error(`알 수 없는 이펙트: ${key}`);
    const request = ++showcaseRequest, scene = entry.scene;
    vfx.clear();
    timers.length = 0;
    state.mode = 'idle';
    const loading = showcaseLoad.catch(() => {}).then(() => setCharacter(scene.character));
    showcaseLoad = loading;
    await loading;
    if (request !== showcaseRequest) return 0;
    if (scene.arm) setArm(scene.arm);
    if (scene.part) equip(scene.part);
    state.enemyCount = 1;
    state.enemyMode = 'walk';
    state.elite = scene.kind === 'spawn';
    setEnemy(scene.enemy || 'guard');
    const images = enemyImages[enemyArtKey()] || {};
    await Promise.all(Object.values(images).map(img => img.decode().catch(() => {})));
    if (request !== showcaseRequest) return 0;
    opts.fx = opts.dummies = true;
    opts.bones = opts.pixel = opts.stepped = false;
    opts.speed = 1;
    effects.clear();
    vfx.clear();
    vfx.seed = 7331;
    vfx.time = simTime = acc = 0;
    groundOffset = 0;
    springs.forEach(s => s.reset());
    dummies.forEach(d => { d.flash = d.slow = 0; });
    const kind = scene.kind, target = dummies[0];
    if (['melee', 'defeat', 'baseHit', 'charge'].includes(kind)) dummies.forEach(d => { d.x = CHAR_X + 170; });
    const clip = scene.clip === 'attack' ? clipFor('attack') : scene.clip;
    const clipDef = character.clips[clip];
    let hitAt = (clipDef?.events || []).find(([, name]) => name === 'impact' || name === 'fire' || name === 'cast')?.[0] ?? 0.2;
    if (kind === 'breath') hitAt = 0.4;
    if (['enemyGround', 'enemyHit', 'enemyBeam', 'finale', 'spawn'].includes(kind)) hitAt = 0.1;
    showcase = { key: full, kind, age: 0, hitAt };
    const selected = entry.variants[vfxChoices[full] || 'A'].def;
    if (kind === 'breath') {
        playSkill(scene.part);
    } else {
        if (clip) playOnce(clip);
        if (kind === 'shatter') {
            vfx.play({ layers: [{ type: 'crystals', at: 0, dur: hitAt, count: 4, h: 95, spread: 28, color: ICE }] },
                target.x, GROUND_Y, { scale: VFX_SCALE });
        }
        if (['enemyHit', 'enemyGround', 'enemyBeam'].includes(kind)) state.enemyMode = 'attack';
        previewApi.later(hitAt, () => {
            // self: 캐릭터 몸(시전·회전 베기) / selfGround: 캐릭터 발밑(착지·오라) / enemyBeam: 적 → 캐릭터 가슴 광선
            const point = ['enemyHit', 'enemyBeam', 'self'].includes(kind) ? selfChest()
                : ['enemyGround', 'selfGround'].includes(kind) ? [CHAR_X + 60, GROUND_Y]
                : ['shatter', 'charge', 'defeat', 'spawn', 'finale'].includes(kind) ? [target.x, GROUND_Y]
                : [target.x, dummyCenterY()];
            const play = () => {
                const from = kind === 'beam' ? muzzlePoint() : kind === 'enemyBeam' ? [target.x - 20, dummyCenterY() - 20] : point;
                const to = kind === 'beam' || kind === 'enemyBeam' ? { to: point } : {};
                vfx.play(selected, ...from, { scale: VFX_SCALE, ...to });
                target.flash = 0.08;
            };
            if (kind === 'missile') vfx.launchMissile({ from: muzzlePoint(), to: () => point, dur: 0.45, apex: 55,
                scale: VFX_SCALE, onArrive: play });
            else play();
        });
    }
    const duration = kind === 'breath' ? 6.8 : Math.max(clipDef?.duration || 0,
        hitAt + (kind === 'missile' ? 0.45 : 0) + vfxDuration(selected)) + 0.2;
    tick(0);
    syncButtons();
    render();
    return duration;
}

// 처치/등장 비교 장면에서만 스프라이트를 쓰러뜨리거나 솟으며 사라지고 나타나게 한다.
function transformShowcaseEnemy(ctx, d) {
    if (!showcase) return;
    const t = Math.max(0, showcase.age - showcase.hitAt);
    if (showcase.kind === 'defeat') {
        const u = Math.min(1, t / 0.4);
        ctx.globalAlpha *= 1 - u;
        ctx.translate(d.x, GROUND_Y);
        ctx.rotate(u * Math.PI * 0.35);
        ctx.scale(1 - u * 0.25, 1 - u * 0.2);
        ctx.translate(-d.x, -GROUND_Y);
    } else if (showcase.kind === 'spawn') {
        const u = Math.min(1, t / 0.45);
        ctx.globalAlpha *= u;
        ctx.translate(0, (1 - u) * 35);
    } else if (showcase.kind === 'finale') {
        ctx.globalAlpha *= 1 - Math.min(1, t / 0.5);
        ctx.translate(0, Math.min(1, t / 0.5) * 25);
    }
}

/** 적 그리기: 구운 스프라이트(걷기·공격) + 종류 색조·엘리트 금빛·속성 색, 맞으면 번쩍 */
function drawEnemies(ctx, view) {
    if (!showDummies()) return;
    if (state.enemy === 'goblin') return drawGoblins(ctx, view);
    const key = enemyArtKey();
    const a = key && ENEMY_ART[key];
    const imgs = key && enemyImages[key];
    if (!a || !imgs) return;
    const t = enemyType();
    const clip = state.enemyMode === 'attack' && a.attack ? 'attack' : 'walk';
    const img = imgs[clip];
    if (!img || !img.complete || !img.naturalWidth) return;
    const c = a[clip];
    const own = key === state.enemy;
    const rage = state.raged && t.rage;
    const k = VFX_SCALE * (own ? 1 : t.scale || 1) * (state.elite && !t.boss ? 1.3 : 1) * (rage ? t.rage.scale : 1);
    const w = a.frameWidth * k, h = a.frameHeight * k;
    const sw = img.naturalWidth / c.frames;
    const base = [rage ? t.rage.tint : own ? '' : t.tint || '', state.elite && !t.boss ? 'drop-shadow(0 0 5px #ffd24a)' : '',
        state.affixes.length ? `drop-shadow(0 0 7px rgb(${ELITE_AFFIXES[state.affixes[0]].color}))` : ''].filter(Boolean).join(' ');
    const seen = new Set();
    ctx.save();
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
    dummies.forEach((d, i) => {
        if (seen.has(d.x)) return;   // 한 자리에 모였으면 한 번만
        seen.add(d.x);
        ctx.save();
        transformShowcaseEnemy(ctx, d);
        ctx.filter = d.flash > 0 ? 'brightness(2.4) saturate(0.2)'
            : d.slow > 0 ? `${base} drop-shadow(0 0 6px #b050ff) saturate(0.55)` : (base || 'none');
        const f = (Math.floor(((simTime % c.duration) / c.duration) * c.frames) + i * 3) % c.frames;   // 발걸음이 모두 같지 않게
        ctx.drawImage(img, f * sw, 0, sw, img.naturalHeight, d.x - a.anchorX * k, GROUND_Y - h + 3 * VFX_SCALE, w, h);
        ctx.restore();
    });
    ctx.restore();
}

function drawGoblins(ctx, view) {
    if (!goblinImg || !goblinImg.complete || !goblinImg.naturalHeight) return;
    ctx.save();
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
    const fh = goblinImg.naturalHeight;
    const size = 76 * VFX_SCALE * 0.56 * 1.8;
    const seen = new Set();
    for (const d of dummies) {
        if (seen.has(d.x)) continue;
        seen.add(d.x);
        ctx.filter = d.flash > 0 ? 'brightness(2.4) saturate(0.2)'
            : d.slow > 0 ? 'drop-shadow(0 0 6px #b050ff) saturate(0.55) brightness(0.9)' : 'none';
        ctx.drawImage(goblinImg, 0, 0, fh, fh, d.x - size / 2, GROUND_Y - size + 8, size, size);
    }
    ctx.restore();
}

/** 적의 리그를 크게 (동작 확인·굽기용) — 캐릭터 · 스킬 탭의 카드를 누르면 돌아감 */
function viewEnemyRig() {
    const key = enemyArtKey();
    if (!RIG_ENEMIES[key]) return;
    setCharacter(key);
}

function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ['char', 'enemy', 'vfx', 'opt'].forEach(t => { const n = document.getElementById(`tab-${t}`); if (n) n.hidden = t !== tab; });
}

function setArm(id) {
    if (!character.arms) return;
    state.arm = id;
    skeleton.setPart(character.weaponBone, character.arms[id].part);
    if (state.mode === 'attack') {
        effects.stopCharge();
        animator.play(clipFor('attack'), opts.crossfade ? FADE_SEC : 0);
    }
    syncButtons();
    dirty = true;
}

/** 강화 그림 바꿔 끼우기: 'all' | 'none' | 슬롯 하나 켜고 끄기, 또는 { head, body, arm, leg } */
function setUpgrades(which) {
    const u = state.upgrades;
    if (typeof which === 'object') Object.assign(u, which);
    else if (which === 'all' || which === 'none') Object.keys(u).forEach(k => { u[k] = which === 'all'; });
    else u[which] = !u[which];
    applyUpgrades(skeleton, character, u);
    syncButtons();
    dirty = true;
}

function setOption(key, value) {
    opts[key] = value;
    if (key === 'springs' && !value) springs.forEach(s => s.reset());
    syncButtons();
    dirty = true;
}

// ---------------------------------------------------------------------------
// 렌더링
// ---------------------------------------------------------------------------
function render() {
    const P = opts.pixel ? PIXEL : 1;
    const ctx = opts.pixel ? offCtx : mainCtx;
    const [sx, sy] = effects.shakeOffset();
    const view = [1 / P, 0, 0, 1 / P, sx / P, sy / P];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (opts.bg) drawBackground(ctx, view);
    if (opts.fx) {
        ctx.save();
        ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
        vfx.draw(ctx, 'ground');
        ctx.restore();
    }
    drawEnemies(ctx, view);
    if (opts.fx) effects.drawBack(ctx, view);
    skeleton.draw(ctx, Mat.mul(view, stageM));
    if (opts.fx) {
        effects.draw(ctx, view);
        ctx.save();
        ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
        vfx.draw(ctx, 'front');
        ctx.restore();
    }

    if (opts.pixel) {
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.imageSmoothingEnabled = false;
        mainCtx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, 0, 0, STAGE_W, STAGE_H);
    }
    if (opts.bones) {
        const sockets = character.arms ? [hitSocket(), ...character.debugSockets] : character.debugSockets;
        skeleton.drawDebug(mainCtx, Mat.mul([1, 0, 0, 1, sx, sy], stageM), sockets);
    }
    if (opts.bg && !CAPTURE && !EMBED) drawHud();
}

function drawBackground(ctx, view) {
    ctx.save();
    ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#07071a');
    sky.addColorStop(1, '#1d1033');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, STAGE_W + 40, GROUND_Y + 20);

    // 원경 빌딩 (느린 패럴랙스)
    const far = groundOffset * 0.25;
    ctx.fillStyle = '#16122b';
    for (let i = -1; i < 14; i++) {
        const w = 70 + ((i * 47) % 5) * 12;
        const h = 90 + ((i * 71) % 7) * 28;
        const x = ((i * 90 - far) % 1260 + 1260) % 1260 - 150;
        ctx.fillRect(x, GROUND_Y - h, w, h);
    }

    // 지면 + 스크롤 눈금 (발 미끄러짐 확인용)
    ctx.fillStyle = '#100c1c';
    ctx.fillRect(-20, GROUND_Y, STAGE_W + 40, STAGE_H - GROUND_Y + 20);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(-20, GROUND_Y, STAGE_W + 40, 2);
    ctx.fillStyle = 'rgba(0, 255, 204, 0.35)';
    const tile = 80;
    for (let x = -(groundOffset % tile) - tile; x < STAGE_W + tile; x += tile) {
        ctx.fillRect(x, GROUND_Y + 12, 34, 4);
        ctx.fillRect(x + 20, GROUND_Y + 40, 46, 4);
    }

    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(CHAR_X, GROUND_Y + 2, character.shadow.rx * CHAR_SCALE, character.shadow.ry * CHAR_SCALE, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHud() {
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.fillStyle = 'rgba(5, 5, 12, 0.7)';
    mainCtx.fillRect(10, 10, 320, 48);
    mainCtx.fillStyle = '#00ffcc';
    mainCtx.font = 'bold 14px Chakra Petch, sans-serif';
    mainCtx.fillText(`${character.name}  CLIP ${animator.currentName}  t=${animator.currentTime.toFixed(2)}s`, 20, 30);
    mainCtx.fillStyle = '#c8c8ff';
    mainCtx.font = '12px Chakra Petch, sans-serif';
    const flags = [opts.pixel && `도트 ${STAGE_W / PIXEL}x${STAGE_H / PIXEL}`, opts.stepped && `${STEP_FPS}fps`,
        !opts.crossfade && '보간 끔', !opts.springs && '스프링 끔'].filter(Boolean).join(' · ');
    mainCtx.fillText(flags || '고해상도 · 60fps', 20, 49);
    mainCtx.restore();
}

// ---------------------------------------------------------------------------
// 루프
// ---------------------------------------------------------------------------
let last = performance.now();
let acc = 0;
let sinceRender = 1;

function simulate(sec) {
    acc += sec;
    while (acc >= FIXED_DT) {
        tick(FIXED_DT);
        acc -= FIXED_DT;
        sinceRender += FIXED_DT;
    }
}

function loop(now) {
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!state.paused) simulate(real * opts.speed);
    if (dirty || !opts.stepped || sinceRender >= 1 / STEP_FPS) {
        try {
            render();
        } catch (err) {   // 이펙트 하나가 잘못돼도 화면이 멈추지 않게 (오류는 콘솔에 — 검사가 잡음)
            console.error(err);
        }
        sinceRender = 0;
        dirty = false;
    }
    requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function bindUI() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
    document.querySelectorAll('[data-mode]').forEach(btn =>
        btn.addEventListener('click', () => setMode(btn.dataset.mode)));
    document.querySelectorAll('[data-enemy-mode]').forEach(btn => btn.addEventListener('click', () => {
        state.enemyMode = btn.dataset.enemyMode;
        syncButtons();
        dirty = true;
    }));
    document.querySelectorAll('[data-enemy-count]').forEach(btn => btn.addEventListener('click', () => {
        state.enemyCount = Number(btn.dataset.enemyCount);
        placeEnemies();
        syncButtons();
        dirty = true;
    }));
    document.getElementById('btn-elite').addEventListener('click', () => {
        state.elite = !state.elite;
        if (!state.elite) state.affixes = [];
        renderWho();
        syncButtons();
        dirty = true;
    });
    document.getElementById('btn-enemy-rig').addEventListener('click', viewEnemyRig);
    document.querySelectorAll('[data-opt]').forEach(input =>
        input.addEventListener('change', () => setOption(input.dataset.opt, input.checked)));

    const speed = document.getElementById('opt-speed');
    const speedLabel = document.getElementById('opt-speed-value');
    speed.addEventListener('input', () => {
        opts.speed = Number(speed.value);
        speedLabel.textContent = `${opts.speed.toFixed(2)}x`;
    });
    const togglePause = () => {
        state.paused = !state.paused;
        syncButtons();
    };
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-pause-2').addEventListener('click', togglePause);
    document.getElementById('btn-step').addEventListener('click', () => {
        state.paused = true;
        simulate(1 / STEP_FPS);
        dirty = true;
        syncButtons();
    });
    syncButtons();
}

function syncButtons() {
    const on = (sel, test) => document.querySelectorAll(sel).forEach(b => b.classList.toggle('active', test(b)));
    on('[data-char]', b => b.dataset.char === state.char);
    on('[data-mode]', b => b.dataset.mode === state.mode);
    on('[data-enemy-mode]', b => b.dataset.enemyMode === state.enemyMode);
    on('[data-enemy-count]', b => Number(b.dataset.enemyCount) === state.enemyCount);
    on('[data-enemy]', b => b.dataset.enemy === state.enemy);
    on('[data-affix]', b => state.affixes.includes(b.dataset.affix));
    on('#btn-elite', () => state.elite);
    document.querySelectorAll('[data-opt]').forEach(i => { i.checked = !!opts[i.dataset.opt]; });
    document.querySelectorAll('.part-row').forEach(r => r.classList.toggle('is-on', state.equip[(partById(r.dataset.part) || {}).slot] === r.dataset.part));
    const boss = enemyType() && enemyType().boss;
    document.querySelectorAll('[data-enemy-count]').forEach(b => { b.disabled = !!boss; });
    const pause = document.getElementById('btn-pause');
    if (pause) pause.textContent = state.paused ? '▶ 재생' : '❚❚ 일시정지';
    const pause2 = document.getElementById('btn-pause-2');
    if (pause2) pause2.textContent = state.paused ? '▶' : '❚❚';
}

function renderLog() {
    const ul = document.getElementById('event-log');
    if (ul) ul.innerHTML = eventLog.map(line => `<li>${line}</li>`).join('');
}

// 자동 검증/디버그용 훅 (브라우저 콘솔에서도 사용 가능)
window.rigTest = {
    ready: init().catch(err => {
        const el = document.getElementById('rig-loading');
        if (el) el.textContent = `로드 실패: ${err.message}`;
        console.error(err);
        throw err;
    }),
    setCharacter,
    setMode,
    setArm,
    setUpgrades,
    setOption,
    playOnce,
    clipDuration: name => character.clips[name].duration,
    anchor: [CHAR_X, GROUND_Y],      // 캐릭터 뿌리(발 사이 바닥)의 캔버스 좌표 (굽기 도구가 기준점으로 씀)
    toggleCurse,
    mindWave,
    toggleWave,
    previewVfx,
    vfxVariantKeys,
    setVfxVariant,
    setVfxStyle,
    vfxShowcase,
    previews: () => (PREVIEWS[character.id] || []).map(([label]) => label),
    // 캐릭터 · 스킬 / 적 · 이펙트 탭 (자동 검사·콘솔)
    equip,
    playSkill,
    skills: () => (catalogOf() || []).map(p => ({ id: p.id, slot: p.slot, skill: p.skill, name: p.skillName, preview: !!previewOf(p) })),
    setEnemy,
    setTab,
    toggleAffix,
    enemySkills: () => (ENEMY_SKILLS[state.enemy] || []).map(([name]) => name),
    playEnemySkill: i => { const r = (ENEMY_SKILLS[state.enemy] || [])[i]; if (r) playEnemyFx(r[2]); return !!r; },
    playZoneFx: i => { const r = ZONE_FX[i]; if (r) playEnemyFx(r[2]); return !!r; },
    api: previewApi,
    phase2,
    breakShield,
    pause() { state.paused = true; syncButtons(); },
    resume() { state.paused = false; syncButtons(); },
    step(sec) { simulate(sec); render(); },
    render,
    get info() {
        return { char: state.char, clip: animator.currentName, time: animator.currentTime, simTime,
            vfxStyle: vfx.style, vfxChoices: { ...vfxChoices }, showcase: showcase && { ...showcase },
            opts: { ...opts }, events: [...eventLog], equip: { ...state.equip }, enemy: state.enemy,
            enemyX: dummies.map(d => d.x), elite: state.elite, affixes: [...state.affixes], alias: skeleton.partAlias };
    }
};
