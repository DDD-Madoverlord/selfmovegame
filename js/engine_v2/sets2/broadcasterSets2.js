/* ==========================================================================
   PROJECT: MAD OVERLORD // 침묵의 방송자 — 기본·강화 파츠 8개 + 세트 9개 (새 캐릭터 6, D-079 — MD/새캐릭터2종_설계안.md 2~4장)
   기본·강화 파츠도 부품 스킬(skillKit_v2.js)로: 기본 공격 공명 음파 · 공명 파열 · 정적의 장막(분홍 반구 = 그림 있는 장판 + 침묵) · 긴급 방송 · 잡음 차단
   침묵(status silence, battle/kit.js) = 원거리·치유·특수 공격·보스 기술을 못 씀 (enemies_v2.js updateEnemy)
   레어 ① 거리 버스커(a) · ② 해적 방송 DJ(b) · ③ 전파 탐지 기사(c) · ④ 확성기 시위대(d) · 유니크 ① 심야 라디오의 유령(u) · ② 거대 스피커 탑(v)
   · ③ 전파 해커(w) · 레전더리 ① 최후의 생방송(l) · ② 정적의 여제(m)
   세트 그림은 강화 그림 + 세트 색. 동작은 rig/broadcasterRig.js (cast·blast·throw). 대표 시트는 vfxPlayer.js VFX_SHEETS (Gemini 전엔 임시)
   ========================================================================== */

import { packOf, basePackOf, V } from './common.js';

const WAVE = '255, 80, 170', PURPLE = '190, 110, 255', GREEN = '120, 255, 160', CYAN = '90, 230, 255', GOLD = '255, 210, 110', SILVER = '225, 215, 245';
const DOME = { cls: 'is-dome', w: 260, h: 150 };   // 정적의 장막 그림 (ui_v2.css)

// ---- 기본·강화 파츠 (같은 스킬, 강화는 능력치·그림) ----
const SONIC = { kind: 'pierce', n: 3, decay: 0.6,   // 밸런스 1차(10-24): 0.75 → 0.6
    vfx: V.beam(WAVE, 12), hitVfx: V.sheet('sonic_pink', 80, { dur: 0.35 }) };
