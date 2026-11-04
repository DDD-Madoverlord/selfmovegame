/* 콘텐츠 공개 일정 (v2): 빈 설정은 전부 공개. 한국 시간 0시부터 공개한다.
   예: zones: { 2: '2027-01-15' }, characters: { frost: '2027-02-01' }
   기기 시계를 사용한다. 서버 시간 도입 시 now 인자로 전달할 수 있다. */
export const RELEASE = { zones: {}, characters: {} };

let schedule = RELEASE;

/** 검사·QA용 설정 교체. null이면 기본 설정으로 돌아간다. */
export function setReleaseSchedule(obj) {
    schedule = obj || RELEASE;
}

function releaseTime(kind, key) {
    const date = schedule[kind]?.[key];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const time = Date.parse(`${date}T00:00:00+09:00`);
    return Number.isFinite(time) ? time : null;
}

/** 내부 시험용 전부 공개(?allContent=1) — 로컬 주소에서만 (공개 웹판에서는 주소만 바꿔 미리 여는 것을 막음) */
function allContentOverride() {
    if (typeof location === 'undefined') return false;
    if (!['localhost', '127.0.0.1', ''].includes(location.hostname)) return false;
    return new URLSearchParams(location.search).get('allContent') === '1';
}

function isReleased(kind, key, now) {
    if (allContentOverride()) return true;
    const time = releaseTime(kind, key);
    return time == null || now >= time;
}

export function isZoneReleased(zone, now = Date.now()) {
    return isReleased('zones', zone, now);
}

export function isCharacterReleased(id, now = Date.now()) {
    return isReleased('characters', id, now);
}

/** kind는 zones 또는 characters. 설정된 날짜의 표시 문구 (없으면 null). */
export function releaseDateOf(kind, key) {
    if (releaseTime(kind, key) == null) return null;
    const [, month, day] = schedule[kind][key].split('-');
    return `${Number(month)}월 ${Number(day)}일`;
}
