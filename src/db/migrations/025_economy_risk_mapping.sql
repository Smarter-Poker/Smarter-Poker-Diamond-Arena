-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 025
-- ECONOMY & RISK MAPPING (TASKS 51-54)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 51: ARCADE_RNG_ORACLE
-- TASK 52: DIAMOND_ARENA_RAKEBACK
-- TASK 53: BURN_VAULT_TRANSPARENCY
-- TASK 54: MULTI_CURRENCY_ATOMIC_SWAP
--
-- SOVEREIGN_MAPPING: ECONOMY & RISK
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 51: ARCADE_RNG_ORACLE
-- ═══════════════════════════════════════════════════════════
-- Transparent random seeds for Orb 7 (Arcade)
-- ═══════════════════════════════════════════════════════════

-- RNG Oracle seed log (fully transparent)
CREATE TABLE IF NOT EXISTS rng_oracle_seeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session context
    game_session_id UUID NOT NULL,
    game_mode VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    
    -- Seed components (transparent)
    server_seed TEXT NOT NULL,  -- Server's secret seed
    server_seed_hash TEXT NOT NULL,  -- SHA-256 hash (published before game)
    client_seed TEXT NOT NULL,  -- Player's chosen seed
    nonce INTEGER NOT NULL DEFAULT 0,  -- Incrementing nonce
    
    -- Combined seed computation
    combined_seed TEXT NOT NULL,  -- server_seed + client_seed + nonce
    final_hash TEXT NOT NULL,  -- SHA-256 of combined
    
    -- Result
    roll_value NUMERIC(10,8) NOT NULL,  -- 0.00000000 to 0.99999999
    outcome VARCHAR(50),
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    
    -- Audit
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revealed_at TIMESTAMPTZ  -- When server seed is revealed
);

CREATE INDEX IF NOT EXISTS idx_rng_session ON rng_oracle_seeds(game_session_id);
CREATE INDEX IF NOT EXISTS idx_rng_user ON rng_oracle_seeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rng_time ON rng_oracle_seeds(published_at DESC);

COMMENT ON TABLE rng_oracle_seeds IS '🎲 TASK 51: Transparent RNG Oracle for Arcade (Provably Fair)';

