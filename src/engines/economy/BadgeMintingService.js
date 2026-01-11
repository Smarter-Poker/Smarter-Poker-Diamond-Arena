/**
 * 🎖️ BADGE MINTING SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORB_01] Logic to purchase "Identity DNA" badges
 * (e.g., 'GTO Master') using Diamonds.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 * - Badge catalog with pricing
 * - Badge minting with Diamond payment
 * - 25% burn on all purchases (HARD LAW)
 * - Badge showcase and rarity
 * 
 * @target Orb 01 - Identity DNA
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ BADGE CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const BADGE_CONFIG = {
    // Burn rate (HARD LAW)
    BURN_RATE: 0.25,

    // Rarity tiers
    RARITIES: {
        COMMON: { multiplier: 1.0, color: '#AAAAAA' },
        UNCOMMON: { multiplier: 1.5, color: '#55AA55' },
        RARE: { multiplier: 2.5, color: '#5555FF' },
        EPIC: { multiplier: 5.0, color: '#AA55AA' },
        LEGENDARY: { multiplier: 10.0, color: '#FFAA00' }
    },

    // Badge catalog
    CATALOG: [
        // Skill badges
        { id: 'gto_master', name: 'GTO Master', category: 'SKILL', rarity: 'LEGENDARY', basePrice: 5000, icon: '🎯' },
        { id: 'range_expert', name: 'Range Expert', category: 'SKILL', rarity: 'EPIC', basePrice: 2500, icon: '📊' },
        { id: 'ev_calculator', name: 'EV Calculator', category: 'SKILL', rarity: 'RARE', basePrice: 1000, icon: '🧮' },
        { id: 'position_pro', name: 'Position Pro', category: 'SKILL', rarity: 'UNCOMMON', basePrice: 500, icon: '♠️' },

        // Achievement badges
        { id: 'streak_warrior', name: 'Streak Warrior', category: 'ACHIEVEMENT', rarity: 'RARE', basePrice: 1500, icon: '🔥' },
        { id: 'diamond_hands', name: 'Diamond Hands', category: 'ACHIEVEMENT', rarity: 'EPIC', basePrice: 3000, icon: '💎' },
        { id: 'iron_will', name: 'Iron Will', category: 'ACHIEVEMENT', rarity: 'RARE', basePrice: 1200, icon: '🛡️' },

        // Social badges
        { id: 'generous_tipper', name: 'Generous Tipper', category: 'SOCIAL', rarity: 'UNCOMMON', basePrice: 400, icon: '💝' },
        { id: 'community_pillar', name: 'Community Pillar', category: 'SOCIAL', rarity: 'RARE', basePrice: 800, icon: '🏛️' },
        { id: 'mentor', name: 'Mentor', category: 'SOCIAL', rarity: 'EPIC', basePrice: 2000, icon: '🎓' },

        // Cosmetic badges
        { id: 'night_owl', name: 'Night Owl', category: 'COSMETIC', rarity: 'COMMON', basePrice: 100, icon: '🦉' },
        { id: 'early_bird', name: 'Early Bird', category: 'COSMETIC', rarity: 'COMMON', basePrice: 100, icon: '🐦' },
        { id: 'shark', name: 'Shark', category: 'COSMETIC', rarity: 'UNCOMMON', basePrice: 300, icon: '🦈' },
        { id: 'whale', name: 'Whale', category: 'COSMETIC', rarity: 'LEGENDARY', basePrice: 10000, icon: '🐋' }
    ]
};

// ═══════════════════════════════════════════════════════════
// 🎖️ BADGE MINTING SERVICE CLASS
// ═══════════════════════════════════════════════════════════

export class BadgeMintingService {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('BADGE_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 📚 CATALOG
    // ═══════════════════════════════════════════════════════

    /**
     * Get badge catalog
     * 
     * @param {string} category - Optional category filter
     * @returns {Array} Badge catalog
     */
    static getCatalog(category = null) {
        let badges = BADGE_CONFIG.CATALOG;

        if (category) {
            badges = badges.filter(b => b.category === category);
        }

        return badges.map(badge => ({
            ...badge,
            price: BadgeMintingService.calculatePrice(badge),
            rarityColor: BADGE_CONFIG.RARITIES[badge.rarity].color
        }));
    }

    /**
     * Calculate badge price (base × rarity multiplier)
     * 
     * @param {object} badge - Badge definition
     * @returns {number} Final price
     */
    static calculatePrice(badge) {
        const multiplier = BADGE_CONFIG.RARITIES[badge.rarity]?.multiplier || 1.0;
        return Math.floor(badge.basePrice * multiplier);
    }

    /**
     * Get badge by ID
     * 
     * @param {string} badgeId - Badge ID
     * @returns {object|null} Badge info
     */
    static getBadge(badgeId) {
        const badge = BADGE_CONFIG.CATALOG.find(b => b.id === badgeId);
        if (!badge) return null;

        return {
            ...badge,
            price: BadgeMintingService.calculatePrice(badge),
            rarityColor: BADGE_CONFIG.RARITIES[badge.rarity].color
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎖️ MINTING
    // ═══════════════════════════════════════════════════════

    /**
     * Mint badge for user
     * 25% of price is burned
     * 
     * @param {object} mintData - Mint parameters
     * @returns {Promise<object>} Mint result
     */
    async mintBadge(mintData) {
        const { userId, badgeId } = mintData;

        // Get badge info
        const badge = BadgeMintingService.getBadge(badgeId);
        if (!badge) {
            return { success: false, error: 'BADGE_NOT_FOUND' };
        }

        // Calculate burn split
        const price = badge.price;
        const burnAmount = Math.floor(price * BADGE_CONFIG.BURN_RATE);
        const netCost = price - burnAmount;  // This goes to system

        const { data, error } = await this.supabase.rpc('fn_mint_badge', {
            p_user_id: userId,
            p_badge_id: badgeId,
            p_badge_name: badge.name,
            p_badge_category: badge.category,
            p_badge_rarity: badge.rarity,
            p_price: price,
            p_burn_amount: burnAmount
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate mint cost breakdown
     * 
     * @param {string} badgeId - Badge ID
     * @returns {object} Cost breakdown
     */
    static calculateMintCost(badgeId) {
        const badge = BadgeMintingService.getBadge(badgeId);
        if (!badge) return null;

        const burnAmount = Math.floor(badge.price * BADGE_CONFIG.BURN_RATE);

        return {
            badge: badge.name,
            rarity: badge.rarity,
            price: badge.price,
            burnAmount,
            burnRate: '25%',
            formula: `${badge.price} 💎 (${burnAmount} 🔥 burned)`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 👤 USER BADGES
    // ═══════════════════════════════════════════════════════

    /**
     * Get user's owned badges
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} User badges
     */
    async getUserBadges(userId) {
        const { data, error } = await this.supabase
            .from('user_badges')
            .select('*')
            .eq('user_id', userId)
            .order('minted_at', { ascending: false });

        // Group by category
        const byCategory = {};
        for (const badge of data || []) {
            if (!byCategory[badge.category]) {
                byCategory[badge.category] = [];
            }
            byCategory[badge.category].push(badge);
        }

        return {
            success: !error,
            badges: data || [],
            count: data?.length || 0,
            byCategory,
            totalSpent: (data || []).reduce((sum, b) => sum + b.price_paid, 0)
        };
    }

    /**
     * Check if user owns badge
     * 
     * @param {string} userId - User UUID
     * @param {string} badgeId - Badge ID
     * @returns {Promise<boolean>} Ownership status
     */
    async userOwnsBadge(userId, badgeId) {
        const { data } = await this.supabase
            .from('user_badges')
            .select('id')
            .eq('user_id', userId)
            .eq('badge_id', badgeId)
            .single();

        return !!data;
    }

    /**
     * Get featured/showcase badges for user
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Showcase badges
     */
    async getShowcaseBadges(userId) {
        const { data, error } = await this.supabase
            .from('user_badges')
            .select('*')
            .eq('user_id', userId)
            .eq('is_showcase', true)
            .limit(3);

        return {
            success: !error,
            showcase: data || []
        };
    }

    /**
     * Set badge as showcase/featured
     * 
     * @param {string} userId - User UUID
     * @param {string} badgeId - Badge ID
     * @param {boolean} showcase - Showcase status
     * @returns {Promise<object>} Update result
     */
    async setShowcase(userId, badgeId, showcase = true) {
        const { data, error } = await this.supabase
            .from('user_badges')
            .update({ is_showcase: showcase })
            .eq('user_id', userId)
            .eq('badge_id', badgeId)
            .select()
            .single();

        return { success: !error, badge: data };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default BadgeMintingService;
