"""D-070·D-075: 40초 반복 충전, 근접 배치, 반복 소유 수명."""
from test_support import setup


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    setup(g, 'frost', enemies=1)
    st = g.js("""const initial = b.supportStatus(); b.callSupport(); const first = b.support.active;
        const used = b.supportStatus(); b.tickSupport(.5); b.supportHit(first, b.enemies[0], 1000);
        const firstDamage = b.stats.supportDamage;
        b.tickSupport(9.5); const afterExit = b.supportStatus();
        b.tickSupport(29.9); const early = b.callSupport();
        const almost = b.supportStatus(); b.tickSupport(.1); const full = b.supportStatus();
        const again = b.callSupport(); const second = b.support.active;
        const hp = b.enemies[0].hp; b.supportHit(first, b.enemies[0], 10000);
        const stale = b.enemies[0].hp === hp;
        b.tickSupport(.5); const totalBefore = b.stats.supportDamage;
        const hp2 = b.enemies[0].hp; b.supportHit(second, b.enemies[0], 100);
        return { initial, used, afterExit, early, almost, full, again, stale,
            different: first.owner !== second.owner, calls: b.stats.supportCalls,
            accumulated: firstDamage > 0 && totalBefore >= firstDamage && b.stats.supportDamage > totalBefore && hp2 > b.enemies[0].hp,
            actors: document.querySelectorAll('.v2-support-actor').length };
    """)
    ctx.check(st['initial']['ready'] and st['initial']['charge'] == 1 and st['used']['cooldown'] == 40 and st['used']['charge'] == 0,
              '충전 완료 후 호출 즉시 소진·40초 재충전', str(st))
    ctx.check(st['afterExit']['cooldown'] == 30 and not st['early'] and not st['almost']['ready'] and st['full']['ready'] and st['full']['time'] == 0,
              '출격 중 충전, 39.9초 거부·40초 재호출 준비', str(st))
    ctx.check(st['again'] and st['different'] and st['stale'] and st['calls'] == 2 and st['accumulated'] and st['actors'] == 1,
              '반복 호출: 서로 다른 효과 소유자·과거 공격 무효·누적 피해 유지·본체 1명', str(st))
    st = g.js("""b.tickSupport(10); b.tickSupport(400);
        const full = b.supportStatus(); const first = b.callSupport(), second = b.callSupport();
        return { full, first, second, charge: b.supportStatus().charge };
    """)
    ctx.check(st['full']['charge'] == 1 and st['first'] and not st['second'] and st['charge'] == 0,
              '오래 기다려도 1회분만 저장, 중복 출격 불가', str(st))

    setup(g, 'diver', enemies=1)
    st = g.js("""const e = b.enemies[0]; e.boss = true; b.support.auto = true; b.stats.time = 10;
        b.tickSupport(.1); const first = b.support.active.owner;
        b.tickSupport(10); b.tickSupport(29.9); const early = b.stats.supportCalls;
        b.tickSupport(.1);
        return { early, again: !!b.support.active, different: b.support.active?.owner !== first, calls: b.stats.supportCalls };
    """)
    ctx.check(st['early'] == 1 and st['again'] and st['different'] and st['calls'] == 2,
              '지원 AUTO: 재충전 완료 후에도 보스 상황을 보고 반복 호출', str(st))

    # 클래스 이름이 아닌 실제 장착 팔로 근접/원거리 여부를 결정한다.
    for char, main in (('kaiju', 'mech'), ('chimera', 'mech'), ('doll', 'mech'), ('mech', 'hero')):
        if char == 'mech':   # 앞 반복(주인공 로봇·미사일 팔)이 출격 때 저장(튜토리얼)되어 마지막 장착이 됨 → 근접 확인은 기본 주먹 팔로
            g.js("progress.loadouts.mech = { ...progress.loadouts.mech, arm: 'arm_red_robot' };")
        setup(g, char, main=main, enemies=1)
        st = g.js("""const e = b.enemies[0]; e.x = b.frontX() + 480; e.dom.style.left = e.x + 'px'; e.boss = true;
            b.callSupport(); const a = b.support.active; const near = b.supportInRange(a, e), x = a.x;
            b.tickSupport(.5); const hp = e.hp; b.tickSupport(1.51);
            return { melee: a.melee, near, x, main: b.monsterX, basic: e.hp < hp, elapsed: a.elapsed };
        """)
        ctx.check(st['melee'] and st['near'] and st['x'] > st['main'] + 180 and st['basic'],
                  f'{char}: 먼 적의 공격 사거리 안에 즉시 등장, 필살기 후 첫 기본 공격', str(st))
    g.wait(150)
    g.js('b.hud.updateSupport();')
    g.shot('support_melee_front', '#screen-battle-v2')
    setup(g, 'mech', main='hero', enemies=1)
    st = g.js("""b.support.snapshot.parts.arm.attackType = 'laser'; b.support.snapshot.stats.range = 300;
        const e = b.enemies[0]; e.x = b.frontX() + 480; b.callSupport();
        return { melee: b.support.active.melee, x: b.support.active.x, home: b.monsterX - 45 };
    """)
    ctx.check(not st['melee'] and st['x'] == st['home'], '같은 로봇도 원거리 팔이면 주인공 옆에 소환', str(st))

    setup(g, 'doll', enemies=0)
    st = g.js("""const wall = b.spawnBase('mid'); wall.x = b.monsterX + 250;
        wall.hp = wall.maxHp = 50000; wall.dom.style.left = wall.x + 'px';
        b.spawnMinion('guard', { x: wall.x + 100, elite: false });
        b.callSupport(); const a = b.support.active;
        const front = a.x + 60, near = b.supportInRange(a, wall);
        b.tickSupport(.5); const hp = wall.hp; b.tickSupport(1.51);
        return { front, wall: wall.x, near, basic: wall.hp < hp };
    """)
    ctx.check(st['front'] < st['wall'] and st['near'] and st['basic'], '거점 앞에서 소환·공격, 뒤쪽 적에게 방벽 넘어 소환하지 않음', str(st))

    setup(g, 'doll', enemies=2)
    st = g.js("""const [first, next] = b.enemies; first.x = b.frontX() + 200; next.x = first.x + 200;
        first.boss = next.boss = true; b.callSupport(); const a = b.support.active; b.tickSupport(.5);
        first.hp = 1; b.supportHit(a, first, 100); const before = a.x;
        b.tickSupport(.01); const started = !!a.dash;
        b.tickSupport(.23); const reached = b.supportInRange(a, next);
        const used = a.dashUsed; b.tickSupport(.8); const hp = next.hp; b.tickSupport(.7);
        const basic = next.hp < hp;
        const third = b.spawnMinion('guard', { x: next.x + 150, elite: false }); third.hp = third.maxHp = 50000;
        next.hp = 1; b.supportHit(a, next, 100); const beforeSecond = a.x; b.tickSupport(.01);
        return { started, reached, used, moved: a.x > before, basic,
            onceOnly: !a.dash && a.dashUsed && Math.abs(a.x - beforeSecond) < 20 };
    """)
    ctx.check(st['started'] and st['reached'] and st['used'] and st['moved'] and st['basic'] and st['onceOnly'],
              '첫 대상 처치 후 가까운 다음 적에게 0.22초 돌진·공격, 한 번만 허용', str(st))

    setup(g, 'doll', enemies=2)
    st = g.js("""const [first, next] = b.enemies; first.x = b.frontX() + 200; next.x = first.x + 200;
        b.callSupport(); const a = b.support.active; first.hp = 1; b.dealDamageToEnemy(first, 1000, false);
        b.tickSupport(.01); const started = !!a.dash; b.tickSupport(.23);
        return started && !a.cast && b.supportInRange(a, next);
    """)
    ctx.check(st, '등장 중 첫 적이 먼저 죽어도 새 대상에게 돌진, 필살기 전 접근 완료')

    setup(g, 'mech', main='hero', enemies=1)
    st = g.js("""b.callSupport(); const first = b.support.active; b.tickSupport(.5);
        const owner = first.owner, made = b.fx.drones.filter(d => d.owner === owner).length;
        b.tickSupport(9.5); const left = b.fx.drones.filter(d => d.owner === owner).length;
        b.tickSupport(40); const again = b.callSupport(); b.tickSupport(.5);
        return { made, left, again, onlyNew: b.fx.drones.every(d => d.owner === b.support.active.owner) };
    """)
    ctx.check(st['made'] == 6 and st['left'] == 0 and st['again'] and st['onlyNew'],
              '반복 드론 출격: 철수한 드론은 제거, 새 출격 드론만 유지', str(st))

    setup(g, 'saint', enemies=3)
    st = g.js("""b.spawnAllyMinion(b.monsterX, 'chimera'); const own = b.allies[b.allies.length - 1];
        b.callSupport(); b.tickSupport(.5); const first = b.support.active.owner;
        b.tickSupport(9.5); const cleaned = b.allies.includes(own) && !own.supportShield && !b.allies.some(a => a.supportOwner);
        b.tickSupport(40); b.spawnMinion('guard', { x: b.monsterX + 180, elite: false });
        b.callSupport(); b.tickSupport(.5);
        return { cleaned, shield: b.supportShield, different: b.support.active.owner !== first,
            ownStillHere: b.allies.includes(own), temporary: b.allies.filter(a => a.supportOwner).length };
    """)
    ctx.check(st['cleaned'] and st['shield'] > 0 and st['different'] and st['ownStillHere'] and st['temporary'] == 1,
              '반복 성녀 출격: 이전 임시 아군·보호막 정리, 기존 아군 보존', str(st))

    setup(g, 'kaiju', enemies=1)
    g.js("""b.playerDps = 0; b.support.cooldown = 2; gameTime.speed = 2;
        b.lastTime = performance.now(); b.loopId = requestAnimationFrame(t => b.loop(t));""")
    g.wait(250)
    g.key('p')
    paused = g.js('return b.support.cooldown;')
    g.wait(350)
    same = g.js('return b.support.cooldown;')
    ctx.check(0 < paused < 1.9 and abs(same - paused) < .001, '실제 2배속 충전과 P 일시정지: 게이지도 정지', str((paused, same)))
    g.key('p')
    g.wait(60)
    g.shot('support_recharge', '#screen-battle-v2')
    g.wait(1040)
    st = g.js("""const gauge = document.querySelector('.v2-support-gauge'); return {
        full: b.supportStatus().ready, pct: gauge.getAttribute('aria-valuenow'),
        readyStyle: document.querySelector('.v2-support-call').classList.contains('is-ready'),
        text: document.querySelector('.v2-support-state').textContent };
    """)
    ctx.check(st['full'] and st['pct'] == '100' and st['readyStyle'] and st['text'] == '호출 가능',
              '충전 완료 시 게이지·남은 시간·호출 버튼 표시 갱신', str(st))
    g.key('q')
    g.wait(100)
    ctx.check(g.js('return !!b.support.active && b.support.cooldown > 39;'), '재충전 후 실제 Q 키로 호출')
    g.js('b.stopBattle();')
