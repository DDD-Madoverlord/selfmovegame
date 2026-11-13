"""피로도 1단계 (Q-049 개발 기획서 — 규칙 모듈 stamina_v2.js · 저장 필드 · 저장 검사·백업, 숫자는 Q-049 답 전 임시값)
- 6분에 +1 · 최대 80에서 멈춤 · 남는 시간은 이어서 셈 · 시계를 되돌리면 회복 없음
- 맡김 → 이김 확정 / 짐 1만 씀 / 10초 안 포기 전부 / 그 뒤 포기 1 · 모자라면 출격 안 됨(기다릴 시간)
- 충전·돌려받기는 999까지 넘침 · 최대치를 넘은 동안 회복 멈춤 · 패스 최대치 120
- DM 충전 하루 3회(방치 보상 2·4·8시간치), 한국 0시에 다시 채움, 시계를 되돌려도 어제로 안 감
- 노말 1-B를 깨면 켜짐(가득) · 스페셜맵·시험 모드 2단계는 안 씀 · 전투 중 새로 고침 → 다음 실행 때 진 것으로 정리
- 저장 검사: 모양이 틀린 피로도 백업은 거절 · 백업 왕복 · 광고 하루 한도는 자리마다(idle_double 2 · stamina_ad 3)
출격 길 연결(메인 출격 · 결과 화면 단추 · 전투 시작·결과 · 작전 포기)은 2단계에서 검사를 더한다."""
import json

