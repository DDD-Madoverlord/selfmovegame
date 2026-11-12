/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 수치 (v2)
   밸런스를 맞출 때 고치는 곳을 한 파일에 모았다. 적 능력치는 enemies_v2.js의 ENEMY_TYPES,
   스테이지(거리·제한 시간·적 구성·거점 체력·보상)는 stages_v2.js, 스킬 수치는 skills_v2.js.
   ========================================================================== */

// ---- 팩션 스킬 (컨셉 시트 기준) ----
export const PHASE2 = { hpRatio: 0.5, shieldRatio: 0.3, dpsMul: 1.3 };            // 합성괴인 머리: 2페이즈 거대화 + 실드
// 산란(거대괴수 몸통 스킬)과 스웜 드론(거대로봇 머리 필살기)은 액티브 스킬로 발동 (skills_v2.js)
export const EGG = { hatchSec: 1.6 };
export const BABY = { hp: 260, dps: 22, speedMul: 0.6 };
// 합성괴인 졸개: 주인공 능력치를 따라 커짐 (공격력 ×dps, 체력 ×hp) — 고정 17.5/350이던 때는 뒤 구역·거점에서 피해가 안 보였음 (2026-10-18, D-057)
export const MINION = { dps: 0.12, hp: 0.14 };
// 아군(소환수·졸개) 싸움 유지 (battle/allies.js tickAllies): 싸우는 중이면 stick px 더 멀어져도 계속, 시작한 공격 동작은 hold초는 끝까지
// — 주인공 공격에 적이 조금씩 밀려 경계(65px)를 오가면 공격·걷기가 1초에 3~4번 바뀌어 공격 동작이 끝나지 못하고 팔만 떨며 앞으로 감 (11-08 QA, 얼음 기사)
export const ALLY_FIGHT = { stick: 45, hold: 0.6 };
export const DRONE = { dmgMul: 0.35, splash: 70 };
// 타락 히어로: 머리 세뇌 파동(처치한 적 징집 확률 = 파츠 설명 25%), 몸통 흑마법 오라, 팔 어둠 파동(관통 + 감속)
// curseZone: 적 왼쪽 끝 기준 저주 범위 (몸 앞 기준 px). auraDx: 저주 장판 중심 (몸 앞 기준, 장판은 발밑~범위 끝)
// wavePierce: 관통 파동이 두 번째 적부터 주는 피해 배율 (적을 지날 때마다 곱해짐, 밸런스 1차)
export const HERO = { recruitChance: 0.1, curseTick: 0.65, curseZone: [-40, 180], curseDps: 22, auraDx: 65,
    waveRange: 280, slowSec: 2.5, slowMul: 0.5, wavePierce: 0.3, waveMax: 4, waveBaseMul: 0.7 };   // waveBaseMul: 파동이 거점·바리케이드에 주는 피해 배율 · wavePierce 0.5 → 0.4 (11-03, Q-018) → 0.3 + 최대 4명 (D-119 관통 2차)
