/* ==========================================================================
   PROJECT: MAD OVERLORD // RIG AVATAR (v2)
   캔버스 하나에 리그 캐릭터를 그리는 게임용 래퍼. monster_v2.js가 메뉴/전투 캔버스마다 하나씩 생성한다.
   - setCharacter('mech' | 'kaiju' | 'hero' | 'chimera' | 'diver' | 'saint' | 'frost' | 'doll' | 'architect' | 'broadcaster', scale?), setMode('idle' | 'walk' | 'attack' | 'victory'),
     setArm('cannon' | 'fist'), setVariants({ head: 'a', ... }) (A·B 세트 부위 그림, D-050),
     setUpgrades({ head, body, arm, leg }) (새 캐릭터 강화 부위 그림, D-044)
   - consumeHit(): 공격 클립의 fire/impact 이벤트가 쌓은 타격량을 전투 엔진이 가져감
   - muzzlePoint(): 공격 소켓(총구/입)의 캔버스 좌표 (전투 엔진의 레이저 시작점)
   - headTop(): 머리 위(체력바 자리)의 캔버스 좌표
   - playOnce(clip): 점프/변신처럼 한 번 재생하고 현재 상태 동작으로 복귀
     걷는 중이면 다리 뼈는 걷기 동작을 그대로 이어 감 (다리 층 — 스킬을 쓰며 걸어도 발이 멈춰 미끄러지지 않게, Q-008 Q3)
   - react(name): 맞음·밀림·기절 반응을 지금 동작 위에 더함 (reactions.js, Q4) — 기절로 동작이 멈춰도 반응은 움직임
   - enterPhase2() / shieldHit() / breakShield() / resetSkills(): 2페이즈 거대화 + 육각 실드
   ========================================================================== */

import { Animator, Skeleton, Spring, Mat, samplePose } from './rig.js';
import { RIG_CHARACTERS, attackClipOf, hitSocketOf } from './characters.js';
import { RigEffects } from './rigEffects.js';
import { gameTime } from '../gameTime.js';
import { characterOfPart } from '../roster_v2.js';
import { displayRes } from '../displayRes.js';
import { REACTIONS, LOWER_BONE, WIND } from './reactions.js';

const FIXED_DT = 1 / 120;
const FADE_SEC = 0.18;
const FOOT_EVENTS = new Set(['step', 'stomp']);   // 다리 층(걸으며 스킬)에서도 넘기는 걸음 이벤트 (발먼지·짓밟기)
const TEST_PAGE_SCALE = 0.42; // rigEffects의 기준 크기(rig_test.html 캐릭터 배율)
export const PHASE2_SCALE = 1.3; // 2페이즈 거대화 배율
const SHIELD_COLOR = '255, 200, 60';

/** 기본 자세 파츠 범위 (루트 피벗 기준 원본 px): 실드 크기/메뉴 맞춤에 사용 */
export function restBounds(layout) {
    const root = layout.pivots.root;
    let minX = Infinity, maxX = -Infinity, minY = Infinity;
    for (const p of Object.values(layout.parts)) {
        minX = Math.min(minX, p.x - root[0]);
        maxX = Math.max(maxX, p.x + p.w - root[0]);
        minY = Math.min(minY, p.y - root[1]);
    }
    return { minX, maxX, minY };
}

/** 실드 돔 크기/위치 (화면 좌표): 캐릭터 기본 자세 범위를 감싸는 타원 */
export function shieldGeom(bounds, toScreen, scale) {
    const [x, y] = toScreen([(bounds.minX + bounds.maxX) / 2, bounds.minY / 2]);
    return { x, y, rx: ((bounds.maxX - bounds.minX) / 2) * 1.02 * scale, ry: (-bounds.minY / 2) * 1.08 * scale };
}

/** 거대화 배율 트윈 (살짝 넘쳤다 돌아오는 easeOutBack) */
export class ScaleTween {
    constructor() {
        this.value = 1;
        this.from = 1;
        this.to = 1;
        this.t = 1;
        this.dur = 0.9;
    }

    set(to, dur = 0.9) {
        this.from = this.value;
        this.to = to;
        this.dur = dur;
        this.t = dur > 0 ? 0 : 1;
        if (dur <= 0) this.value = to;
    }

    /** @returns {boolean} 값이 바뀌었으면 true */
    update(dt) {
        if (this.t >= 1) return false;
        this.t = Math.min(1, this.t + dt / this.dur);
        const u = this.t - 1;
        const e = 1 + 2.70158 * u * u * u + 1.70158 * u * u;
        this.value = this.from + (this.to - this.from) * e;
        return true;
    }

    get done() {
        return this.t >= 1;
    }
}

const assetCache = new Map(); // assetDir -> Promise<{ layout, images }>

/** 캐릭터의 rig.json + 파츠 이미지를 한 번만 로드해 모든 아바타가 공유 */
export function loadRigAssets(character) {
    const dir = character.assetDir;
    if (!assetCache.has(dir)) {
        assetCache.set(dir, (async () => {
            const res = await fetch(`${dir}rig.json`);
            if (!res.ok) throw new Error(`[RigAvatar] ${dir}rig.json 로드 실패 (${res.status})`);
            const layout = await res.json();
            const images = {};
            await Promise.all(Object.entries(layout.parts).map(([key, part]) => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => { images[key] = img; resolve(); };
                img.onerror = () => reject(new Error(`[RigAvatar] 파츠 이미지 로드 실패: ${dir}${part.src}`));
                img.src = dir + part.src;
            })));
            return { layout, images };
        })());
    }
    return assetCache.get(dir);
}

