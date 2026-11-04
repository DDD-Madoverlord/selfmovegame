/* ==========================================================================
   PROJECT: MAD OVERLORD // 스테이지 데이터 (v2)
   챕터 1 = 구역 1 "제14 비밀 벙커: 심연의 출격" 1-1 ~ 1-10 + 보스전 (새 기획 D-085 — 예전 "지하 비밀 연구소" 1-1 ~ 1-5 + 보스전(D-018·D-021)을 바꿈)
   챕터 2 = 구역 2 "해안 시추 단지: 끓어오르는 대지" 2-1 ~ 2-10 + 보스전 (새 기획 D-085 — 예전 "하부 쓰레기 폐기 정착지"(D-040)를 바꿈) — 1-B를 깨면 열림
   챕터 3 = 구역 3 "성왕국 수도: 피로 물든 순례길" 3-1 ~ 3-10 + 보스전 (새 기획 D-085 — 예전 7판(D-056)을 바꿈)
   챕터 4 = 구역 4 "진화의 심연: 살점의 요람" 4-1 ~ 4-10 + 보스전 (새 기획 D-085 — 예전 7판(D-056)을 바꿈)
   챕터 5 = 구역 5 "해상 요새 포세이돈: 가라앉는 오만" 5-1 ~ 5-10 + 보스전 (새 기획 D-085) — 4-B를 깨면 열림
   챕터 9·10 = 구역 9 "제1 재건축 구역: 무너진 보금자리" · 구역 10 "중앙 방송 타워: 거짓된 주파수" 각 11판 (새 기획 D-085)
   챕터 8 = 구역 8 "노르딘 왕성: 얼어붙은 안식" 8-1 ~ 8-10 + 보스전 (새 기획 D-085) — 7-B를 깨면 열림
   챕터 7 = 구역 7 "잿빛 전장: 잿빛 인형극" 7-1 ~ 7-10 + 보스전 (새 기획 D-085) — 6-B를 깨면 열림
   챕터 6 = 구역 6 "기적의 대병동: 피에 젖은 성역" 6-1 ~ 6-10 + 보스전 (새 기획 D-085 — 예전 "성왕국 변두리"(D-076·D-078)를 바꿈) — 5-B를 깨면 열림

   챕터 항목: id, zone, name, art { mid, final } (거점 그림 이름, bases_v2.js),
             defense { mid|final: { range, every, dmg, color, label, puddle? } } (다가오면 거점이 쏨, 구역 3·4),
             midHeal (요새를 부수면 주인공 최대 내구도의 이 비율만큼 회복, 구역 6), stages
   스테이지는 앞에서부터 한 줄로 이어짐(1-1 … 1-B, 2-1 … 2-B): 앞 스테이지를 깨면 다음이 열리고, 결과 화면 "다음"도 이 순서

   스테이지 항목
     distance / midAt / finalAt : 전체 거리, 중간 요새·최종 기지가 나오는 거리(m)
     timeLimit : 제한 시간(초, 전투 시간). 이 안에 최종 기지를 못 부수면 패배 (D-028)
     starTime  : 세 번째 별 목표 시간(초). 이 안에 클리어하면 별 (D-029)
     enemy : { hp, dps (적 능력치 배율), spawn (소환 간격 초), max (동시 최대 수), mix (적 종류별 비중) }
     elite : 엘리트로 나올 확률
     base  : 거점 체력 { mid, final }
     reward: DM { kill (기본 보병 1기, 종류별 배율은 enemies_v2.js), mid, final }
     boss  : 보스전 설정 { unit (보스 적 종류), artillery: { every, warn, stun, silence } (구역 1 EMP 포격)
                          또는 gas: { every, warn, sec (감속 시간), silence (증원 중단 초) } (구역 2 유독 가스)
                          또는 orbital: { every, warn, n, radius, dmg, enemyDmg } (새 기획 구역 1 궤도 폭격)
                          또는 containers: { every, warn, n, radius, dmg, stun, hp, sec } (새 기획 구역 2 폐기물 컨테이너 투하) }  — 기획서 2-⑥ 광역 기믹
                          afterBase: true → 최종 기지를 부수면 보스가 나오고, 보스를 쓰러뜨려야 승리 (구역 3)
                          knights: { every, warn, unit } → 보스가 나온 뒤 every초마다 엘리트 소환 (구역 3 심연의 문 개방)
     fonts : 축복 성수대가 나오는 거리(m) 목록 (구역 6) — 부술 때까지 근처 적 받는 피해 감소
     map   : 메인 레이더에 찍을 위치 (레이더 중심 기준 -1~1)
   난이도 곡선은 tools/tests/balance_sim.py 결과(MD/밸런스_기록.md)를 보고 조정한다.
   ========================================================================== */

import { isZoneReleased } from './contentSchedule_v2.js';

// 구역 1: 새 기획 스테이지 1 "거대로봇 : 심연의 출격" (D-085, MD/기획_스테이지설계.md) — 11판(1-1 ~ 1-10 + 보스).
// 지하 1,000m 제14 비밀 군사 벙커, 막는 세력 = 정부 직속 비밀 토벌군 '블랙 하운드' (적 능력은 enemies_v2.js).
// 판마다 새 적이 하나씩: 징집 보병 → 진압 방패병(3열 대열) → 테이저 요원 → 로켓 보병 → EMP 드론 → 전투 군견 → 화염방사병 → 기계화 강화병,
// 1-9·1-10은 모든 적 혼합(1-10은 물량 웨이브), 1-B는 거대 승강기 앞 'WMD-알파' + 기믹 궤도 폭격(20초마다, enemyField.js tickOrbital).
// 중간 요새(보안 게이트)는 위 자동 포탑이 다가오면 빔을 쏨(defense.mid). 그림 2026-10-25 (stageArt_v2.js st1_*, 배경 ui_v2.css .v2-zone-1)
const MAP11 = [[-0.78, 0.6], [-0.62, 0.46], [-0.46, 0.33], [-0.3, 0.2], [-0.14, 0.07], [0.02, -0.06], [0.18, -0.19],
    [0.34, -0.32], [0.5, -0.46], [0.64, -0.6], [0.78, -0.76]];
