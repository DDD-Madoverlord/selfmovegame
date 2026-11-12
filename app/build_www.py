"""
Android 앱(Capacitor WebView)에 넣을 게임 파일 모으기 → app/www/ (D-073)

실행: app 폴더에서  python build_www.py      (npm run sync / npm run apk 가 이것부터 부름)
웹판: app 폴더에서  python build_www.py --web → app/web/ (Cloudflare Pages 정적 호스팅용)
  같은 복사 규칙·WebP 캐시를 쓰고 v2로 바로 들어가지만 앱 표시·업데이트 주소는 넣지 않는다.
  SNS meta·_headers를 넣고 무료 파일 한도를 검사한다. Gradle 동기화·배포는 하지 않는다.

- 저장소 맨 위의 index.html · index.css · ui_v2.css · ui_v2_mobile.css · js/ · assets/ 를 복사한다.
- 게임이 읽지 않는 원본 그림은 뺀다: 폴더 이름이 src · png · _sets_tmp 인 곳, *_raw.png · *_gemini.png (Gemini 원본, 약 450MB).
- index.html 에는 앱용 두 줄을 넣는다: 모드 고르는 첫 화면을 숨기고 v2(디커플드 엔진)로 바로 들어감.
- 게임 코드는 상대 경로만 쓰므로(fetch·import) 고칠 것이 없다.
- 리그 조각 PNG는 .png 이름을 쓰는 코드 때문에 이름은 유지하고 내용만 손실 WebP로 넣는다(WebView는 내용으로 읽음).
- 변환 캐시는 app/_webp_cache/에 보관하며, --no-webp로 원본 복사를 비교할 수 있다.
- 버전: js/version_v2.js의 VERSION·BUILD로 android/app/build.gradle의 versionName·versionCode를 맞춘다 (D-074).
- 업데이트 정보 주소 (D-081): app/update.local.json(저장소에 올리지 않음)의 "feed"(NAS의 latest.json)를 앱에 넣는다.
  없으면 넣지 않음 → 앱은 GitHub 최신 릴리스를 읽음. --feed <주소> 또는 --config <설정 파일>로 바꿀 수 있음(시험용).
"""
from concurrent.futures import ProcessPoolExecutor
from html import escape
from io import BytesIO
from itertools import repeat
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'www')
WEB_OUT = os.path.join(HERE, 'web')
WEBP_CACHE = os.path.join(HERE, '_webp_cache')
WEBP_SETTINGS = {'quality': 90, 'alpha_quality': 100, 'method': 6}
WEBP_WORKERS = min(8, os.cpu_count() or 1)

FILES = ['index.html', 'index.css', 'ui_v2.css', 'ui_v2_mobile.css',
         'rig_test.html']   # 연구소 스킬 미리보기가 iframe으로 씀 (11-05 피드백 11번, lab_v2.js previewSkill)
DIRS = ['js', 'assets']
SKIP_DIRS = {'src', 'png', '_sets_tmp', '__pycache__'}
SKIP_SUFFIX = ('_raw.png', '_gemini.png', '.psd', '.md')
# 게임이 읽지 않는 폴더 (앱 묶음에서 뺌) — 배경음 후보 곡(11-06 추가, 약 97MB): 게임은 bgm/menu·battle·boss.ogg만 씀 (sound_v2.js BGM, 2026-11-10 빌드 24)
SKIP_PATHS = {'assets/audio/bgm/main', 'assets/audio/bgm/stage'}

MODE_STYLE = '<style>#screen-mode-selector{display:none!important}</style>'
APP_HEAD = MODE_STYLE + '<script>window.madOverlordApp = true;</script>'
# 기존 모드 선택 스크립트(모듈) 뒤에 실행 → v2 버튼을 눌러 main_v2.js를 불러옴
APP_BOOT = '<script type="module">document.getElementById("btn-select-v2").click();</script>'
WEB_DESCRIPTION = '로봇·괴수·이형의 군단을 조립해 싸우는 자동 전투 게임'
WEB_IMAGE = ''   # 미리보기 그림이 정해지면 전체 주소를 넣음
WEB_HEADERS = '''/assets/*
  Cache-Control: public, max-age=86400
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/js/*
  Cache-Control: no-cache
/*.css
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
'''


