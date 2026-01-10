/**
 * 💎 YELLOW FOUNDATION ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_FOUNDATION (TASKS 1-3)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowFoundationEngine, FOUNDATION_CONFIG } from '../engines/YellowFoundationEngine.js';
import { jest } from '@jest/globals';

describe('💎 YellowFoundationEngine (Tasks 1-3)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowFoundationEngine(null))
                .toThrow('FOUNDATION_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowFoundationEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📋 TASK 01: ATOMIC DIAMOND LEDGER TESTS
    // ═══════════════════════════════════════════════════════

    describe('Task 01: ATOMIC_DIAMOND_LEDGER', () => {

        test('✅ FOUNDATION_CONFIG defines ledger table', () => {
            expect(FOUNDATION_CONFIG.LEDGER.TABLE).toBe('diamond_ledger_entries');
        });

        test('✅ HARD LAW: Ledger is marked as immutable', () => {
            expect(FOUNDATION_CONFIG.LEDGER.IMMUTABLE).toBe(true);
        });

        test('✅ appendToLedger calls RPC with correct params', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, entry_id: 'abc-123', balance_after: 100 },
                    error: null
                })
            };

            const engine = new YellowFoundationEngine(mockSupabase);
            const result = await engine.appendToLedger('user-123', 50, 'TRAINING_REWARD');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_append_to_ledger', {
                p_user_id: 'user-123',
                p_delta: 50,
                p_source: 'TRAINING_REWARD',
                p_reference_id: null,
                p_reference_type: null,
                p_metadata: {}
            });
            expect(result.success).toBe(true);
        });

        test('✅ appendToLedger supports negative delta (debit)', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, delta: -25, balance_after: 75 },
                    error: null
                })
            };

            const engine = new YellowFoundationEngine(mockSupabase);
            const result = await engine.appendToLedger('user-123', -25, 'ARCADE_STAKE');

            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 02: 25% BURN VAULT TESTS
    // ═══════════════════════════════════════════════════════

    describe('Task 02: THE_25_PERCENT_BURN_VAULT', () => {

        test('✅ HARD LAW: Burn percentage is 25%', () => {
            expect(FOUNDATION_CONFIG.BURN.PERCENTAGE).toBe(0.25);
        });

        test('✅ calculateBurn returns correct 25% split', () => {
            const result = YellowFoundationEngine.calculateBurn(100);

            expect(result.originalAmount).toBe(100);
            expect(result.burnAmount).toBe(25);
            expect(result.netAmount).toBe(75);
            expect(result.burnPercentage).toBe(25);
        });

        test('✅ calculateBurn floors fractional burns', () => {
            const result = YellowFoundationEngine.calculateBurn(10);

            expect(result.burnAmount).toBe(2);  // floor(10 * 0.25) = 2
            expect(result.netAmount).toBe(8);
        });

        test('✅ Minimum 1 diamond burn for transactions >= 4', () => {
            const result = YellowFoundationEngine.calculateBurn(4);

            expect(result.burnAmount).toBe(1);
            expect(result.netAmount).toBe(3);
        });

        test('✅ recordBurn calls RPC correctly', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        burn_id: 'burn-123',
                        burn_amount: 25,
                        net_amount: 75
                    },
                    error: null
                })
            };

            const engine = new YellowFoundationEngine(mockSupabase);
            const result = await engine.recordBurn('buyer-123', 'tx-456', 100, 'MARKETPLACE');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_record_burn', {
                p_payer_id: 'buyer-123',
                p_transaction_id: 'tx-456',
                p_original_amount: 100,
                p_source: 'MARKETPLACE'
            });
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 03: MULTIPLIER STREAK LOOKUP TESTS
    // ═══════════════════════════════════════════════════════

    describe('Task 03: MULTIPLIER_STREAK_LOOKUP', () => {

        test('✅ HARD LAW: 3-Day streak = 1.2x multiplier', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(3);
            expect(result.multiplier).toBe(1.20);
            expect(result.tierName).toBe('WARMING');
        });

        test('✅ HARD LAW: 7-Day streak = 1.5x multiplier', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(7);
            expect(result.multiplier).toBe(1.50);
            expect(result.tierName).toBe('HOT');
        });

        test('✅ HARD LAW: 30-Day streak = 2.0x multiplier', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(30);
            expect(result.multiplier).toBe(2.00);
            expect(result.tierName).toBe('LEGENDARY');
        });

        test('✅ Day 0 returns 1.0x (COLD tier)', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(0);
            expect(result.multiplier).toBe(1.00);
            expect(result.tierName).toBe('COLD');
        });

        test('✅ Day 14 returns 1.75x (BLAZING tier)', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(14);
            expect(result.multiplier).toBe(1.75);
            expect(result.tierName).toBe('BLAZING');
        });

        test('✅ Day 100+ still returns 2.0x (LEGENDARY cap)', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(100);
            expect(result.multiplier).toBe(2.00);
            expect(result.tierName).toBe('LEGENDARY');
        });

        test('✅ Includes next tier info', () => {
            const result = YellowFoundationEngine.getStreakMultiplierLocal(5);
            expect(result.nextTier).toBe('HOT');
            expect(result.nextMultiplier).toBe(1.50);
            expect(result.daysToNext).toBe(2); // 7 - 5 = 2
        });

        test('✅ getAllStreakTiers returns all 5 tiers', () => {
            const tiers = YellowFoundationEngine.getAllStreakTiers();
            expect(tiers.length).toBe(5);
            expect(tiers[0].tier).toBe('COLD');
            expect(tiers[4].tier).toBe('LEGENDARY');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💎 TRAINING REWARD CALCULATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('calculateTrainingReward()', () => {

        test('✅ Applies multiplier to base reward', () => {
            const result = YellowFoundationEngine.calculateTrainingReward(10, 7);

            expect(result.baseReward).toBe(10);
            expect(result.multiplier).toBe(1.50);
            expect(result.finalReward).toBe(15);
            expect(result.streakBonus).toBe(5);
        });

        test('✅ No bonus on Day 0', () => {
            const result = YellowFoundationEngine.calculateTrainingReward(10, 0);

            expect(result.finalReward).toBe(10);
            expect(result.streakBonus).toBe(0);
        });

        test('✅ 30-Day doubles the reward', () => {
            const result = YellowFoundationEngine.calculateTrainingReward(10, 30);

            expect(result.finalReward).toBe(20);
            expect(result.streakBonus).toBe(10);
            expect(result.tierName).toBe('LEGENDARY');
        });

        test('✅ Includes formula string', () => {
            const result = YellowFoundationEngine.calculateTrainingReward(10, 7);
            expect(result.formula).toContain('1.50');
            expect(result.formula).toContain('15');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔧 CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('FOUNDATION_CONFIG Validation', () => {

        test('✅ Streak config has 5 tiers', () => {
            expect(FOUNDATION_CONFIG.STREAK.TIERS.length).toBe(5);
        });

        test('✅ Burn tables are correctly defined', () => {
            expect(FOUNDATION_CONFIG.BURN.VAULT_TABLE).toBe('burn_vault');
            expect(FOUNDATION_CONFIG.BURN.LEDGER_TABLE).toBe('burn_ledger');
        });

        test('✅ Min burn threshold is 4 diamonds', () => {
            expect(FOUNDATION_CONFIG.BURN.MIN_BURN_THRESHOLD).toBe(4);
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     💎 YELLOW FOUNDATION ENGINE — TEST SUITE LOADED       ║
║     MILITARY_PAYLOAD: YELLOW_FOUNDATION (TASKS 1-3)       ║
╚════════════════════════════════════════════════════════════╝
`);
