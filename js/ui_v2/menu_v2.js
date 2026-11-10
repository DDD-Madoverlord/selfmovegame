/* ==========================================================================
   PROJECT: MAD OVERLORD // 메인 화면: 전술 그리드 (v2, 가로 1280x720)
   ① 오버로드 대기실: 장착 파츠로 조립된 캐릭터(리그 idle) + 부위별 파츠·스킬 설명 + 능력치 + CHARACTER(선택창) · MUTATION LAB
   ② 월드맵 (STORY MAP, D-104): 구역마다 지도 위 정거장 11곳(NPC) — 누르면 내 캐릭터가 걸어가 그 판을 고름,
      구역은 좌우로 밀어서 넘김 (stageMap_v2.js, 구역 번호 탭 없음). SPECIAL MAP은 준비 중 (예전 전술 레이더 radar_v2.js가 잠긴 화면)
      화면 오른쪽 위 난이도 노말·하드·헬·나이트메어 (D-063): 고른 난이도의 잠금·별·배율로 표시
   ③ ATTACK / SORTIE 출격 버튼 + 상태 줄(보유 DM, 장착 스킬)
   ④ 우상단: 재화, 설정(톱니바퀴)
   휴대폰 배치 (Q-015 메인 시안 B, body.v2-mobile — ui_v2_mobile.css): 왼쪽 아이콘 메뉴 줄(캐릭터·연구소·상점·지원·펫),
      오른쪽 스테이지 카드 + 협력 + 출격. 지도는 [스테이지 선택]을 누르면 전체 화면, 부위 설명은 [파츠·스킬] 창
   ========================================================================== */

import { gameState } from '../engine/state.js';
import { monsterControllerV2 } from '../engine_v2/monster_v2.js';
import { skillsForParts, legPassiveOf } from '../engine_v2/skills_v2.js';
import { progress } from '../engine_v2/progress_v2.js';
import { rosterOf } from '../engine_v2/roster_v2.js';
import { STAGES, CHAPTERS, stageById, isUnlocked, defaultStage, chapterOf, chapterUnlocked, defaultStageIn, unlockAllStagesTemp, allStagesUnlocked } from '../engine_v2/stages_v2.js';
import { isZoneReleased, isCharacterReleased, releaseDateOf, releaseLabelOf } from '../engine_v2/contentSchedule_v2.js';
import { DIFFICULTIES, difficultyOf, difficultyUnlocked, stageFor, FINAL_STAGE_ID } from '../engine_v2/difficulty_v2.js';
import { ENEMY_TYPES } from '../engine_v2/enemies_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';
import { icon, fillIcons } from './icons.js';
import { openSettings } from './settingsPanel_v2.js';
import { liveTune } from '../engine_v2/liveTune_v2.js';
import { TacticalRadar } from './radar_v2.js';
import { StageMap, stageNpcs, plainName } from './stageMap_v2.js';
import { openGrowthPanel } from './growthUi_v2.js';
import { refreshCurrency, currencyChipsHtml } from './currencyBar_v2.js';
import { MUTATORS } from '../engine_v2/growth_v2.js';
import { openShop } from './shop_v2.js';
import { createOfflineRewardButton, updateOfflineRewardButton } from './offlineRewardUi_v2.js';
import { updateSupportMenu } from './supportUi_v2.js';
import { shouldPlayIntro, playStoryIntro, introZoneOf, hasIntro } from './storyIntro_v2.js';

const $ = id => document.getElementById(id);
const SLOTS = [
    { slot: 'head', label: 'HEAD', ko: '머리', role: 'ULT' },
    { slot: 'arm', label: 'ARM', ko: '팔', role: '1' },
    { slot: 'body', label: 'BODY', ko: '몸통', role: '2' },
    { slot: 'leg', label: 'LEG', ko: '다리', role: 'P' }
];
const isMobile = () => document.body.classList.contains('v2-mobile');
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** 구역 공개 여부 — 시험용 전체 해제 중이면 모두 열림 */
const zoneOpen = zone => allStagesUnlocked() || isZoneReleased(zone);

