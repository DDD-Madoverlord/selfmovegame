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
