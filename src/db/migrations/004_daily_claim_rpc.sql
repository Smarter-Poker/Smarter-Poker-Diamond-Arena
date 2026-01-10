-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 004
-- DAILY CLAIM RPC + STREAK LOGIC
-- ═══════════════════════════════════════════════════════════
-- Complete daily claim logic executed at database level.
-- Streak multipliers, grace periods, and milestones.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔥 STREAK TIER CALCULATION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_multiplier(p_streak_days INTEGER)
RETURNS NUMERIC(4,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Tier-based multipliers (aligned with DiamondMintEngine)
    RETURN CASE
        WHEN p_streak_days >= 30 THEN 2.00  -- LEGENDARY
        WHEN p_streak_days >= 14 THEN 1.75  -- BLAZING
        WHEN p_streak_days >= 7  THEN 1.50  -- HOT
        WHEN p_streak_days >= 3  THEN 1.25  -- WARM
        WHEN p_streak_days >= 1  THEN 1.10  -- WARMING
        ELSE 1.00                            -- COLD
    END;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_streak_tier_label(p_streak_days INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE
        WHEN p_streak_days >= 30 THEN '👑 Legendary'
        WHEN p_streak_days >= 14 THEN '🔥🔥🔥 Blazing'
        WHEN p_streak_days >= 7  THEN '🔥🔥 Hot'
        WHEN p_streak_days >= 3  THEN '🔥 Warm'
        WHEN p_streak_days >= 1  THEN '🌡️ Warming'
        ELSE '❄️ Cold'
    END;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎯 MILESTONE BONUS CALCULATION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_milestone_bonus(p_streak_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Check if this exact day is a milestone
    RETURN CASE p_streak_days
        WHEN 100 THEN jsonb_build_object('is_milestone', TRUE, 'multiplier', 5.0, 'tier', 'CENTURY')
        WHEN 30  THEN jsonb_build_object('is_milestone', TRUE, 'multiplier', 3.0, 'tier', 'MONTH')
        WHEN 14  THEN jsonb_build_object('is_milestone', TRUE, 'multiplier', 2.5, 'tier', 'BIWEEK')
        WHEN 7   THEN jsonb_build_object('is_milestone', TRUE, 'multiplier', 2.0, 'tier', 'WEEK')
        ELSE jsonb_build_object('is_milestone', FALSE, 'multiplier', 1.0, 'tier', NULL)
    END;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎁 ATOMIC DAILY CLAIM
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_claim_daily_reward(
    p_user_id UUID,
    p_base_reward BIGINT DEFAULT 5,
    p_comeback_bonus BIGINT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_hours_since_claim NUMERIC;
    v_streak_status TEXT;
    v_new_streak INTEGER;
    v_streak_continued BOOLEAN := FALSE;
    v_comeback_applied BOOLEAN := FALSE;
    v_multiplier NUMERIC(4,2);
    v_milestone JSONB;
    v_base_with_streak BIGINT;
    v_total_reward BIGINT;
    v_mint_result JSONB;
    v_grace_period_hours CONSTANT INTEGER := 48;
    v_min_hours_between_claims CONSTANT INTEGER := 20;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GET OR CREATE WALLET WITH LOCK
    -- ═══════════════════════════════════════════════════════
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_user_id, 0, 'DIAMOND', 0, 0)
        RETURNING * INTO v_wallet;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- CALCULATE STREAK STATUS
    -- ═══════════════════════════════════════════════════════
    IF v_wallet.last_claim IS NULL THEN
        v_streak_status := 'FIRST_TIME';
        v_hours_since_claim := NULL;
    ELSE
        v_hours_since_claim := EXTRACT(EPOCH FROM (v_now - v_wallet.last_claim)) / 3600.0;
        
        IF v_hours_since_claim < v_min_hours_between_claims THEN
            -- Too soon to claim again
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'TOO_SOON',
                'message', format('Please wait %s more hours', 
                    ROUND(v_min_hours_between_claims - v_hours_since_claim, 1)),
                'hours_until_eligible', ROUND(v_min_hours_between_claims - v_hours_since_claim, 1),
                'current_streak', v_wallet.current_streak,
                'balance', v_wallet.balance
            );
        ELSIF v_hours_since_claim > v_grace_period_hours THEN
            v_streak_status := 'BROKEN';
        ELSE
            v_streak_status := 'ACTIVE';
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- CALCULATE NEW STREAK
    -- ═══════════════════════════════════════════════════════
    CASE v_streak_status
        WHEN 'FIRST_TIME' THEN
            v_new_streak := 1;
        WHEN 'BROKEN' THEN
            v_new_streak := 1;
            v_comeback_applied := TRUE;
        WHEN 'ACTIVE' THEN
            v_new_streak := v_wallet.current_streak + 1;
            v_streak_continued := TRUE;
    END CASE;

    -- ═══════════════════════════════════════════════════════
    -- CALCULATE REWARD
    -- ═══════════════════════════════════════════════════════
    v_multiplier := fn_get_streak_multiplier(v_new_streak);
    v_milestone := fn_get_milestone_bonus(v_new_streak);
    
    -- Base reward with streak multiplier
    v_base_with_streak := FLOOR(p_base_reward * v_multiplier);
    
    -- Add comeback bonus if applicable
    IF v_comeback_applied THEN
        v_base_with_streak := v_base_with_streak + p_comeback_bonus;
    END IF;
    
    -- Apply milestone multiplier if applicable
    IF (v_milestone->>'is_milestone')::BOOLEAN THEN
        v_total_reward := FLOOR(v_base_with_streak * (v_milestone->>'multiplier')::NUMERIC);
    ELSE
        v_total_reward := v_base_with_streak;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- UPDATE STREAK DATA
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET current_streak = v_new_streak,
        longest_streak = GREATEST(longest_streak, v_new_streak),
        last_claim = v_now,
        updated_at = v_now
    WHERE id = v_wallet.id;

    -- ═══════════════════════════════════════════════════════
    -- MINT THE DIAMONDS
    -- ═══════════════════════════════════════════════════════
    v_mint_result := fn_mint_diamonds_atomic(
        p_user_id,
        v_total_reward,
        'DAILY_CLAIM',
        NULL,
        NULL,
        jsonb_build_object(
            'streak_day', v_new_streak,
            'base_reward', p_base_reward,
            'multiplier', v_multiplier,
            'comeback_bonus', CASE WHEN v_comeback_applied THEN p_comeback_bonus ELSE 0 END,
            'milestone', v_milestone
        )
    );

    IF NOT (v_mint_result->>'success')::BOOLEAN THEN
        RETURN v_mint_result;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'claim', jsonb_build_object(
            'total_diamonds', v_total_reward,
            'base_reward', p_base_reward,
            'streak_bonus', v_base_with_streak - p_base_reward - 
                CASE WHEN v_comeback_applied THEN p_comeback_bonus ELSE 0 END,
            'comeback_bonus', CASE WHEN v_comeback_applied THEN p_comeback_bonus ELSE 0 END,
            'milestone_bonus', CASE WHEN (v_milestone->>'is_milestone')::BOOLEAN 
                THEN jsonb_build_object(
                    'day', v_new_streak,
                    'multiplier', (v_milestone->>'multiplier')::NUMERIC,
                    'tier', v_milestone->>'tier'
                )
                ELSE NULL END
        ),
        'streak', jsonb_build_object(
            'previous', v_wallet.current_streak,
            'current', v_new_streak,
            'longest', GREATEST(v_wallet.longest_streak, v_new_streak),
            'continued', v_streak_continued,
            'tier', fn_get_streak_tier_label(v_new_streak),
            'multiplier', v_multiplier
        ),
        'wallet', jsonb_build_object(
            'new_balance', (v_mint_result->>'balance_after')::BIGINT,
            'transaction_id', v_mint_result->>'transaction_id'
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'CLAIM_FAILED',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 GET STREAK STATUS (READ-ONLY)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_hours_since_claim NUMERIC;
    v_streak_status TEXT;
    v_effective_streak INTEGER;
    v_can_claim BOOLEAN;
    v_grace_period_hours CONSTANT INTEGER := 48;
    v_min_hours_between_claims CONSTANT INTEGER := 20;
BEGIN
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id;

    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'user_id', p_user_id,
            'current_streak', 0,
            'longest_streak', 0,
            'last_claim', NULL,
            'hours_since_claim', NULL,
            'hours_until_expiry', NULL,
            'status', 'FIRST_TIME',
            'can_claim', TRUE,
            'tier', fn_get_streak_tier_label(0),
            'multiplier', fn_get_streak_multiplier(0),
            'balance', 0
        );
    END IF;

    IF v_wallet.last_claim IS NULL THEN
        v_streak_status := 'FIRST_TIME';
        v_effective_streak := 0;
        v_can_claim := TRUE;
        v_hours_since_claim := NULL;
    ELSE
        v_hours_since_claim := EXTRACT(EPOCH FROM (v_now - v_wallet.last_claim)) / 3600.0;
        
        IF v_hours_since_claim < v_min_hours_between_claims THEN
            v_streak_status := 'TOO_SOON';
            v_effective_streak := v_wallet.current_streak;
            v_can_claim := FALSE;
        ELSIF v_hours_since_claim > v_grace_period_hours THEN
            v_streak_status := 'BROKEN';
            v_effective_streak := 0;
            v_can_claim := TRUE;
        ELSE
            v_streak_status := 'ACTIVE';
            v_effective_streak := v_wallet.current_streak;
            v_can_claim := TRUE;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'current_streak', v_effective_streak,
        'longest_streak', v_wallet.longest_streak,
        'last_claim', v_wallet.last_claim,
        'hours_since_claim', CASE WHEN v_hours_since_claim IS NOT NULL 
            THEN ROUND(v_hours_since_claim, 1) ELSE NULL END,
        'hours_until_expiry', CASE WHEN v_hours_since_claim IS NOT NULL 
            THEN GREATEST(0, ROUND(v_grace_period_hours - v_hours_since_claim, 1)) ELSE NULL END,
        'hours_until_eligible', CASE WHEN v_streak_status = 'TOO_SOON'
            THEN ROUND(v_min_hours_between_claims - v_hours_since_claim, 1) ELSE 0 END,
        'status', v_streak_status,
        'can_claim', v_can_claim,
        'tier', fn_get_streak_tier_label(v_effective_streak),
        'multiplier', fn_get_streak_multiplier(v_effective_streak),
        'balance', v_wallet.balance
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_get_streak_multiplier TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_streak_tier_label TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_milestone_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION fn_claim_daily_reward TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_streak_status TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_get_streak_multiplier IS '🔥 Returns multiplier for given streak days';
COMMENT ON FUNCTION fn_get_streak_tier_label IS '🏷️ Returns tier label for given streak days';
COMMENT ON FUNCTION fn_get_milestone_bonus IS '🎯 Returns milestone bonus info if applicable';
COMMENT ON FUNCTION fn_claim_daily_reward IS '🎁 Process daily claim with full streak logic';
COMMENT ON FUNCTION fn_get_streak_status IS '📊 Get current streak status without modification';
