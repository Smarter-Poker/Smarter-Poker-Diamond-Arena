-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 008
-- STREAK BONUS MINTING SYSTEM
-- ═══════════════════════════════════════════════════════════
-- Maps 'streak_multipliers' logic with tier-based bonuses.
-- Tier 1: 3 days = 1.2x | Tier 2: 7 days = 2.0x
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔥 STREAK MULTIPLIER LOOKUP TABLE
-- Immutable tier configuration stored in database
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_multipliers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(20) NOT NULL UNIQUE,
    min_days INTEGER NOT NULL,
    max_days INTEGER,  -- NULL means infinite
    multiplier NUMERIC(4,2) NOT NULL,
    label VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear existing data and insert fresh tiers
TRUNCATE streak_multipliers RESTART IDENTITY;

INSERT INTO streak_multipliers (tier_name, min_days, max_days, multiplier, label) VALUES
    ('COLD',      0,    0,    1.00, '❄️ Cold'),
    ('WARMING',   1,    2,    1.10, '🌡️ Warming'),
    ('TIER_1',    3,    6,    1.20, '🔥 Streak Tier 1'),
    ('TIER_2',    7,    13,   2.00, '🔥🔥 Streak Tier 2'),
    ('BLAZING',   14,   29,   2.25, '🔥🔥🔥 Blazing'),
    ('LEGENDARY', 30,   NULL, 2.50, '👑 Legendary');

