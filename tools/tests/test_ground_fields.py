"""우선 4스킬 지면 연출: 범위·스크롤·수명·레이어, 시트 가장자리와 실제 전투 연결."""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    result = g.js("""
        const { VfxPlayer } = await import('/js/engine_v2/vfx/vfxPlayer.js');
        const { groundField } = await import('/js/engine_v2/vfx/groundFields.js');
        const { KitMethods } = await import('/js/engine_v2/battle/kit.js');
        const { FOOT_B } = await import('/js/engine_v2/battle/tuning.js');
        const layers = [];
        const fx = new VfxPlayer();
        const engine = { ...KitMethods, frontX: () => 100, groundSpeed: () => 50,
            kitZones: [], kitWaves: [], enemies: [], allies: [],
            fx: { play: (def, x, y, opts) => { layers.push({ def, opts }); fx.play(def, x, y, opts); } } };
        engine.kitZone({ field: 'swamp', x: 20, w: 220, sec: 8, slow: true });
        const z = engine.kitZones[0], it = fx.items[0];
        const start = it.follow();
        engine.scrollKit(0.5);
        const scroll = it.follow();
        const width = it.w === z.w && start[0] === 230 && start[1] === FOOT_B;
        const moving = scroll[0] === start[0] - 25;
        engine.tickKitZones(7.5); fx.update(7.5);
        const staying = fx.items.includes(it) && z.t === 0.5;
        engine.tickKitZones(0.5); fx.update(0.5);
        const expired = !engine.kitZones.length && !fx.items.length;
        engine.kitZone({ field: 'rift', x: 10, w: 170, sec: 5 });
        engine.kitZones = []; fx.update(0);
        const cleared = !fx.items.length;
        engine.kitZone({ field: 'plasma', x: 0, w: 120, sec: 6, follow: true });
        engine.monsterX = 250; engine.tickKitZones(0.1);
        const following = fx.items[0].follow()[0] === 370;
        fx.play({ layers: [groundField('sonic', 260, 0.65)] }, 200, 100, { owner: 'support-test' });
        fx.removeOwner('support-test');
        const owner = !fx.items.some(p => p.owner === 'support-test');

        const rendering = [];
        for (const style of ['swamp', 'plasma', 'rift', 'sonic']) {
            for (const mode of ['glow', 'pixel']) {
                const c = document.createElement('canvas'); c.width = 640; c.height = 180;
                const cx = c.getContext('2d'), v = new VfxPlayer({ style: mode });
                v.play({ layers: [groundField(style, 380, 2)] }, 320, 110);
                v.update(0.4); v.draw(cx, 'front');
                const front = cx.getImageData(0, 0, 640, 180).data.some(n => n);
                v.draw(cx, 'ground');
                const data = cx.getImageData(0, 0, 640, 180).data;
                let pixels = 0, min = 640, max = 0;
                for (let y = 0; y < 180; y++) for (let x = 0; x < 640; x++) {
                    if (data[(y * 640 + x) * 4 + 3] > 10) { pixels++; min = Math.min(min, x); max = Math.max(max, x); }
                }
                v.update(2); cx.clearRect(0, 0, 640, 180); v.draw(cx, 'ground');
                const gone = !cx.getImageData(0, 0, 640, 180).data.some(n => n);
                rendering.push({ style, mode, ok: !front && pixels > 1500 && min >= 110 && max <= 530 && gone });
            }
        }
        return { width, moving, staying, expired, cleared, following, owner, rendering };
    """)
    for key, label in [('width', '장판 폭·바닥 기준점 = 판정'), ('moving', '지면 스크롤과 함께 이동'),
                       ('staying', '지속 시간 동안 장판 유지'), ('expired', '만료 시 판정·그림 제거'),
                       ('cleared', '판정 강제 제거 시 잔류 없음'), ('following', '시전자 추적 장판 위치'),
                       ('owner', '소유 연출 제거 지원')]:
        ctx.check(result[key], label, str(result))
    for row in result['rendering']:
        ctx.check(row['ok'], f"{row['style']}/{row['mode']}: 바닥 레이어·부드러운 범위·종료", str(row))

    edges = g.js("""
        const { VfxPlayer } = await import('/js/engine_v2/vfx/vfxPlayer.js');
        const rows = [];
        for (const sheet of ['summon_portal', 'subwoofer_blast', 'swamp_bubble', 'plasma_white']) {
            const draw = softEdges => {
                const c = document.createElement('canvas'); c.width = c.height = 256;
                const v = new VfxPlayer();
                v.play({ layers: [{ type: 'sprite', sheet, size: 256, dur: 1, softEdges }] }, 128, 128);
                v.update(0.5); v.draw(c.getContext('2d'), 'front');
                return c.getContext('2d').getImageData(0, 0, 256, 256).data;
            };
            let raw = draw(0);
            for (let i = 0; i < 60 && !raw.some(n => n); i++) { await new Promise(r => setTimeout(r, 50)); raw = draw(0); }
            const soft = draw(0.2);
            let rawEdge = 0, softEdge = 0, coreDiff = 0, rawCore = 0;
            for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
                const k = (y * 256 + x) * 4 + 3;
                if (x < 40 || x >= 216 || y < 40 || y >= 216) { rawEdge += raw[k]; softEdge += soft[k]; }
                if (x >= 64 && x < 192 && y >= 64 && y < 192) { rawCore += raw[k]; coreDiff += Math.abs(raw[k] - soft[k]); }
            }
            rows.push({ sheet, ok: rawEdge > 0 && softEdge < rawEdge * 0.9 && rawCore > 0 && coreDiff < rawCore * 0.02 });
        }
        return rows;
    """)
    for row in edges:
        ctx.check(row['ok'], f"{row['sheet']}: 가장자리는 부드럽게·중심 보존", str(row))

    # 실제 파츠 스킬을 사용해, 새 연출이 전투의 타이밍·판정에 연결되는지 확인.
    for char, letter, slot, style in [('kaiju', 'd', 'head', 'swamp'), ('mech', 'v', 'head', 'plasmaBurn'),
                                     ('mech', 'm', 'body', 'rift'), ('broadcaster', 'v', 'head', 'sonic')]:
        g.js("progress.selectStage('2-1');")
        g.battle(tuple(f'{s}_{char}_{letter}' for s in ('head', 'body', 'arm', 'leg')), wait_ms=2800)
        g.place_enemies(n=5, first=170, gap=65, hp=100000, speed=0, dps=0)
        used = g.js(f"b.autoSkills = false; b.skillCd.body = 0; b.ultGauge = 1; return b.useSkill('{slot}');")
        ctx.check(used, f'{style}: 실제 파츠 스킬 발동')
        state = None
        for _ in range(50):
            g.wait(60)
            state = g.js(f"""const it = b.fx.vfx.items.find(it => it.type === 'sprite' && it.fieldStyle === '{style}');
                return it ? {{ t: it.t, dur: it.dur, w: it.fieldWidth, sheet: it.sheet,
                    zone: b.kitZones.some(z => z.field === '{style}' && z.w === it.fieldWidth) }} : null;""")
            if state and state['t'] > 0.14:
                break
        ctx.check(bool(state and state['sheet'] and (style == 'sonic' or state['zone'])),
                  f'{style}: 전투 장판·파동에 이미지 시트 표시', str(state))
        if state:
            g.wait(80 if style == 'sonic' else 350)
            g.shot(f'ground_field_{style}', '#screen-battle-v2')
            g.js("gameTime.paused = true;")
            frozen = g.js("return b.fx.vfx.time;")
            g.wait(120)
            ctx.check(g.js("return b.fx.vfx.time;") == frozen, f'{style}: 일시정지 시 연출 정지')
            g.js("gameTime.paused = false;")
        g.js("b.stopBattle();")
        ctx.check(g.js("return !b.fx.vfx.items.length;"), f'{style}: 퇴각 시 연출 정리')

    page = g.browser.new_page(viewport={'width': 1100, 'height': 780})
    page.on('pageerror', lambda e: g.errors.append(str(e)))
    page.goto(f'{g.base}/rig_test.html?embed=1')
    page.evaluate('async () => { await rigTest.ready; rigTest.pause(); }')
    for char, part, style in [('kaiju', 'head_kaiju_d', 'swamp'), ('mech', 'head_mech_v', 'plasmaBurn'),
                              ('mech', 'body_mech_m', 'rift'), ('broadcaster', 'head_broadcaster_v', 'sonic')]:
        state = page.evaluate("""async ([char, part, style]) => {
            await rigTest.setCharacter(char); rigTest.pause();
            const ok = rigTest.playSkill(part);
            let item;
            for (let i = 0; i < 240; i++) {
                rigTest.step(1 / 60);
                item = rigTest.api.vfx.items.find(it => it.type === 'sprite' && it.fieldStyle === style && it.started && it.t > 0.2);
                if (item) break;
            }
            const shown = !!item;
            for (let i = 0; i < 180; i++) rigTest.step(0.1);
            return { ok, shown, cleared: !rigTest.api.vfx.items.some(it => it.fieldStyle) };
        }""", [char, part, style])
        ctx.check(state['ok'] and state['shown'] and state['cleared'], f'{style}: 연구소 공용 미리보기 재생·종료', str(state))
    page.close()
