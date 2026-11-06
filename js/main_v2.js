/* ==========================================================================
   PROJECT: MAD OVERLORD // MAIN ENGINE ROUTER & INITIALIZER (v2)
   ========================================================================== */

import { gameState } from './engine/state.js';
import { battleEngineV2 } from './engine_v2/battle_v2.js';
import { MenuController } from './ui_v2/menu_v2.js';
import { LabController } from './ui_v2/lab_v2.js';
import { SelectController } from './ui_v2/select_v2.js';
import { sound } from './engine_v2/audio/sound_v2.js';
import { progress } from './engine_v2/progress_v2.js';
import { coach } from './ui_v2/coach_v2.js';
import { registerV2Parts } from './engine_v2/partsExtra_v2.js';
import { registerAllSets2 } from './engine_v2/sets2/index.js';
import { runLoading } from './ui_v2/loading_v2.js';
import { isApp, checkForUpdate } from './ui_v2/appUpdate_v2.js';
import { applyVfxChoices, readVfxChoices, readVfxStyle } from './engine_v2/vfx/vfxVariants.js';
import { preloadVfxSheets } from './engine_v2/vfx/vfxPlayer.js';
import { setFitScale } from './engine_v2/displayRes.js';
import { settings } from './engine_v2/settings_v2.js';
import { initAnalytics, track } from './engine_v2/analytics_v2.js';
import { initCommerceDev } from './engine_v2/commerceDev_v2.js';
import { TutorialUi } from './ui_v2/tutorialUi_v2.js';
import { getSupabaseClient, checkSupabaseHealth } from './engine_v2/supabase_v2.js';

class GameRouterV2 {
    constructor() {
        this.currentScreen = 'menu';
        // v2 전용 추가 파츠(괴수 팔 등)를 등록한 뒤, 저장된 진행(DM, 장착, 보유 파츠, 강화, 스테이지)을 적용
        registerAllSets2();   // 2차 세트 (파츠 확장 2차, D-071) — 파츠 표에 먼저 더함
        registerV2Parts();
        initCommerceDev();
        progress.init();
        
        // 라우터 바인딩된 화면 전환 함수 (v2)
        const switchFn = (name) => this.switchScreen(name);
        
        this.menuController = new MenuController(switchFn);
        this.labController = new LabController(switchFn);
        this.selectController = new SelectController(switchFn);
        this.tutorialUi = new TutorialUi(this);

        this.init();
    }

