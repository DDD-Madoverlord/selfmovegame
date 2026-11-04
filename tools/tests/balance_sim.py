"""
밸런스 자동 전투 (로드맵 B): 파츠 조합 × 스테이지를 자동 스킬로 끝까지 싸워 결과를 모은다.

  python tools/tests/balance_sim.py <조합이름> [레벨] [배속]     # 조합 하나 → tools/tests/_out/balance_<이름>_Lv<레벨>.json
  python tools/tests/balance_sim.py report                       # 모은 결과 → MD/밸런스_기록.md 표
  python tools/tests/balance_sim.py batch hero:1 mech_free:3 ...  # 여러 조합을 동시 2개씩(각 20분 제한) 돌리고 표까지
  --stages=1-1,4-B   스테이지만 골라서 / --diff=hard|hell|nightmare  난이도 (D-063, 결과 파일 _<난이도>, 표에는 안 넣음)
  강화 외 성장 (Q-006): --grade=rare  네 파츠 등급 / --opts=elite,siege,…  옵션(팔·머리·몸통·다리 차례로 하나씩 돌려 붙임)
                       --skill=3  스킬 레벨 / --mods=orbital,repair  전술 모듈 / --tag=geared  결과 파일 이름 끝에 붙임
                       --support=frost  보유 기본 장비 지원(주인공과 같은 강화·등급·스킬 레벨, 자동 호출) / --seed=69 고정 난수

※ 한 번에 Chrome을 많이 띄우면 느려져 시작에 실패할 수 있다 → batch는 동시 실행 수를 제한하고,
  실패·시간 초과도 결과 파일(error)로 남겨 기다림이 끝나지 않는 일이 없게 한다.

조합은 BUILDS (머리, 몸통, 팔, 다리). 레벨은 네 파츠 모두 같은 강화 레벨.
전투는 실제 게임 루프 그대로 (배속만 올림), 스킬은 자동 사용, 시간 제한 240초(게임 시간).
"""
import glob
import json
import os
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Game, start_server, OUT, ROOT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BUILDS = {
    'mech_free': ('head_red_robot', 'body_red_robot', 'arm_red_robot', 'leg_red_robot'),
    'chimera_free': ('head_chimera', 'body_chimera', 'arm_chimera', 'leg_chimera'),
    'mech_laser': ('head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel'),
    'mech_missile': ('head_mech', 'body_mech', 'arm_mech_missile', 'leg_mech_wheel'),
    'kaiju': ('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant'),
    'hero': ('head_hero', 'body_hero', 'arm_hero_wave', 'leg_hero_hover'),
    # 심연의 길잡이 (새 캐릭터, D-044): 기본 4부위 / 강화 4부위
    'diver': ('head_diver', 'body_diver', 'arm_diver', 'leg_diver'),
    'diver_up': ('head_diver_up', 'body_diver_up', 'arm_diver_up', 'leg_diver_up'),
    # 봉합 성녀 (D-046)
    'saint': ('head_saint', 'body_saint', 'arm_saint', 'leg_saint'),
    'saint_up': ('head_saint_up', 'body_saint_up', 'arm_saint_up', 'leg_saint_up'),
    # 서리의 무희 (D-046)
    'frost': ('head_frost', 'body_frost', 'arm_frost', 'leg_frost'),
    'frost_up': ('head_frost_up', 'body_frost_up', 'arm_frost_up', 'leg_frost_up'),
    # 뒤틀린 인형사 (D-049)
    'doll': ('head_doll', 'body_doll', 'arm_doll', 'leg_doll'),
    'doll_up': ('head_doll_up', 'body_doll_up', 'arm_doll_up', 'leg_doll_up'),
    # 철거의 설계자 · 침묵의 방송자 (D-079)
    'architect': ('head_architect', 'body_architect', 'arm_architect', 'leg_architect'),
    'architect_up': ('head_architect_up', 'body_architect_up', 'arm_architect_up', 'leg_architect_up'),
    'broadcaster': ('head_broadcaster', 'body_broadcaster', 'arm_broadcaster', 'leg_broadcaster'),
    'broadcaster_up': ('head_broadcaster_up', 'body_broadcaster_up', 'arm_broadcaster_up', 'leg_broadcaster_up'),
}
# 기존 4종 A·B 세트 (D-050): mech_a 포격 사령부, mech_b 돌격 강습대, kaiju_a 가시 갑각, kaiju_b 독안개,
# hero_a 타락 기사, hero_b 그림자 마도사, chimera_a 광폭 실험체, chimera_b 조직 사령관
BUILDS.update({f'{c}_{v}': tuple(f'{s}_{c}_{v}' for s in ('head', 'body', 'arm', 'leg'))
               for c in ('mech', 'kaiju', 'hero', 'chimera') for v in ('a', 'b')})
