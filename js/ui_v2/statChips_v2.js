/**
 * 머리 위 버프·디버프 칩 (2026-11-23): 효과 이름 대신 "바뀌는 능력치 하나 = 칩 하나"
 *   예: 공격 약화(주는 피해 −25%) → [공격 −25%] · 오버드라이브 → [공속 +50%] [이속 +40%] [방어 +30%]
 * - 같은 능력치는 한 칩으로 합침: 방어(받는 피해 감소)는 곱으로(50% + 30% → 65%, 전투 계산과 같음), 나머지는 더함
 *   공속은 전투(kit.js)처럼 오버드라이브 배율과 2차 버프 합 중 큰 쪽
 * - 시간 = 그 능력치에 걸린 효과 중 가장 늦게 끝나는 것 (먼저 끝나는 효과가 빠지면 값이 저절로 줄어듦)
 * - 이로움(up) 초록 · 해로움(down) 빨강 · 행동 불가(cc: 기절·속박) 노랑 · 능력치로 못 나누는 특수 효과(special)는 아이콘 + 시간만
 * - 칩 이름(두 글자)·아이콘·순서는 아래 STATS 표 한 곳에서 바꿈. 받는 피해는 '방어'(취약 = 방어 −30%)
 * 읽는 값은 엔진의 지금 판정뿐 (buffMarks_v2.js의 activePlayerBuffs와 같은 원천) — 따로 타이머를 돌리지 않음
 */
import { PLAYER_STATUS, SET, FROST } from '../engine_v2/battle/tuning.js';
import { fmtK } from './fmt_v2.js';

// 쌓는 순서 = 표 순서 (머리에 가까운 쪽부터): 행동 불가 → 해로운 능력치 → 이로운 능력치 → 상태 → 특수
// fmt: pct(±N%) · cd(쿨타임 −N%) · perSec(N%/초) · flat(N%) · times(N회) · amount(남은 양) · mul(×N) · none(이름만)
const STATS = {
    stun:     { label: '기절', icon: 'stun',     kind: 'cc' },
    root:     { label: '속박', icon: 'net',      kind: 'cc' },
    atk:      { label: '공격', icon: 'swords',   fmt: 'pct' },
    def:      { label: '방어', icon: 'shield',   fmt: 'pct', combine: 'mult' },
    rdef:     { label: '원방', icon: 'shield',   fmt: 'pct', combine: 'mult' },
    spd:      { label: '공속', icon: 'bolt',     fmt: 'pct', combine: 'spd' },
    move:     { label: '이속', icon: 'speed',    fmt: 'pct' },
    cd:       { label: '쿨감', icon: 'clock',    fmt: 'cd' },
    ult:      { label: '필살', icon: 'star',     fmt: 'pct' },
    dodge:    { label: '회피', icon: 'whirl',    fmt: 'pct' },
    res:      { label: '저항', icon: 'mind',     fmt: 'pct' },
    regen:    { label: '재생', icon: 'redcross', fmt: 'perSec' },
    drain:    { label: '소모', icon: 'blood',    fmt: 'perSec', bad: true },
    steal:    { label: '흡혈', icon: 'oath',     fmt: 'flat' },
    heal:     { label: '치유', icon: 'redcross', fmt: 'pct' },
    ally:     { label: '소환', icon: 'minions',  fmt: 'pct' },
    allyDef:  { label: '호위', icon: 'shield',   fmt: 'pct', combine: 'mult' },
    reflect:  { label: '반사', icon: 'thorns',   fmt: 'flat' },
    guard:    { label: '방패', icon: 'shield',   fmt: 'times' },
    shield:   { label: '보호', icon: 'shield',   fmt: 'amount' },
    next:     { label: '일격', icon: 'fist',     fmt: 'mul', combine: 'max' },
    invuln:   { label: '무적', icon: 'shield',   fmt: 'none' },
    block:    { label: '차단', icon: 'shield',   fmt: 'none' },
    immune:   { label: '면역', icon: 'sealring', fmt: 'none' },
    unmoved:  { label: '부동', icon: 'anchor',   fmt: 'none' },
    unslowed: { label: '질주', icon: 'speed',    fmt: 'none' }
};
const ORDER = Object.keys(STATS);
const FLAG_STAT = { invuln: 'invuln', projBlock: 'block', ccImmune: 'immune', knockImmune: 'unmoved', slowImmune: 'unslowed' };
const QUIET_FLAGS = new Set(['ignoreHazard', 'ownLanding']);   // 표시할 것 없는 판정용 표시
// 2차 버프 mods → 능력치 (값이 그대로 이로운 쪽 양수)
const MOD_STAT = { dmg: 'atk', def: 'def', rangedCut: 'rdef', atkSpd: 'spd', move: 'move', cdRate: 'cd', ult: 'ult',
    regen: 'regen', drain: 'drain', lifesteal: 'steal', healAmp: 'heal', ccCut: 'res', allyDmg: 'ally', allyDef: 'allyDef' };

