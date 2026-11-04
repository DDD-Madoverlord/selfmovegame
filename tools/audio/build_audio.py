"""
MAD OVERLORD // 게임 사운드 만들기 (v2)

무료(CC0) 사운드 팩에서 고른 소리를 다듬어(자르기, 음높이, 겹치기, 페이드, 음량 맞춤) 게임용 OGG로 저장한다.
사이렌·심장 박동·휙 소리·상승음은 코드로 합성한다.

  입력: 아래 팩을 내려받아 한 폴더(SRC)에 풀어 둔다 (폴더 이름은 zip 이름 그대로, 'x/' 아래)
    x/kenney_sci-fi-sounds, x/kenney_impact-sounds, x/kenney_interface-sounds, x/kenney_digital-audio,
    x/kenney_rpg-audio, x/kenney_ui-audio, x/kenney_music-jingles        (kenney.nl, CC0)
    x/creature  (opengameart.org/content/80-cc0-creature-sfx, rubberduck, CC0)
    monster_roar.wav  (opengameart.org/content/cc0-deep-monster-roar, trazzz123, CC0)
    x/5_Action_Chiptunes_By_Juhani_Junkala  (opengameart.org/content/5-chiptunes-action, CC0)
    x/Juhani_Junkala_Chiptune_Adventures_OGG (opengameart.org/content/4-chiptunes-adventure, CC0)
    Cyberpunk_Moonlight_Sonata_v2.mp3  (opengameart.org/content/cyberpunk-moonlight-sonata, Joth, CC0)
  출력: assets/audio/sfx/<이름>.ogg, assets/audio/bgm/<이름>.ogg
  실행: python tools/audio/build_audio.py <SRC 폴더>
        python tools/audio/build_audio.py - sfx diver_   # 이름이 diver_로 시작하는 합성 효과음만 (팩 없이)
        python tools/audio/build_audio.py - sfx saint_   # 봉합 성녀 합성 효과음만
        python tools/audio/build_audio.py - sfx frost_   # 서리의 무희 합성 효과음만
        python tools/audio/build_audio.py - sfx doll_    # 뒤틀린 인형사 합성 효과음만

효과음 이름은 이펙트 정의(sfx: '...')와 전투 연출(director.sfx)에서 부르는 이름과 같다.
음량/겹침 제한 같은 재생 규칙은 js/engine_v2/audio/sound_v2.js 의 SFX 표에서 정한다.
"""
import json
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
OUT_BGM = os.path.join(ROOT, 'assets', 'audio', 'bgm')

SCI = 'x/kenney_sci-fi-sounds/Audio/'
IMP = 'x/kenney_impact-sounds/Audio/'
UI = 'x/kenney_interface-sounds/Audio/'
DIG = 'x/kenney_digital-audio/Audio/'
RPG = 'x/kenney_rpg-audio/Audio/'
UIA = 'x/kenney_ui-audio/Audio/'
JIN = 'x/kenney_music-jingles/Audio/'
CRE = 'x/creature/'


# ---------------------------------------------------------------------------
# 기본 처리
def load(path, channels=1):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    return a.reshape(-1, channels) if channels > 1 else a


def resample(a, factor):
    """음높이 factor배 (길이는 1/factor)"""
    if factor == 1:
        return a
    n = int(len(a) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(a)), a).astype(np.float32)


def fades(a, fin=0.004, fout=0.03):
    a = a.copy()
    # 아주 짧은 소리(클릭 등)는 페이드가 소리를 먹지 않도록 길이의 1/3까지만
    i, o = min(int(fin * SR), len(a) // 3), min(int(fout * SR), len(a) // 3)
    if i > 0:
        a[:i] *= np.linspace(0, 1, i)
    if o > 0:
        a[-o:] *= np.linspace(1, 0, o)
    return a


def layer(src_root, path, t0=0.0, t1=None, pitch=1.0, gain=1.0, at=0.0, fin=0.004, fout=0.03):
    a = load(os.path.join(src_root, path))
    a = a[int(t0 * SR): int(t1 * SR) if t1 else None]
    a = fades(resample(a, pitch), fin, fout) * gain
    return np.concatenate([np.zeros(int(at * SR), np.float32), a])


def mix(parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n, np.float32)
    for p in parts:
        out[:len(p)] += p
    return out


def normalize(a, peak_db=-1.0):
    peak = np.max(np.abs(a)) + 1e-9
    return a * (10 ** (peak_db / 20) / peak)


def trim_silence(a, thr=0.002):
    idx = np.where(np.abs(a) > thr)[0]
    return a[: idx[-1] + int(0.02 * SR)] if len(idx) else a


def write_ogg(a, path, q=4, channels=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = np.clip(a, -1, 1).astype(np.float32).tobytes()
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(channels), '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', str(q), path], input=data, check=True)


# ---------------------------------------------------------------------------
# 합성
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def one_pole_lowpass(x, cutoff):
    """cutoff: 샘플마다 차단 주파수 배열(Hz)"""
    y = np.zeros_like(x)
    k = 1 - np.exp(-2 * np.pi * np.asarray(cutoff) / SR)
    acc = 0.0
    for i in range(len(x)):
        acc += (k[i] if np.ndim(k) else k) * (x[i] - acc)
        y[i] = acc
    return y


def synth_whoosh(sec=0.9, lo=250, hi=3200):
    """바람 가르는 소리: 잡음을 차단 주파수를 올렸다 내리며 거름"""
    t = t_axis(sec)
    u = t / sec
    noise = rng.standard_normal(len(t)).astype(np.float32)
    sweep = lo + (hi - lo) * np.sin(np.pi * np.clip(u * 1.1, 0, 1)) ** 2
    band = one_pole_lowpass(noise, sweep) - one_pole_lowpass(noise, sweep * 0.25)
    env = np.sin(np.pi * u) ** 1.6
    return band * env


def synth_siren(cycles=3, f_hi=880, f_lo=620, half=0.24, bass=False):
    """경보: 높은음/낮은음 번갈아 (각진 파형을 부드럽게) + 선택적으로 저음 박동"""
    parts = []
    for c in range(cycles * 2):
        f = f_hi if c % 2 == 0 else f_lo
        t = t_axis(half)
        ph = 2 * np.pi * f * t
        wave = np.sin(ph) + np.sin(3 * ph) / 3 + np.sin(5 * ph) / 5 * 0.6   # 부드러운 사각파
        env = np.minimum(1, t / 0.01) * np.minimum(1, (half - t) / 0.03)
        parts.append(wave * env)
    s = np.concatenate(parts)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t_axis(len(s) / SR))
    s = s * vib
    if bass:
        t = t_axis(len(s) / SR)
        pulse = np.sin(2 * np.pi * 55 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * t / (half * 2))))
        s = s + 0.8 * pulse
    return fades(s.astype(np.float32), 0.01, 0.12)


