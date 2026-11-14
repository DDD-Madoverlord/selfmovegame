/* ==========================================================================
   PROJECT: MAD OVERLORD // 사운드 장면 점검실 — 화면
   왼쪽 목록(157개) → 가운데 무대에서 그 소리가 나는 장면을 반복 재생 → 오른쪽 칸에 파일을 넣고 고르고 다듬고 판정
   ========================================================================== */

import { Stage } from './stage.js';
import { SCENES, NEW_RULES } from './cues.js';
import { audio, hookSound, activeCand, makeCand, retrim, previewRaw, stopPreview, saveCand, deleteCand, saveCue, loadAll, origBuffer, analyze, waveform, trimmed, dbToGain } from './audio.js';
import { makeZip } from './zip.js';
import { sound, SFX, CAT_VOL, catOf } from '/js/engine_v2/audio/sound_v2.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = ['캐릭터 10명', '전투 공용 층', '적 공용 공격', '구역 적·보스', '연출·알림', 'UI·보상'];
const STATES = [['all', '전체'], ['new', '새로'], ['redo', '다시 만듦'], ['keep', '그대로'], ['has', '파일 넣음'], ['none', '파일 없음'], ['good', '좋음'], ['bad', '다시']];
const STATUS_TAG = { new: ['새로', ''], redo: ['다시', 'redo'], keep: ['그대로', 'keep'] };
const CAT_KO = { skill: '전투(스킬)', enemy: '전투(적)', player: '전투(주인공)', cue: '연출', ui: 'UI' };
const MAX_CANDS = 6;

const cues = (await fetch('tools/sound/scene/cue_list.json').then(r => r.json())).cues;
const byId = Object.fromEntries(cues.map(c => [c.id, c]));
const st = { sel: null, q: '', group: '', state: 'all', loop: true, slow: false, review: new Map() };
let playTok = 0, runLog = [], flagT = 0;

// ---- 무대 · 소리 ----
const stage = new Stage($('#stageIn'));
audio.muteSet = () => stage.muteGame;
hookSound();
audio.onPlay = (name, played) => {
    if (!played) return;
    runLog.push({ t: stage.time, name });
    stage.pulse(name);
    if (name === st.sel) {
        const f = $('#flag');
        f.classList.add('is-hit');
        clearTimeout(flagT);
        flagT = setTimeout(() => f.classList.remove('is-hit'), 220);
    }
    scheduleInfo();
};
const fitStage = () => { const k = $('#stageBox').clientWidth / 1280; $('#stageIn').style.transform = `scale(${k})`; };
new ResizeObserver(fitStage).observe($('#stageBox'));
fitStage();

// ---- 저장된 파일 되살리기 ----
const saved = await loadAll();
for (const r of saved.cues) st.review.set(r.cue, { status: r.status || '', note: r.note || '' });
for (const r of saved.cands.sort((a, b) => a.addedAt - b.addedAt)) {
    if (!byId[r.cue]) continue;
    try {
        if (!sound.ctx) sound.unlock();
        const buffer = await sound.ctx.decodeAudioData(r.bytes.slice(0));
        const cand = { ...r, buffer, stats: analyze(buffer), wave: waveform(buffer) };
        cand.trimmed = trimmed(buffer, cand.offsetMs || 0, cand.endMs || 0);
        const c = audio.custom.get(r.cue) || { cands: [], active: 0 };
        c.cands.push(cand);
        if (r.active) c.active = c.cands.length - 1;
        audio.custom.set(r.cue, c);
    } catch (e) { console.warn('[저장] 되살리기 실패', r.name, e); }
}