/**
 * 캐릭터 정의 + 에셋으로 뼈대 구성 (게임 RigAvatar와 rig_test.html 공용)
 * character.sockets(이펙트 위치 등)를 rig.json 소켓에 더하고, 자동 접지/무기 팔을 적용한다.
 */
export function buildSkeleton(character, layout, images, arm) {
    const merged = character.sockets
        ? { ...layout, sockets: { ...layout.sockets, ...character.sockets } }
        : layout;
    const skeleton = new Skeleton(character.bones, merged, images);
    skeleton.autoGround = character.autoGround || null;
    if (character.arms) skeleton.setPart(character.weaponBone, character.arms[arm].part);
    return skeleton;
}

/**
 * 강화 파츠 그림 바꿔 끼우기 (D-044, 새 캐릭터): slots = { head, body, arm, leg } 중 true인 슬롯의 부위 뼈를
 * <부위>_up 그림으로, 아니면 기본 그림으로. character.upgrade = { parts: {슬롯: [뼈...]}, sockets: {슬롯: {소켓: 강화 소켓}} }
 */
export function applyUpgrades(skeleton, character, slots = {}) {
    const up = character.upgrade;
    if (!up) return;
    skeleton.socketAlias = {};
    for (const [slot, bones] of Object.entries(up.parts)) {
        for (const bone of bones) skeleton.setPart(bone, slots[slot] ? `${bone}_up` : bone);
        if (slots[slot] && up.sockets?.[slot]) Object.assign(skeleton.socketAlias, up.sockets[slot]);
    }
}

/**
 * 애니메이션 이벤트 → 이펙트 (게임 RigAvatar와 rig_test.html 공용)
 * @param {Object} env { effects, skeleton, character, arm, toScreen(p), groundY, onGrow(mult), onShield() }
 *   stomp/step {foot, bone} · charge {color?, socket?, bone?} · chargeEnd · fire {color?, size?}
 *   impact {color?, splash?, socket?, bone?} · cast (소유자 콜백용 신호)
 *   roar {socket?, bone?, color?}
 *   trailStart {socket, bone, color} · trailEnd
 *   thrust {sockets: [[소켓, 뼈]...], dur, color?} 추진 화염 · grow {mult} 거대화 · shield 실드 전개
 */
export function applyRigEvent(name, data, env) {
    const { effects, skeleton, toScreen } = env;
    const socketPos = (socket, bone) => toScreen(skeleton.socketWorld(socket, bone));
    const [hitSocket, hitBone] = hitSocketOf(env.character, env.arm);
    const muzzle = () => socketPos(hitSocket, hitBone);
    const at = data.socket ? () => socketPos(data.socket, data.bone) : muzzle;   // 이벤트가 지정한 소켓 우선

    if (name === 'stomp') {
        effects.stomp(socketPos(data.foot, data.bone)[0], env.groundY);
    } else if (name === 'step') {
        effects.step(socketPos(data.foot, data.bone)[0], env.groundY);
    } else if (name === 'charge') {
        effects.startCharge(at, data.color);
    } else if (name === 'chargeEnd') {
        effects.charge = null;
    } else if (name === 'fire') {
        const p = muzzle();
        const q = toScreen(skeleton.pivotWorld(hitBone));
        const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
        effects.fire(p, [(p[0] - q[0]) / len, (p[1] - q[1]) / len], data.color, data.size);
    } else if (name === 'impact') {
        effects.impact(at(), data.color);
        if (data.splash) effects.splash(at(), data.color);
    } else if (name === 'roar') {
        effects.roar(data.socket ? socketPos(data.socket, data.bone) : muzzle(), data.color);
    } else if (name === 'trailStart') {
        effects.startTrail(() => socketPos(data.socket, data.bone), data.color);
    } else if (name === 'trailEnd') {
        effects.stopTrail();
    } else if (name === 'thrust') {
        for (const [socket, bone] of data.sockets) {
            effects.addTimedEmitter({
                kind: 'flame', socket, bone, layer: 'front', rate: 50, spread: [30, 6], size: [13, 19],
                life: [0.18, 0.32], vel: [[-25, 25], [150, 280]], color: data.color || '150, 110, 255'
            }, data.dur || 0.5);
        }
    } else if (name === 'grow') {
        if (env.onGrow) env.onGrow(data.mult || PHASE2_SCALE);
    } else if (name === 'shield') {
        if (env.onShield) env.onShield();
    }
}

/**
 * 장착 파츠 조합을 어떤 리그 캐릭터로 그릴지 판정 (몸통 파츠의 캐릭터, 몸통이 비었으면 fallback 캐릭터).
 * fallback: 선택창에서 고른 캐릭터 — 몸통을 아직 안 산 캐릭터도 흐린 모습으로 보여 줌 (D-051)
 * 거대로봇은 원거리 팔(laser/missile)이면 캐논, 그 외는 주먹.
 * @returns {{character: string, arm?: 'cannon'|'fist'} | null}  null이면 기존 페이퍼돌
 */
/** 캐릭터 외형 색 필터를 알려 줄 함수 (progress가 등록 — main_v2.js · 엔진은 progress를 모름). 없으면 기본 외형 */
let skinResolver = () => null;
export function setSkinResolver(fn) {
    skinResolver = typeof fn === 'function' ? fn : () => null;
}

