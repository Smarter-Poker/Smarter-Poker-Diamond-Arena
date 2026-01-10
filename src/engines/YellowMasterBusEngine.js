/**
 * 🚌 YELLOW MASTER BUS ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_MASTER_BUS (TASKS 10-12)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 10: THE 25_PERCENT_BURN_MIGRATION
 * Task 11: ATOMIC_LEDGER_SECURITY_SHIELD
 * Task 12: STREAK_MULTIPLIER_DYNAMIC_SYNC
 * 
 * @target Cross-Silo Integration Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ MASTER BUS CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const MASTER_BUS_CONFIG = {
    // Task 10: Burn Migration
    BURN: {
        RATE: 0.25,                // 25% HARD LAW
        SELLER_RATE: 0.75,         // 75% to seller
        VAULT_USER: '00000000-0000-0000-0000-000000000000',
        MIN_BURN_THRESHOLD: 4
    },

    // Task 11: Security Shield
    SECURITY: {
        INTEGRITY_CHECK_ENABLED: true,
        VARIANCE_TOLERANCE: 0      // Must be exact (HARD LAW)
    },

    // Task 12: Streak Sync (RED -> YELLOW -> GREEN)
    STREAK_SYNC: {
        PRIMARY_SOURCE: 'profiles',    // RED silo
        FALLBACK_SOURCE: 'wallets',    // YELLOW silo
        MULTIPLIERS: {
            DAY_3: 1.20,               // HARD LAW
            DAY_7: 1.50,               // HARD LAW
            DAY_30: 2.00               // HARD LAW
        },
        GREEN_SIGNALS: ['TRAINING_REWARD', 'SESSION_REWARD', 'DRILL_REWARD', 'TRAINING']
    }
};

// ═══════════════════════════════════════════════════════════
// 🚌 YELLOW MASTER BUS ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowMasterBusEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('MASTER_BUS_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 10: 25% BURN MIGRATION
    // ═══════════════════════════════════════════════════════

    /**
     * Execute marketplace burn (25% to vault)
     * HARD LAW: 25% of sale goes to burn_vault
     * 
     * @param {object} saleData - Sale details
     * @returns {Promise<object>} Burn execution result
     */
    async executeMarketplaceBurn(saleData) {
        const { sellerId, buyerId, saleAmount, itemId, itemType, metadata } = saleData;

        const { data, error } = await this.supabase.rpc('fn_execute_marketplace_burn', {
            p_seller_id: sellerId,
            p_buyer_id: buyerId,
            p_sale_amount: saleAmount,
            p_item_id: itemId || null,
            p_item_type: itemType || 'MARKETPLACE_ITEM',
            p_metadata: metadata || {}
        });

        if (error) {
            return {
                success: false,
                error: 'BURN_EXECUTION_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Calculate burn split locally (preview)
     * 
     * @param {number} saleAmount - Total sale amount
     * @returns {object} Burn calculation
     */
    static calculateBurnSplit(saleAmount) {
        const burnRate = MASTER_BUS_CONFIG.BURN.RATE;
        let burnAmount = Math.floor(saleAmount * burnRate);

        if (burnAmount < 1 && saleAmount >= MASTER_BUS_CONFIG.BURN.MIN_BURN_THRESHOLD) {
            burnAmount = 1;
        }

        const sellerReceives = saleAmount - burnAmount;

        return {
            saleAmount,
            burnAmount,
            sellerReceives,
            burnRate: `${burnRate * 100}%`,
            hardLaw: '25_PERCENT_BURN_MIGRATION'
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 11: ATOMIC LEDGER SECURITY SHIELD
    // ═══════════════════════════════════════════════════════

    /**
     * Verify wallet integrity
     * HARD LAW: current_balance MUST equal sum(ledger_history)
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Integrity verification result
     */
    async verifyWalletIntegrity(userId) {
        const { data, error } = await this.supabase.rpc('rpc_verify_wallet_integrity', {
            p_user_id: userId
        });

        if (error) {
            return {
                success: false,
                error: 'INTEGRITY_CHECK_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Verify all user wallets (batch integrity check)
     * 
     * @param {array} userIds - Array of user UUIDs
     * @returns {Promise<object>} Batch verification result
     */
    async verifyBatchIntegrity(userIds) {
        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const userId of userIds) {
            const result = await this.verifyWalletIntegrity(userId);
            results.push({
                userId,
                verified: result.verified,
                status: result.status
            });

            if (result.verified) {
                validCount++;
            } else {
                invalidCount++;
            }
        }

        return {
            success: true,
            summary: {
                total: userIds.length,
                valid: validCount,
                invalid: invalidCount,
                integrityRate: `${((validCount / userIds.length) * 100).toFixed(1)}%`
            },
            results,
            hardLaw: 'ATOMIC_LEDGER_SECURITY_SHIELD'
        };
    }

    /**
     * Get security shield status
     * 
     * @returns {Promise<object>} Shield status
     */
    async getSecurityShieldStatus() {
        // Check a sample wallet to verify shield is active
        const { data, error } = await this.supabase
            .from('wallets')
            .select('user_id')
            .limit(1)
            .single();

        if (error || !data) {
            return {
                success: true,
                active: true,
                status: 'NO_WALLETS_TO_VERIFY'
            };
        }

        const integrityCheck = await this.verifyWalletIntegrity(data.user_id);
        return {
            success: true,
            active: true,
            sampleCheck: integrityCheck.verified,
            status: integrityCheck.status
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔄 TASK 12: STREAK MULTIPLIER DYNAMIC SYNC
    // ═══════════════════════════════════════════════════════

    /**
     * Sync streak from RED silo and get multiplier
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base diamond reward
     * @param {string} signalType - GREEN signal type
     * @returns {Promise<object>} Sync result with multiplier
     */
    async syncStreakFromRed(userId, baseReward, signalType = 'TRAINING_REWARD') {
        const { data, error } = await this.supabase.rpc('fn_sync_streak_from_red', {
            p_user_id: userId,
            p_base_reward: baseReward,
            p_green_signal: signalType
        });

        if (error) {
            // Fallback to local calculation
            return this.syncStreakLocal(userId, baseReward);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Sync streak locally (fallback)
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base reward
     * @returns {Promise<object>} Local sync result
     */
    async syncStreakLocal(userId, baseReward) {
        // Fetch streak from wallets
        const { data, error } = await this.supabase
            .from('wallets')
            .select('current_streak')
            .eq('user_id', userId)
            .single();

        const streakDays = error ? 0 : (data?.current_streak || 0);
        const multiplier = YellowMasterBusEngine.getMultiplierForStreak(streakDays);

        return {
            success: true,
            sync: {
                source_silo: 'YELLOW',
                source_table: 'wallets',
                streak_days: streakDays
            },
            multiplier: {
                tier: multiplier.tier,
                value: multiplier.multiplier
            },
            reward: {
                base_reward: baseReward,
                final_reward: Math.floor(baseReward * multiplier.multiplier),
                streak_bonus: Math.floor(baseReward * multiplier.multiplier) - baseReward
            }
        };
    }

    /**
     * Process GREEN reward signal (unified endpoint)
     * Applies mastery gate + streak multiplier + mints
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base reward
     * @param {number} accuracy - Session accuracy
     * @param {object} options - Additional options
     * @returns {Promise<object>} Processing result
     */
    async processGreenRewardSignal(userId, baseReward, accuracy, options = {}) {
        const { signalType = 'TRAINING_REWARD', sessionId = null, metadata = {} } = options;

        // Local mastery gate check
        if (accuracy < 0.85) {
            return {
                success: false,
                error: 'MASTERY_GATE_FAILED',
                message: `GREEN silo requires 85% mastery, got ${(accuracy * 100).toFixed(1)}%`,
                accuracy,
                threshold: 0.85,
                hardLaw: '85_PERCENT_MASTERY_GATE'
            };
        }

        const { data, error } = await this.supabase.rpc('fn_process_green_reward_signal', {
            p_user_id: userId,
            p_base_reward: baseReward,
            p_accuracy: accuracy,
            p_signal_type: signalType,
            p_session_id: sessionId,
            p_metadata: metadata
        });

        if (error) {
            return {
                success: false,
                error: 'GREEN_SIGNAL_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Get multiplier for streak days (local calculation)
     * HARD LAW: 1.2x (3-Day), 1.5x (7-Day), 2.0x (30-Day)
     * 
     * @param {number} streakDays - Current streak days
     * @returns {object} Multiplier info
     */
    static getMultiplierForStreak(streakDays) {
        const days = Math.max(0, Math.floor(streakDays));
        const multipliers = MASTER_BUS_CONFIG.STREAK_SYNC.MULTIPLIERS;

        if (days >= 30) {
            return { tier: 'LEGENDARY', multiplier: multipliers.DAY_30, minDays: 30 };
        } else if (days >= 14) {
            return { tier: 'BLAZING', multiplier: 1.75, minDays: 14 };
        } else if (days >= 7) {
            return { tier: 'HOT', multiplier: multipliers.DAY_7, minDays: 7 };
        } else if (days >= 3) {
            return { tier: 'WARMING', multiplier: multipliers.DAY_3, minDays: 3 };
        } else if (days >= 1) {
            return { tier: 'WARMING_UP', multiplier: 1.10, minDays: 1 };
        } else {
            return { tier: 'COLD', multiplier: 1.00, minDays: 0 };
        }
    }

    /**
     * Preview GREEN signal processing (no database mutation)
     * 
     * @param {number} baseReward - Base reward
     * @param {number} streakDays - Current streak
     * @param {number} accuracy - Accuracy
     * @returns {object} Preview result
     */
    static previewGreenSignal(baseReward, streakDays, accuracy) {
        // Mastery gate check
        if (accuracy < 0.85) {
            return {
                eligible: false,
                reason: 'MASTERY_GATE_FAILED',
                accuracy,
                threshold: 0.85
            };
        }

        const multiplier = YellowMasterBusEngine.getMultiplierForStreak(streakDays);
        const finalReward = Math.floor(baseReward * multiplier.multiplier);

        return {
            eligible: true,
            baseReward,
            streakDays,
            multiplier: multiplier.multiplier,
            tier: multiplier.tier,
            finalReward,
            streakBonus: finalReward - baseReward,
            formula: `${baseReward} × ${multiplier.multiplier} = ${finalReward} 💎`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 MASTER BUS STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get Master Bus engine status
     * 
     * @returns {Promise<object>} Engine status
     */
    async getMasterBusStatus() {
        const { data, error } = await this.supabase
            .from('yellow_master_bus_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task10_burnMigration: data.burn_migration_active,
                task10_burnTransactions: data.burn_transactions_total,
                task11_securityShield: data.security_shield_active,
                task12_redSync: data.red_sync_active,
                task12_greenSignal: data.green_signal_active,
                task12_syncOperations: data.sync_operations_total,
                verifiedAt: data.verified_at
            }
        };
    }

    /**
     * Get sync log history
     * 
     * @param {string} userId - Optional user filter
     * @param {number} limit - Max records
     * @returns {Promise<object>} Sync history
     */
    async getSyncHistory(userId = null, limit = 20) {
        let query = this.supabase
            .from('streak_sync_log')
            .select('*')
            .order('synced_at', { ascending: false })
            .limit(limit);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        return {
            success: !error,
            logs: data || [],
            count: data?.length || 0
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowMasterBusEngine;