// 밸런스 1차 (2026-10-25, D-087): 구역마다 8~10판이 가장 센 조합도 못 넘는 벽 — 피해 대부분이 8판 중장갑 적의 근접 →
// 8판 중장갑 비중 1 → 0.45, 전체 혼합(Z*_ALL) 0.5 → 0.25, 10판 물량 소환 1.55초·최대 11 → 1.7초·최대 9 (중장갑 수치는 enemies_v2.js),
// 8~10판 적 공격 배율 × 0.88, 3-B 악마기사 소환 20초 → 32초. 방패형 적 근접 × 0.6 (enemies_v2.js),
// 9판 적 체력 × 0.95 · 10판 × 0.92 · 10판 소환 1.8초, 구역 6 구급 마차 비중 1 → 0.4 (6-8 · 혼합 0.5 → 0.3),
// 구역 10 우퍼 메카 비중 10-6 1.2 → 0.8 · 혼합 0.7 → 0.5 (구역 5~10 방패형 장벽 체력·간격은 enemies_v2.js)
const Z1_ALL = { conscript: 3, riot: 1, taser: 1, rocket: 1, empdrone: 1, hound: 2, flamer: 1, exo: 0.25 };
export const CHAPTER1 = {
    id: 'ch1',
    zone: 1,
    name: '구역 1 · 제14 비밀 벙커: 심연의 출격',
    art: { mid: 'st1_fort', final: 'st1_base', barricade: 'st1_barr' },
    defense: { mid: { range: 420, every: 2.4, dmg: 20, color: '255, 90, 80', label: '🔫 보안 게이트 자동 포탑' } },
    stages: [
        {
            id: '1-1', timeLimit: 150, starTime: 100, name: '박살 난 연구소', desc: '토벌군이 기지 문을 폭파하고 들이닥쳤다. 징집 보병부터 몰아낸다.',
            distance: 800, midAt: 320, finalAt: 700,
            enemy: { hp: 1, dps: 1, spawn: 2.6, max: 5, mix: { conscript: 1 } }, elite: 0,
            base: { mid: 2400, final: 4600 }, reward: { kill: 12, mid: 500, final: 1500 }
        },
        {
            id: '1-2', timeLimit: 170, starTime: 108, name: '붉은 복도', desc: '비상등이 깜빡이는 좁은 복도. 진압 방패병이 3열로 길을 막는다.',
            distance: 850, midAt: 360, finalAt: 760,
            enemy: { hp: 1.1, dps: 1.08, spawn: 2.5, max: 6, mix: { conscript: 5, riot: 1 } }, elite: 0.03,
            base: { mid: 2700, final: 5000 }, reward: { kill: 13, mid: 600, final: 1700 }
        },
        {
            id: '1-3', timeLimit: 180, starTime: 112, name: '감전의 위험', desc: '바닥에 물이 고인 배관 구역. 테이저 요원의 전기 올가미가 발을 묶는다.',
            distance: 900, midAt: 400, finalAt: 800,
            enemy: { hp: 1.25, dps: 1.18, spawn: 2.4, max: 6, mix: { conscript: 4, riot: 1, taser: 2 } }, elite: 0.05,
            base: { mid: 3100, final: 5700 }, reward: { kill: 14, mid: 700, final: 1950 }
        },
        {
            id: '1-4', timeLimit: 190, starTime: 116, name: '포화 속으로', desc: '탁 트인 무기고. 로켓 보병이 후방에서 곡사 지원 사격을 시작한다.',
            distance: 950, midAt: 420, finalAt: 850,
            enemy: { hp: 1.4, dps: 1.3, spawn: 2.25, max: 7, mix: { conscript: 4, riot: 1, taser: 1, rocket: 2 } }, elite: 0.07,
            base: { mid: 3600, final: 6500 }, reward: { kill: 15, mid: 800, final: 2200 }
        },
        {
            id: '1-5', timeLimit: 200, starTime: 122, name: '첫 번째 차단선', desc: '보안 게이트를 돌파한다. EMP 드론이 날아다니며 스킬을 방해한다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 1.55, dps: 1.4, spawn: 2.1, max: 7, mix: { conscript: 3, riot: 1, taser: 1, rocket: 1, empdrone: 2 } }, elite: 0.09,
            base: { mid: 4800, final: 7200 }, reward: { kill: 16, mid: 1000, final: 2450 }
        },
        {
            id: '1-6', timeLimit: 205, starTime: 126, name: '사냥개 방반', desc: '좁고 어두운 환풍로 근처. 전투 군견이 빠르게 달려들어 물어뜯는다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 1.7, dps: 1.5, spawn: 2.0, max: 8, mix: { conscript: 3, riot: 1, taser: 1, rocket: 1, empdrone: 1, hound: 3 } }, elite: 0.1,
            base: { mid: 4500, final: 8000 }, reward: { kill: 17, mid: 1050, final: 2650 }
        },
        {
            id: '1-7', timeLimit: 215, starTime: 132, name: '불타는 격납고', desc: '네이팜 불길이 바닥을 덮어 진격이 까다로워진다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 1.85, dps: 1.6, spawn: 1.95, max: 8, mix: { conscript: 2, riot: 1, taser: 1, rocket: 1, empdrone: 1, hound: 2, flamer: 2 } }, elite: 0.11,
            base: { mid: 4900, final: 8600 }, reward: { kill: 18, mid: 1100, final: 2850 }
        },
        {
            id: '1-8', timeLimit: 220, starTime: 136, name: '도난당한 기술', desc: '빅터의 기술을 훔쳐 만든 육중한 외골격, 기계화 강화병이 나타난다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 2.0, dps: 1.5, spawn: 1.9, max: 8, mix: { conscript: 3, riot: 1, taser: 1, rocket: 1, empdrone: 1, hound: 1, flamer: 1, exo: 0.45 } }, elite: 0.12,
            base: { mid: 5200, final: 9200 }, reward: { kill: 19, mid: 1150, final: 3050 }
        },
        {
            id: '1-9', timeLimit: 230, starTime: 142, name: '엘리베이터 입구', desc: '승강기를 타기 위한 총력전. 블랙 하운드 전 병력이 몰려온다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 1.99, dps: 1.57, spawn: 1.85, max: 8, mix: { ...Z1_ALL } }, elite: 0.13,
            base: { mid: 5400, final: 9600 }, reward: { kill: 20, mid: 1200, final: 3250 }
        },
        {
            id: '1-10', timeLimit: 240, starTime: 150, name: '최후의 저지선', desc: '사방에서 끝없이 쏟아지는 물량 웨이브를 뚫어라.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 2.02, dps: 1.6, spawn: 1.8, max: 9, mix: { ...Z1_ALL } }, elite: 0.15,
            base: { mid: 5600, final: 10000 }, reward: { kill: 21, mid: 1250, final: 3500 }
        },
        {
            id: '1-B', timeLimit: 240, starTime: 155, name: '통제 불능', desc: '거대 승강기 앞. 도용된 AI 병기 "WMD-알파"와 천장 해치의 궤도 폭격이 기다린다.', boss: true,
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 2.3, dps: 1.85, spawn: 2.0, max: 8, mix: { conscript: 3, riot: 1, taser: 1, rocket: 1, empdrone: 1, hound: 2, flamer: 1 } }, elite: 0.12,
            base: { mid: 5600, final: 12500 }, reward: { kill: 22, mid: 1300, final: 4500 },
            // 궤도 폭격: every초마다 경보 → warn초 뒤 붉은 원 n곳(하나는 주인공 자리)에 빛기둥 — 원 안의 주인공 최대 내구도 dmg, 적 병사 최대 체력 enemyDmg
            boss: { unit: 'wmdalpha', orbital: { every: 20, warn: 2.2, n: 3, radius: 80, dmg: 0.07, enemyDmg: 0.6 } }
        }
    ]
};
CHAPTER1.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 2: 새 기획 스테이지 2 "거대괴수 : 끓어오르는 대지" (D-085) — 11판(2-1 ~ 2-10 + 보스).
// 해안 시추 단지, 막는 세력 = 에너지 코퍼레이션 중장비 방위군 (인간 3종 + 메카·차량 5종, 적 능력은 enemies_v2.js).
// 판마다 새 적: 용병 → 불도저 드로이드(밀어냄) → 작살포 트럭(감속) → 회전톱 드론 → 산성액 메카(웅덩이) → 음파 차단 탑(스킬 지연)
// → 대물 포격 워커(장거리 곡사) → 채굴용 엑스카베이터, 2-9·2-10 혼합(2-10 물량), 2-B 메인 시추 코어 앞 '기간틱 테라포머'
// + 기믹 폐기물 컨테이너 투하(20초마다, enemyField.js tickContainers — 맞으면 기절, 떨어진 컨테이너는 잠시 바리케이드).
// 중간 요새(해안 방파제 게이트)는 대함 미사일 포탑이 다가오면 쏨. 그림 2026-10-25 (stageArt_v2.js st2_*, 배경 ui_v2.css .v2-zone-2)
// 밸런스 1차 (D-087): 구역 3보다 어려워서(레이저 로봇 Lv5도 2-5에서 시간 초과) 제한 시간 +12초, 2-5 중간 요새 8600 → 7600,
// 2-7 포격 워커 비중 1.5 → 1 (불도저 체력 1150 → 950 · 포격 워커 철갑탄 78 → 62는 enemies_v2.js)
const Z2_ALL = { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1.5, acidmech: 1, sonictower: 0.7, spiderwalker: 0.8, excavator: 0.25 };
export const CHAPTER2 = {
    id: 'ch2',
    zone: 2,
    name: '구역 2 · 해안 시추 단지: 끓어오르는 대지',
    art: { mid: 'st2_fort', final: 'st2_base', barricade: 'st2_barr' },
    defense: { mid: { range: 440, every: 2.8, dmg: 26, color: '255, 160, 80', label: '🚀 대함 미사일 포탑' } },
    stages: [
        {
            id: '2-1', timeLimit: 212, starTime: 130, name: '대지의 진동', desc: '상륙 직후. 하찮은 용병들을 짓밟으며 진격한다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 2.4, dps: 1.9, spawn: 2.2, max: 6, mix: { merc: 1 } }, elite: 0.06,
            base: { mid: 6000, final: 11000 }, reward: { kill: 24, mid: 1400, final: 4000 }
        },
        {
            id: '2-2', timeLimit: 217, starTime: 132, name: '밀어붙이는 강철', desc: '불도저 드로이드의 배토판이 물리적 방어선을 친다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 2.5, dps: 1.95, spawn: 2.15, max: 7, mix: { merc: 4, dozer: 1 } }, elite: 0.07,
            base: { mid: 6300, final: 11500 }, reward: { kill: 25, mid: 1450, final: 4150 }
        },
        {
            id: '2-3', timeLimit: 222, starTime: 135, name: '짐승 사냥', desc: '고압 작살포 트럭이 괴수의 발을 묶기 시작한다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 2.6, dps: 2.0, spawn: 2.1, max: 7, mix: { merc: 4, dozer: 1, harpoon: 2 } }, elite: 0.08,
            base: { mid: 6600, final: 12000 }, reward: { kill: 26, mid: 1500, final: 4300 }
        },
        {
            id: '2-4', timeLimit: 227, starTime: 138, name: '살을 에는 톱니', desc: '공중에서 회전톱 드론이 쏟아진다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 2.7, dps: 2.05, spawn: 2.05, max: 7, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 2 } }, elite: 0.09,
            base: { mid: 6900, final: 12500 }, reward: { kill: 27, mid: 1550, final: 4450 }
        },
        {
            id: '2-5', timeLimit: 232, starTime: 140, name: '방파제 붕괴', desc: '대함 포탑이 달린 해안 방파제 게이트를 돌파한다. 산성액 메카가 웅덩이를 만든다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 2.8, dps: 2.1, spawn: 2.0, max: 7, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1, acidmech: 2 } }, elite: 0.1,
            base: { mid: 7600, final: 13000 }, reward: { kill: 28, mid: 1800, final: 4600 }
        },
        {
            id: '2-6', timeLimit: 237, starTime: 143, name: '귀를 찢는 기계음', desc: '음파 차단 탑의 고주파가 스킬 사용을 방해한다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 2.9, dps: 2.15, spawn: 2.0, max: 8, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1, acidmech: 1, sonictower: 1 } }, elite: 0.11,
            base: { mid: 7400, final: 13500 }, reward: { kill: 29, mid: 1650, final: 4750 }
        },
        {
            id: '2-7', timeLimit: 242, starTime: 146, name: '십자포화', desc: '대물 포격 워커가 멀리서 공성 철갑탄을 쏟아붓는다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.0, dps: 2.2, spawn: 1.95, max: 8, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1, acidmech: 1, sonictower: 0.5, spiderwalker: 1 } }, elite: 0.12,
            base: { mid: 7700, final: 14000 }, reward: { kill: 30, mid: 1700, final: 4900 }
        },
        {
            id: '2-8', timeLimit: 247, starTime: 150, name: '뚫리지 않는 껍질', desc: '양팔에 유압 드릴을 단 중장갑 엑스카베이터와의 힘 싸움.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.1, dps: 1.98, spawn: 1.95, max: 8, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1, acidmech: 1, sonictower: 0.5, spiderwalker: 0.8, excavator: 0.45 } }, elite: 0.12,
            base: { mid: 7900, final: 14400 }, reward: { kill: 31, mid: 1750, final: 5000 }
        },
        {
            id: '2-9', timeLimit: 252, starTime: 153, name: '시추 코어 진입로', desc: '메인 기지를 지키기 위한 중장비들의 총공세.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.04, dps: 2.02, spawn: 1.9, max: 8, mix: { ...Z2_ALL } }, elite: 0.13,
            base: { mid: 8000, final: 14700 }, reward: { kill: 32, mid: 1800, final: 5150 }
        },
        {
            id: '2-10', timeLimit: 257, starTime: 158, name: '최후의 발악', desc: '사방에서 끝없이 쏟아지는 기계 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.04, dps: 2.07, spawn: 1.8, max: 9, mix: { ...Z2_ALL } }, elite: 0.15,
            base: { mid: 8200, final: 15000 }, reward: { kill: 33, mid: 1850, final: 5300 }
        },
        {
            id: '2-B', timeLimit: 257, starTime: 162, name: '짓밟힌 오만', desc: '메인 시추 코어 앞. 환경 파괴 메카 "기간틱 테라포머"와 크레인의 컨테이너 투하가 기다린다.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.4, dps: 2.4, spawn: 2.0, max: 8, mix: { merc: 3, dozer: 1, harpoon: 1, sawdrone: 1, acidmech: 1, sonictower: 0.5, spiderwalker: 0.8 } }, elite: 0.12,
            base: { mid: 8000, final: 15000 }, reward: { kill: 34, mid: 2000, final: 6500 },
            // 컨테이너 투하: every초마다 경보 → warn초 뒤 n곳(하나는 주인공 바로 앞) — 그 자리 주인공은 최대 내구도 dmg + stun초 기절,
            // 컨테이너는 hp(× 적 체력 배율) 바리케이드로 sec초 남음
            boss: { unit: 'terraformer', containers: { every: 20, warn: 2.2, n: 3, radius: 75, dmg: 0.05, stun: 1.2, hp: 500, sec: 8 } }
        }
    ]
};
CHAPTER2.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 레이더 위 7판(6 + 보스) 자리 — 구역 3·4
const MAP7 = [[-0.74, 0.56], [-0.48, 0.38], [-0.22, 0.2], [0.04, 0.0], [0.3, -0.2], [0.54, -0.44], [0.76, -0.74]];

