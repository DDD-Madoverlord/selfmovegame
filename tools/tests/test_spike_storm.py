"""가시 폭풍: 실제 컷인 뒤 발사·포물선·착탄 판정·일시정지·퇴각 (PC/휴대폰 2배속)."""

BUILD = ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a')


def run(ctx):
    for mobile in (False, True):
        label = 'mobile_2x' if mobile else 'pc'
        g = ctx.game(viewport=(844, 390) if mobile else (1300, 740), touch=mobile)
        g.enter_v2()
        g.battle(BUILD)
        g.place_enemies(n=3, first=230, gap=55, hp=100000, speed=0, dps=0)
        used = g.js("""
            b.autoSkills = false; b.spawnInterval = 999; b.tickBasicAttack = () => {};
            b.kitOnStep = () => {}; b.legPassive = null;
            gameTime.speed = MOBILE ? 2 : 1;
            window.spikeSeen = [];
            const play = b.fx.play.bind(b.fx);
            b.fx.play = (def, ...args) => {
                if (def.layers?.some(l => l.type === 'travel')) {
                    const l = def.layers.find(l => l.type === 'travel');
                    spikeSeen.push({ now: performance.now(), until: b.director.ultCutInUntil,
                        fly: l.dur, arc: l.arc, len: l.len });
                }
                return play(def, ...args);
            };
            b.ultGauge = 1;
            return b.useSkill('head');
        """.replace('MOBILE', 'true' if mobile else 'false'))
        ctx.check(used, f'{label}: 실제 궁극기 발동')
        g.wait(250)
        st = g.js("return { cut: !!document.querySelector('.v2-ultcut'), noShot: spikeSeen.length === 0 };")
        ctx.check(all(st.values()), f'{label}: 컷인 중 발사되지 않음', str(st))
        g.page.wait_for_function('window.spikeSeen.length > 0', timeout=5000)
        g.wait(100 if mobile else 200)
        g.js('gameTime.paused = true;')
        before = g.js("return b.fx.vfx.items.find(it => it.type === 'travel')?.t;")
        g.wait(350)
        after = g.js("return b.fx.vfx.items.find(it => it.type === 'travel')?.t;")
        ctx.check(before is not None and before == after, f'{label}: 일시정지 중 비행 시간 정지')
        g.shot(f'spike_storm_arc_{label}', '#screen-battle-v2')
        st = g.js("""return { afterCut: spikeSeen.every(s => s.now >= s.until),
            visible: spikeSeen.every(s => s.fly >= 0.56 && s.arc >= 150 && s.len >= 44),
            flying: b.fx.vfx.items.some(it => it.type === 'travel'),
            beforeHit: !b.enemies.some(e => e.bleedT > 0) };""")
        ctx.check(all(st.values()), f'{label}: 컷인 뒤 큰 가시 비행·착탄 전 독 없음', str(st))
        g.js('gameTime.paused = false;')
        g.page.wait_for_function("window.madOverlordGameV2 && document.querySelector('#screen-battle-v2.active')")
        g.wait(850)
        st = g.js("""return { poison: b.enemies.some(e => e.bleedT > 0),
            art: b.fx.vfx.items.some(it => it.sheet === 'coral_pink') };""")
        ctx.check(all(st.values()), f'{label}: 착탄 후 가시 독·덤불 표시', str(st))
        g.shot(f'spike_storm_hit_{label}', '#screen-battle-v2')
        g.js('b.stopBattle();')
        ctx.check(g.js("return !b.fx.vfx.items.some(it => it.type === 'travel' || it.sheet === 'coral_pink');"),
                  f'{label}: 퇴각 시 잔류 없음')