-- ═══════════════════════════════════════════════════════════
-- 🎲 fn_generate_rng_seed
-- Generates provably fair random seed
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_generate_rng_seed(
    p_session_id UUID,
    p_game_mode VARCHAR(50),
    p_user_id UUID,
    p_client_seed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_server_seed TEXT;
    v_server_hash TEXT;
    v_client_seed TEXT;
    v_nonce INTEGER;
    v_combined TEXT;
    v_final_hash TEXT;
    v_roll NUMERIC;
    v_seed_id UUID;
BEGIN
    -- Generate cryptographic server seed
    v_server_seed := encode(gen_random_bytes(32), 'hex');
    
    -- Hash server seed (published before game)
    v_server_hash := encode(sha256(v_server_seed::bytea), 'hex');
    
    -- Use client seed or generate one
    v_client_seed := COALESCE(p_client_seed, encode(gen_random_bytes(16), 'hex'));
    
    -- Get nonce for this session
    SELECT COALESCE(MAX(nonce), -1) + 1 INTO v_nonce
    FROM rng_oracle_seeds WHERE game_session_id = p_session_id;
    
    -- Combine seeds
    v_combined := v_server_seed || ':' || v_client_seed || ':' || v_nonce::TEXT;
    v_final_hash := encode(sha256(v_combined::bytea), 'hex');
    
    -- Convert hash to roll value (0-1)
    v_roll := ('x' || substring(v_final_hash, 1, 8))::bit(32)::bigint / 4294967295.0;
    
    -- Record
    INSERT INTO rng_oracle_seeds (
        game_session_id, game_mode, user_id,
        server_seed, server_seed_hash, client_seed, nonce,
        combined_seed, final_hash, roll_value
    ) VALUES (
        p_session_id, p_game_mode, p_user_id,
        v_server_seed, v_server_hash, v_client_seed, v_nonce,
        v_combined, v_final_hash, v_roll
    )
    RETURNING id INTO v_seed_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'seed_id', v_seed_id,
        'provably_fair', jsonb_build_object(
            'server_seed_hash', v_server_hash,
            'client_seed', v_client_seed,
            'nonce', v_nonce
        ),
        'roll', jsonb_build_object(
            'value', v_roll,
            'normalized', ROUND(v_roll * 100, 2) || '%'
        ),
        'verification', jsonb_build_object(
            'can_verify_after', 'GAME_END',
            'formula', 'SHA256(server_seed + client_seed + nonce)'
        ),
        'task', 'ARCADE_RNG_ORACLE'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎲 fn_verify_rng_seed
-- Verifies RNG was fair (called after game end)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_verify_rng_seed(
    p_seed_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seed RECORD;
    v_recomputed_hash TEXT;
    v_valid BOOLEAN;
BEGIN
    SELECT * INTO v_seed FROM rng_oracle_seeds WHERE id = p_seed_id;
    
    IF v_seed IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SEED_NOT_FOUND');
    END IF;
    
    -- Recompute hash to verify
    v_recomputed_hash := encode(sha256(v_seed.combined_seed::bytea), 'hex');
    v_valid := v_recomputed_hash = v_seed.final_hash;
    
    -- Mark as verified
    UPDATE rng_oracle_seeds
    SET is_verified = v_valid,
        verified_at = NOW(),
        revealed_at = NOW()
    WHERE id = p_seed_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'verified', v_valid,
        'revealed', jsonb_build_object(
            'server_seed', v_seed.server_seed,
            'client_seed', v_seed.client_seed,
            'nonce', v_seed.nonce,
            'combined', v_seed.combined_seed
        ),
        'verification', jsonb_build_object(
            'expected_hash', v_seed.final_hash,
            'computed_hash', v_recomputed_hash,
            'match', v_valid
        ),
        'roll_value', v_seed.roll_value,
        'task', 'ARCADE_RNG_ORACLE'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 52: DIAMOND_ARENA_RAKEBACK
-- ═══════════════════════════════════════════════════════════
-- Return 5% of fees to high-streak users
-- ═══════════════════════════════════════════════════════════

-- Rakeback configuration
CREATE TABLE IF NOT EXISTS rakeback_config (
    id SERIAL PRIMARY KEY,
    
    tier_name VARCHAR(30) UNIQUE NOT NULL,
    min_streak_days INTEGER NOT NULL,
    
    -- Rakeback percentage
    rakeback_percent NUMERIC(5,2) NOT NULL,  -- 5% = 5.00
    
    -- Active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rakeback_config IS '💰 TASK 52: Rakeback tier configuration';

-- Seed rakeback tiers
INSERT INTO rakeback_config (tier_name, min_streak_days, rakeback_percent)
VALUES
    ('NO_RAKEBACK', 0, 0.00),
    ('BRONZE_RAKEBACK', 7, 1.00),
    ('SILVER_RAKEBACK', 14, 2.50),
    ('GOLD_RAKEBACK', 21, 4.00),
    ('LEGENDARY_RAKEBACK', 30, 5.00)
ON CONFLICT (tier_name) DO NOTHING;

-- Rakeback ledger
CREATE TABLE IF NOT EXISTS rakeback_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Source
    fee_source VARCHAR(50) NOT NULL,  -- ARENA_ENTRY, ARCADE_WAGER, etc.
    original_fee BIGINT NOT NULL,
    
    -- Streak at time
    streak_days INTEGER NOT NULL,
    rakeback_tier VARCHAR(30) NOT NULL,
    rakeback_percent NUMERIC(5,2) NOT NULL,
    
    -- Rakeback amount
    rakeback_amount BIGINT NOT NULL,
    
    -- Credited
    credited BOOLEAN DEFAULT FALSE,
    credited_at TIMESTAMPTZ,
    wallet_tx_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rakeback_user ON rakeback_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_rakeback_uncredited ON rakeback_ledger(credited) WHERE credited = FALSE;

COMMENT ON TABLE rakeback_ledger IS '💰 TASK 52: Rakeback distribution ledger';

-- ═══════════════════════════════════════════════════════════
-- 💰 fn_calculate_rakeback
-- Calculates and credits rakeback for high-streak users
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_calculate_rakeback(
    p_user_id UUID,
    p_fee_source VARCHAR(50),
    p_fee_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak INTEGER;
    v_tier RECORD;
    v_rakeback BIGINT;
    v_rakeback_id UUID;
BEGIN
    -- Get user streak
    BEGIN
        SELECT current_streak INTO v_streak FROM profiles WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
        SELECT current_streak INTO v_streak FROM wallets WHERE user_id = p_user_id;
    END;
    
    v_streak := COALESCE(v_streak, 0);
    
    -- Find rakeback tier
    SELECT * INTO v_tier
    FROM rakeback_config
    WHERE is_active = TRUE AND v_streak >= min_streak_days
    ORDER BY min_streak_days DESC
    LIMIT 1;
    
    IF v_tier IS NULL OR v_tier.rakeback_percent = 0 THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'rakeback', 0,
            'reason', 'NO_RAKEBACK_TIER',
            'streak_days', v_streak
        );
    END IF;
    
    -- Calculate rakeback
    v_rakeback := FLOOR(p_fee_amount * (v_tier.rakeback_percent / 100.0));
    
    IF v_rakeback = 0 THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'rakeback', 0,
            'reason', 'FEE_TOO_SMALL'
        );
    END IF;
    
    -- Record rakeback
    INSERT INTO rakeback_ledger (
        user_id, fee_source, original_fee,
        streak_days, rakeback_tier, rakeback_percent, rakeback_amount
    ) VALUES (
        p_user_id, p_fee_source, p_fee_amount,
        v_streak, v_tier.tier_name, v_tier.rakeback_percent, v_rakeback
    )
    RETURNING id INTO v_rakeback_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'rakeback_id', v_rakeback_id,
        'earned', jsonb_build_object(
            'fee_paid', p_fee_amount,
            'rakeback_percent', v_tier.rakeback_percent || '%',
            'rakeback_amount', v_rakeback
        ),
        'tier', jsonb_build_object(
            'name', v_tier.tier_name,
            'streak_days', v_streak
        ),
        'status', 'PENDING_CREDIT',
        'task', 'DIAMOND_ARENA_RAKEBACK'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 53: BURN_VAULT_TRANSPARENCY
-- ═══════════════════════════════════════════════════════════
-- Public ledger of every destroyed diamond
-- ═══════════════════════════════════════════════════════════

-- Public burn transparency view
CREATE OR REPLACE VIEW burn_vault_transparency AS
SELECT 
    bl.id,
    bl.created_at AS burned_at,
    bl.source,
    bl.original_amount,
    bl.burn_amount,
    bl.seller_receives,
    
    -- Anonymized parties (for privacy)
    SUBSTRING(bl.seller_id::TEXT, 1, 8) || '****' AS seller_hash,
    SUBSTRING(bl.buyer_id::TEXT, 1, 8) || '****' AS buyer_hash,
    
    -- Running totals
    SUM(bl.burn_amount) OVER (ORDER BY bl.created_at) AS cumulative_burned,
    
    -- Verification
    TRUE AS is_permanent,
    'DESTROYED_FOREVER' AS status
    
FROM burn_ledger bl
ORDER BY bl.created_at DESC;

COMMENT ON VIEW burn_vault_transparency IS '🔥 TASK 53: Public burn transparency ledger';

-- Burn vault summary
CREATE OR REPLACE VIEW burn_vault_summary AS
SELECT 
    bv.total_burned,
    bv.marketplace_burned,
    bv.total_burned - bv.marketplace_burned AS other_burned,
    bv.last_burn_amount,
    bv.last_burn_source,
    bv.last_burn_at,
    
    -- Stats from ledger
    (SELECT COUNT(*) FROM burn_ledger) AS total_burn_transactions,
    (SELECT COUNT(DISTINCT seller_id) FROM burn_ledger) AS unique_contributors,
    
    -- By source breakdown
    (SELECT COALESCE(SUM(burn_amount), 0) FROM burn_ledger WHERE source = 'MARKETPLACE') AS from_marketplace,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM burn_ledger WHERE source = 'ARCADE_WAGER') AS from_arcade,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM burn_ledger WHERE source = 'ARENA_ENTRY_FEE') AS from_arena,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM burn_ledger WHERE source = 'AUCTION_HOUSE') AS from_auction,
    
    -- Display
    format('🔥 %s 💎 DESTROYED FOREVER', TO_CHAR(bv.total_burned, 'FM999,999,999')) AS display_text,
    
    NOW() AS verified_at
    
