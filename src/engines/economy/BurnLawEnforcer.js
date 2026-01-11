/**
 * 🔥 BURN LAW ENFORCER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Hard-coded 25% fee split for all Arena and Arcade transactions.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * THE 25% BURN LAW IS IMMUTABLE.
 * THIS ENFORCER ENSURES COMPLIANCE ACROSS ALL TRANSACTIONS.
 * 
 * @target All Diamond Transactions
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 🔒 BURN LAW CONSTANTS (IMMUTABLE)
// ═══════════════════════════════════════════════════════════

export const BURN_LAW = Object.freeze({
    // Core rate - NEVER CHANGE THIS
    RATE: 0.25,

    // Rate as percentage
    PERCENT: 25,

    // Status
    ENFORCED: true,
    IMMUTABLE: true,

    // Affected transaction types
    APPLIES_TO: Object.freeze([
        'ARENA_STAKE',
        'ARENA_ENTRY',
        'ARCADE_WAGER',
        'ARCADE_PAYOUT',
        'MARKETPLACE_SALE',
        'SOCIAL_TIP',
        'BADGE_PURCHASE',
        'AUCTION_SALE',
        'PRIZE_PAYOUT'
    ]),

    // Exemptions (very limited)
    EXEMPT: Object.freeze([
        'ADMIN_GRANT',  // System grants
        'REFUND',       // Error corrections
        'MIGRATION'     // Data migration
    ])
});

// ═══════════════════════════════════════════════════════════
// 🔥 BURN LAW ENFORCER CLASS
// ═══════════════════════════════════════════════════════════

export class BurnLawEnforcer {

    constructor(supabaseClient = null) {
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🔒 ENFORCEMENT METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Enforce burn on transaction
     * Returns split amounts - CANNOT BE BYPASSED
     * 
     * @param {number} amount - Transaction amount
     * @param {string} txType - Transaction type
     * @returns {object} Enforced split
     */
    static enforce(amount, txType = 'UNKNOWN') {
        // Check exemption
        if (BURN_LAW.EXEMPT.includes(txType)) {
            return {
                enforced: false,
                exempt: true,
                reason: 'EXEMPT_TRANSACTION_TYPE',
                original: amount,
                burned: 0,
                net: amount
            };
        }

        // ENFORCE THE LAW
        const burnAmount = Math.floor(amount * BURN_LAW.RATE);
        const netAmount = amount - burnAmount;

        return {
            enforced: true,
            exempt: false,
            law: '25_PERCENT_BURN_LAW',
            original: amount,
            burned: burnAmount,
            net: netAmount,
            burnRate: `${BURN_LAW.PERCENT}%`,
            txType,
            formula: `${amount} - ${burnAmount} (🔥) = ${netAmount} 💎`,
            immutable: true
        };
    }

    /**
     * Validate that burn was correctly applied
     * 
     * @param {number} original - Original amount
     * @param {number} claimed_burn - Claimed burn amount
     * @param {number} claimed_net - Claimed net amount
     * @returns {object} Validation result
     */
    static validate(original, claimed_burn, claimed_net) {
        const expected = BurnLawEnforcer.enforce(original);

        const burnValid = claimed_burn === expected.burned;
        const netValid = claimed_net === expected.net;
        const sumValid = claimed_burn + claimed_net === original;

        return {
            valid: burnValid && netValid && sumValid,
            checks: {
                burnCorrect: burnValid,
                netCorrect: netValid,
                sumCorrect: sumValid
            },
            expected: {
                burn: expected.burned,
                net: expected.net
            },
            claimed: {
                burn: claimed_burn,
                net: claimed_net
            },
            discrepancy: burnValid && netValid ? 0 : Math.abs(expected.burned - claimed_burn)
        };
    }

    /**
     * Get burn law status
     * 
     * @returns {object} Law status
     */
    static getStatus() {
        return {
            law: '25_PERCENT_BURN_LAW',
            rate: BURN_LAW.RATE,
            percent: BURN_LAW.PERCENT,
            enforced: BURN_LAW.ENFORCED,
            immutable: BURN_LAW.IMMUTABLE,
            applies_to: [...BURN_LAW.APPLIES_TO],
            exempt: [...BURN_LAW.EXEMPT],
            message: '🔥 THE BURN LAW IS ABSOLUTE. 25% OF ALL TRANSACTIONS ARE DESTROYED.'
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 BATCH OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Enforce on multiple transactions
     * 
     * @param {Array} transactions - Array of {amount, txType}
     * @returns {object} Batch enforcement result
     */
    static enforceBatch(transactions) {
        const results = transactions.map(tx =>
            BurnLawEnforcer.enforce(tx.amount, tx.txType)
        );

        const totalOriginal = results.reduce((s, r) => s + r.original, 0);
        const totalBurned = results.reduce((s, r) => s + r.burned, 0);
        const totalNet = results.reduce((s, r) => s + r.net, 0);

        return {
            transactions: results,
            totals: {
                original: totalOriginal,
                burned: totalBurned,
                net: totalNet
            },
            enforcement: {
                count: results.filter(r => r.enforced).length,
                exempt: results.filter(r => r.exempt).length
            }
        };
    }

    /**
     * Calculate cumulative burn impact
     * 
     * @param {number} amount - Amount to analyze
     * @param {number} transactions - Number of transactions
     * @returns {object} Cumulative impact
     */
    static calculateCumulativeImpact(amount, transactions) {
        let remaining = amount;
        const history = [];

        for (let i = 0; i < transactions; i++) {
            const burn = Math.floor(remaining * BURN_LAW.RATE);
            remaining -= burn;
            history.push({
                transaction: i + 1,
                beforeBurn: remaining + burn,
                burned: burn,
                afterBurn: remaining
            });
        }

        return {
            startingAmount: amount,
            transactions,
            finalAmount: remaining,
            totalBurned: amount - remaining,
            burnPercent: `${(((amount - remaining) / amount) * 100).toFixed(2)}%`,
            history
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔍 AUDIT METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Audit transactions for burn compliance
     * 
     * @returns {Promise<object>} Audit result
     */
    async auditBurnCompliance() {
        if (!this.supabase) {
            return { success: false, error: 'NO_DATABASE_CONNECTION' };
        }

        const { data, error } = await this.supabase.rpc('fn_audit_burn_compliance');

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Get burn vault total
     * 
     * @returns {Promise<object>} Vault status
     */
    async getBurnVaultStatus() {
        if (!this.supabase) {
            return { success: false, error: 'NO_DATABASE_CONNECTION' };
        }

        const { data, error } = await this.supabase
            .from('burn_vault')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            vault: data,
            display: `🔥 ${data.total_burned.toLocaleString()} 💎 DESTROYED FOREVER`
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default BurnLawEnforcer;
