-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 010
-- STREAK REWARDS TABLE (UPDATED TIERS)
-- ═══════════════════════════════════════════════════════════
-- Day 3 (1.2x), Day 7 (2.0x), Day 30 (5.0x)
-- Triggered on 85% Training pass with streak multiplier
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📊 STREAK REWARDS LOOKUP TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_rewards (
    id SERIAL PRIMARY KEY,
    day_threshold INTEGER NOT NULL UNIQUE,
    multiplier NUMERIC(4,2) NOT NULL,
    label VARCHAR(50) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear and repopulate with new tiers
TRUNCATE streak_rewards RESTART IDENTITY;

INSERT INTO streak_rewards (day_threshold, multiplier, label, description, icon) VALUES
    (0,  1.00, 'No Streak',       'Base reward, no multiplier',           '❄️'),
    (1,  1.10, 'Warming Up',      '10% bonus for showing up',             '🌡️'),
    (3,  1.20, 'Streak Tier 1',   '20% bonus - consistency pays!',        '🔥'),
    (7,  2.00, 'Streak Tier 2',   '2X MULTIPLIER - One week warrior!',    '🔥🔥'),
    (14, 2.50, 'Streak Blazing',  '2.5X - Two week commitment!',          '🔥🔥🔥'),
    (30, 5.00, 'Monthly Master',  '5X MULTIPLIER - Legendary status!',    '👑'),
    (60, 6.00, 'Diamond Elite',   '6X - Two month dedication!',           '💎'),
    (100, 7.50, 'Century Club',   '7.5X - 100 day legend!',               '🏆');

COMMENT ON TABLE streak_rewards IS '🔥 Streak multiplier lookup table for training rewards';

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_get_streak_reward_multiplier
-- Gets the highest applicable multiplier for streak days
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_reward_multiplier(p_streak_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward RECORD;
    v_next_reward RECORD;
BEGIN
    -- Get highest applicable tier
    SELECT * INTO v_reward
    FROM streak_rewards
    WHERE day_threshold <= p_streak_days
    ORDER BY day_threshold DESC
    LIMIT 1;

    -- Get next tier for progress tracking
    SELECT * INTO v_next_reward
    FROM streak_rewards
    WHERE day_threshold > p_streak_days
    ORDER BY day_threshold ASC
    LIMIT 1;

    IF v_reward IS NULL THEN
        RETURN jsonb_build_object(
            'multiplier', 1.00,
            'label', 'No Streak',
            'icon', '❄️',
            'current_tier', 0,
            'next_tier', 1,
            'days_to_next', 1
        );
    END IF;

    RETURN jsonb_build_object(
        'multiplier', v_reward.multiplier,
        'label', v_reward.label,
        'description', v_reward.description,
        'icon', v_reward.icon,
        'current_tier', v_reward.day_threshold,
        'streak_days', p_streak_days,
        'next_tier', v_next_reward.day_threshold,
        'next_multiplier', v_next_reward.multiplier,
        'next_label', v_next_reward.label,
        'days_to_next', CASE 
            WHEN v_next_reward.day_threshold IS NOT NULL 
            THEN v_next_reward.day_threshold - p_streak_days 
            ELSE 0 
        END
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_mint_training_reward
-- Mints diamonds on 85% Training pass with streak multiplier
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_training_reward(
    p_user_id UUID,
    p_accuracy NUMERIC(5,4),        -- 0.0000 to 1.0000
    p_base_reward BIGINT DEFAULT 10,
    p_session_id UUID DEFAULT NULL,
    p_training_type VARCHAR(50) DEFAULT 'STANDARD',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_min_accuracy CONSTANT NUMERIC := 0.85;  -- 85% threshold
    v_wallet RECORD;
    v_streak_days INTEGER;
    v_reward_info JSONB;
    v_multiplier NUMERIC;
    v_final_reward BIGINT;
    v_accuracy_bonus BIGINT;
    v_streak_bonus BIGINT;
    v_mint_result JSONB;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION: 85% ACCURACY THRESHOLD
    -- ═══════════════════════════════════════════════════════
    IF p_accuracy < v_min_accuracy THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ACCURACY_BELOW_THRESHOLD',
            'message', format('85%% accuracy required, got %.1f%%', p_accuracy * 100),
            'accuracy', p_accuracy,
            'threshold', v_min_accuracy,
            'diamonds_earned', 0
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- GET STREAK FROM WALLET
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

    v_streak_days := COALESCE(v_wallet.current_streak, 0);

    -- ═══════════════════════════════════════════════════════
    -- GET STREAK MULTIPLIER
    -- ═══════════════════════════════════════════════════════
    v_reward_info := fn_get_streak_reward_multiplier(v_streak_days);
    v_multiplier := (v_reward_info->>'multiplier')::NUMERIC;

    -- Calculate bonuses
    -- Accuracy bonus: extra 10% for each 1% above 85%
    v_accuracy_bonus := FLOOR(p_base_reward * (p_accuracy - v_min_accuracy) * 10);
    
    -- Streak bonus application
    v_final_reward := FLOOR((p_base_reward + v_accuracy_bonus) * v_multiplier);
    v_streak_bonus := v_final_reward - p_base_reward - v_accuracy_bonus;

    -- ═══════════════════════════════════════════════════════
    -- MINT THE REWARD
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET balance = balance + v_final_reward,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_user_id, v_wallet.id, 'CREDIT', v_final_reward, 'TRAINING_REWARD',
        v_wallet.balance, v_wallet.balance + v_final_reward,
        p_session_id, p_training_type,
        p_metadata || jsonb_build_object(
            'accuracy', p_accuracy,
            'base_reward', p_base_reward,
            'accuracy_bonus', v_accuracy_bonus,
            'streak_bonus', v_streak_bonus,
            'multiplier', v_multiplier,
            'streak_days', v_streak_days,
            'streak_tier', v_reward_info->>'label'
        )
    );

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'TRAINING_REWARD_MINTED',
        'reward', jsonb_build_object(
            'base_reward', p_base_reward,
            'accuracy_bonus', v_accuracy_bonus,
            'streak_bonus', v_streak_bonus,
            'total_reward', v_final_reward,
            'multiplier', v_multiplier
        ),
        'training', jsonb_build_object(
            'accuracy', ROUND(p_accuracy * 100, 1) || '%',
            'passed_threshold', TRUE,
            'session_id', p_session_id,
            'type', p_training_type
        ),
        'streak', jsonb_build_object(
            'current_days', v_streak_days,
            'tier', v_reward_info->>'label',
            'icon', v_reward_info->>'icon',
            'next_tier', v_reward_info->>'next_label',
            'days_to_next', (v_reward_info->>'days_to_next')::INTEGER
        ),
        'wallet', jsonb_build_object(
            'new_balance', v_wallet.balance + v_final_reward
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'TRAINING_REWARD_FAILED',
            'message', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON streak_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_streak_reward_multiplier TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mint_training_reward TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_get_streak_reward_multiplier IS '🔥 Get streak multiplier from rewards table';
COMMENT ON FUNCTION fn_mint_training_reward IS '⚡ Mint training reward on 85% pass with streak multiplier';
