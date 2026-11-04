/* ==========================================================================
   PROJECT: MAD OVERLORD // 적 리그 데이터 (v2) — 경비병·방패병·마취총 사수·전기 충격병·의무병·보스
   파츠: tools/rig/cut_enemy_parts.py 가 Gemini 이미지(전신 + 팔 없는 몸)에서 분리 (원본 1024px 좌표).
   rot은 도(°), 화면 기준 +는 시계 방향. 모두 왼쪽을 보는 3/4 측면.

   전투에서는 리그를 직접 그리지 않고, 걷기·공격을 스프라이트로 구워 쓴다 (tools/rig/bake_sprite.py, D-017·D-035).
   다리 뼈는 엉덩이에서 아래를 향하므로 rot +는 발이 앞(왼쪽)으로, -는 뒤로.
   팔도 어깨에서 아래를 향하므로 rot +는 손이 앞으로 올라감 (+140이면 머리 위 뒤쪽).
   ========================================================================== */

const dir = id => `assets/sprites/rig/${id}/`;

/** 뼈대: 망토(있으면) → 다리 → 몸통 → 뒷팔 → 머리 → 앞팔(또는 두 팔 한 조각) 순으로 앞에 그림
 *  arms 'none' = 팔·머리 없는 한 덩어리(슬라임), legs false = 다리 없이 떠 있음(가마에 탄 대주교) */
function bones({ arms = 'two', cape = false, tail = false, legs = true } = {}) {
    const list = [{ name: 'root', parent: null }];
    if (legs) list.push({ name: 'legB', parent: 'root', part: 'legB', z: 1 }, { name: 'legF', parent: 'root', part: 'legF', z: 2 });
    list.push({ name: 'body', parent: 'root', part: 'torso', z: 3 });
    if (arms === 'none') return list;
    if (cape) list.push({ name: 'cape', parent: 'body', part: 'cape', z: 0 });
    if (tail) list.push({ name: 'tail', parent: 'body', part: 'tail', z: 0 });   // 꼬리 뿌리는 뒷다리 뒤에 숨음
    if (arms === 'two') list.push({ name: 'armB', parent: 'body', part: 'armB', z: 4 });
    list.push({ name: 'head', parent: 'body', part: 'head', z: 5 });
    list.push(arms === 'two' ? { name: 'armF', parent: 'body', part: 'armF', z: 6 } : { name: 'arms', parent: 'body', part: 'arms', z: 6 });
    return list;
}

/**
 * 걷기: 한 사이클 = 뒷다리 내딛기(앞 절반) + 앞다리 내딛기(뒤 절반). 내딛는 다리는 들어 올렸다 내림
 * opt: { dur, leg(흔드는 각), lift, bob, armF, armB, arms, cape } — 팔 값은 흔드는 각(0이면 고정)
 */
function walk(o) {
    const d = o.dur, h = d / 2, q = d / 4;
    const swing = a => ({ rot: [[0, -a], [h, a], [d, -a]] });
    const tracks = {
        legF: { rot: [[0, 6], [h, -o.leg], [d, 6]], y: [[0, 0], [h, 0, 'out'], [h + q, -o.lift, 'in'], [d, 0]] },
        legB: { rot: [[0, -6], [h, o.leg], [d, -6]], y: [[0, 0, 'out'], [q, -o.lift, 'in'], [h, 0], [d, 0]] },
        body: {
            y: [[0, o.bob * 0.6, 'out'], [q, -o.bob, 'in'], [h, o.bob * 0.6, 'out'], [h + q, -o.bob, 'in'], [d, o.bob * 0.6]],
            rot: [[0, -1.5], [h, 1.5], [d, -1.5]]
        },
        head: { rot: [[0, 2], [q, -1.5], [h, 2], [h + q, -1.5], [d, 2]] }
    };
    if (o.armF != null) tracks.armF = swing(o.armF);
    if (o.armB != null) tracks.armB = { rot: [[0, o.armB], [h, -o.armB], [d, o.armB]] };
    if (o.arms != null) tracks.arms = { rot: [[0, -o.arms], [h, o.arms], [d, -o.arms]], y: [[0, 0], [q, 6], [h, 0], [h + q, 6], [d, 0]] };
    if (o.cape) tracks.cape = { rot: [[0, o.cape], [h, -o.cape], [d, o.cape]] };
    if (o.tail) tracks.tail = { rot: [[0, o.tail], [q, -o.tail], [h, o.tail], [h + q, -o.tail], [d, o.tail]] };   // 걸음마다 좌우로 살랑
    return {
        duration: d, loop: true, tracks,
        events: [[0, 'step', { foot: 'footF', bone: 'legF' }], [h, 'step', { foot: 'footB', bone: 'legB' }]]
    };
}

const idle = (arm = 'armF') => ({
    duration: 1.6, loop: true,
    tracks: { body: { y: [[0, 0], [0.8, 6], [1.6, 0]] }, head: { rot: [[0, 0], [0.8, -1.5], [1.6, 0]] },
        [arm]: { rot: [[0, 0], [0.8, 3], [1.6, 0]] } }
});

const impact = (t, color) => [[t, 'impact', { socket: 'tip', bone: 'armF', color }]];

// 진압봉 내려치기: 0~0.3 몸을 젖히며 진압봉을 머리 위로 → 0.4 앞으로 내딛으며 내려침 → 복귀
const BATON_SWING = {
    duration: 0.8, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, 140, 'in'], [0.4, -18, 'out'], [0.55, -12], [0.8, 0]] },
        armB: { rot: [[0, 0], [0.3, -18], [0.4, 22, 'out'], [0.8, 0]] },
        body: { x: [[0, 0], [0.3, 14, 'in'], [0.4, -30, 'out'], [0.6, -22], [0.8, 0]],
                rot: [[0, 0], [0.3, 6, 'in'], [0.4, -8, 'out'], [0.6, -5], [0.8, 0]], y: [[0, 0], [0.3, -6], [0.4, 8], [0.8, 0]] },
        head: { rot: [[0, 0], [0.3, 4], [0.4, -5], [0.8, 0]] },
        legF: { rot: [[0, 0], [0.4, 10, 'out'], [0.8, 0]] },
        legB: { rot: [[0, 0], [0.4, -8, 'out'], [0.8, 0]] }
    },
    events: impact(0.4, '255, 220, 120')
};

// 방패 밀치기: 0~0.35 방패를 당기며 웅크림 → 0.45 몸을 실어 방패로 들이받음 → 복귀 (뒷손 곤봉은 살짝 치켜듦)
const SHIELD_BASH = {
    duration: 0.9, loop: true,
    tracks: {
        armF: { x: [[0, 0], [0.35, 16, 'in'], [0.45, -44, 'out'], [0.65, -34], [0.9, 0]], rot: [[0, 0], [0.35, -3], [0.45, 4], [0.9, 0]] },
        armB: { rot: [[0, 0], [0.35, -20], [0.45, 10, 'out'], [0.9, 0]] },
        body: { x: [[0, 0], [0.35, 12, 'in'], [0.45, -26, 'out'], [0.65, -20], [0.9, 0]],
                rot: [[0, 0], [0.35, 4], [0.45, -6, 'out'], [0.9, 0]], y: [[0, 0], [0.35, 8], [0.45, 0], [0.9, 0]] },
        legF: { rot: [[0, 0], [0.45, 10, 'out'], [0.9, 0]] },
        legB: { rot: [[0, 0], [0.45, -8, 'out'], [0.9, 0]] }
    },
    events: impact(0.45, '120, 200, 255')
};

// 마취총 발사(한 번): 반동으로 총이 뒤로 밀리며 총구가 들림 → 천천히 다시 겨눔
const RIFLE_SHOT = {
    duration: 0.6, loop: true,
    tracks: {
        arms: { x: [[0, 0], [0.06, 22, 'out'], [0.3, 6], [0.6, 0]], rot: [[0, 0], [0.06, 7, 'out'], [0.3, 2], [0.6, 0]] },
        body: { x: [[0, 0], [0.06, 8, 'out'], [0.6, 0]], rot: [[0, 0], [0.06, 2], [0.6, 0]] },
        head: { rot: [[0, 0], [0.06, 2], [0.6, 0]] }
    },
    events: [[0, 'impact', { socket: 'tip', bone: 'arms', color: '90, 230, 255' }]]
};

// 전기 창 찌르기: 0~0.3 창을 뒤로 당김 → 0.4 앞으로 깊게 찌름 → 복귀
const SPEAR_THRUST = {
    duration: 0.8, loop: true,
    tracks: {
        armF: { x: [[0, 0], [0.3, 22, 'in'], [0.4, -40, 'out'], [0.6, -30], [0.8, 0]], rot: [[0, 0], [0.3, -8], [0.4, 4, 'out'], [0.8, 0]] },
        armB: { rot: [[0, 0], [0.3, -12], [0.4, 14, 'out'], [0.8, 0]] },
        body: { x: [[0, 0], [0.3, 12, 'in'], [0.4, -22, 'out'], [0.6, -16], [0.8, 0]], rot: [[0, 0], [0.3, 4], [0.4, -6], [0.8, 0]] },
        legF: { rot: [[0, 0], [0.4, 10, 'out'], [0.8, 0]] },
        legB: { rot: [[0, 0], [0.4, -8, 'out'], [0.8, 0]] }
    },
    events: impact(0.4, '255, 240, 90')
};

// 치유 분사(한 번): 분사기를 앞으로 들어 올려 뿌리며 손이 떨림 → 내림
const HEAL_SPRAY = {
    duration: 0.8, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.2, 16, 'out'], [0.3, 13], [0.4, 16], [0.5, 13], [0.6, 16], [0.8, 0]], x: [[0, 0], [0.2, -8], [0.6, -8], [0.8, 0]] },
        body: { rot: [[0, 0], [0.2, -3], [0.6, -3], [0.8, 0]] },
        head: { rot: [[0, 0], [0.2, -3], [0.6, -3], [0.8, 0]] }
    },
    events: impact(0.25, '120, 255, 160')
};

