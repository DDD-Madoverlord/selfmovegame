/* ==========================================================================
   PROJECT: MAD OVERLORD // 적 종류와 행동 (v2)
   기획서 2-⑥ "진격 지연형" 적 (결정 D-020). 외형은 C단계 이미지가 오기 전까지
   고블린 스프라이트에 종류별 색조 + 이름표로 구분한다 (임시).

   종류 (hp·dps는 스테이지 배율 stage.enemy.hp/dps를 곱함, reward = 처치 보상 배율)
     guard   경비병        근접 기본 보병
     shield  방패병        체력↑, 받는 피해 40% 감소, 밀쳐지지 않음
     tranq   마취총 사수   멀리서 멈춰 마취탄 → 주인공 감속
     shock   전기 충격병   근접, 주기적으로 주인공 기절
     medic   의무병        뒤에 머물며 가장 다친 적(또는 거점)을 치유
     guardian 정의의 수호자 (챕터 1 보스) 방패 강타(기절), 정의의 일격(예고 후 큰 피해)
   구역 2 (D-040): raider builder sludge netter mechanic + 보스 scrapking
   구역 3·4 (D-056): soldier inquisitor holyshield priest mage + demon demonknight + 보스 archbishop /
                     cultist tentacle carapace slime(→ slimelet) sporer + 보스 oculus — MD/구역3·4_설계안.md
   구역 6 (D-078): 구역 3 적 5종 + warden shade(은신) tithe(축복 오라) + 보스 orbian — MD/구역6_설계안.md
   새 기획 구역 1 (D-085): conscript riot(대열) taser(올가미) rocket(곡사) empdrone(스킬 지연) hound(출혈) flamer(불 장판) exo + 보스 wmdalpha(레이저)
   새 기획 구역 9 (D-085): thug concretedrone(콘크리트 장벽) cementsprayer(굳는 장판) rivetsniper(곡사) welderwalker(약화) dynamite(자폭)
                          safetywarden(사이렌 광폭화) wreckingcrane + 보스 panopticon(분쇄·H빔·약화 파동) — 기믹 = 폐자재 더미(boss.scrap)
   새 기획 구역 10 (D-085): citizen sonicshield(소음 장막) speakerdrone(공격력 감소) lasersniper(직선 레이저) jammer(스킬 지연) woofermech(음파 밀어냄)
                          thug enforcer(기절) + 보스 mothervoice(주파수 폭발·메아리·통제 레이저) — 기믹 = 세뇌 증폭 안테나(boss.antennas)
   새 기획 구역 8 (D-085): torch furnaceshield(화상 반사·장벽) oilthrower(불 장판) hunter(덫 속박) heatshaman(조각상 해동) frozenstatue
                          steambomber(증기 자폭) heatturret(스킬 지연) wolfknight + 보스 vladimir(숨결·유성우·온기 강탈) — 기믹 = 탐욕의 제단(boss.altars)
   새 기획 구역 7 (D-085): trench wireshield(철조망 장벽) grenadier(곡사) gassoldier(가스 구름) mgnest(연사) officer(호루라기 광폭화·소환)
                          sapper(지뢰) steamtank + 보스 behemoth(철갑탄·소이탄·돌진) — 보스전 기믹 = 조명탄(flare, boss.flares)
   새 기획 구역 6 (D-085): orderly maidenshield(가시 장벽) holywater(독 장판) anesthetist(마취 기절) bloodbagdrone(비행 치유) bloated(자폭)
                          ambulance(보병 배출) surgeon + 보스 grailheart(파동·산탄·착취) — 보스전 기믹 = 강제 헌혈(pauper, boss.donors)
   새 기획 구역 5 (D-085): marine hatchshield(해치 장벽) netgunner(3초 속박) mineman(폭뢰 곡사) sonardrone(스킬 지연) toxicdiver(자폭)
                          deckgun(직사 유탄) subwalker + 보스 ironclad(압축포·폭뢰 융단) — 보스전 기믹 = 해저 화산 간헐천(boss.geysers)
   새 기획 구역 4 (D-085): mutant boneshield(뼈 방패 장벽) leechfiend chimeraslime(분열) sporecaster(곡사) parasite(치유·광폭화)
                          eyetower(안광) fusionbeast(죽으면 산성) + 보스 oculus(새 그림, 50% 외눈 변이)
   새 기획 구역 3 (D-085): zealot holyshield inquisitor(채찍 출혈) lightmage(빛 곡사) battlepriest(치유) griffon(약화) ballista(밀어냄)
                          executioner + 보스 benedict(빛의 기둥·흡혈 촉수) — 보스전 기믹 = 지옥문(악마기사 2기, boss.knights)
   새 기획 구역 2 (D-085): merc dozer(밀어냄) harpoon(작살 감속) sawdrone(비행 근접) acidmech(산성 웅덩이) sonictower(스킬 지연)
                          spiderwalker(장거리 곡사) excavator + 보스 terraformer(파일벙커)
   엘리트: 체력 ×3, 공격 ×1.5, 크기 ×1.3, 금색 이름표, 보상 ×4
   ========================================================================== */

import { KAIJU_VFX, BATTLE_VFX, ZONE_VFX, BOSS_VFX, ELITE_VFX } from './vfx/vfxDefs.js';
import { sound } from './audio/sound_v2.js';
import { aimAt } from './bases_v2.js';
// 적 그림 (로드맵 C단계, D-035): 리그를 구운 동작별 스프라이트 — tools/rig/bake_enemies.py가 만듦.
// 그림이 있는 종류는 구운 크기 그대로(종류별 scale·색조 대신), 없는 종류는 임시 고블린 + 색조 (D-023)
import { ENEMY_ART } from './enemyArt_v2.js';
import { hastedType } from './difficulty_v2.js';

// ---- 적 그림 미리 풀기 (성능 측정 2026-10-21: 새 적이 처음 나올 때 그림 압축 풀기로 50~100ms 멈춤) ----
const decoded = new Map();   // 그림 주소 → Image (붙잡아 두어 풀린 그림이 남게)
function decodeOnce(src) {
    if (decoded.has(src) || typeof Image === 'undefined') return;
    const img = new Image();
    img.src = src;
    decoded.set(src, img);
    if (img.decode) img.decode().catch(() => {});
}
/** 전투 시작 때 (battle_v2.js startBattle): 이 스테이지 적 섞기·보스의 그림(빌린 그림 포함)을 미리 풂 */
export function predecodeStageArt(stage) {
    const types = new Set(Object.keys((stage.enemy && stage.enemy.mix) || {}));
    if (stage.boss && stage.boss.unit) types.add(stage.boss.unit);
    for (const id of types) {
        const t = ENEMY_TYPES[id];
        const key = ENEMY_ART[id] ? id : t && t.artAs;
        const art = key && ENEMY_ART[key];
        if (!art) continue;
        for (const v of Object.values(art)) if (v && v.src) decodeOnce(v.src);
    }
}