// 팩션 패시브 수치 (밸런스 1차): 괴수 머리 재생(최대 체력 비율/초), 합성괴인 다리 지진(초당 피해), 괴수 다리 포자(초당 피해)
export const PASSIVE = { regen: 0.012, quakeDps: 30, sporeDps: 30 };
export const HIT_REACT = { flashMs: 80, knockPx: 10, stopSec: 0.05 };
// 적 몸 반응 (Q-008 Q4): 맞으면 그림이 발끝 기준으로 뒤로 젖혀졌다 돌아옴(deg·ms, 밀리지 않는 적은 bossDeg),
// 쓰러지면 뒤로 넘어지며 사라짐(fallMs, 보스 fallBossMs) — 그동안 처치 판정·보상은 이미 끝남
export const ENEMY_REACT = { deg: 7, bossDeg: 2, ms: 170, fallMs: 420, fallBossMs: 700 };
// 다리 패시브 (설명: skills_v2.js LEG_PASSIVES). 궤도 돌진: 피해(기본 1타 배수)·넉백·기절·재사용 / 반중력 부양: 피해 감소율
export const LEG = { ramDmg: 1.5, ramKnock: 3, ramStun: 0.6, ramCd: 4, hoverReduce: 0.3 };
// 주인공 상태 이상 (적 공격): 감속 = 진격 속도·동작 속도 감소, 기절 = 공격·진격·스킬 멈춤
export const PLAYER_STATUS = { slowMove: 0.5, slowAnim: 0.55 };
// 과부하: 내구도 0 → sec초 동안 멈춤(무적) → 최대 내구도 × restore로 수리 (D-028)
// 다시 일어날 때 회복: 0.5 → 1.0 (11-05 피드백 21번 목숨 뒤 110판 측정 — 목숨 2개에 50% 회복이면 레이저 98 → 69판,
// 그동안 '무한 부활 + 50%' 기준으로 맞춘 판이 많아서. 다 채워 일어나면 목숨 2개 = 체력 3칸 → 예전 깬 판의 약 89/98)
export const OVERLOAD = { sec: 4, restore: 1.0 };
// 전투 목숨 (11-05 피드백 21번, Q-028 임시): 내구도 0에서 과부하·긴급 수리로 다시 일어나는 횟수. 다 쓰고 또 쓰러지면 패배 (D-028의 '죽지 않음'을 바꿈)
export const LIVES = { free: 2, pass: 4 };
// 산성 발톱 팔(arm_mutant, D-030): 물린 적·거점 부식 — 초당 피해 = 주인공 DPS × dpsMul (거점 × baseMul)
export const ACID = { dpsMul: 0.14, baseMul: 2, sec: 3 };
// 심연의 길잡이 (새 캐릭터, D-044) — 효과는 battle/diver.js, 스킬은 skills_v2.js
//   기본 공격 고압 방수포: 사거리 안 적을 모두 꿰뚫음, 두 번째 적부터 피해 × jetPierce (적마다 곱해짐), 작은 넉백
//   앵커 견인: 피해(기본 1타 배수)·기절(초), 끌려와 멈추는 자리 = 주인공 앞면 + pullGap, 감는 시간 = pullSec
//   고압 분사: 물결이 지나간 적 피해·밀어냄(넉백 배율, 10px 단위)·감속, 거점은 피해만
//   심연의 손: 최대 handsMax명, 첫 피해·붙잡기(기절 초)·지속 피해(주인공 DPS 배율, 거점 × handsBaseMul, handsSec초)
//   잠수화(다리 패시브): 밀려남(넉백) 감소율 push, 감속·속박 시간 감소율 slow
export const DIVER = {
    jetPierce: 0.3, jetMax: 4, jetKnock: 0.4,   // 0.6 → 0.45 (11-03, Q-018) → 0.3 + 최대 4명 (D-119 관통 2차)
    anchorDmg: 1.5, anchorStun: 1.6, pullGap: 30, pullSec: 0.35,
    surgeDmg: 1.2, surgeKnock: 7, surgeRange: 160,
    handsMax: 6, handsDmg: 1.5, handsHold: 2.5, handsSec: 4, handsDps: 0.35, handsBaseMul: 2,
    boots: { leg_diver: { push: 0.6, slow: 0.5 }, leg_diver_up: { push: 0.8, slow: 0.7 } }
};
// 봉합 성녀 (새 캐릭터, D-046) — 효과는 battle/saint.js, 스킬은 skills_v2.js
//   봉합 표식: 바늘·장판에 맞은 병사에 markSec초 — 표식이 남은 채 쓰러지면 바닥에 시체(corpseSec초, 최대 corpseMax)
//   봉합 실(기본 공격): 바늘이 꽂힌 적에서 radius px 안 다른 적 linkN명까지 실이 이어져 피해 × linkMul + 표식
//     (바늘 한 줄로는 계속 나오는 병사를 못 따라잡아 요새 앞에서 멈췄음 — 밸런스 1차 측정)
//   3연발: 바늘 셋 tripleGap초 간격, 피해(기본 1타 배수)·묶음(초)
//   생명 봉인: sealSec초, 장판 = 주인공 앞면 기준 sealZone px(중심 sealDx), 초당 피해(기본 1타 배수), sealTick마다 다시 묶음
//   억지 부활: 최대 reviveMax명(시체 먼저, 모자라면 체력이 가장 낮은 병사), 아군 상한 allyMax,
//             아군 체력 = 원래 최대 체력 × allyHp (allyHpMin~allyHpMax), 공격력 = 원래 × allyDps
//   자가 봉합(다리 패시브): 초당 회복 = 최대 내구도 × (base + k × 잃은 비율)
export const SAINT = {
    markSec: 5, corpseSec: 14, corpseMax: 8,
    linkN: 2, linkRadius: 140, linkMul: 0.5,
    tripleGap: 0.18, tripleDmg: 1.2, tripleStun: 0.9,
    sealSec: 4, sealZone: [-30, 230], sealDx: 100, sealDps: 0.5, sealTick: 0.5,
    reviveMax: 3, allyMax: 8, allyHp: 0.7, allyHpMin: 300, allyHpMax: 1000, allyDps: 0.7,
    regen: { leg_saint: { base: 0.003, k: 0.017 }, leg_saint_up: { base: 0.004, k: 0.024 } }
};
// 서리의 무희 (새 캐릭터, D-046) — 효과는 battle/frost.js, 스킬은 skills_v2.js
//   냉기: 맞을 때마다 쌓여 freezeAt이면 freezeSec초 빙결(보스는 안 얼음), chillSec초 안 맞으면 사라짐
//   서리 부채(기본 공격): 앞의 적 fanTargets명까지, 두 번째부터 피해 × fanSecond, 냉기 1
//   초승달 참격: 지나간 적 모두 피해(기본 1타 배수)·냉기 crescentChill
//   눈보라 춤: blizzardSec초, 주인공 앞면 기준 blizzardZone px(중심 blizzardDx), 초당 피해·blizzardTick마다 냉기 1,
//             그동안 무희가 받는 피해 × (1 - blizzardGuard)
//   영원한 안식: 최대 restMax명을 restSec초 가뒀다 깨뜨림 — 피해 restDmg (거점·바리케이드 restBaseDmg)
//   빙판 걸음(다리 패시브): 얼어 있는 적에게 주는 피해 × (1 + shatter)
export const FROST = {
    freezeAt: 4, freezeSec: 1.0, chillSec: 4,
    fanTargets: 2, fanSecond: 0.4,   // 0.5 → 0.4 (D-119 관통 2차)
    crescentDmg: 1.6, crescentChill: 2,
    blizzardSec: 4, blizzardZone: [-120, 170], blizzardDx: 20, blizzardDps: 0.45, blizzardTick: 0.6, blizzardGuard: 0.3,
    restMax: 8, restSec: 2.4, restDmg: 3, restBaseDmg: 2.5,
    shatter: { leg_frost: 0.3, leg_frost_up: 0.45 }
};
// 뒤틀린 인형사 (새 캐릭터, D-049) — 효과는 battle/doll.js, 스킬은 skills_v2.js
//   가위 참격(기본 공격): 방어(armor) 중 pierce 비율만큼 무시
//   가위 참격 X자: 가장 가까운 적부터 xWidth px 안 적 모두 피해(기본 1타 배수, 거점 xBaseDmg), 방어 xPierce 무시
//   인형 가족: 토끼 인형 rabbitCount기(최대 rabbitMax), 체력·초당 피해·이동 속도(px/초, 주인공 속도와 따로),
//             붙잡으면 holdSec초씩 멈춤 — 붙잡힌 적은 발버둥쳐 인형에게 (적 공격력 × struggle)/초 피해,
//             쓰러지면 burstRadius px 안 피해 burstDmg (거점·바리케이드 × burstBaseMul)
//   인형 실: 최대 puppetMax명 puppetSec초 꼭두각시 — puppetReach px 안 다른 적을 (적 공격력 × puppetDpsMul + 기본 1타 × puppetUnit)/초로 때림,
//           보스는 puppetBossStun초 멈춤만
//   실 걸음(다리 패시브): 토끼 인형 하나마다 진격 속도 + stride (최대 strideMax기)
export const DOLL = {
    pierce: 0.5,
    xWidth: 170, xDmg: 1.8, xBaseDmg: 1.5, xPierce: 0.6,
    rabbitCount: 3, rabbitMax: 4, rabbitHp: 420, rabbitDps: 16, rabbitSpeed: 90, holdSec: 0.35, struggle: 1.2,
    burstRadius: 90, burstDmg: 0.6, burstBaseMul: 0.5,
    puppetMax: 4, puppetSec: 4, puppetReach: 130, puppetDpsMul: 1.0, puppetUnit: 0.1, puppetBossStun: 1.2,
    stride: { leg_doll: 0.05, leg_doll_up: 0.07 }, strideMax: 4
};
// 근접 기본 공격 휩쓸기: 맞은 적 뒤 radius px 안의 적에게도 피해 × mul (거대 캐릭터가 무리를 쳐냄)
// 근접 기본 공격 (11-03 근거리 상향, Q-018): 휩쓸기 반경 60 → 80, 둘레 피해 0.4 → 0.6, 주 대상 피해 ×1.15 (dmg)
// → D-119 근거리 스플래시: 반경 80 → 110, 둘레 0.6 → 0.75
export const MELEE_CLEAVE = { radius: 110, mul: 0.75, dmg: 1.15 };