def web_head():
    head = MODE_STYLE + '\n<meta property="og:title" content="매드 오버로드">'
    head += f'\n<meta property="og:description" content="{escape(WEB_DESCRIPTION, quote=True)}">'
    head += '\n<meta property="og:type" content="website">'
    head += '\n<meta name="twitter:card" content="summary">'
    if WEB_IMAGE:
        head += f'\n<meta property="og:image" content="{escape(WEB_IMAGE, quote=True)}">'
    return head


def check_web_limits(out):
    files = []
    errors = []
    for dirpath, dirnames, filenames in os.walk(out):
        dirnames.sort()
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            size = os.path.getsize(path)
            rel = os.path.relpath(path, out)
            files.append((rel, size))
            if size > 25 * 1048576:
                errors.append(f'파일 크기 초과: {rel} ({size / 1048576:.2f} MiB > 25 MiB)')
    if len(files) > 20000:
        errors.append(f'파일 수 초과: {len(files)}개 > 20000개 · 한도를 넘긴 파일:')
        errors.extend(rel for rel, size in files[20000:])
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    return len(files), sum(size for rel, size in files)


def read_version():
    src = open(os.path.join(ROOT, 'js', 'version_v2.js'), encoding='utf-8').read()
    version = re.search(r"VERSION = '([^']+)'", src).group(1)
    build = int(re.search(r'BUILD = (\d+)', src).group(1))
    return version, build


def sync_gradle(version, build):
    path = os.path.join(HERE, 'android', 'app', 'build.gradle')
    if not os.path.exists(path):
        return
    g = open(path, encoding='utf-8').read()
    g2 = re.sub(r'versionCode \d+', f'versionCode {build}', g, count=1)
    g2 = re.sub(r'versionName "[^"]*"', f'versionName "{version}"', g2, count=1)
    if g2 != g:
        open(path, 'w', encoding='utf-8').write(g2)


def update_feed():
    """앱에 넣을 업데이트 정보 주소 — --feed > 설정 파일(--config, 기본 update.local.json)의 feed > 없음"""
    if '--feed' in sys.argv:
        return sys.argv[sys.argv.index('--feed') + 1]
    cfg = sys.argv[sys.argv.index('--config') + 1] if '--config' in sys.argv else os.path.join(HERE, 'update.local.json')
    if os.path.exists(cfg):
        return json.load(open(cfg, encoding='utf-8')).get('feed') or None
    return None


def keep(name):
    return not name.endswith(SKIP_SUFFIX)


def copy_rig_png(rel, out=OUT):
    from PIL import Image, __version__

    src = os.path.join(ROOT, rel)
    dst = os.path.join(out, rel)
    cached = os.path.join(WEBP_CACHE, rel)
    key_path = cached + '.json'
    stat = os.stat(src)
    key = {'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns,
           'settings': WEBP_SETTINGS, 'mode': 'RGBA', 'format': 'WEBP', 'pillow': __version__}
    hit = False
    try:
        with open(key_path, encoding='utf-8') as f:
            hit = json.load(f) == key and os.path.isfile(cached)
    except (OSError, ValueError):
        pass
    if not hit:
        with Image.open(src) as image:
            with image.convert('RGBA') as rgba:
                buffer = BytesIO()
                rgba.save(buffer, 'WEBP', **WEBP_SETTINGS)
        os.makedirs(os.path.dirname(cached), exist_ok=True)
        if buffer.tell() < stat.st_size:
            with open(cached + '.tmp', 'wb') as f:
                f.write(buffer.getvalue())
        else:
            shutil.copy2(src, cached + '.tmp')
        os.replace(cached + '.tmp', cached)
        with open(key_path + '.tmp', 'w', encoding='utf-8') as f:
            json.dump(key, f, sort_keys=True)
        os.replace(key_path + '.tmp', key_path)
    shutil.copy2(cached, dst)
    size = os.path.getsize(dst)
    return stat.st_size, size, size < stat.st_size, hit