export const ENEMY_TYPES = {
    guard: { name: '경비병', hp: 350, dps: 35, speed: [75, 100], reward: 1 },
    shield: {
        name: '방패병', hp: 820, dps: 24, speed: [44, 54], reward: 2, armor: 0.4, knockResist: true, scale: 1.12,
        tint: 'hue-rotate(185deg) saturate(1.2)'
    },
    tranq: {
        name: '마취총 사수', hp: 240, dps: 0, speed: [70, 84], reward: 1.5, tint: 'hue-rotate(95deg) saturate(1.4)',
        ranged: { range: 230, every: 2.4, dmg: 24, slow: 2.2 }
    },
    shock: {
        name: '전기 충격병', hp: 380, dps: 26, speed: [82, 96], reward: 1.5, tint: 'hue-rotate(38deg) saturate(1.7) brightness(1.15)',
        shock: { every: 3.2, stun: 0.8 }
    },
    medic: {
        name: '의무병', hp: 300, dps: 0, speed: [58, 66], reward: 2, tint: 'grayscale(0.55) brightness(1.5)',
        heal: { every: 2.6, amount: 110, range: 200, keepBack: 250, baseMul: 3 }
    },
    guardian: {
        name: '정의의 수호자', boss: true, hp: 5200, dps: 55, speed: [40, 40], reward: 30, armor: 0.25, knockResist: true, scale: 1.7,
        tint: 'sepia(0.6) hue-rotate(10deg) saturate(1.8) brightness(1.3)',
        bash: { every: 7, stun: 1.0, dmg: 0.05 }, smite: { every: 11, warn: 1.2, dmg: 0.09 },
        barrier: { every: 15, sec: 3, cut: 0.7 }
    }
};
// ---- 구역 2: 고철 약탈단 (D-040) — 기획서 2-⑥의 바리케이드·늪 + 속박·수리 ----
Object.assign(ENEMY_TYPES, {
    raider: { name: '고철 약탈자', hp: 360, dps: 36, speed: [78, 102], reward: 1 },
    builder: {
        name: '고철 방벽병', hp: 520, dps: 26, speed: [48, 60], reward: 2, armor: 0.15,
        // 주인공 앞 range px 안에 오면 멈춰서 바리케이드를 세움 (every초에 한 번, 근처에 이미 있으면 안 세움)
        barricade: { range: 300, every: 9, hp: 520, gap: 140 }
    },
    sludge: {
        name: '오물 투척병', hp: 260, dps: 0, speed: [66, 80], reward: 1.5,
        // 주인공 발밑에 오물을 던져 늪 장판 (위에 있으면 진격·동작 감속, 반중력 부양은 면역)
        sludge: { range: 250, every: 3.6, sec: 4.5, width: 120 }
    },
    netter: {
        name: '그물총 사수', hp: 280, dps: 0, speed: [70, 84], reward: 1.5,
        // 그물: 맞으면 속박(진격 불가, 공격·스킬은 가능)
        net: { range: 240, every: 3.8, dmg: 18, root: 1.8 }
    },
    mechanic: {
        name: '수리공', hp: 320, dps: 0, speed: [58, 66], reward: 2,
        // 수리: 거점·바리케이드를 먼저 (repair). 배율: 거점 baseMul, 바리케이드 barricadeMul, 병사 soldierMul
        // (치유량은 스테이지 적 체력 배율도 곱해짐 — 거점 4배였을 때 2-5에서 초당 640을 고쳐 최종 기지를 못 부숨. 1.2배 = 2-B 초당 약 200)
        heal: { every: 2.4, amount: 120, range: 220, keepBack: 260, baseMul: 1.2, barricadeMul: 0.5, soldierMul: 0.35, repair: true }
    },
    scrapking: {
        name: '고철왕', boss: true, hp: 5800, dps: 45, speed: [34, 34], reward: 40, armor: 0.3, knockResist: true, scale: 1.7,
        tint: 'sepia(0.4) saturate(1.4)',
        // 자석: 크레인 자석으로 붙잡아 뒤로 내던짐(주인공 밀려남 + 잠깐 기절) / 고철 낙하: 예고 원 → 큰 피해
        magnet: { every: 9, warn: 0.6, push: 130, stun: 0.6, range: 420 },
        drop: { every: 12, warn: 1.3, dmg: 0.08 },
        scrapWall: { every: 16, hp: 520, gap: 140 }
    }
});
// ---- 구역 3: 성왕국 이단심문소 & 타락 기사단 / 구역 4: 별의 사도들과 실패한 진화체들 (D-056) ----
// 그림이 오기 전까지 artAs = 빌려 쓸 그림(ENEMY_ART 이름) + tint 색조. 그 종류 이름의 그림이 생기면 그것을 씀 (spawnEnemy)
Object.assign(ENEMY_TYPES, {
    soldier: { name: '왕국보병', hp: 340, dps: 34, speed: [80, 104], reward: 1, artAs: 'guard', tint: 'sepia(0.55) saturate(0.9) brightness(0.95)' },
    inquisitor: {
        name: '이단심문관', hp: 520, dps: 46, speed: [70, 88], reward: 1.8,
        artAs: 'shock', tint: 'hue-rotate(-48deg) saturate(1.6) brightness(0.95)',
        // 가시 박힌 쇠사슬 채찍: 출혈 + 이동 감속 (새 기획 D-085 — 그림 2026-10-25 GPT)
        bite: { every: 3.2, ticks: 3, dmg: 10, slow: 1.6, label: '⛓ 가시 채찍 — 출혈' }
    },
    holyshield: {
        name: '신성 방패병', hp: 640, dps: 13, speed: [44, 56], reward: 2, armor: 0.3, knockResist: true,
        artAs: 'shield', tint: 'sepia(0.75) saturate(1.7) brightness(1.1)',
        barricade: { range: 300, every: 9, hp: 600, gap: 140, label: '🛡 방패 장벽!' }
    },
    priest: {
        name: '신관', hp: 280, dps: 0, speed: [58, 66], reward: 2, artAs: 'medic', tint: 'sepia(0.35) brightness(1.12)',
        // 병사만 조금 치유 (거점·장벽은 안 고침 — 구역 1 의무병·구역 2 수리공과 구분)
        heal: { every: 3, amount: 70, range: 220, keepBack: 260, soldiersOnly: true }
    },
    mage: {
        name: '마법사', hp: 260, dps: 0, speed: [66, 80], reward: 1.8, artAs: 'tranq', tint: 'hue-rotate(205deg) saturate(1.2) brightness(0.9)',
        // 1~3초마다 불(화상)·번개(기절)·얼음(감속) 중 하나
        spell: { range: 260, every: [1, 3], dmg: 26,
            fire: { dmgMul: 1, burnTicks: 3, burnEvery: 1, burnMul: 0.25 },
            bolt: { dmgMul: 0.8, stun: 0.4 }, ice: { dmgMul: 0.9, slow: 1.5 } }
    },
    demon: {
        name: '악마병', hp: 700, dps: 18, speed: [50, 60], reward: 0.5, armor: 0.2,
        artAs: 'raider', tint: 'brightness(0.5) saturate(1.8) hue-rotate(-25deg) drop-shadow(0 0 4px rgba(200, 30, 60, 0.8))'
    },
    demonknight: {
        name: '악마기사', hp: 700, dps: 46, speed: [56, 66], reward: 3, knockResist: true, scale: 1.12,
        artAs: 'builder', tint: 'brightness(0.42) saturate(1.8) hue-rotate(-28deg) drop-shadow(0 0 5px rgba(220, 30, 50, 0.9))',
        cleave: { every: 5, dmg: 0.05 }
    },
    archbishop: {
        name: '대주교 베네딕트', boss: true, hp: 5200, dps: 0, speed: [30, 30], reward: 50, armor: 0.3, knockResist: true,
        // 임시: 정의의 수호자 그림을 바랜 금빛 + 등 뒤 검붉은 그림자(악마)처럼
        artAs: 'guardian', tint: 'sepia(0.65) saturate(1.6) hue-rotate(-10deg) brightness(1.05) drop-shadow(-6px -4px 12px rgba(150, 0, 40, 0.95))',
        caster: { hold: 240 },
        // 천상의 심판: 예고 원 → 빛의 기둥 / 악마병 소환: 체력 below 아래에서 every초마다 n기
        judgment: { every: 9, warn: 1.4, dmg: 0.09 },
        summon: { below: 0.5, every: 12, unit: 'demon', n: 2 },
        chain: { every: 13, warn: 0.8, root: 1.6, dmg: 0.03 }
    },
    cultist: { name: '진화의 광신도', hp: 360, dps: 36, speed: [80, 104], reward: 1, artAs: 'raider', tint: 'hue-rotate(235deg) saturate(1.3) brightness(0.85)' },
    tentacle: {
        name: '심연 촉수귀', hp: 540, dps: 52, speed: [70, 88], reward: 1.8,
        artAs: 'sludge', tint: 'hue-rotate(250deg) brightness(0.55) saturate(1.7)'
    },
    carapace: {
        name: '생체 방패수', hp: 680, dps: 24, speed: [44, 56], reward: 2, armor: 0.3, knockResist: true,
        artAs: 'builder', tint: 'hue-rotate(200deg) saturate(1.3) brightness(0.8)',
        barricade: { range: 300, every: 9, hp: 650, gap: 140, label: '🛡 갑각 장벽!' }
    },
    slime: {
        name: '키메라 슬라임', hp: 420, dps: 30, speed: [60, 76], reward: 1.2,
        artAs: 'minion', tint: 'hue-rotate(160deg) saturate(1.6) brightness(1.05)',
        split: { into: 'slimelet', n: 2 }   // 쓰러지면 작은 슬라임 2기 (한 번만)
    },
    slimelet: {
        name: '작은 슬라임', hp: 160, dps: 18, speed: [86, 100], reward: 0.4, scale: 0.6,
        artAs: 'slime', tint: 'saturate(1.3) brightness(1.15)'   // 키메라 슬라임 그림을 작게 (갈라져 나온 조각)
    },
    sporer: {
        name: '포자 술사', hp: 260, dps: 0, speed: [66, 80], reward: 1.8, artAs: 'tranq', tint: 'hue-rotate(70deg) saturate(1.7) brightness(0.9)',
        spore: { range: 280, every: [1, 3], dmg: 28 }   // 높은 포물선 (곡사)
    },
    oculus: {
        name: '관장자 오큘러스', boss: true, hp: 6000, dps: 50, speed: [34, 34], reward: 60, armor: 0.3, knockResist: true,
        artAs: 'scrapking', tint: 'hue-rotate(225deg) saturate(1.3) brightness(0.8)',
        caster: { hold: 260 },
        // 심연의 파동: 발밑 예고 → 촉수 / 유전자 붕괴: 점액 → 긴 감속
        wave: { every: 8, warn: 1.0, dmg: 0.07 },
        goo: { every: 11, slow: 4, range: 460 },
        // 극한의 변이 (2페이즈): 체력 at 아래 → 뒤에 머물지 않고 근접 광폭화 + 돌진
        rage: {
            at: 0.5, speedMul: 2.4, dpsMul: 1.8, scale: 1.15,
            tint: 'hue-rotate(-30deg) saturate(2) brightness(0.9) drop-shadow(0 0 12px rgba(255, 40, 60, 0.8))',
            glow: 'drop-shadow(0 0 10px rgba(255, 40, 60, 0.75))',   // 2페이즈 그림(oculus2)을 쓸 때는 색조 대신 진홍 윤곽 빛만
            charge: { every: 7, warn: 0.8, dmg: 0.08, push: 110 },
            gaze: { every: 9, warn: 1.0, dmg: 0.06, stun: 0.5 }
        }
    }
});
// ---- 구역 6: 성왕국 교단 의료원 & 이단심문소 (D-076·D-078, MD/구역6_설계안.md) — 구역 3 적 5종 + 아래 3종 + 보스 ----
// 그림이 오기 전까지 artAs + tint (구역 3 그림을 잿빛·금빛으로)
Object.assign(ENEMY_TYPES, {
    warden: {
        name: '병동 간수', hp: 300, dps: 0, speed: [68, 82], reward: 1.6,
        artAs: 'netter', tint: 'grayscale(0.7) brightness(1.3) sepia(0.15)',
        // 사슬 투척: 구역 2 그물총 사수 행동 그대로 (맞으면 피해 + 속박)
        net: { range: 280, every: 3.6, dmg: 20, root: 1.2, color: '205, 210, 220' }
    },
    shade: {
        name: '그림자 집행자', hp: 300, dps: 30, speed: [92, 112], reward: 2,
        artAs: 'inquisitor', tint: 'grayscale(0.85) brightness(0.62) drop-shadow(0 0 6px rgba(60, 40, 90, 0.9))',
        // 은신: 반쯤 투명한 채 다가옴(받는 피해 cut 감소) → reveal px 안이면 드러나 hits번 베기(hit × 적 공격 배율, gap초 간격)
        //       → open초 동안 드러난 채 근접 → 다시 숨어 back초 물러났다가 또 다가옴 (tickStealth)
        stealth: { cut: 0.5, reveal: 140, hits: 2, gap: 0.22, hit: 46, open: 2.5, back: 0.7 }
    },
    tithe: {
        name: '헌금 기사', hp: 920, dps: 34, speed: [44, 54], reward: 3, armor: 0.2, knockResist: true, scale: 1.15,
        artAs: 'holyshield', tint: 'sepia(0.9) saturate(2.2) brightness(1.2) drop-shadow(0 0 6px rgba(255, 210, 90, 0.9))',
        aura: { range: 220, cut: 0.2 }   // 축복: 주변 적(자기 빼고) 받는 피해 감소 (battle/enemyField.js tickBlessings)
    },
    orbian: {
        name: '자애의 대사제 오르비안', boss: true, hp: 5000, dps: 0, speed: [30, 30], reward: 70, armor: 0.3, knockResist: true,
        // 임시: 대주교 그림을 흰빛·금빛으로 (악마 그림자 없이)
        artAs: 'archbishop', tint: 'grayscale(0.55) brightness(1.3) sepia(0.3) drop-shadow(0 0 9px rgba(255, 220, 120, 0.85))',
        caster: { hold: 250 },
        // 단죄의 빛: 예고 원 → 빛의 기둥 (기본 공격 — 설계안 기술 셋만으로는 보스가 가만히 있어서, D-078)
        judgment: { every: 9, warn: 1.3, dmg: 0.07, label: '⚠ 단죄의 빛' },
        // 생명의 저울: every초마다 주인공이 그동안 회복한 양의 share만큼 보스가 회복 (battle/player.js healPlayer가 셈)
        scales: { every: 10, share: 0.5 },
        // 헌금 소집: 체력 below 아래에서 every초마다 헌금 기사
        summon: { below: 0.5, every: 14, unit: 'tithe', n: 1, label: '💰 헌금 소집 — 헌금 기사!', fx: 'holyHeal', flash: '#ffd970' },
        // 파문의 종: 예고 warn초 → 보스에서 range px 안이면 팔·몸통 스킬 쿨다운 +cd초 + 작은 피해
        bell: { every: 12, warn: 1.2, range: 560, cd: 2, dmg: 0.03 }
    }
});
// ---- 새 기획 구역 1 · 정부 비밀 토벌군 '블랙 하운드' (D-085, MD/기획_스테이지설계.md 스테이지 1) — 그림 2026-10-25 GPT ----
// 새 행동 (다른 구역도 같은 이름으로 씀): squad(같은 종류가 대열로 함께 나옴) · rocket(곡사 포탄) · emp(스킬 쿨다운 늘리기) ·
// napalm(불 장판 — 위에 있으면 지속 피해) · bite(물어뜯어 출혈 지속 피해) · fly(px만큼 떠서 다님) · laser(보스 일직선 광선)
Object.assign(ENEMY_TYPES, {
    conscript: { name: '징집 보병', hp: 340, dps: 34, speed: [78, 100], reward: 1 },
    riot: {
        name: '진압 방패병', hp: 760, dps: 22, speed: [44, 54], reward: 1.6, armor: 0.4, knockResist: true,
        squad: { n: 3, gap: 46 }   // 티타늄 방패를 든 3열 횡대로 길을 막음
    },
    taser: {
        name: '테이저 요원', hp: 260, dps: 0, speed: [70, 84], reward: 1.5,
        net: { range: 240, every: 4.2, dmg: 14, root: 2, color: '120, 210, 255', label: '⚡ 전기 올가미' }   // 2초간 진격 정지
    },
    rocket: {
        name: '로켓 보병', hp: 250, dps: 0, speed: [62, 74], reward: 1.7,
        rocket: { range: 330, every: 4.6, dmg: 62, apex: 170, dur: 1.15 }   // 느리지만 큰 피해의 곡사 대전차 로켓
    },
    empdrone: {
        name: 'EMP 드론', hp: 220, dps: 0, speed: [72, 86], reward: 1.8, fly: 74,
        emp: { range: 300, every: 6.5, cd: 1.5, dmg: 8 }   // 전파 방해: 팔·몸통 스킬 쿨다운 +1.5초
    },
    hound: {
        name: '전투 군견', hp: 210, dps: 26, speed: [150, 175], reward: 1.2,
        bite: { every: 2.2, ticks: 3, dmg: 9 }   // 다리에 들러붙어 물어뜯음: 출혈 3번
    },
    flamer: {
        name: '화염방사병', hp: 330, dps: 0, speed: [62, 74], reward: 1.8,
        napalm: { range: 210, every: 5.2, sec: 5, width: 130, dps: 14 }   // 5초간 꺼지지 않는 네이팜 불길
    },
    // 구역마다 8판의 중장갑(exo · excavator · executioner · fusionbeast · subwalker · surgeon · steamtank · wolfknight · wreckingcrane · enforcer):
    // 밸런스 1차 (D-087) 체력 2100~3000 → 1800~2100 (스테이지 체력 배율과 겹쳐 두 번 오르던 것), 근접 50~56 → 36~40
    exo: {
        name: '기계화 강화병', hp: 1700, dps: 40, speed: [40, 48], reward: 4, armor: 0.25, knockResist: true,
        cleave: { every: 5.5, dmg: 0.045, label: '👊 외골격 강타', fx: 'chargeImpact' }
    },
    wmdalpha: {
        name: 'WMD-알파', boss: true, hp: 5600, dps: 52, speed: [36, 36], reward: 32, armor: 0.25, knockResist: true,
        // 플라스마 레이저: 붉은 조준선(warn초) → 일직선 광선 (최대 내구도 비율 피해)
        laser: { every: 9, warn: 1.3, dmg: 0.09 }
    }
});
// ---- 새 기획 구역 2 · 에너지 코퍼레이션 중장비 방위군 (D-085, 스테이지 2) — 인간 3종 + 메카·차량 5종, 그림 2026-10-25 GPT ----
// 새 행동: shove(배토판으로 밀어냄 — 주인공 뒤로 밀림), pile(보스 파일벙커: 일직선 땅이 솟구치는 충격파 + 기절)
// 구역 2~10 방패형(dozer · holyshield · boneshield · hatchshield · maidenshield · wireshield · furnaceshield · concretedrone · sonicshield)은
// 막는 역할이라 밸런스 1차 (D-087)에서 근접 22~26 → 12~16 (오래 붙어 있어 8~10판 받는 피해의 25~40%를 차지했음).
// 9초마다 세우는 장벽 체력도 스테이지 체력 배율을 받아 구역 10에서 5700까지 올라 시간을 다 먹음 → 구역 5~10 장벽 기본 체력을
// 실제 체력이 구역 3·4쯤(약 2300)이 되게 낮춤(520 · 500 · 450 · 400 · 370 · 340), 구역 7~10은 11초마다
Object.assign(ENEMY_TYPES, {
    merc: { name: '코퍼레이션 용병', hp: 380, dps: 36, speed: [78, 100], reward: 1 },
    dozer: {
        name: '불도저 드로이드', hp: 950, dps: 12, speed: [40, 48], reward: 2.2, armor: 0.35, knockResist: true,
        shove: { every: 6, push: 70, dmg: 0.02 }   // 배토판으로 밀어붙여 진격을 막음
    },
    harpoon: {
        name: '고압 작살포 트럭', hp: 520, dps: 0, speed: [52, 62], reward: 2,
        ranged: { range: 320, every: 4.4, dmg: 30, slow: 2.6, color: '200, 210, 220', label: '🪝 강철 작살' }   // 다리에 작살 → 감속
    },
    sawdrone: { name: '벌목용 회전톱 드론', hp: 260, dps: 58, speed: [120, 140], reward: 1.4, fly: 46 },   // 빠르게 날아와 외피를 갈아 버림
    acidmech: {
        name: '산성액 투척 메카', hp: 620, dps: 0, speed: [56, 66], reward: 2,
        sludge: { range: 260, every: 4, sec: 5, width: 130, color: '200, 230, 60' }   // 산성액 드럼통 → 웅덩이(감속)
    },
    sonictower: {
        name: '음파 차단 탑', hp: 900, dps: 0, speed: [34, 40], reward: 2.4, knockResist: true,
        emp: { range: 360, every: 6, cd: 1.6, dmg: 10, color: '255, 220, 120', label: '🔊 고주파 — 스킬 쿨다운 +', fx: 'sonicRing' }
    },
    spiderwalker: {
        name: '대물 포격 워커', hp: 700, dps: 0, speed: [46, 56], reward: 2.4,
        rocket: { range: 460, every: 5.4, dmg: 62, apex: 220, dur: 1.35, color: '220, 200, 160' }   // 화면 밖에서 느린 공성 철갑탄
    },
    excavator: {
        name: '채굴용 엑스카베이터', hp: 1800, dps: 36, speed: [36, 44], reward: 4.5, armor: 0.35, knockResist: true,
        cleave: { every: 6, dmg: 0.05, label: '⛏ 유압 드릴', fx: 'chargeImpact' }
    },
    terraformer: {
        name: '기간틱 테라포머', boss: true, hp: 6400, dps: 56, speed: [32, 32], reward: 42, armor: 0.3, knockResist: true,
        // 대지 분쇄 (파일벙커): 보스 앞부터 주인공까지 땅에 경고 → 솟구치는 충격파 (최대 내구도 비율 피해 + 기절)
        pile: { every: 10, warn: 1.3, dmg: 0.09, stun: 0.7 }
    }
});
// ---- 새 기획 구역 3 · 성왕국 이단 토벌대 & 광신도 연합 (D-085, 스테이지 3) — 신성 방패병·이단심문관은 위 구역 3 종류(새 그림) ----
// 새 행동: holywater(그리폰 기수 성수 — 주인공 받는 피해 증가 = 방어력 약화), bolt(발리스타 은제 쐐기 — 피해 + 밀려남)
// 보스 베네딕트: judgment n(빛의 기둥 여러 개가 차례로 따라옴) · drain(검은 촉수 휩쓸기 + 흡혈)
Object.assign(ENEMY_TYPES, {
    zealot: { name: '광신도', hp: 330, dps: 36, speed: [86, 110], reward: 1 },
    lightmage: {
        name: '빛의 마법사', hp: 270, dps: 0, speed: [64, 78], reward: 1.7,
        rocket: { range: 300, every: 3.4, dmg: 38, apex: 130, dur: 0.85, color: '255, 230, 140', fx: 'arrowHit', label: null }   // 빛의 화살 곡사
    },
    battlepriest: {
        name: '전투 신관', hp: 340, dps: 0, speed: [56, 66], reward: 2,
        heal: { every: 2.2, amount: 85, range: 260, keepBack: 250, soldiersOnly: true }   // 십자가 향로: 주변 병사를 계속 치유
    },
    griffon: {
        name: '그리폰 기수', hp: 420, dps: 0, speed: [92, 108], reward: 2, fly: 96,
        holywater: { range: 260, every: 5.5, sec: 5, more: 0.25 }   // 성수 투척: 5초 동안 받는 피해 +25% (방어력 약화)
    },
    ballista: {
        name: '정화의 발리스타', hp: 760, dps: 0, speed: [22, 28], reward: 2.4, knockResist: true,
        bolt: { range: 560, every: 5.2, dmg: 46, push: 90 }   // 먼 거리 은제 쐐기 → 밀려남
    },
    executioner: {
        name: '처형인 성기사', hp: 1850, dps: 38, speed: [38, 46], reward: 4.5, armor: 0.3, knockResist: true,
        cleave: { every: 5.5, dmg: 0.055, label: '⚔ 처형의 대검', fx: 'axeCleave' }
    },
    benedict: {
        name: '타락한 대주교 베네딕트', boss: true, hp: 6000, dps: 0, speed: [30, 30], reward: 52, armor: 0.3, knockResist: true,
        caster: { hold: 230 },
        // 신성한 심판: 빛의 기둥 n개가 gap초 간격으로 주인공을 따라와 떨어짐 / 숨겨진 마성: 검은 촉수 휩쓸기 → 피해의 heal만큼 흡혈
        judgment: { every: 10, warn: 1.1, dmg: 0.05, n: 3, gap: 0.55, label: '⚠ 신성한 심판' },
        drain: { every: 12, warn: 0.9, dmg: 0.07, heal: 0.6, range: 520 }
    }
});
// ---- 새 기획 구역 4 · 별의 사도들과 실패한 진화체들 (D-085, 스테이지 4) — 보스는 위 oculus (새 그림) ----
// 새 행동: heal.haste(혈관 기생충 — 치유한 적을 잠시 광폭화: 빨라짐), eyebeam(안구 감시탑 조준 안광), deathAcid(죽으면 산성 웅덩이)
Object.assign(ENEMY_TYPES, {
    mutant: { name: '진화의 광신도', hp: 360, dps: 36, speed: [80, 104], reward: 1 },
    boneshield: {
        name: '생체 방패수', hp: 700, dps: 14, speed: [44, 56], reward: 2, armor: 0.3, knockResist: true,
        barricade: { range: 300, every: 9, hp: 650, gap: 140, label: '🦴 뼈 방패 장벽!' }
    },
    leechfiend: { name: '심연 촉수귀', hp: 540, dps: 54, speed: [70, 88], reward: 1.8 },
    chimeraslime: {
        name: '키메라 슬라임', hp: 420, dps: 30, speed: [60, 76], reward: 1.2,
        split: { into: 'chimeraslimelet', n: 2 }   // 쓰러지면 작은 슬라임 2기로 딱 한 번 분열
    },
    chimeraslimelet: { name: '작은 슬라임', hp: 160, dps: 18, speed: [86, 100], reward: 0.4, scale: 0.6, artAs: 'chimeraslime' },
    sporecaster: { name: '포자 술사', hp: 270, dps: 0, speed: [66, 80], reward: 1.8, spore: { range: 290, every: [1, 3], dmg: 28 } },
    parasite: {
        name: '혈관 기생충', hp: 240, dps: 0, speed: [74, 90], reward: 2,
        heal: { every: 2.4, amount: 95, range: 240, keepBack: 220, soldiersOnly: true, haste: { sec: 4, mul: 1.6 } }
    },
    eyetower: {
        name: '안구 감시탑', hp: 820, dps: 0, speed: [24, 28], reward: 2.4, knockResist: true,
        eyebeam: { range: 500, every: 5, warn: 0.7, dmg: 36 }   // 보랏빛 안광 (조준선 → 광선)
    },
    fusionbeast: {
        name: '광폭화 융합수', hp: 1900, dps: 36, speed: [36, 44], reward: 4.5, armor: 0.2, knockResist: true,
        deathAcid: { width: 170, sec: 5 }   // 쓰러지면 산성 혈액을 흩뿌림 (웅덩이 — 위에 있으면 감속)
    }
});
// ---- 새 기획 구역 5 · 어비스 연합 해군 & 특수 잠수 부대 (D-085, 스테이지 5) ----
// 새 행동: selfDestruct(맹독 잠수부 — 붙으면 자폭: 피해 + 산성 장판), 보스 cannon(심해 압축포: 조준 → 물기둥, 크게 밀려남)·barrage(폭뢰 융단폭격)
Object.assign(ENEMY_TYPES, {
    marine: { name: '작살총 해병', hp: 380, dps: 38, speed: [78, 100], reward: 1 },
    hatchshield: {
        name: '격벽 방패수', hp: 760, dps: 14, speed: [44, 54], reward: 2, armor: 0.35, knockResist: true,
        barricade: { range: 300, every: 9, hp: 520, gap: 140, label: '🚪 강철 해치 장벽!' }
    },
    netgunner: {
        name: '그물망 사수', hp: 300, dps: 0, speed: [70, 84], reward: 1.6,
        net: { range: 260, every: 4.6, dmg: 16, root: 3, color: '200, 210, 220', label: '🕸 강철 그물 — 3초 속박' }
    },
    mineman: {
        name: '수뢰 투척병', hp: 290, dps: 0, speed: [64, 76], reward: 1.7,
        rocket: { range: 300, every: 4.2, dmg: 46, apex: 150, dur: 1.0, color: '60, 60, 70' }   // 바닥에 닿으면 터지는 폭뢰
    },
    sonardrone: {
        name: '소나 드론', hp: 240, dps: 0, speed: [72, 86], reward: 1.8, fly: 80,
        emp: { range: 320, every: 6.5, cd: 1.6, dmg: 8, color: '120, 230, 220', label: '📡 소나 — 스킬 쿨다운 +', fx: 'sonicRing' }
    },
    toxicdiver: {
        name: '맹독 잠수부', hp: 300, dps: 0, speed: [96, 116], reward: 1.6,
        selfDestruct: { dmg: 0.05, width: 150, sec: 5 }   // 붙으면 맹독 산소통을 터뜨려 자폭 → 산성 장판
    },
    deckgun: {
        name: '함포 포탑', hp: 820, dps: 0, speed: [22, 26], reward: 2.4, knockResist: true,
        bolt: { range: 560, every: 5, dmg: 54, push: 40, color: '255, 200, 120', fx: 'rocketBlast', label: '💥 철갑 유탄' }   // 일직선 철갑 유탄
    },
    subwalker: {
        name: '심해 구축 워커', hp: 1900, dps: 36, speed: [36, 44], reward: 4.5, armor: 0.3, knockResist: true,
        cleave: { every: 6, dmg: 0.05, label: '⚓ 잠수함 강타', fx: 'chargeImpact' }
    },
    ironclad: {
        name: '해군 총사령관 아이언클래드', boss: true, hp: 6800, dps: 54, speed: [30, 30], reward: 60, armor: 0.3, knockResist: true,
        cannon: { every: 9, warn: 1.1, dmg: 0.07, push: 150 },                       // 심해 압축포: 조준선 → 물기둥, 크게 밀려남
        barrage: { every: 13, warn: 1.4, n: 6, spread: 260, radius: 60, dmg: 0.03 }   // 폭뢰 융단폭격: 주인공 둘레 n발
    }
});
// ---- 새 기획 구역 6 · 성혈 의료 기사단 (D-085, 스테이지 6) — 예전 구역 6 종류(warden·shade·tithe·orbian)는 남겨 둠 ----
// 새 행동: ranged.stun(마취 가스 — 기절), napalm.kind(오염된 성수 — 독 장판), spawner(구급 마차 — 보병 배출), toBoss(강제 헌혈 실험체 — 보스에게 걸어감)
// 보스 탐욕의 심장: pulse(핏빛 파동 — 밀쳐냄) · shards(혈정석 쐐기 산탄) · drain(생명력 착취 — 속박 + 흡혈)
Object.assign(ENEMY_TYPES, {
    orderly: { name: '부패한 간병 보병', hp: 380, dps: 38, speed: [78, 100], reward: 1 },
    maidenshield: {
        name: '철의 처녀 방패수', hp: 780, dps: 14, speed: [44, 54], reward: 2, armor: 0.35, knockResist: true,
        barricade: { range: 300, every: 9, hp: 500, gap: 140, label: '⚙ 철의 처녀 장벽!' }
    },
    holywater: {
        name: '오염된 성수 투척병', hp: 290, dps: 0, speed: [64, 78], reward: 1.7,
        napalm: { range: 240, every: 4.6, sec: 5, width: 120, dps: 13, kind: 'holy', color: '220, 190, 255', fx: 'holyWaterSplash' }
    },
    anesthetist: {
        name: '마취의 주술사', hp: 300, dps: 0, speed: [62, 74], reward: 1.8,
        ranged: { range: 280, every: 5.4, dmg: 10, stun: 2, color: '200, 160, 255', label: '💤 마취 가스' }   // 행동 2초 정지
    },
    bloodbagdrone: {
        name: '수혈 팩 드론', hp: 240, dps: 0, speed: [70, 84], reward: 2, fly: 84,
        heal: { every: 2.2, amount: 90, range: 260, keepBack: 240, soldiersOnly: true }
    },
    bloated: {
        name: '강제 수혈 실험체', hp: 420, dps: 0, speed: [70, 84], reward: 1.6,
        selfDestruct: { dmg: 0.045, width: 140, sec: 4, slow: 2, label: '🩸 피의 폭발!' }   // 닿으면 터져 시야·이동 방해
    },
    ambulance: {
        name: '기계화 구급 마차', hp: 1500, dps: 0, speed: [40, 48], reward: 3, armor: 0.3, knockResist: true,
        spawner: { every: 8, unit: 'orderly', max: 2 }   // 안에서 하급 사제를 계속 내보냄 (살아 있는 것 max까지)
    },
    surgeon: {
        name: '처형의 군의관', hp: 1950, dps: 38, speed: [38, 46], reward: 4.5, armor: 0.3, knockResist: true,
        cleave: { every: 5.5, dmg: 0.055, label: '⚙ 전기톱 십자가', fx: 'axeCleave' }
    },
    pauper: {
        name: '수혈용 빈민 실험체', hp: 300, dps: 0, speed: [44, 52], reward: 0.5, toBoss: true,
        artAs: 'bloated', tint: 'grayscale(0.5) brightness(1.15) drop-shadow(0 0 6px rgba(220, 40, 60, 0.9))'
    },
    grailheart: {
        name: '기적의 성배 : 탐욕의 심장', boss: true, hp: 6600, dps: 0, speed: [26, 26], reward: 70, armor: 0.3, knockResist: true, fly: 60,
        caster: { hold: 250 },
        pulse: { every: 9, dmg: 0.05, push: 120, range: 560 },                     // 핏빛 파동: 원형 충격파 → 밀쳐냄
        shards: { every: 11, n: 5, dmg: 0.018 },                                  // 혈정석 쐐기: 부채꼴 산탄
        drain: { every: 14, warn: 1.0, dmg: 0.06, heal: 0.6, range: 600, root: 2, label: '⚠ 생명력 착취' }   // 붉은 마법진 → 피의 촉수: 속박 + 흡혈
    }
});
// ---- 새 기획 구역 7 · 제국 제1 포병 사단 (D-085, 스테이지 7) ----
// 새 행동: rally(돌격 장교 호루라기 — 주변 광폭화 + 보병 소환), mine(지뢰 매설 — 밟으면 기절), mg(기관총 연사), static(움직이지 않음 — 조명탄)
// 보스 베헤모스: cannon.shell(철갑탄 직사 — 밀려남) · incendiary(백린 소이탄 — 불 장판) · treadCharge(궤도 톱니 돌진)
Object.assign(ENEMY_TYPES, {
    trench: { name: '참호 징집병', hp: 400, dps: 40, speed: [78, 100], reward: 1 },
    wireshield: {
        name: '철조망 방패병', hp: 800, dps: 14, speed: [44, 54], reward: 2, armor: 0.35, knockResist: true,
        barricade: { range: 300, every: 11, hp: 450, gap: 140, label: '🪤 철조망 장벽!' }
    },
    grenadier: {
        name: '유산탄 투척병', hp: 300, dps: 0, speed: [64, 78], reward: 1.7,
        rocket: { range: 290, every: 4, dmg: 44, apex: 150, dur: 0.95, color: '120, 110, 90' }   // 터지면 파편이 튀는 수류탄
    },
    gassoldier: {
        name: '독가스 살포병', hp: 320, dps: 0, speed: [62, 74], reward: 1.8,
        sludge: { range: 230, every: 4.4, sec: 5, width: 150, color: '220, 210, 80' }   // 노란 겨자 가스 구름 (위에 있으면 감속)
    },
    mgnest: {
        name: '야전 기관총 좌', hp: 880, dps: 0, speed: [22, 26], reward: 2.4, knockResist: true,
        mg: { range: 480, every: 2.6, shots: 4, gap: 0.12, dmg: 9 }   // 끝없이 쏟아지는 기관총
    },
    officer: {
        name: '돌격 장교', hp: 520, dps: 34, speed: [60, 72], reward: 2.5,
        rally: { every: 11, range: 320, haste: { sec: 5, mul: 1.5 }, unit: 'trench', n: [3, 5] }   // 호루라기: 주변 광폭화 + 참호 보병 3~5명
    },
    sapper: {
        name: '지뢰 매설병', hp: 300, dps: 0, speed: [80, 96], reward: 1.7,
        mine: { range: 280, every: 6.5, stun: 1.2, dmg: 26, sec: 14 }   // 앞길에 대전차 지뢰 → 밟으면 피해 + 기절
    },
    steamtank: {
        name: '증기기관 전차', hp: 2000, dps: 38, speed: [34, 42], reward: 4.5, armor: 0.35, knockResist: true,
        cleave: { every: 6, dmg: 0.05, label: '💥 전차 포격', fx: 'chargeImpact' }
    },
    behemoth: {
        name: '심판의 구포 : 베헤모스', boss: true, hp: 7200, dps: 50, speed: [28, 28], reward: 80, armor: 0.3, knockResist: true,
        cannon: { every: 9, warn: 1.0, dmg: 0.07, push: 120, shell: true, label: '⚠ 철갑탄 직사' },
        incendiary: { every: 12, warn: 1.2, n: 3, width: 140, sec: 5, dps: 0.011 },   // 백린 소이탄: 꺼지지 않는 하얀 불길
        treadCharge: { every: 15, warn: 1.0, dmg: 0.08, push: 140 }                  // 궤도 톱니 돌진
    },
    flare: { name: '조명탄', hp: 260, dps: 0, speed: [0, 0], reward: 0.5, fly: 210, static: true, cls: 'v2-flare' }
});
// ---- 새 기획 구역 8 · 노르딘 왕실 근위대 & 온기 탐식자들 (D-085, 스테이지 8) ----
// 새 행동: thorns(화로 방패 — 근접 화상 반사), thaw(열기 주술사 — 얼어붙은 병사 조각상을 데려와 녹여 깨움)
// 보스 블라디미르: laser(화룡의 숨결 — 불 브레스) · incendiary(잿더미 유성우) · heatSteal(온기 강탈 — 빙결 + 화염 보호막)
Object.assign(ENEMY_TYPES, {
    torch: { name: '횃불 징집병', hp: 420, dps: 42, speed: [78, 100], reward: 1 },
    furnaceshield: {
        name: '화로 방패병', hp: 820, dps: 16, speed: [44, 54], reward: 2.2, armor: 0.35, knockResist: true,
        thorns: { reflect: 0.1, cap: 0.008 },   // 공격하는 몬스터에게 근접 화상 (받은 피해의 10%, 최대 내구도 0.8%까지)
        barricade: { range: 300, every: 11, hp: 400, gap: 140, label: '🔥 화로 방패 장벽!' }
    },
    oilthrower: {
        name: '끓는 기름 투척병', hp: 320, dps: 0, speed: [64, 78], reward: 1.8,
        napalm: { range: 240, every: 4.6, sec: 5, width: 130, dps: 16 }   // 눈을 녹이며 끓어오르는 기름
    },
    hunter: {
        name: '작살총 사냥꾼', hp: 340, dps: 0, speed: [70, 84], reward: 1.8,
        net: { range: 270, every: 4.6, dmg: 18, root: 2.2, color: '200, 200, 210', label: '🪤 강철 덫' }
    },
    heatshaman: {
        name: '열기 주술사', hp: 380, dps: 0, speed: [58, 68], reward: 2.4, caster: { hold: 320 },
        thaw: { statues: [3, 5], after: 7, units: ['torch', 'furnaceshield', 'oilthrower', 'hunter'] }   // 조각상과 함께 나와 after초 뒤 녹여 깨움
    },
    frozenstatue: { name: '얼어붙은 병사 조각상', hp: 380, dps: 0, speed: [0, 0], reward: 0.3, static: true, knockResist: true },
    steambomber: {
        name: '증기 돌파병', hp: 360, dps: 0, speed: [96, 116], reward: 1.6,
        selfDestruct: { dmg: 0.045, width: 0, sec: 0, slow: 2.5, label: '💨 증기 폭발!', fx: 'steamBurst' }   // 뜨거운 수증기로 시야·진격 방해
    },
    heatturret: {
        name: '열광선 포탑', hp: 880, dps: 0, speed: [22, 26], reward: 2.4, knockResist: true,
        emp: { range: 380, every: 6, cd: 1.6, dmg: 12, color: '255, 90, 50', label: '🔥 열광선 — 스킬 쿨다운 +', fx: 'napalmBurst' }
    },
    wolfknight: {
        name: '화염 늑대 기사', hp: 2000, dps: 40, speed: [50, 60], reward: 4.8, armor: 0.3, knockResist: true,
        cleave: { every: 5.5, dmg: 0.055, label: '🐺 화염 늑대 돌격', fx: 'chargeImpact' }
    },
    vladimir: {
        name: '탐욕의 폭군 블라디미르', boss: true, hp: 7600, dps: 58, speed: [28, 28], reward: 90, armor: 0.3, knockResist: true,
        laser: { every: 9, warn: 1.1, dmg: 0.08, label: '⚠ 화룡의 숨결', warnFx: 'fireWarn', beamFx: 'fireBreath', clip: 'breath' },
        incendiary: { every: 12, warn: 1.2, n: 3, width: 140, sec: 5, dps: 0.011, label: '⚠ 잿더미 유성우' },
        heatSteal: { every: 16, warn: 1.2, stun: 1.6, shield: 0.08 }   // 온기 강탈: 빙결(기절) + 화염 보호막(최대 체력 비율)
    }
});
// ---- 새 기획 구역 9 · 골드만 건설 용역 및 중장비 경비대 (D-085, 스테이지 9) ----
// 새 행동: bite.vuln(용접 불꽃 — 약화), rally(안전 감시관 사이렌 — 소환 없이 광폭화만), cleave.push(레킹볼 — 밀려남)
// 보스 파노프티콘: pulse(철골 분쇄 — 밀쳐냄) · barrage.stun(H빔 투하 — 기절) · weakWave(부실의 대가 — 10초 약화)
Object.assign(ENEMY_TYPES, {
    thug: { name: '철거 용역 깡패', hp: 440, dps: 44, speed: [78, 100], reward: 1 },
    concretedrone: {
        name: '콘크리트 방패 드론', hp: 900, dps: 13, speed: [40, 50], reward: 2.2, armor: 0.4, knockResist: true,
        barricade: { range: 300, every: 11, hp: 370, gap: 140, label: '🧱 콘크리트 장벽!' }
    },
    cementsprayer: {
        name: '시멘트 살수병', hp: 340, dps: 0, speed: [64, 78], reward: 1.8,
        sludge: { range: 240, every: 4.2, sec: 5.5, width: 150, color: '170, 170, 165' }   // 닿으면 굳는 시멘트 (위에 있으면 크게 감속)
    },
    rivetsniper: {
        name: '리벳 저격수', hp: 330, dps: 0, speed: [66, 80], reward: 1.8,
        rocket: { range: 330, every: 3.8, dmg: 46, apex: 140, dur: 0.8, color: '200, 200, 210', fx: 'arrowHit' }   // 강철 리벳 곡사
    },
    welderwalker: {
        name: '용접기 워커', hp: 1100, dps: 52, speed: [50, 60], reward: 2.6, knockResist: true,
        bite: { every: 3.4, ticks: 2, dmg: 12, vuln: { sec: 4, more: 0.2 }, label: '🔥 용접 불꽃 — 방어 약화' }
    },
    dynamite: {
        name: '다이너마이트 광부', hp: 380, dps: 0, speed: [100, 120], reward: 1.6,
        selfDestruct: { dmg: 0.07, width: 0, sec: 0, label: '💥 다이너마이트!', fx: 'rocketBlast' }
    },
    safetywarden: {
        name: '안전 감시관', hp: 420, dps: 0, speed: [58, 70], reward: 2.4, caster: { hold: 300 },
        rally: { every: 9, range: 340, haste: { sec: 5, mul: 1.5 } }   // 확성기 사이렌: 주변 용역 광폭화
    },
    wreckingcrane: {
        name: '레킹볼 크레인', hp: 2100, dps: 38, speed: [32, 40], reward: 5, armor: 0.35, knockResist: true,
        cleave: { every: 6, dmg: 0.055, push: 90, label: '⚙ 레킹볼', fx: 'chargeImpact' }
    },
    panopticon: {
        name: '탐욕의 파노프티콘', boss: true, hp: 8000, dps: 56, speed: [24, 24], reward: 100, armor: 0.3, knockResist: true,
        pulse: { every: 9, dmg: 0.06, push: 120, range: 520, label: '⚠ 철골 분쇄', fx: 'chargeImpact' },
        barrage: { every: 12, warn: 1.2, n: 3, spread: 220, radius: 70, dmg: 0.04, stun: 1, label: '⚠ H빔 투하', fx: 'containerSlam' },
        weakWave: { every: 16, sec: 10, more: 0.3 }   // 부실의 대가: 10초 동안 받는 피해 +30%
    }
});
// ---- 새 기획 구역 10 · 언론 통제국 & 세뇌된 진압대 (D-085, 스테이지 10) — 철거 용역 깡패(thug)는 구역 9 그대로 ----
// 새 행동: weaken(스피커 드론 소음 — 주인공·아군 공격력 감소), bolt.fx(우퍼 메카 음파 — 밀어냄)
// 보스 마더 보이스: pulse(주파수 폭발) · echo(거짓의 메아리 — 스킬 봉쇄) · laser(통제 레이저)
Object.assign(ENEMY_TYPES, {
    citizen: { name: '세뇌된 시민', hp: 440, dps: 44, speed: [84, 108], reward: 1 },
    sonicshield: {
        name: '음파 방패 경비대', hp: 860, dps: 16, speed: [44, 54], reward: 2.2, armor: 0.35, knockResist: true,
        barricade: { range: 300, every: 11, hp: 340, gap: 140, label: '🔊 소음 장막!' }
    },
    speakerdrone: {
        name: '스피커 드론', hp: 300, dps: 0, speed: [72, 86], reward: 2, fly: 84,
        weaken: { range: 330, every: 6, sec: 5, cut: 0.25 }   // 끔찍한 소음: 5초 동안 공격력 -25%
    },
    lasersniper: {
        name: '광선 저격 경찰', hp: 340, dps: 0, speed: [66, 80], reward: 1.9,
        eyebeam: { range: 520, every: 4.6, warn: 0.8, dmg: 40 }   // 네온 핑크 일직선 레이저
    },
    jammer: {
        name: '주파수 교란기', hp: 900, dps: 0, speed: [22, 26], reward: 2.4, knockResist: true,
        emp: { range: 400, every: 5.5, cd: 1.8, dmg: 10, color: '255, 60, 200', label: '📡 전자기 펄스 — 스킬 쿨다운 +', fx: 'sonicRing' }
    },
    woofermech: {
        name: '우퍼 메카', hp: 1300, dps: 0, speed: [40, 48], reward: 2.8, armor: 0.25, knockResist: true,
        bolt: { range: 360, every: 6.5, dmg: 30, push: 60, color: '255, 60, 200', fx: 'sonicRing', label: '🔊 음파 충격' }
    },
    enforcer: {
        name: '통제국 집행관', hp: 2100, dps: 40, speed: [40, 48], reward: 5, armor: 0.3, knockResist: true,
        shock: { every: 6, stun: 0.6 }   // 전기 진압봉: 주기적으로 기절
    },
    mothervoice: {
        name: '절대 발언권 마더 보이스', boss: true, hp: 8400, dps: 0, speed: [22, 22], reward: 120, armor: 0.3, knockResist: true, fly: 70,
        caster: { hold: 260 },
        pulse: { every: 9, dmg: 0.06, push: 130, range: 600, label: '⚠ 주파수 폭발', fx: 'sonicRing' },
        echo: { every: 13, sec: 3 },   // 거짓의 메아리: 3초 동안 스킬 봉쇄 (팔·몸통 스킬 쿨다운 +3초)
        laser: { every: 11, warn: 1.3, dmg: 0.09, label: '⚠ 통제 레이저', warnFx: 'neonWarn', beamFx: 'neonBeam' }
    }
});
export const ELITE = { hp: 3, dps: 1.5, scale: 1.3, reward: 4, affixReward: 0.25 };
export const ELITE_AFFIXES = {
    swift: { name: '가속', color: '120, 220, 255', speedMul: 1.6, dpsMul: 1.15 },
    shielded: { name: '보호막', color: '110, 170, 255', shield: 0.4 },
    thorns: { name: '가시', color: '170, 230, 90', reflect: 0.12, cap: 0.01 },
    regen: { name: '재생', color: '90, 255, 140', delay: 2, rate: 0.03 },
    frost: { name: '서리', color: '160, 225, 255', every: 4, slow: 1.5 },
    toxic: { name: '독 구름', color: '190, 230, 40', sec: 4, width: 120 },
    volatile: { name: '폭발', color: '255, 140, 40', delay: 1, radius: 150, dmg: 0.04 },
    iron: { name: '강철', color: '200, 205, 215', cut: 0.2 }
};

