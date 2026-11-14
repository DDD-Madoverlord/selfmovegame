/* ==========================================================================
   PROJECT: MAD OVERLORD // 스킬 이펙트 개선 보조 층 (D-118, 2026-11-09)
   주연은 기존 손그림 시트(vfxPlayer VFX_SHEETS)이고, 여기는 시트로 할 수 없는 보조만 그린다.
     gather  : 둘레에서 빛줄기가 모이며 가운데 빛이 커짐 (관통 저격 충전 — bass_drop 역재생과 함께) { r, count, color }
     reticle : 표적 조준 고리 (줄어들며 고정 — 표적 지정 포격 예고 표식)                          { r, color }
     travel  : x,y → to 로 날아가는 작은 뼛가시 (가시 폭풍)                                       { arc, len, w, color, tip }
     drone   : 떠다니는 수리 드론 그림(art/repair_drone) + 1초마다 치료 광선                        { size, ox, oy, phase, tx, ty, color }
   D-128 (8차): petalVortex(꽃잎 회오리)
   D-127 (7차): threadPath(붉은 실 — 적을 따라감) · threadWrap(실 감기) · candleGlow(촛불 빛) · rainFall(하늘에서 내리는 빛비)
   D-122 (5차): lob(불씨·포탄·용 비늘 포물선) · heartPulse(심장 고동) · riftCut(차원 절단 틈) · afterimage(캐릭터 잔상) · dashStreak(대시 자국)
     (D-123: 땅 판 upheaval·빛 날개 wings·바람 줄기 gust는 Gemini 손그림 시트 earth_flip·wing_gust로 바꾸며 지움)
   ========================================================================== */