def synth_heartbeat(period=1.1):
    """심장 박동 두 번 (쿵-쿵), period 길이로 반복 재생용"""
    out = np.zeros(int(period * SR), np.float32)
    for at, amp, f0 in [(0.0, 1.0, 62), (0.2, 0.7, 55)]:
        t = t_axis(0.3)
        freq = f0 * (1 - 0.35 * t / 0.3)
        ph = 2 * np.pi * np.cumsum(freq) / SR
        thump = np.sin(ph) * np.exp(-t / 0.075) * amp
        click = one_pole_lowpass(rng.standard_normal(len(t)).astype(np.float32), np.full(len(t), 900.0)) * np.exp(-t / 0.01) * 0.4 * amp
        i = int(at * SR)
        out[i:i + len(t)] += (thump + click)[: len(out) - i]
    return out


def synth_riser(sec=0.7, f0=180, f1=1400):
    """필살기 컷인: 빠르게 솟는 상승음 (톱니파 + 잡음)"""
    t = t_axis(sec)
    u = t / sec
    freq = f0 * (f1 / f0) ** (u ** 1.5)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    saw = one_pole_lowpass(saw.astype(np.float32), 800 + 5000 * u)
    noise = one_pole_lowpass(rng.standard_normal(len(t)).astype(np.float32), 2000 + 6000 * u) * 0.35
    env = u ** 1.4 * np.minimum(1, (sec - t) / 0.02)
    return (saw * 0.7 + noise) * env


def _band(noise, lo, hi):
    """잡음 대역 거르기 (lo~hi Hz, 배열이면 샘플마다)"""
    n = len(noise)
    lo = np.broadcast_to(np.asarray(lo, dtype=np.float64), (n,))
    hi = np.broadcast_to(np.asarray(hi, dtype=np.float64), (n,))
    return one_pole_lowpass(noise, hi) - one_pole_lowpass(noise, lo)


def _bubbles(sec, count, f0=280, f1=900, dur=0.035, gain=0.5):
    """물방울 '퐁' 소리: 짧게 음이 올라가는 사인 (무작위 시각)"""
    out = np.zeros(int(sec * SR), np.float32)
    for _ in range(count):
        at = rng.uniform(0, sec - dur)
        t = t_axis(dur)
        f = rng.uniform(f0, f1)
        freq = f * (1 + 1.4 * t / dur)
        ph = 2 * np.pi * np.cumsum(freq) / SR
        b = np.sin(ph) * np.sin(np.pi * t / dur) * gain * rng.uniform(0.4, 1)
        i = int(at * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out


def _clinks(sec, count, t0=0.0, t1=None, gain=0.5):
    """쇠사슬 고리 부딪힘: 높은 비조화음 짧게 여러 번"""
    out = np.zeros(int(sec * SR), np.float32)
    t1 = sec - 0.03 if t1 is None else t1
    for _ in range(count):
        at = rng.uniform(t0, t1)
        t = t_axis(0.04)
        tone = sum(np.sin(2 * np.pi * f * t) for f in rng.uniform(2200, 5200, 3)) / 3
        c = tone * np.exp(-t / 0.008) * gain * rng.uniform(0.5, 1)
        i = int(at * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def synth_diver_jet():
    """고압 방수포: 쉬익 하는 고압 물 분사 + 짧은 저음 퉁"""
    sec = 0.3
    t = t_axis(sec)
    hiss = _band(rng.standard_normal(len(t)).astype(np.float32), 1200, 6500)
    env = np.minimum(1, t / 0.01) * np.exp(-t / 0.12)
    thump = np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.04) * 0.6
    return (hiss * 2.2 * env + thump + _bubbles(sec, 3, 500, 1200, 0.025, 0.25)).astype(np.float32)


def synth_diver_anchor_throw():
    """앵커 던지기: 휙 바람 + 풀려나가는 사슬 소리"""
    sec = 0.5
    return (synth_whoosh(sec, 300, 2600) * 1.2 + _clinks(sec, 14, 0.05, 0.42, 0.45)).astype(np.float32)


def synth_diver_anchor_hit():
    """앵커가 박힘: 쇠 부딪히는 '쨍' + 둔탁한 쿵"""
    sec = 0.4
    t = t_axis(sec)
    clank = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(520, 1), (1340, 0.6), (2210, 0.4), (3170, 0.25)]) * np.exp(-t / 0.12)
    noise = _band(rng.standard_normal(len(t)).astype(np.float32), 800, 5000) * np.exp(-t / 0.015) * 2
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.06)
    return (clank * 0.45 + noise + thud * 0.8 + _clinks(sec, 5, 0.03, 0.25, 0.3)).astype(np.float32)


def synth_diver_surge():
    """고압 분사: 쏴아 하고 밀려가는 큰 물살 + 거품"""
    sec = 0.95
    t = t_axis(sec)
    u = t / sec
    noise = rng.standard_normal(len(t)).astype(np.float32)
    rush = _band(noise, 150 + 300 * u, 900 + 3200 * np.sin(np.pi * np.clip(u * 1.3, 0, 1)) ** 2)
    env = np.minimum(1, t / 0.03) * (1 - u) ** 1.3
    rumble = np.sin(2 * np.pi * 55 * t + 3 * np.sin(2 * np.pi * 7 * t)) * env * 0.5
    return (rush * 2.0 * env + rumble + _bubbles(sec, 22, 260, 900, 0.04, 0.35)).astype(np.float32)


def synth_diver_hands():
    """심연의 손: 깊은 바다의 낮은 울림 + 속삭이는 물결 + 올라오는 거품"""
    sec = 1.3
    t = t_axis(sec)
    u = t / sec
    env = np.sin(np.pi * np.clip(u * 1.15, 0, 1)) ** 0.8
    drone = (np.sin(2 * np.pi * 55 * t + 0.6 * np.sin(2 * np.pi * 3 * t))
             + 0.6 * np.sin(2 * np.pi * 82.5 * t + 0.4 * np.sin(2 * np.pi * 2.3 * t))) * env
    whisper = _band(rng.standard_normal(len(t)).astype(np.float32), 500, 1600) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * env * 1.6
    return (drone * 0.55 + whisper + _bubbles(sec, 18, 200, 700, 0.05, 0.3) * env).astype(np.float32)


