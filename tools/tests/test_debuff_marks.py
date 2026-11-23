"""머리 위 능력치 칩(디버프·버프, 11-23 statChips_v2.js)과 모바일 협력 요약·배치."""
from test_support import setup


def run(ctx):
    for name,kw in [('PC',{}),('mobile',{'viewport':(800,360),'touch':True}),('mobile_small',{'viewport':(640,360),'touch':True})]:
        g=ctx.game(**kw);g.enter_v2();setup(g,'frost',charged=True)
        g.js("b.addBuff('adrenaline',6); b.pStunT=4;b.pRootT=4;b.pSlowT=4;b.pVulnT=4;b.pVulnMore=.3;b.pWeakT=4;b.pWeakCut=.2;b.hud.update();")
        g.wait(200)
        st=g.js("""const root=document.querySelector('.v2-buff-marks'),nodes=[...root.querySelectorAll('.is-debuff')];const r=root.getBoundingClientRect(),hp=m.domMonster.querySelector('.monster-hp-container').getBoundingClientRect();return {count:nodes.length,names:nodes.map(n=>n.title).join('|'),icons:new Set(nodes.map(n=>n.dataset.icon)).size,above:r.bottom<=hp.top,positive:!!root.querySelector('[data-buff-id="atk+"]:not(.is-debuff)')};""")
        ctx.check(st['count']==5 and st['icons']==5 and st['above'] and st['positive'] and all(x in st['names'] for x in ['기절','속박','이속 −50%','방어 −30%','공격 −20%','4초']),name+' five distinct debuffs above head alongside buff',str(st))
        st=g.js("""const box=document.querySelector('.v2-support-hud'),brief=box.querySelector('.v2-support-preview'),r=box.getBoundingClientRect();return {visible:getComputedStyle(brief).display!=='none'&&brief.getBoundingClientRect().height>0,text:brief.textContent,inside:r.left>=0&&r.right<=innerWidth,apart:document.querySelector('#hud-pstatus-v2').hidden};""")
        ctx.check(all(st[k] for k in ['visible','inside','apart']) and bool(st['text']),name+' support effect summary visible without overlap',str(st))
        ctx.check(g.js("const marks=document.querySelector('.v2-buff-marks').getBoundingClientRect(),unit=document.querySelector('.v2-unit').getBoundingClientRect();return unit.bottom<=marks.top || unit.right<=marks.left;"),name+' profile does not cover overhead chips')
        g.shot('debuff_support_'+name,'#screen-battle-v2')
        st=g.js("""b.tickPlayerStatus(1);b.hud.update();const n=document.querySelector('[data-buff-id="move-"]');return {time:n.querySelector('.v2-buff-mark__time').textContent,progress:parseFloat(n.style.getPropertyValue('--buff-left'))};""")
        ctx.check(st['time']=='3' and abs(st['progress']-.75)<.01,name+' debuff countdown follows engine',str(st))
        g.js("b.pSlowT=7;b.hud.update();")
        ctx.check(g.js("return document.querySelectorAll('[data-buff-id=\"move-\"]').length===1 && document.querySelector('[data-buff-id=\"move-\"]').title.includes('7초');"),name+' reapply refreshes one icon')
        g.js("b.pStunT=0;b.pRootT=0;b.pSlowT=0;b.pVulnT=0;b.pWeakT=0;b.hud.update();")
        ctx.check(g.js("return !document.querySelector('.v2-buff-mark.is-debuff') && !!document.querySelector('[data-buff-id=\"atk+\"]');"),name+' expired debuffs removed while buff retained')
        g.js("b.stopBattle();")
        ctx.check(g.page.locator('.v2-buff-marks').count()==0,name+' exit removes all marks')
