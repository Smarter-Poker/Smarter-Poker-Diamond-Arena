/**
 * 💎 STAKING VAULT — ORB #03: DIAMOND ARENA
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Atomic settlement engine for high-stakes Diamond entries.
 * 
 * @target Orb 03 - Diamond Arena
 * @hardLaw IMMUTABLE_LEDGER, 25_PERCENT_BURN, TRIPLE_WALLET_ISOLATION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type StakeTier = 'MICRO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ELITE';
export type PoolType = 'HEADS_UP' | 'MULTI_TABLE' | 'TOURNAMENT' | 'SIT_N_GO' | 'COMMUNITY_EVENT';
export type EntryStatus = 'PENDING' | 'ACTIVE' | 'SETTLED' | 'REFUNDED' | 'VOID';
export type WalletType = 'PERSONAL' | 'STAKED' | 'MAKEUP';

export interface StakeEntry {
    id: string;
    userId: string;
    poolId: string;
    stakeAmount: number;
    burnAmount: number;
    poolContribution: number;
    status: EntryStatus;
    walletSource: WalletType;
    createdAt: Date;
    settledAt?: Date;
}

export interface SettlementResult {
    success: boolean;
    entryId?: string;
    hashId?: string;
    status: EntryStatus | 'ERROR';
    stakeBreakdown?: {
        gross: number;
        burned: number;
        netToPool: number;
        formula: string;
    };
    balanceAfter?: number;
    error?: string;
    hardLawsEnforced?: string[];
}

export interface VaultStats {
    totalStaked: number;
    totalBurned: number;
    activeEntries: number;
    settledEntries: number;
    averageStake: number;
    topStake: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ VAULT CONFIGURATION — HARD LAWS
// ═══════════════════════════════════════════════════════════════════════════

export const VAULT_CONFIG = {
    // 🔥 HARD LAW: 25% Burn Rate
    BURN_RATE: 0.25,

    // 💎 Pool allocation (after burn)
    POOL_RATE: 0.75,

    // 🏛️ Stake Tier Requirements
    STAKE_TIERS: {
        MICRO: { min: 10, max: 24, levelRequired: 1, icon: '💎' },
        LOW: { min: 25, max: 49, levelRequired: 5, icon: '💎💎' },
        MEDIUM: { min: 50, max: 99, levelRequired: 10, icon: '💎💎💎' },
        HIGH: { min: 100, max: 249, levelRequired: 20, icon: '👑' },
        ELITE: { min: 250, max: 100000, levelRequired: 50, icon: '👑👑' },
    } as const,

    // ⏱️ Cooldown Laws
    TRANSACTION_COOLDOWN_MS: 120_000, // 2-minute cooldown (Hard Law #5)

    // 🚨 Velocity Guardian (Hard Law #10)
    VELOCITY_THRESHOLD: 50_000,
    VELOCITY_COOLDOWN_MS: 1_800_000, // 30-minute flag

    // 🔐 Hash ID Prefix
    HASH_PREFIX: 'PXQ',

    // 📋 Pool Types with House Cut
    POOL_TYPES: {
        HEADS_UP: { houseCut: 0.10, minPlayers: 2, maxPlayers: 2 },
        MULTI_TABLE: { houseCut: 0.10, minPlayers: 2, maxPlayers: 10 },
        TOURNAMENT: { houseCut: 0.12, minPlayers: 6, maxPlayers: 1000 },
        SIT_N_GO: { houseCut: 0.10, minPlayers: 6, maxPlayers: 9 },
        COMMUNITY_EVENT: { houseCut: 0.15, minPlayers: 10, maxPlayers: 10000 },
    } as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// 💎 STAKING VAULT CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class StakingVault {
    private supabase: SupabaseClient;
    private lastTransactionTime: Map<string, number> = new Map();

    constructor(supabaseClient: SupabaseClient) {
        if (!supabaseClient) {
            throw new Error('VAULT_ERROR: Supabase client required for atomic operations');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 ATOMIC STAKE ENTRY
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Execute atomic stake entry with 25% burn enforcement
     * 
     * HARD LAWS ENFORCED:
     * - Immutable Ledger Law (Hash-ID logging)
     * - 25% Burn Law (instant burn on stake)
     * - Triple-Wallet Isolation (source verification)
     * - Transaction Cooldown (2-minute minimum)
     * 
     * @param userId - UUID of the staking user
     * @param poolId - UUID of the target prize pool
     * @param amount - Gross stake amount
     * @param options - Additional stake options
     */
    async atomicStakeEntry(
        userId: string,
        poolId: string,
        amount: number,
        options: {
            walletSource?: WalletType;
            bypassCooldown?: boolean;
            metadata?: Record<string, unknown>;
        } = {}
    ): Promise<SettlementResult> {
        const { walletSource = 'PERSONAL', bypassCooldown = false, metadata = {} } = options;

        // ═══ PRE-FLIGHT VALIDATIONS ═══

        // 1️⃣ Validate stake tier
        const tierValidation = this.validateStakeTier(amount);
        if (!tierValidation.valid) {
            return {
                success: false,
                status: 'ERROR',
                error: tierValidation.error,
            };
        }

        // 2️⃣ Enforce transaction cooldown (Hard Law #5)
        if (!bypassCooldown) {
            const cooldownCheck = this.checkCooldown(userId);
            if (!cooldownCheck.passed) {
                return {
                    success: false,
                    status: 'ERROR',
                    error: `COOLDOWN_ACTIVE: ${cooldownCheck.remainingMs}ms remaining`,
                };
            }
        }

        // 3️⃣ Check velocity guardian (Hard Law #10)
        if (amount >= VAULT_CONFIG.VELOCITY_THRESHOLD) {
            return {
                success: false,
                status: 'PENDING',
                error: 'PENDING_ADMIN_APPROVAL: High-value stake flagged',
                hardLawsEnforced: ['VELOCITY_GUARDIAN'],
            };
        }

        // ═══ CALCULATE ATOMIC SPLIT ═══
        const burnAmount = Math.floor(amount * VAULT_CONFIG.BURN_RATE);
        const poolContribution = amount - burnAmount;

        // ═══ EXECUTE ATOMIC DATABASE TRANSACTION ═══
        const { data, error } = await this.supabase.rpc('fn_atomic_stake_entry', {
            p_user_id: userId,
            p_pool_id: poolId,
            p_gross_stake: amount,
            p_burn_amount: burnAmount,
            p_pool_contribution: poolContribution,
            p_wallet_source: walletSource,
            p_metadata: metadata,
        });

        if (error) {
            return {
                success: false,
                status: 'ERROR',
                error: `ATOMIC_STAKE_FAILED: ${error.message}`,
            };
        }

        // Parse result (handles both string and object responses)
        const result = typeof data === 'string' ? JSON.parse(data) : data;

        // Update cooldown tracker
        this.lastTransactionTime.set(userId, Date.now());

        return {
            success: true,
            entryId: result.entry_id,
            hashId: result.hash_id,
            status: 'ACTIVE',
            stakeBreakdown: {
                gross: amount,
                burned: burnAmount,
                netToPool: poolContribution,
                formula: `${amount}💎 = ${burnAmount}🔥 + ${poolContribution}🏆`,
            },
            balanceAfter: result.balance_after,
            hardLawsEnforced: ['IMMUTABLE_LEDGER', '25_PERCENT_BURN', 'TRIPLE_WALLET_ISOLATION'],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 ATOMIC REFUND
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Execute atomic refund for cancelled entries
     * NOTE: Only the pool contribution is refunded (burn is permanent)
     * 
     * @param entryId - UUID of the stake entry
     * @param reason - Refund reason for audit trail
     */
    async atomicRefund(
        entryId: string,
        reason: string
    ): Promise<SettlementResult> {
        const { data, error } = await this.supabase.rpc('fn_atomic_stake_refund', {
            p_entry_id: entryId,
            p_reason: reason,
        });

        if (error) {
            return {
                success: false,
                status: 'ERROR',
                error: `REFUND_FAILED: ${error.message}`,
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            success: true,
            entryId,
            hashId: result.hash_id,
            status: 'REFUNDED',
            balanceAfter: result.balance_after,
            hardLawsEnforced: ['IMMUTABLE_LEDGER'],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🏆 ATOMIC SETTLEMENT (WINNER PAYOUT)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Settle entry with payout amount
     * Called by PrizePoolLogic after competition concludes
     * 
     * @param entryId - UUID of the stake entry
     * @param payoutAmount - Diamonds to credit winner
     */
    async settleEntry(
        entryId: string,
        payoutAmount: number
    ): Promise<SettlementResult> {
        const { data, error } = await this.supabase.rpc('fn_settle_arena_entry', {
            p_entry_id: entryId,
            p_payout_amount: payoutAmount,
        });

        if (error) {
            return {
                success: false,
                status: 'ERROR',
                error: `SETTLEMENT_FAILED: ${error.message}`,
            };
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            success: true,
            entryId,
            hashId: result.hash_id,
            status: 'SETTLED',
            balanceAfter: result.balance_after,
            hardLawsEnforced: ['IMMUTABLE_LEDGER'],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 VAULT ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get vault statistics for a specific pool
     */
    async getPoolVaultStats(poolId: string): Promise<VaultStats> {
        const { data, error } = await this.supabase
            .from('arena_pool_entries')
            .select('stake_amount, burn_amount, status')
            .eq('pool_id', poolId);

        if (error || !data) {
            return {
                totalStaked: 0,
                totalBurned: 0,
                activeEntries: 0,
                settledEntries: 0,
                averageStake: 0,
                topStake: 0,
            };
        }

        const totalStaked = data.reduce((sum, e) => sum + e.stake_amount, 0);
        const totalBurned = data.reduce((sum, e) => sum + e.burn_amount, 0);
        const activeEntries = data.filter(e => e.status === 'ACTIVE').length;
        const settledEntries = data.filter(e => e.status === 'SETTLED').length;
        const averageStake = data.length > 0 ? Math.floor(totalStaked / data.length) : 0;
        const topStake = Math.max(...data.map(e => e.stake_amount), 0);

        return {
            totalStaked,
            totalBurned,
            activeEntries,
            settledEntries,
            averageStake,
            topStake,
        };
    }

    /**
     * Get user's staking vault history
     */
    async getUserVaultHistory(
        userId: string,
        options: { limit?: number; poolType?: PoolType } = {}
    ): Promise<{ entries: StakeEntry[]; summary: { totalStaked: number; totalWon: number; netResult: number } }> {
        const { limit = 50, poolType } = options;

        let query = this.supabase
            .from('arena_pool_entries')
            .select(`
        id, user_id, pool_id, stake_amount, burn_amount, 
        pool_contribution, status, wallet_source, created_at, settled_at,
        pool:arena_prize_pools(pool_type)
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (poolType) {
            query = query.eq('pool.pool_type', poolType);
        }

        const { data, error } = await query;

        if (error || !data) {
            return { entries: [], summary: { totalStaked: 0, totalWon: 0, netResult: 0 } };
        }

        const entries: StakeEntry[] = data.map(e => ({
            id: e.id,
            userId: e.user_id,
            poolId: e.pool_id,
            stakeAmount: e.stake_amount,
            burnAmount: e.burn_amount,
            poolContribution: e.pool_contribution,
            status: e.status,
            walletSource: e.wallet_source,
            createdAt: new Date(e.created_at),
            settledAt: e.settled_at ? new Date(e.settled_at) : undefined,
        }));

        const totalStaked = entries.reduce((sum, e) => sum + e.stakeAmount, 0);
        const totalWon = entries
            .filter(e => e.status === 'SETTLED')
            .reduce((sum, e) => sum + e.poolContribution, 0); // Simplified - actual would come from payout

        return {
            entries,
            summary: {
                totalStaked,
                totalWon,
                netResult: totalWon - totalStaked,
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Validate stake amount against tier requirements
     */
    validateStakeTier(amount: number): { valid: boolean; tier?: StakeTier; error?: string } {
        for (const [tierName, config] of Object.entries(VAULT_CONFIG.STAKE_TIERS)) {
            if (amount >= config.min && amount <= config.max) {
                return { valid: true, tier: tierName as StakeTier };
            }
        }

        const minStake = VAULT_CONFIG.STAKE_TIERS.MICRO.min;
        const maxStake = VAULT_CONFIG.STAKE_TIERS.ELITE.max;

        return {
            valid: false,
            error: `INVALID_STAKE_AMOUNT: Must be between ${minStake} and ${maxStake} diamonds`,
        };
    }

    /**
     * Check transaction cooldown status
     */
    checkCooldown(userId: string): { passed: boolean; remainingMs: number } {
        const lastTx = this.lastTransactionTime.get(userId);
        if (!lastTx) {
            return { passed: true, remainingMs: 0 };
        }

        const elapsed = Date.now() - lastTx;
        const remaining = VAULT_CONFIG.TRANSACTION_COOLDOWN_MS - elapsed;

        return {
            passed: remaining <= 0,
            remainingMs: Math.max(0, remaining),
        };
    }

    /**
     * Calculate stake breakdown (client-side preview)
     */
    static calculateStakeBreakdown(amount: number): {
        gross: number;
        burned: number;
        netToPool: number;
        burnRate: string;
        formula: string;
    } {
        const burned = Math.floor(amount * VAULT_CONFIG.BURN_RATE);
        const netToPool = amount - burned;

        return {
            gross: amount,
            burned,
            netToPool,
            burnRate: '25%',
            formula: `${amount}💎 = ${burned}🔥 (burn) + ${netToPool}🏆 (pool)`,
        };
    }

    /**
     * Generate unique hash ID for ledger entries
     */
    static generateHashId(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let hash = VAULT_CONFIG.HASH_PREFIX;
        for (let i = 0; i < 13; i++) {
            hash += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return hash;
    }

    /**
     * Get tier info for UI display
     */
    static getTierInfo(amount: number): {
        tier: StakeTier;
        icon: string;
        levelRequired: number;
    } | null {
        for (const [tierName, config] of Object.entries(VAULT_CONFIG.STAKE_TIERS)) {
            if (amount >= config.min && amount <= config.max) {
                return {
                    tier: tierName as StakeTier,
                    icon: config.icon,
                    levelRequired: config.levelRequired,
                };
            }
        }
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default StakingVault;
