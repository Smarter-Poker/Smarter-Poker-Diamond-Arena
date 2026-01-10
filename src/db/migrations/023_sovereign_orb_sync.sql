-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 023
-- SOVEREIGN ORB SYNC (ORB_03 & ORB_07)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 41: DIAMOND_TREASURY_SYNC
-- TASK 42: 25_PERCENT_BURN_ENFORCER (Arcade)
-- TASK 43: STREAK_MULTIPLIER_SYNC (Arena)
--
-- SOVEREIGN_ORB_SYNC: ENABLED
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 41: DIAMOND_TREASURY_SYNC
-- ═══════════════════════════════════════════════════════════
-- Map all earnings in Orbs 3 and 7 to diamonds_delta in activity ledger
-- ═══════════════════════════════════════════════════════════

-- Activity Ledger for tracking diamond deltas from all Orbs
CREATE TABLE IF NOT EXISTS activity_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Source Orb
    orb_id INTEGER NOT NULL,  -- 3 = Social/Diamond Arena, 7 = Arcade Royale
    orb_name VARCHAR(50) NOT NULL,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL,
    activity_ref UUID,  -- Reference to source record
    
    -- Diamond Delta (core sync field)
    diamonds_delta BIGINT NOT NULL,  -- Positive = earned, Negative = spent/burned
    
    -- Pre-multiplier value (for audit)
    base_amount BIGINT,
    multiplier_applied NUMERIC(4,2) DEFAULT 1.00,
    
    -- Burn tracking (if applicable)
    burn_amount BIGINT DEFAULT 0,
    burn_enforced BOOLEAN DEFAULT FALSE,
    
    -- Sync status
    synced_to_wallet BOOLEAN DEFAULT FALSE,
    wallet_tx_id UUID,
    
    -- Timestamps
    activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    
    CONSTRAINT valid_orb CHECK (orb_id IN (3, 7))
);

CREATE INDEX IF NOT EXISTS idx_activity_ledger_user ON activity_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_ledger_orb ON activity_ledger(orb_id);
CREATE INDEX IF NOT EXISTS idx_activity_ledger_time ON activity_ledger(activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_ledger_unsynced ON activity_ledger(synced_to_wallet) WHERE synced_to_wallet = FALSE;

COMMENT ON TABLE activity_ledger IS '💎 TASK 41: Activity ledger for diamond deltas from Orbs 3 & 7';

-- ═══════════════════════════════════════════════════════════
-- 💎 fn_record_diamond_activity
-- Records activity and diamonds_delta from any Orb
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_record_diamond_activity(
    p_user_id UUID,
    p_orb_id INTEGER,
    p_activity_type VARCHAR(50),
    p_diamonds_delta BIGINT,
    p_base_amount BIGINT DEFAULT NULL,
    p_multiplier NUMERIC DEFAULT 1.00,
    p_activity_ref UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_orb_name VARCHAR(50);
    v_activity_id UUID;
BEGIN
    -- Map orb ID to name
    v_orb_name := CASE p_orb_id
        WHEN 3 THEN 'DIAMOND_ARENA'
        WHEN 7 THEN 'ARCADE_ROYALE'
        ELSE 'UNKNOWN_ORB'
    END;
    
    -- Record activity
    INSERT INTO activity_ledger (
        user_id, orb_id, orb_name, activity_type,
        diamonds_delta, base_amount, multiplier_applied,
        activity_ref
    ) VALUES (
        p_user_id, p_orb_id, v_orb_name, p_activity_type,
        p_diamonds_delta, COALESCE(p_base_amount, p_diamonds_delta), p_multiplier,
        p_activity_ref
    )
    RETURNING id INTO v_activity_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'activity_id', v_activity_id,
        'orb', jsonb_build_object(
            'id', p_orb_id,
            'name', v_orb_name
        ),
        'delta', jsonb_build_object(
            'diamonds_delta', p_diamonds_delta,
            'base_amount', COALESCE(p_base_amount, p_diamonds_delta),
            'multiplier', p_multiplier
        ),
        'pending_sync', TRUE,
        'task', 'DIAMOND_TREASURY_SYNC'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🔄 fn_sync_activity_to_wallet
-- Syncs pending activities to wallet balance
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_sync_activity_to_wallet(
    p_activity_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity RECORD;
    v_wallet RECORD;
    v_tx_id UUID;
    v_tx_type VARCHAR(10);
    v_source VARCHAR(50);
BEGIN
    -- Get activity
    SELECT * INTO v_activity
    FROM activity_ledger
    WHERE id = p_activity_id AND synced_to_wallet = FALSE
    FOR UPDATE NOWAIT;
    
    IF v_activity IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ACTIVITY_NOT_FOUND_OR_ALREADY_SYNCED'
        );
    END IF;
    
    -- Get wallet
    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = v_activity.user_id
    FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_NOT_FOUND'
        );
    END IF;
    
    -- Determine transaction type
    v_tx_type := CASE WHEN v_activity.diamonds_delta >= 0 THEN 'CREDIT' ELSE 'DEBIT' END;
    v_source := format('ORB_%s_%s', v_activity.orb_id, v_activity.activity_type);
    
    -- Update wallet
    UPDATE wallets
    SET balance = balance + v_activity.diamonds_delta,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Record transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after,
        reference_id, reference_type, metadata
    ) VALUES (
        v_activity.user_id, v_wallet.id, v_tx_type, ABS(v_activity.diamonds_delta), v_source,
        v_wallet.balance, v_wallet.balance + v_activity.diamonds_delta,
        v_activity.id, 'ACTIVITY_LEDGER',
        jsonb_build_object(
            'orb_id', v_activity.orb_id,
            'orb_name', v_activity.orb_name,
            'activity_type', v_activity.activity_type,
            'multiplier', v_activity.multiplier_applied
        )
    )
    RETURNING id INTO v_tx_id;
    
    -- Mark synced
    UPDATE activity_ledger
    SET synced_to_wallet = TRUE,
        wallet_tx_id = v_tx_id,
        synced_at = NOW()
    WHERE id = p_activity_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'activity_id', p_activity_id,
        'transaction_id', v_tx_id,
        'synced', jsonb_build_object(
            'diamonds_delta', v_activity.diamonds_delta,
            'new_balance', v_wallet.balance + v_activity.diamonds_delta
        ),
        'task', 'DIAMOND_TREASURY_SYNC'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 42: 25_PERCENT_BURN_ENFORCER (Arcade)