export function rigConfigFor(partsObj, fallback = null) {
    const character = characterOfPart(partsObj && partsObj.body) || fallback;
    if (!character) return null;
    const filters = partFiltersFor(partsObj, character);
    const skin = skinResolver(character);
    if (skin) filters['*'] = skin;   // 그림 전체 외형 색 (rig.js draw)
    const variants = variantsFor(partsObj, character);
    // 새 캐릭터: 같은 캐릭터 강화 파츠(rigUpgrade)를 낀 슬롯은 강화 그림으로 (D-044)
    const upgrades = {};
    for (const slot of ['head', 'body', 'arm', 'leg']) {
        const part = partsObj && partsObj[slot];
        if (part && part.rigUpgrade && characterOfPart(part) === character) upgrades[slot] = true;
    }
    const attackClip = partsObj?.arm?.rigAttack || null;   // 팔 파츠 공격 동작 (연발 석궁 attack_shoot, D-119)
    if (character !== 'mech') return { character, filters, variants, upgrades, attackClip };
    // quietFire: 팔이 자기 발사 연출(shotFx)을 그리면 리그의 총구 충전 점·섬광은 끔 (D-118)
    return { character, arm: mechArmOf(partsObj.arm), filters, variants, upgrades, quietFire: !!partsObj?.arm?.shotFx };
}

/** 거대로봇 팔 파츠 → 'cannon'|'fist' (2차 세트 팔은 rigArm으로 정함, D-071) — 전투 리그와 연구소 카드 그림(lab_v2.js)이 같이 씀 */
export function mechArmOf(arm) {
    return arm?.rigArm || (CANNON_ATTACKS.has(arm?.attackType) ? 'cannon' : 'fist');
}

// 거대로봇: 원거리 공격 팔은 캐논 팔 그림 (레일건 = A 세트 포격 사령부)
const CANNON_ATTACKS = new Set(['laser', 'missile', 'rail']);

// ---- A·B 세트 파츠 그림 (D-050): 파츠의 rigVariant('a'|'b') → 그 부위 그림을 <부위키>_a / _b로 ----
// 세트 그림은 tools/rig/cut_<캐릭터>_sets.py로 자름. 그림이 없는 부위·캐릭터는 세트 색(SET_TINT)으로 구분
// 거대로봇 무기 팔은 A(레일건)가 캐논 팔 armR_cannon_a, B(파일벙커)가 주먹 팔 armR_fist_b만 있음
// 합성괴인 'dragon' = 세트 밖 추가 머리 화룡 머리 (head_dragon, tools/rig/cut_chimera_dragon.py, D-054)
// 2차 세트 (D-071): 거대괴수·합성괴인·거대로봇·타락 히어로 u·c·d·v·w·l·m (tools/rig/cut_<캐릭터>_sets.py u c d v w l m — 로봇 무기 팔은 세트 rigArm 쪽만 있음)
export const RIG_SET_ART = { kaiju: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], mech: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], hero: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], chimera: ['a', 'b', 'dragon', 'u', 'c', 'd', 'v', 'w', 'l', 'm'],
    // 새 캐릭터 세트 그림 (tools/rig/cut_newchar_sets.py, 2026-10-25~) — 그림이 생긴 세트 글자만
    diver: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], doll: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'],
    saint: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], frost: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'],
    architect: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'], broadcaster: ['a', 'b', 'u', 'c', 'd', 'v', 'w', 'l', 'm'] };
export const SET_TINT = {
    mech: { a: 'sepia(0.35) hue-rotate(-50deg) saturate(1.5) brightness(1.05)', b: 'hue-rotate(-95deg) saturate(1.35) brightness(1.1)' },
    kaiju: { a: 'sepia(0.3) saturate(0.8) brightness(1.15)', b: 'hue-rotate(25deg) saturate(1.6)' },
    hero: { a: 'sepia(0.55) hue-rotate(-60deg) saturate(1.9) brightness(0.95)', b: 'brightness(0.7) saturate(1.5) hue-rotate(25deg) contrast(1.1)' },
    chimera: { a: 'saturate(1.7) hue-rotate(-18deg) brightness(1.05) contrast(1.1)', b: 'sepia(0.4) hue-rotate(150deg) saturate(1.2)' }
};

/** 파츠 조합 → { 슬롯: 'a'|'b' } (같은 캐릭터의 세트 파츠만) */
export function variantsFor(partsObj, character) {
    const out = {};
    for (const slot of ['head', 'body', 'arm', 'leg']) {
        const part = partsObj && partsObj[slot];
        if (part && part.rigVariant && characterOfPart(part) === character) out[slot] = part.rigVariant;
    }
    return out;
}

/** 연구소 카드 그림: 세트 그림이 있으면 그 파일, 없으면 기본 그림 + 세트 색 { file, filter } */
export function variantThumb(character, file, variant) {
    if (!variant) return { file, filter: null };
    // 새 캐릭터 세트 파츠는 강화 카드 그림(<부위>_up.png)을 고르지만 세트 그림은 <부위>_<글자>.png 하나
    if ((RIG_SET_ART[character] || []).includes(variant)) return { file: file.replace(/(_up)?\.png$/, `_${variant}.png`), filter: null };
    return { file, filter: (SET_TINT[character] || {})[variant] || null };
}