// 보스 장검 베기: 0~0.35 검을 머리 위 뒤로 치켜듦 → 0.45 앞으로 크게 내리벰 → 복귀
const SWORD_SLASH = {
    duration: 0.9, loop: true,
    tracks: {
        armB: { rot: [[0, 0], [0.35, -200, 'in'], [0.45, 30, 'out'], [0.6, 22], [0.9, 0]] },   // -200: 검이 머리 위 뒤쪽
        armF: { x: [[0, 0], [0.35, 10], [0.45, -10], [0.9, 0]] },
        body: { x: [[0, 0], [0.35, 10, 'in'], [0.45, -24, 'out'], [0.65, -16], [0.9, 0]],
                rot: [[0, 0], [0.35, 5, 'in'], [0.45, -7, 'out'], [0.9, 0]] },
        head: { rot: [[0, 0], [0.35, 3], [0.45, -4], [0.9, 0]] },
        cape: { rot: [[0, 0], [0.35, -4], [0.45, 8, 'out'], [0.9, 0]] },
        legF: { rot: [[0, 0], [0.45, 10, 'out'], [0.9, 0]] },
        legB: { rot: [[0, 0], [0.45, -8, 'out'], [0.9, 0]] }
    },
    events: [[0.45, 'impact', { socket: 'tip', bone: 'armF', color: '255, 215, 90' }]]
};

// 보스 방패 강타(한 번, 기절): 방패를 크게 당겼다가 몸을 실어 들이받음
const GUARDIAN_BASH = {
    duration: 0.8, loop: true,
    tracks: {
        armF: { x: [[0, 0], [0.3, 20, 'in'], [0.4, -54, 'out'], [0.6, -40], [0.8, 0]], rot: [[0, 0], [0.3, -4], [0.4, 5], [0.8, 0]] },
        body: { x: [[0, 0], [0.3, 14, 'in'], [0.4, -30, 'out'], [0.6, -22], [0.8, 0]], rot: [[0, 0], [0.3, 4], [0.4, -6, 'out'], [0.8, 0]] },
        cape: { rot: [[0, 0], [0.3, -4], [0.4, 10, 'out'], [0.8, 0]] },
        armB: { rot: [[0, 0], [0.3, -10], [0.4, 8], [0.8, 0]] },
        legF: { rot: [[0, 0], [0.4, 12, 'out'], [0.8, 0]] },
        legB: { rot: [[0, 0], [0.4, -10, 'out'], [0.8, 0]] }
    },
    events: impact(0.4, '120, 200, 255')
};

// ---- 구역 2: 고철 약탈단 (D-040) ----
// 방벽병 망치 내리찍기(바리케이드를 박을 때도 같은 동작): 몸을 크게 젖혀 망치를 머리 위로 → 내리찍음
const HAMMER_SLAM = {
    duration: 1.0, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.4, 150, 'in'], [0.52, -20, 'out'], [0.7, -14], [1.0, 0]] },
        armB: { rot: [[0, 0], [0.4, -20], [0.52, 24, 'out'], [1.0, 0]] },
        body: { x: [[0, 0], [0.4, 12, 'in'], [0.52, -24, 'out'], [0.75, -18], [1.0, 0]],
                rot: [[0, 0], [0.4, 7, 'in'], [0.52, -9, 'out'], [0.75, -6], [1.0, 0]], y: [[0, 0], [0.4, -8], [0.52, 10], [1.0, 0]] },
        head: { rot: [[0, 0], [0.4, 4], [0.52, -5], [1.0, 0]] },
        legF: { rot: [[0, 0], [0.52, 10, 'out'], [1.0, 0]] },
        legB: { rot: [[0, 0], [0.52, -8, 'out'], [1.0, 0]] }
    },
    events: impact(0.52, '255, 210, 120')
};

// 오물 투척(한 번): 국자를 뒤로 당겼다가 머리 위로 휘둘러 던짐
const LADLE_THROW = {
    duration: 0.8, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.25, -40, 'in'], [0.45, 120, 'out'], [0.6, 100], [0.8, 0]] },
        armB: { rot: [[0, 0], [0.25, 15], [0.45, -15], [0.8, 0]] },
        body: { x: [[0, 0], [0.25, 10, 'in'], [0.45, -14, 'out'], [0.8, 0]], rot: [[0, 0], [0.25, 5], [0.45, -6], [0.8, 0]] },
        head: { rot: [[0, 0], [0.25, 3], [0.45, -4], [0.8, 0]] }
    },
    events: impact(0.45, '200, 230, 60')
};

// 고철왕: 걷기는 무거운 보행 기계, 공격 = 뒤쪽 집게 팔 휘둘러 내려치기
const CLAW_SMASH = {
    duration: 1.1, loop: true,
    tracks: {
        armB: { rot: [[0, 0], [0.4, -28, 'in'], [0.55, 70, 'out'], [0.75, 60], [1.1, 0]] },
        armF: { rot: [[0, 0], [0.4, 6], [0.55, -4], [1.1, 0]] },
        body: { x: [[0, 0], [0.4, 14, 'in'], [0.55, -26, 'out'], [0.8, -18], [1.1, 0]], rot: [[0, 0], [0.4, 4], [0.55, -5, 'out'], [1.1, 0]] },
        head: { rot: [[0, 0], [0.4, 3], [0.55, -4], [1.1, 0]] },
        legF: { rot: [[0, 0], [0.55, 8, 'out'], [1.1, 0]] },
        legB: { rot: [[0, 0], [0.55, -6, 'out'], [1.1, 0]] }
    },
    events: [[0.55, 'impact', { socket: 'tip', bone: 'armB', color: '255, 200, 120' }]]
};
// 자석 끌어당기기(한 번): 크레인 팔을 앞으로 낮춰 자석을 겨누고 버팀 (주인공을 뒤로 끌어당김)
const MAGNET_PULL = {
    duration: 1.6, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.35, -16, 'out'], [0.45, -14], [0.55, -16], [0.65, -14], [0.75, -16], [0.85, -14], [1.25, -16], [1.6, 0]] },
        body: { x: [[0, 0], [0.35, 10], [1.25, 10], [1.6, 0]], rot: [[0, 0], [0.35, 3], [1.25, 3], [1.6, 0]] },
        legF: { rot: [[0, 0], [0.35, -6], [1.25, -6], [1.6, 0]] }
    },
    events: [[0.35, 'impact', { socket: 'tip', bone: 'armF', color: '120, 200, 255' }]]
};
// 고철 낙하(한 번): 크레인을 높이 들어 올렸다가 내리찍음 (예고 원 자리에 고철이 떨어짐)
const SCRAP_DROP = {
    duration: 1.2, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.5, 24, 'in'], [0.65, -12, 'out'], [0.85, -8], [1.2, 0]] },
        body: { y: [[0, 0], [0.5, -8], [0.65, 6], [1.2, 0]], rot: [[0, 0], [0.5, -3], [0.65, 2], [1.2, 0]] }
    },
    events: [[0.65, 'impact', { socket: 'tip', bone: 'armF', color: '255, 200, 120' }]]
};

