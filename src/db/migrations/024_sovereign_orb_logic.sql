-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 024
-- SOVEREIGN ORB LOGIC (ORBS 03, 07, 10)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 44: ORB_03_DIAMOND_ARENA_STAKES
-- TASK 45: ORB_07_ARCADE_WAGER_ENGINE
-- TASK 46: ORB_10_MARKETPLACE_ENGINE
--
-- SOVEREIGN_ORB_LOGIC: ENABLED
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 44: ORB_03_DIAMOND_ARENA_STAKES
-- ═══════════════════════════════════════════════════════════
-- Tiered Arena Access: Higher XP (RED) unlocks higher Diamond-Stakes
-- ═══════════════════════════════════════════════════════════

-- Arena stake tier configuration
CREATE TABLE IF NOT EXISTS arena_stake_tiers (
    id SERIAL PRIMARY KEY,
    
    tier_name VARCHAR(30) NOT NULL,
    tier_level INTEGER UNIQUE NOT NULL,
    
    -- XP requirements (from RED silo)
    min_xp BIGINT NOT NULL,
    max_xp BIGINT,  -- NULL = unlimited
    
    -- Stake limits
    min_stake BIGINT NOT NULL,
    max_stake BIGINT NOT NULL,
    
    -- Entry fee (burned)
    entry_fee BIGINT NOT NULL DEFAULT 0,
    
    -- Visual
    tier_color VARCHAR(7) NOT NULL,  -- Hex color
    tier_icon VARCHAR(10) NOT NULL,
    
    -- Active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE arena_stake_tiers IS '🎯 TASK 44: Arena stake tier configuration (XP-gated)';

-- Seed default tiers
INSERT INTO arena_stake_tiers (tier_name, tier_level, min_xp, max_xp, min_stake, max_stake, entry_fee, tier_color, tier_icon)
VALUES
    ('BRONZE_ARENA', 1, 0, 999, 10, 100, 0, '#CD7F32', '🥉'),
    ('SILVER_ARENA', 2, 1000, 4999, 50, 500, 5, '#C0C0C0', '🥈'),
    ('GOLD_ARENA', 3, 5000, 19999, 100, 2000, 25, '#FFD700', '🥇'),
    ('PLATINUM_ARENA', 4, 20000, 49999, 500, 10000, 100, '#E5E4E2', '💎'),
    ('DIAMOND_ARENA', 5, 50000, 99999, 1000, 50000, 500, '#B9F2FF', '💠'),
    ('LEGENDARY_ARENA', 6, 100000, NULL, 5000, 250000, 2500, '#9B59B6', '👑')
ON CONFLICT (tier_level) DO NOTHING;

-- Arena access log
CREATE TABLE IF NOT EXISTS arena_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- XP at time of access
    user_xp BIGINT NOT NULL,
    xp_source VARCHAR(30) NOT NULL,
    
    -- Tier accessed
    tier_level INTEGER NOT NULL,
    tier_name VARCHAR(30) NOT NULL,
    
    -- Stake info
    stake_amount BIGINT NOT NULL,
    entry_fee_paid BIGINT NOT NULL DEFAULT 0,
    
    -- Session
    arena_session_id UUID,
    
    -- Result
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arena_access_user ON arena_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_access_time ON arena_access_log(created_at DESC);

COMMENT ON TABLE arena_access_log IS '📋 TASK 44: Arena access audit log';

-- ═══════════════════════════════════════════════════════════
-- 🎯 fn_get_arena_access_tier
-- Determines which arena tier a user can access based on XP
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_arena_access_tier(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_xp BIGINT;
    v_xp_source VARCHAR(30);
    v_tier RECORD;
    v_all_tiers JSONB;
BEGIN
    -- Query XP from RED silo (profiles) or YELLOW fallback
    BEGIN
        SELECT xp_total INTO v_user_xp
        FROM profiles WHERE id = p_user_id;
        v_xp_source := 'RED_SILO_PROFILES';
    EXCEPTION WHEN undefined_table OR undefined_column THEN
        -- Fallback: estimate XP from transaction history
        SELECT COALESCE(SUM(amount), 0) INTO v_user_xp
        FROM transactions 
        WHERE user_id = p_user_id AND type = 'CREDIT';
        v_xp_source := 'YELLOW_ESTIMATE';
    END;
    
    v_user_xp := COALESCE(v_user_xp, 0);
    
    -- Find highest unlocked tier
    SELECT * INTO v_tier
    FROM arena_stake_tiers
    WHERE is_active = TRUE
      AND v_user_xp >= min_xp
      AND (max_xp IS NULL OR v_user_xp <= max_xp)
    ORDER BY tier_level DESC
    LIMIT 1;
    
    -- Get all tiers for display
    SELECT jsonb_agg(jsonb_build_object(
        'tier_level', tier_level,
        'tier_name', tier_name,
        'min_xp', min_xp,
        'max_xp', max_xp,
        'unlocked', v_user_xp >= min_xp,
        'current', tier_level = v_tier.tier_level,
        'icon', tier_icon,
        'color', tier_color
    ) ORDER BY tier_level) INTO v_all_tiers
    FROM arena_stake_tiers WHERE is_active = TRUE;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'user', jsonb_build_object(
            'id', p_user_id,
            'xp', v_user_xp,
            'xp_source', v_xp_source
        ),
        'current_tier', CASE WHEN v_tier IS NOT NULL THEN jsonb_build_object(
            'level', v_tier.tier_level,
            'name', v_tier.tier_name,
            'min_stake', v_tier.min_stake,
            'max_stake', v_tier.max_stake,
            'entry_fee', v_tier.entry_fee,
            'icon', v_tier.tier_icon,
            'color', v_tier.tier_color
        ) ELSE NULL END,
        'all_tiers', v_all_tiers,
        'task', 'ORB_03_DIAMOND_ARENA_STAKES'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎯 fn_request_arena_access
-- Validates and grants arena access based on XP tier
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_request_arena_access(
    p_user_id UUID,
    p_tier_level INTEGER,
    p_stake_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_xp BIGINT;
    v_xp_source VARCHAR(30);
    v_tier RECORD;
    v_wallet RECORD;
    v_entry_fee BIGINT;
    v_session_id UUID;
    v_access_id UUID;
    v_denial_reason VARCHAR(100);
BEGIN
    -- Get user XP
    BEGIN
        SELECT xp_total INTO v_user_xp
        FROM profiles WHERE id = p_user_id;
        v_xp_source := 'RED_SILO_PROFILES';
    EXCEPTION WHEN OTHERS THEN
        v_user_xp := 0;
        v_xp_source := 'DEFAULT';
    END;
    
    -- Get tier
    SELECT * INTO v_tier
    FROM arena_stake_tiers
    WHERE tier_level = p_tier_level AND is_active = TRUE;
    
    IF v_tier IS NULL THEN
        v_denial_reason := 'TIER_NOT_FOUND';
        INSERT INTO arena_access_log (user_id, user_xp, xp_source, tier_level, tier_name, stake_amount, access_granted, denial_reason)
        VALUES (p_user_id, v_user_xp, v_xp_source, p_tier_level, 'UNKNOWN', p_stake_amount, FALSE, v_denial_reason);
        
        RETURN jsonb_build_object('success', FALSE, 'error', 'TIER_NOT_FOUND');
    END IF;
    
    -- Check XP requirement
    IF v_user_xp < v_tier.min_xp THEN
        v_denial_reason := format('INSUFFICIENT_XP: need %s, have %s', v_tier.min_xp, v_user_xp);
        INSERT INTO arena_access_log (user_id, user_xp, xp_source, tier_level, tier_name, stake_amount, access_granted, denial_reason)
        VALUES (p_user_id, v_user_xp, v_xp_source, p_tier_level, v_tier.tier_name, p_stake_amount, FALSE, v_denial_reason);
        
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_XP',
            'required', v_tier.min_xp,
            'current', v_user_xp
        );
    END IF;
    
    -- Check stake limits
    IF p_stake_amount < v_tier.min_stake OR p_stake_amount > v_tier.max_stake THEN
        v_denial_reason := format('INVALID_STAKE: must be %s-%s', v_tier.min_stake, v_tier.max_stake);
        INSERT INTO arena_access_log (user_id, user_xp, xp_source, tier_level, tier_name, stake_amount, access_granted, denial_reason)
        VALUES (p_user_id, v_user_xp, v_xp_source, p_tier_level, v_tier.tier_name, p_stake_amount, FALSE, v_denial_reason);
        
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INVALID_STAKE_AMOUNT',
            'min_stake', v_tier.min_stake,
            'max_stake', v_tier.max_stake
        );
    END IF;
    
    -- Check wallet balance
    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    v_entry_fee := v_tier.entry_fee;
    
    IF v_wallet.balance < (p_stake_amount + v_entry_fee) THEN
        v_denial_reason := 'INSUFFICIENT_BALANCE';
        INSERT INTO arena_access_log (user_id, user_xp, xp_source, tier_level, tier_name, stake_amount, access_granted, denial_reason)
        VALUES (p_user_id, v_user_xp, v_xp_source, p_tier_level, v_tier.tier_name, p_stake_amount, FALSE, v_denial_reason);
        
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_BALANCE',
            'required', p_stake_amount + v_entry_fee,
            'available', v_wallet.balance
        );
    END IF;
    
    -- Generate session ID
    v_session_id := gen_random_uuid();
    
    -- Deduct stake + entry fee
    UPDATE wallets
    SET balance = balance - (p_stake_amount + v_entry_fee),
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Record access
    INSERT INTO arena_access_log (
        user_id, user_xp, xp_source, tier_level, tier_name,
        stake_amount, entry_fee_paid, arena_session_id, access_granted
    ) VALUES (
        p_user_id, v_user_xp, v_xp_source, p_tier_level, v_tier.tier_name,
        p_stake_amount, v_entry_fee, v_session_id, TRUE
    )
    RETURNING id INTO v_access_id;
    
    -- Burn entry fee if any
    IF v_entry_fee > 0 THEN
        UPDATE burn_vault
        SET total_burned = total_burned + v_entry_fee,
            last_burn_amount = v_entry_fee,
            last_burn_source = 'ARENA_ENTRY_FEE',
            last_burn_at = NOW()
        WHERE id = 1;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'access_id', v_access_id,
        'session_id', v_session_id,
        'tier', jsonb_build_object(
            'level', v_tier.tier_level,
            'name', v_tier.tier_name,
            'icon', v_tier.tier_icon
        ),
        'stake', jsonb_build_object(
            'amount', p_stake_amount,
            'entry_fee', v_entry_fee,
            'total_deducted', p_stake_amount + v_entry_fee
        ),
        'user_xp', v_user_xp,
        'task', 'ORB_03_DIAMOND_ARENA_STAKES'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 45: ORB_07_ARCADE_WAGER_ENGINE
