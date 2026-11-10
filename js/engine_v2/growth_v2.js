/* ==========================================================================
   PROJECT: MAD OVERLORD // 강화 외 성장 — 수치 표 (v2, 기획 MD/성장_시스템_기획안.md, Q-006)
   높은 난이도를 파츠 강화만으로는 못 깨게 하고, 그 차이를 아래 길로 채운다.
     파츠 등급·드랍·조각·옵션 (2-1) · 스킬 강화 (2-2) · 전술 모듈 (2-3) · 전장 변이 (2-5) · 파견 (2-6) · 별 사용처 (2-7)
   ※ 수치는 기획안의 추천안 (회의 확인 전, G1~G12). 바꿀 때는 이 파일만 고치면 저장·전투·화면이 같이 바뀐다.
   저장·지급은 progressGrowth_v2.js, 전투 연결은 battle/growth.js.
   ========================================================================== */

// ---- 2-1 파츠 등급 ----
// upCost: 강화(Lv) 비용 배율 — 높은 등급일수록 단계마다 더 비쌈 (2026-11-03 Trello '등급별 강화 비용 차등', 임시 값 Q-018)
// maxLevel: 그 등급의 강화 한도 (D-124 파츠 성장 안 C, Q-041 임시) — 계정 한도(열린 난이도 + 숨김 그룹, progress.maxLevel)와 작은 쪽
export const GRADES = [
    { id: 'common', name: '커먼', color: '170, 176, 190', mul: 1.0, options: 0, upCost: 1.0, maxLevel: 5 },
    { id: 'rare', name: '레어', color: '80, 160, 255', mul: 1.1, options: 1, upCost: 1.3, maxLevel: 7 },
    { id: 'unique', name: '유니크', color: '186, 104, 255', mul: 1.2, options: 2, upCost: 1.7, maxLevel: 9 },
    { id: 'legendary', name: '레전더리', color: '255, 150, 40', mul: 1.35, options: 2, upCost: 2.2, maxLevel: 14 }
];
// 강화비 곡선 (D-124): 기준값 × 0.6 × 레벨^UP_EXP × 등급 배율 — 예전 레벨^1 (DM이 남아돌아 성장 속도를 조각만 정하던 것, tools/tests/growth_model.py)
export const UP_EXP = 1.6;
// 등급 올리기 (D-124): 지금 등급의 강화 한도까지 키운 뒤 조각 + DM + 승급석(스페셜맵 보스 러시) — 예전엔 조각만 (DROP.shardCost)
export const PROMO = {
    rare: { shards: 15, dm: 20000, stones: 6 },
    unique: { shards: 35, dm: 80000, stones: 20 },
    legendary: { shards: 80, dm: 200000, stones: 40 }
};
export const gradeOf = id => GRADES.find(g => g.id === id) || GRADES[0];
/** 등급 단계 열기 (2026-11-03 Trello '파츠 잠금 해제 방식'): 그 캐릭터의 from 등급 파츠를 need개 가져야 그 등급 파츠를 DM으로 사거나 조각으로 만들 수 있음.
 *  드랍으로 받는 파츠·이미 가진 파츠는 막지 않음. 개수 = 캐릭터별, 무료 기본 파츠 포함 (임시 규칙 Q-018) */
export const TIER_UNLOCK = { rare: { from: 'common', need: 3 }, unique: { from: 'rare', need: 4 }, legendary: { from: 'unique', need: 5 } };
export const gradeIndex = id => Math.max(0, GRADES.findIndex(g => g.id === id));

