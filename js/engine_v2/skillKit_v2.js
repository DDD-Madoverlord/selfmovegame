/* ==========================================================================
   PROJECT: MAD OVERLORD // 스킬 부품 (파츠 확장 2차, Q-009 · D-071 — MD/파츠확장_2차_기획안.md 3장)
   새 세트 스킬을 하나하나 코드로 짜지 않고 "단계(steps)" 데이터로 만든다.
     스킬 = { name, slot, cd, icon, color, target('enemy'|'self'), range, desc,
              clip?(리그 동작 — 없으면 공격 동작), cast?(true면 동작의 'cast' 순간에 단계 시작), sfx?(시작 소리),
              p?(값 표 — 세트 효과가 고침), steps: [{ at(초), do, ...값 }] }
     단계 do: hit · line · rain · wave · chain · zone · pull · push · dash · blink · buff · shield · heal · cleanse ·
              summon · screen · transform · fx · shake · gauge · custom
     값에 '$이름'을 쓰면 p에서 읽고, 켜진 세트 효과의 고침(b.kitPatch[스킬 id])을 더함 — 예: count: '$count'
   상태(status): { stun, slow, root, freeze, chill, burn:[초, 초당 배율], poison:[초, 배율], vuln:[초, 비율], weak:[초, 비율],
                   fear, sleep, acid, mark:[초, 비율] } — 전투 쪽 b.kitStatus (battle/kit.js)
   피해 dmg = 기본 공격 1타(b.unit()) 배수, 지속 피해(dps·burn·poison) = b.playerDps 배수.
   세트 데이터(파츠·스킬·패시브·세트 효과)는 sets2/*.js가 registerSets2로 등록.
   ========================================================================== */

import { monsterControllerV2 as monster } from './monster_v2.js';
import { sound } from './audio/sound_v2.js';
import { aimAt } from './bases_v2.js';
import { FOOT_B } from './battle/tuning.js';
import { imageField } from './vfx/imageEffects.js';

/** 다리 파츠 id → 부품 패시브 (registerSets2가 채움, battle/kit.js가 읽음) */
export const KIT_PASSIVES = {};

// ---- 이펙트 도우미 ----
/** 그림 시트 한 층 (hue = 색 돌리기 도) */
export const spr = (sheet, size, extra = {}) => ({ type: 'sprite', sheet, at: 0, dur: 0.5, size, glow: 1.1, ...extra });
/** 이펙트 정의 { layers } 만들기 */
export const fxOf = (...layers) => ({ layers: layers.flat() });

// ---- 값 읽기 (세트 효과 고침 반영) ----
function val(b, ctx, v) {
    if (typeof v !== 'string' || v[0] !== '$') return v;
    const key = v.slice(1);
    const base = ctx.skill.p ? ctx.skill.p[key] : undefined;
    const patch = b.kitPatch?.[ctx.skill.id]?.[key];
    if (patch === undefined) return base;
    return typeof base === 'number' && typeof patch === 'number' ? base + patch : patch;
}
/** 단계 값 전부를 읽은 복사 (상태·장판처럼 안에 든 표도 '$이름'을 읽음, 함수·이펙트 정의는 그대로) */
function resolve(b, ctx, step) {
    const out = {};
    for (const [k, v] of Object.entries(step)) {
        if (Array.isArray(v)) out[k] = v.map(x => val(b, ctx, x));
        else if (v && typeof v === 'object' && !v.layers && (k === 'status' || k === 'zone' || k === 'mods' || k === 'leave' || k === 'end')) out[k] = resolve(b, ctx, v);
        else out[k] = val(b, ctx, v);
    }
    return out;
}

// ---- 대상 고르기 ----
const isUnit = e => !e.isBuilding && !e.isBarricade;
const live = (b, e) => b.enemies.includes(e) && e.hp > 0;
const power = e => (e.boss ? 3 : e.elite ? 2 : 1) * 1e6 + e.hp;

