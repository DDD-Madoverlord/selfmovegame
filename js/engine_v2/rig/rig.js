/* ==========================================================================
   PROJECT: MAD OVERLORD // SKELETAL RIG ENGINE (v2)
   캔버스 2D 컷아웃 리그. 게임(rigAvatar.js → monster_v2.js)과 rig_test.html이 함께 사용한다.
   - 뼈대 계층: 자식 뼈는 부모의 이동/회전을 자동으로 물려받는다
   - 키프레임 클립: 뼈별 x/y/rot/sx/sy 트랙 + 이징, 루프 구간(loopFrom), 시간 이벤트
   - 상태 전환 크로스페이드: 이전 클립과 새 클립 자세를 섞어 끊김 없이 전환
   - 스프링(2차 모션): 부모의 가속도를 받아 한 박자 늦게 흔들리는 보조 움직임
   - 더하기 동작(samplePose를 offsets로): 맞음·밀림·기절 반응을 지금 동작 위에 얹음 (reactions.js, Q-008 Q4)
   좌표계: 모델 공간 = 원본 이미지 픽셀 좌표(뼈 피벗 기준). 화면 변환은 그릴 때 곱한다.
   ========================================================================== */

// ---- 2D 아핀 행렬 [a, b, c, d, e, f] (canvas setTransform 규약) ----
export const Mat = {
    identity: () => [1, 0, 0, 1, 0, 0],
    mul(m, n) {
        return [
            m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
        ];
    },
    // translate(x, y) · rotate(rot) · scale(sx, sy)
    trs(x, y, rot, sx = 1, sy = 1) {
        const c = Math.cos(rot), s = Math.sin(rot);
        return [c * sx, s * sx, -s * sy, c * sy, x, y];
    },
    apply(m, x, y) {
        return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
    angle(m) {
        return Math.atan2(m[1], m[0]);
    }
};

// ---- 이징 ----
export const EASE = {
    linear: u => u,
    in: u => u * u,                       // 점점 빨라짐 (쿵 떨어지는 발)
    out: u => 1 - (1 - u) * (1 - u),      // 점점 느려짐 (들어 올린 뒤 멈칫)
    inOut: u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
    step: () => 0
};

const DEFAULT_CH = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
const def0 = v => v || [0, 0];
const DEG = Math.PI / 180;

// 트랙 키: [시간, 값, 다음 키까지의 이징(기본 inOut)]
function sampleTrack(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 0; i < keys.length - 1; i++) {
        const [t0, v0, ease = 'inOut'] = keys[i];
        const [t1, v1] = keys[i + 1];
        if (t < t1) {
            const u = (t - t0) / (t1 - t0);
            return v0 + (v1 - v0) * EASE[ease](u);
        }
    }
    return last[1];
}

export function samplePose(clip, t) {
    const pose = {};
    for (const bone in clip.tracks) {
        const tracks = clip.tracks[bone];
        const p = {};
        for (const ch in tracks) p[ch] = sampleTrack(tracks[ch], t);
        pose[bone] = p;
    }
    return pose;
}

function blendPose(a, b, w) {
    const out = {};
    const bones = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const bone of bones) {
        const pa = a[bone] || {}, pb = b[bone] || {};
        const p = {};
        for (const ch of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
            const va = pa[ch] ?? DEFAULT_CH[ch];
            const vb = pb[ch] ?? DEFAULT_CH[ch];
            p[ch] = va + (vb - va) * w;
        }
        out[bone] = p;
    }
    return out;
}

// ==========================================================================
// Animator: 클립 재생, 루프 구간, 이벤트 발생, 크로스페이드
// ==========================================================================
export class Animator {
    constructor(clips, onEvent) {
        this.clips = clips;
        this.onEvent = onEvent;
        this.cur = null;
        this.prev = null;
        this.fade = 0;
        this.fadeDur = 0;
    }

