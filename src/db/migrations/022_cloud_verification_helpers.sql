-- ═══════════════════════════════════════════════════════════
-- 💎 DIAMOND ECONOMY RAILS — CLOUD VERIFICATION HELPERS
-- ═══════════════════════════════════════════════════════════
-- 
-- Helper functions for Cloud Integrity Check
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 🔍 check_trigger_exists
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = p_trigger_name
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🔍 check_function_exists
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_function_exists(p_function_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = p_function_name
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 📋 get_schema_inventory
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_schema_inventory()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tables JSONB;
    v_views JSONB;
    v_functions JSONB;
    v_triggers JSONB;
BEGIN
    -- Get tables
    SELECT jsonb_agg(table_name ORDER BY table_name) INTO v_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    -- Get views
    SELECT jsonb_agg(table_name ORDER BY table_name) INTO v_views
    FROM information_schema.views
    WHERE table_schema = 'public';
    
    -- Get functions
    SELECT jsonb_agg(proname ORDER BY proname) INTO v_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public';
    
    -- Get triggers
    SELECT jsonb_agg(tgname ORDER BY tgname) INTO v_triggers
    FROM pg_trigger
    WHERE NOT tgisinternal;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'source', 'LIVE_DATABASE',
        'tables', COALESCE(v_tables, '[]'::jsonb),
        'views', COALESCE(v_views, '[]'::jsonb),
        'functions', COALESCE(v_functions, '[]'::jsonb),
        'triggers', COALESCE(v_triggers, '[]'::jsonb),
        'queried_at', NOW()
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 🛰️ run_cloud_integrity_check
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION run_cloud_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schema JSONB;
    v_yellow_status JSONB;
    v_red_trigger BOOLEAN;
    v_yellow_trigger BOOLEAN;
    v_reconciliation_trigger BOOLEAN;
    v_green_function BOOLEAN;
    v_search_view BOOLEAN;
BEGIN
    -- Get schema inventory
    v_schema := get_schema_inventory();
    
    -- Check RED silo trigger
    v_red_trigger := check_trigger_exists('trig_prevent_xp_loss');
    
    -- Check YELLOW silo triggers
    v_yellow_trigger := check_trigger_exists('trig_execute_marketplace_burn');
    v_reconciliation_trigger := check_trigger_exists('trg_auto_reconciliation');
    
    -- Check GREEN silo function
    v_green_function := check_function_exists('fn_validate_level_unlock');
    
    -- Check ORANGE silo (materialized view)
    SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = 'global_search_index'
    ) INTO v_search_view;
    
    -- Get Yellow Engine status
    SELECT fn_get_sovereign_seal_status() INTO v_yellow_status;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'connection', jsonb_build_object(
            'status', 'CONNECTED',
            'timestamp', NOW()
        ),
        'silos', jsonb_build_object(
            'RED', CASE WHEN v_red_trigger THEN 'CONNECTED' ELSE 'PENDING' END,
            'YELLOW', CASE WHEN v_yellow_trigger AND v_reconciliation_trigger THEN 'CONNECTED' ELSE 'PARTIAL' END,
            'GREEN', CASE WHEN v_green_function THEN 'CONNECTED' ELSE 'PENDING' END,
            'ORANGE', CASE WHEN v_search_view THEN 'CONNECTED' ELSE 'PENDING' END
        ),
        'triggers', jsonb_build_object(
            'trig_prevent_xp_loss', v_red_trigger,
            'trig_execute_marketplace_burn', v_yellow_trigger,
            'trg_auto_reconciliation', v_reconciliation_trigger
        ),
        'functions', jsonb_build_object(
            'fn_validate_level_unlock', v_green_function
        ),
        'views', jsonb_build_object(
            'global_search_index', v_search_view
        ),
        'schema', v_schema,
        'yellow_engine', v_yellow_status,
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_trigger_exists TO authenticated;
GRANT EXECUTE ON FUNCTION check_function_exists TO authenticated;
GRANT EXECUTE ON FUNCTION get_schema_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION run_cloud_integrity_check TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- ✅ CLOUD VERIFICATION HELPERS COMPLETE
-- ═══════════════════════════════════════════════════════════
