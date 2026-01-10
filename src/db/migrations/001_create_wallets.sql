-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 001
-- CREATE WALLETS TABLE
-- ═══════════════════════════════════════════════════════════
-- Orb #7 (Arcade) | Orb #10 (Marketplace)
-- The sovereign ledger for virtual currency balances.
-- ═══════════════════════════════════════════════════════════

-- Drop existing table if exists (development only)
-- DROP TABLE IF EXISTS wallets CASCADE;

CREATE TABLE IF NOT EXISTS wallets (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User Reference (links to profiles table)
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Balance (stored as bigint to avoid floating point issues)
    -- 1 unit = 1 Diamond (no decimals for virtual currency)
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    
    -- Currency Type (future-proofing for multi-currency)
    currency VARCHAR(10) NOT NULL DEFAULT 'DIAMOND',
    
    -- Streak Tracking
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
    last_claim TIMESTAMPTZ,
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 📊 INDEXES
-- ═══════════════════════════════════════════════════════════

-- Fast lookup by user_id (already unique, but explicit index helps)
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Query by last_claim for streak maintenance jobs
CREATE INDEX IF NOT EXISTS idx_wallets_last_claim ON wallets(last_claim);

-- Currency type for multi-currency queries
CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency);

-- ═══════════════════════════════════════════════════════════
-- 🔄 TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-update timestamp on modification
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wallet_updated ON wallets;
CREATE TRIGGER trigger_wallet_updated
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_timestamp();

-- ═══════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Users can only view their own wallet
CREATE POLICY wallets_select_own ON wallets
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only update their own wallet (balance changes via functions only)
CREATE POLICY wallets_update_own ON wallets
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Insert only via authenticated users
CREATE POLICY wallets_insert_own ON wallets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 💼 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON TABLE wallets IS '💎 Diamond Wallet - Stores virtual currency balance and streak data for each user';
COMMENT ON COLUMN wallets.balance IS 'Current diamond balance (1 unit = 1 Diamond, stored as bigint)';
COMMENT ON COLUMN wallets.current_streak IS 'Active consecutive daily login streak';
COMMENT ON COLUMN wallets.longest_streak IS 'All-time longest streak achieved by this user';
COMMENT ON COLUMN wallets.last_claim IS 'Timestamp of most recent daily reward claim';
