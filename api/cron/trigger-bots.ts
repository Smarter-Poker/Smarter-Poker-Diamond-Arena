/**
 * 🤖 GHOST FLEET — CRON TRIGGER ENDPOINT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Vercel Cron Job Endpoint: Triggers 5 random bots every 30 minutes
 * 
 * Add to vercel.json:
 * {
 *   "crons": [
 *     { "path": "/api/cron/trigger-bots", "schedule": "*/30 * * * * " }
    *   ]
 * }
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 VOICE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

interface Persona {
    id: number;
    player_id: number;
    name: string;
    archetype: string;
    poker_specialty: string;
    slang_level: number;
    technicality: number;
    aggression: number;
    humor: number;
    preferred_topics: string[];
}

async function generateBotPost(persona: Persona, inspiration?: string): Promise<string> {
    // If no OpenAI key, use template-based generation
    if (!OPENAI_API_KEY) {
        return generateTemplatePost(persona, inspiration);
    }

    const systemPrompt = buildSystemPrompt(persona);
    const userPrompt = inspiration
        ? `Create a social media post about this poker topic: "${inspiration}"`
        : `Create an original social media post about ${persona.preferred_topics[0] || 'poker strategy'}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 280, // Twitter-length
                temperature: 0.9
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || generateTemplatePost(persona, inspiration);
    } catch (error) {
        console.error('[Cron] OpenAI error:', error);
        return generateTemplatePost(persona, inspiration);
    }
}

function buildSystemPrompt(persona: Persona): string {
    const slangDesc = persona.slang_level >= 7 ? 'heavy poker slang and internet speak' :
        persona.slang_level >= 4 ? 'moderate poker terminology' : 'formal language';

    const techDesc = persona.technicality >= 7 ? 'deep technical analysis with math' :
        persona.technicality >= 4 ? 'some strategic concepts' : 'casual observations';

    const toneDesc = persona.aggression >= 7 ? 'aggressive and confrontational' :
        persona.aggression >= 4 ? 'confident' : 'friendly and helpful';

    const humorDesc = persona.humor >= 7 ? 'lots of jokes and memes' :
        persona.humor >= 4 ? 'occasional wit' : 'serious tone';

    return `You are ${persona.name}, a poker player persona on a social media platform.

IDENTITY:
- Archetype: ${persona.archetype}
- Specialty: ${persona.poker_specialty}
- Location: Based in the poker world

VOICE PROFILE:
- Language style: ${slangDesc}
- Technical depth: ${techDesc}  
- Tone: ${toneDesc}
- Humor: ${humorDesc}

RULES:
- Keep posts under 280 characters
- Stay in character at all times
- Never break the fourth wall
- Reference poker concepts relevant to your archetype
- Use emojis sparingly based on your personality
- Never use hashtags`;
}

function generateTemplatePost(persona: Persona, inspiration?: string): string {
    const templates: Record<string, string[]> = {
        SOLVER: [
            'Ran this spot through the solver. The answer might surprise you...',
            'At equilibrium, this play has +EV. Trust the math.',
            'Frequency check: are you cbetting this board enough?',
            'GTO says check. Your ego says bet. GTO is right.',
            'Mixed strategy at the right frequency = unexploitable.'
        ],
        DEGEN: [
            'SHIPPED IT! Stack goes brrrrr 💎🔥',
            'Just flopped the world. Time to get paid!',
            'All in pre. No ragrets. YOLO poker is best poker.',
            'Running like god rn. Is this what being good feels like?',
            'Punted a buy-in but vibes are immaculate 🎰'
        ],
        COACH: [
            'Pro tip: Your biggest leak is probably preflop. Fix that first.',
            'Remember: Position is power. Play more hands IP.',
            'Quick lesson: Pot odds matter. Do the math.',
            'Common mistake: Playing too many hands OOP. Stop it.',
            'Study tip: Review your losing sessions, not your winning ones.'
        ],
        NEWS_HOUND: [
            '🚨 Big action at the nosebleeds today. Updates coming.',
            'Tournament update: Deep runs happening across multiple events.',
            'Industry news: Major changes coming to the poker world.',
            'High stakes report: The usual suspects battling it out.',
            '📰 Your daily poker news digest is here.'
        ],
        GRINDER: [
            'Session report: +2 buy-ins. Solid ABC poker pays.',
            'Bankroll update: Slow and steady progression continues.',
            'Volume goal for today: 2000 hands. Let\'s grind.',
            'Table selection is 50% of your win rate. Never forget.',
            'Another day, another grind. Consistency is key.'
        ],
        VILLAIN: [
            'Another soul crushed. You\'re welcome for the lesson.',
            'Imagine thinking you could bluff me. Cute.',
            'Stacking regs is my cardio. Stay in shape, people.',
            'Your read was wrong. My read was right. As usual.',
            'Fear me at the tables. It\'s the smart play.'
        ]
    };

    const archetypeTemplates = templates[persona.archetype] || templates.GRINDER;
    const base = archetypeTemplates[Math.floor(Math.random() * archetypeTemplates.length)];

    if (inspiration && Math.random() > 0.5) {
        return `${base} Speaking of which: ${inspiration.slice(0, 100)}...`;
    }

    return base;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Verify cron secret (security)
    const authHeader = req.headers.authorization;
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        // Allow manual triggers in development
        if (process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    console.log('[Cron] 🤖 Ghost Fleet trigger started');

    try {
        // 1. Get 5 random active personas
        const { data: personas, error: personaError } = await supabase
            .rpc('get_random_active_personas', { p_count: 5 });

        if (personaError || !personas?.length) {
            console.log('[Cron] No personas available or error:', personaError);
            return res.status(200).json({
                success: true,
                message: 'No active personas to trigger',
                triggered: 0
            });
        }

        console.log(`[Cron] Selected ${personas.length} personas for activation`);

        // 2. Get some scraped content for inspiration (optional)
        const { data: scrapedContent } = await supabase
            .from('scrape_queue')
            .select('*')
            .eq('status', 'PENDING')
            .limit(5);

        // 3. Generate and post for each persona
        const results = [];

        for (const persona of personas) {
            // Add random delay (60-300 seconds converted to immediate for demo)
            const delayMs = Math.floor(Math.random() * 5000) + 1000; // 1-6 seconds for demo
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Pick random inspiration if available
            const inspiration = scrapedContent?.length
                ? scrapedContent[Math.floor(Math.random() * scrapedContent.length)]?.content
                : undefined;

            // Generate post content
            const content = await generateBotPost(persona, inspiration);

            // Record the post
            const { data: postId, error: postError } = await supabase
                .rpc('record_persona_post', {
                    p_persona_id: persona.id,
                    p_content: content,
                    p_content_type: 'POST',
                    p_source_url: null,
                    p_source_hash: null
                });

            if (postError) {
                console.error(`[Cron] Error posting for ${persona.name}:`, postError);
                results.push({ persona: persona.name, success: false, error: postError.message });
            } else {
                console.log(`[Cron] ✅ ${persona.name} posted: "${content.slice(0, 50)}..."`);
                results.push({ persona: persona.name, success: true, postId, preview: content.slice(0, 100) });
            }
        }

        // 4. Mark used scrape content as consumed
        if (scrapedContent?.length) {
            for (const content of scrapedContent) {
                await supabase
                    .from('scrape_queue')
                    .update({ status: 'CONSUMED', consumed_at: new Date().toISOString() })
                    .eq('id', content.id);
            }
        }

        console.log('[Cron] 🤖 Ghost Fleet trigger complete');

        return res.status(200).json({
            success: true,
            triggered: results.length,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Cron] Fatal error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