export class MenuController {
    constructor(switchScreenFn) {
        this.switchScreen = switchScreenFn;
        this.root = $('screen-menu-v2');
        this.domDmCount = $('menu-dm-count-v2');
        this.domFactionName = $('menu-faction-name-v2');
        this.map = 'story';
        this.radar = new TacticalRadar($('menu-radar-v2'));   // SPECIAL MAP(준비 중) 화면만
        $('menu-radar-v2').hidden = true;
        this.stageNpcs = new Map(CHAPTERS.map(ch => [ch.id, stageNpcs(ch)]));
        this.stageMap = new StageMap(this.root.querySelector('.v2-radar__screen'), {
            onSelect: id => this.selectStage(id),
            // 열린 구역으로 넘기면 그 구역의 다음 판을 고름 (예전 구역 탭과 같음)
            onZone: zone => {
                const ch = CHAPTERS.find(c => c.zone === zone);
                if (chapterOf(progress.selectedStage) !== ch) this.selectZone(ch.id);
            },
            onView: page => { $('menu-map-name-v2').textContent = plainName(page.name); },
            onLocked: x => {
                sound.play('ui_error');
                this.say(x.nodes ? `<b>${plainName(x.name)}</b> — ${x.lockText}` : `<b>${x.name}</b> 잠김 — 앞 판을 먼저 클리어하세요`);
            }
        });
        fillIcons(this.root);
        const chip = this.root && this.root.querySelector('.v2-chip--dm');
        if (chip) chip.insertAdjacentHTML('afterbegin', icon('gem', 18));
        const shop = document.createElement('button');
        shop.className = 'v2-supportbtn';
        shop.id = 'btn-menu-shop-v2';
        shop.innerHTML = '상점<i id="menu-shop-badge-v2"></i>';
        $('btn-menu-support-v2')?.before(shop);
        shop.addEventListener('click', () => openShop('menu', () => this.updateDisplay()));
        this.offlineButton = createOfflineRewardButton(shop, () => this.updateDisplay());
        const updateBadge = () => {
            $('menu-shop-badge-v2').textContent = progress.canClaimPass() ? '●' : '';
            $('rail-shop-dot-v2').hidden = !progress.canClaimPass();
        };
        gameState.subscribe(updateBadge);
        setInterval(updateBadge, 15000);
        this.initEvents();
        this.initUnlockTaps();
    }

    /** 시험용: 왼쪽 위 아이콘을 5번 연속(각 1초 안) 누르면 모든 스테이지·구역 잠금을 이번 실행 동안만 해제.
     *  한 번 더 5번 누르면 캐릭터·파츠도 전부 해제 — 그때부터는 저장을 메모리에만 함 (progress_v2.js unlockEverythingTemp) */
    initUnlockTaps() {
        const emblem = this.root && this.root.querySelector('.v2-brand__emblem');
        if (!emblem) return;
        let taps = 0;
        let last = 0;
        emblem.addEventListener('click', () => {
            const now = performance.now();
            taps = now - last < 1000 ? taps + 1 : 1;
            last = now;
            if (taps < 5) return;
            taps = 0;
            if (!allStagesUnlocked()) {
                unlockAllStagesTemp();
                liveTune.enable(true);   // 왼쪽 가장자리 '⚖ 밸런스' 탭 (시험용 밸런스 조절, D-127 — 이 기기에 남음, 패널에서 숨김)
                emblem.classList.add('is-dev-unlocked');
                sound.play('ui_equip');
                this.renderStages();
                this.say('<b>시험 모드</b> — 모든 스테이지 잠금 해제 (게임을 다시 켜면 원래대로 · 원래 잠긴 판은 기록 안 됨) · 왼쪽 가장자리 ⚖ 탭 = 밸런스 조절 · 5번 더 누르면 캐릭터·파츠도 해제');
                return;
            }
            if (!progress.unlockEverythingTemp()) return;
            emblem.classList.add('is-dev-all');
            sound.play('ui_equip');
            this.updateDisplay();
            this.say('<b>시험 모드</b> — 모든 스테이지·캐릭터·파츠 잠금 해제 · 지금부터 진행은 저장 안 됨 (게임을 다시 켜면 원래대로)');
        });
    }

