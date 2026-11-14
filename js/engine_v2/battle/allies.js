import { SUPPORT } from '../support_v2.js';
/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 — 아군 (v2)
   소환·징집되는 아군 미니언: 세뇌 보병(타락 히어로), 새끼 괴수(거대괴수 산란), 졸개(합성괴인 몸통).
   아군은 자기 체력이 있고, 가장 가까운 적과 싸우며 0이 되면 사라진다 (기획서 4-②).
   battle_v2.js의 BattleEngine에 메서드로 붙는다 (this = 전투 엔진).
   ========================================================================== */

import { monsterControllerV2 } from '../monster_v2.js';
import { HERO_ORB } from '../vfx/heroVfx.js';
import { HERO_VFX, CHIMERA_VFX } from '../vfx/vfxDefs.js';
import { ensureEnemyStyles } from '../enemies_v2.js';
import { ALLY_FIGHT, BABY, EGG, FOOT_B, MINION } from './tuning.js';

export const AllyMethods = {
    // [세뇌 스마트 구속구]: 적 보병 소멸 시 아군 미니언 징집 소환
    // kind 'baby_kaiju': 거대괴수 산란으로 부화한 새끼 괴수 (리그에서 구운 스프라이트)
    //      'chimera': 합성괴인 몸통의 졸개 소환 (소환진 이펙트)
    //      'stitch': 봉합 성녀가 꿰매 일으킨 적 — opts { art(적 종류 그림), hp, dps } (battle/saint.js)
    //      'rabbit': 뒤틀린 인형사의 토끼 인형 — opts { hp, dps, speed(px/초) } (battle/doll.js), 쓰러지면 onAllyDown
    spawnAllyMinion(startX, kind = 'mind', opts = {}) {
        if (!this.domEnemies) return;
        // 거점 너머에서 부활·소환돼도 가장 왼쪽 거점 앞에 배치한다.
        const bases = this.enemies.filter(e => e.isBuilding);
        if (bases.length) startX = Math.min(startX, Math.min(...bases.map(e => e.x)) - 40);
        ensureEnemyStyles();   // 세뇌 보병·졸개 그림 CSS (적보다 먼저 나올 수 있음 — 합성괴인 졸개는 출격 직후)
        const baby = kind === 'baby_kaiju';
        const minion = kind === 'chimera';   // 합성괴인 졸개: 주인공 능력치 비례 (tuning.js MINION)
        const maxHp = opts.hp ?? (baby ? BABY.hp : minion ? Math.round(this.maxPlayerHp * MINION.hp) : 350);
        const dps = opts.dps ?? (baby ? BABY.dps : minion ? this.playerDps * MINION.dps * this.sigAllyMul() : 17.5); // 세뇌 미니언은 적 보병 데미지의 절반
        const allyId = `ally_${Date.now()}_${Math.random()}`;

        const el = document.createElement('div');
        // 외형: 새끼 괴수 / 합성괴인 졸개(미니 괴인 스프라이트) / 세뇌 보병(적 보병 + 검보라 세뇌 표식)
        el.className = `ally-minion ${baby ? 'baby-kaiju-v2' : kind === 'chimera' ? 'chimera-minion-v2'
            : kind === 'stitch' ? `v2-stitch v2-stitch-${opts.art || 'guard'}` : kind === 'rabbit' ? 'doll-rabbit-v2' : 'v2-mind'}`;
        el.style.left = `${startX}px`;

        const hpBar = document.createElement('div');
        hpBar.className = 'ally-hp';
        hpBar.style.width = '100%';
        if (baby) {   // 새끼 괴수는 산성 초록 체력바
            hpBar.style.background = '#aaff28';
            hpBar.style.boxShadow = '0 0 6px #aaff28';
        } else if (kind === 'chimera') {
            hpBar.style.background = '#ff9628';
            hpBar.style.boxShadow = '0 0 6px #ff9628';
        } else if (kind === 'stitch') {
            hpBar.style.background = '#ff4d6d';
            hpBar.style.boxShadow = '0 0 6px #ff4d6d';
        } else if (kind === 'rabbit') {
            hpBar.style.background = '#5ae6f0';
            hpBar.style.boxShadow = '0 0 6px #5ae6f0';
        }
        el.appendChild(hpBar);

        this.domEnemies.appendChild(el);

        const ally = {
            id: allyId,
            kind,
            x: startX,
            hp: maxHp,
            maxHp: maxHp,
            dps: dps,
            speed: opts.speed ?? this.playerSpeed * (baby ? BABY.speedMul : 0.55),
            dom: el,
            hpBar: hpBar
        };
        this.allies.push(ally);

        if (kind === 'chimera') this.fx.play(CHIMERA_VFX.summon, startX + 38, FOOT_B);
        const label = { baby_kaiju: '🥚 새끼 괴수 부화!', chimera: '👹 졸개 소환!', stitch: '✚ 봉합 부활!', rabbit: '🐰 인형 가족!' }[kind] || '★ 세뇌 징집! (MIND CONTROL)';
        this.createDamagePopup(startX, 180, label, false);
        return ally;
    },

    // 아군 미니언이 피해를 받음 (0 이하면 사라짐)
    damageAlly(ally, amount) {
        amount *= Math.max(0.1, 1 - (this.kitMod?.('allyDef') || 0));   // 2차 세트: 아군 받는 피해 감소 (방패 진형·군주의 가호·성운 장막)
        if (ally.supportShield > 0) {
            const absorbed = Math.min(ally.supportShield, amount);
            ally.supportShield -= absorbed;
            amount -= absorbed;
        }
        ally.hp -= amount;
        if (ally.hpBar) ally.hpBar.style.width = `${Math.max(0, (ally.hp / ally.maxHp) * 100)}%`;
        if (ally.hp <= 0) this.removeAlly(ally);
    },

    /** 아군이 쓰러짐: 지우고 알림 (토끼 인형은 솜이 터짐 — doll.js onAllyDown) */
    removeAlly(ally) {
        if (!this.allies.includes(ally)) return;
        if (ally.dom) ally.dom.remove();
        this.allies = this.allies.filter(a => a.id !== ally.id);
        this.onAllyDown(ally);
        this.onSetAllyDown(ally);   // 조직 사령관 4부위: 졸개 폭발 (sets.js)
        this.kitOnAllyDown(ally);   // 2차 소환물 폭발·군단 보급 (kit.js)
    },

    /** 아군 이동·공격: 가장 가까운 적(뒤로 35px까지)과 붙으면 싸우고, 아니면 앞으로 (주인공보다 너무 멀리 가지 않음) */
    tickAllies(dt) {
        this.allies.forEach(ally => {
            let closestEnemyToAlly = null;
            let minAllyDist = Infinity;

            this.enemies.forEach(enemy => {
                const dist = enemy.x - ally.x;
                if (dist >= -35 && dist < minAllyDist) {
                    minAllyDist = dist;
                    closestEnemyToAlly = enemy;
                }
            });

            // 거점을 이미 지나친 아군(거점이 나중에 생겨 소환 자리보다 앞에 있게 됨 등)은 더 가지 않고 거점을 침 —
            // 바로 앞에 붙은 적이 있으면 그 적이 먼저 (11-03 QA: 거점 공격을 못 하고 계속 전진)
            if (!(closestEnemyToAlly && !closestEnemyToAlly.isBuilding && minAllyDist <= 65)) {
                const passed = this.enemies.find(e => e.isBuilding && e.x - ally.x < -35);
                if (passed) { closestEnemyToAlly = passed; minAllyDist = 0; }
            }

            const hitRange = (closestEnemyToAlly && closestEnemyToAlly.isBuilding) ? 110 : 65;
            // 싸우는 중이면 조금 밀려나도 계속 · 시작한 공격 동작은 잠깐 끝까지 (ALLY_FIGHT — 공격·걷기가 매 순간 바뀌던 것, 11-08 QA)
            const fighting = !!closestEnemyToAlly && minAllyDist <= hitRange + (ally.attacking ? ALLY_FIGHT.stick : 0);
            if (ally.atkHold > 0) ally.atkHold -= dt;
            const swinging = fighting || (!!ally.attacking && ally.atkHold > 0 && !!closestEnemyToAlly);
            if (swinging !== !!ally.attacking) {   // 싸우는 동안 공격 동작 (그림이 있는 아군)
                ally.attacking = swinging;
                if (swinging) ally.atkHold = ALLY_FIGHT.hold;
                if (ally.dom) ally.dom.classList.toggle('is-attacking', swinging);
            }
            if (swinging && !fighting) {
                // 휘두르던 동작을 마저 끝냄 (제자리)
            } else if (fighting) {
                if (!ally.supportOwner || this.support?.active?.elapsed < (this.support?.active?.exitAt ?? SUPPORT.exitAt)) {
                    const mul = ally.supportOwner ? 1 : this.allyDmgMul() * this.supportAttackMul();
                    this.dealDamageToEnemy(closestEnemyToAlly, ally.dps * mul * dt, false,
                        { dot: true, source: ally.supportOwner ? 'support' : 'ally', supportGear: ally.supportGear });
                }

                if (closestEnemyToAlly.isBuilding) {
                    this.damageAlly(ally, 25 * dt);
                }
            } else if (closestEnemyToAlly || ally.x < this.monsterX + 180) {
                ally.x += ally.speed * dt;
                if (ally.dom) ally.dom.style.left = `${ally.x}px`;
            }
        });
    },

    // [타락 히어로 머리] 세뇌 파동: 시전 동작 → 보라 구체가 쓰러진 적 자리로 → 소용돌이 속에서 아군으로
    recruit(x) {
        monsterControllerV2.playCast(() => this.mindOrb(x));
    },

    // 손끝에서 세뇌 구체 → x 자리에서 소용돌이 → 아군 미니언
    mindOrb(x) {
        if (!this.isActive) return;
        const tx = x + 38;
        const from = monsterControllerV2.getSocketPoint('hand', 'armF') || { x: this.monsterX + 90, bottom: 130 };
        this.fx.play(HERO_VFX.castRelease, from.x, from.bottom);
        this.fx.launchOrb(from, () => ({ x: tx, b: 90 }), HERO_ORB.color, HERO_ORB.dur, () => {
            this.fx.play(HERO_VFX.mindConvert, tx, 58);
            this.schedule(0.35, () => {
                if (this.isActive && !this.finalBaseDestroyed) this.spawnAllyMinion(x);
            });
        });
    },

    // [대세뇌] 살아 있는 적 보병을 즉시 아군으로 (보상 없이 전장에서 제거 후 세뇌 미니언 소환)
    convertEnemy(e) {
        // 보스·바리케이드·움직이지 않는 것은 세뇌 안 됨 — 보스가 목록에서 빠지면 승리 조건이 사라짐 (11-14 버그 점검 S1)
        if (!this.enemies.includes(e) || e.isBuilding || e.isBarricade || e.boss || (e.t && e.t.static)) return;
        this.dropStatues(e);   // 열기 주술사를 세뇌하면 못 깨운 조각상도 부서짐 (enemyField.js)
        this.enemies = this.enemies.filter(o => o !== e);
        if (e.dom) e.dom.remove();
        this.mindOrb(e.x);
    },

    // [거대괴수 몸통 스킬 '산란'] 발밑에 알 → 부화하면 새끼 괴수(아군). cap: 새끼 최대 수
    layEgg(x, cap) {
        const babies = this.allies.filter(a => a.kind === 'baby_kaiju').length;
        if (babies + this.pendingEggs >= cap) return;
        this.pendingEggs += 1;
        this.fx.addEgg(x, EGG.hatchSec, () => {
            this.pendingEggs -= 1;
            if (this.isActive && !this.finalBaseDestroyed) this.spawnAllyMinion(x - 30, 'baby_kaiju');
        });
    }
};
