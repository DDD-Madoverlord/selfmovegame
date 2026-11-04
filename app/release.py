"""
개발판 APK 만들기 + NAS에 올리기 / 플레이판 AAB 만들기 (D-074, NAS 업데이트 D-081)

실행: app 폴더에서
  python release.py --notes "바뀐 점" [--notes "또 하나" …] [--required]   빌드 → app/dist → NAS에 올림
  python release.py --no-upload                 빌드만 (app/dist)
  python release.py --play                      플레이판 AAB만 (app/dist, 업데이트 주소·NAS·GitHub 확인/올리기 없음)
  python release.py upload [--notes …]          이미 만든 app/dist의 지금 버전 APK를 NAS에 올림 (빌드 없이)
  python release.py list                        NAS에 올린 버전과 지금 최신
  python release.py latest 0.2.1-b3             최신을 그 버전으로 되돌림 (잘못 올린 버전 내리기 — 이미 받은 사람은 그대로)
  공통: --config <설정 파일> (기본 app/update.local.json)

설정 update.local.json (공개 저장소라 올리지 않음, 틀은 update.example.json):
  feed     앱이 읽는 주소          https://<이름>.synology.me/madoverlord/latest.json
  nas_dir  PC에서 본 같은 폴더     \\\\<NAS 이름>\\web\\madoverlord  (파일 탐색기로 열리고 쓸 수 있어야 함)
설정이 없으면 예전처럼(D-074) 빌드만 하고 GitHub 최신 릴리스보다 버전이 높은지만 본다.

NAS 폴더:
  latest.json     지금 최신 하나 — 앱이 켤 때 읽음 (맨 마지막에 바꿈 → 올리는 도중에는 예전 것을 봄)
  releases.json   올린 기록 (새것이 위)
  releases/<버전>-b<빌드>/MadOverlord-<버전>-b<빌드>.apk
  index.html      내려받기 페이지 (최신 APK 단추 · 설치 방법 · 올린 버전) — 처음 설치할 사람에게 이 폴더 주소를 알려 줌

순서: js/version_v2.js의 VERSION·BUILD 읽기 → NAS 최신보다 빌드가 높은지 확인 (같거나 낮으면 멈춤 — BUILD를 1 올릴 것)
→ build_www.py → npx cap sync android → gradlew assembleDevRelease (서명 키 <사용자 폴더>/.android/madoverlord-release.properties)
→ app/dist/MadOverlord-<VERSION>-b<BUILD>.apk → NAS에 복사 → releases.json·latest.json.
플레이판(--play): build_www.py --feed "" → 업데이트 주소 없음 확인 → npx cap sync android → bundlePlayRelease
→ app/dist/MadOverlord-<VERSION>-b<BUILD>-play.aab (구글 플레이에 제출).
"""
import datetime
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
JBR = r'C:\Program Files\Android\Android Studio\jbr'
PROPS = os.path.join(os.path.expanduser('~'), '.android', 'madoverlord-release.properties')
REPO = 'DDD-Madoverlord/selfmovegame'   # 2026-11-03 조직 저장소로 옮김
DIST = os.path.join(HERE, 'dist')


def read_version():
    src = open(os.path.join(ROOT, 'js', 'version_v2.js'), encoding='utf-8').read()
    return re.search(r"VERSION = '([^']+)'", src).group(1), int(re.search(r'BUILD = (\d+)', src).group(1))


def ver_tuple(v):
    return tuple(int(x) for x in re.findall(r'\d+', v.split('-')[0])[:3])


def tag_of(version, build):
    return f'{version}-b{build}'


def apk_name(version, build):
    return f'MadOverlord-{tag_of(version, build)}.apk'


def load_config(path):
    if not os.path.exists(path):
        return None
    cfg = json.load(open(path, encoding='utf-8'))
    if not cfg.get('nas_dir') or not cfg.get('feed'):
        sys.exit(f'{path}에 feed와 nas_dir가 모두 있어야 합니다 (틀: update.example.json)')
    return cfg


def read_json(path, default=None):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else default


def write_json(path, data):
    """다 쓴 뒤 바꿔 끼움 — 앱이 반쯤 쓴 파일을 읽지 않게"""
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def nas_check(nas_dir):
    if not os.path.isdir(nas_dir):
        sys.exit(f'NAS 폴더가 열리지 않습니다: {nas_dir}\n파일 탐색기에서 열리는지, 이 PC 계정에 쓰기 권한이 있는지 확인하세요.')


