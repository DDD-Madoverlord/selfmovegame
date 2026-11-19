"""스킬 이펙트 버그 (11-19 영상 — 뒤틀린 인형사 레전더리 ② 태엽 시계탑의 마녀 4부위 + 자동 스킬) 회귀 검사
- 자정의 종 12번째 폭발: 이펙트가 { layers } 로 감싸지지 않은 한 층이라 fx.play 오류 → 전투 루프가 죽어 게임이 멈춤
  → 데이터 고침 + 모든 부품 스킬에 감싸지 않은 이펙트가 없는지 검사 + fx.play가 한 층도 받아 멈추지 않음
- 4부위 "시간 되감기가 몸통 스킬도 초기화": 시간 되감기가 곧 몸통 스킬이라 자기 쿨다운을 0으로 → 자동이면 0.5초마다 끝없이 다시 씀
  (되감기 이펙트가 몸을 늘 덮고, 팔 쿨다운도 매번 0이라 시계바늘 회전이 5~6겹) → 4부위는 시간 되감기 쿨다운 절반"""

CLOCK = ('head_doll_m', 'body_doll_m', 'arm_doll_m', 'leg_doll_m')
CLEAN = ("b.spawnInterval = 999; b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom?.remove());"
         "b.enemies = b.enemies.filter(e => e.isBuilding); b.playerSpeed = 0;")