const ENEMY_CENTER = 38;   // 적 x(왼쪽 끝)에서 몸 가운데까지 — 겨누기·이펙트 기준 (bases_v2.js aimAt)
const ART_FOOT_B = 58;     // 그림 적의 발 높이 (bottom px)
// 아군 그림 (.ally-minion은 index.css에서 좌우 반전 → 왼쪽을 보는 구운 그림이 오른쪽을 봄)
// 세뇌 보병(타락 히어로 징집, D-020) = 경비병 그림 + 검보라(ui_v2.css), 합성괴인 졸개 = 졸개 그림(D-039)
const ALLY_ART = {
    'v2-mind': { art: 'guard', filter: null },
    'chimera-minion-v2': { art: 'minion', filter: 'drop-shadow(0 0 5px rgba(255, 150, 40, 0.5))' },
    'doll-rabbit-v2': { art: 'rabbit', filter: 'drop-shadow(0 0 4px rgba(90, 230, 240, 0.7))' }   // 뒤틀린 인형사 토끼 인형 (D-049)
};
// 봉합 성녀가 꿰매 일으킨 아군: 쓰러진 적 그림 그대로 + 붉은 실 빛 (battle/saint.js)
const STITCH_FILTER = 'saturate(0.8) sepia(0.25) hue-rotate(-12deg) drop-shadow(0 0 4px rgba(235, 40, 70, 0.85))';
const CREEP = 0.3;       // 원거리·치유형이 제자리에서도 조금씩 다가오는 속도 배율 (사거리가 짧은 캐릭터도 닿게)
// 근접: STOP까지 다가가 멈추고, REACH 안이면 공격 (주인공 공격에 조금 밀려나도 계속 공격)
const MELEE = { stop: 30, reach: 55 };
const FOOT_B = 58;