/** 앞쪽 range 안에서 고름. pick: nearest | farthest | strongest | lowest | random | all */
export function pickTargets(b, pick = 'nearest', n = 1, range = 300) {
    const list = b.enemiesInRange(range);
    const units = list.filter(isUnit);
    const src = units.length ? units : list;
    switch (pick) {
        case 'all': return list;
        case 'farthest': return [...src].reverse().slice(0, n);
        case 'strongest': return [...src].sort((p, q) => power(q) - power(p)).slice(0, n);
        case 'lowest': return [...src].sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp).slice(0, n);
        case 'random': return [...src].sort(() => Math.random() - 0.5).slice(0, n);
        default: return src.slice(0, n);
    }
}
/** 가로 위치 x에서 radius 안의 적 (거점은 앞면 기준) */
export function enemiesNear(b, x, radius, units = false) {
    return b.enemies.filter(e => (!units || isUnit(e)) && Math.abs((e.isBuilding || e.isBarricade ? e.x + 12 : aimAt(e).x) - x) <= radius);
}

/** 한 적에게 피해 + 상태 */
export function kitHit(b, e, dmg, o = {}) {
    if (!live(b, e)) return;
    let mul = (e.isBuilding ? (o.baseMul ?? 1) : 1) * (o.eliteMul && (e.elite || e.boss) ? o.eliteMul : 1);   // eliteMul: 엘리트·보스에게 배수 (관통 저격)
    if (o.shatter && e.frozenT > 0) {   // 깨뜨리기 (서리의 무희): 얼어 있는 적은 shatter배 + 빙결이 풀림
        mul *= o.shatter;
        e.frozenT = 0;
        e.stunT = Math.min(e.stunT || 0, 0.05);
        b.kitOnShatter?.(e);
    }
    if (dmg > 0) b.dealDamageToEnemy(e, b.unit() * dmg * mul, !!o.crit, { knock: o.knock ?? 0.6, stop: o.stop, pierce: o.pierce });
    if (o.status && live(b, e)) b.kitStatus(e, o.status);
    if (o.hitVfx && b.enemies.includes(e)) b.fx.play(o.hitVfx, aimAt(e).x, aimAt(e).b);
}

