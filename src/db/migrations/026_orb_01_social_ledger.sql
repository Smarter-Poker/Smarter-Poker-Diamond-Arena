-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 026
-- ORB_01 SOCIAL LEDGER (SOCIAL DNA)
-- ═══════════════════════════════════════════════════════════
-- 
-- Creates 'social_transactions' table with the 25% Burn Law
-- applied to all tips and badge purchases.
--
-- @target Orb 01 - Social Shell / Identity DNA
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 SOCIAL TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS social_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Transaction type
    tx_type VARCHAR(20) NOT NULL,  -- TIP, BADGE_PURCHASE, GIFT, etc.
    
    -- Parties
    sender_id UUID NOT NULL,
    recipient_id UUID,  -- NULL for badge purchases
    
    -- Amounts
    amount BIGINT NOT NULL,
    burn_amount BIGINT NOT NULL,  -- 25% HARD LAW
    recipient_receives BIGINT NOT NULL,  -- 75% to recipient
    
    -- Message (for tips)
    message TEXT,
    
    -- Badge info (for badge purchases)
    badge_id VARCHAR(50),
    badge_name VARCHAR(100),
    
    -- Verification
    burn_enforced BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_sender ON social_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_social_recipient ON social_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_social_type ON social_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_social_time ON social_transactions(created_at DESC);

COMMENT ON TABLE social_transactions IS '💝 ORB_01: Social transactions with 25% burn law';

-- ═══════════════════════════════════════════════════════════
-- 🎖️ USER BADGES TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Badge info
    badge_id VARCHAR(50) NOT NULL,
    badge_name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    rarity VARCHAR(20) NOT NULL,
    icon VARCHAR(10),
    
    -- Purchase info
    price_paid BIGINT NOT NULL,
    burn_amount BIGINT NOT NULL,
    
    -- Display
    is_showcase BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_showcase ON user_badges(is_showcase) WHERE is_showcase = TRUE;

COMMENT ON TABLE user_badges IS '🎖️ ORB_01: User badge collection';

