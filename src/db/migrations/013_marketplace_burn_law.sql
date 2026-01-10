-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 013
-- 25% MARKETPLACE BURN LAW
-- ═══════════════════════════════════════════════════════════
-- MAPPING PHASE 14: 25_PERCENT_MARKETPLACE_BURN_LAW
-- HARD LAW: On item sale, deduct 25% fee.
-- LOGIC: 75% to Seller, 25% to BURN_VAULT (non-recoverable dead address).
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_execute_burn_transfer (CANONICAL ALIAS)
-- The official marketplace burn transfer function
-- Wraps fn_execute_marketplace_burn with standardized interface
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_execute_burn_transfer(
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
    -- HARD LAW CONSTANTS
    c_burn_rate CONSTANT NUMERIC := 0.25;          -- 25% to BURN_VAULT
    c_seller_rate CONSTANT NUMERIC := 0.75;        -- 75% to Seller
    c_burn_vault_user CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
    c_burn_vault_wallet CONSTANT UUID := '00000000-0000-0000-0000-000000001111';
    
    -- Calculated amounts
    v_burn_amount BIGINT;
    v_seller_receives BIGINT;
    
    -- Wallet records
    v_buyer_wallet RECORD;
    v_seller_wallet RECORD;
    
    -- Transaction IDs
    v_buyer_tx_id UUID;
    v_seller_tx_id UUID;
    v_burn_tx_id UUID;
    
    -- Timing
    v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- 🔒 VALIDATION
    -- ═══════════════════════════════════════════════════════
    
    IF p_seller_id IS NULL OR p_buyer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_PARTICIPANT',
            'message', 'Both seller_id and buyer_id are required',
            'hard_law', '25_PERCENT_BURN_ENFORCED'
        );
    END IF;

    IF p_seller_id = p_buyer_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SELF_TRANSACTION_BLOCKED',
            'message', 'Cannot buy from yourself'
        );
    END IF;

    IF p_sale_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_SALE_AMOUNT',
            'message', 'Sale amount must be positive'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- 🧮 CALCULATE BURN SPLIT (HARD LAW: 25/75)
    -- ═══════════════════════════════════════════════════════
    
    v_burn_amount := FLOOR(p_sale_amount * c_burn_rate);
    v_seller_receives := p_sale_amount - v_burn_amount;
    
    -- Minimum burn of 1 for any taxable transaction
    IF v_burn_amount < 1 AND p_sale_amount >= 4 THEN
        v_burn_amount := 1;
        v_seller_receives := p_sale_amount - 1;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- 🔐 ACQUIRE BUYER WALLET (FOR UPDATE NOWAIT)
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
                'status', 'RETRY_REQUIRED'
            );
    END;

    IF v_buyer_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BUYER_WALLET_NOT_FOUND',
            'message', 'Buyer has no wallet'
        );
    END IF;

    IF v_buyer_wallet.balance < p_sale_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'current_balance', v_buyer_wallet.balance,
            'required_amount', p_sale_amount,
            'shortfall', p_sale_amount - v_buyer_wallet.balance
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- 🔐 ACQUIRE/CREATE SELLER WALLET
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
    -- 💸 EXECUTE TRIPLE ATOMIC TRANSACTION
    -- 1. DEBIT Buyer (full amount)
    -- 2. CREDIT Seller (75%)
    -- 3. CREDIT Burn Vault (25%)
    -- ═══════════════════════════════════════════════════════

    -- [1] DEBIT BUYER (Full Sale Amount)
    UPDATE wallets
    SET balance = balance - p_sale_amount,
        updated_at = NOW()
    WHERE id = v_buyer_wallet.id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_buyer_id, v_buyer_wallet.id, 'DEBIT', p_sale_amount, 'STORE_PURCHASE',
        v_buyer_wallet.balance, v_buyer_wallet.balance - p_sale_amount,
        p_item_id, p_item_type,
        jsonb_build_object(
            'burn_amount', v_burn_amount,
            'seller_receives', v_seller_receives,
            'burn_rate', c_burn_rate,
            'hard_law', '25_PERCENT_BURN'
        ) || p_metadata
    ) RETURNING id INTO v_buyer_tx_id;

    -- [2] CREDIT SELLER (75% Net Amount)
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
        jsonb_build_object(
            'original_sale', p_sale_amount,
            'burn_deducted', v_burn_amount,
            'net_rate', c_seller_rate,
            'hard_law', '75_PERCENT_TO_SELLER'
        )
    ) RETURNING id INTO v_seller_tx_id;

    -- [3] CREDIT BURN VAULT (25% Tax)
    UPDATE wallets
    SET balance = balance + v_burn_amount,
        updated_at = NOW()
    WHERE id = c_burn_vault_wallet;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, metadata
    ) VALUES (
        c_burn_vault_user, c_burn_vault_wallet, 'CREDIT', v_burn_amount, 'MARKETPLACE_BURN',
        (SELECT balance - v_burn_amount FROM wallets WHERE id = c_burn_vault_wallet),
        (SELECT balance FROM wallets WHERE id = c_burn_vault_wallet),
        jsonb_build_object(
            'source_tx', v_buyer_tx_id,
            'seller', p_seller_id,
            'buyer', p_buyer_id,
            'original_sale', p_sale_amount,
            'hard_law', '25_PERCENT_BURNED'
        )
    ) RETURNING id INTO v_burn_tx_id;

    -- ═══════════════════════════════════════════════════════
    -- 📊 UPDATE GLOBAL BURN COUNTER
    -- ═══════════════════════════════════════════════════════
    
    UPDATE global_burn_counter
    SET total_burned = total_burned + v_burn_amount,
        marketplace_burns = marketplace_burns + v_burn_amount,
        last_burn_at = NOW(),
        last_burn_amount = v_burn_amount,
        last_burn_source = 'MARKETPLACE_BURN_LAW',
        updated_at = NOW()
    WHERE id = 1;

    -- Record in burn audit log
    INSERT INTO burn_audit_log (
        user_id, transaction_id, original_amount, 
        burn_amount, net_amount, burn_percentage, source
    ) VALUES (
        p_buyer_id, v_buyer_tx_id, p_sale_amount,
        v_burn_amount, v_seller_receives, c_burn_rate * 100, 'MARKETPLACE_BURN_LAW'
    );

    -- ═══════════════════════════════════════════════════════
    -- ✅ RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'BURN_TRANSFER_EXECUTED',
        'hard_law', '25_PERCENT_MARKETPLACE_BURN',
        'split', jsonb_build_object(
            'original_sale', p_sale_amount,
            'seller_receives', v_seller_receives,
            'seller_percentage', c_seller_rate * 100,
            'burn_amount', v_burn_amount,
            'burn_percentage', c_burn_rate * 100,
            'burn_vault', c_burn_vault_user
        ),
        'transactions', jsonb_build_object(
            'buyer_debit', v_buyer_tx_id,
            'seller_credit', v_seller_tx_id,
            'burn_credit', v_burn_tx_id
        ),
        'participants', jsonb_build_object(
            'buyer', p_buyer_id,
            'seller', p_seller_id,
            'item_id', p_item_id
        ),
        'execution_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_TRANSFER_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_execute_burn_transfer TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_execute_burn_transfer IS '🔥 HARD LAW: 25% Marketplace Burn Transfer - 75% to Seller, 25% to BURN_VAULT (PHASE 14)';

-- ═══════════════════════════════════════════════════════════
-- ✅ PHASE 14 SEAL: 25_PERCENT_MARKETPLACE_BURN_LAW_COMPLETE
-- ═══════════════════════════════════════════════════════════