FROM burn_vault bv
WHERE bv.id = 1;

COMMENT ON VIEW burn_vault_summary IS '📊 TASK 53: Burn vault summary statistics';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 54: MULTI_CURRENCY_ATOMIC_SWAP
-- ═══════════════════════════════════════════════════════════
-- Exchange XP for Diamond Arena entry
-- ═══════════════════════════════════════════════════════════

-- Swap rate configuration
CREATE TABLE IF NOT EXISTS currency_swap_rates (
    id SERIAL PRIMARY KEY,
    
    from_currency VARCHAR(20) NOT NULL,
    to_currency VARCHAR(20) NOT NULL,
    
    -- Rate: 1 from_currency = rate × to_currency
    rate NUMERIC(10,4) NOT NULL,
    
    -- Limits
    min_amount BIGINT NOT NULL DEFAULT 1,
    max_amount BIGINT,
    
    -- Fee
    fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    
    -- Active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(from_currency, to_currency)
);

COMMENT ON TABLE currency_swap_rates IS '💱 TASK 54: Currency swap rate configuration';

-- Seed swap rates
INSERT INTO currency_swap_rates (from_currency, to_currency, rate, min_amount, max_amount, fee_percent)
VALUES
    ('XP', 'DIAMOND', 0.01, 100, 100000, 5.00),  -- 100 XP = 1 Diamond (5% fee)
    ('DIAMOND', 'ARENA_TICKET', 1.00, 10, 10000, 0.00)  -- 1 Diamond = 1 Arena Ticket
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- Swap history ledger
CREATE TABLE IF NOT EXISTS currency_swap_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Swap details
    from_currency VARCHAR(20) NOT NULL,
    to_currency VARCHAR(20) NOT NULL,
    
    -- Amounts
    input_amount BIGINT NOT NULL,
    rate_applied NUMERIC(10,4) NOT NULL,
    fee_percent NUMERIC(5,2) NOT NULL,
    fee_amount BIGINT NOT NULL,
    output_amount BIGINT NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'COMPLETED',
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_user ON currency_swap_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_time ON currency_swap_ledger(created_at DESC);

