"""소리 묶음 (적용 전 / 후 견주기, 2026-11-21): 기본은 지금 소리, 설정·주소로 새 소리(11-16 선정 17개 — sfx_new/)로 바꿈.
새 묶음에서만: 바꿔 끼운 12개 = sfx_new 파일 + pick 음량, 새 이름 5개(작은 적 처치 · 금속 울림 · 적 근접 · 화염 · 빛)가 전투에서 남.
예전 묶음에서는 새 이름 5개가 하나도 안 나고 예전 소리 그대로."""
import os
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NEW5 = ['kill_small', 'hit_tail_metal', 'en_melee', 'en_fire', 'en_holy']

# 전투에 적을 놓고 한 번씩 일으킴 → 그동안 실제로 난 소리 이름 (sound.lastAt = 재생이 시작된 소리만)
SCENE = """
    const { spawnEnemy } = await import('/js/engine_v2/enemies_v2.js');
    b.spawnInterval = 999;
    b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove());
    b.enemies = b.enemies.filter(e => e.isBuilding);
    const front = b.monsterX + 100, out = {};
    const put = (type, dx) => { const e = spawnEnemy(b, type, { x: front + dx, elite: false }); e.speed = 0; e.hp = e.maxHp = 1e9; e.cd.skill = 99; return e; };
    // 처치: 작은 적(징집 보병) / 갑옷 적(진압 방패병)
    sound.lastAt.clear();
    b.dealDamageToEnemy(put('conscript', 300), 9e9, false, null);
    out.smallKill = [...sound.lastAt.keys()];
    sound.lastAt.clear();
    const riot = put('riot', 320);
    b.dealDamageToEnemy(riot, 10, false, {});          // 직접 타격 → 금속 울림
    out.armorHit = [...sound.lastAt.keys()];
    sound.lastAt.clear();
    b.dealDamageToEnemy(riot, 10, false, { dot: true });   // 지속 피해는 울림 없음
    out.armorDot = [...sound.lastAt.keys()];
    sound.lastAt.clear();
    b.dealDamageToEnemy(riot, 9e12, false, null);
    out.armorKill = [...sound.lastAt.keys()];
    // 붙어서 휘두르는 보병 · 불 던지는 화염방사병 · 빛의 마법사 (전투 루프가 돌게 기다림)
    sound.lastAt.clear();
    put('conscript', 20); put('flamer', 150); put('lightmage', 220);
    await new Promise(r => setTimeout(r, 1600));
    out.loop = [...sound.lastAt.keys()];
    return out;
"""