    /** startTime: 그 동작의 어느 시점부터 (걷기를 끊김 없이 이어 갈 때 — rigAvatar 다리 층) */
    play(name, fadeDur = 0.15, startTime = 0) {
        if (this.cur && this.cur.name === name) return;
        const clip = this.clips[name];
        if (!clip) throw new Error(`[rig] unknown clip: ${name}`);
        this.prev = this.cur && fadeDur > 0 ? this.cur : null;
        const time = Math.max(0, Math.min(startTime || 0, clip.duration));
        this.cur = { name, clip, time };
        this.fade = 0;
        this.fadeDur = fadeDur;
        if (!time) this._fire(this.cur, -1e-9, 0);
    }

    get currentName() {
        return this.cur ? this.cur.name : null;
    }

    get currentTime() {
        return this.cur ? this.cur.time : 0;
    }

    update(dt) {
        if (!this.cur) return;
        this._advance(this.cur, dt, true);
        if (this.prev) {
            this._advance(this.prev, dt, false); // 사라지는 클립의 이벤트는 발생시키지 않음
            this.fade += dt;
            if (this.fade >= this.fadeDur) this.prev = null;
        }
    }

    _advance(state, dt, fire) {
        const clip = state.clip;
        const t0 = state.time;
        let t1 = t0 + dt;
        if (t1 >= clip.duration) {
            if (fire) this._fire(state, t0, clip.duration);
            if (clip.loop) {
                const from = clip.loopFrom ?? 0;
                t1 = from + ((t1 - clip.duration) % (clip.duration - from));
                if (fire) this._fire(state, from - 1e-9, t1);
            } else {
                t1 = clip.duration;
            }
        } else if (fire) {
            this._fire(state, t0, t1);
        }
        state.time = t1;
    }

    _fire(state, t0, t1) {
        for (const [te, name, data] of state.clip.events || []) {
            if (te > t0 && te <= t1) this.onEvent?.(name, data || {}, state.name);
        }
    }

    sample() {
        if (!this.cur) return {};
        const pose = samplePose(this.cur.clip, this.cur.time);
        if (!this.prev) return pose;
        const w = EASE.inOut(Math.min(1, this.fade / this.fadeDur));
        return blendPose(samplePose(this.prev.clip, this.prev.time), pose, w);
    }
}

// ==========================================================================
// Spring: 부모 쪽 피벗 가속도에 반응하는 감쇠 스프링 (애니메이션 값 위에 더해짐)
// ==========================================================================
export class Spring {
    constructor({ bone, channel, axis, gain, k = 120, damping = 9, limit = Infinity }) {
        Object.assign(this, { bone, channel, axis, gain, k, damping, limit });
        this.reset();
    }

    reset() {
        this.value = 0;
        this.velocity = 0;
        this.prevPos = null;
        this.prevVel = [0, 0];
    }

    step(pos, dt) {
        if (!this.prevPos) {
            this.prevPos = pos;
            return;
        }
        const vel = [(pos[0] - this.prevPos[0]) / dt, (pos[1] - this.prevPos[1]) / dt];
        const acc = (vel[this.axis] - this.prevVel[this.axis]) / dt;
        this.prevPos = pos;
        this.prevVel = vel;
        const drive = -acc * this.gain;
        this.velocity += (-this.k * this.value - this.damping * this.velocity + drive) * dt;
        this.value = Math.max(-this.limit, Math.min(this.limit, this.value + this.velocity * dt));
    }
}