// 옵션: 엘리트 속성·전장 변이에 맞서는 것 위주 (기획안 2-1 표). key = 전투 합계 이름 (battle/growth.js gear)
export const OPTIONS = {
    elite: { name: '엘리트 사냥꾼', desc: '엘리트에게 주는 피해 +15%', key: 'eliteDmg', value: 0.15 },
    shieldBreak: { name: '보호막 파쇄', desc: '보호막에 주는 피해 +60%', key: 'shieldDmg', value: 0.6 },
    reflectBlock: { name: '반사 차단', desc: '되돌아오는 피해 -60%', key: 'reflectCut', value: 0.6 },
    healBlock: { name: '치유 방해', desc: '맞은 적의 재생·치유 3초 정지', key: 'healBlock', value: 3 },
    ccResist: { name: '냉기 저항', desc: '받는 감속·기절·속박 시간 -30%', key: 'ccCut', value: 0.3 },
    siege: { name: '공성', desc: '거점·바리케이드 피해 +15%', key: 'siegeDmg', value: 0.15 },
    bossHunter: { name: '보스 사냥꾼', desc: '보스 피해 +12%', key: 'bossDmg', value: 0.12 },
    swift: { name: '신속 진격', desc: '진격 속도 +8%', key: 'speed', value: 0.08 },
    recharge: { name: '재충전', desc: '스킬 쿨다운 -8%', key: 'cdr', value: 0.08 }
};
// 같은 옵션이 여러 파츠에 붙으면 더함 — 위쪽 한도
export const OPTION_CAPS = { reflectCut: 0.9, ccCut: 0.7, cdr: 0.35, healBlock: 3 };

// ---- 드랍 (회의 ③ + 브레인스토밍 6) ----
export const DROP = {
    chance: 0.25,            // 클리어 때 파츠 1개 확률 (회의 20~30%)
    affinityBonus: 0.02,     // 그 구역 상성 캐릭터로 들어가면 (회의 1~2%)
    bossFirstClear: true,    // 보스전(○-B) 첫 클리어는 확정 (난이도마다)
    grades: {                // 난이도별 등급 비율
        normal: { common: 1 },
        hard: { rare: 0.8, unique: 0.2 },
        hell: { unique: 0.8, legendary: 0.2 },
        nightmare: { legendary: 1 }
    },
    // 같거나 높은 등급을 이미 가졌을 때: DM 환급 + 파츠 조각
    refund: { common: { dm: 150, shards: 1 }, rare: { dm: 400, shards: 3 }, unique: { dm: 800, shards: 6 }, legendary: { dm: 1500, shards: 12 } },
    // (등급 올리기 비용은 위 PROMO로 옮김 — D-124. 예전 shardCost: 레어 15 · 유니크 35 · 레전더리 80, 조각만)
    // 드랍 묶음 가중 (Q-008 · 새캐릭터 기획안 3장): 어느 묶음에서 뽑을지 → 그 안에서 같은 확률. 그 캐릭터에 없는 묶음은 빼고 다시 나눔
    //   base = 기본·강화, rare = 레어 세트 ①~④, unique = 유니크 세트 ①~③, legendary = 레전더리 세트 ①·② (sets_v2.js, D-071)
    poolWeights: {
        normal: { base: 1 },
        hard: { base: 0.4, rare: 0.6 },
        hell: { base: 0.2, rare: 0.4, unique: 0.4 },
        nightmare: { base: 0.1, rare: 0.3, unique: 0.4, legendary: 0.2 }
    },
    // 보스전 첫 클리어 확정 드랍은 이 묶음에서 (없으면 다음 묶음): 새 장비를 바로 보게
    firstClearGroups: {
        normal: ['base'],
        hard: ['rare', 'base'],
        hell: ['unique', 'rare', 'base'],
        nightmare: ['legendary', 'unique', 'rare', 'base']
    },
    // 조각으로 세트 파츠 만들기 (안 가진 부위, 등급 바닥으로 나옴) — 드랍 운이 나빠도 끝이 보이게
    craftCost: { rare: 30, unique: 80, legendary: 200 },
    // 판 클리어 드랍 = 파츠 대신 공용 파츠 조각 (11-05 피드백 23번, Q-029 임시 — 만들기 비용의 약 1/10, 커먼은 2)
    //   확률·등급표는 위 그대로 (chance · grades), 보스전 첫 클리어 확정 드랍만 파츠 그대로
    shardDrop: { common: 2, rare: 3, unique: 8, legendary: 20 }
};
// 구역 상성 캐릭터 (추천안 — 구역 이야기와 맞춘 짝)
export const AFFINITY = { 1: ['mech', 'frost'], 2: ['kaiju', 'doll'], 3: ['hero', 'saint'], 4: ['chimera', 'diver'], 5: ['diver'], 6: ['saint'], 7: ['doll'], 8: ['frost'], 9: ['architect'], 10: ['broadcaster'] };   // 구역 6 = 성녀의 구역 (D-078), 구역 5 = 길잡이의 구역 (새 기획 D-085)

