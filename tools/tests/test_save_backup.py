"""저장 통로·백업 코드·예전 저장 호환·설정 창 백업 조작."""
import json


API = "const backup = await import('/js/engine_v2/progress_v2.js');"


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    code = g.js(API + """
        gameState.darkMatter = 54321;
        progress.owned.add('head_mech');
        progress.levels.head_mech = 3;
        progress.stages['1-1'] = { stars: [true, false, true], cleared: true, bestTime: 42 };
        settings.set('master', 0.35);
        localStorage.setItem('mo_v2_auto_skill', '1');
        localStorage.setItem('mo_v2_backup_test', '한글 저장 값');
        localStorage.setItem('mo_legacy_test', '제외');
        localStorage.setItem('vfxStyle', 'pixel');
        return backup.exportSave();
    """)
    ctx.check(code.startswith('MO1:'), '백업 코드 앞머리')
    before = g.js("return JSON.parse(localStorage.getItem('mo_v2_save'));")
    ctx.check(before['savedAt'] > 0 and bool(before['saveId']), '저장 시간·식별자 생성')
    st = g.js(API + """const first = progress.saveId; backup.exportSave();
        return { same: first === progress.saveId,
            data: JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(backup.exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries };""")
    ctx.check(st['same'], '저장 식별자 유지')
    ctx.check(st['data'].get('mo_v2_auto_skill') == '1' and st['data'].get('mo_v2_backup_test') == '한글 저장 값'
              and 'mo_legacy_test' not in st['data'] and 'vfxStyle' not in st['data'], 'v2 키·UTF-8 포함, 구버전·VFX 제외')

    # 검증 실패는 저장 내용을 바꾸지 않는다. JSON 모양 오류도 올바른 확인값으로 시험한다.
    st = g.js(API + """
        const pack = value => {
            const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
            let hash = 2166136261;
            for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
            return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
        };
        const valid = backup.exportSave();
        const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(valid.split(':')[1]), c => c.charCodeAt(0)))).entries;
        const broken = [valid.slice(0, -1) + (valid.endsWith('0') ? '1' : '0'), valid.replace('MO1:', 'BAD:'),
            'MO1:%%%:00000000', 'MO1:AB==:00000000', pack(null), pack({ entries: {} }),
            pack({ entries: { ...entries, mo_v2_save: JSON.stringify({ dm: '문자', owned: [], equipped: {} }) } }),
            pack({ entries: { ...entries, mo_v2_save: JSON.stringify({ dm: 1, owned: {}, equipped: {} }) } }),
            pack({ entries: { ...entries, mo_v2_settings: '{' } }),
            pack({ entries: { ...entries, mo_v2_auto_skill: '잘못된 값' } })];
        const snapshot = JSON.stringify({ ...localStorage });
        return broken.map(code => {
            const result = backup.importSave(code);
            return !result.success && !!result.reason && JSON.stringify({ ...localStorage }) === snapshot;
        });
    """)
    ctx.check(all(st), '앞머리·확인값·base64·JSON 오류 거절, 저장 그대로', str(st))

    with g.page.expect_navigation():
        g.js('progress.resetAll();')
    g.enter_v2()
    ctx.check(g.js('return gameState.darkMatter;') != 54321, '진행 초기화 실행')
    g.js("settings.set('master', 0.8); localStorage.setItem('mo_v2_auto_skill', '0');")
    with g.page.expect_navigation():
        g.js(API + f'backup.importSave({json.dumps(code)});')
    g.enter_v2()
    st = g.js("""return { dm: gameState.darkMatter, owned: progress.isOwned('head_mech'), level: progress.levels.head_mech,
        stage: progress.stage('1-1'), master: settings.get('master'), auto: localStorage.getItem('mo_v2_auto_skill'),
        saveId: progress.saveId, text: localStorage.getItem('mo_v2_backup_test') };""")
    ctx.check(st['dm'] == 54321 and st['owned'] and st['level'] == 3
              and st['stage'] == before['stages']['1-1'], '초기화 뒤 DM·파츠·강화·스테이지 복원', str(st))
    ctx.check(st['master'] == 0.35 and st['auto'] == '1' and st['saveId'] == before['saveId']
              and st['text'] == '한글 저장 값', '설정·자동 스킬·식별자·UTF-8 복원', str(st))

    # 버전 없음·1·2·3 모두 같은 로딩 통로로 읽고 다음 저장에 메타데이터를 만든다.
    for version in (None, 1, 2, 3):
        old = {k: v for k, v in before.items() if k not in ('savedAt', 'saveId', 'v')}
        old['dm'] = 1234
        if version is not None:
            old['v'] = version
        g.page.evaluate('(data) => localStorage.setItem("mo_v2_save", JSON.stringify(data))', old)
        g.reload_v2()
        st = g.js("return JSON.parse(localStorage.getItem('mo_v2_save'));")
        ctx.check(st['dm'] == 1234 and st['savedAt'] > 0 and bool(st['saveId']), f'예전 저장 v={version} 호환·메타데이터 추가')

    g.js("(await import('/js/ui_v2/settingsPanel_v2.js')).openSettings();")
    ctx.check(g.page.locator('[data-row="backup"]').is_visible() and g.page.locator('[data-row="import"]').is_visible(),
              '설정 창 백업·불러오기 두 줄 표시')
    g.page.evaluate("""() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: async text => { window.backupCopied = text; } } })""")
    g.page.click('[data-act="copy-save"]')
    g.wait(100)
    ctx.check(g.page.evaluate("() => window.backupCopied?.startsWith('MO1:')"), '코드 복사 버튼에서 코드 생성·클립보드 전달')
    g.page.evaluate("""() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: async () => { throw new Error('차단'); } } })""")
    g.page.click('[data-act="copy-save"]')
    g.wait(100)
    ctx.check(g.page.evaluate("""() => { const box = document.querySelector('[data-code="backup"]');
        return !box.hidden && box.value.startsWith('MO1:') && box.selectionEnd === box.value.length; }"""), '클립보드 차단 시 글상자 표시·선택')
    with g.page.expect_download() as download:
        g.page.click('[data-act="download-save"]')
    ctx.check(download.value.suggested_filename.startswith('MAD-OVERLORD-') and download.value.suggested_filename.endswith('.txt'),
              '날짜를 넣은 백업 txt 내려받기')
    g.page.fill('[data-code="import"]', '틀린 코드')
    g.page.once('dialog', lambda dialog: dialog.accept())
    g.page.click('[data-act="import-save"]')
    ctx.check('앞머리' in g.page.locator('[data-out="import"]').inner_text(), '불러오기 확인 뒤 같은 줄에 오류 이유 표시')
    g.page.set_viewport_size({'width': 854, 'height': 480})
    g.wait(350)
    ctx.check(g.page.evaluate("""() => { const r = document.querySelector('.v2-settings__panel').getBoundingClientRect();
        return r.top >= -1 && r.bottom <= innerHeight + 1; }"""), '작은 화면에서도 설정 창이 화면 높이 안에 표시')
    g.page.click('[data-act="close"]')
    g.wait(250)
    ctx.check(g.page.locator('.v2-settings').count() == 0, '스크롤 뒤 닫기 버튼 접근 가능')

    # 교체 저장소와 알림은 게임 흐름과 분리해서 검사한다.
    st = g.js("""const isolated = await import('/js/engine_v2/saveStore_v2.js?backup-test');
        const values = new Map();
        isolated.setSaveStore({ load: key => values.get(key) ?? null,
            save: (key, text) => values.set(key, text), remove: key => values.delete(key) });
        const calls = [];
        const off = isolated.onSaved((key, text) => calls.push([key, text]));
        isolated.save('mo_v2_test', '첫 값');
        const loaded = isolated.load('mo_v2_test');
        off();
        isolated.save('mo_v2_test', '둘째 값');
        isolated.remove('mo_v2_test');
        return loaded === '첫 값' && isolated.load('mo_v2_test') === null && calls.length === 1;
    """)
    ctx.check(st, '저장소 교체·동기 읽기/쓰기/삭제·알림 해제')
    st = g.js(API + """const isolated = await import('/js/engine_v2/saveStore_v2.js?failure-test');
        const values = new Map([['mo_v2_save', '원래 진행'], ['mo_v2_settings', '원래 설정']]);
        let fail = true;
        isolated.setSaveStore({ load: key => values.get(key) ?? null, remove: key => values.delete(key),
            save: (key, text) => {
                if (key === 'mo_v2_settings' && fail) { fail = false; throw new Error('쓰기 실패'); }
                values.set(key, text);
            } });
        const result = isolated.importSave(backup.exportSave());
        return !result.success && !!result.reason && values.get('mo_v2_save') === '원래 진행'
            && values.get('mo_v2_settings') === '원래 설정';
    """)
    ctx.check(st, '교체 저장소 쓰기 실패 시 이전 저장 복구')
    st = g.js("""const isolated = await import('/js/engine_v2/saveStore_v2.js?blocked-test');
        const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('차단'); } });
        try {
            isolated.save('mo_v2_test', '메모리 값');
            const loaded = isolated.load('mo_v2_test');
            isolated.remove('mo_v2_test');
            return loaded === '메모리 값' && isolated.load('mo_v2_test') === null;
        } finally { Object.defineProperty(window, 'localStorage', original); }
    """)
    ctx.check(st, 'localStorage 차단 환경의 메모리 저장·삭제')
