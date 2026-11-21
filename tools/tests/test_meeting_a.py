"""회의 후속 묶음 A (2026-11-21, D-154 · MD/회의후속_작업계획_20261121.md): 빠른 수정 모음 검사.
⑱ 필살기 컷인·HUD 초상화 = 지금 낀 머리 파츠 그림"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- ⑱ 얼굴 그림: 머리 파츠 전부 — 고른 그림 파일이 실제로 있고, 세트 머리는 기본 head.png가 아님 ----
    st = g.js("""const { headPortrait } = await import('/js/engine_v2/rig/rigAvatar.js');
        const { PARTS_DB } = await import('/js/data/parts.js');
        const { characterOfPart } = await import('/js/engine_v2/roster_v2.js');
        const heads = PARTS_DB.head.filter(p => p.id !== 'none' && characterOfPart(p));
        const rows = await Promise.all(heads.map(p => new Promise(done => {
            const c = characterOfPart(p), t = headPortrait(c, p), img = new Image();
            const row = { id: p.id, c, file: t.file, filter: t.filter, variant: p.rigVariant || null, up: !!p.rigUpgrade };
            img.onload = () => done({ ...row, ok: img.naturalWidth > 0 });
            img.onerror = () => done({ ...row, ok: false });
            img.src = `assets/sprites/rig/${c}/${t.file}`;
        })));
        const none = headPortrait('mech', null), other = headPortrait('mech', heads.find(p => characterOfPart(p) === 'kaiju'));
        return { n: rows.length, broken: rows.filter(r => !r.ok).map(r => r.id + ':' + r.file),
            plain: rows.filter(r => (r.variant || r.up) && r.file === 'head.png' && !r.filter).map(r => r.id),
            own: rows.filter(r => r.file !== 'head.png').length, none: none.file + '|' + none.filter, other: other.file + '|' + other.filter };""")
    ctx.check(st['n'] >= 80 and not st['broken'], f"얼굴 그림: 머리 파츠 {st['n']}개 모두 그림 파일이 있음", str(st['broken'][:6]))
    ctx.check(not st['plain'] and st['own'] >= 40, '얼굴 그림: 세트·강화 머리는 자기 그림(또는 세트 색) — 기본 그림 그대로가 아님', str((st['plain'][:6], st['own'])))
    ctx.check(st['none'] == 'head.png|null' and st['other'] == 'head.png|null', '얼굴 그림: 머리가 없거나 다른 캐릭터 머리면 기본 그림', str((st['none'], st['other'])))

    # 전투: 세트 머리를 끼면 HUD 초상화와 필살기 컷인이 그 그림
    g.battle(('head_mech_a', 'body_red_robot', 'arm_mech_missile', 'leg_red_robot'), wait_ms=2500)
    st = g.js("""const { headPortrait } = await import('/js/engine_v2/rig/rigAvatar.js');
        const { PARTS_DB } = await import('/js/data/parts.js');
        const want = headPortrait('mech', PARTS_DB.head.find(p => p.id === 'head_mech_a'));
        b.hud.onSkillUsed('head', { ult: true, name: '검사', icon: 'fist', color: '#ffb020', desc: '' });
        const face = document.querySelector('.v2-ultcut__face'), hud = document.getElementById('hud-portrait-v2');
        return { want, hud: hud.getAttribute('src'), hudFilter: hud.style.filter, face: face && face.getAttribute('src'), faceFilter: face ? face.style.filter : null,
            loaded: !!face && (face.complete ? face.naturalWidth > 0 : null) };""")
    ctx.check(st['want']['file'] != 'head.png' or st['want']['filter'], '세트 머리(레어 ① 머리)는 기본 그림과 다름', str(st['want']))
    ctx.check(st['hud'].endswith('/' + st['want']['file']) and st['face'] and st['face'].endswith('/' + st['want']['file']),
              '전투: HUD 초상화와 필살기 컷인 얼굴 = 지금 낀 머리 파츠 그림', str(st))
    ctx.check((not st['want']['filter']) or (st['want']['filter'] in st['faceFilter'] and 'drop-shadow' in st['faceFilter']),
              '컷인: 세트 색이 있으면 얼굴에 덧씌우고 테두리 빛은 그대로', str(st))
    g.js("b.hud.onSkillUsed('head', { ult: true, name: '검사', icon: 'fist', color: '#ffb020', desc: '' });")
    g.wait(450)
    g.shot('meeting_a_ultcut')
    g.wait(1500)

    # ---- ⑲ 기준 벽: 적이 주인공 뒤로 넘어가지 않음 (블랙홀이 주인공 뒤에서 끌어당기는 길로 재현) ----
    SCENE = """b.spawnInterval = 999;
        b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
        b.enemies = b.enemies.filter(e => e.isBuilding);
        const { spawnEnemy } = await import('/js/engine_v2/enemies_v2.js');
        const front = b.frontX();
        const es = [10, 40, 70].map(dx => { const e = spawnEnemy(b, 'conscript', { x: front + dx, elite: false }); e.speed = 0; e.dps = 0; e.hp = e.maxHp = 1e9; return e; });
        b.stats.lineHolds = 0;
        b.blackHole = { x: b.monsterX + 20, t: 2.2, fxT: Infinity };   // 바닥과 함께 주인공 몸 쪽으로 흘러온 블랙홀 (가운데가 앞면보다 80px 뒤)
        await new Promise(r => setTimeout(r, 1700));
        const out = { min: Math.min(...es.map(e => e.x - b.frontX())), holds: b.stats.lineHolds, shown: es.every(e => Math.abs(parseFloat(e.dom.style.left) - e.x) < 0.5) };
        b.blackHole = null;
        es.forEach(e => { e.dom && e.dom.remove(); });
        b.enemies = b.enemies.filter(e => !es.includes(e));
        return out;"""
    before = g.js("b.holdLine = () => {};" + SCENE)       # 벽을 끈 채: 예전 동작
    after = g.js("delete b.holdLine;" + SCENE)            # 벽을 켠 채
    ctx.check(before['min'] < -80, '재현(벽 없음): 주인공 뒤의 블랙홀이 적을 주인공 뒤쪽으로 끌고 감', str(before))
    ctx.check(after['min'] >= -40.5 and after['holds'] > 0 and after['shown'], '기준 벽: 적은 주인공 앞면보다 40px 넘게 뒤로 못 감 (화면 위치도 같이)', str(after))
    st = g.js("""const { spawnEnemy } = await import('/js/engine_v2/enemies_v2.js');
        const e = spawnEnemy(b, 'conscript', { x: b.frontX() - 300, elite: false }); e.speed = 0; e.dps = 0; e.hp = e.maxHp = 1e9;
        await new Promise(r => setTimeout(r, 200));
        const d = e.x - b.frontX();
        e.dom.remove(); b.enemies = b.enemies.filter(o => o !== e);
        return d;""")
    ctx.check(-40.5 <= st <= 30, '기준 벽: 어떤 길로든 뒤에 놓인 적(앞면 −300)은 다음 프레임에 벽 앞으로 (맞아서 조금 더 밀릴 수 있음)', str(st))
    # 주인공 쪽: 돌진·순간 이동은 화면 오른쪽 한도 · 거점 앞을 넘지 않음
    st = g.js("""const { LINE } = await import('/js/engine_v2/battle/tuning.js');
        b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
        b.enemies = b.enemies.filter(e => e.isBuilding);
        const free = b.playerMaxX();
        b.dashForward(3000, 0.2, () => {});
        await new Promise(r => setTimeout(r, 320));
        const dashed = b.monsterX;
        b.monsterX = 150; m.setMonsterPosition(150);
        const fake = { isBuilding: true, hp: 100, maxHp: 100, x: 520, dps: 0 };
        b.enemies.push(fake);
        const walled = b.playerMaxX();
        b.enemies = b.enemies.filter(e => e !== fake);
        return { free, dashed, walled, max: LINE.maxX, gap: LINE.baseGap };""")
    ctx.check(st['free'] == st['max'] and 500 < st['dashed'] <= st['max'] + 0.5 and st['walled'] == 520 - st['gap'],
              '기준 벽(주인공): 긴 돌진도 화면 한도(880)에서 멈춤 · 거점이 있으면 그 앞 110까지', str(st))

    # ---- ⑬ 저사양 모드: 설정 스위치 · 해상도 1배 · 이펙트 입자 상한 · 흐림 끔 · 느린 기기 안내 ----
    MANY = """const fx = { layers: [{ type: 'motes', count: 400, spread: 200, rise: [20, 60], life: [3, 4], size: 2, color: '255, 200, 80' }] };
        for (let i = 0; i < 4; i++) b.fx.play(fx, 400 + i * 60, 200);
        await new Promise(r => setTimeout(r, 250));
        return b.fx.vfx.parts.length;"""
    st = g.js("""const R = await import('/js/engine_v2/displayRes.js');
        R.setFitScale(2);
        const off = { low: settings.get('lowSpec'), cls: document.body.classList.contains('v2-lowspec'), res: R.displayRes() };
        return off;""")
    parts_off = g.js(MANY)
    ctx.check(st['low'] is False and not st['cls'] and st['res'] > 1 and parts_off > 300, '기본: 저사양 모드 꺼짐 (해상도 배율 1 초과 · 입자 300개 넘게 뜸)', str((st, parts_off)))
    st = g.js("""const R = await import('/js/engine_v2/displayRes.js');
        b.fx.vfx.parts.length = 0;
        settings.set('lowSpec', true);
        R.setFitScale(2);
        return { cls: document.body.classList.contains('v2-lowspec'), res: R.displayRes(), saved: JSON.parse(localStorage.getItem('mo_v2_settings')).lowSpec };""")
    parts_on = g.js(MANY)
    ctx.check(st['cls'] and st['res'] == 1 and st['saved'] is True and 0 < parts_on <= 250,
              '저사양 모드 켬: 캔버스 해상도 1배 · 이펙트 입자 250개까지 · body.v2-lowspec(흐림 끔) · 저장', str((st, parts_on)))
    g.js("settings.set('lowSpec', false);")
    # 느린 기기 안내: 느린 구간이 두 번 이어지면 한 번만 뜸 → [저사양 모드 켜기]
    st = g.js("""const { perfHint } = await import('/js/engine_v2/perfHint_v2.js');
        localStorage.removeItem('mo_v2_lowspec_hint');
        window.madOverlordNoPerfHint = false;
        perfHint.reset();
        for (let i = 0; i < 600; i++) perfHint.tick(1 / 60);           // 60fps 10초: 안 뜸
        const fast = !!document.querySelector('.v2-perfhint');
        perfHint.reset();                                               // 구간을 새로 (남은 빠른 프레임이 다음 구간 평균에 섞이지 않게)
        for (let i = 0; i < 90; i++) perfHint.tick(0.05);              // 20fps 4.5초 = 느린 구간 한 번
        const once = !!document.querySelector('.v2-perfhint');
        perfHint.tick(1.2);                                             // 멈췄다 돌아온 긴 간격은 안 셈
        for (let i = 0; i < 90; i++) perfHint.tick(0.05);              // 두 번째 느린 구간
        const el = document.querySelector('.v2-perfhint');
        const shown = !!el, text = el ? el.textContent : '';
        el?.querySelector('[data-act="on"]').click();
        const after = { low: settings.get('lowSpec'), gone: !document.querySelector('.v2-perfhint'), key: localStorage.getItem('mo_v2_lowspec_hint') };
        settings.set('lowSpec', false);
        for (let i = 0; i < 200; i++) perfHint.tick(0.05);              // 다시 느려도 한 번 안내했으면 안 뜸
        const again = !!document.querySelector('.v2-perfhint');
        window.madOverlordNoPerfHint = true;
        return { fast, once, shown, text, after, again };""")
    ctx.check(not st['fast'] and not st['once'] and st['shown'] and '저사양 모드' in st['text'], '느린 기기 안내: 60fps면 안 뜸 · 느린 구간이 두 번 이어져야 뜸', str(st))
    ctx.check(st['after'] == {'low': True, 'gone': True, 'key': '1'} and not st['again'], '안내의 [저사양 모드 켜기] → 켜지고 닫힘 · 기기마다 한 번만', str(st))
    # 설정 창에 스위치
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)
    g.js("(await import('/js/ui_v2/settingsPanel_v2.js')).openSettings();")
    g.page.wait_for_selector('.v2-settings [data-toggle="lowSpec"]')
    g.page.click('.v2-settings [data-toggle="lowSpec"]')
    g.wait(200)
    st = g.js("""const btn = document.querySelector('.v2-settings [data-toggle="lowSpec"]');
        return { on: btn.classList.contains('is-on'), low: settings.get('lowSpec'), label: btn.closest('.v2-settings__row').textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };""")
    ctx.check(st['on'] and st['low'] is True and '저사양 모드' in st['label'], "설정 › 화면: '저사양 모드' 스위치", str(st))
    g.shot('meeting_a_lowspec', '.v2-settings__panel')
    g.js("settings.reset();")
    ctx.check(g.js("return settings.get('lowSpec');") is False, '설정 기본값 → 저사양 모드 꺼짐')

    # ---- ④ 사거리: 거대괴수·합성괴인 근접 팔 −30, 거대로봇 근 170 · 원 300~360 ----
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const r = id => PARTS_DB.arm.find(p => p.id === id).stats.range;
        return { mech: ['arm_red_robot', 'arm_mech_b', 'arm_mech_laser', 'arm_mech_missile', 'arm_mech_a', 'arm_mech_u', 'arm_mech_d'].map(r),
            kaiju: ['arm_mutant', 'arm_kaiju_a', 'arm_kaiju_b', 'arm_kaiju_w'].map(r), chimera: ['arm_chimera', 'arm_chimera_a', 'arm_chimera_b', 'arm_chimera_c'].map(r) };""")
    ctx.check(st['mech'] == [170, 170, 300, 340, 360, 310, 340], '거대로봇 사거리: 근접 170 · 원거리 300~360', str(st['mech']))
    ctx.check(st['kaiju'] == [160, 160, 320, 230] and st['chimera'] == [150, 160, 240, 230],
              '거대괴수 · 합성괴인: 근접 팔 −30 (원거리 산성 침 320 · 중거리 산탄 240은 그대로) · 근거리 기준 230 넘던 해룡 앞발 · 독침 앞발은 230 (D-158)', str(st))
