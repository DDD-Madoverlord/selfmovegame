/* ==========================================================================
   PROJECT: MAD OVERLORD // 게임·앱 버전 (D-074)
   버전은 여기 한 곳에서만 올린다. app/build_www.py가 Android versionName·versionCode도 이 값으로 맞춘다.
   - VERSION: 사람이 보는 번호 (주.부.수). 새 릴리스를 올릴 때마다 올림.
   - BUILD:   Android versionCode. 올릴 때마다 1 이상 커져야 기존 앱 위에 설치된다.
   업데이트 확인(appUpdate_v2.js)은 NAS의 latest.json(app/release.py가 씀, D-081) — 없으면 GitHub 최신 릴리스 — 의 버전·빌드와 비교한다.
   RELEASE_REPO는 업데이트 주소를 넣지 않고 빌드한 앱이 읽는 곳 (GitHub).
   ========================================================================== */

export const VERSION = '0.2.4';
export const BUILD = 21;
export const RELEASE_REPO = 'DDD-Madoverlord/selfmovegame';   // 2026-11-03 조직 저장소로 옮김 (예전 catseye4/selfmovegame은 GitHub가 넘겨 줌)
