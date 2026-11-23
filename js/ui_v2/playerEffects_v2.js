import { activePlayerBuffs, activePlayerDebuffs } from './buffMarks_v2.js';
import { SET } from '../engine_v2/battle/tuning.js';

const pct = n => `${Math.round(n * 100)}%`;
const LEGACY_DESC = {
    overdrive: `공격 속도 ×${SET.overdrive.atk} · 이동 +${pct(SET.overdrive.move)} · 피해 −${pct(SET.overdrive.reduce)}`,
    adrenaline: `주는 피해 +${pct(SET.adrenaline.dmg)}`,
    thornArmor: `피해 −${pct(SET.thorn.reduce)} · 피해 반사`,
    bloodOath: `준 피해의 ${pct(SET.blood.ratio)} 회복`,
    mobilize: `소환수 피해 ×${SET.mobilize.allyMul}`,
    boost: `소환수 피해 ×${SET.boost.allyMul}`
};
function modDescription(mods = {}) {
    const names = { dmg: '주는 피해', def: '피해 감소', move: '이동 속도', atkSpd: '공격 속도', cdRate: '재사용 회복', ult: '궁극기 충전', regen: '초당 체력 회복', lifesteal: '흡혈', allyDmg: '소환수 피해', drain: '초당 체력 소모', healAmp: '회복량', rangedCut: '원거리 피해 감소', dodge: '회피' };
    const bits = Object.entries(names).filter(([key]) => mods[key]).map(([key, name]) => `${name} ${mods[key] > 0 ? '+' : '−'}${pct(Math.abs(mods[key]))}`);
    const flags = { invuln: '무적', projBlock: '투사체 차단', ccImmune: '상태 이상 면역' };
    for (const flag of mods.flags || []) if (flags[flag]) bits.push(flags[flag]);
    if (mods.guard > 0) bits.push(`공격 ${mods.guard}회 방어`);
    return bits.join(' · ');
}
/** 엔진의 실제 활성 효과와 남은 시간만 읽어 프로필에 표시한다. */
export function playerEffectLabels(b) {
    if (!b.isActive) return [];
    const positive = activePlayerBuffs(b).map(effect => {
        const key = effect.id.split(':')[1];
        const buff = b.kitBuffs?.[key];
        const desc = effect.id.startsWith('legacy:') ? LEGACY_DESC[key]
            : buff ? modDescription(buff.mods) || buff.display?.desc || b.skills && Object.values(b.skills).find(s => s.id === key)?.desc
            : effect.id === 'shield' || effect.id === 'support-shield' ? '체력 대신 피해 흡수'
            : effect.id === 'next-hit' ? `다음 공격 피해 ×${b.kitNextMul}` : '';
        return { ...effect, desc: desc || '', negative: false };
    });
    return [...activePlayerDebuffs(b), ...positive];
}
