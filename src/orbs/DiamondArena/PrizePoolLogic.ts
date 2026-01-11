/**
 * 💰 PRIZE POOL LOGIC — ORB #03: DIAMOND ARENA
 * Automated payout engine for community pots.
 * @hardLaw TRANSPARENT_PERCENTILE_PAYOUTS, HOUSE_CUT_ENFORCEMENT
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VAULT_CONFIG, type PoolType } from './StakingVault';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type PoolStatus = 'REGISTERING' | 'ACTIVE' | 'CALCULATING' | 'DISTRIBUTING' | 'SETTLED' | 'CANCELLED';
export type PayoutTier = 'ELITE_1' | 'TOP_5' | 'TOP_10' | 'TOP_25' | 'TOP_50' | 'PARTICIPANTS';

export interface PrizePool {
    id: string;
    name: string;
    poolType: PoolType;
    status: PoolStatus;
    entryFee: number;
    totalPool: number;
    totalBurned: number;
    houseCut: number;
    prizePool: number;
    entrantCount: number;
    maxEntrants: number;
    startTime: Date;
    endTime?: Date;
}

export interface Entrant {
    userId: string;
    username: string;
    score: number;
    rank: number;
    percentile: number;
    entryTime: Date;
    latencyMs?: number;
}

export interface PayoutResult {
    userId: string;
    rank: number;
    percentile: number;
    payoutTier: PayoutTier;
    payoutAmount: number;
    poolShare: string;
}

export interface DistributionReport {
    success: boolean;
    poolId: string;
    totalDistributed: number;
    houseTake: number;
    payouts: PayoutResult[];
    remainderHandling: 'ADDED_TO_FIRST' | 'BURNED';
    settledAt: Date;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ PAYOUT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const PAYOUT_CONFIG = {
    STRUCTURES: {
        HEADS_UP: { description: 'Winner Takes All', tiers: { 1: 100 } },
        MULTI_TABLE: { description: 'Top 3 Split', tiers: { 1: 50, 2: 30, 3: 20 } },
        SIT_N_GO: { description: 'Standard SNG', tiers: { 1: 50, 2: 30, 3: 20 } },
        TOURNAMENT: { description: 'Deep Payout', tiers: { 1: 40, 2: 25, 3: 15, 4: 10, 5: 10 } },
        COMMUNITY_EVENT: {
            description: 'Percentile-Based (Section 4E)',
            tiers: {
                ELITE_1: { percentile: 1, poolShare: 30 },
                TOP_5: { percentile: 5, poolShare: 20 },
                TOP_10: { percentile: 10, poolShare: 20 },
                TOP_25: { percentile: 25, poolShare: 15 },
                TOP_50: { percentile: 50, poolShare: 10 },
                PARTICIPANTS: { percentile: 100, poolShare: 5 },
            },
        },
    } as const,

    HOUSE_RATES: {
        HEADS_UP: 0.10,
        MULTI_TABLE: 0.10,
        SIT_N_GO: 0.10,
        TOURNAMENT: 0.12,
        COMMUNITY_EVENT: 0.15
    } as const,

    TIE_BREAKER: { PRIMARY: 'SCORE', SECONDARY: 'LATENCY', TERTIARY: 'ENTRY_TIME' },
    MIN_PAYOUT: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// 💰 PRIZE POOL LOGIC CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class PrizePoolLogic {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        if (!supabaseClient) throw new Error('POOL_ERROR: Supabase client required');
        this.supabase = supabaseClient;
    }

    async createPool(params: {
        name: string;
        poolType: PoolType;
        entryFee: number;
        maxEntrants: number;
        startTime: Date;
        endTime?: Date;
    }): Promise<{ success: boolean; pool?: PrizePool; error?: string }> {
        const { name, poolType, entryFee, maxEntrants, startTime, endTime } = params;
        const houseCutRate = PAYOUT_CONFIG.HOUSE_RATES[poolType];

        const { data, error } = await this.supabase
            .from('arena_prize_pools')
            .insert({
                name,
                pool_type: poolType,
                entry_fee: entryFee,
                max_entrants: maxEntrants,
                start_time: startTime.toISOString(),
                end_time: endTime?.toISOString() || null,
                status: 'REGISTERING',
                total_pool: 0,
                total_burned: 0,
                house_cut_rate: houseCutRate,
            })
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, pool: this.mapPoolFromDb(data) };
    }

    async getLeaderboard(poolId: string, options: { limit?: number; offset?: number } = {}): Promise<Entrant[]> {
        const { limit = 100, offset = 0 } = options;

        const { data } = await this.supabase
            .from('arena_pool_entries')
            .select(`user_id, score, latency_ms, created_at, user:profiles(username)`)
            .eq('pool_id', poolId)
            .eq('status', 'ACTIVE')
            .order('score', { ascending: false })
            .order('latency_ms', { ascending: true })
            .range(offset, offset + limit - 1);

        const { count } = await this.supabase
            .from('arena_pool_entries')
            .select('*', { count: 'exact', head: true })
            .eq('pool_id', poolId)
            .eq('status', 'ACTIVE');

        return this.calculateStandings(data || [], count || 0);
    }

    async getPoolWithStandings(poolId: string): Promise<{
        pool: PrizePool;
        standings: Entrant[];
        projectedPayouts: PayoutResult[];
    } | null> {
        const { data: poolData, error } = await this.supabase
            .from('arena_prize_pools')
            .select('*')
            .eq('id', poolId)
            .single();

        if (error || !poolData) return null;

        const standings = await this.getLeaderboard(poolId);
        const pool = this.mapPoolFromDb(poolData);
        const projectedPayouts = this.calculatePayouts(pool.poolType, standings, pool.prizePool);

        return { pool, standings, projectedPayouts };
    }

    async distributePrizes(poolId: string): Promise<DistributionReport> {
        await this.supabase.from('arena_prize_pools').update({ status: 'CALCULATING' }).eq('id', poolId);

        const poolData = await this.getPoolWithStandings(poolId);
        if (!poolData) {
            return { success: false, poolId, totalDistributed: 0, houseTake: 0, payouts: [], remainderHandling: 'BURNED', settledAt: new Date(), error: 'POOL_NOT_FOUND' };
        }

        const { pool, standings } = poolData;
        const houseCut = Math.floor(pool.totalPool * PAYOUT_CONFIG.HOUSE_RATES[pool.poolType]);
        const distributablePool = pool.totalPool - houseCut;
        const payouts = this.calculatePayouts(pool.poolType, standings, distributablePool);

        let totalPayout = payouts.reduce((sum, p) => sum + p.payoutAmount, 0);
        let remainder = distributablePool - totalPayout;
        if (remainder > 0 && payouts.length > 0) {
            payouts[0].payoutAmount += remainder;
            totalPayout += remainder;
        }

        await this.supabase.from('arena_prize_pools').update({ status: 'DISTRIBUTING' }).eq('id', poolId);

        const { error: distError } = await this.supabase.rpc('fn_distribute_arena_prizes', {
            p_pool_id: poolId,
            p_payouts: payouts.map(p => ({ user_id: p.userId, amount: p.payoutAmount, rank: p.rank, percentile: p.percentile })),
            p_house_cut: houseCut,
        });

        if (distError) {
            await this.supabase.from('arena_prize_pools').update({ status: 'ACTIVE' }).eq('id', poolId);
            return { success: false, poolId, totalDistributed: 0, houseTake: houseCut, payouts: [], remainderHandling: 'ADDED_TO_FIRST', settledAt: new Date(), error: distError.message };
        }

        await this.supabase.from('arena_prize_pools').update({ status: 'SETTLED', settled_at: new Date().toISOString() }).eq('id', poolId);

        return { success: true, poolId, totalDistributed: totalPayout, houseTake: houseCut, payouts, remainderHandling: 'ADDED_TO_FIRST', settledAt: new Date() };
    }

    private calculateStandings(entrants: any[], totalCount: number): Entrant[] {
        return entrants.map((e, index) => ({
            userId: e.user_id,
            username: e.user?.username || 'Anonymous',
            score: e.score || 0,
            rank: index + 1,
            percentile: totalCount > 0 ? Math.ceil(((index + 1) / totalCount) * 100) : 100,
            entryTime: new Date(e.created_at),
            latencyMs: e.latency_ms,
        }));
    }

    private calculatePayouts(poolType: PoolType, standings: Entrant[], prizePool: number): PayoutResult[] {
        const payouts: PayoutResult[] = [];
        if (poolType === 'COMMUNITY_EVENT') return this.calculatePercentilePayouts(standings, prizePool);

        const structure = PAYOUT_CONFIG.STRUCTURES[poolType];
        const tiers = structure.tiers as Record<number, number>;

        for (const [rankStr, percent] of Object.entries(tiers)) {
            const rank = parseInt(rankStr);
            const entrant = standings.find(s => s.rank === rank);
            if (entrant) {
                const payoutAmount = Math.floor(prizePool * (percent / 100));
                if (payoutAmount >= PAYOUT_CONFIG.MIN_PAYOUT) {
                    payouts.push({ userId: entrant.userId, rank, percentile: entrant.percentile, payoutTier: this.getTierFromRank(rank), payoutAmount, poolShare: `${percent}%` });
                }
            }
        }
        return payouts;
    }

    private calculatePercentilePayouts(standings: Entrant[], prizePool: number): PayoutResult[] {
        const payouts: PayoutResult[] = [];
        const tiers = PAYOUT_CONFIG.STRUCTURES.COMMUNITY_EVENT.tiers;
        const tierDefs: Array<{ tier: PayoutTier; maxPct: number; share: number }> = [
            { tier: 'ELITE_1', maxPct: 1, share: tiers.ELITE_1.poolShare },
            { tier: 'TOP_5', maxPct: 5, share: tiers.TOP_5.poolShare },
            { tier: 'TOP_10', maxPct: 10, share: tiers.TOP_10.poolShare },
            { tier: 'TOP_25', maxPct: 25, share: tiers.TOP_25.poolShare },
            { tier: 'TOP_50', maxPct: 50, share: tiers.TOP_50.poolShare },
            { tier: 'PARTICIPANTS', maxPct: 100, share: tiers.PARTICIPANTS.poolShare },
        ];

        let prevMax = 0;
        for (const def of tierDefs) {
            const tierEntrants = standings.filter(s => s.percentile > prevMax && s.percentile <= def.maxPct);
            if (tierEntrants.length > 0) {
                const tierPool = Math.floor(prizePool * (def.share / 100));
                const perEntrant = Math.floor(tierPool / tierEntrants.length);
                for (const e of tierEntrants) {
                    if (perEntrant >= PAYOUT_CONFIG.MIN_PAYOUT) {
                        payouts.push({ userId: e.userId, rank: e.rank, percentile: e.percentile, payoutTier: def.tier, payoutAmount: perEntrant, poolShare: `${def.share}% split` });
                    }
                }
            }
            prevMax = def.maxPct;
        }
        return payouts;
    }

    private mapPoolFromDb(data: any): PrizePool {
        const houseCut = Math.floor(data.total_pool * (data.house_cut_rate || 0.10));
        return {
            id: data.id, name: data.name, poolType: data.pool_type, status: data.status,
            entryFee: data.entry_fee, totalPool: data.total_pool, totalBurned: data.total_burned,
            houseCut, prizePool: data.total_pool - houseCut, entrantCount: data.entrant_count || 0,
            maxEntrants: data.max_entrants, startTime: new Date(data.start_time),
            endTime: data.end_time ? new Date(data.end_time) : undefined,
        };
    }

    private getTierFromRank(rank: number): PayoutTier {
        if (rank === 1) return 'ELITE_1';
        if (rank <= 3) return 'TOP_5';
        if (rank <= 5) return 'TOP_10';
        return 'TOP_25';
    }

    static getPayoutStructure(poolType: PoolType) {
        const structure = PAYOUT_CONFIG.STRUCTURES[poolType];
        const houseCut = PAYOUT_CONFIG.HOUSE_RATES[poolType];
        if (poolType === 'COMMUNITY_EVENT') {
            const tiers = structure.tiers as Record<string, { percentile: number; poolShare: number }>;
            return { description: structure.description, tiers: Object.entries(tiers).map(([, c]) => ({ place: `Top ${c.percentile}%`, share: `${c.poolShare}%` })), houseCut: `${houseCut * 100}%` };
        }
        const tiers = structure.tiers as Record<number, number>;
        return { description: structure.description, tiers: Object.entries(tiers).map(([p, s]) => ({ place: `#${p}`, share: `${s}%` })), houseCut: `${houseCut * 100}%` };
    }

    static previewPayouts(poolType: PoolType, totalPool: number, entrantCount: number) {
        const houseCutRate = PAYOUT_CONFIG.HOUSE_RATES[poolType];
        const houseCut = Math.floor(totalPool * houseCutRate);
        const prizePool = totalPool - houseCut;
        const structure = PAYOUT_CONFIG.STRUCTURES[poolType];
        const payouts: { place: string; amount: number }[] = [];

        if (poolType === 'COMMUNITY_EVENT') {
            const tiers = structure.tiers as Record<string, { percentile: number; poolShare: number }>;
            for (const [, c] of Object.entries(tiers)) {
                const tierCount = Math.ceil(entrantCount * (c.percentile / 100));
                const tierPool = Math.floor(prizePool * (c.poolShare / 100));
                payouts.push({ place: `Top ${c.percentile}%`, amount: tierCount > 0 ? Math.floor(tierPool / tierCount) : 0 });
            }
        } else {
            const tiers = structure.tiers as Record<number, number>;
            for (const [p, s] of Object.entries(tiers)) payouts.push({ place: `#${p}`, amount: Math.floor(prizePool * (s / 100)) });
        }
        return { prizePool, houseCut, payouts };
    }
}

export default PrizePoolLogic;
