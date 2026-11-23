import { PLAYER_STATUS } from '../engine_v2/battle/tuning.js';
import { icon } from './icons.js';
import { playerStatChips } from './statChips_v2.js';

// 머리 위로 쌓는 칩 수 — 넘치면 맨 위가 '+N' (말풍선에 나머지). 휴대폰은 캐릭터 위 자리가 좁아 6
const maxChips = () => (document.body.classList.contains('v2-mobile') ? 6 : 8);

const LEGACY = {
    overdrive: ['오버드라이브', 'overdrive', '#ffd66b'],
    adrenaline: ['아드레날린 주입', 'fist', '#ffb56a'],
    thornArmor: ['가시 갑옷', 'thorns', '#b3ec72'],
    bloodOath: ['어둠의 서약', 'oath', '#ce9aff'],
    mobilize: ['총동원령', 'horn', '#ffcf7b'],
    boost: ['강화 주사', 'injector', '#8df5a5']
};

function inferred(mods = {}) {
    if (mods.regen > 0 || mods.healAmp > 0) return { name: '지속 회복', icon: 'redcross', color: '#8cf5a7' };
    if (mods.def > 0 || mods.rangedCut > 0 || mods.guard > 0 || mods.flags?.some(f => ['invuln', 'projBlock', 'ccImmune'].includes(f)))
        return { name: '방어 강화', icon: 'shield', color: '#8de7ff' };
    if (mods.atkSpd > 0 || mods.move > 0 || mods.cdRate > 0) return { name: '속도 강화', icon: 'overdrive', color: '#ffe08b' };
    if (mods.hitStatus) return { name: '속성 강화', icon: 'fire', color: '#ffb277' };
    return { name: '공격 강화', icon: 'swords', color: '#ffba82' };
}

/** 표시용 타이머를 따로 돌리지 않는다. 현재 판정에 남은 효과만 읽는다. */
export function activePlayerBuffs(b) {
    const entries = [];
    for (const [key, buff] of Object.entries(b.buffs || {})) {
        if (!(buff.t > 0)) continue;
        const [name, glyph, color] = LEGACY[key] || ['강화 효과', 'overdrive', '#a9efba'];
        entries.push({ id: `legacy:${key}`, name, icon: glyph, color, t: buff.t, duration: buff.duration || buff.t });
    }
    for (const [key, buff] of Object.entries(b.kitBuffs || {})) {
        if (!(buff.t > 0)) continue;
        if (buff.mods?.guard > 0 && buff.used >= buff.mods.guard &&
            Object.keys(buff.mods).every(k => ['guard', 'onEnd'].includes(k))) continue;
        const skill = Object.values(b.skills || {}).find(s => s.id === key);
        const display = (buff.display?.name && buff.display) || skill || inferred(buff.mods);
        entries.push({ id: `kit:${key}`, name: display.name, icon: display.icon || 'overdrive',
            color: display.color || '#a9efba', t: buff.t, duration: buff.duration || buff.t });
    }
    if (b.shieldHp > 0 && b.shieldTimer > 0) entries.push({ id: 'shield', name: '보호막', icon: 'shield', color: '#91eaff',
        t: b.shieldTimer, duration: b.shieldDuration || b.shieldTimer });
    if (b.supportShield > 0) entries.push({ id: 'support-shield', name: '협력 보호막', icon: 'shield', color: '#ffe09a',
        t: Infinity, duration: Infinity });
    if (b.blizzard?.t > 0) entries.push({ id: 'blizzard', name: '눈보라 춤 · 받는 피해 감소', icon: 'icecage', color: '#bcefff',
        t: b.blizzard.t, duration: b.blizzard.duration || 4 });
    if (b.ccImmuneT > 0) entries.push({ id: 'cc-immune', name: '상태 이상 면역', icon: 'shield', color: '#c5b6ff',
        t: b.ccImmuneT, duration: b.ccImmuneDuration || b.ccImmuneT });
    if (b.kitNextMul > 1) entries.push({ id: 'next-hit', name: '다음 공격 강화', icon: 'swords', color: '#ffbd72',
        t: Infinity, duration: Infinity });
    if (b.kitXform?.t > 0 && !b.kitBuffs?.[`xform_${b.kitXform.key}`]) entries.push({ id: 'transform', name: '변신 강화',
        icon: 'overdrive', color: '#dab3ff', t: b.kitXform.t, duration: b.kitXform.duration || b.kitXform.t });
    return entries;
}

