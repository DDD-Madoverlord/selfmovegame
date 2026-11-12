"""전투: 캐릭터 4종 기본 공격·스킬 1·2·필살기, HUD, 일시정지·배속, 다리 패시브(궤도 돌진, 반중력 부양)"""
from common import BUILDS


# 다른 파일(skills_v2, enemies_v2, HUD, 연출, 검사)이 부르는 전투 엔진 메서드 — battle/ 폴더를 고치다 이름이 바뀌거나 빠지면 바로 걸림
PUBLIC_API = ['applyAcid', 'applyPlayerSlow', 'applyPlayerStun', 'applyShield', 'collapseBase', 'convertEnemy',
              'createDamagePopup', 'damageAlly', 'damagePlayer', 'dealDamageToEnemy', 'enemiesInRange', 'fireMissile',
              'frontX', 'launchDarkWave', 'launchDrones', 'layEgg', 'legContact', 'nearestEnemy', 'playerStunned',
              'schedule', 'setAutoSkills', 'skillState', 'slowEnemy', 'spawnAllyMinion', 'stunEnemy', 'timeLeft', 'unit',
              'updateHud', 'useSkill', 'spawnMinion', 'startBattle', 'stopBattle', 'finishBattle', 'fireAttack']


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    missing = g.js(f"return {PUBLIC_API}.filter(n => typeof b[n] !== 'function');")
    ctx.check(not missing, '전투 엔진: 다른 파일이 부르는 메서드가 모두 있음', str(missing))

    for cid in BUILDS:
        g.battle(cid)
        g.place_enemies()
        g.wait(1500)
        st0 = g.js("return { rig: m.useRig, char: m.getCharacterId(), hp: b.enemies.filter(e => !e.isBuilding).map(e => e.hp) };")
        ctx.check(st0['rig'] and st0['char'] == cid, f'{cid}: 리그 캐릭터로 전투')
        ctx.check(any(h < 4000 for h in st0['hp']), f'{cid}: 기본 공격이 적에게 피해', str([round(h) for h in st0['hp']]))
        g.js('b.ultGauge = 1;')
        g.key('1')
        g.wait(250)
        g.key('2')
        g.wait(250)
        g.key('Space')
        g.wait(1500)
        st = g.js("return { cd: b.skillCd, gauge: b.ultGauge, dock: document.querySelectorAll('#skill-dock-v2 .v2-skill').length };")
        ctx.check(st['cd']['arm'] > 0 and st['cd']['body'] > 0, f'{cid}: 스킬 1·2 사용 (쿨타임 시작)', str(st['cd']))
        ctx.check(st['gauge'] < 0.5, f'{cid}: 필살기 사용 (게이지 소모)', f"{st['gauge']:.2f}")
        ctx.check(st['dock'] == 3, f'{cid}: 스킬 버튼 3개')
        g.shot(f'battle_{cid}', '#screen-battle-v2')

    # 일시정지 / 배속
    g.page.click('#btn-pause-v2')
    d1 = g.js('return b.distanceTraveled;')
    g.wait(500)
    d2 = g.js('return [b.distanceTraveled, gameTime.paused];')
    ctx.check(d2[1] and abs(d2[0] - d1) < 0.01, '일시정지: 진행 멈춤')
    g.page.click('#btn-resume-v2')
    g.page.click('#btn-speed-v2')
    ctx.check(g.js('return gameTime.speed;') == 2, '배속 2x')
    g.page.click('#btn-speed-v2')

    # 다리 패시브: 궤도 돌진 (처음 맞닿은 적을 밀쳐내고 기절)
    g.battle(('head_red_robot', 'body_red_robot', 'arm_red_robot', 'leg_mech_wheel'))
    g.place_enemies(n=1, first=150, hp=9000, speed=80)
    g.wait(1500)
    st = g.js("const e = b.enemies.find(e => !e.isBuilding); return { rammed: e && e.rammedAt != null, hp: e && e.hp };")
    ctx.check(st['rammed'], '다리 패시브 궤도 돌진: 맞닿은 적 돌진', str(st))

    # 다리 패시브: 반중력 부양 (근접 피해 30% 감소)
    g.battle(('head_hero', 'body_hero', 'arm_hero_wave', 'leg_hero_hover'), wait_ms=600)
    g.js('b.shieldHp = 0; b.playerHp = 1000; b.damagePlayer(100, 0.016);')
    hp = g.js('return b.playerHp;')
    taken = g.js('return b.roleTaken * b.sigIncomingMul();')   # 원거리 파동 팔: 받는 피해 ×1.2 (D-119)
    ctx.check(abs(hp - (1000 - 70 * taken)) < 0.01, '다리 패시브 반중력 부양: 피해 30% 감소 (원거리 배율과 곱함)', f'{hp} (원거리 배율 {taken})')
