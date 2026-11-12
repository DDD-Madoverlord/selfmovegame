"""파츠 성장 기획안 — 커먼 → 유니크 성장에 며칠·재화 얼마 (한 캐릭터 4부위). D-119 · Q-041
쓰는 법: python tools/tests/growth_model.py <결과.json>   (PYTHONUTF8=1 권장 — 한글 출력)
안 A~D 정의는 PLANS, 하루 수입 가정은 PLAYERS·income(). 기획·설계서 5번 그래프와 표가 이 결과.
가정(문서에 그대로 적음):
  - 구역 1~6 노말을 끝낸 뒤 하드 4구역 근처에서 반복 (판당 DM = 4구역 평균 승리 보상 × 하드 1.6 × 승률 0.7, 진 판은 처치 보상만)
  - 하루: 라이트 6판·파견 2회·방치 8h / 보통 15판·파견 4회·방치 8h / 헤비 30판·파견 6회·방치 12h
  - DM의 절반만 이 캐릭터 파츠에 씀 (나머지는 스킬·모듈·다른 캐릭터)
  - 조각: 판 클리어 드랍 25% × 하드 등급표(레어 0.8×3 + 유니크 0.2×8 = 4) + 파견 (2+4)개/회
"""
import json, math, sys
WIN_DM_Z4 = 16108; HARD = 1.6; WIN = 0.7
DM_PER_BATTLE = WIN_DM_Z4 * HARD * WIN + (70 * 52 * HARD) * (1 - WIN) * 0.6
OFFLINE_RATE = math.floor(4 * (100 + 2 * 4) * 1.2)   # 4-5 하드 시간당
PLAYERS = {
    '라이트': dict(battles=6, dispatch=2, offline=8),
    '보통': dict(battles=15, dispatch=4, offline=8),
    '헤비': dict(battles=30, dispatch=6, offline=12),
}
BASE = 700   # 부위 평균 강화 기준값 (커먼·레어 세트 가격 평균 근처)
UPCOST = {'common': 1.0, 'rare': 1.3, 'unique': 1.7}

def income(p, shard_mul=1.0):
    dm = p['battles'] * DM_PER_BATTLE + p['dispatch'] * 1500 * 4 + p['offline'] * OFFLINE_RATE
    shards = (p['battles'] * WIN * 0.25 * 4 + p['dispatch'] * 6) * shard_mul
    return dm * 0.5, shards

PLANS = {
    'A': dict(name='안 A · 지금 수치', lvcap={'common': 9, 'rare': 9, 'unique': 9}, exp=1.0, k=0.6,
              promo={'rare': (15, 0, 0), 'unique': (35, 0, 0)}, shard_mul=1.0, core=None),
    'B': dict(name='안 B · 등급이 강화 한도 + DM 승급비', lvcap={'common': 5, 'rare': 7, 'unique': 9}, exp=1.6, k=0.6,
              promo={'rare': (15, 20000, 0), 'unique': (35, 80000, 0)}, shard_mul=1.0, core=None),
    'C': dict(name='안 C · 승급석(스페셜맵 하루 3회)', lvcap={'common': 5, 'rare': 7, 'unique': 9}, exp=1.6, k=0.6,
              promo={'rare': (15, 20000, 6), 'unique': (35, 80000, 20)}, shard_mul=1.0, core=dict(per_run=2, runs=3)),
    'D': dict(name='안 D · 장기형 (B × 비용 1.8)', lvcap={'common': 5, 'rare': 7, 'unique': 9}, exp=1.6, k=1.08,
              promo={'rare': (27, 36000, 0), 'unique': (63, 144000, 0)}, shard_mul=1.0, core=None),
}

def lvcost(plan, grade, lv):
    return round(BASE * plan['k'] * (lv ** plan['exp']) * UPCOST[grade] / 10) * 10

