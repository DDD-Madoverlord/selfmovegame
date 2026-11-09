/* ==========================================================================
   PROJECT: MAD OVERLORD // 기존 4종 A·B 세트 스킬 이펙트 정의 (v2, D-050 파츠 확장 1차)
   기획안(MD/기존캐릭터_파츠확장_기획안.md 4장)의 "이펙트" 칸을 기존 레이어(vfxPlayer.js)로 조합.
   색: 거대로봇 보라·청록 / 거대괴수 산성 초록·뼈 / 타락 히어로 보라·진홍 마력 / 합성괴인 주황·불
   ========================================================================== */

import { BEAM, CYAN, BLAST } from './mechVfx.js';
import { ACID, MOSS } from './kaijuVfx.js';

const SMOKE = '70, 60, 80';
const METAL = '60, 60, 75';
const STEAM = '200, 190, 230';
const BONE = '235, 225, 195';
const BLOOD = '180, 60, 255';   // 어둠의 서약(예전 피의 서약)·가시 독 — 12세 기준(Q-008 S6)으로 붉은색 대신 보라
const EARTH = '120, 95, 60';
const VENOM = '150, 240, 40';
const DARK = '200, 110, 255';
const SHADOW = '90, 40, 150';
const ORANGE = '255, 150, 40';
const FIRE = '255, 110, 30';
const HEAL = '120, 255, 140';