    initEvents() {
        const toSelect = () => this.switchScreen('select');
        const toLab = () => {
            gameState.resetCartToEquipped();
            this.switchScreen('lab');
        };
        const changed = () => this.updateDisplay();
        $('btn-to-select-v2')?.addEventListener('click', toSelect);
        $('btn-to-lab-v2')?.addEventListener('click', toLab);
        $('btn-to-battle-v2')?.addEventListener('click', () => {
            if (this.map !== 'story') return;
            if (!isUnlocked(progress.selectedStage, progress) || !isCharacterReleased(progress.character)) {
                sound.play('ui_error');
                this.say('아직 공개되지 않은 콘텐츠입니다 — 공개된 구역과 캐릭터를 선택하세요');
                return;
            }
            if (!progress.isReady()) {   // 몸통을 아직 안 산 캐릭터 (D-051)
                sound.play('ui_error');
                this.say(isMobile() ? '<b>출격 불가</b> — 연구소에서 몸통 파츠를 사세요' : '<b>출격 불가</b> — 몸통 파츠가 없습니다. MUTATION LAB에서 파츠를 구매하세요');
                return;
            }
            // 구역의 첫 스테이지(N-1)를 처음 출격: 스토리 인트로(모션 코믹) 뒤 전투 (storyIntro_v2.js, D-100)
            if (shouldPlayIntro(progress.selectedStage)) {
                playStoryIntro(introZoneOf(progress.selectedStage)).then(() => this.switchScreen('battle'));
                return;
            }
            this.switchScreen('battle');
        });
        // 스토리 다시 보기: 고른 구역의 인트로 (끝나면 메인 화면 그대로)
        $('btn-story-intro-v2')?.addEventListener('click', () => {
            const zone = chapterOf(this.currentStage()).zone;
            if (hasIntro(zone)) playStoryIntro(zone).then(() => sound.playBgm('menu'));
        });
        $('btn-menu-settings-v2')?.addEventListener('click', () => openSettings());
        $('btn-menu-support-v2')?.addEventListener('click', () => openGrowthPanel('modules', changed));
        $('btn-menu-coop-v2')?.addEventListener('click', () => openGrowthPanel('coop', changed));
        this.root?.querySelectorAll('.v2-maptab').forEach(tab => tab.addEventListener('click', () => this.setMap(tab.dataset.map)));
        const money = this.root?.querySelector('.v2-radar__money');
        if (money) money.innerHTML = currencyChipsHtml();
        // 휴대폰 메인의 [스토리 맵]·[스페셜 맵]: 그 지도로 바꾸고 지도 창을 엶 (11-05 피드백 14번)
        this.root?.querySelectorAll('.v2-mmap').forEach(btn => btn.addEventListener('click', () => {
            this.setMap(btn.dataset.map);
            this.openStages(true);
        }));

        // 휴대폰 배치 (메인 시안 B): 메뉴 줄 · 스테이지 선택 창
        $('btn-rail-select-v2')?.addEventListener('click', toSelect);
        $('btn-rail-lab-v2')?.addEventListener('click', toLab);
        $('btn-rail-shop-v2')?.addEventListener('click', () => openShop('menu', changed));
        $('btn-rail-support-v2')?.addEventListener('click', () => openGrowthPanel('modules', changed));
        $('btn-rail-pets-v2')?.addEventListener('click', () => openGrowthPanel('pets', changed));   // 1-1 전에는 "클리어하면 열림" 안내
        $('menu-stage-card-v2')?.addEventListener('click', e => { if (e.target.closest('[data-act="stages"]')) this.openStages(true); });
        $('btn-radar-close-v2')?.addEventListener('click', () => this.openStages(false));
        $('menu-scrim-v2')?.addEventListener('click', () => this.openStages(false));
        window.addEventListener('v2-layout', e => {
            this.radar.scale = e.detail.mobile ? 2.2 : 1;   // 전체 화면 레이더의 점·글자 (radar_v2.js)
            if (!e.detail.mobile) this.openStages(false);
            this.syncRadar();
        });
        if (isMobile()) this.radar.scale = 2.2;
    }

