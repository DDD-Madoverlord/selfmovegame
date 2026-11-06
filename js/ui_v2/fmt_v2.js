/**
 * 큰 수를 짧게 (11-05 피드백 2번 — 캐릭터 선택 능력치 칸 폭 줄이기)
 * 999까지 그대로 · 1,000 이상은 K(100K 미만은 소수 한 자리) · 1,000,000 이상은 M — 반올림하지 않고 버림(실제보다 크게 보이지 않게)
 * 예: 950 → '950', 12,345 → '12.3K', 123,456 → '123K', 1,234,567 → '1.2M'
 */
export function fmtK(n) {
    const v = Number(n) || 0, a = Math.abs(v);
    if (a < 1000) return String(Math.trunc(v));
    const [d, u] = a < 1e6 ? [1e3, 'K'] : [1e6, 'M'];
    const x = v / d;
    return `${Math.abs(x) < 100 ? Math.trunc(x * 10) / 10 : Math.trunc(x)}${u}`;
}