// ---- 새 기획 스테이지 1 · 블랙 하운드 (D-085, GPT 그림 1254px) ----
// 소총 점사(두 손 한 조각): 짧은 반동 세 번
const RIFLE_BURST = {
    duration: 0.7, loop: true,
    tracks: {
        arms: { x: [[0, 0], [0.04, 14, 'out'], [0.14, 2], [0.2, 14, 'out'], [0.3, 2], [0.36, 14, 'out'], [0.46, 2], [0.7, 0]],
                rot: [[0, 0], [0.04, 4], [0.14, 0], [0.2, 4], [0.3, 0], [0.36, 4], [0.46, 0], [0.7, 0]] },
        body: { x: [[0, 0], [0.04, 4], [0.46, 3], [0.7, 0]] },
        head: { rot: [[0, 0], [0.04, 1.5], [0.46, 1], [0.7, 0]] }
    },
    events: [[0, 'impact', { socket: 'tip', bone: 'arms', color: '255, 210, 120' }], [0.16, 'impact', { socket: 'tip', bone: 'arms', color: '255, 210, 120' }],
        [0.32, 'impact', { socket: 'tip', bone: 'arms', color: '255, 210, 120' }]]
};
// 대전차 로켓(어깨 발사기): 겨누고 버티다 큰 반동으로 몸째 뒤로 밀림 → 천천히 다시 겨눔
const ROCKET_SHOT = {
    duration: 1.0, loop: true,
    tracks: {
        arms: { x: [[0, 0], [0.3, -4], [0.36, 34, 'out'], [0.7, 8], [1.0, 0]], rot: [[0, 0], [0.3, -2], [0.36, 10, 'out'], [0.7, 3], [1.0, 0]] },
        body: { x: [[0, 0], [0.3, -3], [0.36, 16, 'out'], [0.8, 2], [1.0, 0]], rot: [[0, 0], [0.36, 4, 'out'], [1.0, 0]] },
        head: { rot: [[0, 0], [0.36, 3], [1.0, 0]] },
        legF: { rot: [[0, 0], [0.36, -6, 'out'], [1.0, 0]] },
        legB: { rot: [[0, 0], [0.36, 6, 'out'], [1.0, 0]] }
    },
    events: [[0.36, 'impact', { socket: 'tip', bone: 'arms', color: '255, 160, 80' }]]
};
// 화염 방사: 노즐을 앞으로 내밀고 떨리며 뿜음
const FLAME_SPRAY = {
    duration: 0.9, loop: true,
    tracks: {
        arms: { x: [[0, 0], [0.15, -10, 'out'], [0.75, -10], [0.9, 0]],
                rot: [[0, 0], [0.15, -3], [0.25, -1], [0.35, -3], [0.45, -1], [0.55, -3], [0.65, -1], [0.75, -3], [0.9, 0]],
                y: [[0, 0], [0.2, 2], [0.3, -1], [0.4, 2], [0.5, -1], [0.6, 2], [0.7, -1], [0.9, 0]] },
        body: { x: [[0, 0], [0.15, -4], [0.75, -4], [0.9, 0]], rot: [[0, 0], [0.15, -2], [0.75, -2], [0.9, 0]] }
    },
    events: [[0.15, 'impact', { socket: 'tip', bone: 'arms', color: '255, 140, 40' }]]
};
// 강화 외골격 주먹: 앞 주먹을 크게 당겼다가 몸을 실어 내지름
const EXO_PUNCH = {
    duration: 1.0, loop: true,
    tracks: {
        armF: { x: [[0, 0], [0.4, 26, 'in'], [0.5, -56, 'out'], [0.7, -44], [1.0, 0]], rot: [[0, 0], [0.4, -12], [0.5, 22, 'out'], [0.7, 18], [1.0, 0]] },
        armB: { rot: [[0, 0], [0.4, 14], [0.5, -10, 'out'], [1.0, 0]] },
        body: { x: [[0, 0], [0.4, 16, 'in'], [0.5, -28, 'out'], [0.75, -20], [1.0, 0]], rot: [[0, 0], [0.4, 5], [0.5, -6, 'out'], [1.0, 0]] },
        head: { rot: [[0, 0], [0.4, 3], [0.5, -4], [1.0, 0]] },
        legF: { rot: [[0, 0], [0.5, 10, 'out'], [1.0, 0]] },
        legB: { rot: [[0, 0], [0.5, -8, 'out'], [1.0, 0]] }
    },
    events: impact(0.5, '255, 90, 70')
};
// 전투 군견(한 조각): 앞뒤로 출렁이며 달림 / 낮게 웅크렸다 앞으로 덮쳐 물기
const HOUND_RUN = {
    duration: 0.42, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.1, -16, 'out'], [0.21, 0, 'in'], [0.31, -16, 'out'], [0.42, 0, 'in']],
                rot: [[0, -4], [0.105, 3], [0.21, -4], [0.315, 3], [0.42, -4]],
                sx: [[0, 1.03], [0.1, 0.97], [0.21, 1.03], [0.31, 0.97], [0.42, 1.03]], sy: [[0, 0.97], [0.1, 1.03], [0.21, 0.97], [0.31, 1.03], [0.42, 0.97]] }
    }
};
const HOUND_BITE = {
    duration: 0.6, loop: true,
    tracks: {
        body: { x: [[0, 0], [0.22, 18, 'in'], [0.3, -40, 'out'], [0.42, -30], [0.6, 0]], y: [[0, 0], [0.22, 6], [0.3, -14, 'out'], [0.42, 0], [0.6, 0]],
                rot: [[0, 0], [0.22, 6], [0.3, -8, 'out'], [0.6, 0]], sy: [[0, 1], [0.22, 0.9, 'in'], [0.3, 1.04], [0.6, 1]] }
    },
    events: [[0.3, 'impact', { socket: 'tip', bone: 'body', color: '255, 80, 60' }]]
};
// EMP 드론(한 조각): 떠서 출렁 / 몸을 살짝 부풀리며 전파를 뿜음 (게임에서 ENEMY_TYPES fly만큼 띄움)
const DRONE_HOVER = {
    duration: 1.2, loop: true,
    tracks: { body: { y: [[0, 0], [0.6, -14], [1.2, 0]], rot: [[0, -3], [0.3, 0], [0.6, 3], [0.9, 0], [1.2, -3]] } }
};
const DRONE_PULSE = {
    duration: 0.8, loop: true,
    tracks: { body: { y: [[0, 0], [0.4, -8], [0.8, 0]], rot: [[0, 0], [0.2, -5, 'out'], [0.8, 0]],
                      sx: [[0, 1], [0.2, 1.06, 'out'], [0.45, 0.99], [0.8, 1]], sy: [[0, 1], [0.2, 1.06, 'out'], [0.45, 0.99], [0.8, 1]] } },
    events: [[0.2, 'impact', { socket: 'tip', bone: 'body', color: '90, 200, 255' }]]
};
// 보스 WMD-알파: 플라스마 포를 앞으로 겨누고 떨며 충전 → 발사 반동 (집게 팔 내려치기는 고철왕 CLAW_SMASH)
const WMD_CHARGE = {
    duration: 1.6, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, 6, 'out'], [0.4, 5], [0.5, 6], [0.6, 5], [0.7, 6], [0.8, 5], [0.9, 6], [1.0, 5], [1.1, 6], [1.15, -6, 'out'], [1.6, 0]],
                x: [[0, 0], [0.3, -6], [1.1, -8], [1.15, 26, 'out'], [1.6, 0]] },
        body: { x: [[0, 0], [0.3, 6], [1.1, 6], [1.15, 18, 'out'], [1.6, 0]], rot: [[0, 0], [0.3, 2], [1.1, 2], [1.15, 4, 'out'], [1.6, 0]] },
        head: { rot: [[0, 0], [0.3, -2], [1.1, -2], [1.6, 0]] },
        legF: { rot: [[0, 0], [0.3, -4], [1.15, -6], [1.6, 0]] },
        legB: { rot: [[0, 0], [0.3, 4], [1.15, 6], [1.6, 0]] }
    },
    events: [[0.3, 'impact', { socket: 'tip', bone: 'armF', color: '255, 60, 60' }], [1.15, 'impact', { socket: 'tip', bone: 'armF', color: '255, 40, 40' }]]
};

// ---- 새 기획 스테이지 2 · 에너지 코퍼레이션 중장비 방위군 (D-085) ----
// 드럼통 투척(두 팔 한 조각): 드럼통을 뒤로 젖혔다가 앞으로 내던짐
const BARREL_THROW = {
    duration: 1.0, loop: true,
    tracks: {
        arms: { rot: [[0, 0], [0.35, -26, 'in'], [0.5, 30, 'out'], [0.7, 20], [1.0, 0]], x: [[0, 0], [0.35, 18, 'in'], [0.5, -20, 'out'], [1.0, 0]] },
        body: { x: [[0, 0], [0.35, 10, 'in'], [0.5, -14, 'out'], [1.0, 0]], rot: [[0, 0], [0.35, 4], [0.5, -5, 'out'], [1.0, 0]] },
        head: { rot: [[0, 0], [0.35, 3], [0.5, -3], [1.0, 0]] },
        legF: { rot: [[0, 0], [0.5, 8, 'out'], [1.0, 0]] },
        legB: { rot: [[0, 0], [0.5, -6, 'out'], [1.0, 0]] }
    },
    events: [[0.5, 'impact', { socket: 'tip', bone: 'arms', color: '200, 230, 60' }]]
};
// 드릴 찌르기: 앞 드릴 팔을 당겼다가 깊게 찔러 넣고 떨며 갈아냄
const DRILL_THRUST = {
    duration: 1.0, loop: true,
    tracks: {
        armF: { x: [[0, 0], [0.3, 20, 'in'], [0.42, -44, 'out'], [0.5, -40], [0.58, -44], [0.66, -40], [0.74, -44], [1.0, 0]],
                rot: [[0, 0], [0.3, -6], [0.42, 6, 'out'], [1.0, 0]] },
        armB: { rot: [[0, 0], [0.3, 10], [0.42, -8, 'out'], [1.0, 0]] },
        body: { x: [[0, 0], [0.3, 12, 'in'], [0.42, -20, 'out'], [0.8, -14], [1.0, 0]], rot: [[0, 0], [0.3, 4], [0.42, -5, 'out'], [1.0, 0]] },
        legF: { rot: [[0, 0], [0.42, 8, 'out'], [1.0, 0]] },
        legB: { rot: [[0, 0], [0.42, -6, 'out'], [1.0, 0]] }
    },
    events: impact(0.42, '255, 170, 60')
};
// 보스 파일벙커: 강철 기둥을 높이 들어 올렸다가 바닥에 내리찍음
const PILE_SLAM = {
    duration: 1.4, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.55, 30, 'in'], [0.7, -16, 'out'], [0.9, -12], [1.4, 0]], y: [[0, 0], [0.55, -30, 'in'], [0.7, 12, 'out'], [1.4, 0]] },
        armB: { rot: [[0, 0], [0.55, -10], [0.7, 8], [1.4, 0]] },
        body: { y: [[0, 0], [0.55, -14], [0.7, 10, 'out'], [1.4, 0]], rot: [[0, 0], [0.55, -3], [0.7, 4, 'out'], [1.4, 0]] },
        head: { rot: [[0, 0], [0.55, 2], [0.7, -3], [1.4, 0]] }
    },
    events: [[0.7, 'impact', { socket: 'tip', bone: 'armF', color: '255, 160, 60' }]]
};
// 중장비(한 조각) — 궤도 차량은 덜컹이며 / 4족 워커는 성큼성큼 출렁 / 탑은 거의 제자리에서 흔들림
const TREAD_ROLL = {
    duration: 0.5, loop: true,
    tracks: { body: { y: [[0, 0], [0.12, -3], [0.25, 0], [0.37, -2], [0.5, 0]], rot: [[0, -0.6], [0.25, 0.6], [0.5, -0.6]] } }
};
const TREAD_RAM = {
    duration: 0.9, loop: true,
    tracks: { body: { x: [[0, 0], [0.35, 16, 'in'], [0.48, -34, 'out'], [0.65, -26], [0.9, 0]], rot: [[0, 0], [0.35, 2], [0.48, -3, 'out'], [0.9, 0]] } },
    events: [[0.48, 'impact', { socket: 'tip', bone: 'body', color: '255, 200, 120' }]]
};
const RECOIL_SHOT = {
    duration: 1.0, loop: true,
    tracks: { body: { x: [[0, 0], [0.3, -4], [0.36, 20, 'out'], [0.7, 4], [1.0, 0]], rot: [[0, 0], [0.36, 3, 'out'], [1.0, 0]],
                      sy: [[0, 1], [0.36, 0.96, 'out'], [0.7, 1.01], [1.0, 1]] } },
    events: [[0.36, 'impact', { socket: 'tip', bone: 'body', color: '255, 170, 80' }]]
};
const WALKER_STRIDE = {
    duration: 1.0, loop: true,
    tracks: { body: { y: [[0, 0], [0.25, -10, 'out'], [0.5, 0, 'in'], [0.75, -10, 'out'], [1.0, 0, 'in']], rot: [[0, -1.5], [0.5, 1.5], [1.0, -1.5]] } }
};
const TOWER_SWAY = {
    duration: 1.6, loop: true,
    tracks: { body: { rot: [[0, -0.8], [0.8, 0.8], [1.6, -0.8]], y: [[0, 0], [0.8, -2], [1.6, 0]] } }
};
const SONIC_BLAST = {
    duration: 0.9, loop: true,
    tracks: { body: { sx: [[0, 1], [0.2, 1.05, 'out'], [0.3, 0.98], [0.4, 1.04], [0.55, 1], [0.9, 1]],
                      sy: [[0, 1], [0.2, 1.05, 'out'], [0.3, 0.98], [0.4, 1.04], [0.55, 1], [0.9, 1]] } },
    events: [[0.2, 'impact', { socket: 'tip', bone: 'body', color: '255, 220, 120' }]]
};
const SAW_HOVER = {
    duration: 0.8, loop: true,
    tracks: { body: { y: [[0, 0], [0.4, -10], [0.8, 0]], rot: [[0, -4], [0.4, 2], [0.8, -4]] } }
};
const SAW_DIVE = {
    duration: 0.7, loop: true,
    tracks: { body: { x: [[0, 0], [0.25, 14, 'in'], [0.36, -34, 'out'], [0.5, -26], [0.7, 0]], y: [[0, 0], [0.25, -10], [0.36, 12, 'out'], [0.7, 0]],
                      rot: [[0, 0], [0.25, 6], [0.36, -10, 'out'], [0.7, 0]] } },
    events: [[0.36, 'impact', { socket: 'tip', bone: 'body', color: '255, 220, 160' }]]
};

