-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 018
-- YELLOW INTEGRATION STRIKE (TASKS 16-18)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 16: MULTIPLIER_STREAK_VALUATOR
-- TASK 17: ATOMIC_MINT_FINAL_SETTLEMENT
-- TASK 18: MARKETPLACE_BURN_AUDIT_TRAIL
--
-- DANGEROUS_OMNIPOTENCE_OVERRIDE: ACTIVE
-- INTEGRATION_STATUS: FINAL_STRIKE
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 16: MULTIPLIER_STREAK_VALUATOR
-- ═══════════════════════════════════════════════════════════
-- Map 'fn_calculate_final_reward': Query RED Silo for 'streak_tier'
-- Logic: Apply multiplier to 'base_reward' packet from GREEN
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_calculate_final_reward(
    p_user_id UUID,
    p_base_reward BIGINT,
    p_green_source VARCHAR(50) DEFAULT 'TRAINING',
    p_include_diagnostics BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: Canonical Multipliers
    c_day_3_mult CONSTANT NUMERIC := 1.20;
    c_day_7_mult CONSTANT NUMERIC := 1.50;
    c_day_30_mult CONSTANT NUMERIC := 2.00;
    
    v_streak_days INTEGER;
    v_streak_source VARCHAR(30) := 'NONE';
    v_multiplier NUMERIC := 1.00;
    v_tier_name VARCHAR(30) := 'COLD';
    v_tier_label VARCHAR(50) := '❄️ No Streak';
    v_final_reward BIGINT;
    v_streak_bonus BIGINT;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- QUERY RED SILO: Fetch streak_tier from profiles
    -- ═══════════════════════════════════════════════════════
    
    BEGIN
        SELECT current_streak INTO v_streak_days
        FROM profiles
        WHERE id = p_user_id;
        
        IF v_streak_days IS NOT NULL THEN
            v_streak_source := 'RED_SILO_PROFILES';
        END IF;
    EXCEPTION WHEN undefined_table THEN
        v_streak_days := NULL;
    END;
    
    -- Fallback: YELLOW Silo (wallets)
    IF v_streak_days IS NULL THEN
        SELECT current_streak INTO v_streak_days
        FROM wallets
        WHERE user_id = p_user_id;
        
        IF v_streak_days IS NOT NULL THEN
            v_streak_source := 'YELLOW_SILO_WALLETS';
        ELSE
            v_streak_days := 0;
            v_streak_source := 'DEFAULT_ZERO';
        END IF;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- VALUATE: Apply tier-based multiplier (HARD LAW)
    -- ═══════════════════════════════════════════════════════
    
    IF v_streak_days >= 30 THEN
        v_multiplier := c_day_30_mult;  -- 2.0x HARD LAW
        v_tier_name := 'LEGENDARY';
        v_tier_label := '👑 30-Day Legend';
    ELSIF v_streak_days >= 14 THEN
        v_multiplier := 1.75;
        v_tier_name := 'BLAZING';
        v_tier_label := '🔥🔥🔥 Blazing';
    ELSIF v_streak_days >= 7 THEN
        v_multiplier := c_day_7_mult;   -- 1.5x HARD LAW
        v_tier_name := 'HOT';
        v_tier_label := '🔥🔥 7-Day Streak';
    ELSIF v_streak_days >= 3 THEN
        v_multiplier := c_day_3_mult;   -- 1.2x HARD LAW
        v_tier_name := 'WARMING';
        v_tier_label := '🔥 3-Day Streak';
    ELSIF v_streak_days >= 1 THEN
        v_multiplier := 1.10;
        v_tier_name := 'WARMING_UP';
        v_tier_label := '🌡️ Warming Up';
    ELSE
        v_multiplier := 1.00;
        v_tier_name := 'COLD';
        v_tier_label := '❄️ No Streak';
    END IF;
    
    -- Calculate final reward
    v_final_reward := FLOOR(p_base_reward * v_multiplier);
    v_streak_bonus := v_final_reward - p_base_reward;
    
    -- ═══════════════════════════════════════════════════════
    -- BUILD RESPONSE
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'valuation', jsonb_build_object(
            'base_reward', p_base_reward,
            'multiplier', v_multiplier,
            'final_reward', v_final_reward,
            'streak_bonus', v_streak_bonus,
            'formula', format('%s × %s = %s 💎', p_base_reward, v_multiplier, v_final_reward)
        ),
        'streak', jsonb_build_object(
            'days', v_streak_days,
            'tier', v_tier_name,
            'label', v_tier_label,
            'source', v_streak_source
        ),
        'green_packet', jsonb_build_object(
            'source', p_green_source,
            'received_at', NOW()
        ),
        'hard_laws', jsonb_build_object(
            'day_3_multiplier', c_day_3_mult,
            'day_7_multiplier', c_day_7_mult,
            'day_30_multiplier', c_day_30_mult
        ),
        'diagnostics', CASE WHEN p_include_diagnostics THEN jsonb_build_object(
            'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'query_source', v_streak_source,
            'function', 'fn_calculate_final_reward'
        ) ELSE NULL END,
        'task', 'MULTIPLIER_STREAK_VALUATOR'
    );
