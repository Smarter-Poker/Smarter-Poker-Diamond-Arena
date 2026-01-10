/**
 * 💎 YELLOW FOUNDATION ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_FOUNDATION (TASKS 1-3)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 01: ATOMIC_DIAMOND_LEDGER
 * Task 02: THE_25_PERCENT_BURN_VAULT  
 * Task 03: MULTIPLIER_STREAK_LOOKUP
 * 
 * @target All Diamond Economy operations
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ FOUNDATION CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const FOUNDATION_CONFIG = {
    // Task 01: Atomic Ledger
    LEDGER: {
        TABLE: 'diamond_ledger_entries',
        IMMUTABLE: true,  // HARD LAW: No updates or deletes
    },

    // Task 02: 25% Burn Vault
    BURN: {
        PERCENTAGE: 0.25,  // 25% HARD LAW
        VAULT_TABLE: 'burn_vault',
        LEDGER_TABLE: 'burn_ledger',
        MIN_BURN_THRESHOLD: 4,  // Minimum tx to trigger 1 diamond burn
    },

    // Task 03: Streak Multipliers (HARD LAW)
    STREAK: {
        CONFIG_TABLE: 'streak_config',
        TIERS: [
            { minDays: 0, maxDays: 2, multiplier: 1.00, tier: 'COLD', label: '❄️ No Streak' },
            { minDays: 3, maxDays: 6, multiplier: 1.20, tier: 'WARMING', label: '🔥 3-Day Streak' },     // HARD LAW
            { minDays: 7, maxDays: 13, multiplier: 1.50, tier: 'HOT', label: '🔥🔥 7-Day Streak' },   // HARD LAW
            { minDays: 14, maxDays: 29, multiplier: 1.75, tier: 'BLAZING', label: '🔥🔥🔥 Blazing' },
            { minDays: 30, maxDays: null, multiplier: 2.00, tier: 'LEGENDARY', label: '👑 30-Day Legend' }    // HARD LAW
        ]
    }
};

// ═══════════════════════════════════════════════════════════
// 💎 YELLOW FOUNDATION ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowFoundationEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('FOUNDATION_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 📋 TASK 01: ATOMIC DIAMOND LEDGER
    // ═══════════════════════════════════════════════════════

    /**
     * Append entry to the atomic diamond ledger
     * HARD LAW: Once written, entries cannot be modified
     * 
     * @param {string} userId - User UUID
     * @param {number} delta - Amount (+credit, -debit)
     * @param {string} source - Transaction source
     * @param {object} options - Additional options
     * @returns {Promise<object>} Ledger entry result
     */
    async appendToLedger(userId, delta, source, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_append_to_ledger', {
            p_user_id: userId,
            p_delta: delta,
            p_source: source,
            p_reference_id: options.referenceId || null,
            p_reference_type: options.referenceType || null,
            p_metadata: options.metadata || {}
        });

        if (error) {
            return {
                success: false,
                error: 'LEDGER_APPEND_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Get user's ledger history
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max entries to return
     * @returns {Promise<object>} Ledger history
     */
    async getLedgerHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from(FOUNDATION_CONFIG.LEDGER.TABLE)
            .select('id, delta, balance_after, source, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { success: false, error: error.message, entries: [] };
        }

        return {
            success: true,
            userId,
            entries: data || [],
            count: data?.length || 0
        };
    }

    /**
     * Get user's current balance from ledger
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Current balance
     */
    async getBalance(userId) {
        const { data, error } = await this.supabase
            .from(FOUNDATION_CONFIG.LEDGER.TABLE)
            .select('balance_after')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return { success: true, balance: 0, userId };
        }

        return {
            success: true,
            balance: data.balance_after,
            userId
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 02: THE 25% BURN VAULT
    // ═══════════════════════════════════════════════════════

    /**
     * Record a 25% burn from a marketplace transaction
     * HARD LAW: 25% of all marketplace fees go to burn
     * 
     * @param {string} payerId - Buyer UUID
     * @param {string} transactionId - Associated transaction UUID
     * @param {number} originalAmount - Total transaction amount
     * @param {string} source - Source of burn (MARKETPLACE, ARCADE, etc)
     * @returns {Promise<object>} Burn record result
     */
    async recordBurn(payerId, transactionId, originalAmount, source = 'MARKETPLACE') {
        const { data, error } = await this.supabase.rpc('fn_record_burn', {
            p_payer_id: payerId,
            p_transaction_id: transactionId,
            p_original_amount: originalAmount,
            p_source: source
        });

        if (error) {
            return {
                success: false,
                error: 'BURN_RECORD_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Calculate burn amount for a given transaction
     * Client-side preview (no database call)
     * 
     * @param {number} amount - Transaction amount
     * @returns {object} Burn calculation
     */
    static calculateBurn(amount) {
        const burnRate = FOUNDATION_CONFIG.BURN.PERCENTAGE;
        let burnAmount = Math.floor(amount * burnRate);

        // Minimum burn of 1 for transactions >= threshold
        if (burnAmount < 1 && amount >= FOUNDATION_CONFIG.BURN.MIN_BURN_THRESHOLD) {
            burnAmount = 1;
        }

        const netAmount = amount - burnAmount;

        return {
            originalAmount: amount,
            burnAmount,
            netAmount,
            burnPercentage: burnRate * 100,
            hardLaw: '25_PERCENT_BURN'
        };
    }

    /**
     * Get current burn vault statistics
     * 
     * @returns {Promise<object>} Vault stats
     */
    async getBurnVaultStats() {
        const { data, error } = await this.supabase
            .from(FOUNDATION_CONFIG.BURN.VAULT_TABLE)
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            vault: {
                totalBurned: data.total_burned,
                marketplaceBurned: data.marketplace_burned,
                arcadeBurned: data.arcade_burned,
                otherBurned: data.other_burned,
                lastBurnAt: data.last_burn_at,
                lastBurnAmount: data.last_burn_amount,
                lastBurnSource: data.last_burn_source
            }
        };
    }

    /**
     * Get burn history for a user
     * 
     * @param {string} payerId - User UUID
     * @param {number} limit - Max records to return
     * @returns {Promise<object>} Burn history
     */
    async getBurnHistory(payerId, limit = 50) {
        const { data, error } = await this.supabase
            .from(FOUNDATION_CONFIG.BURN.LEDGER_TABLE)
            .select('*')
            .eq('payer_id', payerId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { success: false, error: error.message, burns: [] };
        }

        return {
            success: true,
            payerId,
            burns: data || [],
            count: data?.length || 0,
            totalBurned: data?.reduce((sum, b) => sum + b.burn_amount, 0) || 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 03: MULTIPLIER STREAK LOOKUP
    // ═══════════════════════════════════════════════════════

    /**
     * Get streak multiplier from database config
     * 
     * @param {number} streakDays - Current streak days
     * @returns {Promise<object>} Multiplier info
     */
    async getStreakMultiplier(streakDays) {
        const { data, error } = await this.supabase.rpc('fn_get_streak_multiplier', {
            p_streak_days: streakDays
        });

        if (error) {
            // Fallback to local calculation
            return YellowFoundationEngine.getStreakMultiplierLocal(streakDays);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return {
            success: true,
            multiplier: parseFloat(result.multiplier),
            tierName: result.tier_name,
            tierLabel: result.tier_label,
            tierIcon: result.tier_icon,
            streakDays: result.streak_days,
            nextTier: result.next_tier,
            nextMultiplier: result.next_multiplier,
            daysToNext: result.days_to_next
        };
    }

    /**
     * Get streak multiplier locally (no database call)
     * HARD LAW: 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
     * 
     * @param {number} streakDays - Current streak days
     * @returns {object} Multiplier info
     */
    static getStreakMultiplierLocal(streakDays) {
        const tiers = FOUNDATION_CONFIG.STREAK.TIERS;
        const days = Math.max(0, Math.floor(streakDays));

        // Find current tier
        let currentTier = tiers[0];
        for (const tier of tiers) {
            if (days >= tier.minDays && (tier.maxDays === null || days <= tier.maxDays)) {
                currentTier = tier;
                break;
            }
        }

        // Find next tier
        const nextTier = tiers.find(t => t.minDays > days) || null;

        return {
            success: true,
            multiplier: currentTier.multiplier,
            tierName: currentTier.tier,
            tierLabel: currentTier.label,
            streakDays: days,
            nextTier: nextTier?.tier || null,
            nextMultiplier: nextTier?.multiplier || null,
            daysToNext: nextTier ? nextTier.minDays - days : 0,
            hardLaw: 'STREAK_MULTIPLIER_LOOKUP'
        };
    }

    /**
     * Get all streak tiers for UI display
     * 
     * @returns {array} All tier configurations
     */
    static getAllStreakTiers() {
        return FOUNDATION_CONFIG.STREAK.TIERS.map(tier => ({
            tier: tier.tier,
            minDays: tier.minDays,
            maxDays: tier.maxDays === null ? '∞' : tier.maxDays,
            multiplier: tier.multiplier,
            label: tier.label
        }));
    }

    /**
     * Calculate training reward with streak multiplier
     * 
     * @param {number} baseReward - Base diamond reward
     * @param {number} streakDays - Current streak days
     * @returns {object} Reward calculation
     */
    static calculateTrainingReward(baseReward, streakDays) {
        const tier = YellowFoundationEngine.getStreakMultiplierLocal(streakDays);
        const finalReward = Math.floor(baseReward * tier.multiplier);
        const streakBonus = finalReward - baseReward;

        return {
            baseReward,
            multiplier: tier.multiplier,
            streakBonus,
            finalReward,
            tierName: tier.tierName,
            tierLabel: tier.tierLabel,
            formula: `${baseReward} × ${tier.multiplier.toFixed(2)} = ${finalReward} 💎`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 FOUNDATION STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get Yellow Foundation status
     * 
     * @returns {Promise<object>} Foundation status
     */
    async getFoundationStatus() {
        const { data, error } = await this.supabase
            .from('yellow_foundation_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task01_ledger: {
                    entriesCount: data.ledger_entries_count,
                    immutabilityActive: data.ledger_immutability_active
                },
                task02_burn: {
                    totalBurned: data.total_diamonds_burned,
                    recordsCount: data.burn_records_count
                },
                task03_streak: {
                    tiersConfigured: data.streak_tiers_configured,
                    day3Multiplier: parseFloat(data.day_3_multiplier),
                    day7Multiplier: parseFloat(data.day_7_multiplier),
                    day30Multiplier: parseFloat(data.day_30_multiplier)
                },
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowFoundationEngine;