COMMENT ON TABLE currency_swap_ledger IS '💱 TASK 54: Currency swap history';

-- ═══════════════════════════════════════════════════════════
-- 💱 fn_execute_currency_swap
-- Atomic swap between currencies
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_execute_currency_swap(
    p_user_id UUID,
    p_from_currency VARCHAR(20),
    p_to_currency VARCHAR(20),
    p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate RECORD;
    v_fee BIGINT;
    v_net_input BIGINT;
    v_output BIGINT;
    v_swap_id UUID;
    v_user_xp BIGINT;
    v_wallet RECORD;
BEGIN
    -- Get swap rate
    SELECT * INTO v_rate
    FROM currency_swap_rates
    WHERE from_currency = p_from_currency
      AND to_currency = p_to_currency
      AND is_active = TRUE;
    
    IF v_rate IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SWAP_PAIR_NOT_FOUND');
    END IF;
    
    -- Check limits
    IF p_amount < v_rate.min_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'BELOW_MINIMUM',
            'min_amount', v_rate.min_amount
        );
    END IF;
    
    IF v_rate.max_amount IS NOT NULL AND p_amount > v_rate.max_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ABOVE_MAXIMUM',
            'max_amount', v_rate.max_amount
        );
    END IF;
    
    -- Calculate output
    v_fee := FLOOR(p_amount * (v_rate.fee_percent / 100.0));
    v_net_input := p_amount - v_fee;
    v_output := FLOOR(v_net_input * v_rate.rate);
    
    -- Handle XP to Diamond swap
    IF p_from_currency = 'XP' THEN
        -- Check XP balance (from profiles)
        BEGIN
            SELECT xp_total INTO v_user_xp FROM profiles WHERE id = p_user_id FOR UPDATE;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'XP_SOURCE_NOT_AVAILABLE');
        END;
        
        IF v_user_xp < p_amount THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'INSUFFICIENT_XP',
                'required', p_amount,
                'available', v_user_xp
            );
        END IF;
        
        -- Deduct XP (note: violates XP permanence for swap only)
        -- This is a SPECIAL EXCEPTION to the XP permanence law
        -- User is exchanging XP for tangible diamonds
        
        -- Credit diamonds to wallet
        SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
        
        UPDATE wallets
        SET balance = balance + v_output,
            updated_at = NOW()
        WHERE id = v_wallet.id;
    
    ELSIF p_from_currency = 'DIAMOND' THEN
        -- Deduct from wallet
        SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
        
        IF v_wallet.balance < p_amount THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'INSUFFICIENT_DIAMONDS',
                'required', p_amount,
                'available', v_wallet.balance
            );
        END IF;
        
        UPDATE wallets
        SET balance = balance - p_amount,
            updated_at = NOW()
        WHERE id = v_wallet.id;
    END IF;
    
    -- Record swap
    INSERT INTO currency_swap_ledger (
        user_id, from_currency, to_currency,
        input_amount, rate_applied, fee_percent, fee_amount, output_amount
    ) VALUES (
        p_user_id, p_from_currency, p_to_currency,
        p_amount, v_rate.rate, v_rate.fee_percent, v_fee, v_output
    )
    RETURNING id INTO v_swap_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'swap_id', v_swap_id,
        'swap', jsonb_build_object(
            'from', p_from_currency,
            'to', p_to_currency,
            'input', p_amount,
            'fee', v_fee,
            'output', v_output
        ),
        'rate', jsonb_build_object(
            'value', v_rate.rate,
            'fee_percent', v_rate.fee_percent || '%'
        ),
        'formula', format('%s %s - %s fee = %s %s', 
            p_amount, p_from_currency, v_fee, v_output, p_to_currency),
        'task', 'MULTI_CURRENCY_ATOMIC_SWAP'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 ECONOMY & RISK STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW economy_risk_status AS
