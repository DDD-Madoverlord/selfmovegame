/* VFX 비교안: A 원본을 보관하고 같은 정의 객체에 덮어 써 게임·테스트의 참조를 유지한다. */
import { SET_VFX, MECH_VFX, HERO_VFX, KAIJU_VFX, FROST_VFX, BATTLE_VFX, CHIMERA_VFX, DIVER_VFX, SAINT_VFX, DOLL_VFX, ZONE_VFX,
    BOSS_VFX, ELITE_VFX } from './vfxDefs.js';
import { imageShockwave, breathImage } from './imageEffects.js';

const clone = value => JSON.parse(JSON.stringify(value));
const INK = '25, 22, 35';
const GOLD = '255, 210, 80';
const ASH = '95, 90, 85';
const DM = '170, 115, 210';
const def = (...layers) => ({ layers });
const star = (color, r = 60, extra = {}) => ({ type: 'starburst', at: 0, dur: 0.24, r, points: 7, inner: 0.34,
    outline: INK, width: 4, color, ...extra });
const lines = (color, len = 100, extra = {}) => ({ type: 'speedlines', at: 0, dur: 0.2, count: 8, len,
    width: 3, outline: INK, color, ...extra });
const ribbon = (color, len, w, extra = {}) => ({ type: 'ribbon', at: 0, dur: 0.3, len, w, color, ...extra });
const smoke = (size = 20, count = 7, extra = {}) => ({ type: 'smoke', at: 0.02, count, spread: size,
    spreadY: size * 0.4, size, life: [1.0, 1.7], rise: 25, color: ASH, ...extra });
const dust = (size = 18, extra = {}) => ({ type: 'dust', at: 0, count: 5, speed: 100, size,
    life: 1.3, color: ASH, ...extra });
const shards = (color = ASH, count = 7, extra = {}) => ({ type: 'shards', at: 0, count, speed: 190,
    size: 7, spin: 5, life: [1.0, 1.5], shape: 'rock', color, ...extra });
const goo = (color, count = 7, extra = {}) => ({ type: 'goo', at: 0, count, speed: 160, size: 9,
    life: [1.1, 1.7], floor: 0, color, ...extra });
const motes = (color, count = 6, extra = {}) => ({ type: 'motes', at: 0.02, count, spread: 20,
    rise: [35, 65], life: [0.7, 1.1], size: 1.5, color, ...extra });
const tendrils = (color, extra = {}) => ({ type: 'tendrils', at: 0, dur: 0.8, count: 3, h: 140,
    spread: 26, w: 18, color, ...extra });

const targets = {};
export const VFX_VARIANTS = {};
function add(table, group, key, name, scene, b, c) {
    const full = `${group}.${key}`, original = clone(table[key]);
    targets[full] = table[key];
    VFX_VARIANTS[full] = { name, scene, variants: {
        A: { label: '지금', def: original }, B: { label: '만화풍', def: b }, C: { label: '묵직한', def: c }
    } };
}

add(SET_VFX, 'SET_VFX', 'flame', '용의 숨결', { character: 'chimera', part: 'head_chimera_dragon', kind: 'breath', clip: 'victory' },
    def(ribbon('255, 150, 40', 260, 38, { dur: 0.24, outline: INK, width: 4, jag: 16 }),
        ribbon(GOLD, 235, 15, { dur: 0.2, jag: 8 })),
    def({ type: 'flame', at: 0, count: 6, speed: 480, angle: 0, cone: 0.12, size: 11, grow: 3.2,
        life: [0.6, 0.85], drag: 1.8, rise: 45, color: '160, 105, 55', matte: true },
        smoke(15, 3, { speed: 260, angle: 0, rise: 15 })));
add(MECH_VFX, 'MECH_VFX', 'fistHit', '주먹 적중', { character: 'mech', arm: 'fist', kind: 'melee', clip: 'attack_fist' },
    def(star('100, 235, 255', 66), lines(GOLD, 100)),
    def(shards('115, 125, 130', 8), dust(18, { dy: 32 }), smoke(14, 3)));
add(HERO_VFX, 'HERO_VFX', 'slashHit', '기본 베기', { character: 'hero', kind: 'melee', clip: 'attack' },
    def(star('200, 130, 255', 70, { stretch: 0.32, angle: -0.8 }), lines('245, 220, 255', 115, { angle: -0.8, cone: 0.6 })),
    def(ribbon('155, 145, 170', 125, 5, { angle: -0.8, dur: 0.16 }), shards('100, 95, 115', 6), smoke(18, 5, { color: '70, 65, 85' })));
add(KAIJU_VFX, 'KAIJU_VFX', 'biteHit', '물기', { character: 'kaiju', kind: 'melee', clip: 'attack' },
    def(star('195, 240, 80', 55, { points: 6, stretch: 0.7 }), lines(GOLD, 78, { count: 6 })),
    def(goo('110, 135, 75', 5, { dy: 0, floor: 36 }), dust(13, { dy: 36 }), smoke(12, 3, { color: '80, 95, 70' })));
add(MECH_VFX, 'MECH_VFX', 'laserBig', '대형 레이저', { character: 'mech', arm: 'cannon', kind: 'beam', clip: 'attack' },
    def(ribbon('70, 215, 255', 300, 26, { outline: INK, width: 4, dur: 0.3 }),
        ribbon('245, 250, 255', 300, 8, { dur: 0.25 }), star('70, 215, 255', 60, { pos: 'to' })),
    def(ribbon('155, 180, 185', 300, 11, { dur: 0.48 }), smoke(20, 8, { pos: 'to' }), shards('100, 115, 120', 5, { pos: 'to' })));
