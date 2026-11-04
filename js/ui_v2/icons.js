/* ==========================================================================
   PROJECT: MAD OVERLORD // UI 아이콘 (v2)
   코드로 그린 SVG 아이콘 (24x24 기준). 색은 currentColor → CSS color로 지정.
   icon(name, size) 로 SVG 문자열을 얻는다.
   ========================================================================== */

const P = {
    // ---- 시스템 ----
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    speed: '<path d="M4 5.5v13l8-6.5zM12 5.5v13l8-6.5z"/>',
    auto: '<path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3 4.5l1.8 5.2 5-2.2z"/><text x="12" y="16" text-anchor="middle" font-size="8" font-weight="900" font-family="Orbitron, sans-serif">A</text>',
    retreat: '<path d="M6 3v18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M7 4h11l-3 4 3 4H7z"/>',
    star: '<path d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.7l-5.6 3.1 1.3-6.2L3 9.3l6.3-.7z"/>',
    fort: '<path d="M4 20V9l2-1.5V5h2v1.5L10 5h4l2 1.5V5h2v2.5L20 9v11h-6v-5h-4v5z"/>',
    hq: '<path d="M12 2l3 4h-2v3h5l2 3v9H4v-9l2-3h5V6H9z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M9 3l3 6 3-6M12 21l-3-12M12 21l3-12" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>',
    // 오버로드 문장: 뿔 달린 투구 + 빛나는 눈
    overlord: '<path d="M3 3l4 5 2-3 3 3 3-3 2 3 4-5-1 9c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10z"/><path d="M8 12.5l3 1.2v1.3l-3-.8zM16 12.5l-3 1.2v1.3l3-.8z" fill="rgba(0,0,0,.7)"/><path d="M10 18h4" stroke="rgba(0,0,0,.7)" stroke-width="1.4"/>',
    acid: '<path d="M12 2.5c3.2 5 6.5 8.6 6.5 12.3a6.5 6.5 0 0 1-13 0C5.5 11.1 8.8 7.5 12 2.5z"/><circle cx="9.5" cy="15" r="1.6" fill="rgba(0,0,0,.35)"/><circle cx="13.5" cy="18" r="1.1" fill="rgba(0,0,0,.35)"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="11" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="15.5" r="1.8" fill="rgba(0,0,0,.6)"/>',
    gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.3 2.3l-1.9-.4a6.6 6.6 0 0 0-.8-1.9l1.1-1.6-1.8-1.8-1.6 1.1a6.6 6.6 0 0 0-1.9-.8l-.4-1.9h-2.6l-.4 1.9a6.6 6.6 0 0 0-1.9.8L6.5 5.2 4.7 7l1.1 1.6a6.6 6.6 0 0 0-.8 1.9l-1.9.4v2.6l1.9.4c.2.7.4 1.3.8 1.9l-1.1 1.6 1.8 1.8 1.6-1.1c.6.4 1.2.6 1.9.8l.4 1.9h2.6l.4-1.9c.7-.2 1.3-.4 1.9-.8l1.6 1.1 1.8-1.8-1.1-1.6c.4-.6.6-1.2.8-1.9l1.9-.4z"/>',

    // ---- 스킬 ----
    fist: '<path d="M6 10.5V7.8a1.8 1.8 0 0 1 3.6 0v-1a1.8 1.8 0 0 1 3.6 0v.6a1.8 1.8 0 0 1 3.6 0v1a1.8 1.8 0 0 1 3.2 1.1v5.8a6 6 0 0 1-6 6h-2.5A5.5 5.5 0 0 1 6 15.8z"/><path d="M3 6l2 1.5M2.5 10H5M3.5 14l2-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    laser: '<rect x="2" y="9" width="7" height="6" rx="1.5"/><path d="M9 11h13v2H9z"/><path d="M9 9.2l13 1.6M9 14.8l13-1.6" stroke="currentColor" stroke-width="1" opacity=".6"/><circle cx="21" cy="12" r="2.2"/>',
    missile: '<path d="M4 17l9.5-9.5 3-.8-.8 3L6.2 19.2z"/><path d="M13.5 7.5L19 2l3 3-5.5 5.5"/><path d="M4.5 14.5L2 14l3.5-3.5 2 .5M9.5 19.5l.5 2.5 3.5-3.5-.5-2"/>',
    claw: '<path d="M5 3c3 4 4 9 2 18M11 2c3 5 3.5 11 1 20M17 3c3 4 3.5 9 1.5 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    wave: '<path d="M6 3a11 11 0 0 1 0 18 8 8 0 0 0 0-18zM12 5a8 8 0 0 1 0 14 5.5 5.5 0 0 0 0-14zM17 7.5a5 5 0 0 1 0 9 3 3 0 0 0 0-9z"/>',
    shield: '<path d="M12 2l8 3v6.5c0 5-3.5 8.8-8 10.5-4.5-1.7-8-5.5-8-10.5V5z"/><path d="M12 6l3.5 2v4l-3.5 2-3.5-2V8z" fill="rgba(0,0,0,.35)"/>',
    minions: '<circle cx="8" cy="7" r="3"/><circle cx="16.5" cy="8" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0zM12.5 20a4.3 4.3 0 0 1 8.5 0z"/><path d="M6 4.5l-1-2.5M10 4.5l1-2.5" stroke="currentColor" stroke-width="1.6"/>',
    egg: '<path d="M12 2c4 0 6.8 6.5 6.8 11A6.8 6.8 0 0 1 5.2 13C5.2 8.5 8 2 12 2z"/><circle cx="10" cy="10" r="1.4" fill="rgba(0,0,0,.35)"/><circle cx="14" cy="14.5" r="1.8" fill="rgba(0,0,0,.35)"/><circle cx="9.5" cy="16" r="1.1" fill="rgba(0,0,0,.35)"/>',
    // 심연의 길잡이: 앵커 · 물살 · 유령 손
    anchor: '<circle cx="12" cy="4.5" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v13M7.5 10.5h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 13.5c.5 4.5 4 7 8.5 7s8-2.5 8.5-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M2 15.5l1.5-3 3 1.6M22 15.5l-1.5-3-3 1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    surge: '<path d="M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0v4c-1.5-3-3.5-3-5 0s-5 3-7.5 0-5-3-7.5 0z"/><path d="M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="19" cy="4.5" r="1.5"/><circle cx="15" cy="3.5" r="1"/>',
    hand: '<path d="M7 22v-7.5L4.2 10a1.6 1.6 0 0 1 2.7-1.7L8.5 11V4.5a1.5 1.5 0 0 1 3 0V10V3a1.5 1.5 0 0 1 3 0v7V4.5a1.5 1.5 0 0 1 3 0V11V7a1.5 1.5 0 0 1 3 0v8c0 3.5-2 7-5 7z"/><path d="M3 22h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/>',
    // 봉합 성녀: 주사기 · 조준 원(생명 봉인) · 붉은 십자(억지 부활) · 봉합 표식
    syringe: '<path d="M14.5 2.5l7 7-1.7 1.7-1.3-1.3-7.6 7.6-3 .6.6-3 7.6-7.6-1.3-1.3z"/><path d="M5.6 15.4l3 3L3 24l-1-1-1-1z"/><path d="M10.5 9.5l1.4 1.4M12.6 7.4L14 8.8" stroke="rgba(0,0,0,.45)" stroke-width="1.3"/>',
    sealring: '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2.2"/>',
    redcross: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/><path d="M12 4.5v15M4.5 12h15" stroke="rgba(255,255,255,.55)" stroke-width="1.3" stroke-dasharray="2 2"/>',
    // 철거의 설계자 · 침묵의 방송자 (D-079): 드릴 · 비계 · 스피커 · 소리굽쇠 · 침묵
    drill: '<path d="M2 9h8l2-2h3v10h-3l-2-2H2z"/><path d="M15 9.5h3l4 2.5-4 2.5h-3z"/><path d="M16 10l1.5 4M18.5 10.8l.8 2.4" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/><path d="M4 15v4h3v-4" />',
    scaffold: '<path d="M3 21V3M21 21V3M12 21V5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M3 8h18M3 14h18M3 20h18M3 8l9 6M12 8l9 6" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    speaker: '<rect x="3" y="2.5" width="18" height="19" rx="2.5"/><circle cx="12" cy="14.5" r="4.6" fill="rgba(0,0,0,.45)"/><circle cx="12" cy="14.5" r="1.8"/><circle cx="12" cy="6.5" r="1.8" fill="rgba(0,0,0,.45)"/>',
    fork: '<path d="M7 2v9a5 5 0 0 0 10 0V2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 16v6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M3 5.5a8 8 0 0 0 0 6M21 5.5a8 8 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>',
    mute: '<path d="M3 9h4l5-5v16l-5-5H3z"/><path d="M15.5 8.5l6 7M21.5 8.5l-6 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    stitch: '<path d="M2 12h20" stroke="currentColor" stroke-width="2.4"/><path d="M5.5 6.5l2.5 11M11 6.5l2.5 11M16.5 6.5l2.5 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    // 서리의 무희: 부채 · 초승달 · 얼음 속 사람 · 눈꽃(냉기·빙결 상태)
    fan: '<path d="M12 21L2.5 8.5A13 13 0 0 1 21.5 8.5z"/><path d="M12 21l-6.5-12M12 21L9.5 6M12 21l2.5-15M12 21l6.5-12" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><circle cx="12" cy="20.5" r="1.6"/>',
    crescent: '<path d="M14 2.5a9.5 9.5 0 1 0 7.5 15.2A11 11 0 0 1 14 2.5z"/><path d="M20 3l1 2.2 2.2.8-2.2.8L20 9l-.8-2.2-2.2-.8 2.2-.8z"/>',
    icecage: '<path d="M4 22L7 6l3 7 2-11 2 11 3-7 3 16z"/><circle cx="12" cy="15" r="2.4" fill="rgba(0,0,0,.45)"/><path d="M9.5 21c0-2.5 1.1-3.6 2.5-3.6s2.5 1.1 2.5 3.6" fill="rgba(0,0,0,.45)"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    // 뒤틀린 인형사: 가위 · 토끼 인형 · 꼭두각시 (상태 아이콘도 꼭두각시)
    scissors: '<circle cx="6" cy="18" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="18" cy="18" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 15.5L20 2.5M16 15.5L4 2.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    rabbit: '<path d="M8.5 9C7 5.5 7 2 8.5 1.5s2.5 3.5 2.2 7.2M15.5 9c1.5-3.5 1.5-7 0-7.5s-2.5 3.5-2.2 7.2" stroke="currentColor" stroke-width="2" fill="currentColor"/><circle cx="12" cy="13" r="5.5"/><path d="M8 18.5h8l1 4H7z"/><circle cx="10" cy="12.5" r="1" fill="rgba(0,0,0,.6)"/><circle cx="14" cy="12.5" r="1" fill="rgba(0,0,0,.6)"/>',
    puppet: '<path d="M3 2h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 2v7M17 2v7M12 2v4" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="9" r="3"/><path d="M8.5 13h7l1 6h-2.5l-.5 3h-3l-.5-3H7.5z"/><path d="M8.5 13L6 10M15.5 13L18 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    // ---- 상태 (적 체력바 옆) ----
    slow: '<path d="M4 4l8 7 8-7v5l-8 7-8-7z"/><path d="M4 12l8 7 8-7v4l-8 6-8-6z" opacity=".6"/>',
    net: '<path d="M3 5l18 14M21 5L3 19M3 12h18M8 4l-2 16M16 4l2 16" fill="none" stroke="currentColor" stroke-width="2"/>',
    stun: '<path d="M12 3l1.8 3.8 4.2.5-3.1 2.9.8 4.1L12 12.2l-3.7 2.1.8-4.1L6 7.3l4.2-.5z"/><ellipse cx="12" cy="18" rx="9" ry="3" fill="none" stroke="currentColor" stroke-width="2"/>',
    curse: '<path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.3 2.8 5.5V19h9.4v-3.5c1.5-1.2 2.8-2.9 2.8-5.5A7.5 7.5 0 0 0 12 2.5z"/><circle cx="9" cy="10.5" r="1.9" fill="rgba(0,0,0,.55)"/><circle cx="15" cy="10.5" r="1.9" fill="rgba(0,0,0,.55)"/><path d="M9 19v2.5M12 19v2.5M15 19v2.5" stroke="currentColor" stroke-width="1.6"/>',
    drone: '<circle cx="12" cy="12" r="4"/><path d="M12 12L5 5M12 12l7-7M12 12l-7 7M12 12l7 7" stroke="currentColor" stroke-width="2"/><circle cx="4.5" cy="4.5" r="2.5"/><circle cx="19.5" cy="4.5" r="2.5"/><circle cx="4.5" cy="19.5" r="2.5"/><circle cx="19.5" cy="19.5" r="2.5"/><circle cx="12" cy="12" r="1.6" fill="rgba(255,255,255,.9)"/>',
    roar: '<path d="M3 9l6-3 3 2 5-1-2 4 4 1-5 2 1 4-4-2-3 3-1-4-4 1 2-3z"/><path d="M19 5a9 9 0 0 1 0 14M21.5 3a12 12 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    mind: '<path d="M12 5C6.5 5 2.8 9.3 2 12c.8 2.7 4.5 7 10 7s9.2-4.3 10-7c-.8-2.7-4.5-7-10-7z"/><path d="M12 8.2a3.8 3.8 0 1 1-3.6 5 2.4 2.4 0 1 0 2.3-3.2" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.8" stroke-linecap="round"/>',
    rampage: '<path d="M12 1.5l2.2 5.6 5.8-2.4-2.4 5.8 5.4 1.5-5.4 2 2.4 5.8-5.8-2.4L12 22.5l-2.2-5.1-5.8 2.4 2.4-5.8-5.4-2 5.4-1.5L4 4.7l5.8 2.4z"/><circle cx="12" cy="12" r="3.2" fill="rgba(255,255,255,.85)"/>',

    // ---- A·B 세트 스킬 (D-050) ----
    orbital: '<rect x="9" y="2" width="6" height="4" rx="1"/><path d="M3 3h5v2H3zM16 3h5v2h-5z"/><path d="M11 6h2v9h-2z"/><path d="M5 21h14l-7-6z"/>',
    turret: '<rect x="3" y="13" width="9" height="7" rx="1.5"/><circle cx="7.5" cy="12" r="3.5"/><path d="M10 10.5h11v3H10z"/><path d="M19 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    rail: '<path d="M2 10h15v4H2z"/><path d="M5 7.5v9M9 7.5v9M13 7.5v9" stroke="currentColor" stroke-width="1.8"/><path d="M17 11h5v2h-5z"/>',
    overdrive: '<path d="M12 2l5.5 7.5h-3.5v4.5h-4V9.5H6.5z"/><path d="M6 15.5h12v2.2H6zM8 19.5h8v2.2H8z"/>',
    rocket: '<path d="M21 3c-6.5 0-10.5 4-12.5 9.5l3 3C17 13.5 21 9.5 21 3z"/><circle cx="15.5" cy="8.5" r="1.8" fill="rgba(0,0,0,.4)"/><path d="M8 13l-5 1.5 2.5 2.5L4 21l4-1.5 2.5 2.5 1.5-5z"/>',
    pile: '<path d="M2 8.5h9v7H2z"/><path d="M11 10.5h11v3H11z"/><path d="M18 7.5l4 4.5-4 4.5" fill="none" stroke="currentColor" stroke-width="2"/>',
    spikes: '<path d="M12 1.5l2.5 7h-5zM3.5 6.5l6 4-3.2 3zM20.5 6.5l-2.8 7-3.2-3zM2.5 18l7.5-2.5v4.5zM21.5 18L14 15.5v4.5z"/><circle cx="12" cy="14.5" r="3.2"/>',
    oath: '<path d="M12 2c1.2 4.2 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.8 1.5-4.5 2.8-6 .3 1.7 1.1 2.8 2.3 3.4C11.3 7.8 11 5 12 2z"/><path d="M12 13.5l1.6 2.4-1.6 2.4-1.6-2.4z" fill="rgba(0,0,0,.45)"/>',
    thorns: '<path d="M12 3.5l7 3v5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5v-5z"/><path d="M12 0.5l1.6 3h-3.2zM21.8 5.5L20.6 9l-2.2-2.3zM2.2 5.5L3.4 9l2.2-2.3zM12 23.5l1.6-3h-3.2z"/>',
    slam: '<path d="M8 2h8v8l2.5 2v3.5h-13V12L8 10z"/><path d="M2 21.5l5.5-4 2 3 2.5-4.5 2.5 4.5 2-3 5.5 4z"/>',
    breath: '<path d="M6.5 18.5a4 4 0 0 1-.6-8 5.6 5.6 0 0 1 10.9-1.4 4.6 4.6 0 0 1 .7 9.4z"/><circle cx="9.5" cy="14.5" r="1.3" fill="rgba(0,0,0,.35)"/><circle cx="14.5" cy="15" r="1.7" fill="rgba(0,0,0,.35)"/>',
    spore: '<circle cx="12" cy="12" r="5"/><circle cx="4.5" cy="5.5" r="2.2"/><circle cx="19.5" cy="5" r="2.4"/><circle cx="4.5" cy="19" r="2.4"/><circle cx="19.5" cy="19" r="2"/>',
    sword: '<path d="M20.5 1.5l2 2L11 15l-3-3z"/><path d="M5 12.5l6.5 6.5-1.6 1.6-1.8-1.1-3.6 3.5-2.5-2.5 3.5-3.6-1.1-1.8z"/>',
    blood: '<path d="M12 2c3.5 5 6.5 8.5 6.5 12.5a6.5 6.5 0 0 1-13 0C5.5 10.5 8.5 7 12 2z"/><path d="M9 15.5a3 3 0 0 0 3 3" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6"/>',
    whirl: '<path d="M12 4a8 8 0 1 1-8 8h3a5 5 0 1 0 5-5z"/><path d="M12 0.5l3.5 3.5L12 7.5z"/>',
    clone: '<circle cx="9" cy="6.5" r="3.2"/><path d="M3 21.5a6 6 0 0 1 12 0z"/><circle cx="16.5" cy="7.5" r="2.7" opacity=".5"/><path d="M12 21.5a5 5 0 0 1 9.5 0z" opacity=".5"/>',
    chain: '<rect x="1.5" y="8.5" width="10" height="7" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="12.5" y="8.5" width="10" height="7" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.5 12h7" stroke="currentColor" stroke-width="2.4"/>',
    blackhole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5h-2.6A6.9 6.9 0 0 0 12 5.1zM12 21.5A9.5 9.5 0 0 1 2.5 12h2.6a6.9 6.9 0 0 0 6.9 6.9z"/>',
    maul: '<path d="M2 9h10.5L9.5 5h4.5l6.5 7-6.5 7H9.5l3-4H2z"/>',
    injector: '<path d="M15 2.5l6.5 6.5-2 2-1-1-8 8-3.5 1 1-3.5 8-8-1-1z"/><path d="M2.5 21.5l3-3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    hammer: '<rect x="2.5" y="3" width="13" height="7.5" rx="1.2"/><path d="M7.5 10.5h3.2v11H7.5z"/><path d="M15.5 5h3v3.5h-3z"/>',
    horn: '<path d="M2.5 9.5h4.5l9.5-6.5v18L7 14.5H2.5z"/><path d="M19 8a5.5 5.5 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fire: '<path d="M12 1.5c1 4.2 6.5 6.3 6.5 12.5a6.5 6.5 0 0 1-13 0c0-3.3 2-5.4 3.2-6.4 0 2.2 1 3.4 2.1 3.4 0-3.2-1-6.4 1.2-9.5z"/>',

    // ---- 휴대폰 배치 (Q-015 메인 시안 B · 전투 시안 A): 메뉴 줄, 능력치, 재화, 상태 ----
    person: '<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>',
    flask: '<path d="M9 2h6v2h-1v5l6 10a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 19l6-10V4H9z"/>',
    cart: '<path d="M3 4h2.5l2.2 10.5h10.3L20.5 8H6.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.8"/><circle cx="17" cy="19" r="1.8"/>',
    paw: '<circle cx="6.5" cy="10" r="2.2"/><circle cx="17.5" cy="10" r="2.2"/><circle cx="9.8" cy="5.8" r="2"/><circle cx="14.2" cy="5.8" r="2"/><path d="M12 11.5c3 0 6 3.8 6 6.8a2.4 2.4 0 0 1-3.4 2.1c-1-.4-1.8-.6-2.6-.6s-1.6.2-2.6.6A2.4 2.4 0 0 1 6 18.3c0-3 3-6.8 6-6.8z"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2.2"/>',
    clock: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    aim: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="2.2"/>',
    shard: '<path d="M8 2l9 5-3 15-9-6z"/>',
    core: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><circle cx="12" cy="12" r="3.2" fill="rgba(0,0,0,.45)"/>',
    swords: '<path d="M4 4l12 12M20 4L8 16M14 18l4 2M10 18l-4 2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    chevron: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'
};

export function icon(name, size = 24) {
    const body = P[name] || P.star;
    return `<svg class="v2-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

/** root 안의 [data-icon="이름"] 요소 앞에 아이콘을 채움 (data-icon-size로 크기, 한 번만) */
export function fillIcons(root, size = 22) {
    if (!root) return;
    root.querySelectorAll('[data-icon]').forEach(el => {
        if (el.querySelector(':scope > .v2-icon')) return;
        el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, Number(el.dataset.iconSize) || size));
    });
}