-- ═══════════════════════════════════════════════════════════
-- Atomic Arcade Settlement: 25% of all wagers auto-burned
-- ═══════════════════════════════════════════════════════════

-- Arcade wager ledger
CREATE TABLE IF NOT EXISTS arcade_wager_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Game info
    game_mode VARCHAR(50) NOT NULL,
    game_session_id UUID,
    
    -- Wager
    wager_amount BIGINT NOT NULL,
    
    -- Burn enforcement (25% HARD LAW on wagers)
    wager_burn BIGINT NOT NULL,  -- 25% of wager burned instantly
    net_wager BIGINT NOT NULL,   -- 75% goes to prize pool
    
    -- Result
    outcome VARCHAR(20),  -- WIN, LOSS, PUSH, PENDING
    payout_amount BIGINT DEFAULT 0,
    payout_burn BIGINT DEFAULT 0,  -- 25% of payout also burned
    net_payout BIGINT DEFAULT 0,
    
    -- Settlement
    settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    
    -- Audit
    burn_enforced BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arcade_wager_user ON arcade_wager_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_arcade_wager_session ON arcade_wager_ledger(game_session_id);
CREATE INDEX IF NOT EXISTS idx_arcade_wager_unsettled ON arcade_wager_ledger(settled) WHERE settled = FALSE;

