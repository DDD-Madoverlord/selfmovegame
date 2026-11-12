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

// 박쥐 한 마리 (박쥐 떼, D-120): 몸통 + 뾰족 귀 + 손가락 뼈가 있는 날개막 (flap -1 위로 들림 ~ 1 아래로 내려침), 하늘빛 눈·테두리
function drawBat(ctx, x, y, k, face, flap, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * k, k);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    const lift = -flap * 13;   // 날개 끝 높이
    const wing = side => {   // side 1 = 앞(보는 쪽) 날개, -1 = 뒤 날개
        const sx = side;
        ctx.beginPath();
        ctx.moveTo(2 * sx, -3);
        ctx.quadraticCurveTo(10 * sx, -8 + lift * 0.5, 22 * sx, -4 + lift);       // 날개 위 테 (팔)
        ctx.lineTo(18 * sx, 4 + lift * 0.6);                                         // 날개 끝 → 막 가장자리 물결
        ctx.quadraticCurveTo(14 * sx, 1 + lift * 0.45, 12 * sx, 6 + lift * 0.35);
        ctx.quadraticCurveTo(8 * sx, 3 + lift * 0.25, 5 * sx, 7 + lift * 0.15);
        ctx.quadraticCurveTo(3 * sx, 3, 1 * sx, 4);
        ctx.closePath();
    };
    for (const side of [-1, 1]) {
        wing(side);
        ctx.fillStyle = side > 0 ? '#3a3350' : '#221d2e'; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = '#0a080e'; ctx.stroke();
        if (side > 0) {   // 앞 날개 가장자리 하늘빛 테 (어두운 배경에서도 보이게)
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            wing(side); ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(${color}, 0.35)`; ctx.stroke(); ctx.restore();
        }
        // 손가락 뼈
        ctx.beginPath();
        ctx.moveTo(4 * side, -2); ctx.lineTo(18 * side, 4 + lift * 0.6);
        ctx.moveTo(4 * side, -2); ctx.lineTo(12 * side, 6 + lift * 0.35);
        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(120, 110, 150, 0.8)'; ctx.stroke();
    }
    // 몸 + 머리 + 귀
    ctx.beginPath(); ctx.ellipse(0, 1, 4.2, 6, 0, 0, TAU); ctx.fillStyle = '#231e2e'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#0a080e'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -5); ctx.lineTo(2, -11); ctx.lineTo(4, -6); ctx.lineTo(5.5, -10.5); ctx.lineTo(6.5, -4);
    ctx.quadraticCurveTo(8, 0, 4, 1); ctx.quadraticCurveTo(0, 0, 1, -5); ctx.closePath();
    ctx.fillStyle = '#2c2638'; ctx.fill(); ctx.stroke();
    // 하늘빛 테 + 눈
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(${color}, 0.45)`;
    ctx.beginPath(); ctx.moveTo(-2 , -3); ctx.quadraticCurveTo(-10, -8 + lift * 0.5, -22, -4 + lift); ctx.stroke();
    ctx.fillStyle = `rgba(${color}, 1)`;
    ctx.fillRect(4.6, -4.4, 1.6, 1.6);
    glow(ctx, 5.4, -3.6, 4, `rgba(${color}, 0.5)`);
    ctx.restore();
}

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

    // ---- D-120 (2026-11-11 피드백) ----
    // 반구 충격파 (대지 강타·지면 내려찍기 — 사용자 참고 영상): 땅 위로 빛나는 반구가 퍼짐. 반구 테는 옆(땅 가까이)이 밝고 꼭대기로 갈수록 옅음,
    //   땅에는 납작한 타원 고리. 처음 0.12초는 가운데 섬광 + 땅을 따라 가로 빛줄기  { r, h(높이 비), color }
    domeWave(ctx, x, y, it, u, s, time) {
        const R = (it.r || 220) * s * easeOut(Math.min(1, u * 1.15)) + 18 * s;
        const H = R * (it.h ?? 0.55), RY = R * (it.flat ?? 0.13);
        const a = u < 0.06 ? u / 0.06 : Math.pow(1 - (u - 0.06) / 0.94, 0.9);
        const c = it.color || '255, 205, 120';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (u < 0.3) {   // 섬광 + 가로 빛줄기
            const f = 1 - u / 0.3;
            glow(ctx, x, y - 14 * s, 80 * s * (0.6 + f * 0.6), `rgba(255, 245, 220, ${0.85 * f})`);
            ellipseGlow(ctx, x, y, 210 * s * (0.7 + 0.5 * (1 - f)), 5 * s, `rgba(255, 240, 210, ${0.9 * f})`);
        }
        // 반구 테: 아래(땅)에서 밝고 위로 사라지는 세로 그라데이션 선
        const grad = ctx.createLinearGradient(0, y, 0, y - H);
        grad.addColorStop(0, `rgba(${c}, ${0.95 * a})`);
        grad.addColorStop(0.45, `rgba(${c}, ${0.55 * a})`);
        grad.addColorStop(1, `rgba(${c}, 0)`);
        const dome = () => { ctx.beginPath(); ctx.ellipse(x, y, R, H, 0, Math.PI, TAU); };
        for (const [w, al] of [[18, 0.25], [7, 0.6], [2.6, 1]]) {
            ctx.globalAlpha = al;
            dome(); ctx.lineWidth = w * s; ctx.strokeStyle = grad; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // 땅 타원 고리 (앞쪽 반은 밝게, 뒤쪽 반은 옅게)
        for (const [w, al] of [[10, 0.25], [2.4, 0.95]]) {
            ctx.lineWidth = w * s;
            ctx.strokeStyle = `rgba(${c}, ${al * a})`;
            ctx.beginPath(); ctx.ellipse(x, y, R, RY, 0, 0, Math.PI); ctx.stroke();
            ctx.strokeStyle = `rgba(${c}, ${al * a * 0.45})`;
            ctx.beginPath(); ctx.ellipse(x, y, R, RY, 0, Math.PI, TAU); ctx.stroke();
        }
        ellipseGlow(ctx, x, y, R * 0.9, RY * 1.2, `rgba(${c}, ${0.18 * a})`);   // 고리 안 땅 빛
        ctx.restore();
    },

    // 먼지 구름 (대지 강타·지면 내려찍기): 가운데서 솟는 기둥 뭉게구름 + 땅을 따라 좌우로 굴러 퍼지는 뭉게구름. 위는 밝고 아래는 어두운 뭉치,
    //   천천히 커지며 떠오르다 끝 60%에 걸쳐 옅어짐  { w(좌우 퍼짐), h(기둥 높이), color, n }
    dustCloud(ctx, x, y, it, u, s, time) {
        if (!it.puffs) {
            const r = (k => () => { k = (k * 9301 + 49297) % 233280; return k / 233280; })(Math.floor(Math.random() * 233280));
            it.puffs = [];
            const W = it.w || 220, Hc = it.h || 130;
            for (let i = 0; i < 16; i++) {   // 기둥: 위로 갈수록 작아지고 조금씩 기울어짐 (뭉치 여러 개가 겹쳐 한 덩어리)
                const f = i / 15;
                it.puffs.push({ x: (r() - 0.5) * 30 + f * 12, y: -(10 + f * Hc), r: 27 - f * 8 + r() * 9, d: 0.04 + f * 0.25, rise: 14 + r() * 12, drift: (r() - 0.3) * 12 });
            }
            for (let i = 0; i < 28; i++) {   // 바닥 구름: 좌우로 굴러감
                const side = i % 2 ? 1 : -1, f = 0.1 + r() * 0.9;
                it.puffs.push({ x: side * W * f, y: -(6 + r() * 14), r: 15 + r() * 13 * (1.2 - f), d: 0.02 + f * 0.18, rise: 3 + r() * 7, drift: side * 16 * f, ground: true });
            }
            it.puffs.sort((p, q) => q.r - p.r);
        }
        const t = it.t, life = it.dur;
        const fade = 1 - smooth((u - 0.4) / 0.6);
        const c = (it.color || '150, 138, 168').split(',').map(Number);
        const lite = c.map(v => Math.min(255, Math.round(v * 1.12 + 12))).join(', '), dark = c.map(v => Math.round(v * 0.62)).join(', '), mid = c.join(', ');
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (const p of it.puffs) {
            const k = smooth((t - p.d) / 0.35);
            if (k <= 0) continue;
            const grow = 1 + (t / life) * 0.55;
            const px = x + (p.ground ? p.x * easeOut(Math.min(1, (t - p.d) / 0.6)) : p.x) * s + p.drift * t * s;
            const py = y + (p.ground ? p.y : p.y * easeOut(Math.min(1, (t - p.d) / 0.5))) * s - p.rise * t * s;
            const rr = p.r * s * k * grow;
            const al = (it.alpha ?? 0.8) * fade * k;
            // 부드러운 뭉치: 위쪽이 살짝 밝고 가장자리는 번지듯 사라짐 (공처럼 반들거리지 않게)
            const g = ctx.createRadialGradient(px, py - rr * 0.2, 0, px, py, rr);
            g.addColorStop(0, `rgba(${lite}, ${al * 0.85})`);
            g.addColorStop(0.5, `rgba(${mid}, ${al * 0.7})`);
            g.addColorStop(0.8, `rgba(${dark}, ${al * 0.3})`);
            g.addColorStop(1, `rgba(${dark}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        }
        ctx.restore();
    },

    // 박쥐 떼 (박쥐 음파 연구체 '박쥐 떼'): n마리가 앞쪽 구역 위를 날아다니다 차례로 적에게 내리꽂혀 물고 다시 날아오름.
    //   targets() → [[dx, 위로 높이]...] (기준점에서 적 가슴까지). 날개를 퍼덕이는 검은 박쥐 + 하늘빛 눈·테  { n, w, color }
    batSwarm(ctx, x, y, it, u, s, time) {
        const life = it.remaining ? it.remaining() : it.dur - it.t;
        const vis = Math.min(smooth(it.t / 0.4), smooth(life / 0.4));
        if (vis <= 0) return;
        const n = it.n || 7, W = (it.w || 320) * s, c = it.color || '120, 230, 255';
        const tg = it.targets ? it.targets() : [];
        ctx.save();
        for (let i = 0; i < n; i++) {
            const ph = hash(i, 3) * TAU, sp = 0.9 + hash(i, 5) * 0.5;
            const born = Math.min(1, Math.max(0, (it.t - i * 0.08) / 0.5));   // 주인공 쪽에서 차례로 날아나옴
            // 맴돌기: 구역 위에서 8자로
            const ox = x + W * (0.5 + 0.42 * Math.sin(it.t * 0.9 * sp + ph)) * (0.25 + 0.75 * born);
            const oy = y - (95 + 35 * Math.sin(it.t * 1.8 * sp + ph * 2) + hash(i, 7) * 30) * s;
            // 내리꽂기: 1.6초마다 한 번 (박쥐마다 엇갈림) 적에게
            let bx = ox, by = oy, dive = 0;
            if (tg.length) {
                const cyc = ((it.t * 0.62 + hash(i, 9)) % 1);
                dive = cyc < 0.3 ? Math.sin(cyc / 0.3 * Math.PI) : 0;
                const [dx, up] = tg[i % tg.length];
                const tx = x + dx + (hash(i, 11) - 0.5) * 16 * s, ty = y - up + (hash(i, 13) - 0.5) * 20 * s;
                bx = ox + (tx - ox) * dive; by = oy + (ty - oy) * dive;
                if (dive > 0.92) {   // 무는 순간 하늘빛 번쩍
                    ctx.globalCompositeOperation = 'lighter';
                    glow(ctx, tx, ty, 16 * s, `rgba(${c}, ${0.6 * vis})`);
                }
            }
            const vx = Math.cos(it.t * 0.9 * sp + ph) * (dive > 0 ? 0 : 1);
            const face = vx >= 0 ? 1 : -1;
            const flap = Math.sin(time * (16 + hash(i, 15) * 6) + ph);   // 날개 퍼덕임 (-1 위 ~ 1 아래)
            drawBat(ctx, bx, by, (it.size ?? 1.6) * (0.8 + hash(i, 17) * 0.35) * s, face, flap, vis, c);
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