// 원거리·근거리 차등 (D-119 4·13번, Q-039 임시 = 사용자 요청 값): 팔 공격 종류로 나눔 (role_v2.js roleOfArm)
//   move = 진격 속도 배율, taken = 받는 피해 배율(방어력 = 1 − taken), dps = 공격력 배율 — progress_v2.js statsFor가 능력치에 곱함
export const ROLE = {
    melee: { move: 2, taken: 0.75, dps: 1.2 },
    ranged: { move: 0.5, taken: 1.2, dps: 0.85 },
    mid: { move: 1, taken: 1, dps: 1 }
};
// 관통 2차 (D-119): 2차 세트 관통 기본 공격(kit.js pierce)의 줄어드는 배율에 곱함 (예: 0.6 → 0.48)
export const PIERCE2 = { kitDecay: 0.8 };
// 캐릭터 고유 특성 (D-119 6번, battle/traits.js) — 파츠와 상관없이 항상
export const SIGNATURE = {
    mech: { meleeGuard: 0.1, anchorDmg: 0.15 },   // 주먹이면 받는 피해 −10%, 원거리 팔로 멈춰 쏘면 +15%
    kaiju: { siege: 0.3 },                         // 거점·바리케이드 +30%
    hero: { slowedDmg: 0.12 },                     // 감속된 적 +12%
    chimera: { minionDmg: 0.25 },                  // 졸개 공격력 +25%
    diver: { heldDmg: 0.15 },                      // 기절·붙잡힌 적 +15%
    saint: { stitchHeal: 0.02 },                   // 봉합 표식 적 처치 → 내구도 2%
    doll: { heldDmg: 0.2 },                        // 기절·붙잡힌 적 +20%
    frost: { frozenDmg: 0.2 },                     // 얼어 있는 적 +20%
    architect: { siege: 0.25 },                    // 거점·바리케이드 +25%
    broadcaster: { silence: 1 }                    // 기본 공격에 맞은 보통 적 1초 침묵
};

