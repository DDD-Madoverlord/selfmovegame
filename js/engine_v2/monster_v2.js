/* ==========================================================================
   PROJECT: MAD OVERLORD // MONSTER RENDERER & ANIMATION CONTROLLER (v2)
   Delegates DOM styling and clear/render tasks to the Renderer module.
   ========================================================================== */

import { settings } from './settings_v2.js';
import { SpriteAnimator } from './spriteAnimator_v2.js';
import { renderer } from './renderer.js';
import { RigAvatar, rigConfigFor } from './rig/rigAvatar.js';

// ---- 리그 캐릭터 배치 (거대로봇/거대괴수/타락 히어로/합성괴인) ----
// 전투: 캐릭터 박스(.monster-entity 140x160, 박스 하단 = 지면, index.css) 기준으로 캔버스를 배치
const MONSTER_BOX_BOTTOM = 60;   // index.css .monster-entity { bottom: 60px }
const MONSTER_BOX_HEIGHT = 160;  // index.css .monster-entity { height: 160px }
const BATTLE_RIG = {
    width: 420, height: 340,     // 캔버스 크기 (하단 40px은 지면 아래: 그림자/먼지 영역)
    left: -140, bottom: -40,     // 박스 기준 캔버스 위치
    rootX: 175, rootY: 300,      // 캔버스 안 발 중앙 위치 → 박스 x 35 (앞쪽이 적 정지선과 맞닿음)
    scale: 0.235                 // 원본 약 940px → 약 220px
};
// 캐릭터별 전투 배율 (히어로는 사람 크기라 조금 작게)
// 심연의 길잡이: 사람 크기(그림 약 780px) → 히어로보다 조금 큰 약 195px / 봉합 성녀: 1.6m(그림 약 650px) → 약 155px
// 서리의 무희: 2m(그림 약 830px) → 히어로와 비슷한 약 185px
// 뒤틀린 인형사: 1.8m(머리~발 약 610px) → 약 160px, 등 뒤 십자틀까지 약 190px
const BATTLE_RIG_SCALE = { mech: 0.235, kaiju: 0.235, hero: 0.215, chimera: 0.235, diver: 0.25, saint: 0.235, frost: 0.225, doll: 0.26,
    architect: 0.235, broadcaster: 0.24 };   // 새 캐릭터 5·6 (D-079): 그림 속 키 약 730·700px → 성녀(1.6m)와 같은 화면 키 약 170px
const HP_BAR = { width: 80, gap: 16 };  // 머리 위 체력바 (index.css .monster-hp-container 폭)
// 메뉴(메인 화면 대기실): 캐릭터마다 캔버스 안에 들어오도록 배율/위치 자동 맞춤 (최대 0.34)
// (좌우에 부위 설명이 붙으므로 가로 여백을 넉넉히)
const MENU_RIG = { width: 440, height: 300, rootX: 220, rootY: 288, scale: 0.34, fit: { x: 58, y: 12 }, shadow: false, fitCss: true };
// 휴대폰 메인: 능력치·파츠 칸 없이 캐릭터만 크게 — 배율 상한을 올리고 여백(PC 부위 설명 자리)을 줄임 (11-05 피드백 1번)
const MENU_FIT_MOBILE = { scale: 0.7, fit: { x: 10, y: 6 } };
const PAPERDOLL_CANVAS = { width: 330, height: 248 };

// 몬스터 상태 → 애니메이션
const RIG_ANIM = { 'walking': 'walk', 'walking-forward': 'walk', 'attacking': 'attack', 'victory': 'victory' };
const PAPERDOLL_ANIM = { 'walking': 'walk', 'walking-forward': 'idle', 'attacking': 'attack', 'victory': 'idle' };
const PAPERDOLL_SWING_SEC = (Math.PI * 2) / 6; // renderer.drawPaperDoll 공격 팔 휘두르기 주기