def _chord(sec, freqs, attack=0.15, vib=5.0, glide=1.0):
    """성가대 같은 화음: 사인 여러 개 + 느린 떨림, glide배까지 음이 미끄러져 오름"""
    t = t_axis(sec)
    u = t / sec
    out = np.zeros(len(t), np.float32)
    for i, f in enumerate(freqs):
        freq = f * (1 + (glide - 1) * u ** 2) * (1 + 0.006 * np.sin(2 * np.pi * (vib + i * 0.7) * t))
        ph = 2 * np.pi * np.cumsum(freq) / SR
        out += (np.sin(ph) + 0.3 * np.sin(2 * ph)).astype(np.float32)
    env = np.minimum(1, t / attack) * (1 - u) ** 1.2
    return out * env / len(freqs)


def synth_saint_needle():
    """봉합 주사 발사: 짧게 내려가는 '쀼' + 유리 딸깍"""
    sec = 0.16
    t = t_axis(sec)
    freq = 2400 - 1300 * t / sec
    whistle = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.06)
    click = _band(rng.standard_normal(len(t)).astype(np.float32), 3000, 9000) * np.exp(-t / 0.008) * 1.5
    return (whistle * 0.6 + click).astype(np.float32)


def synth_saint_stitch():
    """바늘이 꽂힘: 푹 + 실을 당기는 짧은 '찍'"""
    sec = 0.22
    t = t_axis(sec)
    pierce = _band(rng.standard_normal(len(t)).astype(np.float32), 1500, 6000) * np.exp(-t / 0.02) * 1.6
    thunk = np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.035)
    squeak = np.sin(2 * np.pi * np.cumsum(1800 + 1500 * t / sec) / SR) * np.exp(-((t - 0.07) / 0.03) ** 2) * 0.35
    return (pierce + thunk * 0.7 + squeak).astype(np.float32)


def synth_saint_seal():
    """생명 봉인: 실이 휘감기는 휙 소리 + 낮게 깔리는 성가 화음"""
    sec = 1.1
    whoosh = synth_whoosh(sec, 400, 3000) * 0.9
    choir = _chord(sec, [220, 277.2, 329.6, 440], attack=0.25, vib=4.5)
    return (whoosh + choir * 0.9 + _clinks(sec, 6, 0.05, 0.5, 0.25)).astype(np.float32)


def synth_saint_revive():
    """억지 부활: 심장 박동 한 번 + 위로 미끄러지는 금빛 화음 + 반짝임"""
    sec = 1.4
    t = t_axis(sec)
    beat = np.zeros(len(t), np.float32)
    hb = synth_heartbeat(0.5)
    beat[:len(hb)] += hb[: len(beat)] * 0.9
    choir = _chord(sec, [261.6, 329.6, 392.0, 523.3], attack=0.3, vib=5.5, glide=1.5)
    shimmer = _band(rng.standard_normal(len(t)).astype(np.float32), 5000, 11000) * np.sin(np.pi * np.clip(t / sec, 0, 1)) * 0.25
    return (beat + choir + shimmer).astype(np.float32)


def _chimes(sec, count, t0=0.0, t1=None, f0=1800, f1=4200, decay=0.12, gain=0.4):
    """얼음 방울 소리: 맑은 높은 사인(배음 하나)이 여러 번 울림"""
    out = np.zeros(int(sec * SR), np.float32)
    t1 = sec - decay if t1 is None else t1
    for _ in range(count):
        at = rng.uniform(t0, t1)
        t = t_axis(decay * 3)
        f = rng.uniform(f0, f1)
        c = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t / decay) * gain * rng.uniform(0.5, 1)
        i = int(at * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def synth_frost_fan():
    """서리 부채: 짧게 휙 + 얼음 방울 둘"""
    sec = 0.32
    return (synth_whoosh(sec, 900, 5000) * 0.9 + _chimes(sec, 2, 0.05, 0.2, 2500, 4500, 0.06, 0.3)).astype(np.float32)


def synth_frost_hit():
    """얼음 칼날이 맞음: 짧은 서걱 + 쨍"""
    sec = 0.2
    t = t_axis(sec)
    crack = _band(rng.standard_normal(len(t)).astype(np.float32), 2500, 9000) * np.exp(-t / 0.015) * 1.5
    return (crack + _chimes(sec, 1, 0.0, 0.02, 3000, 4000, 0.05, 0.35)).astype(np.float32)


def synth_frost_freeze():
    """얼어붙음: 바스락 얼음 끼는 소리가 빠르게 퍼짐 + 낮은 쿵"""
    sec = 0.55
    t = t_axis(sec)
    crackle = np.zeros(len(t), np.float32)
    for _ in range(40):
        at = rng.uniform(0, 0.4) ** 1.5
        i = int(at * SR)
        n = int(0.004 * SR)
        crackle[i:i + n] += rng.standard_normal(min(n, len(t) - i)).astype(np.float32) * rng.uniform(0.3, 1)
    crackle = _band(crackle, 1500, 8000) * 1.8
    thud = np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.05) * 0.5
    return (crackle + thud + _chimes(sec, 3, 0.1, 0.4, 2200, 3800, 0.08, 0.25)).astype(np.float32)


def synth_frost_shatter():
    """얼음 결정이 깨짐: 쨍그랑 잡음 + 흩어지는 조각 소리"""
    sec = 0.8
    t = t_axis(sec)
    burst = _band(rng.standard_normal(len(t)).astype(np.float32), 2000, 10000) * np.exp(-t / 0.05) * 1.8
    return (burst + _chimes(sec, 14, 0.02, 0.6, 2000, 6000, 0.06, 0.35) + _clinks(sec, 10, 0.05, 0.5, 0.3)).astype(np.float32)


def synth_frost_crescent():
    """초승달 참격: 크게 휙 + 높게 울리는 얼음 화음"""
    sec = 0.7
    return (synth_whoosh(sec, 500, 4500) * 1.1 + _chord(sec, [1046.5, 1318.5, 1568.0], attack=0.03, vib=7) * 0.35
            + _chimes(sec, 4, 0.1, 0.5, 2500, 5000, 0.08, 0.25)).astype(np.float32)


