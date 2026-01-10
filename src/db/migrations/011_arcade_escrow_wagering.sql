-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 011
-- ARCADE DIAMOND WAGERING (ESCROW SYSTEM)
-- ═══════════════════════════════════════════════════════════
-- Lock diamonds in temporary vault when Arcade game starts.
-- On win: release to player.
-- On loss: move to system pool.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔒 ARCADE ESCROW VAULT TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arcade_escrow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id UUID NOT NULL UNIQUE,
    game_mode VARCHAR(50) NOT NULL,
    stake_amount BIGINT NOT NULL CHECK (stake_amount > 0),
    potential_win BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'LOCKED' 
        CHECK (status IN ('LOCKED', 'RELEASED', 'FORFEITED', 'EXPIRED', 'CANCELLED')),
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    result_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_user ON arcade_escrow(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON arcade_escrow(status);
CREATE INDEX IF NOT EXISTS idx_escrow_session ON arcade_escrow(session_id);
CREATE INDEX IF NOT EXISTS idx_escrow_expires ON arcade_escrow(expires_at) WHERE status = 'LOCKED';

COMMENT ON TABLE arcade_escrow IS '🔒 Temporary vault for arcade game stakes';

-- ═══════════════════════════════════════════════════════════
-- 🏦 SYSTEM POOL (House Pool)
-- ═══════════════════════════════════════════════════════════

-- Reserved system UUID for the house pool
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM wallets 
        WHERE user_id = '00000000-0000-0000-0000-000000000001'
    ) THEN
        INSERT INTO wallets (
            id,
            user_id, 
            balance, 
            currency, 
            current_streak, 
            longest_streak
        ) VALUES (
            '00000000-0000-0000-0000-000000002222',
            '00000000-0000-0000-0000-000000000001',
            0,
            'DIAMOND',
            0,
            0
        );
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 🔒 fn_escrow_arcade_bet
-- Lock diamonds when arcade game starts
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_escrow_arcade_bet(
    p_user_id UUID,
    p_session_id UUID,
    p_stake_amount BIGINT,
    p_game_mode VARCHAR(50),
    p_potential_multiplier NUMERIC DEFAULT 2.0,
    p_expiry_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_escrow_id UUID;
    v_potential_win BIGINT;
    v_tx_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- VALIDATION
    -- ═══════════════════════════════════════════════════════
    IF p_stake_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_STAKE',
            'message', 'Stake amount must be positive'
        );
    END IF;

    -- Check for existing active escrow for this session
    IF EXISTS (SELECT 1 FROM arcade_escrow WHERE session_id = p_session_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'DUPLICATE_SESSION',
            'message', 'This session already has an active escrow'
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- ACQUIRE WALLET WITH LOCK
    -- ═══════════════════════════════════════════════════════
    BEGIN
        SELECT * INTO v_wallet
        FROM wallets
        WHERE user_id = p_user_id
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'WALLET_LOCKED',
                'status', 'ESCROW_RETRY'
            );
    END;

    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WALLET_NOT_FOUND'
        );
    END IF;

    IF v_wallet.balance < p_stake_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_FUNDS',
            'current_balance', v_wallet.balance,
            'required', p_stake_amount,
            'shortfall', p_stake_amount - v_wallet.balance
        );
    END IF;

    -- Calculate potential win
    v_potential_win := FLOOR(p_stake_amount * p_potential_multiplier);

    -- ═══════════════════════════════════════════════════════
    -- LOCK DIAMONDS (DEBIT TO ESCROW)
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET balance = balance - p_stake_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Record debit transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        p_user_id, v_wallet.id, 'DEBIT', p_stake_amount, 'ARCADE_ESCROW',
        v_wallet.balance, v_wallet.balance - p_stake_amount,
        p_session_id, 'ARCADE_SESSION',
        jsonb_build_object('game_mode', p_game_mode, 'escrow_status', 'LOCKED')
    ) RETURNING id INTO v_tx_id;

    -- Create escrow record
    INSERT INTO arcade_escrow (
        user_id, session_id, game_mode, stake_amount, potential_win,
        status, expires_at
    ) VALUES (
        p_user_id, p_session_id, p_game_mode, p_stake_amount, v_potential_win,
        'LOCKED', NOW() + (p_expiry_minutes || ' minutes')::INTERVAL
    ) RETURNING id INTO v_escrow_id;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'ESCROW_LOCKED',
        'escrow', jsonb_build_object(
            'escrow_id', v_escrow_id,
            'session_id', p_session_id,
            'stake_amount', p_stake_amount,
            'potential_win', v_potential_win,
            'game_mode', p_game_mode,
            'expires_at', NOW() + (p_expiry_minutes || ' minutes')::INTERVAL
        ),
        'wallet', jsonb_build_object(
            'balance_before', v_wallet.balance,
            'balance_after', v_wallet.balance - p_stake_amount,
            'transaction_id', v_tx_id
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_FAILED',
            'message', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🏆 fn_resolve_arcade_win
-- Release escrow + winnings to player on win
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_resolve_arcade_win(
    p_session_id UUID,
    p_win_amount BIGINT,
    p_result_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escrow RECORD;
    v_wallet RECORD;
    v_total_payout BIGINT;
    v_tx_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GET ESCROW RECORD
    -- ═══════════════════════════════════════════════════════
    SELECT * INTO v_escrow
    FROM arcade_escrow
    WHERE session_id = p_session_id
    FOR UPDATE;

    IF v_escrow IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_NOT_FOUND'
        );
    END IF;

    IF v_escrow.status != 'LOCKED' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_ALREADY_RESOLVED',
            'current_status', v_escrow.status
        );
    END IF;

    -- Get player wallet
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = v_escrow.user_id
    FOR UPDATE;

    -- Total payout: original stake + winnings
    v_total_payout := v_escrow.stake_amount + p_win_amount;

    -- ═══════════════════════════════════════════════════════
    -- RELEASE TO PLAYER
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET balance = balance + v_total_payout,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Record credit transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        v_escrow.user_id, v_wallet.id, 'CREDIT', v_total_payout, 'ARCADE_WIN',
        v_wallet.balance, v_wallet.balance + v_total_payout,
        p_session_id, 'ARCADE_SESSION',
        jsonb_build_object(
            'original_stake', v_escrow.stake_amount,
            'win_amount', p_win_amount,
            'game_mode', v_escrow.game_mode,
            'result', p_result_data
        )
    ) RETURNING id INTO v_tx_id;

    -- Update escrow status
    UPDATE arcade_escrow
    SET status = 'RELEASED',
        resolved_at = NOW(),
        result_data = p_result_data || jsonb_build_object('outcome', 'WIN', 'win_amount', p_win_amount)
    WHERE id = v_escrow.id;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'WIN_RELEASED',
        'payout', jsonb_build_object(
            'original_stake', v_escrow.stake_amount,
            'win_amount', p_win_amount,
            'total_payout', v_total_payout
        ),
        'wallet', jsonb_build_object(
            'new_balance', v_wallet.balance + v_total_payout,
            'transaction_id', v_tx_id
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'WIN_RESOLVE_FAILED',
            'message', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 💔 fn_resolve_arcade_loss
-- Forfeit escrow to system pool on loss
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_resolve_arcade_loss(
    p_session_id UUID,
    p_result_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escrow RECORD;
    v_system_pool_id CONSTANT UUID := '00000000-0000-0000-0000-000000002222';
    v_tx_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- GET ESCROW RECORD
    -- ═══════════════════════════════════════════════════════
    SELECT * INTO v_escrow
    FROM arcade_escrow
    WHERE session_id = p_session_id
    FOR UPDATE;

    IF v_escrow IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_NOT_FOUND'
        );
    END IF;

    IF v_escrow.status != 'LOCKED' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_ALREADY_RESOLVED',
            'current_status', v_escrow.status
        );
    END IF;

    -- ═══════════════════════════════════════════════════════
    -- TRANSFER TO SYSTEM POOL
    -- ═══════════════════════════════════════════════════════
    UPDATE wallets
    SET balance = balance + v_escrow.stake_amount,
        updated_at = NOW()
    WHERE id = v_system_pool_id;

    -- Record transfer to system pool
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        '00000000-0000-0000-0000-000000000001', v_system_pool_id, 'CREDIT', 
        v_escrow.stake_amount, 'ARCADE_LOSS_POOL',
        (SELECT balance - v_escrow.stake_amount FROM wallets WHERE id = v_system_pool_id),
        (SELECT balance FROM wallets WHERE id = v_system_pool_id),
        p_session_id, 'ARCADE_SESSION',
        jsonb_build_object(
            'from_user', v_escrow.user_id,
            'game_mode', v_escrow.game_mode,
            'result', p_result_data
        )
    ) RETURNING id INTO v_tx_id;

    -- Update escrow status
    UPDATE arcade_escrow
    SET status = 'FORFEITED',
        resolved_at = NOW(),
        result_data = p_result_data || jsonb_build_object('outcome', 'LOSS')
    WHERE id = v_escrow.id;

    -- Update global burn counter (arcade burns)
    UPDATE global_burn_counter
    SET arcade_burns = arcade_burns + v_escrow.stake_amount,
        total_burned = total_burned + v_escrow.stake_amount,
        last_burn_at = NOW(),
        last_burn_amount = v_escrow.stake_amount,
        last_burn_source = 'ARCADE_LOSS',
        updated_at = NOW()
    WHERE id = 1;

    -- ═══════════════════════════════════════════════════════
    -- RETURN SUCCESS
    -- ═══════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'LOSS_FORFEITED',
        'forfeited', jsonb_build_object(
            'stake_amount', v_escrow.stake_amount,
            'to_pool', 'SYSTEM_POOL',
            'user_id', v_escrow.user_id,
            'game_mode', v_escrow.game_mode
        ),
        'transaction_id', v_tx_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'LOSS_RESOLVE_FAILED',
            'message', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ❌ fn_cancel_arcade_escrow