export class MonsterController {
    constructor(suffix = '-v2') {
        this.suffix = suffix;
        this.initDOM();
    }

    initDOM() {
        const s = this.suffix;
        // 인게임 도트(Pixel Art) 부위별 DOM 요소
        this.domMonster = document.getElementById(`player-monster${s}`);
        this.domHpFill = document.getElementById(`hp-player-monster${s}`);
        this.domViewport = document.getElementById(`battle-viewport${s}`);

        // 베이킹된 스프라이트 프레임 재생기 (walk/attack)
        const spriteCanvas = document.getElementById(`player-sprite-canvas${s}`);
        this.spriteAnimator = spriteCanvas ? new SpriteAnimator(spriteCanvas) : null;
        if (this.spriteAnimator) {
            this.spriteAnimator.play('walk');
        }

        // 메인 메뉴 캐릭터 프리뷰용 재생기 (idle 대기 모션)
        const menuCanvas = document.getElementById(`menu-sprite-canvas${s}`);
        this.menuAnimator = menuCanvas ? new SpriteAnimator(menuCanvas) : null;
        if (this.menuAnimator) {
            this.menuAnimator.play('idle');
        }

        // 리그 캐릭터 몸통 장착 시 페이퍼돌 대신 사용하는 뼈대 리그 (같은 캔버스를 번갈아 사용)
        this.spriteCanvas = spriteCanvas;
        this.menuCanvas = menuCanvas;
        this.rigBattle = spriteCanvas
            ? new RigAvatar(spriteCanvas, {
                ...BATTLE_RIG, shakeTarget: this.domViewport,
                onResize: () => { if (this.useRig) this._placeHpBar(); },  // 2페이즈 거대화 후 체력바 위치
                onEvent: (name, data) => {
                    if (name === 'cast' && this._castCb) {                  // 스킬 시전 해방 순간
                        const cb = this._castCb;
                        this._castCb = null;
                        cb();
                    }
                    if (this.onRigEvent) this.onRigEvent(name, data);       // 전투 엔진 연결 (착지 이펙트 등)
                }
            })
            : null;
        this.rigMenu = menuCanvas ? new RigAvatar(menuCanvas, MENU_RIG) : null;
        // 휴대폰·PC 배치가 바뀌면 메인 캐릭터 배율·여백도 바꿔 다시 맞춤 (main_v2.js fitScreens → 'v2-layout')
        const applyMenuFit = mobile => {
            if (!this.rigMenu) return;
            Object.assign(this.rigMenu.opts, mobile ? MENU_FIT_MOBILE : { scale: MENU_RIG.scale, fit: MENU_RIG.fit });
            if (this.rigMenu.layout) this.rigMenu._fitToCanvas(this.rigMenu.layout);
        };
        applyMenuFit(document.body.classList.contains('v2-mobile'));
        window.addEventListener('v2-layout', e => applyMenuFit(e.detail.mobile));
        // 화면 흔들림 설정 (끄면 착지/사격 흔들림도 없음)
        const applyShake = () => { if (this.rigBattle) this.rigBattle.shakeScale = settings.get('shake') ? 1 : 0; };
        applyShake();
        settings.subscribe(key => { if (key === 'shake') applyShake(); });
        this.useRig = false;
        this.monsterX = 150;
        this.attackStartedAt = 0;
        this.paperdollHits = 0;

        this.pixelParts = {
            head: document.getElementById(`pixel-head${s}`),
            body: document.getElementById(`pixel-body${s}`),
            arm: document.getElementById(`pixel-arm${s}`),
            leg: document.getElementById(`pixel-leg${s}`)
        };

        // 메뉴 전용 Live2D 프리뷰 부위별 DOM 요소
        this.menuLive2dParts = {
            head: document.getElementById(`menu-prev-head${s}`),
            body: document.getElementById(`menu-prev-body${s}`),
            arm: document.getElementById(`menu-prev-arm${s}`),
            leg: document.getElementById(`menu-prev-leg${s}`)
        };

        // 연구소 키오스크 Live2D 프리뷰 부위별 DOM 요소
        this.labLive2dParts = {
            head: document.getElementById(`lab-prev-head${s}`),
            body: document.getElementById(`lab-prev-body${s}`),
            arm: document.getElementById(`lab-prev-arm${s}`),
            leg: document.getElementById(`lab-prev-leg${s}`)
        };

        this.currentState = null; // 'walking' | 'walking-forward' | 'attacking' | 'victory'
    }

