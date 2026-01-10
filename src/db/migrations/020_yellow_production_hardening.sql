-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 020
-- YELLOW PRODUCTION HARDENING (TASKS 22-24)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 22: 25_PERCENT_BURN_AUDIT_SERVICE
-- TASK 23: ATOMIC_MINT_RECONCILIATION
-- TASK 24: MULTIPLIER_STREAK_GATE
--
-- EMERGENCY_SYSTEM_OVERRIDE: PRODUCTION_CRITICAL
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 22: 25_PERCENT_BURN_AUDIT_SERVICE
-- ═══════════════════════════════════════════════════════════
-- Real-time verification that 25% of fees moved to burn vault
-- If mismatch detected, FREEZE THE LEDGER
-- ═══════════════════════════════════════════════════════════

-- Ledger freeze status table
CREATE TABLE IF NOT EXISTS ledger_freeze_status (
    id SERIAL PRIMARY KEY,
    
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    frozen_at TIMESTAMPTZ,
    frozen_by VARCHAR(50),
    freeze_reason TEXT,
    
    -- Violation details
    violation_type VARCHAR(50),
    expected_burn BIGINT,
    actual_burn BIGINT,
    variance BIGINT,
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50),
    resolution_notes TEXT,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure single row for freeze status
INSERT INTO ledger_freeze_status (id, is_frozen) 
VALUES (1, FALSE) 
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE ledger_freeze_status IS '🔒 TASK 22: Ledger freeze status for burn violations';

-- ═══════════════════════════════════════════════════════════
-- 🔒 burn_integrity_check
-- Real-time 25% burn verification with freeze capability
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION burn_integrity_check(
    p_force_check BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW
    c_tolerance CONSTANT NUMERIC := 0.001; -- 0.1% tolerance for rounding
    
    v_freeze_status RECORD;
    v_marketplace_volume BIGINT;
    v_expected_burn BIGINT;
    v_actual_burn BIGINT;
    v_variance BIGINT;
    v_variance_percent NUMERIC;
    v_is_violation BOOLEAN;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- Check current freeze status
    SELECT * INTO v_freeze_status
    FROM ledger_freeze_status
    WHERE id = 1;
    
    -- If frozen and not forcing, reject
    IF v_freeze_status.is_frozen AND NOT p_force_check THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'LEDGER_FROZEN',
            'frozen_at', v_freeze_status.frozen_at,
            'freeze_reason', v_freeze_status.freeze_reason,
            'message', 'Ledger is frozen due to burn violation. Manual intervention required.'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE BURN INTEGRITY
    -- ═══════════════════════════════════════════════════════
    
    -- Total marketplace volume
    SELECT COALESCE(SUM(original_amount), 0) INTO v_marketplace_volume
    FROM burn_ledger
    WHERE source = 'MARKETPLACE';
    
    -- Expected burn (25%)
    v_expected_burn := FLOOR(v_marketplace_volume * c_burn_rate);
    
    -- Actual burn recorded
    SELECT COALESCE(SUM(burn_amount), 0) INTO v_actual_burn
    FROM burn_ledger
    WHERE source = 'MARKETPLACE';
    
    -- Calculate variance
    v_variance := v_actual_burn - v_expected_burn;
    v_variance_percent := CASE WHEN v_expected_burn > 0 
        THEN ABS(v_variance::NUMERIC / v_expected_burn)
        ELSE 0
    END;
    
    -- Check for violation (outside tolerance)
    v_is_violation := v_variance_percent > c_tolerance AND v_expected_burn > 0;
    
    -- ═══════════════════════════════════════════════════════
    -- FREEZE LEDGER ON VIOLATION
    -- ═══════════════════════════════════════════════════════
    
    IF v_is_violation THEN
        UPDATE ledger_freeze_status
        SET is_frozen = TRUE,
            frozen_at = NOW(),
            frozen_by = 'burn_integrity_check',
            freeze_reason = format('25%% burn mismatch: expected %s, got %s (variance: %s)', 
                v_expected_burn, v_actual_burn, v_variance),
            violation_type = 'BURN_MISMATCH',
            expected_burn = v_expected_burn,
            actual_burn = v_actual_burn,
            variance = v_variance,
            updated_at = NOW()
        WHERE id = 1;
        
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'LEDGER_FROZEN',
            'violation', jsonb_build_object(
                'type', 'BURN_MISMATCH',
                'expected_burn', v_expected_burn,
                'actual_burn', v_actual_burn,
                'variance', v_variance,
                'variance_percent', ROUND(v_variance_percent * 100, 4) || '%'
            ),
            'action_taken', 'LEDGER_FROZEN',
            'message', 'CRITICAL: Burn integrity violation detected. Ledger frozen.',
            'hard_law', '25_PERCENT_BURN_LAW',
            'task', '25_PERCENT_BURN_AUDIT_SERVICE'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- INTEGRITY VERIFIED
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'INTEGRITY_VERIFIED',
        'audit', jsonb_build_object(
            'marketplace_volume', v_marketplace_volume,
            'expected_burn', v_expected_burn,
            'actual_burn', v_actual_burn,
            'variance', v_variance,
            'variance_percent', ROUND(v_variance_percent * 100, 6) || '%',
            'within_tolerance', NOT v_is_violation
        ),
        'ledger', jsonb_build_object(
            'is_frozen', FALSE,
            'status', 'OPERATIONAL'
        ),
        'meta', jsonb_build_object(
            'check_duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'checked_at', NOW(),
            'tolerance', (c_tolerance * 100) || '%'
        ),
        'hard_law', '25_PERCENT_BURN_LAW',
        'task', '25_PERCENT_BURN_AUDIT_SERVICE'
    );
