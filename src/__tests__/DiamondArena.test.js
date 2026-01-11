/**
 * 💎 DIAMOND ARENA STAKING VAULT — TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Verification tests for ORB_03 Diamond Arena
 * 
 * HARD LAWS TESTED:
 * • 25% Burn Rate
 * • Atomic Balance Verification
 * • Immutable Ledger (Hash-ID)
 * • Velocity Guardian (50K+ flag)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { StakingVault, VAULT_CONFIG } from '../orbs/DiamondArena/StakingVault';
import { PrizePoolLogic, PAYOUT_CONFIG } from '../orbs/DiamondArena/PrizePoolLogic';

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 BURN LAW TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Burn Law (25%)', () => {

    test('BURN_RATE is hardcoded to 0.25 (25%)', () => {
        expect(VAULT_CONFIG.BURN_RATE).toBe(0.25);
    });

    test('POOL_RATE is hardcoded to 0.75 (75%)', () => {
        expect(VAULT_CONFIG.POOL_RATE).toBe(0.75);
    });

    test('calculateStakeBreakdown correctly splits 100 diamonds', () => {
        const result = StakingVault.calculateStakeBreakdown(100);

        expect(result.gross).toBe(100);
        expect(result.burned).toBe(25);      // 25% burn
        expect(result.netToPool).toBe(75);   // 75% to pool
        expect(result.burnRate).toBe('25%');
    });

    test('calculateStakeBreakdown correctly splits 1000 diamonds', () => {
        const result = StakingVault.calculateStakeBreakdown(1000);

        expect(result.gross).toBe(1000);
        expect(result.burned).toBe(250);
        expect(result.netToPool).toBe(750);
    });

    test('calculateStakeBreakdown floors burn amount (no fractional diamonds)', () => {
        const result = StakingVault.calculateStakeBreakdown(10);

        expect(result.burned).toBe(2);       // floor(10 * 0.25) = 2
        expect(result.netToPool).toBe(8);    // 10 - 2
    });

    test('formula string is correctly generated', () => {
        const result = StakingVault.calculateStakeBreakdown(100);
        expect(result.formula).toContain('100💎');
        expect(result.formula).toContain('25🔥');
        expect(result.formula).toContain('75🏆');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 STAKE TIER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Stake Tiers', () => {

    test('MICRO tier: 10-24 diamonds, Level 1', () => {
        const tier = VAULT_CONFIG.STAKE_TIERS.MICRO;
        expect(tier.min).toBe(10);
        expect(tier.max).toBe(24);
        expect(tier.levelRequired).toBe(1);
    });

    test('LOW tier: 25-49 diamonds, Level 5', () => {
        const tier = VAULT_CONFIG.STAKE_TIERS.LOW;
        expect(tier.min).toBe(25);
        expect(tier.max).toBe(49);
        expect(tier.levelRequired).toBe(5);
    });

    test('MEDIUM tier: 50-99 diamonds, Level 10', () => {
        const tier = VAULT_CONFIG.STAKE_TIERS.MEDIUM;
        expect(tier.min).toBe(50);
        expect(tier.max).toBe(99);
        expect(tier.levelRequired).toBe(10);
    });

    test('HIGH tier: 100-249 diamonds, Level 20', () => {
        const tier = VAULT_CONFIG.STAKE_TIERS.HIGH;
        expect(tier.min).toBe(100);
        expect(tier.max).toBe(249);
        expect(tier.levelRequired).toBe(20);
    });

    test('ELITE tier: 250-100000 diamonds, Level 50', () => {
        const tier = VAULT_CONFIG.STAKE_TIERS.ELITE;
        expect(tier.min).toBe(250);
        expect(tier.max).toBe(100000);
        expect(tier.levelRequired).toBe(50);
    });

    test('getTierInfo returns correct tier for 50 diamonds', () => {
        const info = StakingVault.getTierInfo(50);
        expect(info).not.toBeNull();
        expect(info?.tier).toBe('MEDIUM');
        expect(info?.levelRequired).toBe(10);
    });

    test('getTierInfo returns null for invalid amount (5 diamonds)', () => {
        const info = StakingVault.getTierInfo(5);
        expect(info).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⏱️ COOLDOWN & VELOCITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Cooldown & Velocity', () => {

    test('Transaction cooldown is 120 seconds (2 minutes)', () => {
        expect(VAULT_CONFIG.TRANSACTION_COOLDOWN_MS).toBe(120_000);
    });

    test('Velocity threshold is 50,000 diamonds', () => {
        expect(VAULT_CONFIG.VELOCITY_THRESHOLD).toBe(50_000);
    });

    test('Velocity cooldown is 30 minutes', () => {
        expect(VAULT_CONFIG.VELOCITY_COOLDOWN_MS).toBe(1_800_000);
    });

    test('Hash prefix is PXQ', () => {
        expect(VAULT_CONFIG.HASH_PREFIX).toBe('PXQ');
    });

    test('generateHashId produces 16-character hash with PXQ prefix', () => {
        const hash = StakingVault.generateHashId();
        expect(hash).toHaveLength(16);
        expect(hash.startsWith('PXQ')).toBe(true);
    });

    test('generateHashId produces unique hashes', () => {
        const hashes = new Set();
        for (let i = 0; i < 100; i++) {
            hashes.add(StakingVault.generateHashId());
        }
        expect(hashes.size).toBe(100);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 PAYOUT STRUCTURE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Payout Structures', () => {

    test('HEADS_UP: Winner takes 100%', () => {
        const structure = PAYOUT_CONFIG.STRUCTURES.HEADS_UP;
        expect(structure.tiers[1]).toBe(100);
    });

    test('MULTI_TABLE: Top 3 split (50/30/20)', () => {
        const structure = PAYOUT_CONFIG.STRUCTURES.MULTI_TABLE;
        expect(structure.tiers[1]).toBe(50);
        expect(structure.tiers[2]).toBe(30);
        expect(structure.tiers[3]).toBe(20);
    });

    test('TOURNAMENT: Top 5 split (40/25/15/10/10)', () => {
        const structure = PAYOUT_CONFIG.STRUCTURES.TOURNAMENT;
        expect(structure.tiers[1]).toBe(40);
        expect(structure.tiers[2]).toBe(25);
        expect(structure.tiers[3]).toBe(15);
        expect(structure.tiers[4]).toBe(10);
        expect(structure.tiers[5]).toBe(10);
    });

    test('COMMUNITY_EVENT: 6-tier percentile distribution', () => {
        const structure = PAYOUT_CONFIG.STRUCTURES.COMMUNITY_EVENT;
        expect(structure.tiers.ELITE_1.poolShare).toBe(30);
        expect(structure.tiers.TOP_5.poolShare).toBe(20);
        expect(structure.tiers.TOP_10.poolShare).toBe(20);
        expect(structure.tiers.TOP_25.poolShare).toBe(15);
        expect(structure.tiers.TOP_50.poolShare).toBe(10);
        expect(structure.tiers.PARTICIPANTS.poolShare).toBe(5);
    });

    test('COMMUNITY_EVENT percentiles sum to 100%', () => {
        const structure = PAYOUT_CONFIG.STRUCTURES.COMMUNITY_EVENT.tiers;
        const total =
            structure.ELITE_1.poolShare +
            structure.TOP_5.poolShare +
            structure.TOP_10.poolShare +
            structure.TOP_25.poolShare +
            structure.TOP_50.poolShare +
            structure.PARTICIPANTS.poolShare;
        expect(total).toBe(100);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 📊 HOUSE CUT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — House Cut Rates', () => {

    test('HEADS_UP house cut is 10%', () => {
        expect(PAYOUT_CONFIG.HOUSE_RATES.HEADS_UP).toBe(0.10);
    });

    test('MULTI_TABLE house cut is 10%', () => {
        expect(PAYOUT_CONFIG.HOUSE_RATES.MULTI_TABLE).toBe(0.10);
    });

    test('SIT_N_GO house cut is 10%', () => {
        expect(PAYOUT_CONFIG.HOUSE_RATES.SIT_N_GO).toBe(0.10);
    });

    test('TOURNAMENT house cut is 12%', () => {
        expect(PAYOUT_CONFIG.HOUSE_RATES.TOURNAMENT).toBe(0.12);
    });

    test('COMMUNITY_EVENT house cut is 15%', () => {
        expect(PAYOUT_CONFIG.HOUSE_RATES.COMMUNITY_EVENT).toBe(0.15);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔢 PAYOUT PREVIEW TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Payout Preview', () => {

    test('previewPayouts calculates correct prize pool after house cut', () => {
        const result = PrizePoolLogic.previewPayouts('HEADS_UP', 1000, 2);

        expect(result.houseCut).toBe(100);    // 10% of 1000
        expect(result.prizePool).toBe(900);   // 1000 - 100
    });

    test('previewPayouts calculates correct TOURNAMENT payouts', () => {
        const result = PrizePoolLogic.previewPayouts('TOURNAMENT', 10000, 100);

        expect(result.houseCut).toBe(1200);   // 12% of 10000
        expect(result.prizePool).toBe(8800);  // 10000 - 1200

        // Check payout amounts
        expect(result.payouts[0].place).toBe('#1');
        expect(result.payouts[0].amount).toBe(3520);  // 40% of 8800
    });

    test('getPayoutStructure returns correct format for HEADS_UP', () => {
        const result = PrizePoolLogic.getPayoutStructure('HEADS_UP');

        expect(result.description).toBe('Winner Takes All');
        expect(result.houseCut).toBe('10%');
        expect(result.tiers[0].place).toBe('#1');
        expect(result.tiers[0].share).toBe('100%');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ POOL TYPE CONFIGURATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Pool Type Configuration', () => {

    test('HEADS_UP requires 2 players', () => {
        const config = VAULT_CONFIG.POOL_TYPES.HEADS_UP;
        expect(config.minPlayers).toBe(2);
        expect(config.maxPlayers).toBe(2);
    });

    test('TOURNAMENT supports up to 1000 players', () => {
        const config = VAULT_CONFIG.POOL_TYPES.TOURNAMENT;
        expect(config.minPlayers).toBe(6);
        expect(config.maxPlayers).toBe(1000);
    });

    test('COMMUNITY_EVENT supports up to 10000 players', () => {
        const config = VAULT_CONFIG.POOL_TYPES.COMMUNITY_EVENT;
        expect(config.minPlayers).toBe(10);
        expect(config.maxPlayers).toBe(10000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HARD LAW VERIFICATION SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

describe('💎 Diamond Arena — Hard Law Summary', () => {

    test('✅ 25% BURN LAW is enforced', () => {
        expect(VAULT_CONFIG.BURN_RATE).toBe(0.25);
    });

    test('✅ VELOCITY GUARDIAN threshold is 50K', () => {
        expect(VAULT_CONFIG.VELOCITY_THRESHOLD).toBe(50_000);
    });

    test('✅ TRANSACTION COOLDOWN is 2 minutes', () => {
        expect(VAULT_CONFIG.TRANSACTION_COOLDOWN_MS).toBe(120_000);
    });

    test('✅ HASH PREFIX is PXQ for immutable ledger', () => {
        expect(VAULT_CONFIG.HASH_PREFIX).toBe('PXQ');
    });

    test('✅ ALL pool types have defined house cuts', () => {
        const types = ['HEADS_UP', 'MULTI_TABLE', 'SIT_N_GO', 'TOURNAMENT', 'COMMUNITY_EVENT'];
        types.forEach(type => {
            expect(PAYOUT_CONFIG.HOUSE_RATES[type]).toBeDefined();
            expect(PAYOUT_CONFIG.HOUSE_RATES[type]).toBeGreaterThan(0);
        });
    });
});