export const BROADCASTER_BASE = basePackOf('broadcaster', {
    head: [
        { id: 'head_broadcaster', name: '안테나 헤드폰', cost: 400, src: 'head.png', stats: { hp: 550, dps: 80, range: 30, speed: 10 }, skill: 'bcEmergency',
            desc: '필살기 긴급 방송: 화면 적 4초 침묵 + 음파 폭발 3번' },
        { id: 'head_broadcaster_up', name: '바이저 헤드셋', cost: 950, src: 'head_up.png', stats: { hp: 750, dps: 110, range: 40, speed: 10 }, skill: 'bcEmergency', up: true,
            desc: '긴급 방송 (강화 헤드셋: 분홍 바이저)' }
    ],
    body: [
        { id: 'body_broadcaster', name: '파형 롱코트', cost: 450, src: 'torso.png', stats: { hp: 1300, dps: 60, range: 0, speed: 10 }, skill: 'bcDome',
            desc: '정적의 장막: 앞에 분홍 반구 6초 — 안의 적 침묵 + 투사체 막음' },
        { id: 'body_broadcaster_up', name: '스피커 코트', cost: 1000, src: 'torso_up.png', stats: { hp: 1700, dps: 90, range: 0, speed: 10 }, skill: 'bcDome', up: true,
            desc: '정적의 장막 (강화 코트: 가슴 스피커)' }
    ],
    arm: [
        { id: 'arm_broadcaster', name: '분홍 소리굽쇠', cost: 500, src: 'armF.png', stats: { hp: 300, dps: 370, range: 280, speed: 0 }, skill: 'bcBurst', kitAttack: SONIC,
            desc: '기본 공격 공명 음파 (앞 적 셋 관통) · 공명 파열' },
        { id: 'arm_broadcaster_up', name: '소리굽쇠 장치·스피커 대포', cost: 1100, src: 'armF_up.png', stats: { hp: 400, dps: 450, range: 310, speed: 0 }, skill: 'bcBurst', kitAttack: SONIC, up: true,
            desc: '큰 소리굽쇠 장치 · 공명 파열' }
    ],
    leg: [
        { id: 'leg_broadcaster', name: '운동화', cost: 400, src: 'legF.png', stats: { hp: 550, dps: 40, range: 0, speed: 90 },
            desc: '잡음 차단: 침묵한 적에게 주는 피해 +20%',
            passive: { name: '잡음 차단', desc: '침묵한 적에게 주는 피해 +20%', target: [{ when: 'status', status: 'silence', dmg: 0.2 }] } },
        { id: 'leg_broadcaster_up', name: '스피커 부츠', cost: 950, src: 'legF_up.png', stats: { hp: 750, dps: 60, range: 0, speed: 105 }, up: true,
            desc: '잡음 차단 (강화): 침묵한 적에게 주는 피해 +30%',
            passive: { name: '잡음 차단 (강화)', desc: '침묵한 적에게 주는 피해 +30%', target: [{ when: 'status', status: 'silence', dmg: 0.3 }] } }
    ]
}, {
    bcBurst: { name: '공명 파열', slot: 'arm', cd: 9, icon: 'fork', color: '#ff50aa', target: 'enemy', range: 120, clip: 'cast', sfx: 'bc_burst',
        desc: '소리굽쇠를 울려 음파 고리 3겹이 앞으로 — 지나간 적 피해 + 0.8초 기절',
        steps: [{ at: 0.45, do: 'wave', speed: 520, dist: 380, w: 55, dmg: 1.1, status: { stun: 0.8 }, every: 0, vfx: V.sheet('sonic_pink', 110, { dur: 0.3 }), vfxEvery: 0.08, b: 130, repeat: 3, repeatGap: 0.18 }] },
    // 장막은 바닥에 서서 걸을 때 함께 흘러감 → 적이 앞에 있을 때만 씀 (target enemy)
    bcDome: { name: '정적의 장막', slot: 'body', cd: 15, icon: 'mute', color: '#ff50aa', target: 'enemy', range: 60, clip: 'cast', sfx: 'bc_dome',
        desc: '앞에 분홍 반구 장막 6초 — 안의 적 침묵(원거리·치유·기술 못 씀) + 투사체 막음',
        steps: [{ at: 0.45, do: 'zone', tag: 'dome', x: 20, w: 260, sec: 6, status: { silence: 1.2 }, every: 1, art: DOME, puff: V.motes(WAVE, 4), puffEvery: 0.4, puffB: 80 },
            { at: 0.45, do: 'buff', key: 'dome', sec: 6, mods: { flags: ['projBlock'] } }, { at: 0.45, do: 'fx', x: 150, vfx: V.sheet('silence_dome', 280, { anchorY: 0.95, dur: 0.7 }) }] },
    bcEmergency: { name: '긴급 방송', slot: 'head', ult: true, cd: 0, icon: 'speaker', color: '#ff50aa', target: 'enemy', range: 600, clip: 'cast', sfx: 'bc_emergency',
        desc: '도시 스피커를 장악 — 화면 적 4초 침묵 + 음파 폭발 3번',
        steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0, status: { silence: 4 }, vfx: V.motes(WAVE, 8), maxFx: 10 },
            { at: 0.45, do: 'screen', dmg: 1, vfx: V.sheet('emergency_broadcast', 150, { dur: 0.5 }), maxFx: 6, repeat: 3, repeatGap: 0.45 },
            { at: 0.45, do: 'shake', power: 5, ms: 200, repeat: 3, repeatGap: 0.45 }] }
});