END;
$$;

COMMENT ON FUNCTION burn_integrity_check IS '🔒 TASK 22: 25% Burn Audit with ledger freeze on violation';

-- ═══════════════════════════════════════════════════════════
-- 🔓 unfreeze_ledger (Admin only)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION unfreeze_ledger(
    p_admin_id UUID,
    p_resolution_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE ledger_freeze_status
    SET is_frozen = FALSE,
        resolved_at = NOW(),
        resolved_by = p_admin_id::TEXT,
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
    WHERE id = 1;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'LEDGER_UNFROZEN',
        'resolved_by', p_admin_id,
        'resolved_at', NOW(),
        'notes', p_resolution_notes
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 23: ATOMIC_MINT_RECONCILIATION
-- ═══════════════════════════════════════════════════════════
-- Verify Sum(Transactions) = Sum(UserBalances) + BurnVault
-- Runs every 60 seconds (via cron or application trigger)
-- ═══════════════════════════════════════════════════════════

-- Reconciliation log
CREATE TABLE IF NOT EXISTS reconciliation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reconciliation results
    total_credits BIGINT NOT NULL,
    total_debits BIGINT NOT NULL,
    net_minted BIGINT NOT NULL,  -- credits - debits
    
    sum_user_balances BIGINT NOT NULL,
    burn_vault_balance BIGINT NOT NULL,
    total_allocated BIGINT NOT NULL,  -- users + burn
    
    -- Variance
    variance BIGINT NOT NULL,
    is_reconciled BOOLEAN NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL,  -- BALANCED, VARIANCE_DETECTED, CRITICAL
    
    -- Timing
    reconciliation_duration_ms NUMERIC,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_time ON reconciliation_log(reconciled_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON reconciliation_log(status);

COMMENT ON TABLE reconciliation_log IS '📊 TASK 23: Atomic mint reconciliation history';

-- ═══════════════════════════════════════════════════════════
-- 📊 ledger_audit_loop
-- Core reconciliation function
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_audit_loop()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_credits BIGINT;
    v_total_debits BIGINT;
    v_net_minted BIGINT;
    v_sum_balances BIGINT;
    v_burn_balance BIGINT;
    v_total_allocated BIGINT;
    v_variance BIGINT;
    v_is_reconciled BOOLEAN;
    v_status VARCHAR(20);
    v_log_id UUID;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE TRANSACTION TOTALS
    -- ═══════════════════════════════════════════════════════
    
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0)
    INTO v_total_credits, v_total_debits
    FROM transactions;
    
    v_net_minted := v_total_credits - v_total_debits;
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE ALLOCATION TOTALS
    -- ═══════════════════════════════════════════════════════
    
    -- Sum of all user balances (excluding burn vault)
    SELECT COALESCE(SUM(balance), 0) INTO v_sum_balances
    FROM wallets
    WHERE user_id != '00000000-0000-0000-0000-000000000000';
    
    -- Burn vault balance
    SELECT COALESCE(balance, 0) INTO v_burn_balance
    FROM wallets
    WHERE user_id = '00000000-0000-0000-0000-000000000000';
    
    v_total_allocated := v_sum_balances + v_burn_balance;
    
    -- ═══════════════════════════════════════════════════════
    -- RECONCILIATION LAW:
    -- Net Minted = User Balances + Burn Vault
    -- ═══════════════════════════════════════════════════════
    
    v_variance := v_net_minted - v_total_allocated;
    v_is_reconciled := (v_variance = 0);
    
    -- Determine status
    IF v_variance = 0 THEN
        v_status := 'BALANCED';
    ELSIF ABS(v_variance) <= 10 THEN
        v_status := 'VARIANCE_DETECTED';  -- Minor variance, could be timing
    ELSE
        v_status := 'CRITICAL';  -- Major discrepancy
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- LOG RECONCILIATION
    -- ═══════════════════════════════════════════════════════
    
    INSERT INTO reconciliation_log (
        total_credits, total_debits, net_minted,
        sum_user_balances, burn_vault_balance, total_allocated,
        variance, is_reconciled, status,
        reconciliation_duration_ms
    ) VALUES (
        v_total_credits, v_total_debits, v_net_minted,
        v_sum_balances, v_burn_balance, v_total_allocated,
        v_variance, v_is_reconciled, v_status,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))
    )
    RETURNING id INTO v_log_id;
    
    -- Trigger ledger freeze on critical variance
    IF v_status = 'CRITICAL' THEN
        UPDATE ledger_freeze_status
        SET is_frozen = TRUE,
            frozen_at = NOW(),
            frozen_by = 'ledger_audit_loop',
            freeze_reason = format('Reconciliation failed: net_minted=%s, allocated=%s, variance=%s',
                v_net_minted, v_total_allocated, v_variance),
            violation_type = 'RECONCILIATION_FAILURE',
            variance = v_variance,
            updated_at = NOW()
        WHERE id = 1;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'reconciliation_id', v_log_id,
        'transactions', jsonb_build_object(
            'total_credits', v_total_credits,
            'total_debits', v_total_debits,
            'net_minted', v_net_minted
        ),
        'allocation', jsonb_build_object(
            'user_balances', v_sum_balances,
            'burn_vault', v_burn_balance,
            'total_allocated', v_total_allocated
        ),
        'reconciliation', jsonb_build_object(
            'variance', v_variance,
            'is_balanced', v_is_reconciled,
            'status', v_status,
            'formula', format('net_minted(%s) - allocated(%s) = variance(%s)',
                v_net_minted, v_total_allocated, v_variance)
        ),
        'law', 'Sum(Transactions) = Sum(UserBalances) + BurnVault',
        'meta', jsonb_build_object(
            'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'audited_at', NOW()
        ),
        'task', 'ATOMIC_MINT_RECONCILIATION'
    );
