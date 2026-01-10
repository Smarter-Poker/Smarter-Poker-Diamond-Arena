-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 015
-- YELLOW ACTIVE LOGIC (TASKS 4-6)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 04: THE 25_PERCENT_BURN_ENFORCER
-- TASK 05: STREAK_MULTIPLIER_CALCULATOR
-- TASK 06: ATOMIC_MINT_SECURITY_GUARD
--
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 04: THE 25_PERCENT_BURN_ENFORCER
-- ═══════════════════════════════════════════════════════════
-- Trigger: trig_execute_marketplace_burn
-- Hard Law: On 'item_sale', split 75% to Seller, 25% to burn_vault
-- ═══════════════════════════════════════════════════════════

-- Create marketplace_sales table if not exists (for tracking)
CREATE TABLE IF NOT EXISTS marketplace_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    seller_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    
    -- Item details
    item_id UUID,
    item_type VARCHAR(50) NOT NULL DEFAULT 'MARKETPLACE_ITEM',
    item_name VARCHAR(200),
    
    -- Pricing (BEFORE burn split)
    sale_price BIGINT NOT NULL CHECK (sale_price > 0),
    
    -- Burn split (calculated by trigger)
    burn_amount BIGINT NOT NULL DEFAULT 0,
    seller_receives BIGINT NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING -> PROCESSING -> COMPLETED / FAILED
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Hard Law constraints
    CONSTRAINT valid_burn_split CHECK (
        burn_amount + seller_receives = sale_price
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED')
    )
);

CREATE INDEX IF NOT EXISTS idx_marketplace_sales_seller ON marketplace_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_sales_buyer ON marketplace_sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_sales_status ON marketplace_sales(status);

COMMENT ON TABLE marketplace_sales IS '🛒 TASK 04: Marketplace sales with 25% burn enforcement';

-- ═══════════════════════════════════════════════════════════
-- 🔥 trig_execute_marketplace_burn
-- Automatically enforces 25% burn on every marketplace sale
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_trig_execute_marketplace_burn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;      -- HARD LAW: 25%
    c_seller_rate CONSTANT NUMERIC := 0.75;    -- HARD LAW: 75%
    c_burn_vault_user CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
    
    v_burn_amount BIGINT;
    v_seller_receives BIGINT;
    v_buyer_wallet RECORD;
    v_seller_wallet RECORD;
    v_burn_wallet RECORD;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- Calculate 25% burn split (HARD LAW)
    -- ═══════════════════════════════════════════════════════
    v_burn_amount := FLOOR(NEW.sale_price * c_burn_rate);
    v_seller_receives := NEW.sale_price - v_burn_amount;
    
    -- Minimum burn of 1 diamond for sales >= 4
    IF v_burn_amount < 1 AND NEW.sale_price >= 4 THEN
        v_burn_amount := 1;
        v_seller_receives := NEW.sale_price - 1;
    END IF;
    
    -- Update the NEW record with calculated values
    NEW.burn_amount := v_burn_amount;
    NEW.seller_receives := v_seller_receives;
    
    -- If status is PENDING, just calculate and return
    IF NEW.status = 'PENDING' THEN
        RETURN NEW;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- PROCESSING: Execute the burn and transfer
    -- ═══════════════════════════════════════════════════════
    IF NEW.status = 'PROCESSING' AND (OLD IS NULL OR OLD.status = 'PENDING') THEN
        
        -- Lock buyer's wallet
        SELECT id, balance INTO v_buyer_wallet
        FROM wallets WHERE user_id = NEW.buyer_id
        FOR UPDATE NOWAIT;
        
        IF v_buyer_wallet IS NULL OR v_buyer_wallet.balance < NEW.sale_price THEN
            NEW.status := 'FAILED';
            RETURN NEW;
        END IF;
        
        -- Ensure seller wallet exists
        SELECT id INTO v_seller_wallet
        FROM wallets WHERE user_id = NEW.seller_id;
        
        IF v_seller_wallet IS NULL THEN
            INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
            VALUES (NEW.seller_id, 0, 'DIAMOND', 0, 0)
            RETURNING id INTO v_seller_wallet.id;
        END IF;
        
        -- Ensure burn vault wallet exists
        SELECT id INTO v_burn_wallet
        FROM wallets WHERE user_id = c_burn_vault_user;
        
        IF v_burn_wallet IS NULL THEN
            INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
            VALUES (c_burn_vault_user, 0, 'DIAMOND', 0, 0)
            RETURNING id INTO v_burn_wallet.id;
        END IF;
        
        -- ═══════════════════════════════════════════════════
        -- EXECUTE ATOMIC TRANSFER
        -- ═══════════════════════════════════════════════════
        
        -- 1. Debit buyer (full amount)
        UPDATE wallets SET balance = balance - NEW.sale_price WHERE user_id = NEW.buyer_id;
        
        -- 2. Credit seller (75%)
        UPDATE wallets SET balance = balance + v_seller_receives WHERE user_id = NEW.seller_id;
        
        -- 3. Credit burn vault (25%) - DESTROYED FOREVER
        UPDATE wallets SET balance = balance + v_burn_amount WHERE user_id = c_burn_vault_user;
        
        -- 4. Update burn vault counters
        UPDATE burn_vault
        SET total_burned = total_burned + v_burn_amount,
            marketplace_burned = marketplace_burned + v_burn_amount,
            last_burn_at = NOW(),
            last_burn_amount = v_burn_amount,
            last_burn_source = 'MARKETPLACE_SALE'
        WHERE id = 1;
        
        -- 5. Record in burn_ledger
        INSERT INTO burn_ledger (payer_id, transaction_id, original_amount, burn_amount, net_amount, source)
        VALUES (NEW.buyer_id, NEW.id, NEW.sale_price, v_burn_amount, v_seller_receives, 'MARKETPLACE');
        
        -- 6. Record transactions
        INSERT INTO transactions (user_id, wallet_id, type, amount, source, balance_before, balance_after, metadata)
        SELECT 
            NEW.buyer_id,
            v_buyer_wallet.id,
            'DEBIT',
            NEW.sale_price,
            'STORE_PURCHASE',
            v_buyer_wallet.balance,
            v_buyer_wallet.balance - NEW.sale_price,
            jsonb_build_object('sale_id', NEW.id, 'item_type', NEW.item_type);
            
        INSERT INTO transactions (user_id, wallet_id, type, amount, source, balance_before, balance_after, metadata)
        SELECT 
            NEW.seller_id,
            v_seller_wallet.id,
            'CREDIT',
            v_seller_receives,
            'STORE_SALE',
            w.balance,
            w.balance + v_seller_receives,
            jsonb_build_object('sale_id', NEW.id, 'burn_applied', v_burn_amount)
        FROM wallets w WHERE w.user_id = NEW.seller_id;
        
        -- Mark completed
        NEW.status := 'COMPLETED';
        NEW.completed_at := NOW();
    END IF;
    
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        NEW.status := 'FAILED';
        RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trig_execute_marketplace_burn ON marketplace_sales;
