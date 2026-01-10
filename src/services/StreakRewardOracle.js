/**
 * 🔴 STREAK REWARD ORACLE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ORDER 15: STREAK_REWARD_ORACLE_SYNC
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Connects to RED Silo (Identity DNA Engine).
 * Auto-applies 1.2x - 2.0x multipliers to all training rewards
 * based on 'streak_count' found in DNA.
 * 
 * @target Orb #4 (Training) | Orb #5 (Brain) | Orb #7 (Arcade)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { RewardCalculator, STREAK_MULTIPLIERS } from '../engines/RewardCalculator.js';

// ═══════════════════════════════════════════════════════════
// 🔴 ORACLE CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ORACLE_CONFIG = {
    // Primary data source (RED Engine)
    PRIMARY_SOURCE: 'profiles',
    PRIMARY_FIELD: 'current_streak',

    // Fallback data source (Yellow Engine)
    FALLBACK_SOURCE: 'wallets',
    FALLBACK_FIELD: 'current_streak',

    // Cache settings
    CACHE_TTL_MS: 5 * 60 * 1000,  // 5 minutes

    // Multiplier Law (from Phase 15)
    MULTIPLIERS: {
        DAY_3: 1.20,
        DAY_7: 1.50,
        DAY_30: 2.00
    }
};

// ═══════════════════════════════════════════════════════════
// 🔮 STREAK REWARD ORACLE CLASS
// ═══════════════════════════════════════════════════════════

export class StreakRewardOracle {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ORACLE_ERROR: Supabase client required for RED sync');
        }
        this.supabase = supabaseClient;
        this.calculator = new RewardCalculator(supabaseClient);
        this._streakCache = new Map();
    }

    // ═══════════════════════════════════════════════════════
    // 🔄 SYNC STREAK FROM RED (Identity DNA)
    // ═══════════════════════════════════════════════════════

    /**
     * Fetch streak count from RED Engine (profiles table)
     * Falls back to Yellow Engine (wallets table) if RED unavailable
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Streak data with source info
     */
    async syncStreakFromRed(userId) {
        // Check cache first
        const cached = this._getFromCache(userId);
        if (cached) {
            return cached;
        }

        let streakData = null;

        // ═══════════════════════════════════════════════════
        // TRY PRIMARY: RED Engine (profiles.current_streak)
        // ═══════════════════════════════════════════════════

        try {
            const { data: profileData, error: profileError } = await this.supabase
                .from(ORACLE_CONFIG.PRIMARY_SOURCE)
                .select(`${ORACLE_CONFIG.PRIMARY_FIELD}, skill_tier, last_activity`)
                .eq('id', userId)
                .single();

            if (!profileError && profileData?.[ORACLE_CONFIG.PRIMARY_FIELD] !== undefined) {
                streakData = {
                    streakDays: profileData[ORACLE_CONFIG.PRIMARY_FIELD],
                    source: 'RED_ENGINE',
                    table: ORACLE_CONFIG.PRIMARY_SOURCE,
                    skillTier: profileData.skill_tier,
                    lastActivity: profileData.last_activity,
                    syncedAt: new Date().toISOString()
                };
            }
        } catch (err) {
            console.warn('ORACLE: RED Engine query failed, trying fallback');
        }

        // ═══════════════════════════════════════════════════
        // FALLBACK: Yellow Engine (wallets.current_streak)
        // ═══════════════════════════════════════════════════

        if (!streakData) {
            try {
                const { data: walletData, error: walletError } = await this.supabase
                    .from(ORACLE_CONFIG.FALLBACK_SOURCE)
                    .select(`${ORACLE_CONFIG.FALLBACK_FIELD}, longest_streak`)
                    .eq('user_id', userId)
                    .single();

                if (!walletError && walletData) {
                    streakData = {
                        streakDays: walletData[ORACLE_CONFIG.FALLBACK_FIELD] || 0,
                        source: 'YELLOW_ENGINE',
                        table: ORACLE_CONFIG.FALLBACK_SOURCE,
                        longestStreak: walletData.longest_streak,
                        syncedAt: new Date().toISOString()
                    };
                }
            } catch (err) {
                console.warn('ORACLE: Fallback query also failed');
            }
        }

        // Default to zero streak if no data found
        if (!streakData) {
            streakData = {
                streakDays: 0,
                source: 'DEFAULT',
                table: null,
                syncedAt: new Date().toISOString()
            };
        }

        // Add multiplier info
        const tier = RewardCalculator.getMultiplierTier(streakData.streakDays);
        streakData.multiplier = tier.multiplier;
        streakData.tier = tier.tier;
        streakData.tierLabel = tier.label;

        // Cache the result
        this._addToCache(userId, streakData);

        return streakData;
    }

    // ═══════════════════════════════════════════════════════
    // 💎 CALCULATE TRAINING REWARD WITH AUTO-MULTIPLIER
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate training reward with automatic streak multiplier from RED
     * 
     * @param {string} userId - User UUID
     * @param {object} drillResult - Drill performance data
     * @returns {Promise<object>} Reward with oracle sync info
     */
    async calculateRewardWithOracle(userId, drillResult) {
        // Sync streak from RED (or fallback)
        const streakData = await this.syncStreakFromRed(userId);

        // Calculate reward with RewardCalculator
        const reward = RewardCalculator.calculateDrillReward(drillResult, streakData.streakDays);

        return {
            ...reward,
            oracle: {
                syncedFrom: streakData.source,
                table: streakData.table,
                streakDays: streakData.streakDays,
                multiplier: streakData.multiplier,
                tier: streakData.tier,
                syncedAt: streakData.syncedAt
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎰 ARCADE REWARD WITH ORACLE
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate arcade payout with streak multiplier
     * 
     * @param {string} userId - User UUID
     * @param {number} basePayout - Base payout amount
     * @returns {Promise<object>} Payout with multiplier applied
     */
    async calculateArcadeReward(userId, basePayout) {
        const streakData = await this.syncStreakFromRed(userId);
        const finalPayout = Math.floor(basePayout * streakData.multiplier);
        const streakBonus = finalPayout - basePayout;

        return {
            success: true,
            basePayout,
            multiplier: streakData.multiplier,
            streakBonus,
            finalPayout,
            tier: streakData.tier,
            tierLabel: streakData.tierLabel,
            formula: `${basePayout} × ${streakData.multiplier.toFixed(2)} = ${finalPayout} 💎`,
            oracle: {
                syncedFrom: streakData.source,
                streakDays: streakData.streakDays,
                syncedAt: streakData.syncedAt
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 GET MULTIPLIER PREVIEW (NO DB CALL)
    // ═══════════════════════════════════════════════════════

    /**
     * Get multiplier info without database call
     * 
     * @param {number} streakDays - Known streak days
     * @returns {object} Multiplier tier info
     */
    static getMultiplierPreview(streakDays) {
        return RewardCalculator.getMultiplierTier(streakDays);
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
            multiplier: tier.multiplier,
            label: tier.label,
            icon: tier.icon
        }));
    }

    // ═══════════════════════════════════════════════════════
    // 🗄️ CACHE MANAGEMENT
    // ═══════════════════════════════════════════════════════

    _getFromCache(userId) {
        const cached = this._streakCache.get(userId);
        if (cached && Date.now() - cached.timestamp < ORACLE_CONFIG.CACHE_TTL_MS) {
            return { ...cached.data, fromCache: true };
        }
        return null;
    }

    _addToCache(userId, data) {
        this._streakCache.set(userId, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache(userId = null) {
        if (userId) {
            this._streakCache.delete(userId);
        } else {
            this._streakCache.clear();
        }
    }

    // ═══════════════════════════════════════════════════════
    // 🔍 DIAGNOSTIC METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Check Oracle health and connectivity
     * 
     * @returns {Promise<object>} Health status
     */
    async checkHealth() {
        const health = {
            status: 'HEALTHY',
            redEngine: { available: false, table: ORACLE_CONFIG.PRIMARY_SOURCE },
            yellowEngine: { available: false, table: ORACLE_CONFIG.FALLBACK_SOURCE },
            multipliers: ORACLE_CONFIG.MULTIPLIERS,
            cacheTtlMs: ORACLE_CONFIG.CACHE_TTL_MS,
            cacheSize: this._streakCache.size,
            checkedAt: new Date().toISOString()
        };

        // Check RED Engine (profiles)
        try {
            const { error } = await this.supabase
                .from(ORACLE_CONFIG.PRIMARY_SOURCE)
                .select('id')
                .limit(1);
            health.redEngine.available = !error;
        } catch {
            health.redEngine.available = false;
        }

        // Check Yellow Engine (wallets)
        try {
            const { error } = await this.supabase
                .from(ORACLE_CONFIG.FALLBACK_SOURCE)
                .select('id')
                .limit(1);
            health.yellowEngine.available = !error;
        } catch {
            health.yellowEngine.available = false;
        }

        // Set overall status
        if (!health.redEngine.available && !health.yellowEngine.available) {
            health.status = 'UNHEALTHY';
        } else if (!health.redEngine.available) {
            health.status = 'DEGRADED';
        }

        return health;
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default StreakRewardOracle;
