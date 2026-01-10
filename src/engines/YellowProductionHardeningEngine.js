/**
 * 🔒 YELLOW PRODUCTION HARDENING ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_PRODUCTION_HARDENING (TASKS 22-24)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 22: 25_PERCENT_BURN_AUDIT_SERVICE
 * Task 23: ATOMIC_MINT_RECONCILIATION
 * Task 24: MULTIPLIER_STREAK_GATE
 * 
 * @target Production Security Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ PRODUCTION HARDENING CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const PRODUCTION_HARDENING_CONFIG = {
    // Task 22: Burn Audit
    BURN_AUDIT: {
        BURN_RATE: 0.25,           // 25% HARD LAW
        TOLERANCE: 0.001,          // 0.1% tolerance for rounding
        AUTO_FREEZE: true
    },

    // Task 23: Reconciliation
    RECONCILIATION: {
        INTERVAL_MS: 60000,        // Every 60 seconds
        CRITICAL_VARIANCE: 10,     // Variance > 10 = critical
        AUTO_FREEZE_ON_CRITICAL: true
    },

    // Task 24: Multiplier Gate
    MULTIPLIER_GATE: {
        LEGENDARY_MULTIPLIER: 2.00,
        LEGENDARY_DAYS_REQUIRED: 30,
        MAX_LOGIN_GAP_DAYS: 2,
        FALLBACK_TIERS: [
            { minDays: 14, multiplier: 1.75 },
            { minDays: 7, multiplier: 1.50 },
            { minDays: 3, multiplier: 1.20 },
            { minDays: 0, multiplier: 1.00 }
        ]
    }
};

// ═══════════════════════════════════════════════════════════
// 🔒 YELLOW PRODUCTION HARDENING ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowProductionHardeningEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('PRODUCTION_HARDENING_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
        this.reconciliationInterval = null;
    }

    // ═══════════════════════════════════════════════════════
    // 🔒 TASK 22: 25% BURN AUDIT SERVICE
    // ═══════════════════════════════════════════════════════

    /**
     * Run burn integrity check
     * Will freeze ledger on violation
     * 
     * @param {boolean} forceCheck - Force check even if frozen
     * @returns {Promise<object>} Audit result
     */
    async runBurnIntegrityCheck(forceCheck = false) {
        const { data, error } = await this.supabase.rpc('burn_integrity_check', {
            p_force_check: forceCheck
        });

        if (error) {
            return {
                success: false,
                error: 'BURN_AUDIT_RPC_FAILED',
                message: error.message
            };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Get ledger freeze status
     * 
     * @returns {Promise<object>} Freeze status
     */
    async getLedgerFreezeStatus() {
        const { data, error } = await this.supabase
            .from('ledger_freeze_status')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            isFrozen: data.is_frozen,
            frozenAt: data.frozen_at,
            frozenBy: data.frozen_by,
            reason: data.freeze_reason,
            violation: {
                type: data.violation_type,
                expected: data.expected_burn,
                actual: data.actual_burn,
                variance: data.variance
            },
            resolution: {
                resolvedAt: data.resolved_at,
                resolvedBy: data.resolved_by,
                notes: data.resolution_notes
            }
        };
    }

    /**
     * Check if ledger is operational
     * 
     * @returns {Promise<boolean>} True if ledger is operational
     */
    async isLedgerOperational() {
        const status = await this.getLedgerFreezeStatus();
        return status.success && !status.isFrozen;
    }

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 23: ATOMIC MINT RECONCILIATION
    // ═══════════════════════════════════════════════════════

    /**
     * Run ledger audit loop
     * 
     * @returns {Promise<object>} Reconciliation result
     */
    async runReconciliation() {
        const { data, error } = await this.supabase.rpc('ledger_audit_loop');

        if (error) {
            return {
                success: false,
                error: 'RECONCILIATION_RPC_FAILED',
                message: error.message
            };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Start automated reconciliation loop
     * 
     * @param {function} callback - Callback for each result
     * @param {number} intervalMs - Interval in ms (default 60000)
     * @returns {function} Stop function
     */
    startReconciliationLoop(callback, intervalMs = 60000) {
        // Run immediately
        this.runReconciliation().then(callback);

        // Set up interval
        this.reconciliationInterval = setInterval(async () => {
            const result = await this.runReconciliation();
            callback(result);
        }, intervalMs);

        // Return stop function
        return () => this.stopReconciliationLoop();
    }

    /**
     * Stop reconciliation loop
     */
    stopReconciliationLoop() {
        if (this.reconciliationInterval) {
            clearInterval(this.reconciliationInterval);
            this.reconciliationInterval = null;
        }
    }

    /**
     * Get reconciliation history
     * 
     * @param {number} limit - Max records
     * @returns {Promise<object>} Reconciliation history
     */
    async getReconciliationHistory(limit = 20) {
        const { data, error } = await this.supabase
            .from('reconciliation_log')
            .select('*')
            .order('reconciled_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            logs: data,
            count: data.length,
            summary: {
                balanced: data.filter(r => r.status === 'BALANCED').length,
                variance: data.filter(r => r.status === 'VARIANCE_DETECTED').length,
                critical: data.filter(r => r.status === 'CRITICAL').length
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 24: MULTIPLIER STREAK GATE
    // ═══════════════════════════════════════════════════════

    /**
     * Verify multiplier against streak gate
     * 2.0x requires RED Silo 30-day verification
     * 
     * @param {string} userId - User UUID
     * @param {number} requestedMultiplier - Requested multiplier
     * @param {number} baseReward - Base reward amount
     * @returns {Promise<object>} Verification result
     */
    async verifyMultiplierStreakGate(userId, requestedMultiplier, baseReward) {
        const { data, error } = await this.supabase.rpc('verify_multiplier_streak_gate', {
            p_user_id: userId,
            p_requested_multiplier: requestedMultiplier,
            p_base_reward: baseReward
        });

        if (error) {
            // Fallback to local verification
            return this.verifyMultiplierLocal(requestedMultiplier, 0, baseReward);
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Verify multiplier locally (fallback)
     * 
     * @param {number} requestedMultiplier - Requested multiplier
     * @param {number} streakDays - Known streak days
     * @param {number} baseReward - Base reward
     * @returns {object} Verification result
     */
    verifyMultiplierLocal(requestedMultiplier, streakDays, baseReward) {
        const config = PRODUCTION_HARDENING_CONFIG.MULTIPLIER_GATE;
        let approvedMultiplier = requestedMultiplier;
        let wasDowngraded = false;
        let downgradeReason = null;

        // Check if 2.0x is requested but streak is insufficient
        if (requestedMultiplier >= config.LEGENDARY_MULTIPLIER) {
            if (streakDays < config.LEGENDARY_DAYS_REQUIRED) {
                wasDowngraded = true;
                downgradeReason = `Only ${streakDays} days streak (requires ${config.LEGENDARY_DAYS_REQUIRED})`;

                // Find appropriate fallback tier
                for (const tier of config.FALLBACK_TIERS) {
                    if (streakDays >= tier.minDays) {
                        approvedMultiplier = tier.multiplier;
                        break;
                    }
                }
            }
        }

        const finalReward = Math.floor(baseReward * approvedMultiplier);

        return {
            success: true,
            request: {
                requested_multiplier: requestedMultiplier,
                base_reward: baseReward
            },
            verification: {
                verified: !wasDowngraded,
                approved_multiplier: approvedMultiplier,
                was_downgraded: wasDowngraded,
                downgrade_reason: downgradeReason
            },
            reward: {
                base: baseReward,
                multiplier: approvedMultiplier,
                final: finalReward
            },
            hard_law: '2.0x requires 30-day RED Silo verification',
            local_fallback: true
        };
    }

    /**
     * Get multiplier verification history
     * 
     * @param {string} userId - Optional user filter
     * @param {number} limit - Max records
     * @returns {Promise<object>} Verification history
     */
    async getMultiplierVerificationHistory(userId = null, limit = 20) {
        let query = this.supabase
            .from('multiplier_verification_log')
            .select('*')
            .order('verified_at', { ascending: false })
            .limit(limit);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        return {
            success: !error,
            logs: data || [],
            count: data?.length || 0,
            downgrades: (data || []).filter(v => v.was_downgraded).length
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ENGINE STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get production hardening status
     * 
     * @returns {Promise<object>} Engine status
     */
    async getProductionStatus() {
        const { data, error } = await this.supabase
            .from('yellow_production_hardening_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                ledgerFrozen: data.ledger_frozen,
                frozenSince: data.frozen_since,
                task22_burnAudit: data.burn_audit_active,
                task23_reconciliation: data.reconciliation_active,
                task23_reconciliationCount: data.reconciliation_count,
                task23_lastStatus: data.last_reconciliation_status,
                task24_multiplierGate: data.multiplier_gate_active,
                task24_verifications: data.verification_count,
                task24_downgrades: data.downgrades_count,
                verifiedAt: data.verified_at
            }
        };
    }

    /**
     * Run full production health check
     * 
     * @returns {Promise<object>} Health check result
     */
    async runHealthCheck() {
        const [burnCheck, reconciliation, status] = await Promise.all([
            this.runBurnIntegrityCheck(),
            this.runReconciliation(),
            this.getProductionStatus()
        ]);

        const isHealthy =
            burnCheck.status === 'INTEGRITY_VERIFIED' &&
            reconciliation.reconciliation?.is_balanced &&
            !status.status?.ledgerFrozen;

        return {
            success: true,
            healthy: isHealthy,
            checks: {
                burnIntegrity: {
                    passed: burnCheck.status === 'INTEGRITY_VERIFIED',
                    status: burnCheck.status
                },
                reconciliation: {
                    passed: reconciliation.reconciliation?.is_balanced,
                    status: reconciliation.reconciliation?.status
                },
                ledger: {
                    passed: !status.status?.ledgerFrozen,
                    frozen: status.status?.ledgerFrozen
                }
            },
            timestamp: new Date().toISOString()
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowProductionHardeningEngine;
