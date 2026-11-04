/* ==========================================================================
   PROJECT: MAD OVERLORD // 전투 HUD (v2)
   ui_v2.css의 컴포넌트로 전투 화면 HUD를 그리고 입력을 받는다.
   - 좌상단 유닛 카드(초상화, 체력/실드), 상단 진행도(거리, 거점 표시, 별), 거점 체력 바
   - 우상단 재화/배속/일시정지, 하단 우측 스킬 도크(팔/몸통/필살기 + 자동)
   - 단축키: 1 팔 스킬, 2 몸통 스킬, 3/Space 필살기, P/Esc 일시정지, A 자동
   - 필살기 컷인/저체력 경고 같은 화면 연출은 battleDirector_v2.js
   - 효과음: 버튼/토글, 스킬 준비 완료, 사용할 수 없는 스킬 입력 (audio/sound_v2.js)
   전투 엔진(battle_v2.js)이 setup → 매 프레임 update → teardown 순서로 부른다.
   ========================================================================== */

import { icon } from './icons.js';
import { gameTime } from '../engine_v2/gameTime.js';
import { monsterControllerV2 } from '../engine_v2/monster_v2.js';
import { SLOT_KEYS } from '../engine_v2/skills_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { openSettings } from './settingsPanel_v2.js';
import { coach } from './coach_v2.js';
import { difficultyOf, difficultyOfStage } from '../engine_v2/difficulty_v2.js';
import { SUPPORT, supportUnitOf } from '../engine_v2/support_v2.js';
import { rosterOf } from '../engine_v2/roster_v2.js';
import { supportPortrait } from './supportUi_v2.js';
import { progress } from '../engine_v2/progress_v2.js';

const FACTION_COLOR = { mech: '#3ee6ff', kaiju: '#a0ff32', hero: '#c86eff', chimera: '#ff9628', diver: '#3fe0c8', saint: '#ff4d6d', frost: '#7fd4ff', doll: '#5ae6f0', architect: '#ff9a2e', broadcaster: '#ff50aa' };
// 진행도 표시: 스테이지 거리와 요새·최종 기지 위치 (stages_v2.js)
const $ = id => document.getElementById(id);
// 휴대폰 배치의 상태 아이콘 (monster_v2.js setState)
const STATE_ICON = { walking: 'speed', 'walking-forward': 'speed', attacking: 'swords', victory: 'star' };

export class BattleHud {
    constructor(engine) {
        this.b = engine;
        this.bound = false;
        this.onKey = this.onKey.bind(this);
        this.onSupportOutside = e => {
            if (!this.supportBox?.contains(e.target)) this.setSupportDetails(false);
        };
        this.last = {};
    }

    // ------------------------------------------------------------------
    setup(equipped) {
        this.screen = $('screen-battle-v2');
        this.el = {
            unit: document.querySelector('#battle-hud-v2 .v2-unit'),
            portrait: $('hud-portrait-v2'),
            portraitBox: document.querySelector('#battle-hud-v2 .v2-unit__portrait'),
            phase: $('hud-phase-v2'),
            name: $('hud-name-v2'),
            faction: $('hud-faction-v2'),
            hp: $('hud-hp-v2'),
            hpGhost: $('hud-hp-ghost-v2'),
            shield: $('hud-shield-v2'),
            hpText: $('hud-hp-text-v2'),
            progress: $('hud-progress-v2'),
            unitMark: $('hud-progress-unit-v2'),
            track: document.querySelector('#battle-hud-v2 .v2-progress__track'),
            target: $('hud-target-v2'),
            targetBar: $('hp-enemy-base-v2'),
            targetGhost: $('hud-target-ghost-v2'),
            dock: $('skill-dock-v2'),
            pause: $('pause-overlay-v2'),
            speed: $('btn-speed-v2'),
            pauseBtn: $('btn-pause-v2'),
            stage: $('hud-stage-v2'),
            timer: $('hud-timer-v2'),
            distMax: $('hud-dist-max-v2'),
            pstatus: $('hud-pstatus-v2'),
            boss: $('hud-boss-v2'),
            bossName: $('hud-boss-name-v2'),
            bossHp: $('hud-boss-hp-v2'),
            badge: $('hud-state-badge-v2')
        };
        const st = this.b.stage;
        this.maxDist = st.distance;
        this.marks = [{ at: st.midAt, icon: 'fort' }, { at: st.finalAt, icon: st.boss ? 'roar' : 'hq' }];
        if (this.el.stage) {
            // 노말이 아니면 난이도 표시 (D-063)
            const d = difficultyOf(difficultyOfStage(st));
            const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
            // 이름은 휴대폰 배치(Q-015 전투 시안 A)에서 숨김 — 번호만
            this.el.stage.innerHTML = (d.id === 'normal' ? '' : `<span class="v2-diffbadge" style="--diff:${d.color}">${d.name}</span>`)
                + `${esc(st.id)}<span class="v2-progress__name"> ${esc(st.name)}</span>`;
        }
        if (this.el.distMax) this.el.distMax.textContent = st.distance;
        this.last = {};
        this.buildMarks();
        this.setPortrait(equipped);
        this.buildDock();
        this.buildSupport();
        this.bindOnce();
        this.setPaused(false);
        this.renderSpeed();
        document.addEventListener('keydown', this.onKey);
    }

