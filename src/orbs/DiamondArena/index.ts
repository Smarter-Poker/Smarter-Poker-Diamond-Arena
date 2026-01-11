/**
 * 💎 DIAMOND ARENA — ORB #03
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * High-stakes competitive arena with atomic settlements,
 * automated prize distribution, and real-time leaderboards.
 * 
 * HARD LAWS ENFORCED:
 * - 25% Burn Law (instant stake burn)
 * - Immutable Ledger Law (Hash-ID logging)
 * - Triple-Wallet Isolation (PERSONAL/STAKED/MAKEUP)
 * - Velocity Guardian (50K+ flagged)
 * - Transaction Cooldown (2-minute minimum)
 * - Section 4E Transparent Payouts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Core Engines
export { StakingVault, VAULT_CONFIG } from './StakingVault';
export { PrizePoolLogic, PAYOUT_CONFIG } from './PrizePoolLogic';

// UI Components
export { ArenaDashboard } from './ArenaDashboard';

// Types
export type {
    StakeTier,
    PoolType,
    EntryStatus,
    WalletType,
    StakeEntry,
    SettlementResult,
    VaultStats,
} from './StakingVault';

export type {
    PoolStatus,
    PayoutTier,
    PrizePool,
    Entrant,
    PayoutResult,
    DistributionReport,
} from './PrizePoolLogic';