    init() {
        // 사운드: 첫 입력에서 켜짐 (모드 선택 클릭으로 들어왔으면 바로)
        sound.listenForUnlock();
        // Supabase 클라이언트 초기화 및 연결 확인
        const supabase = getSupabaseClient();
        if (supabase) {
            checkSupabaseHealth().then(res => {
                if (res.ok) {
                    console.log(`[Supabase] 연결 성공: Mad Overlord (${res.latencyMs}ms, GoTrue ${res.version})`);
                } else {
                    console.warn('[Supabase] 헬스체크 응답 이상:', res.error);
                }
            });
        }
        // 메뉴/연구소/선택창 버튼 클릭음 (연구소 장착 확정·캐릭터 카드는 소리를 따로 냄)
        document.addEventListener('click', e => {
            const t = e.target.closest('#screen-menu-v2 button, #screen-lab-v2 button, #screen-lab-v2 .part-card, #screen-select-v2 button');
            if (!t || t.id === 'btn-equip-confirm-v2') return;
            sound.play(t.matches('.tab-btn-v2, .part-card') ? 'ui_tab' : 'ui_click');
        });

        // 전장 퇴각 버튼 이벤트 (v2)
        const btnLeave = document.getElementById('btn-battle-leave-v2');
        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                battleEngineV2.stopBattle();
                this.switchScreen('menu');
            });
        }

        // 결과 화면 버튼 (다시 출격 / 연구소 / 메인 메뉴) → 화면 전환
        battleEngineV2.onNavigate = name => this.switchScreen(name);

        // 특수 스킬 강제 발동 버튼 이벤트 (v2)
        const btnSpecial = document.getElementById('btn-trigger-special-v2');
        if (btnSpecial) {
            btnSpecial.addEventListener('click', () => {
                if (battleEngineV2.isActive && battleEngineV2.enemies.length > 0) {
                    battleEngineV2.showAnnouncement('SPECIAL SKILL OVERLOAD // 광역 스킬 방출!', 1500);
                    // 모든 적에게 대량 피해
                    battleEngineV2.enemies.forEach(e => {
                        battleEngineV2.dealDamageToEnemy(e, 500, true);
                    });
                    // 이펙트 화면 흔들림
                    const viewport = document.getElementById('battle-viewport-v2');
                    if (viewport) {
                        viewport.style.transform = 'translate(10px, -10px)';
                        setTimeout(() => viewport.style.transform = 'none', 100);
                    }
                }
            });
        }

        // 게임 상태 변경 시 모든 UI 자동 동기화 구독
        gameState.subscribe(() => {
            if (window.madOverlordGameMode !== 'v2') return;
            this.menuController.updateDisplay();
            this.labController.updateMvvmFeedback();
            if (battleEngineV2.isActive) {
                battleEngineV2.updateHud();
            }
        });

        // 초기 화면 설정
        if (!progress._offlineLifecycleBound) {
            progress._offlineLifecycleBound = true;
            const refresh = () => window.madOverlordGameV2?.menuController.updateOfflineReward();
            // 앱·탭이 뒤로 가면: 방치 보상 시각 기록 · 전투 일시정지 · 소리 끔 (11-05 피드백 22번) — 돌아와도 전투는 일시정지 창 그대로(직접 이어 하기)
            const away = () => {
                if (window.madOverlordGameMode !== 'v2') return;
                progress.offlineAway();
                sound.suspend();
                if (battleEngineV2.isActive) battleEngineV2.hud.setPaused(true);
            };
            const back = () => {
                if (window.madOverlordGameMode !== 'v2') return;
                sound.resume();
                progress.offlineReturn();
                refresh();
            };
            document.addEventListener('visibilitychange', () => document.hidden ? away() : back());
            window.addEventListener('mo-app-state', e => e.detail?.active ? back() : away());   // Android 앱 MainActivity onPause/onResume (WebView가 화면 가림을 못 알리는 기기 대비)
            window.addEventListener('pagehide', away);
            window.addEventListener('pageshow', () => { if (!document.hidden) back(); });
            setInterval(() => {
                if (window.madOverlordGameMode === 'v2' && !document.hidden) {
                    progress.offlineActivity();
                    refresh();
                }
            }, 60000);
            if (document.hidden) away();
        }
        this.switchScreen('menu');
        console.log('🔥 PROJECT: MAD OVERLORD ENGINE V2 ONLINE 🔥');
    }

    switchScreen(screenName) {
        if (this.currentScreen === 'battle' && screenName !== 'battle') {
            battleEngineV2.stopBattle();
        }
        // 떠나는 화면의 애니메이션 루프 정지 (메인 레이더, 연구소 미리보기)
        if (this.currentScreen === 'menu' && screenName !== 'menu') this.menuController.onLeave();
        if (this.currentScreen === 'lab' && screenName !== 'lab') this.labController.onLeave();
        if (this.currentScreen === 'select' && screenName !== 'select') this.selectController.onLeave();

        const screens = document.querySelectorAll('.screen-v2');
        screens.forEach(s => {
            s.classList.remove('active');
            s.style.opacity = '0';
        });

        const target = document.getElementById(`screen-${screenName}-v2`);
        if (target) {
            target.classList.add('active');
            setTimeout(() => {
                target.style.opacity = '1';
            }, 50);
        }

        this.currentScreen = screenName;
        gameState.currentScreen = screenName;
        track('screen_view', { screen: screenName });

        // 화면 전환 시 각 화면별 데이터 리프레시
        if (screenName === 'menu' || screenName === 'lab' || screenName === 'select') sound.playBgm('menu');
        if (screenName === 'menu') {
            this.menuController.updateDisplay();
            // 처음 한 번: 전투를 한 판 해 본 뒤 연구소 안내 (coach_v2.js)
            if (Object.keys(progress.stages).length) setTimeout(() => coach('menu_lab', '#btn-to-lab-v2, #btn-rail-lab-v2'), 700);
        } else if (screenName === 'select') {
            this.selectController.render();
        } else if (screenName === 'lab') {
            progress.tutorialDone('lab');
            this.labController.renderPartsGrid();
            this.labController.updateMvvmFeedback();
            // 처음 한 번: 장착한 파츠를 강화할 수 있으면 강화 단추 안내 (튜토리얼 파츠 고르기·구매 단계 중에는 미룸)
            if (!['compare', 'equip'].includes(progress.tutorialStep()) && progress.canUpgradeEquipped()) setTimeout(() => coach('lab_upgrade', '#btn-upgrade-v2'), 600);
        } else if (screenName === 'battle') {
            battleEngineV2.startBattle();
        }
        this.tutorialUi.update();
    }
}

