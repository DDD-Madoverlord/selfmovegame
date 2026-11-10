"""움직임 퀄리티업 (Q-008 단계 1-B, MD/세트장비_퀄리티업_단계계획.md 5장):
Q1 선명하게(캔버스 해상도 배율) · Q2 걸음 맞추기(배경·바닥·걷기 동작 = 진격 속도) · Q3 다리 층(걸으며 스킬) ·
Q4 반응 동작(주인공 움찔·밀림·기절, 적 젖혀짐·쓰러짐) · Q5 적 그림 2배·프레임 늘림 · Q6 곁들임 움직임(바람·멈춤 쏠림) ·
단계 2 손목 관절(무희·성녀·인형사·길잡이)"""

FROST = ('head_frost', 'body_frost', 'arm_frost', 'leg_frost')
SLOW = ('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant')   # 거대괴수 기본 (느림)
WAIT = "await new Promise(r => setTimeout(r, {ms}));"


def clear(g):
    g.js("b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);")


def run(ctx):
    # ---- Q1: 큰 창에서는 캔버스를 촘촘히, 설정을 끄면 1배 ----
    big = ctx.game(fresh=True, viewport=(1940, 1100))
    big.enter_v2()
    big.battle(FROST, wait_ms=1500)
    st = big.js("""const c = document.getElementById('player-sprite-canvas-v2'); const f = b.fx.canvas;
        return { rig: c.width / c.clientWidth, fx: f.width / f.clientWidth, res: m.rigBattle.res };""")
    ctx.check(st['res'] >= 1.5 and abs(st['rig'] - st['res']) < 0.02 and abs(st['fx'] - st['res']) < 0.02,
              f"Q1 선명하게: 큰 창(1940×1100)에서 캐릭터·이펙트 캔버스 {st['res']}배", str(st))
    st = big.js("settings.set('sharp', false); " + WAIT.format(ms=200) + """const c = document.getElementById('player-sprite-canvas-v2');
        const r = { rig: c.width / c.clientWidth, fx: b.fx.canvas.width / b.fx.canvas.clientWidth }; settings.set('sharp', true); return r;""")
    ctx.check(abs(st['rig'] - 1) < 0.02 and abs(st['fx'] - 1) < 0.02, 'Q1 설정 "선명한 그림" 끄면 1배', str(st))
    big.js("b.stopBattle();")

    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- Q2: 걸음 맞추기 — 느린 캐릭터는 배경·걷기 동작이 느림 ----
    speeds = {}
    for name, build in (('frost', FROST), ('kaiju', SLOW)):
        g.battle(build, wait_ms=1500)
        clear(g)
        g.wait(400)
        speeds[name] = g.js("""return { k: b.groundK, speed: b.playerSpeed, walk: m.rigBattle.walkScale, mode: m.rigBattle.mode,
            bg: document.getElementById('bg-ground-v2').getAnimations().map(a => a.playbackRate), ground: b.groundSpeed() };""")
    # 원거리/근거리(D-121)로 무희(원거리 ×0.5)가 느리고 거대괴수(근거리 ×2)가 빨라짐 → 속도로 느린 쪽을 고름
    k, f = sorted([speeds['frost'], speeds['kaiju']], key=lambda s: s['speed'])
    ctx.check(k['speed'] < f['speed'] and k['k'] < f['k'] and all(abs(r - k['k']) < 0.02 for r in k['bg']) and k['mode'] == 'walk' and k['walk'] < f['walk'],
              f"Q2 걸음 맞추기: 느린 쪽(속도 {k['speed']})은 배경 ×{k['k']:.2f}·걷기 ×{k['walk']:.2f}, 빠른 쪽(속도 {f['speed']})은 ×{f['k']:.2f}", str(speeds))
    ctx.check(abs(k['ground'] - 1280 / 3 * k['k']) < 0.5, 'Q2 바닥에 놓인 것(장판·잔해·시체)도 같은 빠르기로 흐름', str(k))

    # ---- Q3: 걸으며 스킬 — 다리는 걷기 동작, 끝나면 그 걸음 시점에서 걷기로 ----
    g.battle(FROST, wait_ms=1500)
    clear(g)
    g.wait(300)
    st = g.js("""const r = m.rigBattle; const ok = r.playOnce('crescent');""" + WAIT.format(ms=250) + """
        const legs = r.legLayer, leg = r.legAnim.currentName, t0 = r.legAnim.currentTime;""" + WAIT.format(ms=250) + """
        const moved = r.legAnim.currentTime !== t0;""" + WAIT.format(ms=900) + """
        return { ok, legs, leg, moved, after: r.legLayer, cur: r.animator.currentName };""")
    ctx.check(st['ok'] and st['legs'] and st['leg'] == 'walk' and st['moved'] and not st['after'] and st['cur'] == 'walk',
              'Q3 걸으며 스킬: 다리는 계속 걷고, 끝나면 걷기로', str(st))

    # ---- Q4: 주인공 반응 ----
    st = g.js("""const r = m.rigBattle; b.hurtReactAt = -9; b.damagePlayer(10, 0);""" + WAIT.format(ms=60) + """
        const mid = r._offsets().root || {};""" + WAIT.format(ms=400) + """return { x: mid.x || 0, left: r.reacts.length };""")
    ctx.check(st['x'] < -5 and st['left'] == 0, 'Q4 맞음: 뒤로 움찔했다 돌아옴', str(st))
    st = g.js("""const r = m.rigBattle; b.pStunT = 1.5; b.updatePlayerStatus();""" + WAIT.format(ms=150) + """
        const a = (r._offsets().root || {}).rot || 0;""" + WAIT.format(ms=300) + """const c = (r._offsets().root || {}).rot || 0;
        const ts = r.timeScale; b.pStunT = 0; b.updatePlayerStatus(); return { a, c, ts, left: r.reacts.map(x => x.name) };""")
    ctx.check(st['ts'] == 0 and abs(st['a'] - st['c']) > 0.5 and 'stun' not in st['left'], 'Q4 기절: 동작은 멈추고 비틀거림, 풀리면 끝', str(st))
    st = g.js("const r = m.rigBattle; b.monsterX = 400; b.knockPlayerBack(100); return r.reacts.map(x => x.name);")
    ctx.check('knock' in st, 'Q4 밀림: 크게 젖혀짐', str(st))
    st = g.js("""const r = m.rigBattle; gameTime.slowMo(0.3, 1.4); m.playReaction('down');""" + WAIT.format(ms=900) + """
        const o = r._offsets().root || {}; const held = r.reacts.some(x => x.name === 'down'); r.resetSkills();
        return { y: o.y || 0, rot: o.rot || 0, held, after: r.reacts.length };""")
    ctx.check(st['held'] and st['y'] > 25 and st['rot'] < -3 and st['after'] == 0,
              'Q4 패배: 느린 화면 중에도 0.9초 안에 주저앉은 자세까지 가서 유지, 다음 전투 시작 때 지움', str(st))

    # ---- Q6: 쿵 눌림 (무거운 캐릭터 걸음 'stomp') ----
    g.battle(('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant'), wait_ms=1500)
    clear(g)
    st = g.js("""const r = m.rigBattle; let seen = 0, minSy = 0; for (let i = 0; i < 60; i++) { await new Promise(res => setTimeout(res, 25));
        if (r.reacts.some(x => x.name === 'stomp')) { seen++; minSy = Math.min(minSy, (r._offsets().root || {}).sy || 0); } }
        return { seen, minSy, wind: r.character.wind && r.character.wind.length };""")
    ctx.check(st['seen'] > 0 and st['minSy'] < -0.005 and st['wind'] == 3, 'Q6 거대괴수 걸음마다 쿵 눌림 · 꼬리 바람', str(st))

    # ---- Q4: 적 반응 — 맞으면 젖혀짐, 쓰러지면 넘어지며 사라짐 ----
    clear(g)
    st = g.js("""const e = b.spawnMinion('guard', { x: b.frontX() + 300 }); e.hp = e.maxHp = 5000;
        b.dealDamageToEnemy(e, 100, false, { knock: 1 }); const rec = !!e.recoil && e.recoil.playState;
        const e2 = b.spawnMinion('guard', { x: b.frontX() + 360 }); const el = e2.dom; b.dealDamageToEnemy(e2, 99999, false, { knock: 0 });
        const falling = el.isConnected && el.classList.contains('is-falling') && !b.enemies.includes(e2);""" + WAIT.format(ms=800) + """
        return { rec, falling, gone: !el.isConnected };""")
    ctx.check(st['rec'] in ('running', 'finished') and st['falling'] and st['gone'],
              'Q4 적: 맞으면 젖혀짐 · 쓰러지면 넘어지는 동안 남았다가 치움 (처치는 바로)', str(st))
    st = g.js("""const e = b.spawnMinion('guard', { x: b.frontX() + 300 }); e.hp = e.maxHp = 5000; const sp = e.dom.querySelector('.v2-enemy__sprite');
        const anim = () => getComputedStyle(sp).animationName + '/' + getComputedStyle(sp).animationPlayState;
        const walk = anim(); b.stunEnemy(e, 2); const stun = anim(); e.stunT = 0; b.updateEnemyFilter(e);
        e.frozenT = 2; b.updateEnemyFilter(e); const frozen = anim(); e.frozenT = 0; b.updateEnemyFilter(e);
        b.rootEnemy(e, 2); const root = anim(); e.rootT = 0; b.updateEnemyFilter(e); const back = anim();
        return { walk, stun, frozen, root, back };""")
    ctx.check(st['stun'].startswith('v2-enemy-dizzy') and st['frozen'].endswith('paused') and st['root'].startswith('v2-enemy-struggle')
              and st['back'] == st['walk'], 'Q5 멈춘 적: 기절 비틀거림 · 빙결 굳음 · 속박 버둥거림 → 풀리면 다시 걷기', str(st))

    # ---- Q5: 적 그림 2배 픽셀·프레임 늘림 (WebP) ----
    st = g.js("""const { ENEMY_ART } = await import('/js/engine_v2/enemyArt_v2.js'); const a = ENEMY_ART.guard;
        const img = new Image(); img.src = a.walk.src; await img.decode();
        return { src: a.walk.src, frames: a.walk.frames, atk: a.attack.frames, w: img.naturalWidth, h: img.naturalHeight, fw: a.frameWidth, fh: a.frameHeight,
            all: Object.values(ENEMY_ART).every(x => Object.entries(x).filter(([k, v]) => v && v.src).every(([k, v]) => v.src.endsWith('.webp'))) };""")
    ctx.check(st['src'].endswith('.webp') and st['frames'] == 16 and st['atk'] == 14 and st['all']
              and st['w'] == st['fw'] * 2 * st['frames'] and st['h'] == st['fh'] * 2,
              f"Q5 적 그림: WebP·2배 픽셀(경비병 {st['w']}×{st['h']})·걷기 16장·공격 14장", str(st))

    # ---- Q6: 멈추면 앞으로 쏠림, 빨리 걸을수록 망토·머리카락이 뒤로 (빠른 타락 기사 히어로 — 대검 근거리 ×2, D-121) ----
    g.battle(('head_hero_a', 'body_hero_a', 'arm_hero_a', 'leg_hero_a'), wait_ms=1500)
    clear(g)
    g.wait(1200)
    st = g.js("""const r = m.rigBattle; const wind = r.windK; r.setMode('attack');""" + WAIT.format(ms=90) + """
        const settle = r.reacts.some(x => x.name === 'settle'), rot = (r._offsets().root || {}).rot || 0; r.setMode('walk');
        return { wind, settle, rot, hair: r.character.wind };""")
    ctx.check(st['settle'] and st['rot'] > 0.5 and st['wind'] > 0.3, f"Q6 멈추면 앞으로 쏠림 · 빠른 걸음에 망토 바람 {st['wind']:.2f}", str(st))

    # ---- 단계 2 손목 관절 (D-067·D-068): 무희·성녀·인형사·길잡이 — 손 뼈·손 그림·무기 소켓이 손을 따라감 ----
    JOINTS = {'frost': (('head_frost', 'body_frost', 'arm_frost', 'leg_frost'), ['handF', 'handB'], 'fanF'),
              'saint': (('head_saint', 'body_saint', 'arm_saint', 'leg_saint'), ['handF'], 'muzzle'),
              'doll': (('head_doll', 'body_doll', 'arm_doll', 'leg_doll'), ['handF'], 'blade'),
              'diver': (('head_diver', 'body_diver', 'arm_diver', 'leg_diver'), ['anchorB'], 'anchor')}
    for cid, (build, hands, sock) in JOINTS.items():
        g.battle(build, wait_ms=900)
        st = g.js(f"""const r = m.rigBattle, sk = r.skeleton; const hands = {hands};
            const ok = hands.map(h => !!sk.byName[h] && !!sk.images[sk.byName[h].part]);
            const h = sk.byName[hands[0]]; const before = sk.socketWorld('{sock}', hands[0]);
            const save = h.world.slice(); h.world = [Math.cos(0.3), Math.sin(0.3), -Math.sin(0.3), Math.cos(0.3), h.world[4], h.world[5]];
            const after = sk.socketWorld('{sock}', hands[0]); h.world = save;
            const clips = Object.values(r.character.clips).filter(c => c.tracks[hands[0]]).length;
            return {{ ok, moved: Math.hypot(after[0] - before[0], after[1] - before[1]), clips, char: r.character.id }};""")
        ctx.check(all(st['ok']) and st['moved'] > 5 and st['clips'] >= 5 and st['char'] == cid,
                  f"손목 관절 {cid}: 손 뼈 {hands} · 소켓 '{sock}'이 손을 따라 돎 · 동작 {st['clips']}개에 손목 움직임", str(st))

    # ---- Q7 스킬 전용 동작: 거대괴수·합성괴인·거대로봇 스킬이 공격·승리 동작을 빌리지 않음 ----
    Q7 = {
        'kaiju': ('head_mutant', 'body_mutant', 'arm_mutant', 'leg_mutant'),
        'kaiju_a': ('head_kaiju_a', 'body_kaiju_a', 'arm_kaiju_a', 'leg_kaiju_a'),
        'kaiju_b': ('head_kaiju_b', 'body_kaiju_b', 'arm_kaiju_b', 'leg_kaiju_b'),
        'chimera_a': ('head_chimera_a', 'body_chimera_a', 'arm_chimera_a', 'leg_chimera_a'),
        'chimera_b': ('head_chimera_b', 'body_chimera_b', 'arm_chimera_b', 'leg_chimera_b'),
        'mech_a': ('head_mech_a', 'body_mech_a', 'arm_mech_a', 'leg_mech_a'),
        'mech_b': ('head_mech_b', 'body_mech_b', 'arm_mech_b', 'leg_mech_b'),
        'mech_laser': ('head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel'),
    }
    for name, build in Q7.items():
        g.battle(build, wait_ms=1500)
        clear(g)
        g.js("b.spawnMinion('guard', { x: b.frontX() + 60 }).hp = 1e7;")
        st = g.js("""const r = m.rigBattle; const played = []; const orig = r.playOnce.bind(r);
            r.playOnce = n => { played.push(n); return orig(n); };
            for (const s of ['arm', 'body', 'head']) { b.skillCd[s] = 0; b.ultGauge = 1; m.flushCast(); r.onceClip = null; b.useSkill(s);
                await new Promise(res => setTimeout(res, 120)); }
            r.playOnce = orig; m.flushCast();
            const own = Object.keys(r.character.clips);
            return { played, bad: played.filter(n => /^attack|^victory$/.test(n) || !own.includes(n)) };""")
        ctx.check(st['played'] and not st['bad'], f"Q7 {name}: 스킬마다 전용 동작 {st['played']}", str(st))
    g.js("b.stopBattle();")
