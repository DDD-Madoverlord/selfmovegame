/* ==========================================================================
   PROJECT: MAD OVERLORD // 타락 히어로(부서진 신념) 리그 데이터 (v2)
   파츠: tools/rig/cut_hero_parts.py 가 Gemini 이미지에서 분리.
   좌표 단위: 원본 이미지 픽셀. rot은 도(°), 화면 기준 +는 시계 방향.

   사람형 측면(오른쪽을 봄) → 허벅지/정강이 2마디 다리가 몸통(골반)에 매달린 실제 보행.
   기본 자세(중립 이미지)는 두 다리가 곧게 모여 수직 → 다리 각도 키 = 수직 기준 각도.
   허벅지 rot -는 발이 앞으로, 정강이 rot +는 무릎이 굽음(발이 뒤로).
   앞팔은 어깨에서 오른쪽 아래를 향하므로 rot -는 팔을 들어 올림. 칼은 손목에서 회전.
   자동 접지(autoGround)가 매 프레임 가장 낮은 발을 지면에 맞춰, 걸음마다 몸이 오르내리는 높이를 만든다.
   ========================================================================== */

export const HERO_ASSET_DIR = 'assets/sprites/rig/hero/';

export const HERO_BONES = [
    { name: 'root', parent: null },
    { name: 'torso', parent: 'root', part: 'torso', z: 6 },
    { name: 'cape1', parent: 'torso', part: 'cape1', z: 1 },
    { name: 'cape2', parent: 'cape1', part: 'cape2', z: 0 },
    // 망토 안감 (D-121 보완): 몸통에 고정, 망토 뒤. 망토가 흔들려 벌어질 때 로브와 망토 사이가 비지 않게 — 그림은 긴 로브 세트(capeIn_b·_v)만
    //   (기본·다른 세트는 그림이 없어 그리지 않음, tools/rig/robe_cape.py)
    { name: 'capeIn', parent: 'torso', part: 'capeIn', z: -1 },
    { name: 'thighB', parent: 'torso', part: 'thighB', z: 3 },
    { name: 'shinB', parent: 'thighB', part: 'shinB', z: 2 },
    { name: 'thighF', parent: 'torso', part: 'thighF', z: 5 },
    { name: 'shinF', parent: 'thighF', part: 'shinF', z: 4 },
    { name: 'head', parent: 'torso', part: 'head', z: 7 },
    { name: 'armF', parent: 'torso', part: 'armF', z: 9 },
    { name: 'sword', parent: 'armF', part: 'sword', z: 8 },
    // 견갑: 팔 위에 덮어 어깨 이음새를 가림 (몸통에 고정)
    { name: 'pauldron', parent: 'torso', part: 'pauldron', z: 10 }
];

// 망토: 몸이 앞으로 가속하면 뒤로 날리고(시계 방향, +), 끝자락이 더 크게 흔들림
export const HERO_SPRINGS = [
    { bone: 'cape1', channel: 'rot', axis: 0, gain: -0.10, k: 60, damping: 5, limit: 12 },
    { bone: 'cape2', channel: 'rot', axis: 0, gain: -0.16, k: 50, damping: 4, limit: 18 },
    { bone: 'head', channel: 'y', axis: 1, gain: 0.25, k: 260, damping: 12, limit: 4 }
];

export const HERO_DEBUG_SOCKETS = [
    ['tip', 'sword'],
    ['chest', 'torso'],
    ['footF', 'shinF'],
    ['footB', 'shinB']
];

const SLASH_COLOR = '200, 110, 255';
// 평상시(대기/걷기) 칼 드는 자세
//  - 팔: 이미지 속 팔은 수직에서 33° 앞으로 뻗어 있음 → 팔 rot 33 = 수직(옆구리)
//  - 칼: 화면 기준 칼 방향 = 22.6(칼 이미지 기본 기울기) + 팔 + 손목.
//        팔이 흔들려도 칼끝이 정면(수평 위 CARRY_ANGLE°)을 유지하도록 손목을 팔 반대로 돌림
//        (수평 0, 15° 위 15, 35° 위 35)
const ARM_VERTICAL = 33;
const CARRY_ARM = 30;            // 대기: 거의 수직으로 내림
const WALK_ARM_SWING = 20;       // 걷기: 수직 기준 앞뒤 20°씩
const CARRY_ANGLE = 15;
const carrySword = arm => -CARRY_ANGLE - 22.6 - arm;
const CARRY_SWORD = carrySword(CARRY_ARM);
const AURA_COLOR = '190, 90, 255';

