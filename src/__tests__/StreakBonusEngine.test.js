/**
 * 🧪 STREAK BONUS ENGINE — TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for streak multiplier logic.
 * Tier 1: 3 days = 1.2x | Tier 2: 7 days = 2.0x
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { jest } from '@jest/globals';
import { StreakBonusEngine, STREAK_TIERS_V2 } from '../engines/StreakBonusEngine.js';

// ═══════════════════════════════════════════════════════════
// 🔌 MOCK SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════

const createMockSupabase = (rpcResponses = {}) => ({
    rpc: jest.fn((functionName, params) => {
        const response = rpcResponses[functionName];
        if (response?.error) {
            return Promise.resolve({ data: null, error: response.error });
        }
        return Promise.resolve({ data: response?.data || {}, error: null });
    })
});

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK TIER TESTS
// ═══════════════════════════════════════════════════════════

describe('🔥 StreakBonusEngine', () => {

    describe('STREAK_TIERS_V2 Configuration', () => {

        test('✅ Tier 1 (3 days) has 1.2x multiplier', () => {
            expect(STREAK_TIERS_V2.TIER_1.multiplier).toBe(1.20);
            expect(STREAK_TIERS_V2.TIER_1.minDays).toBe(3);
            expect(STREAK_TIERS_V2.TIER_1.maxDays).toBe(6);
        });

        test('✅ Tier 2 (7 days) has 2.0x multiplier', () => {
            expect(STREAK_TIERS_V2.TIER_2.multiplier).toBe(2.00);
            expect(STREAK_TIERS_V2.TIER_2.minDays).toBe(7);
            expect(STREAK_TIERS_V2.TIER_2.maxDays).toBe(13);
        });

        test('✅ Cold tier has 1.0x multiplier', () => {
            expect(STREAK_TIERS_V2.COLD.multiplier).toBe(1.00);
            expect(STREAK_TIERS_V2.COLD.minDays).toBe(0);
        });

        test('✅ Legendary tier has no max days', () => {
            expect(STREAK_TIERS_V2.LEGENDARY.maxDays).toBeNull();
            expect(STREAK_TIERS_V2.LEGENDARY.multiplier).toBe(2.50);
        });
    });

    describe('getMultiplierLocal()', () => {
        let engine;

        beforeEach(() => {
            engine = new StreakBonusEngine(createMockSupabase({}));
        });

        test('✅ Returns COLD for 0 days', () => {
            const result = engine.getMultiplierLocal(0);
            expect(result.tier).toBe('COLD');
            expect(result.multiplier).toBe(1.00);
        });

        test('✅ Returns WARMING for 1-2 days', () => {
            expect(engine.getMultiplierLocal(1).tier).toBe('WARMING');
            expect(engine.getMultiplierLocal(2).tier).toBe('WARMING');
            expect(engine.getMultiplierLocal(1).multiplier).toBe(1.10);
        });

        test('✅ Returns TIER_1 (1.2x) for 3-6 days', () => {
            expect(engine.getMultiplierLocal(3).tier).toBe('TIER_1');
            expect(engine.getMultiplierLocal(3).multiplier).toBe(1.20);
            expect(engine.getMultiplierLocal(6).tier).toBe('TIER_1');
        });

        test('✅ Returns TIER_2 (2.0x) for 7-13 days', () => {
            expect(engine.getMultiplierLocal(7).tier).toBe('TIER_2');
            expect(engine.getMultiplierLocal(7).multiplier).toBe(2.00);
            expect(engine.getMultiplierLocal(13).tier).toBe('TIER_2');
        });

        test('✅ Returns BLAZING for 14-29 days', () => {
            expect(engine.getMultiplierLocal(14).tier).toBe('BLAZING');
            expect(engine.getMultiplierLocal(14).multiplier).toBe(2.25);
        });

        test('✅ Returns LEGENDARY for 30+ days', () => {
            expect(engine.getMultiplierLocal(30).tier).toBe('LEGENDARY');
            expect(engine.getMultiplierLocal(100).tier).toBe('LEGENDARY');
            expect(engine.getMultiplierLocal(365).multiplier).toBe(2.50);
        });
    });

    describe('previewReward()', () => {
        let engine;

        beforeEach(() => {
            engine = new StreakBonusEngine(createMockSupabase({}));
        });

        test('✅ Calculates Tier 1 bonus correctly', () => {
            const preview = engine.previewReward(100, 3);
            expect(preview.baseAmount).toBe(100);
            expect(preview.multiplier).toBe(1.20);
            expect(preview.finalAmount).toBe(120);
            expect(preview.bonusAmount).toBe(20);
            expect(preview.tier).toBe('TIER_1');
        });

        test('✅ Calculates Tier 2 bonus correctly', () => {
            const preview = engine.previewReward(100, 7);
            expect(preview.baseAmount).toBe(100);
            expect(preview.multiplier).toBe(2.00);
            expect(preview.finalAmount).toBe(200);
            expect(preview.bonusAmount).toBe(100);
            expect(preview.tier).toBe('TIER_2');
        });

        test('✅ Returns correct formula string', () => {
            const preview = engine.previewReward(50, 7);
            expect(preview.formula).toBe('50 × 2.00 = 100');
        });

        test('✅ Floors fractional amounts', () => {
            const preview = engine.previewReward(7, 3); // 7 * 1.2 = 8.4
            expect(preview.finalAmount).toBe(8);
        });
    });

    describe('getNextTierInfo()', () => {
        let engine;

        beforeEach(() => {
            engine = new StreakBonusEngine(createMockSupabase({}));
        });

        test('✅ Returns days until Tier 1 from Cold', () => {
            const info = engine.getNextTierInfo(0);
            expect(info.nextTier).toBe('WARMING');
            expect(info.daysToNext).toBe(1);
        });

        test('✅ Returns days until Tier 2 from Tier 1', () => {
            const info = engine.getNextTierInfo(5);
            expect(info.nextTier).toBe('TIER_2');
            expect(info.daysToNext).toBe(2); // 7 - 5 = 2
            expect(info.nextMultiplier).toBe(2.00);
        });

        test('✅ Returns max tier message at Legendary', () => {
            const info = engine.getNextTierInfo(50);
            expect(info.nextTier).toBeNull();
            expect(info.message).toContain('Maximum tier');
        });
    });

    describe('mintWithStreakBonus() via RPC', () => {

        test('✅ Calls fn_mint_with_streak_bonus with correct params', async () => {
            const mockResponse = {
                success: true,
                status: 'STREAK_MINT_SUCCESS',
                data: {
                    base_amount: 100,
                    bonus_amount: 20,
                    final_amount: 120,
                    balance_before: 0,
                    balance_after: 120,
                    transaction_id: 'tx-123'
                },
                streak: {
                    consecutive_days: 3,
                    multiplier: 1.20,
                    tier: 'TIER_1',
                    tier_label: '🔥 Streak Tier 1'
                },
                meta: { execution_ms: 1.5 }
            };

            const supabase = createMockSupabase({
                fn_mint_with_streak_bonus: { data: mockResponse }
            });

            const engine = new StreakBonusEngine(supabase);
            const result = await engine.mintWithStreakBonus('user-123', 100, 'SESSION_REWARD');

            expect(supabase.rpc).toHaveBeenCalledWith('fn_mint_with_streak_bonus', {
                p_user_id: 'user-123',
                p_base_amount: 100,
                p_source: 'SESSION_REWARD',
                p_metadata: {}
            });

            expect(result.success).toBe(true);
            expect(result.baseAmount).toBe(100);
            expect(result.finalAmount).toBe(120);
            expect(result.streak.multiplier).toBe(1.20);
            expect(result.streak.tier).toBe('TIER_1');
        });
    });

    describe('loginAndMintBonus() via RPC', () => {

        test('✅ Calls fn_login_and_mint_bonus and returns summary', async () => {
            const mockResponse = {
                success: true,
                status: 'LOGIN_BONUS_SUCCESS',
                summary: {
                    consecutive_days: 7,
                    diamonds_earned: 10,
                    new_balance: 150,
                    multiplier: 2.00,
                    tier: '🔥🔥 Streak Tier 2'
                },
                login: {},
                mint: {}
            };

            const supabase = createMockSupabase({
                fn_login_and_mint_bonus: { data: mockResponse }
            });

            const engine = new StreakBonusEngine(supabase);
            const result = await engine.loginAndMintBonus('user-123', 5);

            expect(supabase.rpc).toHaveBeenCalledWith('fn_login_and_mint_bonus', {
                p_user_id: 'user-123',
                p_base_bonus: 5
            });

            expect(result.success).toBe(true);
            expect(result.summary.consecutiveDays).toBe(7);
            expect(result.summary.multiplier).toBe(2.00);
            expect(result.summary.diamondsEarned).toBe(10);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// 📋 TEST SUMMARY
// ═══════════════════════════════════════════════════════════

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🔥 STREAK BONUS ENGINE — TEST SUITE LOADED            ║
║     Tier 1: 3 days = 1.2x | Tier 2: 7 days = 2.0x         ║
╚════════════════════════════════════════════════════════════╝
`);
