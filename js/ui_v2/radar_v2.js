/* ==========================================================================
   PROJECT: MAD OVERLORD // 전술 레이더 (메인 화면, v2)
   홀로그램 전장 지도: 지형 등고선 + 원형 레이더(고리, 십자선, 회전 탐지선) + 진격 경로 + 목표 표시.
   탐지선이 지나간 적 신호가 밝게 빛났다가 서서히 흐려진다.
   mode 'story': 챕터 스테이지 점과 경로 (setStages) — 누르면 onSelect(id) / 'special': 잠김(어둡게, HTML 안내가 덮음)
   메인 화면이 보일 때만 그린다 (start / stop).
   ========================================================================== */

const AMBER = '255, 176, 32';
const RED = '255, 80, 70';
const ORANGE = '255, 130, 40';
// 레이더 중심 기준 좌표 (-1~1, 반지름 배율). 아래쪽이 +y
const PLAYER = [-0.66, 0.5];
const TARGETS = [
    { at: [0.02, -0.06], label: 'INTERMEDIATE FORT', sub: '450m', color: ORANGE },
    { at: [0.66, -0.52], label: 'FINAL HQ', sub: '900m', color: RED }
];
const ENEMIES = [[0.3, -0.28], [0.44, -0.02], [-0.16, -0.38], [0.22, 0.22], [0.56, -0.8], [0.8, -0.2], [-0.3, 0.05], [0.1, -0.62]];