const rand = ([a, b]) => a + Math.random() * (b - a);

/** 스테이지 비중(mix)대로 적 종류 하나 고름 */
export function pickType(mix) {
    const entries = Object.entries(mix);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of entries) {
        r -= w;
        if (r <= 0) return id;
    }
    return entries[0][0];
}

let artStyles = false;

/** 그림 적·아군의 CSS(종류별 걷기·공격 스프라이트)를 한 번만 주입 */
export function ensureEnemyStyles() {
    if (artStyles) return;
    artStyles = true;
    const css = [`
        #screen-battle-v2 .enemy-entity.v2-enemy.has-art { background: none; animation: none; height: var(--art-h); bottom: ${ART_FOOT_B}px; }
        #screen-battle-v2 .v2-enemy__sprite { position: absolute; bottom: 0; background-repeat: no-repeat; background-size: auto 100%; pointer-events: none; }`];
    for (const [id, a] of Object.entries(ENEMY_ART)) {
        css.push(`
        #screen-battle-v2 .v2-art-${id} { --art-h: ${a.frameHeight}px; }
        #screen-battle-v2 .v2-art-${id} .v2-enemy__sprite {
            left: ${ENEMY_CENTER - a.anchorX}px; width: ${a.frameWidth}px; height: ${a.frameHeight}px;
            background-image: url('${a.walk.src}');
            animation: v2-${id}-walk ${a.walk.duration}s steps(${a.walk.frames}) infinite;
        }
        @keyframes v2-${id}-walk { from { background-position-x: 0; } to { background-position-x: -${a.frameWidth * a.walk.frames}px; } }`);
        for (const clip of Object.keys(a).filter(k => a[k] && a[k].src && k !== 'walk')) {
            const c = a[clip];
            css.push(`
        #screen-battle-v2 .v2-art-${id}.${clipClass(clip)} .v2-enemy__sprite {
            background-image: url('${c.src}');
            animation: v2-${id}-${clip} ${c.duration}s steps(${c.frames}) infinite;
        }
        @keyframes v2-${id}-${clip} { from { background-position-x: 0; } to { background-position-x: -${a.frameWidth * c.frames}px; } }`);
        }
    }
    for (const [cls, { art, filter }] of Object.entries(ALLY_ART)) {
        const m = ENEMY_ART[art];
        if (!m) continue;
        css.push(`
        #screen-battle-v2 .ally-minion.${cls} {
            width: ${m.frameWidth}px; height: ${m.frameHeight}px; bottom: ${ART_FOOT_B}px;
            background-image: url('${m.walk.src}'); background-size: auto 100%;
            animation: v2-${art}-walk ${m.walk.duration}s steps(${m.walk.frames}) infinite;${filter ? `
            filter: ${filter};` : ''}
        }
        #screen-battle-v2 .ally-minion.${cls}.is-attacking {
            background-image: url('${m.attack.src}');
            animation: v2-${art}-attack ${m.attack.duration}s steps(${m.attack.frames}) infinite;
        }`);
    }
    for (const [id, m] of Object.entries(ENEMY_ART)) {
        if (!m.attack) continue;
        css.push(`
        #screen-battle-v2 .ally-minion.v2-stitch-${id} {
            width: ${m.frameWidth}px; height: ${m.frameHeight}px; bottom: ${ART_FOOT_B}px;
            background-image: url('${m.walk.src}'); background-size: auto 100%;
            animation: v2-${id}-walk ${m.walk.duration}s steps(${m.walk.frames}) infinite;
            filter: ${STITCH_FILTER};
        }
        #screen-battle-v2 .ally-minion.v2-stitch-${id}.is-attacking {
            background-image: url('${m.attack.src}');
            animation: v2-${id}-attack ${m.attack.duration}s steps(${m.attack.frames}) infinite;
        }`);
    }
    const style = document.createElement('style');
    style.id = 'enemies-v2-styles';
    style.textContent = css.join('\n');
    document.head.appendChild(style);
}

const clipClass = clip => (clip === 'attack' ? 'is-attacking' : `is-${clip}`);

/** 그림 적: 공격 중이면 공격 스프라이트로 (근접 거리 안에서 때리는 동안) */
function setAttacking(e, on) {
    if (e.attacking === on || !e.art) return;
    e.attacking = on;
    e.dom.classList.toggle('is-attacking', on);
}

/** 그림 적: 한 번만 하는 동작 (마취탄 발사, 치유 분사, 보스 방패 강타) — 한 사이클 뒤 원래 동작으로 */
function playOnce(e, clip) {
    const c = e.art && e.art[clip];
    if (!c || !e.dom) return;
    const cls = clipClass(clip);
    clearTimeout(e.onceTimer);
    e.dom.classList.remove(cls);
    void e.dom.offsetWidth;            // 같은 동작을 다시 처음부터
    e.dom.classList.add(cls);
    e.onceTimer = setTimeout(() => {
        if (e.dom && !(clip === 'attack' && e.attacking)) e.dom.classList.remove(cls);
    }, c.duration * 1000);
}

