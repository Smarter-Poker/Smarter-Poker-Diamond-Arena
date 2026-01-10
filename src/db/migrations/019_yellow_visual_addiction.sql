-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 019
-- YELLOW VISUAL ADDICTION (TASKS 19-21)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 19: DIAMOND_MINT_PARTICLE_SYSTEM
-- TASK 20: MULTIPLIER_FIRE_UI_SYNC
-- TASK 21: ECONOMY_SUPPLY_BURN_TICKER
--
-- DANGEROUS_OMNIPOTENCE_OVERRIDE: ACTIVE
-- VISUAL_ADDICTION: ENABLED
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 19: DIAMOND_MINT_PARTICLE_SYSTEM
-- ═══════════════════════════════════════════════════════════
-- Map 'Reward_Burst' event data
-- Logic: Return 'count' and 'rarity_type' for particle rendering
-- ═══════════════════════════════════════════════════════════

-- Particle configuration table
CREATE TABLE IF NOT EXISTS reward_particle_config (
    id SERIAL PRIMARY KEY,
    
    -- Rarity thresholds
    tier VARCHAR(20) NOT NULL,
    min_diamonds BIGINT NOT NULL,
    max_diamonds BIGINT,
    
    -- Visual config
    particle_count INTEGER NOT NULL,
    particle_color VARCHAR(7) NOT NULL,  -- Hex color
    particle_size VARCHAR(10) NOT NULL,  -- 'SMALL', 'MEDIUM', 'LARGE', 'EPIC'
    burst_intensity VARCHAR(10) NOT NULL,  -- 'LOW', 'MEDIUM', 'HIGH', 'MAXIMUM'
    
    -- Animation
    animation_duration_ms INTEGER NOT NULL,
    sound_effect VARCHAR(50),
    screen_shake BOOLEAN DEFAULT FALSE,
    
    -- Display
    emoji VARCHAR(10) NOT NULL,
    label VARCHAR(50) NOT NULL,
    
    UNIQUE(tier)
);

-- Seed particle config
INSERT INTO reward_particle_config (tier, min_diamonds, max_diamonds, particle_count, particle_color, particle_size, burst_intensity, animation_duration_ms, sound_effect, screen_shake, emoji, label) VALUES
    ('TINY', 1, 5, 5, '#94A3B8', 'SMALL', 'LOW', 500, 'coin_small', FALSE, '💠', 'Small Reward'),
    ('SMALL', 6, 15, 12, '#60A5FA', 'SMALL', 'LOW', 750, 'coin_medium', FALSE, '💎', 'Nice Reward'),
    ('MEDIUM', 16, 50, 25, '#3B82F6', 'MEDIUM', 'MEDIUM', 1000, 'coin_burst', FALSE, '💎✨', 'Good Reward'),
    ('LARGE', 51, 100, 40, '#F59E0B', 'MEDIUM', 'HIGH', 1200, 'jackpot_small', TRUE, '💎🔥', 'Great Reward!'),
    ('EPIC', 101, 250, 60, '#8B5CF6', 'LARGE', 'HIGH', 1500, 'jackpot_medium', TRUE, '💎💎', 'EPIC Reward!'),
    ('LEGENDARY', 251, 500, 100, '#EC4899', 'LARGE', 'MAXIMUM', 2000, 'jackpot_legendary', TRUE, '👑💎', 'LEGENDARY!'),
    ('MYTHIC', 501, NULL, 150, '#F472B6', 'EPIC', 'MAXIMUM', 3000, 'jackpot_mythic', TRUE, '🌟💎👑', 'MYTHIC JACKPOT!')
ON CONFLICT (tier) DO UPDATE SET
    particle_count = EXCLUDED.particle_count,
    particle_color = EXCLUDED.particle_color;

COMMENT ON TABLE reward_particle_config IS '✨ TASK 19: Particle configuration for reward bursts';

