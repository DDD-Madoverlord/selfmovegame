"""특성 트리 (D-119 3번 안 B · D-125, Q-038 임시): 캐릭터마다 3단 × 2갈래, 단을 별 4 · 8 · 12로 열고 갈래는 무료로 바꿈.
- 10명 × 24별 = 240 (별 배분 STAR_BUDGET.planned.traits)
- 합류한 캐릭터만, 출격 캐릭터(몸통 파츠)의 특성만 켜짐
- 장비 옵션 키(보스·엘리트·공성 피해 · 쿨다운 · 속도)는 gear에 더하고, 주는 피해 · 받는 피해 · 최대 내구도 · 필살기 충전은 따로
- 작전 지원 '특성' 탭, 저장·백업 검사"""

PACK = """const backup = await import('/js/engine_v2/saveStore_v2.js');
const pack = value => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
const save = JSON.parse(entries.mo_v2_save);"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("""const T = await import('/js/engine_v2/traits_v2.js'); const G = await import('/js/engine_v2/growth_v2.js');
        const chars = Object.keys(T.TRAITS);
        const shape = chars.every(c => T.TRAITS[c].length === 3 && T.TRAITS[c].every(p => p.length === 2));
        const keys = chars.every(c => T.TRAITS[c].flat().every(t => Object.keys(t.fx).every(k => T.GEAR_KEYS.includes(k) || T.MOD_KEYS.includes(k))));
        const sum = chars.length * T.TRAIT_TIER_STARS.reduce((a, c) => a + c, 0);
        return { n: chars.length, shape, keys, sum, planned: G.STAR_BUDGET.planned.traits, sig: Object.keys(T.SIGNATURE_TEXT).length };""")
    ctx.check(st['n'] == 10 and st['shape'] and st['keys'] and st['sig'] == 10, '10명 × 3단 × 2갈래, 효과 키는 전투가 아는 것만', str(st))
    ctx.check(st['sum'] == 240 and st['planned'] == 240, '단 열기 별 4 · 8 · 12 → 10명 240개 = 별 배분 특성 몫', str(st))

    # ===== 열기 · 고르기 =====
    st = g.js("""progress.totalStars = () => 999; const s0 = progress.spentStars;
        const r1 = progress.openTraitTier('mech'); const c1 = progress.spentStars - s0;
        const r2 = progress.openTraitTier('mech'), r3 = progress.openTraitTier('mech'), r4 = progress.openTraitTier('mech');
        const spent = progress.spentStars - s0;
        const p1 = progress.pickTrait('mech', 1, 1), bad = progress.pickTrait('mech', 3, 0), bad2 = progress.pickTrait('mech', 0, 2);
        const locked = progress.openTraitTier('saint');
        const fx = progress.traitEffects('mech');
        return { r1: r1.success, c1, r4: r4.success, r4why: r4.reason, spent, picks: progress.traitPicks('mech'), p1, bad, bad2,
            locked: locked.success, lockWhy: locked.reason, fx, used: progress.traitStarsSpent() };""")
    ctx.check(st['r1'] and st['c1'] == 4 and st['spent'] == 24 and not st['r4'] and st['used'] == 24,
              '1단 ★4 → 2단 ★8 → 3단 ★12 (모두 24), 4번째는 막힘', str(st))
    ctx.check(st['picks'] == [0, 1, 0] and st['p1'] and not st['bad'] and not st['bad2'] and not st['locked'] and '합류' in (st['lockWhy'] or ''),
              '연 단은 갈래를 무료로 바꿈(안 연 단·없는 갈래는 안 됨) · 합류 전 캐릭터는 못 엶', str(st))
    ctx.check(abs(st['fx']['gear'].get('bossDmg', 0) - 0.12) < 1e-9 and abs(st['fx']['gear'].get('speed', 0) - 0.1) < 1e-9 and abs(st['fx']['mods']['dmg'] - 0.1) < 1e-9,
              '거대로봇 [집중 포격 · 부스터 다리 · 과부하 포신] = 보스 피해 +12% · 속도 +10% · 주는 피해 +10%', str(st['fx']))

    # ===== 전투 =====
    base = g.js("progress.traits.mech = []; return null;")
    g.battle('mech')
    base = g.js("return { hp: b.maxPlayerHp, cdr: b.gear.cdr || 0, ult: b.kitUltRate() };")
    g.js("b.stopBattle(); progress.traits.mech = [1, 0, 1]; window.madOverlordGameV2.switchScreen('menu');")   # 장갑 보강 · 냉각 회로 · 예비 동력
    g.wait(300)
    g.battle()
    st = g.js("""const r = { hp: b.maxPlayerHp, cur: b.playerHp, cdr: b.gear.cdr || 0, mods: b.treeMods };
        const inc = b.sigIncomingMul(); const keep = b.treeMods; b.treeMods = { ...keep, taken: 0 }; r.takenRatio = inc / b.sigIncomingMul();
        b.treeMods = { ...keep, dmg: 0.1 }; const e = { hp: 100 }; r.dmgRatio = b.sigTargetMul(e) / b.sigCharMul(e);
        b.treeMods = { ...keep, ult: 0.2 }; r.ult = b.kitUltRate(); b.treeMods = keep;
        return r;""")
    ctx.check(abs(st['hp'] - round(base['hp'] * 1.15)) <= 1 and st['cur'] == st['hp'] and abs(st['cdr'] - base['cdr'] - 0.1) < 1e-9,
              '출격: 최대 내구도 +15%(가득 찬 채 시작) · 스킬 쿨다운 −10%가 장비 옵션 합계에 더해짐', f"{base} → {st}")
    ctx.check(abs(st['takenRatio'] - 0.92) < 1e-9 and abs(st['dmgRatio'] - 1.1) < 1e-9 and abs(st['ult'] - base['ult'] - 0.2) < 1e-9,
              '받는 피해 −8% · 주는 피해 +10% · 필살기 충전 +20%가 전투 배율에 붙음', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    # 다른 캐릭터 몸통으로 나가면 거대로봇 특성은 꺼짐
    g.battle('kaiju')
    st = g.js("return { ch: b.growthCharacter, mods: b.treeMods };")
    ctx.check(st['ch'] == 'kaiju' and all(v == 0 for v in st['mods'].values()), '거대괴수 몸통으로 출격하면 거대로봇 특성은 안 켜짐', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # ===== 저장 · 불러오기 · 백업 =====
    g.js("progress.save();")
    g.reload_v2()
    st = g.js("""const kept = progress.traitPicks('mech');
        progress.loadGrowth({ ...progress.growthData(), traits: { mech: [1, 5, 1, 1], nobody: [1], kaiju: 'x' } });
        return { kept, clean: progress.traits };""")
    ctx.check(st['kept'] == [1, 0, 1] and st['clean'] == {'mech': [1, 0, 1]}, '다시 켜도 고른 특성이 남음 · 이상한 값은 정리(3단까지 · 0/1 · 없는 캐릭터 버림)', str(st))
    st = g.js(PACK + """const kept = save.traits; save.traits = { mech: [2] };
        const bad = backup.importSave(pack({ entries: { ...entries, mo_v2_save: JSON.stringify(save) } }));
        return { kept, bad: bad.success, msg: bad.reason || '' };""")
    ctx.check(st['kept'] == {'mech': [1, 0, 1]} and not st['bad'] and '특성' in st['msg'], '저장 백업: 특성 트리가 들어 있음 · 모양이 틀리면 거절', str(st))

    # ===== 작전 지원 '특성' 탭 =====
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.totalStars = () => 30; progress.character = 'mech'; const gu = await import('/js/ui_v2/growthUi_v2.js'); gu.openGrowthPanel('traits');")
    g.wait(400)
    st = g.js("""const p = document.querySelector('.v2-growth');
        return { chips: p.querySelectorAll('.v2-traitchars button').length, tiers: p.querySelectorAll('.v2-traittier').length,
            open: p.querySelector('[data-act=openTrait]')?.textContent || '', sig: p.querySelector('.v2-traitsig')?.textContent || '',
            locked: p.querySelectorAll('.v2-trait.is-locked').length, on: p.querySelector('.v2-growth__tabs .is-on')?.dataset.tab };""")
    ctx.check(st['chips'] == 10 and st['tiers'] == 3 and '★4로 1단 열기' in st['open'] and '전환 장갑' in st['sig'] and st['locked'] == 6 and st['on'] == 'traits',
              "작전 지원 '특성' 탭: 캐릭터 10명 · 고유 특성 · 3단(모두 잠김) · '★4로 1단 열기'", str(st))
    g.page.click('.v2-growth [data-act=openTrait]')
    g.wait(300)
    g.page.click('.v2-growth [data-act=pickTrait][data-tier="0"][data-branch="1"]')
    g.wait(300)
    st = g.js("""const p = document.querySelector('.v2-growth');
        return { picks: progress.traitPicks('mech'), on: p.querySelector('.v2-trait.is-on b')?.textContent || '', next: p.querySelector('[data-act=openTrait]')?.textContent || '',
            avail: progress.availableStars() };""")
    ctx.check(st['picks'] == [1] and st['on'] == '장갑 보강' and '★8로 2단 열기' in st['next'] and st['avail'] == 26,
              '1단을 열고 오른쪽 갈래(장갑 보강)로 바꿈 → 다음은 ★8로 2단', str(st))
    g.js("""const p = document.querySelector('.v2-growth'); p.querySelector('[data-act=traitChar][data-char="saint"]').click();""")
    g.wait(300)
    st = g.js("""const p = document.querySelector('.v2-growth');
        return { lock: p.querySelector('.v2-traitbox__lock')?.textContent || '', dis: p.querySelector('[data-act=openTrait]')?.disabled };""")
    ctx.check('구역 6' in st['lock'] and st['dis'], '합류 전 캐릭터(봉합 성녀)는 안내 + 열기 단추 잠김', str(st))
    g.js("""const p = document.querySelector('.v2-growth'); p.querySelector('[data-act=traitChar][data-char="mech"]').click();""")
    g.wait(300)
    g.shot('traits_tab', '.v2-growth')
