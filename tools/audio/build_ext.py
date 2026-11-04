"""
MAD OVERLORD // 외부 라이브러리 효과음 만들기 (사운드 개선 4단계, D-084)

Sonniss GDC 2026 묶음(로열티 프리, 출처 표기 의무 없음)에서 팀이 고른 소리를 잘라 가공해 게임용 OGG로 만든다.
라이선스가 소리 파일 자체를 퍼뜨리는 것을 막아서 **결과 파일(assets/audio/sfx_ext/)은 저장소에 넣지 않는다**(.gitignore).
저장소에는 어느 파일의 몇 초를 썼는지(ext_sounds.json)만 두어, 묶음을 받은 사람은 누구나 같은 파일을 다시 만들 수 있다.
게임(sound_v2.js)은 SFX 표에서 ext: 1인 소리를 sfx_ext/에서 먼저 찾고, 없으면 sfx/의 CC0 소리를 쓴다.

  입력: Sonniss GDC 2026 묶음을 받아 zip 5개를 각각 part1~part5 폴더에 푼 폴더 (https://gdc.sonniss.com/)
  실행: python tools/audio/build_ext.py D:/SoundLib/Sonniss/GDC2026/x
        python tools/audio/build_ext.py <폴더> warning low_hp     # 고른 이름만
  출력: assets/audio/sfx_ext/<이름>.ogg, 이름마다 크기(dB) — 크기가 바뀌면 sound_v2.js의 vol을 다시 맞춤
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import FF, ROOT, SR, write_ogg  # noqa: E402
from polish_audio import ffchain, loudness, polish  # noqa: E402

SPEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ext_sounds.json')
OUT = os.path.join(ROOT, 'assets', 'audio', 'sfx_ext')


def cut(root, s):
    """from ~ to 구간 (앞 10ms 여유, 최대 max + 0.4초), 앞 4ms · 끝 80ms 페이드"""
    t0 = max(0.0, s['from'] - 0.01)
    dur = min(s['to'] - t0 + 0.05, s['max'] + 0.4)
    r = subprocess.run([FF, '-v', 'error', '-ss', f'{t0:.3f}', '-t', f'{dur:.3f}', '-i', os.path.join(root, s['file']),
                        '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    a = np.frombuffer(r.stdout, dtype=np.float32).copy()
    f, g = min(int(0.004 * SR), len(a) // 4), min(int(0.08 * SR), len(a) // 4)
    a[:f] *= np.linspace(0, 1, f)
    a[-g:] *= np.linspace(1, 0, g)
    return a


def heart(a, sec=1.1):
    """타격 한 조각 → 심장 박동 한 주기 (쿵 · 0.28초 뒤 작은 쿵), 저역 통과로 몸 안에서 들리게 — 반복 재생용"""
    a = ffchain(a, ['lowpass=f=420:poles=2', 'lowpass=f=420:poles=2'])
    out = np.zeros(int(sec * SR), np.float32)
    n = min(len(a), len(out))
    out[:n] += a[:n]
    k = int(0.28 * SR)
    m = min(n, len(out) - k)
    out[k:k + m] += 0.65 * a[:m]
    return out


def build(root, name, s):
    a = cut(root, s)
    a = polish(heart(a) if s['heart'] else a, s['kind'])
    if s['heart']:   # 반복 재생이라 정확히 1.1초 (꼬리는 다음 박동과 겹치지 않게 자름)
        a = np.concatenate([a, np.zeros(int(1.1 * SR), np.float32)])[: int(1.1 * SR)]
        f = int(0.03 * SR)
        a[-f:] *= np.linspace(1, 0, f)
    write_ogg(a, os.path.join(OUT, f'{name}.ogg'), q=5)
    return a


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root, only = sys.argv[1], set(sys.argv[2:])
    spec = json.load(open(SPEC, encoding='utf-8'))
    for name, s in spec.items():
        if only and name not in only:
            continue
        if not os.path.exists(os.path.join(root, s['file'])):
            print(f'{name:18s} 원본 없음: {s["file"]}')
            continue
        a = build(root, name, s)
        print(f'{name:18s} {s["kind"]:8s} {len(a) / SR:5.2f}s  크기 {loudness(a):6.1f} dB  {s["desc"]}')


if __name__ == '__main__':
    main()
