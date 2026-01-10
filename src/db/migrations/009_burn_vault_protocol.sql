-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 009
-- THE BURN VAULT PROTOCOL
-- ═══════════════════════════════════════════════════════════
-- 25% burn from every marketplace transaction.
-- Funds move to NULL_BURN_ADDRESS.
-- Tracked in Global_Burn_Counter for Orb 10 transparency.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔥 NULL BURN ADDRESS (System Wallet)
-- ═══════════════════════════════════════════════════════════

-- Reserved system UUID for the burn address
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM wallets 
        WHERE user_id = '00000000-0000-0000-0000-000000000000'
    ) THEN
        INSERT INTO wallets (
            id,
            user_id, 
            balance, 
            currency, 
            current_streak, 
            longest_streak
        ) VALUES (
            '00000000-0000-0000-0000-000000001111',
            '00000000-0000-0000-0000-000000000000',
            0,
            'DIAMOND',
            0,
            0
        );
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 📊 GLOBAL BURN COUNTER
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS global_burn_counter (
    id SERIAL PRIMARY KEY,
    total_burned BIGINT NOT NULL DEFAULT 0,
    marketplace_burns BIGINT NOT NULL DEFAULT 0,
    arcade_burns BIGINT NOT NULL DEFAULT 0,
    other_burns BIGINT NOT NULL DEFAULT 0,
    last_burn_at TIMESTAMPTZ,
    last_burn_amount BIGINT,
    last_burn_source VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize single row counter
INSERT INTO global_burn_counter (id, total_burned) 
VALUES (1, 0) 
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE global_burn_counter IS '🔥 Global burn statistics for Orb 10 transparency';

-- ═══════════════════════════════════════════════════════════
-- 📋 BURN AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS burn_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    original_amount BIGINT NOT NULL,
    burn_amount BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    burn_percentage NUMERIC(5,2) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_burn_audit_user ON burn_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_burn_audit_created ON burn_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_burn_audit_source ON burn_audit_log(source);

COMMENT ON TABLE burn_audit_log IS '📋 Immutable audit trail for all diamond burns';

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_execute_marketplace_burn
-- Deducts 25% from transaction and moves to NULL_BURN_ADDRESS
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_execute_marketplace_burn(
    p_seller_id UUID,
    p_buyer_id UUID,
    p_total_amount BIGINT,
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
    v_burn_percentage CONSTANT NUMERIC := 0.25;  -- 25% burn
    v_burn_amount BIGINT;
    v_seller_receives BIGINT;
    v_null_address CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
    v_null_wallet_id CONSTANT UUID := '00000000-0000-0000-0000-000000001111';
    v_buyer_wallet RECORD;
    v_seller_wallet RECORD;
    v_buyer_tx_id UUID;
    v_seller_tx_id UUID;
    v_burn_tx_id UUID;
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_seller_id IS NULL OR p_buyer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_PARTICIPANT',
            'message', 'Both seller and buyer IDs are required'
        );
    END IF;

    IF p_seller_id = p_buyer_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SELF_TRANSACTION',
            'message', 'Cannot transact with yourself'
        );
    END IF;

    IF p_total_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'message', 'Transaction amount must be positive'
        );
    END IF;

    -- Calculate burn and net amounts
    v_burn_amount := FLOOR(p_total_amount * v_burn_percentage);
    v_seller_receives := p_total_amount - v_burn_amount;

    -- Minimum burn of 1 diamond for any transaction
    IF v_burn_amount < 1 AND p_total_amount >= 4 THEN
        v_burn_amount := 1;
        v_seller_receives := p_total_amount - 1;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE BUYER WALLET WITH LOCK
    -- ═══════════════════════════════════════════════════════
    BEGIN
        SELECT * INTO v_buyer_wallet
        FROM wallets
        WHERE user_id = p_buyer_id
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'BUYER_WALLET_LOCKED',
                'status', 'BURN_RETRY'
            );
    END;

    IF v_buyer_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BUYER_WALLET_NOT_FOUND'
        );
    END IF;

    IF v_buyer_wallet.balance < p_total_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'current_balance', v_buyer_wallet.balance,
            'required', p_total_amount,
            'shortfall', p_total_amount - v_buyer_wallet.balance
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE/CREATE SELLER WALLET
    -- ═══════════════════════════════════════════════════════
    SELECT * INTO v_seller_wallet
    FROM wallets
    WHERE user_id = p_seller_id
    FOR UPDATE;

    IF v_seller_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_seller_id, 0, 'DIAMOND', 0, 0)
        RETURNING * INTO v_seller_wallet;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- EXECUTE TRIPLE TRANSACTION
    -- 1. Debit buyer (full amount)
    -- 2. Credit seller (net after burn)
    -- 3. Credit burn address (burn amount)
    -- ═══════════════════════════════════════════════════════

    -- 1. DEBIT BUYER
    UPDATE wallets
    SET balance = balance - p_total_amount,
        updated_at = NOW()
    WHERE id = v_buyer_wallet.id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_buyer_id, v_buyer_wallet.id, 'DEBIT', p_total_amount, 'STORE_PURCHASE',
        v_buyer_wallet.balance, v_buyer_wallet.balance - p_total_amount,
        p_item_id, p_item_type,
        p_metadata || jsonb_build_object('burn_deducted', v_burn_amount)
    ) RETURNING id INTO v_buyer_tx_id;

    -- 2. CREDIT SELLER (NET AMOUNT)
    UPDATE wallets
    SET balance = balance + v_seller_receives,
        updated_at = NOW()
    WHERE id = v_seller_wallet.id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_seller_id, v_seller_wallet.id, 'CREDIT', v_seller_receives, 'MARKETPLACE_SALE',
        v_seller_wallet.balance, v_seller_wallet.balance + v_seller_receives,
        p_item_id, p_item_type,
        jsonb_build_object('original_amount', p_total_amount, 'burn_deducted', v_burn_amount)
    ) RETURNING id INTO v_seller_tx_id;

    -- 3. CREDIT BURN ADDRESS
    UPDATE wallets
    SET balance = balance + v_burn_amount,
        updated_at = NOW()
    WHERE id = v_null_wallet_id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, metadata
    ) VALUES (
        v_null_address, v_null_wallet_id, 'CREDIT', v_burn_amount, 'MARKETPLACE_BURN',
        (SELECT balance - v_burn_amount FROM wallets WHERE id = v_null_wallet_id),
        (SELECT balance FROM wallets WHERE id = v_null_wallet_id),
        jsonb_build_object('from_transaction', v_buyer_tx_id, 'seller', p_seller_id, 'buyer', p_buyer_id)
    ) RETURNING id INTO v_burn_tx_id;

    -- ═══════════════════════════════════════════════════════
    -- UPDATE GLOBAL BURN COUNTER
    -- ═══════════════════════════════════════════════════════
    UPDATE global_burn_counter
    SET total_burned = total_burned + v_burn_amount,
        marketplace_burns = marketplace_burns + v_burn_amount,
        last_burn_at = NOW(),
        last_burn_amount = v_burn_amount,
        last_burn_source = 'MARKETPLACE',
        updated_at = NOW()
    WHERE id = 1;

    -- Record in audit log
    INSERT INTO burn_audit_log (
        user_id, transaction_id, original_amount, burn_amount, 
        net_amount, burn_percentage, source
    ) VALUES (
        p_buyer_id, v_buyer_tx_id, p_total_amount, v_burn_amount,
        v_seller_receives, v_burn_percentage * 100, 'MARKETPLACE'
    );

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'BURN_EXECUTED',
        'transaction', jsonb_build_object(
            'original_amount', p_total_amount,
            'burn_amount', v_burn_amount,
            'burn_percentage', v_burn_percentage * 100,
            'seller_receives', v_seller_receives,
            'item_id', p_item_id
        ),
        'participants', jsonb_build_object(
            'buyer', p_buyer_id,
            'buyer_tx', v_buyer_tx_id,
            'seller', p_seller_id,
            'seller_tx', v_seller_tx_id,
            'burn_tx', v_burn_tx_id
        ),
        'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_get_burn_stats
-- Returns global burn statistics for Orb 10 dashboard
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_burn_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_stats RECORD;
    v_burn_wallet_balance BIGINT;
BEGIN
    SELECT * INTO v_stats FROM global_burn_counter WHERE id = 1;
    
    SELECT balance INTO v_burn_wallet_balance 
    FROM wallets 
    WHERE id = '00000000-0000-0000-0000-000000001111';

    RETURN jsonb_build_object(
        'total_burned', COALESCE(v_stats.total_burned, 0),
        'marketplace_burns', COALESCE(v_stats.marketplace_burns, 0),
        'arcade_burns', COALESCE(v_stats.arcade_burns, 0),
        'other_burns', COALESCE(v_stats.other_burns, 0),
        'burn_wallet_balance', COALESCE(v_burn_wallet_balance, 0),
        'last_burn_at', v_stats.last_burn_at,
        'last_burn_amount', v_stats.last_burn_amount,
        'last_burn_source', v_stats.last_burn_source
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_execute_marketplace_burn TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_burn_stats TO authenticated;
GRANT SELECT ON global_burn_counter TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_execute_marketplace_burn IS '🔥 Execute marketplace transaction with 25% burn';
COMMENT ON FUNCTION fn_get_burn_stats IS '📊 Get global burn statistics for Orb 10';