END;
$$;

COMMENT ON FUNCTION ledger_audit_loop IS '📊 TASK 23: Atomic mint reconciliation (run every 60s)';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 24: MULTIPLIER_STREAK_GATE
-- ═══════════════════════════════════════════════════════════
-- 2.0x multipliers must be cross-verified against RED Silo
-- 30-day streak timestamp before execution
-- ═══════════════════════════════════════════════════════════

-- Multiplier verification log
CREATE TABLE IF NOT EXISTS multiplier_verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Request details
    requested_multiplier NUMERIC(4,2) NOT NULL,
    base_reward BIGINT NOT NULL,
    
    -- Verification
    red_silo_streak INTEGER,
    red_silo_last_login TIMESTAMPTZ,
    yellow_silo_streak INTEGER,
    
    -- Streak validation
    streak_verified BOOLEAN NOT NULL,
    streak_source VARCHAR(30),
    days_since_login INTEGER,
    
    -- Result
    approved_multiplier NUMERIC(4,2) NOT NULL,
    final_reward BIGINT NOT NULL,
    was_downgraded BOOLEAN DEFAULT FALSE,
    downgrade_reason TEXT,
    
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multiplier_verify_user ON multiplier_verification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_multiplier_verify_time ON multiplier_verification_log(verified_at DESC);

COMMENT ON TABLE multiplier_verification_log IS '🛡️ TASK 24: Multiplier streak verification log';

