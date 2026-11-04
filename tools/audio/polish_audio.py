"""
MAD OVERLORD // 효과음 가공 (사운드 개선 2단계)

다듬은 소리(build_audio.py 결과나 새 CC0 재료)를 "실제 게임 소리"처럼 마무리하는 공통 사슬.
  1. 저역 자르기(high-pass)  — 들리지 않는 웅웅거림을 빼서 여러 소리가 겹쳐도 덜 뭉개짐
  2. 음색(EQ)                — 저음 몸통 · 중고음 존재감 · 고음 공기 (종류마다 다르게)
  3. 압축(compressor)        — 작은 부분을 끌어올려 단단하고 앞으로 나온 소리
  4. 잔향(reverb)            — 짧은 방 울림으로 공간감과 꼬리 (폭발·마법은 길게, UI는 없음)
  5. 크기 맞춤               — 종류별 목표 크기(위쪽 절반 50ms RMS, dB)로 — 소리끼리 균형
  6. 리미터                  — 최고 -1 dBFS (겹쳐도 찢어지지 않게)
  변형(--vars N): <이름>_2 … 를 음높이(±2~5%)·고음을 조금씩 바꿔 만든다 → sound_v2.js SFX의 vars: N

  종류(KIND): impact 타격 · blast 폭발 · shot 발사·투사체 · magic 마법·기운 · creature 괴물·적 · ui · cue 연출
              --kind auto(기본)는 이름으로 정함 (kind_of)

실행:
  python tools/audio/polish_audio.py <입력 파일|폴더> <출력 폴더> [--kind auto] [--vars 1] [--only 이름,이름]
  예) 지금 게임 소리를 가공해 비교용 폴더에:  python tools/audio/polish_audio.py assets/audio/sfx _polish
      총소리 3변형:                         python tools/audio/polish_audio.py assets/audio/sfx _polish --only mech_laser --vars 3
"""
import argparse
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import FF, SR, load, trim_silence, write_ogg  # noqa: E402

# 종류별 사슬 설정
#   hp: 저역 자르기 Hz · low/mid/high: (Hz, dB) 저음 선반 · 중고음 봉우리 · 고음 선반
#   comp: (문턱 = 그 소리 크기 + dB, 비율, 어택 ms, 릴리스 ms) — 어택을 10ms 넘게 두어 타격 순간(앞머리)은 그대로 통과
#   rev: (길이 초, 섞는 양, 밝기 0~1) · target: 목표 크기 dB
PRESET = {
    'impact':   dict(hp=35, low=(110, 3.0), mid=(3000, 2.0), high=(9000, 1.0), comp=(2, 3, 12, 90), rev=(0.45, 0.07, 0.5), target=-15),
    'blast':    dict(hp=28, low=(90, 4.0), mid=(2500, 1.0), high=(8000, 0.5), comp=(1, 2.5, 15, 160), rev=(1.0, 0.11, 0.4), target=-14),
    'shot':     dict(hp=90, low=(160, 1.0), mid=(4000, 2.5), high=(10000, 1.5), comp=(2, 2.5, 6, 70), rev=(0.45, 0.06, 0.6), target=-18),
    'magic':    dict(hp=60, low=(140, 1.0), mid=(3500, 1.0), high=(9000, 2.5), comp=(0, 2.5, 10, 140), rev=(1.2, 0.16, 0.7), target=-18),
    'creature': dict(hp=40, low=(120, 2.0), mid=(2200, 2.0), high=(8000, 0.5), comp=(1, 2.5, 10, 120), rev=(0.6, 0.09, 0.45), target=-16),
    'ui':       dict(hp=150, low=(200, 0.0), mid=(3000, 1.0), high=(10000, 1.0), comp=(4, 2, 3, 50), rev=None, target=-21),
    'cue':      dict(hp=60, low=(120, 1.0), mid=(3000, 1.0), high=(9000, 1.0), comp=(2, 2, 8, 120), rev=(0.5, 0.05, 0.6), target=-17),
}


def kind_of(name):
    """소리 이름 → 종류 (--kind auto)"""
    has = lambda *ws: any(w in name for w in ws)
    if name.startswith('ui_') or name == 'reward_done':
        return 'ui'
    if name.startswith(('warning', 'ult_', 'skill_', 'intro_', 'mission_', 'result_')) or name in ('star_get', 'low_hp'):
        return 'cue'
    if name.endswith('_hit'):
        return 'impact'
    if has('blast', 'destroyed', 'down', '_land', 'quake', 'slam', 'mutation', 'judgment', 'laser_big'):
        return 'blast'
    if has('laser', 'missile_launch', 'drone_launch', 'jet', 'thrust', 'arrow', 'needle', 'fan', 'throw', 'spell_', 'venom'):
        return 'shot'
    if has('roar', 'bite', 'phase2', 'enemy_die', 'summon', 'egg', 'goo', 'spore', 'split'):
        return 'creature'
    if has('hit', 'punch', 'claw', 'slash', 'snip', 'xcut', 'shatter', 'axe', 'step', 'break', 'stitch', 'knight', 'charge'):
        return 'impact'
    return 'magic'


