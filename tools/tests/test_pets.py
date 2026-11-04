"""펫 지급·성장·전투·상점 권한·백업 검사."""
import json


API = """
const pets = await import('/js/engine_v2/pets_v2.js');
const store = await import('/js/engine_v2/saveStore_v2.js');
const { readAnalyticsLog } = await import('/js/engine_v2/analytics_v2.js');
const { setReleaseSchedule } = await import('/js/engine_v2/contentSchedule_v2.js');
"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    ctx.check(g.js("return progress.pets.owned.length===0 && progress.pets.equipped===null && !document.querySelector('.v2-growth');"),
              '새 저장: 빈 펫·미장착·자동 창 없음')
    st = g.js(API + """
        const { openGrowthPanel, closeGrowthPanel } = await import('/js/ui_v2/growthUi_v2.js');
        openGrowthPanel(); const locked=document.querySelector('[data-tab="pets"]').disabled; closeGrowthPanel();
        const result=progress.recordStage('1-1',{stars:[true,true,true],cleared:true,time:20},'normal');
        const once=readAnalyticsLog().filter(e=>e.name==='pet_get' && e.petId==='scrap_drone').length;
        progress.checkPetRewards(); progress.checkPetRewards();
        return [locked,result.pets.includes('scrap_drone'),progress.ownsPet('scrap_drone'),progress.pets.equipped===null,
            !document.querySelector('.v2-growth'),progress.petBattleDmBonus()===0,
            readAnalyticsLog().filter(e=>e.name==='pet_get' && e.petId==='scrap_drone').length===once,
            JSON.parse(store.load('mo_v2_save')).pets.owned.includes('scrap_drone'),progress.hasNewPet()];
    """)
    ctx.check(all(st), '1-1 첫 클리어: 한 번 지급·즉시 저장·자동 장착과 팝업 없음', str(st))

    # 예전 저장을 실제 시작 경로로 다시 읽는다.
    g.js("progress.save(); const old=JSON.parse(localStorage.getItem('mo_v2_save')); delete old.pets; localStorage.setItem('mo_v2_save',JSON.stringify(old));")
    g.reload_v2()
    st = g.js(API + """
        const gets=readAnalyticsLog().filter(e=>e.name==='pet_get' && e.source==='migration');
        const count=gets.length; progress.checkPetRewards('migration');
        return [progress.ownsPet('scrap_drone'),progress.pets.equipped===null,gets.some(e=>e.petId==='scrap_drone'),
            count===readAnalyticsLog().filter(e=>e.name==='pet_get' && e.source==='migration').length];
    """)
    ctx.check(all(st), '펫 필드 없는 옛 저장: 소급 지급 한 번·미장착', str(st))
    st = g.js(API + """
        progress.spentStars=999;
        progress.diffStages.hard={'1-2':{stars:[true,true,true],cleared:true,bestTime:1}};
        const before=progress.normalPetStars();
        progress.recordStage('2-B',{stars:[false,false,false],cleared:true,time:1},'hard');
        const noHard=!progress.ownsPet('cinder_larva') && progress.normalPetStars()===before;
        const { STAGES }=await import('/js/engine_v2/stages_v2.js');
        for(const s of STAGES.filter(s=>s.zone===1).slice(0,10)) progress.recordStage(s.id,{stars:[true,true,true],cleared:true,time:1},'normal');
        progress.recordStage('2-B',{stars:[true,true,true],cleared:true,time:1},'normal');
        progress.recordStage('4-B',{stars:[true,true,true],cleared:true,time:1},'normal');
        setReleaseSchedule({zones:{7:'2099-01-01'},characters:{}});
        progress.recordStage('7-B',{stars:[true,true,true],cleared:true,time:1},'normal');
        const unreleased=!progress.ownsPet('clockwork_keeper'); setReleaseSchedule(null); progress.checkPetRewards();
        return [noHard,progress.ownsPet('cinder_larva'),progress.ownsPet('void_eye'),progress.ownsPet('abyss_lantern'),
            progress.normalPetStars()>=30,unreleased,progress.ownsPet('clockwork_keeper')];
    """)
    ctx.check(all(st), '노말 조건·소비 전 누적 별·공개된 구역만 진행 지급', str(st))

    st = g.js(API + """
        const r=[!progress.equipPet('missing').success,progress.equipPet('scrap_drone').success,progress.petBattleDmBonus()===0.01];
        const count=readAnalyticsLog().filter(e=>e.name==='pet_equip').length;
        progress.equipPet('scrap_drone');
        r.push(readAnalyticsLog().filter(e=>e.name==='pet_equip').length===count);
        progress.selectCharacter('kaiju'); r.push(progress.pets.equipped==='scrap_drone');
        progress.equipPet(null); r.push(progress.petBattleDmBonus()===0);
        gameState.darkMatter=0;progress.shards=0;
        r.push(!progress.upgradePet('scrap_drone').success,progress.petLevel('scrap_drone')===1,gameState.darkMatter===0);
        gameState.darkMatter=49500;progress.shards=9;
        const expected=[[300,0],[900,0],[1800,0],[3000,1],[4500,1],[6300,1],[8400,2],[10800,2],[13500,2]];
        expected.forEach(([dm,shards],i)=>{
            const cost=progress.petUpgradeCost('scrap_drone');
            r.push(cost.dm===dm && cost.shards===shards);
            if(i===3){const money=gameState.darkMatter;progress.shards=0;r.push(!progress.upgradePet('scrap_drone').success && money===gameState.darkMatter && progress.petLevel('scrap_drone')===4);progress.shards=9;}
            r.push(progress.upgradePet('scrap_drone').success);
        });
        r.push(gameState.darkMatter===0,progress.shards===0,progress.petLevel('scrap_drone')===10,
            progress.petUpgradeCost('scrap_drone')===null,!progress.upgradePet('scrap_drone').success);
        progress.equipPet('scrap_drone'); r.push(progress.petBattleDmBonus()===0.055);
        progress.equipPet('abyss_lantern');progress.pets.levels.abyss_lantern=10;r.push(progress.petOfflineDmBonus()===0.11,progress.petBattleDmBonus()===0);
        let settled=null;progress.settleOfflineBeforePet=now=>{settled={now,id:progress.pets.equipped,level:progress.petLevel('cinder_larva')};};
        progress.equipPet('cinder_larva',12345);r.push(settled.now===12345 && settled.id==='abyss_lantern');
        gameState.darkMatter=300;progress.upgradePet('cinder_larva',23456);
        r.push(settled.now===23456 && settled.level===1 && progress.petLevel('cinder_larva')===2);
        delete progress.settleOfflineBeforePet;
        return r;
    """)
    ctx.check(all(st), '장착·해제·캐릭터 변경·9단계 비용·DM 및 조각 부족·최대 레벨·방치 조회', str(st))

    st = g.js(API + """
        const valid={owned:['scrap_drone','future_pet'],levels:{scrap_drone:4},equipped:'future_pet',earned:['scrap_drone']};
        progress.loadPets({pets:valid});
        const r=[progress.pets.equipped===null,progress.ownsPet('future_pet'),progress.petLevel('future_pet')===1];
        progress.loadPets({pets:{...valid,equipped:'not_owned'}});r.push(progress.ownsPet('scrap_drone'),progress.pets.equipped===null);
        progress.loadPets({pets:'invalid'});r.push(progress.pets.owned.length===0);
        progress.checkPetRewards();return r;
    """)
    ctx.check(all(st), '직접 로드: 누락 레벨 1·미보유 장착 해제·미지 ID 보존·손상 펫 초기화', str(st))

    g.equip('mech')
    st = g.js(API + """
        const { stageById }=await import('/js/engine_v2/stages_v2.js');
        const stage=stageById('1-1'), base=JSON.stringify(stage);
        progress.equipPet(null); progress.research={};
        const r=[b.growthStage(stage)===stage];
        progress.equipPet('scrap_drone');progress.pets.levels.scrap_drone=10;
        progress.research={dmBoost:3};const boosted=b.growthStage(stage);
        r.push(['kill','mid','final'].every(k=>boosted.reward[k]===Math.round(stage.reward[k]*1.205)),JSON.stringify(stage)===base);
        progress.research.dmBoost=999;const capped=b.growthStage(stage);
        r.push(['kill','mid','final'].every(k=>capped.reward[k]===Math.round(stage.reward[k]*1.25)));
        const money=gameState.darkMatter;progress.recordStage('1-1',{stars:[true,true,true],cleared:true,time:1},'normal');r.push(gameState.darkMatter===money);
        progress.stages['1-1'].stars=[false,false,false];const starMoney=gameState.darkMatter;
        const result=progress.recordStage('1-1',{stars:[true,true,true],cleared:true,time:1},'normal');
        r.push(result.bonus===900,gameState.darkMatter===starMoney+900);
        const {DROP,DISPATCH}=await import('/js/engine_v2/growth_v2.js');
        progress.grantPart('head_mech','common');const refundMoney=gameState.darkMatter;
        const refund=progress.grantPart('head_mech','common');
        r.push(refund.dm===DROP.refund.common.dm,gameState.darkMatter===refundMoney+DROP.refund.common.dm);
        progress.dispatch=[{character:'mech',zone:1,start:0,end:1}];const dispatchMoney=gameState.darkMatter;
        progress.collectDispatch(0,2,()=>1);r.push(gameState.darkMatter===dispatchMoney+DISPATCH.reward(1).dm);
        progress.research={};progress.equipPet(null);return r;
    """)
    ctx.check(all(st), '전투 DM: 미장착 동일·kill/mid/final만 합산·25% 상한·별 보너스 제외·원본 데이터 보존', str(st))

    g.battle('mech', wait_ms=200)
    st = g.js(API + """
        cancelAnimationFrame(b.loopId);b.loopId=null;
        b.kitPatch={};b.kitMod=()=>0;b.mutator=null;b.skillLevels={};
        b.gear={cdr:0.32};b.petBonuses={cdr:0.0275};
        const near=b.skillCooldown('arm',{id:'test',cd:10});
        b.gear.cdr=0.34;const capped=b.skillCooldown('body',{id:'test',cd:10});
        const ult=b.skillCooldown('head',{id:'test',cd:10,ult:true});
        const module=b.skillCooldown('mod1',{id:'test',cd:10,module:true});
        b.petBonuses=null;const bare=b.skillCooldown('arm',{id:'test',cd:10});
        return [Math.abs(near-6.525)<1e-9,Math.abs(capped-6.5)<1e-9,Math.abs(ult-6.6)<1e-9,
            Math.abs(module-6.6)<1e-9,Math.abs(bare-6.6)<1e-9];
    """)
    ctx.check(all(st), '쿨다운: 0.35 직전·상한·필살기와 모듈에 펫 미적용·미장착 동일', str(st))
    # 같은 엔진의 공통 피해 경로로 방어·흡혈 제외와 처치 보상까지 확인한다.
    st = g.js(API + """
        progress.equipPet('cinder_larva');progress.pets.levels.cinder_larva=10;
        b.setupPet();b.isActive=true;b.finalBaseDestroyed=false;b.timeUp=false;
        const pet=b.pet, front=b.frontX();let hits=[];
        const original=b.dealDamageToEnemy;
        b.dealDamageToEnemy=(e,amount,crit,react)=>hits.push({id:e.id,amount,crit,dot:react.dot});
        b.enemies=[{id:'far',hp:100,x:front+b.playerRange+1},{id:'dead',hp:0,x:front+1},
            {id:'immune',hp:100,x:front+1,invulnerable:true},{id:'near',hp:100,x:front+10},{id:'next',hp:100,x:front+20}];
        b.tickPet(1.99);const noEarly=hits.length===0;b.tickPet(0.01);
        const hit=hits.length===1 && hits[0].id==='near' && hits[0].crit===false && hits[0].dot
            && Math.abs(hits[0].amount-b.playerDps*0.065*2)<1e-9;
        b.enemies=[];b.tickPet(8);b.enemies=[{id:'new',hp:100,x:front+10}];b.tickPet(0.1);
        const noBank=hits.length===1;b.tickPet(1.9);const second=hits.length===2;
        const oldX=pet.x;b.monsterX+=120;b.tickPet(0);const paused=pet.x===oldX;b.tickPet(0.1);
        const follow=pet.x>oldX && pet.x<b.monsterX-60;
        const separate=!b.allies.includes(pet) && getComputedStyle(pet.dom).pointerEvents==='none';
        b.dealDamageToEnemy=original;
        b.enemies=[];b.spawnMinion();const e=b.enemies[0];e.hp=e.maxHp=10000;e.armor=0.5;e.x=b.frontX()+10;
        b.gear={};b.kitTargetMul=()=>1;b.pWeakT=0;b.lifesteal=()=>{throw new Error('펫 흡혈 금지');};
        b.pet.attackTimer=0;const hp=e.hp;b.tickPet(2);
        const armor=Math.abs(hp-e.hp-b.playerDps*0.065)<1e-7;
        const money=gameState.darkMatter;e.hp=0.01;b.pet.attackTimer=0;b.tickPet(2);
        const killed=!b.enemies.includes(e) && gameState.darkMatter>money;
        const dom=pet.dom;b.stopBattle();
        return [noEarly,hit,noBank,second,paused,follow,separate,armor,killed,b.pet===null,!dom.isConnected,b.petBonuses===null];
    """)
    ctx.check(all(st), '자동 공격 2초·가장 가까운 유효 사거리 적·기회 미저장·추종·정지·아군 분리·방어·처치·퇴각 정리', str(st))
    # 조작한 전투 메서드는 다음 검사에 남기지 않는다.
    g.reload_v2()
    g.equip('mech')
    g.js("progress.equipPet('scrap_drone');")
    g.battle(wait_ms=2800)
    g.page.click('#btn-pause-v2')
    paused = g.js("return {time:b.pet.time,x:b.pet.x,timer:b.pet.attackTimer};")
    g.wait(350)
    ctx.check(g.js("return {time:b.pet.time,x:b.pet.x,timer:b.pet.attackTimer};") == paused, '실제 게임 일시정지에 펫 추종·공격 시간 정지')
    g.js("gameTime.paused=false;gameTime.freezeUntil=performance.now()+500;")
    frozen = g.js("return b.pet.time;")
    g.wait(200)
    ctx.check(g.js("return b.pet.time;") == frozen, '히트스톱에 펫 시간 정지')
    g.js("gameTime.reset();gameTime.speed=2;")
    t0 = g.js("return b.pet.time;")
    g.wait(300)
    ctx.check(g.js("return b.pet.time;") - t0 > 0.4, '배속에 펫 게임 시간 함께 증가')
    g.js("b.stopBattle();window.madOverlordGameV2.switchScreen('menu');")

    # 카드 조작·작은 가로 화면.
    g.js("(await import('/js/ui_v2/growthUi_v2.js')).openGrowthPanel('pets');")
    ctx.check(g.page.locator('.v2-petcard').count() == 5, '펫 카드 5종·획득 조건·진행률 표시')
    g.wait(400)
    st = g.js("""return [...document.querySelectorAll('.v2-petcard .v2-pet')].map(p => { const i = p.querySelector('img');
        return [p.closest('.v2-petcard').dataset.pet, !p.dataset.shape && !!i && i.complete && i.naturalWidth >= 128, Math.round(p.getBoundingClientRect().width)]; });""")
    ctx.check(len(st) == 5 and all(ok and w == 52 for _, ok, w in st), '펫 그림 5종 (assets/sprites/pets/*.webp, 카드 52px)', str(st))
    g.page.click('[data-pet="scrap_drone"] [data-act="equipPet"]')
    ctx.check(g.js("return progress.pets.equipped===null;"), '펫 카드에서 장착 해제')
    g.page.click('[data-pet="scrap_drone"] [data-act="equipPet"]')
    ctx.check(g.js("return progress.pets.equipped==='scrap_drone';"), '펫 카드에서 장착')
    g.page.set_viewport_size({'width': 854, 'height': 480})
    g.shot('pets')
    g.key('Escape')

    # 정상 백업 왕복, 잘못된 pets는 기존 저장을 바꾸지 않아야 한다.
    code = g.js("return (await import('/js/engine_v2/progress_v2.js')).exportSave();")
    saved = g.js("return JSON.parse(localStorage.getItem('mo_v2_save')).pets;")
    st = g.js(API + """
        const snapshot=store.load('mo_v2_save'), data=JSON.parse(snapshot);
        const pack=p=>{const payload=btoa(unescape(encodeURIComponent(JSON.stringify({entries:{mo_v2_save:JSON.stringify({...data,pets:p})}}))));
            let hash=2166136261;for(let i=0;i<payload.length;i++)hash=Math.imul(hash^payload.charCodeAt(i),16777619);
            return `MO1:${payload}:${(hash>>>0).toString(16).padStart(8,'0')}`;};
        const valid={owned:['scrap_drone','future'],levels:{scrap_drone:1},earned:['scrap_drone'],equipped:null};
        const cases=['invalid',null,[],{...valid,owned:['scrap_drone','scrap_drone']},{...valid,earned:['missing']},
            {...valid,equipped:'missing'},{...valid,levels:{missing:1}},{...valid,levels:{scrap_drone:0}},
            {...valid,levels:{scrap_drone:11}},{...valid,levels:{scrap_drone:1.5}},{...valid,earned:['scrap_drone','scrap_drone']},
            {...valid,levels:[]},{...valid,unknown:true}];
        return [pets.validatePets(valid),...cases.map(p=>{const r=store.importSave(pack(p));return !r.success && r.reason.includes('펫') && store.load('mo_v2_save')===snapshot;})];
    """)
    ctx.check(all(st), '백업 pets: 미지 ID 허용·중복·레벨·소유 관계·손상 모양 엄격 거부 및 기존 저장 보존', str(st))
    g.js("progress.equipPet(null);")
    with g.page.expect_navigation():
        g.js(f"(await import('/js/engine_v2/progress_v2.js')).importSave({json.dumps(code)});")
    g.enter_v2()
    ctx.check(g.js("return progress.pets;") == saved, '펫 보유·레벨·장착·무료 획득 기록 백업 왕복')

    # 로컬에서도 명시적으로 켠 시험에서만 구매한다.
    normal = g.js("return localStorage.getItem('mo_v2_save');")
    g.page.goto(g.base + '/index.html?mockCommerce=1')
    g.enter_v2()
    st = g.js(API + """
        const {emptyCommerce}=await import('/js/engine_v2/progressCommerce_v2.js');
        const {isMockCommerce}=await import('/js/engine_v2/commerceDev_v2.js');
        const {DAY_MS,kstDayKey}=await import('/js/engine_v2/kstTime_v2.js');
        progress.pets=pets.emptyPets();progress.commerce=emptyCommerce();
        setReleaseSchedule({zones:{7:'2099-01-01'},characters:{}});
        const hidden=progress.commerceProductState('pet_clockwork_keeper')==='공개 예정';setReleaseSchedule(null);
        progress.pets={owned:['scrap_drone'],levels:{scrap_drone:10},earned:['scrap_drone'],equipped:'scrap_drone'};
        progress.research={dmBoost:3};const supplyMoney=gameState.darkMatter;
        await progress.purchaseProduct('supply_small');
        const exactSupply=gameState.darkMatter===supplyMoney+3000;
        const dm=gameState.darkMatter, shards=progress.shards;
        const bought=await progress.purchaseProduct('pet_clockwork_keeper');
        const purchase=[hidden,exactSupply,isMockCommerce(),bought.success,progress.ownsPet('clockwork_keeper'),progress.petLevel('clockwork_keeper')===1,
            gameState.darkMatter===dm,progress.shards===shards,!progress.pets.earned.includes('clockwork_keeper'),
            progress.equipPet('clockwork_keeper').success,progress.commerceProductState('pet_clockwork_keeper')==='보유 중'];
        progress.commerce.permanents={};await progress.restorePurchases();await progress.restorePurchases();
        purchase.push(progress.hasPetEntitlement('clockwork_keeper'),gameState.darkMatter===dm,progress.shards===shards);
        progress.pets=pets.emptyPets();await progress.restorePurchases();
        purchase.push(progress.ownsPet('clockwork_keeper'),!progress.pets.earned.includes('clockwork_keeper'),progress.shards===shards);
        progress.pets=pets.emptyPets();progress.commerce=emptyCommerce();
        // 지금 시각 기준(내일 한국시간 정오) — 고정 날짜는 그 날이 지나면 구매 뒤 lastSeenAt(실제 시각)보다 과거라 '시계 되돌림'으로 막혀 실패함
        const start=Date.parse(kstDayKey(Date.now()+DAY_MS)+'T12:00:00+09:00');
        await progress.purchaseProduct('weekly_pass_7d',start);
        const before=progress.shards;
        for(let i=0;i<7;i++) progress.claimPass(start+i*DAY_MS);
        purchase.push(progress.ownsPet('clockwork_keeper'),progress.canUsePet('clockwork_keeper'),progress.shards===before+21,
            !progress.pets.earned.includes('clockwork_keeper'),!progress.claimPass(start+6*DAY_MS).success);
        await progress.purchaseProduct('weekly_pass_7d',start+7*DAY_MS);
        const again=progress.shards;
        for(let i=7;i<14;i++) progress.claimPass(start+i*DAY_MS);
        const once=progress.shards;progress.resolvePendingCommercePets();
        purchase.push(progress.shards===again+22,progress.shards===once);
        const gets=readAnalyticsLog().filter(e=>e.name==='pet_get' && e.source==='shop');
        purchase.push(gets.some(e=>e.sourceId && e.providerMode==='mock'));
        try{store.exportSave();purchase.push(false);}catch(e){purchase.push(e.message.includes('시험'));}
        return purchase;
    """)
    ctx.check(all(st), '시험 상품: 펫만 Lv1 지급·복원·보유 구매 차단 / 패스 7회째 지급·다음 주 중복 조각 1·재요청 무지급', str(st))
    # 방치 보상(⑧)이 페이지를 떠날 때 시각(offline·savedAt)만 갱신할 수 있음 — 시험 구매·펫과 무관한 시간 기록은 빼고 비교
    def without_time(text):
        d = json.loads(text or 'null') or {}
        d.pop('offline', None)
        d.pop('savedAt', None)
        if isinstance(d.get('commerce'), dict):
            d['commerce'].pop('lastSeenAt', None)
        return d
    now_save, base_save = without_time(g.js("return localStorage.getItem('mo_v2_save');")), without_time(normal)
    ctx.check(now_save == base_save, '시험 구매·펫 성장은 일반 진행 저장과 격리',
              str({k: (base_save.get(k), now_save.get(k)) for k in set(now_save) | set(base_save) if now_save.get(k) != base_save.get(k)})[:600])
    trial = g.js("return JSON.parse((await import('/js/engine_v2/saveStore_v2.js')).load('mo_v2_save'));")
    trial['pets']['equipped'] = 'clockwork_keeper'
    trial['stages'] = {}
    g.page.goto(g.base + '/index.html')
    g.enter_v2()
    st = g.js(API + f"""
        const trial={json.dumps(trial)};
        progress.loadCommerce(trial);progress.loadPets(trial);
        const r=[!progress.canUsePet('clockwork_keeper'),progress.pets.equipped===null,
            !progress.equipPet('clockwork_keeper').success,progress.petBattleDmBonus()===0];
        try{{store.validateCommerce(trial.commerce,false);r.push(false);}}catch(e){{r.push(true);}}
        return r;
    """)
    ctx.check(all(st), '공개판: 시험 구매만 한 펫 장착·효과 금지, 시험 백업 권한 거부', str(st))