ZONES = {z: [f'{z}-{i}' for i in range(1, 11)] + [f'{z}-B'] for z in range(1, 11)}   # 새 기획 10구역 × 11판 (D-086)
STAGE_IDS = ZONES[1]   # 스테이지를 안 고르면 구역 1
# zones 명령의 구역별 측정 계획 (D-086, Q-013 임의 기준): 그 구역에 올 때쯤의 성장 단계 · 재는 조합
# 조합은 가장 센 레이저 로봇 + 그 구역 주인공(새 기획 스테이지 N = 캐릭터 N) 세트. 노말 강화 한도는 Lv5.
PLAN = {
    1: (1, [], ['mech_laser', 'mech_free', 'mech_a']),
    2: (3, [], ['mech_laser', 'kaiju', 'kaiju_a']),
    3: (5, [], ['mech_laser', 'hero', 'hero_a']),
    4: (5, [], ['mech_laser', 'chimera_free', 'chimera_a']),
    5: (5, ['--grade=rare', '--skill=2'], ['mech_laser', 'diver_up']),
    6: (5, ['--grade=rare', '--skill=3'], ['mech_laser', 'saint_up']),
    7: (5, ['--grade=unique', '--skill=3', '--opts=siege,swift,siege,swift'], ['mech_laser', 'doll_up']),
    8: (5, ['--grade=unique', '--skill=4', '--opts=siege,swift,siege,swift,siege,swift,siege,swift'], ['mech_laser', 'frost_up']),
    9: (5, ['--grade=legendary', '--skill=4', '--opts=siege,swift,siege,swift,siege,swift,siege,swift'], ['mech_laser', 'architect_up']),
    10: (5, ['--grade=legendary', '--skill=5', '--opts=siege,swift,siege,swift,siege,swift,siege,swift', '--mods=orbital'],
         ['mech_laser', 'broadcaster_up']),
}
# 같은 구역을 다른 레벨로도 (구역 2는 Lv3 → Lv5로 크는 구역)
PLAN_EXTRA = {2: (5, [], ['mech_laser', 'kaiju_a'])}
MARK = '<!-- 아래는 손으로 쓰는 부분: report가 지우지 않음 -->'
LIMIT = 400   # 안전장치(게임 시간, 초). 실제 패배는 스테이지 제한 시간(TIME OVER) — 나이트메어 제한 시간이 300초를 넘어 400으로


DIFFS = ['normal', 'hard', 'hell', 'nightmare']   # js/engine_v2/difficulty_v2.js 순서


TRACE = '--trace' in sys.argv   # 받은 피해 출처 기록 (player.js dmgTrace)
GEAR = {}   # --grade·--opts·--skill·--mods·--tag (명령줄에서 채움)


def result_path(build, level, diff='normal'):
    tag = f"_{GEAR['tag']}" if GEAR.get('tag') else ''
    return os.path.join(OUT, f'balance_{build}_Lv{level}' + ('' if diff == 'normal' else f'_{diff}') + tag + '.json')


def save(build, level, results, errors, diff='normal'):
    """결과 저장. 일부 스테이지만 쟀으면 기존 파일의 다른 스테이지 결과와 합침"""
    os.makedirs(OUT, exist_ok=True)
    path = result_path(build, level, diff)
    if os.path.exists(path):
        old = {r['stage']: r for r in json.load(open(path, encoding='utf-8')).get('results', [])}
        old.update({r['stage']: r for r in results})
        results = [old[sid] for ids in ZONES.values() for sid in ids if sid in old]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'build': build, 'level': level, 'difficulty': diff, 'gear': GEAR, 'results': results, 'errors': errors}, f, ensure_ascii=False, indent=1)


def sim(build, level, speed, stages=None, diff='normal'):
    results = []
    try:
        _sim(build, level, speed, results, stages or STAGE_IDS, diff)
    except Exception as e:   # 실패해도 결과 파일은 남김 (기다리는 쪽이 끝날 수 있게)
        save(build, level, results, [f'{type(e).__name__}: {str(e)[:300]}'], diff)
        raise