// ---- 단계 실행 ----
const STEP = {
    /** 고른 대상을 times번 때림 */
    hit(b, s, ctx) {
        const range = s.range ?? ctx.range;
        for (let i = 0; i < (s.times || 1); i++) {
            b.schedule(i * (s.every ?? 0.12), () => {
                const list = pickTargets(b, s.pick, s.n || 1, range);
                list.forEach((e, k) => {
                    if (s.vfx) b.fx.play(s.vfx, aimAt(e).x, s.ground ? FOOT_B : aimAt(e).b);
                    kitHit(b, e, s.dmg, { ...s, stop: i === (s.times || 1) - 1 && k === 0 });
                });
                if (s.sfx) sound.play(s.sfx, { vol: 0.6 });
            });
        }
    },
    /** 일직선 관통: 총구에서 range 끝까지, 뒤로 갈수록 × decay */
    line(b, s, ctx) {
        const range = s.range ?? ctx.range;
        const from = (s.from === 'mouth' && monster.getSocketPoint('mouth', 'head')) ||
            monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 120 };
        const endX = b.frontX() + range;
        if (s.vfx) b.fx.play(s.vfx, from.x, s.b ?? from.bottom, { to: [endX, s.b ?? 100] });
        let mul = 1;
        b.enemiesInRange(range).forEach((e, i) => b.schedule(i * (s.gap ?? 0.03), () => {
            kitHit(b, e, s.dmg * mul, s);
            mul *= s.decay ?? 1;
        }));
    },
    /** 넓은 자리에 count번 떨어짐 — 적이 있으면 적 위치 먼저 (s.aim) */
    rain(b, s, ctx) {
        const [a, z] = s.x || [40, ctx.range];
        const count = Math.max(1, Math.round(s.count || 1));
        const targets = s.aim === false ? [] : pickTargets(b, 'random', count, z);
        for (let i = 0; i < count; i++) {
            b.schedule(i * (s.every ?? 0.15), () => {
                if (!b.isActive) return;
                const t = targets[i] && live(b, targets[i]) ? aimAt(targets[i]).x : b.frontX() + a + Math.random() * (z - a);
                const x = t + (Math.random() - 0.5) * (s.jitter ?? 20);
                if (s.vfx) b.fx.play(s.vfx, x, s.vfxB ?? FOOT_B, { scale: s.scale || 1 });
                b.schedule(s.delay ?? 0, () => {
                    enemiesNear(b, x, s.radius ?? 60).forEach(e => kitHit(b, e, s.dmg, s));
                    if (s.zone) b.kitZone({ ...s.zone, x: x - (s.zone.w || 80) / 2 - b.frontX() });
                });
                if (s.shake) b.director.shake(s.shake, 140);
                if (s.sfx && i % 2 === 0) sound.play(s.sfx, { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
            });
        }
    },
    /** 앞으로 움직이는 판정 (파도·철구·유령 기사·회전 고리) — battle/kit.js kitWave */
    wave(b, s, ctx) {
        b.kitWave({ ...s, dist: s.dist ?? ctx.range, x: b.frontX() + (s.from ?? -40) });
    },
    /** 적 사이를 튐 */
    chain(b, s, ctx) {
        const first = pickTargets(b, s.pick || 'nearest', 1, s.range ?? ctx.range)[0];
        if (!first) return;
        const hit = new Set();
        let cur = first, prev = monster.getMuzzlePoint() || { x: b.monsterX + 90, bottom: 130 };
        let prevPt = [prev.x, prev.bottom];
        for (let i = 0; i < Math.round(s.n || 3) && cur; i++) {
            const e = cur;
            hit.add(e);
            const pt = [aimAt(e).x, aimAt(e).b];
            const from = prevPt;
            b.schedule(i * (s.gap ?? 0.08), () => {
                if (s.vfx) b.fx.play(s.vfx, from[0], from[1], { to: pt });
                kitHit(b, e, s.dmg * Math.pow(s.decay ?? 1, i), s);
            });
            prevPt = pt;
            cur = b.enemies.filter(o => !hit.has(o) && o.hp > 0 && Math.abs(aimAt(o).x - pt[0]) <= (s.jump ?? 200))
                .sort((p, q) => Math.abs(aimAt(p).x - pt[0]) - Math.abs(aimAt(q).x - pt[0]))[0];
        }
    },
    /** 바닥 장판 (x는 frontX 기준) */
    zone(b, s) {
        b.kitZone(s);
    },
    /** 끌어오기: 고른 적을 frontX + to 로 */
    pull(b, s, ctx) {
        pickTargets(b, s.pick || 'farthest', s.n || 1, s.range ?? ctx.range).forEach(e => {
            if (!isUnit(e) || e.boss) { kitHit(b, e, s.dmg || 0, s); return; }
            const to = b.frontX() + (s.to ?? 10);
            if (s.vfx) b.fx.play(s.vfx, aimAt(e).x, aimAt(e).b);
            if (b.pullEnemy) b.pullEnemy(e, to, s.sec ?? 0.3);
            b.schedule(s.sec ?? 0.3, () => { kitHit(b, e, s.dmg || 0, s); b.kitPushed?.(e); });
        });
    },
    /** 밀어내기: range 안 적을 dist px 뒤로 */
    push(b, s, ctx) {
        b.enemiesInRange(s.range ?? ctx.range).forEach(e => {
            kitHit(b, e, s.dmg || 0, { ...s, knock: 0 });
            if (live(b, e) && isUnit(e) && !e.boss && !e.knockResist) {
                e.x += (s.dist ?? 120) * (1 + (b.kitMod?.('pullMul') || 0));   // 조류 지배: 끌어오기·밀어내기 거리 +
                if (e.dom) e.dom.style.left = `${e.x}px`;
                b.kitPushed?.(e);
            }
        });
    },
    /** 돌진 (지나간 적마다 피해). shove: 뚫고 지나가지 않고 만난 적을 밀고 감 (방패 돌진) */
    dash(b, s) {
        b.dashForward(s.dist ?? 160, s.sec ?? 0.3, e => kitHit(b, e, s.dmg || 0, s), s.trail || null, { shove: !!s.shove });
    },
    /** 순간 이동: 앞으로 dist (거점 앞에서 멈춤), 떠난 자리에 장판 */
    blink(b, s) {
        const building = b.enemies.find(e => e.isBuilding);
        const start = b.monsterX;
        const end = Math.max(start, Math.min(start + (s.dist ?? 200), building ? building.x - 110 : Infinity));
        if (s.vfx) b.fx.play(s.vfx, start + 50, FOOT_B + 60);
        if (s.leave) b.kitZone({ ...s.leave, x: start - b.frontX() + 20 });
        b.monsterX = end;
        monster.setMonsterPosition(end);
        if (s.vfx) b.fx.play(s.vfx, end + 50, FOOT_B + 60);
        if (s.dmg) b.enemies.filter(e => aimAt(e).x > start + 60 && aimAt(e).x < end + 160).forEach(e => kitHit(b, e, s.dmg, s));
    },
    buff(b, s, ctx) {
        b.addKitBuff(s.key || ctx.skill.id, s.sec, s.mods || {}, s.vfx,
            { name: ctx.skill.name, icon: ctx.skill.icon, color: ctx.skill.color });
    },
    shield(b, s) {
        b.applyShield(s.ratio, s.sec, s.color || '255, 224, 138');
        if (s.allies) b.allies.forEach(a => { a.kitShield = Math.max(a.kitShield || 0, a.maxHp * s.ratio); });
    },
    /** 회복: ratio = 최대 체력 비율 (바로), over = [초, 초당 비율] (시간에 걸쳐), allies면 아군도 */
    heal(b, s) {
        if (s.ratio) b.kitHeal(b.maxPlayerHp * s.ratio);
        if (s.over) b.addKitBuff(`heal_${Math.random()}`, s.over[0], { regen: s.over[1] });
        if (s.allies) b.allies.forEach(a => {
            a.hp = Math.min(a.maxHp, a.hp + a.maxHp * (s.allyRatio ?? s.ratio ?? 0.3));
            if (a.hpBar) a.hpBar.style.width = `${(a.hp / a.maxHp) * 100}%`;
        });
    },
    /** 내 해로운 효과 풀기 (과부하는 그대로) */
    cleanse(b) {
        b.pSlowT = 0;
        b.pRootT = 0;
        if (!(b.overloadT > 0)) b.pStunT = 0;
        b.updatePlayerStatus();
    },
    /** 아군 소환 — battle/kit.js spawnKitAlly */
    summon(b, s) {
        for (let i = 0; i < Math.round(s.n || 1); i++) {
            b.schedule(i * (s.gap ?? 0.15), () => { if (b.isActive) b.spawnKitAlly(b.monsterX + (s.x ?? 70) + i * (s.spread ?? 24), s); });
        }
    },
    /** 화면의 모든 적 (거점은 baseMul) */
    screen(b, s) {
        const list = b.enemies.filter(e => (s.units ? isUnit(e) : true) && e.x - b.monsterX < (s.reach ?? 1200));
        if (s.field && list.length) {
            const xs = list.map(e => aimAt(e).x);
            const left = Math.min(...xs) - 100, right = Math.max(...xs) + 100;
            b.fx.play(imageField(s.field, right - left, s.fieldSec ?? 0.65), (left + right) / 2, FOOT_B);
        }
        list.forEach((e, i) => {
            if (s.vfx && i < (s.maxFx ?? 10)) b.fx.play(s.vfx, aimAt(e).x, s.ground ? FOOT_B : aimAt(e).b);
            kitHit(b, e, s.dmg || 0, s);
        });
    },
    /** 변신: 커지기 + 버프 (+ 기본 공격 바꾸기) */
    transform(b, s, ctx) {
        b.kitTransform({ ...s, key: ctx.skill.id });
    },
    fx(b, s) {
        const x = s.on === 'self' ? b.monsterX + 35 + (s.x || 0) : b.frontX() + (s.x || 0);
        b.fx.play(s.vfx, x, s.b ?? FOOT_B, { scale: s.scale || 1, ...(s.follow ? { follow: () => [b.monsterX + 35 + (s.x || 0), s.b ?? FOOT_B] } : {}) });
    },
    shake(b, s) {
        b.director.shake(s.power ?? 6, s.ms ?? 250);
    },
    /** 필살기 게이지 더하기 */
    gauge(b, s) {
        b.ultGauge = Math.min(1, b.ultGauge + (s.add || 0));
    },
    custom(b, s, ctx) {
        s.fn(b, ctx, s);
    }
};

/** 단계 하나를 바로 실행 (패시브·세트 효과가 씀) — skill은 값 표가 필요할 때만 */
export function runKitStep(b, step, skill = { id: '_', p: {} }) {
    const ctx = { skill, range: b.playerRange + (skill.range || 0) };
    STEP[step.do](b, resolve(b, ctx, step), ctx);
}

function runSteps(b, skill, ctx) {
    for (const raw of skill.steps) {
        const go = () => {
            if (!b.isActive) return;
            if (raw.when && !raw.when(b)) return;
            const s = resolve(b, ctx, raw);
            const reps = Math.max(1, Math.round(s.repeat || 1));
            for (let r = 0; r < reps; r++) b.schedule(r * (s.repeatGap ?? 0.3), () => { if (b.isActive) STEP[s.do](b, s, ctx); });
        };
        const at = val(b, ctx, raw.at) || 0;
        if (at > 0) b.schedule(at, go); else go();
    }
}

/** 지금 리그 캐릭터의 그 동작에 'cast' 순간이 있는지 (없으면 동작과 함께 바로 시작 — 효과가 끝내 안 나가는 일 없게) */
function clipHasCast(clip) {
    const c = monster.rigBattle?.character?.clips?.[clip];
    return !!(c && c.events && c.events.some(ev => ev[1] === 'cast'));
}

/**
 * 부품 스킬 정의 → 스킬 표(SKILLS) 항목. use(b)는 attacks.js useSkill이 부름 (b = 전투 엔진 또는 스킬 레벨 대리 객체)
 */
export function kitSkill(id, def) {
    const skill = { target: 'enemy', range: 0, ...def, id, kit: true };
    skill.use = function (b) {
        const ctx = { skill, range: b.playerRange + (skill.range || 0) };
        if (skill.sfx) sound.play(skill.sfx);
        if (skill.cast && clipHasCast(skill.clip || 'cast')) monster.playCast(() => runSteps(b, skill, ctx), skill.clip || 'cast');
        else {
            monster.playSkillAnim(skill.clip || 'attack');
            runSteps(b, skill, ctx);
        }
        if (skill.after) skill.after(b, ctx);
    };
    return skill;
}

// ---- 등록 (sets2/*.js) ----
/**
 * 2차 세트 묶음 하나를 게임 표에 더함.
 * pack = { character, sets: { 세트 id: {...} }, parts: { head:[], body:[], arm:[], leg:[] }, skills: { id: def }, partSkill: { 파츠 id: 스킬 id },
 *          passives: { 다리 파츠 id: { name, desc, ... } }, tints: { 글자: filter } }
 * 표는 부르는 쪽이 넘김 (순환 import 피함): { SETS, SKILLS, PART_SKILL, LEG_PASSIVES, V2_PARTS, SET_TINT, KIT_PASSIVES }
 */
export function registerSets2(pack, T) {
    Object.assign(T.SETS, pack.sets || {});
    for (const [id, def] of Object.entries(pack.skills || {})) T.SKILLS[id] = kitSkill(id, def);
    Object.assign(T.PART_SKILL, pack.partSkill || {});
    for (const [legId, ps] of Object.entries(pack.passives || {})) {
        T.LEG_PASSIVES[legId] = { name: ps.name, desc: ps.desc };
        T.KIT_PASSIVES[legId] = ps;
    }
    for (const slot of ['head', 'body', 'arm', 'leg']) {
        const list = (pack.parts || {})[slot] || [];
        T.V2_PARTS[slot] = (T.V2_PARTS[slot] || []).concat(list);
    }
    if (pack.tints) T.SET_TINT[pack.character] = { ...(T.SET_TINT[pack.character] || {}), ...pack.tints };
}
