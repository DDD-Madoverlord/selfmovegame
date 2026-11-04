/* 작전 지원의 펫 카드. 사용자가 여는 탭 안에서만 표시한다. */
import { progress } from '../engine_v2/progress_v2.js';
import { gameState } from '../engine/state.js';
import { PETS, PET_MAX_LEVEL, petValue, isPetReleased } from '../engine_v2/pets_v2.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const percent = n => `${Number((n * 100).toFixed(2))}%`;

export function petEffectText(id, level) {
    const p = PETS[id], value = percent(petValue(id, level));
    return { battleDm: `전투 DM +${value}`, cdr: `스킬 1·2 재사용 시간 −${value}`,
        offlineDm: `방치 DM +${value}`, attack: `기본 DPS ${value} · 2초마다 자동 공격` }[p.effect];
}

export function petsHtml() {
    const cards = Object.entries(PETS).map(([id, p]) => {
        const own = progress.ownsPet(id), usable = progress.canUsePet(id), equipped = progress.pets.equipped === id && usable;
        const lv = progress.petLevel(id), cost = progress.petUpgradeCost(id), released = isPetReleased(id);
        const picture = p.art.startsWith('shape:') ? `data-shape="${esc(p.art.slice(6))}"` : '';
        const art = p.art.startsWith('shape:') ? '' : `<img src="${esc(p.art)}" alt="">`;
        const status = !released ? '공개 예정' : equipped ? '장착 중' : own ? usable ? '보유' : '사용 권한 없음' : '미보유';
        const condition = p.stars ? `${Math.min(p.stars, progress.normalPetStars())}/${p.stars}별`
            : `${progress.stage(p.stage, 'normal').cleared ? 1 : 0}/1회 클리어`;
        return `<article class="v2-petcard${equipped ? ' is-equipped' : ''}${own ? ' is-own' : ''}" data-pet="${id}" style="--pet-color:${p.color}">
            <div class="v2-petcard__head"><span class="v2-pet" ${picture} aria-hidden="true">${art}</span><div><b>${p.name}</b><small>${status}${own ? ` · Lv${lv}/${PET_MAX_LEVEL}` : ''}</small></div></div>
            <p>${petEffectText(id, lv)}</p>
            ${own ? `<small>${lv < PET_MAX_LEVEL ? `다음: ${petEffectText(id, lv + 1)}` : '최대 레벨'}</small>` : `<small>${p.condition}<br>노말 진행: ${condition}</small>`}
            <div class="v2-petcard__acts">${usable ? `<button data-act="equipPet" data-id="${equipped ? '' : id}">${equipped ? '해제' : '장착'}</button>`
                + (cost ? `<button data-act="upPet" data-id="${id}" ${gameState.darkMatter < cost.dm || progress.shards < cost.shards ? 'disabled' : ''}>레벨 올리기 · ${cost.dm.toLocaleString()} DM · 조각 ${cost.shards}</button>` : '<span class="is-max">MAX</span>') : ''}</div>
        </article>`;
    }).join('');
    return `<p class="v2-growth__hint">계정 공통으로 한 마리만 장착합니다. 보유만 하면 효과는 없으며, 캐릭터를 바꿔도 장착을 유지합니다.</p>
        <div class="v2-petgrid">${cards}</div>`;
}

export function petAct(name, data) {
    return name === 'equipPet' ? progress.equipPet(data.id || null) : name === 'upPet' ? progress.upgradePet(data.id) : null;
}
