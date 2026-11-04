"""게임 통계: 최초 접속·유입 출처·전투·구매·공급자 격리·최근 200개 기록"""


ANALYTICS = "const a = await import('/js/engine_v2/analytics_v2.js');"


def events(g):
    return g.js(ANALYTICS + 'return a.readAnalyticsLog();')


def run(ctx):
    g = ctx.game(fresh=True)
    g.page.goto(f'{g.base}/index.html?utm_source=tiktok&utm_campaign=launch',
                referer='https://ads.example/landing?private=omitted')
    g.enter_v2()
    log = events(g)
    first = next(e for e in log if e['name'] == 'first_open')
    start = next(e for e in log if e['name'] == 'session_start')
    ctx.check(sum(e['name'] == 'first_open' for e in log) == 1 and start['isFirstSession'],
              '첫 접속: first_open 한 번·session_start 기록')
    saved = g.js("return { id: JSON.parse(localStorage.getItem('mo_install_id')), at: JSON.parse(localStorage.getItem('mo_first_open_at')) };")
    ctx.check(bool(first['installId']) and saved['id'] == first['installId']
              and saved['at'] == first['firstOpenAt'] and first['firstOpenAt'] > 0,
              '기기 무작위 ID·최초 접속 시각 저장')
    ctx.check(all(e['sessionId'] == start['sessionId'] and e['platform'] == 'web'
                  and e['daysSinceFirst'] == 0 and e['version'] and isinstance(e['build'], int)
                  and e['ts'] >= e['firstOpenAt'] for e in log), '이벤트 공통 필드')
    ctx.check(start['firstTouch']['utm_source'] == 'tiktok'
              and start['firstTouch']['utm_campaign'] == 'launch'
              and start['firstTouch']['referrer'] == 'ads.example'
              and start['firstTouch']['landedAt'] > 0
              and start['firstTouch'] == start['lastTouch'], '첫 광고 출처·참조 호스트 기록')

    g.page.goto(f'{g.base}/index.html?utm_source=google&utm_campaign=return')
    g.enter_v2()
    log = events(g)
    again = [e for e in log if e['name'] == 'session_start'][-1]
    ctx.check(not again['isFirstSession'] and again['sessionId'] != start['sessionId']
              and again['installId'] == first['installId'] and again['firstOpenAt'] == first['firstOpenAt']
              and sum(e['name'] == 'first_open' for e in log) == 1, '재접속: 새 세션·기기 ID 유지·first_open 중복 없음')
    ctx.check(again['firstTouch'] == start['firstTouch']
              and again['lastTouch']['utm_source'] == 'google'
              and again['lastTouch']['utm_campaign'] == 'return'
              and g.js("return JSON.parse(localStorage.getItem('mo_attribution'));") == start['firstTouch'],
              '재접속: 처음 출처 유지·이번 출처만 변경')

    # 기존 전투 검사처럼 시간을 당겨 실제 시간 초과 → 결과 화면 경로를 실행
    g.battle('hero')
    stage_id = g.js('return b.stage.id;')
    g.js('b.stats.time = b.stage.timeLimit - 0.3;')
    g.page.wait_for_selector('.v2-result.is-lose', timeout=15000)
    log = events(g)
    stage_start = [e for e in log if e['name'] == 'stage_start'][-1]
    stage_end = [e for e in log if e['name'] == 'stage_end'][-1]
    ctx.check(stage_start['stageId'] == stage_id and stage_start['character'] == 'hero'
              and stage_start['zone'] == 1 and stage_start['difficulty'] == 'normal', '전투 시작: 스테이지·캐릭터·난이도')
    ctx.check(stage_end['stageId'] == stage_id and stage_end['result'] == 'defeat'
              and stage_end['time'] > 0 and isinstance(stage_end['stars'], int)
              and stage_end['dm'] >= 0, '전투 종료: 결과 객체의 패배·시간·별·DM')
    g.battle('mech')
    g.js('b.finishBattle(true);')   # test_difficulty와 같은 빠른 승리 방법
    ctx.check(events(g)[-1]['name'] == 'stage_end' and events(g)[-1]['result'] == 'victory', '승리 결과 기록')

    g.js("window.madOverlordGameV2.switchScreen('lab'); gameState.darkMatter = 10000; gameState.cartParts = { head: 'head_mech', body: 'body_red_robot', arm: 'arm_red_robot', leg: 'leg_red_robot' }; progress.confirmCart();")
    purchases = [e for e in events(g) if e['name'] == 'part_purchase']
    ctx.check(len(purchases) == 1 and purchases[0]['partIds'] == ['head_mech']
              and purchases[0]['cost'] == 500, '구매 성공: 새 파츠·실제 비용 기록', str(purchases))
    g.js('progress.confirmCart();')
    ctx.check(sum(e['name'] == 'part_purchase' for e in events(g)) == 1, '보유 파츠 재장착은 구매로 기록하지 않음')
    ctx.check(any(e['name'] == 'screen_view' and e['screen'] == 'lab' for e in events(g)), '화면 이동 기록')

    st = g.js(ANALYTICS + """
        const received = [];
        a.addAnalyticsProvider(() => { throw new Error('검사용 공급자 오류'); });
        a.addAnalyticsProvider(async () => { throw new Error('검사용 비동기 공급자 오류'); });
        a.addAnalyticsProvider(event => received.push(event));
        a.track('provider_test', { value: 42 });
        return { received, local: a.readAnalyticsLog().slice(-1)[0], ready: !!window.madOverlordGameV2 };
    """)
    ctx.check(st['ready'] and len(st['received']) == 1 and st['received'][0] == st['local']
              and st['local']['value'] == 42, '공급자 예외 후에도 게임·다른 공급자에 같은 이벤트 전달')
    st = g.js(ANALYTICS + """
        for (let i = 0; i < 205; i++) a.track('limit_test', { i });
        return { log: a.readAnalyticsLog(), stored: JSON.parse(localStorage.getItem('mo_analytics_log')) };
    """)
    ctx.check(len(st['log']) == 200 and st['log'] == st['stored']
              and st['log'][0]['i'] == 5 and st['log'][-1]['i'] == 204, '최근 200개 유지·오래된 기록 제거')
    ok = g.js(ANALYTICS + """
        const original = Storage.prototype.setItem;
        try {
            Storage.prototype.setItem = () => { throw new Error('검사용 저장 실패'); };
            a.track('storage_test');
        } finally { Storage.prototype.setItem = original; }
        return a.readAnalyticsLog().slice(-1)[0].name === 'storage_test';
    """)
    ctx.check(ok, '저장 실패 시에도 이벤트 처리 계속')
    st = g.js(ANALYTICS + """
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.visibilityState;
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('pagehide'));
        return a.readAnalyticsLog().filter(e => e.name === 'session_end');
    """)
    ctx.check(len(st) == 1 and st[0]['duration'] >= 0, '숨김·pagehide 중복에도 세션 종료 한 번')