// ---- 2-2 스킬 강화 ----
export const SKILL_LEVEL = {
    max: 5,
    dmgPer: 0.1,                                      // 레벨마다 스킬 피해 +10% (Lv5 +40%)
    cdCut: { 3: 0.1, 4: 0.1, 5: 0.2 },                // Lv3·4 쿨다운 -10%, Lv5 -20%
    cost: [null, { cores: 5, dm: 500 }, { cores: 10, dm: 1000 }, { cores: 20, dm: 2000 }, { cores: 40, dm: 4000 }]   // [n] = Lv n → n+1
};
// 스킬 코어 (새 재화): 엘리트·보스 처치. 난이도 보상 배율을 곱해 반올림
export const CORES = { elite: 1, boss: 5 };

// ---- 2-3 전술 모듈 (구매형 보조 스킬, 키 4·5) ----
export const MODULE_SLOTS = { normal: 1, hard: 2, hell: 2, nightmare: 2 };   // 가장 높은 열린 난이도 기준
export const MODULE_MAX_LEVEL = 3;                                         // 레벨마다 쿨다운 -10%
export const MODULE_LEVEL_COST = [null, 1500, 3000];                         // [n] = Lv n → n+1 (DM)
export const MODULES = {
    purify: { name: '정화 파동', icon: 'wave', color: '#ffe08a', cd: 25, stars: 8, range: 450, sec: 4,
        desc: '앞쪽 적의 엘리트 효과 4초 끄기 (보호막 제거·재생 정지·가속 해제·가시·강철 무효)' },
    barrier: { name: '방벽 발생기', icon: 'shield', color: '#7fd4ff', cd: 30, stars: 8, sec: 6,
        desc: '6초간 감속·기절·속박 면역' },
    repair: { name: '긴급 수리', icon: 'redcross', color: '#7dff9a', cd: 40, stars: 6, heal: 0.3,
        desc: '내구도 30% 회복' },
    orbital: { name: '궤도 지원 사격', icon: 'orbital', color: '#d75aff', cd: 45, stars: 10, dmg: 10, range: 800,
        desc: '가장 가까운 거점에 큰 피해 (기본 공격 10타)' },   // 30타는 최종 기지를 한 방에 부숴 너무 셈 (D-064 측정)
    timeWarp: { name: '시간 왜곡', icon: 'slow', color: '#9fb4ff', cd: 35, stars: 10, sec: 5,
        desc: '화면 안 모든 적 5초 감속' },
    overcharge: { name: '과충전', icon: 'overdrive', color: '#ff9628', cd: 50, stars: 12, gauge: 0.35,
        desc: '필살기 게이지 +35%' }
};

// ---- 2-6 파견 (자동 파밍) ----
export const DISPATCH = {
    hours: 3,
    slots: { normal: 1, hard: 2, hell: 3, nightmare: 3 },   // 가장 높은 열린 난이도 기준 (+ 연구)
    // 구역별 보상 — 파츠는 레어 이하만 (브레인스토밍 7 "일정 등급 이하")
    reward: zone => ({ dm: 1500 * zone, shards: 2 + zone, cores: 3 + zone, partChance: 0.3 })
};