-- ═══════════════════════════════════════════════════════════
-- 🛡️ verify_multiplier_streak_gate
-- Cross-verify 2.0x against RED Silo 30-day timestamp
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION verify_multiplier_streak_gate(
    p_user_id UUID,
    p_requested_multiplier NUMERIC,
    p_base_reward BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: 30-day requirement for 2.0x
    c_legendary_multiplier CONSTANT NUMERIC := 2.00;
    c_legendary_days_required CONSTANT INTEGER := 30;
    c_max_login_gap_days CONSTANT INTEGER := 2;  -- Max days between logins
    
    v_red_streak INTEGER;
    v_red_last_login TIMESTAMPTZ;
    v_yellow_streak INTEGER;
    v_days_since_login INTEGER;
    v_streak_source VARCHAR(30);
    v_streak_verified BOOLEAN := FALSE;
    v_approved_multiplier NUMERIC;
    v_final_reward BIGINT;
    v_was_downgraded BOOLEAN := FALSE;
    v_downgrade_reason TEXT;
    v_log_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- QUERY RED SILO (profiles table)
    -- ═══════════════════════════════════════════════════════
    
    BEGIN
        SELECT current_streak, last_login_at
        INTO v_red_streak, v_red_last_login
        FROM profiles
        WHERE id = p_user_id;
        
        IF v_red_streak IS NOT NULL THEN
            v_streak_source := 'RED_SILO_PROFILES';
            v_days_since_login := EXTRACT(DAY FROM (NOW() - v_red_last_login));
        END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
        v_red_streak := NULL;
    END;
    
    -- Fallback: YELLOW Silo
    IF v_red_streak IS NULL THEN
        SELECT current_streak INTO v_yellow_streak
        FROM wallets
        WHERE user_id = p_user_id;
        
        v_red_streak := COALESCE(v_yellow_streak, 0);
        v_streak_source := 'YELLOW_SILO_WALLETS';
        v_days_since_login := NULL;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- VERIFY 2.0x MULTIPLIER REQUIREMENTS
    -- ═══════════════════════════════════════════════════════
    
    IF p_requested_multiplier >= c_legendary_multiplier THEN
        -- Check 30-day streak requirement
        IF v_red_streak >= c_legendary_days_required THEN
            -- Check login recency (if available)
            IF v_days_since_login IS NOT NULL AND v_days_since_login > c_max_login_gap_days THEN
                -- Streak might be stale - downgrade
                v_streak_verified := FALSE;
                v_was_downgraded := TRUE;
                v_downgrade_reason := format('Last login was %s days ago (max %s)',
                    v_days_since_login, c_max_login_gap_days);
                v_approved_multiplier := 1.50;  -- Downgrade to HOT tier
            ELSE
                -- Verified
                v_streak_verified := TRUE;
                v_approved_multiplier := c_legendary_multiplier;
            END IF;
        ELSE
            -- Doesn't meet 30-day requirement
            v_streak_verified := FALSE;
            v_was_downgraded := TRUE;
            v_downgrade_reason := format('Only %s days streak (requires %s)',
                v_red_streak, c_legendary_days_required);
            
            -- Apply appropriate tier
            IF v_red_streak >= 14 THEN
                v_approved_multiplier := 1.75;
            ELSIF v_red_streak >= 7 THEN
                v_approved_multiplier := 1.50;
            ELSIF v_red_streak >= 3 THEN
                v_approved_multiplier := 1.20;
            ELSE
                v_approved_multiplier := 1.00;
            END IF;
        END IF;
    ELSE
        -- Non-legendary multiplier - pass through
        v_streak_verified := TRUE;
        v_approved_multiplier := p_requested_multiplier;
    END IF;
    
    -- Calculate final reward
    v_final_reward := FLOOR(p_base_reward * v_approved_multiplier);
    
    -- ═══════════════════════════════════════════════════════
    -- LOG VERIFICATION
    -- ═══════════════════════════════════════════════════════
    
    INSERT INTO multiplier_verification_log (
        user_id, requested_multiplier, base_reward,
        red_silo_streak, red_silo_last_login, yellow_silo_streak,
        streak_verified, streak_source, days_since_login,
        approved_multiplier, final_reward, was_downgraded, downgrade_reason
    ) VALUES (
        p_user_id, p_requested_multiplier, p_base_reward,
        v_red_streak, v_red_last_login, v_yellow_streak,
        v_streak_verified, v_streak_source, v_days_since_login,
        v_approved_multiplier, v_final_reward, v_was_downgraded, v_downgrade_reason
    )
    RETURNING id INTO v_log_id;
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'verification_id', v_log_id,
        'request', jsonb_build_object(
            'requested_multiplier', p_requested_multiplier,
            'base_reward', p_base_reward
        ),
        'red_silo', jsonb_build_object(
            'streak_days', v_red_streak,
            'last_login', v_red_last_login,
            'days_since_login', v_days_since_login,
            'source', v_streak_source
        ),
        'verification', jsonb_build_object(
            'verified', v_streak_verified,
            'approved_multiplier', v_approved_multiplier,
            'was_downgraded', v_was_downgraded,
            'downgrade_reason', v_downgrade_reason
        ),
        'reward', jsonb_build_object(
            'base', p_base_reward,
            'multiplier', v_approved_multiplier,
            'final', v_final_reward,
            'formula', format('%s × %s = %s 💎', p_base_reward, v_approved_multiplier, v_final_reward)
        ),
        'hard_law', '2.0x requires 30-day RED Silo verification',
        'task', 'MULTIPLIER_STREAK_GATE'
    );
