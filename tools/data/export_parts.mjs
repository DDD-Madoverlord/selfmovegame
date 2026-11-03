import './browser_stub.mjs';
import { registerAllSets2 } from '../../js/engine_v2/sets2/index.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { registerV2Parts, V2_PARTS } from '../../js/engine_v2/partsExtra_v2.js';
import { SKILLS as RUNTIME_SKILLS, PART_SKILL as RUNTIME_PART_SKILL, LEG_PASSIVES as RUNTIME_LEG_PASSIVES } from '../../js/engine_v2/skills_v2.js';
import { PARTS_DB } from '../../js/data/parts.js';
import { ROSTER, characterOfPart, partSetLabel } from '../../js/engine_v2/roster_v2.js';

// 2차 세트·새 캐릭터 기본 파츠는 main_v2.js처럼 registerV2Parts() 전에 한 번 등록한다.
// 표에는 모두 싣지만, 테스트 화면(rig_test.html)은 이 파츠들의 미리보기가 없어 목록에서 뺀다.
// (registerAllSets2는 V2_PARTS에 더하고, registerV2Parts가 그것을 PARTS_DB로 옮긴다)
const partIds = () => Object.values(V2_PARTS).flat().map(part => part.id);
const beforeSets2 = new Set(partIds());
registerAllSets2();
const sets2Ids = new Set(partIds().filter(id => !beforeSets2.has(id)));
registerV2Parts();

// 문자열과 주석은 통째로 읽어, 스킬 함수 안의 중괄호와 메타데이터를 구분한다.
const source = await readFile(new URL('../../js/engine_v2/skills_v2.js', import.meta.url), 'utf8');
const tokens = source.match(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?|[^\s]/g)
    .filter(token => !token.startsWith('//') && !token.startsWith('/*'));

function properties(objectTokens, label) {
    if (objectTokens[0] !== '{' || objectTokens.at(-1) !== '}') {
        throw new Error(`${label}: 객체 리터럴을 찾을 수 없습니다.`);
    }
    const result = new Map();
    let start = 1;
    const stack = [];
    for (let i = 1; i < objectTokens.length; i++) {
        const token = objectTokens[i];
        if (stack.length === 0 && (token === ',' || i === objectTokens.length - 1)) {
            const entry = objectTokens.slice(start, i);
            if (entry.length) {
                if (entry[1] === ':') {
                    const key = /^[A-Za-z_$][\w$]*$/.test(entry[0]) ? entry[0] : literal([entry[0]], label);
                    result.set(key, entry.slice(2));
                } else if (entry[1] !== '(') {
                    throw new Error(`${label}: 지원하지 않는 속성 ${entry.join(' ')}`);
                }
            }
            start = i + 1;
            continue;
        }
        if (['{', '[', '('].includes(token)) stack.push(token);
        if (['}', ']', ')'].includes(token)) {
            const opening = stack.pop();
            if (opening !== { '}': '{', ']': '[', ')': '(' }[token]) {
                throw new Error(`${label}: 괄호가 맞지 않습니다.`);
            }
        }
    }
    if (stack.length) throw new Error(`${label}: 객체가 닫히지 않았습니다.`);
    return result;
}

function literal(valueTokens, label) {
    if (valueTokens?.length !== 1) throw new Error(`${label}: 문자열·숫자 리터럴이 필요합니다.`);
    const token = valueTokens[0];
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
    // 토큰 하나의 따옴표 문자열만 해석한다. 모듈이나 스킬 함수는 실행하지 않는다.
    if (token.startsWith("'") || token.startsWith('"')) return runInNewContext(token, Object.create(null));
    throw new Error(`${label}: 지원하지 않는 값 ${token}`);
}

function table(name) {
    const start = tokens.findIndex((token, i) => token === 'export' && tokens[i + 1] === 'const'
        && tokens[i + 2] === name && tokens[i + 3] === '=' && tokens[i + 4] === '{');
    if (start < 0) throw new Error(`${name}: 표를 찾을 수 없습니다.`);
    const starts = [start + 4];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'Object' && tokens[i + 1] === '.' && tokens[i + 2] === 'assign'
            && tokens[i + 3] === '(' && tokens[i + 4] === name && tokens[i + 5] === ',' && tokens[i + 6] === '{') {
            starts.push(i + 6);
        }
    }
    // 덧붙인 블록도 순서대로 합쳐, 같은 키는 나중 정의로 덮어쓴다.
    const result = new Map();
    for (const objectStart of starts) {
        let depth = 0;
        let end = objectStart;
        for (; end < tokens.length; end++) {
            if (tokens[end] === '{') depth++;
            if (tokens[end] === '}' && --depth === 0) break;
        }
        if (end === tokens.length) throw new Error(`${name}: 표가 닫히지 않았습니다.`);
        for (const [key, value] of properties(tokens.slice(objectStart, end + 1), name)) result.set(key, value);
    }
    return result;
}

function metadata(valueTokens, label, withCooldown = false) {
    const fields = properties(valueTokens, label);
    const name = literal(fields.get('name'), `${label}.name`);
    const desc = literal(fields.get('desc'), `${label}.desc`);
    if (typeof name !== 'string' || typeof desc !== 'string') throw new Error(`${label}: 이름·설명은 문자열이어야 합니다.`);
    const cd = withCooldown && fields.has('cd') ? literal(fields.get('cd'), `${label}.cd`) : '';
    if (cd !== '' && typeof cd !== 'number') throw new Error(`${label}: 쿨다운은 숫자여야 합니다.`);
    return { name, desc, cd };
}

