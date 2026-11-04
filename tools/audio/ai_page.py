"""
MAD OVERLORD // AI 소리 후보 비교 페이지 만들기 (2026-11-04)

ai_finish.py의 후보(<out>/cand/cand.json)를 팀이 듣고 고르는 한 장짜리 페이지로 묶는다 (예전 후보 비교 페이지와 같은 투표 방식).
  소리마다: 지금 게임 소리(새 이름은 지금 빌려 쓰는 소리) + 후보, 게임 속 크기로 맞춰 재생 · 짧은 소리는 ×4 연속(게임처럼 음높이 흔들림)
  배경음: 처음부터 재생 + '이음매' (끝 4초 → 처음 4초, 반복될 때 끊기는지)
  고른 것: Artifact db `votes/<사람 id>` = {picks: {이름: 'keep'|'1'~'4'|'none'}, notes: {이름: 글}} → ai_apply.py가 읽음

실행: python tools/audio/ai_page.py <페이지 폴더> [--out D:/SoundLib/ai] [--only 이름,이름] [--note '2차 …']
출력: <페이지 폴더>/index.html, now/<이름>.ogg, cand/<이름>_<번호>.ogg → Artifact로 올림 (root = 페이지 폴더)
"""
import argparse
import json
import os
import re
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_audio import ROOT, SR, load  # noqa: E402
from ai_gen import SPEC  # noqa: E402

GROUP = [('bgm_', '배경음'), ('diver_', '심연의 길잡이'), ('saint_', '봉합 성녀'), ('frost_', '서리의 무희'), ('doll_', '뒤틀린 인형사'),
         ('arch_', '설계자 (새 소리)'), ('bc_', '방송자 (새 소리)'), ('rampage_', '괴수 변신·숨결 (새 소리)'), ('kaiju_', '괴수 변신·숨결 (새 소리)'),
         ('', '연출 (10-24 맞는 후보 없던 것)')]


def game_vol():
    """sound_v2.js SFX 표의 vol (게임 속 크기로 들려주려고)"""
    src = open(os.path.join(ROOT, 'js', 'engine_v2', 'audio', 'sound_v2.js'), encoding='utf-8').read()
    return {m.group(1): float(m.group(2)) for m in re.finditer(r'^\s+([a-z_0-9]+): \{ vol: ([\d.]+)', src, re.M)}


def wave(path, n=64):
    a = np.abs(load(path))
    if len(a) < n:
        return [0.0] * n, len(a) / SR
    bins = np.array_split(a, n)
    v = np.array([b.max() for b in bins])
    return [round(float(x), 3) for x in v / (v.max() + 1e-9)], round(len(a) / SR, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dest')
    ap.add_argument('--out', default='D:/SoundLib/ai')
    ap.add_argument('--only', default='', help='쉼표로 이름 — 이 소리만 페이지에 (다시 만든 것만 고를 때)')
    ap.add_argument('--note', default='', help='머리에 넣을 안내 한 줄 (몇 차인지 등)')
    args = ap.parse_args()
    only = set(filter(None, args.only.split(',')))
    spec = {k: v for k, v in json.load(open(SPEC, encoding='utf-8')).items() if not k.startswith('_')}
    cand = json.load(open(os.path.join(args.out, 'cand', 'cand.json'), encoding='utf-8'))
    vols = game_vol()
    for d in ('now', 'cand'):
        shutil.rmtree(os.path.join(args.dest, d), ignore_errors=True)
        os.makedirs(os.path.join(args.dest, d))
    items = []
    for name, s in spec.items():
        c = cand.get(name)
        if not c or (only and name not in only):
            continue
        src = os.path.join(args.out, 'cand', name)
        it = {'id': name, 'ko': s['desc'], 'type': s['type'], 'g': next(g for p, g in GROUP if name.startswith(p)),
              'vol': vols.get(s.get('now', name), 0.5), 'borrow': s.get('now'), 'now': None, 'cands': []}
        if c.get('current'):
            w, dur = wave(os.path.join(src, '0.ogg'))
            shutil.copy(os.path.join(src, '0.ogg'), os.path.join(args.dest, 'now', f'{name}.ogg'))
            it['now'] = {'loud': c['current']['loud'], 'wave': w, 'dur': dur}
        for t in c['takes']:
            w, dur = wave(os.path.join(src, f'{t["no"]}.ogg'))
            shutil.copy(os.path.join(src, f'{t["no"]}.ogg'), os.path.join(args.dest, 'cand', f'{name}_{t["no"]}.ogg'))
            it['cands'].append({'k': t['no'], 'mode': t['mode'], 'loud': t['loud'], 'wave': w, 'dur': dur, 'flags': t['flags'], 'base': t.get('base')})
        items.append(it)
    html = TEMPLATE.replace('/*DATA*/null', json.dumps({'items': items}, ensure_ascii=False, separators=(',', ':')))
    html = html.replace('<!--ROUND-->', f'<p class="round">{args.note}</p>' if args.note else '')
    open(os.path.join(args.dest, 'index.html'), 'w', encoding='utf-8').write(html)
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(args.dest) for f in fs)
    print(f'소리 {len(items)}개 · 후보 {sum(len(i["cands"]) for i in items)}개 · 폴더 {size / 1e6:.1f}MB → {args.dest}')


