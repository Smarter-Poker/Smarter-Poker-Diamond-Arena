/**
 * 🎮 ARCADE ESCROW SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Lock diamonds in temporary vault when Arcade starts.
 * On win: release to player.
 * On loss: move to system pool.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ESCROW STATUS ENUM
// ═══════════════════════════════════════════════════════════

export const ESCROW_STATUS = {
    LOCKED: 'LOCKED',
    RELEASED: 'RELEASED',
    FORFEITED: 'FORFEITED',
    EXPIRED: 'EXPIRED',
    CANCELLED: 'CANCELLED'
};

// ═══════════════════════════════════════════════════════════
// 🎮 ARCADE ESCROW SERVICE CLASS
// ═══════════════════════════════════════════════════════════

export class ArcadeEscrowService {

    constructor(supabase) {
        if (!supabase) {
            throw new Error('ESCROW_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 🔒 LOCK ESCROW
    // ═══════════════════════════════════════════════════════

    /**
     * Lock diamonds in escrow when arcade game starts
     * 
     * @param {string} userId - Player UUID
     * @param {string} sessionId - Game session UUID
     * @param {number} stakeAmount - Amount to stake
     * @param {string} gameMode - Arcade game mode
     * @param {object} options - Additional options
     * @returns {Promise<object>} Escrow lock result
     */
    async lockBet(userId, sessionId, stakeAmount, gameMode, options = {}) {
        const { data, error } = await this.supabase.rpc('fn_escrow_arcade_bet', {
            p_user_id: userId,
            p_session_id: sessionId,
            p_stake_amount: stakeAmount,
            p_game_mode: gameMode,
            p_potential_multiplier: options.potentialMultiplier || 2.0,
            p_expiry_minutes: options.expiryMinutes || 60
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'ESCROW_FAILED'
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
            escrow: {
                escrowId: result.escrow.escrow_id,
                sessionId: result.escrow.session_id,
                stakeAmount: result.escrow.stake_amount,
                potentialWin: result.escrow.potential_win,
                gameMode: result.escrow.game_mode,
                expiresAt: result.escrow.expires_at
            },
            wallet: {
                balanceBefore: result.wallet.balance_before,
                balanceAfter: result.wallet.balance_after,
                transactionId: result.wallet.transaction_id
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🏆 RESOLVE WIN
    // ═══════════════════════════════════════════════════════

    /**
     * Release escrow + winnings to player on win
     * 
     * @param {string} sessionId - Game session UUID
     * @param {number} winAmount - Amount won (in addition to stake)
     * @param {object} resultData - Game result data
     * @returns {Promise<object>} Win resolution result
     */
    async resolveWin(sessionId, winAmount, resultData = {}) {
        const { data, error } = await this.supabase.rpc('fn_resolve_arcade_win', {
            p_session_id: sessionId,
            p_win_amount: winAmount,
            p_result_data: resultData
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'WIN_RESOLVE_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                currentStatus: result.current_status
            };
        }

        return {
            success: true,
            status: result.status,
            payout: {
                originalStake: result.payout.original_stake,
                winAmount: result.payout.win_amount,
                totalPayout: result.payout.total_payout
            },
            wallet: {
                newBalance: result.wallet.new_balance,
                transactionId: result.wallet.transaction_id
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💔 RESOLVE LOSS
    // ═══════════════════════════════════════════════════════

    /**
     * Forfeit escrow to system pool on loss
     * 
     * @param {string} sessionId - Game session UUID
     * @param {object} resultData - Game result data
     * @returns {Promise<object>} Loss resolution result
     */
    async resolveLoss(sessionId, resultData = {}) {
        const { data, error } = await this.supabase.rpc('fn_resolve_arcade_loss', {
            p_session_id: sessionId,
            p_result_data: resultData
        });

        if (error) {
            return {
                success: false,
                error: error.message,
                status: 'LOSS_RESOLVE_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                currentStatus: result.current_status
            };
        }

        return {
            success: true,
            status: result.status,
            forfeited: {
                stakeAmount: result.forfeited.stake_amount,
                toPool: result.forfeited.to_pool,
                userId: result.forfeited.user_id,
                gameMode: result.forfeited.game_mode
            },
            transactionId: result.transaction_id
        };
    }

    // ═══════════════════════════════════════════════════════
    // ❌ CANCEL ESCROW
    // ═══════════════════════════════════════════════════════

    /**
     * Cancel and refund escrow
     * 
     * @param {string} sessionId - Game session UUID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<object>} Cancellation result
     */
    async cancelEscrow(sessionId, reason = 'USER_CANCELLED') {
        const { data, error } = await this.supabase.rpc('fn_cancel_arcade_escrow', {
            p_session_id: sessionId,
            p_reason: reason
        });

        if (error) {
            return {
                success: false,
                error: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            success: result.success,
            status: result.status,
            refunded: result.refunded,
            newBalance: result.new_balance,
            transactionId: result.transaction_id,
            error: result.error
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📖 READ OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Get active escrows for a user
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object[]>} Active escrow records
     */
    async getActiveEscrows(userId) {
        const { data, error } = await this.supabase
            .from('arcade_escrow')
            .select('*')
            .eq('user_id', userId)
            .eq('status', ESCROW_STATUS.LOCKED)
            .order('locked_at', { ascending: false });

        if (error) {
            throw new Error(`ESCROW_ERROR: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get escrow by session ID
     * 
     * @param {string} sessionId - Session UUID
     * @returns {Promise<object|null>} Escrow record
     */
    async getEscrowBySession(sessionId) {
        const { data, error } = await this.supabase
            .from('arcade_escrow')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`ESCROW_ERROR: ${error.message}`);
        }

        return data;
    }

    /**
     * Get user's escrow history
     * 
     * @param {string} userId - User UUID
     * @param {object} options - Query options
     * @returns {Promise<object[]>} Escrow history
     */
    async getEscrowHistory(userId, { limit = 50, status = null } = {}) {
        let query = this.supabase
            .from('arcade_escrow')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`ESCROW_ERROR: ${error.message}`);
        }

        return data || [];
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STATISTICS
    // ═══════════════════════════════════════════════════════

    /**
     * Get user's arcade wagering statistics
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Wagering stats
     */
    async getWageringStats(userId) {
        const history = await this.getEscrowHistory(userId, { limit: 1000 });

        const stats = {
            totalGames: history.length,
            wins: 0,
            losses: 0,
            cancelled: 0,
            totalStaked: 0,
            totalWon: 0,
            totalLost: 0,
            netResult: 0
        };

        for (const escrow of history) {
            stats.totalStaked += escrow.stake_amount;

            if (escrow.status === ESCROW_STATUS.RELEASED) {
                stats.wins++;
                const winAmount = escrow.result_data?.win_amount || 0;
                stats.totalWon += escrow.stake_amount + winAmount;
            } else if (escrow.status === ESCROW_STATUS.FORFEITED) {
                stats.losses++;
                stats.totalLost += escrow.stake_amount;
            } else if (escrow.status === ESCROW_STATUS.CANCELLED) {
                stats.cancelled++;
            }
        }

        stats.netResult = stats.totalWon - stats.totalStaked;
        stats.winRate = stats.totalGames > 0
            ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1) + '%'
            : '0%';

        return stats;
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default ArcadeEscrowService;