ST = "const ST = await import('/js/engine_v2/stamina_v2.js');"
T0 = "const T0 = Date.parse('2026-11-12T03:00:00Z'), MIN = 60000, HOUR = 3600000;"   # 한국 11-12 낮 12시
S = "const S = await import('/js/engine_v2/stages_v2.js');"
CLEAR_TO_10 = S + """for (const s of S.STAGES) { if (s.id === '1-B') break; progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 60 }; }"""
API = "const backup = await import('/js/engine_v2/progress_v2.js'); const store = await import('/js/engine_v2/saveStore_v2.js');"
PACK = """const pack = value => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ===== 규칙: 회복 =====
    st = g.js(ST + T0 + """const s = ST.emptyStamina(), M = 80;
        ST.turnOn(s, T0, M); const on = s.v;
        const r1 = ST.reserve(s, { stage: '1-1', diff: 'normal' }, T0, M); const a = s.v;
        ST.settle(s, 'win', T0 + MIN, M);
        ST.regen(s, T0 + 5 * MIN + 59000, M); const b5 = s.v;
        ST.regen(s, T0 + 6 * MIN, M); const b6 = s.v;
        ST.regen(s, T0 + 13 * MIN, M); const b13 = s.v;
        ST.regen(s, T0 + 18 * MIN, M); const b18 = s.v;
        const vw = ST.view(s, T0 + 20 * MIN, M);
        ST.regen(s, T0 + 10 * HOUR, M); const full = s.v;
        const e = ST.emptyStamina(); ST.turnOn(e, T0, M); e.v = 0; e.at = T0;
        ST.regen(e, T0 + 8 * HOUR - 1, M); const e8a = e.v; ST.regen(e, T0 + 8 * HOUR, M); const e8 = e.v;
        return { on, r1, a, b5, b6, b13, b18, next: vw.nextMs / MIN, fullIn: vw.fullMs / MIN, full, e8a, e8 };""")
    ctx.check(st['on'] == 80 and st['r1']['cost'] == 6 and st['a'] == 74, '켜지면 가득 80 · 노말 한 판 6을 맡김', str(st))
    ctx.check(st['b5'] == 74 and st['b6'] == 75 and st['b13'] == 76 and st['b18'] == 77, '6분에 +1, 남는 시간은 이어서 셈', str(st))
    ctx.check(st['next'] == 4 and st['fullIn'] == 16 and st['full'] == 80, '다음 1까지 · 가득까지 남은 시간 · 80에서 멈춤', str(st))
    ctx.check(st['e8a'] == 79 and st['e8'] == 80, '0에서 가득까지 8시간 (방치 보상 상한과 같은 주기)', str(st))

    st = g.js(ST + T0 + """const s = ST.emptyStamina(), M = 80;
        ST.turnOn(s, T0, M); ST.reserve(s, { stage: '1-1', diff: 'hell' }, T0, M); ST.settle(s, 'win', T0, M);
        ST.regen(s, T0 + 30 * MIN, M); const a = s.v;
        ST.regen(s, T0 - 24 * HOUR, M); const back = s.v, seen = s.seen - T0;
        ST.regen(s, T0 + 35 * MIN, M); const b35 = s.v;
        ST.regen(s, T0 + 36 * MIN, M); const c = s.v;
        return { a, back, seen: seen / MIN, b: b35, c };""")
    ctx.check(st['a'] == 75 and st['back'] == 75 and st['seen'] == 30 and st['b'] == 75 and st['c'] == 76,
              '시계를 되돌리면 회복 없음 · 본 가장 늦은 시각은 그대로 · 돌아오면 이어서 셈', str(st))

    # ===== 규칙: 맡김·정리 =====
    st = g.js(ST + T0 + """const M = 80;
        const mk = v => { const s = ST.emptyStamina(); ST.turnOn(s, T0, M); s.v = v; s.at = T0; return s; };
        const w = mk(50); ST.reserve(w, { stage: '2-3', diff: 'hard' }, T0, M); const wv = w.v, wp = { ...w.pending };
        const rw = ST.settle(w, 'win', T0 + 2 * MIN, M);
        const l = mk(50); ST.reserve(l, { stage: '2-3', diff: 'hard' }, T0, M); const rl = ST.settle(l, 'lose', T0 + 2 * MIN, M);
        const q = mk(50); ST.reserve(q, { stage: '2-B', diff: 'nightmare' }, T0, M); const rq = ST.settle(q, 'quit', T0 + 10000, M);
        const q2 = mk(50); ST.reserve(q2, { stage: '2-B', diff: 'nightmare' }, T0, M); const rq2 = ST.settle(q2, 'quit', T0 + 10001, M);
        const n = mk(50); const rn = ST.settle(n, 'lose', T0, M);
        const sh = mk(4); sh.at = T0 - 2 * MIN; const rs = ST.reserve(sh, { stage: '1-1', diff: 'normal' }, T0, M);
        const twice = mk(50); ST.reserve(twice, { stage: '1-1', diff: 'normal' }, T0, M); ST.reserve(twice, { stage: '1-2', diff: 'normal' }, T0 + MIN, M);
        return { wv, wp, w: [w.v, rw.used, rw.refund, w.pending], l: [l.v, rl.used, rl.refund], q: [q.v, rq.refund], q2: [q2.v, rq2.used],
            n: [n.v, rn.refund], s: [rs.success, rs.need, rs.have, rs.waitMs / MIN, sh.v, sh.pending], t: [twice.v, twice.pending.stage],
            costs: ['normal', 'hard', 'hell', 'nightmare', 'easy'].map(ST.costOf) };""")
    ctx.check(st['costs'] == [6, 8, 10, 12, 6], '판 비용: 노말 6 · 하드 8 · 헬 10 · 나이트메어 12 (모르는 값은 노말)', str(st['costs']))
    ctx.check(st['wv'] == 42 and st['wp']['cost'] == 8 and st['wp']['stage'] == '2-3' and st['wp']['diff'] == 'hard' and st['w'] == [42, 8, 0, None],
              '이김: 맡긴 8을 확정 · 맡김 기록 지움', str(st))
    ctx.check(st['l'] == [49, 1, 7], '짐·시간 초과: 1만 쓰고 7을 돌려받음', str(st['l']))
    ctx.check(st['q'] == [50, 12] and st['q2'] == [49, 1], '작전 포기: 10초 안이면 전부, 그 뒤면 진 것과 같음', str(st))
    ctx.check(st['n'] == [50, 0], '맡긴 판이 없으면 정리해도 그대로', str(st['n']))
    ctx.check(st['s'] == [False, 6, 4, 10, 4, None], '모자라면 출격 안 됨 · 6까지 기다릴 시간 10분 · 값 그대로', str(st['s']))
    ctx.check(st['t'] == [43, '1-2'], '앞 판이 정리 안 된 채 또 출격하면 앞 판은 진 것으로 정리', str(st['t']))

    # ===== 규칙: 넘침·패스 =====
    st = g.js(ST + T0 + """const M = 80;
        const mk = v => { const s = ST.emptyStamina(); ST.turnOn(s, T0, M); s.v = v; s.at = T0; return s; };
        const o = mk(78); const add = ST.addOver(o, 30, T0, M); const o1 = o.v;
        ST.regen(o, T0 + HOUR, M); const o2 = o.v;
        const big = ST.addOver(o, 2000, T0 + HOUR, M);
        const rf = mk(80); ST.reserve(rf, { stage: '1-1', diff: 'normal' }, T0, M); ST.regen(rf, T0 + 6 * MIN, M); const mid = rf.v;
        const rr = ST.settle(rf, 'lose', T0 + 6 * MIN, M);
        const p = mk(80); const P = ST.maxOf(true); ST.regen(p, T0 + HOUR, P); const p1 = p.v; ST.regen(p, T0 + 5 * HOUR, P); const p2 = p.v;
        ST.regen(p, T0 + 6 * HOUR, M); const p3 = p.v;
        return { add, o1, o2, big, o3: o.v, mid, rr: [rf.v, rr.refund], P, p1, p2, p3 };""")
    ctx.check(st['add'] == 30 and st['o1'] == 108 and st['o2'] == 108, '충전은 최대치를 넘어 쌓임 · 넘은 동안 시간 회복 멈춤', str(st))
    ctx.check(st['big'] == 891 and st['o3'] == 999, '넘침 한도 999', str(st))
    ctx.check(st['mid'] == 75 and st['rr'] == [80, 5], '전투 중 찬 양 + 돌려받은 양', str(st))
    ctx.check(st['P'] == 120 and st['p1'] == 90 and st['p2'] == 120 and st['p3'] == 120,
              '주간 패스 기간 최대치 120 · 패스가 끝나면 넘친 채 회복만 멈춤', str(st))

    # ===== 규칙: DM 충전 하루 3회 · 한국 0시 =====
    st = g.js(ST + T0 + """const KST0 = Date.parse('2026-11-12T15:00:00Z');   // 한국 11-13 0시
        const s = ST.emptyStamina(); ST.turnOn(s, T0, 80);
        const prices = [];
        for (let i = 0; i < 3; i++) { prices.push(ST.buyPrice(s, T0, 1234)); ST.markBuy(s, T0); }
        const done = [ST.buyLeft(s, KST0 - 1000), ST.buyPrice(s, KST0 - 1000, 1234)];
        const next = ST.buyLeft(s, KST0);
        ST.markBuy(s, KST0);
        const back = ST.buyLeft(s, T0);
        const low = ST.buyPrice(ST.emptyStamina(), T0, 10);
        return { prices, done, next, back, day: s.buy.day, low };""")
    ctx.check(st['prices'] == [2470, 4940, 9880], 'DM 충전 값: 방치 보상 시간당 1,234 DM × 2·4·8시간 (10 DM 단위 올림)', str(st))
    ctx.check(st['done'] == [0, None] and st['next'] == 3 and st['low'] == 100, '하루 3회 · 한국 0시에 다시 채움 · 가장 싼 값 100 DM', str(st))
    ctx.check(st['back'] == 2 and st['day'] == '2026-11-13', '시계를 어제로 되돌려도 오늘 횟수 그대로', str(st))

    # ===== 저장 검사 =====
    st = g.js(ST + T0 + """const good = ST.emptyStamina(); ST.turnOn(good, T0, 80);
        ST.reserve(good, { stage: '3-7', diff: 'hard' }, T0, 80); ST.markBuy(good, T0);
        const ok = v => { try { ST.validateStamina(v); return true; } catch (e) { return false; } };
        const bad = [{ ...good, v: 1000 }, { ...good, v: -1 }, { ...good, v: 1.5 }, { ...good, extra: 1 }, { ...good, at: good.seen + 1 },
            { ...good, on: false }, { ...good, on: 'yes' }, { ...good, pending: { ...good.pending, diff: 'easy' } },
            { ...good, pending: { ...good.pending, cost: 0 } }, { ...good, pending: { ...good.pending, t: good.seen + 1 } },
            { ...good, buy: { day: null, n: 1 } }, { ...good, buy: { day: '2026-11-12', n: 4 } }, { ...good, buy: { day: '2099-01-01', n: 1 } },
            { ...good, buy: { day: '2026-13-01', n: 1 } }, null, []];
        return { good: ok(good), empty: ok(ST.emptyStamina()), bad: bad.map(ok) };""")
    ctx.check(st['good'] and st['empty'] and not any(st['bad']), '피로도 저장 모양 검사 (값 범위·시각 순서·맡김·DM 충전 횟수)', str(st))

    st = g.js(API + T0 + """const day = '2026-11-12';
        const base = { ...JSON.parse(JSON.stringify(progress.commerce)), lastSeenAt: T0 };
        const ok = c => { try { return store.validateCommerce(c, false); } catch (e) { return false; } };
        return { left: progress.adQuotaRemaining('stamina_ad'), idle: progress.adQuotaRemaining('idle_double'),
            s3: ok({ ...base, dailyAds: { dayKey: day, counts: { stamina_ad: 3, idle_double: 2 } } }),
            s4: ok({ ...base, dailyAds: { dayKey: day, counts: { stamina_ad: 4 } } }),
            i3: ok({ ...base, dailyAds: { dayKey: day, counts: { idle_double: 3 } } }) };""")
    ctx.check(st['left'] == 3 and st['idle'] == 2 and st['s3'] and not st['s4'] and not st['i3'],
              '광고 하루 한도는 자리마다 (방치 2배 2 · 피로도 충전 3) — 저장 검사의 최대 2 고정을 고침', str(st))

    # ===== 진행: 켜지기 전 =====
    st = g.js(S + """const s = S.stageById('1-1');
        return { on: progress.stamina.on, check: progress.staminaCheck(s, 'normal'), res: progress.reserveStamina(s, 'normal'),
            pending: progress.stamina.pending, saved: JSON.parse(localStorage.getItem('mo_v2_save')).stamina };""")
    ctx.check(not st['on'] and st['check'] == {'ok': True, 'cost': 0} and st['res']['cost'] == 0 and st['pending'] is None,
              '노말 1-B 전에는 피로도 없이 출격 (튜토리얼 11판)', str(st))
    ctx.check(st['saved'] and st['saved']['on'] is False and st['saved']['v'] == 0, '저장에 피로도 필드 (꺼진 상태)', str(st['saved']))

    # ===== 진행: 노말 1-B를 처음 깨면 켜짐 =====
    st = g.js(CLEAR_TO_10 + """const before = progress.stamina.on;
        progress.recordStage('1-10', { stars: [true, true, true], cleared: true, time: 60 }, 'normal');
        const after10 = progress.stamina.on;
        progress.recordStage('1-B', { stars: [true, true, true], cleared: true, time: 60 }, 'hard');
        const afterHard = progress.stamina.on;
        progress.recordStage('1-B', { stars: [true, true, true], cleared: true, time: 60 }, 'normal');
        const v = progress.staminaView();
        return { before, after10, afterHard, on: v.on, v: v.v, max: v.max, just: progress.staminaJustOn === true };""")
    ctx.check(not st['before'] and not st['after10'] and not st['afterHard'] and st['on'] and st['v'] == 80 and st['max'] == 80 and st['just'],
              '노말 1-B를 처음 깨면 켜지고 가득 80 (하드 1-B로는 안 켜짐) · 처음 안내 표시', str(st))

    # ===== 진행: 맡김 → 전투 중 새로 고침 → 다음 실행 때 진 것으로 정리 =====
    st = g.js(S + """const s = S.stageById('1-5');
        const c = progress.staminaCheck(s, 'normal');
        const r = progress.reserveStamina(s, 'normal');
        const saved = JSON.parse(localStorage.getItem('mo_v2_save')).stamina;
        const sp = progress.staminaCheck({ id: 'SP-boss-1', special: 'boss' }, 'normal');
        const spr = progress.reserveStamina({ id: 'SP-tower-3', special: 'tower' }, 'hard');
        return { c, r, v: progress.stamina.v, saved: saved.pending, sp, spr, hard: progress.staminaCost('hard') };""")
    ctx.check(st['c']['ok'] and st['c']['cost'] == 6 and st['r']['success'] and st['r']['cost'] == 6 and st['v'] == 74
              and st['saved'] and st['saved']['cost'] == 6 and st['saved']['stage'] == '1-5' and st['saved']['diff'] == 'normal',
              '보통 판 출격: 6을 맡기고 맡긴 판을 바로 저장', str(st))
    ctx.check(st['sp'] == {'ok': True, 'cost': 0} and st['spr']['cost'] == 0 and st['hard'] == 8, '스페셜맵·탑은 피로도를 안 씀', str(st))
    g.reload_v2()
    st = g.js("return { v: progress.stamina.v, pending: progress.stamina.pending, stale: progress.staminaStale };")
    ctx.check(st['v'] == 79 and st['pending'] is None and st['stale'] and st['stale']['refund'] == 5 and st['stale']['used'] == 1,
              '전투 중 꺼지면 다음 실행 때 진 것으로 정리 (1만 쓰고 5 돌려받음)', str(st))

    # ===== 진행: 이김·짐 정리 =====
    st = g.js(S + """const s = S.stageById('1-3');
        progress.reserveStamina(s, 'normal'); const w = progress.settleStamina('win'); const v1 = progress.stamina.v;
        progress.reserveStamina(s, 'normal'); const l = progress.settleStamina('lose'); const v2 = progress.stamina.v;
        const none = progress.settleStamina('lose');
        return { w, v1, l, v2, none, saved: JSON.parse(localStorage.getItem('mo_v2_save')).stamina.v };""")
    ctx.check(st['v1'] == 73 and st['w']['used'] == 6 and st['v2'] == 72 and st['l']['refund'] == 5 and st['none']['refund'] == 0 and st['saved'] == 72,
              '이기면 6 확정 · 지면 1만 씀 · 정리 결과 바로 저장', str(st))

    # ===== 진행: DM 충전 =====
    st = g.js("""gameState.darkMatter = 1000000;
        const rate = progress.staminaRatePerHour(), prices = [], adds = [];
        for (let i = 0; i < 3; i++) { const r = progress.buyStamina(); prices.push(r.price); adds.push(r.added); }
        const fourth = progress.buyStamina();
        return { rate, prices, adds, v: progress.stamina.v, dm: gameState.darkMatter, fourth, left: progress.staminaBuyLeft() };""")
    want = [max(100, -(-st['rate'] * h // 10) * 10) for h in (2, 4, 8)]
    ctx.check(st['prices'] == want and st['adds'] == [40, 40, 40] and st['v'] == 192 and st['dm'] == 1000000 - sum(want),
              'DM으로 +40 × 3 (방치 보상 2·4·8시간치 DM을 냄) · 최대치를 넘어 쌓임', str(st))
    ctx.check(not st['fourth']['success'] and st['left'] == 0, '네 번째 DM 충전은 안 됨', str(st['fourth']))
    st = g.js("""gameState.darkMatter = 10; progress.stamina.buy = { day: null, n: 0 };
        const r = progress.buyStamina(); return { r, dm: gameState.darkMatter, v: progress.stamina.v };""")
    ctx.check(not st['r']['success'] and st['dm'] == 10 and st['v'] == 192, 'DM이 모자라면 충전 안 됨', str(st))

    # ===== 백업: 왕복 · 모양이 틀린 피로도 거절 =====
    st = g.js(API + PACK + """progress.stamina.v = 123; progress.save();
        const code = backup.exportSave();
        const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.split(':')[1]), c => c.charCodeAt(0)))).entries;
        const data = JSON.parse(entries.mo_v2_save);
        const bad = pack({ entries: { ...entries, mo_v2_save: JSON.stringify({ ...data, stamina: { ...data.stamina, v: 5000 } }) } });
        const snapshot = JSON.stringify({ ...localStorage });
        const r = backup.importSave(bad);
        const same = JSON.stringify({ ...localStorage }) === snapshot;
        progress.stamina.v = 3; progress.save();
        return { code, inCode: data.stamina.v, rejected: !r.success && /피로도/.test(r.reason || ''), same };""")
    ctx.check(st['inCode'] == 123 and st['rejected'] and st['same'], '백업 코드에 피로도 포함 · 모양이 틀린 피로도 백업은 거절(저장 그대로)', str({k: v for k, v in st.items() if k != 'code'}))
    with g.page.expect_navigation():
        g.js(API + f'backup.importSave({json.dumps(st["code"])});')
    g.enter_v2()
    st = g.js("return { v: progress.stamina.v, on: progress.stamina.on };")
    ctx.check(st['v'] == 123 and st['on'], '백업을 불러오면 피로도도 돌아옴', str(st))

    # ===== 시험 모드 2단계: 피로도 안 씀 =====
    st = g.js(S + """const s = S.stageById('1-5'); const v0 = progress.stamina.v;
        progress.unlockEverythingTemp();
        const r = progress.reserveStamina(s, 'normal');
        return { exempt: progress.staminaExempt(), cost: r.cost, same: progress.stamina.v === v0, pending: progress.stamina.pending,
            check: progress.staminaCheck(s, 'nightmare') };""")
    ctx.check(st['exempt'] and st['cost'] == 0 and st['same'] and st['pending'] is None and st['check']['cost'] == 0,
              '시험 모드 2단계(저장이 남지 않는 시험)에서는 피로도를 안 씀', str(st))