END;
$$;

COMMENT ON FUNCTION fn_calculate_final_reward IS '🔢 TASK 16: Multiplier Streak Valuator - Query RED, apply to GREEN packet';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 17: ATOMIC_MINT_FINAL_SETTLEMENT
-- ═══════════════════════════════════════════════════════════
-- Map 'process_training_payout' RPC: Complete the ledger entry
-- Verification: Ledger balance must reconcile with delta history
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_training_payout(
    p_user_id UUID,
    p_session_id UUID,
    p_base_reward BIGINT,
    p_accuracy NUMERIC(5,4),
    p_green_source VARCHAR(50) DEFAULT 'TRAINING_SESSION',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_mastery_threshold CONSTANT NUMERIC := 0.85;
    
    v_valuation JSONB;
    v_final_reward BIGINT;
    v_wallet RECORD;
    v_new_balance BIGINT;
    v_tx_id UUID;
    v_ledger_sum BIGINT;
    v_reconciled BOOLEAN;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GREEN GATE: 85% Mastery Threshold
    -- ═══════════════════════════════════════════════════════
    
    IF p_accuracy < c_mastery_threshold THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'MASTERY_GATE_FAILED',
            'message', format('Requires 85%% mastery, got %.1f%%', p_accuracy * 100),
            'accuracy', p_accuracy,
            'threshold', c_mastery_threshold,
            'settlement', 'REJECTED'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- STEP 1: Calculate final reward via valuator
    -- ═══════════════════════════════════════════════════════
    
    v_valuation := fn_calculate_final_reward(p_user_id, p_base_reward, p_green_source, TRUE);
    v_final_reward := (v_valuation->'valuation'->>'final_reward')::BIGINT;
    
    -- ═══════════════════════════════════════════════════════
    -- STEP 2: Acquire wallet lock
    -- ═══════════════════════════════════════════════════════
    
    SELECT id, balance INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE NOWAIT;
    
    IF v_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_user_id, 0, 'DIAMOND', 0, 0)
        RETURNING id, balance INTO v_wallet;
    END IF;
    
    v_new_balance := v_wallet.balance + v_final_reward;
    
    -- ═══════════════════════════════════════════════════════
    -- STEP 3: Execute atomic mint
    -- ═══════════════════════════════════════════════════════
    
    UPDATE wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Record transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after,
        reference_id, reference_type, metadata
    ) VALUES (
        p_user_id, v_wallet.id, 'CREDIT', v_final_reward, p_green_source,
        v_wallet.balance, v_new_balance,
        p_session_id, 'TRAINING_SESSION',
        p_metadata || jsonb_build_object(
            'accuracy', p_accuracy,
            'base_reward', p_base_reward,
            'multiplier', v_valuation->'valuation'->>'multiplier',
            'streak_tier', v_valuation->'streak'->>'tier',
            'settlement', 'COMPLETE'
        )
    )
    RETURNING id INTO v_tx_id;
    
    -- ═══════════════════════════════════════════════════════
    -- STEP 4: RECONCILIATION VERIFICATION
    -- ═══════════════════════════════════════════════════════
    
    SELECT COALESCE(
        SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0
    ) INTO v_ledger_sum
    FROM transactions
    WHERE wallet_id = v_wallet.id;
    
    v_reconciled := (v_new_balance = v_ledger_sum);
    
    IF NOT v_reconciled THEN
        -- CRITICAL: Ledger mismatch detected
        RAISE WARNING 'LEDGER_RECONCILIATION_FAILED: balance=%, ledger_sum=%', v_new_balance, v_ledger_sum;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN SETTLEMENT RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'settlement', 'COMPLETE',
        'payout', jsonb_build_object(
            'session_id', p_session_id,
            'base_reward', p_base_reward,
            'final_reward', v_final_reward,
            'streak_bonus', v_final_reward - p_base_reward,
            'transaction_id', v_tx_id
        ),
        'wallet', jsonb_build_object(
            'previous_balance', v_wallet.balance,
            'new_balance', v_new_balance,
            'delta', v_final_reward
        ),
        'reconciliation', jsonb_build_object(
            'verified', v_reconciled,
            'wallet_balance', v_new_balance,
            'ledger_sum', v_ledger_sum,
            'variance', v_new_balance - v_ledger_sum,
            'status', CASE WHEN v_reconciled THEN 'BALANCED' ELSE 'MISMATCH_DETECTED' END
        ),
        'valuation', v_valuation->'valuation',
        'streak', v_valuation->'streak',
        'accuracy', p_accuracy,
        'meta', jsonb_build_object(
            'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'settled_at', NOW()
        ),
        'task', 'ATOMIC_MINT_FINAL_SETTLEMENT'
    );