// ---- 2-7 별 사용처 ----
// 캐릭터 합류 (D-119 10번 — 별로 사던 것(D-044)을 바꿈): 구역 n의 첫 판 n-1이 열리면(= 앞 구역 보스전 노말 첫 클리어) 그 구역 캐릭터가 저절로 합류.
// 스테이지 1~10 = 캐릭터 스토리 순서 (MD/기획_스테이지설계.md). 기본 캐릭터 거대로봇은 처음부터
export const CHARACTER_ZONE = { kaiju: 2, hero: 3, chimera: 4, diver: 5, saint: 6, doll: 7, frost: 8, architect: 9, broadcaster: 10 };
// 예전 별 해금 값 — 그때 별로 연 캐릭터의 별을 한 번 돌려줄 때만 씀 (progressGrowth_v2.js loadGrowth)
export const LEGACY_CHARACTER_STARS = { kaiju: 6, hero: 6, chimera: 9, diver: 12, saint: 12, frost: 15, doll: 15, architect: 18, broadcaster: 18 };
// 계정 연구: 레벨마다 별 비용 (작은 영구 보너스)
export const RESEARCH = {
    dropRate: { name: '드랍 감지기', desc: '파츠 드랍 확률 +1%p', per: 0.01, max: 3, stars: [5, 8, 12] },
    dmBoost: { name: '다크 매터 정제', desc: '전투 DM +5%', per: 0.05, max: 3, stars: [5, 8, 12] },
    coreBoost: { name: '코어 추출', desc: '스킬 코어 +20%', per: 0.2, max: 3, stars: [5, 8, 12] },
    shardBoost: { name: '조각 회수', desc: '중복 환급 조각 +25%', per: 0.25, max: 2, stars: [6, 10] },
    dispatchTime: { name: '파견 효율', desc: '파견 시간 -10%', per: 0.1, max: 3, stars: [6, 10, 14] },
    dispatchSlot: { name: '파견 확장', desc: '파견 칸 +1', per: 1, max: 1, stars: [15] },
    supportCooldown: { name: '협력 호출 최적화', desc: '협력 첫 충전·재충전 -3초 (40→37→34→31초)', per: 3, max: 3, stars: [5, 8, 10] }
};

// 캐릭터 외형 (D-119 11번, Q-046 임시): 캐릭터마다 색을 바꿔 입는 외형 2종, 하나에 별 25개 — 리그 그림 전체에 색 필터(hue)를 씌움.
// 새 그림 없이 시작. 헬·나이트메어 별의 쓰임 (11번 배분표 500개)
export const SKIN_STARS = 25;
export const SKINS = {
    mech: [{ id: 'mech_crimson', name: '진홍 장갑', filter: 'hue-rotate(150deg) saturate(1.2)' }, { id: 'mech_phantom', name: '팬텀 블랙', filter: 'saturate(0.35) brightness(0.8) contrast(1.15)' }],
    kaiju: [{ id: 'kaiju_magma', name: '용암 비늘', filter: 'hue-rotate(-75deg) saturate(1.3)' }, { id: 'kaiju_glacier', name: '빙하 비늘', filter: 'hue-rotate(110deg) saturate(0.9) brightness(1.1)' }],
    hero: [{ id: 'hero_gilded', name: '황금 타락', filter: 'hue-rotate(-120deg) saturate(1.2) brightness(1.08)' }, { id: 'hero_ash', name: '잿빛 기사', filter: 'grayscale(0.7) brightness(0.95)' }],
    chimera: [{ id: 'chimera_toxic', name: '맹독 변이', filter: 'hue-rotate(80deg) saturate(1.3)' }, { id: 'chimera_void', name: '공허 변이', filter: 'hue-rotate(200deg) saturate(1.1)' }],
    diver: [{ id: 'diver_abyss', name: '심해 검은 잠수복', filter: 'saturate(0.5) brightness(0.75) contrast(1.2)' }, { id: 'diver_coral', name: '산호 잠수복', filter: 'hue-rotate(160deg) saturate(1.2)' }],
    saint: [{ id: 'saint_snow', name: '순백 성의', filter: 'saturate(0.3) brightness(1.2)' }, { id: 'saint_night', name: '밤의 성녀', filter: 'hue-rotate(230deg) saturate(1.1)' }],
    doll: [{ id: 'doll_rose', name: '장미 인형극', filter: 'hue-rotate(150deg) saturate(1.2)' }, { id: 'doll_sepia', name: '빛바랜 인형극', filter: 'sepia(0.7) saturate(1.1)' }],
    frost: [{ id: 'frost_aurora', name: '오로라', filter: 'hue-rotate(90deg) saturate(1.3)' }, { id: 'frost_crimson', name: '붉은 서리', filter: 'hue-rotate(160deg) saturate(1.2)' }],
    architect: [{ id: 'architect_steel', name: '강철 현장', filter: 'saturate(0.3) brightness(1.05)' }, { id: 'architect_neon', name: '네온 철거', filter: 'hue-rotate(190deg) saturate(1.3)' }],
    broadcaster: [{ id: 'broadcaster_cyan', name: '청색 주파수', filter: 'hue-rotate(160deg) saturate(1.2)' }, { id: 'broadcaster_mono', name: '흑백 방송', filter: 'grayscale(0.85) contrast(1.1)' }]
};
export const skinById = id => Object.values(SKINS).flat().find(s => s.id === id) || null;
export const skinCharacterOf = id => Object.keys(SKINS).find(c => SKINS[c].some(s => s.id === id)) || null;

