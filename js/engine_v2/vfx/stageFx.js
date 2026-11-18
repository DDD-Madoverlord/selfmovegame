/* ==========================================================================
   PROJECT: MAD OVERLORD // 스킬 이펙트 무대 (D-147 인형사 → D-148 공용으로 뺌)
   그림 함수 하나를 전투(b)와 연구소 미리보기(api)에 함께 쓰려는 얇은 층.
   S.play(fx, x, h, o) — h = 바닥에서 위로 높이(전투 px), o.to·path·follow도 [x, h]. S.k = 크기 배율(미리보기 0.56 × VFX_SCALE, 전투 1)
   S.later(초, 함수) · S.me()(내 가운데 x) · S.front()(내 앞면 x)
   과녁 { pos() → [x, 가슴 높이], foot() → x, ok() }
   ========================================================================== */

import { aimAt } from '../bases_v2.js';
import { FOOT_B } from '../battle/tuning.js';

export const alive = (b, e) => b.enemies.includes(e) && e.hp > 0;
export const chestH = e => aimAt(e).b - FOOT_B;
export const kOf = api => api.VFX_SCALE * 0.56;

export function mapOpts(o, Y) {
    const r = { ...o };
    if (o.to) r.to = [o.to[0], Y(o.to[1])];
    if (o.path) r.path = () => o.path().map(p => [p[0], Y(p[1])]);
    if (o.follow) r.follow = () => { const p = o.follow(); return [p[0], Y(p[1])]; };
    return r;
}
export function stageOf(b) {
    const Y = v => FOOT_B + v;
    return { k: 1, b, play: (fx, x, h, o = {}) => b.fx.play(fx, x, Y(h), mapOpts({ alive: () => b.isActive, ...o }, Y)),
        later: (d, f) => b.schedule(d, () => { if (b.isActive) f(); }),
        me: () => b.monsterX + 38, front: () => b.frontX() };
}
export function previewStage(api) {
    const k = kOf(api), Y = v => api.GROUND_Y - v * k;
    return { k, api, play: (fx, x, h, o = {}) => api.vfx.play(fx, x, Y(h), { scale: k, ...mapOpts(o, Y) }), later: (d, f) => api.later(d, f),
        me: () => api.CHAR_X, front: () => api.CHAR_X + 62 * k };
}
export const tgtOf = (b, e) => ({ e, pos: () => [aimAt(e).x, chestH(e)], foot: () => aimAt(e).x, ok: () => alive(b, e) });
export function previewTargets(api, n = 9) {
    const h = (api.GROUND_Y - api.enemyChestY()) / kOf(api);
    return api.dummies.slice(0, n).map(d => ({ pos: () => [d.x, h], foot: () => d.x, ok: () => true }));
}
/** fn(b, ctx, s) 에 연구소 미리보기 pv(S, api)를 붙임 */
export const withPreview = (fn, pv) => { fn.preview = api => pv(previewStage(api), api); return fn; };