def ffchain(a, filters):
    """float32 소리 → ffmpeg 오디오 필터 → float32 (길이는 필터에 따라 바뀔 수 있음)"""
    r = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', ','.join(filters),
                        '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], input=a.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def room_ir(sec, bright, seed=3):
    """잔향 응답: 이른 반사 몇 개 + 지수로 줄어드는 잡음 꼬리(길이 = 60 dB 줄어드는 시간), 밝기만큼 고음을 남김"""
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    tail = rng.standard_normal(n) * np.exp(-6.9 * t / sec)
    spec = np.fft.rfft(tail)
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / (1500 + 9000 * bright)) ** 2)   # 꼬리일수록 어둡게 들리도록 고음을 줄임
    tail = np.fft.irfft(spec, n)
    tail[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))   # 앞 12ms는 비워 둠 (원음과 붙지 않게)
    for ms, g in ((9, 0.5), (17, 0.35), (26, 0.25), (37, 0.18)):   # 이른 반사
        tail[int(ms / 1000 * SR)] += g * np.max(np.abs(tail))
    return (tail / (np.sqrt(np.sum(tail ** 2)) + 1e-9)).astype(np.float32)


def reverb(a, sec, wet, bright):
    ir = room_ir(sec, bright)
    n = len(a) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    w = np.fft.irfft(np.fft.rfft(a, size) * np.fft.rfft(ir, size), size)[:n].astype(np.float32)
    out = np.concatenate([a, np.zeros(len(ir) - 1, np.float32)])
    return out + w * wet * 4.0   # 응답 에너지를 1로 맞췄으므로 4배 정도가 귀로 듣는 "섞는 양"에 가까움


def loudness(a):
    """크기: 50ms 창 RMS 중 위쪽 절반의 평균 (dB) — 꼬리 무음에 끌려 내려가지 않게 (점검 페이지와 같은 잣대)"""
    w = int(0.05 * SR)
    n = len(a) // w
    if n < 2:
        return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
    rms = np.sqrt(np.mean(a[: n * w].reshape(n, w) ** 2, axis=1))
    top = np.sort(rms)[n // 2:]
    return 20 * np.log10(np.sqrt(np.mean(top ** 2)) + 1e-9)


def peak_db(a):
    return 20 * np.log10(np.max(np.abs(a)) + 1e-9)


def polish(a, kind, pitch=1.0, tilt=0.0):
    """소리 한 개 가공. pitch: 음높이 배율(변형), tilt: 고음 선반 dB 더하기(변형)"""
    p = PRESET[kind]
    a = a - np.mean(a)
    lf, lg = p['low']
    mf, mg = p['mid']
    hf, hg = p['high']
    thr, ratio, att, rel = p['comp']
    filters = []
    if pitch != 1.0:
        filters += [f'asetrate={SR * pitch:.0f}', f'aresample={SR}']
    filters += [f'highpass=f={p["hp"]}:poles=2', f'lowshelf=f={lf}:g={lg}', f'equalizer=f={mf}:t=o:w=1.2:g={mg}',
                f'highshelf=f={hf}:g={hg + tilt}']
    a = np.concatenate([a, np.zeros(int(0.05 * SR), np.float32)])   # 필터 꼬리 자리
    a = ffchain(a, filters)
    a = ffchain(a, [f'acompressor=threshold={min(-1.0, loudness(a) + thr):.1f}dB:ratio={ratio}:attack={att}:release={rel}:knee=4'])
    if p['rev']:
        a = reverb(a, *p['rev'])
    a = trim_silence(a, 0.0015)
    a = a * 10 ** ((p['target'] - loudness(a)) / 20)
    a = ffchain(a, ['alimiter=limit=-1dB:attack=1:release=40:level=disabled'])
    fade = min(int(0.02 * SR), len(a) // 4)
    a[-fade:] *= np.linspace(1, 0, fade)
    return np.clip(a, -0.995, 0.995)


VARIANTS = [(1.0, 0.0), (1.035, -0.8), (0.965, 0.8), (1.055, 0.4), (0.945, -0.4)]   # (음높이, 고음 dB) — 1번은 원래


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src', help='입력 파일(.ogg/.wav) 또는 폴더')
    ap.add_argument('out', help='출력 폴더')
    ap.add_argument('--kind', default='auto', choices=['auto', *PRESET])
    ap.add_argument('--vars', type=int, default=1, help=f'변형 수 (1~{len(VARIANTS)})')
    ap.add_argument('--only', default='', help='이 이름들만 (쉼표)')
    args = ap.parse_args()
    if os.path.isdir(args.src):
        files = [os.path.join(args.src, f) for f in sorted(os.listdir(args.src)) if f.endswith(('.ogg', '.wav'))]
    else:
        files = [args.src]
    only = set(filter(None, args.only.split(',')))
    names = {os.path.splitext(os.path.basename(f))[0] for f in files}
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        base, _, num = name.rpartition('_')
        if (only and name not in only) or (num.isdigit() and base in names):
            continue   # 이미 있는 변형 파일(<이름>_2)은 건너뜀
        kind = kind_of(name) if args.kind == 'auto' else args.kind
        a = load(path)
        before, crest = loudness(a), peak_db(a) - loudness(a)
        for i, (pitch, tilt) in enumerate(VARIANTS[:max(1, args.vars)]):
            out = polish(a, kind, pitch, tilt)
            fn = f'{name}.ogg' if i == 0 else f'{name}_{i + 1}.ogg'
            write_ogg(out, os.path.join(args.out, fn), q=4)
        print(f'{name:22s} {kind:8s} 크기 {before:6.1f} → {loudness(out):6.1f} dB  최고-크기 {crest:4.1f} → {peak_db(out) - loudness(out):4.1f} dB'
              f'  {len(a) / SR:5.2f}s → {len(out) / SR:5.2f}s' + (f'  변형 {args.vars}' if args.vars > 1 else ''))


if __name__ == '__main__':
    main()