    /** 안내 한 줄: 레이더 아래 줄 + 휴대폰 배치에서는 레이더가 접혀 있으니 잠깐 뜨는 알림으로도 */
    say(html) {
        $('menu-map-foot-v2').innerHTML = html;
        const toast = $('menu-toast-v2');
        if (!toast || !isMobile()) return;
        toast.innerHTML = html;
        toast.hidden = false;
        toast.classList.remove('is-in');
        void toast.offsetWidth;   // 애니메이션 다시
        toast.classList.add('is-in');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
    }

    /** 휴대폰 배치: 지도(스테이지·구역·난이도 고르기)를 전체 화면으로 열고 닫음 */
    openStages(on) {
        const menu = this.root?.querySelector('.v2-menu');
        if (!menu || menu.classList.contains('is-stages-open') === on) return;
        menu.classList.toggle('is-stages-open', on);
        $('menu-scrim-v2').hidden = !on;
        this.syncRadar();
        if (on) $('btn-radar-close-v2').focus({ preventScroll: true });
    }

    setMap(map) {
        this.map = map;
        this.radar.setMode(map);
        this.root.querySelectorAll('.v2-maptab, .v2-mmap').forEach(t => t.classList.toggle('is-on', t.dataset.map === map));
        const story = map === 'story';
        $('menu-radar-locked-v2').hidden = story;
        $('menu-map-name-v2').textContent = story ? plainName(chapterOf(this.currentStage()).name) : 'SPECIAL · 무한 파밍 / 엘리트 챌린지';
        this.stageMap.root.hidden = !story;
        $('menu-radar-v2').hidden = story;
        this.syncRadar();
        const sortie = $('btn-to-battle-v2');
        sortie.disabled = !story;
        if (story) this.renderStages();
        else {
            $('menu-map-foot-v2').textContent = 'SPECIAL MAP · 준비 중';
            $('menu-sortie-sub-v2').textContent = 'SPECIAL MAP 준비 중 — STORY MAP으로 출격';
            const card = $('menu-stage-card-v2');
            if (card) card.innerHTML = `<button class="v2-mstage__zone" data-act="stages">SPECIAL MAP${icon('down', 26)}</button>`
                + '<div class="v2-mstage__title"><strong>무한 파밍 · 엘리트 챌린지</strong></div><div class="v2-mstage__meta"><span>준비 중 — STORY MAP으로 출격</span></div>'
                + `<button class="v2-mstage__pick" data-act="stages">${icon('map', 34)}스테이지 선택</button>`;
        }
    }

    // ---- 스테이지 선택 (레이더 점) ----
    /** 지금 고른 스테이지 (저장된 선택이 열려 있으면 그것, 아니면 아직 못 깬 첫 스테이지) */
    currentStage() {
        const sel = progress.selectedStage;
        if (sel && isUnlocked(sel, progress)) return stageById(sel);
        const next = defaultStage(progress);
        return isUnlocked(next.id, progress) ? next : STAGES.find(s => isUnlocked(s.id, progress)) || next;
    }

    selectStage(id) {
        const ch = chapterOf(id);
        if (!zoneOpen(ch.zone)) { this.selectZone(ch.id); return; }
        if (!isUnlocked(id, progress)) {
            sound.play('ui_error');
            this.say(`<b>${id}</b> 잠김 — 이전 스테이지를 먼저 클리어하세요`);
            return;
        }
        sound.play('ui_tab');
        progress.selectStage(id);
        this.renderStages();
    }

    /** 구역 고르기 (지도를 그 구역으로 넘겼을 때): 그 구역의 아직 못 깬 첫 스테이지. 잠긴 구역은 안내만 */
    selectZone(id) {
        const ch = CHAPTERS.find(c => c.id === id);
        if (!ch) return;
        if (!chapterUnlocked(ch, progress)) {
            sound.play('ui_error');
            this.say(`<b>${plainName(ch.name)}</b> — ${this.zoneLockText(ch)}`);
            return;
        }
        sound.play('ui_tab');
        progress.selectStage(defaultStageIn(ch, progress).id);
        this.renderStages();
    }