add(MECH_VFX, 'MECH_VFX', 'missileBlast', '미사일 폭발', { character: 'mech', kind: 'missile', clip: 'attack' },
    def(star('255, 155, 50', 90), star(GOLD, 48, { points: 5, dur: 0.16 }), lines(GOLD, 130)),
    def(smoke(28, 12), shards('100, 90, 75', 10), dust(24, { dy: 32 }),
        { type: 'flame', at: 0, count: 4, speed: 95, size: 10, grow: 2.5, life: [0.4, 0.7], color: '170, 110, 60', matte: true }));
add(BATTLE_VFX, 'BATTLE_VFX', 'shockHit', '전기 충격', { character: 'mech', enemy: 'shock', kind: 'enemyHit' },
    def(star(GOLD, 64, { points: 5, inner: 0.2 }), lines('245, 245, 220', 100, { count: 5 })),
    def(ribbon('185, 190, 145', 55, 4, { angle: -1.2, jag: 10, dur: 0.16 }), smoke(18, 6, { color: '85, 90, 95' }), shards('110, 110, 95', 4)));
add(FROST_VFX, 'FROST_VFX', 'shatter', '얼음 깨짐', { character: 'frost', kind: 'shatter', clip: 'cast' },
    def(star('150, 220, 255', 72, { dy: -40, points: 8 }), lines('235, 250, 255', 110, { dy: -40 }),
        shards('150, 220, 255', 6, { shape: 'ice', size: 7, life: [0.25, 0.4], dy: -40, floor: 40 })),
    def(shards('155, 175, 180', 15, { shape: 'ice', size: 9, dy: -40, floor: 40, speed: 230 }),
        smoke(20, 7, { color: '140, 155, 160', dy: -25 }), dust(16, { color: '135, 150, 155' })));
add(KAIJU_VFX, 'KAIJU_VFX', 'acidCharge', '산성 돌진', { character: 'kaiju', kind: 'charge', clip: 'attack' },
    def(star('180, 235, 65', 80, { dy: -40 }), lines(GOLD, 125, { dy: -40, angle: 0, cone: 1.2 }),
        goo('165, 215, 65', 4, { size: 6, life: [0.25, 0.4], dy: -40, floor: 40 })),
    def(goo('100, 125, 65', 10, { size: 12, dy: -40, floor: 40 }), dust(20, { color: '85, 95, 65' }), smoke(18, 6, { color: '100, 115, 75' })));
add(BATTLE_VFX, 'BATTLE_VFX', 'smiteHit', '정의의 일격', { character: 'hero', enemy: 'guardian', kind: 'enemyGround' },
    def(ribbon(GOLD, 310, 60, { angle: -Math.PI / 2, outline: INK, width: 5 }), star('255, 245, 200', 95, { ground: true })),
    def(ribbon('190, 180, 140', 300, 32, { angle: -Math.PI / 2, dur: 0.55 }), dust(30), shards('125, 115, 90', 9), smoke(24, 9)));
add(BATTLE_VFX, 'BATTLE_VFX', 'abyssSpike', '심연의 파동', { character: 'diver', enemy: 'oculus', kind: 'enemyGround' },
    def(tendrils('150, 85, 190', { dur: 0.32, outline: INK, width: 4, angular: true }), star('180, 230, 95', 55, { ground: true })),
    def(tendrils('80, 70, 95', { dur: 1.3, h: 150, w: 23 }), goo('95, 110, 75', 7), dust(20, { color: '65, 65, 70' })));
add(BATTLE_VFX, 'BATTLE_VFX', 'baseFinale', '거점 대폭발', { character: 'mech', kind: 'finale' },
    def(star('255, 150, 45', 160, { dy: -70, dur: 0.3 }), star(GOLD, 90, { dy: -70, dur: 0.2 }),
        lines(GOLD, 230, { dy: -70, count: 12 }), shards(INK, 10, { size: 12, speed: 330, dy: -70, floor: 70, life: [0.35, 0.6] })),
    def(smoke(45, 18, { dy: -70, rise: 55, life: [1.8, 2.5] }), shards('85, 80, 75', 18, { size: 14, speed: 350, dy: -70, floor: 70 }),
        dust(42, { count: 10, life: 2.4 }), { type: 'flame', at: 0, count: 8, speed: 180, size: 18, grow: 3,
            life: [0.7, 1.1], angle: -Math.PI / 2, cone: 1.8, color: '165, 105, 60', matte: true, dy: -70 }));
add(BATTLE_VFX, 'BATTLE_VFX', 'enemyDefeat', '적 처치', { character: 'hero', kind: 'defeat', clip: 'attack' },
    def(star(DM, 52, { dy: -30, dur: 0.18 }), smoke(16, 4, { dy: -30, color: DM, life: [0.3, 0.5] }), motes(DM, 7, { dy: -25 })),
    def(smoke(22, 10, { dy: -30, rise: 38, color: '90, 85, 100' }), dust(12), motes(DM, 5, { dy: -25, size: 1.2 })));
add(BATTLE_VFX, 'BATTLE_VFX', 'eliteSpawn', '엘리트 등장', { character: 'mech', kind: 'spawn' },
    def(ribbon(GOLD, 190, 30, { angle: -Math.PI / 2, outline: INK, width: 4 }), star(GOLD, 50, { ground: true, points: 4 })),
    def(ribbon('180, 155, 95', 180, 18, { angle: -Math.PI / 2, dur: 0.8 }),
        { type: 'rune', at: 0, dur: 1.2, r: 50, spin: 0.2, color: '170, 145, 90' }, dust(18), motes('175, 150, 95', 5)));
