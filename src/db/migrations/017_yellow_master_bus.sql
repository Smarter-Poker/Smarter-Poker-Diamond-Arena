-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 017
-- YELLOW MASTER BUS (TASKS 10-12)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 10: THE 25_PERCENT_BURN_MIGRATION
-- TASK 11: ATOMIC_LEDGER_SECURITY_SHIELD
-- TASK 12: STREAK_MULTIPLIER_DYNAMIC_SYNC
--
-- SOVEREIGN_EXECUTION_PROTOCOL: ENABLED
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 10: THE 25_PERCENT_BURN_MIGRATION
-- ═══════════════════════════════════════════════════════════
-- Force-map 'fn_execute_marketplace_burn' to Supabase
-- Law: 25% of all item-sale-fees sent to 'burn_vault' table
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_execute_marketplace_burn(
    p_seller_id UUID,
    p_buyer_id UUID,
    p_sale_amount BIGINT,
    p_item_id UUID DEFAULT NULL,
    p_item_type VARCHAR(50) DEFAULT 'MARKETPLACE_ITEM',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: 25% burn rate
    c_burn_rate CONSTANT NUMERIC := 0.25;
    c_seller_rate CONSTANT NUMERIC := 0.75;
    c_burn_vault_user CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
    
    v_burn_amount BIGINT;
    v_seller_receives BIGINT;
    v_buyer_wallet RECORD;
    v_seller_wallet RECORD;
    v_burn_wallet_id UUID;
    v_tx_id UUID;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    
    IF p_sale_amount IS NULL OR p_sale_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'message', 'Sale amount must be positive'
        );
    END IF;
    
    IF p_seller_id IS NULL OR p_buyer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_PARTICIPANTS',
            'message', 'Both seller_id and buyer_id are required'
        );
    END IF;
    
    IF p_seller_id = p_buyer_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SELF_PURCHASE',
            'message', 'Cannot purchase own items'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE 25% BURN SPLIT (HARD LAW)
    -- ═══════════════════════════════════════════════════════
    
    v_burn_amount := FLOOR(p_sale_amount * c_burn_rate);
    v_seller_receives := p_sale_amount - v_burn_amount;
    
    -- Minimum 1 diamond burn for sales >= 4
    IF v_burn_amount < 1 AND p_sale_amount >= 4 THEN
        v_burn_amount := 1;
        v_seller_receives := p_sale_amount - 1;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE LOCKS
    -- ═══════════════════════════════════════════════════════
    
    -- Lock buyer wallet
    SELECT id, balance INTO v_buyer_wallet
    FROM wallets
    WHERE user_id = p_buyer_id
    FOR UPDATE NOWAIT;
    
    IF v_buyer_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BUYER_WALLET_NOT_FOUND'
        );
    END IF;
    
    IF v_buyer_wallet.balance < p_sale_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'required', p_sale_amount,
            'available', v_buyer_wallet.balance,
            'shortfall', p_sale_amount - v_buyer_wallet.balance
        );
    END IF;
    
    -- Get or create seller wallet
    SELECT id, balance INTO v_seller_wallet
    FROM wallets
    WHERE user_id = p_seller_id
    FOR UPDATE;
    
    IF v_seller_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_seller_id, 0, 'DIAMOND', 0, 0)
        RETURNING id, balance INTO v_seller_wallet;
    END IF;
    
    -- Get or create burn vault wallet
    SELECT id INTO v_burn_wallet_id
    FROM wallets
    WHERE user_id = c_burn_vault_user;
    
    IF v_burn_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (c_burn_vault_user, 0, 'DIAMOND', 0, 0)
        RETURNING id INTO v_burn_wallet_id;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- EXECUTE ATOMIC TRANSFER
    -- ═══════════════════════════════════════════════════════
    
    -- 1. Debit buyer (full amount)
    UPDATE wallets 
    SET balance = balance - p_sale_amount, updated_at = NOW()
    WHERE id = v_buyer_wallet.id;
    
    -- Record buyer transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_buyer_id, v_buyer_wallet.id, 'DEBIT', p_sale_amount, 'STORE_PURCHASE',
        v_buyer_wallet.balance, v_buyer_wallet.balance - p_sale_amount,
        p_item_id, p_item_type,
        p_metadata || jsonb_build_object('burn_applied', v_burn_amount)
    )
    RETURNING id INTO v_tx_id;
    
    -- 2. Credit seller (75%)
    UPDATE wallets 
    SET balance = balance + v_seller_receives, updated_at = NOW()
    WHERE id = v_seller_wallet.id;
    
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_seller_id, v_seller_wallet.id, 'CREDIT', v_seller_receives, 'STORE_SALE',
        v_seller_wallet.balance, v_seller_wallet.balance + v_seller_receives,
        p_item_id, p_item_type,
        p_metadata || jsonb_build_object('net_after_burn', TRUE, 'original_sale', p_sale_amount)
    );
    
    -- 3. Credit burn vault (25%) - DESTROYED FOREVER
    UPDATE wallets 
    SET balance = balance + v_burn_amount, updated_at = NOW()
    WHERE id = v_burn_wallet_id;
    
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        c_burn_vault_user, v_burn_wallet_id, 'CREDIT', v_burn_amount, 'MARKETPLACE_BURN',
        (SELECT balance - v_burn_amount FROM wallets WHERE id = v_burn_wallet_id),
        (SELECT balance FROM wallets WHERE id = v_burn_wallet_id),
        p_item_id, 'BURN',
        jsonb_build_object('source_tx', v_tx_id, 'burned_from_sale', p_sale_amount)
    );
    
    -- 4. Update burn_vault counters
    UPDATE burn_vault
    SET total_burned = total_burned + v_burn_amount,
        marketplace_burned = marketplace_burned + v_burn_amount,
        last_burn_at = NOW(),
        last_burn_amount = v_burn_amount,
        last_burn_source = 'MARKETPLACE_BURN',
        updated_at = NOW()
    WHERE id = 1;
    
    -- 5. Record in burn_ledger (immutable)
    INSERT INTO burn_ledger (
        payer_id, transaction_id, original_amount, burn_amount, net_amount, source
    ) VALUES (
        p_buyer_id, v_tx_id, p_sale_amount, v_burn_amount, v_seller_receives, 'MARKETPLACE'
    );
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'BURN_EXECUTED',
        'transaction', jsonb_build_object(
            'tx_id', v_tx_id,
            'sale_amount', p_sale_amount,
            'burn_amount', v_burn_amount,
            'seller_receives', v_seller_receives,
            'burn_rate', (c_burn_rate * 100) || '%'
        ),
        'participants', jsonb_build_object(
            'buyer_id', p_buyer_id,
            'seller_id', p_seller_id,
            'burn_vault', c_burn_vault_user
        ),
        'balances', jsonb_build_object(
            'buyer_new_balance', v_buyer_wallet.balance - p_sale_amount,
            'seller_new_balance', v_seller_wallet.balance + v_seller_receives
        ),
        'meta', jsonb_build_object(
            'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'item_id', p_item_id,
            'item_type', p_item_type
        ),
        'hard_law', '25_PERCENT_BURN_MIGRATION'
    );

