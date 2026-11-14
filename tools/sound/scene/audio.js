/* ==========================================================================
   PROJECT: MAD OVERLORD // 사운드 장면 점검실 — 넣은 소리 파일
   - 게임 사운드 매니저(sound)를 그대로 쓰고, 소리 이름 자리의 파일만 바꿔 끼움 (buffers)
     → 간격(gap)·동시 재생(voices)·음높이 흔들림(pitch)·배경음 낮춤(duck)·묶음 음량·리미터가 게임과 같음
   - 소리마다 후보 파일 여러 개 · 고른 것 하나 · 음량(dB) · 앞 당김/뒤로 밀기(ms) · 끝 자르기(ms)
   - 처음 넣으면 지금 게임 소리(새 소리는 빌려 쓰는 소리)와 크기를 맞춤 (활성 구간 RMS)
   - 넣은 파일은 이 브라우저 IndexedDB에만 저장 (다른 사람·서버로 안 감)
   ========================================================================== */

import { sound, SFX } from '/js/engine_v2/audio/sound_v2.js';
import { NEW_RULES } from './cues.js';

export const dbToGain = db => Math.pow(10, db / 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 새 소리 48개를 게임 표에 (이 페이지에서만) — src = 지금 빌려 쓰는 소리
for (const [n, r] of Object.entries(NEW_RULES)) if (!SFX[n]) SFX[n] = { ...r };

export const audio = {
    mode: 'mine',          // 'mine' 넣은 파일로 · 'game' 지금 게임 소리로
    focus: null,
    solo: false,
    master: 0.9,
    bgmOn: false,
    bgmVol: 0.5,
    custom: new Map(),     // 이름 → { cands: [후보], active: 번호 }
    orig: new Map(),       // 이름 → 게임 원래 버퍼 목록
    onPlay: null,          // (이름, 실제로 났는지) — 화면 표시용
    muteSet: () => null    // 지금 장면이 끄는 게임 소리 (Set)
};

export function activeCand(name) {
    const c = audio.custom.get(name);
    return c && c.cands[c.active] ? c.cands[c.active] : null;
}

/** 게임 sound에 연결 (한 번) */
export function hookSound() {
    const basePlay = sound.play.bind(sound);
    sound.play = (name, opts = {}) => {
        if (audio.muteSet()?.has(name)) return;
        if (audio.solo && name !== audio.focus) return;
        swapIn(name);
        const before = sound.lastAt.get(name);
        basePlay(name, opts);
        const played = sound.lastAt.get(name) !== before;
        audio.onPlay?.(name, played);
    };
    const baseLoop = sound.loop.bind(sound);
    sound.loop = name => {
        if (audio.solo && name !== audio.focus) return;
        swapIn(name);
        baseLoop(name);
        audio.onPlay?.(name, true);
    };
    const baseVol = sound.volOf.bind(sound);
    sound.volOf = name => {
        const c = audio.mode === 'mine' ? activeCand(name) : null;
        return baseVol(name) * (c ? dbToGain(c.gainDb) : 1);
    };
    // 음량: 게임 설정 대신 이 페이지 단추 (게임 설정 저장은 건드리지 않음)
    sound.applyVolumes = () => {
        if (!sound.ctx) return;
        const t = sound.ctx.currentTime;
        sound.master.gain.setTargetAtTime(audio.master, t, 0.03);
        sound.sfxBus.gain.setTargetAtTime(1, t, 0.03);
        sound.bgmBus.gain.setTargetAtTime(audio.bgmOn ? audio.bgmVol : 0, t, 0.03);
    };
    const baseBgm = sound.playBgm.bind(sound);
    sound.playBgm = (name, fade) => { if (audio.bgmOn) baseBgm(name, fade); };
    sound.listenForUnlock();
}

/** 재생 직전: 넣은 파일(고른 후보) ↔ 게임 원래 소리 바꿔 끼움 */
function swapIn(name) {
    const c = audio.mode === 'mine' ? activeCand(name) : null;
    const cur = sound.buffers.get(name);
    if (c && c.trimmed) {
        if (cur && cur[0] !== c.trimmed && !audio.orig.has(name)) audio.orig.set(name, cur);
        sound.buffers.set(name, [c.trimmed]);
    } else if (audio.orig.has(name)) sound.buffers.set(name, audio.orig.get(name));
}

/** 게임 원래 버퍼 (없으면 읽음) — 새 소리는 빌려 쓰는 소리 */
export async function origBuffer(name) {
    if (audio.orig.has(name)) return audio.orig.get(name)[0];
    if (!sound.ctx) return null;
    const cur = sound.buffers.get(name);
    const c = activeCand(name);
    if (cur && !(c && cur[0] === c.trimmed)) return cur[0];
    if (c) sound.buffers.delete(name);
    await sound.load(name);
    const got = sound.buffers.get(name);
    if (got && !(c && got[0] === c.trimmed)) audio.orig.set(name, got);
    return got ? got[0] : null;
}

// ---------------------------------------------------------------------------
// 파일 해석
/** 길이 · 피크 · 활성 구간 크기(RMS) · 앞 무음 */
export function analyze(buf) {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
    const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
    const win = Math.max(1, Math.round(sr * 0.02));
    let peak = 0, lead = -1, last = 0;
    const thr = dbToGain(-45);
    const wins = [];
    for (let i = 0; i < n; i += win) {
        let sum = 0, m = 0;
        const end = Math.min(n, i + win);
        for (let j = i; j < end; j++) {
            let v = 0;
            for (let c = 0; c < ch; c++) v += data[c][j];
            v /= ch;
            const a = Math.abs(v);
            if (a > m) m = a;
            sum += v * v;
        }
        if (m > peak) peak = m;
        if (m > thr) { if (lead < 0) lead = i; last = end; }
        wins.push(sum / (end - i));
    }
    const loud = wins.filter(p => p > dbToGain(-50) ** 2);
    const rms = Math.sqrt((loud.length ? loud : wins).reduce((a, p) => a + p, 0) / Math.max(1, (loud.length ? loud : wins).length));
    return {
        dur: buf.duration, peakDb: peak > 0 ? 20 * Math.log10(peak) : -120, rmsDb: rms > 0 ? 20 * Math.log10(rms) : -120,
        lead: lead < 0 ? 0 : lead / sr, tail: (n - last) / sr, sr, ch
    };
}

/** 그림용 파형 (막대 count개, 0~1) */
export function waveform(buf, count = 120) {
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / count));
    const out = [];
    for (let i = 0; i < count; i++) {
        let m = 0;
        for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j++) m = Math.max(m, Math.abs(d[j]));
        out.push(m);
    }
    return out;
}