// ==========================================================================
// Skeleton: 뼈 계층, 파츠 이미지, 소켓(총구/발 위치 등)
// ==========================================================================
export class Skeleton {
    /**
     * @param {Array} boneDefs  [{ name, parent, part, z }]
     * @param {Object} layout   rig.json (parts, pivots, sockets)
     * @param {Object} images   partKey -> HTMLImageElement
     */
    constructor(boneDefs, layout, images) {
        this.layout = layout;
        this.images = images;
        this.bones = boneDefs.map(def => ({
            ...def,
            pivot: layout.pivots[def.name],
            world: Mat.identity()
        }));
        this.byName = Object.fromEntries(this.bones.map(b => [b.name, b]));
        for (const b of this.bones) {
            const parent = b.parent ? this.byName[b.parent] : null;
            b.parentBone = parent;
            // offset: 원본 이미지의 부착 위치를 옮길 때 (예: 넓게 벌린 다리를 골반 가운데로 모으기)
            const [ox, oy] = def0(b.offset);
            b.rest = parent ? [b.pivot[0] - parent.pivot[0] + ox, b.pivot[1] - parent.pivot[1] + oy] : [0, 0];
        }
        this.drawOrder = this.bones.filter(b => b.part).sort((a, b) => a.z - b.z);
        this.socketAlias = null;
        // 자동 접지: [[소켓, 뼈], ...] 중 가장 낮은 발이 지면(모델 y=0)에 닿도록 전체를 올리거나 내림
        // (다리가 몸통에 매달린 캐릭터에서 걸음마다 몸이 오르내리는 높이를 다리 각도로부터 자동 계산)
        this.autoGround = null;
    }

    setPart(boneName, partKey) {
        const bone = this.byName[boneName];
        if (bone) bone.part = partKey;
    }

    /** 자세(pose)와 스프링 오프셋을 받아 모델 공간 월드 행렬 계산 (bones는 부모가 먼저 오도록 정의) */
    update(pose, offsets = {}) {
        for (const b of this.bones) {
            const p = pose[b.name] || {};
            const o = offsets[b.name] || {};
            let rot = (p.rot || 0) + (o.rot || 0);
            // 그림별 회전 한도 (rig.json limits, 그림 키 기준 — 세트 그림에만 걸 수 있음). 예: 악어 턱 머리 아래턱(jaw_d)은
            // 원래 자리보다 위로 안 다묾 — 입이 벌어진 채 그려진 그림이라 더 다물면 턱 밑으로 입안 그림이 드러남 (D-113)
            const lim = this.layout.limits && this.layout.limits[(this.partAlias && this.partAlias[b.part]) || b.part];
            if (lim) rot = Math.min(lim.max ?? Infinity, Math.max(lim.min ?? -Infinity, rot));
            b.rot = rot;   // 그림 바꿔 끼우기(poseSwaps)가 읽음
            const local = Mat.trs(
                b.rest[0] + (p.x || 0) + (o.x || 0),
                b.rest[1] + (p.y || 0) + (o.y || 0),
                rot * DEG,
                (p.sx ?? 1) + (o.sx || 0),   // 더하기 동작의 크기 변화 (착지 눌림 — reactions.js)
                (p.sy ?? 1) + (o.sy || 0)
            );
            b.world = b.parentBone ? Mat.mul(b.parentBone.world, local) : local;
        }
        if (this.autoGround) {
            // 모델 공간에서 루트 피벗(발밑 중앙) = 지면 y 0
            let lowest = -Infinity;
            for (const [socket, bone] of this.autoGround) lowest = Math.max(lowest, this.socketWorld(socket, bone)[1]);
            for (const b of this.bones) b.world[5] -= lowest;
        }
    }

    /** 스프링 입력용: 스프링/애니 오프셋을 빼고 부모 기준 기본 위치만 반영한 피벗 위치 */
    restPivotWorld(boneName) {
        const b = this.byName[boneName];
        return b.parentBone ? Mat.apply(b.parentBone.world, b.rest[0], b.rest[1]) : [b.world[4], b.world[5]];
    }

    pivotWorld(boneName) {
        const w = this.byName[boneName].world;
        return [w[4], w[5]];
    }

    socketWorld(socketName, boneName) {
        // socketAlias: 강화 그림으로 바꿔 끼운 부위의 소켓 (예: 더 긴 강화 물대포의 총구, rigAvatar.applyUpgrades)
        // variantSockets: 세트 그림 부위의 소켓 (예: 더 긴 저격포·레일건 포신의 총구 muzzle_cannon_d, rigAvatar._applyVariants — D-118)
        const s = this.layout.sockets[this.socketAlias?.[socketName] ?? this.variantSockets?.[socketName] ?? socketName];
        const b = this.byName[boneName];
        if (!b) return [0, 0];                       // 없는 뼈: 루트 위치 (이펙트만 어긋나고 멈추지 않게)
        if (!s) return [b.world[4], b.world[5]];     // 없는 소켓: 뼈 피벗 위치
        return Mat.apply(b.world, s[0] - b.pivot[0], s[1] - b.pivot[1]);
    }

