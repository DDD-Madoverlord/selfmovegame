"""
전·후 비교 영상 — 같은 전투 장면을 예전 커밋과 지금 작업 폴더에서 찍어 좌우로 붙임 (Q-008 퀄리티업 확인)

실행: 프로젝트 루트에서
  python tools/tests/record_compare.py                 # 예전 = 0795dd0 (퀄리티업 전, D-063)
  python tools/tests/record_compare.py --before <커밋>

출력: tools/tests/_out/compare/<장면>_before.mp4 · <장면>_after.mp4 · <장면>_side.mp4(좌 전 · 우 후) · compare_all.mp4(전부 이어 붙임)

방식: 예전 커밋을 임시 작업 폴더(git worktree)로 꺼내 따로 서버를 띄우고, 두 쪽에서 같은 스크립트(적 배치·스킬·기절·밀림)를
     같은 시간표로 돌리며 Playwright로 녹화 → 장면 시작부터 잘라 mp4 → ffmpeg hstack으로 좌우 붙이기.
     스크립트는 두 버전에 다 있는 함수만 씀 (spawnMinion · useSkill · knockPlayerBack · pStunT/updatePlayerStatus).
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools', 'rig'))
from record_vfx import ffmpeg  # noqa: E402
from bake_sprite import serve  # noqa: E402

OUT = os.path.join(HERE, '_out', 'compare')
W, H = 1280, 720
SCENE_SEC = 9.0

SCENES = {
    # 장면 이름: (장착, 스테이지, 스킬 시간표 [(초, 칸)])
    'frost': (('head_frost', 'body_frost', 'arm_frost', 'leg_frost'), '1-3', [(0.8, 'arm'), (2.6, 'body'), (5.6, 'arm')]),
    'kaiju': (('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant'), '1-3', [(0.8, 'arm'), (2.6, 'head'), (5.6, 'body')]),
    'hero': (('head_hero_b', 'body_hero_b', 'arm_hero_b', 'leg_hero_b'), '1-3', [(3.4, 'arm'), (6.0, 'body')]),
}

SCRIPT = """async () => {
    const { gameState } = await import('/js/engine/state.js');
    const { battleEngineV2: b } = await import('/js/engine_v2/battle_v2.js');
    const { progress } = await import('/js/engine_v2/progress_v2.js');
    const { STAGES } = await import('/js/engine_v2/stages_v2.js');
    progress.stages = {}; for (const s of STAGES) progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 };
    progress.selectStage('%(stage)s');
    gameState.equippedParts = { head: '%(h)s', body: '%(b)s', arm: '%(a)s', leg: '%(l)s' };
    window.madOverlordGameV2.switchScreen('battle');
    await new Promise(r => setTimeout(r, 3300));
    b.spawnInterval = 999;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
    b.enemies = b.enemies.filter(e => e.isBuilding);
    window.__sceneStart = performance.now();
    const hero = '%(scene)s' === 'hero';
    // 히어로 장면은 처음 3초 동안 적 없이 걷기 (빠른 걸음·망토), 나머지는 바로 적
    const spawn = () => { for (let i = 0; i < 4; i++) { const e = b.spawnMinion('guard', { x: b.frontX() + 170 + i * 55 }); e.hp = e.maxHp = i < 2 ? 260 : 2400; } };
    if (hero) setTimeout(spawn, 3000); else spawn();
    for (const [t, slot] of %(skills)s) setTimeout(() => { b.skillCd[slot] = 0; if (slot === 'head') b.ultGauge = 1; b.useSkill(slot); }, t * 1000);
    if (!hero) {
        setTimeout(() => { b.pStunT = 1.2; b.updatePlayerStatus(); }, 4000);
        setTimeout(() => { b.knockPlayerBack(70); }, 7200);
    }
    await new Promise(r => setTimeout(r, %(sec)d));
    return true;
}"""


def record(browser, base, scene, dst, tmp):
    build, stage, skills = SCENES[scene]
    ctx = browser.new_context(viewport={'width': W, 'height': H}, record_video_dir=tmp, record_video_size={'width': W, 'height': H})
    page = ctx.new_page()
    t0 = time.time()
    page.goto(f'{base}/index.html?skipTitle=1&t={time.time()}')
    page.evaluate('() => localStorage.clear()')
    page.reload()
    page.click('#btn-select-v2')
    page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
    page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    page.evaluate("() => { const s = JSON.parse(localStorage.getItem('mo_v2_settings') || '{}'); s.mute = true; localStorage.setItem('mo_v2_settings', JSON.stringify(s)); }")
    js = SCRIPT % {'stage': stage, 'h': build[0], 'b': build[1], 'a': build[2], 'l': build[3], 'scene': scene,
                   'skills': [[t, s] for t, s in skills], 'sec': int(SCENE_SEC * 1000)}
    t_start = None
    page.evaluate("() => { window.__sceneStart = null; }")
    page.evaluate(js)
    # 장면 시작 시각 (영상 기준 초) = 페이지 시계 차이로 계산
    rel = page.evaluate('() => (performance.now() - window.__sceneStart) / 1000')
    t_start = (time.time() - t0) - rel
    video = page.video.path()
    ctx.close()
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-ss', f'{max(0, t_start - 0.2):.2f}', '-i', video, '-t', f'{SCENE_SEC:.2f}',
                    '-vf', f'scale={W // 2}:{H // 2}', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', dst], check=True)


def main():
    before = sys.argv[sys.argv.index('--before') + 1] if '--before' in sys.argv else '0795dd0'
    os.makedirs(OUT, exist_ok=True)
    wt = tempfile.mkdtemp(prefix='mo_before_')
    shutil.rmtree(wt)
    subprocess.run(['git', 'worktree', 'add', '--detach', wt, before], cwd=ROOT, check=True, capture_output=True)
    try:
        srv_before, srv_after = serve(wt), serve(ROOT)
        bases = {'before': f'http://127.0.0.1:{srv_before.server_address[1]}', 'after': f'http://127.0.0.1:{srv_after.server_address[1]}'}
        sides = []
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
            for scene in SCENES:
                files = {}
                for which, base in bases.items():
                    tmp = tempfile.mkdtemp(prefix='mo_rec_')
                    files[which] = os.path.join(OUT, f'{scene}_{which}.mp4')
                    record(browser, base, scene, files[which], tmp)
                    shutil.rmtree(tmp, ignore_errors=True)
                    print(scene, which, '→', files[which], flush=True)
                side = os.path.join(OUT, f'{scene}_side.mp4')
                label = "drawtext=text='%s':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5:fontfile='C\\:/Windows/Fonts/malgun.ttf'"
                subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', files['before'], '-i', files['after'], '-filter_complex',
                                f"[0:v]{label % '전 (퀄리티업 전)'}[a];[1:v]{label % '후 (지금)'}[b];[a][b]hstack=inputs=2",
                                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', side], check=True)
                sides.append(side)
            browser.close()
        lst = os.path.join(OUT, 'list.txt')
        open(lst, 'w', encoding='utf-8').write(''.join(f"file '{s.replace(os.sep, '/')}'\n" for s in sides))
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', os.path.join(OUT, 'compare_all.mp4')], check=True)
        print('→', os.path.join(OUT, 'compare_all.mp4'))
        srv_before.shutdown()
        srv_after.shutdown()
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', wt], cwd=ROOT, capture_output=True)


if __name__ == '__main__':
    main()