// ---- 세트 9개 ----
export const BROADCASTER_SETS2 = packOf('broadcaster', [
    // ---- 레어 ① 거리 버스커 (지원) ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '거리 버스커', style: 'support', tint: 'hue-rotate(25deg) saturate(1.3) brightness(1.1)',
        bonus: { 4: '앵콜 공연 +3초' },
        kit: { 4: { patch: { bcEncore: { sec: 3 } } } },
        head: { name: '버스커 모자', look: '깃털 꽂은 중절모와 작은 마이크', skill: 'bcEncore', desc: '필살기 앵콜 공연: 8초 노래 — 나 초당 2% 회복, 적 느려짐' },
        body: { name: '앰프 배낭', look: '등에 멘 작은 기타 앰프', skill: 'bcVolumeUp', desc: '볼륨 업: 6초 피해 +30%, 스킬 쿨다운 1.5배 빨리' },
        arm: { name: '기타 넥 팔', look: '기타 넥 모양 팔', skill: 'bcPowerChord', desc: '파워 코드: 앞 음파 충격 — 피해 + 밀어냄', kitAttack: SONIC },
        leg: { name: '스텝 부츠', look: '리듬 타는 굽 부츠', desc: '리듬 스텝: 걷는 동안 받는 피해 -15%',
            passive: { name: '리듬 스텝', desc: '걷는 동안 받는 피해 -15%', self: [{ when: 'walking', mods: { def: 0.15 } }] } },
        skills: {
            bcEncore: { name: '앵콜 공연', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#ffaa64', target: 'self', clip: 'cast', p: { sec: 8 },
                desc: '8초간 노래 — 나 초당 2% 회복, 화면 적 느려짐',
                steps: [{ at: 0.45, do: 'buff', key: 'encore', sec: '$sec', mods: { regen: 0.02 } },
                    { at: 0.45, do: 'zone', tag: 'encore', x: -200, w: 820, sec: '$sec', slow: true, puff: V.sheet('encore_notes', 120, { dur: 0.6 }), puffEvery: 0.25, puffB: 130 }] },
            bcVolumeUp: { name: '볼륨 업', slot: 'body', cd: 13, icon: 'speaker', color: '#ffaa64', target: 'self', clip: 'cast',
                desc: '6초 주는 피해 +30%, 스킬 쿨다운 1.5배 빨리',
                steps: [{ do: 'buff', key: 'volumeUp', sec: 6, mods: { dmg: 0.3, cdRate: 0.5 }, vfx: V.ring(WAVE, 160) }] },
            bcPowerChord: { name: '파워 코드', slot: 'arm', cd: 8, icon: 'wave', color: '#ffaa64', target: 'enemy', range: 220, clip: 'blast',
                desc: '앞으로 음파 충격 — 피해 + 밀어냄',
                steps: [{ at: 0.36, do: 'push', range: 240, dist: 110, dmg: 1.8 }, { at: 0.36, do: 'fx', x: 40, b: 130, vfx: V.ring(WAVE, 200) }] }
        }
    },

    // ---- 레어 ② 해적 방송 DJ (공격) ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '해적 방송 DJ', style: 'dps', tint: 'hue-rotate(-50deg) saturate(1.5) brightness(0.95)',
        bonus: { 4: '비트 드롭 +2번' },
        kit: { 4: { patch: { bcBeatDrop: { count: 2 } } } },
        head: { name: 'DJ 헤드셋', look: '보랏빛 대형 DJ 헤드셋', skill: 'bcBeatDrop', desc: '필살기 비트 드롭: 베이스 폭발 6번' },
        body: { name: '턴테이블 조끼', look: '가슴에 턴테이블', skill: 'bcScratch', desc: '스크래치: 앞 적 4초 약화 (주는 피해 -40%)' },
        arm: { name: '레코드 원반 팔', look: '레코드판을 쥔 팔', skill: 'bcRecordThrow', desc: '레코드 투척: 회전 원반이 적 4명 사이를 튐', kitAttack: SONIC },
        leg: { name: '무대 조명 신발', look: '불빛 나는 신발', desc: '분위기 메이커: 스킬을 쓰면 3초 공격 속도 +20%',
            passive: { name: '분위기 메이커', desc: '스킬을 쓰면 3초간 공격 속도 +20%', onSkill: { sec: 3, mods: { atkSpd: 0.2 } } } },
        skills: {
            bcBeatDrop: { name: '비트 드롭', slot: 'head', ult: true, cd: 0, icon: 'speaker', color: '#be6eff', target: 'enemy', range: 600, clip: 'cast', p: { count: 6 },
                desc: '0.5초마다 베이스 폭발 6번 — 화면 적 피해',
                steps: [{ at: 0.45, do: 'screen', dmg: 0.7, vfx: V.sheet('bass_drop', 160, { dur: 0.5 }), maxFx: 6, repeat: '$count', repeatGap: 0.5 },
                    { at: 0.45, do: 'shake', power: 4, ms: 150, repeat: '$count', repeatGap: 0.5 }] },
            bcScratch: { name: '스크래치', slot: 'body', cd: 13, icon: 'retreat', color: '#be6eff', target: 'enemy', range: 260, clip: 'cast',
                desc: '앞 적 4초 약화 — 주는 피해 -40%',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 260, dmg: 0.4, status: { weak: [4, 0.4] }, vfx: V.dark(40, 90) }] },
            bcRecordThrow: { name: '레코드 투척', slot: 'arm', cd: 8, icon: 'whirl', color: '#be6eff', target: 'enemy', range: 320, clip: 'throw',
                desc: '회전 레코드 원반이 적 4명 사이를 튀며 벰',
                steps: [{ at: 0.35, do: 'chain', n: 4, range: 320, jump: 170, dmg: 1.1, decay: 0.9, vfx: V.chainBolt(PURPLE), hitVfx: V.dark(40, 70) }] }
        }
    },

    // ---- 레어 ③ 전파 탐지 기사 (사거리) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '전파 탐지 기사', style: 'range', tint: 'hue-rotate(110deg) saturate(1.1) brightness(1.05)',
        bonus: { 4: '지향 전파 사거리 +150' },
        kit: { 4: { patch: { bcBeam: { range: 150 } } } },
        head: { name: '레이더 안테나 모자', look: '회전 레이더가 달린 모자', skill: 'bcJam', desc: '필살기 전파 교란: 화면 적 5초 침묵 + 감속' },
        body: { name: '송신기 배낭', look: '안테나 꽂힌 송신기 배낭', skill: 'bcTrack', desc: '위치 추적: 가장 강한 적 3명 8초 표식 (받는 피해 +30%)' },
        arm: { name: '지향성 안테나 팔', look: '접시 안테나 팔', skill: 'bcBeam', desc: '지향 전파: 일직선 관통 전파 + 2초 침묵', kitAttack: SONIC },
        leg: { name: '접지 부츠', look: '접지선이 달린 부츠', desc: '접지: 감속·기절·속박 시간 -40%',
            passive: { name: '접지', desc: '감속·기절·속박 시간 -40%', mods: { ccCut: 0.4 } } },
        skills: {
            bcJam: { name: '전파 교란', slot: 'head', ult: true, cd: 0, icon: 'mute', color: '#78ffa0', target: 'enemy', range: 600, clip: 'cast',
                desc: '화면 적 5초 침묵 + 감속',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.4, status: { silence: 5, slow: 5 }, vfx: V.sheet('radio_jam', 130, { dur: 0.6 }), maxFx: 10 }] },
            bcTrack: { name: '위치 추적', slot: 'body', cd: 13, icon: 'orbital', color: '#78ffa0', target: 'enemy', range: 500, clip: 'cast',
                desc: '가장 강한 적 3명 8초 표식 — 받는 피해 +30%',
                steps: [{ at: 0.45, do: 'hit', pick: 'strongest', n: 3, range: 500, dmg: 0.3, status: { mark: [8, 0.3] }, vfx: V.ring(GREEN, 50) }] },
            bcBeam: { name: '지향 전파', slot: 'arm', cd: 8, icon: 'laser', color: '#78ffa0', target: 'enemy', range: 360, clip: 'throw', p: { range: 360 },
                desc: '일직선으로 꿰뚫는 전파 — 맞은 적 2초 침묵',
                steps: [{ at: 0.35, do: 'line', range: '$range', dmg: 1.6, decay: 0.9, status: { silence: 2 }, vfx: V.beam(GREEN, 12) }] }
        }
    },

    // ---- 레어 ④ 확성기 시위대 (탱커) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '확성기 시위대', style: 'tank', tint: 'sepia(0.5) saturate(1.8) hue-rotate(-10deg) brightness(1.05)',
        bonus: { 4: '함성 공포 +1.5초' },
        kit: { 4: { patch: { bcShout: { fear: 1.5 } } } },
        head: { name: '확성기 헬멧', look: '확성기가 달린 헬멧', skill: 'bcShout', desc: '필살기 함성: 화면 적 2초 공포 + 나 보호막 25%' },
        body: { name: '피켓 갑옷', look: '피켓 판을 겹친 갑옷', skill: 'bcPicket', desc: '피켓 방벽: 앞에 벽 5초 + 투사체 막음' },
        arm: { name: '확성기 팔', look: '커다란 확성기 팔', skill: 'bcBellow', desc: '확성 일갈: 앞 적 피해 + 1초 기절', kitAttack: SONIC },
        leg: { name: '행진 부츠', look: '튼튼한 행진 부츠', desc: '꺾이지 않는 행진: 밀려나지 않음, 받는 피해 -10%',
            passive: { name: '꺾이지 않는 행진', desc: '밀려나지 않음, 받는 피해 -10%', flags: ['knockImmune'], mods: { def: 0.1 } } },
        skills: {
            bcShout: { name: '함성', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#ffc864', target: 'enemy', range: 600, clip: 'cast', p: { fear: 2 },
                desc: '화면 적 2초 공포(뒤로 물러남) + 나 보호막 25%',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.4, status: { fear: '$fear' }, vfx: V.sheet('megaphone_shout', 150, { dur: 0.5 }), maxFx: 8 },
                    { at: 0.45, do: 'shield', ratio: 0.25, sec: 6, color: WAVE }] },
            bcPicket: { name: '피켓 방벽', slot: 'body', cd: 14, icon: 'shield', color: '#ffc864', target: 'enemy', range: 160, clip: 'cast',
                desc: '앞에 피켓 벽 5초 (보스가 아닌 적은 못 넘어옴) + 투사체 막음',
                steps: [{ at: 0.45, do: 'zone', tag: 'picket', wall: true, x: 40, w: 50, sec: 5, art: { cls: 'is-scaffold is-picket', w: 90, h: 130, dx: -20 } },
                    { at: 0.45, do: 'buff', key: 'picket', sec: 5, mods: { flags: ['projBlock'] } }] },
            bcBellow: { name: '확성 일갈', slot: 'arm', cd: 8, icon: 'horn', color: '#ffc864', target: 'enemy', range: 200, clip: 'blast',
                desc: '확성기로 일갈 — 앞 적 피해 + 1초 기절',
                steps: [{ at: 0.36, do: 'hit', pick: 'all', range: 220, dmg: 1.5, status: { stun: 1 }, knock: 0.6, vfx: V.ring(WAVE, 70) }] }
        }
    },

    // ---- 유니크 ① 심야 라디오의 유령 (균형) ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '심야 라디오의 유령', style: 'balance', tint: 'hue-rotate(-70deg) saturate(1.2) brightness(1.15) drop-shadow(0 0 6px rgba(190, 110, 255, 0.8))',
        bonus: { 2: '유령 주파수 +2초', 4: '침묵한 적을 쓰러뜨리면 필살기 게이지 +4%' },
        kit: { 2: { patch: { bcGhostFreq: { sec: 2 } } }, 4: { on: [{ when: 'kill', status: 'silence', gauge: 0.04 }] } },
        head: { name: '라디오 다이얼 관', look: '빛나는 라디오 다이얼이 도는 관', skill: 'bcGhostFreq', desc: '필살기 유령 주파수: 8초 화면 적 매초 피해 + 침묵' },
        body: { name: '진공관 코트', look: '진공관이 빛나는 코트', skill: 'bcStaticVeil', desc: '잡음 장막: 6초 받는 피해 -40%, 때린 적 1초 기절' },
        arm: { name: '진공관 마이크', look: '반투명 진공관 마이크', skill: 'bcResoRings', desc: '기본 공격 유령 전파 (적 셋 사이를 튐) · 주파수 공명: 공명 고리 3개가 앞으로 퍼짐',
            kitAttack: { kind: 'chain', n: 3, decay: 0.75, jump: 170, vfx: V.chainBolt(PURPLE), hitVfx: V.dark(40, 60, { dur: 0.3 }) } },
        leg: { name: '떠 있는 신발', look: '땅에서 살짝 뜬 신발', desc: '유령 걸음: 장판·넉백 무시, 원거리 공격 20% 피함',
            passive: { name: '유령 걸음', desc: '장판·넉백 무시, 원거리 공격 20% 피함', flags: ['knockImmune', 'ignoreHazard'], mods: { dodgeRanged: 0.2 } } },
        skills: {
            bcGhostFreq: { name: '유령 주파수', slot: 'head', ult: true, cd: 0, icon: 'wave', color: '#be6eff', target: 'enemy', range: 600, clip: 'cast', p: { sec: 8 },
                desc: '8초간 유령 목소리 — 화면 적 매초 피해 + 침묵',
                steps: [{ at: 0.45, do: 'zone', tag: 'ghost', x: -100, w: 760, sec: '$sec', dps: 0.5, status: { silence: 1.2 }, every: 1,
                    puff: V.sheet('ghost_radio', 130, { dur: 0.6 }), puffEvery: 0.25, puffB: 110 }] },
            bcStaticVeil: { name: '잡음 장막', slot: 'body', cd: 14, icon: 'shield', color: '#be6eff', target: 'self', clip: 'cast',
                desc: '6초 받는 피해 -40% — 나를 때린 적 1초 기절',
                steps: [{ do: 'buff', key: 'staticVeil', sec: 6, mods: { def: 0.4, reflectStatus: { stun: 1 } }, vfx: V.ring(PURPLE, 140) }] },
            bcResoRings: { name: '주파수 공명', slot: 'arm', cd: 9, icon: 'fork', color: '#be6eff', target: 'enemy', range: 300, clip: 'cast',
                desc: '공명 고리 3개가 앞으로 퍼짐 — 지나간 적 피해 + 감속',
                steps: [{ at: 0.45, do: 'wave', speed: 460, dist: 340, w: 50, dmg: 1.1, status: { slow: 2 }, vfx: V.ring(PURPLE, 60, { dur: 0.3 }), vfxEvery: 0.1, b: 130, repeat: 3, repeatGap: 0.2 }] }
        }
    },

    // ---- 유니크 ② 거대 스피커 탑 (탱커) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '거대 스피커 탑', style: 'tank', tint: 'brightness(0.85) saturate(1.4) contrast(1.15)',
        bonus: { 2: '초저음 폭격 간격 2 → 1.5초 (+1번)', 4: '음파 방벽 +2초' },
        kit: { 2: { patch: { bcSubBomb: { count: 1, gap: -0.5 } } }, 4: { patch: { bcSoundWall: { sec: 2 } } } },
        head: { name: '스피커 왕관', look: '작은 스피커를 두른 왕관', skill: 'bcSubBomb', desc: '필살기 초저음 폭격: 2초마다 초저음 충격파 4번 (화면 피해 + 0.5초 기절)' },
        body: { name: '스피커 탑', look: '등에 짊어진 스피커 탑', skill: 'bcSoundWall', desc: '음파 방벽: 6초 투사체 막음 + 받는 피해 -30%' },
        arm: { name: '우퍼 팔', look: '커다란 우퍼를 단 팔', skill: 'bcWooferPunch', desc: '우퍼 펀치: 앞 적 크게 밀어냄 + 피해', kitAttack: SONIC },
        leg: { name: '진동 부츠', look: '울리는 진동판 부츠', desc: '공명 걸음: 걸음마다 앞쪽 작은 음파',
            passive: { name: '공명 걸음', desc: '걸음마다 앞쪽 작은 음파', step: { do: 'hit', pick: 'all', range: 140, dmg: 0.35, vfx: V.ring(WAVE, 50, { dur: 0.3 }) } } },
        skills: {
            bcSubBomb: { name: '초저음 폭격', slot: 'head', ult: true, cd: 0, icon: 'speaker', color: '#ff50aa', target: 'enemy', range: 600, clip: 'blast', p: { count: 4, gap: 2 },
                desc: '2초마다 초저음 충격파 4번 — 화면 적 피해 + 0.5초 기절',
                steps: [{ at: 0.36, do: 'screen', dmg: 0.8, status: { stun: 0.5 }, vfx: V.sheet('subwoofer_blast', 220, { anchorY: 0.9, dur: 0.5 }), maxFx: 5, repeat: '$count', repeatGap: '$gap' },
                    { at: 0.36, do: 'shake', power: 6, ms: 200, repeat: '$count', repeatGap: '$gap' }] },
            bcSoundWall: { name: '음파 방벽', slot: 'body', cd: 14, icon: 'shield', color: '#ff50aa', target: 'self', clip: 'cast', p: { sec: 6 },
                desc: '6초 투사체 막음 + 받는 피해 -30% — 끝날 때 둘레 음파',
                steps: [{ do: 'buff', key: 'soundWall', sec: '$sec', mods: { def: 0.3, flags: ['projBlock'], onEnd: { do: 'hit', pick: 'all', range: 260, dmg: 1.2, knock: 1, vfx: V.ring(WAVE, 220) } }, vfx: V.ring(WAVE, 150) }] },
            bcWooferPunch: { name: '우퍼 펀치', slot: 'arm', cd: 9, icon: 'fist', color: '#ff50aa', target: 'enemy', range: 220, clip: 'blast',
                desc: '우퍼로 쾅 — 앞 적을 크게 밀어내고 피해',
                steps: [{ at: 0.36, do: 'push', range: 240, dist: 200, dmg: 1.8 }, { at: 0.36, do: 'fx', x: 40, b: 120, vfx: V.ring(WAVE, 220) }, { at: 0.36, do: 'shake', power: 5, ms: 180 }] }
        }
    },

    // ---- 유니크 ③ 전파 해커 (사거리) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '전파 해커', style: 'range', tint: 'hue-rotate(160deg) saturate(1.5) brightness(1.1)',
        bonus: { 2: '방송 탈취 +2명', 4: '케이블로 이은 적 2초 침묵' },
        kit: { 2: { patch: { bcHijack: { n: 2 } } }, 4: { patch: { bcCable: { silence: 2 } } } },
        head: { name: '글리치 바이저', look: '깨진 화면 무늬 바이저', skill: 'bcHijack', desc: '필살기 방송 탈취: 적 6명 4초 꼭두각시 (적끼리 싸움)' },
        body: { name: '서버 코트', look: '서버 불빛이 깜빡이는 코트', skill: 'bcFirewall', desc: '방화벽: 5초 보호막 30%' },
        arm: { name: '해킹 케이블 팔', look: '케이블이 뻗는 팔', skill: 'bcCable', desc: '케이블 연결: 적 5명에 케이블 — 2초 속박 + 피해', kitAttack: SONIC },
        leg: { name: '데이터 부츠', look: '데이터 무늬 부츠', desc: '과부하 코드: 기본 공격 4번째마다 맞은 적 1.5초 침묵',
            passive: { name: '과부하 코드', desc: '기본 공격 4번째마다 가까운 적 1.5초 침묵',
                every: { n: 4, step: { do: 'hit', pick: 'nearest', range: 400, dmg: 0.3, status: { silence: 1.5 }, vfx: V.bolt(150, 60) } } } },
        skills: {
            bcHijack: { name: '방송 탈취', slot: 'head', ult: true, cd: 0, icon: 'puppet', color: '#5ae6ff', target: 'enemy', range: 600, clip: 'cast', p: { n: 6 },
                desc: '가장 강한 적 6명을 4초 꼭두각시로 — 적끼리 싸움',
                steps: [{ at: 0.45, do: 'hit', pick: 'strongest', n: '$n', range: 600, dmg: 0.4, status: { puppet: 4 }, vfx: V.sheet('glitch_hack', 130, { dur: 0.5 }) }] },
            bcFirewall: { name: '방화벽', slot: 'body', cd: 14, icon: 'shield', color: '#5ae6ff', target: 'self', clip: 'cast',
                desc: '5초 보호막 (최대 체력 30%)',
                steps: [{ do: 'shield', ratio: 0.3, sec: 5, color: CYAN }, { do: 'fx', on: 'self', x: 20, b: 120, vfx: V.ring(CYAN, 150) }] },
            bcCable: { name: '케이블 연결', slot: 'arm', cd: 9, icon: 'chain', color: '#5ae6ff', target: 'enemy', range: 340, clip: 'throw', p: { silence: 0 },
                desc: '적 5명에 케이블을 이어 2초 속박 + 피해',
                steps: [{ at: 0.35, do: 'chain', n: 5, range: 340, jump: 170, dmg: 0.9, decay: 0.95, status: { root: 2, silence: '$silence' }, vfx: V.chainBolt(CYAN), hitVfx: V.bolt(150, 60) }] }
        }
    },

    // ---- 레전더리 ① 최후의 생방송 (지원) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '최후의 생방송', style: 'support', tint: 'sepia(0.6) saturate(2) hue-rotate(-30deg) brightness(1.2) drop-shadow(0 0 7px rgba(255, 210, 110, 0.85))',
        bonus: { 2: '진실의 방송 +3초', 4: '절규에 2초 침묵' },
        kit: { 2: { patch: { bcTruth: { sec: 3 } } }, 4: { patch: { bcScream: { silence: 2 } } } },
        head: { name: '생방송 조명관', look: '무대 조명이 달린 금빛 관', skill: 'bcTruth', desc: '필살기 진실의 방송: 12초 — 모든 적 침묵, 받는 피해 +30%, 나 초당 2% 회복' },
        body: { name: '무대 코트', look: '금빛 술 장식 무대 코트', skill: 'bcSpotlight', desc: '스포트라이트: 가장 강한 적 6초 표식 +50% + 1초 기절' },
        arm: { name: '황금 마이크', look: '황금 스탠드 마이크', skill: 'bcScream', desc: '기본 공격 목소리 파동 (관통 넷) · 절규: 앞 큰 음파 + 1초 기절',
            kitAttack: { kind: 'pierce', n: 4, decay: 0.8, vfx: V.beam(GOLD, 10), hitVfx: V.gold(0, 60, { dur: 0.3 }) } },
        leg: { name: '무대 부츠', look: '금빛 무대 부츠', desc: '커튼콜: 필살기 게이지가 25% 빨리 참',
            passive: { name: '커튼콜', desc: '필살기 게이지가 25% 빨리 참', mods: { ult: 0.25 } } },
        skills: {
            bcTruth: { name: '진실의 방송', slot: 'head', ult: true, cd: 0, icon: 'speaker', color: '#ffd26e', target: 'enemy', range: 600, clip: 'cast', p: { sec: 12 },
                desc: '12초 — 화면 모든 적 침묵·받는 피해 +30%, 나 초당 2% 회복',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.5, status: { silence: '$sec', vuln: ['$sec', 0.3] }, vfx: V.sheet('live_broadcast', 150, { dur: 0.6 }), maxFx: 10 },
                    { at: 0.45, do: 'buff', key: 'truth', sec: '$sec', mods: { regen: 0.02 } }] },
            bcSpotlight: { name: '스포트라이트', slot: 'body', cd: 15, icon: 'orbital', color: '#ffd26e', target: 'enemy', range: 500, clip: 'cast',
                desc: '가장 강한 적에게 스포트라이트 — 6초 받는 피해 +50% + 1초 기절',
                steps: [{ at: 0.45, do: 'hit', pick: 'strongest', n: 1, range: 500, dmg: 0.8, status: { mark: [6, 0.5], stun: 1 }, vfx: V.pillar(-40, 200) }] },
            bcScream: { name: '절규', slot: 'arm', cd: 9, icon: 'horn', color: '#ffd26e', target: 'enemy', range: 260, clip: 'cast', p: { silence: 0 },
                desc: '앞으로 큰 음파 — 피해 + 1초 기절',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 280, dmg: 2.4, status: { stun: 1, silence: '$silence' }, knock: 1, vfx: V.ring(GOLD, 80) }, { at: 0.45, do: 'fx', x: 60, b: 130, vfx: V.ring(GOLD, 260) }] }
        }
    },

    // ---- 레전더리 ② 정적의 여제 (탱커) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '정적의 여제', style: 'tank', tint: 'grayscale(0.6) brightness(0.9) contrast(1.2) drop-shadow(0 0 7px rgba(255, 190, 230, 0.8))',
        bonus: { 2: '절대 정적 +2초', 4: '진공 장막 +3초' },
        kit: { 2: { patch: { bcAbsSilence: { sec: 2 } } }, 4: { patch: { bcVacuum: { sec: 3 } } } },
        head: { name: '정적의 관', look: '소리를 삼키는 검은 은빛 관', skill: 'bcAbsSilence', desc: '필살기 절대 정적: 10초 적 느려짐·침묵, 끝날 때 화면 큰 피해' },
        body: { name: '무음 망토', look: '빛을 삼키는 검은 망토', skill: 'bcVacuum', desc: '진공 장막: 6초 장막 — 투사체 막음 + 안 적 침묵·감속' },
        arm: { name: '소리 먹는 소리굽쇠', look: '은빛으로 어두운 소리굽쇠', skill: 'bcSwallow', desc: '기본 공격 무음 파동 (맞은 적 1초 침묵) · 소리 삼킴: 앞 적 5명 3초 침묵 + 피해',
            kitAttack: { kind: 'shot', color: SILVER, vfx: V.ring(SILVER, 50, { dur: 0.3 }), status: { silence: 1 } } },
        leg: { name: '무음 신발', look: '발소리가 나지 않는 신발', desc: '고요한 발걸음: 받는 피해 -10%, 침묵한 적에게 피해 +15%',
            passive: { name: '고요한 발걸음', desc: '받는 피해 -10%, 침묵한 적에게 주는 피해 +15%', mods: { def: 0.1 }, target: [{ when: 'status', status: 'silence', dmg: 0.15 }] } },
        skills: {
            bcAbsSilence: { name: '절대 정적', slot: 'head', ult: true, cd: 0, icon: 'mute', color: '#e1d7f5', target: 'enemy', range: 600, clip: 'cast', p: { sec: 10 },
                desc: '10초 화면이 멈춘 듯 — 적 느려짐·침묵, 끝날 때 화면 큰 피해',
                steps: [{ at: 0.45, do: 'zone', tag: 'absSilence', x: -200, w: 900, sec: '$sec', slow: true, status: { silence: 1.2 }, every: 1,
                    puff: V.sheet('absolute_silence', 150, { dur: 0.7 }), puffEvery: 0.35, puffB: 120, end: { dmg: 3, radius: 900, vfx: V.ring(SILVER, 400) } }] },
            bcVacuum: { name: '진공 장막', slot: 'body', cd: 15, icon: 'mute', color: '#e1d7f5', target: 'enemy', range: 60, clip: 'cast', p: { sec: 6 },
                desc: '6초 은빛 장막 — 투사체 막음 + 안의 적 침묵·감속',
                steps: [{ at: 0.45, do: 'zone', tag: 'vacuum', x: 20, w: 260, sec: '$sec', slow: true, status: { silence: 1.2 }, every: 1, art: { cls: 'is-dome is-silver', w: 260, h: 150 } },
                    { at: 0.45, do: 'buff', key: 'vacuum', sec: '$sec', mods: { flags: ['projBlock'] } }] },
            bcSwallow: { name: '소리 삼킴', slot: 'arm', cd: 9, icon: 'mute', color: '#e1d7f5', target: 'enemy', range: 300, clip: 'cast',
                desc: '앞 적 5명의 소리를 삼킴 — 3초 침묵 + 피해',
                steps: [{ at: 0.45, do: 'hit', pick: 'nearest', n: 5, range: 300, dmg: 1.4, status: { silence: 3 }, vfx: V.ring(SILVER, 60) }] }
        }
    }
]);