    // 캐릭터 DOM 좌표 직접 제어 (거점 출현 시 앞으로 전진)
    setMonsterPosition(x) {
        this.monsterX = x;
        if (this.domMonster) {
            this.domMonster.style.left = `${x}px`;
        }
    }

    // 부위별 파츠 데이터로 모든 렌더링 화면(도트 전장 + Live2D 메뉴/연구소) 업데이트
    // character: 몸통이 비었을 때 그릴 캐릭터 (메인 화면의 선택창 캐릭터, D-051)
    renderVisuals(partsObj, character = null) {
        for (const slot in partsObj) {
            const part = partsObj[slot];
            if (!part) continue;

            // 1. 인게임 도트(Pixel Art) 전장 부위 스타일 적용
            if (this.pixelParts[slot] && part.pixelStyle) {
                renderer.applyStyle(this.pixelParts[slot], part.pixelStyle);
            }

            // 2. 메인 메뉴 Live2D 부위 스타일 적용
            if (this.menuLive2dParts[slot] && part.live2dStyle) {
                renderer.applyStyle(this.menuLive2dParts[slot], part.live2dStyle);
            }

            // 3. 연구소 키오스크 Live2D 부위 스타일 적용
            if (this.labLive2dParts[slot] && part.live2dStyle) {
                renderer.applyStyle(this.labLive2dParts[slot], part.live2dStyle);
            }

            // 4. 격리 렌더러의 페이퍼돌 레이어 실시간 스왑 연동 (changePart)
            const src = part.src || `assets/sprites/parts/${slot}_mock.png`;
            const animType = part.animType || (slot === 'leg' && part.id === 'leg_mech_wheel' ? 'sprite' : 'pivot');

            if (slot === 'arm') {
                renderer.changePart('arm', {
                    right: part.rightSrc || src,
                    left: part.leftSrc || src
                }, animType);
            } else if (slot === 'leg') {
                const legSrc = animType === 'sprite' ? 'assets/sprites/parts/leg_track_mock.png' : (part.rightSrc || src);
                renderer.changePart('leg', {
                    right: legSrc,
                    left: legSrc
                }, animType);
            } else {
                renderer.changePart(slot, src, animType);
            }
        }

        // 5. 몸통 캐릭터(없으면 character)가 리그 캐릭터면 뼈대 리그로 전환, 아니면 기존 페이퍼돌 유지
        this.applyRigMode(rigConfigFor(partsObj, character));
    }

