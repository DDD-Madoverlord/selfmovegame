/* ==========================================================================
   PROJECT: MAD OVERLORD // 철거의 설계자 — 기본·강화 파츠 8개 + 세트 9개 (새 캐릭터 5, D-079 — MD/새캐릭터2종_설계안.md 2~4장)
   기본·강화 파츠도 부품 스킬(skillKit_v2.js)로: 기본 공격 공압 드릴 · 기초 파쇄 · 강제 재건(철골 바리케이드 = 그림 있는 강철 벽 장판) · 철거 명령 · 안전화
   레어 ① 현장 반장(a) · ② 폭파 기술자(b) · ③ 크레인 기사(c) · ④ 측량 설계사(d) · 유니크 ① 불도저 장갑(u) · ② 타워크레인 거신(v) · ③ 유압 해체 집게(w)
   · 레전더리 ① 대재건의 건축왕(l) · ② 종말의 해체 거신(m)
   세트 그림은 강화 그림 + 세트 색. 동작은 rig/architectRig.js (slam·cast·swing·throw). 대표 시트는 vfxPlayer.js VFX_SHEETS (Gemini 전엔 임시)
   ========================================================================== */

import { packOf, basePackOf, V } from './common.js';

const SPARK = '255, 170, 60', STEEL = '200, 215, 235', BLUE = '120, 190, 255', GOLD = '255, 205, 90', RED = '255, 80, 60';
const SCAFFOLD = { cls: 'is-scaffold', w: 110, h: 170, dx: -30 };   // 철골 바리케이드 그림 (ui_v2.css, 장판 오른쪽 끝이 벽)

// ---- 기본·강화 파츠 (같은 스킬, 강화는 능력치·그림) ----
const DRILL = { kind: 'melee', n: 3, gap: 0.08, vfx: V.blast(10, 70, { dur: 0.22 }), splash: 50, splashMul: 0.35 };
export const ARCHITECT_BASE = basePackOf('architect', {
    head: [
        { id: 'head_architect', name: '주황 안전모', cost: 400, src: 'head.png', stats: { hp: 700, dps: 60, range: 10, speed: 5 }, skill: 'arDemolish',
            desc: '필살기 철거 명령: 크레인 철구가 앞쪽을 세 번 내리침 (거점 3배)' },
        { id: 'head_architect_up', name: '작업등 안전모', cost: 950, src: 'head_up.png', stats: { hp: 900, dps: 90, range: 20, speed: 5 }, skill: 'arDemolish', up: true,
            desc: '철거 명령 (강화 안전모: 작업등)' }
    ],
    body: [
        { id: 'body_architect', name: '작업 조끼·비계', cost: 450, src: 'torso.png', stats: { hp: 1700, dps: 50, range: 0, speed: 5 }, skill: 'arRebuild',
            desc: '강제 재건: 앞에 철골 바리케이드 6초 — 적 진격을 막고 무너지며 피해' },
        { id: 'body_architect_up', name: '설계도 장갑 조끼', cost: 1000, src: 'torso_up.png', stats: { hp: 2100, dps: 80, range: 0, speed: 5 }, skill: 'arRebuild', up: true,
            desc: '강제 재건 (강화 조끼: 어깨 설계도 통)' }
    ],
    arm: [
        { id: 'arm_architect', name: '공압 드릴', cost: 500, src: 'armF.png', stats: { hp: 400, dps: 450, range: 170, speed: 0 }, skill: 'arFoundation', kitAttack: DRILL,
            desc: '기본 공격 공압 드릴 (3연타·휩쓸기) · 기초 파쇄' },
        { id: 'arm_architect_up', name: '대형 드릴·유압 집게', cost: 1100, src: 'armF_up.png', stats: { hp: 500, dps: 540, range: 190, speed: 0 }, skill: 'arFoundation', kitAttack: DRILL, up: true,
            desc: '큰 드릴 · 기초 파쇄' }
    ],
    leg: [
        { id: 'leg_architect', name: '작업화', cost: 400, src: 'legF.png', stats: { hp: 700, dps: 40, range: 0, speed: 85 },
            desc: '안전화: 거점·바리케이드에 주는 피해 +25%',
            passive: { name: '안전화', desc: '거점·바리케이드에 주는 피해 +25%', target: [{ when: 'building', dmg: 0.25 }] } },
        { id: 'leg_architect_up', name: '강철 작업화', cost: 950, src: 'legF_up.png', stats: { hp: 900, dps: 60, range: 0, speed: 100 }, up: true,
            desc: '안전화 (강화): 거점·바리케이드에 주는 피해 +35%',
            passive: { name: '안전화 (강화)', desc: '거점·바리케이드에 주는 피해 +35%', target: [{ when: 'building', dmg: 0.35 }] } }
    ]
}, {
    arFoundation: { name: '기초 파쇄', slot: 'arm', cd: 9, icon: 'drill', color: '#ff9a2e', target: 'enemy', range: 160, clip: 'slam', sfx: 'arch_drill',
        desc: '드릴을 땅에 박아 앞쪽 지면이 터짐 — 범위 피해 + 1초 기절, 거점 2배',
        steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 170, dmg: 2.2, baseMul: 2, status: { stun: 1 }, knock: 0.8, vfx: V.sheet('drill_burst', 190, { anchorY: 0.88, dur: 0.5 }), ground: true },
            { at: 0.45, do: 'shake', power: 6, ms: 220 }, { at: 0.45, do: 'fx', x: 60, vfx: V.ring(SPARK, 170) }] },
    // 벽은 바닥에 서서 걸을 때 함께 흘러감 → 적이 앞에 있을 때만 씀 (target enemy)
    arRebuild: { name: '강제 재건', slot: 'body', cd: 14, icon: 'scaffold', color: '#ff9a2e', target: 'enemy', range: 160, clip: 'cast', sfx: 'arch_scaffold',
        desc: '앞에 철골 바리케이드 6초 — 보스가 아닌 적은 넘어오지 못함, 끝날 때 무너지며 피해',
        steps: [{ at: 0.45, do: 'zone', tag: 'scaffold', wall: true, x: 40, w: 60, sec: 6, art: SCAFFOLD,
            end: { dmg: 2, radius: 150, vfx: V.impact(0, 200) } }, { at: 0.45, do: 'fx', x: 70, vfx: V.sheet('steel_scaffold', 220, { anchorY: 0.95, dur: 0.6 }) }] },
    arDemolish: { name: '철거 명령', slot: 'head', ult: true, cd: 0, icon: 'hammer', color: '#ff9a2e', target: 'enemy', range: 420, clip: 'cast',
        desc: '크레인 철구가 앞쪽을 세 번 내리침 — 큰 피해, 거점 3배',
        steps: [{ at: 0.45, do: 'rain', count: 3, every: 0.45, x: [60, 380], radius: 120, dmg: 3, baseMul: 3, vfx: V.sheet('crane_ball', 280, { anchorY: 0.95, dur: 0.6 }), shake: 9, sfx: 'arch_crane' }] }
});