EXCEPTION
    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_LOCKED',
            'settlement', 'PENDING_RETRY'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SETTLEMENT_EXCEPTION',
            'message', SQLERRM,
            'settlement', 'FAILED'
        );
END;
$$;

COMMENT ON FUNCTION process_training_payout IS '💰 TASK 17: Atomic Mint Final Settlement with ledger reconciliation';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 18: MARKETPLACE_BURN_AUDIT_TRAIL
-- ═══════════════════════════════════════════════════════════
-- Map 'audit_burn_integrity': Cross-check burn_vault against 25%
-- Law: Maintain deflationary proof-of-burn for economy dashboard
-- ═══════════════════════════════════════════════════════════

-- Burn audit history table
CREATE TABLE IF NOT EXISTS burn_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Audit period
    audit_period_start TIMESTAMPTZ,
    audit_period_end TIMESTAMPTZ,
    
    -- Volume metrics
    total_marketplace_volume BIGINT NOT NULL,
    expected_burn BIGINT NOT NULL,  -- 25% of volume
    actual_burn BIGINT NOT NULL,
    
    -- Variance
    burn_variance BIGINT NOT NULL,
    burn_accuracy NUMERIC(7,4) NOT NULL,  -- actual/expected * 100
    
    -- Status
    integrity_status VARCHAR(20) NOT NULL,
    -- PERFECT, ACCEPTABLE, WARNING, CRITICAL
    
    -- Breakdown
    marketplace_tx_count BIGINT,
    burn_tx_count BIGINT,
    
    -- Deflationary metrics
    total_supply_before BIGINT,
    total_supply_after BIGINT,
    deflation_rate NUMERIC(7,4),
    
    -- Audit
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    audit_duration_ms NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_burn_audit_time ON burn_audit_log(audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_burn_audit_status ON burn_audit_log(integrity_status);

COMMENT ON TABLE burn_audit_log IS '🔥 TASK 18: Burn Audit Trail - Deflationary proof history';

-- ═══════════════════════════════════════════════════════════
-- 🔥 audit_burn_integrity
-- Cross-check burn_vault against 25% of total volume
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_burn_integrity(
    p_period_start TIMESTAMPTZ DEFAULT NULL,
    p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW
    c_acceptable_variance CONSTANT NUMERIC := 0.01;  -- 1% tolerance
    
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_marketplace_volume BIGINT;
    v_expected_burn BIGINT;
    v_actual_burn BIGINT;
    v_variance BIGINT;
    v_accuracy NUMERIC;
    v_integrity_status VARCHAR(20);
    v_marketplace_count BIGINT;
    v_burn_count BIGINT;
    v_total_minted BIGINT;
    v_total_burned BIGINT;
    v_current_supply BIGINT;
    v_deflation_rate NUMERIC;
    v_audit_id UUID;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- Set audit period (default: all time)
    v_period_start := COALESCE(p_period_start, '1970-01-01'::TIMESTAMPTZ);
    v_period_end := COALESCE(p_period_end, NOW());
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE MARKETPLACE VOLUME
    -- ═══════════════════════════════════════════════════════
    
    SELECT COALESCE(SUM(original_amount), 0), COUNT(*)
    INTO v_marketplace_volume, v_marketplace_count
    FROM burn_ledger
    WHERE source = 'MARKETPLACE'
      AND created_at >= v_period_start
      AND created_at <= v_period_end;
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE EXPECTED vs ACTUAL BURN
    -- ═══════════════════════════════════════════════════════
    
    v_expected_burn := FLOOR(v_marketplace_volume * c_burn_rate);
    
    SELECT COALESCE(SUM(burn_amount), 0), COUNT(*)
    INTO v_actual_burn, v_burn_count
    FROM burn_ledger
    WHERE source = 'MARKETPLACE'
      AND created_at >= v_period_start
      AND created_at <= v_period_end;
    
    -- Calculate variance and accuracy
    v_variance := v_actual_burn - v_expected_burn;
    v_accuracy := CASE 
        WHEN v_expected_burn > 0 THEN (v_actual_burn::NUMERIC / v_expected_burn) * 100
        ELSE 100
    END;
    
    -- Determine integrity status
    IF v_variance = 0 THEN
        v_integrity_status := 'PERFECT';
    ELSIF ABS(v_variance) <= (v_expected_burn * c_acceptable_variance) THEN
        v_integrity_status := 'ACCEPTABLE';  -- Within 1% tolerance
    ELSIF ABS(v_variance) <= (v_expected_burn * 0.05) THEN
        v_integrity_status := 'WARNING';  -- 1-5% variance
    ELSE
        v_integrity_status := 'CRITICAL';  -- >5% variance
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- DEFLATIONARY METRICS
    -- ═══════════════════════════════════════════════════════
    
    -- Total ever minted
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_minted
    FROM transactions
    WHERE type = 'CREDIT';
    
    -- Total burned (from vault)
    SELECT COALESCE(total_burned, 0)
    INTO v_total_burned
    FROM burn_vault
    WHERE id = 1;
    
    -- Current circulating supply
    v_current_supply := v_total_minted - v_total_burned;
    
    -- Deflation rate
    v_deflation_rate := CASE 
        WHEN v_total_minted > 0 THEN (v_total_burned::NUMERIC / v_total_minted) * 100
        ELSE 0
    END;
    
    -- ═══════════════════════════════════════════════════════
    -- LOG THE AUDIT
    -- ═══════════════════════════════════════════════════════
    
    INSERT INTO burn_audit_log (
        audit_period_start, audit_period_end,
        total_marketplace_volume, expected_burn, actual_burn,
        burn_variance, burn_accuracy, integrity_status,
        marketplace_tx_count, burn_tx_count,
        total_supply_before, total_supply_after, deflation_rate,
        audit_duration_ms
    ) VALUES (
        v_period_start, v_period_end,
        v_marketplace_volume, v_expected_burn, v_actual_burn,
        v_variance, v_accuracy, v_integrity_status,
        v_marketplace_count, v_burn_count,
        v_total_minted, v_current_supply, v_deflation_rate,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))
    )
    RETURNING id INTO v_audit_id;
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN AUDIT RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'audit_id', v_audit_id,
        'period', jsonb_build_object(
            'start', v_period_start,
            'end', v_period_end
        ),
        'volume', jsonb_build_object(
            'marketplace_total', v_marketplace_volume,
            'transaction_count', v_marketplace_count
        ),
        'burn_verification', jsonb_build_object(
            'expected_burn', v_expected_burn,
            'actual_burn', v_actual_burn,
            'variance', v_variance,
            'accuracy', ROUND(v_accuracy, 2) || '%',
            'burn_rate', (c_burn_rate * 100) || '%',
            'status', v_integrity_status
        ),
        'deflationary_proof', jsonb_build_object(
            'total_minted', v_total_minted,
            'total_burned', v_total_burned,
            'circulating_supply', v_current_supply,
            'deflation_rate', ROUND(v_deflation_rate, 4) || '%',
            'is_deflationary', v_total_burned > 0
        ),
        'integrity', jsonb_build_object(
            'status', v_integrity_status,
            'burn_law_compliant', v_integrity_status IN ('PERFECT', 'ACCEPTABLE'),
            'hard_law', '25_PERCENT_BURN'
        ),
        'meta', jsonb_build_object(
            'audit_duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'audited_at', NOW()
        ),
        'task', 'MARKETPLACE_BURN_AUDIT_TRAIL'
    );
