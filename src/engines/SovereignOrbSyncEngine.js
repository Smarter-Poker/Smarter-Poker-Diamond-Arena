/**
 * 🛰️ SOVEREIGN ORB SYNC ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SOVEREIGN_ORB_SYNC: ORB_03_DIAMOND_ARENA & ORB_07_ARCADE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 41: DIAMOND_TREASURY_SYNC
 * Task 42: 25_PERCENT_BURN_ENFORCER
 * Task 43: STREAK_MULTIPLIER_SYNC
 * 
 * @target Cross-Orb Integration Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ORB SYNC CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ORB_SYNC_CONFIG = {
    // Orb definitions
    ORBS: {
        DIAMOND_ARENA: { id: 3, name: 'DIAMOND_ARENA' },
        ARCADE_ROYALE: { id: 7, name: 'ARCADE_ROYALE' }
    },

    // Task 41: Treasury Sync
    TREASURY: {
        SYNC_ON_CREATE: false,  // Auto-sync to wallet on activity creation
        BATCH_SYNC_INTERVAL_MS: 60000
    },

    // Task 42: Arcade Burn (IMMUTABLE)
    ARCADE_BURN: {
        RATE: 0.25,  // 25% HARD LAW
        ENFORCED: true
    },

    // Task 43: Arena Multipliers
    ARENA_MULTIPLIERS: {
        LEGENDARY: { days: 30, value: 2.00, emoji: '👑🔥' },
        BLAZING: { days: 14, value: 1.75, emoji: '🔥🔥🔥' },
        HOT: { days: 7, value: 1.50, emoji: '🔥🔥' },
        WARMING: { days: 3, value: 1.20, emoji: '🔥' },
        COLD: { days: 0, value: 1.00, emoji: '❄️' }
    }
};

// ═══════════════════════════════════════════════════════════
// 🛰️ SOVEREIGN ORB SYNC ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class SovereignOrbSyncEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ORB_SYNC_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 💎 TASK 41: DIAMOND TREASURY SYNC
    // ═══════════════════════════════════════════════════════

    /**
     * Record diamond activity from any Orb
     * 
     * @param {object} activityData - Activity details
     * @returns {Promise<object>} Activity record
     */
    async recordDiamondActivity(activityData) {
        const { userId, orbId, activityType, diamondsDelta, baseAmount, multiplier, activityRef } = activityData;

        const { data, error } = await this.supabase.rpc('fn_record_diamond_activity', {
            p_user_id: userId,
            p_orb_id: orbId,
            p_activity_type: activityType,
            p_diamonds_delta: diamondsDelta,
            p_base_amount: baseAmount || diamondsDelta,
            p_multiplier: multiplier || 1.00,
            p_activity_ref: activityRef
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Sync activity to wallet
     * 
     * @param {string} activityId - Activity UUID
     * @returns {Promise<object>} Sync result
     */
    async syncActivityToWallet(activityId) {
        const { data, error } = await this.supabase.rpc('fn_sync_activity_to_wallet', {
            p_activity_id: activityId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Sync all pending activities
     * 
     * @returns {Promise<object>} Batch sync result
     */
    async syncAllPendingActivities() {
        // Get all unsynced activities
        const { data: activities, error } = await this.supabase
            .from('activity_ledger')
            .select('id')
            .eq('synced_to_wallet', false)
            .order('activity_at', { ascending: true })
            .limit(100);

        if (error) {
            return { success: false, error: error.message };
        }

        const results = [];
        for (const activity of activities || []) {
            const result = await this.syncActivityToWallet(activity.id);
            results.push(result);
        }

        return {
            success: true,
            synced: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            total: results.length
        };
    }

    /**
     * Get activity ledger for user
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Activity list
     */
    async getActivityLedger(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('activity_ledger')
            .select('*')
            .eq('user_id', userId)
            .order('activity_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            activities: data || [],
            count: data?.length || 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 42: 25% BURN ENFORCER (Arcade)
    // ═══════════════════════════════════════════════════════

    /**
     * Process Arcade transaction with mandatory 25% burn
     * 
     * @param {object} txData - Transaction data
     * @returns {Promise<object>} Transaction result
     */
    async processArcadeTransactionWithBurn(txData) {
        const { userId, txType, grossAmount, sessionId, gameMode } = txData;

        const { data, error } = await this.supabase.rpc('fn_arcade_transaction_with_burn', {
            p_user_id: userId,
            p_tx_type: txType,
            p_gross_amount: grossAmount,
            p_session_id: sessionId,
            p_game_mode: gameMode
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate arcade burn locally
     * 
     * @param {number} grossAmount - Gross amount
     * @returns {object} Burn calculation
     */
    static calculateArcadeBurn(grossAmount) {
        const burnRate = ORB_SYNC_CONFIG.ARCADE_BURN.RATE;
        const burnAmount = Math.floor(grossAmount * burnRate);
        const netAmount = grossAmount - burnAmount;

        return {
            grossAmount,
            burnAmount,
            netAmount,
            burnRate: '25%',
            formula: `${grossAmount} - ${burnAmount} = ${netAmount} 💎`
        };
    }

    /**
     * Get arcade burn ledger
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Burn ledger
     */
    async getArcadeBurnLedger(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('arcade_burn_ledger')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            transactions: data || [],
            totalBurned: (data || []).reduce((sum, tx) => sum + tx.burn_amount, 0)
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 43: STREAK MULTIPLIER SYNC (Arena)
    // ═══════════════════════════════════════════════════════

    /**
     * Process Arena reward with DNA streak multiplier
     * 
     * @param {object} rewardData - Reward data
     * @returns {Promise<object>} Reward result
     */
    async processArenaRewardWithStreak(rewardData) {
        const { userId, baseReward, arenaType, sessionId } = rewardData;

        const { data, error } = await this.supabase.rpc('fn_arena_reward_with_streak', {
            p_user_id: userId,
            p_base_reward: baseReward,
            p_arena_type: arenaType || 'GENERAL',
            p_session_id: sessionId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate arena multiplier locally
     * 
     * @param {number} baseReward - Base reward
     * @param {number} streakDays - Streak days from DNA
     * @returns {object} Multiplied reward
     */
    static calculateArenaMultiplier(baseReward, streakDays) {
        const multipliers = ORB_SYNC_CONFIG.ARENA_MULTIPLIERS;
        let multiplier = 1.00;
        let tier = 'COLD';
        let emoji = '❄️';

        // Find highest matching tier
        const orderedTiers = ['LEGENDARY', 'BLAZING', 'HOT', 'WARMING', 'COLD'];
        for (const tierName of orderedTiers) {
            if (streakDays >= multipliers[tierName].days) {
                multiplier = multipliers[tierName].value;
                tier = tierName;
                emoji = multipliers[tierName].emoji;
                break;
            }
        }

        const finalReward = Math.floor(baseReward * multiplier);
        const streakBonus = finalReward - baseReward;

        return {
            base: baseReward,
            multiplier,
            tier,
            emoji,
            final: finalReward,
            bonus: streakBonus,
            formula: `${baseReward} × ${multiplier} = ${finalReward} 💎`
        };
    }

    /**
     * Get arena multiplier log
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Multiplier log
     */
    async getArenaMultiplierLog(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('arena_multiplier_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            rewards: data || [],
            totalBonus: (data || []).reduce((sum, r) => sum + r.streak_bonus, 0)
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ORB SYNC STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get Orb Sync status
     * 
     * @returns {Promise<object>} Status
     */
    async getOrbSyncStatus() {
        const { data, error } = await this.supabase
            .from('orb_sync_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task41_treasury: {
                    totalActivities: data.total_activities,
                    syncedActivities: data.synced_activities,
                    totalDelta: data.total_diamonds_delta
                },
                task42_arcadeBurn: {
                    transactions: data.arcade_transactions,
                    totalBurned: data.arcade_burn_total,
                    enforcement: data.burn_enforced_count
                },
                task43_arenaMultiplier: {
                    rewards: data.arena_rewards,
                    totalBonus: data.total_streak_bonus,
                    legendaryCount: data.legendary_multipliers
                },
                byOrb: {
                    orb3: data.orb_3_activities,
                    orb7: data.orb_7_activities
                },
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default SovereignOrbSyncEngine;
