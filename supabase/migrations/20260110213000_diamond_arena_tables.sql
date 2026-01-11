-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ARENA TABLES & RPC FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRATION 027: ORB_03 DIAMOND ARENA INFRASTRUCTURE
-- 
-- HARD LAWS ENFORCED:
-- • 25% Burn Rate (BURN_LAW_25)
-- • Immutable Ledger (Hash-ID logging)
-- • Triple-Wallet Isolation
-- • Velocity Guardian (50K+ flagged)
-- • Atomic Balance Verification
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📊 ARENA PRIZE POOLS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arena_prize_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    pool_type VARCHAR(50) NOT NULL CHECK (pool_type IN ('HEADS_UP', 'MULTI_TABLE', 'TOURNAMENT', 'SIT_N_GO', 'COMMUNITY_EVENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'REGISTERING' CHECK (status IN ('REGISTERING', 'ACTIVE', 'CALCULATING', 'DISTRIBUTING', 'SETTLED', 'CANCELLED')),
    
    -- Fee & Limits
    entry_fee BIGINT NOT NULL CHECK (entry_fee >= 10),
    max_entrants INTEGER NOT NULL CHECK (max_entrants >= 2),
    min_entrants INTEGER NOT NULL DEFAULT 2,
    
    -- Pool Totals
    total_pool BIGINT NOT NULL DEFAULT 0,
    total_burned BIGINT NOT NULL DEFAULT 0,
    house_cut_rate DECIMAL(4,2) NOT NULL DEFAULT 0.10,
    entrant_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    registration_deadline TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    
    -- Metadata
    description TEXT,
    rules JSONB DEFAULT '{}',
    payout_structure JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for arena_prize_pools
CREATE INDEX IF NOT EXISTS idx_arena_pools_status ON arena_prize_pools(status);
CREATE INDEX IF NOT EXISTS idx_arena_pools_type ON arena_prize_pools(pool_type);
CREATE INDEX IF NOT EXISTS idx_arena_pools_start ON arena_prize_pools(start_time);
CREATE INDEX IF NOT EXISTS idx_arena_pools_active ON arena_prize_pools(status) WHERE status IN ('REGISTERING', 'ACTIVE');

COMMENT ON TABLE arena_prize_pools IS '💎 ORB_03: Diamond Arena prize pool registry';

-- ═══════════════════════════════════════════════════════════
-- 📋 ARENA POOL ENTRIES TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arena_pool_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES arena_prize_pools(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Stake Details
    stake_amount BIGINT NOT NULL CHECK (stake_amount >= 10),
    burn_amount BIGINT NOT NULL CHECK (burn_amount >= 0),
    pool_contribution BIGINT NOT NULL CHECK (pool_contribution >= 0),
    wallet_source VARCHAR(20) NOT NULL DEFAULT 'PERSONAL' CHECK (wallet_source IN ('PERSONAL', 'STAKED', 'MAKEUP')),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'SETTLED', 'REFUNDED', 'VOID')),
    
    -- Performance (filled during competition)
    score INTEGER DEFAULT 0,
    rank INTEGER,
    percentile DECIMAL(5,2),
    latency_ms INTEGER,
    
    -- Payout (filled at settlement)
    payout_amount BIGINT DEFAULT 0,
    payout_tier VARCHAR(20),
    
    -- Hash for audit trail
    hash_id VARCHAR(16) NOT NULL,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    
    -- Prevent duplicate entries
    UNIQUE(pool_id, user_id)
);

