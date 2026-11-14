"""83종 (A/B/C·그림 D) 장면, 원본 복원, 게임 선택·연결, 픽셀풍 및 비교 시트."""
import base64
import io
import os

from PIL import Image, ImageDraw, ImageFont

from common import OUT


def run(ctx):
    browser = ctx.pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 960, 'height': 600})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    # 그림 검사는 외부 글꼴의 네트워크 상태에 의존하지 않는다.
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
    page.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=200, body=''))
    try:
        page.goto(ctx.base + '/rig_test.html?capture=1', wait_until='domcontentloaded')
        page.evaluate('async () => { await rigTest.ready; rigTest.pause(); }')
        keys = page.evaluate('rigTest.vfxVariantKeys()')
        # A·B·C는 모든 이펙트에, D(그림 프레임 던파풍, D-060)는 만든 이펙트에만 덧붙음
        # 처음 15개는 A·B·C(+ D), D-060·D-061로 더한 68개는 A(지금) + D(그림 프레임)만
        ids = [[v['id'] for v in e['variants']] for e in keys]
        ctx.check(len(keys) == 83 and sum(1 for i in ids if i[:3] == ['A', 'B', 'C']) == 15
                  and all(i[0] == 'A' for i in ids) and sum(1 for i in ids if 'D' in i) >= 82,
                  '이펙트 83개: 15개 A/B/C + 그림 프레임 D 82개 이상')
        sheets_ok = page.evaluate("""async () => {
            const { VFX_SHEETS } = await import('/js/engine_v2/vfx/vfxPlayer.js');
            const { VFX_VARIANTS } = await import('/js/engine_v2/vfx/vfxVariants.js');
            const used = new Set(Object.values(VFX_VARIANTS).flatMap(e => Object.values(e.variants))
                .flatMap(v => v.def.layers).filter(l => l.type === 'sprite').map(l => l.sheet));
            const ok = await Promise.all(Object.values(VFX_SHEETS).map(s => fetch(s.src).then(r => r.ok)));
            return [...used].every(s => VFX_SHEETS[s]) && ok.every(Boolean);
        }""")
        ctx.check(sheets_ok, '그림 D가 쓰는 시트는 모두 VFX_SHEETS에 있고 파일이 있음')
        baseline = page.evaluate("""async () => {
            const defs = await import('/js/engine_v2/vfx/vfxDefs.js');
            const { VFX_VARIANTS } = await import('/js/engine_v2/vfx/vfxVariants.js');
            const { DEFAULT_VFX_CHOICES } = await import('/js/engine_v2/vfx/vfxVariants.js');
            return Object.keys(VFX_VARIANTS).every(k => {
                const [table, name] = k.split('.');
                const id = DEFAULT_VFX_CHOICES[k] || 'A';   // 효과음(sfx)은 A 것을 그대로 두므로 레이어만 비교
                return JSON.stringify(defs[table][name].layers) === JSON.stringify(VFX_VARIANTS[k].variants[id].def.layers);
            });
        }""")
        ctx.check(baseline, '선택 없는 초기 정의 = 기본값 (그림 D가 있으면 D, 없으면 A)')
        ctx.check(page.locator('header').is_hidden() and page.locator('.control-panel').is_hidden()
                  and page.locator('#capture-label').count() == 1
                  and page.locator('#rig-canvas').bounding_box()['width'] == 960,
                  'capture=1: 패널·HUD 숨김, 무대 전체 창, 녹화 글씨 자리')

        sheet = Image.new('RGB', (2080, 40 + len(keys) * 118), '#090913')
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 13)
        except OSError:
            font = ImageFont.load_default()
        for i, label in enumerate(('A 지금', 'B 만화풍', 'C 묵직한', 'D 던파풍')):
            draw.text((16 + i * 512, 10), label + '  /  0.1초 간격 4장', font=font, fill='#eeeaff')
        max_parts = 0
        for row, entry in enumerate(keys):
            key = entry['key']
            draw.text((16, 40 + row * 118), f"{entry['name']}  ({key})", font=font, fill='#d8d5ed')
            for col, variant in enumerate(('A', 'B', 'C', 'D')):
                if variant not in [v['id'] for v in entry['variants']]:
                    continue
                length = page.evaluate("""async ([key, id]) => {
                    rigTest.setVfxVariant(key, id);
                    return await rigTest.vfxShowcase(key);
                }""", [key, variant])
                ctx.check(isinstance(length, (int, float)) and length > 0, f'{key}/{variant}: 장면 재생·길이 > 0')
                hit = page.evaluate('rigTest.info.showcase.hitAt')
                if page.evaluate('rigTest.info.showcase.kind') == 'missile':
                    hit += 0.45
                # 동작 준비 뒤 첫 타격부터 0.1초 간격. B의 첫 0.05초도 포함한다.
                page.evaluate('sec => rigTest.step(sec)', hit + 0.025)
                for frame in range(4):
                    if frame:
                        page.evaluate('rigTest.step(0.1)')
                    data = page.evaluate("document.getElementById('rig-canvas').toDataURL('image/png').split(',')[1]")
                    img = Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB')
                    img.thumbnail((128, 80), Image.Resampling.LANCZOS)
                    sheet.paste(img, (16 + (col * 4 + frame) * 128, 66 + row * 118))
                peak = page.evaluate("""sec => {
                    let peak = rigTest.api.vfx.parts.length;
                    for (let t = 0; t < sec; t += 0.1) {
                        rigTest.step(0.1);
                        peak = Math.max(peak, rigTest.api.vfx.parts.length);
                    }
                    return peak;
                }""", length)
                max_parts = max(max_parts, peak)
                page.evaluate('key => rigTest.setVfxVariant(key, "A")', key)
        os.makedirs(OUT, exist_ok=True)
        sheet.save(os.path.join(OUT, 'vfxvar_sheet.png'))
        ctx.check(max_parts <= 700, f'장면 최대 동시 입자 {max_parts}개 (상한 700)')
        restored = page.evaluate("""async () => {
            const defs = await import('/js/engine_v2/vfx/vfxDefs.js');
            const { VFX_VARIANTS, applyVfxVariant } = await import('/js/engine_v2/vfx/vfxVariants.js');
            return Object.keys(VFX_VARIANTS).every(k => {
                const [table, name] = k.split('.'), ref = defs[table][name], before = JSON.stringify(ref);
                for (const id of Object.keys(VFX_VARIANTS[k].variants).filter(i => i !== 'A')) {
                    applyVfxVariant(k, id);
                    if (defs[table][name] !== ref || ref.sfx !== VFX_VARIANTS[k].variants.A.def.sfx) return false;
                }
                applyVfxVariant(k, 'A');
                return before === JSON.stringify(ref) && before === JSON.stringify(VFX_VARIANTS[k].variants.A.def);
            });
        }""")
        ctx.check(restored, '전부 B/C/D → A: 객체 참조·효과음·원본 정의 그대로 복원')
        for entry in keys:
            page.evaluate('async key => { rigTest.setVfxStyle("pixel"); await rigTest.vfxShowcase(key); rigTest.step(0.8); }', entry['key'])
        ctx.check(page.evaluate('rigTest.info.vfxStyle') == 'pixel', '83종 픽셀풍 렌더링 오류 없음')
        replay = page.evaluate("""async () => {
            await rigTest.vfxShowcase('enemyDefeat');
            rigTest.step(1);
            await rigTest.vfxShowcase('enemyDefeat');
            const reset = rigTest.info.showcase.age === 0 && rigTest.api.vfx.parts.length === 0;
            await Promise.all([rigTest.vfxShowcase('flame'), rigTest.vfxShowcase('laserBig')]);
            return reset && rigTest.info.char === 'mech' && rigTest.info.showcase.key === 'MECH_VFX.laserBig';
        }""")
        ctx.check(replay, '장면 재호출은 초기화, 빠른 연속 호출은 마지막 장면 유지')

        # 초기화 설정 파서: 저장값과 주소의 우선순위, 축약 키, 잘못된 값.
        parsed = page.evaluate("""async () => {
            const { readVfxChoices, readVfxStyle } = await import('/js/engine_v2/vfx/vfxVariants.js');
            localStorage.setItem('vfxChoices', JSON.stringify({ flame: 'C', fistHit: 'B', bad: 'C' }));
            history.replaceState(null, '', '?vfx=flame:B,fistHit:C,bad:Z&vfxStyle=pixel');
            const choices = readVfxChoices();
            const { DEFAULT_VFX_CHOICES } = await import('/js/engine_v2/vfx/vfxVariants.js');
            const rest = Object.keys(choices).filter(k => k !== 'SET_VFX.flame' && k !== 'MECH_VFX.fistHit');
            return choices['SET_VFX.flame'] === 'B' && choices['MECH_VFX.fistHit'] === 'C'
                && rest.every(k => choices[k] === DEFAULT_VFX_CHOICES[k]) && !('bad' in choices) && readVfxStyle() === 'pixel';
        }""")
        ctx.check(parsed, '주소별 선택·축약 키·저장값 우선순위·픽셀풍 읽기')
        ctx.check(not errors, '전체 안 재생·픽셀풍 페이지/콘솔 오류 없음', '; '.join(errors[:5]))
    finally:
        browser.close()

    g = ctx.game(fresh=True)
    g.enter_v2()
    default = g.js("""const defs = await import('/js/engine_v2/vfx/vfxDefs.js');
        const { VFX_VARIANTS, DEFAULT_VFX_CHOICES } = await import('/js/engine_v2/vfx/vfxVariants.js');
        return b.fx.vfx.style === 'glow' && Object.keys(VFX_VARIANTS).every(k => {
            const [t, n] = k.split('.');
            return JSON.stringify(defs[t][n].layers) === JSON.stringify(VFX_VARIANTS[k].variants[DEFAULT_VFX_CHOICES[k] || 'A'].def.layers);
        });""")
    ctx.check(default, '게임: 주소·저장 선택이 없으면 기본값(그림 D / 나머지 A) + glow')
    g.page.evaluate("localStorage.setItem('vfxChoices', JSON.stringify({ flame: 'C', fistHit: 'B' }))")
    g.reload_v2()
    saved = g.js("""const { SET_VFX, MECH_VFX, HERO_VFX } = await import('/js/engine_v2/vfx/vfxDefs.js');
        const { VFX_VARIANTS: v } = await import('/js/engine_v2/vfx/vfxVariants.js');
        return JSON.stringify(SET_VFX.flame.layers) === JSON.stringify(v['SET_VFX.flame'].variants.C.def.layers)
            && JSON.stringify(MECH_VFX.fistHit.layers) === JSON.stringify(v['MECH_VFX.fistHit'].variants.B.def.layers)
            && JSON.stringify(HERO_VFX.slashHit.layers) === JSON.stringify(v['HERO_VFX.slashHit'].variants.D.def.layers);""")
    ctx.check(saved, '게임: localStorage 개별 선택 적용, 나머지 기본값 유지')
    g.page.goto(ctx.base + '/index.html?skipTitle=1&vfx=B&vfxStyle=pixel')
    g.enter_v2()
    selected = g.js("""const defs = await import('/js/engine_v2/vfx/vfxDefs.js');
        const { VFX_VARIANTS } = await import('/js/engine_v2/vfx/vfxVariants.js');
        return b.fx.vfx.style === 'pixel' && Object.keys(VFX_VARIANTS).every(k => {
            const [t, n] = k.split('.');
            const id = VFX_VARIANTS[k].variants.B ? 'B' : 'D';     // B가 없는 이펙트(그림 D만)는 기본값 그대로
            return JSON.stringify(defs[t][n].layers) === JSON.stringify(VFX_VARIANTS[k].variants[id].def.layers)
                && defs[t][n].sfx === VFX_VARIANTS[k].variants.A.def.sfx;
        });""")
    ctx.check(selected, '게임 ?vfx=B: B가 있는 15개는 B, 나머지는 기본값 + 픽셀풍, 효과음 유지')
    g.battle('mech', wait_ms=100)
    linked = g.js("""const { BATTLE_VFX } = await import('/js/engine_v2/vfx/vfxDefs.js');
        const { spawnEnemy } = await import('/js/engine_v2/enemies_v2.js');
        const play = b.fx.play, calls = [];
        b.fx.play = (def, x, y, opts) => { calls.push({ def, x, y, opts }); };
        try {
            const e = spawnEnemy(b, 'guard', { x: 600, elite: true, affixes: [] });
            const elite = calls.filter(c => c.def === BATTLE_VFX.eliteSpawn).length;
            b.dealDamageToEnemy(e, e.hp * 2, false);
            b.dealDamageToEnemy(e, 1, false);
            const defeated = calls.filter(c => c.def === BATTLE_VFX.enemyDefeat).length;
            const boss = spawnEnemy(b, 'guardian', { x: 700 });
            b.dealDamageToEnemy(boss, boss.hp * 10, false);
            const bossFx = calls.filter(c => c.def === BATTLE_VFX.enemyDefeat).at(-1);
            const wall = b.spawnBarricade(800, 10);
            b.dealDamageToEnemy(wall, 20, false);
            const excludesWall = calls.filter(c => c.def === BATTLE_VFX.enemyDefeat).length === 2;
            const bases = [b.spawnBase('mid'), b.spawnBase('final')];
            const before = calls.filter(c => c.def === BATTLE_VFX.baseHit).length;
            const time = b.stats.time;
            for (const base of bases) {
                base.hp = base.maxHp = 100000;
                b.dealDamageToEnemy(base, 1, false);
                b.dealDamageToEnemy(base, 1, false);
            }
            const first = calls.filter(c => c.def === BATTLE_VFX.baseHit).length - before;
            b.stats.time = time + 0.24;
            bases.forEach(base => b.dealDamageToEnemy(base, 1, false));
            const throttled = calls.filter(c => c.def === BATTLE_VFX.baseHit).length - before;
            b.stats.time = time + 0.251;
            bases.forEach(base => b.dealDamageToEnemy(base, 1, false));
            const later = calls.filter(c => c.def === BATTLE_VFX.baseHit).length - before;
            b.stats.time = time;
            return { elite, defeated, bossScale: bossFx.opts.scale, excludesWall, bases: bases.length, first, throttled, later };
        } finally { b.fx.play = play; }""")
    ctx.check(linked['elite'] == 1, '엘리트 생성 시 eliteSpawn 한 번', str(linked))
    ctx.check(linked['defeated'] == 1 and linked['bossScale'] > 1, '적 처치 enemyDefeat 한 번·보스 확대', str(linked))
    ctx.check(linked['excludesWall'], '바리케이드 처치에는 enemyDefeat 없음', str(linked))
    ctx.check(linked['bases'] > 0 and linked['first'] == linked['bases'] == linked['throttled']
              and linked['later'] == linked['bases'] * 2, '거점별 baseHit 0.25초 제한', str(linked))