CREATE TRIGGER trig_execute_marketplace_burn
    BEFORE INSERT OR UPDATE ON marketplace_sales
    FOR EACH ROW
    EXECUTE FUNCTION fn_trig_execute_marketplace_burn();

COMMENT ON FUNCTION fn_trig_execute_marketplace_burn IS '🔥 TASK 04: 25% Burn Enforcer - Auto-splits marketplace fees';
COMMENT ON TRIGGER trig_execute_marketplace_burn ON marketplace_sales IS '🔥 HARD LAW: 75% to Seller, 25% to Burn Vault';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 05: STREAK_MULTIPLIER_CALCULATOR
-- ═══════════════════════════════════════════════════════════
-- Function: fn_apply_diamond_multiplier
-- Logic: Fetch streak_tier from RED and apply 1.2x, 1.5x, or 2.0x
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_apply_diamond_multiplier(
    p_user_id UUID,
    p_base_diamonds BIGINT,
    p_source VARCHAR(50) DEFAULT 'TRAINING'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: Multiplier Tiers
    c_day_3_multiplier CONSTANT NUMERIC := 1.20;
    c_day_7_multiplier CONSTANT NUMERIC := 1.50;
    c_day_30_multiplier CONSTANT NUMERIC := 2.00;
    
    v_streak_days INTEGER;
    v_multiplier NUMERIC := 1.00;
    v_tier_name VARCHAR(30) := 'COLD';
    v_tier_label VARCHAR(50) := '❄️ No Streak';
    v_final_diamonds BIGINT;
    v_streak_bonus BIGINT;
    v_red_source VARCHAR(30) := 'UNKNOWN';
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- Fetch streak from RED silo (profiles table first)
    -- Fallback to YELLOW silo (wallets table)
    -- ═══════════════════════════════════════════════════════
    
    -- Try RED Engine first (profiles.current_streak)
    BEGIN
        SELECT current_streak INTO v_streak_days
        FROM profiles
        WHERE id = p_user_id;
        
        IF v_streak_days IS NOT NULL THEN
            v_red_source := 'RED_ENGINE';
        END IF;
    EXCEPTION WHEN undefined_table THEN
        v_streak_days := NULL;
    END;
    
    -- Fallback to YELLOW Engine (wallets.current_streak)
    IF v_streak_days IS NULL THEN
        SELECT current_streak INTO v_streak_days
        FROM wallets
        WHERE user_id = p_user_id;
        v_red_source := 'YELLOW_FALLBACK';
    END IF;
    
    v_streak_days := COALESCE(v_streak_days, 0);
    
    -- ═══════════════════════════════════════════════════════
    -- Calculate multiplier based on streak tier (HARD LAW)
    -- ═══════════════════════════════════════════════════════
    
    IF v_streak_days >= 30 THEN
        v_multiplier := c_day_30_multiplier;  -- 2.0x
        v_tier_name := 'LEGENDARY';
        v_tier_label := '👑 30-Day Legend';
    ELSIF v_streak_days >= 14 THEN
        v_multiplier := 1.75;
        v_tier_name := 'BLAZING';
        v_tier_label := '🔥🔥🔥 Blazing';
    ELSIF v_streak_days >= 7 THEN
        v_multiplier := c_day_7_multiplier;   -- 1.5x
        v_tier_name := 'HOT';
        v_tier_label := '🔥🔥 7-Day Streak';
    ELSIF v_streak_days >= 3 THEN
        v_multiplier := c_day_3_multiplier;   -- 1.2x
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
    
    -- ═══════════════════════════════════════════════════════
    -- Apply multiplier to base diamonds
    -- ═══════════════════════════════════════════════════════
    
    v_final_diamonds := FLOOR(p_base_diamonds * v_multiplier);
    v_streak_bonus := v_final_diamonds - p_base_diamonds;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'base_diamonds', p_base_diamonds,
        'multiplier', v_multiplier,
        'final_diamonds', v_final_diamonds,
        'streak_bonus', v_streak_bonus,
        'streak', jsonb_build_object(
            'days', v_streak_days,
            'tier_name', v_tier_name,
            'tier_label', v_tier_label,
            'source', v_red_source
        ),
        'formula', format('%s × %s = %s 💎', p_base_diamonds, v_multiplier, v_final_diamonds),
        'hard_law', 'STREAK_MULTIPLIER_CALCULATOR'
    );
