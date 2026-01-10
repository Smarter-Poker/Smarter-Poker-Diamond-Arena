-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 012
-- ATOMIC LEDGER INTEGRITY SEAL
-- ═══════════════════════════════════════════════════════════
-- MAPPING PHASE 13: ATOMIC_LEDGER_INTEGRITY
-- HARD LAW: No transaction occurs without atomic balance verification.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔒 HARD LAW CONSTRAINT: BALANCE INTEGRITY CHECK
-- Every transaction MUST have matching previous_balance → new_balance
-- ═══════════════════════════════════════════════════════════

-- Ensure the constraint exists on transactions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_atomic_balance_integrity'
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT chk_atomic_balance_integrity
        CHECK (
            (type = 'CREDIT' AND balance_after = balance_before + amount) OR
            (type = 'DEBIT' AND balance_after = balance_before - amount)
        );
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 📊 DIAMOND_LEDGER VIEW
-- The immutable audit view for all diamond movements
-- Maps previous_balance (balance_before) and new_balance (balance_after)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW diamond_ledger AS
SELECT 
    t.id AS ledger_entry_id,
    t.user_id,
    t.wallet_id,
    t.type AS transaction_type,
    t.amount,
    t.source,
    t.balance_before AS previous_balance,
    t.balance_after AS new_balance,
    -- Computed verification fields
    CASE 
        WHEN t.type = 'CREDIT' AND t.balance_after = t.balance_before + t.amount THEN TRUE
        WHEN t.type = 'DEBIT' AND t.balance_after = t.balance_before - t.amount THEN TRUE
        ELSE FALSE
    END AS balance_verified,
    t.balance_after - t.balance_before AS balance_delta,
    t.reference_id,
    t.reference_type,
    t.metadata,
    t.created_at AS transaction_timestamp,
    -- Sequence tracking for audit
    ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.created_at) AS user_tx_sequence,
    ROW_NUMBER() OVER (ORDER BY t.created_at) AS global_tx_sequence
FROM transactions t
ORDER BY t.created_at DESC;

COMMENT ON VIEW diamond_ledger IS '💎 ATOMIC LEDGER INTEGRITY - Immutable audit view with previous_balance/new_balance verification (PHASE 13)';

-- ═══════════════════════════════════════════════════════════
-- 🛡️ TRIGGER: PREVENT UNVERIFIED TRANSACTIONS
-- HARD LAW: Block any INSERT that would violate balance integrity
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_enforce_ledger_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_wallet_balance BIGINT;
BEGIN
    -- Get current wallet balance
    SELECT balance INTO v_current_wallet_balance
    FROM wallets
    WHERE id = NEW.wallet_id;

    -- HARD LAW: balance_before MUST match current wallet balance
    IF NEW.balance_before != v_current_wallet_balance THEN
        RAISE EXCEPTION 
            'LEDGER_INTEGRITY_VIOLATION: balance_before (%) does not match wallet balance (%). Transaction rejected.', 
            NEW.balance_before, v_current_wallet_balance;
    END IF;

    -- HARD LAW: balance_after MUST be mathematically correct
    IF NEW.type = 'CREDIT' AND NEW.balance_after != NEW.balance_before + NEW.amount THEN
        RAISE EXCEPTION 
            'LEDGER_INTEGRITY_VIOLATION: CREDIT balance_after (%) != balance_before (%) + amount (%). Transaction rejected.',
            NEW.balance_after, NEW.balance_before, NEW.amount;
    END IF;

    IF NEW.type = 'DEBIT' AND NEW.balance_after != NEW.balance_before - NEW.amount THEN
        RAISE EXCEPTION 
            'LEDGER_INTEGRITY_VIOLATION: DEBIT balance_after (%) != balance_before (%) - amount (%). Transaction rejected.',
            NEW.balance_after, NEW.balance_before, NEW.amount;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger (drop first to ensure idempotency)
DROP TRIGGER IF EXISTS trg_enforce_ledger_integrity ON transactions;

CREATE TRIGGER trg_enforce_ledger_integrity
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_enforce_ledger_integrity();

COMMENT ON FUNCTION fn_enforce_ledger_integrity IS '🛡️ HARD LAW ENFORCER: No transaction without atomic balance verification';

-- ═══════════════════════════════════════════════════════════
-- 📊 LEDGER INTEGRITY AUDIT FUNCTION
-- Returns integrity status for compliance checks
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_audit_ledger_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_total_transactions BIGINT;
    v_verified_count BIGINT;
    v_violation_count BIGINT;
    v_first_tx TIMESTAMPTZ;
    v_last_tx TIMESTAMPTZ;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE 
            (type = 'CREDIT' AND balance_after = balance_before + amount) OR
            (type = 'DEBIT' AND balance_after = balance_before - amount)
        ),
        COUNT(*) FILTER (WHERE 
            NOT (
                (type = 'CREDIT' AND balance_after = balance_before + amount) OR
                (type = 'DEBIT' AND balance_after = balance_before - amount)
            )
        ),
        MIN(created_at),
        MAX(created_at)
    INTO v_total_transactions, v_verified_count, v_violation_count, v_first_tx, v_last_tx
    FROM transactions;

    RETURN jsonb_build_object(
        'status', CASE WHEN v_violation_count = 0 THEN 'INTEGRITY_SEALED' ELSE 'INTEGRITY_BREACH' END,
        'total_transactions', v_total_transactions,
        'verified_count', v_verified_count,
        'violation_count', v_violation_count,
        'integrity_percentage', CASE WHEN v_total_transactions > 0 
            THEN ROUND((v_verified_count::NUMERIC / v_total_transactions) * 100, 2)
            ELSE 100 
        END,
        'first_transaction', v_first_tx,
        'last_transaction', v_last_tx,
        'audit_timestamp', NOW(),
        'hard_law', 'ATOMIC_BALANCE_VERIFICATION_ENFORCED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_audit_ledger_integrity TO authenticated;

COMMENT ON FUNCTION fn_audit_ledger_integrity IS '📊 Ledger integrity audit for compliance verification (PHASE 13)';

-- ═══════════════════════════════════════════════════════════
-- 🏛️ GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON diamond_ledger TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ PHASE 13 SEAL: ATOMIC_LEDGER_INTEGRITY_COMPLETE
-- ═══════════════════════════════════════════════════════════
