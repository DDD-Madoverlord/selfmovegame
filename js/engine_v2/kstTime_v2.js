/* 한국시간 날짜·월요일 주차. 호출자가 시각을 주입할 수 있다. */
export const DAY_MS = 24 * 60 * 60 * 1000;
export function kstDayKey(now = Date.now()) {
    return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function kstWeekKey(now = Date.now()) {
    const date = new Date(now + 9 * 60 * 60 * 1000);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0, 10);
}
