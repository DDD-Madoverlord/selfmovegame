"""
MAD OVERLORD // '스킬 사용 소리 공방' 페이지에서 ★ 고른 소리를 게임에 넣기 (2026-11-04, Q-024)

공방 페이지(Artifact, 브라우저 Web Audio로 만듦)는 저장할 때 들은 소리 그대로를 WAV(16비트 44.1kHz, base64)로 db `designs/<사람>`에 둔다.
그 문서를 JSON 파일로 받아 ★(pick) 소리를 꺼내 → OGG → assets/audio/sfx/<이름>.ogg. 가공(polish)은 하지 않음(들은 그대로).
크기: 페이지는 '지금 게임 소리와 같은 크기'로 들려줬으므로 vol = 지금 vol × 10^((지금 크기 − 새 소리 크기)/20) — sound_v2.js에서 고침.
기록: ai_picks.json에 mode 'lab' + 페이지 설정(params)

실행: python tools/audio/lab_apply.py <designs 문서 JSON> [--name skill_use] [--dry]
"""
import argparse
import base64
import datetime
import io
import json
import os
import re
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import ROOT, SR, load, write_ogg  # noqa: E402
from polish_audio import loudness  # noqa: E402

SOUND_JS = os.path.join(ROOT, 'js', 'engine_v2', 'audio', 'sound_v2.js')
PICKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ai_picks.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('doc')
    ap.add_argument('--name', default='skill_use')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    doc = json.load(open(args.doc, encoding='utf-8'))
    items = (doc.get('data') or doc).get('items', [])
    it = next((x for x in items if x.get('pick')), None)
    if not it:
        sys.exit('★ 고른 소리가 없음 — 페이지에서 ★ 이걸로를 눌러 달라고 할 것')
    with wave.open(io.BytesIO(base64.b64decode(it['wav']))) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32767
    dest = os.path.join(ROOT, 'assets', 'audio', 'sfx', f'{args.name}.ogg')
    js = open(SOUND_JS, encoding='utf-8').read()
    old_vol = float(re.search(rf'^\s+{args.name}: \{{ vol: ([\d.]+)', js, re.M).group(1))
    vol = round(float(old_vol * 10 ** ((loudness(load(dest)) - loudness(a)) / 20)), 2)
    print(f'{args.name}: ★ "{it["name"]}" {len(a) / SR:.2f}초 → {os.path.relpath(dest, ROOT)}  vol {old_vol} → {vol}')
    if args.dry:
        return
    write_ogg(a, dest, q=5)
    js = re.sub(rf'^(\s+{args.name}: \{{ vol: )[\d.]+', rf'\g<1>{vol}', js, count=1, flags=re.M)
    open(SOUND_JS, 'w', encoding='utf-8').write(js)
    record = json.load(open(PICKS, encoding='utf-8')) if os.path.exists(PICKS) else {}
    record[args.name] = {'pick': it['name'], 'mode': 'lab', 'params': it['params'], 'vol': vol, 'loud': round(float(loudness(a)), 1),
                         'date': datetime.date.today().isoformat(), 'how': '스킬 사용 소리 공방 페이지 (Web Audio 합성, AI 아님)'}
    json.dump(record, open(PICKS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