// ---- 기존 4종 A·B 세트 (D-050 파츠 확장 1차, 효과는 battle/sets.js · 스킬은 skills_v2.js) ----
// 피해 배율은 기본 1타(u) 기준, dps가 붙은 것은 주인공 DPS 대비 초당 피해 비율
export const SET = {
    // 새 기본 공격: 레일건 관통(뒤로 갈수록 × pierce), 산성 침 웅덩이, 암흑 구체 폭발, 산탄(가까운 적 max명, 둘째부터 × mul)
    rail: { pierce: 0.3, max: 4, extra: 40 },   // 0.6 → 0.45 (11-03, Q-018) → 0.3 + 최대 4명 (D-119 관통 2차)
    spit: { puddleSec: 2.5, puddleW: 70, puddleDps: 0.12 },
    orb: { splash: 70, splashMul: 0.5 },
    shotgun: { max: 4, mul: 0.55 },
    // 밀고 가는 돌진 (방패 돌진, 디스코드 QA 11-05): 만난 적을 몸 앞 gap px에 붙여 같이 밀고 감 (battle/sets.js dashForward)
    shove: { gap: 20, stack: 40 },   // stack: 밀려가는 적끼리 띄우는 간격 (한 자리에 겹쳐 하나처럼 보이지 않게)
    // 타락 기사 대검: 넓게 휩쓸기 (기본 근접 휩쓸기 60px·40%보다 넓고 셈)
    greatsword: { radius: 120, mul: 0.65 },
    // 버프: 오버드라이브(공격 속도·진격 속도·받는 피해), 아드레날린(주는 피해), 가시 갑옷(받는 피해·되돌림), 어둠의 서약(흡수 회복)
    overdrive: { sec: 6, atk: 1.5, move: 0.4, reduce: 0.3 },
    adrenaline: { sec: 8, dmg: 0.4 },
    thorn: { sec: 6, reduce: 0.25, reflect: 0.5 },
    blood: { sec: 6, ratio: 0.2 },
    // 졸개: 총동원령(4기 + 졸개 피해 ×2), 강화 주사(졸개 체력 50% 회복 + 공격 빨라짐 = 피해 ×1.5)
    mobilize: { count: 4, sec: 6, allyMul: 2, cap: 10 },
    boost: { heal: 0.5, sec: 6, allyMul: 1.5 },
    // 소환·설치: 자동 포탑(sec초, every초마다 u × dmg), 그림자 분신(count명, 기본 공격마다 × mul), 블랙홀(radius 안 끌어당김 px/초)
    turret: { sec: 8, every: 0.3, dmg: 0.35, range: 150 },
    clones: { sec: 6, count: 2, mul: 0.5, gap: 55 },
    blackHole: { sec: 3, radius: 170, pull: 140, dps: 0.45 },
    // 다리 패시브
    anchor: { dmg: 0.2 },                          // 포격 고정: 멈춰 공격하는 동안 피해 +20%
    magField: { reduce: 0.5 },                     // 자기장 방벽: 원거리 공격 피해·효과 50% 감소
    shell: { reduce: 0.15 },                       // 단단한 껍질: 받는 피해 15% 감소, 밀려나지 않음
    sprint: { move: 0.3, clear: 40 },              // 질주 본능: 사거리 + clear px 안에 적이 없으면 진격 +30%
    indomitable: { below: 0.3, reduce: 0.4 },      // 불굴: 내구도 30% 아래에서 받는 피해 40% 감소
    dodge: { chance: 0.25 },                       // 그림자 회피: 25% 확률로 피해 무시
    stomp: { dmg: 0.35, range: 130 },              // 짓밟기: 걸음마다 앞쪽 충격파 (u × dmg)
    commander: { perAlly: 0.05, max: 4 },          // 졸개 지휘: 졸개 하나마다 주는 피해 +5% (최대 4기)
    // 레어 세트 4부위 효과 (Q-008, sets_v2.js SETS — 센 세트는 작게, 약한 세트는 약점 메우기)
    setBonus: {
        railCharge: 0.85,                                  // 포격 사령부: 충전 레일 사격 충전 1초 → 0.7초 → 0.85초 (D-119 — 구역 1을 평균 51초에 다 깸)
        dashShock: { radius: 130, stun: 0.5, dmg: 0.6 },   // 돌격 강습대: 로켓 돌진 끝 충격파 (u × dmg, 보통 적 기절)
        thornMove: 0.3, thornReflect: 0.8,                 // 가시 갑각: 가시 갑옷 동안 진격 +30%, 되돌림 80%
        toxicBaseMul: 2, acidSpread: 120, acidSec: 3,      // 독안개: 독 구름·웅덩이 거점 2배, 산성 적이 쓰러지면 120px 안 적에게 3초
        whirlSpins: 4, whirlAdvance: 90,                   // 타락 기사: 4회전, 도는 동안 앞으로 90px
        clonesExtra: 1,                                    // 그림자 마도사: 분신 +1
        minionBlast: { radius: 90, dmg: 0.8 }              // 조직 사령관: 졸개가 쓰러질 때 폭발 (u × dmg)
    },
    // 합성괴인 추가 머리 화룡 머리 「용의 숨결」(세트 밖, D-054): 입에서 breathSec초 불길, 앞쪽 u × hitMul, 바닥 width px가 zoneSec초 불탐(초당 공격력 × zoneDps)
    dragonBreath: { breathSec: 1.6, hitMul: 1.5, width: 280, zoneSec: 4, zoneDps: 0.8 }
};

