"""
MAD OVERLORD // AI 소리 게임식 조립 (2026-11-04)

AI가 한 번에 만든 소리는 실제 녹음처럼 '차오르고(공격 0.15~0.9초) 가벼움(150Hz 아래 2%)' — 상용 게임 전투음(공격 0.02초, 저음 약 80%)과 다름.
사운드 디자이너처럼 몸통(ai_gen.py 후보) 앞을 잘라 바로 터지게 하고, 따로 만든 재료(ai_layers.json)를 겹친다:
  짧은 타격(L_metal 쇳소리 · L_click 전자음) + 저음 쿵(S_thump — 코드로 만든 110→42Hz 짧은 음, 게임 타격음의 흔한 저음 층)
  + 음파(S_sonic·S_vwoom·S_speaker·S_ripple — 코드, 방송자) + 스킬 사용(S_arm 장전·S_hud 삑삑·S_servo 서보, S_blip은 3차에서 탈락)
  + 게임에 이미 있는 소리(G_<이름>, 예: 버튼 소리)
  + 저음 붐(L_sub — 폭발·필살기에만, 짧게) + 장식(얼음·성스러움·어둠·물·음파·파편·휙)
  → 합친 뒤 살짝 포화(밀도) → 타격·발사는 빠르게 줄어들게(tau) → polish_audio.py 사슬(종류별 EQ·압축·잔향·크기·리미터)
  11-04 1판의 교훈: AI 붐(L_sub)을 타격에 넣으면 0.25초 넘게 최대 크기로 웅웅거려 소리가 다 같은 덩어리가 됨 → 타격은 S_thump + tau
몸통 후보마다 하나씩 만들어 후보 번호 뒤에 붙인다 (예: 후보 1~4 → 게임식 5~8, 'design' · base = 바탕 후보 번호).

실행 (ai_finish.py 뒤에): python tools/audio/ai_design.py [--only 이름,이름] [--out D:/SoundLib/ai]
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import ROOT, SR, load, write_ogg  # noqa: E402
from polish_audio import ffchain, loudness, polish  # noqa: E402
from ai_finish import load_wav, onset  # noqa: E402
from ai_gen import SPEC  # noqa: E402

# 재료마다 쓸 번호 (11-04 숫자로 고름: 타격은 가장 빨리 터지는 것, 저음 붐은 꼬리가 알맞은 것, 장식은 공격이 빠른 것)
LAYER_TAKE = {'L_hit': 1, 'L_metal': 4, 'L_click': 2, 'L_sub': 3, 'L_whoosh': 4, 'L_ice': 2, 'L_holy': 4, 'L_dark': 1,
              'L_water': 3, 'L_zap': 3, 'L_debris': 4}
LAYER_MAX = {'L_sub': 0.45, 'L_debris': 1.2, 'L_dark': 1.2, 'L_holy': 1.2, 'L_ice': 1.0}   # 재료 길이 상한(초) — 꼬리가 몸통을 덮지 않게

# 조립법: pre = 몸통을 최고점 몇 ms 앞부터 쓸지(None = 처음부터, 차오름 유지) · lay = [(재료, dB, 'peak'이면 몸통 최고점에)]
# kind = polish 종류(저음 붐을 넣은 큰 소리는 blast — 저역을 덜 자름) · lowcut = 몸통 저역 자르기(Hz, 너무 먹먹한 것) · drive = 포화
# tau = 25ms 뒤부터 이 시간(초)마다 1/e로 줄임 — 상용 게임 타격음처럼 0.1~0.2초 안에 -12dB 아래로 (없으면 그대로)
SHOT = dict(pre=30, drive=1.3, tau=0.16)
SMALL = dict(pre=10, drive=1.3, tau=0.08)
HEAVY = dict(pre=10, drive=1.5, tau=0.15, kind='blast')
MAGIC = dict(pre=120, drive=1.3)
ULT = dict(pre=150, drive=1.5, kind='blast')
RECIPE = {
    'diver_jet': {**SHOT, 'lay': [('L_water', -1), ('L_water#1', -5), ('L_whoosh', -12)]},   # 3차: 1차 4번 바탕 + 물 튐 두 겹
    'diver_anchor_throw': {**SHOT, 'tau': 0.25, 'lay': [('L_whoosh', -6), ('L_metal', -12)]},   # 2차: 몸통이 쇠사슬 소리
    'saint_needle': {**SHOT, 'lay': [('L_whoosh', -10), ('L_metal', -12)]},
    'frost_fan': {**SHOT, 'lay': [('L_whoosh', -6), ('L_ice', -10)]},
    'frost_hit': {**SMALL, 'lay': [('L_metal', -8), ('S_thump', -14), ('L_ice', -12)]},
    'saint_stitch': {**SMALL, 'lay': [('L_metal', -12), ('S_thump', -16)]},   # 2차: 재봉틀·스테이플러·실 당김 세 갈래
    'doll_snip': {**SMALL, 'lay': [('L_metal', -4), ('S_thump', -14)]},
    'diver_anchor_hit': {**HEAVY, 'lay': [('S_thump', -2), ('L_metal', -6), ('L_water', -10)]},
    'doll_xcut': {**HEAVY, 'tau': 0.2, 'lay': [('L_metal', -3), ('S_thump', -6)]},
    'frost_shatter': {**HEAVY, 'tau': 0.22, 'lay': [('S_thump', -5), ('L_ice', -6)]},
    'arch_scaffold': {**HEAVY, 'tau': 0.2, 'lay': [('L_metal', -3), ('S_boom', -2)]},
    'arch_drill': {**HEAVY, 'pre': 15, 'tau': 0.35, 'lay': [('S_boom', 0), ('L_sub', -3), ('L_debris', -4)]},   # 2차: 다이너마이트 폭발처럼
    'arch_crane': {**HEAVY, 'pre': 15, 'tau': 0.3, 'lay': [('S_boom', 0), ('L_sub', -4), ('L_metal', -10), ('L_debris', -6)]},
    'kaiju_breath': {**HEAVY, 'pre': 40, 'tau': None, 'lay': [('L_sub', -8), ('L_whoosh', -8)]},   # 2차: 포효 말고 불 뿜는 소리 (어둠 장식 뺌)
    'diver_surge': {**MAGIC, 'lay': [('L_water', -3), ('S_thump', -8), ('L_whoosh', -8)]},
    'saint_seal': {**MAGIC, 'lay': [('L_metal', -14), ('L_holy', -6), ('S_thump', -12)]},
    'frost_freeze': {**MAGIC, 'lay': [('L_ice', -4), ('L_metal', -12), ('S_thump', -12)]},
    'frost_crescent': {**MAGIC, 'lay': [('L_whoosh', -4), ('L_metal', -10), ('L_ice', -8)]},
    'frost_blizzard': {**MAGIC, 'lay': [('L_whoosh', -5), ('L_ice', -8), ('S_thump', -12)]},
    'bc_burst': {**MAGIC, 'pre': 30, 'body_db': -18, 'kind': 'magic', 'lay_by_take': [[('S_vwoom', 0)], [('S_speaker', 0)], [('S_ripple', 0), ('S_vwoom', -8)]]},   # 3차: '심벌즈 소리뿐' → 코드 음파가 주재료(중음역), AI는 밑에 조금
    'bc_dome': {**MAGIC, 'lay': [('L_zap', -6), ('L_sub', -8)], 'kind': 'blast'},
    'diver_hands': {**ULT, 'lay': [('S_thump', -4), ('L_sub', -3), ('L_dark', -6), ('L_water', -10)]},
    'saint_revive': {**ULT, 'lowcut': 140, 'lay': [('S_thump', -6), ('L_sub', -6), ('L_holy', -3)]},
    'frost_eternal': {**ULT, 'lay': [('S_thump', -4), ('L_sub', -3), ('L_ice', -4), ('L_metal', -12)]},
    'doll_strings': {**ULT, 'lay': [('L_metal', -6), ('L_sub', -6), ('L_dark', -8)]},
    'doll_summon': {**SMALL, 'pre': 20, 'tau': 0.25, 'lay': [('L_click', -8), ('L_dark', -10)]},
    'doll_burst': {**HEAVY, 'lay': [('S_boom', -3)]},
    'rampage_roar': {**ULT, 'lay': [('S_thump', -6), ('L_sub', -4), ('L_dark', -10)]},
    'skill_use': {**SMALL, 'pre': 5, 'tau': 0.15, 'drive': 1.3, 'body_db': -10, 'kind': 'ui', 'lay_by_take': [[('S_arm', 0), ('G_ui_click', -8)], [('S_hud', 0), ('G_ui_click', -10)], [('S_servo', 0), ('S_arm', -8)]]},   # 4차: 2차 '타격음 같다' · 3차 '너무 밝은 캐주얼' → 어두운 SF 전술 화면음
    'result_lose': {**MAGIC, 'pre': None, 'lay': [('L_sub', -6)], 'kind': 'blast'},
    'ult_cutin': {**MAGIC, 'pre': None, 'lay': [('L_sub', -2, 'peak'), ('S_thump', -2, 'peak')], 'kind': 'blast'},   # 차오르다 끝에 쾅
    'bc_emergency': {**MAGIC, 'lay': [('L_zap', -4), ('L_sub', -5)], 'kind': 'blast'},
}


def peak_at(a):
    """5ms RMS가 가장 큰 곳(샘플)"""
    w = int(0.005 * SR)
    return int(np.argmax(np.convolve(a ** 2, np.ones(w) / w, 'same')))


def norm(a):
    return a / (np.max(np.abs(a)) + 1e-9)


def layer(out, name):
    """재료 한 개 — 최고점 15ms 앞부터(저음 붐도 0.045초에 걸쳐 차오르지 않고 바로 쿵), 최고값 1로, 길이 상한에서 페이드.
    'L_water#1'처럼 #번호를 붙이면 LAYER_TAKE 말고 그 번호 (같은 재료를 두 겹 다르게)"""
    base, _, k = name.partition('#')
    a = load_wav(os.path.join(out, 'raw', base, f'{k or LAYER_TAKE[base]}.wav'), 1)
    name = base
    a = norm(a[max(onset(a), peak_at(a) - int(0.015 * SR)):])
    f = min(int(0.002 * SR), len(a) // 4)
    a[:f] *= np.linspace(0, 1, f)
    cap = int(LAYER_MAX.get(name, 0.6) * SR)
    if len(a) > cap:
        a = a[:cap]
        f = min(int(0.12 * SR), len(a) // 3)
        a[-f:] *= np.linspace(1, 0, f)
    return a


def thump(f0, f1, sweep, tau, sec):
    """저음 쿵 — f0에서 f1(Hz)로 sweep초 안에 떨어지는 사인, tau초마다 1/e로 줄어듦"""
    t = np.arange(int(sec * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / sweep)
    a = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    a[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return a.astype(np.float32)


def sonic(gap=0.18, count=3):
    """음파 '웅' count번 (공명 파열의 음파 고리 3겹 · repeatGap 0.18초와 같은 간격) — 260→150Hz로 내려가는 배음 섞인 음에 18Hz 떨림,
    소리굽쇠 울림(1.6kHz)을 살짝"""
    one = int(0.26 * SR)
    t = np.arange(one) / SR
    f = 150 + 110 * np.exp(-t / 0.06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    wub = 0.6 + 0.4 * np.sin(2 * np.pi * 18 * t)
    ring = 0.25 * np.sin(2 * np.pi * 1600 * t) * np.exp(-t / 0.12)
    pulse = (tone * wub + ring) * np.exp(-t / 0.09)
    pulse[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    out = np.zeros(int((gap * (count - 1) + 0.26) * SR), np.float32)
    for i in range(count):
        k = int(i * gap * SR)
        out[k:k + one] += pulse * (1 - 0.15 * i)
    return (out / np.max(np.abs(out))).astype(np.float32)


def pulses(one, gap=0.18, count=3, fade=0.15):
    """한 번짜리 소리를 gap초 간격으로 count번 (뒤로 갈수록 조금 작게)"""
    out = np.zeros(int(gap * (count - 1) * SR) + len(one), np.float32)
    for i in range(count):
        k = int(i * gap * SR)
        out[k:k + len(one)] += one * (1 - fade * i)
    return (out / np.max(np.abs(out))).astype(np.float32)


def vwoom(sec=0.32):
    """'부웅' 퍼지는 파동 — 400→140Hz 사인 + 2·3배음(휴대폰 스피커는 150Hz 아래를 거의 못 내서 중음역에), 앞 10ms 빠른 부풂,
    흔들리는 짧은 지연(물결 같은 위상 움직임)"""
    t = np.arange(int(sec * SR)) / SR
    f = 140 + 260 * np.exp(-t / 0.07)
    ph = 2 * np.pi * np.cumsum(f) / SR
    a = (np.sin(ph) + 0.6 * np.sin(2 * ph) + 0.35 * np.sin(3 * ph)) * np.exp(-t / 0.11)
    d = (0.004 + 0.003 * np.sin(2 * np.pi * 7 * t)) * SR   # 3~7ms 흔들리는 지연과 섞어 '우웅' 하는 결
    idx = np.clip(np.arange(len(a)) - d, 0, len(a) - 1).astype(int)
    a = a + 0.7 * a[idx]
    a[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return a


def speaker(sec=0.26):
    """스피커가 터지는 음파 — 250→170Hz 각진 파형을 찌그러뜨려(홀수 배음이 휴대폰에서도 들림) 30Hz로 '와와' 떨림"""
    t = np.arange(int(sec * SR)) / SR
    f = 170 + 80 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sq = np.tanh(4 * np.sin(ph))
    wah = 0.55 + 0.45 * np.sin(2 * np.pi * 30 * t)
    a = sq * wah * np.exp(-t / 0.1)
    a[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return a


def ripple():
    """물결처럼 번지는 음파 — sonic()에 메아리 두 번(70ms·150ms, 점점 작게)"""
    a = sonic()
    out = np.zeros(len(a) + int(0.16 * SR), np.float32)
    for delay, g in ((0, 1.0), (0.07, 0.5), (0.15, 0.28)):
        k = int(delay * SR)
        out[k:k + len(a)] += g * a
    return (out / np.max(np.abs(out))).astype(np.float32)


def blip():
    """UI '띠링' — 두 음(1047Hz 도 → 1568Hz 솔)이 0.06초 간격으로 올라감, 부드러운 배음, 짧게 사라짐 (타격감 없음)"""
    out = np.zeros(int(0.32 * SR), np.float32)
    for k, f in ((0, 1047), (int(0.06 * SR), 1568)):
        t = np.arange(int(0.24 * SR)) / SR
        tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.06)
        tone[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
        out[k:k + len(tone)] += tone
    return (out / np.max(np.abs(out))).astype(np.float32)


def arm():
    """무기 장전 '부잉' — 120→480Hz로 0.12초에 올라가는 톱니파(저역 통과로 어둡게, 살짝 찌그러뜨림) + 앞 딸깍, 끝 480Hz 웅 0.1초"""
    t = np.arange(int(0.24 * SR)) / SR
    f = np.where(t < 0.12, 120 * (4 ** (t / 0.12)), 480)
    ph = np.cumsum(f) / SR
    saw = 2 * (ph % 1) - 1
    env = np.where(t < 0.12, 0.5 + 0.5 * t / 0.12, np.exp(-(t - 0.12) / 0.05))
    a = np.tanh(2 * saw * env)
    a = ffchain(a.astype(np.float32), ['lowpass=f=1800:poles=2'])
    click = np.zeros_like(a)
    n = int(0.004 * SR)
    click[:n] = np.random.default_rng(3).uniform(-1, 1, n) * np.linspace(1, 0, n)
    return (norm(a + 0.6 * click)).astype(np.float32)


def hud():
    """전술 화면 확인음 '삑삑' — 523Hz 각진 파형 두 번(0.05초씩, 0.07초 간격), 2kHz 저역 통과로 날카로움을 뺌"""
    out = np.zeros(int(0.2 * SR), np.float32)
    t = np.arange(int(0.05 * SR)) / SR
    beep = np.sign(np.sin(2 * np.pi * 523 * t)) * np.exp(-t / 0.03)
    for k in (0, int(0.07 * SR)):
        out[k:k + len(beep)] += beep * (1 if k == 0 else 0.8)
    return norm(ffchain(out, ['lowpass=f=2000:poles=2', 'lowpass=f=2000:poles=2'])).astype(np.float32)


def servo():
    """기계 서보 '지직-척' — 600~1400Hz로 오르내리는 띠 잡음 0.07초 + 끝 금속 딸깍"""
    rng = np.random.default_rng(5)
    n = int(0.07 * SR)
    z = ffchain(rng.uniform(-1, 1, n).astype(np.float32), ['bandpass=f=1000:width_type=o:w=1.2'])
    t = np.arange(n) / SR
    z = z * (0.6 + 0.4 * np.sin(2 * np.pi * 45 * t))
    out = np.zeros(int(0.16 * SR), np.float32)
    out[:n] += norm(z)
    k = int(0.08 * SR)
    c = int(0.012 * SR)
    out[k:k + c] += np.sin(2 * np.pi * 2400 * np.arange(c) / SR) * np.exp(-np.arange(c) / SR / 0.003)
    return norm(out).astype(np.float32)


SYNTH = {'S_thump': thump(110, 42, 0.03, 0.07, 0.3),   # 작은·보통 타격
         'S_boom': thump(90, 36, 0.05, 0.14, 0.6),     # 철구·드릴·인형 터짐처럼 큰 타격
         'S_sonic': sonic(),                            # 방송자 공명 파열 (2차)
         'S_vwoom': pulses(vwoom()),                    # 공명 파열 3차: 낮게 부웅 퍼지는 파동 ×3
         'S_speaker': pulses(speaker()),                # 공명 파열 3차: 스피커가 터지는 음파 ×3
         'S_ripple': ripple(),                          # 공명 파열 3차: 물결처럼 번지는 음파
         'S_blip': blip(),                              # 스킬 사용 3차: UI 띠링 → '너무 밝은 캐주얼 버튼음'
         'S_arm': arm(),                                # 스킬 사용 4차: 무기 장전
         'S_hud': hud(),                                # 스킬 사용 4차: 전술 화면 삑삑
         'S_servo': servo()}                            # 스킬 사용 4차: 기계 서보


def build(body, r, s, mats, lay):
    if r.get('lowcut'):
        body = ffchain(body, [f'highpass=f={r["lowcut"]}:poles=2'])
    on, pk = onset(body), peak_at(body)
    start = on if r['pre'] is None else max(on, pk - int(r['pre'] / 1000 * SR))
    body = norm(body[start:]) * 10 ** (r.get('body_db', 0) / 20)   # body_db: AI 몸통을 밑에 깔기만 할 때 (공명 파열 3차)
    f = min(int(0.003 * SR), len(body) // 4)
    body[:f] *= np.linspace(0, 1, f)
    at_peak = peak_at(body)
    parts = [(0, body)]
    for item in lay:
        name, db = item[0], item[1]
        parts.append((at_peak if len(item) > 2 else 0, mats[name] * 10 ** (db / 20)))
    n = max(off + len(a) for off, a in parts)
    mix = np.zeros(n, np.float32)
    for off, a in parts:
        mix[off:off + len(a)] += a
    mix = np.tanh(r['drive'] * norm(mix)) / np.tanh(r['drive'])   # 살짝 포화 — 겹친 소리를 한 덩어리로
    if r.get('tau'):
        t = np.arange(len(mix)) / SR
        mix *= np.exp(-np.maximum(0, t - 0.025) / r['tau'])
    cap = int(s['sec'] * 1.3 * SR)
    if len(mix) > cap:
        mix = mix[:cap]
        g = min(int(0.1 * SR), len(mix) // 3)
        mix[-g:] *= np.linspace(1, 0, g)
    return polish(mix.astype(np.float32), r.get('kind', s['polish']))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default='D:/SoundLib/ai')
    args = ap.parse_args()
    spec = {k: v for k, v in json.load(open(SPEC, encoding='utf-8')).items() if not k.startswith('_')}
    only = set(filter(None, args.only.split(',')))
    index_path = os.path.join(args.out, 'cand', 'cand.json')
    index = json.load(open(index_path, encoding='utf-8'))
    mats = {**{k: layer(args.out, k) for k in LAYER_TAKE}, **SYNTH}
    lays_of = lambda r: r.get('lay_by_take') or [r['lay']]   # lay_by_take: 몸통 후보마다 다른 재료 (돌아가며)
    for r in RECIPE.values():
        for lay in lays_of(r):
            for item in lay:
                if item[0] in mats:
                    continue
                if item[0].startswith('G_'):   # G_<이름> = 게임에 있는 소리(assets/audio/sfx)를 재료로 — 예: 스킬 사용에 버튼 소리
                    mats[item[0]] = norm(load(os.path.join(ROOT, 'assets', 'audio', 'sfx', item[0][2:] + '.ogg')))
                elif '#' in item[0]:
                    mats[item[0]] = layer(args.out, item[0])
    for name, r in RECIPE.items():
        if (only and name not in only) or name not in index:
            continue
        e, s = index[name], spec[name]
        e['takes'] = [t for t in e['takes'] if t['mode'] != 'design']   # 다시 돌리면 게임식만 새로
        base = [t for t in e['takes']]
        for i, t in enumerate(base):
            body = load_wav(os.path.join(args.out, 'raw', name, f'{t["no"]}.wav'), 1)
            lays = lays_of(r)
            a = build(body, r, s, mats, lays[i % len(lays)])
            no = len(base) + i + 1
            write_ogg(a, os.path.join(args.out, 'cand', name, f'{no}.ogg'), q=5)
            e['takes'].append({'no': no, 'mode': 'design', 'base': t['no'], 'sec': round(len(a) / SR, 2),
                               'loud': round(float(loudness(a)), 1), 'flags': []})
        print(f'{name:20s} 게임식 {len(base)}개  ' + ' '.join(f'{t["no"]}:{t["sec"]:.2f}s' for t in e['takes'] if t['mode'] == 'design'))
    json.dump(index, open(index_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
