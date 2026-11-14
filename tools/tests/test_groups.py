"""숨김 캐릭터 2명씩 공개 · 그룹별 스테이지 세기 · 캐릭터 자동 합류 · 별 배분 · 캐릭터 외형 (D-119 ① 단계 — 기획서 8·10·11번).
- 그룹 2(구역 7~8 · 인형사 · 무희), 그룹 3(구역 9~10 · 설계자 · 방송자)은 날짜가 없으면 숨김, 같은 날 캐릭터와 구역을 같이 공개
- 그룹 첫 판 노말 = 지금 헬 수치(7-1 ≈ 헬 6-1), 그 위 난이도 배율은 줄임, 하드는 그룹마다 마지막 판으로 열림, 강화 한도 그룹마다 +2
- 구역 n의 n-1이 열리면 그 구역 캐릭터 합류(별 안 씀, 예전에 쓴 별은 돌려줌), 외형은 별 25개
다른 검사는 common.py가 ?openGroups=1로 숨김을 열고 돌림 — 여기서만 숨김을 켜고 확인."""
import time

PACK = """const backup = await import('/js/engine_v2/saveStore_v2.js');
const pack = value => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
const save = JSON.parse(entries.mo_v2_save);"""
CS = "const C = await import('/js/engine_v2/contentSchedule_v2.js');"
ST = "const S = await import('/js/engine_v2/stages_v2.js'); const D = await import('/js/engine_v2/difficulty_v2.js');"
REC = "{ stars: [true, true, true], cleared: true, bestTime: 100 }"


def clear_normal_until(stop_id):
    """노말 기록을 첫 판부터 stop_id까지 깬 것으로 (JS 조각)"""
    return f"""for (const s of S.STAGES) {{ progress.stages[s.id] = {REC}; if (s.id === '{stop_id}') break; }}"""


