/**
 * ⚡ YELLOW INTEGRATION STRIKE ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_INTEGRATION_STRIKE (TASKS 16-18)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowIntegrationStrikeEngine, INTEGRATION_STRIKE_CONFIG } from '../engines/YellowIntegrationStrikeEngine.js';
import { jest } from '@jest/globals';

describe('⚡ YellowIntegrationStrikeEngine (Tasks 16-18)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowIntegrationStrikeEngine(null))
                .toThrow('INTEGRATION_STRIKE_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowIntegrationStrikeEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔢 TASK 16: MULTIPLIER STREAK VALUATOR
    // ═══════════════════════════════════════════════════════

    describe('Task 16: MULTIPLIER_STREAK_VALUATOR', () => {

        test('✅ HARD LAW: 3-Day multiplier is 1.20', () => {
            expect(INTEGRATION_STRIKE_CONFIG.VALUATOR.MULTIPLIERS.DAY_3).toBe(1.20);
        });

        test('✅ HARD LAW: 7-Day multiplier is 1.50', () => {
            expect(INTEGRATION_STRIKE_CONFIG.VALUATOR.MULTIPLIERS.DAY_7).toBe(1.50);
        });

        test('✅ HARD LAW: 30-Day multiplier is 2.00', () => {
            expect(INTEGRATION_STRIKE_CONFIG.VALUATOR.MULTIPLIERS.DAY_30).toBe(2.00);
        });

        test('✅ valuateReward: Day 0 = COLD, 1.0x', () => {
            const result = YellowIntegrationStrikeEngine.valuateReward(100, 0);
            expect(result.tier).toBe('COLD');
            expect(result.multiplier).toBe(1.00);
            expect(result.final_reward).toBe(100);
        });

        test('✅ valuateReward: Day 3 = WARMING, 1.2x', () => {
            const result = YellowIntegrationStrikeEngine.valuateReward(100, 3);
            expect(result.tier).toBe('WARMING');
            expect(result.multiplier).toBe(1.20);
            expect(result.final_reward).toBe(120);
            expect(result.streak_bonus).toBe(20);
        });

        test('✅ valuateReward: Day 7 = HOT, 1.5x', () => {
            const result = YellowIntegrationStrikeEngine.valuateReward(100, 7);
            expect(result.tier).toBe('HOT');
            expect(result.multiplier).toBe(1.50);
            expect(result.final_reward).toBe(150);
        });

        test('✅ valuateReward: Day 30 = LEGENDARY, 2.0x', () => {
            const result = YellowIntegrationStrikeEngine.valuateReward(100, 30);
            expect(result.tier).toBe('LEGENDARY');
            expect(result.multiplier).toBe(2.00);
            expect(result.final_reward).toBe(200);
        });

        test('✅ calculateFinalReward calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        valuation: { final_reward: 150, multiplier: 1.5 },
                        streak: { days: 7, tier: 'HOT' }
                    },
                    error: null
                })
            };

            const engine = new YellowIntegrationStrikeEngine(mockSupabase);
            const result = await engine.calculateFinalReward('user-123', 100);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_calculate_final_reward', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💰 TASK 17: ATOMIC MINT FINAL SETTLEMENT
    // ═══════════════════════════════════════════════════════

    describe('Task 17: ATOMIC_MINT_FINAL_SETTLEMENT', () => {

        test('✅ HARD LAW: Mastery threshold is 85%', () => {
            expect(INTEGRATION_STRIKE_CONFIG.SETTLEMENT.MASTERY_THRESHOLD).toBe(0.85);
        });

        test('✅ Reconciliation is required', () => {
            expect(INTEGRATION_STRIKE_CONFIG.SETTLEMENT.RECONCILIATION_REQUIRED).toBe(true);
        });

        test('✅ previewTrainingPayout: Below 85% not eligible', () => {
            const result = YellowIntegrationStrikeEngine.previewTrainingPayout(100, 7, 0.70);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('MASTERY_GATE_FAILED');
        });

        test('✅ previewTrainingPayout: 85% with streak applies multiplier', () => {
            const result = YellowIntegrationStrikeEngine.previewTrainingPayout(100, 7, 0.90);
            expect(result.eligible).toBe(true);
            expect(result.multiplier).toBe(1.50);
            expect(result.finalReward).toBe(150);
        });

        test('✅ processTrainingPayout fails locally for low accuracy', async () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowIntegrationStrikeEngine(mockSupabase);

            const result = await engine.processTrainingPayout({
                userId: 'user-123',
                sessionId: 'session-456',
                baseReward: 100,
                accuracy: 0.70
            });

            expect(mockSupabase.rpc).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.error).toBe('MASTERY_GATE_FAILED');
            expect(result.settlement).toBe('REJECTED');
        });

        test('✅ processTrainingPayout calls RPC for valid accuracy', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        settlement: 'COMPLETE',
                        payout: { final_reward: 150 },
                        reconciliation: { verified: true }
                    },
                    error: null
                })
            };

            const engine = new YellowIntegrationStrikeEngine(mockSupabase);
            const result = await engine.processTrainingPayout({
                userId: 'user-123',
                sessionId: 'session-456',
                baseReward: 100,
                accuracy: 0.90
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('process_training_payout', expect.any(Object));
            expect(result.success).toBe(true);
            expect(result.settlement).toBe('COMPLETE');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 18: MARKETPLACE BURN AUDIT TRAIL
    // ═══════════════════════════════════════════════════════

    describe('Task 18: MARKETPLACE_BURN_AUDIT_TRAIL', () => {

        test('✅ HARD LAW: Burn rate is 25%', () => {
            expect(INTEGRATION_STRIKE_CONFIG.BURN_AUDIT.BURN_RATE).toBe(0.25);
        });

        test('✅ Acceptable variance is 1%', () => {
            expect(INTEGRATION_STRIKE_CONFIG.BURN_AUDIT.ACCEPTABLE_VARIANCE).toBe(0.01);
        });

        test('✅ Audit statuses are defined', () => {
            const statuses = INTEGRATION_STRIKE_CONFIG.BURN_AUDIT.STATUSES;
            expect(statuses).toContain('PERFECT');
            expect(statuses).toContain('ACCEPTABLE');
            expect(statuses).toContain('WARNING');
            expect(statuses).toContain('CRITICAL');
        });

        test('✅ auditBurnIntegrity calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        burn_verification: {
                            expected_burn: 1000,
                            actual_burn: 1000,
                            variance: 0,
                            status: 'PERFECT'
                        },
                        deflationary_proof: {
                            is_deflationary: true,
                            deflation_rate: '5.2%'
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowIntegrationStrikeEngine(mockSupabase);
            const result = await engine.auditBurnIntegrity();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('audit_burn_integrity', expect.any(Object));
            expect(result.success).toBe(true);
        });

        test('✅ verifyDeflationaryStatus returns proof', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        deflationary_proof: {
                            is_deflationary: true,
                            deflation_rate: '5.2%',
                            total_burned: 5200
                        },
                        integrity: {
                            burn_law_compliant: true,
                            status: 'PERFECT'
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowIntegrationStrikeEngine(mockSupabase);
            const result = await engine.verifyDeflationaryStatus();

            expect(result.success).toBe(true);
            expect(result.isDeflationary).toBe(true);
            expect(result.hardLaw).toBe('25_PERCENT_BURN');
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration Validation', () => {

        test('✅ RED source is profiles', () => {
            expect(INTEGRATION_STRIKE_CONFIG.VALUATOR.RED_SOURCE).toBe('profiles');
        });

        test('✅ YELLOW fallback is wallets', () => {
            expect(INTEGRATION_STRIKE_CONFIG.VALUATOR.YELLOW_FALLBACK).toBe('wallets');
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     ⚡ YELLOW INTEGRATION STRIKE — TEST SUITE LOADED      ║
║     MILITARY_PAYLOAD: YELLOW_INTEGRATION_STRIKE (16-18)   ║
╚════════════════════════════════════════════════════════════╝
`);