// ---------------------------------------------------------------------------
// 목록
function counts() {
    const has = cues.filter(c => audio.custom.get(c.id)?.cands.length).length;
    const good = cues.filter(c => st.review.get(c.id)?.status === 'good').length;
    $('#pgHas').style.width = `${(has / cues.length) * 100}%`;
    $('#pgGood').style.width = `${(good / cues.length) * 100}%`;
    $('#pgText').textContent = `파일 넣음 ${has} / ${cues.length} · 좋음 ${good}`;
}
function matches(c) {
    const r = st.review.get(c.id)?.status, has = !!audio.custom.get(c.id)?.cands.length;
    if (st.group && c.group !== st.group) return false;
    if (st.state === 'new' || st.state === 'redo' || st.state === 'keep') { if (c.status !== st.state) return false; }
    else if (st.state === 'has' && !has) return false;
    else if (st.state === 'none' && has) return false;
    else if (st.state === 'good' && r !== 'good') return false;
    else if (st.state === 'bad' && r !== 'redo') return false;
    if (st.q) {
        const q = st.q.toLowerCase();
        if (!(c.id.includes(q) || c.ko.toLowerCase().includes(q) || c.ch.toLowerCase().includes(q) || (SCENES[c.id]?.when || '').toLowerCase().includes(q))) return false;
    }
    return true;
}
function visible() { return cues.filter(matches); }
function drawChips() {
    const g = [['', '쓰임 전체', cues.length], ...GROUPS.map(n => [n, n, cues.filter(c => c.group === n).length])];
    $('#fGroup').innerHTML = g.map(([k, t, n]) => `<button data-k="${esc(k)}" aria-pressed="${st.group === k}">${esc(t)}<small>${n}</small></button>`).join('');
    $('#fState').innerHTML = STATES.map(([k, t]) => `<button data-k="${k}" aria-pressed="${st.state === k}">${t}</button>`).join('');
}
function drawRows() {
    const vis = visible();
    let html = '';
    for (const g of GROUPS) {
        const rows = vis.filter(c => c.group === g);
        if (!rows.length) continue;
        html += `<div class="sp-group"><span>${esc(g)}</span><span>${rows.length}</span></div>`;
        html += rows.map(c => {
            const r = st.review.get(c.id)?.status, has = audio.custom.get(c.id)?.cands.length;
            const dot = r === 'good' ? 'good' : r === 'redo' ? 'redo' : has ? 'has' : '';
            const [tag, cls] = STATUS_TAG[c.status];
            return `<button class="sp-row${st.sel === c.id ? ' is-sel' : ''}" role="option" aria-selected="${st.sel === c.id}" data-id="${c.id}">
                <span class="dot ${dot}" title="${dot === 'good' ? '좋음' : dot === 'redo' ? '다시' : has ? '파일 넣음' : '파일 없음'}"></span>
                <span class="nm"><b>${esc(c.ko)}</b><code>${c.id}</code></span><span class="sp-tagnew ${cls}">${tag}${has ? ` · ${has}` : ''}</span></button>`;
        }).join('');
    }
    $('#rows').innerHTML = html || '<p class="sp-hint" style="padding:16px">맞는 소리가 없어요. 거름을 풀어 보세요.</p>';
    counts();
}
$('#fGroup').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.group = b.dataset.k; drawChips(); drawRows(); });
$('#fState').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.state = b.dataset.k; drawChips(); drawRows(); });
$('#q').addEventListener('input', e => { st.q = e.target.value.trim(); drawRows(); });
$('#rows').addEventListener('click', e => { const b = e.target.closest('.sp-row'); if (b) select(b.dataset.id); });