def synth_frost_blizzard():
    """눈보라: 휘몰아치는 바람(차단 주파수가 출렁이는 잡음) + 흩날리는 얼음 방울"""
    sec = 1.3
    t = t_axis(sec)
    u = t / sec
    wind = _band(rng.standard_normal(len(t)).astype(np.float32), 300, 1500 + 1200 * np.sin(2 * np.pi * 2.2 * t) ** 2)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7
    return (wind * 2.2 * env + _chimes(sec, 10, 0.1, 1.1, 2500, 5500, 0.07, 0.2)).astype(np.float32)


def synth_frost_eternal():
    """영원한 안식: 낮게 깔리는 차가운 화음 + 얼음이 자라는 바스락 + 맑은 종소리"""
    sec = 1.5
    choir = _chord(sec, [196.0, 233.1, 293.7, 392.0], attack=0.2, vib=3.5)
    grow = np.zeros(int(sec * SR), np.float32)
    fz = synth_frost_freeze()
    grow[: len(fz)] += fz * 0.8
    return (choir * 0.9 + grow + _chimes(sec, 8, 0.2, 1.2, 1500, 3500, 0.2, 0.3)).astype(np.float32)


def _snip(sec, at=0.0, gain=1.0):
    """가위 날이 맞물리는 '싹둑': 금속 마찰 잡음이 짧게 미끄러지다 딸깍"""
    out = np.zeros(int(sec * SR), np.float32)
    t = t_axis(0.09)
    slide = _band(rng.standard_normal(len(t)).astype(np.float32), 3000 + 20000 * t, 9000 + 20000 * t) * np.sin(np.pi * t / 0.09) * 1.6
    t2 = t_axis(0.03)
    click = (np.sin(2 * np.pi * 3200 * t2) + 0.5 * np.sin(2 * np.pi * 5100 * t2)) * np.exp(-t2 / 0.006)
    i = int(at * SR)
    out[i:i + len(slide)] += slide[: len(out) - i] * gain
    j = i + len(slide)
    out[j:j + len(click)] += click[: max(0, len(out) - j)] * gain * 0.8
    return out


def synth_doll_snip():
    """가위 참격: 싹둑"""
    return _snip(0.16).astype(np.float32)


def synth_doll_xcut():
    """가위 참격 X자: 크게 휙 + 싹둑 두 번"""
    sec = 0.6
    return (synth_whoosh(sec, 600, 5000) * 0.8 + _snip(sec, 0.12, 1.2) + _snip(sec, 0.28, 1.2)).astype(np.float32)


def synth_doll_summon():
    """인형 가족: 실이 퉁 + 인형이 내려앉는 폭신한 소리 + 삑삑이 장난감"""
    sec = 0.45
    t = t_axis(sec)
    twang = np.sin(2 * np.pi * 330 * t) * np.exp(-t / 0.15) * (1 + 0.3 * np.sin(2 * np.pi * 6 * t))
    thump = _band(rng.standard_normal(len(t)).astype(np.float32), 100, 700) * np.exp(-((t - 0.18) / 0.03) ** 2) * 1.5
    sq_t = t_axis(0.12)
    squeak = np.sin(2 * np.pi * np.cumsum(1300 + 900 * np.sin(np.pi * sq_t / 0.12)) / SR) * np.sin(np.pi * sq_t / 0.12) * 0.4
    out = twang * 0.6 + thump
    i = int(0.2 * SR)
    out[i:i + len(squeak)] += squeak[: len(out) - i]
    return out.astype(np.float32)


def synth_doll_burst():
    """토끼 인형이 터짐: 퐁 + 솜이 흩어지는 사각사각"""
    sec = 0.6
    t = t_axis(sec)
    pop = np.sin(2 * np.pi * np.cumsum(220 * np.exp(-t / 0.08) + 80) / SR) * np.exp(-t / 0.07)
    fluff = _band(rng.standard_normal(len(t)).astype(np.float32), 800, 4000) * np.exp(-t / 0.18) * 1.2
    return (pop + fluff).astype(np.float32)


def synth_doll_strings():
    """인형 실: 여러 줄이 차례로 퉁기는 하프 같은 소리 + 낮은 웅웅"""
    sec = 1.3
    out = np.zeros(int(sec * SR), np.float32)
    for k, f in enumerate([392.0, 466.2, 587.3, 698.5, 784.0]):
        t = t_axis(0.8)
        pluck = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t / 0.25)
        i = int(k * 0.09 * SR)
        out[i:i + len(pluck)] += pluck[: len(out) - i] * 0.5
    t = t_axis(sec)
    drone = np.sin(2 * np.pi * 98 * t + 0.5 * np.sin(2 * np.pi * 3 * t)) * np.sin(np.pi * t / sec) * 0.4
    return (out + drone).astype(np.float32)


def synth_zone_gas():
    """소각탑 유독 가스: 길게 쉬익 하는 분사 + 낮게 부글거림"""
    sec = 1.2
    t = t_axis(sec)
    u = t / sec
    env = np.minimum(1, t / 0.035) * (1 - u) ** 0.55
    noise = rng.standard_normal(len(t)).astype(np.float32)
    hiss = _band(noise, 900, 6500 + 2000 * np.sin(2 * np.pi * 3 * t) ** 2)
    rumble = one_pole_lowpass(noise, 160) * 1.3 + np.sin(2 * np.pi * 48 * t + 0.5 * np.sin(2 * np.pi * 13 * t)) * 0.35
    bubbles = _bubbles(sec, 14, 50, 140, 0.075, 0.4)
    return fades((hiss * 2.2 + rumble + bubbles) * env, 0.008, 0.02).astype(np.float32)


def synth_zone_judgment():
    """천상의 심판: 빠르게 올라가는 맑은 화음 뒤 빛기둥의 쿵"""
    sec = 1.0
    out = np.zeros(int(sec * SR), np.float32)
    rise = _chord(0.4, [523.3, 659.3, 784.0], attack=0.012, vib=6, glide=3)
    rise *= 0.25 + 1.75 * t_axis(0.4) / 0.4
    out[:len(rise)] += rise
    t = t_axis(0.65)
    thud = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t / 0.06) + 48) / SR) * np.exp(-t / 0.2)
    burst = _band(rng.standard_normal(len(t)).astype(np.float32), 220, 6500) * np.exp(-t / 0.045)
    ring = (np.sin(2 * np.pi * 1046.5 * t) + 0.5 * np.sin(2 * np.pi * 1568 * t)) * np.exp(-t / 0.22)
    i = int(0.35 * SR)
    hit = thud * 1.5 + burst * 1.1 + ring * 0.3
    out[i:i + len(hit)] += hit[: len(out) - i]
    return fades(out, 0.004, 0.02).astype(np.float32)