COMMENT ON TABLE arcade_wager_ledger IS '🎰 TASK 45: Arcade wager ledger with atomic 25% burn';

-- ═══════════════════════════════════════════════════════════
-- 🎰 fn_place_arcade_wager
-- Places wager with instant 25% burn
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_place_arcade_wager(
    p_user_id UUID,
    p_game_mode VARCHAR(50),
    p_wager_amount BIGINT,
    p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW
    
    v_wallet RECORD;
    v_wager_burn BIGINT;
    v_net_wager BIGINT;
    v_wager_id UUID;
BEGIN
    -- Calculate burn
    v_wager_burn := FLOOR(p_wager_amount * c_burn_rate);
    v_net_wager := p_wager_amount - v_wager_burn;
    
    -- Get wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'WALLET_NOT_FOUND');
    END IF;
    
    IF v_wallet.balance < p_wager_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_BALANCE',
            'required', p_wager_amount,
            'available', v_wallet.balance
        );
    END IF;
    
    -- Deduct full wager
    UPDATE wallets
    SET balance = balance - p_wager_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Record wager
    INSERT INTO arcade_wager_ledger (
        user_id, game_mode, game_session_id,
        wager_amount, wager_burn, net_wager,
        outcome, burn_enforced
    ) VALUES (
        p_user_id, p_game_mode, COALESCE(p_session_id, gen_random_uuid()),
        p_wager_amount, v_wager_burn, v_net_wager,
        'PENDING', TRUE
    )
    RETURNING id INTO v_wager_id;
    
    -- Instant burn to vault
    UPDATE burn_vault
    SET total_burned = total_burned + v_wager_burn,
        last_burn_amount = v_wager_burn,
        last_burn_source = 'ARCADE_WAGER',
        last_burn_at = NOW()
    WHERE id = 1;
    
    -- Record burn in ledger
    INSERT INTO burn_ledger (seller_id, buyer_id, original_amount, burn_amount, seller_receives, source)
    VALUES (p_user_id, p_user_id, p_wager_amount, v_wager_burn, v_net_wager, 'ARCADE_WAGER');
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'wager_id', v_wager_id,
        'wager', jsonb_build_object(
            'total', p_wager_amount,
            'burned', v_wager_burn,
            'to_pool', v_net_wager,
            'burn_rate', '25%'
        ),
        'balance_after', v_wallet.balance - p_wager_amount,
        'enforcement', jsonb_build_object(
            'burn_enforced', TRUE,
            'hard_law', '25_PERCENT_WAGER_BURN'
        ),
        'formula', format('%s - %s (burn) = %s to prize pool', p_wager_amount, v_wager_burn, v_net_wager),
        'task', 'ORB_07_ARCADE_WAGER_ENGINE'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎰 fn_settle_arcade_wager