/** 앞 당김(-)/밀기(+) · 끝 자르기를 반영한 버퍼 */
export function trimmed(buf, offsetMs = 0, endMs = 0) {
    const sr = buf.sampleRate, ch = buf.numberOfChannels;
    const cut = offsetMs < 0 ? Math.round((-offsetMs / 1000) * sr) : 0;
    const pad = offsetMs > 0 ? Math.round((offsetMs / 1000) * sr) : 0;
    let len = buf.length - cut;
    if (endMs > 0) len = Math.min(len, Math.round((endMs / 1000) * sr));
    len = Math.max(1, len);
    const out = sound.ctx.createBuffer(ch, pad + len, sr);
    const fadeIn = cut ? Math.min(len, Math.round(sr * 0.003)) : 0;
    const fadeOut = endMs > 0 ? Math.min(len, Math.round(sr * 0.02)) : 0;
    for (let c = 0; c < ch; c++) {
        const src = buf.getChannelData(c), dst = out.getChannelData(c);
        for (let i = 0; i < len; i++) {
            let v = src[cut + i] || 0;
            if (i < fadeIn) v *= i / fadeIn;
            if (fadeOut && i > len - fadeOut) v *= (len - i) / fadeOut;
            dst[pad + i] = v;
        }
    }
    return out;
}

