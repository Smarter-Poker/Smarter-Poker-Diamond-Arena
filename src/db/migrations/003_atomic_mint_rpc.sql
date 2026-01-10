-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 003
-- ATOMIC MINTING RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════
-- Execute directly on database metal — zero network latency.
-- All operations are ACID-compliant within a single transaction.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🏦 CORE: ATOMIC DIAMOND MINTING
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_diamonds_atomic(
    p_user_id UUID,
    p_amount BIGINT,
    p_source VARCHAR(50) DEFAULT 'SESSION_REWARD',
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
    v_wallet_id UUID;
    v_balance_before BIGINT;
    v_balance_after BIGINT;
    v_transaction_id UUID;
    v_wallet_created BOOLEAN := FALSE;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'message', 'Amount must be positive'
        );
    END IF;

    IF p_source NOT IN (
        'DAILY_CLAIM', 'SESSION_REWARD', 'ARCADE_WIN', 'STORE_REFUND',
        'ADMIN_GRANT', 'TRANSFER_IN', 'BONUS'
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_SOURCE',
            'message', 'Source must be a valid CREDIT type'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- GET OR CREATE WALLET (with row lock)
    -- ═══════════════════════════════════════════════════════
    SELECT id, balance INTO v_wallet_id, v_balance_before
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Create wallet if not exists
    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance, currency, current_streak, longest_streak)
        VALUES (p_user_id, 0, 'DIAMOND', 0, 0)
        RETURNING id, balance INTO v_wallet_id, v_balance_before;
        v_wallet_created := TRUE;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- EXECUTE ATOMIC MINT
    -- ═══════════════════════════════════════════════════════
    v_balance_after := v_balance_before + p_amount;

    -- Update wallet balance
    UPDATE wallets
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create transaction record
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        reference_id, reference_type,
        balance_before, balance_after, metadata
    ) VALUES (
        p_user_id, v_wallet_id, 'CREDIT', p_amount, p_source,
        p_reference_id, p_reference_type,
        v_balance_before, v_balance_after, p_metadata
    )
    RETURNING id INTO v_transaction_id;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'CREDIT',
        'amount', p_amount,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'wallet_id', v_wallet_id,
        'transaction_id', v_transaction_id,
        'wallet_created', v_wallet_created
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'MINT_FAILED',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💸 CORE: ATOMIC DIAMOND BURNING (DEBIT)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_burn_diamonds_atomic(
    p_user_id UUID,
    p_amount BIGINT,
    p_source VARCHAR(50) DEFAULT 'ARCADE_STAKE',
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
    v_wallet_id UUID;
    v_balance_before BIGINT;
    v_balance_after BIGINT;
    v_transaction_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'message', 'Amount must be positive'
        );
    END IF;

    IF p_source NOT IN (
        'ARCADE_STAKE', 'STORE_PURCHASE', 'ADMIN_REVOKE', 'TRANSFER_OUT'
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_SOURCE',
            'message', 'Source must be a valid DEBIT type'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- GET WALLET WITH LOCK
    -- ═══════════════════════════════════════════════════════
    SELECT id, balance INTO v_wallet_id, v_balance_before
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Wallet must exist for debit
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_NOT_FOUND',
            'message', 'User wallet does not exist'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- INSUFFICIENT FUNDS CHECK
    -- ═══════════════════════════════════════════════════════
    IF v_balance_before < p_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'message', format('Balance %s is less than %s', v_balance_before, p_amount),
            'current_balance', v_balance_before,
            'required_amount', p_amount,
            'shortfall', p_amount - v_balance_before
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- EXECUTE ATOMIC BURN
    -- ═══════════════════════════════════════════════════════
    v_balance_after := v_balance_before - p_amount;

    -- Update wallet balance
    UPDATE wallets
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create transaction record
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        reference_id, reference_type,
        balance_before, balance_after, metadata
    ) VALUES (
        p_user_id, v_wallet_id, 'DEBIT', p_amount, p_source,
        p_reference_id, p_reference_type,
        v_balance_before, v_balance_after, p_metadata
    )
    RETURNING id INTO v_transaction_id;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'DEBIT',
        'amount', p_amount,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'wallet_id', v_wallet_id,
        'transaction_id', v_transaction_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_FAILED',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🔁 CORE: ATOMIC P2P TRANSFER
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_transfer_diamonds_atomic(
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_amount BIGINT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_burn_result JSONB;
    v_mint_result JSONB;
BEGIN
    -- Prevent self-transfer
    IF p_from_user_id = p_to_user_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SELF_TRANSFER',
            'message', 'Cannot transfer to yourself'
        );
    END IF;

    -- Debit sender
    v_burn_result := fn_burn_diamonds_atomic(
        p_from_user_id,
        p_amount,
        'TRANSFER_OUT',
        NULL,
        'TRANSFER',
        p_metadata || jsonb_build_object('recipient_id', p_to_user_id)
    );

    IF NOT (v_burn_result->>'success')::BOOLEAN THEN
        RETURN v_burn_result;
    END IF;

    -- Credit recipient
    v_mint_result := fn_mint_diamonds_atomic(
        p_to_user_id,
        p_amount,
        'TRANSFER_IN',
        (v_burn_result->>'transaction_id')::UUID,
        'TRANSFER',
        p_metadata || jsonb_build_object('sender_id', p_from_user_id)
    );

    IF NOT (v_mint_result->>'success')::BOOLEAN THEN
        -- This shouldn't happen, but if it does, we have a problem
        -- The burn already succeeded, so we'd need compensation logic
        RAISE EXCEPTION 'Transfer credit failed after successful debit: %', v_mint_result->>'message';
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'amount', p_amount,
        'from_user', p_from_user_id,
        'to_user', p_to_user_id,
        'debit_transaction', v_burn_result->>'transaction_id',
        'credit_transaction', v_mint_result->>'transaction_id',
        'sender_balance', v_burn_result->>'balance_after',
        'recipient_balance', v_mint_result->>'balance_after'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'TRANSFER_FAILED',
            'message', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS (Allow Supabase client to call these functions)
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_mint_diamonds_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION fn_burn_diamonds_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION fn_transfer_diamonds_atomic TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_mint_diamonds_atomic IS '💎 Atomic diamond minting - credits diamonds with full transaction logging';
COMMENT ON FUNCTION fn_burn_diamonds_atomic IS '💸 Atomic diamond burning - debits diamonds with insufficient funds protection';
COMMENT ON FUNCTION fn_transfer_diamonds_atomic IS '🔁 Atomic P2P transfer - moves diamonds between users in single transaction';
