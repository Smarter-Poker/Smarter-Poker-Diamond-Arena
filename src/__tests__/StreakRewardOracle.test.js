/**
 * 🔮 STREAK REWARD ORACLE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for ORDER 15: STREAK_REWARD_ORACLE_SYNC
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { StreakRewardOracle, ORACLE_CONFIG } from '../services/StreakRewardOracle.js';
import { jest } from '@jest/globals';

describe('🔮 StreakRewardOracle (Order 15: RED Sync)', () => {

    // ═══════════════════════════════════════════════════════
    // 🔧 TEST SETUP
    // ═══════════════════════════════════════════════════════

    let mockSupabase;
    let oracle;

    beforeEach(() => {
        mockSupabase = {
            from: jest.fn()
        };
    });

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new StreakRewardOracle(null))
                .toThrow('ORACLE_ERROR');
        });

        test('✅ Creates oracle with valid supabase client', () => {
            oracle = new StreakRewardOracle(mockSupabase);
            expect(oracle).toBeDefined();
            expect(oracle.supabase).toBe(mockSupabase);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔴 RED ENGINE SYNC TESTS
    // ═══════════════════════════════════════════════════════

    describe('syncStreakFromRed()', () => {

        test('✅ Syncs streak from RED Engine (profiles table)', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 7, skill_tier: 'INTERMEDIATE' },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.syncStreakFromRed('user-123');

            expect(result.streakDays).toBe(7);
            expect(result.source).toBe('RED_ENGINE');
            expect(result.table).toBe('profiles');
            expect(result.multiplier).toBe(1.50); // 7-day tier
        });

        test('✅ Falls back to YELLOW Engine (wallets) when RED unavailable', async () => {
            mockSupabase.from = jest.fn((table) => ({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue(
                            table === 'profiles'
                                ? { data: null, error: { message: 'Not found' } }
                                : { data: { current_streak: 3, longest_streak: 10 }, error: null }
                        )
                    })
                })
            }));

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.syncStreakFromRed('user-123');

            expect(result.streakDays).toBe(3);
            expect(result.source).toBe('YELLOW_ENGINE');
            expect(result.table).toBe('wallets');
            expect(result.multiplier).toBe(1.20); // 3-day tier
        });

        test('✅ Returns default 0 streak when both sources fail', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Connection failed' }
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.syncStreakFromRed('user-123');

            expect(result.streakDays).toBe(0);
            expect(result.source).toBe('DEFAULT');
            expect(result.multiplier).toBe(1.00);
        });

        test('✅ Includes multiplier tier info in response', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 30 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.syncStreakFromRed('user-123');

            expect(result.multiplier).toBe(2.00);
            expect(result.tier).toBe('LEGENDARY');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💎 REWARD CALCULATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('calculateRewardWithOracle()', () => {

        test('✅ Calculates training reward with oracle-synced multiplier', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 7 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.calculateRewardWithOracle('user-123', {
                accuracy: 0.90,
                baseReward: 10
            });

            expect(result.success).toBe(true);
            expect(result.reward.multiplier).toBe(1.50);
            expect(result.oracle).toBeDefined();
            expect(result.oracle.syncedFrom).toBe('RED_ENGINE');
            expect(result.oracle.streakDays).toBe(7);
        });

        test('✅ Fails mastery gate check with low accuracy', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 30 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.calculateRewardWithOracle('user-123', {
                accuracy: 0.50,
                baseReward: 10
            });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('MASTERY_GATE_FAILED');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎰 ARCADE REWARD TESTS
    // ═══════════════════════════════════════════════════════

    describe('calculateArcadeReward()', () => {

        test('✅ Applies streak multiplier to arcade payout', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 14 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.calculateArcadeReward('user-123', 100);

            expect(result.success).toBe(true);
            expect(result.basePayout).toBe(100);
            expect(result.multiplier).toBe(1.75); // 14-day tier
            expect(result.finalPayout).toBe(175); // 100 × 1.75
            expect(result.streakBonus).toBe(75);
        });

        test('✅ 30-day streak doubles arcade payout', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 30 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);
            const result = await oracle.calculateArcadeReward('user-123', 100);

            expect(result.multiplier).toBe(2.00);
            expect(result.finalPayout).toBe(200);
            expect(result.tier).toBe('LEGENDARY');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🗄️ CACHE TESTS
    // ═══════════════════════════════════════════════════════

    describe('Cache Management', () => {

        test('✅ Returns cached result on second call', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 5 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);

            // First call - hits database
            await oracle.syncStreakFromRed('user-123');

            // Second call - should use cache
            const cached = await oracle.syncStreakFromRed('user-123');

            expect(cached.fromCache).toBe(true);
            expect(cached.streakDays).toBe(5);
        });

        test('✅ clearCache() removes cached data', async () => {
            mockSupabase.from = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { current_streak: 5 },
                            error: null
                        })
                    })
                })
            });

            oracle = new StreakRewardOracle(mockSupabase);

            await oracle.syncStreakFromRed('user-123');
            oracle.clearCache();

            const fresh = await oracle.syncStreakFromRed('user-123');
            expect(fresh.fromCache).toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 STATIC METHOD TESTS
    // ═══════════════════════════════════════════════════════

    describe('Static Methods', () => {

        test('✅ getMultiplierPreview() returns tier info without DB', () => {
            const preview = StreakRewardOracle.getMultiplierPreview(7);
            expect(preview.multiplier).toBe(1.50);
            expect(preview.tier).toBe('HOT');
        });

        test('✅ getAllTiers() returns all multiplier tiers', () => {
            const tiers = StreakRewardOracle.getAllTiers();
            expect(tiers.length).toBeGreaterThanOrEqual(5);
            expect(tiers.find(t => t.tier === 'LEGENDARY').multiplier).toBe(2.00);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔧 ORACLE CONFIG TESTS
    // ═══════════════════════════════════════════════════════

    describe('ORACLE_CONFIG', () => {

        test('✅ PRIMARY_SOURCE is profiles (RED Engine)', () => {
            expect(ORACLE_CONFIG.PRIMARY_SOURCE).toBe('profiles');
        });

        test('✅ FALLBACK_SOURCE is wallets (YELLOW Engine)', () => {
            expect(ORACLE_CONFIG.FALLBACK_SOURCE).toBe('wallets');
        });

        test('✅ Multipliers match Hard Law specification', () => {
            expect(ORACLE_CONFIG.MULTIPLIERS.DAY_3).toBe(1.20);
            expect(ORACLE_CONFIG.MULTIPLIERS.DAY_7).toBe(1.50);
            expect(ORACLE_CONFIG.MULTIPLIERS.DAY_30).toBe(2.00);
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🔮 STREAK REWARD ORACLE — TEST SUITE LOADED           ║
║     ORDER 15: STREAK_REWARD_ORACLE_SYNC                   ║
╚════════════════════════════════════════════════════════════╝
`);