/** 적 하나를 전장에 만든다. opts: { x, elite, affixes? } */
export function spawnEnemy(b, typeId, opts = {}) {
    ensureEnemyStyles();
    const t0 = ENEMY_TYPES[typeId] || ENEMY_TYPES.guard;
    // 나이트메어 보스: 기술 간격을 줄인 복사본 (difficulty_v2.js bossHaste)
    const t = t0.boss ? hastedType(typeId, t0, b.stage.bossHaste) : t0;
    const se = b.stage.enemy;
    const elite = !!opts.elite && !t.boss;
    const affixes = [];
    if (elite) {
        if (Array.isArray(opts.affixes)) {
            affixes.push(...new Set(opts.affixes.filter(id => Object.hasOwn(ELITE_AFFIXES, id))));
        } else {
            const pool = Object.keys(ELITE_AFFIXES);
            const count = b.stage.affixCount ?? (b.stage.zone >= 3 ? 2 : 1);   // 난이도별 (difficulty_v2.js affixCountFor)
            for (let i = 0; i < count; i++) affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
    }
    const hp = Math.round(t.hp * se.hp * (elite ? ELITE.hp : 1));
    // 그림: 그 종류의 그림 → 없으면 빌린 그림(artAs, 구역 3·4 임시) → 없으면 임시 고블린
    const own = !!ENEMY_ART[typeId];
    const artKey = t.cls ? null : own ? typeId : (t.artAs && ENEMY_ART[t.artAs] ? t.artAs : null);   // cls: 그림 없이 CSS 모양 (조명탄)
    const art = artKey ? ENEMY_ART[artKey] : null;
    const scale = (own ? 1 : t.scale || 1) * (elite ? ELITE.scale : 1);   // 자기 그림은 구운 크기가 곧 게임 크기

    const el = document.createElement('div');
    el.className = `enemy-entity v2-enemy v2-type-${typeId}${art ? ` has-art v2-art-${artKey}` : ''}${t.cls ? ` ${t.cls}` : ''}${elite ? ' is-elite' : ''}${t.boss ? ' is-boss' : ''}`;
    el.dataset.name = `${elite ? `엘리트 ${affixes.length ? `[${affixes.map(id => ELITE_AFFIXES[id].name).join('·')}] ` : ''}` : ''}${t.name}`;
    el.style.left = `${opts.x}px`;
    if (t.fly) el.style.bottom = `${ART_FOOT_B + t.fly}px`;   // 나는 적 (EMP 드론): 땅에서 떠서 다님
    if (scale !== 1) el.style.transform = `scale(${scale})`;
    if (art) {
        const sprite = document.createElement('div');
        sprite.className = 'v2-enemy__sprite';
        sprite.style.animationDelay = `-${(Math.random() * art.walk.duration).toFixed(2)}s`;   // 발걸음이 모두 같지 않게
        el.appendChild(sprite);
    }
    const track = document.createElement('div');
    track.className = 'enemy-hp-track';
    const bar = document.createElement('div');
    bar.className = 'enemy-hp';
    bar.style.width = '100%';
    track.appendChild(bar);
    el.appendChild(track);
    b.domEnemies.appendChild(el);

    const e = {
        id: `${typeId}_${Date.now()}_${Math.random()}`,
        type: typeId, t, x: opts.x, hp, maxHp: hp,
        dps: t.dps * se.dps * (elite ? ELITE.dps : 1),
        speed: rand(t.speed), isBuilding: false, dom: el, hpBar: bar, art, artKey: artKey || typeId, attacking: false,
        elite, affixes, boss: !!t.boss, armor: t.armor || 0, knockResist: !!t.knockResist || affixes.includes('iron'),
        reward: (t.reward || 1) * (elite ? ELITE.reward * (1 + ELITE.affixReward * affixes.length) : 1),
        baseFilter: [own ? '' : t.tint, elite ? 'drop-shadow(0 0 5px #ffd24a)' : '',
            affixes.length ? `drop-shadow(0 0 7px rgb(${ELITE_AFFIXES[affixes[0]].color}))` : ''].filter(Boolean).join(' '),
        cd: { skill: Math.random() * 1.5, smite: 0 }
    };
    if (affixes.includes('swift')) {
        e.speed *= ELITE_AFFIXES.swift.speedMul;
        e.dps *= ELITE_AFFIXES.swift.dpsMul;
    }
    if (affixes.includes('shielded')) e.shield = e.maxShield = e.maxHp * ELITE_AFFIXES.shielded.shield;
    b.updateEnemyFilter(e);
    e.scale = scale;
    b.enemies.push(e);
    if (elite && b.fx) b.fx.play(BATTLE_VFX.eliteSpawn, e.x + ENEMY_CENTER, FOOT_B, { scale: e.scale });
    return e;
}

/**
 * 적 한 명의 이번 프레임 행동 (이동, 공격, 종류별 능력). 기절한 적은 부르지 않는다.
 * frontX: 주인공 앞면 x
 */
export function updateEnemy(b, e, dt, frontX) {
    const t = e.t;
    const blocked = e.healBlockUntil > b.stats.time || e.purifyUntil > b.stats.time;   // 치유 방해 옵션·정화 파동 (battle/growth.js)
    const regen = e.affixes?.includes('regen') && !blocked && ELITE_AFFIXES.regen;
    if (regen && b.stats.time - (e.lastHit || 0) >= regen.delay && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * regen.rate * dt);
        if (e.hpBar) e.hpBar.style.width = `${(e.hp / e.maxHp) * 100}%`;
        e.cd.regenFx = (e.cd.regenFx || 0) + dt;
        if (e.cd.regenFx >= 0.5) {
            e.cd.regenFx = 0;
            b.fx.play(ELITE_VFX.regenMotes, e.x + ENEMY_CENTER, FOOT_B + 30);
        }
    }
    const frost = e.affixes?.includes('frost') && !(e.purifyUntil > b.stats.time) && ELITE_AFFIXES.frost;
    if (frost) {
        e.cd.frostFx = (e.cd.frostFx || 0) + dt;
        if (e.cd.frostFx >= 0.5) {
            e.cd.frostFx = 0;
            b.fx.play({ layers: [{ type: 'motes', count: 4, spread: 40, rise: [10, 25], life: [0.5, 0.8], size: 2, color: frost.color }] },
                e.x + ENEMY_CENTER, FOOT_B + 55);
        }
    }
    const slowMul = e.slowT > 0 ? 0.5 : 1;
    const dist = e.x - frontX;
    // 침묵 (침묵의 방송자, battle/kit.js kitStatus): 원거리·치유·바리케이드·특수 공격·보스 기술을 못 씀 — 걷고 근접으로 때리기만
    const silenced = e.kitSilenceT > 0 || b.supportSilenced?.(e);

    // 수호의 결계: 거리·아군과의 교전 여부와 상관없이 주기마다 금빛 방벽
    if (t.barrier && !silenced) {
        if (e.barrierT > 0) {
            e.barrierT = Math.max(0, e.barrierT - dt);
            if (e.barrierT <= 0) {
                e.baseFilter = e.barrierBaseFilter;
                b.updateEnemyFilter(e);
            }
        }
        e.cd.barrier = (e.cd.barrier || 0) + dt;
        if (e.cd.barrier >= t.barrier.every) {
            e.cd.barrier = 0;
            e.barrierT = t.barrier.sec;
            e.barrierBaseFilter = e.baseFilter;
            e.baseFilter = [e.baseFilter, 'drop-shadow(0 0 10px rgba(255, 220, 120, 0.95))'].filter(Boolean).join(' ');
            b.updateEnemyFilter(e);
            b.createDamagePopup(e.x, 240, '🛡 수호의 결계', false);
            b.fx.play(BOSS_VFX.guardianBarrier, e.x + ENEMY_CENTER, FOOT_B + 90, { follow: () => [e.x + ENEMY_CENTER, FOOT_B + 90] });
        }
    }

    if (t.static) return;   // 움직이지도 공격하지도 않음 (조명탄 — enemyField.js tickFlares가 다룸)
    if (t.thaw) tickThaw(b, e, dt, silenced);   // 열기 주술사 (새 기획 구역 8)
    // 돌격 장교 (새 기획 구역 7): 호루라기 — 주변 적 광폭화 + 참호 보병 소환
    if (t.rally && !silenced) {
        const r = t.rally;
        e.cd.rally = (e.cd.rally ?? r.every * 0.4) + dt;
        if (e.cd.rally >= r.every && dist < 700) {
            e.cd.rally = 0;
            playOnce(e, 'attack');
            sound.play('warning', { rate: 1.8, vol: 0.4 });
            b.createDamagePopup(e.x, 200, r.unit ? '📯 돌격 호루라기!' : '🚨 사이렌 — 광폭화!', false);
            b.enemies.forEach(o => {
                if (o.isBuilding || o.isBarricade || o.boss || Math.abs(o.x - e.x) > r.range) return;
                o.hasteUntil = b.stats.time + r.haste.sec;
                o.hasteMul = r.haste.mul;
            });
            const n = r.unit ? Math.round(rand(r.n)) : 0;   // 구역 9 안전 감시관: 소환 없이 광폭화만
            for (let i = 0; i < n; i++) b.spawnMinion(r.unit, { x: e.x + 40 + i * 34, elite: false });
            b.fx.play(BATTLE_VFX.knockDust, e.x + ENEMY_CENTER, FOOT_B);
        }
    }
    // 강제 헌혈 실험체 (새 기획 구역 6 보스전): 보스에게 걸어감 → 닿으면 흡수 (보스 회복 + 피의 방어막)
    if (t.toBoss) {
        tickDonor(b, e, dt, slowMul);
        return;
    }
    // 구급 마차 (새 기획 구역 6): every초마다 하급 사제를 내보냄 (자기가 내보낸 것이 max 미만일 때)
    if (t.spawner && !silenced) {
        const sp = t.spawner;
        e.cd.spawn = (e.cd.spawn || 0) + dt;
        e.spawned = (e.spawned || []).filter(o => b.enemies.includes(o));
        if (e.cd.spawn >= sp.every && e.spawned.length < sp.max) {
            e.cd.spawn = 0;
            playOnce(e, 'attack');
            const o = b.spawnMinion(sp.unit, { x: e.x - 30, elite: false });
            if (o) e.spawned.push(o);
            b.fx.play(BATTLE_VFX.knockDust, e.x, FOOT_B);
        }
    }
    // 아군 미니언과 맞붙으면 그쪽과 싸움 (공격력이 있는 적만)
    if (e.dps > 0) {
        const ally = b.allies.find(a => e.x - a.x <= 65 && e.x - a.x >= -35);
        if (ally) {
            setAttacking(e, true);
            b.damageAlly(ally, e.dps * dt * b.supportEnemyDamageMul(e));
            return;
        }
    }

    // 보스 기술 (거리와 상관없이 주기마다): 고철왕 자석·고철 낙하 / 대주교·오큘러스 (구역 3·4) / 오르비안 저울·종 (구역 6)
    if (!silenced) {
        if (t.magnet || t.drop) tickBossSkills(b, e, dt, dist);
        if (t.judgment || t.summon || t.wave || t.goo || t.rage) tickAbyssBoss(b, e, dt, dist);
        if (t.scales || t.bell) tickMercyBoss(b, e, dt);
        if (t.laser) tickLaser(b, e, dt);
        if (t.pile) tickPile(b, e, dt);
        if (t.drain) tickDrain(b, e, dt);
        if (t.cannon || t.barrage) tickIronclad(b, e, dt);
        if (t.pulse || t.shards) tickHeart(b, e, dt);
        if (t.incendiary || t.treadCharge) tickBehemoth(b, e, dt);
        if (t.heatSteal) tickHeatSteal(b, e, dt);
        if (t.weakWave || t.echo) tickBroadcastBoss(b, e, dt);
    }

    // 원거리(마취총·오물·그물·마법·포자) · 치유(의무병·수리공·신관) · 뒤에 머무는 보스(caster):
    // 정해진 거리에서 멈추고 천천히 다가오며 능력 사용. 2페이즈(rage)가 되면 caster는 근접으로
    const shot = t.ranged || t.sludge || t.net || t.spell || t.spore || t.rocket || t.emp || t.napalm || t.holywater || t.bolt || t.eyebeam || t.mg || t.mine || t.weaken;
    const hold = shot ? shot.range : t.heal ? t.heal.keepBack : t.caster && !e.raged ? t.caster.hold : 0;
    if (hold) {
        const moving = dist > hold ? 1 : dist > 40 ? CREEP : 0;
        if (moving) moveBy(b, e, e.speed * slowMul * moving * dt);
        if (silenced) return;   // 침묵: 쏘지도 고치지도 못하고 자리만 지킴
        e.cd.skill += dt;
        // 주기가 [최소, 최대]면 쏠 때마다 새로 고름 (마법사·포자 술사 1~3초)
        const every = shot && (Array.isArray(shot.every) ? (e.cd.next ??= rand(shot.every)) : shot.every);
        if (shot && dist <= hold + 20 && e.cd.skill >= every) {
            e.cd.skill = 0;
            if (Array.isArray(shot.every)) e.cd.next = rand(shot.every);
            if (t.ranged) shootTranq(b, e);
            else if (t.sludge) throwSludge(b, e);
            else if (t.net) shootNet(b, e);
            else if (t.spell) castSpell(b, e);
            else if (t.rocket) lobRocket(b, e);
            else if (t.emp) empPulse(b, e);
            else if (t.napalm) throwNapalm(b, e);
            else if (t.holywater) throwHolyWater(b, e);
            else if (t.bolt) shootBolt(b, e);
            else if (t.eyebeam) eyeBeam(b, e);
            else if (t.mg) mgBurst(b, e);
            else if (t.mine) layMine(b, e);
            else if (t.weaken) castWeaken(b, e);
            else lobSpore(b, e);
            if (frost) frostShot(b, frost);
        }
        if (t.heal && e.cd.skill >= t.heal.every) {
            e.cd.skill = 0;
            if (healNearest(b, e) && frost) frostShot(b, frost);
        }
        return;
    }

    // 방벽병: 사거리에 들어오면 멈춰서 바리케이드를 박음 (망치 동작 동안 서 있음)
    if (t.barricade && !silenced) {
        e.cd.build = (e.cd.build ?? t.barricade.every * 0.6) + dt;
        if (e.busyT > 0) {
            e.busyT -= dt;
            return;
        }
        if (dist <= t.barricade.range && dist > MELEE.reach && e.cd.build >= t.barricade.every
            && !b.enemies.some(o => o.isBarricade && Math.abs(o.x - (e.x - 40)) < t.barricade.gap)) {
            e.cd.build = 0;
            e.busyT = 0.9;
            playOnce(e, 'attack');
            b.schedule(0.5, () => {
                if (b.isActive && b.enemies.includes(e)) b.spawnBarricade(e.x - 70, t.barricade.hp * b.stage.enemy.hp, t.barricade.label);
            });
            return;
        }
    }

    // 그림자 집행자 (구역 6): 숨어서 다가와 기습 → 드러난 채 근접 → 다시 숨어 물러남. 침묵이면 숨지 못하고 드러남
    if (t.stealth && silenced && e.hidden) setHidden(e, false, 'open');
    if (t.stealth && !silenced && tickStealth(b, e, dt, dist, slowMul)) return;

    // 근접: 다가가서 닿으면 공격
    if (dist > MELEE.stop) moveBy(b, e, e.speed * slowMul * dt);
    if (dist > MELEE.reach) {
        setAttacking(e, false);
        return;
    }
    if (b.legContact(e)) return;   // 다리 패시브(궤도 돌진)로 밀려남
    if (t.selfDestruct && !silenced) {   // 맹독 잠수부 (새 기획 구역 5): 붙으면 자폭 → 피해 + 산성 장판, 자기는 쓰러짐
        const sd = t.selfDestruct;
        b.fx.play(ELITE_VFX.volatileBlast, e.x + ENEMY_CENTER, FOOT_B);
        b.fx.play(ZONE_VFX[sd.fx || 'gooSplat'], b.monsterX + 60, FOOT_B + 20, { scale: 1.3 });
        b.director.shake(8, 380);
        b.damagePlayer(b.maxPlayerHp * sd.dmg, 0, null, e);
        if (sd.width) b.addPuddle(e.x + ENEMY_CENTER - sd.width / 2, sd.width, sd.sec);
        if (sd.slow) b.applyPlayerSlow(sd.slow);
        b.createDamagePopup(e.x, 170, sd.label || '☠ 맹독 자폭!', false);
        b.dealDamageToEnemy(e, e.hp + e.maxHp, false, null);
        return;
    }
    setAttacking(e, true);
    b.damagePlayer(e.dps * dt, dt, e);   // e: 가시 갑옷 되돌림 대상

    if (silenced) return;   // 침묵: 감전·도끼·방패 강타·정의의 일격·서리 같은 특수 공격 없이 근접만
    if (frost && e.dps > 0) {
        e.cd.frost = (e.cd.frost || 0) + dt;
        if (e.cd.frost >= frost.every) {
            e.cd.frost = 0;
            b.applyPlayerSlow(frost.slow);
            b.fx.play(ELITE_VFX.frostHit, b.monsterX + 60, 110);
        }
    }

    e.cd.skill += dt;
    if (t.shock && e.cd.skill >= t.shock.every) {
        e.cd.skill = 0;
        b.fx.play(BATTLE_VFX.shockHit, b.monsterX + 60, 110);
        sound.play('hero_wave_hit', { rate: 1.5 });
        b.applyPlayerStun(t.shock.stun, '감전!');
    }
    if (t.cleave && e.cd.skill >= t.cleave.every) {   // 악마기사: 도끼 내려찍기 / 기계화 강화병: 외골격 강타 (label·fx)
        e.cd.skill = 0;
        playOnce(e, 'attack');
        b.fx.play(ZONE_VFX[t.cleave.fx || 'axeCleave'], b.monsterX + 70, 100);
        b.director.shake(7, 300);
        b.damagePlayer(b.maxPlayerHp * t.cleave.dmg, 0, null, e);
        b.createDamagePopup(b.monsterX + 30, 210, t.cleave.label || '🪓 도끼 내려찍기', false);
        if (t.cleave.push) b.knockPlayerBack(t.cleave.push, `${t.cleave.label || '강타'}에 밀려남!`);   // 구역 9 레킹볼
    }
    if (t.shove && e.cd.skill >= t.shove.every) {   // 불도저 드로이드: 배토판으로 밀어붙임 → 주인공 뒤로 밀림
        e.cd.skill = 0;
        playOnce(e, 'attack');
        b.fx.play(BATTLE_VFX.shieldBash, b.monsterX + 70, 100);
        sound.play('mech_fist_hit', { rate: 0.7 });
        b.damagePlayer(b.maxPlayerHp * t.shove.dmg, 0, null, e);
        b.knockPlayerBack(t.shove.push, '배토판에 밀려남!');
    }
    if (t.bite && e.cd.skill >= t.bite.every) {   // 전투 군견: 물어뜯기 → 출혈 (1초마다 ticks번)
        e.cd.skill = 0;
        const bt = t.bite;
        playOnce(e, 'attack');
        sound.play('kaiju_bite', { rate: 1.4, vol: 0.6 });
        b.createDamagePopup(b.monsterX + 30, 150, bt.label || '🩸 물어뜯기', false);
        if (bt.slow) b.applyPlayerSlow(bt.slow);
        if (bt.vuln) b.applyPlayerVuln(bt.vuln.sec, bt.vuln.more);   // 구역 9 용접기 워커: 방어 약화
        for (let i = 1; i <= bt.ticks; i++) b.schedule(i, () => {
            if (b.isActive && !b.finalBaseDestroyed) b.damagePlayer(bt.dmg * b.stage.enemy.dps, 0, null, e);
        });
    }
    if (t.bash && e.cd.skill >= t.bash.every) {
        e.cd.skill = 0;
        playOnce(e, 'bash');
        b.fx.play(BATTLE_VFX.shieldBash, b.monsterX + 70, 100);
        sound.play('mech_fist_hit', { rate: 0.8 });
        b.damagePlayer(b.maxPlayerHp * t.bash.dmg, 0, null, e);
        b.applyPlayerStun(t.bash.stun, '방패 강타!');
        b.allies.forEach(a => { a.x -= 40; if (a.dom) a.dom.style.left = `${a.x}px`; });
    }
    if (t.smite) {
        e.cd.smite += dt;
        if (e.cd.smite >= t.smite.every) {
            e.cd.smite = 0;
            smite(b, e);
        }
    }
}

function moveBy(b, e, px) {
    if (e.rootT > 0) return;   // 속박 (저주의 사슬): 제자리에서 공격만
    px *= b.kitEnemyMove ? b.kitEnemyMove(e) : 1;   // 2차 패시브 마왕의 위압: 보통 적 이동 감소 (battle/kit.js)
    if (e.purifyUntil > b.stats.time && e.affixes?.includes('swift')) px /= ELITE_AFFIXES.swift.speedMul;   // 정화 파동: 가속 해제
    if (e.hasteUntil > b.stats.time) px *= e.hasteMul || 1;   // 혈관 기생충 광폭화 (새 기획 구역 4)
    e.x -= px;
    if (e.dom) e.dom.style.left = `${e.x}px`;
    if (px > 0 && e.affixes?.includes('swift') && b.stats.time - (e.cd.swiftFx ?? -Infinity) >= 0.2) {
        e.cd.swiftFx = b.stats.time;
        b.fx.play({ layers: [{ type: 'motes', count: 5, spread: 14, rise: [5, 15], life: [0.2, 0.4], size: 2, color: ELITE_AFFIXES.swift.color }] },
            e.x + ENEMY_CENTER + 20, FOOT_B + 8);
    }
}

