"""
디스코드 QA 11-14~16 판단용 영상 (D-142 · Q-050)

실행: 프로젝트 루트에서
  python tools/tests/record_qa_1116.py            # 전부
  python tools/tests/record_qa_1116.py skills     # 스킬 3개 전·후만
  python tools/tests/record_qa_1116.py speed      # 이동 속도 비교만

출력: tools/tests/_out/qa1116/
  skill_<warp|web|submerge>.mp4   위 = 고치기 전(038bd53) · 아래 = 고친 뒤(지금) — 같은 적 배치·같은 시간표
  skills_all.mp4                  셋을 이어 붙임
  speed.mp4                       같은 캐릭터(히어로)·같은 판(1-3)에서 팔만 바꿔 출격 → 전장 띠 4줄
                                  (근거리 ×2 지금 · 근거리 ×1.5 안 · 원거리 ×0.7 안 · 원거리 ×0.5 지금)

방식: record_compare.py와 같음 — 예전 커밋을 git worktree로 꺼내 따로 서버를 띄우고 Playwright로 녹화 → ffmpeg로 자르고 쌓음.
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
from common import IMPORTS  # noqa: E402
from record_vfx import ffmpeg  # noqa: E402
from bake_sprite import serve  # noqa: E402

OUT = os.path.join(HERE, '_out', 'qa1116')
W, H = 1280, 720
BEFORE = '038bd53'
FONT = "C\\:/Windows/Fonts/malgunbd.ttf"
LANE = (0, 380, 1280, 320)          # 전장 띠 (x, y, w, h)
HUD = (420, 14, 460, 66)            # 위 가운데 거리·시간 칸
SET = lambda char, letter: [f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg')]

# ---- 스킬 장면: (제목, 장착, 길이, 장면 JS — b·sleep·foe(x 거리, 체력, 속도) 사용) ----
SKILLS = {
    'warp': ('차원 도약 (성간 방랑자 몸통)', SET('mech', 'm'), 9.0, """
        for (let i = 0; i < 3; i++) foe(430 + i * 60, 60000, 45);
        await sleep(1200); b.skillCd.body = 0; b.useSkill('body');
        await sleep(1500); for (let i = 0; i < 3; i++) foe(520 + i * 70, 60000, 60);"""),
    'web': ('실 그물 걸음 (붉은 실 재봉사 다리 패시브)', SET('saint', 'b'), 10.0, """
        await sleep(2500);
        for (let i = 0; i < 4; i++) foe(560 + i * 80, 60000, 70);"""),
    'submerge': ('잠항 (심해 상어 괴인 몸통)', SET('chimera', 'w'), 8.0, """
        for (let i = 0; i < 3; i++) foe(120 + i * 55, 60000, 30, 40);
        await sleep(1500); b.skillCd.body = 0; b.useSkill('body');"""),
}
SKILL_NOTE = {
    'warp': ('전: 시간 균열이 떠난 자리(뒤)에 남음', '후: 도착한 자리 앞쪽 — 안의 적 감속 + 받는 피해 +15%'),
    'web': ('전: 실 그물이 걸은 자리(뒤 60px · 2초)', '후: 앞쪽 바닥 60~300px · 4초 — 다가오는 적 감속(보라빛)'),
    'submerge': ('전: 3초 숨기(피해 무시) → 솟구쳐 기절', '후: 1.2초 숨기 → 솟구쳐 큰 피해 + 기절'),
}

SCENE_JS = """async ([parts, stage, sec]) => {
    %(imports)s
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.madOverlordNoIntro = true; window.madOverlordNoStamina = true;
    progress.selectStage(stage);
    gameState.equippedParts = { head: parts[0], body: parts[1], arm: parts[2], leg: parts[3] };
    window.madOverlordGameV2.switchScreen('battle');
    // 스킬만 보이게: 거점이 서지 않게(근거리 ×2면 2초 만에 요새가 서서 적 자리가 달라짐) · 처음 안내 말풍선 숨김
    b.stage.midAt = b.stage.finalAt = 1e9;
    document.head.insertAdjacentHTML('beforeend', '<style>[class*="v2-coach"] { display: none !important; }</style>');
    await sleep(3800);
    b.autoSkills = false; b.spawnInterval = 999; gameTime.speed = 1;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
    b.enemies = b.enemies.filter(e => e.isBuilding);
    const foe = (dx, hp, speed, dps = 0) => { const e = b.spawnMinion('guard', { x: b.frontX() + dx, elite: false });
        e.hp = e.maxHp = hp; e.speed = speed; e.dps = dps; return e; };
    window.__sceneStart = performance.now();
    const end = sleep(sec * 1000);
    %(body)s
    await end;
    return (performance.now() - window.__sceneStart) / 1000;
}"""

# ---- 이동 속도 장면: 히어로, 팔만 바꿈 (대검 = 근거리 · 세뇌 파동 = 원거리) ----
SPEED_SEC = 40.0
HERO = lambda arm: ['head_hero', 'body_hero', arm, 'leg_hero_hover']
SPEED = [
    ('melee2', '근거리 팔(대검) · 이동 ×2 — 지금', HERO('arm_hero_a'), 'melee', 2),
    ('melee15', '근거리 팔(대검) · 이동 ×1.5 — 줄이는 안', HERO('arm_hero_a'), 'melee', 1.5),
    ('ranged07', '원거리 팔(파동) · 이동 ×0.7 — 줄이는 안', HERO('arm_hero_wave'), 'ranged', 0.7),
    ('ranged05', '원거리 팔(파동) · 이동 ×0.5 — 지금', HERO('arm_hero_wave'), 'ranged', 0.5),
]
SPEED_JS = """async ([parts, role, move, sec]) => {
    %(imports)s
    const { ROLE } = await import('/js/engine_v2/battle/tuning.js');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.madOverlordNoIntro = true; window.madOverlordNoStamina = true;
    ROLE[role].move = move;   // 이 줄만 다름 (받는 피해·공격력 배율은 그대로)
    parts.forEach(id => { progress.owned.add(id); progress.levels[id] = 5; });
    progress.selectStage('1-3');
    gameState.equippedParts = { head: parts[0], body: parts[1], arm: parts[2], leg: parts[3] };
    window.madOverlordGameV2.switchScreen('battle');
    document.head.insertAdjacentHTML('beforeend', '<style>[class*="v2-coach"] { display: none !important; }</style>');   // 처음 안내 말풍선 숨김
    await sleep(600);
    window.__sceneStart = performance.now();
    b.setAutoSkills?.(true); gameTime.speed = 1;
    await sleep(sec * 1000);
    return { t: (performance.now() - window.__sceneStart) / 1000, dist: Math.round(b.distanceTraveled), speed: b.playerSpeed,
        mid: b.stats?.marks?.midSeen ?? null, fin: b.stats?.marks?.finalSeen ?? null, won: !!b.finalBaseDestroyed };
}""" % {'imports': IMPORTS}


def open_game(browser, base, tmp):
    ctx = browser.new_context(viewport={'width': W, 'height': H}, record_video_dir=tmp, record_video_size={'width': W, 'height': H})
    page = ctx.new_page()
    t0 = time.time()
    page.goto(f'{base}/index.html?openGroups=1&skipTitle=1&t={time.time()}')
    page.evaluate('() => localStorage.clear()')
    page.evaluate("() => localStorage.setItem('mo_v2_settings', JSON.stringify({ mute: true }))")
    page.reload()
    page.click('#btn-select-v2')
    page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
    page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    page.wait_for_timeout(400)
    return ctx, page, t0


def text_file(tmp, name, text):
    path = os.path.join(tmp, name)
    open(path, 'w', encoding='utf-8').write(text)
    return path.replace('\\', '/').replace(':', '\\:')


def label(tmp, name, text, size=24, x='14', y='12', color='white'):
    return (f"drawtext=textfile='{text_file(tmp, name, text)}':fontfile='{FONT}':fontsize={size}:fontcolor={color}:"
            f"x={x}:y={y}:box=1:boxcolor=black@0.6:boxborderw=8:expansion=none")


def run(cmd):
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', *cmd], check=True, timeout=300)


def record_scene(browser, base, js, args, tmp):
    """장면 하나 녹화 → (webm 경로, 장면 시작 초, 페이지가 돌려준 값)"""
    rec = tempfile.mkdtemp(prefix='rec_', dir=tmp)
    ctx, page, t0 = open_game(browser, base, rec)
    ret = page.evaluate(js, args)
    rel = page.evaluate('() => (performance.now() - window.__sceneStart) / 1000')
    start = (time.time() - t0) - rel
    video = page.video.path()
    ctx.close()
    return video, start, ret


def skills(browser, bases, tmp):
    outs = []
    for key, (title, parts, sec, body) in SKILLS.items():
        js = SCENE_JS % {'imports': IMPORTS, 'body': body}
        clips = {}
        for which, base in bases.items():
            video, start, _ = record_scene(browser, base, js, [parts, '2-2', sec], tmp)
            clips[which] = (video, start)
            print(key, which, 'recorded', flush=True)
        note = SKILL_NOTE[key]
        x, y, w, h = LANE
        dst = os.path.join(OUT, f'skill_{key}.mp4')
        fc = (f"[0:v]crop={w}:{h}:{x}:{y},{label(tmp, f'{key}_a.txt', note[0], 26)}[a];"
              f"[1:v]crop={w}:{h}:{x}:{y},{label(tmp, f'{key}_b.txt', note[1], 26)}[b];"
              f"[a][b]vstack=inputs=2,pad=iw:ih+56:0:56:black,{label(tmp, f'{key}_t.txt', title, 30, '(w-text_w)/2', '10', '0xffd27a')}[v]")
        run(['-ss', f'{max(0, clips["before"][1]):.2f}', '-t', f'{sec:.2f}', '-i', clips['before'][0],
             '-ss', f'{max(0, clips["after"][1]):.2f}', '-t', f'{sec:.2f}', '-i', clips['after'][0],
             '-filter_complex', fc, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', '-an', dst])
        outs.append(dst)
        print('→', dst, flush=True)
    lst = os.path.join(tmp, 'skills.txt')
    open(lst, 'w', encoding='utf-8').write(''.join(f"file '{s.replace(os.sep, '/')}'\n" for s in outs))
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', os.path.join(OUT, 'skills_all.mp4')])
    print('→', os.path.join(OUT, 'skills_all.mp4'), flush=True)


def speed(browser, base, tmp):
    clips, info = [], {}
    for key, text, parts, role, move in SPEED:
        video, start, ret = record_scene(browser, base, SPEED_JS, [parts, role, move, SPEED_SEC], tmp)
        clips.append((video, start, key, text))
        info[key] = ret
        print(key, ret, flush=True)
    x, y, w, h = LANE
    hx, hy, hw, hh = HUD
    ins, fc = [], []
    for i, (video, start, key, text) in enumerate(clips):
        ins += ['-ss', f'{max(0, start):.2f}', '-t', f'{SPEED_SEC:.2f}', '-i', video]
        fc.append(f"[{i}:v]split[l{i}][h{i}];[l{i}]crop={w}:{h}:{x}:{y}[lane{i}];[h{i}]crop={hw}:{hh}:{hx}:{hy}[hud{i}];"
                  f"[lane{i}][hud{i}]overlay=W-w-10:8,{label(tmp, f'{key}.txt', text, 26)},scale=960:-2[s{i}]")
    fc.append(''.join(f'[s{i}]' for i in range(len(clips))) + f'vstack=inputs={len(clips)}[v]')
    dst = os.path.join(OUT, 'speed.mp4')
    run([*ins, '-filter_complex', ';'.join(fc), '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22',
         '-movflags', '+faststart', '-an', dst])
    print('→', dst, flush=True)
    return info


def main():
    what = [a for a in sys.argv[1:] if a in ('skills', 'speed')] or ['skills', 'speed']
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='mo_qa1116_')
    wt = tempfile.mkdtemp(prefix='mo_before_')
    shutil.rmtree(wt)
    if 'skills' in what:
        subprocess.run(['git', 'worktree', 'add', '--detach', wt, BEFORE], cwd=ROOT, check=True, capture_output=True)
    try:
        srv_after = serve(ROOT)
        after = f'http://127.0.0.1:{srv_after.server_address[1]}'
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
            if 'skills' in what:
                srv_before = serve(wt)
                skills(browser, {'before': f'http://127.0.0.1:{srv_before.server_address[1]}', 'after': after}, tmp)
                srv_before.shutdown()
            if 'speed' in what:
                speed(browser, after, tmp)
            browser.close()
        srv_after.shutdown()
    finally:
        if 'skills' in what:
            subprocess.run(['git', 'worktree', 'remove', '--force', wt], cwd=ROOT, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
