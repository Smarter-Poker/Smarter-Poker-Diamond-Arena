/**
 * 🧮 REWARD CALCULATOR ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MAPPING PHASE 15: STREAK_MULTIPLIER_DYNAMIC_HOOK
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Fetches streak count from RED (Identity DNA Engine).
 * Applies dynamic multipliers to ALL Diamonds earned in training drills:
 * - 3-Day Streak:  1.2x Multiplier
 * - 7-Day Streak:  1.5x Multiplier  
 * - 30-Day Streak: 2.0x Multiplier
 * 
 * @target Orb #4 (Training) | Orb #5 (Brain) | Orb #7 (Arcade)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK MULTIPLIER TIERS (HARD LAW)
// ═══════════════════════════════════════════════════════════

export const STREAK_MULTIPLIERS = {
    // Tier definitions per Hard Law specification
    TIERS: [
        { minDays: 0,   maxDays: 2,   multiplier: 1.00, tier: 'COLD',      label: '❄️ No Streak',     icon: '❄️' },
        { minDays: 3,   maxDays: 6,   multiplier: 1.20, tier: 'WARMING',   label: '🔥 3-Day Streak',  icon: '🔥' },
        { minDays: 7,   maxDays: 13,  multiplier: 1.50, tier: 'HOT',       label: '🔥🔥 7-Day Streak', icon: '🔥🔥' },
        { minDays: 14,  maxDays: 29,  multiplier: 1.75, tier: 'BLAZING',   label: '🔥🔥🔥 Blazing',    icon: '🔥🔥🔥' },
        { minDays: 30,  maxDays: Infinity, multiplier: 2.00, tier: 'LEGENDARY', label: '👑 30-Day Legend', icon: '👑' }
    ],
    
    // Grace period for streak protection (from RED Identity DNA)
    GRACE_PERIOD_HOURS: 48,
    
    // Minimum accuracy to earn diamonds (from GREEN Mastery Gate)
    MIN_ACCURACY: 0.85
};

// ═══════════════════════════════════════════════════════════
// 🧮 REWARD CALCULATOR CLASS
// ═══════════════════════════════════════════════════════════

export class RewardCalculator {
    
    constructor(supabaseClient = null) {
        this.supabase = supabaseClient;
        this._cachedStreak = null;
        this._cacheExpiry = null;
    }

    // ═══════════════════════════════════════════════════════
    // 🔴 RED INTEGRATION: FETCH STREAK FROM IDENTITY DNA
    // ═══════════════════════════════════════════════════════

    /**
     * Fetch current streak from RED (Identity DNA Engine)
     * Falls back to wallet streak if Identity sync unavailable
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<number>} Current streak days
     */
    async fetchStreakFromRed(userId) {
        if (!this.supabase) {
            throw new Error('REWARD_CALC_ERROR: Supabase client required for RED integration');
        }

        // Check cache (5 minute TTL)
        if (this._cachedStreak !== null && this._cacheExpiry > Date.now()) {
            return this._cachedStreak;
        }

        try {
            // PRIMARY: Try to fetch from Identity DNA profiles table
            const { data: profileData, error: profileError } = await this.supabase
                .from('profiles')
                .select('current_streak, last_activity, skill_tier')
                .eq('id', userId)
                .single();

            if (!profileError && profileData?.current_streak !== undefined) {
                this._cachedStreak = profileData.current_streak;
                this._cacheExpiry = Date.now() + (5 * 60 * 1000); // 5 min cache
                return profileData.current_streak;
            }

            // FALLBACK: Fetch from wallet table (Yellow Engine)
            const { data: walletData, error: walletError } = await this.supabase
                .from('wallets')
                .select('current_streak, longest_streak')
                .eq('user_id', userId)
                .single();

            if (!walletError && walletData) {
                this._cachedStreak = walletData.current_streak || 0;
                this._cacheExpiry = Date.now() + (5 * 60 * 1000);
                return walletData.current_streak || 0;
            }

            // No streak data found
            return 0;

        } catch (error) {
            console.error('REWARD_CALC_WARNING: Failed to fetch streak from RED:', error.message);
            return 0;
        }
    }

    // ═══════════════════════════════════════════════════════
    // 🧮 MULTIPLIER RESOLUTION
    // ═══════════════════════════════════════════════════════

    /**
     * Get streak multiplier tier for given days
     * 
     * @param {number} streakDays - Current streak days
     * @returns {object} Tier configuration with multiplier
     */
    static getMultiplierTier(streakDays) {
        const days = Math.max(0, Math.floor(streakDays));
        
        for (const tier of STREAK_MULTIPLIERS.TIERS) {
            if (days >= tier.minDays && days <= tier.maxDays) {
                return {
                    ...tier,
                    streakDays: days,
                    nextTier: STREAK_MULTIPLIERS.TIERS.find(t => t.minDays > days) || null
                };
            }
        }
        
        // Fallback to COLD tier
        return { ...STREAK_MULTIPLIERS.TIERS[0], streakDays: days, nextTier: STREAK_MULTIPLIERS.TIERS[1] };
    }

    /**
     * Get multiplier value only (convenience method)
     * 
     * @param {number} streakDays - Current streak days
     * @returns {number} Multiplier value (1.0 - 2.0)
     */
    static getMultiplier(streakDays) {
        return RewardCalculator.getMultiplierTier(streakDays).multiplier;
    }

    // ═══════════════════════════════════════════════════════
    // 💎 TRAINING DRILL REWARD CALCULATION
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate diamond reward for a training drill
     * HARD LAW: Applies streak multiplier to ALL diamonds earned
     * 
     * @param {object} drillResult - Drill performance data
     * @param {number} drillResult.accuracy - Score between 0.0 and 1.0
     * @param {number} drillResult.questionsAnswered - Total questions in drill
     * @param {number} drillResult.baseReward - Base diamond reward (default: 10)
     * @param {number} streakDays - Current streak from RED
     * @returns {object} Complete reward breakdown
     */
    static calculateDrillReward(drillResult, streakDays = 0) {
        const {
            accuracy = 0,
            questionsAnswered = 20,
            baseReward = 10
        } = drillResult;

        // ═══════════════════════════════════════════════════
        // 🟢 GREEN LAW CHECK: 85% MASTERY GATE
        // ═══════════════════════════════════════════════════
        
        const passedMasteryGate = accuracy >= STREAK_MULTIPLIERS.MIN_ACCURACY;
        
        if (!passedMasteryGate) {
            return {
                success: false,
                eligible: false,
                reason: 'MASTERY_GATE_FAILED',
                accuracy: (accuracy * 100).toFixed(1) + '%',
                threshold: (STREAK_MULTIPLIERS.MIN_ACCURACY * 100) + '%',
                message: `Requires ${STREAK_MULTIPLIERS.MIN_ACCURACY * 100}% accuracy to earn diamonds`,
                diamondsEarned: 0,
                hardLaw: '85_PERCENT_MASTERY_GATE'
            };
        }

        // ═══════════════════════════════════════════════════
        // 🔥 STREAK MULTIPLIER APPLICATION
        // ═══════════════════════════════════════════════════
        
        const tier = RewardCalculator.getMultiplierTier(streakDays);
        const multiplier = tier.multiplier;

        // Accuracy bonus: 10% extra per 1% above 85%
        const accuracyBonus = Math.floor(baseReward * (accuracy - STREAK_MULTIPLIERS.MIN_ACCURACY) * 10);
        
        // Pre-multiplier total
        const subtotal = baseReward + accuracyBonus;
        
        // Apply streak multiplier (HARD LAW: applies to ALL diamonds)
        const totalBeforeFloor = subtotal * multiplier;
        const finalDiamonds = Math.floor(totalBeforeFloor);
        const streakBonus = finalDiamonds - subtotal;

        return {
            success: true,
            eligible: true,
            reason: 'REWARD_CALCULATED',
            
            // Reward breakdown
            reward: {
                base: baseReward,
                accuracyBonus,
                subtotal,
                multiplier,
                streakBonus,
                total: finalDiamonds
            },
            
            // Performance metrics
            performance: {
                accuracy: (accuracy * 100).toFixed(1) + '%',
                questionsAnswered,
                passedMasteryGate: true
            },
            
            // Streak info from RED
            streak: {
                days: streakDays,
                tier: tier.tier,
                label: tier.label,
                icon: tier.icon,
                multiplier,
                nextTier: tier.nextTier ? {
                    tier: tier.nextTier.tier,
                    daysRequired: tier.nextTier.minDays,
                    daysRemaining: tier.nextTier.minDays - streakDays,
                    multiplier: tier.nextTier.multiplier
                } : null
            },
            
            // Formula for transparency
            formula: `(${baseReward} + ${accuracyBonus}) × ${multiplier.toFixed(2)} = ${finalDiamonds} 💎`,
            
            // Hard Law compliance
            hardLaw: 'STREAK_MULTIPLIER_DYNAMIC_HOOK',
            diamondsEarned: finalDiamonds
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🚀 ASYNC CALCULATION WITH RED FETCH
    // ═══════════════════════════════════════════════════════

    /**
     * Full async calculation that fetches streak from RED first
     * 
     * @param {string} userId - User UUID
     * @param {object} drillResult - Drill performance data
     * @returns {Promise<object>} Complete reward with streak from RED
     */
    async calculateWithRedSync(userId, drillResult) {
        // Fetch current streak from RED (Identity DNA)
        const streakDays = await this.fetchStreakFromRed(userId);
        
        // Calculate reward with dynamically fetched streak
        const reward = RewardCalculator.calculateDrillReward(drillResult, streakDays);
        
        return {
            ...reward,
            redSync: {
                streakSource: 'IDENTITY_DNA_ENGINE',
                userId,
                fetchedAt: new Date().toISOString()
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 UTILITY METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Preview reward for UI display (no database call)
     * 
     * @param {number} accuracy - Expected accuracy
     * @param {number} streakDays - Current streak days
     * @param {number} baseReward - Base reward amount
     * @returns {object} Preview breakdown
     */
    static previewReward(accuracy, streakDays, baseReward = 10) {
        return RewardCalculator.calculateDrillReward({
            accuracy,
            questionsAnswered: 20,
            baseReward
        }, streakDays);
    }

    /**
     * Get all multiplier tiers for UI display
     * 
     * @returns {array} All tier configurations
     */
    static getAllTiers() {
        return STREAK_MULTIPLIERS.TIERS.map(tier => ({
            tier: tier.tier,
            minDays: tier.minDays,
            maxDays: tier.maxDays === Infinity ? '30+' : tier.maxDays,
            multiplier: tier.multiplier,
            label: tier.label,
            icon: tier.icon
        }));
    }

    /**
     * Calculate days until next multiplier tier
     * 
     * @param {number} currentDays - Current streak days
     * @returns {object} Progress to next tier
     */
    static getProgressToNextTier(currentDays) {
        const current = RewardCalculator.getMultiplierTier(currentDays);
        
        if (!current.nextTier) {
            return {
                atMaxTier: true,
                currentTier: current.tier,
                currentMultiplier: current.multiplier,
                message: '👑 Maximum tier achieved!'
            };
        }

        const daysToNext = current.nextTier.minDays - currentDays;
        const progressPercent = current.maxDays === Infinity 
            ? 100 
            : ((currentDays - current.minDays) / (current.maxDays - current.minDays + 1)) * 100;

        return {
            atMaxTier: false,
            currentTier: current.tier,
            currentMultiplier: current.multiplier,
            nextTier: current.nextTier.tier,
            nextMultiplier: current.nextTier.multiplier,
            daysToNext,
            progressPercent: Math.min(100, Math.floor(progressPercent)),
            message: `${daysToNext} day${daysToNext !== 1 ? 's' : ''} until ${current.nextTier.label}`
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default RewardCalculator;

// ═══════════════════════════════════════════════════════════
// ✅ PHASE 15 SEAL: STREAK_MULTIPLIER_DYNAMIC_HOOK_COMPLETE
// ═══════════════════════════════════════════════════════════
