"""이펙트 시트 잘림 (11-05 피드백 20번): 105장 × 9칸의 네 변 안쪽 띠가 진하면(칸 경계에서 잘린 그림) 실패 — 새 시트를 넣을 때 다시 잘리지 않게.
일부러 변에 붙인 그림·아래 변을 옅게 한 바닥 기준 그림은 check_vfx_edges.ALLOWED. 잘린 변은 tools/images/soften_vfx_edges.py로 옅게."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images'))
import check_vfx_edges as C  # noqa: E402


def run(ctx):
    names = sorted(f[:-4] for f in os.listdir(C.VFX_PNG) if f.endswith('.png'))
    rows = [C.measure(n) for n in names]
    bad = [f"{r['name']} {r['max']:.2f}" for r in rows if r['max'] > C.SERIOUS]
    ctx.check(len(names) >= 100 and not bad, f'이펙트 시트 {len(names)}장: 칸 경계에서 눈에 띄게 잘린 것 없음 (가장자리 띠 진하기 ≤ {C.SERIOUS})', ', '.join(bad))