    teardown() {
        this.setSupportDetails(false);
        this.supportBox?.remove();
        this.supportBox = null;
        this.supportEls = null;
        this.clearSupportNotice();
        document.removeEventListener('keydown', this.onKey);
        this.setPaused(false);
        if (this.screen) this.screen.style.setProperty('--v2-speed', 1);
    }

    bindOnce() {
        if (this.bound) return;
        this.bound = true;
        this.el.pauseBtn.innerHTML = icon('pause', 20);
        this.el.pauseBtn.addEventListener('click', () => this.togglePause());
        this.el.speed.addEventListener('click', () => {
            sound.play('ui_click');
            this.toggleSpeed();
        });
        $('btn-resume-v2').addEventListener('click', () => this.togglePause());
        const btnSettings = $('btn-settings-v2');
        if (btnSettings) btnSettings.addEventListener('click', () => {
            sound.play('ui_click');
            openSettings();
        });
        document.querySelector('#battle-hud-v2 .v2-chip').insertAdjacentHTML('afterbegin', icon('gem', 18));
    }

    buildMarks() {
        this.el.track.querySelectorAll('.v2-progress__mark').forEach(m => m.remove());
        this.markEls = this.marks.map(m => {
            const i = document.createElement('i');
            i.className = 'v2-progress__mark';
            i.style.left = `${(m.at / this.maxDist) * 100}%`;
            i.innerHTML = icon(m.icon, 13);
            this.el.track.appendChild(i);
            return i;
        });
    }

    setPortrait(equipped) {
        const p = monsterControllerV2.getPortrait();
        const color = (p && FACTION_COLOR[p.id]) || '#ffb020';
        this.el.unit.style.setProperty('--faction', color);
        this.el.name.textContent = p ? p.name : 'OVERLORD';
        this.el.faction.textContent = (equipped.body && equipped.body.id !== 'none' && equipped.body.faction) || '';
        this.el.portraitBox.querySelectorAll('.v2-icon').forEach(n => n.remove());
        if (p) {
            this.el.portrait.hidden = false;
            this.el.portrait.src = p.src;
        } else {
            this.el.portrait.hidden = true;
            this.el.portraitBox.insertAdjacentHTML('beforeend', icon('fist', 34));
        }
        this.portraitSrc = p ? p.src : null;
    }

    buildDock() {
        const dock = this.el.dock;
        dock.innerHTML = '';
        const auto = document.createElement('button');
        auto.className = 'v2-auto';
        auto.innerHTML = `${icon('auto', 16)}<span>AUTO</span>`;
        auto.addEventListener('click', () => this.toggleAuto());
        this.autoBtn = auto;
        dock.appendChild(auto);

        const row = document.createElement('div');
        row.className = 'v2-skills';
        this.slotEls = {};
        // 전술 모듈(mod1·mod2, 키 4·5, Q-006)은 필살기 앞에 작은 칸으로
        for (const slot of ['arm', 'body', 'mod1', 'mod2', 'head']) {
            const sk = this.b.skills[slot];
            if (!sk) continue;
            const wrap = document.createElement('div');
            wrap.className = `v2-skill-wrap${sk.module ? ' is-mod' : ''}`;
            const btn = document.createElement('button');
            btn.className = `v2-skill${sk.ult ? ' v2-skill--ult' : ''}${sk.module ? ' v2-skill--mod' : ''}`;
            btn.dataset.slot = slot;
            btn.style.setProperty('--sk', sk.color);
            btn.title = `${sk.name} — ${sk.desc}`;
            btn.innerHTML = `<span class="v2-skill__icon">${icon(sk.icon, sk.ult ? 50 : sk.module ? 28 : 40)}</span>`
                + `${sk.ult ? '' : '<span class="v2-skill__cd"></span>'}<span class="v2-skill__num"></span>`
                + `<kbd>${SLOT_KEYS[slot]}</kbd>`;
            btn.addEventListener('click', () => this.trySkill(slot));
            const name = document.createElement('span');
            name.className = 'v2-skill-name';
            name.textContent = sk.name;
            wrap.append(btn, name);
            row.appendChild(wrap);
            this.slotEls[slot] = { btn, num: btn.querySelector('.v2-skill__num') };
        }
        dock.appendChild(row);
        dock.hidden = !row.children.length;
        this.readyPrev = {};
        this.renderAuto();
    }

