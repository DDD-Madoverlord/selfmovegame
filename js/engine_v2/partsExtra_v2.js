/* ==========================================================================
   PROJECT: MAD OVERLORD // v2 전용 추가 파츠
   js/data/parts.js는 구버전과 같이 쓰므로 고치지 않고, v2가 시작할 때 이 목록을 PARTS_DB에 더한다.
   (구버전 모드는 v2 모듈을 불러오지 않으므로 영향 없음)

   arm_mutant 산성 발톱 팔 (거대괴수): 결정 D-030
     - 괴수 팩션에 팔 파츠가 없어 기본 로봇 주먹을 쓰던 문제(공격력 부족) 해결
     - 기본 공격(물기)에 산성 부식: 물린 적·거점이 몇 초간 지속 피해 (거점 2배) — battle/tuning.js ACID
     - 팔 스킬 "산성 돌진" — skills_v2.js acidCharge

   기존 4종 파츠 확장 (D-050, 1차 안 그대로): 캐릭터마다 A·B 세트 × 4부위 = 32개.
     - id `<슬롯>_<캐릭터>_<a|b>`, 그림은 `rigVariant`(리그 부위 그림 `_a`/`_b`), 스킬·패시브는 skills_v2.js

   추가 파츠 (세트 밖, 2026-10-17, D-054): head_chimera_dragon 화룡 머리 (합성괴인) — rigVariant 'dragon'
     (그림 head_dragon, tools/rig/cut_chimera_dragon.py), 필살기 용의 숨결(skills_v2.js dragonBreath)

   심연의 길잡이 파츠 8개 (새 캐릭터 1, D-044): 부위마다 기본 → 강화
     - 팩션 '심연의 길잡이 (심해)' — 이 팩션 파츠는 캐릭터 diver (roster_v2.js ROSTER, D-051 — 선택창에서 고름)
     - rigUpgrade: 강화 파츠 표시 → 그 부위 그림을 <부위>_up으로 바꿔 끼움 (rigAvatar.applyUpgrades)
     - 무거운 탱커: 체력 높고 느림, 팔은 관통 물줄기(attackType 'water', battle/diver.js)
     - 스킬: 팔 앵커 견인 · 몸통 고압 분사 · 머리 심연의 손 · 다리 잠수화 (skills_v2.js), 기본·강화가 같은 스킬
     - 수치 1차 측정(2026-10-10, 밸런스_기록 구역 1): 강화 세트는 목표 곡선대로(Lv1 1-4까지, Lv3 1-5·보스),
       기본 세트는 Lv3도 1-4를 못 깨 팔 공격력 380 → 430, 다리 속도 75 → 90. 해금(별)은 아직 없음 — 구매만 하면 씀

   봉합 성녀 파츠 8개 (새 캐릭터 2, D-046): 같은 규칙 (팩션 '봉합 성녀 (뒤틀린 구원)' → 리그 saint)
     - 버티기 + 쓰러진 적을 꿰매 아군으로: 팔은 바늘(attackType 'needle', battle/saint.js) — 꽂힌 적에 봉합 표식
     - 스킬: 팔 봉합 주사 3연발 · 몸통 생명 봉인 · 머리 억지 부활 · 다리 자가 봉합 (skills_v2.js)
     - 수치: 밸런스 9차(2026-10-10) — 기본 Lv1 1-4까지, 강화 Lv1 1-4·보스. 해금(별)은 아직 없음

   서리의 무희 파츠 8개 (새 캐릭터 3, D-046): 같은 규칙 (팩션 '서리의 무희 (얼어붙은 안식)' → 리그 frost)
     - 얼리고 깨뜨리는 원거리: 팔은 서리 부채(attackType 'frost', battle/frost.js) — 냉기를 쌓아 빙결
     - 스킬: 팔 초승달 참격 · 몸통 눈보라 춤 · 머리 영원한 안식 · 다리 빙판 걸음 (skills_v2.js)
     - 수치 1차 그대로 (밸런스 10차: 기본 Lv1 1-3까지·1-4 아슬아슬, 강화 Lv1 1-5·보스 빠듯), 해금(별)은 아직 없음

   뒤틀린 인형사 파츠 8개 (새 캐릭터 4, D-049): 같은 규칙 (팩션 '뒤틀린 인형사 (버려진 가족)' → 리그 doll)
     - 인형 가족으로 막고 꼭두각시로 교란하는 근접: 팔은 가위(attackType 'scissors', battle/doll.js) — 방어 일부 무시
     - 스킬: 팔 가위 참격 X자 · 몸통 인형 가족(토끼 인형) · 머리 인형 실(꼭두각시) · 다리 실 걸음 (skills_v2.js)
     - 수치: 밸런스 11차(2026-10-10) — 기본 Lv1 1-3까지·1-4 아슬아슬, 강화 Lv1 1-4·보스. 해금(별)은 아직 없음

   철거의 설계자 · 침묵의 방송자 파츠 8개씩 (새 캐릭터 5·6, D-079 — MD/새캐릭터2종_설계안.md): 팩션 이름만 여기에,
     기본·강화 파츠와 스킬은 부품 스킬 데이터로 sets2/architectSets2.js · sets2/broadcasterSets2.js (ARCHITECT_BASE · BROADCASTER_BASE)

   V2_NAME_OVERRIDES: 기존 파츠 이름을 v2에서만 바꿈 (parts.js 원본은 그대로)
   V2_STAT_OVERRIDES: 기존 파츠 능력치를 v2에서만 바꿈 (parts.js 원본은 그대로)
     - 기본 로봇 (2026-10-03, D-043): 풀강화(Lv5)해도 1-4를 못 깸 → 기본 다리 속도 20 → 70, 기본 팔 공격력 300 → 520
       · 속도: 기본 로봇 45로 다른 조합의 1/3 (속도는 강화로 안 오름) → 95. 걷는 동안 적이 쌓여 기절·과부하
       · 공격력: 근접 주먹이라 적이 붙게 두고 싸워야 함 → 속도만으로는 Lv5도 1-3 실패라 함께 올림
       · 결과: Lv1은 1-3까지, Lv5는 1-4까지, 1-5부터는 파츠 구매 (레이저 조합은 Lv1로 1-B까지)
   ========================================================================== */

