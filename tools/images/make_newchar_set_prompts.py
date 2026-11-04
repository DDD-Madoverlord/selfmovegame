"""
새 캐릭터 6명 세트 그림 Gemini 요청 글 (파츠 확장 2차 D-071의 남은 그림 단계)

  python tools/images/make_newchar_set_prompts.py diver a full      # 1단계: 기본 전신(<id>_1_gemini.png) 첨부 → 세트 전신
  python tools/images/make_newchar_set_prompts.py diver a armless   # 2단계: 세트 전신 한 장만 첨부 → 팔 없는 몸

받은 그림 (assets/sprites/parts/<id>/src): <id>_set_<글자>_gemini.png (전신) · <id>_set_<글자>_armless_gemini.png (팔 없음)
→ 자르기는 tools/rig/cut_newchar_sets.py. 외형 글은 newchar_set_looks.json (sets2/<id>Sets2.js 파츠 look을 영어로)
요령(새캐릭터_설계안 9장): 새 대화 + 그림 한 장 + "Edit the attached image" 방식이 자리 0px로 맞음, 팔 없는 몸은 "새 물건을 그리지 말 것"
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOOKS = json.load(open(os.path.join(HERE, 'newchar_set_looks.json'), encoding='utf-8'))
BG = {'diver': 'magenta (#FF00FF)', 'doll': 'magenta (#FF00FF)', 'saint': 'green (#00FF00)', 'frost': 'green (#00FF00)',
      'architect': 'green (#00FF00)', 'broadcaster': 'green (#00FF00)'}


def full_prompt(cid, letter):
    s = LOOKS[cid][letter]
    return (
        'Generate an image (not a description). Edit the attached image. It is a 16-bit pixel-art game character sprite '
        f'facing right on a flat solid {BG[cid]} background. Keep EXACTLY the same character, face, body proportions, pose, '
        'limb positions, size and position in the frame, the same pixel-art style and the same flat background color. '
        f'Only redesign the outfit and equipment into the "{s["name"]}" set: '
        f'head: {s["head"]}; body/outfit: {s["body"]}; front arm (the arm reaching to the right): {s["arm"]}; '
        f'back arm: {s["back"]}; legs: {s["leg"]}. '
        'Keep both arms in the same place as now and the feet on the same ground line. '
        'No text, no background objects, no shadow on the background, full body visible. Keep the square 1:1 format.'
        + (NO_CROSS if cid == 'saint' else ''))


# 봉합 성녀는 십자 대신 성왕국 태양 문양 (D-075) — Gemini가 수녀 옷에 십자를 자주 그려 넣음
NO_CROSS = ' Do not draw any cross symbols; use a small golden sun emblem instead.'


def armless_prompt(cid, letter):
    return (
        'Generate an image (not a description). Edit the attached image: remove BOTH arms completely, from the shoulders '
        'down to the hands, together with everything held in the hands (weapons, tools, items). Keep everything else '
        'exactly identical: same head, body, outfit, legs, colors, size, position and the same flat '
        f'{BG[cid]} background. Fill in the parts of the body that were hidden behind the arms. Do not draw any new objects.')


if __name__ == '__main__':
    cid, letter, kind = sys.argv[1:4]
    print(full_prompt(cid, letter) if kind == 'full' else armless_prompt(cid, letter))
