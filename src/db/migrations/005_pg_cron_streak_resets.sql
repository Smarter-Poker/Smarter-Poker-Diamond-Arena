-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — MIGRATION 005
-- PG_CRON SCHEDULED JOBS FOR STREAK MAINTENANCE
-- ═══════════════════════════════════════════════════════════
-- Internal Supabase jobs — no external API calls required.
-- Runs directly on the database at scheduled intervals.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- ⚙️ ENABLE PG_CRON EXTENSION
-- ═══════════════════════════════════════════════════════════
-- Note: pg_cron must be enabled in Supabase Dashboard:
-- Database → Extensions → pg_cron → Enable

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (required for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ═══════════════════════════════════════════════════════════
-- 🔄 STREAK RESET FUNCTION
-- Marks expired streaks as broken (48+ hours since last claim)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_process_expired_streaks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_affected_count INTEGER;
    v_grace_period_hours CONSTANT INTEGER := 48;
BEGIN
    -- Find and reset streaks that have exceeded grace period
    WITH expired_wallets AS (
        UPDATE wallets
        SET current_streak = 0,
            updated_at = NOW()
        WHERE last_claim IS NOT NULL
          AND current_streak > 0
          AND last_claim < NOW() - (v_grace_period_hours || ' hours')::INTERVAL
        RETURNING id, user_id, current_streak
    )
    SELECT COUNT(*) INTO v_affected_count FROM expired_wallets;

    -- Log the maintenance run
    INSERT INTO streak_maintenance_log (
        run_at,
        affected_count,
        grace_period_hours
    ) VALUES (
        NOW(),
        v_affected_count,
        v_grace_period_hours
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'affected_count', v_affected_count,
        'run_at', NOW(),
        'grace_period_hours', v_grace_period_hours
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 MAINTENANCE LOG TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_maintenance_log (
    id BIGSERIAL PRIMARY KEY,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    affected_count INTEGER NOT NULL DEFAULT 0,
    grace_period_hours INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_maint_run_at 
    ON streak_maintenance_log(run_at DESC);

COMMENT ON TABLE streak_maintenance_log IS '📋 Audit log for scheduled streak reset jobs';

-- ═══════════════════════════════════════════════════════════
-- 📊 DAILY ANALYTICS SNAPSHOT
-- Captures streak distribution for analytics
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_capture_streak_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot JSONB;
BEGIN
    SELECT jsonb_build_object(
        'snapshot_date', CURRENT_DATE,
        'total_wallets', COUNT(*),
        'active_streaks', COUNT(*) FILTER (WHERE current_streak > 0),
        'tier_distribution', jsonb_build_object(
            'cold', COUNT(*) FILTER (WHERE current_streak = 0),
            'warming', COUNT(*) FILTER (WHERE current_streak BETWEEN 1 AND 2),
            'warm', COUNT(*) FILTER (WHERE current_streak BETWEEN 3 AND 6),
            'hot', COUNT(*) FILTER (WHERE current_streak BETWEEN 7 AND 13),
            'blazing', COUNT(*) FILTER (WHERE current_streak BETWEEN 14 AND 29),
            'legendary', COUNT(*) FILTER (WHERE current_streak >= 30)
        ),
        'avg_streak', ROUND(AVG(current_streak)::NUMERIC, 2),
        'max_streak', MAX(current_streak),
        'total_diamonds_circulating', SUM(balance)
    ) INTO v_snapshot
    FROM wallets;

    -- Store snapshot
    INSERT INTO streak_analytics_snapshots (snapshot_date, data)
    VALUES (CURRENT_DATE, v_snapshot)
    ON CONFLICT (snapshot_date) 
    DO UPDATE SET data = v_snapshot, updated_at = NOW();

    RETURN v_snapshot;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📊 ANALYTICS SNAPSHOTS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_analytics_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshot_date 
    ON streak_analytics_snapshots(snapshot_date DESC);

COMMENT ON TABLE streak_analytics_snapshots IS '📊 Daily snapshots of streak analytics';

-- ═══════════════════════════════════════════════════════════
-- ⏰ SCHEDULE CRON JOBS
-- ═══════════════════════════════════════════════════════════

-- Remove existing jobs if they exist (for idempotent deploys)
SELECT cron.unschedule('process_expired_streaks') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_expired_streaks');

SELECT cron.unschedule('daily_streak_analytics')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_streak_analytics');

-- ═══════════════════════════════════════════════════════════
-- JOB 1: STREAK EXPIRATION CHECK
-- Runs every hour to catch expired streaks
-- ═══════════════════════════════════════════════════════════

SELECT cron.schedule(
    'process_expired_streaks',          -- Job name
    '0 * * * *',                         -- Every hour at minute 0
    $$SELECT fn_process_expired_streaks()$$
);

-- ═══════════════════════════════════════════════════════════
-- JOB 2: DAILY ANALYTICS SNAPSHOT
-- Runs once per day at midnight UTC
-- ═══════════════════════════════════════════════════════════

SELECT cron.schedule(
    'daily_streak_analytics',           -- Job name
    '0 0 * * *',                         -- Every day at midnight UTC
    $$SELECT fn_capture_streak_analytics()$$
);

-- ═══════════════════════════════════════════════════════════
-- JOB 3: WEEKLY LEADERBOARD RESET (Optional)
-- Clears weekly competition data
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_weekly_leaderboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot JSONB;
BEGIN
    -- Capture top 100 streakers for the week
    SELECT jsonb_build_object(
        'week_ending', CURRENT_DATE,
        'top_streakers', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'rank', row_number,
                    'user_id', user_id,
                    'streak', current_streak,
                    'longest', longest_streak,
                    'tier', fn_get_streak_tier_label(current_streak)
                )
            )
            FROM (
                SELECT user_id, current_streak, longest_streak,
                       ROW_NUMBER() OVER (ORDER BY current_streak DESC) as row_number
                FROM wallets
                WHERE current_streak > 0
                ORDER BY current_streak DESC
                LIMIT 100
            ) top
        )
    ) INTO v_snapshot;

    RETURN v_snapshot;
END;
$$;

SELECT cron.schedule(
    'weekly_leaderboard_snapshot',      -- Job name
    '0 0 * * 0',                         -- Every Sunday at midnight UTC
    $$SELECT fn_weekly_leaderboard_snapshot()$$
);

-- ═══════════════════════════════════════════════════════════
-- 📋 VIEW SCHEDULED JOBS
-- ═══════════════════════════════════════════════════════════

-- Query to see all scheduled jobs:
-- SELECT * FROM cron.job ORDER BY jobname;

-- Query to see job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;

-- ═══════════════════════════════════════════════════════════
-- 💼 COMMENTS
-- ═══════════════════════════════════════════════════════════

COMMENT ON FUNCTION fn_process_expired_streaks IS '🔄 Resets streaks that exceeded 48-hour grace period';
COMMENT ON FUNCTION fn_capture_streak_analytics IS '📊 Captures daily streak distribution snapshot';
COMMENT ON FUNCTION fn_weekly_leaderboard_snapshot IS '🏆 Captures weekly top streakers leaderboard';
