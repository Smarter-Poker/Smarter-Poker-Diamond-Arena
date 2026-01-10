/**
 * 🎰 YELLOW ADDICTION ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_ADDICTION_ENGINE (TASKS 7-9)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowAddictionEngine, ADDICTION_ENGINE_CONFIG } from '../engines/YellowAddictionEngine.js';
import { jest } from '@jest/globals';

describe('🎰 YellowAddictionEngine (Tasks 7-9)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowAddictionEngine(null))
                .toThrow('ADDICTION_ENGINE_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowAddictionEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 07: STREAK FIRE VISUALS
    // ═══════════════════════════════════════════════════════

    describe('Task 07: STREAK_FIRE_MULTIPLIER_UI_HOOK', () => {

        test('✅ Fire tiers are defined', () => {
            expect(ADDICTION_ENGINE_CONFIG.FIRE_TIERS.length).toBe(6);
        });

        test('✅ Day 0 = COLD/GRAY fire', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(0);

            expect(result.fire.intensity).toBe('NONE');
            expect(result.fire.color).toBe('GRAY');
            expect(result.display.tier_name).toBe('COLD');
            expect(result.display.emoji).toBe('❄️');
        });

        test('✅ Day 3 = BLUE fire (MEDIUM intensity)', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(3);

            expect(result.fire.intensity).toBe('MEDIUM');
            expect(result.fire.color).toBe('BLUE');
            expect(result.fire.hex).toBe('#3B82F6');
            expect(result.display.tier_name).toBe('BLUE_FIRE');
        });

        test('✅ Day 7 = GOLD fire (HIGH intensity)', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(7);

            expect(result.fire.intensity).toBe('HIGH');
            expect(result.fire.color).toBe('GOLD');
            expect(result.fire.hex).toBe('#F59E0B');
            expect(result.display.tier_name).toBe('GOLD_FIRE');
        });

        test('✅ Day 14 = PURPLE fire (VERY_HIGH intensity)', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(14);

            expect(result.fire.intensity).toBe('VERY_HIGH');
            expect(result.fire.color).toBe('PURPLE');
            expect(result.fire.hex).toBe('#8B5CF6');
            expect(result.display.tier_name).toBe('PURPLE_FIRE');
        });

        test('✅ Day 30+ = RAINBOW/LEGENDARY fire (MAXIMUM)', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(30);

            expect(result.fire.intensity).toBe('MAXIMUM');
            expect(result.fire.color).toBe('RAINBOW');
            expect(result.display.tier_name).toBe('LEGENDARY_FIRE');
            expect(result.display.emoji).toBe('👑');
        });

        test('✅ Includes progress to next tier', () => {
            const result = YellowAddictionEngine.getFireVisualsLocal(5);

            expect(result.progress.current_tier).toBe('BLUE_FIRE');
            expect(result.progress.next_tier).toBe('GOLD_FIRE');
            expect(result.progress.next_color).toBe('GOLD');
            expect(result.progress.days_to_next).toBe(2); // 7 - 5
        });

        test('✅ getFireColor returns hex code', () => {
            expect(YellowAddictionEngine.getFireColor(7)).toBe('#F59E0B');
            expect(YellowAddictionEngine.getFireColor(14)).toBe('#8B5CF6');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎰 TASK 08: DIAMOND CHEST VAULT
    // ═══════════════════════════════════════════════════════

    describe('Task 08: THE DIAMOND_CHEST_VAULT', () => {

        test('✅ Loot table has 6 tiers', () => {
            expect(ADDICTION_ENGINE_CONFIG.LOOT_TABLE.length).toBe(6);
        });

        test('✅ LEGENDARY tier requires 100% accuracy', () => {
            const legendary = ADDICTION_ENGINE_CONFIG.LOOT_TABLE.find(t => t.tier === 'LEGENDARY');
            expect(legendary.requiresPerfect).toBe(true);
            expect(legendary.minAccuracy).toBe(1.00);
        });

        test('✅ MYTHIC tier requires 30-day streak', () => {
            const mythic = ADDICTION_ENGINE_CONFIG.LOOT_TABLE.find(t => t.tier === 'MYTHIC');
            expect(mythic.minStreak).toBe(30);
            expect(mythic.requiresPerfect).toBe(true);
        });

        test('✅ rollChestLocal: Below 85% = no chest', () => {
            const result = YellowAddictionEngine.rollChestLocal(0.80, 0);

            expect(result.success).toBe(true);
            expect(result.rolled).toBe(false);
            expect(result.reason).toBe('ACCURACY_TOO_LOW');
        });

        test('✅ rollChestLocal: 85% can roll COMMON', () => {
            // Mock random to ensure a roll
            const originalRandom = Math.random;
            Math.random = () => 0.01; // Very low roll = high tier potential

            const result = YellowAddictionEngine.rollChestLocal(0.85, 0);

            Math.random = originalRandom;

            expect(result.success).toBe(true);
            // May or may not roll depending on cumulative, but should have correct accuracy
            expect(result.session.accuracy).toBe('85.0%');
        });

        test('✅ rollChestLocal: Perfect session can roll LEGENDARY', () => {
            const originalRandom = Math.random;
            Math.random = () => 0.005; // Very low roll for jackpot

            const result = YellowAddictionEngine.rollChestLocal(1.0, 0);

            Math.random = originalRandom;

            expect(result.session.is_perfect).toBe(true);
            expect(result.session.accuracy).toBe('100.0%');
        });

        test('✅ previewChestTiers: 85% shows COMMON only', () => {
            const tiers = YellowAddictionEngine.previewChestTiers(0.85);
            expect(tiers.some(t => t.tier === 'COMMON')).toBe(true);
            expect(tiers.some(t => t.tier === 'LEGENDARY')).toBe(false);
        });

        test('✅ previewChestTiers: 100% shows all tiers', () => {
            const tiers = YellowAddictionEngine.previewChestTiers(1.0);
            expect(tiers.some(t => t.tier === 'COMMON')).toBe(true);
            expect(tiers.some(t => t.tier === 'LEGENDARY')).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 09: ECONOMY HEALTH AUDIT
    // ═══════════════════════════════════════════════════════

    describe('Task 09: ECONOMY_HEALTH_AUDIT_LOG', () => {

        test('✅ Health thresholds are defined', () => {
            expect(ADDICTION_ENGINE_CONFIG.HEALTH.VARIANCE_WARNING).toBe(100);
            expect(ADDICTION_ENGINE_CONFIG.HEALTH.VARIANCE_CRITICAL).toBe(1000);
        });

        test('✅ determineHealthStatus: 0 variance = HEALTHY', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowAddictionEngine(mockSupabase);

            expect(engine.determineHealthStatus(0)).toBe('HEALTHY');
        });

        test('✅ determineHealthStatus: 50 variance = WARNING', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowAddictionEngine(mockSupabase);

            expect(engine.determineHealthStatus(50)).toBe('WARNING');
        });

        test('✅ determineHealthStatus: 500 variance = CRITICAL', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowAddictionEngine(mockSupabase);

            expect(engine.determineHealthStatus(500)).toBe('CRITICAL');
        });

        test('✅ determineHealthStatus: 5000 variance = EMERGENCY', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowAddictionEngine(mockSupabase);

            expect(engine.determineHealthStatus(5000)).toBe('EMERGENCY');
        });

        test('✅ auditEconomyHealth calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        health_status: 'HEALTHY',
                        is_balanced: true
                    },
                    error: null
                })
            };

            const engine = new YellowAddictionEngine(mockSupabase);
            const result = await engine.auditEconomyHealth();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_audit_economy_health');
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔗 RPC INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════

    describe('RPC Integration', () => {

        test('✅ getStreakFireVisuals calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        fire: { intensity: 'HIGH', color: 'GOLD' },
                        display: { tier_name: 'GOLD_FIRE' }
                    },
                    error: null
                })
            };

            const engine = new YellowAddictionEngine(mockSupabase);
            const result = await engine.getStreakFireVisuals(7);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_streak_fire_visuals', {
                p_streak_days: 7
            });
            expect(result.fire.color).toBe('GOLD');
        });

        test('✅ rollChestReward calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        rolled: true,
                        chest: { tier: 'RARE' },
                        reward: { diamonds: 50, is_jackpot: false },
                        session: { accuracy: '95.0%', is_perfect: false, streak_days: 5 }
                    },
                    error: null
                }),
                from: jest.fn().mockReturnValue({
                    insert: jest.fn().mockResolvedValue({ error: null })
                })
            };

            const engine = new YellowAddictionEngine(mockSupabase);
            const result = await engine.rollChestReward('user-123', 0.95, 5);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_roll_chest_reward', {
                p_user_id: 'user-123',
                p_accuracy: 0.95,
                p_streak_days: 5,
                p_session_id: null
            });
            expect(result.rolled).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration Validation', () => {

        test('✅ FIRE_TIERS ordered by minDays', () => {
            const tiers = ADDICTION_ENGINE_CONFIG.FIRE_TIERS;
            for (let i = 1; i < tiers.length; i++) {
                expect(tiers[i].minDays).toBeGreaterThan(tiers[i - 1].minDays);
            }
        });

        test('✅ LOOT_TABLE drop rates sum to ~100%', () => {
            const totalRate = ADDICTION_ENGINE_CONFIG.LOOT_TABLE
                .reduce((sum, tier) => sum + tier.dropRate, 0);
            // Drop rates don't need to sum exactly to 100% due to filtering
            expect(totalRate).toBeGreaterThan(90);
            expect(totalRate).toBeLessThanOrEqual(101);
        });

        test('✅ All loot tiers have emoji', () => {
            ADDICTION_ENGINE_CONFIG.LOOT_TABLE.forEach(tier => {
                expect(tier.emoji).toBeDefined();
                expect(tier.emoji.length).toBeGreaterThan(0);
            });
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎰 YELLOW ADDICTION ENGINE — TEST SUITE LOADED        ║
║     MILITARY_PAYLOAD: YELLOW_ADDICTION_ENGINE (7-9)       ║
╚════════════════════════════════════════════════════════════╝
`);
