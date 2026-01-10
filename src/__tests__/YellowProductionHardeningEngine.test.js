/**
 * 🔒 YELLOW PRODUCTION HARDENING ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_PRODUCTION_HARDENING (TASKS 22-24)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowProductionHardeningEngine, PRODUCTION_HARDENING_CONFIG } from '../engines/YellowProductionHardeningEngine.js';
import { jest } from '@jest/globals';

describe('🔒 YellowProductionHardeningEngine (Tasks 22-24)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowProductionHardeningEngine(null))
                .toThrow('PRODUCTION_HARDENING_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowProductionHardeningEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔒 TASK 22: 25% BURN AUDIT SERVICE
    // ═══════════════════════════════════════════════════════

    describe('Task 22: 25_PERCENT_BURN_AUDIT_SERVICE', () => {

        test('✅ HARD LAW: Burn rate is 25%', () => {
            expect(PRODUCTION_HARDENING_CONFIG.BURN_AUDIT.BURN_RATE).toBe(0.25);
        });

        test('✅ Tolerance is 0.1%', () => {
            expect(PRODUCTION_HARDENING_CONFIG.BURN_AUDIT.TOLERANCE).toBe(0.001);
        });

        test('✅ Auto freeze is enabled', () => {
            expect(PRODUCTION_HARDENING_CONFIG.BURN_AUDIT.AUTO_FREEZE).toBe(true);
        });

        test('✅ runBurnIntegrityCheck calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        status: 'INTEGRITY_VERIFIED',
                        audit: { expected_burn: 1000, actual_burn: 1000 }
                    },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.runBurnIntegrityCheck();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('burn_integrity_check', expect.any(Object));
            expect(result.status).toBe('INTEGRITY_VERIFIED');
        });

        test('✅ Detects ledger frozen status', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: false,
                        error: 'LEDGER_FROZEN',
                        frozen_at: '2026-01-09T22:00:00Z'
                    },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.runBurnIntegrityCheck();

            expect(result.error).toBe('LEDGER_FROZEN');
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 23: ATOMIC MINT RECONCILIATION
    // ═══════════════════════════════════════════════════════

    describe('Task 23: ATOMIC_MINT_RECONCILIATION', () => {

        test('✅ Reconciliation interval is 60 seconds', () => {
            expect(PRODUCTION_HARDENING_CONFIG.RECONCILIATION.INTERVAL_MS).toBe(60000);
        });

        test('✅ Critical variance threshold is 10', () => {
            expect(PRODUCTION_HARDENING_CONFIG.RECONCILIATION.CRITICAL_VARIANCE).toBe(10);
        });

        test('✅ runReconciliation calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        reconciliation: {
                            variance: 0,
                            is_balanced: true,
                            status: 'BALANCED'
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.runReconciliation();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('ledger_audit_loop');
            expect(result.reconciliation.is_balanced).toBe(true);
        });

        test('✅ startReconciliationLoop returns stop function', () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, reconciliation: { status: 'BALANCED' } },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const callback = jest.fn();
            const stop = engine.startReconciliationLoop(callback, 100000);

            expect(typeof stop).toBe('function');
            stop(); // Clean up
        });

        test('✅ Detects critical variance', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        reconciliation: {
                            variance: 100,
                            is_balanced: false,
                            status: 'CRITICAL'
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.runReconciliation();

            expect(result.reconciliation.status).toBe('CRITICAL');
            expect(result.reconciliation.is_balanced).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 24: MULTIPLIER STREAK GATE
    // ═══════════════════════════════════════════════════════

    describe('Task 24: MULTIPLIER_STREAK_GATE', () => {

        test('✅ HARD LAW: Legendary multiplier is 2.0x', () => {
            expect(PRODUCTION_HARDENING_CONFIG.MULTIPLIER_GATE.LEGENDARY_MULTIPLIER).toBe(2.00);
        });

        test('✅ HARD LAW: 30 days required for 2.0x', () => {
            expect(PRODUCTION_HARDENING_CONFIG.MULTIPLIER_GATE.LEGENDARY_DAYS_REQUIRED).toBe(30);
        });

        test('✅ Max login gap is 2 days', () => {
            expect(PRODUCTION_HARDENING_CONFIG.MULTIPLIER_GATE.MAX_LOGIN_GAP_DAYS).toBe(2);
        });

        test('✅ verifyMultiplierLocal: 30+ days = 2.0x approved', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowProductionHardeningEngine(mockSupabase);

            const result = engine.verifyMultiplierLocal(2.00, 30, 100);

            expect(result.verification.approved_multiplier).toBe(2.00);
            expect(result.verification.was_downgraded).toBe(false);
            expect(result.reward.final).toBe(200);
        });

        test('✅ verifyMultiplierLocal: 15 days = downgrade to 1.75x', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowProductionHardeningEngine(mockSupabase);

            const result = engine.verifyMultiplierLocal(2.00, 15, 100);

            expect(result.verification.approved_multiplier).toBe(1.75);
            expect(result.verification.was_downgraded).toBe(true);
            expect(result.reward.final).toBe(175);
        });

        test('✅ verifyMultiplierLocal: 7 days = downgrade to 1.5x', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowProductionHardeningEngine(mockSupabase);

            const result = engine.verifyMultiplierLocal(2.00, 7, 100);

            expect(result.verification.approved_multiplier).toBe(1.50);
            expect(result.verification.was_downgraded).toBe(true);
        });

        test('✅ verifyMultiplierLocal: 0 days = downgrade to 1.0x', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowProductionHardeningEngine(mockSupabase);

            const result = engine.verifyMultiplierLocal(2.00, 0, 100);

            expect(result.verification.approved_multiplier).toBe(1.00);
            expect(result.verification.was_downgraded).toBe(true);
            expect(result.verification.downgrade_reason).toContain('0 days streak');
        });

        test('✅ verifyMultiplierStreakGate calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        verification: {
                            verified: true,
                            approved_multiplier: 2.00
                        },
                        reward: { final: 200 }
                    },
                    error: null
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.verifyMultiplierStreakGate('user-123', 2.00, 100);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('verify_multiplier_streak_gate', expect.any(Object));
            expect(result.verification.approved_multiplier).toBe(2.00);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🏥 HEALTH CHECK
    // ═══════════════════════════════════════════════════════

    describe('Health Check', () => {

        test('✅ runHealthCheck returns combined status', async () => {
            const mockSupabase = {
                rpc: jest.fn()
                    .mockResolvedValueOnce({
                        data: { status: 'INTEGRITY_VERIFIED' },
                        error: null
                    })
                    .mockResolvedValueOnce({
                        data: { reconciliation: { is_balanced: true, status: 'BALANCED' } },
                        error: null
                    }),
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { ledger_frozen: false },
                            error: null
                        })
                    })
                })
            };

            const engine = new YellowProductionHardeningEngine(mockSupabase);
            const result = await engine.runHealthCheck();

            expect(result.success).toBe(true);
            expect(result.checks).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration Validation', () => {

        test('✅ Fallback tiers are ordered by minDays descending', () => {
            const tiers = PRODUCTION_HARDENING_CONFIG.MULTIPLIER_GATE.FALLBACK_TIERS;
            for (let i = 1; i < tiers.length; i++) {
                expect(tiers[i - 1].minDays).toBeGreaterThan(tiers[i].minDays);
            }
        });

        test('✅ All critical flags are booleans', () => {
            expect(typeof PRODUCTION_HARDENING_CONFIG.BURN_AUDIT.AUTO_FREEZE).toBe('boolean');
            expect(typeof PRODUCTION_HARDENING_CONFIG.RECONCILIATION.AUTO_FREEZE_ON_CRITICAL).toBe('boolean');
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🔒 YELLOW PRODUCTION HARDENING — TEST SUITE LOADED    ║
║     MILITARY_PAYLOAD: YELLOW_PRODUCTION_HARDENING (22-24) ║
╚════════════════════════════════════════════════════════════╝
`);
