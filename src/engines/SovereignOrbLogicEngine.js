/**
 * 🛰️ SOVEREIGN ORB LOGIC ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SOVEREIGN_ORB_LOGIC: ORBS 03, 07, 10
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Task 44: ORB_03_DIAMOND_ARENA_STAKES
 * Task 45: ORB_07_ARCADE_WAGER_ENGINE
 * Task 46: ORB_10_MARKETPLACE_ENGINE
 * 
 * @target Cross-Orb Logic Layer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ORB LOGIC CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ORB_LOGIC_CONFIG = {
    // Task 44: Arena Stake Tiers
    ARENA_TIERS: [
        { level: 1, name: 'BRONZE_ARENA', minXp: 0, minStake: 10, maxStake: 100, icon: '🥉' },
        { level: 2, name: 'SILVER_ARENA', minXp: 1000, minStake: 50, maxStake: 500, icon: '🥈' },
        { level: 3, name: 'GOLD_ARENA', minXp: 5000, minStake: 100, maxStake: 2000, icon: '🥇' },
        { level: 4, name: 'PLATINUM_ARENA', minXp: 20000, minStake: 500, maxStake: 10000, icon: '💎' },
        { level: 5, name: 'DIAMOND_ARENA', minXp: 50000, minStake: 1000, maxStake: 50000, icon: '💠' },
        { level: 6, name: 'LEGENDARY_ARENA', minXp: 100000, minStake: 5000, maxStake: 250000, icon: '👑' }
    ],

    // Task 45: Arcade Wager (IMMUTABLE)
    ARCADE_WAGER: {
        BURN_RATE: 0.25,  // 25% HARD LAW
        ENFORCED: true
    },

    // Task 46: Marketplace
    AUCTION_TYPES: ['FIXED', 'BID', 'DUTCH'],
    MARKETPLACE_BURN_RATE: 0.25  // 25% HARD LAW
};

// ═══════════════════════════════════════════════════════════
// 🛰️ SOVEREIGN ORB LOGIC ENGINE CLASS
// ═══════════════════════════════════════════════════════════

export class SovereignOrbLogicEngine {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ORB_LOGIC_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🎯 TASK 44: ORB 03 DIAMOND ARENA STAKES
    // ═══════════════════════════════════════════════════════

    /**
     * Get arena access tier for user based on XP
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<object>} Access tier info
     */
    async getArenaAccessTier(userId) {
        const { data, error } = await this.supabase.rpc('fn_get_arena_access_tier', {
            p_user_id: userId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Request access to arena tier
     * 
     * @param {object} accessData - Access request
     * @returns {Promise<object>} Access result
     */
    async requestArenaAccess(accessData) {
        const { userId, tierLevel, stakeAmount } = accessData;

        const { data, error } = await this.supabase.rpc('fn_request_arena_access', {
            p_user_id: userId,
            p_tier_level: tierLevel,
            p_stake_amount: stakeAmount
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate arena tier from XP locally
     * 
     * @param {number} userXp - User's XP
     * @returns {object} Tier info
     */
    static calculateArenaTierFromXp(userXp) {
        const tiers = ORB_LOGIC_CONFIG.ARENA_TIERS;
        let currentTier = tiers[0];

        for (const tier of tiers) {
            if (userXp >= tier.minXp) {
                currentTier = tier;
            }
        }

        return {
            tier: currentTier,
            allTiers: tiers.map(t => ({
                ...t,
                unlocked: userXp >= t.minXp,
                current: t.level === currentTier.level
            }))
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🎰 TASK 45: ORB 07 ARCADE WAGER ENGINE
    // ═══════════════════════════════════════════════════════

    /**
     * Place arcade wager with 25% instant burn
     * 
     * @param {object} wagerData - Wager details
     * @returns {Promise<object>} Wager result
     */
    async placeArcadeWager(wagerData) {
        const { userId, gameMode, wagerAmount, sessionId } = wagerData;

        const { data, error } = await this.supabase.rpc('fn_place_arcade_wager', {
            p_user_id: userId,
            p_game_mode: gameMode,
            p_wager_amount: wagerAmount,
            p_session_id: sessionId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Settle arcade wager
     * 
     * @param {object} settlementData - Settlement details
     * @returns {Promise<object>} Settlement result
     */
    async settleArcadeWager(settlementData) {
        const { wagerId, outcome, payoutAmount } = settlementData;

        const { data, error } = await this.supabase.rpc('fn_settle_arcade_wager', {
            p_wager_id: wagerId,
            p_outcome: outcome,
            p_payout_amount: payoutAmount || 0
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Calculate wager burn locally
     * 
     * @param {number} wagerAmount - Wager amount
     * @returns {object} Burn calculation
     */
    static calculateWagerBurn(wagerAmount) {
        const burnRate = ORB_LOGIC_CONFIG.ARCADE_WAGER.BURN_RATE;
        const wagerBurn = Math.floor(wagerAmount * burnRate);
        const netWager = wagerAmount - wagerBurn;

        return {
            wagerAmount,
            wagerBurn,
            netWager,
            burnRate: '25%',
            formula: `${wagerAmount} - ${wagerBurn} = ${netWager} to pool`
        };
    }

    /**
     * Calculate full wager cycle (wager + payout burns)
     * 
     * @param {number} wagerAmount - Wager amount
     * @param {number} payoutAmount - Payout amount (if win)
     * @returns {object} Full cycle calculation
     */
    static calculateFullWagerCycle(wagerAmount, payoutAmount) {
        const burnRate = ORB_LOGIC_CONFIG.ARCADE_WAGER.BURN_RATE;

        const wagerBurn = Math.floor(wagerAmount * burnRate);
        const netWager = wagerAmount - wagerBurn;

        const payoutBurn = Math.floor(payoutAmount * burnRate);
        const netPayout = payoutAmount - payoutBurn;

        const totalBurn = wagerBurn + payoutBurn;
        const netResult = netPayout - wagerAmount;  // Net gain/loss to user

        return {
            wager: { total: wagerAmount, burned: wagerBurn, toPool: netWager },
            payout: { total: payoutAmount, burned: payoutBurn, received: netPayout },
            totalBurned: totalBurn,
            netResult,
            outcome: netResult > 0 ? 'WIN' : netResult < 0 ? 'LOSS' : 'PUSH'
        };
    }

    // ═══════════════════════════════════════════════════════
    // 🏪 TASK 46: ORB 10 MARKETPLACE ENGINE
    // ═══════════════════════════════════════════════════════

    /**
     * Execute auction sale with activity ledger entry
     * 
     * @param {object} saleData - Sale details
     * @returns {Promise<object>} Sale result
     */
    async executeAuctionSale(saleData) {
        const { listingId, buyerId, salePrice, saleType } = saleData;

        const { data, error } = await this.supabase.rpc('fn_execute_auction_sale', {
            p_listing_id: listingId,
            p_buyer_id: buyerId,
            p_sale_price: salePrice,
            p_sale_type: saleType
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * Create auction listing
     * 
     * @param {object} listingData - Listing details
     * @returns {Promise<object>} Listing result
     */
    async createAuctionListing(listingData) {
        const { data, error } = await this.supabase
            .from('auction_house_listings')
            .insert({
                item_id: listingData.itemId,
                item_name: listingData.itemName,
                item_category: listingData.category,
                item_rarity: listingData.rarity || 'COMMON',
                auction_type: listingData.auctionType || 'FIXED',
                starting_price: listingData.price,
                buyout_price: listingData.buyoutPrice,
                reserve_price: listingData.reservePrice,
                seller_id: listingData.sellerId,
                expires_at: listingData.expiresAt
            })
            .select()
            .single();

        return { success: !error, listing: data, error: error?.message };
    }

    /**
     * Get active auction listings
     * 
     * @param {object} filters - Optional filters
     * @returns {Promise<object>} Listings
     */
    async getAuctionListings(filters = {}) {
        let query = this.supabase
            .from('auction_house_listings')
            .select('*')
            .eq('status', 'ACTIVE');

        if (filters.category) {
            query = query.eq('item_category', filters.category);
        }
        if (filters.maxPrice) {
            query = query.lte('starting_price', filters.maxPrice);
        }

        const { data, error } = await query.order('listed_at', { ascending: false });

        return { success: !error, listings: data || [], count: data?.length || 0 };
    }

    /**
     * Calculate marketplace sale split locally
     * 
     * @param {number} salePrice - Sale price
     * @returns {object} Split calculation
     */
    static calculateMarketplaceSplit(salePrice) {
        const burnRate = ORB_LOGIC_CONFIG.MARKETPLACE_BURN_RATE;
        const burnAmount = Math.floor(salePrice * burnRate);
        const sellerReceives = salePrice - burnAmount;

        return {
            salePrice,
            burnAmount,
            sellerReceives,
            burnRate: '25%',
            formula: `${salePrice} - ${burnAmount} (burn) = ${sellerReceives} to seller`
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STATUS METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Get Orb Logic status
     * 
     * @returns {Promise<object>} Status
     */
    async getOrbLogicStatus() {
        const { data, error } = await this.supabase
            .from('orb_logic_status')
            .select('*')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            status: {
                task44_arenaStakes: {
                    tiersActive: data.arena_tiers_active,
                    accessesGranted: data.arena_accesses_granted,
                    accessesDenied: data.arena_accesses_denied
                },
                task45_arcadeWager: {
                    totalWagers: data.total_wagers,
                    wagerBurnTotal: data.total_wager_burn,
                    payoutBurnTotal: data.total_payout_burn
                },
                task46_auctionHouse: {
                    totalListings: data.total_listings,
                    totalSales: data.total_sales,
                    burnTotal: data.auction_burn_total
                },
                verifiedAt: data.verified_at
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default SovereignOrbLogicEngine;