-- Settles wager with payout (also 25% burned)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_settle_arcade_wager(
    p_wager_id UUID,
    p_outcome VARCHAR(20),
    p_payout_amount BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW
    
    v_wager RECORD;
    v_wallet RECORD;
    v_payout_burn BIGINT;
    v_net_payout BIGINT;
BEGIN
    -- Get wager
    SELECT * INTO v_wager
    FROM arcade_wager_ledger
    WHERE id = p_wager_id AND settled = FALSE
    FOR UPDATE;
    
    IF v_wager IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'WAGER_NOT_FOUND_OR_SETTLED');
    END IF;
    
    -- Calculate payout burn
    v_payout_burn := FLOOR(p_payout_amount * c_burn_rate);
    v_net_payout := p_payout_amount - v_payout_burn;
    
    -- Update wager record
    UPDATE arcade_wager_ledger
    SET outcome = p_outcome,
        payout_amount = p_payout_amount,
        payout_burn = v_payout_burn,
        net_payout = v_net_payout,
        settled = TRUE,
        settled_at = NOW()
    WHERE id = p_wager_id;
    
    -- Credit net payout to wallet
    IF v_net_payout > 0 THEN
        UPDATE wallets
        SET balance = balance + v_net_payout,
            updated_at = NOW()
        WHERE user_id = v_wager.user_id;
        
        -- Burn payout portion
        UPDATE burn_vault
        SET total_burned = total_burned + v_payout_burn,
            last_burn_amount = v_payout_burn,
            last_burn_source = 'ARCADE_PAYOUT',
            last_burn_at = NOW()
        WHERE id = 1;
    END IF;
    
    -- Get final balance
    SELECT balance INTO v_wallet FROM wallets WHERE user_id = v_wager.user_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'wager_id', p_wager_id,
        'settlement', jsonb_build_object(
            'outcome', p_outcome,
            'gross_payout', p_payout_amount,
            'payout_burn', v_payout_burn,
            'net_payout', v_net_payout
        ),
        'total_burned', jsonb_build_object(
            'wager_burn', v_wager.wager_burn,
            'payout_burn', v_payout_burn,
            'combined', v_wager.wager_burn + v_payout_burn
        ),
        'balance_after', COALESCE(v_wallet, 0),
        'task', 'ORB_07_ARCADE_WAGER_ENGINE'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 46: ORB_10_MARKETPLACE_ENGINE
-- ═══════════════════════════════════════════════════════════
-- Item Auction House: Every sale triggers activity ledger entry
-- ═══════════════════════════════════════════════════════════