END;
$$;

COMMENT ON FUNCTION verify_multiplier_streak_gate IS '🛡️ TASK 24: Cross-verify 2.0x against RED Silo 30-day timestamp';

-- ═══════════════════════════════════════════════════════════
-- 📊 PRODUCTION HARDENING STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_production_hardening_status AS
SELECT 
    -- Task 22: Burn Audit
    (SELECT is_frozen FROM ledger_freeze_status WHERE id = 1) AS ledger_frozen,
    (SELECT frozen_at FROM ledger_freeze_status WHERE id = 1) AS frozen_since,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'burn_integrity_check')) AS burn_audit_active,
    
    -- Task 23: Reconciliation
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'ledger_audit_loop')) AS reconciliation_active,
    (SELECT COUNT(*) FROM reconciliation_log) AS reconciliation_count,
    (SELECT status FROM reconciliation_log ORDER BY reconciled_at DESC LIMIT 1) AS last_reconciliation_status,
    
    -- Task 24: Multiplier Gate
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'verify_multiplier_streak_gate')) AS multiplier_gate_active,
    (SELECT COUNT(*) FROM multiplier_verification_log) AS verification_count,
    (SELECT COUNT(*) FROM multiplier_verification_log WHERE was_downgraded = TRUE) AS downgrades_count,
    
    NOW() AS verified_at;

COMMENT ON VIEW yellow_production_hardening_status IS '📊 YELLOW PRODUCTION HARDENING Status (Tasks 22-24)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON ledger_freeze_status TO authenticated;
GRANT SELECT ON reconciliation_log TO authenticated;
GRANT SELECT ON multiplier_verification_log TO authenticated;
GRANT SELECT ON yellow_production_hardening_status TO authenticated;

GRANT EXECUTE ON FUNCTION burn_integrity_check TO authenticated;
GRANT EXECUTE ON FUNCTION ledger_audit_loop TO authenticated;
GRANT EXECUTE ON FUNCTION verify_multiplier_streak_gate TO authenticated;

-- Note: unfreeze_ledger should be service_role only (admin)
-- GRANT EXECUTE ON FUNCTION unfreeze_ledger TO service_role;

-- ═══════════════════════════════════════════════════════════
-- ⏰ OPTIONAL: pg_cron for automated reconciliation
-- Run ledger_audit_loop every 60 seconds
-- ═══════════════════════════════════════════════════════════

-- Enable pg_cron if not already
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule reconciliation (uncomment when pg_cron available)
-- SELECT cron.schedule('ledger-reconciliation', '* * * * *', 'SELECT ledger_audit_loop()');

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW PRODUCTION HARDENING COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 22: 25_PERCENT_BURN_AUDIT_SERVICE ✅
--   - burn_integrity_check function
--   - Real-time verification of 25% burn
--   - Automatic ledger freeze on violation
--
-- TASK 23: ATOMIC_MINT_RECONCILIATION ✅
--   - ledger_audit_loop function
--   - Verifies: Sum(Tx) = Sum(Balances) + BurnVault
--   - reconciliation_log for history
--
-- TASK 24: MULTIPLIER_STREAK_GATE ✅
--   - verify_multiplier_streak_gate function
--   - 2.0x requires RED Silo 30-day verification
--   - Automatic downgrade on failure
--
-- ═══════════════════════════════════════════════════════════
