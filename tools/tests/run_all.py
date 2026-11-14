"""
v2 브라우저 자동 검사 한 번에 실행

  python tools/tests/run_all.py            # 전부
  python tools/tests/run_all.py battle     # 이름에 'battle'이 들어간 검사만

필요: Python playwright (설치된 Chrome 사용). 서버는 검사가 직접 띄운다.
결과: 항목마다 PASS/FAIL, 실패가 있으면 종료 코드 1. 스크린샷은 tools/tests/_out/
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import run_tests  # noqa: E402

NAMES = ['test_menu_lab', 'test_battle', 'test_support', 'test_support_repeat', 'test_support_ui', 'test_flow', 'test_sound', 'test_stages', 'test_difficulty', 'test_growth', 'test_dispatch', 'test_bases', 'test_zone2', 'test_zone34', 'test_zone5', 'test_zone6', 'test_zone78', 'test_zone910', 'test_enemy_skills', 'test_elite', 'test_sets', 'test_kit',
         'test_diver', 'test_saint', 'test_frost', 'test_doll', 'test_newchars2', 'test_app_update', 'test_firstplay', 'test_setui', 'test_grade_ui', 'test_set_perks', 'test_qa_fixes', 'test_rig_page', 'test_vfx_variants', 'test_motion',
         'test_mobile_web', 'test_save_backup', 'test_analytics', 'test_content_schedule',
         'test_shop', 'test_pets', 'test_offline_reward', 'test_tutorial', 'test_stage_unlock', 'test_support_expansion', 'test_support_basics', 'test_support_selection', 'test_support_menu', 'test_story_intro', 'test_map_drag', 'test_app_pause', 'test_currency_bar', 'test_lives', 'test_vfx_edges', 'test_ground_fields', 'test_image_skill_fx', 'test_sprite_dispersion', 'test_icewall_buffs', 'test_skill_vfx2', 'test_skill_vfx3', 'test_skill_vfx4', 'test_skill_vfx5', 'test_skill_vfx6', 'test_skill_vfx7', 'test_skill_vfx8', 'test_spike_storm', 'test_lab_skill_preview', 'test_assist', 'test_groups', 'test_role', 'test_title', 'test_special', 'test_parts_growth', 'test_traits', 'test_tower', 'test_live_tune', 'test_skill_vfx3', 'test_skill_vfx4', 'test_qa_1108', 'test_stamina', 'test_bugs_1114']


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    mods = []
    for n in NAMES:
        if only and only not in n:
            continue
        if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), f'{n}.py')):
            continue
        mods.append(importlib.import_module(n))
    npass, nfail, lines = run_tests(mods)
    print('\n'.join(lines))
    print(f'\n== 통과 {npass} / 실패 {nfail} ==')
    sys.exit(1 if nfail else 0)


if __name__ == '__main__':
    main()
