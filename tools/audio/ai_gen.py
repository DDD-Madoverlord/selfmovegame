"""
MAD OVERLORD // AI 소리 만들기 — Stable Audio 3 (2026-11-04)

설명서(ai_sounds.json)대로 소리마다 후보를 여러 개 만든다. 원본 그대로(44.1kHz 스테레오 WAV) 저장만 하고,
게임용으로 다듬는 일(자르기·크기·반복 이음매)은 ai_finish.py가 한다.
  효과음: stable-audio-3-small-sfx · 배경음: stable-audio-3-small-music (Hugging Face에서 약관 동의 + `hf auth login` 필요)
  후보: 글로만 만든 것 n개(씨앗 고정) + init이면 지금 게임 소리를 바탕으로 한 것 1개(길이·박자 유지, 소리결만 바꿈)
  모델 라이선스: Stability AI Community License — 만든 소리는 우리 것, 상업 이용은 연 매출 100만 달러 미만 무료(등록 필요),
  게임 정보에 "Powered by Stability AI" 표시 (assets/audio/CREDITS.md)

실행 (Stable Audio 3를 설치한 가상 환경의 파이썬으로 — 게임 저장소 밖 D:/SoundLib/sa3, 설치법은 그 폴더 README):
  D:/SoundLib/sa3/.venv/Scripts/python.exe tools/audio/ai_gen.py [--n 3] [--only 이름,이름] [--out D:/SoundLib/ai]
출력: <out>/raw/<이름>/<번호>.wav · <out>/raw/<이름>/meta.json (번호마다 방식·씨앗·프롬프트)
"""
import argparse
import json
import math
import os
import time

# torch·soundfile·stable_audio_3는 Stable Audio 3 가상 환경에만 있음 → main에서 불러옴 (ai_finish.py가 이 파일의 SPEC·current_file을 씀)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPEC = os.path.join(HERE, 'ai_sounds.json')
MODEL = {'sfx': 'small-sfx', 'bgm': 'small-music'}
INIT_NOISE = 0.75   # 지금 소리를 얼마나 바꿀지 (1 = 글만 보고 새로 만듦, 낮을수록 원래 소리에 가까움)


def current_file(name):
    """지금 게임이 쓰는 소리 — 외부 라이브러리판(sfx_ext)이 있으면 그쪽 (게임과 같은 순서)"""
    if name.startswith('bgm_'):
        p = os.path.join(ROOT, 'assets', 'audio', 'bgm', name[4:] + '.ogg')
        return p if os.path.exists(p) else None
    for d in ('sfx_ext', 'sfx'):
        p = os.path.join(ROOT, 'assets', 'audio', d, name + '.ogg')
        if os.path.exists(p):
            return p
    return None


def gen_sec(s):
    """모델에 주는 길이 — 정수 초로 올림 (small 모델은 0.5·1.25·1.5초처럼 정수가 아닌 길이에서 최대치 잡음이 나옴, 11-04 확인:
    1·2·2.5·3초는 씨앗 5개 모두 정상, 0.5·0.75·1.25·1.5·1.75초는 거의 다 깨짐). 설명서 길이로 자르는 건 ai_finish.py"""
    return float(max(1, math.ceil(s['sec'])))


def save(path, audio, sr):
    """[채널, 샘플] 텐서 → 32비트 실수 WAV"""
    import numpy as np
    import soundfile as sf
    a = audio.detach().float().cpu().numpy().T
    sf.write(path, np.ascontiguousarray(a), sr, subtype='FLOAT')


def main():
    import soundfile as sf
    import torch
    from stable_audio_3 import StableAudioModel
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=3, help='글로만 만드는 후보 수 (init 후보는 따로 1개)')
    ap.add_argument('--only', default='', help='쉼표로 이름 — 이것만')
    ap.add_argument('--out', default='D:/SoundLib/ai')
    ap.add_argument('--steps', type=int, default=8)
    ap.add_argument('--spec', default=SPEC, help='설명서 (게임식 겹치기 재료는 ai_layers.json)')
    args = ap.parse_args()
    spec = {k: v for k, v in json.load(open(os.path.join(HERE, args.spec), encoding='utf-8')).items() if not k.startswith('_')}
    only = set(filter(None, args.only.split(',')))
    for typ in ('sfx', 'bgm'):
        todo = [(k, v) for k, v in spec.items() if v['type'] == typ and (not only or k in only)]
        if not todo:
            continue
        t0 = time.time()
        model = StableAudioModel.from_pretrained(MODEL[typ])
        sr = model.model.sample_rate
        print(f'{MODEL[typ]} 불러옴 {time.time() - t0:.1f}초 · {sr}Hz')
        def take(prompt, s, seed, **kw):
            """한 개 만들기 — 깨진 결과(NaN · 전 구간이 최대치에 붙은 잡음)면 씨앗을 바꿔 두 번까지 다시"""
            for tries in range(3):
                audio = model.generate(prompt=prompt, duration=gen_sec(s), steps=args.steps, seed=seed + 101 * tries, **kw)[0]
                x = audio.float()
                if not torch.isnan(x).any() and (x.abs() > 0.985).float().mean() < 0.05:
                    return audio, seed + 101 * tries
            raise RuntimeError(f'{s["desc"]}: 세 번 다 깨진 소리')

        for name, s in todo:
            dest = os.path.join(args.out, 'raw', name)
            os.makedirs(dest, exist_ok=True)
            meta, t1 = [], time.time()
            prompts = s.get('prompts') or [s['prompt']]   # 후보마다 다른 설명 (돌아가며)
            for k in range(args.n):
                p = prompts[k % len(prompts)]
                audio, seed = take(p, s, 1000 + 17 * k)
                save(os.path.join(dest, f'{len(meta) + 1}.wav'), audio, sr)
                meta.append({'no': len(meta) + 1, 'mode': 'text', 'seed': seed, **({'prompt': p} if len(prompts) > 1 else {})})
            # 바탕 후보: inits(게임 소리 이름들) 또는 지금 소리, 소리마다 n_init개
            srcs = [current_file(n) for n in s['inits']] if s.get('inits') else [current_file(name)] if s.get('init') else []
            noise = s.get('init_noise', INIT_NOISE)
            for cur in filter(None, srcs):
                wav, in_sr = sf.read(cur, dtype='float32', always_2d=True)
                for j in range(s.get('n_init', 1)):
                    audio, seed = take(s.get('init_prompt', s['prompt']), s, 4242 + 31 * j, init_audio=(in_sr, torch.from_numpy(wav.T.copy())), init_noise_level=noise)
                    save(os.path.join(dest, f'{len(meta) + 1}.wav'), audio, sr)
                    meta.append({'no': len(meta) + 1, 'mode': 'init', 'seed': seed, 'from': os.path.relpath(cur, ROOT).replace('\\', '/'),
                                 'noise': noise})
            json.dump({'name': name, 'prompt': s['prompt'], 'sec': s['sec'], 'gen_sec': gen_sec(s), 'model': MODEL[typ], 'steps': args.steps,
                       'takes': meta}, open(os.path.join(dest, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f'{name:20s} {len(meta)}개 {time.time() - t1:5.1f}초  {s["desc"]}')
        del model
        torch.cuda.empty_cache()


if __name__ == '__main__':
    main()