// 화면 크기 맞춤: 1280x720 화면(테두리 포함 1288x728)을 창 크기에 맞게 비율 유지 확대·축소, 가운데 정렬 (ui_v2.css 'v2-fit')
const FRAME = { w: 1288, h: 728, min: 0.35, max: 2 };   // min 0.35: 휴대폰 가로 화면(높이 약 360px)에도 다 들어가게 (Android 앱, D-073)
// 휴대폰 배치 (Q-015 모바일 가독성 — 메인 시안 B · 전투 시안 A, ui_v2_mobile.css): 휴대폰·태블릿(앱이거나 손가락이 주 입력)이면 body.v2-mobile.
// 마우스가 주 입력인 PC는 창 크기와 상관없이 예전 배치 (D-099 보완 — 수정안은 휴대폰용, 예전 화면은 PC용).
// 설정 '화면 배치'(자동·휴대폰·PC)나 주소 ?ui=mobile|pc로 고정할 수 있음
const TOUCH_FIRST = matchMedia('(pointer: coarse)');
const URL_LAYOUT = new URLSearchParams(location.search).get('ui');
function fitScreens() {
    const app = document.getElementById('app');
    if (!app) return;
    const aw = app.clientWidth, ah = app.clientHeight;
    const k = Math.max(FRAME.min, Math.min(FRAME.max, aw / FRAME.w, ah / FRAME.h));
    setFitScale(k);   // 캔버스 해상도 배율 (displayRes.js — 큰 화면에서 선명하게)
    const st = document.documentElement.style;
    st.setProperty('--v2-scale', k.toFixed(4));
    st.setProperty('--v2-x', `${Math.round((aw - FRAME.w * k) / 2)}px`);
    st.setProperty('--v2-y', `${Math.round((ah - FRAME.h * k) / 2)}px`);
    st.setProperty('--v2-vw', `${(aw / k).toFixed(1)}px`);   // 창 전체 크기(설계 px) — 휴대폰 배치 메인은 20:9 폭을 다 씀
    st.setProperty('--v2-vh', `${(ah / k).toFixed(1)}px`);
    st.setProperty('--v2-aw', `${aw}px`);   // 창 크기(실제 px) — 휴대폰 배치 연구소·선택창은 게임 판 배율 없이 실제 크기로 펼침
    st.setProperty('--v2-ah', `${ah}px`);
    const pref = ['mobile', 'pc'].includes(URL_LAYOUT) ? URL_LAYOUT : settings.get('layout');
    const mobile = pref === 'mobile' || (pref !== 'pc' && (isApp() || TOUCH_FIRST.matches));
    if (document.body.classList.contains('v2-mobile') !== mobile) {
        document.body.classList.toggle('v2-mobile', mobile);
        window.dispatchEvent(new CustomEvent('v2-layout', { detail: { mobile } }));
    }
}

export function initGameRouterV2() {
    initAnalytics();
    applyVfxChoices(readVfxChoices());
    battleEngineV2.fx.vfx.style = readVfxStyle();
    preloadVfxSheets();   // 그림 프레임 이펙트(D-060) 미리 받기
    document.body.classList.add('v2-fit');
    fitScreens();
    window.addEventListener('resize', fitScreens);
    TOUCH_FIRST.addEventListener?.('change', fitScreens);   // 태블릿 겸용 노트북에서 키보드를 떼고 붙일 때
    settings.subscribe(key => { if (key === 'layout') fitScreens(); });
    runLoading().then(() => { if (isApp()) checkForUpdate({ silent: true }); });   // 캐릭터·사운드 미리 받기 (메인 화면은 뒤에서 바로 준비) → 앱이면 새 버전 확인 (D-074)
    window.madOverlordGameV2 = new GameRouterV2();
}