add(BATTLE_VFX, 'BATTLE_VFX', 'baseHit', '거점 피격', { character: 'mech', arm: 'fist', kind: 'baseHit', clip: 'attack_fist' },
    def(star(GOLD, 36), lines('255, 155, 65', 65, { count: 5 })),
    def(shards('100, 95, 85', 6, { size: 5, speed: 120 }), smoke(14, 4), dust(10)));

// D 던파풍 (D-060 시험): 손그림 프레임 이펙트(그림 시트) + 짧은 섬광·불티 — 지금은 타락 히어로 베기 하나만
VFX_VARIANTS['HERO_VFX.slashHit'].variants.D = {
    label: '던파풍(그림)',
    def: def(
        { type: 'sprite', sheet: 'slash_violet', at: 0, dur: 0.42, size: 150, glow: 1.45 },
        { type: 'flash', at: 0.05, dur: 0.12, r: 26, color: '235, 200, 255' },
        { type: 'streaks', at: 0.08, count: 6, speed: 260, len: 30, life: [0.25, 0.45], angle: 0, cone: 1.6, color: '220, 150, 255' }
    )
};

// ---- D 던파풍 (D-060): 손그림 프레임 이펙트(그림 시트 VFX_SHEETS) — 만든 이펙트는 게임 기본값이 D ----
const spr = (sheet, size, extra = {}) => ({ type: 'sprite', sheet, at: 0, dur: 0.42, size, glow: 1.4, ...extra });
const embers = (color, extra = {}) => ({ type: 'embers', at: 0.08, count: 7, speed: 210, angle: 0, cone: 2.2, size: 1.6,
    life: [0.4, 0.8], color, ...extra });
/** 이미 A·B·C가 있는 이펙트에는 D를 더하고, 없는 이펙트는 A(지금) + D로 새로 등록 */
function addD(table, group, key, name, scene, d) {
    const full = `${group}.${key}`;
    if (!VFX_VARIANTS[full]) {
        targets[full] = table[key];
        VFX_VARIANTS[full] = { name, scene, variants: { A: { label: '지금', def: clone(table[key]) } } };
    }
    VFX_VARIANTS[full].variants.D = { label: '던파풍(그림)', def: d };
}
// 1단계: 4캐릭터 기본 타격 (히어로 베기는 위)
addD(MECH_VFX, 'MECH_VFX', 'fistHit', '주먹 적중', null,
    def(spr('punch_cyan', 150), { type: 'streaks', at: 0.06, count: 6, speed: 280, len: 30, life: [0.25, 0.45], angle: 0, cone: 1.4,
        color: '150, 230, 255' }));
addD(KAIJU_VFX, 'KAIJU_VFX', 'biteHit', '물기', null,
    def(spr('bite_green', 150), { type: 'goo', at: 0.12, count: 4, speed: 150, size: 6, life: [0.6, 0.9], color: '150, 255, 90' }));
addD(CHIMERA_VFX, 'CHIMERA_VFX', 'clawHit', '할퀴기 (합성괴인)', { character: 'chimera', kind: 'melee', clip: 'attack' },
    def(spr('claw_fire', 150), embers('255, 190, 80')));
addD(CHIMERA_VFX, 'CHIMERA_VFX', 'punchHit', '주먹 (합성괴인)', { character: 'chimera', part: 'arm_chimera_a', kind: 'melee', clip: 'attack' },
    def(spr('punch_fire', 150), embers('255, 170, 60')));
// 2단계: 필살기
addD(SET_VFX, 'SET_VFX', 'orbitalHit', '궤도 폭격', { character: 'mech', part: 'head_mech_a', kind: 'charge' },
    def(spr('orbital_beam', 260, { anchorY: 0.9, dur: 0.6, glow: 1.3 }),
        { type: 'dust', at: 0.15, count: 5, speed: 120, size: 18, life: 1.0, color: '70, 80, 95' }));
addD(KAIJU_VFX, 'KAIJU_VFX', 'roarBurst', '대지 포효', { character: 'kaiju', kind: 'beam', clip: 'attack' },
    def(...imageShockwave(480, 135).layers, spr('acid_burst', 230, { anchorY: 0.8, dur: 0.55, softEdges: 0.12, glow: 0 }),
        { type: 'motes', at: 0.1, count: 8, spread: 60, rise: [30, 70], life: [0.6, 1.0], size: 2, color: '150, 255, 90' }));
addD(SET_VFX, 'SET_VFX', 'judgmentHit', '심판의 일격', { character: 'hero', part: 'head_hero_a', kind: 'charge' },
    def(spr('judgment_violet', 260, { anchorY: 0.9, dur: 0.6, glow: 1.3 }),
        { type: 'shards', at: 0.2, count: 6, speed: 200, size: 7, spin: 6, life: [0.6, 1.0], shape: 'ice', color: '200, 140, 255' }));
addD(SET_VFX, 'SET_VFX', 'flame', '용의 숨결', null,
    def(...breathImage('breath_fire', 380, 0.6).layers, embers('255, 190, 80', { count: 2, cone: 0.5 })));

// 3단계: 새 캐릭터 4종 대표 스킬
addD(DIVER_VFX, 'DIVER_VFX', 'hands', '심연의 손 (길잡이)', { character: 'diver', kind: 'charge' },
    def(spr('hands_teal', 200, { anchorY: 0.9, dur: 0.7, glow: 1.2 }),
        { type: 'drops', at: 0.2, count: 6, speed: 160, size: 3, color: '90, 230, 220' }));
