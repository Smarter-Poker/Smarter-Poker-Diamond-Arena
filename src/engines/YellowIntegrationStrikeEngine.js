/**
 * ⚡ YELLOW INTEGRATION STRIKE ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_INTEGRATION_STRIKE (TASKS 16-18)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 16: MULTIPLIER_STREAK_VALUATOR
 * Task 17: ATOMIC_MINT_FINAL_SETTLEMENT
 * Task 18: MARKETPLACE_BURN_AUDIT_TRAIL
 * 
 * @target Final Integration Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ INTEGRATION STRIKE CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const INTEGRATION_STRIKE_CONFIG = {
    // Task 16: Valuator
    VALUATOR: {
        RED_SOURCE: 'profiles',
        YELLOW_FALLBACK: 'wallets',
        MULTIPLIERS: {
            DAY_3: 1.20,    // HARD LAW
            DAY_7: 1.50,    // HARD LAW
            DAY_30: 2.00    // HARD LAW
        }
    },

    // Task 17: Settlement
    SETTLEMENT: {
        MASTERY_THRESHOLD: 0.85,  // 85% HARD LAW
        RECONCILIATION_REQUIRED: true
    },

    // Task 18: Burn Audit
    BURN_AUDIT: {
        BURN_RATE: 0.25,      // 25% HARD LAW
        ACCEPTABLE_VARIANCE: 0.01,  // 1% tolerance
        STATUSES: ['PERFECT', 'ACCEPTABLE', 'WARNING', 'CRITICAL']
    }
};

// ═══════════════════════════════════════════════════════════
// ⚡ YELLOW INTEGRATION STRIKE ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowIntegrationStrikeEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('INTEGRATION_STRIKE_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🔢 TASK 16: MULTIPLIER STREAK VALUATOR
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate final reward by querying RED for streak
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base reward from GREEN
     * @param {string} greenSource - Source of GREEN packet
     * @returns {Promise<object>} Valuation result
     */
    async calculateFinalReward(userId, baseReward, greenSource = 'TRAINING') {
        const { data, error } = await this.supabase.rpc('fn_calculate_final_reward', {
            p_user_id: userId,
            p_base_reward: baseReward,
            p_green_source: greenSource,
            p_include_diagnostics: true
        });

        if (error) {
            // Fallback to local calculation
            return this.calculateFinalRewardLocal(userId, baseReward);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Calculate final reward locally (fallback)
     * 
     * @param {string} userId - User UUID
     * @param {number} baseReward - Base reward
     * @returns {Promise<object>} Valuation result
     */
    async calculateFinalRewardLocal(userId, baseReward) {
        // Fetch streak from wallets
        const { data, error } = await this.supabase
            .from('wallets')
            .select('current_streak')
            .eq('user_id', userId)
            .single();

        const streakDays = error ? 0 : (data?.current_streak || 0);
        const valuation = YellowIntegrationStrikeEngine.valuateReward(baseReward, streakDays);

        return {
            success: true,
            valuation,
            streak: {
                days: streakDays,
                tier: valuation.tier,
                source: 'YELLOW_SILO_WALLETS'
            }
        };
    }

    /**
     * Valuate reward with streak multiplier (local calc)
     * 
     * @param {number} baseReward - Base reward
     * @param {number} streakDays - Current streak
     * @returns {object} Valuation details
     */
    static valuateReward(baseReward, streakDays) {
        const days = Math.max(0, Math.floor(streakDays));
        const multipliers = INTEGRATION_STRIKE_CONFIG.VALUATOR.MULTIPLIERS;

        let multiplier = 1.00;
        let tier = 'COLD';

        if (days >= 30) {
            multiplier = multipliers.DAY_30;
            tier = 'LEGENDARY';
        } else if (days >= 14) {
            multiplier = 1.75;
            tier = 'BLAZING';
        } else if (days >= 7) {
            multiplier = multipliers.DAY_7;
            tier = 'HOT';
        } else if (days >= 3) {
            multiplier = multipliers.DAY_3;
            tier = 'WARMING';
        } else if (days >= 1) {
            multiplier = 1.10;
            tier = 'WARMING_UP';
        }

        const finalReward = Math.floor(baseReward * multiplier);
        const streakBonus = finalReward - baseReward;

        return {
            base_reward: baseReward,
            multiplier,
            final_reward: finalReward,
            streak_bonus: streakBonus,
            tier,
            formula: `${baseReward} × ${multiplier} = ${finalReward} 💎`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💰 TASK 17: ATOMIC MINT FINAL SETTLEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Process training payout with full settlement
     * 
     * @param {object} payoutData - Payout details
     * @returns {Promise<object>} Settlement result
     */
    async processTrainingPayout(payoutData) {
        const { userId, sessionId, baseReward, accuracy, greenSource = 'TRAINING_SESSION', metadata = {} } = payoutData;

        // Local mastery gate check
        if (accuracy < INTEGRATION_STRIKE_CONFIG.SETTLEMENT.MASTERY_THRESHOLD) {
            return {
                success: false,
                error: 'MASTERY_GATE_FAILED',
                message: `Requires 85% mastery, got ${(accuracy * 100).toFixed(1)}%`,
                accuracy,
                settlement: 'REJECTED'
            };
        }

        const { data, error } = await this.supabase.rpc('process_training_payout', {
            p_user_id: userId,
            p_session_id: sessionId,
            p_base_reward: baseReward,
            p_accuracy: accuracy,
            p_green_source: greenSource,
            p_metadata: metadata
        });

        if (error) {
            return {
                success: false,
                error: 'SETTLEMENT_RPC_FAILED',
                message: error.message,
                settlement: 'FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Preview training payout (no mutation)
     * 
     * @param {number} baseReward - Base reward
     * @param {number} streakDays - Current streak
     * @param {number} accuracy - Session accuracy
     * @returns {object} Preview result
     */
    static previewTrainingPayout(baseReward, streakDays, accuracy) {
        // Mastery gate check
        if (accuracy < INTEGRATION_STRIKE_CONFIG.SETTLEMENT.MASTERY_THRESHOLD) {
            return {
                eligible: false,
                reason: 'MASTERY_GATE_FAILED',
                accuracy,
                threshold: INTEGRATION_STRIKE_CONFIG.SETTLEMENT.MASTERY_THRESHOLD
            };
        }

        const valuation = YellowIntegrationStrikeEngine.valuateReward(baseReward, streakDays);

        return {
            eligible: true,
            baseReward,
            finalReward: valuation.final_reward,
            multiplier: valuation.multiplier,
            streakBonus: valuation.streak_bonus,
            tier: valuation.tier,
            accuracy,
            formula: valuation.formula
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 18: MARKETPLACE BURN AUDIT TRAIL
    // ═══════════════════════════════════════════════════════

    /**
     * Audit burn integrity against 25% law
     * 
     * @param {object} options - Audit options
     * @returns {Promise<object>} Audit result
     */
    async auditBurnIntegrity(options = {}) {
        const { periodStart = null, periodEnd = null } = options;

        const { data, error } = await this.supabase.rpc('audit_burn_integrity', {
            p_period_start: periodStart,
            p_period_end: periodEnd
        });

        if (error) {
            return {
                success: false,
                error: 'AUDIT_RPC_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Get economy dashboard data
     * 
     * @returns {Promise<object>} Dashboard data
     */
    async getEconomyDashboard() {
        const { data, error } = await this.supabase
            .from('economy_dashboard')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            dashboard: {
                supply: {
                    totalMinted: data.total_minted,
                    totalBurned: data.total_burned,
                    circulating: data.circulating_supply
                },
                burn: {
                    marketplaceBurned: data.marketplace_burned,
                    transactions: data.burn_transactions
                },
                audit: {
                    lastStatus: data.last_audit_status,
                    accuracy: data.burn_accuracy,
                    deflationRate: data.deflation_rate
                },
                activity: {
                    wallets: data.total_wallets,
                    transactions: data.total_transactions
                },
                snapshotAt: data.snapshot_at
            }
        };
    }

    /**
     * Get burn audit history
     * 
     * @param {number} limit - Max records
     * @returns {Promise<object>} Audit history
     */
    async getBurnAuditHistory(limit = 10) {
        const { data, error } = await this.supabase
            .from('burn_audit_log')
            .select('*')
            .order('audited_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            audits: data || [],
            count: data?.length || 0
        };
    }

    /**
     * Verify deflationary status
     * 
     * @returns {Promise<object>} Deflationary status
     */
    async verifyDeflationaryStatus() {
        const audit = await this.auditBurnIntegrity();

        if (!audit.success) {
            return audit;
        }

        const proof = audit.deflationary_proof;

        return {
            success: true,
            isDeflationary: proof.is_deflationary,
            deflationRate: proof.deflation_rate,
            totalBurned: proof.total_burned,
            circulatingSupply: proof.circulating_supply,
            burnLawCompliant: audit.integrity.burn_law_compliant,
            status: audit.integrity.status,
            hardLaw: '25_PERCENT_BURN'
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ENGINE STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get integration strike status
     * 
     * @returns {Promise<object>} Engine status
     */
    async getIntegrationStatus() {
        const { data, error } = await this.supabase
            .from('yellow_integration_strike_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task16_valuator: data.valuator_active,
                task17_settlement: data.settlement_active,
                task18_burnAudit: data.burn_audit_active,
                auditCount: data.audit_count,
                lastAuditStatus: data.last_audit_status,
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowIntegrationStrikeEngine;
