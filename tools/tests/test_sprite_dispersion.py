"""큰 시트의 경계 바깥 확산, 고정 프레임에서도 이동하는 이미지 조각, 비교 영상."""
import os
import base64
from common import OUT


def run(ctx):
    g = ctx.game(fresh=True)
    g.enter_v2()
    rows = g.js("""
        const { VfxPlayer } = await import('/js/engine_v2/vfx/vfxPlayer.js');
        const { imageField, imageShockwave, breathImage } = await import('/js/engine_v2/vfx/imageEffects.js');
        const cases = [imageShockwave(620).layers[0], breathImage('breath_fire', 620, 2).layers[0],
            imageField('plasma', 500, 3).layers.find(l => l.type === 'sprite')];
        const rows = [];
        for (const src of cases) {
            const layer = { ...src, dur: 2, fadeIn: 0, fadeOut: 0.15, frameRange: [4, 4], dx: 0, phase: 0 };
            const w = layer.width, h = layer.height, ax = layer.anchorX ?? 0.5, ay = layer.anchorY ?? 0.5;
            const old = { ...layer }; delete old.dispersion;
            const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
            const cx = canvas.getContext('2d');
            const a = new VfxPlayer(), b = new VfxPlayer();
            a.play({ layers: [old] }, 800, 600); b.play({ layers: [layer] }, 800, 600);
            a.update(0.45); b.update(0.45);
            const raster = v => {
                cx.clearRect(0, 0, 1600, 900); v.draw(cx, 'front');
                const data = cx.getImageData(0, 0, 1600, 900).data;
                let pixels = 0, outer = 0, hash = 0;
                for (let y = 0; y < 900; y++) for (let x = 0; x < 1600; x++) {
                    const k = (y * 1600 + x) * 4;
                    if (data[k + 3] <= 5) continue;
                    pixels++; hash = (hash * 31 + k + data[k + 3]) | 0;
                    if (x < 800 - ax * w - 2 || x > 800 + (1 - ax) * w + 2 ||
                        y < 600 - ay * h - 2 || y > 600 + (1 - ay) * h + 2) outer++;
                }
                return { pixels, outer, hash };
            };
            let first = raster(b);
            for (let i = 0; i < 50 && !first.pixels; i++) { await new Promise(r => setTimeout(r, 40)); first = raster(b); }
            const before = raster(a);
            b.update(0.35); const moved = raster(b);
            b.update(3); const end = raster(b);
            rows.push({ kind: layer.dispersion, before: before.outer, outside: first.outer + moved.outer,
                moving: first.hash !== moved.hash, alive: first.pixels > 500, ended: end.pixels === 0,
                parts: b.parts.length, items: b.items.length });
        }
        return rows;
    """)
    for row in rows:
        ctx.check(row['before'] == 0 and row['outside'] > 100,
                  f"{row['kind']}: 기존 사각 시트 밖까지 실제 이미지 확산", str(row))
        ctx.check(row['moving'] and row['alive'], f"{row['kind']}: 고정 프레임에서도 조각 이동", str(row))
        ctx.check(row['ended'] and row['parts'] == 0 and row['items'] == 0,
                  f"{row['kind']}: 종료 후 잔류·입자 누적 없음", str(row))

    os.makedirs(OUT, exist_ok=True)
    html_path = os.path.join(OUT, 'vfx_dispersion_compare.html')
    html = """<!doctype html><meta charset="utf-8"><base href="/"><title>VFX dispersion comparison</title>
    <style>*{box-sizing:border-box}body{margin:0;background:#10151f}canvas{display:block}</style>
    <canvas width="1440" height="1040"></canvas><script type="module">
    import { VfxPlayer } from '/js/engine_v2/vfx/vfxPlayer.js';
    import { imageField, imageShockwave, breathImage } from '/js/engine_v2/vfx/imageEffects.js';
    const c=document.querySelector('canvas'), ctx=c.getContext('2d');
    const defs=[imageShockwave(500),imageField('plasma',440,20),breathImage('breath_fire',500,20)];
    const ys=[345,650,850], labels=['충격파','플라즈마 장판','용의 숨결'];
    const players=defs.map(def=>[0,1].map(side=>{
        const d=JSON.parse(JSON.stringify(def));
        if(!side) d.layers.forEach(l=>delete l.dispersion);
        return { v:new VfxPlayer(), def:d, side };
    }));
    function reset(p,row){p.v.clear();p.v.play(p.def,row===2?(p.side?810:90):(p.side?1080:360),ys[row]);}
    players.forEach((pair,row)=>pair.forEach(p=>reset(p,row)));
    let last=performance.now(), time=0;
    function draw(now){
        const dt=Math.min(.05,(now-last)/1000);last=now;time+=dt;
        if(time>=1.8){time=0;players[0].forEach(p=>reset(p,0));}
        ctx.fillStyle='#10151f';ctx.fillRect(0,0,1440,1040);
        ctx.font='bold 26px "Malgun Gothic",sans-serif';ctx.fillStyle='#b9c2d0';ctx.fillText('이전 · 직선 가장자리 페이드',110,55);
        ctx.fillStyle='#78e6d2';ctx.fillText('개선 · 불규칙 윤곽 + 바깥으로 흩어지는 이미지',770,55);
        ctx.strokeStyle='#273344';ctx.beginPath();ctx.moveTo(720,80);ctx.lineTo(720,1020);ctx.stroke();
        players.forEach((pair,row)=>{
            ctx.font='18px "Malgun Gothic",sans-serif';ctx.fillStyle='#7d8d9d';ctx.fillText(labels[row],24,ys[row]-190);
            pair.forEach(p=>{p.v.update(dt);p.v.draw(ctx,'ground');p.v.draw(ctx,'front');});
        });
        window.compareTime=time;requestAnimationFrame(draw);
    }requestAnimationFrame(draw);
    </script>"""
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    page = g.browser.new_page(viewport={'width': 1440, 'height': 1040})
    page.on('pageerror', lambda e: g.errors.append(str(e)))
    page.goto(f'{g.base}/tools/tests/_out/vfx_dispersion_compare.html')
    page.wait_for_function('window.compareTime > 0.2')
    page.evaluate("""() => {
        window.recordedChunks = [];
        window.recorder = new MediaRecorder(document.querySelector('canvas').captureStream(30),
            { mimeType: 'video/webm;codecs=vp8' });
        recorder.ondataavailable = event => recordedChunks.push(event.data);
        recorder.start();
    }""")
    page.wait_for_timeout(4200)
    page.wait_for_function('window.compareTime > 0.2 && window.compareTime < 0.38')
    colored = page.evaluate("""() => {
        const d=document.querySelector('canvas').getContext('2d').getImageData(0,100,1440,940).data;
        let pixels=0;
        for(let i=0;i<d.length;i+=4) if((d[i]>50 && d[i]>d[i+2]*1.3)||(d[i+2]>50 && d[i+2]>d[i]*1.3)) pixels++;
        return pixels;
    }""")
    ctx.check(colored > 20000, '비교 화면에 실제 이펙트 이미지 표시', str(colored))
    page.screenshot(path=os.path.join(OUT, 'vfx_dispersion_compare.png'))
    encoded = page.evaluate("""() => new Promise(resolve => {
        recorder.onstop = () => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(new Blob(recordedChunks, { type: 'video/webm' }));
        };
        recorder.stop();
    })""")
    page.close()
    with open(os.path.join(OUT, 'vfx_dispersion_compare.webm'), 'wb') as f:
        f.write(base64.b64decode(encoded))
    ctx.check(os.path.getsize(os.path.join(OUT, 'vfx_dispersion_compare.webm')) > 10000, '이전·개선 비교 영상 저장')