-- ═══════════════════════════════════════════════════════════
-- ✨ fn_get_reward_burst_data
-- Returns visual data for particle system
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_reward_burst_data(
    p_diamond_count BIGINT,
    p_source VARCHAR(50) DEFAULT 'REWARD'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config RECORD;
    v_tier_index INTEGER;
BEGIN
    -- Find matching tier
    SELECT * INTO v_config
    FROM reward_particle_config
    WHERE min_diamonds <= p_diamond_count
      AND (max_diamonds IS NULL OR max_diamonds >= p_diamond_count)
    ORDER BY min_diamonds DESC
    LIMIT 1;
    
    -- Default to TINY if no match
    IF v_config IS NULL THEN
        SELECT * INTO v_config
        FROM reward_particle_config
        WHERE tier = 'TINY';
    END IF;
    
    -- Get tier index for rarity
    SELECT CASE v_config.tier
        WHEN 'TINY' THEN 1
        WHEN 'SMALL' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LARGE' THEN 4
        WHEN 'EPIC' THEN 5
        WHEN 'LEGENDARY' THEN 6
        WHEN 'MYTHIC' THEN 7
    END INTO v_tier_index;
    
    RETURN jsonb_build_object(
        'reward_burst', jsonb_build_object(
            'count', p_diamond_count,
            'rarity_type', v_config.tier,
            'rarity_index', v_tier_index,
            'is_jackpot', v_config.tier IN ('LEGENDARY', 'MYTHIC')
        ),
        'particles', jsonb_build_object(
            'count', v_config.particle_count,
            'color', v_config.particle_color,
            'size', v_config.particle_size,
            'intensity', v_config.burst_intensity
        ),
        'animation', jsonb_build_object(
            'duration_ms', v_config.animation_duration_ms,
            'sound_effect', v_config.sound_effect,
            'screen_shake', v_config.screen_shake
        ),
        'display', jsonb_build_object(
            'emoji', v_config.emoji,
            'label', v_config.label,
            'source', p_source
        ),
        'visual_cue', format('%s +%s 💎', v_config.emoji, p_diamond_count),
        'task', 'DIAMOND_MINT_PARTICLE_SYSTEM'
    );
END;
$$;

COMMENT ON FUNCTION fn_get_reward_burst_data IS '✨ TASK 19: Get particle burst data for reward visualization';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 20: MULTIPLIER_FIRE_UI_SYNC
-- ═══════════════════════════════════════════════════════════
-- Map 'Fire_Bonus_Overlay'
-- Logic: Render multiplier icon over every payout
-- ═══════════════════════════════════════════════════════════

-- Multiplier overlay configuration
CREATE TABLE IF NOT EXISTS multiplier_overlay_config (
    id SERIAL PRIMARY KEY,
    
    tier VARCHAR(20) NOT NULL,
    min_days INTEGER NOT NULL,
    multiplier NUMERIC(4,2) NOT NULL,
    
    -- Visual
    icon VARCHAR(20) NOT NULL,
    icon_color VARCHAR(7) NOT NULL,
    glow_color VARCHAR(7) NOT NULL,
    animation_class VARCHAR(50) NOT NULL,
    
    -- Label
    label_text VARCHAR(30) NOT NULL,
    label_color VARCHAR(7) NOT NULL,
    
    -- Effects
    fire_intensity INTEGER NOT NULL,  -- 0-100
    pulse_speed VARCHAR(10) NOT NULL,  -- 'NONE', 'SLOW', 'MEDIUM', 'FAST'
    
    UNIQUE(tier)
);

-- Seed overlay config
INSERT INTO multiplier_overlay_config (tier, min_days, multiplier, icon, icon_color, glow_color, animation_class, label_text, label_color, fire_intensity, pulse_speed) VALUES
    ('COLD', 0, 1.00, '❄️', '#9CA3AF', '#374151', 'fade-in', '', '#6B7280', 0, 'NONE'),
    ('WARMING_UP', 1, 1.10, '🌡️', '#F97316', '#EA580C', 'glow-pulse', '+10%', '#F97316', 20, 'SLOW'),
    ('WARMING', 3, 1.20, '🔥', '#F59E0B', '#D97706', 'fire-pulse', '1.2×', '#F59E0B', 40, 'SLOW'),
    ('HOT', 7, 1.50, '🔥🔥', '#EF4444', '#DC2626', 'fire-intense', '1.5×', '#EF4444', 60, 'MEDIUM'),
    ('BLAZING', 14, 1.75, '🔥🔥🔥', '#F472B6', '#EC4899', 'fire-blazing', '1.75×', '#EC4899', 80, 'FAST'),
    ('LEGENDARY', 30, 2.00, '👑🔥', '#8B5CF6', '#7C3AED', 'fire-legendary', '2.0×', '#8B5CF6', 100, 'FAST')
ON CONFLICT (tier) DO UPDATE SET
    multiplier = EXCLUDED.multiplier,
    icon = EXCLUDED.icon;

COMMENT ON TABLE multiplier_overlay_config IS '🔥 TASK 20: Multiplier overlay configuration for UI sync';

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_get_fire_bonus_overlay
-- Returns overlay data for multiplier visualization
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_fire_bonus_overlay(
    p_user_id UUID,
    p_payout_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak_days INTEGER;
    v_overlay RECORD;
    v_base_reward BIGINT;
    v_streak_bonus BIGINT;
BEGIN
    -- Get user's streak
    SELECT COALESCE(current_streak, 0) INTO v_streak_days
    FROM wallets
    WHERE user_id = p_user_id;
    
    IF v_streak_days IS NULL THEN
        v_streak_days := 0;
    END IF;
    
    -- Find matching overlay
    SELECT * INTO v_overlay
    FROM multiplier_overlay_config
    WHERE min_days <= v_streak_days
    ORDER BY min_days DESC
    LIMIT 1;
    
    -- Calculate base vs bonus
    IF v_overlay.multiplier > 1 THEN
        v_base_reward := FLOOR(p_payout_amount / v_overlay.multiplier);
        v_streak_bonus := p_payout_amount - v_base_reward;
    ELSE
        v_base_reward := p_payout_amount;
        v_streak_bonus := 0;
    END IF;
    
    RETURN jsonb_build_object(
        'fire_bonus_overlay', jsonb_build_object(
            'active', v_streak_days >= 1,
            'tier', v_overlay.tier,
            'streak_days', v_streak_days,
            'multiplier', v_overlay.multiplier
        ),
        'icon', jsonb_build_object(
            'emoji', v_overlay.icon,
            'color', v_overlay.icon_color,
            'glow', v_overlay.glow_color,
            'animation', v_overlay.animation_class
        ),
        'label', jsonb_build_object(
            'text', v_overlay.label_text,
            'color', v_overlay.label_color,
            'visible', v_overlay.multiplier > 1
        ),
        'effects', jsonb_build_object(
            'fire_intensity', v_overlay.fire_intensity,
            'pulse_speed', v_overlay.pulse_speed
        ),
        'payout', jsonb_build_object(
            'total', p_payout_amount,
            'base_reward', v_base_reward,
            'streak_bonus', v_streak_bonus,
            'formula', CASE WHEN v_streak_bonus > 0 
                THEN format('%s + %s = %s 💎', v_base_reward, v_streak_bonus, p_payout_amount)
                ELSE format('%s 💎', p_payout_amount)
            END
        ),
        'ui_render', jsonb_build_object(
            'show_multiplier_badge', v_overlay.multiplier > 1,
            'badge_text', v_overlay.label_text,
            'badge_css', format('color: %s; text-shadow: 0 0 10px %s;', v_overlay.label_color, v_overlay.glow_color)
        ),
        'task', 'MULTIPLIER_FIRE_UI_SYNC'
    );
END;
$$;

COMMENT ON FUNCTION fn_get_fire_bonus_overlay IS '🔥 TASK 20: Get fire bonus overlay for payout visualization';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 21: ECONOMY_SUPPLY_BURN_TICKER
-- ═══════════════════════════════════════════════════════════
-- Map real-time 'Burn_Count' ticker for marketplace
-- Visual: Shows total Diamonds destroyed by 25% Burn Law
-- ═══════════════════════════════════════════════════════════

-- Burn ticker snapshot table (for animations)
CREATE TABLE IF NOT EXISTS burn_ticker_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Snapshot data
    total_burned BIGINT NOT NULL,
    marketplace_burned BIGINT NOT NULL,
    training_burned BIGINT DEFAULT 0,
    
    -- Rate calculations
    burn_rate_per_hour NUMERIC,
    burn_rate_per_day NUMERIC,
    
    -- Supply context
    total_minted BIGINT,
    circulating_supply BIGINT,
    deflation_percentage NUMERIC(7,4),
    
    -- Animation data
    previous_total BIGINT,
    delta_since_last BIGINT,
    
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_burn_ticker_time ON burn_ticker_snapshots(snapshot_at DESC);

COMMENT ON TABLE burn_ticker_snapshots IS '🔥 TASK 21: Burn ticker snapshots for real-time display';

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_get_burn_ticker_data
-- Returns real-time burn ticker for marketplace
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_burn_ticker_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vault RECORD;
    v_total_minted BIGINT;
    v_circulating BIGINT;
    v_deflation NUMERIC;
    v_previous RECORD;
    v_burn_rate_hour NUMERIC;
    v_burn_rate_day NUMERIC;
    v_delta BIGINT;
BEGIN
    -- Get current burn vault data
    SELECT * INTO v_vault
    FROM burn_vault
    WHERE id = 1;
    
    IF v_vault IS NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'ticker', jsonb_build_object(
                'total_burned', 0,
                'display', '0 💎',
                'status', 'NO_BURNS_YET'
            )
        );
    END IF;
    
    -- Get total minted
    SELECT COALESCE(SUM(amount), 0) INTO v_total_minted
    FROM transactions WHERE type = 'CREDIT';
    
    -- Get circulating
    SELECT COALESCE(SUM(balance), 0) INTO v_circulating
    FROM wallets WHERE user_id != '00000000-0000-0000-0000-000000000000';
    
    -- Calculate deflation
    v_deflation := CASE WHEN v_total_minted > 0 
        THEN (v_vault.total_burned::NUMERIC / v_total_minted) * 100
        ELSE 0
    END;
    
    -- Get previous snapshot for delta
    SELECT total_burned, snapshot_at INTO v_previous
    FROM burn_ticker_snapshots
    ORDER BY snapshot_at DESC
    LIMIT 1;
    
    v_delta := v_vault.total_burned - COALESCE(v_previous.total_burned, 0);
    
    -- Calculate burn rates (approximate)
    IF v_previous.snapshot_at IS NOT NULL THEN
        v_burn_rate_hour := v_delta::NUMERIC / 
            GREATEST(EXTRACT(EPOCH FROM (NOW() - v_previous.snapshot_at)) / 3600, 0.01);
        v_burn_rate_day := v_burn_rate_hour * 24;
    END IF;
    
    -- Record snapshot
    INSERT INTO burn_ticker_snapshots (
        total_burned, marketplace_burned, 
        total_minted, circulating_supply, deflation_percentage,
        previous_total, delta_since_last,
        burn_rate_per_hour, burn_rate_per_day
    ) VALUES (
        v_vault.total_burned, v_vault.marketplace_burned,
        v_total_minted, v_circulating, v_deflation,
        v_previous.total_burned, v_delta,
        v_burn_rate_hour, v_burn_rate_day
    );
    
    -- Return ticker data
    RETURN jsonb_build_object(
        'success', TRUE,
        'ticker', jsonb_build_object(
            'total_burned', v_vault.total_burned,
            'display', format('%s 💎 burned', TO_CHAR(v_vault.total_burned, 'FM999,999,999')),
            'animated_display', format('🔥 %s', TO_CHAR(v_vault.total_burned, 'FM999,999,999'))
        ),
        'breakdown', jsonb_build_object(
            'marketplace', v_vault.marketplace_burned,
            'other', v_vault.total_burned - v_vault.marketplace_burned
        ),
        'live_delta', jsonb_build_object(
            'since_last_check', v_delta,
            'display', CASE WHEN v_delta > 0 THEN format('+%s', v_delta) ELSE '0' END,
            'show_animation', v_delta > 0
        ),
        'rates', jsonb_build_object(
            'per_hour', ROUND(COALESCE(v_burn_rate_hour, 0), 2),
            'per_day', ROUND(COALESCE(v_burn_rate_day, 0), 2),
            'display', format('~%s/hr', ROUND(COALESCE(v_burn_rate_hour, 0)))
        ),
        'economy', jsonb_build_object(
            'total_minted', v_total_minted,
            'circulating', v_circulating,
            'deflation_rate', ROUND(v_deflation, 4) || '%',
            'is_deflationary', v_vault.total_burned > 0
        ),
        'last_burn', jsonb_build_object(
            'amount', v_vault.last_burn_amount,
            'source', v_vault.last_burn_source,
            'at', v_vault.last_burn_at
        ),
        'law', '25_PERCENT_BURN_LAW',
        'task', 'ECONOMY_SUPPLY_BURN_TICKER'
    );
END;
$$;

COMMENT ON FUNCTION fn_get_burn_ticker_data IS '📊 TASK 21: Get real-time burn ticker for marketplace display';

-- ═══════════════════════════════════════════════════════════
-- 📊 VISUAL ADDICTION STATUS VIEW
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_visual_addiction_status AS
SELECT 
    -- Task 19: Particle System
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_get_reward_burst_data')) AS particle_system_active,
    (SELECT COUNT(*) FROM reward_particle_config) AS particle_configs,
    
    -- Task 20: Fire UI Sync
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_get_fire_bonus_overlay')) AS fire_overlay_active,
    (SELECT COUNT(*) FROM multiplier_overlay_config) AS overlay_configs,
    
    -- Task 21: Burn Ticker
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_get_burn_ticker_data')) AS burn_ticker_active,
    (SELECT COUNT(*) FROM burn_ticker_snapshots) AS ticker_snapshots,
    (SELECT total_burned FROM burn_vault WHERE id = 1) AS current_burn_total,
    
    NOW() AS verified_at;

COMMENT ON VIEW yellow_visual_addiction_status IS '📊 YELLOW VISUAL ADDICTION Status (Tasks 19-21)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON reward_particle_config TO authenticated;
GRANT SELECT ON multiplier_overlay_config TO authenticated;
GRANT SELECT ON burn_ticker_snapshots TO authenticated;
GRANT SELECT ON yellow_visual_addiction_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_get_reward_burst_data TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_fire_bonus_overlay TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_burn_ticker_data TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW VISUAL ADDICTION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 19: DIAMOND_MINT_PARTICLE_SYSTEM ✅
--   - fn_get_reward_burst_data
--   - Returns count, rarity_type, particle config
--   - 7 tiers: TINY → MYTHIC
--
-- TASK 20: MULTIPLIER_FIRE_UI_SYNC ✅
--   - fn_get_fire_bonus_overlay
--   - Renders 1.5x/2.0x multiplier icon
--   - Fire intensity and pulse animations
--
-- TASK 21: ECONOMY_SUPPLY_BURN_TICKER ✅
--   - fn_get_burn_ticker_data
--   - Real-time burn count display
--   - Shows total destroyed by 25% Burn Law
--
-- ═══════════════════════════════════════════════════════════