// ---- 새 기획 스테이지 3 · 성왕국 이단 토벌대 & 광신도 연합 (D-085) ----
// 사슬 채찍(두 팔 한 조각): 뒤로 감았다가 앞으로 길게 후려침
const WHIP_LASH = {
    duration: 0.85, loop: true,
    tracks: {
        arms: { rot: [[0, 0], [0.3, -30, 'in'], [0.42, 40, 'out'], [0.56, 28], [0.85, 0]], x: [[0, 0], [0.3, 10], [0.42, -16, 'out'], [0.85, 0]] },
        body: { x: [[0, 0], [0.3, 10, 'in'], [0.42, -16, 'out'], [0.85, 0]], rot: [[0, 0], [0.3, 4], [0.42, -5, 'out'], [0.85, 0]] },
        head: { rot: [[0, 0], [0.3, 3], [0.42, -4], [0.85, 0]] },
        legF: { rot: [[0, 0], [0.42, 8, 'out'], [0.85, 0]] },
        legB: { rot: [[0, 0], [0.42, -6, 'out'], [0.85, 0]] }
    },
    events: [[0.42, 'impact', { socket: 'tip', bone: 'arms', color: '220, 60, 70' }]]
};
// 처형용 대검(두 손 한 조각): 머리 위로 크게 치켜들었다가 내리벰
const GREATSWORD_CHOP = {
    duration: 1.1, loop: true,
    tracks: {
        arms: { rot: [[0, 0], [0.45, 120, 'in'], [0.56, -24, 'out'], [0.75, -18], [1.1, 0]], y: [[0, 0], [0.45, -12], [0.56, 6], [1.1, 0]] },
        body: { x: [[0, 0], [0.45, 12, 'in'], [0.56, -26, 'out'], [0.8, -18], [1.1, 0]], rot: [[0, 0], [0.45, 7, 'in'], [0.56, -9, 'out'], [1.1, 0]] },
        head: { rot: [[0, 0], [0.45, 4], [0.56, -5], [1.1, 0]] },
        legF: { rot: [[0, 0], [0.56, 10, 'out'], [1.1, 0]] },
        legB: { rot: [[0, 0], [0.56, -8, 'out'], [1.1, 0]] }
    },
    events: [[0.56, 'impact', { socket: 'tip', bone: 'arms', color: '255, 90, 70' }]]
};
// 보스 베네딕트(옷자락, 다리 없음): 천천히 미끄러지듯 / 검은 손을 앞으로 휘둘러 촉수를 부름
const ROBE_GLIDE = {
    duration: 1.5, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.75, -6], [1.5, 0]], rot: [[0, -1], [0.75, 1], [1.5, -1]], sy: [[0, 1], [0.75, 1.01], [1.5, 1]] },
        head: { rot: [[0, 1.5], [0.75, -1.5], [1.5, 1.5]] },
        armF: { rot: [[0, -3], [0.75, 3], [1.5, -3]] },
        armB: { rot: [[0, 3], [0.75, -4], [1.5, 3]] }
    }
};
const DARK_SWEEP = {
    duration: 1.0, loop: true,
    tracks: {
        armB: { rot: [[0, 0], [0.35, -30, 'in'], [0.5, 50, 'out'], [0.7, 40], [1.0, 0]] },
        body: { x: [[0, 0], [0.35, 10, 'in'], [0.5, -16, 'out'], [1.0, 0]], rot: [[0, 0], [0.35, 4], [0.5, -5, 'out'], [1.0, 0]] },
        head: { rot: [[0, 0], [0.35, 4], [0.5, -4], [1.0, 0]] }
    },
    events: [[0.5, 'impact', { socket: 'tip', bone: 'armB', color: '120, 0, 30' }]]
};
// 그리폰(한 조각): 날갯짓처럼 크게 오르내림 / 위로 솟았다 성수를 던짐
const GRIFFON_FLY = {
    duration: 0.9, loop: true,
    tracks: { body: { y: [[0, 0], [0.3, -18, 'out'], [0.6, 2, 'in'], [0.9, 0]], rot: [[0, -2], [0.45, 2], [0.9, -2]],
                      sy: [[0, 1], [0.3, 1.03], [0.6, 0.98], [0.9, 1]] } }
};
const GRIFFON_THROW = {
    duration: 0.9, loop: true,
    tracks: { body: { y: [[0, 0], [0.3, -24, 'out'], [0.45, -10], [0.9, 0]], rot: [[0, 0], [0.3, 6], [0.45, -5, 'out'], [0.9, 0]] } },
    events: [[0.45, 'impact', { socket: 'tip', bone: 'body', color: '255, 236, 170' }]]
};

// ---- 새 기획 스테이지 5 · 어비스 연합 해군 (D-085) ----
// 폭뢰 던지기(앞팔): 뒤로 젖혔다가 머리 위로 던짐 = 오물 투척과 같은 동작
// 아이언클래드: 압축포를 겨누고 떨다 반동 / 등 뒤 발사관에서 폭뢰를 쏘아 올림(몸을 웅크렸다 폄)
const IRONCLAD_CANNON = {
    duration: 1.4, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, 4, 'out'], [0.5, 3], [0.7, 4], [0.9, 3], [1.1, 4], [1.15, -8, 'out'], [1.4, 0]], x: [[0, 0], [1.1, -6], [1.15, 24, 'out'], [1.4, 0]] },
        body: { x: [[0, 0], [1.1, 4], [1.15, 16, 'out'], [1.4, 0]], rot: [[0, 0], [1.15, 3, 'out'], [1.4, 0]] },
        legF: { rot: [[0, 0], [0.3, -4], [1.15, -6], [1.4, 0]] },
        legB: { rot: [[0, 0], [0.3, 4], [1.15, 6], [1.4, 0]] }
    },
    events: [[1.15, 'impact', { socket: 'tip', bone: 'armF', color: '120, 210, 255' }]]
};
const IRONCLAD_BARRAGE = {
    duration: 1.2, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.4, 10, 'in'], [0.55, -12, 'out'], [0.8, -4], [1.2, 0]], sy: [[0, 1], [0.4, 0.95], [0.55, 1.04, 'out'], [1.2, 1]] },
        armF: { rot: [[0, 0], [0.4, -6], [0.55, 6], [1.2, 0]] },
        armB: { rot: [[0, 0], [0.4, 8], [0.55, -10], [1.2, 0]] }
    },
    events: [[0.55, 'impact', { socket: 'tip', bone: 'body', color: '255, 200, 120' }]]
};

// ---- 새 기획 스테이지 6 · 성혈 의료 기사단 (D-085) ----
// 탐욕의 심장(한 조각, 떠 있음): 박동하며 오르내림 / 크게 부풀었다 오그라들며 파동
const HEART_BEAT = {
    duration: 0.9, loop: true,
    tracks: { body: { y: [[0, 0], [0.45, -10], [0.9, 0]], sx: [[0, 1], [0.1, 1.05, 'out'], [0.25, 0.98], [0.35, 1.03], [0.5, 1], [0.9, 1]],
                      sy: [[0, 1], [0.1, 1.05, 'out'], [0.25, 0.98], [0.35, 1.03], [0.5, 1], [0.9, 1]] } }
};
const HEART_PULSE = {
    duration: 1.0, loop: true,
    tracks: { body: { sx: [[0, 1], [0.3, 0.88, 'in'], [0.42, 1.16, 'out'], [0.6, 0.97], [1.0, 1]], sy: [[0, 1], [0.3, 0.88, 'in'], [0.42, 1.16, 'out'], [0.6, 0.97], [1.0, 1]],
                      y: [[0, 0], [0.3, 6], [0.42, -10], [1.0, 0]] } },
    events: [[0.42, 'impact', { socket: 'tip', bone: 'body', color: '230, 40, 70' }]]
};

