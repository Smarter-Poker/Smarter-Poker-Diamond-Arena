-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 016
-- YELLOW ADDICTION ENGINE (TASKS 7-9)
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 07: STREAK_FIRE_MULTIPLIER_UI_HOOK
-- TASK 08: THE DIAMOND_CHEST_VAULT
-- TASK 09: ECONOMY_HEALTH_AUDIT_LOG
--
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 07: STREAK_FIRE_MULTIPLIER_UI_HOOK
-- ═══════════════════════════════════════════════════════════
-- Map 'streak_tier_visuals'
-- Logic: Return Fire_Intensity metadata (Blue/Gold/Purple) based on streak
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_tier_visuals (
    id SERIAL PRIMARY KEY,
    
    -- Streak range
    min_days INTEGER NOT NULL,
    max_days INTEGER,  -- NULL = infinity
    
    -- Fire intensity (UI hook)
    fire_intensity VARCHAR(20) NOT NULL,
    fire_color VARCHAR(30) NOT NULL,
    fire_hex VARCHAR(7) NOT NULL,
    
    -- Visual assets
    glow_effect VARCHAR(50),
    particle_system VARCHAR(50),
    animation_speed NUMERIC(3,2) DEFAULT 1.00,
    
    -- Audio cues
    sound_effect VARCHAR(100),
    
    -- Display
    tier_name VARCHAR(30) NOT NULL,
    display_label VARCHAR(50) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    
    -- Engagement multipliers (visual emphasis)
    visual_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear and populate visual tiers
TRUNCATE streak_tier_visuals RESTART IDENTITY;

INSERT INTO streak_tier_visuals (min_days, max_days, fire_intensity, fire_color, fire_hex, glow_effect, particle_system, animation_speed, sound_effect, tier_name, display_label, emoji, visual_multiplier) VALUES
    -- No streak: Cold/Gray
    (0, 0, 'NONE', 'GRAY', '#6B7280', NULL, NULL, 1.00, NULL, 'COLD', 'No Streak', '❄️', 1.00),
    
    -- Day 1-2: Warming/Orange
    (1, 2, 'LOW', 'ORANGE', '#F97316', 'glow_subtle', 'embers_slow', 0.75, 'spark_soft', 'WARMING', 'Getting Warm', '🌡️', 1.10),
    
    -- Day 3-6: Blue Fire (Tier 1)
    (3, 6, 'MEDIUM', 'BLUE', '#3B82F6', 'glow_pulse', 'flames_blue', 1.00, 'fire_crackle', 'BLUE_FIRE', '🔥 Blue Fire', '🔵', 1.20),
    
    -- Day 7-13: Gold Fire (Tier 2)
    (7, 13, 'HIGH', 'GOLD', '#F59E0B', 'glow_intense', 'flames_gold', 1.25, 'fire_roar', 'GOLD_FIRE', '🔥 Gold Fire', '🟡', 1.50),
    
    -- Day 14-29: Purple Fire (Blazing)
    (14, 29, 'VERY_HIGH', 'PURPLE', '#8B5CF6', 'glow_pulsing', 'flames_purple', 1.50, 'fire_intense', 'PURPLE_FIRE', '🔥 Purple Fire', '🟣', 1.75),
    
    -- Day 30+: Legendary Rainbow Fire
    (30, NULL, 'MAXIMUM', 'RAINBOW', '#EC4899', 'glow_legendary', 'flames_rainbow', 2.00, 'legendary_blaze', 'LEGENDARY_FIRE', '👑 Legendary', '👑', 2.00);

COMMENT ON TABLE streak_tier_visuals IS '🔥 TASK 07: Streak Fire UI Hook - Visual intensity metadata';

-- ═══════════════════════════════════════════════════════════
-- 🔥 fn_get_streak_fire_visuals
-- Returns complete UI metadata for streak visualization
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_streak_fire_visuals(p_streak_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_visual RECORD;
    v_next_visual RECORD;
    v_progress_to_next NUMERIC;
BEGIN
    -- Get current tier visuals
    SELECT * INTO v_visual
    FROM streak_tier_visuals
    WHERE p_streak_days >= min_days 
      AND (max_days IS NULL OR p_streak_days <= max_days)
    ORDER BY min_days DESC
    LIMIT 1;

    -- Get next tier for progress tracking
    SELECT * INTO v_next_visual
    FROM streak_tier_visuals
    WHERE min_days > p_streak_days
    ORDER BY min_days ASC
    LIMIT 1;

    -- Calculate progress to next tier
    IF v_next_visual IS NOT NULL AND v_visual IS NOT NULL THEN
        v_progress_to_next := LEAST(100, 
            ((p_streak_days - v_visual.min_days)::NUMERIC / 
             NULLIF(v_next_visual.min_days - v_visual.min_days, 0)::NUMERIC) * 100
        );
    ELSE
        v_progress_to_next := 100;  -- At max tier
    END IF;

    IF v_visual IS NULL THEN
        RETURN jsonb_build_object(
            'streak_days', p_streak_days,
            'fire_intensity', 'NONE',
            'fire_color', 'GRAY',
            'tier_name', 'COLD'
        );
    END IF;

    RETURN jsonb_build_object(
        'streak_days', p_streak_days,
        'fire', jsonb_build_object(
            'intensity', v_visual.fire_intensity,
            'color', v_visual.fire_color,
            'hex', v_visual.fire_hex,
            'glow_effect', v_visual.glow_effect,
            'particle_system', v_visual.particle_system,
            'animation_speed', v_visual.animation_speed
        ),
        'audio', jsonb_build_object(
            'sound_effect', v_visual.sound_effect
        ),
        'display', jsonb_build_object(
            'tier_name', v_visual.tier_name,
            'label', v_visual.display_label,
            'emoji', v_visual.emoji,
            'visual_multiplier', v_visual.visual_multiplier
        ),
        'progress', jsonb_build_object(
            'current_tier', v_visual.tier_name,
            'next_tier', v_next_visual.tier_name,
            'next_color', v_next_visual.fire_color,
            'days_to_next', CASE WHEN v_next_visual IS NOT NULL THEN v_next_visual.min_days - p_streak_days ELSE 0 END,
            'progress_percent', ROUND(v_progress_to_next, 1)
        )
    );
END;
$$;

COMMENT ON FUNCTION fn_get_streak_fire_visuals IS '🔥 TASK 07: Get streak fire UI metadata (Blue/Gold/Purple)';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 08: THE DIAMOND_CHEST_VAULT
-- ═══════════════════════════════════════════════════════════
-- Map 'loot_table_config' for training completions
-- Logic: Random chance for "Diamond Jackpots" on 100% perfect sessions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS loot_table_config (
    id SERIAL PRIMARY KEY,
    
    -- Loot tier
    tier VARCHAR(30) NOT NULL UNIQUE,
    tier_order INTEGER NOT NULL,
    
    -- Drop rates (percentage out of 100)
    drop_rate NUMERIC(5,2) NOT NULL CHECK (drop_rate >= 0 AND drop_rate <= 100),
    
    -- Reward ranges
    min_diamonds BIGINT NOT NULL CHECK (min_diamonds >= 0),
    max_diamonds BIGINT NOT NULL CHECK (max_diamonds >= min_diamonds),
    
    -- Special conditions
    requires_perfect_session BOOLEAN DEFAULT FALSE,
    min_accuracy NUMERIC(5,4) DEFAULT 0,
    
    -- Visual/Audio
    chest_type VARCHAR(30) NOT NULL,
    rarity_color VARCHAR(7) NOT NULL,
    opening_animation VARCHAR(50),
    opening_sound VARCHAR(50),
    
    -- Display
    display_name VARCHAR(50) NOT NULL,
    display_emoji VARCHAR(10) NOT NULL,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear and populate loot table
TRUNCATE loot_table_config RESTART IDENTITY;

INSERT INTO loot_table_config (tier, tier_order, drop_rate, min_diamonds, max_diamonds, requires_perfect_session, min_accuracy, chest_type, rarity_color, opening_animation, opening_sound, display_name, display_emoji) VALUES
    -- Common drops (always on 85%+ accuracy)
    ('COMMON', 1, 60.00, 5, 15, FALSE, 0.85, 'WOODEN', '#9CA3AF', 'chest_open_basic', 'chest_wood', 'Common Chest', '📦'),
    
    -- Uncommon (90%+ accuracy)
    ('UNCOMMON', 2, 25.00, 15, 35, FALSE, 0.90, 'IRON', '#6B7280', 'chest_open_shine', 'chest_iron', 'Iron Chest', '🗃️'),
    
    -- Rare (95%+ accuracy)
    ('RARE', 3, 10.00, 35, 75, FALSE, 0.95, 'GOLD', '#F59E0B', 'chest_open_glow', 'chest_gold', 'Gold Chest', '✨'),
    
    -- Epic (98%+ accuracy)
    ('EPIC', 4, 4.00, 75, 150, FALSE, 0.98, 'DIAMOND', '#8B5CF6', 'chest_open_burst', 'chest_epic', 'Epic Chest', '💎'),
    
    -- LEGENDARY JACKPOT (100% perfect session ONLY)
    ('LEGENDARY', 5, 1.00, 150, 500, TRUE, 1.00, 'LEGENDARY', '#EC4899', 'chest_legendary_explosion', 'jackpot_fanfare', '💰 JACKPOT!', '🎰'),
    
    -- MYTHIC JACKPOT (100% + 30 day streak)
    ('MYTHIC', 6, 0.10, 500, 2000, TRUE, 1.00, 'MYTHIC', '#4ADE80', 'mythic_supernova', 'mythic_chorus', '🌟 MYTHIC JACKPOT!', '🌟');

COMMENT ON TABLE loot_table_config IS '🎰 TASK 08: Diamond Chest Vault - Loot table for training completions';

-- ═══════════════════════════════════════════════════════════
-- 🎰 fn_roll_chest_reward
-- Rolls for chest reward based on session performance
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_roll_chest_reward(
    p_user_id UUID,
    p_accuracy NUMERIC(5,4),
    p_streak_days INTEGER DEFAULT 0,
    p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_roll NUMERIC;
    v_cumulative NUMERIC := 0;
    v_loot RECORD;
    v_reward_amount BIGINT;
    v_is_jackpot BOOLEAN := FALSE;
    v_is_perfect BOOLEAN;
BEGIN
    -- Check if perfect session
    v_is_perfect := (p_accuracy >= 1.0);
    
    -- Roll random number (0-100)
    v_roll := random() * 100;
    
    -- Iterate through loot table (highest tier first for jackpots)
    FOR v_loot IN 
        SELECT * FROM loot_table_config 
        WHERE p_accuracy >= min_accuracy
          AND (NOT requires_perfect_session OR v_is_perfect)
          -- MYTHIC requires 30+ day streak
          AND (tier != 'MYTHIC' OR p_streak_days >= 30)
        ORDER BY tier_order DESC
    LOOP
        v_cumulative := v_cumulative + v_loot.drop_rate;
        
        IF v_roll <= v_cumulative THEN
            -- Calculate random reward in range
            v_reward_amount := v_loot.min_diamonds + 
                FLOOR(random() * (v_loot.max_diamonds - v_loot.min_diamonds + 1));
            
            -- Check if jackpot tier
            v_is_jackpot := v_loot.tier IN ('LEGENDARY', 'MYTHIC');
            
            RETURN jsonb_build_object(
                'success', TRUE,
                'rolled', TRUE,
                'chest', jsonb_build_object(
                    'tier', v_loot.tier,
                    'type', v_loot.chest_type,
                    'display_name', v_loot.display_name,
                    'emoji', v_loot.display_emoji,
                    'rarity_color', v_loot.rarity_color
                ),
                'reward', jsonb_build_object(
                    'diamonds', v_reward_amount,
                    'is_jackpot', v_is_jackpot,
                    'drop_rate', v_loot.drop_rate || '%'
                ),
                'visuals', jsonb_build_object(
                    'animation', v_loot.opening_animation,
                    'sound', v_loot.opening_sound
                ),
                'session', jsonb_build_object(
                    'accuracy', ROUND(p_accuracy * 100, 1) || '%',
                    'is_perfect', v_is_perfect,
                    'streak_days', p_streak_days
                ),
                'roll', jsonb_build_object(
                    'value', ROUND(v_roll, 2),
                    'threshold', ROUND(v_cumulative, 2)
                )
            );
        END IF;
    END LOOP;
    
    -- No chest earned (below 85% accuracy)
    RETURN jsonb_build_object(
        'success', TRUE,
        'rolled', FALSE,
        'reason', 'ACCURACY_TOO_LOW',
        'message', 'Minimum 85% accuracy required for chest drops',
        'accuracy', ROUND(p_accuracy * 100, 1) || '%',
        'threshold', '85%'
    );
END;
$$;

COMMENT ON FUNCTION fn_roll_chest_reward IS '🎰 TASK 08: Roll for Diamond Chest reward on training completion';

-- ═══════════════════════════════════════════════════════════
-- 💎 Diamond Chest History (tracking jackpots)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chest_drop_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    session_id UUID,
    
    -- Chest info
    chest_tier VARCHAR(30) NOT NULL,
    diamonds_awarded BIGINT NOT NULL,
    is_jackpot BOOLEAN DEFAULT FALSE,
    
    -- Session context
    accuracy NUMERIC(5,4) NOT NULL,
    streak_days INTEGER DEFAULT 0,
    
    -- Roll data (for audit)
    roll_value NUMERIC(6,2),
    
    -- Audit
    dropped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chest_history_user ON chest_drop_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chest_history_jackpot ON chest_drop_history(is_jackpot) WHERE is_jackpot = TRUE;

COMMENT ON TABLE chest_drop_history IS '🎰 TASK 08: Diamond Chest drop history (jackpot tracking)';

-- ═══════════════════════════════════════════════════════════
-- 📋 TASK 09: ECONOMY_HEALTH_AUDIT_LOG
-- ═══════════════════════════════════════════════════════════
-- Map 'ledger_consistency_monitor'
-- Law: Sum of all user balances + Burn Vault = Initial Supply
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS economy_health_config (
    id SERIAL PRIMARY KEY,
    
    -- Initial supply (set once)
    initial_supply BIGINT NOT NULL DEFAULT 0,
    
    -- Current totals (updated by audit)
    total_user_balances BIGINT NOT NULL DEFAULT 0,
    total_burned BIGINT NOT NULL DEFAULT 0,
    total_in_escrow BIGINT NOT NULL DEFAULT 0,
    total_minted BIGINT NOT NULL DEFAULT 0,
    
    -- Calculated
    calculated_supply BIGINT GENERATED ALWAYS AS (total_user_balances + total_burned + total_in_escrow) STORED,
    
    -- Health status
    is_balanced BOOLEAN GENERATED ALWAYS AS (total_minted = total_user_balances + total_burned + total_in_escrow) STORED,
    variance BIGINT GENERATED ALWAYS AS (total_minted - (total_user_balances + total_burned + total_in_escrow)) STORED,
    
    -- Audit
    last_audit_at TIMESTAMPTZ,
    audit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize config
INSERT INTO economy_health_config (id, initial_supply, total_minted)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE economy_health_config IS '📊 TASK 09: Economy Health Configuration';

-- ═══════════════════════════════════════════════════════════
-- 📊 Audit Log Table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ledger_consistency_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Snapshot values
    total_user_balances BIGINT NOT NULL,
    total_burned BIGINT NOT NULL,
    total_in_escrow BIGINT NOT NULL,
    total_minted BIGINT NOT NULL,
    
    -- Calculated
    calculated_supply BIGINT NOT NULL,
    expected_supply BIGINT NOT NULL,
    variance BIGINT NOT NULL,
    
    -- Status
    is_balanced BOOLEAN NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    -- HEALTHY, WARNING, CRITICAL, EMERGENCY
    
    -- Breakdown
    user_count INTEGER,
    transaction_count BIGINT,
    
    -- Audit
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    audit_duration_ms NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_time ON ledger_consistency_log(audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_audit_status ON ledger_consistency_log(health_status);

COMMENT ON TABLE ledger_consistency_log IS '📊 TASK 09: Ledger Consistency Audit Log';

-- ═══════════════════════════════════════════════════════════
-- 📊 fn_audit_economy_health
-- Performs full economy health audit
-- HARD LAW: Sum of balances + burn = total minted
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_audit_economy_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_total_user_balances BIGINT;
    v_total_burned BIGINT;
    v_total_in_escrow BIGINT;
    v_total_minted BIGINT;
    v_calculated_supply BIGINT;
    v_variance BIGINT;
    v_is_balanced BOOLEAN;
    v_health_status VARCHAR(20);
    v_user_count INTEGER;
    v_tx_count BIGINT;
    v_audit_id UUID;
    v_duration_ms NUMERIC;
BEGIN
    -- ═══════════════════════════════════════════════════════
    -- Calculate all totals
    -- ═══════════════════════════════════════════════════════
    
    -- Total user balances (excluding burn vault)
    SELECT COALESCE(SUM(balance), 0), COUNT(*)
    INTO v_total_user_balances, v_user_count
    FROM wallets
    WHERE user_id != '00000000-0000-0000-0000-000000000000';
    
    -- Total burned (from burn_vault)
    SELECT COALESCE(total_burned, 0)
    INTO v_total_burned
    FROM burn_vault WHERE id = 1;
    
    -- Total in escrow (arcade_escrow)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_in_escrow
    FROM arcade_escrow
    WHERE status = 'ACTIVE';
    
    -- Total ever minted (sum of CREDIT transactions)
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_minted, v_tx_count
    FROM transactions
    WHERE type = 'CREDIT';
    
    -- ═══════════════════════════════════════════════════════
    -- Calculate health
    -- ═══════════════════════════════════════════════════════
    
    v_calculated_supply := v_total_user_balances + v_total_burned + v_total_in_escrow;
    v_variance := v_total_minted - v_calculated_supply;
    v_is_balanced := (v_variance = 0);
    
    -- Determine health status
    IF v_variance = 0 THEN
        v_health_status := 'HEALTHY';
    ELSIF ABS(v_variance) <= 100 THEN
        v_health_status := 'WARNING';  -- Minor variance (rounding)
    ELSIF ABS(v_variance) <= 1000 THEN
        v_health_status := 'CRITICAL';  -- Significant variance
    ELSE
        v_health_status := 'EMERGENCY';  -- Major discrepancy
    END IF;
    
    -- ═══════════════════════════════════════════════════════
    -- Update config table
    -- ═══════════════════════════════════════════════════════
    
    UPDATE economy_health_config
    SET total_user_balances = v_total_user_balances,
        total_burned = v_total_burned,
        total_in_escrow = v_total_in_escrow,
        total_minted = v_total_minted,
        last_audit_at = NOW(),
        audit_count = audit_count + 1
    WHERE id = 1;
    
    -- ═══════════════════════════════════════════════════════
    -- Log the audit
    -- ═══════════════════════════════════════════════════════
    
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time));
    
    INSERT INTO ledger_consistency_log (
        total_user_balances, total_burned, total_in_escrow, total_minted,
        calculated_supply, expected_supply, variance, is_balanced, health_status,
        user_count, transaction_count, audit_duration_ms
    ) VALUES (
        v_total_user_balances, v_total_burned, v_total_in_escrow, v_total_minted,
        v_calculated_supply, v_total_minted, v_variance, v_is_balanced, v_health_status,
        v_user_count, v_tx_count, v_duration_ms
    )
    RETURNING id INTO v_audit_id;
    
    -- ═══════════════════════════════════════════════════════
    -- Return audit result
    -- ═══════════════════════════════════════════════════════
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'audit_id', v_audit_id,
        'health_status', v_health_status,
        'is_balanced', v_is_balanced,
        'totals', jsonb_build_object(
            'user_balances', v_total_user_balances,
            'burned', v_total_burned,
            'in_escrow', v_total_in_escrow,
            'total_minted', v_total_minted
        ),
        'calculation', jsonb_build_object(
            'calculated_supply', v_calculated_supply,
            'expected_supply', v_total_minted,
            'variance', v_variance,
            'formula', 'user_balances + burned + escrow = total_minted'
        ),
        'stats', jsonb_build_object(
            'user_count', v_user_count,
            'transaction_count', v_tx_count
        ),
        'meta', jsonb_build_object(
            'audit_duration_ms', v_duration_ms,
            'audited_at', NOW()
        ),
        'hard_law', 'LEDGER_CONSISTENCY_MONITOR'
    );
END;
$$;

COMMENT ON FUNCTION fn_audit_economy_health IS '📊 TASK 09: Economy Health Audit - Verifies ledger consistency';

-- ═══════════════════════════════════════════════════════════
-- 📊 Addiction Engine Status View
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yellow_addiction_engine_status AS
SELECT 
    -- Task 07: Fire Visuals
    (SELECT COUNT(*) FROM streak_tier_visuals) AS fire_visual_tiers,
    (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'fn_get_streak_fire_visuals')) AS fire_visuals_function,
    
    -- Task 08: Chest Vault
    (SELECT COUNT(*) FROM loot_table_config) AS loot_table_tiers,
    (SELECT COUNT(*) FROM chest_drop_history WHERE is_jackpot = TRUE) AS total_jackpots_dropped,
    
    -- Task 09: Economy Health
    (SELECT health_status FROM ledger_consistency_log ORDER BY audited_at DESC LIMIT 1) AS last_health_status,
    (SELECT is_balanced FROM economy_health_config WHERE id = 1) AS economy_balanced,
    (SELECT variance FROM economy_health_config WHERE id = 1) AS current_variance,
    
    NOW() AS verified_at;

COMMENT ON VIEW yellow_addiction_engine_status IS '📊 YELLOW ADDICTION ENGINE Status (Tasks 7-9)';

-- ═══════════════════════════════════════════════════════════
-- 💼 GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT SELECT ON streak_tier_visuals TO authenticated;
GRANT SELECT ON loot_table_config TO authenticated;
GRANT SELECT ON chest_drop_history TO authenticated;
GRANT SELECT ON ledger_consistency_log TO authenticated;
GRANT SELECT ON yellow_addiction_engine_status TO authenticated;

GRANT EXECUTE ON FUNCTION fn_get_streak_fire_visuals TO authenticated;
GRANT EXECUTE ON FUNCTION fn_roll_chest_reward TO authenticated;
GRANT EXECUTE ON FUNCTION fn_audit_economy_health TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ YELLOW ADDICTION ENGINE COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- TASK 07: STREAK_FIRE_MULTIPLIER_UI_HOOK ✅
--   - streak_tier_visuals table (Blue/Gold/Purple fire)
--   - fn_get_streak_fire_visuals function
--   - Fire intensity, colors, particles, sounds
--
-- TASK 08: THE_DIAMOND_CHEST_VAULT ✅
--   - loot_table_config (6 tiers: Common to Mythic)
--   - fn_roll_chest_reward function
--   - Diamond Jackpots on 100% perfect sessions
--   - chest_drop_history for jackpot tracking
--
-- TASK 09: ECONOMY_HEALTH_AUDIT_LOG ✅
--   - economy_health_config table
--   - ledger_consistency_log table
--   - fn_audit_economy_health function
--   - HARD LAW: balances + burn + escrow = total_minted
--
-- ═══════════════════════════════════════════════════════════
