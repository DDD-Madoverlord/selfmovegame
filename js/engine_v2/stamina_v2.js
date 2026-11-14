/* ==========================================================================
   PROJECT: MAD OVERLORD // 피로도(스태미나) 규칙 — 화면 없음 (Q-049 개발 기획서, 숫자는 Q-049 답 전 임시값)
   기획서: https://claude.ai/artifact/G2puywT9xLUQXCwSMuf64Y
   판을 시작할 때 비용을 맡기고(pending), 판이 끝나면 정리한다. 이긴 판만 다 쓴다.
     이김 → 맡긴 양 확정
     짐·시간 초과 → 1만 쓰고 나머지를 돌려줌 (전부 돌려주면 진 판에도 남는 전투 DM을 일부러 지면서 모을 수 있음)
     작전 포기 → 시작 10초 안이면 전부 돌려줌(잘못 누름), 그 뒤면 짐과 같음
     앱이 꺼지거나 새로 고침 → 다음 실행 때 짐으로 정리 (progressStamina_v2.js loadStamina)
   회복: 6분에 1, 최대치에서 멈춤. 값을 읽을 때마다 몰아서 계산한다 — at 뒤로 지난 6분 묶음만큼 더하고,
         남는 시간은 at에 남겨 이어 센다. 지금 시각이 at보다 이르면(시계를 되돌림) 회복하지 않는다 (방치 보상 lastSeenAt과 같은 방식).
         시계를 앞으로 당기는 조작은 서버 시간이 생기기 전까지 못 막는다 (기획서 6단계).
   넘침: 충전·돌려받기는 최대치를 넘어 999까지 쌓임. 최대치 이상인 동안 시간 회복은 멈춤.
   모든 함수는 지금 시각(now)을 밖에서 받는다 — 검사에서 시간을 마음대로 돌리고, 나중에 서버 시간으로 바꾸기 쉽게.
   상태 객체는 그 자리에서 고친다.

   저장 (mo_v2_save 안) stamina: { on, v, at, seen, pending, buy }
     on      켜졌나 (노말 1-B 첫 클리어 뒤, 켜질 때 가득)
     v       지금 값 (0 ~ 999)
     at      회복 기준 시각 (이 뒤로 6분마다 1)
     seen    본 가장 늦은 시각 — DM 충전 하루 횟수의 날짜를 정할 때 씀 (시계를 되돌려도 어제로 안 감)
     pending 맡긴 판 null | { cost, stage, diff, t }
     buy     DM 충전 하루 횟수 { day: 한국 날짜 | null, n }
   광고 충전 횟수는 다른 보상형 광고와 같이 상점 저장(commerce.dailyAds, 자리 'stamina_ad' — shopCatalog_v2.js AD_LIMITS)에 센다.
   그래서 광고 제거·주간 패스면 광고 없이 같은 횟수를 받는 규칙도 그대로 따른다.
   ========================================================================== */

import { kstDayKey } from './kstTime_v2.js';

export const STAMINA = {
    unlockStage: '1-B',                  // 노말 이 판을 처음 깨면 켜짐
    max: 80,
    passBonus: 40,                       // 주간 패스 기간 최대치 +40 (방치 상한 12시간과 같은 결)
    regenMs: 6 * 60 * 1000,              // 6분에 1 → 하루 240, 0에서 가득까지 8시간 (방치 보상 상한과 같음)
    cap: 999,                            // 넘침 한도
    cost: { normal: 6, hard: 8, hell: 10, nightmare: 12 },   // 보스 판도 같음. 보상 배율(1·1.6·2.4·3.5)보다 덜 오름
    lossCost: 1,                         // 진 판에서 쓰는 양
    quitGraceMs: 10 * 1000,              // 이 안에 포기하면 전부 돌려줌
    ad: { amount: 30, daily: 3 },        // 하루 횟수는 AD_LIMITS.stamina_ad와 같아야 함
    buy: { amount: 40, daily: 3, hours: [2, 4, 8] },   // 값 = 지금 방치 보상 시간당 DM × 2·4·8시간
    buyMinDm: 100
};

const uint = n => Number.isSafeInteger(n) && n >= 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const shape = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const dayText = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

export function emptyStamina() {
    return { on: false, v: 0, at: 0, seen: 0, pending: null, buy: { day: null, n: 0 } };
}

/** 저장·백업 검사 — 모양이 틀리면 던짐 (saveStore_v2.js validate · loadStamina) */
export function validateStamina(s) {
    const fail = () => { throw new Error('피로도 저장 데이터가 올바르지 않습니다.'); };
    if (!shape(s, ['on', 'v', 'at', 'seen', 'pending', 'buy']) || typeof s.on !== 'boolean'
        || !uint(s.v) || s.v > STAMINA.cap || !uint(s.at) || !uint(s.seen) || s.at > s.seen
        || (!s.on && (s.v !== 0 || s.pending !== null))) fail();
    const p = s.pending;
    if (p !== null && (!shape(p, ['cost', 'stage', 'diff', 't']) || !uint(p.cost) || p.cost < 1 || p.cost > STAMINA.cap
        || typeof p.stage !== 'string' || !p.stage || p.stage.length > 40 || !Object.hasOwn(STAMINA.cost, p.diff)
        || !uint(p.t) || p.t > s.seen)) fail();
    const b = s.buy;
    if (!shape(b, ['day', 'n']) || !uint(b.n) || b.n > STAMINA.buy.daily
        || (b.day === null ? b.n !== 0 : !dayText(b.day) || b.day > kstDayKey(s.seen))) fail();
    return true;
}

