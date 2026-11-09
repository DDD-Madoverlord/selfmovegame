// 원본 그림의 연기·불꽃 조각을 프레임 바깥으로 날려 보낸다. 추가 그림·매 프레임 픽셀 처리는 없다.
const CACHE_LIMIT = 12, PATCH = 72, PIECES = 4;
const cache = new Map();
const masks = new Map();
const ids = new WeakMap();
let serial = 0;
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

function mask(width, height, kind, phase) {
    width = Math.min(96, width); height = Math.min(96, height);
    const key = `${width}|${height}|${kind}|${phase}`;
    if (masks.has(key)) return masks.get(key);
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d'), data = g.createImageData(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const nx = (x + 0.5) / width * 2 - 1, ny = (y + 0.5) / height * 2 - 1;
        const angle = Math.atan2(ny, nx), radius = Math.hypot(nx, ny);
        const lobes = 0.065 * Math.sin(angle * 5 + phase) + 0.045 * Math.sin(angle * 9 - phase * 0.7);
        let alpha;
        if (kind === 'breath') {
            // 입구는 이어 두고, 퍼지는 끝과 위아래를 서로 다른 곡선으로 해체한다.
            const end = 0.86 + 0.055 * Math.sin(ny * 9 + phase);
            const top = 0.91 + 0.06 * Math.sin(nx * 10 - phase);
            alpha = smooth((end - nx) / 0.36) * smooth((top - Math.abs(ny)) / 0.35);
        } else {
            const edge = (kind === 'rune' ? 1.08 : 1.0) + lobes;
            alpha = smooth((edge - radius) / (kind === 'rune' ? 0.25 : 0.34));
        }
        const i = (y * width + x) * 4;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
        data.data[i + 3] = Math.round(alpha * 255);
    }
    g.putImageData(data, 0, 0);
    masks.set(key, c);
    if (masks.size > 48) masks.delete(masks.keys().next().value);
    return c;
}

function prepared(img, frames, kind) {
    if (!ids.has(img)) ids.set(img, ++serial);
    const key = `${ids.get(img)}|${frames}|${kind}`;
    if (cache.has(key)) {
        const entry = cache.get(key); cache.delete(key); cache.set(key, entry); return entry;
    }
    const fw = img.naturalWidth / frames, fh = img.naturalHeight;
    const core = document.createElement('canvas'); core.width = img.naturalWidth; core.height = fh;
    core.naturalWidth = core.width; core.naturalHeight = core.height;
    const cg = core.getContext('2d');
    const atlas = document.createElement('canvas'); atlas.width = frames * PIECES * PATCH; atlas.height = PATCH;
    const ag = atlas.getContext('2d');
    const patchMask = mask(PATCH, PATCH, 'cloud', 1.7);
    // 하얀 중심을 복제하지 않고 각 프레임의 외곽에 있는 연기·불꽃 질감을 가져온다.
    const samples = kind === 'breath' ? [[0.72, 0.28], [0.82, 0.7], [0.85, 0.3], [0.7, 0.72]] :
        [[0.2, 0.5], [0.8, 0.5], [0.32, 0.25], [0.68, 0.25]];
    for (let f = 0; f < frames; f++) {
        cg.save(); cg.beginPath(); cg.rect(f * fw, 0, fw, fh); cg.clip();
        cg.drawImage(img, f * fw, 0, fw, fh, f * fw, 0, fw, fh);
        cg.globalCompositeOperation = 'destination-in';
        cg.drawImage(mask(fw, fh, kind, f * 0.31), f * fw, 0, fw, fh);
        cg.restore();
        for (let i = 0; i < PIECES; i++) {
            const [sx, sy] = samples[i], x = (f * PIECES + i) * PATCH;
            ag.save(); ag.beginPath(); ag.rect(x, 0, PATCH, PATCH); ag.clip();
            ag.drawImage(img, f * fw + (sx - 0.18) * fw, (sy - 0.18) * fh, fw * 0.36, fh * 0.36, x, 0, PATCH, PATCH);
            ag.globalCompositeOperation = 'destination-in'; ag.drawImage(patchMask, x, 0); ag.restore();
        }
    }
    // 강한 흰 섬광은 중심에 남긴다. 흩어지는 조각이 작은 폭발처럼 복제되지 않게 한다.
    const pixels = ag.getImageData(0, 0, atlas.width, atlas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
        const white = smooth((Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) - 205) / 50);
        pixels.data[i + 3] *= 1 - white * smooth((pixels.data[i + 3] - 100) / 155) * 0.9;
    }
    ag.putImageData(pixels, 0, 0);
    const entry = { core, atlas };
    cache.set(key, entry);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return entry;
}

export function dispersedSheet(img, frames, kind) {
    return prepared(img, frames, kind).core;
}

export function drawDispersion(ctx, img, frames, frame, it, w, h, ax, ay, alpha, u) {
    const kind = it.dispersion, { atlas } = prepared(img, frames, kind);
    const cx = (0.5 - ax) * w, cy = (0.5 - ay) * h;
    const clock = it.t + (it.phase || 0), looping = !!it.loopSec;
    const count = kind === 'rune' ? 3 : PIECES;
    for (let i = 0; i < count; i++) {
        const seed = i * 2.399 + (it.phase || 0);
        const age = looping ? (clock / (it.loopSec * 1.27) + i * 0.237) % 1 : clamp((u - i * 0.035) / 0.9);
        const envelope = Math.sin(age * Math.PI);
        if (envelope <= 0) continue;
        const side = i % 2 ? 1 : -1;
        let px, py;
        if (kind === 'breath') {
            px = (0.69 - ax + age * 0.48) * w;
            py = cy + side * h * (0.1 + age * 0.34) + Math.sin(seed + age * 4) * h * 0.06;
        } else if (kind === 'burst') {
            const spread = Math.sqrt(age);
            px = cx + side * w * (0.22 + spread * 0.39);
            py = cy + (i < 2 ? h * 0.18 : -h * (0.12 + spread * 0.48));
        } else {
            px = cx + side * w * (i < 2 ? 0.35 + age * 0.27 : 0.1 + age * 0.24);
            py = cy - h * (i < 2 ? age * 0.25 : 0.2 + age * 0.5);
        }
        const size = Math.min(90, Math.min(w, h) * 0.45) * (0.45 + age * 0.95);
        ctx.save();
        ctx.globalAlpha = alpha * envelope * (kind === 'rune' ? 0.18 : 0.4);
        ctx.translate(px, py);
        ctx.rotate(Math.sin(seed) * 0.4 + side * age * 0.22);
        ctx.drawImage(atlas, (frame * PIECES + i) * PATCH, 0, PATCH, PATCH,
            -size * 0.5, -size * 0.5, size * 1.1, size);
        ctx.restore();
    }
}
