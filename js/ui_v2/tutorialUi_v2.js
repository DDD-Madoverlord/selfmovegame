/* 조작을 가리지 않는 진행 줄. 표시를 미뤄도 실제 행동 기록은 계속된다. */
import { progress } from '../engine_v2/progress_v2.js';
import { TUTORIAL_STEPS } from '../engine_v2/tutorial_v2.js';
import { coach } from './coach_v2.js';

// 단계별 안내 (2026-11-03 세부: 스킬 키·필살기, 요새·최종 기지 = 별·승리, 부위·능력치 비교, 강화)
const GOALS = {
    sortie: '캐릭터는 알아서 걷고 싸워요. 먼저 출격해 보세요.',
    combat: '스킬은 1·2 키나 단추, 필살기는 게이지가 차면 3. AUTO를 켜면 알아서 써요.',
    result: '요새를 부수면 별 1개, 최종 기지를 부수면 승리. 얻은 DM으로 다음 전투를 준비해요.',
    lab: '연구소에서 부위(머리·몸통·팔·다리)마다 파츠를 바꿔 보세요.',
    compare: '새 파츠를 고르면 가운데 능력치 칸에 바뀌는 값이 보여요. 레이저 팔을 추천해요.',
    equip: '개조 확정으로 구매와 장착을 마쳐요. 같은 파츠를 강화하면 레벨마다 더 강해져요.',
    resortie: '새 파츠로 다음 열린 판에 도전하세요. 패배했다면 같은 판 재도전도 좋아요.'
};
// 휴대폰 배치(Q-015)에서는 한 줄로 짧게
const SHORT = {
    sortie: '출격해 보세요', combat: '스킬을 눌러 보세요 · AUTO는 자동', result: '요새 = 별 1개 · 기지 = 승리',
    lab: '연구소에서 파츠 바꾸기', compare: '새 파츠를 골라 능력치 비교', equip: '개조 확정으로 장착', resortie: '새 파츠로 다시 출격'
};
const ANCHORS = { offline: '#btn-menu-offline-v2', pet: '#btn-menu-support-v2, #btn-rail-pets-v2', shop: '#btn-menu-shop-v2, #btn-rail-shop-v2' };

export function tutorialBlocked() {
    return document.hidden || !!document.querySelector('.v2-loading, .v2-settings, .v2-mobile-web__portrait:not([hidden]), .v2-mobile-web__banner:not([hidden])');
}

export class TutorialUi {
    constructor(router) {
        this.router = router;
        this.row = document.createElement('div');
        this.row.id = 'tutorial-progress-v2';
        this.row.className = 'v2-tutorial';
        this.row.hidden = true;
        this.row.innerHTML = '<span role="status"></span><button data-tutorial="skip">건너뛰기</button><button data-tutorial="claim">200 DM 받기</button>';
        this.row.querySelector('[data-tutorial="skip"]').addEventListener('click', () => { progress.skipTutorial(); this.update(); });
        this.row.querySelector('[data-tutorial="claim"]').addEventListener('click', () => { progress.claimTutorialReward(); this.update(); });
        this.timer = setInterval(() => this.update(), 250);
        this.update();
    }

    update() {
        const screen = document.querySelector(`#screen-${this.router.currentScreen}-v2.active`);
        const blocked = tutorialBlocked() || window.madOverlordGameMode !== 'v2';
        if (blocked || !screen) {
            this.row.hidden = true;
            if (this.intro) { this.intro.remove(); this.intro = null; }
            return;
        }
        if (this.row.parentElement !== screen) screen.appendChild(this.row);
        const t = progress.tutorialState(), step = progress.tutorialStep();
        const reward = !progress._tutorialReplay && t.status === 'complete' && !t.rewardClaimed;
        this.row.hidden = !step && !reward;
        this.row.querySelector('[data-tutorial="skip"]').hidden = !step;
        this.row.querySelector('[data-tutorial="claim"]').hidden = !reward;
        if (step) {
            const short = document.body.classList.contains('v2-mobile');
            let goal = short ? SHORT[step] : GOALS[step];
            if (['compare', 'equip'].includes(step) && !progress.tutorialCanBuy()) {
                goal = short ? 'DM 부족 — 보유 파츠 강화 뒤 재도전' : 'DM이 부족하면 보유 파츠 장착·강화 뒤 재도전할 수 있어요.';
            }
            this.row.querySelector('span').textContent = `${short ? '안내' : '첫 성장 안내'} ${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length} · ${goal}`;
            progress.tutorialShown();
        } else if (reward) this.row.querySelector('span').textContent = '첫 성장 완료';
        // 보이는 창만 셈 — 숨겨 둔 창(휴대폰 웹 '가로로 돌려 주세요' 등)이 있어도 안내는 뜸
        const dialogOpen = [...document.querySelectorAll('[role="dialog"]')].some(d => d.getClientRects().length);
        if (this.router.currentScreen !== 'menu' || document.querySelector('.v2-coach') || dialogOpen) return;
        // 피로도가 켜진 뒤 처음 메인 화면 (노말 1-B를 깬 뒤, Q-049) — 첫 성장 안내 중이어도 (1-B 뒤까지 이어질 수 있어서). 자동 검사(피로도 끔)에서는 안 뜸
        if (progress.stamina?.on && !progress.staminaExempt() && !progress.hasTip('stamina_intro')) {
            const el = coach('stamina_intro', '#screen-menu-v2 .v2-chip--stamina');
            if (el) { this.intro = el; return; }
        }
        if (step) return;
        const id = progress.nextTutorialIntro();
        if (id) {
            const el = coach(`${id}_intro`, ANCHORS[id], { remember: false });
            if (el) { this.intro = el; progress.markTutorialIntro(id); }
        }
    }
}
