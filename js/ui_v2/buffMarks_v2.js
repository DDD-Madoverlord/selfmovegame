import { icon } from './icons.js';

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

export class BuffMarks {
    constructor(engine, monster) {
        this.b = engine;
        this.monster = monster;
        this.nodes = new Map();
        this.root = document.createElement('div');
        this.root.className = 'v2-buff-marks';
        this.root.setAttribute('role', 'group');
        this.root.setAttribute('aria-label', '활성 강화 효과');
        this.root.hidden = true;
        monster?.appendChild(this.root);
    }

    update() {
        const buffs = this.b.isActive ? activePlayerBuffs(this.b) : [];
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
                node.innerHTML = `<span class="v2-buff-mark__icon"></span><span class="v2-buff-mark__time"></span>`;
                this.nodes.set(buff.id, node);
                this.root.appendChild(node);
            }
            const label = `${buff.name}${Number.isFinite(buff.t) ? ` · ${Math.ceil(buff.t)}초` : ''}`;
            if (node.title !== label) { node.title = label; node.setAttribute('aria-label', label); }
            if (node.dataset.icon !== buff.icon) {
                node.querySelector('.v2-buff-mark__icon').innerHTML = icon(buff.icon, 18);
                node.dataset.icon = buff.icon;
            }
            node.style.setProperty('--buff-color', buff.color);
            node.style.setProperty('--buff-left', Number.isFinite(buff.t) ? Math.min(1, buff.t / buff.duration) : 1);
            const time = Number.isFinite(buff.t) ? String(Math.ceil(buff.t)) : '';
            const num = node.querySelector('.v2-buff-mark__time');
            if (num.textContent !== time) num.textContent = time;
        }
    }

    destroy() { this.root.remove(); this.nodes.clear(); }
}
