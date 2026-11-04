"""
MAD OVERLORD // 고른 AI 소리를 게임에 넣기 (2026-11-04, Q-024)

비교 페이지(ai_page.py) 투표 문서(Artifact db `votes/<사람>` 한 개를 JSON 파일로 받은 것)의 picks대로:
  효과음 → assets/audio/sfx/<이름>.ogg, 배경음(bgm_메뉴·전투·보스) → assets/audio/bgm/<이름>.ogg 로 복사
  크기: 페이지는 후보를 '지금 소리의 게임 속 크기'에 맞춰 들려줬으므로 그 크기 그대로 —
        새 vol = 지금 vol × 10^((지금 크기 − 후보 크기)/20)  (새 이름은 빌려 쓰던 소리의 vol·크기 기준, 지금 소리가 없으면 0.5)
  sound_v2.js SFX 표에 이미 있는 이름은 vol만 고쳐 쓰고, 표에 없는 새 이름은 넣을 줄을 출력만 함 (스킬 sfx 연결은 손으로)
  고른 기록(후보 번호·방식·씨앗·프롬프트·vol)은 ai_picks.json — 원본은 저장소 밖(D:/SoundLib/ai)이라 다시 만들 때 이 기록을 봄
  'keep'·'none'·안 고른 것은 그대로 둠

실행: python tools/audio/ai_apply.py <투표 JSON> [--only 이름,이름] [--out D:/SoundLib/ai] [--dry]
  같은 투표 문서로 두 번째 차례를 넣을 때는 반드시 --only (vol은 지금 표 값 기준이라 이미 넣은 것을 다시 돌리면 또 바뀜)
"""
import argparse
import datetime
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import ROOT  # noqa: E402
from ai_gen import SPEC  # noqa: E402

SOUND_JS = os.path.join(ROOT, 'js', 'engine_v2', 'audio', 'sound_v2.js')
PICKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ai_picks.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('votes')
    ap.add_argument('--out', default='D:/SoundLib/ai')
    ap.add_argument('--dry', action='store_true', help='복사·고쳐 쓰기 없이 할 일만 출력')
    ap.add_argument('--only', default='', help='쉼표로 이름 — 이번 차례에 고른 것만 (이미 넣은 소리를 다시 돌리면 vol이 두 번 바뀜)')
    args = ap.parse_args()
    doc = json.load(open(args.votes, encoding='utf-8'))
    picks = (doc.get('data') or doc).get('picks', {})
    spec = {k: v for k, v in json.load(open(SPEC, encoding='utf-8')).items() if not k.startswith('_')}
    cand = json.load(open(os.path.join(args.out, 'cand', 'cand.json'), encoding='utf-8'))
    js = open(SOUND_JS, encoding='utf-8').read()
    vols = {m.group(1): float(m.group(2)) for m in re.finditer(r'^\s+([a-z_0-9]+): \{ vol: ([\d.]+)', js, re.M)}
    record = json.load(open(PICKS, encoding='utf-8')) if os.path.exists(PICKS) else {}
    new_lines = []
    only = set(filter(None, args.only.split(',')))
    for name, v in sorted(picks.items()):
        if not v.isdigit() or name not in cand or (only and name not in only):
            continue
        e, s, no = cand[name], spec[name], int(v)
        t = next(x for x in e['takes'] if x['no'] == no)
        src = os.path.join(args.out, 'cand', name, f'{no}.ogg')
        if s['type'] == 'bgm':
            dest, vol = os.path.join(ROOT, 'assets', 'audio', 'bgm', name[4:] + '.ogg'), None
        else:
            dest = os.path.join(ROOT, 'assets', 'audio', 'sfx', name + '.ogg')
            base = s.get('now', name)
            if e.get('current'):
                vol = round(vols.get(base, 0.5) * 10 ** ((e['current']['loud'] - t['loud']) / 20), 2)
            else:
                vol = 0.5
        raw = os.path.join(args.out, 'raw', name, f'{t.get("base", no)}.wav')
        meta = json.load(open(os.path.join(args.out, 'raw', name, 'meta.json'), encoding='utf-8'))
        seed = next((x['seed'] for x in meta['takes'] if x['no'] == t.get('base', no)), None)
        record[name] = {'pick': no, 'mode': t['mode'], 'base': t.get('base'), 'seed': seed, 'prompt': s['prompt'], 'model': meta['model'],
                        'gen_sec': meta.get('gen_sec'), 'vol': vol, 'loud': t['loud'], 'date': datetime.date.today().isoformat()}
        print(f'{name:20s} 후보 {no} ({t["mode"]}{" ← " + str(t["base"]) if t.get("base") else ""})  → {os.path.relpath(dest, ROOT)}'
              + (f'  vol {vols.get(name, "새 이름")} → {vol}' if vol is not None else ''))
        if args.dry:
            continue
        shutil.copy(src, dest)
        if vol is not None:
            if name in vols:
                js = re.sub(rf'^(\s+{name}: \{{ vol: )[\d.]+', rf'\g<1>{vol}', js, count=1, flags=re.M)
            else:
                new_lines.append(f'    {name}: {{ vol: {vol} }},')
        if not os.path.exists(raw):
            print('   (원본 없음 — 기록만)')
    if not args.dry:
        open(SOUND_JS, 'w', encoding='utf-8').write(js)
        json.dump(record, open(PICKS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if new_lines:
        print('\nSFX 표에 넣을 새 이름 (스킬 sfx도 연결):\n' + '\n'.join(new_lines))


if __name__ == '__main__':
    main()