    // 메뉴/전투 캔버스를 리그 ↔ 페이퍼돌로 전환
    // config: { character: 'mech'|'kaiju'|'hero'|'chimera', arm?: 'cannon'|'fist' } | null
    applyRigMode(config) {
        const use = !!(config && this.rigBattle);
        if (use) {
            const id = config.character;
            this.rigBattle.setCharacter(id, BATTLE_RIG_SCALE[id]);
            if (this.rigMenu) this.rigMenu.setCharacter(id);
            // 파츠별 색 (같은 캐릭터 변형 파츠 / 비운 부위)
            this.rigBattle.setPartFilters(config.filters);
            if (this.rigMenu) this.rigMenu.setPartFilters(config.filters);
            // A·B 세트 부위 그림 (D-050) + 새 캐릭터 강화 부위 그림 (D-044)
            this.rigBattle.setVariants(config.variants);
            this.rigBattle.setUpgrades(config.upgrades);
            if (this.rigMenu) {
                this.rigMenu.setVariants(config.variants);
                this.rigMenu.setUpgrades(config.upgrades);
            }
            this.rigBattle.quietFire = !!config.quietFire;   // 팔 shotFx가 총구 연출을 그림 (D-118)
            if (config.arm) {
                this.rigBattle.setArm(config.arm);
                if (this.rigMenu) this.rigMenu.setArm(config.arm);
            }
            this.rigBattle.ready.then(() => {
                if (this.useRig) this._placeHpBar();
            });
        }
        if (use === this.useRig) return;
        this.useRig = use;

        const hpBar = this.domMonster ? this.domMonster.querySelector('.monster-hp-container') : null;
        if (use) {
            if (this.spriteAnimator) this.spriteAnimator.pause();
            if (this.menuAnimator) this.menuAnimator.pause();
            renderer.applyStyle(this.spriteCanvas, {
                position: 'absolute', left: `${BATTLE_RIG.left}px`, bottom: `${BATTLE_RIG.bottom}px`,
                width: `${BATTLE_RIG.width}px`, height: `${BATTLE_RIG.height}px`
            });
            this._placeHpBar();
            this.rigBattle.setMode(RIG_ANIM[this.currentState] || 'walk');
            this.rigBattle.start();
            if (this.rigMenu) {
                this.rigMenu.setMode('idle');
                this.rigMenu.start();
            }
        } else {
            this.rigBattle.stop();
            if (this.rigMenu) this.rigMenu.stop();
            renderer.applyStyle(this.spriteCanvas, { position: '', left: '', bottom: '', width: '', height: '' });
            if (hpBar) renderer.applyStyle(hpBar, { top: '', left: '' });
            for (const canvas of [this.spriteCanvas, this.menuCanvas]) {
                if (!canvas) continue;
                canvas.width = PAPERDOLL_CANVAS.width;
                canvas.height = PAPERDOLL_CANVAS.height;
            }
            if (this.spriteAnimator) {
                this.spriteAnimator.play(PAPERDOLL_ANIM[this.currentState] || 'walk');
                this.spriteAnimator.resume();
            }
            if (this.menuAnimator) this.menuAnimator.resume();
        }
    }

    // 체력바를 리그 캐릭터 머리 위로 (캐릭터마다 키가 달라 리그 레이아웃에서 계산)
    _placeHpBar() {
        const hpBar = this.domMonster ? this.domMonster.querySelector('.monster-hp-container') : null;
        const top = this.rigBattle && this.rigBattle.headTop();
        if (!hpBar || !top) return;
        const canvasTop = MONSTER_BOX_HEIGHT - BATTLE_RIG.bottom - BATTLE_RIG.height; // 박스 기준 캔버스 윗변
        renderer.applyStyle(hpBar, {
            top: `${Math.round(canvasTop + top.y - HP_BAR.gap)}px`,
            left: `${Math.round(BATTLE_RIG.left + top.x - HP_BAR.width / 2)}px`
        });
    }

    _playAnim(state) {
        if (state === 'attacking') {
            this.attackStartedAt = performance.now();
            this.paperdollHits = 0;
        }
        if (this.useRig) {
            this.rigBattle.setMode(RIG_ANIM[state]);
        } else if (this.spriteAnimator) {
            this.spriteAnimator.play(PAPERDOLL_ANIM[state]);
        }
    }