// ---------------------------------------------------------------------------
// 고르기 · 재생
function select(id, play = true) {
    if (!byId[id]) return;
    st.sel = id;
    audio.focus = id;
    try { localStorage.setItem('mo-sound-scene-sel', id); } catch (e) { /* 저장 안 됨 */ }
    drawRows();
    document.querySelector(`.sp-row[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    drawHead();
    drawSide();
    if (play) playScene();
}

function bgmFor(id) {
    const c = byId[id];
    if (c.group === 'UI·보상' && !/tick|reward/.test(id)) return 'menu';
    return /^boss_|kill_boss|zone_(judgment|hellgate|knight|mutation)|warning_danger/.test(id) ? 'boss' : 'battle';
}

async function playScene() {
    const id = st.sel, sc = SCENES[id];
    if (!sc) return;
    const tok = ++playTok;
    stage.onDone = null;
    stage.paused = true;
    await stage.reset();
    runLog = [];
    try { await sc.run(stage); } catch (e) { console.error('[장면]', id, e); toast(`장면을 띄우다 문제가 생겼어요: ${e.message}`); }
    if (tok !== playTok) return;
    stage.time = 0;
    stage.paused = false;
    if (audio.bgmOn) sound.playBgm(bgmFor(id), 0.6);
    stage.onDone = () => {
        if (!st.loop || tok !== playTok) return;
        setTimeout(() => { if (tok === playTok && st.loop) playScene(); }, 700);
    };
    drawFlag();
    scheduleInfo();
}

function drawHead() {
    const c = byId[st.sel], sc = SCENES[c.id] || {};
    $('#head').innerHTML = `<h2>${esc(c.ko)}</h2><code>${c.id}</code>
        <span class="sp-meta"><span class="sp-pill">${esc(c.group)}</span><span class="sp-pill">${esc(c.kind)}</span><span class="sp-pill">${c.grade}등급</span><span class="sp-pill">${esc(c.plan)}</span>${c.ch && c.ch !== '공용' ? `<span class="sp-pill">${esc(c.ch)}</span>` : ''}</span>
        <p class="sp-when" style="flex-basis:100%">${esc(sc.when || '')}</p>`;
    $('#dropName').textContent = c.ko;
}

function drawFlag() {
    const id = st.sel, c = activeCand(id), rule = SFX[id] || {};
    $('#flagName').textContent = id;
    let src;
    if (audio.mode === 'mine' && c) src = `<span class="src-mine">넣은 파일 · ${esc(c.name)}</span>`;
    else if (rule.src) src = `<span class="src-game">지금은 빌려 쓰는 소리 · ${esc(rule.src)}</span>`;
    else src = '<span class="src-game">지금 게임 소리</span>';
    if (audio.solo) src += ' · 이 소리만';
    $('#flagSrc').innerHTML = src;
}

// 시간표 · 같이 난 소리
let infoRaf = 0;
function scheduleInfo() { if (!infoRaf) infoRaf = requestAnimationFrame(() => { infoRaf = 0; drawInfo(); }); }
function drawInfo() {
    const cv = $('#timeCv'), g = cv.getContext('2d');
    const w = cv.width, h = cv.height, dur = Math.max(1, stage.duration);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1a1f2a';
    g.fillRect(0, h - 6, w, 6);
    g.fillStyle = '#3a4150';
    g.fillRect(0, h - 6, Math.min(1, stage.time / dur) * w, 6);
    for (const ev of runLog) {
        const x = Math.min(w - 2, (ev.t / dur) * w);
        const focus = ev.name === st.sel;
        g.fillStyle = focus ? '#ffb020' : 'rgba(150, 160, 180, 0.45)';
        g.fillRect(x, focus ? 2 : 12, focus ? 3 : 2, focus ? h - 10 : h - 20);
    }
    const tally = new Map();
    runLog.forEach(ev => tally.set(ev.name, (tally.get(ev.name) || 0) + 1));
    const mine = tally.get(st.sel) || 0;
    tally.delete(st.sel);
    const others = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => `<code>${n}</code>×${k}`).join(' · ');
    $('#heard').innerHTML = `<b class="is-focus">이 소리 ${mine}번</b>${others ? ` · 같이 난 소리: ${others}` : ''}${audio.solo ? ' <span>(이 소리만 듣는 중 — 다른 소리는 꺼짐)</span>' : ''}`;
}
setInterval(() => { if (!stage.paused) scheduleInfo(); }, 120);

// ---------------------------------------------------------------------------
// 오른쪽 칸: 게임 규칙 · 넣은 파일 · 판정
function lenText(s) { return s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(2)}초`; }
function drawSide() {
    const id = st.sel, c = byId[id], sc = SCENES[id] || {}, rule = SFX[id] || {}, cust = audio.custom.get(id);
    const rv = st.review.get(id) || { status: '', note: '' };
    const len = sc.len ? `${lenText(sc.len[0])} ~ ${lenText(sc.len[1])}` : '—';
    const cat = catOf(id);
    $('#side').innerHTML = `
        <div class="sp-box"><h3>게임에서 이 소리는</h3>
            <div class="sp-rules">
                <span>권장 길이</span><b>${len}</b>
                <span>기본 음량</span><b>${rule.vol ?? '—'} × 묶음 ${CAT_VOL[cat] ?? 1} (${CAT_KO[cat]})</b>
                <span>다시 나는 간격</span><b>${rule.gap ? `${rule.gap}초 안엔 다시 안 남` : '제한 없음'}</b>
                <span>동시에</span><b>최대 ${rule.voices || 6}개</b>
                <span>음높이 흔들림</span><b>${rule.pitch ? `±${Math.round(rule.pitch * 100)}%` : '없음'}</b>
                <span>배경음 낮춤</span><b>${rule.duck ? `${Math.round(rule.duck * 100)}%로` : '없음'}</b>
                <span>지금 출처</span><b>${c.status === 'new' ? `없음 (빌려 씀: ${esc(rule.src || '—')})` : esc({ ai: 'AI (Stable Audio 3)', ext: '외부 무료 재료', cc0: 'CC0', synth: '코드 합성' }[c.src] || c.src || '—')}</b>
            </div>
            <button class="sp-mini" id="pvOrig"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg> 지금 게임 소리만 들어 보기</button>
        </div>
        <div class="sp-box"><h3>넣은 파일 <span>${cust?.cands.length || 0} / ${MAX_CANDS}</span></h3>
            <div class="sp-dz" id="dz" tabindex="0" role="button"><b>파일을 여기로 끌어다 놓기</b><br>또는 눌러서 고르기 · wav · mp3 · ogg · m4a · flac<br><small>무대 위에 놓아도 이 소리 자리에 들어가요</small></div>
            ${(cust?.cands || []).map((cd, i) => candHtml(cd, i, i === cust.active, sc)).join('')}
            ${cust?.cands.length ? '<p class="sp-hint">음량은 처음 넣을 때 지금 게임 소리 크기에 맞춰 둠 — 게임 안 최종 크기 = 기본 음량 × 이 값. 조절을 놓으면 장면이 다시 나와요.</p>' : ''}
        </div>
        <div class="sp-box"><h3>판정</h3>
            <div class="sp-judge" id="judge">
                <button data-v="good" aria-pressed="${rv.status === 'good'}">좋음</button><button data-v="hold" aria-pressed="${rv.status === 'hold'}">보류</button><button data-v="redo" aria-pressed="${rv.status === 'redo'}">다시</button>
            </div>
            <textarea id="note" placeholder="메모 (예: 앞이 늦게 들림, 더 묵직하게, 2번이 제일 나음)">${esc(rv.note)}</textarea>
        </div>`;
    drawWaves();
    bindSide();
}
function candHtml(cd, i, on, sc) {
    const s = cd.stats, dur = (cd.trimmed?.duration ?? s.dur);
    const long = sc.len && dur > sc.len[1] * 1.5, short = sc.len && dur < sc.len[0] * 0.5;
    const hot = s.peakDb + cd.gainDb > -0.5;
    const lead = s.lead * 1000 + (cd.offsetMs || 0);
    return `<div class="sp-cand${on ? ' is-on' : ''}" data-i="${i}">
        <div class="row1"><label><input type="radio" name="pick" ${on ? 'checked' : ''} data-act="pick"> ${i + 1}</label>
            <span class="fn" title="${esc(cd.name)}">${esc(cd.name)}</span>
            <button class="sp-mini" data-act="pv" title="이 파일만 그대로 듣기"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg></button>
            <button class="sp-mini" data-act="del" title="빼기">✕</button></div>
        <canvas width="300" height="34" data-wave="${i}"></canvas>
        <div class="stats"><span class="${long || short ? 'warn' : ''}">길이 ${lenText(dur)}${long ? ' (길어요)' : short ? ' (짧아요)' : ''}</span>
            <span class="${hot ? 'bad' : ''}">피크 ${(s.peakDb + cd.gainDb).toFixed(1)}dB${hot ? ' (찢어질 수 있음)' : ''}</span>
            <span class="${lead > 30 ? 'warn' : ''}">앞 무음 ${Math.max(0, Math.round(lead))}ms${lead > 30 ? ' (늦게 들림)' : ''}</span></div>
        <div class="sp-knob"><span>음량${cd.auto ? ' (맞춤)' : ''}</span><input type="range" min="-24" max="18" step="0.5" value="${cd.gainDb}" data-k="gainDb"><output>${cd.gainDb > 0 ? '+' : ''}${cd.gainDb}dB</output></div>
        <div class="sp-knob"><span>시작</span><input type="range" min="-500" max="500" step="5" value="${cd.offsetMs}" data-k="offsetMs"><output>${cd.offsetMs > 0 ? '+' : ''}${cd.offsetMs}ms</output></div>
        <div class="sp-knob"><span>끝 자르기</span><input type="range" min="0" max="${Math.ceil(s.dur * 1000)}" step="10" value="${cd.endMs || 0}" data-k="endMs"><output>${cd.endMs ? `${cd.endMs}ms` : '끝까지'}</output></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="sp-mini" data-act="lead">앞 무음 자르기</button><button class="sp-mini" data-act="match">지금 소리 크기에 맞춤</button><button class="sp-mini" data-act="reset">조절 처음으로</button></div>
    </div>`;
}
function drawWaves() {
    const cust = audio.custom.get(st.sel);
    if (!cust) return;
    document.querySelectorAll('[data-wave]').forEach(cv => {
        const cd = cust.cands[Number(cv.dataset.wave)];
        if (!cd) return;
        const g = cv.getContext('2d'), w = cv.width, h = cv.height, wave = cd.wave, k = dbToGain(cd.gainDb);
        g.clearRect(0, 0, w, h);
        const dur = cd.stats.dur, startS = Math.max(0, -(cd.offsetMs || 0) / 1000), endS = cd.endMs ? Math.min(dur, startS + cd.endMs / 1000) : dur;
        g.fillStyle = 'rgba(255,255,255,0.04)';
        g.fillRect((startS / dur) * w, 0, ((endS - startS) / dur) * w, h);
        const bw = w / wave.length;
        wave.forEach((v, i) => {
            const t = (i / wave.length) * dur, inside = t >= startS && t <= endS;
            const a = Math.min(1, v * k);
            g.fillStyle = inside ? (a > 0.99 ? '#ff4d6a' : '#3ee6ff') : '#3a4150';
            const bh = Math.max(1, a * (h - 4));
            g.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 1), bh);
        });
    });
}
let saveT = 0;
function bindSide() {
    const id = st.sel;
    $('#pvOrig').onclick = async () => { const b = await origBuffer(id); if (b) previewRaw(b); else toast('지금 게임 소리가 없어요'); };
    const dz = $('#dz');
    dz.onclick = () => $('#fileOne').click();
    dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileOne').click(); } };
    dz.ondragenter = dz.ondragover = e => { e.preventDefault(); dz.classList.add('is-over'); };
    dz.ondragleave = () => dz.classList.remove('is-over');
    document.querySelectorAll('.sp-cand').forEach(el => {
        const i = Number(el.dataset.i), cust = audio.custom.get(id), cd = cust.cands[i];
        el.addEventListener('click', async e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            if (act === 'pick') { cust.active = i; persistCands(id); drawSide(); drawRows(); playScene(); }
            else if (act === 'pv') previewRaw(cd.trimmed, cd.gainDb);
            else if (act === 'del') {
                cust.cands.splice(i, 1);
                deleteCand(cd.id);
                if (cust.active >= cust.cands.length) cust.active = Math.max(0, cust.cands.length - 1);
                if (!cust.cands.length) audio.custom.delete(id);
                persistCands(id); drawSide(); drawRows(); playScene();
            } else if (act === 'lead') { cd.offsetMs = -Math.round(cd.stats.lead * 1000 / 5) * 5; retrim(cd); persistCands(id); drawSide(); playScene(); }
            else if (act === 'match') {
                const ref = await origBuffer(id);
                if (!ref) return toast('맞출 지금 소리가 없어요');
                cd.gainDb = Math.max(-24, Math.min(18, Math.round((analyze(ref).rmsDb - cd.stats.rmsDb) * 2) / 2));
                cd.auto = true; persistCands(id); drawSide(); playScene();
            } else if (act === 'reset') { cd.offsetMs = 0; cd.endMs = 0; retrim(cd); persistCands(id); drawSide(); playScene(); }
        });
        el.querySelectorAll('input[type=range]').forEach(inp => {
            inp.addEventListener('input', () => {
                const k = inp.dataset.k, v = Number(inp.value);
                cd[k] = v;
                if (k === 'gainDb') cd.auto = false;
                const out = inp.parentElement.querySelector('output');
                out.textContent = k === 'gainDb' ? `${v > 0 ? '+' : ''}${v}dB` : k === 'offsetMs' ? `${v > 0 ? '+' : ''}${v}ms` : (v ? `${v}ms` : '끝까지');
                if (k !== 'gainDb') retrim(cd);
                drawWaves();
            });
            inp.addEventListener('change', () => { persistCands(id); drawSide(); playScene(); });
        });
    });
    document.querySelectorAll('#judge button').forEach(b => b.onclick = () => {
        const rv = st.review.get(id) || { status: '', note: '' };
        rv.status = rv.status === b.dataset.v ? '' : b.dataset.v;
        st.review.set(id, rv);
        saveCue(id, rv);
        drawSide(); drawRows();
    });
    $('#note').oninput = e => {
        const rv = st.review.get(id) || { status: '', note: '' };
        rv.note = e.target.value;
        st.review.set(id, rv);
        clearTimeout(saveT);
        saveT = setTimeout(() => saveCue(id, rv), 400);
    };
}
function persistCands(id) {
    const cust = audio.custom.get(id);
    if (!cust) return;
    cust.cands.forEach((cd, i) => saveCand(id, cd, i === cust.active));
    drawFlag();
}