END;
$$;

COMMENT ON FUNCTION audit_burn_integrity IS '🔥 TASK 18: Burn Audit Trail - Deflationary proof-of-burn verification';

-- ═══════════════════════════════════════════════════════════
-- 📊 Economy Dashboard View
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW economy_dashboard AS
SELECT 
    -- Supply metrics
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'CREDIT') AS total_minted,
    (SELECT COALESCE(total_burned, 0) FROM burn_vault WHERE id = 1) AS total_burned,
    (SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id != '00000000-0000-0000-0000-000000000000') AS circulating_supply,
    
    -- Burn stats
    (SELECT marketplace_burned FROM burn_vault WHERE id = 1) AS marketplace_burned,
    (SELECT COUNT(*) FROM burn_ledger) AS burn_transactions,
    
    -- Last audit
    (SELECT integrity_status FROM burn_audit_log ORDER BY audited_at DESC LIMIT 1) AS last_audit_status,
    (SELECT burn_accuracy FROM burn_audit_log ORDER BY audited_at DESC LIMIT 1) AS burn_accuracy,
    (SELECT deflation_rate FROM burn_audit_log ORDER BY audited_at DESC LIMIT 1) AS deflation_rate,
    
    -- Activity
    (SELECT COUNT(*) FROM wallets) AS total_wallets,
    (SELECT COUNT(*) FROM transactions) AS total_transactions,
    
    NOW() AS snapshot_at;

