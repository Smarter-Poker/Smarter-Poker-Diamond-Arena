/**
 * 🛡️ YELLOW ACTIVE LOGIC ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_ACTIVE_LOGIC (TASKS 4-6)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowActiveLogicEngine, ACTIVE_LOGIC_CONFIG } from '../engines/YellowActiveLogicEngine.js';
import { jest } from '@jest/globals';

describe('🛡️ YellowActiveLogicEngine (Tasks 4-6)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowActiveLogicEngine(null))
                .toThrow('ACTIVE_LOGIC_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowActiveLogicEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 04: 25% BURN ENFORCER
    // ═══════════════════════════════════════════════════════

    describe('Task 04: THE 25_PERCENT_BURN_ENFORCER', () => {

        test('✅ HARD LAW: Burn percentage is 25%', () => {
            expect(ACTIVE_LOGIC_CONFIG.BURN.PERCENTAGE).toBe(0.25);
        });

        test('✅ HARD LAW: Seller percentage is 75%', () => {
            expect(ACTIVE_LOGIC_CONFIG.BURN.SELLER_PERCENTAGE).toBe(0.75);
        });

        test('✅ calculateBurnSplit returns correct 25%/75% split', () => {
            const result = YellowActiveLogicEngine.calculateBurnSplit(100);

            expect(result.salePrice).toBe(100);
            expect(result.burnAmount).toBe(25);
            expect(result.sellerReceives).toBe(75);
            expect(result.burnPercentage).toBe(25);
        });

        test('✅ calculateBurnSplit: 40 diamonds = 10 burn, 30 seller', () => {
            const result = YellowActiveLogicEngine.calculateBurnSplit(40);

            expect(result.burnAmount).toBe(10);
            expect(result.sellerReceives).toBe(30);
        });

        test('✅ Minimum 1 diamond burn for sales >= 4', () => {
            const result = YellowActiveLogicEngine.calculateBurnSplit(4);

            expect(result.burnAmount).toBe(1);
            expect(result.sellerReceives).toBe(3);
        });

        test('✅ No burn for tiny sales < 4', () => {
            const result = YellowActiveLogicEngine.calculateBurnSplit(3);

            expect(result.burnAmount).toBe(0);
            expect(result.sellerReceives).toBe(3);
        });

        test('✅ Includes hardLaw in result', () => {
            const result = YellowActiveLogicEngine.calculateBurnSplit(100);
            expect(result.hardLaw).toBe('75_TO_SELLER_25_TO_BURN');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 05: STREAK MULTIPLIER CALCULATOR
    // ═══════════════════════════════════════════════════════

    describe('Task 05: STREAK_MULTIPLIER_CALCULATOR', () => {

        test('✅ HARD LAW: 3-Day multiplier is 1.2x', () => {
            expect(ACTIVE_LOGIC_CONFIG.STREAK.DAY_3_MULTIPLIER).toBe(1.20);
        });

        test('✅ HARD LAW: 7-Day multiplier is 1.5x', () => {
            expect(ACTIVE_LOGIC_CONFIG.STREAK.DAY_7_MULTIPLIER).toBe(1.50);
        });

        test('✅ HARD LAW: 30-Day multiplier is 2.0x', () => {
            expect(ACTIVE_LOGIC_CONFIG.STREAK.DAY_30_MULTIPLIER).toBe(2.00);
        });

        test('✅ calculateMultiplier: Day 0 = 1.0x', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 0);

            expect(result.multiplier).toBe(1.00);
            expect(result.final_diamonds).toBe(10);
            expect(result.streak.tier_name).toBe('COLD');
        });

        test('✅ calculateMultiplier: Day 3 = 1.2x (HARD LAW)', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 3);

            expect(result.multiplier).toBe(1.20);
            expect(result.final_diamonds).toBe(12);
            expect(result.streak_bonus).toBe(2);
            expect(result.streak.tier_name).toBe('WARMING');
        });

        test('✅ calculateMultiplier: Day 7 = 1.5x (HARD LAW)', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 7);

            expect(result.multiplier).toBe(1.50);
            expect(result.final_diamonds).toBe(15);
            expect(result.streak_bonus).toBe(5);
            expect(result.streak.tier_name).toBe('HOT');
        });

        test('✅ calculateMultiplier: Day 30 = 2.0x (HARD LAW)', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 30);

            expect(result.multiplier).toBe(2.00);
            expect(result.final_diamonds).toBe(20);
            expect(result.streak_bonus).toBe(10);
            expect(result.streak.tier_name).toBe('LEGENDARY');
        });

        test('✅ calculateMultiplier: Day 14 = 1.75x (BLAZING)', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 14);

            expect(result.multiplier).toBe(1.75);
            expect(result.final_diamonds).toBe(17);
        });

        test('✅ Includes formula in result', () => {
            const result = YellowActiveLogicEngine.calculateMultiplier(10, 7);
            expect(result.formula).toContain('1.50');
            expect(result.formula).toContain('15');
        });

        test('✅ getAllStreakTiers returns 6 tiers', () => {
            const tiers = YellowActiveLogicEngine.getAllStreakTiers();
            expect(tiers.length).toBe(6);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 06: ATOMIC MINT SECURITY GUARD
    // ═══════════════════════════════════════════════════════

    describe('Task 06: ATOMIC_MINT_SECURITY_GUARD', () => {

        test('✅ HARD LAW: Mastery threshold is 85%', () => {
            expect(ACTIVE_LOGIC_CONFIG.MASTERY.THRESHOLD).toBe(0.85);
        });

        test('✅ Training sources list is defined', () => {
            const sources = ACTIVE_LOGIC_CONFIG.MASTERY.TRAINING_SOURCES;
            expect(sources).toContain('TRAINING_REWARD');
            expect(sources).toContain('SESSION_REWARD');
        });

        test('✅ validateMintRequest: Invalid amount fails', () => {
            const result = YellowActiveLogicEngine.validateMintRequest(0, 'TRAINING_REWARD', 0.90);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('INVALID_AMOUNT');
        });

        test('✅ validateMintRequest: Training without accuracy fails', () => {
            const result = YellowActiveLogicEngine.validateMintRequest(10, 'TRAINING_REWARD', null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('ACCURACY_REQUIRED');
            expect(result.hardLaw).toBe('85_PERCENT_MASTERY_GATE');
        });

        test('✅ validateMintRequest: Below 85% fails (HARD LAW)', () => {
            const result = YellowActiveLogicEngine.validateMintRequest(10, 'TRAINING_REWARD', 0.80);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('MASTERY_GATE_FAILED');
            expect(result.hardLaw).toBe('85_PERCENT_MASTERY_GATE');
        });

        test('✅ validateMintRequest: Exactly 85% passes', () => {
            const result = YellowActiveLogicEngine.validateMintRequest(10, 'TRAINING_REWARD', 0.85);
            expect(result.valid).toBe(true);
        });

        test('✅ validateMintRequest: Non-training sources bypass mastery check', () => {
            const result = YellowActiveLogicEngine.validateMintRequest(10, 'ARCADE_WIN', null);
            expect(result.valid).toBe(true);
        });

        test('✅ previewSecureMint: Below 85% is not eligible', () => {
            const result = YellowActiveLogicEngine.previewSecureMint(10, 7, 0.80);
            expect(result.success).toBe(false);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('MASTERY_GATE_FAILED');
        });

        test('✅ previewSecureMint: 85% with streak applies multiplier', () => {
            const result = YellowActiveLogicEngine.previewSecureMint(10, 7, 0.90);
            expect(result.success).toBe(true);
            expect(result.eligible).toBe(true);
            expect(result.multiplier).toBe(1.50);
            expect(result.finalDiamonds).toBe(15);
            expect(result.masteryVerified).toBe(true);
        });

        test('✅ previewSecureMint: 30-day streak doubles reward', () => {
            const result = YellowActiveLogicEngine.previewSecureMint(10, 30, 0.95);
            expect(result.multiplier).toBe(2.00);
            expect(result.finalDiamonds).toBe(20);
            expect(result.streakTier).toBe('LEGENDARY');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔗 RPC INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('RPC Integration', () => {

        test('✅ applyDiamondMultiplier calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        base_diamonds: 10,
                        multiplier: 1.50,
                        final_diamonds: 15
                    },
                    error: null
                })
            };

            const engine = new YellowActiveLogicEngine(mockSupabase);
            const result = await engine.applyDiamondMultiplier('user-123', 10, 'TRAINING');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_apply_diamond_multiplier', {
                p_user_id: 'user-123',
                p_base_diamonds: 10,
                p_source: 'TRAINING'
            });
            expect(result.success).toBe(true);
        });

        test('✅ mintDiamondsSecure calls RPC with validation', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        status: 'ATOMIC_SUCCESS',
                        data: { final_amount: 15 }
                    },
                    error: null
                })
            };

            const engine = new YellowActiveLogicEngine(mockSupabase);
            const result = await engine.mintDiamondsSecure('user-123', 10, {
                source: 'TRAINING_REWARD',
                accuracy: 0.90
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('mint_diamonds_secure', expect.any(Object));
            expect(result.success).toBe(true);
        });

        test('✅ mintDiamondsSecure fails locally for low accuracy', async () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowActiveLogicEngine(mockSupabase);

            const result = await engine.mintDiamondsSecure('user-123', 10, {
                source: 'TRAINING_REWARD',
                accuracy: 0.70  // Below 85%
            });

            // Should fail locally without calling RPC
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.error).toBe('MASTERY_GATE_FAILED');
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🛡️ YELLOW ACTIVE LOGIC ENGINE — TEST SUITE LOADED    ║
║     MILITARY_PAYLOAD: YELLOW_ACTIVE_LOGIC (TASKS 4-6)     ║
╚════════════════════════════════════════════════════════════╝
`);