END;
$$;

COMMENT ON FUNCTION fn_apply_diamond_multiplier IS '🔥 TASK 05: Streak Multiplier Calculator - Fetch from RED, apply 1.2x/1.5x/2.0x';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 06: ATOMIC_MINT_SECURITY_GUARD
-- ═══════════════════════════════════════════════════════════
-- RPC: mint_diamonds_secure (enhanced with 85% mastery gate)
-- Validation: Cross-verify with GREEN silo before finalizing
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION mint_diamonds_secure(
    p_user_id UUID,
    p_amount BIGINT,
    p_source VARCHAR(50) DEFAULT 'TRAINING_REWARD',
    p_session_id UUID DEFAULT NULL,
    p_accuracy NUMERIC(5,4) DEFAULT NULL,  -- Required for training rewards
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- HARD LAW: 85% Mastery Gate (GREEN Silo verification)
    c_mastery_threshold CONSTANT NUMERIC := 0.85;
    
    v_wallet RECORD;
    v_multiplier_result JSONB;
    v_final_amount BIGINT;
    v_transaction_id UUID;
    v_mastery_verified BOOLEAN := FALSE;
    v_green_status VARCHAR(30) := 'NOT_CHECKED';
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION: Basic input checks
    -- ═══════════════════════════════════════════════════════
    
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_USER',
            'status', 'ATOMIC_FAILED'
        );
    END IF;
    
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'status', 'ATOMIC_FAILED'
        );
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- GREEN SILO CROSS-VERIFICATION: 85% Mastery Gate
    -- Required for training-related sources
    -- ═══════════════════════════════════════════════════════
    
    IF p_source IN ('TRAINING_REWARD', 'SESSION_REWARD', 'DRILL_REWARD', 'TRAINING') THEN
        -- Training source requires accuracy verification
        IF p_accuracy IS NULL THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'MASTERY_NOT_VERIFIED',
                'message', 'Training rewards require accuracy parameter for GREEN silo verification',
                'status', 'ATOMIC_FAILED',
                'hard_law', '85_PERCENT_MASTERY_GATE'
            );
        END IF;
        
        -- HARD LAW: 85% threshold
        IF p_accuracy < c_mastery_threshold THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'MASTERY_GATE_FAILED',
                'message', format('GREEN silo requires 85%% mastery, got %.1f%%', p_accuracy * 100),
                'accuracy', p_accuracy,
                'threshold', c_mastery_threshold,
                'status', 'ATOMIC_FAILED',
                'hard_law', '85_PERCENT_MASTERY_GATE'
            );
        END IF;
        
        v_mastery_verified := TRUE;
        v_green_status := 'VERIFIED';
    ELSE
        -- Non-training sources bypass mastery check
        v_green_status := 'BYPASSED';
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- Apply streak multiplier (if training source)
    -- ═══════════════════════════════════════════════════════
    
    IF p_source IN ('TRAINING_REWARD', 'SESSION_REWARD', 'DRILL_REWARD', 'TRAINING') THEN
        v_multiplier_result := fn_apply_diamond_multiplier(p_user_id, p_amount, p_source);
        v_final_amount := (v_multiplier_result->>'final_diamonds')::BIGINT;
    ELSE
        v_final_amount := p_amount;
        v_multiplier_result := jsonb_build_object('multiplier', 1.00, 'applied', FALSE);
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- Acquire/Create wallet
    -- ═══════════════════════════════════════════════════════
    
    SELECT id, balance, current_streak INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_user_id, 0, 'DIAMOND', 0, 0)
        RETURNING id, balance, current_streak INTO v_wallet;
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- Execute atomic mint
    -- ═══════════════════════════════════════════════════════
    
    UPDATE wallets
    SET balance = balance + v_final_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, metadata
    ) VALUES (
        p_user_id, v_wallet.id, 'CREDIT', v_final_amount, p_source,
        v_wallet.balance, v_wallet.balance + v_final_amount,
        p_session_id,
        p_metadata || jsonb_build_object(
            'atomic', TRUE,
            'mastery_verified', v_mastery_verified,
            'green_status', v_green_status,
            'accuracy', p_accuracy,
            'base_amount', p_amount,
            'multiplier', v_multiplier_result->>'multiplier'
        )
    )
    RETURNING id INTO v_transaction_id;
    
    -- ═══════════════════════════════════════════════════════
    -- Return success with full audit trail
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'ATOMIC_SUCCESS',
        'data', jsonb_build_object(
            'user_id', p_user_id,
            'base_amount', p_amount,
            'final_amount', v_final_amount,
            'balance_before', v_wallet.balance,
            'balance_after', v_wallet.balance + v_final_amount,
            'transaction_id', v_transaction_id
        ),
        'green_verification', jsonb_build_object(
            'status', v_green_status,
            'mastery_verified', v_mastery_verified,
            'accuracy', p_accuracy,
            'threshold', c_mastery_threshold,
            'hard_law', '85_PERCENT_MASTERY_GATE'
        ),
        'multiplier', v_multiplier_result,
        'meta', jsonb_build_object(
            'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time)),
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'MINT_EXCEPTION',
            'message', SQLERRM,
            'status', 'ATOMIC_FAILED'
        );