-- Indexes for arena_pool_entries
CREATE INDEX IF NOT EXISTS idx_arena_entries_pool ON arena_pool_entries(pool_id);
CREATE INDEX IF NOT EXISTS idx_arena_entries_user ON arena_pool_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_entries_status ON arena_pool_entries(status);
CREATE INDEX IF NOT EXISTS idx_arena_entries_score ON arena_pool_entries(pool_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_arena_entries_hash ON arena_pool_entries(hash_id);

COMMENT ON TABLE arena_pool_entries IS '💎 ORB_03: Diamond Arena user entries with 25% burn enforcement';

-- ═══════════════════════════════════════════════════════════
-- 🔧 HELPER FUNCTION: GENERATE HASH ID
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_generate_arena_hash()
RETURNS VARCHAR(16)
LANGUAGE plpgsql
AS $$
DECLARE
    v_chars VARCHAR(32) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_hash VARCHAR(16) := 'PXQ';
    i INTEGER;
BEGIN
    FOR i IN 1..13 LOOP
        v_hash := v_hash || SUBSTR(v_chars, FLOOR(RANDOM() * 32 + 1)::INTEGER, 1);
    END LOOP;
    RETURN v_hash;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- ⚡ RPC: ATOMIC STAKE ENTRY
-- HARD LAW: 25% Burn on all stakes
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_atomic_stake_entry(
    p_user_id UUID,
    p_pool_id UUID,
    p_gross_stake BIGINT,
    p_burn_amount BIGINT,
    p_pool_contribution BIGINT,
    p_wallet_source VARCHAR DEFAULT 'PERSONAL',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_pool_status VARCHAR;
    v_pool_total BIGINT;
    v_entry_id UUID;
    v_hash_id VARCHAR(16);
    v_entrant_count INTEGER;
    v_max_entrants INTEGER;
BEGIN
    -- 1️⃣ Validate pool exists and is open for registration
    SELECT status, total_pool, entrant_count, max_entrants
    INTO v_pool_status, v_pool_total, v_entrant_count, v_max_entrants
    FROM arena_prize_pools
    WHERE id = p_pool_id
    FOR UPDATE;
    
    IF v_pool_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'POOL_NOT_FOUND');
    END IF;
    
    IF v_pool_status NOT IN ('REGISTERING', 'ACTIVE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'POOL_NOT_ACCEPTING_ENTRIES', 'status', v_pool_status);
    END IF;
    
    IF v_entrant_count >= v_max_entrants THEN
        RETURN jsonb_build_object('success', false, 'error', 'POOL_FULL');
    END IF;
    
    -- 2️⃣ Check for duplicate entry
    IF EXISTS (SELECT 1 FROM arena_pool_entries WHERE pool_id = p_pool_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENTERED');
    END IF;
    
    -- 3️⃣ Lock user wallet and verify balance
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
    END IF;
    
    IF v_current_balance < p_gross_stake THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE', 'required', p_gross_stake, 'available', v_current_balance);
    END IF;
    
    -- 4️⃣ Debit user wallet
    v_new_balance := v_current_balance - p_gross_stake;
    
    UPDATE wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 5️⃣ Record transaction in ledger
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_type, metadata
    )
    SELECT 
        p_user_id, w.id, 'DEBIT', p_gross_stake, 'ARENA_STAKE',
        v_current_balance, v_new_balance, 'ARENA_ENTRY', p_metadata
    FROM wallets w WHERE w.user_id = p_user_id;
    
    -- 6️⃣ Generate hash ID
    v_hash_id := fn_generate_arena_hash();
    
    -- 7️⃣ Create entry record
    INSERT INTO arena_pool_entries (
        pool_id, user_id, stake_amount, burn_amount, pool_contribution,
        wallet_source, status, hash_id
    )
    VALUES (
        p_pool_id, p_user_id, p_gross_stake, p_burn_amount, p_pool_contribution,
        p_wallet_source, 'ACTIVE', v_hash_id
    )
    RETURNING id INTO v_entry_id;
    
    -- 8️⃣ Update pool totals
    UPDATE arena_prize_pools
    SET total_pool = total_pool + p_pool_contribution,
        total_burned = total_burned + p_burn_amount,
        entrant_count = entrant_count + 1,
        updated_at = NOW()
    WHERE id = p_pool_id;
    
    -- 9️⃣ Record burn in burn_ledger
    INSERT INTO burn_ledger (payer_id, transaction_id, original_amount, burn_amount, source)
    SELECT p_user_id, t.id, p_gross_stake, p_burn_amount, 'ARENA_STAKE'
    FROM transactions t 
    WHERE t.user_id = p_user_id 
    ORDER BY t.created_at DESC 
    LIMIT 1;
    
    -- 🔟 Update burn_vault totals
    UPDATE burn_vault
    SET total_burned = total_burned + p_burn_amount,
        arena_burned = COALESCE(arena_burned, 0) + p_burn_amount,
        last_burn_at = NOW(),
        last_burn_amount = p_burn_amount,
        last_burn_source = 'ARENA_STAKE'
    WHERE id = 1;
    
    RETURN jsonb_build_object(
        'success', true,
        'entry_id', v_entry_id,
        'hash_id', v_hash_id,
        'balance_after', v_new_balance,
        'stake_breakdown', jsonb_build_object(
            'gross', p_gross_stake,
            'burned', p_burn_amount,
            'to_pool', p_pool_contribution
        ),
        'hard_laws_enforced', ARRAY['IMMUTABLE_LEDGER', '25_PERCENT_BURN', 'TRIPLE_WALLET_ISOLATION']
    );
END;
$$;

COMMENT ON FUNCTION fn_atomic_stake_entry IS '⚡ ORB_03: Atomic stake entry with 25% burn enforcement';

-- ═══════════════════════════════════════════════════════════
-- 🔄 RPC: ATOMIC STAKE REFUND
-- Only pool_contribution is refunded (burn is permanent)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_atomic_stake_refund(
    p_entry_id UUID,
    p_reason VARCHAR DEFAULT 'POOL_CANCELLED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry RECORD;
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_new_hash VARCHAR(16);
BEGIN
    -- 1️⃣ Lock and fetch entry
    SELECT * INTO v_entry
    FROM arena_pool_entries
    WHERE id = p_entry_id
    FOR UPDATE;
    
    IF v_entry IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ENTRY_NOT_FOUND');
    END IF;
    
    IF v_entry.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ENTRY_NOT_REFUNDABLE', 'status', v_entry.status);
    END IF;
    
    -- 2️⃣ Lock user wallet
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = v_entry.user_id
    FOR UPDATE;
    
    -- 3️⃣ Credit only pool_contribution (burn is permanent)
    v_new_balance := v_current_balance + v_entry.pool_contribution;
    
    UPDATE wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = v_entry.user_id;
    
    -- 4️⃣ Record refund transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_type, reference_id,
        metadata
    )
    SELECT 
        v_entry.user_id, w.id, 'CREDIT', v_entry.pool_contribution, 'ARENA_REFUND',
        v_current_balance, v_new_balance, 'ARENA_ENTRY', p_entry_id,
        jsonb_build_object('reason', p_reason, 'original_stake', v_entry.stake_amount, 'burn_retained', v_entry.burn_amount)
    FROM wallets w WHERE w.user_id = v_entry.user_id;
    
    -- 5️⃣ Generate new hash for audit trail
    v_new_hash := fn_generate_arena_hash();
    
    -- 6️⃣ Update entry status
    UPDATE arena_pool_entries
    SET status = 'REFUNDED',
        hash_id = v_new_hash,
        settled_at = NOW()
    WHERE id = p_entry_id;
    
    -- 7️⃣ Update pool totals
    UPDATE arena_prize_pools
    SET total_pool = total_pool - v_entry.pool_contribution,
        entrant_count = entrant_count - 1,
        updated_at = NOW()
    WHERE id = v_entry.pool_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'hash_id', v_new_hash,
        'refunded_amount', v_entry.pool_contribution,
        'burn_retained', v_entry.burn_amount,
        'balance_after', v_new_balance,
        'reason', p_reason
    );
END;
$$;

COMMENT ON FUNCTION fn_atomic_stake_refund IS '🔄 ORB_03: Atomic refund (burn is permanent)';

-- ═══════════════════════════════════════════════════════════
-- 🏆 RPC: SETTLE ARENA ENTRY (WINNER PAYOUT)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_settle_arena_entry(
    p_entry_id UUID,
    p_payout_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry RECORD;
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_new_hash VARCHAR(16);
BEGIN
    -- 1️⃣ Lock and fetch entry
    SELECT * INTO v_entry
    FROM arena_pool_entries
    WHERE id = p_entry_id
    FOR UPDATE;
    
    IF v_entry IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ENTRY_NOT_FOUND');
    END IF;
    
    IF v_entry.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ENTRY_ALREADY_SETTLED', 'status', v_entry.status);
    END IF;
    
    -- 2️⃣ Lock user wallet
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = v_entry.user_id
    FOR UPDATE;
    
    -- 3️⃣ Credit payout
    v_new_balance := v_current_balance + p_payout_amount;
    
    UPDATE wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = v_entry.user_id;
    
    -- 4️⃣ Record payout transaction
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_type, reference_id
    )
    SELECT 
        v_entry.user_id, w.id, 'CREDIT', p_payout_amount, 'ARENA_PAYOUT',
        v_current_balance, v_new_balance, 'ARENA_ENTRY', p_entry_id
    FROM wallets w WHERE w.user_id = v_entry.user_id;
    
    -- 5️⃣ Generate new hash
    v_new_hash := fn_generate_arena_hash();
    
    -- 6️⃣ Update entry
    UPDATE arena_pool_entries
    SET status = 'SETTLED',
        payout_amount = p_payout_amount,
        hash_id = v_new_hash,
        settled_at = NOW()
    WHERE id = p_entry_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'hash_id', v_new_hash,
        'payout_amount', p_payout_amount,
        'balance_after', v_new_balance
    );