def synth_zone_hellgate():
    """악마병 지옥문: 낮은 우르릉 + 불꽃이 일렁이는 잡음"""
    sec = 0.9
    t = t_axis(sec)
    u = t / sec
    env = np.minimum(1, t / 0.04) * (1 - u) ** 0.65
    rumble = np.sin(2 * np.pi * 55 * t + 0.8 * np.sin(2 * np.pi * 7 * t)) + 0.5 * np.sin(2 * np.pi * 82 * t)
    fire = _band(rng.standard_normal(len(t)).astype(np.float32), 130, 2200 + 1100 * np.sin(2 * np.pi * 4 * t) ** 2)
    flutter = 0.5 + 0.5 * np.sin(2 * np.pi * 13 * t) ** 2
    return fades((rumble * 0.9 + fire * 1.8 * flutter) * env, 0.008, 0.02).astype(np.float32)


def synth_zone_knight():
    """악마기사 소환: 더 낮고 큰 지옥문 울림 + 금속성 쾅"""
    sec = 1.3
    t = t_axis(sec)
    u = t / sec
    env = np.minimum(1, t / 0.05) * (1 - u) ** 0.6
    rumble = np.sin(2 * np.pi * np.cumsum(54 - 22 * u) / SR) + 0.55 * np.sin(2 * np.pi * 35 * t)
    fire = _band(rng.standard_normal(len(t)).astype(np.float32), 90, 1600) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t) ** 2)
    out = (rumble * 0.9 + fire * 1.1) * env
    hit_t = t_axis(1.06)
    clank = sum(np.sin(2 * np.pi * f * hit_t) * a for f, a in [(180, 1), (421, 0.7), (907, 0.5), (1583, 0.3)]) * np.exp(-hit_t / 0.26)
    slam = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-hit_t / 0.08) + 30) / SR) * np.exp(-hit_t / 0.24)
    crack = _band(rng.standard_normal(len(hit_t)).astype(np.float32), 500, 5500) * np.exp(-hit_t / 0.035)
    hit = clank * 0.65 + slam * 1.3 + crack * 1.8
    i = int(0.24 * SR)
    out[i:i + len(hit)] += hit[: len(out) - i]
    return fades(out + _clinks(sec, 6, 0.28, 0.66, 0.25) * env, 0.008, 0.02).astype(np.float32)


def synth_zone_axe():
    """도끼 내려찍기: 묵직한 휙 뒤 둔탁한 쿵"""
    sec = 0.6
    out = np.zeros(int(sec * SR), np.float32)
    whoosh = synth_whoosh(0.3, 90, 1600) * 1.6
    out[:len(whoosh)] += whoosh
    t = t_axis(0.36)
    thud = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t / 0.05) + 42) / SR) * np.exp(-t / 0.13)
    crack = _band(rng.standard_normal(len(t)).astype(np.float32), 100, 1400) * np.exp(-t / 0.06)
    hit = thud * 1.3 + crack * 1.4
    i = int(0.24 * SR)
    out[i:i + len(hit)] += hit[: len(out) - i]
    return fades(out, 0.004, 0.02).astype(np.float32)


def synth_zone_spell_fire():
    """불 원소탄: 짧게 화르륵 하는 불꽃 분출"""
    sec = 0.4
    t = t_axis(sec)
    fire = _band(rng.standard_normal(len(t)).astype(np.float32), 220, 2600 + 2000 * np.exp(-t / 0.09))
    env = np.minimum(1, t / 0.008) * np.exp(-t / 0.13) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t) ** 2)
    puff = np.sin(2 * np.pi * np.cumsum(170 * np.exp(-t / 0.04) + 70) / SR) * np.exp(-t / 0.055)
    return fades(fire * 2.2 * env + puff * 0.5 + synth_whoosh(sec, 200, 3000) * 0.55, 0.003, 0.02).astype(np.float32)


def synth_zone_spell_bolt():
    """번개 원소탄: 짧은 전기 스파크가 지직 튐"""
    sec = 0.35
    out = np.zeros(int(sec * SR), np.float32)
    for at, amp in [(0.0, 1), (0.045, 0.8), (0.12, 0.6), (0.215, 0.4)]:
        t = t_axis(0.135)
        crack = _band(rng.standard_normal(len(t)).astype(np.float32), 1800, 10000)
        zap = np.sin(2 * np.pi * np.cumsum(3100 * np.exp(-t / 0.025) + 900) / SR) * np.exp(-t / 0.015)
        spark = (crack * 1.8 * np.exp(-t / 0.035) + zap * 0.3) * amp
        i = int(at * SR)
        out[i:i + len(spark)] += spark[: len(out) - i]
    return fades(out, 0.001, 0.02).astype(np.float32)


def synth_zone_spell_ice():
    """얼음 원소탄: 차갑고 맑은 쨍 + 짧은 바람"""
    sec = 0.4
    t = t_axis(sec)
    ring = (np.sin(2 * np.pi * 2600 * t) + 0.35 * np.sin(2 * np.pi * 4130 * t) + 0.16 * np.sin(2 * np.pi * 5980 * t)) * np.exp(-t / 0.13)
    crack = _band(rng.standard_normal(len(t)).astype(np.float32), 3000, 9000) * np.exp(-t / 0.012)
    return fades(ring * 0.65 + crack * 0.7 + synth_whoosh(sec, 1200, 6500) * 0.7, 0.002, 0.02).astype(np.float32)


