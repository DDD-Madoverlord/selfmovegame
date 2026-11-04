/* ==========================================================================
   PROJECT: MAD OVERLORD // GAME TIME (v2)
   전투 시간 흐름을 한곳에서 관리한다. 전투 로직(battle_v2), 캐릭터 리그(rigAvatar), 전장 이펙트(battleFx)
   루프가 모두 scale(now)를 곱해 경과 시간을 계산한다.
   - 히트스톱: 강한 타격 순간 아주 잠깐 멈춰 타격감을 줌 (절대 시각 기준이라 루프마다 따로 빼지 않음)
   - 슬로모션: 필살기 컷인·거점 파괴·쓰러짐 순간 잠깐 느리게 (실제 시간 기준, 끝날 때 서서히 원래 속도로)
   - 일시정지 / 배속(1x, 2x): 전투 HUD 버튼
   ========================================================================== */

export const gameTime = {
    freezeUntil: 0,
    cooldownUntil: 0,
    slowFrom: 0,
    slowUntil: 0,
    slowScale: 1,
    paused: false,
    speed: 1,
    onSlow: null,   // (scale, sec) — 사운드 매니저가 느린 화면 동안 소리를 먹먹하게 (audio/sound_v2.js)

    /** sec초 동안 멈춤. 연타로 계속 멈추지 않도록 멈춤이 끝난 뒤 짧은 재사용 대기 */
    hitStop(sec = 0.05, cooldown = 0.12) {
        const now = performance.now();
        if (now < this.cooldownUntil) return;
        this.freezeUntil = now + sec * 1000;
        this.cooldownUntil = this.freezeUntil + cooldown * 1000;
    },

    /** 실제 시간 sec초 동안 scale배로 느리게 (마지막 30%는 원래 속도로 돌아옴). 더 느린 요청이 우선 */
    slowMo(scale = 0.3, sec = 1) {
        const now = performance.now();
        if (now < this.slowUntil && scale > this.slowScale) return;
        this.slowScale = scale;
        this.slowFrom = now;
        this.slowUntil = now + sec * 1000;
        if (this.onSlow) this.onSlow(scale, sec);
    },

    slowFactor(now) {
        if (now >= this.slowUntil) return 1;
        const u = (now - this.slowFrom) / (this.slowUntil - this.slowFrom);
        const back = u > 0.7 ? (u - 0.7) / 0.3 : 0;
        return this.slowScale + (1 - this.slowScale) * back * back;
    },

    frozen(now = performance.now()) {
        return this.paused || now < this.freezeUntil;
    },

    /** 경과 시간 배율: 멈춤(히트스톱/일시정지)이면 0, 아니면 배속 × 슬로모션 */
    scale(now = performance.now()) {
        return this.frozen(now) ? 0 : this.speed * this.slowFactor(now);
    },

    /** 전투 시작/종료 시 초기화 (메뉴 화면 캐릭터가 멈춘 채 남지 않도록) */
    reset() {
        this.paused = false;
        this.speed = 1;
        this.freezeUntil = 0;
        this.cooldownUntil = 0;
        this.slowUntil = 0;
        this.slowScale = 1;
    }
};
