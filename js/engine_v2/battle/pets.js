/* 펫은 아군 배열과 분리한다. 추종·공격은 전투의 게임 시간 dt만 사용한다. */
import { progress } from '../progress_v2.js';
import { PET_ATTACK_SECONDS, petValue } from '../pets_v2.js';
import { FOOT_B } from './tuning.js';

export const PetBattleMethods = {
    setupPet() {
        this.clearPet();
        const p = progress.equippedPet();
        this.petBonuses = { battleDm: progress.petBattleDmBonus(), cdr: progress.petCooldownBonus() };
        if (!p || !this.domEnemies) return;
        const dom = document.createElement('div');
        dom.className = 'v2-pet v2-pet--battle';
        dom.setAttribute('aria-hidden', 'true');
        dom.style.setProperty('--pet-color', p.color);
        if (p.art.startsWith('shape:')) dom.dataset.shape = p.art.slice(6);
        else { const img = document.createElement('img'); img.src = p.art; img.alt = ''; dom.appendChild(img); }
        this.domEnemies.appendChild(dom);
        this.pet = { id: p.id, x: this.monsterX - 60, time: 0, attackTimer: 0,
            attack: p.effect === 'attack' ? petValue(p.id, p.level) : 0, dom };
        this.drawPet();
    },
    drawPet() {
        const p = this.pet;
        if (!p) return;
        p.dom.style.left = `${p.x}px`;
        p.dom.style.bottom = `${FOOT_B + 35 + Math.sin(p.time * 3) * 4}px`;
    },
    tickPet(dt) {
        const p = this.pet;
        if (!p || dt <= 0 || !this.isActive || this.finalBaseDestroyed || this.timeUp) return;
        p.time += dt;
        p.x += (this.monsterX - 60 - p.x) * (1 - Math.exp(-8 * dt));
        this.drawPet();
        if (!p.attack) return;
        p.attackTimer += dt;
        if (p.attackTimer + 1e-9 < PET_ATTACK_SECONDS) return;
        p.attackTimer = Math.max(0, p.attackTimer - PET_ATTACK_SECONDS) % PET_ATTACK_SECONDS;   // 사거리 밖에서 지난 공격 기회를 쌓지 않음
        const front = this.frontX();
        const target = this.enemies.filter(e => e.hp > 0 && !e.invulnerable && e.x >= front - 60 && e.x - front <= this.playerRange)
            .sort((a, b) => Math.abs(a.x - front) - Math.abs(b.x - front))[0];
        if (target) this.dealDamageToEnemy(target, this.playerDps * p.attack * PET_ATTACK_SECONDS, false, { dot: true });
    },
    clearPet() {
        this.pet?.dom.remove();
        this.pet = null;
        this.petBonuses = null;
    }
};