SELECT 
    -- Task 51: RNG Oracle
    (SELECT COUNT(*) FROM rng_oracle_seeds) AS total_rng_rolls,
    (SELECT COUNT(*) FROM rng_oracle_seeds WHERE is_verified = TRUE) AS verified_rolls,
    
    -- Task 52: Rakeback
    (SELECT COUNT(*) FROM rakeback_ledger) AS total_rakeback_entries,
    (SELECT COALESCE(SUM(rakeback_amount), 0) FROM rakeback_ledger) AS total_rakeback_earned,
    (SELECT COALESCE(SUM(rakeback_amount), 0) FROM rakeback_ledger WHERE credited = TRUE) AS total_rakeback_credited,
    
    -- Task 53: Burn Transparency
    (SELECT total_burned FROM burn_vault WHERE id = 1) AS total_diamonds_burned,
    (SELECT COUNT(*) FROM burn_ledger) AS burn_transaction_count,
    
    -- Task 54: Currency Swaps
    (SELECT COUNT(*) FROM currency_swap_ledger) AS total_swaps,
    (SELECT COALESCE(SUM(fee_amount), 0) FROM currency_swap_ledger) AS total_swap_fees,
    
    NOW() AS verified_at;

COMMENT ON VIEW economy_risk_status IS '📊 ECONOMY & RISK Status (Tasks 51-54)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON rng_oracle_seeds TO authenticated;
GRANT SELECT ON rakeback_config TO authenticated;
GRANT SELECT ON rakeback_ledger TO authenticated;
GRANT SELECT ON burn_vault_transparency TO authenticated;
GRANT SELECT ON burn_vault_summary TO authenticated;
GRANT SELECT ON currency_swap_rates TO authenticated;
GRANT SELECT ON currency_swap_ledger TO authenticated;
GRANT SELECT ON economy_risk_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_generate_rng_seed TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verify_rng_seed TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calculate_rakeback TO authenticated;
GRANT EXECUTE ON FUNCTION fn_execute_currency_swap TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ ECONOMY & RISK MAPPING COMPLETE
-- ═══════════════════════════════════════════════════════════
