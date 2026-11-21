"""회의 후속 값 적용 (2026-11-21, D-154 · D-156 · MD/회의후속_작업계획_20261121.md):
⑤ 다리 이동 속도 = 등급 표(50 / 80 / 120 / 150) · ⑦ 상위 등급 파츠 시작 레벨(레어 3 · 유니크 5 · 레전더리 6)
⑩ 엘리트 속성(노말 1 · 하드 1 + 받는 피해 −10% · 헬 2~3 · 나이트메어 3 + 효과 ×1.25)
① 출시 범위(캐릭터 4 · 구역 1~4, 구역 5 · 6과 길잡이 · 성녀는 숨김) · 난이도 해금 4-B · 후발 캐릭터 공격력 · 체력 +5%"""
import time

REC = "{ stars: [true, true, true], cleared: true, bestTime: 100 }"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- ⑤ 다리 속도 ----
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const { minGradeOf } = await import('/js/engine_v2/sets_v2.js');
        const G = await import('/js/engine_v2/growth_v2.js');
        const want = Object.fromEntries(G.GRADES.map(g => [g.id, g.legSpeed]));
        const legs = PARTS_DB.leg.filter(p => p.id !== 'none' && p.stats);
        const bad = legs.filter(p => p.stats.speed !== want[minGradeOf(p)]).map(p => p.id + ':' + p.stats.speed);
        const by = {}; legs.forEach(p => { by[minGradeOf(p)] = (by[minGradeOf(p)] || 0) + 1; });
        const leg = PARTS_DB.leg.find(p => p.id === 'leg_red_robot');
        const s0 = progress.partStats(leg).speed;
        progress.grades[leg.id] = 'rare'; const s1 = progress.partStats(leg).speed;
        progress.grades[leg.id] = 'legendary'; const s2 = progress.partStats(leg).speed;
        delete progress.grades[leg.id];
        const arm = PARTS_DB.arm.find(p => p.id === 'arm_red_robot');
        progress.grades[arm.id] = 'legendary'; const armSpeed = [arm.stats.speed, progress.partStats(arm).speed]; delete progress.grades[arm.id];
        return { want, n: legs.length, bad, by, up: [s0, s1, s2], armSpeed, base: progress.equippedStats().speed };""")
    # 묶음 B (D-158): 다리 기준 100 → 140 — 회의 비율 0.5 / 0.8 / 1.2 / 1.5 그대로
    ctx.check(st['want'] == {'common': 70, 'rare': 112, 'unique': 168, 'legendary': 210} and st['n'] >= 90 and not st['bad'],
              f"다리 속도: 다리 {st['n']}개 모두 등급 표 값 (커먼 70 · 레어 112 · 유니크 168 · 레전더리 210)", str((st['bad'][:5], st['by'])))
    ctx.check(st['up'] == [70, 112, 210] and st['armSpeed'][0] == st['armSpeed'][1],
              '다리 등급을 올리면 속도도 그 등급 값 (커먼 70 → 레어 112 → 레전더리 210), 다른 부위 속도는 등급과 무관', str(st))
    ctx.check(st['base'] == 143, '기본 로봇(근거리): (10 + 5 + 10 + 70) × 1.5 = 143 (11-21 전과 같음)', str(st['base']))

    # ---- ⑦ 시작 레벨 ----
    st = g.js("""const { PARTS_DB } = await import('/js/data/parts.js');
        const lv = id => progress.levelOf(id);
        const out = { lv: ['arm_mutant', 'arm_kaiju_a', 'arm_kaiju_u', 'arm_kaiju_l'].map(lv) };
        // 같은 기본 능력치로 견줌: 이전 등급 한도까지 키운 것 대 새 등급 시작 값
        const k = (grade, level) => { const id = 'arm_mutant'; progress.grades[id] = grade; progress.levels[id] = level;
            const v = progress.partStats(PARTS_DB.arm.find(p => p.id === id)).dps; delete progress.grades[id]; delete progress.levels[id]; return v; };
        out.ratio = [k('rare', 1) / k('common', 5), k('unique', 1) / k('rare', 7), k('legendary', 1) / k('unique', 9)].map(v => Math.round(v * 100) / 100);
        progress.owned.add('arm_kaiju_a'); gameState.darkMatter = 1e7;
        progress.levels.arm_kaiju_a = 2;                       // 예전 저장: Lv2 → 시작 레벨 3으로 올라가 보임
        out.old = lv('arm_kaiju_a');
        const max0 = progress.maxLevel; progress.maxLevel = () => 14;
        const up = progress.upgrade('arm_kaiju_a');
        out.up = [up.success, up.level, progress.levels.arm_kaiju_a];
        progress.levels.arm_kaiju_a = 7; out.kept = lv('arm_kaiju_a');   // 더 키운 레벨은 그대로
        progress.maxLevel = max0;
        return out;""")
    ctx.check(st['lv'] == [1, 3, 5, 6], '시작 레벨: 커먼 1 · 레어 세트 3 · 유니크 세트 5 · 레전더리 세트 6', str(st['lv']))
    ctx.check(all(0.9 <= r <= 0.95 for r in st['ratio']),
              '상위 등급 새 파츠 = 이전 등급을 한도까지 키운 것의 92~94% (예전 Lv1 시작은 74 · 63 · 57%)', str(st['ratio']))
    ctx.check(st['old'] == 3 and st['up'] == [True, 4, 4] and st['kept'] == 7, '예전 저장의 낮은 레벨도 시작 레벨로 · 강화하면 그다음 레벨 · 더 키운 레벨은 그대로', str(st))

    # ---- ⑩ 엘리트 속성 ----
    st = g.js("""const D = await import('/js/engine_v2/difficulty_v2.js'); const S = await import('/js/engine_v2/stages_v2.js');
        const E = await import('/js/engine_v2/enemies_v2.js');
        const s = S.stageById('3-1');
        const of = d => D.stageFor(s, d);
        return { counts: ['hard', 'hell', 'nightmare'].map(d => of(d).affixCount), normal: of('normal').affixCount ?? null,
            armor: ['hard', 'hell', 'nightmare'].map(d => of(d).eliteArmor), power: ['hard', 'hell', 'nightmare'].map(d => of(d).affixPower),
            swift: [E.eliteAffix('swift', 1).speedMul, E.eliteAffix('swift', 1.25).speedMul, E.eliteAffix('swift', 1.25).dpsMul],
            vals: [E.eliteAffix('shielded', 1.25).shield, E.eliteAffix('iron', 1.25).cut, E.eliteAffix('regen', 1.25).rate, E.eliteAffix('regen', 1.25).delay,
                E.eliteAffix('toxic', 1.25).sec, E.eliteAffix('toxic', 1.25).width, E.eliteAffix('volatile', 1.25).dmg, E.eliteAffix('frost', 1.25).slow],
            same: E.eliteAffix('iron', 1) === E.ELITE_AFFIXES.iron };""")
    ctx.check(st['counts'] == [[1, 1], [2, 3], [3, 3]] and st['normal'] is None and st['armor'] == [0.1, 0, 0] and st['power'] == [1, 1, 1.25],
              '난이도 표: 하드 1개 + 받는 피해 −10% · 헬 2~3개 · 나이트메어 3개 + 효과 ×1.25 (노말은 원래 스테이지 = 1개)', str(st))
    ctx.check(st['swift'][0] == 1.6 and abs(st['swift'][1] - 1.75) < 1e-9 and abs(st['swift'][2] - 1.1875) < 1e-9
              and [round(v, 4) for v in st['vals']] == [0.5, 0.25, 0.0375, 2, 5, 120, 0.05, 1.875] and st['same'],
              '속성 효과 ×1.25: 가속 1.6 → 1.75 · 보호막 40 → 50% · 강철 20 → 25% · 재생 · 독 · 폭발 · 서리 (지연 · 폭은 그대로)', str(st))

    def elites(stage, diff, n=60, kind='guard'):
        g.js(f"progress.difficulty = '{diff}'; progress.selectStage('{stage}'); window.madOverlordGameV2.startStage ? 0 : 0;")
        g.js(f"""const S = await import('/js/engine_v2/stages_v2.js'); const D = await import('/js/engine_v2/difficulty_v2.js');
            for (const d of ['normal', 'hard', 'hell', 'nightmare']) for (const s of S.STAGES) progress.recordsOf(d)[s.id] = {REC};
            progress.difficulty = '{diff}'; progress.selectStage('{stage}');""")
        g.battle('mech', wait_ms=2200)
        out = g.js(f"""b.spawnInterval = 999;
            const es = Array.from({{ length: {n} }}, () => b.spawnMinion('{kind}', {{ x: 1100, elite: true }}));
            const plain = b.spawnMinion('{kind}', {{ x: 1100, elite: false }});
            const sw = b.spawnMinion('guard', {{ x: 1100, elite: false }});
            const r = {{ diff: b.difficulty, stage: b.stage.id, counts: [...new Set(es.map(e => e.affixes.length))].sort(), uniq: es.every(e => new Set(e.affixes).size === e.affixes.length),
                armor: es[0].armor, plainArmor: plain.armor, typeArmor: plain.t.armor || 0,
                shield: es.filter(e => e.affixes.includes('shielded')).map(e => Math.round(e.maxShield / e.maxHp * 100) / 100)[0] ?? null }};
            b.stopBattle();
            return r;""")
        g.js("window.madOverlordGameV2.switchScreen('menu');")
        g.wait(300)
        return out

    n = elites('3-1', 'normal')
    h = elites('3-1', 'hard')
    hs = elites('3-1', 'hard', n=4, kind='shield')
    hl = elites('3-1', 'hell')
    nm = elites('3-1', 'nightmare')
    ctx.check(n['diff'] == 'normal' and n['counts'] == [1] and n['armor'] == 0, '전투 · 노말 구역 3: 엘리트 속성 1개 (예전 2개), 방어 보정 없음', str(n))
    ctx.check(h['diff'] == 'hard' and h['counts'] == [1] and abs(h['armor'] - 0.1) < 1e-9 and h['plainArmor'] == 0,
              '전투 · 하드: 엘리트 속성 1개 + 받는 피해 −10% (보통 적은 그대로)', str(h))
    ctx.check(abs(hs['armor'] - (1 - 0.6 * 0.9)) < 1e-9 and hs['plainArmor'] == 0.4, '하드 엘리트 방패병: 종류 방어 40%와 겹쳐 곱함 (46%)', str(hs))
    ctx.check(hl['diff'] == 'hell' and hl['counts'] == [2, 3] and hl['uniq'] and hl['armor'] == 0, '전투 · 헬: 엘리트마다 속성 2~3개 무작위 (서로 다른 속성)', str(hl))
    ctx.check(nm['diff'] == 'nightmare' and nm['counts'] == [3] and nm['shield'] == 0.5, '전투 · 나이트메어: 속성 3개 · 보호막 50% (효과 ×1.25)', str(nm))
    g.js("progress.difficulty = 'normal';")

    # ---- ① 출시 범위 (검사 기본은 숨김 묶음을 연 상태 — 여기서만 닫고 봄) ----
    st = g.js("""const { lateBonusOf, LAUNCH_CHARACTERS, ROSTER } = await import('/js/engine_v2/roster_v2.js');
        const { PARTS_DB } = await import('/js/data/parts.js');
        const SL = ['head', 'body', 'arm', 'leg'];
        const raw = c => { const parts = Object.fromEntries(SL.map(s => [s, PARTS_DB[s].find(p => p.id === `${s}_${c}`)]));
            const sum = SL.reduce((a, s) => a + parts[s].stats.hp, 0); return { hp: progress.statsFor(parts).hp, sum }; };
        const dv = raw('diver'), fr = raw('frost');
        const mech = progress.equippedStats(), mraw = SL.reduce((a, s) => a + gameState.getEquippedObjects()[s].stats.hp, 0);
        return { launch: LAUNCH_CHARACTERS, bonus: ROSTER.map(c => lateBonusOf(c.id)), diver: dv.hp / dv.sum, frost: fr.hp / fr.sum, mech: mech.hp / mraw };""")
    ctx.check(st['launch'] == ['mech', 'kaiju', 'hero', 'chimera'] and st['bonus'] == [1, 1, 1, 1, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05],
              '후발 캐릭터 보정: 출시 4명 ×1, 5번째부터 ×1.05', str(st['bonus']))
    ctx.check(abs(st['diver'] - 1.05) < 0.002 and abs(st['frost'] - 1.05) < 0.002 and abs(st['mech'] - 1) < 1e-9,
              '후발 캐릭터 체력 +5% (길잡이 · 무희), 거대로봇은 그대로', str(st))

    g2 = ctx.game(fresh=True)
    g2.page.goto(f'{g2.base}/index.html?t={time.time()}')
    g2.enter_v2()
    st = g2.js("""const C = await import('/js/engine_v2/contentSchedule_v2.js'); const S = await import('/js/engine_v2/stages_v2.js'); const D = await import('/js/engine_v2/difficulty_v2.js');
        const out = { zones: [1, 2, 3, 4, 5, 6, 7, 10].map(z => C.isZoneReleased(z)),
            chars: ['mech', 'kaiju', 'hero', 'chimera', 'diver', 'saint', 'doll', 'broadcaster'].map(c => C.isCharacterReleased(c)),
            groups: [4, 5, 6, 7, 9].map(z => C.groupOfZone(z)), stageGroup: [S.stageById('5-1').group, S.stageById('6-B').group, S.stageById('7-1').group],
            final: D.FINAL_STAGE_ID, label: C.releaseLabelOf('zones', 5) };
        // 구역 5 · 6은 숨기기만 — 하드 배율은 그룹 1 그대로 (숨김 그룹 2 · 3처럼 줄이지 않음)
        const s5 = S.stageById('5-1'), h5 = D.stageFor(s5, 'hard'), s1 = S.stageById('1-1'), h1 = D.stageFor(s1, 'hard');
        out.hard = [Math.round(h5.enemy.hp / s5.enemy.hp * 100) / 100, Math.round(h1.enemy.hp / s1.enemy.hp * 100) / 100];
        // 노말 4-B까지 깨면: 5-1은 안 열리고 하드가 열림
        for (const s of S.STAGES) { progress.stages[s.id] = { stars: [true, true, true], cleared: true, bestTime: 100 }; if (s.id === '4-B') break; }
        out.after = { z5: S.isUnlocked('5-1', progress), hard: D.difficultyUnlocked('hard', progress), top: D.highestDifficulty(progress).id,
            maxLevel: progress.maxLevel(), diverJoin: progress.isCharacterUnlocked('diver'), chimeraJoin: progress.isCharacterUnlocked('chimera') };
        progress.character = 'diver';
        const sp = progress.startSpecial('boss'), tw = progress.startTower();
        progress.character = 'mech';
        out.special = [sp.success, sp.reason || '', tw.success];
        return out;""")
    ctx.check(st['zones'] == [True, True, True, True, False, False, False, False]
              and st['chars'] == [True, True, True, True, False, False, False, False],
              '출시 범위: 구역 1~4 · 캐릭터 4명만 공개, 구역 5~10 · 길잡이 · 성녀 포함 6명 숨김', str(st))
    ctx.check(st['groups'] == [1, 1, 1, 2, 3] and st['stageGroup'] == [1, 1, 2] and st['hard'][0] == st['hard'][1] == 1.4,
              '구역 5 · 6은 숨기기만: 판 세기 그룹 1 · 하드 배율 ×1.4 그대로', str(st))
    ctx.check(st['final'] == '4-B' and st['after'] == {'z5': False, 'hard': True, 'top': 'hard', 'maxLevel': 7, 'diverJoin': False, 'chimeraJoin': True},
              '노말 4-B를 깨면 하드가 열림(강화 한도 Lv7) · 5-1과 길잡이는 공개 전이라 안 열림', str(st['after']))
    ctx.check(st['special'][0] is False and '공개 전' in st['special'][1] and st['special'][2] is False,
              '공개 전 캐릭터가 주인공인 예전 저장: 스페셜맵 · 탑 출격 불가', str(st['special']))
    g2.js("window.madOverlordGameV2.switchScreen('select');")
    g2.wait(600)
    st = g2.js("""const card = id => { const c = document.querySelector(`.v2-charcard[data-char="${id}"]`);
            return c ? [c.classList.contains('is-secret'), c.querySelector('.v2-charcard__head h2').textContent] : null; };
        return { diver: card('diver'), saint: card('saint'), chimera: card('chimera') };""")
    ctx.check(st['diver'] == [True, '???'] and st['saint'] == [True, '???'] and st['chimera'] and not st['chimera'][0] and st['chimera'][1] != '???',
              "선택창: 길잡이 · 성녀는 '???' 실루엣, 합성괴인은 그대로", str(st))
    g2.shot('meeting_b_select')
