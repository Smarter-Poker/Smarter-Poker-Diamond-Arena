/**
 * 💝 SOCIAL TIPPING SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORB_01] Logic to allow users to send Diamonds
 * to others in the Social Shell.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 * - P2P Diamond transfers
 * - 25% burn on all tips (HARD LAW)
 * - Tip history and analytics
 * - Social recognition
 * 
 * @target Orb 01 - Social Shell
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ TIPPING CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const TIPPING_CONFIG = {
    // Burn rate (HARD LAW)
    BURN_RATE: 0.25,  // 25% of all tips burned

    // Limits
    MIN_TIP: 1,
    MAX_TIP: 10000,
    DAILY_LIMIT: 50000,

    // Quick tip presets
    PRESETS: [5, 10, 25, 50, 100, 500],

    // Recognition tiers (by total tips given)
    RECOGNITION_TIERS: [
        { name: 'TIPPER', threshold: 100, badge: '💝' },
        { name: 'GENEROUS', threshold: 1000, badge: '🎁' },
        { name: 'BENEFACTOR', threshold: 10000, badge: '👑' },
        { name: 'PHILANTHROPIST', threshold: 100000, badge: '🏆' }
    ]
};

// ═══════════════════════════════════════════════════════════
// 💝 SOCIAL TIPPING SERVICE CLASS
// ═══════════════════════════════════════════════════════════

export class SocialTippingService {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('TIPPING_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 💎 TIP OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Send tip to another user
     * 25% is burned, 75% goes to recipient
     * 
     * @param {object} tipData - Tip parameters
     * @returns {Promise<object>} Tip result
     */
    async sendTip(tipData) {
        const { senderId, recipientId, amount, message } = tipData;

        // Validate
        if (senderId === recipientId) {
            return { success: false, error: 'CANNOT_TIP_SELF' };
        }

        if (amount < TIPPING_CONFIG.MIN_TIP || amount > TIPPING_CONFIG.MAX_TIP) {
            return {
                success: false,
                error: 'INVALID_TIP_AMOUNT',
                limits: { min: TIPPING_CONFIG.MIN_TIP, max: TIPPING_CONFIG.MAX_TIP }
            };
        }

        // Calculate burn split
        const burnAmount = Math.floor(amount * TIPPING_CONFIG.BURN_RATE);
        const recipientReceives = amount - burnAmount;

        const { data, error } = await this.supabase.rpc('fn_send_social_tip', {
            p_sender_id: senderId,
            p_recipient_id: recipientId,
            p_amount: amount,
            p_burn_amount: burnAmount,
            p_recipient_receives: recipientReceives,
            p_message: message || null
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate tip split locally
     * 
     * @param {number} amount - Tip amount
     * @returns {object} Split calculation
     */
    static calculateTipSplit(amount) {
        const burnAmount = Math.floor(amount * TIPPING_CONFIG.BURN_RATE);
        const recipientReceives = amount - burnAmount;

        return {
            tipAmount: amount,
            burnAmount,
            recipientReceives,
            burnRate: '25%',
            formula: `${amount} = ${burnAmount} (🔥) + ${recipientReceives} (💝)`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 TIP HISTORY
    // ═══════════════════════════════════════════════════════

    /**
     * Get tips sent by user
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Sent tips
     */
    async getTipsSent(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('social_transactions')
            .select('*, recipient:recipient_id(username, avatar_url)')
            .eq('sender_id', userId)
            .eq('tx_type', 'TIP')
            .order('created_at', { ascending: false })
            .limit(limit);

        const totalSent = (data || []).reduce((sum, t) => sum + t.amount, 0);

        return {
            success: !error,
            tips: data || [],
            stats: {
                count: data?.length || 0,
                totalSent,
                totalBurned: (data || []).reduce((sum, t) => sum + t.burn_amount, 0)
            }
        };
    }

    /**
     * Get tips received by user
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Received tips
     */
    async getTipsReceived(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('social_transactions')
            .select('*, sender:sender_id(username, avatar_url)')
            .eq('recipient_id', userId)
            .eq('tx_type', 'TIP')
            .order('created_at', { ascending: false })
            .limit(limit);

        const totalReceived = (data || []).reduce((sum, t) => sum + t.recipient_receives, 0);

        return {
            success: !error,
            tips: data || [],
            stats: {
                count: data?.length || 0,
                totalReceived
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🏆 RECOGNITION
    // ═══════════════════════════════════════════════════════

    /**
     * Get user's tipping recognition tier
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Recognition status
     */
    async getRecognitionStatus(userId) {
        const { stats } = await this.getTipsSent(userId, 1000);
        const totalTipped = stats.totalSent;

        let currentTier = null;
        let nextTier = TIPPING_CONFIG.RECOGNITION_TIERS[0];

        for (const tier of TIPPING_CONFIG.RECOGNITION_TIERS) {
            if (totalTipped >= tier.threshold) {
                currentTier = tier;
            } else if (!nextTier || tier.threshold < nextTier.threshold) {
                nextTier = tier;
            }
        }

        return {
            totalTipped,
            currentTier,
            nextTier: currentTier !== TIPPING_CONFIG.RECOGNITION_TIERS[TIPPING_CONFIG.RECOGNITION_TIERS.length - 1]
                ? {
                    name: nextTier.name,
                    threshold: nextTier.threshold,
                    remaining: nextTier.threshold - totalTipped,
                    badge: nextTier.badge
                }
                : null,
            allTiers: TIPPING_CONFIG.RECOGNITION_TIERS.map(t => ({
                ...t,
                unlocked: totalTipped >= t.threshold
            }))
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔄 DAILY LIMIT CHECK
    // ═══════════════════════════════════════════════════════

    /**
     * Check if user is under daily tip limit
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Limit status
     */
    async checkDailyLimit(userId) {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await this.supabase
            .from('social_transactions')
            .select('amount')
            .eq('sender_id', userId)
            .eq('tx_type', 'TIP')
            .gte('created_at', `${today}T00:00:00Z`);

        const tippedToday = (data || []).reduce((sum, t) => sum + t.amount, 0);
        const remaining = TIPPING_CONFIG.DAILY_LIMIT - tippedToday;

        return {
            success: !error,
            tippedToday,
            dailyLimit: TIPPING_CONFIG.DAILY_LIMIT,
            remaining: Math.max(0, remaining),
            canTip: remaining > 0
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default SocialTippingService;