def synth_zone_arrow():
    """통제탑 화살: 활시위 퉁 + 짧게 날아가는 휙"""
    sec = 0.3
    t = t_axis(sec)
    ph = 2 * np.pi * np.cumsum(245 - 35 * t / sec) / SR
    twang = (np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.exp(-t / 0.055)
    click = _band(rng.standard_normal(len(t)).astype(np.float32), 1200, 6000) * np.exp(-t / 0.008)
    return fades(twang * 0.7 + click * 0.4 + synth_whoosh(sec, 700, 5500) * 0.85, 0.002, 0.02).astype(np.float32)


def synth_zone_venom():
    """유기질 벽 독액: 찍 하는 분사 뒤 짧게 부글거림"""
    sec = 0.5
    t = t_axis(sec)
    noise = rng.standard_normal(len(t)).astype(np.float32)
    spit = _band(noise, 900, 4300) * np.exp(-t / 0.03) * 1.8
    squirt = _band(noise, 150, 1100) * np.exp(-t / 0.16) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t) ** 2)
    return fades(spit + squirt * 0.8 + _bubbles(sec, 7, 100, 380, 0.055, 0.45), 0.002, 0.02).astype(np.float32)


def synth_zone_heal_holy():
    """신관 치유: 작고 맑은 종소리 세 개"""
    sec = 0.6
    out = np.zeros(int(sec * SR), np.float32)
    for at, f in [(0.0, 1046.5), (0.13, 1318.5), (0.26, 1568.0)]:
        t = t_axis(0.45)
        chime = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * f * 2.76 * t) + 0.08 * np.sin(2 * np.pi * f * 4.08 * t)) * np.exp(-t / 0.14)
        chime = fades(chime, 0.003, 0.03)
        i = int(at * SR)
        out[i:i + len(chime)] += chime[: len(out) - i] * 0.45
    return fades(out, 0.003, 0.02).astype(np.float32)


def synth_zone_spore():
    """포자 덩어리: 퍽 하고 터지는 발사음 + 쉿"""
    sec = 0.4
    t = t_axis(sec)
    pop = np.sin(2 * np.pi * np.cumsum(190 * np.exp(-t / 0.035) + 65) / SR) * np.exp(-t / 0.055)
    puff = _band(rng.standard_normal(len(t)).astype(np.float32), 350, 3300) * np.minimum(1, t / 0.008) * np.exp(-t / 0.12)
    return fades(pop + puff * 1.5 + synth_whoosh(sec, 600, 2500) * 0.3, 0.003, 0.02).astype(np.float32)


def synth_zone_goo():
    """유전자 붕괴 점액: 낮게 미끄러지는 질척한 철퍽"""
    sec = 0.5
    t = t_axis(sec)
    freq = (180 * np.exp(-t / 0.07) + 55) * (1 + 0.2 * np.sin(2 * np.pi * 18 * t))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    squelch = (np.sin(ph) + 0.35 * np.sin(2 * ph)) * np.exp(-t / 0.14)
    splash = _band(rng.standard_normal(len(t)).astype(np.float32), 100, 1800 + 1000 * np.exp(-t / 0.1))
    splash *= np.exp(-t / 0.12) * (0.4 + 0.6 * np.sin(2 * np.pi * 20 * t) ** 2)
    return fades(squelch * 0.8 + splash * 1.8 + _bubbles(sec, 8, 80, 260, 0.06, 0.3), 0.002, 0.02).astype(np.float32)


def synth_zone_mutation():
    """극한의 변이: 내려가는 톱니파의 낮은 포효 + 찢어지는 고역 잡음 (목소리 없음)"""
    sec = 1.6
    t = t_axis(sec)
    u = t / sec
    ph = 2 * np.pi * np.cumsum(102 * 0.36 ** u) / SR
    saw = (2 * ((ph / (2 * np.pi)) % 1) - 1).astype(np.float32)
    saw = one_pole_lowpass(saw, 450 + 950 * (1 - u))
    noise = rng.standard_normal(len(t)).astype(np.float32)
    grit = _band(noise, 70, 2000 + 700 * np.sin(2 * np.pi * 5 * t) ** 2)
    env = np.minimum(1, t / 0.06) * (1 - u) ** 0.65
    roar = np.tanh(saw * 2.4 + grit * 0.8) * (0.65 + 0.35 * np.sin(2 * np.pi * 7 * t) ** 2) * env
    tear = _band(noise, 4200, 9500) * (0.3 + 0.7 * np.sin(2 * np.pi * 17 * t) ** 2) * np.exp(-((u - 0.48) / 0.28) ** 2)
    return fades(roar + tear * 0.6 + np.sin(2 * np.pi * 38 * t) * env * 0.4, 0.008, 0.025).astype(np.float32)


def synth_zone_charge():
    """돌진 충돌: 아주 낮고 큰 쿵 + 튀는 파편"""
    sec = 0.7
    t = t_axis(sec)
    thud = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t / 0.04) + 32) / SR) * np.exp(-t / 0.19)
    noise = rng.standard_normal(len(t)).astype(np.float32)
    blast = one_pole_lowpass(noise, 750) * np.exp(-t / 0.13)
    shards = _band(noise, 1700, 7000) * np.exp(-t / 0.08)
    return fades(thud * 1.5 + blast * 1.5 + shards * 0.9 + _clinks(sec, 9, 0.02, 0.35, 0.3), 0.003, 0.02).astype(np.float32)


def synth_zone_split():
    """슬라임 분열: 찰싹 뒤 작은 물방울 두 개"""
    sec = 0.4
    t = t_axis(sec)
    slap = _band(rng.standard_normal(len(t)).astype(np.float32), 250, 4200) * np.exp(-t / 0.035)
    out = slap * 1.8 + np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.04) * 0.4
    for at, f in [(0.1, 650), (0.23, 880)]:
        drop_t = t_axis(0.17)
        ph = 2 * np.pi * np.cumsum(f * (1 + 1.4 * drop_t / 0.17)) / SR
        drop = np.sin(ph) * np.sin(np.pi * drop_t / 0.17) ** 1.2 * 0.65
        i = int(at * SR)
        out[i:i + len(drop)] += drop[: len(out) - i]
    return fades(out, 0.002, 0.02).astype(np.float32)