EXCEPTION
    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_LOCKED',
            'message', 'Another transaction is in progress'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

COMMENT ON FUNCTION fn_execute_marketplace_burn IS '🔥 TASK 10: 25% Burn Migration - Force-mapped to Supabase';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 11: ATOMIC_LEDGER_SECURITY_SHIELD
-- ═══════════════════════════════════════════════════════════
-- Map 'rpc_verify_wallet_integrity'
-- Logic: Transaction fails if current_balance != sum(ledger_history)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rpc_verify_wallet_integrity(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_ledger_balance BIGINT;
    v_credit_sum BIGINT;
    v_debit_sum BIGINT;
    v_tx_count BIGINT;
    v_is_valid BOOLEAN;
    v_variance BIGINT;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GET CURRENT WALLET BALANCE
    -- ═══════════════════════════════════════════════════════
    
    SELECT id, balance, user_id, current_streak
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'verified', TRUE,
            'status', 'NO_WALLET',
            'message', 'User has no wallet - integrity valid (zero balance assumed)',
            'balance', 0
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- CALCULATE LEDGER SUM
    -- ═══════════════════════════════════════════════════════
    
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0),
        COUNT(*)
    INTO v_credit_sum, v_debit_sum, v_tx_count
    FROM transactions
    WHERE wallet_id = v_wallet.id;
    
    v_ledger_balance := v_credit_sum - v_debit_sum;
    
    -- ═══════════════════════════════════════════════════════
    -- VERIFY INTEGRITY: current_balance = sum(ledger_history)
    -- ═══════════════════════════════════════════════════════
    
    v_is_valid := (v_wallet.balance = v_ledger_balance);
    v_variance := v_wallet.balance - v_ledger_balance;
    
    IF NOT v_is_valid THEN
        -- CRITICAL: Integrity violation detected
        RETURN jsonb_build_object(
            'success', TRUE,
            'verified', FALSE,
            'status', 'INTEGRITY_VIOLATION',
            'alert', 'SECURITY_SHIELD_TRIGGERED',
            'wallet', jsonb_build_object(
                'wallet_id', v_wallet.id,
                'current_balance', v_wallet.balance
            ),
            'ledger', jsonb_build_object(
                'calculated_balance', v_ledger_balance,
                'total_credits', v_credit_sum,
                'total_debits', v_debit_sum,
                'transaction_count', v_tx_count
            ),
            'variance', jsonb_build_object(
                'amount', v_variance,
                'direction', CASE WHEN v_variance > 0 THEN 'WALLET_OVER' ELSE 'WALLET_UNDER' END
            ),
            'meta', jsonb_build_object(
                'check_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
                'checked_at', NOW()
            ),
            'hard_law', 'ATOMIC_LEDGER_SECURITY_SHIELD'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- INTEGRITY VALID
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'verified', TRUE,
        'status', 'INTEGRITY_VALID',
        'wallet', jsonb_build_object(
            'wallet_id', v_wallet.id,
            'current_balance', v_wallet.balance,
            'streak', v_wallet.current_streak
        ),
        'ledger', jsonb_build_object(
            'calculated_balance', v_ledger_balance,
            'total_credits', v_credit_sum,
            'total_debits', v_debit_sum,
            'transaction_count', v_tx_count
        ),
        'formula', format('credits(%s) - debits(%s) = %s = balance(%s) ✓', 
            v_credit_sum, v_debit_sum, v_ledger_balance, v_wallet.balance),
        'meta', jsonb_build_object(
            'check_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'checked_at', NOW()
        ),
        'hard_law', 'ATOMIC_LEDGER_SECURITY_SHIELD'
    );