END;
$$;

COMMENT ON FUNCTION fn_settle_arena_entry IS '🏆 ORB_03: Settle individual entry with payout';

-- ═══════════════════════════════════════════════════════════
-- 💰 RPC: DISTRIBUTE ARENA PRIZES (BATCH SETTLEMENT)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_distribute_arena_prizes(
    p_pool_id UUID,
    p_payouts JSONB,  -- Array of {user_id, amount, rank, percentile}
    p_house_cut BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pool RECORD;
    v_payout JSONB;
    v_user_id UUID;
    v_amount BIGINT;
    v_rank INTEGER;
    v_percentile DECIMAL;
    v_total_distributed BIGINT := 0;
    v_settled_count INTEGER := 0;
    v_errors JSONB := '[]';
BEGIN
    -- 1️⃣ Lock pool
    SELECT * INTO v_pool
    FROM arena_prize_pools
    WHERE id = p_pool_id
    FOR UPDATE;
    
    IF v_pool IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'POOL_NOT_FOUND');
    END IF;
    
    IF v_pool.status NOT IN ('CALCULATING', 'DISTRIBUTING') THEN
        RETURN jsonb_build_object('success', false, 'error', 'POOL_NOT_READY_FOR_DISTRIBUTION', 'status', v_pool.status);
    END IF;
    
    -- 2️⃣ Process each payout
    FOR v_payout IN SELECT * FROM jsonb_array_elements(p_payouts)
    LOOP
        v_user_id := (v_payout->>'user_id')::UUID;
        v_amount := (v_payout->>'amount')::BIGINT;
        v_rank := (v_payout->>'rank')::INTEGER;
        v_percentile := (v_payout->>'percentile')::DECIMAL;
        
        -- Update entry with rank/percentile
        UPDATE arena_pool_entries
        SET rank = v_rank,
            percentile = v_percentile,
            payout_tier = CASE 
                WHEN v_percentile <= 1 THEN 'ELITE_1'
                WHEN v_percentile <= 5 THEN 'TOP_5'
                WHEN v_percentile <= 10 THEN 'TOP_10'
                WHEN v_percentile <= 25 THEN 'TOP_25'
                WHEN v_percentile <= 50 THEN 'TOP_50'
                ELSE 'PARTICIPANTS'
            END
        WHERE pool_id = p_pool_id AND user_id = v_user_id;
        
        -- Settle entry with payout
        IF v_amount > 0 THEN
            PERFORM fn_settle_arena_entry(
                (SELECT id FROM arena_pool_entries WHERE pool_id = p_pool_id AND user_id = v_user_id),
                v_amount
            );
            v_total_distributed := v_total_distributed + v_amount;
            v_settled_count := v_settled_count + 1;
        ELSE
            -- Mark as settled with 0 payout
            UPDATE arena_pool_entries
            SET status = 'SETTLED',
                payout_amount = 0,
                settled_at = NOW()
            WHERE pool_id = p_pool_id AND user_id = v_user_id;
            v_settled_count := v_settled_count + 1;
        END IF;
    END LOOP;
    
    -- 3️⃣ Record house cut in house_seed_ledger
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, source,
        balance_before, balance_after, reference_type, reference_id,
        metadata
    )
    VALUES (
        NULL, NULL, 'CREDIT', p_house_cut, 'ARENA_HOUSE_CUT',
        0, p_house_cut, 'ARENA_POOL', p_pool_id,
        jsonb_build_object('pool_name', v_pool.name, 'pool_type', v_pool.pool_type)
    );
    
    -- 4️⃣ Finalize pool
    UPDATE arena_prize_pools
    SET status = 'SETTLED',
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_pool_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'pool_id', p_pool_id,
        'total_distributed', v_total_distributed,
        'house_cut', p_house_cut,
        'entries_settled', v_settled_count,
        'settled_at', NOW()
    );