export const SET_VFX = {
    // ======== 거대로봇 A 「포격 사령부」 ========
    // 궤도 폭격 예고 (착탄 자리 마법진) → 위성 레이저 기둥 + 착탄 균열
    orbitalWarn: {
        layers: [
            { type: 'rune', at: 0, dur: 0.45, r: 46, color: BEAM, spin: 4 },
            { type: 'ring', at: 0, dur: 0.4, r: 60, ground: true, inward: true, color: CYAN, width: 2 },
            { type: 'glow', at: 0, dur: 0.45, r: 40, color: BEAM }
        ]
    },
    orbitalHit: {
        sfx: 'mech_laser_big',
        layers: [
            { type: 'pillar', at: 0, dur: 0.55, h: 520, w: 44, color: BEAM },
            { type: 'pillar', at: 0, dur: 0.28, h: 520, w: 12, color: CYAN },
            { type: 'flash', at: 0, dur: 0.2, r: 60, color: BEAM, dy: -30 },
            { type: 'shockwave', at: 0.02, dur: 0.45, r: 110, ground: true, color: CYAN, width: 24 },
            { type: 'cracks', at: 0.03, dur: 1.0, count: 6, len: 80, color: BEAM },
            { type: 'streaks', at: 0.02, count: 8, speed: 320, len: 34, life: [0.3, 0.55], angle: -Math.PI / 2, cone: 2.2, color: CYAN },
            { type: 'debris', at: 0.04, count: 6, speed: 240, size: 3, color: METAL },
            { type: 'smoke', at: 0.08, count: 5, spread: 30, spreadY: 14, size: 20, life: [0.6, 1.0], rise: 30, color: SMOKE },
            { type: 'glow', at: 0.08, dur: 1.0, r: 70, color: BEAM }
        ]
    },
    // 자동 포탑 연사 (어깨 위 총구 → 적)
    turretShot: {
        layers: [
            { type: 'beam', at: 0, dur: 0.08, w: 2.5, color: CYAN },
            { type: 'flash', at: 0, dur: 0.06, r: 8, color: CYAN },
            { type: 'flash', at: 0.01, dur: 0.08, r: 10, color: BLAST, pos: 'to' },
            { type: 'streaks', at: 0.01, count: 3, speed: 150, len: 34, life: [0.3, 0.55], angle: Math.PI, cone: 1.8, color: BLAST, pos: 'to' },
            { type: 'smoke', at: 0.03, count: 1, spread: 3, spreadY: 3, size: 7, life: [0.2, 0.35], rise: 18, color: SMOKE, pos: 'to' }
        ]
    },
    turretOn: {
        sfx: 'mech_drone_launch',
        layers: [
            { type: 'flash', at: 0, dur: 0.2, r: 26, color: CYAN },
            { type: 'ring', at: 0, dur: 0.35, r: 34, inward: true, color: CYAN, width: 3 },
            { type: 'claw', at: 0.08, dur: 0.5, count: 2, len: 26, gap: 26, angle: 0, bend: 0, color: CYAN, width: 2 },
            { type: 'glow', at: 0.08, dur: 0.6, r: 24, color: CYAN }
        ]
    },
    // 레일건 기본 공격: 청록 직선 탄도 + 꿰뚫린 자리 스파크
    railShot: {
        sfx: 'mech_laser',
        layers: [
            { type: 'beam', at: 0, dur: 0.14, w: 4, color: CYAN },
            { type: 'flash', at: 0, dur: 0.08, r: 14, color: CYAN },
            { type: 'beam', at: 0.06, dur: 0.18, w: 1.2, color: BEAM },
            { type: 'streaks', at: 0.01, count: 4, speed: 240, len: 34, life: [0.3, 0.55], angle: 0, cone: 0.6, color: CYAN, pos: 'to' },
            { type: 'smoke', at: 0.04, count: 2, spread: 4, spreadY: 4, size: 8, life: [0.25, 0.4], rise: 16, color: STEAM }
        ]
    },
    railHit: {
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 16, color: CYAN },
            { type: 'claw', at: 0, dur: 0.22, count: 1, len: 34, angle: 0, bend: 0, color: CYAN, width: 3 },
            { type: 'streaks', at: 0, count: 4, speed: 220, len: 34, life: [0.3, 0.55], angle: 0, cone: 0.8, color: CYAN },
            { type: 'smoke', at: 0.03, count: 2, spread: 5, spreadY: 5, size: 8, life: [0.25, 0.4], rise: 14, color: SMOKE }
        ]
    },
    // 충전 레일 사격: 코일 충전 빛 → 굵은 청록 광선이 전장 끝까지
    railCharge: {
        sfx: 'charge_up',
        layers: [
            { type: 'swirl', at: 0, dur: 1.0, r: 34, arms: 4, spin: 14, color: CYAN, layer: 'front' },
            { type: 'ring', at: 0, dur: 0.65, r: 46, inward: true, color: BEAM, width: 2 },
            { type: 'ring', at: 0.4, dur: 0.6, r: 34, inward: true, color: CYAN, width: 3 },
            { type: 'glow', at: 0, dur: 1.0, r: 30, color: CYAN },
            { type: 'flash', at: 0.82, dur: 0.18, r: 18, color: CYAN }
        ]
    },
    railBig: {
        sfx: 'mech_laser_big',
        layers: [
            { type: 'beam', at: 0, dur: 0.5, w: 13, color: CYAN },
            { type: 'beam', at: 0, dur: 0.35, w: 5, color: '230, 255, 255' },
            { type: 'flash', at: 0, dur: 0.18, r: 30, color: CYAN },
            { type: 'ring', at: 0, dur: 0.3, r: 40, color: CYAN, width: 4 },
            { type: 'beam', at: 0.3, dur: 0.35, w: 2, color: BEAM },
            { type: 'streaks', at: 0, count: 8, speed: 380, len: 34, life: [0.3, 0.55], angle: 0, cone: 0.45, color: CYAN },
            { type: 'smoke', at: 0.08, count: 6, spread: 12, spreadY: 10, size: 14, life: [0.4, 0.7], rise: 24, color: STEAM }
        ]
    },
    // 포격 고정: 공격 중 발밑 앵커 + 작은 먼지
    anchor: {
        layers: [
            { type: 'cracks', at: 0, dur: 0.8, count: 4, len: 34, color: CYAN },
            { type: 'ring', at: 0, dur: 0.3, r: 42, ground: true, inward: true, color: CYAN, width: 3 },
            { type: 'glow', at: 0.08, dur: 0.7, r: 32, color: CYAN },
            { type: 'smoke', at: 0, count: 3, spread: 30, spreadY: 4, size: 12, life: [0.4, 0.7], rise: 10, color: SMOKE }
        ]
    },

    // ======== 거대로봇 B 「돌격 강습대」 ========
    // 오버드라이브: 몸에서 피어오르는 보라 증기 + 눈 빛줄기
    overdrive: {
        sfx: 'charge_up',
        layers: [
            { type: 'ring', at: 0, dur: 0.18, r: 70, inward: true, color: CYAN, width: 3, dy: -70 },
            { type: 'flash', at: 0.12, dur: 0.2, r: 65, color: BEAM, dy: -70 },
            { type: 'ring', at: 0.12, dur: 0.5, r: 110, ground: true, color: BEAM, width: 5 },
            { type: 'claw', at: 0.12, dur: 0.35, count: 1, len: 80, angle: 0, bend: 0, width: 3, color: CYAN, dy: -150 },
            { type: 'smoke', at: 0.12, count: 8, spread: 40, spreadY: 40, size: 20, life: [0.8, 1.2], rise: 60, color: STEAM, dy: -40 },
            { type: 'motes', at: 0.12, count: 10, spread: 40, rise: [60, 140], life: [0.6, 1.0], size: 3, color: BEAM, dy: -40 },
            { type: 'glow', at: 0.12, dur: 0.9, r: 65, color: BEAM }
        ]
    },
    overdriveTick: {
        layers: [
            { type: 'glow', at: 0, dur: 0.4, r: 38, color: BEAM },
            { type: 'smoke', at: 0, count: 2, spread: 30, spreadY: 30, size: 14, life: [0.5, 0.8], rise: 50, color: STEAM, dy: -60 },
            { type: 'motes', at: 0, count: 3, spread: 30, rise: [40, 90], life: [0.4, 0.7], size: 2.4, color: BEAM, dy: -60 }
        ]
    },
    // 로켓 돌진: 추진 화염 꼬리 + 충돌 충격파
    rocketTrail: {
        layers: [
            { type: 'flame', at: 0, count: 2, speed: 260, angle: Math.PI, cone: 0.22, size: 7, grow: 2.6, life: [0.25, 0.4], drag: 2, rise: 10, color: BEAM },
            { type: 'claw', at: 0, dur: 0.22, count: 1, len: 60, angle: 0, bend: 0, color: CYAN, width: 3 },
            { type: 'glow', at: 0, dur: 0.25, r: 22, color: BEAM, dy: 25 }
        ]
    },
    rocketHit: {
        sfx: 'mech_fist_hit',
        layers: [
            { type: 'flash', at: 0, dur: 0.15, r: 40, color: CYAN },
            { type: 'shockwave', at: 0, dur: 0.35, r: 70, color: CYAN, width: 24 },
            { type: 'claw', at: 0, dur: 0.24, count: 1, len: 74, angle: 0, bend: 0, color: CYAN, width: 6 },
            { type: 'streaks', at: 0, count: 8, speed: 320, len: 34, life: [0.3, 0.55], angle: 0, cone: 1.0, color: CYAN },
            { type: 'debris', at: 0.02, count: 6, speed: 240, size: 3, color: METAL },
            { type: 'smoke', at: 0.04, count: 4, spread: 18, spreadY: 12, size: 14, life: [0.35, 0.6], rise: 20, color: SMOKE }
        ]
    },
    // 파일 벙커: 말뚝이 튀어나오는 섬광 + 큰 충격 고리
    pileHit: {
        sfx: 'mech_fist_hit',
        layers: [
            { type: 'flash', at: 0, dur: 0.16, r: 50, color: '230, 255, 255' },
            { type: 'beam', at: 0, dur: 0.12, w: 10, color: CYAN },
            { type: 'claw', at: 0, dur: 0.2, count: 1, len: 90, angle: 0, bend: 0, color: CYAN, width: 8 },
            { type: 'shockwave', at: 0, dur: 0.4, r: 90, color: CYAN, width: 24 },
            { type: 'shockwave', at: 0.05, dur: 0.4, r: 60, color: BEAM, width: 16 },
            { type: 'streaks', at: 0, count: 10, speed: 420, len: 34, life: [0.3, 0.55], angle: 0, cone: 0.65, color: CYAN },
            { type: 'debris', at: 0, count: 8, speed: 300, size: 3.5, color: METAL },
            { type: 'smoke', at: 0.05, count: 6, spread: 20, spreadY: 14, size: 18, life: [0.45, 0.7], rise: 24, color: SMOKE }
        ]
    },
    // 자기장 방벽: 원거리 공격을 맞을 때 청록 육각 막
    magField: {
        layers: [
            { type: 'claw', at: 0, dur: 0.32, count: 2, len: 36, gap: 62, angle: 0, bend: 0, color: CYAN, width: 3 },
            { type: 'claw', at: 0, dur: 0.32, count: 2, len: 36, gap: 62, angle: Math.PI / 3, bend: 0, color: CYAN, width: 3 },
            { type: 'claw', at: 0, dur: 0.32, count: 2, len: 36, gap: 62, angle: -Math.PI / 3, bend: 0, color: CYAN, width: 3 },
            { type: 'ring', at: 0, dur: 0.22, r: 32, inward: true, color: BEAM, width: 2 },
            { type: 'flash', at: 0, dur: 0.12, r: 22, color: CYAN }
        ]
    },

    // ======== 거대괴수 A 「가시 갑각」 ========
    // 가시 폭풍: 솟는 뼛가시 → 사방으로 날아가는 뼈 파편
    spikeStorm: {
        sfx: 'kaiju_roar',
        layers: [
            { type: 'crystals', at: 0, dur: 0.4, count: 7, h: 65, spread: 65, color: BONE, dy: -55 },
            { type: 'flash', at: 0.08, dur: 0.18, r: 60, color: BONE, dy: -60 },
            { type: 'debris', at: 0.08, count: 24, speed: 480, size: 4, angle: -Math.PI / 2, cone: 4.8, color: BONE, dy: -60 },
            { type: 'streaks', at: 0.08, count: 8, speed: 400, len: 34, life: [0.3, 0.55], color: BONE, dy: -60 },
            { type: 'ring', at: 0.08, dur: 0.55, r: 230, ground: true, color: ACID, width: 6 },
            { type: 'smoke', at: 0.15, count: 6, spread: 60, spreadY: 10, size: 18, life: [0.5, 0.8], rise: 15, color: MOSS },
            { type: 'glow', at: 0.08, dur: 1.0, r: 100, color: ACID }
        ]
    },
    bleedTick: {
        layers: [
            { type: 'ring', at: 0, dur: 0.3, r: 12, inward: true, color: DARK, width: 1.5, dy: -15 },
            { type: 'motes', at: 0, count: 3, spread: 8, rise: [18, 35], life: [0.35, 0.55], size: 1.8, color: BLOOD, dy: -15 }
        ]
    },
    // 가시 갑옷: 몸에 돋는 가시 + 맞을 때 가시 튐
    thornOn: {
        sfx: 'shield_on',
        layers: [
            { type: 'ring', at: 0, dur: 0.25, r: 75, inward: true, color: ACID, width: 3, dy: -60 },
            // D-118: 바닥에서 솟던 결정 가시(crystals)는 뺌 — 가시는 등껍질에 붙음 (skills_v2.js thornArmor THORN_BACK)
            { type: 'flash', at: 0.08, dur: 0.12, r: 28, color: BONE, dy: -60 },
            { type: 'motes', at: 0.1, count: 8, spread: 45, rise: [20, 45], life: [0.5, 0.8], size: 2, color: ACID, dy: -45 },
            { type: 'glow', at: 0.08, dur: 0.8, r: 70, color: ACID }
        ]
    },
    thornReflect: {
        layers: [
            { type: 'claw', at: 0, dur: 0.22, count: 2, len: 30, gap: 9, angle: -0.25, bend: 0, color: BONE, width: 3 },
            { type: 'debris', at: 0, count: 3, speed: 140, size: 2.4, angle: -0.4, cone: 1.2, color: BONE },
            { type: 'flash', at: 0, dur: 0.08, r: 12, color: BONE }
        ]
    },
    // 지면 내려찍기: 바닥 균열 + 흙먼지 파도
    groundSlam: {
        sfx: 'chimera_slam',
        layers: [
            { type: 'cracks', at: 0, dur: 1.1, count: 8, len: 140, color: ACID },
            { type: 'flash', at: 0, dur: 0.14, r: 40, color: BONE, dy: -10 },
            { type: 'shockwave', at: 0, dur: 0.5, r: 180, ground: true, color: EARTH, width: 32 },
            { type: 'shockwave', at: 0.06, dur: 0.4, r: 100, ground: true, color: ACID, width: 14 },
            { type: 'dust', at: 0.04, count: 6, speed: 160, dir: 'both', size: 24, life: 1.0, color: EARTH, dy: 0 },
            { type: 'shards', at: 0, count: 10, speed: 320, size: 7.2, spin: 7, life: [0.7, 1.1], shape: 'rock', floor: 0, color: EARTH },
            { type: 'glow', at: 0.08, dur: 0.65, r: 65, color: ACID }
        ]
    },
    // 단단한 껍질: 맞을 때 초록 껍질 조각
    shellChip: {
        layers: [
            { type: 'shards', at: 0, count: 4, speed: 180, size: 5.8, spin: 7, life: [0.7, 1.1], shape: 'shell', floor: 50, color: '120, 170, 60' },
            { type: 'flash', at: 0, dur: 0.08, r: 12, color: BONE },
            { type: 'ring', at: 0.02, dur: 0.22, r: 18, color: ACID, width: 2 }
        ]
    },

    // ======== 거대괴수 B 「독안개」 ========
    // 독안개 숨결 / 산성 웅덩이: 구름 퍼프 (구역 안 여러 곳에서 계속)
    toxicPuff: {
        layers: [
            { type: 'glow', at: 0, dur: 0.8, r: 36, color: MOSS },
            { type: 'mist', at: 0, r: 58, h: 14, life: 1.2, drift: 14, color: VENOM, dy: 0 },
            { type: 'goo', at: 0.08, count: 3, speed: 44, size: 4.3, angle: -Math.PI / 2, cone: 1.6, life: [0.8, 1.15], splat: true, floor: 0, color: ACID }
        ]
    },
    toxicBreath: {
        sfx: 'kaiju_spore',
        layers: [
            { type: 'ring', at: 0, dur: 0.6, r: 130, ground: true, color: MOSS, width: 5 },
            { type: 'mist', at: 0, r: 134, h: 17, life: 1.6, drift: 14, color: VENOM, dy: 0 },
            { type: 'mist', at: 0.15, r: 158, h: 19, life: 1.4, drift: 14, color: MOSS, dy: 0 },
            { type: 'goo', at: 0.05, count: 4, speed: 72, size: 6.6, angle: -Math.PI / 2, cone: 2.2, life: [0.8, 1.15], splat: true, floor: 0, color: ACID },
            { type: 'glow', at: 0, dur: 1.2, r: 120, color: ACID }
        ]
    },
    // 독 포자 폭발: 터지는 독주머니 + 포자 구름
    sporeBurst: {
        sfx: 'kaiju_egg_hatch',
        layers: [
            { type: 'ring', at: 0, dur: 0.16, r: 50, inward: true, color: ACID, width: 4, dy: -50 },
            { type: 'flash', at: 0.1, dur: 0.18, r: 50, color: VENOM, dy: -50 },
            { type: 'ring', at: 0.1, dur: 0.45, r: 140, ground: true, color: ACID, width: 5 },
            { type: 'goo', at: 0.1, count: 6, speed: 176, size: 6.6, life: [0.8, 1.15], splat: true, floor: 50, color: ACID, dy: -50 },
            { type: 'mist', at: 0.15, r: 106, h: 13, life: 1.3, drift: 14, color: VENOM, dy: 0 },
            { type: 'motes', at: 0.2, count: 6, spread: 80, rise: [25, 60], life: [0.6, 1.0], size: 2.5, color: ACID },
            { type: 'glow', at: 0.15, dur: 0.9, r: 80, color: MOSS }
        ]
    },
    // 산성 침: 포물선 방울이 떨어진 자리
    spitSplash: {
        sfx: 'kaiju_bite',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 18, color: ACID },
            { type: 'ring', at: 0, dur: 0.35, r: 40, ground: true, color: ACID, width: 4 },
            { type: 'goo', at: 0, count: 6, speed: 120, size: 5.8, angle: -Math.PI / 2, cone: 2.4, life: [0.8, 1.15], splat: true, floor: 0, color: ACID },
            { type: 'mist', at: 0.08, r: 26, h: 8, life: 0.8, drift: 14, color: VENOM, dy: 0 },
            { type: 'glow', at: 0, dur: 1.6, r: 30, color: ACID }
        ]
    },
    // 질주 본능: 달릴 때 뒤로 날리는 초록 잔상
    sprintTrail: {
        layers: [
            { type: 'claw', at: 0, dur: 0.28, count: 2, len: 55, gap: 14, angle: 0, bend: 5, color: ACID, width: 2, dy: -35 },
            { type: 'streaks', at: 0, count: 3, speed: 150, len: 34, life: [0.3, 0.55], angle: Math.PI, cone: 0.25, color: ACID, dy: -30 },
            { type: 'smoke', at: 0, count: 1, spread: 20, spreadY: 8, size: 14, life: [0.3, 0.5], rise: 5, color: MOSS }
        ]
    },

    // ======== 타락 히어로 A 「타락 기사」 ========
    // 심판의 일격: 떨어지는 보라 대검 + 충격파
    judgmentWarn: {
        layers: [
            { type: 'rune', at: 0, dur: 0.5, r: 100, color: DARK, spin: 3 },
            { type: 'ring', at: 0, dur: 0.5, r: 120, ground: true, inward: true, color: BLOOD, width: 3 },
            { type: 'claw', at: 0.2, dur: 0.3, count: 1, len: 54, angle: 0, bend: 0, color: DARK, width: 3 },
            { type: 'glow', at: 0, dur: 0.5, r: 90, color: DARK }
        ]
    },
    judgmentHit: {
        sfx: 'hero_curse_nova',
        layers: [
            { type: 'slash', at: 0, dur: 0.4, r: 105, arc: 2.5, angle: 1.3, width: 28, sweep: 0.12, thick: 1.2, color: DARK, dy: -75 },
            { type: 'pillar', at: 0, dur: 0.5, h: 260, w: 12, color: DARK },
            { type: 'claw', at: 0, dur: 0.4, count: 1, len: 230, angle: Math.PI / 2, bend: 0, color: DARK, width: 18, dy: -132 },
            { type: 'claw', at: 0, dur: 0.35, count: 1, len: 90, angle: 0, bend: 0, color: DARK, width: 9, dy: -210 },
            { type: 'flash', at: 0.02, dur: 0.2, r: 85, color: DARK, dy: -20 },
            { type: 'shockwave', at: 0.02, dur: 0.5, r: 180, ground: true, color: DARK, width: 28 },
            { type: 'cracks', at: 0.02, dur: 1.3, count: 9, len: 150, color: DARK },
            { type: 'streaks', at: 0.02, count: 10, speed: 340, len: 34, life: [0.3, 0.55], angle: -Math.PI / 2, cone: 2.4, color: DARK },
            { type: 'debris', at: 0.04, count: 8, speed: 280, size: 3.5, color: SHADOW },
            { type: 'smoke', at: 0.1, count: 6, spread: 65, spreadY: 20, size: 26, life: [0.8, 1.2], rise: 25, color: SHADOW },
            { type: 'glow', at: 0.1, dur: 1.1, r: 95, color: DARK }
        ]
    },
    // 어둠의 서약: 모여들었다 피어나는 보라 마력 (피 표현 없음)
    bloodOn: {
        sfx: 'shield_on',
        layers: [
            { type: 'ring', at: 0, dur: 0.25, r: 80, inward: true, color: BLOOD, width: 4, dy: -70 },
            { type: 'flash', at: 0.18, dur: 0.14, r: 30, color: BLOOD, dy: -70 },
            { type: 'rune', at: 0.18, dur: 0.75, r: 65, color: BLOOD, spin: -2 },
            { type: 'motes', at: 0.18, count: 14, spread: 45, rise: [50, 100], life: [0.7, 1.1], size: 2.5, color: BLOOD, dy: -40 },
            { type: 'glow', at: 0.18, dur: 0.9, r: 65, color: DARK }
        ]
    },
    bloodDrain: {
        layers: [
            { type: 'ring', at: 0, dur: 0.3, r: 18, inward: true, color: BLOOD, width: 1.5 },
            { type: 'motes', at: 0, count: 4, spread: 12, rise: [30, 65], life: [0.4, 0.6], size: 2.2, color: BLOOD }
        ]
    },
    // 회전 베기: 원형 보라 칼자국 (한 바퀴마다)
    whirl: {
        sfx: 'hero_slash_hit',
        layers: [
            { type: 'slash', at: 0, dur: 0.35, r: 187, arc: 2.7, sweep: 0.12, thick: 1, angle: 0.15, color: DARK, width: 14 },
            { type: 'slash', at: 0.07, dur: 0.35, r: 187, arc: 2.7, sweep: 0.12, thick: 1, angle: 3.3, color: DARK, width: 14 },
            { type: 'ring', at: 0.03, dur: 0.4, r: 110, color: DARK, width: 2 },
            { type: 'flash', at: 0, dur: 0.1, r: 20, color: DARK },
            { type: 'motes', at: 0.1, count: 6, spread: 85, rise: [10, 30], life: [0.3, 0.5], size: 2, color: DARK },
            { type: 'smoke', at: 0.1, count: 3, spread: 65, spreadY: 12, size: 16, life: [0.3, 0.5], rise: 12, color: SHADOW }
        ]
    },
    // 불굴: 발동 중 몸 주변 보라 방패 빛
    indomitable: {
        layers: [
            { type: 'claw', at: 0, dur: 0.65, count: 1, len: 120, angle: Math.PI / 2, bend: 65, width: 5, color: DARK, dy: -65 },
            { type: 'claw', at: 0, dur: 0.65, count: 1, len: 120, angle: -Math.PI / 2, bend: 65, width: 5, color: DARK, dy: -65 },
            { type: 'ring', at: 0.04, dur: 0.55, r: 55, ground: true, color: DARK, width: 2 },
            { type: 'glow', at: 0, dur: 0.7, r: 55, color: DARK }
        ]
    },

    // ======== 타락 히어로 B 「그림자 마도사」 ========
    clonePoof: {
        layers: [
            { type: 'smoke', at: 0, count: 6, spread: 25, spreadY: 60, size: 22, life: [0.6, 1.0], rise: 35, color: SHADOW, dy: -45 },
            { type: 'flash', at: 0, dur: 0.12, r: 30, color: DARK, dy: -60 },
            { type: 'ring', at: 0, dur: 0.4, r: 40, ground: true, inward: true, color: DARK, width: 3 },
            { type: 'motes', at: 0.08, count: 2, spread: 18, rise: [40, 65], life: [0.45, 0.7], size: 2.5, color: DARK, dy: -40 }
        ]
    },
    // 저주의 사슬: 땅에서 솟는 보라 사슬 (대상마다)
    chainBind: {
        sfx: 'hero_curse_tick',
        layers: [
            { type: 'rune', at: 0, dur: 0.7, r: 30, color: DARK, spin: 3 },
            { type: 'claw', at: 0.04, dur: 0.6, count: 2, len: 85, gap: 28, angle: -Math.PI / 2, bend: 15, color: DARK, width: 3, dy: -40 },
            { type: 'ring', at: 0.04, dur: 0.6, r: 24, ground: true, inward: true, color: DARK, width: 3, dy: -18 },
            { type: 'ring', at: 0.1, dur: 0.6, r: 22, ground: true, inward: true, color: DARK, width: 3, dy: -42 },
            { type: 'ring', at: 0.16, dur: 0.6, r: 20, ground: true, inward: true, color: DARK, width: 3, dy: -66 },
            { type: 'glow', at: 0.08, dur: 0.7, r: 28, color: SHADOW }
        ]
    },
    chainTick: {
        layers: [
            { type: 'ring', at: 0, dur: 0.35, r: 16, ground: true, inward: true, color: DARK, width: 2, dy: -12 },
            { type: 'chevrons', at: 0, count: 2, spread: 8, fall: 20, life: [0.4, 0.6], size: 4, color: DARK, dy: -30 }
        ]
    },
    // 암흑 구체 기본 공격 폭발 (작은 범위)
    orbBlast: {
        sfx: 'hero_wave_hit',
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 22, color: DARK },
            { type: 'ring', at: 0, dur: 0.3, r: 46, color: DARK, width: 4 },
            { type: 'smoke', at: 0.03, count: 3, spread: 14, spreadY: 14, size: 14, life: [0.35, 0.55], rise: 20, color: SHADOW },
            { type: 'motes', at: 0.03, count: 5, spread: 20, rise: [20, 45], life: [0.3, 0.5], size: 2, color: DARK }
        ]
    },
    // 블랙홀: 빨려드는 소용돌이 (0.5초마다 다시 그림)
    blackHole: {
        layers: [
            { type: 'swirl', at: 0, dur: 0.6, r: 90, arms: 5, spin: 10, color: DARK },
            { type: 'ring', at: 0, dur: 0.55, r: 90, inward: true, color: DARK, width: 3 },
            { type: 'ring', at: 0.2, dur: 0.4, r: 65, inward: true, color: SHADOW, width: 2 },
            { type: 'glow', at: 0, dur: 0.6, r: 65, color: SHADOW, dy: 50 },
            { type: 'smoke', at: 0, count: 2, spread: 1, spreadY: 1, size: 20, life: [0.5, 0.6], rise: 1, color: '20, 0, 40' }
        ]
    },
    blackHoleEnd: {
        sfx: 'hero_curse_nova',
        layers: [
            { type: 'ring', at: 0, dur: 0.16, r: 90, inward: true, color: DARK, width: 4 },
            { type: 'flash', at: 0.1, dur: 0.16, r: 55, color: DARK },
            { type: 'ring', at: 0.1, dur: 0.45, r: 120, color: DARK, width: 5 },
            { type: 'smoke', at: 0.14, count: 4, spread: 30, spreadY: 20, size: 20, life: [0.5, 0.8], rise: 20, color: SHADOW },
            { type: 'motes', at: 0.14, count: 6, spread: 55, rise: [25, 60], life: [0.45, 0.75], size: 2.5, color: DARK }
        ]
    },
    // 그림자 회피: 몸이 흐려지며 잔상
    dodge: {
        layers: [
            { type: 'claw', at: 0, dur: 0.28, count: 2, len: 60, gap: 20, angle: -0.2, bend: 10, color: DARK, width: 2, dy: -65 },
            { type: 'smoke', at: 0, count: 3, spread: 20, spreadY: 40, size: 18, life: [0.35, 0.55], rise: 25, color: SHADOW, dy: -50 },
            { type: 'ring', at: 0, dur: 0.3, r: 32, ground: true, color: SHADOW, width: 2 }
        ]
    },

    // ======== 합성괴인 A 「광폭 실험체」 ========
    // 광견 돌진: 주황 돌진 궤적
    maulTrail: {
        layers: [
            { type: 'smoke', at: 0, count: 2, spread: 14, spreadY: 10, size: 16, life: [0.3, 0.5], rise: 10, color: EARTH },
            { type: 'claw', at: 0, dur: 0.24, count: 2, len: 58, gap: 14, angle: 0, bend: 4, color: ORANGE, width: 2, dy: -15 },
            { type: 'debris', at: 0, count: 3, speed: 120, angle: -2.7, cone: 0.6, size: 2.2, color: EARTH }
        ]
    },
    maulHit: {
        sfx: 'chimera_slam',
        layers: [
            { type: 'flash', at: 0, dur: 0.12, r: 34, color: ORANGE },
            { type: 'ring', at: 0, dur: 0.3, r: 54, color: ORANGE, width: 5 },
            { type: 'claw', at: 0, dur: 0.24, count: 2, len: 55, gap: 14, angle: -0.5, bend: 12, color: ORANGE, width: 5 },
            { type: 'debris', at: 0.02, count: 6, speed: 230, angle: -0.6, cone: 1.2, size: 3, color: EARTH },
            { type: 'smoke', at: 0.04, count: 4, spread: 18, spreadY: 12, size: 16, life: [0.35, 0.6], rise: 18, color: EARTH }
        ]
    },
    // 아드레날린: 모여드는 주황 기운 → 몸에서 솟는 김
    adrenaline: {
        sfx: 'chimera_phase2',
        layers: [
            { type: 'ring', at: 0, dur: 0.22, r: 75, inward: true, color: ORANGE, width: 4, dy: -60 },
            { type: 'flash', at: 0.14, dur: 0.14, r: 32, color: ORANGE, dy: -60 },
            { type: 'ring', at: 0.14, dur: 0.45, r: 85, ground: true, color: ORANGE, width: 4 },
            { type: 'smoke', at: 0.14, count: 8, spread: 35, spreadY: 40, size: 20, life: [0.8, 1.2], rise: 60, color: STEAM, dy: -40 },
            { type: 'motes', at: 0.14, count: 10, spread: 35, rise: [50, 110], life: [0.6, 1.0], size: 2.5, color: ORANGE, dy: -40 },
            { type: 'glow', at: 0.14, dur: 0.85, r: 60, color: ORANGE }
        ]
    },
    // 대지 강타: 큰 균열 + 바위 파편
    earthSmash: {
        sfx: 'chimera_slam',
        layers: [
            { type: 'cracks', at: 0, dur: 1.3, count: 10, len: 200, color: ORANGE },
            { type: 'shockwave', at: 0, dur: 0.55, r: 240, ground: true, color: ORANGE, width: 36 },
            { type: 'flash', at: 0, dur: 0.2, r: 60, color: ORANGE, dy: -20 },
            { type: 'shockwave', at: 0.08, dur: 0.5, r: 170, ground: true, color: BONE, width: 14 },
            { type: 'shards', at: 0, count: 10, speed: 420, size: 9.0, spin: 7, life: [0.7, 1.1], shape: 'rock', floor: 0, color: EARTH },
            { type: 'dust', at: 0.05, count: 6, speed: 184, dir: 'both', size: 26, life: 1.2, color: EARTH, dy: 0 },
            { type: 'glow', at: 0.08, dur: 0.85, r: 100, color: ORANGE }
        ]
    },
    // 짓밟기: 발밑 주황 충격 고리
    stomp: {
        layers: [
            { type: 'shockwave', at: 0, dur: 0.35, r: 70, ground: true, color: ORANGE, width: 16 },
            { type: 'flash', at: 0, dur: 0.08, r: 16, color: BONE },
            { type: 'shards', at: 0, count: 2, speed: 150, size: 4.7, spin: 7, life: [0.7, 1.1], shape: 'rock', floor: 0, color: EARTH },
            { type: 'dust', at: 0.03, count: 2, speed: 90, dir: 'both', size: 12, life: 0.45, color: EARTH, dy: 0 }
        ]
    },

    // ======== 합성괴인 B 「조직 사령관」 ========
    // 총동원령: 소환진 (졸개마다는 CHIMERA_VFX.summon)
    mobilize: {
        sfx: 'chimera_summon',
        layers: [
            { type: 'rune', at: 0, dur: 0.9, r: 110, color: ORANGE, spin: 3 },
            { type: 'ring', at: 0, dur: 0.3, r: 150, ground: true, inward: true, color: HEAL, width: 3 },
            { type: 'pillar', at: 0.18, dur: 0.6, h: 120, w: 24, color: ORANGE },
            { type: 'flash', at: 0.18, dur: 0.15, r: 35, color: ORANGE },
            { type: 'ring', at: 0.18, dur: 0.6, r: 180, ground: true, color: ORANGE, width: 5 },
            { type: 'glow', at: 0.18, dur: 1.0, r: 100, color: ORANGE }
        ]
    },
    // 강화 주사: 졸개마다 초록 회복 빛
    boostShot: {
        sfx: 'kaiju_regen',
        layers: [
            { type: 'motes', at: 0, count: 8, spread: 18, rise: [40, 90], life: [0.6, 0.9], size: 2.8, color: HEAL, dy: -20 },
            { type: 'ring', at: 0, dur: 0.4, r: 30, ground: true, inward: true, color: HEAL, width: 3 },
            { type: 'claw', at: 0.08, dur: 0.45, count: 1, len: 18, angle: 0, bend: 0, color: HEAL, width: 3, dy: -35 },
            { type: 'claw', at: 0.08, dur: 0.45, count: 1, len: 18, angle: Math.PI / 2, bend: 0, color: HEAL, width: 3, dy: -35 },
            { type: 'glow', at: 0.05, dur: 0.65, r: 24, color: HEAL }
        ]
    },
    // 산탄: 총구의 부채꼴 섬광 / 맞은 적
    shotgunBlast: {
        sfx: 'mech_missile_blast',
        layers: [
            { type: 'flash', at: 0, dur: 0.1, r: 22, color: FIRE },
            { type: 'claw', at: 0, dur: 0.12, count: 1, len: 42, angle: 0, bend: 0, color: FIRE, width: 7 },
            { type: 'streaks', at: 0, count: 8, speed: 420, len: 34, life: [0.3, 0.55], angle: 0, cone: 0.7, color: '255, 200, 120' },
            { type: 'embers', at: 0.02, count: 3, speed: 160, angle: 0, cone: 0.7, size: 1.2, life: [0.3, 0.5], rise: 15 },
            { type: 'smoke', at: 0.02, count: 2, spread: 8, spreadY: 8, size: 12, life: [0.3, 0.6], rise: 20, color: SMOKE }
        ]
    },
    pellet: {
        layers: [
            { type: 'flash', at: 0, dur: 0.08, r: 12, color: FIRE },
            { type: 'streaks', at: 0, count: 2, speed: 140, len: 34, life: [0.3, 0.55], angle: Math.PI, cone: 1.8, color: '255, 200, 120' },
            { type: 'smoke', at: 0.02, count: 2, spread: 4, spreadY: 4, size: 6, life: [0.2, 0.35], rise: 14, color: SMOKE }
        ]
    },
    // 화염 방사: 가는 입구 → 굵어지며 식는 불줄기 (0.1~0.12초마다 이어 재생)
    flame: {
        layers: [
            { type: 'flame', at: 0, count: 1, speed: 90, angle: 0, cone: 0.05, size: 8, grow: 1.6, life: [0.14, 0.18], drag: 2, rise: 30, smoke: false, color: FIRE },
            { type: 'flame', at: 0, count: 2, speed: 560, angle: 0, cone: 0.14, size: 12, grow: 4, life: [0.6, 0.68], drag: 1.8, rise: 55, color: FIRE },
            { type: 'flame', at: 0.04, count: 2, speed: 560, angle: 0, cone: 0.14, size: 12, grow: 4, life: [0.6, 0.68], drag: 1.8, rise: 55, color: FIRE },
            { type: 'flame', at: 0.08, count: 2, speed: 560, angle: 0, cone: 0.14, size: 12, grow: 4, life: [0.6, 0.68], drag: 1.8, rise: 55, color: FIRE },
            { type: 'embers', at: 0.04, count: 2, speed: 330, angle: -0.12, cone: 0.5, size: 1.3, life: [0.5, 0.8], drag: 1.4, rise: 40 }
        ]
    },
    flameTick: {
        layers: [
            { type: 'flame', at: 0, count: 3, speed: 50, angle: -Math.PI / 2, cone: 1.0, size: 7, grow: 2.5, life: [0.4, 0.65], drag: 1.0, rise: 120, color: FIRE },
            { type: 'flame', at: 0.06, count: 2, speed: 65, angle: -Math.PI / 2, cone: 0.7, size: 5, grow: 2.0, life: [0.35, 0.55], drag: 1.0, rise: 130, color: FIRE },
            { type: 'embers', at: 0.02, count: 2, speed: 65, size: 1.2, life: [0.4, 0.7], rise: 50 }
        ]
    }
};