def _sim(build, level, speed, results, stages, diff='normal'):
    httpd, base = start_server()
    with sync_playwright() as pw:
        g = Game(pw, base, fresh=True, viewport=(1300, 740))
        try:
            g.enter_v2()
        except Exception:   # 시작이 늦으면 한 번 더
            g.reload_v2()
        head, body, arm, leg = BUILDS[build]
        for sid in stages:
            # 그 난이도까지 모든 스테이지를 깬 것으로 (난이도·스테이지 잠금 해제)
            g.js(f"""{DIFFS[:DIFFS.index(diff) + 1]}.forEach(d => {[sid for ids in ZONES.values() for sid in ids]}.forEach(id =>
                    progress.recordsOf(d)[id] = {{ stars: [true,true,true], cleared: true, bestTime: 1 }}));
                progress.selectDifficulty('{diff}');
                progress.grades = {{}}; progress.options = {{}}; progress.skillLevels = {{}};
                const parts = ['{arm}', '{head}', '{body}', '{leg}'], opts = {GEAR.get('opts', [])}, grade = '{GEAR.get('grade', '')}';
                if (grade) parts.forEach(id => {{ if (grade !== 'common') progress.grades[id] = grade; }});
                opts.forEach((o, i) => {{ const id = parts[i % 4]; (progress.options[id] ||= []).push(o); }});
                const {{ PART_SKILL }} = await import('/js/engine_v2/skills_v2.js');
                parts.forEach(id => {{ if (PART_SKILL[id]) progress.skillLevels[PART_SKILL[id]] = {GEAR.get('skill', 1)}; }});
                progress.modules.owned = {GEAR.get('mods', [])}; progress.modules.equipped = {GEAR.get('mods', [])};
                ['{head}','{body}','{arm}','{leg}'].forEach(id => {{ progress.owned.add(id); progress.levels[id] = {level}; }});
                gameState.equippedParts = {{ head: '{head}', body: '{body}', arm: '{arm}', leg: '{leg}' }};
                progress.selectStage('{sid}');""")
            support = GEAR.get('support')
            g.js('progress.supportCharacter = null; progress.supportAuto = false;')
            if support and support != 'none':
                support_build = {'mech': 'mech_missile', 'chimera': 'chimera_free'}.get(support, support)
                eq = dict(zip(('head', 'body', 'arm', 'leg'), BUILDS[support_build]))
                g.js(f"""const eq = {json.dumps(eq)};
                    progress.unlockedChars.push('{support}'); progress.dispatch = [];
                    progress.loadouts['{support}'] = eq;
                    const {{ PART_SKILL }} = await import('/js/engine_v2/skills_v2.js');
                    Object.values(eq).forEach(id => {{ progress.owned.add(id); progress.levels[id] = {level};
                        if ('{GEAR.get('grade', '')}') progress.grades[id] = '{GEAR.get('grade', '')}';
                        if (PART_SKILL[id]) progress.skillLevels[PART_SKILL[id]] = {GEAR.get('skill', 1)}; }});
                    progress.supportCharacter = '{support}'; progress.supportAuto = true;""")
            if 'seed' in GEAR:
                g.js(f"let seed = {int(GEAR['seed'])}; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);")
            g.js("window.madOverlordGameV2.switchScreen('battle');")
            g.wait(300)
            g.js(f"b.setAutoSkills(true); gameTime.speed = {speed};" + (" b.dmgTrace = {};" if TRACE else ''))
            t0 = time.time()
            res = None
            while time.time() - t0 < LIMIT / speed + 30:
                g.wait(1000)
                st = g.js("""const r = document.querySelector('.v2-result');
                    return { done: !!r, win: !!document.querySelector('.v2-result.is-win'), t: b.stats.time, active: b.isActive,
                             hp: b.playerHp / b.maxPlayerHp, flags: b.starFlags, dist: b.distanceTraveled, kills: b.stats.kills,
                             over: b.stats.overloads || 0, limit: b.stage.timeLimit,
                             supportCalls: b.stats.supportCalls || 0, supportDamage: Math.round(b.stats.supportDamage || 0) };""")
                if st['done'] or st['t'] >= LIMIT:
                    res = st
                    break
                g.js(f"gameTime.speed = {speed};")   # 연출이 1배속으로 되돌리면 다시 올림
            res = res or st
            results.append({'stage': sid, 'win': res['win'], 'time': round(res['t']), 'hp': round(max(0, res['hp']) * 100),
                            'over': res.get('over', 0), 'limit': res.get('limit'),
                            'stars': sum(bool(f) for f in res['flags']), 'dist': round(res['dist']), 'kills': res['kills'],
                            'supportCalls': res['supportCalls'], 'supportDamage': res['supportDamage'],
                            'timeout': not res['done']})
            if TRACE:   # 받은 피해 출처 (적 종류 · 코드 자리), 최대 내구도 배수로
                results[-1]['trace'] = g.js("""const mhp = b.maxPlayerHp, trAll = Object.entries(b.dmgTrace || {}).sort((a, c) => c[1] - a[1]);
                    return { total: +(trAll.reduce((s, x) => s + x[1], 0) / mhp).toFixed(2), top: trAll.slice(0, 8).map(([k, v]) => [k, +(v / mhp).toFixed(2)]) };""")
            print(build, level, diff, results[-1], flush=True)
            g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
            g.wait(300)
        errors = g.errors[:3]
        g.close()
    httpd.shutdown()
    save(build, level, results, errors, diff)