export const HERO_CLIPS = {
    // 다리가 몸통에 매달려 있어 몸통을 움직이면 발이 미끄러지므로, 대기는 상체/망토만 움직임
    idle: {
        duration: 2.4,
        loop: true,
        tracks: {
            head: { rot: [[0, 0], [1.2, 1.5], [2.4, 0]] },
            armF: { rot: [[0, CARRY_ARM], [1.2, CARRY_ARM + 2], [2.4, CARRY_ARM]] },
            sword: { rot: [[0, CARRY_SWORD], [1.2, CARRY_SWORD - 2], [2.4, CARRY_SWORD]] },
            cape1: { rot: [[0, 2], [1.2, 5], [2.4, 2]] },
            cape2: { rot: [[0, 3], [1.2, 8], [2.4, 3]] }
        }
    },

    // 한 사이클 = 앞발 딛기(0) + 뒷발 딛기(0.45). 두 다리가 수직 기준 앞 24° ~ 뒤 20°로 번갈아 교차하고,
    // 딛는 다리는 거의 펴고 휘두르는 다리는 무릎을 52° 굽혀 발을 들어 올림.
    // 몸이 오르내리는 높이는 자동 접지(HERO.autoGround)가 다리 각도로부터 계산.
    walk: {
        duration: 0.9,
        loop: true,
        tracks: {
            thighF: { rot: [[0, -24], [0.45, 20], [0.9, -24]] },
            shinF: { rot: [[0, 2], [0.2, 6], [0.45, 8], [0.62, 52], [0.8, 12], [0.9, 2]] },
            thighB: { rot: [[0, 20], [0.45, -24], [0.9, 20]] },
            shinB: { rot: [[0, 8], [0.17, 52], [0.35, 12], [0.45, 2], [0.65, 6], [0.9, 8]] },
            torso: { rot: [[0, 1], [0.225, 0], [0.45, 1], [0.675, 0], [0.9, 1]] },
            head: { rot: [[0, -1], [0.225, 0], [0.45, -1], [0.675, 0], [0.9, -1]] },
            // 앞다리가 앞일 때 팔은 뒤로(+): 칼 든 팔을 옆구리에서 흔들고, 칼은 한 박자 늦게 따라감
            // 팔은 다리와 반대로: 앞다리가 앞(0)일 때 팔은 뒤(+), 뒷다리가 앞(0.45)일 때 팔은 앞(-).
            // 칼은 팔 흔들림을 손목으로 되돌려 칼끝이 정면을 유지 (±3°만 따라 흔들림)
            armF: { rot: [[0, ARM_VERTICAL + WALK_ARM_SWING], [0.45, ARM_VERTICAL - WALK_ARM_SWING],
                          [0.9, ARM_VERTICAL + WALK_ARM_SWING]] },
            sword: { rot: [[0, carrySword(ARM_VERTICAL + WALK_ARM_SWING) + 3],
                           [0.45, carrySword(ARM_VERTICAL - WALK_ARM_SWING) - 3],
                           [0.9, carrySword(ARM_VERTICAL + WALK_ARM_SWING) + 3]] },
            cape1: { rot: [[0, 6], [0.45, 9], [0.9, 6]] },
            cape2: { rot: [[0, 8], [0.225, 13], [0.45, 8], [0.675, 13], [0.9, 8]] }
        },
        events: [
            [0, 'step', { foot: 'footF', bone: 'shinF' }],
            [0.45, 'step', { foot: 'footB', bone: 'shinB' }]
        ]
    },

    // 조준 사격 (연발 석궁 기본 공격, D-119): 0~0.18 석궁을 앞으로 겨눔 → 0.32 쏨(반동) → 다시 겨눔 반복
    attack_shoot: {
        duration: 0.8,
        loop: true,
        tracks: {
            armF: { rot: [[0, 0], [0.18, -24, 'out'], [0.3, -24], [0.34, -17, 'out'], [0.5, -24], [0.8, 0]] },
            sword: { rot: [[0, 0], [0.18, -6, 'out'], [0.3, -6], [0.34, -1, 'out'], [0.5, -6], [0.8, 0]] },
            torso: { x: [[0, 0], [0.18, 4, 'out'], [0.3, 4], [0.34, -5, 'out'], [0.5, 2], [0.8, 0]], rot: [[0, 0], [0.34, -1.5], [0.8, 0]] },
            head: { rot: [[0, 0], [0.18, 2], [0.8, 0]] },
            cape1: { rot: [[0, 0], [0.34, 5, 'out'], [0.8, 0]] }
        },
        events: [[0.32, 'shoot', { hit: 1 }]]
    },

    // 내려베기: 0~0.28 칼을 머리 위로 → 0.28~0.4 앞발을 내딛으며 내려침(타격) → 복귀
    // 팔 한 장을 100° 넘게 돌리면 건틀릿이 뒤집혀 얼굴을 덮으므로, 팔은 100°까지만 올리고 나머지는 손목(칼)으로
    attack_slash: {
        duration: 0.9,
        loop: true,
        tracks: {
            armF: { rot: [[0, 0], [0.28, -100, 'in'], [0.4, 15, 'out'], [0.55, 10], [0.9, 0]] },
            sword: { rot: [[0, 0], [0.28, -55, 'in'], [0.4, 20, 'out'], [0.55, 10], [0.9, 0]] },
            torso: {
                x: [[0, 0], [0.28, -10, 'in'], [0.4, 22, 'out'], [0.6, 18], [0.9, 0]],
                rot: [[0, 0], [0.28, -5, 'in'], [0.4, 6, 'out'], [0.6, 4], [0.9, 0]]
            },
            thighF: { rot: [[0, 0], [0.28, -6], [0.4, -18, 'out'], [0.6, -15], [0.9, 0]] },
            shinF: { rot: [[0, 0], [0.4, 12], [0.9, 0]] },
            thighB: { rot: [[0, 0], [0.4, 14], [0.9, 0]] },
            head: { rot: [[0, 0], [0.28, -4], [0.4, 5], [0.9, 0]] },
            cape1: { rot: [[0, 0], [0.4, 10], [0.9, 0]] }
        },
        events: [
            [0.3, 'trailStart', { socket: 'tip', bone: 'sword', color: SLASH_COLOR }],
            [0.37, 'impact', { hit: 1, color: SLASH_COLOR }],
            [0.46, 'trailEnd']
        ]
    },

    // 스킬 시전 (컨셉 '스킬 시전'): 칼 든 팔을 앞으로 뻗고 칼을 치켜들어 손끝에 보라 에너지를 모았다가 해방
    // 'cast' 이벤트 = 해방 순간 (게임: 세뇌 파동 구체 발사). 한 번 재생 후 현재 동작으로 복귀
    cast: {
        duration: 0.8,
        loop: false,
        tracks: {
            armF: { rot: [[0, CARRY_ARM], [0.22, -62, 'out'], [0.5, -62], [0.8, CARRY_ARM]] },
            sword: { rot: [[0, CARRY_SWORD], [0.22, -52, 'out'], [0.5, -52], [0.8, CARRY_SWORD]] },
            torso: { rot: [[0, 0], [0.22, -3], [0.36, 2, 'out'], [0.5, -2], [0.8, 0]] },
            head: { rot: [[0, 0], [0.22, -5], [0.5, -5], [0.8, 0]] },
            cape1: { rot: [[0, 4], [0.36, 16, 'out'], [0.8, 4]] },
            cape2: { rot: [[0, 6], [0.36, 22, 'out'], [0.8, 6]] }
        },
        events: [
            [0.06, 'charge', { socket: 'hand', bone: 'armF', color: AURA_COLOR }],
            [0.36, 'chargeEnd'],
            [0.36, 'impact', { socket: 'hand', bone: 'armF', color: AURA_COLOR }],
            [0.36, 'cast']
        ]
    },

    // ---- 2차 세트 전용 동작 (D-071, MD/파츠확장_2차_기획안.md 5-3). 팔은 -100°까지만 (더 돌리면 건틀릿이 얼굴을 덮음) ----
    // 검 치켜들기 (일식·기사단 돌격·그림자 군단·마왕 강림): 무기를 하늘로 들어 올려(0.3) 힘을 모았다가(0.4 해방) 내림
    raise: {
        duration: 1.2,
        loop: false,
        tracks: {
            armF: { rot: [[0, CARRY_ARM], [0.3, -100, 'out'], [0.4, -97], [0.9, -100], [1.2, CARRY_ARM]] },
            sword: { rot: [[0, CARRY_SWORD], [0.3, -14, 'out'], [0.9, -10], [1.2, CARRY_SWORD]] },
            torso: { rot: [[0, 0], [0.3, -3], [0.4, -1, 'out'], [0.9, -3], [1.2, 0]] },
            head: { rot: [[0, 0], [0.3, -7], [0.9, -7], [1.2, 0]] },
            thighF: { rot: [[0, 0], [0.3, -10], [0.9, -10], [1.2, 0]] },
            thighB: { rot: [[0, 0], [0.3, 10], [0.9, 10], [1.2, 0]] },
            cape1: { rot: [[0, 4], [0.4, 14, 'out'], [0.9, 10], [1.2, 4]] },
            cape2: { rot: [[0, 6], [0.4, 20, 'out'], [0.9, 14], [1.2, 6]] }
        },
        events: [[0.08, 'charge', { socket: 'tip', bone: 'sword', color: AURA_COLOR }], [0.4, 'chargeEnd'], [0.4, 'roar', { socket: 'tip', bone: 'sword', color: AURA_COLOR }]]
    },

    // 찌르기 (찌르기 돌파): 무기를 뒤로 당겼다(0.15) 앞발을 내딛으며 수평으로 내지름(0.25 — 스킬 타격 0.15~0.4)
    // 팔 -57° = 수평 앞, 손목 34° = 칼이 수평 (칼 방향 = 22.6 + 팔 + 손목)
    thrust: {
        duration: 0.7,
        loop: false,
        tracks: {
            armF: { rot: [[0, CARRY_ARM], [0.15, 45, 'in'], [0.25, -57, 'out'], [0.45, -55], [0.7, CARRY_ARM]] },
            sword: { rot: [[0, CARRY_SWORD], [0.15, carrySword(45)], [0.25, 34, 'out'], [0.45, 33], [0.7, CARRY_SWORD]] },
            torso: { x: [[0, 0], [0.15, -12, 'in'], [0.25, 26, 'out'], [0.45, 20], [0.7, 0]], rot: [[0, 0], [0.15, -3], [0.25, 5, 'out'], [0.7, 0]] },
            thighF: { rot: [[0, 0], [0.25, -22, 'out'], [0.45, -18], [0.7, 0]] },
            shinF: { rot: [[0, 0], [0.25, 10], [0.7, 0]] },
            thighB: { rot: [[0, 0], [0.25, 16], [0.7, 0]] },
            head: { rot: [[0, 0], [0.25, 3], [0.7, 0]] },
            cape1: { rot: [[0, 4], [0.25, 16, 'out'], [0.7, 4]] },
            cape2: { rot: [[0, 6], [0.25, 22, 'out'], [0.7, 6]] }
        },
        events: [[0.2, 'trailStart', { socket: 'tip', bone: 'sword', color: SLASH_COLOR }], [0.25, 'impact', { hit: 1, color: SLASH_COLOR }], [0.4, 'trailEnd']]
    },

    // 크게 휩쓸기 (낫 휘두르기·마검 연무): 무기를 뒤로 크게 젖혔다(0.25) 앞으로 반원을 그리며 휩씀(0.42)
    sweep: {
        duration: 0.9,
        loop: false,
        tracks: {
            armF: { rot: [[0, CARRY_ARM], [0.25, 70, 'in'], [0.42, -80, 'out'], [0.6, -70], [0.9, CARRY_ARM]] },
            sword: { rot: [[0, CARRY_SWORD], [0.25, 20, 'in'], [0.42, -20, 'out'], [0.6, -15], [0.9, CARRY_SWORD]] },
            torso: { x: [[0, 0], [0.25, -8, 'in'], [0.42, 16, 'out'], [0.6, 12], [0.9, 0]], rot: [[0, 0], [0.25, -6, 'in'], [0.42, 8, 'out'], [0.6, 6], [0.9, 0]] },
            thighF: { rot: [[0, 0], [0.42, -16], [0.9, 0]] },
            thighB: { rot: [[0, 0], [0.42, 12], [0.9, 0]] },
            head: { rot: [[0, 0], [0.25, -4], [0.42, 4], [0.9, 0]] },
            cape1: { rot: [[0, 4], [0.25, -4], [0.42, 18, 'out'], [0.9, 4]] },
            cape2: { rot: [[0, 6], [0.25, -2], [0.42, 26, 'out'], [0.9, 6]] }
        },
        events: [[0.28, 'trailStart', { socket: 'tip', bone: 'sword', color: SLASH_COLOR }], [0.4, 'impact', { hit: 1, color: SLASH_COLOR }], [0.55, 'trailEnd']]
    },

    // 승리: 넓게 버티고 서서 칼을 하늘로 치켜들고 보라 파동 (팔 -105° + 손목 -11° → 칼이 수직)
    victory: {
        duration: 1.2,
        loop: true,
        tracks: {
            armF: { rot: [[0, -105], [0.6, -110], [1.2, -105]] },
            sword: { rot: [[0, -11], [0.6, -8], [1.2, -11]] },
            torso: { rot: [[0, -2], [0.6, -3], [1.2, -2]] },
            thighF: { rot: [[0, -12]] },
            thighB: { rot: [[0, 12]] },
            shinF: { rot: [[0, 6]] },
            shinB: { rot: [[0, 6]] },
            head: { rot: [[0, -6], [0.6, -8], [1.2, -6]] },
            cape1: { rot: [[0, 10], [0.6, 14], [1.2, 10]] },
            cape2: { rot: [[0, 12], [0.3, 18], [0.6, 12], [0.9, 18], [1.2, 12]] }
        },
        events: [[0.1, 'roar', { socket: 'tip', bone: 'sword', color: AURA_COLOR }]]
    }
};