// ---- 걸음 맞추기 (Q-008 퀄리티업 Q2) ----
// 바닥 배경·바닥에 놓인 것(구역·장판·잔해·시체)이 흐르는 빠르기와 걷기 동작 빠르기를 실제 진격 속도에 맞춤:
//   배율 = (이동 속도 × 진격 배율) ÷ ref, 바닥은 ground 범위로, 걷기 동작은 anim 범위로 자름 (속도 ref = 예전처럼 배경 3초에 한 바퀴)
export const WALK_SYNC = { ref: 120, ground: [0.35, 3.2], anim: [0.6, 1.9] };   // D-119: 근거리 ×2 · 원거리 ×0.5 속도까지 바닥이 미끄러지지 않게 넓힘

// ---- 반응 동작 (Q-008 퀄리티업 Q4, rig/reactions.js) ----
// 주인공 움찔: 한 방 공격은 hitEvery초에 한 번까지, 계속 맞는 근접 피해는 meleeEvery초마다
export const REACT = { hitEvery: 0.25, meleeEvery: 0.7 };

// ---- 화면 배치 ----
// 피해 숫자: 같은 자리 연속 표시는 위로 쌓고, 지속 피해(아군 미니언 등)는 모아서 0.5초마다 표시
export const POPUP = { column: 36, stackMs: 350, stackPx: 15, dotFlushSec: 0.5 };
export const FOOT_B = 58;   // 지면 이펙트 높이 (bottom px)
// 거점 건물 왼쪽 끝 위치 (전장 1280px 기준): 그림 폭(약 220px)이 하단 오른쪽 스킬 도크(약 x 965부터)에 가리지 않게
export const BASE_X = { mid: 720, final: 720 };