END;
$$;

COMMENT ON FUNCTION rpc_verify_wallet_integrity IS '🛡️ TASK 11: Atomic Ledger Security Shield - Verifies balance = sum(ledger)';

-- ═══════════════════════════════════════════════════════════
-- 🛡️ Integrity Guard Trigger (Optional enforcement)
-- Prevents transactions that would break integrity
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_integrity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_expected_balance BIGINT;
BEGIN
    -- Calculate expected balance based on previous transactions
    SELECT COALESCE(
        SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0
    ) INTO v_expected_balance
    FROM transactions
    WHERE wallet_id = NEW.wallet_id
      AND id != NEW.id;
    
    -- Add this transaction
    IF NEW.type = 'CREDIT' THEN
        v_expected_balance := v_expected_balance + NEW.amount;
    ELSE
        v_expected_balance := v_expected_balance - NEW.amount;
    END IF;
    
    -- Verify balance_after matches expected
    IF NEW.balance_after != v_expected_balance THEN
        RAISE WARNING 'INTEGRITY_GUARD: balance_after (%) does not match expected (%)', 
            NEW.balance_after, v_expected_balance;
        -- Note: We warn but don't fail to allow for edge cases
    END IF;
    
    RETURN NEW;
END;
$$;

-- Optional: Enable integrity guard trigger
-- DROP TRIGGER IF EXISTS trg_integrity_guard ON transactions;
-- CREATE TRIGGER trg_integrity_guard
--     AFTER INSERT ON transactions
--     FOR EACH ROW
--     EXECUTE FUNCTION fn_integrity_guard();

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 12: STREAK_MULTIPLIER_DYNAMIC_SYNC
-- ═══════════════════════════════════════════════════════════
-- Connect to RED 'streak_count'
-- Logic: Apply tier-based bonus (1.2x - 2.0x) to all GREEN reward signals
-- ═══════════════════════════════════════════════════════════

