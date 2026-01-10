-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 000
-- YELLOW FOUNDATION (TASKS 1-3)
-- ═══════════════════════════════════════════════════════════
-- This is the canonical foundation layer for the Yellow Engine.
-- Run FIRST before all other migrations.
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 01: ATOMIC_DIAMOND_LEDGER
-- TASK 02: THE_25_PERCENT_BURN_VAULT
-- TASK 03: MULTIPLIER_STREAK_LOOKUP
--
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 01: ATOMIC_DIAMOND_LEDGER
-- ═══════════════════════════════════════════════════════════
-- Structure: (ID, User_ID, Delta, Balance_After)
-- Law: All transactions atomic and immutable. No updates to deltas.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS diamond_ledger_entries (
    -- Core Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Delta (positive = credit, negative = debit)
    -- HARD LAW: IMMUTABLE - Cannot be updated once written
    delta BIGINT NOT NULL,
    
    -- Running balance after this transaction
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    
    -- Source tracking
    source VARCHAR(50) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(30),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp (immutable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HARD LAW: Prevent ANY updates or deletes on ledger entries
-- This enforces complete immutability

CREATE OR REPLACE FUNCTION fn_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'LEDGER_IMMUTABILITY_VIOLATION: Cannot UPDATE diamond_ledger_entries. All deltas are final.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'LEDGER_IMMUTABILITY_VIOLATION: Cannot DELETE from diamond_ledger_entries. All entries are permanent.';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON diamond_ledger_entries;
CREATE TRIGGER trg_prevent_ledger_update
    BEFORE UPDATE OR DELETE ON diamond_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_ledger_mutation();

COMMENT ON TABLE diamond_ledger_entries IS '💎 TASK 01: Atomic Diamond Ledger - Immutable delta records';
COMMENT ON TRIGGER trg_prevent_ledger_update ON diamond_ledger_entries IS '🔒 HARD LAW: No updates to deltas';

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON diamond_ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON diamond_ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON diamond_ledger_entries(source);

-- ═══════════════════════════════════════════════════════════
-- 🔥 TASK 02: THE 25_PERCENT_BURN_VAULT
-- ═══════════════════════════════════════════════════════════
-- Tables: burn_ledger, burn_vault
-- Hard Law: Protocol-level diversion of 25% of all marketplace fees
-- ═══════════════════════════════════════════════════════════

-- BURN_VAULT: The dead address accumulator
CREATE TABLE IF NOT EXISTS burn_vault (
    id SERIAL PRIMARY KEY,
    
    -- Total diamonds burned (ever)
    total_burned BIGINT NOT NULL DEFAULT 0,
    
    -- Breakdown by source
    marketplace_burned BIGINT NOT NULL DEFAULT 0,
    arcade_burned BIGINT NOT NULL DEFAULT 0,
    other_burned BIGINT NOT NULL DEFAULT 0,
    
    -- Tracking
    last_burn_at TIMESTAMPTZ,
    last_burn_amount BIGINT,
    last_burn_source VARCHAR(50),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize single-row vault (singleton pattern)
INSERT INTO burn_vault (id, total_burned, marketplace_burned, arcade_burned, other_burned)
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE burn_vault IS '🔥 TASK 02: The Burn Vault - Accumulator for destroyed diamonds';

-- BURN_LEDGER: Immutable record of every burn
CREATE TABLE IF NOT EXISTS burn_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who paid (buyer in marketplace)
    payer_id UUID NOT NULL,
    
    -- Transaction context
    transaction_id UUID NOT NULL,
    
    -- Burn details
    original_amount BIGINT NOT NULL,
    burn_amount BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,  -- What seller receives
    
    -- Hard Law enforcement
    burn_percentage NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    
    -- Source
    source VARCHAR(50) NOT NULL DEFAULT 'MARKETPLACE',
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: burn_amount = floor(original_amount * burn_percentage / 100)
    CONSTRAINT valid_burn_calculation CHECK (
        burn_amount >= FLOOR(original_amount * burn_percentage / 100) - 1 AND
        burn_amount <= FLOOR(original_amount * burn_percentage / 100) + 1
    ),
    
    -- Constraint: net_amount + burn_amount = original_amount
    CONSTRAINT valid_split CHECK (
        net_amount + burn_amount = original_amount
    )
);

-- HARD LAW: Prevent changes to burn records
DROP TRIGGER IF EXISTS trg_prevent_burn_mutation ON burn_ledger;
CREATE TRIGGER trg_prevent_burn_mutation
    BEFORE UPDATE OR DELETE ON burn_ledger
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_ledger_mutation();

COMMENT ON TABLE burn_ledger IS '🔥 TASK 02: Burn Ledger - Immutable record of 25% burns';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_burn_ledger_payer ON burn_ledger(payer_id);
CREATE INDEX IF NOT EXISTS idx_burn_ledger_created ON burn_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_burn_ledger_tx ON burn_ledger(transaction_id);

-- ═══════════════════════════════════════════════════════════
-- 🔥 TASK 03: MULTIPLIER_STREAK_LOOKUP
-- ═══════════════════════════════════════════════════════════
-- Map 'streak_config': 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
-- Logic: Multipliers apply to all training-earned Diamonds
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_config (
    id SERIAL PRIMARY KEY,
    
    -- Streak day threshold
    min_days INTEGER NOT NULL UNIQUE,
    max_days INTEGER,  -- NULL = infinity
    
    -- Multiplier (HARD LAW values)
    multiplier NUMERIC(4,2) NOT NULL,
    
    -- Display info
    tier_name VARCHAR(30) NOT NULL,
    tier_label VARCHAR(50) NOT NULL,
    tier_icon VARCHAR(10) NOT NULL,
    
    -- Applies to
    applies_to VARCHAR(50) NOT NULL DEFAULT 'TRAINING',  -- TRAINING, ARCADE, ALL
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear and insert canonical streak config (HARD LAW)
TRUNCATE streak_config RESTART IDENTITY;

INSERT INTO streak_config (min_days, max_days, multiplier, tier_name, tier_label, tier_icon, applies_to) VALUES
    (0,  2,   1.00, 'COLD',      '❄️ No Streak',      '❄️',    'TRAINING'),
    (3,  6,   1.20, 'WARMING',   '🔥 3-Day Streak',   '🔥',    'TRAINING'),  -- HARD LAW: 1.2x
    (7,  13,  1.50, 'HOT',       '🔥🔥 7-Day Streak', '🔥🔥',  'TRAINING'),  -- HARD LAW: 1.5x
    (14, 29,  1.75, 'BLAZING',   '🔥🔥🔥 Blazing',    '🔥🔥🔥','TRAINING'),
    (30, NULL,2.00, 'LEGENDARY', '👑 30-Day Legend',  '👑',    'TRAINING');  -- HARD LAW: 2.0x

COMMENT ON TABLE streak_config IS '🔥 TASK 03: Streak Config - Multiplier lookup (3-Day 1.2x, 7-Day 1.5x, 30-Day 2.0x)';

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_get_streak_multiplier
-- Returns multiplier based on streak days
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_multiplier(p_streak_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config RECORD;
    v_next_config RECORD;
BEGIN
    -- Get current tier
    SELECT * INTO v_config
    FROM streak_config
    WHERE p_streak_days >= min_days 
      AND (max_days IS NULL OR p_streak_days <= max_days)
    ORDER BY min_days DESC
    LIMIT 1;

    -- Get next tier
    SELECT * INTO v_next_config
    FROM streak_config
    WHERE min_days > p_streak_days
    ORDER BY min_days ASC
    LIMIT 1;

    IF v_config IS NULL THEN
        RETURN jsonb_build_object(
            'multiplier', 1.00,
            'tier_name', 'COLD',
            'tier_label', '❄️ No Streak',
            'tier_icon', '❄️',
            'streak_days', p_streak_days,
            'next_tier', v_next_config.tier_name,
            'days_to_next', v_next_config.min_days - p_streak_days
        );
    END IF;

    RETURN jsonb_build_object(
        'multiplier', v_config.multiplier,
        'tier_name', v_config.tier_name,
        'tier_label', v_config.tier_label,
        'tier_icon', v_config.tier_icon,
        'streak_days', p_streak_days,
        'min_days', v_config.min_days,
        'max_days', v_config.max_days,
        'applies_to', v_config.applies_to,
        'next_tier', v_next_config.tier_name,
        'next_multiplier', v_next_config.multiplier,
        'days_to_next', CASE 
            WHEN v_next_config.min_days IS NOT NULL 
            THEN v_next_config.min_days - p_streak_days 
            ELSE 0 
        END
    );
END;
$$;

COMMENT ON FUNCTION fn_get_streak_multiplier IS '🔥 TASK 03: Get streak multiplier from config';

-- ═══════════════════════════════════════════════════════════
-- 💼 fn_record_burn (Atomic Burn Recording)
-- Records a 25% burn in both burn_ledger and burn_vault
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_record_burn(
    p_payer_id UUID,
    p_transaction_id UUID,
    p_original_amount BIGINT,
    p_source VARCHAR(50) DEFAULT 'MARKETPLACE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_percentage CONSTANT NUMERIC := 25.00;
    v_burn_amount BIGINT;
    v_net_amount BIGINT;
    v_burn_id UUID;
BEGIN
    -- Calculate 25% burn
    v_burn_amount := FLOOR(p_original_amount * c_burn_percentage / 100);
    v_net_amount := p_original_amount - v_burn_amount;

    -- Minimum 1 diamond burn for transactions >= 4
    IF v_burn_amount < 1 AND p_original_amount >= 4 THEN
        v_burn_amount := 1;
        v_net_amount := p_original_amount - 1;
    END IF;

    -- Record in burn_ledger
    INSERT INTO burn_ledger (payer_id, transaction_id, original_amount, burn_amount, net_amount, burn_percentage, source)
    VALUES (p_payer_id, p_transaction_id, p_original_amount, v_burn_amount, v_net_amount, c_burn_percentage, p_source)
    RETURNING id INTO v_burn_id;

    -- Update burn_vault
    UPDATE burn_vault
    SET total_burned = total_burned + v_burn_amount,
        marketplace_burned = CASE WHEN p_source = 'MARKETPLACE' THEN marketplace_burned + v_burn_amount ELSE marketplace_burned END,
        arcade_burned = CASE WHEN p_source = 'ARCADE' THEN arcade_burned + v_burn_amount ELSE arcade_burned END,
        other_burned = CASE WHEN p_source NOT IN ('MARKETPLACE', 'ARCADE') THEN other_burned + v_burn_amount ELSE other_burned END,
        last_burn_at = NOW(),
        last_burn_amount = v_burn_amount,
        last_burn_source = p_source,
        updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object(
        'success', TRUE,
        'burn_id', v_burn_id,
        'original_amount', p_original_amount,
        'burn_amount', v_burn_amount,
        'net_amount', v_net_amount,
        'burn_percentage', c_burn_percentage,
        'source', p_source,
        'hard_law', '25_PERCENT_BURN_ENFORCED'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_RECORD_FAILED',
            'message', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION fn_record_burn IS '🔥 TASK 02: Record 25% burn atomically';

-- ═══════════════════════════════════════════════════════════
-- 💎 fn_append_to_ledger (Atomic Ledger Append)
-- Appends a new entry to the diamond ledger
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_append_to_ledger(
    p_user_id UUID,
    p_delta BIGINT,
    p_source VARCHAR(50),
    p_reference_id UUID DEFAULT NULL,
    p_reference_type VARCHAR(30) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_entry_id UUID;
BEGIN
    -- Get current balance (or 0 if no entries)
    SELECT COALESCE(
        (SELECT balance_after FROM diamond_ledger_entries 
         WHERE user_id = p_user_id 
         ORDER BY created_at DESC LIMIT 1),
        0
    ) INTO v_current_balance;

    -- Calculate new balance
    v_new_balance := v_current_balance + p_delta;

    -- Prevent negative balance
    IF v_new_balance < 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'current_balance', v_current_balance,
            'delta', p_delta,
            'shortfall', ABS(v_new_balance)
        );
    END IF;

    -- Append to ledger (IMMUTABLE ONCE WRITTEN)
    INSERT INTO diamond_ledger_entries (user_id, delta, balance_after, source, reference_id, reference_type, metadata)
    VALUES (p_user_id, p_delta, v_new_balance, p_source, p_reference_id, p_reference_type, p_metadata)
    RETURNING id INTO v_entry_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'entry_id', v_entry_id,
        'user_id', p_user_id,
        'delta', p_delta,
        'balance_before', v_current_balance,
        'balance_after', v_new_balance,
        'source', p_source,
        'hard_law', 'ATOMIC_IMMUTABLE_LEDGER'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'LEDGER_APPEND_FAILED',
            'message', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION fn_append_to_ledger IS '💎 TASK 01: Append to atomic immutable ledger';

-- ═══════════════════════════════════════════════════════════
-- 📊 FOUNDATION VERIFICATION VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_foundation_status AS
SELECT 
    -- Task 01
    (SELECT COUNT(*) FROM diamond_ledger_entries) AS ledger_entries_count,
    (SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_ledger_update')) AS ledger_immutability_active,
    
    -- Task 02
    (SELECT total_burned FROM burn_vault WHERE id = 1) AS total_diamonds_burned,
    (SELECT COUNT(*) FROM burn_ledger) AS burn_records_count,
    
    -- Task 03
    (SELECT COUNT(*) FROM streak_config) AS streak_tiers_configured,
    (SELECT multiplier FROM streak_config WHERE min_days = 3) AS day_3_multiplier,
    (SELECT multiplier FROM streak_config WHERE min_days = 7) AS day_7_multiplier,
    (SELECT multiplier FROM streak_config WHERE min_days = 30) AS day_30_multiplier,
    
    -- Timestamps
    NOW() AS verified_at;

COMMENT ON VIEW yellow_foundation_status IS '📊 YELLOW FOUNDATION Status Dashboard';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON diamond_ledger_entries TO authenticated;
GRANT SELECT ON burn_ledger TO authenticated;
GRANT SELECT ON burn_vault TO authenticated;
GRANT SELECT ON streak_config TO authenticated;
GRANT SELECT ON yellow_foundation_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_get_streak_multiplier TO authenticated;
GRANT EXECUTE ON FUNCTION fn_record_burn TO authenticated;
GRANT EXECUTE ON FUNCTION fn_append_to_ledger TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW FOUNDATION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 01: ATOMIC_DIAMOND_LEDGER ✅
--   - diamond_ledger_entries table (ID, User_ID, Delta, Balance_After)
--   - trg_prevent_ledger_update (blocks UPDATE/DELETE)
--   - fn_append_to_ledger() for atomic appends
--
-- TASK 02: THE_25_PERCENT_BURN_VAULT ✅
--   - burn_vault table (accumulator)
--   - burn_ledger table (immutable records)
--   - fn_record_burn() for atomic burn recording
--
-- TASK 03: MULTIPLIER_STREAK_LOOKUP ✅
--   - streak_config table with Hard Law multipliers
--   - 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
--   - fn_get_streak_multiplier() for lookups
--
-- ═══════════════════════════════════════════════════════════
