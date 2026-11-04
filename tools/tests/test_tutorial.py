"""첫 성장 안내의 실제 행동·저장·복습·보상·소개 순서 검사."""
import json


API = """
const tutorial = await import('/js/engine_v2/tutorial_v2.js');
const store = await import('/js/engine_v2/saveStore_v2.js');
const analytics = await import('/js/engine_v2/analytics_v2.js');
const ui = window.madOverlordGameV2.tutorialUi;
const router = window.madOverlordGameV2;
const finish = victory => {
    b.stats.time=1; b.starFlags=[false,false,false]; b.finishBattle(victory);
};
const clearCoaches = () => document.querySelectorAll('.v2-coach').forEach(el=>el.remove());
"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    st = g.js(API + """
        return [progress.tutorial.status==='active',progress.tutorialStep()==='sortie',
            !document.querySelector('#tutorial-progress-v2').hidden,
            !document.querySelector('[role="dialog"]'),!b.isActive,gameState.darkMatter===2500,
            progress.tutorial.startedAt!==null,progress.tutorial.done.length===0];
    """)
    ctx.check(all(st), '새 저장: 비차단 진행 줄·2500 DM 유지·표시만으로 단계 완료 안 함', str(st))
    g.shot('tutorial_start', '#screen-menu-v2')
    st = g.js(API + """
        const results=[];
        for(const cls of ['v2-loading','v2-mobile-web__portrait','v2-mobile-web__banner']) {
            progress.loadTutorial(null);
            const blocker=document.createElement('div');blocker.className=cls;document.body.appendChild(blocker);
            ui.update();results.push(ui.row.hidden,progress.tutorial.startedAt===null);
            blocker.remove();ui.update();results.push(!ui.row.hidden,progress.tutorial.startedAt!==null);
        }
        const {openSettings}=await import('/js/ui_v2/settingsPanel_v2.js');
        progress.loadTutorial(null);openSettings();ui.update();
        results.push(ui.row.hidden,progress.tutorial.startedAt===null);
        document.querySelector('.v2-settings [data-act="close"]').click();return results;
    """)
    ctx.check(all(st), '로딩·모바일 세로/브라우저 안내·설정 표시 중에는 안내·표시 시각 기록 보류', str(st))
    g.wait(400)
    g.page.click('#btn-to-battle-v2')
    ctx.check(g.js("return progress.tutorial.done.includes('sortie') && b.isActive && !b.autoSkills;"),
              '실제 출격 시작으로 1단계 완료·AUTO 강제 변경 없음')
    g.wait(3300)
    st = g.js(API + """
        const before=progress.tutorial.done.length;
        finish(false);ui.update();
        return [progress.tutorial.done.includes('combat'),progress.tutorial.done.includes('result'),
            progress.tutorialStep()==='lab',progress.tutorial.firstBattle.victory===false,
            !progress.tutorial.rewardClaimed,before<progress.tutorial.done.length];
    """)
    ctx.check(all(st), '조작 없이 패배해도 전투 이해·첫 결과 인정, 보상 자동 지급 없음', str(st))
    g.page.click('.v2-result [data-act="lab"]')
    ctx.check(g.js("return progress.tutorial.done.includes('lab') && progress.tutorialStep()==='compare';"),
              '결과에서 연구소 직행으로 방문 단계 완료')
    g.page.click('.tab-btn-v2[data-slot="arm"]')
    st = g.js(API + """
        const {PARTS_DB}=await import('/js/data/parts.js');
        const part=PARTS_DB.arm.find(p=>p.id==='arm_mech_laser');
        const card=[...document.querySelectorAll('#screen-lab-v2 .part-card')].find(el=>el.textContent.includes(part.name));
        const money=gameState.darkMatter;card.click();
        return [progress.tutorial.done.includes('compare'),!progress.tutorial.done.includes('equip'),
            gameState.darkMatter===money,!progress.isOwned(part.id)];
    """)
    ctx.check(all(st), '실제 구매 가능한 새 파츠 선택으로 비교 인정·선택만으로 구매 단계 인정 안 함', str(st))
    g.shot('tutorial_compare', '#screen-lab-v2')
    g.page.set_viewport_size({'width': 780, 'height': 390})
    g.wait(300)
    st = g.js(API + """
        const skip=ui.row.querySelector('[data-tutorial="skip"]'),r=skip.getBoundingClientRect();
        const overlap=[...document.querySelectorAll('#screen-lab-v2 button')].filter(el=>el!==skip && el.getClientRects().length)
            .some(el=>{const b=el.getBoundingClientRect();return Math.min(r.right,b.right)>Math.max(r.left,b.left) && Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top);});
        return [r.left>=0,r.right<=innerWidth,r.bottom<=innerHeight,!overlap,getComputedStyle(ui.row).pointerEvents==='none'];
    """)
    ctx.check(all(st), '작은 가로 화면: 진행 줄은 입력 통과·건너뛰기가 기존 연구소 단추를 가리지 않음', str(st))
    g.shot('tutorial_small', '#screen-lab-v2')
    g.page.set_viewport_size({'width': 1300, 'height': 740})
    g.page.click('#btn-equip-confirm-v2')
    ctx.check(g.js("return progress.tutorial.done.includes('equip') && progress.tutorial.growthPartId==='arm_mech_laser' && gameState.equippedParts.arm==='arm_mech_laser';"),
              '개조 확정 성공·실제 구매와 장착으로 성장 인정')
    g.js('progress.save();')
    g.reload_v2()
    ctx.check(g.js("return progress.tutorialStep()==='resortie' && progress.tutorial.firstBattle.victory===false;"),
              '새로고침 후 남은 7단계 이어가기')
    g.page.click('#btn-to-battle-v2')
    st = g.js(API + """
        const money=gameState.darkMatter;
        ui.update();
        return [progress.tutorial.status==='complete',progress.tutorial.done.length===7,
            b.stage.id==='1-1',gameState.darkMatter===money,!progress.tutorial.rewardClaimed,
            !ui.row.querySelector('[data-tutorial="claim"]').hidden];
    """)
    ctx.check(all(st), '패배 후 같은 판 재도전으로 7단계 완료·200 DM 직접 받기 표시', str(st))
    st = g.js(API + """
        b.stopBattle();const money=gameState.darkMatter;
        const btn=ui.row.querySelector('[data-tutorial="claim"]');btn.click();btn.click();
        const saved=JSON.parse(store.load('mo_v2_save'));
        const events=analytics.readAnalyticsLog();
        return [gameState.darkMatter===money+200,saved.dm===money+200,saved.tutorial.rewardClaimed,
            events.filter(e=>e.name==='tutorial_complete' && e.mode==='normal').length===1,
            tutorial.TUTORIAL_STEPS.every(id=>events.filter(e=>e.name==='tutorial_step' && e.action==='completed' && e.step_id===id && e.mode==='normal').length===1),
            events.some(e=>e.name==='tutorial_step' && e.action==='shown' && e.step_index===1 && e.tutorial_version===1)];
    """)
    ctx.check(all(st), '직접 수령 연타 방지·DM과 수령 상태 같은 저장·7단계/완료 통계 한 번', str(st))
    money = g.js('return gameState.darkMatter;')
    g.reload_v2()
    ctx.check(g.js(f'return !progress.claimTutorialReward() && gameState.darkMatter==={money};'),
              '수령 직후 새로고침해도 200 DM 중복 지급 없음')
    st = g.js(API + """
        clearCoaches();const original=JSON.stringify(progress.tutorial),money=gameState.darkMatter;
        document.querySelector('#btn-menu-settings-v2').click();
        document.querySelector('[data-act="tutorial-replay"]').click();
        progress.tutorialBattleStart('1-1','normal');progress.tutorialBattleResult('1-1','normal',false);
        progress.tutorialDone('lab');progress.tutorialGrowth('arm_mech_laser');progress.tutorialBattleStart('1-1','normal');
        const replay=analytics.readAnalyticsLog().filter(e=>e.name==='tutorial_complete' && e.mode==='replay');
        const results=[progress.tutorialState().status==='complete',JSON.stringify(progress.tutorial)===original,
            !progress.claimTutorialReward(),gameState.darkMatter===money,replay.length===1];
        progress.resumeTutorial();return results;
    """)
    ctx.check(all(st), '설정 다시 보기: 임시 복습·원래 완료/소개/보상 보존·복습 통계·추가 지급 없음', str(st))
    g.wait(400)
    st = g.js(API + """
        clearCoaches();progress.loadTutorial(null);ui.update();
        progress.tutorialDone('lab');ui.row.querySelector('[data-tutorial="skip"]').click();
        return [progress.tutorial.status==='skipped',progress.tutorial.done.includes('lab'),ui.row.hidden,
            analytics.readAnalyticsLog().some(e=>e.name==='tutorial_skip' && e.completed_count===1)];
    """)
    ctx.check(all(st), '건너뛰기: 완료 행동 보존·진행 줄 숨김·skip 이벤트', str(st))
    g.reload_v2()
    ctx.check(g.js("return progress.tutorial.status==='skipped' && document.querySelector('#tutorial-progress-v2').hidden;"),
              '건너뛴 안내는 새로고침해도 자동 재등장 없음')
    g.js("document.querySelector('#btn-menu-settings-v2').click();document.querySelector('[data-act=\"tutorial-resume\"]').click();")
    g.wait(400)
    ctx.check(g.js("return progress.tutorial.status==='active' && progress.tutorial.done.includes('lab') && progress.tutorialStep()==='sortie';"),
              '설정 이어보기: 남은 단계만 재개')

    # 구매를 먼저 해도 되돌아가기를 요구하지 않는다. 승리 뒤 같은 판 반복은 다음 판 도전과 구별한다.
    st = g.js(API + """
        progress.loadTutorial(null);progress.tutorialDone('lab');
        progress.tutorialGrowth('arm_mech_laser');
        progress.tutorialBattleStart('1-1','normal');
        const results=[progress.tutorial.done.includes('equip'),!progress.tutorial.done.includes('resortie')];
        progress.tutorialBattleResult('1-1','normal',true);progress.tutorialBattleStart('1-1','normal');
        results.push(!progress.tutorial.done.includes('resortie'));
        progress.tutorialBattleStart('1-2','normal');
        results.push(progress.tutorial.status==='complete');return results;
    """)
    ctx.check(all(st), '순서 바꾼 구매·방문 인정·승리 후 같은 판은 보류·다른 열린 판 출격 완료', str(st))
    st = g.js(API + """
        progress.loadTutorial(null);progress.tutorialBattleStart('1-1','normal');
        progress.tutorialBattleStart('1-2','normal');progress.tutorialBattleResult('1-2','normal',false);
        const results=[tutorial.validateTutorial(progress.tutorial),progress.tutorial.firstBattle.stageId==='1-2'];
        progress.tutorialDone('lab');progress.tutorialGrowth('arm_mech_laser');progress.tutorialBattleStart('1-2','normal');
        results.push(progress.tutorial.status==='complete',tutorial.validateTutorial(progress.tutorial));return results;
    """)
    ctx.check(all(st), '첫 출격을 퇴각해도 다음 실제 결과로 이어지고 재도전 완료·저장 유효', str(st))
    st = g.js(API + """
        const old=JSON.parse(store.load('mo_v2_save'));delete old.tutorial;
        const results=[tutorial.hasTutorialHistory(old)];
        for(const field of [{stages:{'1-1':{}}},{tips:['battle_skills']},{owned:['arm_mech_laser']},{levels:{head_mech:2}}]) {
            progress.loadTutorial(field);results.push(progress.tutorial.status==='legacy');
        }
        progress.loadTutorial({dm:2500,owned:['head_red_robot'],stages:{},levels:{},tips:[]});
        results.push(progress.tutorial.status==='active');
        progress.loadTutorial({dm:900});progress.replayTutorial();
        results.push(progress.tutorial.status==='legacy',progress.tutorialState().status==='active');
        progress.resumeTutorial();return results;
    """)
    ctx.check(all(st), '예전 저장: 기록·tips·유료 파츠·강화 흔적은 legacy·빈 저장은 새 안내·복습 가능', str(st))

    st = g.js(API + """
        progress.loadTutorial(null);progress.tutorialDone('lab');progress.tutorialGrowth('arm_mech_laser');
        progress.tutorialBattleStart('1-1','normal');progress.tutorialBattleResult('1-1','normal',true);
        progress.tutorialBattleStart('1-2','normal');progress.claimTutorialReward();
        const rec={stars:[true,true,true],cleared:true,bestTime:1};
        progress.stages={'1-1':rec,'1-3':rec};progress.checkPetRewards();
        progress.loadOffline(null);progress.save();clearCoaches();
        const results=[progress.nextTutorialIntro()===null];
        progress.addOfflineTime(Date.now()-600000,Date.now());progress.save();
        router.switchScreen('menu');ui.update();
        results.push(progress.tutorial.introSeen.join()==='offline',document.querySelectorAll('.v2-coach').length===1,
            document.querySelector('.v2-coach').textContent.includes('접속하지 않아도'));
        ui.update();results.push(progress.tutorial.introSeen.length===1);
        clearCoaches();ui.update();results.push(progress.tutorial.introSeen.join()==='offline,pet',document.querySelector('.v2-coach').textContent.includes('작전 지원 → 펫'));
        clearCoaches();ui.update();results.push(progress.tutorial.introSeen.join()==='offline,pet,shop',document.querySelector('.v2-coach').textContent.includes('상점'));
        clearCoaches();ui.update();results.push(!document.querySelector('.v2-coach'),!progress.hasTip('pet_intro'));
        return results;
    """)
    ctx.check(all(st), '소개: 튜토리얼 완료→실제 방치 적립→첫 펫→노말 1-3 상점, 한 번에 하나·각각 한 번·tips와 별도', str(st))
    g.reload_v2()
    ctx.check(g.js("return progress.tutorial.introSeen.join()==='offline,pet,shop' && progress.nextTutorialIntro()===null;"),
              '새로고침 뒤 소개 중복 없음')
    g.shot('tutorial_complete', '#screen-menu-v2')

    # 백업 실제 왕복과 손상된 선택 필드 거부. 체크섬도 새로 만들어 내부 검사를 검증한다.
    code = g.js("const {exportSave}=await import('/js/engine_v2/progress_v2.js');return exportSave();")
    g.js('gameState.darkMatter=7;progress.save();')
    g.js(f"const {{importSave}}=await import('/js/engine_v2/progress_v2.js');importSave({json.dumps(code)});")
    g.page.wait_for_load_state('load')
    g.enter_v2()
    ctx.check(g.js("return gameState.darkMatter!==7 && progress.tutorial.rewardClaimed && progress.tutorial.introSeen.length===3;"),
              '백업 실제 내보내기·가져오기 왕복: 완료·수령·소개 상태 보존')
    st = g.js(API + """
        const encode=data=>{
            const entries={mo_v2_save:JSON.stringify(data)};
            const payload=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({entries}))));
            let hash=2166136261;for(let i=0;i<payload.length;i++)hash=Math.imul(hash^payload.charCodeAt(i),16777619);
            return `MO1:${payload}:${(hash>>>0).toString(16).padStart(8,'0')}`;
        };
        const base=JSON.parse(store.load('mo_v2_save'));
        const bad=[null,[],{}, {...base.tutorial,version:2},{...base.tutorial,status:'oops'},
            {...base.tutorial,done:['sortie','sortie']},{...base.tutorial,done:['bogus']},
            {...base.tutorial,startedAt:-1},{...base.tutorial,completedAt:'1'},
            {...base.tutorial,rewardClaimed:1},{...base.tutorial,introSeen:['unknown']},
            {...base.tutorial,firstBattle:{stageId:'unknown',difficulty:'normal',victory:true}},
            {...base.tutorial,growthPartId:'unknown'},{...tutorial.emptyTutorial(),rewardClaimed:true},
            {...base.tutorial,extra:true}];
        const before=store.load('mo_v2_save');
        return bad.map(t=>!store.importSave(encode({...base,tutorial:t})).success && store.load('mo_v2_save')===before);
    """)
    ctx.check(all(st), '백업 손상 tutorial 15종 거부·기존 저장 보존', str(st))
    st = g.js(API + """
        const results=[];
        for(const bad of [null,{}, {...tutorial.emptyTutorial(),done:['invalid']}]) {
            progress.loadTutorial({tutorial:bad,dm:777});
            results.push(progress.tutorial.status==='legacy',gameState.darkMatter!==777);
        }
        const {setSaveStore}=store;const data=new Map();
        setSaveStore({load:k=>data.get(k)??null,save:(k,v)=>data.set(k,v),remove:k=>data.delete(k)});
        progress.loadTutorial(null);progress.tutorialDone('lab');progress.save();
        results.push(JSON.parse(store.load('mo_v2_save')).tutorial.done.includes('lab'));
        return results;
    """)
    ctx.check(all(st), '일반 로드 손상 안내만 초기화·진행 보존·메모리 저장 통로 지원', str(st))

    old = ctx.game(fresh=True)
    old.enter_v2()
    old.js("const data=JSON.parse(localStorage.getItem('mo_v2_save'));delete data.tutorial;data.tips=['battle_skills'];localStorage.setItem('mo_v2_save',JSON.stringify(data));")
    old.reload_v2()
    ctx.check(old.js("return progress.tutorial.status==='legacy' && document.querySelector('#tutorial-progress-v2').hidden && !document.querySelector('[role=\"dialog\"]');"),
              '실제 옛 저장 로드: legacy·자동 진행 줄과 팝업 없음')
    st = old.js(API + """
        document.querySelector('#btn-menu-settings-v2').click();document.querySelector('[data-act="tutorial-resume"]').click();
        progress.tutorialDone('lab');progress.tutorialGrowth('arm_red_robot');
        progress.tutorialBattleStart('1-1','normal');progress.tutorialBattleResult('1-1','normal',false);progress.tutorialBattleStart('1-1','normal');
        return [progress.tutorialState().status==='complete',progress.tutorial.status==='legacy',!progress.claimTutorialReward()];
    """)
    ctx.check(all(st), 'legacy 이어보기도 복습 상태·완료해도 200 DM 지급 없음', str(st))