    /** 잠긴 구역 안내 (지도 안개 · 안내 줄): 공개 전이면 날짜, 아니면 앞 구역 보스 */
    zoneLockText(ch) {
        if (!zoneOpen(ch.zone)) return releaseDateOf('zones', ch.zone) ? `${releaseDateOf('zones', ch.zone)} 공개 예정` : releaseLabelOf('zones', ch.zone);
        const prev = CHAPTERS[CHAPTERS.indexOf(ch) - 1];
        const last = prev && prev.stages[prev.stages.length - 1];
        if (!last) return '';
        const boss = last.boss && ENEMY_TYPES[last.boss.unit];
        return boss ? `앞 구역 보스 '${boss.name}'을(를) 쓰러뜨리면 열립니다` : `'${last.name}'을(를) 클리어하면 열립니다`;
    }

    /** 난이도 버튼: 잠긴 난이도는 바로 앞 난이도의 마지막 스테이지를 깨야 열림 */
    selectDifficulty(id) {
        if (!difficultyUnlocked(id, progress)) {
            sound.play('ui_error');
            const i = DIFFICULTIES.findIndex(d => d.id === id);
            const prev = DIFFICULTIES[i - 1];
            this.say(`<b>${difficultyOf(id).name}</b> 잠김 — ${prev.name} ${FINAL_STAGE_ID}까지 클리어하면 열립니다`);
            return;
        }
        if (id === progress.difficulty) return;
        sound.play('ui_tab');
        progress.selectDifficulty(id);
        this.renderStages();
    }

    renderDifficulties() {
        const box = $('menu-diffs-v2');
        if (!box) return;
        box.innerHTML = DIFFICULTIES.map(d => {
            const open = difficultyUnlocked(d.id, progress);
            const on = d.id === progress.difficulty;
            return `<button class="v2-difftab${on ? ' is-on' : ''}${open ? '' : ' is-locked'}" data-diff="${d.id}" style="--diff:${d.color}"`
                + ` aria-pressed="${on}" title="${d.name}${open ? '' : ' (잠김)'}">${open ? '' : icon('lock', 10)}${d.name}</button>`;
        }).join('');
        box.querySelectorAll('.v2-difftab').forEach(b => b.addEventListener('click', () => this.selectDifficulty(b.dataset.diff)));
    }

    /** 지도 쪽(구역)마다: 열림 · 잠긴 안내 · 정거장(판 상태·별·NPC) — stageMap_v2.js */
    mapPages() {
        return CHAPTERS.map(ch => {
            const open = chapterUnlocked(ch, progress);
            const npcs = this.stageNpcs.get(ch.id);
            return {
                zone: ch.zone, name: ch.name, open, lockText: open ? '' : this.zoneLockText(ch),
                nodes: ch.stages.map((st, k) => ({
                    id: st.id, name: st.name, boss: !!st.boss, stars: progress.stage(st.id).stars, npcs: npcs[k],
                    state: !open ? 'locked' : progress.stage(st.id).cleared ? 'cleared' : isUnlocked(st.id, progress) ? 'open' : 'locked'
                }))
            };
        });
    }