    // 몬스터 애니메이션 및 배경 패럴랙스 상태 제어
    setState(newState) {
        if (this.currentState === newState) return;
        this.currentState = newState;

        const s = this.suffix;
        const stateText = document.getElementById(`monster-state-text${s}`);
        const actionLog = document.getElementById(`battle-action-log${s}`);

        if (newState === 'walking') {
            this._playAnim(newState);
            if (this.domMonster) {
                this.domMonster.classList.remove('attacking', 'victory');
                this.domMonster.classList.add('walking');
            }
            if (this.domViewport) {
                this.domViewport.classList.remove('attacking', 'walking-forward', 'victory');
                this.domViewport.classList.add('walking');
            }
            if (stateText) {
                stateText.textContent = '진격 중 (WALKING)';
                stateText.className = 'text-neon-green';
            }
            if (actionLog) {
                actionLog.textContent = '사정거리 내 적을 탐색하며 배경을 가로질러 전진합니다.';
            }
        } else if (newState === 'walking-forward') {
            this._playAnim(newState);
            if (this.domMonster) {
                this.domMonster.classList.remove('attacking', 'victory');
                this.domMonster.classList.add('walking');
            }
            if (this.domViewport) {
                this.domViewport.classList.remove('walking', 'attacking', 'victory');
                this.domViewport.classList.add('walking-forward');
            }
            if (stateText) {
                stateText.textContent = '거점 접근 중 (ADVANCING)';
                stateText.className = 'text-neon-green';
            }
            if (actionLog) {
                actionLog.textContent = '적 거점이 포착되었습니다! 배경을 멈추고 사거리까지 캐릭터가 직접 돌격합니다.';
            }
        } else if (newState === 'attacking') {
            this._playAnim(newState);
            if (this.domMonster) {
                this.domMonster.classList.remove('walking', 'victory');
                this.domMonster.classList.add('attacking');
            }
            if (this.domViewport) {
                this.domViewport.classList.remove('walking', 'walking-forward', 'victory');
                this.domViewport.classList.add('attacking');
            }
            if (stateText) {
                stateText.textContent = '교전 중 (ATTACKING)';
                stateText.className = 'text-neon-purple';
            }
            if (actionLog) {
                actionLog.textContent = '전진 및 배경 이동을 멈추고 화력을 집중하여 적을 공격합니다!';
            }
        } else if (newState === 'victory') {
            this._playAnim(newState);
            if (this.domMonster) {
                this.domMonster.classList.remove('walking', 'attacking');
                this.domMonster.classList.add('victory');
            }
            if (this.domViewport) {
                this.domViewport.classList.remove('walking', 'walking-forward', 'attacking');
                this.domViewport.classList.add('victory');
            }
            if (stateText) {
                stateText.textContent = '★★ 승리 포즈 (VICTORY HURRAH) ★★';
                stateText.style.color = '#ffcc00';
            }
            if (actionLog) {
                actionLog.textContent = '최종 핵심 기지 분쇄! 오버로드가 정면을 바라보며 만세 스쿼트 포효를 터뜨립니다!';
            }
        }
    }

    /**
     * 마지막 호출 이후 기본 공격이 적중한 양 (1 = 전투 엔진 기본 1타, 0 = 적중 없음)
     * - 리그: 공격 클립의 fire/impact 이벤트 (캐논은 발당 0.2)
     * - 페이퍼돌: 팔 휘두르기 정점마다 1타 (페이퍼돌 모드는 프레임 번호가 증가하지 않아 시간으로 계산)
     */
    consumeAttackHit() {
        if (this.currentState !== 'attacking') return 0;
        if (this.useRig) return this.rigBattle.consumeHit();
        const t = (performance.now() - this.attackStartedAt) / 1000;
        const swings = Math.floor(t / PAPERDOLL_SWING_SEC + 0.5);
        if (swings > this.paperdollHits) {
            this.paperdollHits = swings;
            return 1;
        }
        return 0;
    }

    // ---- 팩션 스킬 연출 (리그 캐릭터만. 페이퍼돌이면 전투 효과만 적용되고 외형 변화 없음) ----
    resetSkills() {
        this._castCb = null;   // 지난 전투에서 기다리던 시전 효과는 버림 (새 전투의 'cast'에 엉뚱하게 터지지 않게)
        if (this.useRig) this.rigBattle.resetSkills();
    }