COUNT_USES = ("window.__uses = { arm: 0, body: 0 };"
              "for (const slot of ['arm', 'body']) { const sk = b.skills[slot], o = sk.use;"
              " sk.use = function () { window.__uses[slot]++; return o.apply(this, arguments); }; }")


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- 모든 부품 스킬·기본 공격·패시브: 이펙트는 { layers } 정의 (한 층만 넣은 것 없음) ----
    st = g.js("""const { SKILLS } = await import('/js/engine_v2/skills_v2.js');
        const { V2_PARTS } = await import('/js/engine_v2/partsExtra_v2.js');
        const { KIT_PASSIVES } = await import('/js/engine_v2/skillKit_v2.js');
        const bad = [], seen = new Set();
        const okRaw = p => /\\.lob\\.sprite$/.test(p);   // rain 단계 lob.sprite는 일부러 한 층 (skillKit_v2.js)
        function walk(v, path) {
            if (!v || typeof v !== 'object' || seen.has(v)) return;
            seen.add(v);
            if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
            if (typeof v.type === 'string' && !okRaw(path)) bad.push(`${path} (${v.type}${v.sheet ? ' ' + v.sheet : ''})`);
            for (const [k, x] of Object.entries(v)) if (k !== 'layers') walk(x, `${path}.${k}`);
        }
        let n = 0;
        for (const [id, sk] of Object.entries(SKILLS)) if (sk.kit) { n++; walk(sk.steps, `${id}.steps`); }
        for (const p of Object.values(V2_PARTS).flat()) if (p.kitAttack) walk(p.kitAttack, `${p.id}.kitAttack`);
        for (const [id, ps] of Object.entries(KIT_PASSIVES)) walk(ps, `${id}.passive`);
        return { n, bad };""")
    ctx.check(st['n'] > 200 and not st['bad'],
              f"부품 스킬 {st['n']}개: 단계 이펙트가 모두 {{ layers }} 정의 (한 층만 넣으면 fx.play 오류로 전투가 멈춤)", str(st['bad'][:5]))

    # ---- 시간 되감기 4부위: 끝없이 다시 쓰지 않음, 쿨다운 절반 ----
    g.js("progress.selectedStage = '1-1';")
    g.battle(CLOCK, wait_ms=2900)
    g.wait(2900)   # 출격 인트로
    g.js(CLEAN)
    g.place_enemies(n=3, gap=50, first=120, hp=9000000, speed=0, dps=0)
    st = g.js(COUNT_USES + """gameTime.speed = 1; b.ultGauge = 0; b.skillCd.arm = 0; b.skillCd.body = 0; b.setAutoSkills(true);
        await new Promise(r => setTimeout(r, 1000));
        const cd1 = b.skillCd.body;
        await new Promise(r => setTimeout(r, 3000));
        const zones = b.kitZones.filter(z => z.dps).length;
        b.setAutoSkills(false);
        return { set4: b.kitFlag('rewindBody'), uses: { ...window.__uses }, cd1: +cd1.toFixed(2), cd: +b.skillCd.body.toFixed(2), zones };""")
    ctx.check(st['set4'], '태엽 시계탑의 마녀 4부위가 켜짐 (rewindBody)', str(st))
    ctx.check(st['uses']['body'] == 1, '자동 스킬 4초: 시간 되감기 1번만 (예전엔 0.5초마다 다시 써 8번쯤)', str(st))
    ctx.check(6.5 <= st['cd1'] <= 8.0 and st['cd'] > 3.5, '4부위: 시간 되감기 쿨다운 절반 (16 → 약 8초, 1초 뒤 약 7.3초 남음)', str(st))
    ctx.check(st['uses']['arm'] <= 2 and st['zones'] <= 1,
              '시계바늘 회전: 되감기로 한 번 초기화될 뿐 겹겹이 쌓이지 않음 (예전엔 장판 5~6개)', str(st))

    # ---- 자정의 종: 12번째 큰 폭발에서 오류 없음, 전투가 계속 흐름 ----
    st = g.js("""const es = b.enemies.filter(e => !e.isBuilding);
        b.skillCd.arm = 99; b.skillCd.body = 99; b.ultGauge = 1;
        const t0 = b.stats.time;
        const used = b.useSkill('head');
        gameTime.speed = 4;
        // 게임 시간 12.6초까지 (시전 0.45초 + 폭발 11.6초) — 루프가 죽으면 시간이 멈추므로 실제 8초에서 끊음
        for (let i = 0; i < 80 && b.stats.time - t0 < 12.6; i++) await new Promise(r => setTimeout(r, 100));
        const t1 = b.stats.time;
        await new Promise(r => setTimeout(r, 400));
        gameTime.speed = 1;
        return { used, active: b.isActive, el: +(t1 - t0).toFixed(1), moved: +(b.stats.time - t1).toFixed(2), hit: es.every(e => e.hp < e.maxHp) };""")
    ctx.check(st['used'] and st['el'] >= 12.6 and st['hit'], '자정의 종: 12초 동안 종 12번 + 마지막 폭발까지 끝남 (사거리 안 적 모두 맞음)', str(st))
    ctx.check(st['active'] and st['moved'] > 0.5, '자정의 종 폭발 뒤에도 전투 시간이 계속 흐름 (예전엔 오류로 루프가 죽어 게임 정지)', str(st))
    g.shot('skillfx1119_midnight', '#screen-battle-v2')

    # ---- fx.play: 한 층만 넘겨도 오류 없이 그림 (데이터 실수로 전투가 멈추지 않게) — 대신 콘솔 오류 한 번 ----
    st = g.js("""let ok = true;
        try { b.fx.play({ type: 'flash', at: 0, dur: 0.1, r: 20, color: '255, 255, 255' }, 200, 100); b.fx.play(null, 0, 0); } catch (e) { ok = false; }
        return { ok, active: b.isActive };""")
    ctx.check(st['ok'] and st['active'], 'fx.play: { layers } 없이 한 층만 넘겨도(또는 빈 값) 예외 없이 지나감', str(st))
    raw = [e for e in g.errors if '{ layers } 없는 이펙트 정의' in e]
    ctx.check(len(raw) == 1, '한 층만 넘긴 이펙트는 콘솔 오류로 한 번 알림 (실수를 숨기지 않음)', str(raw))
    g.errors = [e for e in g.errors if '{ layers } 없는 이펙트 정의' not in e]