const WHITE = '255, 255, 255';
const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = u => 1 - (1 - u) * (1 - u);
const easeIn = u => u * u;

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
    },

    // ---- D-122 (2026-11-14 5차 개선) ----
    // 던진 작은 덩이: x,y → to 포물선 (arc) + 지나온 꼬리. style 'ember'(용암 불씨) · 'shell'(가속포 포탄) · 'scale'(금빛 용 비늘, 빙글 돌며 반짝)
    //   { to, arc, style, color, r, trail(꼬리 길이 0~1), seed }
    lob(ctx, x, y, it, u, s, time) {
        const [px, py] = travelPos(it, u, x, y, s);
        const [qx, qy] = travelPos(it, Math.max(0, u - 0.04), x, y, s);
        const ang = u > 0.04 ? Math.atan2(py - qy, px - qx) : Math.atan2((it.to?.[1] ?? y) - y, (it.to?.[0] ?? x + 1) - x) - 0.6;
        const c = it.color || '255, 140, 50', r = (it.r || 6) * s, style = it.style || 'ember', seed = it.seed ?? 0;
        const a = smooth(u / 0.06);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const steps = 10, span = it.trail ?? 0.32;
        for (let i = steps; i >= 1; i--) {   // 꼬리: 지나온 길, 뒤로 갈수록 가늘고 옅게 (비늘은 반짝이 가루)
            if (style === 'scale') {
                const f = Math.max(0, u - span * i / steps);
                if (f <= 0 || i % 2) continue;
                const [gx, gy] = travelPos(it, f, x, y, s);
                glow(ctx, gx + (hash(i, seed) - 0.5) * 6 * s, gy + (hash(i, seed + 1) - 0.5) * 6 * s, r * 0.7 * (1 - i / steps) + 1, `rgba(255, 240, 170, ${0.7 * (1 - i / steps) * a})`);
                continue;
            }
            const f0 = Math.max(0, u - span * i / steps), f1 = Math.max(0, u - span * (i - 1) / steps);
            if (f1 <= 0) continue;
            const [ax, ay] = travelPos(it, f0, x, y, s), [bx, by] = travelPos(it, f1, x, y, s);
            const k = 1 - i / steps;
            ctx.strokeStyle = `rgba(${style === 'shell' ? '200, 200, 210' : c}, ${(style === 'shell' ? 0.22 : 0.55) * k * a})`;
            ctx.lineWidth = r * (style === 'shell' ? 1.8 : 1.5) * k + 1;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
        if (style === 'shell') {
            glow(ctx, px, py, r * 3.4, `rgba(${c}, ${0.4 * a})`);
            ctx.translate(px, py);
            ctx.rotate(ang);
            glow(ctx, -r * 1.6, 0, r * 1.6, `rgba(${c}, ${0.9 * a})`);   // 달아오른 꽁무니
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = a;
            const g = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
            g.addColorStop(0, '#8a8f9c'); g.addColorStop(0.45, '#3b3e48'); g.addColorStop(1, '#16171c');
            ctx.fillStyle = g;
            ctx.strokeStyle = '#0c0c10';
            ctx.lineWidth = Math.max(1, r * 0.22);
            ctx.beginPath();
            ctx.moveTo(-r * 1.5, -r * 0.72);
            ctx.lineTo(r * 0.5, -r * 0.72);
            ctx.quadraticCurveTo(r * 1.7, -r * 0.6, r * 1.9, 0);
            ctx.quadraticCurveTo(r * 1.7, r * 0.6, r * 0.5, r * 0.72);
            ctx.lineTo(-r * 1.5, r * 0.72);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = `rgba(${c}, 0.95)`;   // 붉은 띠
            ctx.fillRect(-r * 0.9, -r * 0.72, r * 0.42, r * 1.44);
        } else if (style === 'scale') {
            glow(ctx, px, py, r * 3, `rgba(${c}, ${0.45 * a})`);
            ctx.translate(px, py);
            ctx.rotate(ang + Math.PI / 2 + Math.sin(time * 7 + seed) * 0.5);
            const flip = Math.cos(time * 11 + seed * 3);   // 빙글 돌며 앞뒤가 바뀜 → 폭이 줄었다 늚
            ctx.scale(0.25 + 0.75 * Math.abs(flip), 1);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = a;
            const g = ctx.createLinearGradient(-r, -r * 1.3, r, r * 1.3);
            g.addColorStop(0, '#fff3b8'); g.addColorStop(0.4, '#f2c444'); g.addColorStop(1, '#a8681a');
            ctx.fillStyle = g;
            ctx.strokeStyle = '#5a3608';
            ctx.lineWidth = Math.max(1, r * 0.2);
            ctx.beginPath();   // 방패꼴 비늘: 둥근 윗변, 뾰족한 아랫끝
            ctx.moveTo(0, r * 1.35);
            ctx.quadraticCurveTo(-r * 1.15, r * 0.2, -r * 0.95, -r * 0.65);
            ctx.quadraticCurveTo(0, -r * 1.45, r * 0.95, -r * 0.65);
            ctx.quadraticCurveTo(r * 1.15, r * 0.2, 0, r * 1.35);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(120, 70, 10, 0.75)';   // 가운데 골
            ctx.lineWidth = Math.max(1, r * 0.14);
            ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 1.0); ctx.stroke();
            if (flip > 0.75) {   // 앞면이 보일 때 번쩍
                ctx.globalCompositeOperation = 'lighter';
                glow(ctx, -r * 0.3, -r * 0.4, r * 1.4, `rgba(255, 250, 220, ${(flip - 0.75) * 3.2})`);
            }
        } else {
            const fl = 0.85 + 0.15 * Math.sin(time * 40 + seed * 5);
            glow(ctx, px, py, r * 3.2 * fl, `rgba(${c}, ${0.5 * a})`);
            glow(ctx, px, py, r * 1.5, `rgba(${c}, ${0.95 * a})`);
            glow(ctx, px, py, r * 0.7, `rgba(255, 245, 210, ${a})`);
        }
        ctx.restore();
    },

    // 심장 고동 (핵 심장): 가슴에서 두 번 쿵-쿵 (lub-dub) 붉은 빛 + 핏줄처럼 뻗는 빛줄기  { r, color }
    heartPulse(ctx, x, y, it, u, s) {
        const beat = q => Math.exp(-Math.pow(q / 0.07, 2));
        const k = beat(u - 0.06) + 0.75 * beat(u - 0.34);
        const R = (it.r || 46) * s, c = it.color || '255, 60, 30';
        if (k < 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, R * (1.6 + 1.4 * k), `rgba(${c}, ${0.42 * k})`);
        glow(ctx, x, y, R * (0.55 + 0.35 * k), `rgba(${c}, ${0.95 * k})`);
        glow(ctx, x, y, R * 0.3, `rgba(255, 235, 200, ${k})`);
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {   // 핏줄 빛: 가슴에서 바깥으로 갈라지며 뻗음
            const a0 = hash(i, 4) * TAU, L = R * (1.2 + hash(i, 5) * 1.1) * (0.6 + 0.4 * k);
            ctx.strokeStyle = `rgba(${c}, ${0.85 * k})`;
            ctx.lineWidth = (2.6 - i * 0.15) * s;
            ctx.beginPath();
            let px = x + Math.cos(a0) * R * 0.35, py = y + Math.sin(a0) * R * 0.35;
            ctx.moveTo(px, py);
            for (let j = 1; j <= 4; j++) {
                const aj = a0 + (hash(i * 7 + j, 6) - 0.5) * 0.9;
                px += Math.cos(aj) * L / 4; py += Math.sin(aj) * L / 4;
                ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        ctx.restore();
    },

    // 차원 절단: x,y → to 로 칼끝이 살짝 휜 호를 그으며 나가고(0~0.12) 그 자국이 공간의 틈처럼 벌어졌다(검은 속 + 청록 테 + 별빛) 닫힘.
    //   두께는 가운데가 넓고 양 끝이 뾰족 (레이저처럼 고른 줄이 아니게)  { to, color, gap, bow }
    riftCut(ctx, x, y, it, u, s, time) {
        const [tx, ty] = it.to || [x + 400 * s, y];
        const c = it.color || '150, 255, 240';
        const L = Math.hypot(tx - x, ty - y), ang = Math.atan2(ty - y, tx - x);
        const draw = Math.min(1, u / 0.12);
        const open = u < 0.12 ? 0 : u < 0.26 ? smooth((u - 0.12) / 0.14) : u < 0.55 ? 1 : 1 - smooth((u - 0.55) / 0.3);
        const a = u > 0.82 ? 1 - (u - 0.82) / 0.18 : 1;
        const G = (it.gap || 14) * s * open, bow = (it.bow ?? 0.05) * L, N = 32;
        const P = (f, off) => [f * L, -bow * Math.sin(f * Math.PI) + off];
        const lens = (half, jag) => {   // 가운데가 두꺼운 렌즈 모양 (보이는 길이 draw까지)
            ctx.beginPath();
            for (let i = 0; i <= N; i++) { const f = i / N * draw, t = Math.sin(f * Math.PI); ctx.lineTo(...P(f, -(half * t + (jag ? (hash(i, 22) - 0.5) * 3 * s * t : 0)))); }
            for (let i = N; i >= 0; i--) { const f = i / N * draw, t = Math.sin(f * Math.PI); ctx.lineTo(...P(f, half * t + (jag ? (hash(i, 23) - 0.5) * 3 * s * t : 0))); }
            ctx.closePath();
        };
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${c}, ${0.3 * a})`;
        lens(G + 9 * s, false); ctx.fill();                          // 바깥 빛
        ctx.fillStyle = `rgba(${c}, ${0.85 * a})`;
        lens(G + 3.2 * s, true); ctx.fill();                         // 청록 테
        if (G > 0.8) {   // 틈 속: 검은 공간 + 별빛
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(8, 4, 26, ${0.95 * a})`;
            lens(G, true); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 16; i++) {
                const f = hash(i, 24) * draw, tp = Math.sin(f * Math.PI);
                const [px, py] = P(f + Math.sin(time * 2 + i) * 0.004, (hash(i, 25) - 0.5) * 1.5 * G * tp);
                glow(ctx, px, py, 2.4 * s, `rgba(${hash(i, 26) > 0.5 ? WHITE : c}, ${0.95 * a * open})`);
            }
        } else {
            ctx.fillStyle = `rgba(${WHITE}, ${a})`;
            lens(1.4 * s, false); ctx.fill();                        // 흰 칼금
        }
        if (u < 0.2) {   // 그어 나가는 칼끝 섬광 + 작은 초승달
            const [hx, hy] = P(draw, 0), f = 1 - u / 0.2;
            glow(ctx, hx, hy, 40 * s, `rgba(${c}, ${0.8 * f})`);
            glow(ctx, hx, hy, 13 * s, `rgba(${WHITE}, ${f})`);
            ctx.strokeStyle = `rgba(${WHITE}, ${0.9 * f})`;
            ctx.lineWidth = 2.4 * s;
            ctx.beginPath(); ctx.moveTo(hx - 30 * s, hy - 26 * s); ctx.quadraticCurveTo(hx + 16 * s, hy, hx - 30 * s, hy + 26 * s); ctx.stroke();
        }
        ctx.restore();
    },

    // 잔상 (마검 연무): 캐릭터 그림을 찍어 둔 것(img)을 그 자리에 그렸다가 흐려짐 + 색 빛 테  { img, glowImg, w, h, ox, oy, flip }
    afterimage(ctx, x, y, it, u, s) {
        if (!it.img) return;
        const w = it.w, h = it.h, a = (u < 0.08 ? u / 0.08 : 1) * Math.pow(1 - u, 0.8);
        ctx.save();
        ctx.translate(x, y);
        if (it.flip) ctx.scale(-1, 1);
        if (it.glowImg) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.6 * a;
            ctx.drawImage(it.glowImg, (it.ox || 0) - w * 0.03, (it.oy || 0) - h * 0.03, w * 1.06, h * 1.06);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (it.alpha ?? 0.85) * a;
        ctx.drawImage(it.img, it.ox || 0, it.oy || 0, w, h);
        ctx.restore();
    },

    // 대시 자국: x,y → to 곧은 붉은 빛 줄 (잔상 사이를 잇는 칼바람)  { to, color, w }
    dashStreak(ctx, x, y, it, u, s) {
        const [tx, ty] = it.to || [x, y];
        const c = it.color || '255, 60, 80', a = 1 - u;
        const head = Math.min(1, u / 0.25);
        const hx = x + (tx - x) * head, hy = y + (ty - y) * head;
        const tail = Math.max(0, (u - 0.2) / 0.8);
        const sx = x + (tx - x) * tail, sy = y + (ty - y) * tail;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [w, col, aa] of [[(it.w || 16) * 1.6, c, 0.22], [it.w || 16, c, 0.55], [3, WHITE, 0.9]]) {
            ctx.strokeStyle = `rgba(${col}, ${aa * a})`;
            ctx.lineWidth = w * s * (1 - tail * 0.5);
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
        }
        ctx.restore();
    },

    // 화살 꼬리: x,y → to 를 fly초 동안 머리가 나아가고, 꼬리는 len초 뒤를 따라옴 → 닿은 뒤 옅어짐 (빛 바늘 석궁 기본 공격, D-128)  { to, fly, len, color, w }
    boltTrail(ctx, x, y, it, u, s) {
        const [tx, ty] = it.to || [x, y], fly = it.fly || 0.2, len = it.len ?? 0.08;
        const head = Math.min(1, it.t / fly), tail = Math.min(1, Math.max(0, (it.t - len) / fly));
        if (head <= tail) return;
        const c = it.color || '255, 215, 130', a = it.t > fly ? Math.max(0, 1 - (it.t - fly) / Math.max(0.01, it.dur - fly)) : 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const hx = x + (tx - x) * head, hy = y + (ty - y) * head, sx = x + (tx - x) * tail, sy = y + (ty - y) * tail;
        const g = ctx.createLinearGradient(sx, sy, hx, hy);
        g.addColorStop(0, `rgba(${c}, 0)`);
        g.addColorStop(1, `rgba(${c}, ${0.7 * a})`);
        for (const [w, st] of [[(it.w || 5) * 2.4, g], [(it.w || 5) * 0.5, `rgba(255, 250, 225, ${0.8 * a})`]]) {
            ctx.strokeStyle = st;
            ctx.lineWidth = w * s;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
        }
        ctx.restore();
    },

    // ---- D-126 (2026-11-14 저녁) ----
    // 별자리 선: x,y → to 가는 빛줄이 그어져(0~0.15) 은은히 반짝이며 남음 + 양 끝 별  { to, color, w }
    starLine(ctx, x, y, it, u, s, time) {
        const [tx, ty] = it.to || [x, y];
        const c = it.color || '200, 160, 255';
        const grow = Math.min(1, it.t / 0.15);
        const a = (it.t < 0.15 ? 1 : 0.75 + 0.25 * Math.sin(time * 9 + x * 0.05)) * (u > 0.85 ? (1 - u) / 0.15 : 1);
        const ex = x + (tx - x) * grow, ey = y + (ty - y) * grow;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [w, col, aa] of [[(it.w || 5) * 3, c, 0.22], [it.w || 5, c, 0.7], [1.6, WHITE, 0.95]]) {
            ctx.strokeStyle = `rgba(${col}, ${aa * a})`;
            ctx.lineWidth = w * s;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.restore();
    },

    // 별 (별자리 점): 네 갈래 반짝이는 별 + 둘레 빛, 천천히 돌며 맥동  { r, color }
    starPoint(ctx, x, y, it, u, s, time) {
        const R = (it.r || 22) * s, c = it.color || '200, 160, 255';
        const pop = it.t < 0.12 ? 1 + 1.2 * (1 - it.t / 0.12) : 1;
        const a = (u > 0.85 ? (1 - u) / 0.15 : 1) * (0.85 + 0.15 * Math.sin(time * 12 + x));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, R * 2.6 * pop, `rgba(${c}, ${0.45 * a})`);
        glow(ctx, x, y, R * 0.8, `rgba(${WHITE}, ${a})`);
        ctx.translate(x, y);
        ctx.rotate(time * 0.8);
        for (let k = 0; k < 2; k++) {
            ctx.rotate(Math.PI / 4 * k);
            const L = R * pop * (k ? 1.1 : 1.9);
            ctx.fillStyle = `rgba(${k ? c : WHITE}, ${a})`;
            ctx.beginPath();
            for (let j = 0; j < 4; j++) {
                const ang = j * Math.PI / 2;
                ctx.lineTo(Math.cos(ang) * L, Math.sin(ang) * L);
                ctx.lineTo(Math.cos(ang + Math.PI / 4) * R * 0.22, Math.sin(ang + Math.PI / 4) * R * 0.22);
            }
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },

    // 별빛 거품 (별빛 거품): 몸을 감싼 무지개빛 비눗방울 — 테두리 색이 돌고, 위쪽 반사광, 안에 반짝이는 별가루. 끝에 톡 터짐
    //   { r, ry, color, remaining? }
    bubble(ctx, x, y, it, u, s, time) {
        const R = (it.r || 110) * s, Ry = (it.ry || it.r || 110) * s;
        const left = it.dur - it.t;
        const wob = 1 + Math.sin(time * 3.1) * 0.025;
        const grow = Math.min(1, it.t / 0.25);
        const popT = left < 0.25 ? 1 - left / 0.25 : 0;
        const a = (popT ? 1 - popT : 1) * smooth(grow);
        if (a <= 0.01) return;
        const rx = R * wob * (0.6 + 0.4 * easeOut(grow)) * (1 + popT * 0.25), ry = Ry / wob * (0.6 + 0.4 * easeOut(grow)) * (1 + popT * 0.25);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 몸: 가운데 투명, 가장자리로 갈수록 진함
        const g = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.55, x, y, Math.max(rx, ry));
        g.addColorStop(0, `rgba(160, 140, 255, 0)`);
        g.addColorStop(0.75, `rgba(170, 150, 255, ${0.10 * a})`);
        g.addColorStop(1, `rgba(220, 200, 255, ${0.35 * a})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
        // 무지개빛 테두리: 색 띠 4개가 천천히 돎
        const cols = ['255, 140, 220', '140, 220, 255', '200, 160, 255', '255, 230, 160'];
        ctx.lineWidth = 3.2 * s;
        for (let k = 0; k < 4; k++) {
            const a0 = time * 0.9 + k * TAU / 4;
            ctx.strokeStyle = `rgba(${cols[k]}, ${0.75 * a})`;
            ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0, a0 + TAU / 4 + 0.15); ctx.stroke();
        }
        // 반사광
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * a})`;
        ctx.lineWidth = 4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(x, y, rx * 0.82, ry * 0.82, 0, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
        glow(ctx, x - rx * 0.42, y - ry * 0.5, 9 * s, `rgba(255, 255, 255, ${0.9 * a})`);
        // 안의 별가루
        for (let i = 0; i < 12; i++) {
            const ang = hash(i, 30) * TAU + time * (0.3 + hash(i, 31) * 0.5), rr = 0.25 + hash(i, 32) * 0.6;
            const tw = 0.5 + 0.5 * Math.sin(time * 6 + i * 2.1);
            glow(ctx, x + Math.cos(ang) * rx * rr, y + Math.sin(ang) * ry * rr, 3 * s, `rgba(${WHITE}, ${0.8 * tw * a})`);
        }
        if (popT) {   // 터짐: 물방울 조각이 퍼짐
            for (let i = 0; i < 16; i++) {
                const ang = i / 16 * TAU, d = 1 + popT * 0.6;
                glow(ctx, x + Math.cos(ang) * rx * d, y + Math.sin(ang) * ry * d, 4 * s, `rgba(${cols[i % 4]}, ${(1 - popT)})`);
            }
        }
        ctx.restore();
    },

    // 심해 압력장: w 너비 바닥에서 h 높이까지 짙은 바닷물 기둥 — 위 수면이 일렁이고(밝은 테), 빛줄기(카우스틱)가 비스듬히 내려오며,
    //   거품이 오르고, 1초마다 위에서 아래로 짓누르는 압력 물결이 내려옴. remaining()으로 끝에 옅어짐  { w, h, color }
    pressureField(ctx, x, y, it, u, s, time) {
        const W = (it.w || 400) * s, H = (it.h || 230) * s, c = it.color || '20, 120, 150';
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.4) * Math.min(1, Math.max(0, left) / 0.6);
        if (a <= 0.01) return;
        const x0 = x - W / 2, top = y - H;
        const surf = px => top + Math.sin(px * 0.035 + time * 2.2) * 6 * s + Math.sin(px * 0.013 - time * 1.3) * 5 * s;
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(x0, y);
            for (let i = 0; i <= 40; i++) { const px = x0 + W * i / 40; ctx.lineTo(px, surf(px)); }
            ctx.lineTo(x0 + W, y);
            ctx.closePath();
        };
        ctx.save();
        // 양옆 14%는 0 → 1로 옅어지는 가로 띠 (옆 벽이 칼로 자른 듯 보이지 않게, D-126)
        const side = (c0, a0) => {
            const g = ctx.createLinearGradient(x0, 0, x0 + W, 0);
            g.addColorStop(0, `rgba(${c0}, 0)`); g.addColorStop(0.14, `rgba(${c0}, ${a0})`);
            g.addColorStop(0.86, `rgba(${c0}, ${a0})`); g.addColorStop(1, `rgba(${c0}, 0)`);
            return g;
        };
        // 물 몸통: 위는 옅고 아래(깊은 곳)는 짙은 남색 — 보통 섞기로 살짝 어둡게
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = side('25, 100, 140', 0.17 * a);
        body(); ctx.fill();
        ctx.save(); body(); ctx.clip();
        ctx.fillStyle = side('6, 26, 60', 0.16 * a);
        ctx.fillRect(x0, top + (y - top) * 0.35, W, (y - top) * 0.65);
        ctx.fillRect(x0, top + (y - top) * 0.65, W, (y - top) * 0.35);
        ctx.restore();
        // 양옆 가장자리는 부드럽게 (옆 벽이 칼로 자른 듯 보이지 않게)
        ctx.save(); body(); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        // 빛줄기
        for (let i = 0; i < 6; i++) {
            const bx = x0 + W * (hash(i, 40) * 0.9 + 0.05) + Math.sin(time * 0.7 + i) * 18 * s, bw = (16 + 22 * hash(i, 41)) * s;
            const gr = ctx.createLinearGradient(0, top, 0, y);
            gr.addColorStop(0, `rgba(150, 255, 240, ${0.14 * a})`);
            gr.addColorStop(1, 'rgba(150, 255, 240, 0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + bw, top); ctx.lineTo(bx + bw * 0.4 - 30 * s, y); ctx.lineTo(bx - bw * 0.6 - 30 * s, y); ctx.closePath(); ctx.fill();
        }
        // 압력 물결: 1초마다 위에서 바닥으로 내려오는 밝은 띠
        const q = (time * 1.0) % 1, py = top + (y - top) * easeIn(q);
        ctx.strokeStyle = `rgba(160, 255, 245, ${0.45 * (1 - q) * a})`;
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) { const px = x0 + W * i / 30; ctx.lineTo(px, py + Math.sin(px * 0.05 + time * 4) * 4 * s); }
        ctx.stroke();
        // 거품
        for (let i = 0; i < 22; i++) {
            const bx = x0 + W * hash(i, 42) + Math.sin(time * 2 + i) * 6 * s;
            const rise = ((time * (0.25 + hash(i, 43) * 0.3) + hash(i, 44)) % 1);
            const by = y - (y - top) * rise, br = (2 + 4 * hash(i, 45)) * s;
            ctx.strokeStyle = `rgba(200, 255, 255, ${0.6 * a * (1 - rise * 0.5)})`;
            ctx.lineWidth = 1.4 * s;
            ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.stroke();
        }
        ctx.restore();
        // 수면 테 (밝은 물결선)
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [lw, aa] of [[8, 0.18], [2.4, 0.75]]) {
            ctx.strokeStyle = side('150, 255, 240', aa * a);
            ctx.lineWidth = lw * s;
            ctx.beginPath();
            for (let i = 0; i <= 40; i++) { const px = x0 + W * i / 40; i ? ctx.lineTo(px, surf(px)) : ctx.moveTo(px, surf(px)); }
            ctx.stroke();
        }
        ctx.restore();
    },

    // ---- D-127 (2026-11-14 밤, 봉합 성녀) ----
    // 붉은 실: path()의 점들을 잇는 늘어진 실 (적을 따라감). mode 'chain' = 점 차례로, 'fan' = 첫 점(시전자)에서 나머지 각각으로.
    //   reveal초 동안 앞에서부터 실이 그어지고, 꿰인 자리(첫 점 빼고)마다 X자 땀 + 빛. 실을 따라 빛 한 점이 흐름  { color, w, mode, reveal, sag }
    threadPath(ctx, x, y, it, u, s, time) {
        const pts = it.path ? it.path() : null;
        if (!pts || pts.length < 2) return;
        const c = it.color || '235, 40, 70';
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.08) * Math.min(1, Math.max(0, left) / 0.4);
        if (a <= 0.01) return;
        const segs = it.mode === 'fan' ? pts.slice(1).map(p => [pts[0], p]) : pts.slice(1).map((p, i) => [pts[i], p]);
        const shown = it.reveal ? Math.min(segs.length, it.t / it.reveal * segs.length) : segs.length;
        const curve = (p, q, f) => {   // p → q 늘어진 실 위 f(0~1) 자리
            const sag = ((it.sag ?? 12) + Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.05) * s;
            return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f + Math.sin(f * Math.PI) * sag];
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let k = 0; k < segs.length && k < shown; k++) {
            const [p, q] = segs[k], part = it.mode === 'fan' ? Math.min(1, shown - k) : Math.min(1, shown - k);
            for (const [w, col, aa] of [[(it.w || 2.6) * 3.2, c, 0.22], [it.w || 2.6, c, 0.85], [0.9, '255, 200, 210', 0.7]]) {
                ctx.strokeStyle = `rgba(${col}, ${aa * a})`;
                ctx.lineWidth = w * s;
                ctx.beginPath();
                for (let i = 0; i <= 16; i++) { const [px, py] = curve(p, q, part * i / 16); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
                ctx.stroke();
            }
            const f = (time * 0.9 + k * 0.37) % 1;   // 흐르는 빛
            if (f < part) { const [gx, gy] = curve(p, q, f); glow(ctx, gx, gy, 7 * s, `rgba(255, 170, 190, ${0.8 * a})`); }
        }
        // 꿰인 자리: X자 땀 + 빛
        ctx.lineWidth = 2.2 * s;
        for (let k = 0; k < segs.length && k < shown - 0.98; k++) {
            const [qx, qy] = segs[k][1], R = 7 * s, pulse = 0.8 + 0.2 * Math.sin(time * 8 + k);
            glow(ctx, qx, qy, 16 * s * pulse, `rgba(${c}, ${0.45 * a})`);
            ctx.strokeStyle = `rgba(255, 210, 220, ${0.9 * a})`;
            ctx.beginPath();
            ctx.moveTo(qx - R, qy - R); ctx.lineTo(qx + R, qy + R);
            ctx.moveTo(qx + R, qy - R); ctx.lineTo(qx - R, qy + R);
            ctx.stroke();
        }
        ctx.restore();
    },

    // 실 감기: 몸 둘레를 붉은 실 고리들이 돌며 감김 (타원 고리가 기울어 돌고 위아래로 오르내림) — 실 고치  { rx, ry, count, color, alpha }
    threadWrap(ctx, x, y, it, u, s, time) {
        const rx = (it.rx || 70) * s, ry = (it.ry || 100) * s, c = it.color || '235, 40, 70';
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.2) * Math.min(1, Math.max(0, left) / 0.25) * (it.alpha ?? 1);   // alpha: 반투명 실 (수호 실타래, D-128)
        if (a <= 0.01) return;
        const wind = Math.min(1, it.t / 0.45);   // 처음엔 넓게 돌다가 감겨 조여듦
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const n = it.count || 7;
        for (let i = 0; i < n; i++) {
            const h = (i + 0.5) / n, cy = y - ry * 2 * h;
            const wr = rx * Math.sin(Math.PI * (0.12 + 0.76 * h)) * (1.6 - 0.6 * wind);   // 알 모양 단면
            const ph = time * (3 + i * 0.4) * (i % 2 ? 1 : -1) + i;
            ctx.strokeStyle = `rgba(${c}, ${0.75 * a})`;
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.ellipse(x, cy + Math.sin(ph) * 6 * s, wr, wr * 0.22, Math.sin(ph * 0.5) * 0.35, ph % TAU, ph % TAU + Math.PI * 1.3);
            ctx.stroke();
        }
        ctx.restore();
    },

    // 촛불 빛: 흔들리는 따뜻한 불빛(flame) + ground면 바닥 타원 빛  { r, color, ground }
    candleGlow(ctx, x, y, it, u, s, time) {
        const c = it.color || '255, 200, 110', seed = it.seed ?? 0;
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.35) * Math.min(1, Math.max(0, left) / 0.5);
        if (a <= 0.01) return;
        const fl = 0.82 + 0.1 * Math.sin(time * 13 + seed * 3) + 0.08 * Math.sin(time * 29 + seed * 7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (it.ground) ellipseGlow(ctx, x, y, (it.r || 160) * s * fl, (it.r || 160) * 0.22 * s * fl, `rgba(${c}, ${0.32 * a})`);
        else {
            glow(ctx, x, y, (it.r || 30) * s * fl, `rgba(${c}, ${0.55 * a})`);
            glow(ctx, x, y, (it.r || 30) * 0.3 * s, `rgba(255, 250, 220, ${0.8 * a * fl})`);
        }
        ctx.restore();
    },

    // 하늘에서 내리는 빛비: 화면 위끝(top)에서 바닥(y)까지 w 너비로 빗줄기가 쏟아지고, 위엔 빛구름 띠, 바닥엔 튀는 물방울 고리·빛.
    //   remaining()으로 끝에 옅어짐  { w, count, color, top }
    rainFall(ctx, x, y, it, u, s, time) {
        const W = (it.w || 600) * s, top = it.top ?? 0, H = y - top, c = it.color || '150, 255, 160';
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.5) * Math.min(1, Math.max(0, left) / 0.8);
        if (a <= 0.01 || H <= 0) return;
        const x0 = x - W / 2;
        const edge = px => Math.min(1, (px - x0) / (W * 0.1), (x0 + W - px) / (W * 0.1));   // 양옆 10%는 옅게
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 위 빛구름 띠
        for (let i = 0; i < 7; i++) {
            const cx = x0 + W * (i + 0.5) / 7 + Math.sin(time * 0.6 + i) * 20 * s;
            ellipseGlow(ctx, cx, top + 18 * s, W / 7 * 1.1, 55 * s, `rgba(${c}, ${0.34 * a * Math.max(0, edge(cx))})`);
        }
        // 빗줄기 (조금 비스듬히)
        ctx.lineCap = 'round';
        const n = it.count || 70, slant = 0.12;
        for (let i = 0; i < n; i++) {
            const sp = (1.1 + hash(i, 61) * 0.6);   // 1초에 화면 높이의 몇 배
            const f = (time * sp + hash(i, 62)) % 1;
            const px = x0 + W * hash(i, 63) + f * H * slant, py = top + H * f;
            const e = edge(px);
            if (e <= 0) continue;
            const len = (26 + 24 * hash(i, 64)) * s;
            const g = ctx.createLinearGradient(px, py - len, px, py);
            g.addColorStop(0, `rgba(${c}, 0)`);
            g.addColorStop(0.6, `rgba(${c}, ${0.45 * a * e})`);
            g.addColorStop(1, `rgba(215, 255, 220, ${0.85 * a * e})`);
            ctx.strokeStyle = g;
            ctx.lineWidth = (1.4 + hash(i, 65)) * s;
            ctx.beginPath(); ctx.moveTo(px - len * slant, py - len); ctx.lineTo(px, py); ctx.stroke();
            if (f > 0.9) {   // 바닥에 닿아 튀는 고리
                const k = (f - 0.9) / 0.1;
                ctx.strokeStyle = `rgba(${c}, ${0.6 * a * e * (1 - k)})`;
                ctx.lineWidth = 1.3 * s;
                ctx.beginPath(); ctx.ellipse(x0 + W * hash(i, 63) + H * slant, y - 2 * s, (3 + 12 * k) * s, (1 + 3 * k) * s, 0, 0, TAU); ctx.stroke();
            }
        }
        // 바닥 빛
        ellipseGlow(ctx, x, y, W * 0.5, 26 * s, `rgba(${c}, ${0.22 * a})`);
        ctx.restore();
    },

    // ---- D-128 (2026-11-14 밤, 봉합 성녀 2차) ----
    // 꽃잎 회오리: 꽃잎들이 몸 둘레를 타원으로 돌며 위아래로 퍼짐 (앞쪽 반 바퀴는 진하고 크게, 뒤쪽은 옅게) + 바닥 소용돌이 빛  { rx, h, count, color }
    petalVortex(ctx, x, y, it, u, s, time) {
        const rx = (it.rx || 120) * s, H = (it.h || 170) * s, c = it.color || '255, 70, 100';
        const left = it.remaining ? it.remaining() : it.dur - it.t;
        const a = Math.min(1, it.t / 0.3) * Math.min(1, Math.max(0, left) / 0.4);
        if (a <= 0.01) return;
        const grow = Math.min(1, it.t / 0.4);
        ctx.save();
        ellipseGlow(ctx, x, y, rx * 1.1, rx * 0.22, `rgba(${c}, ${0.18 * a})`);
        const n = it.count || 46;
        for (let i = 0; i < n; i++) {
            const h = hash(i, 71), sp = 3.2 + hash(i, 72) * 2.4;
            const ang = time * sp + hash(i, 73) * TAU;
            const r = rx * (0.45 + 0.55 * hash(i, 74)) * (0.5 + 0.5 * grow) * (0.75 + 0.25 * h);
            const py = y - H * h - Math.sin(time * 2 + i) * 8 * s, px = x + Math.cos(ang) * r;
            const front = Math.sin(ang) > 0, k = front ? 1 : 0.55;
            ctx.save();
            ctx.translate(px, py + Math.sin(ang) * r * 0.18);
            ctx.rotate(ang * 1.7 + i);
            ctx.fillStyle = `rgba(${front ? c : '170, 30, 60'}, ${0.9 * a * k})`;
            ctx.beginPath(); ctx.ellipse(0, 0, 6 * s * k, 3.4 * s * k, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgba(255, 190, 205, ${0.6 * a * k})`;
            ctx.beginPath(); ctx.ellipse(-1.5 * s, -0.8 * s, 2.6 * s * k, 1.3 * s * k, 0, 0, TAU); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
};
