/* ==========================================================================
   PROJECT: MAD OVERLORD // 구역 2·3·4·6 적·보스·거점 전용 이펙트 (v2)
   구역 2: 누런 연두 독가스 / 구역 3: 칠흑·진홍 마력·바랜 금빛
   구역 4: 심연의 보라·광택 갑각·생체 발광 녹색 점액 / 구역 6: 잿빛 그림자·금빛 종·붉은 실
   ========================================================================== */

const TOXIC = '200, 220, 60';
const TOXIC_DARK = '150, 170, 40';
const HOLY_GOLD = '255, 214, 120';
const HOLY_WHITE = '255, 244, 205';
const CRIMSON = '220, 40, 65';
const DARK_CRIMSON = '85, 20, 40';
const SHADOW = '35, 15, 30';
const VOID = '170, 90, 255';
const BIO = '150, 255, 90';
const SPORE = '105, 160, 60';
const FIRE = '255, 140, 40';
const EMBER = '255, 200, 100';
const BOLT = '255, 240, 120';
const ICE = '150, 220, 255';
const WHITE = '245, 250, 255';
const STONE = '75, 65, 75';
const ASH = '150, 150, 160';
const ASH_DARK = '60, 58, 70';
const THREAD = '230, 50, 70';

export const ZONE_VFX = {
    // ======== 구역 2 · 하부 폐기물 정착지 ========
    // 소각탑 굴뚝: 크게 퍼지는 독가스 + 바닥 고리 + 떠오르는 독 가루
    toxicBurst: {
        sfx: 'zone_gas',
        layers: [
            { type: 'flash', at: 0, dur: 0.16, r: 46, color: TOXIC },
            { type: 'mist', at: 0, r: 218, h: 24, life: 1.8, drift: 14, color: TOXIC_DARK, dy: 340 },
            { type: 'mist', at: 0.15, r: 394, h: 27, life: 2.0, drift: 14, color: TOXIC, dy: 340 },
            { type: 'mist', at: 0.3, r: 344, h: 22, life: 2.0, drift: 14, color: TOXIC_DARK, dy: 340 },
            { type: 'ring', at: 0.12, dur: 1.1, r: 900, ground: true, color: TOXIC, width: 8, dy: 350 },
            { type: 'glow', at: 0.15, dur: 1.8, r: 360, color: TOXIC, dy: 350 },
            { type: 'motes', at: 0.2, count: 10, spread: 300, rise: [25, 65], life: [1.0, 1.8], size: 3, color: TOXIC, dy: 250 },
            { type: 'goo', at: 0.15, count: 6, speed: 210, size: 9, life: 1.2, floor: 0, splat: true, color: TOXIC, dy: 340 }
        ]
    },

    // ======== 구역 3 · 성왕국 수도 ========
    // 천상의 심판 예고: 주인공 발밑 금빛 룬
    judgmentWarn: {
        layers: [
            { type: 'rune', at: 0, dur: 1.4, r: 70, color: HOLY_GOLD, spin: 3 },
            { type: 'glow', at: 0, dur: 1.4, r: 80, color: HOLY_GOLD },
            { type: 'ring', at: 1.0, dur: 0.4, r: 70, ground: true, inward: true, color: HOLY_WHITE, width: 2 },
            { type: 'motes', at: 0.65, count: 6, spread: 42, rise: [25, 45], life: [0.35, 0.55], size: 2, color: HOLY_GOLD },
            { type: 'mist', at: 0, r: 70, h: 10, life: 1.4, drift: 0, rim: true, color: HOLY_GOLD }
        ]
    },
    // 천상의 심판: 굵은 금빛 기둥 + 지면 충격파
    heavenPillar: {
        sfx: 'zone_judgment',
        layers: [
            { type: 'rays', at: 0, dur: 0.65, count: 14, len: 165, width: 12, spin: -0.45, color: HOLY_GOLD, dy: -60 },
            { type: 'pillar', at: 0, dur: 0.7, h: 480, w: 80, color: HOLY_GOLD },
            { type: 'pillar', at: 0.03, dur: 0.45, h: 460, w: 22, color: HOLY_WHITE },
            { type: 'flash', at: 0, dur: 0.22, r: 85, color: HOLY_WHITE, dy: -60 },
            { type: 'shockwave', at: 0.02, dur: 0.5, r: 180, ground: true, color: HOLY_GOLD, width: 32 },
            { type: 'cracks', at: 0.02, dur: 1.2, count: 8, len: 140, color: HOLY_GOLD },
            { type: 'glow', at: 0.08, dur: 1.2, r: 100, color: HOLY_GOLD },
            { type: 'motes', at: 0.08, count: 12, spread: 90, rise: [60, 140], life: [0.7, 1.3], size: 3, color: HOLY_GOLD },
            { type: 'motes', at: 0.28, count: 8, spread: 55, rise: [80, 160], life: [0.7, 1.1], size: 2, color: HOLY_WHITE },
            { type: 'dust', at: 0.02, count: 5, speed: 180, size: 22, life: 0.8, color: STONE },
            { type: 'shards', at: 0.02, count: 5, speed: 230, size: 6, spin: 7, life: 0.85, shape: 'rock', floor: 0, color: STONE }
        ]
    },
    // 악마병 한 명의 소환진: 검붉은 룬 + 진홍 마력 연기
    hellGate: {
        sfx: 'zone_hellgate',
        layers: [
            { type: 'rune', at: 0, dur: 0.8, r: 44, spin: 4, color: CRIMSON, dy: 30 },
            { type: 'glow', at: 0, dur: 1.0, r: 50, color: DARK_CRIMSON, dy: 30 },
            { type: 'swirl', at: 0, dur: 0.65, r: 40, arms: 3, spin: 8, color: CRIMSON, dy: 10 },
            { type: 'flash', at: 0.12, dur: 0.15, r: 22, color: CRIMSON, dy: 10 },
            { type: 'smoke', at: 0.05, count: 7, spread: 28, spreadY: 24, size: 18, life: [0.6, 1.0], rise: 35, color: DARK_CRIMSON },
            { type: 'motes', at: 0.18, count: 7, spread: 30, rise: [35, 80], life: [0.6, 1.0], size: 2.5, color: CRIMSON },
            { type: 'dust', at: 0.12, count: 3, speed: 80, size: 14, life: 0.7, color: STONE, dy: 30 },
            { type: 'shards', at: 0.12, count: 3, speed: 140, size: 6, spin: 6, life: 0.75, shape: 'rock', floor: 0, color: STONE, dy: 30 }
        ]
    },
    // 심연의 문 개방: 악마기사의 큰 소환진 + 진홍 기둥
    abyssGate: {
        sfx: 'zone_knight',
        layers: [
            { type: 'rune', at: 0, dur: 1.1, r: 90, spin: 5, color: VOID, dy: 40 },
            { type: 'swirl', at: 0, dur: 0.85, r: 84, arms: 5, spin: 11, color: VOID },
            { type: 'ring', at: 0, dur: 0.45, r: 95, ground: true, inward: true, width: 4, color: VOID, dy: 40 },
            { type: 'pillar', at: 0.05, dur: 0.65, h: 260, w: 50, color: VOID, dy: 40 },
            { type: 'flash', at: 0.08, dur: 0.2, r: 48, color: WHITE },
            { type: 'glow', at: 0.1, dur: 1.3, r: 100, color: VOID, dy: 40 },
            { type: 'motes', at: 0.08, count: 8, spread: 70, rise: [65, 150], life: [0.8, 1.3], size: 3, color: VOID },
            { type: 'mist', at: 0.1, r: 84, h: 12, life: 1.2, drift: 14, color: SHADOW, dy: 40 },
            { type: 'hands', at: 0.08, dur: 0.85, count: 3, h: 115, spread: 56, color: VOID, dy: 40 },
            { type: 'goo', at: 0.08, count: 4, speed: 150, size: 8, life: 1.0, floor: 40, splat: true, color: BIO }
        ]
    },
    // 악마기사 도끼: 크게 휜 한 줄의 베기 + 바닥 균열
    axeCleave: {
        sfx: 'zone_axe',
        layers: [
            { type: 'slash', at: 0, dur: 0.42, r: 133, arc: 2.7, sweep: 0.12, thick: 1, angle: 1.2, width: 26, color: CRIMSON, dy: -30 },
            { type: 'cracks', at: 0.04, dur: 0.9, count: 6, len: 95, color: CRIMSON, dy: 42 },
            { type: 'ring', at: 0.04, dur: 0.4, r: 75, ground: true, color: CRIMSON, width: 4, dy: 42 },
            { type: 'shards', at: 0.04, count: 6, speed: 260, size: 6.3, spin: 7, life: [0.7, 1.1], shape: 'rock', floor: 0, color: STONE, dy: 42 },
            { type: 'dust', at: 0.08, count: 4, speed: 106, dir: 'both', size: 18, life: 0.8, color: STONE, dy: 42 },
            { type: 'flash', at: 0.02, dur: 0.13, r: 35, color: WHITE }
        ]
    },
    // 마법사 원소탄: 가슴 높이에서 터지는 불·번개·얼음
    spellFire: {
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 20, color: EMBER },
            { type: 'flame', at: 0, count: 10, speed: 230, angle: 0, cone: Math.PI * 2, size: 10, grow: 3.5, life: [0.5, 0.75], drag: 2.5, rise: 80, color: FIRE },
            { type: 'flame', at: 0.06, count: 5, speed: 140, angle: -Math.PI / 2, cone: 2.4, size: 9, grow: 3, life: [0.45, 0.7], drag: 2.0, rise: 95, color: FIRE },
            { type: 'embers', at: 0.02, count: 7, speed: 220, angle: 0, cone: Math.PI * 2, size: 1.5, life: [0.45, 0.9], rise: 40, color: EMBER }
        ]
    },
    spellBolt: {
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 32, color: WHITE },
            { type: 'bolt', jag: 18, branches: 2, width: 2.8, flicker: 0.055, at: 0, dur: 0.22, count: 5, len: 62, color: BOLT, layer: 'front' },
            { type: 'bolt', jag: 18, branches: 2, width: 2.8, flicker: 0.055, at: 0.09, dur: 0.28, count: 3, len: 45, color: WHITE, dy: -16, layer: 'front' },
            { type: 'ring', at: 0.02, dur: 0.35, r: 45, width: 2, color: BOLT },
            { type: 'streaks', at: 0.02, count: 8, speed: 330, len: 34, life: [0.3, 0.55], color: BOLT },
            { type: 'motes', at: 0.1, count: 5, spread: 28, rise: [20, 45], life: [0.4, 0.7], size: 1.8, color: BOLT }
        ]
    },
    spellIce: {
        layers: [
            { type: 'crystals', at: 0, dur: 0.65, count: 4, h: 34, spread: 23, color: ICE, dy: 18 },
            { type: 'shards', at: 0.12, count: 4, speed: 170, size: 4.5, spin: 9, life: [0.7, 1.1], shape: 'ice', floor: 32, color: ICE },
            { type: 'mist', at: 0.06, r: 40, h: 8, life: 0.75, drift: 14, color: ICE, dy: 30 },
            { type: 'glow', at: 0.02, dur: 0.75, r: 38, color: ICE, dy: 18 },
            { type: 'flash', at: 0, dur: 0.12, r: 24, color: WHITE }
        ]
    },
    // 통제탑 화살·마법: 짧은 관통 자국 + 작은 금빛 불티
    arrowHit: {
        layers: [
            { type: 'flash', at: 0, dur: 0.08, r: 14, color: HOLY_WHITE },
            { type: 'claw', at: 0, dur: 0.36, count: 1, len: 48, angle: 2.65, width: 3, bend: 0, color: HOLY_GOLD },
            { type: 'streaks', at: 0, count: 3, speed: 150, len: 34, life: [0.3, 0.55], angle: Math.PI, cone: 1.2, color: HOLY_GOLD },
            { type: 'motes', at: 0.04, count: 2, spread: 9, rise: [15, 30], life: [0.25, 0.45], size: 1.5, color: HOLY_GOLD },
            { type: 'shockwave', at: 0.02, dur: 0.32, r: 28, width: 8, color: HOLY_GOLD }
        ]
    },
    // 신관 치유: 작은 금빛 기둥 + 떠오르는 가루
    holyHeal: {
        sfx: 'zone_heal_holy',
        layers: [
            { type: 'rays', at: 0.08, dur: 0.65, count: 8, len: 60, width: 6, spin: 0.7, color: HOLY_GOLD, dy: -36 },
            { type: 'pillar', at: 0, dur: 0.6, h: 88, w: 24, color: HOLY_GOLD },
            { type: 'flash', at: 0.08, dur: 0.18, r: 20, color: HOLY_WHITE, dy: -36 },
            { type: 'glow', at: 0, dur: 1, r: 46, color: HOLY_GOLD },
            { type: 'motes', at: 0.1, count: 8, spread: 28, rise: [45, 90], life: [0.8, 1.2], size: 3, color: HOLY_GOLD, dy: -20 },
            { type: 'shockwave', at: 0, dur: 0.65, r: 48, ground: true, color: HOLY_GOLD, width: 14 },
            { type: 'mist', at: 0, r: 46, h: 12, life: 0.8, drift: 10, color: HOLY_GOLD }
        ]
    },

    // ======== 구역 4 · 진화의 심연 ========
    // 유기질 벽 독액: 끈적한 초록 덩어리 + 바닥 얼룩
    venomSplash: {
        sfx: 'zone_venom',
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 22, color: BIO },
            { type: 'goo', at: 0, count: 6, speed: 144, size: 6.9, life: [0.8, 1.15], splat: true, floor: 20, color: BIO },
            { type: 'ring', at: 0.02, dur: 0.5, r: 48, ground: true, width: 3, color: BIO, dy: 10 },
            { type: 'glow', at: 0, dur: 1.1, r: 48, color: BIO, dy: 10 },
            { type: 'mist', at: 0.12, r: 44, h: 8.5, life: 1.0, drift: 14, color: SPORE, dy: 20 }
        ]
    },
    // 포자 덩어리: 연두 포자 구름 + 떠오르는 가루
    sporeBurst: {
        sfx: 'zone_spore',
        layers: [
            { type: 'flash', at: 0, dur: 0.14, r: 30, color: BIO },
            { type: 'ring', at: 0.02, dur: 0.5, r: 65, ground: true, width: 3, color: SPORE },
            { type: 'glow', at: 0.05, dur: 1.1, r: 60, color: BIO },
            { type: 'mist', at: 0, r: 74, h: 13, life: 1.3, drift: 14, color: SPORE, dy: 20 },
            { type: 'motes', at: 0.12, count: 12, spread: 55, rise: [25, 65], life: [0.8, 1.3], size: 3, color: BIO },
            { type: 'goo', at: 0, count: 6, speed: 120, size: 5.8, life: [0.8, 1.15], splat: true, floor: 20, color: BIO }
        ]
    },
    // 유전자 붕괴: 초록·보라 점액 + 가라앉는 감속 표식
    gooSplat: {
        sfx: 'zone_goo',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 26, color: BIO },
            { type: 'goo', at: 0, count: 6, speed: 148, size: 6.9, life: [0.8, 1.15], splat: true, floor: 30, color: BIO },
            { type: 'goo', at: 0.04, count: 5, speed: 112, size: 5.8, life: [0.8, 1.15], splat: true, floor: 30, color: VOID },
            { type: 'mist', at: 0.12, r: 50, h: 9, life: 1.0, drift: 14, color: SPORE, dy: 30 },
            { type: 'ring', at: 0.04, dur: 0.55, r: 52, ground: true, width: 3, color: VOID, dy: 30 },
            { type: 'glow', at: 0, dur: 1.0, r: 48, color: BIO, dy: 30 },
            { type: 'chevrons', at: 0.05, count: 3, spread: 14, fall: 26, life: [0.7, 1.0], size: 7, color: VOID, dy: -40 }
        ]
    },
    // 심연의 파동 예고: 주인공 발밑 보라 룬
    abyssWarn: {
        layers: [
            { type: 'rune', at: 0, dur: 1.0, r: 70, color: VOID, spin: 3 },
            { type: 'glow', at: 0, dur: 1.0, r: 80, color: VOID },
            { type: 'ring', at: 0.6, dur: 0.4, r: 70, ground: true, inward: true, width: 3, color: BIO },
            { type: 'motes', at: 0.3, count: 6, spread: 50, rise: [15, 35], life: [0.4, 0.65], size: 2, color: BIO },
            { type: 'mist', at: 0, r: 70, h: 10, life: 1.0, drift: 0, rim: true, color: VOID }
        ]
    },
    // 극한의 변이: 보스 몸에서 터지는 보라 갑각 + 형광 점액
    mutationBurst: {
        sfx: 'zone_mutation',
        layers: [
            { type: 'swirl', at: 0, dur: 0.35, r: 95, arms: 4, spin: 8, color: VOID },
            { type: 'flash', at: 0.06, dur: 0.22, r: 95, color: WHITE },
            { type: 'ring', at: 0, dur: 0.55, r: 180, color: VOID, width: 9 },
            { type: 'ring', at: 0.1, dur: 0.65, r: 240, color: VOID, width: 5 },
            { type: 'glow', at: 0.08, dur: 1.3, r: 120, color: VOID, dy: 50 },
            { type: 'cracks', at: 0.06, dur: 0.9, count: 6, len: 110, color: BIO, dy: 50 },
            { type: 'shards', at: 0.06, count: 10, speed: 340, size: 7.2, spin: 7, life: [0.7, 1.1], shape: 'shell', floor: 90, color: VOID },
            { type: 'mist', at: 0.08, r: 98, h: 14, life: 1.3, drift: 14, color: DARK_CRIMSON, dy: 90 },
            { type: 'motes', at: 0.16, count: 8, spread: 85, rise: [50, 120], life: [0.8, 1.4], size: 3, color: BIO },
            { type: 'goo', at: 0.08, count: 5, speed: 210, size: 9, life: 1.2, floor: 90, splat: true, color: BIO }
        ]
    },
    // 2페이즈 돌진: X자 진홍 베기 + 바닥 충격파
    chargeImpact: {
        sfx: 'zone_charge',
        layers: [
            { type: 'slash', at: 0, dur: 0.3, r: 117, arc: 1.85, sweep: 0.12, thick: 1, angle: 0.8, width: 20, color: CRIMSON, dy: -20 },
            { type: 'slash', at: 0.03, dur: 0.3, r: 117, arc: 1.85, sweep: 0.12, thick: 1, angle: 2.35, width: 20, color: CRIMSON, dy: -20 },
            { type: 'shockwave', at: 0, dur: 0.4, r: 130, ground: true, color: CRIMSON, width: 28, dy: 42 },
            { type: 'cracks', at: 0.03, dur: 0.85, count: 5, len: 95, color: CRIMSON, dy: 42 },
            { type: 'glow', at: 0.03, dur: 0.65, r: 65, color: CRIMSON, dy: 42 },
            { type: 'shards', at: 0, count: 9, speed: 290, size: 6.3, angle: 2.6, cone: 1.4, spin: 7, life: [0.7, 1.1], shape: 'rock', floor: 0, color: STONE, dy: 42 },
            { type: 'dust', at: 0.06, count: 5, speed: 112, dir: 'both', size: 22, life: 0.9, color: STONE, dy: 42 },
            { type: 'flash', at: 0, dur: 0.16, r: 50, color: WHITE }
        ]
    },
    // 키메라 슬라임 분열: 사방으로 튀는 보라·초록 물방울
    slimeSplit: {
        sfx: 'zone_split',
        layers: [
            { type: 'goo', at: 0, count: 4, speed: 152, size: 7.4, angle: -2.25, cone: 0.9, life: [0.8, 1.15], splat: true, floor: 20, color: VOID },
            { type: 'goo', at: 0, count: 4, speed: 152, size: 6.6, angle: -0.9, cone: 0.9, life: [0.8, 1.15], splat: true, floor: 20, color: BIO },
            { type: 'flash', at: 0, dur: 0.12, r: 24, color: WHITE },
            { type: 'ring', at: 0.02, dur: 0.5, r: 55, ground: true, width: 3, color: BIO, dy: 20 },
            { type: 'mist', at: 0.1, r: 48, h: 9, life: 0.9, drift: 14, color: VOID, dy: 20 },
            { type: 'glow', at: 0, dur: 0.9, r: 50, color: VOID, dy: 20 }
        ]
    },

    // ======== 구역 6 · 성왕국 변두리 (D-078) — 잿빛 그림자 · 흰 병동 · 금빛 헌금 · 붉은 실 ========
    // 그림자 집행자 기습: 짧고 검은 베기 + 잿빛 연기 (주인공 가슴 높이)
    shadowStrike: {
        sfx: 'generic_slash',
        layers: [
            { type: 'slash', at: 0, dur: 0.24, r: 72, arc: 2.0, sweep: 0.08, thick: 0.8, angle: 0.9, width: 13, color: ASH_DARK, dy: -10 },
            { type: 'slash', at: 0.02, dur: 0.2, r: 64, arc: 1.8, sweep: 0.08, thick: 0.6, angle: 0.9, width: 5, color: WHITE, dy: -10 },
            { type: 'smoke', at: 0, count: 4, spread: 20, spreadY: 16, size: 14, life: [0.4, 0.7], rise: 20, color: ASH },
            { type: 'flash', at: 0, dur: 0.08, r: 18, color: WHITE }
        ]
    },
    // 그림자 집행자가 드러나거나 숨을 때: 잿빛 연기 한 줌
    shadowPuff: {
        layers: [
            { type: 'smoke', at: 0, count: 6, spread: 26, spreadY: 30, size: 18, life: [0.5, 0.8], rise: 30, color: ASH },
            { type: 'motes', at: 0.05, count: 5, spread: 24, rise: [20, 45], life: [0.4, 0.7], size: 2, color: ASH_DARK }
        ]
    },
    // 파문의 종 예고: 보스 둘레 금빛 룬이 돎
    bellWarn: {
        layers: [
            { type: 'rune', at: 0, dur: 1.2, r: 80, color: HOLY_GOLD, spin: 4 },
            { type: 'glow', at: 0, dur: 1.2, r: 90, color: HOLY_GOLD },
            { type: 'ring', at: 0.8, dur: 0.4, r: 80, ground: true, inward: true, color: HOLY_WHITE, width: 2 }
        ]
    },
    // 파문의 종: 금빛 고리 파동이 크게 퍼짐 (범위 = bell.range)
    bellToll: {
        sfx: 'zone_judgment',
        layers: [
            { type: 'flash', at: 0, dur: 0.18, r: 60, color: HOLY_WHITE },
            { type: 'ring', at: 0, dur: 0.7, r: 560, ground: true, color: HOLY_GOLD, width: 10 },
            { type: 'ring', at: 0.12, dur: 0.7, r: 420, ground: true, color: HOLY_WHITE, width: 4 },
            { type: 'ring', at: 0.05, dur: 0.6, r: 140, color: HOLY_GOLD, width: 3 },
            { type: 'motes', at: 0.05, count: 10, spread: 90, rise: [40, 90], life: [0.6, 1.0], size: 2.5, color: HOLY_GOLD }
        ]
    },
    // 생명의 저울: 보스 둘레 금빛 저울 빛 + 붉은 빛이 모여듦
    scalesTilt: {
        sfx: 'zone_heal_holy',
        layers: [
            { type: 'rune', at: 0, dur: 0.9, r: 56, color: HOLY_GOLD, spin: -3, dy: 60 },
            { type: 'glow', at: 0, dur: 1.0, r: 80, color: HOLY_GOLD, dy: 60 },
            { type: 'ring', at: 0, dur: 0.6, r: 90, inward: true, color: THREAD, width: 3, dy: 60 },
            { type: 'motes', at: 0.1, count: 10, spread: 60, rise: [30, 70], life: [0.6, 1.0], size: 2.5, color: THREAD, dy: 20 }
        ]
    },
    // 축복 성수대가 부서짐: 금빛 성수 물보라
    fontBreak: {
        sfx: 'zone_heal_holy',
        layers: [
            { type: 'flash', at: 0, dur: 0.16, r: 40, color: HOLY_WHITE },
            { type: 'goo', at: 0, count: 8, speed: 200, size: 7, life: [0.7, 1.1], splat: true, floor: 0, color: HOLY_GOLD },
            { type: 'ring', at: 0.02, dur: 0.6, r: 120, ground: true, width: 4, color: HOLY_GOLD },
            { type: 'motes', at: 0.05, count: 12, spread: 50, rise: [50, 110], life: [0.6, 1.1], size: 2.5, color: HOLY_GOLD }
        ]
    },

    // ======== 새 기획 구역 1 · 블랙 하운드 (D-085): 강철 회색·경보 진홍·합선 푸른 불꽃 ========
    // 대전차 로켓 착탄: 주황 폭발 + 검은 연기 + 파편
    rocketBlast: {
        sfx: 'base_blast',
        layers: [
            { type: 'flash', at: 0, dur: 0.16, r: 50, color: EMBER },
            { type: 'shockwave', at: 0, dur: 0.45, r: 90, ground: true, width: 18, color: FIRE },
            { type: 'glow', at: 0.02, dur: 0.8, r: 70, color: FIRE },
            { type: 'streaks', at: 0, count: 10, speed: 320, len: 30, life: [0.25, 0.5], color: EMBER },
            { type: 'smoke', at: 0.08, count: 5, spread: 40, spreadY: 14, size: 24, life: [0.6, 1.0], rise: 30, color: STONE },
            { type: 'motes', at: 0.05, count: 8, spread: 40, rise: [30, 70], life: [0.4, 0.8], size: 2.5, color: EMBER }
        ]
    },
    // 네이팜: 바닥에 번지는 불길
    napalmBurst: {
        sfx: 'zone_spell_fire',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 34, color: EMBER },
            { type: 'goo', at: 0, count: 7, speed: 150, size: 6.5, life: [0.6, 1.0], splat: true, floor: 0, color: FIRE },
            { type: 'glow', at: 0, dur: 0.9, r: 60, color: FIRE },
            { type: 'motes', at: 0.05, count: 10, spread: 55, rise: [30, 80], life: [0.5, 0.9], size: 2.5, color: EMBER },
            { type: 'smoke', at: 0.1, count: 3, spread: 40, spreadY: 8, size: 18, life: [0.5, 0.9], rise: 25, color: STONE }
        ]
    },
    // EMP 드론 전파: 푸른 고리 + 잔전기
    empZap: {
        sfx: 'shield_break',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 28, color: WHITE },
            { type: 'ring', at: 0, dur: 0.5, r: 70, color: '120, 210, 255', width: 4 },
            { type: 'bolt', jag: 12, branches: 1, width: 2, flicker: 0.05, at: 0, dur: 0.3, count: 4, len: 60, color: '120, 210, 255', layer: 'front' },
            { type: 'glow', at: 0, dur: 0.6, r: 46, color: '120, 210, 255' }
        ]
    },
    // WMD-알파 플라스마 레이저: 예고(가는 붉은 조준선) → 굵은 진홍 광선
    plasmaWarn: {
        layers: [
            { type: 'beam', at: 0, dur: 1.3, w: 2, color: '255, 60, 60' },
            { type: 'glow', at: 0, dur: 1.3, r: 30, color: '255, 60, 60', layer: 'front' },
            { type: 'ring', at: 0.9, dur: 0.4, r: 36, inward: true, width: 2, color: '255, 60, 60', pos: 'to' },
            { type: 'rune', at: 0, dur: 1.3, r: 24, spin: -2, color: '255, 60, 60', pos: 'to', layer: 'front' }
        ]
    },
    plasmaBeam: {
        sfx: 'mech_laser',
        layers: [
            { type: 'beam', at: 0, dur: 0.55, w: 34, color: '255, 40, 50' },
            { type: 'beam', at: 0, dur: 0.4, w: 10, color: WHITE },
            { type: 'flash', at: 0, dur: 0.2, r: 50, color: WHITE, pos: 'to' },
            { type: 'shockwave', at: 0.03, dur: 0.45, r: 75, width: 18, color: '255, 40, 50', pos: 'to' },
            { type: 'glow', at: 0.05, dur: 0.9, r: 60, color: '255, 40, 50', pos: 'to', layer: 'front' },
            { type: 'motes', at: 0.08, count: 8, spread: 40, rise: [30, 80], life: [0.5, 0.9], size: 2.5, color: EMBER, pos: 'to' }
        ]
    },
    // ======== 새 기획 구역 10 · 중앙 방송 타워: 네온 핑크·칠흑 ========
    neonWarn: {
        layers: [
            { type: 'beam', at: 0, dur: 1.3, w: 2, color: '255, 60, 200' },
            { type: 'glow', at: 0, dur: 1.3, r: 30, color: '255, 60, 200', layer: 'front' },
            { type: 'ring', at: 0.9, dur: 0.4, r: 36, inward: true, width: 2, color: '255, 120, 220', pos: 'to' }
        ]
    },
    neonBeam: {
        sfx: 'mech_laser',
        layers: [
            { type: 'beam', at: 0, dur: 0.6, w: 38, color: '255, 50, 190' },
            { type: 'beam', at: 0, dur: 0.45, w: 12, color: WHITE },
            { type: 'flash', at: 0, dur: 0.2, r: 54, color: WHITE, pos: 'to' },
            { type: 'shockwave', at: 0.03, dur: 0.45, r: 80, width: 18, color: '255, 60, 200', pos: 'to' },
            { type: 'glow', at: 0.05, dur: 0.9, r: 64, color: '255, 60, 200', pos: 'to', layer: 'front' }
        ]
    },
    // ======== 새 기획 구역 8 · 노르딘 왕성: 서리 푸른빛과 화로석 붉은빛 ========
    // 증기 돌파병 자폭: 하얀 수증기 장막
    steamBurst: {
        sfx: 'zone_gas',
        layers: [
            { type: 'flash', at: 0, dur: 0.14, r: 40, color: WHITE },
            { type: 'mist', at: 0, r: 120, h: 30, life: 1.6, drift: 18, color: '230, 230, 235', dy: 40 },
            { type: 'mist', at: 0.15, r: 160, h: 26, life: 1.8, drift: 18, color: '200, 200, 210', dy: 60 },
            { type: 'smoke', at: 0.05, count: 6, spread: 80, spreadY: 20, size: 28, life: [0.8, 1.3], rise: 40, color: '220, 220, 228' }
        ]
    },
    // 화룡의 숨결: 붉은 조준선 → 불꽃 브레스
    fireWarn: {
        layers: [
            { type: 'beam', at: 0, dur: 1.2, w: 3, color: '255, 120, 40' },
            { type: 'glow', at: 0, dur: 1.2, r: 34, color: '255, 120, 40', layer: 'front' },
            { type: 'ring', at: 0.8, dur: 0.4, r: 36, inward: true, width: 2, color: '255, 160, 60', pos: 'to' }
        ]
    },
    fireBreath: {
        sfx: 'zone_spell_fire',
        layers: [
            { type: 'beam', at: 0, dur: 0.6, w: 46, color: '255, 110, 30' },
            { type: 'beam', at: 0, dur: 0.45, w: 16, color: '255, 230, 140' },
            { type: 'flash', at: 0, dur: 0.2, r: 56, color: EMBER, pos: 'to' },
            { type: 'motes', at: 0.05, count: 12, spread: 60, rise: [30, 90], life: [0.5, 0.9], size: 3, color: EMBER, pos: 'to' },
            { type: 'smoke', at: 0.1, count: 4, spread: 50, spreadY: 10, size: 22, life: [0.6, 1.0], rise: 30, color: STONE, pos: 'to' }
        ]
    },
    // ======== 새 기획 구역 6 · 피에 젖은 성역 ========
    // 탐욕의 심장 핏빛 파동: 팽창했다 수축하며 붉은 충격파 고리
    bloodPulse: {
        sfx: 'zone_judgment',
        layers: [
            { type: 'flash', at: 0, dur: 0.18, r: 60, color: '255, 120, 140' },
            { type: 'ring', at: 0, dur: 0.6, r: 420, color: CRIMSON, width: 10 },
            { type: 'ring', at: 0.1, dur: 0.6, r: 300, color: '255, 90, 110', width: 4 },
            { type: 'glow', at: 0, dur: 0.9, r: 90, color: CRIMSON },
            { type: 'motes', at: 0.05, count: 10, spread: 70, rise: [30, 80], life: [0.6, 1.0], size: 2.5, color: CRIMSON }
        ]
    },
    // ======== 새 기획 구역 5 · 해상 요새 포세이돈: 심해 흑청색·부식된 황동·탁한 주황 ========
    // 심해 압축포: 푸른 조준선 → 굵은 물기둥 + 물보라
    waterWarn: {
        layers: [
            { type: 'beam', at: 0, dur: 1.1, w: 2, color: '120, 210, 255' },
            { type: 'glow', at: 0, dur: 1.1, r: 30, color: '120, 210, 255', layer: 'front' },
            { type: 'ring', at: 0.7, dur: 0.4, r: 36, inward: true, width: 2, color: '120, 210, 255', pos: 'to' }
        ]
    },
    waterBeam: {
        sfx: 'mech_laser',
        layers: [
            { type: 'beam', at: 0, dur: 0.55, w: 40, color: '90, 170, 230' },
            { type: 'beam', at: 0, dur: 0.4, w: 12, color: WHITE },
            { type: 'flash', at: 0, dur: 0.2, r: 50, color: WHITE, pos: 'to' },
            { type: 'shockwave', at: 0.03, dur: 0.45, r: 80, width: 18, color: '120, 210, 255', pos: 'to' },
            { type: 'goo', at: 0.03, count: 8, speed: 220, size: 6, life: [0.5, 0.9], splat: true, floor: 60, color: '150, 210, 240', pos: 'to' }
        ]
    },
    // 맹독 간헐천: 주황·독녹 물기둥이 솟구침
    geyserBurst: {
        sfx: 'zone_venom',
        layers: [
            { type: 'pillar', at: 0, dur: 0.7, h: 220, w: 40, color: '255, 140, 50' },
            { type: 'pillar', at: 0.03, dur: 0.5, h: 200, w: 14, color: '200, 230, 60' },
            { type: 'goo', at: 0.02, count: 8, speed: 210, size: 6.5, life: [0.6, 1.0], splat: true, floor: 0, color: FIRE },
            { type: 'mist', at: 0.1, r: 60, h: 12, life: 1.2, drift: 14, color: '120, 140, 40', dy: 30 },
            { type: 'glow', at: 0, dur: 1.0, r: 60, color: FIRE }
        ]
    },
    // ======== 새 기획 구역 3 · 피로 물든 순례길 ========
    // 그리폰 기수 성수: 바랜 금빛 물보라 + 가라앉는 약화 표식
    holyWaterSplash: {
        sfx: 'zone_heal_holy',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 26, color: HOLY_WHITE },
            { type: 'goo', at: 0, count: 7, speed: 150, size: 6, life: [0.6, 1.0], splat: true, floor: 80, color: HOLY_GOLD },
            { type: 'ring', at: 0.02, dur: 0.5, r: 56, width: 3, color: HOLY_GOLD },
            { type: 'chevrons', at: 0.08, count: 3, spread: 14, fall: 26, life: [0.7, 1.0], size: 7, color: CRIMSON, dy: -40 }
        ]
    },
    // ======== 새 기획 구역 2 · 해안 시추 단지: 용암 적색·시멘트 회색·녹슨 적갈색 ========
    // 음파 차단 탑 고주파: 노란 음파 고리 여러 겹
    sonicRing: {
        sfx: 'shield_break',
        layers: [
            { type: 'ring', at: 0, dur: 0.45, r: 50, color: '255, 220, 120', width: 4 },
            { type: 'ring', at: 0.1, dur: 0.5, r: 75, color: '255, 200, 90', width: 3 },
            { type: 'ring', at: 0.2, dur: 0.55, r: 100, color: '255, 180, 70', width: 2 },
            { type: 'glow', at: 0, dur: 0.6, r: 46, color: '255, 220, 120' }
        ]
    },
    // 파일벙커 대지 분쇄: 예고(땅의 금빛 균열) → 솟구치는 암반·용암
    quakeWarn: {
        layers: [
            { type: 'cracks', at: 0, dur: 1.3, count: 4, len: 50, color: '255, 160, 60' },
            { type: 'glow', at: 0, dur: 1.3, r: 46, color: '255, 120, 40' },
            { type: 'mist', at: 0, r: 46, h: 8, life: 1.3, drift: 0, rim: true, color: '255, 120, 40' }
        ]
    },
    quakeSpike: {
        sfx: 'chimera_slam',
        layers: [
            { type: 'pillar', at: 0, dur: 0.45, h: 150, w: 36, color: '255, 110, 40' },
            { type: 'shards', at: 0, count: 6, speed: 260, size: 7, spin: 7, life: [0.6, 1.0], shape: 'rock', floor: 0, color: STONE },
            { type: 'flash', at: 0, dur: 0.12, r: 36, color: EMBER },
            { type: 'shockwave', at: 0.02, dur: 0.4, r: 70, ground: true, width: 14, color: FIRE },
            { type: 'smoke', at: 0.08, count: 3, spread: 30, spreadY: 8, size: 18, life: [0.5, 0.8], rise: 25, color: STONE }
        ]
    },
    // 폐기물 컨테이너 투하: 떨어지는 그림자 경고 → 쿵 (먼지·쇳물)
    containerWarn: {
        layers: [
            { type: 'glow', at: 0, dur: 2.0, r: 60, color: '20, 18, 24' },
            { type: 'ring', at: 0, dur: 2.0, r: 70, ground: true, inward: true, width: 3, color: '255, 190, 60' },
            { type: 'mist', at: 0, r: 70, h: 10, life: 2.0, drift: 0, rim: true, color: '255, 170, 50' }
        ]
    },
    containerSlam: {
        sfx: 'chimera_slam',
        layers: [
            { type: 'flash', at: 0, dur: 0.14, r: 50, color: EMBER },
            { type: 'shockwave', at: 0, dur: 0.5, r: 120, ground: true, width: 22, color: '255, 170, 60' },
            { type: 'smoke', at: 0.03, count: 6, spread: 70, spreadY: 10, size: 26, life: [0.6, 1.1], rise: 30, color: STONE },
            { type: 'goo', at: 0.02, count: 6, speed: 170, size: 6, life: [0.6, 1.0], splat: true, floor: 0, color: FIRE },
            { type: 'cracks', at: 0.02, dur: 1.0, count: 5, len: 80, color: EMBER }
        ]
    },
    // 궤도 폭격: 하늘에서 내리꽂히는 붉은·흰 빛기둥 + 폭발
    orbitalStrike: {
        sfx: 'base_blast',
        layers: [
            { type: 'pillar', at: 0, dur: 0.6, h: 640, w: 54, color: '255, 70, 60' },
            { type: 'pillar', at: 0.02, dur: 0.4, h: 640, w: 14, color: WHITE },
            { type: 'flash', at: 0.04, dur: 0.22, r: 80, color: WHITE },
            { type: 'shockwave', at: 0.05, dur: 0.5, r: 130, ground: true, color: '255, 90, 60', width: 28 },
            { type: 'cracks', at: 0.05, dur: 1.1, count: 6, len: 90, color: EMBER },
            { type: 'glow', at: 0.05, dur: 1.0, r: 80, color: FIRE },
            { type: 'smoke', at: 0.15, count: 5, spread: 55, spreadY: 10, size: 22, life: [0.6, 1.0], rise: 30, color: STONE }
        ]
    }
};