// ---- 세트 9개 ----
export const ARCHITECT_SETS2 = packOf('architect', [
    // ---- 레어 ① 현장 반장 (탱커) ----
    {
        letter: 'a', tier: 'rare', no: 1, name: '현장 반장', style: 'tank', tint: 'sepia(0.4) saturate(1.6) hue-rotate(10deg) brightness(1.1)',
        bonus: { 4: '안전 펜스 +2초' },
        kit: { 4: { patch: { arSafetyFence: { sec: 2 } } } },
        head: { name: '반장 안전모', look: '노란 띠를 두른 반장 안전모, 호루라기', skill: 'arInspection', desc: '필살기 안전 점검: 화면 적 4초 감속 + 취약 20%, 나 6초 받는 피해 -30%' },
        body: { name: '형광 안전 조끼', look: '형광 주황 안전 조끼', skill: 'arSafetyFence', desc: '안전 펜스: 앞에 펜스 벽 5초 + 보호막 20%' },
        arm: { name: '대형 렌치', look: '팔만 한 강철 렌치', skill: 'arWrench', desc: '렌치 강타: 앞 적 하나 2초 기절', kitAttack: DRILL },
        leg: { name: '강철 안전화', look: '강철 코 안전화', desc: '안전 제일: 받는 피해 -10%, 밀려나지 않음',
            passive: { name: '안전 제일', desc: '받는 피해 -10%, 밀려나지 않음', flags: ['knockImmune'], mods: { def: 0.1 } } },
        skills: {
            arInspection: { name: '안전 점검', slot: 'head', ult: true, cd: 0, icon: 'horn', color: '#ffc850', target: 'enemy', range: 600, clip: 'cast',
                desc: '화면 적 4초 감속 + 취약 20% — 나 6초 받는 피해 -30%',
                steps: [{ at: 0.45, do: 'screen', units: true, dmg: 0.3, status: { slow: 4, vuln: [4, 0.2] }, vfx: V.ring(SPARK, 60), maxFx: 10 },
                    { at: 0.45, do: 'buff', key: 'inspection', sec: 6, mods: { def: 0.3 } },
                    { at: 0.45, do: 'fx', on: 'self', x: 20, b: 200, vfx: V.sheet('safety_siren', 240, { dur: 0.8 }) }] },
            arSafetyFence: { name: '안전 펜스', slot: 'body', cd: 14, icon: 'scaffold', color: '#ffc850', target: 'enemy', range: 160, clip: 'cast', p: { sec: 5 },
                desc: '앞에 펜스 벽 5초 (보스가 아닌 적은 못 넘어옴) + 보호막 20%',
                steps: [{ at: 0.45, do: 'zone', tag: 'fence', wall: true, x: 40, w: 50, sec: '$sec', art: { cls: 'is-scaffold is-fence', w: 100, h: 130, dx: -25 },
                    end: { dmg: 1.5, radius: 140, vfx: V.impact(0, 180) } }, { at: 0.45, do: 'shield', ratio: 0.2, sec: 5, color: SPARK }] },
            arWrench: { name: '렌치 강타', slot: 'arm', cd: 8, icon: 'hammer', color: '#ffc850', target: 'enemy', range: 150, clip: 'swing',
                desc: '앞 적 하나를 렌치로 내려쳐 2초 기절',
                steps: [{ at: 0.38, do: 'hit', pick: 'nearest', range: 150, dmg: 2.2, status: { stun: 2 }, knock: 0.8, vfx: V.punch(180, 140) }, { at: 0.38, do: 'shake', power: 4, ms: 150 }] }
        }
    },

    // ---- 레어 ② 폭파 기술자 (공격) ----
    {
        letter: 'b', tier: 'rare', no: 2, name: '폭파 기술자', style: 'dps', tint: 'hue-rotate(-25deg) saturate(1.8) brightness(0.95)',
        bonus: { 4: '설치 폭탄 폭발 범위 +50%' },
        kit: { 4: { patch: { arPlantBomb: { radius: 60 } } } },
        head: { name: '폭파 고글', look: '붉은 렌즈 폭파 고글', skill: 'arChainBlast', desc: '필살기 연쇄 발파: 앞쪽 다이너마이트 6개가 차례로 폭발' },
        body: { name: '다이너마이트 조끼', look: '다이너마이트를 꽂은 조끼', skill: 'arBlastReady', desc: '발파 준비: 6초 피해 +30%, 끝날 때 둘레 폭발' },
        arm: { name: '기폭 장치 팔', look: '기폭 손잡이가 달린 팔', skill: 'arPlantBomb', desc: '설치 폭탄: 앞에 폭탄 → 1.2초 뒤 범위 폭발', kitAttack: DRILL },
        leg: { name: '방폭 부츠', look: '두꺼운 방폭 부츠', desc: '방폭복: 장판·지속 피해 -30%, 받는 피해 -5%',
            passive: { name: '방폭복', desc: '장판·지속 피해 -30%, 받는 피해 -5%', incoming: [{ when: 'zone', def: 0.3 }], mods: { def: 0.05 } } },
        skills: {
            arChainBlast: { name: '연쇄 발파', slot: 'head', ult: true, cd: 0, icon: 'fire', color: '#ff5a3c', target: 'enemy', range: 440, clip: 'cast',
                desc: '앞쪽에 다이너마이트 6개 — 차례로 폭발 (거점 1.5배)',
                steps: [{ at: 0.45, do: 'rain', count: 6, every: 0.22, x: [60, 420], radius: 80, dmg: 1.3, baseMul: 1.5, vfx: V.sheet('dynamite_blast', 170, { anchorY: 0.85, dur: 0.5 }), shake: 4, sfx: 'mech_missile_blast' }] },
            arBlastReady: { name: '발파 준비', slot: 'body', cd: 13, icon: 'overdrive', color: '#ff5a3c', target: 'self', clip: 'cast',
                desc: '6초 주는 피해 +30% — 끝날 때 둘레 폭발',
                steps: [{ do: 'buff', key: 'blastReady', sec: 6, mods: { dmg: 0.3, onEnd: { do: 'hit', pick: 'all', range: 200, dmg: 1.8, knock: 1, vfx: V.blast(0, 160) } }, vfx: V.embers(RED) }] },
            arPlantBomb: { name: '설치 폭탄', slot: 'arm', cd: 8, icon: 'fire', color: '#ff5a3c', target: 'enemy', range: 200, clip: 'throw', p: { radius: 120 },
                desc: '앞에 폭탄을 던져 1.2초 뒤 범위 폭발',
                steps: [{ at: 0.35, do: 'zone', tag: 'bomb', x: 110, w: 60, sec: 1.2, puff: V.motes(RED, 4), puffEvery: 0.2,
                    end: { dmg: 2.8, radius: '$radius', vfx: V.blast(0, 180) } }, { at: 1.55, do: 'shake', power: 6, ms: 200 }] }
        }
    },

    // ---- 레어 ③ 크레인 기사 (사거리) ----
    {
        letter: 'c', tier: 'rare', no: 3, name: '크레인 기사', style: 'range', tint: 'hue-rotate(15deg) saturate(1.3) brightness(1.05)',
        bonus: { 4: '철골 낙하 +4개' },
        kit: { 4: { patch: { arBeamDrop: { count: 4 } } } },
        head: { name: '크레인 조종 헬멧', look: '무전기 달린 조종 헬멧', skill: 'arBeamDrop', desc: '필살기 철골 낙하: 철골 8개가 떨어짐' },
        body: { name: '크레인 조종복', look: '갈고리 줄을 감은 조종복', skill: 'arHookLift', desc: '훅 끌어올리기: 가장 먼 적 3명을 끌어와 1.5초 기절' },
        arm: { name: '크레인 훅 팔', look: '쇠사슬 끝에 철구를 단 팔', skill: 'arWreckSwing', desc: '철구 스윙: 철구가 앞으로 휩쓸며 밀어냄', kitAttack: DRILL },
        leg: { name: '아웃트리거 다리', look: '받침대가 펼쳐지는 다리', desc: '고정 받침: 멈춰 있으면 주는 피해 +20%',
            passive: { name: '고정 받침', desc: '멈춰 있으면 주는 피해 +20%', self: [{ when: 'still', after: 0.5, mods: { dmg: 0.2 } }] } },
        skills: {
            arBeamDrop: { name: '철골 낙하', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffb450', target: 'enemy', range: 480, clip: 'cast', p: { count: 8 },
                desc: '철골 8개가 앞쪽에 떨어짐 — 맞은 적 피해 + 0.5초 기절',
                steps: [{ at: 0.45, do: 'rain', count: '$count', every: 0.2, x: [40, 480], radius: 65, dmg: 1.1, status: { stun: 0.5 }, vfx: V.sheet('steel_beam', 200, { anchorY: 0.92, dur: 0.45 }), shake: 3 }] },
            arHookLift: { name: '훅 끌어올리기', slot: 'body', cd: 13, icon: 'chain', color: '#ffb450', target: 'enemy', range: 400, clip: 'throw',
                desc: '가장 먼 적 3명을 갈고리로 끌어와 1.5초 기절',
                steps: [{ at: 0.35, do: 'pull', pick: 'farthest', n: 3, range: 400, to: 40, sec: 0.35, dmg: 0.8, status: { stun: 1.5 }, vfx: V.chainBolt(STEEL) }] },
            arWreckSwing: { name: '철구 스윙', slot: 'arm', cd: 8, icon: 'maul', color: '#ffb450', target: 'enemy', range: 240, clip: 'swing',
                desc: '철구가 앞으로 휩쓸며 지나간 적 피해 + 밀어냄',
                steps: [{ at: 0.38, do: 'wave', speed: 480, dist: 260, w: 55, dmg: 1.4, knock: 1.2, push: 40, vfx: V.impact(0, 110), vfxEvery: 0.1 }] }
        }
    },

    // ---- 레어 ④ 측량 설계사 (속도) ----
    {
        letter: 'd', tier: 'rare', no: 4, name: '측량 설계사', style: 'speed', tint: 'hue-rotate(170deg) saturate(0.9) brightness(1.15)',
        bonus: { 4: '표식 적을 쓰러뜨리면 필살기 게이지 +3%' },
        kit: { 4: { on: [{ when: 'kill', status: 'vuln', gauge: 0.03 }] } },
        head: { name: '측량 고글', look: '눈금 렌즈 측량 고글', skill: 'arSurvey', desc: '필살기 정밀 측량: 10초 피해 +40%, 공격 속도 +20%' },
        body: { name: '설계도 망토', look: '푸른 설계도로 지은 망토', skill: 'arProjection', desc: '도면 투영: 앞 적 6초 표식 (받는 피해 +25%)' },
        arm: { name: '측량 레이저 자', look: '레이저를 쏘는 측량 자', skill: 'arLaserCut', desc: '레이저 재단: 일직선 관통 레이저', kitAttack: DRILL },
        leg: { name: '측량 롤러 신발', look: '바퀴 달린 측량 신발', desc: '빠른 실측: 진격 속도 +12%, 걷는 동안 받는 피해 -15%',
            passive: { name: '빠른 실측', desc: '진격 속도 +12%, 걷는 동안 받는 피해 -15%', mods: { move: 0.12 }, self: [{ when: 'walking', mods: { def: 0.15 } }] } },
        skills: {
            arSurvey: { name: '정밀 측량', slot: 'head', ult: true, cd: 0, icon: 'orbital', color: '#78beff', target: 'self', clip: 'cast',
                desc: '10초간 주는 피해 +40%, 공격 속도 +20%',
                steps: [{ at: 0.45, do: 'buff', key: 'survey', sec: 10, mods: { dmg: 0.4, atkSpd: 0.2 }, vfx: V.sheet('blueprint_grid', 240, { anchorY: 0.9, dur: 0.8 }) }] },
            arProjection: { name: '도면 투영', slot: 'body', cd: 13, icon: 'scaffold', color: '#78beff', target: 'enemy', range: 300, clip: 'cast',
                desc: '앞 적에게 도면을 투영해 6초 표식 — 받는 피해 +25%',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 300, dmg: 0.3, status: { mark: [6, 0.25] }, vfx: V.gold(180, 90) }] },
            arLaserCut: { name: '레이저 재단', slot: 'arm', cd: 8, icon: 'laser', color: '#78beff', target: 'enemy', range: 400, clip: 'throw',
                desc: '일직선으로 꿰뚫는 측량 레이저',
                steps: [{ at: 0.35, do: 'line', range: 420, dmg: 1.8, decay: 0.9, vfx: V.beam(BLUE, 14) }] }
        }
    },

    // ---- 유니크 ① 불도저 장갑 (탱커) ----
    {
        letter: 'u', tier: 'unique', no: 1, name: '불도저 장갑', style: 'tank', tint: 'sepia(0.7) saturate(2) hue-rotate(5deg) brightness(1.05) drop-shadow(0 0 5px rgba(255, 170, 60, 0.7))',
        bonus: { 2: '삽날 방패 +2초', 4: '평탄화 돌진에 지나간 적 1초 기절' },
        kit: { 2: { patch: { arBladeShield: { sec: 2 } } }, 4: { patch: { arBulldoze: { stun: 1 } } } },
        head: { name: '불도저 조종석', look: '유리 덮개가 달린 조종석 투구', skill: 'arBulldoze', desc: '필살기 평탄화 돌진: 삽날로 앞으로 돌진 — 지나간 적 피해 + 밀어냄' },
        body: { name: '불도저 차체', look: '두꺼운 노랑·주황 차체 갑옷', skill: 'arBladeShield', desc: '삽날 방패: 6초 받는 피해 -50%, 투사체 막음' },
        arm: { name: '삽날 팔', look: '팔에 단 불도저 삽날', skill: 'arDirtPush', desc: '기본 공격 삽날 밀기 (크게 밀침) · 흙더미 밀어내기: 앞 적 전부 밀어내고 감속',
            kitAttack: { kind: 'melee', vfx: V.impact(10, 110, { dur: 0.3 }), knock: 1.4, splash: 70, splashMul: 0.5 } },
        leg: { name: '무한궤도', look: '작은 무한궤도 다리', desc: '무한궤도: 밀려나지 않음, 장판 무시',
            passive: { name: '무한궤도', desc: '밀려나지 않음, 장판 무시', flags: ['knockImmune', 'ignoreHazard'] } },
        skills: {
            arBulldoze: { name: '평탄화 돌진', slot: 'head', ult: true, cd: 0, icon: 'rocket', color: '#ffaa3c', target: 'enemy', range: 300, clip: 'swing', p: { stun: 0 },
                desc: '삽날로 앞으로 돌진 — 지나간 적 피해 + 밀어냄',
                steps: [{ at: 0.25, do: 'dash', dist: 260, sec: 0.45, dmg: 2.2, knock: 1.5, status: { stun: '$stun' }, trail: V.sheet('bulldozer_dust', 160, { anchorY: 0.85, dur: 0.5 }) },
                    { at: 0.3, do: 'push', range: 320, dist: 140, dmg: 0.5 }, { at: 0.3, do: 'shake', power: 7, ms: 300 }] },
            arBladeShield: { name: '삽날 방패', slot: 'body', cd: 14, icon: 'shield', color: '#ffaa3c', target: 'self', clip: 'cast', p: { sec: 6 },
                desc: '6초 받는 피해 -50%, 투사체 막음',
                steps: [{ do: 'buff', key: 'bladeShield', sec: '$sec', mods: { def: 0.5, flags: ['projBlock'] }, vfx: V.aura(20, 220) }] },
            arDirtPush: { name: '흙더미 밀어내기', slot: 'arm', cd: 9, icon: 'slam', color: '#ffaa3c', target: 'enemy', range: 200, clip: 'swing',
                desc: '앞 적 전부를 흙더미로 밀어내고 3초 감속',
                steps: [{ at: 0.38, do: 'push', range: 220, dist: 160, dmg: 1.2, status: { slow: 3 } }, { at: 0.38, do: 'fx', x: 60, vfx: V.impact(0, 200) }] }
        }
    },

    // ---- 유니크 ② 타워크레인 거신 (사거리) ----
    {
        letter: 'v', tier: 'unique', no: 2, name: '타워크레인 거신', style: 'range', tint: 'hue-rotate(-10deg) saturate(1.5) brightness(1.1) contrast(1.1)',
        bonus: { 2: '철골 폭우 +6개', 4: '평형추 낙하 범위 +50%' },
        kit: { 2: { patch: { arBeamStorm: { count: 6 } } }, 4: { patch: { arCounterweight: { radius: 75 } } } },
        head: { name: '타워크레인 관제모', look: '꼭대기에 경고등이 달린 관제모', skill: 'arBeamStorm', desc: '필살기 철골 폭우: 철골 16개가 화면에 떨어짐' },
        body: { name: '평형추 코어', look: '등에 거대한 평형추', skill: 'arCounterweight', desc: '평형추 낙하: 거대 평형추 — 큰 범위 피해 + 2초 기절' },
        arm: { name: '지브 팔', look: '크레인 지브 같은 긴 팔', skill: 'arHookChain', desc: '훅 연쇄: 갈고리가 적 4명을 차례로 걸어 묶음', kitAttack: DRILL },
        leg: { name: '크레인 기초 다리', look: '콘크리트 받침 다리', desc: '기초 공사: 멈춰 있으면 받는 피해 -20%',
            passive: { name: '기초 공사', desc: '멈춰 있으면 받는 피해 -20%', self: [{ when: 'still', after: 0.5, mods: { def: 0.2 } }] } },
        skills: {
            arBeamStorm: { name: '철골 폭우', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffb450', target: 'enemy', range: 560, clip: 'cast', p: { count: 16 },
                desc: '철골 16개가 화면에 쏟아짐',
                steps: [{ at: 0.45, do: 'rain', count: '$count', every: 0.16, x: [30, 560], radius: 60, dmg: 1, vfx: V.sheet('steel_beam', 200, { anchorY: 0.92, dur: 0.45 }), shake: 2 }] },
            arCounterweight: { name: '평형추 낙하', slot: 'body', cd: 14, icon: 'slam', color: '#ffb450', target: 'enemy', range: 300, clip: 'cast', p: { radius: 150 },
                desc: '거대한 평형추가 떨어짐 — 큰 범위 피해 + 2초 기절',
                steps: [{ at: 0.45, do: 'rain', count: 1, x: [120, 300], radius: '$radius', dmg: 3, status: { stun: 2 }, delay: 0.35, vfx: V.sheet('counterweight', 260, { anchorY: 0.95, dur: 0.6 }), shake: 9 }] },
            arHookChain: { name: '훅 연쇄', slot: 'arm', cd: 9, icon: 'chain', color: '#ffb450', target: 'enemy', range: 320, clip: 'throw',
                desc: '갈고리가 적 4명을 차례로 걸어 2초 묶음',
                steps: [{ at: 0.35, do: 'chain', n: 4, range: 320, jump: 180, dmg: 1, decay: 0.95, status: { root: 2 }, vfx: V.chainBolt(STEEL), hitVfx: V.impact(0, 80) }] }
        }
    },

    // ---- 유니크 ③ 유압 해체 집게 (공격) ----
    {
        letter: 'w', tier: 'unique', no: 3, name: '유압 해체 집게', style: 'dps', tint: 'hue-rotate(150deg) saturate(0.8) brightness(1.05)',
        bonus: { 2: '해체 분쇄 +1번', 4: '과압 +3초' },
        kit: { 2: { patch: { arCrush: { times: 1 } } }, 4: { patch: { arOverpressure: { sec: 3 } } } },
        head: { name: '유압 투구', look: '유압 호스가 달린 투구', skill: 'arCrush', desc: '필살기 해체 분쇄: 집게로 가장 강한 적을 붙잡아 세 번 쥐어짬' },
        body: { name: '유압 펌프 몸통', look: '펌프가 끓는 몸통 갑옷', skill: 'arOverpressure', desc: '과압: 8초 공격 속도 +40%' },
        arm: { name: '대형 집게', look: '청록 유압 집게 팔', skill: 'arGrab', desc: '움켜잡기: 앞 적 하나 끌어와 2초 기절 + 피해', kitAttack: DRILL },
        leg: { name: '유압 다리', look: '피스톤 다리', desc: '분쇄 박자: 기본 공격 5번째마다 집게로 쥐어 추가 피해',
            passive: { name: '분쇄 박자', desc: '기본 공격 5번째마다 집게로 쥐어 추가 피해 + 0.5초 기절',
                every: { n: 5, step: { do: 'hit', pick: 'nearest', range: 220, dmg: 1.5, status: { stun: 0.5 }, vfx: V.claw(150, 110) } } } },
        skills: {
            arCrush: { name: '해체 분쇄', slot: 'head', ult: true, cd: 0, icon: 'claw', color: '#5adcd2', target: 'enemy', range: 300, clip: 'swing', p: { times: 3 },
                desc: '가장 강한 적을 집게로 붙잡아 세 번 쥐어짬 — 큰 피해 + 기절',
                steps: [{ at: 0.38, do: 'hit', pick: 'strongest', range: 300, times: '$times', every: 0.35, dmg: 2.4, status: { stun: 1 }, knock: 0.2, vfx: V.sheet('crusher_claw', 170, { dur: 0.4 }) },
                    { at: 0.38, do: 'shake', power: 5, ms: 200, repeat: '$times', repeatGap: 0.35 }] },
            arOverpressure: { name: '과압', slot: 'body', cd: 14, icon: 'overdrive', color: '#5adcd2', target: 'self', clip: 'cast', p: { sec: 8 },
                desc: '8초 공격 속도 +40%',
                steps: [{ do: 'buff', key: 'overpressure', sec: '$sec', mods: { atkSpd: 0.4 }, vfx: V.aura(140, 220) }] },
            arGrab: { name: '움켜잡기', slot: 'arm', cd: 8, icon: 'claw', color: '#5adcd2', target: 'enemy', range: 220, clip: 'swing',
                desc: '앞 적 하나를 집게로 끌어와 2초 기절 + 피해',
                steps: [{ at: 0.38, do: 'pull', pick: 'nearest', n: 1, range: 220, to: 20, sec: 0.3, dmg: 1.8, status: { stun: 2 }, vfx: V.claw(150, 120) }] }
        }
    },

    // ---- 레전더리 ① 대재건의 건축왕 (균형) ----
    {
        letter: 'l', tier: 'legendary', no: 1, name: '대재건의 건축왕', style: 'balance', tint: 'sepia(0.7) saturate(2.2) hue-rotate(-5deg) brightness(1.2) drop-shadow(0 0 7px rgba(255, 205, 90, 0.85))',
        bonus: { 2: '도시 재건 +2초', 4: '도시 재건 성벽이 무너질 때 피해 2배' },
        kit: { 2: { patch: { arCityRebuild: { sec: 2 } } }, 4: { patch: { arCityRebuild: { endDmg: 3 } } } },
        head: { name: '황금 설계도 왕관', look: '황금 설계도가 떠도는 왕관', skill: 'arCityRebuild', desc: '필살기 도시 재건: 황금 비계 성벽이 솟음 — 솟을 때 화면 피해, 8초 적 진격 막음, 무너질 때 큰 피해' },
        body: { name: '비계 날개 망토', look: '등에 황금 비계 날개', skill: 'arRevise', desc: '설계 수정: 8초 받는 피해 -30%, 진격 +20%' },
        arm: { name: '황금 드릴 홀', look: '황금 드릴이 달린 홀', skill: 'arPiles', desc: '기본 공격 황금 드릴 (관통 셋) · 기초 말뚝: 말뚝 5개가 적 5명 2초 속박',
            kitAttack: { kind: 'pierce', n: 3, decay: 0.8, vfx: V.beam(GOLD, 10), hitVfx: V.gold(0, 70, { dur: 0.3 }) } },
        leg: { name: '기초석 신발', look: '주춧돌 같은 신발', desc: '반석: 받는 피해 -15%, 거점·바리케이드 피해 +20%',
            passive: { name: '반석', desc: '받는 피해 -15%, 거점·바리케이드에 주는 피해 +20%', mods: { def: 0.15 }, target: [{ when: 'building', dmg: 0.2 }] } },
        skills: {
            arCityRebuild: { name: '도시 재건', slot: 'head', ult: true, cd: 0, icon: 'scaffold', color: '#ffcd5a', target: 'enemy', range: 600, clip: 'cast', p: { sec: 8, endDmg: 3 },
                desc: '황금 비계 성벽이 솟음 — 솟을 때 화면 피해, 8초 적 진격 막음, 무너질 때 큰 피해',
                steps: [{ at: 0.45, do: 'screen', dmg: 1.2, vfx: V.sheet('scaffold_rise', 200, { anchorY: 0.95, dur: 0.7 }), maxFx: 6, ground: true },
                    { at: 0.45, do: 'zone', tag: 'cityWall', wall: true, x: 30, w: 70, sec: '$sec', art: { cls: 'is-scaffold is-gold', w: 140, h: 230, dx: -35 },
                        end: { dmg: '$endDmg', radius: 260, vfx: V.bigBlast(20, 320) } }, { at: 0.45, do: 'shake', power: 8, ms: 350 }] },
            arRevise: { name: '설계 수정', slot: 'body', cd: 15, icon: 'shield', color: '#ffcd5a', target: 'self', clip: 'cast',
                desc: '8초 받는 피해 -30%, 진격 속도 +20%',
                steps: [{ do: 'buff', key: 'revise', sec: 8, mods: { def: 0.3, move: 0.2 }, vfx: V.gold(0, 220) }] },
            arPiles: { name: '기초 말뚝', slot: 'arm', cd: 9, icon: 'pile', color: '#ffcd5a', target: 'enemy', range: 320, clip: 'slam',
                desc: '황금 말뚝 5개가 적 5명을 2초 속박 + 피해',
                steps: [{ at: 0.45, do: 'hit', pick: 'nearest', n: 5, range: 320, dmg: 1.1, status: { root: 2 }, vfx: V.pillar(0, 150, { dur: 0.4 }), ground: true }] }
        }
    },

    // ---- 레전더리 ② 종말의 해체 거신 (공격) ----
    {
        letter: 'm', tier: 'legendary', no: 2, name: '종말의 해체 거신', style: 'dps', tint: 'brightness(0.65) saturate(1.6) hue-rotate(-20deg) contrast(1.25) drop-shadow(0 0 7px rgba(255, 80, 60, 0.85))',
        bonus: { 2: '최종 철거 +1번', 4: '지반 붕괴 안의 거점 피해 3배' },
        kit: { 2: { patch: { arFinalDemolition: { count: 1 } } }, 4: { patch: { arSinkhole: { baseMul: 2 } } } },
        head: { name: '해체 거신 투구', look: '붉은 경고등 해체 로봇 투구', skill: 'arFinalDemolition', desc: '필살기 최종 철거: 거대 굴착기가 앞을 세 번 내리찍음 — 거점 3배' },
        body: { name: '철거 엔진', look: '불을 뿜는 철거 엔진', skill: 'arEngineHeat', desc: '엔진 과열: 6초 피해 +50%, 끝날 때 둘레 폭발' },
        arm: { name: '거대 굴착 드릴', look: '몸만 한 굴착 드릴', skill: 'arSinkhole', desc: '기본 공격 굴착 드릴 (4연타) · 지반 붕괴: 앞 바닥이 꺼짐 — 범위 피해 + 2초 속박',
            kitAttack: { kind: 'melee', n: 4, gap: 0.07, vfx: V.blast(10, 80, { dur: 0.25 }), splash: 50, splashMul: 0.3 } },
        leg: { name: '거신 궤도', look: '거대한 무한궤도 다리', desc: '짓밟는 궤도: 걸음마다 앞쪽 작은 충격파',
            passive: { name: '짓밟는 궤도', desc: '걸음마다 앞쪽 작은 충격파', step: { do: 'hit', pick: 'all', range: 120, dmg: 0.4, knock: 0.3, ground: true, vfx: V.shock(50, 150, 0.4) } } },
        skills: {
            arFinalDemolition: { name: '최종 철거', slot: 'head', ult: true, cd: 0, icon: 'drill', color: '#ff503c', target: 'enemy', range: 480, clip: 'slam', p: { count: 3 },
                desc: '거대 굴착기가 앞쪽을 세 번 내리찍음 — 큰 피해, 거점 3배',
                steps: [{ at: 0.45, do: 'rain', count: '$count', every: 0.55, x: [60, 480], radius: 140, dmg: 3.2, baseMul: 3, vfx: V.sheet('mega_drill', 300, { anchorY: 0.95, dur: 0.6 }), shake: 10, sfx: 'base_blast' }] },
            arEngineHeat: { name: '엔진 과열', slot: 'body', cd: 15, icon: 'overdrive', color: '#ff503c', target: 'self', clip: 'cast',
                desc: '6초 주는 피해 +50% — 끝날 때 둘레 폭발',
                steps: [{ do: 'buff', key: 'engineHeat', sec: 6, mods: { dmg: 0.5, onEnd: { do: 'hit', pick: 'all', range: 220, dmg: 2, knock: 1.2, vfx: V.blast(0, 200) } }, vfx: V.embers(RED) }] },
            arSinkhole: { name: '지반 붕괴', slot: 'arm', cd: 9, icon: 'slam', color: '#ff503c', target: 'enemy', range: 260, clip: 'slam', p: { baseMul: 1 },
                desc: '앞쪽 바닥이 꺼짐 — 범위 피해 + 2초 속박',
                steps: [{ at: 0.45, do: 'hit', pick: 'all', range: 260, dmg: 2, baseMul: '$baseMul', status: { root: 2 }, vfx: V.impact(0, 200), ground: true }, { at: 0.45, do: 'shake', power: 7, ms: 250 }] }
        }
    }
]);
