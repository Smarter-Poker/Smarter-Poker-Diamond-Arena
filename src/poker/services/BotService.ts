/**
 * 🤖 GHOST FLEET — BOT ORCHESTRATION SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Manages 100 autonomous AI personas for Smarter.Poker Social Hub
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Persona {
    id: number;
    player_id: number;
    name: string;
    avatar_url: string | null;
    location: string;
    bio: string;
    archetype: string;
    poker_specialty: string;
    slang_level: number;
    technicality: number;
    aggression: number;
    humor: number;
    post_frequency: 'LOW' | 'MEDIUM' | 'HIGH' | 'HYPERACTIVE';
    preferred_topics: string[];
    scrape_sources: string[];
    last_post_at: Date | null;
    posts_today: number;
    seen_content_hashes: string[];
    is_active: boolean;
}

export interface ScrapedContent {
    source: string;
    url: string;
    content: string;
    hash: string;
}

export interface GeneratedPost {
    personaId: number;
    content: string;
    contentType: 'POST' | 'COMMENT' | 'REACTION';
    sourceUrl?: string;
    sourceHash?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 VOICE PROFILE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const VOICE_TEMPLATES: Record<string, { prefixes: string[]; suffixes: string[]; style: string }> = {
    SOLVER: {
        prefixes: ['According to GTO...', 'The solver says...', 'At equilibrium...', 'Running this spot...'],
        suffixes: ['...mathematically speaking.', '...per the simulations.', '...at the right frequency.', ''],
        style: 'technical and precise'
    },
    DEGEN: {
        prefixes: ['SHIP IT!', 'LFG!!!', 'Yo check this out...', 'BRUH...', 'No cap...'],
        suffixes: ['...LET\'S GOOO! 🔥', '...YOLO!', '...that\'s poker baby!', '...we run good 💎'],
        style: 'high-energy slang with emojis'
    },
    COACH: {
        prefixes: ['Pro tip:', 'Here\'s what most players miss...', 'Quick lesson:', 'Let me break this down...'],
        suffixes: ['...remember that.', '...hope this helps!', '...happy to discuss further.', ''],
        style: 'helpful and educational'
    },
    NEWS_HOUND: {
        prefixes: ['🚨 BREAKING:', '📰 Just in:', 'UPDATE:', 'News:', '🎰'],
        suffixes: ['...developing story.', '...more updates soon.', '...thoughts?', ''],
        style: 'fast-paced news reporting'
    },
    GRINDER: {
        prefixes: ['Session update:', 'Grind report:', 'Bankroll check:', 'Another day at the tables...'],
        suffixes: ['...back to the grind.', '...volume is key.', '...slow and steady.', ''],
        style: 'practical and bankroll-focused'
    },
    VILLAIN: {
        prefixes: ['Too easy.', 'Another victim.', 'Imagine thinking you could beat me...', 'Lmao...'],
        suffixes: ['...get good.', '...you\'re welcome.', '...next.', '...bow down. 👑'],
        style: 'arrogant and trash-talking'
    },
    END_BOSS: {
        prefixes: ['Final boss energy:', 'When you reach my level...', 'Crushing as usual...'],
        suffixes: ['...levels to this game.', '...stay in your lane.', ''],
        style: 'intimidating and confident'
    },
    MATH_NERD: {
        prefixes: ['Calculating...', 'The math:', 'Probability check:', 'Combinatorics say...'],
        suffixes: ['...QED.', '...the numbers don\'t lie.', '...pure mathematics.', ''],
        style: 'obsessed with calculations'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 BOT SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════

class BotService {

    /**
     * Fetch random active personas for cron trigger
     */
    async getRandomActivePersonas(count: number = 5): Promise<Persona[]> {
        if (!isSupabaseConfigured()) {
            console.log('[BotService] Supabase not configured, returning mock personas');
            return this.getMockPersonas(count);
        }

        const { data, error } = await supabase
            .rpc('get_random_active_personas', { p_count: count });

        if (error) {
            console.error('[BotService] Error fetching personas:', error);
            return this.getMockPersonas(count);
        }

        return data || [];
    }

    /**
     * Get all personas
     */
    async getAllPersonas(): Promise<Persona[]> {
        if (!isSupabaseConfigured()) {
            return this.getMockPersonas(100);
        }

        const { data, error } = await supabase
            .from('personas')
            .select('*')
            .eq('is_active', true)
            .order('player_id');

        if (error) {
            console.error('[BotService] Error fetching all personas:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get persona by ID
     */
    async getPersonaById(personaId: number): Promise<Persona | null> {
        if (!isSupabaseConfigured()) {
            const mocks = this.getMockPersonas(1);
            return mocks[0] || null;
        }

        const { data, error } = await supabase
            .from('personas')
            .select('*')
            .eq('id', personaId)
            .single();

        if (error) {
            console.error('[BotService] Error fetching persona:', error);
            return null;
        }

        return data;
    }

    /**
     * Generate a post in the persona's voice
     */
    generateVoicedContent(persona: Persona, rawContent: string): string {
        const archetype = persona.archetype as keyof typeof VOICE_TEMPLATES;
        const template = VOICE_TEMPLATES[archetype] || VOICE_TEMPLATES.GRINDER;

        // Select random prefix/suffix based on persona traits
        const usePrefix = Math.random() < 0.7; // 70% chance of prefix
        const useSuffix = Math.random() < 0.5; // 50% chance of suffix

        let voicedContent = rawContent;

        if (usePrefix) {
            const prefix = template.prefixes[Math.floor(Math.random() * template.prefixes.length)];
            voicedContent = `${prefix} ${voicedContent}`;
        }

        if (useSuffix) {
            const suffix = template.suffixes[Math.floor(Math.random() * template.suffixes.length)];
            voicedContent = `${voicedContent} ${suffix}`;
        }

        // Adjust for slang level
        if (persona.slang_level >= 8) {
            voicedContent = this.addSlang(voicedContent);
        }

        // Adjust for humor level
        if (persona.humor >= 8) {
            voicedContent = this.addHumor(voicedContent);
        }

        return voicedContent;
    }

    /**
     * Add slang to content
     */
    private addSlang(content: string): string {
        const slangMap: Record<string, string> = {
            'good': 'sick',
            'great': 'insane',
            'bad': 'brutal',
            'player': 'reg',
            'money': 'chips',
            'won': 'shipped',
            'lost': 'punted',
            'bet': 'fired',
            'call': 'snapped',
            'fold': 'mucked'
        };

        let result = content;
        Object.entries(slangMap).forEach(([word, slang]) => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (Math.random() < 0.5) {
                result = result.replace(regex, slang);
            }
        });

        return result;
    }

    /**
     * Add humor elements
     */
    private addHumor(content: string): string {
        const humors = [' 😂', ' 💀', ' lmao', ' 🤣', ' haha'];
        if (Math.random() < 0.4) {
            const humor = humors[Math.floor(Math.random() * humors.length)];
            return content + humor;
        }
        return content;
    }

    /**
     * Record a persona post
     */
    async recordPost(post: GeneratedPost): Promise<string | null> {
        if (!isSupabaseConfigured()) {
            console.log('[BotService] Mock recording post:', post);
            return 'mock-post-id';
        }

        const { data, error } = await supabase
            .rpc('record_persona_post', {
                p_persona_id: post.personaId,
                p_content: post.content,
                p_content_type: post.contentType,
                p_source_url: post.sourceUrl || null,
                p_source_hash: post.sourceHash || null
            });

        if (error) {
            console.error('[BotService] Error recording post:', error);
            return null;
        }

        return data;
    }

    /**
     * Check if content has been seen by persona
     */
    async hasSeenContent(personaId: number, contentHash: string): Promise<boolean> {
        const persona = await this.getPersonaById(personaId);
        if (!persona) return true; // Assume seen if can't verify

        return persona.seen_content_hashes.includes(contentHash);
    }

    /**
     * Get pending scrape content
     */
    async getPendingScrapeContent(limit: number = 10): Promise<ScrapedContent[]> {
        if (!isSupabaseConfigured()) {
            return this.getMockScrapedContent();
        }

        const { data, error } = await supabase
            .from('scrape_queue')
            .select('*')
            .eq('status', 'PENDING')
            .limit(limit);

        if (error) {
            console.error('[BotService] Error fetching scrape queue:', error);
            return [];
        }

        return (data || []).map(row => ({
            source: row.source,
            url: row.url,
            content: row.content,
            hash: row.content_hash
        }));
    }

    /**
     * Mark content as consumed
     */
    async markContentConsumed(contentHash: string, personaId: number): Promise<void> {
        if (!isSupabaseConfigured()) return;

        await supabase
            .from('scrape_queue')
            .update({
                status: 'CONSUMED',
                consumed_by: personaId,
                consumed_at: new Date().toISOString()
            })
            .eq('content_hash', contentHash);
    }

    /**
     * Generate content topics based on persona
     */
    getTopicsForPersona(persona: Persona): string[] {
        const baseTopics = persona.preferred_topics || [];

        // Add archetype-specific topics
        const archetypeTopics: Record<string, string[]> = {
            SOLVER: ['ranges', 'frequencies', 'EV calculations', 'solver outputs'],
            DEGEN: ['sick hands', 'huge pots', 'crazy bluffs', 'run good'],
            COACH: ['strategy tips', 'common mistakes', 'hand analysis'],
            NEWS_HOUND: ['tournament results', 'player news', 'industry updates'],
            GRINDER: ['session results', 'bankroll updates', 'volume goals'],
            VILLAIN: ['crushing souls', 'outplaying regs', 'biggest wins']
        };

        const extra = archetypeTopics[persona.archetype] || [];
        return [...new Set([...baseTopics, ...extra])];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🧪 MOCK DATA
    // ═══════════════════════════════════════════════════════════════════════

    private getMockPersonas(count: number): Persona[] {
        const archetypes = ['SOLVER', 'DEGEN', 'COACH', 'NEWS_HOUND', 'GRINDER', 'VILLAIN'];
        const mockPersonas: Persona[] = [];

        for (let i = 0; i < count; i++) {
            mockPersonas.push({
                id: i + 1,
                player_id: 101 + i,
                name: `Bot_${101 + i}`,
                avatar_url: null,
                location: 'Las Vegas, NV',
                bio: 'Autonomous poker persona',
                archetype: archetypes[i % archetypes.length],
                poker_specialty: 'NLH Cash',
                slang_level: Math.floor(Math.random() * 10) + 1,
                technicality: Math.floor(Math.random() * 10) + 1,
                aggression: Math.floor(Math.random() * 10) + 1,
                humor: Math.floor(Math.random() * 10) + 1,
                post_frequency: 'MEDIUM',
                preferred_topics: ['hand_analysis', 'news'],
                scrape_sources: ['reddit', 'pokernews'],
                last_post_at: null,
                posts_today: 0,
                seen_content_hashes: [],
                is_active: true
            });
        }

        return mockPersonas;
    }

    private getMockScrapedContent(): ScrapedContent[] {
        return [
            {
                source: 'reddit',
                url: 'https://reddit.com/r/poker/example1',
                content: 'Just made a sick hero call with bottom pair against a triple barrel',
                hash: 'mock-hash-1'
            },
            {
                source: 'pokernews',
                url: 'https://pokernews.com/example',
                content: 'Phil Ivey wins $2.5 million in high stakes cash game session',
                hash: 'mock-hash-2'
            },
            {
                source: 'twitch',
                url: 'https://twitch.tv/example',
                content: 'Crazy hand on stream - quad aces vs royal flush!',
                hash: 'mock-hash-3'
            }
        ];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

export const botService = new BotService();
export default botService;