// 원거리·치유형 서리: 발사 뒤 짧은 지연, 자기장 방벽이면 감속 시간 절반
function frostShot(b, frost) {
    b.schedule(0.4, () => {
        if (!b.isActive || b.finalBaseDestroyed) return;
        b.applyPlayerSlow(frost.slow * b.rangedMul());
        b.fx.play(ELITE_VFX.frostHit, b.monsterX + 60, 110);
    });
}

// 마취탄: 적 → 주인공 가슴, 맞으면 피해 + 감속
function shootTranq(b, e) {
    playOnce(e, 'attack');
    const from = { x: e.x + 12, bottom: 96 };
    const r = e.t.ranged;
    sound.play(r.label ? 'mech_missile_launch' : 'mech_laser', { rate: r.label ? 1.3 : 1.7, vol: 0.6 });
    b.fx.launchOrb(from, () => ({ x: b.monsterX + 60, b: 120 }), r.color || '90, 230, 255', 0.38, () => {
        if (!b.isActive) return;
        const k = b.rangedMul();   // 자기장 방벽: 원거리 피해·효과 절반
        b.damagePlayer(r.dmg * b.stage.enemy.dps * k, 0, null, e);
        if (r.stun) b.applyPlayerStun(r.stun * k, '마취!');   // 구역 6 마취의 주술사: 감속 대신 기절
        else b.applyPlayerSlow(r.slow * k);
        if (r.label) b.createDamagePopup(b.monsterX + 30, 200, r.label, false);   // 구역 2 작살포 트럭
    }, null);
}

// 오물 투척: 국자로 오물을 던져 주인공 발밑에 늪 장판
function throwSludge(b, e) {
    const s = e.t.sludge;
    playOnce(e, 'attack');
    const from = { x: e.x + 8, bottom: 110 };
    const tx = b.monsterX + 60;
    sound.play('kaiju_spore', { rate: 0.8, vol: 0.6 });
    b.fx.launchOrb(from, () => ({ x: tx, b: FOOT_B + 6 }), s.color || '190, 230, 40', 0.55, () => {
        if (b.isActive) b.addPuddle(tx - s.width / 2, s.width, s.sec * b.rangedMul());
    }, null);
}

// 그물·사슬(병동 간수): 맞으면 피해 + 속박 (진격 불가, 공격은 가능)
function shootNet(b, e) {
    const n = e.t.net;
    playOnce(e, 'attack');
    const from = { x: e.x + 4, bottom: 104 };
    sound.play('mech_missile_launch', { rate: 1.5, vol: 0.5 });
    b.fx.launchOrb(from, () => ({ x: b.monsterX + 60, b: 110 }), n.color || '210, 190, 140', 0.42, () => {
        if (!b.isActive) return;
        const k = b.rangedMul();
        b.damagePlayer(n.dmg * b.stage.enemy.dps * k, 0, null, e);
        b.applyPlayerRoot(n.root * k);
        if (n.label) b.createDamagePopup(b.monsterX + 30, 200, n.label, false);
    }, null);
}

// 로켓 보병 (새 기획 구역 1): 높은 곡사로 느린 대전차 로켓 → 착탄 폭발 큰 피해
function lobRocket(b, e) {
    const r = e.t.rocket;
    playOnce(e, 'attack');
    sound.play('mech_missile_launch', { rate: 0.9, vol: 0.6 });
    b.fx.launchMissile({ x: e.x + 6, bottom: 150 }, () => ({ x: b.monsterX + 60, b: FOOT_B + 30 }), () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX[r.fx || 'rocketBlast'], b.monsterX + 60, FOOT_B + 20);
        if (!r.fx) b.director.shake(6, 260);
        b.damagePlayer(r.dmg * b.stage.enemy.dps * b.rangedMul(), 0, null, e);
    }, { apex: r.apex || 160, dur: r.dur || 1.1, color: r.color || '255, 160, 80' });
}

// EMP 드론 (새 기획 구역 1): 전파 방해 — 작은 피해 + 팔·몸통 스킬 쿨다운 늘리기 (자기장 방벽이면 절반)
function empPulse(b, e) {
    const m = e.t.emp;
    playOnce(e, 'attack');
    const from = { x: e.x + 20, bottom: FOOT_B + (e.t.fly || 0) + 30 };
    b.fx.launchOrb(from, () => ({ x: b.monsterX + 60, b: 130 }), m.color || '120, 210, 255', 0.35, () => {
        if (!b.isActive) return;
        const k = b.rangedMul();
        b.fx.play(ZONE_VFX[m.fx || 'empZap'], b.monsterX + 60, 130);
        if (m.dmg) b.damagePlayer(m.dmg * b.stage.enemy.dps * k, 0, null, e);
        b.delaySkills(Math.round(m.cd * k * 10) / 10, m.label || '📡 전파 방해 — 스킬 쿨다운 +');
    }, null);
}

// 화염방사병 (새 기획 구역 1): 주인공 발밑에 네이팜 — sec초 동안 위에 있으면 초당 dps 피해 (늪처럼 바닥과 함께 흘러감)
function throwNapalm(b, e) {
    const n = e.t.napalm;
    playOnce(e, 'attack');
    const tx = b.monsterX + 60;
    b.fx.launchOrb({ x: e.x + 4, bottom: 100 }, () => ({ x: tx, b: FOOT_B + 6 }), n.color || '255, 140, 40', 0.4, () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX[n.fx || 'napalmBurst'], tx, FOOT_B + 6);
        b.addPuddle(tx - n.width / 2, n.width, n.sec * b.rangedMul(), { fire: n.dps * b.stage.enemy.dps, kind: n.kind });
    }, null);
}

// 그리폰 기수 (새 기획 구역 3): 머리 위에서 성수 투척 → sec초 동안 받는 피해 +more (방어력 약화)
function throwHolyWater(b, e) {
    const h = e.t.holywater;
    playOnce(e, 'attack');
    b.fx.launchOrb({ x: e.x + 20, bottom: FOOT_B + (e.t.fly || 0) + 40 }, () => ({ x: b.monsterX + 60, b: 150 }), '255, 236, 170', 0.45, () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX.holyWaterSplash, b.monsterX + 60, 140);
        b.applyPlayerVuln(h.sec * b.rangedMul(), h.more);
    }, null);
}

// 안구 감시탑 (새 기획 구역 4): 보랏빛 조준선 warn초 → 안광 (피해)
function eyeBeam(b, e) {
    const m = e.t.eyebeam;
    playOnce(e, 'attack');
    const from = () => [e.x + 30, FOOT_B + 120];
    b.fx.play(BOSS_VFX.gazeWarn, e.x + 30, FOOT_B + 120, { to: [b.monsterX + 60, 120], follow: from });
    b.schedule(m.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        b.fx.play(BOSS_VFX.gaze, e.x + 30, FOOT_B + 120, { to: [b.monsterX + 60, 120] });
        b.damagePlayer(m.dmg * b.stage.enemy.dps * b.rangedMul(), 0, null, e);
    });
}

// 정화의 발리스타 (새 기획 구역 3): 먼 거리에서 은제 쐐기 → 피해 + 밀려남
function shootBolt(b, e) {
    const bt = e.t.bolt;
    playOnce(e, 'attack');
    sound.play('mech_missile_launch', { rate: 0.8, vol: 0.6 });
    b.fx.launchNeedle({ x: e.x + 4, bottom: 110 }, () => ({ x: b.monsterX + 60, b: 115 }), () => {
        if (!b.isActive) return;
        const k = b.rangedMul();
        b.fx.play(ZONE_VFX[bt.fx || 'arrowHit'], b.monsterX + 60, 115, { scale: bt.fx ? 1 : 1.6 });
        b.damagePlayer(bt.dmg * b.stage.enemy.dps * k, 0, null, e);
        b.knockPlayerBack(bt.push, bt.label ? `${bt.label}에 밀려남!` : '은제 쐐기에 밀려남!');
    }, { color: bt.color || '220, 230, 240', dur: 0.45, sfx: null });
}

// 보스 '숨겨진 마성' (베네딕트): 예고 → 검은 촉수가 앞을 휩씀, 맞힌 피해의 heal만큼 보스 회복
function tickDrain(b, e, dt) {
    const d = e.t.drain;
    e.cd.drain = (e.cd.drain ?? d.every * 0.7) + dt;
    if (e.cd.drain < d.every || e.x - b.frontX() > d.range) return;
    e.cd.drain = 0;
    playOnce(e, 'drain');
    b.createDamagePopup(e.x, 270, d.label || '⚠ 숨겨진 마성', false);
    b.fx.play(ZONE_VFX.abyssWarn, b.monsterX + 60, FOOT_B);
    b.schedule(d.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        const x = b.monsterX + 60;
        [-30, 10, 50].forEach((dx, i) => b.schedule(i * 0.06, () => b.isActive && b.fx.play(BATTLE_VFX.abyssSpike, x + dx, FOOT_B, { scale: 0.9 })));
        b.director.flash('#4a0010', 260, 0.4);
        const dmg = b.maxPlayerHp * d.dmg;
        b.damagePlayer(dmg, 0, null, e);
        if (d.root) b.applyPlayerRoot(d.root * b.rangedMul());   // 구역 6 탐욕의 심장: 피의 촉수가 발을 묶음
        const gain = Math.min(e.maxHp - e.hp, dmg * d.heal * 2.2);   // 보스 체력이 주인공보다 커서 체감되게 조금 키움
        if (gain >= 1) {
            e.hp += gain;
            if (e.hpBar) e.hpBar.style.width = `${(e.hp / e.maxHp) * 100}%`;
            b.createDamagePopup(e.x - 10, 250, `🩸 흡혈 +${Math.round(gain)}`, false);
            b.updateHud();
        }
    });
}

// 보스 아이언클래드 (새 기획 구역 5): 심해 압축포(조준선 → 물기둥, 피해 + 크게 밀려남) · 폭뢰 융단폭격(주인공 둘레 n발 연쇄 폭발)
function tickIronclad(b, e, dt) {
    const c = e.t.cannon, br = e.t.barrage;
    if (c) {
        e.cd.cannon = (e.cd.cannon ?? c.every * 0.5) + dt;
        if (e.cd.cannon >= c.every) {
            e.cd.cannon = 0;
            playOnce(e, 'cannon');
            const from = () => [e.x + 10, 160];
            b.createDamagePopup(e.x, 280, c.label || '⚠ 심해 압축포', false);
            sound.play('charge_up', { rate: 0.9, vol: 0.6 });
            if (c.shell) {   // 새 기획 구역 7 베헤모스 '철갑탄 직사': 포신을 내려 일직선 포탄 → 폭발 + 밀려남
                b.fx.play(ZONE_VFX.plasmaWarn, e.x + 10, 140, { to: [b.monsterX + 60, 120], follow: () => [e.x + 10, 140] });
                b.schedule(c.warn, () => {
                    if (!b.isActive || !b.enemies.includes(e)) return;
                    sound.play('base_blast', { rate: 1.2, vol: 0.6 });
                    b.fx.launchNeedle({ x: e.x + 10, bottom: 140 }, () => ({ x: b.monsterX + 60, b: 120 }), () => {
                        if (!b.isActive) return;
                        b.fx.play(ZONE_VFX.rocketBlast, b.monsterX + 60, 110, { scale: 1.4 });
                        b.director.shake(10, 450);
                        b.damagePlayer(b.maxPlayerHp * c.dmg, 0, null, e);
                        b.knockPlayerBack(c.push, '철갑탄에 밀려남!');
                    }, { color: '255, 200, 120', dur: 0.25, sfx: null });
                });
                return;
            }
            b.fx.play(ZONE_VFX.waterWarn, e.x + 10, 160, { to: [b.monsterX + 60, 120], follow: from });
            b.schedule(c.warn, () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                b.fx.play(ZONE_VFX.waterBeam, e.x + 10, 160, { to: [b.monsterX + 60, 120] });
                b.director.shake(10, 450);
                b.damagePlayer(b.maxPlayerHp * c.dmg, 0, null, e);
                b.knockPlayerBack(c.push, '압축포에 밀려남!');
            });
        }
    }
    if (br) {
        e.cd.barrage = (e.cd.barrage ?? br.every * 0.7) + dt;
        if (e.cd.barrage >= br.every) {
            e.cd.barrage = 0;
            playOnce(e, 'barrage');
            b.createDamagePopup(e.x, 290, br.label || '⚠ 폭뢰 융단폭격', false);
            const px = b.monsterX + 35;
            const xs = Array.from({ length: br.n }, (_, i) => px + (i / Math.max(1, br.n - 1) - 0.5) * br.spread + (Math.random() - 0.5) * 40);
            xs.forEach(x => b.fx.play(BATTLE_VFX.smiteWarn, x, FOOT_B, { scale: br.radius / 70 }));
            sound.play('warning', { vol: 0.5, rate: 1.2 });
            b.schedule(br.warn, () => {
                xs.forEach((x, i) => b.schedule(i * 0.12, () => {
                    if (!b.isActive) return;
                    b.fx.play(ZONE_VFX[br.fx || 'rocketBlast'], x, FOOT_B + 10);
                    b.director.shake(5, 220);
                    if (Math.abs(b.monsterX + 35 - x) <= br.radius) {
                        b.damagePlayer(b.maxPlayerHp * br.dmg, 0, null, e);
                        if (br.stun) b.applyPlayerStun(br.stun, '철골에 깔림!');   // 구역 9 파노프티콘 H빔
                    }
                }));
            });
        }
    }
}

// 보스 '기적의 성배 : 탐욕의 심장' (새 기획 구역 6): 핏빛 파동(원형 충격파 → 피해 + 밀쳐냄) · 혈정석 쐐기(부채꼴 산탄)
function tickHeart(b, e, dt) {
    const p = e.t.pulse, sh = e.t.shards;
    if (p) {
        e.cd.pulse = (e.cd.pulse ?? p.every * 0.5) + dt;
        if (e.cd.pulse >= p.every && e.x - b.frontX() <= p.range) {
            e.cd.pulse = 0;
            playOnce(e, 'attack');
            b.fx.play(ZONE_VFX[p.fx || 'bloodPulse'], e.x + ENEMY_CENTER, FOOT_B + (e.t.fly || 0) + 90, { scale: p.fx ? 1.6 : 1 });
            b.createDamagePopup(e.x, 280, p.label || '⚠ 핏빛 파동', false);
            b.schedule(0.35, () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                b.director.shake(10, 420);
                b.damagePlayer(b.maxPlayerHp * p.dmg, 0, null, e);
                b.knockPlayerBack(p.push, `${(p.label || '핏빛 파동').replace('⚠ ', '')}에 밀려남!`);
            });
        }
    }
    if (sh) {
        e.cd.shards = (e.cd.shards ?? sh.every * 0.7) + dt;
        if (e.cd.shards >= sh.every) {
            e.cd.shards = 0;
            playOnce(e, 'attack');
            b.createDamagePopup(e.x, 270, '혈정석 쐐기', false);
            const from = { x: e.x + 10, bottom: FOOT_B + (e.t.fly || 0) + 90 };
            for (let i = 0; i < sh.n; i++) {
                const dy = (i - (sh.n - 1) / 2) * 34;   // 부채꼴: 높이를 벌려 쏨 — 가운데 몇 발만 주인공에 맞음
                b.schedule(i * 0.05, () => b.isActive && b.fx.launchOrb(from, () => ({ x: b.monsterX + 60, b: 120 + dy }), '230, 40, 70', 0.42, () => {
                    if (b.isActive && Math.abs(dy) <= 40) b.damagePlayer(b.maxPlayerHp * sh.dmg, 0, null, e);
                }, null));
            }
        }
    }
}

// 강제 헌혈 실험체: 보스에게 걸어가 닿으면 흡수 — 보스 회복 + 피의 방어막 (stage.boss.donors)
function tickDonor(b, e, dt, slowMul) {
    const boss = b.boss;
    if (!boss || !b.enemies.includes(boss)) {
        moveBy(b, e, e.speed * slowMul * dt);   // 보스가 없으면 그냥 다가옴
        return;
    }
    if (!(e.rootT > 0)) {
        e.x = Math.min(e.x + e.speed * slowMul * dt, boss.x);
        if (e.dom) e.dom.style.left = `${e.x}px`;
    }
    if (boss.x - e.x > 20) return;
    const dn = b.stage.boss.donors || { heal: 0.08, shield: 0.06 };
    const gain = Math.min(boss.maxHp - boss.hp, boss.maxHp * dn.heal);
    boss.hp += gain;
    if (boss.hpBar) boss.hpBar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    boss.shield = (boss.shield || 0) + boss.maxHp * dn.shield;
    boss.maxShield = Math.max(boss.maxShield || 0, boss.shield);
    b.updateEnemyFilter(boss);
    b.fx.play(ZONE_VFX.bloodPulse, boss.x + ENEMY_CENTER, FOOT_B + 80, { scale: 0.6 });
    b.createDamagePopup(boss.x - 10, 260, `🩸 강제 헌혈 +${Math.round(gain)} · 피의 방어막`, false);
    b.updateHud();
    if (e.dom) e.dom.remove();
    b.enemies = b.enemies.filter(o => o !== e);
}

