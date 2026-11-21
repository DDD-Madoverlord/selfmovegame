"""사운드 장면 점검실(tools/sound/scene.html)에서 내보낸 선정 묶음 → 게임 '새 소리' 묶음 (assets/audio/sfx_new/<이름>.ogg)

    python tools/audio/build_picks.py [묶음 폴더]        # 기본: assets/audio/sound_picks_20261116

묶음 폴더 = 점검실 ZIP을 푼 것 (원본/ · 조절본/ · sound_picks.json).
- 조절본 WAV(맞춘 음량·시작·끝 반영)를 ogg로 바꿔 sfx_new/에 넣는다.
- 점검실은 조절본을 만들 때 피크가 0.98을 넘으면 통째로 줄인다(찢어짐 방지). 줄어든 만큼(k)을 게임 표의 음량으로 되돌려야
  점검실에서 듣던 크기가 된다 → 이름마다 `pick: 표 기본 음량 / k`를 계산해 보여 준다 (sound_v2.js SFX 표에 손으로 옮김).
  표 기본 음량 = 고른 사람 PC에서 나던 기준 = sfx/ 파일의 vol (sfx_ext/는 저장소에 없음), 새 이름은 점검실 NEW_RULES의 vol.
ffmpeg가 PATH에 있어야 함.
"""
import io
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PICK = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'audio', 'sound_picks_20261116')
OUT = os.path.join(ROOT, 'assets', 'audio', 'sfx_new')
SR = 48000


def decode(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2)


def peak(a):
    return float(np.abs(a).max()) if len(a) else 0.0


def base_vols():
    """이름 → 표 기본 음량 (게임 SFX 표의 vol, 없으면 점검실 NEW_RULES의 vol)"""
    out = {}
    for rel in ('tools/sound/scene/cues.js', 'js/engine_v2/audio/sound_v2.js'):   # 뒤(게임 표)가 우선
        for m in re.finditer(r'^\s+([a-z_0-9]+): \{ vol: ([0-9.]+)', io.open(os.path.join(ROOT, rel), encoding='utf-8').read(), re.M):
            out[m.group(1)] = float(m.group(2))
    return out


def main():
    picks = json.load(io.open(os.path.join(PICK, 'sound_picks.json'), encoding='utf-8'))['소리']
    vols = base_vols()
    os.makedirs(OUT, exist_ok=True)
    print(f'{"이름":18} {"dB":>5} {"k":>6} {"기본":>5} {"pick":>5}  길이')
    for name, r in picks.items():
        if '원래_파일' not in r:
            continue   # 판정만 있고 파일은 없는 줄
        src = os.path.join(PICK, '원본', name + os.path.splitext(r['원래_파일'])[1])
        adj = os.path.join(PICK, '조절본', name + '.wav')
        o, a = decode(src), decode(adj)
        cut = round(-r['시작_ms'] / 1000 * SR) if r['시작_ms'] < 0 else 0
        seg = o[cut:]
        if r.get('끝_ms'):
            seg = seg[:round(r['끝_ms'] / 1000 * SR)]
        want = peak(seg) * 10 ** (r['음량_dB'] / 20)      # 줄이기 전 피크
        k = min(1.0, peak(a) / want) if want > 0 else 1.0   # 조절본이 줄어든 비율 (안 줄었으면 1)
        base = vols.get(name)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', adj, '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', os.path.join(OUT, name + '.ogg')], check=True)
        pick = f'{base / k:5.2f}' if base else '  ?  '
        print(f'{name:18} {r["음량_dB"]:5.1f} {k:6.3f} {base if base else "?":>5} {pick}  {len(a) / SR:.2f}s')
    print(f'\n→ {os.path.relpath(OUT, ROOT)} ({len(os.listdir(OUT))}개). pick 값을 js/engine_v2/audio/sound_v2.js SFX 표에 옮길 것')


if __name__ == '__main__':
    main()