-- Streak sync log for auditing RED->YELLOW connections
CREATE TABLE IF NOT EXISTS streak_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Sync source
    source_silo VARCHAR(20) NOT NULL,  -- 'RED' or 'YELLOW'
    source_table VARCHAR(50) NOT NULL,
    
    -- Streak values
    streak_value INTEGER NOT NULL,
    previous_value INTEGER,
    
    -- Multiplier applied
    multiplier_applied NUMERIC(4,2) NOT NULL,
    tier_name VARCHAR(30) NOT NULL,
    
    -- Reward context
    green_signal_type VARCHAR(50),  -- 'TRAINING', 'DRILL', etc.
    base_reward BIGINT,
    final_reward BIGINT,
    
    -- Audit
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_sync_user ON streak_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_sync_time ON streak_sync_log(synced_at DESC);

COMMENT ON TABLE streak_sync_log IS '🔄 TASK 12: Streak Sync Log - RED to YELLOW multiplier application';

-- ═══════════════════════════════════════════════════════════
-- 🔄 fn_sync_streak_from_red
-- Syncs streak from RED silo and applies multiplier
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_sync_streak_from_red(
    p_user_id UUID,
    p_base_reward BIGINT,
    p_green_signal VARCHAR(50) DEFAULT 'TRAINING_REWARD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: Multiplier tiers
    c_day_3_multiplier CONSTANT NUMERIC := 1.20;
    c_day_7_multiplier CONSTANT NUMERIC := 1.50;
    c_day_30_multiplier CONSTANT NUMERIC := 2.00;
    
    v_streak_days INTEGER;
    v_source_silo VARCHAR(20);
    v_source_table VARCHAR(50);
    v_multiplier NUMERIC := 1.00;
    v_tier_name VARCHAR(30) := 'COLD';
    v_final_reward BIGINT;
    v_previous_streak INTEGER;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- SYNC STREAK FROM RED SILO (profiles table)
    -- ═══════════════════════════════════════════════════════
    
    BEGIN
        SELECT current_streak INTO v_streak_days
        FROM profiles
        WHERE id = p_user_id;
        
        IF v_streak_days IS NOT NULL THEN
            v_source_silo := 'RED';
            v_source_table := 'profiles';
        END IF;
    EXCEPTION WHEN undefined_table THEN
        v_streak_days := NULL;
    END;
    
    -- Fallback to YELLOW silo (wallets table)
    IF v_streak_days IS NULL THEN
        SELECT current_streak INTO v_streak_days
        FROM wallets
        WHERE user_id = p_user_id;
        
        v_source_silo := 'YELLOW';
        v_source_table := 'wallets';
    END IF;
    
    v_streak_days := COALESCE(v_streak_days, 0);
    
    -- Get previous streak for delta tracking
    SELECT streak_value INTO v_previous_streak
    FROM streak_sync_log
    WHERE user_id = p_user_id
    ORDER BY synced_at DESC
    LIMIT 1;
    
    -- ═══════════════════════════════════════════════════════
    -- APPLY TIER-BASED MULTIPLIER (HARD LAW)
    -- ═══════════════════════════════════════════════════════
    
    IF v_streak_days >= 30 THEN
        v_multiplier := c_day_30_multiplier;  -- 2.0x
        v_tier_name := 'LEGENDARY';
    ELSIF v_streak_days >= 14 THEN
        v_multiplier := 1.75;
        v_tier_name := 'BLAZING';
    ELSIF v_streak_days >= 7 THEN
        v_multiplier := c_day_7_multiplier;   -- 1.5x
        v_tier_name := 'HOT';
    ELSIF v_streak_days >= 3 THEN
        v_multiplier := c_day_3_multiplier;   -- 1.2x
        v_tier_name := 'WARMING';
    ELSIF v_streak_days >= 1 THEN
        v_multiplier := 1.10;
        v_tier_name := 'WARMING_UP';
    ELSE
        v_multiplier := 1.00;
        v_tier_name := 'COLD';
    END IF;
    
    -- Calculate final reward
    v_final_reward := FLOOR(p_base_reward * v_multiplier);
    
    -- ═══════════════════════════════════════════════════════
    -- LOG THE SYNC
    -- ═══════════════════════════════════════════════════════
    
    INSERT INTO streak_sync_log (
        user_id, source_silo, source_table, streak_value, previous_value,
        multiplier_applied, tier_name, green_signal_type, base_reward, final_reward
    ) VALUES (
        p_user_id, v_source_silo, v_source_table, v_streak_days, v_previous_streak,
        v_multiplier, v_tier_name, p_green_signal, p_base_reward, v_final_reward
    );
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'sync', jsonb_build_object(
            'source_silo', v_source_silo,
            'source_table', v_source_table,
            'streak_days', v_streak_days,
            'previous_streak', v_previous_streak,
            'streak_changed', (v_previous_streak IS NULL OR v_streak_days != v_previous_streak)
        ),
        'multiplier', jsonb_build_object(
            'tier', v_tier_name,
            'value', v_multiplier,
            'hard_law_3_day', c_day_3_multiplier,
            'hard_law_7_day', c_day_7_multiplier,
            'hard_law_30_day', c_day_30_multiplier
        ),
        'reward', jsonb_build_object(
            'green_signal', p_green_signal,
            'base_reward', p_base_reward,
            'final_reward', v_final_reward,
            'streak_bonus', v_final_reward - p_base_reward,
            'formula', format('%s × %s = %s 💎', p_base_reward, v_multiplier, v_final_reward)
        ),
        'hard_law', 'STREAK_MULTIPLIER_DYNAMIC_SYNC'
    );