// 구역 3: 새 기획 스테이지 3 "타락 히어로 : 피로 물든 순례길" (D-085) — 11판(3-1 ~ 3-10 + 보스). 예전 7판(D-056)을 바꿈.
// 처형 광장 → 대성당 순례길, 막는 세력 = 성왕국 이단 토벌대 & 광신도 연합 (적 능력은 enemies_v2.js).
// 판마다 새 적: 광신도 → 신성 방패병(방패 장벽) → 이단심문관(채찍 출혈·감속) → 빛의 마법사(곡사) → 전투 신관(치유)
// → 그리폰 기수(성수 약화, 비행) → 정화의 발리스타(밀어냄) → 처형인 성기사, 3-9·3-10 혼합(3-10 물량).
// 3-B: 대성당 정문을 부수면 대주교 베네딕트(신성한 심판·숨겨진 마성) + 기믹 지옥문(20초마다 악마기사 2기, enemyField.js tickKnights).
// 중간 요새(이단 심문소 철문)는 다가오면 쇠꼬챙이·화살을 쏨. 그림 2026-10-25 (stageArt_v2.js st3_*, 배경 ui_v2.css .v2-zone-3)
const Z3_ALL = { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 0.8, griffon: 1, ballista: 0.6, executioner: 0.25 };
export const CHAPTER3 = {
    id: 'ch3',
    zone: 3,
    name: '구역 3 · 성왕국 수도: 피로 물든 순례길',
    art: { mid: 'st3_fort', final: 'st3_base', barricade: 'st3_barr' },
    defense: { mid: { range: 420, every: 2.2, dmg: 24, color: '255, 214, 120', label: '🏹 심문소 쇠꼬챙이·화살', hitFx: 'arrowHit' } },
    stages: [
        {
            id: '3-1', timeLimit: 210, starTime: 135, name: '처형대의 기억', desc: '목이 잘렸던 처형장에서 되살아났다. 광신도 무리를 쓸어 낸다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 2.9, dps: 2.1, spawn: 1.9, max: 8, mix: { zealot: 1 } }, elite: 0.06,
            base: { mid: 7000, final: 12500 }, reward: { kill: 36, mid: 2100, final: 6000 }
        },
        {
            id: '3-2', timeLimit: 215, starTime: 138, name: '황금빛 방벽', desc: '성왕국 정규군과의 첫 충돌. 신성 방패병이 방패 장벽을 친다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.0, dps: 2.15, spawn: 1.95, max: 8, mix: { zealot: 4, holyshield: 1 } }, elite: 0.07,
            base: { mid: 7300, final: 13000 }, reward: { kill: 37, mid: 2150, final: 6150 }
        },
        {
            id: '3-3', timeLimit: 220, starTime: 140, name: '피 묻은 채찍', desc: '순례길을 가로막는 고문관들. 가시 채찍이 살을 찢고 발을 늦춘다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.1, dps: 2.2, spawn: 1.95, max: 8, mix: { zealot: 4, holyshield: 1, inquisitor: 2 } }, elite: 0.08,
            base: { mid: 7600, final: 13500 }, reward: { kill: 38, mid: 2200, final: 6300 }
        },
        {
            id: '3-4', timeLimit: 225, starTime: 144, name: '눈먼 믿음', desc: '빛의 마법사들의 화살비가 쏟아지는 광장.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.2, dps: 2.25, spawn: 1.95, max: 8, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 2 } }, elite: 0.09,
            base: { mid: 7900, final: 14000 }, reward: { kill: 39, mid: 2250, final: 6450 }
        },
        {
            id: '3-5', timeLimit: 230, starTime: 148, name: '심문소 돌파', desc: '이단 심문소 철문을 부순다. 쓰러진 적을 치료하는 전투 신관이 나타난다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 3.3, dps: 2.3, spawn: 1.9, max: 9, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 1.5 } }, elite: 0.1,
            base: { mid: 9800, final: 14400 }, reward: { kill: 40, mid: 2600, final: 6600 }
        },
        {
            id: '3-6', timeLimit: 235, starTime: 152, name: '하늘의 감시자', desc: '그리폰 기수가 머리 위에서 성수를 뿌려 방어를 무너뜨린다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 3.4, dps: 2.35, spawn: 1.9, max: 9, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 1, griffon: 1.5 } }, elite: 0.11,
            base: { mid: 8400, final: 14800 }, reward: { kill: 41, mid: 2350, final: 6750 }
        },
        {
            id: '3-7', timeLimit: 240, starTime: 156, name: '이단 정화 포대', desc: '먼 곳에서 거대한 은제 쐐기가 날아오는 십자포화 구간.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.5, dps: 2.4, spawn: 1.88, max: 9, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 1, griffon: 1, ballista: 1.2 } }, elite: 0.12,
            base: { mid: 8700, final: 15200 }, reward: { kill: 42, mid: 2400, final: 6900 }
        },
        {
            id: '3-8', timeLimit: 245, starTime: 160, name: '원수의 얼굴', desc: '과거 목을 쳤던 처형인 성기사들과의 복수전.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.6, dps: 2.16, spawn: 1.88, max: 9, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 0.8, griffon: 1, ballista: 0.6, executioner: 0.45 } }, elite: 0.12,
            base: { mid: 8900, final: 15600 }, reward: { kill: 43, mid: 2450, final: 7050 }
        },
        {
            id: '3-9', timeLimit: 250, starTime: 164, name: '대성당의 계단', desc: '대성당 정문을 지키기 위한 성왕국의 총력전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.52, dps: 2.2, spawn: 1.85, max: 9, mix: { ...Z3_ALL } }, elite: 0.13,
            base: { mid: 9000, final: 16000 }, reward: { kill: 44, mid: 2500, final: 7200 }
        },
        {
            id: '3-10', timeLimit: 255, starTime: 168, name: '무너지는 성역', desc: '사방에서 끝없이 쏟아지는 기사단 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.45, dps: 2.24, spawn: 1.8, max: 9, mix: { ...Z3_ALL } }, elite: 0.15,
            base: { mid: 9200, final: 16400 }, reward: { kill: 45, mid: 2550, final: 7400 }
        },
        {
            id: '3-B', timeLimit: 270, starTime: 185, name: '위선자의 최후', desc: '대성당 정문을 부수면, 빛과 어둠을 섞어 쓰는 대주교 베네딕트가 지옥문을 연다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.8, dps: 2.6, spawn: 2.0, max: 9, mix: { zealot: 3, holyshield: 1, inquisitor: 1, lightmage: 1, battlepriest: 1, griffon: 1 } }, elite: 0.12,
            base: { mid: 8800, final: 14000 }, reward: { kill: 50, mid: 2800, final: 8500 },
            // 위선의 민낯: 보스가 나온 뒤 every초마다 지옥문 → 악마기사(엘리트) n기
            boss: { unit: 'benedict', afterBase: true, knights: { every: 32, warn: 2, unit: 'demonknight', n: 2 } }
        }
    ]
};
CHAPTER3.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 4: 새 기획 스테이지 4 "합성괴인 : 진화의 심연" (D-085) — 11판(4-1 ~ 4-10 + 보스). 예전 7판(D-056)을 바꿈.
// 살점의 요람, 막는 세력 = 별의 사도들과 실패한 진화체들 (적 능력은 enemies_v2.js).
// 판마다 새 적: 진화의 광신도 → 생체 방패수(뼈 방패 장벽) → 심연 촉수귀 → 키메라 슬라임(분열) → 포자 술사(곡사)
// → 혈관 기생충(치유 + 광폭화) → 안구 감시탑(보랏빛 안광) → 광폭화 융합수(죽으면 산성 혈액), 4-9·4-10 혼합(4-10 물량).
// 4-B: 우주적 고치 앞 관장자 오큘러스 — 체력 50%에서 외눈 괴수로 강제 변이(극한의 변이, enemies_v2.js rage).
// 중간 요새(박동하는 고기 벽)는 다가오면 독액을 뿜음. 그림 2026-10-25 (stageArt_v2.js st4_*, 노랑 배경, 배경 ui_v2.css .v2-zone-4)
const Z4_ALL = { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 1, sporecaster: 1, parasite: 0.8, eyetower: 0.6, fusionbeast: 0.25 };
export const CHAPTER4 = {
    id: 'ch4',
    zone: 4,
    name: '구역 4 · 진화의 심연: 살점의 요람',
    art: { mid: 'st4_fort', final: 'st4_base', barricade: 'st4_barr' },
    defense: { mid: { range: 300, every: 3.2, dmg: 16, color: '150, 255, 90', label: '☣ 독액', puddle: { sec: 3, width: 110 }, hitFx: 'venomSplash' } },
    stages: [
        {
            id: '4-1', timeLimit: 220, starTime: 140, name: '찢어진 고치', desc: '고치를 찢고 깨어나자마자 달려드는 광신도들을 짓밟는다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.2, dps: 2.3, spawn: 1.9, max: 8, mix: { mutant: 1 } }, elite: 0.06,
            base: { mid: 7600, final: 13400 }, reward: { kill: 52, mid: 2900, final: 8000 }
        },
        {
            id: '4-2', timeLimit: 222, starTime: 142, name: '뼈와 살의 장벽', desc: '갑각과 뼈 방패로 길을 틀어막은 괴물들과 충돌한다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.28, dps: 2.33, spawn: 1.95, max: 8, mix: { mutant: 4, boneshield: 1 } }, elite: 0.07,
            base: { mid: 7900, final: 13800 }, reward: { kill: 53, mid: 2950, final: 8150 }
        },
        {
            id: '4-3', timeLimit: 226, starTime: 145, name: '변이의 복도', desc: '거머리 촉수를 휘두르는 짐승들과의 근접 혈투.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.36, dps: 2.36, spawn: 1.95, max: 8, mix: { mutant: 4, boneshield: 1, leechfiend: 2 } }, elite: 0.08,
            base: { mid: 8100, final: 14200 }, reward: { kill: 54, mid: 3000, final: 8300 }
        },
        {
            id: '4-4', timeLimit: 232, starTime: 150, name: '끝없는 증식', desc: '죽여도 다시 갈라지며 들러붙는 점액질들과의 소모전.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.44, dps: 2.4, spawn: 1.95, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 2 } }, elite: 0.09,
            base: { mid: 8400, final: 14600 }, reward: { kill: 55, mid: 3050, final: 8450 }
        },
        {
            id: '4-5', timeLimit: 238, starTime: 154, name: '심장벽 돌파', desc: '맹독을 뿜는 고기 벽을 분쇄한다. 포자 술사가 독 포자를 쏘아 올린다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 3.52, dps: 2.44, spawn: 1.9, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 1, sporecaster: 2 } }, elite: 0.1,
            base: { mid: 10400, final: 15000 }, reward: { kill: 56, mid: 3400, final: 8600 }
        },
        {
            id: '4-6', timeLimit: 242, starTime: 157, name: '기생의 늪', desc: '적에게 들러붙어 치유하고 광폭하게 만드는 기생충들이 진격을 방해한다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 3.6, dps: 2.48, spawn: 1.9, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 1, sporecaster: 1, parasite: 1.5 } }, elite: 0.11,
            base: { mid: 8900, final: 15400 }, reward: { kill: 57, mid: 3150, final: 8750 }
        },
        {
            id: '4-7', timeLimit: 246, starTime: 160, name: '시선이 머무는 곳', desc: '끔찍한 안구 기둥에서 보랏빛 안광이 쏟아진다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.68, dps: 2.52, spawn: 1.88, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 1, sporecaster: 1, parasite: 1, eyetower: 1.2 } }, elite: 0.12,
            base: { mid: 9200, final: 15800 }, reward: { kill: 58, mid: 3200, final: 8900 }
        },
        {
            id: '4-8', timeLimit: 250, starTime: 163, name: '실패작들의 무덤', desc: '모든 것이 뒤엉킨 거대한 융합 괴물이 나타난다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 3.74, dps: 2.24, spawn: 1.88, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 1, chimeraslime: 1, sporecaster: 1, parasite: 0.8, eyetower: 0.6, fusionbeast: 0.45 } }, elite: 0.12,
            base: { mid: 9400, final: 16100 }, reward: { kill: 59, mid: 3250, final: 9050 }
        },
        {
            id: '4-9', timeLimit: 255, starTime: 166, name: '제단의 입구', desc: '우주적 고치를 지키려 쏟아져 나오는 생물들의 총공세.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.61, dps: 2.27, spawn: 1.85, max: 9, mix: { ...Z4_ALL } }, elite: 0.13,
            base: { mid: 9500, final: 16400 }, reward: { kill: 60, mid: 3300, final: 9200 }
        },
        {
            id: '4-10', timeLimit: 260, starTime: 170, name: '강요된 진화', desc: '고치 앞에서 끝없이 몰려오는 기괴한 살점 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.54, dps: 2.29, spawn: 1.8, max: 9, mix: { ...Z4_ALL } }, elite: 0.15,
            base: { mid: 9700, final: 16800 }, reward: { kill: 62, mid: 3350, final: 9400 }
        },
        {
            id: '4-B', timeLimit: 265, starTime: 178, name: '설계자의 최후', desc: '관장자 오큘러스와의 보스전. 체력이 절반이 되면 생체 전기톱의 외눈 괴수로 변이한다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.9, dps: 2.62, spawn: 2.0, max: 9, mix: { mutant: 3, boneshield: 1, leechfiend: 2, chimeraslime: 1, sporecaster: 1, parasite: 1 } }, elite: 0.12,
            base: { mid: 9000, final: 15600 }, reward: { kill: 66, mid: 3600, final: 11000 },
            boss: { unit: 'oculus' }
        }
    ]
};
CHAPTER4.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 5: 새 기획 스테이지 5 "심연의 길잡이 : 가라앉는 오만" (D-085) — 11판(5-1 ~ 5-10 + 보스). 새 구역 (4-B를 깨면 열림).
// 해상 군사 요새 '포세이돈', 막는 세력 = 어비스 연합 해군 & 특수 잠수 부대 (적 능력은 enemies_v2.js).
// 판마다 새 적: 작살총 해병 → 격벽 방패수(해치 장벽) → 그물망 사수(3초 속박) → 수뢰 투척병(곡사 폭뢰) → 함포 포탑(직사 유탄)
// → 소나 드론(스킬 지연, 비행) → 맹독 잠수부(자폭 + 산성 장판) → 심해 구축 워커, 5-9·5-10 혼합(5-10 물량).
// 5-B: 중앙 통제 시추선 앞 해군 총사령관 아이언클래드(심해 압축포·폭뢰 융단폭격) + 기믹 오염된 해저 화산(20초마다 맹독 간헐천, enemyField.js tickGeysers).
// 중간 요새(해상 차단 수문)는 다가오면 전기 작살을 쏨. 그림 2026-10-25 (stageArt_v2.js st5_*, 배경 ui_v2.css .v2-zone-5)
const Z5_ALL = { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, deckgun: 0.6, sonardrone: 1, toxicdiver: 1, subwalker: 0.25 };
export const CHAPTER5 = {
    id: 'ch5',
    zone: 5,
    name: '구역 5 · 해상 요새 포세이돈: 가라앉는 오만',
    art: { mid: 'st5_fort', final: 'st5_base', barricade: 'st5_barr' },
    defense: { mid: { range: 440, every: 2.8, dmg: 24, color: '120, 210, 255', label: '⚡ 전기 작살', hitFx: 'arrowHit' } },
    stages: [
        {
            id: '5-1', timeLimit: 225, starTime: 145, name: '파도치는 갑판', desc: '해상 요새에 기어올랐다. 작살총 해병들과 교전한다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.6, dps: 2.5, spawn: 1.9, max: 8, mix: { marine: 1 } }, elite: 0.07,
            base: { mid: 8600, final: 15000 }, reward: { kill: 62, mid: 3300, final: 9000 }
        },
        {
            id: '5-2', timeLimit: 228, starTime: 147, name: '닫힌 해치', desc: '잠수함 해치를 뜯어 방패로 든 방패수들이 길을 막는다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.68, dps: 2.53, spawn: 1.95, max: 8, mix: { marine: 4, hatchshield: 1 } }, elite: 0.08,
            base: { mid: 8800, final: 15400 }, reward: { kill: 63, mid: 3350, final: 9150 }
        },
        {
            id: '5-3', timeLimit: 232, starTime: 150, name: '옥죄는 그물', desc: '강철 그물이 발을 3초간 묶는다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.76, dps: 2.56, spawn: 1.95, max: 8, mix: { marine: 4, hatchshield: 1, netgunner: 2 } }, elite: 0.09,
            base: { mid: 9000, final: 15800 }, reward: { kill: 64, mid: 3400, final: 9300 }
        },
        {
            id: '5-4', timeLimit: 236, starTime: 153, name: '쏟아지는 기뢰', desc: '폭뢰를 던지는 폭파병들과의 난전.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 3.84, dps: 2.6, spawn: 1.92, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 2 } }, elite: 0.1,
            base: { mid: 9200, final: 16200 }, reward: { kill: 65, mid: 3450, final: 9450 }
        },
        {
            id: '5-5', timeLimit: 240, starTime: 156, name: '수문 돌파', desc: '전기 작살을 쏘는 해상 차단 수문을 분쇄한다. 함포 포탑이 일직선 포격을 퍼붓는다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 3.92, dps: 2.64, spawn: 1.9, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, deckgun: 1.2 } }, elite: 0.11,
            base: { mid: 11200, final: 16600 }, reward: { kill: 66, mid: 3800, final: 9600 }
        },
        {
            id: '5-6', timeLimit: 244, starTime: 159, name: '찢어지는 이명', desc: '소나 드론의 고주파가 스킬을 봉쇄한다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 4.0, dps: 2.68, spawn: 1.9, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, deckgun: 0.6, sonardrone: 1.5 } }, elite: 0.11,
            base: { mid: 9600, final: 17000 }, reward: { kill: 67, mid: 3550, final: 9750 }
        },
        {
            id: '5-7', timeLimit: 248, starTime: 162, name: '끓어오르는 광기', desc: '맹독을 뒤집어쓴 자폭 잠수부들이 돌진한다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 4.08, dps: 2.72, spawn: 1.88, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, deckgun: 0.6, sonardrone: 1, toxicdiver: 1.5 } }, elite: 0.12,
            base: { mid: 9800, final: 17400 }, reward: { kill: 68, mid: 3600, final: 9900 }
        },
        {
            id: '5-8', timeLimit: 252, starTime: 165, name: '강철의 심해어', desc: '잠수함을 개조한 중장갑 워커와의 힘 싸움.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 4.14, dps: 2.42, spawn: 1.88, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, deckgun: 0.5, sonardrone: 0.8, toxicdiver: 0.8, subwalker: 0.45 } }, elite: 0.12,
            base: { mid: 10000, final: 17700 }, reward: { kill: 69, mid: 3650, final: 10050 }
        },
        {
            id: '5-9', timeLimit: 256, starTime: 168, name: '폭풍우 속으로', desc: '시추선을 지키기 위한 해군의 총공세.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.99, dps: 2.45, spawn: 1.85, max: 9, mix: { ...Z5_ALL } }, elite: 0.13,
            base: { mid: 10100, final: 18000 }, reward: { kill: 70, mid: 3700, final: 10200 }
        },
        {
            id: '5-10', timeLimit: 260, starTime: 172, name: '침몰하는 오만', desc: '요새의 마지막 방어선에서 벌어지는 대규모 난전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 3.91, dps: 2.46, spawn: 1.8, max: 9, mix: { ...Z5_ALL } }, elite: 0.15,
            base: { mid: 10300, final: 18400 }, reward: { kill: 71, mid: 3750, final: 10400 }
        },
        {
            id: '5-B', timeLimit: 265, starTime: 180, name: '심해의 묘비', desc: '중앙 통제 시추선 앞. 사령관 아이언클래드와 끓어오르는 해저 화산이 기다린다.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.3, dps: 2.82, spawn: 2.0, max: 9, mix: { marine: 3, hatchshield: 1, netgunner: 1, mineman: 1, sonardrone: 1, toxicdiver: 1 } }, elite: 0.12,
            base: { mid: 9800, final: 16200 }, reward: { kill: 76, mid: 4000, final: 12000 },
            // 오염된 해저 화산: every초마다 경보 → warn초 뒤 n곳(하나는 주인공 자리)에서 맹독 간헐천 — sec초 동안 위에 있으면 초당 최대 내구도 dps 비율
            boss: { unit: 'ironclad', geysers: { every: 20, warn: 2.2, n: 3, width: 130, sec: 4, dps: 0.012 } }
        }
    ]
};
CHAPTER5.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 6: 새 기획 스테이지 6 "봉합 성녀 : 피에 젖은 성역" (D-085) — 11판(6-1 ~ 6-10 + 보스). 예전 구역 6 "성왕국 변두리"(D-076·D-078, Claude 임의안)를 바꿈.
// 기적의 대병동, 막는 세력 = 성혈 의료 기사단 (적 능력은 enemies_v2.js).
// 판마다 새 적: 부패한 간병 보병 → 철의 처녀 방패수(가시 장벽) → 오염된 성수 투척병(독 장판) → 마취의 주술사(2초 기절) → 수혈 팩 드론(비행 치유)
// → 강제 수혈 실험체(자폭) → 기계화 구급 마차(보병 배출) → 처형의 군의관, 6-9·6-10 혼합(6-10 물량).
// 6-B: 성배의 성역 앞 '기적의 성배 : 탐욕의 심장'(핏빛 파동·혈정석 쐐기·생명력 착취) + 기믹 강제 헌혈(20초마다 실험체 3명이 심장으로 끌려감 —
//      닿으면 보스 회복 + 피의 방어막, enemyField.js tickDonors). 중간 요새(화형의 소각로)는 다가오면 화염을 뿜음.
// 그림 2026-10-25 (stageArt_v2.js st6_*, 배경 ui_v2.css .v2-zone-6)
const Z6_ALL = { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 0.8, bloated: 1, ambulance: 0.3, surgeon: 0.25 };
export const CHAPTER6 = {
    id: 'ch6',
    zone: 6,
    name: '구역 6 · 기적의 대병동: 피에 젖은 성역',
    art: { mid: 'st6_fort', final: 'st6_base', barricade: 'st6_barr' },
    defense: { mid: { range: 300, every: 3.0, dmg: 18, color: '255, 140, 40', label: '🔥 소각로 화염', puddle: { sec: 3, width: 120, fire: 16 }, hitFx: 'napalmBurst' } },
    stages: [
        {
            id: '6-1', timeLimit: 228, starTime: 148, name: '깨어진 안식', desc: '스테인드글라스를 깨고 VIP 병동에 난입했다. 간병 보병을 쓸어 낸다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.9, dps: 2.6, spawn: 1.9, max: 8, mix: { orderly: 1 } }, elite: 0.07,
            base: { mid: 9000, final: 15800 }, reward: { kill: 70, mid: 3800, final: 10000 }
        },
        {
            id: '6-2', timeLimit: 231, starTime: 150, name: '닫힌 병실', desc: '고문 기구를 방패로 든 중장갑 기사들이 병실을 막는다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 3.98, dps: 2.63, spawn: 1.95, max: 8, mix: { orderly: 4, maidenshield: 1 } }, elite: 0.08,
            base: { mid: 9200, final: 16200 }, reward: { kill: 71, mid: 3850, final: 10150 }
        },
        {
            id: '6-3', timeLimit: 235, starTime: 153, name: '독이 든 성수', desc: '바닥에 깔리는 오염된 성수를 피해 진격한다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.06, dps: 2.66, spawn: 1.95, max: 8, mix: { orderly: 4, maidenshield: 1, holywater: 2 } }, elite: 0.09,
            base: { mid: 9400, final: 16600 }, reward: { kill: 72, mid: 3900, final: 10300 }
        },
        {
            id: '6-4', timeLimit: 239, starTime: 156, name: '수면의 향로', desc: '마취 가스 향로가 진격을 2초씩 멈춰 세운다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.14, dps: 2.7, spawn: 1.92, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 2 } }, elite: 0.1,
            base: { mid: 9600, final: 17000 }, reward: { kill: 73, mid: 3950, final: 10450 }
        },
        {
            id: '6-5', timeLimit: 243, starTime: 159, name: '소각로 돌파', desc: '불을 뿜는 화형의 소각로를 부순다. 수혈 팩 드론이 기사들을 치료한다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 4.22, dps: 2.74, spawn: 1.9, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 1.5 } }, elite: 0.11,
            base: { mid: 11600, final: 17400 }, reward: { kill: 74, mid: 4300, final: 10600 }
        },
        {
            id: '6-6', timeLimit: 247, starTime: 162, name: '터져 나가는 희생양', desc: '피와 약물로 부풀어 오른 실험체들이 몸을 터뜨린다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 4.3, dps: 2.78, spawn: 1.9, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 1, bloated: 1.5 } }, elite: 0.11,
            base: { mid: 10000, final: 17800 }, reward: { kill: 75, mid: 4050, final: 10750 }
        },
        {
            id: '6-7', timeLimit: 251, starTime: 165, name: '죽음의 구급차', desc: '병력을 계속 뱉어 내는 구급 마차부터 부숴야 한다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 4.38, dps: 2.82, spawn: 1.88, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 1, bloated: 1, ambulance: 0.4 } }, elite: 0.12,
            base: { mid: 10200, final: 18200 }, reward: { kill: 76, mid: 4100, final: 10900 }
        },
        {
            id: '6-8', timeLimit: 255, starTime: 168, name: '해부학의 달인', desc: '전기톱 십자가를 든 처형의 군의관과의 근접전.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 4.44, dps: 2.51, spawn: 1.88, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 0.8, bloated: 0.8, ambulance: 0.3, surgeon: 0.45 } }, elite: 0.12,
            base: { mid: 10400, final: 18500 }, reward: { kill: 77, mid: 4150, final: 11050 }
        },
        {
            id: '6-9', timeLimit: 259, starTime: 171, name: '성배를 향하여', desc: '최종 기지를 지키려는 기사단의 총력전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 4.27, dps: 2.53, spawn: 1.85, max: 9, mix: { ...Z6_ALL } }, elite: 0.13,
            base: { mid: 10500, final: 18800 }, reward: { kill: 78, mid: 4200, final: 11200 }
        },
        {
            id: '6-10', timeLimit: 263, starTime: 175, name: '생명의 저울', desc: '사방에서 끝없이 쏟아지는 의료 기사단 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 4.19, dps: 2.55, spawn: 1.8, max: 9, mix: { ...Z6_ALL } }, elite: 0.15,
            base: { mid: 10700, final: 19200 }, reward: { kill: 79, mid: 4250, final: 11400 }
        },
        {
            id: '6-B', timeLimit: 270, starTime: 185, name: '무너진 영생', desc: '빈민의 피로 박동하는 "탐욕의 심장". 끌려가는 실험체를 막고 심장을 산산조각 내라.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.6, dps: 2.92, spawn: 2.0, max: 9, mix: { orderly: 3, maidenshield: 1, holywater: 1, anesthetist: 1, bloodbagdrone: 1, bloated: 1 } }, elite: 0.12,
            base: { mid: 10000, final: 16800 }, reward: { kill: 86, mid: 4500, final: 13500 },
            // 강제 헌혈: every초마다 경보 → 주인공 앞에 실험체 n명이 나타나 심장 쪽으로 걸어감. 닿으면 보스 최대 체력 heal 회복 + shield(최대 체력 비율) 방어막
            boss: { unit: 'grailheart', donors: { every: 20, warn: 1.6, n: 3, heal: 0.08, shield: 0.06 } }
        }
    ]
};
CHAPTER6.stages.forEach((st, i) => { st.map = MAP11[i]; });