-- ═══════════════════════════════════════════════════════════
-- 💝 fn_send_social_tip
-- Processes tip with 25% burn
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_send_social_tip(
    p_sender_id UUID,
    p_recipient_id UUID,
    p_amount BIGINT,
    p_burn_amount BIGINT,
    p_recipient_receives BIGINT,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_wallet RECORD;
    v_recipient_wallet RECORD;
    v_tx_id UUID;
BEGIN
    -- Prevent self-tipping
    IF p_sender_id = p_recipient_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_TIP_SELF');
    END IF;
    
    -- Get sender wallet
    SELECT * INTO v_sender_wallet
    FROM wallets WHERE user_id = p_sender_id
    FOR UPDATE;
    
    IF v_sender_wallet IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SENDER_WALLET_NOT_FOUND');
    END IF;
    
    IF v_sender_wallet.balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_BALANCE',
            'required', p_amount,
            'available', v_sender_wallet.balance
        );
    END IF;
    
    -- Get or create recipient wallet
    SELECT * INTO v_recipient_wallet
    FROM wallets WHERE user_id = p_recipient_id
    FOR UPDATE;
    
    IF v_recipient_wallet IS NULL THEN
        INSERT INTO wallets (user_id, balance)
        VALUES (p_recipient_id, 0)
        RETURNING * INTO v_recipient_wallet;
    END IF;
    
    -- Deduct from sender
    UPDATE wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_sender_wallet.id;
    
    -- Credit to recipient (minus burn)
    UPDATE wallets
    SET balance = balance + p_recipient_receives,
        updated_at = NOW()
    WHERE id = v_recipient_wallet.id;
    
    -- Record burn
    UPDATE burn_vault
    SET total_burned = total_burned + p_burn_amount,
        last_burn_amount = p_burn_amount,
        last_burn_source = 'SOCIAL_TIP',
        last_burn_at = NOW()
    WHERE id = 1;
    
    -- Record transaction
    INSERT INTO social_transactions (
        tx_type, sender_id, recipient_id,
        amount, burn_amount, recipient_receives,
        message, burn_enforced
    ) VALUES (
        'TIP', p_sender_id, p_recipient_id,
        p_amount, p_burn_amount, p_recipient_receives,
        p_message, TRUE
    )
    RETURNING id INTO v_tx_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'tx_id', v_tx_id,
        'tip', jsonb_build_object(
            'amount', p_amount,
            'burned', p_burn_amount,
            'recipient_receives', p_recipient_receives
        ),
        'balances', jsonb_build_object(
            'sender_new', v_sender_wallet.balance - p_amount,
            'recipient_new', v_recipient_wallet.balance + p_recipient_receives
        ),
        'formula', format('%s - %s (🔥) = %s 💝', p_amount, p_burn_amount, p_recipient_receives)
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🎖️ fn_mint_badge
-- Mints badge with 25% burn
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mint_badge(
    p_user_id UUID,
    p_badge_id VARCHAR(50),
    p_badge_name VARCHAR(100),
    p_badge_category VARCHAR(30),
    p_badge_rarity VARCHAR(20),
    p_price BIGINT,
    p_burn_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_badge_id UUID;
    v_tx_id UUID;
BEGIN
    -- Check if user already owns badge
    IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'BADGE_ALREADY_OWNED');
    END IF;
    
    -- Get wallet
    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'WALLET_NOT_FOUND');
    END IF;
    
    IF v_wallet.balance < p_price THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'INSUFFICIENT_BALANCE',
            'required', p_price,
            'available', v_wallet.balance
        );
    END IF;
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance = balance - p_price,
        updated_at = NOW()
    WHERE id = v_wallet.id;
    
    -- Record burn
    UPDATE burn_vault
    SET total_burned = total_burned + p_burn_amount,
        last_burn_amount = p_burn_amount,
        last_burn_source = 'BADGE_PURCHASE',
        last_burn_at = NOW()
    WHERE id = 1;
    
    -- Mint badge
    INSERT INTO user_badges (
        user_id, badge_id, badge_name, category, rarity,
        price_paid, burn_amount
    ) VALUES (
        p_user_id, p_badge_id, p_badge_name, p_badge_category, p_badge_rarity,
        p_price, p_burn_amount
    )
    RETURNING id INTO v_badge_id;
    
    -- Record transaction
    INSERT INTO social_transactions (
        tx_type, sender_id, amount, burn_amount, recipient_receives,
        badge_id, badge_name, burn_enforced
    ) VALUES (
        'BADGE_PURCHASE', p_user_id, p_price, p_burn_amount, 0,
        p_badge_id, p_badge_name, TRUE
    )
    RETURNING id INTO v_tx_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'badge_instance_id', v_badge_id,
        'tx_id', v_tx_id,
        'badge', jsonb_build_object(
            'id', p_badge_id,
            'name', p_badge_name,
            'category', p_badge_category,
            'rarity', p_badge_rarity
        ),
        'cost', jsonb_build_object(
            'price', p_price,
            'burned', p_burn_amount
        ),
        'balance_after', v_wallet.balance - p_price
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 SOCIAL ACTIVITY VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW social_activity_stats AS
SELECT 
    -- Tipping stats
    (SELECT COUNT(*) FROM social_transactions WHERE tx_type = 'TIP') AS total_tips,
    (SELECT COALESCE(SUM(amount), 0) FROM social_transactions WHERE tx_type = 'TIP') AS total_tip_volume,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM social_transactions WHERE tx_type = 'TIP') AS tip_burn_total,
    
    -- Badge stats
    (SELECT COUNT(*) FROM social_transactions WHERE tx_type = 'BADGE_PURCHASE') AS total_badge_purchases,
    (SELECT COALESCE(SUM(amount), 0) FROM social_transactions WHERE tx_type = 'BADGE_PURCHASE') AS badge_purchase_volume,
    (SELECT COALESCE(SUM(burn_amount), 0) FROM social_transactions WHERE tx_type = 'BADGE_PURCHASE') AS badge_burn_total,
    
    -- User badge counts
    (SELECT COUNT(*) FROM user_badges) AS total_badges_minted,
    (SELECT COUNT(DISTINCT user_id) FROM user_badges) AS unique_badge_holders,
    
    NOW() AS verified_at;

COMMENT ON VIEW social_activity_stats IS '📊 ORB_01: Social activity statistics';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON social_transactions TO authenticated;
GRANT SELECT ON user_badges TO authenticated;
GRANT SELECT ON social_activity_stats TO authenticated;

GRANT EXECUTE ON FUNCTION fn_send_social_tip TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mint_badge TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ ORB_01 SOCIAL LEDGER COMPLETE
-- ═══════════════════════════════════════════════════════════