def run(ctx):
    # ===== 1. 숨김 (openGroups 없이 연 화면) =====
    g = ctx.game(fresh=True)
    g.page.goto(f'{g.base}/index.html?t={time.time()}')
    g.enter_v2()
    st = g.js(CS + """return { zones: [1, 6, 7, 8, 9, 10].map(z => C.isZoneReleased(z)),
        chars: ['saint', 'doll', 'frost', 'architect', 'broadcaster'].map(c => C.isCharacterReleased(c)),
        label: C.releaseLabelOf('characters', 'doll'), zlabel: C.releaseLabelOf('zones', 7) };""")
    ctx.check(st['zones'] == [True, True, False, False, False, False] and st['chars'] == [True, False, False, False, False],
              '날짜 없는 숨김 그룹: 구역 7~10 · 인형사·무희·설계자·방송자 숨김, 구역 1~6 · 성녀까지 공개', str(st))
    ctx.check(st['label'] == '곧 공개' and st['zlabel'] == '곧 공개', "날짜 없으면 '곧 공개'만 (예전엔 '곧 공개 · null')", str(st))
    g.js("window.madOverlordGameV2.switchScreen('select');")
    g.wait(500)
    st = g.js("""const c = document.querySelector('.v2-charcard[data-char="doll"]'), s = document.querySelector('.v2-charcard[data-char="saint"]');
        return { secret: c.classList.contains('is-secret'), name: c.querySelector('h2').textContent, foot: c.querySelector('.v2-charcard__foot').textContent,
            filter: getComputedStyle(c.querySelector('canvas')).filter, saint: s.classList.contains('is-secret') };""")
    ctx.check(st['secret'] and st['name'] == '???' and '곧 공개' in st['foot'] and 'brightness(0)' in st['filter'] and not st['saint'],
              '선택창: 숨김 캐릭터는 검은 실루엣 · 이름 ??? · 곧 공개', str(st))
    g.shot('groups_select_secret', '#screen-select-v2')
    st = g.js(CS + """C.setReleaseGroups([{ id: 2, zones: [7, 8], characters: ['doll', 'frost'], date: '2000-01-01' },
            { id: 3, zones: [9, 10], characters: ['architect', 'broadcaster'], date: '2999-01-01' }]);
        const r = { z: [7, 8, 9, 10].map(z => C.isZoneReleased(z)), c: ['doll', 'frost', 'architect', 'broadcaster'].map(c => C.isCharacterReleased(c)),
            label: C.releaseLabelOf('characters', 'architect') };
        C.setReleaseGroups(null); return r;""")
    ctx.check(st['z'] == [True, True, False, False] and st['c'] == [True, True, False, False] and st['label'] == '곧 공개 · 1월 1일',
              '그룹 2 날짜가 지나면 인형사·무희와 구역 7·8이 같이 공개, 그룹 3은 날짜까지 숨김', str(st))
    st = g.js(CS + "progress.unlockEverythingTemp(); return [C.isZoneReleased(9), C.isCharacterReleased('broadcaster')];")
    ctx.check(st == [True, True], '시험용 전체 해제(메뉴 아이콘 2단계)는 숨김 그룹도 이번 실행 동안 공개', str(st))

    # ===== 2. 그룹 세기 · 난이도 (숨김을 연 보통 검사 화면) =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(ST + """const s61h = D.stageFor(S.stageById('6-1'), 'hell'), s71 = S.stageById('7-1'), s91 = S.stageById('9-1'), s61 = S.stageById('6-1');
        return { g: [s61.group, s71.group, S.stageById('8-B').group, s91.group], h71: s71.enemy.hp, hh61: s61h.enemy.hp, d71: s71.enemy.dps, dh61: s61h.enemy.dps,
            b71: s71.base.final, bh61: s61h.base.final, h91: s91.enemy.hp, h61: s61.enemy.hp,
            r71: s71.reward.final, nm71: D.stageFor(s71, 'nightmare').enemy.hp, hd71: D.stageFor(s71, 'hard').enemy.hp, nm61: D.stageFor(s61, 'nightmare').enemy.hp };""")
    near = lambda a, b, tol: abs(a - b) <= tol * b
    ctx.check(st['g'] == [1, 2, 2, 3] and near(st['h71'], st['hh61'], 0.01) and near(st['d71'], st['dh61'], 0.03) and near(st['b71'], st['bh61'], 0.05),
              '노말 7-1 = 지금 헬 6-1 (적 체력·공격력·거점 체력)', str(st))
    ctx.check(abs(st['h91'] - 10.07) < 0.03 and st['h61'] == 3.9 and st['r71'] > 11800,
              '노말 9-1 = 지금 헬 8-1(적 체력 ×10.07) · 구역 1~6은 그대로 · 그룹 보상 ↑', str(st))
    ctx.check(near(st['hd71'], st['h71'] * 1.25, 0.01) and near(st['nm71'], st['h71'] * 1.8, 0.01) and near(st['nm61'], 3.9 * 2.5, 0.01),
              '그룹 2·3 난이도 배율은 줄임: 하드 ×1.25 · 나이트메어 ×1.8 (그룹 1은 ×2.5 그대로)', str(st))

    st = g.js(ST + f"""const out = {{}};
        out.fresh = D.difficultyUnlocked('hard', progress);
        {clear_normal_until('4-B')} out.at4B = D.difficultyUnlocked('hard', progress);
        progress.diffStages.hard = {{ '1-1': {REC} }}; out.legacy = D.difficultyUnlocked('hard', progress); delete progress.diffStages.hard;
        {clear_normal_until('6-B')} out.at6B = D.difficultyUnlocked('hard', progress); out.lv = progress.maxLevel();
        progress.difficulty = 'hard';
        for (const s of S.STAGES) {{ progress.recordsOf('hard')[s.id] = {REC}; if (s.id === '6-B') break; }}
        out.h71Locked = S.isUnlocked('7-1', progress);
        {clear_normal_until('8-B')} out.h71Open = S.isUnlocked('7-1', progress); out.h11 = S.isUnlocked('1-1', progress);
        progress.difficulty = 'normal';
        return out;""")
    ctx.check(not st['fresh'] and not st['at4B'] and st['legacy'] and st['at6B'],
              '하드는 6-B(그룹 1 마지막 판)를 깨야 열림 — 4-B로는 안 열림, 예전에 하드를 해 본 저장은 그대로 열림', str(st))
    ctx.check(st['lv'] == 9, '강화 한도: 하드 Lv7 + 그룹 2 첫 판(7-1)이 열려 +2 = Lv9', str(st))
    ctx.check(not st['h71Locked'] and st['h71Open'] and st['h11'],
              '하드 7-1: 하드 6-B를 깨도 노말 8-B(그룹 2 마지막 판)를 깨기 전엔 잠김 → 깨면 열림', str(st))

    # ===== 3. 캐릭터 자동 합류 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(ST + f"""const before = progress.isCharacterUnlocked('kaiju'), spent = progress.spentStars;
        {clear_normal_until('1-10')}
        const r = progress.recordStage('1-B', {{ stars: [true, true, true], cleared: true, time: 100 }}, 'normal');
        const {{ readAnalyticsLog }} = await import('/js/engine_v2/analytics_v2.js');
        const ev = readAnalyticsLog().filter(e => e.name === 'character_unlock' || e.event === 'character_unlock');
        return {{ before, chars: r.chars, after: progress.isCharacterUnlocked('kaiju'), hero: progress.isCharacterUnlocked('hero'),
            stars: progress.spentStars - spent, saved: progress.unlockedChars.includes('kaiju'), ev: ev.length,
            reason: progress.unlockCharacter('hero').reason }};""")
    ctx.check(not st['before'] and st['chars'] == ['kaiju'] and st['after'] and not st['hero'] and st['stars'] == 0 and st['saved'],
              '1-B 노말을 처음 깨면(2-1 열림) 거대괴수 합류 · 별 안 씀 · 타락 히어로는 아직', str(st))
    ctx.check(st['ev'] >= 1 and '구역 3에 도착하면' in st['reason'], "통계 character_unlock · 잠긴 캐릭터 안내 '구역 3에 도착하면 합류'", str(st))
    g.js("window.madOverlordGameV2.switchScreen('select');")
    g.wait(400)
    foot = g.js("return document.querySelector('.v2-charcard[data-char=\"hero\"] .v2-charcard__foot').textContent;")
    ctx.check('구역 3 도착 시 합류' in foot and '★' not in foot, "선택창 잠긴 카드: '구역 3 도착 시 합류' (별 값 없음)", foot)
    # 결과 화면 '합류' 줄: 2-B를 실제로 이겨서 (타락 히어로)
    g.js(ST + clear_normal_until('2-10') + " progress.selectStage('2-B'); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.battle('mech', wait_ms=1500)
    g.js("b.finishBattle(true);")
    g.wait(1500)
    st = g.js("const el = document.querySelector('.v2-result__join'); return { text: el ? el.textContent : '', unlocked: progress.isCharacterUnlocked('hero') };")
    ctx.check('타락 히어로' in st['text'] and '합류' in st['text'] and st['unlocked'], "결과 화면: '타락 히어로 합류!'", str(st))
    g.shot('groups_result_join', '#screen-battle-v2')

    # 예전 별 해금 저장: 쓴 별을 한 번 돌려줌
    st = g.js("""progress.loadGrowth({ unlockedChars: ['kaiju', 'hero'], spentStars: 20 });
        const once = progress.spentStars, flag = progress.charStarRefund;
        progress.loadGrowth({ unlockedChars: ['kaiju', 'hero'], spentStars: 20, charStarRefund: 1 });
        return { once, flag, twice: progress.spentStars };""")
    ctx.check(st['once'] == 8 and st['flag'] == 1 and st['twice'] == 20, '예전에 별로 연 캐릭터(거대괴수 6 + 히어로 6)의 별을 한 번만 돌려줌', str(st))

    # ===== 4. 외형 · 별 배분 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("""const G = await import('/js/engine_v2/growth_v2.js'); const R = await import('/js/engine_v2/rig/rigAvatar.js');
        progress.totalStars = () => 999;
        const spent = progress.spentStars, r = progress.buySkin('mech_crimson'), again = progress.buySkin('mech_crimson');
        const f = progress.skinFilterOf('mech'), cfg = R.rigConfigFor(gameState.getEquippedObjects(), 'mech');
        const wrong = progress.equipSkin('kaiju', 'mech_crimson');
        progress.equipSkin('mech', null);
        return { r: r.success, again: again.success, cost: progress.spentStars - spent, f, star: cfg.filters['*'], back: progress.skinFilterOf('mech'),
            wrong, count: Object.values(G.SKINS).flat().length, want: G.skinById('mech_crimson').filter };""")
    ctx.check(st['r'] and not st['again'] and st['cost'] == 25 and st['f'] == st['want'] and st['star'] == st['want'] and st['back'] is None and not st['wrong'],
              '외형: 별 25개로 사면 바로 입음 → 리그 그림 전체 색 필터, 기본으로 되돌림, 다른 캐릭터에는 못 입힘', str(st))
    ctx.check(st['count'] == 20, '외형 20종 (10명 × 2)', str(st['count']))
    g.js("progress.equipSkin('mech', 'mech_crimson'); const gu = await import('/js/ui_v2/growthUi_v2.js'); gu.openGrowthPanel('skins');")
    g.wait(400)
    st = g.js("""const p = document.querySelector('.v2-growth'); if (!p) return null;
        const tab = [...p.querySelectorAll('[data-act=tab]')].find(b => b.dataset.tab === 'skins'); if (tab) tab.click();
        return { rows: p.querySelectorAll('.v2-skinrow').length, on: p.querySelectorAll('.v2-skin.is-on').length,
            buy: [...p.querySelectorAll('[data-act=buySkin]')].length };""")
    ctx.check(st and st['rows'] == 10 and st['on'] == 10 and st['buy'] == 19, "작전 지원 '외형' 탭: 10명 줄 · 입는 중 표시 · 살 수 있는 외형 19개", str(st))
    if st:
        g.shot('groups_skins_tab', '.v2-growth')
    st = g.js(PACK + """const kept = save.skins;
        save.skins = { owned: 'x', equipped: {} };
        const bad = backup.importSave(pack({ entries: { ...entries, mo_v2_save: JSON.stringify(save) } }));
        return { kept, bad: bad.success, msg: bad.reason || '' };""")
    ctx.check(st['kept'] and st['kept']['equipped'].get('mech') == 'mech_crimson' and not st['bad'] and '외형' in st['msg'],
              '저장 백업: 입은 외형이 들어 있음 · 외형 모양이 틀리면 거절', str(st))

    st = g.js("""const G = await import('/js/engine_v2/growth_v2.js'); const S = await import('/js/engine_v2/stages_v2.js');
        const total = S.STAGES.length * 3 * 4, g1 = S.STAGES.filter(s => s.group === 1).length * 3;
        const sum = o => Object.values(o).reduce((n, v) => n + v, 0);
        const modules = sum(Object.fromEntries(Object.entries(G.MODULES).map(([k, m]) => [k, m.stars])));
        const research = Object.values(G.RESEARCH).reduce((n, r) => n + sum(r.stars), 0);
        const research1 = Object.values(G.RESEARCH).reduce((n, r) => n + r.stars[0], 0);
        const skins = Object.values(G.SKINS).flat().length * G.SKIN_STARS;
        return { total, g1, planned: sum(G.STAR_BUDGET.planned), reserve: G.STAR_BUDGET.reserve, modules, research, research1, skins, p: G.STAR_BUDGET.planned,
            chars: 'CHARACTER_STARS' in G };""")
    p = st['p']
    ctx.check(st['total'] == 1320 and st['planned'] + st['reserve'] == st['total'],
              '별 총량 1,320개(110판 × 3 × 난이도 4) = 용도별 몫 994 + 남겨 둘 몫 326', str(st))
    ctx.check(st['modules'] <= p['modules'] and st['research'] <= p['research'] and st['skins'] <= p['skins'] and not st['chars'],
              '실제 쓰임이 용도별 몫 안: 모듈 54 · 연구 159/200 · 외형 500 · 캐릭터 별 값 없음', str(st))
    ctx.check(st['modules'] + st['research1'] <= st['g1'],
              '그룹 1 노말 별(198)만으로 모듈 전부 + 연구 1단 전부를 살 수 있음', str(st))
