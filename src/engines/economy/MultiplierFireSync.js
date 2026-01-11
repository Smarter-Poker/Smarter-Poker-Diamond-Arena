/**
 * 🔥 MULTIPLIER FIRE SYNC
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORB_07] Pulls streak data from RED silo to apply
 * 1.5x - 2.0x rewards to all Diamond wins.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 * - RED silo streak integration
 * - Dynamic multiplier calculation
 * - Real-time fire visual sync
 * - Reward amplification
 * 
 * @target Cross-Silo Integration (RED → YELLOW)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ MULTIPLIER CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const FIRE_MULTIPLIER_CONFIG = {
    // Tier thresholds and multipliers
    TIERS: [
        { name: 'COLD', days: 0, multiplier: 1.00, emoji: '❄️', color: '#87CEEB' },
        { name: 'WARMING', days: 3, multiplier: 1.20, emoji: '🔥', color: '#FFB347' },
        { name: 'HOT', days: 7, multiplier: 1.50, emoji: '🔥🔥', color: '#FF6B35' },
        { name: 'BLAZING', days: 14, multiplier: 1.75, emoji: '🔥🔥🔥', color: '#FF4500' },
        { name: 'LEGENDARY', days: 30, multiplier: 2.00, emoji: '👑🔥', color: '#9B59B6' }
    ],

    // Visual sync config
    VISUALS: {
        PARTICLE_INTENSITY: {
            COLD: 0,
            WARMING: 10,
            HOT: 25,
            BLAZING: 50,
            LEGENDARY: 100
        },
        ANIMATION_SPEED: {
            COLD: 0,
            WARMING: 1,
            HOT: 1.5,
            BLAZING: 2,
            LEGENDARY: 3
        }
    },

    // Sync interval
    SYNC_INTERVAL_MS: 60000  // Refresh every 60 seconds
};

// ═══════════════════════════════════════════════════════════
// 🔥 MULTIPLIER FIRE SYNC CLASS
// ═══════════════════════════════════════════════════════════

export class MultiplierFireSync {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('FIRE_SYNC_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
        this.cache = new Map();
        this.syncInterval = null;
    }

    // ═══════════════════════════════════════════════════════
    // 🔴 RED SILO INTEGRATION
    // ═══════════════════════════════════════════════════════

    /**
     * Fetch streak data from RED silo
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Streak data
     */
    async fetchStreakFromRed(userId) {
        // Try RED silo (profiles)
        let source = 'RED_SILO_PROFILES';
        let streakDays = 0;

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('current_streak, streak_updated_at')
                .eq('id', userId)
                .single();

            if (!error && data) {
                streakDays = data.current_streak || 0;
            }
        } catch (e) {
            // Fallback to YELLOW silo
            source = 'YELLOW_SILO_WALLETS';
            const { data } = await this.supabase
                .from('wallets')
                .select('current_streak')
                .eq('user_id', userId)
                .single();

            if (data) {
                streakDays = data.current_streak || 0;
            }
        }

        // Calculate tier
        const tier = this.calculateTier(streakDays);

        // Cache result
        this.cache.set(userId, {
            streakDays,
            tier,
            fetchedAt: Date.now(),
            source
        });

        return {
            success: true,
            userId,
            streakDays,
            source,
            ...tier
        };
    }

    /**
     * Calculate multiplier tier from streak days
     * 
     * @param {number} streakDays - Streak days
     * @returns {object} Tier info
     */
    calculateTier(streakDays) {
        const tiers = FIRE_MULTIPLIER_CONFIG.TIERS;
        let current = tiers[0];

        for (const tier of tiers) {
            if (streakDays >= tier.days) {
                current = tier;
            }
        }

        return {
            tierName: current.name,
            multiplier: current.multiplier,
            emoji: current.emoji,
            color: current.color,
            nextTier: this.getNextTier(streakDays),
            visuals: {
                particleIntensity: FIRE_MULTIPLIER_CONFIG.VISUALS.PARTICLE_INTENSITY[current.name],
                animationSpeed: FIRE_MULTIPLIER_CONFIG.VISUALS.ANIMATION_SPEED[current.name]
            }
        };
    }

    /**
     * Get next tier info
     * 
     * @param {number} streakDays - Current streak
     * @returns {object|null} Next tier info
     */
    getNextTier(streakDays) {
        const tiers = FIRE_MULTIPLIER_CONFIG.TIERS;

        for (const tier of tiers) {
            if (tier.days > streakDays) {
                return {
                    name: tier.name,
                    daysNeeded: tier.days - streakDays,
                    multiplier: tier.multiplier,
                    emoji: tier.emoji
                };
            }
        }

        return null;  // Already at max tier
    }

    // ═══════════════════════════════════════════════════════
    // 💎 REWARD AMPLIFICATION
    // ═══════════════════════════════════════════════════════

    /**
     * Apply fire multiplier to reward
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base reward amount
     * @returns {Promise<object>} Amplified reward
     */
    async applyMultiplier(userId, baseReward) {
        // Get cached or fresh streak data
        let streakData = this.cache.get(userId);

        if (!streakData || Date.now() - streakData.fetchedAt > FIRE_MULTIPLIER_CONFIG.SYNC_INTERVAL_MS) {
            const fresh = await this.fetchStreakFromRed(userId);
            streakData = this.cache.get(userId);
        }

        const multiplier = streakData?.tier?.multiplier || 1.0;
        const finalReward = Math.floor(baseReward * multiplier);
        const bonus = finalReward - baseReward;

        return {
            success: true,
            base: baseReward,
            multiplier,
            bonus,
            final: finalReward,
            tier: streakData?.tier?.tierName || 'COLD',
            emoji: streakData?.tier?.emoji || '❄️',
            formula: `${baseReward} × ${multiplier} = ${finalReward} 💎`
        };
    }

    /**
     * Apply multiplier locally (no database)
     * 
     * @param {number} baseReward - Base reward
     * @param {number} streakDays - Streak days
     * @returns {object} Amplified reward
     */
    static applyMultiplierLocal(baseReward, streakDays) {
        const tiers = FIRE_MULTIPLIER_CONFIG.TIERS;
        let multiplier = 1.0;
        let tier = tiers[0];

        for (const t of tiers) {
            if (streakDays >= t.days) {
                multiplier = t.multiplier;
                tier = t;
            }
        }

        const finalReward = Math.floor(baseReward * multiplier);

        return {
            base: baseReward,
            multiplier,
            final: finalReward,
            bonus: finalReward - baseReward,
            tier: tier.name,
            emoji: tier.emoji,
            color: tier.color,
            formula: `${baseReward} × ${multiplier} = ${finalReward} 💎`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎨 VISUAL SYNC
    // ═══════════════════════════════════════════════════════

    /**
     * Get visual configuration for tier
     * 
     * @param {string} tierName - Tier name
     * @returns {object} Visual config
     */
    static getVisualConfig(tierName) {
        const tier = FIRE_MULTIPLIER_CONFIG.TIERS.find(t => t.name === tierName)
            || FIRE_MULTIPLIER_CONFIG.TIERS[0];

        return {
            tier: tier.name,
            color: tier.color,
            emoji: tier.emoji,
            particles: {
                enabled: tier.name !== 'COLD',
                intensity: FIRE_MULTIPLIER_CONFIG.VISUALS.PARTICLE_INTENSITY[tier.name],
                type: tier.name === 'LEGENDARY' ? 'GOLDEN_FLAME' : 'FIRE'
            },
            animation: {
                speed: FIRE_MULTIPLIER_CONFIG.VISUALS.ANIMATION_SPEED[tier.name],
                glow: tier.name !== 'COLD',
                pulse: tier.name === 'LEGENDARY' || tier.name === 'BLAZING'
            },
            sound: {
                enabled: tier.name !== 'COLD',
                intensity: tier.name === 'LEGENDARY' ? 'EPIC' :
                    tier.name === 'BLAZING' ? 'HIGH' : 'MEDIUM'
            }
        };
    }

    /**
     * Get all tier visuals (for UI rendering)
     * 
     * @returns {Array} All tier configurations
     */
    static getAllTierVisuals() {
        return FIRE_MULTIPLIER_CONFIG.TIERS.map(tier => ({
            ...tier,
            visuals: MultiplierFireSync.getVisualConfig(tier.name)
        }));
    }

    // ═══════════════════════════════════════════════════════
    // ⏰ SYNC MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Start periodic sync for user
     * 
     * @param {string} userId - User UUID
     * @param {Function} callback - Called on each sync
     */
    startSync(userId, callback) {
        // Initial fetch
        this.fetchStreakFromRed(userId).then(callback);

        // Periodic sync
        this.syncInterval = setInterval(async () => {
            const data = await this.fetchStreakFromRed(userId);
            if (callback) callback(data);
        }, FIRE_MULTIPLIER_CONFIG.SYNC_INTERVAL_MS);
    }

    /**
     * Stop periodic sync
     */
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default MultiplierFireSync;