// 야전 기관총 좌 (새 기획 구역 7): 짧은 연사 shots발
function mgBurst(b, e) {
    const m = e.t.mg;
    playOnce(e, 'attack');
    for (let i = 0; i < m.shots; i++) b.schedule(i * m.gap, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        sound.play('mech_laser', { rate: 2.2, vol: 0.25 });
        b.fx.launchNeedle({ x: e.x + 4, bottom: 96 }, () => ({ x: b.monsterX + 60, b: 115 + (Math.random() - 0.5) * 30 }), () => {
            if (b.isActive) b.damagePlayer(m.dmg * b.stage.enemy.dps * b.rangedMul(), 0, null, e);
        }, { color: '255, 220, 120', dur: 0.18, sfx: null });
    });
}

// 지뢰 매설병 (새 기획 구역 7): 주인공 앞길에 대전차 지뢰 — 밟으면 피해 + 기절 (enemyField.js tickHazards)
function layMine(b, e) {
    const m = e.t.mine;
    playOnce(e, 'attack');
    const x = b.frontX() + 30 + Math.random() * 60;
    b.addPuddle(x, 46, m.sec, { mine: { stun: m.stun, dmg: m.dmg * b.stage.enemy.dps } });
    b.createDamagePopup(x, 120, '💣 지뢰 매설', false);
}

// 보스 베헤모스 (새 기획 구역 7): 백린 소이탄(주인공 둘레 불 장판 n개) · 궤도 톱니 돌진(주인공 앞까지 밀고 들어옴 → 피해 + 밀려남)
function tickBehemoth(b, e, dt) {
    const inc = e.t.incendiary, tc = e.t.treadCharge;
    if (inc) {
        e.cd.incendiary = (e.cd.incendiary ?? inc.every * 0.6) + dt;
        if (e.cd.incendiary >= inc.every) {
            e.cd.incendiary = 0;
            playOnce(e, 'attack');
            b.createDamagePopup(e.x, 290, inc.label || '⚠ 백린 소이탄', false);
            const px = b.monsterX + 60;
            const xs = Array.from({ length: inc.n }, (_, i) => px + (i - (inc.n - 1) / 2) * inc.width * 0.9);
            xs.forEach(x => b.fx.play(ZONE_VFX.quakeWarn, x, FOOT_B));
            b.schedule(inc.warn, () => xs.forEach((x, i) => b.schedule(i * 0.1, () => {
                if (!b.isActive) return;
                b.fx.play(ZONE_VFX.napalmBurst, x, FOOT_B + 6, { scale: 1.3 });
                b.addPuddle(x - inc.width / 2, inc.width, inc.sec, { fire: b.maxPlayerHp * inc.dps });
            })));
        }
    }
    if (tc && !e.charging) {
        e.cd.treadCharge = (e.cd.treadCharge ?? tc.every * 0.8) + dt;
        if (e.cd.treadCharge >= tc.every) {
            e.cd.treadCharge = 0;
            e.charging = true;
            b.createDamagePopup(e.x, 290, '⚠ 궤도 톱니 돌진', false);
            sound.play('charge_up', { rate: 0.7 });
            b.schedule(tc.warn, () => {
                e.charging = false;
                if (!b.isActive || !b.enemies.includes(e)) return;
                e.x = b.frontX() + 10;
                if (e.dom) e.dom.style.left = `${e.x}px`;
                playOnce(e, 'charge');
                b.fx.play(ZONE_VFX.chargeImpact, b.monsterX + 70, 100);
                b.director.shake(12, 450);
                b.damagePlayer(b.maxPlayerHp * tc.dmg, 0, null, e);
                b.knockPlayerBack(tc.push, '톱니 돌진에 밀려남!');
            });
        }
    }
}

// 열기 주술사 (새 기획 구역 8): 처음에 얼어붙은 병사 조각상 statues개를 데려오고, after초 뒤 녹여 적으로 깨움 (침묵이면 못 깨움)
function tickThaw(b, e, dt, silenced) {
    const th = e.t.thaw;
    if (!e.statues) {
        e.statues = [];
        const n = Math.round(rand(th.statues));
        for (let i = 0; i < n; i++) {
            const s = spawnEnemy(b, 'frozenstatue', { x: e.x - 70 - i * 46, elite: false });
            if (s) e.statues.push(s);
        }
        e.cd.thaw = 0;
        return;
    }
    if (e.thawed || silenced) return;
    e.cd.thaw = (e.cd.thaw || 0) + dt;
    if (e.cd.thaw < th.after) return;
    e.thawed = true;
    playOnce(e, 'attack');
    b.createDamagePopup(e.x, 220, '🔥 해동 — 조각상이 깨어난다!', false);
    e.statues.filter(s => b.enemies.includes(s)).forEach(s => {
        b.fx.play(ZONE_VFX.steamBurst, s.x + ENEMY_CENTER, FOOT_B + 30, { scale: 0.7 });
        if (s.dom) s.dom.remove();
        b.enemies = b.enemies.filter(o => o !== s);
        b.spawnMinion(th.units[Math.floor(Math.random() * th.units.length)], { x: s.x, elite: false });
    });
}

// 보스 블라디미르 '온기 강탈' (새 기획 구역 8): 예고 → 주인공 빙결(기절) + 보스 화염 보호막 (최대 체력 비율)
function tickHeatSteal(b, e, dt) {
    const h = e.t.heatSteal;
    e.cd.heatSteal = (e.cd.heatSteal ?? h.every * 0.8) + dt;
    if (e.cd.heatSteal < h.every) return;
    e.cd.heatSteal = 0;
    playOnce(e, 'attack');
    b.createDamagePopup(e.x, 290, '⚠ 온기 강탈', false);
    b.fx.play(ZONE_VFX.bloodPulse, e.x + ENEMY_CENTER, FOOT_B + 120, { scale: 0.8 });
    sound.play('charge_up', { rate: 0.6, vol: 0.6 });
    b.schedule(h.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        b.fx.play(ELITE_VFX.frostHit, b.monsterX + 60, 110);
        b.director.flash('#9fe0ff', 300, 0.5);
        b.applyPlayerStun(h.stun, '빙결!');
        e.shield = (e.shield || 0) + e.maxHp * h.shield;
        e.maxShield = Math.max(e.maxShield || 0, e.shield);
        b.updateEnemyFilter(e);
        b.createDamagePopup(e.x - 10, 250, '🔥 화염 보호막', false);
    });
}

// 스피커 드론 (새 기획 구역 10): 끔찍한 소음 → sec초 동안 주인공·아군 공격력 감소 (battle/enemyField.js dealDamageToEnemy)
function castWeaken(b, e) {
    const w = e.t.weaken;
    playOnce(e, 'attack');
    b.fx.launchOrb({ x: e.x + 20, bottom: FOOT_B + (e.t.fly || 0) + 30 }, () => ({ x: b.monsterX + 60, b: 130 }), '255, 60, 200', 0.35, () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX.sonicRing, b.monsterX + 60, 130);
        b.applyPlayerWeak(w.sec * b.rangedMul(), w.cut);
    }, null);
}

// 보스 파노프티콘 '부실의 대가'(10초 약화 파동) · 마더 보이스 '거짓의 메아리'(스킬 봉쇄) (새 기획 구역 9·10)
function tickBroadcastBoss(b, e, dt) {
    const w = e.t.weakWave, ec = e.t.echo;
    if (w) {
        e.cd.weakWave = (e.cd.weakWave ?? w.every * 0.6) + dt;
        if (e.cd.weakWave >= w.every) {
            e.cd.weakWave = 0;
            playOnce(e, 'attack');
            b.fx.play(ZONE_VFX.quakeSpike, b.monsterX + 60, FOOT_B);
            b.director.shake(8, 500);
            b.createDamagePopup(e.x, 290, '⚠ 부실의 대가', false);
            b.applyPlayerVuln(w.sec, w.more);
        }
    }
    if (ec) {
        e.cd.echo = (e.cd.echo ?? ec.every * 0.6) + dt;
        if (e.cd.echo >= ec.every) {
            e.cd.echo = 0;
            playOnce(e, 'attack');
            b.fx.play(ZONE_VFX.sonicRing, b.monsterX + 60, 130, { scale: 2 });
            b.director.flash('#ff40c0', 260, 0.4);
            b.delaySkills(ec.sec, '📢 거짓의 메아리 — 스킬 봉쇄 +');
        }
    }
}

// 보스 파일벙커 '대지 분쇄' (기간틱 테라포머): 보스 앞~주인공 사이 땅에 경고 → warn초 뒤 앞에서부터 차례로 솟구침, 주인공 피해 + 기절
function tickPile(b, e, dt) {
    const pl = e.t.pile;
    e.cd.pile = (e.cd.pile ?? pl.every * 0.5) + dt;
    if (e.cd.pile < pl.every) return;
    e.cd.pile = 0;
    playOnce(e, 'pile');
    const x0 = e.x, x1 = b.monsterX + 35;
    const steps = Math.max(2, Math.min(7, Math.round((x0 - x1) / 90)));
    const xs = Array.from({ length: steps + 1 }, (_, i) => x0 + (x1 - x0) * (i / steps));
    xs.forEach(x => b.fx.play(ZONE_VFX.quakeWarn, x, FOOT_B));
    b.createDamagePopup(e.x, 280, '⚠ 대지 분쇄', false);
    sound.play('warning', { vol: 0.5, rate: 1.0 });
    b.schedule(pl.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        xs.forEach((x, i) => b.schedule(i * 0.07, () => b.isActive && b.fx.play(ZONE_VFX.quakeSpike, x, FOOT_B)));
        b.schedule(steps * 0.07, () => {
            if (!b.isActive) return;
            b.director.shake(12, 500);
            b.damagePlayer(b.maxPlayerHp * pl.dmg, 0, null, e);
            b.applyPlayerStun(pl.stun, '대지 분쇄!');
        });
    });
}

// 보스 플라스마 레이저 (WMD-알파): 붉은 조준선 warn초 → 일직선 광선, 최대 내구도 비율 피해
function tickLaser(b, e, dt) {
    const l = e.t.laser;
    e.cd.laser = (e.cd.laser ?? l.every * 0.5) + dt;
    if (e.cd.laser < l.every) return;
    e.cd.laser = 0;
    playOnce(e, l.clip || 'laser');
    const from = () => [e.x + 10, 170];
    b.fx.play(ZONE_VFX[l.warnFx || 'plasmaWarn'], e.x + 10, 170, { to: [b.monsterX + 60, 120], follow: from });
    b.createDamagePopup(e.x, 280, l.label || '⚠ 플라스마 레이저', false);
    sound.play('charge_up', { rate: 1.1, vol: 0.6 });
    b.schedule(l.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        b.fx.play(ZONE_VFX[l.beamFx || 'plasmaBeam'], e.x + 10, 170, { to: [b.monsterX + 60, 120] });
        b.director.flash('#ff3040', 220, 0.45);
        b.director.shake(9, 400);
        b.damagePlayer(b.maxPlayerHp * l.dmg, 0, null, e);
    });
}

// 마법사 (구역 3): 불·번개·얼음 중 하나 — 원소별 피해·상태 이상
const SPELLS = [
    { key: 'fire', name: '🔥', color: '255, 140, 40', sfx: 'zone_spell_fire', fx: 'spellFire' },
    { key: 'bolt', name: '⚡', color: '255, 240, 120', sfx: 'zone_spell_bolt', fx: 'spellBolt' },
    { key: 'ice', name: '❄', color: '150, 220, 255', sfx: 'zone_spell_ice', fx: 'spellIce' }
];
export function castSpell(b, e, key = null) {
    const s = SPELLS.find(s => s.key === key) || SPELLS[Math.floor(Math.random() * SPELLS.length)];
    playOnce(e, 'attack');
    sound.play(s.sfx, { rate: 1.4, vol: 0.5 });
    b.fx.launchOrb({ x: e.x + 10, bottom: 110 }, () => ({ x: b.monsterX + 60, b: 120 }), s.color, 0.36, () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX[s.fx], b.monsterX + 60, 120);
        const spell = e.t.spell, effect = spell[s.key];
        const k = b.rangedMul();
        const dmg = spell.dmg * b.stage.enemy.dps;
        b.damagePlayer(dmg * k * effect.dmgMul, 0, null, e);
        if (effect.burnTicks) {
            b.createDamagePopup(b.monsterX + 40, 200, '🔥 화상', false);
            for (let i = 1; i <= effect.burnTicks; i++) b.schedule(effect.burnEvery * i, () => {
                if (b.isActive && !b.finalBaseDestroyed) b.damagePlayer(dmg * effect.burnMul * k, 0, null, e);
            });
        }
        if (effect.stun) b.applyPlayerStun(effect.stun * k, '감전!');
        if (effect.slow) b.applyPlayerSlow(effect.slow * k);
    }, null);
}

// 포자 술사 (구역 4): 높은 포물선으로 포자 덩어리
function lobSpore(b, e) {
    playOnce(e, 'attack');
    b.fx.launchMissile({ x: e.x + 10, bottom: 120 }, () => ({ x: b.monsterX + 60, b: FOOT_B + 40 }), () => {
        if (!b.isActive) return;
        b.fx.play(ZONE_VFX.sporeBurst, b.monsterX + 60, FOOT_B + 40);
        b.damagePlayer(e.t.spore.dmg * b.stage.enemy.dps * b.rangedMul(), 0, null, e);
    }, { apex: 150, dur: 0.95, color: '150, 255, 90' });
}

