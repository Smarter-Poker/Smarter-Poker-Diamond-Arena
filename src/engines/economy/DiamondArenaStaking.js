/**
 * 💎 DIAMOND ARENA STAKING ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORB_03] Atomic transaction handler for Diamond-based entries
 * and community prize pools.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 * - Atomic stake/unstake operations
 * - Community prize pool accumulation
 * - Entry fee processing with 25% burn
 * - Winner payout distribution
 * 
 * @target Orb 03 - Diamond Arena
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ STAKING CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const STAKING_CONFIG = {
    // Burn rate (HARD LAW)
    BURN_RATE: 0.25,  // 25% of all stakes burned

    // Pool allocation
    POOL_RATE: 0.75,  // 75% goes to prize pool

    // Stake limits
    MIN_STAKE: 10,
    MAX_STAKE: 100000,

    // Pool types
    POOL_TYPES: ['HEADS_UP', 'MULTI_TABLE', 'TOURNAMENT', 'SIT_N_GO', 'CUSTOM'],

    // Payout structures
    PAYOUT_STRUCTURES: {
        HEADS_UP: { 1: 100 },  // Winner takes all
        MULTI_TABLE: { 1: 50, 2: 30, 3: 20 },
        TOURNAMENT: { 1: 40, 2: 25, 3: 15, 4: 10, 5: 10 },
        SIT_N_GO: { 1: 50, 2: 30, 3: 20 }
    }
};

// ═══════════════════════════════════════════════════════════
// 💎 DIAMOND ARENA STAKING CLASS
// ═══════════════════════════════════════════════════════════

export class DiamondArenaStaking {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('STAKING_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🎯 STAKE OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Stake diamonds into arena pool
     * Atomic operation with 25% burn
     * 
     * @param {object} stakeData - Stake parameters
     * @returns {Promise<object>} Stake result
     */
    async stakeToPool(stakeData) {
        const { userId, poolId, amount, poolType = 'HEADS_UP' } = stakeData;

        // Validate amount
        if (amount < STAKING_CONFIG.MIN_STAKE || amount > STAKING_CONFIG.MAX_STAKE) {
            return {
                success: false,
                error: 'INVALID_STAKE_AMOUNT',
                limits: { min: STAKING_CONFIG.MIN_STAKE, max: STAKING_CONFIG.MAX_STAKE }
            };
        }

        // Calculate split
        const burnAmount = Math.floor(amount * STAKING_CONFIG.BURN_RATE);
        const poolAmount = amount - burnAmount;

        const { data, error } = await this.supabase.rpc('fn_stake_to_arena_pool', {
            p_user_id: userId,
            p_pool_id: poolId,
            p_stake_amount: amount,
            p_burn_amount: burnAmount,
            p_pool_amount: poolAmount,
            p_pool_type: poolType
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Withdraw stake from pool (if allowed)
     * 
     * @param {string} stakeId - Stake UUID
     * @returns {Promise<object>} Withdrawal result
     */
    async withdrawStake(stakeId) {
        const { data, error } = await this.supabase.rpc('fn_withdraw_arena_stake', {
            p_stake_id: stakeId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate stake split locally
     * 
     * @param {number} amount - Stake amount
     * @returns {object} Split calculation
     */
    static calculateStakeSplit(amount) {
        const burnAmount = Math.floor(amount * STAKING_CONFIG.BURN_RATE);
        const poolAmount = amount - burnAmount;

        return {
            stakeAmount: amount,
            burnAmount,
            poolAmount,
            burnRate: '25%',
            poolRate: '75%',
            formula: `${amount} = ${burnAmount} (🔥 burn) + ${poolAmount} (🏆 pool)`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🏆 POOL MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Create new prize pool
     * 
     * @param {object} poolData - Pool parameters
     * @returns {Promise<object>} Created pool
     */
    async createPool(poolData) {
        const {
            name,
            poolType = 'HEADS_UP',
            entryFee,
            maxEntrants,
            startTime
        } = poolData;

        const { data, error } = await this.supabase
            .from('arena_prize_pools')
            .insert({
                name,
                pool_type: poolType,
                entry_fee: entryFee,
                max_entrants: maxEntrants,
                start_time: startTime,
                status: 'OPEN',
                total_pool: 0,
                total_burned: 0
            })
            .select()
            .single();

        return { success: !error, pool: data, error: error?.message };
    }

    /**
     * Get pool status
     * 
     * @param {string} poolId - Pool UUID
     * @returns {Promise<object>} Pool status
     */
    async getPoolStatus(poolId) {
        const { data, error } = await this.supabase
            .from('arena_prize_pools')
            .select(`
                *,
                entrants:arena_pool_entries(count),
                stakes:arena_pool_entries(user_id, stake_amount, pool_contribution)
            `)
            .eq('id', poolId)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            pool: data,
            entrantCount: data.entrants?.length || 0,
            prizePool: data.total_pool
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💰 PAYOUT OPERATIONS
    // ═══════════════════════════════════════════════════════

    /**
     * Distribute winnings to pool winners
     * 
     * @param {object} payoutData - Payout parameters
     * @returns {Promise<object>} Payout result
     */
    async distributeWinnings(payoutData) {
        const { poolId, rankings } = payoutData;  // rankings: [{userId, place}, ...]

        const { data, error } = await this.supabase.rpc('fn_distribute_arena_winnings', {
            p_pool_id: poolId,
            p_rankings: rankings
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate payout distribution locally
     * 
     * @param {number} prizePool - Total pool
     * @param {string} poolType - Pool type
     * @returns {object} Payout breakdown
     */
    static calculatePayoutDistribution(prizePool, poolType) {
        const structure = STAKING_CONFIG.PAYOUT_STRUCTURES[poolType] ||
            STAKING_CONFIG.PAYOUT_STRUCTURES.HEADS_UP;

        const payouts = {};
        let totalPaid = 0;

        for (const [place, percent] of Object.entries(structure)) {
            const amount = Math.floor(prizePool * (percent / 100));
            payouts[place] = { percent: `${percent}%`, amount };
            totalPaid += amount;
        }

        return {
            prizePool,
            poolType,
            payouts,
            totalPaid,
            remainder: prizePool - totalPaid
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ANALYTICS
    // ═══════════════════════════════════════════════════════

    /**
     * Get user's staking history
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Staking history
     */
    async getUserStakingHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('arena_pool_entries')
            .select('*, pool:arena_prize_pools(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        const totalStaked = (data || []).reduce((sum, e) => sum + e.stake_amount, 0);
        const totalWon = (data || []).reduce((sum, e) => sum + (e.winnings || 0), 0);

        return {
            success: !error,
            entries: data || [],
            stats: { totalStaked, totalWon, netResult: totalWon - totalStaked }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default DiamondArenaStaking;
