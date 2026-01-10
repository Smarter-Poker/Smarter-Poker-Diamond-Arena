-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 006
-- SESSION REWARD MINTING (TRAINING COMPLETION)
-- ═══════════════════════════════════════════════════════════
-- Atomic session reward calculation with streak multiplier.
-- Called after training session completion.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_session_reward(
    p_user_id UUID,
    p_accuracy NUMERIC(5,4),           -- 0.0000 to 1.0000
    p_questions_answered INTEGER,
    p_session_id UUID DEFAULT NULL,
    p_session_type VARCHAR(30) DEFAULT 'TRAINING'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_streak INTEGER;
    v_multiplier NUMERIC(4,2);
    v_base_per_question CONSTANT NUMERIC := 0.5;  -- 10 diamonds per 20 questions
    v_raw_base NUMERIC;
    v_base_diamonds BIGINT;
    v_total_reward BIGINT;
    v_mint_result JSONB;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_accuracy < 0 OR p_accuracy > 1 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_ACCURACY',
            'message', 'Accuracy must be between 0 and 1'
        );
    END IF;

    IF p_questions_answered <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_QUESTIONS',
            'message', 'Questions answered must be positive'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- GET STREAK FROM WALLET
    -- ═══════════════════════════════════════════════════════
    SELECT current_streak INTO v_streak
    FROM wallets
    WHERE user_id = p_user_id;

    v_streak := COALESCE(v_streak, 0);

    -- ═══════════════════════════════════════════════════════
    -- CALCULATE BASE REWARD
    -- Base formula: questions × 0.5 × accuracy
    -- Perfect 20-question session = 10 diamonds
    -- ═══════════════════════════════════════════════════════
    v_raw_base := p_questions_answered * v_base_per_question * p_accuracy;
    v_base_diamonds := FLOOR(v_raw_base);

    -- Minimum 1 diamond for any completed session
    IF v_base_diamonds < 1 AND p_questions_answered > 0 THEN
        v_base_diamonds := 1;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- APPLY STREAK MULTIPLIER
    -- ═══════════════════════════════════════════════════════
    v_multiplier := fn_get_streak_multiplier(v_streak);
    v_total_reward := FLOOR(v_base_diamonds * v_multiplier);

    -- ═══════════════════════════════════════════════════════
    -- MINT THE DIAMONDS
    -- ═══════════════════════════════════════════════════════
    v_mint_result := fn_mint_diamonds_atomic(
        p_user_id,
        v_total_reward,
        'SESSION_REWARD',
        p_session_id,
        p_session_type,
        jsonb_build_object(
            'accuracy', p_accuracy,
            'questions_answered', p_questions_answered,
            'base_diamonds', v_base_diamonds,
            'streak_days', v_streak,
            'multiplier', v_multiplier
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
        'reward', jsonb_build_object(
            'total_diamonds', v_total_reward,
            'base_diamonds', v_base_diamonds,
            'streak_bonus', v_total_reward - v_base_diamonds,
            'multiplier', v_multiplier
        ),
        'session', jsonb_build_object(
            'accuracy', ROUND(p_accuracy * 100, 1) || '%',
            'questions_answered', p_questions_answered,
            'session_id', p_session_id,
            'session_type', p_session_type
        ),
        'streak', jsonb_build_object(
            'current', v_streak,
            'tier', fn_get_streak_tier_label(v_streak)
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
            'error', 'SESSION_REWARD_FAILED',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎮 ARCADE STAKE + PAYOUT (Atomic Pair)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_arcade_stake(
    p_user_id UUID,
    p_stake_amount BIGINT,
    p_game_mode VARCHAR(30),
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN fn_burn_diamonds_atomic(
        p_user_id,
        p_stake_amount,
        'ARCADE_STAKE',
        p_session_id,
        'ARCADE_SESSION',
        jsonb_build_object('game_mode', p_game_mode)
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_arcade_payout(
    p_user_id UUID,
    p_win_amount BIGINT,
    p_session_id UUID,
    p_game_result JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_win_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'amount', 0,
            'message', 'No payout for zero win amount'
        );
    END IF;

    RETURN fn_mint_diamonds_atomic(
        p_user_id,
        p_win_amount,
        'ARCADE_WIN',
        p_session_id,
        'ARCADE_SESSION',
        p_game_result
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🛒 STORE PURCHASE + REFUND
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_store_purchase(
    p_user_id UUID,
    p_amount BIGINT,
    p_order_id UUID,
    p_item_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN fn_burn_diamonds_atomic(
        p_user_id,
        p_amount,
        'STORE_PURCHASE',
        p_order_id,
        'ORDER',
        p_item_data
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_store_refund(
    p_user_id UUID,
    p_amount BIGINT,
    p_order_id UUID,
    p_refund_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN fn_mint_diamonds_atomic(
        p_user_id,
        p_amount,
        'STORE_REFUND',
        p_order_id,
        'ORDER',
        jsonb_build_object('reason', p_refund_reason)
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🔑 ADMIN OPERATIONS
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_admin_grant_diamonds(
    p_user_id UUID,
    p_amount BIGINT,
    p_reason TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- TODO: Add admin role check via auth.jwt()
    RETURN fn_mint_diamonds_atomic(
        p_user_id,
        p_amount,
        'ADMIN_GRANT',
        NULL,
        NULL,
        jsonb_build_object(
            'reason', p_reason,
            'granted_by', p_admin_id
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_admin_revoke_diamonds(
    p_user_id UUID,
    p_amount BIGINT,
    p_reason TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- TODO: Add admin role check via auth.jwt()
    RETURN fn_burn_diamonds_atomic(
        p_user_id,
        p_amount,
        'ADMIN_REVOKE',
        NULL,
        NULL,
        jsonb_build_object(
            'reason', p_reason,
            'revoked_by', p_admin_id
        )
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_mint_session_reward TO authenticated;
GRANT EXECUTE ON FUNCTION fn_arcade_stake TO authenticated;
GRANT EXECUTE ON FUNCTION fn_arcade_payout TO authenticated;
GRANT EXECUTE ON FUNCTION fn_store_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION fn_store_refund TO authenticated;
-- Admin functions should be restricted to service role only
-- GRANT EXECUTE ON FUNCTION fn_admin_grant_diamonds TO service_role;
-- GRANT EXECUTE ON FUNCTION fn_admin_revoke_diamonds TO service_role;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_mint_session_reward IS '🎓 Mint diamonds for training session completion';
COMMENT ON FUNCTION fn_arcade_stake IS '🎮 Debit diamonds for arcade entry stake';
COMMENT ON FUNCTION fn_arcade_payout IS '🏆 Credit diamonds for arcade winnings';
COMMENT ON FUNCTION fn_store_purchase IS '🛒 Debit diamonds for marketplace purchase';
COMMENT ON FUNCTION fn_store_refund IS '↩️ Credit diamonds for order refund';
COMMENT ON FUNCTION fn_admin_grant_diamonds IS '🔑 Admin: Grant diamonds to user';
COMMENT ON FUNCTION fn_admin_revoke_diamonds IS '🔑 Admin: Revoke diamonds from user';