addD(SAINT_VFX, 'SAINT_VFX', 'corpseRise', '억지 부활 (봉합 성녀)', { character: 'saint', kind: 'charge' },
    def(spr('revive_crimson', 210, { anchorY: 0.9, dur: 0.8, glow: 1.2 }),
        { type: 'motes', at: 0.2, count: 8, spread: 30, rise: [40, 90], life: [0.6, 1.1], size: 2, color: '255, 120, 140' }));
addD(FROST_VFX, 'FROST_VFX', 'shatter', '얼음 깨짐', null,
    def(spr('ice_shatter', 200, { anchorY: 0.9, dur: 0.6, glow: 1.2 }),
        { type: 'shards', at: 0.25, count: 6, speed: 220, size: 6, spin: 8, life: [0.6, 1.0], shape: 'ice', color: '170, 225, 255', dy: -40, floor: 40 }));
addD(DOLL_VFX, 'DOLL_VFX', 'xcut', '가위 X자 (인형사)', { character: 'doll', kind: 'melee', clip: 'attack' },
    def(spr('xcut_cyan', 170, { dur: 0.45 }), embers('190, 245, 255', { count: 5 })));
// 4단계: 적·보스 기술, 처치·거점
addD(ZONE_VFX, 'ZONE_VFX', 'heavenPillar', '천상의 심판 (대주교)', { character: 'hero', enemy: 'archbishop', kind: 'enemyGround' },
    def(spr('pillar_gold', 260, { anchorY: 0.92, dur: 0.7, glow: 1.2 }),
        { type: 'motes', at: 0.2, count: 10, spread: 50, rise: [50, 110], life: [0.6, 1.1], size: 2.4, color: '255, 225, 140' }));
addD(BATTLE_VFX, 'BATTLE_VFX', 'smiteHit', '정의의 일격', null,
    def(spr('pillar_gold', 250, { anchorY: 0.92, dur: 0.7, glow: 1.2 }),
        { type: 'cracks', at: 0.05, dur: 1.0, count: 6, len: 100, color: '255, 190, 80' }));
addD(BATTLE_VFX, 'BATTLE_VFX', 'abyssSpike', '심연의 파동', null,
    def(spr('tentacle_void', 190, { anchorY: 0.92, dur: 0.7, glow: 1.15 }),
        { type: 'goo', at: 0.2, count: 3, speed: 140, size: 5, life: [0.6, 0.9], color: '150, 255, 90' }));
addD(ZONE_VFX, 'ZONE_VFX', 'hellGate', '지옥문 (악마병 소환)', { character: 'mech', enemy: 'demon', kind: 'spawn' },
    def(spr('hellgate_red', 190, { anchorY: 0.78, dur: 0.8, glow: 1.15 }), embers('255, 120, 60', { count: 6, angle: -Math.PI / 2, cone: 1.2 })));
addD(BATTLE_VFX, 'BATTLE_VFX', 'baseFinale', '거점 대폭발', null,
    def(spr('explosion_big', 340, { anchorY: 0.92, dur: 0.95, blend: 'normal', glow: 0 }),
        spr('explosion_big', 340, { anchorY: 0.92, dur: 0.95, alpha: 0.45, glow: 1.15 }),
        { type: 'shards', at: 0.1, count: 10, speed: 360, size: 9, spin: 6, life: [0.8, 1.3], shape: 'rock', color: '90, 80, 75', dy: -60, floor: 60 },
        { type: 'dust', at: 0.15, count: 8, speed: 150, size: 30, life: 1.6, color: '80, 70, 75' }));
addD(BATTLE_VFX, 'BATTLE_VFX', 'enemyDefeat', '적 처치', null,
    def(spr('defeat_puff', 130, { anchorY: 0.9, dur: 0.55, blend: 'normal', glow: 0 }),
        spr('defeat_puff', 130, { anchorY: 0.9, dur: 0.55, alpha: 0.35, glow: 1.2 })));

// ---- 5단계 (D-061): 나머지 스킬·적 기술 — 터지는 순간은 그림 시트, 판정·상태를 알려 주는 레이어(균열·감속 표식·범위 고리)는 A에서 그대로 ----
/** A 정의에서 같은 종류의 레이어만 복사 (예: 감속 표식 chevrons, 범위 고리 ring) */
const keep = (d, ...types) => clone(d.layers.filter(l => types.includes(l.type)));
const hit = (sheet, size, extra) => spr(sheet, size, { dur: 0.36, glow: 1.3, ...extra });
const groundSpr = (sheet, size, extra) => spr(sheet, size, { anchorY: 0.85, dur: 0.55, glow: 1.2,
    ...(sheet === 'ground_impact' ? { dispersion: 'burst' } : {}), ...extra });
const puff = (size, extra = {}) => [spr('defeat_puff', size, { anchorY: 0.9, dur: 0.55, blend: 'normal', glow: 0, ...extra }),
    spr('defeat_puff', size, { anchorY: 0.9, dur: 0.55, alpha: 0.35, glow: 1.2, ...extra })];