// 구역 3·4·6 보스: 대주교 베네딕트(천상의 심판·악마병 소환), 관장자 오큘러스(심연의 파동·유전자 붕괴·극한의 변이·돌진),
// 대사제 오르비안(단죄의 빛 = judgment, 헌금 소집 = summon — 이름·이펙트는 기술 설정의 label·fx·flash)
function tickAbyssBoss(b, e, dt, dist) {
    const t = e.t;
    if (t.rage && !e.raged && e.hp <= e.maxHp * t.rage.at) enrage(b, e);
    if (t.judgment) {
        e.cd.judgment = (e.cd.judgment ?? t.judgment.every * 0.5) + dt;
        if (e.cd.judgment >= t.judgment.every) {
            e.cd.judgment = 0;
            // n개면 gap초 간격으로 차례로 (새 기획 구역 3 베네딕트 '신성한 심판' — 주인공을 따라옴)
            for (let i = 0; i < (t.judgment.n || 1); i++) b.schedule(i * (t.judgment.gap || 0), () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                groundStrike(b, e, t.judgment, 'bash', i ? '' : t.judgment.label || '⚠ 천상의 심판', () => {
                    b.fx.play(ZONE_VFX.heavenPillar, b.monsterX + 35, FOOT_B, { scale: 1 });
                    b.director.flash('#fff6c8', 240, 0.6);
                }, ZONE_VFX.judgmentWarn, ZONE_VFX.heavenPillar);
            });
        }
    }
    if (t.summon && e.hp <= e.maxHp * t.summon.below) {
        const s = t.summon;
        e.cd.summon = (e.cd.summon ?? s.every - 1.5) + dt;   // 처음엔 금방
        if (e.cd.summon >= s.every) {
            e.cd.summon = 0;
            playOnce(e, 'attack');
            b.director.flash(s.flash || '#7a0a1e', 320, 0.35);
            b.createDamagePopup(e.x - 20, 260, s.label || '🔥 지옥문 — 악마병!', false);
            for (let i = 0; i < s.n; i++) {
                const x = e.x - 60 - i * 45;
                b.fx.play(ZONE_VFX[s.fx || 'hellGate'], x + 38, FOOT_B + 30);
                b.spawnMinion(s.unit, { x, elite: false });
            }
        }
    }
    if (t.chain) {
        const c = t.chain;
        e.cd.chain = (e.cd.chain || 0) + dt;
        if (e.cd.chain >= c.every) {
            e.cd.chain = 0;
            playOnce(e, 'attack');
            b.createDamagePopup(e.x, 250, '⚠ 속죄의 사슬', false);
            b.schedule(c.warn, () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                b.fx.launchChain(() => ({ x: e.x + 10, b: 150 }), () => ({ x: b.monsterX + 60, b: 120 }), {
                    color: '255, 214, 120',
                    onHook: () => {
                        if (!b.isActive || !b.enemies.includes(e)) return;
                        b.damagePlayer(b.maxPlayerHp * c.dmg, 0, null, e);
                        b.applyPlayerRoot(c.root * b.rangedMul());
                        b.fx.play(BOSS_VFX.chainHit, b.monsterX + 60, 120);
                    }
                });
            });
        }
    }
    if (t.wave) {
        e.cd.wave = (e.cd.wave ?? t.wave.every * 0.5) + dt;
        if (e.cd.wave >= t.wave.every) {
            e.cd.wave = 0;
            groundStrike(b, e, t.wave, 'drop', '⚠ 심연의 파동', () => {
                const x = b.monsterX + 35;
                [-38, 0, 38].forEach((dx, i) => b.schedule(i * 0.06, () => b.fx.play(BATTLE_VFX.abyssSpike, x + dx, FOOT_B, { scale: 0.8 + i * 0.15 })));
            }, ZONE_VFX.abyssWarn);
        }
    }
    if (t.goo && !e.raged) {
        e.cd.goo = (e.cd.goo ?? t.goo.every * 0.7) + dt;
        if (e.cd.goo >= t.goo.every && dist <= t.goo.range) {
            e.cd.goo = 0;
            playOnce(e, 'magnet');
            b.fx.launchOrb({ x: e.x + 20, bottom: 150 }, () => ({ x: b.monsterX + 60, b: 110 }), '150, 255, 90', 0.5, () => {
                if (!b.isActive) return;
                b.fx.play(ZONE_VFX.gooSplat, b.monsterX + 60, FOOT_B + 30);
                b.createDamagePopup(b.monsterX + 20, 230, '🧬 유전자 붕괴', false);
                b.applyPlayerSlow(t.goo.slow * b.rangedMul());
            }, null);
        }
    }
    if (e.raged && t.rage.charge) {
        const c = t.rage.charge;
        e.cd.charge = (e.cd.charge ?? c.every * 0.5) + dt;
        if (e.cd.charge >= c.every && !e.charging) {
            e.cd.charge = 0;
            e.charging = true;
            b.createDamagePopup(e.x, 270, '⚠ 돌진', false);
            sound.play('charge_up', { rate: 0.8 });
            b.schedule(c.warn, () => {
                e.charging = false;
                if (!b.isActive || !b.enemies.includes(e)) return;
                e.x = b.frontX() + 10;   // 주인공 앞까지 달려듦
                if (e.dom) e.dom.style.left = `${e.x}px`;
                playOnce(e, 'attack');
                b.fx.play(ZONE_VFX.chargeImpact, b.monsterX + 70, 100);
                b.director.shake(12, 450);
                b.damagePlayer(b.maxPlayerHp * c.dmg, 0, null, e);
                b.knockPlayerBack(c.push, '돌진에 밀려남!');
            });
        }
    }
    if (e.raged && t.rage.gaze) {
        const g = t.rage.gaze;
        e.cd.gaze = (e.cd.gaze || 0) + dt;
        if (e.cd.gaze >= g.every) {
            e.cd.gaze = 0;
            b.fx.play(BOSS_VFX.gazeWarn, e.x + 40, 190, { to: [b.monsterX + 60, 120], follow: () => [e.x + 40, 190] });
            b.schedule(g.warn, () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                b.fx.play(BOSS_VFX.gaze, e.x + 40, 190, { to: [b.monsterX + 60, 120] });
                b.damagePlayer(b.maxPlayerHp * g.dmg, 0, null, e);
                b.applyPlayerStun(g.stun, '진홍 시선!');
            });
        }
    }
}

// 그림자 집행자 은신 (구역 6, t.stealth): hidden(숨어서 다가감) → strike(드러나 연속 베기) → open(드러난 채 근접)
// → back(다시 숨어 물러남) → hidden … 숨어 있는 동안(e.hidden) 받는 피해 감소는 battle/enemyField.js dealDamageToEnemy
/** true면 이번 프레임은 여기서 끝, false면 아래 근접 행동 그대로 (open) */
function tickStealth(b, e, dt, dist, slowMul) {
    const s = e.t.stealth;
    if (!e.sState) setHidden(e, true, 'hidden');
    e.sT = (e.sT || 0) - dt;
    if (e.sState === 'hidden') {
        if (dist <= s.reveal) {
            ambush(b, e, s);
            return true;
        }
        setAttacking(e, false);
        moveBy(b, e, e.speed * slowMul * dt);
        return true;
    }
    if (e.sState === 'strike') {
        if (e.sT <= 0) { e.sState = 'open'; e.sT = s.open; }
        return true;
    }
    if (e.sState === 'open') {
        if (e.sT > 0) return false;
        setHidden(e, true, 'back');
        e.sT = s.back;
        b.fx.play(ZONE_VFX.shadowPuff, e.x + ENEMY_CENTER, FOOT_B + 30);
        return true;
    }
    // back: 숨은 채 오른쪽으로 물러남 (속박이면 제자리)
    if (e.sT <= 0) {
        e.sState = 'hidden';
        return true;
    }
    setAttacking(e, false);
    if (!(e.rootT > 0)) {
        e.x = Math.min(e.x + e.speed * 1.6 * dt, 1180);
        if (e.dom) e.dom.style.left = `${e.x}px`;
    }
    return true;
}

function setHidden(e, on, state) {
    e.sState = state;
    e.hidden = on;
    e.dom?.classList.toggle('is-stealth', on);
}

/** 기습: 드러나며 hits번 빠르게 벰 (맞을 때 아직 가까이 있으면 피해) */
function ambush(b, e, s) {
    setHidden(e, false, 'strike');
    e.sT = s.hits * s.gap + 0.25;
    b.fx.play(ZONE_VFX.shadowPuff, e.x + ENEMY_CENTER, FOOT_B + 30);
    b.createDamagePopup(e.x, 200, '🗡 기습!', false);
    for (let i = 0; i < s.hits; i++) {
        b.schedule(0.08 + i * s.gap, () => {
            if (!b.isActive || !b.enemies.includes(e) || e.stunT > 0 || e.x - b.frontX() > s.reveal + 30) return;
            playOnce(e, 'attack');
            b.fx.play(ZONE_VFX.shadowStrike, b.monsterX + 60, 115);
            b.damagePlayer(s.hit * b.stage.enemy.dps, 0, e);
        });
    }
}

// 구역 6 보스 오르비안: 생명의 저울(주인공이 그동안 회복한 양의 일부를 보스가 회복) · 파문의 종(스킬 쿨다운 늘리기)
function tickMercyBoss(b, e, dt) {
    const t = e.t;
    if (t.scales) {
        const sc = t.scales;
        e.cd.healMark ??= b.healTaken || 0;   // 보스가 나온 뒤 회복한 양만 셈
        e.cd.scales = (e.cd.scales || 0) + dt;
        if (e.cd.scales >= sc.every) {
            e.cd.scales = 0;
            const healed = Math.max(0, (b.healTaken || 0) - e.cd.healMark);
            e.cd.healMark = b.healTaken || 0;
            const gain = Math.min(e.maxHp - e.hp, healed * sc.share);
            playOnce(e, 'attack');
            b.fx.play(ZONE_VFX.scalesTilt, e.x + ENEMY_CENTER, FOOT_B + 40);
            if (gain >= 1) {
                e.hp += gain;
                if (e.hpBar) e.hpBar.style.width = `${(e.hp / e.maxHp) * 100}%`;
                b.createDamagePopup(e.x - 10, 250, `⚖ 생명의 저울 +${Math.round(gain)}`, false);
                b.updateHud();
            } else {
                b.createDamagePopup(e.x - 10, 250, '⚖ 저울이 기울지 않는다', false);
            }
        }
    }
    if (t.bell) {
        const bl = t.bell;
        e.cd.bell = (e.cd.bell ?? bl.every * 0.6) + dt;
        if (e.cd.bell >= bl.every) {
            e.cd.bell = 0;
            playOnce(e, 'bash');
            b.fx.play(ZONE_VFX.bellWarn, e.x + ENEMY_CENTER, FOOT_B + 60, { follow: () => [e.x + ENEMY_CENTER, FOOT_B + 60] });
            b.createDamagePopup(e.x, 270, '⚠ 파문의 종', false);
            sound.play('warning', { vol: 0.5, rate: 1.1 });
            b.schedule(bl.warn, () => {
                if (!b.isActive || !b.enemies.includes(e)) return;
                b.fx.play(ZONE_VFX.bellToll, e.x + ENEMY_CENTER, FOOT_B);
                b.director.flash('#fff2c0', 260, 0.4);
                if (e.x - b.frontX() > bl.range) return;
                b.damagePlayer(b.maxPlayerHp * bl.dmg, 0, null, e);
                b.delaySkills(bl.cd, '🔔 파문 — 스킬 쿨다운 +');
            });
        }
    }
}

/** 주인공 발밑 예고 원 → warn초 뒤 hit() + 최대 내구도 비율 피해 (천상의 심판·심연의 파동) */
function groundStrike(b, e, s, clip, label, hit, warnFx = BATTLE_VFX.smiteWarn, hitFx = null) {
    playOnce(e, clip);
    b.fx.play(warnFx, b.monsterX + 35, FOOT_B, { follow: () => [b.monsterX + 35, FOOT_B] });
    if (label) b.createDamagePopup(b.monsterX + 20, 220, label, false);
    sound.play('warning', { vol: 0.5, rate: 1.3 });
    b.schedule(s.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        hit();
        b.director.shake(10, 450);
        if (!hitFx?.sfx) sound.play('chimera_slam', { rate: 0.85 });
        b.damagePlayer(b.maxPlayerHp * s.dmg, 0, null, e);
    });
}

/** 극한의 변이 (오큘러스 2페이즈): 근접 광폭화 — 빠르고 세짐, 진홍 색조·조금 커짐, 배경이 진홍으로 (ui_v2.css .v2-boss-rage) */
function enrage(b, e) {
    b.fx.play(ZONE_VFX.mutationBurst, e.x + 60, FOOT_B + 90);
    const r = e.t.rage;
    e.raged = true;
    e.speed *= r.speedMul;
    e.dps = (e.dps || e.t.dps * b.stage.enemy.dps) * r.dpsMul;
    // 2페이즈 그림(<종류>2, 예: oculus2)이 있으면 바꿔 끼우고 색조 없이 — 없으면 임시로 색조·크기만
    const phase2 = `${e.type}2`;
    if (ENEMY_ART[phase2] && e.dom) {
        e.dom.classList.remove(`v2-art-${e.artKey}`);
        e.dom.classList.add(`v2-art-${phase2}`);
        e.art = ENEMY_ART[phase2];
        e.artKey = phase2;
        e.baseFilter = r.glow || '';
    } else {
        e.baseFilter = r.tint;
        if (e.dom) e.dom.style.transform = `scale(${(e.scale || 1) * r.scale})`;
    }
    b.updateEnemyFilter(e);
    b.director.flash('#ff2040', 480, 0.6);
    b.director.shake(14, 700);
    b.director.stamp('극한의 변이', `${e.t.name} — 외눈 괴수로 변이한다`, 'is-red', 1800);
    document.getElementById('screen-battle-v2')?.classList.add('v2-boss-rage');
}

// 고철왕 기술: 자석으로 붙잡아 뒤로 내던짐 / 예고 원 자리에 고철 낙하
function tickBossSkills(b, e, dt, dist) {
    const t = e.t;
    if (t.scrapWall) {
        const w = t.scrapWall;
        e.cd.scrapWall = (e.cd.scrapWall || 0) + dt;
        if (e.cd.scrapWall >= w.every) {
            e.cd.scrapWall = 0;
            if (!b.enemies.some(o => o.isBarricade && Math.abs(o.x - (e.x - 90)) < w.gap)) {
                playOnce(e, 'drop');
                b.spawnBarricade(e.x - 90, w.hp * b.stage.enemy.hp, '🧲 고철 방벽!');
            }
        }
    }
    e.cd.magnet = (e.cd.magnet || 0) + dt;
    e.cd.drop = (e.cd.drop ?? t.drop.every * 0.5) + dt;
    if (t.magnet && e.cd.magnet >= t.magnet.every && dist <= t.magnet.range) {
        e.cd.magnet = 0;
        const m = t.magnet;
        playOnce(e, 'magnet');
        b.createDamagePopup(e.x, 250, '🧲 자석!', false);
        sound.play('charge_up', { rate: 0.7, vol: 0.7 });
        b.schedule(m.warn, () => {
            if (!b.isActive || !b.enemies.includes(e)) return;
            b.fx.launchOrb({ x: e.x - 20, bottom: 120 }, () => ({ x: b.monsterX + 60, b: 120 }), '120, 200, 255', 0.25, () => {
                if (!b.isActive) return;
                b.knockPlayerBack(m.push, '자석에 붙잡혀 내던져짐!');   // 자기장 방벽은 knockPlayerBack 안에서 절반
                b.applyPlayerStun(m.stun * (b.equippedLegId === 'leg_mech_b' ? 0.5 : 1), '자석!');
            }, null);
        });
    }
    if (t.drop && e.cd.drop >= t.drop.every) {
        e.cd.drop = 0;
        const d = t.drop;
        playOnce(e, 'drop');
        b.fx.play(BATTLE_VFX.smiteWarn, b.monsterX + 35, FOOT_B, { follow: () => [b.monsterX + 35, FOOT_B] });
        b.createDamagePopup(b.monsterX + 20, 220, '⚠ 고철 낙하', false);
        sound.play('warning', { vol: 0.5, rate: 1.2 });
        b.schedule(d.warn, () => {
            if (!b.isActive || !b.enemies.includes(e)) return;
            b.fx.play(BATTLE_VFX.baseBlast, b.monsterX + 35, FOOT_B + 20, { scale: 1.2 });
            b.director.shake(10, 450);
            sound.play('chimera_slam', { rate: 0.8 });
            b.damagePlayer(b.maxPlayerHp * d.dmg, 0, null, e);
        });
    }
}

// 치유·수리: 사거리 안에서 체력 비율이 가장 낮은 적(거점·바리케이드 포함)
function healNearest(b, e) {
    const h = e.t.heal;
    const cands = b.enemies.filter(o => o !== e && o.hp < o.maxHp && Math.abs(o.x - e.x) <= h.range
        && !(o.healBlockUntil > b.stats.time)                                                       // 치유 방해 옵션
        && !(h.soldiersOnly && (o.isBuilding || o.isBarricade)));   // 신관: 병사만
    if (!cands.length) return;
    playOnce(e, 'attack');
    // 수리공은 건물·바리케이드를 먼저
    const fixed = o => o.isBuilding || o.isBarricade;
    const pool = h.repair && cands.some(fixed) ? cands.filter(fixed) : cands;
    const target = pool.sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
    const mul = target.isBarricade ? (h.barricadeMul ?? h.baseMul) : target.isBuilding ? h.baseMul : (h.soldierMul ?? 1);
    const amount = h.amount * b.stage.enemy.hp * mul;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    if (target.hpBar) target.hpBar.style.width = `${(target.hp / target.maxHp) * 100}%`;
    if (h.haste && !target.isBuilding && !target.isBarricade) {   // 혈관 기생충: 치유한 적을 잠시 광폭화
        target.hasteUntil = b.stats.time + h.haste.sec;
        target.hasteMul = h.haste.mul;
        b.fx.play(ZONE_VFX.gooSplat, aimAt(target).x, FOOT_B + 40, { scale: 0.6 });
    }
    if (target.isBuilding) {
        b.currentTargetHp = target.hp;
        b.updateHud();
    }
    const tx = aimAt(target).x;
    b.fx.play(h.soldiersOnly ? ZONE_VFX.holyHeal : KAIJU_VFX.regen, tx, FOOT_B);
    b.createDamagePopup(target.x, target.isBuilding ? 200 : 130, `+${Math.round(amount)} ${h.repair ? '수리' : '치유'}`, false);
    if (!h.soldiersOnly) sound.play('kaiju_regen', { rate: 1.3 });
    return true;
}

// 정의의 일격: 주인공 발밑에 예고 → 잠시 뒤 큰 피해
function smite(b, e) {
    const t = e.t.smite;
    const x = b.monsterX + 35;
    b.fx.play(BATTLE_VFX.smiteWarn, x, FOOT_B, { follow: () => [b.monsterX + 35, FOOT_B] });
    b.createDamagePopup(b.monsterX + 20, 220, '⚠ 정의의 일격', false);
    sound.play('warning', { vol: 0.5, rate: 1.4 });
    b.schedule(t.warn, () => {
        if (!b.isActive || !b.enemies.includes(e)) return;
        b.fx.play(BATTLE_VFX.smiteHit, b.monsterX + 35, FOOT_B);
        b.director.shake(10, 450);
        b.director.flash('#fff6c8', 200, 0.6);
        sound.play('chimera_slam');
        b.damagePlayer(b.maxPlayerHp * t.dmg, 0, null, e);
    });
}

/** 처치 보상 (종류·엘리트 배율) */
export function killReward(b, e) {
    return Math.round(b.stage.reward.kill * (e.reward || 1));
}