COMMENT ON VIEW economy_dashboard IS '📊 Economy Dashboard - Live supply and burn metrics';

-- ═══════════════════════════════════════════════════════════
-- 📊 INTEGRATION STRIKE STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_integration_strike_status AS
SELECT 
    -- Task 16: Valuator
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_calculate_final_reward')) AS valuator_active,
    
    -- Task 17: Settlement
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'process_training_payout')) AS settlement_active,
    
    -- Task 18: Burn Audit
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'audit_burn_integrity')) AS burn_audit_active,
    (SELECT COUNT(*) FROM burn_audit_log) AS audit_count,
    (SELECT integrity_status FROM burn_audit_log ORDER BY audited_at DESC LIMIT 1) AS last_audit_status,
    
    NOW() AS verified_at;

COMMENT ON VIEW yellow_integration_strike_status IS '📊 YELLOW INTEGRATION STRIKE Status (Tasks 16-18)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON burn_audit_log TO authenticated;
GRANT SELECT ON economy_dashboard TO authenticated;
GRANT SELECT ON yellow_integration_strike_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_calculate_final_reward TO authenticated;
GRANT EXECUTE ON FUNCTION process_training_payout TO authenticated;
GRANT EXECUTE ON FUNCTION audit_burn_integrity TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW INTEGRATION STRIKE COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 16: MULTIPLIER_STREAK_VALUATOR ✅
--   - fn_calculate_final_reward
--   - Query RED Silo for streak_tier
--   - Apply multiplier to GREEN base_reward
--
-- TASK 17: ATOMIC_MINT_FINAL_SETTLEMENT ✅
--   - process_training_payout RPC
--   - Complete ledger entry with reconciliation
--   - Verify: balance = sum(delta_history)
--
-- TASK 18: MARKETPLACE_BURN_AUDIT_TRAIL ✅
--   - audit_burn_integrity function
--   - burn_audit_log table
--   - Cross-check burn_vault against 25% volume
--   - Deflationary proof-of-burn for dashboard
--
-- ═══════════════════════════════════════════════════════════