-- Cancel and refund escrow (admin or timeout)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_cancel_arcade_escrow(
    p_session_id UUID,
    p_reason VARCHAR(100) DEFAULT 'USER_CANCELLED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escrow RECORD;
    v_wallet RECORD;
    v_tx_id UUID;
BEGIN
    SELECT * INTO v_escrow
    FROM arcade_escrow
    WHERE session_id = p_session_id
    FOR UPDATE;

    IF v_escrow IS NULL OR v_escrow.status != 'LOCKED' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ESCROW_NOT_CANCELLABLE'
        );
    END IF;

    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = v_escrow.user_id
    FOR UPDATE;

    -- Refund to player
    UPDATE wallets
    SET balance = balance + v_escrow.stake_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_id, reference_type, metadata
    ) VALUES (
        v_escrow.user_id, v_wallet.id, 'CREDIT', v_escrow.stake_amount, 'ARCADE_REFUND',
        v_wallet.balance, v_wallet.balance + v_escrow.stake_amount,
        p_session_id, 'ARCADE_SESSION',
        jsonb_build_object('reason', p_reason, 'game_mode', v_escrow.game_mode)
    ) RETURNING id INTO v_tx_id;

    UPDATE arcade_escrow
    SET status = 'CANCELLED',
        resolved_at = NOW(),
        result_data = jsonb_build_object('outcome', 'CANCELLED', 'reason', p_reason)
    WHERE id = v_escrow.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'ESCROW_CANCELLED',
        'refunded', v_escrow.stake_amount,
        'new_balance', v_wallet.balance + v_escrow.stake_amount,
        'transaction_id', v_tx_id
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⏰ fn_expire_stale_escrows
-- Auto-expire escrows past expiry time (called by pg_cron)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_expire_stale_escrows()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expired_count INTEGER := 0;
    v_refunded_total BIGINT := 0;
    v_escrow RECORD;