def batch(specs, parallel=2, limit_sec=1200, stages=None, diff='normal', jobs=None):
    """specs: ['hero:1', ...] — 동시 parallel개, 각 limit_sec초 제한. 끝나면 표 작성.
    jobs: [(조합, 레벨, 추가 인자, 태그)] — zones 명령이 구역마다 성장 설정·스테이지를 붙여 넘김"""
    queue = jobs or [(b, lv, [f"--stages={','.join(stages)}"] if stages else [], '') for b, lv in (s.split(':') for s in specs)]
    running = []
    here = os.path.abspath(__file__)
    while queue or running:
        while queue and len(running) < parallel:
            b, lv, extra, tag = queue.pop(0)
            log = open(os.path.join(OUT, f'sim_{b}_{lv}{"_" + tag if tag else ""}.log'), 'w', encoding='utf-8')
            cmd = [sys.executable, here, b, str(lv), '3'] + extra + [f'--diff={diff}'] + ([f'--tag={tag}'] if tag else [])
            proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT,
                                    env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
            running.append((proc, b, lv, tag, time.time(), log))
            print(f'시작 {b} Lv{lv} {tag}', flush=True)
        for item in running[:]:
            proc, b, lv, tag, t0, log = item
            if proc.poll() is not None or time.time() - t0 > limit_sec:
                if proc.poll() is None:
                    proc.kill()
                    GEAR['tag'] = tag
                    save(b, int(lv), [], [f'시간 제한 {limit_sec}초 초과로 중단'], diff)
                log.close()
                running.remove(item)
                print(f'끝 {b} Lv{lv} {tag} (코드 {proc.poll()})', flush=True)
        time.sleep(2)
    report()


def zone_jobs(zones, builds=None):
    """zones 명령: PLAN의 구역별 성장 설정으로 (조합 × 구역) 작업 목록. 결과 파일 태그 z<구역>"""
    jobs = []
    for z in zones:
        for level, extra, names in [PLAN[z]] + ([PLAN_EXTRA[z]] if z in PLAN_EXTRA else []):
            for b in ([n for n in names if n in builds] if builds else names):
                jobs.append((b, level, extra + [f"--stages={','.join(ZONES[z])}"], f'z{z}'))
    return jobs


def stage_limits():
    """스테이지별 (제한 시간, 별 목표 시간) — stages_v2.js에서 바로 읽음 (node)"""
    src = ("const m = await import(process.argv[1]);"
           "console.log(JSON.stringify(Object.fromEntries(m.CHAPTERS.flatMap(c => c.stages).map(s => [s.id, [s.timeLimit, s.starTime]]))));")
    try:
        url = pathlib.Path(ROOT, 'js', 'engine_v2', 'stages_v2.js').resolve().as_uri()
        out = subprocess.run(['node', '--input-type=module', '-e', src, url],
                             capture_output=True, text=True, timeout=30).stdout
        return json.loads(out)
    except Exception:
        return {}


def gear_label(d):
    g = d.get('gear') or {}
    bits = [g['grade']] if g.get('grade') else []
    bits += [f"스킬{g['skill']}"] if g.get('skill') else []
    bits += [f"옵션{len(g['opts'])}"] if g.get('opts') else []
    bits += g.get('mods') or []
    return f" ({' · '.join(bits)})" if bits else ''