const sc = (character, kind, extra = {}) => ({ character, kind, ...extra });
const D_MORE = [
    // 거대로봇
    [MECH_VFX, 'MECH_VFX', 'laserHit', '관통 레이저 적중', sc('mech', 'hit', { arm: 'cannon' }),
        d => def(hit('punch_cyan', 110), embers('215, 90, 255', { count: 5 }))],
    [MECH_VFX, 'MECH_VFX', 'missileBlast', '미사일 폭발', null,
        d => def(spr('fire_burst', 190, { glow: 1.3 }), ...keep(d, 'debris'), embers('255, 190, 80', { cone: 2.8 }))],
    [MECH_VFX, 'MECH_VFX', 'droneBlast', '드론 자폭', sc('mech', 'missile', { clip: 'attack' }),
        d => def(spr('dark_burst', 150), ...keep(d, 'debris'))],
    [MECH_VFX, 'MECH_VFX', 'landing', '출격 착지', sc('mech', 'selfGround'),
        d => def(groundSpr('ground_impact', 210), ...keep(d, 'cracks'))],
    [SET_VFX, 'SET_VFX', 'railHit', '레일건 적중', sc('mech', 'hit'), d => def(hit('punch_cyan', 80, { dur: 0.3 }))],
    // D-118: 레일건 발사 — 총구 청록 전기 섬광(punch_cyan) + 빛줄기 탄(needle_crimson 칸을 청록으로)이 사거리 끝까지 + 가는 궤적
    [SET_VFX, 'SET_VFX', 'railShot', '레일건 발사', sc('mech', 'beam', { arm: 'cannon', part: 'arm_mech_a' }),
        d => def(spr('punch_cyan', 100, { dur: 0.18, frameRange: [1, 4], glow: 1.2 }),
            spr('needle_crimson', 170, { at: 0.01, dur: 0.13, frameRange: [1, 1], hue: 195, travel: true, anchorX: 0.6, glow: 1.3 }),
            { type: 'beam', at: 0.02, dur: 0.2, w: 2.2, color: '120, 240, 255' }, ...keep(d, 'smoke'))],   // 끝 섬광 없음 — 맞은 적에만 railHit
    // D-118: 자동 포탑 한 발 — 포신 끝 작은 섬광(needle_crimson 별빛 칸 청록) + 짧은 빛줄기 탄, 맞은 자리는 A의 불티·연기
    [SET_VFX, 'SET_VFX', 'turretShot', '자동 포탑 사격', sc('mech', 'beam', { part: 'body_mech_a' }),
        d => def(spr('needle_crimson', 46, { dur: 0.09, frameRange: [2, 3], hue: 195, glow: 1.3 }),
            spr('needle_crimson', 80, { at: 0.005, dur: 0.08, frameRange: [1, 1], hue: 195, travel: true, anchorX: 0.6, glow: 1.2 }),
            spr('punch_cyan', 44, { at: 0.07, dur: 0.16, frameRange: [1, 3], glow: 0, pos: 'to' }), ...keep(d, 'streaks', 'smoke'))],
    // D-118: 충전 레일 사격 — 충전: 저음 고리(bass_drop)를 청록으로 거꾸로 틀어 총구로 줄어듦 + 모이는 빛줄기 + 전기 튐(lightning_burst 청록)
    [SET_VFX, 'SET_VFX', 'railCharge', '충전 레일 사격 충전', sc('mech', 'self', { arm: 'cannon', part: 'arm_mech_a' }),
        d => def(spr('bass_drop', 160, { dur: 0.95, frameRange: [1, 4], reverse: true, hue: -95, glow: 0, fadeIn: 0.1 }),
            { type: 'gather', at: 0, dur: 0.95, r: 100, count: 18, color: '120, 240, 255' },
            spr('lightning_burst', 90, { at: 0.25, dur: 0.22, frameRange: [1, 3], hue: 135, glow: 0 }),
            spr('lightning_burst', 110, { at: 0.6, dur: 0.22, frameRange: [1, 3], hue: 135, glow: 0, flipX: true }))],
    // D-118: 충전 레일 사격 발사 — 굵은 청록 광선(apocalypse_beam 색 돌림) + 총구 섬광, 가는 심 광선은 화면 끝까지
    [SET_VFX, 'SET_VFX', 'railBig', '충전 레일 사격 광선', sc('mech', 'beam', { arm: 'cannon', part: 'arm_mech_a' }),
        // 레이저포: 궤도 광선(orbital_beam)의 곧은 청록 기둥을 떼어 오른쪽으로 눕혀 총구에서 화면 끝까지 뻗음 (불꽃 같던 apocalypse_beam 대신)
        d => def(...[[170, 1.15, 0.55], [70, 0, 0.5]].map(([thick, glow, dur]) => spr('orbital_beam', 0, { width: thick, height: 1100,
                crop: [0.22, 0.02, 0.78, 0.5], frameRange: [2, 3], loopSec: 0.12, angle: -Math.PI / 2, anchorX: 0.5, anchorY: 0, dur, glow,
                growIn: 0.07, fadeOut: 0.25 })),
            spr('punch_cyan', 190, { dur: 0.28, frameRange: [2, 5], glow: 1.2 }), ...keep(d, 'smoke', 'streaks'))],
    [SET_VFX, 'SET_VFX', 'rocketHit', '로켓 돌진 충돌', sc('mech', 'melee', { clip: 'attack' }),
        d => def(spr('punch_cyan', 170), ...keep(d, 'debris'))],
    [SET_VFX, 'SET_VFX', 'pileHit', '파일 벙커', sc('mech', 'melee', { clip: 'attack' }),
        d => def(spr('punch_cyan', 210, { glow: 1.5 }), ...keep(d, 'streaks', 'debris'))],
    // 거대괴수
    [KAIJU_VFX, 'KAIJU_VFX', 'acidCharge', '산성 돌진', null,
        d => def(spr('acid_burst', 230, { dy: -40 }), ...keep(d, 'cracks', 'mist'))],
    [KAIJU_VFX, 'KAIJU_VFX', 'eggHatch', '알 부화', sc('kaiju', 'charge'),
        d => def(spr('acid_burst', 100, { dy: -14 }), ...keep(d, 'debris'))],
    [SET_VFX, 'SET_VFX', 'spikeStorm', '가시 폭풍', sc('kaiju', 'selfGround', { clip: 'attack' }),
        d => def(groundSpr('ground_impact', 240), ...keep(d, 'crystals', 'debris', 'ring'))],
    [SET_VFX, 'SET_VFX', 'groundSlam', '지면 내려찍기', sc('kaiju', 'charge', { clip: 'attack' }),
        // D-119: 선으로 그린 균열(cracks) 대신 바닥이 실제로 갈라짐 — 땅 윗면이 V자로 벌어져 앞면 바위로 금이 내려가고 바닥 판이 들림 (skillFx2 fissure, 바닥 층) → 1.6초 뒤 옅어짐
        //   (처음 넣은 바위 무더기 ground_rubble은 "바위가 깨지는 것 같다"는 피드백으로 뺌)
        d => def({ type: 'fissure', at: 0, dur: 1.8, len: 170, glow: '160, 255, 50', layer: 'ground' },
            groundSpr('ground_impact', 300), ...imageShockwave(440, 135).layers, ...keep(d, 'shards'))],
    [SET_VFX, 'SET_VFX', 'sporeBurst', '독 포자 폭발', sc('kaiju', 'charge'),
        d => def(spr('spore_burst', 200, { dy: -50, dur: 0.6 }), ...keep(d, 'ring'))],
    [SET_VFX, 'SET_VFX', 'spitSplash', '산성 침', sc('kaiju', 'charge'), d => def(spr('acid_burst', 110, { dy: -12 }))],
    // 타락 히어로
    [HERO_VFX, 'HERO_VFX', 'waveHit', '어둠 파동 적중', sc('hero', 'hit'),
        d => def(hit('dark_burst', 130), ...keep(d, 'pillar', 'glow'))],
    [HERO_VFX, 'HERO_VFX', 'castRelease', '스킬 시전', sc('hero', 'self'), d => def(hit('dark_burst', 90))],
    [HERO_VFX, 'HERO_VFX', 'mindConvert', '세뇌 변환', sc('hero', 'charge'),
        d => def(spr('mutation_burst', 140, { dy: -34, dur: 0.6 }), ...keep(d, 'rune'))],
    [HERO_VFX, 'HERO_VFX', 'curseNova', '흑마법 폭발', sc('hero', 'charge'),
        d => def(...keep(d, 'rune', 'ring'), spr('dark_burst', 280, { dy: -50, dur: 0.55 }))],
    [SET_VFX, 'SET_VFX', 'whirl', '회전 베기', sc('hero', 'self'),
        d => def(spr('slash_violet', 300, { dur: 0.36 }), spr('slash_violet', 300, { at: 0.07, dur: 0.36, angle: Math.PI }))],
    [SET_VFX, 'SET_VFX', 'orbBlast', '암흑 구체 폭발', sc('hero', 'hit'), d => def(hit('dark_burst', 120))],
    [SET_VFX, 'SET_VFX', 'blackHoleEnd', '블랙홀 붕괴', sc('hero', 'hit'), d => def(spr('dark_burst', 230, { dur: 0.5 }))],
    [SET_VFX, 'SET_VFX', 'clonePoof', '분신 연기', sc('hero', 'selfGround'), d => def(...puff(130))],
    // 합성괴인
    [CHIMERA_VFX, 'CHIMERA_VFX', 'summon', '졸몹 소환', sc('chimera', 'charge'),
        d => def(spr('summon_portal', 150, { anchorY: 0.76, dur: 0.7, glow: 1.15 }))],
    [CHIMERA_VFX, 'CHIMERA_VFX', 'slam', '파괴 광란', sc('chimera', 'charge', { clip: 'attack' }),
        d => def(groundSpr('ground_impact', 380), ...imageShockwave(520, 50).layers, ...keep(d, 'cracks', 'shards', 'embers'))],
    [CHIMERA_VFX, 'CHIMERA_VFX', 'phase2Burst', '2페이즈 변신', sc('chimera', 'selfGround'),
        d => def(...keep(d, 'glow', 'ring').filter(l => !l.at), groundSpr('ground_impact', 300, { at: 0.58 }),
            ...imageShockwave(500, 50).layers.map(l => ({ ...l, at: 0.58 })),
            spr('power_aura', 260, { at: 0.5, anchorY: 0.92, dur: 0.8, glow: 1.15 }), ...keep(d, 'cracks', 'debris'))],
    [SET_VFX, 'SET_VFX', 'maulHit', '광견 돌진 적중', sc('chimera', 'melee', { clip: 'attack' }),
        d => def(spr('claw_fire', 140), ...keep(d, 'debris'))],
    [SET_VFX, 'SET_VFX', 'adrenaline', '아드레날린', sc('chimera', 'selfGround'),
        d => def(spr('power_aura', 230, { anchorY: 0.92, dur: 0.8, glow: 1.15 }), ...keep(d, 'motes'))],
    [SET_VFX, 'SET_VFX', 'earthSmash', '대지 강타', sc('chimera', 'charge', { clip: 'attack' }),
        d => def(groundSpr('ground_impact', 380), ...imageShockwave(540, 50).layers, ...keep(d, 'cracks', 'shards'))],
    [SET_VFX, 'SET_VFX', 'stomp', '짓밟기', sc('chimera', 'selfGround'), d => def(...imageShockwave(180, 50, 0.4).layers)],
    [SET_VFX, 'SET_VFX', 'mobilize', '총동원령', sc('chimera', 'selfGround'),
        d => def(spr('summon_portal', 280, { anchorY: 0.76, dur: 0.8, glow: 1.15 }), ...keep(d, 'glow'))],
    // 새 캐릭터 4종
    [DIVER_VFX, 'DIVER_VFX', 'jetHit', '물줄기 적중', sc('diver', 'hit'), d => def(hit('water_burst', 85, { dur: 0.32 }))],
    [DIVER_VFX, 'DIVER_VFX', 'surgeBurst', '고압 분사', sc('diver', 'self'), d => def(spr('water_burst', 160))],
    [DIVER_VFX, 'DIVER_VFX', 'surgeHit', '물살 적중', sc('diver', 'hit'), d => def(hit('water_burst', 115), ...keep(d, 'chevrons', 'ring'))],
    [SAINT_VFX, 'SAINT_VFX', 'needleHit', '바늘 적중', sc('saint', 'hit'), d => def(hit('needle_crimson', 95, { dur: 0.34 }))],
    [FROST_VFX, 'FROST_VFX', 'fanHit', '서리 부채 적중', sc('frost', 'hit'), d => def(hit('ice_burst', 85, { dur: 0.32 }))],
    [FROST_VFX, 'FROST_VFX', 'crescentBurst', '초승달 참격 발사', sc('frost', 'self'), d => def(spr('ice_burst', 150))],
    [FROST_VFX, 'FROST_VFX', 'crescentHit', '초승달 적중', sc('frost', 'hit'), d => def(hit('ice_burst', 120))],
    [DOLL_VFX, 'DOLL_VFX', 'snipHit', '가위 자르기', sc('doll', 'melee', { clip: 'attack' }), d => def(hit('xcut_cyan', 95, { dur: 0.32 }))],
    [DOLL_VFX, 'DOLL_VFX', 'puppetHit', '꼭두각시 타격', sc('doll', 'hit'), d => def(hit('xcut_cyan', 85, { dur: 0.32 }))],
    [DOLL_VFX, 'DOLL_VFX', 'dollBurst', '토끼 인형 터짐', sc('doll', 'charge'), d => def(...puff(140), ...keep(d, 'ring', 'debris'))],
    // 구역 3·4 적·보스
    [ZONE_VFX, 'ZONE_VFX', 'axeCleave', '악마기사 도끼', sc('hero', 'enemyHit', { enemy: 'demonknight' }),
        d => def(spr('cleave_crimson', 230, { dy: -30, dur: 0.4 }), ...keep(d, 'cracks', 'shards'))],
    [ZONE_VFX, 'ZONE_VFX', 'spellFire', '마법사 불', sc('hero', 'enemyHit', { enemy: 'mage' }), d => def(hit('fire_burst', 110))],
    [ZONE_VFX, 'ZONE_VFX', 'spellBolt', '마법사 번개', sc('hero', 'enemyHit', { enemy: 'mage' }), d => def(hit('lightning_burst', 120))],
    [ZONE_VFX, 'ZONE_VFX', 'spellIce', '마법사 얼음', sc('hero', 'enemyHit', { enemy: 'mage' }), d => def(hit('ice_burst', 110))],
    [ZONE_VFX, 'ZONE_VFX', 'arrowHit', '통제탑 화살', sc('hero', 'enemyHit', { enemy: 'soldier' }),
        d => def(hit('golden_burst', 70, { dur: 0.3 }))],
    [ZONE_VFX, 'ZONE_VFX', 'holyHeal', '신관 치유', sc('hero', 'charge', { enemy: 'priest' }),
        d => def(spr('pillar_gold', 120, { anchorY: 0.92, dur: 0.6, glow: 1.2 }), ...keep(d, 'motes'))],
    [ZONE_VFX, 'ZONE_VFX', 'venomSplash', '유기질 벽 독액', sc('hero', 'enemyHit', { enemy: 'tentacle' }),
        d => def(hit('acid_burst', 115), ...keep(d, 'mist'))],
    [ZONE_VFX, 'ZONE_VFX', 'sporeBurst', '포자 덩어리', sc('hero', 'enemyGround', { enemy: 'sporer' }),
        d => def(spr('spore_burst', 170, { dy: -10, dur: 0.6 }), ...keep(d, 'mist'))],
    [ZONE_VFX, 'ZONE_VFX', 'gooSplat', '유전자 붕괴', sc('hero', 'enemyHit', { enemy: 'slime' }),
        d => def(hit('mutation_burst', 115), ...keep(d, 'chevrons'))],
    [ZONE_VFX, 'ZONE_VFX', 'mutationBurst', '극한의 변이', sc('hero', 'hit', { enemy: 'carapace' }),
        d => def(spr('mutation_burst', 320, { dur: 0.6 }), ...keep(d, 'cracks'))],
    [ZONE_VFX, 'ZONE_VFX', 'chargeImpact', '2페이즈 돌진', sc('hero', 'enemyHit', { enemy: 'carapace' }),
        d => def(spr('cleave_crimson', 220, { dy: -20, dur: 0.36, angle: 0.5 }),
            spr('cleave_crimson', 220, { at: 0.03, dy: -20, dur: 0.36, angle: -0.5, flipX: true }), ...keep(d, 'shockwave', 'cracks'))],
    [ZONE_VFX, 'ZONE_VFX', 'slimeSplit', '슬라임 분열', sc('hero', 'hit', { enemy: 'slime' }),
        d => def(hit('mutation_burst', 110), ...keep(d, 'goo'))],
    [ZONE_VFX, 'ZONE_VFX', 'abyssGate', '심연의 문 개방', sc('mech', 'spawn', { enemy: 'demonknight' }),
        d => def(spr('hellgate_red', 260, { anchorY: 0.78, dur: 0.9, glow: 1.15 }), ...keep(d, 'motes'))],
    [BOSS_VFX, 'BOSS_VFX', 'chainHit', '속죄의 사슬', sc('hero', 'enemyHit', { enemy: 'inquisitor' }),
        d => def(spr('golden_burst', 150), ...keep(d, 'ring'))],
    [BOSS_VFX, 'BOSS_VFX', 'gaze', '진홍 시선 (외눈)', sc('hero', 'enemyBeam', { enemy: 'oculus' }),
        d => def(...clone(d.layers.filter(l => !(l.pos === 'to' && ['flash', 'shockwave'].includes(l.type)))),
            spr('needle_crimson', 150, { pos: 'to', at: 0.04 }))],
    [ELITE_VFX, 'ELITE_VFX', 'volatileBlast', '엘리트 자폭', sc('mech', 'charge'),
        d => def(spr('fire_burst', 260, { dy: -40, dur: 0.5 }), ...keep(d, 'shockwave'))],
    [ELITE_VFX, 'ELITE_VFX', 'frostHit', '엘리트 냉기', sc('hero', 'enemyHit'), d => def(hit('ice_burst', 100), ...keep(d, 'crystals'))],
    [ELITE_VFX, 'ELITE_VFX', 'shieldBreak', '엘리트 방패 깨짐', sc('hero', 'hit'), d => def(spr('punch_cyan', 170), ...keep(d, 'debris'))],
    // 공통 전투
    [BATTLE_VFX, 'BATTLE_VFX', 'shockHit', '전기 충격', null, d => def(hit('lightning_burst', 130))],
    [BATTLE_VFX, 'BATTLE_VFX', 'shieldBash', '방패 강타', sc('hero', 'enemyHit', { enemy: 'shield' }),
        d => def(spr('punch_cyan', 150), ...keep(d, 'debris'))],
    [BATTLE_VFX, 'BATTLE_VFX', 'emp', 'EMP', sc('mech', 'enemyGround', { enemy: 'mechanic' }),
        d => def(spr('lightning_burst', 320, { dy: -120, dur: 0.5 }), ...keep(d, 'ring'))],
    [BATTLE_VFX, 'BATTLE_VFX', 'eliteSpawn', '엘리트 등장', null,
        d => def(spr('summon_portal', 170, { anchorY: 0.76, dur: 0.8, glow: 1.15 }), ...keep(d, 'motes'))],
    [BATTLE_VFX, 'BATTLE_VFX', 'baseBlast', '거점 연쇄 폭발', sc('mech', 'finale'),
        d => def(spr('fire_burst', 170), ...keep(d, 'debris', 'smoke'))],
    [BATTLE_VFX, 'BATTLE_VFX', 'baseHit', '거점 피격', null, d => def(hit('punch_fire', 90, { dur: 0.32 }))]
];
for (const [table, group, key, name, scene, make] of D_MORE) addD(table, group, key, name, scene, make(table[key]));