def copy_files(out, webp):
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    total = count = 0
    rig_before = rig_after = converted = cache_hits = 0
    rig_files = []
    for f in FILES:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(out, f))
    for d in DIRS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, d)):
            rel = os.path.relpath(dirpath, ROOT)
            dirnames[:] = [x for x in dirnames if x not in SKIP_DIRS and os.path.join(rel, x).replace(os.sep, '/') not in SKIP_PATHS]
            is_rig = (rel.replace(os.sep, '/') + '/').startswith('assets/sprites/rig/')
            for name in filenames:
                if not keep(name):
                    continue
                if name.endswith('.png') and name[:-4] + '.webp' in filenames and rel.replace(os.sep, '/').startswith('assets/sprites/stage'):
                    continue   # 거점·배경은 게임이 .webp를 읽음 — 무손실 원본 PNG는 앱에 넣지 않음 (2026-10-24)
                dst = os.path.join(out, rel, name)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if is_rig and name.endswith('.png'):
                    if webp:
                        rig_files.append(os.path.join(rel, name))
                        continue
                    rig_before += os.path.getsize(os.path.join(dirpath, name))
                    rig_after = rig_before
                shutil.copy2(os.path.join(dirpath, name), dst)
                total += os.path.getsize(dst)
                count += 1
    if rig_files:
        with ProcessPoolExecutor(max_workers=WEBP_WORKERS) as pool:
            for before, after, changed, hit in pool.map(copy_rig_png, sorted(rig_files), repeat(out)):
                rig_before += before
                rig_after += after
                converted += changed
                cache_hits += hit
                total += after
                count += 1
    return total, count, rig_before, rig_after, converted, cache_hits


def main():
    web = '--web' in sys.argv
    out = WEB_OUT if web else OUT
    webp = '--no-webp' not in sys.argv
    total, count, rig_before, rig_after, converted, cache_hits = copy_files(out, webp)
    index = os.path.join(out, 'index.html')
    html = open(index, encoding='utf-8').read()
    if '</head>' not in html or '</body>' not in html:
        sys.exit('index.html에 </head> 또는 </body>가 없음')
    head = web_head() if web else APP_HEAD
    feed = None if web else update_feed()
    if feed:   # 업데이트 정보 주소 (appUpdate_v2.js가 GitHub 대신 읽음)
        head += f'<script>window.madOverlordUpdateFeed = {json.dumps(feed)};</script>'
    html = html.replace('</head>', head + '\n</head>', 1)
    i = html.rindex('</body>')
    html = html[:i] + APP_BOOT + '\n' + html[i:]
    open(index, 'w', encoding='utf-8').write(html)
    version, build = read_version()
    if web:
        with open(os.path.join(out, '_headers'), 'w', encoding='utf-8') as f:
            f.write(WEB_HEADERS)
        count, total = check_web_limits(out)
        print(f'web: 파일 {count}개, {total / 1048576:.1f} MB → {out} · 버전 {version} (빌드 {build})')
    else:
        sync_gradle(version, build)
        print(f'www: 파일 {count}개, {total / 1048576:.1f} MB → {OUT} · 버전 {version} (빌드 {build})'
              f' · 업데이트 정보: {"설정한 주소" if feed else "GitHub 릴리스"}')
    print(f'리그 PNG: 변환 {converted}개, {rig_before / 1048576:.1f} → {rig_after / 1048576:.1f} MB'
          f' · 캐시 적중 {cache_hits}개' + (' · --no-webp' if not webp else ''))
    if web:
        print('배포 명령(저장소 루트에서): npx wrangler pages deploy app/web --project-name <이름>')


if __name__ == '__main__':
    main()
