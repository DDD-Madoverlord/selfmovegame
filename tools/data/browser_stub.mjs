// 게임 모듈 일부가 로드 때 document·Image 등 브라우저 객체를 건드리므로, 노드에서는 무엇이든 받아 주는 빈 틀로 막는다.
// (export_parts.mjs가 가장 먼저 불러옴 — 파츠 표를 만드는 데는 화면이 필요 없다)
const stub = () => new Proxy(function () { }, {
    get: (_, key) => key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined
        : key === 'length' ? 0 : stub(),
    set: () => true,
    apply: () => stub(),
    construct: () => stub()
});
for (const name of ['document', 'Image', 'Audio', 'AudioContext', 'HTMLElement', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    globalThis[name] ??= stub();
}
globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem: () => null, setItem() { }, removeItem() { } };
// 게임 모듈이 불러올 때 리그 그림·rig.json을 상대 주소로 fetch함(monster_v2.js 전투 리그) — 노드에서는 끝나지 않는 약속으로 둠
// (파츠 표에는 필요 없음, 처리 안 된 거부로 노드가 멈추던 것 — 11-05)
const realFetch = globalThis.fetch;
globalThis.fetch = (url, ...rest) => (/^[a-z]+:/i.test(String(url)) ? realFetch(url, ...rest) : new Promise(() => { }));
// window 이벤트 (monster_v2.js 'v2-layout' 등)
globalThis.addEventListener ??= () => { };
globalThis.removeEventListener ??= () => { };
globalThis.dispatchEvent ??= () => true;