// 구역 7: 새 기획 스테이지 7 "뒤틀린 인형사 : 잿빛 인형극" (D-085) — 11판(7-1 ~ 7-10 + 보스). 새 구역 (6-B를 깨면 열림).
// 포격으로 재가 된 전장과 무너진 고아원 터, 막는 세력 = 제국 제1 포병 사단 (적 능력은 enemies_v2.js).
// 판마다 새 적: 참호 징집병 → 철조망 방패병(철조망 장벽) → 유산탄 투척병(곡사) → 독가스 살포병(가스 구름 감속) → 야전 기관총 좌(연사)
// → 돌격 장교(호루라기: 주변 광폭화 + 보병 소환) → 지뢰 매설병(밟으면 기절) → 증기기관 전차, 7-9·7-10 혼합(7-10 물량).
// 7-B: 전방 사령탑 앞 '심판의 구포 : 베헤모스'(철갑탄 직사·백린 소이탄·궤도 톱니 돌진) + 기믹 조명탄(20초마다 — 제때 못 부수면 전장 융단 포격,
//      enemyField.js tickFlares). 중간 요새(강철 참호 벙커)는 다가오면 기관총을 쏨. 그림 2026-10-25 (stageArt_v2.js st7_*, 배경 ui_v2.css .v2-zone-7)
const Z7_ALL = { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, mgnest: 0.6, officer: 0.7, sapper: 1, steamtank: 0.25 };
export const CHAPTER7 = {
    id: 'ch7',
    zone: 7,
    name: '구역 7 · 잿빛 전장: 잿빛 인형극',
    art: { mid: 'st7_fort', final: 'st7_base', barricade: 'st7_barr' },
    defense: { mid: { range: 460, every: 1.8, dmg: 14, color: '255, 220, 120', label: '🔫 참호 기관총', hitFx: 'arrowHit' } },
    stages: [
        {
            id: '7-1', timeLimit: 230, starTime: 150, name: '부서진 요람', desc: '폭격당한 고아원 터. 태엽 인형들과 참호 보병들이 처음 부딪친다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 4.6, dps: 2.95, spawn: 1.9, max: 8, mix: { trench: 1 } }, elite: 0.07,
            base: { mid: 10400, final: 18000 }, reward: { kill: 82, mid: 4400, final: 11800 }
        },
        {
            id: '7-2', timeLimit: 233, starTime: 152, name: '찢어진 곰 인형', desc: '철조망을 찢으며 참호선으로 들어간다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 4.68, dps: 2.98, spawn: 1.95, max: 8, mix: { trench: 4, wireshield: 1 } }, elite: 0.08,
            base: { mid: 10600, final: 18400 }, reward: { kill: 83, mid: 4450, final: 11950 }
        },
        {
            id: '7-3', timeLimit: 237, starTime: 155, name: '비명과 파편', desc: '파편 수류탄이 빗발치는 전장.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.76, dps: 3.01, spawn: 1.95, max: 8, mix: { trench: 4, wireshield: 1, grenadier: 2 } }, elite: 0.09,
            base: { mid: 10800, final: 18800 }, reward: { kill: 84, mid: 4500, final: 12100 }
        },
        {
            id: '7-4', timeLimit: 241, starTime: 158, name: '노란 안개', desc: '겨자 가스가 깔린 독가스 지대를 돌파한다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 4.84, dps: 3.04, spawn: 1.92, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 2 } }, elite: 0.1,
            base: { mid: 11000, final: 19200 }, reward: { kill: 85, mid: 4550, final: 12250 }
        },
        {
            id: '7-5', timeLimit: 245, starTime: 161, name: '벙커 분쇄', desc: '쏟아지는 기관총을 뚫고 강철 참호 벙커를 부순다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 4.92, dps: 3.08, spawn: 1.9, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, mgnest: 1.2 } }, elite: 0.11,
            base: { mid: 13200, final: 19600 }, reward: { kill: 86, mid: 4900, final: 12400 }
        },
        {
            id: '7-6', timeLimit: 249, starTime: 164, name: '죽음의 호루라기', desc: '호루라기를 부는 돌격 장교가 참호 속 보병을 쏟아낸다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 5.0, dps: 3.12, spawn: 1.9, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, mgnest: 0.6, officer: 1.2 } }, elite: 0.11,
            base: { mid: 11400, final: 20000 }, reward: { kill: 87, mid: 4650, final: 12550 }
        },
        {
            id: '7-7', timeLimit: 253, starTime: 167, name: '보이지 않는 덫', desc: '바닥에 깔리는 대전차 지뢰밭.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 5.08, dps: 3.16, spawn: 1.88, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, mgnest: 0.6, officer: 0.7, sapper: 1.5 } }, elite: 0.12,
            base: { mid: 11600, final: 20400 }, reward: { kill: 88, mid: 4700, final: 12700 }
        },
        {
            id: '7-8', timeLimit: 257, starTime: 170, name: '쇳덩어리의 돌진', desc: '매연을 뿜는 증기기관 전차와의 힘 싸움.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 5.14, dps: 2.81, spawn: 1.88, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, mgnest: 0.5, officer: 0.6, sapper: 0.8, steamtank: 0.45 } }, elite: 0.12,
            base: { mid: 11800, final: 20700 }, reward: { kill: 89, mid: 4750, final: 12850 }
        },
        {
            id: '7-9', timeLimit: 261, starTime: 173, name: '사령탑 진입로', desc: '지휘부를 지키려는 제국군의 총력전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 4.94, dps: 2.83, spawn: 1.85, max: 9, mix: { ...Z7_ALL } }, elite: 0.13,
            base: { mid: 11900, final: 21000 }, reward: { kill: 90, mid: 4800, final: 13000 }
        },
        {
            id: '7-10', timeLimit: 265, starTime: 177, name: '재와 먼지', desc: '잿빛 폭풍 속에서 끝없이 쏟아지는 방어 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 4.83, dps: 2.86, spawn: 1.8, max: 9, mix: { ...Z7_ALL } }, elite: 0.15,
            base: { mid: 12100, final: 21400 }, reward: { kill: 91, mid: 4850, final: 13200 }
        },
        {
            id: '7-B', timeLimit: 270, starTime: 188, name: '끊어지지 않는 실', desc: '전방 사령탑 앞, 고아원을 부순 다족 보행 공성포 "베헤모스". 조명탄이 뜨면 재빨리 부숴라.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 5.3, dps: 3.27, spawn: 2.0, max: 9, mix: { trench: 3, wireshield: 1, grenadier: 1, gassoldier: 1, officer: 0.6, sapper: 1 } }, elite: 0.12,
            base: { mid: 11600, final: 19000 }, reward: { kill: 96, mid: 5100, final: 15000 },
            // 조명탄: every초마다 보스가 쏘아 올림 → fuse초 안에 부수지 못하면 전장 융단 포격 (최대 내구도 dmg). 조명탄 체력 hp × 적 체력 배율
            boss: { unit: 'behemoth', flares: { every: 20, fuse: 6, hp: 260, dmg: 0.22 } }
        }
    ]
};
CHAPTER7.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 8: 새 기획 스테이지 8 "서리의 무희 : 얼어붙은 안식" (D-085) — 11판(8-1 ~ 8-10 + 보스). 새 구역 (7-B를 깨면 열림).
// 영구동토의 왕국 노르딘 왕성, 막는 세력 = 노르딘 왕실 근위대 & 온기 탐식자들 (적 능력은 enemies_v2.js).
// 판마다 새 적: 횃불 징집병 → 화로 방패병(화로 장벽·근접 화상 반사) → 끓는 기름 투척병(불 장판) → 작살총 사냥꾼(덫 속박)
// → 열기 주술사(얼어붙은 병사 조각상을 녹여 깨움) → 증기 돌파병(자폭 수증기) → 열광선 포탑(스킬 지연) → 화염 늑대 기사, 8-9·8-10 혼합.
// 8-B: 메인 화로석 제단 앞 블라디미르 국왕(화룡의 숨결·잿더미 유성우·온기 강탈) + 기믹 탐욕의 제단(20초마다 제단 3개 —
//      서 있는 동안 열파동 지속 피해 + 국왕 공격력 상승, 모두 부수면 국왕 기절, enemyField.js tickAltars).
// 중간 요새(용광로 성문)는 다가오면 바닥에서 불기둥을 솟게 함. 그림 2026-10-25 (stageArt_v2.js st8_*, 배경 ui_v2.css .v2-zone-8)
const Z8_ALL = { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 0.6, steambomber: 1, heatturret: 0.6, wolfknight: 0.25 };
export const CHAPTER8 = {
    id: 'ch8',
    zone: 8,
    name: '구역 8 · 노르딘 왕성: 얼어붙은 안식',
    art: { mid: 'st8_fort', final: 'st8_base', barricade: 'st8_barr' },
    defense: { mid: { range: 320, every: 3.0, dmg: 20, color: '255, 120, 40', label: '🔥 용광로 불기둥', puddle: { sec: 3, width: 120, fire: 16 }, hitFx: 'napalmBurst' } },
    stages: [
        {
            id: '8-1', timeLimit: 232, starTime: 152, name: '얼음 공원', desc: '얼어붙은 극단원들 사이에서 횃불 병사들과 처음 부딪친다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 5.3, dps: 3.3, spawn: 1.9, max: 8, mix: { torch: 1 } }, elite: 0.07,
            base: { mid: 12000, final: 20600 }, reward: { kill: 94, mid: 5000, final: 13600 }
        },
        {
            id: '8-2', timeLimit: 235, starTime: 154, name: '녹아내리는 길', desc: '닿으면 화상을 입히는 화로 방패병들이 길을 막는다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 5.38, dps: 3.33, spawn: 1.95, max: 8, mix: { torch: 4, furnaceshield: 1 } }, elite: 0.08,
            base: { mid: 12200, final: 21000 }, reward: { kill: 95, mid: 5050, final: 13750 }
        },
        {
            id: '8-3', timeLimit: 239, starTime: 157, name: '끓는 발자국', desc: '끓는 기름병이 쏟아져 진격로가 좁아진다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 5.46, dps: 3.36, spawn: 1.95, max: 8, mix: { torch: 4, furnaceshield: 1, oilthrower: 2 } }, elite: 0.09,
            base: { mid: 12400, final: 21400 }, reward: { kill: 96, mid: 5100, final: 13900 }
        },
        {
            id: '8-4', timeLimit: 243, starTime: 160, name: '눈보라 속의 덫', desc: '덫과 강철 그물로 발을 묶는 사냥꾼들.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 5.54, dps: 3.4, spawn: 1.92, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 2 } }, elite: 0.1,
            base: { mid: 12600, final: 21800 }, reward: { kill: 97, mid: 5150, final: 14050 }
        },
        {
            id: '8-5', timeLimit: 247, starTime: 163, name: '용광로 돌파', desc: '불기둥을 뚫고 성문을 부순다. 열기 주술사가 얼어붙은 병사들을 깨운다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 5.62, dps: 3.44, spawn: 1.9, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 1 } }, elite: 0.11,
            base: { mid: 15000, final: 22200 }, reward: { kill: 98, mid: 5500, final: 14200 }
        },
        {
            id: '8-6', timeLimit: 251, starTime: 166, name: '화상과 동상', desc: '증기통을 매단 돌파병이 뛰어들어 터진다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 5.7, dps: 3.48, spawn: 1.9, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 0.6, steambomber: 1.5 } }, elite: 0.11,
            base: { mid: 13000, final: 22600 }, reward: { kill: 99, mid: 5250, final: 14350 }
        },
        {
            id: '8-7', timeLimit: 255, starTime: 169, name: '증기 장막', desc: '열광선 포탑이 서리 마법을 녹여 스킬을 늦춘다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 5.78, dps: 3.52, spawn: 1.88, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 0.6, steambomber: 1, heatturret: 1.2 } }, elite: 0.12,
            base: { mid: 13200, final: 23000 }, reward: { kill: 100, mid: 5300, final: 14500 }
        },
        {
            id: '8-8', timeLimit: 259, starTime: 172, name: '타오르는 짐승', desc: '화염 늑대를 탄 정예 기사와의 돌격전.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 5.84, dps: 3.12, spawn: 1.88, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 0.5, steambomber: 0.8, heatturret: 0.6, wolfknight: 0.45 } }, elite: 0.12,
            base: { mid: 13400, final: 23300 }, reward: { kill: 101, mid: 5350, final: 14650 }
        },
        {
            id: '8-9', timeLimit: 263, starTime: 175, name: '왕좌를 향하여', desc: '화로석 제단을 지키려는 근위대의 총력전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 5.61, dps: 3.15, spawn: 1.85, max: 9, mix: { ...Z8_ALL } }, elite: 0.13,
            base: { mid: 13500, final: 23600 }, reward: { kill: 102, mid: 5400, final: 14800 }
        },
        {
            id: '8-10', timeLimit: 267, starTime: 179, name: '고요한 죽음', desc: '사방에서 쏟아지는 불길 속의 난전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 5.47, dps: 3.17, spawn: 1.8, max: 9, mix: { ...Z8_ALL } }, elite: 0.15,
            base: { mid: 13700, final: 24000 }, reward: { kill: 103, mid: 5450, final: 15000 }
        },
        {
            id: '8-B', timeLimit: 272, starTime: 190, name: '심장이 얼어붙는 온도', desc: '메인 제단 앞, 화룡의 갑옷을 입은 블라디미르 국왕. 탐욕의 제단이 솟으면 모두 부숴라.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.0, dps: 3.62, spawn: 2.0, max: 9, mix: { torch: 3, furnaceshield: 1, oilthrower: 1, hunter: 1, heatshaman: 0.5, steambomber: 1 } }, elite: 0.12,
            base: { mid: 13200, final: 21600 }, reward: { kill: 108, mid: 5700, final: 17000 },
            // 탐욕의 제단: every초마다 제단 n개(체력 hp × 적 체력 배율) — 서 있는 동안 초당 최대 내구도 heat 비율 열파동 + 국왕 공격력 ×rage,
            // 모두 부수면 국왕 stun초 기절
            boss: { unit: 'vladimir', altars: { every: 20, n: 3, hp: 420, heat: 0.006, rage: 1.4, stun: 3 } }
        }
    ]
};
CHAPTER8.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 9: 새 기획 스테이지 9 "철거의 설계자 : 무너진 보금자리" (D-085) — 11판(9-1 ~ 9-10 + 보스). 새 구역 (8-B를 깨면 열림).
// 탐욕스러운 건설사의 제1 재건축 구역, 막는 세력 = 골드만 건설 용역 및 중장비 경비대 (적 능력은 enemies_v2.js).
// 판마다 새 적: 철거 용역 깡패 → 콘크리트 방패 드론(시멘트 장벽) → 시멘트 살수병(굳는 장판) → 리벳 저격수(곡사) → 용접기 워커(근접 + 약화)
// → 다이너마이트 광부(자폭) → 안전 감시관(사이렌 광폭화) → 레킹볼 크레인, 9-9·9-10 혼합(9-10 물량).
// 9-B: 메인 크레인 타워 앞 '탐욕의 파노프티콘'(철골 분쇄·H빔 투하·부실의 대가) + 기믹 폐자재 더미(20초마다 3개 — 서 있는 동안 보스 무적,
//      15초 안에 못 부수면 폭발, enemyField.js tickScrap). 중간 요새(불법 톨게이트)는 다가오면 기관총을 쏨.
// 그림 2026-10-25 (stageArt_v2.js st9_*, 배경 ui_v2.css .v2-zone-9)
const Z9_ALL = { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, welderwalker: 0.7, dynamite: 1, safetywarden: 0.7, wreckingcrane: 0.25 };
export const CHAPTER9 = {
    id: 'ch9',
    zone: 9,
    name: '구역 9 · 제1 재건축 구역: 무너진 보금자리',
    art: { mid: 'st9_fort', final: 'st9_base', barricade: 'st9_barr' },
    defense: { mid: { range: 460, every: 1.9, dmg: 15, color: '255, 220, 120', label: '🔫 톨게이트 기관총', hitFx: 'arrowHit' } },
    stages: [
        {
            id: '9-1', timeLimit: 234, starTime: 154, name: '부서진 장벽', desc: '철거 현장에 돌입했다. 쇠파이프를 든 용역 깡패들이 몰려온다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 6.0, dps: 3.65, spawn: 1.9, max: 8, mix: { thug: 1 } }, elite: 0.07,
            base: { mid: 13600, final: 23200 }, reward: { kill: 106, mid: 5600, final: 15400 }
        },
        {
            id: '9-2', timeLimit: 237, starTime: 156, name: '시멘트 벽', desc: '굳은 시멘트판을 앞세운 방패 드론의 방어선.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 6.08, dps: 3.68, spawn: 1.95, max: 8, mix: { thug: 4, concretedrone: 1 } }, elite: 0.08,
            base: { mid: 13800, final: 23600 }, reward: { kill: 107, mid: 5650, final: 15550 }
        },
        {
            id: '9-3', timeLimit: 241, starTime: 159, name: '굳어버린 발걸음', desc: '닿으면 굳는 시멘트가 발을 무겁게 한다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.16, dps: 3.71, spawn: 1.95, max: 8, mix: { thug: 4, concretedrone: 1, cementsprayer: 2 } }, elite: 0.09,
            base: { mid: 14000, final: 24000 }, reward: { kill: 108, mid: 5700, final: 15700 }
        },
        {
            id: '9-4', timeLimit: 245, starTime: 162, name: '철근 비', desc: '공사 중인 건물 위에서 리벳이 날아온다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.24, dps: 3.74, spawn: 1.92, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 2 } }, elite: 0.1,
            base: { mid: 14200, final: 24400 }, reward: { kill: 109, mid: 5750, final: 15850 }
        },
        {
            id: '9-5', timeLimit: 249, starTime: 165, name: '톨게이트 돌파', desc: '중화기가 거치된 불법 톨게이트를 뚫는다. 용접기 워커가 막아선다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 6.32, dps: 3.78, spawn: 1.9, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, welderwalker: 1.2 } }, elite: 0.11,
            base: { mid: 16800, final: 24800 }, reward: { kill: 110, mid: 6100, final: 16000 }
        },
        {
            id: '9-6', timeLimit: 253, starTime: 168, name: '위험한 불꽃', desc: '폭약을 짊어진 광부들이 뛰어든다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 6.4, dps: 3.82, spawn: 1.9, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, welderwalker: 0.7, dynamite: 1.5 } }, elite: 0.11,
            base: { mid: 14600, final: 25200 }, reward: { kill: 111, mid: 5850, final: 16150 }
        },
        {
            id: '9-7', timeLimit: 257, starTime: 171, name: '연속 발파', desc: '사이렌을 울리는 안전 감시관이 용역들을 광폭하게 만든다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 6.48, dps: 3.86, spawn: 1.88, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, welderwalker: 0.7, dynamite: 1, safetywarden: 1.2 } }, elite: 0.12,
            base: { mid: 14800, final: 25600 }, reward: { kill: 112, mid: 5900, final: 16300 }
        },
        {
            id: '9-8', timeLimit: 261, starTime: 174, name: '무너지는 철구', desc: '레킹볼 크레인과의 묵직한 힘 싸움.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 6.54, dps: 3.42, spawn: 1.88, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, welderwalker: 0.5, dynamite: 0.8, safetywarden: 0.6, wreckingcrane: 0.45 } }, elite: 0.12,
            base: { mid: 15000, final: 25900 }, reward: { kill: 113, mid: 5950, final: 16450 }
        },
        {
            id: '9-9', timeLimit: 265, starTime: 177, name: '타워 하부', desc: '크레인 타워를 지키는 용역들의 총공세.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 6.27, dps: 3.45, spawn: 1.85, max: 9, mix: { ...Z9_ALL } }, elite: 0.13,
            base: { mid: 15100, final: 26200 }, reward: { kill: 114, mid: 6000, final: 16600 }
        },
        {
            id: '9-10', timeLimit: 269, starTime: 181, name: '탐욕의 잔해', desc: '쏟아지는 중장비 웨이브 속 난전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 6.12, dps: 3.48, spawn: 1.8, max: 9, mix: { ...Z9_ALL } }, elite: 0.15,
            base: { mid: 15300, final: 26600 }, reward: { kill: 115, mid: 6050, final: 16800 }
        },
        {
            id: '9-B', timeLimit: 274, starTime: 192, name: '설계 변경', desc: '이동식 요새 "탐욕의 파노프티콘". 폐자재 더미가 쌓이면 15초 안에 모두 부숴라.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.7, dps: 3.97, spawn: 2.0, max: 9, mix: { thug: 3, concretedrone: 1, cementsprayer: 1, rivetsniper: 1, dynamite: 1, safetywarden: 0.6 } }, elite: 0.12,
            base: { mid: 14800, final: 24200 }, reward: { kill: 120, mid: 6300, final: 19000 },
            // 폐자재 더미: every초마다 n개(체력 hp × 적 체력 배율) — 서 있는 동안 보스 무적, fuse초 안에 모두 못 부수면 폭발 (최대 내구도 dmg)
            boss: { unit: 'panopticon', scrap: { every: 20, n: 3, hp: 460, fuse: 15, dmg: 0.25 } }
        }
    ]
};
CHAPTER9.stages.forEach((st, i) => { st.map = MAP11[i]; });

