"""설명 기반 적용 대상의 실제 파츠 스킬, 이미지 루프·끝 처리·클리핑을 검증한다."""

EXPECTED = {
    # 땅 강타(D-120)·핵 심장 고동(D-122~123)은 코드 그림 반구 충격파(domeWave)로 바뀜, 약초 연기(D-127)는 연기 그림 한 장(defeat_puff)
    'earthRoar': 'subwoofer_blast', 'groundSlam': 'domeWave', 'rampage': 'subwoofer_blast',
    'earthSmash': 'domeWave', 'kjHeartbeat': 'domeWave', 'dvSteamHammer': 'subwoofer_blast',
    'bcSubBomb': 'subwoofer_blast', 'dragonBreath': 'breath_fire', 'kjKingBreath': 'breath_gold',
    'kjDoomBeam': 'primal_beam', 'toxicBreath': 'poison', 'flamethrower': 'fire', 'acidSpit3': 'acid',
    'mcPlasmaCarpet': 'plasmaBurn', 'kjEruption': 'lava', 'kjSwamp': 'swamp', 'lifeSeal': 'seal',
    'stPotionThrow': 'herb', 'stHerbSmoke': 'defeat_puff', 'fsMoonFall': 'moon', 'cmWebTrap': 'web',
    'dvGhostFire': 'ghostFire', 'dvSteamVeil': 'steam', 'kjVortex': 'vortex',
    'dvPressureField': 'water', 'dvWhirlAnchor': 'water'
}


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    raster = g.js("""
        const { IMAGE_FIELDS, imageField } = await import('/js/engine_v2/vfx/imageEffects.js');
        const { VfxPlayer } = await import('/js/engine_v2/vfx/vfxPlayer.js');
        const rows = [];
        for (const style of [...Object.keys(IMAGE_FIELDS), 'sonic']) {
            const c = document.createElement('canvas'); c.width = 640; c.height = 280;
            const cx = c.getContext('2d'), v = new VfxPlayer();
            const def = imageField(style, 360, style === 'sonic' ? 0.8 : 3);
            v.play(def, 320, 235); v.update(0.25);
            const draw = () => {
                cx.clearRect(0, 0, c.width, c.height); v.draw(cx, 'ground'); v.draw(cx, 'front');
                const d = cx.getImageData(0, 0, c.width, c.height).data;
                let count = 0, hash = 0;
                for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 8) count++; hash = (hash * 31 + d[i] + d[i + 1] + d[i + 2]) | 0; }
                return { count, hash };
            };
            let a = draw();
            for (let i = 0; i < 60 && a.count < 100; i++) { await new Promise(r => setTimeout(r, 30)); a = draw(); }
            v.update(0.35); const b = draw();
            v.update(4); const end = draw();
            rows.push({ style, visible: a.count > 500 && b.count > 500, animated: a.hash !== b.hash,
                cleared: end.count === 0, images: def.layers.filter(l => l.type === 'sprite').length });
        }
        return rows;
    """)
    for row in raster:
        ctx.check(row['visible'] and row['animated'] and row['cleared'] and 1 <= row['images'] <= 5,
                  f"{row['style']}: 실제 이미지 픽셀·애니메이션·종료·개수 제한", str(row))

    targets = g.js("""
        const { SKILLS, PART_SKILL } = await import('/js/engine_v2/skills_v2.js');
        const { PARTS_DB } = await import('/js/data/parts.js');
        const { characterOfPart, partsOfCharacter } = await import('/js/engine_v2/roster_v2.js');
        const { setOf } = await import('/js/engine_v2/sets_v2.js');
        const extra = ['dragonBreath', 'kjKingBreath', 'kjDoomBeam', 'acidSpit3', 'flamethrower',
            'cmWebTrap', 'dvGhostFire', 'dvSteamVeil', 'kjVortex', 'dvPressureField', 'dvWhirlAnchor', 'stHerbSmoke'];
        return Object.entries(SKILLS).filter(([id, s]) => /충격파|구름|장판/.test(s.desc || '') || extra.includes(id))
            .map(([id, s]) => {
                const p = Object.values(PARTS_DB).flat().find(p => PART_SKILL[p.id] === id);
                if (!p) return null;
                const char = characterOfPart(p), sid = setOf(p)?.id;
                const build = ['head', 'body', 'arm', 'leg'].map(slot => {
                    const choices = partsOfCharacter(char, slot);
                    return (choices.find(p => sid && setOf(p)?.id === sid) || choices[0]).id;
                });
                build[['head', 'body', 'arm', 'leg'].indexOf(s.slot)] = p.id;
                return { id, name: s.name, slot: s.slot, build };
            }).filter(Boolean);
    """)
    ctx.check(len(targets) >= 20, f'설명·숨결·지속 영역에서 적용 대상 자동 선택 ({len(targets)}종)')
    for target in targets:
        sid, name = target['id'], target['name']
        expected = EXPECTED.get(sid)
        ctx.check(bool(expected), f'{name}: 이미지 적용 대상 누락 없음', sid)
        if not expected:
            continue
        g.js("progress.selectStage('2-1');")
        g.battle(tuple(target['build']), wait_ms=2500)
        g.place_enemies(n=5, first=180, gap=70, hp=1000000, speed=0, dps=0)
        used = g.js(f"""b.autoSkills = false; b.skillCd.arm = 0; b.skillCd.body = 0; b.ultGauge = 1;
            b.kitPassive = null; b.equippedLegId = null;
            window.__imageFxAttack = b.fireAttack; b.fireAttack = () => {{}};
            b.fx.vfx.clear();
            if ('{sid}' === 'rampage') b.phase2 = true;
            return b.useSkill('{target['slot']}');""")
        state = None
        for _ in range(65):
            g.wait(40)
            state = g.js(f"""const it = b.fx.vfx.items.find(it => it.started && it.t > 0.06 && (it.type === '{expected}' ||
                it.type === 'sprite' && (it.sheet === '{expected}' || it.fieldStyle === '{expected}')));
                return it ? {{ sheet: it.sheet, field: it.fieldStyle || null, width: it.width || it.size,
                    height: it.height || it.size, loop: it.loopSec || 0 }} : null;""")
            if state:
                break
        ctx.check(used and bool(state), f'{name}: 실제 파츠 스킬 → 이미지 연출', str(state))
        if state:
            g.wait(180)
            g.shot(f'image_skill_{sid}', '#screen-battle-v2')
        g.js("b.fireAttack = window.__imageFxAttack; b.stopBattle();")
        ctx.check(g.js("return b.fx.vfx.items.length === 0;"), f'{name}: 퇴각 후 이미지 잔류 없음')
