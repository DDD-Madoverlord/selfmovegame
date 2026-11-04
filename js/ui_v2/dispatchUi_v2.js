/* ==========================================================================
   PROJECT: MAD OVERLORD // 파견 화면 (작전 지원 창 "파견" 탭, D-070)
   파견 칸마다 "파견 중" 장면: 구역 그림이 흐르고 캐릭터(리그)가 걸어가다 가끔 그 구역 적과 맞붙음
   + 남은 시간 · 진행 단계 · 예상 보상 · 파견 기록. 받으면 귀환 장면(구역 일러스트 + 승리 동작 + 보상).
   장면·기록은 보여 주기만 — 보상은 progressGrowth_v2.js collectDispatch 그대로.
   growthUi_v2.js가 탭을 그릴 때 mountDispatch, 1초마다 tickDispatch, 창을 닫을 때 unmountDispatch.
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { progress } from '../engine_v2/progress_v2.js';
import { rosterOf, ROSTER, SLOTS, partsOfCharacter } from '../engine_v2/roster_v2.js';
import { CHAPTERS } from '../engine_v2/stages_v2.js';
import { isZoneReleased, releaseDateOf } from '../engine_v2/contentSchedule_v2.js';
import { DISPATCH, gradeOf } from '../engine_v2/growth_v2.js';
import { ENEMY_TYPES } from '../engine_v2/enemies_v2.js';
import { ENEMY_ART } from '../engine_v2/enemyArt_v2.js';
import { VFX_SHEETS } from '../engine_v2/vfx/vfxPlayer.js';
import { RigAvatar, rigConfigFor, loadRigAssets } from '../engine_v2/rig/rigAvatar.js';
import { RIG_CHARACTERS } from '../engine_v2/rig/characters.js';
import { sound } from '../engine_v2/audio/sound_v2.js';

const ART = 'assets/sprites/dispatch/';
const BG = 'assets/sprites/stage/';
const SCENE_H = 176;          // 장면 높이 (px) — 전투 화면(720)의 약 0.24배라 배경 층도 같은 비율로 줄임
const GROUND_H = 30;          // 바닥 띠 높이
const FOOT_Y = SCENE_H - 15;  // 발이 놓이는 높이 (바닥 띠 가운데)
const CHAR_X = 118;           // 캐릭터 발 가운데 x
const SPEED = { far: 9, mid: 22, ground: 44 };   // 층마다 흐르는 빠르기 (px/초) — 바닥 = 걷는 빠르기
const ENEMY_K = 0.56;         // 적 그림 배율 (전투 92px → 약 52px, 캐릭터 키의 절반)
const ENEMY_WALK = 26;        // 적이 다가오는 빠르기 (바닥 흐름에 더함)
const FIGHT = { hits: 2, maxSec: 2.2, gap: [5, 10] };   // 맞붙음: 타격 2번이면 쓰러짐, 다음 적까지 5~10초

// 구역마다: 파견 일러스트(trek = 흐르는 먼 배경, 거울로 이어 붙인 32:9 띠 / back = 귀환 장면 16:9),
// 그림이 없을 때 쓰는 전투 배경 층, 장면에 나오는 적, 기록 문구
export const DISPATCH_ZONES = {
    1: {
        trek: `${ART}zone1_trek.webp`, back: `${ART}zone1_return.webp`,
        // 새 기획 구역 1 · 제14 비밀 벙커 (D-085): 전투 배경·적은 새 그림, 파견 일러스트(trek·back)는 예전 연구소 그림 그대로
        far: [`${BG}st1/far.webp`, 'brightness(0.62) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st1/mid.webp`, 'brightness(0.6) saturate(0.85)'], ground: [`${BG}st1/floor.webp`, 'brightness(0.85)'],
        enemies: ['conscript', 'riot', 'taser', 'rocket', 'hound'],
        places: ['붉은 복도', '배관 구역', '무기고', '환풍로', '격납고'],
        finds: ['불타다 남은 서버랙', '토벌군 탄약 상자', '버려진 수송 차량', '부서진 EMP 드론']
    },
    2: {
        trek: `${ART}zone2_trek.webp`, back: `${ART}zone2_return.webp`,
        // 새 기획 구역 2 · 해안 시추 단지 (D-085): 전투 배경·적은 새 그림, 파견 일러스트는 예전 그림 그대로
        far: [`${BG}st2/far.webp`, 'brightness(0.6) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st2/mid.webp`, 'brightness(0.58) saturate(0.85)'], ground: [`${BG}st2/floor.webp`, 'brightness(0.85)'],
        enemies: ['merc', 'dozer', 'harpoon', 'sawdrone', 'acidmech'],
        places: ['무너진 해안선', '시추 파이프라인', '깎여 나간 바위산', '방파제 아래', '불타는 정유 탱크'],
        finds: ['버려진 시추 장비', '용병단 보급 상자', '찌그러진 트럭', '코퍼레이션 금고']
    },
    3: {
        trek: `${ART}zone3_trek.webp`, back: `${ART}zone3_return.webp`,
        // 새 기획 구역 3 · 피로 물든 순례길 (D-085): 전투 배경·적은 새 그림, 파견 일러스트는 예전 그림 그대로
        far: [`${BG}st3/far.webp`, 'brightness(0.62) saturate(0.95)', 1280 / 715],
        mid: [`${BG}st3/mid.webp`, 'brightness(0.6) saturate(0.85)'], ground: [`${BG}st3/floor.webp`, 'brightness(0.85)'],
        enemies: ['zealot', 'holyshield', 'inquisitor', 'lightmage', 'battlepriest'],
        places: ['진홍의 순례길', '무너진 성벽', '대성당 앞 광장', '석상 회랑', '불 꺼진 시장'],
        finds: ['봉헌물 상자', '기사단 무기고', '금빛 장식함', '버려진 수레']
    },
    4: {
        trek: `${ART}zone4_trek.webp`, back: `${ART}zone4_return.webp`,
        // 새 기획 구역 4 · 살점의 요람 (D-085): 전투 배경·적은 새 그림, 파견 일러스트는 예전 그림 그대로
        far: [`${BG}st4/far.webp`, 'brightness(0.7) saturate(1)', 1280 / 715],
        mid: [`${BG}st4/mid.webp`, 'brightness(0.5) saturate(0.9)'], ground: [`${BG}st4/floor.webp`, 'brightness(0.85)'],
        enemies: ['mutant', 'boneshield', 'leechfiend', 'sporecaster', 'chimeraslime'],
        places: ['꿈틀대는 요람', '포자 숲', '유기질 기둥 사이', '심연의 틈', '빛나는 웅덩이'],
        finds: ['빛나는 변이 결정', '굳은 고치', '심연 광맥', '버려진 연구 장비']
    },
    // 새 기획 구역 5 · 해상 요새 포세이돈 (D-085): 파견 일러스트 없음 (trek·back = null) — 전투 배경 3층
    5: {
        trek: null, back: null,
        far: [`${BG}st5/far.webp`, 'brightness(0.62) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st5/mid.webp`, 'brightness(0.55) saturate(0.85)'], ground: [`${BG}st5/floor.webp`, 'brightness(0.85)'],
        enemies: ['marine', 'hatchshield', 'netgunner', 'mineman', 'toxicdiver'],
        places: ['파도치는 갑판', '닫힌 해치', '녹슨 크레인 아래', '함포 진지', '비상 격벽 통로'],
        finds: ['해군 보급 상자', '부서진 소나 드론', '녹슨 작살 더미', '사령부 금고']
    },
    // 새 기획 구역 9·10 (D-085): 파견 일러스트 없음 — 전투 배경 3층
    9: {
        trek: null, back: null,
        far: [`${BG}st9/far.webp`, 'brightness(0.62) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st9/mid.webp`, 'brightness(0.55) saturate(0.85)'], ground: [`${BG}st9/floor.webp`, 'brightness(0.85)'],
        enemies: ['thug', 'cementsprayer', 'rivetsniper', 'dynamite', 'safetywarden'],
        places: ['부서진 장벽', '시멘트 웅덩이', '앙상한 철골 아래', '불법 톨게이트', '크레인 하부'],
        finds: ['용역 보급 상자', '버려진 공구함', '추락한 헬기 잔해', '건설사 비자금 금고']
    },
    10: {
        trek: null, back: null,
        far: [`${BG}st10/far.webp`, 'brightness(0.66) saturate(0.95)', 1280 / 715],
        mid: [`${BG}st10/mid.webp`, 'brightness(0.58) saturate(0.9)'], ground: [`${BG}st10/floor.webp`, 'brightness(0.85)'],
        enemies: ['citizen', 'sonicshield', 'lasersniper', 'thug', 'enforcer'],
        places: ['거짓의 거리', '네온 전광판 아래', '방송국 로비', '케이블 통로', '송출실 복도'],
        finds: ['꺼진 수신기', '진압대 보급 상자', '홀로그램 광고판 부품', '통제국 기밀 금고']
    },
    // 새 기획 구역 8 · 노르딘 왕성 (D-085): 파견 일러스트 없음 — 전투 배경 3층
    8: {
        trek: null, back: null,
        far: [`${BG}st8/far.webp`, 'brightness(0.66) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st8/mid.webp`, 'brightness(0.58) saturate(0.85)'], ground: [`${BG}st8/floor.webp`, 'brightness(0.85)'],
        enemies: ['torch', 'furnaceshield', 'oilthrower', 'hunter', 'steambomber'],
        places: ['얼음 공원', '얼어붙은 극장 앞', '눈 덮인 왕성 회랑', '용광로 성문', '화로석 창고'],
        finds: ['꺼진 화로석', '근위대 보급 상자', '얼어붙은 공연 의상', '왕실 금고']
    },
    // 새 기획 구역 7 · 잿빛 전장 (D-085): 파견 일러스트 없음 — 전투 배경 3층
    7: {
        trek: null, back: null,
        far: [`${BG}st7/far.webp`, 'brightness(0.62) saturate(0.85)', 1280 / 715],
        mid: [`${BG}st7/mid.webp`, 'brightness(0.55) saturate(0.8)'], ground: [`${BG}st7/floor.webp`, 'brightness(0.85)'],
        enemies: ['trench', 'wireshield', 'grenadier', 'gassoldier', 'officer'],
        places: ['무너진 고아원 터', '철조망 참호선', '노란 가스 지대', '포탄 구덩이 들판', '부서진 벽돌 거리'],
        finds: ['버려진 탄약 상자', '불타다 남은 나무 인형', '야전 무전기', '포병대 보급품']
    },
    // 새 기획 구역 6 · 기적의 대병동 (D-085): 파견 일러스트 없음 (trek·back = null) — 전투 배경 3층
    6: {
        trek: null, back: null,
        far: [`${BG}st6/far.webp`, 'brightness(0.62) saturate(0.9)', 1280 / 715],
        mid: [`${BG}st6/mid.webp`, 'brightness(0.55) saturate(0.85)'], ground: [`${BG}st6/floor.webp`, 'brightness(0.85)'],
        enemies: ['orderly', 'maidenshield', 'holywater', 'anesthetist', 'bloated'],
        places: ['VIP 병동', '닫힌 병실', '소각로 앞', '수술실 회랑', '성배의 지하 제단'],
        finds: ['봉인된 약 상자', '버려진 수술 도구', '금박 수혈 팩', '귀족의 기부 금고']
    }
};
const TREK_ASPECT = 32 / 9;   // 파견 일러스트 띠 (16:9 그림 + 거울 반전 = 끊김 없이 이어짐)

// 캐릭터마다 맞붙을 때 터지는 그림 이펙트 (vfxPlayer VFX_SHEETS — 기본 공격 시트)
const HIT_SHEET = { mech: 'punch_cyan', kaiju: 'bite_green', hero: 'slash_violet', chimera: 'claw_fire',
    diver: 'water_burst', saint: 'needle_crimson', frost: 'ice_burst', doll: 'xcut_cyan', architect: 'drill_burst', broadcaster: 'sonic_pink' };

// 진행 단계 (진행률 기준) — 막대 위 눈금
const STEPS = [[0, '출발'], [0.2, '진입'], [0.45, '탐색'], [0.7, '회수'], [0.92, '귀환']];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const zoneName = z => CHAPTERS.find(ch => ch.zone === z)?.name.split('·')[1]?.trim() || '';   // 구역 번호 ≠ 챕터 순서 (구역 5 전 구역 6)
const shortZone = z => zoneName(z).split(':')[0].trim();
const clock = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const stamp = ms => { const m = Math.floor(ms / 60000); return `+${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const enemyArt = id => ENEMY_ART[id] || ENEMY_ART[ENEMY_TYPES[id]?.artAs] || null;

/** 같은 파견이면 늘 같은 기록이 나오는 난수 (mulberry32) */
function rng(seedText) {
    let a = 0;
    for (const ch of seedText) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

/** 파견 기록: [{ at(0~1), text, kind }] — 출발 · 진입 · 교전/발견/정찰/휴식 6개 · 귀환 */
export function dispatchLog(d) {
    const z = DISPATCH_ZONES[d.zone] || DISPATCH_ZONES[1];
    const r = rng(`${d.character}|${d.zone}|${d.start}`);
    const out = [{ at: 0, text: `출발 — ${shortZone(d.zone)}로 향함`, kind: 'go' },
        { at: 0.06, text: `${pick(r, z.places)} 진입`, kind: 'go' }];
    const ats = Array.from({ length: 6 }, () => 0.12 + r() * 0.76).sort((a, b) => a - b);
    for (const at of ats) {
        const k = r();
        if (k < 0.45) {
            const e = ENEMY_TYPES[pick(r, z.enemies)];
            out.push({ at, text: `${e ? e.name : '적'} ${2 + Math.floor(r() * 4)}명과 교전 — 격퇴`, kind: 'fight' });
        } else if (k < 0.7) out.push({ at, text: `${pick(r, z.finds)} 발견 — 쓸 만한 것을 챙김`, kind: 'find' });
        else if (k < 0.9) out.push({ at, text: `${pick(r, z.places)} 정찰`, kind: 'scout' });
        else out.push({ at, text: '잠시 숨을 고름', kind: 'rest' });
    }
    out.push({ at: 0.92, text: '귀환 시작', kind: 'go' }, { at: 1, text: '귀환 완료 — 보상 확인 대기', kind: 'done' });
    return out;
}

/** 그 캐릭터가 마지막으로 낀 파츠 (선택창과 같음) → 리그 그림 설정. 빈 부위는 기본 파츠 모습 (선택창처럼 흐리게 두지 않음) */
function rigLook(character) {
    const ids = progress.loadoutFor(character);
    const parts = {};
    for (const slot of SLOTS) {
        parts[slot] = ids[slot] && ids[slot] !== 'none' ? gameState.getPartById(slot, ids[slot]) : partsOfCharacter(character, slot)[0];
    }
    return rigConfigFor(parts, character);
}

function makeRig(canvas, character, opts) {
    const rig = new RigAvatar(canvas, { character, shadow: true, ...opts });
    const look = rigLook(character);
    if (look) {
        if (look.arm) rig.setArm(look.arm);
        rig.setPartFilters(look.filters);
        rig.setVariants(look.variants);
        rig.setUpgrades(look.upgrades);
    }
    return rig;
}

// ---- 상태 ----
let host = null;              // 지금 붙은 탭 몸통 (.v2-growth__body)
const scenes = new Map();     // `${character}:${start}` → 장면
let rafId = null, lastT = 0;
let pickedZone = null, pickedChar = null;
let back = null;              // 귀환 장면 { el, rig }

// ---- 파견 중 장면 ----
class Scene {
    constructor(d) {
        this.key = `${d.character}:${d.start}`;
        this.d = d;
        this.zone = DISPATCH_ZONES[d.zone] || DISPATCH_ZONES[1];
        this.log = dispatchLog(d);
        this.shown = -1;
        const r = rosterOf(d.character);
        const el = this.el = document.createElement('article');
        el.className = 'v2-dsp';
        el.style.setProperty('--sk', r ? r.color : '#888');
        el.dataset.char = d.character;
        const z = this.zone;
        el.innerHTML = `
            <div class="v2-dsp__scene">
                <div class="v2-dsp__far"></div>
                <div class="v2-dsp__mid" style="background-image:url('${z.mid[0]}');filter:${z.mid[1]}"></div>
                <div class="v2-dsp__ground" style="background-image:url('${z.ground[0]}');filter:${z.ground[1]}"></div>
                <div class="v2-dsp__actors"><canvas class="v2-dsp__rig"></canvas></div>
                <div class="v2-dsp__place"><b>구역 ${d.zone}</b><span></span></div>
                <div class="v2-dsp__alert">교전!</div>
                <div class="v2-dsp__home"><b>귀환 완료</b><small>보상을 받으세요</small></div>
            </div>
            <div class="v2-dsp__info">
                <header><div><b>${esc(r ? r.faction : d.character)}</b><small>${esc(zoneName(d.zone))}</small></div>
                    <div class="v2-dsp__time"><strong></strong><small></small></div></header>
                <div class="v2-dsp__steps"><div class="v2-dsp__bar"><i></i></div>
                    <ol>${STEPS.map(([at, label]) => `<li style="left:${at * 100}%" data-at="${at}"><span>${label}</span></li>`).join('')}</ol></div>
                <ul class="v2-dsp__reward">${rewardHtml(d.zone)}</ul>
                <ol class="v2-dsp__log"></ol>
                <div class="v2-dsp__act"></div>
            </div>`;
        this.sceneEl = el.querySelector('.v2-dsp__scene');
        this.layers = ['far', 'mid', 'ground'].map(n => ({ n, el: el.querySelector(`.v2-dsp__${n}`), x: 0, w: 0 }));
        this.actors = el.querySelector('.v2-dsp__actors');
        this._setFar();
        this.rig = makeRig(el.querySelector('.v2-dsp__rig'), d.character,
            { width: 200, height: SCENE_H, rootX: 100, rootY: FOOT_Y, scale: 0.3, fit: { x: 10, y: 8 } });
        this.rig.ready.then(() => { if (this.rig) this.rig.start(); });
        this.enemy = null;
        this.fx = [];
        this.wait = 1.5 + Math.random() * 3;   // 첫 적까지
        this.fighting = false;
        this.done = null;
        this.update(Date.now(), true);
    }

    // 배경: 파견 일러스트(띠)가 있으면 그 한 장이 걷는 빠르기로 흐름 (그림 속 바닥을 밟고 감 — 중간 층·바닥 띠는 숨김),
    // 없으면 전투 배경 3층 (구역 3·4는 색조)
    _setFar() {
        const [far, mid, ground] = this.layers, z = this.zone;
        const img = new Image();
        img.onload = () => {
            far.el.style.backgroundImage = `url('${z.trek}')`;
            far.el.style.filter = 'none';
            far.w = SCENE_H * TREK_ASPECT;
            far.speed = SPEED.ground;
            far.el.style.backgroundSize = `${far.w}px ${SCENE_H}px`;
            for (const l of [mid, ground]) { l.w = 0; l.el.style.display = 'none'; }
        };
        if (z.trek) img.src = z.trek;
        far.el.style.backgroundImage = `url('${z.far[0]}')`;
        far.el.style.filter = z.far[1];
        far.w = SCENE_H * z.far[2];
        far.el.style.backgroundSize = `${far.w}px ${SCENE_H}px`;
        this.layers[1].w = (SCENE_H - 20) * (640 / 358);
        this.layers[2].w = GROUND_H * (256 / 76);
    }

    /** 1초마다: 시간·막대·단계·기록·받기 버튼. 끝남이 바뀌면 true */
    update(now, first = false) {
        const d = this.d, left = d.end - now, done = left <= 0;
        const p = Math.max(0, Math.min(1, (now - d.start) / (d.end - d.start)));
        const el = this.el;
        el.querySelector('.v2-dsp__time strong').textContent = done ? '귀환 완료' : clock(left);
        el.querySelector('.v2-dsp__time small').textContent = done ? '' : '남음';
        el.querySelector('.v2-dsp__bar i').style.width = `${p * 100}%`;
        el.querySelectorAll('.v2-dsp__steps li').forEach(li => li.classList.toggle('is-on', p >= Number(li.dataset.at)));
        const seen = this.log.filter(e => e.at <= p);
        if (seen.length !== this.shown) {
            this.shown = seen.length;
            el.querySelector('.v2-dsp__log').innerHTML = seen.slice(-3).reverse().map(e =>
                `<li class="is-${e.kind}"><time>${stamp(e.at * (d.end - d.start))}</time>${esc(e.text)}</li>`).join('');
            const place = [...seen].reverse().find(e => e.kind === 'go' && e.at > 0 && e.at < 0.9);
            el.querySelector('.v2-dsp__place span').textContent = place ? place.text.replace(/ 진입$/, '') : shortZone(d.zone);
        }
        const changed = !first && done !== this.done;
        if (done !== this.done) {
            this.done = done;
            el.classList.toggle('is-done', done);
            const i = progress.dispatch.indexOf(d);
            el.querySelector('.v2-dsp__act').innerHTML = done ? `<button data-act="collect" data-index="${i}">보상 받기</button>` : '';
            if (done) this._finish();
        }
        return changed;
    }

    _finish() {
        if (this.enemy) { this.enemy.el.remove(); this.enemy = null; }
        this.fighting = false;
        this.sceneEl.classList.remove('is-fight');
        if (this.rig) this.rig.setMode('victory');
    }

    /** 화면 프레임: 배경 흐름 · 적 다가옴 · 맞붙음 · 이펙트 */
    frame(dt) {
        if (!this.rig) return;
        const moving = !this.done && !this.fighting;
        if (moving) {
            for (const l of this.layers) {
                if (!l.w) continue;
                l.x = (l.x - (l.speed || SPEED[l.n]) * dt) % l.w;
                l.el.style.backgroundPositionX = `${l.x.toFixed(1)}px`;
            }
            if (this.rig.mode !== 'walk') this.rig.setMode('walk');
        }
        if (!this.done) this._enemyFrame(dt);
        this._fxFrame(dt);
    }

    _enemyFrame(dt) {
        const e = this.enemy;
        if (!e) {
            this.wait -= dt;
            if (this.wait <= 0) this._spawn();
            return;
        }
        e.t += dt;
        const clip = e.state === 'fight' ? (e.art.attack || e.art.walk) : e.art.walk;
        const frame = Math.floor((e.t / clip.duration) * clip.frames) % clip.frames;
        if (e.clip !== clip) { e.clip = clip; e.sprite.style.backgroundImage = `url('${clip.src}')`; }
        e.sprite.style.backgroundPositionX = `${-frame * e.art.frameWidth}px`;
        if (e.state === 'walk') {
            e.x -= (ENEMY_WALK + SPEED.ground) * dt;
            if (e.x <= this.reach) {
                e.state = 'fight'; e.t = 0; e.fightT = 0;
                this.fighting = true;
                this.sceneEl.classList.add('is-fight');
                this.rig.consumeHit();
                this.rig.setMode('attack');
            }
        } else if (e.state === 'fight') {
            e.fightT += dt;
            const hits = this.rig.consumeHit();
            if (hits) this._hit(e);
            if (e.hits >= FIGHT.hits || e.fightT >= FIGHT.maxSec) this._defeat(e);
        } else if (e.state === 'fall') {
            e.x -= SPEED.ground * dt;
            if (e.t > 0.7) { e.el.remove(); this.enemy = null; this.wait = FIGHT.gap[0] + Math.random() * (FIGHT.gap[1] - FIGHT.gap[0]); }
        }
        e.el.style.transform = `translateX(${e.x.toFixed(1)}px)`;
    }

    _spawn() {
        const id = pick(Math.random, this.zone.enemies);
        const art = enemyArt(id);
        if (!art) { this.wait = 3; return; }
        const el = document.createElement('div');
        el.className = 'v2-dsp__enemy';
        const tint = ENEMY_TYPES[id]?.tint;
        el.innerHTML = `<i style="width:${art.frameWidth}px;height:${art.frameHeight}px;left:${-art.anchorX}px;transform-origin:${art.anchorX}px 100%;`
            + `background-image:url('${art.walk.src}');${tint ? `filter:${tint};` : ''}"></i>`;
        el.style.setProperty('--k', ENEMY_K);
        this.actors.appendChild(el);
        const sceneW = this.sceneEl.clientWidth || 540;
        // 캐릭터 앞 끝 + 적 발에서 앞 끝까지만큼 떨어져 멈춤 (리그 크기는 캐릭터마다 다름)
        const b = this.rig.bounds, s = this.rig.scale || 0.3;
        const front = b ? CHAR_X - 100 + this.rig.rootX + b.maxX * s : CHAR_X + 50;
        this.reach = front + 4 + art.anchorX * ENEMY_K * 0.8;
        this.enemy = { el, sprite: el.firstChild, art, state: 'walk', x: sceneW + 40, t: 0, hits: 0, clip: art.walk };
    }

    _hit(e) {
        e.hits++;
        this._playFx(HIT_SHEET[this.d.character] || 'punch_cyan', e.x + 4, FOOT_Y - 30, 92, 'plus-lighter');
        e.el.classList.remove('is-hit');
        void e.el.offsetWidth;
        e.el.classList.add('is-hit');
    }

    _defeat(e) {
        e.state = 'fall'; e.t = 0;
        e.el.classList.add('is-fall');
        this._playFx('defeat_puff', e.x, FOOT_Y - 26, 80, 'normal');
        const pop = document.createElement('b');
        pop.className = 'v2-dsp__pop';
        pop.textContent = '격퇴!';
        pop.style.left = `${e.x}px`;
        this.actors.appendChild(pop);
        setTimeout(() => pop.remove(), 900);
        this.fighting = false;
        this.sceneEl.classList.remove('is-fight');
        this.rig.setMode('walk');
    }

    // 그림 프레임 이펙트 한 번 (vfxPlayer 시트 = 정사각 프레임 가로 띠)
    _playFx(sheet, x, y, size, blend) {
        const s = VFX_SHEETS[sheet];
        if (!s) return;
        const el = document.createElement('i');
        el.className = 'v2-dsp__fx';
        el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;`
            + `background-image:url('${s.src}');background-size:${size * s.frames}px ${size}px;mix-blend-mode:${blend}`;
        this.actors.appendChild(el);
        this.fx.push({ el, t: 0, frames: s.frames, size, dur: 0.5 });
    }

    _fxFrame(dt) {
        this.fx = this.fx.filter(f => {
            f.t += dt;
            const i = Math.floor((f.t / f.dur) * f.frames);
            if (i >= f.frames) { f.el.remove(); return false; }
            f.el.style.backgroundPositionX = `${-i * f.size}px`;
            return true;
        });
    }

    destroy() {
        if (this.rig) this.rig.stop();
        this.rig = null;
        this.el.remove();
    }
}

function rewardHtml(zone) {
    const r = DISPATCH.reward(zone);
    return `<li class="is-dm"><b>${r.dm.toLocaleString()}</b><small>DM</small></li>`
        + `<li class="is-shard"><b>${r.shards}</b><small>조각</small></li>`
        + `<li class="is-core"><b>${r.cores}</b><small>코어</small></li>`
        + `<li class="is-part"><b>${Math.round(r.partChance * 100)}%</b><small>파츠</small></li>`;
}

// ---- 새 파견 ----
function newHtml() {
    const zones = progress.dispatchZones();
    const slots = progress.dispatchSlots();
    const free = slots - progress.dispatch.length;
    const cands = ROSTER.filter(c => !progress.dispatchReason(c.id));
    if (!zones.includes(pickedZone)) pickedZone = zones[zones.length - 1] ?? null;
    if (!cands.some(c => c.id === pickedChar)) pickedChar = cands[0]?.id ?? null;
    const hours = progress.dispatchMs() / 3600000;
    const zoneCards = CHAPTERS.map(ch => {
        const z = DISPATCH_ZONES[ch.zone], open = zones.includes(ch.zone);
        const soon = !isZoneReleased(ch.zone);
        // 썸네일: 전투 먼 배경(색조) 위에 파견 일러스트 (일러스트가 없으면 아래 것이 보임)
        return `<button class="v2-dsp-zone${open ? '' : ' is-lock'}${soon ? ' is-coming-soon' : ''}${ch.zone === pickedZone ? ' is-pick' : ''}" data-act="dspZone" data-zone="${ch.zone}" aria-pressed="${ch.zone === pickedZone}" ${open ? '' : 'disabled'}>
            <i style="background-image:url('${z.far[0]}');filter:${z.far[1]}"></i>${z.trek ? `<i style="background-image:url('${z.trek}')"></i>` : ''}<b>구역 ${ch.zone}</b><small>${soon ? `곧 공개 · ${releaseDateOf('zones', ch.zone)}` : open ? esc(shortZone(ch.zone)) : '보스전(노말)을 깨면 열림'}</small><span class="v2-dsp-choice" aria-hidden="true">✓ 선택</span></button>`;
    }).join('');
    const chars = !cands.length ? '<p class="v2-growth__hint">보낼 캐릭터가 없어요 — 해금하고 파츠 4부위를 보유한 캐릭터 중 출전·파견 중이 아닌 캐릭터만 보낼 수 있어요.</p>'
        : cands.map(c => `<button class="v2-dsp-char${c.id === pickedChar ? ' is-pick' : ''}" data-act="dspChar" data-char="${c.id}" aria-pressed="${c.id === pickedChar}" style="--sk:${c.color}">
            <img data-head="${c.id}" alt=""><b>${esc(c.faction)}</b><span class="v2-dsp-choice" aria-hidden="true">✓ 선택</span></button>`).join('');
    const ex = pickedZone ? DISPATCH.reward(pickedZone) : null;
    const can = free > 0 && pickedZone && pickedChar;
    return `<section class="v2-dsp-new">
        <h3>새 파견 <small>빈 칸 ${Math.max(0, free)} / ${slots} · ${Number.isInteger(hours) ? hours : hours.toFixed(1)}시간 (연구로 단축) · 하드·헬을 열면 칸이 늘어남</small></h3>
        ${zones.length ? `<div class="v2-dsp-zones">${zoneCards}</div><div class="v2-dsp-chars">${chars}</div>
        <div class="v2-dsp-go">${ex ? `<span>예상 보상</span><ul class="v2-dsp__reward">${rewardHtml(pickedZone)}</ul>` : ''}
            <button data-act="dispatch" data-char="${pickedChar || ''}" data-zone="${pickedZone || ''}" ${can ? '' : 'disabled'}>파견 보내기</button></div>
        <p class="v2-growth__hint">파츠는 30% 확률로 그 캐릭터 것 (레어 이하). 기록·장면은 연출이고 보상은 구역으로 정해져요.</p>`
        : `${CHAPTERS.some(ch => !isZoneReleased(ch.zone)) ? `<div class="v2-dsp-zones">${zoneCards}</div>` : ''}<p class="v2-growth__hint">노말에서 구역 보스전(1-B)을 깨면 그 구역에 파견할 수 있어요.</p>`}
    </section>`;
}

// 캐릭터 버튼 얼굴: 리그 머리 그림
function fillHeads(root) {
    root.querySelectorAll('img[data-head]').forEach(img => {
        const c = RIG_CHARACTERS[img.dataset.head];
        if (!c) return;
        loadRigAssets(c).then(({ images }) => { if (images.head) img.src = images.head.src; }).catch(() => {});
    });
}

// ---- 귀환 장면 ----
export function showReturn(r) {
    closeReturn();
    const z = DISPATCH_ZONES[r.zone] || DISPATCH_ZONES[1];
    const ro = rosterOf(r.character);
    const el = document.createElement('div');
    el.className = 'v2-dsp-back';
    el.style.setProperty('--sk', ro ? ro.color : '#888');
    const g = r.part ? gradeOf(r.part.grade) : null;
    const rows = [[`+${r.dm.toLocaleString()}`, 'DM', 'is-dm'], [`+${r.shards}`, '파츠 조각', 'is-shard'], [`+${r.cores}`, '스킬 코어', 'is-core']];
    if (r.part) rows.push([esc(r.part.name), `${g.name} 파츠 ${r.part.type === 'refund' ? '(이미 있어 조각으로 환급)' : '획득'}`, 'is-part']);
    el.innerHTML = `<div class="v2-dsp-back__art" style="background-image:${z.back ? `url('${z.back}'), ` : ''}url('${z.far[0]}')"></div>
        <canvas class="v2-dsp-back__rig"></canvas>
        <div class="v2-dsp-back__card">
            <h3>귀환 완료</h3><p><b>${esc(ro ? ro.faction : r.character)}</b> · 구역 ${r.zone} ${esc(shortZone(r.zone))}</p>
            <ul>${rows.map(([v, k, cls], i) => `<li class="${cls}" style="animation-delay:${0.25 + i * 0.18}s${cls === 'is-part' && g ? `;--grade:${g.color}` : ''}"><b>${v}</b><small>${k}</small></li>`).join('')}</ul>
            <button data-act="dspClose">확인</button>
        </div>`;
    const rig = makeRig(el.querySelector('canvas'), r.character, { width: 340, height: 300, rootX: 170, rootY: 282, scale: 0.42, fit: { x: 14, y: 10 } });
    rig.ready.then(() => { if (back && back.rig === rig) { rig.setMode('victory'); rig.start(); } });
    back = { el, rig };
    sound.play('ui_equip');
    attachReturn();
}

function attachReturn() {
    const box = host && host.closest('.v2-growth__box');
    if (back && box && back.el.parentNode !== box) box.appendChild(back.el);
}

export function closeReturn() {
    if (!back) return;
    back.rig.stop();
    back.el.remove();
    back = null;
}

// ---- growthUi_v2.js와 잇는 곳 ----
/** 탭 몸통에 파견 화면을 그림 (진행 중 장면은 다시 쓰고 새 파견 칸만 새로) */
export function mountDispatch(body) {
    host = body;
    const live = new Set(progress.dispatch.map(d => `${d.character}:${d.start}`));
    for (const [key, s] of scenes) if (!live.has(key)) { s.destroy(); scenes.delete(key); }
    body.innerHTML = `<div class="v2-dsp-list"></div>${newHtml()}`;
    const list = body.querySelector('.v2-dsp-list');
    progress.dispatch.forEach(d => {
        const key = `${d.character}:${d.start}`;
        let s = scenes.get(key);
        if (!s) scenes.set(key, (s = new Scene(d)));
        else { s.d = d; s.done = null; s.update(Date.now(), true); }
        list.appendChild(s.el);
    });
    const free = progress.dispatchSlots() - progress.dispatch.length;
    for (let i = 0; i < free; i++) list.insertAdjacentHTML('beforeend', '<div class="v2-dsp v2-dsp--empty"><span>빈 파견 칸</span></div>');
    fillHeads(body);
    attachReturn();
    if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(loop); }
}

/** 1초마다 (작전 지원 창 타이머): 끝난 파견이 생기면 true → 탭을 다시 그림 */
export function tickDispatch(now = Date.now()) {
    let changed = false;
    for (const s of scenes.values()) if (s.update(now)) changed = true;
    return changed;
}

/** 탭을 떠나거나 창을 닫을 때: 리그·화면 루프 멈춤 */
export function unmountDispatch() {
    for (const s of scenes.values()) s.destroy();
    scenes.clear();
    closeReturn();
    host = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
}

/** 파견 탭 안의 버튼 (구역·캐릭터 고르기, 귀환 장면 닫기). 다시 그려야 하면 true */
export function dispatchAct(name, d) {
    if (name === 'dspZone') { pickedZone = Number(d.zone); sound.play('ui_tab'); return true; }
    if (name === 'dspChar') { pickedChar = d.char; sound.play('ui_tab'); return true; }
    if (name === 'dspClose') { closeReturn(); sound.play('ui_click'); return false; }
    return false;
}

function loop(now) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));   // 음수 막기 (Android WebView 첫 프레임)
    lastT = now;
    if (!host || !host.isConnected) { rafId = null; return; }
    for (const s of scenes.values()) s.frame(dt);
    rafId = requestAnimationFrame(loop);
}
