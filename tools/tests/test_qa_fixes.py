"""QA 회귀 검사: 긴 스테이지 설명의 화면 넘침, 요새 파괴 뒤 배속·표시, 거점 너머 아군 소환,
기본 파츠 지속 피해로 쓰러진 적이 안 치워지던 버그(11-02 디스코드 '1-1 졸개 무적'),
소환수: 거점을 지나친 아군이 거점을 안 치던 것 · 아군이 앞에서 싸우는데 주인공이 제자리걸음하던 것(11-03),
적 그림: 공격 동작이 땅 아래로 내려가 걷는 동안 발이 뜨던 것(11-02 '처형인 성기사 공중부양')"""
import glob
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def walk_float():
    """구운 적 그림마다 걷기 프레임 발 아래 빈칸(게임 px)의 최솟값 — 가장 낮게 디딘 프레임도 땅에서 떠 있으면 공중부양"""
    out = {}
    for jp in glob.glob(os.path.join(ROOT, 'assets', 'sprites', 'rig', '*', '*.json')):
        name = os.path.basename(os.path.dirname(jp))
        if os.path.basename(jp) != f'{name}.json':
            continue
        meta = json.load(open(jp, encoding='utf-8'))
        walk = meta.get('clips', {}).get('walk')
        if not walk:
            continue
        im = Image.open(os.path.join(ROOT, walk['src'])).convert('RGBA')
        w = im.size[0] // walk['frames']
        gaps = []
        for i in range(walk['frames']):
            box = im.crop((i * w, 0, (i + 1) * w, im.size[1])).getchannel('A').point(lambda a: 255 if a > 60 else 0).getbbox()
            if box:
                gaps.append((im.size[1] - box[3]) / meta.get('res', 1))
        out[name] = min(gaps)
    return out


CLEAR = ("(await import('/js/engine_v2/stages_v2.js')).STAGES.filter(s => [1, 2].includes(s.zone))"
         ".forEach(s => progress.stages[s.id] = { stars: [true,true,true], cleared: true, bestTime: 60 });")


