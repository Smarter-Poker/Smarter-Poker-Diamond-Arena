/**
 * ✨ YELLOW VISUAL ADDICTION ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_VISUAL_ADDICTION (TASKS 19-21)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowVisualAddictionEngine, VISUAL_ADDICTION_CONFIG } from '../engines/YellowVisualAddictionEngine.js';
import { jest } from '@jest/globals';

describe('✨ YellowVisualAddictionEngine (Tasks 19-21)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowVisualAddictionEngine(null))
                .toThrow('VISUAL_ADDICTION_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowVisualAddictionEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ✨ TASK 19: DIAMOND MINT PARTICLE SYSTEM
    // ═══════════════════════════════════════════════════════

    describe('Task 19: DIAMOND_MINT_PARTICLE_SYSTEM', () => {

        test('✅ Particle tiers are defined (7 tiers)', () => {
            expect(VISUAL_ADDICTION_CONFIG.PARTICLES.TIERS.length).toBe(7);
        });

        test('✅ LEGENDARY and MYTHIC are jackpot tiers', () => {
            const jackpots = VISUAL_ADDICTION_CONFIG.PARTICLES.JACKPOT_TIERS;
            expect(jackpots).toContain('LEGENDARY');
            expect(jackpots).toContain('MYTHIC');
        });

        test('✅ getRewardBurstLocal: 5 diamonds = TINY', () => {
            const result = YellowVisualAddictionEngine.getRewardBurstLocal(5);
            expect(result.reward_burst.rarity_type).toBe('TINY');
            expect(result.reward_burst.is_jackpot).toBe(false);
        });

        test('✅ getRewardBurstLocal: 50 diamonds = MEDIUM', () => {
            const result = YellowVisualAddictionEngine.getRewardBurstLocal(50);
            expect(result.reward_burst.rarity_type).toBe('MEDIUM');
            expect(result.particles.count).toBe(25);
        });

        test('✅ getRewardBurstLocal: 300 diamonds = LEGENDARY (jackpot)', () => {
            const result = YellowVisualAddictionEngine.getRewardBurstLocal(300);
            expect(result.reward_burst.rarity_type).toBe('LEGENDARY');
            expect(result.reward_burst.is_jackpot).toBe(true);
            expect(result.particles.intensity).toBe('MAXIMUM');
        });

        test('✅ getRewardBurstLocal: 1000 diamonds = MYTHIC (jackpot)', () => {
            const result = YellowVisualAddictionEngine.getRewardBurstLocal(1000);
            expect(result.reward_burst.rarity_type).toBe('MYTHIC');
            expect(result.reward_burst.is_jackpot).toBe(true);
        });

        test('✅ getParticleTier returns correct tier', () => {
            expect(YellowVisualAddictionEngine.getParticleTier(10).tier).toBe('SMALL');
            expect(YellowVisualAddictionEngine.getParticleTier(100).tier).toBe('LARGE');
            expect(YellowVisualAddictionEngine.getParticleTier(500).tier).toBe('LEGENDARY');
        });

        test('✅ visual_cue format is correct', () => {
            const result = YellowVisualAddictionEngine.getRewardBurstLocal(50);
            expect(result.visual_cue).toContain('+50 💎');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 20: MULTIPLIER FIRE UI SYNC
    // ═══════════════════════════════════════════════════════

    describe('Task 20: MULTIPLIER_FIRE_UI_SYNC', () => {

        test('✅ Fire overlay tiers are defined (6 tiers)', () => {
            expect(VISUAL_ADDICTION_CONFIG.FIRE_OVERLAY.TIERS.length).toBe(6);
        });

        test('✅ getFireOverlayLocal: Day 0 = COLD, no multiplier badge', () => {
            const result = YellowVisualAddictionEngine.getFireOverlayLocal(0, 100);
            expect(result.fire_bonus_overlay.tier).toBe('COLD');
            expect(result.fire_bonus_overlay.active).toBe(false);
            expect(result.label.visible).toBe(false);
        });

        test('✅ getFireOverlayLocal: Day 3 = WARMING, 1.2x badge', () => {
            const result = YellowVisualAddictionEngine.getFireOverlayLocal(3, 120);
            expect(result.fire_bonus_overlay.tier).toBe('WARMING');
            expect(result.fire_bonus_overlay.multiplier).toBe(1.20);
            expect(result.label.visible).toBe(true);
            expect(result.icon.emoji).toBe('🔥');
        });

        test('✅ getFireOverlayLocal: Day 7 = HOT, 1.5x badge', () => {
            const result = YellowVisualAddictionEngine.getFireOverlayLocal(7, 150);
            expect(result.fire_bonus_overlay.tier).toBe('HOT');
            expect(result.fire_bonus_overlay.multiplier).toBe(1.50);
            expect(result.icon.emoji).toBe('🔥🔥');
        });

        test('✅ getFireOverlayLocal: Day 30 = LEGENDARY, 2.0x badge', () => {
            const result = YellowVisualAddictionEngine.getFireOverlayLocal(30, 200);
            expect(result.fire_bonus_overlay.tier).toBe('LEGENDARY');
            expect(result.fire_bonus_overlay.multiplier).toBe(2.00);
            expect(result.icon.emoji).toBe('👑🔥');
        });

        test('✅ Base/bonus split is calculated correctly', () => {
            // 150 total at 1.5x means base was 100
            const result = YellowVisualAddictionEngine.getFireOverlayLocal(7, 150);
            expect(result.payout.total).toBe(150);
            expect(result.payout.base_reward).toBe(100);
            expect(result.payout.streak_bonus).toBe(50);
        });

        test('✅ getFireTier returns correct tier', () => {
            expect(YellowVisualAddictionEngine.getFireTier(0).tier).toBe('COLD');
            expect(YellowVisualAddictionEngine.getFireTier(5).tier).toBe('WARMING');
            expect(YellowVisualAddictionEngine.getFireTier(10).tier).toBe('HOT');
            expect(YellowVisualAddictionEngine.getFireTier(30).tier).toBe('LEGENDARY');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 21: ECONOMY SUPPLY BURN TICKER
    // ═══════════════════════════════════════════════════════

    describe('Task 21: ECONOMY_SUPPLY_BURN_TICKER', () => {

        test('✅ Burn ticker config is defined', () => {
            expect(VISUAL_ADDICTION_CONFIG.BURN_TICKER.REFRESH_INTERVAL_MS).toBe(5000);
            expect(VISUAL_ADDICTION_CONFIG.BURN_TICKER.BURN_LAW).toBe(0.25);
        });

        test('✅ formatBurnTickerDisplay formats correctly', () => {
            const display = YellowVisualAddictionEngine.formatBurnTickerDisplay(12345);
            expect(display).toContain('12,345');
            expect(display).toContain('🔥');
            expect(display).toContain('burned');
        });

        test('✅ getBurnTickerData calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        ticker: {
                            total_burned: 50000,
                            display: '50,000 💎 burned'
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowVisualAddictionEngine(mockSupabase);
            const result = await engine.getBurnTickerData();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_burn_ticker_data');
            expect(result.success).toBe(true);
        });

        test('✅ subscribeToBurnTicker returns unsubscribe function', () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, ticker: { total_burned: 0 } },
                    error: null
                })
            };

            const engine = new YellowVisualAddictionEngine(mockSupabase);
            const callback = jest.fn();
            const unsubscribe = engine.subscribeToBurnTicker(callback, 10000);

            expect(typeof unsubscribe).toBe('function');
            unsubscribe(); // Clean up
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎮 COMBINED VISUALS
    // ═══════════════════════════════════════════════════════

    describe('Combined Visual Data', () => {

        test('✅ getPayoutVisuals combines all visual data', async () => {
            const mockSupabase = {
                rpc: jest.fn()
                    .mockResolvedValueOnce({
                        data: { reward_burst: { count: 100 }, visual_cue: '💎 +100' },
                        error: null
                    })
                    .mockResolvedValueOnce({
                        data: { fire_bonus_overlay: { multiplier: 1.5 } },
                        error: null
                    })
                    .mockResolvedValueOnce({
                        data: { success: true, ticker: { total_burned: 5000 } },
                        error: null
                    })
            };

            const engine = new YellowVisualAddictionEngine(mockSupabase);
            const result = await engine.getPayoutVisuals('user-123', 100);

            expect(result.success).toBe(true);
            expect(result.particles).toBeDefined();
            expect(result.overlay).toBeDefined();
            expect(result.ticker).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration Validation', () => {

        test('✅ Particle tiers are ordered by min diamonds', () => {
            const tiers = VISUAL_ADDICTION_CONFIG.PARTICLES.TIERS;
            for (let i = 1; i < tiers.length; i++) {
                expect(tiers[i].min).toBeGreaterThan(tiers[i - 1].min);
            }
        });

        test('✅ Fire tiers are ordered by minDays', () => {
            const tiers = VISUAL_ADDICTION_CONFIG.FIRE_OVERLAY.TIERS;
            for (let i = 1; i < tiers.length; i++) {
                expect(tiers[i].minDays).toBeGreaterThan(tiers[i - 1].minDays);
            }
        });

        test('✅ All particle tiers have emoji', () => {
            VISUAL_ADDICTION_CONFIG.PARTICLES.TIERS.forEach(tier => {
                expect(tier.emoji).toBeDefined();
                expect(tier.emoji.length).toBeGreaterThan(0);
            });
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     ✨ YELLOW VISUAL ADDICTION — TEST SUITE LOADED        ║
║     MILITARY_PAYLOAD: YELLOW_VISUAL_ADDICTION (19-21)     ║
╚════════════════════════════════════════════════════════════╝
`);