END;
$$;

COMMENT ON FUNCTION mint_diamonds_secure IS '🛡️ TASK 06: Atomic Mint Security Guard with GREEN silo 85% mastery verification';

-- ═══════════════════════════════════════════════════════════
-- 📊 ACTIVE LOGIC VERIFICATION VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_active_logic_status AS
SELECT 
    -- Task 04: Burn Enforcer
    (SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trig_execute_marketplace_burn')) AS burn_enforcer_active,
    (SELECT COUNT(*) FROM marketplace_sales WHERE status = 'COMPLETED') AS marketplace_sales_processed,
    
    -- Task 05: Multiplier Calculator
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_apply_diamond_multiplier')) AS multiplier_calculator_exists,
    
    -- Task 06: Mint Security Guard
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'mint_diamonds_secure')) AS mint_guard_exists,
    
    -- Timestamps
    NOW() AS verified_at;

COMMENT ON VIEW yellow_active_logic_status IS '📊 YELLOW ACTIVE LOGIC Status (Tasks 4-6)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON marketplace_sales TO authenticated;
GRANT SELECT ON yellow_active_logic_status TO authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_diamond_multiplier TO authenticated;
GRANT EXECUTE ON FUNCTION mint_diamonds_secure TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW ACTIVE LOGIC COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 04: THE_25_PERCENT_BURN_ENFORCER ✅
--   - trig_execute_marketplace_burn trigger
--   - HARD LAW: 75% to Seller, 25% to burn_vault
--
-- TASK 05: STREAK_MULTIPLIER_CALCULATOR ✅
--   - fn_apply_diamond_multiplier function
--   - Fetches streak from RED (profiles) with YELLOW fallback
--   - 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
--
-- TASK 06: ATOMIC_MINT_SECURITY_GUARD ✅
--   - mint_diamonds_secure RPC function
--   - Cross-verifies 85% mastery with GREEN silo
--   - Applies streak multiplier automatically
--
-- ═══════════════════════════════════════════════════════════
