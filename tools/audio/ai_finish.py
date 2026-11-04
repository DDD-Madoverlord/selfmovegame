"""
MAD OVERLORD // AI 소리 다듬기 — ai_gen.py가 만든 원본 → 게임용 후보 OGG (2026-11-04)

  효과음: 모노로 → 앞 무음 자르기(소리가 바로 나게) → 설명서 길이 + 15%에서 끊고 페이드 → polish_audio.py 사슬(종류별 크기·리미터)
  배경음: 스테레오 그대로 → 끝 2초를 처음과 겹쳐 이음매 없는 반복 → 지금 곡과 같은 크기 → 최고 -1 dBFS
  지금 게임 소리도 같은 폴더에 0번으로 둔다 (비교용, 가공 없음).
  들어 보기 전에 걸러 낼 것은 표시만 함: 거의 무음, 찢어짐(원본에 최고값에 붙은 샘플이 많음 — 다듬어도 거친 소리가 남을 수 있음)

실행: python tools/audio/ai_finish.py [--only 이름,이름] [--out D:/SoundLib/ai]
출력: <out>/cand/<이름>/<번호>.ogg (0 = 지금 게임 소리), <out>/cand/cand.json (후보 정보 — 비교 페이지가 읽음)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import FF, SR, load, write_ogg  # noqa: E402
from polish_audio import loudness, peak_db, polish  # noqa: E402
from ai_gen import SPEC, current_file  # noqa: E402

LOOP_XF = 2.0   # 배경음 반복 이음매 겹침(초)


def load_wav(path, channels):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    return a.reshape(-1, channels) if channels > 1 else a


def onset(a, rel_db=-30):
    """처음으로 최고값의 rel_db 위로 올라오는 곳(샘플) — 앞 무음 길이"""
    env = np.abs(a if a.ndim == 1 else a.max(axis=1))
    thr = env.max() * 10 ** (rel_db / 20)
    idx = np.where(env > thr)[0]
    return int(idx[0]) if len(idx) else 0


def finish_sfx(a, s):
    lead = onset(a)
    a = a[max(0, lead - int(0.004 * SR)):]
    cap = int(s['sec'] * 1.15 * SR)
    if len(a) > cap:
        a = a[:cap]
        f = min(int(0.08 * SR), len(a) // 3)
        a[-f:] *= np.linspace(1, 0, f)
    f = min(int(0.003 * SR), len(a) // 4)
    a[:f] *= np.linspace(0, 1, f)
    return polish(a, s['polish']), lead / SR


def finish_bgm(a, target):
    """끝 LOOP_XF초를 처음에 겹쳐 더함 → 마지막 샘플 다음이 자연스럽게 첫 샘플로 (loop 재생용)"""
    xf = int(LOOP_XF * SR)
    body, tail = a[:-xf].copy(), a[-xf:]
    ramp = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    body[:xf] = body[:xf] * ramp + tail * (1 - ramp)
    body *= 10 ** ((target - loudness(body.mean(axis=1))) / 20)
    pk = np.max(np.abs(body))
    if pk > 0.89:   # 최고 -1 dBFS
        body *= 0.89 / pk
    return body


def flags_of(a, lead):
    mono = a if a.ndim == 1 else a.mean(axis=1)
    out = []
    if peak_db(mono) < -30:
        out.append('거의 무음')
    if np.mean(np.abs(mono) > 0.985) > 0.01:   # 폭발·포효의 순간 닿음(0.2% 이하)은 들리지 않아 빼고, 길게 붙은 것만
        out.append('찢어짐')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default='D:/SoundLib/ai')
    args = ap.parse_args()
    spec = {k: v for k, v in json.load(open(SPEC, encoding='utf-8')).items() if not k.startswith('_')}
    only = set(filter(None, args.only.split(',')))
    index_path = os.path.join(args.out, 'cand', 'cand.json')
    index = json.load(open(index_path, encoding='utf-8')) if os.path.exists(index_path) else {}
    for name, s in spec.items():
        raw = os.path.join(args.out, 'raw', name)
        if (only and name not in only) or not os.path.exists(os.path.join(raw, 'meta.json')):
            continue
        meta = json.load(open(os.path.join(raw, 'meta.json'), encoding='utf-8'))
        dest = os.path.join(args.out, 'cand', name)
        shutil.rmtree(dest, ignore_errors=True)
        os.makedirs(dest)
        bgm = s['type'] == 'bgm'
        ch = 2 if bgm else 1
        cur = current_file(s.get('now', name))   # 새 이름은 지금 빌려 쓰는 소리와 비교
        entry = {'type': s['type'], 'desc': s['desc'], 'prompt': s['prompt'], 'new': bool(s.get('new')), 'takes': []}
        target = -16.0
        if cur:
            c = load(cur, ch)
            target = loudness(c.mean(axis=1) if bgm else c)
            shutil.copy(cur, os.path.join(dest, '0.ogg'))
            entry['current'] = {'file': os.path.relpath(cur).replace('\\', '/'), 'sec': round(len(c) / SR, 2), 'loud': round(float(target), 1)}
        for t in meta['takes']:
            a = load_wav(os.path.join(raw, f'{t["no"]}.wav'), ch)
            if bgm:
                out, lead = finish_bgm(a, target), onset(a) / SR
            else:
                out, lead = finish_sfx(a, s)
            write_ogg(out, os.path.join(dest, f'{t["no"]}.ogg'), q=5, channels=ch)
            mono = out.mean(axis=1) if bgm else out
            entry['takes'].append({**t, 'sec': round(len(out) / SR, 2), 'loud': round(float(loudness(mono)), 1), 'flags': flags_of(a, lead)})
        index[name] = entry
        print(f'{name:20s} ' + '  '.join(f'{t["no"]}:{t["sec"]:.2f}s{"!" if t["flags"] else ""}' for t in entry['takes'])
              + ('  ' + '; '.join(f'{t["no"]} {",".join(t["flags"])}' for t in entry['takes'] if t['flags']) if any(t['flags'] for t in entry['takes']) else ''))
    json.dump(index, open(index_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
