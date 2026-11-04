"""
리그 동작을 CSS용 스프라이트 시트로 굽는 도구 (rig_test.html을 헤드리스 Chrome으로 열어 프레임을 찍음)

실행: 프로젝트 루트에서
  python tools/rig/bake_sprite.py kaiju walk 12 64 assets/sprites/rig/kaiju/baby_walk.png
  인자: 캐릭터 클립 프레임수 높이(px) 출력파일

  여러 클립 한 번에 (같은 틀·배율, 적 걷기/공격처럼 바꿔 끼우는 동작):
  python tools/rig/bake_sprite.py guard walk:12,attack:10 92 assets/sprites/rig/guard/guard.png
  → guard_walk.png, guard_attack.png, guard.json (높이 = 첫 클립 기준 키, anchorX = 프레임 안 발 사이 x)

  선택 (여러 클립 모드, Q-008 퀄리티업 Q5):
    --res=2      그림 픽셀을 2배로 (json의 frameWidth·frameHeight는 게임 크기 그대로 — CSS가 background-size로 줄여 그림 → 큰 화면에서 선명)
    --webp=90    PNG 대신 WebP(품질 90)로 저장 (D-062와 같은 품질)

- 배경/이펙트를 끄고 투명 배경으로 한 사이클을 균등하게 찍음
- 모든 프레임을 같은 영역(전체 프레임의 합집합)으로 잘라 흔들림 없이 가로로 이어 붙임
- 같은 이름의 .json에 프레임 크기/수/재생 시간을 기록 (battleFx.js가 CSS 애니메이션에 사용)
"""
import base64
import functools
import http.server
import io
import json
import os
import sys
import threading

from PIL import Image
from playwright.sync_api import sync_playwright


class _Handler(http.server.SimpleHTTPRequestHandler):
    # Windows에서 .js가 text/plain으로 나가 ES 모듈이 막히는 문제 방지
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}

    def log_message(self, *args):
        pass


def serve(root):
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Handler, directory=root))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def open_rig(p, char):
    """rig_test.html을 열고 배경·이펙트·스크롤을 끈 채 캐릭터를 세움"""
    browser = p.chromium.launch(channel='chrome')
    page = browser.new_page(viewport={'width': 1400, 'height': 820})
    page.goto(URL[0])
    page.wait_for_function('window.rigTest')
    page.evaluate('window.rigTest.ready')
    page.evaluate('rigTest.pause()')
    page.evaluate(f"rigTest.setCharacter('{char}')")
    page.wait_for_timeout(300)
    for key in ('bg', 'fx', 'scroll'):
        page.evaluate(f"rigTest.setOption('{key}', false)")
    return browser, page


def capture(page, clip, count):
    """클립 한 사이클을 count장 균등하게 찍음 → (프레임 목록, 재생 시간)"""
    page.evaluate(f"rigTest.setMode('{clip}')")
    duration = page.evaluate(f"rigTest.clipDuration('{clip}')")
    page.evaluate(f'rigTest.step({duration * 2})')   # 전환 보간이 끝난 사이클부터
    frames = []
    for _ in range(count):
        data = page.evaluate("document.getElementById('rig-canvas').toDataURL('image/png')")
        frames.append(Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGBA'))
        page.evaluate(f'rigTest.step({duration / count})')
    return frames, duration


def union_box(frames):
    box = None
    for f in frames:
        b = f.getchannel('A').getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def make_sheet(frames, box, fw, fh):
    sheet = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f.crop(box).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    return sheet


def main_single(char, clip, count, height, out):
    with sync_playwright() as p:
        browser, page = open_rig(p, char)
        frames, duration = capture(page, clip, count)
        browser.close()
    box = union_box(frames)
    x0, y0, x1, y1 = box
    scale = height / (y1 - y0)
    fw = max(1, round((x1 - x0) * scale))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    make_sheet(frames, box, fw, height).save(out)
    meta = {'frameWidth': fw, 'frameHeight': height, 'frames': count, 'duration': duration}
    with open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, indent=2)
    print(out, meta)


def main_multi(char, spec, height, out, res=1, webp=None):
    """여러 클립을 같은 틀·같은 배율로: 첫 클립(걷기)의 키가 height가 되게 줄이고, 모든 프레임의 합집합으로 자름.
    → 클립을 바꿔 끼워도 캐릭터 크기·발 위치가 같음. anchorX = 프레임 안에서 캐릭터 뿌리(발 사이)의 x"""
    clips = [(name, int(n)) for name, n in (part.split(':') for part in spec.split(','))]
    caps = {}
    with sync_playwright() as p:
        browser, page = open_rig(p, char)
        anchor = page.evaluate('rigTest.anchor')
        for name, count in clips:
            caps[name] = capture(page, name, count)
        browser.close()
    ref = union_box(caps[clips[0][0]][0])
    scale = height / (ref[3] - ref[1])
    box = union_box([f for frames, _ in caps.values() for f in frames])
    x0, y0, x1, y1 = box
    # 게임은 프레임 바닥을 땅에 맞춤 → 공격 동작이 땅 아래로 내려가면(처형인 성기사 대검 등) 그만큼 걷는 동안 발이 뜸 (11-02 QA).
    # 바닥은 '걷기 발'과 '땅' 중 낮은 쪽까지만 — 그 아래는 땅속이라 자름. 원래 떠 있는 적(걷기 발이 땅 위)은 그대로
    y1 = min(y1, max(ref[3], round(anchor[1])))
    box = (x0, y0, x1, y1)
    fw, fh = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
    base = os.path.splitext(out)[0]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    meta = {'frameWidth': fw, 'frameHeight': fh, 'anchorX': round((anchor[0] - x0) * scale, 1), 'res': res, 'clips': {}}
    for name, (frames, duration) in caps.items():
        path = f'{base}_{name}.{"webp" if webp else "png"}'
        sheet = make_sheet(frames, box, round(fw * res), round(fh * res))
        if webp:
            sheet.save(path, 'WEBP', quality=webp, method=6)
        else:
            sheet.save(path)
        meta['clips'][name] = {'src': path.replace(os.sep, '/'), 'frames': len(frames), 'duration': duration}
    with open(base + '.json', 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, indent=2, ensure_ascii=False)
    print(base + '.json', meta)


URL = ['']


def main():
    httpd = serve(os.getcwd())
    URL[0] = f'http://127.0.0.1:{httpd.server_address[1]}/rig_test.html?bake=1'
    flags = {k: v for k, _, v in (a[2:].partition('=') for a in sys.argv if a.startswith('--'))}
    args = [a for a in sys.argv if not a.startswith('--')]
    try:
        if ':' in args[2]:
            main_multi(args[1], args[2], int(args[3]), args[4],
                       res=float(flags.get('res', 1)), webp=int(flags['webp']) if 'webp' in flags else None)
        else:
            main_single(args[1], args[2], int(args[3]), int(args[4]), args[5])
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    main()