def report():
    data = [json.load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(OUT, 'balance_*.json')))]
    data = [d for d in data if d.get('difficulty', 'normal') == 'normal']   # 자동 표는 노말만 (다른 난이도는 밸런스_기록 "난이도"에 손으로)
    limits = stage_limits()
    lines = ['# 밸런스 기록', '',
             '`python tools/tests/balance_sim.py zones 1,2,…` (구역별 성장 단계는 balance_sim.py PLAN) 또는 `<조합> <레벨>`로 자동 전투(자동 스킬, 실제 게임 루프)한 결과.',
             '✅ 승리 / ⌛ 제한 시간 초과 패배 / ⚠ 측정 중단. 칸: 걸린 시간 · 별 · 과부하(내구도 0 → 4초 정지) 횟수.', '',
             f"측정: {time.strftime('%Y-%m-%d %H:%M')}"]
    for zone, ids in ZONES.items():
        rows = []
        for d in data:
            by_stage = {r['stage']: r for r in d['results']}
            if not any(sid in by_stage for sid in ids):
                continue
            cells = []
            for sid in ids:
                r = by_stage.get(sid)
                if not r:
                    cells.append('—')
                    continue
                mark = '✅' if r['win'] else ('⚠' if r['timeout'] else '⌛')
                over = f" · 과부하{r['over']}" if r.get('over') else ''
                cells.append(f"{mark} {r['time']}s · ★{r['stars']}{over}")
            if d.get('errors') and '—' in cells:
                cells[cells.index('—')] = '⚠ ' + d['errors'][0][:40]
            rows.append((f"{d['build']} Lv{d['level']}{gear_label(d)}", cells))
        if not rows:
            continue
        lim = ', '.join(f'{sid} {limits[sid][0]}/{limits[sid][1]}' for sid in ids if sid in limits)
        lines += ['', f'## 구역 {zone}', f'제한 시간·별 목표 시간(초): {lim}', '',
                  '| 조합 | ' + ' | '.join(ids) + ' |', '|---|' + '---|' * len(ids)]
        lines += [f'| {name} | ' + ' | '.join(cells) + ' |' for name, cells in rows]
    out = os.path.join(ROOT, 'MD', '밸런스_기록.md')
    # 표 아래의 손으로 쓴 부분(목표·조정 이력·남은 문제)은 그대로 둔다
    manual = ''
    if os.path.exists(out):
        old = open(out, encoding='utf-8').read()
        if MARK in old:
            manual = old[old.index(MARK):]
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n\n' + (manual or MARK + '\n'))
    print('\n'.join(lines))


if __name__ == '__main__':
    if sys.argv[1] == 'report':
        report()
    elif sys.argv[1] == 'zones':   # zones 1,2,3 [--builds=mech_laser,…] [--parallel=3]
        zs = [int(z) for z in sys.argv[2].split(',')]
        bl = next((a.split('=')[1].split(',') for a in sys.argv[3:] if a.startswith('--builds=')), None)
        par = next((int(a.split('=')[1]) for a in sys.argv[3:] if a.startswith('--parallel=')), 2)
        batch([], parallel=par, limit_sec=2100, jobs=zone_jobs(zs, bl))
    elif sys.argv[1] == 'batch':
        args = [a for a in sys.argv[2:] if not a.startswith('--parallel=')]
        par = next((int(a.split('=')[1]) for a in sys.argv[2:] if a.startswith('--parallel=')), 2)
        stg = next((a.split('=')[1].split(',') for a in sys.argv[2:] if a.startswith('--stages=')), None)
        dif = next((a.split('=')[1] for a in sys.argv[2:] if a.startswith('--diff=')), 'normal')
        batch([a for a in args if not a.startswith('--')], parallel=par, stages=stg, diff=dif)
    else:
        for a in sys.argv[1:]:
            if a.startswith('--grade='): GEAR['grade'] = a.split('=')[1]
            if a.startswith('--opts='): GEAR['opts'] = [x for x in a.split('=')[1].split(',') if x]
            if a.startswith('--skill='): GEAR['skill'] = int(a.split('=')[1])
            if a.startswith('--mods='): GEAR['mods'] = [x for x in a.split('=')[1].split(',') if x]
            if a.startswith('--tag='): GEAR['tag'] = a.split('=')[1]
            if a.startswith('--support='): GEAR['support'] = a.split('=')[1]
            if a.startswith('--seed='): GEAR['seed'] = int(a.split('=')[1])
        stg = next((a.split('=')[1].split(',') for a in sys.argv[1:] if a.startswith('--stages=')), None)
        dif = next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--diff=')), 'normal')
        pos = [a for a in sys.argv[1:] if not a.startswith('--')]
        sim(pos[0], int(pos[1]) if len(pos) > 1 else 1, float(pos[2]) if len(pos) > 2 else 4, stg, dif)
