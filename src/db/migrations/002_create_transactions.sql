-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 002
-- CREATE TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════
-- The immutable ledger for all diamond movements.
-- Every credit and debit is recorded for audit compliance.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transactions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Wallet Reference
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    
    -- Transaction Details
    type VARCHAR(10) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    
    -- Source tracking (which system generated this transaction)
    source VARCHAR(50) NOT NULL,
    -- Valid sources:
    -- 'DAILY_CLAIM'      - Daily login reward
    -- 'SESSION_REWARD'   - Training session completion
    -- 'ARCADE_WIN'       - Diamond Arcade payout
    -- 'ARCADE_STAKE'     - Diamond Arcade entry fee
    -- 'STORE_PURCHASE'   - Marketplace purchase
    -- 'STORE_REFUND'     - Marketplace refund
    -- 'ADMIN_GRANT'      - Administrative grant
    -- 'ADMIN_REVOKE'     - Administrative revocation
    -- 'TRANSFER_IN'      - P2P transfer received
    -- 'TRANSFER_OUT'     - P2P transfer sent
    -- 'BONUS'            - Promotional bonus
    
    -- Reference to external entity (session_id, order_id, etc.)
    reference_id UUID,
    reference_type VARCHAR(30),
    
    -- Running balance snapshot (for reconciliation)
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    
    -- Metadata (JSON for extensibility)
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: balance_after = balance_before ± amount
    CONSTRAINT valid_balance_change CHECK (
        (type = 'CREDIT' AND balance_after = balance_before + amount) OR
        (type = 'DEBIT' AND balance_after = balance_before - amount)
    )
);

-- ═══════════════════════════════════════════════════════════
-- 📊 INDEXES
-- ═══════════════════════════════════════════════════════════

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Fast lookup by wallet
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);

-- Query by source type
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

-- Query by type
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Time-based queries (for history and analytics)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Reference lookups
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_id, reference_type);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
    ON transactions(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY transactions_select_own ON transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Transactions are append-only (no updates allowed)
-- INSERT is handled by server-side functions with elevated privileges

-- ═══════════════════════════════════════════════════════════
-- 💼 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON TABLE transactions IS '📒 Transaction Ledger - Immutable record of all diamond movements';
COMMENT ON COLUMN transactions.type IS 'CREDIT = diamonds added, DEBIT = diamonds removed';
COMMENT ON COLUMN transactions.source IS 'System or action that triggered this transaction';
COMMENT ON COLUMN transactions.reference_id IS 'Link to related entity (session, order, transfer, etc.)';
COMMENT ON COLUMN transactions.balance_before IS 'Wallet balance snapshot before this transaction';
COMMENT ON COLUMN transactions.balance_after IS 'Wallet balance snapshot after this transaction';
COMMENT ON COLUMN transactions.metadata IS 'Extensible JSON field for additional context';

-- ═══════════════════════════════════════════════════════════
-- 📋 TRANSACTION SOURCE REFERENCE TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transaction_sources (
    code VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    default_type VARCHAR(10) NOT NULL CHECK (default_type IN ('CREDIT', 'DEBIT')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO transaction_sources (code, description, default_type) VALUES
    ('DAILY_CLAIM', 'Daily login reward minting', 'CREDIT'),
    ('SESSION_REWARD', 'Training session completion reward', 'CREDIT'),
    ('ARCADE_WIN', 'Diamond Arcade payout', 'CREDIT'),
    ('ARCADE_STAKE', 'Diamond Arcade entry stake', 'DEBIT'),
    ('STORE_PURCHASE', 'Marketplace item purchase', 'DEBIT'),
    ('STORE_REFUND', 'Marketplace refund', 'CREDIT'),
    ('ADMIN_GRANT', 'Administrative diamond grant', 'CREDIT'),
    ('ADMIN_REVOKE', 'Administrative diamond revocation', 'DEBIT'),
    ('TRANSFER_IN', 'Peer-to-peer transfer received', 'CREDIT'),
    ('TRANSFER_OUT', 'Peer-to-peer transfer sent', 'DEBIT'),
    ('BONUS', 'Promotional or streak bonus', 'CREDIT')
ON CONFLICT (code) DO NOTHING;
