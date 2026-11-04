/* 고정 구성 상품. 실제 결제 공급자는 아직 연결하지 않는다. */
export const CATALOG_VERSION = 1;
export const PASS_HOURS = 168;
export const PASS_DAILY = { dm: 1500, shards: 3 };
export const AD_LIMITS = { idle_double: 2 };
export const PRODUCTS = [
    { id: 'remove_ads_forever', name: '영구 광고 제거', type: 'permanent', priceKRW: 9900,
        desc: '보상형 광고 없이 보너스 받기 · 직접 받기와 하루 한도 유지 · 영구 복원', grant: {} },
    { id: 'weekly_pass_7d', name: '주간 패스', type: 'pass', priceKRW: 5500,
        desc: '168시간 · 매일 1,500 DM·조각 3개, 한국시간 하루 1회·최대 7회·소급 없음. 기간 중 광고 생략·방치 상한 12시간. 7회째 태엽 묘지기(보유 시 조각 1개). 자동 갱신 없음', grant: {} },
    { id: 'supply_small', name: '소형 보급', type: 'consumable', priceKRW: 1500,
        desc: '3,000 DM·조각 6개 · 한국시간 월요일 초기화 · 상품별 주 1회', grant: { dm: 3000, shards: 6 } },
    { id: 'supply_medium', name: '중형 보급', type: 'consumable', priceKRW: 4400,
        desc: '9,000 DM·조각 18개 · 한국시간 월요일 초기화 · 상품별 주 1회', grant: { dm: 9000, shards: 18 } },
    { id: 'pet_clockwork_keeper', name: '태엽 묘지기', type: 'permanent', priceKRW: 4400,
        desc: '펫 1종 · 영구 복원 · 재화 동봉 없음', grant: { petId: 'clockwork_keeper' } }
];
export const productOf = id => PRODUCTS.find(p => p.id === id) || null;