// 구역 10: 새 기획 스테이지 10 "침묵의 방송자 : 거짓된 주파수" (D-085) — 11판(10-1 ~ 10-10 + 보스). 새 구역 (9-B를 깨면 열림). 마지막 구역.
// 언론 통제국의 중앙 방송 타워, 막는 세력 = 언론 통제국 & 세뇌된 진압대 (적 능력은 enemies_v2.js).
// 판마다 새 적: 세뇌된 시민 → 음파 방패 경비대(소음 장벽) → 스피커 드론(공격력 감소) → 광선 저격 경찰(직선 레이저) → 주파수 교란기(스킬 지연)
// → 우퍼 메카(밀어냄) → 철거 용역 깡패(9구역) → 통제국 집행관, 10-9·10-10 혼합(10-10 물량).
// 10-B: 타워 최상층 코어 룸의 '절대 발언권 마더 보이스'(주파수 폭발·거짓의 메아리·통제 레이저) + 기믹 세뇌 방송국 가동
//      (20초마다 보스 무적 + 세뇌 증폭 안테나 4개 — 10초 안에 못 부수면 소음 파동, enemyField.js tickAntennas).
// 중간 요새(전파 차단 격벽)는 다가오면 레이저를 쏨. 그림 2026-10-25 (stageArt_v2.js st10_*, 배경 ui_v2.css .v2-zone-10)
const Z10_ALL = { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, jammer: 0.6, woofermech: 0.5, thug: 1, enforcer: 0.25 };
export const CHAPTER10 = {
    id: 'ch10',
    zone: 10,
    name: '구역 10 · 중앙 방송 타워: 거짓된 주파수',
    art: { mid: 'st10_fort', final: 'st10_base', barricade: 'st10_barr' },
    defense: { mid: { range: 480, every: 2.4, dmg: 22, color: '255, 60, 200', label: '🔺 레이저 감지 격벽', hitFx: 'arrowHit' } },
    stages: [
        {
            id: '10-1', timeLimit: 236, starTime: 156, name: '거짓의 도시', desc: '방송국에 들어서자 세뇌된 폭도들이 기계적으로 달려든다.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 6.7, dps: 4.0, spawn: 1.9, max: 8, mix: { citizen: 1 } }, elite: 0.07,
            base: { mid: 15200, final: 25800 }, reward: { kill: 118, mid: 6200, final: 17200 }
        },
        {
            id: '10-2', timeLimit: 239, starTime: 158, name: '소음 장막', desc: '핑크빛 음파 실드를 펼치는 진압 경찰.',
            distance: 1000, midAt: 450, finalAt: 900,
            enemy: { hp: 6.78, dps: 4.03, spawn: 1.95, max: 8, mix: { citizen: 4, sonicshield: 1 } }, elite: 0.08,
            base: { mid: 15400, final: 26200 }, reward: { kill: 119, mid: 6250, final: 17350 }
        },
        {
            id: '10-3', timeLimit: 243, starTime: 161, name: '귀를 찢는 방송', desc: '공중의 스피커 드론이 공격력을 깎는다.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.86, dps: 4.06, spawn: 1.95, max: 8, mix: { citizen: 4, sonicshield: 1, speakerdrone: 2 } }, elite: 0.09,
            base: { mid: 15600, final: 26600 }, reward: { kill: 120, mid: 6300, final: 17500 }
        },
        {
            id: '10-4', timeLimit: 247, starTime: 164, name: '네온 십자포화', desc: '핑크빛 레이저 저격 구간.',
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 6.94, dps: 4.09, spawn: 1.92, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 2 } }, elite: 0.1,
            base: { mid: 15800, final: 27000 }, reward: { kill: 121, mid: 6350, final: 17650 }
        },
        {
            id: '10-5', timeLimit: 251, starTime: 167, name: '보안문 돌파', desc: '레이저 감지 격벽을 무너뜨리고 들어간다. 주파수 교란기가 스킬을 마비시킨다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 7.02, dps: 4.13, spawn: 1.9, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, jammer: 1.2 } }, elite: 0.11,
            base: { mid: 18600, final: 27400 }, reward: { kill: 122, mid: 6700, final: 17800 }
        },
        {
            id: '10-6', timeLimit: 255, starTime: 170, name: '끊어진 전파', desc: '음파로 밀어내는 우퍼 메카가 나타난다.',
            distance: 1100, midAt: 500, finalAt: 1000,
            enemy: { hp: 7.1, dps: 4.17, spawn: 1.9, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, jammer: 0.6, woofermech: 0.8 } }, elite: 0.11,
            base: { mid: 16200, final: 27800 }, reward: { kill: 123, mid: 6450, final: 17950 }
        },
        {
            id: '10-7', timeLimit: 259, starTime: 173, name: '진동하는 대지', desc: '건설사에서 급파한 용역 깡패들까지 섞여 든다.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 7.18, dps: 4.21, spawn: 1.88, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, jammer: 0.6, woofermech: 0.7, thug: 1.5 } }, elite: 0.12,
            base: { mid: 16400, final: 28200 }, reward: { kill: 124, mid: 6500, final: 18100 }
        },
        {
            id: '10-8', timeLimit: 263, starTime: 176, name: '강제 진압', desc: '전기 진압봉을 든 사이보그 집행관과의 충돌.',
            distance: 1150, midAt: 520, finalAt: 1050,
            enemy: { hp: 7.24, dps: 3.73, spawn: 1.88, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, jammer: 0.5, woofermech: 0.6, thug: 0.8, enforcer: 0.45 } }, elite: 0.12,
            base: { mid: 16600, final: 28500 }, reward: { kill: 125, mid: 6550, final: 18250 }
        },
        {
            id: '10-9', timeLimit: 267, starTime: 179, name: '코어 룸 입구', desc: '최상층을 지키려는 방송국 병력의 총력전.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 6.93, dps: 3.76, spawn: 1.85, max: 9, mix: { ...Z10_ALL } }, elite: 0.13,
            base: { mid: 16700, final: 28800 }, reward: { kill: 126, mid: 6600, final: 18400 }
        },
        {
            id: '10-10', timeLimit: 271, starTime: 183, name: '영원한 침묵을 위하여', desc: '끝없이 몰려오는 사이버펑크 웨이브.',
            distance: 1200, midAt: 550, finalAt: 1100,
            enemy: { hp: 6.76, dps: 3.78, spawn: 1.8, max: 9, mix: { ...Z10_ALL } }, elite: 0.15,
            base: { mid: 16900, final: 29200 }, reward: { kill: 127, mid: 6650, final: 18600 }
        },
        {
            id: '10-B', timeLimit: 276, starTime: 194, name: '빼앗긴 목소리', desc: '메인 기계 코어 "마더 보이스". 세뇌 증폭 안테나가 솟으면 10초 안에 모두 부숴라.', boss: true,
            distance: 1050, midAt: 470, finalAt: 950,
            enemy: { hp: 7.4, dps: 4.32, spawn: 2.0, max: 9, mix: { citizen: 3, sonicshield: 1, speakerdrone: 1, lasersniper: 1, woofermech: 0.6, thug: 1 } }, elite: 0.12,
            base: { mid: 16400, final: 26800 }, reward: { kill: 132, mid: 6900, final: 21000 },
            // 세뇌 방송국 가동: every초마다 보스 무적 + 안테나 n개(체력 hp × 적 체력 배율) — fuse초 안에 모두 못 부수면 소음 파동 (최대 내구도 dmg)
            boss: { unit: 'mothervoice', antennas: { every: 20, n: 4, hp: 360, fuse: 10, dmg: 0.25 } }
        }
    ]
};
CHAPTER10.stages.forEach((st, i) => { st.map = MAP11[i]; });