// ---- 새 기획 스테이지 7 · 제국 제1 포병 사단 (D-085) ----
// 총검 찌르기(두 손 한 조각)
const BAYONET_THRUST = {
    duration: 0.8, loop: true,
    tracks: {
        arms: { x: [[0, 0], [0.3, 20, 'in'], [0.4, -38, 'out'], [0.6, -28], [0.8, 0]], rot: [[0, 0], [0.3, -4], [0.4, 3, 'out'], [0.8, 0]] },
        body: { x: [[0, 0], [0.3, 12, 'in'], [0.4, -20, 'out'], [0.6, -14], [0.8, 0]], rot: [[0, 0], [0.3, 4], [0.4, -5], [0.8, 0]] },
        legF: { rot: [[0, 0], [0.4, 10, 'out'], [0.8, 0]] },
        legB: { rot: [[0, 0], [0.4, -8, 'out'], [0.8, 0]] }
    },
    events: [[0.4, 'impact', { socket: 'tip', bone: 'arms', color: '220, 220, 200' }]]
};
// 수류탄 던지기: 치켜든 뒷팔을 앞으로 크게 휘둘러 던짐
const GRENADE_THROW = {
    duration: 0.9, loop: true,
    tracks: {
        armB: { rot: [[0, 0], [0.3, -30, 'in'], [0.45, 70, 'out'], [0.6, 55], [0.9, 0]] },
        armF: { rot: [[0, 0], [0.3, 12], [0.45, -10], [0.9, 0]] },
        body: { x: [[0, 0], [0.3, 10, 'in'], [0.45, -14, 'out'], [0.9, 0]], rot: [[0, 0], [0.3, 5], [0.45, -6], [0.9, 0]] },
        head: { rot: [[0, 0], [0.3, 3], [0.45, -4], [0.9, 0]] }
    },
    events: [[0.45, 'impact', { socket: 'tip', bone: 'armB', color: '200, 190, 160' }]]
};
// 지뢰 묻기(두 손 한 조각): 웅크려 지뢰를 내려놓음
const MINE_PLACE = {
    duration: 0.9, loop: true,
    tracks: {
        arms: { y: [[0, 0], [0.4, 24, 'in'], [0.6, 24], [0.9, 0]], rot: [[0, 0], [0.4, -10], [0.9, 0]] },
        body: { y: [[0, 0], [0.4, 16, 'in'], [0.6, 16], [0.9, 0]], rot: [[0, 0], [0.4, -6], [0.9, 0]] },
        head: { rot: [[0, 0], [0.4, -5], [0.9, 0]] }
    },
    events: [[0.5, 'impact', { socket: 'tip', bone: 'arms', color: '200, 190, 160' }]]
};
// 기관총 좌(한 조각): 연사 반동
const MG_FIRE = {
    duration: 0.6, loop: true,
    tracks: { body: { x: [[0, 0], [0.05, 5], [0.1, 0], [0.15, 5], [0.2, 0], [0.25, 5], [0.3, 0], [0.35, 5], [0.4, 0], [0.6, 0]] } },
    events: [[0, 'impact', { socket: 'tip', bone: 'body', color: '255, 220, 120' }]]
};

// ---- 새 기획 스테이지 8 · 노르딘 왕실 근위대 (D-085) ----
// 블라디미르(두 손 대검 한 조각): 대검을 치켜들었다가 앞으로 휘둘러 브레스
const SWORD_BREATH = {
    duration: 1.2, loop: true,
    tracks: {
        arms: { rot: [[0, 0], [0.5, 60, 'in'], [0.65, -20, 'out'], [0.9, -14], [1.2, 0]], y: [[0, 0], [0.5, -16], [0.65, 6], [1.2, 0]] },
        body: { x: [[0, 0], [0.5, 10, 'in'], [0.65, -18, 'out'], [1.2, 0]], rot: [[0, 0], [0.5, 5], [0.65, -6, 'out'], [1.2, 0]] },
        head: { rot: [[0, 0], [0.5, 4], [0.65, -4], [1.2, 0]] }
    },
    events: [[0.65, 'impact', { socket: 'tip', bone: 'arms', color: '255, 140, 40' }]]
};
// 블라디미르 걷기(긴 망토, 다리 없음): 묵직하게 출렁이며 나아감
const HEAVY_GLIDE = {
    duration: 1.4, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.35, -8, 'out'], [0.7, 0, 'in'], [1.05, -8, 'out'], [1.4, 0, 'in']], rot: [[0, -1], [0.7, 1], [1.4, -1]] },
        head: { rot: [[0, 1.5], [0.7, -1.5], [1.4, 1.5]] },
        arms: { rot: [[0, -2], [0.7, 2], [1.4, -2]] }
    }
};
// 화염 늑대 기사(한 조각): 성큼성큼 달림
const GALLOP = {
    duration: 0.6, loop: true,
    tracks: { body: { y: [[0, 0], [0.15, -14, 'out'], [0.3, 0, 'in'], [0.45, -10, 'out'], [0.6, 0, 'in']], rot: [[0, -3], [0.15, 2], [0.3, -3], [0.45, 2], [0.6, -3]] } }
};

function enemy(id, name, { arms = 'two', cape = false, tail = false, legs = true, walkOpt, walkClip, clips, hitBone = 'armF', shadow }) {
    return {
        id, name, assetDir: dir(id),
        bones: bones({ arms, cape, tail, legs }),
        springs: arms === 'none' ? [] : [{ bone: 'head', channel: 'y', axis: 1, gain: 0.3, k: 260, damping: 12, limit: 6 }],
        clips: { idle: idle(arms === 'two' ? 'armF' : arms === 'none' ? 'body' : 'arms'), walk: walkClip || walk(walkOpt), ...clips },
        arms: null,
        attack: 'attack',
        hitSocket: ['tip', hitBone],
        debugSockets: legs ? [['tip', hitBone], ['footF', 'legF'], ['footB', 'legB']] : [['tip', hitBone]],
        shadow: shadow || { rx: 180, ry: 18 }
    };
}

const SOLDIER_WALK = { dur: 0.7, leg: 22, lift: 22, bob: 10 };

// 합성괴인 졸개(아군): 가시 곤봉 내려치기 + 꼬리를 치켜들었다 휘두름
const MINION_SWING = {
    ...BATON_SWING,
    tracks: { ...BATON_SWING.tracks, tail: { rot: [[0, 0], [0.3, -14, 'in'], [0.4, 12, 'out'], [0.8, 0]] } }
};

// 뒤틀린 인형사의 토끼 인형(아군): 두 팔을 앞으로 뻗어 끌어안듯 붙잡고 꽉 조임 (적을 붙잡아 둠), 귀·몸이 출렁
const RABBIT_GRAB = {
    duration: 0.8, loop: true,
    tracks: {
        arms: { rot: [[0, 0], [0.2, 18, 'out'], [0.35, -6, 'in'], [0.45, 2], [0.55, -6], [0.8, 0]],
                x: [[0, 0], [0.2, -12, 'out'], [0.35, 4, 'in'], [0.8, 0]] },
        body: { x: [[0, 0], [0.2, -8, 'out'], [0.35, 4], [0.8, 0]], rot: [[0, 0], [0.2, -6], [0.35, 3], [0.8, 0]],
                y: [[0, 0], [0.35, 6], [0.8, 0]] },
        head: { rot: [[0, 0], [0.2, -5], [0.35, 4], [0.5, -2], [0.8, 0]] },
        legF: { rot: [[0, 0], [0.2, 10, 'out'], [0.8, 0]] },
        legB: { rot: [[0, 0], [0.2, -8, 'out'], [0.8, 0]] }
    },
    events: [[0.35, 'impact', { socket: 'tip', bone: 'arms', color: '120, 230, 240' }]]
};

