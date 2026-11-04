/* ==========================================================================
   스토리 인트로 대본 (모션 코믹, D-100) — 재생기: js/ui_v2/storyIntro_v2.js
   구역 N의 첫 스테이지(N-1) 출격 전에 재생. 이야기는 MD/기획_스테이지설계.md '오프닝' · MD/기획_캐릭터스토리.md
   (대사는 기획서 문장 그대로, 군인·용병·광신도·대주교 대사와 내레이션 다듬기는 Claude 초안)
   컷 그림은 칸마다 새로 그린 일러스트 (assets/sprites/intro/st<N>/<칸>.webp, Gemini — 요청 글 tools/images/pending_story_intro.json,
   변환 tools/images/build_intro_art.py). 게임 배경·적·리그 그림은 쓰지 않음 (사용자 11-03)

   구조: pages[] = { panels: { 칸 id: 칸 }, beats: [장면…] } + title(마지막 제목 카드)
   - 칸: rect [x, y, w, h] (1280×720 화면 기준) · poly 비스듬한 칸 모양(%) · enter 들어오는 방향 · bg CSS 배경 · tone sepia/noir
         layers[]: 칸 안 좌표(px). 공통 x, y, z, o(불투명), filter, anim {to, dur, delay, ease, loop, alt}, from(처음 상태), id(장면에서 부름)
           img  그림 (anchor b=발 가운데 · c=가운데 · tl=왼쪽 위, w·h 둘 다 주면 tl) — 컷 그림은 아래 pic()으로
           fx   칸 전체 덮개 (alarm 경보등 · vignette · speed 집중선 · rays 빛줄기 · glow(color, CSS --c) · grad(css))
           particles 입자 (sparks · redsparks · embers · ash · ghosts · bubbles · steam · dust · debris, rate/초, area [x,y,w,h])
           prop 소품 (slash 칼날 섬광 · stamp 도장 — cls로 동작)
   - 장면(beat): show 칸 id(들어옴) · texts[] · acts[] · sfx [[이름, 초, {vol, rate}]] · dur 최소 길이(초)
       texts: { on 칸, type cap 내레이션|say 말풍선|sys 시스템 경고|sfx 효과음 글자, text, x, y(칸 기준), w 최대 폭,
                who 말하는 사람, tail bl/br/tl/tr/l/r 말꼬리, tone dark/gold/red, shout, size, rot, color, at 초 }
       acts:  { on 칸, at 초, fx shake/quake/punch/flash/red/black · id 층 → to{...}+dur/ease · cls 소품 상태 · rate/burst 입자 }
   ========================================================================== */

// ---- 칸 배치 (화면 1280×720, 바깥 여백 14 · 칸 사이 10) ----
// 위 넓은 칸 + 아래 두 칸 (가운데 비스듬히)
const L3 = {
    top: { rect: [14, 14, 1252, 300] },
    bl: { rect: [14, 324, 616, 382], poly: [[0, 0], [100, 0], [94, 100], [0, 100]] },
    br: { rect: [595, 324, 671, 382], poly: [[6.7, 0], [100, 0], [100, 100], [1.2, 100]] }
};
// 왼쪽 긴 칸 + 오른쪽 위아래 (비스듬히)
const LT = {
    left: { rect: [14, 14, 500, 692] },
    rt: { rect: [524, 14, 742, 336], poly: [[0, 0], [100, 0], [100, 90], [0, 100]] },
    rb: { rect: [524, 326, 742, 380], poly: [[0, 8.95], [100, 0], [100, 100], [0, 100]] }
};
// 위 큰 칸 + 아래 두 칸
const BT = {
    top: { rect: [14, 14, 1252, 416] },
    bl: { rect: [14, 440, 616, 266], poly: [[0, 0], [100, 0], [96, 100], [0, 100]] },
    br: { rect: [612, 440, 654, 266], poly: [[4.3, 0], [100, 0], [100, 100], [0.5, 100]] }
};
const FULL = { rect: [14, 14, 1252, 692] };

// ---- 컷 그림 ----
const IMG = { w: 1024, h: 572 };   // Gemini '이미지 복사' 크기 (16:9)

/**
 * 칸을 덮는 컷 그림 + 천천히 밀고 들어가기(push)·옆으로 흐르기(pan)
 * fx·fy: 칸보다 큰 그림의 어느 쪽을 보일지 (0 왼쪽/위 ~ 1 오른쪽/아래) · zoom: 덮는 크기의 여유 배율
 */
function pic(n, p, [, , pw, ph], { fx = 0.5, fy = 0.5, zoom = 1.06, push = 0.05, pan = 0, dur = 9, id = 'pic', o, from } = {}) {
    const k = Math.max(pw / IMG.w, ph / IMG.h) * zoom;
    const w = Math.round(IMG.w * k), h = Math.round(IMG.h * k);
    const to = { x: Math.round(pan - (w * push) / 2), y: Math.round(-(h * push) / 2), s: 1 + push };
    return { id, img: `assets/sprites/intro/st${n}/${p}.webp`, x: Math.round((pw - w) * fx), y: Math.round((ph - h) * fy), w, h, z: 0, o, from,
        anim: push || pan ? { to, dur, ease: 'linear' } : undefined };
}
const face = file => `assets/sprites/intro/face_${file}.webp`;
const DARK = css => ({ fx: 'grad', css });