BEGIN
    FOR v_escrow IN
        SELECT * FROM arcade_escrow
        WHERE status = 'LOCKED' AND expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM fn_cancel_arcade_escrow(v_escrow.session_id, 'EXPIRED');
        v_expired_count := v_expired_count + 1;
        v_refunded_total := v_refunded_total + v_escrow.stake_amount;
    END LOOP;

    RETURN jsonb_build_object(
        'expired_count', v_expired_count,
        'refunded_total', v_refunded_total,
        'run_at', NOW()
    );
END;
$$;

-- Schedule escrow expiry job (every 5 minutes)
SELECT cron.schedule(
    'expire_stale_escrows',
    '*/5 * * * *',
    $$SELECT fn_expire_stale_escrows()$$
);

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION fn_escrow_arcade_bet TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resolve_arcade_win TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resolve_arcade_loss TO authenticated;
GRANT EXECUTE ON FUNCTION fn_cancel_arcade_escrow TO authenticated;
GRANT SELECT ON arcade_escrow TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_escrow_arcade_bet IS '🔒 Lock diamonds in escrow when arcade game starts';
COMMENT ON FUNCTION fn_resolve_arcade_win IS '🏆 Release escrow + winnings on player win';
COMMENT ON FUNCTION fn_resolve_arcade_loss IS '💔 Forfeit escrow to system pool on loss';
COMMENT ON FUNCTION fn_cancel_arcade_escrow IS '❌ Cancel and refund escrow';
COMMENT ON FUNCTION fn_expire_stale_escrows IS '⏰ Auto-expire stale escrows (pg_cron)';
