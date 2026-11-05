/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 주인공 (v2)
   내구도·실드·과부하(D-028), 상태 이상(감속·기절·속박), 다리 패시브(궤도 돌진·반중력 부양·잠수화),
   팩션 패시브(괴수 재생, 히어로 흑마법 장판, 괴수 포자, 합성괴인 지진·2페이즈).
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { sound } from '../audio/sound_v2.js';
import { coach } from '../../ui_v2/coach_v2.js';
import { HERO_VFX, MECH_VFX, KAIJU_VFX, CHIMERA_VFX, BATTLE_VFX } from '../vfx/vfxDefs.js';
import { aimAt as aimOf, GROUND_SPEED } from '../bases_v2.js';
import { PHASE2, HERO, PASSIVE, LEG, PLAYER_STATUS, OVERLOAD, FOOT_B, FROST, WALK_SYNC, REACT } from './tuning.js';

export const PlayerMethods = {
    // 몬스터가 받는 피해: 실드가 있으면 먼저 흡수
    // dt: 계속 맞는 근접 피해면 프레임 시간(한 방이면 0), src: 때린 적 (가시 갑옷 되돌림)
    // attacker는 지원 약화 판정용. src(기존 반격 대상)와 분리해 원거리 반격 규칙을 바꾸지 않는다.
    damagePlayer(amount, dt, src = null, attacker = src) {
        if (this.overloadT > 0) return;   // 과부하(긴급 수리) 중에는 피해 없음
        if (this.equippedLegId === 'leg_hero_hover') amount *= 1 - LEG.hoverReduce;   // 다리 패시브 '반중력 부양'
        if (this.blizzard) amount *= 1 - FROST.blizzardGuard;                         // 서리의 무희 '눈보라 춤' 동안
        if (this.pVulnT > 0) amount *= 1 + (this.pVulnMore || 0);   // 약화 (새 기획 구역 3 그리폰 기수 성수): 받는 피해 증가
        amount = this.setIncoming(amount, dt, src);   // A·B 세트: 회피·감소·되돌림 (battle/sets.js)
        if (this.dmgTrace && amount > 0) {   // 밸런스 진단 (balance_sim --trace): 적 종류 · 피해를 준 코드 자리별 합계
            const at = (new Error().stack.split('\n')[2] || '').match(/(\w+)\.js:(\d+)/);
            const key = `${src?.type || attacker?.type || this.dmgSrcType || '-'} ${at ? at[1] + ':' + at[2] : '?'}`;
            this.dmgTrace[key] = (this.dmgTrace[key] || 0) + amount;
        }
        amount *= this.supportEnemyDamageMul(attacker);   // 협력 모드: 주인공 표식 적의 공격 약화
        if (this.supportShield > 0) {
            const absorbed = Math.min(this.supportShield, amount);
            this.supportShield -= absorbed;
            amount -= absorbed;
        }
        if (this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, amount);
            this.shieldHp -= absorbed;
            amount -= absorbed;
            this.shieldHitCd -= dt;
            if (this.shieldHitCd <= 0) {
                monsterControllerV2.shieldHit();
                sound.play('shield_hit');
                this.shieldHitCd = 0.3;
            }
            if (this.shieldHp <= 0) {
                this.shieldTimer = Infinity;
                monsterControllerV2.breakShield();
                sound.play('shield_break');
                this.createDamagePopup(this.monsterX + 40, 200, '⬢ 실드 파괴!', false);
            }
        }
        this.playerHp -= amount;
        if (amount > 0) sound.play('player_hit');   // 0.4초에 한 번까지 (sound_v2 SFX 표)
        if (amount > 0) this.hurtReact(dt);
        monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
    },

    /**
     * 주인공 회복 (최대 내구도까지). 실제로 찬 양을 돌려주고 healTaken에 더함 —
     * 구역 6 보스 '생명의 저울'이 그동안 회복한 양의 일부를 가져감 (enemies_v2.js tickMercyBoss). 과부하 뒤 긴급 수리는 회복으로 치지 않음
     */
    healPlayer(amount) {
        if (!(amount > 0)) return 0;
        const before = this.playerHp;
        this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + amount);
        const got = this.playerHp - before;
        this.healTaken += got;
        monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
        return got;
    },

    /** 팔·몸통 스킬 쿨다운 늘리기 (구역 6 보스 '파문의 종') — 필살기 게이지·전술 모듈은 그대로 */
    delaySkills(sec, label) {
        for (const slot of ['arm', 'body']) {
            if (this.skills[slot] && !this.skills[slot].ult) this.skillCd[slot] += sec;
        }
        this.createDamagePopup(this.monsterX + 30, 220, `${label}${sec}초`, false);
    },

    /** 맞으면 움찔 (Q-008 Q4, rig/reactions.js): 한 방은 바로(0.25초에 한 번까지), 계속 맞는 근접은 휘두르는 박자처럼 0.7초마다 */
    hurtReact(dt) {
        const now = this.stats.time;
        const gap = dt > 0 ? REACT.meleeEvery : REACT.hitEvery;
        if (now - (this.hurtReactAt ?? -Infinity) < gap) return;
        this.hurtReactAt = now;
        monsterControllerV2.playReaction('hurt');
    },

    // [다리 패시브 '궤도 돌진'] 처음 맞닿은 적에게 돌진 피해 + 밀쳐냄 + 잠깐 기절 (적마다 LEG.ramCd초에 한 번)
    legContact(enemy) {
        if (this.equippedLegId !== 'leg_mech_wheel' || enemy.isBuilding) return false;
        if (enemy.rammedAt != null && this.stats.time - enemy.rammedAt < LEG.ramCd) return false;
        enemy.rammedAt = this.stats.time;
        const a = aimOf(enemy);
        this.fx.play(MECH_VFX.fistHit, a.x - 10, a.b - 20);
        this.dealDamageToEnemy(enemy, this.unit() * LEG.ramDmg, false, { knock: LEG.ramKnock, stop: true });
        if (this.enemies.includes(enemy)) this.stunEnemy(enemy, LEG.ramStun);
        return true;
    },

    // [합성괴인 머리 패시브] 체력 50% 이하 자동 2페이즈
    checkPhase2() {
        if (!this.phase2 && this.equippedHeadId === 'head_chimera' && this.playerHp > 0
            && this.playerHp <= this.maxPlayerHp * PHASE2.hpRatio) {
            this.enterPhase2();
        }
    },

    // [합성괴인 머리] 체력 50% 이하 시 자동 거대화 및 실드 전개 (전투당 1회)
    enterPhase2() {
        this.phase2 = true;
        this.shieldHp = this.maxPlayerHp * PHASE2.shieldRatio;
        this.shieldTimer = Infinity;
        this.playerDps *= PHASE2.dpsMul;
        monsterControllerV2.enterPhase2();
        this.fx.play(CHIMERA_VFX.phase2Burst, this.monsterX + 35, FOOT_B);   // 변신 클립의 거대화 순간에 맞춘 충격파
        this.showAnnouncement('2PHASE // 자동 거대화 및 실드 전개!', 2000);
        this.createDamagePopup(this.monsterX + 40, 210, '⬢ 실드 전개 (최대 체력 30%)', false);
    },

    // ---- 과부하: 내구도 0이면 멈춰서 긴급 수리 — 목숨(b.lives)이 남아 있을 때만, 다 쓰면 패배 (D-028 → 11-05 피드백 21번) ----
    checkOverload(dt) {
        if (this.overloadT > 0) {
            this.overloadT -= dt;
            if (this.overloadT <= 0) {
                this.overloadT = 0;
                this.playerHp = this.maxPlayerHp * OVERLOAD.restore;
                monsterControllerV2.updateHpBar(this.playerHp, this.maxPlayerHp);
                this.createDamagePopup(this.monsterX + 30, 200, '🔧 긴급 수리 완료', false);
                sound.play('shield_on', { rate: 1.2 });
            }
            return;
        }
        if (this.playerHp > 0) return;
        this.playerHp = 0;
        if (this.livesOut) return;
        if (this.lives <= 0) { this.loseLives(); return; }
        this.lives -= 1;
        this.overloadT = OVERLOAD.sec;
        this.stats.overloads = (this.stats.overloads || 0) + 1;
        this.applyPlayerStun(OVERLOAD.sec, 'OVERLOAD', true);
        this.director.overload(OVERLOAD.sec);
        coach('battle_overload', '#hud-hp-v2');   // 처음 한 번: 과부하·긴급 수리 안내
    },

    // ---- 주인공 상태 이상 (적 공격) ----
    /** 약화: sec초 동안 받는 피해 +more (새 기획 구역 3 그리폰 기수 성수 — 방어력 약화). 냉기 저항 옵션 등 상태 이상 줄이기가 그대로 적용 */
    applyPlayerVuln(sec, more) {
        sec *= this.ccMul();
        if (sec <= 0) return;
        if (!(this.pVulnT > 0)) this.createDamagePopup(this.monsterX + 40, 205, `💧 약화 — 받는 피해 +${Math.round(more * 100)}%`, false);
        this.pVulnT = Math.max(this.pVulnT || 0, sec);
        this.pVulnMore = Math.max(this.pVulnT > sec ? this.pVulnMore || 0 : 0, more);
    },

    /** 공격력 감소: sec초 동안 적에게 주는 피해 -cut (새 기획 구역 10 스피커 드론 — battle/enemyField.js dealDamageToEnemy) */
    applyPlayerWeak(sec, cut) {
        sec *= this.ccMul();
        if (sec <= 0) return;
        if (!(this.pWeakT > 0)) this.createDamagePopup(this.monsterX + 40, 215, `🔇 소음 — 공격력 -${Math.round(cut * 100)}%`, false);
        this.pWeakT = Math.max(this.pWeakT || 0, sec);
        this.pWeakCut = cut;
    },

    applyPlayerSlow(sec, quiet = false) {
        if (this.equippedLegId === 'leg_hero_hover' || this.kitFlag('slowImmune')) {   // 다리 패시브: 감속 무시 (2차 패시브 포함)
            if (!quiet) this.createDamagePopup(this.monsterX + 40, 190, '감속 무효', false);
            return;
        }
        sec *= 1 - this.bootsCut('slow');                // 다리 패시브 '잠수화' (diver.js)
        sec *= this.ccMul();                             // 냉기 저항 옵션·방벽 발생기 (growth.js)
        if (sec <= 0) return;
        if (this.pSlowT <= 0) this.createDamagePopup(this.monsterX + 40, 190, '❄ 감속!', false);
        this.pSlowT = Math.max(this.pSlowT, sec);
        this.updatePlayerStatus();
    },

    /** force: 과부하(긴급 수리) 정지 — 옵션·면역과 상관없이 */
    applyPlayerStun(sec, label = '기절!', force = false) {
        if (!force) {
            sec *= this.ccMul();                         // 냉기 저항 옵션·방벽 발생기 (growth.js)
            if (sec <= 0) {
                this.createDamagePopup(this.monsterX + 40, 200, '⬢ 면역', false);
                return;
            }
        }
        if (this.pStunT <= 0) this.createDamagePopup(this.monsterX + 40, 200, `⚡ ${label}`, false);
        this.pStunT = Math.max(this.pStunT, sec);
        this.updatePlayerStatus();
    },

    /** 속박 (그물): 진격 불가, 공격·스킬은 가능 (구역 2 그물총 사수) */
    applyPlayerRoot(sec) {
        sec *= 1 - this.bootsCut('slow');                // 잠수화
        sec *= this.ccMul();                             // 냉기 저항 옵션·방벽 발생기 (growth.js)
        if (sec <= 0) return;
        if (this.pRootT <= 0) this.createDamagePopup(this.monsterX + 40, 200, '🕸 그물에 묶임!', false);
        this.pRootT = Math.max(this.pRootT, sec);
        this.updatePlayerStatus();
    },

    /** 뒤로 밀려남 (고철왕 자석): 거점을 향해 다시 걸어야 해서 시간 손실 */
    // ---- 걸음 맞추기 (Q2): 걷는 동안 바닥이 흐르는 빠르기 = 실제 진격 속도 ----
    /** 바닥 흐름 배율 (WALK_SYNC.ground 범위) */
    walkSyncK() {
        const k = (this.playerSpeed * this.moveMul()) / WALK_SYNC.ref;
        return Math.max(WALK_SYNC.ground[0], Math.min(WALK_SYNC.ground[1], k || 0));
    },

    /** 바닥에 놓인 것(구역·장판·잔해·시체)이 흐르는 px/초 — 배경 바닥 층과 같게 */
    groundSpeed() {
        return GROUND_SPEED * (this.groundK ?? 1);
    },

    /** 매 프레임 (battle_v2.js tickAdvance): 배경 층 CSS 애니메이션 속도와 걷기 동작 빠르기를 맞춤 (moving = 걷는 중) */
    syncWalk(moving) {
        const k = this.walkSyncK();
        this.groundK = k;
        if (!this.bgLayers) this.bgLayers = ['bg-sky-v2', 'bg-city-v2', 'bg-ground-v2'].map(id => document.getElementById(id)).filter(Boolean);
        for (const el of this.bgLayers) {
            for (const a of el.getAnimations ? el.getAnimations() : []) {
                if (Math.abs((a.playbackRate || 1) - k) > 0.01) a.updatePlaybackRate ? a.updatePlaybackRate(k) : (a.playbackRate = k);   // 지금 자리에서 빠르기만 바뀜 (튀지 않음)
            }
        }
        const anim = Math.max(WALK_SYNC.anim[0], Math.min(WALK_SYNC.anim[1], k));
        monsterControllerV2.setWalkRate(moving ? anim : 1);
    },

    knockPlayerBack(px, label) {
        if (this.equippedLegId === 'leg_kaiju_a' || this.knockImmuneBySet() || this.kitFlag('knockImmune')) {   // 2차 패시브·버프도 (kit.js)   // '단단한 껍질' 다리 · 광폭 실험체 4부위(아드레날린 중): 밀려나지 않음
            this.createDamagePopup(this.monsterX + 30, 210, '버팀!', false);
            return;
        }
        px *= this.rangedMul();                       // 다리 패시브 '자기장 방벽': 자석에 덜 끌려감
        const cut = this.bootsCut('push');               // 잠수화: 덜 밀려남
        if (cut) {
            px *= 1 - cut;
            label = '⚓ 잠수화 — 버팀';
        }
        this.monsterX = Math.max(80, this.monsterX - px);
        monsterControllerV2.setMonsterPosition(this.monsterX);
        monsterControllerV2.playReaction('knock');   // 크게 젖혀졌다 버팀 (Q4)
        this.fx.play(BATTLE_VFX.knockDust, this.monsterX + 35, FOOT_B);   // 발밑 흙먼지
        if (label) this.createDamagePopup(this.monsterX + 30, 210, label, false);
        this.director.shake(8, 350);
    },

    playerStunned() {
        return this.pStunT > 0;
    },

    /** 진격 속도 배율 (기절·속박 0, 감속 0.5) × 세트 효과 (오버드라이브·질주 본능) */
    moveMul() {
        if (this.pStunT > 0 || this.pRootT > 0) return 0;
        return (this.pSlowT > 0 ? PLAYER_STATUS.slowMove : 1) * this.moveBuffMul() * this.dollStride()   // 인형사 다리 '실 걸음' (doll.js)
            * this.gearMoveMul();                                                                          // 신속 진격 옵션·얼음 바닥 변이 (growth.js)
    },

    updatePlayerStatus() {
        const state = this.pStunT > 0 ? 'stun' : this.pRootT > 0 ? 'root' : this.pSlowT > 0 ? 'slow' : null;
        if (state === this.pStatusShown) return;
        if (state === 'stun') monsterControllerV2.playReaction('stun');          // 기절: 동작은 멈추고 비틀거림만 (Q4)
        else if (this.pStatusShown === 'stun') monsterControllerV2.stopReaction('stun');
        this.pStatusShown = state;
        monsterControllerV2.setStatusVisual(state, state === 'slow' ? PLAYER_STATUS.slowAnim : state === 'stun' ? 0 : 1);
    },

    tickPlayerStatus(dt) {
        if (this.pSlowT > 0) this.pSlowT = Math.max(0, this.pSlowT - dt);
        if (this.pStunT > 0) this.pStunT = Math.max(0, this.pStunT - dt);
        if (this.pRootT > 0) this.pRootT = Math.max(0, this.pRootT - dt);
        if (this.pVulnT > 0) this.pVulnT = Math.max(0, this.pVulnT - dt);
        if (this.pWeakT > 0) this.pWeakT = Math.max(0, this.pWeakT - dt);
        this.updatePlayerStatus();
    },

    /**
     * 팩션 패시브 (매 프레임): 괴수 머리 재생, 히어로 몸통 흑마법 장판, 괴수 다리 포자, 합성괴인 다리 지진
     * frontX: 주인공 앞면 x (이번 프레임 기준)
     */
    tickFactionPassives(dt, frontX) {
        if (this.equippedHeadId === 'head_mutant' && this.playerHp < this.maxPlayerHp) {
            const regenAmount = this.maxPlayerHp * PASSIVE.regen * dt;
            this.healPlayer(regenAmount);

            this.regenPopupTimer = (this.regenPopupTimer || 0) + dt;
            if (this.regenPopupTimer >= 1.0) {
                this.regenPopupTimer = 0;
                this.createDamagePopup(this.monsterX + 40, 180, `+${Math.round(this.maxPlayerHp * PASSIVE.regen)} REGEN`, false);
                this.fx.play(KAIJU_VFX.regen, this.monsterX + 35, FOOT_B, { follow: () => [this.monsterX + 35, FOOT_B] });
            }
        }

        if (this.equippedBodyId === 'body_hero') {
            this.curseTickTimer = (this.curseTickTimer || 0) + dt;
            const tickCursePopup = this.curseTickTimer >= HERO.curseTick;
            if (tickCursePopup) {
                this.curseTickTimer = 0;
                this.fx.pulseAura('curse');
            }

            [...this.enemies].forEach(enemy => {
                const dist = enemy.x - frontX;
                const inZone = dist >= HERO.curseZone[0] && dist <= HERO.curseZone[1];
                if (inZone !== !!enemy.cursed) {
                    enemy.cursed = inZone;          // 저주 상태 (장판 촉수 + 어두운 색 + ☠ 아이콘)
                    this.updateEnemyFilter(enemy);
                }
                if (inZone) {
                    enemy.hp -= HERO.curseDps * dt;
                    if (enemy.hpBar) {
                        enemy.hpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
                    }
                    if (tickCursePopup) {
                        // 흑마법 틱: 발밑 고리가 조여들고 머리 위 ▼ 표식이 가라앉음
                        this.fx.play(HERO_VFX.curseTick, aimOf(enemy).x, FOOT_B);
                        this.createDamagePopup(enemy.x, 140, `☠ -${Math.round(HERO.curseDps * HERO.curseTick)}`, false);
                    }
                    if (enemy.hp <= 0) this.defeatEnemy(enemy);
                }
            });
        }

        if (this.equippedLegId === 'leg_mutant') {
            this.legSkillTimer = (this.legSkillTimer || 0) + dt;
            const tickSporePopup = this.legSkillTimer >= 0.75;
            if (tickSporePopup) this.legSkillTimer = 0;

            [...this.enemies].forEach(enemy => {
                const dist = enemy.x - frontX;
                if (dist >= 0 && dist <= 220) {
                    enemy.speed = Math.min(enemy.speed, 35);
                    enemy.hp -= PASSIVE.sporeDps * dt;
                    if (enemy.hpBar) {
                        enemy.hpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
                    }
                    if (tickSporePopup) {
                        this.fx.play(KAIJU_VFX.sporeTick, aimOf(enemy).x, FOOT_B);
                        this.createDamagePopup(enemy.x, 130, `☣ -${Math.round(PASSIVE.sporeDps * 0.75)}`, false);
                    }
                    if (enemy.hp <= 0) this.defeatEnemy(enemy);
                }
            });
        }

        if (this.equippedLegId === 'leg_chimera') {
            this.legSkillTimer = (this.legSkillTimer || 0) + dt;
            const tickQuakePopup = this.legSkillTimer >= 0.75;
            if (tickQuakePopup) this.legSkillTimer = 0;

            [...this.enemies].forEach(enemy => {
                const dist = enemy.x - frontX;
                if (dist >= -20 && dist <= 200) {
                    enemy.hp -= PASSIVE.quakeDps * dt;
                    if (enemy.hpBar) {
                        enemy.hpBar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
                    }
                    if (tickQuakePopup) {
                        this.fx.play(CHIMERA_VFX.quakeTick, aimOf(enemy).x, FOOT_B);
                        this.createDamagePopup(enemy.x, 130, `💥 -${Math.round(PASSIVE.quakeDps * 0.75)}`, false);
                    }
                    if (enemy.hp <= 0) this.defeatEnemy(enemy);
                }
            });
        }
    }
};