// ---- 구역 3·4 (D-056) ----
// 지팡이 시전(마법사·대주교): 지팡이를 앞으로 치켜들었다가 겨누며 내뻗음
const STAFF_CAST = {
    duration: 0.9, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, 38, 'in'], [0.42, 14, 'out'], [0.7, 12], [0.9, 0]], x: [[0, 0], [0.3, 6], [0.42, -16, 'out'], [0.7, -10], [0.9, 0]] },
        armB: { rot: [[0, 0], [0.3, -14], [0.42, 6], [0.9, 0]] },
        body: { x: [[0, 0], [0.3, 8, 'in'], [0.42, -10, 'out'], [0.9, 0]], rot: [[0, 0], [0.3, 4], [0.42, -4], [0.9, 0]] },
        head: { rot: [[0, 0], [0.3, 3], [0.42, -3], [0.9, 0]] }
    },
    events: impact(0.42, '200, 220, 255')
};
// 대주교 '천상의 심판'(한 번): 두 팔을 하늘로 들어 올려 빛을 부름
const HOLY_RAISE = {
    duration: 1.1, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.4, 28, 'in'], [0.9, 32], [1.1, 0]], y: [[0, 0], [0.4, -14], [0.9, -16], [1.1, 0]] },
        armB: { rot: [[0, 0], [0.4, -24, 'in'], [0.9, -28], [1.1, 0]] },
        body: { y: [[0, 0], [0.4, -16, 'out'], [0.9, -18], [1.1, 0]], rot: [[0, 0], [0.4, 3], [0.9, 3], [1.1, 0]] },
        head: { rot: [[0, 0], [0.4, 6], [0.9, 6], [1.1, 0]] }
    },
    events: impact(0.45, '255, 236, 170')
};
// 촉수 후려치기: 촉수를 뒤로 감았다가 앞으로 채찍처럼
const TENTACLE_LASH = {
    duration: 0.85, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, -36, 'in'], [0.42, 58, 'out'], [0.58, 42], [0.85, 0]] },
        armB: { rot: [[0, 0], [0.3, 22], [0.42, -18, 'out'], [0.85, 0]] },
        body: { x: [[0, 0], [0.3, 10, 'in'], [0.42, -20, 'out'], [0.6, -14], [0.85, 0]], rot: [[0, 0], [0.3, 4], [0.42, -6, 'out'], [0.85, 0]] },
        head: { rot: [[0, 0], [0.3, 4], [0.42, -5], [0.85, 0]] },
        legF: { rot: [[0, 0], [0.42, 10, 'out'], [0.85, 0]] },
        legB: { rot: [[0, 0], [0.42, -8, 'out'], [0.85, 0]] }
    },
    events: impact(0.42, '170, 90, 255')
};
// 악마기사 도끼 내려찍기 = 망치 내리찍기 + 망토 펄럭
const AXE_CLEAVE = {
    ...HAMMER_SLAM,
    tracks: { ...HAMMER_SLAM.tracks, cape: { rot: [[0, 0], [0.4, -5], [0.52, 9, 'out'], [1.0, 0]] } },
    events: impact(0.52, '255, 90, 60')
};
// 이단심문관 철퇴 = 진압봉 내려치기 + 망토 펄럭
const MACE_SWING = {
    ...BATON_SWING,
    tracks: { ...BATON_SWING.tracks, cape: { rot: [[0, 0], [0.3, -4], [0.4, 8, 'out'], [0.8, 0]] } },
    events: impact(0.4, '255, 210, 120')
};
// 대주교(다리 없음): 가마째 떠서 천천히 출렁이며 나아감
const FLOAT_WALK = {
    duration: 1.4, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.7, -12], [1.4, 0]], rot: [[0, -1], [0.7, 1], [1.4, -1]] },
        head: { rot: [[0, 1.5], [0.7, -1.5], [1.4, 1.5]] },
        armF: { rot: [[0, -3], [0.7, 3], [1.4, -3]] },
        armB: { rot: [[0, 2], [0.7, -4], [1.4, 2]] }
    }
};
// 슬라임: 눌렸다 늘어나며 꿈틀꿈틀 (몸통 피벗 = 바닥 가운데)
const SLIME_WALK = {
    duration: 0.8, loop: true,
    tracks: {
        body: { sy: [[0, 1], [0.2, 0.86, 'out'], [0.4, 1.08, 'in'], [0.6, 0.96], [0.8, 1]],
                sx: [[0, 1], [0.2, 1.1, 'out'], [0.4, 0.94, 'in'], [0.6, 1.03], [0.8, 1]],
                x: [[0, 0], [0.4, -8], [0.8, 0]] }
    }
};
// 슬라임 덮치기: 뒤로 웅크렸다가 앞으로 길게 늘어나며 덮침
const SLIME_LUNGE = {
    duration: 0.8, loop: true,
    tracks: {
        body: { sy: [[0, 1], [0.28, 0.78, 'in'], [0.4, 1.12, 'out'], [0.55, 0.92], [0.8, 1]],
                sx: [[0, 1], [0.28, 1.16, 'in'], [0.4, 0.9, 'out'], [0.55, 1.06], [0.8, 1]],
                x: [[0, 0], [0.28, 14, 'in'], [0.4, -34, 'out'], [0.6, -24], [0.8, 0]],
                rot: [[0, 0], [0.28, 4], [0.4, -8, 'out'], [0.8, 0]] }
    },
    events: [[0.4, 'impact', { socket: 'tip', bone: 'body', color: '150, 255, 90' }]]
};

// 오큘러스(벌레 몸, 다리 없음): 몸이 천천히 들썩이며 미끄러지듯 나아감, 팔은 마법진을 그리듯 출렁
const SERPENT_WALK = {
    duration: 1.3, loop: true,
    tracks: {
        body: { y: [[0, 0], [0.65, -8], [1.3, 0]], sy: [[0, 1], [0.65, 1.02], [1.3, 1]], sx: [[0, 1], [0.65, 0.985], [1.3, 1]] },
        head: { rot: [[0, 2], [0.65, -2.5], [1.3, 2]] },
        armF: { rot: [[0, -4], [0.65, 6], [1.3, -4]] },
        armB: { rot: [[0, 5], [0.65, -5], [1.3, 5]] }
    }
};
// 2페이즈 톱날 팔 내려찍기: 톱날을 더 치켜들었다가 앞으로 내려침 (+ 뒷팔 반대로)
const SAW_CHOP = {
    duration: 0.9, loop: true,
    tracks: {
        armF: { rot: [[0, 0], [0.3, 26, 'in'], [0.42, -42, 'out'], [0.6, -32], [0.9, 0]] },
        armB: { rot: [[0, 0], [0.3, -18], [0.42, 30, 'out'], [0.9, 0]] },
        body: { x: [[0, 0], [0.3, 12, 'in'], [0.42, -28, 'out'], [0.65, -20], [0.9, 0]], rot: [[0, 0], [0.3, 2], [0.42, -3, 'out'], [0.9, 0]] },
        head: { rot: [[0, 0], [0.3, 4], [0.42, -6], [0.9, 0]] }
    },
    events: impact(0.42, '255, 60, 80')
};

