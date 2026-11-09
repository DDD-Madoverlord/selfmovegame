// 판정 폭을 그대로 쓰는 지면 장판. 사각 이미지 대신 타원·곡선으로 외곽을 그린다.
const PALETTES = {
    swamp: { base: '39, 49, 18', color: '151, 183, 52', core: '205, 222, 101', depth: 25 },
    plasma: { base: '15, 49, 69', color: '66, 202, 255', core: '211, 250, 255', depth: 23 },
    rift: { base: '19, 32, 61', color: '82, 243, 213', core: '203, 255, 244', depth: 27 },
    sonic: { base: '65, 16, 53', color: '255, 65, 164', core: '255, 208, 237', depth: 25 }
};
const TAU = Math.PI * 2;
const smooth = v => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

export const groundField = (style, w, sec) => ({ type: 'groundField', style, w, dur: sec, layer: 'ground' });

function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

function haze(ctx, x, y, rx, ry, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${color}, ${alpha})`);
    g.addColorStop(0.65, `rgba(${color}, ${alpha * 0.65})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ellipse(ctx, 0, 0, 1, 1);
    ctx.fill();
    ctx.restore();
}

export function drawGroundField(ctx, x, y, it, u, scale) {
    const p = PALETTES[it.style];
    if (!p) return;
    const remaining = it.remaining ? it.remaining() : it.dur - it.t;
    const alpha = smooth(it.t / 0.18) * smooth(remaining / Math.min(0.55, it.dur * 0.35));
    if (alpha <= 0) return;
    const t = it.t;
    const rx = it.w * scale / 2, ry = p.depth * scale;
    ctx.save();
    ctx.globalAlpha *= alpha * (it.alpha ?? 1);
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'source-over';
    haze(ctx, 0, 3 * scale, rx + 12 * scale, ry * 1.35, p.base, 0.8);
    // 일렁이는 가장자리: x 양끝은 판정 폭에 고정하고 사각 클립을 쓰지 않는다.
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
        const a = TAU * i / 64;
        const ripple = 1 + 0.07 * Math.sin(a * 7 + t * 1.7) + 0.035 * Math.sin(a * 11 - t);
        const px = Math.cos(a) * rx, py = Math.sin(a) * ry * ripple;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, -ry, 0, ry);
    fill.addColorStop(0, `rgba(${p.base}, 0.15)`);
    fill.addColorStop(0.4, `rgba(${p.base}, 0.8)`);
    fill.addColorStop(0.8, `rgba(${p.base}, 0.9)`);
    fill.addColorStop(1, `rgba(${p.color}, 0.18)`);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = `rgba(${p.color}, 0.45)`;
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    haze(ctx, 0, 0, rx, ry, p.color, 0.16);

    if (it.style === 'swamp') {
        // 작은 거품과 파문만 시차를 두고 반복하고, 바닥 면은 계속 유지한다.
        for (let i = 0; i < 11; i++) {
            const f = (i * 0.61803398875) % 1;
            const bx = (f * 1.8 - 0.9) * rx;
            const by = Math.sin(i * 2.4) * ry * 0.55;
            const phase = (t * 0.52 + i * 0.31) % 1;
            const r = (3 + phase * 11) * scale;
            ctx.strokeStyle = `rgba(${p.color}, ${0.5 * Math.sin(phase * Math.PI)})`;
            ctx.lineWidth = 1.1 * scale;
            ellipse(ctx, bx, by, r, r * 0.3);
            ctx.stroke();
            haze(ctx, bx, by - 2 * scale, 3 * scale, 2 * scale, p.core, 0.3 * (1 - phase));
        }
    } else if (it.style === 'plasma') {
        for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            for (let i = 0; i <= 32; i++) {
                const f = i / 32;
                const px = (f * 2 - 1) * rx * 0.97;
                const py = Math.sin(f * 24 + t * 5 + j * 2) * 4 * scale + (j - 1) * ry * 0.45;
                if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
            }
            ctx.strokeStyle = `rgba(${p.color}, ${0.3 + 0.12 * Math.sin(t * 8 + j)})`;
            ctx.lineWidth = (j === 1 ? 1.8 : 1) * scale;
            ctx.stroke();
        }
        for (let i = 0; i < 9; i++) {
            const f = (i * 0.61803398875) % 1, phase = (t * 0.7 + f) % 1;
            haze(ctx, (f * 1.8 - 0.9) * rx, -phase * 27 * scale, 12 * scale, 7 * scale,
                p.color, Math.sin(phase * Math.PI) * 0.27);
        }
    } else if (it.style === 'rift') {
        for (let i = 0; i < 3; i++) {
            const r = 0.55 + i * 0.19;
            ctx.strokeStyle = `rgba(${p.color}, ${0.45 - i * 0.09})`;
            ctx.lineWidth = (i ? 1 : 2) * scale;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * r, ry * r, 0, t * (i % 2 ? -0.4 : 0.4), t * (i % 2 ? -0.4 : 0.4) + TAU * 0.85);
            ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${p.core}, 0.85)`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.72, 0);
        ctx.lineTo(-rx * 0.15, -5 * scale);
        ctx.lineTo(rx * 0.07, 4 * scale);
        ctx.lineTo(rx * 0.72, 0);
        ctx.stroke();
        haze(ctx, 0, 0, rx * 0.75, 6 * scale, p.color, 0.5);
    } else {
        for (let i = 0; i < 3; i++) {
            const f = Math.max(0, Math.min(1, (u - i * 0.1) / 0.8));
            if (!f) continue;
            const r = 0.15 + 0.85 * (1 - (1 - f) ** 3);
            ctx.strokeStyle = `rgba(${p.color}, ${(1 - f) * 0.85})`;
            ctx.lineWidth = (4 - 3 * f) * scale;
            ellipse(ctx, 0, 0, rx * r, ry * r);
            ctx.stroke();
        }
    }
    ctx.restore();
}
