/**
 * 🔥 STREAK SERVICE (RPC-POWERED)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * All streak operations now execute via Postgres RPC
 * directly on database metal. Zero network round-trips.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { DiamondMintEngine, STREAK_TIERS } from '../engines/DiamondMintEngine.js';

// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════
export const STREAK_CONFIG = {
    GRACE_PERIOD_HOURS: 48,
    BASE_DAILY_REWARD: 5,
    COMEBACK_BONUS: 3,
    MILESTONE_MULTIPLIERS: {
        7: 2.0,
        14: 2.5,
        30: 3.0,
        100: 5.0
    }
};

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK SERVICE CLASS (RPC-POWERED)
// ═══════════════════════════════════════════════════════════
export class StreakService {

    /**
     * @param {object} supabase - Initialized Supabase client
     */
    constructor(supabase) {
        if (!supabase) {
            throw new Error('STREAK_ERROR: Supabase client is required');
        }
        this.supabase = supabase;
    }

    // ═══════════════════════════════════════════════════════
    // 📖 READ OPERATIONS (RPC)
    // ═══════════════════════════════════════════════════════

    /**
     * Get current streak status for a user (via RPC)
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Streak status
     */
    async getStreakStatus(userId) {
        const { data, error } = await this.supabase.rpc('fn_get_streak_status', {
            p_user_id: userId
        });

        if (error) {
            throw new Error(`STREAK_ERROR: RPC failed - ${error.message}`);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            userId: result.user_id,
            currentStreak: result.current_streak,
            longestStreak: result.longest_streak,
            lastClaim: result.last_claim,
            hoursSinceLastClaim: result.hours_since_claim,
            hoursUntilExpiry: result.hours_until_expiry,
            hoursUntilEligible: result.hours_until_eligible,
            status: result.status,
            canClaim: result.can_claim,
            tier: {
                label: result.tier,
                multiplier: result.multiplier
            },
            balance: result.balance,
            nextTierInfo: DiamondMintEngine.getDaysToNextTier(result.current_streak)
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💎 CLAIM OPERATIONS (RPC)
    // ═══════════════════════════════════════════════════════

    /**
     * Process daily streak claim (ATOMIC via RPC)
     * 
     * @param {string} userId - User UUID
     * @param {object} options - Override default rewards
     * @returns {Promise<object>} Claim result
     */
    async claimDailyReward(userId, options = {}) {
        const baseReward = options.baseReward ?? STREAK_CONFIG.BASE_DAILY_REWARD;
        const comebackBonus = options.comebackBonus ?? STREAK_CONFIG.COMEBACK_BONUS;

        const { data, error } = await this.supabase.rpc('fn_claim_daily_reward', {
            p_user_id: userId,
            p_base_reward: baseReward,
            p_comeback_bonus: comebackBonus
        });

        if (error) {
            throw new Error(`STREAK_ERROR: RPC failed - ${error.message}`);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                message: result.message,
                hoursUntilEligible: result.hours_until_eligible,
                currentStreak: result.current_streak,
                balance: result.balance
            };
        }

        return {
            success: true,
            claim: {
                totalDiamonds: result.claim.total_diamonds,
                baseReward: result.claim.base_reward,
                streakBonus: result.claim.streak_bonus,
                comebackBonus: result.claim.comeback_bonus,
                milestoneBonus: result.claim.milestone_bonus
            },
            streak: {
                previousStreak: result.streak.previous,
                newStreak: result.streak.current,
                longestStreak: result.streak.longest,
                continued: result.streak.continued,
                tier: {
                    label: result.streak.tier,
                    multiplier: result.streak.multiplier
                }
            },
            wallet: {
                newBalance: result.wallet.new_balance,
                transactionId: result.wallet.transaction_id
            },
            nextTierInfo: DiamondMintEngine.getDaysToNextTier(result.streak.current)
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ANALYTICS (Direct Queries)
    // ═══════════════════════════════════════════════════════

    /**
     * Get streak leaderboard
     * 
     * @param {number} limit - Number of top streakers
     * @returns {Promise<object[]>} Leaderboard entries
     */
    async getStreakLeaderboard(limit = 10) {
        const { data, error } = await this.supabase
            .from('wallets')
            .select('user_id, current_streak, longest_streak')
            .gt('current_streak', 0)
            .order('current_streak', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`STREAK_ERROR: Leaderboard query failed - ${error.message}`);
        }

        return data.map((entry, index) => ({
            rank: index + 1,
            userId: entry.user_id,
            currentStreak: entry.current_streak,
            longestStreak: entry.longest_streak,
            tier: DiamondMintEngine.getStreakTier(entry.current_streak)
        }));
    }

    /**
     * Get streak analytics snapshot (from pg_cron generated data)
     * 
     * @param {string} date - Date string (YYYY-MM-DD) or 'latest'
     * @returns {Promise<object>} Analytics snapshot
     */
    async getAnalyticsSnapshot(date = 'latest') {
        let query = this.supabase
            .from('streak_analytics_snapshots')
            .select('*');

        if (date === 'latest') {
            query = query.order('snapshot_date', { ascending: false }).limit(1);
        } else {
            query = query.eq('snapshot_date', date);
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`STREAK_ERROR: Analytics query failed - ${error.message}`);
        }

        return data?.data || null;
    }

    /**
     * Get maintenance log history
     * 
     * @param {number} limit - Number of entries
     * @returns {Promise<object[]>} Maintenance log entries
     */
    async getMaintenanceLog(limit = 24) {
        const { data, error } = await this.supabase
            .from('streak_maintenance_log')
            .select('*')
            .order('run_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`STREAK_ERROR: Maintenance log query failed - ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get next milestone target
     * 
     * @param {number} currentStreak 
     * @returns {object} Next milestone info
     */
    getNextMilestone(currentStreak) {
        const milestones = Object.keys(STREAK_CONFIG.MILESTONE_MULTIPLIERS)
            .map(Number)
            .sort((a, b) => a - b);

        for (const milestone of milestones) {
            if (milestone > currentStreak) {
                return {
                    target: milestone,
                    daysAway: milestone - currentStreak,
                    multiplier: STREAK_CONFIG.MILESTONE_MULTIPLIERS[milestone]
                };
            }
        }

        return { target: null, daysAway: 0, multiplier: null, message: '🏆 All milestones achieved!' };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STREAK STATISTICS
    // ═══════════════════════════════════════════════════════

    /**
     * Get comprehensive streak statistics for a user
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Streak statistics
     */
    async getStreakStats(userId) {
        // Get current status via RPC
        const status = await this.getStreakStatus(userId);

        // Get claim history count
        const { count, error: countError } = await this.supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('source', 'DAILY_CLAIM');

        if (countError) {
            console.warn('Could not fetch claim count:', countError.message);
        }

        // Get total diamonds from claims
        const { data: claimData, error: claimError } = await this.supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('source', 'DAILY_CLAIM');

        const totalDiamondsFromClaims = claimData?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

        return {
            userId,
            currentStreak: status.currentStreak,
            longestStreak: status.longestStreak,
            totalClaims: count || 0,
            totalDiamondsEarned: totalDiamondsFromClaims,
            averagePerClaim: count > 0 ? Math.floor(totalDiamondsFromClaims / count) : 0,
            tier: status.tier,
            canClaim: status.canClaim,
            nextMilestone: this.getNextMilestone(status.currentStreak)
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════
export default StreakService;