// ---- 파츠 외형 차이 (로드맵 B): 같은 캐릭터 안의 변형 파츠를 색으로 구분 ----
// 슬롯 → 캐릭터별 리그 부위 그림 키
const SLOT_PARTS = {
    mech: { head: ['head'], body: ['body', 'canister'], arm: ['armR_cannon', 'armR_fist', 'armL'], leg: ['legR', 'legL'] },
    kaiju: { head: ['head', 'jaw'], body: ['body', 'tail1', 'tail2', 'tail3', 'wing'], arm: ['armF'], leg: ['legF', 'legN'] },
    hero: { head: ['head'], body: ['torso', 'pauldron', 'cape1', 'cape2', 'capeIn'], arm: ['armF', 'sword'], leg: ['thighF', 'shinF', 'thighB', 'shinB'] },
    chimera: { head: ['head'], body: ['torso', 'wing', 'tail1', 'tail2'], arm: ['armF', 'armB'], leg: ['legF', 'legB'] },
    diver: { head: ['head', 'head_up'], body: ['torso', 'torso_up'], arm: ['armF', 'armB', 'armF_up', 'armB_up', 'anchorB', 'anchorB_up'],
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] },
    saint: { head: ['head', 'head_up'], body: ['torso', 'torso_up'], arm: ['armF', 'armB', 'armF_up', 'armB_up', 'handF', 'handF_up'],
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] },
    frost: { head: ['head', 'hair', 'head_up', 'hair_up'], body: ['torso', 'torso_up'],
        arm: ['armF', 'armB', 'armF_up', 'armB_up', 'handF', 'handB', 'handF_up', 'handB_up'],   // 손목 관절 (D-067)
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] },
    doll: { head: ['head', 'head_up'], body: ['torso', 'torso_up'], arm: ['armF', 'armB', 'armF_up', 'armB_up', 'handF', 'handF_up'],
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] },
    // 새 캐릭터 5·6 (D-079): 설계자는 드릴 손(handF), 방송자는 손목 관절 없음
    architect: { head: ['head', 'head_up'], body: ['torso', 'torso_up'], arm: ['armF', 'armB', 'armF_up', 'armB_up', 'handF', 'handF_up'],
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] },
    broadcaster: { head: ['head', 'head_up'], body: ['torso', 'torso_up'], arm: ['armF', 'armB', 'armF_up', 'armB_up'],
        leg: ['legF', 'legB', 'legF_up', 'legB_up'] }
};
// 같은 팩션 안의 변형 파츠 색 (기본 파츠는 원래 색)
const PART_TINT = {
    body_mech: 'saturate(0.55) brightness(1.18) contrast(1.05)',        // 아다만티움 장갑 코어: 은빛
    head_mech: 'hue-rotate(-35deg) saturate(1.3)',                     // 타겟팅 레이저 바이저: 붉은 톤
    arm_mech_laser: 'hue-rotate(40deg) saturate(1.3)',                 // 레이저 포대: 자홍
    arm_mech_missile: 'sepia(0.45) hue-rotate(-15deg) saturate(1.6)',  // 미사일 포드: 주황
    leg_mech_wheel: 'brightness(0.8) contrast(1.25) saturate(0.7)'     // 무한궤도: 어두운 강철
};
// 비운 부위(아직 안 산 파츠): 흐리게. 다른 캐릭터 파츠 테두리 빛은 연구소가 고른 캐릭터 파츠만 보여 주면서 없앰 (D-051)
const EMPTY_SLOT = 'grayscale(1) brightness(0.45) opacity(0.55)';

/**
 * 세트 부위 그림 { alias: { 부위키: '<부위키>_a' } | null, tint: { 부위키: 세트 색 } } — variants = { 슬롯: 'a'|'b'|'dragon' }
 * (게임 RigAvatar와 rig_test.html 공용) 그 부위의 세트 그림이 rig.json에 있으면 그림을 바꾸고, 없으면 세트 색
 */
/** 세트 그림 <부위>_<글자>에 맞춘 소켓 <소켓>_<글자>가 있으면 그것으로 (긴 포신의 총구 끝 — 이펙트가 포신 가운데서 나가지 않게, D-118) */
export function variantSocketsFor(skeleton, alias, character = null) {
    const vs = {}, sk = skeleton.layout.sockets || {};
    for (const [key, set] of Object.entries(alias || {})) {
        const suffix = set.slice(key.length), tag = `_${key.split('_').pop()}`;   // armR_cannon → muzzle_cannon 만
        const own = character?.variantSockets?.[key] || [];   // 이름이 부위와 다른 소켓 (히어로 sword → tip, D-119)
        for (const name of Object.keys(sk)) if ((name.endsWith(tag) || own.includes(name)) && sk[name + suffix]) vs[name] = name + suffix;
    }
    return vs;
}

export function variantAlias(character, layout, variants) {
    const slots = SLOT_PARTS[character] || {};
    const alias = {};
    const tint = {};
    for (const [slot, v] of Object.entries(variants || {})) {
        for (const key of slots[slot] || []) {
            // 새 캐릭터 세트 파츠는 강화 뼈 그림(<부위>_up)을 쓰므로 세트 그림 <부위>_<글자>(tools/rig/cut_newchar_sets.py)로 바꿈
            const set = [`${key}_${v}`, `${key.replace(/_up$/, '')}_${v}`].find(k => layout.parts[k]);
            if (set) alias[key] = set;
            else if (SET_TINT[character] && SET_TINT[character][v]) tint[key] = SET_TINT[character][v];
        }
    }
    return { alias: Object.keys(alias).length ? alias : null, tint };
}