export const CHAPTERS = [CHAPTER1, CHAPTER2, CHAPTER3, CHAPTER4, CHAPTER5, CHAPTER6, CHAPTER7, CHAPTER8, CHAPTER9, CHAPTER10];
// 스테이지마다 챕터 정보(거점 그림 art, 요새 사격 defense, 요새 회복 midHeal, chapter id, 구역 번호)를 붙여 둠 — 전투·메뉴가 stage.art / stage.chapter / stage.zone으로 씀
CHAPTERS.forEach(ch => ch.stages.forEach(st => {
    st.chapter = ch.id; st.zone = ch.zone; st.art = ch.art; st.defense = ch.defense || null; st.midHeal = ch.midHeal || 0;
}));
export const STAGES = CHAPTERS.flatMap(ch => ch.stages);

export function chapterOf(stageOrId) {
    const id = typeof stageOrId === 'string' ? stageOrId : stageOrId && stageOrId.id;
    return CHAPTERS.find(ch => ch.stages.some(s => s.id === id)) || CHAPTER1;
}

/** 시험용 전체 잠금 해제 (메뉴 왼쪽 위 아이콘 5번 — menu_v2.js). 메모리에만 있어 게임을 다시 켜면 원래대로 */
let allStagesOpen = false;
export function unlockAllStagesTemp() { allStagesOpen = true; }
export function allStagesUnlocked() { return allStagesOpen; }