# ---------------------------------------------------------------------------
# 효과음 조합: 이름 → [(파일, 옵션)] 또는 합성 함수
SFX = {
    # 거대로봇
    'mech_laser': [(SCI + 'laserSmall_004.ogg', dict(t1=0.32, pitch=0.9))],
    'mech_laser_big': [(SCI + 'laserLarge_001.ogg', {}), (SCI + 'lowFrequency_explosion_001.ogg', dict(t1=0.8, gain=0.7))],
    'mech_laser_hit': [(SCI + 'impactMetal_004.ogg', dict(t1=0.3))],
    'mech_missile_launch': [(SCI + 'thrusterFire_001.ogg', dict(t0=1.0, t1=1.45, fin=0.03, fout=0.12))],
    'mech_missile_blast': [(SCI + 'explosionCrunch_000.ogg', {})],
    'mech_drone_launch': [(DIG + 'phaseJump3.ogg', {})],
    'mech_drone_blast': [(SCI + 'explosionCrunch_002.ogg', dict(pitch=1.2, t1=0.9, fout=0.2))],
    'mech_fist_hit': [(IMP + 'impactPunch_heavy_000.ogg', {}), (IMP + 'impactMetal_heavy_000.ogg', dict(gain=0.6))],
    'mech_land': [(SCI + 'lowFrequency_explosion_001.ogg', {}), (IMP + 'impactPlate_heavy_001.ogg', dict(gain=0.6, pitch=0.7))],
    'mech_thrust': [(SCI + 'thrusterFire_003.ogg', dict(t0=0.9, t1=1.8, fin=0.05, fout=0.25))],
    'giant_step': [(IMP + 'footstep_concrete_000.ogg', dict(pitch=0.55)), (IMP + 'impactSoft_heavy_000.ogg', dict(gain=0.5, pitch=0.8, t1=0.3))],
    'charge_up': [(DIG + 'powerUp3.ogg', dict(pitch=0.8, gain=0.8))],
    # 거대괴수
    'kaiju_bite': [(CRE + 'eat_01.ogg', {}), (IMP + 'impactPunch_heavy_002.ogg', dict(gain=0.7, pitch=0.8))],
    'kaiju_roar': [('monster_roar.wav', dict(t0=0.25, t1=2.9, fout=0.7))],
    'kaiju_spore': [(SCI + 'slime_000.ogg', {})],
    'kaiju_egg_lay': [(IMP + 'impactSoft_medium_000.ogg', {}), (SCI + 'slime_000.ogg', dict(pitch=0.7, gain=0.7))],
    'kaiju_egg_hatch': [(IMP + 'impactGlass_light_000.ogg', {}), (CRE + 'cute_01.ogg', dict(at=0.08, pitch=0.8, gain=0.8))],
    'kaiju_regen': [(DIG + 'powerUp2.ogg', dict(gain=0.8))],
    # 타락 히어로
    'hero_slash_hit': [(RPG + 'knifeSlice2.ogg', {}), (IMP + 'impactMetal_heavy_002.ogg', dict(gain=0.5))],
    'hero_wave': [(DIG + 'phaseJump1.ogg', dict(pitch=0.85))],
    'hero_wave_hit': [(DIG + 'zap1.ogg', dict(t1=0.4))],
    'hero_orb': [(DIG + 'phaserUp6.ogg', {})],
    'hero_cast': [(DIG + 'zapThreeToneUp.ogg', dict(t1=0.7, fout=0.15))],
    'hero_curse_tick': [(DIG + 'lowDown.ogg', dict(t0=0.35, t1=0.78, fin=0.02, fout=0.1))],
    'hero_curse_nova': [(SCI + 'forceField_000.ogg', {}), (SCI + 'lowFrequency_explosion_000.ogg', dict(t1=1.2, gain=0.8, fout=0.3))],
    'hero_mind_convert': [(DIG + 'zapTwoTone.ogg', dict(t1=0.9, fout=0.2))],
    # 합성괴인
    'chimera_punch': [(IMP + 'impactPunch_heavy_001.ogg', {})],
    'chimera_claw': [(RPG + 'knifeSlice.ogg', dict(t0=0.2)), (IMP + 'impactSoft_heavy_002.ogg', dict(gain=0.6, t1=0.3))],
    'chimera_summon': [(CRE + 'grunt_04.ogg', {}), (DIG + 'phaseJump2.ogg', dict(gain=0.6))],
    'chimera_quake': [(SCI + 'lowFrequency_explosion_001.ogg', dict(t1=0.5, fout=0.15))],
    'chimera_slam': [(SCI + 'explosionCrunch_003.ogg', dict(t1=1.0, fout=0.3)), (IMP + 'impactSoft_heavy_000.ogg', {})],
    # 심연의 길잡이 (새 캐릭터, D-044): 팩 없이 합성
    'diver_jet': lambda: synth_diver_jet(),
    'diver_anchor_throw': lambda: synth_diver_anchor_throw(),
    'diver_anchor_hit': lambda: synth_diver_anchor_hit(),
    'diver_surge': lambda: synth_diver_surge(),
    'diver_hands': lambda: synth_diver_hands(),
    # 봉합 성녀 (D-046): 팩 없이 합성
    'saint_needle': lambda: synth_saint_needle(),
    'saint_stitch': lambda: synth_saint_stitch(),
    'saint_seal': lambda: synth_saint_seal(),
    'saint_revive': lambda: synth_saint_revive(),
    # 서리의 무희 (D-046): 팩 없이 합성
    'frost_fan': lambda: synth_frost_fan(),
    'frost_hit': lambda: synth_frost_hit(),
    'frost_freeze': lambda: synth_frost_freeze(),
    'frost_shatter': lambda: synth_frost_shatter(),
    'frost_crescent': lambda: synth_frost_crescent(),
    'frost_blizzard': lambda: synth_frost_blizzard(),
    'frost_eternal': lambda: synth_frost_eternal(),
    # 뒤틀린 인형사 (D-049): 팩 없이 합성
    'doll_snip': lambda: synth_doll_snip(),
    'doll_xcut': lambda: synth_doll_xcut(),
    'doll_summon': lambda: synth_doll_summon(),
    'doll_burst': lambda: synth_doll_burst(),
    'doll_strings': lambda: synth_doll_strings(),
    'chimera_phase2': [(CRE + 'roar_02.ogg', {}), (DIG + 'powerUp1.ogg', dict(gain=0.6))],
    'generic_slash': [(RPG + 'knifeSlice2.ogg', {})],
    # 실드
    'shield_on': [(SCI + 'forceField_003.ogg', {})],
    'shield_hit': [(IMP + 'impactGlass_medium_000.ogg', dict(gain=0.8))],
    'shield_break': [(IMP + 'impactGlass_heavy_000.ogg', {}), (SCI + 'explosionCrunch_000.ogg', dict(pitch=1.3, gain=0.6, t1=0.5))],
    # 전투 공용
    'enemy_die': [(CRE + 'hurt_02.ogg', dict(pitch=1.25)), (IMP + 'impactGeneric_light_001.ogg', dict(gain=0.6))],
    'player_hit': [(IMP + 'impactPunch_medium_000.ogg', {})],
    'base_blast': [(SCI + 'explosionCrunch_001.ogg', {})],
    'base_destroyed': [(SCI + 'lowFrequency_explosion_000.ogg', {}), (SCI + 'explosionCrunch_004.ogg', dict(gain=0.8))],
    'player_down': [(SCI + 'explosionCrunch_004.ogg', {}), (DIG + 'lowDown.ogg', dict(at=0.2, gain=0.8))],
    # 연출
    'intro_whoosh': lambda: synth_whoosh(0.9),
    'intro_sortie': [(JIN + 'Hit jingles/jingles_HIT01.ogg', {})],
    'warning': lambda: synth_siren(3, 880, 620, 0.26),
    'warning_danger': lambda: synth_siren(4, 700, 470, 0.22, bass=True),
    'ult_cutin': lambda src: mix([synth_riser(0.55), layer(src, DIG + 'powerUp1.ogg', gain=0.55, at=0.45)]),
    'ult_ready': [(JIN + '8-Bit jingles/jingles_NES03.ogg', {})],
    'skill_ready': [(UI + 'pluck_001.ogg', {})],
    'skill_use': [(UI + 'select_005.ogg', {})],
    'star_get': [(JIN + '8-Bit jingles/jingles_NES09.ogg', {})],
    'mission_complete': [(JIN + '8-Bit jingles/jingles_NES12.ogg', {})],
    'mission_failed': [(JIN + '8-Bit jingles/jingles_NES00.ogg', {})],
    'result_win': [(UI + 'maximize_006.ogg', {})],
    'result_lose': [(UI + 'minimize_006.ogg', {})],
    'result_star': [(IMP + 'impactBell_heavy_001.ogg', dict(pitch=1.4, t1=0.6, fout=0.2))],
    'low_hp': lambda: synth_heartbeat(1.1),
    # 구역 2·3·4 적·보스·거점 (D-056): 팩 없이 합성
    'zone_gas': lambda: synth_zone_gas(),
    'zone_judgment': lambda: synth_zone_judgment(),
    'zone_hellgate': lambda: synth_zone_hellgate(),
    'zone_knight': lambda: synth_zone_knight(),
    'zone_axe': lambda: synth_zone_axe(),
    'zone_spell_fire': lambda: synth_zone_spell_fire(),
    'zone_spell_bolt': lambda: synth_zone_spell_bolt(),
    'zone_spell_ice': lambda: synth_zone_spell_ice(),
    'zone_arrow': lambda: synth_zone_arrow(),
    'zone_venom': lambda: synth_zone_venom(),
    'zone_heal_holy': lambda: synth_zone_heal_holy(),
    'zone_spore': lambda: synth_zone_spore(),
    'zone_goo': lambda: synth_zone_goo(),
    'zone_mutation': lambda: synth_zone_mutation(),
    'zone_charge': lambda: synth_zone_charge(),
    'zone_split': lambda: synth_zone_split(),
    # UI
    'ui_click': [(UIA + 'click2.ogg', {})],
    'ui_toggle': [(UI + 'toggle_001.ogg', {})],
    'ui_pause': [(UI + 'switch_002.ogg', {})],
    'ui_tab': [(UIA + 'switch3.ogg', {})],
    'ui_tick': [(UI + 'tick_002.ogg', {})],
    'ui_equip': [(UI + 'confirmation_004.ogg', {})],
    'ui_error': [(UI + 'error_004.ogg', {})],
    'reward_done': [(UI + 'confirmation_002.ogg', {})],
}

