"""파츠 성장 안 C (D-119 5번 · D-124, Q-041 임시): 등급이 강화 한도 + 강화비 레벨^1.6 + 등급 올리기 = 지금 등급 한도까지 강화 + 조각 + DM + 승급석.
- 등급 한도 커먼 Lv5 · 레어 7 · 유니크 9 · 레전더리 14, 열린 난이도 한도(+숨김 그룹)와 작은 쪽
- 승급석은 스페셜맵 보스 러시 보상 (D-123), 연구소 등급 단추에 조각·승급석 표시
- 예전 저장에서 이미 한도보다 높은 레벨은 깎지 않음 (더 못 올릴 뿐)"""

ID = 'arm_red_robot'


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(f"""const G = await import('/js/engine_v2/growth_v2.js');
        const out = {{ caps: G.GRADES.map(x => x.maxLevel), exp: G.UP_EXP }};
        const S = await import('/js/engine_v2/stages_v2.js');
        // 노말만 열림(계정 한도 5): 커먼·유니크 모두 5
        progress.grades['{ID}'] = 'common'; out.n_common = progress.partMaxLevel('{ID}');
        progress.grades['{ID}'] = 'unique'; out.n_unique = progress.partMaxLevel('{ID}');
        // 나이트메어까지 + 숨김 그룹 둘 (계정 한도 14): 등급 한도가 정함
        for (const d of ['normal', 'hard', 'hell']) S.STAGES.forEach(s => progress.recordsOf(d)[s.id] = {{ stars: [true, true, true], cleared: true, bestTime: 60 }});
        out.account = progress.maxLevel();
        out.byGrade = ['common', 'rare', 'unique', 'legendary'].map(gr => {{ progress.grades['{ID}'] = gr; return progress.partMaxLevel('{ID}'); }});
        progress.grades['{ID}'] = 'common';
        return out;""")
    ctx.check(st['caps'] == [5, 7, 9, 14] and st['exp'] == 1.6, '등급 한도 커먼 5 · 레어 7 · 유니크 9 · 레전더리 14, 강화비 레벨^1.6', str(st))
    ctx.check(st['n_common'] == 5 and st['n_unique'] == 5 and st['account'] == 14 and st['byGrade'] == [5, 7, 9, 14],
              '파츠 강화 한도 = 계정 한도(노말 5 … 나이트메어 10 + 숨김 그룹 4)와 등급 한도 중 작은 쪽', str(st))

    st = g.js(f"""const lv = n => {{ progress.levels['{ID}'] = n; return progress.upgradeCost('{ID}'); }};
        const c1 = lv(1), c4 = lv(4), at5 = lv(5);
        progress.levels['{ID}'] = 1;
        return {{ c1, c4, at5, ratio: c4 / c1 }};""")
    ctx.check(st['at5'] is None and abs(st['ratio'] - 4 ** 1.6) < 0.2, f"강화비 곡선: Lv4 비용 = Lv1의 4^1.6 ≈ {4 ** 1.6:.1f}배 · 커먼 Lv5면 더 못 올림", str(st))

    st = g.js(f"""progress.shards = 100; progress.stones = 0; gameState.darkMatter = 1000000; progress.levels['{ID}'] = 3;
        const c = progress.shardUpgradeCost('{ID}');
        const lowLv = progress.upgradeGradeWithShards('{ID}');
        progress.levels['{ID}'] = 5;
        const noStone = progress.upgradeGradeWithShards('{ID}');
        progress.stones = 10;
        const ok = progress.upgradeGradeWithShards('{ID}');
        return {{ c, lowLv: lowLv.reason, noStone: noStone.reason, ok: ok.success, grade: progress.gradeOf('{ID}'), stones: progress.stones, shards: progress.shards,
            dm: 1000000 - gameState.darkMatter, cap: progress.partMaxLevel('{ID}'), next: progress.upgradeCost('{ID}') }};""")
    ctx.check(st['c'] == {'grade': 'rare', 'shards': 15, 'dm': 20000, 'stones': 6, 'needLevel': 5} and 'Lv5' in st['lowLv'] and '승급석' in st['noStone'],
              '레어로: Lv5까지 강화 + 조각 15 · DM 2만 · 승급석 6 — 레벨이 모자라거나 승급석이 없으면 막힘(보스 러시 안내)', str(st))
    ctx.check(st['ok'] and st['grade'] == 'rare' and st['stones'] == 4 and st['shards'] == 85 and st['dm'] == 20000 and st['cap'] == 7 and st['next'] is not None,
              '레어가 되면 재료가 빠지고 강화 한도 Lv7 — 다시 강화할 수 있음', str(st))

    # 예전 저장: 커먼인데 Lv9 → 그대로 두고 더 못 올림
    st = g.js(f"""progress.grades['arm_mech_laser'] = 'common'; progress.owned.add('arm_mech_laser'); progress.levels['arm_mech_laser'] = 9; progress.save();
        return true;""")
    g.reload_v2()
    st = g.js("return { lv: progress.levelOf('arm_mech_laser'), cost: progress.upgradeCost('arm_mech_laser') };")
    ctx.check(st['lv'] == 9 and st['cost'] is None, '예전 저장의 한도보다 높은 레벨(커먼 Lv9)은 깎지 않고 더 못 올릴 뿐', str(st))

    # 연구소 등급 단추: 조각·승급석 표시, 승급석 칩
    g.js(f"""progress.stones = 3; progress.shards = 20; progress.levels['{ID}'] = 7; progress.grades['{ID}'] = 'rare';
        gameState.equippedParts.arm = '{ID}'; gameState.resetCartToEquipped(); window.madOverlordGameV2.switchScreen('lab');""")
    g.wait(500)
    g.js("document.querySelector('.v2-slottab[data-slot=\"arm\"]')?.click();")
    g.wait(400)
    st = g.js("""return { cost: document.getElementById('lab-grade-cost-v2').textContent, title: document.getElementById('btn-grade-v2').title,
        disabled: document.getElementById('btn-grade-v2').disabled, chip: [...document.querySelectorAll('.v2-chip--res span')].map(s => s.getAttribute('aria-label')).join(' | '),
        pips: document.querySelectorAll('#lab-upg-pips-v2 i').length };""")
    ctx.check('◆20' in st['cost'] and '/3' in st['cost'] and st['disabled'] and '승급석 20' in st['title'] and '승급석 3' in st['chip'] and st['pips'] == 7,
              '연구소: 유니크로 올리는 데 승급석 20 (보유 3, 모자라 잠김) · 재화 칩 승급석 · 레어 강화 칸 7개', str(st))
    g.shot('parts_growth_lab', '#screen-lab-v2')