-- ═══════════════════════════════════════════════════════════
-- Force-map the 25% burn law to all Arcade Royale (Orb 7) transactions
-- ═══════════════════════════════════════════════════════════

-- Arcade transaction log with enforced burn
CREATE TABLE IF NOT EXISTS arcade_burn_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Transaction type
    tx_type VARCHAR(30) NOT NULL,  -- STAKE, PAYOUT, JACKPOT, PVP_WIN, etc.
    
    -- Original amount
    gross_amount BIGINT NOT NULL,
    
    -- Burn enforcement (25% HARD LAW)
    burn_amount BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    
    -- Verification
    burn_rate NUMERIC(5,4) NOT NULL,  -- Should always be 0.25
    burn_enforced BOOLEAN DEFAULT TRUE,
    
    -- References
    arcade_session_id UUID,
    game_mode VARCHAR(50),
    
    -- Sync
    activity_ledger_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arcade_burn_user ON arcade_burn_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_arcade_burn_time ON arcade_burn_ledger(created_at DESC);

COMMENT ON TABLE arcade_burn_ledger IS '🔥 TASK 42: Arcade burn enforcement ledger (25% HARD LAW)';

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_arcade_transaction_with_burn
-- Processes Arcade (Orb 7) transaction with mandatory 25% burn
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_arcade_transaction_with_burn(
    p_user_id UUID,
    p_tx_type VARCHAR(30),
    p_gross_amount BIGINT,
    p_session_id UUID DEFAULT NULL,
    p_game_mode VARCHAR(50) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW - IMMUTABLE
    
    v_burn_amount BIGINT;
    v_net_amount BIGINT;
    v_burn_id UUID;
    v_activity_id UUID;
    v_activity_result JSONB;
BEGIN
    -- Calculate burn (25% HARD LAW)
    v_burn_amount := FLOOR(p_gross_amount * c_burn_rate);
    v_net_amount := p_gross_amount - v_burn_amount;
    
    -- Record in arcade burn ledger
    INSERT INTO arcade_burn_ledger (
        user_id, tx_type, gross_amount,
        burn_amount, net_amount, burn_rate, burn_enforced,
        arcade_session_id, game_mode
    ) VALUES (
        p_user_id, p_tx_type, p_gross_amount,
        v_burn_amount, v_net_amount, c_burn_rate, TRUE,
        p_session_id, p_game_mode
    )
    RETURNING id INTO v_burn_id;
    
    -- Record burn to vault
    UPDATE burn_vault
    SET total_burned = total_burned + v_burn_amount,
        last_burn_amount = v_burn_amount,
        last_burn_source = 'ARCADE_ORB_7',
        last_burn_at = NOW(),
        updated_at = NOW()
    WHERE id = 1;
    
    -- Record to activity ledger (net amount only)
    v_activity_result := fn_record_diamond_activity(
        p_user_id,
        7,  -- Orb 7 = Arcade
        p_tx_type,
        v_net_amount,
        p_gross_amount,
        1.00 - c_burn_rate,  -- Effective multiplier after burn
        v_burn_id
    );
    
    v_activity_id := (v_activity_result->>'activity_id')::UUID;
    
    -- Link activity to burn record
    UPDATE arcade_burn_ledger
    SET activity_ledger_id = v_activity_id
    WHERE id = v_burn_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'burn_id', v_burn_id,
        'activity_id', v_activity_id,
        'transaction', jsonb_build_object(
            'type', p_tx_type,
            'gross_amount', p_gross_amount,
            'burn_amount', v_burn_amount,
            'net_amount', v_net_amount,
            'burn_rate', '25%'
        ),
        'enforcement', jsonb_build_object(
            'burn_enforced', TRUE,
            'hard_law', '25_PERCENT_BURN_LAW',
            'orb', 'ARCADE_ROYALE_ORB_7'
        ),
        'formula', format('%s - %s (25%% burn) = %s 💎', p_gross_amount, v_burn_amount, v_net_amount),
        'task', '25_PERCENT_BURN_ENFORCER'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 43: STREAK_MULTIPLIER_SYNC (Arena)
-- ═══════════════════════════════════════════════════════════
-- Apply fire multiplier from DNA (RED silo) to Diamond Arena rewards
-- ═══════════════════════════════════════════════════════════

-- Arena multiplier sync log
CREATE TABLE IF NOT EXISTS arena_multiplier_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Base reward from arena
    base_reward BIGINT NOT NULL,
    
    -- Streak from DNA (RED Silo)
    dna_streak_days INTEGER NOT NULL,
    dna_source VARCHAR(30) NOT NULL,
    
    -- Multiplier applied
    multiplier_tier VARCHAR(20) NOT NULL,
    multiplier_value NUMERIC(4,2) NOT NULL,
    
    -- Final reward
    final_reward BIGINT NOT NULL,
    streak_bonus BIGINT NOT NULL,
    
    -- Arena details
    arena_type VARCHAR(50),
    arena_session_id UUID,
    
    -- Sync
    activity_ledger_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arena_mult_user ON arena_multiplier_log(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_mult_time ON arena_multiplier_log(created_at DESC);

COMMENT ON TABLE arena_multiplier_log IS '🔥 TASK 43: Arena multiplier sync log (DNA streak → reward)';

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_arena_reward_with_streak
-- Applies DNA streak multiplier to Diamond Arena (Orb 3) rewards
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_arena_reward_with_streak(
    p_user_id UUID,
    p_base_reward BIGINT,
    p_arena_type VARCHAR(50) DEFAULT 'GENERAL',
    p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak INTEGER;
    v_streak_source VARCHAR(30);
    v_multiplier NUMERIC;
    v_tier VARCHAR(20);
    v_final_reward BIGINT;
    v_streak_bonus BIGINT;
    v_mult_id UUID;
    v_activity_id UUID;
    v_activity_result JSONB;
BEGIN
    -- Query DNA streak from RED silo (profiles) or YELLOW fallback
    BEGIN
        SELECT current_streak INTO v_streak
        FROM profiles WHERE id = p_user_id;
        v_streak_source := 'RED_SILO_PROFILES';
    EXCEPTION WHEN undefined_table OR undefined_column THEN
        SELECT current_streak INTO v_streak
        FROM wallets WHERE user_id = p_user_id;
        v_streak_source := 'YELLOW_SILO_WALLETS';
    END;
    
    v_streak := COALESCE(v_streak, 0);
    
    -- Calculate multiplier (HARD LAW tiers)
    IF v_streak >= 30 THEN
        v_multiplier := 2.00;
        v_tier := 'LEGENDARY';
    ELSIF v_streak >= 14 THEN
        v_multiplier := 1.75;
        v_tier := 'BLAZING';
    ELSIF v_streak >= 7 THEN
        v_multiplier := 1.50;
        v_tier := 'HOT';
    ELSIF v_streak >= 3 THEN
        v_multiplier := 1.20;
        v_tier := 'WARMING';
    ELSE
        v_multiplier := 1.00;
        v_tier := 'COLD';
    END IF;
    
    -- Calculate final reward
    v_final_reward := FLOOR(p_base_reward * v_multiplier);
    v_streak_bonus := v_final_reward - p_base_reward;
    
    -- Record multiplier application
    INSERT INTO arena_multiplier_log (
        user_id, base_reward,
        dna_streak_days, dna_source,
        multiplier_tier, multiplier_value,
        final_reward, streak_bonus,
        arena_type, arena_session_id
    ) VALUES (
        p_user_id, p_base_reward,
        v_streak, v_streak_source,
        v_tier, v_multiplier,
        v_final_reward, v_streak_bonus,
        p_arena_type, p_session_id
    )
    RETURNING id INTO v_mult_id;
    
    -- Record to activity ledger
    v_activity_result := fn_record_diamond_activity(
        p_user_id,
        3,  -- Orb 3 = Diamond Arena
        'ARENA_REWARD',
        v_final_reward,
        p_base_reward,
        v_multiplier,
        v_mult_id
    );
    
    v_activity_id := (v_activity_result->>'activity_id')::UUID;
    
    -- Link activity
    UPDATE arena_multiplier_log
    SET activity_ledger_id = v_activity_id
    WHERE id = v_mult_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'multiplier_id', v_mult_id,
        'activity_id', v_activity_id,
        'dna', jsonb_build_object(
            'streak_days', v_streak,
            'source', v_streak_source,
            'tier', v_tier
        ),
        'multiplier', jsonb_build_object(
            'value', v_multiplier,
            'emoji', CASE v_tier
                WHEN 'LEGENDARY' THEN '👑🔥'
                WHEN 'BLAZING' THEN '🔥🔥🔥'
                WHEN 'HOT' THEN '🔥🔥'
                WHEN 'WARMING' THEN '🔥'
                ELSE '❄️'
            END
        ),
        'reward', jsonb_build_object(
            'base', p_base_reward,
            'final', v_final_reward,
            'bonus', v_streak_bonus,
            'formula', format('%s × %s = %s 💎', p_base_reward, v_multiplier, v_final_reward)
        ),
        'task', 'STREAK_MULTIPLIER_SYNC'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 ORB SYNC STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW orb_sync_status AS
SELECT 
    -- Task 41: Activity Ledger
    (SELECT COUNT(*) FROM activity_ledger) AS total_activities,
    (SELECT COUNT(*) FROM activity_ledger WHERE synced_to_wallet = TRUE) AS synced_activities,
    (SELECT COALESCE(SUM(diamonds_delta), 0) FROM activity_ledger) AS total_diamonds_delta,
    
    -- Task 42: Arcade Burn
    (SELECT COUNT(*) FROM arcade_burn_ledger) AS arcade_transactions,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM arcade_burn_ledger) AS arcade_burn_total,
    (SELECT COUNT(*) FROM arcade_burn_ledger WHERE burn_enforced = TRUE) AS burn_enforced_count,
    
    -- Task 43: Arena Multiplier
    (SELECT COUNT(*) FROM arena_multiplier_log) AS arena_rewards,
    (SELECT COALESCE(SUM(streak_bonus), 0) FROM arena_multiplier_log) AS total_streak_bonus,
    (SELECT COUNT(*) FROM arena_multiplier_log WHERE multiplier_tier = 'LEGENDARY') AS legendary_multipliers,
    
    -- By Orb
    (SELECT COUNT(*) FROM activity_ledger WHERE orb_id = 3) AS orb_3_activities,
    (SELECT COUNT(*) FROM activity_ledger WHERE orb_id = 7) AS orb_7_activities,
    
    NOW() AS verified_at;

COMMENT ON VIEW orb_sync_status IS '📊 ORB SYNC Status (Tasks 41-43)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON activity_ledger TO authenticated;
GRANT SELECT ON arcade_burn_ledger TO authenticated;
GRANT SELECT ON arena_multiplier_log TO authenticated;
GRANT SELECT ON orb_sync_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_record_diamond_activity TO authenticated;
GRANT EXECUTE ON FUNCTION fn_sync_activity_to_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION fn_arcade_transaction_with_burn TO authenticated;
GRANT EXECUTE ON FUNCTION fn_arena_reward_with_streak TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ SOVEREIGN ORB SYNC COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 41: DIAMOND_TREASURY_SYNC ✅
--   - activity_ledger table
--   - fn_record_diamond_activity
--   - fn_sync_activity_to_wallet
--   - diamonds_delta tracking for Orbs 3 & 7
--
-- TASK 42: 25_PERCENT_BURN_ENFORCER ✅
--   - arcade_burn_ledger table
--   - fn_arcade_transaction_with_burn
--   - 25% HARD LAW enforced on all Arcade (Orb 7) transactions
--
-- TASK 43: STREAK_MULTIPLIER_SYNC ✅
--   - arena_multiplier_log table
--   - fn_arena_reward_with_streak
--   - DNA streak → Diamond Arena reward multiplier
--
-- ═══════════════════════════════════════════════════════════