export class TacticalRadar {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.mode = 'story';
        this.running = false;
        this.t = 0;
        this.terrain = null;
        this.nodes = null;       // [{ id, at, state: 'cleared'|'open'|'locked', stars, boss, name }]
        this.selected = null;
        this.onSelect = null;
        this.scale = 1;          // 점·글자 배율 — 휴대폰 배치의 전체 화면 레이더는 2.2 (menu_v2.js, Q-015)
        if (canvas) canvas.addEventListener('click', e => this._click(e));
    }

    /** 스테이지 점 설정 */
    setStages(nodes, selectedId, onSelect) {
        this.nodes = nodes;
        this.selected = selectedId;
        this.onSelect = onSelect;
    }

    _click(e) {
        if (!this.nodes || this.mode !== 'story' || !this.onSelect) return;
        const c = this.canvas;
        const x = e.offsetX * (c.width / c.clientWidth), y = e.offsetY * (c.height / c.clientHeight);
        const { cx, cy, R, s } = this.geo || {};
        if (!R) return;
        let best = null, bestD = 22 * s;
        for (const n of this.nodes) {
            const d = Math.hypot(cx + n.at[0] * R - x, cy + n.at[1] * R - y);
            if (d < bestD) { best = n; bestD = d; }
        }
        if (best) this.onSelect(best.id);
    }

    setMode(mode) {
        this.mode = mode;
    }

    start() {
        if (!this.ctx || this.running) return;
        this.running = true;
        this.last = performance.now();
        const loop = now => {
            if (!this.running) return;
            this.t += Math.max(0, Math.min(0.05, (now - this.last) / 1000));   // 음수면 맥박 반지름이 음수 → arc 오류 (Android WebView 첫 프레임)
            this.last = now;
            this.draw();
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        if (this.raf) cancelAnimationFrame(this.raf);
    }

    _resize() {
        const c = this.canvas;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
        if (w && (c.width !== w || c.height !== h)) {
            c.width = w;
            c.height = h;
            this.terrain = null;
        }
        return dpr;
    }

    // 지형: 사인파를 겹친 높이 값으로 등고선 띠와 지형 음영을 한 번만 그려 둠
    _buildTerrain(w, h) {
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const g = off.getContext('2d');
        const img = g.createImageData(w, h);
        const hgt = (x, y) => {
            const u = x / w * 6, v = y / h * 4;
            return Math.sin(u * 1.3 + Math.cos(v * 0.9)) * 0.5 + Math.sin(v * 1.7 - u * 0.6) * 0.35
                + Math.sin(u * 3.1 + v * 2.3) * 0.15 + Math.cos(u * 0.4 - v * 1.1) * 0.4;
        };
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v = hgt(x, y);
                const band = Math.abs(((v * 5) % 1 + 1) % 1 - 0.5) < 0.04;   // 등고선
                const land = v > 0.05;
                const i = (y * w + x) * 4;
                const base = land ? 26 + v * 18 : 12;
                img.data[i] = base * 0.9 + (band ? 40 : 0);
                img.data[i + 1] = base * 0.95 + (band ? 30 : 0);
                img.data[i + 2] = base + (band ? 10 : 0);
                img.data[i + 3] = land ? 255 : 200;
            }
        }
        g.putImageData(img, 0, 0);
        // 격자
        g.strokeStyle = `rgba(${AMBER}, 0.07)`;
        g.lineWidth = 1;
        for (let x = 0; x < w; x += w / 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (let y = 0; y < h; y += h / 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        return off;
    }

    draw() {
        const dpr = this._resize();
        const { ctx, canvas } = this;
        const w = canvas.width, h = canvas.height;
        if (!w || !h) return;
        if (!this.terrain) this.terrain = this._buildTerrain(w, h);
        const locked = this.mode !== 'story';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.terrain, 0, 0);
        if (locked) {
            ctx.fillStyle = 'rgba(5, 6, 9, 0.55)';
            ctx.fillRect(0, 0, w, h);
        }

        const cx = w * 0.5, cy = h * 0.52, R = Math.min(w * 0.46, h * 0.47);
        const P = ([x, y]) => [cx + x * R, cy + y * R];
        const s = dpr * this.scale;
        this.geo = { cx, cy, R, s };
        const sweep = this.t * 1.1;

        // 레이더 고리 / 십자선 / 눈금
        ctx.lineWidth = 1.2 * s;
        for (const [rr, a] of [[1, 0.55], [0.66, 0.3], [0.33, 0.3]]) {
            ctx.strokeStyle = `rgba(${AMBER}, ${a})`;
            ctx.beginPath();
            ctx.arc(cx, cy, R * rr, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${AMBER}, 0.22)`;
        ctx.beginPath();
        ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
        ctx.stroke();
        for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2, len = i % 6 === 0 ? 8 : 4;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
            ctx.lineTo(cx + Math.cos(a) * (R - len * s), cy + Math.sin(a) * (R - len * s));
            ctx.stroke();
        }

        if (!locked) {
            // 회전 탐지선 (부채꼴 잔광)
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();
            const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.9, cx, cy) : null;
            if (grad) {
                grad.addColorStop(0, `rgba(${AMBER}, 0)`);
                grad.addColorStop(0.14, `rgba(${AMBER}, 0.28)`);
                grad.addColorStop(0.1433, `rgba(${AMBER}, 0)`);
                grad.addColorStop(1, `rgba(${AMBER}, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
            }
            ctx.strokeStyle = `rgba(${AMBER}, 0.9)`;
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
            ctx.stroke();
            ctx.restore();

            if (this.nodes) {
                this._drawNodes(ctx, P, s);
            } else {
            // 진격 경로 (점선이 흐름)
            const pts = [PLAYER, ...TARGETS.map(t => t.at)].map(P);
            ctx.setLineDash([8 * s, 7 * s]);
            ctx.lineDashOffset = -this.t * 30 * s;
            ctx.strokeStyle = `rgba(${AMBER}, 0.8)`;
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
            ctx.setLineDash([]);

            // 적 신호: 탐지선이 지나간 직후 가장 밝음
            for (const e of ENEMIES) {
                const [x, y] = P(e);
                const ang = Math.atan2(e[1], e[0]);
                const behind = ((sweep - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const a = Math.max(0.18, 1 - behind / 2.6);
                ctx.fillStyle = `rgba(${RED}, ${a})`;
                ctx.shadowColor = `rgba(${RED}, ${a})`;
                ctx.shadowBlur = 10 * s * a;
                ctx.beginPath();
                ctx.moveTo(x, y - 6 * s);
                ctx.lineTo(x + 5 * s, y + 4 * s);
                ctx.lineTo(x - 5 * s, y + 4 * s);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // 목표 (맥동하는 고리 + 이름표)
            ctx.font = `800 ${10 * s}px Orbitron, "Chakra Petch", sans-serif`;
            TARGETS.forEach((tg, i) => {
                const [x, y] = P(tg.at);
                const pulse = (this.t * 0.8 + i * 0.5) % 1;
                ctx.strokeStyle = `rgba(${tg.color}, ${1 - pulse})`;
                ctx.lineWidth = 2 * s;
                ctx.beginPath();
                ctx.arc(x, y, (8 + pulse * 16) * s, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(${tg.color}, 0.95)`;
                ctx.beginPath();
                ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
                ctx.fill();
                const label = `${tg.label} · ${tg.sub}`;
                const tw = ctx.measureText(label).width + 12 * s;
                const lx = Math.min(w - tw - 4 * s, x + 14 * s), ly = y - 22 * s;
                ctx.fillStyle = 'rgba(8, 9, 13, 0.85)';
                ctx.fillRect(lx, ly, tw, 16 * s);
                ctx.strokeStyle = `rgba(${tg.color}, 0.8)`;
                ctx.lineWidth = 1 * s;
                ctx.strokeRect(lx, ly, tw, 16 * s);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, lx + 6 * s, ly + 11.5 * s);
            });

            // 아군 (출격 위치): 노란 삼각형
            const [px, py] = P(PLAYER);
            ctx.fillStyle = '#ffd24a';
            ctx.shadowColor = 'rgba(255, 210, 74, 0.9)';
            ctx.shadowBlur = 12 * s;
            ctx.beginPath();
            ctx.moveTo(px, py - 11 * s);
            ctx.lineTo(px + 9 * s, py + 7 * s);
            ctx.lineTo(px - 9 * s, py + 7 * s);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffd24a';
            ctx.fillText('OVERLORD', px - 26 * s, py + 22 * s);
            }
        }

        // 좌상단 정보 문구 (홀로그램 느낌)
        ctx.font = `600 ${9 * s}px Orbitron, sans-serif`;
        ctx.fillStyle = `rgba(${AMBER}, 0.55)`;
        ['SECTOR MAP - 07', 'SCALE 1:2500', `SCAN ${String(Math.floor(this.t * 7) % 1000).padStart(3, '0')}`].forEach((line, i) => {
            ctx.fillText(line, 10 * s, (16 + i * 12) * s);
        });
    }

    // 스테이지 점: 클리어(금색 + 별), 열림(주황 맥동), 잠김(회색 자물쇠), 보스(큰 붉은 점), 선택(흰 고리 + 이름표)
    _drawNodes(ctx, P, s) {
        const pts = this.nodes.map(n => P(n.at));
        ctx.lineWidth = 2 * s;
        for (let i = 1; i < pts.length; i++) {
            const done = this.nodes[i - 1].state === 'cleared';
            ctx.setLineDash(done ? [] : [7 * s, 6 * s]);
            ctx.lineDashOffset = -this.t * 25 * s;
            ctx.strokeStyle = done ? `rgba(${AMBER}, 0.85)` : this.nodes[i].state === 'locked' ? 'rgba(140, 150, 170, 0.35)' : `rgba(${AMBER}, 0.6)`;
            ctx.beginPath();
            ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
            ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.font = `800 ${10 * s}px Orbitron, "Chakra Petch", sans-serif`;
        this.nodes.forEach((n, i) => {
            const [x, y] = pts[i];
            const r = (n.boss ? 9 : 6.5) * s;
            const sel = n.id === this.selected;
            const col = n.state === 'locked' ? '120, 128, 145' : n.boss ? RED : n.state === 'cleared' ? '255, 205, 90' : ORANGE;
            if (n.state === 'open') {
                const pulse = (this.t * 0.9 + i * 0.3) % 1;
                ctx.strokeStyle = `rgba(${col}, ${1 - pulse})`;
                ctx.lineWidth = 2 * s;
                ctx.beginPath();
                ctx.arc(x, y, r + pulse * 14 * s, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = `rgba(${col}, 0.95)`;
            ctx.shadowColor = `rgba(${col}, 0.9)`;
            ctx.shadowBlur = n.state === 'locked' ? 0 : 10 * s;
            ctx.beginPath();
            if (n.boss) {   // 보스: 마름모
                ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
            } else {
                ctx.arc(x, y, r, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            if (n.state === 'locked') {   // 자물쇠 표시
                ctx.strokeStyle = 'rgba(20, 22, 30, 0.9)';
                ctx.lineWidth = 1.6 * s;
                ctx.strokeRect(x - 2.5 * s, y - 1 * s, 5 * s, 4 * s);
            }
            if (sel) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 * s;
                ctx.beginPath();
                ctx.arc(x, y, r + 5 * s, 0, Math.PI * 2);
                ctx.stroke();
            }
            // 스테이지 번호 + 별
            ctx.fillStyle = n.state === 'locked' ? 'rgba(160, 168, 185, 0.7)' : '#fff';
            ctx.fillText(n.id, x - ctx.measureText(n.id).width / 2, y + r + 13 * s);
            if (n.state !== 'locked') {
                for (let k = 0; k < 3; k++) {
                    ctx.fillStyle = k < n.stars ? '#ffd24a' : 'rgba(255, 255, 255, 0.18)';
                    ctx.beginPath();
                    ctx.arc(x - 7 * s + k * 7 * s, y + r + 20 * s, 2.2 * s, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            if (sel) {   // 선택 이름표
                const label = n.name;
                const tw = ctx.measureText(label).width + 12 * s;
                const lx = Math.min(this.canvas.width - tw - 4 * s, x + 14 * s), ly = y - 26 * s;
                ctx.fillStyle = 'rgba(8, 9, 13, 0.88)';
                ctx.fillRect(lx, ly, tw, 16 * s);
                ctx.strokeStyle = `rgba(${col}, 0.9)`;
                ctx.lineWidth = 1 * s;
                ctx.strokeRect(lx, ly, tw, 16 * s);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, lx + 6 * s, ly + 11.5 * s);
            }
        });
    }
}
