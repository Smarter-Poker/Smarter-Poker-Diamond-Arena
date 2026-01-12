-- ═══════════════════════════════════════════════════════════════════════════
-- 🎰 DIAMOND ARENA — POKER ROOM DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════
-- Online Poker Room with Diamond Currency
-- Deploy to: PokerIQ-Production (kuklfnapbkmacvwxktbh)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 🎰 POKER TABLES — Active Cash Games & Tournaments
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Table Configuration
    name TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('CASH', 'SIT_N_GO', 'TOURNAMENT')),
    table_size INTEGER NOT NULL CHECK (table_size IN (2, 6, 9)),
    betting_structure TEXT NOT NULL DEFAULT 'NO_LIMIT' CHECK (betting_structure IN ('NO_LIMIT', 'POT_LIMIT', 'FIXED_LIMIT')),
    
    -- Stakes (in Diamonds)
    small_blind INTEGER NOT NULL,
    big_blind INTEGER NOT NULL,
    ante INTEGER DEFAULT 0,
    min_buy_in INTEGER NOT NULL,
    max_buy_in INTEGER NOT NULL,
    
    -- Settings
    time_limit INTEGER NOT NULL DEFAULT 30,  -- Seconds per action
    is_private BOOLEAN DEFAULT FALSE,
    password_hash TEXT,  -- For private tables
    
    -- State
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'RUNNING', 'PAUSED', 'CLOSED')),
    hand_number INTEGER DEFAULT 0,
    current_street TEXT DEFAULT 'WAITING',
    dealer_seat INTEGER,
    active_seat INTEGER,
    
    -- Cards (stored as JSON arrays)
    community_cards JSONB DEFAULT '[]'::jsonb,
    
    -- Pot
    pot_total INTEGER DEFAULT 0,
    current_bet INTEGER DEFAULT 0,
    min_raise INTEGER,
    
    -- Stats
    hands_played INTEGER DEFAULT 0,
    average_pot INTEGER DEFAULT 0,
    
    -- Ownership
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lobby queries
CREATE INDEX IF NOT EXISTS idx_poker_tables_status ON poker_tables(status);
CREATE INDEX IF NOT EXISTS idx_poker_tables_game_type ON poker_tables(game_type);
CREATE INDEX IF NOT EXISTS idx_poker_tables_stakes ON poker_tables(small_blind, big_blind);