    // ------------------------------------------------------------------
    update() {
        const b = this.b;
        this.updateSupport();
        this.set('speedVal', gameTime.speed, () => this.renderSpeed());
        // 체력 / 실드
        const hpPct = Math.max(0, Math.min(1, b.playerHp / b.maxPlayerHp));
        this.set('hp', Math.round(hpPct * 1000), v => {
            const w = `${v / 10}%`;
            this.el.hp.style.width = w;
            this.el.hpGhost.style.width = w;
            this.el.hp.classList.toggle('is-mid', v < 600 && v >= 300);
            this.el.hp.classList.toggle('is-low', v < 300);
        });
        // 최대 체력은 휴대폰 배치에서 숨김 (Q-015 — 지금 체력 숫자만 크게)
        this.set('hpText', `${Math.max(0, Math.round(b.playerHp)).toLocaleString()}<small> / ${Math.round(b.maxPlayerHp).toLocaleString()}</small>`,
            v => { this.el.hpText.innerHTML = v; });
        // 상태(진격·교전·승리)는 휴대폰 배치에서 글 대신 초상화 옆 아이콘
        this.set('mstate', monsterControllerV2.currentState || 'walking', v => {
            this.el.badge.dataset.state = v;
            this.el.badge.innerHTML = icon(STATE_ICON[v] || 'speed', 22);
        });
        const totalShield = (b.shieldHp || 0) + (b.supportShield || 0);
        const shieldPct = totalShield > 0 ? Math.min(1, totalShield / b.maxPlayerHp) : 0;
        this.set('shield', Math.round(shieldPct * 1000), v => { this.el.shield.style.width = `${v / 10}%`; });
        this.set('shieldCyan', b.shieldTimer !== Infinity, v => this.el.shield.classList.toggle('is-cyan', v));
        this.set('phase', b.phase2, v => { this.el.phase.hidden = !v; });
        // 체력 30% 미만: 화면 가장자리 붉은 경고 (연출 모듈)
        this.set('lowHp', hpPct > 0 && hpPct < 0.3, v => b.director.setLowHp(v));

        // 진행도
        const dist = Math.min(this.maxDist, b.distanceTraveled);
        this.set('dist', Math.round(dist), v => {
            const pct = `${(v / this.maxDist) * 100}%`;
            this.el.progress.style.width = pct;
            this.el.unitMark.style.left = pct;
        });
        this.set('marks', `${b.midBaseDestroyed}${b.finalBaseDestroyed}`, () => {
            this.markEls[0].classList.toggle('is-done', b.midBaseDestroyed);
            this.markEls[1].classList.toggle('is-done', b.finalBaseDestroyed);
        });

        // 제한 시간 (D-028): 남은 시간, 별 목표 시간 안이면 금색, 30초 이하 붉게 깜빡임
        const left = b.timeLeft();
        this.set('timer', Math.ceil(left), v => {
            const t = this.el.timer;
            t.textContent = `⏱ ${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
            t.classList.toggle('is-warn', v <= 30);
            t.classList.toggle('is-star', v > 30 && b.stats.time <= b.stage.starTime);
        });

        // 주인공 상태 이상 (감속·기절) 아이콘 + 남은 시간
        const ps = [b.pStunT > 0 && ['stun', b.pStunT], b.pRootT > 0 && ['net', b.pRootT], b.pSlowT > 0 && ['slow', b.pSlowT]].filter(Boolean);
        this.set('pstatus', ps.map(([k, t]) => `${k}${Math.ceil(t * 2)}`).join(), () => {
            this.el.pstatus.innerHTML = ps.map(([k, t]) => `<span class="v2-status__icon is-${k}">${icon(k, 11)}</span><em>${t.toFixed(1)}</em>`).join('');
        });

        this.set('stunned', b.playerStunned(), v => this.el.dock.classList.toggle('is-stunned', v));   // 기절 중 스킬 불가

        // 보스 체력 바
        const boss = b.boss && b.enemies.includes(b.boss) ? b.boss : null;
        this.set('boss', !!boss, v => {
            this.el.boss.hidden = !v;
            if (v) this.el.bossName.textContent = boss.t.name;
        });
        if (boss) this.set('bossHp', Math.round((boss.hp / boss.maxHp) * 1000), v => { this.el.bossHp.style.width = `${v / 10}%`; });

        // 거점 체력 바: 거점이 전장에 있을 때만
        const hasBase = b.enemies.some(e => e.isBuilding);
        this.set('target', hasBase, v => { this.el.target.hidden = !v; });
        if (hasBase) {
            const pct = Math.max(0, (b.currentTargetHp / b.maxTargetHp) * 100);
            this.set('targetPct', Math.round(pct * 10), v => { this.el.targetGhost.style.width = `${v / 10}%`; });
        }

        // 스킬
        for (const slot in this.slotEls) {
            const sk = b.skills[slot];
            const { btn, num } = this.slotEls[slot];
            const st = b.skillState(slot);
            if (sk.ult) {
                this.set(`g_${slot}`, Math.round(b.ultGauge * 100), v => {
                    btn.style.setProperty('--gauge', v / 100);
                    num.textContent = v >= 100 ? '' : `${v}%`;
                });
            } else {
                const remain = b.skillCd[slot];
                this.set(`cd_${slot}`, Math.ceil(remain * 10), v => {
                    btn.style.setProperty('--cd', sk.cd ? Math.min(1, remain / sk.cd) : 0);   // 파문의 종(구역 6)으로 쿨다운보다 길어질 수 있음
                    num.textContent = v > 0 ? String(Math.ceil(v / 10)) : '';
                });
            }
            const cls = `${st.ready}${st.hasTarget}`;
            this.set(`st_${slot}`, cls, () => {
                // 쿨다운/게이지가 막 찼을 때 알림음 (전투 시작 시점의 상태는 제외)
                if (this.readyPrev[slot] === false && st.ready) {
                    sound.play(sk.ult ? 'ult_ready' : 'skill_ready');
                    if (sk.ult) coach('battle_ult', btn);   // 처음 한 번: 필살기 안내
                }
                this.readyPrev[slot] = st.ready;
                btn.classList.toggle('is-ready', st.ready && st.hasTarget);
                btn.classList.toggle('is-blocked', st.ready && !st.hasTarget);
                btn.classList.toggle('is-cooling', !st.ready);
            });
        }
    }

    /** 값이 바뀌었을 때만 DOM 갱신 */
    set(key, value, apply) {
        if (this.last[key] === value) return;
        this.last[key] = value;
        apply(value);
    }

    onSkillUsed(slot, sk) {
        const slotEl = this.slotEls[slot];
        if (slotEl) {
            slotEl.btn.classList.remove('is-fired');
            void slotEl.btn.offsetWidth;   // 애니메이션 재시작
            slotEl.btn.classList.add('is-fired');
        }
        if (sk.ult) this.b.director.ultCutIn(sk, this.portraitSrc);   // 필살기 컷인 + 슬로모션
    }

    /** 스킬 입력: 쓸 수 없으면(쿨다운/대상 없음) 짧은 경고음 */
    trySkill(slot) {
        if (!this.b.useSkill(slot) && this.b.skills[slot] && !this.b.cinematic) sound.play('ui_error', { vol: 0.5 });
    }

    togglePause() {
        sound.play('ui_pause');
        this.setPaused(!gameTime.paused);
    }

    // ------------------------------------------------------------------
    setPaused(on) {
        gameTime.paused = on;
        sound.setPaused(on);
        if (!this.screen) return;
        this.screen.classList.toggle('v2-paused', on);
        this.el.pause.hidden = !on;
        this.el.pauseBtn.classList.toggle('is-on', on);
    }

    toggleSpeed() {
        gameTime.speed = gameTime.speed === 1 ? 2 : 1;
        this.renderSpeed();
    }

    renderSpeed() {
        this.el.speed.innerHTML = `${icon('speed', 16)}<span>${gameTime.speed}x</span>`;
        this.el.speed.classList.toggle('is-on', gameTime.speed > 1);
        this.screen.style.setProperty('--v2-speed', gameTime.speed);
    }

    toggleAuto() {
        sound.play('ui_toggle');
        this.b.setAutoSkills(!this.b.autoSkills);
        this.renderAuto();
    }

    renderAuto() {
        if (this.autoBtn) this.autoBtn.classList.toggle('is-on', !!this.b.autoSkills);
    }

    onKey(e) {
        if (!this.b.isActive || this.b.cinematic || e.repeat) return;
        const k = e.key.toLowerCase();
        if (document.querySelector('.v2-settings')) return;   // 설정 창이 열려 있으면 그쪽이 키 입력 처리
        if (k === 'escape' && this.supportEls?.info.getAttribute('aria-expanded') === 'true') {
            this.setSupportDetails(false, true);
        } else if (k === 'p' || k === 'escape') {
            this.togglePause();
        } else if (gameTime.paused) {
            return;
        } else if (k === '1') {
            this.trySkill('arm');
        } else if (k === '2') {
            this.trySkill('body');
        } else if (k === '3' || k === ' ') {
            e.preventDefault();
            this.trySkill('head');
        } else if ((k === '4' || k === '5') && this.b.skills[k === '4' ? 'mod1' : 'mod2']) {
            this.trySkill(k === '4' ? 'mod1' : 'mod2');   // 전술 모듈
        } else if (k === 'a') {
            this.toggleAuto();
        } else if (k === 'q') {
            this.trySupport();
        } else {
            return;
        }
        e.preventDefault();
    }

    buildSupport() {
        this.setSupportDetails(false);
        this.supportBox?.remove();
        this.supportEls = null;
        const snap = this.b.support?.snapshot;
        const box = document.createElement('div');
        box.className = 'v2-support-hud';
        if (snap) {
            const c = rosterOf(snap.id), def = supportUnitOf(snap.id);
            box.style.setProperty('--support', c.color);
            box.style.setProperty('--sk', c.color);
            box.innerHTML = `<button class="v2-skill v2-support-call" aria-label="${c.faction} 협력 호출" aria-describedby="v2-support-state v2-support-brief">
                <span class="v2-skill__icon"><img src="${supportPortrait(snap.id)}" alt=""></span>
                <span class="v2-skill__cd v2-support-gauge" role="progressbar" aria-label="지원 충전" aria-valuemin="0" aria-valuemax="100"></span>
                <span class="v2-skill__num"></span><kbd>Q</kbd></button>
                <div class="v2-support-summary"><div class="v2-support-heading"><span class="v2-support-label">협력</span><b>${c.faction}</b>
                <span class="v2-support-state" id="v2-support-state"></span></div>
                <p class="v2-support-preview" id="v2-support-brief">${def.brief}</p>
                <div class="v2-support-actions"><button class="v2-support-info" aria-expanded="false" aria-controls="v2-support-detail">효과 상세 <span aria-hidden="true">ⓘ</span></button>
                <button class="v2-support-auto" aria-pressed="${this.b.support.auto}"></button></div></div>
                <section class="v2-support-detail" id="v2-support-detail" aria-label="지원 효과 상세" hidden>
                <button class="v2-support-close" aria-label="지원 효과 상세 닫기">×</button>
                <small>${c.faction} · ${def.role}</small><h3>${icon(def.icon, 18)} ${def.ult}</h3>
                <p class="v2-support-brief">${def.brief}</p><p>${def.effect}</p>
                <p class="v2-support-rule">${SUPPORT.duration + (this.b.support.snapshot?.extraTime || 0)}초 출격 · 궁극기 ${SUPPORT.ultimateTimes.length}회 · 시너지는 출격 중에만 적용<br>첫 호출 ${this.b.support.interval}초 충전 · 사용 후 ${this.b.support.interval}초 재충전</p></section>`;
            this.supportEls = {
                call: box.querySelector('.v2-support-call'), gauge: box.querySelector('.v2-support-gauge'),
                num: box.querySelector('.v2-skill__num'), state: box.querySelector('.v2-support-state'),
                auto: box.querySelector('.v2-support-auto'), info: box.querySelector('.v2-support-info'),
                detail: box.querySelector('.v2-support-detail')
            };
            for (const key of Object.keys(this.last)) if (key.startsWith('support_')) delete this.last[key];
            box.querySelector('.v2-support-call').addEventListener('click', () => this.trySupport());
            this.supportEls.info.addEventListener('click', () => this.setSupportDetails(this.supportEls.detail.hidden));
            box.querySelector('.v2-support-close').addEventListener('click', () => this.setSupportDetails(false, true));
            box.querySelector('.v2-support-auto').addEventListener('click', () => {
                this.b.support.auto = !this.b.support.auto;
                progress.setSupportAuto(this.b.support.auto);
                this.updateSupport();
            });
        } else {
            box.classList.add('is-empty');
            box.textContent = '협력 출격 · 지원 없음';
        }
        this.screen?.querySelector('#battle-hud-v2')?.appendChild(box);
        this.supportBox = box;
        this.updateSupport();
    }

    setSupportDetails(on, restoreFocus = false) {
        document.removeEventListener('pointerdown', this.onSupportOutside);
        if (!this.supportEls) return;
        this.supportBox?.classList.toggle('is-detail-open', on);
        this.supportEls.detail.hidden = !on;
        this.supportEls.info.setAttribute('aria-expanded', String(on));
        if (on) {
            document.addEventListener('pointerdown', this.onSupportOutside);
            this.supportEls.detail.querySelector('.v2-support-close').focus({ preventScroll: true });
        }
        else if (restoreFocus) this.supportEls.info.focus();
    }

    updateSupport() {
        const box = this.supportBox;
        if (!box || !this.supportEls || !this.b.support?.snapshot) return;
        const st = this.b.supportStatus();
        const { call, gauge, num, state, auto } = this.supportEls;
        const stBlocked = !st.ready || !st.hasTarget || this.b.cinematic || gameTime.paused;
        const seconds = Math.ceil(st.cooldown);
        const charging = this.b.stats.supportCalls ? '재충전' : '첫 충전';
        this.set('support_disabled', stBlocked, v => { call.disabled = v; });
        this.set('support_status', `${st.ready}${stBlocked}${st.time > 0}`, () => {
            box.classList.toggle('is-active', st.time > 0);
            call.classList.toggle('is-ready', st.ready && !stBlocked);
            call.classList.toggle('is-blocked', st.ready && stBlocked);
            call.classList.toggle('is-cooling', !st.ready);
        });
        this.set('support_text', st.time > 0 ? '지원 중'
            : st.cooldown > 0 ? charging : st.hasTarget ? '호출 가능' : '대상 대기', v => { state.textContent = v; });
        this.set('support_charge', Math.round(st.charge * 1000), v => {
            call.style.setProperty('--cd', 1 - v / 1000);
            gauge.setAttribute('aria-valuenow', String(Math.round(v / 10)));
        });
        this.set('support_countdown', seconds, v => {
            num.textContent = v > 0 ? `${v}` : '';
            gauge.setAttribute('aria-valuetext', v > 0 ? `${charging} ${v}초` : '충전 완료');
        });
        this.set('support_auto', this.b.support.auto, v => {
            auto.textContent = `지원 자동 ${v ? 'ON' : 'OFF'}`;
            auto.setAttribute('aria-pressed', String(v));
        });
    }

    trySupport() {
        if (!this.b.callSupport()) sound.play('ui_error', { vol: 0.5 });
        this.updateSupport();
    }

    supportNotice(name, skill) {
        this.clearSupportNotice();
        const notice = document.createElement('div');
        notice.className = 'v2-support-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = `협력 출격 · ${name} / ${skill}`;
        this.screen?.appendChild(notice);
        this.supportNoticeEl = notice;
    }

    clearSupportNotice() {
        this.supportNoticeEl?.remove();
        this.supportNoticeEl = null;
    }
}
