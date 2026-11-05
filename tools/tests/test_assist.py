"""연패 보정 (11-05 Q-028 답 — 무료가 더 어려운 건 의도, 단 절대 못 깨는 판은 없게, difficulty_v2.js ASSIST):
아직 못 깬 판에서 질 때마다(시간 초과·목숨 소진) 적·거점 체력과 적 공격력 −10%, 최대 −40%, 깨면 원래대로. 스스로 나간 판은 안 셈.
메뉴 판 정보·휴대폰 판 카드·진 뒤 결과에 표시, 저장 백업은 잘못된 연패 수를 거절. 주파수 교란기 여러 대의 스킬 지연은 한 대만큼."""

BASE = """const { stageFor } = await import('/js/engine_v2/difficulty_v2.js'); const { stageById } = await import('/js/engine_v2/stages_v2.js');
const s0 = stageFor(stageById('SID'), 'normal');"""
STATE = "return { assist: b.assist, hp: b.stage.enemy.hp, dps: b.stage.enemy.dps, mid: b.stage.base.mid, fin: b.stage.base.final, losses: progress.stage('SID').losses, cleared: progress.stage('SID').cleared };"
PACK = """const backup = await import('/js/engine_v2/saveStore_v2.js');
const pack = value => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
const save = JSON.parse(entries.mo_v2_save);"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    g.js("progress.selectStage('1-1');")
    g.battle('mech', wait_ms=2000)
    st = g.js(STATE.replace('SID', '1-1'))
    ctx.check(st['assist'] == 0 and not st['losses'], '처음 도전: 보정 없음', str(st))

    # 진짜 시간 초과 → 연패 1 → 결과에 '다음 도전은 −10%'
    g.js("b.stats.time = b.stage.timeLimit;")
    g.wait(5000)
    res = g.js("return { result: !!document.querySelector('.v2-result.is-lose'), assist: document.querySelector('.v2-result__assist')?.textContent || '' };")
    st = g.js(STATE.replace('SID', '1-1'))
    ctx.check(res['result'] and st['losses'] == 1 and '−10%' in res['assist'], "시간 초과로 짐: 연패 1 · 결과 '도전 보정 — 다음 도전은 적 체력·공격력 −10%'", str((res, st)))
    g.shot('assist_result', '#screen-battle-v2')

    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(500)
    foot = g.js("return document.getElementById('menu-map-foot-v2').textContent;")
    ctx.check('도전 보정 −10%' in foot, '메뉴 판 정보에 도전 보정 −10%', foot)

    # 연패가 많아도 최대 −40% · 적·거점 체력과 적 공격력에 곱함
    g.js("progress.stages['1-1'].losses = 6;")
    g.battle(None, wait_ms=1500)
    st = g.js(BASE.replace('SID', '1-1') + """const r2 = v => Math.round(v * 100) / 100, r100 = v => Math.round(v / 100) * 100;
        return { assist: b.assist, ok: b.stage.enemy.hp === r2(s0.enemy.hp * 0.6) && b.stage.enemy.dps === r2(s0.enemy.dps * 0.6)
            && b.stage.base.mid === r100(s0.base.mid * 0.6) && b.stage.base.final === r100(s0.base.final * 0.6) && b.stage.timeLimit === s0.timeLimit,
            spawned: (() => { const e = b.enemies.find(x => !x.isBuilding); return !e || Math.abs(e.dps - e.t.dps * b.stage.enemy.dps * (e.elite ? 1.5 : 1)) < 0.01; })() };""")
    ctx.check(st['assist'] == 0.4 and st['ok'] and st['spawned'], '연패 6번이어도 최대 −40%: 적 체력·공격력·거점 체력 × 0.6 (시간 제한은 그대로)', str(st))

    # 깨면 원래대로 (연패 지움), 깬 판은 다시 져도 안 셈
    g.js("b.finishBattle(true);")
    g.wait(1500)
    st = g.js(STATE.replace('SID', '1-1') + '')
    ctx.check(st['cleared'] and st['losses'] is None and g.js("return progress.assist('1-1');") == 0
              and not g.js("return !!document.querySelector('.v2-result__assist');"), '깨면 연패 지움 → 보정 0, 결과에 보정 줄 없음', str(st))
    g.js("window.madOverlordGameV2.switchScreen('menu'); progress.selectStage('1-1');")
    g.wait(400)
    g.battle(None, wait_ms=1500)
    g.js("b.finishBattle(false);")
    g.wait(800)
    st = g.js(STATE.replace('SID', '1-1'))
    ctx.check(st['assist'] == 0 and st['losses'] is None, '깬 판은 다시 져도 연패를 세지 않음 (보정 0)', str(st))

    # 스스로 나간 판은 안 셈
    g.js("window.madOverlordGameV2.switchScreen('menu'); progress.selectStage('1-2');")
    g.wait(400)
    g.battle(None, wait_ms=1500)
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(400)
    ctx.check(g.js("return progress.stage('1-2').losses;") is None, '전투 중 메뉴로 나감: 연패 안 셈')

    # 목숨을 다 써서 짐 → 연패 1
    g.battle(None, wait_ms=1500)
    g.js("b.lives = 0; b.playerHp = 0;")
    g.wait(4500)
    ctx.check(g.js("return progress.stage('1-2').losses;") == 1, '목숨을 다 써서 짐: 연패 1')
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)

    # 저장 백업: 연패 수가 음수·소수면 거절, 내보내기에는 들어 있음
    st = g.js(PACK + """const bad = [-1, 1.5, '2'].map(v => pack({ entries: { ...entries, mo_v2_save: JSON.stringify({ ...save, stages: { ...save.stages, '1-2': { ...save.stages['1-2'], losses: v } } }) } }));
        return { kept: save.stages['1-2'].losses, rejected: bad.map(code => !backup.importSave(code).success) };""")
    ctx.check(st['kept'] == 1 and all(st['rejected']), '저장 백업: 연패 수 들어 있음, 음수·소수·문자는 거절', str(st))

    # 주파수 교란기 여러 대: 스킬 지연은 한 대 주기(5.5초)에 한 번만
    g.js("progress.selectStage('1-1');")
    g.battle(None, wait_ms=1500)
    st = g.js("""b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);
        window.__delays = 0; const o = b.delaySkills.bind(b); b.delaySkills = (s, l) => { window.__delays += 1; return o(s, l); };
        for (let i = 0; i < 3; i++) { const e = b.spawnMinion('jammer', { x: b.frontX() + 300 + i * 30, elite: false }); e.speed = 0; e.cd.skill = 99; e.hp = e.maxHp = 99999; }
        return true;""")
    g.wait(2500)
    n = g.js("const n = window.__delays; delete b.delaySkills; return n;")
    ctx.check(n == 1, '주파수 교란기 3대가 한꺼번에 쏴도 스킬 지연은 한 번 (한 대만큼)', str(n))

    # 휴대폰 판 카드에도 보정 칩
    p = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    p.enter_v2()
    p.js("progress.recordsOf('normal')['1-1'] = { stars: [false, false, false], cleared: false, bestTime: null, losses: 2 }; progress.selectStage('1-1'); window.madOverlordGameV2.menuController.updateDisplay();")
    p.wait(400)
    st = p.js("""const c = document.getElementById('menu-stage-card-v2'), a = c.querySelector('.v2-assist');
        if (!a) return null; const r = a.getBoundingClientRect(), cr = c.getBoundingClientRect(), t = c.querySelector('.v2-mstage__time').getBoundingClientRect();
        return { text: a.textContent, inside: r.left >= cr.left && r.right <= cr.right + 1, apart: r.right <= t.left + 1, shown: r.width > 10 };""")
    ctx.check(st and st['shown'] and '보정 −20%' in st['text'] and st['inside'] and st['apart'], '휴대폰 판 카드: 보정 −20% 칩 (카드 안, 제한 시간과 안 겹침)', str(st))
    p.shot('assist_mobile_card')
