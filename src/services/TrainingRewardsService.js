/**
 * 🎓 TRAINING REWARDS SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Streak rewards with 85% accuracy threshold.
 * Day 3 (1.2x), Day 7 (2.0x), Day 30 (5.0x)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const TRAINING_CONFIG = {
    MIN_ACCURACY: 0.85,  // 85% threshold
    BASE_REWARD: 10,
    STREAK_TIERS: {
        0: { multiplier: 1.00, label: 'No Streak', icon: '❄️' },
        1: { multiplier: 1.10, label: 'Warming Up', icon: '🌡️' },
        3: { multiplier: 1.20, label: 'Streak Tier 1', icon: '🔥' },
        7: { multiplier: 2.00, label: 'Streak Tier 2', icon: '🔥🔥' },
        14: { multiplier: 2.50, label: 'Streak Blazing', icon: '🔥🔥🔥' },
        30: { multiplier: 5.00, label: 'Monthly Master', icon: '👑' },
        60: { multiplier: 6.00, label: 'Diamond Elite', icon: '💎' },
        100: { multiplier: 7.50, label: 'Century Club', icon: '🏆' }
    }
};

// ═══════════════════════════════════════════════════════════
// 🎓 TRAINING REWARDS SERVICE CLASS
// ═══════════════════════════════════════════════════════════

export class TrainingRewardsService {

    constructor(supabase) {
        if (!supabase) {
            throw new Error('TRAINING_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 🎓 MINT TRAINING REWARD
    // ═══════════════════════════════════════════════════════

    /**
     * Mint training reward on 85% pass with streak multiplier
     * 
     * @param {string} userId - User UUID
     * @param {number} accuracy - Accuracy as decimal (0.0 to 1.0)
     * @param {object} options - Session options
     * @returns {Promise<object>} Reward result
     */
    async mintTrainingReward(userId, accuracy, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_mint_training_reward', {
            p_user_id: userId,
            p_accuracy: accuracy,
            p_base_reward: options.baseReward || TRAINING_CONFIG.BASE_REWARD,
            p_session_id: options.sessionId || null,
            p_training_type: options.trainingType || 'STANDARD',
            p_metadata: options.metadata || {}
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'TRAINING_REWARD_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message,
                accuracy: result.accuracy,
                threshold: result.threshold,
                diamondsEarned: 0
            };
        }

        return {
            success: true,
            status: result.status,
            reward: {
                baseReward: result.reward.base_reward,
                accuracyBonus: result.reward.accuracy_bonus,
                streakBonus: result.reward.streak_bonus,
                totalReward: result.reward.total_reward,
                multiplier: result.reward.multiplier
            },
            training: {
                accuracy: result.training.accuracy,
                passedThreshold: result.training.passed_threshold,
                sessionId: result.training.session_id,
                type: result.training.type
            },
            streak: {
                currentDays: result.streak.current_days,
                tier: result.streak.tier,
                icon: result.streak.icon,
                nextTier: result.streak.next_tier,
                daysToNext: result.streak.days_to_next
            },
            wallet: {
                newBalance: result.wallet.new_balance
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 GET STREAK MULTIPLIER
    // ═══════════════════════════════════════════════════════

    /**
     * Get streak reward multiplier info
     * 
     * @param {number} streakDays - Current streak days
     * @returns {Promise<object>} Multiplier info
     */
    async getStreakMultiplier(streakDays) {
        const { data, error } = await this.supabase.rpc('fn_get_streak_reward_multiplier', {
            p_streak_days: streakDays
        });

        if (error) {
            // Fallback to local calculation
            return this.getStreakMultiplierLocal(streakDays);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            multiplier: parseFloat(result.multiplier),
            label: result.label,
            description: result.description,
            icon: result.icon,
            currentTier: result.current_tier,
            streakDays: result.streak_days,
            nextTier: result.next_tier,
            nextMultiplier: result.next_multiplier,
            nextLabel: result.next_label,
            daysToNext: result.days_to_next
        };
    }

    /**
     * Get streak multiplier locally (no DB call)
     * 
     * @param {number} streakDays - Current streak days
     * @returns {object} Multiplier info
     */
    getStreakMultiplierLocal(streakDays) {
        const tiers = Object.entries(TRAINING_CONFIG.STREAK_TIERS)
            .map(([days, info]) => ({ days: parseInt(days), ...info }))
            .sort((a, b) => b.days - a.days);

        // Find current tier
        const currentTier = tiers.find(t => streakDays >= t.days) || tiers[tiers.length - 1];

        // Find next tier
        const sortedAsc = [...tiers].sort((a, b) => a.days - b.days);
        const nextTier = sortedAsc.find(t => t.days > streakDays);

        return {
            multiplier: currentTier.multiplier,
            label: currentTier.label,
            icon: currentTier.icon,
            currentTier: currentTier.days,
            streakDays,
            nextTier: nextTier?.days || null,
            nextMultiplier: nextTier?.multiplier || null,
            nextLabel: nextTier?.label || null,
            daysToNext: nextTier ? nextTier.days - streakDays : 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🧮 PREVIEW REWARD
    // ═══════════════════════════════════════════════════════

    /**
     * Preview training reward without minting
     * 
     * @param {number} accuracy - Accuracy as decimal
     * @param {number} streakDays - Current streak days
     * @param {number} baseReward - Base reward amount
     * @returns {object} Reward preview
     */
    previewReward(accuracy, streakDays, baseReward = TRAINING_CONFIG.BASE_REWARD) {
        const passesThreshold = accuracy >= TRAINING_CONFIG.MIN_ACCURACY;

        if (!passesThreshold) {
            return {
                eligible: false,
                accuracy: (accuracy * 100).toFixed(1) + '%',
                threshold: (TRAINING_CONFIG.MIN_ACCURACY * 100) + '%',
                message: `Need ${(TRAINING_CONFIG.MIN_ACCURACY * 100)}% accuracy to earn diamonds`,
                totalReward: 0
            };
        }

        const streakInfo = this.getStreakMultiplierLocal(streakDays);

        // Accuracy bonus: 10% for each 1% above 85%
        const accuracyBonus = Math.floor(baseReward * (accuracy - TRAINING_CONFIG.MIN_ACCURACY) * 10);

        // Apply multiplier
        const totalBeforeMultiplier = baseReward + accuracyBonus;
        const totalReward = Math.floor(totalBeforeMultiplier * streakInfo.multiplier);
        const streakBonus = totalReward - totalBeforeMultiplier;

        return {
            eligible: true,
            accuracy: (accuracy * 100).toFixed(1) + '%',
            baseReward,
            accuracyBonus,
            streakBonus,
            totalReward,
            multiplier: streakInfo.multiplier,
            tier: streakInfo.label,
            tierIcon: streakInfo.icon,
            formula: `(${baseReward} + ${accuracyBonus}) × ${streakInfo.multiplier.toFixed(2)} = ${totalReward}`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 GET STREAK REWARDS TABLE
    // ═══════════════════════════════════════════════════════

    /**
     * Get full streak rewards table from database
     * 
     * @returns {Promise<object[]>} All streak reward tiers
     */
    async getStreakRewardsTable() {
        const { data, error } = await this.supabase
            .from('streak_rewards')
            .select('*')
            .order('day_threshold', { ascending: true });

        if (error) {
            // Return local config as fallback
            return Object.entries(TRAINING_CONFIG.STREAK_TIERS).map(([days, info]) => ({
                day_threshold: parseInt(days),
                ...info
            }));
        }

        return data || [];
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default TrainingRewardsService;
