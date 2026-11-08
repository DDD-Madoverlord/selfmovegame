"""빙벽 그림·판정·붕괴와 머리 위 버프 표식의 실제 수명/소모/갱신."""

FROST = tuple(f'{s}_frost_v' for s in ('head', 'body', 'arm', 'leg'))


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    g.battle(FROST)
    g.place_enemies(n=4, first=270, gap=60, hp=100000, speed=0, dps=0)
    used = g.js("b.autoSkills = false; b.skillCd.body = 0; return b.useSkill('body');")
    ctx.check(used, '빙벽 실제 스킬 발동')
    g.page.wait_for_selector('.v2-kit-art.is-icewall', timeout=4000)
    g.wait(400)
    st = g.js("""const z = b.kitZones.find(z => z.tag === 'icewall');
        const img = new Image(); img.src = '/assets/sprites/vfx/art/ice_wall.webp'; await img.decode();
        const el = z.artEl, box = el.getBoundingClientRect();
        return { wall: z.wall, width: z.w, t: z.t, front: z.x > b.frontX(), shown: box.height > 150,
            art: getComputedStyle(el).backgroundImage.includes('ice_wall.webp'), loaded: img.naturalHeight > 0 };
    """)
    ctx.check(st['wall'] and st['width'] == 46 and st['front'] and st['shown'] and st['art'] and st['loaded'],
              '캐릭터 앞에 실제 빙벽 이미지 유지 · 기존 46px 차단 판정', str(st))
    g.shot('icewall_active', '#screen-battle-v2')
    st = g.js("""gameTime.paused = true;
        const z = b.kitZones.find(z => z.tag === 'icewall');
        const e = b.enemies.find(e => !e.isBuilding && !e.isBarricade && !e.boss);
        const { aimAt } = await import('/js/engine_v2/bases_v2.js');
        e.x = z.x + z.w / 2 - (aimAt(e).x - e.x); e.dom.style.left = `${e.x}px`;
        b.kitWallHold(e); const blocked = aimAt(e).x >= z.x + z.w - 0.1;
        const old = z.x; b.scrollKit(0.25); b.tickKitZones(0);
        return { blocked, scrolled: z.x < old && Math.abs(parseFloat(z.artEl.style.left) - z.x - z.artDx) < 0.1, t: z.t };
    """)
    ctx.check(st['blocked'] and st['scrolled'], '빙벽 차단 동작 · 바닥 스크롤과 그림 위치 일치', str(st))
    g.wait(150)
    ctx.check(g.js("return b.kitZones.find(z => z.tag === 'icewall').t;") == st['t'], '일시정지 중 빙벽 수명 유지')
    st = g.js("""const z = b.kitZones.find(z => z.tag === 'icewall'), el = z.artEl;
        b.tickKitZones(z.t + 0.01);
        return { expired: !b.kitZones.includes(z), falling: el.classList.contains('is-gone'),
            shards: b.fx.vfx.items.some(it => it.sheet === 'ice_shatter') };
    """)
    ctx.check(all(st.values()), '빙벽 만료 시 판정 종료 · 벽 붕괴 · 파편 연출', str(st))
    g.wait(500)
    ctx.check(g.page.locator('.v2-kit-art.is-icewall').count() == 0, '붕괴 후 빙벽 DOM 제거')

    st = g.js("""b.buffs = {}; b.kitBuffs = {}; b.shieldHp = 0; b.supportShield = 0; b.kitNextMul = 1;
        b.addBuff('adrenaline', 3); b.hud.update();
        const root = document.querySelector('.v2-buff-marks'), node = root.querySelector('[data-buff-id="legacy:adrenaline"]');
        const r = root.getBoundingClientRect(), hp = m.domMonster.querySelector('.monster-hp-container').getBoundingClientRect();
        return { shown: !root.hidden && !!node, label: node.title, above: r.bottom <= hp.top,
            center: Math.abs((r.left + r.width / 2) - (hp.left + hp.width / 2)) < 2 };
    """)
    ctx.check(st['shown'] and st['above'] and st['center'] and '아드레날린' in st['label'], '버프 아이콘·이름·시간이 머리 위 체력바 위에 표시', str(st))
    st = g.js("""const root = document.querySelector('.v2-buff-marks'), old = root.getBoundingClientRect().left;
        b.monsterX += 60; m.setMonsterPosition(b.monsterX); b.hud.update();
        await new Promise(r => setTimeout(r, 380));
        const scene = document.getElementById('entity-layer-v2');
        const scale = scene.getBoundingClientRect().width / scene.clientWidth;
        const moved = Math.abs(root.getBoundingClientRect().left - old - 60 * scale) < 2;
        b.addBuff('adrenaline', 6); b.tickSetBuffs(1); b.hud.update();
        const n = root.querySelectorAll('[data-buff-id="legacy:adrenaline"]');
        return { moved, one: n.length === 1, refreshed: n[0].title.includes('5초'),
            progress: Math.abs(parseFloat(n[0].style.getPropertyValue('--buff-left')) - 5 / 6) < 0.01 };
    """)
    ctx.check(all(st.values()), '표식이 캐릭터와 이동 · 재적용 시 중복 없이 시간/게이지 갱신', str(st))
    g.js("b.tickSetBuffs(5.1); b.hud.update();")
    ctx.check(g.page.locator('.v2-buff-mark').count() == 0, '버프 만료와 함께 표식 제거')
    st = g.js("""b.addKitBuff('speed-test', 4, { atkSpd: 0.3 }, null, { name: '가속', icon: 'overdrive', color: '#ffe08b' });
        b.addKitBuff('heal-test', 4, { regen: 0.02 }); b.hud.update();
        const root = document.querySelector('.v2-buff-marks');
        const labels = [...root.children].map(n => n.title);
        delete b.kitBuffs['speed-test']; delete b.kitBuffs['heal-test']; b.hud.update();
        return { many: labels.length === 2, named: labels.some(s => s.includes('가속')) && labels.some(s => s.includes('지속 회복')),
            cleared: root.children.length === 0 };
    """)
    ctx.check(all(st.values()), '여러 버프 동시 표시 · 종류별 이름 · 강제 해제 즉시 제거', str(st))
    st = g.js("""b.applyShield(0.1, 5); b.hud.update();
        const shown = !!document.querySelector('[data-buff-id="shield"]');
        b.damagePlayer(b.shieldHp * 2, 0); b.hud.update();
        const broken = !document.querySelector('[data-buff-id="shield"]');
        b.kitNextMul = 3; b.hud.update(); const next = !!document.querySelector('[data-buff-id="next-hit"]');
        b.kitOnAttack(null); b.hud.update();
        return { shown, broken, next, consumed: !document.querySelector('[data-buff-id="next-hit"]') };
    """)
    ctx.check(all(st.values()), '보호막 파괴 · 강화 공격 소모 시 표식 제거', str(st))
    st = g.js("""const { activePlayerBuffs } = await import('/js/ui_v2/buffMarks_v2.js');
        const a = activePlayerBuffs({ kitBuffs: { guard: { t: 3, mods: { guard: 2 }, used: 2 },
            mixed: { t: 3, mods: { guard: 2, def: 0.2 }, used: 2 } } });
        return { usedGone: !a.some(x => x.id === 'kit:guard'), mixedStays: a.some(x => x.id === 'kit:mixed'),
            valid: a.every(x => x.name && x.icon && !x.name.includes('undefined')) };
    """)
    ctx.check(all(st.values()), '횟수형 방어 소진 시 제거 · 다른 방어 효과가 남으면 유지', str(st))
    g.js("b.addBuff('overdrive', 4); b.applyShield(0.1, 4); b.addKitBuff('heal-test', 4, { regen: 0.02 }); b.hud.update();")
    g.shot('buff_marks_active', '#screen-battle-v2')
    g.js("b.kitZone({ x: 30, w: 46, sec: 5, wall: true, art: { cls: 'is-icewall', w: 142, h: 224, dx: -48 } }); b.stopBattle();")
    ctx.check(g.page.locator('.v2-buff-marks').count() == 0 and g.page.locator('.v2-kit-art').count() == 0, '퇴각 시 버프 표식·빙벽 모두 제거')

    g.battle(tuple(f'{s}_mech_l' for s in ('head', 'body', 'arm', 'leg')))
    st = g.js("""b.autoSkills = false; b.skillCd.body = 0; const used = b.useSkill('body');
        await new Promise(r => setTimeout(r, 200)); b.hud.update();
        return { used, title: document.querySelector('[data-buff-id="kit:overload"]')?.title || '' };
    """)
    ctx.check(st['used'] and '동력 과부하' in st['title'], '실제 부품 스킬 버프에 스킬명·아이콘 연결', str(st))

    page = g.browser.new_page()
    page.goto(f'{g.base}/rig_test.html?embed=1')
    page.evaluate('async () => { await rigTest.ready; await rigTest.setCharacter("frost"); rigTest.pause(); rigTest.playSkill("body_frost_v"); }')
    st = page.evaluate("""() => {
        let shown = false;
        for(let i=0;i<100;i++){rigTest.step(.03);shown ||= rigTest.api.vfx.items.some(it=>it.sheet==='ice_wall'&&it.started);}
        for(let i=0;i<100;i++)rigTest.step(.05);
        return { shown, gone: !rigTest.api.vfx.items.some(it=>it.sheet==='ice_wall') };
    }""")
    ctx.check(all(st.values()), '연구소 빙벽 미리보기 · 종료', str(st))
    page.close()

    mobile = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    mobile.enter_v2()
    mobile.battle(FROST)
    st = mobile.js("""b.autoSkills = false; b.addBuff('adrenaline', 4); b.applyShield(.1, 5); b.hud.update();
        const root=document.querySelector('.v2-buff-marks'), r=root.getBoundingClientRect();
        return { n:root.children.length, inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
            valid:[...root.children].every(n=>!n.style.cssText.includes('NaN')) };
    """)
    ctx.check(st['n'] == 2 and st['inside'] and st['valid'], '휴대폰에서도 캐릭터 위 버프 표식이 화면 안에 표시', str(st))
    mobile.shot('buff_marks_mobile', '#screen-battle-v2')