/** 게임 기본값: D(그림 프레임)가 있는 이펙트는 D, 나머지는 A — 주소 ?vfx=A로 예전 모습 */
export const DEFAULT_VFX_CHOICES = Object.fromEntries(Object.entries(VFX_VARIANTS)
    .filter(([, e]) => e.variants.D).map(([k]) => [k, 'D']));

function fullKey(key) {
    return Object.hasOwn(VFX_VARIANTS, key) ? key : Object.keys(VFX_VARIANTS).find(k => k.split('.')[1] === key);
}

export function applyVfxVariant(key, id) {
    const full = fullKey(key), entry = VFX_VARIANTS[full];
    if (!entry || !Object.hasOwn(entry.variants, id)) return false;
    const target = targets[full], original = entry.variants.A.def;
    for (const prop of Object.keys(target)) delete target[prop];
    Object.assign(target, clone(entry.variants[id].def));
    if (Object.hasOwn(original, 'sfx')) target.sfx = original.sfx;
    return true;
}

export function applyVfxChoices(choices = {}) {
    for (const [key, id] of Object.entries(choices)) applyVfxVariant(key, id);
}

export function readVfxChoices() {
    const choices = { ...DEFAULT_VFX_CHOICES };
    const accept = (key, id) => {
        const full = fullKey(key);
        if (full && Object.hasOwn(VFX_VARIANTS[full].variants, id)) choices[full] = id;
    };
    try {
        const saved = JSON.parse(localStorage.getItem('vfxChoices') || '{}');
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.entries(saved).forEach(([k, id]) => accept(k, id));
    } catch { /* 저장소를 사용할 수 없거나 잘못된 값이면 기본 A */ }
    const query = new URLSearchParams(location.search).get('vfx');
    if (['A', 'B', 'C', 'D'].includes(query)) Object.keys(VFX_VARIANTS).forEach(k => accept(k, query));
    else if (query) query.split(',').forEach(pair => { const [k, id] = pair.split(':'); accept(k, id); });
    return choices;
}

export function readVfxStyle() {
    const query = new URLSearchParams(location.search).get('vfxStyle');
    if (query !== null) return query === 'pixel' ? 'pixel' : 'glow';
    try { return localStorage.getItem('vfxStyle') === 'pixel' ? 'pixel' : 'glow'; }
    catch { return 'glow'; }
}
