/* 무작위 규칙은 바꾸지 않고 성장 수치 표를 그대로 공개한다. */
import { OPTIONS, DROP, GRADES, RESEARCH } from '../engine_v2/growth_v2.js';
import { DIFFICULTIES } from '../engine_v2/difficulty_v2.js';
import { ROSTER } from '../engine_v2/roster_v2.js';
import { progress } from '../engine_v2/progress_v2.js';

export const percent = n => `${Number((n * 100).toFixed(4))}%`;
const GROUP_NAMES = { base: '기본·강화', rare: '레어 세트', unique: '유니크 세트', legendary: '레전더리 세트' };

/** 상점·확률 창 공통: 직접 열기, Escape, 초점 순환·복귀. */
export function commerceDialog(className, label) {
    const previous = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = `v2-commerce ${className}`;
    const panel = document.createElement('div');
    panel.className = 'v2-commerce__panel v2-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', label);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    let onClose = () => {};
    const close = () => {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        onClose();
        if (previous?.isConnected) previous.focus();
    };
    const onKey = e => {
        if (document.querySelector('.v2-commerce:last-of-type') !== overlay) return;
        if (e.key === 'Escape') {
            e.preventDefault(); e.stopImmediatePropagation(); close();
        } else if (e.key === 'Tab') {
            const items = [...panel.querySelectorAll('button:not(:disabled), select, [tabindex="0"]')].filter(el => el.offsetParent !== null);
            const index = items.indexOf(document.activeElement);
            if (index < 0 || (e.shiftKey ? index === 0 : index === items.length - 1)) {
                e.preventDefault(); items[e.shiftKey ? items.length - 1 : 0]?.focus();
            }
        }
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
    return { panel, overlay, close, onClose: fn => { onClose = fn; } };
}

export function probabilityHtml(character = progress.character) {
    const groups = progress.dropGroups(character);
    const optionCount = Object.keys(OPTIONS).length;
    const optionRows = Object.entries(OPTIONS).map(([id, o]) => `<tr data-option="${id}"><td>${o.name}</td><td>${o.desc}</td><td>${percent(1 / optionCount)}</td></tr>`).join('');
    const gradeRows = GRADES.map(g => `<tr><td>${g.name}</td><td>${g.options}개</td><td>${g.options ? percent(g.options / optionCount) : '0%'}</td></tr>`).join('');
    const dropRows = DIFFICULTIES.map(d => {
        const weights = Object.entries(DROP.poolWeights[d.id]).filter(([key]) => groups[key]?.length);
        const total = weights.reduce((sum, [, w]) => sum + w, 0);
        return `<tr data-difficulty="${d.id}"><td>${d.name}</td><td>${Object.entries(DROP.grades[d.id]).map(([g, n]) => `${GRADES.find(v => v.id === g).name} ${percent(n)}`).join(' · ')}</td>
            <td>${weights.map(([key, w]) => `${GROUP_NAMES[key]}: ${percent(w / total)} / ${groups[key].length}개, 개별 ${percent(w / total / groups[key].length)}`).join('<br>')}</td>
            <td>${DROP.firstClearGroups[d.id].map(key => GROUP_NAMES[key]).join(' → ')}</td></tr>`;
    }).join('');
    return `<p>DM 구매·조각 제작·조각 승급·판 드랍에서 등급에 필요한 옵션을 무작위로 채웁니다. 이미 붙은 옵션은 유지하며 같은 파츠에는 중복되지 않습니다.</p>
        <p>옵션 ${optionCount}종은 동일 확률. 처음 한 번은 각각 ${percent(1 / optionCount)}, 기존 옵션이 k개면 남은 각 옵션은 1/(${optionCount}−k)입니다. 수치는 고정이며 강도 추첨은 없습니다.</p>
        <table><thead><tr><th>옵션</th><th>고정 효과</th><th>첫 추첨 확률</th></tr></thead><tbody>${optionRows}</tbody></table>
        <table><thead><tr><th>최종 등급</th><th>옵션 수</th><th>처음부터 채울 때 특정 옵션 포함 확률</th></tr></thead><tbody>${gradeRows}</tbody></table>
        <p>DM 구매·조각 제작은 고른 파츠와 등급 바닥이 확정이고 옵션만 추첨합니다. 승급도 다음 등급이 확정이며 부족한 옵션만 추가합니다. 등급 추첨은 판 드랍에 적용합니다.</p>
        <p data-prob="drop">판 클리어 파츠 드랍 ${percent(DROP.chance)} + 구역 상성 ${percent(DROP.affinityBonus)}p + 드랍 감지기 단계당 ${percent(RESEARCH.dropRate.per)}p(최대 ${RESEARCH.dropRate.max}단계).
        보스 첫 클리어는 ${DROP.bossFirstClear ? '100% 확정(난이도별)' : '일반 확률'}입니다.</p>
        <p>출전 캐릭터의 묶음을 가중치로 뽑고 묶음 안에서 균등하게 하나를 뽑습니다. 없는 묶음은 빼고 다시 나눕니다. 아래 개별 확률은 드랍 성공 조건부이며, 실제 판당 확률은 드랍 확률을 곱합니다.</p>
        <table><thead><tr><th>난이도</th><th>추첨 등급</th><th>묶음 확률 / 파츠 수 / 파츠당 확률</th><th>첫 보스 확정 묶음 우선순위</th></tr></thead><tbody>${dropRows}</tbody></table>
        <p>세트 파츠는 추첨 등급보다 등급 바닥이 높으면 바닥을 적용합니다. 보스 확정은 첫 비어 있지 않은 우선 묶음 안에서 균등 추첨합니다. 같은 등급 이상을 보유하면 DM·조각으로 환급합니다.</p>
        <p>${Object.entries(DROP.refund).map(([g, r]) => `${GRADES.find(v => v.id === g).name}: ${r.dm} DM·조각 ${r.shards}`).join(' / ')}. 조각 회수 연구는 기존 환급 규칙대로 적용합니다.</p>`;
}

export function openProbInfo() {
    if (document.querySelector('.v2-prob-info')) return;
    const dialog = commerceDialog('v2-prob-info', '확률 정보');
    dialog.panel.innerHTML = `<header><h2>확률 정보</h2><button class="v2-btn v2-btn--ghost" data-close>닫기</button></header>
        <label>출전 캐릭터 <select data-character>${ROSTER.map(c => `<option value="${c.id}">${c.faction}</option>`).join('')}</select></label><div data-prob-body></div>`;
    const select = dialog.panel.querySelector('[data-character]');
    select.value = progress.character;
    const render = () => { dialog.panel.querySelector('[data-prob-body]').innerHTML = probabilityHtml(select.value); };
    select.addEventListener('change', render);
    dialog.panel.querySelector('[data-close]').addEventListener('click', dialog.close);
    render();
    dialog.panel.querySelector('[data-close]').focus();
}
