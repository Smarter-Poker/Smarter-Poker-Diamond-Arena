/**
 * 🎰 YELLOW ADDICTION ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_ADDICTION_ENGINE (TASKS 7-9)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 07: STREAK_FIRE_MULTIPLIER_UI_HOOK
 * Task 08: THE DIAMOND_CHEST_VAULT
 * Task 09: ECONOMY_HEALTH_AUDIT_LOG
 * 
 * @target Engagement & Retention Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ADDICTION ENGINE CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ADDICTION_ENGINE_CONFIG = {
    // Task 07: Fire Visuals
    FIRE_TIERS: [
        { minDays: 0, intensity: 'NONE', color: 'GRAY', hex: '#6B7280', tier: 'COLD', emoji: '❄️' },
        { minDays: 1, intensity: 'LOW', color: 'ORANGE', hex: '#F97316', tier: 'WARMING', emoji: '🌡️' },
        { minDays: 3, intensity: 'MEDIUM', color: 'BLUE', hex: '#3B82F6', tier: 'BLUE_FIRE', emoji: '🔵' },
        { minDays: 7, intensity: 'HIGH', color: 'GOLD', hex: '#F59E0B', tier: 'GOLD_FIRE', emoji: '🟡' },
        { minDays: 14, intensity: 'VERY_HIGH', color: 'PURPLE', hex: '#8B5CF6', tier: 'PURPLE_FIRE', emoji: '🟣' },
        { minDays: 30, intensity: 'MAXIMUM', color: 'RAINBOW', hex: '#EC4899', tier: 'LEGENDARY_FIRE', emoji: '👑' }
    ],

    // Task 08: Loot Table
    LOOT_TABLE: [
        { tier: 'COMMON', dropRate: 60.00, minDiamonds: 5, maxDiamonds: 15, minAccuracy: 0.85, requiresPerfect: false, emoji: '📦' },
        { tier: 'UNCOMMON', dropRate: 25.00, minDiamonds: 15, maxDiamonds: 35, minAccuracy: 0.90, requiresPerfect: false, emoji: '🗃️' },
        { tier: 'RARE', dropRate: 10.00, minDiamonds: 35, maxDiamonds: 75, minAccuracy: 0.95, requiresPerfect: false, emoji: '✨' },
        { tier: 'EPIC', dropRate: 4.00, minDiamonds: 75, maxDiamonds: 150, minAccuracy: 0.98, requiresPerfect: false, emoji: '💎' },
        { tier: 'LEGENDARY', dropRate: 1.00, minDiamonds: 150, maxDiamonds: 500, minAccuracy: 1.00, requiresPerfect: true, emoji: '🎰' },
        { tier: 'MYTHIC', dropRate: 0.10, minDiamonds: 500, maxDiamonds: 2000, minAccuracy: 1.00, requiresPerfect: true, emoji: '🌟', minStreak: 30 }
    ],

    // Task 09: Economy Health Thresholds
    HEALTH: {
        VARIANCE_WARNING: 100,
        VARIANCE_CRITICAL: 1000
    }
};

// ═══════════════════════════════════════════════════════════
// 🎰 YELLOW ADDICTION ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowAddictionEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ADDICTION_ENGINE_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 07: STREAK FIRE VISUALS
    // ═══════════════════════════════════════════════════════

    /**
     * Get fire intensity visuals for streak (via RPC)
     * Returns Blue/Gold/Purple fire metadata for UI
     * 
     * @param {number} streakDays - Current streak days
     * @returns {Promise<object>} Fire visual metadata
     */
    async getStreakFireVisuals(streakDays) {
        const { data, error } = await this.supabase.rpc('fn_get_streak_fire_visuals', {
            p_streak_days: streakDays
        });

        if (error) {
            // Fallback to local calculation
            return YellowAddictionEngine.getFireVisualsLocal(streakDays);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Get fire visuals locally (no database call)
     * 
     * @param {number} streakDays - Current streak days
     * @returns {object} Fire visual metadata
     */
    static getFireVisualsLocal(streakDays) {
        const tiers = ADDICTION_ENGINE_CONFIG.FIRE_TIERS;
        const days = Math.max(0, Math.floor(streakDays));

        // Find current tier
        let currentTier = tiers[0];
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (days >= tiers[i].minDays) {
                currentTier = tiers[i];
                break;
            }
        }

        // Find next tier
        const nextTier = tiers.find(t => t.minDays > days) || null;

        // Calculate progress to next
        const progressPercent = nextTier
            ? Math.min(100, ((days - currentTier.minDays) / (nextTier.minDays - currentTier.minDays)) * 100)
            : 100;

        return {
            streak_days: days,
            fire: {
                intensity: currentTier.intensity,
                color: currentTier.color,
                hex: currentTier.hex
            },
            display: {
                tier_name: currentTier.tier,
                emoji: currentTier.emoji
            },
            progress: {
                current_tier: currentTier.tier,
                next_tier: nextTier?.tier || null,
                next_color: nextTier?.color || null,
                days_to_next: nextTier ? nextTier.minDays - days : 0,
                progress_percent: Math.round(progressPercent * 10) / 10
            }
        };
    }

    /**
     * Get fire color for CSS styling
     * 
     * @param {number} streakDays - Current streak days
     * @returns {string} Hex color code
     */
    static getFireColor(streakDays) {
        const visuals = YellowAddictionEngine.getFireVisualsLocal(streakDays);
        return visuals.fire.hex;
    }

    // ═══════════════════════════════════════════════════════
    // 🎰 TASK 08: DIAMOND CHEST VAULT
    // ═══════════════════════════════════════════════════════

    /**
     * Roll for chest reward on training completion
     * 
     * @param {string} userId - User UUID
     * @param {number} accuracy - Session accuracy (0-1)
     * @param {number} streakDays - Current streak days
     * @param {string} sessionId - Session UUID
     * @returns {Promise<object>} Chest roll result
     */
    async rollChestReward(userId, accuracy, streakDays = 0, sessionId = null) {
        const { data, error } = await this.supabase.rpc('fn_roll_chest_reward', {
            p_user_id: userId,
            p_accuracy: accuracy,
            p_streak_days: streakDays,
            p_session_id: sessionId
        });

        if (error) {
            // Fallback to local roll
            return YellowAddictionEngine.rollChestLocal(accuracy, streakDays);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        // If chest was awarded, record it
        if (result.rolled && result.chest) {
            await this.recordChestDrop(userId, sessionId, result);
        }

        return result;
    }

    /**
     * Roll for chest locally (no database call)
     * 
     * @param {number} accuracy - Session accuracy
     * @param {number} streakDays - Current streak days
     * @returns {object} Chest roll result
     */
    static rollChestLocal(accuracy, streakDays = 0) {
        const lootTable = ADDICTION_ENGINE_CONFIG.LOOT_TABLE;
        const isPerfect = accuracy >= 1.0;
        const roll = Math.random() * 100;

        // Filter eligible tiers
        const eligibleTiers = lootTable.filter(tier =>
            accuracy >= tier.minAccuracy &&
            (!tier.requiresPerfect || isPerfect) &&
            (!tier.minStreak || streakDays >= tier.minStreak)
        );

        // Roll through tiers
        let cumulative = 0;
        for (const tier of eligibleTiers.slice().reverse()) { // Highest first
            cumulative += tier.dropRate;
            if (roll <= cumulative) {
                const diamonds = tier.minDiamonds +
                    Math.floor(Math.random() * (tier.maxDiamonds - tier.minDiamonds + 1));

                return {
                    success: true,
                    rolled: true,
                    chest: {
                        tier: tier.tier,
                        emoji: tier.emoji
                    },
                    reward: {
                        diamonds,
                        is_jackpot: tier.requiresPerfect,
                        drop_rate: `${tier.dropRate}%`
                    },
                    session: {
                        accuracy: `${(accuracy * 100).toFixed(1)}%`,
                        is_perfect: isPerfect,
                        streak_days: streakDays
                    }
                };
            }
        }

        return {
            success: true,
            rolled: false,
            reason: accuracy < 0.85 ? 'ACCURACY_TOO_LOW' : 'NO_DROP',
            accuracy: `${(accuracy * 100).toFixed(1)}%`
        };
    }

    /**
     * Record chest drop in history
     * 
     * @param {string} userId - User UUID
     * @param {string} sessionId - Session UUID
     * @param {object} rollResult - Roll result
     * @returns {Promise<void>}
     */
    async recordChestDrop(userId, sessionId, rollResult) {
        if (!rollResult.rolled || !rollResult.chest) return;

        await this.supabase
            .from('chest_drop_history')
            .insert({
                user_id: userId,
                session_id: sessionId,
                chest_tier: rollResult.chest.tier,
                diamonds_awarded: rollResult.reward.diamonds,
                is_jackpot: rollResult.reward.is_jackpot,
                accuracy: parseFloat(rollResult.session.accuracy) / 100,
                streak_days: rollResult.session.streak_days
            });
    }

    /**
     * Get user's jackpot history
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Jackpot history
     */
    async getJackpotHistory(userId) {
        const { data, error } = await this.supabase
            .from('chest_drop_history')
            .select('*')
            .eq('user_id', userId)
            .eq('is_jackpot', true)
            .order('dropped_at', { ascending: false });

        return {
            success: !error,
            jackpots: data || [],
            totalJackpots: data?.length || 0,
            totalDiamondsFromJackpots: data?.reduce((sum, j) => sum + j.diamonds_awarded, 0) || 0
        };
    }

    /**
     * Preview potential chest rewards for accuracy
     * 
     * @param {number} accuracy - Target accuracy
     * @returns {array} Eligible chest tiers
     */
    static previewChestTiers(accuracy) {
        return ADDICTION_ENGINE_CONFIG.LOOT_TABLE
            .filter(tier => accuracy >= tier.minAccuracy)
            .map(tier => ({
                tier: tier.tier,
                emoji: tier.emoji,
                dropRate: `${tier.dropRate}%`,
                diamondRange: `${tier.minDiamonds}-${tier.maxDiamonds}`,
                requiresPerfect: tier.requiresPerfect
            }));
    }

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 09: ECONOMY HEALTH AUDIT
    // ═══════════════════════════════════════════════════════

    /**
     * Run economy health audit
     * HARD LAW: balances + burn + escrow = total_minted
     * 
     * @returns {Promise<object>} Audit result
     */
    async auditEconomyHealth() {
        const { data, error } = await this.supabase.rpc('fn_audit_economy_health');

        if (error) {
            return {
                success: false,
                error: 'AUDIT_FAILED',
                message: error.message
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Get latest economy health status
     * 
     * @returns {Promise<object>} Health status
     */
    async getEconomyHealthStatus() {
        const { data, error } = await this.supabase
            .from('economy_health_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            health: {
                isBalanced: data.is_balanced,
                variance: data.variance,
                status: this.determineHealthStatus(data.variance),
                totals: {
                    userBalances: data.total_user_balances,
                    burned: data.total_burned,
                    inEscrow: data.total_in_escrow,
                    totalMinted: data.total_minted
                },
                lastAuditAt: data.last_audit_at,
                auditCount: data.audit_count
            },
            hardLaw: 'LEDGER_CONSISTENCY_MONITOR'
        };
    }

    /**
     * Determine health status from variance
     * 
     * @param {number} variance - Current variance
     * @returns {string} Health status
     */
    determineHealthStatus(variance) {
        const absVariance = Math.abs(variance);
        if (absVariance === 0) return 'HEALTHY';
        if (absVariance <= ADDICTION_ENGINE_CONFIG.HEALTH.VARIANCE_WARNING) return 'WARNING';
        if (absVariance <= ADDICTION_ENGINE_CONFIG.HEALTH.VARIANCE_CRITICAL) return 'CRITICAL';
        return 'EMERGENCY';
    }

    /**
     * Get audit history
     * 
     * @param {number} limit - Max records
     * @returns {Promise<object>} Audit history
     */
    async getAuditHistory(limit = 10) {
        const { data, error } = await this.supabase
            .from('ledger_consistency_log')
            .select('*')
            .order('audited_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            audits: data || [],
            count: data?.length || 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ENGINE STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get addiction engine status
     * 
     * @returns {Promise<object>} Engine status
     */
    async getEngineStatus() {
        const { data, error } = await this.supabase
            .from('yellow_addiction_engine_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task07_fireVisuals: {
                    tiers: data.fire_visual_tiers,
                    functionExists: data.fire_visuals_function
                },
                task08_chestVault: {
                    lootTiers: data.loot_table_tiers,
                    totalJackpots: data.total_jackpots_dropped
                },
                task09_economyHealth: {
                    lastStatus: data.last_health_status,
                    isBalanced: data.economy_balanced,
                    variance: data.current_variance
                },
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowAddictionEngine;
