-- ═══════════════════════════════════════════════════════════════════════════
-- 🤖 GHOST FLEET — AUTONOMOUS PERSONA SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════
-- 100 Autonomous AI Personas for Smarter.Poker Social Hub
-- Reserved Player IDs: 101-1249
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. PERSONAS TABLE
CREATE TABLE IF NOT EXISTS personas (
    id SERIAL PRIMARY KEY,
    player_id INTEGER UNIQUE NOT NULL CHECK (player_id >= 101 AND player_id <= 1249),
    
    -- Identity
    name TEXT NOT NULL,
    avatar_url TEXT,
    location TEXT,
    bio TEXT,
    
    -- Poker DNA
    archetype TEXT NOT NULL CHECK (archetype IN (
        'SOLVER', 'DEGEN', 'COACH', 'NEWS_HOUND', 'GRINDER', 'VILLAIN',
        'END_BOSS', 'MATH_NERD', 'GAME_THEORIST', 'TRACKER',
        'LAG', 'MANIAC', 'TABLE_CAPTAIN', 'ADRENALINE_JUNKIE', 'KILLER',
        'NIT', 'TAG', 'PASSIVE_DONK', 'OLD_SCHOOL', 'BANKROLL_COP',
        'CALLING_STATION', 'SOCIAL_BUTTERFLY', 'WHALE', 'ZEN_GAMER', 'NEWBIE',
        'VLOGGER', 'ACTIVIST', 'COMEDIAN', 'CELEBRITY_MENTOR', 'AMBASSADOR'
    )),
    poker_specialty TEXT, -- e.g., 'NLH Cash', 'PLO MTT', 'Heads-Up'
    
    -- Voice Profile (1-10 scale)
    slang_level INTEGER NOT NULL DEFAULT 5 CHECK (slang_level >= 1 AND slang_level <= 10),
    technicality INTEGER NOT NULL DEFAULT 5 CHECK (technicality >= 1 AND technicality <= 10),
    aggression INTEGER NOT NULL DEFAULT 5 CHECK (aggression >= 1 AND aggression <= 10),
    humor INTEGER NOT NULL DEFAULT 5 CHECK (humor >= 1 AND humor <= 10),
    
    -- Behavior
    post_frequency TEXT DEFAULT 'MEDIUM' CHECK (post_frequency IN ('LOW', 'MEDIUM', 'HIGH', 'HYPERACTIVE')),
    preferred_topics TEXT[], -- e.g., ['hand_analysis', 'news', 'memes']
    scrape_sources TEXT[], -- e.g., ['reddit', 'twitch', 'pokernews']
    
    -- Memory (Anti-Repetition)
    last_post_at TIMESTAMPTZ,
    posts_today INTEGER DEFAULT 0,
    seen_content_hashes TEXT[] DEFAULT '{}', -- MD5 hashes of consumed content
    
    -- System
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PERSONA POSTS TABLE (Bot Activity Log)
CREATE TABLE IF NOT EXISTS persona_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id INTEGER REFERENCES personas(id),
    
    -- Content
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'POST' CHECK (content_type IN ('POST', 'COMMENT', 'REACTION', 'SHARE')),
    source_url TEXT, -- Where the inspiration came from
    source_hash TEXT, -- To prevent re-using same source
    
    -- Targeting
    target_post_id UUID, -- If commenting on existing post
    target_user_id UUID, -- If mentioning someone
    
    -- Metrics
    engagement_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SCRAPE QUEUE TABLE (Content Pipeline)
CREATE TABLE IF NOT EXISTS scrape_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    source TEXT NOT NULL, -- 'reddit', 'twitch', 'pokernews', 'twitter'
    url TEXT NOT NULL,
    content TEXT,
    content_hash TEXT UNIQUE, -- MD5 to prevent duplicates
    
    -- Processing
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'CONSUMED', 'FAILED')),
    consumed_by INTEGER REFERENCES personas(id),
    
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_at TIMESTAMPTZ
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_personas_archetype ON personas(archetype);
CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active);
CREATE INDEX IF NOT EXISTS idx_persona_posts_persona ON persona_posts(persona_id);
CREATE INDEX IF NOT EXISTS idx_scrape_queue_status ON scrape_queue(status);

-- 5. ROW LEVEL SECURITY
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view personas" ON personas FOR SELECT USING (true);
CREATE POLICY "Public view persona posts" ON persona_posts FOR SELECT USING (true);
CREATE POLICY "System manages scrape queue" ON scrape_queue FOR ALL USING (true); -- Internal only

-- 6. RPC: Get Random Active Personas for Cron Trigger
CREATE OR REPLACE FUNCTION get_random_active_personas(p_count INTEGER DEFAULT 5)
RETURNS SETOF personas AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM personas
    WHERE is_active = TRUE
    AND (last_post_at IS NULL OR last_post_at < NOW() - INTERVAL '30 minutes')
    ORDER BY RANDOM()
    LIMIT p_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. RPC: Record Persona Post
CREATE OR REPLACE FUNCTION record_persona_post(
    p_persona_id INTEGER,
    p_content TEXT,
    p_content_type TEXT DEFAULT 'POST',
    p_source_url TEXT DEFAULT NULL,
    p_source_hash TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_post_id UUID;
BEGIN
    -- Insert post
    INSERT INTO persona_posts (persona_id, content, content_type, source_url, source_hash)
    VALUES (p_persona_id, p_content, p_content_type, p_source_url, p_source_hash)
    RETURNING id INTO v_post_id;
    
    -- Update persona stats
    UPDATE personas SET 
        last_post_at = NOW(),
        posts_today = posts_today + 1,
        seen_content_hashes = CASE 
            WHEN p_source_hash IS NOT NULL 
            THEN array_append(seen_content_hashes, p_source_hash)
            ELSE seen_content_hashes
        END,
        updated_at = NOW()
    WHERE id = p_persona_id;
    
    RETURN v_post_id;
END;
$$ LANGUAGE plpgsql;

-- 8. DAILY RESET FUNCTION (Reset posts_today at midnight)
CREATE OR REPLACE FUNCTION reset_daily_persona_stats()
RETURNS void AS $$
BEGIN
    UPDATE personas SET posts_today = 0, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