# 배경음: 이름 → (파일, 시작 초, 길이 초 | None)
BGM = {
    'battle': ('x/5_Action_Chiptunes_By_Juhani_Junkala/Juhani Junkala [Retro Game Music Pack] Level 1.wav', 0, None),
    'boss': ('x/Juhani_Junkala_Chiptune_Adventures_OGG/Juhani Junkala [Chiptune Adventures] 3. Boss Fight.ogg', 0, None),
    'menu': ('Cyberpunk_Moonlight_Sonata_v2.mp3', 0, None),
}
BGM_RMS_DB = -17.0   # 배경음끼리 체감 음량을 맞춤


def ai_picked():
    """AI로 만들어 팀이 고른 소리(ai_apply.py → ai_picks.json) — 이 도구로 다시 만들면 덮어써지니 건너뜀 (D-109)"""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ai_picks.json')
    return set(json.load(open(p, encoding='utf-8'))) if os.path.exists(p) else set()


def build_sfx(src, prefix=''):
    skip = ai_picked()
    for name, spec in SFX.items():
        if not name.startswith(prefix):
            continue
        if name in skip:
            print(f'sfx {name:20s} AI 소리라 건너뜀 (ai_picks.json)')
            continue
        if callable(spec):
            a = spec(src) if spec.__code__.co_argcount else spec()
        else:
            a = mix([layer(src, p, **opt) for p, opt in spec])
        if name != 'low_hp':   # 심장 박동은 반복 재생 길이 유지
            a = trim_silence(a)
        write_ogg(normalize(a, -1.0), os.path.join(OUT_SFX, f'{name}.ogg'), q=4)
        print(f'sfx {name:20s} {len(a) / SR:5.2f}s')


def build_bgm(src):
    skip = ai_picked()
    for name, (path, t0, dur) in BGM.items():
        if 'bgm_' + name in skip:
            print(f'bgm {name:8s} AI 곡이라 건너뜀 (ai_picks.json)')
            continue
        a = load(os.path.join(src, path), channels=2)
        a = a[int(t0 * SR): int((t0 + dur) * SR) if dur else None]
        rms = np.sqrt(np.mean(a ** 2)) + 1e-9
        a = a * (10 ** (BGM_RMS_DB / 20) / rms)
        a = np.clip(a, -0.98, 0.98)
        write_ogg(a.reshape(-1), os.path.join(OUT_BGM, f'{name}.ogg'), q=2, channels=2)
        print(f'bgm {name:8s} {len(a) / SR:6.1f}s')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src_dir = sys.argv[1]
    only = sys.argv[2] if len(sys.argv) > 2 else 'all'
    prefix = sys.argv[3] if len(sys.argv) > 3 else ''
    if only in ('all', 'sfx'):
        build_sfx(src_dir, prefix)
    if only in ('all', 'bgm'):
        build_bgm(src_dir)