def run(ctx):
    has_new = os.path.exists(os.path.join(ROOT, 'assets', 'audio', 'sfx_new', 'warning.ogg'))
    ctx.check(has_new, '새 소리 묶음 파일이 있음 (assets/audio/sfx_new — tools/audio/build_picks.py)')
    g = ctx.game(fresh=True)
    g.enter_v2()

    # ---- 기본 = 지금 소리 ----
    st = g.js("""const names = Object.keys(SFX);
        return { pack: sound.pack, set: settings.get('sfxPack'), picked: sound.pickLoaded.size, has: sound.has('kill_small'),
                 buf: sound.buffers.has('kill_small'), loaded: names.filter(n => sound.has(n)).every(n => sound.buffers.has(n)),
                 picks: names.filter(n => SFX[n].pick != null).length, only: names.filter(n => SFX[n].pack === 'new'),
                 dur: sound.buffers.get('warning')[0].duration, vol: sound.volOf('mission_complete') };""")
    old_dur = st['dur']
    ctx.check(st['pack'] == 'old' and st['set'] == 'old' and st['picked'] == 0 and st['loaded'], '기본: 지금 소리 묶음 — 새 파일은 하나도 안 읽음', str(st))
    ctx.check(not st['has'] and not st['buf'] and sorted(st['only']) == sorted(NEW5), '기본: 새 이름 5개는 꺼져 있음 (읽지도 않음)', str(st))
    ctx.check(st['picks'] == 17, '표: 새 묶음 음량(pick)이 붙은 소리 17개', str(st['picks']))

    g.battle('hero')   # 미사일을 쏘지 않는 주인공 — 미사일 발사음은 빛의 마법사 것만
    old = g.js(SCENE)
    played = set(old['smallKill'] + old['armorHit'] + old['armorDot'] + old['armorKill'] + old['loop'])
    ctx.check(not played & set(NEW5), '지금 소리: 전투에서 새 이름 5개가 하나도 안 남', str(old))
    ctx.check('enemy_die' in old['smallKill'] and 'enemy_die' in old['armorKill'], '지금 소리: 처치는 모두 enemy_die', str(old))
    ctx.check('mech_missile_launch' in old['loop'], '지금 소리: 빛의 마법사 발사 = 예전 미사일 발사음', str(old['loop']))

    # ---- 새 소리로 바꿈 (전투 중에도 바로) ----
    st = g.js("""await sound.setPack('new');
        const names = Object.keys(SFX).filter(n => SFX[n].pick != null);
        return { pack: sound.pack, picked: names.filter(n => sound.pickLoaded.has(n)).length, n: names.length,
                 dur: sound.buffers.get('warning')[0].duration, vol: sound.volOf('mission_complete'), want: SFX.mission_complete.pick,
                 keep: sound.volOf('mech_fist_hit') === SFX.mech_fist_hit.vol, has: sound.has('kill_small') && sound.buffers.has('kill_small') };""")
    ctx.check(st['pack'] == 'new' and st['picked'] == st['n'] == 17 and st['has'], '새 소리: 17개 모두 sfx_new/에서 읽음', str(st))
    ctx.check(abs(st['dur'] - old_dur) > 0.05 and st['vol'] == st['want'] and st['keep'],
              '새 소리: 파일이 바뀌고(경보 길이 다름) 음량은 pick, 묶음에 없는 소리는 그대로', f"{old_dur:.2f}s → {st['dur']:.2f}s {st}")
    new = g.js(SCENE)
    ctx.check('kill_small' in new['smallKill'] and 'enemy_die' not in new['smallKill'], '새 소리: 작은 적 처치 = kill_small (enemy_die 대신)', str(new['smallKill']))
    ctx.check('enemy_die' in new['armorKill'] and 'kill_small' not in new['armorKill'], '새 소리: 방패병 처치 = enemy_die', str(new['armorKill']))
    ctx.check('hit_tail_metal' in new['armorHit'] and 'hit_tail_metal' not in new['armorDot'], '새 소리: 갑옷 적 직접 타격에 금속 울림 (지속 피해는 없음)', str(new))
    ctx.check(all(n in new['loop'] for n in ('en_melee', 'en_fire', 'en_holy')), '새 소리: 적 근접 · 화염 · 빛 공격 소리가 남', str(new['loop']))
    ctx.check('mech_missile_launch' not in new['loop'], '새 소리: 빛의 마법사는 미사일 발사음 대신 자기 소리', str(new['loop']))

    # 되돌리기
    st = g.js("""await sound.setPack('old');
        return { pack: sound.pack, picked: sound.pickLoaded.size, dur: sound.buffers.get('warning')[0].duration, buf: sound.buffers.has('kill_small'),
                 vol: sound.volOf('warning'), want: sound.extLoaded.has('warning') ? SFX.warning.ext : SFX.warning.vol };""")
    ctx.check(st['pack'] == 'old' and st['picked'] == 0 and abs(st['dur'] - old_dur) < 0.01 and not st['buf'] and st['vol'] == st['want'],
              '되돌리기: 지금 소리 파일·음량으로 돌아옴', str(st))

    # ---- 설정 창 · 저장 ----
    g.js("window.madOverlordGameV2.switchScreen('menu');")
    g.wait(600)
    g.js("(await import('/js/ui_v2/settingsPanel_v2.js')).openSettings();")
    g.page.wait_for_selector('.v2-settings [data-sfx-pack="new"]')
    ctx.check(g.page.evaluate("() => document.querySelector('[data-sfx-pack=\"old\"]').classList.contains('is-on')"), '설정 창: 소리 묶음 줄 — 지금 소리가 켜져 있음')
    g.page.click('.v2-settings [data-sfx-pack="new"]')
    g.wait(900)
    st = g.js("""return { pack: sound.pack, set: settings.get('sfxPack'), on: document.querySelector('[data-sfx-pack="new"]').classList.contains('is-on'),
        picked: sound.pickLoaded.size };""")
    ctx.check(st['pack'] == 'new' and st['set'] == 'new' and st['on'] and st['picked'] == 17, '설정 창: 새 소리를 누르면 바로 바뀌고 저장됨', str(st))
    g.shot('sfx_pack_settings', '.v2-settings__panel')
    g.reload_v2()
    st = g.js("return { pack: sound.pack, picked: sound.pickLoaded.size };")
    ctx.check(st['pack'] == 'new' and st['picked'] == 17, '새로고침 뒤에도 새 소리 (저장)', str(st))
    g.js("settings.reset();")
    g.wait(600)
    ctx.check(g.js("return sound.pack;") == 'old', '설정 기본값 → 지금 소리')
    bad = g.js("""const { importSave, exportSave } = await import('/js/engine_v2/progress_v2.js');
        const pack = value => {
            const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
            let hash = 2166136261;
            for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
            return `MO1:${payload}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
        };
        const entries = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(exportSave().split(':')[1]), c => c.charCodeAt(0)))).entries;
        const snapshot = JSON.stringify({ ...localStorage });
        const r = importSave(pack({ entries: { ...entries, mo_v2_settings: JSON.stringify({ ...JSON.parse(entries.mo_v2_settings), sfxPack: 'loud' }) } }));
        return { rejected: !r.success, reason: r.reason, same: JSON.stringify({ ...localStorage }) === snapshot };""")
    ctx.check(bad['rejected'] and bad['same'], '백업 코드: 모르는 소리 묶음 값은 불러오지 않음 (저장 내용 그대로)', str(bad))

    # ---- 주소 ?sfxPack=new : 켤 때만, 저장은 안 함 ----
    g.page.goto(f'{g.base}/index.html?openGroups=1&skipTitle=1&sfxPack=new&t={time.time()}')
    g.enter_v2()
    st = g.js("return { pack: sound.pack, set: settings.get('sfxPack'), picked: sound.pickLoaded.size };")
    ctx.check(st['pack'] == 'new' and st['set'] == 'old' and st['picked'] == 17, '주소 ?sfxPack=new: 새 소리로 켜짐 (설정 저장은 그대로)', str(st))
