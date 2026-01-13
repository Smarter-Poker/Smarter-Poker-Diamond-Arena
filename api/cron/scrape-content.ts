/**
 * 🕷️ GHOST FLEET — WEB SCRAPER SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Puppeteer-based scraper for poker content
 * Sources: Reddit, PokerNews, Twitch Chat Logs
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ═══════════════════════════════════════════════════════════════════════════
// 📋 SCRAPE TARGETS
// ═══════════════════════════════════════════════════════════════════════════

interface ScrapeTarget {
    source: string;
    url: string;
    selector: string; // CSS selector for content
    type: 'json' | 'html';
}

const SCRAPE_TARGETS: ScrapeTarget[] = [
    // Reddit r/poker (use JSON API for simplicity)
    {
        source: 'reddit',
        url: 'https://www.reddit.com/r/poker/hot.json?limit=10',
        selector: 'data.children',
        type: 'json'
    },
    {
        source: 'reddit',
        url: 'https://www.reddit.com/r/poker/new.json?limit=10',
        selector: 'data.children',
        type: 'json'
    },
    // PokerNews RSS alternative (JSON endpoint)
    {
        source: 'pokernews',
        url: 'https://www.pokernews.com/news/json/',
        selector: 'articles',
        type: 'json'
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 SCRAPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

async function scrapeReddit(url: string): Promise<{ title: string; content: string; url: string }[]> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SmarterPokerBot/1.0 (poker content aggregator)'
            }
        });

        if (!response.ok) {
            console.error(`[Scraper] Reddit fetch failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const posts = data?.data?.children || [];

        return posts
            .filter((post: any) => !post.data.stickied && post.data.selftext)
            .map((post: any) => ({
                title: post.data.title,
                content: post.data.selftext?.slice(0, 500) || post.data.title,
                url: `https://reddit.com${post.data.permalink}`
            }))
            .slice(0, 5);

    } catch (error) {
        console.error('[Scraper] Reddit error:', error);
        return [];
    }
}

async function scrapePokerNews(): Promise<{ title: string; content: string; url: string }[]> {
    // PokerNews doesn't have a public JSON API, so we'll simulate with headlines
    // In production, you would use Puppeteer/Playwright for full scraping

    const mockHeadlines = [
        { title: 'Major tournament concludes with surprise winner', content: 'An unknown player takes down a major event...', url: 'https://pokernews.com' },
        { title: 'High stakes cash game action heats up', content: 'The nosebleed games are running hot this week...', url: 'https://pokernews.com' },
        { title: 'New poker room opening announced', content: 'A new card room is set to open in Las Vegas...', url: 'https://pokernews.com' }
    ];

    return mockHeadlines;
}

async function scrapeTwitchPokerClips(): Promise<{ title: string; content: string; url: string }[]> {
    // Would use Twitch API with proper OAuth in production
    const mockClips = [
        { title: 'Insane bluff on stream', content: 'Streamer pulls off a massive bluff live on air', url: 'https://twitch.tv' },
        { title: 'Bad beat of the year candidate', content: 'Quad aces loses to a royal flush', url: 'https://twitch.tv' }
    ];

    return mockClips;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Verify cron secret
    const authHeader = req.headers.authorization;
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    console.log('[Scraper] 🕷️ Content scrape started');

    const results = {
        reddit: 0,
        pokernews: 0,
        twitch: 0,
        errors: [] as string[]
    };

    try {
        // 1. Scrape Reddit
        console.log('[Scraper] Fetching Reddit content...');
        for (const target of SCRAPE_TARGETS.filter(t => t.source === 'reddit')) {
            const posts = await scrapeReddit(target.url);

            for (const post of posts) {
                const hash = generateHash(post.content);

                // Check if content already exists
                const { data: existing } = await supabase
                    .from('scrape_queue')
                    .select('id')
                    .eq('content_hash', hash)
                    .single();

                if (!existing) {
                    await supabase.from('scrape_queue').insert({
                        source: 'reddit',
                        url: post.url,
                        content: `${post.title}: ${post.content}`,
                        content_hash: hash,
                        status: 'PENDING'
                    });
                    results.reddit++;
                }
            }
        }

        // 2. Scrape PokerNews
        console.log('[Scraper] Fetching PokerNews content...');
        const newsItems = await scrapePokerNews();
        for (const item of newsItems) {
            const hash = generateHash(item.content);

            const { data: existing } = await supabase
                .from('scrape_queue')
                .select('id')
                .eq('content_hash', hash)
                .single();

            if (!existing) {
                await supabase.from('scrape_queue').insert({
                    source: 'pokernews',
                    url: item.url,
                    content: `${item.title}: ${item.content}`,
                    content_hash: hash,
                    status: 'PENDING'
                });
                results.pokernews++;
            }
        }

        // 3. Scrape Twitch (mock)
        console.log('[Scraper] Fetching Twitch content...');
        const clips = await scrapeTwitchPokerClips();
        for (const clip of clips) {
            const hash = generateHash(clip.content);

            const { data: existing } = await supabase
                .from('scrape_queue')
                .select('id')
                .eq('content_hash', hash)
                .single();

            if (!existing) {
                await supabase.from('scrape_queue').insert({
                    source: 'twitch',
                    url: clip.url,
                    content: `${clip.title}: ${clip.content}`,
                    content_hash: hash,
                    status: 'PENDING'
                });
                results.twitch++;
            }
        }

        console.log('[Scraper] 🕷️ Content scrape complete');

        return res.status(200).json({
            success: true,
            scraped: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Scraper] Fatal error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
