/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 연출 (v2)
   전투 엔진(battle_v2.js)이 알맞은 순간에 부르는 화면 연출을 모았다. 전투 규칙은 건드리지 않는다.
   - intro()          : 출격 인트로 (레터박스 + 작전명 카드 + SORTIE!) → HUD 등장
   - warning(kind)    : 거점 출현 경고 (붉은 테두리 + 경고 줄무늬 + WARNING / DANGER)
   - bossCard(t, sub) : 보스 등장 카드 (BOSS + 이름 + 주요 기술, 짧은 느린 화면 + 흔들림, 2026-10-24)
   - ultCutIn(...)    : 필살기 컷인 (화면 어둡게 + 집중선 + 사선 띠 초상화) + 슬로모션
   - baseDestroyed()  : 거점 파괴 (연쇄 폭발 → 대폭발, 흔들림, 섬광, 슬로모션, 별 획득)
   - overload(sec)    : 내구도 0 → 과부하 (붉은 섬광, OVERLOAD 문구, 긴급 수리 중 깜빡임)
   - timeOver()       : 제한 시간 초과 (기체 정지, TIME OVER) → 결과 화면
   - playerDown()     : 캐릭터가 쓰러짐 — 목숨을 다 쓰고 또 쓰러지면 (11-05 피드백 21번, battle_v2.js loseLives)
   - showResult()     : 승리/패배 결과 화면 (별 도장, 전투 기록, 보상 카운트업, 다음 행동 버튼, 패배면 원인·할 일 — runReport.js)
   - setLowHp(on)     : 체력 30% 미만 화면 가장자리 붉은 경고
   효과음: sfx(이름) → 사운드 매니저(audio/sound_v2.js). 저체력 심장 박동은 반복 재생.
   화면 흔들림은 설정(settings_v2.js의 shake)을 따른다.
   ========================================================================== */

import { icon } from './icons.js';
import { gameTime } from '../engine_v2/gameTime.js';
import { monsterControllerV2 } from '../engine_v2/monster_v2.js';
import { BATTLE_VFX } from '../engine_v2/vfx/vfxDefs.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { settings } from '../engine_v2/settings_v2.js';

import { chapterOf } from '../engine_v2/stages_v2.js';
import { difficultyOf, difficultyOfStage } from '../engine_v2/difficulty_v2.js';
import { gradeOf, OPTIONS, MUTATORS } from '../engine_v2/growth_v2.js';
import { setOf, setLabelOf } from '../engine_v2/sets_v2.js';
import { petOf } from '../engine_v2/pets_v2.js';
import { rosterOf } from '../engine_v2/roster_v2.js';
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ');
/** 스페셜맵 결과 (D-123) — 제목과 보상 한 줄 */
const specialTitle = r => r.special.mode === 'boss' ? (r.victory ? 'BOSS DOWN' : 'BOSS RUSH FAILED') : `GRADE ${r.special.grade}`;
function specialHtml(r) {
    const s = r.special;
    if (s.mode === 'boss') {
        return s.victory
            ? `<p class="v2-result__special">보스 러시 <b>${s.step}단계</b> 돌파${s.first ? ' (처음)' : ''} · 승급석 +${s.stones} · 스킬 코어 +${s.cores}${s.shards ? ` · 조각 +${s.shards}` : ''} · DM +${s.dm.toLocaleString()}</p>`
            : `<p class="v2-result__special">보스 러시 <b>${s.step}단계</b> 실패 — 강해져서 다시 도전하세요 (단계는 그대로)</p>`;
    }
    return `<p class="v2-result__special">점수 <b>${s.score.toLocaleString()}</b> · 물체 ${s.broken}개 · 등급 <b>${s.grade}</b> · 조각 +${s.shards} · DM +${s.dm.toLocaleString()}${s.newBest ? ' · <em>이번 주 최고!</em>' : ` · 이번 주 최고 ${s.best.toLocaleString()}`}</p>`;
}