-- Auction house listings
CREATE TABLE IF NOT EXISTS auction_house_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Item info
    item_id UUID NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_category VARCHAR(50) NOT NULL,
    item_rarity VARCHAR(20) DEFAULT 'COMMON',
    
    -- Auction config
    auction_type VARCHAR(20) NOT NULL DEFAULT 'FIXED',  -- FIXED, BID, DUTCH
    
    -- Pricing
    starting_price BIGINT NOT NULL,
    reserve_price BIGINT,
    buyout_price BIGINT,
    current_bid BIGINT DEFAULT 0,
    
    -- Seller
    seller_id UUID NOT NULL,
    
    -- Bidding
    highest_bidder_id UUID,
    bid_count INTEGER DEFAULT 0,
    
    -- Timing
    listed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, SOLD, EXPIRED, CANCELLED
    sold_at TIMESTAMPTZ,
    
    CONSTRAINT valid_auction_type CHECK (auction_type IN ('FIXED', 'BID', 'DUTCH'))
);

CREATE INDEX IF NOT EXISTS idx_auction_seller ON auction_house_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_auction_status ON auction_house_listings(status);
CREATE INDEX IF NOT EXISTS idx_auction_expires ON auction_house_listings(expires_at) WHERE status = 'ACTIVE';

COMMENT ON TABLE auction_house_listings IS '🏪 TASK 46: Auction house listings (Orb 10)';

-- Auction sale history
CREATE TABLE IF NOT EXISTS auction_sale_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    listing_id UUID NOT NULL REFERENCES auction_house_listings(id),
    
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    
    -- Sale details
    sale_price BIGINT NOT NULL,
    sale_type VARCHAR(20) NOT NULL,  -- BID_WIN, BUYOUT, FIXED_PURCHASE
    
    -- 25% Burn enforcement
    burn_amount BIGINT NOT NULL,
    seller_receives BIGINT NOT NULL,
    
    -- Activity ledger link
    activity_ledger_id UUID,
    
    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auction_sale_history IS '📋 TASK 46: Auction sale history with activity ledger link';

-- ═══════════════════════════════════════════════════════════
-- 🏪 fn_execute_auction_sale
-- Executes sale and records to activity ledger
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_execute_auction_sale(
    p_listing_id UUID,
    p_buyer_id UUID,
    p_sale_price BIGINT,
    p_sale_type VARCHAR(20)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_burn_rate CONSTANT NUMERIC := 0.25;  -- 25% HARD LAW
    
    v_listing RECORD;
    v_buyer_wallet RECORD;
    v_seller_wallet RECORD;
    v_burn_amount BIGINT;
    v_seller_amount BIGINT;
    v_sale_id UUID;
    v_buyer_activity_id UUID;
    v_seller_activity_id UUID;
BEGIN
    -- Lock listing
    SELECT * INTO v_listing
    FROM auction_house_listings
    WHERE id = p_listing_id AND status = 'ACTIVE'
    FOR UPDATE NOWAIT;
    
    IF v_listing IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'LISTING_NOT_AVAILABLE');
    END IF;
    
    -- Prevent self-purchase
    IF v_listing.seller_id = p_buyer_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_BUY_OWN_ITEM');
    END IF;
    
    -- Calculate split
    v_burn_amount := FLOOR(p_sale_price * c_burn_rate);
    v_seller_amount := p_sale_price - v_burn_amount;
    
    -- Get wallets
    SELECT * INTO v_buyer_wallet FROM wallets WHERE user_id = p_buyer_id FOR UPDATE;
    SELECT * INTO v_seller_wallet FROM wallets WHERE user_id = v_listing.seller_id FOR UPDATE;
    
    IF v_buyer_wallet.balance < p_sale_price THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_BALANCE',
            'required', p_sale_price,
            'available', v_buyer_wallet.balance
        );
    END IF;
    
    -- Execute transfer
    UPDATE wallets SET balance = balance - p_sale_price WHERE id = v_buyer_wallet.id;
    UPDATE wallets SET balance = balance + v_seller_amount WHERE id = v_seller_wallet.id;
    
    -- Record burn
    UPDATE burn_vault
    SET total_burned = total_burned + v_burn_amount,
        marketplace_burned = marketplace_burned + v_burn_amount,
        last_burn_amount = v_burn_amount,
        last_burn_source = 'AUCTION_HOUSE',
        last_burn_at = NOW()
    WHERE id = 1;
    
    -- Update listing
    UPDATE auction_house_listings
    SET status = 'SOLD',
        sold_at = NOW(),
        current_bid = p_sale_price,
        highest_bidder_id = p_buyer_id
    WHERE id = p_listing_id;
    
    -- Record sale
    INSERT INTO auction_sale_history (
        listing_id, buyer_id, seller_id, sale_price, sale_type,
        burn_amount, seller_receives
    ) VALUES (
        p_listing_id, p_buyer_id, v_listing.seller_id, p_sale_price, p_sale_type,
        v_burn_amount, v_seller_amount
    )
    RETURNING id INTO v_sale_id;
    
    -- Record to Activity Ledger (Buyer - DEBIT)
    INSERT INTO activity_ledger (
        user_id, orb_id, orb_name, activity_type,
        diamonds_delta, base_amount, activity_ref
    ) VALUES (
        p_buyer_id, 10, 'COMMAND_BRIDGE', 'AUCTION_PURCHASE',
        -p_sale_price, p_sale_price, v_sale_id
    )
    RETURNING id INTO v_buyer_activity_id;
    
    -- Record to Activity Ledger (Seller - CREDIT)
    INSERT INTO activity_ledger (
        user_id, orb_id, orb_name, activity_type,
        diamonds_delta, base_amount, burn_amount, burn_enforced, activity_ref
    ) VALUES (
        v_listing.seller_id, 10, 'COMMAND_BRIDGE', 'AUCTION_SALE',
        v_seller_amount, p_sale_price, v_burn_amount, TRUE, v_sale_id
    )
    RETURNING id INTO v_seller_activity_id;
    
    -- Link activity to sale
    UPDATE auction_sale_history
    SET activity_ledger_id = v_seller_activity_id
    WHERE id = v_sale_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'sale_id', v_sale_id,
        'item', jsonb_build_object(
            'id', v_listing.item_id,
            'name', v_listing.item_name,
            'category', v_listing.item_category
        ),
        'transaction', jsonb_build_object(
            'sale_price', p_sale_price,
            'burn_amount', v_burn_amount,
            'seller_receives', v_seller_amount,
            'burn_rate', '25%'
        ),
        'parties', jsonb_build_object(
            'buyer', p_buyer_id,
            'seller', v_listing.seller_id
        ),
        'activity_ledger', jsonb_build_object(
            'buyer_entry', v_buyer_activity_id,
            'seller_entry', v_seller_activity_id,
            'transparency', 'FULL_AUDIT_TRAIL'
        ),
        'task', 'ORB_10_MARKETPLACE_ENGINE'
    );
    
