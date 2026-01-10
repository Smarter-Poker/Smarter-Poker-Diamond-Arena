/**
 * ✨ YELLOW VISUAL ADDICTION ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_VISUAL_ADDICTION (TASKS 19-21)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 19: DIAMOND_MINT_PARTICLE_SYSTEM
 * Task 20: MULTIPLIER_FIRE_UI_SYNC
 * Task 21: ECONOMY_SUPPLY_BURN_TICKER
 * 
 * @target Visual Feedback Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ VISUAL ADDICTION CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const VISUAL_ADDICTION_CONFIG = {
    // Task 19: Particle System
    PARTICLES: {
        TIERS: [
            { tier: 'TINY', min: 1, max: 5, particles: 5, color: '#94A3B8', emoji: '💠' },
            { tier: 'SMALL', min: 6, max: 15, particles: 12, color: '#60A5FA', emoji: '💎' },
            { tier: 'MEDIUM', min: 16, max: 50, particles: 25, color: '#3B82F6', emoji: '💎✨' },
            { tier: 'LARGE', min: 51, max: 100, particles: 40, color: '#F59E0B', emoji: '💎🔥' },
            { tier: 'EPIC', min: 101, max: 250, particles: 60, color: '#8B5CF6', emoji: '💎💎' },
            { tier: 'LEGENDARY', min: 251, max: 500, particles: 100, color: '#EC4899', emoji: '👑💎' },
            { tier: 'MYTHIC', min: 501, max: null, particles: 150, color: '#F472B6', emoji: '🌟💎👑' }
        ],
        JACKPOT_TIERS: ['LEGENDARY', 'MYTHIC']
    },

    // Task 20: Fire Overlay
    FIRE_OVERLAY: {
        TIERS: [
            { tier: 'COLD', minDays: 0, multiplier: 1.00, icon: '❄️', color: '#9CA3AF' },
            { tier: 'WARMING_UP', minDays: 1, multiplier: 1.10, icon: '🌡️', color: '#F97316' },
            { tier: 'WARMING', minDays: 3, multiplier: 1.20, icon: '🔥', color: '#F59E0B' },
            { tier: 'HOT', minDays: 7, multiplier: 1.50, icon: '🔥🔥', color: '#EF4444' },
            { tier: 'BLAZING', minDays: 14, multiplier: 1.75, icon: '🔥🔥🔥', color: '#EC4899' },
            { tier: 'LEGENDARY', minDays: 30, multiplier: 2.00, icon: '👑🔥', color: '#8B5CF6' }
        ]
    },

    // Task 21: Burn Ticker
    BURN_TICKER: {
        REFRESH_INTERVAL_MS: 5000,
        ANIMATION_DURATION_MS: 1000,
        BURN_LAW: 0.25  // 25%
    }
};

// ═══════════════════════════════════════════════════════════
// ✨ YELLOW VISUAL ADDICTION ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowVisualAddictionEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('VISUAL_ADDICTION_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // ✨ TASK 19: DIAMOND MINT PARTICLE SYSTEM
    // ═══════════════════════════════════════════════════════

    /**
     * Get reward burst particle data
     * 
     * @param {number} diamondCount - Number of diamonds earned
     * @param {string} source - Reward source
     * @returns {Promise<object>} Particle burst data
     */
    async getRewardBurstData(diamondCount, source = 'REWARD') {
        const { data, error } = await this.supabase.rpc('fn_get_reward_burst_data', {
            p_diamond_count: diamondCount,
            p_source: source
        });

        if (error) {
            // Fallback to local
            return { success: true, ...YellowVisualAddictionEngine.getRewardBurstLocal(diamondCount, source) };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Get reward burst data locally
     * 
     * @param {number} diamondCount - Number of diamonds
     * @param {string} source - Reward source
     * @returns {object} Particle data
     */
    static getRewardBurstLocal(diamondCount, source = 'REWARD') {
        const tiers = VISUAL_ADDICTION_CONFIG.PARTICLES.TIERS;

        // Find matching tier
        let tier = tiers[0];
        for (const t of tiers) {
            if (diamondCount >= t.min && (t.max === null || diamondCount <= t.max)) {
                tier = t;
            }
        }

        const isJackpot = VISUAL_ADDICTION_CONFIG.PARTICLES.JACKPOT_TIERS.includes(tier.tier);

        return {
            reward_burst: {
                count: diamondCount,
                rarity_type: tier.tier,
                rarity_index: tiers.indexOf(tier) + 1,
                is_jackpot: isJackpot
            },
            particles: {
                count: tier.particles,
                color: tier.color,
                size: diamondCount > 100 ? 'LARGE' : diamondCount > 50 ? 'MEDIUM' : 'SMALL',
                intensity: isJackpot ? 'MAXIMUM' : diamondCount > 50 ? 'HIGH' : 'MEDIUM'
            },
            display: {
                emoji: tier.emoji,
                label: `${tier.tier} Reward`,
                source
            },
            visual_cue: `${tier.emoji} +${diamondCount} 💎`
        };
    }

    /**
     * Get particle tier for amount
     * 
     * @param {number} amount - Diamond amount
     * @returns {object} Tier info
     */
    static getParticleTier(amount) {
        const tiers = VISUAL_ADDICTION_CONFIG.PARTICLES.TIERS;

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (amount >= tiers[i].min) {
                return tiers[i];
            }
        }
        return tiers[0];
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 20: MULTIPLIER FIRE UI SYNC
    // ═══════════════════════════════════════════════════════

    /**
     * Get fire bonus overlay for payout
     * 
     * @param {string} userId - User UUID
     * @param {number} payoutAmount - Total payout
     * @returns {Promise<object>} Overlay data
     */
    async getFireBonusOverlay(userId, payoutAmount) {
        const { data, error } = await this.supabase.rpc('fn_get_fire_bonus_overlay', {
            p_user_id: userId,
            p_payout_amount: payoutAmount
        });

        if (error) {
            // Fallback to local with streak 0
            return { success: true, ...YellowVisualAddictionEngine.getFireOverlayLocal(0, payoutAmount) };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Get fire overlay data locally
     * 
     * @param {number} streakDays - Current streak
     * @param {number} payoutAmount - Payout amount
     * @returns {object} Overlay data
     */
    static getFireOverlayLocal(streakDays, payoutAmount) {
        const tiers = VISUAL_ADDICTION_CONFIG.FIRE_OVERLAY.TIERS;

        // Find matching tier
        let overlay = tiers[0];
        for (const t of tiers) {
            if (streakDays >= t.minDays) {
                overlay = t;
            }
        }

        const baseReward = overlay.multiplier > 1
            ? Math.floor(payoutAmount / overlay.multiplier)
            : payoutAmount;
        const streakBonus = payoutAmount - baseReward;

        return {
            fire_bonus_overlay: {
                active: streakDays >= 1,
                tier: overlay.tier,
                streak_days: streakDays,
                multiplier: overlay.multiplier
            },
            icon: {
                emoji: overlay.icon,
                color: overlay.color
            },
            label: {
                text: overlay.multiplier > 1 ? `${overlay.multiplier}×` : '',
                visible: overlay.multiplier > 1
            },
            payout: {
                total: payoutAmount,
                base_reward: baseReward,
                streak_bonus: streakBonus
            }
        };
    }

    /**
     * Get fire overlay tier for streak
     * 
     * @param {number} streakDays - Streak days
     * @returns {object} Tier info
     */
    static getFireTier(streakDays) {
        const tiers = VISUAL_ADDICTION_CONFIG.FIRE_OVERLAY.TIERS;

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (streakDays >= tiers[i].minDays) {
                return tiers[i];
            }
        }
        return tiers[0];
    }

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 21: ECONOMY SUPPLY BURN TICKER
    // ═══════════════════════════════════════════════════════

    /**
     * Get real-time burn ticker data
     * 
     * @returns {Promise<object>} Ticker data
     */
    async getBurnTickerData() {
        const { data, error } = await this.supabase.rpc('fn_get_burn_ticker_data');

        if (error) {
            return {
                success: false,
                error: 'TICKER_FETCH_FAILED',
                message: error.message
            };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Get burn ticker display string
     * 
     * @param {number} totalBurned - Total burned amount
     * @returns {string} Formatted display
     */
    static formatBurnTickerDisplay(totalBurned) {
        const formatted = totalBurned.toLocaleString();
        return `🔥 ${formatted} 💎 burned forever`;
    }

    /**
     * Subscribe to burn ticker updates (polling)
     * 
     * @param {function} callback - Update callback
     * @param {number} intervalMs - Poll interval
     * @returns {function} Unsubscribe function
     */
    subscribeToBurnTicker(callback, intervalMs = 5000) {
        const poll = async () => {
            const data = await this.getBurnTickerData();
            callback(data);
        };

        // Initial fetch
        poll();

        // Set up polling
        const interval = setInterval(poll, intervalMs);

        // Return unsubscribe function
        return () => clearInterval(interval);
    }

    /**
     * Get burn ticker snapshot history
     * 
     * @param {number} limit - Max records
     * @returns {Promise<object>} Snapshot history
     */
    async getBurnTickerHistory(limit = 20) {
        const { data, error } = await this.supabase
            .from('burn_ticker_snapshots')
            .select('*')
            .order('snapshot_at', { ascending: false })
            .limit(limit);

        return {
            success: !error,
            snapshots: data || [],
            count: data?.length || 0
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎮 COMBINED VISUAL DATA
    // ═══════════════════════════════════════════════════════

    /**
     * Get all visual data for a payout event
     * 
     * @param {string} userId - User UUID
     * @param {number} payoutAmount - Payout amount
     * @param {number} streakDays - Current streak (optional)
     * @returns {Promise<object>} Combined visual data
     */
    async getPayoutVisuals(userId, payoutAmount, streakDays = null) {
        const [burstData, overlayData, tickerData] = await Promise.all([
            this.getRewardBurstData(payoutAmount, 'TRAINING'),
            this.getFireBonusOverlay(userId, payoutAmount),
            this.getBurnTickerData()
        ]);

        return {
            success: true,
            particles: burstData,
            overlay: overlayData,
            ticker: tickerData.ticker,
            combined: {
                display: `${burstData.visual_cue || burstData.display?.emoji + '+' + payoutAmount}`,
                is_jackpot: burstData.reward_burst?.is_jackpot || false,
                has_multiplier: (overlayData.fire_bonus_overlay?.multiplier || 1) > 1
            }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 ENGINE STATUS
    // ═══════════════════════════════════════════════════════

    /**
     * Get visual addiction engine status
     * 
     * @returns {Promise<object>} Engine status
     */
    async getVisualStatus() {
        const { data, error } = await this.supabase
            .from('yellow_visual_addiction_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task19_particles: data.particle_system_active,
                task19_configs: data.particle_configs,
                task20_overlay: data.fire_overlay_active,
                task20_configs: data.overlay_configs,
                task21_ticker: data.burn_ticker_active,
                task21_snapshots: data.ticker_snapshots,
                currentBurnTotal: data.current_burn_total,
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowVisualAddictionEngine;