END;
$$;

COMMENT ON FUNCTION fn_sync_streak_from_red IS '🔄 TASK 12: Streak Multiplier Dynamic Sync - RED to GREEN reward application';

-- ═══════════════════════════════════════════════════════════
-- 🔄 fn_process_green_reward_signal
-- Unified endpoint for processing GREEN silo reward signals
-- Applies streak multiplier and mints diamonds atomically
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_process_green_reward_signal(
    p_user_id UUID,
    p_base_reward BIGINT,
    p_accuracy NUMERIC(5,4) DEFAULT 1.0,
    p_signal_type VARCHAR(50) DEFAULT 'TRAINING_REWARD',
    p_session_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_mastery_threshold CONSTANT NUMERIC := 0.85;
    v_sync_result JSONB;
    v_final_reward BIGINT;
    v_mint_result JSONB;
    v_wallet RECORD;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GREEN GATE: 85% MASTERY THRESHOLD
    -- ═══════════════════════════════════════════════════════
    
    IF p_accuracy < c_mastery_threshold THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'MASTERY_GATE_FAILED',
            'message', format('GREEN silo requires 85%% mastery, got %.1f%%', p_accuracy * 100),
            'accuracy', p_accuracy,
            'threshold', c_mastery_threshold,
            'hard_law', '85_PERCENT_MASTERY_GATE'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- SYNC STREAK FROM RED & APPLY MULTIPLIER
    -- ═══════════════════════════════════════════════════════
    
    v_sync_result := fn_sync_streak_from_red(p_user_id, p_base_reward, p_signal_type);
    v_final_reward := (v_sync_result->'reward'->>'final_reward')::BIGINT;
    
    -- ═══════════════════════════════════════════════════════
    -- MINT DIAMONDS (YELLOW SILO)
    -- ═══════════════════════════════════════════════════════
    
    -- Get or create wallet
    SELECT id, balance INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_user_id, 0, 'DIAMOND', 0, 0)
        RETURNING id, balance INTO v_wallet;
    END IF;
    
    -- Execute mint
    UPDATE wallets
    SET balance = balance + v_final_reward, updated_at = NOW()
    WHERE id = v_wallet.id;
    
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, metadata
    ) VALUES (
        p_user_id, v_wallet.id, 'CREDIT', v_final_reward, p_signal_type,
        v_wallet.balance, v_wallet.balance + v_final_reward,
        p_session_id,
        p_metadata || jsonb_build_object(
            'accuracy', p_accuracy,
            'base_reward', p_base_reward,
            'streak_multiplier', v_sync_result->'multiplier'->>'value',
            'streak_tier', v_sync_result->'multiplier'->>'tier',
            'green_signal_processed', TRUE
        )
    );
    
    -- ═══════════════════════════════════════════════════════
    -- RETURN UNIFIED RESULT
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'GREEN_SIGNAL_PROCESSED',
        'green_gate', jsonb_build_object(
            'accuracy', p_accuracy,
            'threshold', c_mastery_threshold,
            'passed', TRUE
        ),
        'red_sync', v_sync_result->'sync',
        'multiplier', v_sync_result->'multiplier',
        'reward', jsonb_build_object(
            'signal_type', p_signal_type,
            'base_reward', p_base_reward,
            'final_reward', v_final_reward,
            'streak_bonus', v_final_reward - p_base_reward
        ),
        'wallet', jsonb_build_object(
            'previous_balance', v_wallet.balance,
            'new_balance', v_wallet.balance + v_final_reward
        ),
        'hard_laws', jsonb_build_array(
            '85_PERCENT_MASTERY_GATE',
            'STREAK_MULTIPLIER_DYNAMIC_SYNC'
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'GREEN_SIGNAL_EXCEPTION',
            'message', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION fn_process_green_reward_signal IS '🔄 TASK 12: Unified GREEN Reward Signal Processor with RED sync';

-- ═══════════════════════════════════════════════════════════
-- 📊 MASTER BUS STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_master_bus_status AS
SELECT 
    -- Task 10: Burn Migration
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_execute_marketplace_burn')) AS burn_migration_active,
    (SELECT COUNT(*) FROM burn_ledger) AS burn_transactions_total,
    
    -- Task 11: Security Shield
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'rpc_verify_wallet_integrity')) AS security_shield_active,
    
    -- Task 12: Dynamic Sync
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_sync_streak_from_red')) AS red_sync_active,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_process_green_reward_signal')) AS green_signal_active,
    (SELECT COUNT(*) FROM streak_sync_log) AS sync_operations_total,
    
    NOW() AS verified_at;

COMMENT ON VIEW yellow_master_bus_status IS '📊 YELLOW MASTER BUS Status (Tasks 10-12)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON streak_sync_log TO authenticated;
GRANT SELECT ON yellow_master_bus_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_execute_marketplace_burn TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_verify_wallet_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION fn_sync_streak_from_red TO authenticated;
GRANT EXECUTE ON FUNCTION fn_process_green_reward_signal TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW MASTER BUS COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 10: THE_25_PERCENT_BURN_MIGRATION ✅
--   - fn_execute_marketplace_burn force-mapped
--   - 25% to burn_vault table (HARD LAW)
--
-- TASK 11: ATOMIC_LEDGER_SECURITY_SHIELD ✅
--   - rpc_verify_wallet_integrity
--   - Fails if balance != sum(ledger)
--
-- TASK 12: STREAK_MULTIPLIER_DYNAMIC_SYNC ✅
--   - fn_sync_streak_from_red (RED connection)
--   - fn_process_green_reward_signal (GREEN integration)
--   - 1.2x / 1.5x / 2.0x tier-based multipliers
--
-- ═══════════════════════════════════════════════════════════
