/**
 * 🔥 BURN VAULT SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 25% burn from marketplace transactions.
 * Funds move to NULL_BURN_ADDRESS.
 * Tracked in Global_Burn_Counter for Orb 10.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 🔥 BURN CONSTANTS
// ═══════════════════════════════════════════════════════════

export const BURN_CONFIG = {
    BURN_PERCENTAGE: 0.25,  // 25%
    NULL_BURN_ADDRESS: '00000000-0000-0000-0000-000000000000',
    NULL_WALLET_ID: '00000000-0000-0000-0000-000000001111',
    SYSTEM_POOL_ADDRESS: '00000000-0000-0000-0000-000000000001',
    SYSTEM_POOL_WALLET: '00000000-0000-0000-0000-000000002222'
};

// ═══════════════════════════════════════════════════════════
// 🔥 BURN VAULT SERVICE CLASS
// ═══════════════════════════════════════════════════════════

export class BurnVaultService {

    constructor(supabase) {
        if (!supabase) {
            throw new Error('BURN_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 MARKETPLACE BURN EXECUTION
    // ═══════════════════════════════════════════════════════

    /**
     * Execute marketplace transaction with 25% burn
     * 
     * @param {string} sellerId - Seller UUID
     * @param {string} buyerId - Buyer UUID
     * @param {number} totalAmount - Total transaction amount
     * @param {object} options - Item details and metadata
     * @returns {Promise<object>} Transaction result with burn breakdown
     */
    async executeMarketplaceBurn(sellerId, buyerId, totalAmount, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_execute_marketplace_burn', {
            p_seller_id: sellerId,
            p_buyer_id: buyerId,
            p_total_amount: totalAmount,
            p_item_id: options.itemId || null,
            p_item_type: options.itemType || 'MARKETPLACE_ITEM',
            p_metadata: options.metadata || {}
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'BURN_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message,
                currentBalance: result.current_balance,
                shortfall: result.shortfall
            };
        }

        return {
            success: true,
            status: result.status,
            transaction: {
                originalAmount: result.transaction.original_amount,
                burnAmount: result.transaction.burn_amount,
                burnPercentage: result.transaction.burn_percentage,
                sellerReceives: result.transaction.seller_receives,
                itemId: result.transaction.item_id
            },
            participants: {
                buyer: result.participants.buyer,
                buyerTx: result.participants.buyer_tx,
                seller: result.participants.seller,
                sellerTx: result.participants.seller_tx,
                burnTx: result.participants.burn_tx
            },
            executionMs: result.execution_ms
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 BURN STATISTICS
    // ═══════════════════════════════════════════════════════

    /**
     * Get global burn statistics for Orb 10 dashboard
     * 
     * @returns {Promise<object>} Burn statistics
     */
    async getBurnStats() {
        const { data, error } = await this.supabase.rpc('fn_get_burn_stats');

        if (error) {
            return { error: error.message };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            totalBurned: result.total_burned,
            marketplaceBurns: result.marketplace_burns,
            arcadeBurns: result.arcade_burns,
            otherBurns: result.other_burns,
            burnWalletBalance: result.burn_wallet_balance,
            lastBurnAt: result.last_burn_at,
            lastBurnAmount: result.last_burn_amount,
            lastBurnSource: result.last_burn_source
        };
    }

    /**
     * Get burn audit log for a user
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Number of records
     * @returns {Promise<object[]>} Burn audit entries
     */
    async getUserBurnHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('burn_audit_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`BURN_ERROR: ${error.message}`);
        }

        return data || [];
    }

    // ═══════════════════════════════════════════════════════
    // 🧮 PREVIEW CALCULATION
    // ═══════════════════════════════════════════════════════

    /**
     * Preview burn breakdown without executing
     * 
     * @param {number} totalAmount - Total transaction amount
     * @returns {object} Burn breakdown preview
     */
    previewBurn(totalAmount) {
        const burnAmount = Math.floor(totalAmount * BURN_CONFIG.BURN_PERCENTAGE);
        const sellerReceives = totalAmount - burnAmount;

        return {
            totalAmount,
            burnAmount,
            burnPercentage: BURN_CONFIG.BURN_PERCENTAGE * 100,
            sellerReceives,
            formula: `${totalAmount} × ${BURN_CONFIG.BURN_PERCENTAGE * 100}% burn = ${burnAmount} burned, ${sellerReceives} to seller`
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default BurnVaultService;