// 별 3개 조건 (D-029): 요새 / 최종 기지 / 목표 시간 안에 클리어
const starLabels = stage => ['중간 요새', '최종 기지', `${stage.starTime}초 안에`];
// 전리품 (Q-006): 파츠 드랍(새로 얻음·등급 상승·중복 환급) + 스킬 코어
const lootHtml = loot => {
    if (!loot || (!loot.drop && !loot.cores)) return '';
    const d = loot.drop;
    let card = '';
    if (d && d.type === 'shards') {   // 판 클리어 드랍 = 공용 파츠 조각 (11-05 피드백 23번)
        const g = gradeOf(d.grade);
        card = `<div class="v2-loot__part is-shards" style="--grade:${g.color}">
            <small>판 클리어 드랍 · ${g.name} 등급</small><b>${icon('shard', 18)} 파츠 조각 +${d.shards}</b>
            <span>연구소 [만들기] · 등급 올리기에 씀 (보유 ${loot.shards})</span></div>`;
    } else if (d) {
        const g = gradeOf(d.grade);
        const what = d.type === 'new' ? 'NEW 파츠' : d.type === 'upgrade' ? `등급 상승 (${gradeOf(d.prev).name} → ${g.name})` : '중복 — 환급';
        const opts = d.options.map(o => OPTIONS[o] ? `<li>${OPTIONS[o].name} · ${OPTIONS[o].desc}</li>` : '').join('');
        card = `<div class="v2-loot__part is-${d.type}" style="--grade:${g.color}">
            <small>${what}${d.sure ? ' · 보스전 첫 클리어' : ''}</small><b>${d.name}</b><em>${g.name}${setOf(d.id) ? ` · ${setLabelOf(setOf(d.id))}` : ''}</em>
            ${d.type === 'refund' ? `<span>+${d.dm.toLocaleString()} DM · 파츠 조각 +${d.shards}</span>` : opts ? `<ul>${opts}</ul>` : ''}</div>`;
    }
    const cores = loot.cores ? `<div class="v2-loot__chip">${icon('gem', 14)} 스킬 코어 +${loot.cores}</div>` : '';
    return `<div class="v2-result__loot">${card}${cores}</div>`;
};
// 노말이 아니면 작전 카드·결과 화면에 난이도 표시 (D-063)
const diffTag = stage => {
    const d = difficultyOf(difficultyOfStage(stage));
    const mut = stage.mutator && MUTATORS[stage.mutator];   // 나이트메어 전장 변이 (Q-006)
    return d.id === 'normal' ? '' : ` · <span class="v2-diffbadge" style="--diff:${d.color}">${d.name}</span>${mut ? ` · 변이: ${mut.name}` : ''}`;
};
const clock = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
// 패배 원인 (runReport.js): 구간 막대(가장 오래 걸린 구간 강조) + 원인 한 줄 + 할 일
const reportHtml = rep => {
    if (!rep) return '<p class="v2-result__tip">연구소에서 파츠를 사거나 강화해 더 빨리 부순 뒤 다시 도전하세요.</p>';
    const total = rep.segments.reduce((a, s) => a + s.sec, 0) || 1;
    const bar = rep.segments.map((s, i) => {
        const k = s.sec / total;
        return `<i class="is-${s.key}${i === rep.longest ? ' is-long' : ''}${k < 0.13 ? ' is-thin' : ''}" style="flex:${k.toFixed(3)}">`
            + `<b>${s.label}</b><span>${clock(s.sec)}</span></i>`;
    }).join('');
    return `<div class="v2-result__why">
        <p class="v2-result__cause">패배 원인 · <b>${rep.cause.text}</b></p>
        <div class="v2-why-bar">${bar}</div>
        <ul class="v2-result__tips">${rep.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
};
// 보스 등장 카드의 주요 기술 (enemies_v2.js 보스)
const BOSS_SKILLS = {
    guardian: '방패 강타 · 심판의 일격 · 결계',
    scrapking: '자석 끌어당기기 · 고철 낙하',
    archbishop: '천상의 심판 · 악마병 소환 · 심연의 문',
    oculus: '심연의 파동 · 유전자 붕괴 · 극한의 변이',
    orbian: '단죄의 빛 · 생명의 저울 · 파문의 종',
    // 새 기획 (D-085)
    wmdalpha: '플라스마 레이저 · 집게 팔 내려치기',
    terraformer: '대지 분쇄 (파일벙커) · 집게 크레인',
    benedict: '신성한 심판 · 숨겨진 마성 · 지옥문',
    ironclad: '심해 압축포 · 폭뢰 융단폭격',
    grailheart: '핏빛 파동 · 혈정석 쐐기 · 생명력 착취',
    behemoth: '철갑탄 직사 · 백린 소이탄 · 궤도 톱니 돌진',
    vladimir: '화룡의 숨결 · 잿더미 유성우 · 온기 강탈',
    panopticon: '철골 분쇄 · H빔 투하 · 부실의 대가',
    mothervoice: '주파수 폭발 · 거짓의 메아리 · 통제 레이저'
};
const INTRO_MS = { card: 150, sortie: 1750, reveal: 2150, end: 2700 };
const FB = 58;   // 지면 높이 (bottom px)

const wait = ms => new Promise(r => setTimeout(r, ms));

export class BattleDirector {
    constructor(engine) {
        this.b = engine;
        this.frame = null;
        this.onSfx = name => sound.play(name);
        this.token = 0;         // 전투가 다시 시작되면 진행 중인 연출(대기 중 타이머)을 무효화
    }

    sfx(name) {
        if (this.onSfx) this.onSfx(name);
    }

    attach() {
        this.frame = document.querySelector('#screen-battle-v2 .v2-battle');
        this.viewport = document.getElementById('battle-viewport-v2');
        if (!this.frame) return false;
        if (!this.vignette) {
            this.vignette = document.createElement('div');
            this.vignette.className = 'v2-vignette';
            this.frame.appendChild(this.vignette);
        }
        return true;
    }

    /** 전투 시작/재시작: 이전 전투의 연출을 모두 걷어냄 */
    clear() {
        if (!this.attach()) return;
        this.token += 1;
        this.frame.querySelectorAll('.v2-fx-layer').forEach(n => n.remove());
        document.querySelectorAll('#screen-battle-v2 .v2-coach').forEach(n => n.remove());   // 첫 출격 안내 말풍선 (coach_v2.js)
        this.frame.classList.remove('v2-intro', 'v2-lowhp', 'v2-alert', 'v2-ending', 'v2-gas');
        this.lowHp = false;
        sound.stopLoop('low_hp', 0.1);
        const canvas = document.getElementById('player-sprite-canvas-v2');
        if (canvas) canvas.classList.remove('v2-down');
        monsterControllerV2.freezeRig(false);
    }

    layer(cls, html = '') {
        const el = document.createElement('div');
        el.className = `v2-fx-layer ${cls}`;
        el.innerHTML = html;
        this.frame.appendChild(el);
        return el;
    }

    alive(token) {
        return token === this.token;
    }

    // ------------------------------------------------------------------
    /** 출격 인트로: 레터박스 + 작전명 → SORTIE! → HUD 등장. 클릭하면 건너뜀 */
    async intro(stage) {
        this.stage = stage;
        if (!this.attach()) return;
        const token = this.token;
        this.frame.classList.add('v2-intro');
        const bars = this.layer('v2-letterbox', '<i></i><i></i>');
        const card = this.layer('v2-opcard', `
            <div class="v2-opcard__inner">
                <small>STAGE ${stage.id} · ${chapterOf(stage).name}${diffTag(stage)}</small>
                <h2>${stage.id}<span>//</span>${stage.name}</h2>
                <p>${icon(stage.boss ? 'hq' : 'fort', 14)} ${stage.desc}</p>
                <div class="v2-hazard v2-opcard__stripe"></div>
            </div>`);
        let skipped = false;
        const skip = () => { skipped = true; };
        this.frame.addEventListener('pointerdown', skip, { once: true });
        this.sfx('intro_whoosh');

        const until = async ms => {
            const start = performance.now();
            while (!skipped && performance.now() - start < ms) await wait(30);
        };
        await until(INTRO_MS.card);
        if (!this.alive(token)) return;
        card.classList.add('is-in');
        await until(INTRO_MS.sortie - INTRO_MS.card);
        if (!this.alive(token)) return;
        card.classList.add('is-out');
        const sortie = this.layer('v2-stamp v2-stamp--sortie', '<strong>SORTIE!</strong><small>출격</small>');
        this.sfx('intro_sortie');
        await until(INTRO_MS.reveal - INTRO_MS.sortie);
        if (!this.alive(token)) return;
        this.frame.classList.remove('v2-intro');
        bars.classList.add('is-out');
        await wait(skipped ? 0 : INTRO_MS.end - INTRO_MS.reveal);
        this.frame.removeEventListener('pointerdown', skip);
        [bars, card, sortie].forEach(n => n.remove());
    }

    // ------------------------------------------------------------------
    /** 거점 출현 경고. kind: 'mid' | 'final', sub: 아래 문구(없으면 기본) */
    async warning(kind, sub = null) {
        if (!this.attach()) return;
        const token = this.token;
        const final = kind === 'final';
        const el = this.layer(`v2-warning${final ? ' is-final' : ''}`, `
            <div class="v2-warning__band">
                <div class="v2-warning__stripe"></div>
                <div class="v2-warning__body">
                    <strong data-text="${final ? 'DANGER' : 'WARNING'}">${final ? 'DANGER' : 'WARNING'}</strong>
                    <span>${sub || (final ? '최종 핵심 기지 출현 — 진격하여 분쇄하라' : '중간 거점 요새 출현 — 돌격하여 분쇄하라')}</span>
                </div>
                <div class="v2-warning__stripe"></div>
            </div>`);
        this.frame.classList.add('v2-alert');
        this.sfx(final ? 'warning_danger' : 'warning');
        await wait(2300);
        if (!this.alive(token)) return;
        this.frame.classList.remove('v2-alert');
        el.classList.add('is-out');
        await wait(300);
        el.remove();
    }

    /** 보스 등장 카드: BOSS + 이름 + 주요 기술 + sub(승리 조건), 0.9초 느린 화면 + 흔들림. unit = 적 종류 이름 */
    async bossCard(unit, t, sub) {
        if (!this.attach()) return;
        const token = this.token;
        const el = this.layer('v2-bosscard', `
            <div class="v2-bosscard__band">
                <small>BOSS</small>
                <strong>${t.name}</strong>
                ${BOSS_SKILLS[unit] ? `<em>${BOSS_SKILLS[unit]}</em>` : ''}
                <span>${sub || ''}</span>
            </div>`);
        this.frame.classList.add('v2-alert');
        this.sfx('warning_danger');
        this.shake(10, 500);
        gameTime.slowMo(0.35, 0.9);
        await wait(2600);
        if (!this.alive(token)) return;
        this.frame.classList.remove('v2-alert');
        el.classList.add('is-out');
        await wait(350);
        el.remove();
    }

    /** 짧은 경보 (보스전 EMP 포격 예고): 위쪽 붉은 띠 + 남은 시간 */
    async alarm(title, sub, sec) {
        if (!this.attach()) return;
        const token = this.token;
        const el = this.layer('v2-alarm', `<strong>⚠ ${title}</strong><span>${sub}</span><i></i>`);
        el.style.setProperty('--sec', `${sec}s`);
        this.frame.classList.add('v2-alert');
        this.sfx('warning_danger');
        await wait(sec * 1000);
        if (!this.alive(token)) return;
        this.frame.classList.remove('v2-alert');
        el.remove();
    }

    // ------------------------------------------------------------------
    /** 필살기 컷인: 화면을 어둡게 하고 사선 띠에 초상화 + 스킬 이름, 그동안 전투는 슬로모션 */
    ultCutIn(sk, portraitSrc) {
        if (!this.attach()) return;
        gameTime.slowMo(0.22, 1.0);
        this.sfx('ult_cutin');
        const el = this.layer('v2-ultcut', `
            <div class="v2-ultcut__dim"></div>
            <div class="v2-ultcut__band">
                <div class="v2-ultcut__lines"></div>
                ${portraitSrc ? `<img class="v2-ultcut__face" src="${portraitSrc}" alt="">` : `<span class="v2-ultcut__face">${icon(sk.icon, 120)}</span>`}
                <div class="v2-ultcut__text">
                    <small>ULTIMATE SKILL</small>
                    <strong>${sk.name}</strong>
                    <span>${icon(sk.icon, 16)} ${sk.desc || ''}</span>
                </div>
            </div>`);
        el.style.setProperty('--sk', sk.color);
        this.ultCutInUntil = performance.now() + 1250;
        setTimeout(() => el.remove(), 1250);
    }

    // ------------------------------------------------------------------
    /** 화면 흔들림 (전장만). px: 세기, ms: 길이 — 리그 흔들림과 따로 Web Animations로 */
    shake(px = 8, ms = 400) {
        if (!this.viewport || !this.viewport.animate || !settings.get('shake')) return;
        const frames = [];
        const n = Math.max(4, Math.round(ms / 40));
        for (let i = 0; i <= n; i++) {
            const a = px * (1 - i / n);
            const x = i === n ? 0 : (i % 2 ? 1 : -1) * a * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7)));
            const y = i === n ? 0 : Math.cos(i * 2.3) * a * 0.6;
            frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` });
        }
        this.viewport.animate(frames, { duration: ms, easing: 'linear' });
    }

    /** 전체 섬광 */
    flash(color = '#fff', ms = 220, peak = 0.85) {
        if (!this.attach()) return;
        const el = this.layer('v2-flash');
        el.style.background = color;
        el.animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
    }

    // ------------------------------------------------------------------
    /**
     * 거점 파괴: 건물 곳곳에서 연쇄 폭발 → 대폭발 + 섬광 + 흔들림 + 슬로모션.
     * 중간 요새는 별이 HUD로 날아가고 진격 재개, 최종 기지는 MISSION COMPLETE 후 결과 화면.
     * opts.stamp: [제목, 아래 문구] — 기본 문구 대신 (구역 3 정문 붕괴, 정문 뒤 보스 격파)
     * @returns {Promise} 연출이 끝나면 resolve
     */
    async baseDestroyed(enemy, isFinal, opts = {}) {
        if (!this.attach()) return;
        const token = this.token;
        const fx = this.b.fx;
        const size = enemy.size || { w: isFinal ? 120 : 90, h: isFinal ? 200 : 150 };   // 건물 그림 크기
        const w = size.w;
        const cx = enemy.x + w / 2;
        if (isFinal) gameTime.speed = 1;    // 최종 연출 타이밍을 실제 시간에 맞춤
        gameTime.hitStop(0.09, 0);
        this.flash('#fff', 160, 0.55);
        this.shake(isFinal ? 7 : 5, 380);

        // 건물: 달아오르며 흔들리다 무너져 내림
        const dom = enemy.dom;
        if (dom) {
            dom.classList.add('v2-wreck');
            if (isFinal) dom.classList.add('v2-wreck--final');
        }

        // 연쇄 폭발 (건물 위를 오르내리며)
        const n = isFinal ? 7 : 4;
        const gap = isFinal ? 150 : 130;
        for (let i = 0; i < n; i++) {
            const bx = enemy.x + 12 + ((i * 37) % (w - 24));
            const bb = FB + 30 + ((i * 53) % Math.round(size.h * 0.7));
            fx.play(BATTLE_VFX.baseBlast, bx, bb, { scale: isFinal ? 1.45 : 1.1 });
            if (i % 2 === 0) this.shake(isFinal ? 5 : 3, 200);
            await wait(gap);
            if (!this.alive(token)) return;
        }

        // 대폭발
        fx.play(BATTLE_VFX.baseFinale, cx, FB, { scale: isFinal ? 1.4 : 0.85 });
        if (isFinal) sound.stopBgm(1.2);
        this.flash(isFinal ? '#fff3d0' : '#fff', isFinal ? 420 : 260, isFinal ? 0.95 : 0.7);
        this.shake(isFinal ? 16 : 10, isFinal ? 900 : 600);
        gameTime.slowMo(isFinal ? 0.3 : 0.45, isFinal ? 1.7 : 1.0);
        // 그림 거점은 잔해 그림으로 바뀌어 남고(battle_v2 collapseBase), 임시 상자는 사라짐
        if (dom && !this.b.collapseBase(enemy)) setTimeout(() => dom.remove(), 700);

        if (!isFinal) {
            this.flyStar(cx, FB + 110);
            this.stamp(...(opts.stamp || ['FORTRESS DESTROYED', '중간 거점 요새 분쇄 · 진격 재개']), 'is-gold', 1600);
            return;
        }
        await wait(1500);
        if (!this.alive(token)) return;
        this.frame.classList.add('v2-ending');
        this.stamp(...(opts.stamp || ['MISSION COMPLETE', '최종 핵심 기지 완전 분쇄']), 'is-gold is-big', 1900);
        this.sfx('mission_complete');
        await wait(2000);
    }

    /** 유독 가스 (구역 2 보스전): 전장이 sec초 동안 누런 연두빛 안개 */
    gas(sec) {
        if (!this.attach()) return;
        this.frame.classList.add('v2-gas');
        this.sfx('warning_danger');
        clearTimeout(this.gasTimer);
        this.gasTimer = setTimeout(() => this.frame && this.frame.classList.remove('v2-gas'), sec * 1000);
    }

    /** 가운데 도장 문구 (잠깐 표시) */
    stamp(title, sub, cls = '', ms = 1600) {
        const el = this.layer(`v2-stamp ${cls}`, `<strong>${title}</strong><small>${sub}</small>`);
        el.style.setProperty('--out', `${ms - 320}ms`);
        setTimeout(() => el.remove(), ms);
        return el;
    }

    /** 거점 자리에서 별이 튀어올라 HUD 별 칸으로 날아감 */
    flyStar(x, b) {
        const target = document.getElementById('battle-stars-v2');
        if (!target || !this.viewport) return;
        const fr = this.frame.getBoundingClientRect();
        const vr = this.viewport.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const k = fr.width / (this.frame.offsetWidth || fr.width);   // 화면 크기 맞춤 배율 (화면 좌표 → 게임 px)
        const sx = (vr.left - fr.left) / k + x, sy = (vr.bottom - fr.top) / k - b;
        const tx = (tr.left - fr.left + tr.width / 2) / k, ty = (tr.top - fr.top + tr.height / 2) / k;
        const el = this.layer('v2-flystar', icon('star', 44));
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
        this.sfx('star_get');
        el.animate([
            { transform: 'translate(-50%, -50%) scale(0.2) rotate(-40deg)', opacity: 0 },
            { transform: 'translate(-50%, -140%) scale(1.5) rotate(0deg)', opacity: 1, offset: 0.3 },
            { transform: 'translate(-50%, -140%) scale(1.3) rotate(0deg)', opacity: 1, offset: 0.5 },
            { transform: `translate(calc(${tx - sx}px - 50%), calc(${ty - sy}px - 50%)) scale(0.45) rotate(360deg)`, opacity: 1 }
        ], { duration: 1300, easing: 'cubic-bezier(.5, 0, .3, 1)' }).onfinish = () => {
            el.remove();
            target.classList.remove('is-gain');
            void target.offsetWidth;
            target.classList.add('is-gain');
        };
    }

    // ------------------------------------------------------------------
    /** 캐릭터가 쓰러짐: 붉은 섬광 + 슬로모션 + 흑백으로 주저앉음 → MISSION FAILED */
    /** 과부하: 내구도 0 → sec초 멈춤 (긴급 수리) */
    overload(sec) {
        if (!this.attach()) return;
        this.flash('#ff1a3c', 380, 0.5);
        this.shake(8, 450);
        this.stamp('OVERLOAD', `내구도 0 — 긴급 수리 중 (${sec}초 정지)`, 'is-red', 1600);
        this.sfx('shield_break');
        const canvas = document.getElementById('player-sprite-canvas-v2');
        if (canvas) {
            canvas.classList.add('v2-overload');
            setTimeout(() => canvas.classList.remove('v2-overload'), sec * 1000);
        }
    }

    /** 제한 시간 초과: 기체가 멈추고 TIME OVER → (끝나면) 결과 화면 */
    async timeOver() {
        if (!this.attach()) return;
        const token = this.token;
        gameTime.speed = 1;
        gameTime.slowMo(0.35, 1.2);
        this.flash('#ff8a1a', 420, 0.45);
        this.frame.classList.add('v2-ending');
        sound.stopBgm(0.8);
        const canvas = document.getElementById('player-sprite-canvas-v2');
        if (canvas) canvas.classList.add('v2-down');
        monsterControllerV2.playReaction('slump');   // 지쳐 내려앉은 채 멈춤 (rig/reactions.js, Q4)
        this.stamp('TIME OVER', '제한 시간 초과 · 작전 실패', 'is-red is-big', 2200);
        this.sfx('mission_failed');
        await wait(900);
        if (!this.alive(token)) return;
        monsterControllerV2.freezeRig(true);
        await wait(1600);
    }

    async playerDown() {
        if (!this.attach()) return;
        const token = this.token;
        gameTime.speed = 1;
        gameTime.slowMo(0.3, 1.4);
        this.flash('#ff1a3c', 500, 0.6);
        this.shake(10, 600);
        this.frame.classList.add('v2-ending');
        const canvas = document.getElementById('player-sprite-canvas-v2');
        if (canvas) canvas.classList.add('v2-down');
        monsterControllerV2.playReaction('down');    // 젖혀지며 주저앉은 채 멈춤 (rig/reactions.js, Q4)
        this.sfx('player_down');
        sound.stopBgm(0.8);
        await wait(900);
        if (!this.alive(token)) return;
        monsterControllerV2.freezeRig(true);
        this.stamp('MISSION FAILED', '기체 대파 · 작전 실패', 'is-red is-big', 1600);
        this.sfx('mission_failed');
        await wait(1500);
    }

    // ------------------------------------------------------------------
    setLowHp(on) {
        if (!this.attach() || on === this.lowHp) return;
        this.lowHp = on;
        this.frame.classList.toggle('v2-lowhp', on);
        if (on) sound.loop('low_hp');
        else sound.stopLoop('low_hp');
    }

    // ------------------------------------------------------------------
    /**
     * 결과 화면. r: { victory, stage, starFlags(이번 판), bestStars(누적), newStars, bonus, next, distance, kills, time, dm }
     * onAction(name): 'retry' | 'next' | 'lab' | 'menu'
     */
    showResult(r, onAction) {
        if (!this.attach()) return;
        document.querySelectorAll('#screen-battle-v2 .v2-coach').forEach(n => n.remove());   // 결과 화면을 가리지 않게
        const token = this.token;
        const mm = String(Math.floor(r.time / 60)).padStart(2, '0');
        const ss = String(Math.floor(r.time % 60)).padStart(2, '0');
        const stage = r.stage || this.stage;
        // 별: 이번 판에 딴 별은 도장, 예전에 딴 별은 옅은 금색, 처음 딴 별은 NEW
        const stars = starLabels(stage).map((label, i) => ({
            label, now: !!r.starFlags[i], had: !!(r.bestStars && r.bestStars[i]) && !r.starFlags[i],
            isNew: !!r.starFlags[i] && !(r.prevStars && r.prevStars[i])
        }));
        const earned = stars.filter(st => st.now).length;
        const el = this.layer(`v2-result ${r.victory ? 'is-win' : 'is-lose'}`, `
            <div class="v2-result__panel v2-panel">
                <div class="v2-hazard v2-result__stripe"></div>
                <div class="v2-result__head">   <!-- 머리(결과·별)와 몸(기록·보상): PC는 없는 셈(display: contents), 휴대폰 배치는 두 칸 (ui_v2_mobile.css) -->
                <small class="v2-result__op">${r.special ? `SPECIAL · ${stage.name}` : `STAGE ${stage.id} · ${stage.name}`}${diffTag(stage)}</small>
                <h2 class="v2-result__title">${r.special ? specialTitle(r) : r.victory ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h2>
                ${r.special ? specialHtml(r) : ''}
                <p class="v2-result__sub"${r.special ? ' hidden' : ''}>${r.victory ? (r.bossKill ? '최종 거점을 부수고 보스를 쓰러뜨렸습니다' : '적 수비대 거점을 모두 분쇄했습니다') : r.livesOut ? '목숨을 모두 잃었습니다 — 연구소에서 몸통(체력)을 강화해 보세요' : r.bossPhase ? '제한 시간 안에 보스를 쓰러뜨리지 못했습니다' : '제한 시간 안에 최종 기지를 부수지 못했습니다'}</p>
                ${r.nextAssist ? `<p class="v2-result__assist">${icon('down', 14)}도전 보정 — 다음 도전은 적 체력·공격력 −${Math.round(r.nextAssist * 100)}%</p>` : ''}
                <div class="v2-result__stars"${r.special ? ' hidden' : ''}>
                    ${stars.map((st, i) => `
                        <div class="v2-result__star${st.now ? ' is-on' : ''}${st.had ? ' is-had' : ''}" style="--d:${0.35 + i * 0.3}s">
                            ${icon('star', 48)}<span>${st.label}</span>${st.isNew ? '<em>NEW</em>' : ''}
                        </div>`).join('')}
                </div>
                </div>
                <div class="v2-result__body">
                <dl class="v2-result__stats">
                    <div><dt>진격 거리</dt><dd>${Math.round(r.distance)}m</dd></div>
                    <div><dt>처치</dt><dd>${r.kills}</dd></div>
                    <div><dt>전투 시간 / 제한</dt><dd>${mm}:${ss} / ${clock(stage.timeLimit)}</dd></div>
                    ${r.overloads ? `<div><dt>과부하 (긴급 수리)</dt><dd>${r.overloads}회</dd></div>` : ''}
                    ${r.bonus ? `<div><dt>새 별 보너스 (${r.newStars}개)</dt><dd>+${r.bonus.toLocaleString()}</dd></div>` : ''}
                    <div class="is-reward"><dt>${icon('gem', 16)} 획득 DM</dt><dd><strong data-count="${r.dm}">+0</strong></dd></div>
                </dl>
                ${lootHtml(r.loot)}
                ${(r.pets || []).map(id => `<p class="v2-result__pet">펫 획득 · ${petOf(id).name} — 작전 지원에서 장착할 수 있어요</p>`).join('')}
                ${r.unlocked ? `<p class="v2-result__unlock" style="--diff:${r.unlocked.color}">${icon('star', 16)} <b>${r.unlocked.name}</b> 난이도가 열렸습니다 · 파츠 강화 한도 Lv${r.maxLevel || r.unlocked.maxLevel}</p>` : ''}
                ${(r.chars || []).map(id => `<p class="v2-result__unlock v2-result__join" style="--diff:${rosterOf(id)?.color ? hexRgb(rosterOf(id).color) : '62, 230, 255'}">${icon('star', 16)} <b>${rosterOf(id)?.faction || id}</b> 합류! 캐릭터 선택에서 고를 수 있습니다</p>`).join('')}
                ${r.victory ? '' : reportHtml(r.report)}
                </div>
                <div class="v2-result__actions">
                    ${r.next ? `<button class="v2-btn v2-btn--primary" data-act="next">${icon('play', 16)} 다음 ${r.next.id}</button>` : ''}
                    ${r.special ? (r.special.left > 0 ? `<button class="v2-btn v2-btn--primary" data-act="retry">${icon('play', 16)} 한 번 더 (오늘 ${r.special.left}회 남음)</button>` : '<button class="v2-btn v2-btn--ghost" disabled>오늘 횟수를 다 썼어요</button>')
                        : `<button class="v2-btn ${r.next ? 'v2-btn--ghost' : 'v2-btn--primary'}" data-act="retry">${r.next ? '' : icon('play', 16)} ${r.victory ? '다시 출격' : '재도전'}</button>`}
                    <button class="v2-btn v2-btn--ghost" data-act="lab">${icon('gear', 16)} 연구소</button>
                    <button class="v2-btn v2-btn--ghost" data-act="menu">메인 메뉴</button>
                </div>
            </div>`);
        el.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => {
            this.sfx('ui_click');
            onAction(btn.dataset.act);
        }));
        this.sfx(r.victory ? 'result_win' : 'result_lose');
        // 별 도장 효과음 + 보상 카운트업
        for (let i = 0; i < earned; i++) setTimeout(() => this.alive(token) && this.sfx('result_star'), (350 + i * 300) + 250);
        const num = el.querySelector('[data-count]');
        const total = r.dm;
        const start = performance.now() + 900;
        const dur = Math.min(1600, 500 + total * 0.4);
        let lastV = 0;
        const step = now => {
            if (!this.alive(token) || !num.isConnected) return;
            const u = Math.max(0, Math.min(1, (now - start) / dur));
            const v = Math.round(total * (1 - Math.pow(1 - u, 3)));
            num.textContent = `+${v.toLocaleString()}`;
            if (v !== lastV) this.sfx('ui_tick');     // 0.05초에 한 번까지
            lastV = v;
            if (u < 1) requestAnimationFrame(step);
            else {
                num.classList.add('is-done');
                if (total > 0) this.sfx('reward_done');
            }
        };
        requestAnimationFrame(step);
    }
}