    renderStages() {
        const cur = this.currentStage();
        progress.selectedStage = cur.id;
        const ch = chapterOf(cur);
        const storyBtn = $('btn-story-intro-v2');
        if (storyBtn) storyBtn.hidden = !hasIntro(ch.zone);
        const diff = difficultyOf(progress.difficulty);
        const radar = this.root.querySelector('.v2-radar');
        if (radar) { radar.dataset.difficulty = diff.id; radar.style.setProperty('--diff', diff.color); }
        this.renderDifficulties();
        this.stageMap.setHero(progress.character, gameState.getEquippedObjects());
        this.stageMap.setPages(this.mapPages(), cur.id);
        $('menu-map-name-v2').textContent = plainName((this.stageMap.viewed || ch).name);   // 머리 이름 = 지금 보는 구역 (번호 없이)
        $('btn-to-battle-v2').disabled = !isUnlocked(cur.id, progress) || !isCharacterReleased(progress.character);
        const stars = progress.stage(cur.id).stars.map(f => (f ? '★' : '☆')).join('');
        const enemies = Object.keys(cur.enemy.mix).map(k => ENEMY_TYPES[k].name).join(' · ');
        const best = progress.stage(cur.id).bestTime;
        const assist = Math.round(progress.assist(cur.id) * 100);   // 연패 보정 % (못 깬 판에서 진 만큼, difficulty_v2.js ASSIST)
        const shown = stageFor(cur, diff.id);   // 제한·별 시간은 난이도 배율 반영
        // 노말이 아니면 레이더 왼쪽 아래에 배율 요약
        const note = $('menu-diffnote-v2');
        if (note) {
            note.hidden = diff.id === 'normal';
            const mut = shown.mutator && MUTATORS[shown.mutator];   // 나이트메어 이번 주 전장 변이 (Q-006)
            note.innerHTML = diff.id === 'normal' ? '' : `<b>${diff.en}</b><span>적 체력 ×${diff.enemyHp} · 공격력 ×${diff.enemyDps} · 거점 ×${diff.base}</span>`
                + `<span>엘리트 속성 ${shown.affixCount}개${diff.bossHaste > 1 ? ' · 보스 기술 빨라짐' : ''} · 보상 ×${diff.reward}</span>`
                + (mut ? `<span class="v2-mutnote">이번 주 변이: ${mut.name} — ${mut.desc} (대응: ${mut.counter})</span>` : '');
        }
        $('menu-map-foot-v2').innerHTML = `<b>${cur.id} ${cur.name}</b> <span class="v2-stars">${stars}</span>`
            + `<span class="v2-radar__time">⏱ 제한 ${clock(shown.timeLimit)} · ★ ${shown.starTime}초 안에${best ? ` · 최고 ${clock(best)}` : ''}</span>`
            + (assist ? `<span class="v2-assist" title="이 판에서 진 만큼 적 체력·공격력이 낮아짐 — 깨면 원래대로">도전 보정 −${assist}%</span>` : '')
            + `<small>${cur.desc} · 적: ${enemies}${cur.boss ? ' · 보스' : ''}</small>`;
        $('menu-sortie-sub-v2').textContent = progress.isReady()
            ? `STAGE ${cur.id} ${cur.name}${diff.id === 'normal' ? '' : ` · ${diff.name}`} 출격` : '몸통 파츠 필요 — 연구소에서 구매';
        this.renderStageCard(cur, ch, diff, shown, assist);
    }

    /** 휴대폰 배치의 스테이지 카드: 구역(누르면 스테이지 선택) · 번호·이름 · 별 · 난이도 · (연패 보정) · 제한 시간 */
    renderStageCard(cur, ch, diff, shown, assist) {
        const card = $('menu-stage-card-v2');
        if (!card) return;
        const stars = progress.stage(cur.id).stars.map(f => `<i class="${f ? 'is-on' : ''}">${icon('star', 34)}</i>`).join('');
        const got = progress.starCount(cur.id);
        card.innerHTML = `<button class="v2-mstage__zone" data-act="stages">${plainName(ch.name).split(':')[0]}${icon('down', 26)}</button>`   // '제14 비밀 벙커' (구역 번호·부제 뺌, D-104)
            + `<div class="v2-mstage__title"><b>${cur.id}</b><strong>${cur.name}</strong></div>`
            + `<div class="v2-mstage__meta"><span class="v2-mstage__stars" aria-label="별 ${got}개 / 3개">${stars}</span>`
            + `<span class="v2-diffbadge" style="--diff:${diff.color}">${diff.name}</span>${cur.boss ? '<span class="v2-mstage__boss">보스</span>' : ''}`
            + (assist ? `<span class="v2-assist" aria-label="도전 보정 ${assist}%">보정 −${assist}%</span>` : '')
            + `<span class="v2-mstage__time" aria-label="제한 시간 ${clock(shown.timeLimit)}">${icon('clock', 30)}${clock(shown.timeLimit)}</span></div>`
            + `<button class="v2-mstage__pick" data-act="stages">${icon('map', 34)}스테이지 선택</button>`;
    }

