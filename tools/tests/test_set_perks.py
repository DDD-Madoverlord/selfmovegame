"""전투 밖 세트 효과 (2026-11-03, sets_v2.js SET_PERKS — 세트·수치 임시 Q-018):
포격 사령부 2부위 = 협력 출격 시간 +3초 · 조직 사령관 2부위 = 협력 대기 −5초 · 그림자 마도사 2부위 = 그 캐릭터 파견 보상 +20%,
연구소 세트 효과 칸·세트 탭 표시"""

OWN = """const { SLOTS, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
const own = c => { if (!progress.unlockedChars.includes(c)) progress.unlockedChars.push(c); SLOTS.forEach(s => partsOfCharacter(c, s).forEach(p => progress.owned.add(p.id))); };"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # 협력 대기: 주인공(합성괴인)이 조직 사령관 2부위를 끼우면 −5초
    st = g.js(OWN + """
        own('chimera'); own('mech');
        progress.selectCharacter('chimera');
        const base = progress.supportCooldown();
        gameState.equippedParts = { ...gameState.equippedParts, head: 'head_chimera_b', body: 'body_chimera_b' };
        const two = progress.supportCooldown();
        gameState.equippedParts = { ...gameState.equippedParts, head: 'head_chimera_b', body: 'body_chimera' };
        const one = progress.supportCooldown();
        return { base, two, one };""")
    ctx.check(st['two'] == st['base'] - 5 and st['one'] == st['base'], '조직 사령관 2부위: 협력 대기 −5초 (1부위는 그대로)', str(st))

    # 협력 시간: 주인공(거대로봇)이 포격 사령부 2부위 → 협력 스냅숏 +3초, 전투에서 협력이 13초 머묾
    st = g.js(OWN + """
        progress.selectCharacter('mech');
        gameState.equippedParts = { ...gameState.equippedParts, head: 'head_mech_a', arm: 'arm_mech_a' };
        progress.selectSupport('chimera');
        const snap = progress.supportSnapshot('mech');
        return { extra: snap && snap.extraTime, support: progress.supportCharacter };""")
    ctx.check(st['extra'] == 3 and st['support'] == 'chimera', '포격 사령부 2부위: 협력 출격 시간 +3초 (스냅숏)', str(st))
    g.js("progress.selectStage('1-1'); window.madOverlordGameV2.switchScreen('battle');")
    g.wait(3500)
    st = g.js("""b.support.cooldown = 0;
        b.spawnInterval = 999; const e = b.spawnMinion(); e.x = b.monsterX + 260; e.hp = e.maxHp = 99999; e.speed = 0; e.dom.style.left = e.x + 'px';
        const called = b.callSupport();
        const a = b.support.active;
        return { called, duration: a && a.duration, exitAt: a && a.exitAt };""")
    ctx.check(st['called'] and st['duration'] == 13 and abs(st['exitAt'] - 12.5) < 1e-6, '전투: 협력이 13초 머물고 12.5초에 퇴장 시작', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # 파견 보상: 그림자 마도사 2부위를 낀 타락 히어로를 파견 → 보상 ×1.2
    st = g.js(OWN + """
        own('hero');
        const { STAGES } = await import('/js/engine_v2/stages_v2.js');
        STAGES.filter(s => s.zone === 1).forEach(s => progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 });
        const { DISPATCH } = await import('/js/engine_v2/growth_v2.js');
        const send = loadout => {
            progress.loadouts.hero = loadout;
            progress.dispatch = [];
            const ok = progress.startDispatch('hero', 1, 0).success;
            const r = progress.collectDispatch(0, 1e15, () => 0.99);
            return { ok, dm: r.dm, shards: r.shards, loot: r.loot };
        };
        const plain = send({ head: 'head_hero', body: 'body_hero', arm: 'arm_hero_wave', leg: 'leg_hero_hover' });
        const boosted = send({ head: 'head_hero_b', body: 'body_hero_b', arm: 'arm_hero_wave', leg: 'leg_hero_hover' });
        return { plain, boosted, base: DISPATCH.reward(1).dm };""")
    ctx.check(st['plain']['ok'] and st['boosted']['ok'] and st['plain']['dm'] == st['base'] and st['boosted']['dm'] == round(st['base'] * 1.2)
              and abs(st['boosted']['loot'] - 0.2) < 1e-9,
              '그림자 마도사 2부위를 낀 캐릭터 파견: 보상 DM ×1.2', str(st))

    # 연구소: 세트 효과 칸과 세트 탭에 전투 밖 효과 줄
    g.js("progress.selectCharacter('mech'); gameState.cartParts = { ...gameState.equippedParts, head: 'head_mech_a', arm: 'arm_mech_a' };"
         "window.madOverlordGameV2.switchScreen('lab');")
    g.wait(800)
    hidden_on_part = g.js("const box = document.getElementById('lab-setbonus-v2'); return !!box && box.getClientRects().length === 0;")
    ctx.check(hidden_on_part, '연구소 부위 탭(머리): 스킬 칸의 세트 효과 줄 숨김 (11-05 피드백 5)')
    g.page.click('.v2-slottab[data-slot="set"]')
    g.wait(300)
    st = g.js("""const box = document.getElementById('lab-setbonus-v2');
        return { panel: box && box.getClientRects().length ? box.innerText : '' };""")
    st['tab'] = g.js("""const row = [...document.querySelectorAll('.v2-setrow')].find(r => r.textContent.includes('포격 사령부'));
        return row ? row.querySelector('.v2-setrow__bonus').innerText : '';""")
    ctx.check('협력 출격 시간 +3초' in st['panel'] and '2부위' in st['tab'] and '협력 출격 시간 +3초' in st['tab'],
              '연구소: 세트 효과 칸·세트 탭에 "협력 출격 시간 +3초" 표시', str(st))
    g.shot('set_perks_tab', '.v2-lab__parts')
