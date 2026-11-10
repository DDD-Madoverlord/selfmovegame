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

    // 저주의 사슬 (D-119): 적 발밑 양옆 땅에서 쇠사슬이 솟아 몸통을 엇갈려 감음 — 사슬 고리는 넓은 고리·옆모습 고리를 번갈아
    // (잠수부 앵커 사슬 drawChain과 같은 고리 그림), 쇠 빛 + 보라 저주 빛, 끝날 때 끊어지며 흩어짐
    chains(ctx, x, y, it, u, s, time) {
        const life = it.remaining ? it.remaining() : it.dur - it.t;
        const grow = smooth(it.t / 0.22), fade = smooth(life / 0.3);
        if (fade <= 0) return;
        const color = it.color || '190, 110, 255';
        const H = (it.h || 80) * s, W = (it.w || 46) * s;
        // [시작(땅) x, 끝 x, 끝 높이 비율]: 왼쪽 땅 → 오른쪽 어깨, 오른쪽 땅 → 왼쪽 가슴, 가운데 → 허리
        const list = it.list || [[-1, 0.7, 0.85], [1, -0.75, 0.62], [-0.55, 0.9, 0.35]];
        ctx.save();
        for (const [k, [sx, ex, eh]] of list.entries()) {
            const ax = x + sx * W, ay = y + 2 * s;
            const bx = x + ex * W * 0.6, by = y - H * eh;
            const g = grow * Math.min(1, Math.max(0, (it.t - k * 0.06) / 0.2));
            if (g <= 0) continue;
            const tx = ax + (bx - ax) * g, ty = ay + (by - ay) * g;
            const sag = Math.sin(time * 6 + k) * 2 * s;   // 팽팽하게 떨림
            const len = Math.hypot(tx - ax, ty - ay), ang = Math.atan2(ty - ay, tx - ax);
            const step = 7.5 * s, n = Math.max(1, Math.floor(len / step));
            ctx.globalCompositeOperation = 'lighter';   // 저주 빛 (사슬 뒤 번짐)
            ctx.strokeStyle = `rgba(${color}, ${0.35 * fade})`;
            ctx.lineWidth = 9 * s;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(tx, ty + sag);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < n; i++) {
                const f = (i + 0.5) / n;
                const px = ax + (tx - ax) * f, py = ay + (ty - ay) * f + sag * Math.sin(f * Math.PI);
                const wide = i % 2 === 0;
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(ang);
                ctx.globalAlpha = fade;
                ctx.lineWidth = 3.4 * s;
                ctx.strokeStyle = '#1a1424';                      // 고리 외곽선
                ctx.beginPath();
                ctx.ellipse(0, 0, 5 * s, (wide ? 3.4 : 1.2) * s, 0, 0, TAU);
                ctx.stroke();
                ctx.lineWidth = 1.8 * s;
                ctx.strokeStyle = wide ? '#b8b0cc' : '#7e7594';    // 쇠 빛 (넓은 고리 밝게)
                ctx.beginPath();
                ctx.ellipse(0, 0, 5 * s, (wide ? 3.4 : 1.2) * s, 0, 0, TAU);
                ctx.stroke();
                if (wide) {                                        // 위쪽 반짝임
                    ctx.strokeStyle = `rgba(${color}, 0.9)`;
                    ctx.lineWidth = 1 * s;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 5 * s, 3.4 * s, 0, Math.PI * 1.1, Math.PI * 1.6);
                    ctx.stroke();
                }
                ctx.restore();
            }
            // 땅에 박힌 고정쇠
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#2a2236';
            ctx.beginPath();
            ctx.ellipse(ax, ay, 6 * s, 3 * s, 0, 0, TAU);
            ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, ax, ay, 12 * s, `rgba(${color}, ${0.5 * fade})`);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    },

    // 바닥 갈라짐 (지면 내려찍기, D-119 보완): 옆에서 본 땅 — 내려찍은 자리 땅 윗면이 쩍 벌어져(V자 틈) 앞면 바위로 금이 타고 내려가고,
    //   틈 가장자리 바닥 판이 비스듬히 들림. 땅 윗면을 따라 들쭉날쭉한 갈라짐이 좌우로 이어짐. 틈은 0.15초에 벌어지고 끝에서 옅어짐 (바닥 층)
    //   (처음 넣은 위에서 내려다본 금은 땅 띠가 얇아 가는 선처럼 보였음)
    fissure(ctx, x, y, it, u, s, time) {
        const life = it.remaining ? it.remaining() : it.dur - it.t;
        const fade = smooth(life / 0.45), open = easeOut(clamp01(it.t / 0.15));
        if (fade <= 0) return;
        const L = (it.len || 170) * s, glowC = it.glow || '160, 255, 50';
        if (!it.shape) {
            const rnd = (k => () => { k = (k * 9301 + 49297) % 233280; return k / 233280; })(Math.floor(Math.random() * 233280));
            const jagLine = (x0, y0, x1, y1, n, amp) => Array.from({ length: n + 1 }, (_, i) => {
                const f = i / n, j = i === 0 || i === n ? 0 : (rnd() - 0.5) * amp;
                return [x0 + (x1 - x0) * f + j * 0.4, y0 + (y1 - y0) * f + j];
            });
            // 틈: [가운데 x 비율, 윗폭, 깊이] — 가운데가 가장 크게
            const splits = [[0, 26, 62], [-0.42, 15, 40], [0.45, 17, 44], [-0.82, 8, 24], [0.85, 9, 26]].map(([fx, w, d]) => {
                const cx = fx * L + (rnd() - 0.5) * 10, n = 5, left = [], right = [];
                let ox = 0;
                for (let i = 0; i <= n; i++) {
                    const f = i / n, hw = w * Math.pow(1 - f, 1.1) / 2;
                    ox += i ? (rnd() - 0.5) * w * 0.5 : 0;
                    left.push([cx + ox - hw - rnd() * 2, f * d]); right.push([cx + ox + hw + rnd() * 2, f * d]);
                }
                const branches = [0, 1].map(k => {   // 앞면 바위로 비스듬히 내려가는 금
                    const sgn = k ? 1 : -1, a = sgn * (0.5 + rnd() * 0.6), len = d * (0.7 + rnd() * 0.6);
                    const sy = d * (0.25 + rnd() * 0.3);
                    return { pts: jagLine(cx + sgn * w * 0.2, sy, cx + sgn * w * 0.2 + Math.sin(a) * len, sy + Math.cos(Math.abs(a)) * len * 0.8, 4, 6), w: Math.max(2, w * 0.22) };
                });
                return { cx, w, d, left, right, branches };
            });
            const surface = jagLine(-L * 1.05, 0, L * 1.05, 0, 22, 3);   // 땅 윗면을 따라가는 갈라짐
            const slabs = [[-0.12, -1], [0.1, 1], [-0.5, -1], [0.55, 1]].map(([fx, side]) => ({ fx, side, w: 30 + rnd() * 14, tilt: side * (0.22 + rnd() * 0.18) }));
            it.shape = { splits, surface, slabs };
        }
        const { splits, surface, slabs } = it.shape;
        const S = (px, py) => [x + px * s, y + py * s];   // 모양은 s=1 기준 px → 화면
        const path = pts => { ctx.beginPath(); pts.forEach((p, i) => { const q = S(...p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); };
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // 땅 윗면 갈라짐 (좌우로 이어짐): 어두운 띠 + 밝은 윗입술
        const reach = open * L / s;
        const surf = surface.filter(([px]) => Math.abs(px) <= reach + 1);
        if (surf.length > 1) {
            path(surf.map(([px, py]) => [px, py + 1.5])); ctx.lineWidth = 4.5 * s; ctx.strokeStyle = 'rgba(12, 8, 6, 0.85)'; ctx.stroke();
            path(surf.map(([px, py]) => [px, py - 1.2])); ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(200, 180, 140, 0.4)'; ctx.stroke();
        }
        // 틈과 앞면 금
        for (const sp of splits) {
            const k = open;
            const L2 = sp.left.map(([px, py]) => [sp.cx + (px - sp.cx) * k, py * k]), R2 = sp.right.map(([px, py]) => [sp.cx + (px - sp.cx) * k, py * k]);
            for (const br of sp.branches) {
                const n = Math.max(2, Math.ceil(br.pts.length * k));
                path(br.pts.slice(0, n)); ctx.lineWidth = (br.w + 2) * s; ctx.strokeStyle = 'rgba(8, 5, 4, 0.75)'; ctx.stroke();
                path(br.pts.slice(0, n)); ctx.lineWidth = br.w * 0.5 * s; ctx.strokeStyle = 'rgba(4, 2, 2, 0.95)'; ctx.stroke();
            }
            path([...L2, ...R2.slice().reverse()]); ctx.closePath();
            ctx.fillStyle = '#0d0806'; ctx.fill();
            ctx.lineWidth = 1.6 * s; ctx.strokeStyle = 'rgba(60, 44, 30, 0.95)'; ctx.stroke();
            const hot = smooth(1 - it.t / 1.0);   // 틈 깊은 곳 기운 (처음에만)
            if (hot > 0) {
                ctx.globalCompositeOperation = 'lighter';
                const mid = L2.map((p, i) => [(p[0] + R2[i][0]) / 2, p[1]]);
                path(mid); ctx.lineWidth = Math.max(1.5, sp.w * 0.18 * k) * s; ctx.strokeStyle = `rgba(${glowC}, ${0.35 * hot})`; ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
            }
            // 벌어진 입술 위쪽 밝은 모서리
            path([L2[0], L2[1]]); ctx.lineWidth = 1.4 * s; ctx.strokeStyle = 'rgba(205, 185, 145, 0.6)'; ctx.stroke();
            path([R2[0], R2[1]]); ctx.stroke();
        }
        // 들린 바닥 판: 틈 가장자리 판이 틈 반대쪽을 축으로 비스듬히 솟음 (윗면 흙빛 + 앞면 어두운 바위)
        const lift = easeOut(clamp01(it.t / 0.12));
        for (const sl of slabs) {
            const [hx, hy] = S(sl.fx * L / s + sl.side * sl.w * 0.9, 0);   // 돌쩌귀 (틈 반대쪽 끝)
            const w = sl.w * s, h = 9 * s;
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(sl.tilt * lift);
            const dir = -sl.side;   // 틈 쪽으로 뻗음
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * w, 0); ctx.lineTo(dir * w * 0.92, h); ctx.lineTo(dir * w * 0.1, h * 1.1); ctx.closePath();
            ctx.fillStyle = '#2a201a'; ctx.fill();                                  // 앞면
            ctx.lineWidth = 1.4 * s; ctx.strokeStyle = '#120c08'; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * w, 0); ctx.lineTo(dir * w * 0.96, -3 * s); ctx.lineTo(0, -3.5 * s); ctx.closePath();
            ctx.fillStyle = '#5e4c3a'; ctx.fill();                                  // 윗면 (땅 겉)
            ctx.beginPath(); ctx.moveTo(0, -3.5 * s); ctx.lineTo(dir * w * 0.96, -3 * s);
            ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(215, 195, 155, 0.7)'; ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    },

    // 곰덫 (덫 설치, D-119): 바닥에 펼친 톱니 턱 두 개 + 가운데 발판. bite()가 물고 난 시간을 주면 턱이 탁 닫혔다 다시 벌어짐
    //   턱 = 반원, 발판 축(좌우)을 돌쩌귀로 눕힘(0)→세움(1). 앞 턱은 보는 쪽, 뒤 턱은 안쪽 — 위에서 살짝 내려다본 모습
    beartrap(ctx, x, y, it, u, s, time) {
        const life = it.life ? it.life() : it.remaining ? it.remaining() : it.dur - it.t;   // life: 장판 남은 시간 (물고 나서 일찍 사라질 때 같이 옅어짐)
        const vis = Math.min(smooth(it.t / 0.25), smooth(life / 0.35));
        if (vis <= 0) return;
        const age = it.bite ? it.bite() : null;
        const c = age == null ? 0 : age < 0.07 ? age / 0.07 : age < 1 ? 1 : Math.max(0, 1 - (age - 1) / 0.3);
        const R = (it.r || 19) * s, PERSP = 0.34, phi = c * Math.PI / 2 * 0.8;   // 다 닫혀도 두 턱이 살짝 벌어져 톱니가 맞물린 게 보이게
        const drop = (1 - smooth(it.t / 0.25)) * 26 * s;   // 위에서 툭 떨어져 놓임
        const P = (px, py, pz) => [x + px, y - drop - py + pz * PERSP];
        const jaw = side => {   // side 1 = 앞, -1 = 뒤
            const pts = [], teeth = [];
            for (let i = 0; i <= 16; i++) {
                const th = Math.PI * i / 16, r = R * Math.sin(th);
                pts.push(P(R * Math.cos(th), r * Math.sin(phi), side * r * Math.cos(phi)));
                if (i % 2 === 1 && i < 16) {   // 톱니: 턱 면의 법선 쪽 (누우면 위, 서면 맞은 턱 쪽)
                    const tl = 6.5 * s, b0 = R * Math.sin(th);
                    const base = [R * Math.cos(th), b0 * Math.sin(phi), side * b0 * Math.cos(phi)];
                    const n = [0, Math.cos(phi), -side * Math.sin(phi)];
                    const w = 3 * s * Math.sign(Math.cos(th) || 1);
                    teeth.push([P(base[0] - 3 * s, base[1], base[2]), P(base[0] + n[0] * tl, base[1] + n[1] * tl, base[2] + n[2] * tl), P(base[0] + 3 * s, base[1], base[2])]);
                }
            }
            const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            teeth.forEach(t => {
                ctx.beginPath(); ctx.moveTo(...t[0]); ctx.lineTo(...t[1]); ctx.lineTo(...t[2]); ctx.closePath();
                ctx.fillStyle = side > 0 ? '#c9c3d4' : '#8d879b'; ctx.fill();
                ctx.lineWidth = 1.6 * s; ctx.strokeStyle = '#1a1424'; ctx.stroke();
            });
            path(); ctx.lineWidth = 6.5 * s; ctx.strokeStyle = '#1a1424'; ctx.stroke();
            path(); ctx.lineWidth = 3.6 * s; ctx.strokeStyle = side > 0 ? '#a7a1b5' : '#6f6980'; ctx.stroke();
            if (side > 0) { path(); ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctx.stroke(); }
        };
        ctx.save();
        ctx.globalAlpha = vis;
        const color = it.color || '150, 220, 120';
        ctx.globalCompositeOperation = 'lighter';   // 바닥에 옅은 사냥꾼 빛 (어두운 바닥에서도 보이게)
        ctx.fillStyle = `rgba(${color}, ${0.22 + 0.08 * Math.sin(time * 4)})`;
        ctx.beginPath(); ctx.ellipse(x, y + 2 * s, R * 1.7, R * 0.55, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        jaw(-1);
        // 용수철 팔 + 가운데 발판
        const [l0, l1] = [P(-R * 1.55, 0, 0), P(R * 1.55, 0, 0)];
        ctx.lineCap = 'round';
        ctx.lineWidth = 5 * s; ctx.strokeStyle = '#1a1424';
        ctx.beginPath(); ctx.moveTo(...l0); ctx.lineTo(...l1); ctx.stroke();
        ctx.lineWidth = 2.6 * s; ctx.strokeStyle = '#5d566e';
        ctx.beginPath(); ctx.moveTo(...l0); ctx.lineTo(...l1); ctx.stroke();
        const [px, py] = P(0, 0, 0);
        ctx.fillStyle = '#4a4458'; ctx.strokeStyle = '#1a1424'; ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.ellipse(px, py, R * 0.45, R * 0.45 * PERSP * 1.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
        jaw(1);
        if (c > 0.5) {   // 닫힌 턱: 맞물린 톱니가 반원 둘레를 따라 지그재그로 보이게 (옆에서 본 닫힌 곰덫)
            const ph = phi, k = smooth((c - 0.5) / 0.5), pts = [];
            for (let i = 0; i <= 18; i++) {
                const th = Math.PI * (0.06 + 0.88 * i / 18), r = R * (1 + (i % 2 ? 0.2 : -0.12) * k);
                pts.push(P(r * Math.cos(th), r * Math.sin(th) * Math.sin(ph), 0));
            }
            ctx.globalAlpha = vis * k;
            ctx.lineJoin = 'miter';
            ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.lineWidth = 4 * s; ctx.strokeStyle = '#1a1424'; ctx.stroke();
            ctx.lineWidth = 2 * s; ctx.strokeStyle = '#d6d0e0'; ctx.stroke();
            ctx.globalAlpha = vis;
        }
        if (c > 0.6 && age < 0.25) {   // 무는 순간 번쩍
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, x, y - drop - R * 0.9, R * 1.6, `rgba(255, 250, 220, ${0.7 * (1 - age / 0.25)})`);
        }
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