    /** 메인 화면이 보일 때마다: 장착 상태로 캐릭터/설명/능력치/상태 줄 갱신, 레이더 시작 */
    updateDisplay() {
        this.updateOfflineReward();
        window.madOverlordGameV2?.tutorialUi?.update();
        if ($('menu-shop-badge-v2')) $('menu-shop-badge-v2').textContent = progress.canClaimPass() ? '●' : '';
        refreshCurrency();   // 별·조각·코어 · DM — 모든 화면 같은 표시줄 (currencyBar_v2.js)
        const badge = $('menu-support-badge-v2');   // 받을 파견이 있으면 빨간 점
        const dispatchDone = progress.dispatch.some(d => d.end <= Date.now());
        if (badge) badge.textContent = dispatchDone ? ' ' : '';
        if ($('rail-support-dot-v2')) $('rail-support-dot-v2').hidden = !dispatchDone;
        if ($('rail-shop-dot-v2')) $('rail-shop-dot-v2').hidden = !progress.canClaimPass();
        const equipped = gameState.getEquippedObjects();
        const coop = $('btn-menu-coop-v2');
        if (coop) updateSupportMenu(coop);
        monsterControllerV2.renderVisuals(equipped, progress.character);

        // 캐릭터 이름/팩션 (캐릭터는 선택창에서 고름 — 몸통을 아직 안 샀으면 흐린 모습)
        const portrait = monsterControllerV2.getPortrait();
        const body = equipped.body && equipped.body.id !== 'none' ? equipped.body : null;
        const ros = rosterOf(progress.character);
        $('menu-unit-name-v2').textContent = portrait ? portrait.name : 'OVERLORD';
        if (this.domFactionName) this.domFactionName.textContent = body ? body.faction : `${ros ? ros.faction : ''} · 몸통 파츠 없음 — 연구소에서 구매`;
        const tag = $('menu-unit-tag-v2');
        if (tag) {
            tag.textContent = body ? 'UNIT READY' : 'NO BODY';
            tag.classList.toggle('is-warn', !body);
        }
        const cls = $('menu-unit-class-v2');   // 휴대폰 배치 이름 옆 배지: '거대로봇 (메카닉)' → '메카닉'
        if (cls) {
            cls.textContent = body ? (/\(([^)]+)\)/.exec(body.faction)?.[1] || body.faction) : '몸통 없음';
            cls.classList.toggle('is-warn', !body);
        }