// ---------------------------------------------------------------------------
// 파일 넣기
async function addFiles(id, files) {
    const cust = audio.custom.get(id) || { cands: [], active: 0 };
    let added = 0;
    for (const f of files) {
        if (cust.cands.length >= MAX_CANDS) { toast(`한 소리에 후보는 ${MAX_CANDS}개까지예요`); break; }
        try {
            const cand = await makeCand(id, f, await f.arrayBuffer());
            cust.cands.push(cand);
            cust.active = cust.cands.length - 1;
            added++;
        } catch (e) { toast(`${f.name}: 소리 파일로 읽지 못했어요`); }
    }
    if (added) {
        audio.custom.set(id, cust);
        persistCands(id);
    }
    return added;
}
const AUDIO_RE = /\.(wav|mp3|ogg|oga|m4a|aac|flac|webm|opus)$/i;
/** 파일 이름 → 소리 이름 (가장 길게 맞는 이름, 뒤에 _v2 · -01 · (2) 같은 꼬리 허용) */
function cueOfFile(name) {
    const base = name.replace(/\.[^.]+$/, '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    let best = null;
    for (const c of cues) {
        if (base === c.id || (base.startsWith(c.id) && /^[_.(\[]/.test(base.slice(c.id.length)))) {
            if (!best || c.id.length > best.length) best = c.id;
        }
    }
    return best;
}
async function bulk(files) {
    files = [...files].filter(f => AUDIO_RE.test(f.name) || f.type.startsWith('audio/'));
    if (!files.length) return toast('소리 파일이 없어요');
    const hit = [], miss = [];
    for (const f of files) { const id = cueOfFile(f.name); (id ? hit : miss).push([f, id]); }
    const groups = new Map();
    hit.forEach(([f, id]) => groups.set(id, [...(groups.get(id) || []), f]));
    let n = 0;
    for (const [id, fs] of groups) n += await addFiles(id, fs);
    drawRows();
    if (st.sel) drawSide();
    if (!miss.length) { toast(`${n}개를 이름에 맞춰 넣었어요`); if (groups.has(st.sel)) playScene(); return; }
    // 이름이 안 맞는 파일: 직접 고르기
    $('#dlgIn').innerHTML = `<h3>이름이 맞지 않은 파일 ${miss.length}개</h3>
        <p class="sp-hint">${n}개는 이름에 맞춰 넣었어요. 아래 파일은 어느 소리인지 골라 주세요 (파일 이름을 소리 이름으로 바꿔 두면 다음엔 알아서 들어가요).</p>
        <div class="un">${miss.map(([f], i) => `<span title="${esc(f.name)}">${esc(f.name)}</span><select data-i="${i}"><option value="">넣지 않음</option>${cues.map(c => `<option value="${c.id}">${esc(c.ko)} · ${c.id}</option>`).join('')}</select>`).join('')}</div>
        <div class="foot"><button class="sp-btn" data-x="0">닫기</button><button class="sp-btn is-primary" data-x="1">고른 대로 넣기</button></div>`;
    const dlg = $('#dlg');
    dlg.showModal();
    dlg.querySelector('[data-x="0"]').onclick = () => dlg.close();
    dlg.querySelector('[data-x="1"]').onclick = async () => {
        const sels = [...dlg.querySelectorAll('select')];
        let m = 0;
        for (const s of sels) if (s.value) m += await addFiles(s.value, [miss[Number(s.dataset.i)][0]]);
        dlg.close();
        drawRows();
        if (st.sel) drawSide();
        toast(`${m}개를 더 넣었어요`);
        playScene();
    };
}
$('#fileOne').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (await addFiles(st.sel, files)) { drawSide(); drawRows(); playScene(); }
});
$('#btnBulk').onclick = () => $('#fileBulk').click();
$('#btnFolder').onclick = () => $('#fileFolder').click();
$('#fileBulk').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; bulk(f); });
$('#fileFolder').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; bulk(f); });
// 끌어다 놓기: 한 개면 지금 소리 자리, 여러 개면 이름에 맞춰
let dragN = 0;
window.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragN++; document.body.classList.add('is-drag'); } });
window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('is-drag'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async e => {
    e.preventDefault();
    dragN = 0;
    document.body.classList.remove('is-drag');
    document.querySelectorAll('.sp-dz').forEach(d => d.classList.remove('is-over'));
    const files = [...(e.dataTransfer?.files || [])].filter(f => AUDIO_RE.test(f.name) || f.type.startsWith('audio/'));
    if (!files.length) return;
    if (files.length === 1) {
        const other = cueOfFile(files[0].name);
        const id = other && other !== st.sel && !e.target.closest('.sp-dz, .sp-stagebox') ? other : st.sel;
        if (await addFiles(id, files)) { if (id !== st.sel) select(id, false); drawSide(); drawRows(); playScene(); }
    } else bulk(files);
});

