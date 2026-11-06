/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 전장의 적과 거점 (v2)
   적 소환·이동(종류별 행동은 enemies_v2.js), 피해·처치·보상, 피격 반응과 상태 외형(기절·감속·저주·산성),
   거점(요새·최종 기지) 출현·파손·잔해(그림은 bases_v2.js), 보스전 EMP 포격·유독 가스,
   구역 2 장애물: 바리케이드(방벽병이 세움, 부숴야 진격), 늪 장판(오물 투척병, 위에 있으면 감속).
   구역 3·4 (D-056): 거점 사격(stage.defense), 정문 → 보스전(boss.afterBase)·심연의 문 개방(boss.knights), 슬라임 분열(split).
   구역 6 (D-078): 축복 성수대(stage.fonts)·헌금 기사 오라 = 근처 적 받는 피해 감소(축복), 그림자 집행자 은신 피해 감소,
                   봉인된 약창고(요새)를 부수면 주인공 회복(stage.midHeal).
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { gameState } from '../../engine/state.js';
import { monsterControllerV2 } from '../monster_v2.js';
import { gameTime } from '../gameTime.js';
import { sound } from '../audio/sound_v2.js';
import { KAIJU_VFX, BATTLE_VFX, ZONE_VFX, ELITE_VFX } from '../vfx/vfxDefs.js';
import { spawnEnemy, updateEnemy, pickType, killReward, ENEMY_TYPES, ELITE_AFFIXES } from '../enemies_v2.js';
import { coach } from '../../ui_v2/coach_v2.js';
import { icon } from '../../ui_v2/icons.js';
import { KIT_STATUS_ICON, KIT_STATUS_TINT } from './kit.js';
import { BASE_STATE, baseArt, baseArtName, baseSize, aimAt as aimOf, dressBase, setBaseState } from '../bases_v2.js';
import { HERO, HIT_REACT, ACID, POPUP, FOOT_B, BASE_X, ENEMY_REACT } from './tuning.js';

// 축복 성수대 (구역 6): 체력 hp × 스테이지 적 체력 배율, 성수대에서 range px 안 적은 받는 피해 cut 감소 (헌금 기사 오라와 겹치면 곱함)
export const FONT = { hp: 1000, range: 400, cut: 0.25, x: 900, xNarrow: 640, every: 0.2 };

// 적 상태 외형 (우선순위: 기절 > 감속 > 저주) + 체력바 옆 상태 아이콘
const ENEMY_TINT = {
    puppet: 'saturate(0.6) brightness(1.1) drop-shadow(0 0 6px #5ae6f0)',   // 뒤틀린 인형사 꼭두각시
    frozen: 'saturate(0.35) brightness(1.3) hue-rotate(170deg) drop-shadow(0 0 6px #9fe0ff)',   // 서리의 무희 빙결
    stun: 'grayscale(0.7) brightness(1.15) drop-shadow(0 0 6px #ffe066)',
    slow: 'drop-shadow(0 0 6px #b050ff) saturate(0.55) brightness(0.9)',
    curse: 'brightness(0.72) saturate(0.7) drop-shadow(0 0 4px rgba(170, 80, 255, 0.9))',
    bless: 'drop-shadow(0 0 6px rgba(255, 215, 110, 0.95))',   // 구역 6 축복 (성수대·헌금 기사)
    ...KIT_STATUS_TINT   // 2차 상태 (공포·잠·화상·취약 — battle/kit.js)
};
const STATUS_ICON = { curse: 'curse', slow: 'slow', stun: 'stun', acid: 'acid', root: 'net', bleed: 'thorns', abyss: 'hand', stitch: 'stitch',
    frozen: 'snow', chill: 'snow', puppet: 'puppet', bless: 'shield', ...KIT_STATUS_ICON };
const PUDDLE_STICK = 1.5;   // 늪을 밟은 뒤 감속이 남는 시간(초)

