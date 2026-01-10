/**
 * 💱 ECONOMY & RISK ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SOVEREIGN_MAPPING: 51-66 | ECONOMY & RISK
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 51: ARCADE_RNG_ORACLE
 * Task 52: DIAMOND_ARENA_RAKEBACK
 * Task 53: BURN_VAULT_TRANSPARENCY
 * Task 54: MULTI_CURRENCY_ATOMIC_SWAP
 * 
 * @target Economy & Risk Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { createHash, randomBytes } from 'crypto';

// ═══════════════════════════════════════════════════════════
// ⚙️ ECONOMY & RISK CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ECONOMY_RISK_CONFIG = {
    // Task 51: RNG Oracle
    RNG: {
        ALGORITHM: 'SHA-256',
        PROVABLY_FAIR: true
    },

    // Task 52: Rakeback Tiers
    RAKEBACK_TIERS: [
        { name: 'NO_RAKEBACK', minStreak: 0, percent: 0 },
        { name: 'BRONZE_RAKEBACK', minStreak: 7, percent: 1.00 },
        { name: 'SILVER_RAKEBACK', minStreak: 14, percent: 2.50 },
        { name: 'GOLD_RAKEBACK', minStreak: 21, percent: 4.00 },
        { name: 'LEGENDARY_RAKEBACK', minStreak: 30, percent: 5.00 }
    ],

    // Task 53: Burn Transparency
    BURN_TRANSPARENCY: {
        PUBLIC: true,
        ANONYMIZED: true
    },

    // Task 54: Currency Swap
    SWAP_RATES: {
        XP_TO_DIAMOND: { rate: 0.01, fee: 5.00 },  // 100 XP = 1 Diamond (5% fee)
        DIAMOND_TO_TICKET: { rate: 1.00, fee: 0 }   // 1:1 no fee
    }
};

// ═══════════════════════════════════════════════════════════
// 💱 ECONOMY & RISK ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class EconomyRiskEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ECONOMY_RISK_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🎲 TASK 51: ARCADE RNG ORACLE
    // ═══════════════════════════════════════════════════════

    /**
     * Generate provably fair RNG seed
     * 
     * @param {object} rngData - RNG parameters
     * @returns {Promise<object>} RNG result
     */
    async generateRngSeed(rngData) {
        const { sessionId, gameMode, userId, clientSeed } = rngData;

        const { data, error } = await this.supabase.rpc('fn_generate_rng_seed', {
            p_session_id: sessionId,
            p_game_mode: gameMode,
            p_user_id: userId,
            p_client_seed: clientSeed
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Verify RNG seed after game
     * 
     * @param {string} seedId - Seed UUID
     * @returns {Promise<object>} Verification result
     */
    async verifyRngSeed(seedId) {
        const { data, error } = await this.supabase.rpc('fn_verify_rng_seed', {
            p_seed_id: seedId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Generate RNG locally (for preview/testing)
     * 
     * @param {string} serverSeed - Server seed
     * @param {string} clientSeed - Client seed
     * @param {number} nonce - Nonce
     * @returns {object} Local RNG result
     */
    static generateRngLocal(serverSeed, clientSeed, nonce) {
        const combined = `${serverSeed}:${clientSeed}:${nonce}`;
        const hash = createHash('sha256').update(combined).digest('hex');
        const rollValue = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF;

        return {
            serverSeedHash: createHash('sha256').update(serverSeed).digest('hex'),
            clientSeed,
            nonce,
            combinedSeed: combined,
            finalHash: hash,
            rollValue,
            normalized: `${(rollValue * 100).toFixed(2)}%`
        };
    }

    /**
     * Generate cryptographic server seed locally
     * 
     * @returns {object} Server seed and hash
     */
    static generateServerSeed() {
        const serverSeed = randomBytes(32).toString('hex');
        const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

        return { serverSeed, serverSeedHash };
    }

    // ═══════════════════════════════════════════════════════
    // 💰 TASK 52: DIAMOND ARENA RAKEBACK
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate rakeback for high-streak users
     * 
     * @param {object} rakebackData - Rakeback parameters
     * @returns {Promise<object>} Rakeback result
     */
    async calculateRakeback(rakebackData) {
        const { userId, feeSource, feeAmount } = rakebackData;

        const { data, error } = await this.supabase.rpc('fn_calculate_rakeback', {
            p_user_id: userId,
            p_fee_source: feeSource,
            p_fee_amount: feeAmount
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate rakeback locally
     * 
     * @param {number} feeAmount - Fee paid
     * @param {number} streakDays - User streak
     * @returns {object} Rakeback calculation
     */
    static calculateRakebackLocal(feeAmount, streakDays) {
        const tiers = ECONOMY_RISK_CONFIG.RAKEBACK_TIERS;
        let tier = tiers[0];

        for (const t of tiers) {
            if (streakDays >= t.minStreak) {
                tier = t;
            }
        }

        const rakebackAmount = Math.floor(feeAmount * (tier.percent / 100));

        return {
            feeAmount,
            streakDays,
            tier: tier.name,
            percent: tier.percent,
            rakebackAmount,
            eligible: tier.percent > 0
        };
    }

    /**
     * Get user's rakeback history
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Rakeback history
     */
    async getRakebackHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('rakeback_ledger')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            entries: data || [],
            totalEarned: (data || []).reduce((sum, e) => sum + e.rakeback_amount, 0)
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 53: BURN VAULT TRANSPARENCY
    // ═══════════════════════════════════════════════════════

    /**
     * Get burn vault transparency data
     * 
     * @param {number} limit - Max records
     * @returns {Promise<object>} Burn transparency
     */
    async getBurnTransparency(limit = 100) {
        const { data, error } = await this.supabase
            .from('burn_vault_transparency')
            .select('*')
            .limit(limit);

        return {
            success: !error,
            burns: data || [],
            count: data?.length || 0
        };
    }

    /**
     * Get burn vault summary
     * 
     * @returns {Promise<object>} Summary
     */
    async getBurnVaultSummary() {
        const { data, error } = await this.supabase
            .from('burn_vault_summary')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            summary: data
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💱 TASK 54: MULTI-CURRENCY ATOMIC SWAP
    // ═══════════════════════════════════════════════════════

    /**
     * Execute currency swap
     * 
     * @param {object} swapData - Swap parameters
     * @returns {Promise<object>} Swap result
     */
    async executeCurrencySwap(swapData) {
        const { userId, fromCurrency, toCurrency, amount } = swapData;

        const { data, error } = await this.supabase.rpc('fn_execute_currency_swap', {
            p_user_id: userId,
            p_from_currency: fromCurrency,
            p_to_currency: toCurrency,
            p_amount: amount
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate swap preview locally
     * 
     * @param {string} fromCurrency - Source currency
     * @param {string} toCurrency - Target currency
     * @param {number} amount - Input amount
     * @returns {object} Swap preview
     */
    static calculateSwapPreview(fromCurrency, toCurrency, amount) {
        let rate, feePercent;

        if (fromCurrency === 'XP' && toCurrency === 'DIAMOND') {
            rate = ECONOMY_RISK_CONFIG.SWAP_RATES.XP_TO_DIAMOND.rate;
            feePercent = ECONOMY_RISK_CONFIG.SWAP_RATES.XP_TO_DIAMOND.fee;
        } else if (fromCurrency === 'DIAMOND' && toCurrency === 'ARENA_TICKET') {
            rate = ECONOMY_RISK_CONFIG.SWAP_RATES.DIAMOND_TO_TICKET.rate;
            feePercent = ECONOMY_RISK_CONFIG.SWAP_RATES.DIAMOND_TO_TICKET.fee;
        } else {
            return { success: false, error: 'SWAP_PAIR_NOT_SUPPORTED' };
        }

        const fee = Math.floor(amount * (feePercent / 100));
        const netInput = amount - fee;
        const output = Math.floor(netInput * rate);

        return {
            success: true,
            from: fromCurrency,
            to: toCurrency,
            input: amount,
            fee,
            feePercent: `${feePercent}%`,
            output,
            rate,
            formula: `${amount} ${fromCurrency} - ${fee} fee = ${output} ${toCurrency}`
        };
    }

    /**
     * Get swap history
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Swap history
     */
    async getSwapHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('currency_swap_ledger')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            swaps: data || [],
            count: data?.length || 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get Economy & Risk status
     * 
     * @returns {Promise<object>} Status
     */
    async getEconomyRiskStatus() {
        const { data, error } = await this.supabase
            .from('economy_risk_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task51_rngOracle: {
                    totalRolls: data.total_rng_rolls,
                    verifiedRolls: data.verified_rolls
                },
                task52_rakeback: {
                    entries: data.total_rakeback_entries,
                    earned: data.total_rakeback_earned,
                    credited: data.total_rakeback_credited
                },
                task53_burnTransparency: {
                    totalBurned: data.total_diamonds_burned,
                    transactions: data.burn_transaction_count
                },
                task54_currencySwap: {
                    totalSwaps: data.total_swaps,
                    feesCollected: data.total_swap_fees
                },
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default EconomyRiskEngine;
