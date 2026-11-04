# 사운드 출처 (모두 CC0 — 저작자 표시 의무 없음, 감사의 뜻으로 기록)

게임용 파일은 `tools/audio/build_audio.py`로 원본을 다듬어(자르기, 음높이, 겹치기, 음량 맞춤) 만든다.
사이렌(`warning`, `warning_danger`), 심장 박동(`low_hp`), 휙 소리(`intro_whoosh`), 필살기 상승음(`ult_cutin` 앞부분)은 코드로 합성했다.

## 효과음 (assets/audio/sfx)
- Kenney — Sci-Fi Sounds, Impact Sounds, Interface Sounds, Digital Audio, RPG Audio, UI Audio, Music Jingles
  https://kenney.nl/assets (CC0)
- rubberduck — 80 CC0 creature SFX
  https://opengameart.org/content/80-cc0-creature-sfx (CC0)
- trazzz123 — CC0 Deep Monster Roar
  https://opengameart.org/content/cc0-deep-monster-roar (CC0)
- `diver_*.ogg` (심연의 길잡이: 물줄기·앵커·물살·심연의 손), `saint_*.ogg` (봉합 성녀: 바늘·꽂힘·생명 봉인·억지 부활), `frost_*.ogg` (서리의 무희: 부채·적중·빙결·깨짐·초승달·눈보라·영원한 안식), `doll_*.ogg` (뒤틀린 인형사: 가위·X자·인형 소환·인형 터짐·인형 실) — 외부 소리 없이 코드로 합성 (`tools/audio/build_audio.py`)

## 외부 라이브러리 효과음 (assets/audio/sfx_ext — 저장소에 없음)
- Sonniss — GDC 2026 Game Audio Bundle (로열티 프리, 상업 게임 사용·수정 가능, 출처 표기 의무 없음, 소리 파일 자체 재배포·AI 학습 금지)
  https://gdc.sonniss.com/ · 라이선스 https://sonniss.com/gdc-bundle-license/
- 라이선스상 소리 파일을 퍼뜨릴 수 없어 결과 파일은 `.gitignore`. 어느 파일의 몇 초를 썼는지는 `tools/audio/ext_sounds.json`,
  묶음을 받아 `python tools/audio/build_ext.py <풀어 둔 폴더>`로 다시 만든다. 파일이 없으면 게임은 sfx/의 CC0 소리를 쓴다.
- 쓰는 소리(16개, 2026-10-24 팀 선택): 출격(`intro_sortie`·`intro_whoosh`), 경보(`warning`·`warning_danger`), 충전(`charge_up`),
  적 쓰러짐(`enemy_die`), 맞음(`player_hit`·`shield_hit`), 저체력(`low_hp`), 스킬·필살기 준비(`skill_ready`·`ult_ready`), 별(`star_get`·`result_star`),
  임무 성공·실패(`mission_complete`·`mission_failed`), 승리 결과(`result_win`)

## AI로 만든 소리 — Powered by Stability AI (D-109, 2026-11-04)
- Stability AI **Stable Audio 3** (`stable-audio-3-small-sfx` · `stable-audio-3-small-music`)로 만들어 팀이 고른 소리. 만든 소리의 권리는 우리에게 있음(라이선스 4.c.iii), 상업 이용은 Stability AI Community License(연 매출 100만 달러 미만, 2026-11-04 등록).
- This Stability AI Model is licensed under the Stability AI Community License, Copyright © Stability AI Ltd. All Rights Reserved. (게임 설정 › 정보에 "Powered by Stability AI" 표시)
- 어느 소리를 어떤 프롬프트·씨앗으로 만들었는지: `tools/audio/ai_picks.json` · 다시 만들기: `tools/audio/ai_gen.py` → `ai_finish.py` → `ai_design.py`(게임식 겹치기) → `ai_apply.py`
- 쓰는 소리: 배경음 3곡(`menu`·`battle`·`boss` — 아래 CC0 곡을 바꿈), 심연의 길잡이·봉합 성녀·서리의 무희·뒤틀린 인형사 합성음 대부분(인형사 X자 베기만 예전 것), 설계자(`arch_drill`·`arch_scaffold`·`arch_crane`)·방송자(`bc_burst`·`bc_dome`·`bc_emergency`), 변신 포효(`rampage_roar`), 괴수 숨결(`kaiju_breath`), 패배 결과(`result_lose`), 필살기 컷인(`ult_cutin`) — 목록은 `tools/audio/ai_picks.json`
- 일부(공명 파열 음파 · 게임식 저음 쿵)는 코드로 만든 합성음을 AI 소리와 겹침 (`tools/audio/ai_design.py`)
- 스킬 사용(`skill_use`)은 AI가 아니라 '스킬 사용 소리 공방' 페이지(브라우저 Web Audio 합성)에서 팀이 직접 만든 소리 — 설정은 `ai_picks.json`의 params, 넣기 `tools/audio/lab_apply.py`
- `build_audio.py`는 이 소리들을 건너뜀 (덮어쓰지 않게)

## 배경음 (assets/audio/bgm) — 2026-11-04부터 세 곡 모두 AI 곡(위), 아래는 예전 CC0 곡
- `battle.ogg` — Juhani Junkala (SubspaceAudio), "Level 1" from 5 Chiptunes (Action)
  https://opengameart.org/content/5-chiptunes-action (CC0)
- `boss.ogg` — Juhani Junkala (SubspaceAudio), "Boss Fight" from 4 Chiptunes (Adventure)
  https://opengameart.org/content/4-chiptunes-adventure (CC0)
- `menu.ogg` — Joth, "Cyberpunk Moonlight Sonata" (v2)
  https://opengameart.org/content/cyberpunk-moonlight-sonata (CC0)