    // 주인공 상태 이상 표시: 'slow'(푸른 기운, 동작 느리게) | 'stun'(노란 전기, 동작 멈춤) | null
    setStatusVisual(state, animScale = 1) {
        this.statusAnim = animScale;
        if (this.rigBattle) this.rigBattle.timeScale = animScale * (this.animBoost ?? 1);
        const c = this.spriteCanvas;
        if (!c) return;
        c.classList.toggle('v2-st-slow', state === 'slow');
        c.classList.toggle('v2-st-stun', state === 'stun');
        c.classList.toggle('v2-st-root', state === 'root');
    }

    /** 동작 빠르기 배율 (오버드라이브 = 공격 속도 +50%: 공격 동작의 타격 이벤트가 빨리 옴). 상태 이상 배율과 곱함 */
    /** 반응 동작 (맞음·밀림·기절 — rig/reactions.js, Q4). 리그가 없으면 생략 */
    playReaction(name) {
        if (this.useRig && this.rigBattle) this.rigBattle.react(name);
    }

    stopReaction(name) {
        if (this.useRig && this.rigBattle) this.rigBattle.stopReact(name);
    }

    /** 걷기 동작 빠르기 (실제 진격 속도에 맞춤, battle/player.js syncWalk) — 걷는 동작에만 붙음 */
    setWalkRate(k = 1) {
        if (this.rigBattle) this.rigBattle.walkScale = k;
    }

    setAnimBoost(mul = 1) {
        this.animBoost = mul;
        if (this.rigBattle) this.rigBattle.timeScale = (this.statusAnim ?? 1) * mul;
    }

    /**
     * 그림자 분신 (그림자 마도사 필살기, D-050): 주인공 뒤로 gap px씩 반투명 보라 분신 count명.
     * 리그 캔버스를 매 프레임 복사해 그림 (분신은 공격 동작까지 주인공과 똑같이 움직임). count 0이면 없앰
     */
    setClones(count, gap = 55) {
        (this.clones || []).forEach(c => c.remove());
        this.clones = [];
        if (this.cloneRaf) cancelAnimationFrame(this.cloneRaf);
        this.cloneRaf = null;
        const parent = this.spriteCanvas && this.spriteCanvas.parentNode;
        if (!count || !parent || !this.useRig) return;
        for (let i = 1; i <= count; i++) {
            const c = document.createElement('canvas');
            c.className = 'v2-clone';
            c.width = BATTLE_RIG.width;
            c.height = BATTLE_RIG.height;
            Object.assign(c.style, {   // 리그 캔버스와 같은 자리에서 뒤로 gap px씩 (같은 부모, 앞에 두어 주인공 뒤에 그려짐)
                position: 'absolute', left: `${BATTLE_RIG.left - gap * i}px`, bottom: `${BATTLE_RIG.bottom}px`,
                width: `${BATTLE_RIG.width}px`, height: `${BATTLE_RIG.height}px`, pointerEvents: 'none',
                opacity: String(0.5 - i * 0.08),
                filter: 'brightness(0.55) saturate(0.4) sepia(0.6) hue-rotate(220deg) drop-shadow(0 0 8px rgba(200, 110, 255, 0.9))'
            });
            parent.insertBefore(c, this.spriteCanvas);
            this.clones.push(c);
        }
        const copy = () => {
            const src = this.spriteCanvas;
            for (const c of this.clones) {
                if (c.width !== src.width || c.height !== src.height) { c.width = src.width; c.height = src.height; }   // 해상도 배율(displayRes)을 따라감
                const ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
                ctx.drawImage(src, 0, 0);
            }
            this.cloneRaf = requestAnimationFrame(copy);
        };
        copy();
    }

    // 패배 연출: 쓰러진 순간 그대로 멈춤 (on=false면 다시 재생)
    freezeRig(on) {
        if (!this.useRig || !this.rigBattle) return;
        if (on) this.rigBattle.stop();
        else if (!this.rigBattle.running) this.rigBattle.start();
    }