/**
 * 별 용도별 배분 (D-119 11번, Q-046 임시). 별은 판 첫 기록으로만 얻어 총량이 정해짐: 110판 × 3개 × 난이도 4 = 1,320개
 * (그룹 1만 열리면 792). 용도별 몫 + 남겨 둘 몫(reserve, 다음 그룹·이벤트·1인 컨텐츠) = 총량.
 * 실제 값(MODULES·RESEARCH·SKINS 합)은 그 용도 몫을 넘지 않게, traits는 3번 '캐릭터 특성'이 들어오면 채움 (tools/tests/test_groups.py가 확인)
 */
export const STAR_BUDGET = { reserve: 326, planned: { modules: 54, research: 200, traits: 240, skins: 500 } };

// ---- 2-5 나이트메어 전장 변이 (주마다 바뀜) ----
export const MUTATORS = {
    icefloor: { name: '얼음 바닥', desc: '진격 속도 -15%', icon: 'snow', moveMul: 0.85, counter: '신속 진격 옵션' },
    bloodmoon: { name: '핏빛 달', desc: '적이 쓰러지면 작은 폭발 (가까우면 내구도 -2%)', icon: 'fire', deathBlast: 0.02, counter: '원거리 공격·긴급 수리' },
    ironwall: { name: '철벽', desc: '거점이 받는 피해 -20%', icon: 'fort', siegeCut: 0.2, counter: '공성 옵션·궤도 지원 사격' },
    reinforce: { name: '증원', desc: '적 소환 간격 -15%', icon: 'minions', spawnMul: 0.85, counter: '시간 왜곡' },
    overload: { name: '과부하', desc: '스킬 쿨다운 +20%', icon: 'stun', cdMul: 1.2, counter: '재충전 옵션' },
    venom: { name: '맹독', desc: '엘리트 독 구름이 2배 오래·1.5배 넓게', icon: 'acid', toxicMul: 2, toxicWidth: 1.5, counter: '방벽 발생기·신속 진격' }
};
export const MUTATOR_ORDER = ['icefloor', 'bloodmoon', 'ironwall', 'reinforce', 'overload', 'venom'];

/** 이번 주 전장 변이 (서버 없이: 1970-01-05 월요일부터 센 주 번호) */
export function weeklyMutator(now = Date.now()) {
    const week = Math.floor((now - Date.UTC(1970, 0, 5)) / (7 * 24 * 3600 * 1000));
    return MUTATOR_ORDER[((week % MUTATOR_ORDER.length) + MUTATOR_ORDER.length) % MUTATOR_ORDER.length];
}

/** 무게표에서 하나 뽑기 { a: 0.8, b: 0.2 } */
export function pickWeighted(table, rnd = Math.random) {
    const entries = Object.entries(table);
    let r = rnd() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) {
        r -= w;
        if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
}