        this.renderCallouts(equipped);
        this.renderPartsRow(equipped);
        this.renderStats();
        this.renderStatusBar(equipped);
        if (this.map === 'story') this.renderStages();
        this.syncRadar();
    }

    /** 지도(STORY)·레이더(SPECIAL)는 보일 때만 움직임 — 휴대폰 배치에서는 스테이지 선택 창을 열었을 때만 */
    syncRadar() {
        const onMenu = gameState.currentScreen === 'menu' || !gameState.currentScreen;
        const shown = onMenu && (!isMobile() || !!this.root?.querySelector('.v2-menu.is-stages-open'));
        if (shown && this.map !== 'story') this.radar.start();
        else this.radar.stop();
        this.stageMap.setActive(shown && this.map === 'story');
    }

    updateOfflineReward() {
        updateOfflineRewardButton(this.offlineButton, gameState.currentScreen === 'menu' && !document.hidden);
    }

    renderCallouts(equipped) {
        const skills = skillsForParts(equipped);
        $('menu-callouts-v2').innerHTML = SLOTS.map(({ slot, label, role }, i) => {
            const part = equipped[slot];
            const has = part && part.id !== 'none';
            const sk = skills[slot];
            const leg = slot === 'leg' ? legPassiveOf(part) : null;
            const lv = has ? progress.levelOf(part.id) : 1;
            const skillLine = sk ? `<span style="--sk:${sk.color}">${icon(sk.icon, 12)}<i>${role === 'ULT' ? '필살기' : `스킬 ${role}`} · ${sk.name}</i></span>`
                : leg ? `<span><i>패시브 · ${leg.name}</i></span>` : '<span><i>—</i></span>';
            return `<li data-slot="${slot}" class="${i >= 2 ? 'is-right' : ''}">
                <b>${label}${lv > 1 ? ` · Lv${lv}` : ''}</b><strong>${has ? part.name : '비어 있음'}</strong>${skillLine}</li>`;
        }).join('');
    }

    /** 휴대폰 배치: 화면 아래 파츠 4칸 (머리·팔·몸통·다리 — 부위 · 파츠 이름 · 스킬, 11-04 디자인 제안) */
    renderPartsRow(equipped) {
        const list = $('menu-parts-list-v2');
        if (!list) return;
        const skills = skillsForParts(equipped);
        list.innerHTML = SLOTS.map(({ slot, ko, role }) => {
            const part = equipped[slot];
            const has = part && part.id !== 'none';
            const sk = skills[slot];
            const leg = slot === 'leg' ? legPassiveOf(part) : null;
            const lv = has ? progress.levelOf(part.id) : 1;
            // 칸이 좁아 역할(필살기·스킬 N·패시브)은 부위 옆에, 아래 줄은 아이콘 + 스킬 이름만
            const roleName = role === 'ULT' ? '필살기' : role === 'P' ? '패시브' : `스킬 ${role}`;
            const line = sk ? `${icon(sk.icon, 30)}${sk.name}` : leg ? `${icon('shield', 30)}${leg.name}` : '—';
            return `<li style="--sk:${sk ? sk.color : leg ? '#8b95a8' : 'var(--v2-dim)'}"><b>${ko} · ${roleName}${lv > 1 ? ` · Lv${lv}` : ''}</b>`
                + `<strong>${has ? part.name : '비어 있음'}</strong><em>${line}</em></li>`;
        }).join('');
    }

    renderStats() {
        const st = progress.equippedStats();   // 강화 레벨 반영
        // 아이콘은 휴대폰 배치에서만 (글자 이름 대신, Q-015)
        const rows = [['ARMOR', '체력', 'shield', st.hp], ['POWER', '공격력', 'bolt', st.dps], ['RANGE', '사거리', 'aim', st.range], ['SPEED', '이동 속도', 'speed', st.speed]];
        $('menu-stats-v2').innerHTML = rows.map(([k, ko, ic, v]) => `<div aria-label="${ko} ${Number(v).toLocaleString()}"><dt>${icon(ic, 32)}<span>${k}</span></dt><dd>${Number(v).toLocaleString()}</dd></div>`).join('');
    }

    renderStatusBar(equipped) {
        const skills = skillsForParts(equipped);
        const list = ['arm', 'body', 'head'].map(s => skills[s]).filter(Boolean)
            .map(sk => `<span class="v2-statusbar__skill" style="--sk:${sk.color}">${icon(sk.icon, 14)}${sk.name}</span>`).join('');
        const ready = !!(equipped.body && equipped.body.id !== 'none');
        $('menu-statusbar-v2').innerHTML = `
            <span><b>DARK MATTER</b><strong>${gameState.darkMatter.toLocaleString()}</strong></span>
            <span><b>SKILLS</b>${list || '<em>장착 스킬 없음</em>'}</span>
            <span><b>SQUAD</b><strong style="color:${ready ? 'var(--v2-green)' : 'var(--v2-amber)'}">${ready ? 'DEPLOYABLE' : 'NO BODY'}</strong></span>`;
    }

    /** 메인 화면을 떠날 때: 지도·레이더 멈춤, 휴대폰 배치의 창 닫기 */
    onLeave() {
        this.openStages(false);
        this.radar.stop();
        this.stageMap.setActive(false);
    }
}