/** 최대치 (주간 패스 기간이면 +40) */
export function maxOf(pass = false) {
    return STAMINA.max + (pass ? STAMINA.passBonus : 0);
}

/** 판 비용 — 난이도 id (모르는 값이면 노말) */
export function costOf(diff) {
    return STAMINA.cost[diff] ?? STAMINA.cost.normal;
}

/** 본 가장 늦은 시각 */
function touch(s, now) {
    if (uint(now)) s.seen = Math.max(s.seen || 0, now);
    return s.seen;
}

/** 회복: at 뒤로 지난 6분 묶음만큼 더함. 최대치 이상이면 기준 시각만 지금으로 옮김 (쓰는 순간부터 다시 셈) */
export function regen(s, now, max) {
    if (!uint(now)) return s;
    touch(s, now);
    if (!s.on) return s;
    if (s.v >= max) { s.at = Math.max(s.at, now); return s; }
    if (now <= s.at) return s;                       // 시계를 되돌림 → 회복 없음
    const n = Math.floor((now - s.at) / STAMINA.regenMs);
    if (!n) return s;
    s.v += Math.min(n, max - s.v);
    s.at = s.v >= max ? now : s.at + n * STAMINA.regenMs;
    return s;
}

/** need까지 차는 데 남은 시간 (ms). 이미 있으면 0 */
export function waitFor(s, need, now, max) {
    regen(s, now, max);
    if (s.v >= need) return 0;
    if (need > max) return Infinity;                  // 시간으로는 못 채움
    const next = Math.max(0, s.at + STAMINA.regenMs - now);
    return next + (need - s.v - 1) * STAMINA.regenMs;
}

/** 지금 값 보기 { on, v, max, full, over, nextMs, fullMs, pending } — 화면(⚡ 칩)용 */
export function view(s, now, max) {
    regen(s, now, max);
    const full = s.v >= max;
    const nextMs = !s.on || full ? 0 : Math.max(0, s.at + STAMINA.regenMs - now);
    return { on: s.on, v: s.v, max, full, over: s.v > max, nextMs,
        fullMs: !s.on || full ? 0 : nextMs + (max - s.v - 1) * STAMINA.regenMs, pending: s.pending ? { ...s.pending } : null };
}

/** 최대치를 넘어 999까지 더함 (충전·돌려받기). 실제로 더한 양을 돌려줌 */
export function addOver(s, n, now, max) {
    if (!uint(n) || !n) return 0;
    regen(s, now, max);
    const before = s.v;
    s.v = Math.min(STAMINA.cap, s.v + n);
    if (s.v >= max) s.at = Math.max(s.at, now);
    return s.v - before;
}

/** 켜기 — 가득 채움. 이미 켜져 있으면 false */
export function turnOn(s, now, max) {
    if (s.on) return false;
    touch(s, now);
    s.on = true;
    s.v = Math.max(s.v, max);
    s.at = s.seen;
    s.pending = null;
    return true;
}

/** 판 끝: result 'win' 확정 · 'lose'(짐·시간 초과) 1만 씀 · 'quit' 10초 안이면 전부 돌려줌, 그 뒤면 짐과 같음 */
export function settle(s, result, now, max) {
    const p = s.pending;
    if (!p) return { result, used: 0, refund: 0 };
    regen(s, now, max);
    let used = p.cost;
    if (result === 'lose' || result === 'quit') used = Math.min(p.cost, STAMINA.lossCost);
    if (result === 'quit' && uint(now) && now >= p.t && now - p.t <= STAMINA.quitGraceMs) used = 0;
    s.pending = null;
    const refund = p.cost - used;
    if (refund) addOver(s, refund, now, max);
    return { result, used, refund, stage: p.stage, diff: p.diff };
}

/** 판 시작: 비용을 빼고 맡김. 모자라면 { success: false, need, have, waitMs } */
export function reserve(s, { stage, diff, cost = costOf(diff) }, now, max) {
    regen(s, now, max);
    if (!s.on || !uint(cost) || !cost) return { success: true, cost: 0 };
    if (s.pending) settle(s, 'lose', now, max);       // 앞 판이 정리되지 않았으면 짐으로 (안전망)
    if (s.v < cost) return { success: false, reason: 'short', need: cost, have: s.v, waitMs: waitFor(s, cost, now, max) };
    s.v -= cost;
    s.pending = { cost, stage: String(stage), diff: Object.hasOwn(STAMINA.cost, diff) ? diff : 'normal', t: s.seen };
    return { success: true, cost };
}

/** DM 충전: 오늘 남은 횟수 (한국 0시에 다시 채움, 시계를 되돌려도 어제로 안 감) */
export function buyLeft(s, now) {
    const day = kstDayKey(touch(s, now));
    return Math.max(0, STAMINA.buy.daily - (s.buy.day === day ? s.buy.n : 0));
}

/** DM 충전 값 — 오늘 몇 번째인지에 따라 방치 보상 2·4·8시간치 (10 DM 단위로 올림). 다 썼으면 null */
export function buyPrice(s, now, ratePerHour) {
    const left = buyLeft(s, now);
    if (!left) return null;
    const hours = STAMINA.buy.hours[STAMINA.buy.daily - left];
    return Math.max(STAMINA.buyMinDm, Math.ceil((Math.max(0, ratePerHour) * hours) / 10) * 10);
}

/** DM 충전 1회 기록 (값 빼기·피로도 더하기는 부르는 쪽) */
export function markBuy(s, now) {
    const day = kstDayKey(touch(s, now));
    if (s.buy.day !== day) s.buy = { day, n: 0 };
    s.buy.n += 1;
    return s.buy.n;
}
