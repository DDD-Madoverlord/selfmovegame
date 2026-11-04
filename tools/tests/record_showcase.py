"""
소개 영상 — 꾸민 파견 화면(D-070)과 캐릭터마다 2차 세트(D-071) 전투 장면

실행: 프로젝트 루트에서
  python tools/tests/record_showcase.py                    # 전부 (파견 + 8캐릭터)
  python tools/tests/record_showcase.py dispatch           # 파견만
  python tools/tests/record_showcase.py kaiju frost        # 고른 캐릭터만
  python tools/tests/record_showcase.py --base architect   # 세트 앞에 기본·강화 파츠 장면(걷기 → 스킬)도 (D-079 새 캐릭터 소개)

출력: tools/tests/_out/showcase/dispatch.mp4      파견 화면 (진행 중 장면 → 새 파견 보내기 → 귀환 완료 → 귀환 장면)
      tools/tests/_out/showcase/sets_<캐릭터>.mp4  세트마다 4부위를 끼우고 팔 → 몸통 → 필살기 스킬 (세트 이름·스킬 이름 자막)
      tools/tests/_out/showcase/manifest.json       영상마다 캐릭터·세트·스킬 이름

방식: record_compare.py와 같음 — Playwright로 녹화(webm) → 장면 시작 시각(페이지 시계 차이)으로 잘라 ffmpeg로 mp4.
     캐릭터 하나는 한 페이지에서 세트를 차례로 찍고(전투를 다시 시작), 세트마다 잘라 자막을 넣은 뒤 이어 붙임.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import IMPORTS, start_server  # noqa: E402
from record_vfx import ffmpeg  # noqa: E402

OUT = os.path.join(HERE, '_out', 'showcase')
W, H = 1280, 720
OUT_W, OUT_H = 960, 540
SET_SEC = 7.0                                        # 세트 한 장면 길이
BASE_SEC, BASE_WALK = 10.0, 2.5                      # 기본·강화 장면 길이, 그중 적 없이 걷는 시간
SKILLS = [(0.6, 'arm'), (2.3, 'body'), (4.0, 'head')]   # 팔 → 몸통 → 필살기
FONT = "C\\:/Windows/Fonts/malgunbd.ttf"
ALL = "(await import('/js/engine_v2/stages_v2.js')).STAGES.map(s => s.id)"   # 모든 스테이지 id (구역이 늘어도 그대로)
CLEAR = "{ stars: [true,true,true], cleared: true, bestTime: 60 }"

SET_JS = """async ([parts, sec, sched, walk]) => {
    %(imports)s
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    progress.selectStage('2-2');
    gameState.equippedParts = { head: parts[0], body: parts[1], arm: parts[2], leg: parts[3] };
    window.madOverlordGameV2.switchScreen('battle');
    await sleep(3800);   // 시작 문구(SORTIE!)가 사라질 때까지
    b.spawnInterval = 999;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
    b.enemies = b.enemies.filter(e => e.isBuilding);
    window.__sceneStart = performance.now();
    if (walk) await sleep(walk * 1000);   // 적 없이 걷는 모습 먼저
    // 앞 2명은 금방 쓰러지고(처치 연출), 뒤 3명은 버팀(스킬이 끝까지 보이게)
    for (let i = 0; i < 5; i++) { const e = b.spawnMinion('guard', { x: b.frontX() + 150 + i * 50 }); e.hp = e.maxHp = i < 2 ? 300 : 6000; }
    for (const [t, slot] of sched) setTimeout(() => { b.skillCd[slot] = 0; if (slot === 'head') b.ultGauge = 1; b.useSkill(slot); }, t * 1000);
    await sleep((sec - (walk || 0)) * 1000);
    return (performance.now() - window.__sceneStart) / 1000;
}""" % {'imports': IMPORTS}

INFO_JS = """async () => {
    %(imports)s
    const { PACKS } = await import('/js/engine_v2/sets2/index.js');
    const { setOf, setLabelOf } = await import('/js/engine_v2/sets_v2.js');
    const { PART_SKILL, SKILLS, LEG_PASSIVES } = await import('/js/engine_v2/skills_v2.js');
    const { rosterOf } = await import('/js/engine_v2/roster_v2.js');
    const out = {};
    for (const p of PACKS) for (const sid of Object.keys(p.sets)) {
        const [c, l] = sid.split('_');
        const id = s => `${s}_${c}_${l}`;
        const sk = s => (SKILLS[PART_SKILL[id(s)]] || {}).name || '';
        (out[c] ||= { name: rosterOf(c).faction, sets: [] }).sets.push({ id: sid, label: setLabelOf(setOf(id('head'))),
            parts: ['head', 'body', 'arm', 'leg'].map(id), arm: sk('arm'), body: sk('body'), ult: sk('head'),
            leg: (LEG_PASSIVES[id('leg')] || {}).name || '' });
    }
    // 기본·강화 파츠 (<부위>_<캐릭터>, <부위>_<캐릭터>_up) — --base 때 세트 앞에 찍음
    for (const c of Object.keys(out)) {
        out[c].base = [['', '기본 파츠'], ['_up', '강화 파츠']].map(([suf, label]) => {
            const id = s => `${s}_${c}${suf}`;
            if (!PART_SKILL[id('head')]) return null;
            const sk = s => (SKILLS[PART_SKILL[id(s)]] || {}).name || '';
            return { id: `${c}${suf || '_base'}`, label, parts: ['head', 'body', 'arm', 'leg'].map(id),
                arm: sk('arm'), body: sk('body'), ult: sk('head'), leg: (LEG_PASSIVES[id('leg')] || {}).name || '' };
        }).filter(Boolean);
    }
    return out;
}""" % {'imports': IMPORTS}


def open_game(browser, base, tmp):
    ctx = browser.new_context(viewport={'width': W, 'height': H}, record_video_dir=tmp, record_video_size={'width': W, 'height': H})
    page = ctx.new_page()
    t0 = time.time()
    page.goto(f'{base}/index.html?t={time.time()}')
    page.evaluate('() => localStorage.clear()')
    page.evaluate("() => localStorage.setItem('mo_v2_settings', JSON.stringify({ mute: true }))")
    page.reload()
    page.click('#btn-select-v2')
    page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
    page.wait_for_selector('.v2-loading', state='detached', timeout=30000)
    page.wait_for_timeout(400)
    return ctx, page, t0


def write_text(tmp, name, text):
    path = os.path.join(tmp, name)
    open(path, 'w', encoding='utf-8').write(text)
    return path.replace('\\', '/').replace(':', '\\:')


def cut(video, start, dur, dst, captions=(), crop=None):
    """video의 start초부터 dur초 → 가로 960 mp4, captions = [(글 파일, 크기, y)], crop = (x, y, w, h) 원본 화면 기준"""
    vf = ([f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}', f'scale={OUT_W}:-2'] if crop else [f'scale={OUT_W}:{OUT_H}'])
    for path, size, y in captions:
        vf.append(f"drawtext=textfile='{path}':fontfile='{FONT}':fontsize={size}:fontcolor=white:x=(w-text_w)/2:y={y}"
                  f":box=1:boxcolor=black@0.55:boxborderw=8")
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-ss', f'{max(0.0, start):.2f}', '-i', video, '-t', f'{dur:.2f}',
                    '-vf', ','.join(vf), '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', dst], check=True)


def concat(files, dst):
    lst = dst + '.txt'
    open(lst, 'w', encoding='utf-8').write(''.join(f"file '{f.replace(os.sep, '/')}'\n" for f in files))
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', dst], check=True)
    os.remove(lst)


def record_sets(browser, base, char, info, tmp, with_base=False):
    ctx, page, t0 = open_game(browser, base, tmp)
    page.evaluate(f"async () => {{ {IMPORTS} {ALL}.forEach(id => progress.stages[id] = {CLEAR}); progress.save(); }}")
    todo = [(s, BASE_SEC, BASE_WALK) for s in (info.get('base', []) if with_base else [])] + [(s, SET_SEC, 0) for s in info['sets']]
    scenes = []
    for s, sec, walk in todo:
        rel = page.evaluate(SET_JS, [s['parts'], sec, [[t + walk, k] for t, k in SKILLS], walk])
        scenes.append((time.time() - t0) - rel)
        print(' ', s['id'], s['label'], flush=True)
    video = page.video.path()
    ctx.close()
    clips = []
    for i, ((s, sec, _), start) in enumerate(zip(todo, scenes)):
        top = write_text(tmp, f'top{i}.txt', f"{info['name']} · {s['label']}")
        sub = write_text(tmp, f'sub{i}.txt', f"팔 {s['arm']}  →  몸통 {s['body']}  →  필살기 {s['ult']}   |   다리 패시브 {s['leg']}")
        clip = os.path.join(tmp, f'clip{i}.mp4')
        cut(video, start - 0.2, sec, clip, [(top, 24, 62), (sub, 15, 100)])
        clips.append(clip)
    dst = os.path.join(OUT, f'sets_{char}.mp4')
    concat(clips, dst)
    return dst


def record_dispatch(browser, base, tmp):
    ctx, page, t0 = open_game(browser, base, tmp)
    page.evaluate(f"""async () => {{ {IMPORTS}
        {ALL}.forEach(id => progress.stages[id] = {CLEAR});
        for (const d of ['hard', 'hell']) ({ALL}).forEach(id => progress.recordsOf(d)[id] = {CLEAR});
        progress.unlockedChars = ['kaiju', 'hero', 'chimera', 'diver', 'saint', 'frost', 'doll'];
        progress.selectCharacter('mech');
        const now = Date.now();
        progress.startDispatch('frost', 2, now - 60 * 60 * 1000);
        progress.startDispatch('kaiju', 4, now - 10 * 1000);
        progress.save(); }}""")
    page.click('#btn-menu-support-v2')
    page.wait_for_timeout(300)
    page.click('.v2-growth__tabs [data-tab="dispatch"]')
    start = time.time() - t0
    page.wait_for_timeout(600)                        # 창이 열리는 움직임이 끝난 뒤 크기를 잼
    box = page.evaluate("() => { const r = document.querySelector('.v2-growth__box').getBoundingClientRect();"
                        " return [r.left, r.top, r.width, r.height].map(v => Math.round(v / 2) * 2); }")
    page.wait_for_timeout(12400)                       # 진행 중 장면 두 개 — 걷기·교전·격퇴
    # 작전 지원 창 안에서 스크롤되는 칸을 찾아 그 요소가 보이게 (top이면 맨 위로)
    scroll = """([sel, top]) => { const el = document.querySelector(sel); let p = el.parentElement;
        while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement;
        if (p) p.scrollTo({ top: top ? 0 : p.scrollTop + el.getBoundingClientRect().top - p.getBoundingClientRect().top - 40, behavior: 'smooth' }); }"""
    page.evaluate(scroll, ['.v2-dsp-go', False])      # 새 파견: 구역·캐릭터 고르기
    page.wait_for_timeout(1500)
    page.click('.v2-dsp-zone[data-zone="3"]')
    page.wait_for_timeout(900)
    page.click('.v2-dsp-char[data-char="saint"]')
    page.wait_for_timeout(900)
    page.click('.v2-dsp-go button[data-act="dispatch"]')
    page.wait_for_timeout(600)
    page.evaluate(scroll, ['.v2-dsp', True])
    page.wait_for_timeout(5000)                       # 칸 3개가 모두 진행 중
    page.evaluate(f"async () => {{ {IMPORTS} progress.dispatch[0].end = Date.now() - 1000; }}")
    page.wait_for_timeout(3500)                       # 귀환 완료 + 보상 받기 버튼
    page.click('.v2-dsp[data-char="frost"] button[data-act="collect"]')
    page.wait_for_timeout(6000)                       # 귀환 장면
    end = time.time() - t0
    video = page.video.path()
    ctx.close()
    dst = os.path.join(OUT, 'dispatch.mp4')
    cap = write_text(tmp, 'cap.txt', '작전 지원 › 파견 (D-070)')
    cut(video, start - 0.3, end - start + 0.3, dst, [(cap, 18, 8)], crop=box)
    return dst


def main():
    with_base = '--base' in sys.argv
    want = [a for a in sys.argv[1:] if a != '--base']
    os.makedirs(OUT, exist_ok=True)
    httpd, base = start_server()
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
        if not want or 'dispatch' in want:
            tmp = tempfile.mkdtemp(prefix='mo_show_')
            print('dispatch →', record_dispatch(browser, base, tmp), flush=True)
            shutil.rmtree(tmp, ignore_errors=True)
            manifest['dispatch'] = {'file': 'dispatch.mp4'}
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(f'{base}/index.html?t={time.time()}')
        page.click('#btn-select-v2')
        page.wait_for_selector('#screen-menu-v2.active', timeout=30000)
        info = page.evaluate(INFO_JS)
        ctx.close()
        for char, ci in info.items():
            if want and char not in want:
                continue
            tmp = tempfile.mkdtemp(prefix='mo_show_')
            print(char, ci['name'], len(ci['sets']), 'sets', flush=True)
            print(' →', record_sets(browser, base, char, ci, tmp, with_base), flush=True)
            shutil.rmtree(tmp, ignore_errors=True)
            manifest[char] = {'file': f'sets_{char}.mp4', **ci}
        browser.close()
    httpd.shutdown()
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('→', manifest_path)


if __name__ == '__main__':
    main()