export const ENEMY_RIGS = {
    guard: enemy('guard', '경비병', { walkOpt: { ...SOLDIER_WALK, armF: 12, armB: 12 }, clips: { attack: BATON_SWING } }),
    shield: enemy('shield', '방패병', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    tranq: enemy('tranq', '마취총 사수', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    shock: enemy('shock', '전기 충격병', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: SPEAR_THRUST } }),
    medic: enemy('medic', '의무병', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: HEAL_SPRAY } }),
    guardian: enemy('guardian', '정의의 수호자', {
        cape: true, walkOpt: { dur: 0.9, leg: 18, lift: 20, bob: 12, armF: 3, armB: 8, cape: 4 },
        clips: { attack: SWORD_SLASH, bash: GUARDIAN_BASH }, shadow: { rx: 260, ry: 22 }
    }),
    // 아군 (오른쪽을 보는 그림을 뒤집어 잘랐으므로 적처럼 왼쪽을 봄 — 게임에선 아군이라 다시 뒤집어 그림)
    minion: enemy('minion', '합성괴인 졸개', { tail: true, walkOpt: { ...SOLDIER_WALK, dur: 0.75, armF: 10, armB: 6, tail: 8 }, clips: { attack: MINION_SWING } }),
    // 뒤틀린 인형사의 토끼 인형 (새 캐릭터 D-049): 짧은 다리로 통통 뛰듯 걷는 인형
    rabbit: enemy('rabbit', '토끼 인형', { arms: 'one', walkOpt: { dur: 0.55, leg: 26, lift: 30, bob: 16, arms: 6 }, clips: { attack: RABBIT_GRAB }, hitBone: 'arms' }),
    // ---- 구역 2: 고철 약탈단 ----
    raider: enemy('raider', '고철 약탈자', { walkOpt: { ...SOLDIER_WALK, armF: 12, armB: 12 }, clips: { attack: BATON_SWING } }),
    builder: enemy('builder', '고철 방벽병', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 6, armB: 8 }, clips: { attack: HAMMER_SLAM } }),
    sludge: enemy('sludge', '오물 투척병', { walkOpt: { ...SOLDIER_WALK, armF: 10, armB: 8 }, clips: { attack: LADLE_THROW } }),
    netter: enemy('netter', '그물총 사수', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    mechanic: enemy('mechanic', '수리공', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: HEAL_SPRAY } }),
    scrapking: enemy('scrapking', '고철왕', {
        walkOpt: { dur: 1.0, leg: 14, lift: 22, bob: 12, armF: 3, armB: 6 },
        clips: { attack: CLAW_SMASH, magnet: MAGNET_PULL, drop: SCRAP_DROP }, shadow: { rx: 300, ry: 24 }
    }),
    // ---- 구역 3: 성왕국 이단심문소 & 타락 기사단 ----
    soldier: enemy('soldier', '왕국보병', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: SPEAR_THRUST } }),
    // 새 기획 구역 3 그림 (D-085): 가시 쇠사슬 채찍 + 두 팔이 한 조각
    inquisitor: enemy('inquisitor', '이단심문관', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.8, leg: 20, arms: 3 }, clips: { attack: WHIP_LASH }, hitBone: 'arms' }),
    holyshield: enemy('holyshield', '신성 방패병', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    priest: enemy('priest', '신관', { walkOpt: { ...SOLDIER_WALK, armF: 6, armB: 10 }, clips: { attack: HEAL_SPRAY } }),
    mage: enemy('mage', '마법사', { walkOpt: { ...SOLDIER_WALK, armF: 4, armB: 10 }, clips: { attack: STAFF_CAST } }),
    demon: enemy('demon', '악마병', { walkOpt: { ...SOLDIER_WALK, dur: 0.65, armF: 3, armB: 12 }, clips: { attack: SHIELD_BASH } }),
    demonknight: enemy('demonknight', '악마기사', {
        cape: true, walkOpt: { dur: 0.9, leg: 18, lift: 20, bob: 12, armF: 3, armB: 8, cape: 4 }, clips: { attack: AXE_CLEAVE },
        shadow: { rx: 220, ry: 20 }
    }),
    archbishop: enemy('archbishop', '대주교 베네딕트', {
        legs: false, walkClip: FLOAT_WALK, clips: { attack: STAFF_CAST, bash: HOLY_RAISE }, shadow: { rx: 280, ry: 22 }
    }),
    // ---- 구역 4: 별의 사도들과 실패한 진화체들 ----
    cultist: enemy('cultist', '진화의 광신도', { walkOpt: { dur: 0.6, leg: 24, lift: 24, bob: 12, armF: 10, armB: 14 }, clips: { attack: BATON_SWING } }),
    tentacle: enemy('tentacle', '심연 촉수귀', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, leg: 20, armF: 14, armB: 14 }, clips: { attack: TENTACLE_LASH } }),
    carapace: enemy('carapace', '생체 방패수', {
        walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH }, shadow: { rx: 210, ry: 20 }
    }),
    sporer: enemy('sporer', '포자 술사', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 8 }, clips: { attack: LADLE_THROW } }),
    // 보스 관장자 오큘러스: 1페이즈 마법사형(지팡이 대신 손끝 마법진 — 시전·점액 던지기·두 팔 들어 파동), 2페이즈 외눈 괴수(톱날 내려찍기)
    oculus: enemy('oculus', '관장자 오큘러스', {
        legs: false, walkClip: SERPENT_WALK, clips: { attack: STAFF_CAST, magnet: LADLE_THROW, drop: HOLY_RAISE }, shadow: { rx: 300, ry: 24 }
    }),
    oculus2: enemy('oculus2', '관장자 오큘러스 (2페이즈)', {
        legs: false, walkClip: SERPENT_WALK, clips: { attack: SAW_CHOP, magnet: SAW_CHOP, drop: HOLY_RAISE }, shadow: { rx: 300, ry: 24 }
    }),
    // ---- 새 기획 스테이지 1 · 블랙 하운드 (D-085) ----
    conscript: enemy('conscript', '징집 보병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_BURST }, hitBone: 'arms' }),
    riot: enemy('riot', '진압 방패병', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    taser: enemy('taser', '테이저 요원', { walkOpt: { ...SOLDIER_WALK, armF: 6, armB: 8 }, clips: { attack: LADLE_THROW } }),
    rocket: enemy('rocket', '로켓 보병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.75, arms: 1 }, clips: { attack: ROCKET_SHOT }, hitBone: 'arms' }),
    flamer: enemy('flamer', '화염방사병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.75, arms: 2 }, clips: { attack: FLAME_SPRAY }, hitBone: 'arms' }),
    exo: enemy('exo', '기계화 강화병', {
        walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, armF: 4, armB: 6 }, clips: { attack: EXO_PUNCH }, shadow: { rx: 240, ry: 22 }
    }),
    hound: enemy('hound', '전투 군견', { arms: 'none', legs: false, walkClip: HOUND_RUN, clips: { attack: HOUND_BITE }, hitBone: 'body', shadow: { rx: 220, ry: 18 } }),
    empdrone: enemy('empdrone', 'EMP 드론', { arms: 'none', legs: false, walkClip: DRONE_HOVER, clips: { attack: DRONE_PULSE }, hitBone: 'body', shadow: { rx: 150, ry: 12 } }),
    wmdalpha: enemy('wmdalpha', 'WMD-알파', {
        walkOpt: { dur: 1.1, leg: 14, lift: 20, bob: 14, armF: 3, armB: 6 }, clips: { attack: CLAW_SMASH, laser: WMD_CHARGE }, shadow: { rx: 320, ry: 26 }
    }),
    // ---- 새 기획 스테이지 2 · 에너지 코퍼레이션 중장비 방위군 (D-085) ----
    merc: enemy('merc', '코퍼레이션 용병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_BURST }, hitBone: 'arms' }),
    acidmech: enemy('acidmech', '산성액 투척 메카', {
        arms: 'one', walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, arms: 3 }, clips: { attack: BARREL_THROW }, hitBone: 'arms', shadow: { rx: 240, ry: 22 }
    }),
    excavator: enemy('excavator', '채굴용 엑스카베이터', {
        walkOpt: { dur: 1.0, leg: 14, lift: 18, bob: 12, armF: 3, armB: 5 }, clips: { attack: DRILL_THRUST }, shadow: { rx: 260, ry: 22 }
    }),
    terraformer: enemy('terraformer', '기간틱 테라포머', {
        walkOpt: { dur: 1.15, leg: 12, lift: 16, bob: 14, armF: 3, armB: 6 }, clips: { attack: CLAW_SMASH, pile: PILE_SLAM }, shadow: { rx: 330, ry: 26 }
    }),
    dozer: enemy('dozer', '불도저 드로이드', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 260, ry: 20 } }),
    harpoon: enemy('harpoon', '고압 작살포 트럭', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 300, ry: 22 } }),
    sawdrone: enemy('sawdrone', '벌목용 회전톱 드론', { arms: 'none', legs: false, walkClip: SAW_HOVER, clips: { attack: SAW_DIVE }, hitBone: 'body', shadow: { rx: 150, ry: 12 } }),
    sonictower: enemy('sonictower', '음파 차단 탑', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: SONIC_BLAST }, hitBone: 'body', shadow: { rx: 200, ry: 18 } }),
    spiderwalker: enemy('spiderwalker', '대물 포격 워커', { arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 280, ry: 22 } }),
    // ---- 새 기획 스테이지 3 · 성왕국 이단 토벌대 & 광신도 연합 (D-085) — 신성 방패병·이단심문관은 위 구역 3 줄 ----
    zealot: enemy('zealot', '광신도', { walkOpt: { dur: 0.6, leg: 24, lift: 24, bob: 12, armF: 8, armB: 10 }, clips: { attack: SPEAR_THRUST } }),
    lightmage: enemy('lightmage', '빛의 마법사', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, armF: 4, armB: 6 }, clips: { attack: STAFF_CAST } }),
    battlepriest: enemy('battlepriest', '전투 신관', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, armF: 10, armB: 8 }, clips: { attack: HEAL_SPRAY } }),
    executioner: enemy('executioner', '처형인 성기사', {
        arms: 'one', walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, arms: 3 }, clips: { attack: GREATSWORD_CHOP }, hitBone: 'arms', shadow: { rx: 240, ry: 22 }
    }),
    griffon: enemy('griffon', '그리폰 기수', { arms: 'none', legs: false, walkClip: GRIFFON_FLY, clips: { attack: GRIFFON_THROW }, hitBone: 'body', shadow: { rx: 200, ry: 14 } }),
    ballista: enemy('ballista', '정화의 발리스타', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 260, ry: 20 } }),
    benedict: enemy('benedict', '타락한 대주교 베네딕트', {
        legs: false, walkClip: ROBE_GLIDE, clips: { attack: STAFF_CAST, bash: HOLY_RAISE, drain: DARK_SWEEP }, shadow: { rx: 280, ry: 22 }
    }),
    // ---- 새 기획 스테이지 4 · 별의 사도들과 실패한 진화체들 (D-085) — 보스 오큘러스는 위 줄 (새 그림) ----
    mutant: enemy('mutant', '진화의 광신도', { walkOpt: { dur: 0.6, leg: 24, lift: 24, bob: 12, armF: 12, armB: 10 }, clips: { attack: TENTACLE_LASH } }),
    boneshield: enemy('boneshield', '생체 방패수', {
        walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH }, shadow: { rx: 210, ry: 20 }
    }),
    leechfiend: enemy('leechfiend', '심연 촉수귀', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.8, leg: 20, arms: 6 }, clips: { attack: WHIP_LASH }, hitBone: 'arms' }),
    sporecaster: enemy('sporecaster', '포자 술사', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, armF: 8, armB: 8 }, clips: { attack: LADLE_THROW } }),
    chimeraslime: enemy('chimeraslime', '키메라 슬라임', {
        arms: 'none', legs: false, walkClip: SLIME_WALK, clips: { attack: SLIME_LUNGE }, hitBone: 'body', shadow: { rx: 200, ry: 20 }
    }),
    parasite: enemy('parasite', '혈관 기생충', { arms: 'none', legs: false, walkClip: SLIME_WALK, clips: { attack: DRONE_PULSE }, hitBone: 'body', shadow: { rx: 160, ry: 14 } }),
    eyetower: enemy('eyetower', '안구 감시탑', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: SONIC_BLAST }, hitBone: 'body', shadow: { rx: 200, ry: 18 } }),
    fusionbeast: enemy('fusionbeast', '광폭화 융합수', {
        arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 280, ry: 22 }
    }),
    // ---- 새 기획 스테이지 5 · 어비스 연합 해군 & 특수 잠수 부대 (D-085) ----
    marine: enemy('marine', '작살총 해병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    hatchshield: enemy('hatchshield', '격벽 방패수', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    netgunner: enemy('netgunner', '그물망 사수', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.75, arms: 1 }, clips: { attack: ROCKET_SHOT }, hitBone: 'arms' }),
    mineman: enemy('mineman', '수뢰 투척병', { walkOpt: { ...SOLDIER_WALK, armF: 4, armB: 10 }, clips: { attack: LADLE_THROW } }),
    toxicdiver: enemy('toxicdiver', '맹독 잠수부', { walkOpt: { dur: 0.55, leg: 24, lift: 22, bob: 12, armF: 14, armB: 12 }, clips: { attack: TENTACLE_LASH } }),
    ironclad: enemy('ironclad', '해군 총사령관 아이언클래드', {
        walkOpt: { dur: 1.15, leg: 12, lift: 16, bob: 14, armF: 3, armB: 6 }, clips: { attack: CLAW_SMASH, cannon: IRONCLAD_CANNON, barrage: IRONCLAD_BARRAGE },
        shadow: { rx: 320, ry: 26 }
    }),
    sonardrone: enemy('sonardrone', '소나 드론', { arms: 'none', legs: false, walkClip: DRONE_HOVER, clips: { attack: DRONE_PULSE }, hitBone: 'body', shadow: { rx: 150, ry: 12 } }),
    deckgun: enemy('deckgun', '함포 포탑', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 240, ry: 20 } }),
    subwalker: enemy('subwalker', '심해 구축 워커', {
        arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 280, ry: 22 }
    }),
    // ---- 새 기획 스테이지 6 · 성혈 의료 기사단 (D-085) ----
    orderly: enemy('orderly', '부패한 간병 보병', { walkOpt: { ...SOLDIER_WALK, armF: 10, armB: 12 }, clips: { attack: BATON_SWING } }),
    maidenshield: enemy('maidenshield', '철의 처녀 방패수', {
        walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH }, shadow: { rx: 200, ry: 20 }
    }),
    holywater: enemy('holywater', '오염된 성수 투척병', { walkOpt: { ...SOLDIER_WALK, armF: 6, armB: 10 }, clips: { attack: LADLE_THROW } }),
    anesthetist: enemy('anesthetist', '마취의 주술사', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, armF: 10, armB: 8 }, clips: { attack: HEAL_SPRAY } }),
    bloated: enemy('bloated', '강제 수혈 실험체', { walkOpt: { dur: 0.8, leg: 16, lift: 14, bob: 14, armF: 14, armB: 12 }, clips: { attack: BATON_SWING } }),
    surgeon: enemy('surgeon', '처형의 군의관', {
        arms: 'one', walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, arms: 3 }, clips: { attack: GREATSWORD_CHOP }, hitBone: 'arms', shadow: { rx: 240, ry: 22 }
    }),
    bloodbagdrone: enemy('bloodbagdrone', '수혈 팩 드론', { arms: 'none', legs: false, walkClip: DRONE_HOVER, clips: { attack: DRONE_PULSE }, hitBone: 'body', shadow: { rx: 150, ry: 12 } }),
    ambulance: enemy('ambulance', '기계화 구급 마차', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 300, ry: 22 } }),
    grailheart: enemy('grailheart', '기적의 성배 : 탐욕의 심장', {
        arms: 'none', legs: false, walkClip: HEART_BEAT, clips: { attack: HEART_PULSE, drain: HEART_PULSE }, hitBone: 'body', shadow: { rx: 260, ry: 20 }
    }),
    // ---- 새 기획 스테이지 7 · 제국 제1 포병 사단 (D-085) ----
    trench: enemy('trench', '참호 징집병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: BAYONET_THRUST }, hitBone: 'arms' }),
    wireshield: enemy('wireshield', '철조망 방패병', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    grenadier: enemy('grenadier', '유산탄 투척병', { walkOpt: { ...SOLDIER_WALK, armF: 10, armB: 4 }, clips: { attack: GRENADE_THROW }, hitBone: 'armB' }),
    gassoldier: enemy('gassoldier', '독가스 살포병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.75, arms: 2 }, clips: { attack: FLAME_SPRAY }, hitBone: 'arms' }),
    officer: enemy('officer', '돌격 장교', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: BATON_SWING } }),
    sapper: enemy('sapper', '지뢰 매설병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.6, arms: 2 }, clips: { attack: MINE_PLACE }, hitBone: 'arms' }),
    mgnest: enemy('mgnest', '야전 기관총 좌', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: MG_FIRE }, hitBone: 'body', shadow: { rx: 280, ry: 20 } }),
    steamtank: enemy('steamtank', '증기기관 전차', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 300, ry: 22 } }),
    behemoth: enemy('behemoth', '심판의 구포 : 베헤모스', {
        arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: RECOIL_SHOT, cannon: RECOIL_SHOT, charge: TREAD_RAM }, hitBone: 'body',
        shadow: { rx: 330, ry: 26 }
    }),
    // ---- 새 기획 스테이지 8 · 노르딘 왕실 근위대 & 온기 탐식자들 (D-085) ----
    torch: enemy('torch', '횃불 징집병', { walkOpt: { ...SOLDIER_WALK, armF: 8, armB: 12 }, clips: { attack: BATON_SWING } }),
    furnaceshield: enemy('furnaceshield', '화로 방패병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, arms: 2 }, clips: { attack: BAYONET_THRUST }, hitBone: 'arms' }),
    oilthrower: enemy('oilthrower', '끓는 기름 투척병', { walkOpt: { ...SOLDIER_WALK, armF: 6, armB: 10 }, clips: { attack: LADLE_THROW } }),
    hunter: enemy('hunter', '작살총 사냥꾼', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    heatshaman: enemy('heatshaman', '열기 주술사', { walkOpt: { ...SOLDIER_WALK, dur: 0.8, armF: 4, armB: 8 }, clips: { attack: STAFF_CAST } }),
    steambomber: enemy('steambomber', '증기 돌파병', { arms: 'one', walkOpt: { dur: 0.55, leg: 24, lift: 22, bob: 12, arms: 4 }, clips: { attack: FLAME_SPRAY }, hitBone: 'arms' }),
    vladimir: enemy('vladimir', '탐욕의 폭군 블라디미르', {
        arms: 'one', legs: false, walkClip: HEAVY_GLIDE, clips: { attack: GREATSWORD_CHOP, breath: SWORD_BREATH }, hitBone: 'arms', shadow: { rx: 330, ry: 26 }
    }),
    frozenstatue: enemy('frozenstatue', '얼어붙은 병사 조각상', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: TOWER_SWAY }, hitBone: 'body', shadow: { rx: 160, ry: 14 } }),
    heatturret: enemy('heatturret', '열광선 포탑', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: SONIC_BLAST }, hitBone: 'body', shadow: { rx: 220, ry: 18 } }),
    wolfknight: enemy('wolfknight', '화염 늑대 기사', { arms: 'none', legs: false, walkClip: GALLOP, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 300, ry: 22 } }),
    // ---- 새 기획 스테이지 9 · 골드만 건설 용역 (D-085) ----
    thug: enemy('thug', '철거 용역 깡패', { walkOpt: { ...SOLDIER_WALK, armF: 10, armB: 12 }, clips: { attack: BATON_SWING } }),
    cementsprayer: enemy('cementsprayer', '시멘트 살수병', { arms: 'one', walkOpt: { ...SOLDIER_WALK, dur: 0.75, arms: 2 }, clips: { attack: FLAME_SPRAY }, hitBone: 'arms' }),
    rivetsniper: enemy('rivetsniper', '리벳 저격수', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    dynamite: enemy('dynamite', '다이너마이트 광부', { arms: 'one', walkOpt: { dur: 0.5, leg: 26, lift: 24, bob: 12, arms: 6 }, clips: { attack: MINE_PLACE }, hitBone: 'arms' }),
    safetywarden: enemy('safetywarden', '안전 감시관', { walkOpt: { ...SOLDIER_WALK, armF: 4, armB: 8 }, clips: { attack: STAFF_CAST } }),
    concretedrone: enemy('concretedrone', '콘크리트 방패 드론', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 260, ry: 20 } }),
    welderwalker: enemy('welderwalker', '용접기 워커', { arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 260, ry: 20 } }),
    wreckingcrane: enemy('wreckingcrane', '레킹볼 크레인', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: TREAD_RAM }, hitBone: 'body', shadow: { rx: 320, ry: 24 } }),
    panopticon: enemy('panopticon', '탐욕의 파노프티콘', {
        arms: 'none', legs: false, walkClip: WALKER_STRIDE, clips: { attack: TREAD_RAM, barrage: RECOIL_SHOT }, hitBone: 'body', shadow: { rx: 340, ry: 26 }
    }),
    // ---- 새 기획 스테이지 10 · 언론 통제국 & 세뇌된 진압대 (D-085) ----
    citizen: enemy('citizen', '세뇌된 시민', { walkOpt: { dur: 0.65, leg: 22, lift: 18, bob: 12, armF: 14, armB: 12 }, clips: { attack: TENTACLE_LASH } }),
    sonicshield: enemy('sonicshield', '음파 방패 경비대', { walkOpt: { ...SOLDIER_WALK, dur: 0.85, leg: 18, armF: 2, armB: 10 }, clips: { attack: SHIELD_BASH } }),
    lasersniper: enemy('lasersniper', '광선 저격 경찰', { arms: 'one', walkOpt: { ...SOLDIER_WALK, arms: 2 }, clips: { attack: RIFLE_SHOT }, hitBone: 'arms' }),
    enforcer: enemy('enforcer', '통제국 집행관', {
        walkOpt: { dur: 0.95, leg: 16, lift: 18, bob: 12, armF: 4, armB: 6 }, clips: { attack: BATON_SWING }, shadow: { rx: 240, ry: 22 }
    }),
    speakerdrone: enemy('speakerdrone', '스피커 드론', { arms: 'none', legs: false, walkClip: DRONE_HOVER, clips: { attack: DRONE_PULSE }, hitBone: 'body', shadow: { rx: 150, ry: 12 } }),
    jammer: enemy('jammer', '주파수 교란기', { arms: 'none', legs: false, walkClip: TOWER_SWAY, clips: { attack: SONIC_BLAST }, hitBone: 'body', shadow: { rx: 200, ry: 18 } }),
    woofermech: enemy('woofermech', '우퍼 메카', { arms: 'none', legs: false, walkClip: TREAD_ROLL, clips: { attack: SONIC_BLAST }, hitBone: 'body', shadow: { rx: 300, ry: 22 } }),
    mothervoice: enemy('mothervoice', '절대 발언권 마더 보이스', {
        arms: 'none', legs: false, walkClip: HEART_BEAT, clips: { attack: HEART_PULSE, laser: HEART_PULSE }, hitBone: 'body', shadow: { rx: 280, ry: 20 }
    }),
    slime: enemy('slime', '키메라 슬라임', {
        arms: 'none', legs: false, walkClip: SLIME_WALK, clips: { attack: SLIME_LUNGE }, hitBone: 'body', shadow: { rx: 200, ry: 20 }
    })
};