/** 프로필 설명과 머리 위 아이콘이 같은 디버프 판정을 사용한다. */
export function activePlayerDebuffs(b) {
    const pct = n => `${Math.round(n * 100)}%`;
    return [
        ['pStunT', '기절', 'stun', '이동·공격·스킬 사용 불가'],
        ['pRootT', '속박', 'net', '이동 불가'],
        ['pSlowT', '감속', 'slow', `이동 속도 −${pct(1 - PLAYER_STATUS.slowMove)}`],
        ['pVulnT', '취약', 'acid', `받는 피해 +${pct(b.pVulnMore || 0)}`],
        ['pWeakT', '공격 약화', 'mute', `주는 피해 −${pct(b.pWeakCut || 0)}`]
    ].filter(([key]) => b[key] > 0).map(([id, name, glyph, desc]) => ({
        id, name, icon: glyph, desc, t: b[id], negative: true, color: '#ff7187'
    }));
}

export class BuffMarks {
    constructor(engine, monster) {
        this.b = engine;
        this.monster = monster;
        this.nodes = new Map();
        this.root = document.createElement('div');
        this.root.className = 'v2-buff-marks';
        this.root.setAttribute('role', 'group');
        this.root.setAttribute('aria-label', '활성 버프 및 디버프');
        this.root.hidden = true;
        monster?.appendChild(this.root);
    }

    /**
     * 머리 위 칩 (11-23): 능력치 하나 = 칩 하나 [아이콘 공격 −25% | 4] (statChips_v2.js), 체력바 위에서 위로 쌓음.
     * 순서(아래 → 위) = 행동 불가 → 해로움 → 이로움 → 특수. 칩 아래 얇은 막대 = 남은 시간 비율. 예전 초상화 아래 설명 칸은 없앰
     */
    update() {
        const all = this.b.isActive ? playerStatChips(this.b) : [];
        const max = maxChips();
        const buffs = all.length > max
            ? [...all.slice(0, max - 1), { id: 'more', label: `+${all.length - max + 1}`, value: '', icon: '', kind: 'more', t: Infinity,
                title: all.slice(max - 1).map(c => c.title).join('\n') }]
            : all;
        const ids = new Set(buffs.map(buff => buff.id));
        for (const [id, node] of this.nodes) if (!ids.has(id)) { node.remove(); this.nodes.delete(id); }
        this.root.hidden = !buffs.length;
        if (!buffs.length) return;
        const hp = this.monster?.querySelector('.monster-hp-container');
        this.root.style.left = `${hp ? hp.offsetLeft + hp.offsetWidth / 2 : 35}px`;
        this.root.style.top = `${hp ? hp.offsetTop - 9 : -75}px`;
        for (const buff of buffs) {
            let node = this.nodes.get(buff.id);
            if (!node) {
                node = document.createElement('span');
                node.className = 'v2-buff-mark';
                node.dataset.buffId = buff.id;
                node.setAttribute('role', 'img');
                node.innerHTML = `<span class="v2-buff-mark__icon"></span><span class="v2-buff-mark__text"><b></b><em></em></span><span class="v2-buff-mark__time"></span>`;
                this.nodes.set(buff.id, node);
                this.root.appendChild(node);
            }
            const cls = `v2-buff-mark is-${buff.kind}${buff.kind === 'down' || buff.kind === 'cc' ? ' is-debuff' : ''}`;
            if (node.className !== cls) node.className = cls;
            node.style.order = String(buffs.indexOf(buff));   // column-reverse: 0번이 맨 아래(머리 쪽)
            const label = `${buff.title}${Number.isFinite(buff.t) ? ` · ${Math.ceil(buff.t)}초` : ''}`;
            if (node.title !== label) { node.title = label; node.setAttribute('aria-label', label); }
            if (node.dataset.icon !== buff.icon) {
                node.querySelector('.v2-buff-mark__icon').innerHTML = buff.icon ? icon(buff.icon, 14) : '';
                node.dataset.icon = buff.icon;
            }
            const b = node.querySelector('.v2-buff-mark__text b'), em = node.querySelector('.v2-buff-mark__text em');
            if (b.textContent !== buff.label) b.textContent = buff.label;
            if (em.textContent !== buff.value) em.textContent = buff.value;
            const duration = buff.duration || Math.max(Number(node.dataset.duration) || 0, buff.t);
            node.dataset.duration = String(duration);
            node.style.setProperty('--buff-left', Number.isFinite(buff.t) ? Math.min(1, buff.t / duration) : 1);
            const time = Number.isFinite(buff.t) ? String(Math.ceil(buff.t)) : '';
            const num = node.querySelector('.v2-buff-mark__time');
            if (num.textContent !== time) num.textContent = time;
        }
    }

    destroy() { this.root.remove(); this.nodes.clear(); }
}
