/**
 * 🧪 DIAMOND MINT ENGINE — TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Comprehensive tests for streak multiplier logic
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { DiamondMintEngine, STREAK_TIERS } from '../engines/DiamondMintEngine.js';

describe('💎 DiamondMintEngine', () => {

    // ═══════════════════════════════════════════════════════
    // 🧮 STREAK MULTIPLIER TESTS
    // ═══════════════════════════════════════════════════════
    describe('calculateReward()', () => {

        test('✅ Cold streak (0 days) returns 1.0x multiplier', () => {
            const result = DiamondMintEngine.calculateReward(100, 0);
            expect(result.multiplier).toBe(1.0);
            expect(result.finalAmount).toBe(100);
            expect(result.tier.label).toBe('❄️ Cold');
        });

        test('✅ Warming streak (1-2 days) returns 1.10x multiplier', () => {
            const result1 = DiamondMintEngine.calculateReward(100, 1);
            expect(result1.multiplier).toBe(1.10);
            expect(result1.finalAmount).toBe(110);

            const result2 = DiamondMintEngine.calculateReward(100, 2);
            expect(result2.multiplier).toBe(1.10);
            expect(result2.finalAmount).toBe(110);
        });

        test('✅ Warm streak (3-6 days) returns 1.25x multiplier', () => {
            const result3 = DiamondMintEngine.calculateReward(100, 3);
            expect(result3.multiplier).toBe(1.25);
            expect(result3.finalAmount).toBe(125);

            const result6 = DiamondMintEngine.calculateReward(100, 6);
            expect(result6.multiplier).toBe(1.25);
            expect(result6.finalAmount).toBe(125);
        });

        test('✅ Hot streak (7-13 days) returns 1.50x multiplier', () => {
            const result7 = DiamondMintEngine.calculateReward(100, 7);
            expect(result7.multiplier).toBe(1.50);
            expect(result7.finalAmount).toBe(150);

            const result13 = DiamondMintEngine.calculateReward(100, 13);
            expect(result13.multiplier).toBe(1.50);
            expect(result13.finalAmount).toBe(150);
        });

        test('✅ Blazing streak (14-29 days) returns 1.75x multiplier', () => {
            const result14 = DiamondMintEngine.calculateReward(100, 14);
            expect(result14.multiplier).toBe(1.75);
            expect(result14.finalAmount).toBe(175);
        });

        test('✅ Legendary streak (30+ days) returns 2.0x multiplier', () => {
            const result30 = DiamondMintEngine.calculateReward(100, 30);
            expect(result30.multiplier).toBe(2.0);
            expect(result30.finalAmount).toBe(200);

            // Even at 100 days, still 2.0x cap
            const result100 = DiamondMintEngine.calculateReward(100, 100);
            expect(result100.multiplier).toBe(2.0);
            expect(result100.finalAmount).toBe(200);
        });

        test('✅ Floors fractional diamonds', () => {
            // 7 * 1.25 = 8.75 → 8
            const result = DiamondMintEngine.calculateReward(7, 3);
            expect(result.finalAmount).toBe(8);
        });

        test('✅ Returns complete breakdown', () => {
            const result = DiamondMintEngine.calculateReward(50, 7);
            expect(result.breakdown).toBeDefined();
            expect(result.breakdown.base).toBe(50);
            expect(result.breakdown.bonus).toBe(25); // 75 - 50
            expect(result.breakdown.streakDays).toBe(7);
        });

        test('❌ Throws error for negative baseDiamonds', () => {
            expect(() => {
                DiamondMintEngine.calculateReward(-10, 5);
            }).toThrow('MINT_ERROR');
        });

        test('✅ Treats negative consecutiveDays as 0', () => {
            const result = DiamondMintEngine.calculateReward(100, -5);
            expect(result.multiplier).toBe(1.0);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TIER DETECTION TESTS
    // ═══════════════════════════════════════════════════════
    describe('getStreakTier()', () => {

        test('✅ Returns correct tier for each day range', () => {
            expect(DiamondMintEngine.getStreakTier(0)).toEqual(STREAK_TIERS.COLD);
            expect(DiamondMintEngine.getStreakTier(1)).toEqual(STREAK_TIERS.WARMING);
            expect(DiamondMintEngine.getStreakTier(3)).toEqual(STREAK_TIERS.WARM);
            expect(DiamondMintEngine.getStreakTier(7)).toEqual(STREAK_TIERS.HOT);
            expect(DiamondMintEngine.getStreakTier(14)).toEqual(STREAK_TIERS.BLAZING);
            expect(DiamondMintEngine.getStreakTier(30)).toEqual(STREAK_TIERS.LEGENDARY);
        });

        test('✅ Handles edge cases at tier boundaries', () => {
            expect(DiamondMintEngine.getStreakTier(2).label).toBe('🌡️ Warming');
            expect(DiamondMintEngine.getStreakTier(6).label).toBe('🔥 Warm');
            expect(DiamondMintEngine.getStreakTier(13).label).toBe('🔥🔥 Hot');
            expect(DiamondMintEngine.getStreakTier(29).label).toBe('🔥🔥🔥 Blazing');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 PROGRESSIVE MULTIPLIER TESTS
    // ═══════════════════════════════════════════════════════
    describe('calculateProgressiveMultiplier()', () => {

        test('✅ Increments by 0.05 per day', () => {
            expect(DiamondMintEngine.calculateProgressiveMultiplier(0)).toBe(1.0);
            expect(DiamondMintEngine.calculateProgressiveMultiplier(1)).toBe(1.05);
            expect(DiamondMintEngine.calculateProgressiveMultiplier(10)).toBe(1.5);
        });

        test('✅ Caps at 2.0x', () => {
            expect(DiamondMintEngine.calculateProgressiveMultiplier(20)).toBe(2.0);
            expect(DiamondMintEngine.calculateProgressiveMultiplier(100)).toBe(2.0);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎮 SESSION REWARD TESTS
    // ═══════════════════════════════════════════════════════
    describe('mintSessionReward()', () => {

        test('✅ Perfect 20-question session yields 10 base diamonds', () => {
            const result = DiamondMintEngine.mintSessionReward({
                accuracy: 1.0,
                questionsAnswered: 20
            }, 0);

            expect(result.breakdown.base).toBe(10);
            expect(result.finalAmount).toBe(10);
        });

        test('✅ Applies streak multiplier to session rewards', () => {
            const result = DiamondMintEngine.mintSessionReward({
                accuracy: 1.0,
                questionsAnswered: 20
            }, 7); // Hot streak = 1.5x

            expect(result.finalAmount).toBe(15);
        });

        test('✅ Accuracy reduces base reward proportionally', () => {
            const result = DiamondMintEngine.mintSessionReward({
                accuracy: 0.5, // 50% accuracy
                questionsAnswered: 20
            }, 0);

            expect(result.breakdown.base).toBe(5); // Half of 10
        });

        test('✅ Returns session metrics', () => {
            const result = DiamondMintEngine.mintSessionReward({
                accuracy: 0.85,
                questionsAnswered: 20
            }, 3);

            expect(result.sessionMetrics).toBeDefined();
            expect(result.sessionMetrics.accuracy).toBe('85.0%');
            expect(result.sessionMetrics.questionsAnswered).toBe(20);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎯 NEXT TIER CALCULATION TESTS
    // ═══════════════════════════════════════════════════════
    describe('getDaysToNextTier()', () => {

        test('✅ Returns days until next tier', () => {
            const result = DiamondMintEngine.getDaysToNextTier(0);
            expect(result.daysToNext).toBe(1);
            expect(result.nextTier.label).toBe('🌡️ Warming');
        });

        test('✅ Returns null when at max tier', () => {
            const result = DiamondMintEngine.getDaysToNextTier(30);
            expect(result.nextTier).toBeNull();
            expect(result.daysToNext).toBe(0);
        });

        test('✅ Calculates correct days from mid-tier', () => {
            const result = DiamondMintEngine.getDaysToNextTier(4); // In WARM tier
            expect(result.daysToNext).toBe(3); // 7 - 4 = 3 days to HOT
            expect(result.nextTier.label).toBe('🔥🔥 Hot');
        });
    });
});

// ═══════════════════════════════════════════════════════════
// 📋 TEST SUMMARY
// ═══════════════════════════════════════════════════════════
console.log(`
╔════════════════════════════════════════════════════════════╗
║     💎 DIAMOND MINT ENGINE — TEST SUITE LOADED            ║
║     Execute: npm test                                       ║
╚════════════════════════════════════════════════════════════╝
`);