import { PARTS_DB } from '../data/parts.js';

export const DIVER_FACTION = '심연의 길잡이 (심해)';
export const SAINT_FACTION = '봉합 성녀 (뒤틀린 구원)';
export const FROST_FACTION = '서리의 무희 (얼어붙은 안식)';
export const DOLL_FACTION = '뒤틀린 인형사 (버려진 가족)';
export const ARCHITECT_FACTION = '철거의 설계자 (무너진 보금자리)';
export const BROADCASTER_FACTION = '침묵의 방송자 (빼앗긴 목소리)';
/** 새 캐릭터 파츠: 그림은 그 캐릭터 리그의 부위 그림 (연구소 카드는 lab_v2.js THUMB) */
const newPart = (faction, dir) => (id, name, cost, src, stats, extra = {}) => ({
    id, name, faction, cost, src: `assets/sprites/rig/${dir}/${src}`, animType: 'pivot', stats, ...extra
});
const diverPart = newPart(DIVER_FACTION, 'diver');
const saintPart = newPart(SAINT_FACTION, 'saint');
const frostPart = newPart(FROST_FACTION, 'frost');
const dollPart = newPart(DOLL_FACTION, 'doll');

export const V2_PARTS = {
    head: [
        {
            id: 'head_mech_a',
            name: '포격 관측 레이더',
            faction: '거대로봇 (메카닉)',
            set: 'A 포격 사령부',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 500, dps: 130, range: 80, speed: 0 },
            look: '접시 안테나 달린 관측 헤드, 붉은 조준 렌즈',
            skillDesc: '필살기 궤도 폭격: 앞쪽 5곳에 위성 레이저가 차례로 떨어짐 (큰 범위 피해, 거점 1.5배)'
        },
        {
            id: 'head_mech_b',
            name: '돌격 지휘 헬름',
            faction: '거대로봇 (메카닉)',
            set: 'B 돌격 강습대',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 600, dps: 90, range: 20, speed: 10 },
            look: '뿔 달린 강습 헬멧, 청록 바이저',
            skillDesc: '필살기 오버드라이브: 6초간 공격 속도 +50%·진격 속도 +40%·받는 피해 -30%'
        },
        {
            id: 'head_kaiju_a',
            name: '가시 왕관 뿔',
            faction: '거대괴수 (돌연변이)',
            set: 'A 가시 갑각',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 1100, dps: 50, range: 0, speed: 5 },
            look: '머리 위 가시 왕관',
            skillDesc: '필살기 가시 폭풍: 등 가시를 사방으로 쏴 범위 피해 + 4초 가시 독(지속 피해)'
        },
        {
            id: 'head_kaiju_b',
            name: '독 분사 턱',
            faction: '거대괴수 (돌연변이)',
            set: 'B 독안개',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 800, dps: 70, range: 40, speed: 5 },
            look: '독샘이 부푼 넓은 턱',
            skillDesc: '필살기 독안개 숨결: 앞쪽에 6초 독 구름 — 지속 피해 + 감속'
        },
        {
            id: 'head_hero_a',
            name: '타락 기사 투구',
            faction: '타락 히어로 (세뇌)',
            set: 'A 타락 기사',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 800, dps: 90, range: 10, speed: 10 },
            look: '뿔 달린 검은 기사 투구',
            skillDesc: '필살기 심판의 일격: 하늘에서 거대한 보라 검이 떨어짐 — 큰 범위 피해 + 2초 기절'
        },
        {
            id: 'head_hero_b',
            name: '그림자 왕관',
            faction: '타락 히어로 (세뇌)',
            set: 'B 그림자 마도사',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 600, dps: 110, range: 40, speed: 15 },
            look: '연기처럼 흩어지는 그림자 왕관',
            skillDesc: '필살기 그림자 분신: 6초간 분신 2명이 함께 공격 (기본 공격을 같이 쏨) — 4부위 세트면 3명'
        },
        {
            id: 'head_chimera_a',
            name: '광폭 투견 머리',
            faction: '합성괴인 (키메라)',
            set: 'A 광폭 실험체',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 700, dps: 70, range: 0, speed: 10 },
            look: '재갈 물린 사나운 개 머리',
            skillDesc: '필살기 광견 돌진: 앞으로 돌진하며 지나간 적 모두 밀쳐내고 1.5초 기절'
        },
        {
            id: 'head_chimera_b',
            name: '사령관 통신 헬멧',
            faction: '합성괴인 (키메라)',
            set: 'B 조직 사령관',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 600, dps: 70, range: 20, speed: 10 },
            look: '안테나 달린 지휘관 헬멧',
            skillDesc: '필살기 총동원령: 졸개 4기 소환 + 6초간 모든 졸개 피해 2배'
        },
        {
            // 세트에 속하지 않은 추가 머리 (2026-10-17 사용자 요청 "합성괴인 머리를 용머리로") — 그림 head_dragon
            id: 'head_chimera_dragon',
            name: '화룡 머리',
            faction: '합성괴인 (키메라)',
            rigVariant: 'dragon',
            cost: 750,
            stats: { hp: 650, dps: 75, range: 20, speed: 10 },
            look: '돼지 코 대신 용의 주둥이, 검은 뿔과 호랑이 줄무늬 비늘, 입안에 불씨',
            skillDesc: '필살기 용의 숨결: 포효하며 입에서 불길을 뿜어 앞쪽에 화염 피해 + 4초간 불바다(지속 피해, 거점 포함)'
        },
        // 새 캐릭터 (D-044~D-049): 부위마다 기본 → 강화(rigUpgrade)
        diverPart('head_diver', '황동 잠수모', 400, 'head.png', { hp: 700, dps: 60, range: 20, speed: 0 },
            { skillDesc: '심연의 손: 유령 손이 적을 붙잡아 묶고 지속 피해' }),
        diverPart('head_diver_up', '심해 등불 잠수모', 950, 'head_up.png', { hp: 950, dps: 90, range: 30, speed: 0 },
            { rigUpgrade: true, skillDesc: '심연의 손 (강화 잠수모: 관·밝은 창)' }),
        saintPart('head_saint', '봉합 두건', 400, 'head.png', { hp: 600, dps: 70, range: 20, speed: 10 },
            { skillDesc: '억지 부활: 봉합된 시체를 아군으로' }),
        saintPart('head_saint_up', '금빛 후광 두건', 950, 'head_up.png', { hp: 800, dps: 100, range: 30, speed: 10 },
            { rigUpgrade: true, skillDesc: '억지 부활 (강화 두건: 큰 금빛 후광)' }),
        frostPart('head_frost', '눈꽃 머리 장식', 400, 'head.png', { hp: 550, dps: 80, range: 30, speed: 10 },
            { skillDesc: '영원한 안식: 적을 얼음에 가뒀다 깨뜨림' }),
        frostPart('head_frost_up', '얼음 결정 왕관', 950, 'head_up.png', { hp: 750, dps: 110, range: 40, speed: 10 },
            { rigUpgrade: true, skillDesc: '영원한 안식 (강화 왕관: 얼음 결정)' }),
        dollPart('head_doll', '꿰맨 천 얼굴', 400, 'head.png', { hp: 650, dps: 70, range: 10, speed: 10 },
            { skillDesc: '인형 실: 적을 몇 초간 꼭두각시로' }),
        dollPart('head_doll_up', '깨진 도자기 가면', 950, 'head_up.png', { hp: 850, dps: 100, range: 20, speed: 10 },
            { rigUpgrade: true, skillDesc: '인형 실 (강화 가면: 청록 눈)' })
    ],
    body: [
        {
            id: 'body_mech_a',
            name: '포탑 탑재 장갑',
            faction: '거대로봇 (메카닉)',
            set: 'A 포격 사령부',
            rigVariant: 'a',
            cost: 800,
            stats: { hp: 1700, dps: 100, range: 0, speed: -5 },
            look: '어깨에 작은 자동 포탑',
            skillDesc: '스킬 2 자동 포탑 전개 (14초): 8초간 어깨 포탑이 가장 가까운 적을 연사'
        },
        {
            id: 'body_mech_b',
            name: '제트 추진 코어',
            faction: '거대로봇 (메카닉)',
            set: 'B 돌격 강습대',
            rigVariant: 'b',
            cost: 800,
            stats: { hp: 1600, dps: 80, range: 0, speed: 15 },
            look: '등에 대형 추진기 둘',
            skillDesc: '스킬 2 로켓 돌진 (13초): 앞으로 200px 돌진, 부딪힌 적 밀쳐내고 피해'
        },
        {
            id: 'body_kaiju_a',
            name: '반사 가시 갑각',
            faction: '거대괴수 (돌연변이)',
            set: 'A 가시 갑각',
            rigVariant: 'a',
            cost: 800,
            stats: { hp: 2600, dps: 40, range: 0, speed: 0 },
            look: '등 전체를 덮은 가시 껍질',
            skillDesc: '스킬 2 가시 갑옷 (15초): 6초간 받는 피해 -25%, 나를 때린 적에게 받은 피해 50% 되돌림'
        },
        {
            id: 'body_kaiju_b',
            name: '독주머니 외피',
            faction: '거대괴수 (돌연변이)',
            set: 'B 독안개',
            rigVariant: 'b',
            cost: 800,
            stats: { hp: 1900, dps: 50, range: 0, speed: 0 },
            look: '부푼 독주머니가 달린 몸',
            skillDesc: '스킬 2 독 포자 폭발 (14초): 몸 둘레 폭발 — 피해 + 산성 부식 4초'
        },
        {
            id: 'body_hero_a',
            name: '찢어진 망토 갑옷',   // 12세 기준(Q-008 S6): 피의 망토 갑옷 → 찢어진 망토 갑옷
            faction: '타락 히어로 (세뇌)',
            set: 'A 타락 기사',
            rigVariant: 'a',
            cost: 800,
            stats: { hp: 1700, dps: 110, range: 0, speed: 15 },
            look: '붉게 물든 찢어진 망토',
            skillDesc: '스킬 2 어둠의 서약 (15초): 6초간 준 피해의 20%만큼 체력 회복'
        },
        {
            id: 'body_hero_b',
            name: '저주 룬 로브',
            faction: '타락 히어로 (세뇌)',
            set: 'B 그림자 마도사',
            rigVariant: 'b',
            cost: 800,
            stats: { hp: 1200, dps: 130, range: 0, speed: 20 },
            look: '룬 자수가 빛나는 긴 로브',
            skillDesc: '스킬 2 저주의 사슬 (14초): 적 3명을 사슬로 4초 속박 + 지속 피해'
        },
        {
            id: 'body_chimera_a',
            name: '변이 근육 몸통',
            faction: '합성괴인 (키메라)',
            set: 'A 광폭 실험체',
            rigVariant: 'a',
            cost: 800,
            stats: { hp: 1600, dps: 70, range: 0, speed: 10 },
            look: '부풀어 터질 듯한 근육, 주사관',
            skillDesc: '스킬 2 아드레날린 주입 (15초): 8초간 주는 피해 +40%'
        },
        {
            id: 'body_chimera_b',
            name: '지휘 장갑복',
            faction: '합성괴인 (키메라)',
            set: 'B 조직 사령관',
            rigVariant: 'b',
            cost: 800,
            stats: { hp: 1400, dps: 60, range: 0, speed: 10 },
            look: '견장·훈장 달린 장갑 코트',
            skillDesc: '스킬 2 강화 주사 (14초): 모든 아군 졸개 체력 50% 회복 + 6초 공격 속도 증가'
        },
        // 새 캐릭터 (D-044~D-049): 부위마다 기본 → 강화(rigUpgrade)
        diverPart('body_diver', '잠수복', 450, 'torso.png', { hp: 1800, dps: 40, range: 0, speed: 0 },
            { skillDesc: '고압 분사: 물살로 적을 밀어내고 감속' }),
        diverPart('body_diver_up', '산소통 잠수복', 1000, 'torso_up.png', { hp: 2300, dps: 70, range: 0, speed: 0 },
            { rigUpgrade: true, skillDesc: '고압 분사 (강화 잠수복: 산소통 관·청록 빛)' }),
        saintPart('body_saint', '봉합 수녀복', 450, 'torso.png', { hp: 1500, dps: 50, range: 0, speed: 10 },
            { skillDesc: '생명 봉인: 붉은 실 장판으로 적을 묶음' }),
        saintPart('body_saint_up', '수혈 부적 갑옷', 1000, 'torso_up.png', { hp: 1900, dps: 80, range: 0, speed: 10 },
            { rigUpgrade: true, skillDesc: '생명 봉인 (강화 갑옷: 수혈 팩·부적)' }),
        frostPart('body_frost', '서리 무희복', 450, 'torso.png', { hp: 1300, dps: 60, range: 0, speed: 10 },
            { skillDesc: '눈보라 춤: 둘레 눈보라로 냉기 + 받는 피해 감소' }),
        frostPart('body_frost_up', '얼음 하트 갑옷', 1000, 'torso_up.png', { hp: 1700, dps: 90, range: 0, speed: 10 },
            { rigUpgrade: true, skillDesc: '눈보라 춤 (강화 갑옷: 얼음 하트 코어)' }),
        dollPart('body_doll', '앞치마·멜빵', 450, 'torso.png', { hp: 1500, dps: 50, range: 0, speed: 10 },
            { skillDesc: '인형 가족: 토끼 인형 3기 소환' }),
        dollPart('body_doll_up', '실패·톱니 몸통', 1000, 'torso_up.png', { hp: 1900, dps: 80, range: 0, speed: 10 },
            { rigUpgrade: true, skillDesc: '인형 가족 (강화 몸통: 청록 실패)' })
    ],
    arm: [
        {
            id: 'arm_mutant',
            name: '산성 발톱 팔',
            faction: '거대괴수 (돌연변이)',
            cost: 450,
            src: 'assets/sprites/rig/kaiju/armF.png',
            rightSrc: 'assets/sprites/rig/kaiju/armF.png',
            leftSrc: 'assets/sprites/rig/kaiju/armF.png',
            animType: 'pivot',
            stats: { hp: 500, dps: 380, range: 190, speed: 0 },
            attackType: 'melee',
            skillDesc: '산성 이빨: 물어뜯은 적과 거점을 산성으로 부식시켜 몇 초간 지속 피해 (거점 2배)'
        },
        {
            id: 'arm_mech_a',
            name: '레일건',
            faction: '거대로봇 (메카닉)',
            set: 'A 포격 사령부',
            rigVariant: 'a',
            cost: 900,
            stats: { hp: 250, dps: 380, range: 420, speed: -5 },
            attackType: 'rail',
            look: '긴 포신, 청록 전자기 코일',
            skillDesc: '기본 공격 레일건(일직선 관통, 첫 적 뒤로 감쇠) · 스킬 1 충전 레일 사격 (9초): 1초 충전 뒤 전장 끝까지 관통 큰 피해'
        },
        {
            id: 'arm_mech_b',
            name: '파일 벙커',
            faction: '거대로봇 (메카닉)',
            set: 'B 돌격 강습대',
            rigVariant: 'b',
            cost: 900,
            stats: { hp: 450, dps: 520, range: 200, speed: 0 },
            attackType: 'melee',
            look: '거대한 말뚝 박는 팔',
            skillDesc: '기본 공격 말뚝 찌르기 · 스킬 1 파일 벙커 관통 (9초): 한 적에 큰 피해 + 1.5초 기절 (거점 2배)'
        },
        {
            id: 'arm_kaiju_a',
            name: '분쇄 집게',
            faction: '거대괴수 (돌연변이)',
            set: 'A 가시 갑각',
            rigVariant: 'a',
            cost: 900,
            stats: { hp: 650, dps: 440, range: 190, speed: 0 },
            attackType: 'melee',
            look: '게 집게 같은 거대한 집게발',
            skillDesc: '스킬 1 지면 내려찍기 (9초): 앞쪽 충격파 — 피해 + 0.8초 기절'
        },
        {
            id: 'arm_kaiju_b',
            name: '산성 침 촉수',
            faction: '거대괴수 (돌연변이)',
            set: 'B 독안개',
            rigVariant: 'b',
            cost: 900,
            stats: { hp: 450, dps: 380, range: 320, speed: 0 },
            attackType: 'spit',
            look: '끝에 독샘 달린 촉수 팔',
            skillDesc: '기본 공격 산성 침(포물선, 맞은 자리 작은 산성 웅덩이) · 스킬 1 산성 침 3연발 (8초)'
        },
        {
            id: 'arm_hero_a',
            name: '타락 대검',
            faction: '타락 히어로 (세뇌)',
            set: 'A 타락 기사',
            rigVariant: 'a',
            cost: 900,
            stats: { hp: 600, dps: 480, range: 200, speed: 10 },
            attackType: 'melee',
            look: '넓은 검은 대검',
            skillDesc: '스킬 1 회전 베기 (8초): 제자리 3회전, 둘레 적 모두 피해'
        },
        {
            id: 'arm_hero_b',
            name: '암흑 구체 지팡이',
            faction: '타락 히어로 (세뇌)',
            set: 'B 그림자 마도사',
            rigVariant: 'b',
            cost: 900,
            stats: { hp: 350, dps: 340, range: 320, speed: 15 },
            attackType: 'orb',
            look: '끝에 검은 구체가 뜬 지팡이',
            skillDesc: '기본 공격 암흑 구체(따라가 폭발, 작은 범위) · 스킬 1 블랙홀 (10초): 3초간 적을 한곳으로 빨아들이며 피해'
        },
        {
            id: 'arm_chimera_a',
            name: '거대 해머 팔',
            faction: '합성괴인 (키메라)',
            set: 'A 광폭 실험체',
            rigVariant: 'a',
            cost: 900,
            stats: { hp: 500, dps: 400, range: 190, speed: 0 },
            attackType: 'melee',
            look: '쇠망치가 된 팔',
            skillDesc: '스킬 1 대지 강타 (9초): 크게 내리쳐 넓은 충격파 (거점 1.5배)'
        },
        {
            id: 'arm_chimera_b',
            name: '산탄 개조 팔',
            faction: '합성괴인 (키메라)',
            set: 'B 조직 사령관',
            rigVariant: 'b',
            cost: 900,
            stats: { hp: 350, dps: 360, range: 240, speed: 10 },
            attackType: 'shotgun',
            look: '팔에 박은 산탄총',
            skillDesc: '기본 공격 산탄(가까운 부채꼴 여러 적) · 스킬 1 화염 방사 (9초): 3초간 앞쪽 화염 지속 피해'
        },
        // 새 캐릭터 (D-044~D-049): 부위마다 기본 → 강화(rigUpgrade)
        diverPart('arm_diver', '고압 방수포', 500, 'armF.png', { hp: 350, dps: 430, range: 250, speed: 0 },
            { attackType: 'water', skillDesc: '고압 방수포: 앞의 적을 꿰뚫는 물줄기 · 앵커 견인' }),
        diverPart('arm_diver_up', '심해 방수포·앵커', 1100, 'armF_up.png', { hp: 450, dps: 480, range: 280, speed: 0 },
            { attackType: 'water', rigUpgrade: true, skillDesc: '더 긴 강화 방수포 · 앵커 견인' }),
        saintPart('arm_saint', '봉합 주사기', 500, 'armF.png', { hp: 300, dps: 430, range: 230, speed: 0 },
            { attackType: 'needle', skillDesc: '봉합 주사: 바늘이 꽂힌 적에 봉합 표식 · 3연발' }),
        saintPart('arm_saint_up', '이중 주사기·집게', 1100, 'armF_up.png', { hp: 400, dps: 520, range: 260, speed: 0 },
            { attackType: 'needle', rigUpgrade: true, skillDesc: '이중 주사기 · 봉합 주사 3연발' }),
        frostPart('arm_frost', '얼음 부채', 500, 'armF.png', { hp: 300, dps: 420, range: 270, speed: 0 },
            { attackType: 'frost', skillDesc: '서리 부채: 얼음 칼날로 냉기 → 빙결 · 초승달 참격' }),
        frostPart('arm_frost_up', '얼음 칼날 부채', 1100, 'armF_up.png', { hp: 400, dps: 510, range: 300, speed: 0 },
            { attackType: 'frost', rigUpgrade: true, skillDesc: '큰 얼음 칼날 부채 · 초승달 참격' }),
        dollPart('arm_doll', '재단 가위', 500, 'armF.png', { hp: 400, dps: 430, range: 190, speed: 0 },
            { attackType: 'scissors', skillDesc: '가위 참격: 두 번 자름, 방어 일부 무시 · X자' }),
        dollPart('arm_doll_up', '가위 집게·대포 팔', 1100, 'armF_up.png', { hp: 500, dps: 520, range: 200, speed: 0 },
            { attackType: 'scissors', rigUpgrade: true, skillDesc: '가위 칼날 집게 · 가위 참격 X자' })
    ],
    leg: [
        {
            id: 'leg_mech_a',
            name: '앵커 고정 다리',
            faction: '거대로봇 (메카닉)',
            set: 'A 포격 사령부',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 1000, dps: 120, range: 0, speed: 120 },
            look: '지면에 박는 앵커 발톱',
            skillDesc: '패시브 포격 고정: 멈춰 공격하는 동안 피해 +20% (걷는 동안 없음)'
        },
        {
            id: 'leg_mech_b',
            name: '자기장 호버 다리',
            faction: '거대로봇 (메카닉)',
            set: 'B 돌격 강습대',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 750, dps: 110, range: 0, speed: 155 },
            look: '바닥 위로 뜬 자기 부양 패드',
            skillDesc: '패시브 자기장 방벽: 원거리 공격(마취탄·그물·오물·자석)의 피해·효과 50% 감소'
        },
        {
            id: 'leg_kaiju_a',
            name: '갑각 다리',
            faction: '거대괴수 (돌연변이)',
            set: 'A 가시 갑각',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 1300, dps: 40, range: 0, speed: 85 },
            look: '껍질로 덮인 굵은 다리',
            skillDesc: '패시브 단단한 껍질: 받는 피해 15% 감소, 밀려나지 않음'
        },
        {
            id: 'leg_kaiju_b',
            name: '질주 다리',
            faction: '거대괴수 (돌연변이)',
            set: 'B 독안개',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 900, dps: 40, range: 0, speed: 110 },
            look: '길고 가는 뒷다리',
            skillDesc: '패시브 질주 본능: 앞에 적이 없을 때 진격 속도 +30%'
        },
        {
            id: 'leg_hero_a',
            name: '불굴의 군화',
            faction: '타락 히어로 (세뇌)',
            set: 'A 타락 기사',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 900, dps: 90, range: 0, speed: 105 },
            look: '쇠 박힌 무거운 장화',
            skillDesc: '패시브 불굴: 내구도 30% 아래에서 받는 피해 40% 감소'
        },
        {
            id: 'leg_hero_b',
            name: '그림자 걸음',
            faction: '타락 히어로 (세뇌)',
            set: 'B 그림자 마도사',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 600, dps: 100, range: 0, speed: 120 },
            look: '발끝이 그림자로 녹아내림',
            skillDesc: '패시브 그림자 회피: 25% 확률로 받는 피해 무시'
        },
        {
            id: 'leg_chimera_a',
            name: '강철 발굽',
            faction: '합성괴인 (키메라)',
            set: 'A 광폭 실험체',
            rigVariant: 'a',
            cost: 750,
            stats: { hp: 800, dps: 90, range: 0, speed: 85 },
            look: '쇠 발굽',
            skillDesc: '패시브 짓밟기: 걸음마다 앞쪽 작은 충격파 피해'
        },
        {
            id: 'leg_chimera_b',
            name: '지휘관 장화',
            faction: '합성괴인 (키메라)',
            set: 'B 조직 사령관',
            rigVariant: 'b',
            cost: 750,
            stats: { hp: 600, dps: 80, range: 0, speed: 100 },
            look: '금장 두른 장화',
            skillDesc: '패시브 졸개 지휘: 졸개 하나마다 주는 피해 +5% (최대 4기)'
        },
        // 새 캐릭터 (D-044~D-049): 부위마다 기본 → 강화(rigUpgrade)
        diverPart('leg_diver', '잠수화', 400, 'legF.png', { hp: 800, dps: 30, range: 0, speed: 90 },
            { skillDesc: '잠수화: 밀려남·감속·속박에 강함' }),
        diverPart('leg_diver_up', '청록 강화 잠수화', 950, 'legF_up.png', { hp: 1000, dps: 50, range: 0, speed: 95 },
            { rigUpgrade: true, skillDesc: '잠수화 (강화): 더 강하게 버팀' }),
        saintPart('leg_saint', '흰 장화', 400, 'legF.png', { hp: 600, dps: 30, range: 0, speed: 90 },
            { skillDesc: '자가 봉합: 다칠수록 빨리 회복' }),
        saintPart('leg_saint_up', '금속 덧댄 장화', 950, 'legF_up.png', { hp: 800, dps: 50, range: 0, speed: 105 },
            { rigUpgrade: true, skillDesc: '자가 봉합 (강화): 더 빨리 회복' }),
        frostPart('leg_frost', '흰 하이힐 부츠', 400, 'legF.png', { hp: 550, dps: 40, range: 0, speed: 100 },
            { skillDesc: '빙판 걸음: 얼어 있는 적에게 피해 증가' }),
        frostPart('leg_frost_up', '얼음 결정 부츠', 950, 'legF_up.png', { hp: 750, dps: 60, range: 0, speed: 115 },
            { rigUpgrade: true, skillDesc: '빙판 걸음 (강화): 더 크게 깨뜨림' }),
        dollPart('leg_doll', '나무 관절 다리', 400, 'legF.png', { hp: 650, dps: 40, range: 0, speed: 85 },
            { skillDesc: '실 걸음: 토끼 인형이 많을수록 빨라짐' }),
        dollPart('leg_doll_up', '실 감은 관절 다리', 950, 'legF_up.png', { hp: 850, dps: 60, range: 0, speed: 100 },
            { rigUpgrade: true, skillDesc: '실 걸음 (강화): 더 빨라짐' })
    ]
};

export const V2_NAME_OVERRIDES = { arm_mech_missile: '미사일 포드' };

export const V2_STAT_OVERRIDES = {
    leg_red_robot: { speed: 70 },
    arm_red_robot: { dps: 520 }
};

/** v2 시작 시 한 번: 추가 파츠를 PARTS_DB에 등록 (이미 있으면 건너뜀), 능력치 덮어쓰기 */
export function registerV2Parts() {
    for (const [slot, list] of Object.entries(V2_PARTS)) {
        const db = PARTS_DB[slot];
        if (!db) continue;
        for (const part of list) {
            if (!db.some(p => p.id === part.id)) db.push(part);
        }
    }
    for (const db of Object.values(PARTS_DB)) {
        for (const part of db) {
            const name = V2_NAME_OVERRIDES[part.id];
            if (name) part.name = name;
            const over = V2_STAT_OVERRIDES[part.id];
            if (over && part.stats) Object.assign(part.stats, over);
        }
    }
}