/** 챕터가 열렸는지: 첫 스테이지가 열렸으면 */
export function chapterUnlocked(ch, progress) {
    return allStagesOpen || (isZoneReleased(ch.zone) && isUnlocked(ch.stages[0].id, progress));
}

/** 챕터 안에서 기본으로 고를 스테이지: 아직 못 깬 첫 스테이지 (전부 깼으면 마지막) */
export function defaultStageIn(ch, progress) {
    return ch.stages.find(s => !progress.stage(s.id).cleared) || ch.stages[ch.stages.length - 1];
}

export function stageById(id) {
    return STAGES.find(s => s.id === id) || STAGES[0];
}

export function nextStageOf(id) {
    const i = STAGES.findIndex(s => s.id === id);
    return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/** 열린 스테이지: 첫 스테이지 + 바로 앞 스테이지를 클리어한 스테이지 (시험용 전체 해제 중이면 모두) */
export function isUnlocked(id, progress) {
    return (allStagesOpen && STAGES.some(s => s.id === id)) || isUnlockedNormally(id, progress);
}

/** 시험용 전체 해제와 상관없이 진행으로 열린 스테이지 */
export function isUnlockedNormally(id, progress) {
    const i = STAGES.findIndex(s => s.id === id);
    return i >= 0 && isZoneReleased(STAGES[i].zone) && (i === 0 || progress.stage(STAGES[i - 1].id).cleared);
}

/** 기본으로 고를 스테이지: 아직 클리어하지 않은 가장 앞 스테이지 (전부 클리어면 마지막) */
export function defaultStage(progress) {
    return STAGES.find(s => !progress.stage(s.id).cleared) || STAGES[STAGES.length - 1];
}