/** 파츠 조합 → { 리그 부위키: CSS filter } */
export function partFiltersFor(partsObj, character) {
    const map = {};
    const slots = SLOT_PARTS[character];
    if (!slots || !partsObj) return map;
    for (const slot of ['head', 'body', 'arm', 'leg']) {
        const part = partsObj[slot];
        let f = null;
        if (!part || part.id === 'none') f = EMPTY_SLOT;
        else if (PART_TINT[part.id]) f = PART_TINT[part.id];
        if (f) slots[slot].forEach(key => { map[key] = f; });
    }
    return map;
}

export class RigAvatar {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} opts { character, width, height, rootX, rootY, scale, fit, shadow, shakeTarget, onEvent }
     *   character: 'mech' | 'kaiju' | 'hero' | 'chimera' (기본 mech)
     *   rootX/rootY: 캔버스에서 발 중앙(지면)이 놓일 위치, scale: 원본 이미지 대비 배율
     *   fit: 여백 px (숫자 또는 {x, y}). 지정하면 캐릭터마다 캔버스 안에 들어오도록 배율(최대 scale)과 rootX를 자동 계산 (메뉴용)
     *   shakeTarget: 착지/사격 흔들림을 적용할 요소(없으면 캐릭터만 흔들림)
     *   onResize: 거대화 등으로 크기가 바뀌었을 때 호출 (체력바 위치 갱신용)
     */
    constructor(canvas, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opts = { character: 'mech', shadow: true, fit: null, shakeTarget: null, onEvent: null, onResize: null, ...opts };
        this.giant = new ScaleTween();
        this.onceClip = null;
        this.effects = new RigEffects({ size: opts.scale / TEST_PAGE_SCALE, projectiles: false });
        this._setStage(opts.rootX, opts.scale);
        this.mode = 'idle';
        this.arm = null;
        this.pendingHit = 0;
        this.running = false;
        this.rafId = null;
        this.acc = 0;
        this.shaking = false;
        this.skeleton = null;
        this.animator = null;
        this.character = null;
        this.ready = this.setCharacter(this.opts.character);
    }

    /** 캐릭터 교체 (에셋 로드 후 뼈대/동작을 새로 구성). scale을 주면 배율도 바꿈 */
    setCharacter(id, scale) {
        const character = RIG_CHARACTERS[id];
        if (!character) return Promise.reject(new Error(`[RigAvatar] unknown character: ${id}`));
        if (scale && scale !== this.opts.scale) {
            this.opts.scale = scale;
            this._setStage(this.rootX, scale);
        }
        if (this.character === character) return this.ready;
        this.character = character;
        if (character.arms && !character.arms[this.arm]) this.arm = character.defaultArm;
        this.ready = loadRigAssets(character)
            .then(({ layout, images }) => {
                if (this.character === character) this._build(layout, images);
            })
            .catch(err => console.error(err));
        return this.ready;
    }

    _setStage(rootX, scale) {
        this.rootX = rootX;
        this.baseScale = scale;
        this._applyScale();
    }

    // 실제 배율 = 기본 배율 × 거대화 배율 (발 위치는 고정)
    _applyScale() {
        this.scale = this.baseScale * this.giant.value;
        this.stageM = Mat.trs(this.rootX, this.opts.rootY, 0, this.scale, this.scale);
        this.effects.k = this.scale / TEST_PAGE_SCALE;
    }

    /** fit 모드: 기본 자세 파츠 범위가 캔버스 안에 들어오도록 배율/가로 위치 계산 */
    _fitToCanvas(layout) {
        const fit = this.opts.fit;
        const mx = typeof fit === 'number' ? fit : fit.x;
        const my = typeof fit === 'number' ? fit : fit.y;
        const { minX, maxX, minY } = restBounds(layout);
        const scale = Math.min(this.opts.scale, (this.opts.width - 2 * mx) / (maxX - minX), (this.opts.rootY - my) / -minY);
        this._setStage(this.opts.width / 2 - ((minX + maxX) / 2) * scale, scale);
    }

    // 현재 뼈대/애니메이터가 지금 캐릭터로 만들어졌는지 (캐릭터 교체 후 에셋 로드 중에는 이전 캐릭터가 계속 재생됨)
    get _built() {
        return !!this.skeleton && this.builtFor === this.character;
    }

    _build(layout, images) {
        const c = this.character;
        this.builtFor = c;
        this.layout = layout;
        this.bounds = restBounds(layout);
        this.onceClip = null;
        this.giant.set(1, 0);
        if (this.opts.fit != null) this._fitToCanvas(layout);
        else this._applyScale();
        this.skeleton = buildSkeleton(c, layout, images, this.arm);
        applyUpgrades(this.skeleton, c, this.upgrades);   // 새 캐릭터 강화 부위 그림 (D-044)
        this._applyVariants();   // 세트 부위 그림·색 + 파츠 색 필터
        this.springs = c.springs.map(s => new Spring(s));
        this.effects.clear();
        this.effects.setAmbient(c.ambient, (socket, bone, ox, oy) => {
            const w = this.skeleton.socketWorld(socket, bone);
            return this._toCanvas([w[0] + ox, w[1] + oy]);
        }, this.opts.rootY);
        this.pendingHit = 0;
        this.animator = new Animator(c.clips, (name, data) => this._handleEvent(name, data));
        this.animator.play(this._clip(this.mode), 0);
        // 다리 층: 걸으며 스킬 동작을 쓸 때 다리 뼈만 걷기 동작 (발소리 이벤트만 넘김)
        this.lowerBones = c.bones.map(b => b.name).filter(n => LOWER_BONE.test(n));
        this.legAnim = c.clips.walk ? new Animator(c.clips, (name, data) => { if (this.legLayer && FOOT_EVENTS.has(name)) this._handleEvent(name, data); }) : null;
        this.legLayer = false;
        this.reacts = this.reacts || [];
        this._tick(0);
        if (this.running) this.render();
    }

    _clip(mode) {
        // attackOverride: 팔 파츠가 정한 공격 동작 (연발 석궁 = 조준 사격, D-119 — rigConfigFor attackClip)
        if (mode === 'attack' && this.attackOverride && this.character?.clips?.[this.attackOverride]) return this.attackOverride;
        return mode === 'attack' ? attackClipOf(this.character, this.arm) : mode;
    }

    setMode(mode) {
        if (!mode || mode === this.mode) return;
        if (this.mode === 'walk' && this.reacts) this.react('settle');   // 걷다 멈추면 앞으로 쏠렸다 섬 (Q6)
        this.mode = mode;
        this.pendingHit = 0;
        if (mode !== 'walk') this.legLayer = false;    // 멈추면 다리도 스킬 동작을 따라감
        if (!this.animator || this.onceClip) return;   // 점프/변신 중이면 끝난 뒤 이 동작으로 복귀
        this.effects.stopCharge();
        this.animator.play(this._clip(mode), FADE_SEC);
    }

    /** 한 번만 재생하는 동작(점프/변신). 끝나면 현재 상태 동작으로 복귀. 해당 클립이 없으면 false */
    playOnce(name) {
        if (!this.animator || !this.character.clips[name]) return false;
        // 걷는 중이면 다리 층을 켜고 지금 걸음 시점부터 이어 감
        const walking = this.mode === 'walk' && this.legAnim && this.lowerBones.length;
        if (walking && !this.legLayer) {
            const t = this.animator.currentName === 'walk' ? this.animator.currentTime : 0;
            this.legAnim.cur = null;
            this.legAnim.play('walk', 0, t);
        }
        this.legLayer = !!walking;
        this.onceClip = name;
        this.pendingHit = 0;
        this.effects.stopCharge();
        this.animator.play(name, 0.12);
        return true;
    }

    // ---- 반응 동작 (Q4): 맞음·밀림·기절 ----
    /** 반응 재생 (같은 반응이면 처음부터). loop 반응(기절)은 stopReact까지 */
    react(name) {
        const clip = REACTIONS[name];
        if (!clip || !this.reacts) return false;
        this.reacts = this.reacts.filter(r => r.name !== name);
        this.reacts.push({ name, clip, t: 0 });
        return true;
    }

    stopReact(name) {
        if (this.reacts) this.reacts = this.reacts.filter(r => r.name !== name);
    }

    /** 바람 세기 (Q6): 걷는 중이면 걷기 배율 쪽으로, 멈추면 0으로 천천히 */
    _tickWind(dt) {
        // 느린 걸음은 반대로 조금만 (원거리 이동 ×0.5로 걷기 배율이 0.6까지 내려가 망토가 앞으로 크게 날리던 것 — D-121)
        const target = this.mode === 'walk' ? Math.max(WIND.minK, ((this.walkScale ?? 1) - 1) / (WIND.fullAt - 1)) : 0;
        this.windK = (this.windK || 0) + (target - (this.windK || 0)) * Math.min(1, dt * WIND.ease);
    }

    /** 반응 시간 진행 (기절로 동작이 멈춰도 움직임). dt = 히트스톱·느린 화면 반영, raw = 실제 시간 (realtime 반응) */
    _tickReacts(dt, raw = dt) {
        if (!this.reacts || !this.reacts.length) return;
        for (const r of this.reacts) r.t += r.clip.realtime ? raw : dt;
        this.reacts = this.reacts.filter(r => r.clip.loop || r.clip.hold || r.t < r.clip.duration);
    }

    /** 스프링 + 반응 동작 = 동작 위에 더할 값 { 뼈: { x, y, rot } } */
    _offsets() {
        const out = {};
        const add = (bone, ch, v) => { (out[bone] ||= {})[ch] = (out[bone][ch] || 0) + v; };
        for (const s of this.springs) add(s.bone, s.channel, s.value);
        if (this.windK) for (const w of this.character.wind || []) if (this.skeleton.byName[w.bone]) add(w.bone, 'rot', w.rot * this.windK);
        for (const r of this.reacts || []) {
            const t = r.clip.loop ? r.t % r.clip.duration : Math.min(r.t, r.clip.duration);
            const pose = samplePose(r.clip, t);
            for (const bone in pose) {
                if (!this.skeleton.byName[bone]) continue;
                for (const ch in pose[bone]) add(bone, ch, pose[bone][ch]);
            }
        }
        return out;
    }

    /** 지금 자세: 주 동작 (+ 걸으며 스킬이면 다리 뼈는 걷기 동작) */
    _pose() {
        const pose = this.animator.sample();
        if (this.legLayer && this.legAnim) {
            const legs = this.legAnim.sample();
            for (const b of this.lowerBones) if (legs[b]) pose[b] = legs[b];
        }
        return pose;
    }

    // ---- 2페이즈 거대화 + 실드 ----
    /** 변신 클립이 있으면 클립의 grow/shield 이벤트로, 없으면 즉시 거대화 + 실드 */
    enterPhase2() {
        if (!this.animator) return;
        if (!this.playOnce('transform')) {
            this.setGiant(PHASE2_SCALE);
            this.shieldOn();
        }
    }

    setGiant(mult, instant = false) {
        this.giant.set(mult, instant ? 0 : 0.9);
        this._applyScale();
        if (instant && this.opts.onResize) this.opts.onResize();
    }

    shieldOn(color = SHIELD_COLOR) {
        this.effects.setShield(() => shieldGeom(this.bounds, p => this._toCanvas(p), this.scale), color);
    }

    /** 시간이 다 된 실드 제거 (조각 없이 사라짐) */
    shieldOff() {
        this.effects.shield = null;
    }

    /** 스킬 모션: 'attack'(현재 공격 클립) | 'cast' | 'victory' — 없는 클립이면 공격 클립으로 */
    playSkillAnim(kind) {
        const name = kind === 'attack' ? this._clip('attack') : kind;
        return this.playOnce(name) || this.playOnce(this._clip('attack'));
    }

    shieldHit() {
        this.effects.shieldHit();
    }

    breakShield() {
        this.effects.shieldBreak();
    }

    /** 전투 시작 시 스킬 상태 초기화 (거대화/실드/한 번 재생 동작/반응 동작 — 패배 자세 등) */
    resetSkills() {
        this.reacts = [];
        this.effects.shield = null;
        this.setGiant(1, true);
        if (this.onceClip && this.animator) {
            this.onceClip = null;
            this.animator.play(this._clip(this.mode), 0);
        }
    }

    /** 리그 소켓의 캔버스 좌표 [x, y] */
    socketPoint(socket, bone) {
        if (!this._built) return null;
        return this._toCanvas(this.skeleton.socketWorld(socket, bone));
    }

    /** 새 캐릭터 강화 부위 그림 { head, body, arm, leg: true } (D-044). 뼈대를 다시 만들 때도 유지 */
    setUpgrades(slots) {
        this.upgrades = slots || {};
        if (this._built) applyUpgrades(this.skeleton, this.character, this.upgrades);
    }

    /** 부위 그림별 색 필터 { 부위키: CSS filter } (파츠 외형 차이) */
    setPartFilters(map) {
        this.basePartFilters = map || null;
        this._mergeFilters();
    }

    /** A·B 세트 부위 { 슬롯: 'a'|'b' } (D-050). 뼈대를 다시 만들 때도 유지 */
    setVariants(variants) {
        this.variants = variants || {};
        if (this._built) this._applyVariants();
    }

    // 세트 그림이 있는 부위는 그림 키를 바꾸고(skeleton.partAlias), 없는 부위는 세트 색을 깜
    _applyVariants() {
        const { alias, tint } = variantAlias(this.character.id, this.layout, this.variants);
        this.skeleton.partAlias = alias;
        this.skeleton.variantSockets = variantSocketsFor(this.skeleton, alias, this.character);
        this.variantTint = tint;
        this._mergeFilters();
    }

    _mergeFilters() {
        const map = { ...(this.variantTint || {}), ...(this.basePartFilters || {}) };   // 비운 부위(흐리게)가 세트 색보다 먼저
        this.partFilters = Object.keys(map).length ? map : null;
        if (this.skeleton) this.skeleton.partFilters = this.partFilters;
    }

    setArm(kind) {
        const c = this.character;
        if (!c || !c.arms || !c.arms[kind] || kind === this.arm) return;
        this.arm = kind;
        // 캐릭터를 바꾸는 중(새 에셋 로딩 중)이면 이전 캐릭터 뼈대에 끼우지 않음 — 뼈대를 만들 때 this.arm으로 적용됨
        if (!this._built) return;
        this.skeleton.setPart(c.weaponBone, c.arms[kind].part);
        if (this.mode === 'attack') {
            this.pendingHit = 0;
            this.effects.stopCharge();
            this.animator.play(this._clip('attack'), FADE_SEC);
        }
    }

    /** 마지막 호출 이후 발생한 타격량(1 = 전투 엔진 기본 1타)을 반환하고 비움 */
    consumeHit() {
        const hit = this.pendingHit;
        this.pendingHit = 0;
        return hit;
    }

    /** 머리 위(체력바 자리)의 캔버스 좌표 {x: 머리 피벗 x, y: 가장 높은 파츠 윗변} (기본 자세 기준) */
    headTop() {
        if (!this.layout) return null;
        const root = this.layout.pivots.root;
        const head = this.layout.pivots.head || root;
        const minY = Math.min(...Object.values(this.layout.parts).map(p => p.y));
        const [x, y] = this._toCanvas([head[0] - root[0], minY - root[1]]);
        return { x, y };
    }

    /** 공격 소켓(총구/입)의 캔버스 좌표 [x, y] */
    muzzlePoint() {
        if (!this._built) return null;
        const [socket, bone] = hitSocketOf(this.character, this.arm);
        return this._toCanvas(this.skeleton.socketWorld(socket, bone));
    }

    /** 캔버스 픽셀 크기 = 표시 크기(opts) × 해상도 배율 (displayRes.js). 표시 크기는 CSS·인라인 스타일이 정함 */
    _fitRes() {
        // opts.fitCss: 화면에 opts보다 크게 보이면(휴대폰 배치 메인 캐릭터, Q-015) 그만큼 더 촘촘히 — 최대 3배
        const shown = this.opts.fitCss && this.canvas.clientWidth > this.opts.width ? this.canvas.clientWidth / this.opts.width : 1;
        let res = shown > 1 ? Math.min(3, Math.round(displayRes() * shown * 4) / 4) : displayRes();
        // 휴대폰 배치: 연구소·선택창은 게임 판 배율 없이 실제 크기로 펼침(ui_v2_mobile.css) → 화면 위 크기 × 기기 배율로 잼 (최대 3배)
        const onScreen = this.opts.fitCss && document.body.classList.contains('v2-mobile') ? this.canvas.getBoundingClientRect().width : 0;
        if (onScreen > 0 && displayRes() > 1) res = Math.max(res, Math.min(3, Math.round(onScreen * (window.devicePixelRatio || 1) / this.opts.width * 4) / 4));
        const w = Math.round(this.opts.width * res), h = Math.round(this.opts.height * res);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.res = res;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._fitRes();
        this.last = performance.now();
        this.rafId = requestAnimationFrame(t => this._loop(t));
    }

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this._applyShake(0, 0);
    }

    _loop(now) {
        if (!this.running) return;
        // 히트스톱/일시정지 0, 배속 적용 × 이 캐릭터만의 동작 속도(감속 0.55, 기절 0)
        // 걷기 동작은 실제 진격 속도에 맞춤 (Q2) — 걸으며 쓰는 스킬 동작(onceClip)은 제 빠르기 (속도 ×0.5/×2(D-121)로 스킬 동작이 늘어지거나 빨라지지 않게)
        const walk = this.mode === 'walk' && !this.onceClip ? this.walkScale ?? 1 : 1;
        const raw = Math.max(0, Math.min(0.1, (now - this.last) / 1000));   // 음수 막기 (Android WebView 첫 프레임)
        const real = raw * gameTime.scale(now);   // 히트스톱·일시정지만 (반응 동작용)
        const dt = real * (this.timeScale ?? 1) * walk * (this.mode === 'attack' ? this.supportAttackSpeed ?? 1 : 1);
        this.last = now;
        if (this.animator) {
            const reacting = this.reacts && this.reacts.length;
            this._tickReacts(real, raw);
            this._tickWind(dt);
            this.acc += dt;
            let ticked = false;
            while (this.acc >= FIXED_DT) {
                this._tick(FIXED_DT);
                this.acc -= FIXED_DT;
                ticked = true;
            }
            // 기절(동작 멈춤) 중이거나 반응이 막 끝난 프레임: 자세만 다시 계산
            if (!ticked && (reacting || (this.reacts && this.reacts.length))) this.skeleton.update(this._pose(), this._offsets());
            this.render();
        }
        this.rafId = requestAnimationFrame(t => this._loop(t));
    }

    _tick(h) {
        this.animator.update(h);
        if (this.legLayer) this.legAnim.update(h);
        if (this.onceClip && this.animator.currentTime >= this.character.clips[this.onceClip].duration) {
            this.onceClip = null;
            // 다리 층이 걷던 시점에서 걷기로 돌아감 (발이 튀지 않게)
            const back = this._clip(this.mode);
            this.animator.play(back, FADE_SEC, this.legLayer && back === 'walk' ? this.legAnim.currentTime : 0);
            this.legLayer = false;
        }
        if (this.giant.update(h)) {
            this._applyScale();
            if (this.giant.done && this.opts.onResize) this.opts.onResize();
        }
        this.skeleton.update(this._pose(), this._offsets());
        if (h > 0) {
            for (const s of this.springs) s.step(this.skeleton.restPivotWorld(s.bone), h);
        }
        this.effects.update(h);
    }

    _toCanvas(p) {
        return Mat.apply(this.stageM, p[0], p[1]);
    }

    _handleEvent(name, data) {
        if (!this._built) return;   // 교체 대기 중인 이전 캐릭터의 이벤트는 무시
        if (name === 'stomp' || name === 'land') this.react(name);   // 쿵·착지 눌림 (reactions.js, Q6)
        if (!(this.quietFire && (name === 'fire' || name === 'charge'))) applyRigEvent(name, data, {
            effects: this.effects, skeleton: this.skeleton, character: this.character, arm: this.arm,
            toScreen: p => this._toCanvas(p), groundY: this.opts.rootY,
            onGrow: mult => this.setGiant(mult), onShield: () => this.shieldOn()
        });
        if (data.hit) this.pendingHit += data.hit;
        if (this.opts.onEvent) this.opts.onEvent(name, data);
    }

    _applyShake(x, y) {
        const target = this.opts.shakeTarget;
        if (!target) return;
        if (x || y) {
            target.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            this.shaking = true;
        } else if (this.shaking) {
            target.style.transform = '';
            this.shaking = false;
        }
    }

    render() {
        if (!this.skeleton) return;
        const ctx = this.ctx;
        const k = this.shakeScale ?? 1;   // 설정에서 화면 흔들림을 끄면 0
        const [sx, sy] = this.effects.shakeOffset().map(v => v * k);
        this._applyShake(sx, sy);
        this._fitRes();
        const r = this.res;   // 좌표는 CSS px 그대로, 그릴 때만 해상도 배율을 곱함
        const view = this.opts.shakeTarget ? [r, 0, 0, r, 0, 0] : [r, 0, 0, r, sx * r, sy * r];

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (this.opts.shadow) {
            const s = this.scale;
            const { rx, ry } = this.character.shadow;
            ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.ellipse(this.rootX, this.opts.rootY + 2, rx * s, ry * s, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        this.effects.drawBack(ctx, view);
        this.skeleton.draw(ctx, Mat.mul(view, this.stageM));
        this.effects.draw(ctx, view);
    }
}