export const HERO = {
    id: 'hero',
    name: '타락 히어로',
    assetDir: HERO_ASSET_DIR,
    bones: HERO_BONES,
    springs: HERO_SPRINGS,
    clips: HERO_CLIPS,
    arms: null,
    attack: 'attack_slash',
    hitSocket: ['tip', 'sword'],
    // tip_c: 연발 석궁(세트 c) 앞 활대 가운데 = 볼트가 나가는 곳 (D-119)
    sockets: { hand: [660, 666], tip_c: [948, 772] },       // hand: 칼 쥔 주먹 (스킬 시전 에너지/세뇌 구체 발사 위치)
    variantSockets: { sword: ['tip'] },   // 무기 세트 그림을 끼우면 tip → tip_<글자> (있을 때만)
    autoGround: [['footF', 'shinF'], ['footB', 'shinB']],   // 다리가 몸통에 매달려 있어 발로 접지
    skillClips: [['시전', 'cast'], ['검 치켜들기', 'raise'], ['찌르기', 'thrust'], ['크게 휩쓸기', 'sweep']],   // rig_test.html 동작 버튼 (뒤 셋은 2차 세트, D-071)
    wind: [{ bone: 'cape1', rot: 4 }, { bone: 'cape2', rot: 7 }],   // 빨리 걸을수록 망토가 뒤로 (Q-008 Q6, reactions.js WIND)
    // 컨셉의 보라 오라: 몸 뒤에서 연기가 피어올라 흩어지고, 앞쪽으로 불티가 떠오름
    ambient: [
        { kind: 'smoke', socket: 'chest', bone: 'torso', layer: 'back', rate: 20,
          offset: [-30, 40], spread: [240, 360], size: [34, 52], life: [1.3, 2.0],
          vel: [[-14, 10], [-50, -24]], color: '115, 40, 195', glow: '195, 105, 255' },
        { kind: 'ember', socket: 'chest', bone: 'torso', layer: 'front', rate: 5,
          offset: [0, 60], spread: [180, 300], size: [2, 3.5], life: [0.8, 1.4],
          vel: [[-10, 10], [-75, -40]], color: '205, 130, 255' }
    ],
    debugSockets: HERO_DEBUG_SOCKETS,
    shadow: { rx: 200, ry: 28 }
};