/** 파일 → 후보 (해석 · 크기 맞춤). 실패하면 throw */
export async function makeCand(name, file, bytes) {
    if (!sound.ctx) sound.unlock();
    const buffer = await sound.ctx.decodeAudioData(bytes.slice(0));
    const stats = analyze(buffer);
    const ref = await origBuffer(name);
    let gainDb = 0, auto = false;
    if (ref) {
        const r = analyze(ref);
        gainDb = clamp(Math.round((r.rmsDb - stats.rmsDb) * 2) / 2, -24, 18);
        auto = true;
    }
    const cand = { id: `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, name: file.name, type: file.type || '', bytes, buffer, stats,
        gainDb, auto, offsetMs: 0, endMs: 0, wave: waveform(buffer), addedAt: Date.now() };
    cand.trimmed = trimmed(buffer, 0, 0);
    return cand;
}

export function retrim(cand) {
    cand.trimmed = trimmed(cand.buffer, cand.offsetMs, cand.endMs);
}

/** 후보 하나를 게임 규칙 없이 그대로 (미리 듣기) */
let previewSrc = null;
export function previewRaw(buf, gainDb = 0) {
    if (!sound.ctx || !buf) return;
    stopPreview();
    const src = sound.ctx.createBufferSource();
    src.buffer = buf;
    const g = sound.ctx.createGain();
    g.gain.value = dbToGain(gainDb) * 0.8;
    src.connect(g).connect(sound.master);
    src.start();
    previewSrc = src;
}
export function stopPreview() {
    try { previewSrc?.stop(); } catch (e) { /* 이미 끝남 */ }
    previewSrc = null;
}

// ---------------------------------------------------------------------------
// 이 브라우저에 저장 (IndexedDB) — 실패해도 페이지는 그대로 동작
const DB = 'mo-sound-scene', VER = 1;
let dbp = null;
function db() {
    if (!dbp) {
        dbp = new Promise((res, rej) => {
            try {
                const rq = indexedDB.open(DB, VER);
                rq.onupgradeneeded = () => {
                    const d = rq.result;
                    if (!d.objectStoreNames.contains('cands')) d.createObjectStore('cands', { keyPath: 'id' });
                    if (!d.objectStoreNames.contains('cues')) d.createObjectStore('cues', { keyPath: 'cue' });
                };
                rq.onsuccess = () => res(rq.result);
                rq.onerror = () => rej(rq.error);
            } catch (e) { rej(e); }
        }).catch(e => { console.warn('[저장] IndexedDB를 쓸 수 없음', e); return null; });
    }
    return dbp;
}
async function tx(store, mode, fn) {
    const d = await db();
    if (!d) return null;
    return new Promise(res => {
        try {
            const t = d.transaction(store, mode);
            const r = fn(t.objectStore(store));
            t.oncomplete = () => res(r && 'result' in r ? r.result : true);
            t.onerror = () => res(null);
        } catch (e) { res(null); }
    });
}
export function saveCand(cue, cand, active) {
    return tx('cands', 'readwrite', st => st.put({ id: cand.id, cue, name: cand.name, type: cand.type, bytes: cand.bytes,
        gainDb: cand.gainDb, auto: cand.auto, offsetMs: cand.offsetMs, endMs: cand.endMs, addedAt: cand.addedAt, active: !!active }));
}
export function deleteCand(id) { return tx('cands', 'readwrite', st => st.delete(id)); }
export function saveCue(cue, rec) { return tx('cues', 'readwrite', st => st.put({ cue, ...rec })); }
export async function loadAll() {
    const d = await db();
    if (!d) return { cands: [], cues: [] };
    const all = store => new Promise(res => {
        try {
            const rq = d.transaction(store, 'readonly').objectStore(store).getAll();
            rq.onsuccess = () => res(rq.result || []);
            rq.onerror = () => res([]);
        } catch (e) { res([]); }
    });
    return { cands: await all('cands'), cues: await all('cues') };
}
export async function clearAll() {
    await tx('cands', 'readwrite', st => st.clear());
    await tx('cues', 'readwrite', st => st.clear());
}
