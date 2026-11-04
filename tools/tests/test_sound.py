"""사운드: 효과음 로드, 배경음 전환(메뉴 → 전투 → 보스), 저체력 심장 박동, 설정 저장,
재생 보강(2026-10-24): 코드가 부르는 소리 이름이 모두 표에 있음, 묶음, 변형 고르기, 좌우, 느린 화면 음높이·먹먹함, 빌린 소리"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CALL = re.compile(r"""sfx\s*[:=(]\s*['"]([a-z_0-9]+)['"]|sound\.(?:play|loop)\(\s*['"]([a-z_0-9]+)['"]""")


def called_names():
    """js 전체에서 sfx: '이름' · sound.play('이름') · director.sfx('이름')로 부르는 이름 → 처음 나온 파일:줄"""
    out = {}
    for dp, _, fs in os.walk(os.path.join(ROOT, 'js')):
        if os.sep + 'engine' + os.sep in dp + os.sep:   # 예전 v1 엔진은 제외
            continue
        for fn in fs:
            if fn.endswith('.js'):
                p = os.path.join(dp, fn)
                for i, line in enumerate(open(p, encoding='utf-8')):
                    for m in CALL.finditer(line):
                        out.setdefault(m.group(1) or m.group(2), f'{os.path.relpath(p, ROOT)}:{i + 1}')
    return out


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js("return { state: sound.ctx && sound.ctx.state, loaded: sound.buffers.size, total: Object.keys(SFX).length, bgm: sound.bgm && sound.bgm.name };")
    ctx.check(st['state'] == 'running', '소리 켜짐 (AudioContext running)', str(st['state']))
    ctx.check(st['loaded'] == st['total'], '효과음 전부 로드', f"{st['loaded']}/{st['total']}")
    ctx.check(st['bgm'] == 'menu', '메인 화면 배경음 = menu', str(st['bgm']))

    # 코드가 부르는 이름이 모두 SFX 표에 있음 (없으면 그 자리는 무음)
    table = set(g.js('return Object.keys(SFX);'))
    missing = {n: w for n, w in called_names().items() if n not in table}
    ctx.check(not missing, '코드가 부르는 효과음 이름이 모두 표에 있음 (무음 자리 없음)', str(missing))
    st = g.js("""const { catOf } = await import('/js/engine_v2/audio/sound_v2.js');
        return ['ui_click', 'reward_done', 'warning_danger', 'ult_cutin', 'zone_gas', 'enemy_die', 'shield_hit', 'player_down', 'mech_laser', 'frost_fan']
            .map(catOf).join(',');""")
    ctx.check(st == 'ui,ui,cue,cue,enemy,enemy,player,player,skill,skill', '묶음: UI · 연출 · 적 · 플레이어 · 스킬', st)
    st = g.js("""const fake = [{}, {}, {}]; let prev = -1, same = 0; const seen = new Set();
        for (let i = 0; i < 60; i++) { const k = fake.indexOf(sound.pickVariant('__t', fake)); if (k === prev) same++; prev = k; seen.add(k); }
        return { same, kinds: seen.size, one: sound.pickVariant('__u', [fake[0]]) === fake[0] };""")
    ctx.check(st['same'] == 0 and st['kinds'] == 3 and st['one'], '변형 고르기: 세 변형을 고루, 바로 앞과 같은 것은 안 냄', str(st))
    # 외부 라이브러리 소리(D-084): sfx_ext/ 파일이 있으면 그걸 ext 음량으로, 없으면(공개 저장소) sfx/의 CC0 소리 + vol
    has_ext = os.path.exists(os.path.join(ROOT, 'assets', 'audio', 'sfx_ext', 'warning.ogg'))
    st = g.js("""const ext = Object.keys(SFX).filter(n => SFX[n].ext);
        return { n: ext.length, loaded: ext.filter(n => sound.buffers.has(n)).length, fromExt: ext.filter(n => sound.extLoaded.has(n)).length,
                 vol: sound.volOf('warning'), want: sound.extLoaded.has('warning') ? SFX.warning.ext : SFX.warning.vol };""")
    ctx.check(st['n'] >= 16 and st['loaded'] == st['n'] and st['fromExt'] == (st['n'] if has_ext else 0) and st['vol'] == st['want'],
              '외부 소리: ' + ('sfx_ext/에서 읽고 ext 음량' if has_ext else 'sfx_ext/가 없어 sfx/ CC0 소리 + vol로 대신'), str(st))
    st = g.js("return { roar: sound.buffers.has('rampage_roar'), breath: sound.buffers.has('kaiju_breath') };")
    ctx.check(st['roar'] and st['breath'], '빌린 소리: 변신 포효(rampage_roar) · 괴수 숨결(kaiju_breath)이 남', str(st))

    g.battle('mech', wait_ms=1500)
    ctx.check(g.js('return sound.bgm && sound.bgm.name;') == 'battle', '전투 배경음 = battle')

    # 좌우 · 느린 화면 (재생된 소스·패너를 가로채서 확인)
    st = g.js("""const c = sound.ctx, made = { pans: [], srcs: [] };
        const mkP = c.createStereoPanner.bind(c), mkS = c.createBufferSource.bind(c);
        c.createStereoPanner = () => { const p = mkP(); made.pans.push(p); return p; };
        c.createBufferSource = () => { const s = mkS(); made.srcs.push(s); return s; };
        sound.lastAt.clear();
        sound.play('mech_fist_hit', { x: 1 });
        sound.play('ui_click', { x: 1 });
        const right = made.pans.map(p => p.pan.value), fist = made.srcs[0].playbackRate.value;
        gameTime.slowMo(0.3, 1.2);
        await new Promise(r => setTimeout(r, 250));
        sound.lastAt.clear();
        sound.play('mech_fist_hit');
        const slow = made.srcs[made.srcs.length - 1].playbackRate.value, freq = sound.worldFilter.frequency.value;
        await new Promise(r => setTimeout(r, 1500));
        const back = sound.worldFilter.frequency.value;
        delete c.createStereoPanner; delete c.createBufferSource;
        return { right, fist, slow, freq, back, uiPans: made.pans.length };""")
    ctx.check(len(st['right']) == 1 and abs(st['right'][0] - 0.55) < 0.01, '좌우: 화면 오른쪽 끝 전투 소리는 오른쪽으로 0.55, UI 소리는 가운데', str(st))
    ctx.check(st['slow'] < 0.8 and st['fist'] > 0.9 and st['freq'] < 3000 and st['back'] > 10000,
              '느린 화면: 새 전투 소리 음높이 내려감 + 전투 소리 먹먹 (저역 통과) → 끝나면 원래대로', str(st))
    g.js('b.playerHp = b.maxPlayerHp * 0.2;')
    g.wait(400)
    ctx.check(g.js("return sound.loops.has('low_hp');"), '저체력: 심장 박동 반복')
    g.js('b.playerHp = b.maxPlayerHp;')
    g.wait(400)
    ctx.check(not g.js("return sound.loops.has('low_hp');"), '체력 회복: 심장 박동 멈춤')
    g.js("b.spawnInterval = 999; b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.midBaseSpawned = true; b.midBaseDestroyed = true; b.distanceTraveled = b.stage ? b.stage.finalAt - 0.5 : 899.5;")
    g.wait(1500)
    ctx.check(g.js('return sound.bgm && sound.bgm.name;') == 'boss', '최종 기지 배경음 = boss')

    # 설정 저장
    g.js("settings.set('bgm', 0.3); settings.set('shake', false);")
    g.reload_v2()
    st = g.js("return { bgm: settings.get('bgm'), shake: settings.get('shake') };")
    ctx.check(st['bgm'] == 0.3 and st['shake'] is False, '설정 저장 (새로고침 후 유지)', str(st))
    g.js('settings.reset();')
