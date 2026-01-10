/**
 * 🛡️ YELLOW ACTIVE LOGIC ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MILITARY_PAYLOAD: YELLOW_ACTIVE_LOGIC (TASKS 4-6)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 04: THE 25_PERCENT_BURN_ENFORCER
 * Task 05: STREAK_MULTIPLIER_CALCULATOR
 * Task 06: ATOMIC_MINT_SECURITY_GUARD
 * 
 * @target Orb #7 (Arcade) | Orb #10 (Marketplace)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ACTIVE LOGIC CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ACTIVE_LOGIC_CONFIG = {
    // Task 04: Burn Enforcer
    BURN: {
        PERCENTAGE: 0.25,           // HARD LAW: 25%
        SELLER_PERCENTAGE: 0.75,    // HARD LAW: 75%
        MIN_BURN_AMOUNT: 4,         // Minimum sale to trigger 1 diamond burn
        BURN_VAULT_USER: '00000000-0000-0000-0000-000000000000'
    },

    // Task 05: Streak Multipliers (HARD LAW)
    STREAK: {
        DAY_3_MULTIPLIER: 1.20,     // HARD LAW
        DAY_7_MULTIPLIER: 1.50,     // HARD LAW
        DAY_30_MULTIPLIER: 2.00,    // HARD LAW
        TIERS: [
            { minDays: 0, multiplier: 1.00, tier: 'COLD', label: '❄️ No Streak' },
            { minDays: 1, multiplier: 1.10, tier: 'WARMING_UP', label: '🌡️ Warming Up' },
            { minDays: 3, multiplier: 1.20, tier: 'WARMING', label: '🔥 3-Day Streak' },
            { minDays: 7, multiplier: 1.50, tier: 'HOT', label: '🔥🔥 7-Day Streak' },
            { minDays: 14, multiplier: 1.75, tier: 'BLAZING', label: '🔥🔥🔥 Blazing' },
            { minDays: 30, multiplier: 2.00, tier: 'LEGENDARY', label: '👑 30-Day Legend' }
        ]
    },

    // Task 06: Mastery Gate (GREEN Silo)
    MASTERY: {
        THRESHOLD: 0.85,            // HARD LAW: 85%
        TRAINING_SOURCES: ['TRAINING_REWARD', 'SESSION_REWARD', 'DRILL_REWARD', 'TRAINING']
    }
};

// ═══════════════════════════════════════════════════════════
// 🛡️ YELLOW ACTIVE LOGIC ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class YellowActiveLogicEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ACTIVE_LOGIC_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 04: THE 25% BURN ENFORCER
    // ═══════════════════════════════════════════════════════

    /**
     * Create a marketplace sale with automatic 25% burn
     * HARD LAW: 75% to Seller, 25% to burn vault
     * 
     * @param {object} saleData - Sale details
     * @returns {Promise<object>} Sale result with burn split
     */
    async createMarketplaceSale(saleData) {
        const { sellerId, buyerId, itemId, itemType, itemName, salePrice } = saleData;

        // Calculate burn split locally for preview
        const burnSplit = YellowActiveLogicEngine.calculateBurnSplit(salePrice);

        // Create sale record (trigger handles the split)
        const { data, error } = await this.supabase
            .from('marketplace_sales')
            .insert({
                seller_id: sellerId,
                buyer_id: buyerId,
                item_id: itemId,
                item_type: itemType || 'MARKETPLACE_ITEM',
                item_name: itemName,
                sale_price: salePrice,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) {
            return {
                success: false,
                error: 'SALE_CREATION_FAILED',
                message: error.message
            };
        }

        return {
            success: true,
            sale: data,
            burnSplit,
            status: 'PENDING',
            hardLaw: '25_PERCENT_BURN_ENFORCER'
        };
    }

    /**
     * Process a pending sale (executes the burn)
     * 
     * @param {string} saleId - Sale UUID
     * @returns {Promise<object>} Processing result
     */
    async processMarketplaceSale(saleId) {
        const { data, error } = await this.supabase
            .from('marketplace_sales')
            .update({ status: 'PROCESSING' })
            .eq('id', saleId)
            .eq('status', 'PENDING')
            .select()
            .single();

        if (error) {
            return {
                success: false,
                error: 'SALE_PROCESSING_FAILED',
                message: error.message
            };
        }

        return {
            success: data.status === 'COMPLETED',
            sale: data,
            burnAmount: data.burn_amount,
            sellerReceives: data.seller_receives,
            status: data.status
        };
    }

    /**
     * Calculate 25% burn split (client-side preview)
     * 
     * @param {number} salePrice - Total sale price
     * @returns {object} Burn split calculation
     */
    static calculateBurnSplit(salePrice) {
        const burnRate = ACTIVE_LOGIC_CONFIG.BURN.PERCENTAGE;
        let burnAmount = Math.floor(salePrice * burnRate);

        // Minimum 1 diamond burn for sales >= threshold
        if (burnAmount < 1 && salePrice >= ACTIVE_LOGIC_CONFIG.BURN.MIN_BURN_AMOUNT) {
            burnAmount = 1;
        }

        const sellerReceives = salePrice - burnAmount;

        return {
            salePrice,
            burnAmount,
            sellerReceives,
            burnPercentage: burnRate * 100,
            sellerPercentage: (sellerReceives / salePrice * 100).toFixed(1),
            hardLaw: '75_TO_SELLER_25_TO_BURN'
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 05: STREAK MULTIPLIER CALCULATOR
    // ═══════════════════════════════════════════════════════

    /**
     * Apply diamond multiplier based on streak (via RPC)
     * Fetches streak from RED silo, applies 1.2x/1.5x/2.0x
     * 
     * @param {string} userId - User UUID
     * @param {number} baseDiamonds - Base diamond amount
     * @param {string} source - Reward source
     * @returns {Promise<object>} Multiplied result
     */
    async applyDiamondMultiplier(userId, baseDiamonds, source = 'TRAINING') {
        const { data, error } = await this.supabase.rpc('fn_apply_diamond_multiplier', {
            p_user_id: userId,
            p_base_diamonds: baseDiamonds,
            p_source: source
        });

        if (error) {
            // Fallback to local calculation
            return this.applyDiamondMultiplierLocal(userId, baseDiamonds);
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Apply multiplier locally (fetches streak then calculates)
     * 
     * @param {string} userId - User UUID
     * @param {number} baseDiamonds - Base diamond amount
     * @returns {Promise<object>} Multiplied result
     */
    async applyDiamondMultiplierLocal(userId, baseDiamonds) {
        // Fetch streak from wallets
        const { data, error } = await this.supabase
            .from('wallets')
            .select('current_streak')
            .eq('user_id', userId)
            .single();

        const streakDays = error ? 0 : (data?.current_streak || 0);
        return YellowActiveLogicEngine.calculateMultiplier(baseDiamonds, streakDays);
    }

    /**
     * Calculate multiplier locally (no database call)
     * HARD LAW: 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x)
     * 
     * @param {number} baseDiamonds - Base amount
     * @param {number} streakDays - Current streak days
     * @returns {object} Multiplied result
     */
    static calculateMultiplier(baseDiamonds, streakDays) {
        const days = Math.max(0, Math.floor(streakDays));
        const tiers = ACTIVE_LOGIC_CONFIG.STREAK.TIERS;

        // Find applicable tier
        let tier = tiers[0];
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (days >= tiers[i].minDays) {
                tier = tiers[i];
                break;
            }
        }

        const finalDiamonds = Math.floor(baseDiamonds * tier.multiplier);
        const streakBonus = finalDiamonds - baseDiamonds;

        return {
            success: true,
            base_diamonds: baseDiamonds,
            multiplier: tier.multiplier,
            final_diamonds: finalDiamonds,
            streak_bonus: streakBonus,
            streak: {
                days: days,
                tier_name: tier.tier,
                tier_label: tier.label,
                source: 'LOCAL_CALCULATION'
            },
            formula: `${baseDiamonds} × ${tier.multiplier.toFixed(2)} = ${finalDiamonds} 💎`,
            hard_law: 'STREAK_MULTIPLIER_CALCULATOR'
        };
    }

    /**
     * Get all streak tiers for UI display
     * 
     * @returns {array} All tier configurations
     */
    static getAllStreakTiers() {
        return ACTIVE_LOGIC_CONFIG.STREAK.TIERS;
    }

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 06: ATOMIC MINT SECURITY GUARD
    // ═══════════════════════════════════════════════════════

    /**
     * Secure mint with GREEN silo 85% mastery verification
     * HARD LAW: Training rewards require 85% accuracy
     * 
     * @param {string} userId - User UUID
     * @param {number} amount - Diamond amount
     * @param {object} options - Mint options
     * @returns {Promise<object>} Mint result
     */
    async mintDiamondsSecure(userId, amount, options = {}) {
        const {
            source = 'TRAINING_REWARD',
            sessionId = null,
            accuracy = null,
            metadata = {}
        } = options;

        // Local validation first
        const validation = YellowActiveLogicEngine.validateMintRequest(amount, source, accuracy);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                message: validation.message,
                status: 'ATOMIC_FAILED',
                hardLaw: validation.hardLaw
            };
        }

        // Call secure mint RPC
        const { data, error } = await this.supabase.rpc('mint_diamonds_secure', {
            p_user_id: userId,
            p_amount: amount,
            p_source: source,
            p_session_id: sessionId,
            p_accuracy: accuracy,
            p_metadata: metadata
        });

        if (error) {
            return {
                success: false,
                error: 'MINT_RPC_FAILED',
                message: error.message,
                status: 'ATOMIC_FAILED'
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        return result;
    }

    /**
     * Validate mint request before RPC call
     * 
     * @param {number} amount - Diamond amount
     * @param {string} source - Reward source
     * @param {number} accuracy - Accuracy (for training)
     * @returns {object} Validation result
     */
    static validateMintRequest(amount, source, accuracy) {
        // Amount validation
        if (amount === null || amount === undefined || amount <= 0) {
            return {
                valid: false,
                error: 'INVALID_AMOUNT',
                message: 'Amount must be a positive integer'
            };
        }

        // Training source requires accuracy
        const trainingSourceS = ACTIVE_LOGIC_CONFIG.MASTERY.TRAINING_SOURCES;
        if (trainingSourceS.includes(source)) {
            if (accuracy === null || accuracy === undefined) {
                return {
                    valid: false,
                    error: 'ACCURACY_REQUIRED',
                    message: 'Training rewards require accuracy for GREEN verification',
                    hardLaw: '85_PERCENT_MASTERY_GATE'
                };
            }

            // HARD LAW: 85% threshold
            if (accuracy < ACTIVE_LOGIC_CONFIG.MASTERY.THRESHOLD) {
                return {
                    valid: false,
                    error: 'MASTERY_GATE_FAILED',
                    message: `GREEN silo requires 85% mastery, got ${(accuracy * 100).toFixed(1)}%`,
                    hardLaw: '85_PERCENT_MASTERY_GATE'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Preview mint with multiplier (no database mutation)
     * 
     * @param {number} baseDiamonds - Base amount
     * @param {number} streakDays - Current streak
     * @param {number} accuracy - Training accuracy
     * @returns {object} Mint preview
     */
    static previewSecureMint(baseDiamonds, streakDays, accuracy = 1.0) {
        // Check mastery gate
        if (accuracy < ACTIVE_LOGIC_CONFIG.MASTERY.THRESHOLD) {
            return {
                success: false,
                eligible: false,
                reason: 'MASTERY_GATE_FAILED',
                accuracy,
                threshold: ACTIVE_LOGIC_CONFIG.MASTERY.THRESHOLD,
                hardLaw: '85_PERCENT_MASTERY_GATE'
            };
        }

        // Calculate multiplier
        const multiplied = YellowActiveLogicEngine.calculateMultiplier(baseDiamonds, streakDays);

        return {
            success: true,
            eligible: true,
            baseDiamonds,
            finalDiamonds: multiplied.final_diamonds,
            multiplier: multiplied.multiplier,
            streakBonus: multiplied.streak_bonus,
            streakTier: multiplied.streak.tier_name,
            accuracy,
            masteryVerified: true,
            formula: multiplied.formula
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STATUS & DIAGNOSTICS
    // ═══════════════════════════════════════════════════════

    /**
     * Get active logic status
     * 
     * @returns {Promise<object>} Status info
     */
    async getActiveLogicStatus() {
        const { data, error } = await this.supabase
            .from('yellow_active_logic_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task04_burnEnforcer: data.burn_enforcer_active,
                task04_salesProcessed: data.marketplace_sales_processed,
                task05_multiplierCalculator: data.multiplier_calculator_exists,
                task06_mintGuard: data.mint_guard_exists,
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default YellowActiveLogicEngine;
