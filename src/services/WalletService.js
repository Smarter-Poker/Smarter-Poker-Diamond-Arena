/**
 * 💰 WALLET SERVICE (RPC-POWERED)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * All operations now route through Postgres RPC
 * functions for atomic, metal-speed execution.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 📋 TRANSACTION SOURCES
// ═══════════════════════════════════════════════════════════
export const TX_SOURCES = {
    // Credit sources
    DAILY_CLAIM: 'DAILY_CLAIM',
    SESSION_REWARD: 'SESSION_REWARD',
    ARCADE_WIN: 'ARCADE_WIN',
    STORE_REFUND: 'STORE_REFUND',
    ADMIN_GRANT: 'ADMIN_GRANT',
    TRANSFER_IN: 'TRANSFER_IN',
    BONUS: 'BONUS',
    // Debit sources
    ARCADE_STAKE: 'ARCADE_STAKE',
    STORE_PURCHASE: 'STORE_PURCHASE',
    ADMIN_REVOKE: 'ADMIN_REVOKE',
    TRANSFER_OUT: 'TRANSFER_OUT'
};

// ═══════════════════════════════════════════════════════════
// 💼 WALLET SERVICE CLASS (RPC-POWERED)
// ═══════════════════════════════════════════════════════════
export class WalletService {

    /**
     * @param {object} supabase - Initialized Supabase client
     */
    constructor(supabase) {
        if (!supabase) {
            throw new Error('WALLET_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 📖 READ OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Get wallet for a user (read-only, doesn't create)
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object|null>} Wallet record or null
     */
    async getWallet(userId) {
        const { data, error } = await this.supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`WALLET_ERROR: ${error.message}`);
        }

        return data;
    }

    /**
     * Get wallet balance
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<number>} Current balance (0 if no wallet)
     */
    async getBalance(userId) {
        const wallet = await this.getWallet(userId);
        return wallet?.balance ?? 0;
    }

    /**
     * Get transaction history for a user
     * 
     * @param {string} userId - User UUID
     * @param {object} options - Query options
     * @returns {Promise<object[]>} Transaction records
     */
    async getTransactionHistory(userId, { limit = 50, offset = 0, source = null, type = null } = {}) {
        let query = this.supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (source) query = query.eq('source', source);
        if (type) query = query.eq('type', type);

        const { data, error } = await query;

        if (error) {
            throw new Error(`WALLET_ERROR: Failed to fetch history - ${error.message}`);
        }

        return data || [];
    }

    // ═══════════════════════════════════════════════════════
    // 💎 CREDIT OPERATIONS (RPC)
    // ═══════════════════════════════════════════════════════

    /**
     * Credit diamonds to a wallet (ATOMIC via RPC)
     * 
     * @param {string} userId - User UUID
     * @param {number} amount - Amount to credit
     * @param {string} source - Transaction source
     * @param {object} options - Additional options
     * @returns {Promise<object>} RPC result
     */
    async credit(userId, amount, source, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_mint_diamonds_atomic', {
            p_user_id: userId,
            p_amount: amount,
            p_source: source,
            p_reference_id: options.referenceId || null,
            p_reference_type: options.referenceType || null,
            p_metadata: options.metadata || {}
        });

        if (error) {
            throw new Error(`WALLET_ERROR: RPC failed - ${error.message}`);
        }

        // RPC returns JSONB, parse if needed
        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message
            };
        }

        return {
            success: true,
            type: 'CREDIT',
            amount: result.amount,
            balanceBefore: result.balance_before,
            balanceAfter: result.balance_after,
            walletId: result.wallet_id,
            transactionId: result.transaction_id,
            walletCreated: result.wallet_created
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💸 DEBIT OPERATIONS (RPC)
    // ═══════════════════════════════════════════════════════

    /**
     * Debit diamonds from a wallet (ATOMIC via RPC)
     * 
     * @param {string} userId - User UUID
     * @param {number} amount - Amount to debit
     * @param {string} source - Transaction source
     * @param {object} options - Additional options
     * @returns {Promise<object>} RPC result
     */
    async debit(userId, amount, source, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_burn_diamonds_atomic', {
            p_user_id: userId,
            p_amount: amount,
            p_source: source,
            p_reference_id: options.referenceId || null,
            p_reference_type: options.referenceType || null,
            p_metadata: options.metadata || {}
        });

        if (error) {
            throw new Error(`WALLET_ERROR: RPC failed - ${error.message}`);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message,
                currentBalance: result.current_balance,
                requiredAmount: result.required_amount,
                shortfall: result.shortfall
            };
        }

        return {
            success: true,
            type: 'DEBIT',
            amount: result.amount,
            balanceBefore: result.balance_before,
            balanceAfter: result.balance_after,
            walletId: result.wallet_id,
            transactionId: result.transaction_id
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔁 TRANSFER OPERATIONS (RPC)
    // ═══════════════════════════════════════════════════════

    /**
     * Transfer diamonds between users (ATOMIC via RPC)
     * 
     * @param {string} fromUserId - Sender UUID
     * @param {string} toUserId - Recipient UUID
     * @param {number} amount - Amount to transfer
     * @param {object} metadata - Additional context
     * @returns {Promise<object>} Transfer result
     */
    async transfer(fromUserId, toUserId, amount, metadata = {}) {
        const { data, error } = await this.supabase.rpc('fn_transfer_diamonds_atomic', {
            p_from_user_id: fromUserId,
            p_to_user_id: toUserId,
            p_amount: amount,
            p_metadata: metadata
        });

        if (error) {
            throw new Error(`WALLET_ERROR: RPC failed - ${error.message}`);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message
            };
        }

        return {
            success: true,
            amount: result.amount,
            fromUser: result.from_user,
            toUser: result.to_user,
            debitTransactionId: result.debit_transaction,
            creditTransactionId: result.credit_transaction,
            senderBalance: result.sender_balance,
            recipientBalance: result.recipient_balance
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎮 ARCADE INTEGRATION (Convenience Methods)
    // ═══════════════════════════════════════════════════════

    /**
     * Stake diamonds for arcade entry
     * 
     * @param {string} userId - User UUID
     * @param {number} stakeAmount - Amount to stake
     * @param {string} gameMode - Arcade game mode
     * @param {string} sessionId - Game session ID
     * @returns {Promise<object>} Stake result
     */
    async stakeForArcade(userId, stakeAmount, gameMode, sessionId) {
        return this.debit(userId, stakeAmount, TX_SOURCES.ARCADE_STAKE, {
            referenceId: sessionId,
            referenceType: 'ARCADE_SESSION',
            metadata: { gameMode }
        });
    }

    /**
     * Award arcade winnings
     * 
     * @param {string} userId - User UUID
     * @param {number} winAmount - Amount won
     * @param {string} sessionId - Game session ID
     * @param {object} gameResult - Game result data
     * @returns {Promise<object>} Payout result
     */
    async payoutArcadeWin(userId, winAmount, sessionId, gameResult = {}) {
        return this.credit(userId, winAmount, TX_SOURCES.ARCADE_WIN, {
            referenceId: sessionId,
            referenceType: 'ARCADE_SESSION',
            metadata: gameResult
        });
    }

    /**
     * Process session reward (training completion)
     * 
     * @param {string} userId - User UUID
     * @param {number} rewardAmount - Calculated reward
     * @param {string} sessionId - Session ID
     * @param {object} sessionData - Session performance data
     * @returns {Promise<object>} Reward result
     */
    async rewardSession(userId, rewardAmount, sessionId, sessionData = {}) {
        return this.credit(userId, rewardAmount, TX_SOURCES.SESSION_REWARD, {
            referenceId: sessionId,
            referenceType: 'TRAINING_SESSION',
            metadata: sessionData
        });
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════
export default WalletService;