EXCEPTION
    WHEN lock_not_available THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'LISTING_LOCKED');
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 ORB LOGIC STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW orb_logic_status AS
SELECT 
    -- Task 44: Arena Stakes
    (SELECT COUNT(*) FROM arena_stake_tiers WHERE is_active = TRUE) AS arena_tiers_active,
    (SELECT COUNT(*) FROM arena_access_log WHERE access_granted = TRUE) AS arena_accesses_granted,
    (SELECT COUNT(*) FROM arena_access_log WHERE access_granted = FALSE) AS arena_accesses_denied,
    
    -- Task 45: Arcade Wager
    (SELECT COUNT(*) FROM arcade_wager_ledger) AS total_wagers,
    (SELECT COALESCE(SUM(wager_burn), 0) FROM arcade_wager_ledger) AS total_wager_burn,
    (SELECT COALESCE(SUM(payout_burn), 0) FROM arcade_wager_ledger WHERE settled = TRUE) AS total_payout_burn,
    
    -- Task 46: Auction House
    (SELECT COUNT(*) FROM auction_house_listings) AS total_listings,
    (SELECT COUNT(*) FROM auction_sale_history) AS total_sales,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM auction_sale_history) AS auction_burn_total,
    
    NOW() AS verified_at;

COMMENT ON VIEW orb_logic_status IS '📊 ORB LOGIC Status (Tasks 44-46)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON arena_stake_tiers TO authenticated;
GRANT SELECT ON arena_access_log TO authenticated;
GRANT SELECT ON arcade_wager_ledger TO authenticated;
GRANT SELECT ON auction_house_listings TO authenticated;
GRANT SELECT ON auction_sale_history TO authenticated;
GRANT SELECT ON orb_logic_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_get_arena_access_tier TO authenticated;
GRANT EXECUTE ON FUNCTION fn_request_arena_access TO authenticated;
GRANT EXECUTE ON FUNCTION fn_place_arcade_wager TO authenticated;
GRANT EXECUTE ON FUNCTION fn_settle_arcade_wager TO authenticated;
GRANT EXECUTE ON FUNCTION fn_execute_auction_sale TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ SOVEREIGN ORB LOGIC COMPLETE
-- ═══════════════════════════════════════════════════════════