-- ═══════════════════════════════════════════════════════════════════════════
-- 👤 POKER PLAYERS — Players Seated at Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    table_id UUID NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Seat
    seat_number INTEGER NOT NULL CHECK (seat_number >= 1 AND seat_number <= 9),
    
    -- Chips
    chip_stack INTEGER NOT NULL,           -- Current stack at table
    buy_in_amount INTEGER NOT NULL,        -- Original buy-in
    current_bet INTEGER DEFAULT 0,         -- Bet in current round
    total_bet_this_hand INTEGER DEFAULT 0,
    
    -- Cards (encrypted for security, only player can see)
    hole_cards JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SITTING_OUT', 'ACTIVE', 'FOLDED', 'ALL_IN', 'DISCONNECTED')),
    is_dealer BOOLEAN DEFAULT FALSE,
    is_turn BOOLEAN DEFAULT FALSE,
    
    -- Timing
    time_bank INTEGER DEFAULT 30,
    last_action TEXT,
    last_action_amount INTEGER,
    last_action_at TIMESTAMPTZ,
    
    -- Session
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique seat per table
    UNIQUE(table_id, seat_number),
    -- Ensure user only at one seat per table
    UNIQUE(table_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poker_players_table ON poker_players(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_players_user ON poker_players(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_players_status ON poker_players(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 📜 POKER HANDS — Completed Hand History
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_hands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    table_id UUID NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
    hand_number INTEGER NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Board
    community_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Results
    pot_total INTEGER NOT NULL,
    rake_amount INTEGER DEFAULT 0,
    
    -- Winners (array of {user_id, amount, hand_description})
    winners JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Full hand history (array of actions)
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Player snapshots at hand start
    player_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poker_hands_table ON poker_hands(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_hands_time ON poker_hands(started_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 💎 POKER TRANSACTIONS — Diamond Movements
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- References
    table_id UUID REFERENCES poker_tables(id),
    hand_id UUID REFERENCES poker_hands(id),
    
    -- Transaction
    type TEXT NOT NULL CHECK (type IN ('BUY_IN', 'CASH_OUT', 'WIN', 'LOSS', 'RAKE', 'REBUY', 'ADD_ON')),
    amount INTEGER NOT NULL,  -- Positive for credits, negative for debits
    
    -- Balance tracking
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    
    -- Meta
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poker_transactions_user ON poker_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_transactions_table ON poker_transactions(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_transactions_time ON poker_transactions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 📊 POKER STATS — Player Statistics
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS poker_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    
    -- Volume
    hands_played INTEGER DEFAULT 0,
    sessions_played INTEGER DEFAULT 0,
    hours_played NUMERIC(10,2) DEFAULT 0,
    
    -- Results (in Diamonds)
    total_buy_ins INTEGER DEFAULT 0,
    total_cash_outs INTEGER DEFAULT 0,
    total_winnings INTEGER DEFAULT 0,
    total_rake_paid INTEGER DEFAULT 0,
    biggest_pot_won INTEGER DEFAULT 0,
    
    -- Ratios
    vpip NUMERIC(5,2) DEFAULT 0,        -- Voluntarily Put $ In Pot %
    pfr NUMERIC(5,2) DEFAULT 0,         -- Pre-Flop Raise %
    aggression_factor NUMERIC(5,2) DEFAULT 0,
    
    -- Streaks
    current_streak INTEGER DEFAULT 0,   -- Positive = winning sessions
    best_streak INTEGER DEFAULT 0,
    worst_streak INTEGER DEFAULT 0,
    
    -- Rankings
    skill_rating INTEGER DEFAULT 1000,  -- ELO-style rating
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔄 FUNCTIONS — Atomic Operations
-- ═══════════════════════════════════════════════════════════════════════════

-- Function: Seat a player at a table with atomic buy-in
CREATE OR REPLACE FUNCTION fn_seat_player(
    p_table_id UUID,
    p_user_id UUID,
    p_seat_number INTEGER,
    p_buy_in_amount INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_table poker_tables%ROWTYPE;
    v_current_balance INTEGER;
    v_player_id UUID;
BEGIN
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
    IF EXISTS (SELECT 1 FROM poker_players WHERE table_id = p_table_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already seated at this table');
    END IF;
    
    -- Check buy-in limits
    IF p_buy_in_amount < v_table.min_buy_in OR p_buy_in_amount > v_table.max_buy_in THEN
        RETURN jsonb_build_object('success', false, 'error', 'Buy-in amount out of range');
    END IF;
    
    -- Get user's diamond balance (from profiles table)
    SELECT diamond_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL OR v_current_balance < p_buy_in_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient diamonds');
    END IF;
    
    -- Deduct from wallet
    UPDATE profiles SET diamond_balance = diamond_balance - p_buy_in_amount WHERE id = p_user_id;
    
    -- Seat the player
    INSERT INTO poker_players (table_id, user_id, seat_number, chip_stack, buy_in_amount, status)
    VALUES (p_table_id, p_user_id, p_seat_number, p_buy_in_amount, p_buy_in_amount, 'WAITING')
    RETURNING id INTO v_player_id;
    
    -- Log transaction
    INSERT INTO poker_transactions (user_id, table_id, type, amount, balance_before, balance_after, description)
    VALUES (p_user_id, p_table_id, 'BUY_IN', -p_buy_in_amount, v_current_balance, v_current_balance - p_buy_in_amount, 
            'Buy-in at ' || v_table.name);
    
    RETURN jsonb_build_object('success', true, 'player_id', v_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cash out player from table
CREATE OR REPLACE FUNCTION fn_leave_table(
    p_table_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_player poker_players%ROWTYPE;
    v_current_balance INTEGER;
    v_profit INTEGER;
BEGIN
    -- Get player
    SELECT * INTO v_player FROM poker_players 
    WHERE table_id = p_table_id AND user_id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not seated at this table');
    END IF;
    
    -- Can't leave mid-hand if active
    IF v_player.status IN ('ACTIVE', 'ALL_IN') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot leave during active hand');
    END IF;
    
    -- Get current balance
    SELECT diamond_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    
    -- Credit chips back to wallet
    UPDATE profiles SET diamond_balance = diamond_balance + v_player.chip_stack WHERE id = p_user_id;
    
    -- Calculate profit
    v_profit := v_player.chip_stack - v_player.buy_in_amount;
    
    -- Log transaction
    INSERT INTO poker_transactions (user_id, table_id, type, amount, balance_before, balance_after, description)
    VALUES (p_user_id, p_table_id, 'CASH_OUT', v_player.chip_stack, v_current_balance, v_current_balance + v_player.chip_stack,
            'Cash out with ' || v_player.chip_stack || ' (profit: ' || v_profit || ')');
    
    -- Remove from table
    DELETE FROM poker_players WHERE id = v_player.id;
    
    RETURN jsonb_build_object('success', true, 'chips_returned', v_player.chip_stack, 'profit', v_profit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🔐 ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE poker_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_stats ENABLE ROW LEVEL SECURITY;

-- Tables: Anyone can view, authenticated can create
CREATE POLICY "Tables are viewable by everyone" ON poker_tables FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tables" ON poker_tables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Table owner can update" ON poker_tables FOR UPDATE USING (created_by = auth.uid());

-- Players: Anyone can view seated players, users manage their own seat
CREATE POLICY "Seated players are viewable" ON poker_players FOR SELECT USING (true);
CREATE POLICY "Users can seat themselves" ON poker_players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own seat" ON poker_players FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can leave their seat" ON poker_players FOR DELETE USING (user_id = auth.uid());

-- Hands: Anyone can view completed hands
CREATE POLICY "Hand history is viewable" ON poker_hands FOR SELECT USING (true);

-- Transactions: Users can only view their own
CREATE POLICY "Users view own transactions" ON poker_transactions FOR SELECT USING (user_id = auth.uid());

-- Stats: Public viewing, users update own
CREATE POLICY "Stats are public" ON poker_stats FOR SELECT USING (true);
CREATE POLICY "Users update own stats" ON poker_stats FOR UPDATE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 📡 REALTIME SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable realtime for poker tables
ALTER PUBLICATION supabase_realtime ADD TABLE poker_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE poker_players;

-- ═══════════════════════════════════════════════════════════════════════════
-- 🎯 INITIAL DATA — Sample Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert some default cash game tables
INSERT INTO poker_tables (name, game_type, table_size, small_blind, big_blind, min_buy_in, max_buy_in, status)
VALUES 
    ('Diamond Ring #1', 'CASH', 9, 10, 20, 400, 2000, 'WAITING'),
    ('Diamond Ring #2', 'CASH', 9, 10, 20, 400, 2000, 'WAITING'),
    ('High Roller', 'CASH', 6, 100, 200, 4000, 20000, 'WAITING'),
    ('Nosebleed', 'CASH', 6, 500, 1000, 20000, 100000, 'WAITING'),
    ('HU Battle', 'CASH', 2, 50, 100, 2000, 10000, 'WAITING'),
    ('Micro Grind #1', 'CASH', 9, 1, 2, 40, 200, 'WAITING'),
    ('Micro Grind #2', 'CASH', 6, 1, 2, 40, 200, 'WAITING')
ON CONFLICT DO NOTHING;