const pctNum = v => Math.round(Math.abs(v) * 100);

/** 엔진에서 지금 걸린 효과를 능력치 칩 목록으로 */
export function playerStatChips(b) {
    if (!b?.isActive) return [];
    const acc = new Map();   // key(+/-) → { stat, sign, sum, keep, max, t, duration, sources }
    const put = (stat, value, t, duration, source) => {
        const def = STATS[stat];
        if (!def) return;
        const valued = def.fmt && !['none'].includes(def.fmt);
        if (valued && !(Math.abs(value) > 0.004)) return;   // 0이면 안 보임
        const sign = def.kind === 'cc' || def.fmt === 'none' ? 1 : Math.sign(value) || 1;
        const id = `${stat}${sign < 0 ? '-' : '+'}`;
        let e = acc.get(id);
        if (!e) acc.set(id, e = { stat, sign, sum: 0, keep: 1, max: 0, t: 0, duration: 0, sources: [] });
        const v = Math.abs(value);
        e.sum += v;
        e.keep *= 1 - Math.min(0.9, v);
        e.max = Math.max(e.max, v);
        if (t > e.t) { e.t = t; e.duration = duration || 0; }   // 0 = 모름 → buffMarks가 처음 본 남은 시간을 기억해 막대 기준으로
        if (source && !e.sources.includes(source)) e.sources.push(source);
    };
    const specials = [];

    // 디버프 (주인공 상태 이상)
    if (b.pStunT > 0) put('stun', 1, b.pStunT, 0, '기절 · 이동·공격·스킬 사용 불가');
    if (b.pRootT > 0) put('root', 1, b.pRootT, 0, '속박 · 이동 불가');
    if (b.pSlowT > 0) put('move', -(1 - PLAYER_STATUS.slowMove), b.pSlowT, 0, '감속');
    if (b.pVulnT > 0) put('def', -(b.pVulnMore || 0), b.pVulnT, 0, '취약 · 받는 피해 증가');
    if (b.pWeakT > 0) put('atk', -(b.pWeakCut || 0), b.pWeakT, 0, '공격 약화 · 주는 피해 감소');

    // 1차 세트 버프 (b.buffs)
    const L = b.buffs || {};
    const legacy = (key, name, list) => {
        const buff = L[key];
        if (!(buff?.t > 0)) return;
        for (const [stat, v] of list) put(stat, v, buff.t, buff.duration, name);
    };
    legacy('overdrive', '오버드라이브', [['spd', SET.overdrive.atk - 1], ['move', SET.overdrive.move], ['def', SET.overdrive.reduce]]);
    legacy('adrenaline', '아드레날린 주입', [['atk', SET.adrenaline.dmg]]);
    legacy('thornArmor', '가시 갑옷', [['def', SET.thorn.reduce], ['reflect', SET.thorn.reflect]]);
    legacy('bloodOath', '어둠의 서약', [['steal', SET.blood.ratio]]);
    legacy('mobilize', '총동원령', [['ally', SET.mobilize.allyMul - 1]]);
    legacy('boost', '강화 주사', [['ally', SET.boost.allyMul - 1]]);

    // 2차 버프 (스킬·세트, b.kitBuffs)
    for (const [key, buff] of Object.entries(b.kitBuffs || {})) {
        if (!(buff.t > 0)) continue;
        const mods = buff.mods || {};
        if (mods.guard > 0 && (buff.used || 0) >= mods.guard && Object.keys(mods).every(k => ['guard', 'onEnd'].includes(k))) continue;   // 다 쓴 방패
        const skills = Object.values(b.skills || {}).filter(Boolean);
        const skill = skills.find(s => s.id === key) || skills.find(s => (s.steps || []).some(st => st.do === 'buff' && st.key === key));   // 세트 효과로 붙는 버프도 그 스킬 이름으로
        const name = buff.display?.name || skill?.name || '스킬 효과';
        let shown = 0;
        const add = (stat, v) => { if (STATS[stat]) { put(stat, v, buff.t, buff.duration, name); shown++; } };
        for (const [m, stat] of Object.entries(MOD_STAT)) if (mods[m]) add(stat, mods[m]);
        const dodge = (mods.dodge || 0) + Math.max(mods.dodgeMelee || 0, mods.dodgeRanged || 0);
        if (dodge) add('dodge', dodge);
        if (mods.guard > (buff.used || 0)) add('guard', mods.guard - (buff.used || 0));
        if (mods.reflectStatus || mods.rangedReflect) add('reflect', mods.rangedReflect || 0.0001);
        for (const f of mods.flags || []) if (FLAG_STAT[f]) add(FLAG_STAT[f], 1);
        // 능력치로 못 나눈 효과(캐릭터 전용 판정 — 마왕 강림·아빠 곰 등, 끝날 때 폭발만 있는 것)는 스킬 아이콘 + 시간만
        const onlyQuiet = (mods.flags || []).length > 0 && mods.flags.every(f => QUIET_FLAGS.has(f));
        if (!shown && !onlyQuiet) specials.push({ id: `kit:${key}`, icon: buff.display?.icon || skill?.icon || 'overdrive', name, t: buff.t, duration: buff.duration || buff.t });
    }

    // 그 밖의 상태
    const shieldAmt = (b.shieldHp > 0 && b.shieldTimer > 0 ? b.shieldHp : 0) + (b.supportShield > 0 ? b.supportShield : 0);
    if (shieldAmt > 0) put('shield', shieldAmt, b.shieldHp > 0 && b.shieldTimer > 0 ? b.shieldTimer : Infinity, b.shieldDuration, '보호막 · 체력 대신 피해 흡수');
    if (b.blizzard?.t > 0) put('def', FROST.blizzardGuard, b.blizzard.t, FROST.blizzardSec, '눈보라 춤');
    if (b.ccImmuneT > 0) put('immune', 1, b.ccImmuneT, b.ccImmuneDuration, '상태 이상 면역');
    if (b.kitNextMul > 1) put('next', b.kitNextMul, Infinity, 0, '다음 공격 강화');
    if (b.kitXform?.t > 0 && !b.kitBuffs?.[`xform_${b.kitXform.key}`])
        specials.push({ id: 'transform', icon: 'overdrive', name: '변신 강화', t: b.kitXform.t, duration: b.kitXform.duration || b.kitXform.t });

    // 칩으로
    const chips = [];
    for (const e of acc.values()) {
        const def = STATS[e.stat];
        const v = def.combine === 'mult' ? 1 - e.keep : def.combine === 'max' ? e.max : def.combine === 'spd' ? Math.max(e.max, e.sum) : e.sum;
        const s = e.sign < 0 ? '−' : '+';
        const value = def.fmt === 'pct' ? `${s}${pctNum(v)}%`
            : def.fmt === 'cd' ? `−${pctNum(1 - 1 / (1 + v))}%`
                : def.fmt === 'perSec' ? `${+(v * 100).toFixed(v * 100 < 1 ? 1 : 0)}%/초`
                    : def.fmt === 'flat' ? (v >= 0.01 ? `${pctNum(v)}%` : '')
                        : def.fmt === 'times' ? `${Math.round(v)}회`
                            : def.fmt === 'amount' ? fmtK(Math.round(v))
                                : def.fmt === 'mul' ? `×${+v.toFixed(1)}` : '';
        const kind = def.kind === 'cc' ? 'cc' : (def.bad ? -e.sign : e.sign) < 0 ? 'down' : 'up';
        chips.push({ id: `${e.stat}${e.sign < 0 ? '-' : '+'}`, order: ORDER.indexOf(e.stat), label: def.label, value, icon: def.icon, kind,
            t: e.t, duration: e.duration, title: `${def.label} ${value}`.trim() + (e.sources.length ? ` — ${e.sources.join(', ')}` : '') });
    }
    // 순서: 행동 불가 → 해로움 → 이로움 (각각 표 순서) → 특수
    const rank = { cc: 0, down: 1, up: 2 };
    chips.sort((a, c) => (rank[a.kind] - rank[c.kind]) || (a.order - c.order));
    for (const sp of specials) chips.push({ id: sp.id, label: '', value: '', icon: sp.icon, kind: 'special', t: sp.t, duration: sp.duration, title: sp.name });
    return chips;
}
