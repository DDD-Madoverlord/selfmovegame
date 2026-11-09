// 이미지가 주연인 지속 장판·충격파. 빈 마지막 칸을 반복하지 않고 핵심 프레임을 이어 쓴다.
import { groundField } from './groundFields.js';

export const IMAGE_FIELDS = {
    swamp: { sheet: 'swamp_bubble', frameRange: [0, 6], span: 160, h: 150, anchorY: 0.85, loopSec: 1.35, alpha: 0.8 },
    plasma: { sheet: 'plasma_white', frameRange: [2, 6], span: 185, h: 210, anchorY: 0.86, loopSec: 1.2, alpha: 0.65 },
    rift: { sheet: 'summon_portal', frameRange: [1, 5], span: 1000, h: 240, anchorY: 0.76, loopSec: 2.2, alpha: 0.8 },
    fire: { sheet: 'lava_burst', frameRange: [3, 6], span: 150, h: 155, anchorY: 0.85, loopSec: 1.1, alpha: 0.85 },
    goldFire: { sheet: 'lava_burst', frameRange: [3, 6], hue: 25, span: 150, h: 160, anchorY: 0.85, loopSec: 1.1, alpha: 0.85 },
    ghostFire: { sheet: 'lava_burst', frameRange: [3, 6], hue: 145, span: 150, h: 150, anchorY: 0.85, loopSec: 1.3, alpha: 0.72 },
    water: { sheet: 'water_burst', frameRange: [2, 6], span: 180, h: 150, anchorY: 0.8, loopSec: 1.4, alpha: 0.65 },
    steam: { sheet: 'steam_vent', frameRange: [4, 7], span: 180, h: 175, anchorY: 0.85, loopSec: 1.6, alpha: 0.55 },
    web: { sheet: 'web_purple', frameRange: [2, 6], span: 220, h: 125, anchorY: 0.85, loopSec: 2, alpha: 0.8, layer: 'ground' },
    lava: { sheet: 'lava_burst', frameRange: [3, 6], span: 140, h: 145, anchorY: 0.85, loopSec: 1.3, alpha: 0.85 },
    poison: { sheet: 'spore_burst', frameRange: [4, 7], span: 170, h: 175, anchorY: 0.8, loopSec: 1.7, alpha: 0.62 },
    acid: { sheet: 'swamp_bubble', frameRange: [1, 5], hue: 15, span: 140, h: 115, anchorY: 0.85, loopSec: 1.5, alpha: 0.8 },
    herb: { sheet: 'spore_burst', frameRange: [5, 7], hue: 25, span: 140, h: 125, anchorY: 0.8, loopSec: 1.5, alpha: 0.6 },
    moon: { sheet: 'summon_portal', frameRange: [1, 2], hue: 185, span: 230, h: 150, anchorY: 0.76, loopSec: 2.2, alpha: 0.65 },
    seal: { sheet: 'fate_thread', frameRange: [2, 6], hue: -40, span: 1000, h: 115, anchorY: 0.5, loopSec: 2.3, alpha: 0.85, layer: 'ground' }
};

export function imageShockwave(w = 360, hue = 0, sec = 0.65) {
    return { layers: [{ type: 'sprite', sheet: 'subwoofer_blast', width: w, height: Math.min(300, w * 0.72),
        anchorY: 0.88, dur: sec, frameRange: [1, 8], hue, dispersion: 'burst', softEdges: 0.15, fadeIn: 0.035, fadeOut: 0.13 }] };
}

export function breathImage(sheet, w, sec) {
    return { layers: [{ type: 'sprite', sheet, width: w, height: w * 0.55, anchorX: 0.03, anchorY: 0.5,
        dur: sec, frameRange: [1, 4], loopSec: 0.65, pingPong: true, dispersion: 'breath', fadeIn: 0.09, fadeOut: 0.18,
        softEdges: { left: 0, right: 0.16, top: 0.1, bottom: 0.1 } }] };
}

export function imageField(style, w, sec) {
    if (style === 'sonic') return { layers: imageShockwave(Math.max(300, w + 40), 0, sec).layers
        .map(layer => ({ ...layer, fieldStyle: style, fieldWidth: w })) };
    const p = IMAGE_FIELDS[style];
    if (!p) return { layers: [] };
    const count = Math.min(5, Math.max(1, Math.ceil(w / p.span)));
    const tile = w / count;
    const layers = [];
    if (['swamp', 'plasma', 'rift'].includes(style)) layers.push({ ...groundField(style, w, sec), alpha: 0.18 });
    for (let i = 0; i < count; i++) {
        layers.push({ type: 'sprite', sheet: p.sheet, fieldStyle: style, fieldWidth: w, frameRange: p.frameRange, hue: p.hue || 0,
            width: Math.max(100, tile * (count === 1 ? 1.2 : 1.45)),
            height: Math.min(p.h, Math.max(100, w * 1.3)) * (count === 1 ? 1 : 1 + 0.08 * Math.sin(i * 2.4 + 0.6)),
            anchorY: p.anchorY, dx: -w / 2 + tile * (i + 0.5), dur: sec, loopSec: p.loopSec,
            pingPong: true, phase: i * 0.29, alpha: p.alpha, layer: p.layer || 'front',
            dispersion: ['rift', 'moon', 'seal', 'web'].includes(style) ? 'rune' : 'cloud',
            softEdges: 0.14, fadeIn: 0.14, fadeOut: 0.45 });
    }
    return { layers };
}

/** 기존 장판·부품 장판이 같은 그림과 생명주기를 사용한다. follow는 [중심 x, 바닥 b]. */
export function playImageField(fx, style, w, sec, follow, alive, remaining) {
    const def = imageField(style, w, sec);
    if (remaining) for (const layer of def.layers) layer.remaining = remaining;
    const [x, b] = follow();
    fx.play(def, x, b, { follow, alive });
}
