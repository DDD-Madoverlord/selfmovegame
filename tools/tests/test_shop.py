"""상점·구매·한국시간 패스·광고 한도·시험 저장 격리·확률 공개."""


API = """
const dev = await import('/js/engine_v2/commerceDev_v2.js');
const provider = await import('/js/engine_v2/commerceProviders_v2.js');
const store = await import('/js/engine_v2/saveStore_v2.js');
const { emptyCommerce } = await import('/js/engine_v2/progressCommerce_v2.js');
const { kstDayKey, kstWeekKey, DAY_MS } = await import('/js/engine_v2/kstTime_v2.js');
"""


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    ctx.check(g.page.locator('.v2-commerce').count() == 0, '새 저장 진입에 자동 상점·확률 창 없음')
    st = g.js(API + """
        const publicEnv = { location: { protocol: 'https:', hostname: 'game.example', search: '?mockCommerce=1' }, madOverlordApp: true };
        const playerEnv = { ...publicEnv, Capacitor: { Plugins: {}, isNativePlatform: () => true } };
        const before = gameState.darkMatter;
        return [!dev.initCommerceDev({env: publicEnv, explicit: true}), !dev.initCommerceDev({env: playerEnv, explicit: true}),
            !dev.isMockCommerce(), (await progress.purchaseProduct('supply_small')).reason === '결제 준비 중',
            (await provider.ads.showRewarded('idle_double')).reason === '광고 준비 중', gameState.darkMatter === before,
            !dev.commerceEnvironment({location:{protocol:'file:',hostname:'',search:'?mockCommerce=1'}}).candidate,
            ['localhost','127.0.0.1','[::1]'].every(hostname => dev.commerceEnvironment({location:{protocol:'http:',hostname}}).candidate),
            !dev.commerceEnvironment({location:{protocol:'http:',hostname:'192.168.1.2'}}).candidate];
    """)
    ctx.check(all(st), '공개 웹·플레이판 강제 시험 거부, 준비 중·무지급, 후보 주소 제한', str(st))
    g.page.click('#btn-menu-shop-v2')
    ctx.check('결제 준비 중' in g.page.locator('.v2-shop').inner_text(), '일반판 상점 상품은 결제 준비 중')
    # 확률 정보는 설정 › 정보로 옮김 (11-05 피드백 12) — 상점에는 안내 한 줄과 재화 표시줄, 연구소에는 단추 없음
    st = g.js("""const shop = document.querySelector('.v2-shop');
        return { btn: !!shop.querySelector('[data-act="prob"]'), note: shop.querySelector('.v2-shop__probnote')?.textContent || '',
            dm: shop.querySelector('[data-currency] .v2-chip--dm strong')?.textContent, real: gameState.darkMatter.toLocaleString() };""")
    ctx.check(not st['btn'] and '설정' in st['note'] and st['dm'] == st['real'], '상점: 확률 정보 단추 없이 "설정 › 정보" 안내 · 머리에 같은 재화 표시줄', str(st))
    g.key('Escape')
    g.page.click('#btn-menu-settings-v2')
    g.page.click('.v2-settings [data-act="prob"]')
    st = g.js("""
        const { OPTIONS, DROP, RESEARCH } = await import('/js/engine_v2/growth_v2.js');
        const { percent } = await import('/js/ui_v2/probInfo_v2.js');
        const body = document.querySelector('.v2-prob-info').textContent;
        return [Object.entries(OPTIONS).every(([id, o]) => {
            const row = document.querySelector(`[data-option="${id}"]`);
            return row.textContent.includes(o.name) && row.textContent.includes(o.desc) && row.textContent.includes(percent(1 / Object.keys(OPTIONS).length));
        }), body.includes(percent(DROP.chance)), body.includes(percent(DROP.affinityBonus)), body.includes(percent(RESEARCH.dropRate.per)),
            Object.entries(DROP.grades).every(([diff, table]) => Object.values(table).every(n => document.querySelector(`.v2-prob-info [data-difficulty="${diff}"]`).textContent.includes(percent(n))))];
    """)
    ctx.check(all(st), '확률 정보 창의 옵션·등급·드랍 수치가 실제 데이터와 일치', str(st))
    g.key('Escape')
    g.wait(250)
    ctx.check(g.page.locator('.v2-prob-info').count() == 0 and g.page.locator('.v2-settings').count() == 1, '설정 위 확률 창: Escape는 맨 위 확률 창만 닫음')
    g.key('Escape')
    g.wait(250)
    g.page.click('#btn-to-lab-v2')
    ctx.check(g.page.locator('#btn-lab-prob-info-v2').count() == 0, '연구소 위 줄에 확률 정보 단추 없음 (설정으로 옮김)')
    g.page.click('#btn-lab-back-v2')

    # 메모리 격리 전 일반 진행을 보관한다.
    normal = g.js("progress.save(); return localStorage.getItem('mo_v2_save');")
    g.page.goto(g.base + '/index.html?skipTitle=1&mockCommerce=1')
    g.enter_v2()
    st = g.js(API + """
        const initial = gameState.darkMatter;
        const results = [];
        for (const status of ['cancelled','failed','pending']) {
            progress.commerce = emptyCommerce();
            provider.setMockResult('purchase', status);
            const r = await progress.purchaseProduct('supply_small');
            results.push(r.status === status && gameState.darkMatter === initial);
        }
        const pending = progress.commerce.orders[0];
        provider.completeMockPurchase(pending.orderId);
        const after = gameState.darkMatter;
        const shards = progress.shards;
        progress.applyCommerceOrder({...pending, status:'success'});
        results.push(after === initial + 3000 && gameState.darkMatter === after && progress.shards === shards);
        results.push((await progress.purchaseProduct('supply_small')).reason === '이번 주 구매 완료');
        results.push(dev.isMockCommerce());
        try { store.exportSave(); results.push(false); } catch(e) { results.push(e.message.includes('시험')); }
        return results;
    """)
    ctx.check(all(st), '로컬 명시 시험: 취소·실패·대기 무지급, 후속 성공 한 번·주간 제한·백업 금지', str(st))
    ctx.check(g.js('return localStorage.getItem("mo_v2_save");') == normal, '시험 중 일반 진행 저장 원문 그대로')

    st = g.js(API + """
        progress.commerce = emptyCommerce();
        const now = Date.now();
        const before = gameState.darkMatter;
        const both = await Promise.all([progress.purchaseProduct('supply_medium',now), progress.purchaseProduct('supply_medium',now)]);
        const once = both.filter(r => r.granted).length === 1 && gameState.darkMatter === before + 9000;
        const nextWeek = Date.parse(kstWeekKey(now) + 'T00:00:00+09:00') + 7 * DAY_MS;
        const next = await progress.purchaseProduct('supply_medium',nextWeek);
        return [once,next.granted,kstWeekKey(Date.parse('2026-10-25T14:59:59Z')) === '2026-10-19',
            kstWeekKey(Date.parse('2026-10-25T15:00:00Z')) === '2026-10-26'];
    """)
    ctx.check(all(st), '연속 구매 한 번·월요일 한국시간 0시 주간 제한 초기화', str(st))
    st = g.js(API + """
        const { emptyPets } = await import('/js/engine_v2/pets_v2.js');
        const savedPets = JSON.parse(JSON.stringify(progress.pets));
        progress.pets = emptyPets();
        progress.commerce = emptyCommerce();
        // 내일 한국시간 자정 1초 전 — 지금 시각 기준. 고정 날짜는 그 날이 지나면 구매 뒤 lastSeenAt(실제 시각)보다 과거라 '시계 되돌림'으로 막혀 실패함
        const start = Date.parse(kstDayKey(Date.now() + DAY_MS) + 'T00:00:00+09:00') - 1000;
        await progress.purchaseProduct('weekly_pass_7d',start);
        const p = progress.commerce.weeklyPass;
        const initial = gameState.darkMatter, shards = progress.shards;
        const r = [progress.offlineCapHours(start) === 12, progress.canSkipAd('idle_double',start), progress.claimPass(start).success,
            !progress.claimPass(start).success, progress.claimPass(start+1000).success];
        for(let i=1;i<=5;i++) r.push(progress.claimPass(start+1000+i*DAY_MS).success);
        r.push(p.claimCount === 7, gameState.darkMatter === initial+10500, progress.shards === shards+21,
            progress.pets.owned.includes('clockwork_keeper') || progress.commerce.pendingPets.some(p=>p.id==='clockwork_keeper'), !progress.canClaimPass(start+6*DAY_MS),
            progress.activePass(p.expiresAt-1), !progress.activePass(p.expiresAt), progress.offlineCapHours(p.expiresAt) === 8);
        // 놓친 날은 소급되지 않고, 만료 후에는 수령 불가.
        progress.commerce = emptyCommerce(); await progress.purchaseProduct('weekly_pass_7d',start);
        r.push(!progress.claimPass(start-DAY_MS).success);
        r.push(progress.claimPass(start+3*DAY_MS).success, progress.commerce.weeklyPass.claimCount === 1,
            !progress.claimPass(start+2*DAY_MS).success, !progress.claimPass(start+7*DAY_MS).success);
        progress.pets = savedPets;
        return r;
    """)
    ctx.check(all(st), '패스 자정·최대 7회·고정 지급·7회째 펫 지급·168시간 만료·소급 없음·역행 방지', str(st))
    st = g.js(API + """
        const { emptyPets } = await import('/js/engine_v2/pets_v2.js');
        const savedPets = JSON.parse(JSON.stringify(progress.pets));
        progress.commerce = emptyCommerce(); const start=Date.now()+60000;   // 방치 보상이 시각을 갱신해도 받기가 '시계 역행'으로 막히지 않게
        await progress.purchaseProduct('weekly_pass_7d',start);
        progress.pets = { ...emptyPets(), owned:['clockwork_keeper'], levels:{ clockwork_keeper: 1 } };
        const shards=progress.shards;
        for(let i=0;i<7;i++) progress.claimPass(start+i*DAY_MS);
        const duplicate=progress.shards===shards+22;
        progress.pets = emptyPets();
        progress.commerce=emptyCommerce();
        const before=gameState.darkMatter;
        await progress.purchaseProduct('remove_ads_forever');
        progress.commerce.permanents={};
        await progress.restorePurchases(); await progress.restorePurchases();
        const r = [duplicate, progress.hasAdRemoval(), gameState.darkMatter===before,
            progress.commerceProductState('pet_clockwork_keeper')===null];
        progress.pets = savedPets;
        return r;
    """)
    ctx.check(all(st), '7회째 보유 펫은 조각 1개·영구 권한 반복 복원 무중복·안 가진 펫은 판매 가능', str(st))
    st = g.js(API + """
        const { emptyPets } = await import('/js/engine_v2/pets_v2.js');
        const savedPets = JSON.parse(JSON.stringify(progress.pets));
        progress.pets = emptyPets(); progress.commerce = emptyCommerce();
        const before = gameState.darkMatter;
        const purchased = await progress.purchaseProduct('pet_clockwork_keeper');
        const r = [purchased.granted === true, progress.pets.owned.filter(id => id === 'clockwork_keeper').length === 1,
            progress.hasPermanentProduct('pet_clockwork_keeper'), progress.hasPetEntitlement('clockwork_keeper'),
            gameState.darkMatter === before, progress.commerceProductState('pet_clockwork_keeper') === '보유 중'];
        await progress.restorePurchases(); await progress.restorePurchases();
        r.push(progress.pets.owned.filter(id => id === 'clockwork_keeper').length === 1, gameState.darkMatter === before);
        progress.pets = savedPets;
        return r;
    """)
    ctx.check(all(st), '펫 상품 단독 지급(재화 동봉 없음)·영구 권한·보유 중이면 구매 막힘·복원 반복에도 한 마리', str(st))
    st = g.js(API + """
        progress.commerce=emptyCommerce(); const r=[]; const now=Date.now();
        for(const status of ['cancelled','failed']) {
            provider.setMockResult('ad',status); r.push(!(await progress.requestAdReward('idle_double',status,now)).success);
        }
        r.push(progress.adQuotaRemaining('idle_double',now)===2);
        r.push((await progress.requestAdReward('idle_double','one',now)).success,
            !(await progress.requestAdReward('idle_double','one',now)).success,
            (await progress.requestAdReward('idle_double','two',now)).success,
            !(await progress.requestAdReward('idle_double','three',now)).success);
        const tomorrow=now+DAY_MS;
        await progress.purchaseProduct('remove_ads_forever',tomorrow);
        provider.setMockResult('ad','failed');
        r.push((await progress.requestAdReward('idle_double','skip1',tomorrow)).mode==='entitlement',
            (await progress.requestAdReward('idle_double','skip2',tomorrow)).success,
            !(await progress.requestAdReward('idle_double','skip3',tomorrow)).success,
            (await provider.ads.showRewarded('idle_double')).status==='failed');
        const events=[];(await import('/js/engine_v2/analytics_v2.js')).addAnalyticsProvider(e=>events.push(e));
        r.push(progress.recordAdReward('idle_double','skip1',100,'entitlement'),
            !progress.recordAdReward('idle_double','skip1',100,'entitlement'),
            events.filter(e=>e.name==='ad_reward').length===1);
        return r;
    """)
    ctx.check(all(st), '광고 취소·실패 무차감, 하루 2회·같은 건 중복 금지·광고 제거도 같은 한도', str(st))

    st = g.js(API + """
        const valid=JSON.parse(JSON.stringify(progress.commerce));
        const round=JSON.parse(JSON.stringify(valid));
        const r=[store.validateCommerce(round),JSON.stringify(valid)===JSON.stringify(round)];
        for(const change of [c=>c.schema=2,c=>c.weeklyPass={claimCount:8},c=>c.dailyAds.counts.idle_double=3,
            c=>c.orders.push({...c.orders[0]}),c=>c.permanents.remove_ads_forever=true,c=>c.orders[0].grant.dm=999,
            c=>c.lastSeenAt=-1,c=>c.dailyAds.dayKey='2026-02-31',c=>c.receipt='토큰',c=>c.orders[0].provider='real']) {
            const copy=JSON.parse(JSON.stringify(valid)); change(copy);
            try {store.validateCommerce(copy);r.push(false);}catch(e){r.push(true);}
        }
        try{store.validateCommerce(valid,false);r.push(false);}catch(e){r.push(true);}
        return r;
    """)
    ctx.check(all(st), 'commerce 직렬화 왕복·모양·한도·중복·영수증·공개판 시험 저장 거부', str(st))

    # 시험 표시·구매 확인·취소 상태를 실제 UI에서도 확인한다.
    g.js(API + 'progress.commerce=emptyCommerce();')
    g.page.click('#btn-menu-shop-v2')
    ctx.check('시험 구매' in g.page.locator('.v2-shop').inner_text(), '시험 중 메모리 저장·실제 청구 없음 안내')
    g.page.select_option('.v2-shop [data-mock]', 'cancelled')
    g.page.click('.v2-shop [data-buy="supply_small"]')
    ctx.check('1,500원' in g.page.locator('[data-confirm]').inner_text(), '구매 전에 상품·가격·구성 확인')
    g.page.click('.v2-shop [data-act="purchase"]')
    g.wait(100)
    ctx.check('취소' in g.page.locator('[data-result]').inner_text(), '구매 취소 결과를 상점 안에 표시')
    g.page.set_viewport_size({'width': 854, 'height': 480})
    g.wait(200)
    ctx.check(g.page.evaluate("""() => {const r=document.querySelector('.v2-shop .v2-commerce__panel').getBoundingClientRect();
        return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;}"""), '작은 가로 화면에서 상점이 화면 안에 표시')
    g.shot('shop')
    g.key('Escape')
    g.reload_v2()
    st = g.js(API + "return [dev.isMockCommerce(),progress.commerce.orders.length===0,progress.commerce.mockSession,JSON.parse(localStorage.getItem('mo_v2_save')).dm===gameState.darkMatter];")
    ctx.check(all(st), '시험 주소 그대로 새로고침해도 시험분 소멸·일반 진행 재복사', str(st))
    g.page.goto(g.base + '/index.html?skipTitle=1')
    g.enter_v2()
    ctx.check(g.js('return localStorage.getItem("mo_v2_save");') != '', '일반 진행으로 복귀')
    st = g.js(API + "return [!dev.isMockCommerce(),progress.commerce.orders.length===0,progress.commerce.mockSession===false];")
    ctx.check(all(st), '새로고침 뒤 시험 주문·권한 소멸', str(st))
    st = g.js(API + """
        const code=store.exportSave();
        const entries=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.split(':')[1]),c=>c.charCodeAt(0)))).entries;
        const c=JSON.parse(entries.mo_v2_save).commerce;
        return [store.validateCommerce(c,false),c.orders.length===0,!c.mockSession];
    """)
    ctx.check(all(st), '일반 commerce 백업 직렬화 왕복, 시험 주문 없음', str(st))
    st = g.js(API + """
        const pack=entries=>{
            const payload=btoa(unescape(encodeURIComponent(JSON.stringify({entries}))));let hash=2166136261;
            for(let i=0;i<payload.length;i++)hash=Math.imul(hash^payload.charCodeAt(i),16777619);
            return `MO1:${payload}:${(hash>>>0).toString(16).padStart(8,'0')}`;
        };
        const normal=localStorage.getItem('mo_v2_save');
        const data=JSON.parse(normal);data.commerce.mockSession=true;
        const mock=store.importSave(pack({mo_v2_save:JSON.stringify(data)}));
        data.commerce=emptyCommerce();data.commerce.dailyAds.counts.idle_double=99;
        const broken=store.importSave(pack({mo_v2_save:JSON.stringify(data)}));
        return [!mock.success,!broken.success,localStorage.getItem('mo_v2_save')===normal];
    """)
    ctx.check(all(st), '공개판 시험 백업·손상 commerce 백업 가져오기 거부, 일반 저장 보존', str(st))
    # 구형 저장: commerce 없이도 기존 진행을 그대로 읽는다.
    g.js("const old=JSON.parse(localStorage.getItem('mo_v2_save'));delete old.commerce;old.dm=2468;localStorage.setItem('mo_v2_save',JSON.stringify(old));")
    g.reload_v2()
    ctx.check(g.js('return gameState.darkMatter===2468 && progress.commerce.orders.length===0;'), 'commerce 없는 예전 저장 그대로 호환')
    st = g.js(API + """
        const {openSettings}=await import('/js/ui_v2/settingsPanel_v2.js');
        openSettings();const hidden=!document.querySelector('[data-commerce-test]');
        document.querySelector('.v2-settings [data-act="close"]').click();
        await new Promise(resolve=>setTimeout(resolve,220));
        window.Capacitor={Plugins:{AppUpdate:{}}};
        openSettings();const btn=document.querySelector('[data-commerce-test]');
        const candidate=!!btn && !dev.isMockCommerce();
        btn.click();const before=localStorage.getItem('mo_v2_save');
        await progress.purchaseProduct('supply_small');
        return [hidden,candidate,dev.isMockCommerce(),localStorage.getItem('mo_v2_save')===before];
    """)
    ctx.check(all(st), '개발판 후보일 때만 설정 시험 스위치·명시적으로 켠 뒤 메모리 격리', str(st))
