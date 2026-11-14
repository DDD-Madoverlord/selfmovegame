import { progress } from '../engine_v2/progress_v2.js';
import { ROSTER, rosterOf } from '../engine_v2/roster_v2.js';
import { isCharacterReleased } from '../engine_v2/contentSchedule_v2.js';
import { SUPPORT, supportUnitOf, supportPairText } from '../engine_v2/support_v2.js';
import { RIG_CHARACTERS } from '../engine_v2/rig/characters.js';
import { icon } from './icons.js';

export function supportPortrait(id) {
    return RIG_CHARACTERS[id] ? `${RIG_CHARACTERS[id].assetDir}head.png` : '';
}

export function supportSummary() {
    const id = progress.supportCharacter;
    if (id && progress.supportReason(id)) return `${rosterOf(id)?.faction || id} · ${progress.supportReason(id)} — 다시 편성`;
    if (id) return `${progress.supportRandom ? '랜덤 편성 · ' : ''}${rosterOf(id)?.faction || id} · ${progress.supportAuto ? '자동 호출' : '수동 Q'}`;
    return progress.supportCandidates().length ? `지원 캐릭터를 편성하세요 · ${progress.supportCooldown()}초 재충전` : '다른 캐릭터를 해금하고 파츠 4부위를 준비하세요';
}

export function updateSupportMenu(button) {
    const id = progress.supportCharacter;
    const character = id && rosterOf(id);
    const reason = id && progress.supportReason(id);
    const available = !id && progress.supportCandidates().length > 0;
    const portrait = button.querySelector('img');
    const src = character ? supportPortrait(id) : '';
    portrait.hidden = !src;
    if (src && portrait.getAttribute('src') !== src) portrait.src = src;
    if (!src) portrait.removeAttribute('src');
    button.querySelector('.v2-coop-menu__label').hidden = !character;
    button.querySelector('strong').textContent = character ? character.faction : '협력 출격';
    const detail = character ? (reason ? `${reason} · 다시 편성` : supportUnitOf(id).brief)
        : available ? '지원 캐릭터를 편성하세요' : '다른 캐릭터 해금 · 파츠 4부위 필요';
    button.querySelector('small').textContent = detail;
    button.classList.toggle('is-selected', !!character);
    button.classList.toggle('needs-selection', !!available);
    button.classList.toggle('is-warn', !!reason);
    button.title = button.ariaLabel = `협력 출격 · ${character ? `${character.faction} · ` : ''}${detail}`;
}

export function supportHtml() {
    const selected = progress.supportCharacter;
    const candidates = progress.supportCandidates();
    const invalid = selected && progress.supportReason(selected);
    // 공개 전 캐릭터(숨김 그룹)는 목록에 안 나옴 — 선택창은 '???'로 가리는데 여기는 이름·얼굴·필살기가 그대로 보였음 (11-14 버그 점검 L3)
    const cards = ROSTER.filter(c => isCharacterReleased(c.id)).map(c => {
        const reason = progress.supportReason(c.id);
        const def = supportUnitOf(c.id);
        const on = selected === c.id;
        return `<button class="v2-coop-card${on ? ' is-selected' : ''}" data-act="selectSupport" data-id="${c.id}"
            style="--support:${c.color}" ${reason ? 'disabled' : ''} aria-pressed="${on}">
            <img src="${supportPortrait(c.id)}" alt="" loading="lazy"><div class="v2-coop-card__content"><div class="v2-coop-card__heading"><b>${c.faction}</b><span class="v2-coop-card__selected" aria-hidden="true">✓ 선택됨</span></div><small>${def.role}</small>
            <strong>${icon(def.icon, 16)} ${def.ult}</strong><p>${supportPairText(c.id, progress.character)}</p>
            <em>${reason || (on ? '편성 완료' : '편성 가능')}</em></div></button>`;
    }).join('');
    return `<p class="v2-growth__hint">머리·몸통·팔·다리 파츠를 모두 보유한 다른 캐릭터 1명이 ${SUPPORT.duration + progress.mainSetPerk('supportTime')}초 동안 지원하고 대표 필살기를 ${SUPPORT.ultimateTimes.length}회 사용합니다. 첫 호출은 전투 시작 후 ${progress.supportCooldown()}초 충전, 이후에도 사용 시점부터 ${progress.supportCooldown()}초마다 재충전 (기본 ${SUPPORT.cooldown}초, 계정 연구·세트 효과로 단축) · 무료 · Q 또는 지원 초상화로 호출.
        충전은 최대 1회분, 동시 출격은 1명입니다. 일시정지 중에는 충전과 출격 시간이 멈추며, 2배속에서는 두 배 빠르게 진행됩니다.</p>
        <p class="v2-growth__hint">근접 공격 장비의 지원은 적 앞의 공격 사거리 안에 등장하고, 원거리 장비는 주인공 주변에서 등장합니다. 방벽 너머로 소환되지 않으며, 근접 지원은 첫 대상 처치 후 가까운 다음 적에게 한 번 짧게 돌진할 수 있어요.</p>
        <p class="v2-growth__hint">대표 필살기는 지원 전용이며 장착 머리의 기술과 다를 수 있습니다. 능력치는 출격 당시 보유 장비·강화·등급·옵션과 장착 머리의 스킬 레벨을 반영합니다.</p>
        <div class="v2-coop-controls"><button data-act="selectSupport" class="${!selected ? 'is-on' : ''}">지원 없음</button>
        <button data-act="randomSupport" ${candidates.length ? '' : 'disabled'}>보유 캐릭터 중 랜덤 편성</button>
        <button data-act="supportAuto" aria-pressed="${progress.supportAuto}">지원 자동 호출 ${progress.supportAuto ? 'ON' : 'OFF'}</button></div>
        <p class="v2-coop-summary${invalid ? ' is-warn' : ''}" role="status">${supportSummary()}</p>
        <div class="v2-coop-grid">${cards}</div>
        <p class="v2-growth__hint">시너지는 출격 중에만 적용됩니다. 추천 연계 외의 조합도 효과를 받을 수 있어요. 지원 소환수·보호막·표식은 철수 때 종료됩니다.
        자동 호출은 일반 스킬 AUTO와 독립적이며 보스·다수의 적·체력 저하·최종 거점을 보고 판단합니다. 파견 중인 캐릭터는 편성할 수 없습니다.</p>`;
}