def check_newer(version, build, latest):
    """NAS 최신보다 새것이어야 함 — Android는 빌드(versionCode)가 커야 덮어 설치됨"""
    if not latest:
        return
    if build <= int(latest.get('build', 0)):
        sys.exit(f'js/version_v2.js의 BUILD({build})가 NAS 최신({tag_of(latest["version"], latest["build"])})보다 커야 합니다. BUILD를 1 올리세요.')
    if ver_tuple(version) < ver_tuple(latest['version']):
        sys.exit(f'VERSION({version})이 NAS 최신({latest["version"]})보다 낮습니다.')


def publish(apk, nas_dir, version, build, notes='', required=False, today=None):
    """APK를 NAS에 복사하고 releases.json·latest.json을 고침 → 올린 항목"""
    tag = tag_of(version, build)
    name = apk_name(version, build)
    rel = f'releases/{tag}/{name}'
    dst = os.path.join(nas_dir, 'releases', tag, name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(apk, dst + '.part')     # 다 옮긴 뒤 이름을 바꿈
    os.replace(dst + '.part', dst)
    sha = hashlib.sha256(open(dst, 'rb').read()).hexdigest()
    if sha != hashlib.sha256(open(apk, 'rb').read()).hexdigest():
        sys.exit(f'NAS에 옮긴 파일이 원본과 다릅니다: {dst}')
    entry = {'version': version, 'build': build, 'name': f'매드 오버로드 {version}', 'notes': notes, 'required': bool(required),
             'file': rel, 'size': os.path.getsize(dst), 'sha256': sha, 'date': today or datetime.date.today().isoformat()}
    hist = [e for e in read_json(os.path.join(nas_dir, 'releases.json'), []) if tag_of(e['version'], e['build']) != tag]
    write_json(os.path.join(nas_dir, 'releases.json'), [entry] + hist)
    write_index(nas_dir, entry, [entry] + hist)
    write_json(os.path.join(nas_dir, 'latest.json'), entry)
    return entry


def set_latest(nas_dir, tag):
    hist = read_json(os.path.join(nas_dir, 'releases.json'), [])
    hit = [e for e in hist if tag_of(e['version'], e['build']) == tag]
    if not hit:
        sys.exit(f'{tag}는 올린 기록에 없습니다 — python release.py list')
    write_index(nas_dir, hit[0], hist)
    write_json(os.path.join(nas_dir, 'latest.json'), hit[0])
    return hit[0]


INDEX = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>매드 오버로드 내려받기</title>
<style>
:root {{ color-scheme: dark; --bg: #0d1017; --panel: #161b25; --line: #2a3342; --fg: #e8ecf2; --muted: #95a0b2; --accent: #ffa63d; }}
body {{ margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }}
main {{ max-width: 640px; margin: 0 auto; padding: 28px max(16px, env(safe-area-inset-left)) 48px; display: grid; gap: 20px; }}
h1 {{ margin: 0; font-size: 28px; }} h1 small {{ display: block; color: var(--accent); font-size: 13px; letter-spacing: .12em; }}
.card {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; display: grid; gap: 10px; }}
.ver {{ font-size: 20px; font-weight: 700; }} .meta {{ color: var(--muted); font-size: 14px; }}
.btn {{ display: block; text-align: center; background: var(--accent); color: #1b1206; font-weight: 700; font-size: 18px;
       padding: 14px; border-radius: 8px; text-decoration: none; }}
.btn:focus-visible {{ outline: 2px solid var(--fg); outline-offset: 2px; }}
pre {{ margin: 0; white-space: pre-wrap; font: inherit; }}
ol {{ margin: 0; padding-left: 22px; }} h2 {{ margin: 0; font-size: 17px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; }} td {{ padding: 6px 4px; border-top: 1px solid var(--line); }}
a {{ color: var(--accent); }} .sha {{ color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }}
</style></head><body><main>
<h1><small>MAD OVERLORD · ANDROID</small>매드 오버로드 내려받기</h1>
<section class="card">
<div class="ver">{version} <span class="meta">(빌드 {build})</span></div>
<div class="meta">{date} · {size} MB{required}</div>
<a class="btn" href="{file}" download>APK 내려받기</a>
<pre>{notes}</pre>
<div class="sha">SHA-256 {sha}</div>
</section>
<section class="card"><h2>설치 방법</h2><ol>
<li>[APK 내려받기]를 누르고, 다 받으면 알림이나 "다운로드" 폴더에서 파일을 엽니다.</li>
<li>"출처를 알 수 없는 앱" 안내가 나오면 이 출처(브라우저·파일 앱)를 허용하고 [설치]를 누릅니다.</li>
<li>예전에 받은 시험판(디버그판)이 깔려 있으면 먼저 지운 뒤 설치합니다. 서명이 달라 덮어 설치되지 않습니다.</li>
<li>설치한 뒤에는 앱을 켤 때 새 버전이 있으면 앱이 알려 주고 앱 안에서 받습니다.</li>
</ol></section>
<section class="card"><h2>올린 버전</h2><table>{rows}</table></section>
</main></body></html>
"""


def write_index(nas_dir, latest, hist):
    """내려받기 페이지 — 최신 APK 단추, 설치 방법, 올린 버전 (release.py가 올릴 때마다 다시 씀)"""
    esc = html.escape
    rows = ''.join(f"<tr><td>{esc(e['version'])} (빌드 {e['build']})</td><td>{esc(e.get('date', ''))}</td>"
                   f"<td>{e['size'] / 1048576:.0f} MB</td><td><a href=\"{esc(e['file'])}\">받기</a></td></tr>" for e in hist)
    page = INDEX.format(version=esc(latest['version']), build=latest['build'], date=esc(latest.get('date', '')),
                        size=f"{latest['size'] / 1048576:.0f}", required=' · 필수 업데이트' if latest.get('required') else '',
                        file=esc(latest['file']), notes=esc(latest.get('notes') or latest.get('name', '')),
                        sha=esc(latest.get('sha256', '')), rows=rows)
    tmp = os.path.join(nas_dir, 'index.html.tmp')
    open(tmp, 'w', encoding='utf-8').write(page)
    os.replace(tmp, os.path.join(nas_dir, 'index.html'))


def print_list(nas_dir):
    latest = read_json(os.path.join(nas_dir, 'latest.json'))
    now = tag_of(latest['version'], latest['build']) if latest else None
    hist = read_json(os.path.join(nas_dir, 'releases.json'), [])
    if not hist:
        print('NAS에 올린 버전이 없습니다.')
    for e in hist:
        t = tag_of(e['version'], e['build'])
        mark = '← 지금 최신' if t == now else ''
        req = ' [필수]' if e.get('required') else ''
        print(f"{t:>12}  {e.get('date', ''):10}  {e['size'] / 1048576:6.1f} MB{req}  {mark}")


def latest_github():
    try:
        with urllib.request.urlopen(f'https://api.github.com/repos/{REPO}/releases/latest', timeout=10) as r:
            return json.load(r).get('tag_name', '').lstrip('v')
    except Exception:
        return None   # 릴리스가 아직 없거나 인터넷 없음


def run(cmd, **kw):
    print('>', ' '.join(cmd) if isinstance(cmd, list) else cmd, flush=True)
    subprocess.run(cmd, check=True, **kw)


def check_play_index(path):
    """플레이판에 개발판 업데이트 주소가 섞이면 동기화·빌드 전에 멈춤"""
    page = open(path, encoding='utf-8').read()
    if 'madOverlordUpdateFeed' in page:
        sys.exit('플레이판 index.html에 업데이트 주소 설정이 남아 있습니다. 빌드를 중단합니다.')


def build_apk(version, build, config_arg, play=False):
    if not os.path.exists(PROPS):
        sys.exit(f'서명 설정이 없습니다: {PROPS}')
    run([sys.executable, 'build_www.py'] + (['--feed', ''] if play else config_arg), cwd=HERE)
    if play:
        check_play_index(os.path.join(HERE, 'www', 'index.html'))
    run('npx cap sync android', cwd=HERE, shell=True)
    if play:
        check_play_index(os.path.join(HERE, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html'))
    env = dict(os.environ, JAVA_HOME=JBR)
    task = 'bundlePlayRelease' if play else 'assembleDevRelease'
    run([os.path.join(HERE, 'android', 'gradlew.bat'), task, '--console=plain'], cwd=os.path.join(HERE, 'android'), env=env)
    outputs = os.path.join(HERE, 'android', 'app', 'build', 'outputs')
    src = os.path.join(outputs, 'bundle', 'playRelease', 'app-play-release.aab') if play else os.path.join(outputs, 'apk', 'dev', 'release', 'app-dev-release.apk')
    os.makedirs(DIST, exist_ok=True)
    name = f'MadOverlord-{tag_of(version, build)}-play.aab' if play else apk_name(version, build)
    dst = os.path.join(DIST, name)
    shutil.copy2(src, dst)
    return dst


def opt_all(name):
    return [sys.argv[i + 1] for i, a in enumerate(sys.argv[:-1]) if a == name]


def main():
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in ('--notes', '--config')]
    cmd = args[0] if args else 'build'
    if '--play' in sys.argv:
        if cmd != 'build':
            sys.exit('--play는 빌드에만 사용할 수 있습니다 (NAS 명령과 함께 사용 불가).')
        version, build = read_version()
        aab = build_apk(version, build, [], play=True)
        print(f'\nAAB: {aab} ({os.path.getsize(aab) / 1048576:.1f} MB)')
        return
    config_path = opt_all('--config')[-1] if '--config' in sys.argv else os.path.join(HERE, 'update.local.json')
    config_arg = ['--config', os.path.abspath(config_path)] if '--config' in sys.argv else []
    cfg = load_config(config_path)
    notes = '\n'.join(f'- {n}' for n in opt_all('--notes'))
    required = '--required' in sys.argv
    version, build = read_version()

    if cmd in ('list', 'latest', 'upload') and not cfg:
        sys.exit(f'NAS 설정이 없습니다: {config_path} (틀: update.example.json)')
    if cmd == 'list':
        nas_check(cfg['nas_dir'])
        return print_list(cfg['nas_dir'])
    if cmd == 'latest':
        nas_check(cfg['nas_dir'])
        e = set_latest(cfg['nas_dir'], args[1])
        print(f"지금 최신: {tag_of(e['version'], e['build'])} — 이보다 새 버전을 받은 사람은 그대로 둠 (Android는 낮은 버전으로 되돌릴 수 없음)")
        return print_list(cfg['nas_dir'])

    if cfg:
        nas_check(cfg['nas_dir'])
        latest = read_json(os.path.join(cfg['nas_dir'], 'latest.json'))
        print(f'버전 {version} (빌드 {build}) · NAS 최신: {tag_of(latest["version"], latest["build"]) if latest else "없음"}')
        check_newer(version, build, latest)
    else:
        latest = latest_github()
        print(f'버전 {version} (빌드 {build}) · NAS 설정 없음 → GitHub 최신 릴리스: {latest or "없음"}')
        if latest and ver_tuple(version) <= ver_tuple(latest):
            sys.exit(f'js/version_v2.js의 VERSION({version})이 최신 릴리스({latest})보다 높아야 합니다. BUILD도 1 올리세요.')

    if cmd == 'upload':
        apk = os.path.join(DIST, apk_name(version, build))
        if not os.path.exists(apk):
            sys.exit(f'먼저 빌드하세요: {apk}이 없음')
    else:
        apk = build_apk(version, build, config_arg)
        print(f'\nAPK: {apk} ({os.path.getsize(apk) / 1048576:.1f} MB)')

    if cfg and '--no-upload' not in sys.argv:
        e = publish(apk, cfg['nas_dir'], version, build, notes, required)
        print(f"NAS에 올림: {e['file']} · SHA-256 {e['sha256'][:16]}… · 앱을 켠 사람에게 UPDATE 창이 뜸{' (필수)' if required else ''}")
        print(f"내려받기 페이지: {cfg['feed'].rsplit('/', 1)[0]}/")
        print_list(cfg['nas_dir'])
    elif not cfg:
        sha = hashlib.sha256(open(apk, 'rb').read()).hexdigest()
        notes_md = os.path.join(DIST, 'release_notes.md')
        open(notes_md, 'w', encoding='utf-8').write(
            f'## 매드 오버로드 {version} (빌드 {build})\n\n{notes or "- (바뀐 점을 적기)"}\n\nAPK: {os.path.basename(apk)} · SHA-256 {sha}\n')
        print(f'GitHub 릴리스로 올릴 때: 태그 v{version} · 설명 틀 {notes_md}')


if __name__ == '__main__':
    main()