// ---------------------------------------------------------------------------
// 내보내기: 원본(이름만 바꿈) + 조절본 WAV(음량·자르기 반영) + 판정표
function wavOf(buf, gain) {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
    let peak = 0;
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i] * gain)); }
    const k = peak > 0.98 ? 0.98 / peak : 1;     // 찢어지지 않게 (조절본만)
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i] * gain * k)); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return { bytes: new Uint8Array(out.buffer), limited: k < 1 };
}
$('#btnZip').onclick = () => {
    const files = [], picks = {};
    for (const c of cues) {
        const cd = activeCand(c.id), rv = st.review.get(c.id);
        if (!cd && !rv?.status && !rv?.note) continue;
        const rec = { 이름: c.ko, 쓰임: c.group, 계획: c.plan, 판정: { good: '좋음', hold: '보류', redo: '다시' }[rv?.status] || '', 메모: rv?.note || '' };
        if (cd) {
            const ext = (cd.name.match(/\.([^.]+)$/) || [, 'wav'])[1].toLowerCase();
            files.push({ name: `원본/${c.id}.${ext}`, data: new Uint8Array(cd.bytes) });
            const wv = wavOf(cd.trimmed, dbToGain(cd.gainDb));
            files.push({ name: `조절본/${c.id}.wav`, data: wv.bytes });
            Object.assign(rec, { 원래_파일: cd.name, 음량_dB: cd.gainDb, 시작_ms: cd.offsetMs, 끝_ms: cd.endMs || null, 길이_초: +(cd.trimmed.duration).toFixed(3),
                후보_수: audio.custom.get(c.id).cands.length, 조절본_피크_줄임: wv.limited });
        }
        picks[c.id] = rec;
    }
    if (!files.length && !Object.keys(picks).length) return toast('아직 넣은 파일·판정이 없어요');
    const head = '소리 이름,한글 이름,쓰임,계획,판정,넣은 파일,음량(dB),시작(ms),끝(ms),메모';
    const csv = [head, ...Object.entries(picks).map(([id, r]) => [id, r.이름, r.쓰임, r.계획, r.판정, r.원래_파일 || '', r.음량_dB ?? '', r.시작_ms ?? '', r.끝_ms ?? '', r.메모]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    files.push({ name: 'sound_picks.json', data: new TextEncoder().encode(JSON.stringify({ 만든_날: new Date().toISOString(), 설명: '원본/ = 넣은 파일 그대로(이름만 소리 이름으로) · 조절본/ = 점검실에서 맞춘 음량·시작·끝을 반영한 WAV (게임 표의 기본 음량은 그대로 두고 이 파일을 넣으면 됨)', 소리: picks }, null, 1)) });
    files.push({ name: '판정.csv', data: new TextEncoder().encode('﻿' + csv) });
    const blob = makeZip(files);
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `sound_picks_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`ZIP을 만들었어요 — 파일 ${files.length - 2}개 · 판정 ${Object.keys(picks).length}개`);
};

// ---------------------------------------------------------------------------
// 단추 · 키
function setMode(m) { audio.mode = m; $('#mMine').setAttribute('aria-pressed', m === 'mine'); $('#mGame').setAttribute('aria-pressed', m === 'game'); drawFlag(); playScene(); }
function setSolo(on) { audio.solo = on; $('#sMix').setAttribute('aria-pressed', !on); $('#sSolo').setAttribute('aria-pressed', on); drawFlag(); playScene(); }
$('#mMine').onclick = () => setMode('mine');
$('#mGame').onclick = () => setMode('game');
$('#sMix').onclick = () => setSolo(false);
$('#sSolo').onclick = () => setSolo(true);
$('#btnReplay').onclick = () => playScene();
$('#btnLoop').onclick = e => { st.loop = !st.loop; e.currentTarget.classList.toggle('is-on', st.loop); e.currentTarget.setAttribute('aria-pressed', st.loop); if (st.loop && !stage.onDone) playScene(); };
$('#btnSlow').onclick = e => { st.slow = !st.slow; e.currentTarget.classList.toggle('is-on', st.slow); e.currentTarget.setAttribute('aria-pressed', st.slow); stage.setSpeed(st.slow ? 0.5 : 1); playScene(); };
$('#btnBgm').onclick = e => {
    audio.bgmOn = !audio.bgmOn;
    e.currentTarget.classList.toggle('is-on', audio.bgmOn);
    e.currentTarget.setAttribute('aria-pressed', audio.bgmOn);
    sound.applyVolumes();
    if (audio.bgmOn && st.sel) sound.playBgm(bgmFor(st.sel), 0.6); else sound.stopBgm(0.4);
};
$('#vol').oninput = e => { audio.master = Number(e.target.value) / 100; sound.applyVolumes(); };
$('#btnHelp').onclick = () => {
    $('#dlgIn').innerHTML = `<h3>쓰는 법</h3>
        <ul>
            <li>왼쪽에서 소리를 고르면 가운데에 <b>그 소리가 게임에서 나는 장면</b>이 반복돼요. 왼쪽 위 표시가 노랗게 깜빡이는 순간, 아래 시간표의 노란 선이 이 소리가 난 순간이에요.</li>
            <li>구한 파일을 <b>오른쪽 칸이나 무대 위로 끌어다 놓으면</b> 바로 그 소리 자리에 들어가 장면과 함께 나요. 한 소리에 후보 ${MAX_CANDS}개까지 넣고 1~${MAX_CANDS}로 바꿔 가며 비교하세요.</li>
            <li>파일 이름을 소리 이름(예: <code>mech_laser.wav</code>, <code>mech_laser_v2.wav</code>)으로 해 두면 <b>여러 파일 넣기·폴더 넣기</b>로 한 번에 제자리에 들어가요.</li>
            <li>음량은 처음 넣을 때 <b>지금 게임 소리 크기</b>에 맞춰져요. 앞에 무음이 있으면 늦게 들리니 '앞 무음 자르기'를 누르세요.</li>
            <li>소리는 게임 규칙 그대로예요 — 다시 나는 간격·동시 개수·음높이 흔들림·배경음 낮춤. '장면 소리 다 같이'는 게임처럼 섞어서, '이 소리만'은 이것만.</li>
            <li>'지금 게임 소리'로 바꾸면 지금 소리(새 소리는 빌려 쓰는 소리)와 비교할 수 있어요. '배경음'을 켜면 게임 배경음 위에서 들려요.</li>
            <li>판정(좋음·보류·다시)과 메모를 남기고 <b>고른 파일 ZIP 받기</b>로 보내 주세요 — 원본, 조절본(맞춘 음량·자르기 반영 WAV), 판정표가 들어가요.</li>
            <li>넣은 파일은 <b>이 브라우저에만</b> 저장돼요 (서버로 올라가지 않음). 다른 컴퓨터에선 ZIP을 주고받으세요.</li>
        </ul>
        <div class="foot"><button class="sp-btn is-primary" data-x="0">닫기</button></div>`;
    $('#dlg').showModal();
    $('#dlg [data-x="0"]').onclick = () => $('#dlg').close();
};
window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    if (e.code === 'Space') { e.preventDefault(); playScene(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const vis = visible(), i = vis.findIndex(c => c.id === st.sel);
        const n = vis[Math.max(0, Math.min(vis.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (n) select(n.id);
    } else if (e.key === 'b' || e.key === 'B') setMode(audio.mode === 'mine' ? 'game' : 'mine');
    else if (e.key === 's' || e.key === 'S') setSolo(!audio.solo);
    else if (/^[1-6]$/.test(e.key)) {
        const cust = audio.custom.get(st.sel), i = Number(e.key) - 1;
        if (cust && cust.cands[i]) { cust.active = i; persistCands(st.sel); drawSide(); drawRows(); playScene(); }
    }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });

function toast(text) {
    const el = document.createElement('div');
    el.className = 'sp-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

// ---- 시작 ----
drawChips();
let first = null;
try { first = localStorage.getItem('mo-sound-scene-sel'); } catch (e) { /* 없음 */ }
select(byId[first] ? first : cues[0].id);
window.soundScene = { stage, audio, select, cues, SCENES };   // 자동 검사용
