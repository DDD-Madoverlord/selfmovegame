/* ==========================================================================
   PROJECT: MAD OVERLORD // 스킬 이펙트 개선 보조 층 (D-118, 2026-11-09)
   주연은 기존 손그림 시트(vfxPlayer VFX_SHEETS)이고, 여기는 시트로 할 수 없는 보조만 그린다.
     gather  : 둘레에서 빛줄기가 모이며 가운데 빛이 커짐 (관통 저격 충전 — bass_drop 역재생과 함께) { r, count, color }
     reticle : 표적 조준 고리 (줄어들며 고정 — 표적 지정 포격 예고 표식)                          { r, color }
     travel  : x,y → to 로 날아가는 작은 뼛가시 (가시 폭풍)                                       { arc, len, w, color, tip }
     drone   : 떠다니는 수리 드론 그림(art/repair_drone) + 1초마다 치료 광선                        { size, ox, oy, phase, tx, ty, color }
   ========================================================================== */

const WHITE = '255, 255, 255';
const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = u => 1 - (1 - u) * (1 - u);

function glow(ctx, x, y, r, color) {
    if (!(r > 0)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
}
function ellipseGlow(ctx, x, y, rx, ry, color) {
    if (!(rx > 0) || !(ry > 0)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    glow(ctx, 0, 0, rx, color);
    ctx.restore();
}
const hash = (i, k = 1) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---- 그림 한 장 (수리 드론) ----
const ART = { repair_drone: 'assets/sprites/vfx/art/repair_drone.webp' };
const artImages = new Map();
function artImage(name) {
    if (!ART[name] || typeof Image === 'undefined') return null;
    let img = artImages.get(name);
    if (!img) {
        img = new Image();
        img.src = ART[name];
        artImages.set(name, img);
        const done = () => { img.ready = true; };
        if (img.decode) img.decode().then(done, done); else img.onload = done;
    }
    return img.ready && img.naturalWidth ? img : null;
}
export function preloadSkillArt() { Object.keys(ART).forEach(artImage); }

/** 위치 x,y → to 사이 (arc: 위로 솟는 높이) */
function travelPos(it, u, x, y, s) {
    const [tx, ty] = it.to || [x, y];
    const px = x + (tx - x) * u, py = y + (ty - y) * u - (it.arc || 0) * s * 4 * u * (1 - u);
    return [px, py];
}

function drawThorn(ctx, len, w, color, tip, a) {
    // 뼛가시: 휜 원뿔, 끝은 독빛
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, `rgba(${color}, ${a})`);
    g.addColorStop(0.75, `rgba(${color}, ${a})`);
    g.addColorStop(1, `rgba(${tip}, ${a})`);
    ctx.fillStyle = g;
    ctx.strokeStyle = `rgba(35, 40, 20, ${0.9 * a})`;
    ctx.lineWidth = Math.max(1, w * 0.18);
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.quadraticCurveTo(0, -w * 0.9, -len / 2, -w / 2);
    ctx.lineTo(-len / 2, w / 2);
    ctx.quadraticCurveTo(0, w * 0.1, len / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}
export const EXTRA_DRAW = {
    gather(ctx, x, y, it, u, s, time) {
        const n = it.count || 14, R = (it.r || 90) * s;
        const power = smooth(u / 0.85);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
            const q = (u * (it.cycles || 2.4) + hash(i)) % 1;
            const a = hash(i, 2) * TAU + i * 2.39996;
            const r = R * (0.15 + 0.85 * Math.pow(1 - q, 1.3));
            const len = (10 + 16 * q) * s;
            const al = Math.sin(q * Math.PI) * (0.35 + 0.65 * power);
            ctx.strokeStyle = `rgba(${it.color}, ${0.9 * al})`;
            ctx.lineWidth = (1.5 + 2 * q) * s;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * (r + len), y + Math.sin(a) * (r + len));
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            ctx.stroke();
            ctx.fillStyle = `rgba(${WHITE}, ${0.8 * al})`;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6 * s, 0, TAU);
            ctx.fill();
        }
        // 줄어드는 고리 두 개
        for (const k of [0, 0.5]) {
            const q = (u * 2 + k) % 1;
            ctx.strokeStyle = `rgba(${it.color}, ${0.5 * Math.sin(q * Math.PI) * power})`;
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.arc(x, y, R * 0.75 * (1 - q) + 4 * s, 0, TAU);
            ctx.stroke();
        }
        const pulse = 0.85 + 0.15 * Math.sin(time * 38);
        const core = (5 + 20 * power) * s * pulse;
        glow(ctx, x, y, core * 2.6, `rgba(${it.color}, ${0.45 * power + 0.1})`);
        glow(ctx, x, y, core, `rgba(${it.color}, 0.9)`);
        glow(ctx, x, y, core * 0.5, `rgba(${WHITE}, 1)`);
        ctx.restore();
    },

    travel(ctx, x, y, it, u, s) {
        const [px, py] = travelPos(it, u, x, y, s);
        const [qx, qy] = travelPos(it, Math.max(0, u - 0.04), x, y, s);
        const ang = Math.atan2(py - qy, px - qx) || Math.atan2((it.to?.[1] ?? y) - y, (it.to?.[0] ?? x + 1) - x);
        const len = (it.len || 60) * s, w = (it.w || 10) * s;
        const a = smooth(u / 0.08);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (it.trail !== false) {   // 꼬리: 지나온 길을 옅게
            ctx.lineCap = 'round';
            const steps = 8;
            for (let i = steps; i >= 1; i--) {
                const f = Math.max(0, u - i * 0.025);
                const [ax, ay] = travelPos(it, f, x, y, s);
                const [bx, by] = travelPos(it, Math.max(0, f - 0.025), x, y, s);
                ctx.strokeStyle = `rgba(${it.trailColor || it.color}, ${0.35 * (1 - i / steps) * a})`;
                ctx.lineWidth = w * (1 - i / steps) * 0.9 + 1;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(ax, ay);
                ctx.stroke();
            }
        }
        glow(ctx, px, py, Math.max(len, w * 3) * 0.6, `rgba(${it.color}, ${0.35 * a})`);
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.globalCompositeOperation = 'source-over';
        drawThorn(ctx, len, w, it.color, it.tip || '170, 255, 60', a);
        ctx.restore();
    },

    reticle(ctx, x, y, it, u, s, time) {
        const R = (it.r || 50) * s;
        const lock = easeOut(Math.min(1, u / 0.6));
        const r = R * (1.7 - 0.7 * lock);
        const a = Math.min(1, u / 0.1) * (u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1);
        const blink = u > 0.6 ? 0.6 + 0.4 * Math.sign(Math.sin(time * 30)) : 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${it.color}, ${0.9 * a * blink})`;
        ctx.lineWidth = 3 * s;
        const spin = time * 2.2 * (1 - lock) + 0.3;
        for (let k = 0; k < 4; k++) {   // 끊긴 고리 네 조각
            const a0 = spin + k * Math.PI / 2 + 0.2;
            ctx.beginPath();
            ctx.arc(x, y, r, a0, a0 + Math.PI / 2 - 0.4);
            ctx.stroke();
        }
        ctx.lineWidth = 2 * s;
        for (let k = 0; k < 4; k++) {   // 십자 눈금
            const ang = k * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(ang) * r * 0.45, y + Math.sin(ang) * r * 0.45);
            ctx.lineTo(x + Math.cos(ang) * r * 1.25, y + Math.sin(ang) * r * 1.25);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, 0, TAU);
        ctx.stroke();
        glow(ctx, x, y, 7 * s, `rgba(${it.color}, ${a})`);
        glow(ctx, x, y, r * 1.2, `rgba(${it.color}, ${0.12 * a})`);
        ctx.restore();
    },

    drone(ctx, x, y, it, u, s, time) {
        const img = artImage('repair_drone');
        const life = it.remaining ? it.remaining() : it.dur - it.t;
        const inT = smooth(it.t / 0.45), outT = smooth(life / 0.45);
        const vis = Math.min(inT, outT);
        if (vis <= 0) return;
        const ph = it.phase || 0;
        const dx = (it.ox || 0) * s + Math.sin(time * 1.3 + ph) * 10 * s;
        const dy = (it.oy || -150) * s + Math.sin(time * 2.6 + ph) * 6 * s - (1 - vis) * 70 * s;
        const cx = x + dx, cy = y + dy;
        const W = (it.size || 64) * s;
        const H = img ? W * img.naturalHeight / img.naturalWidth : W * 0.58;
        const color = it.color || '125, 255, 154';
        // 치료 광선: 1초마다 0.45초
        const beamQ = ((it.t + ph * 0.3) % (it.beamEvery || 1)) / (it.beamEvery || 1);
        const beam = beamQ < 0.45 ? Math.sin(beamQ / 0.45 * Math.PI) * vis : 0;
        const tx = x + (it.tx || 0) * s, ty = y + (it.ty ?? -70) * s;
        const nozzleY = cy + H * 0.42;
        ctx.save();
        if (beam > 0.01) {
            ctx.globalCompositeOperation = 'lighter';
            const ang = Math.atan2(ty - nozzleY, tx - cx);
            const L = Math.hypot(tx - cx, ty - nozzleY);
            ctx.save();
            ctx.translate(cx, nozzleY);
            ctx.rotate(ang);
            const g = ctx.createLinearGradient(0, -8 * s, 0, 8 * s);
            g.addColorStop(0, `rgba(${color}, 0)`);
            g.addColorStop(0.5, `rgba(${color}, ${0.7 * beam})`);
            g.addColorStop(1, `rgba(${color}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, -3 * s);
            ctx.lineTo(L, -9 * s);
            ctx.lineTo(L, 9 * s);
            ctx.lineTo(0, 3 * s);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = `rgba(${WHITE}, ${0.85 * beam})`;
            ctx.fillRect(0, -1 * s, L, 2 * s);
            ctx.restore();
            glow(ctx, tx, ty, 24 * s, `rgba(${color}, ${0.6 * beam})`);
            // 떠오르는 + 표시
            for (let i = 0; i < 3; i++) {
                const q = (beamQ * 2.2 + i / 3) % 1;
                const px = tx + (hash(i, ph) - 0.5) * 30 * s, py = ty - q * 30 * s;
                ctx.fillStyle = `rgba(${color}, ${(1 - q) * beam})`;
                ctx.fillRect(px - 4 * s, py - 1.2 * s, 8 * s, 2.4 * s);
                ctx.fillRect(px - 1.2 * s, py - 4 * s, 2.4 * s, 8 * s);
            }
        }
        // 추진 빛 + 그림
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, cx, nozzleY, 14 * s, `rgba(${color}, ${0.5 * vis})`);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = vis;
        if (img) {
            ctx.translate(cx, cy);
            ctx.rotate(Math.sin(time * 2.6 + ph + 1) * 0.06);
            ctx.drawImage(img, -W / 2, -H / 2, W, H);
        } else {   // 그림을 못 받았을 때: 스웜 드론(battleFx drawDrone)과 같은 작은 구체 드론을 흰·금·초록으로
            ctx.translate(cx, cy);
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, 0, 0, 22 * s, `rgba(${color}, 0.45)`);
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = '#1b1b26';
            ctx.lineWidth = 3 * s;
            for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 9 * s, -3 * s); ctx.lineTo(side * 20 * s, -9 * s); ctx.stroke(); }
            ctx.fillStyle = '#e9ecef';
            ctx.strokeStyle = '#141418';
            ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#d6a634';
            ctx.beginPath(); ctx.arc(0, 0, 7.5 * s, 0, TAU); ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, 0, 0, 6 * s, `rgba(${color}, 1)`);
            glow(ctx, 0, 0, 2.5 * s, 'rgba(255, 255, 255, 1)');
        }
        ctx.restore();
    }
};