// ==========================================================================
// 스테이지 1 · 거대로봇 : 심연의 출격
// ==========================================================================
const STAGE1 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 1', name: '심연의 출격', face: face('mech'), color: '#ff3b4a',
        rows: [['주인공', '거대로봇 — 매드 사이언티스트 빅터'], ['목표', '쏟아지는 토벌군을 뚫고 지상행 거대 승강기를 탈취하라'], ['막는 세력', "정부 직속 비밀 토벌군 '블랙 하운드'"]]
    },
    pages: [
        {   // 1쪽: 제14 연구소 · 도용된 설계도 · 차원문
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(1, 'A', L3.top.rect, { fy: 0.55, push: 0.06, pan: -40, dur: 12 }),
                        { fx: 'alarm' },
                        { particles: 'sparks', rate: 6, area: [330, 20, 600, 120] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(1, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { fx: 'glow', color: 'rgba(80, 230, 255, 0.22)', css: 'radial-gradient(circle at 78% 42%, var(--c), transparent 45%)', cls: 'is-pulse' },
                        { id: 'stamp', prop: 'stamp', x: 500, y: 196, text: 'WMD 전용', r: -12 },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right',
                    layers: [
                        pic(1, 'C', L3.br.rect, { push: 0.07 }),
                        { fx: 'glow', color: 'rgba(90, 170, 255, 0.4)', css: 'radial-gradient(circle at 420px 136px, var(--c), transparent 150px)', cls: 'is-pulse' },
                        { id: 'sparks', particles: 'sparks', rate: 14, area: [310, 30, 230, 220] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', sfx: [['warning', 0.2, { vol: 0.7 }]], texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: '지하 1,000m — 버려진 제14 연구소.' },
                    { on: 'A', type: 'cap', x: 22, y: 66, w: 600, at: 1.3, text: '차갑게 식은 강철 바닥 위로, 붉은 비상 경고등만이 핏빛처럼 깜빡이고 있었다.' }] },
                { show: 'B', acts: [{ on: 'B', id: 'stamp', cls: 'is-go', at: 2.0 }, { on: 'B', fx: 'shake', at: 2.05 }], sfx: [['shield_hit', 2.0]], texts: [
                    { on: 'B', type: 'cap', x: 18, y: 292, w: 280, text: '인류의 번영을 위해 바친 천재 과학자 빅터의 기술은—' },
                    { on: 'B', type: 'cap', x: 312, y: 300, w: 250, at: 2.3, text: '세계를 불태울 대량파괴병기(WMD)의 도면이 되어 있었다.' }] },
                { texts: [
                    { on: 'B', type: 'say', who: '빅터', tail: 'bl', x: 196, y: 14, w: 290, text: '평화를 위한 억지력이라고…?\n역겨운 기만자들.' }] },
                { show: 'C', sfx: [['charge_up', 0.4]], acts: [{ on: 'C', id: 'sparks', burst: 30, at: 0.5 }, { on: 'C', fx: 'flash', at: 0.5 }], texts: [
                    { on: 'C', type: 'cap', x: 44, y: 14, w: 300, text: '그래서 그는 금기의 영역에 손을 댔다. 공간의 틈새를 찢는 장치— 차원문.' },
                    { on: 'C', type: 'sfx', x: 540, y: 40, size: 44, rot: 10, color: '#8fe6ff', at: 0.5, text: '지지직—' }] },
                { texts: [
                    { on: 'C', type: 'say', who: '빅터', tail: 'tl', x: 186, y: 292, w: 330, text: '응답하라… 세상에 배신당하고 버림받은 자들이여.' }] }
            ]
        },
        {   // 2쪽: 침입 경보 · 블랙 하운드 · 빅터의 미소
            panels: {
                D: {
                    ...LT.left, enter: 'left',
                    layers: [
                        pic(1, 'D', LT.left.rect, { zoom: 1.04, push: 0.04 }),
                        { fx: 'alarm', cls: 'is-strong' },
                        { id: 'dust', particles: 'dust', rate: 0, area: [60, 160, 380, 380] },
                        { id: 'debris', particles: 'debris', rate: 0, area: [60, 0, 380, 60] },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...LT.rt, enter: 'right',
                    layers: [
                        pic(1, 'E', LT.rt.rect, { fx: 0.6, fy: 0.4, pan: -16 }),
                        { fx: 'alarm' },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...LT.rb, enter: 'right',
                    layers: [
                        pic(1, 'F', LT.rb.rect, { fx: 0.3, fy: 0.4, push: 0.07, dur: 7 }),
                        { fx: 'glow', color: 'rgba(255, 50, 70, 0.3)', css: 'radial-gradient(circle at 65% 60%, var(--c), transparent 55%)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', sfx: [['warning_danger', 0.15]], texts: [
                    { on: 'D', type: 'sys', x: 22, y: 24, w: 400, text: '[시스템 경고] 침입자 발생.\n외부 방어선 돌파.' }] },
                { dur: 2.4,
                    acts: [{ on: 'D', fx: 'shake', at: 0.1 }, { on: 'D', id: 'dust', burst: 26, at: 0.1 }, { on: 'D', fx: 'quake', at: 1.0 }, { on: 'D', fx: 'flash', at: 1.0 },
                        { on: 'D', id: 'debris', burst: 30, at: 1.0 }, { on: 'D', id: 'dust', rate: 8, at: 1.0 }],
                    sfx: [['base_blast', 0.1], ['base_destroyed', 1.0, { vol: 0.75 }]],
                    texts: [
                        { on: 'D', type: 'sfx', x: 26, y: 210, size: 80, rot: -12, at: 0.1, text: '쾅!' },
                        { on: 'D', type: 'sfx', x: 150, y: 400, size: 104, rot: 8, at: 1.0, text: '콰앙!!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'cap', x: 18, y: 14, w: 420, text: "빅터의 차원 에너지를 역추적해 온 정부 직속 비밀 토벌군— '블랙 하운드'." },
                    { on: 'E', type: 'say', who: '블랙 하운드 대장', shout: true, tail: 'br', x: 286, y: 78, w: 310, at: 2.4, text: '목표는 빅터 박사와 차원 기술!\n전원 진입하라!' }] },
                { show: 'F', sfx: [['charge_up', 0.4]], texts: [
                    { on: 'F', type: 'say', who: '빅터', tail: 'bl', x: 330, y: 44, w: 280, text: '마침 내 새로운 장난감을 테스트할 참이었는데…' }] },
                { texts: [
                    { on: 'F', type: 'say', tail: 'tl', x: 300, y: 296, w: 300, text: '훌륭한 과녁판들이 제 발로 찾아왔군.' }] }
            ]
        },
        {   // 3쪽: 출격
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(1, 'G', FULL.rect, { fx: 0.4, push: 0.08, dur: 12 }),
                        { id: 'speed', fx: 'speed', o: 0, z: 9 },
                        { id: 'muzzle', particles: 'redsparks', rate: 0, area: [880, 420, 200, 90], z: 15 },
                        { id: 'dust', particles: 'dust', rate: 0, area: [380, 560, 380, 110], z: 15 },
                        { particles: 'sparks', rate: 4, area: [100, 100, 1050, 300], z: 15 },
                        { fx: 'alarm' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', acts: [{ on: 'G', fx: 'punch', at: 0.3 }], sfx: [['charge_up', 0.3]], texts: [
                    { on: 'G', type: 'say', who: '빅터', shout: true, tail: 'bl', x: 520, y: 70, w: 470, text: '시스템 가동! 프로토타입 메카, 출격 준비!' }] },
                { dur: 2.2,
                    acts: [{ on: 'G', fx: 'quake', at: 0.5 }, { on: 'G', fx: 'flash', at: 0.5 }, { on: 'G', id: 'dust', burst: 40, at: 0.5 }, { on: 'G', id: 'dust', rate: 10, at: 0.5 },
                        { on: 'G', id: 'speed', to: { o: 0.8 }, dur: 0.3, at: 0.5 }],
                    sfx: [['mech_thrust', 0.1], ['mech_land', 0.5]],
                    texts: [{ on: 'G', type: 'sfx', x: 600, y: 520, size: 110, rot: -8, at: 0.5, color: '#ffd23f', text: '쿠웅!!' }] },
                { dur: 3,
                    acts: [{ on: 'G', id: 'muzzle', rate: 26 }, { on: 'G', fx: 'shake', at: 0.4 }],
                    sfx: [['giant_step', 0.2], ['giant_step', 1.2]],
                    texts: [
                        { on: 'G', type: 'say', shout: true, tail: 'bl', x: 600, y: 196, w: 450, text: '다리 파츠, 무한궤도 장착!\n쏟아지는 보병 놈들을 남김없이 깔아뭉개라!' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 22, w: 560, text: '세계를 향한 가장 처절하고 완벽한 복수극이— 막을 올리는 순간이었다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 2 · 거대괴수 : 끓어오르는 대지
// ==========================================================================
const STAGE2 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 2', name: '끓어오르는 대지', face: face('kaiju'), color: '#ff7a2a',
        rows: [['주인공', '거대괴수 — 깨어난 태고의 거신'], ['목표', '시추 단지의 방어선을 짓밟고 메인 시추 코어를 박살 내라'], ['막는 세력', '에너지 코퍼레이션 중장비 방위군']]
    },
    pages: [
        {   // 1쪽: 시추 단지 · 해저 핵실험 · 눈을 뜬 거신
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(2, 'A', L3.top.rect, { fy: 0.45, push: 0.05, pan: -40, dur: 12 }),
                        { particles: 'ash', rate: 18, area: [0, -20, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(2, 'B', L3.bl.rect, { push: 0.08, dur: 7 }),
                        { id: 'dark', ...DARK('radial-gradient(circle at 50% 62%, rgba(2, 8, 16, 0.55), rgba(2, 8, 16, 0.96) 55%)') },
                        { id: 'bubbles', particles: 'bubbles', rate: 8, area: [0, 200, 580, 180] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right',
                    layers: [
                        pic(2, 'C', L3.br.rect, { push: 0.05 }),
                        { id: 'dark', ...DARK('rgba(0, 3, 8, 0.9)') },
                        { id: 'eye', fx: 'glow', o: 0, color: 'rgba(255, 210, 60, 0.85)', css: 'radial-gradient(circle at 347px 165px, var(--c), transparent 70px)', cls: 'is-pulse' },
                        { particles: 'bubbles', rate: 5, area: [80, 200, 520, 180] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 640, text: "행성의 해안선을 무자비하게 깎아 세운 거대 에너지 코퍼레이션의 '해안 시추 단지'." },
                    { on: 'A', type: 'cap', x: 22, y: 92, w: 540, at: 1.5, text: '시추관은 바다 밑, 행성의 혈관인 지맥까지 파고들었다.' }] },
                { show: 'B', dur: 2.4,
                    acts: [{ on: 'B', id: 'dark', to: { o: 0 }, dur: 0.25, at: 1.0 }, { on: 'B', fx: 'flash', at: 1.0 }, { on: 'B', fx: 'quake', at: 1.05 },
                        { on: 'B', id: 'bubbles', burst: 40, at: 1.05 }, { on: 'B', id: 'bubbles', rate: 30, at: 1.05 }],
                    sfx: [['base_destroyed', 1.0]],
                    texts: [
                        { on: 'B', type: 'cap', x: 18, y: 16, w: 300, text: '그리고— 해저 핵실험.' },
                        { on: 'B', type: 'sfx', x: 200, y: 110, size: 84, rot: -8, at: 1.05, color: '#fff2c4', text: '콰아앙!!' }] },
                { texts: [
                    { on: 'B', type: 'cap', x: 300, y: 312, w: 250, text: '충격파가 해저 지각을 무너뜨렸다.' }] },
                { show: 'C', texts: [
                    { on: 'C', type: 'cap', x: 44, y: 14, w: 360, text: '그 아래, 깊은 잠에 빠져 있던 태고의 거신이—' }] },
                { dur: 1.8,
                    acts: [{ on: 'C', id: 'eye', to: { o: 1 }, dur: 0.3, at: 0.2 }, { on: 'C', id: 'dark', to: { o: 0.25 }, dur: 1.2, at: 0.3 }, { on: 'C', fx: 'punch', at: 0.25 }],
                    sfx: [['charge_up', 0.2, { rate: 0.55 }]],
                    texts: [{ on: 'C', type: 'cap', x: 480, y: 300, w: 160, at: 0.6, text: '눈을 떴다.' }] }
            ]
        },
        {   // 2쪽: 상륙 · 포효 · 방위군 · 거신의 말
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(2, 'D', BT.top.rect, { fx: 0.45, fy: 0.08, push: 0, from: { y: 40 } }),
                        { fx: 'glow', color: 'rgba(255, 100, 30, 0.45)', css: 'radial-gradient(70% 55% at 50% 100%, var(--c), transparent 70%)' },
                        { id: 'steam', particles: 'steam', rate: 10, area: [300, 300, 650, 80] },
                        { particles: 'embers', rate: 18, area: [0, 330, 1252, 80] },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(2, 'E', BT.bl.rect, { fx: 0.3, fy: 0.4, push: 0.06, dur: 6 }),
                        { particles: 'embers', rate: 10, area: [0, 120, 616, 120] },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(2, 'F', BT.br.rect, { fx: 0.8, fy: 0.4, push: 0.07, dur: 6 }),
                        { fx: 'speed', o: 0.45, color: 'rgba(255, 210, 160, 0.5)' },
                        { particles: 'embers', rate: 14, area: [0, 150, 654, 120] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 3,
                    acts: [{ on: 'D', id: 'pic', to: { y: 0, s: 1.03 }, dur: 2.8, ease: 'cubic-bezier(.2,.7,.3,1)', at: 0.2 }, { on: 'D', fx: 'quake', at: 0.3 }, { on: 'D', fx: 'quake', at: 1.5 },
                        { on: 'D', id: 'steam', rate: 26, at: 0.3 }],
                    sfx: [['giant_step', 0.3], ['giant_step', 1.5], ['kaiju_regen', 0.6]],
                    texts: [
                        { on: 'D', type: 'sfx', x: 30, y: 300, size: 62, rot: -6, at: 0.3, color: '#ffb066', text: '쿠구구구구…' },
                        { on: 'D', type: 'cap', x: 22, y: 18, w: 460, at: 0.9, text: '끓어오르는 바다를 가르고, 화산암과 산호초를 두른 거신이 상륙했다.' }] },
                { dur: 2.6, acts: [{ on: 'D', fx: 'punch', at: 0.3 }, { on: 'D', fx: 'quake', at: 0.6 }, { on: 'D', fx: 'quake', at: 1.3 }],
                    sfx: [['kaiju_roar', 0.35]],
                    texts: [{ on: 'D', type: 'sfx', x: 700, y: 70, size: 78, rot: 7, at: 0.5, color: '#ffd27a', text: '그오오오오—!!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '코퍼레이션 용병', shout: true, tail: 'bl', x: 196, y: 14, w: 230, text: '괴, 괴물이다…!!' },
                    { on: 'E', type: 'sys', x: 300, y: 190, w: 270, at: 1.4, text: '[무전] 중장비 방위군 전원 출동!\n시추 단지를 사수하라!' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '고대 거신', tone: 'dark', tail: 'r', x: 40, y: 18, w: 300, text: '지구의 맥박이 끓어오를 때 나는 눈을 떴고— 너희의 불장난이 나의 인내를 끝냈다.' }] },
                { acts: [{ on: 'F', fx: 'punch' }], sfx: [['kaiju_bite', 0.05]], texts: [
                    { on: 'F', type: 'say', tone: 'dark', shout: true, tail: 'r', x: 40, y: 150, w: 320, text: '이 행성의 본래 주인이 누구인지 가르쳐주마.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 3 · 타락 히어로 : 피로 물든 순례길
// ==========================================================================
const STAGE3 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 3', name: '피로 물든 순례길', face: face('hero'), color: '#b56cff',
        rows: [['주인공', '타락 히어로 — 처형당한 용사'], ['목표', '순례길을 짓밟고 대성당 정문을 부숴 위선자 대주교를 처단하라'], ['막는 세력', '성왕국 이단 토벌대 & 광신도 연합']]
    },
    pages: [
        {   // 1쪽: 성왕국 수도 · 처형대의 기억 · 마왕의 권능
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(3, 'A', L3.top.rect, { fy: 0.42, push: 0.05, pan: -40, dur: 12 }),
                        { particles: 'embers', rate: 10, area: [0, 260, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left', tone: 'sepia',
                    layers: [
                        pic(3, 'B', L3.bl.rect, { fx: 0.4, push: 0.07 }),
                        { particles: 'ash', rate: 8, area: [0, -10, 616, 30] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#050305',
                    layers: [
                        pic(3, 'C', L3.br.rect, { fx: 0.7, push: 0.06, o: 0 }),
                        { id: 'eyeglow', fx: 'glow', o: 0, color: 'rgba(210, 110, 255, 0.95)', css: 'radial-gradient(circle at 438px 131px, var(--c), transparent 44px)', cls: 'is-pulse' },
                        { id: 'slash', prop: 'slash', x: 336, y: 190, w: 760, r: -28 },
                        { id: 'ghosts', particles: 'ghosts', rate: 0, area: [80, 220, 520, 160] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: '성왕국의 화려한 수도.' },
                    { on: 'A', type: 'cap', x: 22, y: 66, w: 620, at: 1.2, text: "이단자를 처형하던 광장에서 대성당까지 이어지는 '성스러운 순례길'." }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 18, y: 14, w: 330, text: '— 그날. 마왕을 쓰러뜨린 용사는, 그 힘을 두려워한 왕과 귀족의 누명을 쓰고 처형대에 올랐다.' }] },
                { texts: [
                    { on: 'B', type: 'say', shout: true, tail: 'bl', x: 30, y: 226, w: 160, size: 17, text: '처형하라!' },
                    { on: 'B', type: 'say', shout: true, tail: 'br', x: 400, y: 206, w: 170, size: 17, at: 0.7, text: '괴물을 죽여라!' }] },
                { show: 'C', dur: 2.2, acts: [{ on: 'C', id: 'slash', cls: 'is-go', at: 0.9 }, { on: 'C', fx: 'flash', at: 0.95 }], sfx: [['hero_slash_hit', 0.9]], texts: [
                    { on: 'C', type: 'cap', x: 44, y: 14, w: 360, text: '동료들의 목이 차례로 떨어지던 순간—' },
                    { on: 'C', type: 'sfx', x: 70, y: 140, size: 64, rot: -14, at: 0.95, color: '#ffffff', text: '서걱—' }] },
                { acts: [{ on: 'C', id: 'pic', to: { o: 1 }, dur: 1.2 }, { on: 'C', id: 'eyeglow', to: { o: 1 }, dur: 0.4, at: 1.0 },
                    { on: 'C', id: 'ghosts', rate: 24, at: 0.3 }, { on: 'C', fx: 'punch', at: 1.0 }],
                    sfx: [['hero_curse_nova', 0.9]],
                    texts: [{ on: 'C', type: 'cap', x: 40, y: 296, w: 250, at: 1.1, text: '그가 베었던 마왕의 핏빛 권능이, 그를 삼켰다.' }] }
            ]
        },
        {   // 2쪽: 부활 · 용사의 말 · 대주교
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(3, 'D', BT.top.rect, { fy: 0.45, push: 0.05, from: { y: 20 } }),
                        { id: 'dark', ...DARK('radial-gradient(circle at 52% 40%, rgba(20, 0, 30, 0.4), rgba(5, 0, 8, 0.92) 50%)') },
                        { id: 'aura', fx: 'glow', o: 0, color: 'rgba(150, 60, 255, 0.32)', css: 'radial-gradient(28% 60% at 52% 45%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'ghosts', particles: 'ghosts', rate: 6, area: [470, 60, 340, 260] },
                        { particles: 'embers', rate: 8, area: [0, 380, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(3, 'E', BT.bl.rect, { fx: 0.2, fy: 0.4, push: 0.06, dur: 6 }),
                        { particles: 'ghosts', rate: 8, area: [0, 120, 600, 140] },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(3, 'F', BT.br.rect, { fx: 0.7, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'rays', color: 'rgba(255, 220, 140, 0.22)' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', id: 'dark', to: { o: 0 }, dur: 1.4, at: 0.3 }, { on: 'D', id: 'aura', to: { o: 1 }, dur: 1, at: 0.3 },
                        { on: 'D', id: 'ghosts', rate: 30, at: 0.3 }, { on: 'D', fx: 'quake', at: 1.4 }, { on: 'D', fx: 'flash', at: 1.4 }],
                    sfx: [['hero_cast', 0.3], ['hero_curse_nova', 1.4]],
                    texts: [
                        { on: 'D', type: 'cap', x: 22, y: 18, w: 520, text: '그리고 지금— 바로 그 처형장 한가운데.' },
                        { on: 'D', type: 'sfx', x: 150, y: 150, size: 62, rot: -8, at: 0.4, color: '#d9a6ff', text: '우우웅—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '광신도', shout: true, tail: 'br', x: 860, y: 200, w: 260, text: '이, 이단자가… 되살아났다!!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '타락한 용사', tone: 'dark', tail: 'l', x: 330, y: 44, w: 260, text: '세상을 구한 대가는… 처형대 위의 이슬이었지.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '대주교 베네딕트', tone: 'gold', tail: 'r', x: 40, y: 24, w: 290, text: '신의 이름으로 명한다.\n저 더러운 이단을— 다시 처형하라!' }] }
            ]
        },
        {   // 3쪽: 복수의 순례
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(3, 'G', FULL.rect, { fx: 0.3, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(130, 40, 230, 0.35)', css: 'radial-gradient(22% 40% at 26% 55%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { particles: 'ghosts', rate: 18, area: [120, 220, 400, 320] },
                        { particles: 'embers', rate: 12, area: [0, 560, 1252, 60] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['giant_step', 0.6, { vol: 0.5, rate: 1.5 }], ['giant_step', 1.4, { vol: 0.5, rate: 1.5 }]],
                    texts: [
                        { on: 'G', type: 'say', who: '타락한 용사', tone: 'dark', shout: true, tail: 'bl', x: 440, y: 80, w: 440, text: '똑똑히 보아라.\n너희가 만들어낸— 진정한 괴물을.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '피로 물든 복수의 순례가 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 4 · 합성괴인 : 진화의 심연 (11-03, 3단계와 같은 틀 — 관측 기록·광신도·오큘러스 대사는 Claude 초안)
// ==========================================================================
const STAGE4 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 4', name: '진화의 심연', face: face('chimera'), color: '#9dff4a',
        rows: [['주인공', '합성괴인 — 자아를 깨운 실험체'], ['목표', "'살점의 요람'을 뚫고 변이체를 뿜어내는 진화의 고치를 파괴하라"], ['막는 세력', '별의 사도들과 실패한 진화체들']]
    },
    pages: [
        {   // 1쪽: 살점의 요람 · 끝없는 실험 · 눈을 뜨다
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(4, 'A', L3.top.rect, { fy: 0.3, push: 0.06, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(110, 255, 90, 0.16)', css: 'radial-gradient(60% 90% at 50% 100%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { particles: 'bubbles', rate: 6, area: [0, 160, 1252, 140] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(4, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { particles: 'bubbles', rate: 10, area: [60, 80, 280, 260] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#031008',
                    layers: [
                        pic(4, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'eyeglow', fx: 'glow', o: 0, color: 'rgba(255, 240, 90, 0.9)', css: 'radial-gradient(circle at 398px 170px, var(--c), transparent 70px)', cls: 'is-pulse' },
                        { id: 'bubbles', particles: 'bubbles', rate: 4, area: [20, 120, 260, 240] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 560, text: "차원의 틈새 깊은 곳— 우주적 존재들이 만든 유기체 실험장, '살점의 요람'." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 560, at: 1.3, text: '생명이 어디까지 비틀릴 수 있는지, 그들은 끝없이 시험했다.' }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 330, y: 14, w: 260, text: '끝없는 유전자 조작. 찢고, 꿰매고, 다시 찢었다.' }] },
                { texts: [
                    { on: 'B', type: 'sys', x: 300, y: 262, w: 270, text: '[관측 기록] 실험체 C-07\n변이 41단계 · 자아 반응 없음' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', id: 'eyeglow', to: { o: 1 }, dur: 0.3, at: 0.8 }, { on: 'C', fx: 'flash', at: 0.85 }, { on: 'C', fx: 'shake', at: 0.85 },
                    { on: 'C', id: 'bubbles', burst: 24, at: 0.85 }],
                    sfx: [['shield_hit', 0.85]],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 300, text: '그리고 어느 날—' },
                        { on: 'C', type: 'sfx', x: 470, y: 40, size: 50, rot: 12, color: '#d8ff9a', at: 0.85, text: '쩌적—' },
                        { on: 'C', type: 'cap', x: 30, y: 300, w: 330, at: 1.4, text: "그것은 '생각'하기 시작했다." }] }
            ]
        },
        {   // 2쪽: 고치를 찢다 · 합성괴인의 말 · 오큘러스
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(4, 'D', BT.top.rect, { fy: 0.3, push: 0.05, from: { y: 20 } }),
                        { fx: 'glow', color: 'rgba(120, 255, 80, 0.3)', css: 'radial-gradient(30% 70% at 30% 70%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'steam', particles: 'steam', rate: 4, area: [60, 40, 420, 200] },
                        { id: 'debris', particles: 'debris', rate: 0, area: [200, 0, 500, 80] },
                        { fx: 'speed' },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(4, 'E', BT.bl.rect, { fx: 0.2, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(4, 'F', BT.br.rect, { fx: 0.7, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'glow', color: 'rgba(130, 255, 90, 0.25)', css: 'radial-gradient(40% 60% at 65% 100%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'quake', at: 0.3 }, { on: 'D', fx: 'flash', at: 0.3 }, { on: 'D', id: 'debris', burst: 30, at: 0.3 }, { on: 'D', id: 'steam', rate: 14, at: 0.3 }],
                    sfx: [['chimera_slam', 0.3], ['kaiju_roar', 0.9, { vol: 0.7, rate: 1.15 }]],
                    texts: [
                        { on: 'D', type: 'cap', x: 22, y: 18, w: 560, text: '자신을 가둔 고치를 찢고, 쏟아지는 양수와 함께—' },
                        { on: 'D', type: 'sfx', x: 560, y: 150, size: 64, rot: -8, at: 0.35, color: '#9dff4a', text: '콰아앙—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '진화의 광신도', shout: true, tail: 'br', x: 880, y: 24, w: 300, text: '시, 실험체가…\n격리를 깨고 나왔다!!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '합성괴인', tone: 'dark', tail: 'l', x: 300, y: 40, w: 290, text: '진화를 강요하며 내 살점을 찢고 꿰매던… 그 오만한 시선들.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '관장자 오큘러스', tone: 'red', tail: 'r', x: 26, y: 24, w: 290, text: '실험체 C-07, 자아 발현 확인.\n흥미롭군… 산 채로 회수하라.' }] }
            ]
        },
        {   // 3쪽: 핏빛 진격
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(4, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(170, 90, 255, 0.4)', css: 'radial-gradient(circle at 1030px 160px, var(--c), transparent 200px)', cls: 'is-pulse' },
                        { particles: 'embers', rate: 10, area: [0, 560, 1252, 80] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['giant_step', 0.6, { vol: 0.6, rate: 1.2 }], ['giant_step', 1.4, { vol: 0.6, rate: 1.2 }]],
                    texts: [
                        { on: 'G', type: 'say', who: '합성괴인', tone: 'dark', shout: true, tail: 'bl', x: 470, y: 40, w: 420, text: '똑똑히 지켜보아라.\n너희의 요람이 나의 진화 앞에 어떻게 짓밟히는지.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '진화의 심연을 가르는 핏빛 진격이 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 5 · 심연의 길잡이 : 가라앉는 오만 (11-03 — 해병·아이언클래드 대사는 Claude 초안)
// ==========================================================================
const STAGE5 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 5', name: '가라앉는 오만', face: face('diver'), color: '#36e0d0',
        rows: [['주인공', '심연의 길잡이 — 수장된 심해 탐사 대장'], ['목표', "해상 요새 '포세이돈'을 부수고 중앙 통제 시추선을 파괴하라"], ['막는 세력', '어비스 연합 해군 & 특수 잠수 부대']]
    },
    pages: [
        {   // 1쪽: 해상 요새 포세이돈 · 수장된 탐사대 · 원혼
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(5, 'A', L3.top.rect, { fy: 0.4, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(255, 120, 40, 0.3)', css: 'radial-gradient(18% 50% at 56% 100%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(5, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { particles: 'bubbles', rate: 10, area: [0, 40, 616, 340] },
                        { particles: 'embers', rate: 8, area: [380, 200, 236, 180] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#02060a',
                    layers: [
                        pic(5, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'eyeglow', fx: 'glow', o: 0, color: 'rgba(255, 150, 50, 0.85)', css: 'radial-gradient(circle at 335px 177px, var(--c), transparent 90px)', cls: 'is-pulse' },
                        { id: 'ghosts', particles: 'ghosts', rate: 4, area: [0, 40, 671, 300] },
                        { particles: 'bubbles', rate: 6, area: [100, 100, 470, 280] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', acts: [{ on: 'A', fx: 'flash', at: 1.0 }], texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: "해양 행성 '어비스'. 남은 육지는 단 5%." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 560, at: 1.3, text: "그 마지막 땅을 지키는 무적의 해상 요새— '포세이돈'." }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 300, y: 14, w: 290, text: '— 그날. 국가가 해저에 버린 오염을 발견한 탐사대는' },
                    { on: 'B', type: 'cap', x: 300, y: 300, w: 270, at: 2.0, text: '강제로 터뜨린 화산의 맹독 속에 수장되었다.' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', id: 'eyeglow', to: { o: 1 }, dur: 0.6, at: 0.8 }, { on: 'C', id: 'ghosts', rate: 18, at: 0.8 }, { on: 'C', fx: 'punch', at: 0.8 }],
                    sfx: [['hero_cast', 0.8]],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 260, text: '칠흑 같은 심연 속에서—' },
                        { on: 'C', type: 'cap', x: 30, y: 300, w: 330, at: 1.4, text: '부하들의 원혼이 대장의 잠수복에 깃들었다.' }] }
            ]
        },
        {   // 2쪽: 갑판 위로 · 길잡이의 말 · 아이언클래드
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(5, 'D', BT.top.rect, { fy: 0.12, push: 0.05, from: { y: 20 } }),
                        { fx: 'glow', color: 'rgba(80, 255, 220, 0.25)', css: 'radial-gradient(30% 80% at 25% 50%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'ghosts', particles: 'ghosts', rate: 6, area: [0, 40, 500, 340] },
                        { id: 'debris', particles: 'debris', rate: 0, area: [500, 60, 200, 80] },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(5, 'E', BT.bl.rect, { fx: 0.2, fy: 0.35, push: 0.06, dur: 6 }),
                        { particles: 'ghosts', rate: 6, area: [160, 40, 200, 220] },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(5, 'F', BT.br.rect, { fx: 0.7, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'glow', color: 'rgba(255, 60, 60, 0.3)', css: 'radial-gradient(30% 50% at 70% 40%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'quake', at: 0.3 }, { on: 'D', fx: 'flash', at: 0.3 }, { on: 'D', id: 'debris', burst: 20, at: 0.3 }, { on: 'D', id: 'ghosts', rate: 20, at: 0.3 }],
                    sfx: [['shield_hit', 0.3], ['giant_step', 0.9, { vol: 0.7 }]],
                    texts: [
                        { on: 'D', type: 'cap', x: 22, y: 18, w: 520, text: '폭풍우 치는 밤. 요새의 닻줄을 뜯어내며, 무언가가 갑판 위로 기어올랐다.' },
                        { on: 'D', type: 'sfx', x: 630, y: 150, size: 60, rot: -10, at: 0.35, color: '#7ff5e0', text: '철컹—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '해군 작살총 해병', shout: true, tail: 'br', x: 880, y: 24, w: 320, text: '저, 저건…\n우리가 수장시킨 탐사대장이잖아!?' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '심연의 길잡이', tone: 'dark', tail: 'l', x: 300, y: 30, w: 300, text: '펄펄 끓는 화산재와 맹독 속에서\n내 부하들이 어떻게 녹아내렸는지… 아는가?' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '총사령관 아이언클래드', tone: 'red', tail: 'r', x: 26, y: 24, w: 290, text: '유령 따위가 감히!\n전 포문 개방— 다시 바다 밑에 처박아라!' }] }
            ]
        },
        {   // 3쪽: 심판의 진격
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(5, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 120, 40, 0.4)', css: 'radial-gradient(circle at 1015px 137px, var(--c), transparent 180px)', cls: 'is-pulse' },
                        { particles: 'ghosts', rate: 12, area: [0, 100, 500, 400] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['giant_step', 0.6, { vol: 0.6 }], ['giant_step', 1.4, { vol: 0.6 }]],
                    texts: [
                        { on: 'G', type: 'say', who: '심연의 길잡이', tone: 'dark', shout: true, tail: 'bl', x: 480, y: 40, w: 460, text: '너희가 자랑하는 그 알량한 5%의 땅덩어리마저,\n이 깊고 차가운 심연으로 끌어내려 주마.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '가라앉는 오만— 심판의 진격이 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 6 · 봉합 성녀 : 피에 젖은 성역 (11-03 — 귀족·기사단 대사는 Claude 초안)
// ==========================================================================
const STAGE6 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 6', name: '피에 젖은 성역', face: face('saint'), color: '#ff4d6a',
        rows: [['주인공', '봉합 성녀 — 모두를 살리려다 죽음마저 금지한 성녀'], ['목표', "'기적의 대병동'을 짓밟고 생명을 통제하는 기적의 성배를 파괴하라"], ['막는 세력', '성혈 의료 기사단']]
    },
    pages: [
        {   // 1쪽: 기적의 대병동 · 예전의 성녀 · 진실
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(6, 'A', L3.top.rect, { fy: 0.45, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(255, 40, 70, 0.45)', css: 'radial-gradient(circle at 626px 87px, var(--c), transparent 110px)', cls: 'is-pulse' },
                        { fx: 'rays', color: 'rgba(255, 230, 170, 0.14)' },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left', tone: 'sepia',
                    layers: [
                        pic(6, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { particles: 'dust', rate: 4, area: [0, 40, 616, 300] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#120204',
                    layers: [
                        pic(6, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'gold', particles: 'embers', rate: 4, area: [120, 0, 440, 160] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 600, text: "돈과 권력을 가진 귀족만 치료받을 수 있는 곳— 타락한 교회의 '기적의 대병동'." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 560, at: 1.3, text: '가난한 자들의 피는, 귀족의 연명을 위해 뽑혀 나갔다.' }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 18, y: 14, w: 280, text: '한때 빈민을 돌보던 헌신적인 성녀.' },
                    { on: 'B', type: 'cap', x: 290, y: 280, w: 300, at: 2.0, text: '— 그러나 교회는 그녀의 이름을 팔고, 그녀가 살린 환자들을 뒤에서 죽이고 있었다.' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', fx: 'flash', at: 0.8 }, { on: 'C', fx: 'shake', at: 0.8 }, { on: 'C', id: 'gold', burst: 24, at: 0.8 }],
                    sfx: [['shield_hit', 0.8]],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 240, text: '진실을 안 그날—' },
                        { on: 'C', type: 'sfx', x: 480, y: 30, size: 48, rot: 10, color: '#ffd36a', at: 0.8, text: '쩌억—' },
                        { on: 'C', type: 'cap', x: 30, y: 300, w: 320, at: 1.4, text: '성녀의 후광은 금이 가고, 피눈물이 흘렀다.' }] }
            ]
        },
        {   // 2쪽: 난입 · 성녀의 말 · 성배와 기사단
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(6, 'D', BT.top.rect, { fy: 0.45, push: 0.05, from: { y: 20 } }),
                        { fx: 'rays', color: 'rgba(200, 230, 255, 0.2)' },
                        { id: 'debris', particles: 'debris', rate: 0, area: [60, 0, 360, 120] },
                        { fx: 'speed' },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(6, 'E', BT.bl.rect, { fx: 0.2, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(6, 'F', BT.br.rect, { fx: 0.7, fy: 0.55, push: 0.06, dur: 6 }),
                        { fx: 'glow', color: 'rgba(255, 30, 60, 0.5)', css: 'radial-gradient(circle at 515px 40px, var(--c), transparent 90px)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'flash', at: 0.3 }, { on: 'D', fx: 'quake', at: 0.4 }, { on: 'D', id: 'debris', burst: 36, at: 0.3 }],
                    sfx: [['shield_hit', 0.3, { rate: 1.3 }], ['mech_land', 0.5, { vol: 0.6 }]],
                    texts: [
                        { on: 'D', type: 'cap', x: 600, y: 18, w: 520, text: '찬란한 스테인드글라스가 산산조각 나며—' },
                        { on: 'D', type: 'sfx', x: 70, y: 250, size: 56, rot: -12, at: 0.35, color: '#bfe9ff', text: '쨍그랑—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '귀족', shout: true, tail: 'br', x: 820, y: 110, w: 320, text: '서, 성녀님?!\n어째서 여기에…!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '봉합 성녀', tone: 'dark', tail: 'l', x: 300, y: 40, w: 290, text: '나는 살려 달라는 손을… 한 번도 놓고 싶지 않았어.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '성혈 의료 기사단', tone: 'red', tail: 'r', x: 26, y: 24, w: 280, text: '이단 판정.\n성녀를— 해부하라!' }] }
            ]
        },
        {   // 3쪽: 참혹한 구원
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(6, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 40, 70, 0.45)', css: 'radial-gradient(circle at 784px 250px, var(--c), transparent 120px)', cls: 'is-pulse' },
                        { particles: 'embers', rate: 8, area: [200, 100, 500, 300] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['giant_step', 0.6, { vol: 0.5, rate: 1.4 }], ['giant_step', 1.4, { vol: 0.5, rate: 1.4 }]],
                    texts: [
                        { on: 'G', type: 'say', who: '봉합 성녀', tone: 'dark', shout: true, tail: 'bl', x: 430, y: 30, w: 460, text: '너희가 죽음이라 부르는 것마저 닫아 버릴 테니…\n아무도 내 품에서 떠나지 마.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '피에 젖은 성역— 참혹한 구원이 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 7 · 뒤틀린 인형사 : 잿빛 인형극 (11-03 — 보병·장교 대사는 Claude 초안)
// ==========================================================================
const STAGE7 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 7', name: '잿빛 인형극', face: face('doll'), color: '#5ff0ff',
        rows: [['주인공', '뒤틀린 인형사 — 아이들을 잃은 장난감 장인'], ['목표', '제국군 참호 방어선을 갈아 버리고 전방 사령탑을 무너뜨려라'], ['막는 세력', '제국 제1 포병 사단']]
    },
    pages: [
        {   // 1쪽: 잿빛 전쟁터 · 장난감 장인 · 포격
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(7, 'A', L3.top.rect, { fy: 0.4, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(240, 220, 90, 0.3)', css: 'radial-gradient(circle at 689px 200px, var(--c), transparent 140px)', cls: 'is-pulse' },
                        { particles: 'ash', rate: 10, area: [0, -10, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left', tone: 'sepia',
                    layers: [
                        pic(7, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { particles: 'dust', rate: 4, area: [0, 40, 616, 300] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right',
                    layers: [
                        pic(7, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'debris', particles: 'debris', rate: 0, area: [300, 120, 200, 120] },
                        { particles: 'embers', rate: 8, area: [200, 100, 400, 200] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: '끝없는 포격으로 모든 것이 재로 덮인 전쟁터.' },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 520, at: 1.3, text: '그 한가운데— 처참하게 무너진 고아원 터.' }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 300, y: 14, w: 290, text: '한때 전쟁고아들에게 장난감을 만들어 주던 따뜻한 장인.' },
                    { on: 'B', type: 'cap', x: 18, y: 300, w: 300, at: 1.8, text: '부서진 인형은 몇 번이고 고쳐 주었다.' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', fx: 'flash', at: 0.5 }, { on: 'C', fx: 'quake', at: 0.5 }, { on: 'C', id: 'debris', burst: 30, at: 0.5 }],
                    sfx: [['base_blast', 0.5]],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 300, text: '— 그러나 포탄은 고아원 위로 떨어졌다.' },
                        { on: 'C', type: 'sfx', x: 420, y: 110, size: 64, rot: -10, color: '#ffe066', at: 0.5, text: '콰광—' },
                        { on: 'C', type: 'cap', x: 30, y: 300, w: 340, at: 1.4, text: '가장 소중한 아이들은, 고칠 틈도 없이 사라졌다.' }] }
            ]
        },
        {   // 2쪽: 잔해 속 인형사 · 인형사의 말 · 베헤모스와 장교
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(7, 'D', BT.top.rect, { fy: 0.4, push: 0.05, from: { y: 20 } }),
                        { id: 'strings', fx: 'glow', o: 0, color: 'rgba(90, 240, 255, 0.35)', css: 'radial-gradient(30% 90% at 15% 40%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { particles: 'ash', rate: 8, area: [0, -10, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(7, 'E', BT.bl.rect, { fx: 0.2, fy: 0.35, push: 0.06, dur: 6 }),
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(7, 'F', BT.br.rect, { fx: 0.7, fy: 0.45, push: 0.06, dur: 6 }),
                        { particles: 'ash', rate: 6, area: [0, 0, 654, 60] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.8, acts: [{ on: 'D', id: 'strings', to: { o: 1 }, dur: 0.8, at: 0.6 }, { on: 'D', fx: 'shake', at: 1.2 }],
                    sfx: [['doll_strings', 0.6], ['doll_summon', 1.2]],
                    texts: [
                        { on: 'D', type: 'cap', x: 470, y: 18, w: 480, text: '폭격으로 박살 난 고아원의 잔해 속—' },
                        { on: 'D', type: 'sfx', x: 40, y: 40, size: 40, rot: -8, color: '#7ff5ff', at: 0.6, text: '끼릭… 끼릭…' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '제국군 보병', shout: true, tail: 'br', x: 860, y: 20, w: 330, text: '뭐, 뭐야…\n저 인형들은!?' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '뒤틀린 인형사', tone: 'dark', tail: 'l', x: 300, y: 40, w: 290, text: '이번 가족만큼은…\n누구도 나를 떠나지 못해.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '제국 돌격 장교', tone: 'red', tail: 'r', x: 26, y: 24, w: 300, text: '고아원 하나 날린 게 대수인가!\n포격을 멈추지 마라!' }] }
            ]
        },
        {   // 3쪽: 핏빛 인형극
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(7, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 60, 50, 0.4)', css: 'radial-gradient(circle at 926px 91px, var(--c), transparent 90px)', cls: 'is-pulse' },
                        { particles: 'ash', rate: 12, area: [0, -10, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['doll_snip', 0.6], ['doll_xcut', 1.4]],
                    texts: [
                        { on: 'G', type: 'say', who: '뒤틀린 인형사', tone: 'dark', shout: true, tail: 'bl', x: 380, y: 30, w: 400, text: '자, 막을 올리자.\n피로 물든… 마지막 인형극을.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '잿빛 인형극의 막이 오른다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 8 · 서리의 무희 : 얼어붙은 안식 (11-03 — 근위병·국왕 대사는 Claude 초안)
// ==========================================================================
const STAGE8 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 8', name: '얼어붙은 안식', face: face('frost'), color: '#8fd8ff',
        rows: [['주인공', '서리의 무희 — 모든 것을 잃은 극단의 무희'], ['목표', '노르딘 왕실 근위대를 눈보라로 쓸어 버리고 메인 화로석 제단을 부숴라'], ['막는 세력', '노르딘 왕실 근위대 & 온기 탐식자들']]
    },
    pages: [
        {   // 1쪽: 노르딘 · 얼어붙은 공원 · 눈물
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(8, 'A', L3.top.rect, { fy: 0.3, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(255, 70, 40, 0.35)', css: 'radial-gradient(circle at 922px 101px, var(--c), transparent 160px)', cls: 'is-pulse' },
                        { particles: 'ash', rate: 14, area: [0, -10, 1252, 40] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(8, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { particles: 'ash', rate: 8, area: [0, -10, 616, 30] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#02060e',
                    layers: [
                        pic(8, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'eyeglow', fx: 'glow', o: 0, color: 'rgba(120, 220, 255, 0.6)', css: 'radial-gradient(circle at 327px 162px, var(--c), transparent 140px)', cls: 'is-pulse' },
                        { id: 'frost', particles: 'ash', rate: 4, area: [0, 0, 671, 382] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: "일 년 내내 눈보라가 치는 영구동토의 왕국, '노르딘'." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 520, at: 1.3, text: '왕은 온기를 내는 화로석을 모두 독점했다.' }] },
                { show: 'B', texts: [
                    { on: 'B', type: 'cap', x: 18, y: 14, w: 300, text: '— 그리고 극단원과 마을 사람들은' },
                    { on: 'B', type: 'cap', x: 400, y: 290, w: 190, at: 1.8, text: '서로를 껴안은 채 얼어붙었다.' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', id: 'eyeglow', to: { o: 1 }, dur: 0.5, at: 0.8 }, { on: 'C', fx: 'flash', at: 0.8 }, { on: 'C', id: 'frost', rate: 20, at: 0.8 }],
                    sfx: [['frost_freeze', 0.8]],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 260, text: '슬픔에 잠긴 무희의 눈물이—' },
                        { on: 'C', type: 'sfx', x: 470, y: 40, size: 48, rot: 10, color: '#bfefff', at: 0.8, text: '쩌적—' },
                        { on: 'C', type: 'cap', x: 30, y: 300, w: 260, at: 1.4, text: '얼음으로 굳었다.' }] }
            ]
        },
        {   // 2쪽: 죽음의 춤 · 무희의 말 · 블라디미르
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(8, 'D', BT.top.rect, { fy: 0.3, push: 0.05, from: { y: 20 } }),
                        { fx: 'glow', color: 'rgba(140, 220, 255, 0.3)', css: 'radial-gradient(30% 80% at 28% 50%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'frost', particles: 'ash', rate: 8, area: [100, 40, 600, 300] },
                        { fx: 'speed' },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(8, 'E', BT.bl.rect, { fx: 0.2, fy: 0.35, push: 0.06, dur: 6 }),
                        { particles: 'ash', rate: 6, area: [0, 0, 616, 266] },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(8, 'F', BT.br.rect, { fx: 0.7, fy: 0.4, push: 0.06, dur: 6 }),
                        { particles: 'embers', rate: 10, area: [300, 100, 354, 160] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'flash', at: 0.4 }, { on: 'D', fx: 'shake', at: 0.4 }, { on: 'D', id: 'frost', rate: 30, at: 0.4 }],
                    sfx: [['frost_blizzard', 0.3], ['frost_shatter', 0.8]],
                    texts: [
                        { on: 'D', type: 'cap', x: 470, y: 18, w: 460, text: '무희가 천천히 일어나는 순간— 대기가 얼어붙었다.' },
                        { on: 'D', type: 'sfx', x: 520, y: 200, size: 58, rot: -8, at: 0.45, color: '#bfefff', text: '파키킥—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '노르딘 근위병', shout: true, tail: 'br', x: 880, y: 20, w: 320, text: '횃불이…\n얼어붙는다?!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '서리의 무희', tone: 'dark', tail: 'l', x: 300, y: 30, w: 300, text: '당신이 거둬간 온기 때문에…\n내 소중한 사람들이 차가운 조각상이 되었어.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '폭군 블라디미르', tone: 'red', tail: 'r', x: 26, y: 24, w: 290, text: '온기는 왕의 것이다!\n저 계집을 화로에 던져 넣어라!' }] }
            ]
        },
        {   // 3쪽: 서리의 춤
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(8, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 90, 40, 0.4)', css: 'radial-gradient(circle at 862px 225px, var(--c), transparent 140px)', cls: 'is-pulse' },
                        { particles: 'ash', rate: 18, area: [0, -10, 1252, 60] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['frost_fan', 0.6], ['frost_crescent', 1.4]],
                    texts: [
                        { on: 'G', type: 'say', who: '서리의 무희', tone: 'dark', shout: true, tail: 'bl', x: 230, y: 150, w: 430, text: '이 왕국의 화로석을 모두 부숴 주마.\n모두가 고통 없이 잠들 수 있도록.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '얼어붙은 안식— 서리의 춤이 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 9 · 철거의 설계자 : 무너진 보금자리 (11-03 — 깡패·회장 대사는 Claude 초안)
// ==========================================================================
const STAGE9 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 9', name: '무너진 보금자리', face: face('architect'), color: '#ffb020',
        rows: [['주인공', '철거의 설계자 — 부실 공사로 주민들을 잃은 건축가'], ['목표', '골드만 건설 현장을 밑바닥부터 무너뜨리고 메인 크레인 타워를 박살 내라'], ['막는 세력', '골드만 건설 용역 및 중장비 경비대']]
    },
    pages: [
        {   // 1쪽: 재건축 구역 · 무너진 아파트 · 설계도
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(9, 'A', L3.top.rect, { fy: 0.45, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(255, 60, 200, 0.22)', css: 'radial-gradient(40% 80% at 25% 30%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { particles: 'dust', rate: 6, area: [0, 160, 1252, 140] },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(9, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { id: 'debris', particles: 'debris', rate: 0, area: [340, 0, 276, 120] },
                        { particles: 'dust', rate: 8, area: [300, 100, 316, 260] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right',
                    layers: [
                        pic(9, 'C', L3.br.rect, { push: 0.07 }),
                        { particles: 'dust', rate: 5, area: [0, 0, 671, 382] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: "탐욕스러운 거대 건설사의 '제1 재건축 구역'." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 560, at: 1.3, text: '무너진 집터 위로, 새 마천루가 올라가고 있었다.' }] },
                { show: 'B', acts: [{ on: 'B', id: 'debris', burst: 26, at: 0.8 }, { on: 'B', fx: 'quake', at: 0.8 }], sfx: [['base_destroyed', 0.8, { vol: 0.7 }]],
                    texts: [
                        { on: 'B', type: 'cap', x: 300, y: 14, w: 290, text: '— 그날. 부실 공사로 지어진 아파트가 무너졌다.' },
                        { on: 'B', type: 'cap', x: 330, y: 300, w: 270, at: 1.8, text: '그녀가 설계를 경고했던 바로 그 건물이었다.' }] },
                { show: 'C', texts: [
                    { on: 'C', type: 'cap', x: 30, y: 14, w: 300, text: '남은 것은 구겨진 설계도와—' },
                    { on: 'C', type: 'cap', x: 30, y: 300, w: 330, at: 1.4, text: '아이가 쥐고 있던 작은 열쇠고리뿐.' }] }
            ]
        },
        {   // 2쪽: 바리케이드 돌파 · 설계자의 말 · 파노프티콘
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(9, 'D', BT.top.rect, { fy: 0.4, push: 0.05, from: { y: 20 } }),
                        { fx: 'glow', color: 'rgba(255, 170, 40, 0.3)', css: 'radial-gradient(25% 60% at 35% 70%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'debris', particles: 'debris', rate: 0, area: [0, 40, 420, 160] },
                        { particles: 'sparks', rate: 10, area: [300, 220, 200, 120] },
                        { fx: 'speed' },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(9, 'E', BT.bl.rect, { fx: 0.2, fy: 0.3, push: 0.06, dur: 6 }),
                        { particles: 'sparks', rate: 6, area: [0, 60, 300, 200] },
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(9, 'F', BT.br.rect, { fx: 0.7, fy: 0.4, push: 0.06, dur: 6 }),
                        { fx: 'glow', color: 'rgba(255, 60, 220, 0.22)', css: 'radial-gradient(40% 80% at 15% 30%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'quake', at: 0.3 }, { on: 'D', fx: 'flash', at: 0.3 }, { on: 'D', id: 'debris', burst: 34, at: 0.3 }],
                    sfx: [['base_blast', 0.3], ['chimera_slam', 0.9, { vol: 0.6 }]],
                    texts: [
                        { on: 'D', type: 'cap', x: 520, y: 18, w: 460, text: '낡은 바리케이드가 굉음과 함께 박살 나고—' },
                        { on: 'D', type: 'sfx', x: 600, y: 210, size: 60, rot: -8, at: 0.35, color: '#ffc040', text: '콰지직—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '철거 용역 깡패', shout: true, tail: 'br', x: 880, y: 24, w: 320, text: '뭐야, 저 꼬맹이는!?\n드릴을 들었잖아!' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '철거의 설계자', tone: 'dark', tail: 'l', x: 300, y: 40, w: 290, text: '안전한 집은…\n내가 다시 세운다.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '골드만 회장', tone: 'red', tail: 'r', x: 26, y: 24, w: 300, text: '공사 일정에 차질은 없다!\n저 계집째로 콘크리트에 묻어 버려!' }] }
            ]
        },
        {   // 3쪽: 철거 시작
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(9, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 150, 40, 0.4)', css: 'radial-gradient(circle at 180px 260px, var(--c), transparent 130px)', cls: 'is-pulse' },
                        { particles: 'sparks', rate: 14, area: [60, 180, 280, 200] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['mech_fist_hit', 0.6], ['base_blast', 1.4, { vol: 0.5 }]],
                    texts: [
                        { on: 'G', type: 'say', who: '철거의 설계자', tone: 'dark', shout: true, tail: 'bl', x: 300, y: 40, w: 460, text: '너희 탐욕으로 쌓아 올린 이 거대한 묘비들—\n내 손으로 모조리 평탄화해 주마.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '무너진 보금자리— 철거가 시작된다.' }] }
            ]
        }
    ]
};

// ==========================================================================
// 스테이지 10 · 침묵의 방송자 : 거짓된 주파수 (11-03 — 진압대·마더 보이스 대사는 Claude 초안)
// ==========================================================================
const STAGE10 = {
    bgm: 'boss',
    title: {
        no: 'STAGE 10', name: '거짓된 주파수', face: face('broadcaster'), color: '#ff3fb4',
        rows: [['주인공', '침묵의 방송자 — 마지막 구조 방송을 빼앗긴 진행자'], ['목표', '언론 통제국 병력을 박살 내고 최상층의 메인 송출 심장을 파괴하라'], ['막는 세력', '언론 통제국 & 세뇌된 진압대']]
    },
    pages: [
        {   // 1쪽: 중앙 방송 타워 · 끊긴 구조 방송 · 침묵
            panels: {
                A: {
                    ...L3.top, enter: 'down',
                    layers: [
                        pic(10, 'A', L3.top.rect, { fy: 0.35, push: 0.05, pan: -40, dur: 12 }),
                        { fx: 'glow', color: 'rgba(255, 50, 170, 0.35)', css: 'radial-gradient(circle at 626px 70px, var(--c), transparent 160px)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                },
                B: {
                    ...L3.bl, enter: 'left',
                    layers: [
                        pic(10, 'B', L3.bl.rect, { fx: 0.3, push: 0.06 }),
                        { id: 'lamp', fx: 'glow', color: 'rgba(255, 40, 40, 0.35)', css: 'radial-gradient(circle at 140px 60px, var(--c), transparent 90px)', cls: 'is-pulse' },
                        { id: 'sparks', particles: 'sparks', rate: 6, area: [330, 100, 140, 160] },
                        { fx: 'vignette' }
                    ]
                },
                C: {
                    ...L3.br, enter: 'right', bg: '#050205',
                    layers: [
                        pic(10, 'C', L3.br.rect, { push: 0.07 }),
                        { id: 'eyeglow', fx: 'glow', o: 0, color: 'rgba(255, 60, 200, 0.8)', css: 'radial-gradient(circle at 368px 82px, var(--c), transparent 60px)', cls: 'is-pulse' },
                        { id: 'sparks', particles: 'sparks', rate: 4, area: [140, 180, 200, 120] },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'A', texts: [
                    { on: 'A', type: 'cap', x: 22, y: 18, w: 520, text: "철거 현장 너머, 도시 한가운데 솟은 언론 통제국의 '중앙 방송 타워'." },
                    { on: 'A', type: 'cap', x: 22, y: 76, w: 520, at: 1.3, text: '오늘도 거짓 뉴스와 찬양 방송이 도시를 뒤덮는다.' }] },
                { show: 'B', acts: [{ on: 'B', id: 'sparks', burst: 24, at: 1.4 }, { on: 'B', fx: 'shake', at: 1.4 }], sfx: [['shield_hit', 1.4]],
                    texts: [
                        { on: 'B', type: 'cap', x: 18, y: 14, w: 300, text: '— 그날. 재난 속에서 사람들을 살릴 수 있었던 마지막 구조 방송.' },
                        { on: 'B', type: 'cap', x: 330, y: 300, w: 270, at: 1.6, text: '진압대는 그 방송을 끊어 버렸다.' }] },
                { show: 'C', dur: 2.4, acts: [{ on: 'C', id: 'eyeglow', to: { o: 1 }, dur: 0.5, at: 1.0 }],
                    texts: [
                        { on: 'C', type: 'cap', x: 30, y: 14, w: 260, text: '그리고 찾아온, 끔찍한 정적.' },
                        { on: 'C', type: 'sfx', x: 380, y: 200, size: 40, rot: -6, color: '#ff8fd8', at: 0.6, text: '지직… 지직…' }] }
            ]
        },
        {   // 2쪽: 스피커 폭발 · 방송자의 말 · 마더 보이스
            panels: {
                D: {
                    ...BT.top, enter: 'up',
                    layers: [
                        pic(10, 'D', BT.top.rect, { fy: 0.65, push: 0.05, from: { y: 20 } }),
                        { fx: 'glow', color: 'rgba(255, 60, 200, 0.35)', css: 'radial-gradient(25% 70% at 30% 70%, var(--c), transparent 70%)', cls: 'is-pulse' },
                        { id: 'debris', particles: 'debris', rate: 0, area: [300, 0, 700, 120] },
                        { fx: 'speed' },
                        { fx: 'vignette' }
                    ]
                },
                E: {
                    ...BT.bl, enter: 'left',
                    layers: [
                        pic(10, 'E', BT.bl.rect, { fx: 0.2, fy: 0.45, push: 0.06, dur: 6 }),
                        { fx: 'vignette' }
                    ]
                },
                F: {
                    ...BT.br, enter: 'right',
                    layers: [
                        pic(10, 'F', BT.br.rect, { fx: 0.75, fy: 0.4, push: 0.06, dur: 6 }),
                        { fx: 'glow', color: 'rgba(255, 50, 200, 0.45)', css: 'radial-gradient(circle at 400px 110px, var(--c), transparent 110px)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'D', dur: 2.6,
                    acts: [{ on: 'D', fx: 'quake', at: 0.3 }, { on: 'D', fx: 'flash', at: 0.3 }, { on: 'D', id: 'debris', burst: 34, at: 0.4 }],
                    sfx: [['hero_wave', 0.3], ['base_blast', 0.6, { vol: 0.6 }]],
                    texts: [
                        { on: 'D', type: 'cap', x: 560, y: 18, w: 420, text: '거대한 소리굽쇠가 지면을 내리치자—' },
                        { on: 'D', type: 'sfx', x: 700, y: 170, size: 60, rot: -8, at: 0.35, color: '#ff8fd8', text: '우우웅—' }] },
                { texts: [
                    { on: 'D', type: 'say', who: '음파 방패 경비대', shout: true, tail: 'br', x: 880, y: 24, w: 320, text: '스, 스피커가 전부…\n터져 나갔다!?' }] },
                { show: 'E', texts: [
                    { on: 'E', type: 'say', who: '침묵의 방송자', tone: 'dark', tail: 'l', x: 300, y: 40, w: 290, text: '거짓으로 가득한 도시는…\n침묵하라.' }] },
                { show: 'F', texts: [
                    { on: 'F', type: 'say', who: '마더 보이스', tone: 'red', tail: 'r', x: 26, y: 24, w: 290, text: '잡음 감지. 송출 방해 요소.\n즉시— 삭제하십시오.' }] }
            ]
        },
        {   // 3쪽: 영원한 침묵
            panels: {
                G: {
                    ...FULL, enter: 'zoom',
                    layers: [
                        pic(10, 'G', FULL.rect, { fx: 0.3, zoom: 1.04, push: 0.06, pan: -50, dur: 10 }),
                        { fx: 'glow', color: 'rgba(255, 60, 200, 0.45)', css: 'radial-gradient(circle at 630px 60px, var(--c), transparent 140px)', cls: 'is-pulse' },
                        { fx: 'vignette' }
                    ]
                }
            },
            beats: [
                { show: 'G', dur: 3.4, sfx: [['hero_wave', 0.6, { vol: 0.6 }], ['shield_on', 1.4]],
                    texts: [
                        { on: 'G', type: 'say', who: '침묵의 방송자', tone: 'dark', shout: true, tail: 'bl', x: 400, y: 150, w: 440, text: '내 마지막 방송을 끊은 너희들의 비명조차—\n내가 모두 지워 주겠다.' }] },
                { texts: [
                    { on: 'G', type: 'cap', x: 22, y: 620, w: 560, text: '거짓된 주파수— 영원한 침묵이 시작된다.' }] }
            ]
        }
    ]
};

/** 구역 번호 → 대본 (구역 N의 첫 스테이지 N-1 출격 전) */
export const STORY_INTROS = { 1: STAGE1, 2: STAGE2, 3: STAGE3, 4: STAGE4, 5: STAGE5, 6: STAGE6, 7: STAGE7, 8: STAGE8, 9: STAGE9, 10: STAGE10 };
