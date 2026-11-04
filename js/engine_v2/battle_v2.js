/* ==========================================================================
   PROJECT: MAD OVERLORD // BATTLE ENGINE (CONTINUOUS DISTANCE & BASE DESTRUCTION) (v2)
   Uses suffix -v2 to avoid overlapping with original vanilla battle engine.

   전투 흐름: 시작 → 매 프레임 루프(진격·공격·소환·각종 시간) → 승리/시간 초과 → 결과.
   승패는 기획서 방식(D-028): 제한 시간 안에 최종 기지를 부수면 승리, 못 부수면 패배(TIME OVER).
   주인공은 죽지 않는다 — 내구도(HP)가 0이 되면 과부하(OVERLOAD)로 잠시 멈춘 뒤 수리되어 다시 싸운다(피격 = 시간 손실).
   별 3개(요새 / 최종 기지 / 목표 시간 안에 클리어, D-029)와 기록 저장은 progress_v2.js

   나머지 기능은 battle/ 폴더에 나눠 두고, 이 클래스에 메서드로 붙인다 (this = 전투 엔진, 바깥에서 부르는 이름은 그대로):
     battle/tuning.js     전투 수치 (밸런스는 여기서)
     battle/player.js     주인공: 내구도·실드·과부하·상태 이상·다리/팩션 패시브
     battle/attacks.js    주인공 공격·스킬 공용 (기본 공격, 미사일·파동·드론, 쿨다운·게이지·자동 사용)
     battle/enemyField.js 전장의 적과 거점: 소환·피해·처치·상태 외형·거점·EMP 포격
     battle/allies.js     아군: 세뇌 보병·새끼 괴수·졸개
     battle/sets.js       기존 4종 A·B 세트 (D-050): 새 기본 공격·버프·지속 피해 구역·블랙홀·포탑·분신·다리 패시브
     battle/diver.js      심연의 길잡이(새 캐릭터): 고압 방수포·앵커 견인·고압 분사·심연의 손·잠수화
     battle/saint.js      봉합 성녀(새 캐릭터): 봉합 주사·3연발·생명 봉인·억지 부활·자가 봉합, 시체
     battle/frost.js      서리의 무희(새 캐릭터): 냉기·빙결, 서리 부채·초승달 참격·눈보라 춤·영원한 안식·빙판 걸음
     battle/doll.js       뒤틀린 인형사(새 캐릭터): 가위 참격·X자·인형 가족(토끼 인형)·인형 실(꼭두각시)·실 걸음
   스테이지는 stages_v2.js, 적 종류와 행동은 enemies_v2.js, 화면 연출은 ui_v2/battleDirector_v2.js
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { monsterControllerV2 } from './monster_v2.js';
import { BattleFx, ensureSkillStyles } from './battleFx.js';
import { gameTime } from './gameTime.js';
import { HERO_VFX, MECH_VFX } from './vfx/vfxDefs.js';
import { skillsForParts } from './skills_v2.js';
import { BattleHud } from '../ui_v2/battleHud_v2.js';
import { BattleDirector } from '../ui_v2/battleDirector_v2.js';
import { coach } from '../ui_v2/coach_v2.js';
import { sound } from './audio/sound_v2.js';
import { progress } from './progress_v2.js';
import { stageById, defaultStage, nextStageOf } from './stages_v2.js';
import { stageFor, difficultyOf, difficultyUnlocked, nextDifficultyOf, FINAL_STAGE_ID, DEFAULT_DIFFICULTY } from './difficulty_v2.js';
import { aimAt as aimOf } from './bases_v2.js';
import { HERO, POPUP, FOOT_B, OVERLOAD } from './battle/tuning.js';
import { PlayerMethods } from './battle/player.js';
import { AttackMethods, SKILL_AUTO_KEY } from './battle/attacks.js';
import { EnemyMethods } from './battle/enemyField.js';
import { AllyMethods } from './battle/allies.js';
import { SetMethods } from './battle/sets.js';
import { KitMethods } from './battle/kit.js';
import { DiverMethods } from './battle/diver.js';
import { SaintMethods } from './battle/saint.js';
import { FrostMethods } from './battle/frost.js';
import { DollMethods } from './battle/doll.js';
import { GrowthBattleMethods } from './battle/growth.js';
import { PetBattleMethods } from './battle/pets.js';
import { predecodeStageArt } from './enemies_v2.js';
import { runReport } from './battle/runReport.js';
import { track } from './analytics_v2.js';
import { SupportMethods } from './battle/support.js';

export class BattleEngine {
    constructor() {
        this.isActive = false;
        this.loopId = null;
        this.lastTime = 0;

        // 전장 진행 및 목표 스탯
        this.distanceTraveled = 0;
        this.maxDistance = 1000;
        this.stage = stageById('1-1');
        this.difficulty = DEFAULT_DIFFICULTY;
        this.starFlags = [false, false, false];   // 요새 / 최종 기지 / 목표 시간 안에 클리어 (D-029)
        this.pSlowT = 0;
        this.pStunT = 0;
        this.pRootT = 0;
        this.hazards = [];
        this.gasTimer = 0;

        // 아군 몬스터 스탯 및 좌표
        this.monsterX = 150; // 캐릭터 초기 좌측 X 좌표
        this.playerHp = 0;
        this.maxPlayerHp = 0;
        this.healTaken = 0;
        this.playerDps = 0;
        this.playerRange = 150;
        this.playerSpeed = 100;
        this.attackType = 'melee';

        // 거점 건물 스탯
        this.playerBaseHp = 5000;
        this.maxPlayerBaseHp = 5000;
        this.currentTargetHp = 3500;
        this.maxTargetHp = 3500;

        // 거점 생성 및 파괴 상태
        this.midBaseSpawned = false;
        this.midBaseDestroyed = false;
        this.finalBaseSpawned = false;
        this.finalBaseDestroyed = false;
        this.ruins = [];
        this.ruinHoldT = 0;

        // 전장 엔티티 및 투사체 목록
        this.enemies = [];
        this.allies = [];
        this.projectiles = [];
        this.equippedHeadId = null;
        this.equippedBodyId = null;
        this.equippedLegId = null;
        this.spawnTimer = 0;
        this.spawnInterval = 2.2;

        // DOM 컨테이너 (v2 suffix 적용)
        this.domEnemies = document.getElementById('enemies-container-v2');
        this.domProjectiles = document.getElementById('projectiles-container-v2');
        this.domDamage = document.getElementById('damage-container-v2');
        this.domPlayerBaseBar = document.getElementById('hp-player-base-v2');
        this.domEnemyBaseBar = document.getElementById('hp-enemy-base-v2');
        this.domTargetLabel = document.getElementById('enemy-target-label-v2');
        this.domDistText = document.getElementById('battle-distance-v2');
        this.domStarsText = document.getElementById('battle-stars-v2');
        this.domDmText = document.getElementById('battle-dm-count-v2');
        this.domAnnouncement = document.getElementById('battle-announcement-v2');
        this.domAnnouncementText = document.getElementById('announcement-text-v2');
        this.fx = new BattleFx('entity-layer-v2');
        ensureSkillStyles();
        this.timers = [];
        this.skills = { arm: null, body: null, head: null };
        this.skillCd = { arm: 0, body: 0 };
        this.ultGauge = 0;
        this.shieldTimer = Infinity;
        try { this.autoSkills = localStorage.getItem(SKILL_AUTO_KEY) === '1'; } catch (e) { this.autoSkills = false; }
        this.hud = new BattleHud(this);
        this.director = new BattleDirector(this);   // 인트로/경고/컷인/거점 파괴/결과 화면 연출
        this.onNavigate = null;                     // (화면 이름) => 화면 전환 (main_v2.js가 연결)
        this.runId = 0;
        this.cinematic = false;                     // 끝 연출 중: 입력/스킬 막음
        this.stats = { kills: 0, time: 0, startDm: 0, marks: {} };
        this.popupSlots = new Map();
        this.buffs = {};
        this.zones = [];
        this.setFx = {};
        this.kitBuffs = {};       // 스킬 부품 (battle/kit.js, 파츠 확장 2차)
        this.kitZones = [];
        this.kitWaves = [];
        // 리그 애니메이션 이벤트 → 전장 이펙트 (거대로봇 출격 점프 착지)
        monsterControllerV2.onRigEvent = name => {
            if (!this.isActive) return;
            if (name === 'land') this.fx.play(MECH_VFX.landing, this.monsterX + 35, FOOT_B);
            // 동작 효과음: 발걸음(거대 캐릭터 걷기 = stomp, 사람 크기 히어로 = step 가볍게), 점프 분사, 기 모으기
            if (name === 'stomp') sound.play('giant_step');
            else if (name === 'step') sound.play('giant_step', { vol: 0.45, rate: 1.5 });
            if (name === 'stomp' || name === 'step') { this.onFootstep(); this.kitOnStep(); }   // 다리 패시브 '짓밟기' (battle/sets.js) · 2차 걸음 패시브 (battle/kit.js)
            else if (name === 'thrust') sound.play('mech_thrust');
            else if (name === 'charge') sound.play('charge_up');
        };
    }

    // 전투 시작
    startBattle() {
        this.stopBattle();
        this.isActive = true;
        this.distanceTraveled = 0;
        // 난이도(D-063): 고른 난이도의 배율을 곱한 스테이지 복사본 — 전투 코드는 b.stage만 읽음
        this.difficulty = difficultyUnlocked(progress.difficulty, progress) ? progress.difficulty : DEFAULT_DIFFICULTY;
        this.stage = this.growthStage(stageFor(stageById(progress.selectedStage || defaultStage(progress).id), this.difficulty));   // + 계정 연구 DM (growth.js)
        predecodeStageArt(this.stage);   // 이 스테이지 적 그림을 미리 풂 (enemies_v2.js — 처음 나올 때 멈칫하지 않게)
        // 구역 배경 (ui_v2.css .v2-zone-1 ~ 4 · 6), 보스전은 경보 조명·불길 판 (.v2-stage-boss)
        // .v2-boss-rage(구역 4 보스 2페이즈)·.v2-crimson(구역 3 악마기사 소환 점멸)은 전투 중에 붙음
        const screen = document.getElementById('screen-battle-v2');
        screen?.classList.toggle('v2-stage-boss', !!this.stage.boss);
        if (screen) screen.dataset.difficulty = this.difficulty;   // HUD 난이도 표시 색 (ui_v2.css [data-difficulty])
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => screen?.classList.toggle(`v2-zone-${z}`, this.stage.zone === z));
        screen?.classList.remove('v2-boss-rage', 'v2-crimson');
        this.maxDistance = this.stage.distance;
        this.spawnInterval = this.stage.enemy.spawn;
        this.starFlags = [false, false, false];
        this.pSlowT = 0;
        this.pStunT = 0;
        this.pRootT = 0;
        this.pVulnT = 0;          // 약화 (새 기획 구역 3 그리폰 기수 성수 — battle/player.js applyPlayerVuln)
        this.hazards = [];        // 늪 장판 (구역 2)
        this.gasTimer = 0;
        this.gasWarned = false;
        this.spawnSilence = 0;
        this.overloadT = 0;
        this.timeUp = false;
        this.timeWarned = false;
        this.artTimer = 0;
        this.orbitalTimer = 0;   // 새 기획 구역 1 보스전 궤도 폭격 (enemyField.js tickOrbital)
        this.containerTimer = 0; // 새 기획 구역 2 보스전 폐기물 컨테이너 투하 (enemyField.js tickContainers)
        this.geyserTimer = 0;    // 새 기획 구역 5 보스전 해저 화산 간헐천 (enemyField.js tickGeysers)
        this.donorTimer = 0;     // 새 기획 구역 6 보스전 강제 헌혈 (enemyField.js tickDonors)
        this.flareTimer = 0;     // 새 기획 구역 7 보스전 조명탄 (enemyField.js tickFlares)
        this.altarTimer = 0;     // 새 기획 구역 8 보스전 탐욕의 제단 (enemyField.js tickAltars)
        this.altarsUp = false;
        this.bossShieldTimer = 0; // 새 기획 구역 9·10 보스전 폐자재 더미·세뇌 안테나 (enemyField.js tickBossShields)
        this.shieldFuseAt = 0;
        this.pWeakT = 0;          // 소음 공격력 감소 (새 기획 구역 10 스피커 드론 — battle/player.js applyPlayerWeak)
        this.artWarned = false;
        this.boss = null;
        this.bossPhase = false;   // 구역 3: 정문을 부숴 보스전에 들어감 (enemyField.js openBossGate)
        this.knightTimer = 0;     // 구역 3: 심연의 문 개방 (악마기사 소환)
        this.knightWarned = false;
        this.ruins = [];          // 요새 잔해 (다시 걸으면 바닥과 함께 흘러 나감)
        this.fontsSpawned = 0;    // 구역 6: 나온 축복 성수대 수 (stage.fonts, enemyField.js checkFonts)
        this.blessTimer = 0;
        this.ruinHoldT = 0;       // 요새가 무너지는 동안 주인공이 멈춰 지켜보는 시간
        this.monsterX = 150;
        this.playerBaseHp = 5000;
        this.currentTargetHp = 3500;
        this.maxTargetHp = 3500;
        this.midBaseSpawned = false;
        this.midBaseDestroyed = false;
        this.finalBaseSpawned = false;
        this.finalBaseDestroyed = false;
        this.enemies = [];
        this.allies = [];
        this.projectiles = [];
        this.spawnTimer = 0;
        this.phase2 = false;
        this.shieldHp = 0;
        this.shieldHitCd = 0;
        this.pendingEggs = 0;
        this.corpses = [];        // 봉합 성녀: 봉합된 채 쓰러진 적의 시체 (억지 부활로 아군)
        this.seal = null;         // 봉합 성녀: 생명 봉인 장판
        this.blizzard = null;     // 서리의 무희: 눈보라 춤
        this.stitchHealT = 0;
        this.stitchHealAcc = 0;
        this.shieldTimer = Infinity;
        this.timers = [];
        this.skillCd = { arm: 0, body: 0 };
        this.ultGauge = 0;
        this.resetSetState();     // A·B 세트 버프·구역·포탑·분신 (battle/sets.js)
        this.runId += 1;
        this.cinematic = false;
        this.ended = false;
        this.stats = { kills: 0, time: 0, startDm: gameState.darkMatter, marks: {} };   // marks = 구간 시각 (runReport.js)
        gameTime.reset();

        // 현재 장착 파츠 스탯 불러오기
        const stats = progress.statsFor(gameState.getEquippedObjects());   // 강화 레벨 반영 (D-015)
        const equippedObjs = gameState.getEquippedObjects();
        this.equippedHeadId = equippedObjs.head ? equippedObjs.head.id : null;
        this.equippedBodyId = equippedObjs.body ? equippedObjs.body.id : null;
        this.equippedLegId = equippedObjs.leg ? equippedObjs.leg.id : null;
        this.curseTickTimer = 0;
        this.legSkillTimer = 0;
        this.dotTimer = 0;
        this.equippedArmId = equippedObjs.arm ? equippedObjs.arm.id : null;
        this.maxPlayerHp = stats.hp;
        this.playerHp = stats.hp;
        this.healTaken = 0;       // 이번 전투에서 회복한 양 (player.js healPlayer — 구역 6 보스 '생명의 저울')
        this.playerDps = stats.dps;
        this.playerRange = stats.range;
        this.playerSpeed = stats.speed;
        this.attackType = equippedObjs.arm ? (equippedObjs.arm.attackType || 'melee') : 'melee';
        this.skills = skillsForParts(equippedObjs);
        this.setupGrowth(equippedObjs);   // 옵션·스킬 레벨·전술 모듈·전장 변이 (battle/growth.js, Q-006)
        this.setupKit(equippedObjs);      // 2차 세트 패시브·세트 효과·새 기본 공격 (battle/kit.js, D-071)

        if (this.equippedBodyId === 'body_chimera') {
            setTimeout(() => {
                this.spawnAllyMinion(this.monsterX + 60, 'chimera');
                this.spawnAllyMinion(this.monsterX + 110, 'chimera');
            }, 600);
        }

        // 몬스터 비주얼 렌더링 및 위치 리셋
        monsterControllerV2.renderVisuals(equippedObjs);
        track('stage_start', { stageId: this.stage.id, zone: this.stage.zone, difficulty: this.difficulty, character: monsterControllerV2.getCharacterId() });
        progress.tutorialBattleStart(this.stage.id, this.difficulty);
        if (this.autoSkills) progress.tutorialDone('combat');
        monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
        monsterControllerV2.setMonsterPosition(this.monsterX);
        monsterControllerV2.setState('walking');
        monsterControllerV2.resetSkills();
        monsterControllerV2.playIntro();   // 거대로봇: 출격 점프
        this.setupSupport();
        this.fx.start();
        if (this.equippedBodyId === 'body_hero') {
            // 흑마법 오라 (디버프 장판): 발밑에서 저주 범위 끝까지. 안에 든 적은 촉수에 발목이 잡힘
            this.fx.setAura('curse', HERO_VFX.curseAura, () => [this.frontX() + HERO.auraDx, FOOT_B],
                () => this.enemies.filter(e => e.cursed).map(e => ({ key: e.id, x: aimOf(e).x, b: FOOT_B, w: e.isBuilding ? 34 : 14 })));
        }

        // 컨테이너 초기화
        if (this.domEnemies) this.domEnemies.innerHTML = '';
        if (this.domProjectiles) this.domProjectiles.innerHTML = '';
        if (this.domDamage) this.domDamage.innerHTML = '';
        this.setupPet();

        if (this.domTargetLabel) this.domTargetLabel.textContent = '적 수비대 거점 HP (탐색 중)';
        this.updateHud();
        this.hud.setup(equippedObjs);

        // 출격 인트로 (레터박스 + 작전명 → SORTIE!) + 전투 배경음
        this.director.clear();
        const run = this.runId;
        this.director.intro(this.stage).then(() => {   // 처음 한 번: 스킬 안내 (coach_v2.js)
            if (this.isActive && this.runId === run) coach('battle_skills', '.v2-mobile #battle-hud-v2 .v2-skill-wrap, #battle-hud-v2 .v2-skills');
        });
        sound.playBgm('battle');

        this.lastTime = performance.now();
        this.loopId = requestAnimationFrame((t) => this.loop(t));
    }

    // 전투 정지 및 퇴각
    stopBattle() {
        this.isActive = false;
        this.clearPet();
        this.clearSupport();
        this.pSlowT = 0;
        this.pStunT = 0;
        this.pRootT = 0;
        this.pStatusShown = undefined;
        monsterControllerV2.setStatusVisual(null, 1);
        monsterControllerV2.setClones(0);
        monsterControllerV2.setAnimBoost(1);
        sound.stopAllLoops();
        sound.setPaused(false);
        if (this.fx) this.fx.stop();
        if (this.hud) this.hud.teardown();
        gameTime.reset();
        if (this.loopId) {
            cancelAnimationFrame(this.loopId);
            this.loopId = null;
        }
    }

    // 알림 메시지 표시 Helper
    showAnnouncement(text, duration = 2000) {
        if (!this.domAnnouncement || !this.domAnnouncementText) return;
        this.domAnnouncementText.textContent = text;
        this.domAnnouncement.classList.remove('hidden');
        setTimeout(() => {
            if (this.domAnnouncement) this.domAnnouncement.classList.add('hidden');
        }, duration);
    }

    // HUD 정보 갱신
    updateHud() {
        if (this.domDistText) this.domDistText.textContent = `${Math.round(this.distanceTraveled)}m`;
        if (this.domStarsText) {
            this.domStarsText.textContent = this.starFlags.map(f => (f ? '★' : '☆')).join('');
        }
        if (this.domDmText) this.domDmText.textContent = gameState.darkMatter.toLocaleString();
        if (this.domPlayerBaseBar) {
            const pct = Math.max(0, (this.playerBaseHp / this.maxPlayerBaseHp) * 100);
            this.domPlayerBaseBar.style.width = `${pct}%`;
        }
        if (this.domEnemyBaseBar) {
            const pct = Math.max(0, (this.currentTargetHp / this.maxTargetHp) * 100);
            this.domEnemyBaseBar.style.width = `${pct}%`;
        }
    }

    // 데미지 팝업 텍스트 생성
    // kind 'dot': 지속 피해 합계 (작고 흐리게)
    createDamagePopup(x, y, damage, isCrit = false, kind = null) {
        if (!this.domDamage) return;
        const el = document.createElement('div');
        el.className = 'damage-popup';
        el.style.left = `${x}px`;
        // 같은 자리(가로 36px 칸)에 0.35초 안에 연달아 뜨면 위로 쌓아 겹치지 않게
        const col = Math.round(x / POPUP.column);
        const now = performance.now();
        const slot = this.popupSlots.get(col);
        const n = slot && now - slot.t < POPUP.stackMs ? Math.min(slot.n + 1, 4) : 0;
        this.popupSlots.set(col, { t: now, n });
        el.style.bottom = `${y + n * POPUP.stackPx}px`;
        if (typeof damage === 'string') {
            el.textContent = damage;
            if (damage.includes('☠') || damage.includes('저주') || damage.includes('흑마법')) {
                el.style.color = '#cc33ff';
                el.style.textShadow = '0 0 8px #9900ff';
            } else if (damage.includes('REGEN') || damage.includes('회복')) {
                el.style.color = '#00ff66';
                el.style.textShadow = '0 0 8px #00ff66';
            } else if (damage.includes('☣') || damage.includes('포자') || damage.includes('점액')) {
                el.style.color = '#aaff00';
                el.style.textShadow = '0 0 8px #66aa00';
            } else if (damage.includes('💥') || damage.includes('지진') || damage.includes('분쇄')) {
                el.style.color = '#ff9900';
                el.style.textShadow = '0 0 8px #cc6600';
            }
        } else if (kind === 'dot') {
            el.textContent = Math.round(damage);
            el.style.fontSize = '13px';
            el.style.opacity = '0.8';
        } else {
            el.textContent = Math.round(damage);
            if (isCrit) {
                el.style.color = '#ffcc00';
                el.style.fontSize = '22px';
                el.textContent = `CRIT! ${Math.round(damage)}`;
            }
        }
        this.domDamage.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    // ---- 제한 시간 (D-028): 시간 안에 최종 기지를 못 부수면 패배 ----
    timeLeft() {
        return Math.max(0, this.stage.timeLimit - this.stats.time);
    }

    checkTimeLimit() {
        const left = this.timeLeft();
        if (!this.timeWarned && left <= 30) {
            this.timeWarned = true;
            this.director.alarm('TIME 30', '제한 시간 30초 — 최종 기지를 서둘러 부숴라', 2);
        }
        if (left > 0 || this.timeUp) return false;
        this.timeUp = true;
        this.cinematic = true;
        this.clearSupport();
        const run = this.runId;
        this.director.timeOver().then(() => {
            if (this.runId === run && this.isActive) this.finishBattle(false);
        });
        return true;
    }

    // 전투 종료 → 결과 화면 (승리: 최종 기지 파괴 연출 뒤 / 패배: 시간 초과 연출 뒤)
    finishBattle(victory) {
        // 세 번째 별: 목표 시간(stage.starTime) 안에 클리어 (D-029)
        if (victory && this.stats.time <= this.stage.starTime) this.starFlags[2] = true;
        const diff = this.difficulty;
        const nextDiff = nextDifficultyOf(diff);
        const wasLocked = nextDiff && !difficultyUnlocked(nextDiff.id, progress);
        const prevStars = [...progress.stage(this.stage.id, diff).stars];
        const firstClear = victory && !progress.stage(this.stage.id, diff).cleared;
        const record = progress.recordStage(this.stage.id, { stars: this.starFlags, cleared: victory, time: this.stats.time }, diff);
        const next = victory ? nextStageOf(this.stage.id) : null;
        // 마지막 스테이지(4-B)를 처음 깨면 다음 난이도가 열림 + 강화 한도 상승 (D-063)
        const unlocked = victory && this.stage.id === FINAL_STAGE_ID && wasLocked && difficultyUnlocked(nextDiff.id, progress) ? nextDiff : null;
        const loot = this.finishGrowth(victory, firstClear);   // 스킬 코어 + 파츠 드랍 (battle/growth.js)
        const result = {
            victory,
            stage: this.stage,
            loot,
            difficulty: difficultyOf(diff),
            unlocked,
            starFlags: [...this.starFlags],
            bestStars: progress.stage(this.stage.id, diff).stars,
            prevStars,
            newStars: record.newStars,
            bonus: record.bonus,
            pets: record.pets,
            next,
            timeUp: !victory && this.timeUp,
            overloads: this.stats.overloads || 0,
            distance: Math.min(this.maxDistance, this.distanceTraveled),
            kills: this.stats.kills,
            time: this.stats.time,
            dm: Math.max(0, gameState.darkMatter - this.stats.startDm),
            report: victory ? null : this.runReport()   // 패배 원인·할 일 (runReport.js)
        };
        this.stopBattle();
        setTimeout(() => { if (!this.isActive) sound.playBgm('menu', 2.5); }, 1200);
        track('stage_end', { stageId: result.stage.id, result: result.victory ? 'victory' : 'defeat', time: result.time, stars: result.starFlags.filter(Boolean).length, dm: result.dm });
        progress.tutorialBattleResult(result.stage.id, diff, victory);
        this.director.showResult(result, act => {
            if (act === 'next' && next) progress.selectStage(next.id);
            if (this.onNavigate) this.onNavigate(act === 'retry' || act === 'next' ? 'battle' : act);
        });
    }

    /** 패배 원인 알려주기: 구간 시각 + 남은 거점·보스 체력 → runReport.js */
    runReport() {
        const fin = this.enemies.find(e => e.isFinal && e.isBuilding);
        const boss = this.boss && this.boss.hp > 0 ? this.boss : null;
        return runReport({
            time: this.stats.time, marks: this.stats.marks || {},
            finalPct: fin ? fin.hp / fin.maxHp : null,
            bossPct: boss ? boss.hp / boss.maxHp : null, bossName: boss && boss.t && boss.t.name,
            distance: Math.min(this.maxDistance, this.distanceTraveled), maxDistance: this.maxDistance,
            overloads: this.stats.overloads || 0, overloadSec: OVERLOAD.sec
        });
    }

    // 메인 게임 루프 (순서가 결과에 영향을 주므로 바꿀 때 주의)
    loop(timestamp) {
        if (!this.isActive) return;
        const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000) * gameTime.scale(timestamp);   // 히트스톱/일시정지 0, 배속 적용
        this.lastTime = timestamp;

        if (this.finalBaseDestroyed || this.timeUp) {   // 승리 연출 / 시간 초과 연출 중: 전투 정지
            this.loopId = requestAnimationFrame((t) => this.loop(t));
            return;
        }

        // 시간·상태
        this.stats.time += dt;
        if (this.checkTimeLimit()) {
            this.loopId = requestAnimationFrame((t) => this.loop(t));
            return;
        }
        this.checkOverload(dt);          // player.js
        this.tickAcid(dt);               // enemyField.js
        this.tickSets(dt);               // sets.js (버프·지속 피해 구역·출혈·블랙홀·포탑·분신)
        this.tickKit(dt);                // kit.js (2차 버프·적 상태·장판·움직이는 판정·소환·변신)
        this.tickDiver(dt);              // diver.js (끌려오는 적, 심연의 손 지속 피해)
        this.tickSaint(dt);              // saint.js (봉합 표식, 생명 봉인 장판, 시체, 자가 봉합)
        this.tickFrost(dt);              // frost.js (냉기·빙결 시간, 눈보라)
        this.tickDoll(dt);               // doll.js (토끼 인형이 붙잡은 적, 꼭두각시)
        this.tickHazards(dt);            // enemyField.js (늪 장판)
        this.updateBaseArt();            // enemyField.js
        this.tickPlayerStatus(dt);       // player.js
        this.tickGrowth(dt);             // growth.js (방벽 발생기 면역 시간)
        this.tickArtillery(dt);          // enemyField.js
        this.tickSpawning(dt);           // enemyField.js
        this.tickSupport(dt);            // 독립 시전자, 10초 게임 시간·궁극기 2회, 자동 호출

        const frontX = this.frontX();    // 이번 프레임의 주인공 앞면 (진격으로 움직이기 전 값을 끝까지 씀)
        this.tickFactionPassives(dt, frontX);   // player.js
        this.flushDotPopups(dt);         // enemyField.js

        // 스킬: 예약 실행, 쿨다운/게이지/자동 사용, HUD
        this.tickTimers(dt);             // attacks.js
        this.tickSkills(dt);             // attacks.js
        if (this.autoSkills || this.skillCd.arm > 0 || this.skillCd.body > 0) progress.tutorialDone('combat');
        this.hud.update(dt);
        this.checkPhase2();              // player.js

        // 진격·공격, 아군, 적
        this.tickAdvance(dt, frontX);
        this.tickAllies(dt);             // allies.js
        this.tickPet(dt);                // pets.js (추종·작은 자동 공격)
        this.tickEnemies(dt, frontX);    // enemyField.js

        this.loopId = requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * 주인공 진격: 사거리 안에 적이 있으면 공격 / 거점이 나와 있거나 아군이 앞에서 싸우면 거기까지 직접 걸어감 /
     * 요새가 무너지는 동안 승리 자세 / 아니면 배경을 흘리며 거리 누적(거점 출현)
     */
    tickAdvance(dt, frontX) {
        let closestEnemy = null;
        let minDistance = Infinity;

        this.enemies.forEach(enemy => {
            const dist = enemy.x - frontX;
            if (dist < minDistance) {
                minDistance = dist;
                closestEnemy = enemy;
            }
        });

        const activeBuilding = this.enemies.find(e => e.isBuilding);
        this.isAttacking = !!closestEnemy && minDistance <= this.playerRange;   // 다리 패시브 '포격 고정'

        if (closestEnemy && minDistance <= this.playerRange) {
            monsterControllerV2.setState('attacking');
            this.syncWalk(false);   // 걸음 맞추기 (player.js, Q2)

            // 공격 애니메이션의 타격 시점(리그 이벤트/페이퍼돌 휘두르기 정점)에 맞춰 발사
            const hit = monsterControllerV2.consumeAttackHit();
            if (hit > 0 && !this.playerStunned()) this.fireAttack(closestEnemy, hit);

            // 거점 건물은 가까이 붙으면 직접 공격 (적 보병은 enemies_v2.js에서)
            if (minDistance <= 70 && closestEnemy.isBuilding) {
                this.damagePlayer(closestEnemy.dps * dt, dt, null, closestEnemy);
            }
        } else if (activeBuilding || this.allies.some(a => a.attacking)) {
            // 거점이 있거나 아군(소환수)이 앞에서 싸우는 중이면 그 자리까지 직접 걸어감 — 아군이 붙잡은 적은 다가오지 않으므로
            // 제자리걸음으로 거리만 쌓지 않음 (11-03 QA: 소환수가 떨어져 싸우는데 주인공은 계속 전진)
            monsterControllerV2.setState('walking-forward');
            this.syncWalk(true);
            this.monsterX += this.playerSpeed * dt * this.moveMul();
            monsterControllerV2.setMonsterPosition(this.monsterX);
        } else if (this.ruinHoldT > 0) {
            this.ruinHoldT -= dt;
            monsterControllerV2.setState('victory');
        } else {
            monsterControllerV2.setState('walking');
            this.syncWalk(true);     // 배경·바닥에 놓인 것이 실제 진격 속도로 흐름
            this.scrollRuins(dt);
            if (this.moveMul() > 0) {
                this.scrollHazards(dt);
                this.scrollZones(dt);    // sets.js: 독안개·화염·웅덩이도 바닥과 함께
                this.scrollKit(dt);      // kit.js: 2차 장판·움직이는 판정
                this.scrollFonts(dt);    // enemyField.js: 구역 6 축복 성수대
                if (this.corpses.length) this.scrollCorpses(dt);   // saint.js
            }

            if (this.monsterX > 150) {
                this.monsterX = Math.max(150, this.monsterX - 120 * dt);
                monsterControllerV2.setMonsterPosition(this.monsterX);
            }

            if (this.distanceTraveled < this.maxDistance) {
                this.distanceTraveled += this.playerSpeed * dt * 0.4 * this.moveMul();
                this.updateHud();

                if (this.distanceTraveled >= this.stage.midAt && !this.midBaseSpawned && !this.midBaseDestroyed) {
                    this.spawnMidBase();
                } else if (this.distanceTraveled >= this.stage.finalAt && !this.finalBaseSpawned) {
                    this.spawnFinalBase();
                }
                this.checkFonts();       // enemyField.js: 구역 6 축복 성수대 (stage.fonts)
            }
        }
    }
}

// battle/ 폴더의 기능을 메서드로 붙임. 이름이 겹치면 시작할 때 바로 알 수 있게 오류
function attachMethods(target, groups) {
    for (const [file, methods] of Object.entries(groups)) {
        for (const name of Object.keys(methods)) {
            if (name in target) throw new Error(`battle_v2: '${name}' 메서드 이름이 겹침 (${file})`);
            target[name] = methods[name];
        }
    }
}
attachMethods(BattleEngine.prototype, {
    'battle/player.js': PlayerMethods,
    'battle/attacks.js': AttackMethods,
    'battle/enemyField.js': EnemyMethods,
    'battle/allies.js': AllyMethods,
    'battle/sets.js': SetMethods,
    'battle/kit.js': KitMethods,
    'battle/diver.js': DiverMethods,
    'battle/saint.js': SaintMethods,
    'battle/frost.js': FrostMethods,
    'battle/doll.js': DollMethods,
    'battle/growth.js': GrowthBattleMethods,
    'battle/pets.js': PetBattleMethods,
    'battle/support.js': SupportMethods
});

export const battleEngineV2 = new BattleEngine();