def sim(plan, p, days=40):
    parts = [{'g': 'common', 'lv': 5} for _ in range(4)]   # 커먼 Lv5에서 출발 (노말 한도까지 키운 상태)
    dm = sh = st = 0.0
    spent_dm = spent_sh = 0
    rare_day = uni_day = done_day = None
    curve = []
    order = ['common', 'rare', 'unique']
    for day in range(1, days + 1):
        d_dm, d_sh = income(p, plan['shard_mul'])
        dm += d_dm; sh += d_sh
        if plan['core']: st += plan['core']['per_run'] * plan['core']['runs']
        progress = True
        while progress:
            progress = False
            # 1) 승급 (조각·DM·승급석이 되면)
            for q in sorted(parts, key=lambda q: order.index(q['g'])):
                if q['g'] == 'unique': continue
                nxt = order[order.index(q['g']) + 1]
                c_sh, c_dm, c_st = plan['promo'][nxt]
                need_lv = plan['lvcap'][q['g']] if plan['lvcap'][q['g']] < 9 else 0
                if q['lv'] >= need_lv and sh >= c_sh and dm >= c_dm and st >= c_st:
                    sh -= c_sh; dm -= c_dm; st -= c_st; spent_sh += c_sh; spent_dm += c_dm
                    q['g'] = nxt; progress = True
            # 2) 강화 (등급 한도까지, 가장 낮은 레벨부터)
            for q in sorted(parts, key=lambda q: q['lv']):
                cap = plan['lvcap'][q['g']]
                if q['lv'] < cap:
                    c = lvcost(plan, q['g'], q['lv'])
                    if dm >= c:
                        dm -= c; spent_dm += c; q['lv'] += 1; progress = True
        if rare_day is None and all(order.index(q['g']) >= 1 for q in parts): rare_day = day
        if uni_day is None and all(q['g'] == 'unique' for q in parts): uni_day = day
        if done_day is None and all(q['g'] == 'unique' and q['lv'] >= 9 for q in parts): done_day = day
        curve.append({'day': day, 'dm': spent_dm, 'shards': spent_sh})
    return dict(rare=rare_day, unique=uni_day, done=done_day, curve=curve, total_dm=spent_dm, total_sh=spent_sh)

def need(plan):
    tot_dm = tot_sh = tot_st = 0
    for g, (a, b) in (('common', (5, plan['lvcap']['common'])), ('rare', (None, plan['lvcap']['rare'])), ('unique', (None, 9))):
        pass
    # 커먼 Lv5 → 유니크 Lv9 총비용
    lv = 5
    for g in ['common', 'rare', 'unique']:
        cap = plan['lvcap'][g] if g != 'unique' else 9
        if plan['lvcap']['common'] == 9 and g != 'unique':
            cap = lv   # 안 A: 등급과 레벨 무관 → 유니크에서 한꺼번에 (비용 배율 차이는 작게 무시하지 않도록 유니크 배율로)
        while lv < cap:
            tot_dm += lvcost(plan, g, lv); lv += 1
        if g != 'unique':
            nxt = ['rare', 'unique'][['common', 'rare'].index(g)]
            c_sh, c_dm, c_st = plan['promo'][nxt]
            tot_sh += c_sh; tot_dm += c_dm; tot_st += c_st
    return tot_dm * 4, tot_sh * 4, tot_st * 4

out = {'assume': dict(dm_per_battle=round(DM_PER_BATTLE), offline_rate=OFFLINE_RATE), 'income': {}, 'plans': {}}
for n, p in PLAYERS.items():
    a, b = income(p); out['income'][n] = dict(dm_half=round(a), shards=round(b, 1))
for k, plan in PLANS.items():
    r = {'name': plan['name'], 'need': dict(zip(['dm', 'shards', 'stones'], need(plan))), 'players': {}}
    for n, p in PLAYERS.items():
        s = sim(plan, p)
        r['players'][n] = {kk: s[kk] for kk in ('rare', 'unique', 'done', 'total_dm', 'total_sh')}
        r['players'][n]['curve'] = s['curve'][:30]
    out['plans'][k] = r
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(out['assume'], ensure_ascii=False), json.dumps(out['income'], ensure_ascii=False))
for k, r in out['plans'].items():
    print(k, r['name'], 'need', r['need'], {n: (v['rare'], v['unique'], v['done']) for n, v in r['players'].items()})
