-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 007
-- SECURE MINTING RPC (STREAMLINED INTERFACE)
-- ═══════════════════════════════════════════════════════════
-- Optimized for direct database-level minting.
-- Zero network crawl — atomic execution on Postgres metal.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_mint_diamonds_secure
-- Simplified interface for high-speed minting operations.
-- Parameters match the ECONOMY_FIX specification.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_diamonds_secure(
    target_user UUID,
    mint_amount BIGINT,
    mint_source VARCHAR(50) DEFAULT 'SESSION_REWARD',
    mint_metadata JSONB DEFAULT '{}'
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
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_execution_ms NUMERIC;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION (Fast-fail for invalid inputs)
    -- ═══════════════════════════════════════════════════════
    IF target_user IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_USER',
            'message', 'target_user cannot be null',
            'status', 'ATOMIC_FAILED'
        );
    END IF;

    IF mint_amount IS NULL OR mint_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'message', 'mint_amount must be a positive integer',
            'status', 'ATOMIC_FAILED'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE WALLET WITH EXCLUSIVE LOCK
    -- FOR UPDATE NOWAIT prevents deadlocks
    -- ═══════════════════════════════════════════════════════
    BEGIN
        SELECT id, balance INTO v_wallet_id, v_balance_before
        FROM wallets
        WHERE user_id = target_user
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'WALLET_LOCKED',
                'message', 'Wallet is currently being modified by another transaction',
                'status', 'ATOMIC_RETRY'
            );
    END;

    -- ═══════════════════════════════════════════════════════
    -- CREATE WALLET IF NOT EXISTS (First-time users)
    -- ═══════════════════════════════════════════════════════
    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (
            user_id, 
            balance, 
            currency, 
            current_streak, 
            longest_streak
        )
        VALUES (
            target_user, 
            0, 
            'DIAMOND', 
            0, 
            0
        )
        RETURNING id, balance INTO v_wallet_id, v_balance_before;
        v_wallet_created := TRUE;
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- EXECUTE ATOMIC MINT
    -- ═══════════════════════════════════════════════════════
    v_balance_after := v_balance_before + mint_amount;

    -- Single atomic update
    UPDATE wallets
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Append to immutable transaction ledger
    INSERT INTO transactions (
        user_id,
        wallet_id,
        type,
        amount,
        source,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        target_user,
        v_wallet_id,
        'CREDIT',
        mint_amount,
        mint_source,
        v_balance_before,
        v_balance_after,
        mint_metadata || jsonb_build_object('atomic', TRUE)
    )
    RETURNING id INTO v_transaction_id;

    -- ═══════════════════════════════════════════════════════
    -- CALCULATE EXECUTION TIME
    -- ═══════════════════════════════════════════════════════
    v_execution_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time));

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS (ATOMIC_SUCCESS status)
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'ATOMIC_SUCCESS',
        'data', jsonb_build_object(
            'user_id', target_user,
            'amount', mint_amount,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'wallet_id', v_wallet_id,
            'transaction_id', v_transaction_id,
            'wallet_created', v_wallet_created
        ),
        'meta', jsonb_build_object(
            'execution_ms', v_execution_ms,
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'MINT_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE,
            'status', 'ATOMIC_FAILED'
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_burn_diamonds_secure
-- Matching burn function for arcade stakes / purchases.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_burn_diamonds_secure(
    target_user UUID,
    burn_amount BIGINT,
    burn_source VARCHAR(50) DEFAULT 'ARCADE_STAKE',
    burn_metadata JSONB DEFAULT '{}'
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
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_execution_ms NUMERIC;
BEGIN
    -- Validation
    IF target_user IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'NULL_USER',
            'status', 'ATOMIC_FAILED'
        );
    END IF;

    IF burn_amount IS NULL OR burn_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_AMOUNT',
            'status', 'ATOMIC_FAILED'
        );
    END IF;

    -- Acquire wallet lock
    BEGIN
        SELECT id, balance INTO v_wallet_id, v_balance_before
        FROM wallets
        WHERE user_id = target_user
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'WALLET_LOCKED',
                'status', 'ATOMIC_RETRY'
            );
    END;

    -- Wallet must exist for burn
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_NOT_FOUND',
            'message', 'User has no wallet',
            'status', 'ATOMIC_FAILED'
        );
    END IF;

    -- Insufficient funds check
    IF v_balance_before < burn_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'status', 'ATOMIC_FAILED',
            'data', jsonb_build_object(
                'current_balance', v_balance_before,
                'required', burn_amount,
                'shortfall', burn_amount - v_balance_before
            )
        );
    END IF;

    -- Execute burn
    v_balance_after := v_balance_before - burn_amount;

    UPDATE wallets
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO transactions (
        user_id,
        wallet_id,
        type,
        amount,
        source,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        target_user,
        v_wallet_id,
        'DEBIT',
        burn_amount,
        burn_source,
        v_balance_before,
        v_balance_after,
        burn_metadata || jsonb_build_object('atomic', TRUE)
    )
    RETURNING id INTO v_transaction_id;

    v_execution_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time));

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'ATOMIC_SUCCESS',
        'data', jsonb_build_object(
            'user_id', target_user,
            'amount', burn_amount,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'wallet_id', v_wallet_id,
            'transaction_id', v_transaction_id
        ),
        'meta', jsonb_build_object(
            'execution_ms', v_execution_ms,
            'timestamp', NOW()
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BURN_EXCEPTION',
            'message', SQLERRM,
            'code', SQLSTATE,
            'status', 'ATOMIC_FAILED'
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ fn_get_balance_fast
-- Ultra-fast balance check (no joins, direct read)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_balance_fast(target_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_balance BIGINT;
    v_streak INTEGER;
BEGIN
    SELECT balance, current_streak 
    INTO v_balance, v_streak
    FROM wallets
    WHERE user_id = target_user;

    IF v_balance IS NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'balance', 0,
            'streak', 0,
            'exists', FALSE
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'balance', v_balance,
        'streak', v_streak,
        'exists', TRUE
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_mint_diamonds_secure TO authenticated;
GRANT EXECUTE ON FUNCTION fn_burn_diamonds_secure TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_balance_fast TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_mint_diamonds_secure IS '⚡ Secure atomic diamond minting - database metal execution';
COMMENT ON FUNCTION fn_burn_diamonds_secure IS '⚡ Secure atomic diamond burning - database metal execution';
COMMENT ON FUNCTION fn_get_balance_fast IS '⚡ Fast balance lookup - O(1) direct read';
