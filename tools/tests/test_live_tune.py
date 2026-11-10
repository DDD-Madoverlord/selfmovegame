"""밸런스 조절 (시험용, D-127): 공격력·원거리/근거리 배율·적 세기를 게임하면서 바로 바꿈.
- 기본값이면 아무 영향 없음 · 탭은 숨어 있다가 시험 모드(왼쪽 위 아이콘 5번)·?tune=1·값이 바뀌어 있으면 보임
- 캐릭터별·전체 공격력 → 연구소 능력치(statsFor)와 전투가 같은 값, 전투 중에 바꾸면 그 자리에서 다시 계산
- 원거리 배율(공격력·이동·받는 피해) → tuning.js ROLE, 적 체력·공격력 → 새로 나오는 적부터
- 이 기기에만 저장(다시 켜도 남음, 저장 백업에는 안 들어감), 모두 기본값, 값 복사 글"""

LASER = ('head_mech', 'body_mech', 'arm_mech_laser', 'leg_mech_wheel')
T = "const LT = (await import('/js/engine_v2/liveTune_v2.js')).liveTune;"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(T + """const R = (await import('/js/engine_v2/battle/tuning.js')).ROLE;
        return { mod: LT.isModified(), on: LT.isEnabled(), tab: document.querySelector('.v2-tunetab')?.hidden, ranged: R.ranged, atk: LT.attackMul('mech') };""")
    ctx.check(not st['mod'] and not st['on'] and st['tab'] is True and st['atk'] == 1 and st['ranged']['move'] == 0.5,
              '처음엔 기본값(영향 없음) · 왼쪽 탭 숨김', str(st))

    # 시험 모드(아이콘 5번)로 탭이 보임
    g.js("const e = document.querySelector('.v2-brand__emblem'); for (let i = 0; i < 5; i++) e.click();")
    g.wait(300)
    st = g.js("const t = document.querySelector('.v2-tunetab'); return { hidden: t.hidden, text: t.textContent };")
    ctx.check(not st['hidden'] and '밸런스' in st['text'], "시험 모드를 켜면 왼쪽 가장자리 '⚖ 밸런스' 탭", str(st))

    # 연구소 능력치: 캐릭터별·전체 공격력, 원거리 공격력
    g.equip(LASER)
    st = g.js(T + """const s0 = progress.equippedStats().dps;
        LT.set('charAtk.mech', 1.5); const s1 = progress.equippedStats().dps;
        LT.set('charAtk.kaiju', 2); const s2 = progress.equippedStats().dps;
        LT.set('playerAtk', 2); const s3 = progress.equippedStats().dps;
        LT.set('role.ranged.dps', 1.7); const s4 = progress.equippedStats().dps;   // 0.85 → 1.7 = 2배
        LT.set('role.ranged.move', 1); const sp = progress.equippedStats().speed;
        LT.reset(); const back = progress.equippedStats().dps;
        return { s0, r1: s1 / s0, r2: s2 / s0, r3: s3 / s0, r4: s4 / s3, sp, back, mod: LT.isModified() };""")
    ctx.check(abs(st['r1'] - 1.5) < 0.01 and abs(st['r2'] - 1.5) < 0.01 and abs(st['r3'] - 3) < 0.01 and abs(st['r4'] - 2) < 0.01,
              '공격력: 거대로봇 ×1.5(다른 캐릭터 값은 영향 없음) × 전체 ×2, 원거리 공격력 0.85 → 1.7이면 2배', str(st))
    ctx.check(st['back'] == st['s0'] and not st['mod'], "'모두 기본값'이면 원래 능력치", str(st))

    # 전투 중에 바꾸면 그 자리에서
    g.battle(LASER, wait_ms=2500)
    st = g.js(T + """const d0 = b.playerDps, sp0 = b.playerSpeed, tk0 = b.roleTaken;
        LT.set('charAtk.mech', 2); const d1 = b.playerDps;
        LT.set('role.ranged.move', 1); const sp1 = b.playerSpeed;
        LT.set('role.ranged.taken', 1); const tk1 = b.roleTaken;
        const h0 = b.stage.enemy.hp; LT.set('enemyHp', 2); const h1 = b.stage.enemy.hp;
        const e = b.spawnMinion('guard', { x: b.monsterX + 600 }); const eh = e.maxHp;
        LT.set('enemyHp', 1); const e2 = b.spawnMinion('guard', { x: b.monsterX + 650 });
        return { r: d1 / d0, sp0, sp1, tk0, tk1, hr: h1 / h0, er: eh / e2.maxHp, status: null };""")
    ctx.check(abs(st['r'] - 2) < 0.01 and abs(st['sp1'] / st['sp0'] - 2) < 0.05 and abs(st['tk0'] - 1.2) < 1e-9 and st['tk1'] == 1,
              '전투 중: 공격력 ×2 · 원거리 이동 0.5 → 1(2배) · 받는 피해 1.2 → 1이 바로 붙음', str(st))
    ctx.check(abs(st['hr'] - 2) < 1e-6 and abs(st['er'] - 2) < 0.01, '적 체력 ×2 → 새로 나오는 적 체력 2배 (되돌리면 원래)', str(st))

    # 패널: 슬라이더를 움직이면 값·표시가 바뀜, 전투 중 상태 줄
    g.js("document.querySelector('.v2-tunetab').click();")
    g.wait(400)
    st = g.js("""const p = document.querySelector('.v2-tune'); const inp = p.querySelector('input[data-path="role.ranged.dps"]');
        inp.value = '1.2'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        const row = inp.closest('.v2-tune__row');
        return { rows: p.querySelectorAll('.v2-tune__row').length, val: row.querySelector('.v2-tune__val').textContent, changed: row.classList.contains('is-changed'),
            status: p.querySelector('.v2-tune__status').textContent, copy: p.querySelector('[data-act=copy]').textContent,
            tab: document.querySelector('.v2-tunetab').textContent };""")
    ctx.check(st['rows'] == 22 and st['val'] == '×1.20' and st['changed'] and '조절 중' in st['tab'] and '4개 바뀜' in st['copy'],
              '패널 22줄(전체 1 · 캐릭터 10 · 유형 9 · 적 2) · 슬라이더로 원거리 공격력 ×1.20 · 탭이 빨간 조절 중', str(st))
    ctx.check('전투 중' in st['status'] and '원거리' in st['status'] and '공격력' in st['status'], '전투 중에는 지금 공격력·이동·받는 피해 한 줄', st['status'])
    g.shot('live_tune_panel')
    st = g.js("""const { tuneText } = await import('/js/ui_v2/tunePanel_v2.js'); return tuneText();""")
    ctx.check('원거리 공격력: ×0.85 → ×1.20' in st and '거대로봇 공격력: ×1.00 → ×2.00' in st, '값 복사 글: 바뀐 값만 기본 → 지금', st)
    g.js("b.stopBattle(); window.madOverlordGameV2.switchScreen('menu');")

    # 다시 켜도 남음 · 저장 백업에는 안 들어감
    g.reload_v2()
    st = g.js(T + """const backup = await import('/js/engine_v2/saveStore_v2.js');
        const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
        const R = (await import('/js/engine_v2/battle/tuning.js')).ROLE;
        return { v: LT.valueOf('role.ranged.dps'), role: R.ranged.dps, mech: LT.valueOf('charAtk.mech'), tab: document.querySelector('.v2-tunetab').hidden,
            inBackup: Object.keys(entries).some(k => k.includes('tune')) };""")
    ctx.check(st['v'] == 1.2 and st['role'] == 1.2 and st['mech'] == 2 and st['tab'] is False and not st['inBackup'],
              '다시 켜도 값이 남고 탭도 보임 · 저장 백업에는 안 들어감', str(st))

    # 모두 기본값 → 탭 숨기기
    g.js("document.querySelector('.v2-tunetab').click();")
    g.wait(300)
    g.js("document.querySelector('.v2-tune [data-act=resetAll]').click();")
    g.wait(200)
    st = g.js(T + """const hide = document.querySelector('.v2-tune [data-act=hide]'); const had = !!hide; hide && hide.click();
        return { mod: LT.isModified(), had, tab: document.querySelector('.v2-tunetab').hidden, panel: !!document.querySelector('.v2-tune')?.isConnected };""")
    ctx.check(not st['mod'] and st['had'] and st['tab'] and not st['panel'], "'모두 기본값' 뒤 '탭 숨기기' → 탭 사라짐", str(st))