export const EnemyMethods = {
    // ---- 적 소환 ----
    // 스테이지의 적 비중(mix)대로 종류를 고르고, 확률로 엘리트 (enemies_v2.js)
    spawnMinion(typeId = null, opts = {}) {
        if (!this.domEnemies) return null;
        const building = this.enemies.find(e => e.isBuilding);
        const x = opts.x ?? (building ? building.x - 30 : (window.innerWidth > 1000 ? 980 : 700));
        const type = typeId || pickType(this.stage.enemy.mix);
        const elite = opts.elite ?? Math.random() < (this.stage.elite || 0);
        const first = spawnEnemy(this, type, { x, elite });
        // 대열 (새 기획 구역 1 진압 방패병 3열 횡대): 소환 주기로 나올 때만 같은 종류가 뒤에 squad.gap 간격으로 함께 (보통 병사)
        const squad = !typeId && ENEMY_TYPES[type]?.squad;
        if (squad) for (let i = 1; i < squad.n; i++) spawnEnemy(this, type, { x: x + i * squad.gap, elite: false });
        return first;
    },

    /** 소환 주기마다 적 하나 (최대 수까지). EMP 포격 뒤에는 잠시 소환 중단 */
    tickSpawning(dt) {
        if (this.spawnSilence > 0) {
            this.spawnSilence -= dt;   // EMP 뒤 소환 중단
            return;
        }
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval && this.enemies.filter(e => !e.isBuilding && !e.isBarricade).length < this.stage.enemy.max) {
            this.spawnTimer = 0;
            this.spawnMinion();
        }
    },

    /** 적 이동·공격 (기절한 적은 멈춤), 감속·기절 시간 줄이기. frontX: 주인공 앞면 x */
    tickEnemies(dt, frontX) {
        this.enemies.forEach(enemy => {
            if (this.supportHeld(enemy)) return; // 지원 소유의 구속: 주인공 상태 시간을 덮어쓰지 않음
            if (enemy.slowT > 0) {
                enemy.slowT -= dt;
                if (enemy.slowT <= 0) this.updateEnemyFilter(enemy);
            }
            if (enemy.stunT > 0) {
                enemy.stunT -= dt;
                if (enemy.stunT <= 0) this.updateEnemyFilter(enemy);
                return;   // 기절: 이동/공격 없음
            }
            if (this.kitEnemyHeld(enemy, dt)) return;   // 공포: 뒤로 물러남 (battle/kit.js)
            if (!enemy.isBuilding && !enemy.isBarricade) {   // 이동·공격·종류별 능력
                this.dmgSrcType = enemy.type;   // 밸런스 진단용 (player.js dmgTrace)
                updateEnemy(this, enemy, dt, frontX);
                this.dmgSrcType = null;
            }
            this.kitWallHold(enemy);   // 강철 방벽 앞에서 멈춤 (battle/kit.js)
        });
        this.tickBaseDefense(dt, frontX);
        this.tickBlessings(dt);
    },

    // ---- 구역 6 축복: 축복 성수대·헌금 기사 근처 적은 받는 피해 감소 (FONT.every초마다 다시 셈 → e.blessMul) ----
    tickBlessings(dt) {
        this.blessTimer = (this.blessTimer || 0) + dt;
        if (this.blessTimer < FONT.every) return;
        this.blessTimer = 0;
        const fonts = this.enemies.filter(e => e.isFont && e.hp > 0);
        const auras = this.enemies.filter(e => e.t && e.t.aura && e.hp > 0);
        if (!fonts.length && !auras.length && !this.blessedAny) return;
        this.blessedAny = false;
        this.enemies.forEach(e => {
            if (e.isBuilding || e.isBarricade) return;
            let mul = 1;
            if (fonts.some(f => Math.abs(aimOf(f).x - aimOf(e).x) <= FONT.range)) mul *= 1 - FONT.cut;
            const k = auras.find(a => a !== e && Math.abs(a.x - e.x) <= a.t.aura.range);
            if (k) mul *= 1 - k.t.aura.cut;
            e.blessMul = mul;
            const on = mul < 1;
            if (on) this.blessedAny = true;
            if (on !== !!e.blessed) {
                e.blessed = on;
                this.updateEnemyFilter(e);
            }
        });
    },

    /** 축복 성수대 (stage.fonts = 나오는 거리 m): 그 거리를 지나면 오른쪽에 하나 — 바리케이드처럼 부숴야 지나감, 걸을 때는 바닥과 함께 다가옴 */
    checkFonts() {
        const list = this.stage.fonts;
        if (!list || this.fontsSpawned >= list.length || this.distanceTraveled < list[this.fontsSpawned]) return;
        this.fontsSpawned += 1;
        this.spawnFont(window.innerWidth > 1000 ? FONT.x : FONT.xNarrow);
    },

    spawnFont(x) {
        const f = this.spawnBarricade(x, Math.round(FONT.hp * this.stage.enemy.hp), '✨ 축복 성수대 — 근처 적 피해 감소!', 'barricade');
        if (!f) return null;
        f.isFont = true;
        f.type = 'font';
        f.t = { name: '축복 성수대' };
        f.dom.classList.add('v2-font');
        const aura = document.createElement('div');
        aura.className = 'v2-font__aura';
        aura.style.width = `${FONT.range * 2}px`;
        aura.style.left = `${f.size.w / 2 - FONT.range}px`;
        f.dom.prepend(aura);
        this.blessTimer = FONT.every;   // 바로 축복을 셈
        return f;
    },

    /** 걷는 동안 성수대도 바닥과 함께 다가옴 (battle_v2.js tickAdvance) */
    scrollFonts(dt) {
        this.enemies.forEach(e => {
            if (!e.isFont) return;
            e.x -= this.groundSpeed() * dt;
            if (e.dom) e.dom.style.left = `${e.x}px`;
        });
    },

    /**
     * 거점 사격 (구역 3·4, stage.defense[kind]): 주인공이 range 안에 오면 every초마다 꼭대기에서 쏨
     * — 심문소 통제탑 화살·마법 / 유기질 벽 독액(+ 독 웅덩이). 구역 1·2 거점은 붙어야 피해 (tickAdvance)
     */
    tickBaseDefense(dt, frontX) {
        const def = this.stage.defense;
        if (!def) return;
        this.enemies.forEach(e => {
            const d = e.isBuilding && e.hp > 0 && def[e.kind];
            if (!d) return;
            e.defCd = (e.defCd ?? d.every * 0.5) + dt;
            if (e.x - frontX > d.range || e.defCd < d.every) return;
            e.defCd = 0;
            const s = e.size || { w: 100, h: 200 };
            const muzzle = baseArt(e.art)?.muzzle;   // 그림에 포구가 있으면 거기서 (새 기획 거점 — 보안 게이트 포탑 등)
            const from = muzzle ? { x: e.x + muzzle[0], bottom: muzzle[1] } : { x: e.x + s.w * 0.45, bottom: FOOT_B + Math.min(s.h, 280) * 0.85 };
            const tx = this.monsterX + 60;
            if (!e.defShown) {   // 처음 쏠 때 한 번 무엇인지 표시
                e.defShown = true;
                this.createDamagePopup(e.x + 10, from.bottom + 10, d.label, false);
            }
            sound.play(d.puddle ? 'zone_venom' : 'zone_arrow', { rate: 1.25, vol: 0.4 });
            const onArrive = () => {
                if (!this.isActive) return;
                if (d.hitFx) this.fx.play(ZONE_VFX[d.hitFx], tx, d.puddle ? FOOT_B + 10 : 120);
                const k = this.rangedMul();   // 자기장 방벽: 원거리 피해·효과 절반
                this.damagePlayer(d.dmg * this.stage.enemy.dps * k, 0, null, e);
                if (d.puddle) this.addPuddle(tx - d.puddle.width / 2, d.puddle.width, d.puddle.sec * k,
                    d.puddle.fire ? { fire: d.puddle.fire * this.stage.enemy.dps } : {});   // 새 기획 구역 6 소각로: 불 장판
            };
            if (d.puddle) this.fx.launchOrb(from, () => ({ x: tx, b: FOOT_B + 6 }), d.color, 0.5, onArrive, null);
            else this.fx.launchNeedle(from, () => ({ x: tx, b: 120 }), onArrive, { color: d.color, dur: 0.3, sfx: null });
        });
    },

    // ---- 피해와 처치 ----
    // 적 또는 거점 건물에 데미지 적용 및 소멸 처리
    // react: { knock(넉백 배율), stop(히트스톱), pierce(방어 무시 비율) } — 몬스터/스킬의 직접 타격일 때만 (지속 피해는 생략)
    // react.dot: 지속 피해 — 피격 반응 없이 합산해 0.5초마다 숫자 표시
    dealDamageToEnemy(enemy, damage, isCrit, react = null) {
        if (!enemy || !this.enemies.includes(enemy) || enemy.hp <= 0) return;
        const supportSource = react?.source === 'support';
        const modified = this.supportModifyDamage(enemy, damage, react);
        damage = modified.damage;
        if (damage > 0) enemy.lastHit = this.stats.time;
        const purified = this.isPurified(enemy);   // 정화 파동: 엘리트 효과 꺼짐 (growth.js)
        if (damage > 0) {
            const gear = supportSource ? react.supportGear : this.gear;
            damage *= this.gearDamageMul(enemy, gear);    // 파츠 옵션(엘리트·보스·공성) · 철벽 변이 (growth.js)
            damage *= this.kitTargetMul(enemy);     // 2차: 취약 상태 · 패시브 조건 (battle/kit.js)
            if (react && !react.dot) this.kitWake(enemy);   // 잠든 적은 맞으면 깸
            if (gear?.healBlock) enemy.healBlockUntil = this.stats.time + gear.healBlock;   // 치유 방해 옵션
        }
        if (this.pWeakT > 0 && damage > 0) damage *= 1 - (this.pWeakCut || 0);   // 소음 (새 기획 구역 10 스피커 드론): 공격력 감소
        if (enemy.invulnerable && damage > 0) {   // 폐자재 더미·세뇌 안테나가 서 있는 동안 보스 무적 (새 기획 구역 9·10)
            damage = 0;
            if (this.stats.time - (enemy.invulPopAt ?? -Infinity) >= 0.8) { enemy.invulPopAt = this.stats.time; this.createDamagePopup(enemy.x, 200, '🛡 무적', false); }
        }
        if (enemy.armor && damage > 0) damage *= 1 - enemy.armor * (1 - modified.pierce);   // 방패병·보스: 받는 피해 감소 (인형사 가위·협력 인형사 표식은 일부 무시)
        if (enemy.barrierT > 0 && damage > 0) damage *= 1 - enemy.t.barrier.cut;
        if (enemy.blessMul < 1 && damage > 0) damage *= enemy.blessMul;              // 구역 6 축복 (성수대·헌금 기사)
        if (enemy.hidden && damage > 0) damage *= 1 - enemy.t.stealth.cut;          // 그림자 집행자 은신
        if (!supportSource && enemy.frozenT > 0 && damage > 0) damage *= 1 + this.shatterBonus();   // 서리의 무희 다리 '빙판 걸음' (frost.js)
        if (enemy.affixes?.includes('iron') && !purified && damage > 0) {
            damage *= 1 - ELITE_AFFIXES.iron.cut;
            if (this.stats.time - (enemy.ironFxAt ?? -Infinity) >= 0.3) {
                enemy.ironFxAt = this.stats.time;
                this.fx.play(ELITE_VFX.ironSpark, enemy.x + 38, FOOT_B + 55);
            }
        }
        if (enemy.shield > 0 && damage > 0) {
            const sm = 1 + ((supportSource ? react.supportGear : this.gear)?.shieldDmg || 0);
            const absorbed = Math.min(enemy.shield, damage * sm);
            enemy.shield -= absorbed;
            damage -= absorbed / sm;
            if (enemy.shield <= 0) {
                this.fx.play(ELITE_VFX.shieldBreak, enemy.x + 38, FOOT_B + 55);
                this.createDamagePopup(enemy.x, 180, '보호막 깨짐', false);
                this.updateEnemyFilter(enemy);
            }
        }
        const typeThorns = enemy.t && enemy.t.thorns;   // 새 기획 구역 8 화로 방패병: 종류 자체가 근접 화상 반사
        if (!supportSource && ((enemy.affixes?.includes('thorns') && !purified) || typeThorns) && react && !react.dot && damage > 0) {   // 협력 공격은 반사 안 받음
            const thorns = enemy.affixes?.includes('thorns') && !purified ? ELITE_AFFIXES.thorns : typeThorns;
            const cut = 1 - (this.gear?.reflectCut || 0);   // 반사 차단 옵션
            this.damagePlayer(Math.min(damage * thorns.reflect, this.maxPlayerHp * thorns.cap) * cut, 0);
            if (this.stats.time - (enemy.thornsFxAt ?? -Infinity) >= 0.3) {
                enemy.thornsFxAt = this.stats.time;
                this.fx.play(ELITE_VFX.thornsSpark, enemy.x + 38, FOOT_B + 55);
            }
        }
        if (supportSource) this.stats.supportDamage = (this.stats.supportDamage || 0) + Math.min(Math.max(0, enemy.hp), damage);
        enemy.hp -= damage;
        if (enemy.kitThreadT > 0 && damage > 0 && !react?.share) this.kitThreadShare(enemy, damage);   // 붉은 실 (battle/kit.js)
        if (enemy.isBuilding && damage > 0 && this.stats.time - (enemy.baseHitFxAt ?? -Infinity) >= 0.25) { enemy.baseHitFxAt = this.stats.time; this.fx.play(BATTLE_VFX.baseHit, aimOf(enemy).x, aimOf(enemy).b); }
        if (!supportSource && react && !react.dot) this.lifesteal(damage);
        if (react && !react.dot && enemy.hp > 0) this.hitReact(enemy, react);
        if (react && react.dot) {
            enemy.dotAcc = (enemy.dotAcc || 0) + damage;
        } else if (damage > 0) {
            const popupX = enemy.isBuilding ? aimOf(enemy).x - 24 : enemy.x;
            const popupY = enemy.isBuilding ? aimOf(enemy).b + 20 + Math.random() * 40 : 110 + Math.random() * 30;
            this.createDamagePopup(popupX, popupY, damage, isCrit);
        }

        if (enemy.hpBar) {
            const pct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
            enemy.hpBar.style.width = `${pct}%`;
        }

        if (enemy.isBuilding) {
            this.currentTargetHp = Math.max(0, enemy.hp);
            this.updateHud();
        }

        if (enemy.hp <= 0) this.defeatEnemy(enemy);
    },

    /** 체력 0 이하가 된 적·거점 치우기. 체력을 직접 깎는 기본 파츠 지속 피해(player.js 저주·포자·진동)도 이걸 부름 —
     *  dealDamageToEnemy는 이미 0 이하인 적을 받지 않으므로(협력 모드, 30a7ddf) 거기에 0 피해를 넘기면 적이 안 치워져 무적처럼 남음 (11-02 QA) */
    defeatEnemy(enemy) {
        if (!this.enemies.includes(enemy)) return;   // 같은 프레임에 두 번 처리되지 않게
        if (!enemy.isBuilding && !enemy.isBarricade) this.fx.play(BATTLE_VFX.enemyDefeat, enemy.x + 38, FOOT_B, { scale: enemy.boss ? 1.8 : 1 });
        // 거점 건물은 파괴 연출이 무너뜨린 뒤 치움, 적은 뒤로 넘어지며 사라짐 (Q4)
        if (enemy.dom && !enemy.isBuilding) this.enemyFall(enemy);
        this.enemies = this.enemies.filter(e => e.id !== enemy.id);
        if (enemy.isBuilding) this.onBaseDestroyed(enemy);
        else this.onEnemyKilled(enemy);
    },

    /** 거점 파괴: 요새 = 별 1·보상·잔해 / 최종 기지 = 별 2·보상 → 남은 적 패주 → 승리 연출 → 결과 */
    onBaseDestroyed(enemy) {
        if (enemy.isFinal && this.stage.boss && this.stage.boss.afterBase && !this.bossPhase) {
            this.openBossGate(enemy);   // 구역 3: 정문을 부수면 보스전
            return;
        }
        if (enemy.isFinal) {
            this.finalBaseDestroyed = true;
            this.clearSupport();
            this.starFlags[1] = true;
            gameState.addDarkMatter(this.stage.reward.final);
            this.updateHud();

            // 남은 적 병사는 흩어지며 사라짐
            this.enemies.forEach(e => {
                if (!e.dom) return;
                e.dom.classList.add('v2-rout');
                setTimeout(() => e.dom.remove(), 600);
            });
            this.enemies = [];
            this.cinematic = true;
            monsterControllerV2.setState('victory');

            // 연쇄 폭발 → 대폭발 → MISSION COMPLETE → 결과 화면
            const run = this.runId;
            this.director.baseDestroyed(enemy, true).then(() => {
                if (this.runId === run && this.isActive) this.finishBattle(true);
            });
        } else {
            this.midBaseDestroyed = true;
            (this.stats.marks ||= {}).midDown = this.stats.time;
            this.starFlags[0] = true;
            this.ruinHoldT = BASE_STATE.ruinHold;
            gameState.addDarkMatter(this.stage.reward.mid);
            if (this.stage.midHeal) {   // 구역 6 봉인된 약창고: 잠긴 약이 풀려 회복
                const got = this.healPlayer(this.maxPlayerHp * this.stage.midHeal);
                this.fx.play(ZONE_VFX.holyHeal, this.monsterX + 35, FOOT_B);
                this.createDamagePopup(this.monsterX + 30, 230, `💊 잠긴 약이 풀림 +${Math.round(got)} 회복`, false);
            }
            if (this.domTargetLabel) this.domTargetLabel.textContent = '적 수비대 거점 HP (진격 중)';
            this.director.baseDestroyed(enemy, false);
            this.updateHud();
        }
    },

    // ---- 구역 3 보스전: 정문 → 보스 (stage.boss.afterBase) ----
    /** 정문(최종 기지) 붕괴: 별 2·보상 → 잔해는 요새처럼 흘러감 → 잠시 뒤 보스 출현. 승리는 보스를 쓰러뜨릴 때 */
    openBossGate(gate) {
        this.bossPhase = true;
        (this.stats.marks ||= {}).gateDown = this.stats.time;
        this.starFlags[1] = true;
        gameState.addDarkMatter(this.stage.reward.final);
        gate.isFinal = false;   // collapseBase가 요새 잔해처럼 바닥과 함께 흘려보냄
        this.ruinHoldT = BASE_STATE.ruinHold;
        const unit = ENEMY_TYPES[this.stage.boss.unit];
        const gateName = this.stage.boss.gate || '최종 거점';   // 3-B만 '정문' (stages_v2.js boss.gate)
        this.director.baseDestroyed(gate, false, { stamp: [this.stage.boss.gate ? 'GATE BROKEN' : 'BASE DOWN', `${gateName} 붕괴 — ${unit.name}이(가) 모습을 드러낸다`] });
        const x = gate.x + (gate.size ? gate.size.w / 2 : 60) - 40;
        this.schedule(1.3, () => {
            if (!this.isActive || this.finalBaseDestroyed) return;
            this.director.bossCard(this.stage.boss.unit, unit, '쓰러뜨리면 승리');   // 보스 등장 카드 (battleDirector_v2.js)
            this.boss = this.spawnMinion(this.stage.boss.unit, { x, elite: false });   // 체력은 HUD 보스 막대 (battleHud_v2.js)
            this.knightTimer = 0;
            this.knightWarned = false;
            this.updateHud();
        });
        this.updateHud();
    },

    /** 정문 뒤 보스 격파 = 승리: 남은 적 패주 → 격파 연출 → MISSION COMPLETE → 결과 */
    bossVictory(boss) {
        this.finalBaseDestroyed = true;   // 전투 정지 (loop)
        this.clearSupport();
        this.enemies.forEach(e => {
            if (!e.dom || e.isBuilding) return;
            e.dom.classList.add('v2-rout');
            setTimeout(() => e.dom.remove(), 600);
        });
        this.enemies = [];
        this.cinematic = true;
        monsterControllerV2.setState('victory');
        const run = this.runId;
        this.director.baseDestroyed({ x: boss.x - 20, size: { w: 120, h: 200 } }, true, { stamp: ['MISSION COMPLETE', `${boss.t.name} 격파`] }).then(() => {
            if (this.runId === run && this.isActive) this.finishBattle(true);
        });
    },

    /** 심연의 문 개방 (구역 3 보스전 기믹, stage.boss.knights): 보스가 있는 동안 every초마다 경보 → 엘리트 소환 + 배경 진홍 점멸 */
    tickKnights(dt) {
        const k = this.stage.boss && this.stage.boss.knights;
        if (!k || !this.bossPhase || !this.boss) return;
        this.knightTimer += dt;
        if (!this.knightWarned && this.knightTimer >= k.every - k.warn) {
            this.knightWarned = true;
            this.director.alarm('심연의 문 개방', `${k.warn.toFixed(0)}초 뒤 ${ENEMY_TYPES[k.unit].name} 소환`, k.warn);
        }
        if (this.knightTimer < k.every) return;
        this.knightTimer = 0;
        this.knightWarned = false;
        const x = Math.min(this.boss.x + 50, 1150);
        this.director.flash('#a0102a', 600, 0.45);
        this.crimsonPulse(1.4);
        for (let i = 0; i < (k.n || 1); i++) {   // 새 기획 구역 3: 악마기사 2기를 고기 방패로
            this.fx.play(ZONE_VFX.abyssGate, x - i * 60 + 38, FOOT_B + 40);
            this.spawnMinion(k.unit, { x: x - i * 60, elite: true });
        }
    },

    /** 배경을 잠깐 진홍빛으로 (ui_v2.css .v2-crimson) */
    crimsonPulse(sec) {
        const screen = document.getElementById('screen-battle-v2');
        if (!screen) return;
        screen.classList.add('v2-crimson');
        clearTimeout(this.crimsonTimer);
        this.crimsonTimer = setTimeout(() => screen.classList.remove('v2-crimson'), sec * 1000);
    },

    /** 적 처치: 처치 수·보상, 보스 격파 연출, 타락 히어로 머리면 확률로 세뇌 징집 */
    onEnemyKilled(enemy) {
        if (enemy.isBarricade) {   // 바리케이드: 터지며 사라짐 (처치 수·징집 없음)
            const a = aimOf(enemy);
            if (enemy.isFont) {   // 축복 성수대: 축복이 꺼짐 (금빛 물보라)
                this.fx.play(ZONE_VFX.fontBreak, a.x, FOOT_B + 20);
                this.createDamagePopup(enemy.x, 200, '축복이 꺼졌다', false);
                this.blessTimer = FONT.every;
            }
            this.fx.play(BATTLE_VFX.baseBlast, a.x, a.b, { scale: 0.8 });
            sound.play('base_blast', { rate: 1.3, vol: 0.7, x: this.fx.panX(a.x) });
            gameState.addDarkMatter(Math.round(this.stage.reward.kill * 0.5));
            this.updateHud();
            return;
        }
        this.stats.kills += 1;
        sound.play('enemy_die', { x: this.fx.panX(aimOf(enemy).x) });
        this.onGrowthKill(enemy);   // 스킬 코어 · 핏빛 달 변이 (growth.js)
        this.onSetKill(enemy);      // 레어 세트 4부위 효과 (sets.js — 독안개 산성 옮기기)
        this.kitOnKill(enemy);      // 2차 패시브·세트 효과 (kit.js)
        const purified = this.isPurified(enemy);   // 정화된 채 쓰러지면 독 구름·폭발 없음
        if (enemy.stitchT > 0) this.addCorpse(enemy);   // 봉합 성녀: 봉합된 채 쓰러지면 시체 (battle/saint.js)
        gameState.addDarkMatter(killReward(this, enemy));
        if (enemy.affixes?.includes('toxic') && !purified) {
            const toxic = ELITE_AFFIXES.toxic;
            const w = toxic.width * (this.mutator?.toxicWidth || 1), sec = toxic.sec * (this.mutator?.toxicMul || 1);   // 맹독 변이
            this.addPuddle(enemy.x + 38 - w / 2, w, sec);
            this.fx.play(ELITE_VFX.toxicCloud, enemy.x + 38, FOOT_B + 10);
        }
        const acid = enemy.t && enemy.t.deathAcid;   // 광폭화 융합수 (새 기획 구역 4): 쓰러지면 산성 혈액 웅덩이
        if (acid && !this.finalBaseDestroyed) {
            this.addPuddle(enemy.x + 38 - acid.width / 2, acid.width, acid.sec);
            this.fx.play(ZONE_VFX.gooSplat, enemy.x + 38, FOOT_B + 30, { scale: 1.3 });
        }
        if (enemy.affixes?.includes('volatile') && !purified) {
            const volatile = ELITE_AFFIXES.volatile;
            const x = enemy.x + 38;
            this.fx.play(ELITE_VFX.volatileWarn, x, FOOT_B);
            this.schedule(volatile.delay, () => {
                if (!this.isActive || this.finalBaseDestroyed) return;
                this.fx.play(ELITE_VFX.volatileBlast, x, FOOT_B);
                this.director.shake(7, 350);
                if (Math.abs(this.monsterX + 60 - x) <= volatile.radius) this.damagePlayer(this.maxPlayerHp * volatile.dmg, 0);
            });
        }
        if (enemy.boss) {
            this.boss = null;
            if (this.bossPhase) {   // 구역 3: 정문 뒤 보스 = 승리
                this.updateHud();
                this.bossVictory(enemy);
                return;
            }
            this.director.stamp('BOSS DOWN', `${enemy.t.name} 격파`, 'is-gold', 1500);
            this.fx.play(BATTLE_VFX.baseFinale, enemy.x + 38, FOOT_B, { scale: 0.6 });
        }
        // 키메라 슬라임 (구역 4): 쓰러지면 작은 슬라임으로 갈라짐 (작은 슬라임은 split이 없어 한 번만)
        const split = enemy.t && enemy.t.split;
        if (split && !this.finalBaseDestroyed) {
            this.fx.play(ZONE_VFX.slimeSplit, enemy.x + 38, FOOT_B + 20);
            for (let i = 0; i < split.n; i++) this.spawnMinion(split.into, { x: enemy.x - 14 + i * 34, elite: false });
            this.createDamagePopup(enemy.x, 140, '분열!', false);
        }
        this.updateHud();

        if (this.equippedHeadId === 'head_hero' && Math.random() < HERO.recruitChance) {
            this.recruit(enemy.x);
        }
    },

    /** 지속 피해 숫자 모아서 표시 (POPUP.dotFlushSec마다) */
    flushDotPopups(dt) {
        this.dotTimer += dt;
        if (this.dotTimer >= POPUP.dotFlushSec) {
            this.dotTimer = 0;
            this.enemies.forEach(e => {
                if (e.dotAcc >= 1) this.createDamagePopup(e.x + 20, 105, e.dotAcc, false, 'dot');
                e.dotAcc = 0;
            });
        }
    },

    // ---- 피격 반응과 상태 외형 ----
    // 피격 반응: 섬광 + 넉백 (+ 강한 타격은 히트스톱)
    hitReact(e, react) {
        if (react.stop) gameTime.hitStop(HIT_REACT.stopSec);
        if (!e.dom) return;
        e.flashing = true;
        e.dom.style.filter = 'brightness(2.4) saturate(0.2)';
        setTimeout(() => { e.flashing = false; this.updateEnemyFilter(e); }, HIT_REACT.flashMs);
        if (!e.isBuilding && !e.knockResist && react.knock) {   // 방패병·보스는 밀리지 않음
            e.x += HIT_REACT.knockPx * react.knock;
            e.dom.style.left = `${e.x}px`;
        }
        if (!e.isBuilding && !e.isBarricade) this.enemyRecoil(e, react);
    },

    /** 맞은 적의 그림이 뒤로(오른쪽) 젖혀졌다 돌아옴 (Q-008 Q4) — 젖혀지는 중이면 다시 하지 않음 */
    enemyRecoil(e, react) {
        const sprite = e.dom.querySelector('.v2-enemy__sprite');
        if (!sprite || !sprite.animate || (e.recoil && e.recoil.playState === 'running')) return;
        const R = ENEMY_REACT;
        const deg = (e.knockResist || e.boss ? R.bossDeg : R.deg) * Math.min(1.6, 0.6 + (react.knock || 0) * 0.4);
        sprite.style.transformOrigin = '50% 100%';
        e.recoil = sprite.animate([
            { transform: 'none' },
            { transform: `translateX(3px) rotate(${deg.toFixed(1)}deg)`, offset: 0.3 },
            { transform: 'none' }
        ], { duration: R.ms, easing: 'ease-out' });
    },

    /** 쓰러진 적: 체력바를 지우고 뒤로 넘어지며 흐려진 뒤 치움 (그림이 없으면 바로 치움) */
    enemyFall(e) {
        const el = e.dom;
        const sprite = el.querySelector('.v2-enemy__sprite');
        if (!sprite || !sprite.animate) { el.remove(); return; }
        el.querySelector('.enemy-hp-track')?.remove();
        e.statusEl?.remove();
        el.style.pointerEvents = 'none';
        el.classList.add('is-falling');
        sprite.style.animationPlayState = 'paused';   // 걷기·공격 그림이 멈춘 채 넘어짐
        sprite.style.transformOrigin = '50% 100%';
        e.recoil?.cancel();
        const ms = e.boss ? ENEMY_REACT.fallBossMs : ENEMY_REACT.fallMs;
        const fall = sprite.animate([
            { transform: 'none', opacity: 1 },
            { transform: 'translateX(8px) rotate(16deg)', opacity: 1, offset: 0.35 },
            { transform: 'translate(16px, 4px) rotate(78deg) scaleY(0.92)', opacity: 0 }
        ], { duration: ms, easing: 'ease-in', fill: 'forwards' });
        fall.onfinish = () => el.remove();
        setTimeout(() => el.remove(), ms + 200);   // 탭이 가려져 애니메이션이 멈춰도 치움
    },

    slowEnemy(e) {
        e.slowT = HERO.slowSec;
        this.updateEnemyFilter(e);
    },

    stunEnemy(e, sec) {
        e.stunT = Math.max(e.stunT || 0, sec);
        this.updateEnemyFilter(e);
    },

    // 적 외형 상태: 기절 > 감속 > 저주 순으로 색 (피격 섬광 중에는 섬광 우선) + 상태 아이콘
    updateEnemyFilter(e) {
        if (!e.dom) return;
        const states = [e.puppetT > 0 && 'puppet', e.frozenT > 0 && 'frozen', e.stunT > 0 && !(e.frozenT > 0) && !(e.puppetT > 0) && 'stun',
            e.rootT > 0 && 'root', e.slowT > 0 && 'slow', e.cursed && 'curse', e.acidT > 0 && 'acid', e.bleedT > 0 && 'bleed',
            e.abyssT > 0 && 'abyss', e.stitchT > 0 && 'stitch', e.chill > 0 && 'chill', ...this.kitStates(e), e.blessed && 'bless'].filter(Boolean);
        this.updateStatusIcons(e, states);
        // 멈춘 적의 몸 (Q-008 Q5): 기절 = 비틀거림, 빙결 = 굳음, 속박 = 버둥거림 — 걷기·공격 그림이 제자리에서 돌지 않게 (ui_v2.css)
        const held = e.frozenT > 0 ? 'frozen' : e.stunT > 0 && !(e.puppetT > 0) ? 'stunned' : e.rootT > 0 ? 'rooted' : '';
        if (held !== (e.heldShown || '')) {
            e.dom.classList.remove('is-held-frozen', 'is-held-stunned', 'is-held-rooted');
            if (held) e.dom.classList.add(`is-held-${held}`);
            e.heldShown = held;
        }
        if (e.flashing) return;
        // 종류 색조(enemies_v2.js baseFilter) + 상태 색
        e.dom.style.filter = [e.baseFilter, states.length ? ENEMY_TINT[states[0]] || '' : '',
            e.shield > 0 ? `drop-shadow(0 0 10px rgb(${ELITE_AFFIXES.shielded.color}))` : ''].filter(Boolean).join(' ');
    },

    // 체력바 옆 상태 아이콘 (저주/감속/기절) — 바뀔 때만 다시 그림
    updateStatusIcons(e, states) {
        const sig = states.join();
        if (sig === (e.statusSig || '')) return;
        e.statusSig = sig;
        if (!e.statusEl) {
            e.statusEl = document.createElement('div');
            e.statusEl.className = 'v2-status';
            e.dom.appendChild(e.statusEl);
        }
        e.statusEl.innerHTML = states.map(k => `<span class="v2-status__icon is-${k}">${icon(STATUS_ICON[k], 10)}</span>`).join('');
    },

    // ---- 산성 부식 (산성 발톱 팔) ----
    applyAcid(e, sec = ACID.sec) {
        if (!e || e.hp <= 0) return;
        const fresh = !(e.acidT > 0);
        e.acidT = Math.max(e.acidT || 0, sec);
        if (fresh) this.updateEnemyFilter(e);
    },

    tickAcid(dt) {
        const dps = this.playerDps * ACID.dpsMul;
        [...this.enemies].forEach(e => {
            if (!(e.acidT > 0)) return;
            e.acidT -= dt;
            e.acidFx = (e.acidFx || 0) + dt;
            if (e.acidFx >= 0.5) {
                e.acidFx = 0;
                this.fx.play(KAIJU_VFX.acidTick, aimOf(e).x, aimOf(e).b + 10);
            }
            this.dealDamageToEnemy(e, dps * (e.isBuilding ? ACID.baseMul : 1) * dt, false, { dot: true });
            if (e.acidT <= 0 && this.enemies.includes(e)) this.updateEnemyFilter(e);
        });
    },

    // ---- 거점 ----
    // 중간 거점 요새 건물 출현
    spawnMidBase() {
        if (this.midBaseSpawned || !this.domEnemies) return;
        this.midBaseSpawned = true;
        (this.stats.marks ||= {}).midSeen = this.stats.time;   // 패배 원인 알려주기 (runReport.js)
        this.spawnBase('mid');
        this.director.warning('mid');
        coach('battle_base', '#hud-timer-v2');   // 처음 한 번: 별·승리 조건·제한 시간 안내
        this.updateHud();
    },

    // 최종 핵심 기지 건물 출현
    spawnFinalBase() {
        if (this.finalBaseSpawned || !this.domEnemies) return;
        this.finalBaseSpawned = true;
        (this.stats.marks ||= {}).finalSeen = this.stats.time;
        const base = this.spawnBase('final');

        const boss = this.stage.boss;
        const name = boss && ENEMY_TYPES[boss.unit].name;
        if (boss && !boss.afterBase) this.director.bossCard(boss.unit, ENEMY_TYPES[boss.unit], '최종 기지를 지키고 있다 — 기지를 부수면 승리');
        else this.director.warning('final', boss ? `최종 기지를 부수면 ${name}이(가) 나타난다` : null);
        coach('battle_final', '#battle-distance-v2');   // 처음 한 번: 최종 기지 = 승리 조건
        sound.playBgm('boss', 0.8);
        // 보스전: 기지 앞에 보스 (구역 3은 기지를 부순 뒤 — openBossGate)
        if (boss && !boss.afterBase) this.boss = this.spawnMinion(boss.unit, { x: base.x - 70, elite: false });
        this.updateHud();
    },

    /** 거점 건물 (kind: 'mid' 요새 | 'final' 최종 기지). 그림은 bases_v2.js — 체력에 따라 온전 → 파손 → 붕괴 */
    spawnBase(kind) {
        const final = kind === 'final';
        const x = window.innerWidth > 1000 ? BASE_X[kind] : (final ? 620 : 650);
        const maxHp = this.stage.base[kind];
        const art = baseArtName(this.stage, kind);   // 구역별 그림 (bases_v2.js)
        this.currentTargetHp = maxHp;
        this.maxTargetHp = maxHp;
        if (this.domTargetLabel) this.domTargetLabel.textContent = final ? '[최종 핵심 기지] HP' : '[중간 거점 요새] HP';

        const el = document.createElement('div');
        el.className = final ? 'building-entity final-base' : 'building-entity';
        el.setAttribute('data-label', final ? 'FINAL HEADQUARTERS' : 'INTERMEDIATE FORT');
        el.style.left = `${x}px`;
        dressBase(el, art, kind);
        el.classList.add('v2-base-in');

        const hpBar = document.createElement('div');
        hpBar.className = 'enemy-hp';
        hpBar.style.width = '100%';
        el.appendChild(hpBar);
        this.domEnemies.appendChild(el);

        const base = {
            id: final ? 'building_final_base' : 'building_mid_base',
            kind,
            art,
            size: baseSize(art, kind),
            artState: 0,
            x,
            hp: maxHp,
            maxHp,
            dps: final ? 100 : 50,
            speed: 0,
            isBuilding: true,
            isFinal: final,
            dom: el,
            hpBar
        };
        this.enemies.push(base);
        return base;
    },

    /** 체력이 절반 아래로 내려가면 파손 그림 (지속 피해로 깎여도 잡히게 매 프레임 확인) — 거점·바리케이드 */
    updateBaseArt() {
        this.enemies.forEach(e => {
            if (!(e.isBuilding || e.isBarricade) || e.artState !== 0 || e.hp > e.maxHp * BASE_STATE.damaged || !baseArt(e.art)) return;
            e.artState = 1;
            setBaseState(e.dom, e.art, 1);
            const a = aimOf(e);
            this.fx.play(BATTLE_VFX.baseBlast, a.x, a.b + 20, { scale: 1.1 });
            this.director.shake(5, 300);
            sound.play('base_blast', { x: this.fx.panX(a.x) });
        });
    },

    /** 파괴 연출의 대폭발 순간: 잔해 그림으로 바꿈. 요새 잔해는 남겨 두었다가 바닥과 함께 흘려보냄 */
    collapseBase(base) {
        if (!base.dom || !baseArt(base.art)) return false;
        base.dom.classList.remove('v2-wreck', 'v2-wreck--final', 'v2-base-in');
        setBaseState(base.dom, base.art, 2);
        if (!base.isFinal) this.ruins.push(base);
        return true;
    },

    /** 걷는 동안(배경이 흐를 때) 잔해를 바닥과 같은 속도로 왼쪽으로 */
    scrollRuins(dt) {
        if (!this.ruins.length) return;
        this.ruins = this.ruins.filter(r => {
            r.x -= this.groundSpeed() * dt;
            if (r.x + r.size.w < -40) {
                r.dom.remove();
                return false;
            }
            r.dom.style.left = `${r.x}px`;
            return true;
        });
    },

    // ---- 구역 2 장애물 ----
    /** 바리케이드 (방벽병이 세움): 체력 있는 작은 벽 — 주인공·아군이 부숴야 지나감, 수리공이 고침.
     *  그림 = 챕터 art.barricade (구역 3 방패 장벽 · 구역 4 갑각 장벽), 없으면 구역 2 바리케이드 */
    spawnBarricade(x, hp, label = '🚧 바리케이드!', art = (this.stage && this.stage.art && this.stage.art.barricade) || 'barricade') {
        if (!this.domEnemies) return null;
        const el = document.createElement('div');
        el.className = 'enemy-entity v2-barricade';
        el.style.left = `${x}px`;
        dressBase(el, art, 'barricade');
        const track = document.createElement('div');
        track.className = 'enemy-hp-track';
        const bar = document.createElement('div');
        bar.className = 'enemy-hp';
        bar.style.width = '100%';
        track.appendChild(bar);
        el.appendChild(track);
        this.domEnemies.appendChild(el);
        const b = {
            id: `barricade_${Date.now()}_${Math.random()}`, type: 'barricade', isBarricade: true, art, artState: 0,
            size: baseSize(art, 'mid'), x, hp, maxHp: hp, dps: 0, speed: 0, knockResist: true, reward: 0.5,
            dom: el, hpBar: bar, baseFilter: '', t: { name: '바리케이드' }, cd: {}
        };
        this.enemies.push(b);
        this.fx.play(BATTLE_VFX.shieldBash, x + b.size.w / 2, FOOT_B + 30, { scale: 0.7 });
        sound.play('mech_fist_hit', { rate: 0.7, vol: 0.7 });
        this.createDamagePopup(x + 20, 160, label, false);
        return b;
    },

    /** 늪 장판 (오물 투척병): 바닥에 sec초 — 주인공이 밟으면 PUDDLE_STICK초 감속 (걷는 동안은 바닥과 함께 흘러 금방 지나가므로) */
    addPuddle(x, w, sec, opts = {}) {
        if (!this.domEnemies) return;
        const el = document.createElement('div');
        el.className = `v2-puddle${opts.fire ? ` v2-puddle--${opts.kind || 'fire'}` : opts.mine ? ' v2-puddle--mine' : ''}`;   // fire(네이팜·간헐천) · holy(오염된 성수) · mine(지뢰)
        el.style.left = `${x}px`;
        el.style.width = `${w}px`;
        this.domEnemies.appendChild(el);
        // fire: 불 장판 (새 기획 구역 1 네이팜) — 감속 대신 위에 있는 동안 초당 fire 피해
        this.hazards.push({ x, w, t: sec, dom: el, fire: opts.fire || 0, mine: opts.mine || null });
        if (!opts.fire && !opts.mine) sound.play('kaiju_spore', { rate: 0.6, vol: 0.5 });
    },

    tickHazards(dt) {
        if (!this.hazards.length) return;
        const footL = this.monsterX + 20, footR = this.monsterX + 100;
        this.hazards = this.hazards.filter(h => {
            h.t -= dt;
            if (h.t <= 0) {
                h.dom.classList.add('is-fading');
                setTimeout(() => h.dom.remove(), 400);
                return false;
            }
            if (h.mine && h.x < footR && h.x + h.w > footL) {   // 지뢰 (새 기획 구역 7): 밟으면 한 번 터짐 → 피해 + 기절
                this.fx.play(ZONE_VFX.rocketBlast, h.x + h.w / 2, FOOT_B + 10);
                this.director.shake(8, 350);
                this.damagePlayer(h.mine.dmg, 0);
                this.applyPlayerStun(h.mine.stun, '지뢰!');
                h.dom.remove();
                return false;
            }
            if (h.mine) return true;
            if (h.x < footR && h.x + h.w > footL && !this.kitFlag('ignoreHazard')) {
                if (h.fire) this.damagePlayer(h.fire * dt, dt);           // 네이팜: 밟고 있는 동안 불 피해
                else this.applyPlayerSlow(PUDDLE_STICK, true);   // 밟으면 끈적한 오물이 묻어 잠시 감속 (2차 장판 무시 패시브는 빼고)
            }
            return true;
        });
    },

    /** 걷는 동안 늪도 바닥과 같이 흘러감 */
    scrollHazards(dt) {
        this.hazards.forEach(h => {
            h.x -= this.groundSpeed() * dt;
            h.dom.style.left = `${h.x}px`;
        });
    },

    // ---- 보스전: 최종 기지 EMP 광역 포격 (기획서 2-⑥) ----
    // 경보 → 발사: 주인공 기절, 대신 전장의 적 보병 전멸 + 잠시 소환 중단
    tickArtillery(dt) {
        this.tickGas(dt);
        this.tickKnights(dt);
        this.tickOrbital(dt);
        this.tickContainers(dt);
        this.tickGeysers(dt);
        this.tickDonors(dt);
        this.tickFlares(dt);
        this.tickAltars(dt);
        this.tickBossShields(dt);
        const art = this.stage.boss && this.stage.boss.artillery;
        const base = this.enemies.find(e => e.isBuilding && e.isFinal);
        if (!art || !base) return;
        this.artTimer += dt;
        if (!this.artWarned && this.artTimer >= art.every - art.warn) {
            this.artWarned = true;
            this.director.alarm('EMP 경보', `${art.warn.toFixed(0)}초 뒤 광역 포격 — 적 보병도 함께 쓸려 나간다`, art.warn);
        }
        if (this.artTimer >= art.every) {
            this.artTimer = 0;
            this.artWarned = false;
            const muzzle = baseArt(base.art) && baseArt(base.art).muzzle;   // EMP 포구 (그림이 있으면)
            this.fx.play(BATTLE_VFX.emp, muzzle ? base.x + muzzle[0] : base.x + 60, muzzle ? muzzle[1] : 230);
            this.director.flash('#9fe0ff', 380, 0.75);
            this.director.shake(12, 700);
            this.applyPlayerStun(art.stun, 'EMP 마비!');
            this.enemies.filter(e => !e.isBuilding && !e.boss).forEach(e => {
                this.fx.play(BATTLE_VFX.baseBlast, e.x + 38, 90, { scale: 0.5 });
                if (e.dom) {
                    e.dom.classList.add('v2-rout');
                    setTimeout(() => e.dom.remove(), 600);
                }
            });
            this.enemies = this.enemies.filter(e => e.isBuilding || e.boss);
            this.spawnSilence = art.silence;
        }
    },

    // ---- 새 기획 구역 1 보스전: 궤도 폭격 (stage.boss.orbital) — every초마다 경보 → 바닥 n곳에 붉은 원(하나는 주인공 자리)
    //      → warn초 뒤 하늘에서 빛기둥: 원 안의 주인공·적(보스 빼고) 모두 피해 (적 병사는 최대 체력 enemyDmg 비율) ----
    tickOrbital(dt) {
        const o = this.stage.boss && this.stage.boss.orbital;
        if (!o || this.finalBaseDestroyed) return;
        this.orbitalTimer = (this.orbitalTimer || 0) + dt;
        if (this.orbitalTimer < o.every) return;
        this.orbitalTimer = 0;
        const px = this.monsterX + 35;
        const xs = [px];
        for (let i = 1; i < o.n; i++) xs.push(px + 120 + Math.random() * 420);
        this.director.alarm('궤도 폭격', `${o.warn.toFixed(0)}초 뒤 천장 해치에서 폭격 — 붉은 원을 조심`, o.warn);
        sound.play('warning', { vol: 0.55, rate: 1.0 });
        xs.forEach((x, i) => this.fx.play(BATTLE_VFX.smiteWarn, x, FOOT_B, { scale: o.radius / 70,
            ...(i === 0 ? { follow: () => [x, FOOT_B] } : {}) }));
        this.schedule(o.warn, () => {
            if (!this.isActive || this.finalBaseDestroyed) return;
            const hitX = this.monsterX + 35;
            xs.forEach((x, i) => this.schedule(i * 0.12, () => {
                if (!this.isActive) return;
                this.fx.play(ZONE_VFX.orbitalStrike, x, FOOT_B);
                this.director.shake(10, 420);
                if (Math.abs(hitX - x) <= o.radius) this.damagePlayer(this.maxPlayerHp * o.dmg, 0);
                this.enemies.filter(e => !e.isBuilding && !e.isBarricade && !e.boss && Math.abs(e.x + 38 - x) <= o.radius)
                    .forEach(e => this.dealDamageToEnemy(e, e.maxHp * (o.enemyDmg ?? 0.5), false, { dot: true }));
            }));
            this.director.flash('#ff6040', 320, 0.5);
        });
    },

    // ---- 새 기획 구역 2 보스전: 폐기물 컨테이너 투하 (stage.boss.containers) — every초마다 경보 → 바닥 n곳에 그림자(하나는 주인공 앞)
    //      → warn초 뒤 쿵: 그 자리 주인공은 피해 + 기절, 떨어진 컨테이너는 sec초 동안 바리케이드(부숴야 지나감) ----
    tickContainers(dt) {
        const c = this.stage.boss && this.stage.boss.containers;
        // 보스(최종 기지)가 나온 뒤부터 — 처음부터 떨어지면 중간 요새 앞에서 장벽만 부수다 시간이 끝남 (밸런스 1차 D-087)
        if (!c || !this.finalBaseSpawned || this.finalBaseDestroyed) return;
        this.containerTimer = (this.containerTimer || 0) + dt;
        this.enemies.filter(e => e.isBarricade && e.expireAt != null && this.stats.time >= e.expireAt).forEach(e => {
            this.fx.play(BATTLE_VFX.knockDust, e.x + e.size.w / 2, FOOT_B);
            e.dom.remove();
            this.enemies = this.enemies.filter(o => o !== e);
        });
        if (this.containerTimer < c.every) return;
        this.containerTimer = 0;
        const px = this.monsterX + 35;
        const xs = [px + 40];   // 하나는 주인공 자리 바로 앞 (맞으면 기절 + 앞을 막음)
        for (let i = 1; i < c.n; i++) xs.push(px + 220 + Math.random() * 380);
        this.director.alarm('컨테이너 투하', `${c.warn.toFixed(0)}초 뒤 크레인이 폐기물 컨테이너를 떨어뜨린다 — 그림자를 조심`, c.warn);
        sound.play('warning', { vol: 0.5, rate: 0.9 });
        xs.forEach(x => this.fx.play(ZONE_VFX.containerWarn, x, FOOT_B));
        this.schedule(c.warn, () => {
            if (!this.isActive || this.finalBaseDestroyed) return;
            xs.forEach((x, i) => this.schedule(i * 0.15, () => {
                if (!this.isActive) return;
                this.fx.play(ZONE_VFX.containerSlam, x, FOOT_B);
                this.director.shake(9, 380);
                const hx = this.monsterX + 35;
                if (Math.abs(hx - x) <= c.radius) {
                    this.damagePlayer(this.maxPlayerHp * c.dmg, 0);
                    this.applyPlayerStun(c.stun, '컨테이너에 깔림!');
                }
                const w = baseSize(this.stage.art.barricade, 'mid').w || 120;
                const bar = this.spawnBarricade(x - w / 2, c.hp * this.stage.enemy.hp, '📦 폐기물 컨테이너!');
                if (bar) bar.expireAt = this.stats.time + c.sec;
            }));
        });
    },

    // ---- 새 기획 구역 5 보스전: 오염된 해저 화산 (stage.boss.geysers) — every초마다 경보 → 바닥 n곳(하나는 주인공 자리)에 주황 빛
    //      → warn초 뒤 맹독 간헐천: sec초 동안 남는 불 장판 (위에 있으면 초당 최대 내구도 dps 비율) ----
    tickGeysers(dt) {
        const g = this.stage.boss && this.stage.boss.geysers;
        if (!g || this.finalBaseDestroyed) return;
        this.geyserTimer = (this.geyserTimer || 0) + dt;
        if (this.geyserTimer < g.every) return;
        this.geyserTimer = 0;
        const px = this.monsterX + 60;
        const xs = [px];
        for (let i = 1; i < g.n; i++) xs.push(px + 160 + Math.random() * 380);
        this.director.alarm('해저 화산', `${g.warn.toFixed(0)}초 뒤 철망 아래에서 맹독 간헐천이 치솟는다`, g.warn);
        sound.play('warning', { vol: 0.5, rate: 0.85 });
        xs.forEach(x => this.fx.play(ZONE_VFX.quakeWarn, x, FOOT_B));
        this.schedule(g.warn, () => {
            if (!this.isActive || this.finalBaseDestroyed) return;
            xs.forEach((x, i) => this.schedule(i * 0.1, () => {
                if (!this.isActive) return;
                this.fx.play(ZONE_VFX.geyserBurst, x, FOOT_B);
                this.addPuddle(x - g.width / 2, g.width, g.sec, { fire: this.maxPlayerHp * g.dps });
            }));
            this.director.flash('#ff8a30', 300, 0.35);
        });
    },

    // ---- 새 기획 구역 6 보스전: 강제 헌혈 (stage.boss.donors) — every초마다 경보 → 주인공 앞에 실험체 n명이 나타나 심장으로 걸어감
    //      (enemies_v2.js tickDonor — 닿으면 보스 회복 + 피의 방어막, 그 전에 부숴야 함) ----
    tickDonors(dt) {
        const d = this.stage.boss && this.stage.boss.donors;
        if (!d || !this.boss || this.finalBaseDestroyed) return;
        this.donorTimer = (this.donorTimer || 0) + dt;
        if (this.donorTimer < d.every) return;
        this.donorTimer = 0;
        this.director.alarm('강제 헌혈', `${d.warn.toFixed(0)}초 뒤 실험체 ${d.n}명이 심장으로 끌려간다 — 닿기 전에 부숴라`, d.warn);
        this.director.flash('#a0102a', 400, 0.35);
        this.schedule(d.warn, () => {
            if (!this.isActive || !this.boss) return;
            for (let i = 0; i < d.n; i++) {
                const x = this.frontX() + 40 + i * 60;
                this.fx.play(ZONE_VFX.bloodPulse, x + 38, FOOT_B + 30, { scale: 0.4 });
                this.spawnMinion('pauper', { x, elite: false });
            }
        });
    },

    // ---- 새 기획 구역 7 보스전: 조명탄 (stage.boss.flares) — every초마다 보스가 조명탄을 쏘아 올림(하늘에 뜬 적 'flare')
    //      → fuse초 안에 부수면 끝, 못 부수면 전장 전체 융단 포격 (최대 내구도 dmg) ----
    tickFlares(dt) {
        const f = this.stage.boss && this.stage.boss.flares;
        if (!f || !this.boss || this.finalBaseDestroyed) return;
        const live = this.enemies.find(e => e.type === 'flare');
        if (live && this.stats.time >= live.fuseAt) {
            live.dom.remove();
            this.enemies = this.enemies.filter(e => e !== live);
            this.director.flash('#ff3020', 500, 0.6);
            this.director.shake(16, 800);
            for (let i = 0; i < 6; i++) this.schedule(i * 0.09, () => this.isActive && this.fx.play(ZONE_VFX.orbitalStrike, this.monsterX - 120 + i * 140, FOOT_B));
            this.damagePlayer(this.maxPlayerHp * f.dmg, 0);
            this.createDamagePopup(this.monsterX + 20, 240, '💥 융단 포격!', false);
            return;
        }
        if (live) return;
        this.flareTimer = (this.flareTimer || 0) + dt;
        if (this.flareTimer < f.every) return;
        this.flareTimer = 0;
        const x = Math.min(this.frontX() + 200, this.boss.x - 60);
        const fl = spawnEnemy(this, 'flare', { x, elite: false });
        fl.hp = fl.maxHp = Math.round(f.hp * this.stage.enemy.hp);
        fl.fuseAt = this.stats.time + f.fuse;
        this.director.alarm('조명탄', `${f.fuse}초 안에 조명탄을 부숴라 — 못 부수면 융단 포격`, f.fuse);
        sound.play('warning', { vol: 0.6, rate: 0.8 });
    },

    // ---- 새 기획 구역 8 보스전: 탐욕의 제단 (stage.boss.altars) — every초마다 국왕 앞에 제단 n개(바리케이드처럼 부숴야 지나감)
    //      → 서 있는 동안 주인공 열파동 지속 피해 + 국왕 공격력 ×rage, 모두 부수면 국왕 stun초 기절 ----
    tickAltars(dt) {
        const a = this.stage.boss && this.stage.boss.altars;
        if (!a || !this.boss || this.finalBaseDestroyed) return;
        const live = this.enemies.filter(e => e.isAltar);
        if (live.length) {
            this.damagePlayer(this.maxPlayerHp * a.heat * dt, dt);
            this.altarHeatFx = (this.altarHeatFx || 0) + dt;
            if (this.altarHeatFx >= 0.6) { this.altarHeatFx = 0; this.fx.play(ZONE_VFX.napalmBurst, this.monsterX + 60, FOOT_B + 10, { scale: 0.5 }); }
            return;
        }
        if (this.altarsUp) {   // 방금 모두 부숨 → 국왕 기절, 공격력 원래대로
            this.altarsUp = false;
            this.boss.dps /= a.rage;
            this.boss.stunT = Math.max(this.boss.stunT || 0, a.stun);
            this.updateEnemyFilter(this.boss);
            this.director.stamp('제단 붕괴', `${this.boss.t.name} — 기절`, 'is-gold', 1400);
        }
        this.altarTimer = (this.altarTimer || 0) + dt;
        if (this.altarTimer < a.every) return;
        this.altarTimer = 0;
        this.altarsUp = true;
        this.boss.dps *= a.rage;
        this.director.alarm('탐욕의 제단', `화로석 제단 ${a.n}개 — 모두 부수면 국왕이 기절한다`, 2);
        for (let i = 0; i < a.n; i++) {
            const x = Math.min(this.frontX() + 120 + i * 90, this.boss.x - 40);
            const bar = this.spawnBarricade(x, a.hp * this.stage.enemy.hp, i ? '' : '🔥 탐욕의 제단!');
            if (bar) {
                bar.isAltar = true;
                bar.dom.classList.add('v2-altar');
                this.fx.play(ZONE_VFX.napalmBurst, x + bar.size.w / 2, FOOT_B + 20);
            }
        }
    },

    // ---- 새 기획 구역 9·10 보스전: 폐자재 더미 (stage.boss.scrap) · 세뇌 증폭 안테나 (stage.boss.antennas)
    //      every초마다 보스 앞에 n개(바리케이드처럼 부숴야 지나감) → 서 있는 동안 보스 무적, fuse초 안에 모두 못 부수면 폭발 (최대 내구도 dmg) ----
    tickBossShields(dt) {
        const boss = this.stage.boss;
        const key = boss && (boss.scrap ? 'scrap' : boss.antennas ? 'antennas' : null);
        if (!key || !this.boss || this.finalBaseDestroyed) return;
        const c = boss[key];
        const TXT = key === 'scrap'
            ? { alarm: '폐자재 더미', sub: `${c.fuse}초 안에 폐자재 더미 ${c.n}개를 모두 부숴라 — 그동안 보스 무적`, label: '🧱 초고밀도 폐자재!', boom: '💥 폐자재 폭발!' }
            : { alarm: '세뇌 방송국 가동', sub: `${c.fuse}초 안에 안테나 ${c.n}개를 모두 부숴라 — 그동안 보스 무적`, label: '📡 세뇌 증폭 안테나!', boom: '🔊 소음 파동!' };
        const live = this.enemies.filter(e => e.isBossShield);
        if (live.length) {
            if (this.stats.time < this.shieldFuseAt) return;
            live.forEach(e => { e.dom.remove(); this.fx.play(ZONE_VFX.rocketBlast, e.x + e.size.w / 2, FOOT_B + 20); });
            this.enemies = this.enemies.filter(e => !e.isBossShield);
            this.boss.invulnerable = false;
            this.updateEnemyFilter(this.boss);
            this.director.flash(key === 'scrap' ? '#ffa030' : '#ff40c0', 500, 0.6);
            this.director.shake(16, 800);
            this.damagePlayer(this.maxPlayerHp * c.dmg, 0);
            this.createDamagePopup(this.monsterX + 20, 240, TXT.boom, false);
            return;
        }
        if (this.boss.invulnerable) {   // 제때 모두 부숨 → 무적 풀림
            this.boss.invulnerable = false;
            this.boss.dom?.classList.remove('is-invulnerable');
            this.director.stamp('무적 해제', `${this.boss.t.name}`, 'is-gold', 1200);
        }
        this.bossShieldTimer = (this.bossShieldTimer || 0) + dt;
        if (this.bossShieldTimer < c.every) return;
        this.bossShieldTimer = 0;
        this.shieldFuseAt = this.stats.time + c.fuse;
        this.boss.invulnerable = true;
        this.boss.dom?.classList.add('is-invulnerable');
        this.director.alarm(TXT.alarm, TXT.sub, Math.min(c.fuse, 3));
        for (let i = 0; i < c.n; i++) {
            const x = Math.min(this.frontX() + 110 + i * 80, this.boss.x - 40);
            const bar = this.spawnBarricade(x, c.hp * this.stage.enemy.hp, i ? '' : TXT.label);
            if (bar) {
                bar.isBossShield = true;
                bar.dom.classList.add(key === 'scrap' ? 'v2-scrapheap' : 'v2-antenna');
            }
        }
    },

    // ---- 구역 2 보스전: 소각탑 유독 가스 — 경보 → 전장 전체 감속 (적도 같이 느려짐), 가스가 퍼진 동안은 약탈단도 새로 못 나옴 ----
    tickGas(dt) {
        const gas = this.stage.boss && this.stage.boss.gas;
        const base = gas && this.enemies.find(e => e.isBuilding && e.isFinal);
        if (!base) return;
        this.gasTimer += dt;
        if (!this.gasWarned && this.gasTimer >= gas.every - gas.warn) {
            this.gasWarned = true;
            this.director.alarm('유독 가스', `${gas.warn.toFixed(0)}초 뒤 소각탑 가스 분출 — 적도 느려지고 증원이 멈춘다`, gas.warn);
        }
        if (this.gasTimer < gas.every) return;
        this.gasTimer = 0;
        this.gasWarned = false;
        const muzzle = baseArt(base.art) && baseArt(base.art).muzzle;
        this.fx.play(ZONE_VFX.toxicBurst, muzzle ? base.x + muzzle[0] : base.x + 100, muzzle ? muzzle[1] : 300, { scale: 0.8 });
        this.director.flash('#c8ff60', 420, 0.45);
        this.director.gas(gas.sec);
        this.applyPlayerSlow(gas.sec);
        this.enemies.forEach(e => {
            if (e.isBuilding || e.isBarricade) return;
            e.slowT = Math.max(e.slowT || 0, gas.sec);
            this.updateEnemyFilter(e);
        });
        this.spawnSilence = Math.max(this.spawnSilence, gas.silence ?? gas.sec);
    }
};