    /**
     * 자세에 따라 그림 바꿔 끼우기 (rig.json poseSwaps, 그림 키 기준 — 규칙이 있는 세트만).
     * { "head_d": [{ "bone": "jaw", "min": 4, "part": "head_d_half", "hide": ["jaw"] }, ...] } — 뼈 회전이 min 이상인 마지막 규칙.
     * 예: 악어 턱 머리는 아래턱을 벌릴 때 잘라 돌린 턱 대신 입 벌린 머리 그림 한 장으로 (턱과 머리 경계가 갈라져 보여서, D-113)
     * @returns {{ keys: Object<string,string>, hidden: Set<string> } | null}
     */
    _poseSwaps() {
        const rules = this.layout.poseSwaps;
        if (!rules) return null;
        const keys = {};
        const hidden = new Set();
        for (const b of this.drawOrder) {
            const key = (this.partAlias && this.partAlias[b.part]) || b.part;
            let hit = null;
            for (const r of rules[key] || []) if ((this.byName[r.bone]?.rot ?? 0) >= r.min) hit = r;
            if (!hit) continue;
            keys[b.name] = hit.part;
            (hit.hide || []).forEach(n => hidden.add(n));
        }
        return { keys, hidden };
    }

    /** 그리는 순서: 뼈 z, 세트 그림(rig.json parts)에 z가 있으면 그 값 (D-126 — 별을 먹는 자 별빛 오브는 손 앞에) */
    _order() {
        if (!this.partAlias) return this.drawOrder;
        let any = false;
        const zs = this.drawOrder.map(b => {
            const z = this.layout.parts[this.partAlias[b.part] || b.part]?.z;
            if (z != null) any = true;
            return z ?? b.z;
        });
        if (!any) return this.drawOrder;
        return this.drawOrder.map((b, i) => [b, zs[i], i]).sort((p, q) => p[1] - q[1] || p[2] - q[2]).map(p => p[0]);
    }

    draw(ctx, base) {
        const swap = this._poseSwaps();
        for (const b of this._order()) {
            if (swap && swap.hidden.has(b.name)) continue;
            // partAlias: 세트 파츠 그림으로 바꿔 그림 (예: head → head_a, rigAvatar.setVariants). 색 필터는 원래 부위키로 찾음
            const key = (swap && swap.keys[b.name]) || (this.partAlias && this.partAlias[b.part]) || b.part;
            const img = this.images[key];
            const part = this.layout.parts[key];
            if (!img || !part) continue;
            const m = Mat.mul(base, b.world);
            ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
            const f = this.partFilters && this.partFilters[b.part];   // 파츠별 색 (rigAvatar.setPartFilters)
            if (f) ctx.filter = f;
            ctx.drawImage(img, part.x - b.pivot[0], part.y - b.pivot[1]);
            if (f) ctx.filter = 'none';
        }
    }

    drawDebug(ctx, base, sockets = []) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineWidth = 2;
        for (const b of this.bones) {
            const [x, y] = Mat.apply(base, b.world[4], b.world[5]);
            if (b.parentBone) {
                const [px, py] = Mat.apply(base, b.parentBone.world[4], b.parentBone.world[5]);
                ctx.strokeStyle = 'rgba(255, 204, 0, 0.9)';
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
            ctx.fillStyle = b.parentBone ? '#ff0055' : '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px Chakra Petch, sans-serif';
            ctx.fillText(b.name, x + 7, y - 6);
        }
        ctx.strokeStyle = '#00ffcc';
        for (const [socket, bone] of sockets) {
            const [sx, sy] = this.socketWorld(socket, bone);
            const [x, y] = Mat.apply(base, sx, sy);
            ctx.beginPath();
            ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y);
            ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7);
            ctx.stroke();
        }
        ctx.restore();
    }
}