COMMENT ON TABLE streak_multipliers IS '🔥 Configurable streak tier multipliers';

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_get_streak_multiplier_v2
-- Returns multiplier from configurable table
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_multiplier_v2(p_consecutive_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier RECORD;
BEGIN
    SELECT * INTO v_tier
    FROM streak_multipliers
    WHERE p_consecutive_days >= min_days
      AND (max_days IS NULL OR p_consecutive_days <= max_days)
    ORDER BY min_days DESC
    LIMIT 1;
    
    IF v_tier IS NULL THEN
        RETURN jsonb_build_object(
            'tier', 'COLD',
            'multiplier', 1.00,
            'label', '❄️ Cold'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'tier', v_tier.tier_name,
        'multiplier', v_tier.multiplier,
        'label', v_tier.label,
        'min_days', v_tier.min_days,
        'max_days', v_tier.max_days
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_mint_with_streak_bonus
-- Mints diamonds with automatic streak multiplier application
-- Checks 'consecutive_login_days' before finalizing mint
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_with_streak_bonus(
    p_user_id UUID,
    p_base_amount BIGINT,
    p_source VARCHAR(50) DEFAULT 'SESSION_REWARD',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet_id UUID;
    v_balance_before BIGINT;
    v_balance_after BIGINT;
    v_consecutive_days INTEGER;
    v_streak_info JSONB;
    v_multiplier NUMERIC(4,2);
    v_final_amount BIGINT;
    v_bonus_amount BIGINT;
    v_transaction_id UUID;
    v_wallet_created BOOLEAN := FALSE;
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_execution_ms NUMERIC;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_USER',
            'status', 'STREAK_MINT_FAILED'
        );
    END IF;

    IF p_base_amount IS NULL OR p_base_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'status', 'STREAK_MINT_FAILED'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE WALLET WITH LOCK
    -- ═══════════════════════════════════════════════════════
    BEGIN
        SELECT id, balance, current_streak 
        INTO v_wallet_id, v_balance_before, v_consecutive_days
        FROM wallets
        WHERE user_id = p_user_id
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'WALLET_LOCKED',
                'status', 'STREAK_MINT_RETRY'
            );
    END;

    -- Create wallet if not exists
    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (
            user_id, balance, currency, 
            current_streak, longest_streak
        ) VALUES (
            p_user_id, 0, 'DIAMOND', 0, 0
        )
        RETURNING id, balance, current_streak 
        INTO v_wallet_id, v_balance_before, v_consecutive_days;
        v_wallet_created := TRUE;
    END IF;

    v_consecutive_days := COALESCE(v_consecutive_days, 0);

    -- ═══════════════════════════════════════════════════════
    -- GET STREAK MULTIPLIER
    -- Tier 1: 3 days = 1.2x | Tier 2: 7 days = 2.0x
    -- ═══════════════════════════════════════════════════════
    v_streak_info := fn_get_streak_multiplier_v2(v_consecutive_days);
    v_multiplier := (v_streak_info->>'multiplier')::NUMERIC;

    -- Calculate final amount
    v_final_amount := FLOOR(p_base_amount * v_multiplier);
    v_bonus_amount := v_final_amount - p_base_amount;
    v_balance_after := v_balance_before + v_final_amount;

    -- ═══════════════════════════════════════════════════════
    -- EXECUTE ATOMIC MINT
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Record transaction with streak metadata
    INSERT INTO transactions (
        user_id,
        wallet_id,
        type,
        amount,
        source,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        p_user_id,
        v_wallet_id,
        'CREDIT',
        v_final_amount,
        p_source,
        v_balance_before,
        v_balance_after,
        p_metadata || jsonb_build_object(
            'streak_bonus', TRUE,
            'base_amount', p_base_amount,
            'bonus_amount', v_bonus_amount,
            'consecutive_days', v_consecutive_days,
            'multiplier', v_multiplier,
            'tier', v_streak_info->>'tier',
            'tier_label', v_streak_info->>'label'
        )
    )
    RETURNING id INTO v_transaction_id;

    v_execution_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time));

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'STREAK_MINT_SUCCESS',
        'data', jsonb_build_object(
            'user_id', p_user_id,
            'base_amount', p_base_amount,
            'bonus_amount', v_bonus_amount,
            'final_amount', v_final_amount,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'wallet_id', v_wallet_id,
            'transaction_id', v_transaction_id,
            'wallet_created', v_wallet_created
        ),
        'streak', jsonb_build_object(
            'consecutive_days', v_consecutive_days,
            'multiplier', v_multiplier,
            'tier', v_streak_info->>'tier',
            'tier_label', v_streak_info->>'label'
        ),
        'meta', jsonb_build_object(
            'execution_ms', v_execution_ms,
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'STREAK_MINT_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE,
            'status', 'STREAK_MINT_FAILED'
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🔄 fn_update_consecutive_login
-- Updates login streak and returns new streak info
-- Call this when user logs in / claims daily
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_update_consecutive_login(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_hours_since_last NUMERIC;
    v_new_streak INTEGER;
    v_streak_reset BOOLEAN := FALSE;
    v_grace_period_hours CONSTANT INTEGER := 48;
BEGIN
    -- Get wallet with lock
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_wallet IS NULL THEN
        -- Create new wallet
        INSERT INTO wallets (
            user_id, balance, currency,
            current_streak, longest_streak, last_claim
        ) VALUES (
            p_user_id, 0, 'DIAMOND', 1, 1, v_now
        );
        
        RETURN jsonb_build_object(
            'success', TRUE,
            'consecutive_days', 1,
            'streak_reset', FALSE,
            'first_login', TRUE,
            'multiplier_info', fn_get_streak_multiplier_v2(1)
        );
    END IF;

    -- Calculate hours since last claim
    IF v_wallet.last_claim IS NOT NULL THEN
        v_hours_since_last := EXTRACT(EPOCH FROM (v_now - v_wallet.last_claim)) / 3600.0;
        
        IF v_hours_since_last > v_grace_period_hours THEN
            -- Streak broken - reset to 1
            v_new_streak := 1;
            v_streak_reset := TRUE;
        ELSE
            -- Continue streak
            v_new_streak := v_wallet.current_streak + 1;
        END IF;
    ELSE
        v_new_streak := 1;
    END IF;

    -- Update wallet
    UPDATE wallets
    SET current_streak = v_new_streak,
        longest_streak = GREATEST(longest_streak, v_new_streak),
        last_claim = v_now,
        updated_at = v_now
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'consecutive_days', v_new_streak,
        'previous_streak', v_wallet.current_streak,
        'longest_streak', GREATEST(v_wallet.longest_streak, v_new_streak),
        'streak_reset', v_streak_reset,
        'first_login', FALSE,
        'multiplier_info', fn_get_streak_multiplier_v2(v_new_streak)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_login_and_mint_bonus
-- Combined: Update login streak + mint daily bonus
-- Single atomic operation for daily rewards
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_login_and_mint_bonus(
    p_user_id UUID,
    p_base_bonus BIGINT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_login_result JSONB;
    v_mint_result JSONB;
    v_consecutive_days INTEGER;
BEGIN
    -- Update login streak first
    v_login_result := fn_update_consecutive_login(p_user_id);
    
    IF NOT (v_login_result->>'success')::BOOLEAN THEN
        RETURN v_login_result;
    END IF;
    
    v_consecutive_days := (v_login_result->>'consecutive_days')::INTEGER;
    
    -- Mint bonus with streak multiplier
    v_mint_result := fn_mint_with_streak_bonus(
        p_user_id,
        p_base_bonus,
        'DAILY_CLAIM',
        jsonb_build_object('login_bonus', TRUE)
    );
    
    IF NOT (v_mint_result->>'success')::BOOLEAN THEN
        RETURN v_mint_result;
    END IF;
    
    -- Combine results
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'LOGIN_BONUS_SUCCESS',
        'login', v_login_result,
        'mint', v_mint_result,
        'summary', jsonb_build_object(
            'consecutive_days', v_consecutive_days,
            'diamonds_earned', (v_mint_result->'data'->>'final_amount')::BIGINT,
            'new_balance', (v_mint_result->'data'->>'balance_after')::BIGINT,
            'multiplier', (v_mint_result->'streak'->>'multiplier')::NUMERIC,
            'tier', v_mint_result->'streak'->>'tier_label'
        )
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON streak_multipliers TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_streak_multiplier_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mint_with_streak_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION fn_update_consecutive_login TO authenticated;
GRANT EXECUTE ON FUNCTION fn_login_and_mint_bonus TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_get_streak_multiplier_v2 IS '🔥 Get streak multiplier from configurable tiers table';
COMMENT ON FUNCTION fn_mint_with_streak_bonus IS '⚡ Mint diamonds with automatic streak multiplier';
COMMENT ON FUNCTION fn_update_consecutive_login IS '🔄 Update consecutive login days and return streak info';
COMMENT ON FUNCTION fn_login_and_mint_bonus IS '⚡ Combined login update + bonus mint in single atomic op';