def run(ctx):
    g = ctx.game(fresh=True, viewport=(1280, 720))
    g.enter_v2()

    # 긴 적 설명이 있는 2-B: 메뉴 안 모든 요소가 화면 오른쪽을 넘지 않음
    g.js(CLEAR + "window.madOverlordGameV2.menuController.selectStage('2-B');")
    g.wait(300)
    # 지도의 옆 구역 쪽(좌우로 밀어 넘기는 줄, stageMap_v2.js)은 일부러 지도 상자 밖에 놓고 잘라서 뺌 — 지도 상자 자체는 검사함
    st = g.js("""return { stage: progress.selectedStage, width: window.innerWidth,
        overflow: [...document.querySelectorAll('#screen-menu-v2 *')].filter(el => !el.closest('.v2-smap__track')).map(el => ({
            tag: el.tagName, id: el.id, cls: el.getAttribute('class'), right: el.getBoundingClientRect().right
        })).filter(el => el.right > window.innerWidth + 0.5) };""")
    ctx.check(st['stage'] == '2-B' and not st['overflow'], '2-B 메뉴: 모든 요소가 1280px 화면 안에 표시', str(st))

    # 1-1에서 2배속으로 중간 요새를 부숴도 배속과 버튼 표시가 유지됨
    g.js("progress.selectStage('1-1');")
    g.battle('mech', wait_ms=2900)
    g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.playerSpeed = 0; b.playerDps = 0;"
         "b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = [];"
         "b.midBaseSpawned = true; b.spawnBase('mid');")
    g.page.click('#btn-speed-v2')
    g.js("const f = b.enemies.find(e => e.isBuilding && !e.isFinal); b.dealDamageToEnemy(f, f.hp + 10, false);")
    g.wait(2500)
    st = g.js("""return { destroyed: b.midBaseDestroyed, speed: gameTime.speed,
        text: document.getElementById('btn-speed-v2').textContent.trim() };""")
    ctx.check(st['destroyed'] and st['speed'] == 2 and st['text'] == '2x', '중간 요새 파괴 2.5초 뒤: 2배속·2x 유지', str(st))

    # HUD 외부에서 배속을 바꾸면 다음 프레임에 버튼도 따라감
    st = g.js("""gameTime.speed = 1;
        await new Promise(resolve => requestAnimationFrame(resolve));
        return document.getElementById('btn-speed-v2').textContent.trim();""")
    ctx.check(st == '1x', '외부에서 1배속으로 변경 → 다음 프레임 버튼 1x', str(st))

    # 거점 오른쪽에서 부활한 봉합 아군은 거점보다 40px 이상 앞에 생김
    st = g.js("""const f = b.spawnBase('mid');
        b.spawnAllyMinion(f.x + 200, 'stitch', { art: 'guard', hp: 300, dps: 10 });
        const a = b.allies[b.allies.length - 1];
        return { base: f.x, ally: a && a.x };""")
    ctx.check(st['ally'] is not None and st['ally'] <= st['base'] - 40, '봉합 아군 소환: 거점 x - 40 이하', str(st))

    # 기본 파츠 지속 피해(타락 히어로 몸통 저주 · 거대괴수 다리 포자 · 합성괴인 다리 진동)로 쓰러진 적은 목록에서 빠짐
    # — 체력 0 이하로 남아 공격을 안 받고 계속 서 있던 '1-1 졸개 무적' (11-02 디스코드 QA, 협력 모드 30a7ddf 이후)
    for build, label in (('kaiju', '거대괴수 다리 포자'), ('hero', '타락 히어로 몸통 저주'), ('chimera', '합성괴인 다리 진동')):
        g.js("b.stopBattle(); progress.selectStage('1-1'); window.madOverlordGameV2.switchScreen('menu');")
        g.wait(300)
        g.battle(build, wait_ms=1500)
        g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.playerSpeed = 0; b.playerDps = 0;"
             "b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);")
        g.place_enemies(n=1, first=150, hp=3, speed=0, dps=0)
        g.wait(800)
        st = g.js("return { left: b.enemies.filter(e => !e.isBuilding).length, ghost: b.enemies.filter(e => e.hp <= 0).length };")
        ctx.check(st['left'] == 0 and st['ghost'] == 0, f'{label}로 쓰러진 적은 치워짐 (체력 0 이하로 남지 않음)', str(st))

    # 소환수 ① 거점이 나중에 생겨 거점보다 앞에 있게 된 아군도 거점을 침 (전에는 '뒤로 35px'까지만 봐서 가만히 서 있음)
    g.js("b.stopBattle(); progress.selectStage('1-1'); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.battle('kaiju', wait_ms=1500)
    g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.playerSpeed = 0; b.playerDps = 0;"
         "b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.allies.forEach(a => a.dom && a.dom.remove()); b.allies = [];"
         "b.spawnAllyMinion(850, 'stitch', { art: 'guard', hp: 99999, dps: 50 }); b.midBaseSpawned = true; b.spawnBase('mid');")
    hp0 = g.js("return b.enemies.find(e => e.isBuilding).hp;")
    g.wait(1200)
    st = g.js("const f = b.enemies.find(e => e.isBuilding); const a = b.allies[0]; return { base: f.x, hp: f.hp, ally: a.x, atk: !!a.attacking };")
    ctx.check(st['ally'] > st['base'] + 35 and st['atk'] and st['hp'] < hp0, '소환수: 거점을 지나친 아군도 거점을 공격', f'{st} 처음 체력 {hp0}')

    # 소환수 ② 아군이 앞에서 적을 붙잡고 싸우면 주인공은 그 자리로 걸어감 (제자리걸음으로 거리만 쌓지 않음)
    g.js("b.stopBattle(); progress.selectStage('1-1'); window.madOverlordGameV2.switchScreen('menu');")
    g.wait(300)
    g.battle('kaiju', wait_ms=1500)
    g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.playerDps = 0;"
         "b.enemies.forEach(e => e.dom && e.dom.remove()); b.enemies = []; b.allies.forEach(a => a.dom && a.dom.remove()); b.allies = [];"
         "b.spawnAllyMinion(b.monsterX + 460, 'stitch', { art: 'guard', hp: 99999, dps: 0 });")
    g.place_enemies(n=1, first=500, hp=99999, speed=35, dps=5)
    g.wait(400)
    a = g.js("return { x: b.monsterX, d: b.distanceTraveled, fight: b.allies.some(a => a.attacking) };")
    g.wait(1200)
    z = g.js("return { x: b.monsterX, d: b.distanceTraveled, fight: b.allies.some(a => a.attacking) };")
    ctx.check(a['fight'] and z['fight'] and z['x'] > a['x'] + 20 and z['d'] - a['d'] < 3,
              '소환수: 아군이 앞에서 싸우면 주인공이 그 자리로 걸어감 (거리는 쌓지 않음)', f'{a} → {z}')

    # 방패 돌진(거대로봇 방주 수호기 팔): 적을 뚫고 지나가지 않고 밀고 감 · 밀리지 않는 적 앞에선 멈춤 (11-05 디스코드 QA 홍도도)
    def shield_rush(heavy):
        g.js("b.stopBattle(); progress.selectStage('1-1'); window.madOverlordGameV2.switchScreen('menu');")
        g.wait(300)
        g.battle(('head_mech_w', 'body_mech_w', 'arm_mech_w', 'leg_mech_w'), wait_ms=1500)
        g.js("b.setAutoSkills(false); b.spawnInterval = 999; b.playerSpeed = 0; b.playerDps = 0;"
             "b.enemies.filter(e => !e.isBuilding).forEach(e => e.dom && e.dom.remove()); b.enemies = b.enemies.filter(e => e.isBuilding);")
        g.place_enemies(n=3, gap=50, first=110, hp=999999, speed=0, dps=0)
        return g.js(f"""const list = b.enemies.filter(e => !e.isBuilding);
            if ({'true' if heavy else 'false'}) list[0].knockResist = true;
            const x0 = list.map(e => e.x), m0 = b.monsterX;
            b.skillCd.arm = 0; const used = b.useSkill('arm');
            await new Promise(r => setTimeout(r, 900));
            return {{ used, m0, m1: b.monsterX, front: b.frontX(), x0, x1: list.map(e => e.x) }};""")
    st = shield_rush(False)
    ctx.check(st['used'] and st['m1'] > st['m0'] + 60 and min(st['x1']) >= st['front'] - 2 and st['x1'][0] > st['x0'][0] + 40,
              '방패 돌진: 앞으로 나가며 만난 적을 방패 앞으로 밀고 감 (뒤로 빠져나간 적 없음)', str(st))
    st = shield_rush(True)
    ctx.check(st['used'] and st['x1'][0] == st['x0'][0] and st['front'] <= st['x1'][0] + 1,
              '방패 돌진: 밀리지 않는 적(방패병·보스) 바로 앞에서 멈춤', str(st))

    # 세트 그림: 기본 자르는 선 밖으로 나온 장비 끝이 몸통 조각에 남아, 움직이면 그 끝만 떨어져 보이던 것 (11-05 디스코드 QA + 같은 종류 점검)
    mech = json.load(open(os.path.join(ROOT, 'assets/sprites/rig/mech/rig.json'), encoding='utf-8'))['parts']
    kaiju = json.load(open(os.path.join(ROOT, 'assets/sprites/rig/kaiju/rig.json'), encoding='utf-8'))['parts']
    span = lambda p: (p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h'])
    sh, bw = span(mech['armR_fist_w']), span(mech['body_w'])
    ctx.check(sh[1] <= 400 and sh[3] >= 900 and bw[2] <= sh[0] + 200,
              '방주 수호기 방패: 위·아래 끝까지 팔 조각 하나 (몸통에 안 남음)', f'팔 {sh} 몸통 {bw}')
    ctx.check(span(mech['armR_cannon_d'])[3] >= 900, '정찰 저격대 저격포: 총구까지 팔 조각', str(span(mech['armR_cannon_d'])))
    hd, bd = span(kaiju['head_d']), span(kaiju['body_d'])
    ctx.check(hd[2] >= 1190 and bd[2] <= 1130, '악어 턱 머리: 긴 코끝이 머리 조각 (몸통에 안 남음)', f'머리 {hd} 몸통 {bd}')
    # 악어 턱 머리: 아래턱을 벌리면 잘라 돌린 턱 대신 입 벌린 머리 그림(반쯤·다)으로 바꿔 끼움 — 머리·아래턱 경계가 갈라져 보이던 것 (11-06)
    rig_k = json.load(open(os.path.join(ROOT, 'assets/sprites/rig/kaiju/rig.json'), encoding='utf-8'))
    swaps = rig_k.get('poseSwaps', {}).get('head_d', [])
    ok = (len(swaps) == 2 and all(r['bone'] == 'jaw' and 'jaw' in r['hide'] and r['part'] in kaiju
                                  and os.path.exists(os.path.join(ROOT, 'assets/sprites/rig/kaiju', kaiju[r['part']]['src'])) for r in swaps)
          and rig_k.get('limits', {}).get('jaw_d', {}).get('min') == 0)
    ctx.check(ok, '악어 턱 머리: 아래턱을 벌리면 입 벌린 머리 그림으로 바꿔 끼움 (반쯤·다) · 원래 자리 위로는 안 다묾', str(swaps))
    import numpy as np, cv2
    stray = {}
    for v in 'ucdvwlm':
        a = np.asarray(Image.open(os.path.join(ROOT, f'assets/sprites/rig/chimera/torso_{v}.png')).convert('RGBA'))[..., 3] > 0
        n, _, st_, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8), connectivity=8)
        big = sorted(st_[1:, cv2.CC_STAT_AREA], reverse=True)[1:]
        if big and big[0] > 300:
            stray[v] = int(big[0])
    ctx.check(not stray, '합성괴인 2차 세트 몸통: 떨어진 장비 조각(300px 넘는 덩어리) 없음 — 낫 끝·날개 끝은 그 조각으로', str(stray))

    # 적 그림: 걷기 중 가장 낮게 디딘 프레임의 발 아래 빈칸이 6px 이하 (처형인 성기사 15px·블라디미르 43px였음 — bake_sprite.py가 땅 아래를 자름)
    gaps = walk_float()
    floating = {n: round(v, 1) for n, v in gaps.items() if v > 6}
    ctx.check(len(gaps) >= 100 and not floating, f'적 그림 {len(gaps)}종: 걷는 동안 발이 땅에서 뜨지 않음', str(floating))
