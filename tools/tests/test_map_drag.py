"""스테이지 지도 위아래 끌기 (11-05 피드백 16번): 휴대폰 가로에서 지도가 화면보다 높아 위·아래 정거장을 못 누르던 것 — 위아래로 끌어 모든 정거장을 화면 안에 들이고, 좌우 밀기(구역 넘기기)는 그대로."""

# 지금 구역의 정거장마다 누르는 발판(.v2-smap__pad)이 화면(지도 칸) 안에 다 들어오는가
# (정거장 단추 칸은 발판 위 적 그림까지 포함해, 지도 그림 맨 위에 붙은 정거장은 칸 윗부분이 늘 지도 밖 — 누르는 곳은 발판)
STOPS_IN = """const sm = window.madOverlordGameV2.menuController.stageMap;
    const page = sm.track.children[sm.index], pr = page.getBoundingClientRect();
    return [...page.querySelectorAll('.v2-smap__stop .v2-smap__pad')].map(s => { const r = s.getBoundingClientRect(); return r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1; });"""
CAM_EXPR = "(parseFloat(window.madOverlordGameV2.menuController.stageMap.track.children[window.madOverlordGameV2.menuController.stageMap.index].querySelector('.v2-smap__land').style.getPropertyValue('--cam')) || 0)"
CAM = f"return {CAM_EXPR};"


def run(ctx):
    g = ctx.game(fresh=True, viewport=(800, 360), touch=True)
    g.enter_v2()
    g.js("const { unlockAllStagesTemp } = await import('/js/engine_v2/stages_v2.js'); unlockAllStagesTemp(); window.madOverlordGameV2.menuController.renderStages();")
    g.page.click('#menu-stage-card-v2 .v2-mstage__pick')
    g.wait(400)
    tall = g.js("const sm = window.madOverlordGameV2.menuController.stageMap; const page = sm.track.children[sm.index]; return page.querySelector('.v2-smap__land').offsetHeight - page.clientHeight;")
    ctx.check(tall > 40, '휴대폰 가로 800×360: 지도가 화면보다 높음 (끌어야 할 이유)', str(tall))

    # 구역 10개 × 정거장 11개: 맨 위에서 맨 아래까지 40px씩 끌어 내려가는 동안 모든 정거장이 한 번은 화면 안에 다 들어옴
    hidden_before, unreachable = 0, []
    for z in range(1, 11):
        g.map_zone(f'ch{z}')
        g.wait(450)
        hidden_before += sum(not v for v in g.js(STOPS_IN))
        seen = g.js("const sm = window.madOverlordGameV2.menuController.stageMap; sm._dragY({ dy: 5000 }); const seen = [];"
                    "for (let k = 0; k < 40; k++) { (() => { " + STOPS_IN + " })().forEach((v, i) => { seen[i] = seen[i] || v; }); sm._dragY({ dy: -40 }); }"
                    "return seen;")
        miss = [i + 1 for i, v in enumerate(seen) if not v]
        if len(seen) != 11 or miss:
            unreachable.append(f'{z}구역 {len(seen)}개 중 {miss}')
    ctx.check(hidden_before > 0, '끌기 전: 화면 밖으로 잘린 정거장이 있음 (고치기 전 문제)', str(hidden_before))
    ctx.check(not unreachable, '구역 10개 × 정거장 11개: 위아래로 끌면 모두 화면 안에 들어옴', '; '.join(unreachable))

    # 실제 손가락처럼 끌기 — 위아래는 지도만 움직이고 구역은 그대로
    g.map_zone('ch8')
    g.wait(450)
    box = g.page.locator('.v2-smap').bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    before = {'cam': g.js(CAM), 'zone': g.js("return window.madOverlordGameV2.menuController.stageMap.viewed.zone;"), 'sel': g.js("return progress.selectedStage;")}
    g.page.mouse.move(cx, cy)
    g.page.mouse.down()
    g.page.mouse.move(cx + 6, cy + 90, steps=8)   # 8구역은 첫 판이 지도 아래쪽이라 처음엔 맨 아래 — 아래로 끌어 위쪽을 봄
    g.page.mouse.up()
    g.wait(200)
    after = {'cam': g.js(CAM), 'zone': g.js("return window.madOverlordGameV2.menuController.stageMap.viewed.zone;"), 'sel': g.js("return progress.selectedStage;")}
    ctx.check(after['cam'] > before['cam'] + 30 and after['zone'] == before['zone'] and after['sel'] == before['sel'],
              '손가락으로 아래로 끌기: 지도가 따라 내려오고 구역·고른 판은 그대로', f'{before} → {after}')
    g.page.mouse.move(cx, cy)
    g.page.mouse.down()
    g.page.mouse.move(cx, cy + 700, steps=10)
    g.page.mouse.up()
    g.wait(200)
    ctx.check(abs(g.js(CAM)) < 0.5, '아래로 많이 끌면 지도 맨 위에서 멈춤 (가장자리 밖으로 안 나감)', str(g.js(CAM)))

    # 끈 자리는 유지되다가 정거장을 누르면 다시 캐릭터를 따라감
    g.js("window.madOverlordGameV2.menuController.stageMap._camera(true);")
    ctx.check(abs(g.js(CAM)) < 0.5, '창 크기가 바뀌어도(카메라 다시 계산) 끈 자리 그대로', str(g.js(CAM)))
    g.js("""const sm = window.madOverlordGameV2.menuController.stageMap;
        const stops = [...sm.track.children[sm.index].querySelectorAll('.v2-smap__stop')];
        stops[1].click();""")
    g.wait(2600)
    st = g.js("const sm = window.madOverlordGameV2.menuController.stageMap; return { look: sm.look, sel: progress.selectedStage, cam: " + CAM_EXPR + " };")
    ctx.check(st['look'] is None and st['sel'] == '8-2' and st['cam'] < -1, '정거장을 누르면 걸어가고 카메라는 다시 캐릭터를 따라감 (8-2 고름)', str(st))

    # 좌우 밀기는 그대로 — 구역 넘기기
    g.page.mouse.move(cx + 120, cy)
    g.page.mouse.down()
    g.page.mouse.move(cx - 200, cy + 10, steps=8)
    g.page.mouse.up()
    g.wait(600)
    z = g.js("return window.madOverlordGameV2.menuController.stageMap.viewed.zone;")
    ctx.check(z == 9, '왼쪽으로 밀기: 다음 구역(9)으로 넘어감 — 좌우 밀기는 그대로', str(z))
    g.shot('map_drag', '#screen-menu-v2')

    # PC: 휠로 위아래 (창이 납작할 때)
    p = ctx.game(fresh=True, viewport=(1300, 520))
    p.enter_v2()
    p.js("const { unlockAllStagesTemp } = await import('/js/engine_v2/stages_v2.js'); unlockAllStagesTemp(); window.madOverlordGameV2.menuController.renderStages();")
    p.map_zone('ch8')
    p.wait(450)
    room = p.js("const sm = window.madOverlordGameV2.menuController.stageMap; const page = sm.track.children[sm.index]; return page.querySelector('.v2-smap__land').offsetHeight - page.clientHeight;")
    if room > 20:
        c0 = p.js(CAM)
        box = p.page.locator('.v2-smap').bounding_box()
        p.page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        p.page.mouse.wheel(0, -400 if c0 < -1 else 400)
        p.wait(200)
        ctx.check(abs(p.js(CAM) - c0) > 10, 'PC: 마우스 휠로 지도 위아래', f'{c0} → {p.js(CAM)}')
    else:
        ctx.check(True, 'PC: 지도가 창보다 높지 않아 휠 이동 필요 없음', str(room))