const partSkills = new Map([...table('PART_SKILL')].map(([id, value]) => [id, literal(value, `PART_SKILL.${id}`)]));
// 소스 표에 없는 키는 등록된 런타임 표(세트 묶음이 더한 스킬·패시브)에서 채운다.
for (const [id, key] of Object.entries(RUNTIME_PART_SKILL)) if (!partSkills.has(id)) partSkills.set(id, key);
const skillTable = table('SKILLS');
const skills = new Map();
for (const key of new Set(partSkills.values())) {
    if (skillTable.has(key)) skills.set(key, metadata(skillTable.get(key), `SKILLS.${key}`, true));
    else if (RUNTIME_SKILLS[key]) skills.set(key, { name: RUNTIME_SKILLS[key].name, desc: RUNTIME_SKILLS[key].desc, cd: RUNTIME_SKILLS[key].cd || '' });
    else throw new Error(`PART_SKILL의 스킬 ${key}를 SKILLS에서 찾을 수 없습니다.`);
}
const passives = new Map([...table('LEG_PASSIVES')].map(([id, value]) => [id, metadata(value, `LEG_PASSIVES.${id}`)]));
for (const [id, p] of Object.entries(RUNTIME_LEG_PASSIVES)) if (!passives.has(id)) passives.set(id, { name: p.name, desc: p.desc, cd: '' });

const slots = [ ['head', '머리', '필살기'], ['body', '몸통', '스킬 2'], ['arm', '팔', '스킬 1'], ['leg', '다리', '패시브'] ];
const columns = ['부위', '파츠 이름', 'id', '세트', '가격(DM)', '체력', '초당 피해', '사거리', '속도', '공격 방식', '스킬 종류', '스킬·패시브 이름', '쿨다운(초)', '설명'];
const groups = ROSTER.map(character => ({ ...character, rows: [] }));
const others = { id: null, faction: '기타', rows: [] };
// 테스트 화면(rig_test.html)의 캐릭터별 파츠·스킬 목록: 슬롯 순서는 팔 → 몸통 → 머리 → 다리 (스킬 1 → 2 → 필살기 → 패시브)
const catalog = Object.fromEntries(ROSTER.map(character => [character.id, []]));
const catalogSlots = ['arm', 'body', 'head', 'leg'];
for (const [slot, label, kind] of slots) {
    for (const part of PARTS_DB[slot] || []) {
        if (part.id === 'none') continue;
        const group = groups.find(character => character.id === characterOfPart(part)) || others;
        const skill = slot === 'leg' ? passives.get(part.id) : skills.get(partSkills.get(part.id));
        const stats = part.stats || {};
        group.rows.push([
            label, part.name, part.id, partSetLabel(part), part.cost ?? '',
            stats.hp ?? '', stats.dps ?? '', stats.range ?? '', stats.speed ?? '',
            slot === 'arm' ? part.attackType ?? '' : '', kind,
            skill?.name ?? '', skill?.cd ?? '', skill?.desc ?? part.skillDesc ?? ''
        ]);
        const character = characterOfPart(part);
        if (catalog[character] && !sets2Ids.has(part.id)) catalog[character].push({
            slot, id: part.id, name: part.name, set: partSetLabel(part), variant: part.rigVariant || null,
            upgrade: !!part.rigUpgrade, attackType: slot === 'arm' ? part.attackType || 'melee' : null,
            skill: slot === 'leg' ? part.id : partSkills.get(part.id) || null, kind,
            skillName: skill?.name ?? '', cd: skill?.cd ?? '', desc: skill?.desc ?? part.skillDesc ?? ''
        });
    }
}
for (const list of Object.values(catalog)) list.sort((a, b) => catalogSlots.indexOf(a.slot) - catalogSlots.indexOf(b.slot));
if (others.rows.length) groups.push(others);

function markdownCell(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>');
}

function markdownRow(row) {
    return `| ${row.map(markdownCell).join(' | ')} |`;
}

function csvRow(row) {
    return row.map(value => {
        const text = String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',');
}

const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const markdown = [
    '# 파츠 스펙 표', '',
    '게임 데이터에서 자동 생성 — 직접 고치지 말고 `node tools/data/export_parts.mjs MD`로 다시 만든다', '',
    `만든 날짜: ${date}`, ''
];
const csv = [csvRow(['캐릭터', ...columns])];
for (const group of groups) {
    markdown.push(`## ${group.faction}`, '', markdownRow(columns), markdownRow(columns.map(() => '---')),
        ...group.rows.map(markdownRow), '');
    csv.push(...group.rows.map(row => csvRow([group.faction, ...row])));
}

const outputDir = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('./_out/', import.meta.url));
await mkdir(outputDir, { recursive: true });
const markdownPath = resolve(outputDir, '파츠_스펙표.md');
const csvPath = resolve(outputDir, '파츠_스펙표.csv');
await writeFile(markdownPath, markdown.join('\n') + '\n', 'utf8');
await writeFile(csvPath, '\uFEFF' + csv.join('\r\n') + '\r\n', 'utf8');
// 테스트 화면용 데이터 (파츠 표와 같이 다시 만든다)
const gen = fileURLToPath(new URL('../../js/rig_test/partSkills.gen.js', import.meta.url));
await writeFile(gen, [
    '// 자동 생성: node tools/data/export_parts.mjs (손으로 고치지 말 것) — rig_test.html 캐릭터별 파츠·스킬 목록',
    '// skill = skills_v2.js의 스킬 키 (다리는 파츠 id = 패시브 키), variant = 세트 그림(a·b·dragon), upgrade = 새 캐릭터 강화 그림',
    `export const PART_CATALOG = ${JSON.stringify(Object.fromEntries(Object.entries(catalog).filter(([, list]) => list.length)), null, 1)};`, ''
].join('\n'), 'utf8');
console.log(gen);
for (const group of groups) console.log(`${group.faction}: ${group.rows.length}개`);
console.log(markdownPath);
console.log(csvPath);
