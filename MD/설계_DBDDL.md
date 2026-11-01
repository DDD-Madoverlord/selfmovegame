# 데이터베이스 DDL 및 RPC 통합 스크립트 (Database DDL & Functions)

- **작성 일자**: 2026-11-01
- **데이터베이스 환경**: Supabase (PostgreSQL 15+, Region: `ap-northeast-2`)
- **프로젝트 명**: Mad Overlord (`zbprmbooxbymihwdhijn`)
- **문서 목적**: 데이터베이스 전체 테이블(6종), 무결성 제약조건, RLS 정책, 자동 트리거 및 핵심 트랜잭션 RPC 3종의 공식 DDL 아카이빙.

---

## 1. 신규 구축용 전체 DDL 스크립트 (Full Setup DDL)

데이터베이스를 처음부터 구축할 때 실행하는 통합 스크립트입니다.

```sql
-- =============================================================================
-- PROJECT: MAD OVERLORD // FULL DATABASE SETUP DDL
-- 테이블 6종: users, user_wallets, wallet_transactions, user_game_data, 
--            user_stage_records, stage_clear_logs
-- =============================================================================

-- 0. 필수 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. 타임스탬프 자동 갱신 공용 트리거 함수
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. users (유저 프로필 및 유료 권한)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT UNIQUE CHECK (length(nickname) >= 2 AND length(nickname) <= 16),
    has_no_ads BOOLEAN NOT NULL DEFAULT FALSE,
    auto_dispatch_until TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all"
    ON public.users FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "users_update_own"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3. user_wallets (핵심 재화 잔고 - 보안 통제)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_wallets (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    dark_matter BIGINT NOT NULL DEFAULT 2500 CHECK (dark_matter >= 0 AND dark_matter <= 50000000),
    stars INT NOT NULL DEFAULT 0 CHECK (stars >= 0),
    spent_stars INT NOT NULL DEFAULT 0 CHECK (spent_stars >= 0),
    cores INT NOT NULL DEFAULT 0 CHECK (cores >= 0),
    shards INT NOT NULL DEFAULT 0 CHECK (shards >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_wallets_select_own"
    ON public.user_wallets FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_wallets_updated_at
    BEFORE UPDATE ON public.user_wallets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. wallet_transactions (재화 입출금 원장 - 1:N)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_wallets(user_id) ON DELETE CASCADE,
    currency_type TEXT NOT NULL CHECK (currency_type IN ('dark_matter', 'stars', 'cores', 'shards')),
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON public.wallet_transactions (user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select_own"
    ON public.wallet_transactions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. user_game_data (인벤토리/성장 통합 JSONB - P0 보안: SELECT 전용)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_game_data (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 1,
    character_id TEXT NOT NULL DEFAULT 'mech',
    difficulty TEXT NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('normal', 'hard', 'hell', 'nightmare')),
    equipped JSONB NOT NULL DEFAULT '{"head":"head_red_robot","body":"body_red_robot","arm":"arm_red_robot","leg":"leg_red_robot"}'::JSONB,
    loadouts JSONB NOT NULL DEFAULT '{}'::JSONB,
    inventory JSONB NOT NULL DEFAULT '{}'::JSONB,
    research JSONB NOT NULL DEFAULT '{}'::JSONB,
    achievements JSONB NOT NULL DEFAULT '{}'::JSONB,
    support JSONB NOT NULL DEFAULT '{"character":null,"auto":false,"random":false,"helpSeen":false}'::JSONB,
    subsystems JSONB NOT NULL DEFAULT '{"tips":[],"pets":{},"tutorial":{}}'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_game_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_game_data_select_own"
    ON public.user_game_data FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_game_data_updated_at
    BEFORE UPDATE ON public.user_game_data
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 6. user_stage_records (난이도별 진행 기록 - P0 보안: SELECT 전용)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_stage_records (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('normal', 'hard', 'hell', 'nightmare')),
    stages JSONB NOT NULL DEFAULT '{}'::JSONB,
    unlocked_max_stage TEXT NOT NULL DEFAULT '1-1',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, difficulty)
);

ALTER TABLE public.user_stage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_stage_records_select_own"
    ON public.user_stage_records FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_stage_records_updated_at
    BEFORE UPDATE ON public.user_stage_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 7. stage_clear_logs (감사 로그 - 서버 RPC 전용)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stage_clear_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    stage_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    clear_time NUMERIC(7, 2) NOT NULL CHECK (clear_time >= 0),
    stars BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false],
    kill_count INT NOT NULL DEFAULT 0,
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stage_clear_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 8. 신규 유저 가입 자동 초기화 트리거
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_init()
RETURNS TRIGGER AS $$
DECLARE
    default_nick TEXT;
BEGIN
    default_nick := '오버로드_' || SUBSTRING(NEW.id::text, 1, 4);

    -- 1. users 프로필 생성
    INSERT INTO public.users (id, nickname)
    VALUES (NEW.id, default_nick);

    -- 2. 재화 초기화 (기본 2500 DM 지급)
    INSERT INTO public.user_wallets (user_id, dark_matter, stars, spent_stars, cores, shards)
    VALUES (NEW.id, 2500, 0, 0, 0, 0);

    -- 3. 초기 지원금 원장 기록
    INSERT INTO public.wallet_transactions (user_id, currency_type, amount, balance_after, reason, reference_id)
    VALUES (NEW.id, 'dark_matter', 2500, 2500, 'INITIAL_GRANT', 'WELCOME');

    -- 4. 게임 인벤토리/세팅 기본값 생성
    INSERT INTO public.user_game_data (user_id, character_id, difficulty)
    VALUES (NEW.id, 'mech', 'normal');

    -- 5. 노말 난이도 진행도 기본 행 생성
    INSERT INTO public.user_stage_records (user_id, difficulty, unlocked_max_stage)
    VALUES (NEW.id, 'normal', '1-1');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_init();
```

