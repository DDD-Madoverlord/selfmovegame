"""
적 리그(js/engine_v2/rig/enemyRigs.js)를 전투용 스프라이트로 한꺼번에 굽고, 게임이 읽는 값을 만든다 (D-035)

실행: 프로젝트 루트에서
  python tools/rig/bake_enemies.py            # 전부
  python tools/rig/bake_enemies.py guardian   # 하나만 (나머지는 기존 json 값을 그대로 씀)

출력: assets/sprites/rig/<적>/<적>_<동작>.png, <적>.json  (bake_sprite.py 여러 클립 모드: 같은 틀·배율)
      js/engine_v2/enemyArt_v2.js  (자동 생성: 프레임 크기·발 위치·동작별 그림 — enemies_v2.js가 씀)

키(px)는 걷기 기준 게임 크기: 일반 적 92 (주인공의 절반), 방패병은 덩치가 커서 1.12배, 보스는 주인공(186)과 맞서게 196

퀄리티업 Q5 (Q-008, 2026-10-20): 그림은 2배 픽셀(RES)·WebP 품질 90으로 굽고 (게임 크기는 그대로 — 큰 화면에서 선명),
프레임을 늘림 (걷기 12 → 16, 공격 10 → 14, 보스 기술 12 → 16, 8 → 12)
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JS_OUT = 'js/engine_v2/enemyArt_v2.js'
RES, WEBP = 2, 90   # 그림 픽셀 배율 · WebP 품질 (bake_sprite.py --res --webp)
# 보스는 화면에 크게(키 196~236) 나와 2배면 시트 하나가 화면 메모리 약 15MB(보스 하나 50~60MB) → 1.5배
# (1080p 전체 화면의 해상도 배율이 1.5라 거기서는 화질 차이 없음, 메모리는 약 56%)
BOSS_RES = 1.5
BOSSES = {'guardian', 'scrapking', 'archbishop', 'oculus', 'oculus2', 'wmdalpha', 'terraformer', 'benedict', 'ironclad', 'grailheart', 'behemoth', 'vladimir', 'panopticon', 'mothervoice'}
ENEMIES = {
    'guard': (92, 'walk:16,attack:14'),
    'shield': (103, 'walk:16,attack:14'),
    'tranq': (92, 'walk:16,attack:12'),
    'shock': (92, 'walk:16,attack:14'),
    'medic': (92, 'walk:16,attack:14'),
    'guardian': (196, 'walk:16,attack:16,bash:14'),
    'minion': (92, 'walk:16,attack:14'),        # 합성괴인 졸개(아군) — 경비병과 같은 키
    'rabbit': (72, 'walk:16,attack:14'),        # 뒤틀린 인형사의 토끼 인형(아군) — 작은 인형
    # 구역 2: 고철 약탈단 (D-040) — 방벽병은 덩치·배낭이 커서 103, 고철왕은 넓은 탑승형이라 230
    'raider': (92, 'walk:16,attack:14'),
    'builder': (103, 'walk:16,attack:14'),
    'sludge': (92, 'walk:16,attack:12'),
    'netter': (92, 'walk:16,attack:12'),
    'mechanic': (92, 'walk:16,attack:14'),
    'scrapking': (230, 'walk:16,attack:16,magnet:16,drop:14'),
    # 구역 3: 성왕국 (D-056) — 방패병 103, 악마기사(엘리트) 115, 대주교는 가마까지 215
    'soldier': (92, 'walk:16,attack:14'),
    'inquisitor': (98, 'walk:16,attack:14'),    # 새 기획 구역 3 그림 (D-085)
    'holyshield': (106, 'walk:16,attack:14'),   # 새 기획 구역 3 그림 (D-085)
    'priest': (92, 'walk:16,attack:14'),
    'mage': (96, 'walk:16,attack:14'),
    'demon': (90, 'walk:16,attack:14'),
    'demonknight': (115, 'walk:16,attack:16'),
    'archbishop': (215, 'walk:16,attack:16,bash:16'),
    # 구역 4: 심연 — 방패수 108, 포자 술사는 등의 식물까지 104, 슬라임은 납작하고 넓어 78
    'cultist': (94, 'walk:16,attack:14'),
    'tentacle': (96, 'walk:16,attack:14'),
    'carapace': (108, 'walk:16,attack:14'),
    'sporer': (104, 'walk:16,attack:14'),
    'slime': (78, 'walk:16,attack:14'),
    # 보스 오큘러스 (벌레 몸이 넓어 고철왕과 같은 230), 2페이즈는 같은 틀로 그림만 바꿔 끼움
    'oculus': (230, 'walk:16,attack:16,magnet:16,drop:16'),
    'oculus2': (236, 'walk:16,attack:16,magnet:16,drop:16'),
    # ---- 새 기획 스테이지 1 · 블랙 하운드 (D-085) — 방패병 103, 로켓·화염 94(등짐), 강화병 128(중간 보스급), 군견 62(네 발), 드론 72 ----
    'conscript': (92, 'walk:16,attack:14'),
    'riot': (103, 'walk:16,attack:14'),
    'taser': (92, 'walk:16,attack:14'),
    'rocket': (94, 'walk:16,attack:14'),
    'flamer': (94, 'walk:16,attack:14'),
    'exo': (128, 'walk:16,attack:16'),
    'hound': (62, 'walk:12,attack:12'),
    'empdrone': (72, 'walk:16,attack:12'),
    'wmdalpha': (236, 'walk:16,attack:16,laser:20'),
    # ---- 새 기획 스테이지 2 · 중장비 방위군 (D-085) — 메카·차량은 크게: 불도저 100, 트럭 108, 톱날 드론 70, 음파 탑 150, 워커 135,
    #      산성액 메카 125, 엑스카베이터 140(중간 보스급), 보스 테라포머 246 ----
    'merc': (92, 'walk:16,attack:14'),
    'dozer': (100, 'walk:12,attack:14'),
    'harpoon': (108, 'walk:12,attack:14'),
    'sawdrone': (70, 'walk:12,attack:12'),
    'acidmech': (125, 'walk:16,attack:16'),
    'sonictower': (150, 'walk:12,attack:12'),
    'spiderwalker': (135, 'walk:16,attack:14'),
    'excavator': (140, 'walk:16,attack:16'),
    'terraformer': (246, 'walk:16,attack:16,pile:20'),
    # ---- 새 기획 스테이지 3 · 성왕국 (D-085) — 처형인 132(중간 보스급), 그리폰 110, 발리스타 96, 보스 베네딕트 232 ----
    'zealot': (92, 'walk:16,attack:14'),
    'lightmage': (100, 'walk:16,attack:14'),
    'battlepriest': (96, 'walk:16,attack:14'),
    'executioner': (132, 'walk:16,attack:16'),
    'griffon': (110, 'walk:12,attack:12'),
    'ballista': (96, 'walk:12,attack:14'),
    'benedict': (232, 'walk:16,attack:16,bash:16,drain:16'),
    # ---- 새 기획 스테이지 4 · 진화의 심연 (D-085) — 방패수 112, 융합수 150(중간 보스급), 감시탑 150, 슬라임 70, 기생충 56 (보스 oculus는 위 줄) ----
    'mutant': (94, 'walk:16,attack:14'),
    'boneshield': (112, 'walk:16,attack:14'),
    'leechfiend': (104, 'walk:16,attack:14'),
    'sporecaster': (104, 'walk:16,attack:14'),
    'chimeraslime': (70, 'walk:16,attack:14'),
    'parasite': (56, 'walk:16,attack:12'),
    'eyetower': (150, 'walk:12,attack:12'),
    'fusionbeast': (150, 'walk:16,attack:14'),
    # ---- 새 기획 스테이지 5 · 어비스 연합 해군 (D-085) — 방패수 106, 워커 150(중간 보스급), 함포 110, 드론 72, 보스 아이언클래드 250 ----
    'marine': (92, 'walk:16,attack:12'),
    'hatchshield': (106, 'walk:16,attack:14'),
    'netgunner': (94, 'walk:16,attack:14'),
    'mineman': (94, 'walk:16,attack:14'),
    'toxicdiver': (100, 'walk:16,attack:14'),
    'sonardrone': (72, 'walk:16,attack:12'),
    'deckgun': (110, 'walk:12,attack:14'),
    'subwalker': (150, 'walk:16,attack:14'),
    'ironclad': (250, 'walk:16,attack:16,cannon:20,barrage:16'),
    # ---- 새 기획 스테이지 6 · 성혈 의료 기사단 (D-085) — 방패수 108, 군의관 134(중간 보스급), 구급 마차 120, 드론 70, 보스 탐욕의 심장 220 ----
    'orderly': (94, 'walk:16,attack:14'),
    'maidenshield': (108, 'walk:16,attack:14'),
    'holywater': (94, 'walk:16,attack:14'),
    'anesthetist': (96, 'walk:16,attack:14'),
    'bloated': (104, 'walk:16,attack:14'),
    'surgeon': (134, 'walk:16,attack:16'),
    'bloodbagdrone': (70, 'walk:16,attack:12'),
    'ambulance': (120, 'walk:12,attack:14'),
    'grailheart': (220, 'walk:16,attack:16,drain:16'),
    # ---- 새 기획 스테이지 7 · 제국 제1 포병 사단 (D-085) — 방패병 104, 전차 130(중간 보스급), 기관총 좌 100, 보스 베헤모스 250 ----
    'trench': (96, 'walk:16,attack:14'),
    'wireshield': (104, 'walk:16,attack:14'),
    'grenadier': (96, 'walk:16,attack:14'),
    'gassoldier': (96, 'walk:16,attack:14'),
    'officer': (96, 'walk:16,attack:14'),
    'sapper': (94, 'walk:16,attack:14'),
    'mgnest': (100, 'walk:12,attack:12'),
    'steamtank': (130, 'walk:12,attack:14'),
    'behemoth': (250, 'walk:16,attack:16,cannon:16,charge:14'),
    # ---- 새 기획 스테이지 8 · 노르딘 왕실 근위대 (D-085) — 방패병 106, 늑대 기사 150(중간 보스급), 포탑 120, 보스 블라디미르 250 ----
    'torch': (96, 'walk:16,attack:14'),
    'furnaceshield': (106, 'walk:16,attack:14'),
    'oilthrower': (96, 'walk:16,attack:14'),
    'hunter': (98, 'walk:16,attack:12'),
    'heatshaman': (102, 'walk:16,attack:14'),
    'steambomber': (100, 'walk:16,attack:14'),
    'frozenstatue': (96, 'walk:8,attack:8'),
    'heatturret': (120, 'walk:12,attack:12'),
    'wolfknight': (150, 'walk:12,attack:14'),
    'vladimir': (250, 'walk:16,attack:16,breath:16'),
    # ---- 새 기획 스테이지 9 · 골드만 건설 용역 (D-085) — 드론 100, 용접기 워커 130, 레킹볼 크레인 160(중간 보스급), 보스 파노프티콘 260 ----
    'thug': (94, 'walk:16,attack:14'),
    'concretedrone': (100, 'walk:12,attack:14'),
    'cementsprayer': (96, 'walk:16,attack:14'),
    'rivetsniper': (96, 'walk:16,attack:12'),
    'welderwalker': (130, 'walk:16,attack:14'),
    'dynamite': (98, 'walk:16,attack:14'),
    'safetywarden': (96, 'walk:16,attack:14'),
    'wreckingcrane': (160, 'walk:12,attack:14'),
    'panopticon': (260, 'walk:16,attack:14,barrage:16'),
    # ---- 새 기획 스테이지 10 · 언론 통제국 (D-085) — 집행관 140(중간 보스급), 우퍼 메카 120, 교란기 130, 보스 마더 보이스 240 ----
    'citizen': (94, 'walk:16,attack:14'),
    'sonicshield': (104, 'walk:16,attack:14'),
    'speakerdrone': (72, 'walk:16,attack:12'),
    'lasersniper': (96, 'walk:16,attack:12'),
    'jammer': (130, 'walk:12,attack:12'),
    'woofermech': (120, 'walk:12,attack:12'),
    'enforcer': (140, 'walk:16,attack:14'),
    'mothervoice': (240, 'walk:16,attack:16,laser:16'),
}


def out_png(name):
    return f'assets/sprites/rig/{name}/{name}.png'


def bake(name):
    height, spec = ENEMIES[name]
    subprocess.run([sys.executable, os.path.join(HERE, 'bake_sprite.py'), name, spec, str(height), out_png(name),
                    f'--res={BOSS_RES if name in BOSSES else RES}', f'--webp={WEBP}'], check=True, timeout=600)
    # 예전 PNG 시트는 WebP로 바뀌어 쓰지 않음 → 지움 (리그에서 언제든 다시 구울 수 있음)
    for clip in (part.split(':')[0] for part in spec.split(',')):
        old = f'assets/sprites/rig/{name}/{name}_{clip}.png'
        if os.path.exists(old):
            os.remove(old)


def write_js():
    lines = [
        '// 자동 생성 파일: python tools/rig/bake_enemies.py (손으로 고치지 말 것)',
        '// 적 그림 (로드맵 C단계, D-035): 리그를 구운 동작별 스프라이트. 같은 틀·배율이라 바꿔 끼워도 발 위치가 같음',
        '// frameWidth·frameHeight = 프레임 크기(px), anchorX = 프레임 안 발 사이 x, 동작 = { src, frames, duration }',
        'export const ENEMY_ART = {',
    ]
    for name in ENEMIES:
        meta = json.load(open(os.path.splitext(out_png(name))[0] + '.json', encoding='utf-8'))
        clips = ', '.join(f"{c}: {{ src: '{v['src']}', frames: {v['frames']}, duration: {v['duration']} }}"
                          for c, v in meta['clips'].items())
        lines.append(f"    {name}: {{ frameWidth: {meta['frameWidth']}, frameHeight: {meta['frameHeight']}, "
                     f"anchorX: {meta['anchorX']}, {clips} }},")
    lines.append('};')
    open(JS_OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('→', JS_OUT)


def main():
    names = sys.argv[1:] or list(ENEMIES)
    for name in names:
        bake(name)
    write_js()


if __name__ == '__main__':
    main()