    // 출격 점프 (점프 클립이 있는 캐릭터: 거대로봇)
    playIntro() {
        if (!this.useRig) return;
        this.rigBattle.ready.then(() => {
            if (this.useRig) this.rigBattle.playOnce('jump');
        });
    }

    enterPhase2() {
        this.flushCast();
        if (this.useRig) this.rigBattle.enterPhase2();
    }

    /** 스킬 시전 동작(clip, 기본 cast)을 재생하고 클립의 'cast' 이벤트 순간 onRelease 호출. 그 동작이 없으면 즉시 호출.
     *  앞 시전이 아직 'cast'를 기다리는 중이면 그 효과를 먼저 내보내고 새 시전을 시작 (동작이 끊겨 효과가 사라지지 않게) */
    playCast(onRelease, clip = 'cast') {
        this.flushCast();
        if (this.useRig && this.rigBattle.playOnce(clip)) {
            this._castCb = onRelease;
        } else {
            onRelease();
        }
    }

    /** 기다리던 시전 효과를 바로 내보냄 (다른 스킬 동작이 시전 동작을 끊을 때) */
    flushCast() {
        if (!this._castCb) return;
        const cb = this._castCb;
        this._castCb = null;
        cb();
    }

    getCharacterId() {
        return this.useRig && this.rigBattle.character ? this.rigBattle.character.id : null;
    }

    shieldHit() {
        if (this.useRig) this.rigBattle.shieldHit();
    }

    breakShield() {
        if (this.useRig) this.rigBattle.breakShield();
    }

    shieldOn(color) {
        if (this.useRig) this.rigBattle.shieldOn(color ? color : undefined);
    }

    shieldOff() {
        if (this.useRig) this.rigBattle.shieldOff();
    }

    /** 스킬 사용 모션 (리그가 없으면 생략) — 시전 동작을 끊으면 기다리던 효과를 먼저 내보냄 */
    playSkillAnim(kind) {
        this.flushCast();
        if (this.useRig) this.rigBattle.playSkillAnim(kind);
    }

    /** HUD 초상화: 리그 캐릭터 머리 이미지와 이름 (페이퍼돌이면 null) */
    getPortrait() {
        if (!this.useRig || !this.rigBattle.character) return null;
        const c = this.rigBattle.character;
        return { id: c.id, name: c.name, src: `${c.assetDir}head.png` };
    }

    // 리그 캔버스 좌표 → entity-layer 기준 {x: left px, bottom: px}
    _toEntity(p) {
        if (!p) return null;
        return {
            x: this.monsterX + BATTLE_RIG.left + p[0],
            bottom: MONSTER_BOX_BOTTOM + BATTLE_RIG.bottom + (BATTLE_RIG.height - p[1])
        };
    }

    // 리그 총구 위치. 리그가 아니면 null → 전투 엔진 기본 위치 사용
    getMuzzlePoint() {
        return this.useRig ? this._toEntity(this.rigBattle.muzzlePoint()) : null;
    }

    // 리그 소켓 위치 (드론 발사구 등). 리그가 아니거나 해당 소켓이 없으면 null
    getSocketPoint(socket, bone) {
        if (!this.useRig || !this.rigBattle.skeleton || !this.rigBattle.skeleton.byName[bone]) return null;
        if (!this.rigBattle.skeleton.layout.sockets[socket]) return null;
        return this._toEntity(this.rigBattle.socketPoint(socket, bone));
    }

    // 체력바 업데이트
    updateHpBar(currentHp, maxHp) {
        if (!this.domHpFill) return;
        const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
        this.domHpFill.style.width = `${pct}%`;
        
        if (pct < 30) {
            this.domHpFill.style.background = '#ff0055';
        } else if (pct < 60) {
            this.domHpFill.style.background = '#ffcc00';
        } else {
            this.domHpFill.style.background = '#00ff66';
        }
    }
}

export const monsterControllerV2 = new MonsterController('-v2');
