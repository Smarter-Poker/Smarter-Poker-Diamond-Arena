-- ═══════════════════════════════════════════════════════════════════════════
-- 🏆 DIAMOND ARENA — TOURNAMENT SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    game_type TEXT NOT NULL DEFAULT 'NLH', -- NLH, PLO
    variant TEXT, -- e.g. 'Turbo', 'Bounty'
    buy_in_amount INTEGER NOT NULL,
    buy_in_fee INTEGER NOT NULL,
    guaranteed_prize INTEGER DEFAULT 0,
    start_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ANNOUNCED' CHECK (status IN ('ANNOUNCED', 'REGISTERING', 'LATE_REG', 'RUNNING', 'COMPLETED', 'CANCELLED')),
    current_players INTEGER DEFAULT 0,
    max_players INTEGER NOT NULL,
    late_reg_mins INTEGER DEFAULT 60,
    starting_chips INTEGER DEFAULT 10000,
    blind_structure TEXT DEFAULT 'Standard',
    payout_structure TEXT DEFAULT 'Standard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Registrations Table
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ELIMINATED', 'FINISHED', 'UNREGISTERED')),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    finish_rank INTEGER,
    prize_amount INTEGER,
    UNIQUE(tournament_id, user_id)
);

-- 3. Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%')); -- Placeholder admin check

ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view registrations" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Users view own registrations" ON tournament_registrations FOR SELECT USING (user_id = auth.uid());

-- 4. RPC: Register for Tournament
CREATE OR REPLACE FUNCTION register_for_tournament(
    p_tournament_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_tournament tournaments%ROWTYPE;
    v_balance INTEGER;
    v_total_cost INTEGER;
BEGIN
    -- Lock tournament
    SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Tournament not found'); END IF;

    -- Check status
    IF v_tournament.status NOT IN ('REGISTERING', 'LATE_REG') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration closed');
    END IF;

    -- Check capacity
    IF v_tournament.current_players >= v_tournament.max_players THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tournament full');
    END IF;

    -- Check duplicate
    IF EXISTS (SELECT 1 FROM tournament_registrations WHERE tournament_id = p_tournament_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already registered');
    END IF;

    -- Check balance
    SELECT diamond_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
    v_total_cost := v_tournament.buy_in_amount + v_tournament.buy_in_fee;

    IF v_balance IS NULL OR v_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Deduct
    UPDATE profiles SET diamond_balance = diamond_balance - v_total_cost WHERE id = p_user_id;

    -- Register
    INSERT INTO tournament_registrations (tournament_id, user_id) VALUES (p_tournament_id, p_user_id);
    
    -- Increment count
    UPDATE tournaments SET current_players = current_players + 1 WHERE id = p_tournament_id;

    -- Log Transaction
    INSERT INTO poker_transactions (user_id, type, amount, balance_before, balance_after, description)
    VALUES (p_user_id, 'BUY_IN', -v_total_cost, v_balance, v_balance - v_total_cost, 'Tournament Entry: ' || v_tournament.name);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
