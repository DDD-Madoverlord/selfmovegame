"""스킬 이펙트 2차 개선 (D-118): 14개 항목을 실제 전투에서 쓰고 이미지 층·판정·정리 확인 + 화면 캡처."""

SET = lambda char, letter: tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg'))
KAIJU_A = ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a')

# (이름, 빌드, 슬롯, 캡처 시각들(ms), 확인 JS — 마지막 식이 dict)
CASES = [
    ('steel_wall', SET('mech', 'c'), 'body', [250, 900], """
        const z = b.kitZones.find(z => z.tag === 'wall'), el = z && z.artEl;
        return { wall: !!z && z.w === 46, art: !!el && getComputedStyle(el).backgroundImage.includes('steel_wall'),
            noPillar: !b.fx.vfx.items.some(it => it.sheet === 'pillar_gold') };"""),
    ('target_strike', SET('mech', 'd'), 'head', [500, 1650, 1900], """
        return { reticle: true };"""),
    ('snipe', SET('mech', 'd'), 'arm', [500, 1060, 1200], """
        return { noFlame: !b.fx.vfx.items.some(it => it.sheet === 'apocalypse_beam') };"""),
    ('plasma_carpet', SET('mech', 'v'), 'head', [1000, 1250, 2200], """
        const z = b.kitZones.find(z => z.tag === 'plasma');
        return { field: !!z && z.field === 'plasmaBurn',
            noSmoke: !b.fx.vfx.items.some(it => it.sheet === 'plasma_white'),
            fire: b.fx.vfx.items.some(it => it.sheet === 'power_aura') };"""),
    ('ark_wall', SET('mech', 'w'), 'head', [900, 3000], """
        const domes = b.fx.vfx.items.filter(it => it.sheet === 'dome_gold');
        return { oneDome: domes.length === 1, noGlowCopy: domes.every(d => !d.glow), domeMask: domes.every(d => d.mask === 'dome'), rigShieldOff: !m.rigBattle.effects.shield,
            shieldHp: b.shieldHp > 0 };"""),
    ('repair_drone', SET('mech', 'w'), 'body', [900, 1500, 2200], """
        return { drones: b.fx.vfx.items.filter(it => it.type === 'drone').length === 3 };"""),
    ('spike_storm', KAIJU_A, 'head', [560, 1000], """
        return { poison: b.fx.vfx.items.some(it => it.sheet === 'coral_pink'), bleed: b.enemies.some(e => e.bleedT > 0) };"""),
    ('thorn_armor', KAIJU_A, 'body', [900, 2500], """
        return { back: b.fx.vfx.items.some(it => it.type === 'spineSprites'), noGroundSpikes: !b.fx.vfx.items.some(it => it.type === 'crystals'),
            buff: !!b.buffs.thornArmor };"""),
    ('charged_rail', ('head_mech_a', 'body_mech_a', 'arm_mech_a', 'leg_mech_a'), 'arm', [450, 760], """
        return { laser: b.fx.vfx.items.some(it => it.sheet === 'orbital_beam' && it.crop), noFlame: !b.fx.vfx.items.some(it => it.sheet === 'apocalypse_beam') };"""),
    ('crystal_prison', SET('kaiju', 'v'), 'head', [700, 2200, 3550], """
        return { ok: true };"""),
    ('crystal_spear', SET('kaiju', 'v'), 'arm', [260, 420], """
        return { ok: true };"""),
    ('vortex', SET('kaiju', 'w'), 'arm', [900, 2000], """
        const z = b.kitZones.find(z => z.field === 'vortex');
        return { field: !!z, swirl: b.fx.vfx.items.some(it => it.sheet === 'eternal_winter' && it.spin) };"""),
]


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('2-1');")
    for name, build, slot, shots, check in CASES:
        g.battle(build)
        g.place_enemies(n=4, first=230, gap=70, hp=100000, speed=0, dps=0)
        used = g.js(f"b.autoSkills = false; b.ultGauge = 1; b.skillCd['{slot}'] = 0; return b.useSkill('{slot}');")
        ctx.check(bool(used), f'{name}: 실제 스킬 발동')
        last = 0
        for i, t in enumerate(shots):
            g.wait(t - last)
            last = t
            g.shot(f'vfx2_{name}_{i}', '#screen-battle-v2')
            if i == len(shots) - 1:
                st = g.js(check)
                ctx.check(all(st.values()), f'{name}: 이미지 층·판정 확인', str(st))
        g.wait(6500)
        left = g.js("return { zones: b.kitZones.length, drones: b.fx.vfx.items.filter(it => it.type === 'drone').length };")
        ctx.check(left['zones'] == 0 and left['drones'] == 0, f'{name}: 끝난 뒤 장판·드론 정리', str(left))

    # 기본 공격: 장거리 저격포·플라즈마 방사 팔 — 총구 섬광 + 날아가는 탄, 리그 충전 점 없음
    # 레일건(A 포격 사령부) 기본 공격: 그림 발사 연출 + 총구가 포신 끝 (세트 포신 소켓)
    g.battle(('head_mech_a', 'body_mech_a', 'arm_mech_a', 'leg_mech_a'))
    g.place_enemies(n=3, first=300, gap=60, hp=100000, speed=0, dps=0)
    st = g.js("""b.autoSkills = false;
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 15));
            const it = b.fx.vfx.items.find(it => it.sheet === 'needle_crimson' && it.travel && it.hue === 195);
            if (it) { gameTime.paused = true; return { slug: true, socket: m.rigBattle.skeleton.variantSockets?.muzzle_cannon === 'muzzle_cannon_a',
                noEndFlash: !b.fx.vfx.items.some(x => x.pos === 'to' && x.sheet === 'punch_cyan') }; }
        }
        return { slug: false };""")
    g.wait(60)
    g.shot('vfx2_railgun_attack', '#screen-battle-v2')
    g.js("gameTime.paused = false;")
    ctx.check(st.get('slug') and st.get('socket') and st.get('noEndFlash'), '레일건: 청록 빛줄기 탄 그림 + 포신 끝 총구 소켓', str(st))

    for name, build in (('sniper_attack', SET('mech', 'd')), ('plasma_arm_attack', SET('mech', 'v'))):
        g.battle(build)
        g.place_enemies(n=2, first=300, gap=60, hp=100000, speed=0, dps=0)
        g.js("b.autoSkills = false;")
        seen = g.js("""const out = { bullet: false, flash: false, dot: false, hit: false };
            const hp0 = b.enemies.filter(e => !e.isBuilding).map(e => e.hp).reduce((a, c) => a + c, 0);
            for (let i = 0; i < 80; i++) {
                await new Promise(r => setTimeout(r, 25));
                const its = b.fx.vfx.items;
                if (its.some(it => it.sheet === 'needle_crimson' && it.travel)) out.bullet = true;
                if (its.some(it => it.sheet === 'needle_crimson' && !it.travel)) out.flash = true;
                if (m.rigBattle.effects.charge || m.rigBattle.effects.flashes.length) out.dot = true;
            }
            out.hit = b.enemies.filter(e => !e.isBuilding).map(e => e.hp).reduce((a, c) => a + c, 0) < hp0;
            out.quiet = m.rigBattle.quietFire === true;
            return out;""")
        ctx.check(seen['bullet'] and seen['flash'] and not seen['dot'] and seen['hit'] and seen['quiet'],
                  f'{name}: 총구 섬광 + 탄 발사, 예전 점 섬광 없음, 피해 들어감', str(seen))
        g.js("""for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 10));
            if (b.fx.vfx.items.some(it => it.sheet === 'needle_crimson' && !it.travel && it.t < 0.05)) { gameTime.paused = true; return true; } } return false;""")
        g.wait(60)
        g.shot(f'vfx2_{name}', '#screen-battle-v2')
        g.js("gameTime.paused = false;")

    # 열기 발자국: 걸음마다 앞쪽 적 화상
    g.battle(SET('kaiju', 'c'))
    g.place_enemies(n=2, first=130, gap=60, hp=100000, speed=0, dps=0)
    st = g.js("""b.kitOnStep(); b.kitOnStep();
        return { burn: b.enemies.some(e => !e.isBuilding && e.kitDots?.burn?.t > 0),
            noLavaZone: !b.kitZones.some(z => z.field === 'lava'), embers: b.fx.vfx.items.some(it => it.sheet === 'power_aura') };""")
    ctx.check(all(st.values()), '열기 발자국: 앞쪽 적 화상 · 불씨 연출 · 용암 장판 없음', str(st))
    g.wait(150)
    g.shot('vfx2_heat_step', '#screen-battle-v2')
