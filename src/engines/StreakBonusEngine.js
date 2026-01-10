/**
 * 🔥 STREAK BONUS ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Maps streak_multipliers logic via RPC.
 * Tier 1: 3 days = 1.2x | Tier 2: 7 days = 2.0x
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK TIER CONFIGURATION (Client-side mirror)
// ═══════════════════════════════════════════════════════════

export const STREAK_TIERS_V2 = {
    COLD: { minDays: 0, maxDays: 0, multiplier: 1.00, label: '❄️ Cold' },
    WARMING: { minDays: 1, maxDays: 2, multiplier: 1.10, label: '🌡️ Warming' },
    TIER_1: { minDays: 3, maxDays: 6, multiplier: 1.20, label: '🔥 Streak Tier 1' },
    TIER_2: { minDays: 7, maxDays: 13, multiplier: 2.00, label: '🔥🔥 Streak Tier 2' },
    BLAZING: { minDays: 14, maxDays: 29, multiplier: 2.25, label: '🔥🔥🔥 Blazing' },
    LEGENDARY: { minDays: 30, maxDays: null, multiplier: 2.50, label: '👑 Legendary' }
};

// ═══════════════════════════════════════════════════════════
// 🎯 STREAK BONUS ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class StreakBonusEngine {

    /**
     * @param {object} supabase - Initialized Supabase client
     */
    constructor(supabase) {
        if (!supabase) {
            throw new Error('STREAK_BONUS_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 GET MULTIPLIER
    // ═══════════════════════════════════════════════════════

    /**
     * Get streak multiplier for given consecutive days (RPC)
     * 
     * @param {number} consecutiveDays - Current streak length
     * @returns {Promise<object>} Multiplier info
     */
    async getMultiplier(consecutiveDays) {
        const { data, error } = await this.supabase.rpc('fn_get_streak_multiplier_v2', {
            p_consecutive_days: consecutiveDays
        });

        if (error) {
            // Fallback to client-side calculation
            return this.getMultiplierLocal(consecutiveDays);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return {
            tier: result.tier,
            multiplier: parseFloat(result.multiplier),
            label: result.label,
            minDays: result.min_days,
            maxDays: result.max_days
        };
    }

    /**
     * Get streak multiplier locally (no DB call)
     * 
     * @param {number} consecutiveDays - Current streak length
     * @returns {object} Multiplier info
     */
    getMultiplierLocal(consecutiveDays) {
        for (const [tierName, tier] of Object.entries(STREAK_TIERS_V2)) {
            const inRange = consecutiveDays >= tier.minDays &&
                (tier.maxDays === null || consecutiveDays <= tier.maxDays);
            if (inRange) {
                return {
                    tier: tierName,
                    multiplier: tier.multiplier,
                    label: tier.label,
                    minDays: tier.minDays,
                    maxDays: tier.maxDays
                };
            }
        }
        return { tier: 'COLD', multiplier: 1.0, label: '❄️ Cold' };
    }

    // ═══════════════════════════════════════════════════════
    // ⚡ MINT WITH STREAK BONUS
    // ═══════════════════════════════════════════════════════

    /**
     * Mint diamonds with automatic streak multiplier
     * Checks consecutive_login_days before finalizing mint
     * 
     * @param {string} userId - Target user UUID
     * @param {number} baseAmount - Base amount before multiplier
     * @param {string} source - Transaction source
     * @param {object} metadata - Additional metadata
     * @returns {Promise<object>} Mint result with breakdown
     */
    async mintWithStreakBonus(userId, baseAmount, source = 'SESSION_REWARD', metadata = {}) {
        const { data, error } = await this.supabase.rpc('fn_mint_with_streak_bonus', {
            p_user_id: userId,
            p_base_amount: baseAmount,
            p_source: source,
            p_metadata: metadata
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'STREAK_MINT_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                status: result.status
            };
        }

        return {
            success: true,
            status: result.status,
            baseAmount: result.data.base_amount,
            bonusAmount: result.data.bonus_amount,
            finalAmount: result.data.final_amount,
            balanceBefore: result.data.balance_before,
            balanceAfter: result.data.balance_after,
            transactionId: result.data.transaction_id,
            streak: {
                consecutiveDays: result.streak.consecutive_days,
                multiplier: parseFloat(result.streak.multiplier),
                tier: result.streak.tier,
                tierLabel: result.streak.tier_label
            },
            executionMs: result.meta?.execution_ms
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔄 UPDATE CONSECUTIVE LOGIN
    // ═══════════════════════════════════════════════════════

    /**
     * Update user's consecutive login days
     * Call this when user logs in or claims daily
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Updated streak info
     */
    async updateConsecutiveLogin(userId) {
        const { data, error } = await this.supabase.rpc('fn_update_consecutive_login', {
            p_user_id: userId
        });

        if (error) {
            return {
                success: false,
                error: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            success: result.success,
            consecutiveDays: result.consecutive_days,
            previousStreak: result.previous_streak,
            longestStreak: result.longest_streak,
            streakReset: result.streak_reset,
            firstLogin: result.first_login,
            multiplierInfo: result.multiplier_info
        };
    }

    // ═══════════════════════════════════════════════════════
    // ⚡ COMBINED: LOGIN + BONUS MINT
    // ═══════════════════════════════════════════════════════

    /**
     * Update login streak and mint daily bonus in one atomic op
     * 
     * @param {string} userId - User UUID
     * @param {number} baseBonus - Base bonus amount (default: 5)
     * @returns {Promise<object>} Combined result
     */
    async loginAndMintBonus(userId, baseBonus = 5) {
        const { data, error } = await this.supabase.rpc('fn_login_and_mint_bonus', {
            p_user_id: userId,
            p_base_bonus: baseBonus
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'LOGIN_BONUS_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error || result.status,
                status: result.status
            };
        }

        return {
            success: true,
            status: result.status,
            summary: {
                consecutiveDays: result.summary.consecutive_days,
                diamondsEarned: result.summary.diamonds_earned,
                newBalance: result.summary.new_balance,
                multiplier: parseFloat(result.summary.multiplier),
                tier: result.summary.tier
            },
            loginDetails: result.login,
            mintDetails: result.mint
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 UTILITY: CALCULATE REWARD PREVIEW
    // ═══════════════════════════════════════════════════════

    /**
     * Preview what reward a user would get without minting
     * 
     * @param {number} baseAmount - Base amount
     * @param {number} consecutiveDays - Current streak
     * @returns {object} Reward preview
     */
    previewReward(baseAmount, consecutiveDays) {
        const multiplierInfo = this.getMultiplierLocal(consecutiveDays);
        const finalAmount = Math.floor(baseAmount * multiplierInfo.multiplier);
        const bonusAmount = finalAmount - baseAmount;

        return {
            baseAmount,
            bonusAmount,
            finalAmount,
            multiplier: multiplierInfo.multiplier,
            tier: multiplierInfo.tier,
            tierLabel: multiplierInfo.label,
            consecutiveDays,
            formula: `${baseAmount} × ${multiplierInfo.multiplier.toFixed(2)} = ${finalAmount}`
        };
    }

    /**
     * Get days until next tier upgrade
     * 
     * @param {number} currentDays - Current streak
     * @returns {object} Next tier info
     */
    getNextTierInfo(currentDays) {
        const currentTier = this.getMultiplierLocal(currentDays);
        const tiers = Object.entries(STREAK_TIERS_V2)
            .sort((a, b) => a[1].minDays - b[1].minDays);

        for (const [tierName, tier] of tiers) {
            if (tier.minDays > currentDays) {
                return {
                    nextTier: tierName,
                    nextLabel: tier.label,
                    nextMultiplier: tier.multiplier,
                    daysToNext: tier.minDays - currentDays,
                    currentTier: currentTier.tier,
                    currentMultiplier: currentTier.multiplier
                };
            }
        }

        return {
            nextTier: null,
            daysToNext: 0,
            message: '👑 Maximum tier achieved!',
            currentTier: currentTier.tier,
            currentMultiplier: currentTier.multiplier
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default StreakBonusEngine;
