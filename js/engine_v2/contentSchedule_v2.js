/* 콘텐츠 공개 일정 (v2): 빈 설정은 전부 공개. 한국 시간 0시부터 공개한다.
   예: zones: { 2: '2027-01-15' }, characters: { frost: '2027-02-01' }
   기기 시계를 사용한다. 서버 시간 도입 시 now 인자로 전달할 수 있다.

   숨김 캐릭터 그룹 (D-119 8번, Q-042 임시): 숨김 캐릭터 4명을 2명씩 두 번, 그 캐릭터의 구역과 **같은 날** 공개한다.
   그룹에 든 구역·캐릭터는 그룹 date가 없으면 숨김(공개 전) — 위 '빈 설정 = 공개'와 뜻이 반대라 그룹에 든 것만 이렇게.
   구역·캐릭터에 따로 날짜(RELEASE)를 적으면 그 날짜가 그룹보다 먼저다. */
export const RELEASE = { zones: {}, characters: {} };
export const RELEASE_GROUPS = [
    { id: 2, zones: [7, 8], characters: ['doll', 'frost'], date: null },
    { id: 3, zones: [9, 10], characters: ['architect', 'broadcaster'], date: null }
];

let schedule = RELEASE;
let groups = RELEASE_GROUPS;
let revealAll = false;

/** 검사·QA용 설정 교체. null이면 기본 설정으로 돌아간다. */
export function setReleaseSchedule(obj) {
    schedule = obj || RELEASE;
}

/** 검사·QA용 그룹 교체. null이면 기본 그룹, []이면 그룹 숨김 없음 */
export function setReleaseGroups(list) {
    groups = list || RELEASE_GROUPS;
}

/** 시험용 전체 해제 2단계(메뉴 아이콘)와 함께 — 숨김 그룹도 이번 실행 동안만 공개 (progress_v2.js unlockEverythingTemp) */
export function revealAllTemp() {
    revealAll = true;
}

function dateTime(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const time = Date.parse(`${date}T00:00:00+09:00`);
    return Number.isFinite(time) ? time : null;
}

function releaseTime(kind, key) {
    return dateTime(schedule[kind]?.[key]);
}

/** 구역·캐릭터가 든 숨김 그룹 (없으면 null) */
export function releaseGroupOf(kind, key) {
    return groups.find(g => kind === 'zones' ? g.zones.includes(Number(key)) : g.characters.includes(key)) || null;
}

/** 구역의 그룹 번호: 처음부터 공개된 구역은 1 (그룹 배율·난이도 — stages_v2.js · difficulty_v2.js) */
export function groupOfZone(zone) {
    const g = RELEASE_GROUPS.find(x => x.zones.includes(Number(zone)));
    return g ? g.id : 1;
}

function localHost() {
    return typeof location !== 'undefined' && ['localhost', '127.0.0.1', ''].includes(location.hostname);
}

/** 내부 시험용 전부 공개(?allContent=1) — 로컬 주소에서만 (공개 웹판에서는 주소만 바꿔 미리 여는 것을 막음) */
function allContentOverride() {
    return localHost() && new URLSearchParams(location.search).get('allContent') === '1';
}

// 자동 검사용(?openGroups=1, 로컬 주소만): 숨김 그룹만 공개 — 공개 일정(RELEASE) 검사는 그대로 (tools/tests/common.py)
if (localHost() && new URLSearchParams(location.search).get('openGroups') === '1') groups = [];

function isReleased(kind, key, now, opts) {
    if (allContentOverride() || revealAll) return true;
    const time = releaseTime(kind, key);
    if (time != null) return now >= time;
    const g = opts && opts.ignoreGroups ? null : releaseGroupOf(kind, key);
    if (g) {
        const t = dateTime(g.date);
        return t != null && now >= t;
    }
    return true;
}

/** opts.ignoreGroups: 숨김 그룹은 보지 않고 날짜만 (상점·패스로 파는 펫 — 구역 7의 태엽 묘지기, pets_v2.js) */
export function isZoneReleased(zone, now = Date.now(), opts = null) {
    return isReleased('zones', zone, now, opts);
}

export function isCharacterReleased(id, now = Date.now()) {
    return isReleased('characters', id, now);
}

/** kind는 zones 또는 characters. 설정된 날짜의 표시 문구 (없으면 null). 그룹에 든 것은 그룹 날짜 */
export function releaseDateOf(kind, key) {
    const date = releaseTime(kind, key) != null ? schedule[kind][key] : dateTime(releaseGroupOf(kind, key)?.date) != null ? releaseGroupOf(kind, key).date : null;
    if (!date) return null;
    const [, month, day] = date.split('-');
    return `${Number(month)}월 ${Number(day)}일`;
}

/** '곧 공개 · 12월 31일' (날짜가 안 정해졌으면 '곧 공개') */
export function releaseLabelOf(kind, key) {
    const d = releaseDateOf(kind, key);
    return d ? `곧 공개 · ${d}` : '곧 공개';
}
