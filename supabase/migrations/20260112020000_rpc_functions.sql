-- ═══════════════════════════════════════════════════════════════════════════
-- 💎 DIAMOND ARENA — RPC FUNCTIONS DEPLOYMENT
-- ═══════════════════════════════════════════════════════════════════════════
-- Deploy to: PokerIQ-Production (kuklfnapbkmacvwxktbh)
-- Run in: Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 📊 POKER STATS — Player Statistics
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    hands_played INTEGER DEFAULT 0,
    sessions_played INTEGER DEFAULT 0,
    hours_played NUMERIC(10,2) DEFAULT 0,
    total_buy_ins INTEGER DEFAULT 0,
    total_cash_outs INTEGER DEFAULT 0,
    total_winnings INTEGER DEFAULT 0,
    total_rake_paid INTEGER DEFAULT 0,
    biggest_pot_won INTEGER DEFAULT 0,
    vpip NUMERIC(5,2) DEFAULT 0,
    pfr NUMERIC(5,2) DEFAULT 0,
    aggression_factor NUMERIC(5,2) DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    worst_streak INTEGER DEFAULT 0,
    skill_rating INTEGER DEFAULT 1000,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE poker_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poker_stats' AND policyname = 'Stats are public') THEN
        CREATE POLICY "Stats are public" ON poker_stats FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poker_stats' AND policyname = 'Users update own stats') THEN
        CREATE POLICY "Users update own stats" ON poker_stats FOR UPDATE USING (user_id = auth.uid());
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔄 FUNCTION: fn_seat_player — Atomic Buy-in and Seating
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_seat_player(
    p_table_id UUID,
    p_seat_number INTEGER,
    p_buy_in_amount INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_table poker_tables%ROWTYPE;
    v_current_balance INTEGER;
    v_player_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
    END IF;

    -- Lock the table row
    SELECT * INTO v_table FROM poker_tables WHERE id = p_table_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Check seat is available
    IF EXISTS (SELECT 1 FROM poker_players WHERE table_id = p_table_id AND seat_number = p_seat_number) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seat is taken');
    END IF;
    
    -- Check user not already at table
    IF EXISTS (SELECT 1 FROM poker_players WHERE table_id = p_table_id AND user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already seated at this table');
    END IF;
    
    -- Check buy-in limits
    IF p_buy_in_amount < v_table.min_buy_in OR p_buy_in_amount > v_table.max_buy_in THEN
        RETURN jsonb_build_object('success', false, 'error', format('Buy-in must be between %s and %s', v_table.min_buy_in, v_table.max_buy_in));
    END IF;
    
    -- Get user's diamond balance (from profiles table)
    SELECT diamond_balance INTO v_current_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;
    
    IF v_current_balance < p_buy_in_amount THEN
        RETURN jsonb_build_object('success', false, 'error', format('Insufficient diamonds. Have: %s, Need: %s', v_current_balance, p_buy_in_amount));
    END IF;
    
    -- Deduct from wallet
    UPDATE profiles SET diamond_balance = diamond_balance - p_buy_in_amount WHERE id = v_user_id;
    
    -- Seat the player
    INSERT INTO poker_players (table_id, user_id, seat_number, chip_stack, buy_in_amount, status)
    VALUES (p_table_id, v_user_id, p_seat_number, p_buy_in_amount, p_buy_in_amount, 'WAITING')
    RETURNING id INTO v_player_id;
    
    -- Log transaction
    INSERT INTO poker_transactions (user_id, table_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user_id, p_table_id, 'BUY_IN', -p_buy_in_amount, v_current_balance, v_current_balance - p_buy_in_amount, 
            'Buy-in at ' || v_table.name);
    
    RETURN jsonb_build_object(
        'success', true, 
        'player_id', v_player_id,
        'seat', p_seat_number,
        'chips', p_buy_in_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔄 FUNCTION: fn_leave_table — Atomic Cash-out and Leave
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_leave_table(
    p_table_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_player poker_players%ROWTYPE;
    v_current_balance INTEGER;
    v_profit INTEGER;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
    END IF;

    -- Get player
    SELECT * INTO v_player FROM poker_players 
    WHERE table_id = p_table_id AND user_id = v_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not seated at this table');
    END IF;
    
    -- Can't leave mid-hand if active
    IF v_player.status IN ('ACTIVE', 'ALL_IN') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot leave during active hand. Wait for hand to complete.');
    END IF;
    
    -- Get current balance
    SELECT diamond_balance INTO v_current_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
    
    -- Credit chips back to wallet
    UPDATE profiles SET diamond_balance = diamond_balance + v_player.chip_stack WHERE id = v_user_id;
    
    -- Calculate profit
    v_profit := v_player.chip_stack - v_player.buy_in_amount;
    
    -- Log transaction
    INSERT INTO poker_transactions (user_id, table_id, type, amount, balance_before, balance_after, description)
    VALUES (v_user_id, p_table_id, 'CASH_OUT', v_player.chip_stack, v_current_balance, v_current_balance + v_player.chip_stack,
            'Cash out: ' || v_player.chip_stack || ' diamonds (profit: ' || v_profit || ')');
    
    -- Remove from table
    DELETE FROM poker_players WHERE id = v_player.id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'chips_returned', v_player.chip_stack, 
        'profit', v_profit,
        'new_balance', v_current_balance + v_player.chip_stack
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔄 FUNCTION: fn_get_available_seats — List open seats at a table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_get_available_seats(
    p_table_id UUID
) RETURNS TABLE(seat_number INTEGER) AS $$
DECLARE
    v_table_size INTEGER;
BEGIN
    -- Get table size
    SELECT table_size INTO v_table_size FROM poker_tables WHERE id = p_table_id;
    
    IF v_table_size IS NULL THEN
        RETURN;
    END IF;
    
    -- Return all seats that are not taken
    RETURN QUERY
    SELECT s.seat_number
    FROM generate_series(1, v_table_size) AS s(seat_number)
    WHERE NOT EXISTS (
        SELECT 1 FROM poker_players pp 
        WHERE pp.table_id = p_table_id AND pp.seat_number = s.seat_number
    )
    ORDER BY s.seat_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ DEPLOYMENT COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
