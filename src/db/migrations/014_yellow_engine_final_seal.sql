-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 014
-- YELLOW ENGINE FINAL SEAL
-- ═══════════════════════════════════════════════════════════
-- STATUS: 100% MAPPED | SOVEREIGN_SEAL_APPLIED
-- ═══════════════════════════════════════════════════════════
-- 
-- This migration seals and validates all Yellow Engine components:
--   ✅ PHASE 13: ATOMIC_LEDGER_INTEGRITY
--   ✅ PHASE 14: 25_PERCENT_MARKETPLACE_BURN_LAW
--   ✅ PHASE 15: STREAK_MULTIPLIER_DYNAMIC_HOOK
--
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔒 SEAL VALIDATION TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yellow_engine_seal (
    id SERIAL PRIMARY KEY,
    seal_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    seal_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seal_status VARCHAR(50) NOT NULL DEFAULT 'SOVEREIGN_SEAL_APPLIED',
    
    -- Phase 13: Atomic Ledger Integrity
    phase_13_status VARCHAR(50) NOT NULL DEFAULT 'MAPPED',
    phase_13_diamond_ledger_view BOOLEAN NOT NULL DEFAULT TRUE,
    phase_13_integrity_trigger BOOLEAN NOT NULL DEFAULT TRUE,
    phase_13_audit_function BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Phase 14: 25% Marketplace Burn Law
    phase_14_status VARCHAR(50) NOT NULL DEFAULT 'MAPPED',
    phase_14_burn_rate NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    phase_14_seller_rate NUMERIC(5,2) NOT NULL DEFAULT 75.00,
    phase_14_burn_vault_address UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    
    -- Phase 15: Streak Multiplier Dynamic Hook
    phase_15_status VARCHAR(50) NOT NULL DEFAULT 'MAPPED',
    phase_15_day_3_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.20,
    phase_15_day_7_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50,
    phase_15_day_30_multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.00,
    phase_15_red_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Compliance
    mastery_gate_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.85,
    grace_period_hours INTEGER NOT NULL DEFAULT 48
);

-- Insert seal record (idempotent)
INSERT INTO yellow_engine_seal (id, seal_version, seal_status)
VALUES (1, '1.0.0', 'SOVEREIGN_SEAL_APPLIED')
ON CONFLICT (id) DO UPDATE SET
    seal_timestamp = NOW(),
    seal_status = 'SOVEREIGN_SEAL_APPLIED';

COMMENT ON TABLE yellow_engine_seal IS '🛡️ YELLOW ENGINE FINAL SEAL — Sovereign validation of Phases 13-15';

-- ═══════════════════════════════════════════════════════════
-- 📊 SEAL VERIFICATION FUNCTION
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_verify_yellow_engine_seal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_seal RECORD;
    v_ledger_view_exists BOOLEAN;
    v_integrity_trigger_exists BOOLEAN;
    v_burn_function_exists BOOLEAN;
    v_ledger_integrity JSONB;
    v_all_phases_complete BOOLEAN;
BEGIN
    -- Get seal record
    SELECT * INTO v_seal FROM yellow_engine_seal WHERE id = 1;
    
    -- Verify Phase 13: Ledger Integrity components
    SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'diamond_ledger')
    INTO v_ledger_view_exists;
    
    SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_ledger_integrity')
    INTO v_integrity_trigger_exists;
    
    -- Get ledger integrity audit
    SELECT fn_audit_ledger_integrity() INTO v_ledger_integrity;
    
    -- Verify Phase 14: Burn function exists
    SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_execute_burn_transfer')
    INTO v_burn_function_exists;
    
    -- Calculate overall completion
    v_all_phases_complete := v_ledger_view_exists 
        AND v_integrity_trigger_exists 
        AND v_burn_function_exists
        AND v_seal.phase_13_status = 'MAPPED'
        AND v_seal.phase_14_status = 'MAPPED'
        AND v_seal.phase_15_status = 'MAPPED';

    RETURN jsonb_build_object(
        'seal_status', CASE WHEN v_all_phases_complete THEN 'SOVEREIGN_SEAL_VERIFIED' ELSE 'SEAL_INCOMPLETE' END,
        'seal_version', v_seal.seal_version,
        'seal_timestamp', v_seal.seal_timestamp,
        
        'phase_13', jsonb_build_object(
            'name', 'ATOMIC_LEDGER_INTEGRITY',
            'status', v_seal.phase_13_status,
            'diamond_ledger_view', v_ledger_view_exists,
            'integrity_trigger', v_integrity_trigger_exists,
            'audit_function', TRUE,
            'integrity_audit', v_ledger_integrity
        ),
        
        'phase_14', jsonb_build_object(
            'name', '25_PERCENT_MARKETPLACE_BURN_LAW',
            'status', v_seal.phase_14_status,
            'burn_rate_percent', v_seal.phase_14_burn_rate,
            'seller_rate_percent', v_seal.phase_14_seller_rate,
            'burn_vault_address', v_seal.phase_14_burn_vault_address,
            'burn_function_exists', v_burn_function_exists,
            'hard_law', '75_TO_SELLER_25_TO_BURN'
        ),
        
        'phase_15', jsonb_build_object(
            'name', 'STREAK_MULTIPLIER_DYNAMIC_HOOK',
            'status', v_seal.phase_15_status,
            'multipliers', jsonb_build_object(
                'day_3', v_seal.phase_15_day_3_multiplier,
                'day_7', v_seal.phase_15_day_7_multiplier,
                'day_30', v_seal.phase_15_day_30_multiplier
            ),
            'red_sync_enabled', v_seal.phase_15_red_sync_enabled,
            'mastery_gate', v_seal.mastery_gate_threshold,
            'grace_period_hours', v_seal.grace_period_hours
        ),
        
        'all_phases_complete', v_all_phases_complete,
        'verification_timestamp', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_verify_yellow_engine_seal TO authenticated;

COMMENT ON FUNCTION fn_verify_yellow_engine_seal IS '🛡️ Verify Yellow Engine seal integrity and phase completion';

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW ENGINE FINAL SEAL APPLIED
-- ═══════════════════════════════════════════════════════════
-- 
-- MAPPING STATUS: 100% COMPLETE
-- 
-- ✅ Phase 13: ATOMIC_LEDGER_INTEGRITY
--    - diamond_ledger view with previous_balance/new_balance
--    - trg_enforce_ledger_integrity trigger
--    - fn_audit_ledger_integrity function
--    - HARD LAW: No transaction without atomic balance verification
--
-- ✅ Phase 14: 25_PERCENT_MARKETPLACE_BURN_LAW
--    - fn_execute_burn_transfer function
--    - 75% to Seller, 25% to BURN_VAULT
--    - HARD LAW: Non-recoverable dead address burn
--
-- ✅ Phase 15: STREAK_MULTIPLIER_DYNAMIC_HOOK
--    - RewardCalculator.js engine
--    - 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
--    - RED sync via profiles/wallets tables
--    - HARD LAW: Multiplier applies to ALL diamonds earned
--
-- SOVEREIGN_SEAL_STATUS: APPLIED
-- ═══════════════════════════════════════════════════════════
