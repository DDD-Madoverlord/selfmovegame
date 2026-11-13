/* ==========================================================================
   PROJECT: MAD OVERLORD // 첫 출격 안내 (2026-10-24, 로드맵 "처음 하는 사람용 다듬기")
   처음 한 번만 뜨는 말풍선. 가리킬 단추 위에 붙고, 누를 수 없으며(pointer-events 없음 — 조작을 막지 않음)
   몇 초 뒤 저절로 사라진다. 본 안내는 progress.tips에 저장(설정 창의 진행 초기화 때 같이 지워짐).
   부르는 곳: battle_v2.js(출격 인트로 뒤) · battleHud_v2.js(필살기 첫 준비) · enemyField.js(첫 요새·첫 최종 기지) · battle/player.js(첫 과부하)
     · main_v2.js(전투 뒤 메인 화면, 강화할 수 있을 때 연구소 강화 단추 — 2026-11-03 튜토리얼 세부)
   ========================================================================== */

import { progress } from '../engine_v2/progress_v2.js';
import { OVERLOAD } from '../engine_v2/battle/tuning.js';

// short: 휴대폰 배치(Q-015 전투 시안 A)에서 쓰는 짧은 한 줄 — 키보드 설명 없이
export const COACH = {
    battle_skills: { text: '캐릭터는 알아서 걷고 싸웁니다<br>스킬은 <kbd>1</kbd> <kbd>2</kbd> 키나 단추로 — <b>AUTO</b>를 켜면 자동', short: '스킬을 눌러 보세요', sec: 7 },
    battle_ult: { text: '필살기 준비 완료! <kbd>3</kbd> 키나 단추<br>요새·기지·보스 앞에서 쓰면 좋아요', short: '<b>필살기</b> 준비 완료!', sec: 6 },
    battle_base: { text: '요새를 부수면 별 1개, 최종 기지를 부수면 승리<br>이 시계가 <b>제한 시간</b>입니다', short: '요새 = 별 1개 · 기지 = <b>승리</b>', sec: 7, side: 'bottom' },
    battle_final: { text: '<b>최종 기지</b> 등장 — 부수면 승리<br>아껴 둔 필살기는 지금 쓰세요', short: '<b>최종 기지</b> — 필살기를 쓰세요', sec: 6, side: 'bottom' },
    battle_overload: { text: `내구도가 0이 되면 <b>${OVERLOAD.sec}초 긴급 수리</b> 뒤 ${Math.round(OVERLOAD.restore * 100)}%로 돌아와요<br>자주 멈추면 몸통을 강화하세요`, short: `<b>${OVERLOAD.sec}초 수리</b> 뒤 다시 싸워요`, sec: 7, side: 'bottom' },
    menu_lab: { text: '얻은 <b>DM</b>으로 연구소에서<br>파츠를 사고 강화하세요', short: '<b>연구소</b>에서 파츠 강화', sec: 9 },
    lab_upgrade: { text: '장착한 파츠를 골라 <b>강화</b><br>레벨마다 체력·공격력이 올라요', sec: 8 },
    offline_intro: { text: '접속하지 않아도 DM이 쌓여요<br><b>방치 보상</b>에서 직접 받으세요', short: '<b>방치 보상</b>을 받으세요', sec: 7, side: 'bottom' },
    pet_intro: { text: '펫을 처음 얻었어요!<br><b>작전 지원 → 펫</b>에서 장착하세요', short: '<b>펫</b>을 장착하세요', sec: 7, side: 'bottom' },
    stamina_intro: { text: '이제 출격할 때 <b>피로도</b>를 써요 (노말 6)<br>6분마다 1씩 차고, 진 판은 거의 돌려받아요', short: '<b>피로도</b> — 6분마다 1 · 진 판은 돌려받음', sec: 9, side: 'bottom' },
    shop_intro: { text: '<b>상점</b>에서 상품을 확인할 수 있어요<br>확률 정보는 <b>설정 › 정보</b>에', short: '<b>상점</b>이 열렸어요', sec: 7, side: 'bottom' }
};

/** 안내 id를 아직 안 봤으면 anchor(요소 또는 선택자) 옆에 말풍선. 돌려주는 값: 말풍선 요소 또는 null */
export function coach(id, anchor, { remember = true } = {}) {
    const c = COACH[id];
    if (!c || (remember && progress.hasTip(id))) return null;
    // 선택자를 쉼표로 여럿 주면 앞에서부터 보이는 것 (PC 단추 / 휴대폰 배치 메뉴 줄 단추)
    const a = typeof anchor === 'string'
        ? anchor.split(',').map(sel => [...document.querySelectorAll(sel)].find(n => n.getClientRects().length)).find(Boolean)
        : anchor;
    if (!a || !a.getClientRects().length) return null;
    if (remember) progress.markTip(id);
    const host = a.closest('.screen-v2') || document.body;
    const el = document.createElement('div');
    const side = c.side || 'top';
    el.className = `v2-coach is-${side}`;
    el.innerHTML = `<p>${(document.body.classList.contains('v2-mobile') && c.short) || c.text}</p>`;
    host.appendChild(el);
    // 화면 맞춤 배율(transform)을 풀어 host 안 좌표로: 가리킬 단추의 가운데 위(아래)
    const hr = host.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const k = hr.width / (host.offsetWidth || hr.width) || 1;
    const half = el.offsetWidth / 2 + 8;
    const x = Math.max(half, Math.min((host.offsetWidth || hr.width) - half, (ar.left + ar.width / 2 - hr.left) / k));
    el.style.left = `${x}px`;
    el.style.top = `${((side === 'bottom' ? ar.bottom : ar.top) - hr.top) / k}px`;
    el.style.setProperty('--arrow', `${(ar.left + ar.width / 2 - hr.left) / k - x}px`);
    setTimeout(() => el.classList.add('is-out'), c.sec * 1000);
    setTimeout(() => el.remove(), c.sec * 1000 + 400);
    return el;
}
