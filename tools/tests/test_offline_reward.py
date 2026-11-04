"""방치 보상의 시간 경계·수령·저장·생명주기 검사."""
import json


API = """
const offline = await import('/js/engine_v2/offlineReward_v2.js');
const store = await import('/js/engine_v2/saveStore_v2.js');
const commerce = await import('/js/engine_v2/progressCommerce_v2.js');
const provider = await import('/js/engine_v2/commerceProviders_v2.js');
const { readAnalyticsLog } = await import('/js/engine_v2/analytics_v2.js');
const H = 3600000, M = 60000;
const seed = () => {
    progress.stages = {'1-1':{stars:[false,false,false],cleared:true,bestTime:1}};
    progress.diffStages = {}; progress.commerce = commerce.emptyCommerce(); progress.loadPets(null);
    progress.loadOffline(null, Date.now());
};
const away = ms => {
    progress.offlineAway(); window.__offlineNow += ms; progress.offlineReturn();
};
"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    ctx.check(g.js("return document.querySelector('#btn-menu-offline-v2').hidden && !document.querySelector('.v2-offline') && progress.offline.pool===null;"),
              '새 저장·첫 판 전 단추 숨김·자동 창 없음')
    g.js("window.__offlineNow=Date.now();window.__realNow=Date.now;Date.now=()=>window.__offlineNow;")
    st = g.js(API + """
        progress.offlineAway(); window.__offlineNow+=H; progress.offlineReturn();
        const r=[progress.offline.pool===null];
        seed(); progress.offlineActivity();window.__offlineNow+=2*H;progress.offlineActivity();
        r.push(progress.offline.pool===null);
        away(10*M-1);r.push(!progress.offlineReward().ready);
        const id=progress.offline.pool.id;away(1);
        r.push(progress.offlineReward().ready,progress.offlineReward().dm===16,progress.offline.pool.id===id);
        const elapsed=progress.offline.pool.elapsedMs;window.__offlineNow+=H;progress.offlineActivity();
        r.push(progress.offline.pool.elapsedMs===elapsed);
        return r;
    """)
    ctx.check(all(st), '해금 전 적립 없음·화면 켜진 시간 제외·짧은 부재 합산·10분 직전/정각', str(st))
    st = g.js(API + """
        const r=[];
        for(const ms of [8*H-1,8*H,8*H+1,90*24*H]){
            seed();away(ms);r.push(progress.offline.pool.elapsedMs===Math.min(ms,8*H));
            const n=progress.offline.pool.elapsedMs;away(H);r.push(progress.offline.pool.elapsedMs===Math.min(8*H,n+H));
        }
        seed();progress.offlineAway();const seen=progress.offline.lastSeenAt;
        window.__offlineNow-=H;progress.offlineReturn();
        r.push(progress.offline.lastSeenAt===seen,progress.offline.pool.elapsedMs===0);
        away(H/2);r.push(progress.offline.pool.elapsedMs===0);
        away(H);r.push(progress.offline.pool.elapsedMs===H/2);
        const n=progress.offline.pool.elapsedMs;progress.offlineReturn();progress.offlineReturn();
        r.push(progress.offline.pool.elapsedMs===n);return r;
    """)
    ctx.check(all(st), '8시간 경계·큰 전진 뒤 상한 유지·시계 역행 기준 유지·복귀 중복 없음', str(st))
    st = g.js(API + """
        seed();progress.stages['10-B']={stars:[false,false,false],cleared:true,bestTime:1};
        progress.diffStages.hard={'1-1':{stars:[false,false,false],cleared:true,bestTime:1}};
        const r=[offline.bestOfflineStage(progress).stageId==='10-B',offline.bestOfflineStage(progress).difficulty==='normal',
            offline.offlineRate('1-B','normal')===120,offline.offlineRate('10-B','nightmare')===1920,
            ['normal','hard','hell','nightmare'].map(d=>offline.offlineRate('1-1',d)).join() === '100,120,140,160'];
        away(H);progress.selectedStage='1-1';progress.diffStages.nightmare={'10-B':{stars:[true,true,true],cleared:true,bestTime:1}};
        away(H);r.push(progress.offline.pool.ratePerHour===1200,progress.offlineReward().dm===2400);
        return r;
    """)
    ctx.check(all(st), '실제 클리어 조합 최대 생산량·보스 순서 11·난이도 계수·묶음 생산량 고정', str(st))
    st = g.js(API + """
        seed();away(H);window.madOverlordGameV2.menuController.updateDisplay();
        const before=readAnalyticsLog().filter(e=>e.name==='offline_reward_ready' && e.reward_id===progress.offline.pool.id).length;
        progress.offlineReward(true);progress.offlineReward(true);
        const id=progress.offline.pool.id;
        const r=[before===1,readAnalyticsLog().filter(e=>e.name==='offline_reward_ready' && e.reward_id===id).length===1,
            !document.querySelector('#btn-menu-offline-v2').hidden,!document.querySelector('.v2-offline')];
        const money=gameState.darkMatter;const [first,second]=await Promise.all([progress.claimOfflineReward(),progress.claimOfflineReward()]);
        const saved=JSON.parse(store.load('mo_v2_save'));
        r.push(first.success,!second.success,gameState.darkMatter===money+100,saved.dm===money+100,
            saved.offline.pool===null,saved.offline.lastClaimId===id,
            readAnalyticsLog().filter(e=>e.name==='offline_reward_claim' && e.reward_id===id && e.claim_method==='base').length===1);
        window.__offlineClaimMoney=gameState.darkMatter;return r;
    """)
    ctx.check(all(st), '기본 수령·연타 방지·재화와 수령 ID 즉시 저장·준비/수령 이벤트 각각 한 번', str(st))
    money = g.js('return window.__offlineClaimMoney;')
    g.reload_v2()
    ctx.check(g.js(f'return gameState.darkMatter==={money} && !(await progress.claimOfflineReward()).success;'),
              '수령 직후 새로고침해도 중복 지급 없음')
    g.js("window.__offlineNow=Date.now();Date.now=()=>window.__offlineNow;")
    st = g.js(API + """
        seed();away(H);document.querySelector('#btn-menu-offline-v2').click();
        const double=document.querySelector('.v2-offline [data-claim="double"]');
        const r=[double.disabled,double.textContent==='광고 준비 중'];
        const money=gameState.darkMatter;
        r.push(!(await progress.claimOfflineReward(true)).success,gameState.darkMatter===money,progress.offlineReward().ready);
        document.querySelector('.v2-offline [data-close]').click();
        r.push(!document.querySelector('.v2-offline'),progress.offlineReward().ready);
        document.querySelector('#btn-menu-offline-v2').click();
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        r.push(!document.querySelector('.v2-offline'));
        document.querySelector('#btn-menu-offline-v2').click();
        document.querySelector('.v2-offline').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        r.push(!document.querySelector('.v2-offline'));return r;
    """)
    ctx.check(all(st), '공개판 광고 준비 중·지급 없음·닫기/Escape/배경으로 미수령 유지', str(st))
    g.page.set_viewport_size({'width': 854, 'height': 480})
    g.page.click('#btn-menu-offline-v2')
    ctx.check(g.js("const box=document.querySelector('.v2-offline .v2-commerce__panel').getBoundingClientRect();return box.top>=0 && box.bottom<=innerHeight && box.left>=0 && box.right<=innerWidth;"),
              '작은 가로 화면의 수령 창이 화면 안에 표시')
    g.shot('offline_reward')
    g.key('Escape')
    g.page.set_viewport_size({'width': 1300, 'height': 740})
    st = g.js(API + """
        seed();const {STAGES}=await import('/js/engine_v2/stages_v2.js');
        for(const s of STAGES.filter(s=>s.zone===1).slice(0,10)) progress.stages[s.id]={stars:[true,true,true],cleared:true,bestTime:1};
        progress.checkPetRewards();
        // 생산량과 펫 조건은 독립적으로 검증한다.
        progress.stages={'1-1':{stars:[false,false,false],cleared:true,bestTime:1}};
        progress.equipPet('abyss_lantern');away(H);
        const r=[progress.offlineReward().dm===102];
        const id=progress.offline.pool.id;gameState.darkMatter=999999;progress.shards=999;
        progress.upgradePet('abyss_lantern');progress.equipPet(null);away(H);
        r.push(progress.offline.pool.id===id,progress.offlineReward().dm===204);
        await progress.claimOfflineReward();progress.equipPet('abyss_lantern');progress.pets.levels.abyss_lantern=10;away(H);
        r.push(progress.offlineReward().dm===111);
        await progress.claimOfflineReward();const original=progress.petOfflineDmBonus;progress.petOfflineDmBonus=()=>0.8;
        away(H);r.push(progress.offlineReward().dm===125,progress.offline.pool.dmBonus===0.25);
        progress.petOfflineDmBonus=original;return r;
    """)
    ctx.check(all(st), '펫 보너스·장착/강화 소급 없음·최대 11%·영구 보너스 합계 25% 상한', str(st))
    st = g.js(API + """
        seed();const old={savedAt:Date.now()-H};progress.loadOffline(old);
        const r=[progress.offlineReward().dm===100];
        progress.loadOffline({});r.push(progress.offline.pool===null);
        progress.loadOffline({savedAt:Date.now()-H,offline:'broken'});r.push(progress.offline.pool===null);
        away(H);progress.save();const good=JSON.parse(store.load('mo_v2_save'));
        const pending=JSON.parse(JSON.stringify(good));pending.offline.adPending=true;
        window.__offlineNow+=H;progress.loadOffline(pending);
        r.push(progress.offline.pool.elapsedMs===H,!progress.offline.adPending);
        const rejected=[];
        for(const bad of ['bad',[],null,{...good.offline,lastSeenAt:-1},{...good.offline,awayAt:'bad'},
            {...good.offline,lastClaimId:3},{...good.offline,pool:{...good.offline.pool,elapsedMs:12*H}},
            {...good.offline,pool:{...good.offline.pool,difficulty:'invalid'}},
            {...good.offline,pool:{...good.offline.pool,stageId:'bad'}},
            {...good.offline,pool:{...good.offline.pool,ratePerHour:0}},
            {...good.offline,pool:{...good.offline.pool,capMs:9*H}},
            {...good.offline,pool:{...good.offline.pool,dmBonus:0.26}},
            {...good.offline,pool:{...good.offline.pool,readyReported:'yes'}}]){
            try{offline.validateOffline(bad);rejected.push(false);}catch(e){rejected.push(true);}
        }
        r.push(...rejected,offline.validateOffline(good.offline));
        window.__offlineGood=good;return r;
    """)
    ctx.check(all(st), '옛 savedAt 정산·시각 없음 무소급·손상 직접 로드 초기화·offline 엄격 검사', str(st))
    code = g.js("const {exportSave}=await import('/js/engine_v2/progress_v2.js');return exportSave();")
    with g.page.expect_navigation():
        g.js(f"const {{importSave}}=await import('/js/engine_v2/progress_v2.js');importSave({json.dumps(code)});")
    g.enter_v2()
    ctx.check(g.js('return progress.offlineReward().ready && progress.offlineReward().dm>=100;'), 'offline 포함 백업 왕복')
    st = g.js(API + """
        const pack=data=>{const payload=btoa(unescape(encodeURIComponent(JSON.stringify({entries:{mo_v2_save:JSON.stringify(data)}}))));
            let hash=2166136261;for(let i=0;i<payload.length;i++)hash=Math.imul(hash^payload.charCodeAt(i),16777619);
            return `MO1:${payload}:${(hash>>>0).toString(16).padStart(8,'0')}`;};
        const data=JSON.parse(store.load('mo_v2_save'));data.offline.pool.elapsedMs=-1;
        const before=store.load('mo_v2_save');const result=store.importSave(pack(data));
        return !result.success && store.load('mo_v2_save')===before;
    """)
    ctx.check(st, '잘못된 offline 백업 거부·기존 저장 유지')
    # 초기 저장 전에 원래 savedAt을 읽는 실제 로딩 경로를 확인한다.
    g.js(API + """
        seed();progress.save();const old=JSON.parse(store.load('mo_v2_save'));
        delete old.offline;delete old.pets;old.savedAt=window.__offlineNow-H;
        localStorage.setItem('mo_v2_save',JSON.stringify(old));
    """)
    # 앞의 시계 주입과 무관하게, 다음 실행 기준 한 시간 전 저장으로 맞춘다.
    g.page.evaluate("() => { const data=JSON.parse(localStorage.getItem('mo_v2_save'));data.savedAt=new Date().getTime()-3600000;localStorage.setItem('mo_v2_save',JSON.stringify(data)); }")
    g.reload_v2()
    ctx.check(g.js('return progress.offlineReward().ready && progress.offlineReward().dm===100;'),
              '실제 옛 저장 진입: 펫 소급 지급의 즉시 저장 전에 savedAt으로 정산')

    # 명시적인 가짜 공급자는 일반 저장과 격리된 새 실행에서만 쓴다.
    g.page.goto(g.base + '/index.html?mockCommerce=1')
    g.enter_v2()
    g.js("window.__offlineNow=Date.now();Date.now=()=>window.__offlineNow;")
    st = g.js(API + """
        seed();const r=[];const start=Date.now();away(8*H);
        await progress.purchaseProduct('weekly_pass_7d');
        r.push(progress.offline.pool.capMs===8*H,progress.offline.pool.elapsedMs===8*H);
        await progress.claimOfflineReward();
        for(const ms of [12*H-1,12*H,12*H+1]){
            progress.loadOffline(null,Date.now());away(ms);
            r.push(progress.offline.pool.capMs===12*H,progress.offline.pool.elapsedMs===Math.min(ms,12*H));
        }
        const money=gameState.darkMatter;const ad=provider.ads.showRewarded;let calls=0;
        provider.ads.showRewarded=async()=>{calls++;return {status:'failed'};};
        const first=await progress.claimOfflineReward(true);
        r.push(first.success,first.grantedDm===2400,gameState.darkMatter===money+2400,calls===0);
        away(H);r.push((await progress.claimOfflineReward(true)).success,progress.adQuotaRemaining()===0);
        away(H);r.push(!(await progress.claimOfflineReward(true)).success,progress.offlineReward().ready,
            (await progress.claimOfflineReward()).success);
        provider.ads.showRewarded=ad;
        return r;
    """)
    ctx.check(all(st), '패스 구매 전 8시간 고정·새 묶음 12시간 경계·광고 생략 2배도 하루 2회', str(st))
    st = g.js(API + """
        seed();away(H);const id=progress.offline.pool.id;const r=[];
        for(const status of ['cancelled','failed']){
            provider.setMockResult('ad',status);const result=await progress.claimOfflineReward(true);
            r.push(!result.success,progress.offline.pool.id===id,progress.adQuotaRemaining()===2,
                !readAnalyticsLog().some(e=>e.name==='offline_reward_claim' && e.reward_id===id));
        }
        const ad=provider.ads.showRewarded;
        let finish;provider.ads.showRewarded=()=>new Promise(resolve=>{finish=resolve;});
        const pending=progress.claimOfflineReward(true);
        r.push(!(await progress.claimOfflineReward()).success);
        progress.offlineAway();window.__offlineNow+=H;progress.offlineReturn();
        r.push(progress.offline.pool.elapsedMs===H,progress.offline.awayAt===null);
        finish({status:'success'});const result=await pending;
        r.push(result.success,result.grantedDm===200);
        away(10*M);r.push(progress.offline.pool.elapsedMs===10*M);
        const claim=readAnalyticsLog().filter(e=>e.name==='offline_reward_claim' && e.reward_id===id);
        r.push(claim.length===1,claim[0].claim_method==='ad');
        provider.ads.showRewarded=ad;
        // 늦은 콜백은 교체된 묶음에 지급하지 않는다.
        provider.ads.showRewarded=()=>new Promise(resolve=>{finish=resolve;});
        const late=progress.claimOfflineReward(true),money=gameState.darkMatter;
        progress.loadOffline(null,Date.now());finish({status:'success'});
        r.push(!(await late).success,gameState.darkMatter===money);
        provider.ads.showRewarded=ad;return r;
    """)
    ctx.check(all(st), '광고 취소/실패 무소모·연타·광고 숨김 시간 제외·성공 2배·늦은 콜백 무지급', str(st))
    st = g.js(API + """
        seed();await progress.purchaseProduct('remove_ads_forever');away(H);
        const ad=provider.ads.showRewarded;provider.ads.showRewarded=()=>{throw Error('광고 생략');};
        const r=await progress.claimOfflineReward(true);provider.ads.showRewarded=ad;
        return r.success && r.grantedDm===200;
    """)
    ctx.check(st, '영구 광고 제거 권한은 공급자 호출 없이 2배 지급')
    st = g.js(API + """
        seed();const bonus=progress.petOfflineDmBonus;progress.petOfflineDmBonus=()=>0.11;
        away(10*M);progress.petOfflineDmBonus=bonus;
        const result=await progress.claimOfflineReward(true);
        const r=[result.success,result.grantedDm===34];
        seed();away(H);const show=provider.ads.showRewarded;
        provider.ads.showRewarded=async()=>{throw Error('공급자 실패');};
        const failed=await progress.claimOfflineReward(true);provider.ads.showRewarded=show;
        r.push(!failed.success,progress.offlineReward().ready,!progress._offlineBusy,!progress.offline.adPending,
            progress.adQuotaRemaining()===2);
        return r;
    """)
    ctx.check(all(st), '기본 DM→펫 보너스→정수→2배 순서·광고 공급자 예외도 미지급/잠금 해제')
    st = g.js(API + """
        seed();Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));const start=progress.offline.awayAt;
        window.__offlineNow+=5*M;window.dispatchEvent(new Event('pagehide'));
        const once=progress.offline.awayAt===start;
        window.__offlineNow+=5*M;Object.defineProperty(document,'hidden',{configurable:true,value:false});
        document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pageshow'));
        const r=[once,progress.offline.pool.elapsedMs===10*M,progress.offline.awayAt===null];
        delete document.hidden;return r;
    """)
    ctx.check(all(st), '실제 생명주기 연결: 숨김/pagehide와 복귀/pageshow 중첩에도 한 구간만 적립', str(st))
    g.battle('mech', wait_ms=100)
    st = g.js(API + """
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
        const paused=gameTime.paused;
        Object.defineProperty(document,'hidden',{configurable:true,value:false});
        document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;
        const stillPaused=gameTime.paused;b.stopBattle();
        return paused && stillPaused;
    """)
    ctx.check(st, '전투 중 숨기면 기존 HUD로 일시정지·복귀해도 직접 재개하기 전까지 정지')
