"""디스코드 QA (11-07 ~ 11-08, #세션-수정사항) 회귀 검사
- 결과 화면: 새 별(NEW)만 또렷하고 나머지(제목·기록·보상)가 흐리게 깔리던 것 (성용 '하드 4-1')
- 배경: 적을 만나 멈추면 배경이 처음 자리로 돌아가던 것 (성용)
- 지도: 1 → 10 걷는 중에 10을 또 누르면 1부터 다시 걷던 것 (홍도도)
- '다음 N-1' 단추로 새 구역 첫 판에 가면 스토리 인트로가 안 나오던 것 (성용)
- 소환수(얼음 기사): 공격·걷기가 매 순간 바뀌어 팔만 떨며 앞으로 가던 것 (홍도도)
- 덮치기·백조의 회전 등 앞으로 나가는 스킬이 적을 뚫고 화면 끝까지 가던 것 (홍도도)
- 걸으면서 쓴 투사체 스킬(플라즈마 고리 등)이 앞으로 못 나가던 것 (홍도도)"""

MONSTER = "const { monsterControllerV2: mc } = await import('/js/engine_v2/monster_v2.js');"
CLEAR = """b.autoSkills = false; b.spawnInterval = 999;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom?.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);"""
FROST = lambda arm: ('head_frost_a', 'body_frost_a', arm, 'leg_frost_a')


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- 결과 화면: 제목·기록 칸이 패널 안쪽 판 위에 그려짐 (눌렀을 때 맞는 요소가 그 글자) ----
    g.js("progress.selectedStage = '1-1';")
    g.battle('mech', wait_ms=2500)
    g.js("b.starFlags = [true, true, false]; b.finishBattle(true);")
    g.wait(3500)
    st = g.js("""const q = s => document.querySelector(s);
        const top = el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === el || el.contains(hit)); };
        return { title: top(q('.v2-result__title')), stats: top(q('.v2-result__stats dd')), reward: top(q('.v2-result__stats .is-reward strong')),
            stars: top(q('.v2-result__star.is-on .v2-icon')), news: document.querySelectorAll('.v2-result__star em').length };""")
    ctx.check(st['title'] and st['stats'] and st['reward'] and st['stars'] and st['news'] == 3,
              '결과 화면: 새 별 3개와 함께 제목·기록·획득 DM도 패널 위에 또렷이 (안쪽 판 아래로 안 깔림)', str(st))
    g.shot('qa1108_result')
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)

    # ---- 배경: 걷다가 적을 만나 멈춰도 그 자리 (처음 자리로 안 돌아감) ----
    g.battle('mech', wait_ms=1500)
    g.js(CLEAR)
    g.wait(1800)
    tx = "const tx = () => new DOMMatrix(getComputedStyle(document.getElementById('bg-ground-v2')).transform).m41;"
    st0 = g.js(MONSTER + tx + "return { state: mc.currentState, x: tx() };")
    g.place_enemies(n=2, gap=40, first=110, hp=900000, speed=0, dps=1)
    g.wait(700)
    st1 = g.js(MONSTER + tx + "return { state: mc.currentState, x: tx(), anims: document.getElementById('bg-ground-v2').getAnimations().length };")
    g.wait(600)
    st2 = g.js(MONSTER + tx + "return { state: mc.currentState, x: tx() };")
    ctx.check(st0['state'] == 'walking' and st1['state'] == 'attacking' and st1['anims'] >= 1 and abs(st1['x']) > 20 and abs(st2['x'] - st1['x']) < 2,
              '배경: 걷다가 적과 싸우면 배경이 그 자리에 멈춤 (처음 자리 0으로 안 돌아감)', f'{st0} → {st1} → {st2}')
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- 걸으며 쓴 투사체(움직이는 판정)가 바닥에 끌려가지 않고 제 속도로 앞으로 ----
    g.battle(('head_mech', 'body_red_robot', 'arm_mech_v', 'leg_red_robot'), wait_ms=1500)
    g.js(CLEAR)
    g.wait(800)
    st = g.js(MONSTER + """const w = b.kitWave({ x: b.frontX(), speed: 380, dist: 380, w: 50, dmg: 0 }); const x0 = w.x;
        await new Promise(r => setTimeout(r, 500));
        return { state: mc.currentState, moved: Math.round(w.x - x0) };""")
    ctx.check(st['state'] == 'walking' and st['moved'] > 120,
              "걷는 중 쏜 '플라즈마 고리'(속도 380): 0.5초에 앞으로 120px 넘게 (예전엔 바닥 427px/초에 끌려 뒤로)", str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- 덮치기(돌진)·백조의 회전(순간 이동): 앞을 막는 적 바로 앞에서 멈추고 그 적을 침 ----
    for name, arm, first in (('덮치기', 'arm_frost_d', 150), ('백조의 회전', 'arm_frost_w', 130)):
        g.battle(FROST(arm), wait_ms=1500)
        g.js(CLEAR)
        g.place_enemies(n=3, gap=60, first=first, hp=900000, speed=0, dps=0)
        st = g.js("""const e0 = b.enemies.filter(e => !e.isBuilding).sort((p, q) => p.x - q.x)[0];
            const x0 = b.monsterX; b.skillCd.arm = 0; const used = b.useSkill('arm');
            await new Promise(r => setTimeout(r, 1300));
            return { used: !!used, moved: Math.round(b.monsterX - x0), front: Math.round(b.frontX()), enemy: Math.round(e0.x), hit: e0.hp < e0.maxHp };""")
        ctx.check(st['used'] and st['front'] <= st['enemy'] + 5 and st['hit'],
                  f'{name}: 맨 앞 적을 뚫고 지나가지 않고 그 앞에서 멈춰 침', str(st))
        g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
        g.wait(400)

    # ---- 얼음 기사 소환: 4초 동안 공격·걷기가 거의 안 바뀜 (예전 14번) ----
    g.battle(tuple(f'{s}_frost_u' for s in ('head', 'body', 'arm', 'leg')), wait_ms=1500)
    g.js(CLEAR)
    g.place_enemies(n=4, gap=70, first=260, hp=900000, speed=35, dps=5)
    g.js("b.skillCd.body = 0; b.useSkill('body');")
    g.wait(900)
    st = g.js("""const allies = b.allies.filter(a => a.kind === 'kit'); const flips = allies.map(() => 0), last = allies.map(a => !!a.attacking);
        const t0 = performance.now();
        await new Promise(res => { const tick = () => { allies.forEach((a, i) => { if (!!a.attacking !== last[i]) { flips[i]++; last[i] = !!a.attacking; } });
            if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res(); }; tick(); });
        return { n: allies.length, flips, fighting: allies.map(a => !!a.attacking) };""")
    ctx.check(st['n'] == 2 and max(st['flips']) <= 3 and all(st['fighting']),
              '얼음 기사: 붙은 적과 계속 싸움 — 4초 동안 공격·걷기 전환 3번 이하 (공격 동작이 끝까지 나옴)', str(st))
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)

    # ---- '다음 N-1'(결과 화면 다음 단추 → onNavigate('battle')): 처음이면 스토리 인트로 먼저 ----
    st = g.js("""window.madOverlordNoIntro = false; progress.selectedStage = '2-1';
        const si = await import('/js/ui_v2/storyIntro_v2.js');
        b.onNavigate('battle');
        await new Promise(r => setTimeout(r, 600));
        const playing = !!si.currentIntro(), battle = !!b.isActive;
        si.currentIntro()?.finish();
        await new Promise(r => setTimeout(r, 1500));
        return { playing, battleDuring: battle, battleAfter: !!b.isActive };""")
    ctx.check(st['playing'] and not st['battleDuring'] and st['battleAfter'],
              "'다음 2-1'로 가도 처음이면 구역 2 스토리 인트로 → 끝나면 전투", str(st))
    g.js("window.madOverlordNoIntro = true; b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)

    # ---- 지도: 걷는 중에 같은 정거장을 또 눌러도 처음부터 다시 걷지 않음 ----
    g.js("""for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9']) progress.recordStage(id, { stars: [true, true, true], cleared: true, time: 30 }, 'normal');""")
    g.reload_v2()
    st = g.js("""const sm = window.madOverlordGameV2.menuController.stageMap;
        const i = sm.pages.findIndex(p => p.zone === 1); sm.go(i);
        const page = sm.track.children[i];
        const stops = [...page.querySelectorAll('.v2-smap__stop')].filter(s => sm.pages[i].nodes.find(n => n.id === s.dataset.id && n.state !== 'locked'));
        const wait = ms => new Promise(r => setTimeout(r, ms));
        sm._tap(i, stops[0]); while (sm.walking) await wait(50);
        await wait(200);
        sm.walkSpeed = 40;
        const far = stops[stops.length - 1];
        sm._tap(i, far); await wait(900);
        const f1 = sm.walking?.f;
        sm._tap(i, far); await wait(120);
        const f2 = sm.walking?.f;
        sm._tap(i, stops[1]); await wait(60);
        const f3 = sm.walking?.f, to3 = sm.walking?.to;
        sm.walkSpeed = 4000; while (sm.walking) await wait(50);
        return { n: stops.length, f1, f2, f3, sel: progress.selectedStage, want: stops[1].dataset.id };""")
    ctx.check(st['n'] >= 5 and st['f1'] is not None and st['f2'] is not None and st['f2'] >= st['f1'] and st['f3'] is not None and st['f2'] - 1 <= st['f3'] <= st['f2'] + 0.5,
              '지도: 걷는 중 같은 곳을 또 누르면 그대로 계속, 다른 곳을 누르면 지금 자리에서 이어 걸음 (출발점으로 안 돌아감)', str(st))
    ctx.check(st['sel'] == st['want'], '지도: 마지막에 누른 정거장에 도착해 그 판이 골라짐', str(st))