TEMPLATE = r"""<title>AI 사운드 후보</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+KR:wght@400;500;700&family=Orbitron:wght@700&display=swap">
<style>
/* 레이아웃: 사운드 점검실·후보 비교와 같은 어두운 HUD 한 가지 — 소리마다 한 장(지금 + AI 후보 줄 + 고르기), 묶음은 캐릭터별 */
:root {
    --bg: #07080c;
    --panel: #10131b;
    --panel-2: #161a25;
    --line: #242a3a;
    --text: #eef2f8;
    --dim: #8b95a8;
    --amber: #ffb020;
    --cyan: #3ee6ff;
    --violet: #b48cff;
    --gold: #ffd36a;
    --pick: #3ddc97;
    --none: #ff6b6b;
    --f-body: 'Chakra Petch', 'Noto Sans KR', system-ui, sans-serif;
    --f-mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    --f-brand: 'Orbitron', 'Chakra Petch', sans-serif;
    color-scheme: dark;
}
html { background: var(--bg); }
body { background: var(--bg); color: var(--text); font: 14px/1.5 var(--f-body); }
.wrap { max-width: 920px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
button, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

.head { padding-block: 28px 14px; display: grid; gap: 12px; }
.eyebrow { font-family: var(--f-brand); font-size: 11px; letter-spacing: 4px; color: var(--amber); }
h1 { margin: 0; font-size: clamp(24px, 4vw, 32px); text-wrap: balance; }
.lead { margin: 0; max-width: 70ch; color: var(--dim); }
.lead b { color: var(--text); font-weight: 500; }
.note { margin: 0; font-size: 12.5px; color: var(--dim); max-width: 70ch; }
.round { margin: 0; padding: 8px 12px; border: 1px solid var(--gold); border-radius: 6px; color: var(--text); font-size: 13.5px; max-width: 70ch; background: color-mix(in srgb, var(--gold) 8%, var(--panel)); }
.who { font-size: 12px; color: var(--dim); }
.who.is-ro { color: var(--amber); }
.progress { display: flex; gap: 18px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
.progress b { font: 600 20px var(--f-mono); display: block; }
.progress span { font-size: 12px; color: var(--dim); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--dim); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }

main.wrap { padding-block: 6px 60px; display: grid; gap: 14px; }
h2 { margin: 12px 0 0; font-size: 15px; padding: 6px 2px; border-bottom: 1px solid var(--line); display: flex; gap: 10px; align-items: baseline; }
h2 small { font: 12px var(--f-mono); color: var(--dim); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; display: grid; gap: 8px; }
.card.is-done { border-left: 3px solid var(--pick); }
.top { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
.top .id { font: 600 14px var(--f-mono); }
.top .ko { color: var(--dim); font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
.opts { display: grid; gap: 6px; min-width: 0; }
.opt { display: grid; grid-template-columns: 92px minmax(0, 0.9fr) minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 6px 8px; border-radius: 6px; background: var(--panel-2); border: 1px solid transparent; }
.opt.now { --c: var(--amber); background: color-mix(in srgb, var(--amber) 6%, var(--panel-2)); }
.opt.cand { --c: var(--cyan); }
.opt.cand.init { --c: var(--violet); }
.opt.cand.design { --c: var(--gold); }
.opt.is-mine { border-color: var(--pick); }
.opt.empty { color: var(--dim); font-size: 12.5px; grid-template-columns: minmax(0, 1fr); }
.play { height: 32px; border-radius: 16px; border: 1px solid var(--c); background: color-mix(in srgb, var(--c) 12%, var(--panel)); color: var(--c); font-weight: 700; white-space: nowrap; }
.play.is-on { background: var(--c); color: var(--bg); }
.what { min-width: 0; display: grid; }
.what b { font-weight: 500; font-size: 13.5px; }
.what small { color: var(--dim); font-size: 11.5px; overflow-wrap: anywhere; }
.what .flag { color: var(--none); }
canvas { width: 100%; height: 28px; display: block; }
.extra { display: flex; gap: 6px; }
.solo { background: none; border: 1px solid var(--line); border-radius: 4px; color: var(--dim); font-size: 11.5px; padding: 2px 7px; white-space: nowrap; }
.solo:hover, .solo.is-on { color: var(--c); border-color: var(--c); }
.choose { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; margin-top: 2px; }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.seg button { background: var(--panel-2); border: 0; padding: 5px 11px; font-size: 13px; color: var(--dim); white-space: nowrap; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button[aria-pressed="true"] { background: var(--pick); color: var(--bg); font-weight: 700; }
.seg button[data-v="none"][aria-pressed="true"] { background: var(--none); }
.seg button[data-v="keep"][aria-pressed="true"] { background: var(--amber); }
.seg button:disabled { opacity: 0.55; cursor: default; }
.tally { font: 11.5px var(--f-mono); color: var(--dim); display: flex; gap: 10px; flex-wrap: wrap; }
.tally b { color: var(--pick); font-weight: 600; }
details summary { cursor: pointer; color: var(--cyan); font-size: 12.5px; }
details textarea { width: 100%; box-sizing: border-box; min-height: 48px; margin-top: 6px; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; resize: vertical; }
.notes { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13px; }
.notes .n { color: var(--dim); font-size: 12px; margin-right: 6px; }
.err { color: var(--amber); font-size: 12px; }
@media (max-width: 620px) {
    .opt { grid-template-columns: 84px minmax(0, 1fr) auto; }
    .opt canvas { grid-column: 2 / -1; grid-row: 2; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<header class="wrap head">
    <div class="eyebrow">MAD OVERLORD · AI SOUND CANDIDATES</div>
    <h1>AI 사운드 후보</h1>
    <p class="lead">무료 재료에서 맞는 소리를 못 찾던 것들을 <b>AI(Stable Audio 3)로 새로 만든</b> 후보입니다. 소리마다 스킬 설명을 글로 써서 만들었고, <b>게임 속 크기</b>에 맞춰 들려줍니다. <b style="color:var(--amber)">지금</b> 소리와 비교해 마음에 드는 번호를 고르세요. 지금이 낫다면 <b>지금 유지</b>, 전부 별로라면 <b>다 별로</b>를 누르고 원하는 느낌을 의견에 적어 주세요. AI라서 의견대로 설명을 고쳐 <b>다시 만들 수 있습니다</b>.</p>
    <!--ROUND-->
    <div class="legend"><span><i style="background:var(--amber)"></i>지금 게임 소리</span><span><i style="background:var(--cyan)"></i>글로 만든 후보</span><span><i style="background:var(--violet)"></i>지금 소리를 바탕으로 다시 만든 후보 (길이·박자 비슷)</span><span><i style="background:var(--gold)"></i>게임식 — 앞 후보에 짧은 타격·저음·장식을 겹쳐 바로 터지고 묵직하게</span></div>
    <p class="note">짧은 기본 공격 소리는 <b>×4</b>로 게임처럼 연달아 들어 보세요. 배경음은 <b>이음매</b>로 곡이 끝나고 처음으로 돌아갈 때 끊기는지 확인할 수 있습니다.</p>
    <div class="progress" id="progress"></div>
    <div class="who" id="who">표 남기기 준비 중…</div>
</header>

<main class="wrap" id="main"></main>

<script>
const DATA = /*DATA*/null;
const BY = Object.fromEntries(DATA.items.map(i => [i.id, i]));
const state = { me: null, dbOn: false, readOnly: false, mine: { picks: {}, notes: {} }, votes: [], names: {} };
let db = null, userApi = null, myRef = null;

/* ---------- 재생 ---------- */
let ac = null, playing = null;
const bufs = new Map();
function ctx() {
    if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const lim = ac.createDynamicsCompressor();   // 게임과 같은 마지막 리미터
        lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
        lim.connect(ac.destination);
        ac.out = lim;
    }
    if (ac.state !== 'running') ac.resume();
    return ac;
}
const path = (id, k) => (k ? `cand/${id}_${k}.ogg` : `now/${id}.ogg`);
function load(p) {
    if (!bufs.has(p)) bufs.set(p, fetch(p).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))).then(b => ctx().decodeAudioData(b)));
    return bufs.get(p);
}
function stop() {
    if (!playing) return;
    playing.srcs.forEach(s => { try { s.stop(); } catch (e) { /* 끝남 */ } });
    document.querySelectorAll('.play.is-on, .solo.is-on').forEach(b => b.classList.remove('is-on'));
    playing = null;
}
const MIX = { master: 0.8, sfx: 0.9, bgm: 0.5 };   // 게임 기본 설정 (settings_v2.js)
/** how: 'one' 한 번 · 'x4' 0.28초 간격 4번(음높이 ±6%) · 'seam' 배경음 끝 4초 → 처음 4초 */
async function play(id, k, how, btn) {
    const was = playing && playing.btn === btn;
    stop();
    if (was) return;
    const it = BY[id], c = ctx();
    let buf;
    try { buf = await load(path(id, k)); } catch (e) {
        btn.closest('.card').insertAdjacentHTML('beforeend', '<p class="err">이 브라우저에서 OGG 소리를 열지 못했습니다. PC 크롬·엣지나 안드로이드에서 열어 주세요.</p>');
        return;
    }
    const m = k ? it.cands.find(x => x.k === k) : it.now;
    const bgm = it.type === 'bgm';
    const g = c.createGain();
    // 후보는 지금 소리의 게임 속 크기에 맞춤 (지금 소리가 없으면 다듬기 도구가 맞춘 크기 그대로)
    g.gain.value = MIX.master * (bgm ? MIX.bgm : MIX.sfx * it.vol) * (it.now ? Math.pow(10, (it.now.loud - m.loud) / 20) : 1);
    g.connect(c.out);
    const srcs = [], t0 = c.currentTime + 0.03;
    const add = (at, offset, dur, rate) => {
        const s = c.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = rate || 1;
        s.connect(g);
        s.start(at, offset, dur);
        srcs.push(s);
    };
    if (how === 'x4') for (let i = 0; i < 4; i++) add(t0 + i * 0.28, 0, undefined, 1 + (Math.random() * 2 - 1) * 0.06);
    else if (how === 'seam') { const tail = Math.min(4, buf.duration / 2); add(t0, buf.duration - tail, tail); add(t0 + tail, 0, 4); }
    else add(t0, 0);
    btn.classList.add('is-on');
    const mine = { srcs, btn };
    playing = mine;
    srcs[srcs.length - 1].onended = () => { if (playing === mine) stop(); };
}

/* ---------- 파형 ---------- */
const css = getComputedStyle(document.documentElement);
const COL = { now: css.getPropertyValue('--amber').trim(), cand: css.getPropertyValue('--cyan').trim(), init: css.getPropertyValue('--violet').trim(), design: css.getPropertyValue('--gold').trim(), line: css.getPropertyValue('--line').trim() };
function drawWave(cv) {
    const it = BY[cv.dataset.id], k = +cv.dataset.k;
    const m = k ? it.cands.find(x => x.k === k) : it.now;
    const maxDur = Math.max(it.now ? it.now.dur : 0, ...it.cands.map(x => x.dur));   // 한 장 안에서는 같은 시간 축
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COL.line;
    g.fillRect(0, H / 2 - 0.5, W, 1);
    const span = W * m.dur / maxDur, bw = span / m.wave.length;
    g.fillStyle = !k ? COL.now : m.mode === 'init' ? COL.init : m.mode === 'design' ? COL.design : COL.cand;
    m.wave.forEach((v, i) => { const a = Math.max(0.03, v) * (H / 2 - 1); g.fillRect(i * bw + 0.3, H / 2 - a, Math.max(1, bw - 0.8), a * 2); });
}

/* ---------- 표·의견 ---------- */
const LABEL = v => (v === 'keep' ? '지금 유지' : v === 'none' ? '다 별로' : `후보 ${v}`);
function tally(id) {
    const t = { counts: {}, notes: [] };
    for (const v of state.votes) {
        const pick = (v.picks || {})[id];
        if (pick) t.counts[pick] = (t.counts[pick] || 0) + 1;
        const text = String((v.notes || {})[id] || '').trim();
        if (text && v.uid !== state.me) t.notes.push({ uid: v.uid, pick, text });
    }
    return t;
}
let saving = false, dirty = false, noteTimer = null;
async function save() {
    if (!myRef || state.readOnly) return;
    if (saving) { dirty = true; return; }
    saving = true;
    try { await myRef.set({ picks: state.mine.picks, notes: state.mine.notes, at: Date.now() }); } catch (e) {
        if (e && e.code === 'invalid_argument') { state.readOnly = true; render(); }
        else if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 800)); dirty = true; }
    }
    saving = false;
    if (dirty) { dirty = false; save(); }
}
async function startDb() {
    const who = document.getElementById('who');
    try { [db, userApi] = await Promise.all([window.claude?.use?.('db'), window.claude?.use?.('user')]); } catch (e) { db = null; }
    const uid = userApi ? await userApi.id() : null;
    if (!db || !uid) {
        who.textContent = '듣기만 할 수 있는 화면입니다. 고르려면 claude.ai에 로그인한 채로 이 페이지를 열어 주세요.';
        who.classList.add('is-ro');
        state.readOnly = true;
        render();
        return;
    }
    state.me = uid; state.dbOn = true;
    if ((await userApi.can('data.write')) === false) state.readOnly = true;
    myRef = db.doc('votes/' + uid);
    let first = true;
    db.collection('votes').onSnapshot(snap => {
        state.votes = snap.docs.filter(d => d.exists).map(d => ({ uid: d.id, ...d.data() }));
        if (first) {
            const m = state.votes.find(v => v.uid === uid);
            if (m) state.mine = { picks: { ...(m.picks || {}) }, notes: { ...(m.notes || {}) } };
            first = false;
            render();
        } else patch();
        names();
    }, () => { who.textContent = '표 목록을 불러오지 못했습니다. 페이지를 새로 열어 주세요.'; who.classList.add('is-ro'); });
    updateWho();
}
async function names() {
    const ids = state.votes.map(v => v.uid);
    if (!userApi || !ids.length) return;
    const ps = await userApi.profiles(ids);
    let ch = false;
    ids.forEach(id => { const n = (ps[id] && ps[id].name) || ''; if (state.names[id] !== n) { state.names[id] = n; ch = true; } });
    if (ch) { patch(); updateWho(); }
}
function updateWho() {
    renderProgress();
    if (!state.dbOn) return;
    const who = document.getElementById('who');
    who.classList.toggle('is-ro', state.readOnly);
    const n = state.votes.map(v => (v.uid === state.me ? '나' : state.names[v.uid] || '참여자')).join(', ');
    who.textContent = state.readOnly ? '보기 권한이라 고를 수 없습니다. 페이지를 공유한 사람에게 "참여자(Contributor)" 권한을 받아 주세요.'
        : `고른 내용은 자동 저장되고 함께 보는 사람 모두에게 보입니다.${n ? ` 참여: ${n}` : ''}`;
}

/* ---------- 그리기 ---------- */
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function extraHtml(it, k) {
    if (it.type === 'bgm') return `<button class="solo" data-id="${it.id}" data-k="${k}" data-how="seam" title="곡 끝 4초 → 처음 4초 (반복될 때)">이음매</button>`;
    const m = k ? it.cands.find(x => x.k === k) : it.now;
    return m.dur < 0.7 ? `<button class="solo" data-id="${it.id}" data-k="${k}" data-how="x4" title="게임처럼 0.28초 간격 4번">×4</button>` : '';
}
function optHtml(it, k) {
    const m = k ? it.cands.find(x => x.k === k) : it.now;
    const mine = state.mine.picks[it.id] === (k ? String(k) : 'keep');
    const what = k ? (m.mode === 'init' ? '지금 소리 바탕' : m.mode === 'design' ? `게임식 (후보 ${m.base} + 타격·저음)` : '글로 만듦') : (it.borrow ? `지금 빌려 쓰는 소리 (${it.borrow})` : '지금 게임 소리');
    return `<div class="opt ${k ? 'cand' : 'now'} ${m.mode === 'init' || m.mode === 'design' ? m.mode : ''} ${mine ? 'is-mine' : ''}" data-opt="${it.id}:${k}">
        <button class="play" data-id="${it.id}" data-k="${k}" data-how="one">▶ ${k ? '후보 ' + k : '지금'}</button>
        <div class="what"><b>${esc(what)}</b><small>${m.dur.toFixed(2)}초${m.flags && m.flags.length ? ` · <span class="flag">${esc(m.flags.join(', '))}</span>` : ''}</small></div>
        <canvas data-id="${it.id}" data-k="${k}" aria-hidden="true"></canvas>
        <div class="extra">${extraHtml(it, k)}</div>
    </div>`;
}
function chooseHtml(it) {
    const t = tally(it.id), mine = state.mine.picks[it.id];
    const vals = [...(it.now ? ['keep'] : []), ...it.cands.map(c => String(c.k)), 'none'];
    return `<div class="choose">
        <div class="seg" role="group" aria-label="${it.id} 고르기">${vals.map(v =>
            `<button data-pick="${it.id}" data-v="${v}" aria-pressed="${mine === v}" ${state.readOnly ? 'disabled' : ''}>${LABEL(v)}</button>`).join('')}</div>
        <div class="tally" data-tally="${it.id}">${tallyHtml(t)}</div></div>
        ${state.dbOn || t.notes.length ? `<details ${state.mine.notes[it.id] ? 'open' : ''}><summary>의견${t.notes.length ? ` ${t.notes.length}` : ''}</summary>
            ${state.dbOn ? `<textarea id="note-${it.id}" data-note="${it.id}" maxlength="500" ${state.readOnly ? 'disabled' : ''} placeholder="예: 3번이 좋지만 더 짧고 묵직하게. 물소리보다 쇳소리가 어울림">${esc(state.mine.notes[it.id] || '')}</textarea>` : ''}
            <ul class="notes" data-notes="${it.id}">${notesHtml(t)}</ul></details>` : ''}`;
}
const tallyHtml = t => Object.entries(t.counts).sort((a, b) => b[1] - a[1]).map(([v, n]) => `<span>${LABEL(v)} <b>${n}</b></span>`).join('');
const notesHtml = t => t.notes.map(n => `<li><span class="n">${esc(state.names[n.uid] || '참여자')}${n.pick ? ' · ' + LABEL(n.pick) : ''}</span>${esc(n.text)}</li>`).join('');
function cardHtml(it) {
    return `<article class="card ${state.mine.picks[it.id] ? 'is-done' : ''}" data-card="${it.id}">
        <div class="top"><span class="id">${it.id}</span><span class="ko">${esc(it.ko)}</span></div>
        <div class="opts">${it.now ? optHtml(it, 0) : '<div class="opt empty">지금은 이 스킬에 소리가 없습니다</div>'}${it.cands.map(c => optHtml(it, c.k)).join('')}</div>
        ${chooseHtml(it)}
    </article>`;
}
function renderProgress() {
    const done = DATA.items.filter(i => state.mine.picks[i.id]).length;
    const agreed = DATA.items.filter(i => Object.keys(tally(i.id).counts).length).length;
    document.getElementById('progress').innerHTML = `
        <div><b>${DATA.items.length}</b><span>소리</span></div>
        <div><b>${DATA.items.reduce((n, i) => n + i.cands.length, 0)}</b><span>AI 후보</span></div>
        ${state.dbOn ? `<div><b>${done}/${DATA.items.length}</b><span>내가 고른 것</span></div>` : ''}
        <div><b>${agreed}</b><span>누군가 고른 소리</span></div>`;
}
function render() {
    stop();
    const groups = {};
    DATA.items.forEach(it => (groups[it.g] ||= []).push(it));
    document.getElementById('main').innerHTML = Object.entries(groups).map(([g, list]) =>
        `<h2>${esc(g)} <small>${list.length}</small></h2>${list.map(cardHtml).join('')}`).join('');
    renderProgress();
    requestAnimationFrame(() => document.querySelectorAll('canvas[data-id]').forEach(drawWave));
}
function patch() {
    document.querySelectorAll('[data-card]').forEach(card => {
        const id = card.dataset.card, t = tally(id), mine = state.mine.picks[id];
        card.classList.toggle('is-done', !!mine);
        card.querySelectorAll('[data-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mine)));
        card.querySelectorAll('[data-opt]').forEach(o => { const k = o.dataset.opt.split(':')[1]; o.classList.toggle('is-mine', mine === (k === '0' ? 'keep' : k)); });
        const tl = card.querySelector('[data-tally]'); if (tl) tl.innerHTML = tallyHtml(t);
        const nl = card.querySelector('[data-notes]'); if (nl) nl.innerHTML = notesHtml(t);
    });
    updateWho();
}

document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.how) play(b.dataset.id, +b.dataset.k, b.dataset.how, b);
    else if (b.dataset.pick) {
        const id = b.dataset.pick;
        if (state.mine.picks[id] === b.dataset.v) delete state.mine.picks[id]; else state.mine.picks[id] = b.dataset.v;
        save();
        patch();
    }
});
document.addEventListener('input', e => {
    const id = e.target.dataset && e.target.dataset.note;
    if (!id) return;
    if (e.target.value.trim()) state.mine.notes[id] = e.target.value.slice(0, 500); else delete state.mine.notes[id];
    clearTimeout(noteTimer);
    noteTimer = setTimeout(save, 700);
});
document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.note) { clearTimeout(noteTimer); save(); } });
window.addEventListener('resize', () => document.querySelectorAll('canvas[data-id]').forEach(drawWave));

render();
startDb();
</script>
"""

if __name__ == '__main__':
    main()