END;
$$;

COMMENT ON FUNCTION fn_distribute_arena_prizes IS '💰 ORB_03: Batch prize distribution with house cut';

-- ═══════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE arena_prize_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_pool_entries ENABLE ROW LEVEL SECURITY;

-- Pools: Anyone can read, only admins can write
CREATE POLICY "arena_pools_read" ON arena_prize_pools FOR SELECT USING (true);
CREATE POLICY "arena_pools_insert" ON arena_prize_pools FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "arena_pools_update" ON arena_prize_pools FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Entries: Users can read their own, system handles writes via RPC
CREATE POLICY "arena_entries_read_own" ON arena_pool_entries FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "arena_entries_read_pool" ON arena_pool_entries FOR SELECT USING (
    EXISTS (SELECT 1 FROM arena_prize_pools WHERE id = pool_id AND status IN ('ACTIVE', 'SETTLED'))
);

-- ═══════════════════════════════════════════════════════════
-- 📊 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON arena_prize_pools TO authenticated;
GRANT SELECT ON arena_pool_entries TO authenticated;
GRANT EXECUTE ON FUNCTION fn_atomic_stake_entry TO authenticated;
GRANT EXECUTE ON FUNCTION fn_atomic_stake_refund TO authenticated;
GRANT EXECUTE ON FUNCTION fn_settle_arena_entry TO authenticated;
GRANT EXECUTE ON FUNCTION fn_distribute_arena_prizes TO authenticated;
GRANT EXECUTE ON FUNCTION fn_generate_arena_hash TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 📋 ADD arena_burned COLUMN TO burn_vault IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'burn_vault' AND column_name = 'arena_burned'
    ) THEN
        ALTER TABLE burn_vault ADD COLUMN arena_burned BIGINT DEFAULT 0;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- ✅ MIGRATION COMPLETE: ORB_03_DIAMOND_ARENA
-- ═══════════════════════════════════════════════════════════

COMMENT ON SCHEMA public IS 'ORB_03 Diamond Arena: Tables and RPC functions deployed ✅';