---

## 2. 기존 DB 갱신용 패치 DDL (Migration Alter Script)

이미 초기 5개 테이블을 실행한 상태에서 최신 스펙으로 변경할 때 실행하는 패치 스크립트입니다.

```sql
-- 1. users 테이블: 유료 권한 및 패스 만료일 컬럼 추가
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS has_no_ads BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_dispatch_until TIMESTAMPTZ DEFAULT NULL;

-- 2. user_game_data 테이블: 동기화 버전(revision) 및 업적(achievements) 추가
ALTER TABLE public.user_game_data 
    ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '{}'::JSONB;

-- 3. RLS 쓰기 권한 회수 (P0 보안 조치: 직접 쓰기 차단, SELECT 전용 전환)
DROP POLICY IF EXISTS "user_game_data_insert_own" ON public.user_game_data;
DROP POLICY IF EXISTS "user_game_data_update_own" ON public.user_game_data;
DROP POLICY IF EXISTS "user_stage_records_insert_own" ON public.user_stage_records;
DROP POLICY IF EXISTS "user_stage_records_update_own" ON public.user_stage_records;
DROP POLICY IF EXISTS "stage_clear_logs_insert_own" ON public.stage_clear_logs;

-- 4. wallet_transactions 테이블 보장
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_wallets(user_id) ON DELETE CASCADE,
    currency_type TEXT NOT NULL CHECK (currency_type IN ('dark_matter', 'stars', 'cores', 'shards')),
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON public.wallet_transactions (user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_tx_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

---

## 3. 핵심 트랜잭션 RPC 함수 DDL (Stored Functions)

### 3.1. `get_user_bootstrap()` (로그인 초기 1회 로드)
```sql
CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '인증되지 않은 사용자입니다.';
    END IF;

    UPDATE public.users SET last_login_at = NOW() WHERE id = v_user_id;

    SELECT jsonb_build_object(
        'user', (SELECT to_jsonb(u) FROM public.users u WHERE u.id = v_user_id),
        'wallet', (SELECT to_jsonb(w) FROM public.user_wallets w WHERE w.user_id = v_user_id),
        'game_data', (SELECT to_jsonb(g) FROM public.user_game_data g WHERE g.user_id = v_user_id),
        'stages', (
            SELECT COALESCE(jsonb_object_agg(s.difficulty, s.stages), '{}'::JSONB)
            FROM public.user_stage_records s 
            WHERE s.user_id = v_user_id
        ),
        'server_time', NOW()
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_bootstrap() TO authenticated;
```

---

### 3.2. `settle_battle(p_payload JSONB)` (전투 정산 단일 트랜잭션)
```sql
CREATE OR REPLACE FUNCTION public.settle_battle(p_payload JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_stage_id TEXT;
    v_difficulty TEXT;
    v_clear_time NUMERIC;
    v_kill_count INT;
    v_stars BOOLEAN[];
    v_is_suspicious BOOLEAN := FALSE;
    
    v_stage_rec JSONB;
    v_prev_stars BOOLEAN[] := ARRAY[false, false, false];
    v_merged_stars BOOLEAN[] := ARRAY[false, false, false];
    v_prev_star_count INT := 0;
    v_new_star_count INT := 0;
    v_earned_stars INT := 0;
    v_diff_multiplier NUMERIC := 1.0;
    v_earned_dm BIGINT := 0;
    v_new_dm BIGINT;
    v_new_stars_total INT;
    v_new_revision BIGINT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '인증되지 않은 사용자입니다.';
    END IF;

    -- 파라미터 추출
    v_stage_id := p_payload->>'stage_id';
    v_difficulty := COALESCE(p_payload->>'difficulty', 'normal');
    v_clear_time := (p_payload->>'clear_time')::NUMERIC;
    v_kill_count := COALESCE((p_payload->>'kill_count')::INT, 0);
    
    SELECT ARRAY[
        COALESCE((p_payload->'stars'->>0)::BOOLEAN, false),
        COALESCE((p_payload->'stars'->>1)::BOOLEAN, false),
        COALESCE((p_payload->'stars'->>2)::BOOLEAN, false)
    ] INTO v_stars;

    -- 최소 클리어 시간 치팅 검증 (5초 미만)
    IF v_clear_time < 5.0 THEN
        v_is_suspicious := TRUE;
    END IF;

    v_diff_multiplier := CASE v_difficulty
        WHEN 'hard' THEN 1.4
        WHEN 'hell' THEN 1.9
        WHEN 'nightmare' THEN 2.5
        ELSE 1.0
    END;

    -- 스테이지 진행도 조회 및 별 병합
    SELECT stages INTO v_stage_rec 
    FROM public.user_stage_records 
    WHERE user_id = v_user_id AND difficulty = v_difficulty;

    IF v_stage_rec IS NULL THEN
        v_stage_rec := '{}'::JSONB;
    END IF;

    IF v_stage_rec ? v_stage_id THEN
        v_prev_stars := ARRAY[
            COALESCE((v_stage_rec->v_stage_id->'stars'->>0)::BOOLEAN, false),
            COALESCE((v_stage_rec->v_stage_id->'stars'->>1)::BOOLEAN, false),
            COALESCE((v_stage_rec->v_stage_id->'stars'->>2)::BOOLEAN, false)
        ];
    END IF;

    v_merged_stars := ARRAY[
        v_prev_stars[1] OR v_stars[1],
        v_prev_stars[2] OR v_stars[2],
        v_prev_stars[3] OR v_stars[3]
    ];

    v_prev_star_count := (CASE WHEN v_prev_stars[1] THEN 1 ELSE 0 END) +
                         (CASE WHEN v_prev_stars[2] THEN 1 ELSE 0 END) +
                         (CASE WHEN v_prev_stars[3] THEN 1 ELSE 0 END);

    v_new_star_count := (CASE WHEN v_merged_stars[1] THEN 1 ELSE 0 END) +
                        (CASE WHEN v_merged_stars[2] THEN 1 ELSE 0 END) +
                        (CASE WHEN v_merged_stars[3] THEN 1 ELSE 0 END);

    v_earned_stars := GREATEST(0, v_new_star_count - v_prev_star_count);
    v_earned_dm := ROUND((300 + (v_earned_stars * 300)) * v_diff_multiplier);

    -- 진행도 갱신
    v_stage_rec := jsonb_set(
        v_stage_rec, 
        ARRAY[v_stage_id], 
        jsonb_build_object(
            'stars', to_jsonb(v_merged_stars),
            'cleared', true,
            'best_time', LEAST(COALESCE((v_stage_rec->v_stage_id->>'best_time')::NUMERIC, 999999), v_clear_time)
        )
    );

    UPDATE public.user_stage_records 
    SET stages = v_stage_rec, updated_at = NOW()
    WHERE user_id = v_user_id AND difficulty = v_difficulty;

    -- 지갑 갱신
    UPDATE public.user_wallets 
    SET dark_matter = dark_matter + v_earned_dm,
        stars = stars + v_earned_stars,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING dark_matter, stars INTO v_new_dm, v_new_stars_total;

    -- 원장 영수증 기록
    INSERT INTO public.wallet_transactions (user_id, currency_type, amount, balance_after, reason, reference_id)
    VALUES (v_user_id, 'dark_matter', v_earned_dm, v_new_dm, 'STAGE_CLEAR', v_stage_id);

    IF v_earned_stars > 0 THEN
        INSERT INTO public.wallet_transactions (user_id, currency_type, amount, balance_after, reason, reference_id)
        VALUES (v_user_id, 'stars', v_earned_stars, v_new_stars_total, 'STAGE_STAR_REWARD', v_stage_id);
    END IF;

    -- 업적 및 revision 갱신
    UPDATE public.user_game_data
    SET revision = revision + 1,
        achievements = jsonb_set(
            achievements,
            '{total_kills,cur}',
            to_jsonb(COALESCE((achievements->'total_kills'->>'cur')::INT, 0) + v_kill_count)
        ),
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING revision INTO v_new_revision;

    -- 감사 로그 기록
    INSERT INTO public.stage_clear_logs (user_id, stage_id, difficulty, clear_time, stars, kill_count, is_suspicious)
    VALUES (v_user_id, v_stage_id, v_difficulty, v_clear_time, v_stars, v_kill_count, v_is_suspicious);

    -- 변경분 단일 응답
    RETURN jsonb_build_object(
        'success', true,
        'earned', jsonb_build_object('dark_matter', v_earned_dm, 'stars', v_earned_stars),
        'wallet', jsonb_build_object('dark_matter', v_new_dm, 'stars', v_new_stars_total),
        'stage_update', jsonb_build_object('stars', to_jsonb(v_merged_stars), 'cleared', true),
        'revision', v_new_revision
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.settle_battle(JSONB) TO authenticated;
```

---

### 3.3. `upgrade_part(p_part_id TEXT)` (파츠 강화 단일 트랜잭션)
```sql
CREATE OR REPLACE FUNCTION public.upgrade_part(p_part_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_current_dm BIGINT;
    v_part_level INT := 1;
    v_cost BIGINT := 0;
    v_inventory JSONB;
    v_new_dm BIGINT;
    v_new_revision BIGINT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '인증되지 않은 사용자입니다.';
    END IF;

    -- 인벤토리 조회 및 현재 레벨 확인
    SELECT inventory INTO v_inventory FROM public.user_game_data WHERE user_id = v_user_id;
    IF v_inventory ? p_part_id THEN
        v_part_level := COALESCE((v_inventory->p_part_id->>'lv')::INT, 1);
    END IF;

    IF v_part_level >= 10 THEN
        RAISE EXCEPTION '이미 최대 강화 레벨입니다.';
    END IF;

    -- 강화 비용 산출
    v_cost := ROUND(200 * 0.6 * v_part_level / 10) * 10;
    v_cost := GREATEST(v_cost, 200);

    -- 지갑 잔고 검증 및 차감
    SELECT dark_matter INTO v_current_dm FROM public.user_wallets WHERE user_id = v_user_id;
    IF v_current_dm < v_cost THEN
        RAISE EXCEPTION '다크 매터(DM)가 부족합니다.';
    END IF;

    UPDATE public.user_wallets 
    SET dark_matter = dark_matter - v_cost, updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING dark_matter INTO v_new_dm;

    -- 영수증 기록
    INSERT INTO public.wallet_transactions (user_id, currency_type, amount, balance_after, reason, reference_id)
    VALUES (v_user_id, 'dark_matter', -v_cost, v_new_dm, 'PART_UPGRADE', p_part_id);

    -- 인벤토리 레벨 갱신
    v_inventory := jsonb_set(
        COALESCE(v_inventory, '{}'::JSONB),
        ARRAY[p_part_id],
        jsonb_build_object('lv', v_part_level + 1)
    );

    UPDATE public.user_game_data
    SET inventory = v_inventory,
        revision = revision + 1,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING revision INTO v_new_revision;

    RETURN jsonb_build_object(
        'success', true,
        'part_id', p_part_id,
        'new_level', v_part_level + 1,
        'cost', v_cost,
        'wallet', jsonb_build_object('dark_matter', v_new_dm),
        'revision', v_new_revision
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upgrade_part(TEXT) TO authenticated;
```
