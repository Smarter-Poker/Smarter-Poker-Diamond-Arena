/**
 * 💎 DIAMOND MINT ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Orb #7 (Arcade) | Orb #10 (Marketplace)
 * 
 * THE SUPREME LAW: Streak-based multipliers reward
 * consistency and habit formation.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK TIER CONFIGURATION
// ═══════════════════════════════════════════════════════════
export const STREAK_TIERS = {
    COLD:      { minDays: 0,  maxDays: 0,  multiplier: 1.00, label: '❄️ Cold' },
    WARMING:   { minDays: 1,  maxDays: 2,  multiplier: 1.10, label: '🌡️ Warming' },
    WARM:      { minDays: 3,  maxDays: 6,  multiplier: 1.25, label: '🔥 Warm' },
    HOT:       { minDays: 7,  maxDays: 13, multiplier: 1.50, label: '🔥🔥 Hot' },
    BLAZING:   { minDays: 14, maxDays: 29, multiplier: 1.75, label: '🔥🔥🔥 Blazing' },
    LEGENDARY: { minDays: 30, maxDays: Infinity, multiplier: 2.00, label: '👑 Legendary' }
};

// ═══════════════════════════════════════════════════════════
// 💎 DIAMOND MINT ENGINE CLASS
// ═══════════════════════════════════════════════════════════
export class DiamondMintEngine {
    
    /**
     * 🧮 Calculate diamond reward with streak multiplier
     * 
     * @param {number} baseDiamonds - Base diamond amount before multiplier
     * @param {number} consecutiveDays - Current streak length in days
     * @returns {{ 
     *   finalAmount: number, 
     *   multiplier: number, 
     *   tier: object,
     *   breakdown: object 
     * }}
     */
    static calculateReward(baseDiamonds, consecutiveDays = 0) {
        // Guard: Validate inputs
        if (typeof baseDiamonds !== 'number' || baseDiamonds < 0) {
            throw new Error('MINT_ERROR: baseDiamonds must be a non-negative number');
        }
        if (typeof consecutiveDays !== 'number' || consecutiveDays < 0) {
            consecutiveDays = 0;
        }
        
        // Find matching tier
        const tier = this.getStreakTier(consecutiveDays);
        const multiplier = tier.multiplier;
        
        // Calculate final amount (always floor to prevent fractional diamonds)
        const rawAmount = baseDiamonds * multiplier;
        const finalAmount = Math.floor(rawAmount);
        const bonusDiamonds = finalAmount - baseDiamonds;
        
        return {
            finalAmount,
            multiplier,
            tier,
            breakdown: {
                base: baseDiamonds,
                bonus: bonusDiamonds,
                streakDays: consecutiveDays,
                formula: `${baseDiamonds} × ${multiplier.toFixed(2)} = ${finalAmount}`
            }
        };
    }
    
    /**
     * 🔥 Get streak tier based on consecutive days
     * 
     * @param {number} consecutiveDays 
     * @returns {object} Tier configuration object
     */
    static getStreakTier(consecutiveDays) {
        for (const [, tier] of Object.entries(STREAK_TIERS)) {
            if (consecutiveDays >= tier.minDays && consecutiveDays <= tier.maxDays) {
                return tier;
            }
        }
        // Fallback to COLD tier
        return STREAK_TIERS.COLD;
    }
    
    /**
     * 📊 Calculate progressive multiplier (alternative formula)
     * This uses the gradual increase formula: 1.0 + (days × 0.05), capped at 2.0
     * 
     * @param {number} consecutiveDays 
     * @returns {number} Progressive multiplier
     */
    static calculateProgressiveMultiplier(consecutiveDays) {
        const base = 1.0;
        const increment = 0.05;
        const cap = 2.0;
        
        return Math.min(base + (consecutiveDays * increment), cap);
    }
    
    /**
     * 💰 Mint diamonds for a session completion
     * Combines base rewards from performance with streak bonuses
     * 
     * @param {object} sessionResult - Session performance data
     * @param {number} sessionResult.accuracy - Score between 0 and 1
     * @param {number} sessionResult.questionsAnswered - Total questions
     * @param {number} consecutiveDays - Current streak
     * @returns {object} Minting result with full breakdown
     */
    static mintSessionReward(sessionResult, consecutiveDays = 0) {
        const { accuracy = 0, questionsAnswered = 0 } = sessionResult;
        
        // Base diamond formula: 10 diamonds per perfect 20-question session
        const perfectSessionValue = 10;
        const basePerQuestion = perfectSessionValue / 20;
        
        // Calculate base diamonds (accuracy-weighted)
        const rawBase = questionsAnswered * basePerQuestion * accuracy;
        const baseDiamonds = Math.floor(rawBase);
        
        // Apply streak multiplier
        const mintResult = this.calculateReward(baseDiamonds, consecutiveDays);
        
        return {
            ...mintResult,
            sessionMetrics: {
                accuracy: (accuracy * 100).toFixed(1) + '%',
                questionsAnswered,
                baseFormula: `${questionsAnswered} × ${basePerQuestion.toFixed(2)} × ${accuracy.toFixed(2)}`
            }
        };
    }
    
    /**
     * 🎯 Calculate days until next tier upgrade
     * 
     * @param {number} currentDays - Current streak days
     * @returns {{ daysToNext: number, nextTier: object | null }}
     */
    static getDaysToNextTier(currentDays) {
        const currentTier = this.getStreakTier(currentDays);
        const tiers = Object.values(STREAK_TIERS);
        const currentIndex = tiers.findIndex(t => t.minDays === currentTier.minDays);
        
        if (currentIndex >= tiers.length - 1) {
            return { daysToNext: 0, nextTier: null, message: '👑 Maximum tier achieved!' };
        }
        
        const nextTier = tiers[currentIndex + 1];
        const daysToNext = nextTier.minDays - currentDays;
        
        return {
            daysToNext,
            nextTier,
            message: `${daysToNext} day${daysToNext !== 1 ? 's' : ''} until ${nextTier.label}`
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════
export default DiamondMintEngine;
